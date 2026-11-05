/* Mock Partner-Management propagation payload. Simulates what
 * the receiving-side would get pushed from PM when a partner's
 * config (currency, addresses, pricing rules, sales reps, etc.)
 * drifts away from what a specific PO is currently pinned to.
 *
 * Keyed by PO id so only the hero demo record surfaces the
 * "Outdated Configurations" pill — every other PO in the
 * listing reads as up-to-date. Real integration would swap this
 * for a store selector + live poll on the receiving-side app.
 *
 * The stable id `'po-outdated-demo'` is seeded into the mock PO
 * store so exactly one Draft PO shows the amber pill. */
import type { OutdatedUpdate } from "./OutdatedConfigsModal";

const DEMO_UPDATES: OutdatedUpdate[] = [
  {
    id: "currency",
    field: "Currency Unit",
    category: "Pricing",
    oldValue: "USD",
    newValue: "GBP",
    note: "Line prices will be reconverted at the current FX rate.",
  },
  {
    id: "ship-to",
    field: "Default Ship-to address",
    category: "Logistics",
    oldValue: "1200 Pier S Ave, Long Beach, CA 90802",
    newValue: "500 N Akard St, Dallas, TX 75201",
    note: "Only lines still on default resolve to the new address.",
  },
  {
    id: "bill-to",
    field: "Default Bill-to address",
    category: "Billing",
    oldValue: "450 S Spring St, Los Angeles, CA 90013",
    newValue: "500 N Akard St, Dallas, TX 75201",
  },
  {
    id: "pricing-rule-tier",
    field: "Pricing rule — Volume Tier",
    category: "Pricing",
    oldValue: "Standard Discount (Single-Tier)",
    newValue: "Preferred Partner Discount (3-Tier)",
    note: "Applies to all catalog lines that don't already have a line-level override.",
  },
  {
    id: "payment-terms",
    field: "Payment terms",
    category: "Billing",
    oldValue: "Net 30",
    newValue: "Net 45",
  },
  {
    id: "buyer-rep",
    field: "Primary buyer contact",
    category: "People",
    oldValue: "Ahtisham Ahmad",
    newValue: "Irtaza Abid",
  },
  {
    id: "credit-limit",
    field: "Credit limit",
    category: "Billing",
    oldValue: "$50,000.00",
    newValue: "$75,000.00",
  },
  {
    id: "preferred-carrier",
    field: "Preferred carrier",
    category: "Logistics",
    oldValue: "FedEx Ground",
    newValue: "UPS Ground",
    note: "Default shipping method updates; per-line overrides retained.",
  },
];

/** Stable id used by the mock PO seed (hero demo PO). */
export const OUTDATED_DEMO_PO_ID = "po-outdated-demo";
/** Second flagged PO — the first Draft row from the listing
 *  seed (395-9825, `po-1`) so the buyer sees two rows in the
 *  listing with the amber chip side by side. */
export const OUTDATED_SECOND_PO_ID = "po-1";

/* Map from PO id → outstanding updates. Only flagged POs are
   populated; everything else returns []. Runtime-mutable via
   `markOutdatedApplied(id, ids)` and `markOutdatedIgnored(id, ids)`
   so applying/ignoring an update drops it from the pool for the
   rest of the session. Each flagged PO gets its OWN copy of the
   update list so applying on one doesn't affect the other. */
const CONFIG_MAP: Record<string, OutdatedUpdate[]> = {
  [OUTDATED_DEMO_PO_ID]: [...DEMO_UPDATES],
  [OUTDATED_SECOND_PO_ID]: DEMO_UPDATES.map((u) => ({ ...u })),
};

/* Ids the user permanently dismissed. Ignored updates never
   resurface for the PO even if the modal is reopened. Keyed by
   PO id. */
const IGNORED_MAP: Record<string, Set<string>> = {};

/* POs where the user has interacted with the outdated banner
   (applied, ignored, or explicitly closed via the X). Once
   flipped true, the pill/banner does not resurface for the
   record — the user's choice is one-shot per draft, even for
   updates they left un-synced. Reset when the PO transitions
   out of Draft via `resetOutdatedBannerDismissal`. */
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

/** True only when there are outdated configs AND the user has
 *  not yet dismissed the banner for this PO. The header pill
 *  and its click target read from this so the surface is a
 *  single-time choice per draft. */
export function shouldShowOutdatedBanner(id: string | undefined | null): boolean {
  if (!id) return false;
  if (BANNER_DISMISSED[id]) return false;
  return hasOutdatedConfigs(id);
}

/** Apply the given update ids for a PO — removes them from
 *  the outstanding pool so the pill count decrements. Also
 *  flips the banner to dismissed so it does not resurface for
 *  remaining updates. */
export function markOutdatedApplied(id: string, appliedIds: string[]): void {
  const list = CONFIG_MAP[id];
  if (list) {
    CONFIG_MAP[id] = list.filter((u) => !appliedIds.includes(u.id));
  }
  BANNER_DISMISSED[id] = true;
}

/** Ignore the given update ids permanently for this PO. Ignored
 *  updates do not resurface if the modal is reopened. Also flips
 *  the banner to dismissed. */
export function markOutdatedIgnored(id: string, ignoredIds: string[]): void {
  const set = IGNORED_MAP[id] ?? new Set<string>();
  ignoredIds.forEach((x) => set.add(x));
  IGNORED_MAP[id] = set;
  BANNER_DISMISSED[id] = true;
}

/** Explicitly dismiss the header pill for a PO without applying
 *  or ignoring any specific updates. Used by the close X on the
 *  modal. */
export function dismissOutdatedBanner(id: string): void {
  BANNER_DISMISSED[id] = true;
}

/** True when the user has dismissed the banner for a PO. Used by
 *  callers that need to render alternative content in the pill
 *  slot after dismissal. */
export function isOutdatedBannerDismissed(id: string | undefined | null): boolean {
  if (!id) return false;
  return !!BANNER_DISMISSED[id];
}
