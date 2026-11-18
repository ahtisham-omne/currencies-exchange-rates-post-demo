/* ─────────────────────────────────────────────────────────────
 * Role-level "Manage Roles" scope (per-role configuration).
 *
 * Defines which roles users in a given role are allowed to manage,
 * for the ur-manage-roles permission viewed at the role level.
 *
 * This is independent from the per-user manage-roles-scope-data store,
 * the role-level config is a baseline for the role, while the user-level
 * config personalises it (Owner, additions, etc.).
 * ─────────────────────────────────────────────────────────── */

export type RoleManageScopeMode = "all" | "selected";

export interface RoleManageScopeConfig {
  mode: RoleManageScopeMode;
  manageRoleIds: number[];
  /** Previously saved selection, restored when the permission is toggled OFF then ON again. */
  lastSelectedRoleIds: number[];
}

const EMPTY: RoleManageScopeConfig = {
  mode: "selected",
  manageRoleIds: [],
  lastSelectedRoleIds: [],
};

const store = new Map<number, RoleManageScopeConfig>();

/* ─── Seed: realistic mid-workflow state for the Add Roles modal ───
 * Role ids reference the canonical Pioneer v2.0 listing in predefined-roles.ts
 * (1..25) plus the custom roles in roles-data.ts (26..28). */
/* Warehouse Supervisor (10) → manages its floor roles: Material Handler (20),
 * Cycle Counter (21), Dispatch Clerk (22), Receiving Clerk (23). */
store.set(10, { mode: "selected", manageRoleIds: [20, 21, 22, 23], lastSelectedRoleIds: [20, 21, 22, 23] });
/* Procurement Manager (8) → Buyer (7) + Vendor Manager (9) + Senior Buyer (28, custom). */
store.set(8, { mode: "selected", manageRoleIds: [7, 9, 28], lastSelectedRoleIds: [7, 9, 28] });
/* Sales Manager (17) intentionally left unconfigured. */

/* Existing demo seeds for role-detail page */
/* System Configuration Manager (3) → IT Helpdesk (5) + Item Data Administrator (12) */
store.set(3, { mode: "selected", manageRoleIds: [5, 12], lastSelectedRoleIds: [5, 12] });
/* Access and Security Manager (4) → "All roles" */
store.set(4, { mode: "all", manageRoleIds: [], lastSelectedRoleIds: [] });
/* IT Helpdesk (5) → Basic User (25) */
store.set(5, { mode: "selected", manageRoleIds: [25], lastSelectedRoleIds: [25] });

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((cb) => cb());
}

/** Drop every seeded scope above. A company that onboarding just set up has
 *  configured none (see onboarding-handoff.ts). */
export function clearRoleManageScopes(): void {
  store.clear();
  notify();
}

export function subscribeRoleManageScope(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function getRoleManageScope(roleId: number): RoleManageScopeConfig {
  return store.get(roleId) ?? EMPTY;
}

export interface SaveRoleManageScopeInput {
  mode: RoleManageScopeMode;
  manageRoleIds: number[];
}

export function saveRoleManageScope(roleId: number, input: SaveRoleManageScopeInput) {
  const prev = store.get(roleId);
  const lastSelected =
    input.mode === "selected" && input.manageRoleIds.length > 0
      ? input.manageRoleIds
      : prev?.lastSelectedRoleIds ?? [];
  store.set(roleId, {
    mode: input.mode,
    manageRoleIds: input.mode === "selected" ? [...input.manageRoleIds] : [],
    lastSelectedRoleIds: [...lastSelected],
  });
  notify();
}

/** Restore previously saved scope (e.g. when permission is re-enabled). Returns true if restored. */
export function restoreRoleManageScope(roleId: number): boolean {
  const prev = store.get(roleId);
  if (!prev) return false;
  if (prev.mode === "all") return true;
  if (prev.manageRoleIds.length > 0) return true;
  if (prev.lastSelectedRoleIds.length > 0) {
    store.set(roleId, {
      mode: "selected",
      manageRoleIds: [...prev.lastSelectedRoleIds],
      lastSelectedRoleIds: [...prev.lastSelectedRoleIds],
    });
    notify();
    return true;
  }
  return false;
}

export function clearRoleManageScope(roleId: number) {
  const prev = store.get(roleId);
  if (!prev) return;
  // Keep lastSelectedRoleIds so re-enable can restore.
  store.set(roleId, {
    mode: "selected",
    manageRoleIds: [],
    lastSelectedRoleIds: prev.lastSelectedRoleIds,
  });
  notify();
}

/** Remove a single role from the configured scope (chip X icon). No-op in "all" mode. */
export function removeRoleFromManageScope(roleId: number, removedRoleId: number) {
  const prev = store.get(roleId);
  if (!prev || prev.mode !== "selected") return;
  const next = prev.manageRoleIds.filter((id) => id !== removedRoleId);
  if (next.length === prev.manageRoleIds.length) return;
  store.set(roleId, {
    ...prev,
    manageRoleIds: next,
    lastSelectedRoleIds: next.length > 0 ? next : prev.lastSelectedRoleIds,
  });
  notify();
}
