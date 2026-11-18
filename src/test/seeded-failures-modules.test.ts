/* The seeded June import of Item Library, Categories, Partners and Partner
 * Group must exercise every rule its module's validator can raise, through
 * the same validate + context the record page runs. */

import { describe, expect, it } from "vitest";
import { MODULE_IMPORT_DEFS, MODULE_IMPORT_SLUGS, type ModuleImportSlug, type ModuleIssue } from "@/app/components/data-imports/modules/moduleImportDefs";
import { buildFailedSeed, failedSeedCases, recordValues } from "@/app/components/data-imports/modules/moduleImportStore";
import type { IssueCode as CategoryCode } from "@/app/components/data-imports/modules/categories/validation";
import type { IssueCode as ItemCode } from "@/app/components/data-imports/modules/item-library/validation";
import type { IssueCode as PartnerCode } from "@/app/components/data-imports/modules/partners/validation";
import { PARTNERS_IMPORT_SPEC, PARTNER_GROUPS_IMPORT_SPEC, type EntitySpec } from "@/app/components/data-imports/modules/partners/spec";
import type { IssueCode as PiCode, TrackingMode } from "@/app/components/data-imports/modules/physical-inventory/types";
import { reachableCodes as piReachable } from "@/app/components/data-imports/modules/physical-inventory/validation";
import { PI_TABS, type PiItemIssueCode, type PiSlug } from "@/app/components/data-imports/modules/physical-inventory/piModule";

/* Exhaustive by type: adding a code to a validator's union fails compilation
 * here until the seed covers it (or the spec rules it out). */
const CATEGORY_CODES: Record<CategoryCode, true> = {
  REQUIRED_EMPTY: true, DUPLICATE_KEY: true, INVALID_DROPDOWN: true, TAG_TOO_LONG: true,
  UNKNOWN_UNIT: true, INVALID_ALT_UNIT: true, CONDITIONAL_IGNORED: true,
};
const ITEM_CODES: Record<ItemCode, true> = {
  REQUIRED_EMPTY: true, DUPLICATE_KEY: true, TAG_TOO_LONG: true, CATEGORY_NOT_FOUND: true,
  ADDITIONAL_EQUALS_PRIMARY: true, INVALID_DROPDOWN: true, UNIT_NOT_FOUND: true, INVALID_ALT_UNIT: true,
  INVALID_NUMBER: true, RANGE_INVALID: true, INVALID_PRICE: true, CONDITIONAL_IGNORED: true, MISSING_CONDITIONAL: true,
  REFERENCE_NOT_FOUND: true,
};
const PARTNER_CODES: Record<PartnerCode, true> = {
  REQUIRED_EMPTY: true, DUPLICATE_KEY: true, INVALID_OPTION: true, REFERENCE_NOT_FOUND: true, NOT_IN_LIST: true,
  CONDITION_NOT_MET: true, INVALID_NUMBER: true, OUT_OF_RANGE: true, TOO_LONG: true, INVALID_EMAIL: true, INVALID_PHONE: true,
};

const PI_CODES: Record<PiCode | PiItemIssueCode, true> = {
  REQUIRED_EMPTY: true, DUPLICATE_SERIAL: true, SERIAL_EXISTS: true, INVALID_NUMBER: true, NOT_POSITIVE: true,
  NEGATIVE_PRICE: true, INVALID_UOM: true, LOCATION_NOT_FOUND: true, INVALID_REASON: true, NEW_LOT: true,
  LOT_UOM_MISMATCH: true, LOT_UOM_CONFLICT: true, PRICE_SET_BY_LOT: true, ITEM_NOT_FOUND: true, ITEM_CONTROL_TYPE: true,
};

/* Every issue path of a Physical Inventory tab: the Part Number rule
 * (piModule.ts) plus the vendored validation.ts paths for its columns. */
