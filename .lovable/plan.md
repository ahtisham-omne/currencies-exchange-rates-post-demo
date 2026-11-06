
# Quotes Module — Major Revamp to Partners Parity

**Source of truth:** `Partner Management - Vendors` (project `00ca9900-1211-48cd-8700-d0da293891f1`). We mirror its visuals, components, modals, tooltips, sidebar, table behaviour, and creation flow. **Quote data, lifecycle, versioning, status-stepper, send-to-customer, convert-to-SO, and configurator logic stay intact** — we restyle in place, we do not delete files.

The Partners codebase is large (VendorsListPage 3.2k, VendorDetailsPage 7k, CreatePartnerModal 10.4k, PocModals 1k, PaymentTermDetailModal 1.1k, PricingRulesTab 4.1k, PaymentMethodsSection 1k, KpiInsightsPanel 530, ColumnHeaderMenu 1.2k, FiltersModal 790, QuickViewPanel 1.1k). Where Partners has a direct equivalent we **copy the source verbatim** and adapt props; where it doesn't (configurators, version history, status stepper, PDF flows), we **restyle our existing files in place** using Partners' tokens, primitives, and patterns.

---

## Guardrails (apply to every phase)

- **Restyle, never delete.** All current files stay. Removal of any file requires explicit approval.
- **Logic preservation.** Reducers, `quoteStore.ts`, `versioningEngine.ts`, `quoteUtils.ts`, status machine, draft-conflict logic, send/convert flows are not modified. Only render layer changes.
- **Type adapters, not data refactors.** Where copied Partners components want `Vendor`/`PartnerType`/`ContactPerson`, write thin adapters mapping our `Quote`/`Customer`/`PointOfContact` shapes.
- **Quote-only features inherit Partners aesthetics.** Configurators, version history, status stepper, PDF preview, etc. derive their look from the closest Partners pattern (cards, dialogs, tables, buttons, badges) — files stay where they are.

---

## Phase 1 — Foundation (theme, UI primitives, sidebar, layout)

1. **Theme & tokens** — port Partners' `index.css`, theme variables, `App.css`, font setup. Reconcile with our Tailwind v4 CSS-first setup so `--primary`, `--accent`, `--violet`, `--success`, `--warning`, `--border`, `--muted`, etc. match exactly. Carry `getAvatarTint`, `toAAAColor`, `utils/colors`.
2. **UI primitives parity** — replace each `src/app/components/ui/*` file with the Partners equivalent (button, input, dialog, dropdown-menu, select, popover, tooltip, hover-card, table, tabs, alert-dialog, sheet, sidebar, checkbox, label, switch, textarea, slider, scroll-area, separator, badge, card, command, calendar, sonner, skeleton). Add `info-tooltip.tsx`. Update `cn` helper paths to use `../ui/utils.ts`.
3. **App shell** — adopt Partners' `AppLayout`, `AppSidebar`, `PartnersLayout` patterns; restyle our `Sidebar.tsx`, `TopBar.tsx`, `ModuleHeader.tsx`, `RootLayout.tsx`. Same wordmark/icon collapse animation (framer-motion), tooltips on hover, `ChevronsLeft/Right` collapse trigger, sidebar items with disabled states. Copy logo + carrier asset PNGs.
4. **Shared utilities** — copy `OverflowTooltip`, `PersonAvatarLightbox`, `ExpandableTextarea`, `PctAmountToggle`, `SearchableUserPicker`. Restyle our `FilterPills`, `HighlightText` to match.

---

## Phase 2 — Quotes List (mirror VendorsListPage)

Restyle `QuotesListPage.tsx` and supporting components.

