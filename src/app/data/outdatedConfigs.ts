/* Mock upstream-module propagation payload. Simulates what the
 * receiving-side would get pushed when a partner's config (currency,
 * addresses, pricing rules, sales reps, etc.) drifts away from what
 * a specific quote / SO is currently pinned to.
 *
 * Keyed by quote / SO id so only the hero demo record surfaces the
 * outdated banner — every other quote in the listing reads as
 * up-to-date. Real integration would swap this for a store selector
 * + live poll on the receiving-side app.
 *
 * The stable id `'q-outdated-demo'` (and `'so-outdated-demo'`) is
 * inserted into the mockQuotes / mockSOs arrays at position #3 so
 * one row surfaces the banner on load. */
import type { OutdatedUpdate } from '../components/shared/OutdatedConfigsModal';

const DEMO_UPDATES: OutdatedUpdate[] = [
  {
    id: 'currency',
    field: 'Currency Unit',
    category: 'Pricing',
    oldValue: 'USD',
    newValue: 'GBP',
    note: 'Line prices reconvert at the current FX rate.',
  },
  {
    id: 'ship-to',
    field: 'Default Ship-to address',
    category: 'Logistics',
    oldValue: '1200 Pier S Ave, Long Beach, CA 90802',
    newValue: '500 N Akard St, Dallas, TX 75201',
    note: 'Lines still on default resolve to the new address.',
  },
  {
    id: 'bill-to',
    field: 'Default Bill-to address',
    category: 'Billing',
    oldValue: '450 S Spring St, Los Angeles, CA 90013',
    newValue: '500 N Akard St, Dallas, TX 75201',
  },
  {
    id: 'pricing-rule-tier',
    field: 'Pricing rule tier',
    category: 'Pricing',
    oldValue: 'Standard Discount (Single-Tier)',
    newValue: 'Preferred Partner Discount (3-Tier)',
    note: 'Applies to catalog lines with no line-level override.',
  },
  {
    id: 'payment-terms',
    field: 'Payment terms',
    category: 'Billing',
    oldValue: 'Net 30',
    newValue: 'Net 45',
  },
  {
    id: 'sales-rep',
    field: 'Primary sales rep',
    category: 'People',
    oldValue: 'Ahtisham Ahmad',
    newValue: 'Irtaza Abid',
  },
  {
    id: 'credit-limit',
    field: 'Credit limit',
    category: 'Billing',
    oldValue: '$50,000.00',
    newValue: '$75,000.00',
  },
  {
    id: 'preferred-carrier',
    field: 'Preferred carrier',
    category: 'Logistics',
    oldValue: 'FedEx Ground',
    newValue: 'UPS Ground',
    note: 'Per-line carrier overrides are retained.',
  },
];

/** Stable ids used by the mockQuotes / mockSOs seed. Insert a record
 *  with one of these ids as position #3 in the source array. */
export const OUTDATED_DEMO_QUOTE_ID = 'q-outdated-demo';
export const OUTDATED_DEMO_SO_ID = 'so-outdated-demo';

/* Map from document id → outstanding updates. Only the hero demo
   record is populated; everything else returns []. Runtime-mutable
   via `markOutdatedApplied` and `markOutdatedIgnored`. */
const CONFIG_MAP: Record<string, OutdatedUpdate[]> = {
  [OUTDATED_DEMO_QUOTE_ID]: [...DEMO_UPDATES],
  [OUTDATED_DEMO_SO_ID]: [...DEMO_UPDATES],
};

/* Ids the user permanently dismissed. Ignored updates never resurface
   for the record even if the modal is reopened. Keyed by doc id. */
const IGNORED_MAP: Record<string, Set<string>> = {};

/* Documents where the user has interacted with the outdated banner
   (applied, ignored, or explicitly closed via the X). Once flipped
   true, the banner does not resurface for the record — the user's
   choice is one-shot per draft, even for updates they left un-synced. */
const BANNER_DISMISSED: Record<string, boolean> = {};

export function getOutdatedForId(id: string | undefined | null): OutdatedUpdate[] {
  if (!id) return [];
  const ignored = IGNORED_MAP[id];
  const list = CONFIG_MAP[id] || [];
  if (!ignored || ignored.size === 0) return list;
  return list.filter((u) => !ignored.has(u.id));
}

export function hasOutdatedConfigs(id: string | undefined | null): boolean {
  if (!id) return false;
  return getOutdatedForId(id).length > 0;
}

/** True only when there are outdated configs AND the user has not
 *  yet dismissed the banner for this record. The version-card banner
 *  and its sync CTA read from this so the surface is a single-time
 *  choice per draft. */
export function shouldShowOutdatedBanner(id: string | undefined | null): boolean {
  if (!id) return false;
  if (BANNER_DISMISSED[id]) return false;
  return hasOutdatedConfigs(id);
}

/** Apply the given update ids for a document — removes them from
 *  the outstanding pool so counts decrement. Also flips the banner
 *  to dismissed so it does not resurface for remaining updates. */
export function markOutdatedApplied(id: string, appliedIds: string[]): void {
  const list = CONFIG_MAP[id];
  if (list) {
    CONFIG_MAP[id] = list.filter((u) => !appliedIds.includes(u.id));
  }
  BANNER_DISMISSED[id] = true;
}

/** Ignore the given update ids permanently for this document. Ignored
 *  updates do not resurface if the modal is reopened. Also flips the
 *  banner to dismissed. */
export function markOutdatedIgnored(id: string, ignoredIds: string[]): void {
  const set = IGNORED_MAP[id] ?? new Set<string>();
  ignoredIds.forEach((x) => set.add(x));
  IGNORED_MAP[id] = set;
  BANNER_DISMISSED[id] = true;
}

/** Explicitly dismiss the version-card banner for a document without
 *  applying or ignoring any specific updates. Used by the close X on
 *  the banner. */
export function dismissOutdatedBanner(id: string): void {
  BANNER_DISMISSED[id] = true;
}

/** True when the user has dismissed the banner for a document. Used
 *  by callers that need to render alternative content in the banner
 *  slot after dismissal. */
export function isOutdatedBannerDismissed(id: string | undefined | null): boolean {
  if (!id) return false;
  return !!BANNER_DISMISSED[id];
}
