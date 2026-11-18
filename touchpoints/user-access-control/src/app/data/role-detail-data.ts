import type { RoleRow, LicenseType } from "./roles-data";
import { roles, roleNameToOptionId } from "./roles-data";
import { users } from "./users-data";
import type { UserRow } from "./users-data";
import {
  ROLE_PERMISSION_MAP,
  notifyRolePermissionsChange,
  setRolePermissions,
} from "./role-permissions-map";
import { PERMISSION_MODULES } from "./permissions-data";
import { isNewTenant, sampleOnly } from "./tenant";
import {
  addUserToRole as addUserToRoleCanonical,
  getUsersForRole,
  notifyUacChange,
  removeUserFromRole as removeUserFromRoleCanonical,
  subscribeUacData,
  syncLegacyFields,
} from "./uac-derived";

/* ─── Pub/sub. Fans out canonical UAC changes too so screens re-render
 *  when membership/ownership/task data mutates. ─── */
const roleChangeListeners = new Set<() => void>();
export function subscribeRoleChanges(listener: () => void): () => void {
  roleChangeListeners.add(listener);
  const unsubUac = subscribeUacData(listener);
  return () => {
    roleChangeListeners.delete(listener);
    unsubUac();
  };
}
function notifyRoleChange() {
  roleChangeListeners.forEach((l) => l());
}

/* ─── Types ─── */
export interface RolePermissionGroup {
  module: string;
  permissions: { key: string; label: string; granted: boolean }[];
}

export interface RoleActivityEntry {
  id: string;
  type:
    | "role_created"
    | "role_duplicated"
    | "user_assigned"
    | "user_removed"
    | "permission_change"
    | "config_change"
    | "status_change";
  title: string;
  description: string;
  timestamp: string;
  actor?: string;
}

export interface RoleDetail extends RoleRow {
  /* ── Metadata ── */
  createdBy: string;
  createdOn: string;
  lastModifiedBy: string;
  lastModifiedOn: string;

  /* ── Assigned users ── */
  assignedUserIds: number[];

  /* ── Permissions (derived from ROLE_PERMISSION_MAP) ── */
  permissionGroups: RolePermissionGroup[];

  /* ── Activity ── */
  activityLog: RoleActivityEntry[];
}

/**
 * Build the role's permission groups from the canonical ROLE_PERMISSION_MAP and
 * the real permission catalog. Only modules the role touches are emitted; each
 * touched module lists ALL its permissions with the correct granted flag and
 * the module access gate first (permissions[0]). This single-sources the role
 * detail Overview summary, the Permissions tab toggles, and role insights so
 * they can never drift from the permission bundle.
 */
export function buildPermissionGroupsForRole(roleName: string): RolePermissionGroup[] {
  const optionId = roleNameToOptionId(roleName);
  const granted = new Set(ROLE_PERMISSION_MAP[optionId] ?? []);
  const groups: RolePermissionGroup[] = [];
  for (const mod of PERMISSION_MODULES) {
    if (!mod.permissions.some((p) => granted.has(p.id))) continue;
    groups.push({
      module: mod.name,
      permissions: mod.permissions.map((p) => ({
        key: p.id,
        label: p.name,
        granted: granted.has(p.id),
      })),
    });
  }
  return groups;
}

/* ─── Mock extended metadata per role (Pioneer v2.0 id space) ───
 * Cosmetic curation (dates, activity) for a few headline roles.
 * `permissionGroups` are always derived at read time, never stored here.
 * Roles without an entry fall back to generateDefaultDetail. */
