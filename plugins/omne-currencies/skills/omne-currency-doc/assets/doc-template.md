# Currencies & Exchange Rates: <Module>

<date> · <BA name>

<Two or three sentences: what the module is, which screens this document was
written from (prototype link and date), and anything not seen yet.>

## Sources

- <The prototype: link, and the date you read it.>
- <Outline pages and Jira stories, by name or key.>
- <Screenshots or calls, with dates.>

## Rulings this document follows

<The rules from rules.md this module uses, by number, each with one line on
how it applies here. Then any ruling made for this module alone, with who
made it and when. Example:>

- R5: the PO listing's PO Value and Received Value columns get "Show values as".
- R7: the PO page's switch sits in the Line Items toolbar.
- <Module ruling: what, who, date.>

## The module at a glance

| Question | Answer |
|---|---|
| Base currency | The company's base currency (R1). <Anything module-specific, or "Nothing module-specific".> |
| Party | <Vendor, Customer, Partner, Account, or None> |
| Document currency | <Where it comes from, and whether it can change on the document.> |
| Rate type | <Company default (mid-market), or chosen per document: Mid-market or Corporate.> |
| Rate date | <Document date, order date, posting date, payment date, receiving date, or today.> |
| Locks | <The event that locks the rate, or "Never: nothing is stamped".> |
| Pay from / receive into | <The account rule (R18, R19), or "None".> |
| FX gain or loss | <Where it posts, or "None: this module never books".> |

## Screens

<One block per screen, tab or dialog that shows or takes money. Kinds:
Listing, KPIs, Detail page, Create/edit, Print, Configuration dialog,
Activity log, Other. Every field is filled; write "None" or "Not applicable"
with a reason rather than leaving one out.>

### Screen 1: <Name, as the prototype titles it>

**Kind** <Listing>
**Where** <The route, or the clicks that reach it.>
**Amounts**

| Amount | Shown in | Hover | Estimate (≈) |
|---|---|---|---|
| <Column or field label> | <Base, or Base by default with "Show values as", or Document currency> | <What the hover shows> | <No, or Yes and why> |

**Switch** <None, or where it sits and its two options: "Line items toolbar: Base Currency | Vendor Currency, default base".>
**Show values as** <The money columns that get it and the party option, or "No money columns".>
**Currency column** <Yes, or "No" and why.>
**Rate** <Type and day, or "Each record's own rate".>
**Lock** <What locks and when, or "Not applicable" and why.>
**Pay from** <The account rule on this screen, or "Not applicable".>
**FX gain/loss** <What posts from this screen, or "None".>
**Copy** <Every new string on this screen, exactly, in quotes; or "None new".>

## FX gain and loss

<Every posting the module makes because of a currency difference, or "None:
this module never books".>

| Event | Compares | Posts to | Sign |
|---|---|---|---|
| <Payment recorded> | <Invoice rate against the bank's rate> | <FX Gain or FX Loss (7150 today)> | <+ gain when it cost less in base> |

## Activity log

<Which currency changes the module's activity log records (a currency
changed, a rate type or corporate rate changed, the account changed, a
version's rate applied). Their sentences belong in "Activity Logs: <Module>",
written with the omne-activity-log-doc skill; name that document here, or
say it doesn't exist yet. A view switch is never logged.>

## Open questions

**<The question, as a bold lead sentence.>** <What depends on it, which
screens, and who can answer it. List every pending ruling in rules.md
section 9 that touches this module.>
