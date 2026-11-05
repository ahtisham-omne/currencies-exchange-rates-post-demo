import { describe, expect, it } from "vitest";
import { emptyRow, PARTNER_GROUPS_IMPORT_SPEC, PARTNERS_IMPORT_SPEC, type ImportRow } from "../spec";
import { buildValidationContext, validateRows, type ValidationContext } from "../validation";

const P = PARTNERS_IMPORT_SPEC;
const G = PARTNER_GROUPS_IMPORT_SPEC;

const ctx: ValidationContext = {
  existingKeys: new Set(["existing partner"]),
  groups: new Set(["tier 1 automotive oems", "nordic countries"]),
  partners: new Set(["toyota international", "existing partner"]),
  contacts: new Set(["issac archer", "braelyn lowe"]),
};
const gctx: ValidationContext = { ...ctx, existingKeys: new Set(["existing group"]) };

function prow(over: Partial<ImportRow>): ImportRow {
  return { ...emptyRow(P), partnerName: "New Co", primaryPartnerGroup: "Nordic Countries", ...over };
}
function grow(over: Partial<ImportRow>): ImportRow {
  return { ...emptyRow(G), groupName: "New Group", ...over };
}
const codes = (r: ReturnType<typeof validateRows>, i = 0) => r.rows[i].issues.map((x) => `${x.field}:${x.code}:${x.severity}`);

describe("generic rules", () => {
  it("key required on every row, other required columns only on create rows", () => {
    const r = validateRows(P, [prow({ partnerName: "" }), prow({ primaryPartnerGroup: "" }), prow({ partnerName: "Existing Partner", primaryPartnerGroup: "" })], ctx);
    expect(codes(r, 0)).toContain("partnerName:REQUIRED_EMPTY:error");
    expect(r.rows[0].issues[0].message).toBe("Partner Name is required and cannot be empty.");
    expect(codes(r, 1)).toEqual(["primaryPartnerGroup:REQUIRED_EMPTY:error"]);
    expect(r.rows[2].isUpdate).toBe(true);
    expect(r.rows[2].status).toBe("ready");
    expect(r).toMatchObject({ errorRowCount: 2, readyRowCount: 1, updateRowCount: 1, createRowCount: 0 });
  });
  it("whitespace does not satisfy required", () => {
    const r = validateRows(P, [prow({ partnerName: "   " })], ctx);
    expect(codes(r)).toContain("partnerName:REQUIRED_EMPTY:error");
  });
  it("duplicate key in file (trim + case-insensitive) with row references", () => {
    const r = validateRows(P, [prow({ partnerName: "Acme" }), prow({ partnerName: " acme " }), prow({ partnerName: "ACME" })], ctx);
    expect(codes(r, 0)).toEqual(["partnerName:DUPLICATE_KEY:error"]);
    expect(r.rows[0].issues[0].message).toBe("Duplicate Partner Name. This value also appears in row 2, 3.");
    expect(r.rows[1].issues[0].message).toBe("Duplicate Partner Name. This value also appears in row 1, 3.");
  });
  it("isUpdate by key match, trimmed and case-insensitive, never for rows with a key error", () => {
    const r = validateRows(P, [prow({ partnerName: "  EXISTING partner " }), prow({ partnerName: "Existing Partner" })], ctx);
    expect(r.rows[0].isUpdate).toBe(false); // duplicate -> key error -> create path
    expect(codes(r, 0)).toContain("partnerName:DUPLICATE_KEY:error");
    const single = validateRows(P, [prow({ partnerName: "  EXISTING partner " })], ctx);
    expect(single.rows[0].isUpdate).toBe(true);
  });
  it("invalid enum = warning with options; case-insensitive match accepted", () => {
    const r = validateRows(P, [prow({ status: "Deactivated" }), prow({ partnerName: "B", status: "active" })], ctx);
    expect(codes(r, 0)).toEqual(["status:INVALID_OPTION:warning"]);
    expect(r.rows[0].issues[0].message).toBe('"Deactivated" is not a recognised Status. The partner will import without it. Use Active, or Inactive.');
    expect(r.rows[0].issues[0].options).toEqual(["Active", "Inactive"]);
    expect(r.rows[1].status).toBe("ready");
  });
  it("multiselect invalid values are listed, long option lists point at the Valid Values sheet", () => {
    const r = validateRows(P, [prow({ pricingRules: "Standard Discount, Value (Single-Tier)|Bogus|Other" })], ctx);
    expect(codes(r)).toEqual(["pricingRules:INVALID_OPTION:warning"]);
    expect(r.rows[0].issues[0].message).toContain('"Bogus" and "Other" are not recognised Pricing Rules values');
    expect(r.rows[0].issues[0].message).toContain("See the Valid Values sheet");
  });
  it("number parse + range, length caps", () => {
    const r = validateRows(G, [grow({ maxCreditLimit: "10,000", warningThreshold: "abc" }), grow({ groupName: "B", maxCreditLimit: "-1", warningThreshold: "101" }), grow({ groupName: "C", description: "x".repeat(5001) })], gctx);
    expect(codes(r, 0)).toEqual(["warningThreshold:INVALID_NUMBER:error"]);
    expect(r.rows[0].issues[0].message).toBe("Warning Threshold (%) must be a number.");
    expect(codes(r, 1)).toEqual(["maxCreditLimit:OUT_OF_RANGE:error", "warningThreshold:OUT_OF_RANGE:error"]);
    expect(r.rows[1].issues[0].message).toBe("Max Credit Limit must be 0 or more.");
    expect(r.rows[1].issues[1].message).toBe("Warning Threshold (%) must be between 0 and 100.");
    expect(codes(r, 2)).toEqual(["description:TOO_LONG:error"]);
  });
  it("conditionalOn: sub-types without their type = warning; blank type inherits silently", () => {
    const r = validateRows(P, [prow({ partnerTypes: "Customer", vendorSubTypes: "Carrier" }), prow({ partnerName: "B", vendorSubTypes: "Carrier" })], ctx);
    expect(codes(r, 0)).toEqual(["vendorSubTypes:CONDITION_NOT_MET:warning"]);
    expect(r.rows[0].issues[0].message).toBe("Vendor Sub-Types only apply when Partner Type includes Vendor. These values will be ignored.");
    expect(r.rows[1].status).toBe("ready");
  });
  it("row status: error > warning > ready and counts", () => {
    const r = validateRows(P, [prow({ status: "Bogus", email: "nope" }), prow({ partnerName: "B", status: "Bogus" }), prow({ partnerName: "C" })], ctx);
    expect(r.rows.map((x) => x.status)).toEqual(["error", "warning", "ready"]);
    expect(r).toMatchObject({ errorRowCount: 1, warningRowCount: 1, readyRowCount: 1, createRowCount: 2, updateRowCount: 0 });
  });
});

