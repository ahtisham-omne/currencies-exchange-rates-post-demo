/* Writes the checked-in import templates into public/templates:
 *   Omne_Partners_Import_Template.{xlsx,csv}  Omne_Partners_Import_Guide.txt
 *   Omne_Partner_Groups_Import_Template.{xlsx,csv}  Omne_Partner_Groups_Import_Guide.txt
 *
 * The layout and text come from the same modules the app uses
 * (src/app/import-export/templateLayout.mjs, templateText.mjs, spec.data.mjs),
 * so the shipped files and the in-app downloads can never drift.
 *
 * Run from the repo root:  node scripts/gen-import-templates.mjs */
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ALL_ENTITY_DATA } from "../src/app/import-export/spec.data.mjs";
import { buildTemplateWorkbook } from "../src/app/import-export/templateLayout.mjs";
import { buildGuideText, buildTemplateCsv } from "../src/app/import-export/templateText.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(here, "../public/templates");
mkdirSync(outDir, { recursive: true });

/* ExcelJS stamps every zip entry with the current time; re-pack with a fixed
 * date so the shipped xlsx only changes when its content does. */
const FIXED_DATE = new Date("2026-09-29T00:00:00.000Z");
async function pinZipDates(buf) {
  const src = await JSZip.loadAsync(buf);
  const out = new JSZip();
  for (const name of Object.keys(src.files)) {
    const f = src.files[name];
    if (f.dir) continue;
    out.file(name, await f.async("uint8array"), { date: FIXED_DATE, createFolders: false });
  }
  return out.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

for (const data of ALL_ENTITY_DATA) {
  const wb = buildTemplateWorkbook(ExcelJS, data);
  /* Pinned so re-running the script leaves the shipped files byte-identical. */
  wb.created = new Date("2026-09-29T00:00:00.000Z");
  wb.modified = wb.created;
  writeFileSync(path.join(outDir, `${data.fileBase}.xlsx`), await pinZipDates(await wb.xlsx.writeBuffer()));
  writeFileSync(path.join(outDir, `${data.fileBase}.csv`), buildTemplateCsv(data), "utf8");
  writeFileSync(path.join(outDir, data.guideFile), buildGuideText(data), "utf8");
  console.log(`wrote ${data.fileBase}.xlsx, ${data.fileBase}.csv, ${data.guideFile}`);
}
