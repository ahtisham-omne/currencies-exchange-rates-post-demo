# Currency review changes: implementation plan (27 Nov 2026)

Sources:
- Mahreen's DM to Mahad, 27 Nov 2026: one reply per module, each with a mockup.
- Eli's rate ruling, 26 Nov 2026, in the providers thread: one daily market rate per day, and every entry takes the rate of its posting date.

Nophil wants the modules ready for **Monday's review**. Mahreen asked us to do the **Do** points first.

This plan builds on last round's work (the 25 Nov review list), which is still uncommitted: about 215 paths.

---

## Decisions to confirm first

Each decision below has my recommendation. They decide how several steps get built.

| # | Decision | Recommendation | Why |
|---|---|---|---|
| D1 | Which currency the line items on a sales order, quote or PO open in | **The document's own currency (the customer's or vendor's).** The Base \| Party switch stays. The partner overview keeps opening in base (R4). | Mahreen's mockups for sales orders and POs all show USD/EUR lines with a "Prices in USD/EUR" chip, and Nophil says the vendor's currency is invisible. Today they open in base (our R7, 25 Nov). If we keep base, the chip names the document's currency and the column headers follow the view. |
| D2 | Sample rates and dates | **One rate calendar for every app.** Rates are read once a day with today's date. The corporate rates come from the Exchange rates page (USD ₨281.50). We keep our own data rather than copying the mockup figures (₨280.00, 1.4005 CAD, 1030 · RBC Business). | Today the touchpoints stop their rate history on 10 Apr 2026. The host reads "today", and USD's corporate rate is 279.00 in the touchpoints but 281.50 on the rates page. |
| D3 | Number and date formats | **Ours:** ₨, rates to 4 decimals (R27), "Nov 27, 2026", purple and amber rate-type dots. Mahreen's wording is otherwise used as written. | The mockups use "Rs", 2-decimal rates and "27 Nov 2026". You asked to stay in our UI patterns. |
| D4 | Sales order and quote line totals | **Line Total = qty × price.** Pricing rules and one-time adjustments apply only in the Order summary. Each line's breakdown hover still lists them. | Mahreen: "each line total equals quantity × price". Today the line adds rules and adjustments, but Subtotal is qty × price, so the lines never sum to it. |
| D5 | Rate type labels | **"Daily market rate \| Corporate rate"** on every toggle, chip and dropdown. | Ruling 1a. This also fixes the "daily market rate rate" duplicates where code appends " rate". |
| D6 | How much to build before Monday | **Do points, then Proposed, then the two Waiting-on-Eli items (2c, 4d), built as proposals to decide on Monday.** 5e (balances) stays out. | Nophil asked to see the per-currency prices on Monday. |
| D7 | Paying a USD invoice from a CAD account (7c) | **Build it.** It means opening payment rules 3, 4 and 8 to third-currency accounts. | Mahreen marked it Do. Today the rules only allow the invoice's currency or base. |
| D8 | Vendor currency colour on Create PO (still open from last round) | **The brand-tint chip (variant 1) by default.** Keep `?ccyAccent=1\|2\|3` until Monday so Nophil can compare, then remove it. | Mahreen's PO-1 mockup is a chip in the brand tint. |
| D9 | Last round's uncommitted work | **Commit it as its own commit before starting.** | Keeps this round's diff reviewable. Not done yet: only on your word. |

---

## Phase 0: foundations (every app, one writer, in order)

### 0.1 One rate calendar (D2): size M, highest risk

**Change**
- In each touchpoint's `currency/rates.ts` (7 copies: items-v2, partners, purchase-order, quotes, rma, sales-order, vendor-invoicing), `LAST_SYNC` comes from the demo clock: today, read early morning. Today it is fixed at `2026-04-10T14:30:00Z`.
- The daily history then ends today.
- In the host's `src/app/data/demoClock.ts`, move the read time from 13:00 UTC to early morning. Before 6 PM PKT the page would otherwise say the rates were read yesterday.
- Align the corporate seeds across the host, the 7 touchpoints and the plugin kit.

**What this fixes**
- A seeded order older than 10 Apr reads a different point of the history each day, because its date is counted back from the real date. This is the "price changed by itself" (SO-004 GBP, SO-010 JPY, SO-017 EUR, SO-023 AED, SO-028 USD).
- It gives real, different rates on different November days. The invoice "Received 18 Nov / Billed 25 Nov" lines (6c) and the payment breakdown (7a) need that. Today every date after 10 Apr returns the same rate.

