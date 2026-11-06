/* ═══════════════════════════════════════════════════════════════════════════
 *  Shared customer pricing rule book — Quote module.
 *
 *  Mirrors Sales-Order-V5/src/app/components/so/pricingRulesData.ts in
 *  spirit: each rule has the customers it covers and the productIds
 *  (line-item productIds — same format as SO itemCodes: `000-100-NNN`)
 *  it applies to. When a quote is created in Draft for a customer in
 *  `customers`, the rules whose `appliesToItemCodes` covers any of the
 *  quote's lines auto-attach.
 * ═══════════════════════════════════════════════════════════════════════════ */

export type RuleSource = 'template' | 'custom';
export type RuleType = 'discount' | 'premium';

export interface PricingRuleTier {
  minQty: number;
  maxQty: number | null;
  rate: number;
  unit: '%' | '$';
}

export interface CustomerPricingRule {
  id: string;
  name: string;
  description: string;
  type: RuleType;
  source: RuleSource;
  customers: string[];
  /** Line `productId` values (matches what BASE_LINE_ITEMS seeds). */
  appliesToItemCodes: string[];
  tiers: PricingRuleTier[];
  validFrom: string;
  validTo: string | null;
}

export const CUSTOMER_PRICING_RULES: CustomerPricingRule[] = [
  {
    id: 'pr-fleet-volume',
    name: 'Fleet Volume Discount',
    description: '3+ unit fleet orders earn 4% off; 7% at 5+; 10% at 10+.',
    type: 'discount',
    source: 'template',
    customers: ['Metro City Fire & Rescue', 'Tri-County EMS Authority', 'Pacific Northwest Ambulance Co.', 'Great Plains Fire Protection', 'Dispatch Medical Transport'],
    appliesToItemCodes: ['000-100-002', '000-100-019'],
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
    description: '3% flat discount on chassis + module for municipal/state contracts.',
    type: 'discount',
    source: 'template',
    customers: ['Metro City Fire & Rescue', 'Tri-County EMS Authority', 'Eagle County Sheriff\'s Office', 'Riverside Utility District', 'Lakeshore Police Department'],
    appliesToItemCodes: ['000-100-002', '000-100-019'],
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
    customers: ['Metro City Fire & Rescue', 'Tri-County EMS Authority', 'Pacific Northwest Ambulance Co.'],
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
    customers: ['Lakewood Community Hospital', 'Summit Regional Medical Center', 'Heartland Air Ambulance', 'Valley Health System', 'Dispatch Medical Transport'],
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
    description: '12% surcharge on chassis + module for rush builds.',
    type: 'premium',
    source: 'template',
    customers: ['Metro City Fire & Rescue', 'Pinecrest Volunteer Fire Dept', 'Coastal Search & Rescue', 'Heartland Air Ambulance'],
    appliesToItemCodes: ['000-100-002', '000-100-019'],
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
    customers: ['Metro City Fire & Rescue', 'Pinecrest Volunteer Fire Dept', 'Great Plains Fire Protection', 'Eagle County Sheriff\'s Office', 'Lakeshore Police Department'],
    appliesToItemCodes: ['000-100-026'],
    tiers: [{ minQty: 3, maxQty: null, rate: 200, unit: '$' }],
    validFrom: '2026-01-01',
    validTo: '2026-12-31',
  },
  {
    id: 'pr-services-discount',
    name: 'Services & Training Bundle',
    description: '8% off paint and graphics services (1+ each).',
    type: 'discount',
    source: 'template',
    customers: ['Metro City Fire & Rescue', 'Tri-County EMS Authority', 'Pacific Northwest Ambulance Co.', 'Lakewood Community Hospital', 'Summit Regional Medical Center'],
    appliesToItemCodes: ['000-100-061'],
    tiers: [{ minQty: 1, maxQty: null, rate: 8, unit: '%' }],
    validFrom: '2026-01-01',
    validTo: '2026-12-31',
  },
];

export function getCustomerRules(customerName: string): CustomerPricingRule[] {
  return CUSTOMER_PRICING_RULES.filter((r) => r.customers.includes(customerName));
}

export const CUSTOMER_PRICING_RULES_BY_ID = new Map(
  CUSTOMER_PRICING_RULES.map((r) => [r.id, r]),
);

export function pickTier(rule: CustomerPricingRule, qty: number): PricingRuleTier | null {
  return rule.tiers.find((t) => qty >= t.minQty && (t.maxQty === null || qty <= t.maxQty)) ?? null;
}

export function evaluateRuleForLine(
  rule: CustomerPricingRule,
  line: { productId: string; quantity: number; unitPrice: number },
): { applies: boolean; amount: number; tier: PricingRuleTier | null } {
  if (!rule.appliesToItemCodes.includes(line.productId)) {
    return { applies: false, amount: 0, tier: null };
  }
  const tier = pickTier(rule, line.quantity);
  if (!tier) return { applies: false, amount: 0, tier: null };
  const subtotal = line.quantity * line.unitPrice;
  const amount = tier.unit === '%' ? subtotal * (tier.rate / 100) : tier.rate * line.quantity;
  return { applies: true, amount, tier };
}

export interface LinePricingBreakdown {
  lineId: string;
  productId: string;
  baseSubtotal: number;
  discountAmount: number;
  premiumAmount: number;
  total: number;
}

export function computeLineBreakdowns(
  lines: Array<{ id: string; productId: string; quantity: number; unitPrice: number }>,
  rules: CustomerPricingRule[],
  activatedItemsByRule: Map<string, Set<string>>,
): LinePricingBreakdown[] {
  return lines.map((line) => {
    const baseSubtotal = line.quantity * line.unitPrice;
    let discountAmount = 0;
    let premiumAmount = 0;
    for (const rule of rules) {
      const activeOnThisLine = activatedItemsByRule.get(rule.id)?.has(line.id) ?? false;
      if (!activeOnThisLine) continue;
      const { applies, amount } = evaluateRuleForLine(rule, line);
      if (!applies) continue;
      if (rule.type === 'discount') discountAmount += amount;
      else premiumAmount += amount;
    }
    return {
      lineId: line.id,
      productId: line.productId,
      baseSubtotal,
      discountAmount,
      premiumAmount,
      total: baseSubtotal - discountAmount + premiumAmount,
    };
  });
}

export function computeQuoteSubtotal(breakdowns: LinePricingBreakdown[]): number {
  return breakdowns.reduce((s, b) => s + b.total, 0);
}

export function lineIdsForRule(
  rule: CustomerPricingRule,
  lines: Array<{ id: string; productId: string }>,
): string[] {
  return lines.filter((l) => rule.appliesToItemCodes.includes(l.productId)).map((l) => l.id);
}
