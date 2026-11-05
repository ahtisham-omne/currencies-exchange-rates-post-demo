# Sales Orders: currency & exchange-rate touchpoints

Sales Orders was redesigned. The new app comes from [`ahtisham-omne/Sales-Order-V5`](https://github.com/ahtisham-omne/Sales-Order-V5), at commit `a3a5940` (5 Nov 2026). This record does three things:

1. Lists the currency touchpoints the earlier Sales Orders touchpoint had (§1).
2. Maps each one onto the redesign (§2).
3. Says where everything is defined now (§3–§6).

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
| Money with hover | `components/currency/Money.tsx`, `DocCurrency.tsx`, `docCurrencyContext.ts`, `SODocCurrency.tsx` | As in Purchase Orders. The SO page puts its currency in `DocCurrencyProvider`, so rows, hover cards and modals format in it |
| Order currency config modal | `components/currency/SOCurrencyFields.tsx` | Replaced by the audit's Currency and Exchange rate fields in Order Summary, the same pattern as Purchase Orders (§3, item 3) |
| Rate KPI cards | Dropped | The audit asks for revenue in base, labelled; rates live in Currency & Exchange Rates |
| Base ↔ Customer switches | Dropped | The audit has each order's amounts in its own currency, and base where orders are added up |
| SO detail | `SOSidebar.tsx`, `SOLineGrid.tsx`, `InvoicingTab.tsx` `InvoiceSidebarSummary` | Every amount in the order's currency (§3, items 3–5). The base equivalent sits under the Grand Total |
| Version revert rate choice | Not carried | The redesign's revert flow has no rate step, and the currency only changes while the order is a Draft |
| Create SO | `CreateSOModal.tsx`, `CreateSOStep2.tsx` | The new order is in the customer's currency; catalog prices convert into it at today's rate |
| Duplicate, print | `duplicateSO.ts`, `PrintSalesOrder.tsx`, `SendToCustomerModal.tsx`, `soDocumentData.ts`, `shared/pdfDocument.tsx` | A duplicate for the same customer keeps the currency; for another customer it opens in that customer's currency, prices converted. Either way it takes today's rate. The document prints in the order's currency |
| Data | `store.tsx` `inCustomerCurrency`, `currency/soFx.ts` `CUSTOMER_CURRENCIES` | §5 |
| Embedding | `src/embedding.ts`, `routes.tsx`, `components/so/AppLayout.tsx`, `AppSidebar.tsx` | §6 |

## 3. The audit's 5 changes (pp. 13–14) and where they are

| # | Change | Where |
|---|---|---|
| 1 | Listing: Total Projected Revenue converted to base before summing, labelled | `SOList.tsx` `stats` / `insightCardData`: each order's grand total in PKR at its own rate (`toSOBase`), then added up. The same for Average Order Value, Open Order Value, Revenue at Risk, Pipeline Value and Cleared Value. "In PKR · base currency" pill beside Performance Insights (`components/currency/BaseCurrencyNote.tsx`) |
| 2 | Listing: Order Value, Invoiced Amount, Payments Made in each order's currency | `SOList.tsx` cells with `Money` (rate hover); the Currency column shows the flag. Sorting by Order Value and the value-range filter compare PKR (`SOFilterBar.tsx` labels the range PKR) |
| 3 | Order Summary: currency selector and rate | `SOCurrencyFields.tsx` in `SOSidebar.tsx`. The currency comes from the quote or the customer's default and can be changed while the order is a Draft: a confirmation shows the rate, the cross rate and the totals before and after; confirming converts every line and freight charge (`so/soCurrency.ts` `withSOCurrency`) and the fixed one-time adjustments (`handleCurrencyChange`), and logs it in Activity. The confirmation's totals are worked out the way the order will be (flat USD rule amounts at the new cross rate). Mid-market is read-only; Corporate is editable, with a reset to finance's rate. Changing a Draft's Requested On date re-takes the rate on the new date, unless a corporate rate was typed. Locked once the order leaves Draft |
| 4 | Invoiced, Paid, Outstanding in the order currency | `InvoicingTab.tsx` `InvoiceSidebarSummary`, with the rate hover. Paid notes that a payment settled at another rate is where realized FX gain or loss comes from (Customer Payments books it) |
| 5 | Price per unit uses $ | `SOLineGrid.tsx` `PriceCapsule`: the currency's symbol or code and minor unit (¥ has none); line totals, the price breakdown hover, the line configurator (`quote-creation/LineItemConfigModal.tsx`) and the price-scope modal follow |

## 4. Shared currency code

| File | What it holds |
|---|---|
| `currency/currencies.ts`, `rates.ts`, `money.ts` | As in the other modules |
| `currency/soFx.ts` | `soFx` (an order's currency and rate), `stampSoRate`, `toSOBase`, `convertOn`, `todayFx`, `ruleAmountFactor`, `CUSTOMER_CURRENCIES` / `customerCurrency`, `isoDay` (SO dates are `YYYY/MM/DD`) |
| `components/so/soCurrency.ts` | `withSOCurrency`: the fields an order changes to when its currency or rate changes |
| `components/so/soMoney.ts` | `formatWhole` (Order Summary's whole amounts), `txInOrderCurrency`, `itemListPrice` (an item master price in base, as Items keeps it), `restateDesign` / `restateDesignText` |
| `components/currency/Money.tsx`, `CurrencyChip.tsx`, `FlagImage.tsx`, `BaseCurrencyNote.tsx` | Money with its rate hover; flags; the base-currency pill |
| `components/currency/DocCurrency.tsx`, `docCurrencyContext.ts`, `SODocCurrency.tsx` | The order's currency for everything the SO page, or a modal opened from the listing, renders: `useDocMoney`, `useDocWhole`, `useDesignMoney` |
| `components/currency/SOCurrencyFields.tsx` | Order Summary's Currency and Exchange rate fields and the confirmation |
| `components/currency/useRuleMoney.ts` | Pricing-rule tiers in money: "$200 (≈ €182.75)" |

## 5. Data decisions

- **Customer currencies.** The design's customers are all US agencies, priced in USD. Six are seeded with another default currency so the listing shows orders in different currencies (`soFx.ts` `CUSTOMER_CURRENCIES`): Lakewood Community Hospital EUR, Summit Regional Medical Center GBP, Pacific Northwest Ambulance CAD, Heartland Air Ambulance AED, Coastal Search & Rescue JPY, and Valley Health Systems PKR (the base currency). Any other customer trades in USD. Change the map to change the demo.
- **Seeded orders** in another currency are restated once at the mid-market rate on their order date (`store.tsx` `inCustomerCurrency`): line prices, freight, the order total, linked documents and the total quoted in the generated description. Each order is stamped with that rate. USD orders keep the design's numbers, so SO-000-000-000 matches the audit's screenshot ($132,186).
- **New orders** take the customer's currency and the mid-market rate on the order date (`stampSoRate`); an order made from a quote with a rate keeps the quote's currency and rate (`createSO`). Catalog list prices, written in USD, convert at the same rate.
- **Pricing-rule flat amounts** ("$200 off per lightbar") stay written in USD, as Partners and Purchase Orders treat them, and convert at the mid-market cross rate on the order's rate date (`ruleAmountFactor`), not at the order's own rate, so changing only the rate never changes the total. The rule library's create form labels its amounts USD.
- **Demo seeds written in USD** (one-time adjustments, the mock version history and change notes, the insights catalog samples, customer revenue in the hover card) are restated in the order's, customer's or base currency where they show.
- **One-time adjustments** live on the SO page, not the order record (the design's model), so a reopened demo order re-seeds them, restated in its currency. An imported order's adjustments are kept in the new currency when its currency changes.
- **Linked documents** keep their own currency when it differs (a document raised before the order's currency changed); totals convert them into the order's.
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
