# BUILD_STATE

State of `rma-web-builder` as of **2026-09-14**, HEAD `7fdecf5` (merge of PR #70).

Three things you asked for by ID are **not in this repo or its git history**: the
`R01`–`R12` rule list, the `K02` / `F039` finding IDs, and the eight-step stepper
agreed with Rida. `grep -rl "R01\|K02\|F039"` across the tree (minus `node_modules`,
`.git`) returns nothing. Sections 4, 5 and 7 answer the underlying questions from
the code and say plainly where the mapping has to come from you.

---

## 1. Build identity

| | |
|---|---|
| Repo | `github.com/ahtisham-omne/rma-web-builder`, branch `main` |
| Local HEAD | `7fdecf5` — Merge PR #70, 2026-09-11 |
| Working tree | Clean for tracked source. Untracked: `ss1-3.png`, `us1-3.png`, `bv.png`, `blk.png`, `findings/`, `DS-Component-Compliance-rma-web-builder.html`, empty file `RMA web` |
| Deployed | `rma-web-pal.lovable.app` — live, SSR shell + client render, redirects `/` → `/supply-chain` |
| Deployed build | Route chunk `assets/rma-zuSfc_rd.js` (768 KB) |
| **Divergence** | **None in content.** The deployed chunk contains the strings added by PR #70 on 2026-09-11 (`Enter the quantity on the item card`, `Search the vendors you have received from`, `Which vendor are you clearing`, `Select serial numbers`). Published site == `main` @ `7fdecf5`. |
| Authorship divergence | Lovable last authored a commit on **2026-08-11** (`026cab9`, "Add project README"). All 151 commits since are local (`areebtanvir` / `Areeb Tanvir`). Lovable is a sync + publish target now, not a co-author. |
| Sync contract | `AGENTS.md` — commits pushed to the connected branch sync into the Lovable editor; do not rewrite published history. |
| Stack | TanStack Start + Vite + React + TS, Tailwind, shadcn/ui, Radix, react-dnd, sonner |
| TS baseline | **347 errors** from `npx tsc --noEmit`. Pre-existing. Any other number is new. |
| Backend | None. Every screen is fixture-driven; persistence is `localStorage`. |

**localStorage keys in use**

- `omnesoft:rma:created-drafts-v2` — RMAs made by the create flow
- `omnesoft:rma-lines-v1`, `omnesoft:rma-shipping-v1` — create-flow drafts in progress
- `omnesoft:rma:active-widgets-v5`, `omnesoft:rmas:insights-range-v1` — list KPI layout + range
- `omnesoft:invoice-lines-v3`, `omnesoft:invoice-lines-standalone`, `omnesoft:invoice-payments:columns`
- `omnesoft:sidebar-collapsed`, `omnesoft:sidebar-width`, `omnesoft:recents:`

---

## 2. Route and screen inventory

### Routes (`src/routes/`)

- `/` — `index.tsx`, redirects
- `/supply-chain` — `supply-chain.tsx`, `ssr: false`
- `/rma` — `rma.tsx`, `ssr: false`
- `/rma/$rmaNumber` — `rma_.$rmaNumber.tsx`, `ssr: false`
- `__root.tsx` — shell

### Sidebar (`Layout.tsx:78-120`)

- Items & Inventory — disabled
- Partners Management — disabled
- Supply Chain Management → **Overview** (`/supply-chain`), **Returns** (`/rma`) — the only live entries
- Production & Planning, Sales — disabled
- Accounting & Finance → 10 children, all `comingSoon: true` (Overview, Dashboard, Vendor Invoicing, Vendor Payments, Customer Invoicing, Customer Payments, Chart of Accounts & GL, Currency/Exchange Rate Library, Cash Management, Financial Reporting)
- Company Setup → Costing Methods, `comingSoon: true`

### Screens

- `SupplyChainOverviewScreen` — module cards, drag-reorder
- `RMAListScreen` — `RMADataTable`, `RMAInsightsPanel`, `DraggableRMAKpiCard`, `ColumnSelector`, `BulkActionBar`, `InvoiceActiveFiltersBar`, `shared/filterModal`
- `RMADetailScreen` — legacy detail (still compiled, reachable only from its own imports)
- `InvoiceDetailScreen` — **the live detail screen**; RMA folded into `Invoice` shape by `rma_.$rmaNumber.tsx`
- `CreateInvoiceScreen` (~11k lines) — the create flow
- `RMACreationFlow` — the wrapper: `FlowStep = 'pick-mode' | 'pick-items' | 'pick-vendor' | 'create'`

### Detail tabs (`InvoiceDetailScreen.tsx:336-351`)

| Tab | In RMA mode |
|---|---|
| Line Items | Shown, relabelled **Return Items** |
| Shipping | Hidden until post-settlement statuses |
| Linked Records | Shown |
| Payments | **Always hidden** for RMA |
| GL Impact | Hidden until post-settlement statuses |
| Attachments | Shown |
| Versions | Shown (RMA only) |
| Recent Activity | Shown |

### Modals and dialogs

**Create flow** — `RMAStartModal` (by item / by vendor), `ItemSearchModal`, `VendorItemsModal` (2 phases), `SerialSelectionModal`, `ReturnFamilyMergeModal`, `RMAConfirmModal`, `LineItemAttachmentsModal` *(0 importers — dead)*, `VendorSelectionModalNested`, `StandaloneVendorSelectionModal`, `ShipToSelectionModal`, `CarrierBrowseModal`

**Detail** — `SendToVendorModal`, `RMALineEditModal`, `ReceivingDocumentModal`, `AddCreditMemoModal`, `ReversePaymentModal`, `InvoiceReasonDialog`, `ItemQuickViewModal`, `GLAccountConfigModal`, `SystemSettingsModal`

**Versions** — `RMAVersionHistoryModal`, `RMAVersionRevertModal`, `RMAVersionCompareView`, `RMAVersionDropdown`, `RMAEditGate`

**Payments** — `PayFromAccountModal` (invoice surface, not RMA)

---

## 3. Per screen: implemented / stubbed / fixture

Everything is **fixture** at the data layer: 46 vendors (`mockVendors.ts:659`), 24 generated RMAs (`mockRMAs.ts:400`), seeded PRNG, no network.

| Surface | State | Note |
|---|---|---|
| `/supply-chain` overview | Implemented | Drag-reorder persists locally |
| `/rma` list + table + filters + columns | Implemented | |
| RMA insights / KPI strip | Implemented | Range persists |
| Bulk action bar | Implemented | Acts on local state |
| Create — start modal | Implemented | |
| Create — by-item catalogue | Implemented | Empty until search |
| Create — by-vendor picker | Implemented | Empty until search; phase 2 (parts grid) is **unreachable in-app** — `RMACreationFlow.tsx:126` always passes `onPickVendorOnly` |
| Create — step 1 What is coming back | Implemented | |
| Create — step 2 Which units | Implemented | Skipped when no line is tracked |
| Create — step 3 Where it goes back | Implemented | Vendor, their receipts, the site strip, the merge question |
| Create — step 4 How it settles | Stubbed | `STUB_STEPS` |
| Create — serial picker | Implemented | |
| Create — merge/split | Implemented | |
| Create — save / Save as Draft | Implemented | Writes `created-drafts-v2` |
| Create — lot picker | **Missing** | Lot lines route through the flat delivery table; `lots: []` is written empty |
| Create — "Add a new vendor" | **Stub** | `window.open('', '_blank')` — blank tab, `CreateInvoiceScreen.tsx:7003` |
| Detail — Return Items, Linked Records, Attachments, Versions, Activity | Implemented | |
| Detail — GL Impact | Implemented | Reads `rmaGLEntries.ts` |
| Detail — Send to vendor | Implemented | Document preview, then status move |
| Detail — **Ship to vendor** | ⚠️ **SIMULATED** | `InvoiceDetailScreen.tsx:1149-1151`. Dashed emerald CTA + `SIMULATED` badge (`:1890`). Real trigger is the Shipments team raising a shipment. |
| Detail — **Close return** | ⚠️ **SIMULATED** | `InvoiceDetailScreen.tsx:1152-1153`. Real trigger is Vendor Invoicing settling the credit, or vendor confirmation on a no-credit return. |
| Detail — Print / Download RMA | Stub | Menu entries, toast only |
| Detail — Record amount received | Implemented | Local state |
| Detail — Cancel / Archive | Implemented | Local state |
| `SystemSettingsModal` | **Stub** | Header says so: "the port ships a minimal placeholder" |
| `RMADetailScreen` | Legacy | Compiled, not on a route |

**Dead but compiled.** `STEP1` is pinned to `'configure'` (`CreateInvoiceScreen.tsx:355`); the `'catalogue'` and `'search'` branches (`:7032`, `:7072`) are the previous designs and never render. Same for the earlier step components they pull in: `ReturnSelectItemsStep`, `ReturnResolvePane`, `ReturnResolveItemCard`, `ReturnSerialResolve`, `ReturnSourceChecklist`, `ReturnItemCard`, `ReturnVendorGroupCard`, `ReturnSummaryPanel`, `ReturnVendorCard`, `ReturnGroupingPanel`, `ReturnVendorSplitList`.

---

## 4. Line-item and RMA data shape

Source of truth: `src/app/data/mockRMAs.ts`.

### `returnType` — **both header and line**

- `RMA.returnType: ReturnType` — **required, on the header** (`:187`)
- `RMALineItem.returnType?: ReturnType` — **optional, on the line**, "defaults to the header returnType when unset" (`:120-121`)
- `RMALineItem.approvedReturnType?: ReturnType` (`:125`) — what the vendor authorized, when it differs from what was asked
- `RMALineSettlement.returnType?: ReturnType` (`:96`) — a third level, per settlement bucket, for a line whose goods sat in more than one invoice state

So: the header carries the return's headline type; a line overrides it; a settlement overrides the line. Three levels, read innermost-first. Values: `Refund/Credit`, `Replacement`, `Return Only` (`rmaReturnTypeRules.ts:17`).

### Lot / serial IDs through save

| | Field | Written at create | Survives save | Survives version revert |
|---|---|---|---|---|
| Serial | `RMALineItem.serialNumbers?: string[]` (`:142`) | Yes — `RMACreationFlow.tsx:283`, and per split draft at `:367` | **Yes** — `addRMAs` JSON-stringifies the whole object into `created-drafts-v2` (`rma-context.tsx:187-200`) | **Yes** — explicitly restored, `rma-context.tsx:407` |
| Lot | `RMALineItem.lots?: RMALotAllocation[]` (`:144`) | **Empty array** — `lots: mode === 'lot' ? [] : undefined` (`RMACreationFlow.tsx:284`) | Shape persists, contents are empty | **No** — the revert mapper has no `lots` key at all (`rma-context.tsx:389-409`) |

**Serial IDs persist end to end. Lot IDs are never captured, and would be dropped by a version revert even if they were.** That is one bug (no lot picker) and one latent bug (revert mapper), not one.

Other line fields worth knowing: `ties?: {grnNumber, qty}[]` — which receipts the credit unwinds; `untied?: boolean` — deliberately tied to nothing, kept distinct from an empty tie list; `settlements?: RMALineSettlement[]`; `approvedQty` kept alongside `returnQty` so the line still says what was asked for.

---

## 5. Create flow, as built

```
Create New RMA
      ▼
CreateInvoiceScreen, 6-step stepper, opening empty
  1. Items and quantity   (key 'lines')      ← opens with an empty search
  2. Serials and lots     (key 'units',      skipped: no tracked line)
  3. Vendor               (key 'vendor',     skipped: goods name their supplier)
  4. Receiving documents  (key 'receivers')
  5. Merge and split      (key 'routing',    skipped: nothing to merge or split)
  6. Credit or refund     (key 'resolution')
      ▼
RMAConfirmModal → addRMAs → detail tab(s)
```

- **No pre-step.** `RMACreationFlow` opens on `'create'` with an empty selection. The mode chooser and both pickers are off the flow; `RMAStartModal`, `ItemSearchModal` and `VendorItemsModal` stay on disk and stay wired to `FlowStep`, but nothing routes to them. The recurring search-and-add loop they existed for is the Items step itself.
- The Start chip is gone from the ribbon. A step nobody stands on and cannot return to was never a step.
- `RmaStepKey` — `CreateInvoiceScreen.tsx:341`. Five keys plus `resolution`; `units`, `vendor` and `routing` are conditional.
- **Items and quantity are one step.** They were two for a day, on the theory that what is coming back and how much of it are separate questions; walking it showed the same rail read twice and two Continues for one job. The step carries the search, the `+`, the remove and a `RailQtyField` on **every** row, so a part is added and its figure typed in the same gesture.
- **Merge and split appears only when it has a question** (`hasGroupingChoice`): two branches of one company that could travel together, or one vendor shipping off more than one of their own docks. Two unrelated vendors is two RMAs whatever anybody says, so it is not a decision and does not get a step. `splitableSites` drops sites belonging to a vendor that has only one, because two vendors with a dock each is not a site question.
- Steps 1–4 all render `ReturnConfigureItems`; the `stage` prop picks the question. Step 1 is the rail on its own (`railOnly`); from step 2 the rail narrows to 460px and the panel beside it answers one question about the focused line.
- **The rail is headed like a form**, `Item (n) … Coming back`, each row with its own shelf, unit picker and ceiling read from `catalogue`.
- **The figure stays editable after step 1.** Every step from 2 on keeps a field on the row in focus. Writes go through `declareFor(sku, qty)` / `rewriteUom(sku, uom)` in `CreateInvoiceScreen`, by part rather than by focus.
- The Items empty state is `ItemSearchModal`'s, ported: `PackageSearch` tile, "Search serialized, lot tracked and non-serialized items", and the line that says the quantity comes next.
- The Vendor step no longer reports the tie count. Its strip says `Vendor chosen`; `N of N tied` belongs to the Receiving documents step and appears only there.
- **Vendor and Receiving documents are separate on screen, not just in the ribbon.** The vendor rows no longer expand into that vendor's receipts; the row states `102 SET shipped in all on 9 documents` and the documents themselves are the next step, where they are also editable. `SerialStages` lost its Vendors / Receiving documents tab strip for the same reason: the step is the view.
- Step 5 renders `ReturnVendorStep`. **Step 6 renders `ReturnResolutionStep` — `STUB_STEPS` is now empty and every step answers something.**
- **Credit or refund (brief 8.1, 8.5–8.8), asked once per RMA.** One RMA is one vendor, so `resolutionTargets` (one per `vendorDraft`, merges already collapsed) gets **one card each**, in the merge and split step's own vendor-card recipe: blue `FileText` tile, name over `N going back · V-0104x`, line-item count on the right. Each card carries how it settles (`Refund or credit` / `Return only`) and why (the `RETURN_REASONS` dropdown with a description, required on `Other`). Continue and the save are held until every card is answered, and the blockers name the vendor. The reason control is ported from `InvoiceReasonDialog.tsx:350-388`.
- Asking once for the whole return wrote one vendor's remedy onto another vendor's credit. `meta.resolutionsByVendor` carries the answers and `invoiceToRMAs` writes each onto its own draft's header and lines; `RMA.notes` takes that vendor's description. Verified: two vendors answered `Return Only / Over-shipped` and `Refund/Credit / Price or terms discrepancy` save as two drafts carrying exactly that.
- **Replacement is out of every picker (8.4).** `RETURN_TYPES` is now `['Refund/Credit', 'Return Only']` and no reason rule offers it. The `ReturnType` union keeps the member because seeded returns still carry it.
- **The two unsafe defaults are gone (8.6).** `Failed inspection` and `Wrong item or variant` have `fallback: null`, so nothing fills the remedy in for the user. `Over-shipped`, `Not ordered` and `Price or terms discrepancy` keep theirs.
- A draft saved with `Other` plus a description comes out `Refund/Credit / Other` on header and line with the note attached.
- `pendingSplit` fires on the way out of Merge and split, which is where the split is decided, and on the way out of the last step when that step is not in the plan, so a return that quietly becomes two is still said out loud once.
- The empty-return blocker holds Continue from the first step but its band waits for a Continue press, so arriving on an empty return is not met with an error.

**Measured walks (15 September, working tree):**

| Scenario | Steps |
|---|---|
| Two counted lines, two unrelated vendors | Items and quantity → Vendor → Receiving documents → Credit or refund → **2 drafts** |
| One serialized line | Items and quantity → Serials and lots → Receiving documents → Credit or refund → **1 draft** |
| One counted line, 60 SET off three Ardmore docks | … → Merge and split → … |
| Two Ardmore branches | … → Merge and split → … |

**Against the eight agreed 11 September:** Start is gone by decision, and Items and Quantity are one step by decision. The rest are present and separate.

**Still open on §8:** 8.2 (collapse `returnType` from three levels to one, removing `RMALineItem.returnType` and `RMALineSettlement.returnType`) and the union half of 8.4 are model surgery across the detail screens, not done. 8.3 is honoured by omission: `approvedReturnType` is untouched.

**Merge and split — all four decided, in one panel.** The step is `ReturnVendorStep`: **RMA vendors** on the left, one **Resolution** card on the right. Nothing else is on it. The receiving documents are the step before's business and are not repeated here.

The Resolution card holds both questions, because they are one decision read twice:

- **Two branches of one company: split, or merge into one.** One decision per company, as `AddressConflictPanel` has it (`create-shipment-wizard.tsx:4070-4300`): a Split tile, and a Merge tile that promotes to a section header with **Choose the branch it is raised against** flowing inside the same tile, listing each branch with what it is taking back. The source picks the merged shipment's destination there rather than in a dialog; a return picks the branch that raises the RMA the same way. `ReturnFamilyMergeModal` is off the flow. `rmaCount` is `vendorDrafts.length`, because `rmaCountFor` counts by assuming a family merges whole.
- **One vendor, more than one of their docks.** Send each site its own shipment, or send it all to one address. `ReturnShippingChoice` (the resolution half of `create-shipment-wizard.tsx:6146`, `StagingConflictPanel`) renders inside the same card, under a rule when there is also a merge to make. Its collapsed-tile-promotes-to-header recipe is the source's.
- **Where it physically ships** is answered on the same control: an address per site when splitting, one nominated address when consolidating.
- **The split into separate RMAs** is stated by the panel's banner, and is forced rather than chosen.

The source's left column, which lists what is staged where, is deliberately dropped: the step already has a left column naming the RMA vendors, and listing the receipts beside it would repeat the previous step on this one.

`returnSites` reads the receipts the credit unwinds rather than the orders, because a site is a property of the receipt. `returnOrigins` still groups by vendor name, which is why the site question had nothing behind it before; it is untouched, and `returnLegs` is built off `returnSites` instead.

Measured: 60 SET of TOOL-DRL-18V tied across four receipts off three Ardmore docks. Splitting saves three legs with real site ids and a per-site address (`V-01042-hq`, `V-01042-atlanta`, `V-01042-newark`); consolidating saves one leg over all three ids with the nominated address, and `returnRouting: 'consolidated'` — which used to be forced to `'origin'` because `isMultiOrigin` counts vendors.

**Still open on §8:** 8.2 (collapse `returnType` from three levels to one, removing `RMALineItem.returnType` and `RMALineSettlement.returnType`) and the union half of 8.4 are model surgery across the detail screens, not done. 8.3 is honoured by omission: `approvedReturnType` is untouched.

**Merge and split — all four decided.** `ReturnVendorStep` answers the two that are about the credit: two branches of one company merging, and the split into separate RMAs that two vendors force. `ReturnSitePanel` (ported from `create-shipment-wizard.tsx:5817`, `StagingConflictPanel`) answers the two that are about the shipping, and appears only when the goods came off more than one site:

- **One vendor, more than one site.** Send each site its own shipment, or send it all to one address. One RMA and one credit either way; it is the shipping that splits.
- **Where it physically ships.** Per site when splitting, or one nominated address when consolidating.

`returnSites` reads the receipts the credit unwinds rather than the orders, because a site is a property of the receipt. `returnOrigins` still groups by vendor name, which is why the site question had nothing behind it before; it is untouched, and `returnLegs` is built off `returnSites` instead.

Measured: 60 SET of TOOL-DRL-18V tied across four receipts off three Ardmore sites. Split saves three legs with real site ids and a per-site address (`V-01042-hq`, `V-01042-atlanta`, `V-01042-newark`); consolidating saves one leg over all three ids with the nominated address, and `returnRouting: 'consolidated'` — which used to be forced to `'origin'` because `isMultiOrigin` counts vendors.

## 6. Known-unfinished (mine, not inferred)

1. **No lot picker.** Lot lines get a vendor and a quantity, never lot IDs. `lots: []` at `RMACreationFlow.tsx:284`.
2. **Version revert drops lots.** `rma-context.tsx:389-409` restores `serialNumbers`, never `lots`.
3. **Site / origin choice is asked but never acted on.** The site strip is back, inside "Where it goes back", and appears only when the vendor shipped off more than one site. It writes `siteMerge`; the save still does not split on it.
4. **"Send elsewhere"** — the brief's third location option — does not exist. `grep "Send elsewhere" src` → nothing.
5. **"Add a new vendor" opens a blank tab.** Waiting on a partner-creation screen.
6. **The by-vendor route is off the flow entirely.** Removing the pre-step took the mode chooser with it, so `VendorItemsModal` is unreachable, and with it `lockedVendor` / `lockedVendorName` and every branch that reads them. Its parts grid was already unreachable behind `onPickVendorOnly`. It needs a home in the flow, or deleting.
7. **`LineItemAttachmentsModal` has no importers.** Dead file.
8. **Previous-design components still compile.** ~11 components + two `STEP1` branches that can never render. They inflate the bundle and confuse a grep.
9. **347 TS errors** at baseline, untouched.
10. **Ship to vendor / Close return are SIMULATED** by design, not by omission — but they are the two places the prototype stops being the product.

---

## 7. Rules the code enforces

The `R01`–`R12` IDs are not in the repo, so I cannot tick them off. Below is every
behavioural rule the code actually enforces, with where it lives — map your R-numbers
onto this and the gaps will be obvious in one pass.

| Rule as built | File |
|---|---|
| One RMA settles against one vendor; a return spanning vendors fans out into several drafts | `CreateInvoiceScreen.tsx` (`vendorSplitFor`, save path), `ReturnGroupingPanel.tsx` |
| A serialized unit names its own vendor — read off the receiver, never asked | `rmaVendorResolution.ts:1-16`, `ReturnConfigureItems.tsx` (`SerialStages`) |
| Counted stock has no provenance, so the vendor is a bounded choice: only vendors who shipped that part | `rmaVendorResolution.ts`, `ReturnConfigureItems.tsx` (`CountedStages`) |
| A vendor cannot take back more than they shipped; over-ask is said out loud while typing, not at save | `rmaVendorResolution.ts:10-15`, `QtyUomField.tsx` |
| Return quantity is capped at received quantity | `mockRMAs.ts:107-110`, `ItemSelectRow.tsx`, `QtyUomField.tsx` |
| Max 5 vendors per serialized line; the 5 with the most units win, the rest come off with a toast | `CreateInvoiceScreen.tsx:2651`, `:3651` (`capVendors`), `:10006` |
| Reason narrows return type; invoice state narrows it further; on conflict the reason wins and an accrual warning shows | `rmaReturnTypeRules.ts:1-11` |
| Nothing can be credited until something has been billed | `rmaReturnTypeRules.ts`, `receiptInvoiceStatus.ts` |
| A line may be tied to nothing on purpose — a floating credit — and that is distinct from "not asked" | `mockRMAs.ts:126-136` |
| Merge/split only exists where two candidates share a `familyCode` | `ReturnFamilyMergeModal.tsx`, `ReturnConfigureItems.tsx` (sibling ranking) |
| A line with no quantity cannot advance; step 1 says why | `CreateInvoiceScreen.tsx:4365` (`canAdvance`), `:4379` (`blockReason`) |
| Serial count must equal line quantity before the return leaves step 1 | `CreateInvoiceScreen.tsx:4323` (`serialConflicts`) |
| Lines are editable only while Draft; every edit is kept as a version | `rma-context.tsx:150-152`, `RMAEditGate.tsx` |
| Approval is a status move on its own; a vendor who cuts a line is recorded by editing lines | `InvoiceDetailScreen.tsx:1265-1273` |
| Returns are never settled on the detail screen (Payments hidden) | `InvoiceDetailScreen.tsx:1944-1950` |
| Pre-settlement statuses have no shipment and nothing posted, so Shipping + GL Impact stay hidden | `InvoiceDetailScreen.tsx:1947-1950` |
| Archiving hides from the working list; the record stays reachable by link | `routes/rma.tsx:29-30` |
