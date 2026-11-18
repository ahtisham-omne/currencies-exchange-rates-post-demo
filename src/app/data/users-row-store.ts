/**
 * Users listing store: per-row status/license, the import overlay, and the
 * import notice, with the hooks that subscribe to them.
 *
 * Kept apart from users-table-config.tsx so it imports no UI. That file
 * imports the status chip and actions menu, which import the restore and
 * deactivate modals, which import this store: a cycle. On a hot update to any
 * module in it, Vite loaded a second copy of the config (a ?t= import) with
 * its own empty store, so a modal wrote to one copy while the listing was
 * subscribed to the other. Reactivating a user then left their row under the
 * Deactivated filter with stale counts until a full reload. Nothing here is
 * on that path, so there is only ever one copy.
 */
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { users, type LicenseType, type UserRow, type UserStatus } from "./users-data";

/* ─── Per-row license/status store shared between cells + actions menu ─── */
export type RowState = { status: string; license: string };
const rowStates = new Map<number, RowState>();
const rowListeners = new Map<number, Set<() => void>>();
const tableListeners = new Set<() => void>();
let tableVersion = 0;

/* ─── Imported users store ─── Session-scoped overlay of users created via
 * the Import flow. Prepended to the listing so they show up first. The
 * underlying `users` array stays untouched; a hard refresh resets to mock. */
let importedUsers: UserRow[] = [];
let nextImportedId = 100000;

/* ─── Import-success notice ─── One-shot summary surfaced to the Users tab
 * as a persistent banner after an import completes. Cleared only when the
 * user clicks the close (X) control or when a new import overwrites it.
 * Carries all four counts shown in the Import Complete modal plus the
 * import id, so the banner copy mirrors that modal and the "View details"
 * action can deep-link to the import's detail page. */
export type ImportNotice = {
  created: number;
  updated: number;
  skipped: number;
  warnings: number;
  importId: string;
} | null;
let importNotice: ImportNotice = null;
const importNoticeListeners = new Set<() => void>();
function notifyImportNotice() {
  for (const fn of importNoticeListeners) fn();
}

export function setImportNotice(summary: {
  created: number;
  updated: number;
  skipped: number;
  warnings: number;
  importId: string;
}): void {
  importNotice = { ...summary };
  notifyImportNotice();
}

export function dismissImportNotice(): void {
  if (importNotice === null) return;
  importNotice = null;
  notifyImportNotice();
}

export function useImportNotice(): ImportNotice {
  return useSyncExternalStore(
    (cb) => {
      importNoticeListeners.add(cb);
      return () => {
        importNoticeListeners.delete(cb);
      };
    },
    () => importNotice,
    () => importNotice,
  );
}

function getRowState(row: UserRow): RowState {
  let s = rowStates.get(row.id);
  if (!s) {
    s = { status: row.status, license: row.license };
    rowStates.set(row.id, s);
  }
  return s;
}

function notifyUsersTable() {
  tableVersion += 1;
  tableListeners.forEach((cb) => cb());
}

export function setRowState(id: number, patch: Partial<RowState>) {
  const cur = rowStates.get(id) ?? { status: "", license: "" };
  const next = { ...cur, ...patch };
  rowStates.set(id, next);

  const sourceRow = users.find((user) => user.id === id);
  if (sourceRow) {
    if (patch.status !== undefined) {
      sourceRow.status = next.status as UserStatus;
    }
    if (patch.license !== undefined) {
      sourceRow.license = next.license as LicenseType;
    }
  }

  rowListeners.get(id)?.forEach((cb) => cb());
  notifyUsersTable();
}