const PI_PART_BRANCHES = ["partNumber:REQUIRED_EMPTY:error", "partNumber:ITEM_NOT_FOUND:error", "partNumber:ITEM_CONTROL_TYPE:error"];
const PI_MODE_BRANCHES: Record<TrackingMode, string[]> = {
  serialized: [
    "serialNumber:REQUIRED_EMPTY:error", "serialNumber:SERIAL_EXISTS:error", "serialNumber:DUPLICATE_SERIAL:error",
    "price:INVALID_NUMBER:error", "price:NEGATIVE_PRICE:error", "location:REQUIRED_EMPTY:error",
    "location:LOCATION_NOT_FOUND:error", "reason:INVALID_REASON:warning",
  ],
  "non-serialized": [
    "qty:REQUIRED_EMPTY:error", "qty:INVALID_NUMBER:error", "qty:NOT_POSITIVE:error", "uom:REQUIRED_EMPTY:error",
    "uom:INVALID_UOM:error", "price:INVALID_NUMBER:error", "price:NEGATIVE_PRICE:error",
    "location:LOCATION_NOT_FOUND:error", "reason:INVALID_REASON:warning",
  ],
  "lot-serialized": [
    "lotNumber:REQUIRED_EMPTY:error", "lotNumber:NEW_LOT:warning", "serialNumber:REQUIRED_EMPTY:error",
    "serialNumber:SERIAL_EXISTS:error", "serialNumber:DUPLICATE_SERIAL:error", "price:INVALID_NUMBER:error",
    "price:NEGATIVE_PRICE:error", "location:LOCATION_NOT_FOUND:error", "reason:INVALID_REASON:warning",
  ],
  lot: [
    "lotNumber:REQUIRED_EMPTY:error", "lotNumber:NEW_LOT:warning", "qty:INVALID_NUMBER:error", "qty:NOT_POSITIVE:error",
    "uom:INVALID_UOM:error", "uom:LOT_UOM_MISMATCH:error", "uom:LOT_UOM_CONFLICT:error", "price:INVALID_NUMBER:error",
    "price:NEGATIVE_PRICE:error", "price:PRICE_SET_BY_LOT:warning", "location:LOCATION_NOT_FOUND:error",
    "reason:INVALID_REASON:warning",
  ],
};
const PI_BRANCHES = Object.fromEntries(PI_TABS.map((t) => [t.slug, [...PI_PART_BRANCHES, ...PI_MODE_BRANCHES[t.mode]]])) as Record<PiSlug, string[]>;
const PI_CODE_LISTS = Object.fromEntries(PI_TABS.map((t) => [t.slug, Object.keys(PI_CODES)])) as Record<PiSlug, string[]>;
/* Codes a tab cannot raise: the vendored validator's reachableCodes decides. */
const PI_UNREACHABLE = Object.fromEntries(PI_TABS.map((t) => {
  const reach = new Set<string>([...piReachable(t.mode), "ITEM_NOT_FOUND", "ITEM_CONTROL_TYPE"]);
  return [t.slug, Object.keys(PI_CODES).filter((c) => !reach.has(c)).sort()];
})) as Record<PiSlug, string[]>;

/** "field:CODE[:severity][~fragment]" */
interface Branch { field: string; code: string; severity?: string; fragment?: string; label: string }
function parseBranch(s: string): Branch {
  const [head, fragment] = s.split("~");
  const [field, code, severity] = head.split(":");
  return { field, code, severity, fragment, label: s };
}
function matches(issue: ModuleIssue, b: Branch): boolean {
  return issue.field === b.field && issue.code === b.code
    && (!b.severity || issue.severity === b.severity)
    && (!b.fragment || issue.message.includes(b.fragment));
}

/* Every issue path in categories/validation.ts. */
const CATEGORY_BRANCHES = [
  "code:REQUIRED_EMPTY:error", "code:DUPLICATE_KEY:error", "uom:UNKNOWN_UNIT:error",
  "alternativeUnits:INVALID_ALT_UNIT:error~not in the Unit=factor form",
  "alternativeUnits:INVALID_ALT_UNIT:error~not a unit Omne knows",
  "alternativeUnits:INVALID_ALT_UNIT:error~needs a factor above 0",
  "alternativeUnits:INVALID_ALT_UNIT:error~is the base unit itself",
  "alternativeUnits:INVALID_ALT_UNIT:error~same unit category",
  "status:INVALID_DROPDOWN:warning~will import as Active", "status:INVALID_DROPDOWN:warning~The existing value will be kept",
  "inventoryType:INVALID_DROPDOWN:warning", "controlType:INVALID_DROPDOWN:warning", "lotControlEnabled:INVALID_DROPDOWN:warning",
  "lotIdSource:INVALID_DROPDOWN:warning", "primaryAcquisition:INVALID_DROPDOWN:warning~The value will be ignored",
  "acquisitionMethods:INVALID_DROPDOWN:warning~Only Purchased will be used",
  "acquisitionMethods:INVALID_DROPDOWN:warning~will import as Purchased",
  "acquisitionMethods:INVALID_DROPDOWN:warning~The existing value will be kept",
  "tags:TAG_TOO_LONG:warning", "lotIdSource:CONDITIONAL_IGNORED:warning", "primaryAcquisition:CONDITIONAL_IGNORED:warning",
];

