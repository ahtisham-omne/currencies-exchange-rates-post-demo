/* Categories_June_2026.csv: the seeded import that covers every rule in
 * ./validation.ts. Each row starts from the template's example row 1 and
 * changes only the cells listed.
 *
 * Coverage (row: rule -> issue)
 *   1  clean create                                   -> none
 *   2  clean create, other valid vocabulary           -> none
 *   3  unknown Status / Inventory / Control Type      -> INVALID_DROPDOWN x3 (default landing)
 *   4  unknown Lot Tracking, Lot ID, Acquisition only  -> INVALID_DROPDOWN x3 (methods land on the default)
 *   5  Lot ID Assignment with Lot Tracking No         -> CONDITIONAL_IGNORED (lotIdSource)
 *   6  tag over 30 characters                         -> TAG_TOO_LONG
 *   7  unknown Acquisition Method and Primary         -> INVALID_DROPDOWN (acquisitionMethods, primaryAcquisition)
 *   8  Primary Acquisition not among the methods      -> CONDITIONAL_IGNORED (primaryAcquisition)
 *   9  existing code C-1003 (update), unknown values  -> INVALID_DROPDOWN, "existing value will be kept"
 *  10  blank Category Code                            -> REQUIRED_EMPTY
 *  11  code repeated in row 12                        -> DUPLICATE_KEY
 *  12  same code, other case and spacing              -> DUPLICATE_KEY
 *  13  description over 5000 characters imports in full -> none
 *  14  unknown Base Unit of Measure                   -> UNKNOWN_UNIT
 *  15  alternative unit not in Unit=factor form       -> INVALID_ALT_UNIT
 *  16  alternative unit Omne does not know            -> INVALID_ALT_UNIT
 *  17  alternative unit factor of 0                   -> INVALID_ALT_UNIT
 *  18  alternative unit equal to the base unit        -> INVALID_ALT_UNIT
 *  19  alternative unit in the base unit's category   -> INVALID_ALT_UNIT */

import { longText, type SeedCase } from "../failedSeedTypes";

