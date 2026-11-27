# The currency patterns, one by one

Each pattern: what it is, where it goes, its copy, and the code. Import
everything from the kit's index (`@/app/currency-kit`, or the relative path
to `src/app/currency-kit`). The rule numbers (R1…) are in `rules.md`.

## Contents

1. Setting up: the base currency and seed data
2. A record's or document's rate
3. Money: the four faces
4. The currency tag and the Currency column
5. Listings: "Show values as"
6. Vendor invoice amounts: own currency and a "≈" base column
7. KPIs and a record's overview
8. Detail pages: the switch in the line items toolbar
9. Typing amounts on a document
10. The Currency information block
11. The Currency configuration dialog
12. Paying from an account
13. Print and download
14. Mark as paid: the bank's rate
15. Version and date prompts
16. What not to build

---

## 1. Setting up: the base currency and seed data

The base currency is per company (R1). The kit defaults to the demo company's
PKR; call `setBaseCurrency` once at start-up only if the module's demo
company has another base. Never write "PKR", "Rs" or "₨" in the module.

```tsx
// main.tsx, only if the demo company's base isn't PKR
import { setBaseCurrency } from '@/app/currency-kit';
setBaseCurrency(companySetup.baseCurrency);
```

Seed data: a record in the base currency leaves its currency empty (`null`
or `''`), which the kit reads as base; a foreign one names its ISO code. Seed
USD first where you add new demo data (25 Nov 2026), and make totals agree
with lines (P7).

```ts
const VENDORS = [
  { name: 'Rivian Automotive', currency: 'USD' },
  { name: 'Karachi Fasteners', currency: null }, // base
];
```

## 2. A record's or document's rate

Every foreign amount carries its record's rate (R2), as a `MoneyFx`. Build it
with `documentFx`, naming the rate day the BA's document gives (R14). It
returns `null` for a base-currency record.

```ts
import { documentFx } from '@/app/currency-kit';

const fx = documentFx({
  currency: po.currency,          // the document's currency
  rateType: po.rateType,          // 'mid' unless the document says corporate
  rateDate: po.orderDate,         // the day the BA's document names
  dateLabel: 'PO date',           // how hovers name that day
  rate: po.exchangeRate,          // the stamped rate, if the record has one
  provisional: !po.saved,         // not saved yet: "Today, Nov 25, 2026"
});
```

Convert with `toBase(amount, fx?.rate)`. Never with today's rate when the
record has its own.

## 3. Money: the four faces

| Face | Shows | Hover | Use on |
|---|---|---|---|
| `BaseMoney` | base | the record's own amount and rate | listings (default), detail pages (default) |
| `Money` | the record's own currency | base and rate | "Show values as: <Party> currency", the switch's party side, vendor invoice amounts |
| `EstimateMoney` | "≈ ₨2,833,270.62", muted | the record's own amount and rate | a separate base column, a converted figure that isn't final |
| `KpiMoney` | "₨750.3M", base, compact | none | KPIs |

```tsx
<BaseMoney value={inv.amount} currency={inv.currency} fx={fx} role="Vendor currency" />
<Money value={inv.amount} currency={inv.currency} fx={fx} role="Invoice currency" />
<EstimateMoney value={inv.amount} currency={inv.currency} fx={fx} />
<KpiMoney valueInBase={totalInBase} />
```

For text (toasts, chart labels, aria): `formatMoney(value, code)`,
`formatMoneyWithCode` ("$10,136.20 USD"), `formatCompactMoney`,
`formatEstimate` ("≈ $13.93"). A rate: `rateSentence('USD', 278.52)` →
"1 USD = ₨278.5200 PKR".

## 4. The currency tag and the Currency column

**Where.** The tag (`CurrencyPill`) right after a foreign partner's or
document's name: listing cells, cards, the detail page title, pickers. It
renders nothing for base. The Currency column (`CurrencyCodeCell`) in every
listing (R5).

**Copy.** The tag's hover: "Vendor's currency: US Dollar (USD)" (pass
`party`: Vendor, Customer, Partner, Account, Invoice, Payment).

