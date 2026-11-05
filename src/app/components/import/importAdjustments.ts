import type { ImportRecord } from "./importModel";
import { parseAdjustment } from "./importParse";

/**
 * One-time adjustments, between the spreadsheet and the module.
 *
 * A discount or premium that exists only on this record (as opposed to a
 * pricing rule, which is a reusable entity owned by Partners) travels in
 * the template as a short string: `Expedited Build:+4500`, `Grant
 * Discount:-2%`, several separated by `|`. That notation is compact
 * enough for a spreadsheet cell and unambiguous because the label is
 * split off at the LAST colon, so labels may contain colons themselves.
 *
 * The module, on the other hand, thinks in `Adjustment` objects with a
 * scope, an applied-to set and an is-applied flag. This file is the only
 * place that translation happens, so the review sheet, the adjustments
 * modal and the materializer all agree on what a cell means.
 *
 * Where scope comes from
 * ─────────────────────────────────────────────────────────────────────
 * The column, not the string: the record-level column is order
 * scope, the `Line /` column is item scope applied to that line. An
 * item-scope adjustment covering three lines therefore writes the same
 * entry into three cells, which round-trips as three single-line
 * adjustments. The money is identical; only the grouping is lost, and a
 * spreadsheet column has nowhere to put the grouping.
 */

export interface ParsedAdjustment {
  label: string;
  type: "discount" | "premium";
  amountType: "$" | "%";
  amount: number;
}

/** `Expedited Build:+4500 | Grant Discount:-2%` → two entries. */
export function parseAdjustmentList(raw: string | undefined): ParsedAdjustment[] {
  const out: ParsedAdjustment[] = [];
  for (const entry of (raw ?? "").split("|").map((s) => s.trim()).filter(Boolean)) {
    const parsed = parseAdjustment(entry);
    if (!parsed) continue;
    const value = parsed.value.replace(/,/g, "");
    const num = parseFloat(value.replace(/[+%]/g, ""));
    if (Number.isNaN(num)) continue;
    out.push({
      label: parsed.label,
      /* A leading minus is the only discount marker the template has;
         everything else adds cost. */
      type: value.trim().startsWith("-") ? "discount" : "premium",
      amountType: value.includes("%") ? "%" : "$",
      amount: Math.abs(num),
    });
  }
  return out;
}

export function serializeAdjustment(a: ParsedAdjustment): string {
  const sign = a.type === "discount" ? "-" : "+";
  return `${a.label}:${sign}${a.amount}${a.amountType === "%" ? "%" : ""}`;
}

export function serializeAdjustmentList(list: ParsedAdjustment[]): string {
  return list.map(serializeAdjustment).join(" | ");
}

/** Dollar impact of one entry against a base, for the sheet's own
 *  summaries. Percentages resolve against the base; absolutes don't. */
export function adjustmentImpact(a: ParsedAdjustment, base: number): number {
  const magnitude = a.amountType === "%" ? base * (a.amount / 100) : a.amount;
  return a.type === "discount" ? -magnitude : magnitude;
}

/** Net impact of a whole cell, used by the chips' summary tooltip. */
export function netImpact(list: ParsedAdjustment[], base: number): number {
  return list.reduce((sum, a) => sum + adjustmentImpact(a, base), 0);
}

/* ── Record-wide view ─────────────────────────────────────────────── */

/** Column keys, which differ by module: quote-level vs order-level. */
export const RECORD_ADJUSTMENT_KEY = "orderLevelDiscountPremium";
export const LINE_ADJUSTMENT_KEY = "lineDiscountPremium";

export function countAdjustments(record: ImportRecord): number {
  return (
    parseAdjustmentList(record.values[RECORD_ADJUSTMENT_KEY]).length +
    record.lines.reduce((n, l) => n + parseAdjustmentList(l.values[LINE_ADJUSTMENT_KEY]).length, 0)
  );
}

/** The module's own `Adjustment` shape, for seeding a real adjustments
 *  API on the detail page. Typed loosely here so this file stays free of
 *  a dependency on the detail page's hook. */
export interface ModuleAdjustment {
  id: string;
  label: string;
  type: "discount" | "premium";
  amountType: "$" | "%";
  amount: number;
  scope: "quote" | "item";
  appliedTo?: string[];
  isApplied: boolean;
}

/**
 * Every adjustment on a record, in the module's shape.
 *
 * `lineIdFor` maps an import line to the id the created record's line
 * will carry, so item-scope adjustments point at real lines once the
 * record exists rather than at import-time ids.
 */
export function toModuleAdjustments(
  record: ImportRecord,
  lineIdFor: (lineIndex: number) => string,
  idPrefix = "ADJ",
): ModuleAdjustment[] {
  const out: ModuleAdjustment[] = [];
  parseAdjustmentList(record.values[RECORD_ADJUSTMENT_KEY]).forEach((a, i) => {
    out.push({ id: `${idPrefix}-R${i}`, ...a, scope: "quote", isApplied: true });
  });
  record.lines.forEach((line, li) => {
    parseAdjustmentList(line.values[LINE_ADJUSTMENT_KEY]).forEach((a, i) => {
      out.push({
        id: `${idPrefix}-L${li}-${i}`,
        ...a,
        scope: "item",
        appliedTo: [lineIdFor(li)],
        isApplied: true,
      });
    });
  });
  return out;
}
