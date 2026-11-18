import type { LineItem, Vendor, VendorGRN, VendorPO } from '@/app/data/mockVendors';

/**
 * The selection model behind the vendor-selection modal: the lens types, the
 * source/offer/group shapes, and the pure functions that build and interpret
 * them.
 *
 * Kept apart from the components that render it because React Fast Refresh
 * refuses to patch a module that exports both — every edit to the component
 * file was invalidating the module and forcing a full reload, which is how a
 * browser tab ends up showing a build several changes old.
 */

/** Which entity the result list leads with. `vendor` keeps the original
 *  nested vendor cards; the rest flatten the same data into groups whose
 *  rows are the places a line can be picked from. `po` and `receiver` both
 *  lead with a document and list its lines; `item` leads with the part. */
export type SelectionGroupBy = 'item' | 'vendor' | 'receiver' | 'po';

/** One place a line item can be returned from. Selection always toggles
 *  `poItem`, because the payload the modal hands back is keyed by PO line,
 *  and that toggle already cascades to the receipts underneath. */
export interface ItemSource {
  id: string;
  vendor: Vendor;
  po: VendorPO;
  poItem: LineItem;
  /** Set only in receiver grouping, where the row IS a receipt line. */
  grn?: VendorGRN;
  /** Receipts this line arrived on. Shown as context on the row. */
  relatedGRNs: VendorGRN[];
  receivedQty: number;
  returnedQty: number;
  availableQty: number;
  unitPrice: number;
  uom: string;
  date: string;
}

/** Everything one vendor can supply of a single item. The item list leads
 *  with these rather than with raw sources: a vendor that shipped the part
 *  on four POs is one decision, not four. */
export interface VendorOffer {
  vendorCode: string;
  vendorName: string;
  abbr: string;
  sources: ItemSource[];
  availableQty: number;
  /** Most recent receipt, or the PO date when nothing was received. What
   *  is being returned almost always came from the latest delivery. */
  lastDate: string;
  unitPrice: number;
  uom: string;
}

export interface SourceGroup {
  key: string;
  title: string;
  subtitle: string;
  image?: string;
  /** Only populated for item grouping, where a group can span vendors. */
  offers: VendorOffer[];
  sources: ItemSource[];
  vendorCount: number;
  totalAvailable: number;
  uom: string;
}

export type SortKey = 'date' | 'value' | 'poNumber' | 'remaining';
export type SortDir = 'asc' | 'desc';

export const formatQty = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));

export const formatMoney = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });

/** The company date, "Sep 12, 2026". One format everywhere: the list and the
 *  tabs wrote it this way while the create flow, the lot expiries and the
 *  version history printed raw ISO, so the same delivery read two ways
 *  depending on which screen you were standing on. */
export const formatDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');

function makeSource(
  vendor: Vendor,
  po: VendorPO,
  poItem: LineItem,
  grn: VendorGRN | undefined,
  relatedGRNs: VendorGRN[],
): ItemSource {
  // A receipt line states its own received quantity; a PO line only knows
  // the total across its receipts, so it falls back to summing them.
  const receivedQty = grn
    ? grn.items.find((i) => i.sku === poItem.sku)?.quantity ?? 0
    : relatedGRNs.reduce(
        (sum, g) => sum + (g.items.find((i) => i.sku === poItem.sku)?.quantity ?? 0),
        0,
      ) || poItem.receivedQty || 0;
  const returnedQty = poItem.invoicedQty ?? 0;
  return {
    id: grn
      ? `${vendor.vendorCode}:${po.poNumber}:${grn.grnNumber}:${poItem.id}`
      : `${vendor.vendorCode}:${po.poNumber}:${poItem.id}`,
    vendor,
    po,
    poItem,
    ...(grn ? { grn } : {}),
    relatedGRNs,
    receivedQty,
    returnedQty,
    availableQty: Math.max(0, receivedQty - returnedQty),
    unitPrice: poItem.unitPrice,
    uom: poItem.uom,
    date: grn ? grn.grnDate : po.poDate,
  };
}

