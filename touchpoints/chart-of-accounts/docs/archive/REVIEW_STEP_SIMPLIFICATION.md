# Task: Simplify the Review & Publish step of the Setup Wizard

## What you're doing

The final step of the guided setup wizard ("Review and adjust your chart of accounts") is currently too busy: it duplicates information across panels, repeats identical explanations on sibling rows, gives equal weight to fields that don't matter at this stage, and lacks a sticky call-to-action. This task tightens the page so the user can scan, adjust, and publish without scrolling and squinting.

This is **not** a redesign — it's a cleanup. Keep the existing visual language (typography, colors, spacing tokens, component primitives). The Upload and Build-from-Scratch paths are unaffected.

## Where the code lives

- `src/pages/Setup.tsx` — the wizard page. Find the review step (the step that renders sections grouped by type with checkboxes for each account). **This is the primary file to modify.**
- `src/components/ui.tsx` — reuse existing `Badge`, `Button`, `Card`, `Banner` primitives only. Do not add new components or libraries.
- `src/lib/seed.ts`, `src/types.ts`, `src/store.ts` — no schema changes needed. Account `setupNote` (per the wizard rework spec) is the source of the per-account "why included" line.

---

## The ten changes

Apply each change. Each one is independent — if one is risky, isolate it but still complete the others.

### 1. Replace the right-side "How this shapes your chart" panel with a publish summary

On the review step only, the right pane currently mirrors the same accounts shown on the left. Replace its contents with a sticky summary card containing:

- `13 accounts ready` (live count of currently-checked accounts)
- A per-section mini-breakdown: `Assets · 2  ·  Equity · 4  ·  Revenue · 1  ·  Cost of Goods Sold · 1  ·  Expenses · 5`
- A small validation status line: `✓ All required types covered` (success) or `⚠ Missing required Equity account` (warning) — see Edge Cases in the original wizard rework spec for required-types validation
- A primary `Publish chart →` button
- A secondary `Back` button

This panel becomes the user's source of truth for "what am I about to commit to and how do I commit it." On all other steps (the 9 questions), the right pane keeps its current "How this shapes your chart" content.

### 2. Collapse duplicate explanatory copy

Three places currently say variants of the same thing on the review step:

- The wizard subtitle ("Answer a few questions about your business…")
- The left-side heading sentence ("Every account is selected by default. Clear an account to remove it…")
- The right-pane intro ("This is the full chart of accounts we have assembled…")

