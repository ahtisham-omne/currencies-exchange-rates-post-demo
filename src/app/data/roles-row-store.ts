/**
 * Roles listing store: per-row status, the import notice, the import
 * cross-checks and upsert, with the hooks that subscribe to them.
 *
 * Kept apart from roles-table-config.tsx so it imports no UI, for the same
 * reason as users-row-store.ts: that file imports the status chip and the
 * role actions menu, whose modals import this store, a cycle. On a hot
 * update to any module in it, Vite loaded a second copy of the config (a ?t=
 * import) with its own empty store, so a modal wrote to one copy while the
 * listing was subscribed to the other. Nothing here is on that path.
 */
import { useEffect, useSyncExternalStore } from "react";
import { roles, roleNameToOptionId, SYSTEM_ROLE_NAMES, type LicenseType, type RoleRow, type RoleStatus } from "./roles-data";
import { addUsersToRole, applyRoleLicenseTier } from "./role-detail-data";
import { setRolePermissions, notifyRolePermissionsChange } from "./role-permissions-map";
import { computeRoleTier } from "../lib/permission-tier";
import { buildEmptyToggles } from "./permissions-data";

/* ─── Per-row status store shared across the roles list ─── */
export type RowState = { status: string };
const rowStates = new Map<number, RowState>();
const rowListeners = new Map<number, Set<() => void>>();
const tableListeners = new Set<() => void>();
let tableVersion = 0;

/* ─── Import-success notice ─── One-shot summary surfaced to the Roles tab
 * as a persistent banner after an import completes. Mirrors the Users tab's
 * import notice (users-table-config) one-to-one: cleared only when the user
 * clicks the close (X) control or when a new import overwrites it. Carries
 * all four counts shown in the Import Complete modal plus the import id, so
 * the banner copy mirrors that modal and the "View details" action can
 * deep-link to the import's detail page. */
export type RolesImportNotice = {
  created: number;
  updated: number;
  skipped: number;
  warnings: number;
  importId: string;
} | null;
let rolesImportNotice: RolesImportNotice = null;
const rolesImportNoticeListeners = new Set<() => void>();
function notifyRolesImportNotice() {
  for (const fn of rolesImportNoticeListeners) fn();
}

export function setRolesImportNotice(summary: {
  created: number;
  updated: number;
  skipped: number;
  warnings: number;
  importId: string;
}): void {
  rolesImportNotice = { ...summary };
  notifyRolesImportNotice();
}

export function dismissRolesImportNotice(): void {
  if (rolesImportNotice === null) return;
  rolesImportNotice = null;
  notifyRolesImportNotice();
}

export function useRolesImportNotice(): RolesImportNotice {
  return useSyncExternalStore(
    (cb) => {
      rolesImportNoticeListeners.add(cb);
      return () => {
        rolesImportNoticeListeners.delete(cb);
      };
    },
    () => rolesImportNotice,
    () => rolesImportNotice,
  );
}

/* ─── Import cross-check snapshots ─── */

/** Snapshot of every role name currently in the listing (case-insensitive,
 *  trimmed). Used as the validation cross-check that powers the existing-
 *  role upsert split in the import review step. */
export function getExistingRoleNames(): Set<string> {
  const out = new Set<string>();
  for (const r of roles) {
    const name = r.roleName.trim().toLowerCase();
    if (name) out.add(name);
  }
  return out;
}

/**
 * Whether a role name is already taken.
 *
 * Uniqueness is deliberately status-agnostic: an Archived or Inactive role still
 * holds its name, because unarchiving or reactivating it must not collide with
 * something created in the meantime, and the Roles listing would otherwise show
 * two rows with the same name. `excludeRoleId` is how a flow that edits an
 * existing role (rename, unarchive, reactivate) skips the role's own row, so
 * keeping its current name is never reported as a collision.
 */
export function isRoleNameTaken(name: string, excludeRoleId?: number): boolean {
  const needle = name.trim().toLowerCase();
  if (!needle) return false;
  return roles.some(
    (r) => r.id !== excludeRoleId && r.roleName.trim().toLowerCase() === needle,
  );
}

/**
 * Inline message for a colliding role name, or null when the name is free. One
 * function so every surface that names a role (Create Role, the unarchive
 * stepper, and anything added later) blocks on the same rule with the same
 * wording. A blank name is not a collision: that is the required-field error,
 * which is a different message.
 */
