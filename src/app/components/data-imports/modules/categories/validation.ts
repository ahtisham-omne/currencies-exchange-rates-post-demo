/* Provenance: radiant-core-fusion/src/app/import-export/validation.ts
 * sha256 67f7fa2c2c87f8818ffdf4fc247487430de1a3286950aaa282030a1f6394fd5c
 * Copied into role-zen 2026-09-30. Edits: 1 import/field line(s) rewritten for role-zen (see git diff vs source). 27 Oct 2026: the 5000-character description cap removed, rule and copy (Omne does not cap descriptions; ERP-9664). Otherwise rules and copy unchanged. */
/* Port of the UAC import-review/validation.ts with the Categories rules from
   docs/import-export/SPEC.md section 4.1. Every rule that has a safe landing
   (a default on create, "leave unchanged" on update) is a warning; only the
   matching key and unit problems block a row. Descriptions have no length
   limit (Omne does not cap descriptions; ERP-9664). */

import { allUnitNames, resolveUnitName } from "./uom.mjs";
import { COLUMN_BY_KEY, type CategoryReviewField, type CategoryReviewRow } from "./spec";
import {
  ACQUISITION_OPTIONS,
  LOT_ID_OPTIONS,
  MAX_TAG_LENGTH,
  STATUS_OPTIONS,
  matchOption,
  matchYesNo,
  normalizeKey,
  orList,
  parseAcquisitionMethods,
  parseAlternativeUnits,
  parseTags,
  quoteList,
} from "./values";

export type IssueSeverity = "error" | "warning";

export type IssueCode =
  | "REQUIRED_EMPTY"
  | "DUPLICATE_KEY"
  | "INVALID_DROPDOWN"
  | "TAG_TOO_LONG"
  | "UNKNOWN_UNIT"
  | "INVALID_ALT_UNIT"
  | "CONDITIONAL_IGNORED";

export interface CellIssue {
  field: CategoryReviewField;
  severity: IssueSeverity;
  code: IssueCode;
  /** One line for the cell tooltip and the Error Message column. */
  message: string;
  /** Longer guide copy for the issue tooltip. */
  explanation: string;
  /** A value that would pass, when one exists. */
  example?: string;
  /** The accepted values, when the column has a fixed vocabulary. */
  options?: string[];
}

export type RowStatus = "ready" | "warning" | "error";

export interface RowValidation {
  status: RowStatus;
  issues: CellIssue[];
  byField: Partial<Record<CategoryReviewField, CellIssue[]>>;
  /** The code matches an existing category: the row updates it instead of creating one. */
  isUpdate: boolean;
}

export interface ValidationResult {
  rows: RowValidation[];
  errorRowCount: number;
  warningRowCount: number;
  readyRowCount: number;
  /** Non-error rows that will update an existing category. */
  updateRowCount: number;
  /** Non-error rows that will create a category. */
  createRowCount: number;
}

export interface ValidationContext {
  /** normalizeKey() of every category code already in the listing. Decides create vs update, never flags. */
  existingCodes?: Set<string>;
}

const INVENTORY_TYPE_OPTIONS = COLUMN_BY_KEY.inventoryType.options ?? [];
const CONTROL_TYPE_OPTIONS = COLUMN_BY_KEY.controlType.options ?? [];

function label(field: CategoryReviewField): string {
  return COLUMN_BY_KEY[field].label;
}

function example(field: CategoryReviewField): string {
  return COLUMN_BY_KEY[field].reference.example;
}

/** Warning for a select cell whose value is not in the vocabulary. */
function invalidOption(field: CategoryReviewField, value: string, options: readonly string[], isUpdate: boolean): CellIssue {
  const fallback = COLUMN_BY_KEY[field].defaultValue;
  const landing = isUpdate
    ? "The existing value will be kept."
    : fallback
      ? `The category will import as ${fallback}.`
      : "The value will be ignored.";
  return {
    field,
    severity: "warning",
    code: "INVALID_DROPDOWN",
    message: `"${value}" is not a recognised ${label(field)}. ${landing} Use ${orList(options)}.`,
    explanation: COLUMN_BY_KEY[field].description,
    example: example(field),
    options: [...options],
  };
}

