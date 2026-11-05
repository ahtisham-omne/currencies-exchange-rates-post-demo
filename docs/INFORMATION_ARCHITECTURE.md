# Pioneer ERP — Information Architecture & Sitemap

> **Module in scope:** Sales (Order-to-Cash). Other top-level modules are present in the sidebar shell but disabled in this build.
> **Last updated:** 2026-04-30

---

## 1. Top-Level Navigation (Global Sidebar)

The persistent left sidebar (`AppSidebar.tsx`) groups all ERP modules. Only **Sales** is active in this build; others are placeholders for the full Pioneer ERP suite.

| # | Module | Status | Purpose |
|---|--------|--------|---------|
| 1 | Items & Inventory | Disabled | SKU master, stock, lots, locations |
| 2 | Partners Management | Disabled | Customers, vendors, contacts |
| 3 | Supply Chain | Disabled | Procurement, logistics, warehousing |
| 4 | Production | Disabled | Manufacturing orders, BOMs |
| 5 | **Sales** | **Active** | Quote → SO → Ship → Invoice |
| 6 | Accounting | Disabled | GL, AR/AP, taxes |
| 7 | People | Disabled | Employees, roles, permissions |
| 8 | Company Setup | Disabled | Org settings, branches |

**Global shell elements** (always visible):
- Top header: breadcrumbs, global search, notifications, current user avatar (Ahtisham Ahmad).
- Sidebar footer: **Persona toggle** (`Sales View` ↔ `Ops View`), Settings, Bell, user card with logout.
- Sidebar is collapsible (Cmd/Ctrl+B), hover-expandable when collapsed, and resizable (220–420 px).

---

## 2. Sales Module — Sub-navigation

Expanded under **Sales** in the sidebar. Routes managed by `src/app/routes.tsx`.

| # | Page | Route | Status | Purpose |
|---|------|-------|--------|---------|
| 1 | Overview (Sales Home) | `/` | Active | Landing dashboard, module entry points |
| 2 | Quotes | `/quotes` | Reference only | Pre-sale quoting (built in companion project) |
| 3 | **Sales Orders** | `/sales-orders` | **Active** | SO lifecycle management — main module |
| 4 | Invoicing | `/invoicing` | Disabled | AR invoices, payments |
| 5 | Inventory Allocation | `/allocation` | Disabled | Reserve/release stock against demand |
| 6 | Sales Analytics | `/analytics` | Disabled | KPIs, trends, performance |
| 7 | Returns & Credits | `/returns` | Disabled | RMAs, credit memos |

---

## 3. Sales Orders — Detailed Sitemap

### 3.1 Listing View — `/sales-orders`

**Component:** `SOList.tsx` · **Sidebar:** `SOFilterBar.tsx` / `SOFilterPills.tsx`

#### View modes
- **Table view** (default): dense grid with sticky first column, configurable columns.
- **Kanban view** (`SOKanbanBoard.tsx`): cards grouped by lifecycle stage; drag & drop with persona-based limits.
- **Fullscreen toggle**: hides global chrome, preserves controls.

#### Header & toolbar
- Page title + record count.
- Primary CTA: **Create Sales Order** → opens `CreateSOModal`.
- Secondary: View switcher (Table/Kanban), Fullscreen, Filters (modal with badge), Sort, Column configurator (`SOColumnConfigurator`), Export (`ExportSOModal`).
- **Filter pills** row: active filter chips, clearable individually.
- **Insights panel** (`InsightsPanel.tsx`): draggable KPI cards above the grid (AOV, TPR, Order Revision %).

#### Row interactions
- Click row → navigate to `/sales-orders/:id`.
- Checkbox select → reveals **Bulk Action Bar** (Submit, Clear, Archive, Export, Print, Esc to clear).
- Hover **Customer** cell → `CustomerHoverCard` overlay with KPIs and POC.
- Hover **ATP** cell → `ATPTooltip` with inventory breakdown.
- Hover **Invoiced** cell → payment overlay.

#### Columns (configurable)
SO #, Status, Customer, Created date, Requested ship, Promised ship, Items, Qty, Subtotal, Discount, Tax, **Total**, Invoiced, Paid, Balance, Owner, Tags, Version.

---

