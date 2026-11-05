/* Review row -> Vendor record (create) and Vendor patch (update) for the
 * Partners import. Pure functions; `VendorContext.upsertImportedVendors`
 * calls them. Unlike the page-side create mapper this keeps email, status,
 * description and secondary groups, and writes sub-type LABELS to the
 * top-level arrays (what the listing reads) and ids into configData (what
 * the edit modal reads). */

import type {
  ContactPerson,
  EnrichedContactPerson,
  SavedPaymentMethod,
  SavedPaymentTermConfig,
  SavedPricingRule,
  SavedShippingConfig,
  Vendor,
  VendorConfigData,
  PartnerType,
} from "../data/vendors";
import { CURRENT_USER } from "../data/currentUser";
import {
  PARTNER_GROUPS,
  PAYMENT_TERM_PRESETS,
  PRICING_RULE_PRESETS,
  PAYMENT_TYPE_CARDS,
  type PartnerGroupTemplate,
} from "../components/vendors/partnerConstants";
import { SHIPPING_CARRIER_CATALOG } from "../components/vendors/ShippingCarrierCard";
import {
  CARRIER_BY_LABEL,
  CONTACT_BY_NAME,
  COUNTRY_BY_DIAL_CODE,
  CREDIT_ENFORCEMENT_ID_BY_LABEL,
  CURRENCY_ID_BY_CODE,
  PARTNER_TYPE_ID_BY_LABEL,
  PAYMENT_METHOD_BY_LABEL,
  PAYMENT_TERM_BY_NAME,
  PRICING_RULE_BY_NAME,
  STATUS_ID_BY_LABEL,
  SUB_TYPE_ID_BY_LABEL,
  SUB_TYPE_LABEL_BY_ID,
  VENDOR_TYPE_BY_SUB_TYPE_ID,
  defaultCarrierMethodIds,
  lookupCI,
  normKey,
  splitList,
  type ImportRow,
} from "./spec";

/** What the mapper needs to know about a partner group (store record or seed). */
export interface GroupLookup {
  id: string;
  name: string;
  scope?: ("vendor" | "customer")[];
  template?: PartnerGroupTemplate;
}

export interface PartnersApplyContext {
  /** Every group the file may reference (session + seed). Defaults to PARTNER_GROUPS. */
  groups?: GroupLookup[];
  /** ISO timestamp for createdAt / updatedAt. Defaults to now. */
  now?: string;
}

export const DEFAULT_DIAL_CODE = "+1";
export const CREATED_BY_CONTACT: ContactPerson = {
  initials: CURRENT_USER.initials,
  name: CURRENT_USER.name,
  bgColor: "#6366f1",
  photoUrl: CURRENT_USER.photoUrl,
};

export function findVendorByName<T extends Pick<Vendor, "displayName" | "companyName">>(vendors: readonly T[], name: string): T | undefined {
  const k = normKey(name);
  if (!k) return undefined;
  return vendors.find((v) => normKey(v.displayName) === k || normKey(v.companyName) === k);
}

function groupsByName(ctx: PartnersApplyContext): Map<string, GroupLookup> {
  const list: GroupLookup[] = ctx.groups ?? PARTNER_GROUPS;
  const map = new Map<string, GroupLookup>();
  for (const g of list) {
    const k = normKey(g.name);
    if (k && !map.has(k)) map.set(k, g);
  }
  return map;
}

export function resolveGroups(row: ImportRow, ctx: PartnersApplyContext): { primary: GroupLookup | undefined; all: GroupLookup[] } {
  const byName = groupsByName(ctx);
  const all: GroupLookup[] = [];
  for (const name of splitList(row.partnerGroups)) {
    const g = lookupCI(byName, name);
    if (g && !all.some((x) => x.id === g.id)) all.push(g);
  }
  const primaryName = (row.primaryPartnerGroup ?? "").trim();
  const primary = (primaryName ? lookupCI(byName, primaryName) : undefined) ?? all[0];
  /* Primary first, the rest in file order. */
  const ordered = primary ? [primary, ...all.filter((x) => x.id !== primary.id)] : all;
  return { primary, all: ordered };
}

function toPartnerTypes(raw: string | undefined): PartnerType[] {
  const out: PartnerType[] = [];
  for (const v of splitList(raw)) {
    const id = lookupCI(PARTNER_TYPE_ID_BY_LABEL, v);
    if (id && !out.includes(id)) out.push(id);
  }
  return out;
}

