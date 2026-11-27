# Self-check before the module goes to the BA

Run the checker, fix what it finds, then walk the module in the browser.

```bash
node <skill>/scripts/check-currencies.mjs <module-src-dir>
```

**Part A** compares every kit file with the hash the installer wrote. An
edited kit file is a fork of the shared design: move the change into the
module's own code, or ask the kit's owner for it, then run the installer
with `--force` to restore the file.

**Part B** lists patterns that have each cost a review round: "PKR", "Rs" or
"₨" written in the module; money formatted with Intl or a hand-written "$";
the module's own copy of a kit export; the switch in a header; a switch
built by hand; a listing that keeps column views without "Show values as";
DocMoney with no provider; a popover in a dialog without `modal`; em dashes
and arrows in copy. A hit is usually real; read the line before changing it.
A module that had its own currency code before the kit shows its old copies
here: replace them with the kit.

**Part C** lists where each kit pattern is used, with its party and copy.
Match every line to a screen in the BA's document, and every screen in the
document to a line. Anything not in the document comes out.

Then run the module's own type check (`npx tsc --noEmit -p tsconfig.app.json`
in the OMNE touchpoints) and tests, and compare with the counts before you
started: no new errors.

## In the browser

Open one document in a foreign currency (USD where the demo has it) and one
in the base currency. Check every screen in the BA's document.

**Everywhere**
- [ ] No "PKR", "Rs" or "₨" in copy except inside formatted amounts and
      "PKR is the base currency, so there's no conversion."
- [ ] Every foreign amount has the dotted underline; its hover shows the
      other currency, the rate ("1 USD = ₨278.5200 PKR"), its type and its
      day ("PO date", "posting date", "Today, Nov 25, 2026").
- [ ] Base amounts with nothing to convert are plain text.
- [ ] Every estimate starts with "≈".
- [ ] "Open Exchange Rates" is a link to its site.

**Listings**
- [ ] A Currency column with the library pill and name.
- [ ] The tag after each foreign partner's or document's name; none on base.
- [ ] Each money column's header menu: Sort, then "SHOW VALUES AS: Base
      currency | <Party> currency", then Hide. Default base, the dot on the
      chosen one. Leave the page and come back: it remembers.
- [ ] Sorting a money column orders by base value, whatever its view.
- [ ] No switch in the table toolbar.
- [ ] Vendor invoice lists only: amounts in the invoice's currency, a
      separate "≈ … (PKR)" column, no "Show values as".

**KPIs and overviews**
- [ ] KPIs in base, compact ("₨750.3M"), no hover, no "In PKR" pill.
- [ ] A foreign record's overview opens in base; its switch shows the
      record's currency; a base record has no switch.

**Detail pages**
- [ ] The switch is in the line items toolbar (or the first money card),
      not the header. None on a base document.
- [ ] Flip it: line items, rule and adjustment amounts, hovers, the summary,
      Paid and Outstanding, and money tabs follow. GL Impact stays in base.
- [ ] Leave and come back: the document keeps its view.
- [ ] The Currency information block ends the summary: its rows, the rate
      with its type chip and day, "View currency configuration". No lock on
      the block. No Currency button in the header.

**Configuration dialog**
- [ ] Its sections, as the document lists them; Reset to default, Cancel,
      Apply.
- [ ] Daily market rate | Corporate rate, with the rate info icon right
      after it. Its card: "USD to PKR today", both rates, the Gap, and "Daily
      market rate read on … Corporate rate set by your company on …".
- [ ] The account picker: base first, then the document's currency, then
      the rest; no balances. A third-currency account shows the direct rate
      and "Estimated payment ≈ …".
- [ ] The lock line; read-only once locked. The picker's list scrolls inside
      the dialog.

**Print**
- [ ] Opens in the partner's currency; the switch prints in base with an
      Exchange rate line, "Grand Total (PKR)" and the "converted from"
      footnote. No switch when sending to the partner.

**Copy**
- [ ] Every string is the document's, word for word. Plain sentences, no em
      dashes, "to" rather than "→".

## The handover note to the BA

Short, one line per screen, saying where to look:

> Screen 3, PO page: Purchase Orders › 395-9900 (General Motors, USD). Switch in the Line Items toolbar.
> Screen 4, Receiving Docs: 395-9836 › Receiving Docs › Value column menu.

Then list anything the document left open, and anything you couldn't build
with the reason. Don't say a screen is built until you have seen it.
