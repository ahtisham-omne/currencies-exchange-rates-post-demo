/* Generic port of User Access Control importHistory + importDetailStore +
 * importRecords + pendingCorrections + correctionLink, keyed by
 * `spec.storageNamespace`:
 *   omne:<ns>:import-history               (array, newest first, wiped per page load)
 *   omne:<ns>:import-detail                (object by id, NOT wiped)
 *   omne:<ns>:import-pending-corrections   (object by import id, wiped per page load)
 * Two mock entries per entity are re-seeded lazily per page load. */

import type { EntitySpec, ImportRow } from "./spec";
import { normKey } from "./spec";

/* ───────────────────────── actors ───────────────────────── */

export type ImporterKey = "sj" | "ac" | "ra" | "am" | "aa";
export interface Importer {
  name: string;
  initials: string;
  bg: string;
  fg: string;
  role: string;
  email: string;
  phone: string;
  photoUrl?: string;
}
export const IMPORTERS: Record<ImporterKey, Importer> = {
  sj: { name: "Sarah Johnson", initials: "SJ", bg: "#EDF4FF", fg: "#0A77FF", role: "HR Manager", email: "sjohnson@omnesoft.com", phone: "+1 555-0142" },
  ac: { name: "Alex Chen", initials: "AC", bg: "#ECFDF5", fg: "#059669", role: "IT System Administrator", email: "achen@omnesoft.com", phone: "+1 555-0188" },
  ra: { name: "Rida Ahmad", initials: "RA", bg: "#FEF3C7", fg: "#D97706", role: "People Operations Lead", email: "rahmad@omnesoft.com", phone: "+1 555-0214" },
  am: { name: "Abdullah Malik", initials: "AM", bg: "#EDF4FF", fg: "#0A77FF", role: "Team Member", email: "amalik@omnesoft.com", phone: "+1 555-0100" },
  /* This module's signed-in user (data/currentUser.ts). */
  aa: { name: "Ahtisham Ahmad", initials: "AA", bg: "#EEF2FF", fg: "#6366F1", role: "Senior Product Designer", email: "ahtisham@omnesoft.com", phone: "(312) 555-0164", photoUrl: "/avatars/ahtisham-ahmad.jpg" },
};
/** The actor every real import is recorded under. */
export const CURRENT_IMPORTER_KEY: ImporterKey = "aa";
export function getImporter(key: string | undefined): Importer {
  return IMPORTERS[(key ?? "") as ImporterKey] ?? IMPORTERS[CURRENT_IMPORTER_KEY];
}

/* ───────────────────────── shapes ───────────────────────── */

export type RowOutcome = "Created" | "Skipped" | "Failed";
export type RowFilter = "all" | "imported" | "failed";

/** A stored row: the review row's columns plus bookkeeping. */
export interface ImportedRecord {
  [key: string]: string | number | undefined;
  _row: number;
  _outcome: RowOutcome;
  _message?: string;
}

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
  /** Set on correction child logs (tree is one level deep). */
  parentId?: string;
  correctionKind?: "inline" | "reimport";
}

export interface StoredImportDetail {
  id: string;
  moduleSlug: string;
  name: string;
  description?: string;
  dateISO: string;
  importerKey: ImporterKey;
  fileName: string;
  records: ImportedRecord[];
}

export interface PendingCorrection {
  importId: string;
  moduleSlug: string;
  fileName: string;
  rowCount: number;
  startedISO: string;
}

export interface ImportColumnDef {
  key: string;
  label: string;
  width: number;
  mono?: boolean;
}

export function isImported(o: RowOutcome): boolean {
  return o === "Created";
}
export function isFailed(o: RowOutcome): boolean {
  return o === "Failed" || o === "Skipped";
}

export const DOWNLOAD_META: Record<RowFilter, { downloadLabel: string; exportLabel: string; fileSuffix: string }> = {
  all: { downloadLabel: "Download All Records", exportLabel: "Export Selected Records", fileSuffix: "all" },
  imported: { downloadLabel: "Download Imported Records", exportLabel: "Export Selected Records", fileSuffix: "imported" },
  failed: { downloadLabel: "Fix Error Rows Manually", exportLabel: "Export Selected Records", fileSuffix: "failed" },
};

