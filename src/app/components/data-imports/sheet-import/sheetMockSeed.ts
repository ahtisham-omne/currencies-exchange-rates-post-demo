/* The past imports each sheet-shaped surface shows on a cold start.
 *
 * Three of them: two that imported in full, and one partial that still carries
 * rows needing a fix, so the fix-and-re-import path on the record page has
 * something real to act on the first time an admin opens it. Built from the
 * spec, so a module contributes only its sample values. */

import type { CompletedImportEntry } from "../importHistory";
import type { SheetImportSpec } from "./sheetSpec";
import type { SheetRow } from "./sheetRecords";
import { validateRows } from "./sheetValidation";
import type { SheetMockSeed } from "./sheetImportStore";

export interface MockRecordSeed {
  /** Record-level cell values, keyed by column key. */
  record: Record<string, string>;
  /** One entry per line item; record columns are left blank after the first. */
  lines: Array<Record<string, string>>;
}

function buildRows(spec: SheetImportSpec, records: MockRecordSeed[]): SheetRow[] {
  const rows: SheetRow[] = [];
  let rowNo = 0;
  for (const rec of records) {
    rec.lines.forEach((line, idx) => {
      rowNo += 1;
      rows.push({
        values: idx === 0 ? { ...rec.record, ...line } : { ...line },
        _row: rowNo,
        _key: rec.record[spec.keyColumn] ?? "",
        _isRecordRow: idx === 0,
        issues: [],
      });
    });
  }
  return rows;
}

/* Bumped whenever the seeded rows change. The record page keeps a seeded
   import's rows in localStorage so fixes made there survive a reload, which
   also means a browser that opened an older seed would keep showing it. When
   the stored version differs, the seeded payloads are dropped once so
   ensureSheetSeed lays the current rows down. Same key the sheet store uses. */
const SEED_VERSION = "2026-09-30-every-rule-2";
const DETAIL_STORAGE_KEY = "omne:sheet-import-detail";
const VERSION_STORAGE_KEY = "omne:sheet-import-seed-version";

function dropStaleSeed(slug: string): void {
  if (typeof window === "undefined") return;
  try {
    const versions = JSON.parse(window.localStorage.getItem(VERSION_STORAGE_KEY) ?? "{}") as Record<string, string>;
    if (versions[slug] === SEED_VERSION) return;
    const raw = window.localStorage.getItem(DETAIL_STORAGE_KEY);
    if (raw) {
      const all = JSON.parse(raw) as Record<string, unknown>;
      for (const n of [1, 2, 3]) delete all[`imp-${slug}-${n}`];
      window.localStorage.setItem(DETAIL_STORAGE_KEY, JSON.stringify(all));
    }
    versions[slug] = SEED_VERSION;
    window.localStorage.setItem(VERSION_STORAGE_KEY, JSON.stringify(versions));
  } catch {
    /* Storage unavailable: the seed simply lays down fresh next time. */
  }
}

export function buildSheetMockSeed(
  spec: SheetImportSpec,
  july: MockRecordSeed[],
  initial: MockRecordSeed[],
  partial: MockRecordSeed[],
  /** The module's existing keys, validated against exactly as the record page
   *  does, so a seeded "already exists" error survives an edit there. */
  existingKeys: readonly string[] = [],
): SheetMockSeed {
  dropStaleSeed(spec.slug);
  /* File names, descriptions and importers follow the seeded pair the Users
     import history already shows, so every surface reads with the same
     vocabulary. The third entry is the partial case: some rows imported, the
     rest still needing a fix. */
  const title = spec.recordLabelPlural;
  const stem = title.replace(/\s+/g, "_");
  const noun = title.toLowerCase();

  const clean = (records: MockRecordSeed[]) =>
    validateRows(buildRows(spec, records), spec, { existingKeys }).map((r) => ({ ...r, _outcome: "Created" as const }));
  /* The partial import is stored the way it finished: rows that passed are
     imported, rows that still carry an error are left needing a fix. */
  const asFinished = (records: MockRecordSeed[]) =>
    validateRows(buildRows(spec, records), spec, { existingKeys }).map((r) => ({
      ...r,
      _outcome: r.issues.some((i) => i.level === "error") ? ("Failed" as const) : ("Created" as const),
    }));

  const julyRows = clean(july);
  const initialRows = clean(initial);
  const partialRows = asFinished(partial);

  const entries: Array<{ entry: CompletedImportEntry; rows: SheetRow[] }> = [
    {
      entry: {
        id: `imp-${spec.slug}-3`,
        moduleSlug: spec.slug,
        name: `${title} June update`,
        fileName: `${stem}_June_2026.csv`,
        description: `Monthly ${noun} update`,
        dateISO: "2026-07-20T11:12:00.000Z",
        importerKey: "ra",
        recordCount: partialRows.length,
        importedCount: partialRows.filter((r) => r._outcome === "Created").length,
        failedCount: partialRows.filter((r) => r._outcome !== "Created").length,
      },
      rows: partialRows,
    },
    {
      entry: {
        id: `imp-${spec.slug}-1`,
        moduleSlug: spec.slug,
        name: `${title} July update`,
        fileName: `${stem}_July_2026.csv`,
        description: `Monthly ${noun} update`,
        dateISO: "2026-07-12T09:24:00.000Z",
        importerKey: "sj",
        recordCount: julyRows.length,
        importedCount: julyRows.length,
        failedCount: 0,
      },
      rows: julyRows,
    },
    {
      entry: {
        id: `imp-${spec.slug}-2`,
        moduleSlug: spec.slug,
        name: `${title} initial load`,
        fileName: `${stem}_Initial_2026.csv`,
        description: `Initial ${noun} data load`,
        dateISO: "2026-06-28T14:05:00.000Z",
        importerKey: "ac",
        recordCount: initialRows.length,
        importedCount: initialRows.length,
        failedCount: 0,
      },
      rows: initialRows,
    },
  ];

  return { entries };
}
