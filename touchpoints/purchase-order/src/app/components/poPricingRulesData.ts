/* ═══════════════════════════════════════════════════════════════════════════
 *  Vendor pricing rule book (Purchase Orders)
 *  ──────────────────────────────────────────
 *  Ported from the Sales-Order-V5 repo (see
 *  purchase order snapshots/PO_PRICING_RULES_PORT_AUDIT.md). Compute logic
 *  and data shape are 1:1 with SO. The one adaptation: rules attach to a
 *  vendor (we buy from them) instead of a customer (SO sells to them).
 *
 *  A rule has a set of `vendors` it applies to and a set of
 *  `appliesToItemCodes` it covers. When a PO is created in Draft, the PO
 *  inherits the rules whose `vendors` includes the PO's vendor.name. For
 *  each such rule and each po.lineItems[i] whose itemNumber is in the
 *  rule's `appliesToItemCodes`, we evaluate the line's qty against the
 *  rule's tiers — if a tier matches, the rule discounts (or premium-
 *  surcharges) that line at the tier's rate.
 *
 *  `source: 'template'` rules ship from the system catalog and can't be
 *  edited; `source: 'custom'` rules were authored on this vendor and
 *  can be modified in Draft.
 *
 *  Retro-apply rule (locked 2026-07-20): a newly authored rule
 *  automatically retro-applies to any Draft-state PO with a matching
 *  vendor. POs past Draft freeze their rule set at the moment they
 *  advance.
 * ═══════════════════════════════════════════════════════════════════════════ */

/* Feature flag — parks the whole pricing-rules UI when off. During
   development we keep it on so all surfaces render; when release-cutting
   flip to false to hide every touchpoint (hover breakdown, sidebar block,
   manage modal, print footer) without ripping out the wiring. Same
   pattern used for Purchase Requests in the planner. */
export const SHOW_PO_PRICING_RULES = true;

export type RuleSource = "template" | "custom";
export type RuleType = "discount" | "premium";

export interface PricingRuleTier {
  /** Inclusive lower bound. The tier matches when line.qty >= minQty. */
  minQty: number;
  /** Inclusive upper bound. `null` = unbounded (top tier). */
  maxQty: number | null;
  /** Numeric rate. Interpreted as a percentage off the line subtotal when
   *  `unit === '%'`, or as a flat dollar amount per qty when `unit === '$'`. */
  rate: number;
  unit: "%" | "$";
}

