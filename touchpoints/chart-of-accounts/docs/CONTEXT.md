# Chart of Accounts & General Ledger — Module Context

A high-fidelity, front-end-only prototype of the **Chart of Accounts (COA)** and
**General Ledger (GL)** module of the Omne ERP accounting suite. It exists to
design and pressure-test the product experience — account structure, guided
setup, ledger browsing, period close, and insights — not to be a production
backend. All data is seeded and held in memory; there is no server.

Originally scaffolded with Lovable; now hand-maintained.

---

## Tech stack

- **React 18** + **TypeScript** + **Vite 5**
- **Zustand 4** for global state (in-memory, session-scoped — no persistence)
- **React Router 6** for screen routing
- **Tailwind CSS 3** for styling; shared primitives in `src/components/ui.tsx`
- **Recharts** for charts, **react-dnd** for drag-to-reorder, **lucide-react** for icons,
  **@tanstack/react-virtual** for large table virtualization
- **Vitest** for unit tests (25 test files, run in Node)

### Commands
```bash
npm run dev        # Vite dev server
npm run build      # production build
npm test           # vitest run (one-shot)
npm run test:watch # vitest watch
```

---

## Screens & routing (`src/App.tsx`)

Everything renders inside `AppShell` (sidebar + header). Full routes:

| Route | Page | What it is |
|---|---|---|
| `/accounting` | `AccountingOverview` | Module landing / cards into COA, GL and sibling finance modules |
| `/chart-of-accounts` | `ChartOfAccounts` | **Primary workspace** — list/tree of accounts, search, filters, saved views (lenses), bulk actions, KPI shelf, setup checklist |
| `/chart-of-accounts/:id` | `AccountDetail` | View/edit one account + its transactions and insights |
| `/chart-of-accounts/setup` | `Setup` | Hosts the guided setup wizard |
| `/general-ledger` | `GeneralLedger` | Posted journal entries, period-scoped balances, launch new JE |
| `/general-ledger/entry/:jeId` | `JournalEntryDetail` | Read-only JE detail; reverse, view source doc & attachments |
| `/numbering` | `Numbering` | Configure the shape of a suggested account number (parts and widths) |
| `/merge` | `Merge` | Consolidate duplicate accounts (irreversible) |

**Slide-overs / modals (not routable), surfaced from ChartOfAccounts:**
`CreateAccount` (create/edit), `ImportAccounts` (CSV import wizard),
`ExportAccounts` (PDF/Excel/CSV), and `AccountActions`
(lifecycle confirm dialogs, driven by the `useAccountLifecycle` hook).

---

## Data model (`src/types.ts`)

- **Account** (`types.ts:296`) — the central entity.
  - `accountType`: GAAP category `'AST' | 'LIA' | 'EQT' | 'REV' | 'EXP'` (drives statement placement + normal balance)
  - `glAccountType`: `'Posting' | 'Summary'` — the **only two structural types** (see decision below). Posting holds transactions; Summary is a rollup parent.
  - `parentId`: hierarchy; a child must share its parent's category.
  - `accountRole` (Postings only): control-account identity (Accounts Receivable, Accounts Payable, Bank, Inventory, etc.) that links to a subledger and locks the account against manual posting.
  - `section`, `normalBalance` (`'Debit' | 'Credit' | 'n/a'`), `isPosting`, `balance`, `netChange`, plus bank details on Bank/Credit-Card roles.
- **Transaction** (`types.ts:485`) — one posting line inside a JE (`debit`/`credit`, `runningBalance`, `period`, `dimensionValues`, `entryType`).
- **JournalEntry** (`types.ts:519`) — entry-level metadata + balanced `lines`.
- **Period** (`types.ts:426`) — a month with `status` `'Open' | 'Soft-Closed' | 'Hard-Locked'`.
- **Dimension** (`types.ts:395`) — a GL reporting axis (Location, Department, …). Tenant-level. Values live on the postings (`Transaction.dimensionValues`), pre-filled from `Account.defaultDimensionValues` and editable per entry.
- **NumberingScheme** — the shape of a suggested number: its parts and their widths. Every part but the account number is a dimension. Five digits by default. Reservations live on summary accounts (`numberRangeStart`/`numberRangeEnd`), not on the scheme; where an account is filed still comes from its parent and the classification stated on it, never from its digits.

---

## State (`src/store.ts`)

