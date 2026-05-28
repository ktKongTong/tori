import { isCronDueAt, normalizeCronDate } from "@repo/task/cron";
import { createCronHandler } from "@/api/domain/infra/cron.ts";
import { createOutboxEventFromCtx } from "@/api/domain/infra/eventing/outbox/index.ts";
import { uniqueId } from "@repo/utils/id";
import { TASK_RUN_REQUESTED } from "./type.js";

export const scanDueTaskCron = createCronHandler("platform.task.scan-due", async (ctx) => {
  const now = normalizeCronDate(new Date());

  const definitions = await ctx.repositories.task.listEnabledTaskDefinitions({
    page: 1,
    pageSize: 100,
  });

  ctx.logger.debug(`handling definitions: ${definitions.data.length}`);
  for (const taskDefinition of definitions.data) {
    const due = isCronDueAt(taskDefinition.schedule, now);
    const alreadyTriggeredAt =
      taskDefinition.lastTriggeredAt &&
      Math.floor(taskDefinition.lastTriggeredAt.getTime() / 60000) ===
        Math.floor(now.getTime() / 60000);

    if (!due || alreadyTriggeredAt) continue;

    const taskRunId = uniqueId();

    await ctx.repositories.task.createTaskRun({
      id: taskRunId,
      taskDefinitionId: taskDefinition.id,
      kind: taskDefinition.kind,
      scheduledFor: now,
    });

    await ctx.sendEvent(
      createOutboxEventFromCtx(ctx, {
        type: TASK_RUN_REQUESTED,
        subject: `taskrun:${taskRunId}`,
        payload: {
          taskRunId,
        },
      }),
    );

    await ctx.repositories.task.markTaskDefinitionTriggered(taskDefinition.id, now);
  }
});
