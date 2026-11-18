/* Guards the download-fix-reupload loop.
 *
 * Nothing here touches the uploaded file: the correction flow deliberately
 * reads no metadata out of the spreadsheet and writes none into it, so the
 * import path behaves exactly as it did before the feature existed. What is
 * pinned instead is the linking (which import a correction belongs to) and
 * the write-back (which of that import's rows it closes out, so the listing's
 * failed chip stops lying).
 *
 * Fails when a correction stops nesting under its parent, when detection
 * starts guessing too eagerly, or when reconciliation closes out rows it
 * shouldn't. */
import { describe, it, expect, beforeEach } from "vitest";
import {
  detectCorrectionTarget,
  loadUsersParentSnapshot,
  linkRow,
  countBuckets,
  applyUsersCorrectionToParent,
} from "../app/components/data-imports/correctionLink";
import { saveImportDetail, getImportDetail } from "../app/components/data-imports/importDetailStore";
import { addCompletedImport, getCompletedImportById } from "../app/components/data-imports/importHistory";
import type { ImportedUserRow } from "../app/components/data-imports/importRecords";

const PARENT_ID = "imp-test-parent";
const MODULE = "users";

function userRow(over: Partial<ImportedUserRow> & { _row: number }): ImportedUserRow {
  return {
    firstName: "Ada",
    lastName: "Lovelace",
    emailAddress: `ada${over._row}@omnesoft.com`,
    licenseType: "Full Access",
    employeeStatus: "Active",
    assignedRoles: "",
    username: "",
    gender: "",
    dateOfBirth: "",
    preferredName: "",
    pronouns: "",
    jobTitle: "Analyst",
    personalEmail: "",
    mobile: "",
    workPhone: "",
    homeAddress: "",
    workAddress: "",
    _outcome: "Created",
    ...over,
  };
}

/* Three imported rows and two failures. Row 4's email is intact (only its
 * licence is wrong), row 5's is not, which is the case key matching cannot
 * follow through a fix. */
function seedParent(): void {
  const records: ImportedUserRow[] = [
    userRow({ _row: 1 }),
    userRow({ _row: 2 }),
    userRow({ _row: 3 }),
    userRow({ _row: 4, emailAddress: "bea@omnesoft.com", licenseType: "Platinum", _outcome: "Failed", _message: "License is not recognised." }),
    userRow({ _row: 5, emailAddress: "not-an-email", _outcome: "Failed", _message: "Email is not valid." }),
  ];
  saveImportDetail({
    id: PARENT_ID,
    moduleSlug: MODULE,
    name: "Q2 New Hires",
    description: "",
    fileName: "Q2_New_Hires.csv",
    dateISO: "2026-08-01T10:00:00.000Z",
    importerKey: "am",
    records,
  });
  addCompletedImport({
    id: PARENT_ID,
    moduleSlug: MODULE,
    name: "Q2 New Hires",
    fileName: "Q2_New_Hires.csv",
    dateISO: "2026-08-01T10:00:00.000Z",
    importerKey: "am",
    recordCount: 5,
    importedCount: 3,
    failedCount: 2,
  });
}

beforeEach(() => {
  window.localStorage.clear();
  seedParent();
});

/* ────────────────────────────────────
   Detection
   ──────────────────────────────────── */

describe("correction detection", () => {
  const keys = ["bea@omnesoft.com", "not-an-email"];

  it("links to the import the upload was launched from", () => {
    const result = detectCorrectionTarget({
      moduleSlug: MODULE,
      sessionParentId: PARENT_ID,
      rowKeys: [],
      loadSnapshot: loadUsersParentSnapshot,
    });
    expect(result.kind).toBe("linked");
    if (result.kind !== "linked") return;
    expect(result.confidence).toBe("session");
    expect(result.parent.id).toBe(PARENT_ID);
  });

  it("suggests a parent from the rows alone", () => {
    const result = detectCorrectionTarget({
      moduleSlug: MODULE,
      sessionParentId: null,
      rowKeys: keys,
      loadSnapshot: loadUsersParentSnapshot,
    });
    expect(result.kind).toBe("linked");
    if (result.kind !== "linked") return;
    /* A guess, so the review modal leaves it unlinked until confirmed. */
    expect(result.confidence).toBe("suggested");
  });

  it("does not guess when the rows barely overlap", () => {
    const result = detectCorrectionTarget({
      moduleSlug: MODULE,
      sessionParentId: null,
      rowKeys: ["nobody@example.com", "someone@example.com", "other@example.com", "bea@omnesoft.com"],
      loadSnapshot: loadUsersParentSnapshot,
    });
    expect(result.kind).toBe("none");
  });

  it("ignores imports with nothing left to correct", () => {
    /* Same rows, but the parent is clean now: there is no correction to be
     * a correction of. */
    const detail = getImportDetail(PARENT_ID)!;
    saveImportDetail({
      ...detail,
      records: detail.records.map((r) => ({ ...r, _outcome: "Created" as const, _message: undefined })),
    });
    const result = detectCorrectionTarget({
      moduleSlug: MODULE,
      sessionParentId: null,
      rowKeys: keys,
      loadSnapshot: loadUsersParentSnapshot,
    });
    expect(result.kind).toBe("none");
  });

  it("finds nothing in a module with no imports", () => {
    const result = detectCorrectionTarget({
      moduleSlug: "roles",
      sessionParentId: null,
      rowKeys: keys,
      loadSnapshot: loadUsersParentSnapshot,
    });
    expect(result.kind).toBe("none");
  });
});

