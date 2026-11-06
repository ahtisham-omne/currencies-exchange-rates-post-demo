# Attachments Tab Logic

## Purpose
The **Attachments** tab manages all non-line-item and line-item linked documents related to a quote.

## Primary Source Files
- `src/app/components/quote-details/LinkedTransactionsTab.tsx`
- `src/app/components/quote-details/PDFPreviewModal.tsx`
- `src/app/components/quote-details/RightSidebar.tsx`
- `src/app/components/quote-details/VersionChangePromptModal.tsx`
- `src/app/components/quote-details/OverviewTab.tsx`
- `src/app/data/quoteStore.ts`
- `src/app/utils/versioningEngine.ts`
- `Quote_Versioning_Logic.md`

## Tab Mapping
In `QuoteDetails.tsx`:
- tab key: `linked_transactions`
- visible label: **Attachments**
- renderer: `LinkedTransactionsTab`

## Categories
Supported document categories:
- `pre-quote`
- `quote-attachment`
- `item-attachment`
- `external-link`
- `sales-order`

## Document Model
`LinkedDocument`
- `id`
- `name`
- `category`
- `type` (`pdf`, `xlsx`, `docx`, `png`, `jpg`, `url`, `csv`)
- optional `size`
- optional `url`
- `uploadedBy`
- `uploadedAt`
- optional `itemRefs[]`
- optional `tags[]`
- `includedInPdf: boolean`

## Shared Pre-Quote Document Integration
Pre-quote documents are synced from `quoteStore.ts` using quote number as store key.

Shared helpers:
- `getPreQuoteDocs(quoteKey)`
- `subscribePreQuoteDocs(quoteKey, listener)`

Source of those documents:
- Deal Information tab RFQ/RFP upload flow

## Parent Parameters
`LinkedTransactionsTabProps`
- `quoteNumber?: string`
- `customerName?: string`
- `readOnly?: boolean`
- `onAskUserChange?: (fieldKey, fieldLabel, changeDescription) => void`

## Versioning Classification
Attachments are treated as **ask-user** changes.

Relevant ask-user field keys:
- `attachment_quote`
- `attachment_item`

Meaning:
- system should not automatically decide whether version bump is required
- user must be prompted

## Core Flows
### 1. Upload quote-level attachment
1. User opens upload modal.
2. Chooses `quote-attachment`.
3. Selects file(s).
4. New `LinkedDocument` objects are created.
5. Docs are inserted into local tab state.
6. Success toast is shown.
7. Parent callback fires:
   - `onAskUserChange('attachment_quote', 'Quote Attachment', 'Uploaded ...')`

### 2. Upload item-level attachment
1. User opens upload modal.
2. Chooses `item-attachment`.
3. Selects file(s).
4. Flow moves to line-item selection step.
5. User selects one or more line items.
6. Files are uploaded with `itemRefs` attached.
7. Success toast shown.
8. Parent callback currently fires through the same quote attachment callback path.

### 3. Add external link
1. User opens link modal.
2. Provides link name and URL.
3. Link is stored as a `LinkedDocument` with category `external-link` and type `url`.
4. Link becomes filterable with all other attachments.

### 4. Toggle PDF visibility
Each document can be toggled for quote/PDF visibility.
- `includedInPdf = true` -> visible in quote package
- `includedInPdf = false` -> hidden from quote package

This directly impacts attachment inclusion semantics in quote output.

### 5. Convert scope
Document scope can be changed:
- item -> quote
- quote -> item

Supporting handlers:
- `handleConvertToQuote(docId)`
- `handleConvertToItem(docId, selectedItems)`

### 6. Delete attachment
1. User opens row context menu.
2. Removes document.
3. Document removed from local state.
4. Success toast shown.

## Filters and Controls
### Search
Matches on:
- document name
- item reference id/label
- uploader name

### Filter pills
Supports:
- `all`
- `pre-quote`
- `quote-attachment`
- `item-attachment`
- `external-link`
- `pdf`
- `image`
- `spreadsheet`

### Advanced filters
- upload date range
- uploader

## PDF / Quote Package Relationship
Attachments tab and quote-output settings are related.

`PDFPreviewModal.tsx` includes an **Attachments** visibility option, and individual attachment rows also support per-document inclusion toggles.

## Requirements Summary
- Must unify pre-quote docs, quote attachments, item attachments, and external links.
- Must support file upload and external-link creation.
- Must support item association for item-level docs.
- Must support per-document PDF/quote inclusion.
- Must route attachment changes through ask-user versioning flow.
- Must sync RFQ/RFP docs from Deal Information.

## Current Implementation Notes
- Tab component name is `LinkedTransactionsTab`, but in UI it serves as the **Attachments** tab.
- Pre-quote documents come from shared store; other documents are local tab state/mock state.
- Upload callback currently emits `attachment_quote` ask-user event for general upload flow.
