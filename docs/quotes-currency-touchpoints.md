# Quotes: currency & exchange-rate touchpoints

Quotes was redesigned. The new app comes from [`ahtisham-omne/quote-craft-hub-82`](https://github.com/ahtisham-omne/quote-craft-hub-82), at commit `1057bd7` (6 Nov 2026). This record does three things:

1. Lists the currency touchpoints the earlier Quotes touchpoint had (§1).
2. Maps each one onto the redesign (§2).
3. Says where everything is defined now (§3–§6), including what was brought back from the earlier touchpoint on 18 Nov 2026 (§3a).

The redesign replaced the earlier touchpoint in `touchpoints/quotes` as a squashed git subtree. The slug, port (8106) and mount (`/sales/quotes`) are unchanged.

Sources:

- *Currencies & Exchange Rates: where each module changes* (design touchpoint audit, 4 Nov 2026), Quotes, pages 11–12: "Same document-level behaviour as POs, defaulted from the customer." Five changes, from spec 4.2 and 4.3.
- *Currency & Exchange Rates Functional Spec v1.1*, sections 4.2 and 4.3 (as the audit cites them).

## 1. The earlier touchpoint (what it had, where)

The earlier touchpoint came from `ahtisham-omne/currency-exchange-rate-quotes-touchpoint`, at commit `0dc1904`. It was a Lovable remix of `quote-craft-hub-82` at `19e05a4` (30 Apr 2026). The currency work itself was commits `6b9b518` to `0dc1904`. Paths are as of commit `440df75` in this repo, under `touchpoints/quotes/src/app/`.

| Touchpoint | Where it was | What it did |
|---|---|---|
| Currency library | `data/currencyLibrary.ts`, `data/rateDateFormat.ts` | Its own ISO list, Market and Corporate snapshots, base PKR |
| Rate context | `context/RateContext.tsx`, `components/currency/MarketCorporateToggle.tsx`, `RateContextStrip.tsx` | A global Market / Corporate switch and a strip stating the rate in use |
| Money with hover | `components/ui/CurrencyAmount.tsx`, `CurrencyFlag.tsx`, `components/currency/QuoteMoney.tsx` | Amounts with a hover giving the other currency and the rate |
| Quote currency config | `components/currency/QuoteCurrencyConfigModal.tsx`, `QuoteCurrencyPicker.tsx` | Currency and rate type per quote ("Customer Pays" / "You Receive") |
| Rate KPIs | `components/currency/BaseCurrencyKPI.tsx`, `RateKpiValue.tsx`, `RateContextKpiContent.tsx`, `quotes/KpiInsightsPanel.tsx` | Base-currency KPIs and rate cards in Performance Insights |
| Listing | `pages/QuotesListPage.tsx`, `components/TableView.tsx`, `quotes/ColumnHeaderMenu.tsx`, `quotes/FiltersModal.tsx` | A Base ↔ Customer switch on Quote Value; a currency filter |
| Quote detail | `pages/QuoteDetails.tsx`, `quote-details/RightSidebar.tsx`, `ItemsTabTableClean.tsx`, `TransactionsTab.tsx`, `VersionHistoryTab.tsx`, `LinkedTransactionsTab.tsx` | A page-wide base/customer view and the configurator button in the header; Quote Summary in both currencies; locked rates |
| Create quote | `quote-creation/Step1CustomerSelection.tsx`, `Step2Configuration.tsx`, `Step3LineItems.tsx`, `LineItemConfigModal.tsx`, `quote-details/ProductPickerModal.tsx` | The customer's currency; line items in base PKR with the hover |
| Send, PDF, duplicate | `quote-details/SendToCustomerModal.tsx`, `PDFPreviewModal.tsx`, `DuplicateQuoteModal.tsx` | A rate-lock banner; an FX header and footer on the PDF; a duplicate at the locked rate or today's |
| Data | `data/mockQuotes.ts` | Quotes cycled through ten currencies (`CUSTOMER_CURRENCY_CYCLE`) |

## 2. Mapping onto the redesign

Paths are under `touchpoints/quotes/src/app/`.

| Earlier touchpoint | In the redesign | Notes |
|---|---|---|
| Currency library, rate snapshots | `currency/currencies.ts`, `rates.ts`, `money.ts` | The same files as the other modules: the module's Currency Library, its mid-market history (same seeds, last sync Apr 10, 2026) and its corporate rates |
| Rate context (global switch) | Dropped | The rate type is per quote now (spec 4.3), in Quote Summary |
| Money with hover | `components/currency/Money.tsx` (`Money`, `BaseMoney`), `DocCurrency.tsx`, `docCurrencyContext.ts`, `QuoteDocCurrency.tsx` | As in Purchase Orders. The quote page puts its currency, rate and view in `DocCurrencyProvider`, so rows, hover cards and modals show amounts in base by default, the customer's on hover (§3a) |
| Quote currency config modal | `components/currency/QuoteCurrencyConfig.tsx` `QuoteCurrencyConfigDialog` | Brought back (§3a), from the header's Currency button and Quote Summary's View configuration: Customer pays / You receive, the rate type and the rate. It hosts the redesign's picker, rate type, corporate rate and convert confirmation (`QuoteCurrencyFields.tsx`), which replaced it at first (§3, item 4) |
| Rate KPI cards | Dropped | The audit asks for the total in base, labelled; rates live in Currency & Exchange Rates |
| Base ↔ Customer switches, currency filter | `components/currency/QuoteCurrencyHeaderControls.tsx`, `quoteView.ts` | The quote page's Base Currency \| Customer Currency toggle is back (§3a). On the listing every amount is in base now, the quote's currency on hover; the optional Currency column can be sorted. The currency filter stays dropped |
| Quote detail | `RightSidebar.tsx`, `ItemsTabTableClean.tsx`, `components/currency/QuoteCurrencyConfig.tsx` `QuoteCurrencySummary` | Every amount kept in the quote's currency (§3, items 3–5) and shown in base by default (§3a). Quote Summary ends with the CURRENCY card |
| Version revert rate choice | `components/currency/VersionRateChoice.tsx`, `data/quoteStore.ts` (version rates) | Brought back (§3a): "Use locked rate from V{n}" or "Apply current rate", wherever a version is made or reverted to |
| Create quote | `CreateQuoteModal.tsx`, `quote-creation/Step3LineItems.tsx`, `quote-details/ProductPickerModal.tsx`, `quote-creation/LineItemConfigModal.tsx` | The new quote is in the customer's currency; catalog prices convert into it at today's rate and are shown in base with the hover (§3a). Picking another customer converts what was already added |
| Send, PDF, duplicate | `quote-details/quotePdfAdapter.ts`, `shared/pdfDocument.tsx`, `PDFPreviewModal.tsx`, `SendToCustomerModal.tsx`, `data/duplicateQuote.ts` | The document prints in the quote's currency, from the quote page, the listing's Print and Download, and Send from the Kanban board. A duplicate for the same customer keeps the currency; for another customer it opens in that customer's currency, prices converted. Either way it takes today's rate |
| Data | `data/mockQuotes.ts` `inCustomerCurrency`, `currency/qFx.ts` `CUSTOMER_CURRENCIES` | §5 |
| Embedding | `src/embedding.ts`, `src/EmbeddingBridge.tsx`, `app/App.tsx`, `pages/RootLayout.tsx` | §6 |

## 3. The audit's 5 changes (pp. 11–12) and where they are

| # | Change | Where |
|---|---|---|
| 1 | Listing: Total Value KPI adds quotes in different currencies | `quotes/KpiInsightsPanel.tsx`: each quote's value in PKR at its own rate (`toQuoteBase`), then added up; the same for Avg Quote Value and Open Quote Value. "In PKR · base currency" pill beside Performance Insights (`components/currency/BaseCurrencyNote.tsx`). The Kanban column totals are in base too, headed "(PKR)" (`KanbanView.tsx`). Sorting by Quote Value, the Filters value range and the column's own filter compare PKR, and both ranges are labelled PKR (`FiltersModal.tsx`, `quotes/ColumnHeaderMenu.tsx`) |
| 2 | Listing: Quote Value in the quote's currency; optional Currency column | Since §3a, in base at each quote's own rate with the quote's currency on hover: `QuotesListPage.tsx` Quote Value cell with `BaseMoney`, the Kanban card with `QuoteValue`; the line-items hover gives the price per unit in base too. A Currency column (flag and code, sortable) is in the column picker, hidden by default, as Vendor Invoicing has it |
| 3 | Price per unit uses $ | `ItemsTabTableClean.tsx`: price per unit, line totals and the version strings with the shown currency's symbol or code and minor unit (¥ has none): base by default, the quote's with the toggle (§3a). The price breakdown hover, the line configurator, the price-scope modal, the rule and adjustment modals and the product picker follow |
| 4 | Currency selector and rate in Quote Summary | Since §3a in the Currency Configuration (`QuoteCurrencyConfig.tsx`), with Quote Summary's CURRENCY card; at first `QuoteCurrencyFields.tsx` in `RightSidebar.tsx`. The currency comes from the customer's default and can be changed while the quote is a Draft: a confirmation shows the rate, the cross rate and the totals before and after; confirming converts every line, the freight charges and the fixed one-time adjustments (`QuoteDetails.tsx` `handleCurrencyChange`, `quote-details/quoteCurrency.ts`), whichever tab is open. The quote record follows (its currency, rate and line items), so the listing, Print and Duplicate agree. The confirmation's totals are worked out the way the quote will be (`currencyTotalsFor`), so they agree with the result to the cent. Mid-market is read-only; Corporate is editable, with a reset to finance's rate. A rate change alone converts nothing; it changes the base equivalent. Locked once the quote leaves Draft, or when the page is read-only |
| 5 | Pricing rules on a foreign-currency quote | `PricingRulesManageModal.tsx` rule cards: what the rule takes off (or adds to) this quote in the shown currency, with the other one beside it ("−¥3,376,131 on this quote · ≈ ₨6,492,299.91 PKR" in the customer's view; base first, the yen beside it, by default, §3a). A "$" tier is written in USD and is followed by its amount in the quote's currency ("$200 (≈ €…)"), in the cards, the line's price breakdown and the rule list. The design's quote rules are quantity-tiered, so the threshold met is a quantity band; see §7 for the rule book's value thresholds |

## 3a. Base currency first, the toggle, the configuration and version rates (18 Nov 2026)

Asked for after the audit's changes, as for Purchase Orders ("Same pointers for Sales Orders & Quotes"): amounts in the base currency with the customer's currency on hover, a Base Currency | Customer Currency toggle and a Currency button, and on versioning a choice between "Use locked rate from V{n}" and "Apply current rate". This brings back the earlier touchpoint's model (§1) on the redesign's data, which is unchanged: a quote's amounts are still kept in its currency with a rate to base, so what changes is what's shown. Paths are under `touchpoints/quotes/src/app/`.

- **Base by default.** Every amount on the quote page is shown in PKR, the customer's amount and the rate in the hover (`BaseMoney` / `BaseMoneyCard` in `components/currency/Money.tsx`: the base currency on top, "In PKR", "Customer currency", the rate, its type and day). The view sits on the document-currency context (`docCurrencyContext.ts` `view`, `useDocView`, `useDocMoney`, `useDocWhole`, `useDocOtherText`, `useDesignMoney`), so the line rows, Quote Summary, the price breakdown, the rule, adjustment and freight-split modals, the transactions tab, Convert to SO, communications and the version history all follow it, and `useRuleMoney`'s amounts and "≈" text too.
- **The toggle.** The quote header has Base Currency | Customer Currency (only on a quote in a foreign currency) and a Currency button, before Full Screen (`components/currency/QuoteCurrencyHeaderControls.tsx`). The view is kept per quote for the session (`components/currency/quoteView.ts`) and is never an edit.
- **Prices typed in the shown currency.** In base view the items table's price per unit and the line configurator's take PKR; the price is converted at the quote's rate and rounded to the quote currency's minor unit, and an untouched input keeps the stored price. Fixed one-time discounts and premiums, freight and the shipment cost are still typed in the quote's currency, what the customer is charged, and those forms read in it (`shared/AdjustmentFormModal.tsx`, `shared/FreightBreakdownModal.tsx`, `quote-creation/ShipmentMethodModal.tsx`), as Purchase Orders' adjustment form does.
- **Currency Configuration** (`components/currency/QuoteCurrencyConfig.tsx` `QuoteCurrencyConfigDialog`): Customer pays (the quote's currency; changing it converts every line, through the same confirmation as before), You receive (the settlement currency, PKR unless set; `Quote.settlementCurrency`), the rate type and a corporate rate that can be changed, the rate cards, an amber note on the lock, and Reset to default. It changes only while the quote is a Draft, as before; once sent it is read-only, with a Locked chip. A "You receive" change is recorded like the other currency changes (`QuoteDetails.tsx` `handleCurrencyChange`).
- **Quote Summary** shows the Grand Total in the shown currency, with the other one beside the item count, and ends with the CURRENCY card (`QuoteCurrencySummary`): the rate type, Locked once sent, Customer pays / You receive / Base equivalent, the rate(s), and View configuration. The inline Currency and Exchange rate fields are gone; `QuoteCurrencyFields.tsx` keeps the picker, the rate-type toggle and the convert confirmation the dialog reuses.
- **Versions.** Wherever the redesign makes a version or reverts to one, a quote in a foreign currency asks "Use locked rate from V{n}" or "Apply current rate" (`components/currency/VersionRateChoice.tsx`): the material-change prompt (`AutoVersionConfirmModal.tsx`), Edit as V{n+1} on a confirmed quote (which now confirms first, foreign-currency quotes only), Reactivate (`ReactivateChoiceModal.tsx`), and Revert from the header, the version dropdown, the Versions tab and the listing's version history. Applying today's rate restamps the quote with today's rate of its type (`currency/qFx.ts` `currentRateFor`); reverting with the locked rate takes back the rate that version had. The customer's amounts don't move: flat USD rule amounts and the design's figures convert on the quote date, not the rate date. Only the base totals do.
- **Each version's rate.** The design's versions carry no snapshot, so the rate each version locked in is kept in `data/quoteStore.ts` (`seedVersionRates`, `setVersionRate`, `VersionRateChoice`): seeded from the quote's own rate the first time it opens and kept in step with the version in force. The Versions tab and the listing's version history show each version in base at its own rate (`components/currency/versionMoney.ts`), or in the quote's currency when the page is toggled, with "Rate locked: 1 EUR = … PKR" in an expanded version. The listing's version history now gets the quote's own currency (it was handed only the id and version, so it read USD).
- **Outside the quote page**, amounts are in PKR with the hover: the listing's Quote Value and its line-items hover, the Kanban card, the customer card's average quote value, and the create-quote flow's catalog prices, line totals and subtotal (at today's rate, with "In PKR, base currency · EUR converted at today's rate"). The product picker's price filter takes the shown currency. Figures that were already in base (the KPIs, the Kanban column totals, sorting and the value filters) are unchanged.
- **Not changed:** the printed quote, its PDF and the Send preview stay in the quote's currency, the customer's document, as Purchase Orders keeps the printed PO in the vendor's.
- **In the demo** every quote is dated after the rate history's last sync (Apr 10, 2026), so today's mid-market and corporate rates are the ones locked in, and the choice says "Today's rate is the same". It differs on a quote whose corporate rate was typed: today's applies finance's rate.

## 4. Shared currency code

| File | What it holds |
|---|---|
| `currency/currencies.ts`, `rates.ts`, `money.ts` | As in the other modules |
| `currency/qFx.ts` | `quoteFx` (a quote's currency and rate), `stampQuoteRate`, `toQuoteBase`, `convertOn`, `todayFx`, `ruleAmountFactor`, `CUSTOMER_CURRENCIES` / `customerCurrency`, `isoDay` |
| `currency/quoteMoney.ts` | `formatWhole` (Quote Summary's whole amounts), `itemListPrice` (an item master price in base, as Items keeps it), `restateDesign` / `restateDesignText` |
| `components/quote-details/quoteCurrency.ts` | `withQuoteCurrency` (the fields a quote changes to, and the factor its amounts convert by), `scaleQuoteLine`, `scaleAdjustments` |
| `components/currency/Money.tsx`, `CurrencyChip.tsx`, `FlagImage.tsx`, `BaseCurrencyNote.tsx`, `QuoteValue.tsx` | Money with its rate hover; flags; the base-currency pill; a quote's value in its currency |
| `components/currency/DocCurrency.tsx`, `docCurrencyContext.ts`, `QuoteDocCurrency.tsx` | The quote's currency, rate and view for everything the quote page, or a modal opened from the listing, renders: `DocMoney`, `useDocView`, `useDocMoney`, `useDocWhole`, `useDocOtherText`, `useDesignMoney`, and each version's rate (`versionFx`) |
| `components/currency/Money.tsx` `BaseMoney`, `BaseMoneyCard` | An amount kept in the quote's currency, shown in base with the customer's amount on hover |
| `components/currency/QuoteCurrencyHeaderControls.tsx`, `quoteView.ts` | The header's Base Currency \| Customer Currency toggle and Currency button; the view per quote |
| `components/currency/QuoteCurrencyConfig.tsx` | Quote Summary's CURRENCY card and the Currency Configuration dialog |
| `components/currency/QuoteCurrencyFields.tsx` | The currency picker, the rate-type toggle and the convert confirmation (and the earlier inline fields, no longer shown) |
| `components/currency/VersionRateChoice.tsx`, `versionMoney.ts` | The locked-or-current rate choice; versions shown at their own rate |
| `components/currency/useRuleMoney.ts` | Pricing-rule tiers and impacts in money |

## 5. Data decisions

- **Customer currencies.** The same map as Sales Orders (`qFx.ts` `CUSTOMER_CURRENCIES`): Lakewood Community Hospital EUR, Summit Regional Medical Center GBP, Pacific Northwest Ambulance (Co.) CAD, Heartland Air Ambulance AED, Coastal Search & Rescue JPY, and Valley Health System(s) PKR, the base currency. Any other customer trades in USD. A quote and the order made from it agree.
- **Seeded quotes** in another currency have their value restated once at the mid-market rate on their quote date (`mockQuotes.ts` `inCustomerCurrency`), and each is stamped with that rate. USD quotes keep the design's numbers.
- **Settlement currency.** "You receive" (`Quote.settlementCurrency`) is PKR unless set in the Currency Configuration. It changes no amount; the CURRENCY card and the dialog show the total in it at the mid-market rate on the quote's rate date.
- **A version's rate.** Applying today's rate on a new version moves the quote's rate and rate date (the hover then reads "version date"); the design's figures and flat rule amounts still convert on the quote date, so only the base equivalent changes.
- **The quote page's lines.** The design shows the same mock line set (`MOCK_LINE_ITEMS`) on every quote. On a quote in another currency it is restated at the mid-market cross rate on the quote date (`designFactor`), and so are the one-time adjustment seeds, the default freight and the lines the pricing rules are worked out on, so they all stay in step. A currency change multiplies that factor by the cross rate between the quote's two rates, and the store keeps it per quote (`quoteStore.ts` `setQuoteLineFactor`), so a reopened quote shows the same figures. A line's subtotal stays quantity × price per unit.
- **New quotes** take the customer's currency and the mid-market rate on the day (`stampQuoteRate`). Catalog list prices, written in USD, convert at the same rate, and the price filter works in that currency.
- **Pricing-rule flat amounts** ("$200 off per unit") stay written in USD, as Partners, Purchase Orders and Sales Orders treat them, and convert at the mid-market cross rate on the quote's rate date (`ruleAmountFactor`), not at the quote's own rate, so changing only the rate never changes the total. The rule library's create form labels its amounts USD.
- **Demo figures written in USD** (the mock version history and its change notes, linked transactions, the customer's average quote value, the convert-to-SO summary, communications) are restated in the quote's or customer's currency where they show.
- **One-time adjustments** live on the quote page, not the quote record (the design's model), so a reopened demo quote re-seeds them, restated in its currency. An imported quote's adjustments are kept in the new currency when its currency changes.

## 6. Running inside the shell

As for Partners, Purchase Orders and Sales Orders, it lives in `src/embedding.ts`:

- The router basename is set in `app/App.tsx`, and `src/EmbeddingBridge.tsx` routes the shell's in-app navigation.
- `pages/RootLayout.tsx` hides the app's own sidebar.
- `touchpoints/touchpoints.json` points at the new repo. The shell's Quotes link (`/sales/quotes`) is unchanged.

## 7. Not in this step

- **Value thresholds in the rule book.** The rule book's value-based presets ("10% off on orders over $1,000") are written in USD and keep `$`, which is USD; the create form labels them. The design's apply path only re-activates rules already on the quote, so a preset applied from the library is not attached to the quote and no value threshold shows there. If it is wired up, its threshold should read in USD ("$100,000 USD threshold met") beside the converted amounts, per the audit.
- **Carrier rate cards** (`quote-creation/ShipmentMethodModal.tsx` carrier methods) are carriers' tariffs, not the quote's freight charge. They keep `$`. The freight charged to the customer is in the quote's currency.
- **The outdated-configuration demo** (`data/outdatedConfigs.ts`) shows a credit-limit change in `$`.
- **Unused design code** keeps `$`: `PerformanceInsights.tsx`, `FilterBar.tsx`, `ViewControls.tsx`, `TableView.tsx`, `QuoteSummaryPanel.tsx`, `AdvancedConfiguratorModal.tsx`, `QuotePreviewHoverCardContent.tsx`, `quote-creation/Step4Review.tsx`, `quote-creation/PricingRuleLibraryModal.tsx`, `CreatePricingRuleModal.tsx`. None is rendered.
- **Gaps in the design itself:**
  - The items table resets to its starting lines whenever it is shown again (switching tabs), so edits made before are dropped. After a currency change that start is the design's lines restated once, which can differ by a rounding unit from lines converted in place.
  - Every quote's page shows the same mock lines and the pricing rules worked out on them, so a new quote with one line still shows the mock lines' rule discount (and can go negative). The listing's Quote Value is the record's own total until the quote is opened, when the page writes its line subtotal back.
  - The rule cards round each rule's amount to a whole unit and add those, so their footer can differ by one unit from Quote Summary's total.
- **Upstream baseline:** `tsc` reports 23 errors, all in the design's own code; the one test passes. Both are the same in `quote-craft-hub-82` itself.

## 8. Updating from the design repo

```bash
git subtree pull --squash --prefix touchpoints/quotes https://github.com/ahtisham-omne/quote-craft-hub-82.git main
npm run touchpoints:build -- quotes
```

Files the currency work changed (§2–§5) can conflict with upstream changes. Keep both sides, then rebuild the copy.
