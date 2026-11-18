/* Items_June_2026.csv: the seeded import that covers every rule in
 * ./validation.ts. Each row starts from the template's example row 1 and
 * changes only the cells listed.
 *
 * Coverage (row: rule -> issue)
 *   1  clean create                                          -> none
 *   2  clean create, other valid vocabulary                  -> none
 *   3  unknown Status, Inventory Type, Control, PO rule,
 *      Valuation; Serial Scan without Serialized control     -> INVALID_DROPDOWN x5, CONDITIONAL_IGNORED (scanSerial)
 *   4  unknown Lot Tracking and scan toggles                 -> INVALID_DROPDOWN (lotControl, scan x4),
 *      Lot ID Assignment without Lot Tracking                   CONDITIONAL_IGNORED (lotIdSource)
 *   5  Shelf Life Unit with no Shelf Life                    -> CONDITIONAL_IGNORED (shelfLifeUnit)
 *   6  unknown Shelf Life Unit, Lot ID, Acquisition, Primary -> INVALID_DROPDOWN x4 ("without a value here")
 *   7  Primary Acquisition not among the methods; long tag   -> CONDITIONAL_IGNORED (primaryAcquisition), TAG_TOO_LONG
 *   8  primary repeated and unknown additional categories    -> ADDITIONAL_EQUALS_PRIMARY, CATEGORY_NOT_FOUND (warning)
 *   9  partners listed with Selling Scope All;
 *      several unknown additional categories                -> CONDITIONAL_IGNORED (specificPartners), CATEGORY_NOT_FOUND (plural)
 *  10  Specific scope, only unknown partners                 -> REFERENCE_NOT_FOUND, MISSING_CONDITIONAL
 *  11  unknown Selling Scope                                 -> INVALID_DROPDOWN (sellingScope)
 *  12  unknown locations, owners and approvers               -> REFERENCE_NOT_FOUND x8
 *  13  existing part number (update), unknown values         -> INVALID_DROPDOWN, "existing value / setting will be kept"
 *  14  blank Part Number                                     -> REQUIRED_EMPTY (partNumber)
 *  15  part number repeated in row 16                        -> DUPLICATE_KEY
 *  16  same part number, other case                          -> DUPLICATE_KEY
 *  17  description over 5000 characters imports in full      -> none
 *  18  blank Primary Category on a new item                  -> REQUIRED_EMPTY (primaryCategory)
 *  19  Primary Category Omne does not know                   -> CATEGORY_NOT_FOUND (error)
 *  20  Shelf Life not a number                               -> INVALID_NUMBER
 *  21  Shelf Life below 0                                    -> RANGE_INVALID
 *  22  base unit Omne does not know                          -> UNIT_NOT_FOUND
 *  23  alternative unit not Unit=factor                      -> INVALID_ALT_UNIT
 *  24  alternative unit Omne does not know                   -> INVALID_ALT_UNIT
 *  25  alternative unit factor of 0                          -> INVALID_ALT_UNIT
 *  26  alternative unit equal to the base unit               -> INVALID_ALT_UNIT
 *  27  alternative unit in the base unit's category          -> INVALID_ALT_UNIT
 *  28  Min Level not a number                                -> INVALID_NUMBER (minStock)
 *  29  Min Level below 0                                     -> RANGE_INVALID (minStock)
 *  30  Max Level not a number                                -> INVALID_NUMBER (maxStock)
 *  31  Max Level below 0                                     -> RANGE_INVALID (maxStock)
 *  32  Min Level not below Max Level                         -> RANGE_INVALID (minStock)
 *  33  Min Order Qty not a number                            -> INVALID_NUMBER (minPurchase)
 *  34  Min Order Qty below 0                                 -> RANGE_INVALID (minPurchase)
 *  35  Max Order Qty not a number                            -> INVALID_NUMBER (maxPurchase)
 *  36  Max Order Qty below 0                                 -> RANGE_INVALID (maxPurchase)
 *  37  Max Order Qty under Min Order Qty                     -> RANGE_INVALID (maxPurchase)
 *  38  Order Multiples not a number                          -> INVALID_NUMBER (multiples)
 *  39  Order Multiples of 0                                  -> RANGE_INVALID (multiples)
 *  40  price tier not "price unit"                           -> INVALID_PRICE
 *  41  price tier unit not recognised                        -> INVALID_PRICE
 *  42  Acceptable Variance not a number                      -> INVALID_NUMBER (cycleTolerance)
 *  43  Acceptable Variance over 100                          -> RANGE_INVALID (cycleTolerance) */

