# Timeline Flows and Logic

## Purpose
The **Timeline** area is the quote-level scheduling and milestone surface for lifecycle dates, operational planning, and status-driven milestone visibility.

## Primary Source Files
- `src/app/components/quote-details/RightSidebar.tsx`
- `src/app/components/quote-creation/DateEditModal.tsx`
- `src/app/components/quote-creation/DateConfigCards.tsx`
- `src/app/pages/QuoteDetails.tsx`
- `src/app/utils/versioningEngine.ts`
- `Quote_Versioning_Logic.md`

## Surface Mapping
In quote details, **Timeline** is rendered inside the right sidebar through `RightSidebar`.

The sidebar builds timeline rows from quote state and date props, then opens `DateEditModal` for editable entries.

## Functional Scope
The timeline currently owns or displays:
1. Created date
2. Request date
3. Respond-by date
4. Effective date
5. Expiry date
6. Sent-on milestone
7. Confirmed-on milestone
8. Converted-on milestone
9. Ship-by date
10. Delivery date

## Parent Inputs
`RightSidebar` receives timeline-related inputs from the quote details page:
- `createdDate?`
- `expiryDate?`
- `quoteStatus?`
- `readOnly?`
- `onMaterialChange?`
- `onNonMaterialChange?`
- `onAskUserChange?`

These are combined with internal state to determine what is shown, what is editable, and what change category applies.

## Timeline State Model
### Display state
`RightSidebar` constructs a date-entry list representing the timeline rows shown to the user.

Each entry is described by:
- `key`
- `label`
- `value`
- `color`
- `dotColor`
- `dotFill?`
- `editable?`

### Editable date keys
Timeline date editing uses the internal union:
- `created`
- `request`
- `respond`
- `effective`
- `expiry`
- `sentOn`
- `confirmedOn`
- `convertedOn`
- `shipBy`
- `delivery`

### Modal state
When a user clicks an editable row, `RightSidebar` opens `DateEditModal` and passes a per-date configuration object.

## Date Edit Modal Contract
`DateEditModal` supports four configured edit types:
- `request`
- `respond`
- `effective`
- `expiry`

### Modal props
- `type`
- `isOpen`
- `onClose`
- `onSave`
- `initialConfig`

### Save payload
The modal returns a normalized config payload shaped as:
- `dateType`
- `absoluteValue`
- `relativeValue`
- `relativeUnit`
- `whenSent`
- `hasExpiry`

This allows the sidebar to support both absolute dates and relative date logic.

## Date Configuration Logic
### Request / Respond dates
These support:
- absolute date selection
- time selection
- formatted string persistence in modal output

### Effective date
The effective date supports:
- absolute date
- relative date offset
- `whenSent` behavior

If `whenSent` is enabled, the effective date is treated as tied to the send event instead of a standalone fixed calendar date.

### Expiry date
The expiry date supports:
- absolute date
- relative date offset
- `hasExpiry` toggle

If `hasExpiry` is disabled, the quote is treated as having no expiry window.

## Timeline Display Formatting
`DateConfigCards` provides the display formatting model reused conceptually across date surfaces.

### Formatting behaviors
- Missing request date falls back to a today-style display.
- Relative dates render as readable offsets such as `N days/weeks before/after today`.
- Effective dates can display as send-triggered rather than calendar-fixed.
- Expiry can display disabled/no-expiry behavior.

## Status-Driven Milestone Visibility
The timeline is not just an editable date list; it also reflects lifecycle progression.

### Lifecycle-sensitive rows
Depending on `quoteStatus`, the sidebar can expose milestone rows such as:
- Sent On
- Confirmed On
- Converted On

These rows are derived from quote lifecycle state and should align with the status stepper and transition flow managed by `QuoteDetails.tsx`.

### Expected behavior by status
- **Draft**: planning dates are primary; sent/confirmed/converted milestones are not yet active.
- **Sent**: sent milestone becomes relevant and historical.
- **Confirmed**: confirmation milestone becomes relevant.
- **Converted**: conversion milestone becomes relevant.
- **Cancelled / Archived / Expired**: timeline remains viewable but direct editability should follow read-only rules.

## Versioning Classification
Timeline fields split across material and non-material change categories depending on the field being edited.

### Material timeline fields
From `versioningEngine.ts`, these are material:
- `expiry_date`
- `due_by_date`

Rationale:
- They change the guarantee window for pricing and terms.

### Non-material timeline-adjacent edits
Any timeline-related value not explicitly classified as material or ask-user defaults to:
- `non_material`

This means operational scheduling edits outside the explicit commercial-term list are logged without creating a new version.

## Post-Sending Material Change Rule
If a user edits a material timeline field after the quote has already been **Sent**, the system must not modify the sent version directly.

Required behavior:
1. Detect the field as material.
2. Detect current quote status as `sent`.
3. Prompt for auto-version creation.
4. Create a new draft version.
5. Apply the requested timeline edit to the new draft only.

This preserves the original sent quote as the historical record.

## Editability Rules
### Editable states
Timeline edits can proceed only when the quote is in an editable lifecycle state.

Per versioning rules:
- `draft`
- `sent`
- `confirmed`

### Read-only states
Direct timeline editing should not proceed when the quote is in:
- `converted`
- `cancelled`
- `archived`
- `expired`

In these states, timeline data should remain viewable but not editable.

### Parent-level read-only gate
`RightSidebar` also receives `readOnly?`, which acts as the UI-level lock for date interactions.

When `readOnly === true`:
- edit affordances should be disabled
- date modal launch should not proceed
- timeline acts as a view-only history and planning surface

## Change Reporting Requirements
Timeline changes should be reported upward through the sidebar callbacks based on classification:
- `onMaterialChange(fieldKey, fieldLabel, oldValue, newValue)`
- `onNonMaterialChange(fieldKey, fieldLabel, oldValue, newValue)`
- `onAskUserChange(fieldKey, fieldLabel, oldValue, newValue)` if a future timeline attachment/instruction pattern is introduced

The parent page is responsible for:
- versioning decisions
- overlays/modals for auto-versioning
- activity logging
- user feedback toasts

## Requirements Summary
- Must show quote lifecycle milestones in chronological form.
- Must support editing of configured date fields through `DateEditModal`.
- Must respect absolute, relative, send-triggered, and no-expiry date logic.
- Must classify expiry/respond-style commercial date changes correctly for versioning.
- Must preserve sent versions when a material date edit occurs post-sending.
- Must remain view-only in read-only lifecycle states.
- Must align with the main quote lifecycle and status transition UX.

## Known Implementation Notes
- Timeline rendering is currently sidebar-owned, not a standalone tab.
- Some milestone rows are lifecycle-derived rather than user-entered fields.
- Date configuration logic is split between sidebar orchestration and `DateEditModal` payload normalization.
- Only some timeline fields are explicitly material in the current versioning engine; unspecified date-related fields default to non-material unless reclassified later.