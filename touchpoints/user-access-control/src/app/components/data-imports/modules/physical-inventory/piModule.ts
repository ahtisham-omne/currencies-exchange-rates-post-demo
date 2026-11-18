/* Physical Inventory on the Data Imports page: one card, four tabs, one per
 * control type (Serialized, Non-Serialized, LOT Serialized, LOT). Each tab is
 * Physical Inventory's own Adjust Inventory > Import for that control type
 * (the vendored ./validation.ts columns and rules, ./template.ts content),
 * with one column in front of it: Part Number. Physical Inventory imports into
 * one item it is opened from; Data Imports is not scoped to an item, so every
 * row names its item, and the item must be one of that tab's control type.
 *
 * This file is role-zen's adapter, not a vendored copy: the Part Number rule,
 * the tab list, the Data Imports wording of the template and the live
 * "existing" lists (serials and LOTs a finished import adds). */

import {
  EXISTING_LOTS,
  EXISTING_SERIALS,
  IMPORT_COLUMNS_BY_MODE,
  INCREASE_REASONS,
  KNOWN_LOCATIONS,
  defaultImportContext,
  validateImportRows,
} from "./validation";
import { TEMPLATE_ENTITY, importTemplateFileName, importTemplateSpec } from "./template";
import { buildTemplateCsv, templateHeaders, type TemplateSpec } from "./templateLayout.mjs";
import type { ExistingLot, ImportColumn, ImportIssue, ImportValidationContext, TrackingMode } from "./types";
import { PI_ITEMS, type PiControlType, type PiItem } from "./piData";

export const PI_TABS = [
  { slug: "physical-inventory-serialized", mode: "serialized", label: "Serialized" },
  { slug: "physical-inventory-non-serialized", mode: "non-serialized", label: "Non-Serialized" },
  { slug: "physical-inventory-lot-serialized", mode: "lot-serialized", label: "LOT Serialized" },
  { slug: "physical-inventory-lot", mode: "lot", label: "LOT" },
] as const satisfies readonly { slug: string; mode: TrackingMode; label: string }[];

export type PiSlug = (typeof PI_TABS)[number]["slug"];

export const PI_CONTROL_TYPE: Record<TrackingMode, PiControlType> = {
  serialized: "Serialized",
  "non-serialized": "Non-Serialized",
  lot: "Lot",
  "lot-serialized": "Lot-Serialized",
};

/** "Serialized", "LOT Non-Serialized": Physical Inventory's own names (TRACKING_LABELS). */
export const PI_TRACKING_LABEL: Record<TrackingMode, string> = {
  serialized: "Serialized",
  "non-serialized": "Non-Serialized",
  lot: "LOT Non-Serialized",
  "lot-serialized": "LOT Serialized",
};

export function piTab(slug: string) {
  return PI_TABS.find((t) => t.slug === slug);
}

/** Active items of a control type: the ones a tab adds stock to. */
export function piItemsFor(mode: TrackingMode): PiItem[] {
  return PI_ITEMS.filter((i) => i.controlType === PI_CONTROL_TYPE[mode] && i.status === "Active");
}

export function findPiItem(partNumber: string): PiItem | undefined {
  const key = partNumber.trim().toLowerCase();
  return key ? PI_ITEMS.find((i) => i.partNumber.toLowerCase() === key) : undefined;
}

export const PART_NUMBER_COLUMN: ImportColumn = { key: "partNumber", label: "Part Number", required: true, width: 150, kind: "text" };

/** Part Number, then Physical Inventory's columns for the control type. */
export function piColumns(mode: TrackingMode): ImportColumn[] {
  return [PART_NUMBER_COLUMN, ...IMPORT_COLUMNS_BY_MODE[mode]];
}

/* ── Live "existing" lists: seeded from Physical Inventory, grown by imports ── */
const liveSerials: string[] = [...EXISTING_SERIALS];
const liveLots: ExistingLot[] = EXISTING_LOTS.map((l) => ({ ...l }));

export function piContext(mode: TrackingMode): ImportValidationContext {
  return { ...defaultImportContext(mode, KNOWN_LOCATIONS), existingSerials: [...liveSerials], existingLots: liveLots.map((l) => ({ ...l })) };
}

export function piExistingLots(): ExistingLot[] {
  return liveLots.map((l) => ({ ...l }));
}

