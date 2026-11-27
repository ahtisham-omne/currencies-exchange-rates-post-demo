---
name: omne-currency-doc
description: "For OMNE business analysts. Writes a module's currency document (\"Currencies & Exchange Rates: [module]\", the document a designer adds currencies and exchange rates to the module from) out of rough inputs like the module's Outline pages, Jira stories, the Lovable prototype and screenshots, in OMNE's fixed format: for every listing, KPI row, detail page, create or edit screen, print preview, configuration dialog and activity log, which amounts are in the document's currency and which in base, where the Base Currency | Party Currency switch goes, which columns get \"Show values as\", the rate type and rate date, lock rules, pay-from accounts, estimates, FX gain and loss, and open questions. Checks it is complete before handover, and reviews the designer's build against it. Use it whenever a BA is asked to define, write, update or vet currencies, exchange rates, multi-currency or FX behaviour for any OMNE module, or to go through the module readiness checklist's currencies item, even if they only say \"do the currency touchpoints for Customer Invoicing\" or \"check the currencies Mahad built\"."
---

# OMNE currency documents, for BAs

Every new OMNE module goes through a readiness checklist before it is ready:
permissions, activity logs, alerts, general settings, and currencies and
exchange rates (Nophil, 25 Nov 2026). For currencies, the BA says what goes in
each screen and the designer builds exactly that with the shared currency kit,
so no module invents its own way of showing money.

The BA's part is one document: **Currencies & Exchange Rates: <Module>**. It
says, screen by screen, which amounts are in which currency, where the
currency switch goes, which rate applies, when it locks, how paying works and
what is still open. This skill does two jobs:

- **Write** the document from rough inputs.
- **Review** the designer's build against it.

The designer side is the `omne-currencies` skill, which reads the same
rulings (`references/rules.md`), so what you write is what they can build.

## Write the document

### What to gather first

- **The current screens.** The Lovable prototype (a link, or screenshots of
  every screen and dialog that shows or takes money) is the source for
  screens, labels, columns and statuses. Older screenshots or Jira text that
  disagree with the prototype lose: write what the prototype shows, and list
  the disagreement as an open question.
- **The module's Outline pages and Jira stories**, for what the screens don't
  show: which document is in which currency, when it posts, what locks it,
  who pays from where.
- **Neighbouring modules' currency documents**, so a document that flows from
  one module to the next (quote to sales order, PO to receiving to invoice to
  payment) keeps one currency, one rate and one lock story.
- **The module's activity-log document**, if it exists, to name it.

If you don't have the screens, fill in "The module at a glance", list the
screens you know of with "no screen yet", and stop there. A screen written
without the screen always gets redone.

### Read before writing

1. `references/rules.md`: the settled rulings (R1 to R28) and what is still
   open (P1 to P7). Cite them by number instead of repeating them.
2. `assets/doc-template.md`: the document's sections and fields.
3. `assets/examples/purchase-orders.md`: a finished document. Match its
   depth.

### How to write it

1. **Answer "The module at a glance"** first: the party (vendor, customer,
   partner, account), where the document's currency comes from, the rate
   type, the rate day, what locks it, the pay-from or receive-into rule and
   whether the module books FX gain or loss. Everything after follows from it.
2. **List every screen that shows or takes money**: each listing, KPI row or
   dashboard, detail page and each of its tabs with money, create and edit
   screen, configuration dialog, print or download preview, and any prompt
   that picks a rate (versions, posting-date changes, Mark as paid). One
   block per screen, with its Kind.
3. **For each screen, fill every field.** The Amounts table names each
   amount by its label on screen and says what it's shown in, what its hover
   shows and whether it's an estimate. "None" and "Not applicable" are
   answers; an empty field is not.
4. **Write the FX gain and loss table**: every posting a currency difference
   makes, or "None: this module never books".
5. **Write the Activity log section**: which currency changes the log
   records. The sentences themselves go in "Activity Logs: <Module>", written
   with the `omne-activity-log-doc` skill.
6. **Flag, don't guess.** Anything the screens and stories don't settle goes
   in Open questions, naming who can answer. Every pending ruling in
   `rules.md` section 9 that touches the module goes there too.

Rules that matter most, because they are where currency work goes wrong:

- **KPIs are in base** (R3). A record's own currency is only an extra (R4).
- **Listings never get a switch.** Each money column gets "Show values as"
  in its header menu (R5). Vendor invoice amounts are the one exception: the
  real amount in the invoice's currency, with a separate "≈" base column (R6).
- **Detail pages put the switch in the line items toolbar, never the
  header** (R7). GL Impact stays in base.
- **Name the rate day** for every rate: PO date, posting date, payment date,
  receiving date, today (R14). Name what locks it (R15).
- **Paying from a third-currency account shows the direct rate**, as an
  estimate (R19).
- **Every estimate wears "≈"** (R21).
- **Copy in quotes, exactly as it will read**: plain, short sentences, no em
  dashes, "base currency" rather than "PKR" (R26).

### Check it, then hand it over

```bash
node <skill>/scripts/check-doc.mjs <document.md>
```

Fix everything under "Missing". Look at everything under "Worth a look".
Then trace every screen, label and amount in the document back to the
prototype. The designer's skill runs the same check and sends back a
document that fails it. (`--template` checks only the structure, for the
blank template.)

Publish the document where the designer can read it (a Claude document or
an Outline page), and send them the link with one line on what's ready and
what's still open. The designer's prompt is: "Add currencies and exchange
rates to <module> from this document: <link>".

## Review the build

When the designer says it's built, follow `references/review.md`: go screen
by screen, check each amount is in the currency the document says, the
switch sits where it says, every listed column has "Show values as", the
rates, locks and copy match, and nothing was added. Send one message with
one finding per line.

If what you want is really a change to the document, change the document
first, then tell the designer. The document and the build must never
disagree.

## When a case isn't covered

If a screen needs something `rules.md` doesn't settle (a new kind of
document, a rate taken on a different day, a party the kit doesn't name),
write it the way the product should do it and flag it under Open questions as
"needs a ruling", naming who should rule (Nophil for product, Mahreen for the
currency design, Eli for the spec). Don't design the layout yourself: the
designer drafts it with the kit's pieces, and the ruling then goes into
`rules.md` for every module.

## What is in this skill

- `references/rules.md`: the settled rulings and what is still open. The
  designer's skill carries the same file.
- `references/review.md`: how to check a build and report findings.
- `assets/doc-template.md`: the document's structure, with how to fill it.
- `assets/examples/purchase-orders.md`: a finished document, written from
  the prototype.
- `scripts/check-doc.mjs`: the completeness check.
