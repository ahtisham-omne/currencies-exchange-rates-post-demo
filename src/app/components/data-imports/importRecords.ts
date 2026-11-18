/* Shared types and helpers for per-record import data.
 *
 * The Import History listing, the Import Detail page, and the persistence
 * store all need to agree on one shape for an imported record. This module
 * is the single source for that shape (and for the column layout that backs
 * both the on-screen table and the CSV / Excel exports). */

export type RowOutcome = "Created" | "Skipped" | "Failed";

/* The detail-page filter collapses "Created" into Imported, and folds Skipped
 * and Failed together into Failed, admins triaging a partial import don't
 * care about the distinction between a row that hit a validator failure and
 * one they skipped in the review modal; both need the same follow-up pass. */
export type RowFilter = "all" | "imported" | "failed";

export interface ImportedUserRow {
  // 18 fields from the Users template. License / status / gender stay plain
  // strings so a failed or skipped row keeps exactly the value the user
  // uploaded, the value that produced its validation error. Valid values
  // are "Full Access" | "Field User" | "No License" (license) and
  // "Active" | "Inactive" (status), enforced by validation, not the type.
  firstName: string;
  lastName: string;
  emailAddress: string;
  licenseType: string;
  employeeStatus: string;
  assignedRoles: string;
  username: string;
  gender: string;
  dateOfBirth: string;
  preferredName: string;
  pronouns: string;
  jobTitle: string;
  personalEmail: string;
  mobile: string;
  workPhone: string;
  homeAddress: string;
  workAddress: string;
  // Audit metadata
  _row: number;
  _outcome: RowOutcome;
  _message?: string;
}

export interface ImportColumn {
  key: keyof ImportedUserRow;
  label: string;
  width: number;
  mono?: boolean;
}

export const IMPORT_RECORD_COLUMNS: ImportColumn[] = [
  { key: "firstName",        label: "First Name",         width: 130 },
  { key: "lastName",         label: "Last Name",          width: 130 },
  { key: "emailAddress",     label: "Email Address",      width: 220, mono: true },
  { key: "licenseType",      label: "License Type",       width: 130 },
  { key: "employeeStatus",   label: "Status",             width: 100 },
  { key: "assignedRoles",    label: "Assigned Roles",     width: 220 },
  { key: "username",         label: "Username",           width: 140, mono: true },
  { key: "gender",           label: "Gender",             width: 130 },
  { key: "dateOfBirth",      label: "Date of Birth",      width: 130 },
  { key: "preferredName",    label: "Preferred Name",     width: 140 },
  { key: "pronouns",         label: "Pronouns",           width: 120 },
  { key: "jobTitle",         label: "Job Title",          width: 200 },
  { key: "personalEmail",    label: "Personal Email",     width: 240, mono: true },
  { key: "mobile",           label: "Mobile",             width: 160 },
  { key: "workPhone",        label: "Work Phone",         width: 180 },
  { key: "homeAddress",      label: "Home Address",       width: 280 },
  { key: "workAddress",      label: "Work Address",       width: 280 },
];

export function isImported(o: RowOutcome): boolean {
  return o === "Created";
}

export function isFailed(o: RowOutcome): boolean {
  return o === "Failed" || o === "Skipped";
}

export function countOutcomes(rows: ImportedUserRow[]): { all: number; imported: number; failed: number } {
  let imported = 0;
  let failed = 0;
  for (const r of rows) {
    if (isImported(r._outcome)) imported++;
    else if (isFailed(r._outcome)) failed++;
  }
  return { all: rows.length, imported, failed };
}

/** Slugify an import name into a safe filename stem. The spec example
 *  "Q2_New_Hires_2026_failed.csv" uses underscores between words and between
 *  the name and the filter suffix, we match that convention here. */
export function importNameToFilenameStem(name: string): string {
  return name
    .trim()
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "import";
}

/* Per-filter labels and file suffix. The header label is sentence case per
 * the spec ("Download all records" etc.); the file suffix matches the
 * example "Q2_New_Hires_2026_failed.csv". */
export const DOWNLOAD_META: Record<
  RowFilter,
  { downloadLabel: string; exportLabel: string; fileSuffix: string }
> = {
  all: {
    downloadLabel: "Download All Records",
    exportLabel: "Export Selected Records",
    fileSuffix: "all",
  },
  imported: {
    downloadLabel: "Download Imported Records",
    exportLabel: "Export Selected Records",
    fileSuffix: "imported",
  },
  /* "Download and Reimport Failed Records" promised two actions and only
   * performed one. The menu behind this label now genuinely carries both
   * halves of the loop (download the error file, upload the corrected one),
   * so the trigger names the subject rather than one of the verbs. It is the
   * header control on every filter, not just Failed, because correcting errors
   * is not a property of whichever tab the table happens to be showing. */
  failed: {
    downloadLabel: "Fix Error Rows Manually",
    exportLabel: "Export Selected Records",
    fileSuffix: "failed",
  },
};
