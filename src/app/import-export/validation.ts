/* Generic `validateRows(spec, rows, ctx)`: per-cell issues and per-row
 * status (error > warning > ready), isUpdate by key match (trim,
 * case-insensitive) against the existing records. Rules come from the spec
 * column kinds plus the entity rules encoded on the columns
 * (optionsFrom / unknownSeverity / subsetOf / conditionalOn / min / max /
 * maxLength / format). Messages follow the User Access Control pattern. */

import type { EntitySpec, ImportColumn, ImportRow } from "./spec";
import { canonicalOption, contactNameSet, normKey, splitList } from "./spec";

export type IssueSeverity = "error" | "warning";

export type IssueCode =
  | "REQUIRED_EMPTY"
  | "DUPLICATE_KEY"
  | "INVALID_OPTION"
  | "REFERENCE_NOT_FOUND"
  | "NOT_IN_LIST"
  | "CONDITION_NOT_MET"
  | "INVALID_NUMBER"
  | "OUT_OF_RANGE"
  | "TOO_LONG"
  | "INVALID_EMAIL"
  | "INVALID_PHONE";

export interface CellIssue {
  field: string;
  severity: IssueSeverity;
  code: IssueCode;
  /** One-line message (chip / sub-row copy). */
  message: string;
  /** Tooltip explanation. */
  explanation: string;
  /** Tooltip EXAMPLE card. */
  example?: string;
  /** Tooltip OPTIONS chips. */
  options?: string[];
}

export type RowStatus = "ready" | "warning" | "error";

export interface RowValidation {
  status: RowStatus;
  issues: CellIssue[];
  byField: Partial<Record<string, CellIssue[]>>;
  /** Key matches an existing record: the row updates instead of creating. */
  isUpdate: boolean;
}

export interface ValidationResult {
  rows: RowValidation[];
  errorRowCount: number;
  warningRowCount: number;
  readyRowCount: number;
  /** Non-error rows that will update an existing record. */
  updateRowCount: number;
  /** Non-error rows that will create a new record. */
  createRowCount: number;
}

export interface ValidationContext {
  /** Lower-cased keys of records already in the listing (partner display/company names, group names). */
  existingKeys?: Set<string>;
  /** Lower-cased partner group names, for columns with `optionsFrom: "groups"`. */
  groups?: Set<string>;
  /** Lower-cased partner names (displayName + companyName), for `optionsFrom: "partners"`. */
  partners?: Set<string>;
  /** Lower-cased Contact Directory names, for `optionsFrom: "contacts"`. */
  contacts?: Set<string>;
}

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_ALLOWED_CHARS = /^[+0-9 .\-()xX]*(?:\s*(?:ext\.?|extension|x)\s*\d+)?$/i;
const PHONE_DIGIT_REGEX = /\d/g;

export function isUnusualPhone(value: string): boolean {
  if (!value) return false;
  if (!PHONE_ALLOWED_CHARS.test(value)) return true;
  const digits = (value.match(PHONE_DIGIT_REGEX) ?? []).length;
  return digits < 7 || digits > 15;
}

