/* Items import/export: the raw entity data, plain ESM with no imports so both
 * the app (through spec.ts) and the Node template script (scripts/
 * gen-import-templates.mjs) read one source. Option lists that come from
 * TS constants in the app are SNAPSHOTS here; src/app/import-export/
 * spec.options.test.ts asserts every snapshot equals the live constant, so
 * the checked-in template files cannot drift from what the app validates
 * against.
 *
 * Column order, keys, required flags and rules follow
 * docs/import-export/SPEC.md section 4.2 (39 columns, key = Part Number,
 * required = Part Number + Primary Category). */

/** The older list separator. Files made for the pipe template still read (helpers splitList). */
export const PIPE = "|";
const MDOT = "·";

/* ─── Nouns, routes, storage ─── */
export const NOUNS = {
  singular: "item",
  plural: "items",
  titleSingular: "Item",
  titlePlural: "Items",
  moduleSlug: "items",
  moduleTitle: "Items",
  moduleLine: `Omne Pioneer  ${MDOT}  Items & Inventory`,
};
export const STORAGE_NAMESPACE = "items";
export const ROUTES = {
  listing: "/items",
  history: "/items/imports",
  record: "/items/imports/:importId",
};
export const KEY_COLUMN = "partNumber";
export const BULK_SET_FIELDS = ["status", "inventoryControlType"];
export const FILE_BASE = "OMNE_Items_Import_Template";
export const GUIDE_FILE = "OMNE_Items_Import_Guide.txt";
export const EXPORT_STEM = "Items_Export";
export const DESCRIPTION_MAX = 5000;

/* Placeholder thumbnail written by the create modal when no image is attached
 * (CreateItemModal.tsx handleCreate). Imported items get the same one. */
export const ITEM_IMAGE_PLACEHOLDER =
  "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&q=80&w=1000";

/* ─── Option snapshots (asserted against the live constants by test) ─── */
export const OPTION_SNAPSHOTS = {
  /* configAtoms.tsx allUnitNames(), with uomCategory() for each. */
  units: [
    ["Meter", "Length"], ["Kilometer", "Length"], ["Centimeter", "Length"], ["Millimeter", "Length"],
    ["Inch", "Length"], ["Foot", "Length"], ["Yard", "Length"], ["Mile", "Length"],
    ["Liter", "Volume"], ["Milliliter", "Volume"], ["Gallon", "Volume"], ["Quart", "Volume"],
    ["Pint", "Volume"], ["Cubic Meter", "Volume"], ["Cubic Foot", "Volume"], ["Fluid Ounce", "Volume"],
    ["Kilogram", "Mass"], ["Gram", "Mass"], ["Milligram", "Mass"], ["Metric Ton", "Mass"],
    ["Pound", "Mass"], ["Ounce", "Mass"],
    ["Each", "Quantity"], ["Dozen", "Quantity"], ["Hundred", "Quantity"], ["Thousand", "Quantity"], ["Pair", "Quantity"],
    ["Square Meter", "Area"], ["Square Foot", "Area"], ["Square Yard", "Area"], ["Acre", "Area"], ["Hectare", "Area"],
    ["Second", "Time"], ["Minute", "Time"], ["Hour", "Time"], ["Day", "Time"], ["Week", "Time"], ["Month", "Time"],
    ["Celsius", "Temperature"], ["Fahrenheit", "Temperature"], ["Kelvin", "Temperature"],
    ["Box", "Packaging"], ["Case", "Packaging"], ["Carton", "Packaging"], ["Pallet", "Packaging"],
    ["Pack", "Packaging"], ["Bundle", "Packaging"], ["Roll", "Packaging"], ["Bag", "Packaging"],
    ["Drum", "Packaging"], ["Container", "Packaging"], ["Tray", "Packaging"], ["Sleeve", "Packaging"],
    ["Tube", "Packaging"], ["Spool", "Packaging"], ["Ream", "Packaging"], ["Skid", "Packaging"],
    ["Set", "Custom"], ["Kit", "Custom"], ["Assembly", "Custom"], ["Lot", "Custom"], ["Batch", "Custom"],
    ["Sheet", "Custom"], ["Strip", "Custom"], ["Coil", "Custom"], ["Bar", "Custom"], ["Piece", "Custom"], ["Unit", "Custom"],
  ],
  /* CreateItemModal.tsx UOMS (the Selling price-tier unit select). */
  priceUnits: ["Each", "Box", "Case", "Pallet", "kg", "m", "Liter", "Roll", "Pair", "Roll100m", "Meter"],
  /* CreateItemModal.tsx LOCATIONS. */
  locations: [
    "Warehouse A - Main Hall", "Warehouse B - Cold Storage", "Production Line 1 - Assembly", "Returns Dock",
    "Quarantine Zone - Hazardous", "Distribution Center - East Wing", "Overflow Storage - Offsite", "Cold Storage Unit 4",
    "Warehouse C - Electronics", "Warehouse D - Raw Materials", "Production Line 2 - Packaging", "Shipping Dock 1",
    "Shipping Dock 2", "Receiving Dock A", "Receiving Dock B", "Quality Control Lab", "R&D Workshop",
    "Showroom Storage", "Archive Room B1", "Maintenance Shed", "Chemical Storage Locker", "High Security Vault",
    "Automated Storage System", "Rack 45 - Aisle 3", "Bin 102-A", "Pallet Zone C", "Staging Area 1", "Staging Area 2",
    "Receiving Staging", "Shipping Staging",
  ],
  /* purchasing/mockData.ts AVAILABLE_VENDORS names. */
  partners: [
    "General Motors (GM)", "Toyota Technical Center (TTC)", "Ford Motor Company", "Tesla, Inc.",
    "Chrysler (Stellantis N.V.)", "Rivian Automotive", "Lucid Motors", "Honda Motor Co., Ltd. (USA)",
    "Nissan North America", "BMW of North America", "Hyundai Motor America", "Volkswagen Group of America",
  ],
  /* CreateItemModal.tsx MOCK_USERS [name, role]. */
  users: [
    ["Alice Smith", "Engineer"], ["Bob Jones", "Purchasing"], ["Charlie Day", "Scheduler"],
    ["Diana Prince", "Sales"], ["Evan Peters", "Finance"], ["Frank Reynolds", "Manager"], ["Grace Hopper", "QA"],
  ],
  /* MaterialHandlingSection.tsx MOCK_APPROVERS [name, role]. */
  approvers: [
    ["Ahtsham Ahmad", "Senior Inventory Manager"], ["Faizan Khan", "Category Lead"],
    ["Areeb Tanveer", "Warehouse Supervisor"], ["Nophil Anwer", "Inventory Analyst"],
    ["Irtaza Abid", "Supply Chain Coordinator"], ["Eli Rosenbloom", "Distribution Manager"],
    ["Sarah Chen", "Operations Director"], ["James Wilson", "Procurement Manager"],
  ],
  /* CreateItemModal.tsx CATEGORIES: C-1001..C-1050, description cycles
   * through the ten base categories. Stored as [code, description]. */
  categories: (() => {
    const base = [
      "Circuit boards, sensors, and electronic components.",
      "Nuts, bolts, screws, and other fasteners.",
      "Gears, bearings, shafts, and mechanical parts.",
      "AC/DC motors, servos, and steppers.",
      "Cylinders, valves, air hoses, and fittings.",
      "PPE, guards, sensors, and safety equipment.",
      "Steel, aluminum, plastic stock, and raw sheets.",
      "Pumps, hoses, fluids, and hydraulic cylinders.",
      "Hand tools, power tools, and machining bits.",
      "Lubricants, glues, tape, and cleaning supplies.",
    ];
    const out = [];
    for (let i = 0; i < 50; i++) out.push([`C-${1001 + i}`, base[i % base.length]]);
    return out;
  })(),
};