```tsx
<span className="inline-flex items-center gap-1.5">
  {po.vendor.name} <CurrencyPill code={po.currency} party="Vendor" />
</span>

<td><CurrencyCodeCell code={po.currency || getBaseCurrency()} /></td>
```

## 5. Listings: "Show values as"

**Where.** In the header menu of each money column (amounts, values,
balances, prices, credit limits) of every listing, and of every table of
records inside a detail page (an item's vendor prices, an account's
transactions). Between Sort and Hide. Never a switch in the table toolbar
(R5).

**Copy.** "SHOW VALUES AS" · "Base currency" · "Vendor currency" (or
Partner, Customer, Account currency). Sentence case.

**Behaviour.** Per column, default base, kept for the session. Sort, filter
and totals stay on base values. A base record reads the same either way.

```tsx
const { viewOf, setView } = useColumnCurrencyViews('purchase-orders');

// in the module's own column header menu, money columns only:
<ShowValuesAsSection
  value={viewOf(column.id)}
  onChange={(v) => setView(column.id, v)}
  party="vendor"
  onPicked={() => setMenuOpen(false)}
/>

// the cell:
<ColumnMoney view={viewOf('value')} value={po.total} currency={po.currency} fx={poFx(po)} role="Vendor currency" />

// sorting on base, so mixed currencies compare:
rows.sort((a, b) => toBase(a.total, poFx(a)?.rate) - toBase(b.total, poFx(b)?.rate));
```

If the module's table has no header menu yet, add one in the module's own
table code (the Partners listing's `ColumnHeaderMenu` is the model) and put
the section in it. Don't put a menu inside the kit.

## 6. Vendor invoice amounts: own currency and a "≈" base column

**Where.** Vendor invoice lists and payment runs only (R6). The amount
columns always show the invoice's own currency, with no "Show values as".
Where the screen compares amounts (totals across currencies, sorting),
add a separate column beside it.

**Copy.** The column header from `estimateColumnLabel('Amount Due')`:
"≈ Amount Due (PKR)". Cells read "≈ ₨2,833,270.62".

```tsx
<th>Amount Due</th>
<th>{estimateColumnLabel('Amount Due')}</th>
…
<td><Money value={inv.amountDue} currency={inv.currency} fx={fx} role="Invoice currency" /></td>
<td><EstimateMoney value={inv.amountDue} currency={inv.currency} fx={fx} role="Invoice currency" /></td>
```

## 7. KPIs and a record's overview

**KPIs** are in base, compact, no hover (R3). Convert each record at its own
rate, then sum.

```tsx
const totalInBase = orders.reduce((s, o) => s + toBase(o.total, poFx(o)?.rate), 0);
<KpiMoney valueInBase={totalInBase} />
```

**A record's overview** (a partner's, an account's) opens in base; the
record's currency is an extra (R4). The switch sits over the overview's
widgets.

**Copy.** "Base Currency | Partner Currency" · "Show amounts in your base
currency." · "Show amounts in the currency set for this partner."

```tsx
const [view, setView] = useState<DocView>('base');
<OverviewCurrencySwitch currency={partner.currency} view={view} onChange={setView} party="partner" />
```

## 8. Detail pages: the switch in the line items toolbar

**Where.** The line items toolbar, on the right, before Add Items (or the
first card that lists the document's money, such as a payment's Applied To
card). Never the page header (R7). Only on a foreign document; it hides
itself for base.

**Copy.** "Base Currency | Vendor Currency" (Customer, Invoice, Payment) ·
"Show amounts in your base currency." · "Show amounts in the currency set for
this purchase order."

**Behaviour.** Default base, remembered per document for the session. Line
items, rule and adjustment amounts, hovers, the summary, Paid and
Outstanding, and tabs listing the document's money follow it. GL Impact
stays in base: render it with `formatMoney(amount, getBaseCurrency())` or
`BaseMoney`, never `DocMoney`.

```tsx
const viewKey = `purchase-order:${po.id}`;
const view = useDocViewOf(viewKey);

<DocCurrencyProvider currency={po.currency} fx={poFx(po)} dateLabel="PO date" role="vendor currency" view={view}>
  <PageHeader … />                       {/* no switch here */}
  <div className="flex items-center justify-between">
    <h2>Line Items</h2>
    <div className="flex items-center gap-2">
      <DocViewSwitch viewKey={viewKey} party="vendor" documentNoun="purchase order" />
      <AddItemsButton />
    </div>
  </div>
  {lines.map((l) => <DocMoney key={l.id} value={l.total} />)}
  <OrderSummary />                        {/* useDocMoney(), useDocOtherText() inside */}
</DocCurrencyProvider>
```

`useDocMoney()` gives text in the shown currency; `useDocOtherText()` gives
the other one as "≈ €243.78" for a line under a total.

## 9. Typing amounts on a document

A price or fixed amount is typed in the shown currency and kept in the
document's, rounded to its minor unit (R12). An untouched input keeps the
stored value.

```tsx
const { viewCurrency, toView, fromView, decimals } = useDocView();
<input
  defaultValue={toView(line.unitPrice).toFixed(decimals)}
  onBlur={(e) => setUnitPrice(roundToCurrency(fromView(Number(e.target.value)), po.currency))}
/>
<span>{moneyPrefix(viewCurrency)}</span>
```

## 10. The Currency information block

**Where.** The end of the document's Order Summary (or above Total Due /
Total Payment on a create screen) (R10). No Currency button in the header.

