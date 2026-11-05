

## Implementation Plan: Auto-Version Creation on Post-Draft Edits

This plan was previously approved. The user confirmed one additional requirement: sidebar field edits (payment terms, shipping carrier, delivery dates, notes, inbound location) must also go through the `guardEdit` wrapper. All 6 corrections are included.

### File 1: `src/app/components/poStore.ts`

**A. Expand `POVersionSnapshot`** (lines 102-115) — add fields:
- `vendor?: POVendor`
- `recipient?: PORecipient`
- `secondaryContactNames?: string[]`
- `orderDate?: string`
- `confirmationDate?: string | null`
- `sentDate?: string | null`

**B. Add `changeTags` to `POVersionEntry`** (line 127) — `changeTags?: string[]`

**C. Expand `buildVersionSnapshot()`** (lines 275-303) — populate the new fields from the PO data (vendor clone, recipient clone, secondaryContactNames copy, orderDate, confirmationDate, sentDate).

**D. Update `recordPOVersion()`** (lines 374-418) — accept optional `changeTags?: string[]` in the payload, store it on the version entry.

**E. Add `restorePOFromSnapshot()`** — new export function that restores ALL PO fields from a snapshot:
- `vendor`, `recipient`, `secondaryContactNames`, `payment`, `deliveryDate`, `notes`, `orderDate`, `confirmationDate`, `sentDate`, `shippingFee`
- Rebuild `lineItems` from snapshot (restoring images/categories from current PO line items by itemNumber)
- Recalculate `subtotal`, `discountTotal`, `total`
- Call `notify()`

### File 2: `src/app/components/POSidebarSections.tsx`

Rename `isDraft` prop to `canEdit` in `VendorInfoCard` — prop definition + all 8 usage sites. Pure mechanical rename, no logic change.

### File 3: `src/app/components/PurchaseOrderDraft.tsx`

**A. Fix `isFullyReadOnly`** (line 2194):
- Change from `isFullyReceived || isCancelled` to just `isCancelled`

**B. New state variables** (near line 2047):
```typescript
const [editingSession, setEditingSession] = useState<{
  confirmed: boolean;
  changeTags: Set<string>;
  changeCount: number;
  snapshot: POVersionSnapshot;
} | null>(null);
const [showVersionConfirmModal, setShowVersionConfirmModal] = useState(false);
const [pendingEditAction, setPendingEditAction] = useState<{ action: () => void; tag?: string } | null>(null);
```

**C. Derived `canEdit`**:
```typescript
const canEdit = isDraft || (editingSession?.confirmed === true);
```

**D. `guardEdit` wrapper function**:
```typescript
const guardEdit = (action: () => void, tag?: string) => {
  if (isDraft) { action(); return; }
  if (isCancelled) return; // fully read-only
  if (editingSession?.confirmed) {
    action();
    if (tag) {
      setEditingSession(prev => prev ? {
        ...prev,
        changeTags: new Set(prev.changeTags).add(tag),
        changeCount: prev.changeCount + 1
      } : prev);
    }
    return;
  }
  // First edit in post-Draft — show confirmation modal
  setPendingEditAction({ action, tag });
  setShowVersionConfirmModal(true);
};
```

**E. Replace `isDraft` gates with `canEdit`**:
- Line 1112: `isDraft &&` for Add Items button → `canEdit &&`
- Line 1238: `isDraft ?` for QTY input → `canEdit ?`
- Line 1279: `isDraft ?` for Price input → `canEdit ?`
- Line 1356: `isDraft &&` for edit/remove action buttons → `canEdit &&`
- Line 1390: `isDraft &&` for empty state → `canEdit &&`
- Line 2839: VendorInfoCard `isDraft={isDraft}` → `canEdit={canEdit}`
- Line 3245, 3256, 3271: Attachments `isDraft` → `canEdit`

**F. Wrap all edit callbacks with `guardEdit`**:
- Line items panel callbacks:
  - `onRemoveItem`: `guardEdit(() => removeLineItemFromPO(po.id, liId), "Item Removed")`
  - `onAddItems`: `guardEdit(() => setAddItemsOpen(true), "Item Added")`
  - `onUpdateQty`: `guardEdit(() => updateLineItem(po.id, li.id, { vendorQty, quantity }), "Qty Change")`
  - `onUpdatePrice`: `guardEdit(() => updateLineItem(po.id, li.id, { unitPrice, discount: 0 }), "Price Change")`
