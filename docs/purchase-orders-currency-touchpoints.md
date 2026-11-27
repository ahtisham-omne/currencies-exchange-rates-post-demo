# Purchase Orders: currency & exchange-rate touchpoints

> **27 Nov 2026:** "Mid-market" is now the **daily market rate** everywhere (Eli's ruling, 26 Nov 2026: one rate per currency per day, read once a day from Open Exchange Rates and fixed for that date). This record uses the new name; the code keeps the identifier `mid`. Mahreen's design changes of the same day are in [currency-review-27-nov-plan.md](currency-review-27-nov-plan.md).

Purchase Orders was redesigned. The new app comes from [`ahtisham-omne/Purchase-Order`](https://github.com/ahtisham-omne/Purchase-Order), at commit `601743b` (4 Nov 2026). This record does three things:

1. Lists the currency touchpoints the earlier Purchase Orders touchpoint had (§1).
2. Maps each one onto the redesign (§2).
3. Says where everything is defined now (§3–§6).

The redesign replaced the earlier touchpoint in `touchpoints/purchase-order` as a squashed git subtree. Only the Purchase Orders surfaces were in scope at first: the listing, PO detail, cart, catalogue, item modal, versions, print and dashboard, as the design repo's `CLAUDE.md` says. Procurement Planning (the audit's page 10) was added afterwards, on request (§5, "Procurement Planning").

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
| Currency library, rate snapshots | `currency/currencies.ts`, `rates.ts`, `money.ts` | The same files as Vendor Invoicing and Partners: the module's Currency Library, its daily market rate history (same seeds, last sync Apr 10, 2026) and its corporate rates |
| Rate context (global Market / Corporate) | Dropped | The rate type is per PO now (spec 4.3), chosen in Order Summary |
| Money with hover | `components/currency/Money.tsx`, `DocCurrency.tsx`, `docCurrencyContext.ts` | `<Money>`: amount in its currency, dotted underline, hover with base equivalent, rate, type, date. The PO page and the item modal put their currency in `DocCurrencyProvider`, so rows, hover cards and modals format in it |
| Vendor currencies | `currency/poFx.ts` `VENDOR_CURRENCIES`, `vendorCurrency` | The same map (Karachi Industrial Works dropped: the redesign has no such vendor). A vendor not listed is local and trades in PKR |
| PO currency fields | `components/poStore.ts` `PurchaseOrderData.currency / exchangeRate / rateType / rateDate / rateEdited`, read through `poFx` | One currency per PO, the rate taken on the PO date. No per-line original price: a line is in the PO's currency (spec 4.3). Settlement ("You pay") belongs to payments, not the PO |
| Listing KPIs | Nothing to convert | The redesign's strip is five order counts; its financial widgets are parked ("Buyer 2026-07-31", `InsightsDrawer.tsx`). The listing has no amount column |
| "POs created" modal | `PurchaseOrdersListing.tsx`, `CartPage.tsx`, `CatalogueModal.tsx` | Each PO's total in its own currency |
| PKR vendor | Dropped | A PKR PO is reached by changing a PO's currency to PKR, or by Procurement Planning's local supplier (Acme Supply Co) |
| Cart | `CartPage.tsx`, `CatalogueModal.tsx` | Per the audit (§3, items 1–3) |
| PO detail amounts | `PurchaseOrderDraft.tsx`, `components/currency/DocCurrency.tsx` | Every amount in the PO's currency (§3, item 4) |
| Order Summary currency card | `components/currency/POCurrencyConfig.tsx` `POCurrencySummary` | Brought back (§3a): Vendor receives / You pay / Base equivalent, the rate(s), the rate type and a Locked chip, and View configuration |
| Base / Vendor toggle | `components/currency/POCurrencyHeaderControls.tsx`, `currency/poView.ts` | Brought back (§3a): Base Currency (the default) or Vendor Currency, for the whole PO |
| Currency config modal | `components/currency/POCurrencyConfig.tsx` `POCurrencyConfigDialog` | Brought back (§3a), from the header's Currency button and the card's View configuration. It hosts the redesign's picker, rate type and corporate rate, and its convert confirmation |
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
| 5 | PO: currency selector and exchange rate in Order Summary | `components/currency/POCurrencyFields.tsx`. Picking another currency opens a confirmation with the rate, the cross rate and the totals before and after; confirming converts every line, the shipping fee and fixed one-time amounts (`poStore.ts` `withPOCurrency` / `setPOCurrency`) and goes through the page's version prompt. The daily market rate is read-only; Corporate is editable, with a reset to finance's rate. Pricing rules stay applied: their tiers are quantity bands, and each rule's impact shows its base equivalent (the price breakdown hover, the rule detail modal) |
| 6 | PO: vendor's default currency under Vendor Information | `POSidebarSections.tsx` `VendorInfoCard`: "Default currency" with flag and name, and whether the PO opened in it or was changed |

## 3a. Base currency first, the toggle, the configuration and version rates (18 Nov 2026)

Asked for after the audit's changes: "In POs, the prices should always be in the base currency. And on the hover, it should show vendor currency if different. Add the toggle and currency configuration for PO. … add these for versioning." This brings back the earlier touchpoint's model (§1) on the redesign's data, which is unchanged: a PO's amounts are still kept in its currency with a rate to base, so what changes is what's shown.

- **Base by default.** Every amount on the PO and in the catalogue is shown in PKR, the vendor's amount and the rate in the hover (`BaseMoney` / `BaseMoneyCard` in `Money.tsx`: the base currency on top, "In PKR", "Vendor currency", the rate, its type and day). On a PO the rate is the PO's; in the catalogue it's today's. The cart shows plain PKR amounts (§3b).
- **The toggle.** The PO header has Base Currency | Vendor Currency (only on a PO in a foreign currency) and a Currency button. The view sits on the document-currency context (`docCurrencyContext.ts` `view`, `useDocView`, `useDocMoney`, `useDocOtherText`), so line rows, Order Summary, hover cards, rule and adjustment modals and the item modal all follow it. It's kept per PO for the session (`poView.ts`) and is never an edit. *(Removed 24 Nov, §3c: the view is pinned to base.)*
- **Prices typed in the shown currency.** In base view the price input takes PKR; the price is converted at the PO's rate and rounded to the vendor currency's minor unit. An untouched input keeps the stored price.
- **Currency Configuration** (`POCurrencyConfig.tsx`): Vendor receives (the PO's currency; changing it converts every line, through the same confirmation as before), You pay (the settlement currency, PKR unless set; `PurchaseOrderData.settlementCurrency`, kept in version snapshots), the rate type and a corporate rate that can be changed, the rate cards, and Reset to default. Saving goes through the page's edit guard, so on a Sent PO it starts a new version.
- **Order Summary** keeps the total in the shown currency with the other one under it, and ends with the CURRENCY card.
- **Versions.** Saving a version (`POVersionSaveModal`) and reverting to one (`POVersionRevertModal`, from the history tab, the history dialog and the version dropdown) ask, on a foreign PO: "Use locked rate from V{n}" or "Apply current rate". Applying it restamps the PO with today's rate of its type (`poStore.ts` `currentRateFor` / `applyCurrentRate`) and records an Exchange rate change; the vendor's amounts don't move, the base totals do. Version rows, snapshots and compare show base at each version's own rate (`poVersionDisplay.ts` `versionMoney`), or the version's currency when the page is toggled.
- **Not changed:** the printed PO and its PDF stay in the PO's currency, the vendor's document. Procurement Planning keeps vendor prices in the vendor's currency with the base beside them (§5).

## 3b. Cart, configuration copy and version rates (20 Nov 2026)

Mahreen's changes to the Currencies & Exchange Rates file:

- **Price hovers before a PO.** The orange line "Not on a PO yet; a PO takes the rate on its PO date." is gone (`Money.tsx`); the hover still dates the rate "Today, …".
- **Cart: no conversion UI.** *(The currency tags came back on 24 Nov, §3c; amounts stay plain PKR.)* Item prices are base-currency prices, so the Cart page and the Catalogue's cart panel show prices, vendor subtotals and the Order Summary as plain PKR amounts: no vendor currency tags, no rate hovers, no "In PKR, base currency · 3 currencies converted at today's rate" line (`CartPage.tsx`, `CatalogueModal.tsx`). The figures are the base amounts shown before, so the cart still matches the catalogue. The "Purchase Orders Created" list keeps each PO's hover, as those are POs; Procurement Planning's base line (`PlannerMoney.tsx`) is unchanged.
- **Currency Configuration copy** (`POCurrencyConfig.tsx`): "Applies to PO {n} only. The vendor's default currency (USD) doesn't change."; "Defaults to the vendor's currency. Changing it converts every line at the PO date's rate."; "The currency you pay this PO in. Defaults to your base currency."; "This rate is locked so the PO total doesn't move with the market. New versions keep it unless you switch to today's rate." Open Exchange Rates links to its site (README, "The rate provider's link").
- **Version rates** (`components/currency/VersionRateChoice.tsx`): each option names its rate, "Daily market rate · 1 USD = 278.5200 PKR · Nov 19, 2026", then the base total. "Apply current rate" has a Daily market rate | Corporate rate switch when a corporate rate is set for the currency today, starting on the PO's own type. The choice carries the type (`VersionRateChoice` is `"locked" | "current-mid" | "current-corporate"`, `todaysRateType` in `poStore.ts`), and `currentRateFor(po, type)` / `applyCurrentRate(po, type)` stamp today's rate of that type.

## 3c. Currency Touchpoints Map (24 Nov 2026)

The product team's *Currency Touchpoints Map*: Purchase Orders 1–5, Receiving 1–2, and its pricing-rule rule (Partners 5–6) as it applies to the PO module's own rule book. Where it differs from §3a–§3b or §5, the map wins; those points are marked. Paths are under `touchpoints/purchase-order/src/app/`. The demo's own data and rates are kept (the map's figures are illustrations).

- **Catalogue** (`components/CatalogueModal.tsx`): prices stay in PKR with the same rate hover as Items. A foreign vendor now carries its currency tag (`CurrencyPill`, flag + code) after its name: the vendor pill on an item, the vendor offers under an item, the By Vendor group header and the By POC subtitle. A PKR vendor gets none.
- **Cart** (`components/CartPage.tsx`, the Catalogue's cart panel, `components/currency/cartCurrency.ts`): amounts stay plain PKR with no hover, but each vendor group and each vendor in Order Summary has its currency tag again, and the note under the total reads "3 POs: General Motors (GM) in USD, Toyota Technical Center (TTC) in JPY, Chrysler (Stellantis N.V.) in EUR." (`poPerVendorLine`). It replaces "N separate POs will be created — one per vendor" and also shows for a single vendor.
- **Header** (`components/currency/POCurrencyHeaderControls.tsx`, `PurchaseOrderDraft.tsx`): after the version dropdown, "· Rivian Automotive [USD] [Currency]": the vendor, the PO's currency tag (foreign POs only) and the Currency button (Settings2), which opens the configuration. The Base Currency | Vendor Currency toggle is gone (reverses §3a): the page pins its view to base (`poView = "base"`), so the document-currency plumbing is unchanged; `components/currency/poView.ts` was deleted as unused.
- **Lines and Order Summary**: lines stay in PKR with the hover and no currency tags. The total is in PKR with "Vendor receives $7,414.80 USD" under it (was "≈ $7,414.80 USD · vendor currency"). The CURRENCY block at the end of Order Summary (`components/currency/CurrencyBlock.tsx`, `POCurrencySummary` in `POCurrencyConfig.tsx`) has the rate type and a lock chip, always shown on a foreign PO: Unlocked (amber) on a Draft or Sent PO, Locked (green) once confirmed, its hover saying when it locks. Rows: Vendor receives / You pay / Base equivalent (only when paying from a non-base account) / Rate "1 USD = ₨264.5919 PKR". A PKR PO keeps the "PKR is the base currency, so there's no conversion." line instead of rows. The block is shared with the Receiving Docs tab.
- **Fixed one-time discounts/premiums in base** (`components/AdjustmentFormModal.tsx`): a fixed amount is typed in the shown currency, PKR on a foreign PO (the ₨ toggle), with "≈ $37.79 USD in the vendor's currency" under it. It is still kept in the PO's currency: converted at the PO's rate and rounded to its minor unit, as a typed line price is, so ₨10,000 on a USD PO at 264.5919 is kept as $37.79 and shows as ₨9,998.93. An untouched amount keeps its stored value. The item list in the form shows line values in PKR.
- **"You pay" is an account** (`currency/companyAccounts.ts`, new): the PO is paid from a company bank or cash account in the base currency or the PO's own, copied from Vendor Invoicing's `PAY_FROM_ACCOUNTS` with the same ids, labels and currencies (1010 · JPMorgan Operating, 1020, 1030, 1000 · Petty Cash Drawer in PKR; 1040 USD, 1050 EUR, 1060 GBP, 1070 AED). It is stored on the PO and its version snapshots (`poStore.ts` `payFromAccount`), 1010 unless set, and `settlementCurrency` is derived from it, so a PO saved with only a settlement currency resolves to that currency's account (`resolvePayFrom`). Changing the PO's currency to one the account isn't in puts it back on 1010 (`withPOCurrency`). Duplicating a PO keeps the account when the new PO's currency allows it. The change record reads "1010 · JPMorgan Operating (PKR) → 1040 · Global FX Settlement (USD)". This supersedes §7's "Settlement currency belongs to payments".
- **Locking** (`poStore.ts` `isPORateLocked`): Draft and Sent are unlocked; Confirmed and every later status are locked; a cancelled PO keeps the state it was cancelled in (reactivating returns it there). The Order Summary chip and the configuration's read-only state follow it. A Sent PO's configuration still goes through the page's edit guard and version prompt, as before.
- **Currency Configuration** (`POCurrencyConfig.tsx`): Vendor receives (amount + currency picker, unchanged, with the convert confirmation); You pay ("≈ ₨1,961,896.02" + the pay-from picker `PayFromPicker`, rows of flag, account, bank and mask, and code, only eligible accounts; paying from a USD account the amount is the USD one with "≈ ₨… PKR in the base currency" under it); Rate (Daily market rate | Corporate rate, the corporate rate still editable, the rate card) ending "May 12, 2024 · PO date [Unlocked] locks when the PO is confirmed" (or "[Locked] locked when the PO was confirmed"). The amber note now says the rate is taken on the PO date and locks when the PO is confirmed (unlocked), or that it locked when the PO was confirmed (locked), instead of "This rate is locked" on every PO. On a locked PO the dialog is read-only with a Locked chip by the title. The second rate card for a third "You pay" currency is gone, since accounts are only in base or the PO's currency.
- **Version rates** (`components/currency/VersionRateChoice.tsx`): the options read "Keep version 1's rate  1 USD = 264.5919 PKR" and "Use today's rate  1 USD = 278.5200 PKR", each with "Daily market rate · May 12, 2024 · total ₨…" under it (Mahreen's detail from §3b kept), and the Daily market rate | Corporate rate switch on today's option. Used by the revert prompt (`POVersionRevertModal.tsx`) and the save-version prompt (`POVersionSaveModal.tsx`). The revert prompt keeps its "Revert to V1" title and button, as the rest of the version UI says Revert.
- **Printed PO** (`components/PrintPurchaseOrder.tsx`): still in the PO's currency with "Grand Total (USD)"; the footnote is now "All amounts in United States Dollars (USD)." (the currency list's name, made plural where English does), on every PO, replacing the exchange-rate footnote with its base equivalent. The Currency row reads "United States Dollar (USD)".
- **Receiving Docs tab** (`components/currency/receivingDocs.ts`, `components/currency/POReceivingDocsTab.tsx`, replacing the Coming Soon panel; `?tab=receiving-docs` opens it): Receiving Doc | Completed | Value. Each row: "REC-000250 [USD]" with "Rate 1 USD = ₨259.6485 PKR · receiving date" (or "· today"), the completion date and a Locked chip (or "In progress", its start date and Unlocked), and the value in PKR with the rate hover. Opening a row lists what was received and the currency block: "Received / Base value / Rate · Jun 23, 2024" or "Received so far / Base value / Rate · today". The rate type follows the PO (corporate falls back to the daily market rate on a day with no corporate rate); a completed doc takes the rate on the day it completed, one in progress today's; nobody changes it. The docs are read from the PO's receiving data: each goods receipt recorded on the PO ("Confirm Receipt") is one completed doc (`ReceivingRecord.receivingDocId`, dated the local day); quantities received without a record (the seeded POs, Mark as Fully Received) make one doc from the receiving start date, completed on `receivingCompletedDate` once the PO is fully received, in progress until then. Value = received quantity × the line's net price per unit (its line total ÷ its quantity, so pricing rules and item-level one-times are in; order-level ones and shipping are not). Seeded examples: 395-9836 (Tesla, USD, completed), 395-9832 (BMW, EUR, completed), 395-9830 and 395-9834 (Honda and Toyota, JPY, in progress).
- **Pricing rules in the base currency** (`currency/poFx.ts` `RULE_AMOUNT_CURRENCY` / `ruleAmountFactor`, `components/poPricingRulesData.ts`, `components/currency/useRuleMoney.ts`, `POCreatePricingRuleModal.tsx`, `POPricingRuleDetailModal.tsx`, `POPricingRulesManageModal.tsx`, `POBrowsePricingTemplatesModal.tsx`, `POPriceBreakdownHoverCard.tsx`, `OrderFlow.tsx`): a rule has no currency; its flat amounts and order values are PKR. The rule book's USD amounts were restated ×280, the map's factor: Ford Lighting Bulk $15 → ₨4,200 per unit, BMW Sensor Contract Rate $5 → ₨1,400. On a PO in another currency a flat amount is converted at the PO's own rate (1 ÷ rate; today's in the cart), replacing §5's "USD at the PO date's daily market rate cross rate": changing only a PO's rate now changes what a flat rule amount comes to. Rules now carry a basis (`VendorPricingRule.basis`, volume unless set): a value-based rule's tiers are order-value bands in PKR, checked against the PO's value in base (its lines × its rate, `orderBaseValue`), shown as "₨700,000+ order value"; this fixes §7's quirk of value limits read as quantity bands. Creating or editing a rule shows "Currency  PKR · base currency" locked, and the rule's own basis (a flat "$" amount no longer implies Value). The rule detail shows the same Currency row.
- **Not changed / not done**: Duplicate PO still takes today's rate on the new PO date, with no "Keep the original rate / Use today's rate" prompt (the map's PO section has none). Restoring a version can still apply today's rate to a confirmed PO, as the map's restore prompt offers it. Procurement Planning is untouched.

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

- **Vendor prices.** The design writes every price in USD. Catalog prices and vendor offers are restated once in each vendor's currency at the last synced daily market rate (`catalogData.ts` `convertListPrice`), so a Toyota hydraulic pump reads ¥49,534, not ¥342. Each item keeps its USD list price (`listPriceUsd`), and the catalogue's price sort compares items in PKR.
- **Seeded POs** are restated the same way, at the rate on each PO's date, and stamped with it (`poStore.ts` `inVendorCurrency`). GM's are USD, so 395-9900 keeps the design's numbers.
- **New POs** take the vendor's currency and the daily market rate on the PO date (`stampPoRate`). A PO date after the last sync uses the last synced rate, as in the other modules.
- **Pricing-rule flat amounts** *(superseded 24 Nov, §3c: rules are in PKR, converted at the PO's rate)* ("$15 off per unit") stay written in USD, as Partners treats them. They are converted to the PO's currency at the daily market rate cross rate on its PO date (`ruleAmountFactor`; today's in the cart), not at the PO's own rate, so changing only the rate (daily market rate to corporate, a typed rate) never changes the PO's total. The 100% cap check uses the same conversion.
- **The mock shipping fee** ($12.50 a line, outside the total) and **the credit-limit gate** ($125,000) are written in USD and compared in the PO's currency.
- **Dashboard spend** is in PKR with the base-currency pill (`PODashboard.tsx`); its mock series is restated from USD.
- **Procurement Planning works in USD.** Its data and solver keep every vendor price in USD, and its entry points into Purchase Orders say so (`priceCurrency: "USD"` in `PODemands.tsx` and `PlannerWorkspacePage.tsx`; `"USD"` passed by `PODemands.tsx` and `RecommendedPOsModal.tsx` to `createPOFromVendorCheckout`), so the cart or PO converts them to the vendor's currency. The item modal keeps them labelled USD: an offer built from an item's own price carries that price's currency (`ItemVendorOffer.currency`). What Planning *shows* is in each vendor's currency (below).

### Procurement Planning (audit p. 10)

"Vendor prices in the vendor's currency with a base equivalent in the sandbox." Paths are under `touchpoints/purchase-order/src/app/`.

- **Vendor currencies.** The planner's suppliers are in `currency/poFx.ts` `VENDOR_CURRENCIES`, by where each is based: Globex Industrial EUR, Stark Industries USD, Wayne Enterprises GBP, Fastenal, Grainger and McMaster-Carr USD, Bosch and Brembo EUR, Denso and NTN JPY, Bossard CHF, and so on. Acme Supply Co, the planner's primary, is left out, so it stays a local PKR supplier. These names appear only in Planning, so no existing PO changes.
- **One conversion.** `components/currency/PlannerMoney.tsx` turns a planner price (USD) into the vendor's currency with `convertListPrice`, the conversion the cart (`cartStore.ts` `inVendorCurrency`) and PO creation use. So a planned PO shows the figure it lands in the cart and PO with. Line totals are the converted unit price × quantity, as on the PO. The solver still ranks and splits in USD; one rate applies to every vendor, so the ranking is the same as in base.
- **Where it shows:**
  - The Sandbox's Qualified Vendors panel: each vendor's price in its currency with the rate hover (`Money`, today's rate), and "≈ ₨…" beside it, so vendors in different currencies compare at a glance. Cheapest and dearest stay green and red.
  - The Sandbox's add-to-cart confirmation: each planned PO's unit price and total in the vendor's currency with "≈ ₨…"; the total is in the one currency with its PKR equivalent, or in PKR ("In PKR, base currency · N currencies converted at today's rate") when the plan spans currencies, as the cart's Order Summary does. The header's Total cost and the button's hint use the same total.
  - The Auto recommendation review: each PO's unit price and total in the vendor's currency with "≈ ₨…", and the total as above. The "context line" on a resolved card too.
  - The vendor lists in the gap graph, the add-a-PO chooser and the supply wizard: the price in the vendor's currency (plain text, as those rows are buttons), plus "≈ ₨…" in the chooser.
  - Snapshot compare: plan costs in PKR (compact), since plans can mix vendors.
  - Recommended POs and the "one PO per vendor" preview on the All Demand listing: each vendor's subtotal and lines in its currency with "≈ ₨…". Neither is opened anywhere in the current design (`setRecommendModalOpen(true)` and `bulkCreatePOs` have no callers), so these are ready for when they are.
  - The timeline variation (`PlannerTimelineCanvas.tsx`, hidden behind `SHOW_TIMELINE_VARIATION`): its vendor rows' prices, the same way.
- **Not changed:** pricing-rule badges (their value-based bands are USD, as in §7).

## 6. Running inside the shell

As for Partners and Vendor Invoicing, it lives in `src/embedding.ts`:

- The router basename is set in `routes.tsx`, and plain in-app link clicks go through the router.
- `layout/AppShell.tsx` hides the app's own sidebar.
- `touchpoints/touchpoints.json` points at the new repo. The shell's Supply Chain Management links (`/supply-chain/purchase-orders`, …) are unchanged.

## 7. Not in this step

- **Purchase Requests** and the **contacts directory** keep the design's `$`. Requests estimate in USD from each item's USD list price (`listPriceUsd`); a request turned into a PO is converted to the vendor's currency (`PurchaseRequestDetail.tsx`).
- **Item master prices** in the item quick views (`QuickViewPanel.tsx`, `pocQuickViewPanel.tsx`, `ItemHoverCard.tsx`) are mock list prices of the Items module (audit: Items v2).
- **Settlement currency** ("You pay" in the earlier config modal) belongs to payments and invoices, not the PO. *(Superseded 24 Nov, §3c: "You pay" is the PO's pay-from account.)*
- **Gaps in the design itself:**
  - The item modal's vendor price book is the vendor's. On a PO whose currency was changed, book prices convert at the PO's rate when they become the line's price; editing the book itself stays in the vendor's currency.
  - The pricing-rule "Value-Based" mode stores its order-value limits as quantity bands, a prototype quirk; they are labelled USD. *(Fixed 24 Nov, §3c: value-based rules are read against the PO's value in PKR.)*

## 8. Updating from the design repo

```bash
git subtree pull --squash --prefix touchpoints/purchase-order https://github.com/ahtisham-omne/Purchase-Order.git main
npm run touchpoints:build -- purchase-order
```

Files the currency work changed (§2–§5) can conflict with upstream changes. Keep both sides, then rebuild the copy.