1. **Page chrome**
   - **KpiInsightsPanel** — copy Partners' panel verbatim. Build quote-flavored `ALL_KPI_DEFINITIONS` (Total Quotes, Sent, Accepted, Drafts, Pipeline $, Win Rate, Expiring Soon, Avg Quote Value, Avg Cycle Time, Top Sales Rep). Same drag-reorder, search, +Add KPI, icon/color treatment.
   - **Toolbar** — Search + Quick filter pills (`All / Drafts / Sent / Accepted / Rejected / Expired / Archived`), styled identically.
   - **Density control** — Condensed / Comfort / **Kanban** (label change in dropdown; "Card" slot routes to our existing `KanbanView.tsx`, restyled to Partners' card visuals).
   - **ColumnSelector** — replace `ColumnConfigSidebar.tsx` with Partners' `ColumnSelector` side-drawer (already partially aligned).
   - **FiltersModal** — copy Partners' modal; define quote `AdvancedFilters` (status, sales rep, customer, date range, value, priority, tags, expiring window).
   - **ActiveFiltersBar** — Partners' `+ Filter` chip toolbar.

2. **Data table**
   - Use Partners' Table primitives. Copy `ColumnHeaderMenu` (sort, inline filter, freeze, hide), notion-style filters, frozen sticky first column, resizable columns (`MIN_COL_WIDTH=1`, `CHECKBOX_COL_WIDTH=40`), drag-to-reorder columns, sticky header + sticky-left-column shadow on horizontal scroll.
   - **Quote columns** (replace partner columns):
     - `quote_number` (sticky, locked) — uses our existing `VersionBadge` (see Fix A below) + `quoteNumber` text.
     - `customer` — Partners' `partner_name` circle-avatar + tint + hover card.
     - `status` — restyle our `StatusBadge` to match Partners' `VendorStatusBadge` palette + size.
     - `version` — keep our `VersionBadge`.
     - `priority` — restyle `PriorityBadge` to Partners' badge system.
     - `sales_rep`, `created_by` — Partners' avatar+name pattern.
     - `points_of_contact` — Partners' `global_contacts` overflow chips with `OverflowTooltip` + `PersonAvatarLightbox`.
     - `total_value`, `discount`, `tax`, `net_total` — right-aligned, tabular-nums, $ formatting.
     - `created_on`, `sent_on`, `expires_on`, `last_activity` — Partners' date column with relative-time hover.
     - `linked_transactions` — chip count with hover preview.
   - Match Partners' typography (`text-[13px]`/`text-[12.5px]`), row hover (`hover:bg-muted/30`), divider color, no zebra.

3. **Row actions menu** — restyle the currently-invisible action menu using Partners' `MoreHorizontal` dropdown: View, Edit, Duplicate, Send to Customer, Convert to SO, Print, Cancel, Archive, Delete (mirror Partners' icon set + separators + destructive styling). Confirm dialogs copy Partners' `AlertDialog` patterns.

4. **Bulk actions toolbar** — restyle `BulkActionsToolbar.tsx` to Partners' floating bottom-center selection bar (shadow, divider, count chip).

5. **Quick view panel** — adopt Partners' `QuickViewPanel` for a Quote Quick View (header with number + version + status, customer, totals, line-item count, sales rep, dates, "Open Details" CTA).

6. **Pagination & density** — Partners' pagination row (records-per-page + ChevronsLeft/Right) and persisted density.

### Fix A — Version box truly centered

`VersionBadge.tsx` currently uses asymmetric padding (`paddingLeft: 8`, `paddingRight: 18` when `showExpandIcon`), pushing "v2" left.

```ts
// equal left/right padding when showExpandIcon
const horizontalPad = showExpandIcon ? (compact ? 12 : 14) : (compact ? 6 : 8);
paddingLeft: horizontalPad,
paddingRight: horizontalPad,
minWidth: showExpandIcon ? (compact ? 40 : 46) : (compact ? 'auto' : '36px'),
```

Arrow stays `position: absolute; right: 4-5px; top: 50%; translateY(-50%)`, hover-only, overlapping the right padding without shifting the centered text.

---

## Phase 3 — Quote Details (mirror VendorDetailsPage)

Restyle `QuoteDetails.tsx` shell while preserving lifecycle/versioning logic.

1. **Header / hero** — Partners' details hero: back arrow, large title (Quote # + display name), subtitle row, primary actions (Edit, Print, More menu). Partners' button styling.

2. **Gray container under hero** holds, in this order:
   - Our **description / notice bar** (expiry, stale-version, conflict) — restyled as Partners' notice card.
   - Our **`ModernStatusStepper`** — restyled with Partners' tokens, spacing, segmented look. Logic and node set unchanged.
   - **Tabs row** (Overview, Items, Linked Transactions, Attachments, Invoicing, Communications, Activity, Version History) — Partners tab styling, but located inside this gray container instead of the hero.

