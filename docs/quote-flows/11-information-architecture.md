# Quote Management — Information Architecture

## Purpose
This document captures the information architecture (IA) of the Quote Management module: how screens, navigation, data domains, and interaction surfaces are organized and how they relate to each other.

## Top-Level Module Position
Quote Management is a top-level module reachable from the global sidebar. Within the module, navigation is organized around two primary destinations:

1. **Quotes List** — multi-quote workspace
2. **Quote Details** — single-quote workspace

Supporting surfaces (modals, overlays, drawers) are anchored to these two destinations.

## Global Shell
- **Sidebar** — module-level navigation (`Sidebar.tsx`)
- **TopBar** — global header, search, user actions (`TopBar.tsx`)
- **ModuleHeader** — contextual page header per module (`ModuleHeader.tsx`)
- **RootLayout** — composes sidebar, topbar, and routed content (`RootLayout.tsx`)

## Primary Routes
Defined in `src/app/routes.tsx`:
- `/` → Quotes List (`QuotesListPage.tsx`)
- `/quotes/:id` → Quote Details (`QuoteDetails.tsx`)
- `/quotes/:id/edit` → Edit Quote (`EditQuote.tsx`)

## Level 1 — Quotes List Workspace
Source: `QuotesListPage.tsx`

### IA Sections
1. **Module Header** — title, breadcrumbs, primary CTA (Create Quote)
2. **Performance Insights / KPI Panel** — aggregated metrics (`KpiInsightsPanel.tsx`, `PerformanceInsights.tsx`)
3. **View Controls** — view switcher (Table / Kanban) (`ViewControls.tsx`)
4. **Filter Bar & Pills** — saved filters, active filter chips (`FilterBar.tsx`, `FilterPills.tsx`)
5. **Table Controls** — search, column config, density (`TableControls.tsx`)
6. **Data Surface** — `TableView.tsx` or `KanbanView.tsx`
7. **Bulk Actions Toolbar** — appears on row selection (`BulkActionsToolbar.tsx`)

### Anchored Surfaces
- `FiltersModal` — advanced filtering
- `ColumnSelector`, `ColumnConfigSidebar`, `ColumnConfigurator` — column management
- `ColumnHeaderMenu` — per-column actions
- `CreateQuoteModal` — quote creation entry point
- Hover cards: `CustomerHoverCardContent`, `PoCHoverCardContent`, `QuotePreviewHoverCardContent`

### Cell-Level IA
- `CustomerCell`, `PoCCell`, `StatusBadge`, `PriorityBadge`, `VersionBadge`, `UnreadIndicator`, `InventoryTooltip`, `HighlightText`

## Level 2 — Quote Creation Flow
Source: `CreateQuoteModal.tsx` and `quote-creation/`

### Stepper IA
1. **Step 1 — Customer Selection** (`Step1CustomerSelection.tsx`)
   - Nested **Customer Configuration** sub-surface (`Step2Configuration.tsx`)
2. **Step 2 — Line Items** (`Step3LineItems.tsx`)
3. **Review** (`Step4Review.tsx`)
4. **Success** (`QuoteCreatedSuccess.tsx`)

### Configuration Sub-IA (inside Step 1)
- Customer Location → `LocationSelectionModal`
- Recipients → `RecipientsSelectionModal`
- Billing / Shipping → `AddressSelectionModal`
- Payment Terms → `PaymentTermsLibrary`
- Payment Method → `PaymentMethodSelectionModal`
- Sales Reps → `SalesRepSelector`
- Dates → `DateConfigCards`, `DateEditModal`
- Pricing Rules → `PricingRulesLibrary`, `PricingRuleLibraryModal`
- Line Item config → `LineItemConfigModal`
- Search overlay → `SearchOverlay`
- Summary → `QuoteSummaryPanel`

## Level 2 — Quote Details Workspace
Source: `QuoteDetails.tsx`

### Page Regions
1. **Status Header** — quote number, version, status, primary actions
2. **Status Stepper** — lifecycle progression (`ModernStatusStepper.tsx`)
3. **Status Action Button** — context-sensitive primary CTA (`StatusActionButton.tsx`)
4. **Tab Bar** — domain navigation
5. **Tab Content Area** — active tab renderer
6. **Right Sidebar** — editable metadata (`RightSidebar.tsx`, `EditableSidebarV3.tsx`)

