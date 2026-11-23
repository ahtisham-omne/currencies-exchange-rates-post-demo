# Welcome to your Lovable project

TODO: Document your project here

## Touchpoints

The modules under Items & Inventory, Partners Management, Supply Chain Management, Sales and Company Setup, and Chart of Accounts, General Ledger and Vendor Invoices under Accounting & Finance, are touchpoint apps. Each lives in `touchpoints/<name>/` as its own Vite app and opens inside this app's layout.

The app serves each touchpoint from its built copy in `public/touchpoint-apps/<name>/`, so Lovable and any deploy show them with no extra setup.

### Run locally

```sh
npm install --legacy-peer-deps
npm run touchpoints:install   # once, for live editing of the touchpoints
npm run dev                   # main app + a live, hot-reloading server per touchpoint
```

### Change a touchpoint

1. Edit its source in `touchpoints/<name>/src`. `npm run dev` shows the change live.
2. Run `npm run touchpoints:build` to rebuild the copies in `public/touchpoint-apps/`. To rebuild only some, name them: `npm run touchpoints:build -- vendor-invoicing`.
3. Commit the source change and the rebuilt copy together, then push.

Lovable and deploys show the built copy, so a change that isn't rebuilt doesn't appear there. `npm run dev` warns when a built copy is older than its source.

### The rate provider's link

