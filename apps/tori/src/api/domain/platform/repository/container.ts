import type {
  IConnectionRepository,
  IIntegrationRepository,
  INotifyRepository,
  ISubscriptionRepository,
} from "./ports/index.ts";
import type { InfraRepositoryContainer } from "@/api/domain/infra/repository.ts";

export type PlatformRepositoryContainer = InfraRepositoryContainer & {
  integration: IIntegrationRepository;
  notify: INotifyRepository;
  subscription: ISubscriptionRepository;
  connection: IConnectionRepository;
};
