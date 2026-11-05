/* ═══════════════════════════════════════════════════════════════════
 *  Rows of the version compare summary cards (Version History modal
 *  and Versions tab, Quotes and Sales Orders). Each caller lists its
 *  rows as CompareField entries, so a new row is one entry.
 *
 *  A value is text or a list (warehouse names, for example). A list
 *  reads as one comma separated line, with an en dash when it is empty,
 *  and compares as a set so a reorder is not a change. Rows of kind
 *  "status" render as the status pill instead of plain text.
 *
 *  Kept identical between the Quotes and Sales Order repos.
 * ═══════════════════════════════════════════════════════════════════ */

export type CompareValue = string | string[];

export interface CompareField {
  label: string;
  val1: CompareValue;
  val2: CompareValue;
  kind?: "status";
}

/** Shown for an empty value. */
export const EMPTY_COMPARE_VALUE = "–";

export function compareValueText(value: CompareValue): string {
  if (Array.isArray(value)) return value.length ? value.join(", ") : EMPTY_COMPARE_VALUE;
  return value || EMPTY_COMPARE_VALUE;
}

const listKey = (list: string[]) => [...list].sort().join("\u0000");

/** True when the two versions differ on this row (lists ignore order). */
export function compareValuesDiffer(a: CompareValue, b: CompareValue): boolean {
  if (Array.isArray(a) || Array.isArray(b)) return listKey(([] as string[]).concat(a)) !== listKey(([] as string[]).concat(b));
  return a !== b;
}

/** Whether a changed row reads as a number going up or down (counts,
 *  money). Lists and status rows never do. */
export function isNumericCompare(field: CompareField): boolean {
  if (field.kind || Array.isArray(field.val1) || Array.isArray(field.val2)) return false;
  const n1 = Number(field.val1.replace(/[^0-9.-]/g, ""));
  const n2 = Number(field.val2.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n1) && Number.isFinite(n2) && n1 !== n2;
}

export function compareNumbers(field: CompareField): { n1: number; n2: number } {
  return {
    n1: Number(String(field.val1).replace(/[^0-9.-]/g, "")),
    n2: Number(String(field.val2).replace(/[^0-9.-]/g, "")),
  };
}