A single Zustand store, **in-memory only** (nothing persists across reloads).
State slices: `accounts`, `transactions`, `journalEntries`, `jeAttachments`,
`periods`, `periodSnapshots`, `auditLog`, `company` (fiscal year + setup flags +
wizard state), `dimensions`, `taxCodes`, `numberingScheme`, `partners`, and UI state
(`coaView`, `glView`, `periodSelection`, `toasts`, `newAccountIds`).

Action groups: accounts CRUD + validation; lifecycle (deactivate/activate/
archive/merge/bulk); journal entries + period close (`closeQuarter`, `closeYear`);
chart structure (fiscal year, numbering, number allocation, `eligibleParents`);
dimensions; UI toggles/toasts; and dev-only first-time-user helpers
(`resetToFirstTimeUser` / `exitFirstTimeUser`). Period-scoped selectors
(`usePeriodScopedAccounts`, `usePeriodScopedChart`) derive figures with
identity-stable caching.

---

## Business logic (`src/lib/`)

**Chart structure**
- `chartTree.ts` — *load-bearing.* Builds the unified account index in one pass (forest, depth, live rollup balances for summaries, broken-parentage detection); cached on array identity. All figure derivation flows through here.
- `fullChart.ts` / `masterChart.ts` — declared demo chart and the ~143-account canonical baseline for guided setup. `SECTION_BANDS` in `fullChart.ts` is an authoring device for these two hardcoded catalogues, not a rule about numbering.

**Guided setup / wizard**
- `guidedSetup.ts` — the eight plain-language onboarding questions; each adds accounts on top of a baseline with a one-line reason. Every answer is optional.
- `wizardEngine.ts` — pure trigger matching of master-chart entries against the user's answers; computes per-step diffs for the preview.

**Ledger & periods**
- `monthlyLedger.ts` — *load-bearing.* Opening/movement/closing per posting account per month; locks months once their period closes. Also exports `lastEndedPeriod`.
- `periodClose.ts` — fiscal-year math, quarter definitions, year-end sweep of net income to Retained Earnings.
- `periodSelection.ts` — resolves scopes (month/quarter/year/ytd/all/custom) to date bounds + aggregate status, and names spans ("Q3 FY2026").

**Journal entries & seed transactions**
- `journalEntry.ts` — *load-bearing.* Reconstructs balanced entries from postings, synthesizes contra lines, derives period from date, flags closed-period blocks.
- `txScenarios.ts` — *load-bearing (large).* 60+ realistic manufacturing scenarios (source doc, debit/credit legs, narration templates, cadence/size) that the seed uses to compose the ledger.
- `seed.ts` — deterministic demo dataset: **Omnesoft Inc.**, FY 2026 (Jan start), USD, Manufacturing; a full multi-category chart, 12 monthly periods (Q1 Hard-Locked, Q2 Soft-Closed, Q3–Q4 Open), and ~2,500 deterministically generated postings. Opening balances derived as `balance − full-year movement`.

**Views, lifecycle, import**
- `coaViews.ts` — saved lenses (filter by type, group by type/section/status, sum postings only).
- `accountLifecycle.ts` — gate logic + confirmation/refusal specs for deactivate/activate/archive/unarchive.
- `uploadValidation.ts` — *load-bearing.* Shared CSV parse/validate for both first-time upload and post-setup import.
- `sourceDocumentLink.ts` — maps a posting's source + reference to the document's page in the module that raised it. A linked document is never previewed in this app; the click opens a new tab.

**Copy / reference data**
- `accountRoleCopy.tsx`, `glAccountTypeCopy.tsx`, `normalBalanceCopy.tsx` — tooltip/legend/help copy for the account model.
- `bankInstitutions.ts`, `currencies.ts`, `mockBankSync.ts`, `partners.ts` — reference data shared with the Cash Management module.
- `utils.ts` — `uid`, currency/date formatters, keystroke-safe amount input helpers.

> Note: KPI logic lives in the components, not in `lib/`. The tests
> `lib/coaKpis.test.ts` / `lib/glKpis.test.ts` import from
> `components/CoaInsights.tsx` / `components/GlInsights.tsx`.

---

## Components (`src/components/`)

