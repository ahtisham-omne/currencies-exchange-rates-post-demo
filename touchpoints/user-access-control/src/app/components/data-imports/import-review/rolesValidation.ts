/* Validation rules for the Roles import review step. Mirrors validation.ts
 * (the Users rule set) one-to-one: same severity model, same row-status
 * derivation, same upsert determination, with the rules mapped onto role
 * data. Role Name is the matching key (the analogue of the Users flow's
 * email address). */

import type { RoleReviewField, RoleReviewRow } from "./rolesReviewData";

export type RoleIssueSeverity = "error" | "warning";

/* The defined set of validation rules, nothing else runs. */
export type RoleIssueCode =
  | "REQUIRED_EMPTY"
  | "DUPLICATE_ROLE_NAME"
  | "SYSTEM_ROLE"
  | "OWNER_NOT_FOUND"
  | "USER_NOT_FOUND";

export interface RoleCellIssue {
  code: RoleIssueCode;
  severity: RoleIssueSeverity;
  field: RoleReviewField;
  message: string;
}

export type RoleRowStatus = "ready" | "warning" | "error";

export interface RoleRowValidation {
  status: RoleRowStatus;
  issues: RoleCellIssue[];
  /** Map of field → issues (so a cell can have multiple). */
  byField: Partial<Record<RoleReviewField, RoleCellIssue[]>>;
  /** True when the row's name matches a custom role already in the listing,
   *  the row will update that role on import rather than create a new one.
   *  Tracked outside of the issue list so the upsert flow keeps working
   *  without emitting a per-cell warning indicator. */
  isUpdate: boolean;
}

export interface RoleValidationResult {
  rows: RoleRowValidation[];
  errorRowCount: number;
  warningRowCount: number;
  readyRowCount: number;
  /** Number of ready/warning rows that will update an existing role. */
  updateRowCount: number;
  /** Number of ready/warning rows that will create a new role. */
  createRowCount: number;
}

export interface RoleValidationContext {
  /** Lower-cased names of roles already in the listing. Used to decide
   *  whether a row will create or update, never to flag a warning. */
  existingRoleNames?: Set<string>;
  /** Lower-cased names of predefined system roles, rows matching one of
   *  these fail validation, since system roles can't be changed by import. */
  systemRoleNames?: Set<string>;
  /** Lower-cased emails of users already in the listing. Used for the
   *  user-not-found warning on Assigned Users. */
  existingUserEmails?: Set<string>;
  /** Lower-cased full names of users already in the listing. Role Owner
   *  accepts either an email or a full name. */
  existingUserNames?: Set<string>;
}

const FIELD_LABELS: Partial<Record<RoleReviewField, string>> = {
  roleName: "Role Name",
};

