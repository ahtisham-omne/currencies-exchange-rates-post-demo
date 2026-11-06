import { PARTNER_GROUPS } from "./partnerConstants";

/**
 * Templated defaults a Partner Group provides to a Partner created under it.
 *
 * Today this returns identity-level defaults derivable from the group record
 * itself (name, country, sub-types). When the Partner Group Setup tab gains
 * inline editors (Phase 2 wiring), this helper will also surface
 * payment-method / pricing-rule / credit-policy defaults from the group's
 * configured templated values. Keeping the shape stable here so callers don't
 * have to change when more fields land.
 */
export interface GroupDefaults {
  groupId: string;
  groupName: string;
  /** Country flag inherited from the group, displayed as a hint, not a hard default. */
  country?: string;
  countryFlag?: string;
  /** When the group has templated sub-types, list them here so Partner Step 2 can pre-select. */
  defaultVendorSubTypes?: string[];
  defaultCustomerSubTypes?: string[];
  /** Currency — the only Billing & Shipping field templated at group level. */
  currency?: string;
  /** Default payment term preset id. */
  paymentTermId?: string;
  /** Default pricing rule preset ids. */
  pricingRuleIds?: string[];
  /** Default credit-limit enforcement level. */
  creditEnforcement?: string;
  /** Default accepted payment method types. */
  paymentMethodTypes?: string[];
}

export function getGroupDefaults(groupId: string | null | undefined): GroupDefaults | null {
  if (!groupId) return null;
  const g = PARTNER_GROUPS.find((x) => x.id === groupId);
  if (!g) return null;
  return {
    groupId: g.id,
    groupName: g.name,
    country: g.country,
    countryFlag: g.countryFlag,
    currency: g.template?.currency,
    paymentTermId: g.template?.paymentTermId,
    pricingRuleIds: g.template?.pricingRuleIds,
    creditEnforcement: g.template?.creditEnforcement,
    paymentMethodTypes: g.template?.paymentMethodTypes,
  };
}

/**
 * Minimal "is this value inherited or overridden?" check used by the
 * inherited / overridden badges on Partner Step 3 fields. Returns "inherited"
 * if the partner's value matches the group's default, "overridden" otherwise,
 * and "absent" if the group doesn't template this field at all.
 */
export type InheritanceState = "inherited" | "overridden" | "absent";

export function compareToGroupDefault(
  partnerValue: unknown,
  groupValue: unknown
): InheritanceState {
  if (groupValue === undefined || groupValue === null || groupValue === "") return "absent";
  if (partnerValue === undefined || partnerValue === null || partnerValue === "") return "absent";
  return partnerValue === groupValue ? "inherited" : "overridden";
}

/**
 * Whether a partner deviates from its group's templated defaults.
 * Drives the "Modified" / "Custom Configuration" chip on partner rows
 * in the listing (mirrors the Items module's deviation indicator
 * Eli flagged as the canonical reference).
 *
 * Today this runs off a deterministic id-hash so the demo shows the
 * chip on a stable subset (~40%) of partners — when partner-level
 * override storage lands we swap this for a real diff against
 * getGroupDefaults() + the partner's configData.
 */
export function partnerHasGroupOverrides(partnerId: string | null | undefined): boolean {
  if (!partnerId) return false;
  let h = 0;
  for (let i = 0; i < partnerId.length; i++) h = partnerId.charCodeAt(i) + ((h << 5) - h);
  // ~70% of partners flagged — visible across most rows so the indicator
  // reads as a real pattern in the demo. Real wiring will tighten this
  // to actual diffs against the group template.
  return Math.abs(h) % 100 < 70;
}

/**
 * Per-section override flag — drives the small amber dot on the
 * Configure modal's nav-rail sections. For now this runs off a stable
 * partnerId+sectionId hash so the demo shows the indicator on a
 * realistic subset; real wiring lands when section-level diffs are
 * available from configData. Returns false when either id is missing
 * (e.g. create flow has no partnerId yet).
 */
export function sectionOverrideForVendor(
  partnerId: string | null | undefined,
  sectionId: string | null | undefined,
): boolean {
  if (!partnerId || !sectionId) return false;
  if (!partnerHasGroupOverrides(partnerId)) return false;
  const key = `${partnerId}::${sectionId}`;
  let h = 0;
  for (let i = 0; i < key.length; i++) h = key.charCodeAt(i) + ((h << 5) - h);
  // ~75% of sections under a modified partner are themselves overridden
  // — high enough that the nav-rail dots are clearly visible without
  // lighting up *every* section (which would lose the contrast).
  return Math.abs(h) % 100 < 75;
}