**Check:** today's rates stay the same (USD 278.52). Only past dates move. Every type-check and test must stay at its baseline, because tests that pin a historical rate may need new numbers.

### 0.2 Rename "Mid-market" to "Daily market rate" (1a, D5): size L but mechanical

About 600 mentions across the apps, the plugin and the docs. Most are comments, which can stay. The UI copy runs through one label per app:

**One edit per app:** `RATE_TYPE_LABEL` becomes `{ mid: 'Daily market rate', corp: 'Corporate rate' }` in each touchpoint's `currency/rates.ts`, and `RATE_KIND_LABEL` in chart-of-accounts `src/lib/fxRates.ts`.

**Call sites that append " rate" (they would print "rate rate"):**
- PO: `POReceivingDocsTab.tsx` 65–68 and 239
- RMA: `LogSettlementModal.tsx` 479
- SO: `SOCurrencyFields.tsx` 385, `SOCurrencyConfig.tsx` 97
- Quotes: `QuoteCurrencyFields.tsx` 304
- Partners: the three places that add " rate" after the label

**Hard-coded copy:**
- Host: `rateCopy.ts` (RATE_TOOLTIPS, EXPLANATORY_BLOCKS, MID_MARKET_DETAIL_TOOLTIP, CONVERTER_*), the tab and banner, `libraryConfig` columns, the pair and currency detail pages, `pairInsights` KPIs, `CorporateRateForm` ("Mid-Market Reference"), the converter, `rateLifecycle`, the activity log text, seeds and export names.
- VI: about 30 strings in the currency config, payment fields, the record payment flow, the run stage, payment detail, AP settings and GL impact.
- PO: `CompareRatesHover`, `POCurrencyConfig:86`, `poStore:743`, `poVersionDisplay:158`.
- SO and Quotes: `CompareRatesHover`, `SOCurrencyConfig`/`QuoteCurrencyConfig`, the fields files.
- Partners: `KpiInsightsPanel`, `VendorsListPage`, the group modal, `CurrencyPill:41`.
- Items: `SellingSection:277`.
- RMA: `ReturnCurrencyConfig`, `GLImpactTab`, the toast.
- CoA: `NewJournalEntryModal` 594–597, `AccountTable` 1104, 1167, 1192.

**Rewrite, don't just rename:** "The midpoint of global buy and sell rates. Updated from your rate provider at each sync." This is in the host's `rateCopy.ts` and partners' `CurrencyPill.tsx`. It becomes the daily meaning: "Read once a day from Open Exchange Rates, and fixed for that date."

**Keep as they are:** identifiers such as `'mid'`, `midRateOn`, `MidMarketRate`, and saved column keys.

### 0.3 "Read once a day" wording (Eli's ruling, 1b): size M

These stamps become date-only, worded as "Read on Nov 27, 2026":
- Host: "Last updated {date time}", "Last Synced {date time}" and "· as of {date time}".
- VI and PO: `rateAsOfLine` "Rate updated as of {date}, {time}".
- Partners: `MID_RATE_UPDATED`.
- Items: `VendorPriceFields:276` "updated Apr 10, 2026, 7:30 PM".
- CoA: "As of 9:00 AM".

Also:
- Drop "Live" from "Live Exchange Rate Converter".
- Drop "Synced automatically" and `SYNC_FREQUENCY` "Every 30 min" (unused).
- The rate list's "Change" becomes "Change since the previous day".
- "Last Synced" becomes "Rate Date".

### 0.4 One rate hover: the "Default exchange rate" info icon (3a): size M