/* Every issue path in item-library/validation.ts. */
const ITEM_BRANCHES = [
  "partNumber:REQUIRED_EMPTY:error", "partNumber:DUPLICATE_KEY:error",
  "primaryCategory:REQUIRED_EMPTY:error", "primaryCategory:CATEGORY_NOT_FOUND:error",
  "shelfLifeValue:INVALID_NUMBER:error", "shelfLifeValue:RANGE_INVALID:error", "unit:UNIT_NOT_FOUND:error",
  "alternativeUnits:INVALID_ALT_UNIT:error~could not be read", "alternativeUnits:INVALID_ALT_UNIT:error~doesn't exist in Omne",
  "alternativeUnits:INVALID_ALT_UNIT:error~must be greater than 0", "alternativeUnits:INVALID_ALT_UNIT:error~is the base unit",
  "alternativeUnits:INVALID_ALT_UNIT:error~shares a unit category",
  "minStock:INVALID_NUMBER:error", "minStock:RANGE_INVALID:error~0 or more", "minStock:RANGE_INVALID:error~less than max level",
  "maxStock:INVALID_NUMBER:error", "maxStock:RANGE_INVALID:error",
  "minPurchase:INVALID_NUMBER:error", "minPurchase:RANGE_INVALID:error",
  "maxPurchase:INVALID_NUMBER:error", "maxPurchase:RANGE_INVALID:error~0 or more", "maxPurchase:RANGE_INVALID:error~at least Min Order Qty",
  "multiples:INVALID_NUMBER:error", "multiples:RANGE_INVALID:error",
  "pricing:INVALID_PRICE:error~could not be read", "pricing:INVALID_PRICE:error~is not recognised",
  "cycleTolerance:INVALID_NUMBER:error", "cycleTolerance:RANGE_INVALID:error",
  "tags:TAG_TOO_LONG:warning",
  ...["status", "inventoryType", "inventoryControlType", "lotIdSource", "shelfLifeUnit", "primaryAcquisition", "shortageRule", "sellingScope", "valuationMethod"]
    .map((f) => `${f}:INVALID_DROPDOWN:warning`),
  ...["lotControl", "scanLocation", "scanItem", "scanLot", "scanSerial"].map((f) => `${f}:INVALID_DROPDOWN:warning`),
  "status:INVALID_DROPDOWN:warning~The existing value will be kept", "status:INVALID_DROPDOWN:warning~will import with Active",
  "primaryAcquisition:INVALID_DROPDOWN:warning~without a value here",
  "lotControl:INVALID_DROPDOWN:warning~The existing setting will be kept", "lotControl:INVALID_DROPDOWN:warning~The setting will be left off",
  "acquisitionMethods:INVALID_DROPDOWN:warning",
  "additionalCategories:ADDITIONAL_EQUALS_PRIMARY:warning",
  "additionalCategories:CATEGORY_NOT_FOUND:warning~doesn't exist in Omne", "additionalCategories:CATEGORY_NOT_FOUND:warning~don't exist in Omne",
  "lotIdSource:CONDITIONAL_IGNORED:warning", "shelfLifeUnit:CONDITIONAL_IGNORED:warning", "primaryAcquisition:CONDITIONAL_IGNORED:warning",
  "specificPartners:CONDITIONAL_IGNORED:warning", "specificPartners:MISSING_CONDITIONAL:warning", "scanSerial:CONDITIONAL_IGNORED:warning",
  ...["inboundLocations", "outboundLocations", "receivingStagingLocation", "shippingStagingLocation", "specificPartners",
    "owners.materialHandling", "owners.purchasing", "owners.finance", "approvers"].map((f) => `${f}:REFERENCE_NOT_FOUND:warning`),
];

/** Every issue path partners/validation.ts can raise for a spec, derived from its columns. */
function partnerBranches(spec: EntitySpec<unknown>): string[] {
  const out = [`${spec.keyColumn}:REQUIRED_EMPTY:error`, `${spec.keyColumn}:DUPLICATE_KEY:error`];
  for (const c of spec.columns) {
    if (c.key !== spec.keyColumn && c.required) out.push(`${c.key}:REQUIRED_EMPTY:error`);
    if (c.kind === "select" || c.kind === "multiselect" || c.kind === "yesno") {
      out.push(c.optionsFrom
        ? `${c.key}:REFERENCE_NOT_FOUND:${c.unknownSeverity ?? "warning"}`
        : `${c.key}:INVALID_OPTION:${c.unknownSeverity ?? "warning"}`);
      if (c.subsetOf) out.push(`${c.key}:NOT_IN_LIST:${c.subsetSeverity ?? "error"}`);
      if (c.conditionalOn) out.push(`${c.key}:CONDITION_NOT_MET:warning`);
    } else if (c.kind === "number") {
      out.push(`${c.key}:INVALID_NUMBER:error`);
      if (c.min !== undefined || c.max !== undefined) out.push(`${c.key}:OUT_OF_RANGE:error`);
    } else if (c.kind === "text") {
      if (c.maxLength !== undefined) out.push(`${c.key}:TOO_LONG:error`);
      if (c.format === "email") out.push(`${c.key}:INVALID_EMAIL:error`);
      if (c.format === "phone") out.push(`${c.key}:INVALID_PHONE:warning`);
    }
  }
  return out;
}

