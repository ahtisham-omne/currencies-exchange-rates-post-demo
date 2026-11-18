/* Provenance: partner-management-module/src/app/import-export/spec.ts
 * sha256 f7921892b7b5c408fcbda01f56c305a353077c4b23af624000c761a0fd81b31e
 * Copied into role-zen 2026-09-30, REDUCED to what validation.ts and the
 * Data Imports review read: the row / column / spec types, the list helpers
 * (splitList, joinList, normKey, canonicalOption, emptyRow, findColumn,
 * lookupCI) and contactNameSet verbatim, and the two specs' identity + columns.
 * Export fields, template copy, label-to-id maps and the Vendor-typed pieces
 * are dropped: they need the Partners app's live constants and are not used
 * here. The live option overlay (buildColumns) reads the spec.data.mjs
 * snapshots that the source pins to those constants
 * (__tests__/spec.snapshots.test.ts), and contactNameSet reads the
 * CONTACT_DICTIONARY snapshot in ./existing.ts. The parity test compares the
 * resulting columns with the home repo's live spec. */

import {
  CARRIERS,
  CURRENCY_CODES,
  CUSTOMER_SUB_TYPES,
  PARTNER_GROUPS_DATA,
  PARTNERS_DATA,
  PAYMENT_METHODS,
  PAYMENT_TERM_PRESETS,
  PRICING_RULE_PRESETS,
  VENDOR_SUB_TYPES,
} from "./spec.data.mjs";
import type { ColumnData, ColumnKind, EntityData, TextFormat } from "./spec.data.mjs";
import { CONTACT_DIRECTORY_NAMES } from "./existing";

export type { ColumnKind, TextFormat, EntityData, ColumnData };

/* ───────────────────────── row + column types ───────────────────────── */

/** A review row: every column key -> the cell text (pipe-joined for lists). */
export type ImportRow = Record<string, string>;

export interface ImportColumn extends ColumnData {
  kind: ColumnKind;
  /** Resolved option labels (live constants overlaid). */
  options?: string[];
}

export interface EntitySpec<T = unknown> {
  /** Raw data block (what the Node generator reads). */
  data: EntityData;
  entity: string;
  entitySingular: string;
  nounLower: string;
  nounPluralLower: string;
  moduleSlug: string;
  /** localStorage namespace: `omne:<storageNamespace>:import-*`. */
  storageNamespace: string;
  keyColumn: string;
  /** Normalised header names whose presence identifies the header row. */
  headerIdentityKeys: string[];
  columns: ImportColumn[];
  bulkSetFields: string[];
  /** Phantom: keeps the source's generic signature. */
  _row?: T;
}

/* ───────────────────────── list helpers ───────────────────────── */

export const LIST_SEPARATOR = "|";

/** Split a pipe list, trim, drop empties, dedupe (case-insensitive, first wins). */
export function splitList(value: string | undefined | null): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of String(value ?? "").split(LIST_SEPARATOR)) {
    const v = raw.trim();
    if (!v) continue;
    const k = v.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(v);
  }
  return out;
}

export function joinList(values: readonly string[] | undefined | null): string {
  return (values ?? []).filter(Boolean).join(LIST_SEPARATOR);
}

export function normKey(value: string | undefined | null): string {
  return String(value ?? "").trim().toLowerCase();
}

/** Case-insensitive lookup of a display label in an option list; returns the canonical label. */
export function canonicalOption(value: string, options: readonly string[] | undefined): string | undefined {
  if (!options) return undefined;
  const k = normKey(value);
  return options.find((o) => normKey(o) === k);
}

export function emptyRow(spec: EntitySpec<unknown>): ImportRow {
  const row: ImportRow = {};
  for (const c of spec.columns) row[c.key] = "";
  return row;
}

export function findColumn(spec: EntitySpec<unknown>, key: string): ImportColumn | undefined {
  return spec.columns.find((c) => c.key === key);
}

