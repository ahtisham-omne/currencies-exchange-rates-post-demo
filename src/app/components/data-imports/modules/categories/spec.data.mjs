/* Provenance: radiant-core-fusion/src/app/import-export/spec.data.mjs
 * sha256 9435c3669cf07adce5095c1867cb54cc401ed86ba0ef0e35b552bed426ea81a7
 * Copied into role-zen 2026-09-30. Edits: 1 import/field line(s) rewritten for role-zen (see git diff vs source). 27 Oct 2026: the 5000-character description cap removed, rule and copy (Omne does not cap descriptions; ERP-9664). Otherwise rules and copy unchanged. */
/* Categories import/export entity spec: the raw, JSON-like data.
   Plain ESM so scripts/gen-import-templates.mjs (Node) and spec.ts (the app)
   read the SAME source. Types live in spec.data.d.mts and spec.ts.
   Contract: docs/import-export/SPEC.md section 4.1 (12 columns, key = Category Code).
   Copy rules: no em dashes in any user-facing string; the middle dot (U+00B7)
   banner separator is the UAC standard and stays. */

import { allUnitNames, unitsByCategory, UOM_CATEGORIES } from "./uom.mjs";

const PIPE_EXAMPLE = "[ Engine | Heavy Duty ]";

/** @type {import("./spec").EntityColumn[]} */
export const COLUMNS = [
  {
    key: "code",
    label: "Category Code",
    required: true,
    kind: "text",
    width: 16,
    textFormat: true,
    defaultValue: "",
    example1: "C-1021",
    example2: "C-1022",
    description: "Unique code that identifies the category. Required. A code already in Omne updates that category.",
    reference: {
      description: "The unique code and the matching key. A new code creates a category; a matching code updates that category. Never changed by an import.",
      format: "Text",
      validValues: "",
      example: "C-1021",
    },
    guide: "The unique code and the matching key. A new code creates a category, a matching code updates that category, and the code is never changed by an import. Matching ignores case and surrounding spaces.",
    aliases: ["category code", "code", "category", "category id"],
  },
  {
    key: "status",
    label: "Status",
    required: false,
    kind: "select",
    options: ["Active", "Inactive"],
    width: 12,
    defaultValue: "Active",
    example1: "Active",
    example2: "",
    description: "Active or Inactive. Optional; blank starts a new category as Active and leaves an existing one unchanged.",
    reference: {
      description: "Whether the category is in use. New category: blank means Active. Existing category: blank keeps the current status.",
      format: "Set value",
      validValues: "Active, Inactive, or blank",
      example: "Active",
    },
    guide: "Whether the category is in use. New category: blank means Active. Existing category: blank keeps the current status. Values: Active or Inactive.",
    aliases: ["status", "category status", "state"],
  },
  {
    key: "description",
    label: "Description",
    required: false,
    kind: "text",
    width: 48,
    defaultValue: "",
    example1: "Steel parts for ram pro master 2500",
    example2: "Brake pads and rotors for light trucks",
    description: "What the category holds. Optional, with no length limit.",
    reference: {
      description: "What the category holds. Shown in the listing and on the category page. No length limit.",
      format: "Free text",
      validValues: "",
      example: "Steel parts for ram pro master 2500",
    },
    guide: "What the category holds. Shown in the listing and on the category page. No length limit.",
    aliases: ["description", "desc", "category description"],
  },
  {
    key: "tags",
    label: "Tags",
    required: false,
    kind: "text",
    list: true,
    width: 26,
    textFormat: true,
    maxItemLength: 30,
    defaultValue: "",
    example1: "Engine|Heavy Duty",
    example2: "Braking",
    description: "Pipe-separated keywords used to organize and filter categories. Each tag up to 30 characters.",
    reference: {
      description: "Keywords that describe the category's contents, industry, or use case. One tag, or several separated with a pipe character ( | ). Each tag up to 30 characters.",
      format: "Text, pipe-separated",
      validValues: "",
      example: PIPE_EXAMPLE,
    },
    guide: "Keywords that describe the category's contents, industry, or use case. One tag, or several separated with a pipe character ( | ). Each tag up to 30 characters. Example: [ Engine | Heavy Duty ]",
    aliases: ["tags", "tag", "keywords"],
  },
  {
    key: "inventoryType",
    label: "Inventory Type",
    required: false,
    kind: "select",
    options: ["Stock", "Non-stock", "Asset"],
    width: 16,
    defaultValue: "Stock",
    example1: "Stock",
    example2: "Non-stock",
    description: "How items in this category are tracked: Stock, Non-stock or Asset. Blank means Stock.",
    reference: {
      description: "Determines whether items in this category are physically stocked. Stock for warehoused materials, Non-stock for things ordered when needed, Asset for equipment.",
      format: "Set value",
      validValues: "Stock, Non-stock, Asset, or blank",
      example: "Stock",
    },
    guide: "Determines whether items in this category are physically stocked. Stock for warehoused materials, Non-stock for things ordered when needed, Asset for equipment. Blank means Stock. Values: Stock, Non-stock, or Asset.",
    aliases: ["inventory type", "inventory stock type", "stock type", "type"],
  },
  {
    key: "controlType",
    label: "Control Type",
    required: false,
    kind: "select",
    options: ["Serialized", "Non-Serialized"],
    width: 18,
    defaultValue: "Non-Serialized",
    example1: "Non-Serialized",
    example2: "Serialized",
    description: "How individual units are identified: Serialized (unique ID per unit) or Non-Serialized (tracked by quantity). Blank means Non-Serialized.",
    reference: {
      description: "Defines how individual units are tracked. Serialized gives every unit its own ID, such as a laptop with a serial number. Non-Serialized tracks bulk quantities, such as bolts.",
      format: "Set value",
      validValues: "Serialized, Non-Serialized, or blank",
      example: "Non-Serialized",
    },
    guide: "Defines how individual units are tracked. Serialized gives every unit its own ID, such as a laptop with a serial number. Non-Serialized tracks bulk quantities, such as bolts. Blank means Non-Serialized. Values: Serialized or Non-Serialized.",
    aliases: ["control type", "inventory control type", "inventory control", "control"],
  },
  {
    key: "lotControlEnabled",
    label: "Lot Tracking",
    required: false,
    kind: "yesno",
    options: ["Yes", "No"],
    width: 14,
    defaultValue: "No",
    example1: "Yes",
    example2: "No",
    description: "Yes enables batch-level traceability for the category. Blank means No.",
    reference: {
      description: "Enables batch-level traceability. Enter Yes to track items in lots, No or blank to leave lot tracking off.",
      format: "Yes / No",
      validValues: "Yes, No, or blank",
      example: "Yes",
    },
    guide: "Enables batch-level traceability. Enter Yes to track items in lots, No or blank to leave lot tracking off.",
    aliases: ["lot tracking", "lot control", "lot controlled", "lot tracking enabled"],
  },
  {
    key: "lotIdSource",
    label: "Lot ID Assignment",
    required: false,
    kind: "select",
    options: ["System Generated", "Vendor Lot"],
    width: 20,
    defaultValue: "System Generated",
    conditionalOn: { field: "lotControlEnabled", equals: "Yes" },
    example1: "System Generated",
    example2: "",
    description: "Only when Lot Tracking is Yes. System Generated auto-creates lot IDs; Vendor Lot uses the vendor's lot number.",
    reference: {
      description: "Only applies when Lot Tracking is Yes. System Generated auto-creates lot IDs from a prefix. Vendor Lot uses the vendor's lot number as the lot ID.",
      format: "Set value",
      validValues: "System Generated, Vendor Lot, or blank",
      example: "System Generated",
    },
    guide: "Only applies when Lot Tracking is Yes. System Generated auto-creates lot IDs from a prefix. Vendor Lot uses the vendor's lot number as the lot ID. A value here with Lot Tracking No is ignored. Values: System Generated or Vendor Lot.",
    aliases: ["lot id assignment", "lot id source", "lot id", "lot assignment"],
  },
  {
    key: "uom",
    label: "Base Unit of Measure",
    required: false,
    kind: "select",
    optionsGroups: UOM_CATEGORIES.map((category) => ({ label: category, options: unitsByCategory(category) })),
    options: allUnitNames(),
    width: 22,
    defaultValue: "Each",
    example1: "Each",
    example2: "Kilogram",
    description: "The unit stock levels, valuations and movements are recorded in. Must be a unit Omne knows. Blank means Each.",
    reference: {
      description: "The unit your inventory uses to count and store items in this category. All stock levels, valuations and movements are recorded in this unit. Must match a unit on the Valid Values sheet.",
      format: "Set value",
      validValues: "Any unit on the Valid Values sheet",
      example: "Each",
    },
    guide: "The unit your inventory uses to count and store items in this category. All stock levels, valuations and movements are recorded in this unit. Must match one of the units listed under Valid Values below. Blank means Each.",
    aliases: ["base unit of measure", "base unit of measure (uom)", "base uom", "uom", "unit of measure", "unit", "base unit"],
  },
  {
    key: "alternativeUnits",
    label: "Alternative Units",
    required: false,
    kind: "text",
    list: true,
    width: 28,
    textFormat: true,
    defaultValue: "",
    example1: "Box=12|Pallet=480",
    example2: "",
    description: "Other units the category is bought or sold in, as Unit=factor pairs separated by pipes. Factor is how many base units make one alternative unit.",
    reference: {
      description: "Other units this category is bought or sold in. Each entry is the unit name, an equals sign, and how many base units make one of it. Separate entries with a pipe character ( | ). The unit must belong to a different unit category than the base unit.",
      format: "Unit=factor, pipe-separated",
      validValues: "Units from the Valid Values sheet, factor above 0",
      example: "[ Box=12 | Pallet=480 ]",
    },
    guide: "Other units this category is bought or sold in. Each entry is the unit name, an equals sign, and how many base units make one of it. Separate entries with a pipe character ( | ). The unit must be one Omne knows and belong to a different unit category than the base unit. Example: [ Box=12 | Pallet=480 ]",
    aliases: ["alternative units", "alternate units", "alt units", "alternative unit", "conversions"],
  },
  {
    key: "acquisitionMethods",
    label: "Acquisition Method",
    required: false,
    kind: "multiselect",
    options: ["Purchased", "Manufactured"],
    list: true,
    width: 24,
    defaultValue: "Purchased",
    example1: "Purchased|Manufactured",
    example2: "Manufactured",
    description: "How items are brought into stock: Purchased, Manufactured, or both separated by a pipe. Blank means Purchased.",
    reference: {
      description: "How items in this category are brought into stock. Purchased triggers a Purchase Order recommendation, Manufactured a Work Order recommendation. Enter one, or both separated with a pipe character ( | ).",
      format: "Set value, pipe-separated",
      validValues: "Purchased, Manufactured, or both",
      example: "[ Purchased | Manufactured ]",
    },
    guide: "How items in this category are brought into stock. Purchased triggers a Purchase Order recommendation, Manufactured a Work Order recommendation. Enter one, or both separated with a pipe character ( | ). Blank means Purchased. Example: [ Purchased | Manufactured ]",
    aliases: ["acquisition method", "acquisition methods", "acquisition", "buy make"],
  },
  {
    key: "primaryAcquisition",
    label: "Primary Acquisition",
    required: false,
    kind: "select",
    options: ["Purchased", "Manufactured"],
    width: 20,
    defaultValue: "",
    conditionalOn: { field: "acquisitionMethods", includesAll: ["Purchased", "Manufactured"] },
    example1: "Purchased",
    example2: "",
    description: "Which acquisition method drives replenishment when both are listed. Must be one of the row's Acquisition Method values.",
    reference: {
      description: "Only needed when Acquisition Method lists both. The method Omne recommends first when stock runs low. With a single method, that method is primary and this cell can stay blank.",
      format: "Set value",
      validValues: "Purchased, Manufactured, or blank",
      example: "Purchased",
    },
    guide: "Only needed when Acquisition Method lists both. The method Omne recommends first when stock runs low. With a single method, that method is primary and this cell can stay blank. Values: Purchased or Manufactured.",
    aliases: ["primary acquisition", "primary acquisition method", "primary method", "primary"],
  },
];

