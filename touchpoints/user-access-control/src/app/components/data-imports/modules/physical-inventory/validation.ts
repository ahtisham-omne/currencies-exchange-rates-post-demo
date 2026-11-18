/* Provenance: your-invoice-mate/src/app/components/import-adjustment/validation.ts
 * sha256 335d8ef4c72e2068f33efb8081332862a728d57f458988b5be822a07d93961a5
 * Copied into role-zen 2026-09-30. Edits: 2 import line(s) rewritten for role-zen (see git diff vs source); rules and copy unchanged. */
/* Validation for the Adjust Inventory > Import flow (increase adjustments).
 *
 * The rules are the ones the manual Increase form already enforces
 * (adjust-inventory-modal.tsx: isIncreaseValid, getConfirmHints and the
 * increase grid's locked fields), plus the file-level rules every Omne
 * import runs (role-zen import-review/validation.ts):
 *
 *   Serial Number   required; not already in use in Omne; not twice in the file
 *   LOT Number      required; an unknown LOT is created as a new LOT (warning)
 *   Qty             required; a number above zero
 *   UoM             required; one of the item's units. Lot items: an existing LOT
 *                   keeps its own unit, and a new LOT takes one unit only
 *   Price           optional; a number, zero or more. Lot items: an existing LOT's
 *                   price is set by the LOT (warning, the file price is ignored)
 *   Location        required; a location Omne holds (the form only offers those)
 *   Reason          optional; one of the increase reasons, else the row imports
 *                   without a reason (warning)
 *
 * Errors block a row; warnings import it with the landing the message states. */

import { ALL_UOM_OPTIONS, SERIALIZED_UOM } from "./piData";
import { locationRows } from "./piData";
import type {
  ExistingLot,
  ImportColumn,
  ImportIssue,
  ImportReason,
  ImportRowValidation,
  ImportValidationContext,
  IssueCode,
  RowStatus,
  TrackingMode,
} from "./types";

/* ── Columns per control type (same as the wizard's COLUMNS_BY_MODE) ── */
export const IMPORT_COLUMNS_BY_MODE: Record<TrackingMode, ImportColumn[]> = {
  serialized: [
    { key: "serialNumber", label: "Serial Number", required: true, width: 200, kind: "text" },
    { key: "price", label: "Price", width: 130, kind: "price" },
    { key: "location", label: "Location", required: true, width: 200, kind: "location" },
    { key: "reason", label: "Reason", width: 180, kind: "reason" },
  ],
  "non-serialized": [
    { key: "qty", label: "Qty", required: true, width: 130, kind: "qty" },
    { key: "uom", label: "UoM", required: true, width: 110, kind: "uom" },
    { key: "price", label: "Price", width: 130, kind: "price" },
    { key: "location", label: "Location", required: true, width: 200, kind: "location" },
    { key: "reason", label: "Reason", width: 180, kind: "reason" },
  ],
  "lot-serialized": [
    { key: "lotNumber", label: "LOT Number", required: true, width: 180, kind: "text" },
    { key: "serialNumber", label: "Serial Number", required: true, width: 200, kind: "text" },
    { key: "price", label: "Price", width: 130, kind: "price" },
    { key: "location", label: "Location", required: true, width: 200, kind: "location" },
    { key: "reason", label: "Reason", width: 180, kind: "reason" },
  ],
  lot: [
    { key: "lotNumber", label: "LOT Number", required: true, width: 180, kind: "text" },
    { key: "qty", label: "Qty", required: true, width: 130, kind: "qty" },
    { key: "uom", label: "UoM", required: true, width: 110, kind: "uom" },
    { key: "price", label: "Price", width: 130, kind: "price" },
    { key: "location", label: "Location", required: true, width: 200, kind: "location" },
    { key: "reason", label: "Reason", width: 180, kind: "reason" },
  ],
};

/* ── Reference data, mirrored from adjust-inventory-modal.tsx ────────
   (those constants are module-private there; importing that module from here
   would also create an import cycle through the wizard). Keep in step. */

/** INCREASE_REASONS. */
export const INCREASE_REASONS: readonly ImportReason[] = [
  { value: "system-startup", label: "System Startup" },
  { value: "found", label: "Found Item" },
];

