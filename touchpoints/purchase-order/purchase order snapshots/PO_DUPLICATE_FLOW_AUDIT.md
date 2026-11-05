# PO Duplicate Flow — 1:1 Port Audit

**Date:** 2026-07-10
**Source:** Sales Order module (`omne-frontend/apps/omne-erp/src/modules/sales`)
**Target:** Purchase Order module (`Purchase-Order/src/app/components`)
**Goal:** Match the SO "Duplicate Quote" UX pattern in PO, while keeping PO's already-working `duplicatePO` mutation.

---

## 1. SO ("Duplicate Quote") — how it works today

### 1a. Listing menu — `ActionsCell.tsx`
- File: `sales/pages/quotes-list/components/cells/ActionsCell.tsx:61-63`
- Menu item: `Copy` icon + label "Duplicate"
- Handler: `comingSoon('Duplicate')` → info toast "Duplicate — coming in a later phase." (**stub only**)
- Sits in the "utility" group between the `Convert to Sales Order` separator and `Print`.
- No confirmation dialog, no overlay animation from the listing.

### 1b. Detail header dropdown — `QuoteDetailHeader.tsx`
- File: `sales/pages/quote-detail/components/QuoteDetailHeader.tsx:185-187`
- Menu item: `Copy` icon + label "Duplicate Quote"
- Handler: `onAction('duplicate', 'Duplicate Quote')` — routed to the transitions hook (no dialog).
- Sits inside the same `Actions` dropdown as Print / Download PDF, above the note/upload group.

### 1c. Transition hook — `useQuoteTransitions.ts`
- File: `sales/pages/quote-detail/useQuoteTransitions.ts:93-105`
- On `action === 'duplicate'`, sets an `OverlayPlan`:
  ```ts
  {
    fromLabel: 'Duplicating Quote',
    toLabel:   'Quote Duplicated',
    tone:      'info',
    Icon:      Copy,                       // lucide-react
    heading:   'Duplicating Quote',
    commit:    () => omneToast.success('Quote duplicated.', {
      description: `A copy of ${quote.quoteNumber} was created as a new draft.`,
    }),
  }
  ```
- `commit` runs when the overlay's `onComplete` fires (~1.8 s after start). **No real duplicate mutation exists on the SO side today — the commit is just a toast.**

### 1d. Overlay — `StateTransitionOverlay.tsx`
- File: `shared/components/state-transition/StateTransitionOverlay.tsx`
- Full-screen fixed portal, `zIndex: 12500`, `role="status" aria-live="assertive"`.
- Backdrop: `rgba(15, 23, 42, 0.55)` + `backdrop-filter: blur(6px)`.
- Card contents: glow-ringed icon (tone color, 22–24 % alpha ring, 16 % alpha fill), verb-led `heading`, `from → to` pill row, optional `meta` sub-line (e.g. `V1 → V2`), indeterminate progress bar tinted to the tone.
- Duration: `duration` prop (defaults to **1800 ms**). Fade-out starts at `duration − 220 ms`; `onComplete` fires at `duration`.
- Tones (with matched palette): `success`, `destructive`, `warning`, `info`, `neutral`, `version`. `info` = `#1B6EF3` (blue) — used for Duplicate.
- Default icon per tone: `info → CheckCircle2`, but `useQuoteTransitions` overrides with `Copy` for duplicate.
- Depends on `motion/react` (LazyMotion `m`) + `lucide-react`.

### 1e. Mount point — `QuoteDetailView.tsx`
- File: `sales/pages/quote-detail/QuoteDetailView.tsx:188-197`
- One `<StateTransitionOverlay>` instance mounted at the view root, driven by `tx.overlay` / `tx.onOverlayComplete`. Same overlay is reused for every transition (convert / cancel / archive / duplicate / status change).

---

## 2. PO current state (what's already here)

### 2a. Store mutation — real, working
- File: `poStore.ts:1332-1376` — `duplicatePO(sourceId): PurchaseOrderData | null`
- Clones the source PO into a new Draft with:
  - fresh `id`, next `poNumber`, status `Draft`
  - today's `orderDate`, cleared receiving quantities
  - `initVersioning(po, `Duplicated from ${source.poNumber}`)` seeds v1 with a "duplicated from" note.
- **This is production-grade — the SO side does NOT have this. Keep it.**

