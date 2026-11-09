# Task: Rework the Chart of Accounts Guided Setup Wizard

## What you're doing

Replace the current implementation of the **Guided Wizard** path inside the Chart of Accounts setup flow with a deeper, branching, question-driven wizard that produces a tailored starting chart. The Upload and Build-from-Scratch paths in the same setup screen stay as they are — only the wizard path changes.

## Where the code lives

This is a Vite + React + TypeScript project. Relevant files:

- `src/pages/Setup.tsx` — current setup screen with the three-path selector and a placeholder wizard. **This is the primary file to rewrite.**
- `src/pages/ChartOfAccounts.tsx` — main screen. The wizard's three-path modal is launched from here when `setupComplete === false`. After publish, return the user here.
- `src/types.ts` — `CompanyConfig` already has `setupComplete`, `fiscalYearStart`, `baseCurrency`, `industry`, `subsidiaries`. Use these. Add a `pendingReview?: boolean` field on Account if not already present (it is — keep it).
- `src/store.ts` — Zustand store. Use `useStore.getState().createAccount(...)` and `useStore.getState().setCompany({ setupComplete: true })` when publishing.
- `src/lib/seed.ts` — reference for account shape, numbering, and how dimensions are attached.
- `src/components/ui.tsx` — **reuse these primitives only**: `Card`, `CardHeader`, `Button`, `Input`, `Select`, `Toggle`, `Badge`, `Banner`, `Modal`. Do not introduce new component libraries.
- `src/components/PageHeader.tsx` — keep using this for the page header.
- `tailwind.config.js` — design tokens are already defined. **Match the existing Chart of Accounts screen exactly**: same typography, color tokens, spacing, buttons, chips, badges, table styling as `src/pages/ChartOfAccounts.tsx`. Do not invent a new visual language.

The account types and reserved number ranges are defined in `src/types.ts` (`ACCOUNT_TYPE_META`) and `src/lib/seed.ts` (`seedNumberingScheme.typeRanges`) — use these, do not hard-code numbers.

---

## Critical constraints

1. **One-time only.** The wizard runs once per tenant and is retired on completion (set `company.setupComplete = true` via `setCompany`). It must NOT be re-runnable, even if accounts are later deleted. After setup, accounts are added via Import or Add Account — never by re-running this wizard. The three-option setup modal in `ChartOfAccounts.tsx` only appears pre-setup; gate it on `!company.setupComplete`.

2. **Reads, never sets, company-level settings.** Fiscal Year Start and Base Currency are owned by Company Setup. Show them read-only for context. If `company.fiscalYearStart` is empty, block the wizard with a prompt to finish company setup first (use the `Banner` component, tone="danger", with a CTA button labeled "Open Company Setup" that for now just shows a toast or stub — leave a TODO comment).

3. **Nothing is generated silently.** Every account the wizard creates carries a short, plain-language "why this is here" note — the impact copy listed under each question below. Store this on the Account record using a new field, **add `setupNote?: string` to the `Account` interface in `src/types.ts`** and persist it. Surface this note on the account's detail page (`src/pages/AccountDetail.tsx` → Overview tab → Side information panel → new row labeled "Why included").

4. **Mark wizard-generated accounts** with `pendingReview: true` until the user confirms them on the review step. This feeds the "Pending Review" KPI card on the main screen, which already counts `pendingReview === true`.

---

## Layout

Two-pane wizard inside the Setup page when the user selects the Wizard path:

- **Main pane (left, ~2/3 width)**: one question at a time, with its answer options and a step progress indicator: "Step 3 of 9". Back/Next navigation; all previous answers must be revisitable.
- **Side pane (right, ~1/3 width)**: a live **"How this shapes your chart"** panel that updates the instant an answer is selected. It lists the accounts that answer adds or removes, plus the plain-language reason from the impact copy.

Use the same side-pane treatment as the existing `SlideOver` `side` prop in `src/components/ui.tsx` for visual consistency, or build it as a sticky Card on the right column.

Step indicator: reuse the existing `StepIndicator` component at the top of `Setup.tsx` and extend it to support the wizard's step count.

---

## Flow

1. **Orientation step** (Step 0 / introduction): explain the wizard and set expectations: *"We'll ask a few questions about your business, then build a starting chart of accounts you can adjust. You can edit, add, or import accounts anytime afterward — but this guided setup runs only once."* Show the inherited Fiscal Year + Base Currency read-only here (pulled from `company.fiscalYearStart` and `company.baseCurrency`).

2. **Question sequence** (Steps 1–9): the nine questions below, one per step, each updating the live impact panel and the working account set.