/** EXISTING_SERIAL_NUMBERS. */
export const EXISTING_SERIALS: readonly string[] = [
  "SN-1000", "SN-1001", "SN-1002", "SN-1003", "SN-1004", "SN-1005",
  "SN-1006", "SN-1007", "SN-1008", "SN-1009", "SN-1010",
  "SN-2000", "SN-2001", "SN-2002", "SN-2003",
  "SN-3000", "SN-3001", "SN-3002",
];

/** LOT_OPTIONS with EXISTING_LOT_UOM and EXISTING_LOT_PRICE. */
export const EXISTING_LOTS: readonly ExistingLot[] = [
  { lot: "LOT-112000", uom: "EA", price: "24.50" },
  { lot: "LOT-112001", uom: "Boxes", price: "24.50" },
  { lot: "LOT-112002", uom: "Carton", price: "24.50" },
];

/** LOCATION_OPTIONS codes: every location row plus the extra pick-list codes. */
export const KNOWN_LOCATIONS: readonly string[] = [
  ...locationRows.filter((r) => r.type === "location").map((r) => r.locationCode),
  "Zone B-03", "Zone C-11", "Zone TR-012", "Staging-1", "Dock-2A", "WH1-1-L2",
];

const isSerialMode = (mode: TrackingMode) => mode === "serialized" || mode === "lot-serialized";

/** The context the Increase form itself validates against, for this control type. */
export function defaultImportContext(mode: TrackingMode, knownLocations: readonly string[] = KNOWN_LOCATIONS): ImportValidationContext {
  return {
    mode,
    knownLocations,
    existingSerials: EXISTING_SERIALS,
    existingLots: EXISTING_LOTS,
    reasons: INCREASE_REASONS,
    uoms: isSerialMode(mode) ? [SERIALIZED_UOM] : ALL_UOM_OPTIONS,
  };
}

/* ── Helpers ─────────────────────────────────────────────────────────── */

const norm = (v: string | undefined) => String(v ?? "").trim();
const lower = (v: string | undefined) => norm(v).toLowerCase();

/** "1,250" and "$24.50" read as numbers; anything else is NaN. */
export function parseImportNumber(raw: string): number {
  const cleaned = norm(raw).replace(/[$,\s]/g, "");
  if (!cleaned || !/^[-+]?\d*\.?\d+$/.test(cleaned)) return NaN;
  return Number(cleaned);
}

function orList(options: readonly string[]): string {
  if (options.length <= 1) return options.join("");
  if (options.length === 2) return `${options[0]} or ${options[1]}`;
  return `${options.slice(0, -1).join(", ")}, or ${options[options.length - 1]}`;
}

/** Messages name at most five values; the tooltip carries the full list. */
function someOf(options: readonly string[]): string {
  return options.length > 5 ? `${options.slice(0, 5).join(", ")}, or another value from the Valid Values sheet` : orList(options);
}

function rowsText(rows: number[]): string {
  if (rows.length === 1) return `row ${rows[0]}`;
  return `rows ${rows.slice(0, -1).join(", ")} and ${rows[rows.length - 1]}`;
}

/* ── Validation ──────────────────────────────────────────────────────── */

/**
 * Validate every row of an import. Row numbers in messages are 1-based
 * positions in `rows`, the same numbers the review grid shows.
 */
