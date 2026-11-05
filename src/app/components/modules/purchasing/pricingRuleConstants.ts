/**
 * pricingRuleConstants — pricing-rule presets + types ported VERBATIM from the
 * Partner app (Partner-Management---Vendor `partnerConstants.tsx`, the
 * `PRICING_RULE_PRESETS` block). The preset data, names, descriptions, tier
 * values, and validity windows are copied byte-for-byte so the Browse
 * Templates library reads identically to the partner surface. Do not edit the
 * preset copy — it is reference data, transcribed as-is.
 */

// ── Pricing Rule Presets ──
export type PricingRuleCategory = "all" | "discount" | "premium";
export type PricingRuleBasis = "value" | "volume";

export interface PricingRuleTier {
  minValue: string;
  maxValue: string;
  discount: string;
}

export interface PricingRulePreset {
  id: string;
  name: string;
  category: PricingRuleCategory;
  basis: PricingRuleBasis;
  tierType: "single" | "multiple";
  totalTiers: number;
  description: string;
  tiers: PricingRuleTier[];
  vendorsApplied: number;
  aboutText?: string;
  /**
   * Display-only validity window for the rule (e.g.
   * "Jan 2026 · Apr 2026"). Surfaced on the vendor-group applied
   * pricing-rule card and the Pricing Rule Detail modal Overview tab so
   * users can see at a glance how long a rule is meant to apply. Dummy
   * data uses rolling four-month windows over the recent past so the
   * presets feel grounded; production data will swap this for real
   * effectiveFrom / effectiveTo timestamps from the rule store.
   */
  validityPeriod?: string;
}

