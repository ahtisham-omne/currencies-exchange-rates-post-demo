# Currencies & Exchange Rates: Purchase Orders

25 Nov 2026 · Worked example for the omne-currencies plugin

Purchase Orders, written from the prototype (touchpoints/purchase-order) as it
stood on 25 Nov 2026, after Nophil's review. It shows the depth a BA's
document needs; a real module's document is written by its BA and reviewed
before handover. Procurement Planning is out of scope here.

## Sources

- The prototype: touchpoints/purchase-order in currencies-exchange-rates-post-demo, read on 25 Nov 2026 (commit 4eb00126 and the review fixes after it).
- docs/purchase-orders-currency-touchpoints.md, sections 3 to 3c.
- Nophil Anwer's review, 25 Nov 2026 (items: compare rates, pay-from rate, book balance, vendor currency on Create PO).
- Mahreen Ghafoor's design changes from that review, 27 Nov 2026 (PO-1 to PO-5), and Eli Rosenbloom's rate ruling, 26 Nov 2026.
- The product team's Currency Touchpoints Map, 24 Nov 2026, Purchase Orders 1 to 5 and Receiving 1 to 2.

## Rulings this document follows

- R1, R2: every amount is kept in the PO's currency with the PO's rate; the base is the company's.
- R3: the dashboard's money KPIs are in base.
- R5: the Purchase Orders listing has a Currency column and the vendor's tag; the Receiving Docs table's Value column gets "Show values as".
- R7: the PO page's switch sits in the Line Items toolbar.
- R9 to R11: the PO's currency defaults to the vendor's; the Currency information block and the Currency configuration dialog.
- R13 to R17: the daily market rate by default, the PO date's rate (an estimate: nothing posts), locks when confirmed, versions offer today's rate, the rate info icon after the rate type.
- R18, R19: "You pay" is an account in any currency; a third-currency account shows the direct rate as an estimate.
- R22: the printed PO is in the vendor's currency, with a switch to base.
- R25: pricing rules are in base.
- Module ruling: the cart shows plain base amounts with no hover, only the vendors' currency tags (Mahreen, 20 Nov 2026; tags back on 24 Nov 2026).

## The module at a glance

| Question | Answer |
|---|---|
| Base currency | The company's base currency (R1). Nothing module-specific. |
| Party | Vendor |
| Document currency | The vendor's default currency. It can change on the PO from the Currency configuration, which converts every line at the PO date's rate. |
| Rate type | The company default (daily market rate); Daily market rate or Corporate rate per PO. A corporate rate can be changed on the PO. |
| Rate date | The PO date. A receiving doc takes its completion day's rate (today while in progress). |
| Locks | When the PO is confirmed. Draft and Sent are unlocked; a cancelled PO keeps the state it was cancelled in. |
| Pay from / receive into | "You pay" is a company account in any currency, 1010 · JPMorgan Operating by default (R18). A third-currency account shows the direct rate as an estimate (R19). |
| FX gain or loss | None: a PO never books (R23). Vendor Invoicing and Vendor Payments book. |

## Screens

### Screen 1: Purchase Orders

**Kind** Listing
**Where** Purchase Orders › the listing.
**Amounts** None: the listing has no money columns today.
**Switch** None.
**Show values as** No money columns. If a PO Value column is added, it gets "Show values as: Base currency | Vendor currency".
**Currency column** Yes: the Currency Library pill and name.
**Rate** Not applicable: no amounts.
**Lock** Not applicable.
**Pay from** Not applicable.
**FX gain/loss** None.
**Copy** None new. The vendor's tag hover reads "Vendor's currency: US Dollar (USD)".

### Screen 2: Purchase Orders dashboard

**Kind** KPIs
**Where** Purchase Orders › Dashboard.
**Amounts**

| Amount | Shown in | Hover | Estimate (≈) |
|---|---|---|---|
| Total Spend | Base, compact | None | No |
| Avg Order Value | Base, compact | None | No |
| Spend trend, daily avg and axis | Base, compact | None | No |

**Switch** None.
**Show values as** No money columns.
**Currency column** Not applicable: no table.
**Rate** Each PO's own rate (PO date), summed in base.
**Lock** Not applicable.
**Pay from** Not applicable.
**FX gain/loss** None.
**Copy** None new. No "In PKR, base currency" pill above the KPIs (removed 25 Nov 2026).

