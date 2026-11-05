/* Review row -> CreatePartnerGroupModal-shaped payload for the Partner
 * Groups import. The context feeds the payload through its own
 * `payloadToRecord`, so create and update follow exactly the modal's path.
 * Blank cells are simply left out of the payload, which `payloadToRecord`
 * reads as "keep the existing value". */

import type { PartnerGroupRecord } from "../context/PartnerGroupsContext";
import {
  BILLING_TYPE_ID_BY_LABEL,
  CREDIT_ENFORCEMENT_ID_BY_LABEL,
  CURRENCY_ID_BY_CODE,
  GROUP_COUNTRY_BY_NAME,
  PARTNER_TYPE_ID_BY_LABEL,
  SUB_TYPE_ID_BY_LABEL,
  lookupCI,
  normKey,
  splitList,
  type ImportRow,
} from "./spec";
import { paymentMethodsFor, paymentTermConfigFor, pricingRulesFor, resolveLabels, shippingConfigFor } from "./partnersApply";
import type { SavedShippingConfig } from "../data/vendors";

export interface PartnerLookup {
  id: string;
  displayName: string;
  companyName: string;
}

export interface GroupsApplyContext {
  /** Every partner the file may reference by name. */
  partners?: PartnerLookup[];
}

export const GROUP_PAYLOAD_KIND = "partner-group" as const;

export function findGroupByName<T extends { name: string }>(groups: readonly T[], name: string): T | undefined {
  const k = normKey(name);
  if (!k) return undefined;
  return groups.find((g) => normKey(g.name) === k);
}

function partnersByName(ctx: GroupsApplyContext): Map<string, PartnerLookup> {
  const map = new Map<string, PartnerLookup>();
  for (const p of ctx.partners ?? []) {
    for (const n of [p.displayName, p.companyName]) {
      const k = normKey(n);
      if (k && !map.has(k)) map.set(k, p);
    }
  }
  return map;
}

/** Resolve partner names to ids; unknown names are dropped (validation warned). */
export function resolveMemberIds(raw: string | undefined, ctx: GroupsApplyContext): string[] {
  const byName = partnersByName(ctx);
  const out: string[] = [];
  for (const name of splitList(raw)) {
    const p = lookupCI(byName, name);
    if (p && !out.includes(p.id)) out.push(p.id);
  }
  return out;
}

function scopeIds(raw: string | undefined): ("vendor" | "customer")[] {
  const out: ("vendor" | "customer")[] = [];
  for (const v of splitList(raw)) {
    const id = lookupCI(PARTNER_TYPE_ID_BY_LABEL, v);
    if (id && !out.includes(id)) out.push(id);
  }
  return out;
}

function subTypeIds(raw: string | undefined): string[] {
  const out: string[] = [];
  for (const v of splitList(raw)) {
    const id = lookupCI(SUB_TYPE_ID_BY_LABEL, v);
    if (id && !out.includes(id)) out.push(id);
  }
  return out;
}

/**
 * Build the payload `payloadToRecord` expects. `base` is the existing record
 * on an update; on a create the template defaults (Domestic, USD, None) are
 * filled in so the group renders like one made in the modal.
 */
export function buildGroupPayloadFromImport(row: ImportRow, ctx: GroupsApplyContext, base?: PartnerGroupRecord): Record<string, unknown> {
  const has = (k: string) => !!(row[k] ?? "").trim();
  const isCreate = !base;
  const r = resolveLabels(row);
  const baseCfg = (base?.configData ?? {}) as Record<string, unknown>;
  const payload: Record<string, unknown> = { kind: GROUP_PAYLOAD_KIND, groupName: (row.groupName ?? "").trim() };

  if (has("status")) payload.status = normKey(row.status) === "inactive" ? "Inactive" : "Active";
  else if (isCreate) payload.status = "Active";

  if (has("country")) {
    const c = lookupCI(GROUP_COUNTRY_BY_NAME, row.country);
    payload.country = c?.name ?? row.country.trim();
    payload.countryFlag = c?.flag ?? "";
  }
  if (has("description")) payload.description = row.description.trim();
  else if (isCreate) payload.description = "";

  if (has("scope")) payload.scope = scopeIds(row.scope);
  if (has("defaultVendorSubTypes")) payload.defaultVendorSubTypes = subTypeIds(row.defaultVendorSubTypes);
  if (has("defaultCustomerSubTypes")) payload.defaultCustomerSubTypes = subTypeIds(row.defaultCustomerSubTypes);

  let memberIds: string[] | undefined;
  if (has("memberIds")) {
    memberIds = resolveMemberIds(row.memberIds, ctx);
    payload.memberIds = memberIds;
  }
  if (has("primaryMemberIds")) {
    const members = memberIds ?? base?.memberIds ?? [];
    payload.primaryMemberIds = resolveMemberIds(row.primaryMemberIds, ctx).filter((id) => members.includes(id));
  }

  /* Template configuration (Step 3 keys, flat like handleSave spreads them). */
  if (has("billingType")) payload.configBillingType = lookupCI(BILLING_TYPE_ID_BY_LABEL, row.billingType) ?? "domestic";
  else if (isCreate) payload.configBillingType = "domestic";

  const baseCredit = (baseCfg.configCreditLimit ?? {}) as Record<string, unknown>;
  const currency = has("currency") ? lookupCI(CURRENCY_ID_BY_CODE, row.currency) : undefined;
  const enforcement = has("creditEnforcement") ? lookupCI(CREDIT_ENFORCEMENT_ID_BY_LABEL, row.creditEnforcement) : undefined;
  if (isCreate || currency || enforcement || has("maxCreditLimit") || has("warningThreshold")) {
    payload.configCreditLimit = {
      ...baseCredit,
      currency: currency ?? (baseCredit.currency as string | undefined) ?? "usd",
      enforcement: enforcement ?? (baseCredit.enforcement as string | undefined) ?? "none",
      maxCreditLimit: has("maxCreditLimit") ? row.maxCreditLimit.replace(/,/g, "").trim() : (baseCredit.maxCreditLimit as string | undefined) ?? "",
      warningThreshold: has("warningThreshold") ? row.warningThreshold.replace(/,/g, "").trim() : (baseCredit.warningThreshold as string | undefined) ?? "",
    };
  }
  if (r.paymentTerm) payload.configPaymentTerm = paymentTermConfigFor(r.paymentTerm.id);
  if (r.pricingRuleIds.length) payload.configPricingRules = pricingRulesFor(r.pricingRuleIds);
  if (r.paymentMethodTypes.length) payload.configPaymentMethods = paymentMethodsFor(r.paymentMethodTypes);
  if (r.carrierIds.length) payload.configShipping = shippingConfigFor(r.carrierIds, baseCfg.configShipping as SavedShippingConfig | undefined);
  return payload;
}