export const PRICING_RULE_PRESETS: PricingRulePreset[] = [
  // ── PRESET DISCOUNTS ──
  {
    id: "pr-1", name: "Standard Discount · Value (Single-Tier)", category: "discount", basis: "value", tierType: "single", totalTiers: 1,
    description: "10% off on orders over $1,000",
    tiers: [{ minValue: "$1,000", maxValue: "$25,000", discount: "10%" }],
    vendorsApplied: 5,
    validityPeriod: "Jan 2026 · Apr 2026",
    aboutText: "The Standard Discount · Value (Single-Tier) pricing rule is a straightforward, commonly used model in ERP systems where a fixed percentage discount is applied once the total purchase value exceeds a defined threshold.",
  },
  {
    id: "pr-2", name: "Standard Discount · Volume (Single-Tier)", category: "discount", basis: "volume", tierType: "single", totalTiers: 1,
    description: "10% off on orders of 100+ units",
    tiers: [{ minValue: "100 EA", maxValue: "500 EA", discount: "10%" }],
    vendorsApplied: 3,
    validityPeriod: "Feb 2026 · May 2026",
    aboutText: "A volume-based single-tier discount that applies a fixed percentage when the order quantity meets or exceeds a set threshold.",
  },
  {
    id: "pr-3", name: "Tiered Discount · Value (Multi-Tier)", category: "discount", basis: "value", tierType: "multiple", totalTiers: 4,
    description: "10% off at each tier from $1K to $25K",
    tiers: [
      { minValue: "$1,000", maxValue: "$4,999", discount: "10%" },
      { minValue: "$5,000", maxValue: "$9,999", discount: "10%" },
      { minValue: "$10,000", maxValue: "$24,999", discount: "10%" },
      { minValue: "$25,000", maxValue: "$50,000", discount: "10%" },
    ],
    vendorsApplied: 4,
    validityPeriod: "Dec 2025 · Mar 2026",
    aboutText: "A multi-tier value-based discount model where different discount percentages are applied at various purchase value thresholds. Encourages larger order values with increasing savings.",
  },
  {
    id: "pr-4", name: "Tiered Discount · Volume (Multi-Tier)", category: "discount", basis: "volume", tierType: "multiple", totalTiers: 3,
    description: "10% off at each tier from 100 to 1,000 units",
    tiers: [
      { minValue: "100 EA", maxValue: "499 EA", discount: "10%" },
      { minValue: "500 EA", maxValue: "999 EA", discount: "10%" },
      { minValue: "1,000 EA", maxValue: "2,500 EA", discount: "10%" },
    ],
    vendorsApplied: 2,
    validityPeriod: "Nov 2025 · Feb 2026",
    aboutText: "A multi-tier volume-based discount model offering increasing discounts at higher quantity breakpoints. Perfect for incentivizing large batch orders.",
  },
  // ── PRESET PREMIUMS ──
  {
    id: "pr-5", name: "Standard Premium · Value (Single-Tier)", category: "premium", basis: "value", tierType: "single", totalTiers: 1,
    description: "10% surcharge on orders over $1,000",
    tiers: [{ minValue: "$1,000", maxValue: "$25,000", discount: "10%" }],
    vendorsApplied: 3,
    validityPeriod: "Jan 2026 · Apr 2026",
    aboutText: "A value-based premium surcharge applied to exclusive product lines and VIP offerings. Automate pricing increases to enhance exclusivity and maximize profitability.",
  },
  {
    id: "pr-6", name: "Standard Premium · Volume (Single-Tier)", category: "premium", basis: "volume", tierType: "single", totalTiers: 1,
    description: "10% markup for orders of 100+ units",
    tiers: [{ minValue: "100 EA", maxValue: "500 EA", discount: "10%" }],
    vendorsApplied: 2,
    validityPeriod: "Feb 2026 · May 2026",
    aboutText: "A volume-based premium surcharge applied to small-to-medium order quantities. Ensures profitability on orders that don't qualify for bulk pricing.",
  },
  {
    id: "pr-7", name: "Tiered Premium · Value (Multi-Tier)", category: "premium", basis: "value", tierType: "multiple", totalTiers: 3,
    description: "10% surcharge at each tier from $1K to $10K",
    tiers: [
      { minValue: "$1,000", maxValue: "$4,999", discount: "10%" },
      { minValue: "$5,000", maxValue: "$9,999", discount: "10%" },
      { minValue: "$10,000", maxValue: "$25,000", discount: "10%" },
    ],
    vendorsApplied: 1,
    validityPeriod: "Dec 2025 · Mar 2026",
    aboutText: "A multi-tier value-based premium model where different surcharges are applied at decreasing purchase value thresholds. Protects margins on smaller deals.",
  },
  {
    id: "pr-8", name: "Tiered Premium · Volume (Multi-Tier)", category: "premium", basis: "volume", tierType: "multiple", totalTiers: 4,
    description: "10% markup at each tier from 100 to 2,500 units",
    tiers: [
      { minValue: "100 EA", maxValue: "499 EA", discount: "10%" },
      { minValue: "500 EA", maxValue: "999 EA", discount: "10%" },
      { minValue: "1,000 EA", maxValue: "2,499 EA", discount: "10%" },
      { minValue: "2,500 EA", maxValue: "5,000 EA", discount: "10%" },
    ],
    vendorsApplied: 1,
    validityPeriod: "Nov 2025 · Feb 2026",
    aboutText: "A multi-tier volume-based premium model where surcharges are applied at lower order quantity brackets. Encourages customers to order in larger quantities.",
  },
  // ── CUSTOM DISCOUNTS ──
  {
    id: "pr-custom-1", name: "Q2 Loyalty Value Discount", category: "discount", basis: "value", tierType: "single", totalTiers: 1,
    description: "12% off on orders over $2,500 for loyal partners",
    tiers: [{ minValue: "$2,500", maxValue: "$45,000", discount: "12%" }],
    vendorsApplied: 6,
    validityPeriod: "Jan 2026 · Apr 2026",
    aboutText: "A custom single-tier value-based discount created for Q2 2025 to reward long-standing partners who consistently place high-value orders.",
  },
  {
    id: "pr-custom-2", name: "Bulk Fastener Discount", category: "discount", basis: "volume", tierType: "single", totalTiers: 1,
    description: "20% off on fastener orders of 250+ units",
    tiers: [{ minValue: "250 EA", maxValue: "2,000 EA", discount: "20%" }],
    vendorsApplied: 9,
    validityPeriod: "Feb 2026 · May 2026",
    aboutText: "Custom volume discount targeting fastener and hardware categories. Applied automatically when order quantity exceeds the minimum threshold for eligible SKUs.",
  },
  {
    id: "pr-custom-3", name: "Annual Value-Based Savings Plan", category: "discount", basis: "value", tierType: "multiple", totalTiers: 3,
    description: "Progressive savings: 3% at $750, 8% at $3K, 14% at $10K",
    tiers: [
      { minValue: "$750", maxValue: "$2,999", discount: "3%" },
      { minValue: "$3,000", maxValue: "$9,999", discount: "8%" },
      { minValue: "$10,000", maxValue: "$25,000", discount: "14%" },
    ],
    vendorsApplied: 12,
    validityPeriod: "Dec 2025 · Mar 2026",
    aboutText: "A comprehensive multi-tier value-based savings program designed for annual contracts. Each tier offers increasing discounts to incentivize higher purchase commitments.",
  },
  {
    id: "pr-custom-4", name: "Seasonal Volume Boost", category: "discount", basis: "volume", tierType: "multiple", totalTiers: 3,
    description: "7% at 75+ units, 12% at 300+, 22% at 1K+",
    tiers: [
      { minValue: "75 EA", maxValue: "299 EA", discount: "7%" },
      { minValue: "300 EA", maxValue: "999 EA", discount: "12%" },
      { minValue: "1,000 EA", maxValue: "5,000 EA", discount: "22%" },
    ],
    vendorsApplied: 4,
    validityPeriod: "Nov 2025 · Feb 2026",
    aboutText: "Custom seasonal multi-tier volume discount to incentivize bulk ordering during peak periods.",
  },
  // ── CUSTOM PREMIUMS ──
  {
    id: "pr-custom-5", name: "Rush Order Premium", category: "premium", basis: "value", tierType: "single", totalTiers: 1,
    description: "18% surcharge on rush orders under $5,000",
    tiers: [{ minValue: "$100", maxValue: "$5,000", discount: "18%" }],
    vendorsApplied: 7,
    validityPeriod: "Jan 2026 · Apr 2026",
    aboutText: "A custom premium surcharge applied to rush and expedited orders to cover additional processing and logistics costs.",
  },
  {
    id: "pr-custom-6", name: "Small Batch Handling Fee", category: "premium", basis: "volume", tierType: "multiple", totalTiers: 3,
    description: "30% for <10 units, 15% for <50, 5% for <150",
    tiers: [
      { minValue: "1 EA", maxValue: "9 EA", discount: "30%" },
      { minValue: "10 EA", maxValue: "49 EA", discount: "15%" },
      { minValue: "50 EA", maxValue: "149 EA", discount: "5%" },
    ],
    vendorsApplied: 3,
    validityPeriod: "Feb 2026 · May 2026",
    aboutText: "Custom multi-tier premium for small batch orders that require disproportionate handling and setup costs.",
  },
];