export function validateRows(rows: CategoryReviewRow[], ctx: ValidationContext = {}): ValidationResult {
  const existingCodes = ctx.existingCodes ?? new Set<string>();

  /* Cross-row lookup for duplicate codes (1-based positions in `rows`). */
  const keyToRowNumbers = new Map<string, number[]>();
  rows.forEach((r, i) => {
    const key = normalizeKey(r.code);
    if (!key) return;
    const arr = keyToRowNumbers.get(key);
    if (arr) arr.push(i + 1);
    else keyToRowNumbers.set(key, [i + 1]);
  });

  const perRow: RowValidation[] = rows.map((r, i) => {
    const issues: CellIssue[] = [];
    const rowNumber = i + 1;

    /* 1. REQUIRED_EMPTY, Category Code. Required on every row: it is the matching key. */
    const code = r.code.trim();
    if (!code) {
      issues.push({
        field: "code",
        severity: "error",
        code: "REQUIRED_EMPTY",
        message: "Category Code is required and cannot be empty.",
        explanation: "Category Code is required. It is the matching key: a new code creates a category, a code already in Omne updates that category.",
        example: example("code"),
      });
    }

    /* 2. DUPLICATE_KEY, same code (trimmed, case-insensitive) on another row of this file. */
    if (code) {
      const matches = keyToRowNumbers.get(normalizeKey(code)) ?? [];
      if (matches.length > 1) {
        const others = matches.filter((n) => n !== rowNumber);
        issues.push({
          field: "code",
          severity: "error",
          code: "DUPLICATE_KEY",
          message: `Duplicate Category Code in this file. This code also appears in row ${others.join(", ")}.`,
          explanation: "Each code may appear once per file. Keep one row per category, or give the second row a different code.",
          example: example("code"),
        });
      }
    }

    /* Upsert determination: a row whose code has an error cannot be matched, so it validates as a create. */
    const hasCodeError = issues.some((x) => x.field === "code" && x.severity === "error");
    const isUpdate = !!code && !hasCodeError && existingCodes.has(normalizeKey(code));

    /* 3. Status: Active / Inactive, blank is always safe. */
    const status = r.status.trim();
    if (status && !matchOption(status, STATUS_OPTIONS)) issues.push(invalidOption("status", status, STATUS_OPTIONS, isUpdate));

    /* 4. Description: no length limit (Omne does not cap descriptions). */

    /* 5. Tags: each entry up to 30 characters; longer ones are shortened with a warning. */
    const { truncated } = parseTags(r.tags);
    if (truncated.length > 0) {
      const many = truncated.length > 1;
      issues.push({
        field: "tags",
        severity: "warning",
        code: "TAG_TOO_LONG",
        message: `Tag${many ? "s" : ""} ${quoteList(truncated)} ${many ? "are" : "is"} longer than ${MAX_TAG_LENGTH} characters and will be shortened.`,
        explanation: COLUMN_BY_KEY.tags.description,
        example: example("tags"),
      });
    }

    /* 6. Inventory Type, Control Type. */
    const inventoryType = r.inventoryType.trim();
    if (inventoryType && !matchOption(inventoryType, INVENTORY_TYPE_OPTIONS)) {
      issues.push(invalidOption("inventoryType", inventoryType, INVENTORY_TYPE_OPTIONS, isUpdate));
    }
    const controlType = r.controlType.trim();
    if (controlType && !matchOption(controlType, CONTROL_TYPE_OPTIONS)) {
      issues.push(invalidOption("controlType", controlType, CONTROL_TYPE_OPTIONS, isUpdate));
    }

    /* 7. Lot Tracking (Yes / No) and the conditional Lot ID Assignment. */
    const lotRaw = r.lotControlEnabled.trim();
    const lot = matchYesNo(lotRaw);
    if (lotRaw && !lot) issues.push(invalidOption("lotControlEnabled", lotRaw, ["Yes", "No"], isUpdate));
    const lotIdRaw = r.lotIdSource.trim();
    if (lotIdRaw) {
      const lotId = matchOption(lotIdRaw, LOT_ID_OPTIONS);
      if (!lotId) {
        issues.push(invalidOption("lotIdSource", lotIdRaw, LOT_ID_OPTIONS, isUpdate));
      } else {
        /* Effective Lot Tracking: the cell, else the default (No) on a create row; unknown on an update row. */
        const effectiveLot = lot ?? (isUpdate ? null : "No");
        if (effectiveLot === "No") {
          issues.push({
            field: "lotIdSource",
            severity: "warning",
            code: "CONDITIONAL_IGNORED",
            message: "Lot ID Assignment only applies when Lot Tracking is Yes. This value will be ignored.",
            explanation: COLUMN_BY_KEY.lotIdSource.description,
            example: example("lotIdSource"),
            options: [...LOT_ID_OPTIONS],
          });
        }
      }
    }

    /* 8. Base Unit of Measure: must be a unit Omne knows (name or short form). */
    const uomRaw = r.uom.trim();
    const uom = uomRaw ? resolveUnitName(uomRaw) : null;
    if (uomRaw && !uom) {
      issues.push({
        field: "uom",
        severity: "error",
        code: "UNKNOWN_UNIT",
        message: `"${uomRaw}" is not a unit Omne knows. Use a unit from the Valid Values sheet, such as Each or Kilogram.`,
        explanation: COLUMN_BY_KEY.uom.description,
        example: example("uom"),
        options: allUnitNames(),
      });
    }

    /* 9. Alternative Units: Unit=factor pairs, unit known, factor above 0, other category than the base. */
    const altRaw = r.alternativeUnits.trim();
    if (altRaw) {
      const baseUnit = uom ?? (uomRaw ? null : isUpdate ? null : COLUMN_BY_KEY.uom.defaultValue);
      const { problems } = parseAlternativeUnits(altRaw, baseUnit);
      if (problems.length > 0) {
        issues.push({
          field: "alternativeUnits",
          severity: "error",
          code: "INVALID_ALT_UNIT",
          message: problems.join(" "),
          explanation:
            "Each entry is Unit=factor, separated with a pipe character ( | ). The unit must be one Omne knows and from a different unit category than the base unit, and the factor must be above 0.",
          example: example("alternativeUnits"),
        });
      }
    }

    /* 10. Acquisition Method: Purchased, Manufactured, or both; at least one must remain. */
    const acqRaw = r.acquisitionMethods.trim();
    const { methods, unknown } = parseAcquisitionMethods(acqRaw);
    if (unknown.length > 0) {
      const landing = methods.length > 0
        ? `Only ${methods.join(" and ")} will be used.`
        : isUpdate
          ? "The existing value will be kept."
          : `The category will import as ${COLUMN_BY_KEY.acquisitionMethods.defaultValue}.`;
      issues.push({
        field: "acquisitionMethods",
        severity: "warning",
        code: "INVALID_DROPDOWN",
        message: `${quoteList(unknown)} ${unknown.length > 1 ? "are" : "is"} not a recognised Acquisition Method. ${landing} Use Purchased, Manufactured, or both separated with a pipe.`,
        explanation: COLUMN_BY_KEY.acquisitionMethods.description,
        example: example("acquisitionMethods"),
        options: [...ACQUISITION_OPTIONS],
      });
    }

    /* 11. Primary Acquisition: must be one of the row's methods. */
    const primaryRaw = r.primaryAcquisition.trim();
    if (primaryRaw) {
      const primary = matchOption(primaryRaw, ACQUISITION_OPTIONS);
      if (!primary) {
        issues.push(invalidOption("primaryAcquisition", primaryRaw, ACQUISITION_OPTIONS, isUpdate));
      } else {
        /* Effective methods: the cell, else the default on a create row; unknown on an update row. */
        const effective = methods.length > 0 ? methods : acqRaw || isUpdate ? null : [COLUMN_BY_KEY.acquisitionMethods.defaultValue];
        if (effective && !effective.includes(primary)) {
          issues.push({
            field: "primaryAcquisition",
            severity: "warning",
            code: "CONDITIONAL_IGNORED",
            message: `Primary Acquisition "${primary}" is not one of the row's Acquisition Method values and will be ignored.`,
            explanation:
              "Primary Acquisition must match one of the methods listed in Acquisition Method. With a single method, that method is primary and this cell can stay blank.",
            example: example("primaryAcquisition"),
            options: [...ACQUISITION_OPTIONS],
          });
        }
      }
    }

    const byField: Partial<Record<CategoryReviewField, CellIssue[]>> = {};
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
  return { rows: perRow, errorRowCount, warningRowCount, readyRowCount, updateRowCount, createRowCount };
}

/** Joined error/warning messages for one row, as stored on a skipped record. */
export function rowIssueMessages(v: RowValidation, severity?: IssueSeverity): string[] {
  return v.issues.filter((x) => !severity || x.severity === severity).map((x) => x.message);
}
