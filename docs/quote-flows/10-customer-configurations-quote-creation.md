# Customer Configurations in Quote Creation

## Purpose
This document captures the quote-creation configuration logic that is tied to the selected customer after initial recipient selection, including locations, recipients, shipping/billing addresses, payment terms, payment method, sales reps, dates, and customer-scoped defaults.

## Primary Source Files
- `src/app/components/CreateQuoteModal.tsx`
- `src/app/components/quote-creation/Step1CustomerSelection.tsx`
- `src/app/components/quote-creation/Step2Configuration.tsx`
- `src/app/components/quote-creation/AddressSelectionModal.tsx`
- `src/app/components/quote-creation/LocationSelectionModal.tsx`
- `src/app/components/quote-creation/RecipientsSelectionModal.tsx`
- `src/app/components/quote-creation/PaymentTermsLibrary.tsx`
- `src/app/components/quote-creation/PaymentMethodSelectionModal.tsx`
- `src/app/components/shared/SalesRepSelector.tsx`
- `src/app/components/quote-creation/DateConfigCards.tsx`
- `src/app/components/quote-creation/DateEditModal.tsx`
- `src/app/components/quote-creation/PricingRulesLibrary.tsx`

## Flow Position in Create Quote
The current create-quote modal is effectively a 2-step flow:
1. **Select Recipient**
2. **Add Line Items**

Within step 1, `Step1CustomerSelection` conditionally renders `Step2Configuration` after a customer has been selected.

That means customer configuration is currently a **nested sub-flow inside step 1**, not a separate top-level wizard step.

## Parent Draft Model
Customer configuration writes into `QuoteDraft` from `CreateQuoteModal.tsx`.

Relevant draft fields:
- `customer`
- `primaryPoC`
- `recipients?`
- `configuration.billingAddress`
- `configuration.shippingAddress`
- `configuration.pricingRule`
- `configuration.validUntil`
- `configuration.expiryDate`
- `configuration.tags`
- `configuration.notes`

## High-Level Configuration Surface
After the customer is selected, `Step2Configuration` becomes the customer-scoped configuration surface for:
1. Customer location
2. Selected recipients / primary recipient
3. Billing address
4. Shipping address
5. Payment terms
6. Payment method
7. Sales representatives
8. Request / effective / expiry dates
9. Priority
10. Tags

## Default Initialization Rules
`Step2Configuration` initializes several customer defaults locally through `CUSTOMER_DEFAULTS`:
- `pricingRule: 'Volume Discount - 10%'`
- `paymentTerms: 'NET 30'`
- default billing address object
- default shipping address object

Additional local defaults include:
- selected customer location defaults to `loc1`
- one primary sales rep is preselected
- payment method defaults to `ACH/Direct Deposit`
- priority defaults to `standard`
- tags default to `['Engine Components', 'Hydraulics']`

## Customer Location Configuration
### State
`Step2Configuration` manages:
- `selectedCustomerLocation`
- `showLocationModal`

Location object shape:
- `id`
- `name`
- `address`
- `isDefault`

### Entry point
User clicks **Change** next to the selected customer address block.

### Modal contract
`LocationSelectionModal` props:
- `isOpen`
- `onClose`
- `onSelect(location)`
- `currentLocationId`
- `customerName`
- `locations?`

### Supported behavior
- search by location name or address
- choose one location
- display default location badge
- optional future “Add New Location” placeholder when search has no match

### Commit behavior
On save:
1. modal returns the selected location
2. `Step2Configuration` updates `selectedCustomerLocation`
3. modal closes

### Current limitation
The selected customer location is currently **local UI state** and is not explicitly persisted back into `quoteDraft.configuration`.

## Recipient Configuration
### State
`Step2Configuration` manages:
- `selectedRecipientsData`
- `primaryRecipientId`
- `showRecipientsEditor`

### Initialization rule
If `quoteDraft.recipients` exists:
- recipients are loaded into local state
- primary recipient is determined from `isPrimary`
- fallback is the first recipient if no explicit primary exists

