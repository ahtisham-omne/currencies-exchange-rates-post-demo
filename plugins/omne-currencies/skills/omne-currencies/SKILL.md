---
name: omne-currencies
description: Add currencies and exchange rates to an OMNE ERP module from the BA's "Currencies & Exchange Rates: [module]" document, using OMNE's shared currency kit (money with its rate hover, the currency tag and Currency column, "Show values as" in listing column menus, base-currency KPIs, the Base Currency | Party Currency switch in a detail page's line items toolbar, the Currency information block, the configuration dialog's rate type toggle, Compare rates and pay-from account picker, the print switch, Mark as paid's bank rate) and a self-check, so every module shows money the same way without a separate design pass. Use it whenever a designer or developer is adding, building, fixing or reviewing currencies, exchange rates, multi-currency amounts, FX, a base or partner currency switch, or the currencies item of the module readiness checklist in any OMNE module (a Vite, React and shadcn app), when they have a BA's currency document to implement, or when a BA flags that an amount shows in the wrong currency, even if they only say "add currencies to Customer Invoicing".
---

# OMNE currencies and exchange rates

Every OMNE module shows money the same way: amounts in the base currency by
default with the record's own currency on hover, a currency tag on foreign
records, "Show values as" in listing column menus, a switch in a detail
page's line items toolbar, a Currency information block and one Currency
configuration dialog. Nobody designs these from scratch. You install the
shared currency kit, wire each screen the BA's document lists to the kit's
pieces, and check the result. The look, copy and behaviour come with the
kit; your job is putting the right piece on the right screen with the right
data.

## What you need first

- **The BA's currency document for this module** ("Currencies & Exchange
  Rates: <Module>", written with the `omne-currency-doc` skill). It lists
  every screen that shows or takes money and says, for each, which amounts
  are in which currency, where the switch goes, the rate and its day, the
  lock, the account rules and the copy. It is the only source: build every
  screen it has, and nothing it doesn't. If there is no document, stop and
  ask the BA for one.
- **The module's repo**: a Vite, React and Tailwind app with shadcn/ui
  (`tooltip`, `hover-card` and `popover` in its `components/ui`).

## Read before you build

1. `references/rules.md`: the settled rulings (R1 to R28) the document
   cites, and what is still open (P1 to P7). Don't build anything in
   section 9.
2. `references/patterns.md`: each pattern, where it goes, its copy and its
   code. Read the sections the document's screens use.
3. `references/checklist.md`: what you'll be checked against.

Where the BA's document and `rules.md` disagree, ask the BA before building:
either the document has a ruling for this module, or it has a mistake.

## The workflow

### 1. Check the document, then map it

```bash
node <skill>/scripts/check-doc.mjs <document.md>
```

If anything is listed under "Missing", send the document back to the BA with
that list instead of building around the gaps.

Make a short table: one line per screen in the document, with the file or
component it lives in and the kit pieces it needs (patterns.md section
numbers). Show it to the BA or the designer who owns the module. Mistakes
are cheap here and expensive after the build.

### 2. Install the kit

```bash
node <skill>/scripts/install-currency-kit.mjs <module-src-dir>
```

It copies the kit to `src/app/currency-kit/`, points its imports at the
module's `components/ui`, and writes `kit.lock.json` with each file's hash.
It refuses to overwrite a kit file that was changed in the module unless you
pass `--force`. It tells you what's missing (a ui primitive, a package, a
Tailwind content glob, a TooltipProvider).

The kit files are the design: never edit them in a module, and never put
module code in the kit folder. If a screen needs something the kit can't do,
build the rest and ask the kit's owner (Mahad) for that piece, so every
module gets it. Re-run the installer to pick up a newer kit.

### 3. Wire each screen

Follow the document screen by screen, with `references/patterns.md`:

- Records and documents get their rate with `documentFx` (pattern 2).
- Listings: `CurrencyPill` after names, a `CurrencyCodeCell` column,
  `ShowValuesAsSection` in each money column's header menu and `ColumnMoney`
  in its cells; sort on base (patterns 4, 5). Vendor invoices use pattern 6.
- KPIs: `KpiMoney`; overviews: `OverviewCurrencySwitch` (pattern 7).
- Detail pages: `DocCurrencyProvider` with `useDocViewOf`, `DocViewSwitch`
  in the line items toolbar, `DocMoney` for every document amount; GL Impact
  in base (pattern 8). Typed amounts: pattern 9.
- `CurrencyBlock` at the end of the summary (pattern 10); the module's own
  dialog with `RateTypeToggle`, `RateTypeInfo`, `PayFromAccountPicker` and
  `LockLine` (patterns 11, 12).
- Print: `PrintCurrencySwitch`, `printTotalLabel`, `currencyFootnote`
  (pattern 13). Mark as paid: `BankRateField` (pattern 14).

Remove the module's own currency code as you go (its own currency list,
rates, formatters, switches): the kit replaces it. Seed data names a foreign
currency by ISO code and leaves a base one empty.

### 4. Check

```bash
node <skill>/scripts/check-currencies.mjs <module-src-dir>
```

Fix parts A and B. Trace every line in part C to a screen in the document.
Run the module's type check and tests: no new errors. Then walk
`references/checklist.md` in the browser, with one foreign and one base
document. Only call a screen built once you have seen it.

### 5. Hand over to the BA

Send a short note: one line per screen saying where to see it, then any open
questions and anything you couldn't build, with the reason. Format in
`references/checklist.md`. The BA reviews with the `omne-currency-doc`
skill's review steps.

## When to ask, and whom

- **The BA**: anything the document doesn't say (a screen it misses, an
  amount whose currency it doesn't give, copy it doesn't quote). Never fill
  the gap yourself.
- **The kit's owner (Mahad)**: a case the kit can't draw, or anything that
  would need a change to a kit file.
- **Nothing for section 9 of `rules.md`** until it's ruled.

## What is in this skill

- `assets/kit/`: the shared currency kit (the installer copies it).
  `currencies.ts` (the Currency Library and the company's base),
  `rates.ts` (daily market and corporate demo rates, today's read, cross
  rates, the data behind the rate info hover), `moneyFormat.ts` (writing money and rates), `Money.tsx`,
  `DocCurrency.tsx` and `docCurrencyContext.ts` (the four faces and the
  document provider), `docView.ts`, `CurrencySwitch.tsx` (the three
  switches), `ShowValuesAs.tsx` and `columnCurrencyView.ts`,
  `CurrencyChip.tsx`, `CurrencyCodeCell.tsx`, `FlagImage.tsx`,
  `CurrencyBlock.tsx`, `RateType.tsx`, `RateTypeInfo.tsx`,
  `companyAccounts.ts` and `PayFromAccountPicker.tsx`, `BankRateField.tsx`,
  `FxCard.tsx`, `ProviderLink.tsx`, and `index.ts`.
- `references/rules.md` (the same file as the BA's), `references/patterns.md`,
  `references/checklist.md`.
- `scripts/install-currency-kit.mjs`, `scripts/check-currencies.mjs`, and
  `scripts/check-doc.mjs` (the BA's document check).