**Copy.** "CURRENCY INFORMATION" · the rows the BA's document names ("Vendor
receives", "Customer pays", "You pay in", "Base equivalent", "Estimated
payment", "FX variance") · "Exchange rate" · "View currency configuration" ·
base documents: "PKR is the base currency, so there's no conversion."

```tsx
<CurrencyBlock
  currency={po.currency}
  rateType={fx?.rateType}
  rows={[
    { label: 'Vendor receives', code: po.currency, amount: po.total },
    { label: 'You pay in', code: account.currency, title: account.label },
    ...(est.kind === 'cross' ? [{ label: 'Estimated payment', code: account.currency, amount: est.amount, prefix: '≈' as const }] : []),
    ...(isBaseCurrency(account.currency) ? [] : [{ label: 'Base equivalent', code: getBaseCurrency(), amount: toBase(po.total, fx?.rate) }]),
  ]}
  variance={inv.fxVariance != null ? { amount: inv.fxVariance, tip: 'The difference between the receiving-day rate and the invoice-date rate.' } : null}
  rate={fx ? { rate: fx.rate, qualifier: 'PO date' } : null}
  onViewConfig={() => setConfigOpen(true)}
/>
```

## 11. The Currency configuration dialog

**Where.** Opened from the block's "View currency configuration". The one
place to change the document's currency, rate type, rate and account (R11).
Build the dialog with the module's own `Dialog`; put the kit's pieces in it.