### 2b. Listing menu — `PODataTable.tsx`
- File: `PODataTable.tsx:82` (union type) and `PODataTable.tsx:671`
- Menu item: `Copy` icon + label "Duplicate PO", routes through the row's `onNavigate` callback with the `duplicate` action.
- Handler in `PurchaseOrdersListing.tsx:1090-1126`:
  - Runs `duplicatePO(id)` (or `createPOFromVendorCheckout` fallback for mock rows), fires `toast.success(...)`, and **navigates straight to `/purchase-orders/{newId}`**.
  - No overlay, no confirmation.

### 2c. Detail dropdown — `PurchaseOrderDraft.tsx`
- File: `PurchaseOrderDraft.tsx:3063-3067` — Actions dropdown item "Duplicate PO" with `Copy` icon, opens `DuplicatePODialog`.
- File: `PurchaseOrderDraft.tsx:1970-2115` — `DuplicatePODialog`
  - Full shadcn `Dialog`, ~520 px wide.
  - Header (icon + title + description "Create a new Draft PO with the same details as {poNumber}").
  - "Duplicating from" chip row.
  - "The new PO will include" card — 7 summary rows (Vendor, Contact, Line Items, Total Value, Payment Terms, Ship To, Delivery Date).
  - "What will be different" checklist — 4 items (new PO number, status reset, order date = today, receiving cleared).
  - Footer: helper text + "Cancel" / "Duplicate PO" buttons.
- File: `PurchaseOrderDraft.tsx:2216` — `duplicateDialogOpen` state.
- File: `PurchaseOrderDraft.tsx:5030-5040` — dialog mount + `onDuplicate` handler (does the navigate).

### 2d. What's already fine (unchanged by the port)
- The mutation itself (`duplicatePO`), the seed change record, and the navigate-to-new-PO behavior all stay.
- The Duplicate item's position inside the Actions dropdown / row-action menu.

---

## 3. Difference summary (SO vs. PO)

| Concern | SO (source of truth) | PO (today) | Gap |
| --- | --- | --- | --- |
| Real mutation | **None** (stub toast) | Real (`duplicatePO`) | PO ahead — keep |
| Confirmation UX | None — instant overlay | Modal dialog with summary | SO fires immediately; PO stops to confirm |
| Feedback animation | `StateTransitionOverlay` (~1.8 s) with tone `info` + `Copy` icon | None | **Missing on PO** |
| Listing menu behavior | Stub toast | Direct duplicate + navigate + toast | PO ahead — but no animation |
| Detail menu behavior | Overlay animation → toast → (no nav) | Dialog → confirm → duplicate → navigate | PO stops for confirmation; SO doesn't |
| Toast copy | `Quote duplicated.` / `A copy of {number} was created as a new draft.` | `PO duplicated as {number} (Draft)` | Different copy — align to SO cadence |
| Mount site | One overlay at detail-view root | N/A | Need equivalent mount |
| Icon | `Copy` (lucide) | `Copy` (lucide) | Match |
| Tone | `info` (blue `#1B6EF3`) | N/A | New palette in PO |

---

## 4. Port plan — 1:1 with SO

Follow the SO pattern **and** keep PO's real mutation. That means: swap the confirmation dialog for the animated overlay, add the same overlay to the listing-menu path, run the mutation on overlay `onComplete`.

### Step 1 — Port `StateTransitionOverlay` to PO
- New file: `src/app/components/StateTransitionOverlay.tsx` (copy from SO verbatim, minus `omne-erp` internals).
- Adjust imports:
  - `motion/react` — already in PO's dep tree? Verify; if not, use `framer-motion` (whichever is present) or fall back to the CSS transition pattern used elsewhere in PO.
  - `lucide-react` — already used everywhere.
  - Drop the `@omnesoft/design-system` reference from the comment header.
- Keep the six tones (`success | destructive | warning | info | neutral | version`) and default-icon map.
- Keep `duration = 1800` default and the fade-out-at-`duration − 220 ms` behavior.

### Step 2 — Add a "transitions" hook (or extend existing)
- New file: `src/app/components/usePOTransitions.ts` — mirrors `useQuoteTransitions` but PO-scoped.
- Shape:
  ```ts
  export interface OverlayPlan {
    fromLabel: string; toLabel: string;
    tone: StateTransitionTone;
    Icon?: React.ElementType;
    heading: string; meta?: string;
    commit: () => void;
  }
  export function usePOTransitions(po: PurchaseOrderData | undefined) {
    const [overlay, setOverlay] = useState<OverlayPlan | null>(null);
    // ...
    return { overlay, onOverlayComplete, startDuplicate, /* future: startPrint, startArchive */ };
  }
  ```