- **Scaffolding/nav:** `AppShell`, `PageHeader`, `breadcrumb`, `Pagination`
- **Shared account table/tree:** `AccountTable` (the one table reused across COA listing, build-from-scratch, and guided setup), `AccountChartChip`, `CoaTreeIllustration`, `WizardChartTree`
- **Guided setup UI:** `WizardChrome`, `WizardRightPane`, `BuildEducation`, `AccountNumberingStep`, `NumberingSchemeEditor`, `FiscalYearPicker`, `AccountingPeriodPicker`
- **Insights / KPIs:** `CoaInsights` (defines the COA KPI shelf), `GlInsights` (GL KPI shelf), `DetailInsights`, `ChartWidgetCard`, `DashInfoCard`, `DetailHeaderCard`, `PeriodStrip`
- **Journal entries:** `NewJournalEntryModal`, `JournalEntryQuickView`
- **Banking / partners:** `ConnectBankModal`, `BankInstitutionCombobox`, `BankLogo`, `SetUpAsPartnerModal`
- **Import / mapping:** `FieldMappingTable`, `ColumnSelector`
- **Table utilities:** `TableToolbar`, `Filters`, `BulkActionBar`, `QuickView`
- **Content/metadata:** `CoaViews`, `ActivityFeed`, `ModuleSetupChecklist`, `LinkedDoc`, `AttachmentsTab`, `CountryCombobox`
- **Primitives (`ui.tsx`):** Button, Modal / FormModal / SlideOver / ConfirmModal, Input / AmountInput / Textarea / Select / Toggle, Badge / Pill / Tabs / Menu / KPICard / Card / EmptyState / Banner / Tooltip. Plus `Avatar`, `DateField`, `useDeleteWithUndo`.

---

## Key product decisions (context that isn't obvious from the code)

- **Number ranges (design review, 2026-09-24).** Rules live in `src/lib/numberRange.ts`.
  - Five-digit account numbers by default, demo chart included.
  - A summary's range is a *one-way block*: accounts not under it cannot take a number inside it; its own accounts may sit outside it.
  - *Number protection* (`company.numberProtection`, on by default, no UI control): the stretch from a summary to its last account is kept for its accounts even without a typed range. An import whose numbers clash turns it off as it lands, and renumbering is recommended instead — that import is the only thing that changes it.
  - Defaults cascade for charts Omne builds: a category reserves its whole block (10000–19999), each level down one zero less (1,000 → 100 → 10). Guided setup and build-from-scratch lay charts out this way.
  - A new summary is offered the next clean block of that size (marked Recommended), never the leftover tail; blocks outside the parent are offered only when the parent has none left. Reserving is a toggle, on by default.

- **Two-type chart.** The chart is collapsed to exactly **Posting** and **Summary**
  accounts, with hierarchy declared via `parentId`. The retired GL vocabulary
  (Heading / Begin-Total / End-Total, "group") must not reappear.
- **Control accounts.** Six subledger-owned roles (AR, AP, Bank, etc.) are locked
  against manual posting; that lock must be enforced *everywhere* an account is picked.
- **Derived, not stored.** Balances, period figures, source documents, and journal
  entries are derived from transactions + seed openings rather than stored as
  snapshot state.
- **KPI shelves.** COA has two KPI groups (current balances / last *ended* month);
  GL has four period-scoped activity cards. Cards are role-gated; a month is
  "ended," not "closed."
- **Guided wizard.** Manufacturing is the core chart; *derive, don't ask*; no wrong
  defaults; every question is skippable.
- **Search opens what it found (module-wide, 2026-09-29).** Wherever a collapsible
  table offers a search box, a shut row holding a match opens and the match carries
  the yellow `<mark>`; a row matched only on its *own* text stays shut and marks
  itself there, since opening it would bury the answer. A row that comes back shut
  with no mark is the fault. What the search opens is held apart from the reader's
  own expansion, so clearing the box gives their tree back exactly. Two carriers:
  `AccountTree` (`components/AccountTable.tsx`) and the GL tree view, which splits
  `postingHaystack` from `lineHaystack` precisely to tell "found inside" from
  "found on the parent row". Stated in `e2e/searchOpensCollapsed.spec.ts`.