/** Nothing received means nothing to send back, so those sit below what can
 *  actually be picked whatever sort is active. They stay listed rather than
 *  hidden, because a missing receipt is often the thing being chased. */
const compareSources = (sortKey: SortKey, sortDir: SortDir) => {
  const dir = sortDir === 'asc' ? 1 : -1;
  return (a: ItemSource, b: ItemSource) => {
    const aOpen = a.availableQty > 0 ? 0 : 1;
    const bOpen = b.availableQty > 0 ? 0 : 1;
    if (aOpen !== bOpen) return aOpen - bOpen;
    if (sortKey === 'value') return (a.availableQty * a.unitPrice - b.availableQty * b.unitPrice) * dir;
    if (sortKey === 'remaining') return (a.availableQty - b.availableQty) * dir;
    if (sortKey === 'poNumber')
      return a.po.poNumber.localeCompare(b.po.poNumber, undefined, { numeric: true }) * dir;
    return (new Date(a.date).getTime() - new Date(b.date).getTime()) * dir;
  };
};

/** A return is raised against one vendor and a handful of lines, so the list
 *  is capped rather than paginated: past this many rows the picker stops
 *  being a picker. */
/** How many rows a group shows before it stops: five vendor offers in the
 *  item lens, five sources elsewhere. The PO lens is exempt, where the rows
 *  are the order's own lines and hiding one would misreport the order. */
const MAX_ROWS = 5;

/** Badge colours for a PO's derived status. Shared so the PO card reads the
 *  same whether it is reached through the vendor lens or the PO lens. */
export const PO_STATUS_COLORS: Record<string, string> = {
  'Open': 'bg-blue-50 text-blue-700 border-blue-100',
  'Partially Received': 'bg-amber-50 text-amber-700 border-amber-100',
  'Fully Received': 'bg-emerald-50 text-emerald-700 border-emerald-100',
  'Closed': 'bg-slate-50 text-slate-600 border-slate-200',
};






/** The three invoice/return states a receipt can be in. The wording differs
 *  per variant ("Not Invoiced" vs "Not Returned"), so the caller supplies the
 *  labels and this only owns the badge styling. */
export interface GRNStatusLabels {
  notInvoiced: string;
  fullyInvoiced: string;
  partiallyInvoiced: string;
}

export function deriveGRNStatus(
  status: string,
  labels: GRNStatusLabels,
): { label: string; styles: string } {
  if (status === 'Fully Invoiced') {
    return { label: labels.fullyInvoiced, styles: 'bg-emerald-50 text-emerald-700 border-emerald-100' };
  }
  if (status === 'Partially Invoiced') {
    return { label: labels.partiallyInvoiced, styles: 'bg-purple-50 text-purple-700 border-purple-100' };
  }
  return { label: labels.notInvoiced, styles: 'bg-slate-50 text-slate-600 border-slate-200' };
}

export interface PODisplayState {
  /** The status actually shown, which overrides `po.status` from what the
   *  receipts say: an order nobody has received against is Open no matter
   *  what the record claims. */
  displayStatus: string;
  isInvoiced: boolean;
  isFullyInvoiced: boolean;
  /** Nothing received yet, so invoicing it is a pre-invoice. */
  isPreInvoiceEligible: boolean;
}

/** The status ladder for a PO card. Receiving wins over the stored status,
 *  and full invoicing wins over both. */
export function derivePOState(po: VendorPO, relatedGRNs: VendorGRN[]): PODisplayState {
  const totalReceived = po.items.reduce((sum, i) => sum + (i.receivedQty || 0), 0);
  const totalOrdered = po.items.reduce((sum, i) => sum + i.quantity, 0);
  const isInvoiced = (po.invoicedAmount || 0) > 0;
  const isFullyInvoiced = (po.invoicedAmount || 0) >= po.poAmount && po.poAmount > 0;

  let effectiveStatus = po.status;
  if (relatedGRNs.length === 0) {
    effectiveStatus = 'Open';
  } else if (totalReceived >= totalOrdered) {
    effectiveStatus = 'Fully Received';
  } else if (totalReceived > 0) {
    effectiveStatus = 'Partially Received';
  }

  return {
    displayStatus: isFullyInvoiced ? 'Fully Invoiced' : effectiveStatus,
    isInvoiced,
    isFullyInvoiced,
    isPreInvoiceEligible: relatedGRNs.length === 0,
  };
}

