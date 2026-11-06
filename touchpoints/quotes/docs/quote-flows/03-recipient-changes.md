# Recipient Change Logic

## Purpose
This flow manages changes to the quote's **primary contact** and recipient/contact set.

## Primary Source Files
- `src/app/components/quote-details/RightSidebar.tsx`
- `src/app/components/quote-creation/RecipientsSelectionModal.tsx`
- `src/app/components/quote-creation/SearchOverlay.tsx`
- `src/app/utils/versioningEngine.ts`

## Functional Scope
Recipient changes include:
- changing the primary point of contact
- changing the selected recipient list
- changing additional contacts shown on the quote

## Current Parent/Child Contract
### Sidebar callback classification
`RightSidebar` sends recipient edits through:
- `onNonMaterialChange('contact_person', 'Contact Person', oldValue, newValue)`

### Classification in versioning engine
- `contact_person` is **non-material**

## Sidebar State
Managed in `RightSidebar`:
- `contactName`
- `pocs`
- `showRecipientsModal`
- `recipientsEditTarget`

## Modal Contract
`RecipientsSelectionModalProps`
- `isOpen: boolean`
- `onClose: () => void`
- `onSelect: (recipients: PoC[], primaryPoCId: string, copyToCustomer?: boolean) => void`
- `currentCustomerId: string`
- `currentCustomerName: string`
- `selectedRecipients?: PoC[]`
- `primaryPoCId?: string`

## Flow: Change Recipient(s)
1. User clicks the contact/recipient block in sidebar.
2. Sidebar sets:
   - `recipientsEditTarget`
   - `showRecipientsModal = true`
3. `RecipientsSelectionModal` opens.
4. User can:
   - browse customer/location hierarchy
   - search contacts
   - select multiple recipients
   - set one recipient as primary
   - trigger copy-contact confirmation in certain cross-customer scenarios
5. Modal returns selected recipients and `primaryPoCId`.
6. Sidebar resolves primary recipient.
7. Sidebar updates:
   - `contactName`
   - `pocs`
8. Success toast shown.
9. Parent callback fires as non-material:
   - `onNonMaterialChange('contact_person', 'Contact Person', oldContact, newPrimary)`

## Recipient Data Shape
Returned recipient entries include fields such as:
- `id`
- `name`
- `email`
- `phone`
- `role`
- `department`
- `initials`
- `avatarColor`

Sidebar maps these into simplified PoC display objects.

## Business Meaning
Changing recipients changes who receives/represents the quote, but does **not** change the commercial terms of the deal.
Therefore it is non-material in current rules.

## Lifecycle Behavior
### Draft
- apply directly
- log as non-material

### Sent / Confirmed
- allowed as non-material metadata edit
- no forced new version in current rule set

### Converted / Cancelled / Archived / Expired
- editing must be blocked by read-only state

## Requirements Summary
- Must support multi-recipient selection.
- Must allow one recipient to be primary.
- Must update sidebar display immediately.
- Must classify as non-material using `contact_person`.
- Must not auto-version under current implemented rules.

## Current Implementation Notes
- Sidebar currently passes hardcoded `currentCustomerId="cust1"` into recipient modal in quote details.
- The modal itself supports much richer customer/location recipient selection than the sidebar currently persists.
- Recipient changes can also be indirectly driven through customer-change/search flows.
