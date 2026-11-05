/* ═══════════════════════════════════════════════════════════════════════════
 *  Shared customer pricing rule book
 *  ──────────────────────────────────
 *  This module is the single source of truth for which pricing rules apply
 *  to which customers and which item codes. The same rules feed:
 *    - Library modal (PricingRulesLibrary) — full catalog browsing/edit
 *    - Summary modal (PricingRulesManageModal) — per-quote/SO snapshot
 *    - Configurator (LineItemConfigModal) — per-line applicability list
 *
 *  Conceptual model:
 *    A rule has a set of `customers` it applies to and a set of
 *    `appliesToItemCodes` it covers. When an SO is created in Draft, the
 *    SO inherits the rules whose `customers` includes the SO's customer.
 *    For each such rule and each so.lines[i] whose itemCode is in the
 *    rule's `appliesToItemCodes`, we evaluate the line's qty against the
 *    rule's tiers — if a tier matches, the rule discounts (or premium-
 *    surcharges) that line at the tier's rate.
 *
 *    `source: 'template'` rules ship from the system catalog and can't be
 *    edited; `source: 'custom'` rules were authored on this customer and
 *    can be modified in Draft.
 * ═══════════════════════════════════════════════════════════════════════════ */

export type RuleSource = 'template' | 'custom';
export type RuleType = 'discount' | 'premium';

export interface PricingRuleTier {
  /** Inclusive lower bound. The tier matches when line.qty >= minQty. */
  minQty: number;
  /** Inclusive upper bound. `null` = unbounded (top tier). */
  maxQty: number | null;
  /** Numeric rate. Interpreted as a percentage off the line subtotal when
   *  `unit === '%'`, or as a flat dollar amount per qty when `unit === '$'`. */
  rate: number;
  unit: '%' | '$';
}

