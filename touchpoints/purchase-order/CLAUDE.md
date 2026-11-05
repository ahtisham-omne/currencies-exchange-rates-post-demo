# Project working agreement

## Scope

**Work only on the Purchase Orders surfaces.** Do not change Procurement Planning (planner workspace, gap graph, transaction table, supply wizard, snapshots, demand modals, planner data), the Homepage, or any other unrelated surface — unless the user explicitly asks for it. This is the current scope; the previous phase was the mirror image (planner in scope, POs out).

Files generally **in scope** for changes:

- `src/app/components/PurchaseOrdersListing.tsx`
- `src/app/components/PODataTable.tsx`
- `src/app/components/POFiltersModal.tsx`
- `src/app/components/POFilterBar.tsx`
- `src/app/components/CatalogueModal.tsx`
- `src/app/components/OrderFlow.tsx`
- `src/app/components/CartPage.tsx`
- `src/app/components/PurchaseOrderDraft.tsx`
- `src/app/components/PODetailTabs.tsx`
- `src/app/components/PODashboard.tsx`
- `src/app/components/POVersionHistoryModal.tsx`
- `src/app/components/POVersionHistoryTab.tsx`
- `src/app/components/POVersionRevertModal.tsx`
- `src/app/components/POVersionRow.tsx`
- `src/app/components/POVersionDropdown.tsx`
- `src/app/components/POVersionSnapshotPanel.tsx`
- `src/app/components/POVersionChangeList.tsx`
- `src/app/components/POPricingRulesManageModal.tsx`
- `src/app/components/POPriceBreakdownHoverCard.tsx`
- `src/app/components/POPricingRuleDetailModal.tsx`
- `src/app/components/POSidebarSections.tsx`
- `src/app/components/DuplicatePODialog.tsx`
- `src/app/components/ShippingCarrierPicker.tsx`
- `src/app/components/poStore.ts`
- `src/app/components/cartStore.ts`
- `src/app/components/catalogData.ts`
- `src/app/components/poPricingRulesData.ts`
- `src/app/components/poVersionDisplay.ts`

Files generally **out of scope** (do not modify without asking):

- `src/app/components/PODemands.tsx`
- `src/app/components/PlannerSandboxModal.tsx`
- `src/app/components/PlannerWorkspacePage.tsx`
- `src/app/components/PlannerVendorPanel.tsx`
- `src/app/components/PlannerGapGraph.tsx`
- `src/app/components/PlannerTransactionTable.tsx`
- `src/app/components/PlannerCauseModal.tsx`
- `src/app/components/PlannerScopeQuestionnaire.tsx`
- `src/app/components/PlannerScopeBar.tsx`
- `src/app/components/DemandItemDetailModal.tsx`
- `src/app/components/DemandFiltersModal.tsx`
- `src/app/components/UnifiedTransactionStream.tsx`
- `src/app/components/ProcurementPlanningEntry.tsx`
- `src/app/components/procurementPlanningParams.ts`
- `src/app/components/plannerData.ts`
- `src/app/utils/projection.ts`
- `src/app/components/plannerTxEnrich.ts`
- `src/app/components/PlannerAddChooser.tsx`
- `src/app/components/PlannerManageCategoriesModal.tsx`
- `src/app/components/PlannerManageItemsModal.tsx`
- `src/app/components/SupplyPlanWizard.tsx`
- `src/app/components/PlannerQtyInput.tsx`
- `src/app/components/PlannerDevWidget.tsx`
- `src/app/components/PlannerTimelineCanvas.tsx`
- `src/app/components/PlannerSnapshotCompare.tsx`
- `src/app/components/PlannerSnapshotViewChrome.tsx`
- `src/app/components/plannerSnapshotStore.ts`
- `src/app/components/Homepage.tsx`

Tiny mounting/wiring edits in shared files (e.g. adding a route, wiring a shared cart / store event, updating a page router that touches both PO and planner sides) are OK when they're the plumbing for a Purchase Orders change; visible/behavioral changes to Procurement Planning surfaces are not.

## Push policy

Do not push to remote with every change. Only push when the user explicitly asks.

## Merge / PR flow

Deployments and Lovable watch **`ahtisham-omne/Purchase-Order`** (`upstream`). Open PRs against `ahtisham-omne:main` from the personal fork branch (`areebtanvir:<branch>`), not against `areebtanvir/Purchase-Order:main`. Recent PRs on upstream: #98–#102, all cross-fork from `areebtanvir:pp-planner-pr-actions-and-insights`.
