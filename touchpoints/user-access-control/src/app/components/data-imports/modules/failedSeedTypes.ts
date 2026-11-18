/* The row shape of each module's seeded "June" import (failedSeed.ts under
 * ./<slug>/): one past import whose rows, taken together, trip every rule
 * that module's validator can raise. The rows are what live validation reads
 * on the record page, so every failure shown there comes from the real rule,
 * never from a stored message. */

export interface SeedCase {
  /** Created rows landed (warnings allowed, never an error); Failed rows carry at least one error. */
  outcome: "Created" | "Failed";
  /** The rule this row demonstrates, in plain words (the coverage table). */
  rule: string;
  /** Cells that differ from the template's example row 1 (a row that passes). */
  values: Record<string, string>;
  /** Issues this row must raise: "field:CODE", optionally "~fragment" of the
   *  message; "@update" means the key matches an existing record. */
  demonstrates: string[];
}

/** A long description (over 5000 characters): a realistic paragraph, repeated.
 *  Omne does not cap descriptions, so a row carrying one imports in full. */
export function longText(paragraph: string, min = 5000): string {
  let out = paragraph;
  while (out.length <= min) out += ` ${paragraph}`;
  return out;
}