export interface CustomerPricingRule {
  id: string;
  name: string;
  description: string;
  type: RuleType;
  source: RuleSource;
  /** Customers this rule is configured for. The SO inherits rules whose
   *  `customers` includes its `customer` field. */
  customers: string[];
  /** Item codes this rule applies to. A line whose itemCode is not in
   *  this list never triggers the rule, even if all other conditions
   *  match. */
  appliesToItemCodes: string[];
  /** Tier ladder — must be non-empty. For a single-rate rule, use one
   *  entry with `minQty: 1, maxQty: null`. */
  tiers: PricingRuleTier[];
  /** ISO date strings. `validTo: null` means open-ended. */
  validFrom: string;
  validTo: string | null;
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  Customer rule book
 *
 *  Rules cover the itemCodes that the SO store seeds line items with
 *  (000-100-001 through 000-100-175). Customers are picked from the SO
 *  store's seed customer list. Tier ladders model real-world volume
 *  break behavior.
 * ═══════════════════════════════════════════════════════════════════════════ */
export const CUSTOMER_PRICING_RULES: CustomerPricingRule[] = [
  {
    id: 'pr-fleet-volume',
    name: 'Fleet Volume Discount',
    description: '3+ unit fleet orders earn 4% off; 7% at 5+; 10% at 10+.',
    type: 'discount',
    source: 'template',
    customers: ['Metro City Fire & Rescue', 'Tri-County EMS Authority', 'Pacific Northwest Ambulance', 'Great Plains Fire Protection'],
    appliesToItemCodes: ['000-100-001', '000-100-002', '000-100-003'],
    tiers: [
      { minQty: 3, maxQty: 4, rate: 4, unit: '%' },
      { minQty: 5, maxQty: 9, rate: 7, unit: '%' },
      { minQty: 10, maxQty: null, rate: 10, unit: '%' },
    ],
    validFrom: '2026-01-01',
    validTo: '2026-12-31',
  },
  {
    id: 'pr-gov-contract',
    name: 'Government Contract Pricing',
    description: '3% flat discount on chassis + body for municipal/state contracts.',
    type: 'discount',
    source: 'template',
    customers: ['Metro City Fire & Rescue', 'Tri-County EMS Authority', 'Eagle County Sheriff\'s Office', 'Riverside Utility District'],
    appliesToItemCodes: ['000-100-001', '000-100-002', '000-100-003'],
    tiers: [{ minQty: 1, maxQty: null, rate: 3, unit: '%' }],
    validFrom: '2026-01-01',
    validTo: '2026-12-31',
  },
  {
    id: 'pr-comms-bundle',
    name: 'Communications Bundle',
    description: '5% off radio + siren when ordered together (2+ units of each).',
    type: 'discount',
    source: 'custom',
    customers: ['Metro City Fire & Rescue', 'Tri-County EMS Authority', 'Pacific Northwest Ambulance'],
    appliesToItemCodes: ['000-100-041', '000-100-049'],
    tiers: [{ minQty: 2, maxQty: null, rate: 5, unit: '%' }],
    validFrom: '2026-01-01',
    validTo: '2026-12-31',
  },
  {
    id: 'pr-patient-care',
    name: 'Patient-Care Bulk Discount',
    description: '6% off stretchers when 3+ units; 9% at 6+.',
    type: 'discount',
    source: 'template',
    customers: ['Lakewood Community Hospital', 'Summit Regional Medical Center', 'Heartland Air Ambulance', 'Valley Health Systems'],
    appliesToItemCodes: ['000-100-059'],
    tiers: [
      { minQty: 3, maxQty: 5, rate: 6, unit: '%' },
      { minQty: 6, maxQty: null, rate: 9, unit: '%' },
    ],
    validFrom: '2026-01-01',
    validTo: '2026-12-31',
  },
  {
    id: 'pr-rush-build',
    name: 'Expedited Build Premium',
    description: '12% surcharge on chassis for rush builds (any qty).',
    type: 'premium',
    source: 'template',
    customers: ['Metro City Fire & Rescue', 'Pinecrest Volunteer Fire Dept', 'Coastal Search & Rescue', 'Heartland Air Ambulance'],
    appliesToItemCodes: ['000-100-001', '000-100-002', '000-100-003'],
    tiers: [{ minQty: 1, maxQty: null, rate: 12, unit: '%' }],
    validFrom: '2026-01-01',
    validTo: '2026-12-31',
  },
  {
    id: 'pr-lighting-volume',
    name: 'Lighting Package Volume',
    description: '$200 off per lightbar when ordering 3+ units.',
    type: 'discount',
    source: 'custom',
    customers: ['Metro City Fire & Rescue', 'Pinecrest Volunteer Fire Dept', 'Great Plains Fire Protection', 'Eagle County Sheriff\'s Office'],
    appliesToItemCodes: ['000-100-026'],
    tiers: [{ minQty: 3, maxQty: null, rate: 200, unit: '$' }],
    validFrom: '2026-01-01',
    validTo: '2026-12-31',
  },
  {
    id: 'pr-services-discount',
    name: 'Services & Training Bundle',
    description: '8% off paint, graphics and training when paired (1+ each).',
    type: 'discount',
    source: 'template',
    customers: ['Metro City Fire & Rescue', 'Tri-County EMS Authority', 'Pacific Northwest Ambulance', 'Lakewood Community Hospital', 'Summit Regional Medical Center'],
    appliesToItemCodes: ['000-100-171', '000-100-175'],
    tiers: [{ minQty: 1, maxQty: null, rate: 8, unit: '%' }],
    validFrom: '2026-01-01',
    validTo: '2026-12-31',
  },
];

/* ═══════════════════════════════════════════════════════════════════════════
 *  Helpers
 * ═══════════════════════════════════════════════════════════════════════════ */

/** Return every rule whose `customers` list includes the given name. */
export function getCustomerRules(customerName: string): CustomerPricingRule[] {
  return CUSTOMER_PRICING_RULES.filter((r) => r.customers.includes(customerName));
}

/** Lookup index — handy when reconciling modal-shape rules back to the
 *  customer rule book (e.g. recomputing amounts after a per-item toggle). */
export const CUSTOMER_PRICING_RULES_BY_ID = new Map(
  CUSTOMER_PRICING_RULES.map((r) => [r.id, r]),
);

/** Pick the tier whose [minQty, maxQty] band contains the given qty, or
 *  `null` if no tier matches (e.g. qty below the lowest minQty). */
export function pickTier(rule: CustomerPricingRule, qty: number): PricingRuleTier | null {
  return rule.tiers.find((t) => qty >= t.minQty && (t.maxQty === null || qty <= t.maxQty)) ?? null;
}

/** Evaluate the rule against a single line. Returns the dollar impact
 *  (positive = discount or premium magnitude — direction is encoded in
 *  rule.type, not the sign of this number) and whether the rule actually
 *  applies to this line at all. */
export function evaluateRuleForLine(
  rule: CustomerPricingRule,
  line: { itemCode: string; orderedQty: number; unitPrice: number },
  /** A "$" tier's amount is written in USD; this turns it into the SO's
   *  currency (ruleAmountFactor in src/app/currency/soFx.ts). */
  flatFactor = 1,
): { applies: boolean; amount: number; tier: PricingRuleTier | null } {
  if (!rule.appliesToItemCodes.includes(line.itemCode)) {
    return { applies: false, amount: 0, tier: null };
  }
  const tier = pickTier(rule, line.orderedQty);
  if (!tier) {
    return { applies: false, amount: 0, tier: null };
  }
  const subtotal = line.orderedQty * line.unitPrice;
  const amount = tier.unit === '%' ? subtotal * (tier.rate / 100) : tier.rate * flatFactor * line.orderedQty;
  return { applies: true, amount, tier };
}

export interface LinePricingBreakdown {
  lineId: string;
  itemCode: string;
  baseSubtotal: number;
  discountAmount: number;   // sum of discount rule amounts active on this line
  premiumAmount: number;    // sum of premium rule amounts active on this line
  total: number;            // baseSubtotal - discountAmount + premiumAmount
}

/** Compute the per-line breakdown given the lines and the rules considered
 *  active. `activatedItemsByRule` is a Map<ruleId, Set<lineId>> indicating
 *  which lines a rule is currently activated on (subset of the lines whose
 *  itemCode matches the rule's `appliesToItemCodes`). */
export function computeLineBreakdowns(
  lines: Array<{ id: string; itemCode: string; orderedQty: number; unitPrice: number }>,
  rules: CustomerPricingRule[],
  activatedItemsByRule: Map<string, Set<string>>,
  flatFactor = 1,
): LinePricingBreakdown[] {
  return lines.map((line) => {
    const baseSubtotal = line.orderedQty * line.unitPrice;
    let discountAmount = 0;
    let premiumAmount = 0;
    for (const rule of rules) {
      const activeOnThisLine = activatedItemsByRule.get(rule.id)?.has(line.id) ?? false;
      if (!activeOnThisLine) continue;
      const { applies, amount } = evaluateRuleForLine(rule, line, flatFactor);
      if (!applies) continue;
      if (rule.type === 'discount') discountAmount += amount;
      else premiumAmount += amount;
    }
    return {
      lineId: line.id,
      itemCode: line.itemCode,
      baseSubtotal,
      discountAmount,
      premiumAmount,
      total: baseSubtotal - discountAmount + premiumAmount,
    };
  });
}

/** Convenience aggregate — sum line totals into one SO subtotal. */
export function computeSOSubtotal(breakdowns: LinePricingBreakdown[]): number {
  return breakdowns.reduce((s, b) => s + b.total, 0);
}

/** For a given rule, return the lines whose itemCode matches its
 *  `appliesToItemCodes`. Used to seed the per-rule activation set when
 *  the SO is first created (each rule starts activated on every line it
 *  could apply to). */
export function lineIdsForRule(
  rule: CustomerPricingRule,
  lines: Array<{ id: string; itemCode: string }>,
): string[] {
  return lines.filter((l) => rule.appliesToItemCodes.includes(l.itemCode)).map((l) => l.id);
}
