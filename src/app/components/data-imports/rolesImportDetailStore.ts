/* Persistent per-import detail records for the Roles module.
 *
 * Mirrors importDetailStore.ts (the Users store) one-to-one: the history
 * listing reads its lightweight per-row summary from importHistory.ts, and
 * the drill-down detail page reads the full per-record payload from here.
 * Kept under its own storage key because the record shape is role-specific,
 * the Users store keeps holding ImportedUserRow payloads untouched. */

import type { ImportedRoleRow } from "./rolesImportRecords";
import type { ImporterKey } from "./importers";

export interface StoredRolesImportDetail {
  id: string;
  moduleSlug: string;
  /** Display name entered in the wizard (or, if absent, the file name). */
  name: string;
  /** Free-text description entered in the import wizard. Blank when skipped. */
  description?: string;
  /** ISO timestamp of when the import finished. */
  dateISO: string;
  importerKey: ImporterKey;
  fileName: string;
  records: ImportedRoleRow[];
}

const STORAGE_KEY = "omne:roles-import-detail";

function readAll(): Record<string, StoredRolesImportDetail> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, StoredRolesImportDetail>) : {};
  } catch {
    return {};
  }
}

function writeAll(value: Record<string, StoredRolesImportDetail>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    /* localStorage quota or unavailable, swallow. The session loses the
     * detail payload but the listing entry still appears via importHistory. */
  }
}

export function saveRolesImportDetail(detail: StoredRolesImportDetail): void {
  const all = readAll();
  all[detail.id] = detail;
  writeAll(all);
}

export function getRolesImportDetail(id: string): StoredRolesImportDetail | null {
  const all = readAll();
  return all[id] ?? null;
}