**Design.** Mahreen's PA-1, in our look:
- Info icon (the app's `InfoTooltip` icon) in a `HoverCard`, built from each app's `FxCard` primitives.
- Title "USD to PKR today", or "on Nov 9, 2026" when the document's rate date isn't today.
- Rows:
  - "Daily market rate · 1 USD = ₨278.5200"
  - "Corporate rate · 1 USD = ₨281.5000"
  - "Gap · ₨2.98 (1.07%)"
- Footer: "Daily market rate read on Nov 27, 2026. Corporate rate set by your company on May 1, 2026."
- A currency with no corporate rate (MXN): "No corporate rate set", and no Gap.
- A base-currency partner or document: no icon.

**Where:**
- Partners: the Currency card in Configure › Billing & Shipping, the partner group's Currency, and the partner page's Financial Summary line.
- The Currency configuration modals in PO and VI (Mahreen), and in SO and Quotes for consistency.

It replaces last round's ArrowLeftRight "Compare rates" hover in SO and PO. Each app keeps its own copy, as with `FxCard`.

---

## Phase 1: the Do points, by module

Once Phase 0 lands, each module touches only its own app folder, so modules can run in parallel, one agent per app, as last round.

### Exchange rates (host `src/`)

- **1a. Tab** (`ExchangeRateLibraryPage.tsx:152`): "Mid-Market Rates" becomes "Daily Market Rates". The sibling tab says "Corporate Rates", so I'm keeping title case. Size S.
- **1b. Info banner under the tabs:** "Read once a day from Open Exchange Rates, and fixed for that date. Today's rates were read on Nov 27, 2026."
  - It replaces the dismissible "midpoint" ExplainerBanner (line 244).
  - Drop the strip's " · Last updated …" (line 74) so the date isn't said twice.
  - Use the plain `Banner`: it's a fact, not a tip. Size S.
- **1c. Company setup:** there is no "Update frequency" anywhere in our prototype, so there is nothing to remove.
  - Add **Default Exchange Rate** (Daily market rate | Corporate rate) under Base Currency in Global Preferences: `GeneralSettingsPage.tsx:120` field, `EditGlobalSettingsModal` `OptionCards`, and a store field defaulting to Daily market rate.
  - It is shown, not wired: each module keeps its own default. Size S.
- **Dead code:** `src/app/pages/Vendor*`, `Partner*` and `Contact*` aren't routed. Partners is the touchpoint, so these files are not touched.

### Items (`touchpoints/items-v2`)

- **2a. No item or category rate setting exists here** (categories aren't in this repo), so there is nothing to remove.
  - Add the info line "The exchange rate comes from the customer and the order, not the item." under "Base price, in PKR." in the Custom Price Per Unit card (`SellingSection.tsx:180`).
  - Use the app's Info icon and 12px helper style. Size S.
- **2b. Qualified vendors:** rename only, through the label.
  - Add "For reference only: the PO sets the rate it uses." to the vendor price hover, as a note on that hover only. The shared `MoneyCard` also drives the Credit Limit and Sales hovers, so it isn't edited.
  - Mahreen's "no change" describes her design, which differs from ours. See Questions for Mahreen. Size S.

### Partners (`touchpoints/partners`)

- **3a.** The rate hover from 0.4 goes in three places:
  - next to "Default exchange rate" in `CreatePartnerModal.tsx:6474`, replacing `InfoTooltip`
  - next to "Default exchange rate" in `CreatePartnerGroupModal.tsx:5967`
  - on the partner page line `VendorDetailsPage.tsx:3811` ("Daily market rate by default", plus the icon)

  Size M.
- **3b. Sales overview.** The KPIs already open in base (last round). Changes:
  - The switch gets a visible "Show amounts in" label and the codes: "Base (PKR) | Partner (MXN)". Same component, new labels.
  - "≈" goes before converted values in base view, with the partner's own amount as a small line under each KPI (`CurrencyAmount` gets an `approx` option; `DraggableKpiCard` gets a sub-value).
  - Footnote under the KPIs: "≈ at today's daily market rate: 1 MXN = ₨16.4300".
  - The KPI set stays customisable as it is. Mahreen's "Orders this year" has no dated data behind it.

  Size M.
- **3c. Demo data.** "Grupo Norte" doesn't exist. Our only MXN partner is **General Motors (v-003)**: country Mexico, but billing address Detroit, US.
  - Proposal: make it a Mexican customer, "General Motors de México" with a Mexico billing address, so country, address and currency agree.
  - The "China" and "$1" Mahreen saw don't reproduce: v-003 shows Mexico and ₨419,132.65. UPS (v-002) is the "China" partner, and the location quick view picks a country by hash. Ask Mahreen where she saw them.
  - While there, fix the Avg. Order Value KPI's hard-coded "↘ 240" change.

  Size S.

### Sales orders and quotes (`touchpoints/sales-order`, `touchpoints/quotes`)

- **4a. Line items footer.** A **Total** footer row goes at the end of the line items card (`SOLineGrid.tsx` after `</tbody>`; Quotes `ItemsTabTableClean.tsx`). It equals the Subtotal (D4).
  - A small convert icon (ArrowLeftRight) opens a hover with:
    - "$1,860.00 ≈ ₨518,047.20"
    - Rate type · Rate · Rate date (the order's rate date)
    - "Estimate. Nothing posts from a sales order." ("…from a quote." on quotes)
  - No icon on base-currency orders: `useDocCurrency().fx` is null there.

  Size M.
- **4b. Demo data that agrees** (Nophil's "before Monday"):
  1. D4: line Total = qty × price (`SOLineGrid.tsx:697–702`, Quotes `ItemsTabTableClean.tsx:1339–1344`). The breakdown hover still lists the line's rules and adjustments, "applied in the order summary".
  2. Prices drifting by themselves: fixed by 0.1.
  3. Regional price seeds that contradict list prices (from last round): the stretcher has an $18,500 list price but a $1,395 USD price. Item 000-100-195 is $1,375 on directly created USD orders and $2,150 on quote-sourced ones. Fix: set each regional price close to the converted list price.
  4. Quotes' seeded one-time adjustments are fixed amounts (+$2,400 and +$1,350). Make them percentages, as SO got last round.
  5. Box, Pallet and Drum lines carry a per-EA price. Make the price per UoM.
  6. Add an Order summary row "Currency: USD, from the customer", reusing `SOCurrencyHeaderControls`' copy.
  7. Then audit every seeded SO and quote in the customer's currency: lines, summary, listing and linked invoices.
  - Coastal Search & Rescue is JPY on purpose (SO-010, SO-025). Ask Mahreen which order showed yen.

  Size M–L.

### Purchase orders (`touchpoints/purchase-order`, PO surfaces only)

- **5a.** A "Prices in EUR" chip (Globe icon, brand tint) after "Line Items" (`PurchaseOrderDraft.tsx:1673`).
  - It's a new `PricesInChip` beside `VendorCurrencyTag`, sharing its `CCY_ACCENT` variants (D8).
  - Headers become "Price Per Unit (EUR)" and "Total (EUR)", following the view currency (lines 1797–1801). Widen the 124px columns.
  - A PKR PO gets no chip.

  Size S–M.
- **5b. The modal already has a single "You pay in" account dropdown and no pay-currency dropdown.** Changes:
  - A currency chip on every option and on the trigger (`CurrencyPill`).
  - The vendor's default account first, tagged "From vendor". No vendor has a default pay-from account today, so this needs a new `VENDOR_PAY_FROM` map (else 1010), passed into `payFromAccountsFor`, `resolvePayFrom` and Reset.
  - The **Vendor receives** currency picker stays. It changes the PO's own currency, which isn't what Mahreen struck out.

  Size M.
- **5c. Currency information** when paying from another currency's account (po-4). The rows become:
  1. Vendor receives $X [USD]
  2. You pay in 1075 · CAD Settlement
  3. You pay ≈ C$…
  4. Exchange rate 1 USD = 1.3935 CAD, with the "Daily market rate" chip under it
  5. Base equivalent ≈ ₨…, with "Estimate at today's rate" under it

  `CurrencyBlockRow` gets a sub-line; the defaults stay for `POReceivingDocsTab`. The "USD to PKR" and "CAD to PKR" rows were already removed on 25 Nov. Also fix the tooltip that calls the cross rate "the PO date's". Size S–M.

### Vendor invoices (`touchpoints/vendor-invoicing`)

- **6a. Invoice list.**
  - Rename "Amount (PKR)" to **Base equivalent**. Posted invoices show their fixed base amount with no ≈. Unposted ones (Pending Approval) show ≈ at today's rate. Use a new cell; `TodayBaseCell` stays for payment runs.
  - Add a `summary` slot to `DataTable` for the footer, over the filtered rows (not the page):
    - left: "By currency: AED 43,400.00 · €12,000.00 · …"
    - right: "Total in base ≈ ₨…"

  Size M.
- **6b. Currency information.**
  - "Vendor invoiced" gets a lock icon and "From the vendor's invoice {vendor invoice no.}".
  - The rate gets "Posting date Nov 25, 2026".
  - Base equivalent gets "Follows the posting date's rate".
  - Per Eli, a new invoice's posting date defaults to the **vendor's invoice date**, not today (`CreateInvoiceScreen.tsx:1335`).

  Size S–M.

### Vendor payments (`touchpoints/vendor-invoicing`)

Record payment is a **full page** in our app (`RecordPaymentFlow.tsx`), not a modal. These go into its Payment Details step, staying in our pattern.

- **7a. Rates.**
  - "Our rate": the daily market rate on the payment date, and its base amount.
  - The required **"Bank's rate \*"** field, with "Enter the exchange rate the bank gave you." It is lifted out of `MarkPaidDialog` into one shared `BankRateField` and replaces "You Pay (PKR)\*".
  - The breakdown, from `realizedFxOf`: Invoice booked at, Bank took at, Rate change since invoice, Bank's rate vs ours, FX variance.
  - `MarkPaidDialog` gets the same field, copy and breakdown.

  Size L.
- **7b. Same currency:** only "Same currency. No exchange rate needed." Size S.
- **7c. Different currency (D7):**
  - Open payment rules 3, 4 and 8 (`paymentRules.ts`), `PayFromAccountModal`'s filter and the dialog's `eligible` to third-currency accounts.
  - Show only "1 USD = 1.3935 CAD · Daily market rate · {date}" and the bank's rate in CAD. No PKR rates.

  Size L.
- **7d. Pay from:** the invoice's currency first (`payFrom.ts:25` sort), and "Add a bank account" at the bottom. Balances and chips already show. Also fix the "A AED account" grammar. Size S.
- **7e. Scheduled payments.**
  - An "Estimate" chip with the rate and the ≈ base amount on scheduled rows, in the invoice's Payments tab and in Payment History.
  - On the payment date, a banner: "PMT-… was scheduled for today. Once it's paid, enter the rate the bank gave you." with **Enter rate**, which opens `MarkPaidDialog`. Mount it on the invoice page.
  - Seed a foreign payment dated today (we number payments PMT-, not PAY-).

  Size M.

---

## Phase 2: Proposed points

- **1d. Rate list columns:** "Inverse Rate" becomes two columns, "1 Unit in PKR" (₨278.5200) and "1 PKR in That Currency" ($0.0036).
  - Use more decimals under 0.01 (R27), so strong currencies don't round to 0.0011.
  - Keep the column keys, so saved layouts survive.
  - Same in the export.

  Size S.
- **1e. Pair detail:** one line "1 USD = ₨278.5200 · 1 PKR = $0.0036" replaces the Rate and Inverse Rate fields. Same in `PairInverter`. Size S.
- **4c. Sales orders and quotes.** In our code the per-line rate shows only inside hovers, never as a chip, so there's nothing to remove.
  - Add "Prices in USD" after "Line Items" and, top right of the card, "Exchange rate: daily market rate · 1 USD = ₨278.5200".

  Size S.
- **5d. PO list:** the list has **no Amount column today**.
  - Add Amount (in the PO's currency) and Base equivalent (≈ at the PO's own rate; plain for PKR POs).
  - Add a currency field on the row and number sorting.

  Size M.
- **6c. FX variance lines:** "Received · Nov 18, 2026" and "Billed · posting date Nov 25, 2026", each with its rate and base amount, plus Mahreen's helper copy.
  - We held this last round. Eli's 26 Nov ruling (posting date = vendor's invoice date) unblocks it.
  - Also update `INVOICE_FX_VARIANCE_TITLE`, which still says "invoice-date rate".

  Size S.
- **7f.** "Rate settles when paid" under the Scheduled status. Size S.

## Phase 3: waiting on Eli, built as proposals for Monday

- **2c. Items, "Other currencies".** It replaces last round's "Regional prices" block.
  - Radio options (the app's `RadioOption`): "Convert from the base price" and "Set a price for each currency", with Mahreen's helpers.
  - A table: Currency | Partner group | Price per unit | In base today, plus an "Add a price" link.
  - Data: an `otherCurrencyPricing` mode, and `partnerGroupId` on each price (null = every group).
  - items-v2 has no customer groups, so seed them locally to mirror Partners' groups.
  - SO's `marketPrice` matches on customer group + currency.
  - Open: should it show for items sold to specific partners too?

  Size L.
- **4d. Sales orders.**
  - "Item's USD price" under a regional price.
  - "Est." chip + price + info icon, replacing the amber Coins icon.
  - Hover: "This item has no USD price. Converted from the base price ₨100.00 at today's daily market rate (1 USD = ₨278.5200)." Worded for a corporate rate or an order date when that applies.
  - Same in the create screen and Add line item.

  Size S–M.

## Phase 4: the connector and the docs

**`plugins/omne-currencies`.** Keep both `rules.md` copies identical.
- Rules:
  - R13: daily market rate, read once a day.
  - R14: the rate per posting date, step by step per Eli.
  - R17: the info-icon hover on partners, groups and the config modals.
  - R19 and R20: Bank's rate and the breakdown.
  - R21, R24 and R26: words.
- Close P3 (Eli) and P4 (Eli: the bank's spread goes to gain or loss). Mark P6 as decided by the chip. Rewrite P1 as "Other currencies".
- Kit:
  - `rates.ts`: labels and `LAST_SYNC`.
  - `CompareRates` becomes the new hover.
  - `BankRateField` gets the breakdown.
  - The `check-doc` regex accepts "daily market".

**`docs/*-currency-touchpoints.md`:** 88 "mid-market" mentions; rename them and note the ruling.

## Out of scope

- 5e: balances in "You pay in" (waiting on Nophil).
- Gating VI to "base only for this release": there is no flag today, and the prototype shows the multi-currency design.

---

## Questions for Mahreen

1. **3c:** where did she see "China" and "$1"? Grupo Norte isn't in our data. Our MXN customer is GM (v-003), which shows Mexico and ₨419,132.65.
2. **4b:** which order showed yen? Coastal Search & Rescue is a JPY customer on purpose.
3. **2b:** our qualified-vendor prices open in base with a hover card, and there is no "Vendor sells in EUR" note. Each qualified vendor also has its own Mid-market | Corporate toggle on the item, which conflicts with "the PO sets the rate". Should that toggle go?
4. **5b:** our modal has no separate pay-currency dropdown. The only currency picker is "Vendor receives", which changes the PO's currency. Keep it?
5. **7a:** Record payment is a full page in our app. Is it fine to build this in its Payment Details step rather than a new modal?
6. **1c:** "Update frequency" doesn't exist in our Company setup. Is adding "Default exchange rate" there what she wants?

## Verification

**Type-check and test baselines** (`npx tsc --noEmit -p tsconfig.app.json`, `npx vitest run`):

| App | Type-check errors | Vitest |
|---|---|---|
| Partners | 37 | — |
| items-v2 | 5 | 73 pass / 2 fail |
| PO | 44 | 10/10 |
| SO | 32 | 1/1 |
| VI | 0 | 28/28 |

Capture Quotes, RMA, CoA and host baselines before Phase 0. Then build each app with `npm run touchpoints:build -- <slug>`.

**Browser walk** (dev server :8080):
- `/accounting/exchange-rates` and a pair page
- Company Settings
- `/inventory/items/13` › Selling and › Purchasing
- `/vendors/v-003` and a partner group
- SO-000-000-004, -013 and -042, and a quote
- po-4, po-15 (EUR), the PO list and the cart
- The VI invoice list, INV-000221, Record payment (same, base and CAD cases), Payment history and the today banner

## Order and size

| Step | Size | Runs |
|---|---|---|
| D9 commit last round | n/a | first, on your word |
| 0.1 rate calendar, 0.2 rename, 0.3 wording | M + L + M | one writer, every app |
| 0.4 rate hover | M | with each module below |
| Phase 1 modules | S to L each | in parallel, one per app |
| Phase 2 | mostly S | in parallel, one per app |
| Phase 3 (2c, 4d) | L + S–M | Items first, then SO |
| Phase 4 plugin and docs | M | last |
| Browser walk and screenshots | n/a | last |

The biggest pieces are the 0.2 rename, 7a/7c (payments) and 2c (Other currencies). The riskiest is 0.1, because it moves every historical rate in every app.

---

## Status, 27 Nov 2026: built

Everything above is built, on the decisions as recommended. 5e (balances on a PO) is held, as planned. Last round's work is committed (`2bf65b92`); this round is not committed yet.

### Where to see each point

| Point | Where |
|---|---|
| 1a, 1b, 1d | Accounting › Currency & Exchange Rates › Exchange Rates: "Daily Market Rates" tab, the read-once-a-day banner, and the columns "1 Unit in PKR" and "1 PKR in That Currency" |
| 1e | `/accounting/exchange-rates/USD?type=mid` › Rate Information: "1 USD = ₨278.5200 · 1 PKR = $0.003590" |
| 1c | Company Setup › General Settings › Global Preferences: "Default Exchange Rate" (shown only; modules keep their own default) |
| 2a, 2c | Items › MOTOR-AC-5HP (#13) › Configurations › Selling: the info line under the base price, then "Other currencies" |
| 2b | #13 › Purchasing › Qualified Vendors: hover a foreign price; it ends with "For reference only: the PO sets the rate it uses." |
| 3a | `/vendors/v-003` › Financial Summary; Edit Partner › Billing & Shipping › Currency; a partner group's Currency. Also the Currency configuration of sales orders, quotes, POs and vendor invoices |
| 3b, 3c | `/vendors/v-003` (now "General Motors de México", Mexican address): the KPI strip |
| 4a–4d | Sales order SO-000-000-013: the "Prices in USD" chip, the rate line, the Total row and its convert hover, the "Est." and "Item's USD price" lines, and the "Currency" row in Order Summary. Quotes: Q-000-000-002 (no 4d) |
| 5a–5c | po-4 (Tesla, USD, paid from 1075 · CAD Settlement): line items, Order Summary › Currency information, View currency configuration |
| 5d | Purchase Orders list: the Amount and Base Equivalent columns |
| 6a | Vendor Invoicing › Invoices: Base Equivalent and the footer |
| 6b, 6c | INV-000217: the right panel, and View currency configuration › FX variance |
| 7a–7f | Vendor Payments › Payment History: the PMT-000124 banner, Enter Rate and the Rate column. Record Payment for INV-000217 (PKR account), INV-000218 (GBP account) and a USD invoice paid from 1075 · CAD Settlement |

### Choices that differ from the plan or the mockups

**Rates and data**
- **Rate history (0.1).** Only Sales Orders and Quotes now end their rate history today. Their seeds are dated back from today, so a seeded order keeps one rate, and this matches the Exchange Rates page.
  - The other modules write their seeds on fixed dates, so their history stays ending on 10 Apr 2026. Moving it would have made their seeded figures change from day to day.
  - Every module says "Read on Nov 27, 2026", and the corporate rates now match the rates page (USD ₨281.50 from May 01, 2026).
- **When rates are read.** The Exchange Rates page now reads rates at the start of the day (00:00 UTC). It used to read at 6 PM, the time in the BA's activity log, which made it show yesterday's rates until the evening.
- **Rate format.** "1 PKR in that currency" shows 6 decimals under 0.01, per R27: $0.003590, where the mockup shows $0.0036. Symbols are ours (₨, and the app's AED symbol).
- **Sales order fixes.**
  - Saving a line in the configurator used to fold pricing rules into its unit price, which then counted again in the summary. That's a likely cause of the price that "changed by itself"; it's fixed.
  - Regional prices are now within about 2% of the catalog price.
  - Box and Pallet lines are priced per unit.
  - All 31 seeded orders were checked: their lines, Subtotal, Grand Total, listing figure and linked documents agree, and stay the same on later days.

**Purchase orders**
- **po-4's rate.** po-4 is a draft, so it is restamped at today's rate. Its "Base equivalent ≈ ₨1,735,758.92" now reads "Estimate at today's rate", the same day as its direct USD to CAD rate.
- **Vendor default accounts.** Tesla's default pay-from account is 1040 · Global FX Settlement (USD); po-4 pays from the CAD account as its own choice. The other vendors default to 1010.
- **The cart** still shows base amounts. D1 covers the PO page and its create flow, not the cart.

**Vendor invoicing and payments**
- **Payment runs** keep the old rule of invoice currency or base. Third-currency accounts are open in Record Payment and Mark as paid only.
- **Record Payment** stays a full page. "Rate settles when paid" sits under its date picker.

### Questions for Mahreen (updated)

1. **3c "China" and "$1".** Neither showed for our peso customer. Possible sources:
   - the location quick view picked a country at random (fixed);
   - the Financial Summary read "Mexican Peso ($)" (it now shows the code).

   Is that what she saw?
2. **4b yen.** Coastal Search & Rescue is a JPY customer on purpose. Which order showed yen?
3. **2b.** Each qualified vendor still has its own Daily market rate | Corporate rate toggle on the item. Should it go, given "the PO sets the rate"?
4. **6a footer.** Should AED read "AED 43,400.00" (code) rather than the app's "د.إ" symbol?
5. **Quotes.** Every seeded quote shows the same 50 design lines, so a quote's listing value matches its detail page only after it is opened. Make every listing value the lines' total, or leave it?
6. **2c.** "Other currencies" shows only for items sold to all partners, because items sold to specific partners have no base price card. Is that right?