3. **Right sidebar — Fix B (full-width title stroke)**

   **Problem:** `RightSidebar.tsx` uses `SubsectionHeader` dividers with `margin: '8px 0 0'`, sitting inside inner padding so strokes don't reach card edges.

   **Partners' `DashInfoCard` spec** (verified `VendorDetailsPage.tsx` 3511–3570):
   - Outer: `rounded-xl border border-border bg-white overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.03)]`
   - Header (full-width button, edge-to-edge): `px-3.5 py-2.5 flex items-center gap-2 hover:bg-[#FAFBFC]`
   - Header bottom border: `borderBottom: isOpen ? '1px solid #F1F5F9' : 'none'` — full-width
   - Icon square: `w-6 h-6 rounded-md bg-accent` + `Icon w-3 h-3 text-primary`
   - Title: `text-[12px] text-slate-700 font-semibold`
   - Optional info-tooltip + count chip + chevron
   - Content: `px-3.5 py-3` with smooth max-height collapse
   - Sidebar wrapper: `w-[280px] xl:w-[300px] shrink-0 hidden lg:block space-y-4`

   **Implementation:** create `SidebarInfoCard.tsx` mirroring DashInfoCard exactly. Refactor `RightSidebar.tsx` so each section (Customer & Recipients, Locations, Sales Rep, Payment Terms, Payment Methods, Pricing Rules, Dates, Linked Records, Activity preview) wraps in a `SidebarInfoCard`. Drop `SubsectionHeader` inline dividers; switch to vertical stack with `space-y-4`. Keep `HoverEditRow`, modals, edit handlers, `SalesRepSelector`, all wiring untouched. **Do not delete `SectionCard.tsx`** — other tabs use it.

4. **Tabs (visual parity, our content)**
   - **Overview** — Partners' two-column block layout; restyle `OverviewTab.tsx` cards.
   - **Items** — copy `PartnerItemsTab` styling into `ItemsTabTableClean.tsx` (row chrome, edit-in-place, chips).
   - **Linked Transactions** — Partners' `PurchaseOrdersTable`/`SalesOrdersTable`/`QuotesTable` patterns; preserve our linkage data.
   - **Attachments** — copy Partners' `AttachmentsTab.tsx`; wire to our quote attachments store.
   - **Invoicing** — restyle table + action bar to match Partners' transaction tables.
   - **Communications / Activity** — restyle with Partners' `ActivityFeed` and message-thread aesthetics.
   - **Version History** — keep our versioning data; restyle list rows, diff badges, modals to Partners' look. **No deletion.**

5. **Notice/banner system** — Partners' alert/banner styling for expiry, stale-version, conflict warnings.

---

## Phase 4 — Create Quote flow (mirror CreatePartnerModal)

Restyle the 4-step `CreateQuoteModal` using Partners' multi-step modal shell.

1. **Modal shell** — copy Partners' chrome: full-screen modal with maximize/minimize, left progress nav (`CreatePartnerConfigNav`), right summary, bottom action bar (Back / Cancel / Continue / Create), keyboard nav, autosave indicator, confirm-on-close.

2. **Step 1 — Customer selection** — mirror Partners' Step 1 partner-type two-card layout. **Remove the customer/vendor toggle**; render only the Customer card, with a visible-but-disabled Vendor card to preserve the two-card visual. Copy `SearchableUserPicker` for customer search; same hover card + avatar.

3. **Step 2 — Configuration sub-modules** (restyle `Step2Configuration.tsx` in place)
   - **Locations** — copy `CreatePartnerLocationModal` + locations card stack; wire to our `LocationSelectionModal` data (modal stays, restyled).
   - **Points of Contact / Recipients** — copy `PocModals.tsx` (`PocSectionContent`, `SelectPocDictionaryModal`, `CreatePocModal`) and `PocPillComponents`; restyle our `RecipientsSelectionModal` while keeping our recipient resolver and `primaryPoC` logic.
   - **Payment Terms** — copy Partners' `PaymentTermCard` + `PaymentTermDetailModal`; restyle our `PaymentTermsLibrary`; keep "Save as default" flow.
   - **Payment Methods** — copy Partners' `PaymentMethodsSection` + `PaymentMethodCard`; restyle our `PaymentMethodSelectionModal`.
   - **Pricing Rules** — copy Partners' `PricingRulesTab` (rule cards, presets, detail modal); restyle our `PricingRulesLibrary` and `PricingRuleLibraryModal`.
   - **Sales Reps** — copy `SearchableUserPicker` + assignment card; reuse our `AssignSalesRepModal` data.
   - **Shipping/Carrier** — copy `ShippingCarrierCard` + `ShippingMethodChipsRow` (carrier logos copied as assets).
   - **Dates** — restyle `DateConfigCards` / `DateEditModal` with Partners' card+modal aesthetics.
   - **Credit Limit / Tax / Notes** — Partners' card styling.

