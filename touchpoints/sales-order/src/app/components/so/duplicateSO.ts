import type { SalesOrder, SOLine, SOStatus, SOVersion } from './types';

/* ════════════════════════════════════════════════════════════════════
   Shared duplicate-SO builder. Produces the `Partial<SalesOrder>`
   payload that `useSOStore().createSO()` consumes so both the listing
   and the detail page produce identical duplicates. Mirrors the
   Quotes-side helper.
   ════════════════════════════════════════════════════════════════════ */

/* Duplicate is blocked the moment ops has accepted the order, because
   duplicating then would trigger a parallel procurement/production run
   the ops team never approved. The block covers every state past
   Pending Review: Cleared (ready to ship), Partially Shipped, Shipped,
   and Partially Cancelled (lines already moved through fulfillment).
   Draft / Pending Review / Cancelled / Archived are still safe to copy. */
const DUPLICATE_BLOCKED_STATUSES: SOStatus[] = [
  'Cleared',
  'Partially Shipped',
  'Shipped',
  'Partially Cancelled',
];

export function isDuplicateBlockedByOps(status: SOStatus): boolean {
  return DUPLICATE_BLOCKED_STATUSES.includes(status);
}

export function duplicateBlockedReason(status: SOStatus): string | null {
  if (!isDuplicateBlockedByOps(status)) return null;
  return `Duplicating a "${status}" sales order would trigger a parallel procurement / production run without ops verification. Ask ops to revert the order to Draft first, or duplicate a Draft / Cancelled / Archived order instead.`;
}

export type DuplicateSOVersionMode = 'single' | 'all';

export interface DuplicateSOPayloadOptions {
  newCustomerId?: string;
  newCustomerName: string;
  versionMode: DuplicateSOVersionMode;
  selectedVersion: number;
}

/* Zero out fulfillment-bound line fields so the duplicate behaves like
   a brand-new draft regardless of how far the source progressed. */
function resetLines(lines: SOLine[]): SOLine[] {
  return lines.map(l => ({
    ...l,
    allocatedQty: 0,
    pickedQty: 0,
    shippedQty: 0,
    deliveredQty: 0,
    cancelled: false,
    cancelledQty: 0,
    cancelledReason: undefined,
    cancelAction: undefined,
    allocations: [],
    readyToPick: false,
  }));
}

function buildVersions(
  source: SalesOrder,
  mode: DuplicateSOVersionMode,
  selectedVersion: number,
  dateStr: string,
): { versions: SOVersion[]; current: SOVersion } {
  if (mode === 'all') {
    /* Keep the full history; mark every prior entry as Superseded and
       add a fresh Latest draft on top. */
    const sourceVersions = (source.versions ?? []).slice().sort((a, b) => b.number - a.number);
    const maxV = sourceVersions[0]?.number ?? source.version?.number ?? 1;
    const stamped = sourceVersions.map(v => ({ ...v, label: 'Superseded' as const }));
    const newTop: SOVersion = { number: maxV + 1, label: 'Latest', date: dateStr };
    return { versions: [...stamped, newTop], current: newTop };
  }
  /* single-version mode → drop history, fresh V1 (so the duplicate
     starts clean). The `selectedVersion` is noted in the SO description
     so the user can trace where it was seeded from. */
  void selectedVersion;
  const newTop: SOVersion = { number: 1, label: 'Latest', date: dateStr };
  return { versions: [newTop], current: newTop };
}

export function buildDuplicateSOPayload(
  source: SalesOrder,
  options: DuplicateSOPayloadOptions,
): Partial<SalesOrder> {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0].replace(/-/g, '/');
  const customerName = options.newCustomerId ? options.newCustomerName : source.customer;
  const customerInitials = options.newCustomerId
    ? options.newCustomerName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : source.customerInitials;

  const versionMeta = options.versionMode === 'all'
    ? `all versions copied`
    : `from V${options.selectedVersion}`;

  const { versions, current } = buildVersions(
    source,
    options.versionMode,
    options.selectedVersion,
    dateStr,
  );

  return {
    customer: customerName,
    customerInitials,
    customerId: options.newCustomerId || source.customerId,
    pocs: source.pocs,
    primaryPocId: source.primaryPocId,
    description: `Copy of ${source.soNumber} (${versionMeta})`,
    lines: resetLines(source.lines),
    warehouse: source.warehouse,
    currency: source.currency,
    paymentTerms: source.paymentTerms,
    shippingAddress: source.shippingAddress,
    salesRep: source.salesRep,
    salesReps: source.salesReps,
    tags: [...(source.tags ?? [])],
    freightMethod: source.freightMethod,
    sourceQuoteRef: source.sourceQuoteRef,
    rfqRef: source.rfqRef,
    warehouses: [...(source.warehouses ?? [])],
    priority: source.priority,
    version: current,
    versions,
  };
}
