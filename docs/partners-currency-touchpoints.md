# Partners: currency & exchange-rate touchpoints

Partners was redesigned. The new app comes from [`ahtisham-omne/partner-management-module`](https://github.com/ahtisham-omne/partner-management-module), at commit `9e923e4`. This record does three things:

1. Lists the currency touchpoints the earlier Partners touchpoint had (§1).
2. Maps each one onto the redesign (§2).
3. Says where everything is defined now (§3–§5).

The redesign replaced the earlier touchpoint in `touchpoints/partners` as a squashed git subtree. Only Partners and Partner Groups were in scope. The audit's other modules come later (§6).

Sources:

- *Currencies & Exchange Rates: where each module changes* (design touchpoint audit, 4 Nov 2026), Partners & Partner Groups, page 32. The audit marks the module "Not reviewed" because its prototype sat behind a Lovable sign-in, so it has no screenshots. It lists three changes, all from spec 4.2.
- *Currency & Exchange Rates Functional Spec v1.1*, sections 2.3 and 4.2 (as the audit cites them).

## 1. The earlier touchpoint (what it had, where)

The earlier touchpoint came from `ahtisham-omne/currency-exchange-rate-partners-touchpoint`, at commit `aac8670`. That repo was a Lovable remix of `partner-management-module` at `93adf63` (21 Apr 2026). The currency work itself was commits `39389fd`…`aac8670`. Paths are as of commit `440df75` in this repo, under `touchpoints/partners/src/app/`. The shell later added the embedding (`38a9bf8`) and swapped emoji flags for the shell's flag images (`440df75`).

| Touchpoint | Where it was | What it did |
|---|---|---|
| Currency library | `data/currencyLibrary.ts` | 156 currencies, base PKR. Its own mid-market and corporate snapshots (55 rates each, e.g. USD 278, "Open Exchange Rates, daily at 19:30 PKT", last sync stamped as today). `convertToBase`, `renderPartnerAmount`, `renderProfileAmount`, `shortAxisFormatter`, `inferDefaultCurrency` (country → currency) |
| Rate context | `context/RateContext.tsx` | Always mid-market. Kept only so components re-rendered |
| Money with hover | `components/ui/CurrencyAmount.tsx` | Five modes: `single`, `listing-base`, `listing-partner`, `aggregated-base`, `partner-rolled-up`. Dotted symbol; the hover gave the other currency's amount, the current rate, rate type, source and "Updated as of" |
| Flag, symbol, picker | `components/ui/CurrencyFlag.tsx`, `CurrencySymbol.tsx`, `CurrencyLibrarySelect.tsx`, `FlagImage.tsx` | Flag by currency; a symbol with a code/name tooltip; a full-library dropdown |
| Partner currency | `data/vendors.ts` `Vendor.defaultTransactionCurrency` | A required field on every partner. Hand-written partners were seeded one by one, the generated ones from their country. Created partners always got "USD" |
| Multi-currency partners | `data/vendors.ts` `currencyBreakdown` | Transactions per currency on v-001 (USD/EUR/JPY) and v-003 (MXN/USD/CAD) |
| Base-currency partner | `data/vendors.ts` v-020 Karachi Industrial Suppliers | A PKR partner, so amounts without a hover could be checked |
| Listing money columns | `pages/VendorsListPage.tsx`, `components/vendors/ColumnHeaderMenu.tsx` | "($)" dropped from Net Profit, Credit Limit, Credit Utilization. Each column showed base or partner currency ("Show values as" in its header menu). Sorted on base |
| Partner currency flag | `pages/VendorsListPage.tsx` partner-name cell | Flag with "Default transaction currency: Name (CODE)" |
| Listing KPIs | `pages/VendorsListPage.tsx`, `components/vendors/KpiInsightsPanel.tsx` | Money KPIs summed in base, with a hover listing currencies and partner counts. Rich-tooltip breakdowns in ₨. Avg Net Margin became Avg Net Profit (money) |
| Rate KPIs | `components/vendors/RateKpiValue.tsx`, `KpiInsightsPanel.tsx` | Mid-market Rate (on by default) and Corporate Rate, with fixed "Updated as of 30th April at 19:30 pm" text |
| Profile switch | `pages/VendorDetailsPage.tsx` | Base Currency / Partner Currency on the dashboard bar, defaulting to partner, hidden for a PKR partner |
| Profile amounts | `pages/VendorDetailsPage.tsx` | KPI cards, Quick Stats, every chart axis, tooltip and stat row, Financial Summary ("Default Transaction Currency" with flag), Credit Limits |
| Configure: currency | `components/vendors/CreatePartnerModal.tsx` | Full-library dropdown with search and a wheel-scroll fix. Pre-filled from the group's country, else USD |
| Configure: credit limit | same | Currency read-only ("Inherited from Billing & Shipping"), symbol from the library, ≈ base preview |
| Configure: fixed amounts | `components/vendors/PaymentMethodsSection.tsx`, `CreatePartnerModal.tsx` | Payment-method fixed discount/charges with the partner's symbol and a ≈ base preview. Payment terms made percent-only |
| Payment terms | `components/vendors/PaymentTermCard.tsx`, `PaymentTermDetailModal.tsx`, `partnerConstants.tsx` | Fixed amounts stored as a base/partner pair, shown per the profile switch |
| Pricing rules | `components/vendors/PricingRulesTab.tsx` | `formatTierValue`: "$" tier values read as USD and shown in base or partner currency. Base/Partner switch on the tab, the detail modal and the create modal |
| Embedding | `src/App.tsx`, `components/layout/AppLayout.tsx` | Router basename; sidebar hidden in the shell |

Known problems in the earlier touchpoint, all fixed or made moot by the port:

- Its rates were its own, not the Currency & Exchange Rates module's, so they didn't match the module's rate history.
- The KPI note said amounts were "converted at transaction-date exchange rate", but every conversion used today's rate.
- A partner's currency lived in a field that Configure didn't write. A created partner was always USD, whatever was chosen.
- A group's currency was inferred from its country. Spec 4.2 says to set it deliberately.
- The rate KPIs showed fixed dates.
- A symbol several currencies share was shown as-is, e.g. "$" for ARS and MXN.

## 2. Mapping onto the redesign

Paths are under `touchpoints/partners/src/app/`.

| Earlier touchpoint | In the redesign | Notes |
|---|---|---|
| Currency library + rate snapshots | `currency/currencies.ts`, `currency/rates.ts`, `currency/money.ts` | The same files as Vendor Invoicing: the module's Currency Library, its mid-market history (same seeds) and its corporate rates. "Today's rate" is the mid-market rate for today, which is the last synced rate (Apr 10, 2026 at 19:30 PKT). |
| `RateContext` | Dropped | Partner amounts are always converted at today's mid-market rate. There is no global rate type. |
| `CurrencyAmount` | `components/currency/CurrencyAmount.tsx` | The same five modes and hovers. Amounts use the module's formatting (`formatMoney`; MXN 1,200.00 for a shared symbol). The rate line gives the module's rate (4 decimals), provider and last sync. `compact` serves the KPI cards. |
| `CurrencyFlag`, `FlagImage`, `CurrencySymbol` | `components/currency/CurrencyFlag.tsx`, `FlagImage.tsx`, `CurrencySymbol.tsx` | |
| `CurrencyLibrarySelect` | The design's own pickers | `CURRENCY_OPTIONS` (`components/vendors/partnerConstants.tsx`) is now the full library, so the design's `CurrencyDropdown` (`config-helpers.tsx`) and both Configure currency popovers list every currency, with flags and search by code, name or country. |
| `Vendor.defaultTransactionCurrency` | The partner record's currency, `configData.creditLimitConfig.currency`, where Configure and the importer write it | Set only when the partner overrides its group. Left inherited, nothing is stored, so the partner follows its group if the group's currency changes. `currency/partnerCurrency.ts` resolves it: the partner's own, else its primary group's (`template.currency`), else base. It reads groups as the store has them (`syncPartnerGroups`, kept in step by `PartnerGroupsProvider`), so a group currency changed in the session is what its partners inherit, in display, sorting and filters alike. |
| Seeded currencies | `data/vendors.ts` `withPartnerCurrency` | The hand-written partners keep the earlier currencies. Where one differs from its group's (Tier 1 Automotive OEMs, USD), it is set on the partner. Generated partners inherit their group's. Applied last, so no seed sequence changes. |
| `currencyBreakdown` | `Vendor.currencyBreakdown` (v-001, v-003) | Shown in Total Spent's rolled-up hover. Each stream is a share of Total Spent in its own currency, so the hover adds up to the figure it sits on. |
| Karachi Industrial Suppliers | Not re-added | Its id would clash with the generated partners. Partners in a group without a currency (e.g. Chassis & Suspension) are base-currency partners. |
| Listing money columns | `pages/VendorsListPage.tsx` (`listingMoney`, `MONEY_COLUMN_NOTE`), `components/vendors/ColumnHeaderMenu.tsx` ("Show values as") | Same per-column base/partner switch, base by default. Sorting, the column menu's range filter (`vendorCellValue`) and the Filters modal's ranges (`FiltersModal.tsx`, labelled "In PKR") all use the base amount. Card view follows the Credit Limit column. |
| Partner currency flag | Dropped | The design's Partners column is avatar and name only, so it stays that way. A partner's currency shows on its profile (Financial Summary) and in the money columns' Partner currency view. |
| Listing KPIs | `components/vendors/KpiInsightsPanel.tsx` (`kpiNumeric`, `kpiMoneySubset`, `MONEY_KPI_KEYS`), `pages/VendorsListPage.tsx` | The redesign splits credit KPIs into vendors and customers. Every money KPI adds partners up in base, compact (₨430.8M), with the currencies-and-partner-counts hover for exactly the partners it counts. Tooltips and formulas say "in PKR". Add Insights previews are in base. |
| Rate KPIs | `KpiInsightsPanel.tsx` (FX category), `components/currency/RateKpiValue.tsx` | Mid-market Rate (on by default) shows the module's last sync. Corporate Rate (opt-in) shows when the corporate rates took effect. |
| Profile switch | `components/currency/ProfileCurrency.tsx` (`CurrencyViewToggle`, `ProfileCurrencyProvider`, `useProfileMoney`) | On the dashboard bar, left of Reset. Defaults to Partner Currency; hidden for a base-currency partner. |
| Profile amounts | `pages/VendorDetailsPage.tsx` | KPI cards (`dashKpiAmount`), Quick Stats, every DashboardTab chart axis, tooltip and stat row, the spend donut, Financial Summary, Credit Limits, and the Payment Methods and Payment Terms tabs. The Partner Locations tab is new in the redesign: a location's Financial Summary, credit card and spend chart are in the partner's currency, which locations can't change. |
| "Default Transaction Currency" | Financial Summary → Currency | Flag, name and symbol. The tooltip says whether it is set on the partner or inherited from its group. |
| Configure: currency | Both `ConfigPageContent` copies (`components/vendors/CreatePartnerModal.tsx`, `CreatePartnerGroupModal.tsx`) | See §3. The design's own Inherited / Overridden / Revert pills now apply to every group, because every group has a currency. |
| Configure: credit limit | Both copies, `credit_limit` section | Currency is read-only, inherited from Billing & Shipping. Symbol prefix with tooltip; ≈ base preview (`components/currency/BaseCurrencyPreview.tsx`). |
| Payment-method fixed amounts | `components/vendors/PaymentMethodsSection.tsx` (`currency` prop) | Used by Configure (partner currency) and the profile's Payment Methods tab. |
| Payment-term fixed amounts | Not needed | The redesign's payment terms are percent-only. |
| Pricing rules | `components/vendors/PricingRulesTab.tsx` (`RULE_CURRENCY`, `formatTierValue`, `TierCurrencyContext`) | Tier amounts stay written in USD, as the rule templates are. On a partner's Pricing Rules tab they are shown in the partner's currency (default) or in base: a switch on the toolbar, applying to cards and the detail modal. Create forms in the tab and in both Configure copies label tier amounts USD, and show what an amount is in the partner's (or group's) currency today underneath (`components/currency/RuleAmountPreview.tsx`). Linked partners' credit limits are in their own currencies. |
| Flags | 52 emoji flags → `FlagImage` | As the shell does everywhere. |
| Embedding | `src/embedding.ts`, `src/EmbeddingBridge.tsx` | See §5. |