export function roleNameCollisionMessage(
  name: string,
  excludeRoleId?: number,
): string | null {
  const trimmed = name.trim();
  if (!trimmed) return null;
  return isRoleNameTaken(trimmed, excludeRoleId)
    ? `A role named "${trimmed}" already exists. Each role must have a unique name.`
    : null;
}

/** Lower-cased names of the predefined system roles. Rows matching one of
 *  these fail import validation, system roles can't be changed by import. */
export function getSystemRoleNamesLower(): Set<string> {
  const out = new Set<string>();
  for (const name of SYSTEM_ROLE_NAMES) {
    out.add(name.trim().toLowerCase());
  }
  return out;
}

/** Field-level patch for an import row that updates an existing role.
 *  `roleName` is the matching key only, it is never written to the role.
 *  Every other field is optional: a property is present only when the
 *  uploaded row carried a non-blank value for it, so applying the patch
 *  can never overwrite an existing value with a blank. */
export interface ImportRoleUpdate {
  roleName: string;
  description?: string;
  licenseRequired?: LicenseType;
  status?: RoleStatus;
  roleOwner?: string;
  /** Resolved ids of existing users to assign to the role. */
  assignedUserIds?: number[];
}

/** A create row from the import flow: the listing row plus the resolved ids
 *  of existing users to assign to it. */
export interface ImportRoleCreate {
  row: RoleRow;
  assignedUserIds: number[];
}

/** Mint a unique id for a role coming from the Import flow. Seeds from the
 *  current max id (so it stays unique against both the mock data and roles
 *  created in-session) and then counts monotonically, so consecutive mints
 *  within one import batch never collide before the rows are registered. */
let nextImportedRoleId = 0;
export function makeImportedRoleId(): number {
  const floor = roles.reduce((max, r) => Math.max(max, r.id), 0);
  nextImportedRoleId = Math.max(nextImportedRoleId, floor) + 1;
  return nextImportedRoleId;
}

/** Apply parsed-and-validated import rows to the listing. `creates` are rows
 *  whose name matched no existing role, they're prepended as new roles.
 *  `updates` are field-level patches for rows whose name matched an existing
 *  role, only the fields present in the patch are applied; blank or omitted
 *  fields leave the existing role's value unchanged. Returns the resolved
 *  counts so the host can surface them in the post-import banner. */
export function upsertImportedRoles(
  creates: ImportRoleCreate[],
  updates: ImportRoleUpdate[] = [],
): { created: number; updated: number } {
  if (creates.length === 0 && updates.length === 0) return { created: 0, updated: 0 };

  /* Build name → reference lookup so we don't have to walk the array per
   * row. The reference points to the live object in `roles`, so mutating it
   * updates the listing. System roles are excluded, validation already
   * rejects rows that target them, and this keeps the defensive create-path
   * below from ever touching one. */
  const lookup = new Map<string, RoleRow>();
  for (const r of roles) {
    if (r.isSystem) continue;
    const name = r.roleName.trim().toLowerCase();
    if (name) lookup.set(name, r);
  }

  /* Mutate status via the rowState store so cell-level observers (status
   * dropdowns) re-render. We never touch roleName (matching key only). */
  const applyUpdate = (existing: RoleRow, patch: ImportRoleUpdate) => {
    if (patch.status !== undefined && patch.status !== existing.status) {
      setRoleState(existing.id, { status: patch.status });
    }
    if (patch.description !== undefined && patch.description !== existing.description) {
      existing.description = patch.description;
    }
    if (patch.licenseRequired !== undefined && patch.licenseRequired !== existing.licenseRequired) {
      existing.licenseRequired = patch.licenseRequired;
    }
    if (patch.roleOwner !== undefined && patch.roleOwner !== existing.roleOwner) {
      existing.roleOwner = patch.roleOwner;
    }
    if (patch.assignedUserIds !== undefined && patch.assignedUserIds.length > 0) {
      addUsersToRole(existing.id, patch.assignedUserIds);
    }
  };

  let created = 0;
  let updated = 0;

  for (const patch of updates) {
    const key = patch.roleName.trim().toLowerCase();
    const existing = key ? lookup.get(key) : undefined;
    /* A row is classified as an update only when its name matched at
     * validation time, so a miss here shouldn't happen, skip defensively
     * rather than invent a create from a partial row. */
    if (!existing) continue;
    applyUpdate(existing, patch);
    updated++;
  }

  for (const create of creates) {
    const key = create.row.roleName.trim().toLowerCase();
    const existing = key ? lookup.get(key) : undefined;
    if (existing) {
      /* Defensive: a create row whose name turns out to exist (e.g. the
       * listing changed mid-session) updates in place instead of
       * duplicating. Create rows passed full validation, so all their
       * fields are real. */
      applyUpdate(existing, {
        roleName: create.row.roleName,
        description: create.row.description || undefined,
        licenseRequired: create.row.licenseRequired,
        status: create.row.status,
        roleOwner: create.row.roleOwner || undefined,
        assignedUserIds: create.assignedUserIds,
      });
      updated++;
    } else {
      /* Prepend so imported roles appear at the top of the Custom group. */
      roles.unshift(create.row);
      lookup.set(key, create.row);
      if (create.assignedUserIds.length > 0) {
        addUsersToRole(create.row.id, create.assignedUserIds);
      }
      created++;
    }
  }

  if (created > 0 || updated > 0) {
    notifyRolesTable();
  }
  return { created, updated };
}

