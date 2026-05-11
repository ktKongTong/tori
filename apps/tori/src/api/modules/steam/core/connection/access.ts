import { NotFoundError, ParameterError } from "@/api/domain/error";
import type { ServiceContext } from "@/api/domain/infra/service-context";

export async function resolveOwnedConnection(
  ctx: ServiceContext,
  connectionId: string,
  ownerUserId?: string,
) {
  const connection = await ctx.repositories.connection.findActiveConnectionById(connectionId);
  if (!connection || connection.status !== "active") {
    throw new NotFoundError("Connection not found");
  }
  if (ownerUserId && connection.ownerUserId !== ownerUserId) {
    throw new NotFoundError("Connection not found");
  }
  return connection;
}

export async function resolveSteamFamilyAccess(
  ctx: ServiceContext,
  connectionId: string,
  ownerUserId?: string,
) {
  const connection = await resolveOwnedConnection(ctx, connectionId, ownerUserId);
  if (connection.provider !== "steam") {
    throw new ParameterError("Only Steam family operations are supported");
  }
  if (!connection.proxyInstanceId) {
    throw new ParameterError("Steam family operations require a proxy-backed Steam connection");
  }

  const proxyInstance = await ctx.repositories.connection.findProxyInstanceById(
    connection.proxyInstanceId,
  );
  if (!proxyInstance || proxyInstance.status !== "active") {
    throw new ParameterError("Connection requires an active proxy instance");
  }

  const credential = await ctx.repositories.connection.findActiveConnectionCredential({
    connectionId: connection.id,
    kind: "token-proxy-api-key",
  });
  if (!credential) {
    throw new ParameterError("Connection requires an active token-proxy credential");
  }

  return {
    connection,
    proxyInstance,
    proxyBaseUrl: proxyInstance.baseUrl.replace(/\/+$/, ""),
    proxyHeaders: {
      accept: "application/json",
      "X-API-KEY": credential.credentialRef,
    },
  };
}
