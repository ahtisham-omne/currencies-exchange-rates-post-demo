/* Persistent per-import detail records.
 *
 * The history listing (DataImportDetailPage) reads its lightweight per-row
 * summary from importHistory.ts. The drill-down detail page needs the full
 * per-record payload so it can render the records table, the All/Imported/
 * Failed filter counts, and the CSV/Excel downloads. Keeping that payload
 * here, separate from importHistory, keeps the listing entry small and
 * lets the listing render without paying the cost of materialising every
 * import's rows up front. */

import type { ImportedUserRow } from "./importRecords";
import type { ImporterKey } from "./importers";

export interface StoredImportDetail {
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
  records: ImportedUserRow[];
}

const STORAGE_KEY = "omne:import-detail";

function readAll(): Record<string, StoredImportDetail> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, StoredImportDetail>) : {};
  } catch {
    return {};
  }
}

function writeAll(value: Record<string, StoredImportDetail>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    /* localStorage quota or unavailable, swallow. The session loses the
     * detail payload but the listing entry still appears via importHistory. */
  }
}

export function saveImportDetail(detail: StoredImportDetail): void {
  const all = readAll();
  all[detail.id] = detail;
  writeAll(all);
}

export function getImportDetail(id: string): StoredImportDetail | null {
  const all = readAll();
  return all[id] ?? null;
}
