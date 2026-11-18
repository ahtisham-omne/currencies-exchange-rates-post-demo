/* One definition per Data Imports module that runs the Users review and
 * record page with its own columns and rules: Item Library, Categories,
 * Partners and Partner Group.
 *
 * Everything module-specific comes from the home repo's import-export data
 * layer, copied under ./<slug>/ with a provenance header (source path +
 * sha256): the column list, labels, required flags, options, template
 * headers, bulk-set fields and the validator itself. This file only adapts
 * those layers to one shape the shared review modal and record page read,
 * and keeps the per-load "existing records" each validator matches against
 * (create vs update), seeded from the home repos' seed data. */

import { capListedValues } from "../shared-cells/examples";
import { CATEGORIES_IMPORT_SPEC, COLUMNS as CATEGORY_COLUMNS, TEMPLATE_HEADERS as CATEGORY_HEADERS } from "./categories/spec";
import { validateRows as validateCategories } from "./categories/validation";
import { normalizeKey as normalizeCategoryKey } from "./categories/values";
import { EXISTING_CATEGORY_CODES } from "./categories/existing";
import { ITEMS_IMPORT_SPEC } from "./item-library/spec";
import { COLUMNS as ITEM_DATA_COLUMNS } from "./item-library/spec.data.mjs";
import { buildValidationContext as buildItemsContext, validateRows as validateItems } from "./item-library/validation";
import { EXISTING_ITEMS } from "./item-library/existing";
import type { Item } from "./item-library/live";
import { splitPipe } from "./item-library/helpers";
import { PARTNERS_IMPORT_SPEC, PARTNER_GROUPS_IMPORT_SPEC, splitList, type EntitySpec as PartnerEntitySpec } from "./partners/spec";
import { buildValidationContext as buildPartnersContext, validateRows as validatePartnerRows } from "./partners/validation";
import { CONTACT_DIRECTORY_NAMES, EXISTING_GROUP_NAMES, EXISTING_PARTNERS } from "./partners/existing";
import {
  PI_TABS,
  piApplyImported,
  piColumns,
  piContext,
  piItemsFor,
  piTemplateHeaders,
  piTemplateSpec,
  validatePiRows,
  INCREASE_REASONS as PI_REASONS,
  KNOWN_LOCATIONS as PI_LOCATIONS,
  TEMPLATE_ENTITY as PI_ENTITY,
  type PiSlug,
} from "./physical-inventory/piModule";
import { ALL_UOM_OPTIONS as PI_UOMS, SERIALIZED_UOM as PI_SERIAL_UOM } from "./physical-inventory/piData";
import type { ImportValidationContext as PiContext } from "./physical-inventory/types";

export const MODULE_IMPORT_SLUGS = [
  "item-library",
  "categories",
  "partners",
  "partner-groups",
  /* Physical Inventory: one tab per control type (./physical-inventory/piModule.ts). */
  "physical-inventory-serialized",
  "physical-inventory-non-serialized",
  "physical-inventory-lot-serialized",
  "physical-inventory-lot",
] as const;
export type ModuleImportSlug = (typeof MODULE_IMPORT_SLUGS)[number];

export function isModuleImportSlug(slug: string): slug is ModuleImportSlug {
  return (MODULE_IMPORT_SLUGS as readonly string[]).includes(slug);
}

/** A review row: column key to the raw cell text (pipe-joined for lists). */
export type ModuleRow = Record<string, string>;

export type ModuleIssueSeverity = "error" | "warning";

/** The common shape of the three home validators' CellIssue. */
export interface ModuleIssue {
  field: string;
  severity: ModuleIssueSeverity;
  code: string;
  message: string;
  explanation?: string;
  example?: string;
  options?: string[];
}

export interface ModuleRowValidation {
  status: "ready" | "warning" | "error";
  issues: ModuleIssue[];
  byField: Partial<Record<string, ModuleIssue[]>>;
  isUpdate: boolean;
}