function subscribeRow(id: number, cb: () => void) {
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

function subscribeUsersTable(cb: () => void) {
  tableListeners.add(cb);
  return () => {
    tableListeners.delete(cb);
  };
}

export function updateUserRowState(id: number, patch: Partial<RowState>) {
  setRowState(id, patch);
}

/** Mint a unique id for a row coming from the Import flow. */
export function makeImportedUserId(): number {
  nextImportedId += 1;
  return nextImportedId;
}

/** Append newly imported users to the listing. Prepended so they appear at
 *  the top of the default (most-recent-first) view. */
export function addImportedUsers(rows: UserRow[]): void {
  if (rows.length === 0) return;
  importedUsers = [...rows, ...importedUsers];
  notifyUsersTable();
}

/** Snapshot of every email currently in the resolved listing (case-insensitive,
 *  trimmed). Used as the validation cross-check that powers the existing-user
 *  upsert warning in the import review step. */
export function getCurrentUserEmails(): Set<string> {
  const out = new Set<string>();
  for (const u of users) {
    const e = u.email.trim().toLowerCase();
    if (e) out.add(e);
  }
  for (const u of importedUsers) {
    const e = u.email.trim().toLowerCase();
    if (e) out.add(e);
  }
  return out;
}

/** Snapshot of every role name currently used in the listing. Used as the
 *  validation cross-check that powers the role-not-found warning. */
export function getCurrentRoleNames(): Set<string> {
  const out = new Set<string>();
  const collect = (list: UserRow[]) => {
    for (const u of list) {
      for (const r of u.assignedRoles) {
        const name = r.trim().toLowerCase();
        if (name) out.add(name);
      }
    }
  };
  collect(users);
  collect(importedUsers);
  return out;
}

/** Field-level patch for an import row that updates an existing user.
 *  `email` is the matching key only, it is never written to the user.
 *  Every other field is optional: a property is present only when the
 *  uploaded row carried a non-blank value for it, so applying the patch
 *  can never overwrite an existing value with a blank. First/last name are
 *  carried separately so a row that supplies only one of them merges with
 *  the existing user's other name part. */
export interface ImportUserUpdate {
  email: string;
  firstName?: string;
  lastName?: string;
  license?: LicenseType;
  status?: UserStatus;
  assignedRoles?: string[];
  phone?: string;
}

/* Merge incoming name parts onto an existing display name. The listing only
 * stores `fullName`, so the existing value is split on its first space to
 * recover the part the patch didn't supply. */
function mergeFullName(existing: string, firstName?: string, lastName?: string): string {
  if (firstName === undefined && lastName === undefined) return existing;
  const parts = existing.trim().split(/\s+/);
  const existingFirst = parts[0] ?? "";
  const existingLast = parts.slice(1).join(" ");
  return [firstName ?? existingFirst, lastName ?? existingLast].filter(Boolean).join(" ");
}

/** Apply parsed-and-validated import rows to the listing. `creates` are rows
 *  whose email matched no existing user, they're appended as new users.
 *  `updates` are field-level patches for rows whose email matched an
 *  existing user, only the fields present in the patch are applied; blank
 *  or omitted fields leave the existing user's value unchanged. Returns the
 *  resolved counts so the host can surface them in the post-import banner. */
export function upsertImportedUsers(
  creates: UserRow[],
  updates: ImportUserUpdate[] = [],
): { created: number; updated: number } {
  if (creates.length === 0 && updates.length === 0) return { created: 0, updated: 0 };

  /* Build email → reference lookup across both stores so we don't have to
   * walk the array per row. The reference points to the live object (either
   * in `users` or `importedUsers`) so mutating it updates the listing. */
  const lookup = new Map<string, UserRow>();
  for (const u of users) {
    const e = u.email.trim().toLowerCase();
    if (e) lookup.set(e, u);
  }
  for (const u of importedUsers) {
    const e = u.email.trim().toLowerCase();
    if (e) lookup.set(e, u);
  }

  /* Mutate license/status via the rowState store so cell-level observers
   * (license/status dropdowns) re-render. The store assignment also mutates
   * `users[i].license/status` for rows sourced from the base list; rows in
   * `importedUsers` need the direct assignment as well. We never touch
   * email (matching key only) or invitedBy/invitedOn/inviteAcceptedOn on
   * update (those describe the original invite event). */
  const applyUpdate = (existing: UserRow, patch: ImportUserUpdate) => {
    const rowPatch: Partial<RowState> = {};
    if (patch.license !== undefined && patch.license !== existing.license) rowPatch.license = patch.license;
    if (patch.status !== undefined && patch.status !== existing.status) rowPatch.status = patch.status;
    if (rowPatch.license !== undefined || rowPatch.status !== undefined) {
      setRowState(existing.id, rowPatch);
    }
    if (rowPatch.license !== undefined) existing.license = rowPatch.license as LicenseType;
    if (rowPatch.status !== undefined) existing.status = rowPatch.status as UserStatus;

    const mergedName = mergeFullName(existing.fullName, patch.firstName, patch.lastName);
    if (mergedName && mergedName !== existing.fullName) existing.fullName = mergedName;
    if (patch.phone !== undefined && patch.phone !== existing.phone) existing.phone = patch.phone;
    if (patch.assignedRoles !== undefined && patch.assignedRoles.length > 0) {
      existing.assignedRoles = [...patch.assignedRoles];
    }
  };

  const toAppend: UserRow[] = [];
  let updated = 0;

  for (const patch of updates) {
    const key = patch.email.trim().toLowerCase();
    const existing = key ? lookup.get(key) : undefined;
    /* A row is classified as an update only when its email matched at
     * validation time, so a miss here shouldn't happen, skip defensively
     * rather than invent a create from a partial row. */
    if (!existing) continue;
    applyUpdate(existing, patch);
    updated++;
  }

  for (const row of creates) {
    const key = row.email.trim().toLowerCase();
    const existing = key ? lookup.get(key) : undefined;
    if (existing) {
      /* Defensive: a create row whose email turns out to exist (e.g. the
       * listing changed mid-session) updates in place instead of duplicating.
       * Create rows passed full validation, so all their fields are real. */
      applyUpdate(existing, {
        email: row.email,
        license: row.license,
        status: row.status,
        ...(row.fullName ? { firstName: row.fullName } : {}),
        ...(row.phone ? { phone: row.phone } : {}),
        ...(row.assignedRoles.length > 0 ? { assignedRoles: row.assignedRoles } : {}),
      });
      if (row.fullName && existing.fullName !== row.fullName) existing.fullName = row.fullName;
      updated++;
    } else {
      toAppend.push(row);
    }
  }

  if (toAppend.length > 0) {
    importedUsers = [...toAppend, ...importedUsers];
  }
  if (toAppend.length > 0 || updated > 0) {
    notifyUsersTable();
  }
  return { created: toAppend.length, updated };
}

/** Reactive snapshot of imported-only rows, used by Performance Insights
 *  to layer import deltas onto the existing KPI counts. The reference is
 *  stable until `notifyUsersTable()` fires (reassigning `importedUsers`),
 *  so downstream memos don't churn on unrelated re-renders. */
export function useImportedUsers(): UserRow[] {
  return useSyncExternalStore(
    subscribeUsersTable,
    () => importedUsers,
    () => importedUsers,
  );
}

export function useResolvedUsersData(): UserRow[] {
  /* Re-render whenever the store bumps. */
  const version = useSyncExternalStore(
    subscribeUsersTable,
    () => tableVersion,
    () => tableVersion,
  );

  /* Memoize the resolved array on the store version so the reference is
   * stable across unrelated parent renders. Without this, every parent
   * re-render produced a fresh array, which cascaded through the DataTable
   * memos and the onFilteredRowsChange effect into a setState in the parent,
   * forming a render loop that bogged the whole page down. */
  return useMemo(() => {
    return [...importedUsers, ...users].map((user) => {
      const state = rowStates.get(user.id);
      return state
        ? {
            ...user,
            status: state.status as UserStatus,
            license: state.license as LicenseType,
          }
        : user;
    });
  }, [version]);
}

export function useRowState(row: UserRow): RowState {
  useEffect(() => {
    getRowState(row);
  }, [row]);
  return useSyncExternalStore(
    (cb) => subscribeRow(row.id, cb),
    () => getRowState(row),
    () => getRowState(row),
  );
}
