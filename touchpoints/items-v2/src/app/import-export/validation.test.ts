import { describe, expect, it } from "vitest";
import { INITIAL_ITEMS } from "@/app/context/ItemsContext";
import { makeEmptyRow, type ItemReviewRow } from "./spec";
import { parseTags, splitList } from "./helpers";
import { reviewRowToItem } from "./mappers";
import { buildValidationContext, validateRows, type CellIssue, type IssueCode } from "./validation";

const ctx = buildValidationContext(INITIAL_ITEMS);

function row(partial: Partial<ItemReviewRow>): ItemReviewRow {
  return { ...makeEmptyRow(), partNumber: "NEW-001", primaryCategory: "C-1004", ...partial };
}
function issuesOf(r: ItemReviewRow, field?: string): CellIssue[] {
  const v = validateRows([r], ctx).rows[0];
  return field ? (v.byField[field as keyof typeof v.byField] ?? []) : v.issues;
}
function codes(r: ItemReviewRow, field?: string): IssueCode[] {
  return issuesOf(r, field).map((i) => i.code);
}

describe("required + key rules", () => {
  it("a clean create row is ready", () => {
    const res = validateRows([row({})], ctx);
    expect(res.rows[0].status).toBe("ready");
    expect(res.rows[0].isUpdate).toBe(false);
    expect(res).toMatchObject({ errorRowCount: 0, warningRowCount: 0, readyRowCount: 1, createRowCount: 1, updateRowCount: 0 });
  });
  it("Part Number is required on every row", () => {
    const issues = issuesOf(row({ partNumber: "  " }), "partNumber");
    expect(issues[0]).toMatchObject({ code: "REQUIRED_EMPTY", severity: "error", message: "Part Number is required and cannot be empty." });
    expect(issues[0].explanation).toBeTruthy();
  });
  it("duplicate part numbers in the file are errors on both rows (trim, case-insensitive)", () => {
    const res = validateRows([row({ partNumber: "dup-1" }), row({ partNumber: "  DUP-1 " }), row({ partNumber: "other" })], ctx);
    expect(res.rows[0].byField.partNumber?.[0]).toMatchObject({ code: "DUPLICATE_KEY", message: "Duplicate part number. This part number also appears in row 2." });
    expect(res.rows[1].byField.partNumber?.[0].message).toContain("row 1");
    expect(res.rows[2].status).toBe("ready");
    expect(res.errorRowCount).toBe(2);
  });
  it("an existing part number is an update: Primary Category is then optional and blanks are silent", () => {
    const res = validateRows([row({ partNumber: " fast-hex-001 ", primaryCategory: "" })], ctx);
    expect(res.rows[0].isUpdate).toBe(true);
    expect(res.rows[0].status).toBe("ready");
    expect(res.updateRowCount).toBe(1);
  });
  it("Primary Category is required on a create row and must exist", () => {
    expect(issuesOf(row({ primaryCategory: "" }), "primaryCategory")[0]).toMatchObject({ code: "REQUIRED_EMPTY", severity: "error" });
    expect(issuesOf(row({ primaryCategory: "C-9999" }), "primaryCategory")[0]).toMatchObject({ code: "CATEGORY_NOT_FOUND", severity: "error" });
    expect(codes(row({ primaryCategory: "c-1010" }))).toEqual([]);
    /* seed category names count as known */
    expect(codes(row({ primaryCategory: "Fasteners" }))).toEqual([]);
  });
  it("Description over 5000 characters is an error", () => {
    expect(codes(row({ description: "x".repeat(5001) }), "description")).toEqual(["TOO_LONG"]);
    expect(codes(row({ description: "x".repeat(5000) }))).toEqual([]);
  });
  it("tags over 30 characters are an error", () => {
    const long = "T".repeat(31);
    expect(codes(row({ tags: "T".repeat(30) }))).toEqual([]);
    expect(issuesOf(row({ tags: `Short|${long}` }), "tags")[0]).toMatchObject({
      code: "TAG_TOO_LONG",
      severity: "error",
      message: `Tag "${long}" is longer than 30 characters. Shorten each tag to 30 characters or fewer.`,
    });
    expect(parseTags(`Short|${long}|${"T".repeat(30)}`)).toEqual({ tags: ["Short", "T".repeat(30)], truncated: [long] });
    expect(reviewRowToItem(row({ tags: `A|${long}` }), { currentUserId: "u1", currentUserName: "Test" }).tags).toEqual(["A", "T".repeat(30)]);
  });
});

