import { createMiddleware } from "hono/factory";
import type { Auth, Session, User } from "@/api/domain/infra";
import { checkUserHasRole, getAuth } from "@/api/support/auth";
import {
  type AuthorizationOption,
  requireAuth as ensureAuth,
  requirePermission as ensurePermission,
} from "@/api/support/auth/utils";
import { parseBoolean } from "@repo/utils/boolean";

declare module "hono" {
  interface ContextVariableMap {
    auth: Auth;
    user: User | null;
    session: Session | null;
    role?: string;
  }
}

export const betterAuthMiddleware = createMiddleware(async (c, next) => {
  const data = c.get("appEnv");
  const db = c.get("db");
  const auth = getAuth({ db, provider: "pg" }, data);
  c.set("auth", auth);
  await next();
});

export type PermissionMiddlewareOption = AuthorizationOption;
export const requireAuth = () =>
  createMiddleware(async (c, next) => {
    ensureAuth(c.get("serviceContext"));
    await next();
  });
export const requirePermission = (option: PermissionMiddlewareOption = {}) =>
  createMiddleware(async (c, next) => {
    const ctx = c.get("serviceContext");
    ensureAuth(ctx);
    await ensurePermission(ctx, option);
    await next();
  });
export const requireAdmin = () => requirePermission({ role: "admin" });

export const userMiddleware = createMiddleware(async (c, next) => {
  const auth = c.get("auth");
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) {
    c.set("user", null);
    c.set("session", null);
    await next();
    return;
  }
  // anonymous | user | admin
  const useAdminRole = parseBoolean(c.req.query("admin"));
  const user = session.user as User;
  if (useAdminRole && checkUserHasRole(user.role ?? "", "admin")) {
    c.set("role", "admin");
  } else {
    c.set("role", "user");
  }

  c.set("user", user);
  c.set("session", session.session);
  await next();
});
