import { NotFoundError, ParameterError, StatusConflictError } from "@/api/domain/error/index.ts";
import type { ServiceContext } from "@/api/domain/infra/service-context.ts";
import { uniqueId } from "@repo/utils/id";
import type { CreateConnectionInput } from "./type.ts";

export async function createConnection(ctx: ServiceContext, input: CreateConnectionInput) {
  const userId = ctx.userId;
  if (!userId) throw new NotFoundError("user not found");

  const existing = await ctx.repositories.connection.findConnectionByOwnerAndProviderAccount({
    ownerUserId: userId,
    provider: input.provider,
    providerAccountId: input.providerAccountId,
  });

  if (existing) throw new StatusConflictError("connection already exist");

  if (input.accessMode !== "public-id" && !input.proxyInstanceId) {
    throw new ParameterError("proxy-backed connection requires proxyInstanceId");
  }

  const row = await ctx.repositories.connection.createConnection({
    id: uniqueId(),
    ownerUserId: userId,
    ...input,
  });

  return row;
}

export async function resolveConnectionAccess(ctx: ServiceContext, connectionId: string) {
  const connection = await ctx.repositories.connection.findConnectionById(connectionId);
  if (!connection) throw new NotFoundError("connection not found");

  return {
    connection,
    requiresProxy: connection.accessMode !== "public-id",
    supportsPublicAccess: connection.accessMode !== "proxy-token",
    proxyInstanceId: connection.proxyInstanceId ?? null,
  };
}
