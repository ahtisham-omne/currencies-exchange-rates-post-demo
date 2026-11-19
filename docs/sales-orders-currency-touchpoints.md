# Sales Orders: currency & exchange-rate touchpoints

Sales Orders was redesigned. The new app comes from [`ahtisham-omne/Sales-Order-V5`](https://github.com/ahtisham-omne/Sales-Order-V5), at commit `a3a5940` (5 Nov 2026). This record does three things:

1. Lists the currency touchpoints the earlier Sales Orders touchpoint had (§1).
2. Maps each one onto the redesign (§2).
3. Says where everything is defined now (§3–§6), including the base-currency view, the toggle, the currency configuration and the version rate choice brought back afterwards (§3a).

The redesign replaced the earlier touchpoint in `touchpoints/sales-order` as a squashed git subtree. The slug, port (8103) and mount (`/sales`) are unchanged.

Sources:

- *Currencies & Exchange Rates: where each module changes* (design touchpoint audit, 4 Nov 2026), Sales Orders, pages 13–14: "Inherits currency and rate from the quote, or from the customer when created directly." Five changes, from spec 4.3 and 4.4.
- *Currency & Exchange Rates Functional Spec v1.1*, sections 4.3 and 4.4 (as the audit cites them).

## 1. The earlier touchpoint (what it had, where)

The earlier touchpoint came from `ahtisham-omne/currency-exchange-rate-sales-order-touchpoint`, at commit `0ce0cf2`. It was a Lovable remix of `Sales-Order-V5` at `1da34e1` (30 Apr 2026). The currency work itself was commits `e75d127`, `bdd2a14` and `0ce0cf2`. Paths are as of commit `440df75` in this repo, under `touchpoints/sales-order/src/app/`.

| Touchpoint | Where it was | What it did |
|---|---|---|
| Currency library | `data/currencyLibrary.ts`, `data/rateDateFormat.ts` | Its own ISO list, Market and Corporate snapshots, base PKR |
| Rate context | `context/RateContext.tsx` | A global Market / Corporate switch |
| Money with hover | `components/ui/CurrencyAmount.tsx`, `currency/OrderMoney.tsx`, `MoneyConvertTooltip.tsx`, `formatOrderMoney.ts`, `CurrencyFlag.tsx` | Amounts with a light hover giving the other currency and the rate |
| Order currency config | `currency/OrderCurrencyConfigModal.tsx`, `OrderCurrencyPicker.tsx`, `MarketCorporateToggle.tsx` | Currency and rate type per order; "Customer Pays" |
| Rate KPIs | `currency/MarketRateKpiCard.tsx`, `RateKpiValue.tsx`, `InsightsPanel.tsx` | Mid-market Rate and Corporate Rate cards in Performance Insights |
| Listing | `SOList.tsx`, `SOColumnHeaderMenu.tsx` | Base ↔ Customer switch on Order Value, Invoiced Amount and Payments Made |
| SO detail | `SODetail.tsx`, `SOSidebar.tsx`, `SOLineGrid.tsx`, `VersionHistoryTab.tsx`, `VersionHistoryModal.tsx`, `LinkedTransactionsTab.tsx`, `InvoicingTab.tsx`, `SourcingProductionTab.tsx` | A page-wide base/customer view; Order Summary with "Customer pays in" and "Base equivalent" rows and a Locked chip; revert with "Restore locked rate" or "Refresh to today's rate" |
| Create SO | `CreateSOModal.tsx`, `CreateSOStep2.tsx` | Line items in base PKR with the hover |
| Duplicate, print | `DuplicateSOModal.tsx`, `SendToCustomerModal.tsx` | A duplicate flow; a print-currency picker with an FX footer |
| Data | `store.tsx` | The first order in PKR, the rest in USD |

## 2. Mapping onto the redesign

Paths are under `touchpoints/sales-order/src/app/`.

| Earlier touchpoint | In the redesign | Notes |
|---|---|---|
| Currency library, rate snapshots | `currency/currencies.ts`, `rates.ts`, `money.ts` | The same files as the other modules: the module's Currency Library, its mid-market history (same seeds, last sync Apr 10, 2026) and its corporate rates |
| Rate context (global switch) | Dropped | The rate type is per order now (spec 4.3), in Order Summary |
| Money with hover | `components/currency/Money.tsx`, `DocCurrency.tsx`, `docCurrencyContext.ts`, `SODocCurrency.tsx` | As in Purchase Orders. The SO page puts its currency, rate and view in `DocCurrencyProvider`, so rows, hover cards and modals show base or the customer's currency (§3a) |
| Order currency config modal | `components/currency/SOCurrencyConfig.tsx` `SOCurrencyConfigDialog` | Brought back (§3a), from the header's Currency button and the CURRENCY card's View configuration. It hosts the redesign's picker, rate type and corporate rate, and its convert confirmation (`SOCurrencyFields.tsx`), which first replaced it inline in Order Summary |
| Rate KPI cards | Dropped | The audit asks for revenue in base, labelled; rates live in Currency & Exchange Rates |
| Base ↔ Customer switches | `components/currency/SOCurrencyHeaderControls.tsx`, `soView.ts` | Brought back on the SO page (§3a): Base Currency (the default) or Customer Currency, for the whole order. The listing has no switch; its amounts are in base (§3, item 2) |
| SO detail | `SOSidebar.tsx`, `SOLineGrid.tsx`, `InvoicingTab.tsx` `InvoiceSidebarSummary`, `components/currency/SOCurrencyConfig.tsx` `SOCurrencySummary` | Every amount in base by default, the customer's on hover (§3a). Order Summary ends with the CURRENCY card: Customer pays / You receive / Base equivalent, the rate(s), the rate type and a Locked chip |
| Version revert rate choice | `components/currency/VersionRateChoice.tsx`, `AutoVersionConfirmModal.tsx`, `VersionHistoryModal.tsx`, `store.tsx` | Brought back (§3a) in Purchase Orders' words, "Use locked rate from V{n}" or "Apply current rate", when a version is started and when one is reverted to |
| Create SO | `CreateSOModal.tsx`, `CreateSOStep2.tsx` | The new order is in the customer's currency; catalog prices convert into it at today's rate. Shown in base, the customer's amount on hover (§3a) |
| Duplicate, print | `duplicateSO.ts`, `PrintSalesOrder.tsx`, `SendToCustomerModal.tsx`, `soDocumentData.ts`, `shared/pdfDocument.tsx` | A duplicate for the same customer keeps the currency; for another customer it opens in that customer's currency, prices converted. Either way it takes today's rate. The document prints in the order's currency |
| Data | `store.tsx` `inCustomerCurrency`, `currency/soFx.ts` `CUSTOMER_CURRENCIES` | §5 |
| Embedding | `src/embedding.ts`, `routes.tsx`, `components/so/AppLayout.tsx`, `AppSidebar.tsx` | §6 |

## 3. The audit's 5 changes (pp. 13–14) and where they are

| # | Change | Where |
|---|---|---|
| 1 | Listing: Total Projected Revenue converted to base before summing, labelled | `SOList.tsx` `stats` / `insightCardData`: each order's grand total in PKR at its own rate (`toSOBase`), then added up. The same for Average Order Value, Open Order Value, Revenue at Risk, Pipeline Value and Cleared Value. "In PKR · base currency" pill beside Performance Insights (`components/currency/BaseCurrencyNote.tsx`) |
| 2 | Listing: Order Value, Invoiced Amount, Payments Made in each order's currency | Since §3a, in PKR: `SOList.tsx` cells with `BaseMoney`, each order at its own rate, the order's own amount, the rate and its type on hover. The Currency column shows the flag. Sorting by Order Value and the value-range filter compare PKR (`SOFilterBar.tsx` labels the range PKR). The board's cards (`SOKanbanBoard.tsx`) are the same |
| 3 | Order Summary: currency selector and rate | Since §3a, the CURRENCY card in Order Summary and the Currency Configuration (`SOCurrencyConfig.tsx`), which uses the picker, rate-type toggle and confirmation from `SOCurrencyFields.tsx`. The currency comes from the quote or the customer's default and can be changed while the order is a Draft: a confirmation shows the rate, the cross rate and the totals before and after; confirming converts every line and freight charge (`so/soCurrency.ts` `withSOCurrency`) and the fixed one-time adjustments (`handleCurrencyChange`), and logs it in Activity. The confirmation's totals are worked out the way the order will be (flat USD rule amounts at the new cross rate). Mid-market is read-only; Corporate is editable, with a reset to finance's rate. Changing a Draft's Requested On date re-takes the rate on the new date, unless a corporate rate was typed. Locked once the order leaves Draft |
| 4 | Invoiced, Paid, Outstanding in the order currency | `InvoicingTab.tsx` `InvoiceSidebarSummary`, through `DocMoney`: in base by default with the order's amount on hover, or in the order's currency with the toggle (§3a). Paid notes that a payment settled at another rate is where realized FX gain or loss comes from (Customer Payments books it) |
| 5 | Price per unit uses $ | `SOLineGrid.tsx` `PriceCapsule`: the shown currency's symbol or code and minor unit (¥ has none); line totals, the price breakdown hover, the line configurator (`quote-creation/LineItemConfigModal.tsx`) and the price-scope modal follow. The configurator's own price input stays in the order's currency, labelled with its code |

## 3a. Base currency first, the toggle, the configuration and version rates (18 Nov 2026)

Asked for after the audit's changes, as for Purchase Orders ("In POs, the prices should always be in the base currency. And on the hover, it should show vendor currency if different. Add the toggle and currency configuration for PO. … add these for versioning"), with "Same pointers for Sales Orders & Quotes". This brings back the earlier touchpoint's model (§1) on the redesign's data, which is unchanged: an order's amounts are still kept in its currency with a rate to base, so what changes is what's shown. Paths are under `touchpoints/sales-order/src/app/`.

- **Base by default.** Every amount on the order is shown in PKR, the customer's amount and the rate in the hover (`components/currency/Money.tsx` `BaseMoney` / `BaseMoneyCard`: the base currency on top, "In PKR", "Customer currency", the rate, its type and day). On the SO page the rate is the order's; creating an order uses today's. The view sits on the document-currency context (`docCurrencyContext.ts` `view`, `docInBase`, `useDocView`, `useDocMoney`, `useDocWhole`, `useDocOtherText`, `useDesignMoney`; `DocCurrency.tsx` `DocMoney`; `useRuleMoney.ts` `money` / `baseText`), so line rows, Order Summary, invoicing, linked documents, hover cards, the rule, adjustment and freight modals, the line configurator and the release, cancel and archive confirmations all follow it.
- **The toggle and the Currency button.** The SO header has Base Currency | Customer Currency (only on an order in a foreign currency) and a Currency button, before the Full Screen and Actions buttons (`components/currency/SOCurrencyHeaderControls.tsx`, placed in `SODetail.tsx`). The view is kept per order for the session (`components/currency/soView.ts`) and is never an edit or a version change.
- **Prices typed in the shown currency.** In base view the price-per-unit capsule takes PKR; the price is converted at the order's rate and rounded to the order currency's minor unit (`SOLineGrid.tsx` `PriceCapsule`). An untouched input keeps the stored price. Line totals and the price breakdown hover are in the shown currency, with the other one under the breakdown's Total.
- **Order Summary** keeps the Grand Total in the shown currency (the other one on hover and in the caption) and, after the breakdown, the CURRENCY card (`SOCurrencyConfig.tsx` `SOCurrencySummary`): the rate-type chip, a Locked chip once the order leaves Draft, Customer pays / You receive / Base equivalent, the rate(s) and View configuration.
- **Currency Configuration** (`SOCurrencyConfig.tsx` `SOCurrencyConfigDialog`, rendered by `SOSidebar.tsx`): Customer pays (the order's currency; changing it converts every line, through the same confirmation as before), You receive (the settlement currency, PKR unless set; `SalesOrder.settlementCurrency`), the rate type and a corporate rate that can be changed with a reset to finance's, the rate cards, the amber lock note, and Reset to default. As the inline fields were, it can be changed while the order is a Draft and is read-only (Locked) after; a change is logged in Activity.
- **Versions.** Starting a version (`AutoVersionConfirmModal.tsx`, from a material change on a Released, Partially Shipped or Partially Cancelled order, "Edit as V{n}", and reverts from the Versions tab and the version dropdown) and reverting from the listing's or board's Version History (`VersionHistoryModal.tsx`) ask, on a foreign order, "Use locked rate from V{n}" or "Apply current rate" (`components/currency/VersionRateChoice.tsx`). Applying it restamps the order with today's rate of its type (`so/soCurrency.ts` `currentRateFor` / `withCurrentRate`; `store.tsx` `createVersionDraft` / `revertToVersion` take the choice) and logs an "Exchange rate Changed" entry in Activity; the customer's amounts don't move, the base totals do. Each version records the rate it took (`SOVersion` currency fields, `stampVersionRate`), so a revert with the locked rate restores V{n}'s (`versionRateFields`). The Versions tab and the Version History dialog show base at each version's own rate, or the order's currency when the page is toggled; compare adds an Exchange rate row.
- **Outside the SO page** amounts are base at the order's rate: the listing's Order Value, Invoiced Amount and Payments Made, the board's cards, the bulk release and submit modals, and modals opened from a row (wrapped in `SODocCurrency`). Creating an order shows catalog prices, line totals and the subtotal in base at today's rate, the customer's figure on hover and under the subtotal (`CreateSOStep2.tsx`). The listing's totals were already in base and are unchanged.
- **Not changed:** the printed order and its PDF (`PrintSalesOrder.tsx`, `SendToCustomerModal.tsx`, `soDocumentData.ts`) stay in the order's currency, the customer's document; so do the export file, the import preview, the change notes in version history and Activity (what the order recorded), and inputs labelled with the order's currency (one-time adjustment amounts, freight, the configurator's price).

## 3b. Configuration copy, version rates and orders from a quote (20 Nov 2026)

Mahreen's changes to the Currencies & Exchange Rates file (as for Quotes, with "order" for "quote"):

- **Price hovers before an order.** The orange line "Not on an order yet; an order takes the rate on its order date." is gone (`components/currency/Money.tsx`).
- **Currency Configuration copy** (`SOCurrencyConfig.tsx`): "Applies to order {n} only. The customer's default currency (USD) doesn't change."; "Defaults to the customer's currency. Changing it converts every line at the order date's rate."; "The currency you receive payment in. Defaults to your base currency."; "The rate is set on the order date and locks once the order leaves Draft, so the total doesn't move with the market. New versions keep it unless you switch to today's rate."
- **Version rates** (`components/currency/VersionRateChoice.tsx`): each option names its rate, "Mid-market · 1 USD = 278.5200 PKR · Nov 19, 2026", then the base total. "Apply current rate" has a Mid-market | Corporate switch when a corporate rate is set for the currency today, starting on the order's own type. The choice carries the type (`VersionRateChoice` is `"locked" | "current-mid" | "current-corporate"`, `todaysRateType` in `so/soCurrency.ts`), and `currentRateFor(so, type)` / `withCurrentRate(so, type)` (from `store.tsx` `createVersionDraft` / `revertToVersion`) stamp today's rate of that type.
- **Orders from a quote** (`sourceQuoteRef`) keep the quote's currency configuration. Their Currency Configuration is locked from the start, with "From quote {ref}. The order keeps the quote's currency configuration.", "From quote {ref}" under You receive, "Rate on {date}, from quote {ref}" on the rate card and an amber note that the rate comes from the quote. The CURRENCY card shows Locked with the same reason. The seeded orders' quote refs aren't quotes in the Quotes app, so their currency and rate stand in for the quote's. New versions can still take today's rate.

## 4. Shared currency code

| File | What it holds |
|---|---|
| `currency/currencies.ts`, `rates.ts`, `money.ts` | As in the other modules |
| `currency/soFx.ts` | `soFx` (an order's currency and rate), `stampSoRate`, `toSOBase`, `convertOn`, `todayFx`, `ruleAmountFactor`, `CUSTOMER_CURRENCIES` / `customerCurrency`, `isoDay` (SO dates are `YYYY/MM/DD`) |
| `components/so/soCurrency.ts` | `withSOCurrency`: the fields an order changes to when its currency, rate or "You receive" changes; `soRateFields`, `describeRateChange`; the version rate: `VersionRateChoice`, `currentRateFor`, `withCurrentRate`, `stampVersionRate`, `versionRateFields` |
| `components/so/soMoney.ts` | `formatWhole` (Order Summary's whole amounts), `txInOrderCurrency`, `itemListPrice` (an item master price in base, as Items keeps it), `restateDesign` / `restateDesignText` |
| `components/currency/Money.tsx`, `CurrencyChip.tsx`, `FlagImage.tsx`, `BaseCurrencyNote.tsx` | Money with its rate hover; flags; the base-currency pill |
| `components/currency/DocCurrency.tsx`, `docCurrencyContext.ts`, `SODocCurrency.tsx` | The order's currency, rate and view for everything the SO page, or a modal opened from the listing, renders: `DocMoney`, `useDocView`, `useDocMoney`, `useDocWhole`, `useDocOtherText`, `useDesignMoney` |
| `components/currency/soView.ts` | Which currency each order is shown in, for the session |
| `components/currency/SOCurrencyHeaderControls.tsx` | The header's Base Currency \| Customer Currency toggle and Currency button |
| `components/currency/SOCurrencyConfig.tsx` | Order Summary's CURRENCY card and the Currency Configuration dialog |
| `components/currency/SOCurrencyFields.tsx` | The currency picker, the Mid-market \| Corporate toggle and the convert confirmation the configuration uses. Its inline Order Summary fields (`SOCurrencyFields`) are no longer on the page |
| `components/currency/VersionRateChoice.tsx` | "Use locked rate from V{n}" / "Apply current rate" and `versionRateOptions` |
| `components/currency/useRuleMoney.ts` | Pricing-rule tiers in money: "$200 (≈ €182.75)" |

## 5. Data decisions

- **Customer currencies.** The design's customers are all US agencies, priced in USD. Six are seeded with another default currency so the listing shows orders in different currencies (`soFx.ts` `CUSTOMER_CURRENCIES`): Lakewood Community Hospital EUR, Summit Regional Medical Center GBP, Pacific Northwest Ambulance CAD, Heartland Air Ambulance AED, Coastal Search & Rescue JPY, and Valley Health Systems PKR (the base currency). Any other customer trades in USD. Change the map to change the demo.
- **Seeded orders** in another currency are restated once at the mid-market rate on their order date (`store.tsx` `inCustomerCurrency`): line prices, freight, the order total, linked documents and the total quoted in the generated description. Each order is stamped with that rate. USD orders keep the design's numbers, so SO-000-000-000 matches the audit's screenshot ($132,186).
- **New orders** take the customer's currency and the mid-market rate on the order date (`stampSoRate`); an order made from a quote with a rate keeps the quote's currency and rate (`createSO`), and its configuration is locked to the quote's (§3b). Catalog list prices, written in USD, convert at the same rate.
- **Pricing-rule flat amounts** ("$200 off per lightbar") stay written in USD, as Partners and Purchase Orders treat them, and convert at the mid-market cross rate on the order's rate date (`ruleAmountFactor`), not at the order's own rate, so changing only the rate never changes the total. The rule library's create form labels its amounts USD.
- **Demo seeds written in USD** (one-time adjustments, the mock version history and change notes, the insights catalog samples, customer revenue in the hover card) are restated in the order's, customer's or base currency where they show.
- **One-time adjustments** live on the SO page, not the order record (the design's model), so a reopened demo order re-seeds them, restated in its currency. An imported order's adjustments are kept in the new currency when its currency changes.
- **Linked documents** keep their own currency when it differs (a document raised before the order's currency changed); totals convert them into the order's.
- **You receive** (`SalesOrder.settlementCurrency`) is PKR unless set in the Currency Configuration. A duplicate for the same customer keeps it; for another customer it starts from PKR.
- **Version rates.** A version records the currency and rate it took when it is started, reverted to or left (`SOVersion` currency fields). Seeded versions have none and read the order's. A duplicate with all versions drops them, since the copy takes today's rate.
- **Import and export** carry each order's currency. An imported order with no currency takes its customer's default.

## 6. Running inside the shell

As for Partners and Purchase Orders, it lives in `src/embedding.ts`:

- The router basename is set in `routes.tsx`, and plain in-app link clicks go through the router.
- `components/so/AppLayout.tsx` hides the app's own sidebar and moves the Sales View / Approver View toggle into the header (`AppSidebar.tsx` `PersonaToggle`).
- New tabs open the shell's page, except the Partner Management tab (`openPartnerTab`, `/partners?…`), which posts its result back to the window that opened it and so opens this app's own page.
- `touchpoints/touchpoints.json` points at the new repo. The shell's Sales links (`/sales/sales-orders`, …) are unchanged.

## 7. Not in this step

- **Quotes** are their own touchpoint (audit pp. 11–12). "A converted quote keeps its currency and rate" is honoured by `createSO` when a quote's currency and rate are passed; the redesign has no convert-from-quote flow of its own.
- **Carrier rate cards** (`ShipmentMethodModal.tsx` carrier methods, "$45.00") are carriers' tariffs, not the order's freight charge. They keep `$`. The freight charged to the customer is in the order's currency.
- **Sourcing & Procurement** (`SourcingProductionTab.tsx`) lists purchase orders to vendors; those are Purchase Orders' amounts. They keep `$`.
- **The rule book** (`PricingRulesLibrary.tsx`, `pricingRulesData.ts`) is written in USD; its cards keep `$`, which is USD.
- **Unused design code** keeps `$`: the legacy Invoicing tab (the redesign shows "coming soon"), `LineEditDrawer.tsx`, `CreatePricingRuleModal.tsx`.
- **The outdated-configuration demo** (`data/outdatedConfigs.ts`) quotes a USD customer's credit limit in `$`.
- **Gaps in the design itself:** the listing's Order Value comes from `summarizeSO`, which leaves out rules and one-time adjustments, so it differs from Order Summary's Grand Total for the same order. The sidebar's mock invoices also show on new orders.
- **Upstream baseline:** `tsc` reports 32 errors, all in the design's own code; the one test passes. Both are the same in `Sales-Order-V5` itself.

## 8. Updating from the design repo

```bash
git subtree pull --squash --prefix touchpoints/sales-order https://github.com/ahtisham-omne/Sales-Order-V5.git main
npm run touchpoints:build -- sales-order
```

Files the currency work changed (§2–§5) can conflict with upstream changes. Keep both sides, then rebuild the copy.
