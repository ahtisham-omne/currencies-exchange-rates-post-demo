# Pricing Rule Templates

Reference of every pricing rule preset surfaced in the Pricing Rule Presets dialog (Partner detail page → Pricing Rules tab → Browse Templates / Create New). Same data the UI renders.

**Schema for each template:**

| Field | Type | Notes |
|---|---|---|
| `id` | string | Stable identifier — `pr-*` for predefined, `pr-custom-*` for org-made |
| `name` | string | User-facing display name |
| `category` | `discount` \| `premium` | Drives the green / red color theme on the card |
| `basis` | `value` \| `volume` | "Value" tiers are $ thresholds; "Volume" tiers are unit-quantity thresholds |
| `tierType` | `single` \| `multiple` | Single-tier shows one band; multi-tier stacks bands |
| `totalTiers` | number | Count of tier rows |
| `description` | string | One-line summary shown on the card |
| `vendorsApplied` | number | How many partners currently have this rule applied |
| `validityPeriod` | string | Display-only validity window (e.g. "Jan 2026 – Apr 2026") |
| `aboutText` | string | Long-form description shown on the detail Overview tab |
| `tiers` | `{ minValue, maxValue, discount }[]` | The actual threshold bands |

---

## Predefined Discounts

### 1. Standard Discount – Value (Single-Tier)
- **id**: `pr-1`
- **category**: discount · **basis**: value · **tierType**: single · **totalTiers**: 1
- **description**: 10% off on orders over $1,000
- **vendorsApplied**: 5
- **validityPeriod**: Jan 2026 – Apr 2026
- **aboutText**: The Standard Discount – Value (Single-Tier) pricing rule is a straightforward, commonly used model in ERP systems where a fixed percentage discount is applied once the total purchase value exceeds a defined threshold.
- **tiers**:
  | Min Value | Max Value | Discount |
  |---|---|---|
  | $1,000 | $25,000 | 10% |

### 2. Standard Discount – Volume (Single-Tier)
- **id**: `pr-2`
- **category**: discount · **basis**: volume · **tierType**: single · **totalTiers**: 1
- **description**: 10% off on orders of 100+ units
- **vendorsApplied**: 3
- **validityPeriod**: Feb 2026 – May 2026
- **aboutText**: A volume-based single-tier discount that applies a fixed percentage when the order quantity meets or exceeds a set threshold.
- **tiers**:
  | Min Value | Max Value | Discount |
  |---|---|---|
  | 100 EA | 500 EA | 10% |

### 3. Tiered Discount – Value (Multi-Tier)
- **id**: `pr-3`
- **category**: discount · **basis**: value · **tierType**: multiple · **totalTiers**: 4
- **description**: 10% off at each tier from $1K to $25K
- **vendorsApplied**: 4
- **validityPeriod**: Dec 2025 – Mar 2026
- **aboutText**: A multi-tier value-based discount model where different discount percentages are applied at various purchase value thresholds. Encourages larger order values with increasing savings.
- **tiers**:
  | Min Value | Max Value | Discount |
  |---|---|---|
  | $1,000 | $4,999 | 10% |
  | $5,000 | $9,999 | 10% |
  | $10,000 | $24,999 | 10% |
  | $25,000 | $50,000 | 10% |

### 4. Tiered Discount – Volume (Multi-Tier)
- **id**: `pr-4`
- **category**: discount · **basis**: volume · **tierType**: multiple · **totalTiers**: 3
- **description**: 10% off at each tier from 100 to 1,000 units
- **vendorsApplied**: 2
- **validityPeriod**: Nov 2025 – Feb 2026
- **aboutText**: A multi-tier volume-based discount model offering increasing discounts at higher quantity breakpoints. Perfect for incentivizing large batch orders.
- **tiers**:
  | Min Value | Max Value | Discount |
  |---|---|---|
  | 100 EA | 499 EA | 10% |
  | 500 EA | 999 EA | 10% |
  | 1,000 EA | 2,500 EA | 10% |

---

## Predefined Premiums

