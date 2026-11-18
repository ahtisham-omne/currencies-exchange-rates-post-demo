/* Provenance: your-invoice-mate/src/app/components/import-adjustment/template.ts
 * sha256 2b3c5fb275cf74ef0a6d5bfb176e68a6ebda24560d86017f6ffca03847a43da7
 * Copied into role-zen 2026-09-30. Edits: 1 import line(s) rewritten for role-zen (see git diff vs source); rules and copy unchanged. */
/* The downloadable import template for Adjust Inventory > Import, per control
 * type: the 4-tab xlsx (Data Entry, Instructions, Field Reference, Valid
 * Values) and the matching CSV. The layout is the shared Omne standard
 * (templateLayout.mjs, copied from the module repos, with row heights from
 * textMeasure.mjs); this file only supplies Physical Inventory's content. */

import { LOCATION_DESCRIPTIONS } from "./piData";
import { buildTemplateCsv, buildTemplateWorkbook, type ExcelJSLike, type TemplateColumn, type TemplateSpec } from "./templateLayout.mjs";
import { exampleFor } from "./validation";
import type { ImportColumn, ImportValidationContext, TrackingMode } from "./types";

/** "Serial Units", "Stock Lines": the entity every heading names. */
export const TEMPLATE_ENTITY: Record<TrackingMode, string> = {
  serialized: "Serial Units",
  "non-serialized": "Stock Lines",
  "lot-serialized": "LOT Serial Units",
  lot: "LOT Units",
};

/** OMNE_<Entity>_Import_Template.<ext>, the name every Omne import template downloads as. */
export function importTemplateFileName(mode: TrackingMode, fmt: "excel" | "csv"): string {
  return `OMNE_${TEMPLATE_ENTITY[mode].replace(/\s+/g, "_")}_Import_Template.${fmt === "excel" ? "xlsx" : "csv"}`;
}

const isLotMode = (mode: TrackingMode) => mode === "lot" || mode === "lot-serialized";

function secondExample(col: ImportColumn, ctx: ImportValidationContext): string {
  switch (col.kind) {
    case "qty": return "40";
    case "uom": return ctx.uoms[1] ?? ctx.uoms[0] ?? "EA";
    case "price": return "";
    case "location": return ctx.knownLocations[1] ?? ctx.knownLocations[0] ?? "";
    case "reason": return ctx.reasons[1]?.label ?? "";
    default:
      if (col.key === "lotNumber") return ctx.mode === "lot" ? (ctx.existingLots[1]?.lot ?? "LOT-112001") : (ctx.existingLots[0]?.lot ?? "LOT-112000");
      return "SN-4002";
  }
}

function reference(col: ImportColumn, ctx: ImportValidationContext): TemplateColumn["reference"] {
  const example = exampleFor(col, ctx);
  switch (col.key) {
    case "serialNumber":
      return {
        description: "The serial number printed on the unit. One row per unit. It must not already be in use in Omne or appear twice in the file.",
        format: "Text",
        validValues: "",
        example,
      };
    case "lotNumber":
      return {
        description: "The LOT the stock is added to. A LOT number already on this item adds to that LOT; any other LOT number creates a new LOT.",
        format: "Text",
        validValues: "See Existing LOTs on the Valid Values sheet",
        example,
      };
    case "qty":
      return { description: "Quantity to add, in the row's unit of measure. Must be more than zero.", format: "Number", validValues: "", example };
    case "uom":
      return {
        description: isLotMode(ctx.mode)
          ? "Unit of measure for the quantity. An existing LOT keeps its own unit; every row of a new LOT uses one unit."
          : "Unit of measure for the quantity.",
        format: "Text, exact value",
        validValues: ctx.uoms.join(", "),
        example,
      };
    case "price":
      return {
        description: ctx.mode === "lot"
          ? "Unit price, zero or more. Optional. An existing LOT keeps its own price, so leave it blank for existing LOTs."
          : "Unit price, zero or more. Optional.",
        format: "Number, e.g. 24.50",
        validValues: "",
        example,
      };
    case "location":
      return { description: "The location the stock is added to. Must be a location Omne holds.", format: "Text, exact value", validValues: "See Location on the Valid Values sheet", example };
    case "reason":
      return { description: "Why stock is being added. Optional; an unrecognised reason is left blank.", format: "Text, exact value", validValues: ctx.reasons.map((r) => r.label).join(", "), example };
    default:
      return { description: col.label, format: "Text", validValues: "", example };
  }
}