function buildOffers(sources: ItemSource[]): VendorOffer[] {
  const byVendor = new Map<string, ItemSource[]>();
  sources.forEach((s) => {
    const list = byVendor.get(s.vendor.vendorCode);
    if (list) list.push(s);
    else byVendor.set(s.vendor.vendorCode, [s]);
  });

  const offers = Array.from(byVendor.values()).map((list) => {
    const latest = list.reduce((best, s) =>
      new Date(s.date).getTime() > new Date(best.date).getTime() ? s : best,
    );
    const first = list[0]!;
    return {
      vendorCode: first.vendor.vendorCode,
      vendorName: first.vendor.vendorName,
      abbr: initials(first.vendor.vendorName),
      sources: list,
      availableQty: list.reduce((sum, s) => sum + s.availableQty, 0),
      lastDate: latest.date,
      unitPrice: latest.unitPrice,
      uom: latest.uom,
    };
  });

  // Vendors that still have stock to take back come first, then the most
  // recent delivery, which is what a return is usually raised against.
  offers.sort((a, b) => {
    const aOpen = a.availableQty > 0 ? 0 : 1;
    const bOpen = b.availableQty > 0 ? 0 : 1;
    if (aOpen !== bOpen) return aOpen - bOpen;
    return new Date(b.lastDate).getTime() - new Date(a.lastDate).getTime();
  });
  return offers;
}

/** Flattens the already-filtered vendor tree into groups led by whichever
 *  entity the user picked. The vendor tree is left untouched — this reads
 *  it and produces a second arrangement of the same rows. */
/** Every returnable line a single vendor can supply, flattened across all
 *  their orders. The vendor lens lists these in one table with PO and
 *  Receiving as columns, rather than splitting them across two tabs. */
/** Whether this exact row is selected. Selection is keyed by PO line, but a
 *  PO line can arrive on several receipts, so a row that names a receipt is
 *  only selected when that is the receipt the line was picked from. Without
 *  the second test, ticking one receipt checks every other receipt holding
 *  the same part. */
export function isSourceSelected(
  source: ItemSource,
  selectedItemIds: Set<string>,
  receiptByItem: Map<string, string>,
): boolean {
  if (!selectedItemIds.has(source.poItem.id)) return false;
  if (!source.grn) return true;
  const named = receiptByItem.get(source.poItem.id);
  return !named || named === source.grn.grnNumber;
}

export function buildVendorSources(vendor: Vendor): ItemSource[] {
  const sources: ItemSource[] = [];
  vendor.purchaseOrders.forEach((po) => {
    const poGRNs = vendor.receivingDocuments.filter((g) => g.poNumber === po.poNumber);
    po.items.forEach((poItem) => {
      const relatedGRNs = poGRNs.filter((g) => g.items.some((i) => i.sku === poItem.sku));
      sources.push(makeSource(vendor, po, poItem, undefined, relatedGRNs));
    });
  });
  return sources;
}