describe("Partners entity rules (SPEC 4.3)", () => {
  it("unknown Partner Groups = error; unknown Primary Partner Group = error", () => {
    const r = validateRows(P, [prow({ partnerGroups: "Nordic Countries|Atlantis", primaryPartnerGroup: "Atlantis" })], ctx);
    expect(codes(r)).toEqual(["partnerGroups:REFERENCE_NOT_FOUND:error", "primaryPartnerGroup:REFERENCE_NOT_FOUND:error"]);
    expect(r.rows[0].issues[0].message).toBe('Partner group "Atlantis" doesn\'t exist in Omne.');
  });
  it("Primary Partner Group must be one of the row's Partner Groups", () => {
    const r = validateRows(P, [prow({ partnerGroups: "Tier 1 Automotive OEMs", primaryPartnerGroup: "Nordic Countries" }), prow({ partnerName: "B", partnerGroups: "", primaryPartnerGroup: "Nordic Countries" })], ctx);
    expect(codes(r, 0)).toEqual(["primaryPartnerGroup:NOT_IN_LIST:error"]);
    expect(r.rows[0].issues[0].message).toBe('"Nordic Countries" is not listed in Partner Groups on this row.');
    expect(r.rows[1].status).toBe("ready");
  });
  it("email format = error, phone = warning", () => {
    const r = validateRows(P, [prow({ email: "not-an-email", phone: "abc" }), prow({ partnerName: "B", email: "ok@acme.com", phone: "(555) 123-4567" })], ctx);
    expect(codes(r, 0)).toEqual(["phone:INVALID_PHONE:warning", "email:INVALID_EMAIL:error"]);
    expect(r.rows[0].issues.find((i) => i.code === "INVALID_EMAIL")?.message).toBe("Invalid email format. Expected: name@domain.com");
    expect(r.rows[1].status).toBe("ready");
  });
  it("currency / term / rule / carrier / contact / method unknown = warning", () => {
    const r = validateRows(P, [prow({ currency: "XXX", paymentTerm: "Net 99", pricingRules: "Nope", carriers: "Pigeon", pointsOfContact: "Nobody", paymentMethods: "Gold" })], ctx);
    expect(codes(r)).toEqual([
      "pointsOfContact:REFERENCE_NOT_FOUND:warning",
      "currency:INVALID_OPTION:warning",
      "paymentTerm:INVALID_OPTION:warning",
      "pricingRules:INVALID_OPTION:warning",
      "paymentMethods:INVALID_OPTION:warning",
      "carriers:INVALID_OPTION:warning",
    ]);
    expect(r.rows[0].status).toBe("warning");
    expect(r.rows[0].issues[0].message).toBe('Contact "Nobody" doesn\'t exist in Omne. The partner will import without this contact.');
  });
  it("the shipped example rows validate clean", () => {
    const rows = P.data.examples.map((ex) => Object.fromEntries(P.columns.map((c, i) => [c.key, ex[i]])) as ImportRow);
    const r = validateRows(P, rows, { ...ctx, groups: new Set(["tier 1 automotive oems", "powertrain components", "nordic countries"]) });
    expect(r.errorRowCount).toBe(0);
    expect(r.warningRowCount).toBe(0);
  });
});