/** Fold imported rows into the live lists, as the Increase adds them. */
export function piApplyImported(mode: TrackingMode, rows: Record<string, string>[]): void {
  for (const r of rows) {
    const sn = (r.serialNumber ?? "").trim();
    if (sn && !liveSerials.includes(sn)) liveSerials.push(sn);
    const lot = (r.lotNumber ?? "").trim();
    if (lot && !liveLots.some((l) => l.lot.toLowerCase() === lot.toLowerCase())) {
      liveLots.push({ lot, uom: mode === "lot" ? (r.uom ?? "").trim() || "EA" : "EA", price: (r.price ?? "").trim() || undefined });
    }
  }
}

/* ── Part Number rule (role-zen) ── */

export type PiItemIssueCode = "ITEM_NOT_FOUND" | "ITEM_CONTROL_TYPE";

export interface PiRowIssues {
  status: "ready" | "warning" | "error";
  issues: ImportIssue[] | (Omit<ImportIssue, "code"> & { code: string })[];
}

function partNumberIssues(mode: TrackingMode, raw: string): (Omit<ImportIssue, "code"> & { code: string })[] {
  const pn = raw.trim();
  const items = piItemsFor(mode);
  const options = items.map((i) => i.partNumber);
  const kind = PI_TRACKING_LABEL[mode];
  if (!pn) {
    return [{
      field: "partNumber", severity: "error", code: "REQUIRED_EMPTY",
      message: "Part Number is required and cannot be empty.",
      explanation: `Every row names the item stock is added to. Enter the part number of a ${kind} item, or delete the row if it should not be imported.`,
      example: options[0], options,
    }];
  }
  const item = findPiItem(pn);
  if (!item) {
    return [{
      field: "partNumber", severity: "error", code: "ITEM_NOT_FOUND",
      message: `Part number "${pn}" does not exist in Omne. Use a ${kind} item from the Valid Values sheet.`,
      explanation: `Stock is added to an item that already exists. Enter the part number of a ${kind} item, or create the item in Item Library first.`,
      example: options[0], options,
    }];
  }
  if (item.controlType !== PI_CONTROL_TYPE[mode]) {
    const tab = PI_TABS.find((t) => PI_CONTROL_TYPE[t.mode] === item.controlType);
    return [{
      field: "partNumber", severity: "error", code: "ITEM_CONTROL_TYPE",
      message: `${item.partNumber} is a ${PI_TRACKING_LABEL[tab?.mode ?? mode]} item. This tab adds ${kind} stock only.`,
      explanation: `Each tab imports one control type, because each takes different columns. Import this row on the ${tab?.label ?? "matching"} tab, or enter a ${kind} item here.`,
      example: options[0], options,
    }];
  }
  return [];
}

/** Physical Inventory's rules on its columns, plus the Part Number rule, per row. */
export function validatePiRows(mode: TrackingMode, rows: Record<string, string>[], ctx: ImportValidationContext): PiRowIssues[] {
  const pi = validateImportRows(rows, IMPORT_COLUMNS_BY_MODE[mode], ctx);
  return rows.map((row, i) => {
    const issues = [...partNumberIssues(mode, row.partNumber ?? ""), ...Object.values(pi[i].issues).flat()];
    const status = issues.some((x) => x.severity === "error") ? "error" : issues.length ? "warning" : "ready";
    return { status, issues };
  });
}

/* ── Template: Physical Inventory's content, for Data Imports ── */

export function piTemplateSpec(mode: TrackingMode): TemplateSpec {
  const ctx = piContext(mode);
  const base = importTemplateSpec(mode, IMPORT_COLUMNS_BY_MODE[mode], ctx);
  const items = piItemsFor(mode);
  const kind = PI_TRACKING_LABEL[mode];
  const tab = PI_TABS.find((t) => t.mode === mode)!;
  const columns = [
    {
      label: PART_NUMBER_COLUMN.label,
      required: true,
      width: 18,
      example1: items[0]?.partNumber ?? "",
      example2: items[1]?.partNumber ?? items[0]?.partNumber ?? "",
      textFormat: true,
      reference: {
        description: `The item the stock is added to. Must be a ${kind} item in Item Library.`,
        format: "Text, exact value",
        validValues: "See Items on the Valid Values sheet",
        example: items[0]?.partNumber ?? "",
      },
    },
    ...base.columns,
  ];
  const nReq = columns.filter((c) => c.required).length;
  const t = base.template;
  return {
    columns,
    template: {
      ...t,
      moduleLine: "Omne Pioneer  ·  Data Imports  ·  Physical Inventory",
      countLine: `${columns.length} columns  ·  ${nReq} required, ${columns.length - nReq} optional`,
      instructions: {
        ...t.instructions,
        quickStart: t.instructions.quickStart.map((line) =>
          line.startsWith("Save the file")
            ? `Save the file, then in Data Imports open Physical Inventory, choose the ${tab.label} tab and Import.`
            : line.replace("to add the rows to the increase", "to add the stock"),
        ),
        sections: t.instructions.sections.map((s, i) =>
          i === 0 ? { ...s, items: [["Items", `Every row names its item by Part Number. Only ${kind} items can be imported on this tab.`] as [string, string], ...(s.items ?? [])] } : s,
        ),
      },
      validValues: [
        { heading: "Items", subHeader: ["Part Number", "Item"], rows: items.map((i) => [i.partNumber, i.name] as [string, string]), note: `${kind} items only. Other control types have their own tab.` },
        ...t.validValues,
      ],
    },
  };
}

