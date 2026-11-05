# Procurement Planning Tab — Detailed Design Document

> Scope: everything that lives behind the top-level **Procurement Planning** tab on the Purchase Orders page, including the **Sandbox** workspace that opens from item rows. Captures information architecture, data model, behaviour, gating logic, and the surfaces that hand off to it.

---

## 1. Where it lives

- **Surface:** the middle of the three top-level tabs in `PurchaseOrdersListing.tsx`
  - `Purchase Orders` | **`Procurement Planning`** | `Dashboard`
  - Internal `topTab` value: `"demands"` (legacy name preserved in the URL param `?topTab=demands` to keep deep-links stable).
- **Component:** `PODemands` (in `src/app/components/PODemands.tsx`). Receives stale POs + handoff callbacks from the listing page.
- **URL preservation:** the top tab is canonicalized on mount so deep-links from a detail view's back-navigation always land back on Procurement Planning if that's where the buyer came from.

The Procurement Planner used to be its own separate top tab. That was retired in favour of an **in-place Sandbox modal** that opens from the item detail flow inside Procurement Planning. Keeping a separate tab was duplicating the surface — Procurement Planning already answers "what's short?" and the Sandbox modal handles "design a fix" without a tab flip.

---

## 2. Information architecture

### 2.1 Inner sub-tabs

Procurement Planning has its own sub-tab row at the top of the card. Feature flags decide which are visible.

| Key | Label | Visible today | Source / purpose |
|---|---|---|---|
| `all` | **All Demand** | ✅ | The cross-source aggregated view (1 row per item) — the headline table |
| `sales-orders` | Sales Orders | ❌ (`SHOW_SALES_ORDERS_SUBTAB = false`) | Drill into a single source — code is preserved, hidden behind a flag |
| `low-stock` | Low Stock | ❌ (`SHOW_LOW_STOCK_SUBTAB = false`) | Same job as All Demand using `currentStock < reorderPoint` — Procurement Planner now owns it via forward-projected ATP, so the subtab is suppressed |
| `requests` | Purchase Requests | ❌ (`SHOW_PURCHASE_REQUESTS_SUBTAB = false`) | Internal request management — hidden until a workflow uses it |
| `stale` | **Stale POs** | ✅ | POs that have lingered too long (Draft ≥ 7d, Sent ≥ 14d) |