### Tabs (Domain IA)
- **Overview** (`OverviewTab.tsx`) — deal information, RFQ/RFP docs, win probability, lead source
- **Items** (`ItemsTabTableClean.tsx`) — line items, adjustments, pricing
- **Linked Transactions** (`TransactionsTab.tsx`) — downstream records (SO, invoice, payment, delivery, return, credit memo)
- **Attachments** (`LinkedTransactionsTab.tsx`) — file attachments, PDF visibility
- **Communications** (`CommunicationsTab.tsx`) — messaging
- **Activity** (`ActivityTab.tsx`) — audit log
- **Version History** (`VersionHistoryTab.tsx`) — version timeline
- **Invoicing** (`ComingSoonTab.tsx`) — placeholder
- **Timeline** — date/lifecycle milestones (surfaced via stepper + overview)

### Right Sidebar Sections
- Customer + Primary PoC
- Sales Reps (primary + secondary)
- Bill To / Ship To addresses
- Payment Terms / Method
- Dates (request, effective, expiry, due-by)
- Priority and Tags
- Description / Notes

### Anchored Modals & Overlays
- **Versioning**: `AutoVersionConfirmModal`, `AutoVersionOverlay`, `VersionChangePromptModal`, `VersionDropdown`, `VersionHistoryModal`, `versionToasts`
- **Lifecycle Transitions**: `SendToCustomerModal`, `ConvertToSOModal`, `CancelConvertedQuoteModal`, `ReviveCancelledModal`, `ReviveQuoteModal`, `StatusTransitionOverlay`
- **Editing**: `AdvancedConfiguratorModal`, `ProductPickerModal`, `ManageAdjustmentsModal`, `PricingRulesManageModal`, `AdjustmentFormModal`
- **Documents**: `PDFPreviewModal`, `PDFVisibilityModal`
- **Conflict & Duplication**: `DraftConflictModal`, `DuplicateQuoteModal`
- **Sales Rep**: `AssignSalesRepModal`
- **Confirmation**: `ConfirmationModal`
- **Priority**: `PriorityDropdown`

## Data Domain IA
The module organizes information around these conceptual domains:

1. **Identity** — quote number, version, status, lifecycle dates
2. **Parties** — customer, recipients (PoCs), sales reps
3. **Locations** — customer location, billing address, shipping address
4. **Commercials** — line items, adjustments, pricing rules, payment terms, payment method, totals
5. **Timeline** — request, effective, expiry, due-by, confirmation dates
6. **Deal Context** — win probability, lead source, priority, tags, description, RFQ/RFP docs
7. **Documents** — attachments, generated PDFs, PDF visibility
8. **Relationships** — linked transactions (SO, invoice, payment, delivery, return, credit memo)
9. **Communication** — messages, unread state
10. **Audit** — activity log, version history

## Lifecycle (Status) IA
Statuses defined in `types/quote.ts`:
- `Draft`
- `Sent to Customer`
- `Unconfirmed SO`
- `Confirmed SO`
- `Cancelled`
- `Archived`
- `Expired`

Lifecycle is surfaced through:
- Status badge in list and detail headers
- Status stepper on detail page
- Status-driven primary action button
- Status-driven tab availability and read-only behavior

## Versioning IA
Engine: `utils/versioningEngine.ts`

Versioning surfaces:
- Version badge (header + list)
- Version dropdown (detail header)
- Version history modal and tab
- Auto-version confirmation modal and overlay
- Version change prompt modal
- Version toasts

Material vs non-material edit classification is documented in `Quote_Versioning_Logic.md` and per-domain MDs (01–10).

## Cross-Cutting Surfaces
- **Toasts** — `QuoteCreatedToast`, `versionToasts`, generic `sonner`/`toaster`
- **Hover cards** — preview-on-hover for customers, PoCs, quotes
- **Coming Soon placeholder** — `ComingSoonTab`
- **Section card primitive** — `SectionCard`

## Data Stores
- `data/quoteStore.ts` — created quotes, line items, descriptions, RFQ/RFP docs, pre-quote document subscriptions
- `data/mockQuotes.ts` — seeded list data
- `data/products.ts` — product catalog for line items