export function piTemplateHeaders(mode: TrackingMode): string[] {
  return templateHeaders(piTemplateSpec(mode));
}

export function piTemplateCsv(mode: TrackingMode): string {
  return buildTemplateCsv(piTemplateSpec(mode));
}

/** File names under public/templates: Physical Inventory's own names. */
export function piTemplateFiles(mode: TrackingMode) {
  const stem = TEMPLATE_ENTITY[mode].replace(/\s+/g, "_");
  return {
    templateXlsxFilename: importTemplateFileName(mode, "excel"),
    templateCsvFilename: importTemplateFileName(mode, "csv"),
    guideFilename: `OMNE_${stem}_Import_Guide.txt`,
    guideTitle: `${TEMPLATE_ENTITY[mode]} Import Guide`,
  };
}

export { INCREASE_REASONS, KNOWN_LOCATIONS, TEMPLATE_ENTITY };

/* ── Guide: the plain-text companion every Omne template ships with ── */

const GUIDE_W = 66;
function wrap(text: string, indent = 0): string[] {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if (cur && cur.length + 1 + w.length > GUIDE_W - indent) { lines.push(cur); cur = w; } else cur = cur ? `${cur} ${w}` : w;
  }
  if (cur) lines.push(cur);
  return lines;
}
function labeled(label: string, body: string): string[] {
  const pad = label.length + 3;
  return wrap(body, pad).map((l, i) => (i === 0 ? `${label}   ${l}` : `${" ".repeat(pad)}${l}`));
}

export function piGuideText(mode: TrackingMode): string {
  const spec = piTemplateSpec(mode);
  const t = spec.template;
  const eq = "=".repeat(GUIDE_W);
  const dash = "-".repeat(GUIDE_W);
  const entity = TEMPLATE_ENTITY[mode];
  const nReq = spec.columns.filter((c) => c.required).length;
  const out: string[] = [eq, `OMNE ${entity.toUpperCase()} IMPORT GUIDE`, t.moduleLine, eq, ""];
  out.push(...wrap(`This guide explains how to fill in the ${entity} import file for ${PI_TRACKING_LABEL[mode]} items. It covers the steps, every column, and how rows are added.`), "");
  out.push(...wrap(`The file has ${nReq} required columns and ${spec.columns.length - nReq} optional ones.`), "", "");
  out.push(dash, "QUICK START", dash, "");
  t.instructions.quickStart.forEach((line, i) => out.push(...labeled(`Step ${i + 1}`, line), ""));
  for (const s of t.instructions.sections) {
    out.push("", dash, s.heading, dash, "");
    if (s.intro) out.push(...wrap(s.intro), "");
    const w = Math.max(0, ...(s.items ?? []).map(([l]) => l.length));
    for (const [l, b] of s.items ?? []) out.push(...labeled(l.padEnd(w), b), "");
  }
  out.push("", dash, "COLUMNS", dash, "");
  for (const c of spec.columns) {
    out.push(`${c.label}${c.required ? " (required)" : ""}`);
    out.push(...wrap(c.reference.description).map((l) => `   ${l}`));
    if (c.reference.validValues) out.push(...wrap(`Valid values: ${c.reference.validValues}`).map((l) => `   ${l}`));
    if (c.reference.example) out.push(`   Example: ${c.reference.example}`);
    out.push("");
  }
  return out.join("\n");
}
