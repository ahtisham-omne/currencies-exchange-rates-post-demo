/* Shared types and helpers for per-record Roles import data.
 *
 * Mirrors importRecords.ts (the Users module) one-to-one. The Import History
 * listing, the Roles Import Detail page, and the persistence store all need
 * to agree on one shape for an imported role record. This module is the
 * single source for that shape (and for the column layout that backs both
 * the on-screen table and the CSV / Excel exports).
 *
 * The outcome/filter helpers and download metadata are re-exported from
 * importRecords.ts, they're record-shape-agnostic, and sharing them keeps
 * the two modules from drifting. */

import type { RowOutcome, RowFilter, ImportColumn } from "./importRecords";
export { DOWNLOAD_META, importNameToFilenameStem, isImported, isFailed } from "./importRecords";
export type { RowOutcome, RowFilter } from "./importRecords";

export interface ImportedRoleRow {
  // 4 fields from the Roles template. Each is a plain string so a failed or
  // skipped row keeps exactly the value the user uploaded, the value that
  // produced its validation error.
  roleName: string;
  description: string;
  roleOwner: string;
  assignedUsers: string;
  // Audit metadata
  _row: number;
  _outcome: RowOutcome;
  _message?: string;
}

export interface RolesImportColumn extends Omit<ImportColumn, "key"> {
  key: keyof ImportedRoleRow;
}

export const ROLES_IMPORT_RECORD_COLUMNS: RolesImportColumn[] = [
  { key: "roleName",      label: "Role Name",      width: 200 },
  { key: "description",   label: "Description",    width: 280 },
  { key: "roleOwner",     label: "Role Owner",     width: 220, mono: true },
  { key: "assignedUsers", label: "Assigned Users", width: 260, mono: true },
];

export function countRoleOutcomes(rows: ImportedRoleRow[]): { all: number; imported: number; failed: number } {
  let imported = 0;
  let failed = 0;
  for (const r of rows) {
    if (r._outcome === "Created") imported++;
    else if (r._outcome === "Failed" || r._outcome === "Skipped") failed++;
  }
  return { all: rows.length, imported, failed };
}
