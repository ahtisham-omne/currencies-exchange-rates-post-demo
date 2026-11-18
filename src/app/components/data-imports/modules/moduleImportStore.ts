/* Per-import detail records for the Item Library, Categories, Partners and
 * Partner Group modules, plus their three seeded past imports (two clean, one
 * June import whose rows trip every validation rule).
 *
 * The Users detail store (importDetailStore.ts) with a record type keyed by
 * each module's own columns: same lifecycle, same localStorage durability,
 * its own key so the Users payload type stays exactly as it is. History
 * entries go through the shared importHistory store unchanged, so the module
 * listing, its counts and the correction tree need no special case. */

import {
  addCompletedImport,
  getCompletedImports,
  updateCompletedImportCounts,
  type CompletedImportEntry,
} from "../importHistory";
import { isFailed, isImported, type RowOutcome } from "../importRecords";
import type { ImporterKey } from "../importers";
import {
  applyToRecords,
  buildSnapshot,
  type ParentCounts,
  type ParentSnapshot,
  type ResolvedParentRow,
} from "../correctionLink";
import { MODULE_IMPORT_DEFS, type ModuleImportDef, type ModuleImportSlug, type ModuleRow } from "./moduleImportDefs";
import type { SeedCase } from "./failedSeedTypes";
import { isNewTenant } from "../../../data/tenant";
import { CATEGORIES_FAILED_SEED } from "./categories/failedSeed";
import { ITEM_LIBRARY_FAILED_SEED } from "./item-library/failedSeed";
import { PARTNERS_FAILED_SEED, PARTNER_GROUPS_FAILED_SEED } from "./partners/failedSeed";
import { PHYSICAL_INVENTORY_FAILED_SEEDS } from "./physical-inventory/failedSeed";
import { piItemsFor, piTab } from "./physical-inventory/piModule";

/** One imported record: the module's column values plus the audit fields the
 *  Users record carries (`_row`, `_outcome`, `_message`). */
export interface ModuleRecord {
  [columnKey: string]: string | number | undefined;
  _row: number;
  _outcome: RowOutcome;
  _message?: string;
}

export interface StoredModuleImport {
  id: string;
  moduleSlug: string;
  name: string;
  description?: string;
  dateISO: string;
  importerKey: ImporterKey;
  fileName: string;
  records: ModuleRecord[];
}

const STORAGE_KEY = "omne:module-import-detail";

function readAll(): Record<string, StoredModuleImport> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, StoredModuleImport>) : {};
  } catch {
    return {};
  }
}

function writeAll(value: Record<string, StoredModuleImport>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    /* Quota or unavailable: the listing entry still appears via importHistory. */
  }
}

export function saveModuleImport(detail: StoredModuleImport): void {
  const all = readAll();
  all[detail.id] = detail;
  writeAll(all);
}

export function getModuleImport(id: string): StoredModuleImport | null {
  return readAll()[id] ?? null;
}

/** The column values of a record, every column present. */
export function recordValues(def: ModuleImportDef, rec: ModuleRecord): ModuleRow {
  const row: ModuleRow = {};
  for (const c of def.columns) {
    const v = rec[c.key];
    row[c.key] = v === undefined || v === null ? "" : String(v);
  }
  return row;
}

/** A record from a review row, with its audit fields. */
export function toModuleRecord(row: ModuleRow, rowNumber: number, outcome: RowOutcome, message?: string): ModuleRecord {
  return { ...row, _row: rowNumber, _outcome: outcome, ...(message ? { _message: message } : {}) };
}

/* ────────────────────────────────────
   Corrections (same contract as the Users loaders in correctionLink.ts)
   ──────────────────────────────────── */

export function moduleSnapshotLoader(def: ModuleImportDef) {
  return (importId: string): ParentSnapshot | null => {
    const detail = getModuleImport(importId);
    if (!detail) return null;
    return buildSnapshot(
      detail.id,
      detail.name,
      detail.fileName,
      detail.moduleSlug,
      detail.records,
      (i) => String(detail.records[i]?.[def.keyField] ?? "").trim().toLowerCase(),
    );
  };
}

