# Currencies and exchange rates: the settled rulings

The rules every OMNE module follows for currencies and exchange rates, as
settled in reviews up to 27 Nov 2026. The BA's document cites them by number
("R6") instead of repeating them, and the designer builds them with the
shared currency kit. Both skills carry this same file; keep the two copies
identical.

Where a module needs something these rules don't cover, the BA writes it in
the module's document as a ruling of its own, with who made it and when. A
rule here changes only with a dated ruling from the product team (Nophil),
the BA lead (Mahreen) or the spec owner (Eli).

Sources: Eli Rosenbloom's rate ruling, 26 Nov 2026; Mahreen Ghafoor's design
changes from the 25 Nov review, 27 Nov 2026; Nophil Anwer's review, 25 Nov
2026 (with Mahad Ejaz and Mahreen Ghafoor); the product team's *Currency
Touchpoints Map*, 24 Nov 2026;
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
9. Still open: don't build (P1, P2, P5, P7)

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
overview KPIs and widgets open in the base currency; a switch over them,
"Show amounts in: Base (PKR) | Partner (MXN)", shows the partner's currency as
an extra (Nophil and Mahreen, 25 Nov 2026; matches Mahreen's 19 Nov note that
KPIs are always in base). In base, each converted figure wears "≈" with the
partner's own amount under it, and a line under the KPIs says which rate:
"≈ at today's daily market rate: 1 MXN = ₨16.4300" (Mahreen, 27 Nov 2026; Eli,
26 Nov 2026: estimates on screen use that day's rate).

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
- The invoice list's base column is "Base Equivalent": a posted invoice shows
  its fixed base amount (at its posting date's rate) with no "≈"; only an
  invoice not posted yet wears "≈". The list's footer reads "By currency:
  AED 43,400.00 · €12,000.00 · …" on the left and "Total in base ≈ ₨…" on the
  right, over every row the filters leave (Mahreen, 27 Nov 2026).
- Proposed for the purchase orders list (Mahreen, 27 Nov 2026): Amount in
  each PO's own currency, and a "Base Equivalent" column after it with "≈"
  (a PO is an estimate); a base-currency PO shows its plain amount.

**R7. Detail pages: the switch is in the line items toolbar, never the
header.**
- A document in a foreign currency gets "Base Currency | <Party> Currency" in
  its line items toolbar, or the first card that lists the document's money
  (a payment's Applied To card). Never in the page header (25 Nov 2026).
- Party: Vendor (purchase order, vendor return), Customer (quote, sales
  order), Invoice (vendor invoice), Payment (vendor payment).
- Tooltips: "Show amounts in your base currency." and "Show amounts in the
  currency set for this <document>."
- Orders (purchase orders, quotes, sales orders) open in the document's own
  currency, the vendor's or the customer's: Mahreen's 27 Nov 2026 designs show
  their lines that way, and Nophil found the vendor's currency invisible.
  Other documents open in base unless their document says otherwise. Either
  way the choice is remembered per document for the session. A view, never
  an edit.
- An order's line items name their currency: a "Prices in EUR" chip (globe
  icon, brand tint) after the "Line Items" title, and the shown currency in
  the price and total headers, "Price Per Unit (EUR)", "Total (EUR)". A sales
  order or quote also states its rate once, at the top right of the line
  items: "Exchange rate: daily market rate · 1 USD = ₨278.5200" (Mahreen,
  27 Nov 2026). A base-currency document gets neither.
- An order's line items end with a Total row; next to it a small convert
  icon's hover gives the base estimate: "$1,860.00 ≈ ₨518,047.20", Rate type,
  Rate, Rate date, and "Estimate. Nothing posts from a sales order."
  Each line total is quantity × price; pricing rules and one-time adjustments
  apply in the summary (Mahreen, 27 Nov 2026).
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
Paying from a third currency's account, it reads (Mahreen, 27 Nov 2026):
Vendor receives "$10,000.00 [USD]" · You pay in "1075 · CAD Settlement" ·
You pay "≈ C$13,935.00" · Exchange rate "1 USD = 1.3935 CAD" with the rate
type chip under it · Base equivalent "≈ ₨2,785,200.00" with "Estimate at
today's rate" under it. No rates through the base. A vendor invoice's block
locks what the vendor billed: "Vendor invoiced AED 43,400.00" with a lock
icon and "From the vendor's invoice GF-7781" under it; the rate says
"Posting date Nov 25, 2026" and the base equivalent "Follows the posting
date's rate" (Mahreen, 27 Nov 2026).
A base-currency document shows one line instead: "PKR is the base currency,
so there's no conversion." No Currency button in the page header (25 Nov
2026).

**R11. The Currency configuration dialog is the one place to change
currency, rate type, rate and account.** Its sections are the BA's
document's (typically the partner's amount and currency; You pay or You
receive with the account picker; Rate with Daily market rate | Corporate rate
and the rate info icon (R17), the rate card and the lock line; FX variance
where there is one). Buttons: Reset to
default, Cancel, Apply. Once the rate is locked the dialog is read-only, with
"[Locked] locked when <event>". A popover inside the dialog is modal, so its
list scrolls.

