

## Sales Order Creation Modal — Fix & Complete Plan

### Summary
Wire up all broken/non-functional interactive elements in `CreateSOModal.tsx` and `CreateSOStep2.tsx` by copying working components from the [Quotes Detail V6.5](/projects/5b89ae36-82cc-4a10-945c-db645266b53d) project and adapting them for the SO context. Also fix ATP tooltip styling, disable repeat-click-to-add behavior, and add duplicate modal explanatory copy.

---

### Files to Create (copied from Quotes, adapted)

| # | New File | Source (Quotes project) | Adaptation | Scope |
|---|----------|------------------------|------------|-------|
| 1 | `src/app/components/so/AddressSelectionModal.tsx` | `quote-creation/AddressSelectionModal.tsx` (664 lines) | None — self-contained with mock data | Small |
| 2 | `src/app/components/so/PaymentTermsLibrary.tsx` | `quote-creation/PaymentTermsLibrary.tsx` (426 lines) | None | Small |
| 3 | `src/app/components/so/PaymentMethodSelectionModal.tsx` | `quote-creation/PaymentMethodSelectionModal.tsx` (289 lines) | None | Small |
| 4 | `src/app/components/so/RecipientsSelectionModal.tsx` | `quote-creation/RecipientsSelectionModal.tsx` (951 lines) | Map SO's `POC` type (`role` field) to Quote's `PoC` type (`role` + `department` fields). Pass `currentCustomerId` from selected customer. | Medium |
| 5 | `src/app/components/so/SalesRepSelector.tsx` | `shared/SalesRepSelector.tsx` (794 lines) | None — already parameterized | Small |
| 6 | `src/app/components/so/ShippingTermsModal.tsx` | **Build new** | Simple selection modal with FOB Origin, FOB Destination, CIF, EXW, DDP, DAP options. Same visual pattern as PaymentMethodSelectionModal. | Small |

### Files to Edit

#### 1. `src/app/components/so/CreateSOModal.tsx` — **Large edit**

**A) Customer Selection** — Already works via SearchOverlay. No changes needed except ensuring "Change" button reopens search (already wired at line 1033 via `onChangeCustomer`).

**B) PoC / Recipients Selection** — Wire the recipients row (lines 1084-1171):
- Add state: `showRecipientsModal`, `selectedRecipients: POC[]`
- Add `onClick` to the recipients row div to open `RecipientsSelectionModal`
- On customer change (`clearSelection`), also reset `selectedRecipients`
- Render `<RecipientsSelectionModal>` at bottom of portal

**C) Address Selection** — Wire the AddressCard components (lines 1186-1189):
- Add state: `addressModalType: 'billing' | 'shipping' | null`, `selectedBillingAddress`, `selectedShippingAddress`
- Add `onClick` to each `<AddressCard>` to set `addressModalType`
- Render `<AddressSelectionModal>` conditionally
- On customer select, auto-populate billing/shipping from customer address

**D) Payment Terms** — Wire the ConfigRow at line 1193:
- Add state: `showPaymentTerms: boolean`, `selectedPaymentTerms: string`
- Make ConfigRow clickable → opens `PaymentTermsLibrary`
- Auto-populate from customer defaults on selection
- Display selected term name in ConfigRow value

**E) Payment Method** — Wire the ConfigRow at line 1194:
- Add state: `showPaymentMethod: boolean`, `selectedPaymentMethod: string`
- Make ConfigRow clickable → opens `PaymentMethodSelectionModal`

**F) Shipping Terms** — Add new ConfigRow after Payment Method:
- Add state: `showShippingTerms: boolean`, `selectedShippingTerms: string`
- New ConfigRow for "Shipping terms" → opens `ShippingTermsModal`

**G) Sales Rep** — Wire the ConfigRow at line 1195:
- Add state: `selectedReps: SelectedSalesRep[]`
- Replace static ConfigRow with `<SalesRepSelector>` component
- Default to current user ("Yahya Naveed")

