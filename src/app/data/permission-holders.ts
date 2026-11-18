/**
 * Who holds a permission.
 *
 * One place that answers "which roles grant this, and which users end up with
 * it", derived from the same sources every other surface reads:
 *
 *   ROLE_PERMISSION_MAP        → the permission ids a role grants
 *   USER_ROLE_IDS              → the roles a user is in
 *   USER_DIRECT_PERMISSIONS    → the per-user grants layered over their roles
 *
 * This exists because the "Roles & Users with This Permission" panel in the
 * permission detail window used to invent its answer: it picked 3 to 5 roles and
 * 8 to 14 users from a hash of the permission id. That made the panel actively
 * misleading rather than merely thin. A permission nothing granted still listed
 * five roles, the listed roles frequently did not hold the permission, and the
 * role detail page one click away disagreed. The Granted Via column was built on
 * the same helper, so it inherited the fiction.
 *
 * Derivation lives here rather than in the component so it can be tested against
 * the role bundles directly.
 */

import { roles, roleNameToOptionId, type RoleRow } from "./roles-data";
import { getRolePermissions } from "./role-permissions-map";
import { users, type UserRow } from "./users-data";
import { USER_ROLE_IDS } from "./uac-derived";
import { getDirectPermissionIds } from "./user-direct-permissions-data";

/** True when the role's own bundle contains the permission. */
export function roleHoldsPermission(role: RoleRow, permissionId: string): boolean {
  return getRolePermissions(roleNameToOptionId(role.roleName)).includes(permissionId);
}

/** Every role whose bundle grants the permission, predefined and custom alike. */
export function getRolesWithPermission(permissionId: string): RoleRow[] {
  return roles.filter((r) => roleHoldsPermission(r, permissionId));
}

/** Names of the roles a specific user is in that grant the permission. Empty
 *  when the user only holds it directly, or does not hold it at all. */
export function getGrantingRoleNames(userId: number, permissionId: string): string[] {
  return (USER_ROLE_IDS[userId] ?? [])
    .map((id) => roles.find((r) => r.id === id))
    .filter((r): r is RoleRow => !!r && roleHoldsPermission(r, permissionId))
    .map((r) => r.roleName);
}

/** Every user who ends up with the permission, whether through a role or a
 *  direct grant. */
export function getUsersWithPermission(permissionId: string): UserRow[] {
  return users.filter(
    (u) =>
      getGrantingRoleNames(u.id, permissionId).length > 0 ||
      getDirectPermissionIds(u.id).includes(permissionId),
  );
}

/** How a user holds the permission: through their roles, directly, or both.
 *  `roles` lists the granting role names, empty for a direct-only grant. */
export function getPermissionSourceForUser(
  userId: number,
  permissionId: string,
): { type: "role" | "direct" | "both"; roles: string[] } {
  const roleNames = getGrantingRoleNames(userId, permissionId);
  const direct = getDirectPermissionIds(userId).includes(permissionId);
  if (roleNames.length > 0 && direct) return { type: "both", roles: roleNames };
  if (roleNames.length > 0) return { type: "role", roles: roleNames };
  return { type: "direct", roles: [] };
}