export function validateRoleRows(
  rows: RoleReviewRow[],
  ctx: RoleValidationContext = {},
): RoleValidationResult {
  const existingRoleNames = ctx.existingRoleNames ?? new Set<string>();
  const systemRoleNames = ctx.systemRoleNames ?? new Set<string>();
  const existingUserEmails = ctx.existingUserEmails;
  const existingUserNames = ctx.existingUserNames;

  /* Build lookup tables once */
  const nameToRowNumbers = new Map<string, number[]>();

  rows.forEach((r, i) => {
    const name = r.roleName.trim().toLowerCase();
    if (!name) return;
    const arr = nameToRowNumbers.get(name);
    if (arr) arr.push(i + 1);
    else nameToRowNumbers.set(name, [i + 1]);
  });

  const perRow: RoleRowValidation[] = rows.map((r, i) => {
    const issues: RoleCellIssue[] = [];
    const rowNumber = i + 1;

    /* 1a. REQUIRED_EMPTY, role name. Required on every row: it's the
     * matching key that decides create vs update. */
    const name = r.roleName.trim();
    if (!name) {
      issues.push({
        code: "REQUIRED_EMPTY",
        severity: "error",
        field: "roleName",
        message: `${FIELD_LABELS.roleName} is required and cannot be empty.`,
      });
    }

    /* 2. DUPLICATE_ROLE_NAME, only when the name is otherwise present */
    if (name) {
      const matches = nameToRowNumbers.get(name.toLowerCase()) ?? [];
      if (matches.length > 1) {
        const otherRows = matches.filter((n) => n !== rowNumber);
        const otherRowLabel = otherRows.length === 1
          ? String(otherRows[0])
          : otherRows.join(", ");
        issues.push({
          code: "DUPLICATE_ROLE_NAME",
          severity: "error",
          field: "roleName",
          message: `Duplicate role name. This name also appears in row ${otherRowLabel}.`,
        });
      }
    }

    /* 3. SYSTEM_ROLE, a name matching a predefined system role fails: those
     * roles are shipped and maintained by Omne and can't be created or
     * changed by an import. */
    if (name && systemRoleNames.has(name.toLowerCase())) {
      issues.push({
        code: "SYSTEM_ROLE",
        severity: "error",
        field: "roleName",
        message: `"${name}" is a predefined system role and cannot be changed by an import. Use a different name.`,
      });
    }

    /* Upsert determination, needed before the remaining required-field
     * checks because update rows (name matches an existing custom role)
     * require only the name itself. The name is purely the matching key: it
     * is never changed by an import, and a row whose name matches nothing is
     * a create even if it was meant to be a renamed role. Rows whose name
     * has an error can't be matched, so they validate as creates. Also
     * drives the created-vs-updated counts in the completion modal and the
     * host's update path; intentionally NOT emitted as a warning, since the
     * existing-role case isn't a problem the user needs to act on. */
    const hasNameError = issues.some(
      (x) => x.field === "roleName" && x.severity === "error",
    );
    const isUpdate = !!name && !hasNameError && existingRoleNames.has(name.toLowerCase());

    /* 4. OWNER_NOT_FOUND, warning; the owner can be an email or a full
     * name, checked against the existing users listing. */
    const owner = r.roleOwner.trim().toLowerCase();
    if (owner && (existingUserEmails || existingUserNames)) {
      const inEmails = existingUserEmails?.has(owner) ?? false;
      const inNames = existingUserNames?.has(owner) ?? false;
      if (!inEmails && !inNames) {
        issues.push({
          code: "OWNER_NOT_FOUND",
          severity: "warning",
          field: "roleOwner",
          message:
            "Role owner not found in Omne. The role will import without an owner, you can set it later.",
        });
      }
    }

    /* 5. USER_NOT_FOUND, warning when one or more pipe-separated assigned
     * user emails don't match a user that exists in Omne. The role still
     * imports; the unknown users just won't be assigned. */
    const assigned = r.assignedUsers.trim();
    if (assigned && existingUserEmails && existingUserEmails.size > 0) {
      const declared = assigned
        .split("|")
        .map((s) => s.trim())
        .filter(Boolean);
      const unknown = declared.filter((email) => !existingUserEmails.has(email.toLowerCase()));
      if (unknown.length > 0) {
        const list = unknown.length === 1
          ? `"${unknown[0]}"`
          : unknown.length === 2
            ? `"${unknown[0]}" and "${unknown[1]}"`
            : `"${unknown[0]}", "${unknown[1]}", and ${unknown.length - 2} more`;
        issues.push({
          code: "USER_NOT_FOUND",
          severity: "warning",
          field: "assignedUsers",
          message:
            unknown.length === 1
              ? `User ${list} doesn't exist in Omne. The role will import without this user.`
              : `Users ${list} don't exist in Omne. The role will import without these users.`,
        });
      }
    }

    /* Group by field for fast cell lookup */
    const byField: Partial<Record<RoleReviewField, RoleCellIssue[]>> = {};
    for (const issue of issues) {
      const bucket = byField[issue.field] ?? [];
      bucket.push(issue);
      byField[issue.field] = bucket;
    }

    const hasError = issues.some((x) => x.severity === "error");
    const hasWarning = issues.some((x) => x.severity === "warning");
    const status_: RoleRowStatus = hasError ? "error" : hasWarning ? "warning" : "ready";

    return { status: status_, issues, byField, isUpdate };
  });

  let errorRowCount = 0;
  let warningRowCount = 0;
  let readyRowCount = 0;
  let updateRowCount = 0;
  let createRowCount = 0;
  for (const r of perRow) {
    if (r.status === "error") errorRowCount++;
    else if (r.status === "warning") warningRowCount++;
    else readyRowCount++;
    if (r.status !== "error") {
      if (r.isUpdate) updateRowCount++;
      else createRowCount++;
    }
  }

  return {
    rows: perRow,
    errorRowCount,
    warningRowCount,
    readyRowCount,
    updateRowCount,
    createRowCount,
  };
}