- **A quick filter must fit the row it filters (GL, 2026-09-29).** Both GL tabs draw
  one pill strip, but each offers its own chips. The Amount range stands ahead of the
  divider on both — it asks about a total either row has. Past the divider the tabs
  part: the tree lists postings, so the five categories are coherent there; the
  entries tab lists whole entries assembled from surviving postings, so a category
  would strike out the other half of every entry crossing two and leave the entry row
  printing a debit total against a credit total that no longer matches. It offers
  **source** instead — every posting of an entry carries the same one, so a source
  keeps entries whole. Entry *type* was measured and rejected: the seed is 97%
  "Simple", so the chips would not slice anything. Counts follow the listed unit —
  source chips count distinct `jeNumber`s, category chips count postings. Both a
  source chosen here and a category chosen there stop filtering across the switch,
  since the other tab draws no chip to clear it from. Stated in
  `e2e/glCountBase.spec.ts`.

  **Source is a dropdown since 2026-09-30; Category stays pills.** Mahad: *"this
  design doesn't look scalable at all"* - a pill per source grows with the data.
  The entries tab's Source is now one searchable `MultiSelectFilter`
  (`components/MultiSelectFilter.tsx`, vendor invoicing's quick filter ported 1 to
  1): the trigger reads "Source: All", the one value picked, or "N selected", clears
  from its own X, and several ticked narrow to their union. Category was made a
  dropdown in the same pass and put straight back - Mahad wants the dropdown on the
  entries tab only: *"Nothing more nothing less."* The General ledger tab keeps Show
  All plus five single-select category pills with counts. The rules above - which
  tab offers which, and the unit each counts in - are unchanged.

  **Source is on both tabs since 2026-09-30, later the same day.** Mahad: *"can we
  also have the source filter in general ledger listing page as well."* The strip
  reads Amount, Source, divider, then (General ledger tab only) Show All and the five
  category pills: both dropdowns open a panel, so both stand left of the divider.
  One list of sources, counted per tab - entries on Journal entries, postings on
  General ledger (`srcOptions`). **A source now holds across the switch**, as Amount
  does: the no-carry rule above existed because the other tab drew no control to
  show or clear it, and it does now. A category still stops at the switch - the
  entries tab still draws no category control.

- **No entry Description, no entry Type on its page; "Journal Entry ID" (2026-09-30,
  supersedes the notes below where they say otherwise).** Mahad: *"Please remove
  description entirly, we will only have memo and line description"*, *"Remove type
  from journal entry detail page"*, *"Change Internal ID to "Journal Entry ID"..."*
  Deleted outright: `entryDescriptionFor`, `ReconstructedEntry.description`,
  `Transaction.entryDescription`, the Journal entries Description column, the entry
  page's Description and Type rows, its Type badge and legend, and the description
  line on a printed entry. The entry page is titled by its JE number, with "Posts to
  <period>" under it. A reversal's record is named "Reversal of JE-…". The ledger
  column and the entry page's rail both read **Journal Entry ID**
  (`JOURNAL_INTERNAL_ID_LABEL`); the account's stays "Internal ID". The entry type
  still exists as data (`entryType`) - only the entry page stopped stating it.

- **Four ledger columns on both tabs, and a journal internal ID (2026-09-30).**
  Mahad: *"Additional column for Journal Internal ID. Column for currency. Column
  for Amount (Foreign currency)... Column for tags in journal entries... in general
  ledger as well."* **Internal ID** is new: `JNL-000001` onward, one counter across
  all years (`lib/internalId.ts`), repeated on each posting as
  `Transaction.entryInternalId`. The seed stamps it oldest first; `addJournalEntry`
  stamps the next for every entry the app posts (form, reversal, archive transfer,
  close). The entry page's rail shows it through the shared
  `components/InternalIdField.tsx`, which the account page now uses too. Store
  version 8. **Currency** is the entry's (`entryCurrency` or base). **Amount
  (foreign currency)** is the entry's total in its own currency on Journal entries
  and the line's own on General ledger; "-" on a base-currency entry. **Tags** are
  read-only chips from `jeTags`, marked by search. All four are searchable,
  sortable and filterable, and ship visible. On Journal entries they sit where the
  design review's order survives: Debit and Credit still follow Amount, and
  Description still follows Journal entry.

- **Journal entry no. and Currency on the new entry form (2026-09-30).** Mahad:
  *"Journal entry no. field in creation. Pre-filled for now and not editable. Field
  for currency on the journal entry."* Row one is Date | Journal entry no. |
  Currency. The number is `nextJeNumber` for the date's year, drawn locked with a
  padlock, and it is the number Post issues. Currency defaults to base; picking
  another means the lines are typed in it, and the entry posts **in base at the
  spot rate** (`CURRENCY_META[code].rate`, stated with its source and as-of - the
  module has no rate history). `toBaseLines` converts in cents and puts any
  rounding cent on the largest line of the short side, because `reconstructEntry`
  pads an entry whose base sides differ by more than half a cent. Postings keep
  `entryCurrency`, `entryRate`, `fxDebit`, `fxCredit`; the entry page shows its
  Currency and an Exchange rate row in the rail (no header chip since 2026-10-09), and each amount as typed with the base
  figure beneath. The ledger, balances and exports stay in base. A reversal of a
  foreign entry posts the base figures only. Stated in
  `src/lib/entryCurrency.test.ts` and `e2e/entryNumberAndCurrency.spec.ts`.