**R12. Create and edit screens.** They use the same pieces as the detail
page. Prices are typed in the shown currency and kept in the document's,
rounded to its minor unit. A vendor invoice's create screen opens in the
invoice's currency with the switch enabled (25 Nov 2026), and so do order
create screens (R7, 27 Nov 2026); other create screens open in base unless
the document says otherwise.

## 4. Rates

**R13. Two rate types: the daily market rate and the corporate rate.** Eli,
26 Nov 2026: one rate per currency per day, and every entry dated that day
uses it. Not a buying or selling rate, and never a live rate that moves
during the day.
- Daily market rate: read once a day from the provider (Open Exchange Rates)
  and fixed for that date, read-only. Screens say "Read on Nov 27, 2026",
  never a time. Never "mid-market".
- Corporate rate: set by your company, in effect from a date. A company that
  wants its central bank's or its own bank's rate, or one planning rate for a
  year, sets it as its corporate rate; the warning when it drifts too far
  from the market stays.
- No buying and selling rates (Eli, 7 Apr 2026). Central bank rates may come
  later as a tab of their own.
- The company's default is the daily market rate (Company Setup › Default
  Exchange Rate). Purple for the daily market rate, amber for corporate. A
  day with no corporate rate falls back to the daily market rate. Changing a
  rate on a transaction is allowed only when the company uses corporate rates
  (Eli, 8 Apr 2026, spec Part 3.5); the bank's own rate on a payment is not
  that (R20).

**R14. Each document takes its rate on the day it posts.** Eli, 26 Nov 2026,
as GAAP has it: someone getting to an entry late doesn't get today's rate.
The BA's document names the day:

| Document | Rate day |
|---|---|
| Purchase order, quote, sales order | Its document date. An estimate only: nothing posts |
| Receiving doc | The day it completes (in progress: today). Inventory posts at that rate and never changes |
| Vendor invoice | Its posting date, which defaults to the vendor's invoice date. The gap from the receipt's rate goes to currency gain or loss |
| Vendor payment | Its payment date. The gap from the invoice's rate is a realized gain or loss, and so is the bank's own rate (R20) |
| Vendor return settlement | Worked out from the two amounts |

A bill dated Jan 31 that is typed in on Feb 5 and posted to Jan 31 gets Jan
31's rate.

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
each with its rate, and today's has a Daily market rate | Corporate rate
switch when a corporate rate is set (25 Nov 2026).

**R17. The rate info icon: both rates wherever the rate type is chosen.**
An info icon right after the rate type choice: a partner's and a partner
group's "Default exchange rate", and the Currency configuration of an order,
a quote or a vendor invoice (and the create screen where the rate type is
chosen there). Hover or focus opens a read-only card for the currency to
base on the record's rate day (Mahreen, 27 Nov 2026, replacing the 25 Nov
"Compare rates" card; Nophil asked for it):

    USD to PKR today
    ● Daily market rate      1 USD = ₨278.5200 PKR
    ● Corporate rate         1 USD = ₨281.5000 PKR
    Gap                      ₨2.98 (1.07%)
    Daily market rate read on Nov 27, 2026. Corporate rate set by your
    company on May 01, 2026.

