/**
 * Import model, shared by the Quotes and Sales Orders legacy importers.
 *
 * The shape that matters
 * ─────────────────────────────────────────────────────────────────────
 * The User Access Control importer this is modelled on has a flat file:
 * one spreadsheet row is one user is one review row. Our templates are
 * not flat. A quote or order occupies as many rows as it has line items:
 * the record-level columns are filled on the first row of the group and
 * left blank underneath, while the `Line /` columns repeat on every row.
 *
 * So the unit of review here is an `ImportRecord` (one quote or order)
 * holding an array of `ImportLine`, not a spreadsheet row. Everything
 * downstream, the grid, the filter chips, the counts, the import itself,
 * counts records. Line-level problems roll up into the record's status
 * and are fixed in a nested sheet rather than inline, because a record
 * with eleven lines cannot show them in one grid row.
 *
 * The other departure is what a bad value means. In UAC an unknown role
 * is fixable from a dropdown of roles. Here an unknown customer, item,
 * unit or pricing rule belongs to another module and this import is not
 * allowed to create it. So a dependency miss is an error with two exits:
 * point the cell at something that does exist, or go create it in its own
 * module and leave the record failed for a later pass.
 */

/* ── Fields ───────────────────────────────────────────────────────── */

/** A column at record level (quote/order). Filled on the group's first row. */
export type HeaderField = string;
/** A column at line level. Repeats on every row of the group. */
export type LineField = string;

export type FieldLevel = "record" | "line";
export type FieldRequirement = "required" | "conditional" | "optional";

/** Entities this import can point at but never create. */
export type EntityKind =
  | "customer"
  | "item"
  | "uom"
  | "pricingRule"
  | "user"
  | "location"
  | "paymentTerm"
  | "paymentMethod"
  | "contact"
  | "sourceQuote";

export interface EntityMeta {
  kind: EntityKind;
  /** Singular noun for messages, e.g. "customer". */
  noun: string;
  /** The module that owns it, named in the create touchpoint. */
  module: string;
  /** Route the touchpoint opens in a new tab. */
  createHref: string;
  /** False when the signed-in user cannot create records in that module. The
   *  card then states so instead of offering a route the user cannot use. */
  canCreate?: boolean;
}

export interface ColumnSpec {
  /** Stable key used in code and in the parsed record. */
  key: string;
  /** Header text as it appears in the template. */
  label: string;
  level: FieldLevel;
  requirement: FieldRequirement;
  /** Why it is conditional, shown in the cell tooltip. */
  conditionalNote?: string;
  /** Values this column accepts, when it is a closed set. */
  set?: readonly string[];
  /** The entity this column resolves against, when it names one. */
  entity?: EntityKind;
  /** True when the column holds a pipe-separated list. */
  list?: boolean;
  kind?: "text" | "number" | "date" | "percent";
  /** Column width in the review grid, px. */
  width?: number;
}

/* ── Parsed file ──────────────────────────────────────────────────── */

export interface ImportLine {
  id: string;
  /** 1-based row number in the source sheet, for error messages. */
  sourceRow: number;
  values: Record<LineField, string>;
}

export interface ImportRecord {
  id: string;
  /** Source rows this record was assembled from, first row first. */
  sourceRows: number[];
  values: Record<HeaderField, string>;
  lines: ImportLine[];
  /** Set when the user drops the record from this import. */
  excluded?: boolean;
}

export interface ParsedFile {
  records: ImportRecord[];
  /** Header labels present in the file that the template does not define. */
  unknownColumns: string[];
  /** Template columns the file is missing. */
  missingColumns: string[];
  /** Rows skipped because they carried no line and no record key. */
  blankRowCount: number;
}

/* ── Issues ───────────────────────────────────────────────────────── */

export type IssueSeverity = "error" | "warning";

export type IssueCode =
  /* errors */
  | "REQUIRED_EMPTY"
  | "INVALID_SET"
  | "SET_ALIASED"
  | "INVALID_NUMBER"
  | "INVALID_DATE"
  | "ENTITY_NOT_FOUND"
  | "UOM_NOT_ALLOWED_FOR_ITEM"
  | "NO_LINES"
  | "DUPLICATE_IN_FILE"
  /* warnings */
  | "ALREADY_IMPORTED"
  | "PRICE_DIFFERS"
  | "REQUESTED_ON_MISSING"
  | "LOCATION_NOT_CUSTOMERS"
  | "SOURCE_QUOTE_NOT_FOUND";

export interface Issue {
  code: IssueCode;
  severity: IssueSeverity;
  /** Which side of the record the issue sits on. */
  scope: FieldLevel;
  field: string;
  /** Set when scope is "line". */
  lineId?: string;
  message: string;
  /** Present on ENTITY_NOT_FOUND, drives the resolve flow. */
  entity?: EntityKind;
  /** The value that failed to resolve, used to fix every twin at once. */
  rawValue?: string;
}

export type RecordStatus = "ready" | "warning" | "error";

export interface RecordValidation {
  status: RecordStatus;
  issues: Issue[];
  /** Record-level issues keyed by column. */
  byField: Record<string, Issue[]>;
  /** Line-level issues keyed by line id then column. */
  byLine: Record<string, Record<string, Issue[]>>;
  /** Line ids carrying at least one error. */
  errorLineIds: string[];
  /** Line ids carrying at least one warning and no error. */
  warningLineIds: string[];
}

export interface ValidationSummary {
  byRecord: Record<string, RecordValidation>;
  readyCount: number;
  warningCount: number;
  errorCount: number;
  /** Every unresolved dependency in the file, grouped for bulk fixing. */
  entityGaps: EntityGap[];
}

/** One missing entity value, with every place it appears. */
export interface EntityGap {
  /** Set when the picker was opened from one cell rather than from a bad
   *  value shared across rows. A pick then writes exactly that cell. */
  cell?: { recordId: string; lineId?: string; field: string };
  entity: EntityKind;
  rawValue: string;
  /** Number of cells across the file holding this value. */
  occurrences: number;
  recordIds: string[];
}
