import type { DBType, DefaultDBType } from "@/api/domain/infra/db.ts";
import type { InfraRepositoryContainer } from "@/api/domain/infra/repository.ts";
import { ServiceContext, type ServiceContextOption } from "@/api/domain/infra/service-context.ts";
import type { PlatformRepositoryContainer } from "@/api/domain/platform/repository/container.ts";
import { createRepositoryContainer } from "@/api/repository/index.ts";

export type CreateServiceContextInput<
  TRepositories extends InfraRepositoryContainer = PlatformRepositoryContainer,
  T extends DBType = DefaultDBType,
> = Omit<ServiceContextOption<TRepositories, T>, "repositories"> & {
  repositories?: ServiceContextOption<TRepositories, T>["repositories"];
};

export function createServiceContext<
  TRepositories extends InfraRepositoryContainer = PlatformRepositoryContainer,
  T extends DBType = DefaultDBType,
>(input: CreateServiceContextInput<TRepositories, T>) {
  const dbType = (input.dbType ?? ("pg" as T)) as T;

  return new ServiceContext<TRepositories, T>({
    ...input,
    dbType,
    repositories:
      input.repositories ??
      (createRepositoryContainer(input.tx, dbType) as unknown as TRepositories),
  });
}
