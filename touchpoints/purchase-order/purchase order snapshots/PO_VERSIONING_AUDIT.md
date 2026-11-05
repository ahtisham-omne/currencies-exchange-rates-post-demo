# PO Versioning Audit vs Sales Order — 2026-07-10

Read-only audit. Compares the Sales Order (SO) module's `omne-erp` versioning to the current Purchase Order (PO) module in `Purchase-Order/src/app/components`, then proposes a concrete plan for bringing PO to parity.

---

## Sales Order (reference implementation)

### Data model

- `types/versions.ts:10-87` — dedicated versioning contract, separate from the list-row API.
  - `VersionStatus = 'draft' | 'sent' | 'confirmed'` (line 10)
  - `VersionChangeType` — 9-value union (line 12-21): `line-item-added`, `line-item-removed`, `line-item-modified`, `pricing-changed`, `customer-changed`, `config-changed`, `attachment-added`, `rule-applied`, `adjustment-applied`.
  - `VersionChange` (line 25-38) — carries `type`, `action` (Added/Removed/Changed), `subject`, `subjectDetail`, `detail`, `itemRef`, `timestamp`, `user`, and precomputed `initials`.
  - `VersionSnapshot` (line 49-57) — top-level rollup: `lineItemCount`, `grandTotal`, `rulesCount`, `adjustmentsCount`, pre-formatted `validUntil`, and full `lineItems: VersionLineItem[]`.
  - `QuoteVersion` (line 59-75) — the entry itself: `version` (int), `versionStatus`, three pre-formatted stamps (`createdAt`, `sentAt`, `confirmedAt`), `sentBy`, `initials`, `snapshot`, `changes`, optional `notes`, `isRevert`, `revertedFrom`.
  - `QuoteVersionsResponse` (line 77-81) — wire envelope: `quoteId`, `quoteNumber`, `versions[]`.
  - `RevertQuoteVersionInput` (line 83-87) — `{ quoteId, toVersion, reason? }`.
- List row `types/api.ts:108-174` — the `QuoteListRow.version: number` (line 111) is a single counter on the row. Full history is fetched separately by id.

Comment at top of `types/versions.ts` names both endpoints: `GET /api/v2/quotes/:id/versions` and `POST /api/v2/quotes/:id/versions/revert`.

### Listing table touch points

- `pages/quotes-list/components/cells/QuoteNumberCell.tsx:22-46` — the version pill lives INSIDE the identifier cell, in front of the quote number.
  - Rendered as `<Badge variant="subtle" color="primary" size="xs" rounded={false} showLinkArrow>v{data.version}</Badge>`.
  - `onClick` on the badge calls `context.onViewVersions(data.id)` and `e.stopPropagation()` so it doesn't fire the row's navigation.
  - `aria-label={\`Version ${data.version} history\`}` — a keyboard-accessible click target.
- `pages/quotes-list/components/quoteColumns.tsx:49` — `CellContext.onViewVersions?: (quoteId: string) => void` is threaded through every cell via the ag-grid context, keeping the column defs pure.
- No dedicated version column. The pill sits next to the quote number and is the only listing touch point.

### Detail page touch points

- `pages/quote-detail/QuoteDetailView.tsx:20,30,61,136-137,169-170`:
  - Local state `viewingVersion: number | null` (line 61) — `null` means "on the latest".
  - Passed to a header switcher: `<QuoteVersionDropdown … viewingVersion={viewingVersion} onViewVersion={setViewingVersion} />` (line 130-137).
  - A `versions` tab in the tabs enum (line 30). When active, renders `<VersionsTab quoteId={quote.id} viewingVersion={viewingVersion} />` (line 169-170).
  - `viewingVersion !== null` also gates every OTHER tab to read-only (Items, Deal Info, Attachments, Communications all check it — lines 160, 167, 174, 176). Historical versions are non-editable everywhere.