Keep only the **left-side instruction**, which is the one adjacent to the action. Delete the subtitle text on this step and (per change #1) the right-pane intro is removed anyway.

### 3. Move per-account explanations to section headers when they're identical

When two or more accounts in a section share the same `setupNote`, render the note **once** at the section header level and omit it from each row.

Detection: group accounts by section. Within a section, if every account's `setupNote` is identical, show the note under the section heading and skip per-row notes. Otherwise, keep per-row notes (mixed sections — e.g. Assets with Cash + Inventory having different notes — keep per-row).

Visual example for an all-identical section:

```
Equity · 4 included                              [+ Add account]
Capital and draw accounts for each partner, so you can
track contributions and distributions.

  ☑ Partner 1 Capital                       300-3000-00
  ☑ Partner 1 Draw                          300-3010-00
  ☑ Partner 2 Capital                       300-3020-00
  ☑ Partner 2 Draw                          300-3030-00
```

For mixed sections, the section-level note is omitted entirely and each row shows its own note as before.

### 4. Hide empty sections

If a section has zero accounts (e.g. Liabilities when the user answered "No" to loans, payroll, and sales tax), do not render the section card at all. Do not show the "No accounts in this section" placeholder.

Add a single secondary action at the bottom of the section list: `+ Add a Liability account` / `+ Add other accounts` — opens a small menu of section types and lets the user add ad-hoc accounts to sections they declined. This preserves the ability to add without cluttering the default view.

### 5. Demote account numbers to muted right-aligned mono text

Currently account numbers (`100-1000-00`) sit next to names with similar weight. Restyle them:

- `text-2xs font-mono text-fg-subtle` (or equivalent muted treatment)
- Right-aligned in the row
- Wrap to a second line only on very narrow viewports

The user is reviewing inclusion and names, not numbers — numbers are auto-generated and editable later.

### 6. Remove the 10-step indicator on the review step

Replace the 10-checkmark progress bar with a single line at the top of the page:

```
Step 10 of 10 · Review and publish
```

Render this as a small caption (`text-xs text-fg-muted`) above the page heading. The earlier 9 question steps keep their existing step indicator — only the review step uses this compact form.

### 7. Replace the two "Inherited from Company Setup" rows with one chip row

The two large fields showing Fiscal Year Start and Base Currency, each with a "Inherited from Company Setup" caption below, take up a full section on the page. Replace with one inline pill row directly under the page heading:

```
[ 📅 FY 2026-01-01 ]   [ 💵 USD ]   Managed in Company Settings →
```

- Each value as a `Badge` (tone="neutral") with a small icon
- The "Managed in Company Settings" link is a single text link (right-aligned in the row or trailing the badges)
- No card, no helper text below each value

### 8. Remove the trash-icon row action; keep the checkbox

Each account row currently has both a checkbox (toggle inclusion) and a trash icon (remove). They do the same thing. Remove the trash icon. The checkbox alone communicates "uncheck to skip."

If the user wants to delete an account they added themselves and now regret, an "Undo add" affordance can appear briefly after they add an account via the `+ Add account` button — but that's optional polish, not in scope here.

### 9. Add a sticky footer with the publish CTA

Across the bottom of the review step (sticky to the viewport bottom, not the page bottom), render:

```
13 accounts ready                              [ Back ]   [ Publish chart → ]
```

- White background, top border using `border-border`
- Live count updates as the user toggles checkboxes
- Disabled `Publish chart` button + warning tooltip when validation fails (e.g. no equity account selected)

This is in addition to the publish button in the right-pane summary card (#1) — they're complementary. The footer is always visible; the summary card stays in place as the user scrolls.

### 10. Rename the page heading

Change the heading from "Guided setup wizard" / "Review and adjust your chart of accounts" to:

```
Review your chart of accounts
Uncheck anything you don't need, rename inline, or add accounts before publishing.
```

The wizard's overall identity ("Guided setup") still appears in the breadcrumb, so users don't lose context.

---

## Acceptance criteria

When you're done, the following are all true:

1. The right-side panel on the review step shows the publish summary (counts + validation + Publish/Back buttons), not a mirror of the accounts list.
2. The wizard subtitle and the right-pane intro paragraph are gone on the review step. Only the left-side instruction sentence remains.
3. The Equity section (and any other section where every account has the same `setupNote`) renders the note once at the section header, not per row.
4. Sections with zero included accounts do not render. A single `+ Add other accounts` button appears at the bottom of the list to add ad-hoc accounts.
5. Account numbers are styled small, mono, right-aligned, muted.
6. The 10-checkmark step indicator is replaced with a single caption line on the review step. Earlier steps still show the full indicator.
7. The Fiscal Year and Base Currency display as two inline badges plus a "Managed in Company Settings" link. The "Inherited from Company Setup" rows are removed.
8. Each account row has only a checkbox, no trash icon.
9. A sticky footer with live account count, Back, and Publish chart is always visible at the bottom of the viewport on the review step.
10. The page heading reads "Review your chart of accounts" with the new subtitle.
11. `npm run build` passes with no TypeScript errors.
12. Visual regression spot-check: the page still feels like the rest of the Chart of Accounts app — same fonts, colors, spacing, card styling. No new colors or component libraries.

---

## Out of scope (do not do)

- Do not change the 9 question steps. They stay as-is.
- Do not change the seed data, store, or types. All changes are presentational.
- Do not add animations, drag-to-reorder, or inline editing of account numbers. Renaming the account name inline is already in the original wizard rework spec — leave that behavior intact.
- Do not introduce a new design system. Use only the existing primitives in `src/components/ui.tsx` and tokens in `tailwind.config.js`.
