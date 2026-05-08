import { Hono } from "hono";
import { z } from "zod";
import { NotFoundError } from "@/api/domain/error";
import { createOutboxEventFromCtx } from "@/api/domain/infra";
import { requireAuth, requireAdmin } from "@/api/server/middleware/auth.ts";
import { describeRoute } from "@/api/server/middleware/openapi/index.ts";
import { uniqueId } from "@repo/utils/id";
import { TASK_RUN_REQUESTED } from "./type.js";
import {taskDefinitionSchema, taskRunSchema, createTaskSchema, updateTaskSchema, runTaskSchema, PaginationQuerySchema} from "./schema.ts";
import { PageBasedPaginationResultSchema } from "@repo/utils/schema/paging";

const app = new Hono();

app.use("*", requireAuth());

app.get(
  "/",
  requireAdmin(),
  describeRoute({
    tags: ["Tasks"],
    summary: "List task definitions",
    request: {
      query: PaginationQuerySchema,
    },
    response: {
      description: "Task definitions",
      body: PageBasedPaginationResultSchema(taskDefinitionSchema),
    },
  }),
  async (c) => {
    const ctx = c.get("serviceContext");
    const page = c.req.valid('query')
    const items = await ctx
      .repositories
      .task
      .listTaskDefinitionsByOwner(ctx.userId!, page);
    return c.json(items);
  },
);

app.get(
  "/:id",
  requireAdmin(),
  describeRoute({
    tags: ["Tasks"],
    summary: "Get task definition",
    response: {
      description: "Task definition",
      body: taskDefinitionSchema,
    },
  }),
  async (c) => {
    const ctx = c.get("serviceContext");
    const taskDefinitionId = c.req.param("id");

    if (!taskDefinitionId) {
      throw new NotFoundError("task definition not found");
    }

    const task = await ctx.repositories.task.getTaskDefinitionById(taskDefinitionId);

    if (!task) {
      throw new NotFoundError("task definition not found");
    }

    return c.json(task);
  },
);

app.get(
  "/:id/runs",
  requireAdmin(),
  describeRoute({
    tags: ["Tasks"],
    summary: "List task runs",
    request: {
      query: PaginationQuerySchema,
    },
    response: {
      description: "Task runs",
      body: PageBasedPaginationResultSchema(taskRunSchema),
    },
  }),
  async (c) => {
    const ctx = c.get("serviceContext");
    const taskDefinitionId = c.req.param("id");
    const { page, pageSize } = c.req.valid('query')
    if (!taskDefinitionId) {
      throw new NotFoundError("task definition not found");
    }

    const runs = await ctx
      .repositories
      .task
      .getTaskRunByTaskDefinitionId(
        taskDefinitionId,
        {page, pageSize}
      );

    return c.json(runs);
  },
);

app.post(
  "/",
  describeRoute({
    tags: ["Tasks"],
    summary: "Create task definition",
    request: { body: createTaskSchema },
    response: {
      description: "Created task definition",
      body: taskDefinitionSchema,
    },
  }),
  async (c) => {
    const body = c.req.valid("json");
    const result = await c.get("serviceContext").repositories.task.createTaskDefinition({
      ownerUserId: c.get("serviceContext").userId ?? null,
      ...body,
    });

    return c.json(result, 201);
  },
);

app.patch(
  "/:id",
  describeRoute({
    tags: ["Tasks"],
    summary: "Update task definition",
    request: { param: z.object({ id: z.string() }), body: updateTaskSchema },
    response: {
      description: "Updated task definition",
      body: taskDefinitionSchema,
    },
  }),
  async (c) => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const result = await c.get("serviceContext").repositories.task.updateTaskDefinition(id, body);

    if (!result) {
      throw new NotFoundError("task definition not found");
    }

    return c.json(result);
  },
);

app.post(
  "/:id/run",
  describeRoute({
    tags: ["Tasks"],
    summary: "Trigger task run",
    request: { param: z.object({ id: z.string() }), body: runTaskSchema },
    response: {
      description: "Run requested",
      body: z.object({
        taskRunId: z.string(),
        outboxEventId: z.string(),
      }),
    },
  }),
  async (c) => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const ctx = c.get("serviceContext");
    const task = await ctx.repositories.task.getTaskDefinitionById(id);
    if (!task) {
      throw new NotFoundError("task definition not found");
    }

    const taskRunId = uniqueId();

    const outboxEvent = createOutboxEventFromCtx(ctx, {
      type: TASK_RUN_REQUESTED,
      subject: `task:${task.id}`,
      payload: {
        taskRunId,
        taskDefinitionId: task.id,
        kind: task.kind,
        reason: body.reason ?? "manual-trigger",
        payload: task.payload,
      },
    });

    await ctx.sendEvent(outboxEvent);

    return c.json({
      taskRunId,
      outboxEventId: outboxEvent.id,
    });
  },
);

export default app;
