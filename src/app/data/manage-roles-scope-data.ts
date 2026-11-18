/* ─────────────────────────────────────────────────────────────
 * Manage Roles: per-user scope store (V2 entry point)
 *
 * The "Manage Roles" permission (id: ur-manage-roles) lets a user manage
 * role membership for a configurable set of roles. Per-user configuration
 * lives here. Role Owner designation is delegated to role-owners-data
 * so V1 (Role Detail → Owners tab) and V2 (User Detail → Permissions →
 * Manage Roles → Configure) read/write the same underlying state.
 * ──────────────────────────────────────────────────────────────── */

import {
  assignRoleOwners,
  getRoleOwnerUserIds,
  getRolesOwnedByUser,
  removeRoleOwner,
  subscribeRoleOwners,
} from "./role-owners-data";

export type ManageRolesScopeMode = "all" | "selected";

export interface ManageRolesConfig {
  /** Scope mode: "all" lets the user manage every role in the system */
  mode: ManageRolesScopeMode;
  /** When mode === "selected", the explicit list of role IDs they manage */
  manageRoleIds: number[];
}

const EMPTY_CONFIG: ManageRolesConfig = { mode: "selected", manageRoleIds: [] };

/* ─── Seed: per-user manage scope (Role Owner state lives in role-owners-data) ───
 * Role ids reference the canonical Pioneer v2.0 listing in predefined-roles.ts
 * (1..25) plus the custom roles in roles-data.ts (26..28). */
const initialConfigs: Record<number, ManageRolesConfig> = {
  // Ahtisham Ahmad: manages Warehouse Supervisor (10), Inventory Controller (11), Material Handler (20).
  1: { mode: "selected", manageRoleIds: [10, 11, 20] },
  // Kassandra Gillespie: manages Inventory Controller (11) only (sole Owner of role 11)
  10: { mode: "selected", manageRoleIds: [11] },
  // Nophil Anwer: scope: ALL roles.
  5: { mode: "all", manageRoleIds: [] },
  // Irtaza Abid: selected: Sales Representative (16) + Sales Manager (17)
  6: { mode: "selected", manageRoleIds: [16, 17] },
  // Muhammad Ghufran: intentionally unconfigured (Not configured)
  // Derek Vega: ALL roles
  11: { mode: "all", manageRoleIds: [] },
  // Heather Rowland: Cycle Counter (21) + Dispatch Clerk (22) + Field Operative (24)
  14: { mode: "selected", manageRoleIds: [21, 22, 24] },
  // Brenda Robbins: Procurement Manager (8) + Finance Controller (19)
  17: { mode: "selected", manageRoleIds: [8, 19] },
  // Tomás Rivera: ALL roles
  23: { mode: "all", manageRoleIds: [] },
};

const configs: Map<number, ManageRolesConfig> = new Map(
  Object.entries(initialConfigs).map(([k, v]) => [parseInt(k, 10), { ...v, manageRoleIds: [...v.manageRoleIds] }]),
);

/* Nophil's ownership of Sales Representative (16) is now encoded
 * canonically in uac-derived.ts (USER_OWNED_IDS), no IIFE needed. */

/* ─── Pub/sub ─── */
const listeners = new Set<() => void>();
function notify() {
  listeners.forEach((cb) => cb());
}

export function subscribeManageRolesScope(cb: () => void) {
  listeners.add(cb);
  const unsubOwners = subscribeRoleOwners(cb);
  return () => {
    listeners.delete(cb);
    unsubOwners();
  };
}

/* ─── Read API ─── */
export function getManageRolesConfig(userId: number): ManageRolesConfig {
  return configs.get(userId) ?? EMPTY_CONFIG;
}

/** Effective set of roles a user manages (resolves "all" by accepting allRoleIds). */
export function getEffectiveManagedRoleIds(userId: number, allRoleIds: number[]): number[] {
  const cfg = getManageRolesConfig(userId);
  if (cfg.mode === "all") return [...allRoleIds];
  return [...cfg.manageRoleIds];
}

/** Is the user a Role Owner of the given role? (Reads from role-owners-data, V1 source of truth.) */
export function isUserRoleOwnerOf(userId: number, roleId: number): boolean {
  return getRoleOwnerUserIds(roleId).includes(userId);
}

/** All role IDs this user is a Role Owner of. */
export function getOwnedRoleIds(userId: number): number[] {
  return getRolesOwnedByUser(userId);
}

/* ─── Write API ─── */

export interface SaveConfigInput {
  mode: ManageRolesScopeMode;
  manageRoleIds: number[];
  /** Per-role Role Owner intent. Only entries with explicit booleans are honored. */
  ownerByRoleId: Record<number, boolean>;
}

/**
 * Persist the per-user manage scope and reconcile Role Owner state with
 * role-owners-data. This is the bridge between V2 (this UI) and V1
 * (Role Detail → Owners tab).
 */
export function saveManageRolesConfig(userId: number, input: SaveConfigInput) {
  // Effective Manage scope = explicit Manage selections ∪ Owner-ON roles.
  // Ownership grants Manage automatically per the model.
  const ownerOnRoleIds = Object.entries(input.ownerByRoleId)
    .filter(([, shouldOwn]) => shouldOwn)
    .map(([roleIdStr]) => parseInt(roleIdStr, 10));
  const unionedManageIds =
    input.mode === "selected"
      ? Array.from(new Set([...input.manageRoleIds, ...ownerOnRoleIds]))
      : [];

  configs.set(userId, {
    mode: input.mode,
    manageRoleIds: unionedManageIds,
  });

  // Reconcile Role Owner state for every role mentioned in the form
  Object.entries(input.ownerByRoleId).forEach(([roleIdStr, shouldOwn]) => {
    const roleId = parseInt(roleIdStr, 10);
    const isCurrentlyOwner = getRoleOwnerUserIds(roleId).includes(userId);
    if (shouldOwn && !isCurrentlyOwner) {
      assignRoleOwners(roleId, [userId]);
    } else if (!shouldOwn && isCurrentlyOwner) {
      removeRoleOwner(roleId, userId);
    }
  });

  notify();
}

/**
 * Remove a single role from a user's manage scope without opening the modal.
 * Strips Manage selection AND Role Owner status for that role.
 * No-op when the user is in "all" mode (chips aren't surfaced there).
 */
export function removeManagedRoleForUser(userId: number, roleId: number) {
  const cfg = configs.get(userId);
  if (cfg && cfg.mode === "selected") {
    const next = cfg.manageRoleIds.filter((id) => id !== roleId);
    if (next.length !== cfg.manageRoleIds.length) {
      configs.set(userId, { ...cfg, manageRoleIds: next });
    }
  }
  if (getRoleOwnerUserIds(roleId).includes(userId)) {
    removeRoleOwner(roleId, userId);
  }
  notify();
}

/** Clear a user's manage-roles configuration (e.g. when the permission is turned off). */
export function clearManageRolesConfig(userId: number) {
  configs.delete(userId);
  // Strip them from every role's owners list as well, losing Manage Roles
  // implies losing ownership.
  const owned = getRolesOwnedByUser(userId);
  owned.forEach((roleId) => removeRoleOwner(roleId, userId));
  notify();
}