describe("categories, enums, yes/no", () => {
  it("additional categories: unknown = error, equals primary = error", () => {
    const issues = issuesOf(row({ additionalCategories: "C-1004|C-1003|C-8888" }), "additionalCategories");
    expect(issues.map((i) => [i.code, i.severity])).toEqual([
      ["ADDITIONAL_EQUALS_PRIMARY", "error"],
      ["CATEGORY_NOT_FOUND", "error"],
    ]);
    expect(issues[1].message).toBe('Category "C-8888" doesn\'t exist in Omne. Remove it, or use a category code from the Valid Values sheet.');
  });
  it("invalid enum values are errors with the options attached", () => {
    const issues = issuesOf(row({ status: "Draft" }), "status");
    expect(issues[0]).toMatchObject({ code: "INVALID_DROPDOWN", severity: "error", options: ["Active", "Inactive"] });
    expect(issues[0].message).toBe('"Draft" is not a recognised status. Use Active or Inactive.');
    expect(issuesOf(row({ shortageRule: "x" }), "shortageRule")[0].message).toContain("Use Demand, Min, Zero, or Off.");
    expect(codes(row({ valuationMethod: "wac" }))).toEqual([]);
    expect(codes(row({ shortageRule: "sometimes" }), "shortageRule")).toEqual(["INVALID_DROPDOWN"]);
    expect(codes(row({ inventoryType: "Stocked" }), "inventoryType")).toEqual(["INVALID_DROPDOWN"]);
  });
  it("yes/no columns accept the vocabulary and are an error otherwise", () => {
    expect(codes(row({ lotControl: "true", scanItem: "0", scanLocation: "Y" }))).toEqual([]);
    expect(issuesOf(row({ scanLocation: "maybe" }), "scanLocation")[0]).toMatchObject({ code: "INVALID_DROPDOWN", options: ["Yes", "No"] });
  });
  it("acquisition methods: unknown is an error; primary must be one of the listed methods", () => {
    expect(codes(row({ acquisitionMethods: "Purchased|Leased" }), "acquisitionMethods")).toEqual(["INVALID_DROPDOWN"]);
    expect(codes(row({ acquisitionMethods: "Purchased", primaryAcquisition: "Manufactured" }), "primaryAcquisition")).toEqual(["CONDITIONAL_IGNORED"]);
    expect(codes(row({ acquisitionMethods: "Purchased|Manufactured", primaryAcquisition: "Manufactured" }))).toEqual([]);
    /* blank methods on a create row default to Purchased */
    expect(codes(row({ primaryAcquisition: "Manufactured" }), "primaryAcquisition")).toEqual(["CONDITIONAL_IGNORED"]);
  });
});

describe("units", () => {
  it("unknown base unit is an error; known units match case-insensitively", () => {
    expect(issuesOf(row({ unit: "Widgets" }), "unit")[0]).toMatchObject({ code: "UNIT_NOT_FOUND", severity: "error" });
    expect(codes(row({ unit: "kilogram" }))).toEqual([]);
  });
  it("alternative units: pair parse, unknown unit, factor > 0, different category than base", () => {
    expect(codes(row({ alternativeUnits: "Box 12" }), "alternativeUnits")).toEqual(["INVALID_ALT_UNIT"]);
    expect(codes(row({ alternativeUnits: "Crate=12" }), "alternativeUnits")).toEqual(["INVALID_ALT_UNIT"]);
    expect(codes(row({ alternativeUnits: "Box=0" }), "alternativeUnits")).toEqual(["INVALID_ALT_UNIT"]);
    expect(issuesOf(row({ unit: "Each", alternativeUnits: "Dozen=12" }), "alternativeUnits")[0].message).toContain("shares a unit category");
    expect(codes(row({ unit: "Each", alternativeUnits: "Each=1" }), "alternativeUnits")).toEqual(["INVALID_ALT_UNIT"]);
    expect(codes(row({ unit: "Each", alternativeUnits: "Box=4|Pallet=48" }))).toEqual([]);
    /* default base unit Each on a create row with blank unit */
    expect(codes(row({ alternativeUnits: "Pair=2" }), "alternativeUnits")).toEqual(["INVALID_ALT_UNIT"]);
  });
});

