/* Provenance: your-invoice-mate/src/app/components/import-adjustment/types.ts
 * sha256 9924d5a8b1e60636bf0437e93ef930da2ba4acdbe7b9e42198c71798f50f4814
 * Copied into role-zen 2026-09-30. Verbatim. */
/* Shared types for the Adjust Inventory > Import flow (increase adjustments).
 * TrackingMode and ImportColumn match import-adjustment-wizard.tsx exactly, so
 * the wizard can switch to these without changing its column configs. */

export type TrackingMode = "non-serialized" | "serialized" | "lot" | "lot-serialized";

export interface ImportColumn {
  key: string;
  label: string;
  required?: boolean;
  width: number;
  kind: "text" | "qty" | "uom" | "price" | "location" | "reason";
}

export type RowStatus = "ready" | "warning" | "error";

export type IssueSeverity = "error" | "warning";

export type IssueCode =
  /** A required column is blank. */
  | "REQUIRED_EMPTY"
  /** The same serial number appears on more than one row of the file. */
  | "DUPLICATE_SERIAL"
  /** The serial number is already in use in Omne. */
  | "SERIAL_EXISTS"
  /** Qty or Price is not a number. */
  | "INVALID_NUMBER"
  /** Qty is zero or negative. */
  | "NOT_POSITIVE"
  /** Price is below zero. */
  | "NEGATIVE_PRICE"
  /** UoM is not a unit this item can be counted in. */
  | "INVALID_UOM"
  /** Location is not a location in Omne. */
  | "LOCATION_NOT_FOUND"
  /** Reason is not an increase reason; the row imports without one. */
  | "INVALID_REASON"
  /** LOT number is not an existing LOT; a new LOT is created. */
  | "NEW_LOT"
  /** UoM differs from the unit an existing LOT is held in. */
  | "LOT_UOM_MISMATCH"
  /** Rows for the same new LOT use different units. */
  | "LOT_UOM_CONFLICT"
  /** A price given for an existing LOT; the LOT's price is kept. */
  | "PRICE_SET_BY_LOT";

export interface ImportIssue {
  field: string;
  severity: IssueSeverity;
  code: IssueCode;
  /** One line for the cell and the error reason row. */
  message: string;
  /** Longer guide copy for the issue tooltip. */
  explanation: string;
  /** A value that would pass, when one exists. */
  example?: string;
  /** The accepted values, when the column has a fixed vocabulary (the UI shows at most five). */
  options?: string[];
}

export interface ImportRowValidation {
  status: RowStatus;
  /** Issues per column key, errors first. */
  issues: Record<string, ImportIssue[]>;
}

export interface ExistingLot {
  lot: string;
  /** One LOT is held in one unit of measure. */
  uom: string;
  /** Unit price already recorded against the LOT. */
  price?: string;
}

export interface ImportReason {
  value: string;
  label: string;
}

export interface ImportValidationContext {
  mode: TrackingMode;
  /** Location codes Omne holds. Empty means locations are not checked. */
  knownLocations: readonly string[];
  /** Serial numbers already in use. */
  existingSerials: readonly string[];
  /** LOTs already on this item. */
  existingLots: readonly ExistingLot[];
  /** Increase reasons (value + label; either spelling is accepted). */
  reasons: readonly ImportReason[];
  /** Units this item can be counted in. */
  uoms: readonly string[];
}
