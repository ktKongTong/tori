import { Hono } from "hono";
import { z } from "zod";
import { NotFoundError } from "@/api/domain/error";
import { createOutboxEventFromCtx } from "@/api/domain/infra";
import { requireAuth } from "@/api/server/middleware/auth.ts";
import { describeRoute } from "@/api/server/middleware/openapi/index.ts";
import { cronSchema } from "@repo/utils/schema/cron";
import { uniqueId } from "@repo/utils/id";
import { TASK_RUN_REQUESTED } from "./type.js";

const app = new Hono();

const taskDefinitionSchema = z.object({
  id: z.string(),
  ownerUserId: z.string().nullable(),
  kind: z.string(),
  enabled: z.boolean(),
  schedule: z.string(),
  payload: z.record(z.string(), z.any()),
  lastTriggeredAt: z.string().nullable(),
  lastRunAt: z.string().nullable(),
  lastRunStatus: z.string().nullable(),
  lastError: z.string().nullable(),
});

const createTaskSchema = z.object({
  kind: z.string().min(1),
  enabled: z.boolean().optional(),
  schedule: cronSchema,
  payload: z.record(z.string(), z.any()),
  metadata: z.record(z.string(), z.any()).optional(),
});

const updateTaskSchema = z.object({
  enabled: z.boolean().optional(),
  schedule: cronSchema.optional(),
  payload: z.record(z.string(), z.any()).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

const runTaskSchema = z.object({
  reason: z.string().optional(),
});

app.use("*", requireAuth());

app.get(
  "/tasks",
  describeRoute({
    tags: ["Tasks"],
    summary: "List task definitions",
    response: {
      description: "Task definitions",
      body: z.object({ items: z.array(taskDefinitionSchema) }),
    },
  }),
  async (c) => {
    const ctx = c.get("serviceContext");
    const userId = ctx.userId;
    const rows = await ctx.repositories.task.listTaskDefinitionsByOwner(userId ?? "");

    return c.json({
      items: rows.map((row: (typeof rows)[number]) => ({
        id: row.id,
        ownerUserId: row.ownerUserId ?? null,
        kind: row.kind,
        enabled: row.enabled === 1,
        schedule: row.schedule,
        payload: row.payload as Record<string, unknown>,
        lastTriggeredAt: row.lastTriggeredAt?.toISOString() ?? null,
        lastRunAt: row.lastRunAt?.toISOString() ?? null,
        lastRunStatus: row.lastRunStatus ?? null,
        lastError: row.lastError ?? null,
      })),
    });
  },
);

app.post(
  "/tasks",
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
    const ctx = c.get("serviceContext");
    const row = await ctx.repositories.task.createTaskDefinition({
      id: uniqueId(),
      ownerUserId: ctx.userId ?? null,
      kind: body.kind,
      enabled: body.enabled === false ? 0 : 1,
      schedule: body.schedule,
      payload: body.payload,
      metadata: body.metadata ?? null,
    });

    return c.json({
      id: row.id,
      ownerUserId: row.ownerUserId ?? null,
      kind: row.kind,
      enabled: row.enabled === 1,
      schedule: row.schedule,
      payload: row.payload as Record<string, unknown>,
      lastTriggeredAt: row.lastTriggeredAt?.toISOString() ?? null,
      lastRunAt: row.lastRunAt?.toISOString() ?? null,
      lastRunStatus: row.lastRunStatus ?? null,
      lastError: row.lastError ?? null,
    });
  },
);

app.patch(
  "/tasks/:id",
  describeRoute({
    tags: ["Tasks"],
    summary: "Update task definition",
    request: { body: updateTaskSchema, param: z.object({ id: z.string() }) },
    response: {
      description: "Updated task definition",
      body: taskDefinitionSchema,
    },
  }),
  async (c) => {
    const body = c.req.valid("json");
    const param = c.req.valid("param");
    const row = await c.get("serviceContext").repositories.task.updateTaskDefinition(param.id, {
      enabled: body.enabled == null ? undefined : body.enabled ? 1 : 0,
      schedule: body.schedule,
      payload: body.payload,
      metadata: body.metadata,
    });
    if (!row) throw new NotFoundError("task definition not found");

    return c.json({
      id: row.id,
      ownerUserId: row.ownerUserId ?? null,
      kind: row.kind,
      enabled: row.enabled === 1,
      schedule: row.schedule,
      payload: row.payload as Record<string, unknown>,
      lastTriggeredAt: row.lastTriggeredAt?.toISOString() ?? null,
      lastRunAt: row.lastRunAt?.toISOString() ?? null,
      lastRunStatus: row.lastRunStatus ?? null,
      lastError: row.lastError ?? null,
    });
  },
);

app.post(
  "/tasks/:id/run",
  describeRoute({
    tags: ["Tasks"],
    summary: "Enqueue one task run",
    request: { body: runTaskSchema, param: z.object({ id: z.string() }) },
    response: {
      description: "Queued task run",
      body: z.object({ taskRunId: z.string(), outboxEventId: z.string() }),
    },
  }),
  async (c) => {
    const param = c.req.valid("param");
    const taskRunId = uniqueId();
    const outboxEvent = createOutboxEventFromCtx(c.get("serviceContext"), {
      type: TASK_RUN_REQUESTED,
      subject: `taskrun:${taskRunId}`,
      payload: {
        taskRunId,
      },
    });

    const ctx = c.get("serviceContext");
    await ctx.repositories.task.createTaskRun({
      id: taskRunId,
      taskDefinitionId: param.id,
      kind: "manual",
      status: "QUEUED",
      scheduledFor: new Date(),
    });
    await ctx.sendEvent(outboxEvent);

    return c.json({
      taskRunId,
      outboxEventId: outboxEvent.id,
    });
  },
);

export default app;
