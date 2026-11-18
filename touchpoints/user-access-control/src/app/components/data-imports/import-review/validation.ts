import type { UserReviewField, UserReviewRow } from "./usersReviewMockData";

export type IssueSeverity = "error" | "warning";

/* The defined set of validation rules, nothing else runs. Date of birth is
 * deliberately absent: dates import exactly as they appear in the file and
 * never produce an error or warning. */
export type IssueCode =
  | "REQUIRED_EMPTY"
  | "INVALID_EMAIL"
  | "INVALID_DROPDOWN"
  | "MISSING_LICENSE"
  | "DUPLICATE_EMAIL"
  | "INVALID_PHONE"
  | "ROLE_NOT_FOUND";

export interface CellIssue {
  code: IssueCode;
  severity: IssueSeverity;
  field: UserReviewField;
  message: string;
}

export type RowStatus = "ready" | "warning" | "error";

export interface RowValidation {
  status: RowStatus;
  issues: CellIssue[];
  /** Map of field → issues (so a cell can have multiple). */
  byField: Partial<Record<UserReviewField, CellIssue[]>>;
  /** True when the row's email matches a user already in the listing, the
   *  row will update that user on import rather than create a new one.
   *  Tracked outside of the issue list so the upsert flow keeps working
   *  without emitting a per-cell warning indicator. */
  isUpdate: boolean;
}

export interface ValidationResult {
  rows: RowValidation[];
  errorRowCount: number;
  warningRowCount: number;
  readyRowCount: number;
  /** Number of ready/warning rows that will update an existing user. */
  updateRowCount: number;
  /** Number of ready/warning rows that will create a new user. */
  createRowCount: number;
}

export interface ValidationContext {
  /** Lower-cased emails of users already in the listing. Used to decide
   *  whether a row will create or update, never to flag a warning. */
  existingEmails?: Set<string>;
  /** Lower-cased role names that exist in Omne. Used for the role-not-found
   *  warning. */
  knownRoles?: Set<string>;
}

const VALID_LICENSE_TYPES = ["Full Access", "Field User", "No License"];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* Phone: anything except optional leading +, digits, spaces, dashes, parens,
 * dots, and "x"/"ext" for extensions. We also require 7–15 digits (E.164
 * max length). */
const PHONE_ALLOWED_CHARS = /^[+0-9 .\-()xX]*(?:\s*(?:ext\.?|extension|x)\s*\d+)?$/i;
const PHONE_DIGIT_REGEX = /\d/g;

const FIELD_LABELS: Partial<Record<UserReviewField, string>> = {
  firstName: "First Name",
  lastName: "Last Name",
  emailAddress: "Email Address",
  licenseType: "License Type",
};

/* Required fields for CREATE rows (rows whose email doesn't match an existing
 * user). Update rows require email alone: every other field is optional and a
 * blank leaves the existing user's data unchanged.
 *
 * This list mirrors the template, which is the contract the customer is given.
 * OMNE_Users_Import_Template.csv marks exactly three headers with an asterisk,
 * and OMNE_Users_Import_Guide.txt says so twice: "The CSV has 3 required
 * columns and 26 optional ones", and "The three required columns are marked
 * with an asterisk and cannot be left blank: First Name, Last Name, Email."
 * Email is checked separately below because it is required on every row, not
 * just creates.
 *
 * Status is absent on purpose and the template agrees: blank status is valid
 * on every row. License is absent on purpose too, see the warning rule below,
 * it is optional and never blocks a row. */
const CREATE_REQUIRED_FIELDS: UserReviewField[] = [
  "firstName",
  "lastName",
];

function isUnusualPhone(value: string): boolean {
  if (!value) return false;
  if (!PHONE_ALLOWED_CHARS.test(value)) return true;
  const digits = (value.match(PHONE_DIGIT_REGEX) ?? []).length;
  return digits < 7 || digits > 15;
}