export function importNameToFilenameStem(name: string): string {
  return name.trim().replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "import";
}

/** Review row -> stored record. */
export function toImportedRecord(spec: EntitySpec<unknown>, row: ImportRow, rowNumber: number, outcome: RowOutcome, message?: string): ImportedRecord {
  const rec: ImportedRecord = { _row: rowNumber, _outcome: outcome };
  for (const c of spec.columns) rec[c.key] = row[c.key] ?? "";
  if (message) rec._message = message;
  return rec;
}

/** Stored record -> review row (bookkeeping stripped). */
export function recordToRow(spec: EntitySpec<unknown>, rec: ImportedRecord): ImportRow {
  const row: ImportRow = {};
  for (const c of spec.columns) row[c.key] = String(rec[c.key] ?? "");
  return row;
}

/** Detail-page column defs, derived from the spec (width in px from the template width). */
export function importRecordColumns(spec: EntitySpec<unknown>): ImportColumnDef[] {
  return spec.columns.map((c) => ({
    key: c.key,
    label: c.label,
    width: Math.round(((c.width ?? 14) * 7 + 20) / 10) * 10,
    mono: c.format === "email",
  }));
}

/* ───────────────────────── ids ───────────────────────── */

export function newImportId(): string {
  return `imp-${Date.now()}`;
}
export function fixChildId(parentId: string): string {
  return `${parentId}-fix-${Date.now()}`;
}
export function reimportChildId(parentId: string): string {
  return `${parentId}-reimport-${Date.now()}`;
}

/* ───────────────────────── storage primitives ───────────────────────── */

export function storageKeys(spec: EntitySpec<unknown>) {
  const ns = spec.storageNamespace;
  return {
    history: `omne:${ns}:import-history`,
    detail: `omne:${ns}:import-detail`,
    pending: `omne:${ns}:import-pending-corrections`,
    historyEvent: `omne:${ns}:import-history-changed`,
    pendingEvent: `omne:${ns}:pending-corrections-changed`,
  };
}