/* Fixed enums (the file vocabulary). The app-side vocabulary each maps to
 * lives in VOCAB below. */
export const ENUMS = {
  status: ["Active", "Inactive"],
  inventoryType: ["Stock", "Non-stock", "Asset"],
  inventoryControlType: ["Serialized", "Non-Serialized"],
  yesno: ["Yes", "No"],
  lotIdSource: ["System Generated", "Vendor Lot"],
  shelfLifeUnit: ["Days", "Months", "Years"],
  acquisitionMethods: ["Purchased", "Manufactured"],
  shortageRule: ["Demand", "Min", "Zero", "Off"],
  sellingScope: ["All", "Specific"],
  valuationMethod: ["FIFO", "LIFO", "WAC", "Specific"],
};

/* File value -> app value. Keys are lower-cased file values. */
export const VOCAB = {
  yes: ["yes", "y", "true", "1"],
  no: ["no", "n", "false", "0"],
  lotIdSource: { "system generated": "system", "vendor lot": "vendor" },
  shelfLifeUnit: { days: "days", months: "months", years: "years" },
  acquisition: { purchased: "Purchase", manufactured: "Manufacturing" },
  shortageRule: { demand: "demand", min: "min", zero: "zero", off: "off" },
  sellingScope: { all: "all", specific: "specific" },
  valuationMethod: { fifo: "fifo", lifo: "lifo", wac: "wac", specific: "specific" },
  inventoryControlType: { serialized: "Serialized", "non-serialized": "Non-Serialized" },
  inventoryType: { stock: "Stock", "non-stock": "Non-stock", asset: "Asset" },
  status: { active: "Active", inactive: "Inactive" },
};

/* ─── The 39 columns, template order ───
 * kind: text | select | multiselect | yesno | number
 * optionsRef: name of an OPTION_SNAPSHOTS list (resolved live in spec.ts)
 * options: fixed enum values
 * text: true => Excel numFmt "@" from row 3 to 600 on that column
 * group: guide / field reference sub-header
 * reference: Field Reference sheet cells (description, format, validValues, example) */