### 3.2 Create Sales Order — Modal

**Components:** `CreateSOModal.tsx` (Step 1) → `CreateSOStep2.tsx` (Step 2) · width: 960 px · circular step indicator.

**Step 1 — Header & Parties**
- Customer search & select (with auto-population of defaults).
- Recipients (PoCs) → `RecipientsSelectionModal`.
- Billing address & Shipping address → `AddressSelectionModal`.
- Payment Terms → `PaymentTermsLibrary`.
- Payment Method → `PaymentMethodSelectionModal`.
- Shipping Terms → `ShippingTermsModal`.
- Sales Rep(s) → `SalesRepSelector`.
- Date config (absolute / relative) → `DateConfigCards`.
- Location → `LocationSelectionModal`.

**Step 2 — Line Items**
- 70/30 split: line item builder (left) + product catalog sidebar (right).
- Add items, configure (`AdvancedConfiguratorModal` / `LineItemConfigModal`), duplicate, delete.
- Live order summary, ATP indicators.

**Outcome:** `SOCreatedSuccessModal` → option to view detail or create another.

---

### 3.3 Sales Order Detail — `/sales-orders/:id`

**Component:** `SODetail.tsx` · **Right pane:** `SOSidebar.tsx`

#### Page header
- SO number + inline editable description (`so-header-description`).
- `StatusBadge` + `VersionBadge` + `SOVersionDropdown` (version history access).
- **Lifecycle stepper**: Draft → Pending Approval → Confirmed → Allocated → Picked → Packed → Shipped (persona-skippable). `StagePopover` for stage actions.
- Action menu: Send to Customer, Print, Duplicate, Archive, Reactivate, Cancel, Partial Cancel.

#### Tabs
| Tab | Component | Contents |
|-----|-----------|----------|
| 1. Line Items | `SOLineGrid.tsx` + `LineEditDrawer.tsx` | Editable grid, allocations, hover ATP, splits |
| 2. Deal Information | `DealInformationTab.tsx` | Parties, terms, dates, sales reps (no T&C) |
| 3. Sourcing & Production | `SourcingProductionTab.tsx` | PO history, MO history per line |
| 4. Shipments | `ShipmentsTab.tsx` + `CreateShipmentModal` | Shipment records, carrier, tracking |
| 5. Picking | `PickingTab.tsx` | Pick lists, bin assignments |
| 6. Invoicing | `InvoicingTab.tsx` | Invoices, payments, balance |
| 7. Linked Transactions | `LinkedTransactionsTab.tsx` | Quotes, POs, MOs, RMAs |
| 8. Attachments | `AttachmentsTab.tsx` | File thumbnails, item-level nesting |
| 9. Activity | `ActivityTab.tsx` | Audit log, comments, system events |
| 10. Version History | `VersionHistoryTab.tsx` + `VersionHistoryModal` | Material vs non-material change diffs |

#### Right sidebar (`SOSidebar.tsx`)
- Customer card (with hover detail).
- Bill-to / Ship-to addresses (inline editable).
- Payment terms, method, shipping terms, currency.
- Sales rep(s).
- Order Summary: Subtotal, Discounts, Tax, Total, Invoiced, Paid, Balance.
- Pricing rule indicator (global vs local override).

---

## 4. Modals & Overlays Inventory

Grouped by purpose. All overlays render via React `createPortal`.

### 4.1 Lifecycle & state changes
- `ConfirmSOModal` / `BulkConfirmSOModal` — confirm draft → submitted.
- `CancellationModal` / `PartialCancelModal` / `ConfirmCancelDialog` — cancel flows.
- `ArchiveModal` — amber-themed archive confirmation.
- `ReactivateSOModal` — restore terminal SOs to versioned drafts.
- `StageTransitionOverlay` — full-screen glassmorphism animation between stages.
- `AutoVersionConfirmModal` / `AutoVersionOverlay` / `VersionChangePromptModal` — versioning engine prompts.

### 4.2 Line item configuration
- `AddLineItemDialog` — add product to SO.
- `AdvancedConfiguratorModal` — multi-attribute item config.
- `LineEditDrawer` — edit single line.
- `AllocateInventoryModal` / `AllocationDrawer` — reserve inventory.
- `FulfillmentModal` — partial fulfillment & splits.
- `ManageAdjustmentsModal` / `AdjustmentFormModal` — line-level discounts/charges.
- `PricingRulesManageModal` — apply/override pricing rules.

