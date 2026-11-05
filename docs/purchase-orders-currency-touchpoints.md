# Purchase Orders: currency & exchange-rate touchpoints

Purchase Orders was redesigned. The new app comes from [`ahtisham-omne/Purchase-Order`](https://github.com/ahtisham-omne/Purchase-Order), at commit `601743b` (4 Nov 2026). This record does three things:

1. Lists the currency touchpoints the earlier Purchase Orders touchpoint had (§1).
2. Maps each one onto the redesign (§2).
3. Says where everything is defined now (§3–§6).

The redesign replaced the earlier touchpoint in `touchpoints/purchase-order` as a squashed git subtree. Only the Purchase Orders surfaces were in scope: the listing, PO detail, cart, catalogue, item modal, versions, print and dashboard. Procurement Planning (the audit's page 10) is out of scope, as the design repo's `CLAUDE.md` says (§7).

Sources:

- *Currencies & Exchange Rates: where each module changes* (design touchpoint audit, 4 Nov 2026), Purchase Orders, pages 8–9: "Document-level currency, defaulted from the vendor, changed from a selector near the totals." Six changes, from spec 4.2 and 4.3.
- *Currency & Exchange Rates Functional Spec v1.1*, sections 4.2 and 4.3 (as the audit cites them).

## 1. The earlier touchpoint (what it had, where)

The earlier touchpoint came from `ahtisham-omne/currency-exchange-rate-purchase-order-touchpoint`, at commit `1909371`. It was a Lovable remix of `Purchase-Order` at `1fb28bf` (12 Apr 2026). The currency work itself was commits `4847397`…`1909371`. Paths are as of commit `440df75` in this repo, under `touchpoints/purchase-order/src/app/`.

| Touchpoint | Where it was | What it did |
|---|---|---|
| Currency library | `data/currencyLibrary.ts` | Its own rates (USD 278, …), Market and Corporate snapshots, base PKR |
| Rate context | `context/RateContext.tsx` | A global Market / Corporate switch, written by the config modal |
| Money with hover | `components/ui/CurrencyAmount.tsx`, `CurrencyFlag`, `CurrencySymbol` | Amounts converted to PKR, the vendor amount and rate in the hover |
| Vendor currencies | `components/catalogData.ts` `VENDOR_CURRENCIES` | GM, Ford, Tesla, Rivian, Lucid USD; Chrysler, BMW EUR; TTC, Honda, Nissan JPY; the extended network's suppliers; Karachi Industrial Works PKR |
| PO currency | `components/poStore.ts` | `vendorAmountCurrency`, `settlementCurrency`, `rateSnapshot`, `rateType`; each line's `originalPrice` / `originalCurrency` / `lockedRate` |
| Listing KPIs | `components/currency/BaseCurrencyKPI.tsx` | Money KPIs and Add Insights in PKR |
| PKR vendor | `PurchaseOrdersListing.tsx` po-1 | Karachi Industrial Works, so a no-hover PO was in the demo |
| Cart | `currency/POPriceDisplay.tsx`, `CartAggregatedAmount.tsx` | Vendor prices shown in PKR with the vendor price in the hover; cross-vendor totals in PKR with a breakdown |
| PO detail amounts | `currency/POMoneyCell.tsx`, `POLockedRateHelper.tsx` | Amounts with a rate hover; a Draft at the live rate, a sent PO "Locked at" its rate |
| Order Summary currency card | `currency/POSummaryRateBadge.tsx` | Vendor receives / You pay / Base equivalent, with rates and flags |
| Base / Vendor toggle | `currency/POCurrencyHeaderControls.tsx` | Switched the PO's amounts between base and vendor currency; a Currency button opened the config modal |
| Currency config modal | `currency/POCurrencyConfigModal.tsx` | Vendor receives vs You pay (settlement), Mid / Corporate, a searchable picker; read-only past Draft |
| Versions | `poStore.ts` `exchange-rate-changed`, `currency/POVersionRateChip.tsx`, `RateContextStrip.tsx` | A rate change recorded a version; revert restored the rate choice |
| Item modal, vendor picker | `OrderFlow.tsx`, `VendorSelector.tsx` | Vendor price entry with the vendor's symbol; offers through `POPriceDisplay` |
| Duplicate PO | `DuplicatePODialog.tsx` | Currency UI matching Sales Orders |
| Print | `PrintPurchaseOrder.tsx`, `PrintOptionsDialog.tsx` | Amounts in the chosen currency |
| Embedding | `routes.tsx`, `layout/AppShell.tsx` (`38a9bf8`) | Router basename; sidebar hidden in the shell |

## 2. Mapping onto the redesign

Paths are under `touchpoints/purchase-order/src/app/`.

| Earlier touchpoint | In the redesign | Notes |
|---|---|---|
| Currency library, rate snapshots | `currency/currencies.ts`, `rates.ts`, `money.ts` | The same files as Vendor Invoicing and Partners: the module's Currency Library, its mid-market history (same seeds, last sync Apr 10, 2026) and its corporate rates |
| Rate context (global Market / Corporate) | Dropped | The rate type is per PO now (spec 4.3), chosen in Order Summary |
| Money with hover | `components/currency/Money.tsx`, `DocCurrency.tsx`, `docCurrencyContext.ts` | `<Money>`: amount in its currency, dotted underline, hover with base equivalent, rate, type, date. The PO page and the item modal put their currency in `DocCurrencyProvider`, so rows, hover cards and modals format in it |
| Vendor currencies | `currency/poFx.ts` `VENDOR_CURRENCIES`, `vendorCurrency` | The same map (Karachi Industrial Works dropped: the redesign has no such vendor). A vendor not listed is local and trades in PKR |
| PO currency fields | `components/poStore.ts` `PurchaseOrderData.currency / exchangeRate / rateType / rateDate / rateEdited`, read through `poFx` | One currency per PO, the rate taken on the PO date. No per-line original price: a line is in the PO's currency (spec 4.3). Settlement ("You pay") belongs to payments, not the PO |
| Listing KPIs | Nothing to convert | The redesign's strip is five order counts; its financial widgets are parked ("Buyer 2026-07-31", `InsightsDrawer.tsx`). The listing has no amount column |
| "POs created" modal | `PurchaseOrdersListing.tsx`, `CartPage.tsx`, `CatalogueModal.tsx` | Each PO's total in its own currency |
| PKR vendor | Dropped | A PKR PO is reached by changing a PO's currency to PKR, or by Procurement Planning's local suppliers |
| Cart | `CartPage.tsx`, `CatalogueModal.tsx` | Per the audit (§3, items 1–3) |
| PO detail amounts | `PurchaseOrderDraft.tsx`, `components/currency/DocCurrency.tsx` | Every amount in the PO's currency (§3, item 4) |
| Order Summary currency card | `components/currency/POCurrencyFields.tsx` | Replaced by the audit's Currency and Exchange rate fields (§3, item 5), plus the total's base equivalent |
| Base / Vendor toggle | Dropped | The audit has every amount in the document's currency; the base equivalent is on hover and under the total |
| Currency config modal | Dropped | Its picker and Mid / Corporate choice moved into Order Summary; the change opens a confirmation instead |
| Versions | `poStore.ts` (`exchange-rate-changed`, snapshot currency fields), `poVersionDisplay.ts`, `POVersion*.tsx`, `POCompareFullScreen.tsx` | A currency or rate change is a version change ("USD → EUR · 1 EUR = 299.6683 PKR"). Each version is shown in its own currency with its rate; compare highlights Currency and Exchange rate; revert restores them |
| Item modal, vendor picker | `OrderFlow.tsx`, `VendorSelector.tsx`, `MultiUnitPriceTable.tsx`, `QualifyVendorPricingModal.tsx`, `PriceConfirmationDialog.tsx` | The vendor's price book is in the vendor's currency. Offers show their currency and "≈ ₨…" so vendors rank fairly. On a PO line the modal is in the PO's currency |
| Duplicate PO | `poStore.ts` `duplicatePO`, `PurchaseOrderDraft.tsx` `DuplicatePODialog` | Same vendor: keeps the currency. Another vendor: opens in that vendor's currency, prices converted; the dialog says so |
| Print | `PrintPurchaseOrder.tsx`, `PODocumentPreviewDialog.tsx` | The document in the PO's (or the printed version's) currency, a Currency row, "Grand Total (EUR)", and a rate footnote for a foreign PO |
| Embedding | `src/embedding.ts`, `routes.tsx`, `layout/AppShell.tsx` | As for Partners and Vendor Invoicing (§6) |

## 3. The audit's 6 changes (pp. 8–9) and where they are

| # | Change | Where |
|---|---|---|
| 1 | Cart: vendor subtotal in the vendor's currency | `CartPage.tsx` vendor group header (`VendorGroup.currency`), `CatalogueModal.tsx` cart view. The amount has a hover at today's rate (`todayFx`) and a flag + code |
| 2 | Cart: groups carry different currencies | Each group is in its vendor's default currency and becomes one PO in it (`createPOFromVendorCheckout`). Cart lines are kept in the vendor's currency: `cartStore.ts` `addToCart` converts a price given in another currency (`priceCurrency`) |
| 3 | Cart total mixes currencies | Order Summary lists each vendor in its own currency; the totals are in PKR, "converted at today's rate" (`inTotals`). A cart in one currency keeps its totals in it, with the PKR equivalent underneath |
| 4 | PO: no fixed `$` | `PurchaseOrderDraft.tsx`: price inputs take the currency's symbol or code and minor unit (¥ has none); line totals, discounts, rule and one-time amounts, Order Summary, toasts and change records use `formatMoney`. Hover cards and modals read the page's `DocCurrencyProvider` |
| 5 | PO: currency selector and exchange rate in Order Summary | `components/currency/POCurrencyFields.tsx`. Picking another currency opens a confirmation with the rate, the cross rate and the totals before and after; confirming converts every line, the shipping fee and fixed one-time amounts (`poStore.ts` `withPOCurrency` / `setPOCurrency`) and goes through the page's version prompt. Mid-market is read-only; Corporate is editable, with a reset to finance's rate. Pricing rules stay applied: their tiers are quantity bands, and each rule's impact shows its base equivalent (the price breakdown hover, the rule detail modal) |
| 6 | PO: vendor's default currency under Vendor Information | `POSidebarSections.tsx` `VendorInfoCard`: "Default currency" with flag and name, and whether the PO opened in it or was changed |

## 4. Shared currency code

| File | What it holds |
|---|---|
| `currency/currencies.ts`, `rates.ts`, `money.ts` | As in Vendor Invoicing and Partners |
| `currency/poFx.ts` | `poFx` (a PO's currency and rate), `stampPoRate`, `toPOBase`, `toPOCurrency` / `fromPOCurrency`, `todayRate`, `todayFx`, `toBaseToday`, `crossRate`, `roundTo`, `RULE_AMOUNT_CURRENCY` / `ruleAmountFactor`, `VENDOR_CURRENCIES` / `vendorCurrency` |
| `components/currency/Money.tsx`, `CurrencyChip.tsx`, `FlagImage.tsx`, `BaseCurrencyNote.tsx` | Money with its rate hover; flags at the Currency & Exchange Rates size (17×13); the "In PKR · base currency" pill |
| `components/currency/DocCurrency.tsx`, `docCurrencyContext.ts` | The document's currency for everything a PO or the item modal renders |
| `components/currency/POCurrencyFields.tsx` | Order Summary's Currency and Exchange rate fields and the confirmation |
| `components/currency/useRuleMoney.ts` | Pricing-rule tiers and impacts in money: "$15.00 (≈ €13.71)", "Tier 25–49 units", "≈ ₨123,540.00" |

## 5. Data decisions

- **Vendor prices.** The design writes every price in USD. Catalog prices and vendor offers are restated once in each vendor's currency at the last synced mid-market rate (`catalogData.ts` `convertListPrice`), so a Toyota hydraulic pump reads ¥49,534, not ¥342. Each item keeps its USD list price (`listPriceUsd`), and the catalogue's price sort compares items in PKR.
- **Seeded POs** are restated the same way, at the rate on each PO's date, and stamped with it (`poStore.ts` `inVendorCurrency`). GM's are USD, so 395-9900 keeps the design's numbers.
- **New POs** take the vendor's currency and the mid-market rate on the PO date (`stampPoRate`). A PO date after the last sync uses the last synced rate, as in the other modules.
- **Pricing-rule flat amounts** ("$15 off per unit") stay written in USD, as Partners treats them. They are converted to the PO's currency at the mid-market cross rate on its PO date (`ruleAmountFactor`; today's in the cart), not at the PO's own rate, so changing only the rate (mid-market to corporate, a typed rate) never changes the PO's total. The 100% cap check uses the same conversion.
- **The mock shipping fee** ($12.50 a line, outside the total) and **the credit-limit gate** ($125,000) are written in USD and compared in the PO's currency.
- **Dashboard spend** is in PKR with the base-currency pill (`PODashboard.tsx`); its mock series is restated from USD.
- **Procurement Planning's prices are USD.** Its entry points into Purchase Orders say so (`priceCurrency: "USD"` in `PODemands.tsx` and `PlannerWorkspacePage.tsx`; `"USD"` passed by `PODemands.tsx` and `RecommendedPOsModal.tsx` to `createPOFromVendorCheckout`), and the cart or PO converts them to the vendor's currency. The item modal keeps them labelled USD: an offer built from an item's own price carries that price's currency (`ItemVendorOffer.currency`). Nothing Planning shows changed.

## 6. Running inside the shell

As for Partners and Vendor Invoicing, it lives in `src/embedding.ts`:

- The router basename is set in `routes.tsx`, and plain in-app link clicks go through the router.
- `layout/AppShell.tsx` hides the app's own sidebar.
- `touchpoints/touchpoints.json` points at the new repo. The shell's Supply Chain Management links (`/supply-chain/purchase-orders`, …) are unchanged.

## 7. Not in this step

- **Procurement Planning** (audit p. 10: vendor prices in the vendor's currency with a base equivalent in the sandbox) is out of scope per the design repo's `CLAUDE.md`. Its prices stay `$`.
- **Purchase Requests** and the **contacts directory** keep the design's `$`. Requests estimate in USD from each item's USD list price (`listPriceUsd`); a request turned into a PO is converted to the vendor's currency (`PurchaseRequestDetail.tsx`).
- **Item master prices** in the item quick views (`QuickViewPanel.tsx`, `pocQuickViewPanel.tsx`, `ItemHoverCard.tsx`) are mock list prices of the Items module (audit: Items v2).
- **Settlement currency** ("You pay" in the earlier config modal) belongs to payments and invoices, not the PO.
- **Gaps in the design itself:**
  - The item modal's vendor price book is the vendor's. On a PO whose currency was changed, book prices convert at the PO's rate when they become the line's price; editing the book itself stays in the vendor's currency.
  - The pricing-rule "Value-Based" mode stores its order-value limits as quantity bands, a prototype quirk; they are labelled USD.

## 8. Updating from the design repo

```bash
git subtree pull --squash --prefix touchpoints/purchase-order https://github.com/ahtisham-omne/Purchase-Order.git main
npm run touchpoints:build -- purchase-order
```

Files the currency work changed (§2–§5) can conflict with upstream changes. Keep both sides, then rebuild the copy.