The redesign also showed partner money elsewhere, now in the partner's or the base currency:

- `pages/PartnerGroupsPage.tsx`: a **Currency** column (multi-select filter, sortable), described in §3.
- `pages/PartnerGroupDetailsPage.tsx`: Total Spend, Outstanding, Avg. Order Value and the spend chart add the group's partners up in base. "% credit used" is now credit used over credit limits, both in base; it was an average of raw amounts.
- `components/vendors/QuickViewPanel.tsx`: a partner's credit limit and spend, an item's unit price and a location's available credit, in the partner's currency. The same goes for the partners listed when a pricing rule changes (`PartnerItemsTab.tsx`).
- `components/vendors/CreatePartnerLocationModal.tsx`: the location's Currency node shows the partner's currency.
- `pages/VendorEditPage.tsx`: the partner's currency.

## 3. The audit's 3 changes (p. 32) and where they are

| # | Change | Where |
|---|---|---|
| 1 | Partner Group: default currency field. Defaults to base currency; set deliberately, not inferred from country | `components/vendors/CreatePartnerGroupModal.tsx` `ConfigPageContent`: the currency starts as the group's own (saved configuration, else its template), else PKR (search "never inferred from the group's country"). Its ⓘ explains it. `COUNTRY_CURRENCY_MAP` is gone. The six seeded groups keep the currencies the design gave them (USD, EUR, JPY, AED, USD, GBP); the rest use base. The groups listing's Currency column marks those "Base currency (default)". The group importer defaults a blank currency to PKR (`import-export/partnerGroupsApply.ts`). |
| 2 | Partner inherits the group's currency, can override | `components/vendors/CreatePartnerModal.tsx` `ConfigPageContent`: `groupTemplateCurrency` is the group's currency, base when it sets none, never the country's. Inherited / Overridden / Revert to {group} use it. Creating a partner saves the currency only when it was overridden, from either side's Billing & Shipping (`pages/VendorsListPage.tsx`). `currency/partnerCurrency.ts` reads it back, and it drives every amount on the listing and profile. In the partner importer a blank currency stores none, so the partner inherits (`import-export/partnersApply.ts`). On an update it keeps the partner's own. |
| 3 | Full active currency list at every selection point | `CURRENCY_OPTIONS` is the Currency Library's 156 active currencies (`components/vendors/partnerConstants.tsx`). That covers the `CurrencyDropdown`, both Configure popovers, the importer's validation (`import-export/spec.data.mjs` `CURRENCY_IDS`, kept equal by its snapshot test) and the regenerated templates in `public/templates/`. Inactive currencies aren't in the library copy, so they can't be picked. Reactivation is done in Currency & Exchange Rates. |

