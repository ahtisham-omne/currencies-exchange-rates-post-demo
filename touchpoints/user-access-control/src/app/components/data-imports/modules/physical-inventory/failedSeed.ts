/* The seeded June import of each Physical Inventory tab. Its rows are
 * Physical Inventory's own demo rows for the control type (./demo.ts, which
 * already trips every rule ./validation.ts raises for that type), each given a
 * Part Number of that type, plus three rows for the Part Number rule
 * (piModule.ts): blank, not in Omne, and an item of another control type.
 * Rows with an error are Failed; warning-only rows imported.
 *
 * Coverage (row: rule -> issue), per tab, follows demo.ts's table; the three
 * Part Number rows come last:
 *
 * serialized
 *   1-3 clean | 4 serialNumber REQUIRED_EMPTY | 5 SERIAL_EXISTS | 6-7 DUPLICATE_SERIAL
 *   8 price INVALID_NUMBER | 9 NEGATIVE_PRICE | 10 LOCATION_NOT_FOUND | 11 location REQUIRED_EMPTY
 *   12 INVALID_REASON (warning) | 13-15 partNumber REQUIRED_EMPTY, ITEM_NOT_FOUND, ITEM_CONTROL_TYPE
 * non-serialized
 *   1-3 clean | 4 qty REQUIRED_EMPTY | 5 qty INVALID_NUMBER | 6-7 NOT_POSITIVE | 8 INVALID_UOM
 *   9 uom REQUIRED_EMPTY | 10 price INVALID_NUMBER | 11 NEGATIVE_PRICE | 12 LOCATION_NOT_FOUND
 *   13 INVALID_REASON (warning) | 14-16 Part Number rows
 * lot-serialized
 *   1-3 clean | 4 NEW_LOT (warning) | 5 lotNumber REQUIRED_EMPTY | 6 serialNumber REQUIRED_EMPTY
 *   7 SERIAL_EXISTS | 8-9 DUPLICATE_SERIAL | 10 price INVALID_NUMBER | 11 NEGATIVE_PRICE
 *   12 LOCATION_NOT_FOUND | 13 INVALID_REASON (warning) | 14-16 Part Number rows
 * lot
 *   1-3 clean | 4 NEW_LOT (warning) | 5 LOT_UOM_MISMATCH | 6-7 LOT_UOM_CONFLICT
 *   8 PRICE_SET_BY_LOT (warning) | 9 lotNumber REQUIRED_EMPTY | 10 qty INVALID_NUMBER
 *   11 NOT_POSITIVE | 12 INVALID_UOM | 13 price INVALID_NUMBER | 14 NEGATIVE_PRICE
 *   15 LOCATION_NOT_FOUND | 16 INVALID_REASON (warning) | 17-19 Part Number rows */

import type { SeedCase } from "../failedSeedTypes";
import { demoImportRows } from "./demo";
import { piItemsFor, type PiSlug } from "./piModule";
import type { TrackingMode } from "./types";