/** The template spec the shared layout builds from. */
export function importTemplateSpec(mode: TrackingMode, columns: ImportColumn[], ctx: ImportValidationContext): TemplateSpec {
  const entity = TEMPLATE_ENTITY[mode];
  const noun = entity.toLowerCase().replace(/^lot /, "LOT ");
  const nReq = columns.filter((c) => c.required).length;
  /* Qty and Price examples go in as numbers, so Excel shows no "number stored as text" flag. */
  const asCell = (c: ImportColumn, v: string): string | number =>
    (c.kind === "qty" || c.kind === "price") && v !== "" && !Number.isNaN(Number(v)) ? Number(v) : v;
  const tplColumns: TemplateColumn[] = columns.map((c) => ({
    label: c.label,
    required: !!c.required,
    width: Math.max(16, Math.round(c.width / 8)),
    /* Both lot examples use existing LOTs, which keep their own price, so the price is left blank. */
    example1: mode === "lot" && c.kind === "price" ? "" : asCell(c, exampleFor(c, ctx)),
    example2: asCell(c, secondExample(c, ctx)),
    textFormat: c.kind === "text",
    reference: reference(c, ctx),
  }));

  const howItems: [string, string][] = [];
  if (columns.some((c) => c.key === "serialNumber")) {
    howItems.push(["Serial numbers", "Each row adds one unit. A serial number already in use in Omne, or on two rows of the file, stops that row."]);
  }
  if (isLotMode(mode)) {
    howItems.push(["Existing LOT", "A LOT number already on this item adds the row to that LOT."]);
    howItems.push(["New LOT", "Any other LOT number creates a new LOT. Check the spelling if you meant an existing one."]);
  }
  howItems.push(["Location", "Stock is added to the location on the row. It must already exist in Omne."]);

  const notes: [string, string][] = [
    ["Errors", "Rows with errors are not added until you fix them in the review."],
    ["Warnings", "Rows with warnings are added as the message says, for example without a reason."],
    ["Headers", "Do not rename, reorder or remove the header row. Required columns end in *."],
  ];
  if (mode === "lot") notes.push(["One LOT, one unit", "A LOT is held in one unit of measure, and an existing LOT keeps its own price."]);

  const validValues: TemplateSpec["template"]["validValues"] = [];
  if (columns.some((c) => c.key === "uom")) {
    validValues.push({ heading: "UoM", subHeader: ["Value", "What it means"], rows: ctx.uoms.map((u) => [u, u === "EA" ? "Each, one unit" : `Counted in ${u.toLowerCase()}`]) });
  }
  validValues.push({
    heading: "Location",
    subHeader: ["Value", "What it means"],
    rows: ctx.knownLocations.map((l) => [l, LOCATION_DESCRIPTIONS[l] ?? "Location in Omne"]),
  });
  if (columns.some((c) => c.key === "reason")) {
    validValues.push({
      heading: "Reason",
      subHeader: ["Value", "What it means"],
      rows: ctx.reasons.map((r) => [r.label, r.value === "found" ? "Stock that was found on hand" : "Opening stock entered when the system goes live"]),
      note: "Reason is optional. Leave it blank if none applies.",
    });
  }
  if (isLotMode(mode)) {
    validValues.push({
      heading: "Existing LOTs",
      subHeader: ["LOT Number", "Unit and price"],
      rows: ctx.existingLots.map((l) => [l.lot, `${l.uom}${l.price ? `, ${l.price} per unit` : ""}`]),
      note: "Any other LOT number creates a new LOT.",
    });
  }

  return {
    columns: tplColumns,
    template: {
      bannerTitle: `${entity} Import Template`,
      moduleLine: "Omne Pioneer  ·  Physical Inventory",
      countLine: `${columns.length} columns  ·  ${nReq} required, ${columns.length - nReq} optional`,
      frSubtitle: "Every column explained. Red rows are required and cannot be left blank.",
      instructions: {
        quickStart: [
          `Enter one row per ${noun.replace(/s$/, "")} on the Data Entry sheet, starting under the two example rows.`,
          "Fill every column that ends in *. Use the exact values on the Valid Values sheet.",
          "Save the file, then in Adjust Inventory choose Import and upload it.",
          "Choose Review Data, fix any errors in the review, then Start Import to add the rows to the increase.",
        ],
        sections: [
          { heading: "HOW ROWS ARE ADDED", items: howItems },
          { heading: "IMPORTANT NOTES", items: notes },
        ],
      },
      ...(isLotMode(mode)
        ? {
            compareTable: {
              heading: "Existing LOT vs new LOT",
              colHeaders: ["For an existing LOT on this item", "For a new LOT"] as [string, string],
              rows: [
                ["UoM", "Keeps the LOT's own unit.", "Takes the unit on its rows; every row of the LOT uses the same unit."],
                ["Price", mode === "lot" ? "Keeps the LOT's price; a file price is ignored." : "Pre-filled from the LOT; the file price is used.", "Taken from the file."],
              ] as [string, string, string][],
            },
          }
        : {}),
      validValues,
    },
  };
}

/** The 4-tab workbook. Pass the exceljs module (default export in the browser). */
export function buildImportTemplateWorkbook(ExcelJS: ExcelJSLike, mode: TrackingMode, columns: ImportColumn[], ctx: ImportValidationContext) {
  return buildTemplateWorkbook(ExcelJS, importTemplateSpec(mode, columns, ctx));
}

/** Header + two example rows, LF line endings. */
export function buildImportTemplateCsv(mode: TrackingMode, columns: ImportColumn[], ctx: ImportValidationContext): string {
  return buildTemplateCsv(importTemplateSpec(mode, columns, ctx));
}

/** Build and download the template in the browser. */
export async function downloadImportTemplate(
  mode: TrackingMode,
  columns: ImportColumn[],
  fmt: "excel" | "csv",
  ctx: ImportValidationContext,
): Promise<void> {
  let blob: Blob;
  if (fmt === "csv") {
    blob = new Blob([buildImportTemplateCsv(mode, columns, ctx)], { type: "text/csv" });
  } else {
    const ExcelJS = (await import("exceljs")).default as unknown as ExcelJSLike;
    const wb = buildImportTemplateWorkbook(ExcelJS, mode, columns, ctx);
    const buf = await wb.xlsx.writeBuffer();
    blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = importTemplateFileName(mode, fmt);
  a.click();
  URL.revokeObjectURL(url);
}