/* ────────────────────────────────────
   Reconciliation
   ──────────────────────────────────── */

describe("row reconciliation", () => {
  it("buckets rows by what they do to the parent", () => {
    const parent = loadUsersParentSnapshot(PARENT_ID)!;
    const links = [
      linkRow(parent, "bea@omnesoft.com"),      // still failing on the parent
      linkRow(parent, "ada1@omnesoft.com"),     // already imported
      linkRow(parent, "brand-new@omnesoft.com"), // never came from this import
    ];
    expect(links.map((l) => l.bucket)).toEqual(["matched", "resolved", "new"]);
    expect(countBuckets(links)).toEqual({ matched: 1, resolved: 1, new: 1 });
  });

  it("treats a row whose key was itself the error as new", () => {
    /* Row 5 failed because its email was unusable, so once the admin fixes
     * it there is nothing left to match on. Documented behaviour, not a
     * regression: the row still imports, and the correction still nests
     * under the parent. */
    const parent = loadUsersParentSnapshot(PARENT_ID)!;
    expect(linkRow(parent, "cy.fixed@omnesoft.com")).toEqual({ bucket: "new", parentRow: null });
    /* Left untouched, the original key still finds its row. */
    expect(linkRow(parent, "not-an-email")).toEqual({ bucket: "matched", parentRow: 5 });
  });

  it("writes the fixed rows back to the parent and recomputes its chips", () => {
    const counts = applyUsersCorrectionToParent(PARENT_ID, [
      { parentRow: 4, values: { ...userRow({ _row: 4, emailAddress: "bea@omnesoft.com", licenseType: "Field User" }) } },
    ]);
    expect(counts).toEqual({ importedCount: 4, failedCount: 1 });

    const records = getImportDetail(PARENT_ID)!.records;
    const fixed = records.find((r) => r._row === 4)!;
    expect(fixed._outcome).toBe("Created");
    expect(fixed.licenseType).toBe("Field User");
    /* The stale reason must go, otherwise the row reads as imported while
     * still explaining why it failed. */
    expect(fixed._message).toBeUndefined();

    /* Untouched failure stays failing. Partial corrections are the norm. */
    expect(records.find((r) => r._row === 5)!._outcome).toBe("Failed");
    expect(getCompletedImportById(PARENT_ID)).toMatchObject({ importedCount: 4, failedCount: 1 });
  });

  it("never resurrects a row that was already imported", () => {
    const before = getImportDetail(PARENT_ID)!.records.find((r) => r._row === 1)!;
    const counts = applyUsersCorrectionToParent(PARENT_ID, [
      { parentRow: 1, values: { ...userRow({ _row: 1, jobTitle: "Overwritten" }) } },
    ]);
    /* Nothing was failing at row 1, so the correction is a no-op rather than
     * a silent overwrite of an already-imported record. */
    expect(counts).toBeNull();
    expect(getImportDetail(PARENT_ID)!.records.find((r) => r._row === 1)!.jobTitle).toBe(before.jobTitle);
  });

  it("does nothing when the parent is gone", () => {
    window.localStorage.clear();
    expect(applyUsersCorrectionToParent(PARENT_ID, [
      { parentRow: 4, values: { ...userRow({ _row: 4 }) } },
    ])).toBeNull();
  });
});
