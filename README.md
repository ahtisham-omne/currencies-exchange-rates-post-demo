# Welcome to your Lovable project

TODO: Document your project here

## Touchpoints

The modules under Items & Inventory, Partners Management, Supply Chain Management, Sales and Vendor Invoices are touchpoint apps. Each lives in `touchpoints/<name>/` as its own Vite app and opens inside this app's layout.

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