- **The new journal entry form has no Description field (2026-09-30).** Mahad:
  *"Remove this from New journal entry modal."* An entry written there carries no
  `entryDescription`, so `entryDescriptionFor` names it "Manual journal entry" -
  on its page's title and in the ledger's Description column. The Description
  column and the entry page's Description row stay: seeded, system and reversal
  entries still have titles of their own. Memo keeps the full width under Date.

- **Me mode is hidden, not deleted (2026-09-30).** Mahad: *"Hide me mode feature
  from this entire module for now ... do keep it in the code."* One switch,
  `ME_MODE` in `src/lib/features.ts`, gates the Chart of Accounts' Me mode pill,
  its filter (read as off, so a pill left on earlier in the session cannot narrow
  the chart invisibly), and the "you created this" user icon beside a row's
  checkbox in both table layouts. Set it to `true` to bring all of it back; grep
  `ME_MODE` for every place it gates. Stated in `e2e/meModeHidden.spec.ts`.

- **Four ledger pointers (2026-09-30).**
  - **Unarchive is confirmed.** *"One click makes the account active again straight
    away."* `effectLines` now gives unarchive a line (Mahad's copy of 2026-10-09: "will
    be restored to your chart of accounts and reports, and can be used in
    transactions again" / "... Accounts under it remain archived"); activate still
    asks nothing.
    `useAccountLifecycle().request` turns an `activate` on an Archived account into
    `unarchive`, because the detail page menu sent `activate` and so skipped it.
  - **Source names come from `sourceDocName`** (`lib/seed.ts`), not CSS
    `capitalize`: title case, except a source with its own `name`. The archive
    transfer reads "Archive transfer", as its Type does. The Source *header filter*
    still lists raw keys ("Manual JE") - not touched.
  - **The PDF dates each figure column:** "Opening balance as of <period start> ·
    Running balance and Foreign balance as of <as-of day>", naming only the columns
    exported. Replaces "Balances as of ...", which dated the opening figure wrongly.
  - **Memo is `entryMemo(t)`** (`lib/journalEntry.ts`): `t.memo ?? t.description`.
    The General ledger tab's Memo column read the line's text, so a typed memo never
    reached it; and a blank memo borrowed the first line's text. The form now stores
    a blank memo as `""`, so only a seeded posting (no memo at all) falls back to its
    narration. *"The memo you type goes into Description"* did not reproduce.
    **Later the same day the General ledger tab dropped Memo for Line description.**
    Mahad: *"A memo is suitable at the overall Journal Entry level since it applies
    to the entire transaction, whereas individual line items require specific line
    descriptions."* `description` (Memo) is `listOnly` now; `lineDescription` shows
    on both tabs - on the General ledger tab as each posting's own text.
  Stated in `e2e/unarchiveAndMemo.spec.ts`, `exportPdf.spec.ts`, `ledgerFixes.spec.ts`.

- **Journal entries carry tags (2026-09-30).** Mahad supplied Cycle Count +
  Partners' EntityTagChip spec (PDF) and asked for it on journal entries only: a
  **Tags** field in `NewJournalEntryModal` under Memo, and the same chips last in
  the detail page's "Journal entry information" card. One file,
  `components/EntityTagChip.tsx`: `TagChip` (22px, slate-50/200/800, 8px corner,
  12px/500), `TagStrip` for the detail page (tag icon, removable chips, dashed Add
  Tag, a 24px input + Save + Cancel row; Enter/Save commits, Cancel/Escape discard,
  **no commit on blur**), `TagInputField` for creation (Enter or comma adds; blur
  adds what is left, since there is no Cancel there to protect). Both run the one
  `checkTag`: 8 per entry (Add Tag goes at 8), 30 characters clamped while typing,
  whitespace collapsed, duplicates matched without case and refused with *"x" is
  already added.* Stored as `jeTags` (JE number to tags) beside the entry, like
  `jeAttachments`, and persisted. Not searchable or shown in the ledger - he asked
  for the two surfaces and nothing else. `DashInfoCard` now follows its content's
  height with a ResizeObserver; before, an editor opening inside it was clipped.
  Stated in `e2e/entryTags.spec.ts`.