describe("Partner Groups entity rules (SPEC 4.4)", () => {
  it("unknown Linked Partners = warning (dropped); Primary Partners must be a subset of Linked Partners (warning)", () => {
    const r = validateRows(G, [grow({ memberIds: "Toyota International|Ghost Co", primaryMemberIds: "Existing Partner" })], gctx);
    expect(codes(r)).toEqual(["memberIds:REFERENCE_NOT_FOUND:warning", "primaryMemberIds:NOT_IN_LIST:warning"]);
    expect(r.rows[0].issues[0].message).toBe('Partner "Ghost Co" doesn\'t exist in Omne. The partner group will import without this partner.');
  });
  it("Group Scope invalid = warning; Country unknown = warning; Billing Type invalid = warning", () => {
    const r = validateRows(G, [grow({ scope: "Supplier", country: "Narnia", billingType: "Global" })], gctx);
    expect(codes(r)).toEqual(["country:INVALID_OPTION:warning", "scope:INVALID_OPTION:warning", "billingType:INVALID_OPTION:warning"]);
  });
  it("existing group name = update, only Group Name required", () => {
    const r = validateRows(G, [grow({ groupName: "existing group" })], gctx);
    expect(r.rows[0]).toMatchObject({ isUpdate: true, status: "ready" });
  });
  it("the shipped example rows validate clean", () => {
    const rows = G.data.examples.map((ex) => Object.fromEntries(G.columns.map((c, i) => [c.key, ex[i]])) as ImportRow);
    const r = validateRows(G, rows, { ...gctx, partners: new Set(["toyota international", "ntn corporation"]) });
    expect(r.errorRowCount).toBe(0);
    expect(r.warningRowCount).toBe(0);
  });
});

describe("buildValidationContext", () => {
  it("lower-cases names and picks the right existing-key set per entity", () => {
    const partners = [{ displayName: "Acme Co", companyName: "ACME Corporation" }];
    const groups = [{ name: "Nordic Countries" }];
    const p = buildValidationContext(P, partners, groups);
    expect(p.existingKeys).toEqual(new Set(["acme co", "acme corporation"]));
    expect(p.groups).toEqual(new Set(["nordic countries"]));
    expect(p.contacts?.has("issac archer")).toBe(true);
    expect(p.contacts!.size).toBeGreaterThan(24);
    const g = buildValidationContext(G, partners, groups);
    expect(g.existingKeys).toEqual(new Set(["nordic countries"]));
    expect(g.partners).toEqual(new Set(["acme co", "acme corporation"]));
  });
});