### Screen 3: Purchase order page

**Kind** Detail page
**Where** Purchase Orders › open a PO (395-9900, General Motors, USD).
**Amounts**

| Amount | Shown in | Hover | Estimate (≈) |
|---|---|---|---|
| Line unit price, line total, rule and one-time amounts | The vendor's currency by default; base with the switch | The other currency, the rate, its type and "PO date" | No |
| Order Summary: Subtotal, Pricing Rules Applied, One-Time Discounts/Premiums, Total | As the switch | As above | No |
| "Vendor receives" under the Total | The vendor's currency | None | No |
| Currency information block | Both, as its rows say | None | "≈" on an estimated payment only |

**Switch** Line items toolbar: "Base Currency | Vendor Currency", foreign-currency POs only, default the vendor's currency (R7, 27 Nov 2026), kept per PO for the session. Never in the page header. The card's title carries a "Prices in USD" chip and the price and total headers name the shown currency, "Price Per Unit (USD)", "Total (USD)".
**Show values as** No listing on this tab.
**Currency column** Not applicable: one currency on the page.
**Rate** The PO's rate type on its PO date.
**Lock** Shown in the configuration dialog, not on the block.
**Pay from** The block's "You pay in" row names the account. From a third currency's account (R10): Vendor receives "$10,000.00 [USD]" · You pay in "1075 · CAD Settlement" · You pay "≈ C$13,935.00" · Exchange rate "1 USD = 1.3935 CAD" with its rate type chip under it · Base equivalent "≈ ₨2,785,200.00" with "Estimate at today's rate" under it. No rates through the base.
**FX gain/loss** None.
**Copy** "Show amounts in your base currency." · "Show amounts in the currency set for this purchase order." · "Currency information" · "View currency configuration" · "PKR is the base currency, so there's no conversion."

### Screen 4: Receiving Docs tab

**Kind** Listing
**Where** A PO › Receiving Docs (?tab=receiving-docs).
**Amounts**

| Amount | Shown in | Hover | Estimate (≈) |
|---|---|---|---|
| Value (and the expanded lines and the total row) | Base by default, per "Show values as" | The other currency, the receiving date's rate | No |

**Switch** None: the Line Items switch doesn't flip this table, and this table's menu doesn't flip the page.
**Show values as** Value: "Base currency | Vendor currency", foreign-currency POs only, default base, kept per PO for the session.
**Currency column** Yes: the PO's one currency.
**Rate** Each doc's completion day (receiving date); in progress: today. The type follows the PO.
**Lock** A completed doc is Locked at its completion day's rate; one in progress is Unlocked.
**Pay from** Not applicable.
**FX gain/loss** None here; Vendor Invoicing books the receiving-to-invoice variance.
**Copy** "Rate 1 USD = ₨259.6485 PKR · receiving date" · "In progress" · "Received so far" · "Base value"

### Screen 5: Currency configuration

**Kind** Configuration dialog
**Where** A PO › Order Summary › View currency configuration.
**Amounts**

| Amount | Shown in | Hover | Estimate (≈) |
|---|---|---|---|
| Vendor receives | The PO's currency | None | No |
| You pay | The account's currency; "≈ ₨…" from a base account | None | Yes from a third-currency account (R19) |
| Base equivalent | Base | None | Yes ("≈") |

**Switch** None.
**Show values as** Not applicable.
**Currency column** Not applicable.
**Rate** Daily market rate | Corporate rate on the PO date, with the rate info icon right after the choice; a corporate rate can be typed. From a third-currency account, the direct rate between the account's currency and the PO's.
**Lock** "[Unlocked] locks when the PO is confirmed", or "[Locked] locked when the PO was confirmed"; read-only once locked.
**Pay from** "You pay in" is one dropdown of every bank and cash account, each with its currency chip, the vendor's default first and tagged "From vendor", then base, then the PO's currency, then the rest. No separate pay-currency choice. Default: the vendor's account, else 1010 · JPMorgan Operating. Balances hidden (P2).
**FX gain/loss** None.
**Copy** "Applies to PO {n} only. The vendor's default currency (USD) doesn't change." · "Defaults to the vendor's currency. Changing it converts every line at the PO date's rate." · "The currency you pay this PO in. Defaults to your base currency." · "Estimated payment ≈ $X USD from 1040 · Global FX Settlement. Estimate at today's rate. Your bank uses its own rate when you pay." · "USD to PKR today" · "Gap ₨2.98 (1.07%)" · "Daily market rate read on Nov 27, 2026. Corporate rate set by your company on May 01, 2026."