Header switcher (`pages/quote-detail/components/QuoteVersionDropdown.tsx:34-336`):
- Compact trigger pill: `[icon] V{n} · [status pill: Latest / Last Approved / Viewing / Sent / Confirmed / Draft] · [date]`.
- Popover panel: title "Version History · N versions · Last approved: V{k}", plus a "Back to Latest" button when viewing an old version.
- Each row: status-tinted icon tile, `V{n}`, status badge, `Latest` / `Last Approved` / `Viewing` / `Revert` tags, notes, and a per-row revert `↺` icon-button (only when `!isLatestRow && currentLifecycle !== 'converted'`).
- Revert calls `useRevertQuoteVersion().mutate({ quoteId, toVersion })`, toasts "Reverted to V{n} — a new draft was created," and clears the viewing state.

Deep versions tab (`pages/quote-detail/tabs/versions/*` — 12 files, ~1755 LOC):
- `VersionsTab.tsx:27-193` — top-level orchestrator. Reads `useQuoteVersions(quoteId)`, wires filters, compare mode, revert modal, and expand/collapse state.
- `VersionsToolbar.tsx` — search input + quick-filter chips (`All Changes / Line Items / Pricing & Rules / Customer Info`) + advanced filters popover (status, author, `advancedFilterCount`).
- `versionFilters.ts:14-103` — filter reducers: `search`, `changeFilter` (quick-filter enum), `creator`, `status`. `filterVersions()` narrows each version's change list, keeps versions with matching changes / notes / author, then applies status + creator.
- `VersionRow.tsx:1-237` — collapsible row per version: avatar + version + status + Latest/Last Approved/Revert tags + digest ("N items · rules/adj · $total"). Expands to snapshot + change log.
- `VersionSnapshotPanel.tsx` — line-item snapshot table for the expanded row.
- `VersionChangeList.tsx` — grouped-by-type change entries with author initials, action verb, subject, detail, and timestamp.
- `VersionCompareView.tsx:210` — full-width side-by-side diff of two versions (line items, totals, changes). Triggered from compare mode.
- `VersionRevertModal.tsx:75` — confirmation dialog collecting a `reason` before firing `useRevertQuoteVersion`.

### Create / edit flow

Not explicitly re-audited (`quote-create` was skipped — SO uses an entirely separate module and the version-write path lives in the mock-api).

- `mock-api/quotes/versionsStore.ts:184-227` — `revertQuoteVersion(quoteId, toVersion, reason)` prepends a new `Draft` version whose snapshot is cloned from `source.snapshot` and whose `changes` list contains a single `config-changed` "Reverted to Draft" entry. `isRevert: true` and `revertedFrom: toVersion` are stamped on the new entry. The prior versions are preserved.
- No inline "amend" verb — reverting is the only server-observed write.

### Filters

- **Listing:** `QuotesFiltersModal.tsx` — no version-related filter (grep returns 0 hits). Users don't filter the LIST by version state.
- **Versions tab:** `versionFilters.ts:14-30` — search, quick-filter (all / line-items / pricing / config), creator, status. All version-filtering happens inside the versions tab, not on the list.

### Store / selectors

