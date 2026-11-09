# Task: Fix the Create Account modal — Dimensions flow + UI audit

## What you're doing

The Create Account modal at `src/pages/CreateAccount.tsx` has one major flow problem (the Dimensions & Tagging Policy section) and a handful of smaller UI issues across the modal. This task addresses both: redesigns the Dimensions section so the two concepts inside it are clearly distinguished, and tightens the rest of the modal where it's adding cognitive load.

This is a **focused refactor**, not a rebuild. Keep the existing component primitives (`Input`, `Select`, `Toggle`, `Badge`, `Button` from `src/components/ui.tsx`) and design tokens (`tailwind.config.js`). Do not introduce a new component library.

## Where the code lives

- `src/pages/CreateAccount.tsx` — the modal/slide-over. **This is the file to edit.**
- `src/components/ui.tsx` — existing primitives. Reuse only.
- `src/types.ts` — `Account.dimensions` and `Account.postingRestrictions.requiredDimensions` already exist; no schema changes needed.
- `src/lib/seed.ts` — `seedDimensions` lists the available dimension values per type.

---

## Part 1 — Rebuild the Dimensions & Tagging Policy section

### The two concepts (be explicit about them in the UI)

Split the section into two clearly-labelled subsections with a visible divider between them:

#### A. Required dimensions at entry

A **governance rule**. Postings to this account will be blocked unless they supply the chosen dimensions (BR-011).

UI:

```
Required at entry
Postings missing any of these will be blocked.

[ Department ]  [ Class ]  [✓ Location ]  [ Tax Code ]  [ Tracking ]
```

- Render as five toggleable pills (one per dimension type).
- Selected pills use **primary blue background + white text** (`bg-primary text-primary-foreground`). Unselected use **white background + neutral border + muted text** (`bg-white border-border text-fg-muted`).
- Add a small check icon (`Check` from lucide) inside selected pills so state is unambiguous beyond color alone.
- Below the pill row, render a live counter when at least one is selected: `"3 dimensions required at entry · postings missing any will be blocked (BR-011)"`. When none are selected, show: `"No dimensions required — postings will not be gated."` (muted text).

#### B. Pre-attached default dimension values

A **convenience**. Specific dimension values that get auto-filled onto every posting to this account. Distinct from "required" — required is a *policy*, pre-attached is a *value*.

UI:

```
Pre-attached defaults (optional)
These values will be auto-filled on every posting to this account.

[+ Add default tag]

  Department: Engineering   ✕
  Location: Karachi HQ      ✕
  Tracking: Fabtech 2026    ✕
```

- A single primary action button `+ Add default tag` (do NOT split into "pick type" + "pick value" as two parallel dropdowns).
- Clicking it opens a small inline popover (or expands an inline picker row) with **one** combined dropdown that lists all available dimension values grouped by type, with a search box at the top. Example structure:
  ```
  Search…
  
  Department
    Engineering
    Sales
    Marketing
    …
  Class
    Direct
    Indirect
  Location
    Karachi HQ
    Lahore
    Dubai
  Tax Code
    Standard 17%
    Zero-rated 0%
  Tracking
    Fabtech 2026
    Summit 2026
    Project Aurora
  ```
- Selecting a value adds it as a chip below the button. Each chip shows `Type: Value` plus an `✕` to remove. Use the existing `badge-neutral` class for chip styling.
- If no defaults are added, show empty state placeholder text under the button: `"No default tags. The user supplies dimensions at posting time."` (muted, small).

### Visual separation between A and B

- Add a thin horizontal divider (`border-border`) between the two subsections.
- Each subsection has its own H4 (`text-sm font-semibold`) and a one-line description in muted text.
- Drop the parent heading "Dimensions & Tagging Policy" — replace with two clear subsection headings.

---

## Part 2 — Modal-wide UI audit fixes

Apply each fix. They're independent; don't bundle them.

### 2.1 Posting Type — convert to a segmented control

Currently two toggles labelled "Posting account" and "Header / Summary account" that are visually independent but logically mutually exclusive. Replace with a single segmented control (radio pair styled like a pill toggle):

```
Posting Type
[ ● Posting account ]  [ ○ Header / Summary ]
Transactions can be posted directly        Aggregates child balances —
to this account.                            cannot be posted to (BR-004)
```

- Use the same visual pattern as the List/Tree view toggle on the main Chart of Accounts page (existing pattern, `ViewToggle` in `src/pages/ChartOfAccounts.tsx`).
- The selected option's helper text appears below the row, not next to each option.

### 2.2 Currency field — move "— Base" out of the value

Currently the dropdown shows `USD — Base` as the selected value. The "Base" indicator is metadata, not part of the currency code.

