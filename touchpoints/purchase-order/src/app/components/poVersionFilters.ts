/**
 * Pure filtering pipeline for the PO version-history tab toolbar.
 *
 * Ported from the Sales Order module's
 * `pages/quote-detail/tabs/versions/versionFilters.ts` (2026-07-10 audit)
 * so the two tabs behave the same. The PO adaptation:
 *   · The `'config'` quick filter looks for vendor / ship-to / bill-to /
 *     contact edits (PO uses `vendor-changed`; SO uses `customer-changed`).
 *   · Filters narrow *both* the search text and the quick-filter selection
 *     across the same change list before deciding whether a version stays.
 *
 * Kept pure (no React, no state) so it can be unit-tested and reused by any
 * future listing-side version modal.
 */

import type { POVersionEntry, POChangeRecord } from "./poStore";

export type POVersionChangeFilter = "all" | "line-items" | "pricing" | "config";

export interface POVersionFilterState {
  search: string;
  changeFilter: POVersionChangeFilter;
  /** Author name, or 'all'. */
  creator: string;
  /** POVersionStatus value, or 'any'. */
  status: string;
}

export const EMPTY_PO_VERSION_FILTERS: POVersionFilterState = {
  search: "",
  changeFilter: "all",
  creator: "all",
  status: "any",
};

export const PO_VERSION_QUICK_FILTERS: {
  key: POVersionChangeFilter;
  label: string;
}[] = [
  { key: "all",        label: "All changes" },
  { key: "line-items", label: "Line items" },
  { key: "pricing",    label: "Pricing & rules" },
  { key: "config",     label: "Vendor & delivery" },
];

/** Count of advanced (status / creator) filters currently narrowing the
    list. Feeds the badge on the "Filters" popover trigger. */
export function advancedPOFilterCount(state: POVersionFilterState): number {
  return (
    (state.creator !== "all" ? 1 : 0) + (state.status !== "any" ? 1 : 0)
  );
}

function matchesQuickFilter(
  change: POChangeRecord,
  filter: POVersionChangeFilter,
): boolean {
  if (filter === "all") return true;
  if (filter === "pricing") {
    return (
      change.type === "pricing-changed" ||
      change.type === "rule-applied" ||
      change.type === "adjustment-applied" ||
      change.type === "exchange-rate-changed"
    );
  }
  if (filter === "line-items") return change.type.startsWith("line-item");
  /* 'config' — vendor / partner / ship-to / bill-to / contact edits.
     Matches the type directly OR a config-changed row whose subject/detail
     text contains a vendor/shipping keyword. */
  return (
    change.type === "vendor-changed" ||
    (change.type === "config-changed" &&
      /vendor|partner|ship.?to|bill.?to|contact|deliver/i.test(
        `${change.subject} ${change.subjectDetail ?? ""} ${change.detail ?? ""}`,
      ))
  );
}

function matchesSearch(change: POChangeRecord, needle: string): boolean {
  if (!needle) return true;
  return (
    change.subject.toLowerCase().includes(needle) ||
    (change.subjectDetail?.toLowerCase().includes(needle) ?? false) ||
    (change.detail?.toLowerCase().includes(needle) ?? false) ||
    change.user.toLowerCase().includes(needle)
  );
}

/** Apply the toolbar state, returning versions with their change lists
    narrowed. Versions with no matching changes are dropped unless the
    query hits their `reason` / `createdBy`, OR nothing is narrowing at
    all (empty search + `all` quick filter). */
export function filterPOVersions(
  versions: POVersionEntry[],
  state: POVersionFilterState,
): POVersionEntry[] {
  const query = state.search.trim().toLowerCase();

  return versions
    .map((version) => ({
      ...version,
      changes: version.changes.filter(
        (c) =>
          matchesSearch(c, query) &&
          matchesQuickFilter(c, state.changeFilter),
      ),
    }))
    .filter((version) => {
      if (version.changes.length > 0) return true;
      if (query) {
        return (
          version.reason.toLowerCase().includes(query) ||
          version.createdBy.toLowerCase().includes(query)
        );
      }
      return state.changeFilter === "all";
    })
    .filter((version) => {
      if (state.creator !== "all" && version.createdBy !== state.creator) {
        return false;
      }
      return !(
        state.status !== "any" && version.versionStatus !== state.status
      );
    });
}
