/* Entity specs for the Import / Export feature. Everything generic
 * (parser, validation, template, export, history) is parameterised by an
 * `EntitySpec`; the two entities are the two spec objects at the bottom.
 *
 * Raw column / copy / example data lives in `spec.data.mjs` (plain ESM so the
 * Node template generator can read it). Option lists that come from a TS
 * constant are OVERLAID here from the live constant, so the app can never
 * drift from the repo; `__tests__/spec.snapshots.test.ts` asserts the .mjs
 * snapshot equals the same constant so the checked-in files cannot drift
 * either. The file vocabulary is display LABELS ("Net 30", "USD", "Vendor
 * Rules"); the `*_BY_LABEL` maps below turn them into ids on apply. */

import type { Vendor } from "../data/vendors";
import { STATUS_LABELS } from "../data/vendors";
import type { PartnerGroup } from "../components/vendors/partnerConstants";
import type { PartnerGroupExtras } from "../context/PartnerGroupsContext";
import {
  CONTACT_DICTIONARY,
  CURRENCY_OPTIONS,
  CUSTOMER_SUB_TYPES,
  PARTNER_GROUPS,
  PAYMENT_TERM_PRESETS,
  PAYMENT_TYPE_CARDS,
  PRICING_RULE_PRESETS,
  VENDOR_SUB_TYPES,
} from "../components/vendors/partnerConstants";
import { SHIPPING_CARRIER_CATALOG, SHIPPING_CARRIER_METHODS } from "../components/vendors/ShippingCarrierCard";
import { getLastUpdated } from "../utils/lastUpdated";
import {
  ALL_ENTITY_DATA,
  CARRIERS,
  COUNTRY_CODES,
  CREDIT_ENFORCEMENT,
  GROUP_COUNTRIES,
  PARTNER_GROUPS_DATA,
  PARTNER_TYPES,
  PARTNERS_DATA,
  PAYMENT_METHODS,
} from "./spec.data.mjs";
import type { ColumnData, ColumnKind, EntityData, TextFormat } from "./spec.data.mjs";

export type { ColumnKind, TextFormat, EntityData, ColumnData };

/* ───────────────────────── row + column types ───────────────────────── */

/** A review row: every column key -> the cell text (pipe-joined for lists). */
export type ImportRow = Record<string, string>;

export interface ImportColumn extends ColumnData {
  kind: ColumnKind;
  /** Resolved option labels (live constants overlaid). */
  options?: string[];
}

export interface ExportField<T> {
  id: string;
  label: string;
  /** Cannot be unchecked in the export modal (the identity column). */
  locked?: boolean;
  /** True for the listing's own columns; the rest are import-only fields. */
  listing?: boolean;
  /** Listing column key when it differs from `id` (for default-checked lookup). */
  listingKey?: string;
  /** Info-icon tooltip in the Export modal. Falls back to the import column's description by label. */
  helpText?: string;
  extract: (row: T) => string | string[] | number | null | undefined;
}

