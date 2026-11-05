import { beforeEach, describe, expect, it } from "vitest";
import { emptyRow, PARTNER_GROUPS_IMPORT_SPEC, PARTNERS_IMPORT_SPEC } from "../spec";
import {
  __resetImportHistoryForTests,
  applyCorrectionToParent,
  clearPendingCorrection,
  detectCorrectionTarget,
  fixChildId,
  getCompletedImportById,
  getPendingCorrection,
  importNameToFilenameStem,
  importRecordColumns,
  linkRow,
  listImports,
  loadImportDetail,
  recordCompletedImport,
  reimportChildId,
  saveImportDetail,
  startPendingCorrection,
  storageKeys,
  toImportedRecord,
  updateCompletedImportCounts,
} from "../importHistory";

const P = PARTNERS_IMPORT_SPEC;
const G = PARTNER_GROUPS_IMPORT_SPEC;

beforeEach(() => {
  localStorage.clear();
  __resetImportHistoryForTests();
});

describe("storage keys", () => {
  it("are namespaced per entity", () => {
    expect(storageKeys(P)).toMatchObject({ history: "omne:partners:import-history", detail: "omne:partners:import-detail", pending: "omne:partners:import-pending-corrections" });
    expect(storageKeys(G).history).toBe("omne:partner-groups:import-history");
  });
});

describe("seeds + listing", () => {
  it("two seeded entries per entity with detail rows, newest first, no em dashes", () => {
    const p = listImports(P);
    expect(p.map((e) => e.id)).toEqual(["imp-partners-1", "imp-partners-2"]);
    expect(p[0]).toMatchObject({ importerKey: "sj", recordCount: 12, fileName: "Partners_July_2026.csv" });
    expect(loadImportDetail(P, "imp-partners-1")?.records).toHaveLength(12);
    expect(loadImportDetail(P, "imp-partners-2")?.records[0]._outcome).toBe("Created");
    expect(JSON.stringify(p)).not.toContain("—");
    const g = listImports(G);
    expect(g.map((e) => e.id)).toEqual(["imp-partner-groups-1", "imp-partner-groups-2"]);
    expect(localStorage.getItem("omne:partner-groups:import-history")).toBeTruthy();
    expect(JSON.parse(localStorage.getItem("omne:partners:import-history")!)).toHaveLength(2);
  });
  it("recordCompletedImport prepends, counts patch, detail round-trips", () => {
    recordCompletedImport(P, { id: "imp-1", moduleSlug: P.moduleSlug, name: "Q3", dateISO: "2026-09-29T10:00:00.000Z", importerKey: "aa", recordCount: 3, importedCount: 2, failedCount: 1 });
    expect(listImports(P)[0].id).toBe("imp-1");
    updateCompletedImportCounts(P, "imp-1", { importedCount: 3, failedCount: 0 });
    expect(getCompletedImportById(P, "imp-1")).toMatchObject({ importedCount: 3, failedCount: 0 });
    const row = { ...emptyRow(P), partnerName: "Acme" };
    saveImportDetail(P, { id: "imp-1", moduleSlug: P.moduleSlug, name: "Q3", dateISO: "x", importerKey: "aa", fileName: "q3.csv", records: [toImportedRecord(P, row, 1, "Failed", "boom")] });
    expect(loadImportDetail(P, "imp-1")?.records[0]).toMatchObject({ partnerName: "Acme", _row: 1, _outcome: "Failed", _message: "boom" });
    expect(loadImportDetail(G, "imp-1")).toBeNull();
  });
  it("a new page load keeps user imports and resets only the seeds", () => {
    listImports(P);
    recordCompletedImport(P, { id: "imp-new", moduleSlug: P.moduleSlug, name: "Q3", dateISO: "2026-09-30T10:00:00.000Z", importerKey: "aa", recordCount: 3, importedCount: 3, failedCount: 0 });
    updateCompletedImportCounts(P, "imp-partners-1", { importedCount: 1, failedCount: 11 });
    __resetImportHistoryForTests();
    const ids = listImports(P).map((e) => e.id);
    expect(ids).toEqual(["imp-new", "imp-partners-1", "imp-partners-2"]);
    expect(getCompletedImportById(P, "imp-partners-1")).toMatchObject({ importedCount: 12, failedCount: 0 });
  });
});

