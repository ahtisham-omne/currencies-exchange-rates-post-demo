/* CSV template and Guide txt for the Items import. Text is produced by
 * templateLayout.mjs (shared with the Node script); this module is the typed
 * surface plus Blob helpers. */

import type { EntitySpec } from "./spec";
import { buildGuideText as buildGuideTextFromModel, buildTemplateCsvText, wrapText, GUIDE_WIDTH } from "./templateLayout.mjs";

export { wrapText, GUIDE_WIDTH };

/** CSV text: header row (" *" on required) + two example rows. UTF-8, no BOM, LF, RFC-4180. */
export function buildTemplateCsv(spec: EntitySpec): string {
  return buildTemplateCsvText(spec.template);
}

/** The CSV's plain-text companion (66-column wrap, "=" banner, "-" dividers). */
export function buildGuideText(spec: EntitySpec): string {
  return buildGuideTextFromModel(spec.template);
}

export function buildTemplateCsvBlob(spec: EntitySpec): Blob {
  return new Blob([buildTemplateCsv(spec)], { type: "text/csv;charset=utf-8" });
}

export function buildGuideBlob(spec: EntitySpec): Blob {
  return new Blob([buildGuideText(spec)], { type: "text/plain;charset=utf-8" });
}
