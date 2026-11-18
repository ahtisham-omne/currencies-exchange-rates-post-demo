/* History and per-import detail for the sheet-shaped modules.
 *
 * Kept beside the Users store rather than inside it: those records are one row
 * per user, these are one row per line item under a record, so they cannot
 * share a payload type. The listing entry itself is the module's existing
 * CompletedImportEntry, so the Data Imports listing needs no special case.
 *
 * Same session lifecycle as the Users store: the detail payloads live in
 * localStorage (an import log is an audit record and must be readable from
 * every tab), and each surface lays down two clean mock imports the first time
 * it is viewed in a page load. */

import { addCompletedImport, getCompletedImports, type CompletedImportEntry } from "../importHistory";
import type { SheetImportSpec } from "./sheetSpec";
import type { SheetRow } from "./sheetRecords";
import { isNewTenant } from "../../../data/tenant";

export interface StoredSheetImport {
  id: string;
  moduleSlug: string;
  name: string;
  description?: string;
  fileName: string;
  dateISO: string;
  importerKey: "sj" | "ac" | "ra" | "am";
  rows: SheetRow[];
}

const STORAGE_KEY = "omne:sheet-import-detail";

function readAll(): Record<string, StoredSheetImport> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, StoredSheetImport>) : {};
  } catch {
    return {};
  }
}

function writeAll(value: Record<string, StoredSheetImport>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    /* Quota or unavailable: the listing entry still appears, the row payload
       is simply not available for the drill-down. */
  }
}

export function saveSheetImport(detail: StoredSheetImport): void {
  const all = readAll();
  all[detail.id] = detail;
  writeAll(all);
}

export function getSheetImport(id: string): StoredSheetImport | null {
  return readAll()[id] ?? null;
}

/** Replace the stored rows for an import. Used when failed rows are corrected
 *  and re-imported from the detail page, so the page and the listing counts
 *  keep agreeing. */
export function updateSheetImportRows(id: string, rows: SheetRow[]): void {
  const all = readAll();
  const existing = all[id];
  if (!existing) return;
  all[id] = { ...existing, rows };
  writeAll(all);
}

/* ────────────────────────────────────
   Mock seed
   ──────────────────────────────────── */

const seeded = new Set<string>();

/** Two past imports per surface: one clean, one that still carries failed rows
 *  so the fix-and-re-import path has something to act on from a cold start. */
export function ensureSheetSeed(spec: SheetImportSpec, mock: SheetMockSeed): void {
  /* A company from onboarding has imported nothing yet. */
  if (isNewTenant()) return;
  if (seeded.has(spec.slug)) return;
  seeded.add(spec.slug);

  /* The history store is wiped once per page load while these detail payloads
     live on, so the guard has to read the history: keying it off the stored
     detail meant the seeds were skipped on every reload after the first and
     the listing came up empty. */
  const already = new Set(getCompletedImports(spec.slug).map((e) => e.id));
  for (const seed of mock.entries) {
    /* Rows the admin has already fixed on the record page live in the detail
       store and must survive the re-seed: only lay the mock rows down when
       there is nothing stored for this import yet, and take the listing counts
       from whatever rows are actually stored so the chips match the page. */
    const stored = getSheetImport(seed.entry.id);
    if (!stored) {
      saveSheetImport({
        id: seed.entry.id,
        moduleSlug: spec.slug,
        name: seed.entry.name,
        description: seed.entry.description,
        fileName: seed.entry.fileName ?? seed.entry.name,
        dateISO: seed.entry.dateISO,
        importerKey: seed.entry.importerKey,
        rows: seed.rows,
      });
    }
    if (already.has(seed.entry.id)) continue;
    const rows = stored?.rows ?? seed.rows;
    addCompletedImport({
      ...seed.entry,
      recordCount: rows.length,
      importedCount: rows.filter((r) => r._outcome === "Created").length,
      failedCount: rows.filter((r) => r._outcome !== "Created").length,
    });
  }
}

export interface SheetMockSeed {
  entries: Array<{ entry: CompletedImportEntry; rows: SheetRow[] }>;
}