## 4. Shared currency code in the redesign

| File | What it holds |
|---|---|
| `currency/currencies.ts`, `rates.ts`, `money.ts` | As in Vendor Invoicing: the library, `BASE_CURRENCY`, rates (`rateOn`), formatting (`formatMoney`, `formatCompactMoney`, `moneyPrefix`, `rateSentence`) |
| `currency/partnerCurrency.ts` | `groupCurrencyOf`, `partnerCurrencyInfo` / `partnerCurrencyOf`, `currentRate`, `toBaseNow`, `convertNow`, `MID_RATE_UPDATED`, `CORPORATE_RATE_EFFECTIVE` |
| `currency/partnerAmounts.ts` | `partnerAmount` (props for `CurrencyAmount` in base or partner view), `shortAxisFormatter`, `currencyBreakdown` |
| `currency/usePartnerCurrency.ts` | The store-aware resolvers |
| `components/currency/*` | `CurrencyAmount`, `RateLine`, `CurrencyFlag`, `FlagImage`, `CurrencySymbol`, `BaseCurrencyPreview`, `RateKpiValue`, `ProfileCurrency` |

## 5. Running inside the shell

All of this lives in `src/embedding.ts` (with `src/EmbeddingBridge.tsx` for the router), as for Vendor Invoicing:

