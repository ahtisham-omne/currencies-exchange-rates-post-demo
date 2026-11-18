/* Regenerates the Physical Inventory templates under public/templates
 * (xlsx, csv, guide per control-type tab). Skipped in the normal run:
 *   GEN_PI_TEMPLATES=1 npx vitest run src/test/physical-inventory-templates.gen.test.ts
 * ExcelJS stamps the time into the zip, so the archive is re-packed with a
 * pinned date and the shipped files stay byte-identical across runs. */

import { it } from "vitest";
import { writeFileSync } from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { PI_TABS, piGuideText, piTemplateCsv, piTemplateFiles, piTemplateSpec } from "@/app/components/data-imports/modules/physical-inventory/piModule";
import { buildTemplateWorkbook } from "@/app/components/data-imports/modules/physical-inventory/templateLayout.mjs";

const DIR = path.resolve(__dirname, "../../public/templates");
const PINNED = new Date(Date.UTC(2026, 0, 1));

it.skipIf(!process.env.GEN_PI_TEMPLATES)("generates the Physical Inventory templates", async () => {
  for (const t of PI_TABS) {
    const f = piTemplateFiles(t.mode);
    const wb = buildTemplateWorkbook(ExcelJS as never, piTemplateSpec(t.mode));
    wb.modified = PINNED;
    wb.created = PINNED;
    wb.lastModifiedBy = "Omne";
    const zip = await JSZip.loadAsync(await wb.xlsx.writeBuffer());
    zip.forEach((_, e) => { e.date = PINNED; });
    writeFileSync(path.join(DIR, f.templateXlsxFilename), await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
    writeFileSync(path.join(DIR, f.templateCsvFilename), piTemplateCsv(t.mode));
    writeFileSync(path.join(DIR, f.guideFilename), piGuideText(t.mode));
  }
}, 60000);