## Navigation Map (Summary)
```
Sidebar
└── Quotes (module)
    ├── Quotes List (/)
    │   ├── KPI / Insights
    │   ├── Filters & Columns
    │   ├── Table / Kanban
    │   ├── Bulk Actions
    │   └── Create Quote (modal)
    │       ├── Step 1: Customer + Configuration sub-flow
    │       ├── Step 2: Line Items
    │       ├── Review
    │       └── Success
    └── Quote Details (/quotes/:id)
        ├── Status Header + Stepper + Action Button
        ├── Tabs
        │   ├── Overview
        │   ├── Items
        │   ├── Linked Transactions
        │   ├── Attachments
        │   ├── Communications
        │   ├── Activity
        │   ├── Version History
        │   └── Invoicing (Coming Soon)
        ├── Right Sidebar (editable metadata)
        └── Lifecycle / Versioning Modals & Overlays
```

## Requirements Summary
- IA must clearly separate multi-quote (list) and single-quote (detail) workspaces.
- Quote creation must remain a stepped, modal-anchored flow with a nested customer-configuration sub-surface.
- Detail page must expose all data domains as discrete tabs while keeping editable metadata in a persistent right sidebar.
- Lifecycle, versioning, and document workflows must be surfaced as anchored modals/overlays rather than separate pages.
- Cross-cutting surfaces (toasts, hover cards, badges) must remain consistent across list and detail.

## Detailed Sitemap

A full enumeration of every route, surface, sub-surface, modal, overlay, drawer, tab, panel, and atomic UI region in the Quote Management module. Routes are marked `[ROUTE]`, modals as `(modal)`, overlays as `(overlay)`, drawers as `(drawer)`, hover cards as `(hover)`, and toasts as `(toast)`.