- Selected value: just `USD`.
- Helper text under the field when the currency equals the tenant base: `"Tenant base currency"` (muted).
- Helper text when it differs: `"Non-base currency — FX flag will apply (BR-010)"` (with warning tone color).

### 2.3 Decision Transparency panel — tighten the visual hierarchy

The panel is currently a wall of grey text. Restructure each row as:

```
─────────────────────────────
ACCOUNT TYPE
[Expense badge]  Normal balance: Debit
Operating and non-operating costs.

POSTING TYPE
[Posting badge]
Transactions from sub-ledgers (AP, AR, GL) will route into it.

ROUTING PREVIEW
● AP Bills → New Expense

VALIDATION ON SAVE
✓ Account number is unique (BR-001)
✓ Child type matches parent (BR-003)
✓ Effective date ≥ fiscal year start (BR-008)
```

- Each sub-heading uses small uppercase muted caption style: `text-2xs uppercase tracking-wider font-semibold text-fg-subtle`.
- Add a thin divider (`border-border-subtle`) between each section.
- Use the existing `Badge` component for the type/posting badges so they match the rest of the app.
- Convert the "On save we'll validate" prose into a checklist with `Check` icons in `text-success-700`.

### 2.4 Sticky modal footer

The Cancel and Create account buttons should be **sticky to the bottom of the modal viewport** (not scroll with the content). White background, top border `border-border`, same buttons.

This matters because the modal is tall and the user shouldn't have to scroll to the bottom to commit or cancel.

### 2.5 Required-field indicator pattern

Currently fields use `Field Name *` with a red asterisk. Keep the asterisk but also add `(required)` to the helper text on the first field of each section, so the pattern is teachable. After that, the asterisk alone is enough.

Alternatively (cleaner): flip the convention — mark **optional** fields with `(optional)` in the label and leave required fields unmarked. Apply consistently to every field in the modal.

I'd lean toward the second option since most fields ARE required.

### 2.6 "Full view" button — clarify or remove

The icon button in the modal header (top-right, next to the X) reads "Full view." If it switches the modal into a slide-over panel (or vice versa), label it explicitly:

- `Expand to side panel ↗`  (when in modal)
- `Collapse to modal ↙`  (when in slide-over)

If the two views don't actually differ functionally, **remove the button entirely**.

### 2.7 Section header weight

Section headings (`Hierarchy`, `Scope & Effective Date`, etc.) are currently `text-sm font-semibold` with a description below. The description sentences are full-width and add a lot of vertical space.

Two cleanups:
- Move the description to a `<span class="text-fg-muted">` inline after the heading, separated by a `·`, when it's short enough (≤8 words).
- Drop redundant descriptions where the field labels already explain it (the Hierarchy heading says "Child type must match parent type. Header/summary accounts cannot be posted to directly." — this is already in the Posting Type helper text and the Parent Account validation; drop it).

### 2.8 Scope & Effective Date — collapse Subsidiary when single-entity

If `company.subsidiaries.length <= 1`, hide the Subsidiary/Division field entirely (it adds noise when there's only one option). Show it only when the tenant has multiple subsidiaries.

The seed has two subsidiaries by default, so this won't fully disappear in dev — but the rule should be in place for production tenants that only have one.

---

## Acceptance criteria

When done, the following are true:

1. The "Dimensions & Tagging Policy" heading is replaced by two clearly-labelled subsections: "Required at entry" and "Pre-attached defaults (optional)", separated by a divider.
2. The required-dimensions pills visibly differentiate selected from unselected states (color + check icon).
3. The pre-attached defaults section uses one "+ Add default tag" button that opens a grouped, searchable single picker — not two parallel dropdowns.
4. Added defaults appear as removable chips below the button.
5. Posting Type is a single segmented control, not two independent toggles.
6. The Currency dropdown shows just the currency code; "Base" / FX status appears as helper text.
7. The Decision Transparency panel uses captioned subsections with dividers and an icon-based validation checklist.
8. The Cancel and Create account buttons are sticky at the bottom of the modal viewport.
9. Required vs optional field convention is consistent across the modal (one pattern, applied everywhere).
10. The "Full view" button is either labelled clearly or removed.
11. Section header descriptions are inline or removed where redundant.
12. Subsidiary/Division field is hidden when the tenant has ≤1 subsidiary.
13. `npm run build` passes with no TypeScript errors.
14. The modal still feels visually consistent with the rest of the Chart of Accounts app — no new colors, fonts, or component libraries introduced.

---

## Out of scope

- Do not change the data model (`Account`, `Dimension`, `PostingRestrictions`) in `src/types.ts`.
- Do not change the Create flow's validation logic in `src/store.ts`.
- Do not redesign the Account Detail page or any other screen.
- Do not animate transitions beyond simple Tailwind `transition-colors` / `transition-all`.
- Do not introduce new dependencies. Everything can be built with what's already in `package.json`.
