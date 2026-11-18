/* Provenance: radiant-core-fusion/src/app/import-export/spec.ts
 * sha256 bdb80635bb045c5462abf3a6eaa13ff9e39ddeed318714f1c0db60601e96706a
 * Copied into role-zen 2026-09-30. Verbatim. */
/* Categories import/export entity spec.
   The raw data lives in spec.data.mjs (plain ESM) so scripts/gen-import-templates.mjs
   and the app read ONE source; this file adds the types and the review-row shape.
   Contract: docs/import-export/SPEC.md section 4.1 (12 columns, key = Category Code). */

import {
  CATEGORIES_SPEC_DATA,
  COLUMNS,
  EXPORT_FIELDS,
  KEY_FIELD,
} from "./spec.data.mjs";

/* ─── Column and spec types ─────────────────────────────────────────── */

export type ColumnKind = "text" | "select" | "multiselect" | "yesno" | "number" | "date";

/** A select column whose options are grouped (Base Unit of Measure by UOM category). */
export interface OptionGroup {
  label: string;
  options: string[];
}

/** A column that only applies when another column holds a given value. */
export type ConditionalOn =
  | { field: string; equals: string }
  | { field: string; includesAll: string[] };

/** The Field Reference sheet row and the guide entry for one column. */
export interface ColumnReference {
  description: string;
  format: string;
  /** Empty string when the column has no fixed vocabulary. */
  validValues: string;
  example: string;
}

export interface EntityColumn {
  /** Review-row field name (camelCase). */
  key: string;
  /** Template header without the " *" marker. */
  label: string;
  required: boolean;
  kind: ColumnKind;
  /** Flat option list for select / multiselect / yesno columns. */
  options?: string[];
  /** Grouped options (only Base Unit of Measure uses it); `options` is the flat union. */
  optionsGroups?: OptionGroup[];
  /** Data Entry column width in Excel character units. */
  width: number;
  /** Apply numFmt "@" on the Data Entry column so Excel keeps the cell as text. */
  textFormat?: boolean;
  /** Pipe-separated list column. */
  list?: boolean;
  /** Character cap on the whole value (Description). */
  maxLength?: number;
  /** Character cap per list item (Tags). */
  maxItemLength?: number;
  /** Value a NEW category gets when the cell is blank; "" when there is no default. */
  defaultValue: string;
  conditionalOn?: ConditionalOn;
  /** Data Entry example rows 3 and 4; "" renders a styled blank cell. */
  example1: string;
  example2: string;
  /** Review-grid header tooltip copy. */
  description: string;
  reference: ColumnReference;
  /** Guide txt Field Reference body. */
  guide: string;
  /** Lower-cased header spellings the parser accepts for this column. */
  aliases: string[];
}

export interface ExportField {
  id: string;
  label: string;
  /** Always exported and cannot be unticked (Category Code). */
  locked?: boolean;
  /** Ticked by default; mirrors the listing's visible columns. */
  defaultChecked: boolean;
}

export interface InstructionSection {
  heading: string;
  intro?: string;
  items?: [label: string, body: string][];
}

export interface CompareTable {
  heading: string;
  colHeaders: [string, string];
  rows: [label: string, newCase: string, existingCase: string][];
  /** Last row whose body spans B:C. */
  mergedLast?: [label: string, body: string];
}

export interface ValidValuesBlock {
  heading: string;
  subHeader?: [string, string];
  rows?: [label: string, body: string][];
  note?: string;
}

export interface GuideMatchingCase {
  subheader: string;
  lead: string;
  items: [label: string, body: string][];
}

export interface GuideFieldGroup {
  heading: string;
  keys: string[];
}

export interface GuideSpec {
  title: string;
  intro: string[];
  quickStart: string[];
  matching: { intro: string; cases: GuideMatchingCase[] };
  fileLimits: string;
  fieldGroups: GuideFieldGroup[];
}

export interface TemplateSpec {
  fileBase: string;
  guideFileBase: string;
  /** Data Entry A1 banner after "OMNE  ·  " and the Instructions title. */
  bannerTitle: string;
  moduleLine: string;
  countLine: string;
  /** Field Reference A1 banner after "OMNE  ·  ". */
  frBanner: string;
  frSubtitle: string;
  instructions: { quickStart: string[]; sections: InstructionSection[] };
  compareTable?: CompareTable;
  validValues: ValidValuesBlock[];
  guide: GuideSpec;
}

export interface EntityRoutes {
  listing: string;
  history: string;
  record: string;
}

export interface EntitySpec {
  nounSingular: string;
  nounPlural: string;
  titleSingular: string;
  titlePlural: string;
  moduleSlug: string;
  storageNamespace: string;
  routes: EntityRoutes;
  keyField: string;
  /** Normalised header names whose presence identifies the header row. */
  headerIdentifiers: string[];
  columns: EntityColumn[];
  bulkSetFields: string[];
  exportFields: ExportField[];
  template: TemplateSpec;
}

/* ─── The Categories spec ────────────────────────────────────────────── */

export const CATEGORIES_IMPORT_SPEC: EntitySpec = CATEGORIES_SPEC_DATA;

/** The 12 review-row field names, in template order. */
export const CATEGORY_REVIEW_FIELDS = [
  "code",
  "status",
  "description",
  "tags",
  "inventoryType",
  "controlType",
  "lotControlEnabled",
  "lotIdSource",
  "uom",
  "alternativeUnits",
  "acquisitionMethods",
  "primaryAcquisition",
] as const;

export type CategoryReviewField = (typeof CATEGORY_REVIEW_FIELDS)[number];

/** One parsed / edited row. Every field is the raw text from the file. */
export type CategoryReviewRow = Record<CategoryReviewField, string>;

export const EMPTY_REVIEW_ROW: CategoryReviewRow = Object.freeze(
  Object.fromEntries(CATEGORY_REVIEW_FIELDS.map((k) => [k, ""])) as CategoryReviewRow,
) as CategoryReviewRow;

export const KEY_COLUMN: CategoryReviewField = KEY_FIELD;

/** Column lookup by key. */
export const COLUMN_BY_KEY: Record<CategoryReviewField, EntityColumn> = Object.fromEntries(
  COLUMNS.map((c) => [c.key, c]),
) as Record<CategoryReviewField, EntityColumn>;

export function columnLabel(key: CategoryReviewField): string {
  return COLUMN_BY_KEY[key].label;
}

/** Template headers exactly as they appear in the CSV line 1 and the xlsx Data Entry row 2. */
export function templateHeaders(spec: EntitySpec = CATEGORIES_IMPORT_SPEC): string[] {
  return spec.columns.map((c) => (c.required ? `${c.label} *` : c.label));
}

export const TEMPLATE_HEADERS: string[] = templateHeaders();

/** Export field lookup by id. */
export const EXPORT_FIELD_BY_ID: Record<string, ExportField> = Object.fromEntries(
  EXPORT_FIELDS.map((f) => [f.id, f]),
);

export { COLUMNS, EXPORT_FIELDS };