describe("numbers and ranges", () => {
  it("non-numeric and negative numbers are errors", () => {
    expect(codes(row({ shelfLifeValue: "two years" }), "shelfLifeValue")).toEqual(["INVALID_NUMBER"]);
    expect(codes(row({ shelfLifeValue: "-1" }), "shelfLifeValue")).toEqual(["RANGE_INVALID"]);
    expect(codes(row({ minStock: "ten" }), "minStock")).toEqual(["INVALID_NUMBER"]);
    expect(codes(row({ maxPurchase: "-5" }), "maxPurchase")).toEqual(["RANGE_INVALID"]);
  });
  it("min level must be less than max level (defaults fill the blank side on a create row)", () => {
    expect(issuesOf(row({ minStock: "100", maxStock: "100" }), "minStock")[0]).toMatchObject({ code: "RANGE_INVALID", message: "Min level must be less than max level." });
    expect(codes(row({ minStock: "5000" }), "minStock")).toEqual(["RANGE_INVALID"]);
    expect(codes(row({ minStock: "5", maxStock: "200" }))).toEqual([]);
    /* update rows compare only what the file gives */
    expect(codes(row({ partNumber: "FAST-HEX-001", minStock: "5000" }))).toEqual([]);
  });
  it("max order qty must be at least min order qty; multiples > 0; variance 0..100", () => {
    expect(codes(row({ minPurchase: "100", maxPurchase: "50" }), "maxPurchase")).toEqual(["RANGE_INVALID"]);
    expect(codes(row({ maxPurchase: "10" }), "maxPurchase")).toEqual(["RANGE_INVALID"]);
    expect(codes(row({ multiples: "0" }), "multiples")).toEqual(["RANGE_INVALID"]);
    expect(codes(row({ multiples: "abc" }), "multiples")).toEqual(["INVALID_NUMBER"]);
    expect(codes(row({ cycleTolerance: "150" }), "cycleTolerance")).toEqual(["RANGE_INVALID"]);
    expect(codes(row({ cycleTolerance: "2.5" }))).toEqual([]);
  });
});

describe("conditional and reference rules", () => {
  it("Lot ID Assignment without Lot Tracking, Shelf Life Unit without Shelf Life, Serial Scan without Serialized", () => {
    expect(codes(row({ lotIdSource: "Vendor Lot" }), "lotIdSource")).toEqual(["CONDITIONAL_IGNORED"]);
    expect(codes(row({ lotControl: "Yes", lotIdSource: "Vendor Lot" }))).toEqual([]);
    expect(codes(row({ shelfLifeUnit: "Months" }), "shelfLifeUnit")).toEqual(["CONDITIONAL_IGNORED"]);
    expect(codes(row({ shelfLifeValue: "24", shelfLifeUnit: "Months" }))).toEqual([]);
    expect(codes(row({ scanSerial: "Yes" }), "scanSerial")).toEqual(["CONDITIONAL_IGNORED"]);
    expect(codes(row({ inventoryControlType: "Serialized", scanSerial: "Yes" }))).toEqual([]);
    /* update rows with the driving column blank stay silent */
    expect(codes(row({ partNumber: "FAST-HEX-001", scanSerial: "Yes", lotIdSource: "Vendor Lot" }))).toEqual([]);
  });
  it("Specific Partners only with Selling Scope = Specific; Specific without partners is an error", () => {
    expect(codes(row({ specificPartners: "Ford Motor Company" }), "specificPartners")).toEqual(["CONDITIONAL_IGNORED"]);
    expect(codes(row({ sellingScope: "Specific" }), "specificPartners")).toEqual(["MISSING_CONDITIONAL"]);
    expect(codes(row({ sellingScope: "Specific", specificPartners: "Ford Motor Company|Tesla, Inc." }))).toEqual([]);
  });
  it("unknown locations, partners, users and approvers are errors, one per column, UAC phrasing", () => {
    const loc = issuesOf(row({ inboundLocations: "Warehouse A - Main Hall|Moon Base|Mars Base" }), "inboundLocations");
    expect(loc[0]).toMatchObject({ code: "REFERENCE_NOT_FOUND", severity: "error" });
    expect(loc[0].message).toBe('Locations "Moon Base" and "Mars Base" don\'t exist in Omne. Remove them, or use ones that exist in Omne.');
    expect(issuesOf(row({ approvers: "Nobody" }), "approvers")[0].message).toBe('Approver "Nobody" doesn\'t exist in Omne. Remove it, or use one that exists in Omne.');
    expect(codes(row({ "owners.purchasing": "bob jones", "owners.finance": "Frank Reynolds", "owners.materialHandling": "Alice Smith|Charlie Day" }))).toEqual([]);
    expect(codes(row({ "owners.purchasing": "Zed" }), "owners.purchasing")).toEqual(["REFERENCE_NOT_FOUND"]);
    expect(codes(row({ sellingScope: "Specific", specificPartners: "Ford Motor Company|Acme" }), "specificPartners")).toEqual(["REFERENCE_NOT_FOUND"]);
    expect(issuesOf(row({ shippingStagingLocation: "A|B|C|D" }), "shippingStagingLocation")[0].message).toContain('"A", "B", and 2 more');
  });
  it("pricing tiers: price + space + unit, unit from the price-unit list", () => {
    expect(codes(row({ pricing: "12.50" }), "pricing")).toEqual(["INVALID_PRICE"]);
    expect(codes(row({ pricing: "12.50 Crate" }), "pricing")).toEqual(["INVALID_PRICE"]);
    expect(codes(row({ pricing: "1250.00 Each|4800.00 Box" }))).toEqual([]);
  });
  it("row status is error > ready (no warnings) and counts split by isUpdate", () => {
    const res = validateRows(
      [row({ status: "Draft" }), row({ partNumber: "B", unit: "Nope", status: "Draft" }), row({ partNumber: "FAST-HEX-001" })],
      ctx,
    );
    expect(res.rows.map((r) => r.status)).toEqual(["error", "error", "ready"]);
    expect(res).toMatchObject({ errorRowCount: 2, warningRowCount: 0, readyRowCount: 1, createRowCount: 0, updateRowCount: 1 });
  });
});