function toSubTypeIds(raw: string | undefined, side: "vendor" | "customer"): string[] {
  const out: string[] = [];
  for (const v of splitList(raw)) {
    const id = lookupCI(SUB_TYPE_ID_BY_LABEL, v);
    if (!id) continue;
    const isVendor = !id.startsWith("customer_") && !["wholesale_buyer", "distributor", "end_consumer", "b2b_client", "reseller"].includes(id);
    if ((side === "vendor") !== isVendor) continue;
    if (!out.includes(id)) out.push(id);
  }
  return out;
}

export function paymentTermConfigFor(presetId: string | undefined): SavedPaymentTermConfig | undefined {
  const p = PAYMENT_TERM_PRESETS.find((x) => x.id === presetId);
  if (!p) return undefined;
  return {
    id: p.id,
    name: p.name,
    type: p.typeBadge,
    trigger: p.trigger,
    description: p.description,
    duration: p.duration,
    discountPercent: p.discountPercent,
    discountPeriod: p.discountPeriod,
  };
}

export function pricingRulesFor(ids: readonly string[] | undefined): SavedPricingRule[] {
  const out: SavedPricingRule[] = [];
  for (const id of ids ?? []) {
    const p = PRICING_RULE_PRESETS.find((x) => x.id === id);
    if (p) out.push({ id: p.id, name: p.name, type: p.category, basis: p.basis, description: p.description });
  }
  return out;
}

export function paymentMethodsFor(types: readonly string[] | undefined): SavedPaymentMethod[] {
  const out: SavedPaymentMethod[] = [];
  for (const type of types ?? []) {
    const card = PAYMENT_TYPE_CARDS.find((c) => c.id === type);
    if (card && !out.some((m) => m.type === type)) out.push({ id: `pm-${type}`, type, typeLabel: card.label, isSaved: true });
  }
  return out;
}

export function shippingConfigFor(carrierIds: readonly string[], base?: SavedShippingConfig): SavedShippingConfig {
  return {
    carrierServices: base?.carrierServices ?? [],
    vendorPreferences: carrierIds.map((carrier, i) => ({ carrier, methods: defaultCarrierMethodIds(carrier), isDefault: i === 0 })),
  };
}

function compact(values: (string | undefined)[]): string[] {
  const out: string[] = [];
  for (const v of values) if (v) out.push(v);
  return out;
}

/** Resolve list columns to ids. Unknown labels are dropped (validation warned already). */
export function resolveLabels(row: ImportRow) {
  const paymentTerm = row.paymentTerm?.trim() ? lookupCI(PAYMENT_TERM_BY_NAME, row.paymentTerm) : undefined;
  const pricingRuleIds = compact(splitList(row.pricingRules).map((n) => lookupCI(PRICING_RULE_BY_NAME, n)?.id));
  const paymentMethodTypes = compact(splitList(row.paymentMethods).map((l) => lookupCI(PAYMENT_METHOD_BY_LABEL, l)?.id as string | undefined));
  const carrierIds = compact(splitList(row.carriers).map((l) => lookupCI(CARRIER_BY_LABEL, l)?.id));
  const currency = row.currency?.trim() ? lookupCI(CURRENCY_ID_BY_CODE, row.currency) : undefined;
  const enforcement = row.creditEnforcement?.trim() ? lookupCI(CREDIT_ENFORCEMENT_ID_BY_LABEL, row.creditEnforcement) : undefined;
  const status = row.status?.trim() ? lookupCI(STATUS_ID_BY_LABEL, row.status) : undefined;
  return { paymentTerm, pricingRuleIds, paymentMethodTypes, carrierIds, currency, enforcement, status };
}

function contactsFor(raw: string | undefined): { global: ContactPerson[]; enriched: EnrichedContactPerson[] } {
  const global: ContactPerson[] = [];
  const enriched: EnrichedContactPerson[] = [];
  for (const name of splitList(raw)) {
    const c = lookupCI(CONTACT_BY_NAME, name);
    if (!c) continue;
    const initials = c.name.split(/\s+/).map((p) => p[0] ?? "").join("").slice(0, 2).toUpperCase();
    global.push({ initials, name: c.name, bgColor: c.avatarColor });
    enriched.push({
      id: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      secondaryPhone: c.secondaryPhone,
      extension: c.secondaryPhoneExt,
      department: c.department,
      avatarColor: c.avatarColor,
    });
  }
  return { global, enriched };
}