- **Sidebar edits (the user's additional requirement)**:
  - `onEditContact` → `guardEdit(() => setVendorContactOpen(true), "Contact Change")`
  - `onEditPayTo` → `guardEdit(() => setPayToDialogOpen(true), "Billing Change")`
  - `onEditShipTo` → `guardEdit(() => setShipToDialogOpen(true), "Shipping Change")`
  - `onEditFundedBy` → `guardEdit(() => setFundedByDialogOpen(true), "Funding Change")`
  - `onEditPaymentTerms` → `guardEdit(() => setPaymentEditOpen(true), "Payment Terms Change")`
  - `onEditPaymentMethod` → `guardEdit(() => setPaymentMethodOpen(true), "Payment Method Change")`
  - Delivery date edit button → `guardEdit(() => { setDeliveryDateDraft(po.deliveryDate); setDeliveryDateModalOpen(true); }, "Date Change")`

**G. Unlock dialogs for all states** (not just Draft):
- Remove the `{isDraft && (...)}` conditional wrappers around:
  - `ItemsCatalogueModal` (line 3304)
  - `ChangeVendorContactDialog` (line 3486)
  - `PaymentTermsDialog` (line 3498)
  - `PaymentMethodDialog` (line 3510)
  - `AddAttachmentDialog` (line 3522)
  - `VendorSelectionDialog` for Pay To, Ship To, Funded By (lines 3531, 3545, 3559)
- These dialogs render unconditionally; edit buttons are gated by `canEdit` via `guardEdit`.

**H. Version Confirm Modal** (new JSX, added before closing `</div>`):
- Dialog with amber AlertTriangle icon
- Title: "This will create a new version"
- Body: "You are editing PO {poNumber} which is currently in {status} state. This change will be saved as Version {currentVersion + 1}."
- Status badge showing current state
- "Continue & Create Version" primary button → snapshots PO via `buildVersionSnapshot`, sets `editingSession.confirmed = true`, replays `pendingEditAction`
- "Cancel" outline button → clears pending action

**I. Editing Mode Banner** (inserted above LineItemsPanel, after tab content starts):
- Visible when `editingSession?.confirmed === true`
- Amber/blue subtle bar: "Editing Version {X+1} — {changeCount} change(s) made"
- Shows change tag pills
- "Save Version" primary button on right
- "Discard Changes" ghost button

**J. Save Version handler**:
- Auto-generate summary from changeTags: e.g. "Qty Change, Item Added, Price Change"
- Call `recordPOVersion(po.id, { reason: summary, changes: session.changes, changeTags: [...session.changeTags] })`
- Clear `editingSession` → returns to read-only
- Toast: "Version {N} created successfully"
- Header badge + Versions tab count update automatically via store subscription

**K. Discard Changes handler**:
- Call `restorePOFromSnapshot(po.id, session.snapshot)`
- Clear `editingSession`
- Toast: "Changes discarded"

### File 4: `src/app/components/POVersionHistoryTab.tsx`

Display `changeTags` from each version entry as small colored badge pills next to the version reason/summary. Each tag gets a subtle colored pill (using existing change type color scheme).

### What Does NOT Change
- Draft state behavior (free editing, no modals)
- Version comparison side-by-side view
- Version list in Versions tab (aside from new tag badges)
- Combo button state transitions
- POVersionDropdown component

### Files Modified
| File | Change |
|---|---|
| `src/app/components/poStore.ts` | Expand snapshot, add `restorePOFromSnapshot`, add `changeTags` |
| `src/app/components/PurchaseOrderDraft.tsx` | Editing session, guardEdit, confirm modal, banner, save/discard, unlock editing in all states, sidebar edits through guardEdit |
| `src/app/components/POSidebarSections.tsx` | Rename `isDraft` → `canEdit` |
| `src/app/components/POVersionHistoryTab.tsx` | Display change type tag badges |