export function parseNumber(value: string): number | null {
  const cleaned = value.replace(/,/g, "").trim();
  if (!cleaned) return null;
  if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** `"A"` / `"A" and "B"` / `"A", "B", and N more` */
export function quoteList(values: string[]): string {
  if (values.length === 1) return `"${values[0]}"`;
  if (values.length === 2) return `"${values[0]}" and "${values[1]}"`;
  return `"${values[0]}", "${values[1]}", and ${values.length - 2} more`;
}

function optionsSentence(options: string[]): string {
  if (options.length === 0) return "";
  if (options.length <= 8) {
    if (options.length === 1) return `Use ${options[0]}.`;
    return `Use ${options.slice(0, -1).join(", ")}, or ${options[options.length - 1]}.`;
  }
  return "See the Valid Values sheet for the accepted values.";
}

/** Written nouns for a reference column: [sentence start, mid-sentence]. */
function referenceNoun(col: ImportColumn): [string, string] {
  if (col.optionsFrom === "groups") return ["Partner group", "partner group"];
  if (col.optionsFrom === "partners") return ["Partner", "partner"];
  if (col.optionsFrom === "contacts") return ["Contact", "contact"];
  return [col.label, col.label];
}

function referenceSet(col: ImportColumn, ctx: ValidationContext): Set<string> | undefined {
  if (col.optionsFrom === "groups") return ctx.groups;
  if (col.optionsFrom === "partners") return ctx.partners;
  if (col.optionsFrom === "contacts") return ctx.contacts;
  return undefined;
}

function cellValues(col: ImportColumn, raw: string): string[] {
  return col.kind === "multiselect" ? splitList(raw) : raw.trim() ? [raw.trim()] : [];
}

function rangeText(col: ImportColumn): string {
  if (col.min !== undefined && col.max !== undefined) return `between ${col.min} and ${col.max}`;
  if (col.min !== undefined) return `${col.min} or more`;
  if (col.max !== undefined) return `${col.max} or less`;
  return "";
}

export function validateRows(spec: EntitySpec<unknown>, rows: ImportRow[], ctx: ValidationContext = {}): ValidationResult {
  const existing = ctx.existingKeys ?? new Set<string>();
  const keyCol = spec.columns.find((c) => c.key === spec.keyColumn);
  if (!keyCol) throw new Error(`Spec ${spec.entity} has no key column ${spec.keyColumn}`);
  const keyLabel = keyCol.label;
  const noun = spec.nounLower;
  const byKey = new Map(spec.columns.map((c) => [c.key, c] as [string, ImportColumn]));

  /* Cross-row duplicate table (1-based positions in `rows`). */
  const keyToRowNumbers = new Map<string, number[]>();
  rows.forEach((r, i) => {
    const k = normKey(r[spec.keyColumn]);
    if (!k) return;
    const arr = keyToRowNumbers.get(k);
    if (arr) arr.push(i + 1);
    else keyToRowNumbers.set(k, [i + 1]);
  });

  const perRow: RowValidation[] = rows.map((r, i) => {
    const issues: CellIssue[] = [];
    const rowNumber = i + 1;
    const push = (issue: CellIssue) => issues.push(issue);

    /* 1a. REQUIRED_EMPTY on the key, every row. */
    const key = (r[spec.keyColumn] ?? "").trim();
    if (!key) {
      push({
        code: "REQUIRED_EMPTY", severity: "error", field: spec.keyColumn,
        message: `${keyLabel} is required and cannot be empty.`,
        explanation: `${keyLabel} is required. ${keyCol.description}`,
        example: keyCol.example1,
      });
    }

    /* 2. DUPLICATE_KEY within the file. */
    if (key) {
      const matches = keyToRowNumbers.get(normKey(key)) ?? [];
      if (matches.length > 1) {
        const others = matches.filter((n) => n !== rowNumber);
        const ref = others.length === 1 ? String(others[0]) : others.join(", ");
        push({
          code: "DUPLICATE_KEY", severity: "error", field: spec.keyColumn,
          message: `Duplicate ${keyLabel}. This value also appears in row ${ref}.`,
          explanation: `This ${keyLabel} is also in row ${ref}. Each ${noun} needs a unique ${keyLabel}. Use a different value, or remove one of the rows.`,
        });
      }
    }

    /* Upsert determination: the key is the matching key only, never written. */
    const hasKeyError = issues.some((x) => x.field === spec.keyColumn && x.severity === "error");
    const isUpdate = !!key && !hasKeyError && existing.has(normKey(key));

    /* 1b. REQUIRED_EMPTY on the other required columns, create rows only. */
    if (!isUpdate) {
      for (const col of spec.columns) {
        if (!col.required || col.key === spec.keyColumn) continue;
        if (!(r[col.key] ?? "").trim()) {
          push({
            code: "REQUIRED_EMPTY", severity: "error", field: col.key,
            message: `${col.label} is required and cannot be empty.`,
            explanation: `${col.label} is required for a new ${noun}. ${col.description}`,
            example: col.example1,
          });
        }
      }
    }

    /* Per-column rules. */
    for (const col of spec.columns) {
      const raw = (r[col.key] ?? "").trim();
      if (!raw) continue;

      if (col.kind === "select" || col.kind === "multiselect" || col.kind === "yesno") {
        const values = cellValues(col, raw);
        const refSet = referenceSet(col, ctx);
        if (col.optionsFrom) {
          /* Reference lookup (groups / partners). Skipped when the context has no list. */
          if (refSet && refSet.size >= 0) {
            const unknown = values.filter((v) => !refSet.has(normKey(v)));
            if (unknown.length > 0) {
              const severity: IssueSeverity = col.unknownSeverity ?? "warning";
              const [rn, rnLower] = referenceNoun(col);
              const plural = unknown.length > 1;
              const list = quoteList(unknown);
              push({
                code: "REFERENCE_NOT_FOUND", severity, field: col.key,
                message: plural
                  ? `${rn}s ${list} don't exist in Omne.${severity === "error" ? "" : ` The ${noun} will import without these ${rnLower}s.`}`
                  : `${rn} ${list} doesn't exist in Omne.${severity === "error" ? "" : ` The ${noun} will import without this ${rnLower}.`}`,
                explanation: severity === "error"
                  ? `Each ${rnLower} must already exist in Omne. Create it first, or fix the spelling. Matching is not case sensitive.`
                  : `One or more of these values don't exist in Omne. The ${noun} will still import, the unknown values just won't be applied.`,
                example: col.example1,
              });
            }
          }
        } else {
          const options = col.kind === "yesno" ? ["Yes", "No"] : (col.options ?? []);
          const invalid = values.filter((v) => !canonicalOption(v, options));
          if (invalid.length > 0) {
            const severity: IssueSeverity = col.unknownSeverity ?? "warning";
            push({
              code: "INVALID_OPTION", severity, field: col.key,
              message: `${quoteList(invalid)} ${invalid.length > 1 ? "are not recognised" : "is not a recognised"} ${col.label}${invalid.length > 1 ? " values" : ""}. ${severity === "error" ? "Fix the value before importing." : `The ${noun} will import without it.`} ${optionsSentence(options)}`.trim(),
              explanation: `This is not a ${col.label} Omne recognises${severity === "error" ? "." : ", so it will be ignored."} Choose one of the accepted values.`,
              options,
            });
          }
        }

        /* subsetOf: values must also appear in the sibling column. */
        if (col.subsetOf) {
          const sibling = byKey.get(col.subsetOf);
          const siblingValues = sibling ? cellValues(sibling, r[sibling.key] ?? "") : [];
          if (sibling && siblingValues.length > 0) {
            const missing = values.filter((v) => !siblingValues.some((s) => normKey(s) === normKey(v)));
            if (missing.length > 0) {
              const severity: IssueSeverity = col.subsetSeverity ?? "error";
              push({
                code: "NOT_IN_LIST", severity, field: col.key,
                message: `${quoteList(missing)} ${missing.length > 1 ? "are" : "is"} not listed in ${sibling.label} on this row.${severity === "error" ? "" : ` The ${noun} will import without ${missing.length > 1 ? "them" : "it"}.`}`,
                explanation: `${col.label} must be one of the values listed in ${sibling.label} on the same row.`,
                options: siblingValues,
              });
            }
          }
        }

        /* conditionalOn: only meaningful when the sibling includes the given option. */
        if (col.conditionalOn) {
          const cond = byKey.get(col.conditionalOn.field);
          const condValues = cond ? cellValues(cond, r[cond.key] ?? "") : [];
          if (cond && condValues.length > 0 && !condValues.some((v) => normKey(v) === normKey(col.conditionalOn!.includes))) {
            push({
              code: "CONDITION_NOT_MET", severity: "warning", field: col.key,
              message: `${col.label} only apply when ${cond.label} includes ${col.conditionalOn.includes}. These values will be ignored.`,
              explanation: `${col.label} only apply when ${cond.label} includes ${col.conditionalOn.includes}. Add ${col.conditionalOn.includes} to ${cond.label}, or clear this cell.`,
              example: col.example1,
            });
          }
        }
      } else if (col.kind === "number") {
        const n = parseNumber(raw);
        if (n === null) {
          push({
            code: "INVALID_NUMBER", severity: "error", field: col.key,
            message: `${col.label} must be a number.`,
            explanation: "Enter a plain number, without currency symbols or units.",
            example: col.example1,
          });
        } else if ((col.min !== undefined && n < col.min) || (col.max !== undefined && n > col.max)) {
          push({
            code: "OUT_OF_RANGE", severity: "error", field: col.key,
            message: `${col.label} must be ${rangeText(col)}.`,
            explanation: `Enter a number ${rangeText(col)}.`,
            example: col.example1,
          });
        }
      } else if (col.kind === "text") {
        if (col.maxLength !== undefined && raw.length > col.maxLength) {
          push({
            code: "TOO_LONG", severity: "error", field: col.key,
            message: `${col.label} is over ${col.maxLength} characters.`,
            explanation: `Shorten the text to ${col.maxLength} characters or fewer.`,
          });
        }
        if (col.format === "email" && !EMAIL_REGEX.test(raw)) {
          push({
            code: "INVALID_EMAIL", severity: "error", field: col.key,
            message: "Invalid email format. Expected: name@domain.com",
            explanation: "This is not a valid email address. Check for typos and missing parts like the @ sign.",
            example: col.example1,
          });
        }
        if (col.format === "phone" && isUnusualPhone(raw)) {
          push({
            code: "INVALID_PHONE", severity: "warning", field: col.key,
            message: `${col.label} is in an unusual format. It will import as-is, you can clean it up later.`,
            explanation: "This phone number doesn't look like a standard format. It will import as-is, you can clean it up later.",
            example: col.example1,
          });
        }
      }
      /* "date": imports exactly as it appears in the file (mirrors UAC). */
    }

    const byField: Partial<Record<string, CellIssue[]>> = {};
    for (const issue of issues) (byField[issue.field] ??= []).push(issue);
    const hasError = issues.some((x) => x.severity === "error");
    const hasWarning = issues.some((x) => x.severity === "warning");
    return { status: hasError ? "error" : hasWarning ? "warning" : "ready", issues, byField, isUpdate };
  });

  let errorRowCount = 0, warningRowCount = 0, readyRowCount = 0, updateRowCount = 0, createRowCount = 0;
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

/* ───────────────────────── context builders ───────────────────────── */

/** Build the validation context from the two stores (snapshot it when the wizard opens). */
export function buildValidationContext(
  spec: EntitySpec<unknown>,
  partners: readonly { displayName: string; companyName: string }[],
  groups: readonly { name: string }[],
): ValidationContext {
  const partnerNames = new Set<string>();
  for (const p of partners) {
    if (p.displayName) partnerNames.add(normKey(p.displayName));
    if (p.companyName) partnerNames.add(normKey(p.companyName));
  }
  const groupNames = new Set(groups.map((g) => normKey(g.name)).filter(Boolean));
  return {
    existingKeys: spec.storageNamespace === "partner-groups" ? groupNames : partnerNames,
    groups: groupNames,
    partners: partnerNames,
    contacts: contactNameSet(),
  };
}