### Modal contract
`RecipientsSelectionModal` props:
- `isOpen`
- `onClose`
- `onSelect(recipients, primaryPoCId, copyToCustomer?)`
- `currentCustomerId`
- `currentCustomerName`
- `selectedRecipients`
- `primaryPoCId`

### Commit behavior
On recipient save:
1. local recipient list is replaced
2. `primaryRecipientId` is updated
3. selected primary recipient is resolved
4. `onUpdate({ primaryPoC })` is called to sync the primary contact into the quote draft
5. modal closes

### Important note
The modal supports a broader recipient payload than what is written back to `QuoteDraft.primaryPoC`; only the primary contact’s `id`, `name`, and `email` are currently synchronized upward here.

## Billing and Shipping Location Configuration
### State
`Step2Configuration` manages:
- `addressModalType: 'billing' | 'shipping' | null`
- `selectedBillingAddress`
- `selectedBillingPartner`
- `selectedShippingAddress`
- `selectedShippingPartner`

### Entry points
User clicks either:
- **Bill to** card
- **Ship to** card

### Modal contract
`AddressSelectionModal` props:
- `isOpen`
- `onClose`
- `onSelect(address, partner, defaultChanged?)`
- `type: 'billing' | 'shipping'`
- `customerName`
- `currentCustomer`
- `currentAddress`

### Supported modal behavior
- search addresses
- partner switching
- choose billing or shipping address
- mark address as primary/default
- optional default-change feedback

### Commit behavior
When an address is selected:
- billing flow updates `selectedBillingAddress` and `selectedBillingPartner`
- shipping flow updates `selectedShippingAddress` and `selectedShippingPartner`

### Current limitation
The selected addresses are currently maintained in local component state and are **not written back** to:
- `quoteDraft.configuration.billingAddress`
- `quoteDraft.configuration.shippingAddress`

## Payment Terms Configuration
### State
`Step2Configuration` manages:
- `selectedPaymentTerms`
- `showPaymentTermsLibrary`

### Modal contract
`PaymentTermsLibrary` props:
- `isOpen`
- `onClose`
- `onSelect(term, saveAsDefault)`
- `currentTermId?`
- `customerName`

### Library capabilities
- search terms
- filter by categories (`NET`, `Prepayment`, `Split`, `Custom`)
- select one term
- choose whether to apply only to this quote or save as the customer default

### Commit behavior
`handlePaymentTermsSelect(term, saveAsDefault)`:
1. updates local `selectedPaymentTerms`
2. logs “save as default” intent when chosen

### Current limitation
The selected payment term is shown in the UI, but it is not currently written back into `quoteDraft.configuration`.

## Payment Method Configuration
### State
`Step2Configuration` manages:
- `selectedPaymentMethod`
- `showPaymentMethodDropdown`

### Modal contract
`PaymentMethodSelectionModal` props:
- `isOpen`
- `onClose`
- `onSelect(method, saveAsDefault)`
- `currentMethodId?`
- `customerName`

### Supported method data
Each method can include:
- `id`
- `name`
- `icon`
- `description`
- `processingTime`
- `fees?`
- `isDefault?`

### Library behavior
- search methods
- select one method
- optionally save as customer default

### Commit behavior
The modal returns the chosen method and default-selection flag.

In `Step2Configuration`, the modal currently passes `setSelectedPaymentMethod` directly as the `onSelect` handler.

### Important implementation gap
`PaymentMethodSelectionModal` returns two arguments:
- `method`
- `saveAsDefault`

But `setSelectedPaymentMethod` consumes only the first value. As a result:
- selected method updates locally
- `saveAsDefault` intent is ignored at this level
- the chosen method is not written back to `quoteDraft.configuration`

## Sales Representative Configuration
### State
`Step2Configuration` manages:
- `selectedSalesReps`

Initial default:
- one primary rep is preselected

### Component contract
`SalesRepSelector` props used here:
- `availableReps`
- `selectedReps`
- `onSelectedRepsChange`
- `dropdownDirection="up"`

### Supported rules
- multi-select reps
- maintain one primary rep
- support customer-default awareness
- prevent invalid empty selection behavior within selector logic
- support consistent primary/secondary assignment model shared with quote details

