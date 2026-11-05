/* Import history data layer for Items: port of role-zen's importHistory.ts
 * + importDetailStore.ts + importRecords.ts + pendingCorrections.ts +
 * correctionLink.ts + importers.ts, namespaced under omne:items:*.
 *
 * Lifecycle: once per page load the two seed entries are reset (re-laid clean
 * by ensureSeededForLoad()) and the pending corrections are cleared; real
 * imports and every detail payload are kept in shared localStorage. So an
 * import survives a refresh or a fresh tab: its record page loads from the
 * detail store and the history list still shows it (the listing banner opens
 * the record in a new tab exactly like UAC). */

import { ITEM_REVIEW_COLUMNS, makeEmptyRow, normalizeKey, type ItemReviewField, type ItemReviewRow } from "./spec";
import { NOUNS, STORAGE_NAMESPACE } from "./spec.data.mjs";

/* ─── Keys ─── */

export const HISTORY_KEY = `omne:${STORAGE_NAMESPACE}:import-history`;
export const DETAIL_KEY = `omne:${STORAGE_NAMESPACE}:import-detail`;
export const PENDING_KEY = `omne:${STORAGE_NAMESPACE}:import-pending-corrections`;
export const PENDING_EVENT = `omne:${STORAGE_NAMESPACE}:pending-corrections-changed`;
export const MODULE_SLUG = NOUNS.moduleSlug;

/* ─── Actors ─── */

export type ImporterKey = "aa" | "sj" | "ac" | "ra" | "am";
export interface Importer {
  name: string;
  initials: string;
  bg: string;
  fg: string;
  role: string;
  email: string;
  phone: string;
}
export const IMPORTERS: Record<ImporterKey, Importer> = {
  aa: { name: "Ahtisham Ahmad", initials: "AA", bg: "#EDF4FF", fg: "#0A77FF", role: "Senior Product Designer", email: "aahmad@omnesoft.com", phone: "+1 555-0101" },
  sj: { name: "Sarah Johnson", initials: "SJ", bg: "#EDF4FF", fg: "#0A77FF", role: "HR Manager", email: "sjohnson@omnesoft.com", phone: "+1 555-0142" },
  ac: { name: "Alex Chen", initials: "AC", bg: "#ECFDF5", fg: "#059669", role: "IT System Administrator", email: "achen@omnesoft.com", phone: "+1 555-0188" },
  ra: { name: "Rida Ahmad", initials: "RA", bg: "#FEF3C7", fg: "#D97706", role: "People Operations Lead", email: "rahmad@omnesoft.com", phone: "+1 555-0214" },
  am: { name: "Abdullah Malik", initials: "AM", bg: "#EDF4FF", fg: "#0A77FF", role: "Team Member", email: "amalik@omnesoft.com", phone: "+1 555-0100" },
};
/** The actor real imports are recorded under (the module's current user). */
export const CURRENT_IMPORTER_KEY: ImporterKey = "aa";
export function getImporter(key: string): Importer {
  return IMPORTERS[key as ImporterKey] ?? IMPORTERS[CURRENT_IMPORTER_KEY];
}

/* ─── Records ─── */

export type RowOutcome = "Created" | "Updated" | "Skipped" | "Failed";
export type RowFilter = "all" | "imported" | "failed";

export type ImportedItemRow = ItemReviewRow & {
  _row: number;
  _outcome: RowOutcome;
  _message?: string;
};

export interface ImportColumn {
  key: ItemReviewField;
  label: string;
  width: number;
  mono?: boolean;
}
export const IMPORT_RECORD_COLUMNS: ImportColumn[] = ITEM_REVIEW_COLUMNS.map((c) => ({
  key: c.key,
  label: c.label,
  width: c.defaultWidth,
  mono: c.key === "partNumber",
}));

export function isImported(o: RowOutcome): boolean {
  return o === "Created" || o === "Updated";
}
export function isFailed(o: RowOutcome): boolean {
  return o === "Failed" || o === "Skipped";
}

export const DOWNLOAD_META: Record<RowFilter, { downloadLabel: string; exportLabel: string; fileSuffix: string }> = {
  all: { downloadLabel: "Download All Records", exportLabel: "Export Selected Records", fileSuffix: "all" },
  imported: { downloadLabel: "Download Imported Records", exportLabel: "Export Selected Records", fileSuffix: "imported" },
  failed: { downloadLabel: "Download/Upload Failed Rows", exportLabel: "Export Selected Records", fileSuffix: "failed" },
};