const BRANCHES: Record<ModuleImportSlug, string[]> = {
  categories: CATEGORY_BRANCHES,
  "item-library": ITEM_BRANCHES,
  partners: partnerBranches(PARTNERS_IMPORT_SPEC as EntitySpec<unknown>),
  "partner-groups": partnerBranches(PARTNER_GROUPS_IMPORT_SPEC as EntitySpec<unknown>),
  ...PI_BRANCHES,
};

const CODES: Record<ModuleImportSlug, string[]> = {
  categories: Object.keys(CATEGORY_CODES),
  "item-library": Object.keys(ITEM_CODES),
  partners: Object.keys(PARTNER_CODES),
  "partner-groups": Object.keys(PARTNER_CODES),
  ...PI_CODE_LISTS,
};

function validateSeed(slug: ModuleImportSlug) {
  const def = MODULE_IMPORT_DEFS[slug];
  const seed = buildFailedSeed(slug);
  const result = def.validate(seed.records.map((r) => recordValues(def, r)), def.buildContext());
  return { def, seed, result, cases: failedSeedCases(slug) };
}

describe.each(MODULE_IMPORT_SLUGS)("seeded June import: %s", (slug) => {
  it("is the newest seed, by Rida Ahmad, with history counts that match its rows", () => {
    const { seed } = validateSeed(slug);
    expect(seed.entry.id).toBe(`imp-${slug}-3`);
    expect(seed.entry.fileName).toMatch(/_June_2026\.csv$/);
    expect(seed.entry.importerKey).toBe("ra");
    expect(seed.entry.dateISO > "2026-07-12").toBe(true);
    const created = seed.records.filter((r) => r._outcome === "Created").length;
    const failed = seed.records.filter((r) => r._outcome === "Failed").length;
    expect(seed.entry.recordCount).toBe(seed.records.length);
    expect(seed.entry.importedCount).toBe(created);
    expect(seed.entry.failedCount).toBe(failed);
    expect(created).toBeGreaterThan(0);
    expect(failed).toBeGreaterThan(0);
  });

  it("every Failed row has an error, every Created row has none", () => {
    const { seed, result } = validateSeed(slug);
    seed.records.forEach((r, i) => {
      const errors = result.rows[i].issues.filter((x) => x.severity === "error");
      if (r._outcome === "Failed") {
        expect(errors.length, `row ${i + 1} should fail`).toBeGreaterThan(0);
        expect(r._message).toBe(errors.map((x) => x.message).join(" "));
      } else {
        expect(errors.map((x) => x.message), `row ${i + 1} should import`).toEqual([]);
      }
    });
  });

  it("each row raises the rules its coverage entry names", () => {
    const { result, cases } = validateSeed(slug);
    cases.forEach((c, i) => {
      const v = result.rows[i];
      for (const d of c.demonstrates) {
        if (d === "@update") {
          expect(v.isUpdate, `row ${i + 1} ${c.rule}`).toBe(true);
          continue;
        }
        const b = parseBranch(d);
        expect(v.issues.some((x) => matches(x, b)), `row ${i + 1} "${c.rule}" should raise ${d}; got ${v.issues.map((x) => `${x.field}:${x.code} ${x.message}`).join(" | ")}`).toBe(true);
      }
      if (c.demonstrates.length === 0) expect(v.issues, `row ${i + 1} ${c.rule}`).toEqual([]);
    });
  });

  it("covers every issue path the validator has for this module", () => {
    const { result } = validateSeed(slug);
    const all = result.rows.flatMap((r) => r.issues);
    const missing = BRANCHES[slug].map(parseBranch).filter((b) => !all.some((x) => matches(x, b))).map((b) => b.label);
    expect(missing).toEqual([]);
  });

  it("raises every issue code the spec makes reachable", () => {
    const { result } = validateSeed(slug);
    const raised = new Set(result.rows.flatMap((r) => r.issues.map((x) => x.code)));
    const reachable = new Set(BRANCHES[slug].map((b) => parseBranch(b).code));
    for (const code of CODES[slug]) {
      if (reachable.has(code)) expect(raised.has(code), code).toBe(true);
    }
    /* Anything a spec rules out is really absent from its columns. */
    const unreachable = CODES[slug].filter((c) => !reachable.has(c)).sort();
    const expected: Record<ModuleImportSlug, string[]> = {
      categories: [],
      "item-library": [],
      partners: ["INVALID_NUMBER", "OUT_OF_RANGE", "TOO_LONG"],
      "partner-groups": ["INVALID_EMAIL", "INVALID_PHONE", "TOO_LONG"],
      ...PI_UNREACHABLE,
    };
    expect(unreachable).toEqual(expected[slug]);
  });
});
