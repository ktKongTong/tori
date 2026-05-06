import type { User as BaseUser } from "@repo/auth/server";

export {
  adminRole,
  authAccessControl,
  authStatement,
  hasRole,
  userRole,
  type Permission,
  type PermissionKey,
  type Permissions,
} from "@repo/auth/access-control";
export { baseAuthConfig as baseConfig, type Session } from "@repo/auth/server";
export type { Auth, User as BaseUser } from "@repo/auth/server";

export type User = BaseUser & {
  role?: "admin" | "user" | (string & {}) | null;
};