### 5. Standard Premium – Value (Single-Tier)
- **id**: `pr-5`
- **category**: premium · **basis**: value · **tierType**: single · **totalTiers**: 1
- **description**: 10% surcharge on orders over $1,000
- **vendorsApplied**: 3
- **validityPeriod**: Jan 2026 – Apr 2026
- **aboutText**: A value-based premium surcharge applied to exclusive product lines and VIP offerings. Automate pricing increases to enhance exclusivity and maximize profitability.
- **tiers**:
  | Min Value | Max Value | Discount |
  |---|---|---|
  | $1,000 | $25,000 | 10% |

### 6. Standard Premium – Volume (Single-Tier)
- **id**: `pr-6`
- **category**: premium · **basis**: volume · **tierType**: single · **totalTiers**: 1
- **description**: 10% markup for orders of 100+ units
- **vendorsApplied**: 2
- **validityPeriod**: Feb 2026 – May 2026
- **aboutText**: A volume-based premium surcharge applied to small-to-medium order quantities. Ensures profitability on orders that don't qualify for bulk pricing.
- **tiers**:
  | Min Value | Max Value | Discount |
  |---|---|---|
  | 100 EA | 500 EA | 10% |

### 7. Tiered Premium – Value (Multi-Tier)
- **id**: `pr-7`
- **category**: premium · **basis**: value · **tierType**: multiple · **totalTiers**: 3
- **description**: 10% surcharge at each tier from $1K to $10K
- **vendorsApplied**: 1
- **validityPeriod**: Dec 2025 – Mar 2026
- **aboutText**: A multi-tier value-based premium model where different surcharges are applied at decreasing purchase value thresholds. Protects margins on smaller deals.
- **tiers**:
  | Min Value | Max Value | Discount |
  |---|---|---|
  | $1,000 | $4,999 | 10% |
  | $5,000 | $9,999 | 10% |
  | $10,000 | $25,000 | 10% |

### 8. Tiered Premium – Volume (Multi-Tier)
- **id**: `pr-8`
- **category**: premium · **basis**: volume · **tierType**: multiple · **totalTiers**: 4
- **description**: 10% markup at each tier from 100 to 2,500 units
- **vendorsApplied**: 1
- **validityPeriod**: Nov 2025 – Feb 2026
- **aboutText**: A multi-tier volume-based premium model where surcharges are applied at lower order quantity brackets. Encourages customers to order in larger quantities.
- **tiers**:
  | Min Value | Max Value | Discount |
  |---|---|---|
  | 100 EA | 499 EA | 10% |
  | 500 EA | 999 EA | 10% |
  | 1,000 EA | 2,499 EA | 10% |
  | 2,500 EA | 5,000 EA | 10% |

---

## Custom Discounts (Made by FR Conversions)

### 9. Q2 Loyalty Value Discount
- **id**: `pr-custom-1`
- **category**: discount · **basis**: value · **tierType**: single · **totalTiers**: 1
- **description**: 12% off on orders over $2,500 for loyal partners
- **vendorsApplied**: 6
- **validityPeriod**: Jan 2026 – Apr 2026
- **aboutText**: A custom single-tier value-based discount created for Q2 2025 to reward long-standing partners who consistently place high-value orders.
- **tiers**:
  | Min Value | Max Value | Discount |
  |---|---|---|
  | $2,500 | $45,000 | 12% |

### 10. Bulk Fastener Discount
- **id**: `pr-custom-2`
- **category**: discount · **basis**: volume · **tierType**: single · **totalTiers**: 1
- **description**: 20% off on fastener orders of 250+ units
- **vendorsApplied**: 9
- **validityPeriod**: Feb 2026 – May 2026
- **aboutText**: Custom volume discount targeting fastener and hardware categories. Applied automatically when order quantity exceeds the minimum threshold for eligible SKUs.
- **tiers**:
  | Min Value | Max Value | Discount |
  |---|---|---|
  | 250 EA | 2,000 EA | 20% |

### 11. Annual Value-Based Savings Plan
- **id**: `pr-custom-3`
- **category**: discount · **basis**: value · **tierType**: multiple · **totalTiers**: 3
- **description**: Progressive savings: 3% at $750, 8% at $3K, 14% at $10K
- **vendorsApplied**: 12
- **validityPeriod**: Dec 2025 – Mar 2026
- **aboutText**: A comprehensive multi-tier value-based savings program designed for annual contracts. Each tier offers increasing discounts to incentivize higher purchase commitments.
- **tiers**:
  | Min Value | Max Value | Discount |
  |---|---|---|
  | $750 | $2,999 | 3% |
  | $3,000 | $9,999 | 8% |
  | $10,000 | $25,000 | 14% |