export interface VendorPricingRule {
  id: string;
  name: string;
  description: string;
  type: RuleType;
  source: RuleSource;
  /** Vendors this rule is configured for. The PO inherits rules whose
   *  `vendors` includes its `vendor.name` field. */
  vendors: string[];
  /** Item codes (itemNumber) this rule applies to. A line whose
   *  itemNumber is not in this list never triggers the rule, even if
   *  all other conditions match. */
  appliesToItemCodes: string[];
  /** Tier ladder — must be non-empty. For a single-rate rule, use one
   *  entry with `minQty: 1, maxQty: null`. */
  tiers: PricingRuleTier[];
  /** ISO date strings. `validTo: null` means open-ended. */
  validFrom: string;
  validTo: string | null;
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  Vendor rule book
 *
 *  Vendors are picked from `poStore.ts`'s VENDOR_DETAILS map; item codes
 *  are picked from the first several entries of `catalogData.ts`. Tier
 *  ladders model realistic volume-break behavior for automotive parts
 *  procurement (bulk brake pads, hydraulic pumps, etc.).
 * ═══════════════════════════════════════════════════════════════════════════ */
export const VENDOR_PRICING_RULES: VendorPricingRule[] = [
  {
    id: "vpr-gm-volume",
    name: "GM Fleet Volume Break",
    description:
      "GM parts on standing fleet contracts earn 4% off at 10+ units; 7% at 25+; 10% at 50+.",
    type: "discount",
    source: "template",
    vendors: ["General Motors (GM)"],
    /* Extended to cover the actual demo PO 395-9900 item codes so the
       Items Detail Modal's Pricing Rules card lights up on the primary
       demo (buyer 2026-07-22). Includes HYD, BRG, ELC and legacy
       synthetic codes for the listing generator. */
    appliesToItemCodes: [
      "HYD-4420-A1",
      "BRG-7750-C3",
      "ELC-1190-H2",
      "482910-34-17",
      "758493-67-31",
    ],
    tiers: [
      { minQty: 1, maxQty: 9, rate: 3, unit: "%" },
      { minQty: 10, maxQty: 24, rate: 4, unit: "%" },
      { minQty: 25, maxQty: 49, rate: 7, unit: "%" },
      { minQty: 50, maxQty: null, rate: 10, unit: "%" },
    ],
    validFrom: "2026-01-01",
    validTo: "2026-12-31",
  },
  {
    id: "vpr-gm-govt-contract",
    name: "Government Contract Pricing",
    description:
      "3% off across the full GM fleet-parts catalogue under the standing government contract.",
    type: "discount",
    source: "template",
    vendors: ["General Motors (GM)"],
    appliesToItemCodes: [
      "HYD-4420-A1",
      "BRG-7750-C3",
      "ELC-1190-H2",
      "ALU-5580-T6",
      "FST-8810-SS",
    ],
    tiers: [{ minQty: 1, maxQty: null, rate: 3, unit: "%" }],
    validFrom: "2026-01-01",
    validTo: "2026-12-31",
  },
  {
    id: "vpr-gm-expedited-premium",
    name: "Expedited Build Premium",
    description:
      "12% surcharge on hydraulic + electrical builds when the buyer requests an expedited production slot.",
    type: "premium",
    source: "custom",
    vendors: ["General Motors (GM)"],
    appliesToItemCodes: ["HYD-4420-A1", "ELC-1190-H2"],
    tiers: [{ minQty: 1, maxQty: null, rate: 12, unit: "%" }],
    validFrom: "2026-01-01",
    validTo: "2026-12-31",
  },
  {
    id: "vpr-toyota-contract",
    name: "Toyota Master Contract",
    description:
      "5% flat discount on hydraulics + cooling parts sourced through the annual master contract.",
    type: "discount",
    source: "template",
    vendors: ["Toyota Technical Center (TTC)"],
    appliesToItemCodes: ["519374-21-08"],
    tiers: [{ minQty: 1, maxQty: null, rate: 5, unit: "%" }],
    validFrom: "2026-01-01",
    validTo: "2026-12-31",
  },
  {
    id: "vpr-ford-lighting-volume",
    name: "Ford Lighting Bulk",
    description: "$15 off per lightbar module when ordering 20+ units from Ford.",
    type: "discount",
    source: "custom",
    vendors: ["Ford Motor Company"],
    appliesToItemCodes: ["637281-45-22"],
    tiers: [{ minQty: 20, maxQty: null, rate: 15, unit: "$" }],
    validFrom: "2026-01-01",
    validTo: "2026-12-31",
  },
  {
    id: "vpr-tesla-rush-premium",
    name: "Tesla Expedite Premium",
    description:
      "8% surcharge on bearing sets when Tesla is asked to expedite past their standard lead time.",
    type: "premium",
    source: "template",
    vendors: ["Tesla, Inc."],
    appliesToItemCodes: ["758493-67-31"],
    tiers: [{ minQty: 1, maxQty: null, rate: 8, unit: "%" }],
    validFrom: "2026-01-01",
    validTo: "2026-12-31",
  },
  {
    id: "vpr-chrysler-cooling-bundle",
    name: "Chrysler Cooling Bundle",
    description:
      "6% off when ordering radiator + coolant hose kit together (2+ of each).",
    type: "discount",
    source: "custom",
    vendors: ["Chrysler (Stellantis N.V.)"],
    appliesToItemCodes: ["391847-12-55", "654928-56-73"],
    tiers: [{ minQty: 2, maxQty: null, rate: 6, unit: "%" }],
    validFrom: "2026-01-01",
    validTo: "2026-12-31",
  },
  {
    id: "vpr-honda-ignition-volume",
    name: "Honda Ignition Volume",
    description: "3% off spark plug boxes at 100+ units; 6% at 250+.",
    type: "discount",
    source: "template",
    vendors: ["Honda Motor Co., Ltd. (USA)"],
    appliesToItemCodes: ["246810-33-19"],
    tiers: [
      { minQty: 100, maxQty: 249, rate: 3, unit: "%" },
      { minQty: 250, maxQty: null, rate: 6, unit: "%" },
    ],
    validFrom: "2026-01-01",
    validTo: "2026-12-31",
  },
  {
    id: "vpr-bmw-sensor-flat",
    name: "BMW Sensor Contract Rate",
    description: "$5 off per proximity sensor module — standing quarterly contract.",
    type: "discount",
    source: "template",
    vendors: ["BMW of North America"],
    appliesToItemCodes: ["873561-78-42"],
    tiers: [{ minQty: 1, maxQty: null, rate: 5, unit: "$" }],
    validFrom: "2026-01-01",
    validTo: "2026-12-31",
  },
];

/* ═══════════════════════════════════════════════════════════════════════════
 *  Helpers — 1:1 with the SO source module.
 * ═══════════════════════════════════════════════════════════════════════════ */

/** Return every rule whose `vendors` list includes the given name. */
export function getVendorRules(vendorName: string): VendorPricingRule[] {
  return VENDOR_PRICING_RULES.filter((r) => r.vendors.includes(vendorName));
}

/** Add a vendor to an existing rule's `vendors[]` list so the rule
 *  becomes applicable to that vendor. Used by the Duplicate PO flow's
 *  "Port to new vendor" action (phase 4) to carry a source-vendor rule
 *  onto the duplicate's newly-picked vendor without duplicating the
 *  rule row. No-op when the rule is missing or the vendor is already
 *  attached. Mutates the shared table in place — same mock-store
 *  pattern the rest of `poPricingRulesData.ts` uses. */
export function attachRuleToVendor(ruleId: string, vendorName: string): boolean {
  const rule = VENDOR_PRICING_RULES.find((r) => r.id === ruleId);
  if (!rule) return false;
  const trimmed = vendorName.trim();
  if (!trimmed) return false;
  if (rule.vendors.some((v) => v.trim().toLowerCase() === trimmed.toLowerCase())) {
    return false;
  }
  rule.vendors.push(trimmed);
  return true;
}

/** Lookup index — handy when reconciling modal-shape rules back to the
 *  vendor rule book (e.g. recomputing amounts after a per-item toggle). */
export const VENDOR_PRICING_RULES_BY_ID = new Map(
  VENDOR_PRICING_RULES.map((r) => [r.id, r]),
);

/** Append a freshly authored custom rule to the vendor rule book so it
 *  becomes eligible for the given vendor on subsequent renders. Used by
 *  POCreatePricingRuleModal (Create Rule) and POBrowsePricingTemplatesModal
 *  (Duplicate). No-op guard for rules missing a name or tier ladder. */
export function createCustomRuleForVendor(
  vendorName: string,
  input: {
    name: string;
    description?: string;
    type: RuleType;
    tiers: PricingRuleTier[];
    appliesToItemCodes?: string[];
    validFrom?: string;
    validTo?: string | null;
  },
): VendorPricingRule | null {
  const name = input.name.trim();
  if (!name || input.tiers.length === 0) return null;
  const rule: VendorPricingRule = {
    id: `vpr-custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    description: input.description?.trim() ?? "",
    type: input.type,
    source: "custom",
    vendors: [vendorName],
    appliesToItemCodes: input.appliesToItemCodes ?? [],
    tiers: input.tiers,
    validFrom: input.validFrom ?? new Date().toISOString().slice(0, 10),
    validTo: input.validTo ?? null,
  };
  VENDOR_PRICING_RULES.push(rule);
  VENDOR_PRICING_RULES_BY_ID.set(rule.id, rule);
  return rule;
}

/** Overwrite an existing custom rule in-place. Used by the Edit Rule
 *  flow (buyer 2026-07-29 bug: "Edit says 'coming soon'") — the manage
 *  modal's kebab menu opens POCreatePricingRuleModal in edit mode; on
 *  Save Rule we mutate the source entry rather than push a duplicate.
 *  Template rules (`source === 'template'`) are read-only — Edit is
 *  gated in the UI, so this helper simply refuses if called with a
 *  template rule id. Returns the updated rule, or null on any guard
 *  failure. */
export function updateCustomRule(
  ruleId: string,
  input: {
    name: string;
    description?: string;
    type: RuleType;
    tiers: PricingRuleTier[];
    appliesToItemCodes?: string[];
    validFrom?: string;
    validTo?: string | null;
  },
): VendorPricingRule | null {
  const rule = VENDOR_PRICING_RULES_BY_ID.get(ruleId);
  if (!rule) return null;
  if (rule.source === "template") return null;
  const name = input.name.trim();
  if (!name || input.tiers.length === 0) return null;
  rule.name = name;
  rule.description = input.description?.trim() ?? "";
  rule.type = input.type;
  rule.tiers = input.tiers;
  if (input.appliesToItemCodes !== undefined) {
    rule.appliesToItemCodes = input.appliesToItemCodes;
  }
  if (input.validFrom !== undefined) {
    rule.validFrom = input.validFrom;
  }
  if (input.validTo !== undefined) {
    rule.validTo = input.validTo;
  }
  return rule;
}

/** Pick the tier whose [minQty, maxQty] band contains the given qty, or
 *  `null` if no tier matches (e.g. qty below the lowest minQty). */
export function pickTier(rule: VendorPricingRule, qty: number): PricingRuleTier | null {
  return (
    rule.tiers.find((t) => qty >= t.minQty && (t.maxQty === null || qty <= t.maxQty)) ??
    null
  );
}

/** Evaluate the rule against a single line. Returns the dollar impact
 *  (positive = discount or premium magnitude — direction is encoded in
 *  rule.type, not the sign of this number) and whether the rule actually
 *  applies to this line at all. */
export function evaluateRuleForLine(
  rule: VendorPricingRule,
  line: { itemCode: string; orderedQty: number; unitPrice: number },
): { applies: boolean; amount: number; tier: PricingRuleTier | null } {
  if (!rule.appliesToItemCodes.includes(line.itemCode)) {
    return { applies: false, amount: 0, tier: null };
  }
  const tier = pickTier(rule, line.orderedQty);
  if (!tier) {
    return { applies: false, amount: 0, tier: null };
  }
  const subtotal = line.orderedQty * line.unitPrice;
  const amount =
    tier.unit === "%" ? subtotal * (tier.rate / 100) : tier.rate * line.orderedQty;
  return { applies: true, amount, tier };
}

export interface LinePricingBreakdown {
  lineId: string;
  itemCode: string;
  baseSubtotal: number;
  /** Sum of discount rule amounts active on this line. */
  discountAmount: number;
  /** Sum of premium rule amounts active on this line. */
  premiumAmount: number;
  /** baseSubtotal − discountAmount + premiumAmount. */
  total: number;
  /** Per-rule impacts on this line — feeds the hover breakdown card. */
  ruleImpacts: Array<{
    ruleId: string;
    ruleName: string;
    type: RuleType;
    amount: number;
    tier: PricingRuleTier | null;
  }>;
}

/** Compute the per-line breakdown given the lines and the rules considered
 *  active. `activatedItemsByRule` is a Map<ruleId, Set<lineId>> indicating
 *  which lines a rule is currently activated on (subset of the lines whose
 *  itemCode matches the rule's `appliesToItemCodes`). */
export function computeLineBreakdowns(
  lines: Array<{ id: string; itemCode: string; orderedQty: number; unitPrice: number }>,
  rules: VendorPricingRule[],
  activatedItemsByRule: Map<string, Set<string>>,
): LinePricingBreakdown[] {
  return lines.map((line) => {
    const baseSubtotal = line.orderedQty * line.unitPrice;
    let discountAmount = 0;
    let premiumAmount = 0;
    const ruleImpacts: LinePricingBreakdown["ruleImpacts"] = [];
    for (const rule of rules) {
      const activeOnThisLine = activatedItemsByRule.get(rule.id)?.has(line.id) ?? false;
      if (!activeOnThisLine) continue;
      const { applies, amount, tier } = evaluateRuleForLine(rule, line);
      if (!applies) continue;
      if (rule.type === "discount") discountAmount += amount;
      else premiumAmount += amount;
      ruleImpacts.push({
        ruleId: rule.id,
        ruleName: rule.name,
        type: rule.type,
        amount,
        tier,
      });
    }
    return {
      lineId: line.id,
      itemCode: line.itemCode,
      baseSubtotal,
      discountAmount,
      premiumAmount,
      total: baseSubtotal - discountAmount + premiumAmount,
      ruleImpacts,
    };
  });
}

/** Convenience aggregate — sum line totals into one PO subtotal. */
export function computePOSubtotal(breakdowns: LinePricingBreakdown[]): number {
  return breakdowns.reduce((s, b) => s + b.total, 0);
}

/** Convenience aggregate — sum every discount amount across the PO.
 *  Positive value. UI renders it with a leading "−". */
export function totalDiscount(breakdowns: LinePricingBreakdown[]): number {
  return breakdowns.reduce((s, b) => s + b.discountAmount, 0);
}

/** Convenience aggregate — sum every premium amount across the PO.
 *  Positive value. UI renders it with a leading "+". */
export function totalPremium(breakdowns: LinePricingBreakdown[]): number {
  return breakdowns.reduce((s, b) => s + b.premiumAmount, 0);
}

/** For a given rule, return the lines whose itemCode matches its
 *  `appliesToItemCodes`. Used to seed the per-rule activation set when
 *  the PO is first created (each rule starts activated on every line it
 *  could apply to). */
export function lineIdsForRule(
  rule: VendorPricingRule,
  lines: Array<{ id: string; itemCode: string }>,
): string[] {
  return lines
    .filter((l) => rule.appliesToItemCodes.includes(l.itemCode))
    .map((l) => l.id);
}

/** Reason a rule is currently deactivated on a PO — used by the manage
 *  modal to distinguish user-initiated toggles from the automatic
 *  100 %-cap enforcement (buyer can't manually re-activate the latter). */
export type RuleDeactivationReason = "USER_UNAPPLIED" | "EXCEEDS_100_PERCENT";

/** Given a candidate deactivated-rule set + the seed activation map, walk
 *  the breakdowns and auto-deactivate any discount rules that would push
 *  the PO subtotal below zero. Returns the enforced deactivation reason
 *  per rule so the manage modal can render the right explainer. */
export function enforceHundredPercentCap(
  lines: Array<{ id: string; itemCode: string; orderedQty: number; unitPrice: number }>,
  rules: VendorPricingRule[],
  activatedItemsByRule: Map<string, Set<string>>,
): Map<string, RuleDeactivationReason> {
  const enforced = new Map<string, RuleDeactivationReason>();
  const baseSubtotal = lines.reduce((s, l) => s + l.orderedQty * l.unitPrice, 0);
  const breakdowns = computeLineBreakdowns(lines, rules, activatedItemsByRule);
  const totalPost = computePOSubtotal(breakdowns);
  if (totalPost >= 0) return enforced;
  /* Order rules cheapest-impact first so we drop the smallest offender
     that still fixes the sub-zero total. Discount rules only — premiums
     make the total go UP, never below zero on their own. */
  const discountRules = rules
    .filter((r) => r.type === "discount")
    .map((r) => {
      const impact = breakdowns.reduce(
        (s, b) =>
          s +
          (b.ruleImpacts.find((ri) => ri.ruleId === r.id)?.amount ?? 0),
        0,
      );
      return { rule: r, impact };
    })
    .sort((a, b) => b.impact - a.impact); // biggest impact first
  let projected = totalPost;
  for (const { rule, impact } of discountRules) {
    if (projected >= 0) break;
    enforced.set(rule.id, "EXCEEDS_100_PERCENT");
    projected += impact;
    /* Also strip its per-line activations so the caller can regenerate
       the effective set. The caller is responsible for merging this
       into their own state. */
    activatedItemsByRule.delete(rule.id);
    void baseSubtotal;
  }
  return enforced;
}