const MOCK_EXTENSIONS: Record<number, Partial<RoleDetail>> = {
  1: {
    createdBy: "System",
    createdOn: "01/01/2024",
    lastModifiedBy: "System",
    lastModifiedOn: "01/01/2024",
    activityLog: [
      { id: "r1-a1", type: "user_assigned", title: "User Assigned", description: "Eli Rosenbloom was assigned to this role", timestamp: "04/15/2026 - 09:10", actor: "System" },
    ],
  },
  2: {
    createdBy: "System",
    createdOn: "01/01/2024",
    lastModifiedBy: "Andrea Davis",
    lastModifiedOn: "03/15/2025",
    activityLog: [
      { id: "r2-a1", type: "user_assigned", title: "User Assigned", description: "Taylor Dimas was assigned to this role", timestamp: "03/15/2025 - 14:30", actor: "Andrea Davis" },
      { id: "r2-a2", type: "role_duplicated", title: "Role Duplicated", description: "Duplicated to create a custom role", timestamp: "02/20/2025 - 10:15", actor: "Abdullah Malik" },
    ],
  },
  10: {
    createdBy: "System",
    createdOn: "01/01/2024",
    lastModifiedBy: "Andrea Davis",
    lastModifiedOn: "05/22/2025",
    activityLog: [
      { id: "r10-a1", type: "user_assigned", title: "User Assigned", description: "Heather Rowland was assigned to this role", timestamp: "05/22/2025 - 11:20", actor: "Andrea Davis" },
    ],
  },
  16: {
    createdBy: "System",
    createdOn: "01/01/2024",
    lastModifiedBy: "Taylor Dimas",
    lastModifiedOn: "09/01/2025",
    activityLog: [
      { id: "r16-a1", type: "user_assigned", title: "Users Bulk Assigned", description: "New sales reps onboarded from Q3 hiring wave", timestamp: "09/01/2025 - 09:00", actor: "Taylor Dimas" },
      { id: "r16-a2", type: "role_duplicated", title: "Role Duplicated", description: "Duplicated to create the Sales Operations Analyst custom role", timestamp: "07/18/2025 - 16:40", actor: "Abdullah Malik" },
    ],
  },
  17: {
    createdBy: "System",
    createdOn: "01/01/2024",
    lastModifiedBy: "Andrea Davis",
    lastModifiedOn: "07/12/2025",
    activityLog: [
      { id: "r17-a1", type: "user_assigned", title: "Users Assigned", description: "Sales managers assigned during the Q3 territory realignment", timestamp: "07/12/2025 - 09:30", actor: "Andrea Davis" },
    ],
  },
  24: {
    createdBy: "System",
    createdOn: "01/01/2024",
    lastModifiedBy: "Taylor Dimas",
    lastModifiedOn: "06/20/2025",
    activityLog: [
      { id: "r24-a1", type: "user_assigned", title: "Users Bulk Assigned", description: "Field operatives onboarded from new regional office", timestamp: "06/20/2025 - 14:00", actor: "Taylor Dimas" },
    ],
  },
};

/* ─── Build complete detail from a RoleRow ─── */
function generateDefaultDetail(role: RoleRow): RoleDetail {
  return {
    ...role,
    createdBy: role.createdBy ?? "System",
    createdOn: "01/01/2024",
    lastModifiedBy: role.lastEditedBy ?? "System",
    lastModifiedOn: "01/01/2024",
    assignedUserIds: [],
    permissionGroups: [],
    /* Predefined (system) roles are shipped and maintained by the system and
     * can't be edited by the tenant, so their activity never shows creation or
     * permission edits, only tenant-side events like assignments. Custom roles
     * keep the real "Role created" entry. A company from onboarding has no
     * assignment history on them yet, so their log starts empty there. */
    activityLog: role.isSystem
      ? sampleOnly<RoleActivityEntry>([
          {
            id: `${role.id}-assigned`,
            type: "user_assigned",
            title: "Users Assigned",
            description: "Users were assigned to this role",
            timestamp: "01/10/2025 - 09:00",
          },
        ])
      : [
          {
            id: `${role.id}-default`,
            type: "role_created",
            title: "Role Created",
            description: `${role.roleName} role was created`,
            timestamp: "01/01/2024 - 00:00",
            actor: role.createdBy ?? "System",
          },
        ],
  };
}