**H) Dependency wiring:**
- `handleSelectCustomer` (line 317): after setting customer, also set default payment terms ("Net 30"), default billing/shipping address from customer data, reset recipients
- `clearSelection` (line 332): also reset payment terms, payment method, shipping terms, addresses, sales rep back to defaults

**I) Make ConfigRow accept onClick:**
- Add `onClick?: () => void` prop to `ConfigRow` component (line 1254)
- Wire click handler through

**J) Update SelectedState props** to pass through all new state + handlers for modals

#### 2. `src/app/components/so/CreateSOStep2.tsx` — **Medium edit**

**E) Quantity stepper** — Already working (line 177 `handleUpdateQuantity`, line 738 input). The +/- buttons are via catalog sidebar clicks. Quantity input is functional.

**F) ATP Tooltip restyle** — Edit `src/app/components/so/ATPTooltip.tsx`:
- Change the formula pill background from `var(--secondary)` to a neutral gray: `background: '#F3F4F6'` (or `var(--secondary)` is already gray — check if the header icon circle at line 91-96 uses `var(--primary)` blue background). 
- Change header icon circle (lines 91-96): replace `backgroundColor: 'var(--primary)'` with `backgroundColor: 'var(--secondary)'` and icon color from `var(--primary-foreground)` to `var(--muted-foreground)`.
- This makes the tooltip look informational, not like a blue button.

**G) Disable repeat-click to add** — In `CreateSOStep2.tsx`:
- Line 433-437: Currently when `added` is true, clicking calls `handleAddQuantityToExisting`. Change this to do nothing (return early).
- Line 534-548: The "+1 EA" button on already-added cards — remove or keep as the explicit way to add more? Per spec: "The only way to adjust quantity after add should be the +/− stepper on the line item row." Remove the "+1 EA" button.
- Line 438: Add visual treatment for already-added items — add `opacity-70` or a checkmark overlay instead of making them look fully clickable.

**H) Duplicate modal explanatory copy** — In `CreateSOStep2.tsx` lines 789-809:
- Add a helper paragraph to the `description` array in the `ConfirmationDialog`:
  - Insert before the existing description lines: `"Duplicating creates a new line item copied from the original. Use this when you need a separate entry with different parameters — such as a different requested ship date, handling notes, or delivery instructions — rather than increasing quantity on the existing line."`

#### 3. `src/app/components/so/ATPTooltip.tsx` — **Small edit**
- Restyle header icon from blue circle to neutral gray
- Keep formula pill as `var(--secondary)` (already neutral) — just ensure it doesn't look like a button

---

### Dependency Chain Verification

```text
Customer selected
  ├── Auto-populate billing address (from customer.address)
  ├── Auto-populate shipping address (same as billing by default)
  ├── Auto-populate payment terms ("Net 30" default)
  ├── Auto-select primary PoC as recipient
  └── Filter recipients modal to customer's contacts

Customer changed
  ├── Clear all recipients
  ├── Reset billing/shipping addresses
  ├── Reset payment terms to new customer's default
  └── Re-select new customer's primary PoC
```

All of this logic will live in `handleSelectCustomer` and `clearSelection` within `CreateSOModal.tsx`.

---

### Risk Assessment

- **No shared component conflicts** — all new files go into `src/app/components/so/`
- **Styling**: Copied components use hardcoded hex colors in some places; the SO modal uses CSS variables. Minor visual inconsistency possible but functional. Can harmonize in a follow-up pass.
- **No API calls** — all mock data, no fetch concerns
- **Modal stacking z-index**: New modals (Address, Payment Terms, etc.) use `createPortal` to `document.body` — they'll layer above the CreateSO modal correctly since they set high z-index values

### Estimated Scope
- 6 new files (copy + adapt)
- 3 files edited (CreateSOModal large, CreateSOStep2 medium, ATPTooltip small)
- ~2,500 lines of new code (mostly copied), ~150 lines of edits