No corporate rate: "Not set", no Gap, and "No corporate rate is set for
MXN." Nothing for the base currency. The kit's `RateTypeInfo`.

## 5. Paying and receiving

**R18. "You pay" and "You receive" are accounts, in any currency.** A
document names the company bank or cash account it is paid from (or received
into). Any account, in any currency (25 Nov 2026). "You pay in" is one
dropdown of accounts, each with its currency chip ("1010 · JPMorgan Operating
[PKR]"), the vendor's default first and tagged "From vendor"; there is no
separate pay-currency choice (Mahreen, 27 Nov 2026). Then base, then the
document's currency, then the rest. Default: the vendor's account, else
1010 · JPMorgan Operating. No balances on a PO (P2). The account on an order
or invoice is only a default; the payment can change it. Recording a payment,
the list puts the invoice's currency first, shows each account's balance and
ends with "Add a bank account".

**R19. Paying from a third-currency account uses the direct rate.** Paying a
USD vendor from a CAD account moves CAD to USD, so the only rate shown is CAD
to USD ("1 USD = C$1.3935 CAD"), not USD to PKR and CAD to PKR. The base
appears only as an estimate where amounts are compared (lists, total spent)
(Nophil, 25 Nov 2026). The amount is an estimate, in Mahreen's copy:
"Estimated payment ≈ $X USD from 1040 · Global FX Settlement. Estimate at
today's rate. Your bank uses its own rate when you pay." From an account in
the document's currency nothing converts; from a base account the document's
own rate applies. Recording such a payment shows only "1 USD = 1.3935 CAD ·
Daily market rate · Dec 05, 2026" and the bank's rate in CAD (Mahreen,
27 Nov 2026).

**R20. Recording a foreign payment asks for the bank's rate.** Nophil,
25 Nov 2026; Mahreen's design, 27 Nov 2026; Eli, 26 Nov 2026: the bank's own
spread and fees show up when the payment is booked, and the difference goes
to currency gain or loss.
- "Our rate" fills in: the daily market rate on the payment date, with its
  base amount ("Daily market rate · Dec 05, 2026 · ₨754,912.00").
- One required field, "Bank's rate *" ("1 AED = [76.2500] PKR"), pre-filled
  with our rate, helper "Enter the exchange rate the bank gave you."
- Under it the breakdown: Invoice booked at, Bank took at, Rate change since
  invoice, Bank's rate vs ours, FX variance.
- Same currency (an AED account paying an AED invoice): no rate fields, only
  "Same currency. No exchange rate needed."
- A scheduled payment shows an "Estimate" chip with its rate and the "≈" base
  amount ("Same currency" when nothing converts), "Rate settles when paid"
  under its status (proposed). On its payment date a banner says "{payment no.}
  was scheduled for today. Once it's paid, enter the rate the bank gave you."
  with "Enter rate"; Mark as paid asks the same field and breakdown.