The inner-tab row is rendered as part of the card (Partners' "tabs-as-card-header" pattern), pill-style: active tab gets a blue-tinted fill + blue text, inactive tabs are pure text with a hover state.

### 2.2 What the buyer sees

Each visible sub-tab card renders, top-to-bottom:

1. **Educational info banner** — soft violet block with a 3px left accent and a tinted icon chip, explaining what this surface is for in one line.
2. **Inner sub-tab row** (described above).
3. **Toolbar** (`DemandTableToolbar`) — search · count chip · Filters button · Density · Columns.
4. **Active filters strip** — persistent row that hosts the Owner multi-select dropdown plus a removable chip for every active filter (search, severity, vendor, owner, source, urgency) + a Clear-all link.
5. **Table** — the main grid (`ByItemView` for All Demand; `StalePOsTable` for Stale POs).
6. **Pagination footer** (`PaginationFooter`) with records-per-page selector (default 20).

### 2.3 Two surfaces — entry overview, then listing

Procurement Planning has **two surfaces**: a situation-read entry overview the buyer lands on, then the All Demand listing scoped to whichever starting point they pick. The entry is for *reading and choosing*; the listing is for *acting and refining in place*.

#### Surface 1 — Entry overview (`ProcurementPlanningEntry.tsx`)

A two-pane scope-builder. Capped at `max-w-[1120px]` and centered. Renders when the buyer hasn't applied a scope yet, or has clicked "Change starting point" from the listing.

Layout:

```
Procurement Planning
Set your filters, then open the listing.

┌──────────────────────────────────────┬──────────────────────┐
│ FILTERS                              │ IN THIS SCOPE        │
│ ┌──────────────┐ ┌──────────────┐   │                      │
│ │ Time horizon │ │ Demand src.  │   │  12 items            │
│ └──────────────┘ └──────────────┘   │   4 overdue          │
│ ┌──────────────┐ ┌──────────────┐   │   8 due in next 30d  │
│ │ Categories   │ │ Min/max      │   │   5 Sales Order      │
│ └──────────────┘ └──────────────┘   │   4 Low Stock        │
│ ┌──────────────┐                    │   3 Request          │
│ │ Need by      │      [Reset]       │ 138 units short      │
│ └──────────────┘                    │  12 recommended      │
├──────────────────────────────────────│      draft POs ready │
│ QUICK SHORTCUTS                      │                      │
│ [Overdue now] [Due this week]        │  [Open in listing →] │
│ [Low Stock] [Open SO] [All Demand]   │                      │
└──────────────────────────────────────┴──────────────────────┘
```

- **Filters (left pane, dominant)** — proper labeled form fields, two-column grid. The working filter set the buyer would otherwise have to hunt for inside a modal lives front-and-centre:
  - **Time horizon** — single-select (7 / 30 / 60 / 90 days).
  - **Demand sources** — multi-select (Sales Order / Purchase Request / Low Stock) with a dedicated "All sources" entry that clears the set.
  - **Categories** — searchable typeahead multi-select against the planner registry.
  - **Min/max levels** — single-select (All / Below min / Below max).
  - **Need by** — single-select (All / Overdue / Due in horizon).
  - **Placeholder behavior** — when a filter is at its `DEFAULT_PARAMS` value, the trigger surfaces a muted **"Any"** placeholder instead of the default-state label ("All sources" / "Next 30 days" / etc.). Combined with the field label above, the trigger reads "Time horizon: Any" / "Demand sources: Any" / etc. The triggers only switch to bold foreground when the buyer makes a real selection.
  - A small **Reset filters** link sits below the grid when any field differs from `DEFAULT_PARAMS`.
  - Every change calls `onChange(next)` → host's `handleScopeRefine` → `setParams + saveParams`. The buyer's partial scope persists across sessions immediately, so closing the tab mid-build doesn't lose work.

- **Quick shortcuts (left pane, secondary)** — a compact chip row beneath the filters. Each chip pre-fills the filter controls to the preset's params; the buyer can then hand-adjust. Visually quiet — neutral chips that highlight when the active params match. They're a shortcut, not the focus.
  - `Overdue now` → `timing: "overdue"`
  - `Due this week` → `horizonDays: 7, timing: "due"`
  - `Low Stock to reorder` → `sources: ["LowStock"]`
  - `Open Sales Order demand` → `sources: ["SO"]`
  - `All Demand` → defaults

- **Results (right pane)** — live readable strip of countable facts that repaint as filters change. Same `estimatePreview` the listing uses → both surfaces agree by construction. Three render states:
  - **Empty (initial)** — when `paramsEqual(params, DEFAULT_PARAMS)` is true, the pane renders "Pick a filter on the left to see your results." and the Open in listing button hint reads "Opens with all N items". This matches the placeholder triggers on the left so the surface reads as a fresh form on first visit.
  - **No matches** — when at least one filter is set but nothing matches, the pane shows "No items match these filters…" and the button disables with the existing "Adjust your filters to broaden the scope" hint.
  - **Populated** — when at least one filter is set and items match, the pane lists the facts:
    - Headline: `N items` (large number).
    - Within-it counts: `X overdue · Y due in next N days`.
    - Source mix: `K Sales Order · L Low Stock · M Request` (zero-count kinds dropped).
    - `Z units short` (sum of `|gap|` for short items).
    - **`N recommended draft POs ready`** — violet-accented for emphasis, **plain text only** (no AI iconography).

- **Primary action (right pane footer)** — a single **"Open in listing"** button. Disabled when no items match. Clicking it calls `onApply(params)` → host flips the applied flag and routes to the listing.

- **Cancel.** When the buyer reached this surface via the listing's "Change starting point" link, a quiet "Back to listing" link in the page header returns without committing.

#### Surface 2 — All Demand listing

The existing listing, structurally unchanged. Renders when `paramsApplied === true`. Lean page-level chrome: no banner, no situation strip, no scope chip rail — the inline filter bar at the top of the table card is the sole scope surface.

Inside the card, top-to-bottom (filters first, tabs second — colour hierarchy flipped to make filters the primary control):

- **`InlineFilterBar`** — compact horizontal row of the five scope-filter pills, with a Reset link on the right when params differ from defaults. **All pills carry the blue treatment** (`#EDF4FF` fill + `#0A77FF` value text + blue chevron) so the bar reads as the page's primary surface. The label half (`Time horizon:`, etc.) stays slate so the eye picks the value first.
  - `Time horizon: Next 30 days ▾` (single-select: 7 / 30 / 60 / 90 days)
  - `Demand sources: All ▾` (multi-select: Sales Order / Purchase Request / Low Stock — dedicated "All sources" entry clears the set)
  - `Categories: All ▾` (searchable typeahead multi-select)
  - `Min/max levels: All levels ▾` (single-select)
  - `Need by: All ▾` (single-select: All / Overdue / Due in horizon)
  - Each pill is `h-7`, labelled-and-value (`Label: Value ▾`), opens a Popover. Active state gets a deeper blue-tinted border + bold value; non-active pills keep the same blue background so the bar reads as one cohesive group. All five mutate `params` directly via `handleScopeRefine` → same persistence the entry uses, so the surfaces stay in sync.
  - Reset link (`↺ Reset`) appears top-right when any pill is non-default; one click returns the whole bar to `DEFAULT_PARAMS`.
- **Inner tabs row (hidden — Stale POs preserved):** the All Demand / Stale POs sub-tab row is commented out in the All Demand branch render. The `renderDemandsTabsRow` function, the `activeDemandsTab` state, the Stale POs render branch, and the `StalePOsTable` component all stay in source so re-enabling is a one-line uncomment. Spec assumed this would come back; until then the card has no sub-tab chrome above the toolbar.
- **Toolbar** — quietly trimmed to chrome only: search · density · columns · Reset. The Filters button + `DemandFiltersModal` mount were dropped (the inline filter bar above is now the sole scope surface; the toolbar is for view chrome). The toolbar still accepts a `filterGroups` prop for back-compat with tab branches that might want it back later, but nothing is rendered into a Filters button on All Demand.
- **Count chip — gated on data-present.** The toolbar's "X items" / "X of N items" tally is suppressed entirely at the empty state (params at defaults → table not yet populated). Once any filter pill is set, the count reappears alongside the data so the buyer reads the tally next to what they're looking at.
- (Bulk actions strip when rows are selected.)
- **`ByItemView` + pagination — gated on a non-default scope.** When `paramsEqual(params, DEFAULT_PARAMS)` is true (the buyer arrived without picking any filter), the table area renders an `EmptyState` with the `SlidersHorizontal` icon and the copy "Pick a filter to load your demand" / "Use the filter pills above to scope which items appear here. Time horizon · Demand sources · Categories · Min/max levels · Need by — any one of them will populate the table." Pagination is hidden in this state too. As soon as any filter pill is set, the table + pagination snap in with the live data.

The listing's count chip reflects the active scope live; the toolbar's "20 items" / "X of 20 items" updates as the inline bar narrows.

The previous violet educational banner + "Edit filters" round-trip were retired — the inline bar makes the round-trip unnecessary. To start over from scratch, the buyer switches top tabs and returns (entry re-shows because `paramsApplied` is session-state).

#### Persistence

- `loadParams()` / `saveParams()` persist the buyer's built filter state AND any subsequent toolbar refinements (storage key `po:procurement-planning:params:v4`). The entry surface pre-fills with the last-built scope on every visit.
- **The entry shows on every tab entry.** There is no persisted "applied" flag — the buyer reviews their filters each visit and clicks **Open in listing** to proceed. `paramsApplied` is session-only state on `PODemands`, reset to `false` on every mount. Switching top tabs and returning re-shows the entry naturally because the component remounts.
- **No in-session return from listing to entry.** The previous "Edit filters" round-trip was retired — the listing's `InlineFilterBar` is the in-place scope control, so the buyer never has to leave the listing to adjust scope. To revisit the entry, switch top tabs and return (the entry re-shows on the next mount because `paramsApplied` resets). `editingParams` state still exists in `PODemands` as a vestigial slot; nothing flips it.

#### Parameters in the set

- `horizonDays` (Time horizon) — drives projection / transaction-stream slicing AND the "Due in horizon" timing filter.
- `sources` — Sales Order / Purchase Request / Low Stock (empty = all).
- `categories` — multi-select from the planner registry.
- `levelsFilter` — `all` / `below-min` / `below-max`.
- `timing` — `all` / `overdue` / `due`.

Vocabulary stays inside the approved list: Time horizon · Demand sources / Sales Order / Low Stock / Purchase Request · Categories · Min/max levels · Need by · Overdue · Due · Gap · recommended draft PO · All Demand.

---

## 3. The All-Demand table (`ByItemView`)

One row per item. Sources are summarised inline; the chevron in the first cell expands an in-row panel that lists every contributing source with its own "+ Create PO" CTA.

### 3.1 Columns

Sticky-left columns are protected by a hairline shadow; the Actions column is sticky-right. Columns can be hidden/shown from the Columns popover.

| Column | Sticky | Purpose |
|---|---|---|
| Chevron (no header) | left (0px) | Expands the source-detail accordion. `stopPropagation` so it never opens the detail modal. |
| **Priority** | left (36px) | `P1` / `P2` / `P3` pill. Top-2 P1 items also get a pin icon and a `#1` / `#2` rank suffix. |
| Item | — | Item image + clickable item code. Clicking the row anywhere opens the **Sandbox modal** with the item pre-loaded. |
| Description | — | Item name, muted, truncated at 280px. |
| First violation | — | `today` / `in Nd` — when the curve first dips below min. Muted slate. |
| Days Left | — | Days until the earliest source need-by. `Overdue` rendered in red. |
| Need by | — | Earliest need-by date across all sources. |
| **Gap** | — | Coloured number — red when negative. Sized in the item's UoM. |
| Current ATP | — | Day-0 ATP from the projection curve (in `baseUom`, which may differ from the demand item's UoM). |
| Total Demand | — | Sum of all source quantities. |
| Stock | — | Raw on-hand. |
| **Recommended order qty** | — | Total qty `buildRecommendations` would tee up for this row, summed across qualified vendors and snapped per item rules. Decision-support only — doesn't trigger anything by itself; it previews what the one-button **Recommend POs** action (§3.7) would generate. Renders `—` when the projection stays above min or no vendor is qualified. |
| Sources | — | Plain summary string ("2 SO · 1 Req · Low Stock") — no pill stack. |
| Preferred Vendor | — | Vendor name + small avatar. |
| Vendor Price · Lead time | — | "$X.XX · Nd lead". |
| Owner | — | Avatar + name from the planner registry. |
| **Actions** | right | "Plan" icon button → opens the **Sandbox modal**. The wide "+ Create PO" CTA was removed: every item now flows through the Sandbox to enforce the validates-green / MOQ / lead-time gates. |

### 3.2 Sources accordion (chevron expanded)

Below each row, when expanded, lists every demand source carried by that item:

- **SO** — `kind: "SO"` · reference (SO number) · qty · `dueDate` · urgency.
- **Request** — `kind: "Request"` · requester · qty · `reason` · urgency.
- **LowStock** — `kind: "LowStock"` · "Min Order Qty: N" · shortage qty · urgency.

Each row inside the accordion offers a **per-source "+ Create PO"** CTA that opens the `OrderFlow` modal scoped to that single source (banner reads e.g. "Creating PO for Sales Order SO-10428"). Vendor is pre-filled from the parent item's preferred vendor; if the source carries no vendor (SO line items, internal requests), the modal forces a vendor selection before submit.

### 3.3 Priority & sort

- `priorityTierFor(item)` maps urgency → `P1` (Critical), `P2` (At Risk), `P3` (Open).
- `priorityScoreFor(item)` adds three weighted dimensions so the row order is stable:
  - urgency band (P1 → 10000, P2 → 5000, else 0)
  - days-to-earliest-need (up to +1000)
  - shortage size (capped at +500)
- Sort options: **Need by** (default — closest ship-by first) · Priority · Urgency · Gap size · Vendor. Need-by is the default because the row's facts (Source + Gap + Need by) carry the reason; no severity computation needed.
- Pinned P1 rows (top 2) render above everything else with a pin icon, slate-tinted background, and a 3px slate left border.

### 3.4 Urgency math (`urgencyForItem`)

Urgency is **ship-by-date driven**, computed from the earliest source due-date (with fallback to `item.neededBy`):

| Days to earliest need | Urgency |
|---|---|
| ≤ 7 days | `Critical` |
| 8–21 days | `At Risk` |
| > 21 days (or no date) | `Open` |

### 3.5 Filters

Two parallel filter systems live side by side (deliberate — the user explicitly wanted this split):

| Filter family | UI | Selection model | State |
|---|---|---|---|
| **Quick filters** (severity pills, status pills) | Inline pill row next to search | Single-select (radio) | `quickSeverity` / `quickRequestStatus` |
| **Modal filters** | Filters button → modal panel | Multi-select | `filterSeverity[]` / `requestStatusFilter[]` / `filterOwners[]` etc. |

Both states are **independent** and applied via **AND** — a row passes only when it matches both checks. Severity filter options carry counts and dot colours (green/amber/red).

Available filter groups in the All-Demand toolbar:

1. **Demand Source** (single) — SO / Request / Low Stock / All.
2. **Owner** (multi) — every unique purchasing owner from the planner registry; the buyer's own name gets a "(You)" suffix.
3. **Preferred Vendor** (single, searchable after 6 options).
4. **Sort By** — Priority / Urgency / Gap / Vendor.

> **Severity is intentionally NOT exposed on the All-Demand table or its toolbar.** Per the E3 directive ("severity is parked, don't lead with severity"), severity has been removed from the column set, toolbar filters, and entry-form parameters. It still drives the Sandbox modal's planning gate (validates-green check) — the concept lives where it actively drives the workflow.

The Owner dropdown lives directly in the active-filters strip so the buyer doesn't have to dig into the filter modal to scope by who-owns-the-item — they pick names right there.

### 3.6 Distressed-item gate on bulk Create POs

The bulk-checkbox row at the top supports "Create POs" for selected items. Spec rule: any item with a non-healthy ATP projection must flow through the Sandbox (so MOQ / lead-time / validates-green fire). `bulkCreatePOs()` filters those out up front, surfaces a `toast.warning` pointing the buyer at the Sandbox path, and the bulk preview modal only contains the healthy items.

### 3.7 One-button "Recommend POs" action

The primary action on the post-Apply page. Lives as a single CTA above the table card whenever the current parameter scope contains at least one recommendation. Per Eli E11 the brief asked for the one-button surface to be **prominent**, not buried — this is where it lives.

- **Trigger:** `Recommend POs` button on the strip above the table card. Count badge shows the number of vendor-level draft POs the engine would tee up for the in-scope items (computed off `recommendationByItemCode`).
- **Engine:** `buildRecommendations` from `src/app/components/procurementRecommendations.ts` — the shared Phase 6 engine. Same module the Sandbox imports, so per-row "Recommended order qty" (the column) and the batch surface always agree on what the system recommends.
- **Modal:** `RecommendedPOsModal` (`src/app/components/RecommendedPOsModal.tsx`). Sandbox-violet wash (`#524BE0` / `#F2F1FF` / `#3F3A9A`) so the buyer reads it as a planning workspace.
  - **Conflict banners** rendered above the per-vendor cards. Reuses the Phase 6 `RecommendationConflict` shape — `no-qualified-vendors`, `vendor-late`, `moq-overshoot`, `uncovered`. Per-conflict dismiss is session-scoped (reopening restores them).
  - **Per-vendor cards** — one card per vendor, listing every recommended line going to that vendor with a per-card subtotal (`effectivePrice × qty` summed across included lines).
  - **Per-line editable** — qty (snapped via shared `snapQty` on blur/Enter — same MOQ / multiples / max-order rules), ship-by date, include/exclude checkbox, remove. Vendor reassignment isn't exposed here — qualified-vendor alternatives surface inside the conflict banner instead.
  - **Footer** — caption ("X lines across Y vendors") + Cancel + **Execute (N POs)**. Execute creates Draft POs grouped per vendor via `createPOFromVendorCheckout`, one call per vendor card. Drafts only — Execute never sends. PO source-note carries `Procurement Planning · Recommend POs (X line(s))` for the audit trail.
- **Empty state:** when every in-scope item's projection stays above its min level across the horizon, the modal shows a "nothing to recommend" empty state. The trigger button is suppressed entirely at the page level when `recommendActionCount === 0`.

---

## 4. Demand Item Detail Modal (`DemandItemDetailModal.tsx`)

Opens when the buyer clicks the **item code** or **item image** anywhere in the All-Demand table.

- **Modal recipe** — canonical content-heavy: `sm:!max-w-[min(80vw,1480px)]` · `sm:!max-h-[min(88vh,1180px)]` · `sm:!min-h-[640px]` · 300ms cubic-bezier transition · severity-tinted header wash (white / amber / rose).
- **Header** — 40×40 image · 15/600 item code · rounded-full severity pill (clickable → opens Cause modal) · category tag · location · description on the secondary line · "Why short?" button (when distressed) · **"Plan in sandbox"** primary CTA · Close X.

### 4.1 Tabs

| Tab | Content |
|---|---|
| **Overview** | KPI grid (Current ATP · Min/Max · Demand events · Future Incoming count) · ATP projection chart (left, 280px) · right sidebar with DashInfoCards: Inventory · Procurement constraints · Owner |
| **Demand** | Table of every contributing demand event — source pill, customer/requester, outstanding qty (`qty − qtyShipped − qtyCancelled`), required date with days-to-go, priority, state |
| **Future Incoming** | Table of in-flight POs that arrive in the horizon — PO number, vendor, qty, expected date, status |

### 4.2 Universal CTA: "Plan in sandbox"

This modal **does not create POs directly anymore**. The only path forward is the violet flask "Plan in sandbox" button — every PO from a demand item is born inside the Sandbox so the validates-green gate has a chance to fire. The CTA fires `onPlanInSandbox(itemCode)` which:

1. Closes this modal.
2. Sets `sandboxModalItem` on `PurchaseOrdersListing`.
3. Mounts `PlannerSandboxModal` over the same surface.

Severity pill in the header is also a clickable chip with a chevron — clicking opens the **Cause modal** for a focused "why short?" view.

---

## 5. Cause Modal (`PlannerCauseModal.tsx`)

Focused "why is this short?" surface. Read-only, no mutations.

- **Entry points:**
  - Severity column pill in the All-Demand table.
  - Severity pill in the Demand Item Detail Modal header.
  - Severity pill in the Sandbox Modal header.
  - "Why short?" outline button in the Demand Item Detail Modal.

- **Layout** — centered modal, `max-w-[1080px]`, scrolls internally.
- **Header** — 48×48 image · item name (16/600) · `itemCode · category · owner` secondary line · big severity badge on the right.
- **KPI strip (5 cells)** — Current ATP (with "/ N min" subdued suffix) · Horizon (30d) · Outstanding demand (qty + event count) · Inbound supply (qty + PO count) · First violation date.
- **Projection chart** — same data layer as everywhere else (`projectAtpCurve`), 280px high, with:
  - Blue ATP curve with dots on every data point.
  - Dashed reference lines for Min (amber), Max (green), Zero (red).
  - Crossing markers — a coloured dot at the first day the curve crosses below min, hits zero, and goes negative.
  - Below-chart "Crossings:" legend listing each crossing with its day offset.
- **Two-column contributing events** — left: Contributing Demand list (SO/Request rows with priority + state pills); right: Contributing Future Incoming list (PO rows with vendor + status pills).
- **Footer** — Close · **"Open in Sandbox"** CTA that fires `onOpenSandbox(itemCode)` — the same handoff as "Plan in sandbox".

---

## 6. The Sandbox (`PlannerSandboxModal.tsx`)

The Sandbox is a **what-if workspace** — nothing it does is real until the buyer clicks Execute. This is the primary "design a fix" surface.

### 6.1 Visual language

- **Modal recipe** — same canonical content-heavy sizing as Demand Item Detail.
- **Violet header wash** (`#F2F1FF` / `#524BE0`) deliberately diverges from the severity-tinted wash used by the Demand Item Detail Modal so the buyer has an unmistakable cue that this is a planning workspace.
- **"SANDBOX" eyebrow chip** — small violet pill at the top of the header with a flask icon and the text "SANDBOX", followed by "Changes preview live · nothing executes until you click Execute".
- **Header content** — violet-ringed item image · severity pill (clickable → Cause modal) · category · item name · Close X.

### 6.2 Tabs

| Tab | Content |
|---|---|
| **Plan** (default) | The actual sandbox workspace — see §6.3 below |
| **Demand** | Same outstanding-demand table as the item detail modal |
| **Future Incoming** | Same in-flight PO table as the item detail modal |

### 6.3 Plan tab

The **only** tab that differs from the item detail modal. Layout: KPI strip → two-column body (left: chart + qualified-vendors card; right: sticky info sidebar).

#### 6.3.1 KPI grid (4 cells)

Same KPIs as the item detail modal: Current ATP · Min/Max · Demand events (lists source-type names) · Future Incoming count.

#### 6.3.2 Projected ATP chart — dual curve

The Sandbox chart overlays **two curves** instead of one:

- **Baseline** — gray dashed line, what the projection looks like with today's plan only (on-hand + in-flight POs − outstanding demand).
- **Enhanced** — solid blue line with subtle gradient fill, the projection with every proposed PO from the Qualified Vendors section applied.

Both curves use `projectAtpCurve`. The enhanced curve is recomputed live every time the buyer adds/edits/removes a proposed PO. The chart carries:
- Dashed Min (amber), Max (green), Zero (red) reference lines with `insideTopRight` / `insideBottomRight` labels.
- A legend strip above the chart: Baseline · With proposed · Min · Max.
- A footer summary strip: Current ATP · "Worst with proposed" severity · "Next 30 days" suffix.
- Meta line in the card header: "first violation in Nd (Month Day)" when the enhanced curve still dips, else "30-day horizon".

#### 6.3.3 "Create POs from qualified vendors" card — the workspace

The sandbox-toned card (violet border + subtle violet wash + faint pulse ring until the buyer adds their first vendor) listing **every qualified vendor** for the item, sorted by rank. Each row is a `VendorRow`.

**Inline education strip** — single-line nudge: "Pick one or more vendors below to draft purchase orders. The chart above re-paints live, and Execute (in the footer) sends the drafts into the standard PO lifecycle."

**Collapsed VendorRow** (vendor not in plan):
- Avatar (gradient blue), vendor name (13/600).
- `Primary` star pill (when `primaryFlag`).
- `Priority N` muted pill (rank).
- Secondary line: `Nd lead · $X.XX/unit base · On-time NN% · "Volume ≥ 50"` (pricing rule description when present).
- Right side: primary blue **`Add`** button.

**Expanded VendorRow** (vendor in plan):
- Same header strip; the rank/on-time badges drop away, replaced by a slate "In plan" chip.
- Right side: red-outline trash button (remove from plan).
- Below the header, an inline edit panel:
  - **Quantity input** — controlled draft + `snapQty` on blur or Enter:
    - Below MOQ → bumped to MOQ with a toast: "Below MOQ — bumped to N".
    - Above max → capped at maxOrderQty with a toast: "Above max — capped at N".
    - Not a multiple → snapped with a toast: "Snapped to multiple of N".
  - Helper line: "{baseUom} · multiple of N".
  - **Ship-by date input** — native date picker. Stores `arrivalDays`; UI derives ship-by from `arrivalDays - leadTimeDays` (clamped at 0).
  - Helper line: "Arrives in N days (Month Day)" / "Arrives today".
  - **Late-arrival warning** (orange info row) when `arrivalIso > firstViolation`: "Arrives in N days after first demand on Month Day. Partial fix only."
  - **Total row** — separator + spelled-out formula: `$X.XX/unit × N EA = $TOTAL`, with the effective price computed via `effectivePrice(unitPrice, pricingRules, qty)` so pricing-rule discounts apply at the selected qty.

One PO per vendor in this merged UI — clicking Add on a vendor that's already in plan is a no-op.

#### 6.3.4 Right sidebar (DashInfoCards)

Sticky `w-[280px] xl:w-[300px] hidden lg:block` column. Three cards:

1. **Inventory** — On-hand · Current ATP (coloured by severity) · Min level · Max level · Quarantined (full-width below a divider).
2. **Procurement constraints** — MOQ · Max order qty · Order multiples · Purchase UoM.
3. **Purchasing owner** — gradient avatar with initials · owner name (13/600) · "Purchasing" label · "Owned by you" badge (when `ownedByMe`).

On screens below `lg`, the sidebar is hidden and a compact 2-card grid (Inventory + Procurement constraints) renders inline below the workspace.

### 6.4 Footer (sticky action bar)

- **Left — Gate status** (`GateStatus` component):
  - **Validates green** state (worst severity with proposed = healthy): green pill "Validates green — projection stays above min through horizon".
  - **Red** state: amber pill "Below min on {date}" (or "Projection drops below min").
  - Trailing copy: "Worst: {severity}" — if the proposed plan improved on baseline, shows "(was {baselineSeverity})" so the buyer sees the improvement even if it didn't fully validate.
- **Right cluster:**
  - **Override checkbox** — only renders when the gate is red AND `proposed.length > 0`. Toggling it enables Execute despite a non-green gate. Resets to false on every item change.
  - **Reset** — outline button. Opens a confirmation `AlertDialog` ("Reset sandbox? This will remove every proposed PO and clear the override flag. The action can't be undone.") before wiping `proposed` + `overrideGate` and firing a success toast.
  - **Execute (N POs)** — primary blue button with a send icon. Disabled unless `proposed.length > 0 && (validatesGreen || overrideGate)`. On click:
    1. Loops every `ProposedPO`, computes ship-by + arrival ISO strings + effective price.
    2. Calls `createPOFromVendorCheckout(vendorName, [lineItem], "Procurement Planner Sandbox · {itemCode}", linkedDemandIds)` once per row.
    3. `linkedDemandIds` carries every in-horizon demand event id as the audit trail.
    4. Toasts "{N} draft PO{s} created · Review in the Purchase Orders tab. Sandbox cleared."
    5. Clears `proposed` + `overrideGate`, closes the modal.

### 6.5 State model

```ts
proposed: ProposedPO[]      // { id, vendorId, qty, arrivalDays }[]
overrideGate: boolean       // reset to false on item change
confirmResetOpen: boolean   // Reset confirmation dialog
activeTab: "plan" | "demand" | "incoming"
purchaseOrders: PurchaseOrderData[]   // subscribed to poStore
```

The PO store subscription means **Future Incoming refreshes live** — if another tab creates/sends/receives a PO, the baseline curve repaints without remounting.

---

## 7. Data layer

### 7.1 `plannerData.ts`

Self-contained mock layer for the planner:

- **`PLANNER_ITEMS: PlannerItem[]`** — 10 curated items spanning every severity bucket so the table has visible variety on first load. Each item carries:
  - Identity: `itemCode`, `itemName`, `itemImage`, `description`, `category`, `baseUom`, `purchaseUom`.
  - Inventory snapshot: `onHand`, `quarantined`.
  - Item rules: `minLevel`, `maxLevel`.
  - Procurement constraints: `moq`, `maxOrderQty`, `orderMultiples`.
  - Governance: `purchasingOwner`, `ownedByMe`.
  - Vendor: `primaryVendor`, `primaryVendorLeadDays`, `qualifiedVendors: PlannerVendor[]`.
- **`PLANNER_DEMAND_EVENTS: PlannerDemandEvent[]`** — mocked SO + Purchase Request events.
- **`getFutureIncomingForItem(itemCode, allPOs)`** — derives in-flight PO arrivals from the live `poStore`:
  - Filters POs with status in `{ Sent, Confirmed, Partially Received }`.
  - Skips cancelled lines, fully-received lines, and **overdue arrivals** (no past-due ghosts in the projection).
  - Returns `FutureIncomingEvent[]` with `{ poNumber, itemCode, qty, expectedDate, status }`.

### 7.2 `projection.ts`

Pure helpers — no React. Everything the planner surfaces use:

- **`projectAtpCurve(item, demandEvents, futureIncoming, horizonDays): ProjectionPoint[]`**
  - Starting balance: `onHand − quarantined`.
  - Demand consumption uses `outstandingQty(ev) = qty − qtyShipped − qtyCancelled`.
  - Day 0 → day N, each point carries cumulative demand + cumulative incoming + computed ATP.
- **`severityForAtp(atp, minLevel)`** — `atp < 0` → `negative`; `atp = 0` → `at_zero`; `atp < minLevel` → `below_min`; else `healthy`.
- **`worstSeverityInHorizon(curve, minLevel)`** — worst severity reached anywhere in the curve.
- **`firstViolationDate(curve, minLevel)`** — first ISO date the curve crosses below min.
- **`currentAtp(curve)`** — day-0 point convenience accessor.
- **`severityLabel(s)`** — short pretty label.
- **`effectivePrice(unitPrice, rules, orderQty)`** — applies a vendor's pricing rules in order (discount = subtract; premium = add; percent or absolute).

### 7.3 Cross-surface projection map

Inside `PODemands`, `projectionByItemCode` is a `Map<itemCode, { worstSeverity, firstViolation, currentAtp, baseUom }>` built once per render by cross-referencing `PLANNER_ITEMS` with the live PO store. Powers:
- Severity column (and its Cause modal click target).
- First Violation column.
- Current ATP column (with UoM).
- Severity quick-pill and modal filters.

Items absent from the planner registry still appear in the table; their projection-dependent cells fall back to `—`.

---

## 8. Stale POs sub-tab

A separate `StalePOsTable` renders Draft POs ≥ 7d and Sent POs ≥ 14d as a follow-up surface for the buyer. Same toolbar/density/filter recipe as All Demand but a thinner column set: PO number, vendor, status, ordered items previews, point of contact, location, days stale, total, created-by, due-delivery date.

`onCreatePO` (legacy entrypoint into the catalogue modal) is still wired from this tab so the buyer can spin up a replacement PO when an old one has gone cold.

---

## 9. End-to-end flows

### 9.1 "I see something distressed, what's going on?"

1. Buyer lands on **All Demand**, sees a row with a red `At zero` severity pill.
2. Clicks the severity pill → **Cause modal** opens.
3. Reads the KPI strip (current ATP / outstanding demand / inbound supply / first violation date).
4. Scans the contributing-demand + future-incoming lists.
5. Clicks **"Open in Sandbox"** → Cause closes, Sandbox opens for the same item.

### 9.2 "I need to fix this"

1. Sandbox opens with the violet "SANDBOX" chip in the header.
2. Buyer reads the dual ATP curve — baseline (gray) shows the problem, enhanced (blue) is identical until they add a vendor.
3. Buyer scrolls to "Create POs from qualified vendors", reads each vendor's lead time / unit price / on-time rating / pricing rule.
4. Clicks **Add** on a vendor → the row expands inline. MOQ becomes the default quantity (snapped to multiples), lead time becomes the default arrival.
5. The enhanced curve repaints live above. If it's still red, the buyer adjusts qty or adds another vendor.
6. If a proposed arrival lands after the first-violation date, the row shows the orange "Partial fix only" warning so the buyer knows their proposal won't fully cover the gap.
7. Once the gate status in the footer flips green (`Validates green — projection stays above min through horizon`), **Execute** unlocks.
8. Click **Execute** → one draft PO is created per proposed row via `createPOFromVendorCheckout`, with `linkedDemandIds` carrying every in-horizon demand event id as the audit trail. Sandbox closes; toast points to the Purchase Orders tab.

### 9.3 Override path

If the buyer can't validate green (e.g. no vendor in the qualified list can deliver before the first violation):
1. Footer surfaces an **"Execute anyway (override)"** checkbox.
2. Ticking it unlocks Execute despite the red gate.
3. The Sandbox still creates the proposed POs; gate status is informational at that point — the buyer has accepted the partial fix consciously.

### 9.4 Healthy direct-flow path

For items with `worstSeverity === "healthy"`, bulk PO creation from selected rows skips the Sandbox entirely — the multi-PO preview modal opens directly from the bulk Create POs button and the buyer confirms a grouped per-vendor draft.

### 9.5 Per-source PO entry points

Inside the expanded source accordion, each `+ Create PO` opens `OrderFlow` scoped to that single source with the banner reflecting which SO / Request / low-stock signal triggered it. Vendor is pre-filled from the item (or left empty when the source has none, forcing the buyer to pick).

### 9.6 "Just give me the POs I need" — the one-button recommendation path

1. Buyer applies a parameter set on the entry surface, lands on the listing.
2. Scope strip + active-filters strip + the **Recommend POs** action strip render above the table card. The button carries a count badge — that's `recommendActionCount`, summing every vendor-level allocation `buildRecommendations` would tee up for the in-scope items.
3. Buyer clicks **Recommend POs** → `RecommendedPOsModal` opens with the violet "planning workspace" header wash.
4. Any cross-rule conflicts (`vendor-late`, `moq-overshoot`, `no-qualified-vendors`, `uncovered`) render as banners at the top — same Phase 6 conflict types the Sandbox surfaces.
5. Per-vendor cards list every recommended draft line. Buyer edits qty (snap-on-blur), edits ship-by date, toggles individual lines in/out, or removes a line entirely.
6. Footer shows `X lines across Y vendors`. **Execute (N POs)** is enabled when at least one line is included. Click → one `createPOFromVendorCheckout` call per vendor card; drafts only — never auto-sends.
7. Modal closes; toast points the buyer at the Purchase Orders tab.

---

## 10. Design tokens used

- **Modal sizing recipe** — `sm:!max-w-[min(80vw,1480px)] sm:!max-h-[min(88vh,1180px)] sm:!min-h-[640px]` + 300ms `cubic-bezier(0.32,0.72,0,1)` transition.
- **Sandbox-violet palette** — `#524BE0` accent + `#F2F1FF` wash + `#3F3A9A` text. Used for the SANDBOX chip, header wash, education strip, and the "Create POs" card highlight.
- **Severity palette** — Healthy `#15803D` / Below min `#A06515` (amber) / At zero + Negative `#A01A30` (rose), each with matching low-saturation bg + border tones.
- **Pill/header treatments** — Partners' bordered-pill spec: `text-[11px] px-2 py-0.5 rounded-md border tabular-nums`.
- **Toolbar typography** — 12/500 active pill, slate-500 inactive, count badge as a 10px chip on tab buttons.

---

## 11. Caveats and known shortcuts

- **Mock data only** — `PLANNER_ITEMS` and `PLANNER_DEMAND_EVENTS` are hand-curated; in production these become read models off ERP feeds.
- **Single-shipment-per-vendor** in the Sandbox — adding a vendor twice is a no-op. Multi-shipment splits would surface as an "Add another shipment" affordance inside the expanded row.
- **`linkedDemandIds` is approximate** — every in-horizon demand event is attached to every PO from the session; no per-PO apportionment.
- **No persistence on Sandbox state across sessions** — `proposed` + `overrideGate` reset on item change and on modal close. A buyer who wanders away mid-plan loses their draft.
- **Override flag is not stored on the resulting PO** — auditing "did the buyer override the gate?" relies on the PO's source note ("Procurement Planner Sandbox · {itemCode}") and the date math.
- **Future Incoming excludes overdue lines** — by design, but it does mean if a vendor is critically late the curve treats those units as "not coming" rather than "still arriving later" — the buyer has to read the PO listing to spot stuck orders.

---

## 12. File map

```
src/app/components/
├── PODemands.tsx                    Procurement Planning host — gates between entry and listing, owns the listing
├── ProcurementPlanningEntry.tsx     Entry overview — situation read + decision-oriented starting points
├── procurementPlanningParams.ts     Param shape + persistence + presets + applied-flag + saved view
├── procurementRecommendations.ts    Shared Phase 6 engine: snapQty + buildRecommendations
├── RecommendedPOsModal.tsx          Batch "Recommend POs" surface (multi-item, per-vendor)
├── PlannerSandboxModal.tsx          The Sandbox workspace (single-item planner)
├── UnifiedTransactionStream.tsx     Chronological ledger — running on-hand balance (opens at on-hand, moves per row), guardrail-crossing annotations (below max/min/zero + green recovery, color-trained to the gap graph), infinite scroll, inline "+" simulate; planned POs render as green "Planned purchase order" rows, simulated what-ifs as "SIMULATED ENTRY"
├── DemandFiltersModal.tsx           Filter modal (multi-select owner / vendor / etc.)
├── plannerData.ts                   PLANNER_ITEMS, PLANNER_DEMAND_EVENTS, getFutureIncomingForItem
├── poStore.ts                       Live PO store (createPOFromVendorCheckout, subscribe…)
└── _dashboardModalKit.tsx           PartnerKpi · ContentCardLite · DashInfoCard · Pill · Th · MODAL_SIZE_CLASS

src/app/utils/
└── projection.ts                    projectAtpCurve · severityForAtp · firstViolationDate · effectivePrice
```

> Note: `DemandItemDetailModal.tsx` and `PlannerCauseModal.tsx` were retired in earlier passes — every row interaction (item code, severity pill, Plan icon) now opens the Sandbox modal directly. The Sandbox carries everything those modals used to provide plus the planning workspace.