export const CATEGORIES_FAILED_SEED: SeedCase[] = [
  { outcome: "Created", rule: "Clean new category", values: { code: "C-2601", description: "Stamped steel mounting brackets" }, demonstrates: [] },
  {
    outcome: "Created",
    rule: "Clean new category with other valid values",
    values: {
      code: "C-2602", status: "Inactive", description: "Aluminium die castings", tags: "Castings",
      inventoryType: "Non-stock", controlType: "Serialized", lotControlEnabled: "No", lotIdSource: "",
      uom: "Kilogram", alternativeUnits: "Box=25", acquisitionMethods: "Manufactured", primaryAcquisition: "Manufactured",
    },
    demonstrates: [],
  },
  {
    outcome: "Created",
    rule: "Unrecognised Status, Inventory Type and Control Type fall back to the defaults",
    values: { code: "C-2603", description: "Fleet van interior trim", status: "Archived", inventoryType: "Consumable", controlType: "Batch" },
    demonstrates: ["status:INVALID_DROPDOWN~will import as Active", "inventoryType:INVALID_DROPDOWN", "controlType:INVALID_DROPDOWN"],
  },
  {
    outcome: "Created",
    rule: "Unrecognised Lot Tracking and Lot ID Assignment; no known Acquisition Method",
    values: { code: "C-2604", description: "Adhesives and sealants", lotControlEnabled: "Maybe", lotIdSource: "Supplier Lot", acquisitionMethods: "Leased" },
    demonstrates: ["lotControlEnabled:INVALID_DROPDOWN", "lotIdSource:INVALID_DROPDOWN", "acquisitionMethods:INVALID_DROPDOWN~will import as Purchased"],
  },
  {
    outcome: "Created",
    rule: "Lot ID Assignment is ignored when Lot Tracking is No",
    values: { code: "C-2605", description: "Wiring harness connectors", lotControlEnabled: "No", lotIdSource: "Vendor Lot" },
    demonstrates: ["lotIdSource:CONDITIONAL_IGNORED"],
  },
  {
    outcome: "Created",
    rule: "A tag over 30 characters is shortened",
    values: { code: "C-2606", description: "Engine mounts", tags: "Engine|Heavy duty engine mounts for fleet vans" },
    demonstrates: ["tags:TAG_TOO_LONG"],
  },
  {
    outcome: "Created",
    rule: "Unrecognised Acquisition Method and Primary Acquisition",
    values: { code: "C-2607", description: "Returnable shipping racks", acquisitionMethods: "Purchased|Leased", primaryAcquisition: "Consigned" },
    demonstrates: ["acquisitionMethods:INVALID_DROPDOWN~Only Purchased will be used", "primaryAcquisition:INVALID_DROPDOWN~The value will be ignored"],
  },
  {
    outcome: "Created",
    rule: "Primary Acquisition that is not one of the row's methods is ignored",
    values: { code: "C-2608", description: "Replacement filters", acquisitionMethods: "Purchased", primaryAcquisition: "Manufactured" },
    demonstrates: ["primaryAcquisition:CONDITIONAL_IGNORED"],
  },
  {
    outcome: "Created",
    rule: "Existing code updates the category; unrecognised values keep the stored value",
    values: { code: "C-1003", description: "Brake system components", status: "Retired", acquisitionMethods: "Leased" },
    demonstrates: ["@update", "status:INVALID_DROPDOWN~The existing value will be kept", "acquisitionMethods:INVALID_DROPDOWN~The existing value will be kept"],
  },
  { outcome: "Failed", rule: "Category Code is required", values: { code: "", description: "Seat frames and rails" }, demonstrates: ["code:REQUIRED_EMPTY"] },
  { outcome: "Failed", rule: "Category Code appears twice in the file", values: { code: "C-2611", description: "Door hinges" }, demonstrates: ["code:DUPLICATE_KEY~row 12"] },
  { outcome: "Failed", rule: "Duplicate match ignores case and spacing", values: { code: " c-2611", description: "Door hinges, heavy" }, demonstrates: ["code:DUPLICATE_KEY~row 11"] },
  {
    outcome: "Created",
    rule: "A description over 5000 characters imports in full",
    values: {
      code: "C-2613",
      description: longText("Stamped and powder coated steel brackets for RAM ProMaster 2500 upfits, sold in kits of four with the matching fasteners, tolerance sheet and install guide."),
    },
    demonstrates: [],
  },
  { outcome: "Failed", rule: "Base unit Omne does not know", values: { code: "C-2614", description: "Bulk resin pellets", uom: "Crate" }, demonstrates: ["uom:UNKNOWN_UNIT"] },
  { outcome: "Failed", rule: "Alternative unit not written as Unit=factor", values: { code: "C-2615", description: "Rivets", alternativeUnits: "Box12" }, demonstrates: ["alternativeUnits:INVALID_ALT_UNIT~not in the Unit=factor form"] },
  { outcome: "Failed", rule: "Alternative unit Omne does not know", values: { code: "C-2616", description: "Washers", alternativeUnits: "Crate=10" }, demonstrates: ["alternativeUnits:INVALID_ALT_UNIT~not a unit Omne knows"] },
  { outcome: "Failed", rule: "Alternative unit factor must be above 0", values: { code: "C-2617", description: "Hex nuts", alternativeUnits: "Box=0" }, demonstrates: ["alternativeUnits:INVALID_ALT_UNIT~needs a factor above 0"] },
  { outcome: "Failed", rule: "Alternative unit cannot be the base unit", values: { code: "C-2618", description: "Cable ties", uom: "Each", alternativeUnits: "Each=1" }, demonstrates: ["alternativeUnits:INVALID_ALT_UNIT~is the base unit itself"] },
  { outcome: "Failed", rule: "Alternative unit cannot share the base unit's category", values: { code: "C-2619", description: "Grommets", uom: "Each", alternativeUnits: "Dozen=12" }, demonstrates: ["alternativeUnits:INVALID_ALT_UNIT~same unit category"] },
];