import { longText, type SeedCase } from "../failedSeedTypes";

export const ITEM_LIBRARY_FAILED_SEED: SeedCase[] = [
  { outcome: "Created", rule: "Clean new item", values: { partNumber: "PUMP-CENT-3HP", description: "Centrifugal water pump, 3 HP, cast iron housing" }, demonstrates: [] },
  {
    outcome: "Created",
    rule: "Clean new item with other valid values",
    values: {
      partNumber: "VALVE-GATE-2IN", description: "Bronze gate valve, 2 inch threaded", status: "Inactive", tags: "Valves",
      primaryCategory: "C-1008", additionalCategories: "C-1003", inventoryType: "Non-stock", inventoryControlType: "Non-Serialized",
      lotControl: "No", lotIdSource: "", shelfLifeValue: "", shelfLifeUnit: "", sellingScope: "All", specificPartners: "",
      scanSerial: "No", valuationMethod: "WAC", shortageRule: "Min",
    },
    demonstrates: [],
  },
  {
    outcome: "Created",
    rule: "Unrecognised dropdowns fall back to the defaults; Serial Scan needs Serialized control",
    values: {
      partNumber: "HOSE-HYD-12M", description: "Hydraulic hose assembly, 12 m", status: "Discontinued", inventoryType: "Consumable",
      inventoryControlType: "Batch", shortageRule: "Reorder", valuationMethod: "Average",
    },
    demonstrates: [
      "status:INVALID_DROPDOWN~will import with Active", "inventoryType:INVALID_DROPDOWN", "inventoryControlType:INVALID_DROPDOWN",
      "shortageRule:INVALID_DROPDOWN", "valuationMethod:INVALID_DROPDOWN", "scanSerial:CONDITIONAL_IGNORED",
    ],
  },
  {
    outcome: "Created",
    rule: "Unrecognised Yes / No toggles are left off; Lot ID Assignment needs Lot Tracking",
    values: {
      partNumber: "SEAL-KIT-40", description: "Hydraulic cylinder seal kit, 40 mm bore", inventoryControlType: "Non-Serialized",
      lotControl: "Sometimes", scanLocation: "Maybe", scanItem: "Sure", scanLot: "Always", scanSerial: "Unsure",
    },
    demonstrates: [
      "lotControl:INVALID_DROPDOWN~The setting will be left off", "scanLocation:INVALID_DROPDOWN", "scanItem:INVALID_DROPDOWN",
      "scanLot:INVALID_DROPDOWN", "scanSerial:INVALID_DROPDOWN", "lotIdSource:CONDITIONAL_IGNORED",
    ],
  },
  {
    outcome: "Created",
    rule: "Shelf Life Unit is ignored without a Shelf Life",
    values: { partNumber: "GEAR-SPUR-24T", description: "Steel spur gear, 24 teeth", shelfLifeValue: "", shelfLifeUnit: "Months" },
    demonstrates: ["shelfLifeUnit:CONDITIONAL_IGNORED"],
  },
  {
    outcome: "Created",
    rule: "Unrecognised Shelf Life Unit, Lot ID Assignment, Acquisition Method and Primary Acquisition",
    values: {
      partNumber: "BRKT-STL-90", description: "90 degree steel bracket", shelfLifeUnit: "Weeks", acquisitionMethods: "Purchased|Rented",
      primaryAcquisition: "Leased", lotIdSource: "Supplier Lot",
    },
    demonstrates: [
      "lotIdSource:INVALID_DROPDOWN~will import with System Generated",
      "shelfLifeUnit:INVALID_DROPDOWN~will import with Days", "acquisitionMethods:INVALID_DROPDOWN~It will be dropped",
      "primaryAcquisition:INVALID_DROPDOWN~without a value here",
    ],
  },
  {
    outcome: "Created",
    rule: "Primary Acquisition must be one of the methods; long tag is shortened",
    values: {
      partNumber: "MOTOR-DC-24V", description: "Brushless DC motor, 24 V", acquisitionMethods: "Purchased", primaryAcquisition: "Manufactured",
      tags: "Motors|Brushless DC motors for conveyor retrofit kits",
    },
    demonstrates: ["primaryAcquisition:CONDITIONAL_IGNORED", "tags:TAG_TOO_LONG"],
  },
  {
    outcome: "Created",
    rule: "Additional Categories: the primary is dropped, unknown ones are dropped",
    values: { partNumber: "CABLE-CAT6-305", description: "Cat6 network cable, 305 m reel", primaryCategory: "C-1004", additionalCategories: "C-1004|C-9999" },
    demonstrates: ["additionalCategories:ADDITIONAL_EQUALS_PRIMARY", "additionalCategories:CATEGORY_NOT_FOUND~doesn't exist in Omne"],
  },
  {
    outcome: "Created",
    rule: "Specific Partners are ignored when Selling Scope is All",
    values: {
      partNumber: "SENSOR-PROX-M12", description: "Inductive proximity sensor, M12", sellingScope: "All", specificPartners: "Ford Motor Company",
      additionalCategories: "C-9998|C-9997",
    },
    demonstrates: ["specificPartners:CONDITIONAL_IGNORED", "additionalCategories:CATEGORY_NOT_FOUND~don't exist in Omne"],
  },
  {
    outcome: "Created",
    rule: "Specific scope with only unknown partners imports with no partners",
    values: { partNumber: "SENSOR-TEMP-K", description: "Type K thermocouple probe", sellingScope: "Specific", specificPartners: "Acme Robotics|Blue Ridge Fleet" },
    demonstrates: ["specificPartners:REFERENCE_NOT_FOUND~don't exist in Omne", "specificPartners:MISSING_CONDITIONAL"],
  },
  {
    outcome: "Created",
    rule: "Unrecognised Selling Scope",
    values: { partNumber: "RELAY-SS-40A", description: "Solid state relay, 40 A", sellingScope: "Everyone", specificPartners: "" },
    demonstrates: ["sellingScope:INVALID_DROPDOWN~will import with All"],
  },
  {
    outcome: "Created",
    rule: "Unknown locations, owners and approvers are dropped",
    values: {
      partNumber: "PALLET-JACK-5T", description: "Manual pallet jack, 5 t", inboundLocations: "Warehouse Z - Annex",
      outboundLocations: "Dock 9|Dock 10", receivingStagingLocation: "Inbound Cage", shippingStagingLocation: "Outbound Cage",
      "owners.materialHandling": "Jordan Blake", "owners.purchasing": "Morgan Lee", "owners.finance": "Casey Ford", approvers: "Priya Nair",
    },
    demonstrates: [
      "inboundLocations:REFERENCE_NOT_FOUND~doesn't exist in Omne", "outboundLocations:REFERENCE_NOT_FOUND~don't exist in Omne",
      "receivingStagingLocation:REFERENCE_NOT_FOUND", "shippingStagingLocation:REFERENCE_NOT_FOUND",
      "owners.materialHandling:REFERENCE_NOT_FOUND", "owners.purchasing:REFERENCE_NOT_FOUND", "owners.finance:REFERENCE_NOT_FOUND",
      "approvers:REFERENCE_NOT_FOUND",
    ],
  },
  {
    outcome: "Created",
    rule: "Existing part number updates the item; unrecognised values keep what is stored",
    values: { partNumber: "FAST-HEX-001", description: "Hex head cap screw, zinc plated", status: "Obsolete", lotControl: "Unknown", lotIdSource: "" },
    demonstrates: ["@update", "status:INVALID_DROPDOWN~The existing value will be kept", "lotControl:INVALID_DROPDOWN~The existing setting will be kept"],
  },
  { outcome: "Failed", rule: "Part Number is required", values: { partNumber: "", description: "Stainless ball valve, 1 inch" }, demonstrates: ["partNumber:REQUIRED_EMPTY"] },
  { outcome: "Failed", rule: "Part number appears twice in the file", values: { partNumber: "BRG-6205-2RS", description: "Deep groove ball bearing" }, demonstrates: ["partNumber:DUPLICATE_KEY~row 16"] },
  { outcome: "Failed", rule: "Duplicate match ignores case", values: { partNumber: "brg-6205-2rs", description: "Deep groove ball bearing, sealed" }, demonstrates: ["partNumber:DUPLICATE_KEY~row 15"] },
  {
    outcome: "Created",
    rule: "A description over 5000 characters imports in full",
    values: {
      partNumber: "PUMP-SUB-1HP",
      description: longText("Submersible sump pump, 1 HP, stainless steel housing with float switch, 25 ft cord, thermal overload protection and a 2 inch discharge for basement and pit installs."),
    },
    demonstrates: [],
  },
  { outcome: "Failed", rule: "Primary Category is required on a new item", values: { partNumber: "CLAMP-HOSE-32", description: "Worm drive hose clamp, 32 mm", primaryCategory: "" }, demonstrates: ["primaryCategory:REQUIRED_EMPTY"] },
  { outcome: "Failed", rule: "Primary Category Omne does not know", values: { partNumber: "CLAMP-HOSE-40", description: "Worm drive hose clamp, 40 mm", primaryCategory: "Widgets" }, demonstrates: ["primaryCategory:CATEGORY_NOT_FOUND"] },
  { outcome: "Failed", rule: "Shelf Life is not a number", values: { partNumber: "ADH-EPOXY-50", description: "Two part epoxy, 50 ml", shelfLifeValue: "two years" }, demonstrates: ["shelfLifeValue:INVALID_NUMBER"] },
  { outcome: "Failed", rule: "Shelf Life below 0", values: { partNumber: "ADH-CA-20", description: "Cyanoacrylate adhesive, 20 g", shelfLifeValue: "-6" }, demonstrates: ["shelfLifeValue:RANGE_INVALID"] },
  { outcome: "Failed", rule: "Base unit Omne does not know", values: { partNumber: "RESIN-PP-25", description: "Polypropylene resin pellets", unit: "Crate" }, demonstrates: ["unit:UNIT_NOT_FOUND"] },
  { outcome: "Failed", rule: "Alternative unit not written as Unit=factor", values: { partNumber: "RIVET-AL-4", description: "Aluminium pop rivet, 4 mm", alternativeUnits: "Box4" }, demonstrates: ["alternativeUnits:INVALID_ALT_UNIT~could not be read"] },
  { outcome: "Failed", rule: "Alternative unit Omne does not know", values: { partNumber: "WASHER-FL-M8", description: "Flat washer, M8", alternativeUnits: "Crate=10" }, demonstrates: ["alternativeUnits:INVALID_ALT_UNIT~doesn't exist in Omne"] },
  { outcome: "Failed", rule: "Alternative unit factor must be above 0", values: { partNumber: "NUT-HEX-M8", description: "Hex nut, M8", alternativeUnits: "Box=0" }, demonstrates: ["alternativeUnits:INVALID_ALT_UNIT~must be greater than 0"] },
  { outcome: "Failed", rule: "Alternative unit cannot be the base unit", values: { partNumber: "TIE-NYL-200", description: "Nylon cable tie, 200 mm", unit: "Each", alternativeUnits: "Each=1" }, demonstrates: ["alternativeUnits:INVALID_ALT_UNIT~is the base unit"] },
  { outcome: "Failed", rule: "Alternative unit cannot share the base unit's category", values: { partNumber: "GROM-RUB-10", description: "Rubber grommet, 10 mm", unit: "Each", alternativeUnits: "Dozen=12" }, demonstrates: ["alternativeUnits:INVALID_ALT_UNIT~shares a unit category"] },
  { outcome: "Failed", rule: "Min Level is not a number", values: { partNumber: "FUSE-BLADE-10", description: "Blade fuse, 10 A", minStock: "five" }, demonstrates: ["minStock:INVALID_NUMBER"] },
  { outcome: "Failed", rule: "Min Level below 0", values: { partNumber: "FUSE-BLADE-15", description: "Blade fuse, 15 A", minStock: "-5" }, demonstrates: ["minStock:RANGE_INVALID~0 or more"] },
  { outcome: "Failed", rule: "Max Level is not a number", values: { partNumber: "FUSE-BLADE-20", description: "Blade fuse, 20 A", maxStock: "lots" }, demonstrates: ["maxStock:INVALID_NUMBER"] },
  { outcome: "Failed", rule: "Max Level below 0", values: { partNumber: "FUSE-BLADE-25", description: "Blade fuse, 25 A", maxStock: "-20" }, demonstrates: ["maxStock:RANGE_INVALID"] },
  { outcome: "Failed", rule: "Min Level must be below Max Level", values: { partNumber: "FUSE-BLADE-30", description: "Blade fuse, 30 A", minStock: "300", maxStock: "200" }, demonstrates: ["minStock:RANGE_INVALID~less than max level"] },
  { outcome: "Failed", rule: "Min Order Qty is not a number", values: { partNumber: "LAMP-LED-9W", description: "LED lamp, 9 W", minPurchase: "ten" }, demonstrates: ["minPurchase:INVALID_NUMBER"] },
  { outcome: "Failed", rule: "Min Order Qty below 0", values: { partNumber: "LAMP-LED-12W", description: "LED lamp, 12 W", minPurchase: "-10" }, demonstrates: ["minPurchase:RANGE_INVALID"] },
  { outcome: "Failed", rule: "Max Order Qty is not a number", values: { partNumber: "LAMP-LED-15W", description: "LED lamp, 15 W", maxPurchase: "many" }, demonstrates: ["maxPurchase:INVALID_NUMBER"] },
  { outcome: "Failed", rule: "Max Order Qty below 0", values: { partNumber: "LAMP-LED-18W", description: "LED lamp, 18 W", maxPurchase: "-500" }, demonstrates: ["maxPurchase:RANGE_INVALID~0 or more"] },
  { outcome: "Failed", rule: "Max Order Qty must be at least Min Order Qty", values: { partNumber: "LAMP-LED-24W", description: "LED lamp, 24 W", minPurchase: "600", maxPurchase: "500" }, demonstrates: ["maxPurchase:RANGE_INVALID~at least Min Order Qty"] },
  { outcome: "Failed", rule: "Order Multiples is not a number", values: { partNumber: "BOLT-CARR-M6", description: "Carriage bolt, M6", multiples: "half" }, demonstrates: ["multiples:INVALID_NUMBER"] },
  { outcome: "Failed", rule: "Order Multiples must be above 0", values: { partNumber: "BOLT-CARR-M8", description: "Carriage bolt, M8", multiples: "0" }, demonstrates: ["multiples:RANGE_INVALID"] },
  { outcome: "Failed", rule: "Price tier not written as price then unit", values: { partNumber: "GLOVE-NIT-L", description: "Nitrile gloves, large", pricing: "Each 12.50" }, demonstrates: ["pricing:INVALID_PRICE~could not be read"] },
  { outcome: "Failed", rule: "Price tier unit not recognised", values: { partNumber: "GLOVE-NIT-XL", description: "Nitrile gloves, extra large", pricing: "12.50 Gross" }, demonstrates: ["pricing:INVALID_PRICE~is not recognised"] },
  { outcome: "Failed", rule: "Acceptable Variance is not a number", values: { partNumber: "TAPE-DUCT-48", description: "Duct tape, 48 mm", cycleTolerance: "about 2" }, demonstrates: ["cycleTolerance:INVALID_NUMBER"] },
  { outcome: "Failed", rule: "Acceptable Variance over 100", values: { partNumber: "TAPE-FOIL-50", description: "Foil tape, 50 mm", cycleTolerance: "150" }, demonstrates: ["cycleTolerance:RANGE_INVALID"] },
];
