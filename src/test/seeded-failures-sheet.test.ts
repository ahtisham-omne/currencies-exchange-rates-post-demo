/* The seeded June import of each sheet module (Quotes, Sales Orders) is the
 * showcase of what can go wrong in an import: its records must, between them,
 * trigger every rule sheet-import/sheetValidation.ts applies to that module.
 * The rules a module can hit are derived from its spec, so adding a column
 * kind, a catalog or an alias that maps into a vocabulary makes this fail
 * until the seed shows it too. */

import { describe, expect, it } from "vitest";
import { EXISTING_QUOTE_NUMBERS, QUOTES_SPEC } from "../app/components/data-imports/quotes/quotesSpec";
import { QUOTES_MOCK_SEED } from "../app/components/data-imports/quotes/quotesMockData";
import { EXISTING_SO_NUMBERS, SALES_ORDERS_SPEC } from "../app/components/data-imports/sales-orders/salesOrdersSpec";
import { SALES_ORDERS_MOCK_SEED } from "../app/components/data-imports/sales-orders/salesOrdersMockData";
import { validateRows } from "../app/components/data-imports/sheet-import/sheetValidation";
import type { SheetImportSpec } from "../app/components/data-imports/sheet-import/sheetSpec";
import type { CellIssue, SheetRow } from "../app/components/data-imports/sheet-import/sheetRecords";
import type { SheetMockSeed } from "../app/components/data-imports/sheet-import/sheetImportStore";

/** Which validator branch produced an issue, read off its message. */
function ruleOf(issue: CellIssue): string {
  const m = issue.message;
  if (/ is required\.$/.test(m)) return "required";
  if (/ is blank\.$/.test(m)) return "conditional-blank";
  if (/ is not a number\.$/.test(m)) return "not-a-number";
  if (/ cannot be negative\.$/.test(m)) return "negative";
  if (/ is not a date Omne reads\.$/.test(m)) return "bad-date";
  if (/ in Omne and imports as /.test(m) && / is not a /.test(m)) return "dropdown-alias";
  if (/ Omne holds\.$/.test(m)) return "dropdown-unknown";
  if (/ matches .* in Omne and imports as /.test(m)) return "catalog-alias";
  if (/ does not exist in Omne yet\.$/.test(m)) return "catalog-unknown";
  if (/ appears twice in this file/.test(m)) return "duplicate-key";
  if (/ already exists in /.test(m)) return "existing-key";
  throw new Error(`Unclassified issue: ${m}`);
}

function aliasMapsInto(spec: SheetImportSpec, values: readonly string[]): boolean {
  const lower = values.map((v) => v.toLowerCase());
  return Object.values(spec.aliases).some((to) => lower.includes(to.toLowerCase()));
}

/** Every rule path the spec makes reachable on the record page. */
function expectedPaths(spec: SheetImportSpec): Set<string> {
  const out = new Set<string>(["duplicate-key", "existing-key"]);
  for (const col of spec.columns) {
    const lvl = col.level;
    if (col.requirement === "required") out.add(`required:${lvl}`);
    if (col.requirement === "conditional" && col.conditionalNote) out.add(`conditional-blank:${lvl}`);
    if (col.kind === "number") { out.add(`not-a-number:${lvl}`); out.add(`negative:${lvl}`); }
    if (col.kind === "date") out.add(`bad-date:${lvl}`);
    if (col.set) {
      out.add(`dropdown-unknown:${col.key}`);
      if (aliasMapsInto(spec, col.set)) out.add(`dropdown-alias:${lvl}`);
    }
    if (col.catalog) {
      out.add(`catalog-unknown:${col.catalog}`);
      if (col.list) out.add(`catalog-unknown-list:${lvl}`);
      if (aliasMapsInto(spec, spec.catalogs[col.catalog] ?? [])) out.add(`catalog-alias:${lvl}`);
    }
  }
  return out;
}

