# OMNE currencies and exchange rates

Two skills that let any BA and designer add currencies and exchange rates to
an OMNE module the same way, without a separate design pass.

Every new module goes through a readiness checklist before it is ready:
permissions, activity logs, alerts, general settings, and currencies and
exchange rates (Nophil Anwer, 25 Nov 2026). This plugin covers the currencies
item, the way `omne-activity-logs` covers activity logs: the BA says what
goes on each screen, and the designer builds it from shared pieces.

| Skill | Who | What it does |
|---|---|---|
| `omne-currency-doc` | BA | Writes the module's currency document: for every listing, KPI row, detail page, create or edit screen, print preview, configuration dialog and activity log, which amounts are in which currency, where the switch goes, which columns get "Show values as", the rate and its day, locks, pay-from accounts, estimates, FX gain and loss, and open questions. Checks it is complete, and later reviews the build against it. |
| `omne-currencies` | Designer | Installs OMNE's shared currency kit into the module's app, wires each screen in the document to it, checks the result and hands back a note for the BA. |

## The flow

1. **BA**: "Write the currency touchpoints for <module>." The skill gathers
   the screens, fills the document in its fixed format, cites the settled
   rulings by number and runs its completeness check.
2. **Designer**: "Add currencies and exchange rates to <module> from this
   document: <link>." The skill checks the document first and sends it back
   if it is incomplete, installs the kit into the module, wires each screen,
   runs its self-check and walks the module in the browser.
3. **BA**: "Review the currencies Mahad built for <module>." The skill
   compares the build with the document and lists anything that differs.

Questions the document doesn't answer go to the BA. A case the kit can't
draw goes to the kit's owner (Mahad Ejaz) before anything new is built.
Anything still waiting on a ruling (regional item prices, the pay-from book
balance, the FX variance date) is not built.

## What's inside

- `skills/omne-currency-doc/`: the settled rulings (`references/rules.md`),
  the document template (`assets/doc-template.md`), a finished example
  (`assets/examples/purchase-orders.md`), how to review a build, and the
  completeness check (`scripts/check-doc.mjs`).
- `skills/omne-currencies/`: the shared currency kit (`assets/kit/`), the
  same rulings, each pattern with its copy and code
  (`references/patterns.md`), the self-check list
  (`references/checklist.md`), an installer
  (`scripts/install-currency-kit.mjs`), a checker
  (`scripts/check-currencies.mjs`) and the BA's document check.

The scripts are plain Node (18 or later) and work from a folder with spaces
in its path.

```bash
node skills/omne-currency-doc/scripts/check-doc.mjs <document.md>
node skills/omne-currencies/scripts/install-currency-kit.mjs <module-src-dir>
node skills/omne-currencies/scripts/check-currencies.mjs <module-src-dir>
```

The kit is generalized from the Currencies & Exchange Rates prototype's
touchpoint apps (Partners, Items, Purchase Orders, Quotes, Sales Orders,
Vendor Invoicing and Payments, Vendor Returns, Chart of Accounts) as they
stood after Nophil's review on 25 Nov 2026, Eli's rate ruling on 26 Nov 2026
and Mahreen's design changes on 27 Nov 2026. Its demo rates match the
Currencies & Exchange Rates module's: one daily market rate per currency per
day, read once a day and fixed for that date.

Version 0.2.0, 27 Nov 2026: "mid-market" is now the daily market rate; the
rate info hover (`RateTypeInfo`) replaces Compare rates; rates follow the
posting date; recording a payment asks for the bank's rate. Version 0.1.0,
25 Nov 2026. Mahad Ejaz.