function composePhone(row: ImportRow): { code: string; phone: string } {
  const code = (row.phoneCode ?? "").trim() || DEFAULT_DIAL_CODE;
  const number = (row.phone ?? "").trim();
  return { code, phone: number ? `${code} ${number}` : "" };
}

function carrierName(id: string): string {
  return SHIPPING_CARRIER_CATALOG.find((c) => c.id === id)?.name ?? id;
}

/** Build a complete Vendor from a review row (create path). */
export function buildVendorFromImport(row: ImportRow, ctx: PartnersApplyContext, ids: { id: string; code: string }): Vendor {
  const now = ctx.now ?? new Date().toISOString();
  const name = (row.partnerName ?? "").trim();
  const { primary, all } = resolveGroups(row, ctx);
  const tpl = primary?.template ?? {};
  const r = resolveLabels(row);

  let partnerTypes = toPartnerTypes(row.partnerTypes);
  if (partnerTypes.length === 0) partnerTypes = primary?.scope?.length ? [...primary.scope] : ["vendor"];

  let vendorSubTypeIds = partnerTypes.includes("vendor") ? toSubTypeIds(row.vendorSubTypes, "vendor") : [];
  if (partnerTypes.includes("vendor") && !vendorSubTypeIds.includes("vendor_rules")) vendorSubTypeIds = ["vendor_rules", ...vendorSubTypeIds];
  let customerSubTypeIds = partnerTypes.includes("customer") ? toSubTypeIds(row.customerSubTypes, "customer") : [];
  if (partnerTypes.includes("customer") && !customerSubTypeIds.includes("customer_rules")) customerSubTypeIds = ["customer_rules", ...customerSubTypeIds];

  const { code, phone } = composePhone(row);
  const country = lookupCI(COUNTRY_BY_DIAL_CODE, code);
  const contacts = contactsFor(row.pointsOfContact);
  const pricingRuleIds = r.pricingRuleIds.length ? r.pricingRuleIds : tpl.pricingRuleIds ?? [];
  const paymentMethodTypes = r.paymentMethodTypes.length ? r.paymentMethodTypes : tpl.paymentMethodTypes ?? [];
  const description = (row.description ?? "").trim();

  const configData: VendorConfigData = {
    paymentMethods: paymentMethodsFor(paymentMethodTypes),
    paymentTermConfig: paymentTermConfigFor(r.paymentTerm?.id ?? tpl.paymentTermId),
    pricingRules: pricingRulesFor(pricingRuleIds),
    pointsOfContact: contacts.enriched,
    creditLimitConfig: {
      // Blank stores no currency: the partner inherits its group's, else the
      // base currency (spec 4.2, currency/partnerCurrency.ts).
      currency: r.currency,
      maxCreditLimit: 0,
      warningThreshold: 0,
      enforcement: r.enforcement ?? tpl.creditEnforcement ?? "none",
    },
    shippingConfig: shippingConfigFor(r.carrierIds),
    description,
    vendorSubTypes: vendorSubTypeIds,
    customerSubTypes: customerSubTypeIds,
  };

  return {
    id: ids.id,
    code: ids.code,
    companyName: name,
    displayName: name,
    partnerTypes,
    vendorType: VENDOR_TYPE_BY_SUB_TYPE_ID[vendorSubTypeIds[0] ?? ""] ?? "Vendor",
    vendorSubTypes: vendorSubTypeIds.map((id) => SUB_TYPE_LABEL_BY_ID.get(id) ?? id),
    customerSubTypes: customerSubTypeIds.map((id) => SUB_TYPE_LABEL_BY_ID.get(id) ?? id),
    itemCodes: [],
    partnerLocations: [],
    globalPointOfContacts: contacts.global,
    partnerGroup: primary?.id ?? "",
    partnerGroups: all.map((g) => g.id),
    partnerGroupName: primary?.name,
    phone,
    netProfitMargin: 0,
    creditUtilization: 0,
    services: "",
    defaultCarrierVendor: r.carrierIds[0] ? carrierName(r.carrierIds[0]) : "",
    defaultCarrierCustomer: "",
    country: country?.country ?? "United States",
    countryFlag: country?.flag ?? "\u{1F1FA}\u{1F1F8}",
    emailAddress: (row.email ?? "").trim(),
    createdByContact: CREATED_BY_CONTACT,
    profileImage: null,
    description,
    category: "services",
    status: r.status ?? "active",
    primaryContact: { name, email: (row.email ?? "").trim(), phone, designation: "Account Manager" },
    billingAddress: { street: (row.address ?? "").trim(), city: "", state: "", zipCode: "", country: country?.country ?? "United States" },
    taxId: "",
    paymentTerms: "net_30",
    creditLimit: 0,
    outstandingBalance: 0,
    totalOrders: 0,
    totalSpent: 0,
    website: (row.website ?? "").trim(),
    notes: "",
    createdAt: now,
    updatedAt: now,
    configData,
  };
}