- The router basename is set in `src/App.tsx`.
- `AppLayout.tsx` hides the app's sidebar.
- Root-relative links and `window.open('/vendors/…')` resolve against the base path. Links that open a new tab go to the shell's page for them, and Copy Link copies the shell's page (`appHref`, `appUrl`).

The shell's Partners Management links (`/partners`, `/vendors`, …) are unchanged. `touchpoints/touchpoints.json` points at the new repo.

## 6. Not in this step

- **Other modules' documents shown in Partners** keep the design's `$`: purchase and sales orders, quotes, contact activity, and item prices on the Items tab. Each document carries its own currency, which is that module's audit item (Purchase Orders, Sales Orders, Quotes, Items v2).
- **Static mock pages:** Credit Management and Reports & Analytics show fixed `$` figures that aren't computed from partners.
- **Carrier shipping costs:** in the Shipping module, which is outside this audit.
- **Gaps in the design itself:**
  - Edit Partner doesn't load a partner's saved configuration, so its Configure starts from the group's currency.
  - Vendor and customer sides each have their own Billing & Shipping, so each has a currency. Create keeps an override from either side, the vendor side's first.
- **Pricing-rule currency:** rules have no currency field. Tier amounts stay USD, as the design's templates write them; a currency per rule is a design decision.

## 7. Updating from the design repo

```bash
git subtree pull --squash --prefix touchpoints/partners https://github.com/ahtisham-omne/partner-management-module.git main
npm run touchpoints:build -- partners
```

Files the currency work changed (§2, §3) can conflict with upstream changes. Keep both sides, then run `node scripts/gen-import-templates.mjs` in `touchpoints/partners` and rebuild the copy.