export function lookupCI<V>(map: Map<string, V>, key: string): V | undefined {
  return map.get(normKey(key));
}

/** Lower-cased names of every contact in the directory, for `optionsFrom: "contacts"`. */
export function contactNameSet(): Set<string> {
  return new Set(CONTACT_DIRECTORY_NAMES.map((c) => normKey(c)).filter(Boolean));
}

/* ───────────────────────── live option overlays ───────────────────────── */

const VENDOR_SUB_TYPE_LABELS = VENDOR_SUB_TYPES.map((s) => s.label);
const CUSTOMER_SUB_TYPE_LABELS = CUSTOMER_SUB_TYPES.map((s) => s.label);
const PAYMENT_TERM_NAMES = PAYMENT_TERM_PRESETS.map((p) => p.name);
const PRICING_RULE_NAMES = PRICING_RULE_PRESETS.map((p) => p.name);
const PAYMENT_METHOD_LABELS = PAYMENT_METHODS.map((m) => m.label);
const CARRIER_LABELS = CARRIERS.map((c) => c.label);

const PARTNER_LIVE_OPTIONS: Record<string, string[]> = {
  vendorSubTypes: VENDOR_SUB_TYPE_LABELS,
  customerSubTypes: CUSTOMER_SUB_TYPE_LABELS,
  currency: [...CURRENCY_CODES],
  paymentTerm: PAYMENT_TERM_NAMES,
  pricingRules: PRICING_RULE_NAMES,
  paymentMethods: PAYMENT_METHOD_LABELS,
  carriers: CARRIER_LABELS,
};
const GROUP_LIVE_OPTIONS: Record<string, string[]> = {
  defaultVendorSubTypes: VENDOR_SUB_TYPE_LABELS,
  defaultCustomerSubTypes: CUSTOMER_SUB_TYPE_LABELS,
  currency: [...CURRENCY_CODES],
  paymentTerm: PAYMENT_TERM_NAMES,
  pricingRules: PRICING_RULE_NAMES,
  paymentMethods: PAYMENT_METHOD_LABELS,
  carriers: CARRIER_LABELS,
};

function buildColumns(data: EntityData, live: Record<string, string[]>): ImportColumn[] {
  return data.columns.map((c) => ({ ...c, options: live[c.key] ?? c.options }));
}

/* ───────────────────────── the two specs ───────────────────────── */

export const PARTNERS_IMPORT_SPEC: EntitySpec = {
  data: PARTNERS_DATA,
  entity: PARTNERS_DATA.entity,
  entitySingular: PARTNERS_DATA.entitySingular,
  nounLower: PARTNERS_DATA.nounLower,
  nounPluralLower: PARTNERS_DATA.nounPluralLower,
  moduleSlug: PARTNERS_DATA.moduleSlug,
  storageNamespace: "partners",
  keyColumn: PARTNERS_DATA.keyColumn,
  headerIdentityKeys: [PARTNERS_DATA.keyColumn],
  columns: buildColumns(PARTNERS_DATA, PARTNER_LIVE_OPTIONS),
  bulkSetFields: ["status", "partnerTypes"],
};

export const PARTNER_GROUPS_IMPORT_SPEC: EntitySpec = {
  data: PARTNER_GROUPS_DATA,
  entity: PARTNER_GROUPS_DATA.entity,
  entitySingular: PARTNER_GROUPS_DATA.entitySingular,
  nounLower: PARTNER_GROUPS_DATA.nounLower,
  nounPluralLower: PARTNER_GROUPS_DATA.nounPluralLower,
  moduleSlug: PARTNER_GROUPS_DATA.moduleSlug,
  storageNamespace: "partner-groups",
  keyColumn: PARTNER_GROUPS_DATA.keyColumn,
  headerIdentityKeys: [PARTNER_GROUPS_DATA.keyColumn],
  columns: buildColumns(PARTNER_GROUPS_DATA, GROUP_LIVE_OPTIONS),
  bulkSetFields: ["status", "scope"],
};