export const COLUMNS = [
  {
    key: "partNumber", label: "Part Number", required: true, kind: "text", width: 18, text: true,
    aliases: ["part no", "part no.", "part #", "sku", "item number", "item no", "item code"],
    group: "Required columns", defaultValue: "",
    description: "Unique identifier for the item and the matching key. Required.",
    example1: "PUMP-CENT-2HP", example2: "GASKET-NBR-50",
    reference: {
      description: "The item's unique part number and the matching key. A new part number creates an item; a matching part number updates that item. Never changed by an import.",
      format: "Text", validValues: "", example: "PUMP-CENT-2HP",
    },
  },
  {
    key: "description", label: "Description", required: false, kind: "text", width: 40,
    aliases: ["item description", "name"], group: "Identity", defaultValue: "",
    description: "Detailed description of the item, up to 5000 characters.",
    example1: "Centrifugal water pump, 2 HP, cast iron housing", example2: "NBR rubber gasket, 50 mm, 3 mm thick",
    reference: {
      description: "What the item is. Shown in the listing and on the item page. Up to 5000 characters.",
      format: "Free text", validValues: "", example: "Centrifugal water pump, 2 HP, cast iron housing",
    },
  },
  {
    key: "status", label: "Status", required: false, kind: "select", options: ENUMS.status, width: 12,
    aliases: ["item status", "lifecycle"], group: "Identity", defaultValue: "Active",
    description: "Lifecycle state: Active or Inactive. Optional; blank imports a new item as Active and leaves an existing item unchanged.",
    example1: "Active", example2: "Active",
    reference: {
      description: "Whether the item is in use. New item: blank means Active. Existing item: blank keeps the current status. Archived is set from the listing, not from the file.",
      format: "Set value", validValues: "Active, Inactive, or blank", example: "Active",
    },
  },
  {
    key: "tags", label: "Tags", required: false, kind: "multiselect", width: 24, text: true,
    aliases: ["tag", "labels", "keywords"], group: "Identity", defaultValue: "",
    description: "Comma-separated free-text tags. Duplicates are removed.",
    example1: "Pumps, Fluid Handling", example2: "",
    reference: {
      description: "Short labels shown as chips on the item. One value, or several separated with a comma. Duplicates are removed.",
      format: "Text, comma-separated", validValues: "", example: "Pumps, Fluid Handling",
    },
  },
  {
    key: "primaryCategory", label: "Primary Category", required: true, kind: "select", optionsRef: "categories", width: 18,
    aliases: ["category", "primary category code", "category code", "main category"],
    group: "Required columns", defaultValue: "",
    description: "Category code that drives the item's defaults, such as C-1001. Required for new items.",
    example1: "C-1004", example2: "C-1002",
    reference: {
      description: "The category that drives the item's defaults. Must match a category that exists in Omne. New item: required. Existing item: blank keeps the current category.",
      format: "Category code", validValues: "Existing category codes, see Valid Values", example: "C-1004",
    },
  },
  {
    key: "additionalCategories", label: "Additional Categories", required: false, kind: "multiselect", optionsRef: "categories", width: 26,
    aliases: ["other categories", "secondary categories", "categories"], group: "Categories", defaultValue: "",
    description: "Comma-separated category codes other than the primary. A code that does not exist is an error.",
    example1: "C-1008, C-1003", example2: "",
    reference: {
      description: "Other categories the item belongs to. Each code must exist in Omne and must not be the primary category. Separate several with a comma.",
      format: "Text, comma-separated", validValues: "Existing category codes", example: "C-1008, C-1003",
    },
  },
  {
    key: "inventoryType", label: "Inventory Type", required: false, kind: "select", options: ENUMS.inventoryType, width: 16,
    aliases: ["item type", "stock type"], group: "Item Definition", defaultValue: "Stock",
    description: "How the item is tracked: Stock, Non-stock, or Asset. Blank means Stock.",
    example1: "Stock", example2: "Stock",
    reference: {
      description: "Determines how this item is tracked in your inventory system. Blank means Stock.",
      format: "Set value", validValues: "Stock, Non-stock, Asset, or blank", example: "Stock",
    },
  },
  {
    key: "inventoryControlType", label: "Inventory Control", required: false, kind: "select", options: ENUMS.inventoryControlType, width: 18,
    aliases: ["control type", "inventory control type", "serialization"], group: "Item Definition", defaultValue: "Non-Serialized",
    description: "Serialized (unique ID per unit) or Non-Serialized (tracked in bulk). Blank means Non-Serialized.",
    example1: "Serialized", example2: "Non-Serialized",
    reference: {
      description: "Defines how individual units are identified and traced. Serialized gives every unit its own ID; Non-Serialized tracks by quantity. Blank means Non-Serialized.",
      format: "Set value", validValues: "Serialized, Non-Serialized, or blank", example: "Serialized",
    },
  },
  {
    key: "lotControl", label: "Lot Tracking", required: false, kind: "yesno", options: ENUMS.yesno, width: 14,
    aliases: ["lot control", "lot tracked", "batch tracking"], group: "Item Definition", defaultValue: "No",
    description: "Yes enables batch-level traceability. Blank means No.",
    example1: "Yes", example2: "No",
    reference: {
      description: "Enable batch-level traceability. Yes or No. Blank means No.",
      format: "Yes / No", validValues: "Yes, No, or blank", example: "Yes",
    },
  },
  {
    key: "lotIdSource", label: "Lot ID Assignment", required: false, kind: "select", options: ENUMS.lotIdSource, width: 20,
    aliases: ["lot id source", "lot id"], group: "Item Definition", defaultValue: "System Generated", conditionalOn: "lotControl",
    description: "Only when Lot Tracking is Yes: System Generated or Vendor Lot. Blank means System Generated.",
    example1: "Vendor Lot", example2: "",
    reference: {
      description: "Only applies when Lot Tracking is Yes. System Generated auto-generates lot IDs; Vendor Lot uses the vendor lot number as the lot ID. Blank means System Generated.",
      format: "Set value", validValues: "System Generated, Vendor Lot, or blank", example: "Vendor Lot",
    },
  },
  {
    key: "shelfLifeValue", label: "Shelf Life", required: false, kind: "number", width: 12,
    aliases: ["shelf life value", "expiry"], group: "Item Definition", defaultValue: "",
    description: "Shelf life as a whole number, 0 or more. Pair it with Shelf Life Unit.",
    example1: "24", example2: "",
    reference: {
      description: "How long the item stays usable, as a number. Pair it with Shelf Life Unit. Leave blank when the item has no shelf life.",
      format: "Number, 0 or more", validValues: "", example: "24",
    },
  },
  {
    key: "shelfLifeUnit", label: "Shelf Life Unit", required: false, kind: "select", options: ENUMS.shelfLifeUnit, width: 16,
    aliases: ["shelf life units"], group: "Item Definition", defaultValue: "Days", conditionalOn: "shelfLifeValue",
    description: "Days, Months, or Years for the Shelf Life value. Blank means Days.",
    example1: "Months", example2: "",
    reference: {
      description: "The unit for Shelf Life. Only applies when Shelf Life has a value. Blank means Days.",
      format: "Set value", validValues: "Days, Months, Years, or blank", example: "Months",
    },
  },
  {
    key: "unit", label: "Base Unit of Measure", required: false, kind: "select", optionsRef: "units", width: 22,
    aliases: ["base uom", "uom", "unit of measure", "stocking unit", "base unit", "unit"], group: "Item Definition", defaultValue: "Each",
    description: "The primary unit used for counting and valuing this item, such as Each or Kilogram. Blank means Each.",
    example1: "Each", example2: "Each",
    reference: {
      description: "The primary unit used for counting and valuing this item. Must match a unit name in Omne, see Valid Values. Blank means Each.",
      format: "Set value", validValues: "Unit names, see Valid Values", example: "Each",
    },
  },
  {
    key: "alternativeUnits", label: "Alternative Units", required: false, kind: "text", width: 26, text: true,
    aliases: ["alternate units", "alt units", "alternative uom"], group: "Item Definition", defaultValue: "",
    description: "Unit=factor pairs separated with a comma, such as Box=4, Pallet=48. Each unit must come from a different category than the base unit.",
    example1: "Box=4, Pallet=48", example2: "Pack=25",
    reference: {
      description: "Other units the item is bought or sold in, each written as Unit=factor where factor is how many base units make one of that unit. Alternatives must come from a different unit category than the base unit. Separate several with a comma.",
      format: "Unit=factor, comma-separated", validValues: "Unit names, factor greater than 0", example: "Box=4, Pallet=48",
    },
  },
  {
    key: "acquisitionMethods", label: "Acquisition Method", required: false, kind: "multiselect", options: ENUMS.acquisitionMethods, width: 24,
    aliases: ["acquisition", "acquisition methods", "sourcing"], group: "Item Definition", defaultValue: "Purchased",
    description: "Purchased, Manufactured, or both separated with a comma. Blank means Purchased.",
    example1: "Purchased, Manufactured", example2: "Purchased",
    reference: {
      description: "How the item is brought into stock. Purchased triggers Purchase Order recommendations; Manufactured triggers Work Order recommendations. One value, or both separated with a comma. Blank means Purchased.",
      format: "Set value, comma-separated", validValues: "Purchased, Manufactured, or blank", example: "Purchased, Manufactured",
    },
  },
  {
    key: "primaryAcquisition", label: "Primary Acquisition", required: false, kind: "select", options: ENUMS.acquisitionMethods, width: 20,
    aliases: ["preferred acquisition", "primary acquisition method"], group: "Item Definition", defaultValue: "", conditionalOn: "acquisitionMethods",
    description: "Which acquisition method is preferred when both are listed. Blank means the sole method.",
    example1: "Purchased", example2: "",
    reference: {
      description: "Only matters when both acquisition methods are listed. Must be one of the values in Acquisition Method. Blank means the sole method, or Purchased when both are listed.",
      format: "Set value", validValues: "Purchased, Manufactured, or blank", example: "Purchased",
    },
  },
  {
    key: "minStock", label: "Min Level", required: false, kind: "number", width: 12,
    aliases: ["min stock", "minimum level", "min level", "reorder point"], group: "Stock & Logistics", defaultValue: "10",
    description: "Minimum stock level, 0 or more, in the base unit. Must be less than Max Level. Blank means 10.",
    example1: "5", example2: "100",
    reference: {
      description: "The stock level that triggers replenishment, in the base unit. Must be less than Max Level. Blank means 10.",
      format: "Number, 0 or more", validValues: "", example: "5",
    },
  },
  {
    key: "maxStock", label: "Max Level", required: false, kind: "number", width: 12,
    aliases: ["max stock", "maximum level", "max level"], group: "Stock & Logistics", defaultValue: "1000",
    description: "Maximum stock level, 0 or more, in the base unit. Blank means 1000.",
    example1: "200", example2: "5000",
    reference: {
      description: "The stock level replenishment fills up to, in the base unit. Blank means 1000.",
      format: "Number, 0 or more", validValues: "", example: "200",
    },
  },
  {
    key: "inboundLocations", label: "Inbound Locations", required: false, kind: "multiselect", optionsRef: "locations", width: 30,
    aliases: ["inbound location", "receiving locations"], group: "Stock & Logistics", defaultValue: "Warehouse A - Main Hall",
    description: "Comma-separated locations where the item is received. The first one is the default. Blank means Warehouse A - Main Hall.",
    example1: "Warehouse A - Main Hall, Receiving Dock A", example2: "Warehouse B - Cold Storage",
    reference: {
      description: "Where the item is received. Each name must match a location in Omne. The first one listed becomes the default. Separate several with a comma. Blank means Warehouse A - Main Hall.",
      format: "Text, comma-separated", validValues: "Location names, see Valid Values", example: "Warehouse A - Main Hall, Receiving Dock A",
    },
  },
  {
    key: "outboundLocations", label: "Outbound Locations", required: false, kind: "multiselect", optionsRef: "locations", width: 30,
    aliases: ["outbound location", "shipping locations", "dispatch locations"], group: "Stock & Logistics", defaultValue: "Warehouse A - Main Hall",
    description: "Comma-separated locations the item ships from. The first one is the default. Blank means Warehouse A - Main Hall.",
    example1: "Warehouse A - Main Hall", example2: "Warehouse B - Cold Storage",
    reference: {
      description: "Where the item ships from. Each name must match a location in Omne. The first one listed becomes the default. Separate several with a comma. Blank means Warehouse A - Main Hall.",
      format: "Text, comma-separated", validValues: "Location names, see Valid Values", example: "Warehouse A - Main Hall",
    },
  },
  {
    key: "receivingStagingLocation", label: "Receiving Staging Locations", required: false, kind: "multiselect", optionsRef: "locations", width: 30,
    aliases: ["receiving staging", "receiving staging location"], group: "Stock & Logistics", defaultValue: "",
    description: "Comma-separated staging locations used when receiving. Optional.",
    example1: "Receiving Staging", example2: "",
    reference: {
      description: "Staging areas used while receiving the item. Each name must match a location in Omne. Separate several with a comma.",
      format: "Text, comma-separated", validValues: "Location names, see Valid Values", example: "Receiving Staging",
    },
  },
  {
    key: "shippingStagingLocation", label: "Shipping Staging Locations", required: false, kind: "multiselect", optionsRef: "locations", width: 30,
    aliases: ["shipping staging", "shipping staging location"], group: "Stock & Logistics", defaultValue: "",
    description: "Comma-separated staging locations used when shipping. Optional.",
    example1: "Shipping Staging", example2: "",
    reference: {
      description: "Staging areas used while shipping the item. Each name must match a location in Omne. Separate several with a comma.",
      format: "Text, comma-separated", validValues: "Location names, see Valid Values", example: "Shipping Staging",
    },
  },
  {
    key: "minPurchase", label: "Min Order Qty", required: false, kind: "number", width: 14,
    aliases: ["min order quantity", "minimum order qty", "min purchase", "moq"], group: "Procurement", defaultValue: "50",
    description: "Smallest quantity ordered at once, 0 or more. Blank means 50.",
    example1: "10", example2: "250",
    reference: {
      description: "The smallest quantity a purchase order may carry, in the base unit. Blank means 50.",
      format: "Number, 0 or more", validValues: "", example: "10",
    },
  },
  {
    key: "maxPurchase", label: "Max Order Qty", required: false, kind: "number", width: 14,
    aliases: ["max order quantity", "maximum order qty", "max purchase"], group: "Procurement", defaultValue: "5000",
    description: "Largest quantity ordered at once. Must be at least the Min Order Qty. Blank means 5000.",
    example1: "500", example2: "10000",
    reference: {
      description: "The largest quantity a purchase order may carry, in the base unit. Must be at least the Min Order Qty. Blank means 5000.",
      format: "Number, at least Min Order Qty", validValues: "", example: "500",
    },
  },
  {
    key: "multiples", label: "Order Multiples", required: false, kind: "number", width: 16,
    aliases: ["order multiple", "multiples", "case pack"], group: "Procurement", defaultValue: "10",
    description: "Orders are rounded to this quantity, such as a case pack. Must be greater than 0. Blank means 10.",
    example1: "5", example2: "25",
    reference: {
      description: "Purchase quantities are rounded up to a multiple of this number, such as a case pack or pallet quantity. Must be greater than 0. Blank means 10.",
      format: "Number, greater than 0", validValues: "", example: "5",
    },
  },
  {
    key: "shortageRule", label: "PO Recommendation Rule", required: false, kind: "select", options: ENUMS.shortageRule, width: 24,
    aliases: ["po rule", "shortage rule", "recommendation rule", "po recommendation"], group: "Procurement", defaultValue: "Demand",
    description: "When to recommend a purchase order: Demand, Min, Zero, or Off. Blank means Demand.",
    example1: "Demand", example2: "Min",
    reference: {
      description: "When Omne recommends a purchase order. Demand: based on demand. Min: when stock hits the min level. Zero: when stock falls below zero. Off: never. Blank means Demand.",
      format: "Set value", validValues: "Demand, Min, Zero, Off, or blank", example: "Demand",
    },
  },
  {
    key: "sellingScope", label: "Selling Scope", required: false, kind: "select", options: ENUMS.sellingScope, width: 14,
    aliases: ["selling", "sell to"], group: "Selling", defaultValue: "All",
    description: "All sells to every partner; Specific limits selling to the partners listed. Blank means All.",
    example1: "Specific", example2: "All",
    reference: {
      description: "Who the item may be sold to. All: every customer partner. Specific: only the partners in Specific Partners. Blank means All.",
      format: "Set value", validValues: "All, Specific, or blank", example: "Specific",
    },
  },
  {
    key: "specificPartners", label: "Specific Partners", required: false, kind: "multiselect", optionsRef: "partners", width: 30,
    aliases: ["partners", "customers", "specific customers"], group: "Selling", defaultValue: "", conditionalOn: "sellingScope",
    description: "Only when Selling Scope is Specific: comma-separated partner names. A name that does not exist is an error.",
    example1: "Ford Motor Company, Tesla, Inc.", example2: "",
    reference: {
      description: "Only applies when Selling Scope is Specific. Partner names the item may be sold to, each matching a partner in Omne. Separate several with a comma.",
      format: "Text, comma-separated", validValues: "Partner names, see Valid Values", example: "Ford Motor Company, Tesla, Inc.",
    },
  },
  {
    key: "pricing", label: "Custom Price Per Unit", required: false, kind: "text", width: 26, text: true,
    aliases: ["price", "custom price", "unit price", "price per unit"], group: "Selling", defaultValue: "0.00 Each",
    description: "Price and unit pairs such as 1250.00 Each, separated with a comma for several tiers. Blank means 0.00 Each.",
    example1: "1250.00 Each, 4800.00 Box", example2: "0.45 Each",
    reference: {
      description: "Selling price per unit, written as the price, a space, then the unit, for example 12.50 Each. Separate several tiers with a comma. Blank means 0.00 Each.",
      format: "price unit, comma-separated", validValues: "Price units: Each, Box, Case, Pallet, kg, m, Liter, Roll, Pair, Roll100m, Meter", example: "1250.00 Each, 4800.00 Box",
    },
  },
  {
    key: "valuationMethod", label: "Inventory Valuation", required: false, kind: "select", options: ENUMS.valuationMethod, width: 20,
    aliases: ["valuation", "valuation method", "costing method"], group: "Governance", defaultValue: "FIFO",
    description: "Costing method: FIFO, LIFO, WAC, or Specific. Blank means FIFO.",
    example1: "FIFO", example2: "WAC",
    reference: {
      description: "How inventory is valued. FIFO: first in, first out. LIFO: last in, first out. WAC: weighted average cost. Specific: specific identification. Blank means FIFO.",
      format: "Set value", validValues: "FIFO, LIFO, WAC, Specific, or blank", example: "FIFO",
    },
  },
  {
    key: "owners.materialHandling", label: "Material Handling Owners", required: false, kind: "multiselect", optionsRef: "users", width: 30,
    aliases: ["material handling owner", "material handling", "mh owners"], group: "Governance", defaultValue: "",
    description: "Comma-separated names of users who own receiving, shipping, and movement for this item.",
    example1: "Alice Smith, Charlie Day", example2: "",
    reference: {
      description: "Users responsible for receiving, shipping, and movement of the item. Each name must match a user in Omne. Separate several with a comma.",
      format: "Text, comma-separated", validValues: "User names, see Valid Values", example: "Alice Smith, Charlie Day",
    },
  },
  {
    key: "owners.purchasing", label: "Purchasing Owner", required: false, kind: "select", optionsRef: "users", width: 18,
    aliases: ["purchasing owner", "buyer"], group: "Governance", defaultValue: "",
    description: "Name of the user who owns purchasing for this item.",
    example1: "Bob Jones", example2: "Bob Jones",
    reference: {
      description: "The single user responsible for purchasing this item. Must match a user in Omne.",
      format: "Text", validValues: "User names, see Valid Values", example: "Bob Jones",
    },
  },
  {
    key: "owners.finance", label: "Finance Owner", required: false, kind: "select", optionsRef: "users", width: 16,
    aliases: ["finance owner", "accountant"], group: "Governance", defaultValue: "",
    description: "Name of the user who owns finance for this item.",
    example1: "Frank Reynolds", example2: "",
    reference: {
      description: "The single user responsible for the item's finance and valuation. Must match a user in Omne.",
      format: "Text", validValues: "User names, see Valid Values", example: "Frank Reynolds",
    },
  },
  {
    key: "cycleTolerance", label: "Acceptable Variance (%)", required: false, kind: "number", width: 22,
    aliases: ["acceptable variance", "variance", "cycle tolerance", "variance %"], group: "Material Handling", defaultValue: "0",
    description: "Cycle count variance accepted without approval, 0 to 100. Blank means 0.",
    example1: "2", example2: "5",
    reference: {
      description: "The percentage difference a cycle count may show before it needs approval. Between 0 and 100. Blank means 0.",
      format: "Number, 0 to 100", validValues: "", example: "2",
    },
  },
  {
    key: "approvers", label: "Approvers", required: false, kind: "multiselect", optionsRef: "approvers", width: 26,
    aliases: ["approver", "cycle count approvers"], group: "Material Handling", defaultValue: "",
    description: "Comma-separated names of approvers for cycle count variances.",
    example1: "Faizan Khan, Sarah Chen", example2: "",
    reference: {
      description: "Who approves cycle count variances above the acceptable percentage. Each name must match an approver in Omne. Separate several with a comma.",
      format: "Text, comma-separated", validValues: "Approver names, see Valid Values", example: "Faizan Khan, Sarah Chen",
    },
  },
  {
    key: "scanLocation", label: "Location Scan", required: false, kind: "yesno", options: ENUMS.yesno, width: 14,
    aliases: ["scan location", "location scan required"], group: "Material Handling", defaultValue: "No",
    description: "Yes requires a location scan during handling. Blank means No.",
    example1: "Yes", example2: "Yes",
    reference: {
      description: "Require the location to be scanned when the item is handled. Yes or No. Blank means No.",
      format: "Yes / No", validValues: "Yes, No, or blank", example: "Yes",
    },
  },
  {
    key: "scanItem", label: "Item Scan", required: false, kind: "yesno", options: ENUMS.yesno, width: 14,
    aliases: ["scan item", "part number scan", "item / part number scan"], group: "Material Handling", defaultValue: "No",
    description: "Yes requires the part number to be scanned during handling. Blank means No.",
    example1: "Yes", example2: "Yes",
    reference: {
      description: "Require the item's part number to be scanned when it is handled. Yes or No. Blank means No.",
      format: "Yes / No", validValues: "Yes, No, or blank", example: "Yes",
    },
  },
  {
    key: "scanLot", label: "Lot Scan", required: false, kind: "yesno", options: ENUMS.yesno, width: 14,
    aliases: ["scan lot", "lot control scan"], group: "Material Handling", defaultValue: "No",
    description: "Yes requires the lot to be scanned. Only meaningful with Lot Tracking. Blank means No.",
    example1: "Yes", example2: "No",
    reference: {
      description: "Require the lot to be scanned when the item is handled. Only meaningful when Lot Tracking is Yes. Yes or No. Blank means No.",
      format: "Yes / No", validValues: "Yes, No, or blank", example: "Yes",
    },
  },
  {
    key: "scanSerial", label: "Serial Scan", required: false, kind: "yesno", options: ENUMS.yesno, width: 14,
    aliases: ["scan serial", "serial number scan"], group: "Material Handling", defaultValue: "No", conditionalOn: "inventoryControlType",
    description: "Yes requires the serial number to be scanned. Only applies to Serialized items. Blank means No.",
    example1: "Yes", example2: "No",
    reference: {
      description: "Require the serial number to be scanned when the item is handled. Only applies when Inventory Control is Serialized. Yes or No. Blank means No.",
      format: "Yes / No", validValues: "Yes, No, or blank", example: "Yes",
    },
  },
];

