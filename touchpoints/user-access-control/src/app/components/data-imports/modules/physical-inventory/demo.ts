/* Provenance: your-invoice-mate/src/app/components/import-adjustment/demo.ts
 * sha256 b1bda1ac522b8fc8643853207acc36878e87edeaf5d92a6551312b22d06e1723
 * Copied into role-zen 2026-09-30. Verbatim. */
/* Sample rows for the Adjust Inventory > Import review, per control type.
 * The first rows of each set are clean; the rest together trigger every issue
 * the mode can raise (validation.ts reachableCodes), one rule per row where the
 * rule allows it (duplicates and unit conflicts need two rows). Values come
 * from Physical Inventory's own data: EXISTING_SERIALS, EXISTING_LOTS,
 * KNOWN_LOCATIONS and INCREASE_REASONS.
 *
 * Coverage, row -> rule (rows are 1-based, as the review grid numbers them):
 *
 * serialized
 *   1-3  clean
 *   4    REQUIRED_EMPTY      Serial Number blank
 *   5    SERIAL_EXISTS       SN-1003 is already in use
 *   6-7  DUPLICATE_SERIAL    SN-4010 on both rows
 *   8    INVALID_NUMBER      Price "twenty"
 *   9    NEGATIVE_PRICE      Price -5.00
 *   10   LOCATION_NOT_FOUND  Zone Z-99
 *   11   REQUIRED_EMPTY      Location blank
 *   12   INVALID_REASON      "Returned" (warning, imports without a reason)
 *
 * non-serialized
 *   1-3  clean
 *   4    REQUIRED_EMPTY      Qty blank
 *   5    INVALID_NUMBER      Qty "12 boxes"
 *   6    NOT_POSITIVE        Qty 0
 *   7    NOT_POSITIVE        Qty -40
 *   8    INVALID_UOM         Pallet
 *   9    REQUIRED_EMPTY      UoM blank
 *   10   INVALID_NUMBER      Price "free"
 *   11   NEGATIVE_PRICE      Price -3.00
 *   12   LOCATION_NOT_FOUND  Dock-9
 *   13   INVALID_REASON      "Recount" (warning)
 *
 * lot-serialized
 *   1-3  clean (existing LOTs)
 *   4    NEW_LOT             LOT-120500 (warning, a new LOT is created)
 *   5    REQUIRED_EMPTY      LOT Number blank
 *   6    REQUIRED_EMPTY      Serial Number blank
 *   7    SERIAL_EXISTS       SN-2001
 *   8-9  DUPLICATE_SERIAL    SN-5010 on both rows
 *   10   INVALID_NUMBER      Price "24,5O"
 *   11   NEGATIVE_PRICE      Price -1
 *   12   LOCATION_NOT_FOUND  Rack 12
 *   13   INVALID_REASON      "Donation" (warning)
 *
 * lot
 *   1-3  clean (existing LOTs, each in its own unit, price blank or the LOT's)
 *   4    NEW_LOT             LOT-120600 (warning)
 *   5    LOT_UOM_MISMATCH    LOT-112000 is held in EA, row uses Boxes
 *   6-7  LOT_UOM_CONFLICT    new LOT-120700 in EA on one row, Boxes on the other
 *   8    PRICE_SET_BY_LOT    LOT-112001 at 30.00 (warning, the LOT's 24.50 is kept)
 *   9    REQUIRED_EMPTY      LOT Number blank
 *   10   INVALID_NUMBER      Qty "ten"
 *   11   NOT_POSITIVE        Qty 0
 *   12   INVALID_UOM         Drum
 *   13   INVALID_NUMBER      Price "N/A"
 *   14   NEGATIVE_PRICE      Price -12.00
 *   15   LOCATION_NOT_FOUND  Yard 4
 *   16   INVALID_REASON      "Transfer in" (warning)
 */

import type { TrackingMode } from "./types";

type Row = Record<string, string>;

const SERIALIZED: Row[] = [
  { serialNumber: "SN-4001", price: "24.50", location: "Zone A-01", reason: "System Startup" },
  { serialNumber: "SN-4002", price: "24.50", location: "Zone A-02", reason: "Found Item" },
  { serialNumber: "SN-4003", price: "", location: "Zone B-05", reason: "" },
  { serialNumber: "", price: "24.50", location: "Zone A-01", reason: "" },
  { serialNumber: "SN-1003", price: "24.50", location: "Zone A-01", reason: "" },
  { serialNumber: "SN-4010", price: "24.50", location: "Zone A-02", reason: "" },
  { serialNumber: "SN-4010", price: "24.50", location: "Zone B-05", reason: "" },
  { serialNumber: "SN-4011", price: "twenty", location: "Zone A-01", reason: "" },
  { serialNumber: "SN-4012", price: "-5.00", location: "Zone A-01", reason: "" },
  { serialNumber: "SN-4013", price: "24.50", location: "Zone Z-99", reason: "" },
  { serialNumber: "SN-4014", price: "24.50", location: "", reason: "" },
  { serialNumber: "SN-4015", price: "24.50", location: "Zone A-01", reason: "Returned" },
];