### Current limitation
Selected sales reps are currently local to `Step2Configuration` and are not synchronized into `QuoteDraft` fields.

## Pricing Rules Configuration
### Imported but not currently wired
`Step2Configuration` imports `PricingRulesLibrary`, and `CUSTOMER_DEFAULTS` includes a `pricingRule` value.

However, the current quote-creation configuration UI shown in `Step2Configuration` does **not** open or commit a pricing-rule selection flow.

### Current state of implementation
- pricing-rule concept exists in defaults
- pricing-rule library component exists separately
- no visible pricing-rule trigger is wired in the reviewed `Step2Configuration` flow
- no `onApply` integration is present in the current customer-configuration surface

### Requirement implication
If pricing rules are intended to be part of customer configuration during quote creation, a dedicated entry point and draft synchronization contract still need to be implemented.

## Date Configuration
### State
`Step2Configuration` manages:
- `requestDateType`
- `validUntilType`
- `expiryType`
- `hasExpiry`
- `effectiveWhenSent`
- relative day/unit state for request, effective, and expiry
- `editingDateCard`

### UI surface
Date controls are presented through `DateConfigCards` and edited through `DateEditModal`.

### Editable domains
- request date
- effective date
- expiry date

### Commit behavior
When `DateEditModal` saves:
- request absolute date writes to `quoteDraft.configuration.validUntil`
- effective absolute date also writes to `quoteDraft.configuration.validUntil`
- expiry absolute date writes to `quoteDraft.configuration.expiryDate`
- relative-mode values are kept in local state only
- `whenSent` and `hasExpiry` toggles are also local-state driven

### Important implementation note
`request` and `effective` currently share `configuration.validUntil` as the persisted absolute-value field, which means the data contract is not yet cleanly separated.

## Priority and Tags Configuration
### State
`Step2Configuration` manages:
- `priority`
- `tags`
- `isEditingPriority`
- `isEditingTags`
- `newTag`

### Behavior
- priority is edited inline through a compact dropdown
- tags are edited inline with add/remove interactions
- max tag count enforced in UI is 5

### Current limitation
Priority and tags are currently local UI state in `Step2Configuration` and are not written back into `quoteDraft.configuration` in the reviewed flow.

## Save-As-Default Semantics Across Customer Configurations
The customer-configuration flow includes multiple “save as default” concepts:

1. **Payment terms**
   - explicit yes/no confirmation path exists
   - currently logs intent only

2. **Payment method**
   - checkbox exists in modal
   - returned to parent modal callback
   - ignored by current `Step2Configuration` handler wiring

3. **Addresses**
   - modal supports changing default/primary address
   - default-change signal is passed as optional callback argument
   - current parent flow only updates local selected address/partner state

4. **Sales reps**
   - selector includes customer-default awareness for primary assignment
   - no persistent customer-default update is implemented here

## Requirements Summary
- Customer configuration must start only after customer selection is complete.
- The flow must support customer-specific locations, recipients, billing/shipping addresses, payment terms, payment method, and sales reps.
- One recipient must resolve into `QuoteDraft.primaryPoC`.
- One sales rep must remain primary.
- Address and payment selection flows should support customer-default semantics.
- Date configuration must support absolute, relative, send-triggered, and no-expiry modes.
- Pricing-rule support exists conceptually but is not fully wired into the reviewed create-quote customer configuration flow.

## Current Implementation Gaps
1. Several customer-configuration choices remain component-local and are not fully synchronized to `QuoteDraft`.
2. Pricing rules are imported conceptually but not surfaced as an active configuration control here.
3. Payment method default-save intent is dropped because the handler signature is not preserved.
4. Address selection updates visual state but not the persisted quote draft configuration fields.
5. Priority, tags, sales reps, and customer location are currently local UI concerns rather than draft-backed configuration fields in this flow.
6. Request and effective absolute dates currently share the same persisted `validUntil` field.

## Recommended Documentation Interpretation
For now, treat `Step2Configuration` as a **hybrid configuration layer**:
- partly draft-backed
- partly local-state only
- designed to model future customer-default behavior even where persistence is not yet complete

This distinction is important when using the screen as a source of truth for downstream versioning, quote persistence, or backend implementation.