/** Write a role's granted-permission set and reconcile everything that
 *  derives from it: the license tier (recomputed from the permissions), the
 *  listing permission-count column, the role detail Permissions tab, and the
 *  Draft → Active flip (a role with permissions is no longer an empty shell).
 *  This is the single write-path used by the "set up permissions" flow. */
export function applyRolePermissions(roleId: number, permissionIds: string[]): void {
  const role = roles.find((r) => r.id === roleId);
  if (!role) return;

  setRolePermissions(roleNameToOptionId(role.roleName), permissionIds, role.roleName);
  notifyRolePermissionsChange();

  /* License falls out of the permission set, no license column, no guessing. */
  applyRoleLicenseTier(roleId, computeRoleTier(buildEmptyToggles(permissionIds)));

  /* An imported role lands as Draft; giving it permissions makes it usable,
   *  so it graduates to Active. setRoleState notifies the table for us; the
   *  else-branch covers the (rare) case of editing a non-Draft role. */
  if (permissionIds.length > 0 && role.status === "Draft") {
    setRoleState(roleId, { status: "Active" });
  } else {
    notifyRolesTable();
  }
}

function getRowState(row: RoleRow): RowState {
  let state = rowStates.get(row.id);
  if (!state) {
    state = { status: row.status };
    rowStates.set(row.id, state);
  }
  return state;
}

function notifyRolesTable() {
  tableVersion += 1;
  tableListeners.forEach((cb) => cb());
}

export function setRoleState(id: number, patch: Partial<RowState>) {
  const cur = rowStates.get(id) ?? { status: "" };
  const next = { ...cur, ...patch };
  rowStates.set(id, next);

  const sourceRow = roles.find((role) => role.id === id);
  if (sourceRow && patch.status !== undefined) {
    sourceRow.status = next.status as RoleStatus;
  }

  rowListeners.get(id)?.forEach((cb) => cb());
  notifyRolesTable();
}

function subscribeRoleRow(id: number, cb: () => void) {
  let set = rowListeners.get(id);
  if (!set) {
    set = new Set();
    rowListeners.set(id, set);
  }
  set.add(cb);
  return () => {
    set!.delete(cb);
  };
}

function subscribeRolesTable(cb: () => void) {
  tableListeners.add(cb);
  return () => {
    tableListeners.delete(cb);
  };
}

export function updateRoleRowState(id: number, patch: Partial<RowState>) {
  setRoleState(id, patch);
}

export function useResolvedRolesData(): RoleRow[] {
  useSyncExternalStore(
    subscribeRolesTable,
    () => tableVersion,
    () => tableVersion,
  );

  return roles.map((role) => {
    const state = rowStates.get(role.id);
    return state
      ? {
          ...role,
          status: state.status as RoleStatus,
        }
      : role;
  });
}

export function useRoleState(row: RoleRow): RowState {
  useEffect(() => {
    getRowState(row);
  }, [row]);
  return useSyncExternalStore(
    (cb) => subscribeRoleRow(row.id, cb),
    () => getRowState(row),
    () => getRowState(row),
  );
}