const NON_SERIALIZED: Row[] = [
  { qty: "500", uom: "EA", price: "12.50", location: "Zone A-01", reason: "System Startup" },
  { qty: "40", uom: "Boxes", price: "22.00", location: "Zone B-05", reason: "Found Item" },
  { qty: "1,250", uom: "Carton", price: "", location: "Zone A-02", reason: "" },
  { qty: "", uom: "EA", price: "12.50", location: "Zone A-01", reason: "" },
  { qty: "12 boxes", uom: "Boxes", price: "22.00", location: "Zone A-01", reason: "" },
  { qty: "0", uom: "EA", price: "12.50", location: "Zone A-01", reason: "" },
  { qty: "-40", uom: "EA", price: "12.50", location: "Zone B-05", reason: "" },
  { qty: "25", uom: "Pallet", price: "12.50", location: "Zone A-01", reason: "" },
  { qty: "25", uom: "", price: "12.50", location: "Zone A-01", reason: "" },
  { qty: "25", uom: "EA", price: "free", location: "Zone A-01", reason: "" },
  { qty: "25", uom: "EA", price: "-3.00", location: "Zone A-01", reason: "" },
  { qty: "25", uom: "EA", price: "12.50", location: "Dock-9", reason: "" },
  { qty: "25", uom: "EA", price: "12.50", location: "Zone A-01", reason: "Recount" },
];

const LOT_SERIALIZED: Row[] = [
  { lotNumber: "LOT-112000", serialNumber: "SN-5001", price: "24.50", location: "Zone A-01", reason: "System Startup" },
  { lotNumber: "LOT-112000", serialNumber: "SN-5002", price: "24.50", location: "Zone A-01", reason: "" },
  { lotNumber: "LOT-112001", serialNumber: "SN-5003", price: "26.00", location: "Zone B-05", reason: "Found Item" },
  { lotNumber: "LOT-120500", serialNumber: "SN-5004", price: "24.50", location: "Zone A-02", reason: "" },
  { lotNumber: "", serialNumber: "SN-5005", price: "24.50", location: "Zone A-01", reason: "" },
  { lotNumber: "LOT-112000", serialNumber: "", price: "24.50", location: "Zone A-01", reason: "" },
  { lotNumber: "LOT-112000", serialNumber: "SN-2001", price: "24.50", location: "Zone A-01", reason: "" },
  { lotNumber: "LOT-112001", serialNumber: "SN-5010", price: "24.50", location: "Zone A-01", reason: "" },
  { lotNumber: "LOT-112001", serialNumber: "SN-5010", price: "24.50", location: "Zone B-05", reason: "" },
  { lotNumber: "LOT-112000", serialNumber: "SN-5011", price: "24,5O", location: "Zone A-01", reason: "" },
  { lotNumber: "LOT-112000", serialNumber: "SN-5012", price: "-1", location: "Zone A-01", reason: "" },
  { lotNumber: "LOT-112000", serialNumber: "SN-5013", price: "24.50", location: "Rack 12", reason: "" },
  { lotNumber: "LOT-112000", serialNumber: "SN-5014", price: "24.50", location: "Zone A-01", reason: "Donation" },
];

const LOT: Row[] = [
  { lotNumber: "LOT-112000", qty: "100", uom: "EA", price: "", location: "Zone A-01", reason: "System Startup" },
  { lotNumber: "LOT-112001", qty: "20", uom: "Boxes", price: "24.50", location: "Zone B-05", reason: "Found Item" },
  { lotNumber: "LOT-112002", qty: "5", uom: "Carton", price: "", location: "Zone A-02", reason: "" },
  { lotNumber: "LOT-120600", qty: "50", uom: "EA", price: "18.00", location: "Zone A-02", reason: "" },
  { lotNumber: "LOT-112000", qty: "10", uom: "Boxes", price: "", location: "Zone A-01", reason: "" },
  { lotNumber: "LOT-120700", qty: "10", uom: "EA", price: "18.00", location: "Zone A-01", reason: "" },
  { lotNumber: "LOT-120700", qty: "5", uom: "Boxes", price: "18.00", location: "Zone A-01", reason: "" },
  { lotNumber: "LOT-112001", qty: "30", uom: "Boxes", price: "30.00", location: "Zone B-05", reason: "" },
  { lotNumber: "", qty: "15", uom: "EA", price: "", location: "Zone A-01", reason: "" },
  { lotNumber: "LOT-112000", qty: "ten", uom: "EA", price: "", location: "Zone A-01", reason: "" },
  { lotNumber: "LOT-112000", qty: "0", uom: "EA", price: "", location: "Zone A-01", reason: "" },
  { lotNumber: "LOT-112002", qty: "8", uom: "Drum", price: "", location: "Zone A-01", reason: "" },
  { lotNumber: "LOT-112002", qty: "8", uom: "Carton", price: "N/A", location: "Zone A-01", reason: "" },
  { lotNumber: "LOT-112002", qty: "8", uom: "Carton", price: "-12.00", location: "Zone A-01", reason: "" },
  { lotNumber: "LOT-112002", qty: "8", uom: "Carton", price: "", location: "Yard 4", reason: "" },
  { lotNumber: "LOT-112002", qty: "8", uom: "Carton", price: "", location: "Zone A-01", reason: "Transfer in" },
];

const DEMO: Record<TrackingMode, Row[]> = {
  serialized: SERIALIZED,
  "non-serialized": NON_SERIALIZED,
  "lot-serialized": LOT_SERIALIZED,
  lot: LOT,
};

/** Sample rows for the review when a file cannot be read. Fresh copies every call. */
export function demoImportRows(mode: TrackingMode): Record<string, string>[] {
  return DEMO[mode].map((r) => ({ ...r }));
}

/** How many leading demo rows are clean (no issue at all). */
export const DEMO_CLEAN_ROWS = 3;