- **Dimension defaults are cards, not a table (2026-09-29).** Mahad: *"the current UI
  doesn't look good; it feels very clunky, and the layout isn't intuitive"* — naming
  the Partners module's Freight & Logistics modal as the shape to take. A card per
  dimension the account carries, two fields in it, and one dashed **Add another
  dimension** under them. What went was a table of **every** dimension the tenant had
  ever defined, split under "Set on this account" and "Available, not applied". Those
  captions existed to answer a real complaint — defining a dimension from one account
  makes it *offered* on every account, and a table listing it everywhere read as
  *applied* everywhere — but cards settle that by construction instead of labelling
  around it: only what the account carries is drawn, so there is no second group left
  to misread. What is merely available now lives inside the Dimension dropdown, which
  is where a list of things you could pick belongs.

  Both creates are inside the pickers, and both write back onto the card that asked —
  the reason you typed a thing is that you want it, so nobody goes and finds it in the
  list they just came from. Both stand whether or not anything has been typed, which is
  `Select`'s new opt-in `createAlways` — Mahad, 2026-09-29: *"there should be an option
  to add new value on the go... similar to create new dimension"*. What a standing row
  costs is that it must have somewhere to send a reader who typed nothing, and failing
  that is exactly the 2026-09-23 bug it was once taken out for: *"'Create new value' in
  the Choose dropdown doesn't do anything when you click it."* So the two rows answer an
  empty click differently by what their record is. A dimension is a name *and* its
  values, so it always opens the dimension form, with anything typed riding along as the
  name. A value is only its name: typed, that is the whole record and it is made on the
  spot with no form in the way; untyped, the row opens a one-field modal that asks for
  the name and refuses one the dimension already holds. Either way the click lands, and
  `createAlways` stays what it says on the tin — a licence to stand, not a licence to
  offer something that cannot be met.

  The row sits **above** the list rather than pinned under it, tinted rather than
  bordered — Mahad, 2026-09-29, pointing at the carrier picker: the way out of a list you
  have searched and failed is the first thing to reach, not something to scroll past the
  failure to find. That is in `Select` itself, so it is module-wide; the only other
  `onCreate` in the module is a `ViewsMenu` sitting behind `false &&`. Its position is
  guarded in the browser (`e2e/dimensionValues.spec.ts` compares bounding boxes), because
  the row is in the markup either way and only a real render can tell the two apart.

  Three deliberate departures from the carrier card it is drawn from. The remove **X**
  is always offered, including on the last card, because an account carrying no
  dimensions is a legal account whereas a shipping config needs a carrier. There is no
  **Primary** — dimensions have no equivalent. And a card takes **one** value, not a
  set: the field stamps what each posting *starts with*, and two defaults for one
  dimension is not a thing a posting could carry. Partners' own "Create New Carrier" was
  read and **not** copied — it is dead plumbing that never returns its carrier to the
  picker; the working "Create Shipping Method" write-back is what was ported. Stated in
  `src/pages/glDimensionsStep.test.ts` and `e2e/dimensionValues.spec.ts`.

  One knock-on in `ui.tsx`: `Select`'s `ariaLabel` now **wins over** `label` instead of
  being ignored beside it. A `Select` trigger is a button, not an input, so a visible
  `<label>` never named it in the first place; repeating one field down a list of cards
  left every trigger reading only its own value, which is the same set-of-identical-
  controls problem the prop was added for. Each card now names both of its triggers for
  the dimension it sits on. No existing call site passed both, so nothing else moved.

## Language & copy conventions

- Use **"summary account"** and **"the accounts under it"** — never "group" or the
  retired Heading/Begin-Total/End-Total terms (lint-enforced).
- COA/GL copy is **sentence case, no em dashes**, with locked terminology per the
  authoritative UX copy spec (`~/Downloads/omne-coa-gl-ux-copy.md`).

---

## Testing

25 Vitest unit-test files sit next to the code they cover (`*.test.ts[x]`),
concentrated on the load-bearing pure logic: `chartTree`, `monthlyLedger`,
`periodClose`, `periodSelection`, `journalEntry`, `coaViews`, `uploadValidation`,
`guidedSetup`/wizard steps, `accountLifecycle`, and the KPI shelves. Run with
`npm test`.

> Note on browser testing: there is no browser automation in this environment.
> `renderToStaticMarkup` works, but Zustand feeds it initial state, `Select`
> renders no options, and `WizardChrome` portals can't render — verify UI in a
> real dev server.
