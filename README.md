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
- Its currency and exchange-rate touchpoints aren't added yet.

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
- **Currency:** a return is in its PO's currency, with dollars on hover at the receiving-day rate. [docs/rma-currency-touchpoints.md](docs/rma-currency-touchpoints.md) records the touchpoints (create flow steps 4 and 5, the return page, GL Impact, the printed RMA, the listing's insights and Currency filter), where each is defined, the seed, and what is left for later.

To pull later design changes:

```sh
git subtree pull --prefix=touchpoints/rma https://github.com/ahtisham-omne/rma-web-builder.git main --squash
npm run touchpoints:build -- rma
```
