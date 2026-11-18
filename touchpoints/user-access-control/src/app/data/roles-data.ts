import {
  PREDEFINED_ROLES,
  PREDEFINED_ROLE_NAMES,
  isPredefinedRole,
} from "./predefined-roles";

/* ─── Types ─── */
/* "Draft" is a system-managed lifecycle state for a role that exists but has
 *  no permissions yet (e.g. freshly imported). A Draft role grants nothing and
 *  can't be used; it graduates to "Active" automatically once permissions are
 *  assigned. It is never set manually from the status dropdown. */
export type RoleStatus = "Active" | "Inactive" | "Archived" | "Draft";
export type LicenseType = "Field User" | "Full Access";

export interface RoleRow {
  id: number;
  roleName: string;
  description: string;
  usersCount: number;
  licenseRequired: LicenseType;
  status: RoleStatus;
  /** True for predefined system roles that cannot be edited or deleted */
  isSystem?: boolean;
  /** True only for the Account Owner, whose holders cannot be archived,
   *  deactivated, removed, or locked out. Read directly by the guards. */
  isProtected?: boolean;
  /** Who created this role. Used by Me Mode. */
  createdBy?: string;
  /** Who last modified configuration / permissions / users for this role. */
  lastEditedBy?: string;
  /** Designated owner of the role (responsible admin / point of contact). */
  roleOwner?: string;
  /** Names of users currently assigned to this role. Used by Me Mode's
   *  "assigned to me" branch, kept here as names to stay consistent with
   *  the rest of the mock data (which references people by name). */
  assignedMembers?: string[];
}

/** Names of all predefined system roles (the 25 Pioneer v2.2 roles). */
export const SYSTEM_ROLE_NAMES = PREDEFINED_ROLE_NAMES as readonly string[];

/** Check whether a role name belongs to a predefined system role */
export function isSystemRole(roleName: string): boolean {
  return isPredefinedRole(roleName);
}

/** Sort comparator: custom roles first (alphabetical), then system roles (alphabetical) */
export function sortRolesCustomFirst(a: RoleRow, b: RoleRow): number {
  const aSystem = a.isSystem ? 1 : 0;
  const bSystem = b.isSystem ? 1 : 0;
  if (aSystem !== bSystem) return aSystem - bSystem;
  return a.roleName.localeCompare(b.roleName);
}

/** Group key function for DataTable row grouping */
export function roleGroupFn(row: RoleRow): string {
  return row.isSystem ? "system" : "custom";
}

/** Group labels for role table section headers */
export const ROLE_GROUP_LABELS: Record<string, string> = {
  custom: "Custom Roles",
  system: "Predefined Roles",
};

/* ─── Mock Data ─────────────────────────────────────────────────────────
 * The 25 predefined roles (ids 1..25) are derived from the canonical
 * `PREDEFINED_ROLES` dataset so their names/tiers/descriptions
 * never drift from the source of truth. `usersCount` is seeded from the
 * spec's assignedUserCount and then reconciled by `uac-derived.syncLegacyFields`.
 *
 * A small set of custom roles (ids 26+) is retained to preserve the demo
 * edge-case fixtures (sole-owner empty state, zero-owner, zero-users) and to
 * keep the "Custom Roles" group populated.
 * ──────────────────────────────────────────────────────────────────────── */
const PREDEFINED_ROLE_ROWS: RoleRow[] = PREDEFINED_ROLES.map((r) => ({
  id: r.id,
  roleName: r.name,
  description: r.description,
  usersCount: r.assignedUserCount,
  licenseRequired: r.licenseTier,
  status: "Active" as RoleStatus,
  isSystem: true,
  isProtected: r.protected,
}));

const CUSTOM_ROLE_ROWS: RoleRow[] = [
  {
    id: 26,
    roleName: "Compliance Auditor",
    description:
      "Read-only visibility across inventory, receiving, and sales, plus the access audit trail. Built by copying a read-only auditor and adding audit-log access.",
    usersCount: 3,
    licenseRequired: "Full Access",
    status: "Active",
    createdBy: "Abdullah Malik",
    roleOwner: "Eli Rosenbloom",
  },
  {
    id: 27,
    roleName: "Sales Operations Analyst",
    description:
      "Reads and exports quotes and sales orders with cost visibility for reporting. Retired after reporting moved to the BI tool.",
    usersCount: 2,
    licenseRequired: "Full Access",
    status: "Archived",
  },
  {
    id: 28,
    roleName: "Senior Buyer",
    description:
      "A Buyer extended with cancel, bulk import, and partner setup, a step below Procurement Manager. Copied from the Buyer predefined role.",
    usersCount: 4,
    licenseRequired: "Full Access",
    status: "Active",
    createdBy: "Abdullah Malik",
  },
  {
    id: 29,
    roleName: "Warehouse Operator",
    description:
      "Floor execution seat for cycle counts, inventory movements, receiving, and picking. A Field User role by design; extending it with an admin action such as inventory adjustments raises it to Full Access.",
    usersCount: 3,
    licenseRequired: "Field User",
    status: "Active",
    createdBy: "Abdullah Malik",
  },
];

export const roles: RoleRow[] = [...PREDEFINED_ROLE_ROWS, ...CUSTOM_ROLE_ROWS];

/** Protected roles (Account Owner) sit outside Manage Roles / Assign Roles and
 *  are never selectable in any role scope picker. */
export function isProtectedRoleId(roleId: number): boolean {
  return !!roles.find((r) => r.id === roleId)?.isProtected;
}

/** Every role eligible for a role scope picker (excludes protected roles). */
export const scopeEligibleRoles: RoleRow[] = roles.filter((r) => !r.isProtected);


/**
 * Slugify a role display name into the canonical snake_case string ID used by
 * the Create User wizard, Quick Invite modal, and `role-permissions-map`.
 *
 * Acts as the bridge between the numeric `RoleRow.id` (database-style) used
 * by listing/detail screens and the stable string ID used by selection flows.
 * Keeping this in one place means adding/renaming a role in `roles` flows to
 * every consumer without hand-editing a second list.
 */
export function roleNameToOptionId(roleName: string): string {
  return roleName
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

/**
 * Register a newly created role into the in-memory roles list and return its id.
 * Used by the Create Role wizard so that navigating to the role detail page
 * shows the newly created role rather than an existing one.
 */
export function registerNewRole(input: {
  roleName: string;
  description?: string;
  licenseRequired?: LicenseType;
  usersCount?: number;
}): number {
  const nextId = roles.reduce((max, r) => Math.max(max, r.id), 0) + 1;
  roles.unshift({
    id: nextId,
    roleName: input.roleName.trim() || "Untitled Role",
    description: input.description?.trim() || "",
    usersCount: input.usersCount ?? 0,
    licenseRequired: input.licenseRequired ?? "Full Access",
    // A new role starts as Draft (an empty shell). Assigning permissions in the
    // Create Role flow graduates it to Active via applyRolePermissions; created
    // with none, it stays Draft and surfaces the same nudge as imported drafts.
    status: "Draft",
  });
  return nextId;
}