/** What each demo row demonstrates, in demo.ts order. */
const DEMO_RULES: Record<TrackingMode, { rule: string; demonstrates: string[] }[]> = {
  serialized: [
    { rule: "Clean serial unit with a reason", demonstrates: [] },
    { rule: "Clean serial unit, other reason", demonstrates: [] },
    { rule: "Clean serial unit without price or reason", demonstrates: [] },
    { rule: "Serial Number blank", demonstrates: ["serialNumber:REQUIRED_EMPTY:error"] },
    { rule: "Serial number already in use", demonstrates: ["serialNumber:SERIAL_EXISTS:error"] },
    { rule: "Same serial number twice (first)", demonstrates: ["serialNumber:DUPLICATE_SERIAL:error"] },
    { rule: "Same serial number twice (second)", demonstrates: ["serialNumber:DUPLICATE_SERIAL:error"] },
    { rule: "Price is not a number", demonstrates: ["price:INVALID_NUMBER:error"] },
    { rule: "Price below zero", demonstrates: ["price:NEGATIVE_PRICE:error"] },
    { rule: "Location not in Omne", demonstrates: ["location:LOCATION_NOT_FOUND:error"] },
    { rule: "Location blank", demonstrates: ["location:REQUIRED_EMPTY:error"] },
    { rule: "Reason not an increase reason", demonstrates: ["reason:INVALID_REASON:warning"] },
  ],
  "non-serialized": [
    { rule: "Clean stock line with a reason", demonstrates: [] },
    { rule: "Clean stock line in Boxes", demonstrates: [] },
    { rule: "Clean stock line in Carton, no price", demonstrates: [] },
    { rule: "Qty blank", demonstrates: ["qty:REQUIRED_EMPTY:error"] },
    { rule: "Qty is not a number", demonstrates: ["qty:INVALID_NUMBER:error"] },
    { rule: "Qty of zero", demonstrates: ["qty:NOT_POSITIVE:error"] },
    { rule: "Negative qty", demonstrates: ["qty:NOT_POSITIVE:error"] },
    { rule: "Unit this item is not counted in", demonstrates: ["uom:INVALID_UOM:error"] },
    { rule: "UoM blank", demonstrates: ["uom:REQUIRED_EMPTY:error"] },
    { rule: "Price is not a number", demonstrates: ["price:INVALID_NUMBER:error"] },
    { rule: "Price below zero", demonstrates: ["price:NEGATIVE_PRICE:error"] },
    { rule: "Location not in Omne", demonstrates: ["location:LOCATION_NOT_FOUND:error"] },
    { rule: "Reason not an increase reason", demonstrates: ["reason:INVALID_REASON:warning"] },
  ],
  "lot-serialized": [
    { rule: "Clean unit into an existing LOT", demonstrates: [] },
    { rule: "Clean unit into the same LOT", demonstrates: [] },
    { rule: "Clean unit into another existing LOT", demonstrates: [] },
    { rule: "LOT number not on the item: a new LOT", demonstrates: ["lotNumber:NEW_LOT:warning"] },
    { rule: "LOT Number blank", demonstrates: ["lotNumber:REQUIRED_EMPTY:error"] },
    { rule: "Serial Number blank", demonstrates: ["serialNumber:REQUIRED_EMPTY:error"] },
    { rule: "Serial number already in use", demonstrates: ["serialNumber:SERIAL_EXISTS:error"] },
    { rule: "Same serial number twice (first)", demonstrates: ["serialNumber:DUPLICATE_SERIAL:error"] },
    { rule: "Same serial number twice (second)", demonstrates: ["serialNumber:DUPLICATE_SERIAL:error"] },
    { rule: "Price is not a number", demonstrates: ["price:INVALID_NUMBER:error"] },
    { rule: "Price below zero", demonstrates: ["price:NEGATIVE_PRICE:error"] },
    { rule: "Location not in Omne", demonstrates: ["location:LOCATION_NOT_FOUND:error"] },
    { rule: "Reason not an increase reason", demonstrates: ["reason:INVALID_REASON:warning"] },
  ],
  lot: [
    { rule: "Clean stock into an existing LOT in its own unit", demonstrates: [] },
    { rule: "Clean stock into an existing LOT at its own price", demonstrates: [] },
    { rule: "Clean stock into a LOT held in Carton", demonstrates: [] },
    { rule: "LOT number not on the item: a new LOT", demonstrates: ["lotNumber:NEW_LOT:warning"] },
    { rule: "Existing LOT in another unit", demonstrates: ["uom:LOT_UOM_MISMATCH:error"] },
    { rule: "New LOT in two units (first)", demonstrates: ["uom:LOT_UOM_CONFLICT:error"] },
    { rule: "New LOT in two units (second)", demonstrates: ["uom:LOT_UOM_CONFLICT:error"] },
    { rule: "Price given for an existing LOT", demonstrates: ["price:PRICE_SET_BY_LOT:warning"] },
    { rule: "LOT Number blank", demonstrates: ["lotNumber:REQUIRED_EMPTY:error"] },
    { rule: "Qty is not a number", demonstrates: ["qty:INVALID_NUMBER:error"] },
    { rule: "Qty of zero", demonstrates: ["qty:NOT_POSITIVE:error"] },
    { rule: "Unit this item is not counted in", demonstrates: ["uom:INVALID_UOM:error"] },
    { rule: "Price is not a number", demonstrates: ["price:INVALID_NUMBER:error"] },
    { rule: "Price below zero", demonstrates: ["price:NEGATIVE_PRICE:error"] },
    { rule: "Location not in Omne", demonstrates: ["location:LOCATION_NOT_FOUND:error"] },
    { rule: "Reason not an increase reason", demonstrates: ["reason:INVALID_REASON:warning"] },
  ],
};

/** An item of another control type, for the wrong-tab row. */
const OTHER_TYPE_ITEM: Record<TrackingMode, string> = {
  serialized: "P-00988",
  "non-serialized": "P-00891",
  "lot-serialized": "P-01001",
  lot: "P-00985",
};

function seedFor(mode: TrackingMode): SeedCase[] {
  const items = piItemsFor(mode);
  const demo = demoImportRows(mode);
  const rules = DEMO_RULES[mode];
  if (demo.length !== rules.length) throw new Error(`physical-inventory ${mode}: demo rows and coverage table differ`);
  const cases: SeedCase[] = demo.map((values, i) => {
    const errors = rules[i].demonstrates.some((d) => d.endsWith(":error"));
    return {
      outcome: errors ? "Failed" : "Created",
      rule: rules[i].rule,
      values: { partNumber: items[i % items.length].partNumber, ...values },
      demonstrates: rules[i].demonstrates,
    };
  });
  /* A clean row of the type to vary the Part Number on. */
  const base = { ...demo[0] };
  const serialFor = (n: number) => (base.serialNumber !== undefined ? { serialNumber: `SN-69${String(n).padStart(2, "0")}` } : {});
  cases.push(
    { outcome: "Failed", rule: "Part Number blank", values: { ...base, ...serialFor(1), partNumber: "" }, demonstrates: ["partNumber:REQUIRED_EMPTY:error"] },
    { outcome: "Failed", rule: "Part number not in Omne", values: { ...base, ...serialFor(2), partNumber: "P-99999" }, demonstrates: ["partNumber:ITEM_NOT_FOUND:error"] },
    { outcome: "Failed", rule: "Item of another control type", values: { ...base, ...serialFor(3), partNumber: OTHER_TYPE_ITEM[mode] }, demonstrates: ["partNumber:ITEM_CONTROL_TYPE:error"] },
  );
  return cases;
}

export const PHYSICAL_INVENTORY_FAILED_SEEDS: Record<PiSlug, SeedCase[]> = {
  "physical-inventory-serialized": seedFor("serialized"),
  "physical-inventory-non-serialized": seedFor("non-serialized"),
  "physical-inventory-lot-serialized": seedFor("lot-serialized"),
  "physical-inventory-lot": seedFor("lot"),
};