function observedPaths(spec: SheetImportSpec, rows: SheetRow[]): Set<string> {
  const out = new Set<string>();
  const byKey = new Map(spec.columns.map((c) => [c.key, c]));
  for (const row of rows) {
    for (const issue of row.issues) {
      const rule = ruleOf(issue);
      const col = byKey.get(issue.field)!;
      if (rule === "duplicate-key" || rule === "existing-key") { out.add(rule); continue; }
      if (rule === "dropdown-unknown") { out.add(`dropdown-unknown:${col.key}`); continue; }
      if (rule === "catalog-unknown") {
        out.add(`catalog-unknown:${col.catalog}`);
        if (col.list) out.add(`catalog-unknown-list:${col.level}`);
        continue;
      }
      out.add(`${rule}:${col.level}`);
    }
  }
  return out;
}

const MODULES: Array<[string, SheetImportSpec, SheetMockSeed, readonly string[]]> = [
  ["Quotes", QUOTES_SPEC, QUOTES_MOCK_SEED, EXISTING_QUOTE_NUMBERS],
  ["Sales Orders", SALES_ORDERS_SPEC, SALES_ORDERS_MOCK_SEED, EXISTING_SO_NUMBERS],
];

describe.each(MODULES)("%s seeded imports", (_name, spec, seed, existingKeys) => {
  const june = seed.entries.find((e) => e.entry.id === `imp-${spec.slug}-3`)!;

  it("keeps the June import's id, name and date", () => {
    expect(june.entry.name).toBe(`${spec.recordLabelPlural} June update`);
    expect(june.entry.dateISO).toBe("2026-07-20T11:12:00.000Z");
  });

  it("June failures cover every rule the validator applies to this module", () => {
    const missing = [...expectedPaths(spec)].filter((p) => !observedPaths(spec, june.rows).has(p));
    expect(missing).toEqual([]);
  });

  it("stored issues are what live validation produces (the record page re-validates on edit)", () => {
    for (const { rows } of seed.entries) {
      const live = validateRows(rows.map((r) => ({ ...r, issues: [] })), spec, { existingKeys });
      expect(live.map((r) => r.issues)).toEqual(rows.map((r) => r.issues));
    }
  });

  it("every failed row carries an error and every imported row carries none", () => {
    for (const { rows } of seed.entries) {
      for (const row of rows) {
        const errors = row.issues.filter((i) => i.level === "error");
        if (row._outcome === "Created") expect(errors, `${spec.slug} row ${row._row}`).toEqual([]);
        else expect(errors.length, `${spec.slug} row ${row._row}`).toBeGreaterThan(0);
      }
    }
  });

  it("the June import has imported, warning and failed records", () => {
    const failed = june.rows.filter((r) => r._outcome !== "Created");
    const warned = june.rows.filter((r) => r._outcome === "Created" && r.issues.length > 0);
    expect(failed.length).toBeGreaterThan(10);
    expect(warned.length).toBeGreaterThan(0);
    expect(june.rows.filter((r) => r._outcome === "Created").length).toBeGreaterThan(warned.length);
  });

  it("a clean Customer > Location pair passes and an unknown site under a real customer fails", () => {
    const locations = june.rows.flatMap((r) =>
      r.values.deliveryLocation ? [[r.values.deliveryLocation, r.issues.some((i) => i.field === "deliveryLocation")] as const] : [],
    );
    expect(locations.some(([v, flagged]) => v.includes(">") && !flagged)).toBe(true);
    expect(locations.some(([v, flagged]) => v.includes(">") && flagged)).toBe(true);
  });

  it("history counts match the stored rows", () => {
    for (const { entry, rows } of seed.entries) {
      expect(entry.recordCount).toBe(rows.length);
      expect(entry.importedCount).toBe(rows.filter((r) => r._outcome === "Created").length);
      expect(entry.failedCount).toBe(rows.filter((r) => r._outcome !== "Created").length);
    }
  });

  it("the July and initial imports are clean", () => {
    for (const { entry, rows } of seed.entries.filter((e) => e.entry.id !== june.entry.id)) {
      expect(rows.flatMap((r) => r.issues.map((i) => `${entry.id} row ${r._row}: ${i.message}`))).toEqual([]);
    }
  });
});