- `mock-api/quotes/versionsStore.ts:168-181` — in-memory `Map<quoteId, QuoteVersion[]>` seeded lazily via `generate(quoteId, versionCount)`. Deterministic hash off the quote id.
- `mock-api/quotes/useQuotes.ts:418-438` — React Query hooks:
  - `useQuoteVersions(quoteId | null)` — enabled only when id is present; 30s staleTime.
  - `useRevertQuoteVersion()` — mutation that on success writes the returned `QuoteVersionsResponse` into the versions cache AND invalidates the list (bumping the row's `version` counter).
- Version envelope is fetched per detail entry, never inline on the list row (list only carries the counter).

---

## Purchase Orders (current state)

### Data model

- `poStore.ts:92-163` — versioning fields on the PO entity itself (NOT a separate contract like SO):
  - `POVersionStatus = 'draft' | 'sent' | 'confirmed' | 'partially-received'` (line 92). PO adds a fourth state SO doesn't have.
  - `POChangeType` — 6-value union (line 94-100): `line-item-added`, `line-item-removed`, `line-item-modified`, `pricing-changed`, `vendor-changed`, `config-changed`. **GAPS vs SO**: no `attachment-added`, `rule-applied`, `adjustment-applied`, and `customer-changed` is renamed to `vendor-changed`.
  - `POChangeRecord` (line 102-110) — has `id`, `type`, `action`, `subject`, `detail?`, `timestamp`, `user`. **GAP**: no `subjectDetail`, `itemRef`, or precomputed `initials`.
  - `POLineItemSnapshot` (line 112-126) — richer than `VersionLineItem`: carries `quantity`, `vendorQty`, `vendorUOM`, `discount`, `needByDate`, `promisedShipDate`, `inboundLocation`, `cancelled`.
  - `POVersionSnapshot` (line 128-147) — much richer than SO's snapshot: full `poNumber`, `vendorName`, `status`, `deliveryDate`, `notes`, `subtotal`/`discountTotal`/`shippingFee`/`total`, `payment`, `lineItems`, embedded `vendor`, `recipient`, `secondaryContactNames`, `orderDate`, `confirmationDate`, `sentDate`. **Extra vs SO** (which only has `lineItemCount / grandTotal / rulesCount / adjustmentsCount / validUntil / lineItems`).
  - `POVersionEntry` (line 149-163) — `version`, `versionStatus`, `createdAt` (raw ISO — NOT pre-formatted like SO), `createdBy`, `avatar` (initials), `reason`, `changes`, `snapshot`, optional `isRevert`, `revertedFrom`, plus PO-specific extras: `changeTags?: string[]`, `previousStatus?: string`, `newStatus?: string`.
  - `PurchaseOrderData` (line 165-221) — `currentVersion: number` + `versions: POVersionEntry[]` embedded on the entity itself (line 199-200).
- **Model divergences vs SO**:
  - PO stores full `versions[]` in-place on the entity (no separate fetch); SO fetches versions on demand via a keyed React Query hook.
  - PO adds `partially-received` status + `changeTags` + `previousStatus`/`newStatus` fields SO doesn't have.
  - PO carries raw ISO timestamps; SO pre-formats them server-side.
  - PO lacks SO's precomputed `initials` on changes and `attachment-added` / `rule-applied` / `adjustment-applied` change types.

### Listing table touch points

- `PurchaseOrdersListing.tsx:192-232` — `versions` array hard-coded (line 192) then round-robin assigned to seeded rows (line 222). Store-created POs pull `spo.currentVersion` (line 938). Detail modal wire-up sends `currentVersion + versions[]` back to the store (line 1169-1170).
- `PurchaseOrdersListing.tsx:453-478` — `VersionBadge({ version })` renders `v{N}` with 5-tone colour palette (`--version-1-bg` … `--version-5-bg`).
- `PODataTable.tsx:48` — `version: number` field on the list row model.
- `PODataTable.tsx:1391-1409` — version chip rendered INSIDE the pinned PO-No cell, next to the number. Slate/neutral pill, `title={\`Version ${item.version}\`}`.
- **GAPS vs SO**:
  - PO's chip is **NOT clickable** — no `onClick`, no `onViewVersions` callback. It's a passive marker. SO's opens the header switcher.
  - PO doesn't thread a `onViewVersions?: (id) => void` through the cell context — cells just render.
  - PO uses a 5-tone version palette on the listing (`v1`=slate/`v5`=purple). SO uses a single subtle primary badge for all versions. Divergent branding.
  - `PODataTable.tsx:1410-1415` — Outdated-configs chip was removed from listing per "SO-V5 sync". PO already trending toward SO's minimalism here.
- `PurchaseOrdersListing.tsx:1575, 1761` — version surfaces in the "PO-{number} · v{version}" title strings in the detail-modal breadcrumb / QuickView.

### Detail page touch points

- `PODetailTabs.tsx:29` — `{ id: "versions", label: "Versions", icon: GitBranch }` — the tab exists.
- `PurchaseOrderDraft.tsx:194,2226,2680,2866-2874,3688-3695`:
  - Imports `POVersionDropdown` (line 194) — header switcher, mirrors SO's `QuoteVersionDropdown`.
  - `viewingVersion` state (line 2226).
  - `selectedPrintVersion` (line 2680) — resolves an entry from `viewingVersion`.
  - Header rendering (line 2866-2874) — `<POVersionDropdown currentVersion currentStatus viewingVersion onViewVersion onEditAsDraft materialChangesCount versions />`. On revert, calls `revertPOToVersion(po.id, fromVersion, ...)` and toasts.
  - Versions tab body (line 3688-3695): `<POVersionHistoryTab poNumber versions onRevert onCompareFullScreen />`.
- `POVersionDropdown.tsx:1-429` — SO parity for the header pill + popover switcher. Compact trigger, status config table, `viewingVersion` support, revert per row.
- `POVersionHistoryTab.tsx:1-774` — deep versions tab:
  - Toolbar: search input + Compare toggle (**GAP vs SO**: no quick-filter chips for `All Changes / Line Items / Pricing / Config`; no advanced filter popover for status/creator).
  - Compare action bar with primary CTA `Compare V{min} → V{max}` (line 220-236). Fires `onCompareFullScreen(v1, v2)` — separate full-screen surface vs SO's inline `VersionCompareView`.
  - Per-version row: avatar, status pill (with icons), Latest/Revert tags, date, author, reason line. Similar shape to SO's `VersionRow`.
- `POCompareFullScreen.tsx:1-490` — the full-screen diff view (PO takes over the whole surface; SO renders `VersionCompareView` inline inside the tab).

### Create / edit flow

- `PurchaseOrderDraft.tsx:2584-2600` — `guardEdit(action, tag?, changeDetail?)` intercepts every edit outside Draft. In `draft`, edits pass through; in post-draft states without a confirmed edit session, it opens `showVersionConfirmModal` — the user must acknowledge that editing will bump the version.
- `PurchaseOrderDraft.tsx:2606-2646` — `handleSaveVersion` calls `recordPOVersion` with a rolled-up `reason`, the `changes[]` array from the edit session, `changeTags`, `previousStatus`, `newStatus`, and `resetToDraft: !isDraft`. Toasts "Version N created — PO returned to Draft" when post-Draft edits reset the PO.
- `PurchaseOrderDraft.tsx:3469, 3563` — inline banner "Editing Version {n+1}" while an edit session is open; "Save Version" button commits.
- `poStore.ts:526-586` — `recordPOVersion(poId, payload)` bumps `currentVersion`, prepends to `versions[]`, optionally resets the PO to Draft (clearing `sentDate/confirmationDate/receivingStartDate`), and notifies subscribers.
- `poStore.ts:658-716` — `revertPOToVersion(poId, version, reason)`: rebuilds the PO's editable fields from the snapshot, then records a `chg-{poId}-v{n}-1` "Reverted to Version X" entry with `isRevert: true` / `revertedFrom: X` (SO parity here is close).

**Divergence vs SO**: PO has a first-class "edit → save version" verb that mutates the current PO (with `resetToDraft` semantics unique to PO). SO's only observed write path is `revertQuoteVersion` — the primary way SO creates non-initial versions is by amending, then presumably re-sending (the write path lives outside this module).

### Filters

- `POFiltersModal.tsx` / `POFilterBar.tsx` — **GAP — nothing implemented yet.** No version filter on the listing (SO doesn't have one either, so this is parity).
- Versions-tab filters: search only. **GAP vs SO**: no quick-filter chips, no advanced status/creator popover, no `versionFilters.ts`-style pure filter module.

### Store / selectors

- `poStore.ts:515-524` — `getPOVersions(poId): POVersionEntry[]` sorts newest-first. `getPOVersionCount(poId): number` — plain count.
- `poStore.ts:526-586` — `recordPOVersion` mutating writer.
- `poStore.ts:658-716` — `revertPOToVersion` mutating writer.
- `poStore.ts:589-656` — `restorePOFromSnapshot` — used by the "discard changes" flow.
- No React Query hooks; store is a synchronous `Map` with a listener-based subscription (`subscribeToPOStore` at line 496).
- **GAP vs SO**: no query-key-based caching or invalidation; no separate `useQuoteVersions`-style hook. Every consumer reads from the store directly.

---

## Differences summary

**What SO has that PO lacks**

- Precomputed `initials` on every `VersionChange` (avoids per-render initials calc).
- Precomputed date strings on version + changes (`createdAt`, `sentAt`, `confirmedAt` are all "MM/DD/YYYY · h:mm AM").
- Change types PO doesn't have: `attachment-added`, `rule-applied`, `adjustment-applied`, `customer-changed` (PO has `vendor-changed` which is the semantic mirror).
- `subjectDetail` and `itemRef` on `VersionChange` — line-item cross-references.
- Quick-filter chips + advanced filter popover in the versions tab (`All Changes / Line Items / Pricing & Rules / Customer Info` × creator × status).
- `filterVersions` pure filtering module (`versionFilters.ts`) — testable, no React.
- Inline `VersionCompareView` inside the tab (PO opens `POCompareFullScreen` as a separate route surface).
- Header switcher's "Last approved" tag rendered next to the current-viewing version.
- Read-only gating of Items / Deal Info / Attachments / Communications tabs when `viewingVersion !== null`. PO probably reads-only Items via the editing-session guard, but the auditor did not verify parity across every tab.
- React Query-based caching + invalidation for versions.
- `snapshot.rulesCount` and `snapshot.adjustmentsCount` — PO snapshot has neither concept.
- Version validUntil date (SO surfaces it in the digest).
- Reason input in the revert modal (`VersionRevertModal.tsx` collects a reason). PO's revert passes a hardcoded default string.

**What PO has that SO doesn't**

- Fourth version status: `partially-received` (mirrors PO lifecycle).
- `changeTags?: string[]` on version entries — surfaces the "N changes across M areas" summary bar.
- `previousStatus` / `newStatus` on version entries — flags "Reset from Sent → Draft" edits.
- Full-page compare (`POCompareFullScreen`).
- Discard-changes-with-snapshot-restore (`restorePOFromSnapshot`).
- Post-Draft edit guard modal (`showVersionConfirmModal`) — PO forces users to acknowledge that editing bumps the version.
- Inline "Editing Version {n+1}" banner + "Save Version" button while an edit session is open.
- The row's version chip uses a colored palette (`--version-1-bg` … `--version-5-bg`). SO uses a single subtle badge.
- Snapshot carries `vendor`, `recipient`, `secondaryContactNames`, `payment`, `orderDate`, `confirmationDate`, `sentDate` — SO's snapshot is line-items + totals only.

**Divergent shape**

- **Data location**: SO fetches versions via API/hook keyed by quote id; PO embeds `versions[]` directly on the entity.
- **List chip click behaviour**: SO's chip opens the header switcher via `onViewVersions`; PO's chip is passive.
- **Chip palette**: SO uses one subtle-primary badge; PO uses a 5-tone rainbow palette.
- **Timestamp format**: SO pre-formats; PO stores raw ISO.
- **Change verbs**: PO `vendor-changed` ≈ SO `customer-changed` (rename); PO missing `attachment-added` / `rule-applied` / `adjustment-applied`.
- **Compare surface**: SO inline in the versions tab; PO full-screen takeover.

---

## Recommended plan

Ordered from lowest to highest ceremony. Each step is independently mergeable.

### Step 1 — Make the listing chip clickable (S, no dependencies)

**Files**: `PODataTable.tsx`, `PurchaseOrdersListing.tsx`.

- Thread an optional `onViewVersions?: (poId: string) => void` prop through `PODataTable` (mirror SO's `context.onViewVersions` pattern from `quoteColumns.tsx:49`).
- Wire the chip at `PODataTable.tsx:1393-1409`: add `onClick={(e) => { e.stopPropagation(); onViewVersions?.(item.id); }}` + `role="button"` + `aria-label={\`Version ${item.version} history\`}`.
- In `PurchaseOrdersListing.tsx`, wire `onViewVersions` so it navigates to the PO detail page with the versions tab active (route hash `#versions` or query param).
- Optional visual cleanup: unify the 5-tone `--version-N-bg` palette to a single subtle-primary badge (SO's `<Badge variant="subtle" color="primary" size="xs" rounded={false} showLinkArrow />` equivalent) so PO stops using its rainbow. **This is a divergence PO's UX team may want to keep** — flag before removing.

### Step 2 — Bring change-type + snapshot fields to parity (M, no dependencies)

**Files**: `poStore.ts`, `POVersionHistoryTab.tsx`.

- Add missing `POChangeType` values: `attachment-added`, `rule-applied`, `adjustment-applied`.
- Rename or alias `vendor-changed` ↔ SO's `customer-changed` conceptually so the change-type map in `changeTypeConfig` (`POVersionHistoryTab.tsx:38-45`) mirrors SO's palette.
- Add optional `subjectDetail?: string` and `itemRef?: string` to `POChangeRecord` (currently only present on SO). Backfill via `initVersioning` + `recordPOVersion` in a follow-up when the recording sites are updated.
- Add `initials` to `POChangeRecord` (precomputed at write time, not per render). Update `initVersioning` and `recordPOVersion` to stamp initials on the change record via a shared helper.

### Step 3 — Version-tab filter parity (M, dependent on Step 2 for the change-type union)

**Files**: `POVersionHistoryTab.tsx` (new sibling: `poVersionFilters.ts`).

- Extract a pure `filterVersions(versions, state)` module mirroring `sales/pages/quote-detail/tabs/versions/versionFilters.ts`:
  - State: `search`, `changeFilter: 'all' | 'line-items' | 'pricing' | 'config'`, `creator`, `status`.
  - Same reducer semantics: narrow each version's changes, keep versions whose changes match / notes / author match, then apply advanced filters.
- Wire into the existing toolbar: quick-filter chip row + advanced-filter popover (`Status`, `Creator`) with an `advancedFilterCount` badge.
- Add unit tests around the filter reducers — SO doesn't ship them but PO's mock data is richer, so it's worth the cheap coverage.

### Step 4 — Revert modal with reason input (S, dependent on Step 2)

**File**: new `POVersionRevertModal.tsx`, hooked from `PurchaseOrderDraft.tsx:2866-2880` and `POVersionHistoryTab.tsx`.

- SO parity: `VersionRevertModal.tsx` collects a reason string, then calls the revert mutation. Currently PO fires `revertPOToVersion(po.id, fromVersion, \`Reverted to Version ${fromVersion}\`)` with the default text.
- Extract the modal component. On confirm, call `revertPOToVersion(poId, targetVersion, reason)` and toast.
- Follow-up: expose the reason as `notes` on the resulting new version — surface it in the header switcher and versions tab. This requires a small `recordPOVersion` update to store the reason on the new draft entry.

### Step 5 — Read-only gating for historical versions (M, no dependencies)

**File**: `PurchaseOrderDraft.tsx` (and every tab that renders inside `<PODetailTabs>`).

- SO reads `viewingVersion !== null` as a global "editable = false" signal (`QuoteDetailView.tsx:160, 167, 174, 176`). Every tab receives an `editable` or `readOnly` prop.
- Audit each PO detail tab: `Items`, `Receiving Docs`, `Invoices & Payments`, `Communications`, `Notes`, `Comments`, `Attachments`, `Recent Activities`. Any editable action inside these tabs needs a `readOnly` prop wired from `viewingVersion !== null`.
- Add a subtle "Viewing Version N — read only" banner at the top of the detail page (SO does this via `viewingVersion` badges in the switcher; PO could either match or add an explicit banner).

### Step 6 — Inline compare view (L, dependent on Step 3's filter refactor)

**File**: New `POVersionCompareInline.tsx` OR refactor `POCompareFullScreen.tsx` to be embeddable.

- Currently PO's compare mode leaves the versions tab and opens a full-screen takeover (`PurchaseOrderDraft.tsx` `compareFullScreen` route). SO renders `VersionCompareView` INSIDE the versions tab card.
- Refactor so `POCompareFullScreen` can render inline in the versions tab OR keep both surfaces and let the buyer choose. Simpler ceremony: inline by default, "Open full screen" as a link inside the diff.
- Reduces a whole navigation surface and matches SO's mental model (compare is a versions-tab feature, not a separate screen).

### Step 7 — Storage / caching architecture (L, no dependencies but touches many callers)

**Files**: `poStore.ts` and every consumer of `getPOVersions` / `subscribeToPOStore`.

- SO uses React Query keyed by `quoteId`; PO uses an in-memory `Map` + `subscribeToPOStore` listeners.
- Option A (light): expose thin hooks `usePOVersions(poId)` and `useRevertPOVersion()` around the existing store so consumer components have a SO-parity API surface without swapping the underlying data model.
- Option B (heavy): move to `@tanstack/react-query` genuinely — requires backend contract negotiation (mock API layer analogous to `mock-api/quotes`). Big scope; only worth doing if the BFF is imminent.
- Recommend Option A for now; it's a shim that unlocks future migration to a real API without breaking any callers.

### Step 8 — Cosmetics + minor SO parity (S, no dependencies)

- Pre-format timestamps: add a helper `formatVersionStamp(iso)` that returns `MM/DD/YYYY · h:mm AM` and call it at recording time so downstream renders don't have to (SO's `versionsStore.ts:144` demonstrates).
- Add SO-parity tags on the header switcher: "Last Approved" tag next to the version that was most recently in `confirmed` state (SO's `QuoteVersionDropdown.tsx:47-48`).
- Surface `notes` (revert reason) on version rows — SO shows it under the row title.
- Consider dropping the `partially-received` version status in favour of surfacing it through row metadata; SO doesn't have it and PO's use of it as a version status (rather than a lifecycle-only concept) means status pills can drift out of sync with the PO's live status.

### Step 9 — Attachment / rule / adjustment change types (M, dependent on Step 2 + Step 7 shims)

**Files**: `poStore.ts`, `POVersionHistoryTab.tsx`, any recording site for those events.

- After Step 2 adds the change-type union, wire the recording sites: whenever a PO attachment lands, a pricing rule fires, or an adjustment is applied, `recordPOVersion` should emit a `attachment-added` / `rule-applied` / `adjustment-applied` change so the versions tab reflects the same taxonomy SO does.
- PO doesn't have rules/adjustments today. If the concept doesn't exist yet, the change types can land as no-op mappings that render the correct icon when a future subsystem produces them.

### Data / API notes

- SO fetches versions via `GET /api/v2/quotes/:id/versions` and reverts via `POST /api/v2/quotes/:id/versions/revert`. PO has no backend contract — everything is in-memory (`poStore.ts`). If Step 7's Option B is pursued, the plan will need a mock-api layer in the PO repo modelled after `omne-frontend/apps/omne-erp/src/mock-api/quotes/`.

### Suggested execution order

1. Step 1 (make the chip clickable) — highest-leverage, 1-2h.
2. Step 5 (read-only gating) — closes the biggest UX gap between the two modules.
3. Step 2 (change-type + snapshot parity) — foundation for Steps 3, 4, 9.
4. Step 4 (revert modal with reason).
5. Step 3 (versions-tab filter parity).
6. Step 8 (cosmetics + minor parity).
7. Step 6 (inline compare view) — only if it's worth removing the full-screen surface.
8. Step 7 (hooks shim / React Query migration) — do if there's a BFF push.
9. Step 9 (attachment / rule / adjustment recording) — only when the underlying subsystems exist.
