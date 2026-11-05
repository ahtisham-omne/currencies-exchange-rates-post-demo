# Items: currency & exchange-rate touchpoints

Items was redesigned. The new app comes from [`ahtisham-omne/nimble-palette`](https://github.com/ahtisham-omne/nimble-palette), at commit `a91898c` (29 Oct 2026). This record does three things:

1. Lists the currency touchpoints the earlier Items touchpoint had (§1).
2. Maps each one onto the redesign (§2).
3. Says where everything is defined now (§3–§6).

The redesign replaced the earlier touchpoint in `touchpoints/items-v2` as a squashed git subtree. The slug, port (8104) and mount (`/inventory`) are unchanged.

Sources:

- *Currencies & Exchange Rates: where each module changes* (design touchpoint audit, 4 Nov 2026), Items v2, pages 6–7: "Item prices stay in the base currency. Qualified vendor pricing gets the three-field treatment." Five changes, from spec 4.1, 4.2 and 3.5.
- *Currency & Exchange Rates Functional Spec v1.1*, sections 3.5, 4.1 and 4.2 (as the audit cites them).

## 1. The earlier touchpoint (what it had, where)

The earlier touchpoint came from `ahtisham-omne/currency-exchange-rate-items-v2-touchpoint`, at commit `9192baa`. It was a Lovable remix of `nimble-palette` at `06bfa96` (23 Apr 2026). The currency work itself was commits `c85e725`, `aff6b1b` and `9192baa`. Paths are as of commit `440df75` in this repo, under `touchpoints/items-v2/src/app/`.

| Touchpoint | Where it was | What it did |
|---|---|---|
| Currency data | `data/rateConstants.ts` | Its own currency list and mid-market table, base PKR, last sync 4 May 2026 |
| Flags, picker, symbol | `components/modules/CurrencyFlag`, `CurrencyLibrarySelect`, `CurrencySymbol` | A flag per currency, a searchable currency picker, and the base symbol "Rs" with a PKR tooltip |
| Item prices | `components/modules/ItemCreation.tsx`, `SellingSection.tsx` | The base symbol on the custom price per unit and on the selling prices |
| Qualified vendors | `components/modules/QualifiedVendorsTab.tsx` | Sample vendors in USD, EUR and GBP. Their price was shown in base (Rs) with the vendor price and the mid-market rate in a hover |
| Add vendor dialog | `components/modules/AddQualifiedVendorDialog.tsx` | A currency picker per vendor. The base price was the source of truth; the vendor price followed it at the mid-market rate |
| Embedding | `components/layout/AppLayout.tsx`, `main.tsx` (commit `38a9bf8`) | Hid the app's own sidebar and set the router basename |

## 2. Mapping onto the redesign

Paths are under `touchpoints/items-v2/src/app/`.

| Earlier touchpoint | In the redesign | Notes |
|---|---|---|
| Currency data | `currency/currencies.ts`, `rates.ts`, `money.ts` | The same files as Vendor Invoicing, Partners and Purchase Orders: the module's Currency Library, its mid-market history (same seeds, last sync Apr 10, 2026) and its corporate rates |
| Flags | `components/currency/FlagImage.tsx`, `CurrencyChip.tsx` | Flags at the Currency & Exchange Rates size (17×13) |
| Currency picker | Dropped | A vendor's currency is inherited from the partner (spec 4.1, audit item 5). The drawer shows it as a chip |
| Base symbol | `currency/itemMoney.ts` `basePrefix`, `components/currency/BaseCurrencyNote.tsx` | ₨ with a PKR label where an item price is entered, and the "In PKR · base currency" pill on the item overview |
| Item prices | `ItemCreation.tsx` Base Price, `SellingSection.tsx` price tiers | ₨ prefix and PKR label. Item prices are entered and kept in base |
| Qualified vendors | `components/modules/purchasing/QVTable.tsx`, `QVCardList.tsx`, `VendorDetailModal.tsx`, `QualifiedVendorsPanel.tsx` | The redesign's qualified-vendor table on the item's Purchasing tab (§3, items 1–2) |
| Add vendor dialog | `components/modules/purchasing/AddQualifiedVendorModal.tsx`, `components/currency/VendorPriceFields.tsx` | The redesign's Edit Vendors drawer (§3, items 3–5). The vendor price is what is stored, as the design stores it; either price can be typed and fills the other |
| Sample vendors (create-item flow) | `components/modules/QualifiedVendorsTab.tsx` | The redesign's sample vendors have no location, so they are USD. The earlier EUR and GBP samples were not carried |
| Embedding | `src/embedding.ts`, `src/EmbeddingBridge.tsx`, `src/main.tsx`, `components/layout/AppLayout.tsx` | As for Partners and Purchase Orders (§6) |

## 3. The audit's 5 changes (pp. 6–7) and where they are

| # | Change | Where |
|---|---|---|
| 1 | QV table: Credit Limit ($) | `QVTable.tsx` column "Credit Limit", `partnerCells.tsx` `CreditLimitCell`: each limit in the vendor's currency with its code ("¥5,793,448 JPY", "CNY 254,456"). The Browse Vendors table in the drawer does the same |
| 2 | QV table: Units & Pricing in the vendor's currency with the base equivalent underneath | `QVTable.tsx` `UnitsPricingCell` with `components/currency/VendorPrice.tsx`: "£1,155.86 / km", then "≈ ₨410,815.76 PKR". The amount has the rate hover (`Money.tsx`). Last PO price and total are in the vendor's currency too. Sorting compares base values (`QualifiedVendorsPanel.tsx`) |
| 3 | Edit Vendors drawer: price per unit becomes three fields | `VendorPriceFields.tsx`: the price in the vendor's currency (the design's input, with the currency's symbol or code), the exchange rate ("1 EUR = 304.8150 PKR") and the price in PKR. Typing either price fills the other (`priceInBase` / `priceFromBase`, rounded to the currency's minor unit) |
| 4 | The same for every selling unit | Each additional UoM block in the drawer uses the same fields and the vendor's one rate |
| 5 | Drawer header: vendor currency chip; rate read-only on Mid-market, editable on Corporate | `VendorPriceFields.tsx` `VendorCurrencyChip`: flag and code, "inherited from the partner", and a Mid-market / Corporate switch (hidden for a PKR vendor). Mid-market shows today's rate, locked, with a tooltip. Corporate shows finance's rate in an input; a typed rate is kept for the vendor, marked "Entered for this vendor", with a reset. A currency with no corporate rate shows mid-market in the field until one is typed, and a typed one can be cleared. Rate type and typed rate are stored in the vendor's config (`rateType`, `exchangeRate` in `context/purchasing/types.ts`), so they count as unsaved changes, are tagged "Modified" and can be reverted like the design's other fields. A vendor with no rate type saved is on mid-market, so switching to Corporate and back is no change |