function storage(): Storage | null {
  try {
    return typeof window !== "undefined" && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}
function readJSON<T>(key: string, fallback: T): T {
  const s = storage();
  if (!s) return fallback;
  try {
    const raw = s.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeJSON(key: string, value: unknown): void {
  const s = storage();
  if (!s) return;
  try {
    s.setItem(key, JSON.stringify(value));
  } catch {
    /* quota / private mode: history is best effort */
  }
}
function emit(event: string): void {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(event));
}

/* Once per page load, per namespace: reset the two mock seed entries (they
 * are re-laid clean by ensureSeededForLoad) and clear pending corrections.
 * Imports the user made are KEPT, so a record page opened in a fresh tab or
 * reloaded still has its history entry next to its persisted detail. */
const wipedThisLoad = new Set<string>();
function ensureWipedForLoad(spec: EntitySpec<unknown>): void {
  if (wipedThisLoad.has(spec.storageNamespace)) return;
  wipedThisLoad.add(spec.storageNamespace);
  const k = storageKeys(spec);
  const seedIds = new Set(seedEntries(spec).map((s) => s.entry.id));
  const kept = readJSON<CompletedImportEntry[]>(k.history, []).filter((e) => !seedIds.has(e.id) && !(e.parentId && seedIds.has(e.parentId)));
  if (kept.length) writeJSON(k.history, kept);
  else storage()?.removeItem(k.history);
  storage()?.removeItem(k.pending);
}
/** Test hook: forget the per-load wipe so the next call starts fresh. */
export function __resetImportHistoryForTests(): void {
  wipedThisLoad.clear();
  seededThisLoad.clear();
}

/* ───────────────────────── history (listing) ───────────────────────── */

function readHistory(spec: EntitySpec<unknown>): CompletedImportEntry[] {
  ensureWipedForLoad(spec);
  return readJSON<CompletedImportEntry[]>(storageKeys(spec).history, []);
}
function writeHistory(spec: EntitySpec<unknown>, list: CompletedImportEntry[]): void {
  writeJSON(storageKeys(spec).history, list);
  emit(storageKeys(spec).historyEvent);
}

export function recordCompletedImport(spec: EntitySpec<unknown>, entry: CompletedImportEntry): void {
  const list = readHistory(spec).filter((e) => e.id !== entry.id);
  writeHistory(spec, [entry, ...list]);
}
/** UAC name for `recordCompletedImport`. */
export const addCompletedImport = recordCompletedImport;

export function addFixChildImport(spec: EntitySpec<unknown>, entry: CompletedImportEntry & { parentId: string }): void {
  recordCompletedImport(spec, entry);
}

export function getCompletedImportById(spec: EntitySpec<unknown>, id: string): CompletedImportEntry | undefined {
  return readHistory(spec).find((e) => e.id === id);
}

export function updateCompletedImportCounts(spec: EntitySpec<unknown>, id: string, counts: { importedCount: number; failedCount: number }): void {
  const list = readHistory(spec).map((e) => (e.id === id ? { ...e, ...counts } : e));
  writeHistory(spec, list);
}

/** Every entry for the entity (seeds included), newest first. */
export function listImports(spec: EntitySpec<unknown>): CompletedImportEntry[] {
  ensureSeededForLoad(spec);
  return readHistory(spec)
    .filter((e) => e.moduleSlug === spec.moduleSlug)
    .sort((a, b) => b.dateISO.localeCompare(a.dateISO));
}
/** UAC name. */
export const getCompletedImports = listImports;

export function subscribeToImportHistory(spec: EntitySpec<unknown>, cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const k = storageKeys(spec);
  const onStorage = (e: StorageEvent) => {
    if (e.key === k.history) cb();
  };
  window.addEventListener(k.historyEvent, cb);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(k.historyEvent, cb);
    window.removeEventListener("storage", onStorage);
  };
}

/* ───────────────────────── seeds ───────────────────────── */

const seededThisLoad = new Set<string>();

function seedRows(spec: EntitySpec<unknown>, count: number, seed: string): ImportedRecord[] {
  const rows: ImportedRecord[] = [];
  for (let i = 1; i <= count; i++) {
    const ex = spec.data.examples[(i - 1) % spec.data.examples.length];
    const row: ImportRow = {};
    spec.columns.forEach((c, ci) => {
      row[c.key] = ex[ci] ?? "";
    });
    row[spec.keyColumn] = `${seed} ${spec.entitySingular} ${i}`;
    rows.push(toImportedRecord(spec, row, i, "Created"));
  }
  return rows;
}

export function seedEntries(spec: EntitySpec<unknown>): { entry: CompletedImportEntry; detail: StoredImportDetail }[] {
  const stem = spec.entity.replace(/\s+/g, "_");
  const one: CompletedImportEntry = {
    id: `imp-${spec.moduleSlug}-1`,
    moduleSlug: spec.moduleSlug,
    name: `${spec.entity}, July update`,
    fileName: `${stem}_July_2026.csv`,
    description: `Monthly ${spec.nounPluralLower} update`,
    dateISO: "2026-07-12T09:24:00.000Z",
    importerKey: "sj",
    recordCount: 12,
    importedCount: 12,
    failedCount: 0,
  };
  const two: CompletedImportEntry = {
    id: `imp-${spec.moduleSlug}-2`,
    moduleSlug: spec.moduleSlug,
    name: `${spec.entity}, initial load`,
    fileName: `${stem}_Initial_2026.csv`,
    description: `Initial ${spec.nounPluralLower} data load`,
    dateISO: "2026-06-28T14:05:00.000Z",
    importerKey: "ac",
    recordCount: 8,
    importedCount: 8,
    failedCount: 0,
  };
  const detailOf = (e: CompletedImportEntry, seed: string, n: number): StoredImportDetail => ({
    id: e.id,
    moduleSlug: e.moduleSlug,
    name: e.name,
    description: e.description,
    dateISO: e.dateISO,
    importerKey: e.importerKey,
    fileName: e.fileName ?? `${e.name}.csv`,
    records: seedRows(spec, n, seed),
  });
  return [
    { entry: one, detail: detailOf(one, "Jul", 12) },
    { entry: two, detail: detailOf(two, "Jun", 8) },
  ];
}

export function ensureSeededForLoad(spec: EntitySpec<unknown>): void {
  if (seededThisLoad.has(spec.storageNamespace)) return;
  seededThisLoad.add(spec.storageNamespace);
  const existing = readHistory(spec);
  const ids = new Set(existing.map((e) => e.id));
  const additions: CompletedImportEntry[] = [];
  for (const { entry, detail } of seedEntries(spec)) {
    if (ids.has(entry.id)) continue;
    additions.push(entry);
    saveImportDetail(spec, detail);
  }
  if (additions.length) writeHistory(spec, [...existing, ...additions]);
}

/* ───────────────────────── detail store ───────────────────────── */

function readDetails(spec: EntitySpec<unknown>): Record<string, StoredImportDetail> {
  return readJSON<Record<string, StoredImportDetail>>(storageKeys(spec).detail, {});
}

export function saveImportDetail(spec: EntitySpec<unknown>, detail: StoredImportDetail): void {
  const all = readDetails(spec);
  all[detail.id] = detail;
  writeJSON(storageKeys(spec).detail, all);
}

export function loadImportDetail(spec: EntitySpec<unknown>, id: string): StoredImportDetail | null {
  return readDetails(spec)[id] ?? null;
}
/** UAC name. */
export const getImportDetail = loadImportDetail;

/* ───────────────────────── pending corrections ───────────────────────── */

function readPending(spec: EntitySpec<unknown>): Record<string, PendingCorrection> {
  ensureWipedForLoad(spec);
  return readJSON<Record<string, PendingCorrection>>(storageKeys(spec).pending, {});
}
function writePending(spec: EntitySpec<unknown>, all: Record<string, PendingCorrection>): void {
  writeJSON(storageKeys(spec).pending, all);
  emit(storageKeys(spec).pendingEvent);
}

export function startPendingCorrection(spec: EntitySpec<unknown>, entry: PendingCorrection): void {
  const all = readPending(spec);
  all[entry.importId] = entry;
  writePending(spec, all);
}
export function clearPendingCorrection(spec: EntitySpec<unknown>, importId: string): void {
  const all = readPending(spec);
  if (!(importId in all)) return;
  delete all[importId];
  writePending(spec, all);
}
export function getPendingCorrection(spec: EntitySpec<unknown>, importId: string): PendingCorrection | null {
  return readPending(spec)[importId] ?? null;
}
export function getPendingCorrections(spec: EntitySpec<unknown>): Record<string, PendingCorrection> {
  const all = readPending(spec);
  const out: Record<string, PendingCorrection> = {};
  for (const [k, v] of Object.entries(all)) if (v.moduleSlug === spec.moduleSlug) out[k] = v;
  return out;
}
export function subscribeToPendingCorrections(spec: EntitySpec<unknown>, cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const k = storageKeys(spec);
  const onStorage = (e: StorageEvent) => {
    if (e.key === k.pending) cb();
  };
  window.addEventListener(k.pendingEvent, cb);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(k.pendingEvent, cb);
    window.removeEventListener("storage", onStorage);
  };
}

