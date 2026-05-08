import type {
  IConnectionRepository,
  IIntegrationRepository,
  INotifyRepository,
  ISubscriptionRepository,
} from "./ports/index.ts";
import type { InfraRepositoryContainer } from "@/api/domain/infra/repository.ts";
import type { IBindingRepository } from "@/api/modules/platform/binding/repository";

export type PlatformRepositoryContainer = InfraRepositoryContainer & {
  binding: IBindingRepository;
  integration: IIntegrationRepository;
  notify: INotifyRepository;
  subscription: ISubscriptionRepository;
  connection: IConnectionRepository;
};
