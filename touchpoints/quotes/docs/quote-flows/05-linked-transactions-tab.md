# Linked Transactions Tab Logic

## Purpose
The **Linked Transactions** tab exposes downstream commercial and fulfillment records associated with a quote.

## Primary Source Files
- `src/app/components/quote-details/TransactionsTab.tsx`
- `src/app/pages/QuoteDetails.tsx`

## Tab Mapping
In `QuoteDetails.tsx`:
- tab key: `transactions`
- visible label: **Linked Transactions**
- renderer: `TransactionsTab`

## Scope of Records
Supported transaction types:
- `sales-order`
- `invoice`
- `payment`
- `delivery`
- `return`
- `credit-memo`

## Data Model
`LinkedTransaction`
- `id`
- `type`
- `number`
- `title`
- `status`
- `createdDate`
- optional `dueDate`
- `total`
- `lineItemCount`
- `assignee`
- `assigneeInitials`
- optional `notes`
- optional `parentId`
- optional `parentNumber`

## Status Model
Supported statuses:
- `draft`
- `confirmed`
- `in-progress`
- `completed`
- `cancelled`
- `partial`
- `overdue`
- `pending`

## Functional Areas
The tab currently supports:
1. Search by transaction content
2. Quick type filtering
3. Advanced filter panel
4. Grouping by transaction type
5. Collapsible per-type sections
6. Summary display through grouped tables
7. Row click / open behavior with informational toast

## Filters
### Quick filter
- all transaction types or one selected `TransactionType`

### Advanced filters
- multiple statuses
- assignee
- date range

Date range options:
- `any`
- `today`
- `this-week`
- `this-month`
- `older`

## Parent Parameters
`TransactionsTabProps`
- `quoteNumber?: string`
- `customerName?: string`
- `readOnly?: boolean`

## Rendering Behavior
Transactions are:
- filtered by search/type/advanced filters
- grouped by `type`
- rendered in collapsible sections
- displayed with status badges, dates, amount, assignee, and parent linkage where applicable

## Commercial Relationship Model
The tab implies quote-to-transaction relationships such as:
- quote -> sales order
- sales order -> invoice
- invoice -> payment
- sales order -> shipment
- sales order -> credit memo

This is currently represented through:
- `parentId`
- `parentNumber`

## Requirements Summary
- Must aggregate all downstream records tied to the quote lifecycle.
- Must allow users to scan by type and status.
- Must support invoices, payments, deliveries, and credit memos alongside sales orders.
- Must support grouping and collapse for dense enterprise workflows.
- Must be safe in read-only contexts.

## Current State / Limitations
- Uses mock transaction data.
- No create/edit actions are implemented in this tab.
- Row interaction is currently informational, not navigational workflow.
- This tab is the best current source for documenting invoice/payment linkage because dedicated invoicing UI is not yet implemented.
