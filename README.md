# Welcome to your Lovable project

TODO: Document your project here

## Touchpoints

The modules under Items & Inventory, Partners Management, Supply Chain Management and Sales, and Chart of Accounts, General Ledger and Vendor Invoices under Accounting & Finance, are touchpoint apps. Each lives in `touchpoints/<name>/` as its own Vite app and opens inside this app's layout.

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
