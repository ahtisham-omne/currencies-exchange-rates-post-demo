/**
 * Pricing rule presets — ported verbatim from Partner Management's
 * `partnerConstants.tsx` so the Quote and Partner modules stay in lockstep.
 *
 * Why duplicated rather than imported from `partnerConstants.tsx`: that file
 * pulls in partner-domain types (PartnerType, etc.) that aren't relevant in
 * the quote flow. Splitting the pricing-rule presets out keeps the pricing
 * library self-contained and reusable from both modules.
 */

export type PricingRuleCategory = "discount" | "premium" | "all";
export type PricingRuleBasis = "value" | "volume";

export interface PricingRuleTier {
  minValue: string;
  maxValue: string;
  discount: string;
}

export interface PricingRulePreset {
  id: string;
  name: string;
  category: Exclude<PricingRuleCategory, "all">;
  basis: PricingRuleBasis;
  tierType: "single" | "multiple";
  totalTiers: number;
  description: string;
  tiers: PricingRuleTier[];
  vendorsApplied: number;
  aboutText?: string;
  /** "preset" = system template (read-only), "custom" = tenant-created. */
  isPreset?: boolean;
  createdBy?: string;
}

export const PRICING_RULE_PRESETS: PricingRulePreset[] = [
  // ── PRESET DISCOUNTS ──
  {
    id: "pr-1",
    name: "Standard Discount – Value (Single-Tier)",
    category: "discount",
    basis: "value",
    tierType: "single",
    totalTiers: 1,
    description: "10% off on orders over $1,000",
    tiers: [{ minValue: "$1,000", maxValue: "$25,000", discount: "10%" }],
    vendorsApplied: 5,
    aboutText:
      "Straightforward, commonly used model where a fixed percentage discount is applied once the total purchase value exceeds a defined threshold.",
    isPreset: true,
    createdBy: "Omnesoft",
  },
  {
    id: "pr-2",
    name: "Standard Discount – Volume (Single-Tier)",
    category: "discount",
    basis: "volume",
    tierType: "single",
    totalTiers: 1,
    description: "10% off on orders of 100+ units",
    tiers: [{ minValue: "100 EA", maxValue: "500 EA", discount: "10%" }],
    vendorsApplied: 3,
    aboutText:
      "Volume-based single-tier discount that applies a fixed percentage when the order quantity meets or exceeds a set threshold.",
    isPreset: true,
    createdBy: "Omnesoft",
  },
  {
    id: "pr-3",
    name: "Tiered Discount – Value (Multi-Tier)",
    category: "discount",
    basis: "value",
    tierType: "multiple",
    totalTiers: 4,
    description: "10% off at each tier from $1K to $25K",
    tiers: [
      { minValue: "$1,000", maxValue: "$4,999", discount: "10%" },
      { minValue: "$5,000", maxValue: "$9,999", discount: "10%" },
      { minValue: "$10,000", maxValue: "$24,999", discount: "10%" },
      { minValue: "$25,000", maxValue: "$50,000", discount: "10%" },
    ],
    vendorsApplied: 4,
    aboutText:
      "Multi-tier value-based discount. Different discount percentages are applied at various purchase value thresholds, encouraging larger order values with increasing savings.",
    isPreset: true,
    createdBy: "Omnesoft",
  },
  {
    id: "pr-4",
    name: "Tiered Discount – Volume (Multi-Tier)",
    category: "discount",
    basis: "volume",
    tierType: "multiple",
    totalTiers: 3,
    description: "10% off at each tier from 100 to 1,000 units",
    tiers: [
      { minValue: "100 EA", maxValue: "499 EA", discount: "10%" },
      { minValue: "500 EA", maxValue: "999 EA", discount: "10%" },
      { minValue: "1,000 EA", maxValue: "2,500 EA", discount: "10%" },
    ],
    vendorsApplied: 2,
    aboutText:
      "Multi-tier volume-based discount. Increasing discounts at higher quantity breakpoints — incentivizes large batch orders.",
    isPreset: true,
    createdBy: "Omnesoft",
  },
  // ── PRESET PREMIUMS ──
  {
    id: "pr-5",
    name: "Standard Premium – Value (Single-Tier)",
    category: "premium",
    basis: "value",
    tierType: "single",
    totalTiers: 1,
    description: "10% surcharge on orders over $1,000",
    tiers: [{ minValue: "$1,000", maxValue: "$25,000", discount: "10%" }],
    vendorsApplied: 3,
    aboutText:
      "Value-based premium surcharge applied to exclusive product lines and VIP offerings.",
    isPreset: true,
    createdBy: "Omnesoft",
  },
  {
    id: "pr-6",
    name: "Standard Premium – Volume (Single-Tier)",
    category: "premium",
    basis: "volume",
    tierType: "single",
    totalTiers: 1,
    description: "10% markup for orders of 100+ units",
    tiers: [{ minValue: "100 EA", maxValue: "500 EA", discount: "10%" }],
    vendorsApplied: 2,
    aboutText:
      "Volume-based premium surcharge applied to small-to-medium order quantities. Ensures profitability on orders that don't qualify for bulk pricing.",
    isPreset: true,
    createdBy: "Omnesoft",
  },
  {
    id: "pr-7",
    name: "Tiered Premium – Value (Multi-Tier)",
    category: "premium",
    basis: "value",
    tierType: "multiple",
    totalTiers: 3,
    description: "10% surcharge at each tier from $1K to $10K",
    tiers: [
      { minValue: "$1,000", maxValue: "$4,999", discount: "10%" },
      { minValue: "$5,000", maxValue: "$9,999", discount: "10%" },
      { minValue: "$10,000", maxValue: "$25,000", discount: "10%" },
    ],
    vendorsApplied: 1,
    aboutText:
      "Multi-tier value-based premium. Different surcharges at value thresholds — protects margins on smaller deals.",
    isPreset: true,
    createdBy: "Omnesoft",
  },
  {
    id: "pr-8",
    name: "Tiered Premium – Volume (Multi-Tier)",
    category: "premium",
    basis: "volume",
    tierType: "multiple",
    totalTiers: 4,
    description: "10% markup at each tier from 100 to 2,500 units",
    tiers: [
      { minValue: "100 EA", maxValue: "499 EA", discount: "10%" },
      { minValue: "500 EA", maxValue: "999 EA", discount: "10%" },
      { minValue: "1,000 EA", maxValue: "2,499 EA", discount: "10%" },
      { minValue: "2,500 EA", maxValue: "5,000 EA", discount: "10%" },
    ],
    vendorsApplied: 1,
    aboutText:
      "Multi-tier volume-based premium. Encourages customers to order in larger quantities by surcharging smaller batches.",
    isPreset: true,
    createdBy: "Omnesoft",
  },
  // ── CUSTOM DISCOUNTS ──
  {
    id: "pr-custom-1",
    name: "Q2 Loyalty Value Discount",
    category: "discount",
    basis: "value",
    tierType: "single",
    totalTiers: 1,
    description: "12% off on orders over $2,500 for loyal partners",
    tiers: [{ minValue: "$2,500", maxValue: "$45,000", discount: "12%" }],
    vendorsApplied: 6,
    aboutText:
      "Custom single-tier value discount created for Q2 to reward long-standing partners who consistently place high-value orders.",
    isPreset: false,
    createdBy: "Ahtisham Ahmad",
  },
  {
    id: "pr-custom-2",
    name: "Bulk Fastener Discount",
    category: "discount",
    basis: "volume",
    tierType: "single",
    totalTiers: 1,
    description: "20% off on fastener orders of 250+ units",
    tiers: [{ minValue: "250 EA", maxValue: "2,000 EA", discount: "20%" }],
    vendorsApplied: 9,
    aboutText:
      "Custom volume discount targeting fastener and hardware categories. Auto-applies when order quantity exceeds the minimum threshold for eligible SKUs.",
    isPreset: false,
    createdBy: "Ahtisham Ahmad",
  },
  {
    id: "pr-custom-3",
    name: "Annual Value-Based Savings Plan",
    category: "discount",
    basis: "value",
    tierType: "multiple",
    totalTiers: 3,
    description: "Progressive savings: 3% at $750, 8% at $3K, 14% at $10K",
    tiers: [
      { minValue: "$750", maxValue: "$2,999", discount: "3%" },
      { minValue: "$3,000", maxValue: "$9,999", discount: "8%" },
      { minValue: "$10,000", maxValue: "$25,000", discount: "14%" },
    ],
    vendorsApplied: 12,
    aboutText:
      "Comprehensive multi-tier savings program designed for annual contracts. Each tier offers increasing discounts to incentivize higher purchase commitments.",
    isPreset: false,
    createdBy: "Ahtisham Ahmad",
  },
  {
    id: "pr-custom-4",
    name: "Seasonal Volume Boost",
    category: "discount",
    basis: "volume",
    tierType: "multiple",
    totalTiers: 3,
    description: "7% at 75+ units, 12% at 300+, 22% at 1K+",
    tiers: [
      { minValue: "75 EA", maxValue: "299 EA", discount: "7%" },
      { minValue: "300 EA", maxValue: "999 EA", discount: "12%" },
      { minValue: "1,000 EA", maxValue: "5,000 EA", discount: "22%" },
    ],
    vendorsApplied: 4,
    aboutText:
      "Custom seasonal multi-tier volume discount to incentivize bulk ordering during peak periods.",
    isPreset: false,
    createdBy: "Sarah Chen",
  },
  // ── CUSTOM PREMIUMS ──
  {
    id: "pr-custom-5",
    name: "Rush Order Premium",
    category: "premium",
    basis: "value",
    tierType: "single",
    totalTiers: 1,
    description: "18% surcharge on rush orders under $5,000",
    tiers: [{ minValue: "$100", maxValue: "$5,000", discount: "18%" }],
    vendorsApplied: 7,
    aboutText:
      "Custom premium surcharge applied to rush and expedited orders to cover additional processing and logistics costs.",
    isPreset: false,
    createdBy: "Ahtisham Ahmad",
  },
  {
    id: "pr-custom-6",
    name: "Small Batch Handling Fee",
    category: "premium",
    basis: "volume",
    tierType: "multiple",
    totalTiers: 3,
    description: "30% for <10 units, 15% for <50, 5% for <150",
    tiers: [
      { minValue: "1 EA", maxValue: "9 EA", discount: "30%" },
      { minValue: "10 EA", maxValue: "49 EA", discount: "15%" },
      { minValue: "50 EA", maxValue: "149 EA", discount: "5%" },
    ],
    vendorsApplied: 3,
    aboutText:
      "Custom multi-tier premium for small batch orders that require disproportionate handling and setup costs.",
    isPreset: false,
    createdBy: "Marcus Obi",
  },
];

/** Default validity window applied when a preset is materialized into a rule
 *  on a quote line. Matches Partner's "Jan 01, 2026 → Dec 31, 2026" default. */
export function getDefaultRuleValidity(now: Date = new Date()): { validFrom: string; validTo: string } {
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
  const start = new Date(now.getFullYear(), 0, 1);
  const end = new Date(now.getFullYear(), 11, 31);
  return { validFrom: fmt(start), validTo: fmt(end) };
}