export function validateImportRows(
  rows: Record<string, string>[],
  columns: ImportColumn[],
  ctx: ImportValidationContext,
): ImportRowValidation[] {
  const keys = new Set(columns.map((c) => c.key));
  const label = (key: string) => columns.find((c) => c.key === key)?.label ?? key;
  const hasSerial = keys.has("serialNumber");
  const hasLot = keys.has("lotNumber");
  const lotValued = ctx.mode === "lot"; // a plain lot is valued as a whole

  const existingSerials = new Set(ctx.existingSerials.map((s) => norm(s)));
  const lotsByKey = new Map(ctx.existingLots.map((l) => [lower(l.lot), l]));
  const locations = ctx.knownLocations.map(norm);
  const locationSet = new Set(locations.map((l) => l.toLowerCase()));
  const uomByLower = new Map(ctx.uoms.map((u) => [u.toLowerCase(), u]));
  const reasonLabels = ctx.reasons.map((r) => r.label);
  const reasonSet = new Set(ctx.reasons.flatMap((r) => [r.label.toLowerCase(), r.value.toLowerCase()]));

  /* Cross-row lookups. */
  const serialRows = new Map<string, number[]>();
  const newLotUoms = new Map<string, Map<string, number[]>>();
  rows.forEach((r, i) => {
    if (hasSerial) {
      const sn = norm(r.serialNumber);
      if (sn) serialRows.set(sn, [...(serialRows.get(sn) ?? []), i + 1]);
    }
    if (hasLot && keys.has("uom")) {
      const lot = lower(r.lotNumber);
      const uom = uomByLower.get(lower(r.uom));
      if (lot && uom && !lotsByKey.has(lot)) {
        const byUom = newLotUoms.get(lot) ?? new Map<string, number[]>();
        byUom.set(uom, [...(byUom.get(uom) ?? []), i + 1]);
        newLotUoms.set(lot, byUom);
      }
    }
  });

  return rows.map((row, i) => {
    const issues: Record<string, ImportIssue[]> = {};
    const push = (field: string, severity: ImportIssue["severity"], code: IssueCode, message: string, explanation: string, extra: Partial<ImportIssue> = {}) => {
      (issues[field] ??= []).push({ field, severity, code, message, explanation, ...extra });
    };
    const rowNo = i + 1;

    for (const col of columns) {
      const raw = norm(row[col.key]);
      if (!raw) {
        if (col.required) {
          push(col.key, "error", "REQUIRED_EMPTY", `${col.label} is required and cannot be empty.`, `Every row needs a ${col.label}. Fill it in, or delete the row if it should not be imported.`, {
            example: exampleFor(col, ctx),
          });
        }
        continue;
      }

      switch (col.key) {
        case "serialNumber": {
          if (existingSerials.has(raw)) {
            push(col.key, "error", "SERIAL_EXISTS", `Serial number ${raw} is already in use in Omne.`, "Each serial number belongs to one unit. Enter the serial number printed on this unit, or remove the row if the unit is already in stock.", { example: "SN-4001" });
          }
          const others = (serialRows.get(raw) ?? []).filter((n) => n !== rowNo);
          if (others.length > 0) {
            push(col.key, "error", "DUPLICATE_SERIAL", `Duplicate serial number. ${raw} also appears in ${rowsText(others)}.`, "A serial number can only be added once. Keep it on one row and correct or delete the others.");
          }
          break;
        }
        case "lotNumber": {
          if (!lotsByKey.has(raw.toLowerCase())) {
            push(col.key, "warning", "NEW_LOT", `${raw} is not a LOT on this item yet. It will be created as a new LOT.`, "Rows are added to an existing LOT when the LOT number matches one on this item. Any other LOT number creates a new LOT. Check the spelling if you meant an existing LOT.", {
              example: ctx.existingLots[0]?.lot,
              options: ctx.existingLots.map((l) => l.lot),
            });
          }
          break;
        }
        case "qty": {
          const n = parseImportNumber(raw);
          if (Number.isNaN(n)) {
            push(col.key, "error", "INVALID_NUMBER", `${col.label} "${raw}" is not a number.`, "Enter the quantity to add as a number, for example 100 or 1,250.", { example: "100" });
          } else if (n <= 0) {
            push(col.key, "error", "NOT_POSITIVE", `${col.label} must be greater than 0.`, "An increase adds stock, so the quantity must be more than zero. Use a decrease adjustment to remove stock.", { example: "100" });
          }
          break;
        }
        case "uom": {
          const uom = uomByLower.get(raw.toLowerCase());
          if (!uom) {
            push(col.key, "error", "INVALID_UOM", `"${raw}" is not a unit this item is counted in. Use ${someOf(ctx.uoms)}.`, "The unit must be one of the units of measure set up for this item.", {
              example: ctx.uoms[0],
              options: [...ctx.uoms],
            });
            break;
          }
          if (hasLot) {
            const lot = lotsByKey.get(lower(row.lotNumber));
            if (lot && lot.uom.toLowerCase() !== uom.toLowerCase()) {
              push(col.key, "error", "LOT_UOM_MISMATCH", `${lot.lot} is held in ${lot.uom}, not ${uom}.`, "One LOT is held in one unit of measure. Enter the quantity in the LOT's own unit, or use a new LOT number for stock in another unit.", { example: lot.uom });
            }
            const byUom = newLotUoms.get(lower(row.lotNumber));
            if (!lot && byUom && byUom.size > 1) {
              const otherRows = [...byUom.entries()].filter(([u]) => u !== uom).flatMap(([, rs]) => rs);
              push(col.key, "error", "LOT_UOM_CONFLICT", `${norm(row.lotNumber)} uses ${uom} here but a different unit in ${rowsText(otherRows)}.`, "A new LOT takes one unit of measure. Use the same unit on every row of this LOT, or give the rows different LOT numbers.", {
                example: [...byUom.keys()][0],
              });
            }
          }
          break;
        }
        case "price": {
          const n = parseImportNumber(raw);
          if (Number.isNaN(n)) {
            push(col.key, "error", "INVALID_NUMBER", `${col.label} "${raw}" is not a number.`, "Enter the unit price as a number, for example 24.50. Leave it blank if there is no price.", { example: "24.50" });
            break;
          }
          if (n < 0) {
            push(col.key, "error", "NEGATIVE_PRICE", `${col.label} cannot be below 0.`, "Enter the unit price as zero or more.", { example: "24.50" });
            break;
          }
          if (lotValued && hasLot) {
            const lot = lotsByKey.get(lower(row.lotNumber));
            if (lot?.price !== undefined && parseImportNumber(lot.price) !== n) {
              push(col.key, "warning", "PRICE_SET_BY_LOT", `The price of ${lot.lot} is set by the LOT (${lot.price}). This price will be ignored.`, "Stock added to an existing LOT takes the LOT's price. Leave the price blank for existing LOTs, or use a new LOT number to record a different price.", {
                example: lot.price,
              });
            }
          }
          break;
        }
        case "location": {
          if (locationSet.size > 0 && !locationSet.has(raw.toLowerCase())) {
            push(col.key, "error", "LOCATION_NOT_FOUND", `Location "${raw}" does not exist in Omne. Use a location from the Valid Values sheet, such as ${someOf(locations.slice(0, 2))}.`, "Stock is added to a location that already exists. Pick one from the Valid Values sheet, or create the location in Warehouse Structure first.", {
              example: locations[0],
              options: [...locations],
            });
          }
          break;
        }
        case "reason": {
          if (!reasonSet.has(raw.toLowerCase())) {
            push(col.key, "warning", "INVALID_REASON", `"${raw}" is not an increase reason. The row will import without a reason. Use ${someOf(reasonLabels)}.`, "The reason says why stock is being added. It is optional; an unrecognised reason is left blank.", {
              example: reasonLabels[0],
              options: reasonLabels,
            });
          }
          break;
        }
      }
    }

    for (const list of Object.values(issues)) list.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "error" ? -1 : 1));
    const all = Object.values(issues).flat();
    const status: RowStatus = all.some((x) => x.severity === "error") ? "error" : all.length ? "warning" : "ready";
    return { status, issues };
  });
}

