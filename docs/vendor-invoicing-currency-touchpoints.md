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