describe("splitList", () => {
  it("reads comma lists and old pipe lists the same way", () => {
    expect(splitList("Pumps, Fluid Handling")).toEqual(["Pumps", "Fluid Handling"]);
    expect(splitList("Pumps|Fluid Handling")).toEqual(["Pumps", "Fluid Handling"]);
  });
  it("keeps names that hold a comma whole", () => {
    expect(splitList("Ford Motor Company|Tesla, Inc.")).toEqual(["Ford Motor Company", "Tesla, Inc."]);
    expect(splitList("Ford Motor Company, Tesla, Inc., Honda Motor Co., Ltd. (USA)")).toEqual(["Ford Motor Company", "Tesla, Inc.", "Honda Motor Co., Ltd. (USA)"]);
    expect(splitList("Acme, Inc., Bolt Works", new Map([["acme, inc.", "Acme, Inc."]]))).toEqual(["Acme, Inc.", "Bolt Works"]);
    expect(splitList("1,250.00 Each, 4800.00 Box")).toEqual(["1,250.00 Each", "4800.00 Box"]);
  });
});

describe("one wrong value, one error", () => {
  it("an unknown primary repeated in Additional Categories is only not found", () => {
    expect(codes(row({ primaryCategory: "C-9999", additionalCategories: "C-9999" }), "additionalCategories")).toEqual(["CATEGORY_NOT_FOUND"]);
    expect(codes(row({ additionalCategories: "C-1004" }), "additionalCategories")).toEqual(["ADDITIONAL_EQUALS_PRIMARY"]);
  });
  it("an invalid value is not reported again by the column that depends on it", () => {
    expect(codes(row({ sellingScope: "Sometimes", specificPartners: "Ford Motor Company" }), "specificPartners")).toEqual([]);
    expect(codes(row({ sellingScope: "Specific", specificPartners: "Acme Nowhere" }), "specificPartners")).toEqual(["REFERENCE_NOT_FOUND"]);
    expect(codes(row({ lotControl: "Maybe", lotIdSource: "Vendor Lot" }), "lotIdSource")).toEqual([]);
    expect(codes(row({ acquisitionMethods: "Leased", primaryAcquisition: "Manufactured" }), "primaryAcquisition")).toEqual([]);
    expect(codes(row({ inventoryControlType: "Tracked", scanSerial: "Yes" }), "scanSerial")).toEqual([]);
  });
});