export function getRoleDetail(roleId: number): RoleDetail | null {
  const role = roles.find((r) => r.id === roleId);
  if (!role) return null;

  const base = generateDefaultDetail(role);
  /* The curated history (who assigned whom, who last edited) is the sample
   * company's; a company from onboarding has none of it. */
  const ext = isNewTenant() ? undefined : MOCK_EXTENSIONS[roleId];
  // Always derive assignedUserIds from the canonical store and permissionGroups
  // from the permission map so role detail, role listing usersCount, the user
  // listing role-filter, and the permission catalog all agree.
  const canonicalIds = getUsersForRole(roleId).map((u) => u.id);
  const permissionGroups = buildPermissionGroupsForRole(role.roleName);
  const merged = ext ? { ...base, ...ext } : base;
  return { ...merged, assignedUserIds: canonicalIds, permissionGroups } as RoleDetail;
}

/** Resolve assigned user IDs to actual UserRow objects */
export function getAssignedUsers(userIds: number[]): UserRow[] {
  return userIds
    .map((id) => users.find((u) => u.id === id))
    .filter(Boolean) as UserRow[];
}

/** Add users to a role's membership. Mutates the canonical USER_ROLE_IDS map
 *  in uac-derived; legacy fields (usersCount + assignedRoles) are kept in
 *  sync automatically. Returns the IDs that were actually added. */
export function addUsersToRole(roleId: number, userIds: number[]): number[] {
  const role = roles.find((r) => r.id === roleId);
  if (!role) return [];
  const before = new Set(getUsersForRole(roleId).map((u) => u.id));
  const additions = userIds.filter((id) => !before.has(id));
  additions.forEach((uid) => addUserToRoleCanonical(uid, roleId));
  return additions;
}

/** Clear all assigned users from a role (used by unarchive flow). */
export function clearRoleAssignments(roleId: number) {
  const previousIds = getUsersForRole(roleId).map((u) => u.id);
  previousIds.forEach((uid) => removeUserFromRoleCanonical(uid, roleId));
  // Mark for downstream subscribers
  notifyUacChange();
  // Belt-and-suspenders: re-sync legacy fields (idempotent).
  syncLegacyFields();
}

/** Apply edited role details (name/description) from the unarchive flow.
 *
 *  A rename moves the role's permission bundle with it. ROLE_PERMISSION_MAP is
 *  keyed by `roleNameToOptionId(roleName)`, and permissionGroups are derived
 *  from that key at read time, so renaming without migrating the entry would
 *  silently empty the role's permissions. The old key is left empty rather than
 *  kept, so a future role that reuses the freed name does not inherit a ghost
 *  bundle. */
export function applyRoleEdits(
  roleId: number,
  patch: { roleName?: string; description?: string },
) {
  const role = roles.find((r) => r.id === roleId);
  if (!role) return;
  if (patch.roleName !== undefined && patch.roleName.trim()) {
    const nextName = patch.roleName.trim();
    const fromKey = roleNameToOptionId(role.roleName);
    const toKey = roleNameToOptionId(nextName);
    if (fromKey !== toKey) {
      const granted = ROLE_PERMISSION_MAP[fromKey] ?? [];
      setRolePermissions(toKey, granted, nextName);
      setRolePermissions(fromKey, [], role.roleName);
      notifyRolePermissionsChange();
    }
    role.roleName = nextName;
  }
  if (patch.description !== undefined) {
    role.description = patch.description.trim();
  }
  notifyRoleChange();
}

/** Update the role's required license tier after a permissions change.
 *  Mutates the underlying mock store so the detail header chip, role
 *  listing table, and any other consumer of `licenseRequired` reflect
 *  the new tier. Returns true if the tier actually changed. */
export function applyRoleLicenseTier(
  roleId: number,
  tier: LicenseType,
): boolean {
  const role = roles.find((r) => r.id === roleId);
  if (!role) return false;
  if (role.licenseRequired === tier) return false;
  role.licenseRequired = tier;
  notifyRoleChange();
  return true;
}