export function importNameToFilenameStem(name: string): string {
  return (
    name
      .trim()
      .replace(/[^A-Za-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "import"
  );
}

/** Build the stored record for a review row. */
export function toImportedItemRow(row: ItemReviewRow, index: number, outcome: RowOutcome, message?: string): ImportedItemRow {
  const out: ImportedItemRow = { ...makeEmptyRow(), ...row, _row: index, _outcome: outcome };
  if (message) out._message = message;
  return out;
}

/* ─── Storage helpers ─── */

function storage(): Storage | null {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}

function readJson<T>(key: string, fallback: T): T {
  const s = storage();
  if (!s) return fallback;
  try {
    const raw = s.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  const s = storage();
  if (!s) return;
  try {
    s.setItem(key, JSON.stringify(value));
  } catch {
    /* quota or private mode: history is best-effort */
  }
}

/* ─── History (listing store) ─── */

export interface CompletedImportEntry {
  id: string;
  moduleSlug: string;
  name: string;
  fileName?: string;
  description?: string;
  dateISO: string;
  importerKey: ImporterKey;
  recordCount: number;
  importedCount?: number;
  failedCount?: number;
  /** Set on correction child logs (the tree is one level deep). */
  parentId?: string;
  correctionKind?: "inline" | "reimport";
}

function readHistory(): CompletedImportEntry[] {
  return readJson<CompletedImportEntry[]>(HISTORY_KEY, []);
}
function writeHistory(list: CompletedImportEntry[]): void {
  writeJson(HISTORY_KEY, list);
}

/** Newest first. Record a top-level import, or a correction child when `parentId` is set. */
export function recordCompletedImport(entry: CompletedImportEntry): CompletedImportEntry {
  writeHistory([entry, ...readHistory().filter((e) => e.id !== entry.id)]);
  return entry;
}
export const addCompletedImport = recordCompletedImport;
export function addFixChildImport(entry: CompletedImportEntry & { parentId: string }): CompletedImportEntry {
  return recordCompletedImport(entry);
}

export function getCompletedImportById(id: string): CompletedImportEntry | null {
  return readHistory().find((e) => e.id === id) ?? null;
}

export function updateCompletedImportCounts(id: string, counts: { importedCount: number; failedCount: number }): void {
  writeHistory(readHistory().map((e) => (e.id === id ? { ...e, ...counts } : e)));
}

/** Every import of the module (seeds included), newest first. */
export function listImports(moduleSlug: string = MODULE_SLUG): CompletedImportEntry[] {
  ensureSeededForLoad(moduleSlug);
  return readHistory().filter((e) => e.moduleSlug === moduleSlug);
}
export const getCompletedImports = listImports;

/** Child logs (inline fixes / re-imports) of a parent import, newest first. */
export function listChildImports(parentId: string): CompletedImportEntry[] {
  return readHistory().filter((e) => e.parentId === parentId);
}

/* ─── Detail payloads ─── */

export interface StoredImportDetail {
  id: string;
  moduleSlug: string;
  name: string;
  description?: string;
  dateISO: string;
  importerKey: ImporterKey;
  fileName: string;
  records: ImportedItemRow[];
}

export function saveImportDetail(detail: StoredImportDetail): void {
  const all = readJson<Record<string, StoredImportDetail>>(DETAIL_KEY, {});
  all[detail.id] = detail;
  writeJson(DETAIL_KEY, all);
}

export function loadImportDetail(id: string): StoredImportDetail | null {
  return readJson<Record<string, StoredImportDetail>>(DETAIL_KEY, {})[id] ?? null;
}
export const getImportDetail = loadImportDetail;

/* ─── Pending corrections ─── */

export interface PendingCorrection {
  importId: string;
  moduleSlug: string;
  fileName: string;
  rowCount: number;
  startedISO: string;
}

function readPending(): Record<string, PendingCorrection> {
  return readJson<Record<string, PendingCorrection>>(PENDING_KEY, {});
}
function notifyPending(): void {
  if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
    window.dispatchEvent(new CustomEvent(PENDING_EVENT));
  }
}

export function startPendingCorrection(entry: PendingCorrection): void {
  const all = readPending();
  all[entry.importId] = entry;
  writeJson(PENDING_KEY, all);
  notifyPending();
}
export function clearPendingCorrection(importId: string): void {
  const all = readPending();
  if (!(importId in all)) return;
  delete all[importId];
  writeJson(PENDING_KEY, all);
  notifyPending();
}
export function getPendingCorrection(importId: string): PendingCorrection | null {
  return readPending()[importId] ?? null;
}
export function getPendingCorrections(moduleSlug: string = MODULE_SLUG): Record<string, PendingCorrection> {
  const out: Record<string, PendingCorrection> = {};
  for (const [id, p] of Object.entries(readPending())) if (p.moduleSlug === moduleSlug) out[id] = p;
  return out;
}
export function subscribeToPendingCorrections(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => {
    if (e.key === PENDING_KEY) cb();
  };
  window.addEventListener(PENDING_EVENT, cb);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(PENDING_EVENT, cb);
    window.removeEventListener("storage", onStorage);
  };
}

/* ─── Correction linking ─── */

export interface ParentSnapshot {
  id: string;
  name: string;
  fileName: string;
  moduleSlug: string;
  rowStatus: Map<number, "failed" | "imported">;
  /** normalised part number -> _row, first occurrence wins */
  keyToRow: Map<string, number>;
  failedCount: number;
}

export function loadParentSnapshot(importId: string): ParentSnapshot | null {
  const detail = loadImportDetail(importId);
  if (!detail) return null;
  const rowStatus = new Map<number, "failed" | "imported">();
  const keyToRow = new Map<string, number>();
  let failedCount = 0;
  for (const rec of detail.records) {
    const failed = isFailed(rec._outcome);
    rowStatus.set(rec._row, failed ? "failed" : "imported");
    if (failed) failedCount++;
    const k = normalizeKey(rec.partNumber);
    if (k && !keyToRow.has(k)) keyToRow.set(k, rec._row);
  }
  return { id: detail.id, name: detail.name, fileName: detail.fileName, moduleSlug: detail.moduleSlug, rowStatus, keyToRow, failedCount };
}

export type CorrectionDetection =
  | { kind: "linked"; parent: ParentSnapshot; confidence: "session" | "suggested" }
  | { kind: "none" };

/** Suggest a link only when at least half the uploaded keys hit still-failing parent rows. */
export const MIN_SUGGEST_RATIO = 0.5;

export function detectCorrectionTarget(args: {
  moduleSlug?: string;
  sessionParentId?: string | null;
  rowKeys: string[];
  loadSnapshot?: (id: string) => ParentSnapshot | null;
}): CorrectionDetection {
  const moduleSlug = args.moduleSlug ?? MODULE_SLUG;
  const load = args.loadSnapshot ?? loadParentSnapshot;
  if (args.sessionParentId) {
    const parent = load(args.sessionParentId);
    if (parent) return { kind: "linked", parent, confidence: "session" };
  }
  const keys = args.rowKeys.map(normalizeKey).filter(Boolean);
  if (keys.length === 0) return { kind: "none" };
  const candidates = readHistory().filter((e) => e.moduleSlug === moduleSlug && !e.parentId && (e.failedCount ?? 0) > 0);
  let best: { parent: ParentSnapshot; overlap: number; dateISO: string } | null = null;
  for (const c of candidates) {
    const parent = load(c.id);
    if (!parent) continue;
    let overlap = 0;
    for (const k of keys) {
      const row = parent.keyToRow.get(k);
      if (row !== undefined && parent.rowStatus.get(row) === "failed") overlap++;
    }
    if (overlap === 0) continue;
    if (!best || overlap > best.overlap || (overlap === best.overlap && c.dateISO > best.dateISO)) {
      best = { parent, overlap, dateISO: c.dateISO };
    }
  }
  if (best && best.overlap / keys.length >= MIN_SUGGEST_RATIO) {
    return { kind: "linked", parent: best.parent, confidence: "suggested" };
  }
  return { kind: "none" };
}

export type LinkBucket = "matched" | "resolved" | "new";

export function linkRow(parent: ParentSnapshot, key: string): { bucket: LinkBucket; parentRow: number | null } {
  const row = parent.keyToRow.get(normalizeKey(key));
  if (row === undefined) return { bucket: "new", parentRow: null };
  return { bucket: parent.rowStatus.get(row) === "failed" ? "matched" : "resolved", parentRow: row };
}

/** Flip matched parent rows to the corrected values and outcome; patch counts. */
export function applyCorrectionToParent(
  parentId: string,
  resolved: { parentRow: number; values: ItemReviewRow; outcome?: RowOutcome }[],
): StoredImportDetail | null {
  const detail = loadImportDetail(parentId);
  if (!detail || resolved.length === 0) return null;
  const byRow = new Map(resolved.map((r) => [r.parentRow, r]));
  const records = detail.records.map((rec) => {
    const fix = byRow.get(rec._row);
    if (!fix || !isFailed(rec._outcome)) return rec;
    const next: ImportedItemRow = { ...rec, ...fix.values, _outcome: fix.outcome ?? "Created" };
    delete next._message;
    return next;
  });
  const updated: StoredImportDetail = { ...detail, records };
  saveImportDetail(updated);
  const importedCount = records.filter((r) => isImported(r._outcome)).length;
  const failedCount = records.filter((r) => isFailed(r._outcome)).length;
  updateCompletedImportCounts(parentId, { importedCount, failedCount });
  return updated;
}

/* ─── Ids ─── */

export function newImportId(now: number = Date.now()): string {
  return `imp-${now}`;
}
export function reimportChildId(parentId: string, now: number = Date.now()): string {
  return `${parentId}-reimport-${now}`;
}
export function inlineFixChildId(parentId: string, now: number = Date.now()): string {
  return `${parentId}-fix-${now}`;
}

/* ─── Seeds ─── */

const seededModules = new Set<string>();

function mockRow(seed: string, i: number, outcome: RowOutcome = "Created"): ImportedItemRow {
  const row = makeEmptyRow();
  row.partNumber = `${seed}-${String(i).padStart(3, "0")}`;
  row.description = `${seed} sample item ${i}`;
  row.status = "Active";
  row.primaryCategory = `C-${1001 + ((i - 1) % 10)}`;
  row.inventoryType = "Stock";
  row.inventoryControlType = i % 4 === 0 ? "Serialized" : "Non-Serialized";
  row.lotControl = i % 3 === 0 ? "Yes" : "No";
  row.unit = "Each";
  row.acquisitionMethods = "Purchased";
  row.inboundLocations = "Warehouse A - Main Hall";
  row.outboundLocations = "Warehouse A - Main Hall";
  return toImportedItemRow(row, i, outcome);
}

export function seedEntries(moduleSlug: string = MODULE_SLUG): { entry: CompletedImportEntry; detail: StoredImportDetail }[] {
  const title = NOUNS.titlePlural;
  const first: CompletedImportEntry = {
    id: `imp-${moduleSlug}-1`,
    moduleSlug,
    name: `${title}, July update`,
    fileName: `${title}_July_2026.csv`,
    description: `Monthly ${NOUNS.plural} update`,
    dateISO: "2026-07-12T09:24:00.000Z",
    importerKey: "sj",
    recordCount: 12,
    importedCount: 11,
    failedCount: 1,
  };
  const second: CompletedImportEntry = {
    id: `imp-${moduleSlug}-2`,
    moduleSlug,
    name: `${title}, initial load`,
    fileName: `${title}_Initial_2026.csv`,
    description: `Initial ${NOUNS.plural} data load`,
    dateISO: "2026-06-28T14:05:00.000Z",
    importerKey: "ac",
    recordCount: 8,
    importedCount: 8,
    failedCount: 0,
  };
  const firstRecords = Array.from({ length: 12 }, (_, i) => mockRow("JUL", i + 1));
  firstRecords[11] = { ...firstRecords[11], _outcome: "Failed", primaryCategory: "C-2099", _message: 'Category "C-2099" doesn\'t exist in Omne. Enter a category code from the Valid Values sheet, such as C-1004.' };
  const secondRecords = Array.from({ length: 8 }, (_, i) => mockRow("JUN", i + 1));
  const detailOf = (e: CompletedImportEntry, records: ImportedItemRow[]): StoredImportDetail => ({
    id: e.id,
    moduleSlug: e.moduleSlug,
    name: e.name,
    description: e.description,
    dateISO: e.dateISO,
    importerKey: e.importerKey,
    fileName: e.fileName ?? "",
    records,
  });
  return [
    { entry: first, detail: detailOf(first, firstRecords) },
    { entry: second, detail: detailOf(second, secondRecords) },
  ];
}

/** Append the two mock imports once per page load (id-guarded). */
export function ensureSeededForLoad(moduleSlug: string = MODULE_SLUG): void {
  if (seededModules.has(moduleSlug)) return;
  seededModules.add(moduleSlug);
  const list = readHistory();
  const ids = new Set(list.map((e) => e.id));
  const additions: CompletedImportEntry[] = [];
  for (const { entry, detail } of seedEntries(moduleSlug)) {
    if (ids.has(entry.id)) continue;
    additions.push(entry);
    saveImportDetail(detail);
  }
  if (additions.length > 0) writeHistory([...list, ...additions]);
}

/** Test hook: forget the seed guard and clear the per-load stores. */
export function resetHistoryForTests(): void {
  seededModules.clear();
  const s = storage();
  if (!s) return;
  s.removeItem(HISTORY_KEY);
  s.removeItem(PENDING_KEY);
  s.removeItem(DETAIL_KEY);
}

/* Once per page load, reset only the two seed imports (and any correction
 * children hanging off them) so ensureSeededForLoad lays them down clean.
 * Real imports stay in shared localStorage, so a record page opened fresh or
 * reloaded still has its history entry. Pending corrections reset per load. */
(() => {
  const s = storage();
  if (!s) return;
  const seedIds = new Set([`imp-${MODULE_SLUG}-1`, `imp-${MODULE_SLUG}-2`]);
  writeHistory(readHistory().filter((e) => !seedIds.has(e.id) && !(e.parentId && seedIds.has(e.parentId))));
  s.removeItem(PENDING_KEY);
})();
