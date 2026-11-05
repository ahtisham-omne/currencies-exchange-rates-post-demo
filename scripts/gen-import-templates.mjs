/* Writes the Items import template files into public/templates:
 *   OMNE_Items_Import_Template.xlsx   four-sheet workbook (Data Entry, Instructions, Field Reference, Valid Values)
 *   OMNE_Items_Import_Template.csv    header row + two example rows, UTF-8, no BOM, LF
 *   OMNE_Items_Import_Guide.txt       the CSV's plain-text companion, 66-column wrap
 *
 * Layout and copy come from src/app/import-export/templateLayout.mjs and
 * spec.data.mjs, the same modules the app uses, so the checked-in files are
 * identical to what the in-app generator produces.
 *
 * Run from the repo root:  node scripts/gen-import-templates.mjs [outDir] */
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildGuideText,
  buildTemplateCsvText,
  buildTemplateModel,
  buildWorkbookWith,
} from "../src/app/import-export/templateLayout.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(process.argv[2] ?? join(here, "..", "public", "templates"));
mkdirSync(outDir, { recursive: true });

const model = buildTemplateModel();

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

const wb = buildWorkbookWith(ExcelJS, model);
/* Fixed document properties so a regenerated file only changes when the content does. */
wb.creator = "Omne";
wb.lastModifiedBy = "Omne";
wb.created = new Date("2026-09-29T00:00:00.000Z");
wb.modified = wb.created;
writeFileSync(join(outDir, `${model.fileBase}.xlsx`), await pinZipDates(await wb.xlsx.writeBuffer()));

writeFileSync(join(outDir, `${model.fileBase}.csv`), buildTemplateCsvText(model), "utf8");
writeFileSync(join(outDir, model.guideFile), buildGuideText(model), "utf8");

console.log(`templates written to ${outDir}`);
console.log(`  ${model.fileBase}.xlsx, ${model.fileBase}.csv, ${model.guideFile}`);
