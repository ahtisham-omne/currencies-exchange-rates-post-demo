# Currencies and exchange rates: the settled rulings

The rules every OMNE module follows for currencies and exchange rates, as
settled in reviews up to 25 Nov 2026. The BA's document cites them by number
("R6") instead of repeating them, and the designer builds them with the
shared currency kit. Both skills carry this same file; keep the two copies
identical.

Where a module needs something these rules don't cover, the BA writes it in
the module's document as a ruling of its own, with who made it and when. A
rule here changes only with a dated ruling from the product team (Nophil),
the BA lead (Mahreen) or the spec owner (Eli).

Sources: Nophil Anwer's review, 25 Nov 2026 (with Mahad Ejaz and Mahreen
Ghafoor); the product team's *Currency Touchpoints Map*, 24 Nov 2026;
Mahreen's rounds of 19 and 20 Nov 2026; the *Currency & Exchange Rates
Functional Spec* (Outline); the prototype repo's commit log.

## Contents

1. Base currency (R1 to R2)
2. Where each amount is shown (R3 to R8)
3. The document's currency and its configuration (R9 to R12)
4. Rates (R13 to R17)
5. Paying and receiving (R18 to R21)
6. Printing (R22)
7. Accounting (R23 to R25)
8. Copy (R26 to R28)
9. Still open: don't build (P1 to P7)

## 1. Base currency

**R1. The base currency is per company.** Company Setup sets it (General
Settings › Base Currency). It can change until the first posting to the
general ledger, then it locks (Mahreen, 20 Nov 2026). The demo company's base
is PKR. A module never writes "PKR", "Rs" or "₨" itself: it asks the kit
(`getBaseCurrency()`), so the same screens work for a company whose base is
USD. Copy says "base currency", not "PKR".

**R2. Every amount is kept in its own currency, with a rate to base.** A
document's amounts are in the document's currency; a record's (a partner's
credit limit, an item's vendor price) in its own. The base figure is worked
out at the record's own rate, never at today's rate unless the record has no
rate yet. Money is always written with its currency's symbol and decimals
(¥ has none, KWD has three), through the kit.

## 2. Where each amount is shown

**R3. KPIs are in base, compact, with no hover.** "₨750.3M". Each record is
converted at its own rate before summing, so KPIs compare across partners.
No "In PKR, base currency" pill above KPIs (removed 25 Nov 2026).

**R4. A record's overview opens in base.** A foreign partner's (or account's)
overview KPIs and widgets open in the base currency; a Base Currency |
Partner Currency switch over them shows the partner's currency as an extra
(Nophil and Mahreen, 25 Nov 2026; matches Mahreen's 19 Nov note that KPIs are
always in base).

**R5. Listings: a Currency column, a tag, and "Show values as" per money
column.**
- Every listing has a Currency column with the Currency Library's pill (ISO
  code and name) (25 Nov 2026).
- A foreign partner or document carries its currency tag (flag and code)
  after its name. A base one gets none. The tag's hover reads "Vendor's
  currency: US Dollar (USD)".
- Each money column's header menu has "Show values as: Base currency |
  <Party> currency", between Sort and Hide, as the Partners listing has it.
  Default base, per column, kept for the session. Party is Partner, Vendor,
  Customer or Account.
- Sorting, filtering and totals stay on base values, so mixed currencies
  compare.
- No Base | Party switch in a listing's toolbar (25 Nov 2026: replaced by the
  column menu everywhere, including tables of records inside a detail page,
  such as an item's vendor prices or an account's transactions).

**R6. Exception: vendor invoice amounts are always in the invoice's own
currency.** The amount columns on the invoice list (and payment runs) show
the real amount owed, in the invoice's currency, with no "Show values as".
Where a comparison is needed, a separate base column sits beside it, marked
as an estimate ("≈"). This matters most for payment runs, where the amount
due must be the real one (Nophil, 25 Nov 2026; his 23 Nov ruling that
invoices reflect the vendor's currency). No other module has this exception
unless its document gives a ruling for it.

**R7. Detail pages: the switch is in the line items toolbar, never the
header.**
- A document in a foreign currency gets "Base Currency | <Party> Currency" in
  its line items toolbar, or the first card that lists the document's money
  (a payment's Applied To card). Never in the page header (25 Nov 2026).
- Party: Vendor (purchase order, vendor return), Customer (quote, sales
  order), Invoice (vendor invoice), Payment (vendor payment).
- Tooltips: "Show amounts in your base currency." and "Show amounts in the
  currency set for this <document>."
- Default base, remembered per document for the session. A view, never an
  edit.
- Everything that is the document's own money follows it: line items, rule
  and adjustment amounts, breakdown hovers, the summary, Paid and
  Outstanding, tabs that list the document's money. GL Impact stays in base
  (it posts in base). The Currency information block shows both.
- A base-currency document has no switch.
- Crowded toolbars put Full Screen and Condensed as icons beside it.

**R8. Mixed-currency tables inside a detail page follow R5, not R7.** An
item's vendor prices or an account's transactions mix currencies, so they
get "Show values as" in each money column's menu. A single-currency record
(a foreign bank account) uses R7 with "Account Currency".

## 3. The document's currency and its configuration

**R9. The document's currency defaults to the partner's.** It can be changed
on the document (unless the BA's document says it can't, as on an order made
from a quote). Changing it converts every line at the rate on the document's
rate date, after a confirmation that shows the rate and the totals before and
after.

**R10. The Currency information block.** At the end of the document's Order
Summary (or above Total Due / Total Payment on a create screen): the
uppercase "Currency information" label, rows (the document's own: Vendor
receives, Customer pays, You pay in, Base equivalent, FX variance), the
Exchange rate row with its rate type chip and what its day is ("PO date"),
then "View currency configuration". No lock chip on the block (25 Nov 2026).
A base-currency document shows one line instead: "PKR is the base currency,
so there's no conversion." No Currency button in the page header (25 Nov
2026).

**R11. The Currency configuration dialog is the one place to change
currency, rate type, rate and account.** Its sections are the BA's
document's (typically the partner's amount and currency; You pay or You
receive with the account picker; Rate with Mid-market | Corporate, the rate
card and the lock line; FX variance where there is one). Buttons: Reset to
default, Cancel, Apply. Once the rate is locked the dialog is read-only, with
"[Locked] locked when <event>". A popover inside the dialog is modal, so its
list scrolls.