- `startDuplicate(po, { onDone })`:
  - Sets overlay `{ fromLabel: 'Duplicating PO', toLabel: 'PO Duplicated', tone: 'info', Icon: Copy, heading: 'Duplicating PO', commit }`.
  - `commit` calls `duplicatePO(po.id)`, then either navigates (from listing) or calls `onDone(newPO)` (from detail).

### Step 3 — Wire the detail header
- File: `PurchaseOrderDraft.tsx` (in-scope)
- Replace the `setDuplicateDialogOpen(true)` handler at line 3067 with `tx.startDuplicate(po, { onDone: (newPo) => navigate(newPo) })`.
- Mount `<StateTransitionOverlay …/>` once near the page root (mirror SO's `QuoteDetailView.tsx:188`).
- **Delete** `DuplicatePODialog` (lines ~1970–2115), the `duplicateDialogOpen` state (line 2216), and the mount at lines 5030–5040. The overlay pattern replaces it entirely.

### Step 4 — Wire the listing
- Files: `PurchaseOrdersListing.tsx` (in-scope) and `PODataTable.tsx` (in-scope)
- Keep the `duplicate` action in `PODataTable.tsx:671` as-is.
- In `PurchaseOrdersListing.tsx:1090-1126`, wrap the current logic in an overlay: instantiate a listing-level `<StateTransitionOverlay>` (or reuse `usePOTransitions` at the listing root), fire the same overlay plan, and run the existing `duplicatePO(id) + navigate(...)` inside `commit`.
- Both the store-PO and mock-PO branches (`createPOFromVendorCheckout` fallback) should route through the same overlay.

### Step 5 — Toast copy alignment
- Match SO cadence: `omneToast.success` → `toast.success` in PO.
  - Title: `PO duplicated.`
  - Description: ``A copy of ${po.poNumber} was created as a new draft.``
- Replace both existing `toast.success(\`PO duplicated as ${newPO.poNumber} (Draft)\`)` calls in `PurchaseOrdersListing.tsx:1096` and `:1122`.

### Step 6 — Overlay meta line (optional polish)
- Use the `meta` prop to show ``${po.poNumber} → ${newPO.poNumber}`` under the pill row. This mirrors SO's `V1 → V2` pattern for version transitions and gives the user immediate feedback about the new PO number.
- Requires computing the new PO number **before** running the mutation, or setting `meta` inside `commit`'s callback via a state update. Simplest: run `duplicatePO` at start, animate over the top, navigate on complete.

### Step 7 — Accessibility check
- The overlay already exposes `role="status" aria-live="assertive" aria-label={heading}`. No change needed.
- Confirm focus doesn't get trapped — it's a status portal, not a dialog, so focus stays on whatever button was clicked. Users on keyboard should still be able to Escape (there is no dismiss — it's self-timed at 1.8 s).

### Step 8 — Remove `DuplicatePODialog` dead code
- After Step 3, delete the entire dialog component + its imports (`Building2`, `User`, `Package`, `CircleDollarSign`, `CreditCard`, `Truck`, `CalendarDays`, `Check` if not used elsewhere).

---

## 5. Files touched by the port (in-scope only)

- `src/app/components/StateTransitionOverlay.tsx` — **new** (Step 1)
- `src/app/components/usePOTransitions.ts` — **new** (Step 2)
- `src/app/components/PurchaseOrderDraft.tsx` — swap dialog for overlay, delete `DuplicatePODialog` (Steps 3 + 8)
- `src/app/components/PurchaseOrdersListing.tsx` — mount overlay, route duplicate through it, toast copy (Steps 4 + 5)
- `src/app/components/PODataTable.tsx` — **no change** (menu item already correct)
- `src/app/components/poStore.ts` — **no change** (`duplicatePO` already correct)

Out-of-scope files (per `CLAUDE.md`): none touched.

---

## 6. Order of implementation (recommended)

1. **Port overlay** (Step 1) — self-contained, verify motion lib presence first.
2. **Detail-side hook + swap** (Steps 2, 3, 8) — biggest UX change; delete the old dialog last so the app stays runnable during the swap.
3. **Listing-side wire-up** (Step 4).
4. **Copy alignment + meta polish** (Steps 5, 6).
5. **Verify** — smoke-test both entry points, tab in and out, escape while animating, hit Duplicate on an unsaved draft.

Awaiting confirmation before implementing.