/* ───────────────────────── correction link ───────────────────────── */

export interface ParentSnapshot {
  id: string;
  name: string;
  fileName: string;
  moduleSlug: string;
  rowStatus: Map<number, "failed" | "imported">;
  /** natural key (lower-cased) -> _row, first occurrence wins */
  keyToRow: Map<string, number>;
  failedCount: number;
}

export function loadParentSnapshot(spec: EntitySpec<unknown>, importId: string): ParentSnapshot | null {
  const detail = loadImportDetail(spec, importId);
  if (!detail) return null;
  const rowStatus = new Map<number, "failed" | "imported">();
  const keyToRow = new Map<string, number>();
  let failedCount = 0;
  for (const rec of detail.records) {
    const failed = isFailed(rec._outcome);
    rowStatus.set(rec._row, failed ? "failed" : "imported");
    if (failed) failedCount++;
    const k = normKey(String(rec[spec.keyColumn] ?? ""));
    if (k && !keyToRow.has(k)) keyToRow.set(k, rec._row);
  }
  return { id: detail.id, name: detail.name, fileName: detail.fileName, moduleSlug: detail.moduleSlug, rowStatus, keyToRow, failedCount };
}

export type CorrectionDetection =
  | { kind: "none" }
  | { kind: "linked"; parent: ParentSnapshot; confidence: "session" | "suggested" };

