/* Item Library, Categories, Partners and Partner Group validate an upload with
 * the rules copied from each home repo (src/app/components/data-imports/
 * modules/<slug>/, provenance in each file header). This test runs the same
 * rows through BOTH the home repo's live validator (read straight from the
 * sibling repo) and role-zen's copy, and requires the same status, the same
 * create / update decision and the same issues (field, code, severity,
 * message) on every row.
 *
 * Rows: the shipped template's example rows (public/templates/*.csv) plus
 * crafted rows per module: a new record, an update of an existing record, a
 * warning, errors, a duplicate key pair. The validation context is compared
 * too: role-zen's snapshot of the home seed data must equal the home repo's
 * live context.
 *
 * Opt-in: `npm run test:parity` (vitest.parity.config.ts). Also self-skips
 * when the sibling repos are not checked out next to role-zen. */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MODULE_IMPORT_DEFS, completeRow, type ModuleImportDef, type ModuleImportSlug, type ModuleRow } from "@/app/components/data-imports/modules/moduleImportDefs";
import { TEMPLATE_ONLY_MODULES } from "@/app/components/data-imports/templateOnlyModules";
import { COLUMNS as CATEGORY_COLUMNS } from "@/app/components/data-imports/modules/categories/spec";
import { ITEMS_IMPORT_SPEC } from "@/app/components/data-imports/modules/item-library/spec";
import { PARTNERS_IMPORT_SPEC, PARTNER_GROUPS_IMPORT_SPEC } from "@/app/components/data-imports/modules/partners/spec";

const WORKSPACE = path.resolve(__dirname, "../../..").split(path.sep).join("/");
const RZ = path.resolve(__dirname, "../..").split(path.sep).join("/");
const HOME = {
  categories: "../../../radiant-core-fusion/src/app",
  items: "../../../nimble-palette/src/app",
  partners: "../../../partner-management-module/src/app",
};
const haveHomes = Object.values(HOME).every((p) => existsSync(path.resolve(__dirname, p)));

/* The home modules, loaded through Vite (static glob, so a missing sibling
 * repo just yields no entry and the suite is skipped). */
const HOME_MODULES = import.meta.glob([
  "../../../radiant-core-fusion/src/app/import-export/validation.ts",
  "../../../radiant-core-fusion/src/app/import-export/values.ts",
  "../../../radiant-core-fusion/src/app/data/categories.ts",
  "../../../nimble-palette/src/app/import-export/validation.ts",
  "../../../nimble-palette/src/app/context/ItemsContext.tsx",
  "../../../partner-management-module/src/app/import-export/validation.ts",
  "../../../partner-management-module/src/app/import-export/spec.ts",
  "../../../partner-management-module/src/app/data/vendors.ts",
  "../../../partner-management-module/src/app/components/vendors/partnerConstants.tsx",
  "../../../radiant-core-fusion/src/app/import-export/fileParser.ts",
  "../../../nimble-palette/src/app/import-export/fileParser.ts",
  "../../../partner-management-module/src/app/import-export/fileParser.ts",
]);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const imp = async (p: string): Promise<any> => {
  const load = HOME_MODULES[p];
  if (!load) throw new Error(`not in the glob: ${p}`);
  return load();
};

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let q = false;
  const t = text.replace(/^﻿/, "");
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (q) {
      if (ch === '"') {
        if (t[i + 1] === '"') { cur += '"'; i++; } else q = false;
      } else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cur); cur = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && t[i + 1] === "\n") i++;
      row.push(cur); cur = "";
      if (row.some((c) => c !== "")) rows.push(row);
      row = [];
    } else cur += ch;
  }
  row.push(cur);
  if (row.some((c) => c !== "")) rows.push(row);
  return rows;
}

/** The shipped CSV template: header line + its example rows, keyed by column. */
function templateRows(def: ModuleImportDef, file: string): { header: string[]; rows: ModuleRow[] } {
  const [header, ...body] = parseCsv(readFileSync(`${RZ}/public/templates/${file}`, "utf8"));
  const keyByLabel = new Map(def.columns.map((c) => [c.label.toLowerCase(), c.key]));
  const rows = body.map((cells) => {
    const values: Record<string, string> = {};
    header.forEach((h, i) => {
      const key = keyByLabel.get(h.replace(/\s*\*\s*$/, "").trim().toLowerCase());
      if (key) values[key] = (cells[i] ?? "").trim();
    });
    return completeRow(def, values);
  });
  return { header, rows };
}