"Open Exchange Rates" links to [openexchangerates.org](https://openexchangerates.org) wherever it's shown on screen, opening in a new tab:

- **The shell's pages:** `SourceLink` in `src/app/pages/exchange/SourceLink.tsx`.
- **Every module:** `ProviderLink` and `linkProvider` in its `components/currency/ProviderLink.tsx` (`components/ProviderLink.tsx` in Chart of Accounts). Rate hover cards (`FxCard`'s rate-type line), rate cards and rate lines all go through it.

Printed documents, message text and plain tooltips keep the name as plain text.

### Currency Touchpoints Map (24 Nov 2026)

The product team's *Currency Touchpoints Map* set one pattern across Partners, Items, Purchase Orders, Quotes, Sales Orders, Vendor Invoicing, Vendor Payments and Vendor Returns. Each module's doc has a dated section for it, with what changed and where:

- **Amounts in PKR, the base currency,** with the document's own amount and rate on hover. A foreign document, partner or line carries a currency tag; KPIs are in PKR with no hover.
- **Document headers** show the partner's name, the currency tag and a Currency button. The Base | Vendor (or Customer) Currency toggle is gone.
- **A currency block** ends each summary: Vendor receives / You pay (Customer pays / You receive on quotes and sales orders, Vendor invoiced on invoices, Vendor settles / Comes back today on returns), Base equivalent when the account isn't in PKR, FX variance where there is one (+ gain, − loss), the rate and its date, and a Locked or Unlocked chip. A document locks when it's confirmed (POs, sales orders), sent (quotes), posted (invoices, payments), completed (receiving docs) or settled (returns).
- **You pay and You receive are bank or cash accounts,** in PKR or the document's currency only (the same account list as Vendor Payments).
- **Rate choices** read "Keep version 1's rate" / "Use today's rate", "Keep the quote's rate", "Keep the current rate" / "Use Nov 25's rate".
- **Printed documents** are in the document's currency: "Grand Total (USD)", "Total (USD)", and "All amounts in United States Dollars (USD)."
- **Pricing rules are in PKR,** with no currency picker. Seeded dollar amounts are restated ×280 (a tier ending at $4,999 ends at ₨1,399,999). A value threshold is checked in PKR at the document's rate, and a fixed amount converts at that rate.
- **New here:** the Purchase Order's Receiving Docs tab (each doc's value and rate), the partner group's and partner's Default exchange rate (Mid-market or Corporate), and the Edit Partner warning when its currency changes.
- **Follow-up pass, same day** (an audit of every touchpoint against the map):
  - **Quote → sales order:** a converted quote now opens in Sales Orders as a Draft order. It carries the quote's currency, the rate picked, the pay-to account and its lines at list price. Sales Orders reads the record Quotes writes (`omne.quotes.convertedToSalesOrder`, `sales-order/.../so/quoteConversions.ts`).
  - **Partners:**
    - The Edit Partner currency warning now opens on Save Changes, not when you pick the currency.
    - Payment terms show a "Term / Set as / On a USD PO" table.
    - Payment Methods discounts and charges are percentages only.
    - Create Pricing Rule shows the "On a USD PO for $3,000" worked example.
  - **Items:** the Mid-market | Corporate switch always shows for a foreign vendor. Corporate is disabled until finance sets a corporate rate.
  - **Purchase Orders:**
    - The restore dialog reads "Restore version N".
    - The catalog's cart prices have the hover card.
  - **Vendor Invoicing:**
    - Invoices and payment history hide the old Currency column by default; the vendor's tag and the PKR amount carry it.
    - Payment blocks always show the rate-type chip.
    - After "Use Nov 25's rate", Edit Invoice names the date and shows the Unlocked chip in its header.
  - **Returns:** vendor charges show their "−" again, with a Total charges row.

### Vendor Invoicing

Vendor Invoicing is the redesigned app from [`vendor-invoicing-payments`](https://github.com/ahtisham-omne/vendor-invoicing-payments), added as a squashed subtree. [docs/vendor-invoicing-currency-touchpoints.md](docs/vendor-invoicing-currency-touchpoints.md) records:

- its currency and exchange-rate touchpoints;
- where each is defined;
- how the earlier touchpoint maps onto it;
- how to pull later design changes.

### Partners

Partners is the redesigned app from [`partner-management-module`](https://github.com/ahtisham-omne/partner-management-module), added as a squashed subtree. [docs/partners-currency-touchpoints.md](docs/partners-currency-touchpoints.md) records:

- its currency and exchange-rate touchpoints;
- where each is defined;
- how the earlier touchpoint maps onto it;
- how to pull later design changes.

### Purchase Orders

Purchase Orders is the redesigned app from [`Purchase-Order`](https://github.com/ahtisham-omne/Purchase-Order), added as a squashed subtree. [docs/purchase-orders-currency-touchpoints.md](docs/purchase-orders-currency-touchpoints.md) records:

- its currency and exchange-rate touchpoints;
- where each is defined;
- how the earlier touchpoint maps onto it;
- how to pull later design changes.

### Items

Items is the redesigned app from [`nimble-palette`](https://github.com/ahtisham-omne/nimble-palette), added as a squashed subtree. [docs/items-currency-touchpoints.md](docs/items-currency-touchpoints.md) records:

- its currency and exchange-rate touchpoints;
- where each is defined;
- how the earlier touchpoint maps onto it;
- how to pull later design changes.

### Sales Orders

Sales Orders is the redesigned app from [`Sales-Order-V5`](https://github.com/ahtisham-omne/Sales-Order-V5), added as a squashed subtree. [docs/sales-orders-currency-touchpoints.md](docs/sales-orders-currency-touchpoints.md) records:

- its currency and exchange-rate touchpoints;
- where each is defined;
- how the earlier touchpoint maps onto it;
- how to pull later design changes.

### Quotes

Quotes is the redesigned app from [`quote-craft-hub-82`](https://github.com/ahtisham-omne/quote-craft-hub-82), added as a squashed subtree. [docs/quotes-currency-touchpoints.md](docs/quotes-currency-touchpoints.md) records:

- its currency and exchange-rate touchpoints;
- where each is defined;
- how the earlier touchpoint maps onto it;
- how to pull later design changes.

### Chart of Accounts

Chart of Accounts is the app from [`chart-of-accounts-general-ledger-v2.1`](https://github.com/ahtisham-omne/chart-of-accounts-general-ledger-v2.1), added as a squashed subtree in `touchpoints/chart-of-accounts/`. It covers both Chart of Accounts and General Ledger under Accounting & Finance:

- Shell paths are `/accounting` plus the app's own path: `/accounting/chart-of-accounts`, `/accounting/general-ledger`, and the Setup screens (`/accounting/numbering`, `/accounting/merge`, `/accounting/fiscal-year`, `/accounting/dimensions`).
- `src/embedding.ts` holds everything it needs to run inside the shell. Its own sidebar is hidden, and its "Accounting" crumb opens the shell's Accounting overview.
- **Currency touchpoints** (`lib/currencies.ts`, `lib/fxRates.ts`, `lib/fxExamples.ts`, the hover cards in `components/AccountTable.tsx`, `components/NewJournalEntryModal.tsx`). The base currency is USD.
  - **Foreign-currency accounts** (11160 Savings - Barclays in GBP, 11170 EUR Account - Deutsche Bank) show a balance hover with three things: the balance in the account's currency, what is booked in USD, and when it was last booked. When part isn't booked yet, the hover adds the amount at today's rate, "Not yet booked" and "Books to FX Gain/Loss at period end." There is no realized/unrealized split (Mahreen, 20 Nov 2026). A rise is a gain on the debit side (an asset's balance, a debit line) and a loss on the credit side. A pegged currency says there's nothing to book. Line amounts in a journal entry have the same hover.
  - **The account page's Foreign closing balance trend** shows only the Currency under the chart.
  - **Sample entries in another currency:** JE-2026-7686 (GBP, on 11160, mid-market rate) and JE-2026-7685 (EUR, on 11170, corporate rate).
  - **A new journal entry in another currency** takes one currency for all its lines. A foreign account only goes on an entry in its own currency. The rate caption names who set a corporate rate (`CORPORATE_RATES`, Ahtisham Ahmad as in Currency & Exchange Rates), or reads "…, the entry date" for mid-market.
  - Store version 15 reseeds demo data saved by an earlier build.

To pull later design changes:

```sh
git subtree pull --prefix=touchpoints/chart-of-accounts https://github.com/ahtisham-omne/chart-of-accounts-general-ledger-v2.1.git main --squash
npm run touchpoints:build -- chart-of-accounts
```

### User Access Control

User Access Control is the app from [`User-Access-Control`](https://github.com/ahtisham-omne/User-Access-Control), added as a squashed subtree in `touchpoints/user-access-control/`. It holds Company Setup:

- Shell paths are the app's own: `/company-settings` (the Company Setup overview), `/company-settings/general`, `/company-settings/user-access-control` with its user and role pages, `/company-settings/data-imports`, and `/company-settings/security/mfa-policy`.
- The sidebar lists Company Setup as the app's own sidebar does. Alert Settings, Module Defaults and Security Settings are other prototypes and open in a new tab, as there.
- `src/embedding.ts` holds everything it needs to run inside the shell. Its own sidebar is hidden, root-relative links resolve against its base path, and its public files (the View in Module screenshots, the import templates) load from it.
- **General Settings** (`/company-settings/general`, `src/app/components/general-settings/`) is the Company Profile tab of the General Settings prototype ([alert-settings-omne](https://alert-settings-omne.lovable.app/company-settings/company-profile)), built in UAC: Company Information, Account Owners (read from UAC's Account Owner role) and Global Preferences, each with its Edit dialog. Storage and Activity Log stay in the prototype.
  - **The currency touchpoint:** Global Preferences' "Default Display Currency" is the company's **Base Currency**, PKR to start. Edit Global Settings changes it with the currency dropdown every module uses (`components/currency/CurrencyDropdown.tsx`, ported from Partners: flag and "PKR, Pakistani Rupee", searchable by code, name or country). The Country of Legal Registration picker is the same dropdown over 250 countries.
  - It isn't locked here (Mahreen, 20 Nov 2026). Its info tooltip, on the page and in the dialog, says "You can change this until your first posting to the general ledger. After that it locks, because every amount in your books is kept in this currency." (`general-settings/copy.ts` `BASE_CURRENCY_TIP`).
  - Edits last for the session, like the rest of UAC's sample data. Changing the base currency here doesn't re-base the other modules, which keep PKR.

To pull later design changes:

```sh
git subtree pull --prefix=touchpoints/user-access-control https://github.com/ahtisham-omne/User-Access-Control.git main --squash
npm run touchpoints:build -- user-access-control
```

### Vendor Returns (RMA)

Vendor Returns is the RMA app from [`rma-web-builder`](https://github.com/ahtisham-omne/rma-web-builder), added as a squashed subtree in `touchpoints/rma/`. It sits under Supply Chain Management, after Purchase Orders, as the Omne navigation places it:

- Shell paths are `/supply-chain` plus the app's own path: `/supply-chain/rma` (the returns list) and `/supply-chain/rma/<RMA number>` (a return's page).
- **It is a TanStack Start app**, unlike the other touchpoints. Its `vite.config.ts` (left as the design repo ships it, so Lovable keeps running it) builds a server, while the shell serves every module as static files. So the shell runs and builds it as a single-page app instead:
  - `vite.touchpoint.config.ts`, named by `"viteConfig"` in `touchpoints.json`, which `npm run dev` and `npm run touchpoints:build` pass to Vite.
  - `index.html` and `src/touchpoint.tsx`, which render the same routes under the shell's base path.
  - Upstream's own `vite dev` and build don't use them.
- `src/embedding.ts` holds everything it needs to run inside the shell:
  - Its own sidebar is hidden.
  - Its "Supply Chain Management" crumb opens the shell's Supply Chain overview, standing in for the app's own overview.
  - A return opened in a new tab gets the shell's page.
- A refund payment opened from a return's Linked Records goes to the app's own `/payments-v2` path. The shell sends that, and `/prepayments`, to Vendor Payments.
- **Currency:** a return is in its PO's currency, shown in PKR at the receiving-day rate with the return's amount on hover; what the vendor settles is valued at the settlement day's rate, and the gap is the FX variance. [docs/rma-currency-touchpoints.md](docs/rma-currency-touchpoints.md) records the touchpoints (create flow steps 4 and 5, the return page, GL Impact, the printed RMA, the listing's insights and Currency filter), where each is defined, the seed, and what is left for later.

To pull later design changes:

```sh
git subtree pull --prefix=touchpoints/rma https://github.com/ahtisham-omne/rma-web-builder.git main --squash
npm run touchpoints:build -- rma
```