export const KEY_FIELD = "code";

/** Columns whose presence identifies the header row during the parser's scan. */
export const HEADER_IDENTIFIERS = ["category code"];

export const BULK_SET_FIELDS = ["status", "inventoryType"];

/** Export "Columns to Include": listing columns first (code locked), then the configuration fields.
    defaultChecked mirrors the listing's visible columns. */
export const EXPORT_FIELDS = [
  { id: "code", label: "Category Code", locked: true, defaultChecked: true },
  { id: "description", label: "Description", defaultChecked: true },
  { id: "tags", label: "Tags", defaultChecked: true },
  { id: "items", label: "No. of Items", defaultChecked: true },
  { id: "createdBy", label: "Created By", defaultChecked: true },
  { id: "createdOn", label: "Created On", defaultChecked: true },
  { id: "status", label: "Status", defaultChecked: true },
  { id: "inventoryType", label: "Inventory Type", defaultChecked: false },
  { id: "controlType", label: "Control Type", defaultChecked: false },
  { id: "lotControlEnabled", label: "Lot Tracking", defaultChecked: false },
  { id: "lotIdSource", label: "Lot ID Assignment", defaultChecked: false },
  { id: "uom", label: "Base Unit of Measure", defaultChecked: false },
  { id: "alternativeUnits", label: "Alternative Units", defaultChecked: false },
  { id: "acquisitionMethods", label: "Acquisition Method", defaultChecked: false },
  { id: "primaryAcquisition", label: "Primary Acquisition", defaultChecked: false },
];

