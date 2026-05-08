import type { InfraRepositoryContainer } from "@/api/domain/infra/repository.ts";
import type { IBindingRepository } from "@/api/modules/platform/binding/repository";
import type { IConnectionRepository } from "@/api/modules/platform/connection/repository/repository";
import type { IIntegrationRepository } from "@/api/modules/platform/integration/repository/repository";
import type { INotifyRepository } from "@/api/modules/platform/notify/repository/repository";
import type { ISubscriptionRepository } from "@/api/modules/platform/subscription/repository/repository";

export type PlatformRepositoryContainer = InfraRepositoryContainer & {
  binding: IBindingRepository;
  integration: IIntegrationRepository;
  notify: INotifyRepository;
  subscription: ISubscriptionRepository;
  connection: IConnectionRepository;
};
