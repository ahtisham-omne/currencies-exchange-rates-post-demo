# Invoicing Tab Logic and Requirements

## Purpose
This document captures the **current implemented state** and the **functional requirements implied by the quote module** for the Invoicing tab.

## Primary Source Files
- `src/app/pages/QuoteDetails.tsx`
- `src/app/components/quote-details/ComingSoonTab.tsx`
- `src/app/components/quote-details/TransactionsTab.tsx`
- `src/app/components/quote-creation/PaymentTermsLibrary.tsx`
- `src/app/components/quote-details/RightSidebar.tsx`

## Current UI State
In `QuoteDetails.tsx`:
- tab key: `invoicing`
- visible label: **Invoicing**
- current renderer: `ComingSoonTab`

Current placeholder description:
- "Invoice generation, tracking, payment status, and billing history will be available here."

## Current Functional Dependencies Already Present Elsewhere
Although Invoicing is not built as its own tab yet, related logic already exists in adjacent flows.

### 1. Invoice visibility in Linked Transactions
`TransactionsTab.tsx` already models invoice records with:
- transaction type `invoice`
- invoice numbers
- due dates
- totals
- assignees
- parent sales-order references

### 2. Payment terms
Payment terms influence invoicing obligations.
Current quote flows support payment-term selection through:
- `RightSidebar.tsx`
- `PaymentTermsLibrary.tsx`

Payment terms are currently a **material** quote field:
- field key: `payment_terms`

### 3. Payment method
Payment method affects collection mechanics.
Current selection exists in sidebar and is treated as **non-material**:
- field key: `payment_method`

## Implied Invoicing Scope
Based on current placeholder, transaction data, and payment-term flows, the Invoicing tab is expected to eventually cover:
1. invoice generation
2. invoice listing/history
3. invoice status tracking
4. due-date visibility
5. payment status visibility
6. billing history
7. relation to payment terms and quote/bill-to context

## Likely Data Requirements
A future invoicing tab would minimally need invoice records with:
- invoice number
- linked quote / linked SO
- issue date
- due date
- status
- total amount
- paid amount / outstanding amount
- assignee / owner
- payment receipts / adjustments / credit memos
- billing address context
- payment terms context

## Quote Dependencies Relevant to Invoicing
Invoicing must stay aligned with:
- `Bill To` changes
- customer changes
- payment terms changes
- payment method changes
- downstream transactions (payments, credit memos)

## Lifecycle Expectations
### Before conversion / operational downstream creation
- invoice history may be empty
- tab should still show empty-state guidance

### After downstream transaction creation
- invoices should appear as related commercial records
- should cross-reference sales orders and payments

## Versioning Relevance
The Invoicing tab itself is not yet implemented, but related upstream fields are already classified:
- `payment_terms` -> material
- `payment_method` -> non-material
- `bill_to` -> material
- `customer` -> material

These upstream quote edits can materially affect future invoice correctness.

## Requirements Summary
- Must eventually replace placeholder with real invoice management surface.
- Must integrate with linked transaction data already modeled in `TransactionsTab`.
- Must surface invoice creation, status, due dates, and payment linkage.
- Must respect upstream quote decisions around billing party, payment terms, and customer.
- Must remain consistent with quote lifecycle and read-only rules.

## Current Gap Statement
At present, the Invoicing tab is a placeholder only. Operational invoice logic is represented indirectly through:
- linked transaction mock data
- payment terms selection
- bill-to configuration
- payment method selection