export interface ModuleValidationResult {
  rows: ModuleRowValidation[];
  errorRowCount: number;
  warningRowCount: number;
  readyRowCount: number;
}

export interface ModuleColumn {
  key: string;
  label: string;
  required: boolean;
  kind: "text" | "select" | "multiselect" | "yesno" | "number" | "date";
  /** Header tooltip copy in the review grid. */
  description: string;
  /** Review-grid and record-table width in px. */
  defaultWidth: number;
  /** Data Entry column width in Excel units (the shipped template's). */
  templateWidth: number;
  /** numFmt "@" on the template column. */
  textFormat: boolean;
  /** Fixed options for the cell editor and the bulk-set menu. */
  options?: string[];
  /** Reference columns: the editor lists the live names instead. */
  optionsFrom?: "groups" | "partners" | "contacts";
  /** Values are pipe-separated. */
  multi: boolean;
  /** The template example row 1 value (a value that passes). */
  example: string;
}

export interface ModuleImportDef {
  slug: ModuleImportSlug;
  /** "Items", "Partner Groups". */
  entities: string;
  /** "Item", "Partner Group". */
  entity: string;
  /** "item", "partner group". */
  noun: string;
  /** "items", "partner groups". */
  nounPlural: string;
  keyField: string;
  keyLabel: string;
  columns: ModuleColumn[];
  /** Bulk-set menus on the review's selection bar, from the spec. */
  bulkSetFields: string[];
  /** Template header row, exactly as the shipped CSV / Data Entry row 2. */
  templateHeaders: string[];
  /** Data Entry A1 heading band. */
  templateBanner: string;
  /** Frozen columns on the shipped Data Entry sheet. */
  templateXSplit: number;
  /** Snapshot the validation context (existing records, reference lists). */
  buildContext: () => unknown;
  validate: (rows: ModuleRow[], ctx: unknown) => ModuleValidationResult;
  /** Reference names for the cell editor of an `optionsFrom` column. */
  referenceOptions: (from: NonNullable<ModuleColumn["optionsFrom"]>) => string[];
  /** Fold imported rows into the module's existing records. */
  applyImported: (created: ModuleRow[], updated: ModuleRow[]) => void;
  /** Uploaded header cell to column key, with the home parser's rules:
   *  label or any alias, "*" and "(required)" stripped, spaces collapsed,
   *  case-insensitive. */
  resolveHeader: (raw: string) => string | undefined;
}

/* ────────────────────────────────────
   Header aliases (each home repo's fileParser.ts)
   ──────────────────────────────────── */