export const COLUMN_KEYS = COLUMNS.map((c) => c.key);
export const REQUIRED_COUNT = COLUMNS.filter((c) => c.required).length;
export const OPTIONAL_COUNT = COLUMNS.length - REQUIRED_COUNT;

/* Header row exactly as it ships in the CSV and in Data Entry row 2. */
export const TEMPLATE_HEADERS = COLUMNS.map((c) => (c.required ? `${c.label} *` : c.label));

/* Normalised header names whose presence identifies the header row. */
export const HEADER_DETECT_NORMS = ["part number"];

/* The two example rows (Data Entry rows 3-4, CSV rows 2-3). */
export const EXAMPLE_ROWS = [COLUMNS.map((c) => c.example1), COLUMNS.map((c) => c.example2)];

/* ─── Export fields: the 14 listing columns first (Part Number locked), then
 * the remaining import fields. `source` says where the value comes from. ─── */
export const EXPORT_FIELDS = [
  { id: "part_number", label: "Part Number", locked: true, listing: true, field: "partNumber" },
  { id: "description", label: "Description", listing: true, field: "description" },
  { id: "status", label: "Status", listing: true, field: "status" },
  { id: "inventory_control_type", label: "Inventory Control", listing: true, field: "inventoryControlType" },
  { id: "primary_category", label: "Primary Category", listing: true, field: "primaryCategory" },
  { id: "additional_categories", label: "Additional Categories", listing: true, field: "additionalCategories" },
  { id: "tags", label: "Tags", listing: true, field: "tags" },
  { id: "on_hand_qty", label: "On-Hand Qty", listing: true, system: true },
  { id: "unit", label: "Stocking Unit", listing: true, field: "unit" },
  { id: "acquisition", label: "Acquisition", listing: true, field: "acquisitionMethods" },
  { id: "preferred_acquisition", label: "Preferred Acquisition", listing: true, field: "primaryAcquisition" },
  { id: "created_on", label: "Created On", listing: true, system: true, date: true },
  { id: "created_by", label: "Created By", listing: true, system: true },
  { id: "owner_id", label: "Owner", listing: true, system: true },
  ...COLUMNS.filter((c) => ![
    "partNumber", "description", "status", "inventoryControlType", "primaryCategory", "additionalCategories",
    "tags", "unit", "acquisitionMethods", "primaryAcquisition",
  ].includes(c.key)).map((c) => ({ id: c.key, label: c.label, field: c.key })),
];

