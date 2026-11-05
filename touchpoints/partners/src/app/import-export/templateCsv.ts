/* CSV template + companion Guide txt, parameterised by spec. The text
 * builders live in `templateText.mjs` (shared with the Node generator). */

import type { EntitySpec } from "./spec";
import { triggerTextDownload } from "./download";
import { buildGuideText as guideFor, buildTemplateCsv as csvFor, GUIDE_WIDTH } from "./templateText.mjs";

export { GUIDE_WIDTH };

/** UTF-8 without BOM, LF line endings, " *" on required headers, two example rows. */
export function buildTemplateCsv(spec: EntitySpec<unknown>): string {
  return csvFor(spec.data);
}

/** 66-column wrapped guide: "=" banner, "-" section dividers, UAC section format. */
export function buildGuideText(spec: EntitySpec<unknown>): string {
  return guideFor(spec.data);
}

/** Delay between the CSV and its companion guide download (mirrors UAC). */
export const GUIDE_DOWNLOAD_DELAY_MS = 400;

/** Download the CSV, then the guide 400 ms later. Returns both filenames. */
export function downloadTemplateCsv(spec: EntitySpec<unknown>): { csv: string; guide: string } {
  const csv = spec.template.csvFileName;
  const guide = spec.template.guideFileName;
  triggerTextDownload(csv, buildTemplateCsv(spec), "text/csv;charset=utf-8");
  setTimeout(() => triggerTextDownload(guide, buildGuideText(spec)), GUIDE_DOWNLOAD_DELAY_MS);
  return { csv, guide };
}
