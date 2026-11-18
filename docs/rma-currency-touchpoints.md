# Vendor Returns (RMA): currency & exchange-rate touchpoints

The RMA app (`touchpoints/rma`, from [`rma-web-builder`](https://github.com/ahtisham-omne/rma-web-builder)) is in dollars. A return is in the currency of the PO its goods came on: the vendor priced the goods in it, invoiced them in it, and credits or refunds in it. So every amount on a return reads in that currency, "£30.23 per FT", with dollars on hover. Dollars are used wherever returns in different currencies are added up.

Paths below are under `touchpoints/rma/src/app/`.

## 1. The rules

- **One return, one currency.** It is the currency of the return's PO. Once a receiving document is picked, receipts from a PO in another currency can't join that return.
- **The rate is the receiving-day rate.** Sending goods back reverses their receipt, and a receipt reverses at the rate it was booked at.
  - A return converts to dollars at its receipt's rate.
  - A return that unwinds receipts from different days converts each receipt's share at that receipt's own rate. The hover lists each one.
  - Receipt dates are the ones Linked Records shows, so the two tabs agree.
- **Totals across returns are in dollars.** Each return's amount is converted at today's rate before they are added. These are open amounts, not yet settled.
- **Amounts are stored as the PO priced them.** The seed's figures are read in the PO's currency, and nothing is restated.

## 2. The touchpoints

| Where | What it does | Code |
|---|---|---|
| Create New RMA → step 4, Receiving documents | Each receipt shows its PO's currency: "PO 11151, 11152 · GBP · Received Dec 15, 2024". Once one receipt is picked for a vendor, receipts from a PO in another currency are greyed out. Their tick box and quantity are disabled, and the hover says "This receiving is from a PO in EUR. Start a separate return for it." The receipt link still opens. Select-all only takes receipts in the return's currency, and the tie handler refuses one in another currency with the same message. | `components/rma/ReturnConfigureItems.tsx` `renderDocRow`, `currencyLock` prop; `components/CreateInvoiceScreen.tsx` `currencyLockFor`, guards in `setTieQty` and `setAllTies` |
| Create New RMA → step 5, Credit or refund | Paid, Total, Refund/Credit total and Total Charges, plus the charge amount field, read in the return's currency. That is the picked receipts' PO currency; for a line going back untied, it is the PO its line item came on. | `components/rma/ReturnResolutionStep.tsx` (`ResolutionTarget.currency`), `components/vendors/AdditionalChargesPanel.tsx` (`currency` prop) |
| Return page → Record details | "Currency: GBP (from PO 11151)", under Source PO | `components/invoice-details/InvoiceDetailSidebar.tsx` |
| Return page → Return Items | Price Per Unit ("£30.23 per FT"), Credit or Refund value, Total and the Return value footer read in the PO's currency. The hover shows dollars, the rate and the receiving date (Rec-1415). | `components/invoice-details/LineItemsTab.tsx` with `components/currency/Money.tsx` |
| Return page → Return Summary | The return value, each Refund / Vendor credit / Reversed / Written-off line, each charge and Total charges, with the same dollars hover | `components/invoice-details/InvoiceDetailSidebar.tsx` |
| Return page → GL Impact | A rate line names each receipt, its receiving date and its rate: "Rec-1415 received Sep 14, 2026 · 1 GBP = $1.2683 USD · Mid-market". Every amount shows pounds with dollars under it: the strip, each step, each posting, totals, Where it lands and the clearing balance. Each step's dollars are split so it still balances in both currencies. | `components/invoice-details/GLImpactTab.tsx` (`InBoth`, `baseSplit`) |
| Actions → Print RMA, Download RMA | The vendor's document: "Currency: GBP (Pound Sterling)" in its header, and every amount in pounds | `components/invoice-details/SendToVendorModal.tsx` |
| Communication tab | Still a "Coming soon" placeholder with no amounts. The Activity tab and the action toasts, which do carry amounts, read in the return's currency. | `components/invoice-details/RMANotesTab.tsx`, `ActivityTab.tsx`, `InvoiceDetailScreen.tsx` |
| Vendor Returns → insights | Expected refund value and In shipping are added up in dollars after converting each return at today's rate. Hovering the figure (or In shipping's subtitle, which carries its money) shows the split and how it was added: "€424.87 + £1,142.27 + $6,606.14" and "$8,509 in dollars, each currency converted at today's rate before adding up." | `components/RMAInsightsPanel.tsx` (`computeHover`), `components/DraggableRMAKpiCard.tsx` (`hover`) |
| Vendor Returns → filters | A Currency filter, in the filter bar and the Filters dialog, with a count per currency, e.g. "GBP, Pound Sterling 3" | `components/RMAListScreen.tsx` |

Every money formatter on the return page read `currency === 'USD' ? '$' : 'GBP '`. They now use the shared one (`currency/money.ts` `formatMoney`), which writes £30.23 and €980.50.

## 3. Currency code

| File | What it holds |
|---|---|
| `currency/currencies.ts`, `money.ts` | The Currency Library and money formatting, as in the Vendor Invoicing touchpoint, with the base set to USD |
| `currency/rates.ts` | Mid-market rates in dollars per unit, the same as the Chart of Accounts touchpoint's (its `CURRENCY_META`), so the shell's two USD modules agree. The history is generated the same way: a fixed series that passes through the last month-end revaluation rate and ends on today's rate. Also `MoneyFx` and `toBase`. |
| `currency/poCurrencySeed.ts` | Which POs are in which currency (below) |
| `currency/returnCurrency.ts` | `poCurrency`, `rmaCurrency`, `receiptCurrency`, `returnReceipts`, `returnFx` (the receiving-day rate, or each receipt's), `sumInBase` (dollars and the split), `otherCurrencyReason` |
| `components/currency/Money.tsx`, `FxCard.tsx`, `CurrencyChip.tsx`, `FlagImage.tsx` | The money hover and flags, as in Vendor Invoicing. The hover lists each receipt's rate when there are several. |

## 4. Seed data

- **Crestwood Carriers** trades in three currencies. PO 11151 and 11152 are in GBP; they were received together on Rec-1385. PO 11153 is in EUR, and the rest are USD. Its return RMA-01016 is on PO 11151, so it is in GBP. Picking Rec-1385 in step 4 greys out the EUR and USD receipts.
- **Vantage Fabrication Works and Arbor Precision Engineering** are in GBP (RMA-01002, RMA-01014). **Redstone Machining Co. and Oakmoor Transport** are in EUR (RMA-01006, RMA-01024). Their `Vendor.currency` says so, which the vendor descriptions read.
- **RMA-01024** unwinds three receipts from different days, so its amounts convert at each one's rate.
- **Everything else is in USD.**

## 5. Not in this step

The pasted list puts these "later, once invoices in other currencies are allowed":

- **Log settlement.** Expected, Amount and Still outstanding should show in the PO's currency; "Deposited to" should only list pound or dollar accounts; a dollar account adds a "Dollars received" field and works out the rate. For now its amounts and the Amount prefix follow the return's currency (£), and nothing else has changed.
- **GL Impact, "Exchange difference" step.** A refund or credit landing at a different rate posts the gap to FX Gain/Loss.
- **Close return on a credit return.** Confirm the credit in the PO's currency, and send any rate gap to FX Gain/Loss when it's used on an invoice.

Also not changed:

- **Earlier create-flow steps.** The vendor and item cards there that show a value (`ReturnSummaryPanel`, `ReturnItemCard`, `ReturnVendorCard` and others) still write `$`.
- **The by-item route.** Its step numbers differ because the Vendor step is skipped: Receiving documents is step 3. The rules are the same.
- **Serialized lines.** They pick their receipts on the units step. Those picks count toward a vendor's currency lock, but that step doesn't grey anything out.