### 4.3 Selection libraries
- `AddressSelectionModal`, `RecipientsSelectionModal`, `LocationSelectionModal`.
- `PaymentTermsLibrary`, `PaymentMethodSelectionModal`, `ShippingTermsModal`.
- `PricingRulesLibrary` — customer pricing rule presets/templates browser. Mirrors the Partner Management modal: type+basis pill, TEMPLATE/CUSTOM badge, validity badge, multi-tier selector, status filter pills (All / Template / Custom / Created by Me / In Use), sort dropdown, fullscreen toggle, per-card kebab menu (View Details / Apply / Duplicate as Custom). Wired into `LineItemConfigModal` (configurator).
- `SalesRepSelector`.

### 4.4 Document outputs
- `SendToCustomerModal` — visibility toggles + state-transition animation, sends PDF.
- `PrintSalesOrder` — 2-page PDF (header/lines + T&C). Shared layout in `soDocumentData.ts`.
- `ExportSOModal` — list export (CSV/XLSX).

### 4.5 Bulk operations
- `BulkActionModals` — bulk submit, archive, export, print.

### 4.6 System / utility
- `ConfirmationModal` (info / warning / danger variants).
- `ATPTooltip` — inventory snapshot popover.
- `CustomerHoverCard` — quick KPI card.
- `DisabledCTATooltip` — explains why a CTA is disabled.
- `OverflowTooltip` — truncated text expansion.
- `Tooltip` — generic hover label.

---

## 5. Personas & Permissions

Set via the sidebar persona toggle (`PersonaContext.tsx`).

| Persona | Role | Capabilities |
|---------|------|--------------|
| **Sales Creator** (`creator`) | Sales rep | Create/edit SOs, send to customer, request approval, limited stage progression |
| **Ops Reviewer** (`reviewer`) | Operations | Approve, allocate, pick, pack, ship, cancel; can skip stages; full Kanban drag |

Persona affects: visible CTAs, lifecycle stepper transitions, Kanban drag limits, bulk action availability.

---

## 6. Key Cross-Cutting Concepts

- **Version Control** (`utils/versioningEngine.ts`): material changes auto-version the SO; non-material changes update in place.
- **ATP** = On Hand − Quarantined − Demand. Surfaced inline + via `ATPTooltip`.
- **Pricing Rules**: Global (library) vs Local (per-order overrides).
- **Order Summary Metrics**: Subtotal, Discount, Tax, Total, Invoiced, Paid, Balance — always live in the right sidebar and footer.
- **Date Selection**: Absolute (calendar) vs Relative (offset from anchor like Order Date).
- **Reusability**: Sales components mirror Quotes & Partner Management — strict parity, do not rebuild.

---

## 7. Route Map (technical)

```text
/                              SalesHomePage
/quotes                        (placeholder — handled in companion project)
/sales-orders                  SOList   (Table | Kanban | Fullscreen)
/sales-orders/:id              SODetail (10 tabs + right sidebar)
/sales-orders/*                SalesHomePage (catch-all fallback)
*                              NotFound
```

---

## 8. Component-to-Page Map (quick reference)

| Surface | Primary file(s) |
|---------|-----------------|
| Shell | `AppLayout.tsx`, `AppSidebar.tsx` |
| Home | `SalesHomePage.tsx` |
| List | `SOList.tsx`, `SOFilterBar.tsx`, `SOFilterPills.tsx`, `SOColumnConfigurator.tsx`, `SOKanbanBoard.tsx`, `InsightsPanel.tsx` |
| Create | `CreateSOModal.tsx`, `CreateSOStep2.tsx`, `SOCreatedSuccessModal.tsx` |
| Detail | `SODetail.tsx`, `SOSidebar.tsx` + 10 tab components |
| Documents | `PrintSalesOrder.tsx`, `SendToCustomerModal.tsx`, `soDocumentData.ts` |
| State engine | `store.tsx`, `types.tsx`, `utils/versioningEngine.ts`, `PersonaContext.tsx` |