export function applyModuleCorrectionToParent(
  parentId: string,
  resolved: ResolvedParentRow<ModuleRow>[],
): ParentCounts | null {
  const detail = getModuleImport(parentId);
  if (!detail) return null;
  const { records, resolvedCount } = applyToRecords(detail.records, resolved);
  if (resolvedCount === 0) return null;
  saveModuleImport({ ...detail, records });
  const counts: ParentCounts = {
    importedCount: records.filter((r) => isImported(r._outcome)).length,
    failedCount: records.filter((r) => isFailed(r._outcome)).length,
  };
  updateCompletedImportCounts(parentId, counts);
  return counts;
}

/* ────────────────────────────────────
   Seeded past imports
   ──────────────────────────────────── */

/* Seed file stems and descriptions per module. Same dates, importers, counts
 * and id scheme as the Users seeds (importHistory.ts buildMockEntries). */
const SEED_COPY: Record<ModuleImportSlug, { stem: string; label: string; july: string; initial: string; june: string }> = {
  "item-library": { stem: "Items", label: "Items", july: "Monthly item catalog update", initial: "Initial item library load", june: "Supplier catalog refresh" },
  categories: { stem: "Categories", label: "Categories", july: "Monthly category update", initial: "Initial category hierarchy load", june: "Category rules cleanup" },
  partners: { stem: "Partners", label: "Partners", july: "Monthly partner update", initial: "Initial partner onboarding load", june: "New dealer onboarding batch" },
  "partner-groups": { stem: "Partner_Groups", label: "Partner Groups", july: "Monthly partner group update", initial: "Initial partner group load", june: "Regional group restructure" },
  "physical-inventory-serialized": { stem: "Serial_Units", label: "Serial Units", july: "Monthly serial unit intake", initial: "Opening serial unit balances", june: "Warehouse recount corrections" },
  "physical-inventory-non-serialized": { stem: "Stock_Lines", label: "Stock Lines", july: "Monthly stock line intake", initial: "Opening stock balances", june: "Warehouse recount corrections" },
  "physical-inventory-lot-serialized": { stem: "LOT_Serial_Units", label: "LOT Serial Units", july: "Monthly LOT serial unit intake", initial: "Opening LOT serial balances", june: "Supplier LOT receipts" },
  "physical-inventory-lot": { stem: "LOT_Units", label: "LOT Units", july: "Monthly LOT stock intake", initial: "Opening LOT balances", june: "Supplier LOT receipts" },
};

/* The June import per module: rows that together trip every rule the
 * module's validator can raise (see ./<slug>/failedSeed.ts for the table). */
const FAILED_SEEDS: Record<ModuleImportSlug, SeedCase[]> = {
  "item-library": ITEM_LIBRARY_FAILED_SEED,
  categories: CATEGORIES_FAILED_SEED,
  partners: PARTNERS_FAILED_SEED,
  "partner-groups": PARTNER_GROUPS_FAILED_SEED,
  ...PHYSICAL_INVENTORY_FAILED_SEEDS,
};

export function failedSeedCases(slug: ModuleImportSlug): SeedCase[] {
  return FAILED_SEEDS[slug];
}

/** The sample key for record `i` of a seed batch ("Jul" / "Jun"), in the
 *  module's own key format. */
function sampleKey(slug: ModuleImportSlug, seed: string, i: number): string {
  const n2 = String(i).padStart(2, "0");
  switch (slug) {
    case "item-library":
      return `${seed.toUpperCase()}-ITEM-${String(i).padStart(3, "0")}`;
    case "categories":
      return `C-${seed.toUpperCase()}-${n2}`;
    case "partners":
      return `${seed}${i} Sample Partner`;
    case "partner-groups":
      return `${seed}${i} Sample Group`;
    case "physical-inventory-serialized":
    case "physical-inventory-lot-serialized":
      return `${seed.toUpperCase()}-SN-${String(i).padStart(3, "0")}`;
    case "physical-inventory-non-serialized":
    case "physical-inventory-lot": {
      /* No unique key per row: a sample cycles through the tab's items. */
      const items = piItemsFor(piTab(slug)!.mode);
      return items[(i - 1) % items.length].partNumber;
    }
  }
}

/** One clean sample record: the template's first example row with a unique
 *  key, the module-shaped counterpart of the Users seeds' "Jul1 Sample". */
