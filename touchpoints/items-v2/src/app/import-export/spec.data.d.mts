/* Type surface of spec.data.mjs (plain ESM shared with scripts/gen-import-templates.mjs). */

export type ItemReviewField =
  | "partNumber"
  | "description"
  | "status"
  | "tags"
  | "primaryCategory"
  | "additionalCategories"
  | "inventoryType"
  | "inventoryControlType"
  | "lotControl"
  | "lotIdSource"
  | "shelfLifeValue"
  | "shelfLifeUnit"
  | "unit"
  | "alternativeUnits"
  | "acquisitionMethods"
  | "primaryAcquisition"
  | "minStock"
  | "maxStock"
  | "inboundLocations"
  | "outboundLocations"
  | "receivingStagingLocation"
  | "shippingStagingLocation"
  | "minPurchase"
  | "maxPurchase"
  | "multiples"
  | "shortageRule"
  | "sellingScope"
  | "specificPartners"
  | "pricing"
  | "valuationMethod"
  | "owners.materialHandling"
  | "owners.purchasing"
  | "owners.finance"
  | "cycleTolerance"
  | "approvers"
  | "scanLocation"
  | "scanItem"
  | "scanLot"
  | "scanSerial";

export type ColumnKind = "text" | "select" | "multiselect" | "yesno" | "number" | "date";

export type OptionSnapshotName =
  | "units"
  | "priceUnits"
  | "locations"
  | "partners"
  | "users"
  | "approvers"
  | "categories";

export interface ColumnReference {
  description: string;
  format: string;
  validValues: string;
  example: string;
}

export interface ColumnData {
  key: ItemReviewField;
  label: string;
  required: boolean;
  kind: ColumnKind;
  width: number;
  /** Excel numFmt "@" on rows 3..600 of this column. */
  text?: boolean;
  /** Fixed enum values (file vocabulary). */
  options?: readonly string[];
  /** Name of the OPTION_SNAPSHOTS list the options come from. */
  optionsRef?: OptionSnapshotName;
  aliases: readonly string[];
  group: string;
  defaultValue: string;
  description: string;
  example1: string;
  example2: string;
  conditionalOn?: ItemReviewField;
  reference: ColumnReference;
}

export interface ExportFieldData {
  id: string;
  label: string;
  locked?: boolean;
  listing?: boolean;
  /** Review-row / Item field this export column reads. */
  field?: ItemReviewField;
  /** System field with no import column. */
  system?: boolean;
  date?: boolean;
}

export interface InstructionSection {
  heading: string;
  intro?: string;
  items?: readonly (readonly [string, string])[];
}

export interface CompareTable {
  heading: string;
  colHeaders: readonly [string, string];
  rows: readonly (readonly [string, string, string])[];
  mergedLast?: readonly [string, string];
}

export interface ValidValuesBlock {
  heading: string;
  subHeader?: readonly [string, string];
  rows?: readonly (readonly [string, string])[];
  rowsRef?: "unitsByCategory" | "categories" | "users" | "approvers";
  noteRef?: "locations" | "partners";
  note?: string;
}

export interface GuideMatched {
  intro: string;
  newHeading: string;
  newIntro: string;
  newItems: readonly (readonly [string, string])[];
  existingHeading: string;
  existingIntro: string;
  existingItems: readonly (readonly [string, string])[];
}

export interface TemplateCopy {
  title: string;
  bannerFieldReference: string;
  sheetTitle: string;
  moduleLine: string;
  countLine: string;
  frSubtitle: string;
  vvTitle: string;
  vvSubtitle: string;
  instructions: { quickStart: readonly string[]; sections: readonly InstructionSection[] };
  compareTable: CompareTable;
  validValues: readonly ValidValuesBlock[];
  guide: {
    banner: string;
    intro: readonly string[];
    quickStart: readonly string[];
    matched: GuideMatched;
    copying: string;
    notCovered: string;
    fileLimits: string;
    fieldGroups: readonly string[];
  };
}

export const PIPE: "|";
export const NOUNS: {
  singular: string;
  plural: string;
  titleSingular: string;
  titlePlural: string;
  moduleSlug: string;
  moduleTitle: string;
  moduleLine: string;
};
export const STORAGE_NAMESPACE: "items";
export const ROUTES: { listing: string; history: string; record: string };
export const KEY_COLUMN: "partNumber";
export const BULK_SET_FIELDS: readonly ItemReviewField[];
export const FILE_BASE: string;
export const GUIDE_FILE: string;
export const EXPORT_STEM: string;
export const DESCRIPTION_MAX: number;
export const ITEM_IMAGE_PLACEHOLDER: string;

export const OPTION_SNAPSHOTS: {
  units: readonly (readonly [string, string])[];
  priceUnits: readonly string[];
  locations: readonly string[];
  partners: readonly string[];
  users: readonly (readonly [string, string])[];
  approvers: readonly (readonly [string, string])[];
  categories: readonly (readonly [string, string])[];
};

export const ENUMS: {
  status: readonly string[];
  inventoryType: readonly string[];
  inventoryControlType: readonly string[];
  yesno: readonly string[];
  lotIdSource: readonly string[];
  shelfLifeUnit: readonly string[];
  acquisitionMethods: readonly string[];
  shortageRule: readonly string[];
  sellingScope: readonly string[];
  valuationMethod: readonly string[];
};

export const VOCAB: {
  yes: readonly string[];
  no: readonly string[];
  lotIdSource: Record<string, "system" | "vendor">;
  shelfLifeUnit: Record<string, "days" | "months" | "years">;
  acquisition: Record<string, "Purchase" | "Manufacturing">;
  shortageRule: Record<string, "demand" | "min" | "zero" | "off">;
  sellingScope: Record<string, "all" | "specific">;
  valuationMethod: Record<string, "fifo" | "lifo" | "wac" | "specific">;
  inventoryControlType: Record<string, "Serialized" | "Non-Serialized">;
  inventoryType: Record<string, "Stock" | "Non-stock" | "Asset">;
  status: Record<string, "Active" | "Inactive">;
};

export const COLUMNS: readonly ColumnData[];
export const COLUMN_KEYS: readonly ItemReviewField[];
export const REQUIRED_COUNT: number;
export const OPTIONAL_COUNT: number;
export const TEMPLATE_HEADERS: readonly string[];
export const HEADER_DETECT_NORMS: readonly string[];
export const EXAMPLE_ROWS: readonly (readonly string[])[];
export const EXPORT_FIELDS: readonly ExportFieldData[];
export const TEMPLATE: TemplateCopy;