export function buildSourceGroups(
  vendors: Vendor[],
  groupBy: Exclude<SelectionGroupBy, 'vendor'>,
  sortKey: SortKey,
  sortDir: SortDir,
  lockedToVendorCode: string | null,
  /** Naming an item narrows the rows to that item, not merely the orders that
   *  happen to carry it. Without this an item search returned every line on
   *  every PO the item appeared on, which is a longer list than the one the
   *  user asked for and buries the thing they typed. */
  itemQuery = '',
): SourceGroup[] {
  const q = itemQuery.trim().toLowerCase();
  const matchesItem = (poItem: LineItem) =>
    !q ||
    poItem.sku.toLowerCase().includes(q) ||
    (poItem.description ?? '').toLowerCase().includes(q);
  const groups = new Map<string, SourceGroup>();

  const push = (
    key: string,
    seed: () => Pick<SourceGroup, 'key' | 'title' | 'subtitle' | 'uom'> & { image?: string },
    source: ItemSource,
  ) => {
    let group = groups.get(key);
    if (!group) {
      group = { ...seed(), sources: [], offers: [], vendorCount: 0, totalAvailable: 0 };
      groups.set(key, group);
    }
    group.sources.push(source);
  };

  vendors.forEach((vendor) => {
    vendor.purchaseOrders.forEach((po) => {
      const poGRNs = vendor.receivingDocuments.filter((g) => g.poNumber === po.poNumber);

      if (groupBy === 'receiver') {
        poGRNs.forEach((grn) => {
          grn.items.forEach((grnItem) => {
            // A receipt line with no matching PO line cannot be carried in
            // the payload, so it is not offered as a source.
            const poItem = po.items.find((i) => i.sku === grnItem.sku);
            if (!poItem) return;
            if (!matchesItem(poItem)) return;
            push(
              grn.grnNumber,
              () => ({
                key: grn.grnNumber,
                title: grn.grnNumber,
                subtitle: `${vendor.vendorName} · ${formatDate(grn.grnDate)}`,
                uom: grnItem.uom,
              }),
              makeSource(vendor, po, poItem, grn, poGRNs),
            );
          });
        });
        return;
      }

      po.items.forEach((poItem) => {
        if (!matchesItem(poItem)) return;
        const relatedGRNs = poGRNs.filter((g) => g.items.some((i) => i.sku === poItem.sku));
        const source = makeSource(vendor, po, poItem, undefined, relatedGRNs);

        // The PO lens leads with the order and lists its lines underneath,
        // so the group is the document and every row is one item on it.
        // The item lens inverts that: the part leads and the orders it can
        // be returned against are the rows.
        if (groupBy === 'po') {
          push(
            po.poNumber,
            () => ({
              key: po.poNumber,
              title: po.poNumber,
              subtitle: `${vendor.vendorName} · ${po.status} · ${formatDate(po.poDate)}`,
              uom: poItem.uom,
            }),
            source,
          );
          return;
        }

        push(
          poItem.sku,
          () => ({
            key: poItem.sku,
            title: poItem.sku,
            subtitle: poItem.description,
            ...(poItem.image ? { image: poItem.image } : {}),
            uom: poItem.uom,
          }),
          source,
        );
      });
    });
  });

  const compare = compareSources(sortKey, sortDir);
  const list = Array.from(groups.values());
  list.forEach((group) => {
    group.sources.sort(compare);

    if (groupBy === 'item') {
      const ranked = buildOffers(group.sources);
      const capped = ranked.slice(0, MAX_ROWS);
      // The selected vendor has to stay on screen even when it ranks below
      // the cap, or a vendor picked in another view would look unpicked
      // here. It takes the last slot rather than the first so choosing a
      // vendor never reshuffles the rows under the cursor.
      if (lockedToVendorCode && !capped.some((o) => o.vendorCode === lockedToVendorCode)) {
        const locked = ranked.find((o) => o.vendorCode === lockedToVendorCode);
        if (locked) capped[capped.length - 1] = locked;
      }
      group.offers = capped;
      group.offers.forEach((offer) => {
        offer.sources = offer.sources.sort(compare);
        offer.availableQty = offer.sources.reduce((sum, s) => sum + s.availableQty, 0);
      });
      // Counts describe what is on screen, not what was thrown away.
      group.sources = group.offers.flatMap((offer) => offer.sources);
    } else if (groupBy !== 'po') {
      group.sources = group.sources.slice(0, MAX_ROWS);
    }
    // The PO lens is exempt from the cap: the group IS the order, so its
    // rows are that order's lines and a hidden line 6 would misreport what
    // the PO holds. The cap earns its keep in the other lenses, where the
    // rows are competing sources and only the best few are worth ranking.

    group.vendorCount = new Set(group.sources.map((s) => s.vendor.vendorCode)).size;
    group.totalAvailable = group.sources.reduce((sum, s) => sum + s.availableQty, 0);
  });

  // Groups themselves stay alphabetical: the list is something to look a
  // known part number up in, so a stable position beats a ranked one.
  list.sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true }));
  return list;
}
