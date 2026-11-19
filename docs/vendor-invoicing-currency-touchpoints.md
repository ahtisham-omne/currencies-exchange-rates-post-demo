# Vendor Invoicing: currency & exchange-rate touchpoints

Vendor Invoicing was redesigned. The new app comes from [`ahtisham-omne/vendor-invoicing-payments`](https://github.com/ahtisham-omne/vendor-invoicing-payments), at commit `9e28b7f`. This record does three things:

1. Lists the currency touchpoints the earlier Vendor Invoicing touchpoint had (§1).
2. Maps each one onto the redesign (§2).
3. Says where everything is defined now (§3–§5).

The redesign replaced the earlier touchpoint in `touchpoints/vendor-invoicing` as a squashed git subtree. Only Vendor Invoicing was in scope. Vendor Payments, Customer Invoicing and the other modules in the audit come with the app, but their currency work is a later step (§6).

Sources:

- *Currencies & Exchange Rates: where each module changes* (design touchpoint audit, 4 Nov 2026), Vendor Invoicing pages 15–17.
- *Currency & Exchange Rates Functional Spec v1.1*, sections 2.2, 2.3, 3.5, 4.2, 4.3 and 4.4.

## 1. The earlier touchpoint (what it had, where)

The earlier touchpoint came from `ahtisham-omne/currency-exchange-rate-vendor-invoicing-touchpoint`, at commit `63712dd`. Its paths are as of commit `440df75` in this repo, under `touchpoints/vendor-invoicing/src/app/`. The currency work itself was commits `c5439d4`…`63712dd`, made on the base Lovable app (`b152e9b`).

| Touchpoint | Where it was | What it did |
|---|---|---|
| Currency library | `data/currencyLibrary.ts` | 156 currencies, base PKR, mid-market and corporate snapshots (55 rates), conversion helpers, `flagCodeForCurrency` |
| Rate context | `context/RateContext.tsx` | App-wide rate type. Its only writer was the config modal's global Mid-market/Corporate switch |
| Money cell + hover | `components/currency/VIMoneyCell.tsx`, `components/ui/CurrencyAmount.tsx` | Symbol prefix with a dotted underline. The hover showed the base equivalent, rate, rate type, source and lock date |
| Base-currency KPIs | `components/currency/BaseCurrencyKPI.tsx`, used by `InvoiceListScreen.tsx` | Compact ₨ figures with a base-currency hover |
| "Show values as" switch | `components/currency/AmountColumnHeaderMenu.tsx`, `AdvancedInvoiceTable.tsx` | Amount column header menu: Base / Vendor currency, defaulting to base |
| Currency column | `AdvancedInvoiceTable.tsx` | Bare ISO code. No filter |
| Detail Base/Vendor toggle + "Currency" button | `components/currency/VICurrencyHeaderControls.tsx`, `InvoiceDetailScreen.tsx` | Switched every amount on the page between base and vendor currency |
| Currency Configuration modal | `components/currency/VICurrencyConfigModal.tsx` | Vendor receives / You pay (settlement currency), rate type switch, lock badge and rate metadata. Save only showed a toast |
| Currency & Rate Preview | `components/currency/RatePreviewModal.tsx`, `InvoiceCreationFlow.tsx` | A step between PO selection and the form: the PO's locked rate vs today's rate, the variance, and "What to expect" |
| Live amounts in the PO picker | `VendorSelectionModalNested.tsx` (`LiveMoneyCell`) | PO amounts in ₨ at today's rate, with the PO's rate in the hover |
| Prepayments, Receiving | `PrepaymentsScreen.tsx`, `ReceivingDocumentsScreen.tsx` | Money cells in ₨ at today's rate |
| Invoice FX fields | `data/mockInvoices.ts` | `lockedRate` / `lockedAt` (invoice date), `poLockedRate` / `poLockedAt` |

Known problems in the earlier touchpoint, all fixed or made moot by the port:

- KPIs summed raw amounts across currencies and labelled the result PKR.
- Created invoices saved no rate.
- The rate was taken on the invoice date, not the posting date.
- The corporate switch was global and relabelled locked rates.
- "Vendor receives" in the config modal disagreed with the invoice.
- The PO rate was synthetic, built from a formula copied three times.
- There was no currency filter, and several "$" signs were still hard-coded.

## 2. Mapping onto the redesign

| Earlier touchpoint | In the redesign | Notes |
|---|---|---|
| Currency library + rate snapshots | `app/currency/currencies.ts`, `app/currency/rates.ts` | The currency list is copied, by script, from the Currency & Exchange Rates module's own library (`src/app/data/currencies.ts`): the same 156 currencies, names, symbols, decimals and flags. Rates are the module's own (`src/app/data/exchangeRates.ts`), and the mid-market history is generated with its seeds, so an invoice's rate matches the pair's Rate History. A day after the last sync takes the last synced rate. Corporate rates are effective from their date. |
| `RateContext` (global rate type) | Rate type is **per invoice** (`Invoice.rateType`) | Mid-market is read-only and Corporate is editable on the invoice (spec 3.5). The default is the module's `DEFAULT_RATE_TYPE` (mid-market). There is no global switch. |
| Money cell + hover (`VIMoneyCell` / `CurrencyAmount`) | `components/currency/Money.tsx` (`Money`, `MoneyCard`, `RateDetails`) | Kept: dotted underline on foreign amounts, and a hover with the base equivalent, rate, type and source. The hover now gives the **posting date**, not the invoice date. |
| `BaseCurrencyKPI` | `InvoiceInsightsPanel.tsx` (base sums) + `components/currency/BaseCurrencyNote.tsx` | Each invoice is converted at its own rate before summing (audit item 1). The band is labelled "In PKR · base currency". |
| "Show values as" switch | Dropped | The audit says the Amount column follows the row's Currency column (item 2), and the hover gives the base value. Sorting by Amount uses the base equivalent. |
| Currency column | `InvoiceDataTable.tsx` currency column (flag + code) | Kept (item 3). A Currency filter now sits beside Vendor and Payment Terms. |
| Detail Base/Vendor toggle + "Currency" button | `invoice-details/InvoiceDetailSidebar.tsx` | General Information shows Currency (flag + code) and Exchange Rate (rate, type, posting date, "changed on the invoice"). The Invoice Summary shows the PKR equivalent. Detail amounts stay in the invoice currency, with the hover for base; the GL is in base. |
| Currency Configuration modal | Replaced by the form's Currency + Exchange Rate row (§3) | Currency and rate are set where the invoice is written and saved with it. The modal's settlement currency ("You pay") belongs to the payment, so it moves to Vendor Payments (audit pp. 18–21). |
| Currency & Rate Preview (PO vs today) | The "vs PO" chip on the Exchange Rate field (`InvoiceCurrencyFields.tsx`, `PoRateCompare`) | The same comparison (PO rate, invoice rate, variance, strengthened/weakened copy) inline, without an extra step. It compares against the **posting date's** rate, not today's. POs now carry a real rate from their PO date (`VendorPO.exchangeRate`). |
| PO picker live amounts | `VendorSelectionModalNested.tsx` | PO, receiving and line amounts are in the PO's currency. The PO value has the rate hover at the PO date. The vendor row shows its currency. |
| Prepayments / Receiving money | Not ported | Prepayments are part of Vendor Payments in the redesign (§6). Receiving documents show no amounts at document level. |
| `lockedRate` / `lockedAt` | `Invoice.exchangeRate`, `rateType`, `rateDate`, `rateEdited` | Taken on the posting date. A pre-invoice takes its rate when it is first paid (`handleSettleInvoices` in `App.tsx`); paid seed pre-invoices carry the rate of their last update. |
| `FlagImage` / `CurrencyFlag` | `components/currency/FlagImage.tsx`, `CurrencyChip.tsx` | Same 4:3 flag-icons set, loaded from the shell's `/flags/4x3/`. |

## 3. The audit's 8 changes (pp. 15–17) and where they are

Paths are under `touchpoints/vendor-invoicing/src/app/`.

| # | Change | Where |
|---|---|---|
| 1 | KPIs converted to base and labelled | `components/InvoiceInsightsPanel.tsx` (`fmtMoney`, `sum`, `outstanding`, top vendor); `components/InvoiceListScreen.tsx` `<BaseCurrencyNote />` |
| 2 | Amount symbol follows the Currency column | `components/InvoiceDataTable.tsx` Amount, Amount Due and Discount columns; card view in `InvoiceListScreen.tsx`. These columns sort and range-filter on the PKR equivalent, and their header ⓘ says so. |
| 3 | Currency column kept, Currency filter beside Vendor and Payment Terms | `InvoiceDataTable.tsx` currency column; `InvoiceListScreen.tsx` `MultiSelectFilter label="Currency"`. The Filters modal keeps its Currency section, with the same state. The modal's amount range is in base. |
| 4 | Vendor picker reads the vendor's currency from the partner record | Vendors carry a real currency (`data/mockVendors.ts` → `currencyForVendorName`). `StandaloneVendorSelectionModal.tsx` and `VendorSelectionModalNested.tsx` show a currency pill, and their descriptions read it. The hard-coded "USD settlements" bio in `InvoiceDataTable.tsx` reads it too. |
| 5 | Currency and Exchange Rate in Invoice Details | `components/CreateInvoiceScreen.tsx`: state (search "Currency & Exchange Rates (spec 4.4, 3.5)"), the row under Posting Date / Trigger Date, and validation (`rateMissing`). The fields are in `components/currency/InvoiceCurrencyFields.tsx`. The currency is locked to the PO's, else defaults to the vendor's and can be changed (full list). The rate is taken on the posting date: read-only on Mid-market, editable on Corporate (with reset). A pre-invoice's rate is "Set when paid". |
| 6 | Line amounts in the invoice currency | `CreateInvoiceScreen.tsx`: standalone Amount, PO price per unit and line totals, charges, freight and the breakdown (`money()`, `moneySymbol`) |
| 7 | Total Due in invoice currency with the base equivalent | `CreateInvoiceScreen.tsx` Total Due footer |
| 8 | A/P posted in base at the invoice rate | `CreateInvoiceScreen.tsx` "Posts to A/P in PKR" under A/P Account. The GL Impact preview, the submit confirmation and the saved `glEntries` are all built through `currency/glFx.ts` (`glInBase`, `baseGlEntries`). The detail GL tab (`invoice-details/GLImpactTab.tsx`) posts in base with each line's invoice-currency amount beneath it, and so does the Cancel dialog's reversal preview (`InvoiceDetailScreen.tsx` → `InvoiceReasonDialog` `glCurrency`). |

Invoices also save their currency and rate when submitted, edited or resubmitted (`CreateInvoiceScreen.tsx` `invoiceFxFields`, and the `mergeEditedInvoice` merge in `App.tsx`).

## 4. Shared currency code in the redesign

| File | What it holds |
|---|---|
| `app/currency/currencies.ts` | The Currency Library, `BASE_CURRENCY` (PKR) and lookups |
| `app/currency/rates.ts` | Mid-market history and corporate rates (the module's data), `rateOn`, `toBase`, `RateType` |
| `app/currency/money.ts` | `formatMoney`, `formatCompactMoney`, `formatRate`, `rateSentence`, `moneyPrefix`. A symbol shared by several currencies stays with one owner; the others print their code (MXN 1,200.00) |
| `app/currency/invoiceFx.ts` | `invoiceFx` (an invoice's currency, rate and provisional flag), `toInvoiceBase`, `stampRate`, `poRateFx`, `currencyForVendorName` |
| `app/currency/vendorCurrency.ts` | `vendorCurrencyOf`, the partner record's currency |
| `app/currency/glFx.ts` | The invoice journal in base at the invoice rate, balanced to the cent |
| `app/components/currency/*` | `Money`, `CurrencyChip`, `CurrencyPill`, `CurrencyFlag`, `FlagImage`, `BaseCurrencyNote`, `InvoiceCurrencyField`, `InvoiceExchangeRateField` |

Seed data, in `data/mockVendors.ts` and `data/mockInvoices.ts`:

- Each vendor gets a currency: USD, PKR, EUR, GBP, AED, CNY or SAR. Superior Industries is EUR, Acme Industries USD and Ultra Corp GBP.
- POs carry that currency and the mid-market rate on their PO date.
- Invoices follow their vendor and carry the mid-market rate on their posting date. This is applied last, so no seed sequence changes.

## 5. Running inside the shell

All of this lives in `src/embedding.ts` (with `src/EmbeddingBridge.tsx` for the router), so the rest of the source stays as the design repo ships it.

- Router `basename` comes from `src/App.tsx`. Inside the shell, `/index.html` (which the frame always loads first) renders nothing until the shell moves the frame on; opened on its own, it redirects to `/`.
- `Layout.tsx` hides the app's sidebar when embedded.
- The boot-time storage reset (`main.tsx`) spares keys the shell and other touchpoints keep on the same origin.
- Root-relative links (`/invoices/…`, `window.open('/payments-v2/…')`) resolve against the base path. Links that open a new tab go to the shell's page for them, via `__OMNE_SHELL__.urlFor` in `src/app/components/layout/TouchpointFrames.tsx`.
- The deep-link `?create=` handler (`app/App.tsx`) clears the query through the router.

The shell sidebar's **Vendor Invoices** link opens `/accounting/vendor-invoicing/invoices`. It stays lit on every page of the app (payments, prepayments, …).

## 6. Not in this step

The audit's other modules come with this app and keep the design repo's behaviour until their turn:

- **Vendor Payments** (pp. 18–21): payment currency and rate, settlement currency, realised FX gain/loss, and KPIs in base. Invoices now carry real currencies, so those screens show what the audit describes: amounts with `$`, and "settles in EUR".
- **Customer Invoicing and Customer Payments** (pp. 21+).
- **The invoice importer** (`components/invoice-import/`) gives each imported invoice the mid-market rate on its posting date (`importEngine.ts`). The file's Exchange Rate column is still validated, as before, but not used: the importer was written when USD was the company currency, and the column doesn't say which way it is quoted. Its "required when not USD" rule is unchanged. A currency the Currency Library doesn't list now blocks the row.

## 7. Updating from the design repo

```bash
git subtree pull --squash --prefix touchpoints/vendor-invoicing https://github.com/ahtisham-omne/vendor-invoicing-payments.git main
npm run touchpoints:build -- vendor-invoicing
```

Files the currency work changed (§3) can conflict with upstream changes. Keep both sides, then rebuild the copy.

## 8. Second round (14 Nov 2026): Vendor Invoicing additions and Vendor Payments

Paths are under `touchpoints/vendor-invoicing/src/app/`.

### Settings (module defaults and permissions)

| Item | Where |
|---|---|
| A gear in the top bar on Vendor Invoicing and Vendor Payments, like Customer Invoices' | `components/Layout.tsx` (`TopBar` `apSettings`) |
| The settings modal: Module Defaults (Rate Date for Vendor Invoices; Allowed Difference), Permissions (Change the Exchange Rate on an Invoice, with an optional ± limit; Change the Exchange Rate on a Payment) and the prototype's Acting Role | `components/ApSettingsModal.tsx` |
| The store, the rate-date rule and the permission checks | `hooks/useApSettings.ts` (`rateDateFor`, `apPermissionsFor`, `differenceNeedsReview`) |

### Vendor Invoicing

| # | Touchpoint | Where |
|---|---|---|
| 1 | Rate as of: the date whose rate the invoice takes, from the module default (vendor invoice date, receiving date or PO date; standalone falls back to the vendor invoice date). Saved as `Invoice.rateBasis`; every rate hover names the date (`InvoiceFx.dateLabel`) | `components/currency/InvoiceCurrencyFields.tsx` (`InvoiceRateAsOfField`), `CreateInvoiceScreen.tsx` (search "Rate as of"), `currency/invoiceFx.ts` |
| 1 | The rate field honours the permission: read-only for a role without it, and an error past the role's ± limit (blocks submit) | `InvoiceExchangeRateField` (`canEdit`, `limitPct`) |
| 2 | Receiving picker: the PO Value and Receiving Value hovers show the amount on the PO date, the receiving date and today, marking the rate invoices take | `components/currency/MoneyOnDates.tsx`, `VendorSelectionModalNested.tsx` |
| 3 | Total Due in the invoice currency with the base amount beside it, and the rate under both | `CreateInvoiceScreen.tsx` sidebar footer |
| 4 | Vendor Billed vs We're Paying, the difference, its status against the allowed difference, and the reason | `invoice-details/InvoiceDetailSidebar.tsx` (`BilledVsPaying`); seeds: `withVendorStatedTotals` in `data/mockInvoices.ts` |
| 5 | Listing Amount in the invoice currency with the base hover | unchanged from §3 |
| 8 | A prepayment's paid rate wherever it is applied: the prepaid note's hover, the create form's Prepayment applied row, the detail summary, and the prepayment step (which no longer hard-codes $). Whether that rate stays locked is still to decide, so it is shown only | `currency/paidRate.ts`, `payments/PrepaidOriginNote.tsx`, `InvoiceCreationFlow.tsx`; seeds: `withPrepaidRates` |

### Vendor Payments

| Touchpoint | Where |
|---|---|
| Payments and pay-from accounts carry currencies; three foreign settlement accounts (EUR, GBP, AED) and 1040 is USD. Seeded payments are in their vendor's currency with the rate on their payment date | `data/mockPayments.ts` (`PayFromAccount.currency`, `accountsForCurrency`, `withPaymentCurrency`) |
| The payment rate helpers: settled currency, settlement rate, exchange difference | `currency/paymentFx.ts` |
| Record a payment: Payment Currency (the vendor's or the base) and Exchange Rate (editable with the permission); the pay-from list follows the payment currency | `components/currency/PaymentCurrencyFields.tsx`, `payments/RecordPaymentFlow.tsx`, `payments/PayFromAccountModal.tsx` |
| Invoices table: Base at Invoice Rate, Base at Today's Rate, Difference | `RecordPaymentFlow.tsx` (`showFx` columns) |
| Summary: total in the payment currency, the base total, and Exchange Difference with its tooltip | `RecordPaymentFlow.tsx` footer, `components/currency/ExchangeDifference.tsx` |
| Vendor credit banner: the credit in its own currency and the rate it was paid at; each advance's rate in the apply list | `RecordPaymentFlow.tsx`, `payments/PrepaymentSourcePicker.tsx` |
| Payment page: currency chip, Exchange Rate, base amount, Booked at Invoice Rates / Paid at This Rate / Exchange Difference; Applied To and GL in their currencies | `components/PaymentDetailScreen.tsx` |
| Payment History: Amount in the payment currency with the base hover (sorts on base), Currency column and quick filter | `components/PaymentDataTable.tsx`, `components/PaymentsScreen.tsx` |
| Insights in the base currency, with the "In PKR · base currency" note | `components/PaymentInsightsPanel.tsx`, `data/readyKpis.ts`, `payments/ReadyToPayTable.tsx` |
| Payment runs: grouped by currency, a total per currency plus a base total, one payment per vendor and currency | `components/payments/run/*`, `lib/runMath.ts`, `data/paymentRuns.ts`, `data/runKpis.ts` |
| Record a payment, one currency per payment: a vendor with open invoices in two currencies pays one currency's invoices at a time (Invoice Currency switch on the Payment Type step, a note on Invoices To Pay); vendor credit applies only in that currency | `RecordPaymentFlow.tsx` (`invoiceCurrencyByVendor`, `InvoiceCurrencySwitch`, `creditInRowCurrency`) |
| Seed: Elite Suppliers Network (EUR) has two USD invoices, INV-000115 and INV-000126, so the split shows in a run and in Record Payment | `data/mockInvoices.ts` (`SECOND_CURRENCY_INVOICES`) |
| Remittance advice in the invoices' currency, check stubs and the dual-signature threshold in the bank account's currency (PDFs use the ISO code where the font has no symbol: PKR, AED) | `lib/remittanceAdvice.ts`, `lib/checkPdf.ts`, `currency/money.ts` (`formatMoneyPdf`), `payments/CheckPrintFlow.tsx` |

#### Payment runs in detail

- A run's payment is keyed by vendor and currency (`runGroupKey`, `"<vendor>::<CUR>"`). Lines take their invoice's currency. Methods, holds and the bank-changed and first-payment checks stay per vendor.
- Setup: Group By Currency, a Currency column and filter. Amount Due hovers the invoice rate; sorting and the amount filter work in base. The footer shows each currency's total, then ≈ base (past three currencies, base only, with the breakdown on hover).
- Proposal: each card carries its currency chip, plus "Split by Currency" when the vendor is paid twice. A rule line appears when the run has more than one currency. Pay-from pickers offer accounts in the payment's currency or base, and credit draws only in the payment's currency.
- Execute, the run's page and the Runs tab total in per-currency plus base. GL previews are in base. Payments created by a run are stamped with the payment-date rate.
- Rates: Setup converts each invoice at its own rate; the proposal onward uses the payment-date rate. No exchange gain or loss line is posted from a run yet.
- The base-currency (PKR) pay-from balances are sized in PKR (about 280× the old figures), so foreign payments converted to base no longer read as overdrawn.

Rates after the last sync (10 Apr 2026) are the last synced rate, so an invoice posted after it has today's rate and pays with no exchange difference; older invoices, or a changed payment rate, show one.

## 9. Third round (18 Nov 2026): base by default, the toggle and configuration, FX Variance at invoice

Vendor Invoicing now works like Purchase Orders, Sales Orders and Quotes: every amount is shown in the base currency (PKR) by default, with the invoice's own currency on hover. A Base Currency | Vendor Currency toggle and a Currency Configuration dialog sit on the invoice and the create screen. An invoice for received goods posts the rate difference since receiving to FX Variance. Vendor Payments is the next step (§9.6).

Paths are under `touchpoints/vendor-invoicing/src/app/`.

### 9.1 Shared currency pieces

These are generic, so a payment page can use them the same way.

| File | What it holds |
|---|---|
| `components/currency/Money.tsx` | `Money` (the vendor's currency, base on hover) and, new, `BaseMoney` and `BaseMoneyCard`: the base amount, with a hover that reads "Pakistani Rupee (PKR) · base currency", "In PKR", the vendor's amount, then the rate, rate type and date |
| `components/currency/docCurrencyContext.ts` | Ported from Purchase Orders. `DocView` (`'base' \| 'document'`), `DocCurrencyContext`, `docInBase`, `useDocView` (`viewCurrency`, `toView`, `fromView`, `decimals`), `useDocMoney`, `useDocOtherText`. `docViewOf` is the plain-function form for a component that renders the provider itself |
| `components/currency/DocCurrency.tsx` | `DocCurrencyProvider` and `DocMoney`: `BaseMoney` in base view, `Money` in the vendor's |
| `components/currency/docView.ts` | The view per document, kept for the session and never an edit: `useDocViewOf(key)` and `setDocView(key, view)`. The keys in use are `invoice:<id>` and `invoice-form:<id or new>`. A payment page would use `payment:<id>` |
| `components/currency/CurrencyHeaderControls.tsx` | The toggle, with an ⓘ on each side, shown only when the document isn't in base, and the Currency button. `what` sets the tooltip noun ("invoice", "payment") |
| `components/currency/InvoiceCurrencyConfig.tsx` | `InvoiceCurrencySummary` (the CURRENCY card) and `InvoiceCurrencyConfigDialog` (§9.3), plus `RateTypeChip` |
| `currency/fxVariance.ts` | The FX Variance at invoice (§9.4): `receivingRateOn`, `fxVarianceOf`, `receiptValuesForLine`, `invoiceFxInputs`, `invoiceFxVariance`, and the description helpers |
| `currency/glFx.ts` | `postInvoiceGl`: the invoice journal in base, valued from the receiving side. `baseGlEntries` keeps each line's own description. `glInBase` is unchanged |
| `currency/money.ts` | `rateSentence` now writes rates the Currencies way, "1 GBP = ₨354.2500 PKR". This changes every rate hover in the module |

### 9.2 Base by default, invoice currency on hover

| Surface | Where |
|---|---|
| Listing: the "In PKR · base currency" pill next to Refresh is gone. The KPI cards were already in base | `components/InvoiceListScreen.tsx` (Performance Insights row) |
| Listing: Amount, Amount Due and the Discount pill are in base at each invoice's rate, with its own currency on hover. Sorting, range filters and search use base, and search also matches the invoice-currency figure. The card view's Amount and "due" are in base too | `components/InvoiceDataTable.tsx`, `InvoiceListScreen.tsx` (card view) |
| Vendor hover card: Outstanding and Paid are in base at today's rate, with the vendor's currency on hover | `InvoiceDataTable.tsx` (`VendorStatMoney`) |
| Quick view panel (retired, not rendered): base text | `components/InvoiceQuickViewPanel.tsx` |
| Invoice page: lines, the Invoice Summary (hero, "≈ other currency", Paid, Outstanding, breakdown, Invoice Total, prepayment, Amount Due After) and Billed vs Paying follow the page view | `components/InvoiceDetailScreen.tsx` (`DocCurrencyProvider`), `invoice-details/InvoiceDetailSidebar.tsx`, `invoice-details/LineItemsTab.tsx` |
| Invoice page GL Impact: always in base, since the ledger is kept in base. Each line's invoice-currency amount sits under it, and the received-goods lines carry descriptions | `invoice-details/GLImpactTab.tsx` |
| Create screen: line prices, line totals, standalone amounts, charges, freight, breakdown and Total Due follow the view. Prices and amounts are typed in the shown currency. A value typed in base converts at the invoice rate and is rounded to the invoice currency's minor unit; an input left untouched keeps its stored value | `components/CreateInvoiceScreen.tsx` (search "Which currency the form shows") |
| PO / receiving picker: PO amounts are at the PO's rate, a receiving's value at its receiving date's rate (what it booked), and a prepayment at the rate it was paid. The `MoneyOnDates` face is now in base, and the hover is unchanged | `components/VendorSelectionModalNested.tsx` (`PoMoney`, `prepaidText`), `components/currency/MoneyOnDates.tsx` (`face`, `baseDay`) |
| Prepayment step: stays in the vendor's currency, because the invoice has no rate yet. Each prepayment also shows its base value at the rate it was paid | `components/InvoiceCreationFlow.tsx` |

In base view, the summary's prepayment line reads at the invoice rate like the rest of the summary, so the figures add up. Its locked base value appears under it ("₨1,724,774.00 at that rate"). The GL is where the prepayment clears at that value.

A customer invoice opened in the shared create screen (`ledger === 'ar'`) stays in its own currency and has no toggle or Currency card.

### 9.3 Toggle, Currency button, currency card, configuration dialog

| Item | Where |
|---|---|
| Invoice page: toggle and Currency button before the Actions menu | `InvoiceDetailScreen.tsx` header (`CurrencyHeaderControls`) |
| Invoice page: CURRENCY card at the bottom of Invoice Summary, showing Vendor bills, Prepaid, Rest to A/P / Posts to A/P, Rate with its date, Received at, FX Variance with a Gain/Loss tag, a Locked chip once posted, and View configuration | `InvoiceDetailSidebar.tsx` (`InvoiceCurrencySummary`) |
| Invoice page: Currency Configuration, read-only (Locked). A saved invoice's currency and rate change only through Edit Invoice, which the dialog offers while the invoice is Pending Approval | `InvoiceDetailScreen.tsx` (end of the page) |
| Create screen: toggle and Currency button in the header, before Full View | `CreateInvoiceScreen.tsx` header |
| Create screen: a Currency section in the right-hand sidebar (before GL Impact) holding the same card, open by default for a foreign invoice | `CreateInvoiceScreen.tsx` (`AccordionItem value="currency"`) |
| Create screen: Currency Configuration, editable. Save configuration writes back to the form | `CreateInvoiceScreen.tsx` (end of the portal) |

The dialog, modelled on `POCurrencyConfigDialog`, has these parts:

- **Vendor bills**: the total with the currency picker. The currency is locked when it comes from the PO. Otherwise it can be changed, as on the form: the amounts are read in the new currency and nothing converts.
- **Rate as of**: read-only, from the module default.
- **Exchange rate**: the form's own `InvoiceExchangeRateField`, so the permission rules are the same. Mid-market is read-only. Corporate is editable only for a role with the permission, with a reset, an error past the ± limit, and the "vs PO" chip. Then the invoice-rate card.
- **Received and prepaid**: one card per prepayment (locked when paid) and per receiving (its date's rate), then the FX Variance at invoice with the sentence behind it.
- **You pay**: what A/P is booked at in PKR, the rest after any prepayment. It is shown, not chosen, because the payment currency is picked on the payment, so a settlement picker doesn't fit this module.
- **Notes and buttons**: the amber "rate is locked" note, then Reset to default, Cancel and Save configuration. Save is disabled while the rate is missing or past the limit.

Since 20 Nov (§11) the create screen has no inline Currency, Exchange Rate or Rate as of fields; they are in this dialog only.

### 9.4 FX Variance and Purchase Price Variance at invoice

Accounts added in `data/glAccounts.ts`:

- `5210 Purchase Price Variance` (`PRICE_VARIANCE_ACCOUNT`)
- `5215 FX Variance` (`FX_VARIANCE_ACCOUNT`)

The constant `AP_ACCRUAL_ACCOUNT` names the `2100 AP Accrual` account that was already used. `1205 Advance Payments` (`ADVANCES_ACCOUNT`) already existed.

How each value is worked out:

- **Receiving**: books the goods at the receiving day's rate, using the module's default type (mid-market) through `receivingRateOn`. Each receiving behind a line keeps its own date: `LineItem.receipts` on the form and `SavedInvoiceLineItem.receipts` (with the rate) on the record. The part a prepayment covers is booked at that prepayment's locked rate instead, and each prepayment keeps its own rate.
- **Rate difference**: `fxVarianceOf` spreads the prepaid amount over the goods first. On the unpaid rest it compares the receiving value (each receiving at its rate) with the same amount at the invoice rate. `amount = rest at receiving − rest at invoice`. A positive amount is a gain: you owe less, so FX Variance is credited. A negative amount is a loss and debits it.
- **Price difference**: `accrualSplit` works out `priceVarianceAmount = quantity × (invoice price − PO price)`, and `buildInvoiceGl` posts it to Purchase Price Variance at the invoice rate. This replaces the earlier Inventory correction, so stock keeps its receiving value. Quantity billed past the receipt still goes to 5205. Only a line with no receiving left on it still corrects Inventory.
- **Prepayments**: an applied prepayment now credits Advance Payments, and A/P is credited with the unpaid rest only (`InvoiceGlInput.prepaymentApplied`). This matches the invoice's `outstandingBalance`. A prepayment that covers the whole invoice leaves no A/P line and no FX Variance. A prepayment larger than the goods value covers the charges at its locked rate as well.

`postInvoiceGl` produces:

- Dr AP Accrual at what receiving booked
- Cr Advance Payments at the locked rate(s)
- Cr Accounts Payable for the rest, at the invoice rate
- Dr or Cr FX Variance, with the description "Received Oct 05, 2025 at 1 GBP = ₨344.1448 PKR · invoiced Oct 16, 2025 at 1 GBP = ₨340.6802 PKR"
- PPV, quantity variance, freight and charges at the invoice rate

Cent rounding goes onto the FX Variance line.

The create screen builds one journal (`formGl`, through `inventoryGlInput` / `standaloneGlInput` and `postGl`) for the sidebar preview, the submit confirmation and every saved snapshot, including a split's receiving child. As part of that, the saved inventory snapshot now uses the freight account picked on the form, not the default, and the preview includes seeded tax, so preview and snapshot match. An edited invoice keeps its applied prepayments and reopens on its saved receiving date (`App.tsx`).

Where the variance shows:

- The create screen's GL Impact preview and the submit confirmation, with descriptions under the FX Variance and Advance Payments lines
- The invoice page's GL Impact tab
- The CURRENCY card and the dialog on both screens

Seeds created before this round have no receivings on their lines, so they show no variance.

### 9.5 Seeded examples

Ultra Corp bills in GBP. Each example is £10,000.00 of goods (1,000 bearings at £10.00), received on Oct 5 and invoiced on Oct 16. The module's mid-market history ends at the last sync (10 Apr 2026), and every later day takes that one rate (355.4200), so October 2026 would show no difference. The examples are therefore dated October 2025 and use the module's own rates for those days:

- Oct 02, 2025: ₨344.9548 (the prepayment)
- Oct 05, 2025: ₨344.1448 (receiving)
- Oct 16, 2025: ₨340.6802 (the invoice)

GBP weakened, so both examples show a gain.

| Invoice | Case | Journal (PKR) |
|---|---|---|
| INV-000217 (`inv-fx-variance-receiving`) | No prepayment | Dr AP Accrual 3,441,448.00 · Cr Accounts Payable 3,406,802.00 · Cr FX Variance 34,646.00 |
| INV-000218 (`inv-fx-variance-prepaid`) | PRE-000003 (£5,000.00 paid Oct 2 at ₨344.9548) applied | Dr AP Accrual 3,445,498.00 (₨1,724,774.00 prepaid half + ₨1,720,724.00 rest) · Cr Advance Payments 1,724,774.00 · Cr Accounts Payable 1,703,401.00 · Cr FX Variance 17,323.00 |
| PRE-000003 (`inv-fx-variance-pre`) | The prepayment, Settled, reconciled into INV-000218 | — |

Both invoices are Approved and unpaid: INV-000217 owes £10,000.00 and INV-000218 owes £5,000.00 at ₨340.6802. Both are overdue, because they are a year old. They are added after the seed pipeline in `data/mockInvoices.ts` (`generateFxVarianceDemo`), and new invoice numbers now start at INV-000219. `currency/__tests__/fxVariance.test.ts` checks these figures, the full-prepayment case and the price-difference split.

### 9.6 Left for Vendor Payments

- The invoice keeps what a payment needs: `exchangeRate`, `rateDate` and `rateType` (the invoice rate), `outstandingBalance` (the unpaid rest, in the invoice currency), and `appliedPrepayments` (each with its locked rate). Rule 7 belongs to payments: the payment-day difference on the rest posts to FX Gain/Loss. `currency/paymentFx.ts` already compares against `invoiceFx(inv).rate`, so INV-000217 and INV-000218 will show it when paid at today's rate.
- The payments "In PKR · base currency" pills are still there:
  - `components/PaymentsScreen.tsx` (Payment History insights, `<BaseCurrencyNote what="payment" …>`)
  - `components/payments/ReadyToPayTable.tsx` (Invoices to pay)
  - `components/payments/run/RunsTab.tsx`
- To reuse:
  - `BaseMoney` / `DocMoney`
  - `DocCurrencyProvider` with `useDocViewOf('payment:<id>')`
  - `CurrencyHeaderControls` with `what="payment"`
  - the `InvoiceCurrencyConfig` building blocks (`RateTypeChip`, the card and the dialog layout)
  - `fxVariance.gainLossOf`

## 10. Fourth round (18 Nov 2026): Vendor Payments, paying an invoice in another currency

Vendor Payments now follows the Vendor Invoicing pointers (§9): amounts in the base currency (PKR) by default with the invoice's currency on hover, no "In PKR · base currency" pills, a Base Currency | Vendor Currency toggle and a Currency Configuration dialog. It also keeps the user's ten rules for paying an invoice in another currency. The user wrote them with a dollar base; here the base is PKR, so "dollars" read as rupees: "This account is in EUR. Pick a GBP or PKR account." and "Bank converts ₨3,503,000.00 → £10,000.00 · 1 GBP = ₨350.3000 PKR".

Paths are under `touchpoints/vendor-invoicing/src/app/`.

### 10.1 The ten rules and where they are kept

| # | Rule | Where |
|---|---|---|
| 1 | What you owe stays in the invoice's currency; a payment reduces the pound balance | Invoice balances are never converted. Record Payment's Amount Due reads in the invoice's currency with PKR on hover (`payments/RecordPaymentFlow.tsx`, Invoices To Pay). A payment's `amount` is always in the invoices' currency (`data/mockPayments.ts`) |
| 2 | The vendor always receives the invoice's currency; "Vendor receives" is fixed | `components/currency/PaymentCurrencyFields.tsx` (`VendorReceivesField`, locked); the dialog's Vendor receives section (`components/currency/PaymentCurrencyConfig.tsx`) |
| 3 | Only an account in the invoice's currency or in base can pay | `currency/paymentRules.ts` (`payFromCurrencies`, `canPayFrom`); `accountsForCurrency` in `data/mockPayments.ts` now applies it |
| 4 | Other accounts are listed greyed with "This account is in EUR. Pick a GBP or PKR account." | `payFromBlockReason`; `payments/PayFromAccountModal.tsx` (`invoiceCurrency` prop), the dialog's Pay from list, and the run Execute stage's account select (disabled options) |
| 5 | The PO's "You pay in" picks the default account; the user can switch | `VendorPO.youPayIn` (`data/mockVendors.ts`) → `Invoice.youPayIn` (`data/mockInvoices.ts`, copied on create in `CreateInvoiceScreen.tsx` `invoiceFxFields`) → `youPayInOf`, `defaultPayFromCurrency`; Record Payment's `deriveAccountId` and `onMethodApply(id, fromDefault)`; runs' `accountForMethod` / `vendorPayDefaults` (`data/paymentRuns.ts`) |
| 6 | From an account in the invoice's currency: one amount, nothing converts | Record Payment shows Vendor Receives only, with "Paid £6,000.00 from 1060 · GBP Settlement. Nothing converts." (`BankConversionLine`) |
| 7 | From a base account: the pounds the vendor gets and the rupees the bank took; the rate is worked out and shown | `BankTookField` and the read-only Exchange Rate beside it, `BankConversionLine`; `derivedRate`, `bankConversionText`. Saved as `Payment.bankAmount`, with `exchangeRate` = bank ÷ pounds |
| 8 | No third currency; ask the vendor for a new invoice (or a credit note and a new invoice) | The Payment Currency switch and the typed Exchange Rate are gone. `OTHER_CURRENCY_NOTE` sits in the Vendor Receives tooltip and the dialog |
| 9 | A run keeps these per invoice and totals per currency | §10.6 |
| 10 | The remittance advice is in pounds | `lib/remittanceAdvice.ts`: every amount in the invoices' currency, a "Currency: GBP, as invoiced" row and "All amounts are in GBP, the currency of your invoices and what you receive." No base amounts or bank conversion appear on it |

### 10.2 Shared pieces, new and changed

| File | What it holds |
|---|---|
| `currency/paymentRules.ts` (new) | The rules: `payFromCurrencies`, `canPayFrom`, `payFromBlockReason`, `payFromOptions`, `defaultPayFromCurrency`, `youPayInOf(All)`, `convertsAtBank`, `derivedRate`, `bankConversionText`, `bankRateNeedsReview`, `paymentRateOf`, `costInBase`, `realizedFxOf`, `buildPaymentGlFx` (the payment journal, §10.7), `realizedFxFromGl`, `glAtRate` (a journal posted at one rate, moved here from `lib/runMath.ts`), `OTHER_CURRENCY_NOTE` |
| `currency/paymentLedger.ts` (new) | `paymentLedger(payment, invoices)`: a saved payment in the base ledger (its journal, account, bank and day rates, cost, A/P carried, FX Gain/Loss read off the journal). `configAccounts` lists the dialog's accounts |
| `components/currency/PaymentCurrencyFields.tsx` (rewritten) | `VendorReceivesField`, `BankTookField`, `BankConversionLine` (replace `PaymentCurrencyField` and `PaymentRateField`) |
| `components/currency/PaymentCurrencyConfig.tsx` (new) | `PaymentCurrencySummary` (the CURRENCY card) and `PaymentCurrencyConfigDialog` (§10.4) |
| `components/currency/docView.ts` | `useDocViewOf(key, fallback)` / `setDocView(key, view, fallback)`: a screen can default to the document's currency. Keys `payment:<id>` and `payment-form:new` |
| `components/currency/InvoiceCurrencyConfig.tsx` | Exports its building blocks (`Section`, `AmountRow`, `LockedCurrency`, `RateCard`, `GainLossTag`, `signedBase`, `baseRate`). The "You pay" note now says the vendor is paid in the invoice's currency from a GBP or PKR account |
| `currency/paymentFx.ts` | `settlementRateOf` and `paymentFx` read the bank's figures ("Worked out from the bank's figures") |
| `data/glAccounts.ts` | `7150 Realized FX Gain/Loss` (`FX_GAIN_LOSS_ACCOUNT`), apart from `5215 FX Variance` |
| `data/mockPayments.ts` | `Payment.bankAmount`; `settledCurrency` retired (still read by `settledCurrencyOf`); `PaymentGlEntry` carries `currency`, `foreignAmount`, `rate`; `defaultPayFromAccount` |

### 10.3 Base by default

| Surface | Where |
|---|---|
| Payment History: the pill is gone; Amount is in PKR at each payment's rate, the invoices' currency on hover; sort, range filter (also the Filters modal's amount) and search use PKR, search also matches the invoice-currency figure; the card view too | `components/PaymentsScreen.tsx`, `components/PaymentDataTable.tsx` |
| Ready to Pay: the pill is gone (the table already used the invoice listing's base columns); the bulk bar's total is in PKR; the amount filter prefix is ₨ | `payments/ReadyToPayTable.tsx` |
| Payment runs tab: the pill is gone; run totals were already PKR with each currency on hover | `payments/run/RunsTab.tsx` |
| Run page: the Payments table's amounts in PKR, the invoices' currency on hover | `payments/run/RunDetailScreen.tsx` |
| Payment page: everything follows the page view (§10.5) | `components/PaymentDetailScreen.tsx` |

Record Payment is the exception (the user's payment-screen spec): it opens in the invoices' currency, because what is owed stays in it. Amount Due and every input stay in that currency. The header toggle flips the totals (the Invoices To Pay header's Total Payment and the sidebar summary) to PKR at this payment's rate. The GL preview is always in PKR.

### 10.4 Record Payment

- **Payment Details**, after the vendor is chosen, for a foreign invoice:
  - Vendor Receives (locked: flag, code and the amount) beside Pay From (opens the picker).
  - From a PKR account, Bank Took (PKR) beside a read-only Exchange Rate.
  - The bank line: "Bank converts ₨3,503,000.00 → £10,000.00 · 1 GBP = ₨350.3000 PKR", with how far it is from the payment date's mid-market rate.
  - A PKR invoice shows none of this.
- **Bank Took** starts at the payment date's mid-market estimate. Entering the bank's figure sets the rate, and a reset button returns to the estimate.
- **Invoices To Pay**: Amount Due is in the invoice's currency with PKR on hover. The FX columns are now A/P Carried, Paid in PKR and FX Gain/Loss.
- **Sidebar**: the Payment card gains the CURRENCY summary: Vendor receives, Pay from, Bank took, bank rate against mid-market, A/P carried, FX Gain/Loss and View configuration. The summary footer reads Vendor Receives, then Bank Took (or In PKR), then FX Gain/Loss.
- **Header**: the toggle and the Currency button sit before Full View.
- **Currency Configuration** (editable) has these parts:
  - Vendor receives: fixed, with the reason and the note.
  - Pay from: the account in each allowed currency, then one greyed account per other currency, with the reason. The account the PO's You pay in asks for is marked.
  - Amounts: one, or two with Bank took editable.
  - Rate: the bank conversion card and the payment date's mid-market rate card.
  - FX Gain/Loss at payment: A/P carried, credit, what paying cost, and the realized gain or loss.
  - Save writes the account and the bank's figure back to the form.
- **Pay-from pickers**: every one lists all accounts and greys those that can't pay. That covers the single picker, the per-vendor picker and the bulk picker.
- **Saving**: the payment saves `currency` (the invoices'), `amount` (what the vendor gets), `bankAmount` and `exchangeRate` (the bank's), and the journal from §10.7. A prepayment from a PKR account saves its share of the bank's figure and is booked at what it cost, so it has no FX Gain/Loss.

### 10.5 Payment page

- **Header**: the toggle (key `payment:<id>`) and the Currency button sit before Full Screen.
- **Amounts**: the Payment Summary hero, Applied/Unapplied and the Applied To amounts follow the view. In base they read at the payment's rate.
- **Payment Summary**: ends with the CURRENCY card, Locked once posted.
- **Payment Details**: the Exchange Rate reads "Bank conversion · from the bank's figures" or "Mid-market", with the date.
- **GL Impact**: in PKR, each line with its GBP amount beneath, and the FX line describing both rates and dates. A seed without a saved journal gets one built by the same rule.
- **Currency Configuration**: read-only (Locked).
- **Reversal dialog**: a journal saved in base reverses in base (`invoice-details/ReversePaymentModal.tsx`).

### 10.6 Payment runs

| Item | Where |
|---|---|
| Lines carry `invoiceRate`, `invoiceRateDate` and `youPayIn` from their invoice (`lineFxOf`) | `data/paymentRuns.ts`, `payments/run/RunSetupStage.tsx`, `hooks/usePaymentRuns.ts` |
| A payment's default account follows its invoices' You pay in (`groupYouPayIn`), else base | `lib/runMath.ts` (`deriveGroups`, `projectedAccountTotals`), `RunProposalStage.tsx` (method change, move, reset) |
| Proposal: the pay-from picker greys other currencies with the reason; each card shows the bank line (estimated) or "Nothing converts" | `RunProposalStage.tsx` |
| Execute: the account select lists other currencies disabled with the reason. A Bank Took (PKR) column holds each PKR-account payment's bank figure, estimated until entered, with the rate it makes. A rate past the allowed difference is flagged, and refused for a role without the permission | `RunExecuteStage.tsx` (`setGroupBankAmount`), `RunVendorGroup.bankAmount` |
| Recorded payments carry `bankAmount` and the bank's `exchangeRate` and post with FX Gain/Loss (a group paying pre-invoices is booked at what it cost) | `lib/runMath.ts` (`buildRunExecution`, which now takes the invoices) |
| The run's GL preview posts A/P at the invoice rates, the bank at its cost, and a Realized FX Gain/Loss row | `runGlRows` |
| Totals per currency, then ≈ PKR, are unchanged | `payments/run/runMoney.tsx` |

### 10.7 The payment journal and FX Gain/Loss

`buildPaymentGlFx` posts, in PKR:

- Dr Accounts Payable: each invoice's settled amount at its own rate (what A/P carried).
- Cr Vendor Prepayments: credit drawn, at the rate each advance was paid.
- Cr the bank: what the cash cost. From a PKR account that is the bank's figure; from an account in the invoice's currency it is the amount at the payment date's mid-market rate (nothing converts, but the ledger is kept in PKR).
- The rest goes to 7150 Realized FX Gain/Loss: a credit when paying cost less (a gain), a debit when it cost more (a loss). The description names both rates and dates, for example "Invoice rate 1 GBP = ₨340.6802 PKR (Oct 16, 2025) · paid at 1 GBP = ₨350.3000 PKR (Oct 24, 2025, bank conversion)".

Each line keeps its GBP amount and rate. A PKR invoice converts nothing and posts no FX line. Applied prepayments were settled at invoice time (§9.4), so they are not revalued here.

### 10.8 Permissions and the allowed difference

The rate is no longer typed, so "Change the Exchange Rate on a Payment" now governs the bank's figures:

- The bank's rate is compared with the payment date's mid-market rate, using the module's Allowed Difference percentage (Settings, Module Defaults, 1% by default).
- Past it, a role with the permission gets an amber "needs review" and can still record.
- A role without the permission gets a red error, and Record (or a run's Execute) is refused.
- An estimate that hasn't been edited is never flagged.
- The settings modal and `useApSettings` say this now.

### 10.9 Seeded examples

All are Ultra Corp (GBP). The bearings were invoiced Oct 16, 2025 at 1 GBP = ₨340.6802 PKR.

| Record | Case | Figures |
|---|---|---|
| INV-000217 (`inv-fx-variance-receiving`) | Open, £10,000.00, PO 9101 You pay in PKR | Record Payment starts from a PKR account (1010 · JPMorgan Operating: Ultra Corp's primary method is Wire · Wells Fargo, and no PKR account is at Wells Fargo). Enter ₨3,503,000.00: Bank converts ₨3,503,000.00 → £10,000.00 · 1 GBP = ₨350.3000 PKR, 1.44% under today's ₨355.4200, so it needs review. Loss ₨96,198.00 |
| INV-000218 (`inv-fx-variance-prepaid`) | Open, £5,000.00 rest, PO 9102 You pay in GBP | Record Payment starts from 1060 · GBP Settlement, with one amount |
| INV-000219 (`inv-fx-paid-base`) + PMT-000121 (`pmt-fx-demo-121`) | Paid Oct 24, 2025 from 1020 · Corporate Checking (PKR) by Wire | The bank took ₨3,503,000.00 for £10,000.00, so ₨350.3000 (mid-market that day ₨349.2371, +0.30%). Dr 2110 AP Trade 3,406,802.00 · Dr 7150 Realized FX Gain/Loss 96,198.00 · Cr 1020 Corporate Checking 3,503,000.00 |
| INV-000220 (`inv-fx-paid-gbp`) + PMT-000122 (`pmt-fx-demo-122`) | £6,000.00, PO 9104 You pay in GBP, paid Nov 24, 2025 from 1060 · GBP Settlement | Nothing converts; valued at that day's ₨337.9177. Dr 2110 AP Trade 2,044,081.20 · Cr 1060 GBP Settlement 2,027,506.20 · Cr 7150 Realized FX Gain/Loss 16,575.00 |
| PO 11091 (Ultra Corp, registry) | You pay in GBP | An invoice created from it carries `youPayIn: 'GBP'`. Every other PO pays in base |

New invoice numbers now start at INV-000221. The paid examples stay out of the seeded payments' invoice pool, so no seed sequence changes. Seeded payments from a PKR account for a foreign vendor get a `bankAmount` at the payment date's mid-market rate (no spread), since the seeds have no bank statement.

`currency/__tests__/paymentRules.test.ts` checks the allowed accounts and the reason, the You pay in default, the worked-out rate and the bank line, the review threshold, the journals and their FX Gain/Loss (bank, GBP account, vendor credit, PKR), both seeded payments, and a run's payments and GL preview.

### 10.10 Open points

- Rates read "1 GBP = ₨350.3000 PKR" (`rateSentence`, the Currencies way). The user's example has no trailing code.
- A payment from an account in the invoice's currency still posts a gain or loss, because the ledger values the pounds at the payment date's mid-market rate. Whether a GBP account should carry its own historical rate is for finance.
- Bank Took starts as an estimate, and recording with the estimate is allowed (a scheduled payment has no bank figure yet).
- In runs, vendor credit is valued at the payment's rate, because a draw doesn't carry its advance's rate.
- Run Proposal and Execute amounts stay in the invoices' currency, since they are what the vendor gets. Only the run's display tables and totals moved to base.
- Customer payments share the payment listing, so they read in base too.

## 11. Fifth round (20 Nov 2026): a light create screen, Currency Configuration as the one place

Mahreen's Vendor Invoices changes.

| # | What | Where |
|---|---|---|
| 1 | Prepayment popup in PKR: the prepayment at the rate it was paid at; Selected Receivings and Due on This Invoice at today's rate, the rate a new invoice starts on. The paid-rate line stays. | `InvoiceCreationFlow.tsx` (`todayRateFor`, `prepaidInBase`) |
| 2 | Create screen in PKR only: no Base Currency / Vendor Currency toggle, the Currency button reads "Currency · AED" (red when the rate needs attention), Total Due shows the PKR amount only. The sidebar's Currency card is gone from the create screen; the invoice page keeps it. | `CreateInvoiceScreen.tsx` (`formView` is always `'base'` for A/P), `CurrencyHeaderControls.tsx` (`toggle`, `showCode`, `alert`) |
| 3 | No "Posts to A/P in PKR" box under A/P Account. | `CreateInvoiceScreen.tsx` |
| 4 | Currency, Exchange Rate and Rate as of leave Invoice Details. A missing or over-limit rate blocks submit, marks the Currency button and opens Currency Configuration. The currency isn't locked to the PO's: changing it converts every PO price (to four places), charge, freight and standalone line at the rate day's mid-market cross rate (`convertCurrency`); receivings and prepayments are read in the new currency at the base values they were booked at (`poToInvoice`), and a prepayment remembers what it was paid in (`LockedPrepayment.paid`). | `CreateInvoiceScreen.tsx`, `currency/fxVariance.ts` |
| 5 | Currency Configuration in her layout: "Applies to INV-000221 only. The vendor's default currency (AED) doesn't change."; Vendor invoices with a currency picker ("Defaults to the currency on PO-1003. Change it if the vendor invoiced in another currency."); Exchange rate with the Mid-market / Corporate switch and a card ("Mid-market · Open Exchange Rates", "1 AED = 75.8400 PKR · 1 PKR = 0.013186 AED", "Rate on …, the vendor invoice date · +10.33% vs PO"; a corporate rate reads "Corporate · Set by Ahtisham Ahmad · In effect since …"); Prepayment ("PRE-000002 −د.إ33,480.00 = −Rs2,539,123.20", paid at, deducted at that rate); You pay; FX difference at invoice; the amber note on when the rate locks. "Received and prepaid" and the Rate as of section are gone. The Locked tag shows only once the invoice has posted. A changed currency is previewed converted before it's saved. | `components/currency/InvoiceCurrencyConfig.tsx` (`InvoiceCurrencyConfigDialog`; `RateTypeToggle` and `PoRateCompare` now exported from `InvoiceCurrencyFields.tsx`) |

The invoice summary card's corporate tooltip names who set the rate too, instead of "Finance's corporate rate".

## 12. Sixth round (20 Nov 2026): invoice detail, and Vendor Payments light

Mahreen's changes to the invoice detail page and Vendor Payments.

| # | What | Where |
|---|---|---|
| A | The header toggle reads Base Currency / **Invoice Currency** (invoices and payments). Tooltip: "Show every amount in this invoice's currency (GBP). The PKR amount is on hover." (on a payment, "the invoices' currency"). | `components/currency/CurrencyHeaderControls.tsx` |
| B | The invoice page's Currency button opens the same Currency Configuration as Create Vendor Invoice (§11), read-only, Locked only once the invoice has posted. A Pending Approval invoice changes it through Edit Invoice. | `InvoiceDetailScreen.tsx`, `InvoiceCurrencyConfig.tsx` |
| 1 | Record Payment, Select Vendor and Payment Type steps: vendor credit, outstanding and invoice balances in PKR; credit at the rate it was paid at, balances at each invoice's rate (what A/P carries). "settling in GBP" stays. | `payments/RecordPaymentFlow.tsx` (`creditBaseOf`, `prepayAvailableBaseFor`, `dueBaseOf`, `fmtBase`) |
| 2 | The vendor credit popup and the credit picker's question: the credit in PKR at its paid rate, with "Paid at 1 GBP = Rs355.4200 PKR" under it. | `RecordPaymentFlow.tsx`, `payments/PrepaymentSourcePicker.tsx` |
| 3 | Record Payment (the payments-v2 layout) in PKR only: no toggle, "Currency · GBP" (red when the bank's rate is blocked); Total Payment, Terms, the vendor credit bar (and its draw chip) and Remaining Balance to Pay in PKR. Vendor Receives, Exchange Rate and the right panel's Currency card are gone from the screen; Bank Took (PKR) stays beside Pay From when the bank converts. | `RecordPaymentFlow.tsx` (`formView` is always `'base'`) |
| 4 | Payment detail: "Invoice Currency", as A. | `PaymentDetailScreen.tsx` via `CurrencyHeaderControls` |
| 5 | Payment Currency Configuration: "Applies to this payment only. The vendor is paid in the invoice's currency (GBP)."; Vendor receives with Bank took (PKR) beside it (no separate Vendor gets); a Vendor credit card per credit applied ("−£10,000.00 = −Rs3,554,200.00 · Paid at 1 GBP = Rs355.4200 PKR. It's applied at that rate."); "PKR is the default, from the PO."; "Bank's rate · worked out from the two amounts"; "FX difference at payment" reading FX Gain or FX Loss (separate accounts); "Paid from a GBP account, so the vendor gets exactly what you pay."; the last line "The vendor always receives the invoice's currency, whichever account pays. The rate and the FX Gain or FX Loss lock when the payment posts." | `components/currency/PaymentCurrencyConfig.tsx` |

"FX Gain/Loss" is gone from the payment screens' copy elsewhere too (the invoice table column, tooltips, the payment page's GL note): a gain posts to FX Gain, a loss to FX Loss.