**R12. Create and edit screens.** They use the same pieces as the detail
page. Prices are typed in the shown currency and kept in the document's,
rounded to its minor unit. A vendor invoice's create screen opens in the
invoice's currency with the switch enabled (25 Nov 2026); other create
screens open in base unless the document says otherwise.

## 4. Rates

**R13. Two rate types.** Mid-market: synced daily from the provider (Open
Exchange Rates), read-only. Corporate: set by finance, in effect from a date.
The company's default is mid-market. Purple for mid-market, amber for
corporate. A day with no corporate rate falls back to mid-market. Changing a
rate on a transaction is allowed only when the company uses corporate rates
(Eli, 8 Apr 2026, spec Part 3.5).

**R14. Each document takes its rate on one day.** The BA's document names it:

| Document | Rate day |
|---|---|
| Purchase order, quote, sales order | Its document date (PO date, quote date, order date) |
| Receiving doc | The day it completes (in progress: today) |
| Vendor invoice | Its posting date (the default since 24 Nov 2026; Module Defaults can pick another basis) |
| Vendor payment | Its payment date, or the bank's rate worked out from the two amounts |
| Vendor return settlement | Worked out from the two amounts |

A document not saved yet uses today's rate, marked "Today, <date>". A
posting-date change on an edited invoice asks "Keep the current rate" or
"Use <date>'s rate".

**R15. Locks.** A rate locks with the document, at the event the BA's
document names: a PO when confirmed (Draft and Sent unlocked); a sales order
when it leaves Draft; a vendor invoice when it posts (Approved onward); a
payment when it posts (Scheduled stays unlocked); a receiving doc when it
completes. An order made from a quote starts with the quote's currency and
rate and locks when confirmed.

**R16. Versions take today's rate unless the user keeps the old one.** New
and restored versions ask "Keep version <n>'s rate" or "Use today's rate",
each with its rate, and today's has a Mid-market | Corporate switch when a
corporate rate is set (25 Nov 2026).

**R17. Compare rates.** On sales and purchase orders, an icon right after the
rate type choice (in the Currency configuration, and on the create screen if
the rate type is chosen there) opens a read-only card with both rates for the
pair, the partner's currency to base, on the document's rate day, and the
difference: "Corporate is ₨2.98 (1.07%) above mid-market." (Nophil, 25 Nov
2026.)

## 5. Paying and receiving

**R18. "You pay" and "You receive" are accounts, in any currency.** A
document names the company bank or cash account it is paid from (or received
into). Any account, in any currency (25 Nov 2026), listed base first, then
the document's currency, then the rest. Default: 1010 · JPMorgan Operating.
The account on an order or invoice is only a default; the payment can change
it.

**R19. Paying from a third-currency account uses the direct rate.** Paying a
USD vendor from a CAD account moves CAD to USD, so the only rate shown is CAD
to USD ("1 USD = C$1.3935 CAD"), not USD to PKR and CAD to PKR. The base
appears only as an estimate where amounts are compared (lists, total spent)
(Nophil, 25 Nov 2026). The amount is an estimate, in Mahreen's copy:
"Estimated payment ≈ $X USD from 1040 · Global FX Settlement. Estimate at
today's rate. Your bank uses its own rate when you pay." From an account in
the document's currency nothing converts; from a base account the document's
own rate applies.

**R20. Mark as paid asks for the bank's rate.** A scheduled foreign-currency
payment is estimated at the rate set up. On its payment date an action item
asks the user to settle the rate. Marking it as paid asks for the bank's
actual rate in one field, pre-filled with the estimate; the difference posts
to FX Gain or FX Loss. No rate is asked when the account and the invoice are
in the same currency (Nophil, 25 Nov 2026). Check against R13's spec 3.5
rule: see P4.