### Screen 6: Cart and Create PO

**Kind** Create/edit
**Where** Purchase Orders › Catalogue › Cart › Create POs.
**Amounts**

| Amount | Shown in | Hover | Estimate (≈) |
|---|---|---|---|
| Cart prices, vendor subtotals, Order Summary | Base, plain | None | No |
| Catalogue prices | Base | The vendor's price at today's rate | No |
| "Purchase Orders Created" list | Base | The PO's amount and rate | No |

**Switch** None.
**Show values as** No listing.
**Currency column** Not applicable.
**Rate** Each new PO takes the vendor's currency and the daily market rate on its PO date (today).
**Lock** Not applicable: new POs start as Draft.
**Pay from** New POs pay from 1010 · JPMorgan Operating.
**FX gain/loss** None.
**Copy** "3 POs: General Motors (GM) in USD, Toyota Technical Center (TTC) in JPY, Chrysler (Stellantis N.V.) in EUR."

### Screen 7: Save version and Revert to version

**Kind** Other
**Where** A PO › version dropdown › Save version, or History › Revert.
**Amounts**

| Amount | Shown in | Hover | Estimate (≈) |
|---|---|---|---|
| Total at each rate | Base | None | No |

**Switch** None.
**Show values as** Not applicable.
**Currency column** Not applicable.
**Rate** "Keep version {n}'s rate" or "Use today's rate", each with its rate type and day; today's has Daily market rate | Corporate rate when a corporate rate is set today.
**Lock** Restoring a version can apply today's rate even on a confirmed PO, as the map's restore prompt offers it.
**Pay from** Not applicable.
**FX gain/loss** None.
**Copy** "Keep version 1's rate" · "Use today's rate" · "Keep version {n}'s rate or use today's?"

### Screen 8: Print and download preview

**Kind** Print
**Where** A PO › Actions › Print, or Download PDF.
**Amounts**

| Amount | Shown in | Hover | Estimate (≈) |
|---|---|---|---|
| Every amount on the printed PO | The vendor's currency by default; base with the switch | None | No |

**Switch** Print preview: "Base Currency | Vendor Currency", default the vendor's currency. Not offered when sending to the vendor.
**Show values as** Not applicable.
**Currency column** Not applicable.
**Rate** The PO's rate on its PO date.
**Lock** Not applicable.
**Pay from** Not applicable.
**FX gain/loss** None.
**Copy** "Grand Total (USD)" · "All amounts in United States Dollars (USD)." · In base: "Exchange rate 1 USD = ₨278.5200 PKR", "Grand Total (PKR)", "All amounts in Pakistani Rupees (PKR), converted from United States Dollars (USD) at 1 USD = ₨278.5200 PKR."

## FX gain and loss

None: a purchase order never books (R23). The receiving-to-invoice variance
is booked by Vendor Invoicing and the payment difference by Vendor Payments.

## Activity log

The PO's log records a currency change, an exchange rate change, a rate type
change and a pay-from account change, each with its before and after, and a
version saved or restored at today's rate. The switches are views and are
never logged. The sentences belong in "Activity Logs: Purchase Orders", which
doesn't exist yet; until it does, the version history's change records stand
in ("1010 · JPMorgan Operating (PKR) to 1040 · Global FX Settlement (USD)").

## Open questions

**Does a buyer see the pay-from account's book balance on a PO (P2)?** Nophil
wants it behind a "View bank balances" permission; Mahreen says it shows when
the payment is recorded. The account picker hides balances until this is
settled. Nophil to rule.

**Should the listing show a Base Equivalent column (R6, proposed)?** Mahreen
proposes Amount in each PO's currency and "Base Equivalent" beside it with
"≈". The prototype has it; the listing otherwise follows R5.

**Regional item prices (P1).** If Eli approves them, a PO line would take the
item's buying price in the PO's currency where one is set, else the
converted base price marked "≈". Nothing is built until he rules.
