# Pricing Rules — Port Audit (Sales Orders → Purchase Orders)

> Audit only. **No code changes yet.** Review and mark up what you want kept / adapted / dropped; then we implement in a follow-up.

Source repo (SO): `/Users/areebtanvir/Downloads/Sales-Order-V5`
Target repo (PO): this repo (`Purchase-Order`)

---

## 0. TL;DR

The SO repo has a well-shaped pricing-rules system (data model + compute + UI). Our PO repo has:
- **Planner side** — a lighter `PlannerPricingRule` on vendors (`plannerData.ts:94–111`) + a badge component (`PlannerPricingRuleBadge.tsx`). Used in the vendor picker + hover cards.
- **PO side** — **nothing.** Only a static `discount: number` field on catalog items (`catalogData.ts:32`, e.g. `discount: 5`). No structured rules, no tier logic, no explainer.

Port target: bring the SO pattern (data + compute + UI) into the PO surfaces, adapted to **vendor-attached** rules (we're buying, so rules attach to the vendor / partner rather than the customer). Reuse the SO's `evaluateRuleForLine` + `computeLineBreakdowns` shape verbatim.

---

## 1. SO data model — what to copy

**File:** `Sales-Order-V5/src/app/components/so/pricingRulesData.ts`

```ts
type RuleSource = "template" | "custom"          // system-shipped vs. user-authored
type RuleType   = "discount" | "premium"          // subtract vs. add
type TierUnit   = "%" | "$"                        // percentage of line vs. flat $ per qty

interface PricingRuleTier {
  minQty: number            // inclusive
  maxQty: number | null     // inclusive; null = open-ended top tier
  rate: number
  unit: TierUnit
}

interface CustomerPricingRule {
  id: string
  name: string
  description: string
  type: RuleType
  source: RuleSource
  customers: string[]              // SO-specific
  appliesToItemCodes: string[]     // which items trigger the rule
  tiers: PricingRuleTier[]         // one row for flat rules (minQty=1, maxQty=null)
  validFrom: string                // ISO
  validTo: string | null           // ISO or open-ended
}
```

**Adaptation for PO:**
- Rename `CustomerPricingRule` → `VendorPricingRule` (rules attach to the vendor we buy from, not the customer we sell to).
- `customers: string[]` → `vendors: string[]` (vendor names or ids).
- Everything else copies verbatim — same rule flavours, same tier shape.

**Rule flavours we get for free:**
- Quantity-tiered discount (volume breaks — e.g. 3–4 → 4% off, 5–9 → 7% off, 10+ → 10% off)
- Flat percentage discount (contract price)
- Fixed dollar discount ($X off per unit at qty ≥ N)
- Premium / surcharge (percent or flat $)
- Item-conditional (only fires when the ordered item is in `appliesToItemCodes`)

---

## 2. SO compute logic — what to copy

**Core function** — `evaluateRuleForLine(rule, line)` at `pricingRulesData.ts:186–200`

Inputs: `rule`, `line = { itemCode, orderedQty, unitPrice }`
Output: `{ applies, amount, tier }`

Flow:
1. If `line.itemCode ∉ rule.appliesToItemCodes` → return `applies: false`.
2. `pickTier(rule, orderedQty)` — first tier where `qty >= minQty && (maxQty === null || qty <= maxQty)`; else `null`.
3. If percentage: `amount = qty * unitPrice * (rate / 100)`.
   If dollar:     `amount = rate * qty`.
4. `amount` is always positive; caller applies sign from `rule.type`.

**Aggregator** — `computeLineBreakdowns(lines, rules, activatedItemsByRule)` at `pricingRulesData.ts:215–241`

Produces per-line `LinePricingBreakdown { lineId, itemCode, baseSubtotal, discountAmount, premiumAmount, total }` where `total = baseSubtotal - discountAmount + premiumAmount`. Stacked — multiple rules on one line sum their impacts.

**Cap that prevents negative orders:** discount rules that would push the order subtotal ≤ 0 are auto-deactivated with reason `EXCEEDS_100_PERCENT` and cannot be manually reactivated (`PricingRulesManageModal.tsx:347–351`). Copy this.

---

## 3. SO UI touchpoints — inventory

| # | Surface | File | Line | What renders | Interaction |
|---|---------|------|------|--------------|-------------|
| 1 | SO Line grid — TOTAL column | `SOLineGrid.tsx` | 634–677 | Line total with dotted underline hint | Hover → `PriceBreakdownHoverCard` |
| 2 | Price breakdown hover card | `PriceBreakdownHoverCard.tsx` | 1–297 | Header + Subtotal row + rule rows (with "Pricing Rule" pill) + adjustment rows + green Total | Portal-rendered, 240 ms fade, flips above / below to fit viewport |
| 3 | Pricing Rules manage modal | `PricingRulesManageModal.tsx` | 209–1077 | 2-column card grid of applied rules; per-item checkboxes; deactivation toggles; kebab (edit / remove) | Deactivated rules render grayed with strikethrough |
| 4 | Line grid row — edit PPU | `SOLineGrid.tsx` | 403–740 | Outlined capsule showing `$` + PPU; edit affordances | Draft: pencil + X; post-draft: ban icon |
| 5 | Advanced Configurator modal | `AdvancedConfiguratorModal.tsx` | (integrated) | Per-line detail with per-rule toggles for that line | Checkbox per rule × line |
| 6 | Pricing Rules Library modal | `PricingRulesLibrary.tsx` | 1–end | Full-viewport modal with filter pills (Discount / Premium), search, 2-col cards, detail tabs (Summary / Items / Categories / Attachments / Activity) | Apply / Duplicate / Archive / Remove |
| 7 | Create Pricing Rule modal | `CreatePricingRuleModal.tsx` | 46–739 | Step 1: type + basis + name + dates + tier rows; Step 2: items / categories / attachments tabs | Two-step wizard, gated Next |
| 8 | SO sidebar — Pricing Rules block | `SOSidebar.tsx` | (integrated) | Rule count pill + total discount + "Manage" button | Opens manage modal |
| 9 | SO detail — projected total | `SODetail.tsx` | 315 | `pricingAPI.soSubtotal` feeds invoice total | Read-only |
| 10 | Print / Export | `PrintSalesOrder.tsx` | — | Static rules breakdown in the exported doc | Static |
| 11 | Partner detail — Pricing Rules tab | `PricingRulesTab.tsx` | — | Source of truth for the per-customer rule library | Manage rules at partner level |

**Known gaps in SO (do NOT copy):**
- Rule Update modal (`PricingRulesManageModal.tsx:959–1077`) is stubbed — the "This Quote Only" / "Update Customer Record" CTAs toast + close without saving.
- `validFrom` / `validTo` are stored but never enforced at runtime — expired rules still apply.
- Hover card doesn't reveal WHICH tier matched (e.g. "Tier 2 · 5–9 units"). Only the rule name.
- New lines added to an open SO don't auto-seed existing rules (marked intentional demo gap in `usePricingRules.ts:77–89`).

**Nice bits to keep:**
- One breakdown record per line → clean iteration in UI.
- 100 % cap enforcement — hard, silent, correct.
- Per-line rule granularity (a rule can apply to 5 items and be disabled on 2 others without deleting the rule).
- Portal-rendered hover with intent-preserving hover bridge.

---

## 4. Our PO surfaces — port targets

| # | Our surface | File | Where the rule should appear | Notes |
|---|-------------|------|------------------------------|-------|
| 1 | **Items Detail Modal** (a.k.a. `OrderFlow`) | `OrderFlow.tsx:464` | Line total column + hover breakdown; PPU capsule shows adjusted price; add a "Pricing rules" chip near the item header if any rule fires | This is the biggest touch — same anatomy as SO's Line Grid |
| 2 | **PO Draft** (`Draft` state) | `PurchaseOrderDraft.tsx` | Line rows: PPU + TOTAL columns with rule badge + hover; sidebar block with rule count + total impact + "Manage" button | Full editing available |
| 3 | **PO Detail — all states** | `PODetailTabs.tsx` | Same line-row treatment but read-only past `Draft`. Grand total + Ships / Amount summary reflect post-rule totals. History tab logs pricing changes via existing `pricing-changed` change-log tag (`poStore.ts:102`) | Read-only from `Open` onward; edit-lock consistent with existing PO version rules |
| 4 | **Cart** | `CartPage.tsx` | Item rows show effective PPU + line total; cart footer shows subtotal + rule impact + net total | Cart aggregates before commit |
| 5 | **Catalogue picker** | `CatalogueModal.tsx` | Item card shows list PPU + a small "Rules" indicator when the currently-selected vendor has any rule attached to this item | Discovery signal, not full breakdown |
| 6 | **PO Listing / Data Table** | `PurchaseOrdersListing.tsx`, `PODataTable.tsx` | Grand-total column already exists; verify it uses post-rule totals. Optional: badge showing rule count per PO on hover | Consistency check |
| 7 | **PO Dashboard** | `PODashboard.tsx` | Roll-up: total pricing impact across POs in the window. Optional metric card | Nice-to-have |
| 8 | **Print / Export** | `PrintPurchaseOrder.tsx` (likely) | Rules breakdown per line + summary | Mirrors SO's Print |
| 9 | **Partner Manager — Vendor detail** | `ContactsDirectoryPage.tsx` (partners) — new "Pricing Rules" tab | Source of truth — buyer edits vendor pricing rules here | Analogue of SO's Partner Pricing Rules tab |
| 10 | **PO Version snapshot & compare** | `POVersionHistoryTab.tsx`, `POVersionSnapshotPanel.tsx` | Snapshots capture the rule set + activation state at save; compare diff surfaces added / removed / activated / deactivated rules | Already have snapshot infra; adds one field |

**Data plumbing changes:**
- `POLineItem` (in `poStore.ts:127+`) needs an `activatedRuleIds?: string[]` (or default: all applicable rules on). Persistable per line.
- `PurchaseOrderData` (`poStore.ts:190+`) needs `deactivatedRuleIds?: string[]` at the PO level (wholesale off).
- New file: `poPricingRulesData.ts` (mirrors `pricingRulesData.ts` shape, seeded with the same rule flavours but keyed to vendors).
- New hook: `usePOPricingRules(po, vendor)` (mirrors `usePricingRules`).
- New components: `POPriceBreakdownHoverCard`, `POPricingRulesManageModal`, `POPricingRulesLibrary`, `POCreatePricingRuleModal`.

---

## 5. Recommended porting plan

**Phase 1 — Data + compute (low risk, invisible)**
1. Add `poPricingRulesData.ts` with `VendorPricingRule`, `PricingRuleTier`, `LinePricingBreakdown`, `evaluateRuleForLine`, `pickTier`, `computeLineBreakdowns`.
2. Add `usePOPricingRules` hook (mirrors SO's `usePricingRules`).
3. Extend `POLineItem` + `PurchaseOrderData` types with rule fields.
4. Seed mock vendors with a couple of rules for demo (volume tier + rush surcharge — matches SO's demo).

**Phase 2 — Read-only surfaces (visible but harmless)**
5. Add `POPriceBreakdownHoverCard` (copy of the SO version).
6. Wire it into Items Detail Modal (`OrderFlow.tsx`) line rows — TOTAL column with hover.
7. Wire into PO Detail tabs (all read-only states).
8. Wire into Cart (`CartPage.tsx`) rows + footer summary.
9. Add a small "rules" indicator on Catalogue cards.

**Phase 3 — Editing surfaces (highest impact)**
10. Add `POPricingRulesManageModal` (per-PO manage, deactivate / reactivate, per-line item toggles).
11. Add sidebar "Pricing Rules" block on PO Draft — count + impact + Manage button.
12. Wire the 100 % cap enforcement.
13. Add `POCreatePricingRuleModal` + `POPricingRulesLibrary` (partner-level authoring).

**Phase 4 — Cross-cutting**
14. Snapshot / version history captures rule activation.
15. Print / Export shows the breakdown.
16. Partner detail gets a "Pricing Rules" tab (source of truth for vendor rule library).
17. PO Dashboard roll-up card (optional).

Ship each phase behind a `SHOW_PO_PRICING_RULES = true` feature flag (same pattern we used to park Purchase Requests from planner) so we can dark-launch without turning UI on until wiring is complete.

---

## 6. Decisions log (locked 2026-07-20)

| # | Decision | Answer |
|---|----------|--------|
| 1 | Attachment model | **Vendor** — rules attach to the vendor / partner. Each vendor has a rule book; applying rules to a PO reads from that book. 1:1 port of SO's customer attachment, with the role inverted. |
| 2 | Retro apply on new rule authoring | **Draft POs only** — a newly created rule automatically retro-applies to any Draft-state PO. Any PO past Draft (Open / Confirmed / Received) freezes its rule set at the moment it advanced. Honors the version-history intent. |
| 3 | Approval workflow | **None** in phase 1. Buyer toggles rules freely, no vendor / manager approval step. Can layer approval on later if procurement policy demands it. |
| 4 | UI density (phase 1 scope) | **Read + Manage.** Ship: data + compute + hover breakdown + sidebar summary + manage modal (deactivate / per-line toggles). **Defer** to later phase: full Pricing Rules Library modal + Create-rule wizard. Rules come pre-seeded from mock vendor data for the phase-1 demo. |
| 5 | Currency | **Single currency** for the demo. Currency field stays on the vendor but rules don't branch on it. |
| 6 | Print / export visibility | **Full line breakdown + summary.** Printed PO shows each line's post-rule total with a small breakdown (base subtotal, rule impact, net). Bottom summary shows total rule impact. Mirrors SO's Print behavior. |
| 7 | Naming convention | **`VendorPricingRule`** + PO-prefixed components (`POPriceBreakdownHoverCard`, `POPricingRulesManageModal`). Namespace-clear that these are the PO port + vendor-attached. |
| 8 | Margin protection | **Skip** — we're buying, so it's about honoring vendor contracts, not protecting margin. Reconsider if the demo evolves. |

**Implementation order:**

- **Phase 1** (this cycle): §5 phases 1 + 2 + partial 3 — data, compute, feature flag, hover on all read surfaces, sidebar block, manage modal.
- **Phase 2** (later): rule library + create-rule wizard + partner detail tab.
- **Phase 3** (later): snapshot / version history integration + print / export.
- **Phase 4** (later): PO Dashboard roll-up card.

All phase-1 code gates on `SHOW_PO_PRICING_RULES` so we can dark-launch without turning UI on until wiring is complete.
