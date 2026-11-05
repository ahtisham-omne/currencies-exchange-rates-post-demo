/**
 * Validation for the legacy import.
 *
 * Two things separate this from the User Access Control validator it is
 * modelled on:
 *
 * 1. The unit is a record, not a row. Line-level problems are attributed
 *    to the line that carries them and then rolled up, so a quote with
 *    eleven lines and one bad unit reads as one error record with one bad
 *    line rather than eleven rows of noise.
 *
 * 2. A value naming another module's record cannot be invented here. When
 *    it fails to resolve the issue is an ENTITY_NOT_FOUND error carrying
 *    the entity kind and the raw value, which is what lets the review
 *    sheet offer a picker of real records and fix every twin of the same
 *    misspelling in one action.
 *
 * Warnings never block: the template promises those records import as
 * they are, and the copy in the review sheet says so.
 */

import { SET_ALIASES } from "./importAliases";
import {
  COLUMN_BY_KEY, KEY_COLUMN, LINE_COLUMNS, RECORD_COLUMNS, STATUS_COLUMN,
} from "./importSpec";
import { resolveEntity, priceListPrice, unitsForItem, locationsForCustomer } from "./importCatalog";
import type { CatalogKey } from "./importCatalog";
import { splitList } from "./importParse";
import type {
  EntityGap, ImportRecord, Issue, RecordValidation, ValidationSummary,
} from "./importModel";

