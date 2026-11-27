# Items: currency & exchange-rate touchpoints

> **27 Nov 2026:** "Mid-market" is now the **daily market rate** everywhere (Eli's ruling, 26 Nov 2026: one rate per currency per day, read once a day from Open Exchange Rates and fixed for that date). This record uses the new name; the code keeps the identifier `mid`. Mahreen's design changes of the same day are in [currency-review-27-nov-plan.md](currency-review-27-nov-plan.md).

Items was redesigned. The new app comes from [`ahtisham-omne/nimble-palette`](https://github.com/ahtisham-omne/nimble-palette), at commit `a91898c` (29 Oct 2026). This record does three things:

1. Lists the currency touchpoints the earlier Items touchpoint had (§1).
2. Maps each one onto the redesign (§2).
3. Says where everything is defined now (§3–§6).

The redesign replaced the earlier touchpoint in `touchpoints/items-v2` as a squashed git subtree. The slug, port (8104) and mount (`/inventory`) are unchanged.

Sources:

- *Currencies & Exchange Rates: where each module changes* (design touchpoint audit, 4 Nov 2026), Items v2, pages 6–7: "Item prices stay in the base currency. Qualified vendor pricing gets the three-field treatment." Five changes, from spec 4.1, 4.2 and 3.5.
- *Currency & Exchange Rates Functional Spec v1.1*, sections 3.5, 4.1 and 4.2 (as the audit cites them).

## 1. The earlier touchpoint (what it had, where)

The earlier touchpoint came from `ahtisham-omne/currency-exchange-rate-items-v2-touchpoint`, at commit `9192baa`. It was a Lovable remix of `nimble-palette` at `06bfa96` (23 Apr 2026). The currency work itself was commits `c85e725`, `aff6b1b` and `9192baa`. Paths are as of commit `440df75` in this repo, under `touchpoints/items-v2/src/app/`.

| Touchpoint | Where it was | What it did |
|---|---|---|
| Currency data | `data/rateConstants.ts` | Its own currency list and daily market rate table, base PKR, last sync 4 May 2026 |
| Flags, picker, symbol | `components/modules/CurrencyFlag`, `CurrencyLibrarySelect`, `CurrencySymbol` | A flag per currency, a searchable currency picker, and the base symbol "Rs" with a PKR tooltip |
| Item prices | `components/modules/ItemCreation.tsx`, `SellingSection.tsx` | The base symbol on the custom price per unit and on the selling prices |
| Qualified vendors | `components/modules/QualifiedVendorsTab.tsx` | Sample vendors in USD, EUR and GBP. Their price was shown in base (Rs) with the vendor price and the daily market rate in a hover |
| Add vendor dialog | `components/modules/AddQualifiedVendorDialog.tsx` | A currency picker per vendor. The base price was the source of truth; the vendor price followed it at the daily market rate |
| Embedding | `components/layout/AppLayout.tsx`, `main.tsx` (commit `38a9bf8`) | Hid the app's own sidebar and set the router basename |

## 2. Mapping onto the redesign

Paths are under `touchpoints/items-v2/src/app/`.

| Earlier touchpoint | In the redesign | Notes |
|---|---|---|
| Currency data | `currency/currencies.ts`, `rates.ts`, `money.ts` | The same files as Vendor Invoicing, Partners and Purchase Orders: the module's Currency Library, its daily market rate history (same seeds, last sync Apr 10, 2026) and its corporate rates |
| Flags | `components/currency/FlagImage.tsx`, `CurrencyChip.tsx` | Flags at the Currency & Exchange Rates size (17×13) |
| Currency picker | Dropped | A vendor's currency is inherited from the partner (spec 4.1, audit item 5). The drawer shows it as a chip, and beside the Vendor price field where the original file had its picker |
| Base symbol | `currency/itemMoney.ts` `basePrefix`, `components/currency/BaseCurrencyNote.tsx` | ₨ with a PKR label where an item price is entered, and the "In PKR · base currency" pill on the item overview |
| Item prices | `ItemCreation.tsx` Base Price, `SellingSection.tsx` price tiers | ₨ prefix and PKR label. Item prices are entered and kept in base |
| Qualified vendors | `components/modules/purchasing/QVTable.tsx`, `QVCardList.tsx`, `VendorDetailModal.tsx`, `QualifiedVendorsPanel.tsx` | The redesign's qualified-vendor table on the item's Purchasing tab (§3, items 1–2) |
| Add vendor dialog | `components/modules/purchasing/AddQualifiedVendorModal.tsx`, `components/currency/VendorPriceFields.tsx` | The redesign's Edit Vendors drawer, opened by "Add vendor" and "Edit vendor list" on the item's Purchasing tab (§3, items 3–5). Laid out as the original file's Price per UOM: Base (PKR) ⇆ Vendor, and a "Current rate" box with the Daily market rate \| Corporate switch. The vendor price is what is stored, as the design stores it; either price can be typed and fills the other |
| Sample vendors (create-item flow) | Not shown | The create-item modal imports `QualifiedVendorsTab.tsx` but never renders it, so it and its `AddQualifiedVendorDialog.tsx` are left as upstream has them, with no currency work |
| Embedding | `src/embedding.ts`, `src/EmbeddingBridge.tsx`, `src/main.tsx`, `components/layout/AppLayout.tsx` | As for Partners and Purchase Orders (§6) |

## 3. The audit's 5 changes (pp. 6–7) and where they are

The Currency Touchpoints Map (24 Nov 2026) changed items 1, 2, 3 and 5: list amounts are now in base with the vendor's own figure in the hover, and the rate sits under the price. See §9; the table below is the 20 Nov state.

| # | Change | Where |
|---|---|---|
| 1 | QV table: Credit Limit ($) | `QVTable.tsx` column "Credit Limit", `partnerCells.tsx` `CreditLimitCell`: each limit in the vendor's currency with its code ("¥5,793,448 JPY", "CNY 254,456"). The Browse Vendors table in the drawer does the same |
| 2 | QV table: Units & Pricing in the vendor's currency with the base equivalent underneath | `QVTable.tsx` `UnitsPricingCell` with `components/currency/VendorPrice.tsx`: "£1,155.86 / km", then "≈ ₨410,815.76 PKR". The amount has the rate hover (`Money.tsx`). Last PO price and total are in the vendor's currency too. Sorting compares base values (`QualifiedVendorsPanel.tsx`) |
| 3 | Edit Vendors drawer: price per unit becomes three fields | `VendorPriceFields.tsx`, in the layout of the original Items file's Price per UOM. Each selling unit has **Base (PKR)** and **Vendor (its currency, with flag)**, linked by ⇆; the Vendor field is the design's input, with the currency's symbol or code and the unit picker. Typing either price fills the other (`priceInBase` / `priceFromBase`, rounded to the currency's minor unit). The ⇅ icon's tooltip says so: "Enter the price in either currency. The other converts using the exchange rate." (Mahreen, 19 Nov 2026). The third field, the rate, is the "Current rate" box (item 5). The two sit side by side when the column is at least 460px wide (wide screens in Full view) and stack, Base over Vendor, in the drawer's usual narrow column |
| 4 | The same for every selling unit | Each additional UoM block uses the same Base ⇆ Vendor fields and the vendor's one rate. The rate box sits once, above the selling units: "Every selling unit below converts at this rate" |
| 5 | Vendor currency chip; rate read-only on the daily market rate, editable on Corporate | The drawer header has `VendorCurrencyChip`: flag and code, "inherited from the partner". The rate is `VendorRateCard`, at the top of Pricing & Ordering, as the original file's rate box: "Current rate: 1 GBP = 355.4200 PKR", "● Daily market rate · Source: Open Exchange Rates", "Updated as of Apr 10, 2026, 7:30 PM"; violet for daily market rate, amber for corporate. "Open Exchange Rates" links to openexchangerates.org. The Daily market rate \| Corporate switch shows only where finance has set a corporate rate for the currency (USD, EUR, GBP, AED, SAR, CNY); otherwise an info icon says the daily market rate is used and where corporate rates are set. Without a corporate rate the price stays on the daily market rate even for a vendor saved on Corporate, and no rate can be typed (`vendorRate`; Mahreen, 19 Nov 2026). This is the same box whether the drawer opens from the item's Purchasing tab or from Create New Item › Customize Configuration › Procurement › Qualified Vendors. On Corporate the box shows finance's rate in an input, "Set by Ahtisham Ahmad · Q2 2026 corporate rate" and "In effect since Apr 01, 2026". A rate typed for the vendor is marked "Entered for this vendor", shows finance's rate beside it, and has a reset. Switching keeps the vendor's quote and restates the base. A PKR vendor gets one price field and a note that nothing converts. Rate type and typed rate are stored in the vendor's config (`rateType`, `exchangeRate` in `context/purchasing/types.ts`), so they count as unsaved changes, show one "Modified · Revert" tag in the box, and revert together. A vendor with no rate type saved is on daily market rate, so switching to Corporate and back is no change. After Save the table converts at the vendor's rate (`qvRate`): Delphi on Corporate shows "£1,155.86 / km ≈ ₨411,486.16 PKR" |

### The standalone Qualified Vendors page (retired 18 Nov 2026)

Items & Inventory → Qualified Vendors (`/inventory/vendors`) was the earlier, deprecated design. Its currency touchpoints had been added there by mistake. They now live on the final design, the item's Purchasing tab:

| On the retired page | On the Purchasing tab |
|---|---|
| Configure Vendor Details: Base (PKR) ⇆ Vendor price, current-rate box, Daily market rate \| Corporate switch where a corporate rate is set | Edit Vendors drawer, Pricing & Ordering (§3, items 3–5) |
| Vendor List: price per UOM in the vendor's currency, "≈ ₨…" underneath, at the vendor's chosen rate | QV table Units & Pricing, card list and vendor detail, at `qvRate` (§3, item 2) |
| Currency picker on the vendor price | Not carried: the currency is the partner's (spec 4.1, audit item 5) |

Removed: `pages/QualifiedVendorsPage.tsx`, `components/modules/QualifiedVendorsConfiguration.tsx`, its `/vendors` route and sidebar matching, and `components/currency/QualifiedVendorPriceFields.tsx`. `AddQualifiedVendorDialog.tsx` is back to upstream. In the shell, the sidebar link and the unused placeholder `src/app/pages/QualifiedVendorsPage.tsx` are gone. The old address redirects to the Items Library (`App.tsx`, `/vendors/*`).

## 4. Shared currency code

| File | What it holds |
|---|---|
| `currency/currencies.ts`, `rates.ts`, `money.ts` | As in the other modules |
| `currency/vendorFx.ts` | `vendorCurrencyFor` (partner country → currency), `vendorRate` / `qvRate` (a vendor's rate today, of its type), `priceInBase` / `priceFromBase`, `fromUsd` / `usdToBase` (the design's USD figures restated), `pricePrefix`, `formatWhole` |
| `currency/itemMoney.ts` | Item amounts in base: `baseMoney` (₨6,824.31), `baseWhole` (₨6,824, compact from a million), `baseCompact` (₨34.5M), `basePrefix` |
| `currency/ruleMoney.ts` | `RULE_CURRENCY` (PKR, the base currency), `RULE_USD_FACTOR` (280) and `ruleAmount` (a seeded USD rule amount in base: 2500 → "₨700,000") (24 Nov 2026) |
| `components/currency/Money.tsx`, `CurrencyChip.tsx`, `FlagImage.tsx` | `Money` (an amount in its currency, with the rate hover), `BaseMoney` (an amount shown in base, the same hover giving it in its own currency; 24 Nov 2026), `CurrencyPill` (the currency tag); flags |
| `components/currency/VendorPrice.tsx` | A vendor price in base, "₨361,727.85 / km", with the rate hover (24 Nov 2026; was the vendor's currency with the base underneath) |
| `components/currency/VendorPriceFields.tsx` | The drawer's Base currency ⇄ Vendor currency fields (`VendorPriceFields`), the switch and rate under the first unit's price (`VendorRateCard`), the one-line rate under further units (`VendorUnitRateNote`) and the header tag (`VendorCurrencyChip`) |
| `components/currency/BaseCurrencyNote.tsx` | The "In PKR · base currency" pill |
| `components/currency/RuleAmountPreview.tsx` | Re-exports `RULE_CURRENCY`; the "≈ €22.96 EUR · at today's rate" line under a pricing rule's fixed amount (PKR → the vendor's currency; nothing for a PKR vendor) |

## 5. Data decisions

- **Vendor currencies.** The design's partners have a country and no currency, so each vendor's currency is seeded from its country (`vendorFx.ts` `COUNTRY_CURRENCY`: the audit's example, Adiant in Germany, is EUR). A country not listed trades in USD, as the design priced every vendor in $.
- **Vendor amounts.** The design writes them in USD. Each qualified vendor's prices, tier prices, last-PO figures, price fluctuation and credit are restated once in its currency at the last synced daily market rate (`context/purchasing/mockData.ts` `inVendorCurrency`); the vendors offered in Browse get their currency and credit limit the same way. US vendors keep the design's numbers.
- **Item amounts** stay in base. The design's USD figures are restated in PKR at the same rate (`usdToBase`): the item overview KPIs (Avg Cost, Total Value, Last Purchase and Sale Price, the open-PO tooltip), the transactions table (Price, Valuations, Change in Valuation, headed "(PKR)" like the "(EA)" quantities), the Top Customers and Primary Vendor widgets, and the legacy list's Total Value. The figures keep their relationships: valuation before − after = change.
- **The vendor's rate** is today's (spec 3.5): daily market rate from the Currency Library, or the corporate rate. The base price shown is worked out at it; nothing stores a base price.
- **Pricing-rule fixed amounts** stay written in USD, as Partners and Purchase Orders treat them, and the create form labels them "(USD)". Under an amount it shows what it is in the vendor's currency today (in PKR for a USD vendor). *Superseded 24 Nov 2026: rules are in PKR, the seeded USD amounts restated ×280 (§9).*

## 6. Running inside the shell

As for Partners and Purchase Orders, it lives in `src/embedding.ts`:

- The router basename is set in `src/main.tsx`, and `src/EmbeddingBridge.tsx` routes the shell's in-app navigation.
- `components/layout/AppLayout.tsx` hides the app's own sidebar.
- `touchpoints/touchpoints.json` points at the new repo. The shell's Items & Inventory links are Overview, Items Library and Sales Overview (`/inventory/dashboard`, `/inventory/items`, `/inventory/sales`). Qualified Vendors (`/inventory/vendors`) was retired (§3) and redirects to the Items Library.

## 7. Not in this step

- **Sales orders shown in Items**: the item's Sales tab and Sales Overview (`/inventory/sales`) list sales orders (`components/modules/SalesOverview/`). They keep the design's `$`; sales orders are the Sales Orders touchpoint's, which has its own currency work. *Superseded 24 Nov 2026: amounts and KPIs are in base (§9).*
- **Shipping carrier costs** (`ShippingCarrierCard.tsx`, the carrier column in `partnerCells.tsx`) are carriers' freight rates, outside the audit's Items list. They keep `$`.
- **The Country column** keeps the design's emoji flags; the currency flags are the Currency & Exchange Rates ones.
- **Unused components** in the design (`VendorPriorityLanes.tsx`, `QVCard.tsx`, `items-v3/PriceWithUom.tsx`, `ManagePartnersModal.tsx`) were left as they are.
- **Gaps in the design itself:**
  - The pricing rule's create form has no currency of its own, and the rule templates' descriptions ("10% off on orders over $1,000") are USD text. *Done 24 Nov 2026 (§9).*
  - The "Category Reconcile DEV" button is the design's own dev harness and shows in every build.
  - In the Edit Vendors drawer, clicking a saved vendor in the left rail marks it "Modified" (1 unsaved change) without any edit. Selecting it fills its location scope with all of the partner's locations, while its saved config has none, so Partner Locations counts as changed. It is in `nimble-palette` as delivered (`handleFocusVendor`), not part of the currency work.
  - Upstream baseline: `tsc` reports 5 errors (3 in `AddQualifiedVendorModal.tsx`, 2 in `ItemsV3DemoPage.tsx`) and 2 tests fail in `import-export/store.test.ts`. Both are the same in `nimble-palette` itself.

## 8. Updating from the design repo

```bash
git subtree pull --squash --prefix touchpoints/items-v2 https://github.com/ahtisham-omne/nimble-palette.git main
npm run touchpoints:build -- items-v2
```

Files the currency work changed (§2–§5) can conflict with upstream changes. Keep both sides, then rebuild the copy.

## 9. (24 Nov 2026) Currency Touchpoints Map

Source: the product team's *Currency Touchpoints Map*, Items 1–5, and its Partners 5–6 for the module's own pricing rules. Its figures (Rs 303,476.86, Rs 1.78B, …) are illustrations; the demo keeps its own data and rates. Paths are under `touchpoints/items-v2/src/app/`.

| # | Spec | Where |
|---|---|---|
| 1 | Vendor price when adding a vendor: base currency first, vendor currency next to it; either fills the other; Daily market rate \| Corporate switch with the rate below; currency tag on a foreign vendor | `components/currency/VendorPriceFields.tsx`, used by the Edit Vendors drawer (`components/modules/purchasing/AddQualifiedVendorModal.tsx`; the same drawer opens from the Purchasing tab and from Create New Item › Customize Configuration › Procurement). "Price per unit" now reads **Base currency** "₨ … PKR", ⇄ (⇅ when stacked), **Vendor currency** "€ … EUR" with the design's unit picker. Each box ends with its code. Under the first selling unit's price: the Daily market rate \| Corporate switch, then "● 1 EUR = 304.8150 PKR · Open Exchange Rates, updated Apr 10, 2026, 7:30 PM" (the provider links out). On Corporate: "1 EUR = [305.5000] PKR · Corporate rate set by Ahtisham Ahmad, in effect since Apr 01, 2026"; a rate typed for the vendor reads "Entered for this vendor. Finance's rate is …" and has the reset. With more than one selling unit it adds "Every selling unit converts at this rate", and each further unit has one read-only line, "Converts at 1 EUR = … PKR · Daily market rate, the vendor's rate" (`VendorUnitRateNote`). The header tag is flag + code and "Sells in euros"; a PKR vendor gets no tag and keeps the "aren't converted" line. What is stored is unchanged (`pricePerUnit` in the vendor's currency, `rateType`, `exchangeRate`) |
| 2 | Vendor list on the item: prices in base, tag on foreign vendors, hover with the vendor's price and the rate, price column visible without scrolling | `components/modules/purchasing/QVTable.tsx`: Units & Pricing moved next to Partner (`COLUMNS`). The price is "₨361,727.85 / km" (`components/currency/VendorPrice.tsx`, `BaseMoney`); the hover is the existing card: "United States Dollar (USD) · vendor currency / In USD $1,298.75 USD / In PKR (base) ₨… PKR / At 1 USD = 278.5200 PKR · <today> (today) / ● Daily market rate · Open Exchange Rates". The vendor name has the currency tag (`CurrencyPill`) when it isn't PKR. The "N units" breakdown lists base first, the vendor's price under it, and "In PKR at 1 USD = … PKR · Daily market rate". Credit Limit (`partnerCells.tsx` `CreditLimitCell`), Last PO Price Per Unit and Last PO Total Amount are in base with the same hover. Card view (`QVCardList.tsx`) and the drawer's Browse Vendors table (tag and credit limit) match. Conversion is at the vendor's rate (`qvRate`) as before |
| 3 | Overview: cost and stock value in base | `components/modules/itemDetail/ItemDashKpis.tsx`: Avg Cost and Total Value to the cent, "₨6,823.74" and "₨1,692,287.52". Total Value is on-hand × the base Avg Cost, so the two agree. The "In PKR · base currency" pill was already in the Overview bar (`BaseCurrencyNote`). Money KPIs use a currency-free icon (Banknote) in place of $ |
| 4 | Selling price labelled as the base price | `components/modules/SellingSection.tsx` (Configurations › Selling › Custom Price Per Unit): "₨ 0.00 PKR · ea ▾" as before, and under the prices "Base price, in PKR. A quote in another currency converts this price at the quote's rate." Card icon and the Selling summary's Price Points icon are Banknote, not $ (`ConfigSummaryStrips.tsx`). The legacy create page's Base Price helper says the same (`components/modules/ItemCreation.tsx`). A fixed price per currency is Eli's to decide; not built |
| 5 | Sales tab: order amounts in base with tag and hover; KPIs and totals in base, no hover | `components/modules/SalesOverview/SalesOverviewTable.tsx`: each order has the customer's currency (SO-2026-001 USD, SO-2026-004 EUR, SO-2026-002 and -003 PKR). The design's $ amounts are restated in the order's currency at the last sync (`inOrderCurrency`, as `inVendorCurrency` does for vendors). Order Value, Invoiced Amount and Payments Made show in base at the order's rate, daily market rate on the order date (`orderFx`): "₨5,575,815.42 [USD]" for SO-2026-001 at 1 USD = 267.4252 PKR on Dec 17, 2025. The tag is on Order Value; a foreign order's three amounts have the hover ("· order currency", "(order date)"). PKR orders are plain. The line-item preview's unit price is in base. `SalesKpis.ts` / `SalesKpiStrip.tsx` / `itemDetail/DraggableKpiCard.tsx` (new `note`): Total Revenue "₨1.7B, all orders, in PKR", Revenue at Risk, Avg Order Value, Top Customer Value and Lost / Cancelled in base with a note, no hover. The standalone Sales Overview page (`/inventory/sales`) uses the same components |
| Rules | Pricing rules in the base currency (Partners 5–6; lead's decision 9) | `currency/ruleMoney.ts`; `components/modules/purchasing/PricingRuleCreateModal.tsx`: a read-only "Currency · 🇵🇰 PKR · base currency · Locked" row in Pricing Rule Details, with a tooltip on how foreign orders use it; value thresholds and fixed amounts are labelled and prefixed in PKR (₨ on the % / amount toggle); placeholders in PKR; the basis example reads "orders over ₨2,800,000". Under a fixed amount: what it is in the vendor's currency today (`RuleAmountPreview`). Templates (`pricingRuleConstants.ts`) and the applied-rule catalog (`pricingRules.tsx`) restate every $ amount ×280: "12% off on orders over ₨700,000", "3% at ₨210,000, 8% at ₨840,000, 14% at ₨2,800,000". Percentages and units are unchanged. Duplicating a template now fills numbers only, so the ₨ and % aren't doubled |

**Conflicts with earlier decisions** (the spec wins):

- Mahreen, 20 Nov (§3 item 2): the vendor list showed the vendor's currency with "≈ ₨…" underneath. Now base, the vendor's figure in the hover.
- §3 items 4–5: the "Current rate" box sat once above the selling units. Now the switch and rate sit under the first unit's price, as the spec draws them; all of the box's behaviour (switch only where a corporate rate exists, typed rate, reset, Modified tag) is kept.
- §5: pricing-rule amounts were USD. Now PKR.
- §7: Sales orders in Items kept $. Now base.

**Not changed:** the vendor detail modal (`VendorDetailModal.tsx`) still shows the vendor's price in its currency with "≈ ₨…", as a vendor's own page. The spec's "EUR ▾" on the vendor box is not a currency picker: a vendor's currency is its partner's (§2). The unrendered `QualifiedVendorsTab.tsx`, `AddQualifiedVendorDialog.tsx`, the drawer's unused `renderAddedRow`, `VendorPriorityLanes.tsx`, and the unused `PRICING_RULES` constants in `CreateItemModal.tsx` and `ItemDetail.tsx` are as they were.

Checks: `tsc` 5 errors before and after (the upstream baseline in §7); `vitest` 73 pass, the same 2 upstream failures in `import-export/store.test.ts`.
