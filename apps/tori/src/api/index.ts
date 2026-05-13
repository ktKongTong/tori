import {
  platformTaskConsumers,
  registerTaskHandlers,
  scanDueTaskCron,
} from "@/api/modules/platform/task/index.ts";
import { platformBotInstanceConsumers } from "@/api/modules/platform/bot-plugin/event.ts";
import { platformConnectionConsumers } from "@/api/modules/platform/connection/event.ts";
import { platformProxyInstanceConsumers } from "@/api/modules/platform/integration/event.ts";
import { platformSubscriptionConsumers } from "@/api/modules/platform/subscription/event.ts";
import { registerSubscriptionTaskDefinitions } from "@/api/modules/platform/subscription/task-definition.ts";
import { registerBotCommandDefinitions } from "@/api/modules/platform/bot-ingress/command.ts";
import { registerSubscriptionTargets } from "@/api/modules/platform/bot-ingress/commands/subscription-targets.ts";
import { registerIntegrationProviderHandlers } from "@/api/modules/platform/integration/provider-registry.ts";
import {
  steamBotCommandDefinitions,
  steamEventConsumers,
  steamIntegrationProviderHandlers,
  steamSubscriptionTaskDefinitions,
  steamSubscriptionTargetDefinitions,
  steamTaskHandlers,
} from "@/api/modules/steam/index.ts";
import { outboxCron } from "@/api/support/cron/outbox.cron.ts";
import { cronRegistry } from "@/api/support/cron/register.ts";
import { eventRouter } from "@/api/server/event-router.ts";

let registered = false;

export function registerApiV2Runtime() {
  if (registered) return;
  console.log("register cron");
  // 扫描到期任务，创建 TaskRunRequested Event 写入 Outbox
  cronRegistry.register("* * * * *", scanDueTaskCron);
  // 定时处理 Outbox 中的任务
  cronRegistry.register("* * * * *", outboxCron);

  registerTaskHandlers(...steamTaskHandlers);
  eventRouter.registerConsumer(
    ...platformTaskConsumers,
    ...platformBotInstanceConsumers,
    ...platformConnectionConsumers,
    ...platformProxyInstanceConsumers,
    ...platformSubscriptionConsumers,
    ...steamEventConsumers,
  );
  registerBotCommandDefinitions(...steamBotCommandDefinitions);
  registerSubscriptionTargets(...steamSubscriptionTargetDefinitions);
  registerSubscriptionTaskDefinitions(...steamSubscriptionTaskDefinitions);
  registerIntegrationProviderHandlers(steamIntegrationProviderHandlers);
  registered = true;
}

export { createApp } from "./server/app.ts";
export { cronRegistry } from "./support/cron/register.ts";
