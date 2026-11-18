/* Column contract for a spreadsheet-shaped import.
 *
 * Quotes and Sales Orders both arrive as one flat sheet where a record's own
 * columns sit on the first row of its group and the `Line /` columns repeat on
 * every row of that group. One spec describes both modules, so the parser, the
 * validator, the review modal, the record page and the template writer are
 * written once and each module contributes only its columns and catalogs. */

export type Requirement = "required" | "conditional" | "optional";
export type CellKind = "text" | "number" | "date";

export interface SheetColumn {
  /** Object key on a parsed row. */
  key: string;
  /** Header text in the template, without the requirement mark. */
  label: string;
  /** `record` columns carry the record itself, `line` columns its line items. */
  level: "record" | "line";
  requirement: Requirement;
  /** Shown in the guide and the review modal's hover card for a conditional. */
  conditionalNote?: string;
  kind?: CellKind;
  /** Closed vocabulary. A value outside it is an error, unless an alias maps it. */
  set?: readonly string[];
  /** Values are validated against a catalog of records that must already exist. */
  catalog?: string;
  /** Pipe-separated multi-value column. */
  list?: boolean;
  /** Column width in the review grid and the record table. */
  width?: number;
}

export interface SheetImportSpec {
  /** Route slug. Matches the Data Imports card slug. */
  slug: string;
  /** "Quote" / "Sales Order". */
  recordLabel: string;
  recordLabelPlural: string;
  /** Column holding the legacy reference that groups a record's rows. */
  keyColumn: string;
  /** Column holding the record's status. */
  statusColumn: string;
  columns: SheetColumn[];
  /** Known values per `catalog` name. A value not in the list is an error with
   *  a create-in-module touchpoint; a value matching an alias is a warning. */
  catalogs: Record<string, readonly string[]>;
  /** Where a missing catalog value has to be created, per catalog name. The
   *  review sheet names it, so a blocked cell tells the admin which module to
   *  create the record in rather than just refusing the value. */
  catalogModules: Record<string, string>;
  /** Legacy words this import can map onto a real value. Mapped values import
   *  as a warning, never an error. Keyed by lower-cased legacy word. */
  aliases: Record<string, string>;
  /** Subfolder under `public/templates` holding this module's files. */
  templateDir: string;
  /** Template + guide filenames served from that folder. */
  templateXlsx: string;
  templateCsv: string;
  guideFile: string;
  guideTitle: string;
  /** Fields named in the wizard's template preview line. */
  previewFieldsText: string;
  /** The rest of the columns, listed in the wizard's expandable field list. */
  remainingFields: string[];
  /** Optional header matcher: a raw header cell to the column key it names,
   *  or undefined. When set it replaces the label-only match, so a module can
   *  accept its home repo's header aliases ("SKU" for Part Number). The
   *  header row is the first row with a cell resolving to keyColumn, and the
   *  first cell to claim a column wins. Quotes and Sales Orders leave it
   *  unset and keep the label match. */
  resolveHeader?: (raw: string) => string | undefined;
}

/** Header text as it appears in the template: required carries `*`,
 *  conditional carries `†`. */
export function headerFor(col: SheetColumn): string {
  if (col.requirement === "required") return `${col.label} *`;
  if (col.requirement === "conditional") return `${col.label} †`;
  return col.label;
}

/** Match an uploaded header back to its column. Tolerates the requirement
 *  marks, case, and the spacing variants a legacy export tends to produce. */
export function normaliseHeader(raw: string): string {
  return raw
    .replace(/[*†]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function columnByHeader(spec: SheetImportSpec, raw: string): SheetColumn | undefined {
  const wanted = normaliseHeader(raw);
  return spec.columns.find((c) => normaliseHeader(c.label) === wanted);
}

export function recordColumns(spec: SheetImportSpec): SheetColumn[] {
  return spec.columns.filter((c) => c.level === "record");
}

export function lineColumns(spec: SheetImportSpec): SheetColumn[] {
  return spec.columns.filter((c) => c.level === "line");
}
