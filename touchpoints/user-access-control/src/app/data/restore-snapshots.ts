/**
 * Previous-configuration restore data for the Unarchive / Reactivate flows.
 *
 * Only the Reactivate flow pre-fills access config. Deactivation preserves a
 * user's access, so when they are reactivated we pre-select the license, roles,
 * and direct permissions they still hold and let the admin review-and-confirm.
 *
 *   - Reactivate (Inactive user): deactivation preserves history, so the
 *     previous config is read live, the user's current license (kept vs
 *     removed during deactivation) and their still-assigned canonical roles.
 *   - Unarchive (Archived user): archiving clears the user's access entirely,
 *     so there is nothing to restore, the flow starts blank and roles are
 *     reassigned from scratch. (Identity fields like name/email still populate
 *     in the flow; those come from the user record, not this restore config.)
 *
 * Direct (non-role) permissions come from the user's curated direct grants
 * (user-direct-permissions-data), filtered to those not already granted by the
 * restored roles, so they represent genuine direct grants.
 */
import { roles, roleNameToOptionId } from "./roles-data";
import { getRoleIdsForUser } from "./uac-derived";
import { users } from "./users-data";
import { getPermissionsForRoles } from "./role-permissions-map";
import { getDirectPermissionIds } from "./user-direct-permissions-data";

export type RestoreLicense = "Full Access" | "Field User" | "No License";
export type RestoreMode = "unarchive" | "reactivate";

export interface RestoreConfig {
  /** License tier to pre-select, or null = pre-select nothing. */
  license: RestoreLicense | null;
  /** True when a previous license existed but its tier is no longer available. */
  licenseUnavailable: boolean;
  /** Role option ids to pre-select (only roles that still exist). */
  roleOptionIds: string[];
  /** Primary role option id (first restored role), or "". */
  primaryRoleId: string;
  /** Direct (non-role) permission ids to pre-toggle on. */
  directPermissionIds: string[];
  /** True when at least one role was pre-selected (drives the helper line). */
  hasPreselection: boolean;
}

/** Existing (non-archived) role option ids, mirrors ASSIGN_STEP_ROLES so a role
 *  deleted/archived since the user left does not appear as pre-selected. */
function existingRoleOptionIds(): Set<string> {
  return new Set(
    roles
      .filter((r) => r.status !== "Archived")
      .map((r) => roleNameToOptionId(r.roleName)),
  );
}

/** The user's curated direct grants, minus anything the restored roles already
 *  cover (so they read as genuine direct-only grants). */
function deriveDirectPermissionIds(userId: number, roleOptionIds: string[]): string[] {
  const inherited = getPermissionsForRoles(roleOptionIds);
  return getDirectPermissionIds(userId).filter((id) => !inherited.has(id));
}

const EMPTY: RestoreConfig = {
  license: null,
  licenseUnavailable: false,
  roleOptionIds: [],
  primaryRoleId: "",
  directPermissionIds: [],
  hasPreselection: false,
};

/** Compute the previous-configuration restore for a user being brought back. */
export function getRestoreConfig(userId: number, mode: RestoreMode): RestoreConfig {
  if (mode === "reactivate") {
    // Live read: deactivation preserved the user's roles and (possibly) license.
    const current = users.find((u) => u.id === userId)?.license ?? "No License";
    // License kept during deactivation → pre-select it. Removed → pre-select
    // nothing (admin chooses).
    const license = current === "No License" ? null : (current as RestoreLicense);
    const existing = existingRoleOptionIds();
    const roleOptionIds = getRoleIdsForUser(userId)
      .map((rid) => roles.find((r) => r.id === rid))
      .filter((r): r is NonNullable<typeof r> => Boolean(r) && r!.status !== "Archived")
      .map((r) => roleNameToOptionId(r.roleName))
      .filter((id) => existing.has(id));
    const directPermissionIds = deriveDirectPermissionIds(userId, roleOptionIds);
    return {
      license,
      licenseUnavailable: false,
      roleOptionIds,
      primaryRoleId: roleOptionIds[0] ?? "",
      directPermissionIds,
      hasPreselection: roleOptionIds.length > 0,
    };
  }

  // Unarchive: archiving cleared the user's access, so there is nothing to
  // pre-fill. The flow starts blank and roles are reassigned from scratch.
  return EMPTY;
}