**R21. Estimates wear "≈".** Any figure that isn't final (a third-currency
payment, a base column beside a real amount, a price converted because no
price is set for the market, an order's base total) is marked "≈" and its
hover says what it was converted at. A posted figure is final and wears no
"≈" (a posted invoice's base amount).

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
at that day's rate (daily market or corporate, as the company has set it up).
When the money moves, the actual amount is recorded and the difference posts
to FX Gain or FX Loss (Eli, 8 Sep 2026; confirmed 25 Nov 2026).

**R24. FX variance and FX gain or loss.** + is a gain (green), − a loss (red).
Today an invoice's receiving-to-invoice variance posts to 5215 FX Variance
and a payment's difference to 7150 Realized FX Gain/Loss; the screens say
"posts to FX Gain" or "posts to FX Loss". The vendor invoice's FX variance
tooltip: "The difference between the receipt date's rate and the posting
date's rate." Its Currency configuration shows both sides above the variance
(Mahreen's proposal, 27 Nov 2026): "Received · Nov 18, 2026  1 AED =
₨75.2000 · ₨745,984.00" and "Billed · posting date Nov 25, 2026  1 AED =
₨75.8400 · ₨752,332.80", then "FX variance −₨6,348.80" with "On AED 9,920.00,
the part not prepaid. The posting date is the vendor's invoice date. A
negative amount means this invoice costs more in your base currency. Posts
when the invoice posts."

**R25. Pricing rules have no currency.** Their fixed amounts and value
thresholds are in base; on a document in another currency a fixed amount is
converted at the document's own rate. The rule form shows "Currency  PKR ·
base currency", locked (24 Nov 2026).

## 8. Copy

**R26. Words.** "base currency", "daily market rate" (never "mid-market":
Eli, 26 Nov 2026), "corporate rate", "exchange rate". The rate types read
"Daily market rate" and "Corporate rate" in full, on toggles, chips and
dropdowns. Sentence case in menus ("Show values as", "Base currency"),
title case on the switches' two options ("Base Currency | Vendor Currency")
as the prototype has them. Plain, short sentences. No em dashes in UI copy;
pairs read "to", not "→".

**R27. Numbers.** A rate has 4 decimals (6 under 0.01) and reads "1 USD =
₨278.5200 PKR". Both directions read "1 USD = ₨278.5200 · 1 PKR = $0.0036",
and a rate list names its columns "1 Unit in PKR" and "1 PKR in That
Currency", never "inverse" (Mahreen's proposal, 27 Nov 2026). An amount with
its code reads "$10,136.20 USD". Dates read "Nov 04, 2026". A credit uses a
real minus ("−€980.50").

**R28. The provider.** "Open Exchange Rates" links to openexchangerates.org
wherever it is on screen (Mahreen, 19 Nov 2026); printed documents keep it
as text.

## 9. Still open: don't build

Each of these waits on a ruling. The BA lists the ones that touch the module
under Open questions; the designer builds nothing for them.

**P1. Item prices per currency (waiting on Eli, for the 30 Nov review).**
Agreed already (Nophil, 25 Nov 2026, to confirm in writing): an item and an
item category carry no exchange rate setting; the Selling tab says "The
exchange rate comes from the customer and the order, not the item."
Waiting: Nophil wants an item to carry a price per currency, tied to a
customer partner group. Mahreen's design (27 Nov 2026), in the prototype:
Items › Selling › "Other currencies", with "Convert from the base price"
("Uses that day's rate. Orders mark it as an estimate.") or "Set a price for
each currency" ("Currencies without a price still convert."), then a table
of Currency, Partner group, Price per unit and In base today. A sales order
line takes the item's price for the order's currency and the customer's
group, with "Item's USD price" under it; without one, an "Est." chip, the
converted price and an info icon: "This item has no USD price. Converted
from the base price ₨100.00 at today's daily market rate (1 USD =
₨278.5200)." The rep can still change it. This clashes with Nophil's 23 Nov
ruling for phase one, Eli's 6 Oct backlog ruling (Level 6) and spec Part 4.1
(item prices are always in base). Data shape:
`otherCurrencyPricing?: 'convert' | 'perCurrency'` and
`regionalPrices?: { currency, unitPrice, partnerGroup? }[]`, never the base
currency. Until Eli rules, build it only where the module's BA document asks
for it, and copy the prototype rather than designing it again.

**P2. The pay-from account's book balance on a PO (waiting on Nophil).**
Nophil: a buyer needs it to choose, behind a "View bank balances"
permission. Mahreen: it is confidential and shows when the payment is
recorded. No ruling (27 Nov 2026). The kit's account picker hides balances
unless told to show them.

P3 (which date an invoice's FX variance uses) closed with Eli's ruling of
26 Nov 2026: the posting date, which defaults to the vendor's invoice date
(R14, R24). P4 (the bank's rate against spec 3.5) closed with the same
ruling: the bank's own rate posts to gain or loss (R20).

**P5. Separate FX Gain and FX Loss accounts.** The screens say "FX Gain" and
"FX Loss", the ledger has 5215 and 7150. Changing the chart of accounts is
left for a decision.

P6 (making the order's currency stand out) closed with Mahreen's design of
27 Nov 2026: the "Prices in EUR" chip and the currency in the line headers
(R7).

**P7. Sample data that agrees.** Every module's totals, summary and currency
must agree with its lines before a review (Nophil, 25 Nov 2026, on sales
orders). Not a design question, but check it.