export function sampleRow(def: ModuleImportDef, seed: string, i: number): ModuleRow {
  const row: ModuleRow = {};
  for (const c of def.columns) row[c.key] = c.example;
  row[def.keyField] = sampleKey(def.slug, seed, i);
  return row;
}

function sampleRecords(def: ModuleImportDef, seed: string, count: number): ModuleRecord[] {
  return Array.from({ length: count }, (_, idx) => toModuleRecord(sampleRow(def, seed, idx + 1), idx + 1, "Created"));
}

/** The template's example row 1 with a case's cells applied. */
function caseRow(def: ModuleImportDef, values: Record<string, string>): ModuleRow {
  const row: ModuleRow = {};
  for (const c of def.columns) row[c.key] = values[c.key] ?? c.example;
  return row;
}

/** The June import: history entry plus records. Failed rows keep the live
 *  validator's error text as their stored message (the record page reads the
 *  live result first, so the two can only agree). */
export function buildFailedSeed(slug: ModuleImportSlug): { entry: CompletedImportEntry; records: ModuleRecord[] } {
  const def = MODULE_IMPORT_DEFS[slug];
  const copy = SEED_COPY[slug];
  const cases = FAILED_SEEDS[slug];
  const rows = cases.map((c) => caseRow(def, c.values));
  const result = def.validate(rows, def.buildContext());
  const records = cases.map((c, i) => {
    const errors = result.rows[i].issues.filter((x) => x.severity === "error").map((x) => x.message).join(" ");
    return toModuleRecord(rows[i], i + 1, c.outcome, c.outcome === "Failed" ? errors : undefined);
  });
  const importedCount = records.filter((r) => isImported(r._outcome)).length;
  return {
    entry: {
      id: `imp-${slug}-3`,
      moduleSlug: slug,
      name: `${copy.label} June update`,
      fileName: `${copy.stem}_June_2026.csv`,
      description: copy.june,
      dateISO: "2026-07-20T10:12:00.000Z",
      importerKey: "ra",
      recordCount: records.length,
      importedCount,
      failedCount: records.length - importedCount,
    },
    records,
  };
}

function buildSeeds(slug: ModuleImportSlug): { entry: CompletedImportEntry; records: ModuleRecord[] }[] {
  const def = MODULE_IMPORT_DEFS[slug];
  const copy = SEED_COPY[slug];
  return [
    buildFailedSeed(slug),
    {
      entry: {
        id: `imp-${slug}-1`,
        moduleSlug: slug,
        name: `${copy.label} July update`,
        fileName: `${copy.stem}_July_2026.csv`,
        description: copy.july,
        dateISO: "2026-07-12T09:24:00.000Z",
        importerKey: "sj",
        recordCount: 12,
        importedCount: 12,
        failedCount: 0,
      },
      records: sampleRecords(def, "Jul", 12),
    },
    {
      entry: {
        id: `imp-${slug}-2`,
        moduleSlug: slug,
        name: `${copy.label} initial load`,
        fileName: `${copy.stem}_Initial_2026.csv`,
        description: copy.initial,
        dateISO: "2026-06-28T14:05:00.000Z",
        importerKey: "ac",
        recordCount: 8,
        importedCount: 8,
        failedCount: 0,
      },
      records: sampleRecords(def, "Jun", 8),
    },
  ];
}

const seeded = new Set<string>();

/** Lay the module's three seeded imports down once per page load, with their
 *  record payloads, exactly like ensureSeededForLoad does for Users:
 *  append-only history, detail re-seeded under the stable ids. */
export function seedModuleImports(slug: ModuleImportSlug): void {
  /* A company from onboarding has imported nothing yet. */
  if (isNewTenant()) return;
  if (seeded.has(slug)) return;
  seeded.add(slug);
  const existingIds = new Set(getCompletedImports(slug).map((e) => e.id));
  for (const seed of buildSeeds(slug)) {
    if (!existingIds.has(seed.entry.id)) addCompletedImport(seed.entry);
    saveModuleImport({
      id: seed.entry.id,
      moduleSlug: slug,
      name: seed.entry.name,
      description: seed.entry.description,
      fileName: seed.entry.fileName ?? seed.entry.name,
      dateISO: seed.entry.dateISO,
      importerKey: seed.entry.importerKey,
      records: seed.records,
    });
  }
}
