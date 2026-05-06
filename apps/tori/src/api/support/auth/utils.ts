import { UnauthorizedError } from "@/api/domain/error";
import type { Permissions, User } from "@/api/domain/infra/auth";
import type { ENV } from "@/api/domain/infra/env";
import type { ServiceContext } from "@/api/domain/infra/service-context";
import { parseBoolean } from "@repo/utils/boolean";

type ServiceHandler<Args extends unknown[] = unknown[], R = unknown> = (
  ctx: ServiceContext,
  ...args: Args
) => Promise<R> | R;

type PermissionCheckInput = {
  body: {
    userId: string;
    role?: "admin" | "user";
    permissions: Record<string, unknown>;
  };
};

type PermissionApi = {
  userHasPermission(input: PermissionCheckInput): Promise<unknown>;
};

export type PermissionOption = {
  role?: "admin" | "user";
  permissions?: Partial<Omit<Permissions, "role">>;
};

export type AuthorizationOption = PermissionOption & {
  allowSystem?: boolean;
};

export type AuthenticatedServiceContext = ServiceContext & {
  user: User;
};

const authzEnabledSymbol = Symbol.for("monoark.authz.enabled");

export const setAuthzEnabled = (enabled: boolean) => {
  // @ts-expect-error
  globalThis[authzEnabledSymbol] = enabled;
};

export const isAuthzEnabled = (env?: ENV) => {
  // @ts-expect-error
  const globalSwitch = globalThis[authzEnabledSymbol];
  if (typeof globalSwitch === "boolean") return globalSwitch;
  try {
    return parseBoolean(env?.AUTHZ_ENABLED, true);
  } catch {
    return true;
  }
};

const resolveContext = (self: unknown, ctx: ServiceContext) => {
  const instance = self as { serviceContext?: ServiceContext } | undefined;
  return instance?.serviceContext ?? ctx;
};

export function requireAuth(
  context?: ServiceContext,
): asserts context is AuthenticatedServiceContext {
  if (!isAuthzEnabled(context?.env)) return;
  if (!context?.user) throw new UnauthorizedError();
}

function getAuthenticatedUser(context?: ServiceContext) {
  const authenticatedContext = context;
  requireAuth(authenticatedContext);
  return authenticatedContext.user;
}

function isPermissionCheckResult(value: unknown): value is { success: boolean } {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { success?: unknown }).success === "boolean"
  );
}

export const getAuthenticatedUserId = (context?: ServiceContext) => {
  return getAuthenticatedUser(context).id;
};

export const requirePermission = async (
  context: ServiceContext,
  { role = "user", permissions = {}, allowSystem = false }: AuthorizationOption = {},
) => {
  if (!isAuthzEnabled(context.env)) return;
  if (allowSystem && !context.user && context.causationType !== "req") return;
  if (!context.user || !context.auth) throw new UnauthorizedError();
  const body: { userId: string; role?: "admin" | "user"; permissions: Record<string, unknown> } = {
    userId: context.user.id,
    permissions: { role: [role], ...permissions },
  };
  const userRole = context.user.role;
  if (userRole === "admin" || userRole === "user") {
    body.role = userRole as "admin" | "user";
  }
  const authApi = context.auth.api as typeof context.auth.api & PermissionApi;
  const res = await authApi.userHasPermission({
    body: {
      ...body,
    },
  });
  if (!isPermissionCheckResult(res) || !res.success)
    throw new UnauthorizedError("User permission denied");
};

export const withAuth = <Args extends unknown[], R>(
  handler: ServiceHandler<Args, R>,
): ServiceHandler<Args, R> => {
  return async function (this: unknown, ctx: ServiceContext, ...args: Args) {
    const context = resolveContext(this, ctx);
    requireAuth(context);
    return handler.apply(this, [ctx, ...args]);
  };
};

export const withPermission = (option: AuthorizationOption = {}) => {
  return <Args extends unknown[], R>(handler: ServiceHandler<Args, R>): ServiceHandler<Args, R> => {
    return async function (this: unknown, ctx: ServiceContext, ...args: Args) {
      const context = resolveContext(this, ctx);
      requireAuth(context);
      await requirePermission(context, option);
      return handler.apply(this, [ctx, ...args]);
    };
  };
};

export const withAdminPermission = withPermission({ role: "admin" });