const MATCHING_INTRO =
  "Omne matches each row by Category Code, then decides whether to create a new category or update an existing one. Matching ignores case and surrounding spaces. What happens next depends on whether the code is already in Omne.";

export const TEMPLATE = {
  fileBase: "OMNE_Categories_Import_Template",
  guideFileBase: "OMNE_Categories_Import_Guide",
  bannerTitle: "Categories Import Template",
  moduleLine: "Omne Pioneer  ·  Items Management",
  countLine: "12 columns  ·  1 required, 11 optional",
  frBanner: "Categories Import, Field Reference",
  frSubtitle: "Every column explained. The red row is required and cannot be left blank.",
  instructions: {
    quickStart: [
      "Go to the Data Entry sheet. That is where you enter your categories, one category per row.",
      "Review the two example rows. They show the expected format for each column. Delete them before you import.",
      "Enter your categories. The one required column has a red header and cannot be left blank: Category Code.",
      "Status and the configuration columns are optional. A blank cell uses the default for a new category and leaves an existing category unchanged. See How Categories Are Matched below.",
      "For columns that can hold a list, such as Tags, Alternative Units, and Acquisition Method, separate each value with a pipe character ( | ). The pipe is on most keyboards above the backslash key, typed with Shift. Example: " + PIPE_EXAMPLE + ".",
      "Save the file, then upload it in Omne under Items Management, Categories, Actions, Import.",
    ],
    sections: [
      {
        heading: "HOW CATEGORIES ARE MATCHED",
        intro: MATCHING_INTRO,
        items: [
          ["New category", "The code is not in Omne yet, so a new category is created. Status: blank means Active. Configuration: blank cells take the defaults, Stock, Non-Serialized, Lot Tracking No, Each, and Purchased. Tags: added as given."],
          ["Existing category", "The code already belongs to a category, so that category is updated. Any blank cell leaves the existing value unchanged. A filled-in cell replaces the current value. Items already in the category are not changed by an import."],
          ["Category Code", "The code is the matching key and is never changed by an import. A different code is treated as a different category."],
        ],
      },
      {
        heading: "COPYING FROM ANOTHER SYSTEM",
        intro: "This template is plain text, so you can copy and paste from an export of your old system. Line your old columns up with these columns, fill in any that your old system did not have, and paste. Unit names can be typed as Omne lists them or as their short form, such as EA or KG.",
      },
      {
        heading: "MORE THAN THE COLUMNS ALLOW",
        intro: "These columns cover the basic information and the required configuration of a category. Optional configurations such as stock limits, locations, procurement, selling, and governance settings are not in this template. Import what fits here, then finish the rest on the category page afterwards.",
      },
      {
        heading: "IMPORTANT NOTES",
        items: [
          ["Status", "Active or Inactive. A new category with a blank Status starts as Active. An existing category keeps its current status when the cell is blank. Leaving it blank is always safe."],
          ["Tags", "Separate several tags with a pipe character ( | ). Each tag is trimmed and may be up to 30 characters; a longer tag is shortened and flagged with a warning."],
          ["Lot Tracking", "Enter Yes or No. Lot ID Assignment only matters when Lot Tracking is Yes; a value there with Lot Tracking No is ignored with a warning."],
          ["Base Unit of Measure", "Must be a unit Omne knows. The Valid Values sheet lists every unit by category. A unit Omne does not know stops the row until it is fixed."],
          ["Alternative Units", "Enter Unit=factor pairs separated with a pipe character ( | ), for example [ Box=12 | Pallet=480 ]. The factor is how many base units make one alternative unit and must be above 0. The unit must be from a different category than the base unit."],
          ["Acquisition Method", "Purchased, Manufactured, or both separated with a pipe character ( | ). With both, use Primary Acquisition to say which one Omne recommends first."],
          ["File Limits", "Upload an Excel or CSV file up to 10 MB. Omne reads a single sheet. Keep only the data sheet before you upload."],
          ["Empty Cells", "Safe to leave blank in optional columns. Omne skips an empty cell and never overwrites an existing value with a blank."],
        ],
      },
    ],
  },
  compareTable: {
    heading: "New category vs existing category",
    colHeaders: ["For a new category (code not in Omne)", "For an existing category (code already in Omne)"],
    rows: [
      ["The row", "Creates a new category.", "Updates the existing category. Only the columns you fill in change."],
      ["Blank cell", "The default is used: Active, Stock, Non-Serialized, Lot Tracking No, Each, Purchased.", "A blank cell leaves the existing value unchanged."],
      ["Status", "Blank means Active. Enter Inactive to start the category switched off.", "Blank keeps the current status. Enter a value only to change it."],
      ["Tags", "Added to the new category.", "Replace the current tags. Leave blank to keep them."],
      ["Configuration", "Inventory Type, Control Type, Lot Tracking, Base Unit of Measure and Acquisition Method start from the defaults unless you fill them in.", "Each filled-in column replaces the current setting. Items already in the category are not changed by an import."],
    ],
    mergedLast: ["Category Code", "The code is the matching key and is never changed by an import. A different code is treated as a different category."],
  },
  validValues: [
    {
      heading: "New and existing categories",
      subHeader: ["Case", "What the import does"],
      rows: [
        ["New code", "Creates a new category. Blank Status means Active. Blank configuration cells take the defaults."],
        ["Existing code", "Updates the category. Blank cells keep existing values. Filled-in cells replace them."],
      ],
    },
    {
      heading: "Status",
      subHeader: ["Value", "What it means"],
      rows: [
        ["Active", "The category is in use and items can be assigned to it."],
        ["Inactive", "The category is switched off. Existing items keep it, new items cannot pick it."],
        ["(blank)", "Safe on every row. New categories start as Active; existing categories keep their current status."],
      ],
    },
    {
      heading: "Inventory Type",
      subHeader: ["Value", "What it means"],
      rows: [
        ["Stock", "Raw materials and parts kept in the warehouse."],
        ["Non-stock", "Things ordered when needed, such as office stationery."],
        ["Asset", "Equipment and tools tracked as assets."],
        ["(blank)", "New category: Stock. Existing category: unchanged."],
      ],
    },
    {
      heading: "Control Type",
      subHeader: ["Value", "What it means"],
      rows: [
        ["Serialized", "Every unit has its own ID, such as a laptop with a serial number."],
        ["Non-Serialized", "Units are tracked in bulk by quantity, such as bolts."],
        ["(blank)", "New category: Non-Serialized. Existing category: unchanged."],
      ],
    },
    {
      heading: "Lot Tracking",
      subHeader: ["Value", "What it means"],
      rows: [
        ["Yes", "Items are tracked in lots for batch-level traceability."],
        ["No", "No lot tracking."],
        ["(blank)", "New category: No. Existing category: unchanged."],
      ],
    },
    {
      heading: "Lot ID Assignment",
      subHeader: ["Value", "What it means"],
      rows: [
        ["System Generated", "Omne auto-generates lot IDs based on a prefix."],
        ["Vendor Lot", "The vendor's lot number becomes the lot ID."],
        ["(blank)", "New category: System Generated. Existing category: unchanged."],
      ],
      note: "Only applies when Lot Tracking is Yes. A value here with Lot Tracking No is ignored.",
    },
    {
      heading: "Base Unit of Measure",
      subHeader: ["Category", "Units"],
      rows: UOM_CATEGORIES.map((category) => [category, unitsByCategory(category).join(", ")]),
      note: "Use the unit name exactly as listed. Short forms such as EA, KG, or BX are also accepted. Blank means Each for a new category. A unit Omne does not know is an error and the row will not import until it is fixed.",
    },
    {
      heading: "Alternative Units",
      note: "Unit=factor pairs separated with a pipe character ( | ), for example [ Box=12 | Pallet=480 ]. The unit must be one listed above and from a different category than the base unit. The factor is how many base units make one alternative unit and must be above 0.",
    },
    {
      heading: "Acquisition Method",
      subHeader: ["Value", "What it means"],
      rows: [
        ["Purchased", "Sourced from a vendor. Triggers a Purchase Order recommendation."],
        ["Manufactured", "Produced in-house. Triggers a Work Order recommendation."],
        ["(blank)", "New category: Purchased. Existing category: unchanged."],
      ],
      note: "Enter both separated with a pipe character ( | ) when a category is both bought and made.",
    },
    {
      heading: "Primary Acquisition",
      subHeader: ["Value", "What it means"],
      rows: [
        ["Purchased", "Omne recommends a Purchase Order first."],
        ["Manufactured", "Omne recommends a Work Order first."],
        ["(blank)", "With a single Acquisition Method, that method is primary. With both, Purchased is used."],
      ],
      note: "Must be one of the row's Acquisition Method values; otherwise it is ignored with a warning.",
    },
    {
      heading: "Lists (Tags, Alternative Units, Acquisition Method)",
      note: "These columns can hold more than one value. Separate each value with a pipe character ( | ), found above the backslash key using Shift. Example: " + PIPE_EXAMPLE + ".",
    },
  ],
  guide: {
    title: "OMNE CATEGORIES IMPORT GUIDE",
    intro: [
      "This guide explains how to fill in the Categories import CSV. It covers the steps, every column, and what the import does for a new category and an existing category.",
      "The CSV has 1 required column and 11 optional ones.",
    ],
    quickStart: [
      "Open the CSV. The first row is the column headers. Each row below it is one category.",
      "Two example rows are included to show the expected format. Delete both before you import.",
      "Fill in your categories. The one required column is marked with an asterisk and cannot be left blank: Category Code.",
      "Status and the configuration columns are optional. A blank cell uses the default for a new category and leaves an existing category unchanged. See How Categories Are Matched below.",
      "For columns that can hold a list, such as Tags, Alternative Units, and Acquisition Method, separate each value with a pipe character ( | ). The pipe is on most keyboards above the backslash key, typed with Shift. Example: " + PIPE_EXAMPLE,
      "Save the file, then upload it in Omne under Items Management, Categories, Actions, Import.",
    ],
    matching: {
      intro: MATCHING_INTRO,
      cases: [
        {
          subheader: "For a new category (code not in Omne)",
          lead: "A new category is created.",
          items: [
            ["Status", "Blank means Active. Enter Inactive to start the category switched off."],
            ["Configuration", "Blank cells take the defaults: Stock, Non-Serialized, Lot Tracking No, Each, Purchased."],
            ["Tags", "Added to the new category."],
          ],
        },
        {
          subheader: "For an existing category (code already in Omne)",
          lead: "The matching category is updated with the values you provide. A blank cell leaves the existing value unchanged.",
          items: [
            ["Status", "Blank keeps the current status. Enter a value only to change it."],
            ["Configuration", "Each filled-in column replaces the current setting. Items already in the category are not changed by an import."],
            ["Tags", "Replace the current tags. Leave blank to keep them."],
          ],
        },
      ],
    },
    fileLimits: "Upload an Excel or CSV file up to 10 MB. Omne reads a single sheet. If you are using the Excel template, keep only the data sheet before you upload.",
    fieldGroups: [
      { heading: "Required column", keys: ["code"] },
      { heading: "Basic information", keys: ["status", "description", "tags"] },
      { heading: "Configuration", keys: ["inventoryType", "controlType", "lotControlEnabled", "lotIdSource", "uom", "alternativeUnits", "acquisitionMethods", "primaryAcquisition"] },
    ],
  },
};

/** @type {import("./spec").EntitySpec} */
export const CATEGORIES_SPEC_DATA = {
  nounSingular: "category",
  nounPlural: "categories",
  titleSingular: "Category",
  titlePlural: "Categories",
  moduleSlug: "categories",
  storageNamespace: "categories",
  routes: {
    listing: "/categories",
    history: "/categories/imports",
    record: "/categories/imports/:importId",
  },
  keyField: KEY_FIELD,
  headerIdentifiers: HEADER_IDENTIFIERS,
  columns: COLUMNS,
  bulkSetFields: BULK_SET_FIELDS,
  exportFields: EXPORT_FIELDS,
  template: TEMPLATE,
};