**Sections** (as the BA's document lists them): the partner's amount and
currency (changing it converts every line, after a confirmation); You pay or
You receive with the account picker; Rate with Mid-market | Corporate,
Compare rates (orders), the rate card and the lock line; FX variance where
there is one. Buttons: Reset to default, Cancel, Apply.

```tsx
<div className="flex items-center gap-1.5">
  <span>Rate</span>
  <RateTypeToggle value={rateType} onChange={setRateType} corporateAvailable={!!corporateRateOn(po.currency, po.orderDate)} disabled={locked} className="ml-auto" />
  <CompareRates currency={po.currency} rateDate={po.orderDate} selected={rateType} />
</div>
<LockLine locked={locked} locksWhen="the PO is confirmed" lockedWhen="the PO was confirmed" />
```

Compare rates goes on sales and purchase orders, right after the rate type
choice, here and on the create screen if the rate type is chosen there (R17).
Any popover inside the dialog is `<Popover modal>`; the kit's account picker
already is.

## 12. Paying from an account

"You pay" and "You receive" are accounts, in any currency (R18). The picker
lists every bank and cash account, base first, then the document's
currency, then the rest. Balances stay hidden until P2 is ruled.

```tsx
<PayFromAccountPicker value={accountId} onChange={setAccountId} documentCurrency={po.currency} readOnly={locked} />

const account = getCompanyAccount(accountId)!;
const est = payEstimate(po.total, po.currency, account, fx?.rate ?? 1);
<p className="text-[11px] text-slate-500">{payNote(est, account)}</p>
```

`payNote` writes the three cases (R19):

| Account | Note |
|---|---|
| In the document's currency | "Paid in USD from 1040 · Global FX Settlement. Nothing converts." |
| In base | "Paid from 1010 · JPMorgan Operating at 1 USD = ₨278.5200 PKR." |
| In a third currency | "Estimated payment ≈ C$10,332.57 CAD from 1075 · CAD Settlement. Estimate at today's rate. Your bank uses its own rate when you pay." |

For the third case, show the direct rate (`est.rateText`, "1 USD = C$1.3935
CAD") on the block's rate row with `rate={{ rate: est.rate, to:
account.currency }}`, never USD to PKR and CAD to PKR.

## 13. Print and download

**Where.** In the print or download preview's toolbar. Not in the send flow:
the partner always gets their currency (R22).

**Copy.** "Base Currency | Vendor Currency" · "Print amounts in your base
currency." · "Print amounts in the currency set for this purchase order." ·
the total from `printTotalLabel(code)`: "Grand Total (USD)" · the footnote
from `currencyFootnote`.

```tsx
const [view, setView] = useState<DocView>('document'); // the partner's currency by default
const inBase = view === 'base';
const code = inBase ? getBaseCurrency() : po.currency;
const amount = (n: number) => formatMoney(inBase ? toBase(n, fx.rate) : n, code);

<PrintCurrencySwitch currency={po.currency} view={view} onViewChange={setView} party="vendor" documentNoun="purchase order" />
{inBase && <Row label="Exchange rate" value={rateSentence(po.currency, fx.rate)} />}
<Row label={printTotalLabel(code)} value={amount(po.total)} />
<Footnote>{currencyFootnote(code, inBase ? { currency: po.currency, rate: fx.rate } : null)}</Footnote>
```

A PDF built with jsPDF uses `formatMoneyPdf` (its fonts lack ₨).

## 14. Mark as paid: the bank's rate

**Where.** In the Mark as paid dialog of a scheduled foreign payment (R20).
It renders nothing when the account and the invoice share a currency.

**Copy.** "Rate the bank used" · "Pre-filled with the estimate. Enter the rate on your bank statement." · "Estimate was ₨278.5200." · "+₨5,800.00
posts to FX Gain." or "−₨5,800.00 posts to FX Loss."

```tsx
const [rate, setRate] = useState(payment.estimateRate);
<BankRateField currency={inv.currency} to={account.currency} amount={payment.amount} estimateRate={payment.estimateRate} value={rate} onChange={setRate} />
```

Whether it shows for a company on mid-market rates waits on P4: follow the
BA's document.

## 15. Version and date prompts

No kit component: these are the module's own dialogs, built with the kit's
text helpers. Copy (R16, R14): "Keep version 1's rate  1 USD = 264.5919 PKR"
/ "Use today's rate  1 USD = 278.5200 PKR", each with "Mid-market · May 12,
2024 · total ₨…" under it, and a `RateTypeToggle` on today's when
`corporateRateOn(code, todayIso())` is set. A posting-date change: "Keep the
current rate" / "Use Nov 25's rate".

```tsx
<span>{rateSentence(po.currency, versionRate)}</span>
<span>{RATE_TYPE_LABEL[type]} · {formatRateDate(day)} · total {formatMoney(toBase(po.total, versionRate), getBaseCurrency())}</span>
```

## 16. What not to build

- Regional item prices (P1), the pay-from book balance (P2), a different FX
  variance date (P3): wait for the ruling.
- A switch in a listing's toolbar, or in a page header.
- A module copy of any kit file, or a kit file edited in place. If the kit
  can't do something, ask the kit's owner (Mahad) so every module gets it.
- A view change written to the activity log. Views are never edits.