/** Suggest only when at least half of the uploaded keys hit a still-failing parent row. */
export const MIN_SUGGEST_RATIO = 0.5;

export function detectCorrectionTarget(
  spec: EntitySpec<unknown>,
  args: { sessionParentId?: string | null; rowKeys: string[] },
): CorrectionDetection {
  if (args.sessionParentId) {
    const parent = loadParentSnapshot(spec, args.sessionParentId);
    if (parent) return { kind: "linked", parent, confidence: "session" };
  }
  const keys = args.rowKeys.map(normKey).filter(Boolean);
  if (keys.length === 0) return { kind: "none" };
  const candidates = listImports(spec).filter((e) => !e.parentId && (e.failedCount ?? 0) > 0);
  let best: { parent: ParentSnapshot; overlap: number; dateISO: string } | null = null;
  for (const e of candidates) {
    const parent = loadParentSnapshot(spec, e.id);
    if (!parent) continue;
    let overlap = 0;
    for (const k of keys) {
      const row = parent.keyToRow.get(k);
      if (row !== undefined && parent.rowStatus.get(row) === "failed") overlap++;
    }
    if (overlap === 0) continue;
    if (!best || overlap > best.overlap || (overlap === best.overlap && e.dateISO > best.dateISO)) {
      best = { parent, overlap, dateISO: e.dateISO };
    }
  }
  if (best && best.overlap / keys.length >= MIN_SUGGEST_RATIO) {
    return { kind: "linked", parent: best.parent, confidence: "suggested" };
  }
  return { kind: "none" };
}

export type RowLinkBucket = "matched" | "resolved" | "new";
export interface RowLink {
  bucket: RowLinkBucket;
  parentRow: number | null;
}

export function linkRow(parent: ParentSnapshot, key: string): RowLink {
  const row = parent.keyToRow.get(normKey(key));
  if (row === undefined) return { bucket: "new", parentRow: null };
  return { bucket: parent.rowStatus.get(row) === "failed" ? "matched" : "resolved", parentRow: row };
}

/** Flip matched parent rows to Created with the corrected values; patch counts. */
export function applyCorrectionToParent(
  spec: EntitySpec<unknown>,
  parentId: string,
  resolved: { parentRow: number; values: ImportRow }[],
): { importedCount: number; failedCount: number } | null {
  const detail = loadImportDetail(spec, parentId);
  if (!detail || resolved.length === 0) return null;
  const byRow = new Map(resolved.map((r) => [r.parentRow, r.values]));
  let touched = false;
  const records = detail.records.map((rec) => {
    const values = byRow.get(rec._row);
    if (!values || !isFailed(rec._outcome)) return rec;
    touched = true;
    const next: ImportedRecord = { ...rec, _outcome: "Created" };
    for (const c of spec.columns) next[c.key] = values[c.key] ?? "";
    delete next._message;
    return next;
  });
  if (!touched) return null;
  saveImportDetail(spec, { ...detail, records });
  const importedCount = records.filter((r) => isImported(r._outcome)).length;
  const failedCount = records.length - importedCount;
  updateCompletedImportCounts(spec, parentId, { importedCount, failedCount });
  return { importedCount, failedCount };
}
