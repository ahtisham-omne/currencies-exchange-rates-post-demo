/* The Items entity spec for Import / Export: one typed object that the
 * template, parser, validator, review UI, export modal and history pages
 * read. Raw column / copy / example data lives in spec.data.mjs (plain ESM,
 * also read by scripts/gen-import-templates.mjs). Option lists that come
 * from TS constants are read LIVE here (allUnitNames(), LOCATIONS,
 * AVAILABLE_VENDORS, MOCK_USERS, MOCK_APPROVERS, CATEGORIES) so the app can
 * never drift from what the create flow offers; spec.options.test.ts pins
 * the .mjs snapshots to the same constants. */

import {
  BULK_SET_FIELDS,
  COLUMNS,
  COLUMN_KEYS,
  DESCRIPTION_MAX,
  ENUMS,
  EXPORT_FIELDS,
  EXPORT_STEM,
  FILE_BASE,
  GUIDE_FILE,
  HEADER_DETECT_NORMS,
  KEY_COLUMN,
  NOUNS,
  OPTION_SNAPSHOTS,
  PIPE,
  ROUTES,
  STORAGE_NAMESPACE,
  TEMPLATE_HEADERS,
  VOCAB,
  type ColumnKind,
  type ExportFieldData,
  type ItemReviewField,
} from "./spec.data.mjs";
import { buildTemplateModel, type TemplateModel } from "./templateLayout.mjs";
import { CATEGORIES, LOCATIONS, MOCK_USERS, UOMS } from "@/app/components/modules/CreateItemModal";
import { MOCK_APPROVERS } from "@/app/components/modules/MaterialHandlingSection";
import { AVAILABLE_VENDORS } from "@/app/context/purchasing/mockData";
import { allUnitNames, uomCategory } from "@/app/components/modules/configAtoms";

export type { ItemReviewField, ColumnKind, ExportFieldData } from "./spec.data.mjs";
export type { TemplateModel } from "./templateLayout.mjs";
export { PIPE, VOCAB, ENUMS, DESCRIPTION_MAX, OPTION_SNAPSHOTS };

/* ─── Row shape ─── */

/** One uploaded row: every column as a plain string (pipe-joined for lists). */
export type ItemReviewRow = Record<ItemReviewField, string>;

export const EMPTY_ROW: Readonly<ItemReviewRow> = Object.freeze(
  Object.fromEntries(COLUMN_KEYS.map((k) => [k, ""])) as ItemReviewRow,
);

export function makeEmptyRow(): ItemReviewRow {
  return { ...EMPTY_ROW };
}

/* ─── Spec types ─── */

export interface OptionGroup {
  label: string;
  options: string[];
}

export interface SpecColumn {
  key: ItemReviewField;
  label: string;
  required: boolean;
  kind: ColumnKind;
  /** Flat list of accepted values (file vocabulary). Empty for free text. */
  options: string[];
  /** Grouped options for large pickers (units by category). */
  optionsGroups?: OptionGroup[];
  example1: string;
  example2: string;
  /** Column-header tooltip copy in the review grid. */
  description: string;
  /** Review-grid default column width in px. */
  width: number;
  /** Normalised header names that map onto this column (lower-cased). */
  aliases: string[];
  /** The column whose value makes this one meaningful. */
  conditionalOn?: ItemReviewField;
  /** Field-group heading in the guide / field reference. */
  group: string;
  /** Value a blank cell takes on a new item ("" = none). */
  defaultValue: string;
  /** Excel numFmt "@" on the template column. */
  text: boolean;
}

export interface EntitySpec {
  nouns: {
    singular: string;
    plural: string;
    titleSingular: string;
    titlePlural: string;
    moduleSlug: string;
    moduleTitle: string;
    moduleLine: string;
  };
  storageNamespace: string;
  routes: { listing: string; history: string; record: string };
  keyColumn: ItemReviewField;
  columns: SpecColumn[];
  columnByKey: Record<ItemReviewField, SpecColumn>;
  requiredColumns: ItemReviewField[];
  bulkSetFields: ItemReviewField[];
  exportFields: ExportField[];
  /** Header row exactly as the CSV / Data Entry row 2 ship it. */
  templateHeaders: string[];
  /** Normalised header names whose presence identifies the header row. */
  headerDetectNorms: string[];
  /** normalised header -> column key. */
  headerAliases: Record<string, ItemReviewField>;
  files: { xlsx: string; csv: string; guide: string; exportStem: string };
  template: TemplateModel;
  descriptionMax: number;
  /** Live option sources, lower-cased lookups for validation. */
  lookups: SpecLookups;
}

export interface ExportField {
  id: string;
  label: string;
  locked: boolean;
  /** Part of the 14 listing columns (default-checked in the export modal). */
  listing: boolean;
  field?: ItemReviewField;
  system: boolean;
  date: boolean;
}

export interface SpecLookups {
  /** unit name (lower) -> canonical name */
  units: Map<string, string>;
  /** canonical unit name -> UOM category */
  unitCategory: Map<string, string>;
  /** price-tier unit (lower) -> canonical */
  priceUnits: Map<string, string>;
  categories: Map<string, string>;
  locations: Map<string, string>;
  partners: Map<string, string>;
  users: Map<string, string>;
  approvers: Map<string, string>;
}