/** A value that passes for a column, used as the example in issues and templates. */
export function exampleFor(col: ImportColumn, ctx: ImportValidationContext): string {
  switch (col.kind) {
    case "qty": return "100";
    case "uom": return ctx.uoms[0] ?? "EA";
    case "price": return "24.50";
    case "location": return ctx.knownLocations[0] ?? "Zone A-01";
    case "reason": return ctx.reasons[0]?.label ?? "";
    default: return col.key === "lotNumber" ? (ctx.existingLots[0]?.lot ?? "LOT-112000") : "SN-4001";
  }
}

/** Every IssueCode a mode's columns can raise. */
export function reachableCodes(mode: TrackingMode): IssueCode[] {
  const common: IssueCode[] = ["REQUIRED_EMPTY", "INVALID_NUMBER", "NEGATIVE_PRICE", "LOCATION_NOT_FOUND", "INVALID_REASON"];
  switch (mode) {
    case "serialized": return [...common, "DUPLICATE_SERIAL", "SERIAL_EXISTS"];
    case "lot-serialized": return [...common, "DUPLICATE_SERIAL", "SERIAL_EXISTS", "NEW_LOT"];
    case "non-serialized": return [...common, "NOT_POSITIVE", "INVALID_UOM"];
    case "lot": return [...common, "NOT_POSITIVE", "INVALID_UOM", "NEW_LOT", "LOT_UOM_MISMATCH", "LOT_UOM_CONFLICT", "PRICE_SET_BY_LOT"];
  }
}