describe("helpers", () => {
  it("filename stem, child ids, record columns", () => {
    expect(importNameToFilenameStem("Q2 New Hires 2026")).toBe("Q2_New_Hires_2026");
    expect(importNameToFilenameStem("  ")).toBe("import");
    expect(fixChildId("imp-9")).toMatch(/^imp-9-fix-\d+$/);
    expect(reimportChildId("imp-9")).toMatch(/^imp-9-reimport-\d+$/);
    expect(importRecordColumns(P)[0]).toMatchObject({ key: "partnerName", label: "Partner Name" });
    expect(importRecordColumns(P).find((c) => c.key === "email")?.mono).toBe(true);
  });
});

describe("pending corrections", () => {
  it("start / get / clear", () => {
    startPendingCorrection(P, { importId: "imp-1", moduleSlug: P.moduleSlug, fileName: "x_failed.csv", rowCount: 2, startedISO: "now" });
    expect(getPendingCorrection(P, "imp-1")?.rowCount).toBe(2);
    clearPendingCorrection(P, "imp-1");
    expect(getPendingCorrection(P, "imp-1")).toBeNull();
  });
});

describe("correction detection", () => {
  function seedFailedParent() {
    recordCompletedImport(P, { id: "imp-p", moduleSlug: P.moduleSlug, name: "Parent", dateISO: "2026-09-01T00:00:00.000Z", importerKey: "aa", recordCount: 3, importedCount: 1, failedCount: 2 });
    saveImportDetail(P, {
      id: "imp-p", moduleSlug: P.moduleSlug, name: "Parent", dateISO: "x", importerKey: "aa", fileName: "parent.csv",
      records: [
        toImportedRecord(P, { ...emptyRow(P), partnerName: "Good Co" }, 1, "Created"),
        toImportedRecord(P, { ...emptyRow(P), partnerName: "Bad One" }, 2, "Failed", "err"),
        toImportedRecord(P, { ...emptyRow(P), partnerName: "Bad Two" }, 3, "Skipped", "err"),
      ],
    });
  }
  it("session parent id wins", () => {
    seedFailedParent();
    const d = detectCorrectionTarget(P, { sessionParentId: "imp-p", rowKeys: [] });
    expect(d).toMatchObject({ kind: "linked", confidence: "session" });
  });
  it("suggests on >= 50% key overlap with still-failing rows, otherwise none", () => {
    seedFailedParent();
    expect(detectCorrectionTarget(P, { rowKeys: ["bad one", "Bad Two", "New"] })).toMatchObject({ kind: "linked", confidence: "suggested" });
    expect(detectCorrectionTarget(P, { rowKeys: ["bad one", "a", "b", "c"] })).toEqual({ kind: "none" });
    expect(detectCorrectionTarget(P, { rowKeys: ["good co", "good co"] })).toEqual({ kind: "none" });
  });
  it("linkRow buckets and applyCorrectionToParent flips matched rows", () => {
    seedFailedParent();
    const d = detectCorrectionTarget(P, { sessionParentId: "imp-p", rowKeys: [] });
    if (d.kind !== "linked") throw new Error("expected linked");
    expect(linkRow(d.parent, "BAD ONE")).toEqual({ bucket: "matched", parentRow: 2 });
    expect(linkRow(d.parent, "good co")).toEqual({ bucket: "resolved", parentRow: 1 });
    expect(linkRow(d.parent, "nobody")).toEqual({ bucket: "new", parentRow: null });
    const res = applyCorrectionToParent(P, "imp-p", [{ parentRow: 2, values: { ...emptyRow(P), partnerName: "Bad One", email: "fixed@x.io" } }]);
    expect(res).toEqual({ importedCount: 2, failedCount: 1 });
    const rec = loadImportDetail(P, "imp-p")!.records[1];
    expect(rec).toMatchObject({ _outcome: "Created", email: "fixed@x.io" });
    expect(rec._message).toBeUndefined();
    expect(getCompletedImportById(P, "imp-p")).toMatchObject({ importedCount: 2, failedCount: 1 });
  });
});
