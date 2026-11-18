/**
 * Pure filtering pipeline for the RMA version-history toolbar.
 *
 * Ported from the Purchase Order module's `poVersionFilters.ts`. The quick
 * filters are restated for a return: the PO's "Pricing & rules" becomes
 * "Authorization & value", since what changes on a return is what the vendor
 * agreed to rather than what the buyer was charged.
 *
 * Kept pure (no React, no state).
 */

import type { RMAChangeRecord, RMAVersionEntry } from '@/app/data/rmaVersions';

export type RMAVersionChangeFilter =
  | 'all'
  | 'line-items'
  | 'authorization'
  | 'logistics';

export interface RMAVersionFilterState {
  search: string;
  changeFilter: RMAVersionChangeFilter;
  /** Author name, or 'all'. */
  creator: string;
  /** RMAVersionStatus value, or 'any'. */
  status: string;
}

export const EMPTY_RMA_VERSION_FILTERS: RMAVersionFilterState = {
  search: '',
  changeFilter: 'all',
  creator: 'all',
  status: 'any',
};

export const RMA_VERSION_QUICK_FILTERS: {
  key: RMAVersionChangeFilter;
  label: string;
}[] = [
  { key: 'all', label: 'All changes' },
  { key: 'line-items', label: 'Line items' },
  { key: 'authorization', label: 'Authorization & value' },
  { key: 'logistics', label: 'Vendor & logistics' },
];

/** Count of advanced (status / creator) filters currently narrowing the list.
 *  Feeds the badge on the Filters popover trigger. */
export function advancedRMAFilterCount(state: RMAVersionFilterState): number {
  return (state.creator !== 'all' ? 1 : 0) + (state.status !== 'any' ? 1 : 0);
}

function matchesQuickFilter(
  change: RMAChangeRecord,
  filter: RMAVersionChangeFilter,
): boolean {
  if (filter === 'all') return true;
  if (filter === 'line-items') return change.type.startsWith('line-item');
  if (filter === 'authorization') {
    return (
      change.type === 'authorization-changed' || change.type === 'value-changed'
    );
  }
  return (
    change.type === 'vendor-changed' ||
    change.type === 'logistics-changed' ||
    (change.type === 'config-changed' &&
      /vendor|partner|ship.?to|carrier|freight|contact|deliver/i.test(
        `${change.subject} ${change.subjectDetail ?? ''} ${change.detail ?? ''}`,
      ))
  );
}

function matchesSearch(change: RMAChangeRecord, needle: string): boolean {
  if (!needle) return true;
  return (
    change.subject.toLowerCase().includes(needle) ||
    (change.subjectDetail?.toLowerCase().includes(needle) ?? false) ||
    (change.detail?.toLowerCase().includes(needle) ?? false) ||
    change.user.toLowerCase().includes(needle)
  );
}

/** Apply the toolbar state, returning versions with their change lists
 *  narrowed. Versions with no matching changes are dropped unless the query
 *  hits their reason or author, or nothing is narrowing at all. */
export function filterRMAVersions(
  versions: RMAVersionEntry[],
  state: RMAVersionFilterState,
): RMAVersionEntry[] {
  const query = state.search.trim().toLowerCase();

  return versions
    .map((version) => ({
      ...version,
      changes: version.changes.filter(
        (c) => matchesSearch(c, query) && matchesQuickFilter(c, state.changeFilter),
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
      return state.changeFilter === 'all';
    })
    .filter((version) => {
      if (state.creator !== 'all' && version.createdBy !== state.creator) {
        return false;
      }
      return !(state.status !== 'any' && version.versionStatus !== state.status);
    });
}
