import { createEventConsumer } from "@/api/domain/infra/eventing/index.ts";
import type { EventEnvelope } from "@/api/domain/infra/eventing/message.ts";

import { handleTaskRun } from "./registry.ts";
import { TASK_RUN_REQUESTED } from "./type.ts";

export const runTaskOnTaskRunRequested = createEventConsumer<{ taskRunId: string }>(
  "platform.task.run-requested",
  TASK_RUN_REQUESTED,
  async (ctx) => {
    const payload = ctx.event.payload as EventEnvelope<{ taskRunId: string }>["payload"];
    const taskRunId = payload?.taskRunId;
    if (!taskRunId) {
      return {
        id: ctx.event.id,
        status: "DROP",
        reason: "missing taskRunId",
      };
    }

    await handleTaskRun(ctx, taskRunId);

    return {
      id: ctx.event.id,
      status: "SUCCESS",
    };
  },
);

export const platformTaskConsumers = [runTaskOnTaskRunRequested];
