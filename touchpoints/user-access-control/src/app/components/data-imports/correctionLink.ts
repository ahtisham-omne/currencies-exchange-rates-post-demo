/* Deciding whether an upload is a correction, and reconciling it back.
 *
 * Two signals, tried in order, neither of which touches the uploaded file:
 *
 *   1. Session context the admin launched the upload from an import's own
 *                      page, so the parent is known regardless of the file.
 *   2. Key matching    no launching import (the generic Import button), but
 *                      the rows line up with an import that still has
 *                      failures. Offered as a suggestion the admin confirms,
 *                      never auto-applied.
 *
 * Deliberately nothing is written into or read out of the file itself. An
 * earlier version stamped provenance columns onto the error download and read
 * them back on upload, which bought exact row identity but put new machinery
 * in the upload path. For a prototype that is a bad trade: an import that
 * refuses a file is far worse than a correction that occasionally links by
 * name instead of by row number.
 *
 * Either way the link is always shown and always reversible in the review
 * modal. An inferred parent the admin can neither see nor undo would be worse
 * than no link at all.
 *
 * Nesting the child log under the parent is the easy half. The half that
 * keeps the two correction flows honest is flipping the parent rows that were
 * fixed from Failed to Imported, so the listing's "5 failed" chip stops
 * lying. That is what the natural key resolves here. */

import { getCompletedImports, updateCompletedImportCounts } from "./importHistory";
import { getImportDetail, saveImportDetail } from "./importDetailStore";
import { getRolesImportDetail, saveRolesImportDetail } from "./rolesImportDetailStore";
import { isFailed, isImported, type ImportedUserRow } from "./importRecords";
import type { ImportedRoleRow } from "./rolesImportRecords";

/* ────────────────────────────────────
   Parent snapshot
   ──────────────────────────────────── */

/** Everything the correction flow needs to know about a candidate parent,
 *  flattened out of whichever module's detail store owns it. */
export interface ParentSnapshot {
  id: string;
  /** Display name of the import. */
  name: string;
  /** The file the parent was originally imported from. */
  fileName: string;
  moduleSlug: string;
  /** `_row` → whether that row is still failing on the parent. */
  rowStatus: Map<number, "failed" | "imported">;
  /** Natural key (lowercased email / role name) → the first `_row` carrying
   *  it. This is how an uploaded row finds the parent row it closes out. */
  keyToRow: Map<string, number>;
  /** How many rows are still failing right now. */
  failedCount: number;
}

export type SnapshotLoader = (importId: string) => ParentSnapshot | null;

export function buildSnapshot(
  id: string,
  name: string,
  fileName: string,
  moduleSlug: string,
  records: { _row: number; _outcome: ImportedUserRow["_outcome"] }[],
  keyOf: (index: number) => string,
): ParentSnapshot {
  const rowStatus = new Map<number, "failed" | "imported">();
  const keyToRow = new Map<string, number>();
  let failedCount = 0;

  records.forEach((r, i) => {
    if (isFailed(r._outcome)) {
      rowStatus.set(r._row, "failed");
      failedCount++;
    } else if (isImported(r._outcome)) {
      rowStatus.set(r._row, "imported");
    }
    const key = keyOf(i);
    /* First occurrence wins, a duplicated email in the source file should
     * resolve to the row the admin sees first, not the last one. */
    if (key && !keyToRow.has(key)) keyToRow.set(key, r._row);
  });

  return { id, name, fileName, moduleSlug, rowStatus, keyToRow, failedCount };
}

/** Snapshot loader for the Users-shaped detail store. */
export function loadUsersParentSnapshot(importId: string): ParentSnapshot | null {
  const detail = getImportDetail(importId);
  if (!detail) return null;
  return buildSnapshot(
    detail.id,
    detail.name,
    detail.fileName,
    detail.moduleSlug,
    detail.records,
    (i) => (detail.records[i]?.emailAddress ?? "").trim().toLowerCase(),
  );
}

