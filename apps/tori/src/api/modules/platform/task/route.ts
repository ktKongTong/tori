import { Hono } from "hono";
import { z } from "zod";
import { NotFoundError } from "@/api/domain/error";
import { createOutboxEventFromCtx } from "@/api/domain/infra";
import type { ServiceContext } from "@/api/domain/infra/service-context.ts";
import { requireAuth } from "@/api/server/middleware/auth.ts";
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

async function getVisibleTask(ctx: ServiceContext, taskId: string) {
  const task = await ctx.repositories.task.getTaskDefinitionById(taskId);
  if (!task) throw new NotFoundError("task definition not found");
  if (!ctx.isAdmin() && task.ownerUserId !== ctx.userId) {
    throw new NotFoundError("task definition not found");
  }
  return task;
}

app.get(
  "/",
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
    const items = ctx.isAdmin()
      ? await ctx.repositories.task.listTasks(page)
      : await ctx.repositories.task.listTaskDefinitionsByOwner(ctx.userId!, page);
    return c.json(mapTaskDefinitionPage(items));
  },
);

app.get(
  "/:id",
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

    const task = await getVisibleTask(ctx, taskDefinitionId);

    return c.json(toTaskDefinitionDto(task));
  },
);

app.get(
  "/:id/runs",
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
    await getVisibleTask(ctx, taskDefinitionId);

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
    const ctx = c.get("serviceContext");
    await getVisibleTask(ctx, id);
    const result = await ctx.repositories.task.updateTaskDefinition(id, body);

    if (!result) {
      throw new NotFoundError("task definition not found");
    }

    return c.json(toTaskDefinitionDto(result));
  },
);

app.delete(
  "/:id",
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
    const ctx = c.get("serviceContext");
    await getVisibleTask(ctx, id);
    const deleted = await ctx.repositories.task.deleteTaskDefinition(id);
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
    const task = await getVisibleTask(ctx, id);

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