### 12. Seasonal Volume Boost
- **id**: `pr-custom-4`
- **category**: discount · **basis**: volume · **tierType**: multiple · **totalTiers**: 3
- **description**: 7% at 75+ units, 12% at 300+, 22% at 1K+
- **vendorsApplied**: 4
- **validityPeriod**: Nov 2025 – Feb 2026
- **aboutText**: Custom seasonal multi-tier volume discount to incentivize bulk ordering during peak periods.
- **tiers**:
  | Min Value | Max Value | Discount |
  |---|---|---|
  | 75 EA | 299 EA | 7% |
  | 300 EA | 999 EA | 12% |
  | 1,000 EA | 5,000 EA | 22% |

---

## Custom Premiums (Made by FR Conversions)

### 13. Rush Order Premium
- **id**: `pr-custom-5`
- **category**: premium · **basis**: value · **tierType**: single · **totalTiers**: 1
- **description**: 18% surcharge on rush orders under $5,000
- **vendorsApplied**: 7
- **validityPeriod**: Jan 2026 – Apr 2026
- **aboutText**: A custom premium surcharge applied to rush and expedited orders to cover additional processing and logistics costs.
- **tiers**:
  | Min Value | Max Value | Discount |
  |---|---|---|
  | $100 | $5,000 | 18% |

### 14. Small Batch Handling Fee
- **id**: `pr-custom-6`
- **category**: premium · **basis**: volume · **tierType**: multiple · **totalTiers**: 3
- **description**: 30% for <10 units, 15% for <50, 5% for <150
- **vendorsApplied**: 3
- **validityPeriod**: Feb 2026 – May 2026
- **aboutText**: Custom multi-tier premium for small batch orders that require disproportionate handling and setup costs.
- **tiers**:
  | Min Value | Max Value | Discount |
  |---|---|---|
  | 1 EA | 9 EA | 30% |
  | 10 EA | 49 EA | 15% |
  | 50 EA | 149 EA | 5% |

---

## Summary

| # | Name | Category | Basis | Tiers | Vendors Applied | Validity |
|---|---|---|---|---|---|---|
| 1 | Standard Discount – Value (Single-Tier) | discount | value | 1 | 5 | Jan 2026 – Apr 2026 |
| 2 | Standard Discount – Volume (Single-Tier) | discount | volume | 1 | 3 | Feb 2026 – May 2026 |
| 3 | Tiered Discount – Value (Multi-Tier) | discount | value | 4 | 4 | Dec 2025 – Mar 2026 |
| 4 | Tiered Discount – Volume (Multi-Tier) | discount | volume | 3 | 2 | Nov 2025 – Feb 2026 |
| 5 | Standard Premium – Value (Single-Tier) | premium | value | 1 | 3 | Jan 2026 – Apr 2026 |
| 6 | Standard Premium – Volume (Single-Tier) | premium | volume | 1 | 2 | Feb 2026 – May 2026 |
| 7 | Tiered Premium – Value (Multi-Tier) | premium | value | 3 | 1 | Dec 2025 – Mar 2026 |
| 8 | Tiered Premium – Volume (Multi-Tier) | premium | volume | 4 | 1 | Nov 2025 – Feb 2026 |
| 9 | Q2 Loyalty Value Discount | discount | value | 1 | 6 | Jan 2026 – Apr 2026 |
| 10 | Bulk Fastener Discount | discount | volume | 1 | 9 | Feb 2026 – May 2026 |
| 11 | Annual Value-Based Savings Plan | discount | value | 3 | 12 | Dec 2025 – Mar 2026 |
| 12 | Seasonal Volume Boost | discount | volume | 3 | 4 | Nov 2025 – Feb 2026 |
| 13 | Rush Order Premium | premium | value | 1 | 7 | Jan 2026 – Apr 2026 |
| 14 | Small Batch Handling Fee | premium | volume | 3 | 3 | Feb 2026 – May 2026 |

**Total templates**: 14 (8 predefined + 6 custom)
**Source**: `src/app/components/vendors/partnerConstants.tsx` — `PRICING_RULE_PRESETS`