/** Snapshot loader for the Roles-shaped detail store. */
export function loadRolesParentSnapshot(importId: string): ParentSnapshot | null {
  const detail = getRolesImportDetail(importId);
  if (!detail) return null;
  return buildSnapshot(
    detail.id,
    detail.name,
    detail.fileName,
    detail.moduleSlug,
    detail.records,
    (i) => (detail.records[i]?.roleName ?? "").trim().toLowerCase(),
  );
}

/* ────────────────────────────────────
   Detection
   ──────────────────────────────────── */

export type CorrectionConfidence = "session" | "suggested";

export type CorrectionDetection =
  | { kind: "linked"; parent: ParentSnapshot; confidence: CorrectionConfidence }
  | { kind: "none" };

/** Share of uploaded rows that must line up with a candidate's still-failing
 *  rows before we're willing to even suggest the link. Deliberately strict:
 *  a wrong suggestion costs more trust than a missed one. */
const MIN_SUGGEST_RATIO = 0.5;

export function detectCorrectionTarget({
  moduleSlug,
  sessionParentId,
  rowKeys,
  loadSnapshot,
}: {
  moduleSlug: string;
  /** Parent implied by where the upload was launched from, null for the
   *  generic Import button. */
  sessionParentId: string | null;
  /** Natural key per uploaded row, positionally aligned with the rows. */
  rowKeys: string[];
  loadSnapshot: SnapshotLoader;
}): CorrectionDetection {
  /* Signal 1, session context. */
  if (sessionParentId) {
    const parent = loadSnapshot(sessionParentId);
    if (parent) return { kind: "linked", parent, confidence: "session" };
  }

  /* Signal 2, key matching. Only top-level imports that still have failures
   * are candidates; a clean import has nothing to correct, and a child log
   * can never be a parent (the tree stays one level deep). */
  const keys = rowKeys.filter(Boolean);
  if (keys.length === 0) return { kind: "none" };

  let best: { parent: ParentSnapshot; overlap: number; dateISO: string } | null = null;
  for (const entry of getCompletedImports(moduleSlug)) {
    if (entry.parentId) continue;
    if ((entry.failedCount ?? 0) === 0) continue;
    const parent = loadSnapshot(entry.id);
    if (!parent || parent.failedCount === 0) continue;

    let overlap = 0;
    for (const key of keys) {
      const row = parent.keyToRow.get(key);
      if (row !== undefined && parent.rowStatus.get(row) === "failed") overlap++;
    }
    if (overlap === 0) continue;
    if (
      !best ||
      overlap > best.overlap ||
      (overlap === best.overlap && entry.dateISO > best.dateISO)
    ) {
      best = { parent, overlap, dateISO: entry.dateISO };
    }
  }

  if (best && best.overlap / keys.length >= MIN_SUGGEST_RATIO) {
    return { kind: "linked", parent: best.parent, confidence: "suggested" };
  }
  return { kind: "none" };
}

/* ────────────────────────────────────
   Row reconciliation
   ──────────────────────────────────── */

export type RowBucket =
  /** Lines up, by natural key, with a row that is still failing on the
   *  parent. Importing it closes that row out. */
  | "matched"
  /** Lines up with a parent row that has already been fixed, inline or by
   *  an earlier correction. Importing it again is harmless (the email
   *  matches an existing user, so it patches rather than duplicates) but it
   *  inflates the correction's numbers, so it's surfaced and offered up for
   *  removal. */
  | "resolved"
  /** No counterpart on the parent. Rows the admin pasted in. Imported as
   *  new records, counted separately so the audit trail stays honest. */
  | "new";

export interface RowLink {
  bucket: RowBucket;
  /** The parent `_row` this upload row closes out, when there is one. */
  parentRow: number | null;
}

