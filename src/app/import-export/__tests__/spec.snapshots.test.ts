/// <reference types="node" />
/* Every option snapshot in spec.data.mjs must equal the live repo constant.
 * Two lists (COUNTRY_CODES, GROUP_COUNTRY_OPTIONS) are module-local inside
 * the create modals and cannot be imported, so they are read from source. */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import {
  CONTACT_DICTIONARY,
  CURRENCY_OPTIONS,
  CUSTOMER_SUB_TYPES,
  PAYMENT_TERM_PRESETS,
  PAYMENT_TYPE_CARDS,
  PRICING_RULE_PRESETS,
  VENDOR_SUB_TYPES,
} from "../../components/vendors/partnerConstants";
import { SHIPPING_CARRIER_CATALOG } from "../../components/vendors/ShippingCarrierCard";
import * as D from "../spec.data.mjs";
import { ALL_IMPORT_SPECS, PARTNER_GROUPS_IMPORT_SPEC, PARTNERS_IMPORT_SPEC, findColumn } from "../spec";
import { headerAliasMap, normHeader } from "../fileParser";

const root = process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(root, rel), "utf8");

describe("spec.data.mjs snapshots equal the live constants", () => {
  it("VENDOR_SUB_TYPES / CUSTOMER_SUB_TYPES", () => {
    expect(D.VENDOR_SUB_TYPES).toEqual(VENDOR_SUB_TYPES.map((s) => ({ id: s.id, label: s.label })));
    expect(D.CUSTOMER_SUB_TYPES).toEqual(CUSTOMER_SUB_TYPES.map((s) => ({ id: s.id, label: s.label })));
  });
  it("CURRENCY_IDS", () => {
    expect(D.CURRENCY_IDS).toEqual(CURRENCY_OPTIONS.map((c) => c.id));
  });
  it("PAYMENT_TERM_PRESETS", () => {
    expect(D.PAYMENT_TERM_PRESETS).toEqual(PAYMENT_TERM_PRESETS.map((p) => ({ id: p.id, name: p.name })));
  });
  it("PRICING_RULE_PRESETS", () => {
    expect(D.PRICING_RULE_PRESETS).toEqual(PRICING_RULE_PRESETS.map((p) => ({ id: p.id, name: p.name })));
  });
  it("PAYMENT_METHODS ids + card labels", () => {
    expect(D.PAYMENT_METHODS.map((m) => ({ id: m.id, typeLabel: m.typeLabel }))).toEqual(PAYMENT_TYPE_CARDS.map((c) => ({ id: c.id, typeLabel: c.label })));
  });
  it("CARRIERS ids + catalog names", () => {
    expect(D.CARRIERS.map((c) => ({ id: c.id, name: c.name }))).toEqual(SHIPPING_CARRIER_CATALOG.map((c) => ({ id: c.id, name: c.name })));
  });
  it("CONTACT_NAMES are the hand-written dictionary entries, in first-appearance order (the live list is extended at runtime)", () => {
    const live = Array.from(new Set(CONTACT_DICTIONARY.map((c) => c.name)));
    expect(live.slice(0, D.CONTACT_NAMES.length)).toEqual(D.CONTACT_NAMES);
    expect(live.length).toBeGreaterThan(D.CONTACT_NAMES.length);
  });
  it("COUNTRY_CODES (CreatePartnerModal local useMemo)", () => {
    const src = read("src/app/components/vendors/CreatePartnerModal.tsx");
    const start = src.indexOf("const COUNTRY_CODES = useMemo(() => [");
    expect(start).toBeGreaterThan(0);
    const block = src.slice(start, src.indexOf("], []);", start));
    const live = Array.from(block.matchAll(/\{ code: "([^"]+)", flag: "([^"]+)", country: "([^"]+)" \}/g)).map((m) => ({ code: m[1], country: m[3], flag: m[2] }));
    expect(live.length).toBe(20);
    expect(D.COUNTRY_CODES).toEqual(live);
  });
  it("GROUP_COUNTRIES (CreatePartnerGroupModal local const)", () => {
    const src = read("src/app/components/vendors/CreatePartnerGroupModal.tsx");
    const start = src.indexOf("const GROUP_COUNTRY_OPTIONS: { name: string; flag: string }[] = [");
    expect(start).toBeGreaterThan(0);
    const block = src.slice(start, src.indexOf("];", start));
    const live = Array.from(block.matchAll(/\{ name: "([^"]+)", flag: "([^"]+)" \}/g)).map((m) => ({ name: m[1], flag: m[2] }));
    expect(live.length).toBe(D.GROUP_COUNTRIES.length);
    expect(D.GROUP_COUNTRIES).toEqual(live);
  });
});

describe("spec objects", () => {
  it("Partners: 20 columns, key Partner Name, required Partner Name + Primary Partner Group", () => {
    expect(PARTNERS_IMPORT_SPEC.columns).toHaveLength(20);
    expect(PARTNERS_IMPORT_SPEC.keyColumn).toBe("partnerName");
    expect(PARTNERS_IMPORT_SPEC.columns.filter((c) => c.required).map((c) => c.label)).toEqual(["Partner Name", "Primary Partner Group"]);
    expect(PARTNERS_IMPORT_SPEC.exportFields.filter((f) => f.listing)).toHaveLength(22);
    expect(PARTNERS_IMPORT_SPEC.exportFields[0]).toMatchObject({ id: "partner_name", locked: true });
    expect(PARTNERS_IMPORT_SPEC.bulkSetFields).toEqual(["status", "partnerTypes"]);
  });
  it("Partner Groups: 18 columns, key Group Name, required Group Name", () => {
    expect(PARTNER_GROUPS_IMPORT_SPEC.columns).toHaveLength(18);
    expect(PARTNER_GROUPS_IMPORT_SPEC.keyColumn).toBe("groupName");
    expect(PARTNER_GROUPS_IMPORT_SPEC.columns.filter((c) => c.required).map((c) => c.label)).toEqual(["Group Name"]);
    expect(PARTNER_GROUPS_IMPORT_SPEC.exportFields.filter((f) => f.listing)).toHaveLength(11);
    expect(PARTNER_GROUPS_IMPORT_SPEC.exportFields[0]).toMatchObject({ id: "group", locked: true });
    expect(PARTNER_GROUPS_IMPORT_SPEC.bulkSetFields).toEqual(["status", "scope"]);
  });
  it("live option overlays match the snapshot options (so files and app agree)", () => {
    for (const spec of ALL_IMPORT_SPECS) {
      for (const c of spec.data.columns) {
        if (!c.options) continue;
        expect(findColumn(spec, c.key)?.options, `${spec.entity}.${c.key}`).toEqual(c.options);
      }
    }
  });
  it("every column key is unique and every header alias is unique within a spec", () => {
    for (const spec of ALL_IMPORT_SPECS) {
      const keys = spec.columns.map((c) => c.key);
      expect(new Set(keys).size).toBe(keys.length);
      const seen = new Map<string, string>();
      for (const c of spec.columns) {
        for (const h of [c.label, ...(c.aliases ?? [])]) {
          const n = normHeader(h);
          expect(seen.get(n) ?? c.key, `${spec.entity}: "${h}" claimed by ${seen.get(n)} and ${c.key}`).toBe(c.key);
          seen.set(n, c.key);
        }
      }
      expect(headerAliasMap(spec).size).toBe(seen.size);
    }
  });
  it("no em dashes in any user-facing string", () => {
    expect(JSON.stringify(D.ALL_ENTITY_DATA)).not.toContain("—");
  });
});