/* ─── Live option lists ─── */

function lowerMap(names: readonly string[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const n of names) if (!m.has(n.trim().toLowerCase())) m.set(n.trim().toLowerCase(), n);
  return m;
}

export const LIVE_UNIT_NAMES: string[] = allUnitNames();
export const LIVE_LOCATIONS: string[] = [...(LOCATIONS as string[])];
export const LIVE_PARTNER_NAMES: string[] = (AVAILABLE_VENDORS as { name: string }[]).map((v) => v.name);
export const LIVE_USER_NAMES: string[] = (MOCK_USERS as { name: string }[]).map((u) => u.name);
export const LIVE_APPROVER_NAMES: string[] = (MOCK_APPROVERS as { name: string }[]).map((a) => a.name);
export const LIVE_CATEGORY_CODES: string[] = (CATEGORIES as { name: string }[]).map((c) => c.name);
export const LIVE_PRICE_UNITS: string[] = [...(UOMS as string[])];

export function unitOptionGroups(): OptionGroup[] {
  const groups: OptionGroup[] = [];
  for (const u of LIVE_UNIT_NAMES) {
    const cat = uomCategory(u) ?? "Other";
    let g = groups.find((x) => x.label === cat);
    if (!g) {
      g = { label: cat, options: [] };
      groups.push(g);
    }
    g.options.push(u);
  }
  return groups;
}

const LIVE_OPTIONS: Record<string, () => string[]> = {
  units: () => LIVE_UNIT_NAMES,
  priceUnits: () => LIVE_PRICE_UNITS,
  locations: () => LIVE_LOCATIONS,
  partners: () => LIVE_PARTNER_NAMES,
  users: () => LIVE_USER_NAMES,
  approvers: () => LIVE_APPROVER_NAMES,
  categories: () => LIVE_CATEGORY_CODES,
};

/* ─── Build the spec ─── */

const columns: SpecColumn[] = COLUMNS.map((c) => {
  const options = c.options ? [...c.options] : c.optionsRef ? [...LIVE_OPTIONS[c.optionsRef]()] : [];
  const col: SpecColumn = {
    key: c.key,
    label: c.label,
    required: !!c.required,
    kind: c.kind,
    options,
    example1: c.example1,
    example2: c.example2,
    description: c.description,
    width: Math.max(90, Math.round(c.width * 7)),
    aliases: [c.label.toLowerCase(), ...c.aliases],
    group: c.group,
    defaultValue: c.defaultValue,
    text: !!c.text,
  };
  if (c.conditionalOn) col.conditionalOn = c.conditionalOn;
  if (c.optionsRef === "units") col.optionsGroups = unitOptionGroups();
  return col;
});

const headerAliases: Record<string, ItemReviewField> = {};
for (const c of columns) {
  for (const a of c.aliases) {
    const norm = a.replace(/\s+/g, " ").trim().toLowerCase();
    if (!(norm in headerAliases)) headerAliases[norm] = c.key;
  }
}

const exportFields: ExportField[] = EXPORT_FIELDS.map((f) => ({
  id: f.id,
  label: f.label,
  locked: !!f.locked,
  listing: !!f.listing,
  field: f.field,
  system: !!f.system,
  date: !!f.date,
}));

const unitCategory = new Map<string, string>();
for (const u of LIVE_UNIT_NAMES) unitCategory.set(u, uomCategory(u) ?? "");

export const ITEMS_IMPORT_SPEC: EntitySpec = {
  nouns: { ...NOUNS },
  storageNamespace: STORAGE_NAMESPACE,
  routes: { ...ROUTES },
  keyColumn: KEY_COLUMN,
  columns,
  columnByKey: Object.fromEntries(columns.map((c) => [c.key, c])) as Record<ItemReviewField, SpecColumn>,
  requiredColumns: columns.filter((c) => c.required).map((c) => c.key),
  bulkSetFields: [...BULK_SET_FIELDS],
  exportFields,
  templateHeaders: [...TEMPLATE_HEADERS],
  headerDetectNorms: [...HEADER_DETECT_NORMS],
  headerAliases,
  files: { xlsx: `${FILE_BASE}.xlsx`, csv: `${FILE_BASE}.csv`, guide: GUIDE_FILE, exportStem: EXPORT_STEM },
  template: buildTemplateModel(),
  descriptionMax: DESCRIPTION_MAX,
  lookups: {
    units: lowerMap(LIVE_UNIT_NAMES),
    unitCategory,
    priceUnits: lowerMap(LIVE_PRICE_UNITS),
    categories: lowerMap(LIVE_CATEGORY_CODES),
    locations: lowerMap(LIVE_LOCATIONS),
    partners: lowerMap(LIVE_PARTNER_NAMES),
    users: lowerMap(LIVE_USER_NAMES),
    approvers: lowerMap(LIVE_APPROVER_NAMES),
  },
};

/** Review-grid column list in template order (key, label, width, description). */
export const ITEM_REVIEW_COLUMNS = columns.map((c) => ({
  key: c.key,
  label: c.label,
  defaultWidth: c.width,
  description: c.description,
  required: c.required,
}));

/* ─── Small shared helpers (pure, live in helpers.ts) ─── */
export { splitList, joinList, normalizeKey, parseYesNo, matchOption, canonical, knownOnly } from "./helpers";
