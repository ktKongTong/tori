import { Hono } from "hono";
import { z } from "zod";
import { NotFoundError } from "@/api/domain/error";
import { createOutboxEventFromCtx } from "@/api/domain/infra";
import { requireAuth, requireAdmin } from "@/api/server/middleware/auth.ts";
import { describeRoute } from "@/api/server/middleware/openapi/index.ts";
import { uniqueId } from "@repo/utils/id";
import { TASK_RUN_REQUESTED } from "./type.js";
import {
  createTaskDtoSchema,
  runTaskDtoSchema,
  taskDefinitionDtoSchema,
  taskDefinitionPageDtoSchema,
  taskPaginationQuerySchema,
  taskRunPageDtoSchema,
  taskRunRequestedDtoSchema,
  updateTaskDtoSchema,
} from "@/api/modules/platform/task/contract";
import { mapTaskDefinitionPage, mapTaskRunPage, toTaskDefinitionDto } from "./mapper.ts";

const app = new Hono();

app.use("*", requireAuth());

app.get(
  "/",
  requireAdmin(),
  describeRoute({
    tags: ["Tasks"],
    summary: "List task definitions",
    request: {
      query: taskPaginationQuerySchema,
    },
    response: {
      description: "Task definitions",
      body: taskDefinitionPageDtoSchema,
    },
  }),
  async (c) => {
    const ctx = c.get("serviceContext");
    const page = c.req.valid("query");
    const items = await ctx.repositories.task.listTaskDefinitionsByOwner(ctx.userId!, page);
    return c.json(mapTaskDefinitionPage(items));
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
      body: taskDefinitionDtoSchema,
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

    return c.json(toTaskDefinitionDto(task));
  },
);

app.get(
  "/:id/runs",
  requireAdmin(),
  describeRoute({
    tags: ["Tasks"],
    summary: "List task runs",
    request: {
      query: taskPaginationQuerySchema,
    },
    response: {
      description: "Task runs",
      body: taskRunPageDtoSchema,
    },
  }),
  async (c) => {
    const ctx = c.get("serviceContext");
    const taskDefinitionId = c.req.param("id");
    const { page, pageSize } = c.req.valid("query");
    if (!taskDefinitionId) {
      throw new NotFoundError("task definition not found");
    }

    const runs = await ctx.repositories.task.getTaskRunByTaskDefinitionId(taskDefinitionId, {
      page,
      pageSize,
    });

    return c.json(mapTaskRunPage(runs));
  },
);

app.post(
  "/",
  describeRoute({
    tags: ["Tasks"],
    summary: "Create task definition",
    request: { body: createTaskDtoSchema },
    response: {
      description: "Created task definition",
      body: taskDefinitionDtoSchema,
    },
  }),
  async (c) => {
    const body = c.req.valid("json");
    const result = await c.get("serviceContext").repositories.task.createTaskDefinition({
      ownerUserId: c.get("serviceContext").userId ?? null,
      ...body,
    });

    return c.json(toTaskDefinitionDto(result), 201);
  },
);

app.patch(
  "/:id",
  describeRoute({
    tags: ["Tasks"],
    summary: "Update task definition",
    request: { param: z.object({ id: z.string() }), body: updateTaskDtoSchema },
    response: {
      description: "Updated task definition",
      body: taskDefinitionDtoSchema,
    },
  }),
  async (c) => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const result = await c.get("serviceContext").repositories.task.updateTaskDefinition(id, body);

    if (!result) {
      throw new NotFoundError("task definition not found");
    }

    return c.json(toTaskDefinitionDto(result));
  },
);

app.delete(
  "/:id",
  requireAdmin(),
  describeRoute({
    tags: ["Tasks"],
    summary: "Delete task definition",
    request: { param: z.object({ id: z.string() }) },
    response: {
      description: "Deleted task definition",
      body: taskDefinitionDtoSchema,
    },
  }),
  async (c) => {
    const { id } = c.req.valid("param");
    const deleted = await c.get("serviceContext").repositories.task.deleteTaskDefinition(id);
    if (!deleted) {
      throw new NotFoundError("task definition not found");
    }
    return c.json(toTaskDefinitionDto(deleted));
  },
);

app.post(
  "/:id/run",
  describeRoute({
    tags: ["Tasks"],
    summary: "Trigger task run",
    request: { param: z.object({ id: z.string() }), body: runTaskDtoSchema },
    response: {
      description: "Run requested",
      body: taskRunRequestedDtoSchema,
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
