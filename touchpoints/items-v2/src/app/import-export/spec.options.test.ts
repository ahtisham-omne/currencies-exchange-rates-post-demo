/* The .mjs option snapshots (read by the Node template script) must equal the
 * live constants the app validates against, so the checked-in template files
 * cannot drift from the app. */
import { describe, expect, it } from "vitest";
import { OPTION_SNAPSHOTS, COLUMNS, TEMPLATE_HEADERS, EXPORT_FIELDS } from "./spec.data.mjs";
import {
  ITEMS_IMPORT_SPEC,
  LIVE_APPROVER_NAMES,
  LIVE_CATEGORY_CODES,
  LIVE_LOCATIONS,
  LIVE_PARTNER_NAMES,
  LIVE_PRICE_UNITS,
  LIVE_UNIT_NAMES,
  LIVE_USER_NAMES,
} from "./spec";
import { CATEGORIES, MOCK_USERS } from "@/app/components/modules/CreateItemModal";
import { MOCK_APPROVERS } from "@/app/components/modules/MaterialHandlingSection";
import { uomCategory } from "@/app/components/modules/configAtoms";

describe("option snapshots equal the live constants", () => {
  it("units (allUnitNames + uomCategory)", () => {
    expect(OPTION_SNAPSHOTS.units.map((u) => u[0])).toEqual(LIVE_UNIT_NAMES);
    expect(OPTION_SNAPSHOTS.units.map((u) => u[1])).toEqual(LIVE_UNIT_NAMES.map((u) => uomCategory(u)));
    expect(LIVE_UNIT_NAMES).toHaveLength(68);
  });
  it("price units (UOMS)", () => {
    expect([...OPTION_SNAPSHOTS.priceUnits]).toEqual(LIVE_PRICE_UNITS);
  });
  it("locations (LOCATIONS)", () => {
    expect([...OPTION_SNAPSHOTS.locations]).toEqual(LIVE_LOCATIONS);
    expect(LIVE_LOCATIONS).toHaveLength(30);
  });
  it("partners (AVAILABLE_VENDORS names)", () => {
    expect([...OPTION_SNAPSHOTS.partners]).toEqual(LIVE_PARTNER_NAMES);
  });
  it("users (MOCK_USERS name + role)", () => {
    expect(OPTION_SNAPSHOTS.users.map((u) => u[0])).toEqual(LIVE_USER_NAMES);
    expect(OPTION_SNAPSHOTS.users.map((u) => u[1])).toEqual((MOCK_USERS as { role: string }[]).map((u) => u.role));
  });
  it("approvers (MOCK_APPROVERS name + role)", () => {
    expect(OPTION_SNAPSHOTS.approvers.map((a) => a[0])).toEqual(LIVE_APPROVER_NAMES);
    expect(OPTION_SNAPSHOTS.approvers.map((a) => a[1])).toEqual((MOCK_APPROVERS as { role: string }[]).map((a) => a.role));
  });
  it("categories (CATEGORIES code + description)", () => {
    expect(OPTION_SNAPSHOTS.categories.map((c) => c[0])).toEqual(LIVE_CATEGORY_CODES);
    expect(OPTION_SNAPSHOTS.categories.map((c) => c[1])).toEqual((CATEGORIES as { description: string }[]).map((c) => c.description));
    expect(LIVE_CATEGORY_CODES).toHaveLength(50);
  });
});

describe("ITEMS_IMPORT_SPEC shape", () => {
  it("has the 39 columns of SPEC.md 4.2 with Part Number + Primary Category required", () => {
    expect(COLUMNS).toHaveLength(39);
    expect(ITEMS_IMPORT_SPEC.columns).toHaveLength(39);
    expect(ITEMS_IMPORT_SPEC.requiredColumns).toEqual(["partNumber", "primaryCategory"]);
    expect(ITEMS_IMPORT_SPEC.keyColumn).toBe("partNumber");
    expect(TEMPLATE_HEADERS.filter((h) => h.endsWith(" *"))).toEqual(["Part Number *", "Primary Category *"]);
  });
  it("select columns carry their live options", () => {
    const unit = ITEMS_IMPORT_SPEC.columnByKey.unit;
    expect(unit.options).toEqual(LIVE_UNIT_NAMES);
    expect(unit.optionsGroups?.map((g) => g.label)).toContain("Packaging");
    expect(ITEMS_IMPORT_SPEC.columnByKey.primaryCategory.options).toEqual(LIVE_CATEGORY_CODES);
    expect(ITEMS_IMPORT_SPEC.columnByKey.inboundLocations.options).toEqual(LIVE_LOCATIONS);
    expect(ITEMS_IMPORT_SPEC.columnByKey.status.options).toEqual(["Active", "Inactive"]);
  });
  it("export fields: 14 listing columns first, Part Number locked, then the remaining import fields", () => {
    const listing = EXPORT_FIELDS.filter((f) => f.listing);
    expect(listing).toHaveLength(14);
    expect(EXPORT_FIELDS[0]).toMatchObject({ id: "part_number", locked: true });
    const ids = new Set(EXPORT_FIELDS.map((f) => f.id));
    expect(ids.size).toBe(EXPORT_FIELDS.length);
    for (const c of COLUMNS) {
      expect(EXPORT_FIELDS.some((f) => f.field === c.key)).toBe(true);
    }
  });
  it("header aliases resolve every label and the documented variants", () => {
    const a = ITEMS_IMPORT_SPEC.headerAliases;
    expect(a["part number"]).toBe("partNumber");
    expect(a["sku"]).toBe("partNumber");
    expect(a["base uom"]).toBe("unit");
    expect(a["material handling owners"]).toBe("owners.materialHandling");
    for (const c of COLUMNS) expect(a[c.label.toLowerCase()]).toBe(c.key);
  });
  it("routes and storage namespace", () => {
    expect(ITEMS_IMPORT_SPEC.routes).toEqual({ listing: "/items", history: "/items/imports", record: "/items/imports/:importId" });
    expect(ITEMS_IMPORT_SPEC.storageNamespace).toBe("items");
    expect(ITEMS_IMPORT_SPEC.bulkSetFields).toEqual(["status", "inventoryControlType"]);
  });
});