3. **Review & adjust** (Step 10): show the generated chart as an expandable tree grouped by section (Assets, Liabilities, Equity, Revenue, Cost of Goods Sold, Expenses). Every account is **pre-checked**; unchecking removes it from the final chart. Each account shows its one-line `setupNote`. The user can rename inline, add ad-hoc accounts, or remove. Re-use the visual treatment of the Tree view from `src/components/AccountTable.tsx`.

4. **Confirm & generate**: auto-number all accounts per the numbering rules below, call `store.createAccount(...)` for each, set `pendingReview: true` and `setupNote: "..."` on each, set `company.setupComplete = true`, then route the user to `/chart-of-accounts`.

5. **Retire**: the three-path setup selector in `ChartOfAccounts.tsx` is now gated on `!company.setupComplete`, so the wizard cannot be re-entered.

Persist the working state (answers and working set) in memory across steps so the user can go Back without losing answers. Also persist to the store under `company.wizardDraft?: { answers, workingAccounts }` so that an accidental refresh during setup recovers the in-progress state.

---

## Numbering (fixed — never ask the user)

Auto-number every generated account by type using the tenant's segmented format from `seedNumberingScheme`:

- Assets → 1000–1999 range (`100-1xxx-00`)
- Liabilities → 2000–2999 range (`200-2xxx-00`)
- Equity → 3000–3999 range (`300-3xxx-00`)
- Revenue → 4000–4999 range (`400-4xxx-00`)
- Cost of Goods Sold → 5000–5999 range (`500-5xxx-00`)
- Expenses → 6000+ range (`600-6xxx-00`)

Within each range, increment by 10 (1010, 1020, 1030, …) so users have gaps to insert their own accounts later. Use the existing `store.suggestNextNumber(type)` helper as a starting point but extend it to allocate a batch when generating the wizard's chart.

---

## Always-included base accounts (regardless of answers)

These must appear in every generated chart:

- At least one Cash/Bank account (default: "Operating Cash") — Asset
- The correct equity account(s) per Q2
- A general Sales/Revenue account — Revenue
- Core operating expenses: Rent, Utilities, Office Supplies, Bank Fees — Expense

---

## Questions

Each question follows the same structure: the question text, answer options, the impact copy (what the side panel says when an option is selected), and the accounts added/removed. The impact copy IS the `setupNote` on each added account.

### Q1 — "What does your business do?"

**Options:** searchable industry list + "General business"

**Impact copy:** "We'll pre-load the accounts most [industry] businesses use so you don't start from a blank page. You can remove any you don't need on the review step."

**Accounts added (industry-specific):**

- **Construction** → Work-in-Progress (Asset), Job Materials (Asset), Contract Revenue (Revenue), Cost of Sales (Cost of Goods Sold)
- **Retail / Wholesale** → Inventory (Asset), Cost of Goods Sold (Cost of Goods Sold), Sales Returns (Revenue, contra)
- **Professional Services** → Service Revenue (Revenue), Reimbursable Expenses (Expense); little to no Cost of Goods Sold
- **Restaurant** → Food & Beverage Cost of Goods Sold (Cost of Goods Sold), Tips Payable (Liability)
- **SaaS / Subscription** → Subscription Revenue (Revenue), Deferred Revenue (Liability)
- **General business** → a balanced default set

### Q2 — "How is your business structured for tax?"

**Options:** Sole proprietor · Partnership · Multi-member LLC · LLC taxed as S-corp · S-corp · C-corp

**Impact copy + accounts (shapes the Equity section):**

- **Sole proprietor** → *"We'll set up Owner's Capital and Owner's Draw. You won't have formal Retained Earnings — profit flows to your personal return."* Adds: Owner's Capital, Owner's Draw.
- **Partnership / Multi-member LLC** → *"We'll create a capital and draw account per partner to track each owner's contributions and distributions."* Adds: Partner Capital (per partner), Partner Draw (per partner). Prompt for partner names.
- **LLC taxed as S-corp / S-corp** → *"We'll add Common Stock, Additional Paid-in Capital, Shareholder Distributions, Retained Earnings, and a Shareholder Loan account."* Adds those.
- **C-corp** → *"We'll add Capital Stock, Additional Paid-in Capital, Retained Earnings, and Dividends Payable, with optional Preferred Stock."* Adds those.

### Q3 — "What accounting method do you use?"

**Options:** Cash · Accrual

- **Accrual** → *"We'll add Accounts Receivable, Accounts Payable, Prepaid Expenses, and Accrued Liabilities so your books reflect what you're owed and owe, not just cash."* Adds those (+ Deferred Revenue if Q1 = subscription/SaaS).
- **Cash** → *"We'll leave out receivables, payables, and accruals so your chart stays lean."* Adds none of the accrual accounts.