/** The home parsers' normHeader, identical in all three repos. */
export function normHeader(raw: string): string {
  return String(raw ?? "")
    .replace(/\*/g, "")
    .replace(/\(\s*required\s*\)/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Categories (radiant-core-fusion buildHeaderAliases): per column, label
 *  then aliases; the first column to claim a spelling wins. */
function categoryHeaderMap(): Map<string, string> {
  const out = new Map<string, string>();
  for (const c of CATEGORY_COLUMNS) {
    for (const a of [c.label, ...c.aliases]) {
      const n = normHeader(a);
      if (n && !out.has(n)) out.set(n, c.key);
    }
  }
  return out;
}

/** Partners / Partner Groups (partner-management-module headerAliasMap):
 *  every label first, then every alias; first claim wins. */
function partnerHeaderMap(spec: PartnerEntitySpec): Map<string, string> {
  const out = new Map<string, string>();
  for (const c of spec.columns) {
    const n = normHeader(c.label);
    if (!out.has(n)) out.set(n, c.key);
  }
  for (const c of spec.columns) {
    for (const a of c.aliases ?? []) {
      const n = normHeader(a);
      if (n && !out.has(n)) out.set(n, c.key);
    }
  }
  return out;
}

const CATEGORY_HEADERS_MAP = categoryHeaderMap();
const PARTNER_HEADERS_MAP = partnerHeaderMap(PARTNERS_IMPORT_SPEC);
const GROUP_HEADERS_MAP = partnerHeaderMap(PARTNER_GROUPS_IMPORT_SPEC);

/* ────────────────────────────────────
   Existing records, per page load
   ──────────────────────────────────── */

/* Module-level state, so it resets on every page load exactly like the Users
 * listing role-zen keeps in memory. Imports made this session add to it, so a
 * second import of the same key reads as an update. */
const categoryCodes: string[] = [...EXISTING_CATEGORY_CODES];
const items: Item[] = EXISTING_ITEMS.map((i) => ({ ...i, additionalCategories: [...(i.additionalCategories ?? [])] }));
const partners: { displayName: string; companyName: string }[] = EXISTING_PARTNERS.map((p) => ({ ...p }));
const groupNames: string[] = [...EXISTING_GROUP_NAMES];

function addUnique(list: string[], value: string): void {
  const v = value.trim();
  if (!v) return;
  if (!list.some((x) => x.trim().toLowerCase() === v.toLowerCase())) list.push(v);
}

/* ────────────────────────────────────
   Column adapters
   ──────────────────────────────────── */

const px = (excelWidth: number) => Math.max(90, Math.round(excelWidth * 7));

function categoryColumns(): ModuleColumn[] {
  return CATEGORY_COLUMNS.map((c) => ({
    key: c.key,
    label: c.label,
    required: c.required,
    kind: c.kind,
    description: c.description,
    defaultWidth: px(c.width),
    templateWidth: c.width,
    textFormat: !!c.textFormat,
    options: c.options && c.options.length > 0 ? [...c.options] : undefined,
    multi: c.kind === "multiselect" || !!c.list,
    example: c.example1,
  }));
}

function itemColumns(): ModuleColumn[] {
  return ITEMS_IMPORT_SPEC.columns.map((c) => ({
    key: c.key,
    label: c.label,
    required: c.required,
    kind: c.kind,
    description: c.description,
    defaultWidth: c.width,
    templateWidth: ITEM_DATA_COLUMNS.find((d) => d.key === c.key)?.width ?? 18,
    textFormat: c.text,
    options: c.options.length > 0 ? [...c.options] : undefined,
    multi: c.kind === "multiselect",
    example: c.example1,
  }));
}

function partnerColumns(spec: PartnerEntitySpec): ModuleColumn[] {
  return spec.columns.map((c) => ({
    key: c.key,
    label: c.label,
    required: !!c.required,
    kind: c.kind,
    description: c.description,
    defaultWidth: px(c.width ?? 18),
    templateWidth: c.width ?? 18,
    textFormat: !!c.text,
    options: c.options && c.options.length > 0 ? [...c.options] : undefined,
    optionsFrom: c.optionsFrom,
    multi: c.kind === "multiselect",
    example: c.example1,
  }));
}

function toModuleResult(r: {
  rows: { status: "ready" | "warning" | "error"; issues: unknown[]; byField: unknown; isUpdate: boolean }[];
  errorRowCount: number;
  warningRowCount: number;
  readyRowCount: number;
}): ModuleValidationResult {
  /* Long option lists in messages name at most five correct values. */
  for (const row of r.rows) {
    for (const raw of row.issues) {
      const issue = raw as { message?: string; explanation?: string };
      if (issue.message) issue.message = capListedValues(issue.message);
      if (issue.explanation) issue.explanation = capListedValues(issue.explanation);
    }
  }
  return r as unknown as ModuleValidationResult;
}

const partnerReference = (from: NonNullable<ModuleColumn["optionsFrom"]>): string[] => {
  if (from === "groups") return [...groupNames];
  if (from === "partners") return partners.map((p) => p.displayName).filter(Boolean);
  return [...CONTACT_DIRECTORY_NAMES];
};

/* ────────────────────────────────────
   The four definitions
   ──────────────────────────────────── */

const CATEGORIES_DEF: ModuleImportDef = {
  slug: "categories",
  entities: CATEGORIES_IMPORT_SPEC.titlePlural,
  entity: CATEGORIES_IMPORT_SPEC.titleSingular,
  noun: CATEGORIES_IMPORT_SPEC.nounSingular,
  nounPlural: CATEGORIES_IMPORT_SPEC.nounPlural,
  keyField: CATEGORIES_IMPORT_SPEC.keyField,
  keyLabel: CATEGORY_COLUMNS.find((c) => c.key === CATEGORIES_IMPORT_SPEC.keyField)!.label,
  columns: categoryColumns(),
  bulkSetFields: [...CATEGORIES_IMPORT_SPEC.bulkSetFields],
  templateHeaders: [...CATEGORY_HEADERS],
  templateBanner: `OMNE  ·  ${CATEGORIES_IMPORT_SPEC.template.bannerTitle}  ·  Data Entry`,
  templateXSplit: 1,
  /* The Categories listing's existingCodes(): normalizeKey of every code. */
  buildContext: () => ({ existingCodes: new Set(categoryCodes.map((c) => normalizeCategoryKey(c))) }),
  validate: (rows, ctx) => toModuleResult(validateCategories(rows as never, ctx as never)),
  referenceOptions: () => [],
  applyImported: (created) => {
    for (const r of created) addUnique(categoryCodes, r.code ?? "");
  },
  resolveHeader: (raw) => CATEGORY_HEADERS_MAP.get(normHeader(raw)),
};

const ITEMS_DEF: ModuleImportDef = {
  slug: "item-library",
  entities: ITEMS_IMPORT_SPEC.nouns.titlePlural,
  entity: ITEMS_IMPORT_SPEC.nouns.titleSingular,
  noun: ITEMS_IMPORT_SPEC.nouns.singular,
  nounPlural: ITEMS_IMPORT_SPEC.nouns.plural,
  keyField: ITEMS_IMPORT_SPEC.keyColumn,
  keyLabel: ITEMS_IMPORT_SPEC.columnByKey[ITEMS_IMPORT_SPEC.keyColumn].label,
  columns: itemColumns(),
  bulkSetFields: [...ITEMS_IMPORT_SPEC.bulkSetFields],
  templateHeaders: [...ITEMS_IMPORT_SPEC.templateHeaders],
  templateBanner: "OMNE  ·  Items Import Template  ·  Data Entry",
  templateXSplit: 3,
  /* The Items listing's buildValidationContext(items): existing part numbers
   * plus every category already used by an item. */
  buildContext: () => buildItemsContext(items),
  validate: (rows, ctx) => toModuleResult(validateItems(rows as never, ctx as never)),
  referenceOptions: () => [],
  applyImported: (created) => {
    for (const r of created) {
      const pn = (r.partNumber ?? "").trim();
      if (!pn || items.some((i) => i.partNumber.trim().toLowerCase() === pn.toLowerCase())) continue;
      items.push({ partNumber: pn, primaryCategory: (r.primaryCategory ?? "").trim(), additionalCategories: splitPipe(r.additionalCategories ?? "") });
    }
  },
  /* nimble-palette planColumns: spec.headerAliases[normHeader(raw)]. */
  resolveHeader: (raw) => ITEMS_IMPORT_SPEC.headerAliases[normHeader(raw)],
};

const PARTNERS_DEF: ModuleImportDef = {
  slug: "partners",
  entities: PARTNERS_IMPORT_SPEC.entity,
  entity: PARTNERS_IMPORT_SPEC.entitySingular,
  noun: PARTNERS_IMPORT_SPEC.nounLower,
  nounPlural: PARTNERS_IMPORT_SPEC.nounPluralLower,
  keyField: PARTNERS_IMPORT_SPEC.keyColumn,
  keyLabel: PARTNERS_IMPORT_SPEC.columns.find((c) => c.key === PARTNERS_IMPORT_SPEC.keyColumn)!.label,
  columns: partnerColumns(PARTNERS_IMPORT_SPEC),
  bulkSetFields: [...PARTNERS_IMPORT_SPEC.bulkSetFields],
  templateHeaders: PARTNERS_IMPORT_SPEC.columns.map((c) => (c.required ? `${c.label} *` : c.label)),
  templateBanner: "OMNE  ·  Partners Import Template  ·  Data Entry",
  templateXSplit: 4,
  /* The Partners listing's buildValidationContext(spec, vendors, groups). */
  buildContext: () => buildPartnersContext(PARTNERS_IMPORT_SPEC, partners, groupNames.map((name) => ({ name }))),
  validate: (rows, ctx) => toModuleResult(validatePartnerRows(PARTNERS_IMPORT_SPEC, rows, ctx as never)),
  referenceOptions: partnerReference,
  applyImported: (created) => {
    for (const r of created) {
      const name = (r.partnerName ?? "").trim();
      if (!name) continue;
      if (partners.some((p) => p.displayName.toLowerCase() === name.toLowerCase())) continue;
      partners.push({ displayName: name, companyName: name });
    }
  },
  resolveHeader: (raw) => PARTNER_HEADERS_MAP.get(normHeader(raw)),
};

const PARTNER_GROUPS_DEF: ModuleImportDef = {
  slug: "partner-groups",
  entities: PARTNER_GROUPS_IMPORT_SPEC.entity,
  entity: PARTNER_GROUPS_IMPORT_SPEC.entitySingular,
  noun: PARTNER_GROUPS_IMPORT_SPEC.nounLower,
  nounPlural: PARTNER_GROUPS_IMPORT_SPEC.nounPluralLower,
  keyField: PARTNER_GROUPS_IMPORT_SPEC.keyColumn,
  keyLabel: PARTNER_GROUPS_IMPORT_SPEC.columns.find((c) => c.key === PARTNER_GROUPS_IMPORT_SPEC.keyColumn)!.label,
  columns: partnerColumns(PARTNER_GROUPS_IMPORT_SPEC),
  bulkSetFields: [...PARTNER_GROUPS_IMPORT_SPEC.bulkSetFields],
  templateHeaders: PARTNER_GROUPS_IMPORT_SPEC.columns.map((c) => (c.required ? `${c.label} *` : c.label)),
  templateBanner: "OMNE  ·  Partner Groups Import Template  ·  Data Entry",
  templateXSplit: 1,
  /* The Partner Groups listing's buildValidationContext(spec, vendors, groups). */
  buildContext: () => buildPartnersContext(PARTNER_GROUPS_IMPORT_SPEC, partners, groupNames.map((name) => ({ name }))),
  validate: (rows, ctx) => toModuleResult(validatePartnerRows(PARTNER_GROUPS_IMPORT_SPEC, rows, ctx as never)),
  referenceOptions: partnerReference,
  applyImported: (created) => {
    for (const r of created) addUnique(groupNames, r.groupName ?? "");
  },
  resolveHeader: (raw) => GROUP_HEADERS_MAP.get(normHeader(raw)),
};

/* ────────────────────────────────────
   Physical Inventory, one definition per control-type tab
   ──────────────────────────────────── */

function piDef(tab: (typeof PI_TABS)[number]): ModuleImportDef {
  const { mode } = tab;
  const cols = piColumns(mode);
  const spec = piTemplateSpec(mode);
  const entities = PI_ENTITY[mode];
  const serialKeyed = cols.some((c) => c.key === "serialNumber");
  const uoms = mode === "serialized" || mode === "lot-serialized" ? [PI_SERIAL_UOM] : [...PI_UOMS];
  const options = (key: string, kind: string): string[] | undefined => {
    if (key === "partNumber") return piItemsFor(mode).map((i) => i.partNumber);
    if (kind === "uom") return uoms;
    if (kind === "location") return [...PI_LOCATIONS];
    if (kind === "reason") return PI_REASONS.map((r) => r.label);
    return undefined;
  };
  const columns: ModuleColumn[] = cols.map((c, i) => {
    const tpl = spec.columns[i];
    return {
      key: c.key,
      label: c.label,
      required: !!c.required,
      kind: c.key === "partNumber" || c.kind === "uom" || c.kind === "location" || c.kind === "reason" ? "select" : c.kind === "qty" || c.kind === "price" ? "number" : "text",
      description: tpl.reference.description,
      defaultWidth: c.width,
      templateWidth: tpl.width ?? 18,
      textFormat: !!tpl.textFormat,
      options: options(c.key, c.kind),
      multi: false,
      example: String(tpl.example1 ?? ""),
    };
  });
  const byHeader = new Map(cols.map((c) => [normHeader(c.label), c.key]));
  return {
    slug: tab.slug,
    entities,
    entity: entities.replace(/s$/, ""),
    noun: entities.replace(/s$/, "").toLowerCase().replace(/^lot /, "LOT "),
    nounPlural: entities.toLowerCase().replace(/^lot /, "LOT "),
    keyField: serialKeyed ? "serialNumber" : "partNumber",
    keyLabel: serialKeyed ? "Serial Number" : "Part Number",
    columns,
    bulkSetFields: cols.filter((c) => c.kind === "location" || c.kind === "reason" || c.kind === "uom").map((c) => c.key),
    templateHeaders: piTemplateHeaders(mode),
    templateBanner: `OMNE  ·  ${spec.template.bannerTitle}  ·  Data Entry`,
    templateXSplit: 1,
    buildContext: () => piContext(mode),
    validate: (rows, ctx) => {
      const res = validatePiRows(mode, rows, ctx as PiContext);
      const out = res.map((r) => {
        const issues = r.issues.map((x) => ({ ...x })) as ModuleIssue[];
        const byField: Partial<Record<string, ModuleIssue[]>> = {};
        for (const x of issues) (byField[x.field] ??= []).push(x);
        return { status: r.status, issues, byField, isUpdate: false };
      });
      return {
        rows: out,
        errorRowCount: out.filter((r) => r.status === "error").length,
        warningRowCount: out.filter((r) => r.status === "warning").length,
        readyRowCount: out.filter((r) => r.status === "ready").length,
      };
    },
    referenceOptions: () => [],
    applyImported: (created) => piApplyImported(mode, created),
    resolveHeader: (raw) => byHeader.get(normHeader(raw)),
  };
}

const PI_DEFS = Object.fromEntries(PI_TABS.map((t) => [t.slug, piDef(t)])) as Record<PiSlug, ModuleImportDef>;

export const MODULE_IMPORT_DEFS: Record<ModuleImportSlug, ModuleImportDef> = {
  "item-library": ITEMS_DEF,
  categories: CATEGORIES_DEF,
  partners: PARTNERS_DEF,
  "partner-groups": PARTNER_GROUPS_DEF,
  ...PI_DEFS,
};

/** A row with every column present, blank where the file had nothing. */
export function completeRow(def: ModuleImportDef, values: Record<string, string>): ModuleRow {
  const row: ModuleRow = {};
  for (const c of def.columns) row[c.key] = values[c.key] ?? "";
  return row;
}

/** Options the cell editor offers for a column ([] = free text). */
export function editorOptions(def: ModuleImportDef, col: ModuleColumn): string[] {
  if (col.kind === "yesno") return ["Yes", "No"];
  if (col.optionsFrom) return def.referenceOptions(col.optionsFrom);
  return col.options ?? [];
}

/** Split a pipe list the way the editors and the stores read it. */
export function splitModuleList(value: string): string[] {
  return splitList(value);
}