4. **Step 3 — Line Items** — restyle `Step3LineItems.tsx` and `LineItemConfigModal.tsx` using Partners' item-table chrome (`PartnerItemsTab` patterns). **Files stay.**

5. **Step 4 — Review** & **Success** — restyle `Step4Review.tsx` and `QuoteCreatedSuccess.tsx` with Partners' summary-card and success-screen aesthetics.

---

## Phase 5 — Detail-page modals & overlays (visual parity, all kept in place)

Restyle these using new UI primitives + Partners patterns. Props/handlers unchanged:

- `SendToCustomerModal`, `PDFPreviewModal`, `PDFVisibilityModal`
- `ConvertToSOModal`, `CancelConvertedQuoteModal`, `ReviveQuoteModal`, `ReviveCancelledModal`, `DuplicateQuoteModal`
- `AutoVersionConfirmModal`, `AutoVersionOverlay`, `VersionChangePromptModal`, `DraftConflictModal`
- `ManageAdjustmentsModal`, `PricingRulesManageModal`, `AdvancedConfiguratorModal`, `ProductPickerModal`
- `AssignSalesRepModal`, `AdjustmentFormModal`
- `versionToasts.tsx` — restyle to Partners' sonner toast variants

For each Quote-only feature with no Partners equivalent (configurators, advanced configurator, version history), derive visuals from closest Partners pattern. **No file removed.**

---

## Phase 6 — Cross-cutting polish

- **Tooltips** — replace custom tooltip styling with Partners' `Tooltip` + `InfoTooltip` (border, shadow, arrow, font).
- **Hover cards** — use Partners' `HoverCard` for customer cell, PoC cell, quote-preview, sales-rep. Restyle `CustomerHoverCardContent`, `PoCHoverCardContent`, `QuotePreviewHoverCardContent`.
- **Icons** — standardize on Partners' lucide sizes (`w-3.5 h-3.5` inline, `w-4 h-4` buttons, `w-[18px]` column-selector).
- **Fonts/sizes** — `text-[13px]`/`text-[12.5px]` rows, `text-sm font-medium` buttons, exact letter-spacing tokens.
- **Scroll** — copy Partners' `scrollbar-hide`, sticky-header shadow, sticky-first-column shadow.
- **Empty states / skeletons** — Partners' empty illustrations + skeleton rows.

---

## Technical details

- **Source of truth:** project ID `00ca9900-1211-48cd-8700-d0da293891f1`. Use `cross_project--read_project_file` and `cross_project--copy_project_asset` for source files and image assets.
- **Asset copies:** `/src/assets/carriers/*.png` (fedex, dhl, ups, tcs, sf, usps, aramex, maersk), sidebar logo wordmark + icon PNGs.
- **Component placement:** copied Partners components land under `src/app/components/quotes-shared/` (mirroring `vendors/`). Existing files keep their paths and get restyled in place.
- **Type adapters:** thin mappers from `Quote`/`Customer`/`PointOfContact` → `Vendor`/`PartnerType`/`ContactPerson` for shared components.
- **Quote-number cell box:**
  ```text
  ┌─────────────────────────┐
  │   [   v2   ]   [↗]      │  ← icon hidden until row:hover
  └─────────────────────────┘
  ```
  `inline-flex; align-items:center; justify-content:center;` symmetric horizontal padding; arrow absolutely positioned in the right padding zone — text never shifts. (See Fix A.)
- **Kanban as third density:** keep `KanbanView.tsx`, restyle cards to Partners' card visuals. Density dropdown label reads "Kanban".
- **Tabs inside gray container:** Partners-style tab bar embedded in a `bg-muted/30` rounded container that also wraps the notice + stepper, sitting directly under the hero.
- **Sidebar parity:** new `SidebarInfoCard` component (Partners DashInfoCard clone) used in `RightSidebar.tsx`. (See Fix B.)
- **Memory updates:** add `mem://design/partners-parity` referencing the Partners project as canonical source for all module visuals.
- **Risk / scope:** large diff (~35k lines of current rendering touched, ~24k lines copied from Partners). Staged per phase, each phase independently buildable.

After approval I will execute Phases 1 → 6 in order, plus Fix A (version box) and Fix B (sidebar title stroke) as part of Phases 2 and 3 respectively, without leaving design changes for follow-up prompts.
