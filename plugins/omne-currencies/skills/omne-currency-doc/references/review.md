# Reviewing a module's currencies against the document

The designer has added currencies and exchange rates and sent a handover note
saying where each screen is. Your job is to confirm the screens do exactly
what the document says: nothing missing, nothing added, nothing reworded.

## What you need

- The document, at its current version.
- The built module: the prototype link and the handover note. Open it in a
  browser if you can; otherwise ask for screenshots of every screen in the
  document, with hovers open on one foreign amount per screen.
- If you have the repo, run the designer's checker for its list of where each
  pattern is used:
  `node <designer-skill>/scripts/check-currencies.mjs <module-src-dir>`.

## Open a foreign record and a base one

Use one document in a foreign currency (USD where the demo has it) and one in
the base currency. The base one should show no switch, no tag and the "no
conversion" line in its Currency information block.

## How to check, screen by screen

1. **Is it there?** At the route the document gives.
2. **Is each amount in the currency the document says?** Hover one: the card
   shows the other currency, the rate, its type and its day ("PO date",
   "posting date"). An estimate starts with "≈".
3. **The switch.** On a detail page, in the line items toolbar (never the
   header), only on a foreign document, default base. Flip it: every amount
   the document lists follows, GL Impact doesn't. Leave and come back: it
   remembers.
4. **Listings.** A Currency column; the tag after a foreign partner's name;
   each money column's header menu has "Show values as" with the right
   party; sort a column and check it sorts by base. No switch in the toolbar.
5. **KPIs.** In base, compact, no hover.
6. **The configuration dialog.** Its sections, the rate type and day, Compare
   rates on orders, the account picker's order, the lock line, read-only once
   locked.
7. **Print.** The partner's currency by default; the switch to base; the
   total names its currency; the footnote.
8. **Copy.** Word for word, as the document quotes it. No em dashes.

Then look at the whole module once for anything the document doesn't have: a
switch nobody asked for, an amount in the wrong currency, a "PKR" written in
the copy. All of it comes out.

## How to report

One message to the designer, one finding per line, in document order, each
with the screen, the record, what the screen does and what the document
says. Attach a screenshot where it helps.

```
Screen 3 (PO 395-9900): the switch is in the header. Document: line items toolbar.
Screen 4: Value column's menu has no "Show values as".
Screen 2: Total Spend shows "$2.7M" for a USD-heavy filter. Document: base, "₨750.3M".
Screen 5: matches.
```

Say "matches" for the screens that do, so the designer knows they were
checked. If a finding is really a change you want to the document, change
the document first and say so.