type AnyResult = { rows: { status: string; isUpdate: boolean; issues: { field: string; code: string; severity: string; message: string }[] }[] };

function shape(r: AnyResult) {
  return r.rows.map((row) => ({
    status: row.status,
    isUpdate: row.isUpdate,
    issues: row.issues.map((i) => `${i.field} | ${i.code} | ${i.severity} | ${i.message}`),
  }));
}

function sortedSet(s: Set<string> | undefined): string[] {
  return [...(s ?? new Set<string>())].sort();
}
function sortedMap(m: Map<string, string> | undefined): [string, string][] {
  return [...(m ?? new Map<string, string>()).entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

function withValues(def: ModuleImportDef, values: Record<string, string>): ModuleRow {
  return completeRow(def, values);
}

describe.skipIf(!haveHomes)("module import validation matches the home repos", () => {
  it("Categories: shipped template + crafted rows give the same statuses and issue codes", async () => {
    const def = MODULE_IMPORT_DEFS.categories;
    const home = await imp(`${HOME.categories}/import-export/validation.ts`);
    const homeValues = await imp(`${HOME.categories}/import-export/values.ts`);
    const homeSeed = await imp(`${HOME.categories}/data/categories.ts`);
    const homeCtx = { existingCodes: new Set<string>(homeSeed.CATEGORY_SEED.map((c: { code: string }) => homeValues.normalizeKey(c.code))) };
    const ctx = def.buildContext() as { existingCodes: Set<string> };
    expect(sortedSet(ctx.existingCodes)).toEqual(sortedSet(homeCtx.existingCodes));

    const { header, rows: tpl } = templateRows(def, "OMNE_Categories_Import_Template.csv");
    expect(header).toEqual(def.templateHeaders);
    const crafted = [
      withValues(def, { code: "C-9001", status: "Active", inventoryType: "Stock", uom: "Each" }),
      withValues(def, { code: "C-1001", description: "Updated from the import" }),
      withValues(def, { code: "C-9002", status: "Maybe", lotControlEnabled: "No", lotIdSource: "Vendor Lot" }),
      withValues(def, { code: "C-9003", uom: "Blorp", alternativeUnits: "Box=abc" }),
      withValues(def, { code: "", status: "Active" }),
      /* role-zen no longer caps descriptions (ERP-9664, 27 Oct 2026). Until the home
         repo drops its 5000 cap, this row is an expected difference. */
      withValues(def, { code: "C-9004", tags: "x".repeat(40), description: "d".repeat(5001) }),
      withValues(def, { code: "C-9005", acquisitionMethods: "Purchased|Stolen", primaryAcquisition: "Manufactured" }),
      withValues(def, { code: "c-9005" }),
    ];
    const rows = [...tpl, ...crafted];
    const got = shape(def.validate(rows, ctx) as AnyResult);
    const want = shape(home.validateRows(rows, homeCtx));
    expect(got).toEqual(want);
    expect(want.map((r) => r.status)).toEqual(expect.arrayContaining(["ready", "warning", "error"]));
    expect(want.some((r) => r.isUpdate)).toBe(true);
  });

  it("Items: shipped template + crafted rows give the same statuses and issue codes", async () => {
    const def = MODULE_IMPORT_DEFS["item-library"];
    const home = await imp(`${HOME.items}/import-export/validation.ts`);
    const homeItems = await imp(`${HOME.items}/context/ItemsContext.tsx`);
    const homeCtx = home.buildValidationContext(homeItems.INITIAL_ITEMS);
    const ctx = def.buildContext() as typeof homeCtx;
    expect(sortedSet(ctx.existingKeys)).toEqual(sortedSet(homeCtx.existingKeys));
    for (const k of ["knownCategories", "knownUnits", "unitCategory", "knownPriceUnits", "knownLocations", "knownPartners", "knownUsers", "knownApprovers"]) {
      expect(sortedMap(ctx[k]), k).toEqual(sortedMap(homeCtx[k]));
    }

    const { header, rows: tpl } = templateRows(def, "OMNE_Items_Import_Template.csv");
    expect(header).toEqual(def.templateHeaders);
    const existing = homeItems.INITIAL_ITEMS[0].partNumber as string;
    const crafted = [
      withValues(def, { partNumber: "NEW-PART-001", primaryCategory: "C-1004", status: "Active", unit: "Each" }),
      withValues(def, { partNumber: existing, description: "Updated from the import" }),
      withValues(def, { partNumber: "NEW-PART-002", primaryCategory: "C-1004", status: "Pending", inboundLocations: "Nowhere Dock" }),
      withValues(def, { partNumber: "NEW-PART-003", primaryCategory: "", unit: "Blorp", minStock: "ten" }),
      withValues(def, { partNumber: "NEW-PART-004", primaryCategory: "Z-0000", minStock: "50", maxStock: "10", pricing: "abc" }),
      withValues(def, { partNumber: "NEW-PART-005", primaryCategory: "C-1004", sellingScope: "Specific", lotControl: "No", lotIdSource: "Vendor Lot" }),
      withValues(def, { partNumber: "new-part-005", primaryCategory: "C-1004" }),
    ];
    const rows = [...tpl, ...crafted];
    const got = shape(def.validate(rows, ctx) as AnyResult);
    const want = shape(home.validateRows(rows, homeCtx));
    expect(got).toEqual(want);
    expect(want.map((r) => r.status)).toEqual(expect.arrayContaining(["ready", "warning", "error"]));
    expect(want.some((r) => r.isUpdate)).toBe(true);
  });

  for (const slug of ["partners", "partner-groups"] as const) {
    it(`${slug}: shipped template + crafted rows give the same statuses and issue codes`, async () => {
      const def = MODULE_IMPORT_DEFS[slug];
      const home = await imp(`${HOME.partners}/import-export/validation.ts`);
      const homeSpec = await imp(`${HOME.partners}/import-export/spec.ts`);
      const vendors = await imp(`${HOME.partners}/data/vendors.ts`);
      const pc = await imp(`${HOME.partners}/components/vendors/partnerConstants.tsx`);
      const spec = slug === "partners" ? homeSpec.PARTNERS_IMPORT_SPEC : homeSpec.PARTNER_GROUPS_IMPORT_SPEC;
      const groups = pc.PARTNER_GROUPS.map((g: { name: string }) => ({ name: g.name }));
      const homeCtx = home.buildValidationContext(spec, vendors.mockVendors, groups);
      const ctx = def.buildContext() as typeof homeCtx;
      for (const k of ["existingKeys", "groups", "partners", "contacts"]) {
        expect(sortedSet(ctx[k]), k).toEqual(sortedSet(homeCtx[k]));
      }
      /* Same columns: keys, labels, required flags, kinds and resolved options. */
      expect(def.columns.map((c) => [c.key, c.label, c.required, c.kind, c.options ?? null])).toEqual(
        spec.columns.map((c: { key: string; label: string; required?: boolean; kind: string; options?: string[] }) => [
          c.key, c.label, !!c.required, c.kind, c.options && c.options.length > 0 ? c.options : null,
        ]),
      );

      const file = slug === "partners" ? "OMNE_Partners_Import_Template.csv" : "OMNE_Partner_Groups_Import_Template.csv";
      const { header, rows: tpl } = templateRows(def, file);
      expect(header).toEqual(def.templateHeaders);
      const crafted =
        slug === "partners"
          ? [
              withValues(def, { partnerName: "Brand New Partner Co", primaryPartnerGroup: "Tier 1 Automotive OEMs", status: "Active" }),
              withValues(def, { partnerName: vendors.mockVendors[0].displayName, description: "Updated from the import" }),
              withValues(def, { partnerName: "Warning Partner", primaryPartnerGroup: "Tier 1 Automotive OEMs", status: "Pending", phone: "12" }),
              withValues(def, { partnerName: "Error Partner", primaryPartnerGroup: "No Such Group", email: "not-an-email" }),
              withValues(def, { partnerName: "Error Partner 2", partnerGroups: "Brake Systems", primaryPartnerGroup: "Tier 1 Automotive OEMs" }),
              withValues(def, { partnerName: "", status: "Active" }),
              withValues(def, { partnerName: "Dup Partner", primaryPartnerGroup: "Brake Systems" }),
              withValues(def, { partnerName: "dup partner", primaryPartnerGroup: "Brake Systems" }),
            ]
          : [
              withValues(def, { groupName: "Brand New Group", status: "Active" }),
              withValues(def, { groupName: pc.PARTNER_GROUPS[0].name, description: "Updated from the import" }),
              withValues(def, { groupName: "Warning Group", status: "Pending", memberIds: "Nobody Inc" }),
              withValues(def, { groupName: "Error Group", warningThreshold: "150", maxCreditLimit: "abc" }),
              withValues(def, { groupName: "", status: "Active" }),
              withValues(def, { groupName: "Dup Group" }),
              withValues(def, { groupName: "DUP GROUP" }),
            ];
      const rows = [...tpl, ...crafted];
      const got = shape(def.validate(rows, ctx) as AnyResult);
      const want = shape(home.validateRows(spec, rows, homeCtx));
      expect(got).toEqual(want);
      expect(want.map((r) => r.status)).toEqual(expect.arrayContaining(["ready", "warning", "error"]));
      expect(want.some((r) => r.isUpdate)).toBe(true);
    });
  }

  /* Header aliases: an upload whose header row uses the home spec's
   * alternate names, "*" and "(required)" markers and odd case / spacing
   * must parse to the same rows as the home parser, then validate the same. */
  const ALIASES: Record<ModuleImportSlug, { key: string; aliases: readonly string[] }[]> = {
    categories: CATEGORY_COLUMNS.map((c) => ({ key: c.key, aliases: c.aliases })),
    "item-library": ITEMS_IMPORT_SPEC.columns.map((c) => ({ key: c.key, aliases: c.aliases.slice(1) })),
    partners: PARTNERS_IMPORT_SPEC.columns.map((c) => ({ key: c.key, aliases: c.aliases ?? [] })),
    "partner-groups": PARTNER_GROUPS_IMPORT_SPEC.columns.map((c) => ({ key: c.key, aliases: c.aliases ?? [] })),
  };
  const TEMPLATE_CSV: Record<ModuleImportSlug, string> = {
    categories: "OMNE_Categories_Import_Template.csv",
    "item-library": "OMNE_Items_Import_Template.csv",
    partners: "OMNE_Partners_Import_Template.csv",
    "partner-groups": "OMNE_Partner_Groups_Import_Template.csv",
  };
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

  for (const slug of ["categories", "item-library", "partners", "partner-groups"] as const) {
    it(`${slug}: an aliased header row parses and validates like the home parser`, async () => {
      const def = MODULE_IMPORT_DEFS[slug];
      const cols = ALIASES[slug];
      /* Every column under an alias (the last one listed), or its label when
       * it has none; markers and spacing varied the way real files are. */
      const header = def.columns.map((c, i) => {
        const a = cols[i].aliases;
        const base = a.length > 0 ? a[a.length - 1] : c.label;
        const spaced = i % 2 ? base.toUpperCase() : `  ${base.replace(/ /g, "  ")} `;
        return c.required ? (i % 3 === 0 ? `${spaced} (required)` : `${spaced} *`) : spaced;
      });
      expect(header.some((h, i) => cols[i].aliases.length > 0 && !h.toLowerCase().includes(def.columns[i].label.toLowerCase()))).toBe(true);
      const { rows: tpl } = templateRows(def, TEMPLATE_CSV[slug]);
      const csv = [header.map(esc).join(","), ...tpl.map((r) => def.columns.map((c) => esc(r[c.key] ?? "")).join(","))].join("\n");

      const ours = await TEMPLATE_ONLY_MODULES[slug].parseFile({ name: "aliased.csv", text: async () => csv } as unknown as File);
      const ourRows = (ours.rows as { values: Record<string, string> }[]).map((r) => completeRow(def, r.values));

      let homeRows: ModuleRow[];
      if (slug === "categories") {
        const p = await imp(`${HOME.categories}/import-export/fileParser.ts`);
        homeRows = p.parseImportText(csv).rows;
      } else if (slug === "item-library") {
        const p = await imp(`${HOME.items}/import-export/fileParser.ts`);
        homeRows = p.gridToRows(p.parseCsvText(csv)).rows;
      } else {
        const p = await imp(`${HOME.partners}/import-export/fileParser.ts`);
        const s = await imp(`${HOME.partners}/import-export/spec.ts`);
        homeRows = p.parseGrid(slug === "partners" ? s.PARTNERS_IMPORT_SPEC : s.PARTNER_GROUPS_IMPORT_SPEC, p.parseCSV(csv)).rows;
      }
      expect(ourRows).toEqual(homeRows.map((r) => completeRow(def, r)));
      expect(ourRows).toEqual(tpl);
      const ctx = def.buildContext();
      expect(shape(def.validate(ourRows, ctx) as AnyResult)).toEqual(shape(def.validate(homeRows.map((r) => completeRow(def, r)), ctx) as AnyResult));
    });
  }
});