/* ─── Template copy ─── */
export const TEMPLATE = {
  title: `OMNE  ${MDOT}  Items Import Template`,
  bannerFieldReference: `OMNE  ${MDOT}  Items Import, Field Reference`,
  sheetTitle: "Items Import Template",
  moduleLine: NOUNS.moduleLine,
  countLine: `${COLUMNS.length} columns  ${MDOT}  ${REQUIRED_COUNT} required, ${OPTIONAL_COUNT} optional`,
  frSubtitle: "Every column explained. Red rows are required and cannot be left blank.",
  vvTitle: "Valid Values & Reference",
  vvSubtitle: "Use these exact values in the Data Entry sheet.",
  instructions: {
    quickStart: [
      "Go to the Data Entry sheet. That is where you enter your items, one item per row.",
      "Review the two example rows. They show the expected format for each column. Delete them before you import.",
      "Enter your items. The two required columns have red headers and cannot be left blank: Part Number, Primary Category.",
      "Every other column is optional. What a blank value means depends on whether the item is new or already exists. See How Items Are Matched below.",
      "For columns that can hold a list, such as Tags, Additional Categories, and Inbound Locations, separate each value with a comma. Example: Warehouse A - Main Hall, Receiving Dock A.",
      "Save the file, then upload it in Omne under Items & Inventory, Items Library, Actions, Import.",
    ],
    sections: [
      {
        heading: "HOW ITEMS ARE MATCHED",
        intro: "Omne matches each row by part number, then decides whether to create a new item or update an existing one. What happens next depends on whether the part number is already in Omne.",
        items: [
          ["New item", "The part number is not in Omne yet, so a new item is created. Primary Category is required. Status: blank means Active. Every other blank column takes the default shown on the Field Reference sheet, the same defaults the Create New Item screen applies."],
          ["Existing item", "The part number already belongs to an item, so that item is updated. Any blank cell leaves the existing value unchanged. Primary Category: blank keeps the current category. Status: blank keeps the current status; enter Active or Inactive to change it."],
          ["Part Number", "The part number is the matching key and is never changed by an import. A different part number is treated as a different item. Matching ignores case and surrounding spaces."],
        ],
      },
      {
        heading: "COPYING FROM ANOTHER SYSTEM",
        intro: "This template is plain text, so you can copy and paste from an export of your old system. Line your old columns up with these columns, fill in any that your old system did not have, and paste. Category codes, unit names, locations, partners, and users must match the values already in Omne; the Valid Values sheet lists them.",
      },
      {
        heading: "WHAT THE FILE DOES NOT COVER",
        intro: "On-hand quantity, images, attachments, and qualified vendors are not imported. New items start with an on-hand quantity of 0 and a placeholder image. Add images and qualified vendors on the item page after the import.",
      },
      {
        heading: "IMPORTANT NOTES",
        items: [
          ["Primary Category", "Must be a category code that exists in Omne, such as C-1004. The category drives the item's defaults. A code that does not exist blocks the row until it is fixed."],
          ["Additional Categories", "Optional extra categories, comma-separated. A code that does not exist, or the primary category repeated here, is an error."],
          ["Units", "Base Unit of Measure must match a unit name in Omne, such as Each, Box, or Kilogram. Alternative Units are written as Unit=factor, for example Box=12 means one Box holds 12 base units, and must come from a different unit category than the base unit."],
          ["Yes / No columns", "Lot Tracking, Location Scan, Item Scan, Lot Scan, and Serial Scan take Yes or No. Blank means No. Serial Scan only applies to Serialized items."],
          ["Numbers", "Shelf Life, Min Level, Max Level, Min Order Qty, Max Order Qty, Order Multiples, and Acceptable Variance are plain numbers with no units or symbols. Min Level must be less than Max Level, Max Order Qty must be at least Min Order Qty, and Order Multiples must be greater than 0."],
          ["Locations, partners, users, approvers", "Each name must match one that already exists in Omne. Matching is not case sensitive. A name that does not exist is an error and blocks the row until it is fixed."],
          ["Custom Price Per Unit", "Written as the price, a space, then the unit, for example 12.50 Each. Several tiers are separated with a comma."],
          ["File Limits", "Upload an Excel or CSV file up to 10 MB. Omne reads a single sheet. Keep only the data sheet before you upload."],
          ["Empty Cells", "Safe to leave blank in optional columns. Omne skips an empty cell and never overwrites an existing value with a blank."],
        ],
      },
    ],
  },
  compareTable: {
    heading: "New item vs existing item",
    colHeaders: ["For a new item (part number not in Omne)", "For an existing item (part number already in Omne)"],
    rows: [
      ["The row", "Creates a new item, Active, with an on-hand quantity of 0.", "Updates the existing item. On-hand quantity is never changed by the import."],
      ["Blank cell", "Takes the default shown on this sheet, the same default the Create New Item screen applies.", "A blank cell leaves the existing value unchanged."],
      ["Primary Category", "Required. Must be a category code that exists in Omne.", "Blank keeps the current category. Enter a code only to change it."],
      ["Status", "Blank means Active. Enter Inactive to import the item as inactive.", "Blank keeps the current status. Enter Active or Inactive to change it."],
      ["Created By, Owner", "Set to the user running the import.", "Kept as they are."],
    ],
    mergedLast: ["Archived", "If the part number belongs to an archived item, the row updates that item but leaves it archived. Restore it from the Archived filter on the listing."],
  },
  validValues: [
    {
      heading: "New and existing items", subHeader: ["Case", "What the import does"],
      rows: [
        ["New part number", "Creates a new item. Primary Category is required; blank Status means Active; every other blank takes its default."],
        ["Existing part number", "Updates the item. Blank cells keep existing values. On-hand quantity, images, and qualified vendors are never touched."],
      ],
    },
    {
      heading: "Status", subHeader: ["Value", "What it means"],
      rows: [
        ["Active", "The item is in use, available for sale, or included in ongoing projects."],
        ["Inactive", "The item is no longer in use, discontinued, or temporarily out of circulation."],
        ["(blank)", "New item: Active. Existing item: keeps the current status."],
      ],
      note: "Archived is set from the listing through the item's lifecycle, not from this file.",
    },
    {
      heading: "Inventory Type", subHeader: ["Value", "What it means"],
      rows: [
        ["Stock", "Tracked in inventory with quantities and locations."],
        ["Non-stock", "Not tracked in inventory; bought and consumed as needed."],
        ["Asset", "A fixed asset tracked for ownership rather than stock."],
        ["(blank)", "Stock."],
      ],
    },
    {
      heading: "Inventory Control", subHeader: ["Value", "What it means"],
      rows: [
        ["Serialized", "Every unit carries its own serial number."],
        ["Non-Serialized", "Units are tracked in bulk by quantity."],
        ["(blank)", "Non-Serialized."],
      ],
    },
    {
      heading: "Yes / No columns", subHeader: ["Value", "What it means"],
      rows: [
        ["Yes", "Turns the setting on."],
        ["No", "Leaves the setting off."],
        ["(blank)", "Same as No for a new item; keeps the current setting for an existing item."],
      ],
      note: "Applies to Lot Tracking, Location Scan, Item Scan, Lot Scan, and Serial Scan. Lot ID Assignment and Lot Scan only apply when Lot Tracking is Yes. Serial Scan only applies when Inventory Control is Serialized.",
    },
    {
      heading: "Lot ID Assignment", subHeader: ["Value", "What it means"],
      rows: [
        ["System Generated", "Omne auto-generates lot IDs from a prefix."],
        ["Vendor Lot", "The vendor's lot number becomes the lot ID."],
        ["(blank)", "System Generated."],
      ],
    },
    {
      heading: "Shelf Life Unit", subHeader: ["Value", "What it means"],
      rows: [["Days", "Shelf Life is counted in days."], ["Months", "Shelf Life is counted in months."], ["Years", "Shelf Life is counted in years."], ["(blank)", "Days."]],
    },
    {
      heading: "Acquisition Method and Primary Acquisition", subHeader: ["Value", "What it means"],
      rows: [
        ["Purchased", "Sourced from a vendor. Triggers a Purchase Order recommendation."],
        ["Manufactured", "Produced in-house. Triggers a Work Order recommendation."],
        ["(blank)", "Purchased. When both methods are listed and Primary Acquisition is blank, Purchased is the primary."],
      ],
    },
    {
      heading: "PO Recommendation Rule", subHeader: ["Value", "What it means"],
      rows: [
        ["Demand", "Recommend based on demand."],
        ["Min", "Recommend when stock hits the min level."],
        ["Zero", "Recommend if stock falls below zero."],
        ["Off", "Disable purchase order recommendations."],
        ["(blank)", "Demand."],
      ],
    },
    {
      heading: "Selling Scope", subHeader: ["Value", "What it means"],
      rows: [
        ["All", "Sell to all customer partners."],
        ["Specific", "Sell only to the partners listed in Specific Partners."],
        ["(blank)", "All."],
      ],
    },
    {
      heading: "Inventory Valuation", subHeader: ["Value", "What it means"],
      rows: [
        ["FIFO", "First in, first out. Oldest inventory is sold first."],
        ["LIFO", "Last in, first out."],
        ["WAC", "Weighted average cost."],
        ["Specific", "Specific identification."],
        ["(blank)", "FIFO."],
      ],
    },
    {
      heading: "Base Unit of Measure", subHeader: ["Category", "Unit names"],
      rowsRef: "unitsByCategory",
      note: "Alternative Units must come from a different category than the base unit, written as Unit=factor. Example: base unit Each with Box=12, Pallet=480.",
    },
    {
      heading: "Custom Price Per Unit", subHeader: ["Value", "What it means"],
      rows: [
        ["12.50 Each", "One price tier: the price, a space, then the unit."],
        ["12.50 Each, 140.00 Box", "Two tiers separated with a comma."],
        ["(blank)", "0.00 Each."],
      ],
      note: "Price units: Each, Box, Case, Pallet, kg, m, Liter, Roll, Pair, Roll100m, Meter.",
    },
    {
      heading: "Categories (Primary Category, Additional Categories)", subHeader: ["Code", "Category"],
      rowsRef: "categories",
    },
    {
      heading: "Locations (Inbound, Outbound, Receiving Staging, Shipping Staging)",
      noteRef: "locations",
    },
    {
      heading: "Partners (Specific Partners)",
      noteRef: "partners",
    },
    {
      heading: "Users (Material Handling Owners, Purchasing Owner, Finance Owner)", subHeader: ["Name", "Role"],
      rowsRef: "users",
    },
    {
      heading: "Approvers", subHeader: ["Name", "Role"],
      rowsRef: "approvers",
    },
    {
      heading: "Lists and comma-separated columns",
      note: "Tags, Additional Categories, the four location columns, Specific Partners, Material Handling Owners, Approvers, Alternative Units, and Custom Price Per Unit can hold more than one value. Separate each value with a comma. Example: Warehouse A - Main Hall, Receiving Dock A. Names must match values that already exist in Omne, and matching is not case sensitive.",
    },
  ],
  guide: {
    banner: "OMNE ITEMS IMPORT GUIDE",
    intro: [
      "This guide explains how to fill in the Items import CSV. It covers the steps, every column, and what the import does for a new item and an existing item.",
      `The CSV has ${REQUIRED_COUNT} required columns and ${OPTIONAL_COUNT} optional ones.`,
    ],
    quickStart: [
      "Open the CSV. The first row is the column headers. Each row below it is one item.",
      "Two example rows are included to show the expected format. Delete both before you import.",
      "Fill in your items. The two required columns are marked with an asterisk and cannot be left blank: Part Number, Primary Category.",
      "Every other column is optional. What a blank value means depends on whether the item is new or already exists. See How Items Are Matched below.",
      "For columns that can hold a list, such as Tags, Additional Categories, and Inbound Locations, separate each value with a comma and wrap the cell in double quotes. Example: \"Warehouse A - Main Hall, Receiving Dock A\"",
      "Save the file, then upload it in Omne under Items & Inventory, Items Library, Actions, Import.",
    ],
    matched: {
      intro: "Omne matches each row by part number, then decides whether to create a new item or update an existing one. The part number itself is the matching key and is never changed by an import. A few columns behave differently depending on the case, so each case is spelled out below.",
      newHeading: "For a new item (part number not in Omne)",
      newIntro: "A new item is created, Active, with an on-hand quantity of 0.",
      newItems: [
        ["Primary Category", "Required. Must be a category code that exists in Omne."],
        ["Status", "Blank means Active. Enter Inactive to import the item as inactive."],
        ["Other columns", "Blank takes the default shown in the Field Reference, the same default the Create New Item screen applies."],
      ],
      existingHeading: "For an existing item (part number already in Omne)",
      existingIntro: "The matching item is updated with the values you provide. A blank cell leaves the existing value unchanged.",
      existingItems: [
        ["Primary Category", "Blank keeps the current category. Enter a code only to change it."],
        ["Status", "Blank keeps the current status. Enter Active or Inactive to change it."],
        ["On-hand quantity", "Never changed by the import."],
      ],
    },
    copying: "This template is plain text, so you can copy and paste from an export of your old system. Line your old columns up with these columns, fill in any that your old system did not have, and paste. Category codes, unit names, locations, partners, and users must match the values already in Omne; the Valid Values section lists them.",
    notCovered: "On-hand quantity, images, attachments, and qualified vendors are not imported. New items start with an on-hand quantity of 0 and a placeholder image. Add images and qualified vendors on the item page after the import.",
    fileLimits: "Upload an Excel or CSV file up to 10 MB. Omne reads a single sheet. If you are using the Excel template, keep only the data sheet before you upload.",
    fieldGroups: ["Required columns", "Identity", "Categories", "Item Definition", "Stock & Logistics", "Procurement", "Selling", "Governance", "Material Handling"],
  },
};