## 4. Shared currency code

| File | What it holds |
|---|---|
| `currency/currencies.ts`, `rates.ts`, `money.ts` | As in the other modules |
| `currency/vendorFx.ts` | `vendorCurrencyFor` (partner country → currency), `vendorRate` / `qvRate` (a vendor's rate today, of its type), `priceInBase` / `priceFromBase`, `fromUsd` / `usdToBase` (the design's USD figures restated), `pricePrefix`, `formatWhole` |
| `currency/itemMoney.ts` | Item amounts in base: `baseMoney` (₨6,824.31), `baseWhole` (₨6,824, compact from a million), `baseCompact` (₨34.5M), `basePrefix` |
| `components/currency/Money.tsx`, `CurrencyChip.tsx`, `FlagImage.tsx` | Money with its rate hover; flags |
| `components/currency/VendorPrice.tsx` | A vendor price with its base equivalent underneath |
| `components/currency/VendorPriceFields.tsx` | The drawer's three fields and the header chip |
| `components/currency/BaseCurrencyNote.tsx` | The "In PKR · base currency" pill |
| `components/currency/RuleAmountPreview.tsx` | `RULE_CURRENCY` (USD) and the "≈ €22.84 EUR · at today's rate" line under a pricing-rule amount |

## 5. Data decisions