export function validateRows(
  rows: UserReviewRow[],
  ctx: ValidationContext = {},
): ValidationResult {
  const existingEmails = ctx.existingEmails ?? new Set<string>();
  const knownRoles = ctx.knownRoles;

  /* Build lookup tables once */
  const emailToRowNumbers = new Map<string, number[]>();

  rows.forEach((r, i) => {
    const email = r.emailAddress.trim().toLowerCase();
    if (!email) return;
    const arr = emailToRowNumbers.get(email);
    if (arr) arr.push(i + 1);
    else emailToRowNumbers.set(email, [i + 1]);
  });

  const perRow: RowValidation[] = rows.map((r, i) => {
    const issues: CellIssue[] = [];
    const rowNumber = i + 1;

    /* 1a. REQUIRED_EMPTY, email. Email is required on every row: it's the
     * matching key that decides create vs update. */
    const email = r.emailAddress.trim();
    if (!email) {
      issues.push({
        code: "REQUIRED_EMPTY",
        severity: "error",
        field: "emailAddress",
        message: `${FIELD_LABELS.emailAddress} is required and cannot be empty.`,
      });
    }

    /* 2. INVALID_EMAIL */
    if (email && !EMAIL_REGEX.test(email)) {
      issues.push({
        code: "INVALID_EMAIL",
        severity: "error",
        field: "emailAddress",
        message: "Invalid email format. Expected: name@domain.com",
      });
    }

    /* 3. DUPLICATE_EMAIL, only when the email is otherwise present (skip on empty) */
    if (email) {
      const matches = emailToRowNumbers.get(email.toLowerCase()) ?? [];
      if (matches.length > 1) {
        const otherRows = matches.filter((n) => n !== rowNumber);
        const otherRowLabel = otherRows.length === 1
          ? String(otherRows[0])
          : otherRows.join(", ");
        issues.push({
          code: "DUPLICATE_EMAIL",
          severity: "error",
          field: "emailAddress",
          message: `Duplicate email. This address also appears in row ${otherRowLabel}.`,
        });
      }
    }

    /* Upsert determination, needed before the remaining required-field
     * checks because update rows (email matches an existing user) require
     * only the email itself. Email is purely the matching key: it is never
     * changed by an import, and a row whose email matches nothing is a
     * create even if it was meant to be an edited email. Rows whose email
     * has an error can't be matched, so they validate as creates. Also
     * drives the created-vs-updated counts in the completion modal and the
     * host's update path; intentionally NOT emitted as a warning, since the
     * existing-user case isn't a problem the user needs to act on. */
    const hasEmailError = issues.some(
      (x) => x.field === "emailAddress" && x.severity === "error",
    );
    const isUpdate = !!email && !hasEmailError && existingEmails.has(email.toLowerCase());

    /* 1b. REQUIRED_EMPTY, first name and last name. Create rows only: on an
     * update row every non-email field is optional, and a blank simply
     * leaves the existing user's value unchanged. */
    if (!isUpdate) {
      for (const field of CREATE_REQUIRED_FIELDS) {
        const v = String(r[field] ?? "").trim();
        if (!v) {
          issues.push({
            code: "REQUIRED_EMPTY",
            severity: "error",
            field,
            message: `${FIELD_LABELS[field]} is required and cannot be empty.`,
          });
        }
      }
    }

    /* 4. License Type. Optional on every row, so it never blocks one. The
     * template header carries no asterisk and the guide is explicit: "License,
     * Status, and Invite are optional", and for a blank, "New user: treated as
     * No License. Existing user: keeps their current license."
     *
     * Because the import always has a safe landing for this field, both
     * failure modes are warnings rather than errors. The row still imports and
     * the message says exactly what the user will end up with:
     *   - blank on a create row  → the user lands with No License
     *   - unrecognised value     → same landing, plus the accepted values
     * A blank on an update row is silent: it means "leave it alone", which is
     * not something the customer needs to act on. */
    const license = r.licenseType.trim();
    if (!license) {
      if (!isUpdate) {
        issues.push({
          code: "MISSING_LICENSE",
          severity: "warning",
          field: "licenseType",
          message:
            "No license specified. The user will import with No License and cannot act in Omne until one is assigned.",
        });
      }
    } else if (!VALID_LICENSE_TYPES.includes(license)) {
      issues.push({
        code: "INVALID_DROPDOWN",
        severity: "warning",
        field: "licenseType",
        message:
          `"${license}" is not a recognised license type. The user will import with No License. Use Full Access, Field User, or No License.`,
      });
    }

    /* 5. ROLE_NOT_FOUND, warning when one or more pipe-separated roles
     * don't match a role that exists in Omne. The user still imports; the
     * unknown role just won't be applied. */
    const roles = r.assignedRoles.trim();
    if (roles && knownRoles && knownRoles.size > 0) {
      const declared = roles
        .split("|")
        .map((s) => s.trim())
        .filter(Boolean);
      const unknown = declared.filter((name) => !knownRoles.has(name.toLowerCase()));
      if (unknown.length > 0) {
        const list = unknown.length === 1
          ? `"${unknown[0]}"`
          : unknown.length === 2
            ? `"${unknown[0]}" and "${unknown[1]}"`
            : `"${unknown[0]}", "${unknown[1]}", and ${unknown.length - 2} more`;
        issues.push({
          code: "ROLE_NOT_FOUND",
          severity: "warning",
          field: "assignedRoles",
          message:
            unknown.length === 1
              ? `Role ${list} doesn't exist in Omne. The user will import without this role.`
              : `Roles ${list} don't exist in Omne. The user will import without these roles.`,
        });
      }
    }

    /* 7. INVALID_PHONE, warning if mobile or work phone is in an unusual
     * format. Imports as-is; the customer can clean it up later. */
    const mobile = r.mobile.trim();
    if (mobile && isUnusualPhone(mobile)) {
      issues.push({
        code: "INVALID_PHONE",
        severity: "warning",
        field: "mobile",
        message:
          "Mobile number is in an unusual format. It will import as-is, you can clean it up later.",
      });
    }
    const workPhone = r.workPhone.trim();
    if (workPhone && isUnusualPhone(workPhone)) {
      issues.push({
        code: "INVALID_PHONE",
        severity: "warning",
        field: "workPhone",
        message:
          "Work phone is in an unusual format. It will import as-is, you can clean it up later.",
      });
    }

    /* Group by field for fast cell lookup */
    const byField: Partial<Record<UserReviewField, CellIssue[]>> = {};
    for (const issue of issues) {
      const bucket = byField[issue.field] ?? [];
      bucket.push(issue);
      byField[issue.field] = bucket;
    }

    const hasError = issues.some((x) => x.severity === "error");
    const hasWarning = issues.some((x) => x.severity === "warning");
    const status_: RowStatus = hasError ? "error" : hasWarning ? "warning" : "ready";

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
