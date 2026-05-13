import type { InfraRepositoryContainer } from "@/api/domain/infra/repository.ts";
import type { IBindingRepository } from "@/api/modules/platform/binding/repository";
import type { IConnectionRepository } from "@/api/modules/platform/integration/connection/repository/repository";
import type { IIntegrationRepository } from "@/api/modules/platform/integration/proxy-instance/repository/repository";
import type { INotifyRepository } from "@/api/modules/platform/notification/notification/repository";
import type { ISubscriptionRepository } from "@/api/modules/platform/notification/subscription/repository/repository";

export type PlatformRepositoryContainer = InfraRepositoryContainer & {
  binding: IBindingRepository;
  integration: IIntegrationRepository;
  connection: IConnectionRepository;
  notify: INotifyRepository;
  subscription: ISubscriptionRepository;
};