/** Patch an existing Vendor from a review row (update path): blanks leave values unchanged, the name is never changed. */
export function patchVendorFromImport(existing: Vendor, row: ImportRow, ctx: PartnersApplyContext): Vendor {
  const now = ctx.now ?? new Date().toISOString();
  const next: Vendor = { ...existing, updatedAt: now };
  const cfg: VendorConfigData = { ...(existing.configData ?? {}) };
  const r = resolveLabels(row);
  const has = (k: string) => !!(row[k] ?? "").trim();

  if (r.status) next.status = r.status;

  if (has("partnerGroups") || has("primaryPartnerGroup")) {
    const { primary, all } = resolveGroups(row, ctx);
    if (primary) {
      next.partnerGroup = primary.id;
      next.partnerGroupName = primary.name;
    }
    if (all.length) next.partnerGroups = all.map((g) => g.id);
  }

  if (has("partnerTypes")) {
    const types = toPartnerTypes(row.partnerTypes);
    if (types.length) next.partnerTypes = types;
  }
  const types = next.partnerTypes ?? [];
  if (has("vendorSubTypes") && types.includes("vendor")) {
    let ids = toSubTypeIds(row.vendorSubTypes, "vendor");
    if (!ids.includes("vendor_rules")) ids = ["vendor_rules", ...ids];
    cfg.vendorSubTypes = ids;
    next.vendorSubTypes = ids.map((id) => SUB_TYPE_LABEL_BY_ID.get(id) ?? id);
    next.vendorType = VENDOR_TYPE_BY_SUB_TYPE_ID[ids[0]] ?? next.vendorType;
  }
  if (has("customerSubTypes") && types.includes("customer")) {
    let ids = toSubTypeIds(row.customerSubTypes, "customer");
    if (!ids.includes("customer_rules")) ids = ["customer_rules", ...ids];
    cfg.customerSubTypes = ids;
    next.customerSubTypes = ids.map((id) => SUB_TYPE_LABEL_BY_ID.get(id) ?? id);
  }

  if (has("phone")) {
    const { code, phone } = composePhone(row);
    next.phone = phone;
    next.primaryContact = { ...next.primaryContact, phone };
    const country = lookupCI(COUNTRY_BY_DIAL_CODE, code);
    if (has("phoneCode") && country) {
      next.country = country.country;
      next.countryFlag = country.flag;
    }
  }
  if (has("email")) {
    next.emailAddress = row.email.trim();
    next.primaryContact = { ...next.primaryContact, email: row.email.trim() };
  }
  if (has("website")) next.website = row.website.trim();
  if (has("address")) next.billingAddress = { ...next.billingAddress, street: row.address.trim() };
  if (has("description")) {
    next.description = row.description.trim();
    cfg.description = row.description.trim();
  }
  if (has("pointsOfContact")) {
    const contacts = contactsFor(row.pointsOfContact);
    if (contacts.global.length) {
      next.globalPointOfContacts = contacts.global;
      cfg.pointsOfContact = contacts.enriched;
    }
  }
  if (r.currency || r.enforcement) {
    cfg.creditLimitConfig = {
      // A blank currency keeps the partner's own (or none, so it inherits).
      currency: r.currency ?? cfg.creditLimitConfig?.currency,
      maxCreditLimit: cfg.creditLimitConfig?.maxCreditLimit ?? 0,
      warningThreshold: cfg.creditLimitConfig?.warningThreshold ?? 0,
      enforcement: r.enforcement ?? cfg.creditLimitConfig?.enforcement ?? "none",
    };
  }
  if (r.paymentTerm) cfg.paymentTermConfig = paymentTermConfigFor(r.paymentTerm.id);
  if (r.pricingRuleIds.length) cfg.pricingRules = pricingRulesFor(r.pricingRuleIds);
  if (r.paymentMethodTypes.length) cfg.paymentMethods = paymentMethodsFor(r.paymentMethodTypes);
  if (r.carrierIds.length) {
    cfg.shippingConfig = shippingConfigFor(r.carrierIds, cfg.shippingConfig);
    next.defaultCarrierVendor = carrierName(r.carrierIds[0]);
  }
  next.configData = cfg;
  return next;
}
