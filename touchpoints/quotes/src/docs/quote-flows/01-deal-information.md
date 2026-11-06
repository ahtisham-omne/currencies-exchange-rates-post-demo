# Deal Information Logic

## Purpose
The **Deal Information** area is the quote-level metadata surface for non-line-item commercial context, planning inputs, and pre-quote document capture.

## Primary Source Files
- `src/app/components/quote-details/OverviewTab.tsx`
- `src/app/data/quoteStore.ts`
- `src/app/pages/QuoteDetails.tsx`
- `src/app/utils/versioningEngine.ts`
- `Quote_Versioning_Logic.md`

## Tab Mapping
In quote details, **Deal Information** is rendered through `OverviewTab` when:
- `activeTab === 'overview'`

Parent wiring:
- `QuoteDetails.tsx` passes:
  - `quoteNumber`
  - `customerName`
  - `contactName`
  - `readOnly`
  - `tags`
  - `priority`
  - `winProbability`
  - `salesRep`
  - `onNonMaterialChange`

## Functional Scope
The tab currently owns:
1. Win probability
2. RFQ / RFP reference ID
3. RFQ / RFP file upload
4. Tags
5. External notes
6. Internal notes
7. Lead source(s) and details
8. Expected close date
9. Competitive situation
10. Follow-up date
11. Assigned-to owner
12. Next action

## Parameters / Props
`OverviewTabProps`
- `quoteNumber?: string`
- `customerName?: string`
- `contactName?: string`
- `readOnly?: boolean`
- `tags?: string[]`
- `priority?: 'Urgent' | 'Medium' | 'Low'`
- `winProbability?: number`
- `salesRep?: { id: string; name: string; email: string }`
- `onNonMaterialChange?: (fieldKey: string, fieldLabel: string, oldValue?: string, newValue?: string) => void`

## Persistence / State Model
### Local UI state
Most deal-information values are currently component-local state within `OverviewTab`.

### Shared pre-quote document persistence
RFQ/RFP files are shared through module-level store helpers in `quoteStore.ts`:
- `getPreQuoteDocs(quoteKey)`
- `addPreQuoteDoc(quoteKey, doc)`
- `removePreQuoteDoc(quoteKey, docId)`
- `subscribePreQuoteDocs(quoteKey, listener)`

Store key:
- `quoteNumber`

This allows uploaded pre-quote files to appear both in:
- **Deal Information**
- **Attachments tab** (`LinkedTransactionsTab`, category `pre-quote`)

## Versioning Classification
Deal Information is primarily **non-material** unless a field belongs to timeline/material logic elsewhere.

### Explicitly non-material fields from versioning engine
- `deal_information`
- `internal_notes`
- `priority`
- `tags`
- `win_probability`
- `description`
- `assigned_salesperson`

### Callback behavior
The tab reports changes via:
- `onNonMaterialChange(fieldKey, fieldLabel, oldValue, newValue)`

Expected outcome:
- no version bump
- logged to activity
- non-material feedback/toast at parent level

## RFQ / RFP File Flow
### Upload flow
1. User selects one or multiple files.
2. Each file is converted to `PreQuoteDocument`.
3. File metadata stored:
   - `id`
   - `name`
   - `size`
   - `type`
   - `uploadedBy`
   - `uploadedAt`
4. Each file is added with `addPreQuoteDoc(storeKey, doc)`.
5. Success toast confirms visibility in **Attachments → Pre-Quote Documents**.

### Remove flow
1. User removes file.
2. `removePreQuoteDoc(storeKey, docId)` is called.
3. Subscribers refresh automatically.
4. Removal toast is shown.

## Lead Source Logic
Lead sources are multi-value and each source can carry a detail payload.

### Supported source keys
- `inbound_rfq`
- `trade_show`
- `referral`
- `existing_customer_reorder`
- `cold_outreach`
- `other`

### Behaviors
- Adding a lead source triggers `onNonMaterialChange('lead_source', 'Lead Source', undefined, 'Added: ...')`
- Removing a lead source triggers `onNonMaterialChange('lead_source', 'Lead Source', label, 'Removed')`
- Detail edits update local state

## Read-Only Requirements
When `readOnly === true`:
- editing actions must be disabled
- upload/remove behavior should not proceed
- inputs should behave as view-only data

In practice, read-only is driven by parent quote lifecycle state.

## Requirements Summary
- Must support quote-level metadata editing without version bump.
- Must share RFQ/RFP uploads with the Attachments tab.
- Must preserve quote-scoped separation using `quoteNumber` as store key.
- Must surface changes upward as non-material edits.
- Must remain accessible in read-only detail states.

## Known Implementation Notes
- Most values are currently session-local and not persisted beyond in-memory UI lifecycle.
- Pre-quote documents are the main shared persisted artifact inside current frontend store logic.
- This tab is the current source of truth for RFQ/RFP uploads shown in Attachments.
