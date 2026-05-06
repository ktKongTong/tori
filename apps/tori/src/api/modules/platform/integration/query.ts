import { NotFoundError } from "@/api/domain/error";
import type { ServiceContext } from "@/api/domain/infra/service-context";

export async function resolveConnectionAccess(ctx: ServiceContext, connectionId: string) {
  const connection = await ctx.repositories.integration.findConnectionById(connectionId);
  if (!connection) throw new NotFoundError("connection not found");

  return {
    connection,
    requiresProxy: connection.accessMode !== "public-id",
    supportsPublicAccess: connection.accessMode !== "proxy-token",
    proxyInstanceId: connection.proxyInstanceId ?? null,
  };
}