export interface EntityRoutes {
  listing: string;
  history: string;
  /** Route pattern, `:importId` placeholder. */
  record: string;
  recordHref: (importId: string) => string;
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
  routes: EntityRoutes;
  keyColumn: string;
  /** Normalised header names whose presence identifies the header row. */
  headerIdentityKeys: string[];
  columns: ImportColumn[];
  bulkSetFields: string[];
  exportFields: ExportField<T>[];
  /** `<prefix>_YYYY-MM-DD.<ext>` */
  exportFilePrefix: string;
  template: {
    title: string;
    moduleLine: string;
    xlsxFileName: string;
    csvFileName: string;
    guideFileName: string;
    /** Absolute public URLs of the checked-in files. */
    xlsxUrl: string;
    csvUrl: string;
    guideUrl: string;
    uploadPath: string;
    instructions: EntityData["instructions"];
    compareTable: EntityData["compareTable"];
    validValues: EntityData["validValues"];
    guide: EntityData["guide"];
    fieldReferenceRows: { field: string; required: boolean; description: string; format: string; validValues: string; example: string }[];
  };
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

/* ───────────────────────── live label -> id maps ───────────────────────── */

function ciMap<V>(entries: [string, V][]): Map<string, V> {
  return new Map(entries.map(([k, v]) => [normKey(k), v]));
}
export function lookupCI<V>(map: Map<string, V>, key: string): V | undefined {
  return map.get(normKey(key));
}

/** "Vendor Rules" -> "vendor_rules" (vendor and customer sub-types together). */
export const SUB_TYPE_ID_BY_LABEL = ciMap<string>([
  ...VENDOR_SUB_TYPES.map((s) => [s.label, s.id] as [string, string]),
  ...CUSTOMER_SUB_TYPES.map((s) => [s.label, s.id] as [string, string]),
]);
/** "vendor_rules" -> "Vendor Rules" */
export const SUB_TYPE_LABEL_BY_ID = new Map<string, string>([
  ...VENDOR_SUB_TYPES.map((s) => [s.id, s.label] as [string, string]),
  ...CUSTOMER_SUB_TYPES.map((s) => [s.id, s.label] as [string, string]),
]);
/** First vendor sub-type id -> `Vendor.vendorType` label (mirrors CreatePartnerModal SUBTYPE_MAP). */
export const VENDOR_TYPE_BY_SUB_TYPE_ID: Record<string, string> = {
  vendor_rules: "Vendor",
  carrier: "Carrier",
  online_vendor: "Online Vendor",
  in_store_vendor: "In-Store Vendor",
  sub_contractor: "Sub Contractor",
  service_provider: "Service Provider",
};
export const PARTNER_TYPE_ID_BY_LABEL = ciMap<"vendor" | "customer">(PARTNER_TYPES.map((t) => [t.label, t.id as "vendor" | "customer"]));
export const PARTNER_TYPE_LABEL_BY_ID: Record<string, string> = Object.fromEntries(PARTNER_TYPES.map((t) => [t.id, t.label]));
export const PAYMENT_TERM_BY_NAME = ciMap(PAYMENT_TERM_PRESETS.map((p) => [p.name, p] as [string, (typeof PAYMENT_TERM_PRESETS)[number]]));
export const PRICING_RULE_BY_NAME = ciMap(PRICING_RULE_PRESETS.map((p) => [p.name, p] as [string, (typeof PRICING_RULE_PRESETS)[number]]));
/** Short file vocabulary ("ACH") -> live PAYMENT_TYPE_CARDS entry. */
export const PAYMENT_METHOD_BY_LABEL = ciMap(
  PAYMENT_METHODS.flatMap((m) => {
    const live = PAYMENT_TYPE_CARDS.find((c) => c.id === m.id);
    return live ? [[m.label, live] as [string, (typeof PAYMENT_TYPE_CARDS)[number]]] : [];
  }),
);
/** Short file vocabulary ("FedEx") -> live SHIPPING_CARRIER_CATALOG entry. */
export const CARRIER_BY_LABEL = ciMap(
  CARRIERS.flatMap((c) => {
    const live = SHIPPING_CARRIER_CATALOG.find((e) => e.id === c.id);
    return live ? [[c.label, live] as [string, (typeof SHIPPING_CARRIER_CATALOG)[number]]] : [];
  }),
);
/** Carrier id -> short file label. */
export const CARRIER_LABEL_BY_ID: Record<string, string> = Object.fromEntries(CARRIERS.map((c) => [c.id, c.label]));
export const PAYMENT_METHOD_LABEL_BY_ID: Record<string, string> = Object.fromEntries(PAYMENT_METHODS.map((m) => [m.id, m.label]));
/** Default (isDefault) method id per carrier, from the live method table. */
export function defaultCarrierMethodIds(carrierId: string): string[] {
  const methods = SHIPPING_CARRIER_METHODS[carrierId] ?? [];
  const def = methods.find((m) => m.isDefault) ?? methods[0];
  return def ? [def.id] : [];
}
/** "usd" -> "USD": the written ISO code, taken from the option label ("USD, US Dollar"). */
export const CURRENCY_CODE_BY_ID: Record<string, string> = Object.fromEntries(CURRENCY_OPTIONS.map((c) => [c.id, c.label.split(",")[0].trim()]));
/** "USD" -> "usd" */
export const CURRENCY_ID_BY_CODE = ciMap(CURRENCY_OPTIONS.map((c) => [CURRENCY_CODE_BY_ID[c.id], c.id] as [string, string]));
export const CREDIT_ENFORCEMENT_ID_BY_LABEL = ciMap(CREDIT_ENFORCEMENT.map((c) => [c.label, c.id] as [string, string]));
export const CREDIT_ENFORCEMENT_LABEL_BY_ID: Record<string, string> = Object.fromEntries(CREDIT_ENFORCEMENT.map((c) => [c.id, c.label]));
/** Contact name -> first CONTACT_DICTIONARY entry with that name (the live, runtime-extended dictionary). */
export const CONTACT_BY_NAME = ciMap(
  CONTACT_DICTIONARY.filter((c, i, arr) => arr.findIndex((x) => x.name === c.name) === i).map(
    (c) => [c.name, c] as [string, (typeof CONTACT_DICTIONARY)[number]],
  ),
);
/** Lower-cased names of every contact in the directory, for `optionsFrom: "contacts"`. */
export function contactNameSet(): Set<string> {
  return new Set(CONTACT_DICTIONARY.map((c) => normKey(c.name)).filter(Boolean));
}
/** "+46" -> { code, country, flag } (first entry wins for the shared "+1"). */
export const COUNTRY_BY_DIAL_CODE = ciMap(
  COUNTRY_CODES.filter((c, i, arr) => arr.findIndex((x) => x.code === c.code) === i).map((c) => [c.code, c] as [string, (typeof COUNTRY_CODES)[number]]),
);
export const GROUP_COUNTRY_BY_NAME = ciMap(GROUP_COUNTRIES.map((c) => [c.name, c] as [string, (typeof GROUP_COUNTRIES)[number]]));
export const BILLING_TYPE_ID_BY_LABEL = ciMap<string>([
  ["Domestic", "domestic"],
  ["International", "international"],
]);
export const BILLING_TYPE_LABEL_BY_ID: Record<string, string> = { domestic: "Domestic", international: "International" };
export const STATUS_ID_BY_LABEL = ciMap<"active" | "inactive">([
  ["Active", "active"],
  ["Inactive", "inactive"],
]);

/* ───────────────────────── live option overlays ───────────────────────── */

const CURRENCY_CODES_LIVE = CURRENCY_OPTIONS.map((c) => CURRENCY_CODE_BY_ID[c.id]);
const VENDOR_SUB_TYPE_LABELS = VENDOR_SUB_TYPES.map((s) => s.label);
const CUSTOMER_SUB_TYPE_LABELS = CUSTOMER_SUB_TYPES.map((s) => s.label);
const PAYMENT_TERM_NAMES = PAYMENT_TERM_PRESETS.map((p) => p.name);
const PRICING_RULE_NAMES = PRICING_RULE_PRESETS.map((p) => p.name);
const PAYMENT_METHOD_LABELS = PAYMENT_METHODS.filter((m) => PAYMENT_TYPE_CARDS.some((c) => c.id === m.id)).map((m) => m.label);
const CARRIER_LABELS = CARRIERS.filter((c) => SHIPPING_CARRIER_CATALOG.some((e) => e.id === c.id)).map((c) => c.label);

const PARTNER_LIVE_OPTIONS: Record<string, string[]> = {
  vendorSubTypes: VENDOR_SUB_TYPE_LABELS,
  customerSubTypes: CUSTOMER_SUB_TYPE_LABELS,
  currency: CURRENCY_CODES_LIVE,
  paymentTerm: PAYMENT_TERM_NAMES,
  pricingRules: PRICING_RULE_NAMES,
  paymentMethods: PAYMENT_METHOD_LABELS,
  carriers: CARRIER_LABELS,
};
const GROUP_LIVE_OPTIONS: Record<string, string[]> = {
  defaultVendorSubTypes: VENDOR_SUB_TYPE_LABELS,
  defaultCustomerSubTypes: CUSTOMER_SUB_TYPE_LABELS,
  currency: CURRENCY_CODES_LIVE,
  paymentTerm: PAYMENT_TERM_NAMES,
  pricingRules: PRICING_RULE_NAMES,
  paymentMethods: PAYMENT_METHOD_LABELS,
  carriers: CARRIER_LABELS,
};

function buildColumns(data: EntityData, live: Record<string, string[]>): ImportColumn[] {
  return data.columns.map((c) => ({ ...c, options: live[c.key] ?? c.options }));
}

function buildTemplate(data: EntityData): EntitySpec["template"] {
  return {
    title: `${data.entity} Import Template`,
    moduleLine: data.moduleLine,
    xlsxFileName: `${data.fileBase}.xlsx`,
    csvFileName: `${data.fileBase}.csv`,
    guideFileName: data.guideFile,
    xlsxUrl: `/templates/${data.fileBase}.xlsx`,
    csvUrl: `/templates/${data.fileBase}.csv`,
    guideUrl: `/templates/${data.guideFile}`,
    uploadPath: data.uploadPath,
    instructions: data.instructions,
    compareTable: data.compareTable,
    validValues: data.validValues,
    guide: data.guide,
    fieldReferenceRows: data.columns.map((c) => ({
      field: c.label,
      required: !!c.required,
      description: c.description,
      format: c.ref.format,
      validValues: c.ref.validValues ?? "",
      example: c.ref.example,
    })),
  };
}

/* ───────────────────────── export helpers ───────────────────────── */

const money = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export function isoDate(value: string | Date | undefined | null): string {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
const GROUP_NAME_BY_ID = new Map(PARTNER_GROUPS.map((g) => [g.id, g.name] as [string, string]));

/** Partner group name for an id, using the seed catalogue (session groups carry `partnerGroupName`). */
export function partnerGroupName(v: Pick<Vendor, "partnerGroup"> & { partnerGroupName?: string }): string {
  return v.partnerGroupName ?? GROUP_NAME_BY_ID.get(v.partnerGroup) ?? v.partnerGroup ?? "";
}

const PARTNER_EXPORT_FIELDS: ExportField<Vendor>[] = [
  /* the 22 listing columns, in listing order */
  { id: "partner_name", label: "Partner Name", locked: true, listing: true, extract: (v) => v.displayName },
  { id: "partner_type", label: "Partner Type", listing: true, extract: (v) => (v.partnerTypes ?? []).map((t) => PARTNER_TYPE_LABEL_BY_ID[t] ?? t) },
  { id: "vendor_sub_types", label: "Vendor Sub-Types", listing: true, extract: (v) => v.vendorSubTypes ?? [] },
  { id: "customer_sub_types", label: "Customer Sub-Types", listing: true, extract: (v) => v.customerSubTypes ?? [] },
  { id: "num_items", label: "No. of Items", listing: true, helpText: "How many items this partner supplies or buys.", extract: (v) => (v.itemCodes ?? []).length },
  { id: "partner_locations", label: "Partner Locations", listing: true, helpText: "The partner's sites, such as offices, warehouses and ship-to addresses.", extract: (v) => v.partnerLocations ?? [] },
  { id: "global_contacts", label: "Points of Contact", listing: true, extract: (v) => (v.globalPointOfContacts ?? []).map((c) => c.name) },
  { id: "partner_group", label: "Partner Group", listing: true, helpText: "The primary partner group whose configuration this partner inherits.", extract: (v) => partnerGroupName(v) },
  { id: "net_profit", label: "Net Profit ($)", listing: true, helpText: "The partner's net profit margin.", extract: (v) => (v.netProfitMargin ?? 0).toFixed(2) },
  { id: "credit_limit", label: "Credit Limit ($)", listing: true, helpText: "The most credit this partner can use.", extract: (v) => money.format(v.creditLimit ?? 0) },
  { id: "credit_utilization", label: "Credit Util. ($)", listing: true, helpText: "How much of the credit limit the partner is using now.", extract: (v) => money.format(v.creditUtilization ?? 0) },
  { id: "services", label: "Services", listing: true, helpText: "The services this partner provides.", extract: (v) => v.services ?? "" },
  { id: "carrier_vendor", label: "Carrier (Vendor)", listing: true, helpText: "The default shipping carrier when this partner acts as a vendor.", extract: (v) => v.defaultCarrierVendor ?? "" },
  { id: "carrier_customer", label: "Carrier (Customer)", listing: true, helpText: "The default shipping carrier when this partner acts as a customer.", extract: (v) => v.defaultCarrierCustomer ?? "" },
  { id: "country", label: "Country", listing: true, helpText: "The country the partner is based in.", extract: (v) => v.country ?? "" },
  { id: "website", label: "Website", listing: true, extract: (v) => v.website ?? "" },
  { id: "email", label: "Email", listing: true, extract: (v) => v.emailAddress ?? "" },
  { id: "last_updated_by", label: "Last Updated By", listing: true, helpText: "The person who last changed this partner.", extract: (v) => getLastUpdated(v.id, v.createdAt).name },
  { id: "last_updated_on", label: "Last Updated On", listing: true, helpText: "When this partner was last changed.", extract: (v) => isoDate(getLastUpdated(v.id, v.createdAt).date) },
  { id: "created_by", label: "Created By", listing: true, helpText: "The person who created this partner.", extract: (v) => v.createdByContact?.name ?? "" },
  { id: "created_on", label: "Created On", listing: true, helpText: "When this partner was created.", extract: (v) => isoDate(v.createdAt) },
  { id: "status", label: "Status", listing: true, extract: (v) => STATUS_LABELS[v.status] ?? v.status },
  /* remaining import fields */
  { id: "partner_groups", label: "Partner Groups", extract: (v) => (v.partnerGroups ?? [v.partnerGroup]).filter(Boolean).map((id) => GROUP_NAME_BY_ID.get(id) ?? (id === v.partnerGroup ? partnerGroupName(v) : id)) },
  { id: "phone_code", label: "Phone Country Code", extract: (v) => (v.phone ?? v.primaryContact?.phone ?? "").match(/^\+\d+/)?.[0] ?? "" },
  { id: "phone", label: "Phone Number", extract: (v) => (v.phone ?? v.primaryContact?.phone ?? "").replace(/^\+\d+\s*/, "") },
  { id: "address", label: "Address", extract: (v) => (v.billingAddress?.street === "—" ? "" : v.billingAddress?.street) ?? "" },
  { id: "description", label: "Description", extract: (v) => v.description ?? v.configData?.description ?? "" },
  { id: "currency", label: "Currency", extract: (v) => { const id = v.configData?.creditLimitConfig?.currency ?? ""; return CURRENCY_CODE_BY_ID[id.toLowerCase()] ?? id; } },
  { id: "credit_enforcement", label: "Credit Enforcement", extract: (v) => CREDIT_ENFORCEMENT_LABEL_BY_ID[v.configData?.creditLimitConfig?.enforcement ?? ""] ?? "" },
  { id: "payment_term", label: "Payment Term", extract: (v) => v.configData?.paymentTermConfig?.name ?? "" },
  { id: "pricing_rules", label: "Pricing Rules", extract: (v) => (v.configData?.pricingRules ?? []).map((r) => r.name) },
  { id: "payment_methods", label: "Payment Methods", extract: (v) => (v.configData?.paymentMethods ?? []).map((m) => PAYMENT_METHOD_LABEL_BY_ID[m.type] ?? m.typeLabel) },
  { id: "carriers", label: "Carriers", extract: (v) => (v.configData?.shippingConfig?.vendorPreferences ?? []).map((p) => CARRIER_LABEL_BY_ID[p.carrier] ?? p.carrier) },
];

/** What the Partner Groups exporter reads: a store record, optionally enriched by the listing page. */
export type GroupExportRow = PartnerGroup &
  Partial<PartnerGroupExtras> & {
    templateType?: "vendor" | "customer" | "both";
    createdOn?: string;
    partnerCount?: number;
    /** Resolved partner names; the UI attaches these (the record only holds ids). */
    memberNames?: string[];
    primaryMemberNames?: string[];
  };

function groupConfig(g: GroupExportRow): Record<string, unknown> {
  return (g.configData ?? {}) as Record<string, unknown>;
}
function groupScopeLabels(g: GroupExportRow): string[] {
  if (g.scope?.length) return g.scope.map((s) => PARTNER_TYPE_LABEL_BY_ID[s] ?? s);
  if (g.templateType === "both") return ["Vendor", "Customer"];
  if (g.templateType) return [PARTNER_TYPE_LABEL_BY_ID[g.templateType] ?? g.templateType];
  return [];
}

const GROUP_EXPORT_FIELDS: ExportField<GroupExportRow>[] = [
  /* the 11 listing columns, in listing order */
  { id: "group", label: "Group Name", locked: true, listing: true, extract: (g) => g.name },
  { id: "type", label: "Partner Group Type", listing: true, helpText: "Which partner types this group applies to: Vendor, Customer, or both.", extract: (g) => groupScopeLabels(g) },
  { id: "partners", label: "Linked Partners", listing: true, helpText: "How many partners belong to this group.", extract: (g) => g.partnerCount ?? g.memberCount ?? 0 },
  { id: "description", label: "Description", listing: true, extract: (g) => g.description ?? "" },
  { id: "last_updated_by", label: "Last Updated By", listing: true, helpText: "The person who last changed this group.", extract: (g) => getLastUpdated(g.id, g.createdAt ?? g.createdOn).name },
  { id: "last_updated_on", label: "Last Updated On", listing: true, helpText: "When this group was last changed.", extract: (g) => isoDate(getLastUpdated(g.id, g.createdAt ?? g.createdOn).date) },
  { id: "created_by", label: "Created By", listing: true, helpText: "The person who created this group.", extract: (g) => g.createdBy?.name ?? "" },
  { id: "created_on", label: "Created On", listing: true, helpText: "When this group was created.", extract: (g) => isoDate(g.createdAt) || g.createdOn || "" },
  { id: "status", label: "Status", listing: true, extract: (g) => g.status ?? "" },
  { id: "gl_accounts", label: "GL Accounts", listing: true, helpText: "The general ledger accounts linked to this group.", extract: () => "" },
  { id: "country", label: "Country", listing: true, extract: (g) => g.country ?? "" },
  /* remaining import fields */
  { id: "vendor_profiles", label: "Vendor Profiles", extract: (g) => (g.defaultVendorSubTypes ?? []).map((id) => SUB_TYPE_LABEL_BY_ID.get(id) ?? id) },
  { id: "customer_profiles", label: "Customer Profiles", extract: (g) => (g.defaultCustomerSubTypes ?? []).map((id) => SUB_TYPE_LABEL_BY_ID.get(id) ?? id) },
  { id: "linked_partners", label: "Linked Partners", extract: (g) => g.memberNames ?? g.memberIds ?? [] },
  { id: "primary_partners", label: "Primary Partners", extract: (g) => g.primaryMemberNames ?? ((groupConfig(g).primaryMemberIds as string[] | undefined) ?? []) },
  { id: "billing_type", label: "Billing Type", extract: (g) => { const b = String(groupConfig(g).configBillingType ?? ""); return BILLING_TYPE_LABEL_BY_ID[b] ?? b; } },
  { id: "currency", label: "Currency", extract: (g) => { const id = g.template?.currency ?? ""; return CURRENCY_CODE_BY_ID[id.toLowerCase()] ?? id; } },
  { id: "credit_enforcement", label: "Credit Enforcement", extract: (g) => CREDIT_ENFORCEMENT_LABEL_BY_ID[g.template?.creditEnforcement ?? ""] ?? "" },
  { id: "max_credit_limit", label: "Max Credit Limit", extract: (g) => String((groupConfig(g).configCreditLimit as { maxCreditLimit?: unknown } | undefined)?.maxCreditLimit ?? "") },
  { id: "warning_threshold", label: "Warning Threshold (%)", extract: (g) => String((groupConfig(g).configCreditLimit as { warningThreshold?: unknown } | undefined)?.warningThreshold ?? "") },
  { id: "payment_term", label: "Payment Term", extract: (g) => PAYMENT_TERM_PRESETS.find((p) => p.id === g.template?.paymentTermId)?.name ?? "" },
  { id: "pricing_rules", label: "Pricing Rules", extract: (g) => (g.template?.pricingRuleIds ?? []).map((id) => PRICING_RULE_PRESETS.find((p) => p.id === id)?.name ?? id) },
  { id: "payment_methods", label: "Payment Methods", extract: (g) => (g.template?.paymentMethodTypes ?? []).map((t) => PAYMENT_METHOD_LABEL_BY_ID[t] ?? t) },
  { id: "carriers", label: "Carriers", extract: (g) => (((groupConfig(g).configShipping as { vendorPreferences?: { carrier: string }[] } | undefined)?.vendorPreferences) ?? []).map((p) => CARRIER_LABEL_BY_ID[p.carrier] ?? p.carrier) },
];

/* ───────────────────────── the two specs ───────────────────────── */

export const PARTNERS_IMPORT_SPEC: EntitySpec<Vendor> = {
  data: PARTNERS_DATA,
  entity: PARTNERS_DATA.entity,
  entitySingular: PARTNERS_DATA.entitySingular,
  nounLower: PARTNERS_DATA.nounLower,
  nounPluralLower: PARTNERS_DATA.nounPluralLower,
  moduleSlug: PARTNERS_DATA.moduleSlug,
  storageNamespace: "partners",
  routes: {
    listing: "/vendors",
    history: "/vendors/imports",
    record: "/vendors/imports/:importId",
    recordHref: (id) => `/vendors/imports/${id}`,
  },
  keyColumn: PARTNERS_DATA.keyColumn,
  headerIdentityKeys: [PARTNERS_DATA.keyColumn],
  columns: buildColumns(PARTNERS_DATA, PARTNER_LIVE_OPTIONS),
  bulkSetFields: ["status", "partnerTypes"],
  exportFields: PARTNER_EXPORT_FIELDS,
  exportFilePrefix: "Partners_Export",
  template: buildTemplate(PARTNERS_DATA),
};

export const PARTNER_GROUPS_IMPORT_SPEC: EntitySpec<GroupExportRow> = {
  data: PARTNER_GROUPS_DATA,
  entity: PARTNER_GROUPS_DATA.entity,
  entitySingular: PARTNER_GROUPS_DATA.entitySingular,
  nounLower: PARTNER_GROUPS_DATA.nounLower,
  nounPluralLower: PARTNER_GROUPS_DATA.nounPluralLower,
  moduleSlug: PARTNER_GROUPS_DATA.moduleSlug,
  storageNamespace: "partner-groups",
  routes: {
    listing: "/partners/groups",
    history: "/partners/groups/imports",
    record: "/partners/groups/imports/:importId",
    recordHref: (id) => `/partners/groups/imports/${id}`,
  },
  keyColumn: PARTNER_GROUPS_DATA.keyColumn,
  headerIdentityKeys: [PARTNER_GROUPS_DATA.keyColumn],
  columns: buildColumns(PARTNER_GROUPS_DATA, GROUP_LIVE_OPTIONS),
  bulkSetFields: ["status", "scope"],
  exportFields: GROUP_EXPORT_FIELDS,
  exportFilePrefix: "Partner_Groups_Export",
  template: buildTemplate(PARTNER_GROUPS_DATA),
};

/** All specs, keyed by storage namespace (how the UI picks one from a route). */
export const IMPORT_SPECS: Record<string, EntitySpec<unknown>> = {
  [PARTNERS_IMPORT_SPEC.storageNamespace]: PARTNERS_IMPORT_SPEC as EntitySpec<unknown>,
  [PARTNER_GROUPS_IMPORT_SPEC.storageNamespace]: PARTNER_GROUPS_IMPORT_SPEC as EntitySpec<unknown>,
};

export function getImportSpec(namespaceOrSlug: string): EntitySpec<unknown> | undefined {
  return IMPORT_SPECS[namespaceOrSlug] ?? Object.values(IMPORT_SPECS).find((s) => s.moduleSlug === namespaceOrSlug);
}

/** Sanity: the .mjs data blocks the specs were built from, in the same order as ALL_ENTITY_DATA. */
export const ALL_IMPORT_SPECS: EntitySpec<unknown>[] = ALL_ENTITY_DATA.map((d) =>
  d === PARTNERS_DATA ? (PARTNERS_IMPORT_SPEC as EntitySpec<unknown>) : (PARTNER_GROUPS_IMPORT_SPEC as EntitySpec<unknown>),
);