**R21. Estimates wear "≈".** Any figure that isn't final (a third-currency
payment, a base column beside a real amount, a price converted because no
price is set for the market) is marked "≈" and its hover says what it was
converted at.

## 6. Printing

**R22. Print in the document's currency, with a switch to base.** The
printed or downloaded document defaults to the partner's currency (it is
their document). The preview has "Base Currency | <Party> Currency" (25 Nov
2026). In base, every amount prints in base at the document's rate, with an
Exchange rate line, a total that names its currency ("Grand Total (PKR)") and
the footnote "All amounts in Pakistani Rupees (PKR), converted from United
States Dollars (USD) at 1 USD = ₨278.5200 PKR." In the partner's currency the
footnote is "All amounts in United States Dollars (USD)." Sending to the
partner always uses the partner's currency: no switch in the send flow.

## 7. Accounting

**R23. Orders don't touch the books.** The invoice books an estimate in base
at that day's rate (mid-market or corporate, as the company has set it up).
When the money moves, the actual amount is recorded and the difference posts
to FX Gain or FX Loss (Eli, 8 Sep 2026; confirmed 25 Nov 2026).

**R24. FX variance and FX gain or loss.** + is a gain (green), − a loss (red).
Today an invoice's receiving-to-invoice variance posts to 5215 FX Variance
and a payment's difference to 7150 Realized FX Gain/Loss; the screens say
"posts to FX Gain" or "posts to FX Loss". The vendor invoice's FX variance
tooltip: "The difference between the receiving-day rate and the invoice-date
rate."

**R25. Pricing rules have no currency.** Their fixed amounts and value
thresholds are in base; on a document in another currency a fixed amount is
converted at the document's own rate. The rule form shows "Currency  PKR ·
base currency", locked (24 Nov 2026).

## 8. Copy

**R26. Words.** "base currency", "mid-market rate", "corporate rate",
"exchange rate". Sentence case in menus ("Show values as", "Base currency"),
title case on the switches' two options ("Base Currency | Vendor Currency")
as the prototype has them. Plain, short sentences. No em dashes in UI copy;
pairs read "to", not "→".

**R27. Numbers.** A rate has 4 decimals (6 under 0.01) and reads "1 USD =
₨278.5200 PKR". An amount with its code reads "$10,136.20 USD". Dates read
"Nov 04, 2026"; the Compare rates card writes "25 Nov 2026". A credit uses
a real minus ("−€980.50").

**R28. The provider.** "Open Exchange Rates" links to openexchangerates.org
wherever it is on screen (Mahreen, 19 Nov 2026); printed documents keep it
as text.

## 9. Still open: don't build

Each of these waits on a ruling. The BA lists the ones that touch the module
under Open questions; the designer builds nothing for them.

**P1. Regional item prices (waiting on Eli).** Nophil (25 Nov 2026) wants an
item to carry its own price per market currency next to its base price; an
order line would take the regional price in the order's currency, else the
base price converted at the day's rate, marked as an estimate with a hover
saying no price is set for this market; the rep can still change it. This
clashes with Nophil's 23 Nov ruling for phase one, Eli's 6 Oct backlog
ruling (Level 6) and spec Part 4.1 (item prices are always in base). Nophil
is taking it to Eli. The prototype has it (25 Nov 2026): Items (Create
Item › Selling › Regional prices) and Sales Orders (lines take the market
price; an estimate shows a coin icon with the hover). Data shape:
`regionalPrices?: { currency, unitPrice }[]`, never the base currency.
Until Eli rules, build it only where the module's BA document asks for it,
and copy the prototype rather than designing it again.

**P2. The pay-from account's book balance on a PO.** Nophil: a buyer needs it
to choose, behind a permission. Mahreen: it is confidential and belongs in
payments. No ruling (25 Nov 2026). The kit's account picker hides balances
unless told to show them.

**P3. Which date an invoice's FX variance uses.** The invoice shows the
receiving-day rate against the invoice-date rate, while its rate is tied to
the posting date; Nophil said the variance is only real at payment. No
ruling (25 Nov 2026).

**P4. Mark as paid against spec 3.5.** R20 asks for the bank's rate on every
foreign payment; spec 3.5 lets a transaction's rate change only when the
company uses corporate rates. Needs Eli or Nophil.

**P5. Separate FX Gain and FX Loss accounts.** The screens say "FX Gain" and
"FX Loss", the ledger has 5215 and 7150. Changing the chart of accounts is
left for a decision.

**P6. Making a foreign-currency order stand out on its create screen.** Mahad
is trying colour variations for the vendor currency on Create PO (25 Nov
2026). Until then, the tag and the Currency information block are the
signals.

**P7. Sample data that agrees.** Every module's totals, summary and currency
must agree with its lines before a review (Nophil, 25 Nov 2026, on sales
orders). Not a design question, but check it.
