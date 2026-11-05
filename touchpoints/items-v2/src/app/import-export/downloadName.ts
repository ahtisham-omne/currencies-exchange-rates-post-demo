/**
 * Download file names for every import and export file:
 *   <Company>_<Module>_Import_Template_<MM-DD-YYYY>.<ext>   blank import template
 *   <Company>_<Module>_Import_Failed_Rows_<MM-DD-YYYY>.<ext> failed rows of an import
 *   <Company>_<Module>_Import_Records_<MM-DD-YYYY>.<ext>     other rows of an import
 *   <Company>_<Module>_Export_<MM-DD-YYYY>.<ext>             listing export
 * Shipped template files keep their stored names (OMNE_<Module>_Import_Template.xlsx);
 * only the name the browser saves changes.
 */
export const DOWNLOAD_COMPANY = "Omnesoft";

export type DownloadKind = "Import_Template" | "Import_Failed_Rows" | "Import_Records" | "Export";

export function fileDate(d: Date = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${m}-${day}-${d.getFullYear()}`;
}

function token(s: string): string {
  return s.trim().replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

/** Physical Inventory templates are named by control type; the module name goes in front. */
const PHYSICAL_INVENTORY_TEMPLATES = new Set(["Serial_Units", "LOT_Units", "LOT_Serial_Units", "Stock_Lines"]);

/** e.g. downloadName("Partner Groups", "Export", "pdf") -> Omnesoft_Partner_Groups_Export_10-14-2026.pdf */
export function downloadName(module: string, kind: DownloadKind, ext: string, date: Date = new Date()): string {
  return `${DOWNLOAD_COMPANY}_${token(module)}_${kind}_${fileDate(date)}.${ext.replace(/^\./, "")}`;
}

/** The module part of a shipped template's name: OMNE_Partner_Groups_Import_Template.xlsx -> Partner_Groups. */
export function templateModule(storedName: string): string {
  const stem = storedName.replace(/\.[^.]+$/, "");
  const name = stem.replace(/^OMNE_/i, "").replace(/_Import_Template$/i, "");
  return PHYSICAL_INVENTORY_TEMPLATES.has(name) ? `Physical_Inventory_${name}` : name;
}

/** The saved name for a shipped template file: OMNE_Partners_Import_Template.xlsx ->
 *  Omnesoft_Partners_Import_Template_10-14-2026.xlsx. The companion guide (.txt) keeps its stored name. */
export function templateDownloadName(storedName: string): string {
  if (/\.txt$/i.test(storedName)) return storedName;
  const ext = /\.([^.]+)$/.exec(storedName)?.[1] ?? "xlsx";
  return downloadName(templateModule(storedName), "Import_Template", ext);
}

/** Rows downloaded from an import: "failed" -> Import_Failed_Rows, anything else -> Import_Records. */
export function importRowsDownloadName(module: string, suffix: string, ext: string): string {
  return downloadName(module, suffix === "failed" ? "Import_Failed_Rows" : "Import_Records", ext);
}