**Smart nudge:** if Q2 = C-corp, show "Accrual is generally required for C-corporations and larger companies" and recommend Accrual (do not force).

### Q4 — "Do you sell products and track inventory?"

**Options:** Yes · No

- **Yes** → *"We'll add an Inventory asset account and Cost of Goods Sold so you can match product costs to sales."* Adds: Inventory (Asset), Cost of Goods Sold (Cost of Goods Sold), Inventory Adjustments (Cost of Goods Sold).
- **No** → adds nothing; keeps the chart service-only.

### Q5 — "Do you run payroll or have employees?"

**Options:** Yes · No

- **Yes** → *"We'll add payroll expense and payroll-tax liability accounts so wages and the taxes you withhold are tracked separately."* Adds: Wages & Salaries Expense (Expense), Payroll Taxes Payable (Liability), Employee Benefits Expense (Expense). If Q2 = S-corp or LLC-as-S-corp, also add Officer / Shareholder Salary (Expense).

### Q6 — "Do you collect sales tax / VAT / GST?"

**Options:** Yes · No

- **Yes** → *"We'll add a Sales Tax Payable account to hold tax you collect until you remit it."* Adds: Sales Tax Payable (Liability), and wire it for tax-code mapping (attach a default `TaxCode` dimension from the seed dimensions).

### Q7 — "Do you own fixed assets (equipment, vehicles, property)?"

**Options:** Yes · No

- **Yes** → *"We'll add fixed-asset accounts plus Accumulated Depreciation and Depreciation Expense so you can capitalize and depreciate large purchases."* Adds: Fixed Assets (Asset), Accumulated Depreciation (Asset, contra), Depreciation Expense (Expense).

### Q8 — "Do you have loans, credit lines, or financing?"

**Options:** Yes · No

- **Yes** → *"We'll add loan and interest accounts so financing and the interest you pay are tracked."* Adds: Loans/Notes Payable — current (Liability), Long-Term Debt (Liability), Credit Card Payable (Liability), Interest Expense (Expense).

### Q9 — "Will you transact in more than one currency?"

**Options:** Yes · No

- **Yes** → *"We'll add foreign-exchange gain/loss accounts and flag any account in a non-base currency for revaluation."* Adds: Realized FX Gain/Loss (Revenue), Unrealized FX Gain/Loss (Revenue). Enable the FX flag on foreign-currency accounts. (Only meaningful on multi-currency tenants — show the question only if `company.baseCurrency` is set and the tenant supports multi-currency; otherwise skip.)

---

## Edge cases

- **No fiscal year in Company Setup** → block the wizard with a `Banner` (tone="danger") and a CTA to finish company setup. Disable all wizard navigation until the fiscal year is set.
- **User exits mid-wizard** → save progress to `company.wizardDraft` and resume into the wizard on next open (still pre-setup). Do not lose answers.
- **User unchecks accounts on review until a required account type is empty** → block Publish with a `Banner` (tone="warning") listing the missing required types. Required account types: at least one Cash/Bank (Asset), one Equity account, one Revenue account, and the core operating expenses (Rent, Utilities, Office Supplies, Bank Fees).
- **Re-answering a previous question** → recompute the working set from scratch using all current answers. Do not leave orphaned accounts from a previously-selected option.

---

## Acceptance criteria

When you're done, the following should all be true:

1. Visiting `/chart-of-accounts` on a fresh tenant (no `setupComplete`) opens the three-path setup modal. Selecting Guided Wizard enters the new flow.
2. The wizard cannot be opened or re-run once `setupComplete === true`.
3. Each of the 9 questions updates the side panel in real time as the user changes their answer.
4. Going Back to a prior question preserves all later answers; changing a prior answer recomputes the working set deterministically.
5. The review step shows the working chart grouped by section, each account pre-checked, each with its `setupNote` visible.
6. Publish creates every checked account in the store with `pendingReview: true` and the `setupNote` populated, sets `setupComplete: true`, clears `wizardDraft`, and navigates to `/chart-of-accounts`.
7. On the main screen, the "Pending Review" KPI card reflects the new accounts.
8. On an account's detail page (Overview → Side information), the new "Why included" row shows the `setupNote`.
9. No new colors, fonts, or component libraries are introduced. The wizard visually matches `ChartOfAccounts.tsx`.
10. `npm run build` passes with no TypeScript errors.

---

## Stretch (only if time permits)

- Auto-attach a default Department dimension to People Costs accounts when Q5 = Yes.
- On the review step, show the next-available auto-number next to each account name in muted text.
- Animate the side panel diff (added accounts fade in, removed fade out) using a CSS transition — no new animation library.
