# Customer Change Logic

## Purpose
This flow governs changing the quote's owning **customer / partner**, including required reset behavior for dependent quote data.

## Primary Source Files
- `src/app/components/quote-details/RightSidebar.tsx`
- `src/app/components/quote-creation/SearchOverlay.tsx`
- `src/app/components/quote-creation/LocationSelectionModal.tsx`
- `src/app/components/quote-creation/Step1CustomerSelection.tsx`
- `src/app/utils/versioningEngine.ts`
- `Quote_Versioning_Logic.md`

## Versioning Classification
Customer change is a **material change**.

Material field key:
- `customer`

Rationale:
- changes who the deal is with

## Sidebar State for Customer Change
`RightSidebar` manages:
- `customerName`
- `showCustomerModal`
- `pendingCustomerSelection`
- `pendingChange`
- dependent states that are reset on confirmation:
  - `contactName`
  - `pocs`
  - `billingAddress`
  - `shippingAddress`
  - `paymentTerms`
  - `paymentMethod`

## Flow Overview
This is a multi-step guarded flow.

### Step 1: Launch customer search
1. User clicks customer row in sidebar.
2. `showCustomerModal = true`.
3. `SearchOverlay` opens in customer/contact search mode.

### Step 2A: Select customer directly
When `onSelectCustomer` fires:
1. Sidebar determines whether selected customer is same as current customer.
2. Sidebar gathers that customer's contacts.
3. Sidebar picks primary contact.
4. Sidebar stores a `pendingCustomerSelection` object containing:
   - `customerId`
   - `customerName`
   - `contactName`
   - `contactId?`
   - `contactInitials?`
   - `contactTitle?`
   - `locations[]`
   - `isSameCustomer`
5. Search overlay closes.

### Step 2B: Select contact from search
When `onSelectContact` fires:
- **If same customer**:
  - updates primary contact only
  - no full customer reset
- **If different customer**:
  - builds `pendingCustomerSelection`
  - routes into location selection before final confirmation

### Step 3: Select location
If `pendingCustomerSelection` exists, `LocationSelectionModal` opens.

User chooses location:
- If same customer: treated as location-only update
- If different customer: sidebar creates `pendingChange`

`pendingChange` contains:
- `newCustomerName`
- `newLocation`
- `newContactName`
- `isSameCustomer`

### Step 4: Confirm reset
If new customer differs from current customer, a confirmation dialog appears with explicit warning:
- contacts reset
- addresses reset
- payment terms reset
- pricing rules reset

### Step 5: Commit customer change
On confirmation, sidebar:
1. updates `customerName`
2. updates `contactName`
3. rebuilds `pocs`
4. resets billing address to blank/new state
5. resets shipping address to blank/new state
6. resets payment terms to `Net 30`
7. resets payment method to `ACH/Direct Deposit`
8. shows success toast
9. calls:
   - `onMaterialChange('customer', 'Customer / Partner', oldCustomer, newCustomer)`

## Same-Customer vs Different-Customer Rules
### Same customer
- Selecting a new contact can behave like primary-contact change only
- Selecting a location can behave like location-only update
- no full dependency reset required

### Different customer
Must trigger explicit reset confirmation because quote dependencies become invalid.

## Required Reset Domains for Customer Change
Current confirmation copy explicitly states reset of:
- contacts
- addresses
- payment terms
- pricing rules

Implemented hard resets in sidebar currently include:
- primary contact / pocs
- billing address
- shipping address
- payment terms
- payment method

## Lifecycle / Versioning Rules
### Draft
- material change can be applied in draft context

### Sent / Confirmed
- must create new draft/version before applying customer change
- original sent/confirmed record remains immutable

### Converted / Cancelled / Archived / Expired
- read-only; direct editing should not proceed

## Requirements Summary
- Customer change must always be treated as material.
- Cross-customer change must warn about data resets.
- User must choose new location before final commit.
- Same-customer contact changes should not force full reset.
- Sent/confirmed quotes must auto-route through version creation before commit.

## Implementation Notes / Gaps
- The current reset confirmation message mentions pricing rules, but the actual sidebar commit visibly resets contacts, addresses, payment terms, and payment method in local state; pricing-rule reset is communicated but not centrally persisted in a shared quote store here.
- Location-only changes for same customer currently show toast behavior but do not emit a distinct material callback on their own unless address fields are changed separately.
