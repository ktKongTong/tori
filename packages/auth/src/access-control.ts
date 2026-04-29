import { createAccessControl, type Subset } from "better-auth/plugins/access";

export const authStatement = {
  user: ["create", "list", "set-role", "ban", "impersonate", "delete", "set-password"],
  session: ["list", "revoke", "delete"],
  role: ["user", "admin"],
} as const;

export type PermissionKey = keyof typeof authStatement;
export type Permission<T extends PermissionKey> = Subset<T, typeof authStatement>;
export type Permissions = Subset<PermissionKey, typeof authStatement>;

export const authAccessControl = createAccessControl(authStatement);

export const userRole = authAccessControl.newRole({
  user: ["list", "delete", "set-password"],
  role: ["user"],
});

export const adminRole = authAccessControl.newRole(authStatement);

export function hasRole(userRoleValue: string | null | undefined, role: string): boolean {
  return userRoleValue?.split(",").includes(role) ?? false;
}
