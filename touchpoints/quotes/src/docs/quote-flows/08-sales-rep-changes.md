# Sales Rep Change Logic

## Purpose
This flow manages quote ownership and collaboration assignment through one or more sales representatives, with one designated primary rep.

## Primary Source Files
- `src/app/components/quote-details/RightSidebar.tsx`
- `src/app/components/shared/SalesRepSelector.tsx`
- `src/app/components/quote-creation/Step2Configuration.tsx`
- `src/app/components/modals/AssignSalesRepModal.tsx`
- `src/app/utils/versioningEngine.ts`

## Versioning Classification
Sales rep changes are **non-material**.

Relevant field key:
- `assigned_salesperson`

Reasoning:
- changing internal ownership does not change the commercial content of the quote

## Current Detail-Sidebar Flow
### Sidebar state
`RightSidebar` manages:
- `selectedSalesReps: SelectedSalesRep[]`
- `showSalesRepModal`

`SelectedSalesRep` shape:
- `id`
- `name`
- `initials`
- `isPrimary`
- optional `isCurrentUser`
- optional `isCustomerDefault`

### Entry point
1. User clicks sales rep row in **Quote Information** section.
2. Inline overlay opens.
3. Embedded `SalesRepSelector` is rendered in dropdown-only mode.

### Commit behavior
When selection changes:
1. sidebar compares old primary rep vs new primary rep
2. sidebar updates `selectedSalesReps`
3. if primary changed or rep count changed, sidebar calls:
   - `onNonMaterialChange('assigned_salesperson', 'Sales Representative', oldPrimary, newPrimary)`

## SalesRepSelector Functional Rules
### Props
- `availableReps`
- `selectedReps`
- `onSelectedRepsChange`
- `dropdownDirection?`
- `label?`
- `fullWidth?`
- `renderDropdownOnly?`
- `onClose?`

### Supported behaviors
- search reps by name
- select additional reps
- remove non-primary reps
- maintain one primary rep
- prevent removing the last rep
- optionally confirm when changing away from customer-default rep

### Primary rep confirmation rule
If new primary differs from customer default:
- confirmation modal offers:
  - apply for this quote only
  - apply for all future quotes

Current implementation note:
- "all future quotes" path only logs intent in frontend comments/console semantics; no persistent backend update is implemented here.

## Quote-Creation Flow Reuse
`Step2Configuration.tsx` also uses `SalesRepSelector` during quote creation.
This means sales rep assignment patterns are intended to be consistent between:
- create quote configuration
- quote detail editing

## Additional Bulk Assignment UI
A separate modal exists:
- `src/app/components/modals/AssignSalesRepModal.tsx`

This appears to support bulk assignment from listing context and uses:
- `isOpen`
- `onClose`
- `onAssign(salesRep: string)`
- `selectedCount`

That modal is simpler and uses single-rep assignment by name rather than multi-select primary/secondary logic.

## Lifecycle Behavior
### Draft / Sent / Confirmed
- allowed as non-material ownership change
- should not force version creation

### Converted / Cancelled / Archived / Expired
- detail page becomes read-only, so edit access should be blocked by parent state

## Requirements Summary
- Must support multi-rep assignment.
- Must maintain exactly one primary sales rep.
- Must prevent invalid empty assignment state.
- Must classify as non-material via `assigned_salesperson`.
- Must allow consistent behavior across quote creation and quote detail editing.

## Current Implementation Notes
- Sidebar change callback compares primarily the primary rep and selection count.
- Customer-default awareness exists in selector logic.
- Bulk assign modal is a separate UI pattern and does not currently mirror the richer selector semantics.
