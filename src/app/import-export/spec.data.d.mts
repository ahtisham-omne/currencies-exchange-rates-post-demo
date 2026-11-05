/* Type surface for spec.data.mjs (plain ESM shared with the Node generator). */

export type ColumnKind = "text" | "select" | "multiselect" | "yesno" | "number" | "date";
/** Extra validation applied to a `text` column. */
export type TextFormat = "email" | "phone";

export interface ColumnRef {
  format: string;
  validValues?: string;
  example: string;
}

export interface ColumnData {
  key: string;
  label: string;
  required?: boolean;
  kind: ColumnKind;
  /** Email / phone checks on a text column. */
  format?: TextFormat;
  /** Static option labels (display vocabulary used in the file). */
  options?: string[];
  /** Options resolved at validation time from the stores. */
  optionsFrom?: "groups" | "partners" | "contacts";
  /** Severity of a value that is not in the option list. Default warning. */
  unknownSeverity?: "error" | "warning";
  /** Values must also appear in this sibling multiselect column. */
  subsetOf?: string;
  /** Severity of the subsetOf breach. Default error. */
  subsetSeverity?: "error" | "warning";
  /** Only meaningful when the sibling column includes the given option. */
  conditionalOn?: { field: string; includes: string };
  min?: number;
  max?: number;
  maxLength?: number;
  /** numFmt "@" (text) on the Data Entry column. */
  text?: boolean;
  width?: number;
  aliases: string[];
  description: string;
  ref: ColumnRef;
  example1: string;
  example2: string;
}

export interface InstructionSection {
  heading: string;
  intro?: string;
  items?: [string, string][];
}

export interface CompareTable {
  heading: string;
  colHeaders: [string, string];
  rows: [string, string, string][];
  mergedLast?: [string, string];
}

export interface ValidValuesBlock {
  heading: string;
  subHeader?: [string, string];
  rows?: [string, string][];
  note?: string;
}

export interface GuideMatchedSection {
  title: string;
  lead: string;
  items: [string, string][];
}

export interface GuideData {
  intro: string[];
  /** CSV-flavoured Quick Start steps; falls back to instructions.quickStart. */
  quickStart?: string[];
  matchedSections: GuideMatchedSection[];
  fieldGroups: { title: string; keys: string[] }[];
}

export interface EntityData {
  entity: string;
  entitySingular: string;
  nounLower: string;
  nounPluralLower: string;
  moduleSlug: string;
  moduleLine: string;
  fileBase: string;
  guideFile: string;
  keyColumn: string;
  freezeColumns: number;
  uploadPath: string;
  columns: ColumnData[];
  frSubtitle: string;
  instructions: { quickStart: string[]; sections: InstructionSection[] };
  compareTable?: CompareTable;
  validValues: ValidValuesBlock[];
  guide: GuideData;
  examples: string[][];
}

export const VENDOR_SUB_TYPES: { id: string; label: string }[];
export const CUSTOMER_SUB_TYPES: { id: string; label: string }[];
export const PARTNER_TYPES: { id: string; label: string }[];
export const COUNTRY_CODES: { code: string; country: string; flag: string }[];
export const CURRENCY_IDS: string[];
export const CURRENCY_CODES: string[];
export const CREDIT_ENFORCEMENT: { id: string; label: string }[];
export const PAYMENT_TERM_PRESETS: { id: string; name: string }[];
export const PRICING_RULE_PRESETS: { id: string; name: string }[];
export const PAYMENT_METHODS: { id: string; label: string; typeLabel: string }[];
export const CARRIERS: { id: string; label: string; name: string }[];
export const GROUP_COUNTRIES: { name: string; flag: string }[];
export const CONTACT_NAMES: string[];
export const STATUS_OPTIONS: string[];
export const YES_NO: string[];
export const BILLING_TYPES: string[];
export const PARTNERS_DATA: EntityData;
export const PARTNER_GROUPS_DATA: EntityData;
export const ALL_ENTITY_DATA: EntityData[];