/** Resolve one uploaded row against the parent by its natural key (email for
 *  users, role name for roles). "new" when it matches nothing.
 *
 *  The known limit: a row whose key was itself the thing that was broken (a
 *  malformed email, say) will not match once the admin fixes it, so it
 *  imports as a new record rather than closing out its original row. It still
 *  imports, and the correction is still nested under the parent, which is the
 *  right trade for keeping the upload path untouched. */
export function linkRow(parent: ParentSnapshot, key: string): RowLink {
  let parentRow: number | null = null;
  if (key) {
    const viaKey = parent.keyToRow.get(key);
    if (viaKey !== undefined) parentRow = viaKey;
  }
  if (parentRow === null) return { bucket: "new", parentRow: null };
  return {
    bucket: parent.rowStatus.get(parentRow) === "failed" ? "matched" : "resolved",
    parentRow,
  };
}

export interface BucketCounts {
  matched: number;
  resolved: number;
  new: number;
}

export function countBuckets(links: RowLink[]): BucketCounts {
  const out: BucketCounts = { matched: 0, resolved: 0, new: 0 };
  for (const l of links) out[l.bucket]++;
  return out;
}

/* ────────────────────────────────────
   Applying a correction to the parent
   ──────────────────────────────────── */

/** One parent row closed out by a correction, carrying the corrected values
 *  so the parent's record reflects what actually imported. */
export interface ResolvedParentRow<Values> {
  parentRow: number;
  values: Values;
}

export interface ParentCounts {
  importedCount: number;
  failedCount: number;
}

export function applyToRecords<Rec extends { _row: number; _outcome: ImportedUserRow["_outcome"]; _message?: string }, Values>(
  records: Rec[],
  resolved: ResolvedParentRow<Values>[],
): { records: Rec[]; resolvedCount: number } {
  const byRow = new Map<number, Values>();
  for (const r of resolved) byRow.set(r.parentRow, r.values);

  let resolvedCount = 0;
  const next = records.map((rec) => {
    if (!isFailed(rec._outcome)) return rec;
    const values = byRow.get(rec._row);
    if (values === undefined) return rec;
    resolvedCount++;
    /* Same shape the inline fix flow commits: corrected values applied, the
     * outcome flipped to Created, and the stale error message cleared. */
    return { ...rec, ...values, _outcome: "Created" as const, _message: undefined };
  });

  return { records: next, resolvedCount };
}

/** Fold a Users correction back into its parent: flip the resolved rows to
 *  Imported, re-save the detail payload, and patch the listing chips. No-op
 *  (returns null) when the parent is gone or nothing actually resolved. */
export function applyUsersCorrectionToParent(
  parentId: string,
  resolved: ResolvedParentRow<Omit<ImportedUserRow, "_row" | "_outcome" | "_message">>[],
): ParentCounts | null {
  const detail = getImportDetail(parentId);
  if (!detail) return null;

  const { records, resolvedCount } = applyToRecords(detail.records, resolved);
  if (resolvedCount === 0) return null;

  saveImportDetail({ ...detail, records });
  const counts: ParentCounts = {
    importedCount: records.filter((r) => isImported(r._outcome)).length,
    failedCount: records.filter((r) => isFailed(r._outcome)).length,
  };
  updateCompletedImportCounts(parentId, counts);
  return counts;
}

/** Roles counterpart of applyUsersCorrectionToParent. */
export function applyRolesCorrectionToParent(
  parentId: string,
  resolved: ResolvedParentRow<Omit<ImportedRoleRow, "_row" | "_outcome" | "_message">>[],
): ParentCounts | null {
  const detail = getRolesImportDetail(parentId);
  if (!detail) return null;

  const { records, resolvedCount } = applyToRecords(detail.records, resolved);
  if (resolvedCount === 0) return null;

  saveRolesImportDetail({ ...detail, records });
  const counts: ParentCounts = {
    importedCount: records.filter((r) => isImported(r._outcome)).length,
    failedCount: records.filter((r) => isFailed(r._outcome)).length,
  };
  updateCompletedImportCounts(parentId, counts);
  return counts;
}
