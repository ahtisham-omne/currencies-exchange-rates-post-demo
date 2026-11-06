# Shipping and Billing Location Change Logic

## Purpose
This flow manages **Bill To** and **Ship To** updates from the quote detail sidebar.

## Primary Source Files
- `src/app/components/quote-details/RightSidebar.tsx`
- `src/app/components/quote-creation/AddressSelectionModal.tsx`
- `src/app/utils/versioningEngine.ts`
- `Quote_Versioning_Logic.md`

## Entry Points
In `RightSidebar`, the addresses live under:
- **Customer Information**
- expandable subsection: **Shipping / Billing Locations**

Two editable targets:
- Billing address
- Shipping address

## Parameters / Contracts
### Sidebar callbacks
`RightSidebarProps` includes:
- `onMaterialChange?: (fieldKey: string, fieldLabel: string, oldValue?: string, newValue?: string) => void`

### Address modal props
`AddressSelectionModalProps`
- `isOpen: boolean`
- `onClose: () => void`
- `onSelect: (address, partner, defaultChanged?: boolean) => void`
- `type: 'billing' | 'shipping'`
- `customerName: string`
- `currentCustomer: Partner`
- `currentAddress: Address | null`

### Address payload shape
- `id`
- `label`
- `street`
- `city`
- `state`
- `zip`
- `country`
- `isDefault`
- optional metadata like `pocCount`, `primaryContact`

## Current Sidebar State
The sidebar keeps separate local state for:
- `billingAddress`
- `shippingAddress`
- `addressModalType`

## Flow: Change Billing Address
1. User opens **Shipping / Billing Locations**.
2. User clicks **Bill To** row.
3. `addressModalType` becomes `'billing'`.
4. `AddressSelectionModal` opens.
5. User selects an address.
6. Sidebar updates local `billingAddress` state.
7. Success toast shown.
8. Parent callback fires:
   - `onMaterialChange('bill_to', 'Bill To', oldLabel, newLabel)`

## Flow: Change Shipping Address
1. User clicks **Ship To** row.
2. `addressModalType` becomes `'shipping'`.
3. `AddressSelectionModal` opens.
4. User selects an address.
5. Sidebar updates local `shippingAddress` state.
6. Success toast shown.
7. Parent callback fires:
   - `onMaterialChange('ship_to', 'Ship To', oldLabel, newLabel)`

## Versioning Classification
Both flows are **material changes**.

Material field keys from versioning engine:
- `ship_to`
- `bill_to`

Rationale:
- `ship_to` changes delivery destination
- `bill_to` changes the legal payment party

## Lifecycle / Versioning Rules
### If quote is Draft
- change is applied in current draft context
- material-change flow is logged/accumulated

### If quote is Sent or Confirmed
- material edit must trigger new draft/version flow first
- existing sent/confirmed record should remain unchanged
- edited address belongs in the new draft after confirmation

### If quote is Converted / Cancelled / Archived / Expired
- editing should be read-only and blocked by lifecycle rules

## AddressSelectionModal Behavior
The modal supports:
- searching addresses
- switching partner/customer within modal
- selecting one address
- optionally changing which address is default

### Important current implementation detail
The sidebar currently only applies the returned `address` object.
The returned `partner` and `defaultChanged` values are not used in sidebar business logic beyond the modal contract.

## Requirements Summary
- Address changes must be treated as commercial/material changes.
- Bill To and Ship To must version exactly like other material quote edits.
- Existing sent/confirmed records must be protected from direct mutation.
- UI must distinguish billing vs shipping flow via `addressModalType`.
- Read-only states must prevent editing.

## Related Risks / Edge Cases
- Changing partner inside address modal is possible at modal level, but current sidebar commit logic only updates address fields, not full customer switch behavior.
- Default-address changes are surfaced by modal contract but not persisted in current quote detail logic.