export interface ValidateOptions {
  /** Record keys already imported before. Those records are skipped. */
  alreadyImported?: Set<string>;
  /** True when the company trades in one currency, making the code optional. */
  singleCurrency?: boolean;
  /** Statuses that make the conditional date column required. */
  datesRequiredForStatuses?: string[];
  /** The conditional date column's key, e.g. expirationDate / shipBy. */
  conditionalDateKey?: string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function push(list: Issue[], issue: Issue) { list.push(issue); }

function entityIssue(
  field: string, label: string, entity: CatalogKey, raw: string,
  scope: "record" | "line", lineId?: string,
): Issue {
  const nouns: Record<string, string> = {
    customer: "customer", item: "item", uom: "unit", pricingRule: "pricing rule",
    user: "user", location: "location", paymentTerm: "payment term",
    paymentMethod: "payment method", contact: "contact", sourceQuote: "quote",
  };
  return {
    code: "ENTITY_NOT_FOUND",
    severity: entity === "sourceQuote" ? "warning" : "error",
    scope, field, lineId,
    entity: entity as Issue["entity"],
    rawValue: raw,
    message: entity === "sourceQuote"
      ? `No quote named "${raw}". The order imports without a linked quote.`
      : `No ${nouns[entity]} named "${raw}" in Omne. ${label} must point at a record that already exists.`,
  };
}

function validateRecord(
  rec: ImportRecord, opts: ValidateOptions, seenKeys: Map<string, string>,
): RecordValidation {
  const issues: Issue[] = [];
  const v = rec.values;

  /* ── record-level columns ── */
  for (const col of RECORD_COLUMNS) {
    const raw = (v[col.key] ?? "").trim();

    if (!raw) {
      if (col.requirement === "required") {
        push(issues, { code: "REQUIRED_EMPTY", severity: "error", scope: "record", field: col.key,
          message: `${col.label} is required.` });
      }
      if (col.key === opts.conditionalDateKey && opts.datesRequiredForStatuses?.includes(v[STATUS_COLUMN] ?? "")) {
        push(issues, { code: "REQUIRED_EMPTY", severity: "error", scope: "record", field: col.key,
          message: `${col.label} is required when the status is ${v[STATUS_COLUMN]}.` });
      }
      if (col.key === "currencyCode" && !opts.singleCurrency) {
        push(issues, { code: "REQUIRED_EMPTY", severity: "error", scope: "record", field: col.key,
          message: "Currency Code is required because your company trades in more than one currency." });
      }
      if (col.key === "requestedOn") {
        push(issues, { code: "REQUESTED_ON_MISSING", severity: "warning", scope: "record", field: col.key,
          message: "Imports without a requested date. Omne does not substitute today's date." });
      }
      continue;
    }

    if (col.set && !col.set.some((s) => s.toLowerCase() === raw.toLowerCase())) {
      const alias = SET_ALIASES[col.key]?.[raw.trim().toLowerCase()];
      if (alias) {
        /* Understood, so it imports. A warning, not a blocker. */
        push(issues, { code: "SET_ALIASED", severity: "warning", scope: "record", field: col.key,
          message: `"${raw}" is not a ${col.label} in Omne. It imports as ${alias}. Change it here if that is wrong.` });
      } else {
        push(issues, { code: "INVALID_SET", severity: "error", scope: "record", field: col.key,
          message: `"${raw}" is not a valid ${col.label}. Expected one of: ${col.set.join(", ")}.` });
      }
    }
    if (col.kind === "date" && !DATE_RE.test(raw)) {
      push(issues, { code: "INVALID_DATE", severity: "error", scope: "record", field: col.key,
        message: `${col.label} must be a date in YYYY-MM-DD form.` });
    }
    if (col.kind === "number" && Number.isNaN(Number(raw))) {
      push(issues, { code: "INVALID_NUMBER", severity: "error", scope: "record", field: col.key,
        message: `${col.label} must be a number.` });
    }
    if (col.entity) {
      const parts = col.list ? splitList(raw) : [raw];
      for (const part of parts) {
        if (!resolveEntity(col.entity as CatalogKey, part)) {
          push(issues, entityIssue(col.key, col.label, col.entity as CatalogKey, part, "record"));
        }
      }
    }
  }

  /* Delivery location that belongs to a different customer still imports,
     on the template's stated assumption of a third-party arrangement. */
  const loc = (v.deliveryLocation ?? "").trim();
  const cust = (v.customerName ?? "").trim();
  if (loc && cust && loc.includes(">")) {
    const owner = loc.split(">")[0].trim();
    if (owner.toLowerCase() !== cust.toLowerCase() && locationsForCustomer(cust).length > 0) {
      push(issues, { code: "LOCATION_NOT_CUSTOMERS", severity: "warning", scope: "record",
        field: "deliveryLocation",
        message: `This location belongs to ${owner}, not ${cust}. Imported as a third-party delivery.` });
    }
  }

  /* Re-import guard, and duplicates inside one file. */
  const key = (v[KEY_COLUMN] ?? "").trim();
  if (key) {
    if (opts.alreadyImported?.has(key.toLowerCase())) {
      /* A number that is already in the listing is an error, not a silent
         skip: this import never overwrites an existing record, so the row
         has to be renumbered before it can land. */
      push(issues, { code: "ALREADY_IMPORTED", severity: "error", scope: "record", field: KEY_COLUMN,
        message: `${key} already exists in Sales Orders. Give this row a new number to import it, or drop the row.` });
    }
    const twin = seenKeys.get(key.toLowerCase());
    if (twin && twin !== rec.id) {
      push(issues, { code: "DUPLICATE_IN_FILE", severity: "error", scope: "record", field: KEY_COLUMN,
        message: `${key} appears more than once in this file. Keep one and remove the other.` });
    } else if (!twin) {
      seenKeys.set(key.toLowerCase(), rec.id);
    }
  }

  /* ── lines ── */
  if (rec.lines.length === 0) {
    push(issues, { code: "NO_LINES", severity: "error", scope: "record", field: KEY_COLUMN,
      message: "No line items. A record needs at least one line to import." });
  }

  for (const line of rec.lines) {
    const lv = line.values;
    for (const col of LINE_COLUMNS) {
      const raw = (lv[col.key] ?? "").trim();

      if (!raw) {
        if (col.requirement === "required") {
          push(issues, { code: "REQUIRED_EMPTY", severity: "error", scope: "line", field: col.key,
            lineId: line.id, message: `${col.label} is required on every line.` });
        }
        continue;
      }
      if (col.set && !col.set.some((s) => s.toLowerCase() === raw.toLowerCase())) {
        push(issues, { code: "INVALID_SET", severity: "error", scope: "line", field: col.key, lineId: line.id,
          message: `"${raw}" is not a valid ${col.label}. Expected one of: ${col.set.join(", ")}.` });
      }
      if (col.kind === "date" && !DATE_RE.test(raw)) {
        push(issues, { code: "INVALID_DATE", severity: "error", scope: "line", field: col.key, lineId: line.id,
          message: `${col.label} must be a date in YYYY-MM-DD form.` });
      }
      if (col.kind === "number") {
        const n = Number(raw);
        if (Number.isNaN(n)) {
          push(issues, { code: "INVALID_NUMBER", severity: "error", scope: "line", field: col.key, lineId: line.id,
            message: `${col.label} must be a number.` });
        } else if (col.key === "lineQuantity" && n <= 0) {
          push(issues, { code: "INVALID_NUMBER", severity: "error", scope: "line", field: col.key, lineId: line.id,
            message: "Quantity must be greater than zero." });
        }
      }
      if (col.entity) {
        const parts = col.list ? splitList(raw) : [raw];
        for (const part of parts) {
          if (!resolveEntity(col.entity as CatalogKey, part)) {
            push(issues, entityIssue(col.key, col.label, col.entity as CatalogKey, part, "line", line.id));
          }
        }
      }
    }

    /* A unit that exists but is not permitted for this item. */
    const item = (lv.lineItem ?? "").trim();
    const uom = (lv.lineUnitOfMeasure ?? "").trim();
    if (item && uom && resolveEntity("item", item) && resolveEntity("uom", uom)) {
      const allowed = unitsForItem(resolveEntity("item", item)!);
      if (!allowed.some((u) => u.toLowerCase() === uom.toLowerCase())) {
        push(issues, { code: "UOM_NOT_ALLOWED_FOR_ITEM", severity: "error", scope: "line",
          field: "lineUnitOfMeasure", lineId: line.id,
          message: `${item} cannot be sold in ${uom}. Allowed: ${allowed.join(", ")}.` });
      }
    }

    /* Price that differs from the list. The file's value wins. */
    const priceRaw = (lv.linePricePerUnit ?? "").trim();
    if (item && priceRaw && !Number.isNaN(Number(priceRaw))) {
      const listed = priceListPrice(resolveEntity("item", item) ?? item);
      if (listed != null && Number(priceRaw) !== listed) {
        push(issues, { code: "PRICE_DIFFERS", severity: "warning", scope: "line",
          field: "linePricePerUnit", lineId: line.id,
          message: `Price list has ${listed.toLocaleString()}. Your ${Number(priceRaw).toLocaleString()} is used.` });
      }
    }
  }

  /* ── roll up ── */
  const byField: Record<string, Issue[]> = {};
  const byLine: Record<string, Record<string, Issue[]>> = {};
  for (const i of issues) {
    if (i.scope === "record") {
      (byField[i.field] ??= []).push(i);
    } else if (i.lineId) {
      const l = (byLine[i.lineId] ??= {});
      (l[i.field] ??= []).push(i);
    }
  }
  const errorLineIds = Object.keys(byLine).filter((id) =>
    Object.values(byLine[id]).some((arr) => arr.some((i) => i.severity === "error")));
  const warningLineIds = Object.keys(byLine).filter((id) =>
    !errorLineIds.includes(id) &&
    Object.values(byLine[id]).some((arr) => arr.some((i) => i.severity === "warning")));

  const hasError = issues.some((i) => i.severity === "error");
  const hasWarning = issues.some((i) => i.severity === "warning");
  return {
    status: hasError ? "error" : hasWarning ? "warning" : "ready",
    issues, byField, byLine, errorLineIds, warningLineIds,
  };
}

export function validateRecords(records: ImportRecord[], opts: ValidateOptions = {}): ValidationSummary {
  const byRecord: Record<string, RecordValidation> = {};
  const seenKeys = new Map<string, string>();
  let readyCount = 0, warningCount = 0, errorCount = 0;

  for (const rec of records) {
    if (rec.excluded) continue;
    const res = validateRecord(rec, opts, seenKeys);
    byRecord[rec.id] = res;
    if (res.status === "ready") readyCount++;
    else if (res.status === "warning") warningCount++;
    else errorCount++;
  }

  /* Group every unresolved dependency so one fix can clear all its twins. */
  const gapMap = new Map<string, EntityGap>();
  for (const rec of records) {
    const res = byRecord[rec.id];
    if (!res) continue;
    for (const i of res.issues) {
      if (i.code !== "ENTITY_NOT_FOUND" || !i.entity || !i.rawValue) continue;
      const k = `${i.entity}::${i.rawValue.toLowerCase()}`;
      const g = gapMap.get(k) ?? { entity: i.entity, rawValue: i.rawValue, occurrences: 0, recordIds: [] };
      g.occurrences++;
      if (!g.recordIds.includes(rec.id)) g.recordIds.push(rec.id);
      gapMap.set(k, g);
    }
  }

  return {
    byRecord, readyCount, warningCount, errorCount,
    entityGaps: [...gapMap.values()].sort((a, b) => b.occurrences - a.occurrences),
  };
}

/** Columns whose value is a dependency, used by the resolve-all flow. */
export function entityColumnsFor(kind: CatalogKey): string[] {
  return Object.values(COLUMN_BY_KEY).filter((c) => c.entity === kind).map((c) => c.key);
}

/**
 * The next free record number, in the module's own format.
 *
 * Offered as a one-click fix on a row whose number is already taken. It
 * walks the existing keys, takes the highest numeric tail it recognises and
 * returns the next one, so the suggestion looks like every other number in
 * the listing rather than something invented for imports.
 */
export function suggestNextKey(existing: Set<string> | undefined, sample: string): string {
  const m = sample.match(/^([A-Za-z]+)-(\d{3})-(\d{3})-(\d{3})$/);
  const prefix = m ? m[1] : sample.split("-")[0] || "Q";
  let max = -1;
  for (const raw of existing ?? []) {
    const parts = raw.trim().match(/^([A-Za-z]+)-(\d{3})-(\d{3})-(\d{3})$/i);
    if (!parts || parts[1].toLowerCase() !== prefix.toLowerCase()) continue;
    const n = parseInt(parts[2] + parts[3] + parts[4], 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  const next = String(max + 1).padStart(9, "0");
  return `${prefix}-${next.slice(0, 3)}-${next.slice(3, 6)}-${next.slice(6, 9)}`;
}
