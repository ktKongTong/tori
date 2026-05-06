import { steamEventConsumers as steamFamilyEventConsumers } from "./adapters/platform/events/family-library-changed.js";
import { steamSubscriptionEventConsumers } from "./adapters/platform/events/family-subscription.js";
export {
  steamBotCommandDefinitions,
  steamIntegrationProviderHandlers,
  steamSubscriptionTargetDefinitions,
} from "./adapters/platform/index.js";

export const steamEventConsumers = [
  ...steamFamilyEventConsumers,
  ...steamSubscriptionEventConsumers,
];
export { steamTaskHandlers } from "./adapters/platform/tasks/family-refresh.js";