```
Quote Management Module
│
├── Global Shell
│   ├── Sidebar (Sidebar.tsx)
│   │   ├── Module nav items
│   │   ├── Collapse / expand control
│   │   └── User / workspace footer
│   ├── TopBar / Header (RootLayout.tsx)
│   │   ├── Breadcrumbs (Sales / Quotes / :id)
│   │   ├── Global search trigger
│   │   └── User profile block
│   ├── ModuleHeader (ModuleHeader.tsx)
│   │   ├── Title + subtitle
│   │   ├── Breadcrumb context
│   │   └── Primary CTA (Create Quote)
│   └── Toaster (sonner)
│       ├── QuoteCreatedToast
│       ├── versionToasts (created, restored, discarded, auto-bumped)
│       └── Generic success / error / info toasts
│
├── [ROUTE] / — Quotes List Page (QuotesListPage.tsx)
│   ├── ModuleHeader
│   │   └── "Create Quote" CTA → CreateQuoteModal (modal)
│   ├── KPI / Performance Insights
│   │   ├── KpiInsightsPanel
│   │   │   ├── KPI cards (count, value, win rate, avg cycle)
│   │   │   ├── Trend indicators
│   │   │   └── Time-range selector
│   │   └── PerformanceInsights
│   ├── ViewControls
│   │   ├── View switcher (Table / Kanban)
│   │   ├── Density toggle
│   │   └── Refresh
│   ├── FilterBar
│   │   ├── Saved filter chips
│   │   ├── Quick filter dropdowns
│   │   ├── "Add filter" trigger → FiltersModal (modal)
│   │   └── FilterPills (active filter chips, clearable)
│   ├── TableControls
│   │   ├── Search input (HighlightText powered)
│   │   ├── Column config trigger → ColumnConfigSidebar (drawer) / ColumnSelector (modal) / ColumnConfigurator
│   │   ├── Density / row height
│   │   └── Export
│   ├── Data Surface (one of)
│   │   ├── TableView
│   │   │   ├── Column headers → ColumnHeaderMenu (popover: sort, pin, hide, filter)
│   │   │   ├── Row selection checkboxes
│   │   │   ├── Cells
│   │   │   │   ├── CustomerCell → CustomerHoverCardContent (hover)
│   │   │   │   ├── PoCCell → PoCHoverCardContent (hover)
│   │   │   │   ├── StatusBadge
│   │   │   │   ├── PriorityBadge
│   │   │   │   ├── VersionBadge → VersionDropdown (popover)
│   │   │   │   ├── UnreadIndicator
│   │   │   │   ├── InventoryTooltip (tooltip)
│   │   │   │   └── HighlightText (search highlight)
│   │   │   ├── Row hover → QuotePreviewHoverCardContent (hover)
│   │   │   ├── Row click → navigate /quotes/:id
│   │   │   └── Pagination footer
│   │   └── KanbanView
│   │       ├── Status columns
│   │       ├── Quote cards (drag-drop)
│   │       └── Column counters
│   ├── BulkActionsToolbar (visible on selection)
│   │   ├── Bulk status change
│   │   ├── Bulk assign sales rep → AssignSalesRepModal (modal)
│   │   ├── Bulk delete → ConfirmationModal (modal)
│   │   ├── Bulk export
│   │   └── Bulk archive
│   └── Anchored Modals (from list)
│       ├── CreateQuoteModal (modal) — see Quote Creation Flow
│       ├── FiltersModal (modal)
│       ├── ColumnSelector (modal)
│       ├── ColumnConfigSidebar (drawer)
│       ├── DuplicateQuoteModal (modal)
│       ├── AssignSalesRepModal (modal)
│       └── ConfirmationModal (modal)
│
├── Quote Creation Flow (CreateQuoteModal — modal-anchored stepper)
│   ├── Step 1 — Customer Selection (Step1CustomerSelection)
│   │   ├── Customer search field
│   │   ├── Customer list / picker
│   │   ├── New customer entry
│   │   └── On select → Step 2 (Configuration sub-flow)
│   ├── Step 2 — Customer Configuration (Step2Configuration)
│   │   ├── Location card → LocationSelectionModal (modal)
│   │   ├── Recipients card → RecipientsSelectionModal (modal)
│   │   ├── Bill To card → AddressSelectionModal (modal, mode=billing)
│   │   ├── Ship To card → AddressSelectionModal (modal, mode=shipping)
│   │   ├── Payment Terms card → PaymentTermsLibrary (modal)
│   │   ├── Payment Method card → PaymentMethodSelectionModal (modal)
│   │   ├── Sales Reps card → SalesRepSelector (popover/modal)
│   │   ├── Dates section
│   │   │   ├── DateConfigCards (request, effective, expiry, due-by)
│   │   │   └── Edit → DateEditModal (modal: absolute / relative / event-triggered)
│   │   ├── Pricing Rules card
│   │   │   ├── PricingRulesLibrary
│   │   │   └── PricingRuleLibraryModal (modal)
│   │   ├── Priority + Tags + Description (inline)
│   │   └── QuoteSummaryPanel (running summary)
│   ├── Step 3 — Line Items (Step3LineItems)
│   │   ├── Item search → SearchOverlay (overlay)
│   │   ├── ProductPickerModal (modal)
│   │   ├── Item rows (qty, price, discount)
│   │   ├── Per-line config → LineItemConfigModal (modal)
│   │   ├── Adjustments → ManageAdjustmentsModal (modal) → AdjustmentFormModal (modal)
│   │   ├── AdvancedConfiguratorModal (modal)
│   │   └── QuoteSummaryPanel
│   ├── Step 4 — Review (Step4Review)
│   │   ├── Customer + config summary
│   │   ├── Line items summary
│   │   ├── Totals breakdown
│   │   └── Submit → create quote
│   ├── Success — QuoteCreatedSuccess
│   │   ├── Confirmation message
│   │   ├── "Open quote" CTA → /quotes/:id
│   │   └── "Create another" CTA
│   └── DraftConflictModal (modal — on resume)
│
├── [ROUTE] /quotes/:quoteId — Quote Details (QuoteDetails.tsx)
│   ├── Status Header
│   │   ├── Quote number + title
│   │   ├── VersionBadge → VersionDropdown (popover)
│   │   ├── StatusBadge
│   │   ├── PriorityDropdown (popover)
│   │   ├── Overflow actions (duplicate, archive, delete, PDF)
│   │   └── StatusActionButton (context CTA)
│   ├── ModernStatusStepper
│   │   ├── Lifecycle nodes (Draft → Sent → Unconfirmed SO → Confirmed SO)
│   │   ├── Side-states (Cancelled, Expired, Archived)
│   │   └── Click node → contextual transition modal
│   ├── Tabs (TabBar)
│   │   ├── Overview (OverviewTab)
│   │   │   ├── Deal information section
│   │   │   ├── Win probability
│   │   │   ├── Lead source
│   │   │   ├── RFQ / RFP documents
│   │   │   └── Description / notes
│   │   ├── Items (ItemsTabTableClean)
│   │   │   ├── Line item table
│   │   │   ├── Adjustments → ManageAdjustmentsModal (modal)
│   │   │   ├── Pricing rules → PricingRulesManageModal (modal)
│   │   │   ├── Add product → ProductPickerModal (modal)
│   │   │   ├── Per-line config → LineItemConfigModal / AdvancedConfiguratorModal (modal)
│   │   │   └── Totals footer
│   │   ├── Linked Transactions (TransactionsTab)
│   │   │   ├── SO, Invoice, Payment, Delivery, Return, Credit Memo lists
│   │   │   └── Row → external module deep links
│   │   ├── Attachments (LinkedTransactionsTab)
│   │   │   ├── Attachment list
│   │   │   ├── Upload control
│   │   │   ├── PDF visibility → PDFVisibilityModal (modal)
│   │   │   └── Preview → PDFPreviewModal (modal)
│   │   ├── Communications (CommunicationsTab)
│   │   │   ├── Message thread
│   │   │   └── Composer
│   │   ├── Activity (ActivityTab)
│   │   │   └── Audit log entries
│   │   ├── Version History (VersionHistoryTab)
│   │   │   ├── Version timeline
│   │   │   └── Open snapshot → VersionHistoryModal (modal)
│   │   └── Invoicing (ComingSoonTab — placeholder)
│   ├── Right Sidebar (RightSidebar / EditableSidebarV3)
│   │   ├── Customer + Primary PoC (editable)
│   │   ├── Sales Reps (primary + secondary) → AssignSalesRepModal (modal)
│   │   ├── Bill To → AddressSelectionModal (modal)
│   │   ├── Ship To → AddressSelectionModal (modal)
│   │   ├── Payment Terms → PaymentTermsLibrary (modal)
│   │   ├── Payment Method → PaymentMethodSelectionModal (modal)
│   │   ├── Dates (request, effective, expiry, due-by) → DateEditModal (modal)
│   │   ├── Priority + Tags
│   │   └── Description / notes
│   └── Anchored Modals & Overlays (from details)
│       ├── Lifecycle Transitions
│       │   ├── SendToCustomerModal (modal)
│       │   ├── ConvertToSOModal (modal)
│       │   ├── CancelConvertedQuoteModal (modal)
│       │   ├── ReviveCancelledModal (modal)
│       │   ├── ReviveQuoteModal (modal)
│       │   └── StatusTransitionOverlay (overlay)
│       ├── Versioning
│       │   ├── AutoVersionConfirmModal (modal)
│       │   ├── AutoVersionOverlay (overlay)
│       │   ├── VersionChangePromptModal (modal)
│       │   ├── VersionDropdown (popover)
│       │   ├── VersionHistoryModal (modal)
│       │   └── versionToasts (toast)
│       ├── Documents
│       │   ├── PDFPreviewModal (modal)
│       │   └── PDFVisibilityModal (modal)
│       ├── Conflict & Duplication
│       │   ├── DraftConflictModal (modal)
│       │   └── DuplicateQuoteModal (modal)
│       └── Confirmation
│           └── ConfirmationModal (modal)
│
└── [ROUTE] /quotes/:quoteId/edit — Edit Quote (EditQuote.tsx)
    ├── Reuses Step 2 / Step 3 surfaces in edit mode
    ├── Material-change detection → AutoVersionConfirmModal (modal)
    └── Save / discard controls
```

### Sitemap Legend
- `[ROUTE]` — addressable URL handled by `App.tsx` router
- `(modal)` — overlay dialog blocking the parent surface
- `(overlay)` — non-blocking full-surface visual overlay
- `(drawer)` — side-anchored panel
- `(popover)` — anchored floating menu
- `(hover)` — hover-triggered card or tooltip
- `(toast)` — transient notification

## Cross-References
- `Quote_Versioning_Logic.md`
- `docs/quote-flows/01-deal-information.md` … `10-customer-configurations-quote-creation.md`
