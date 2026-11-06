# Quote Versioning Logic

## Purpose

The quote versioning system keeps commercial changes traceable while avoiding unnecessary version bumps for minor edits.

It separates edits into **three change categories**:

- **Material** — changes the commercial meaning of the quote and can trigger or accumulate version changes
- **Non-material** — logged to activity only, without creating a new version
- **Ask user** — requires explicit user confirmation before deciding whether to create a new version

---

## 1. Change Classification

The engine classifies each edited field using `classifyChange(fieldKey)`.

### Material changes

These fields are treated as commercially significant:

- `line_item_add`
- `line_item_delete`
- `line_item_modify`
- `quantity`
- `uom`
- `pricing_line`
- `pricing_quote`
- `unit_price`
- `pricing_rule`
- `adjustment`
- `currency`
- `customer`
- `partner`
- `ship_to`
- `bill_to`
- `expiry_date`
- `due_by_date`
- `payment_terms`

### Non-material changes

These are logged, but do **not** create a new version:

- `assigned_salesperson`
- `payment_method`
- `shipping_carrier`
- `shipping_mode`
- `deal_information`
- `internal_notes`
- `customer_reference`
- `po_number`
- `contact_person`
- `priority`
- `tags`
- `win_probability`
- `description`

### Ask-user changes

These require a user decision:

- `instruction_quote`
- `instruction_item`
- `attachment_quote`
- `attachment_item`

### Default rule

If a field key is not explicitly listed as material or ask-user, it is treated as:

- **`non_material`**

---

## 2. Why a Change Is Material

The implementation also maintains rationale text for material changes.

Examples:

- **Line item add/delete/modify** → changes what is being sold
- **Quantity / UOM** → changes how much is being sold
- **Pricing / unit price / pricing rules / adjustments** → changes the financial commitment
- **Customer / partner** → changes who the deal is with
- **Ship-to / bill-to** → changes delivery or legal billing party
- **Expiry / due-by / payment terms** → changes the terms window or payment obligation timeline

---

## 3. Status-Based Editing Rules

The versioning behavior depends on the current quote lifecycle state.

### Editable statuses

The quote is editable in these statuses:

- `draft`
- `sent`
- `confirmed`

Helper used:

```ts
isEditableStatus(status)
```

### Read-only statuses

These statuses are treated as read-only:

- `converted`
- `cancelled`
- `archived`
- `expired`

### Statuses that require a new draft first

If the quote is currently in one of these states and a material edit is attempted:

- `sent`
- `confirmed`

the system must first create a **new draft version** before allowing the change to continue.

Helper used:

```ts
requiresNewDraftFirst(status)
```

---

## 4. Versioning Behavior by Scenario

### A. Material change while status = Draft

Behavior:

- The change stays within the current draft editing flow
- The system treats it as a material revision event
- The UI can accumulate multiple material changes in the active draft context
- Users receive a material-change toast for feedback

UX signal used:

- `showMaterialChangeAccumulatedToast(fieldLabel, version, changeCount)`

This toast communicates that the quote is still being edited as a draft and the material change has been captured.

### B. Material change while status = Sent or Confirmed

Behavior:

- The user is prompted because the quote is no longer in an unrestricted draft state
- Confirming the action creates **V + 1** as a new draft
- For a **post-sending** material change, this auto-version trigger is mandatory: the sent version remains locked as historical record, and the edit is moved into the newly created draft version
- Editing then continues on the new draft instead of modifying the sent/confirmed version directly

UX pieces used:

- `AutoVersionConfirmModal`
- `AutoVersionOverlay`
- `showAutoVersionCreatedToast(newVersion, fromStatus, triggerField)`

This preserves the historical record of the sent/confirmed version while allowing post-send revisions safely.

### Explicit post-sending auto-version rule

When a quote is already **Sent** and a user makes any **material** change:

- the system must **auto-trigger version creation**
- the existing sent version is preserved unchanged
- a new draft version is created immediately after user confirmation
- the requested material edit is then applied to that new draft

In short: **material change after sending = create a new draft version first, then apply the change**.

### C. Non-material change

Behavior:

- No version bump
- Change is logged to the activity trail only
- A lightweight toast confirms that the edit was recorded

UX signal used:

- `showNonMaterialChangeToast(fieldLabel)`

### D. Ask-user change

Behavior:

- The system does not decide automatically
- The user is explicitly asked whether to create a new version or continue without one

Related UI pattern:

- `VersionChangePromptModal`

This is typically used for instructions and attachments, where business expectations may vary.

---

## 5. User-Facing Version Feedback

The UI exposes several feedback patterns around versioning:

### Version badge

`VersionBadge` shows the current version number visually in listing/details surfaces.

### Version dropdown / history

The details experience maintains a version dropdown and version history flow to:

- view older versions
- compare versions
- identify latest vs last approved versions
- create a draft from a prior version during revert/edit-as-draft flows

### Toast summary

The helper below builds a compact summary when multiple changes are involved:

```ts
buildVersionSummary(changes)
```

Rules:

- no changes → `Changes applied`
- one change → returns that field label
- multiple changes → returns `first field + N other change(s)`

---

## 6. Practical Decision Table

| Current status                                     | Change type    | Result                                                  |
| -------------------------------------------------- | -------------- | ------------------------------------------------------- |
| `draft`                                            | `material`     | Material change captured in current draft flow          |
| `draft`                                            | `non_material` | Logged only, no version bump                            |
| `draft`                                            | `ask_user`     | Ask user whether to create a new version                |
| `sent`                                             | `material`     | Prompt user, then create new draft version if confirmed |
| `sent`                                             | `non_material` | Logged only                                             |
| `sent`                                             | `ask_user`     | Ask user                                                |
| `confirmed`                                        | `material`     | Prompt user, then create new draft version if confirmed |
| `confirmed`                                        | `non_material` | Logged only                                             |
| `confirmed`                                        | `ask_user`     | Ask user                                                |
| `converted` / `cancelled` / `archived` / `expired` | any edit       | Read-only flow; direct editing should not proceed       |

---

## 7. Design Intent

The versioning model is built around these principles:

1. **Protect commercial history** — sent/confirmed quotes should remain historically accurate
2. **Avoid noisy versioning** — not every metadata change deserves a new version
3. **Preserve user control where needed** — instructions/attachments may need human judgment
4. **Keep auditability high** — meaningful changes should remain easy to trace over time

---

## 8. Core Source of Truth

Primary implementation pieces currently driving this logic:

- `src/app/utils/versioningEngine.ts`
- `src/app/pages/QuoteDetails.tsx`
- `src/app/components/quote-details/versionToasts.tsx`
- `src/app/components/quote-details/AutoVersionConfirmModal.tsx`
- `src/app/components/quote-details/AutoVersionOverlay.tsx`
- `src/app/components/quote-details/VersionChangePromptModal.tsx`

This document describes the implemented UI/business behavior for quote versioning in the current frontend module.