- **Vendor currencies.** The design's partners have a country and no currency, so each vendor's currency is seeded from its country (`vendorFx.ts` `COUNTRY_CURRENCY`: the audit's example, Adiant in Germany, is EUR). A country not listed trades in USD, as the design priced every vendor in $.
- **Vendor amounts.** The design writes them in USD. Each qualified vendor's prices, tier prices, last-PO figures, price fluctuation and credit are restated once in its currency at the last synced mid-market rate (`context/purchasing/mockData.ts` `inVendorCurrency`); the vendors offered in Browse get their currency and credit limit the same way. US vendors keep the design's numbers.
- **Item amounts** stay in base. The design's USD figures are restated in PKR at the same rate (`usdToBase`): the item overview KPIs (Avg Cost, Total Value, Last Purchase and Sale Price, the open-PO tooltip), the transactions table (Price, Valuations, Change in Valuation, headed "(PKR)" like the "(EA)" quantities), the Top Customers and Primary Vendor widgets, and the legacy list's Total Value. The figures keep their relationships: valuation before − after = change.
- **The vendor's rate** is today's (spec 3.5): mid-market from the Currency Library, or the corporate rate. The base price shown is worked out at it; nothing stores a base price.
- **Pricing-rule fixed amounts** stay written in USD, as Partners and Purchase Orders treat them, and the create form labels them "(USD)". Under an amount it shows what it is in the vendor's currency today (in PKR for a USD vendor).

## 6. Running inside the shell

As for Partners and Purchase Orders, it lives in `src/embedding.ts`:

- The router basename is set in `src/main.tsx`, and `src/EmbeddingBridge.tsx` routes the shell's in-app navigation.
- `components/layout/AppLayout.tsx` hides the app's own sidebar.
- `touchpoints/touchpoints.json` points at the new repo. The shell's Items & Inventory links (`/inventory/items`, `/inventory/vendors`, `/inventory/sales`) are unchanged.

## 7. Not in this step

- **Sales orders shown in Items**: the item's Sales tab and Sales Overview (`/inventory/sales`) list sales orders (`components/modules/SalesOverview/`). They keep the design's `$`; sales orders are the Sales Orders touchpoint's, which has its own currency work.
- **Shipping carrier costs** (`ShippingCarrierCard.tsx`, the carrier column in `partnerCells.tsx`) are carriers' freight rates, outside the audit's Items list. They keep `$`.
- **The Country column** keeps the design's emoji flags; the currency flags are the Currency & Exchange Rates ones.
- **Unused components** in the design (`VendorPriorityLanes.tsx`, `QVCard.tsx`, `items-v3/PriceWithUom.tsx`, `ManagePartnersModal.tsx`) were left as they are.
- **Gaps in the design itself:**
  - The pricing rule's create form has no currency of its own, and the rule templates' descriptions ("10% off on orders over $1,000") are USD text.
  - The "Category Reconcile DEV" button is the design's own dev harness and shows in every build.
  - Upstream baseline: `tsc` reports 5 errors (3 in `AddQualifiedVendorModal.tsx`, 2 in `ItemsV3DemoPage.tsx`) and 2 tests fail in `import-export/store.test.ts`. Both are the same in `nimble-palette` itself.

## 8. Updating from the design repo

```bash
git subtree pull --squash --prefix touchpoints/items-v2 https://github.com/ahtisham-omne/nimble-palette.git main
npm run touchpoints:build -- items-v2
```

Files the currency work changed (§2–§5) can conflict with upstream changes. Keep both sides, then rebuild the copy.
