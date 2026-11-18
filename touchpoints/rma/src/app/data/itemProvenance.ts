/**
 * Where a unit in stock came from.
 *
 * The return flow used to ask the user for a vendor and then work out what
 * they could send back. That is the wrong way round for anything traceable: a
 * serialized unit or a lot that arrived on a receiver already knows its
 * vendor, its order and its delivery, and the goods have to go back where
 * they came from. Asking is both extra work and an invitation to get it wrong.
 *
 * So provenance is resolved from the unit, and the vendor is only a question
 * when the answer genuinely is not knowable:
 *
 *   received    a receiver exists  → vendor, PO and receiving are derived and
 *                                    locked; no choice is offered
 *   adjustment  stock was counted in, not received
 *   import      stock came from a migration
 *
 * The last two have no receiver to trace, so the user names the vendor. Non-
 * serialized stock is untraceable by nature -- one unit is any unit -- so it
 * asks too, but bounded: it can only go back to a vendor that actually shipped
 * it, and only up to what they shipped.
 */

import { mockVendors, type Vendor } from './mockVendors';
import {
  binsForItem,
  buildSerial,
  hasSerials,
  hashKey,
  trackingModeFor,
  type TrackingMode,
} from './itemTracking';

/** Re-exported: every screen that draws a control type already imports its
 *  label and its chip from here, so the type travels with them. */
export type { TrackingMode } from './itemTracking';

export type ProvenanceOrigin = 'received' | 'adjustment' | 'import';

/** One vendor's supply of an item: what they shipped and what is left to send
 *  back to them. The cap matters -- asking for 1,000 from a vendor that only
 *  ever shipped 200 is an impossible return, and the flow has to say so rather
 *  than let it through. */
export interface VendorSupply {
  vendorCode: string;
  vendorName: string;
  poNumbers: string[];
  receivings: string[];
  receivedQty: number;
  /** Received less what has already gone back. */
  returnableQty: number;
  uom: string;
  unitPrice: number;
  lastReceivedDate: string;
}

/** A traceable unit's paperwork. */
export interface UnitProvenance {
  origin: ProvenanceOrigin;
  vendorCode: string;
  vendorName: string;
  poNumber: string;
  grnNumber: string;
}

function hash(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return h;
}

/** Stock that entered without a receiver -- counted in, or migrated. Rare, and
 *  deterministic per item so a demo can be walked twice and behave the same. */
export function untracedStockFor(sku: string): { qty: number; origin: ProvenanceOrigin } | null {
  const h = hash(`untraced:${sku}`);
  if (h % 5 !== 0) return null;
  return { qty: (h % 12) + 3, origin: h % 10 === 0 ? 'import' : 'adjustment' };
}

/** Every vendor that has shipped this item, with what is still returnable to
 *  each. Built from the catalogue rather than from anything already on the
 *  return, so it answers "who can take this back" before a return exists. */
export function vendorsForItem(sku: string): VendorSupply[] {
  const out: VendorSupply[] = [];
  mockVendors.forEach((vendor: Vendor) => {
    let receivedQty = 0;
    let returnedQty = 0;
    let unitPrice = 0;
    let uom = '';
    let lastReceivedDate = '';
    const poNumbers = new Set<string>();
    const receivings = new Set<string>();

    vendor.receivingDocuments.forEach((grn) => {
      grn.items.forEach((line) => {
        if (line.sku !== sku) return;
        receivedQty += line.quantity;
        returnedQty += line.invoicedQty ?? 0;
        poNumbers.add(grn.poNumber);
        receivings.add(grn.grnNumber);
        uom ||= line.uom;
        if (!lastReceivedDate || new Date(grn.grnDate) > new Date(lastReceivedDate)) {
          lastReceivedDate = grn.grnDate;
        }
      });
    });
    if (receivedQty <= 0) return;

    const poLine = vendor.purchaseOrders
      .flatMap((po) => po.items)
      .find((i) => i.sku === sku);
    unitPrice = poLine?.unitPrice ?? 0;

    out.push({
      vendorCode: vendor.vendorCode,
      vendorName: vendor.vendorName,
      poNumbers: [...poNumbers],
      receivings: [...receivings],
      receivedQty,
      // Being billed for something does not stop it going back, so the cap is
      // what physically arrived, not what is still unbilled. Same rule the
      // create screen applies to a return line.
      returnableQty: receivedQty,
      uom: uom || 'EA',
      unitPrice,
      lastReceivedDate,
    });
  });
  // Most recent supplier first: what is being returned almost always came from
  // the latest delivery.
  return out.sort((a, b) => (b.lastReceivedDate ?? '').localeCompare(a.lastReceivedDate ?? ''));
}

/** One delivery of a part from one vendor: what a return can be tied to.
 *
 *  A counted part has no provenance -- one bolt is any bolt -- so the return
 *  cannot say which delivery a unit came off. What it can do is tie the return
 *  to deliveries that could have supplied it, and that tie is what a credit
 *  unwinds. No tie can be for more than its own delivery carried, and one
 *  return may span several. */
export interface ItemReceiver {
  grnNumber: string;
  poNumber: string;
  date: string;
  /** What this delivery brought in, which is the ceiling for its tie. */
  qty: number;
  uom: string;
  /** The vendor site it came from, so a return spanning several can say so. */
  originId: string;
}

/** That vendor's deliveries of that part, most recent first. */
export function receiversFor(sku: string, vendorCode: string): ItemReceiver[] {
  const vendor = mockVendors.find((v) => v.vendorCode === vendorCode);
  if (!vendor) return [];
  const out: ItemReceiver[] = [];
  vendor.receivingDocuments.forEach((grn) => {
    grn.items.forEach((line) => {
      if (line.sku !== sku || line.quantity <= 0) return;
      out.push({
        grnNumber: grn.grnNumber,
        poNumber: grn.poNumber,
        date: grn.grnDate,
        qty: line.quantity,
        uom: line.uom,
        originId: grn.originId,
      });
    });
  });
  // Newest first: a return is far more often off the last delivery than the
  // first, so that is what the ties open on.
  return out.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
}

/** What that vendor delivered of that part inside a recent window, so the
 *  candidate list can be judged on more than a lifetime total: a vendor who
 *  shipped a thousand of these years ago is a worse guess than one who shipped
 *  forty last month. */
export function receivedSince(sku: string, vendorCode: string, days: number): number {
  const receivers = receiversFor(sku, vendorCode);
  const newest = receivers[0]?.date;
  if (!newest) return 0;
  // The mock data is dated in the past, so the window is measured back from
  // the most recent delivery in it rather than from today, which would make
  // every figure zero.
  const cutoff = new Date(newest);
  cutoff.setDate(cutoff.getDate() - days);
  return receivers
    .filter((r) => new Date(r.date) >= cutoff)
    .reduce((n, r) => n + r.qty, 0);
}

/** Whether the flow has to ask who this goes back to.
 *
 *  A serialized or lot-controlled item that arrived on a receiver does not:
 *  naming the unit names the vendor. Everything else does. */
export function needsVendorChoice(sku: string): boolean {
  return trackingModeFor(sku) === 'none' || !!untracedStockFor(sku);
}

/** The receiver a named unit arrived on, and so the vendor it goes back to.
 *  Null when the unit was created rather than received. */
export function provenanceForSerial(sku: string, serial: string): UnitProvenance | null {
  for (const vendor of mockVendors) {
    for (const grn of vendor.receivingDocuments) {
      for (const line of grn.items) {
        if (line.sku !== sku) continue;
        // Serials are generated per PO line, so the pool that contains this
        // one names the line, and the line names the order and the delivery.
        const base = hashKey(`${sku}:${line.id}`);
        for (let i = 0; i < line.quantity; i++) {
          if (unitSerial(sku, base, i) !== serial) continue;
          return {
            origin: 'received',
            vendorCode: vendor.vendorCode,
            vendorName: vendor.vendorName,
            poNumber: grn.poNumber,
            grnNumber: grn.grnNumber,
          };
        }
      }
    }
  }
  return null;
}

/** The serial shape the pickers build, so a unit named here is the same unit
 *  named there. It was a second format for a while, which meant every serial
 *  the app actually shows resolved to no vendor and no delivery at all. */
function unitSerial(sku: string, base: number, index: number): string {
  return buildSerial(sku, base, index);
}

// ─── The item catalogue, seen from the returns side ────────────────────────
//
// Starting from the item means the first question is "what is going back",
// not "who is it going back to". So the picker needs the stock itself: every
// part that has ever been received, what is left to send back, and how it is
// tracked -- because a serialized part names its own vendor later and a
// non-serialized one will have to ask.

/** One returnable part, aggregated across every vendor that has shipped it. */
export interface ReturnableItem {
  sku: string;
  description: string;
  uom: string;
  image: string | undefined;
  trackingMode: TrackingMode;
  /** Total still returnable, summed over every vendor. */
  returnableQty: number;
  receivedQty: number;
  /** How many vendors have shipped it. Drives whether the vendor is a
   *  question at all -- one supplier is an answer, not a choice. */
  supplierCount: number;
  unitPrice: number;
  lastReceivedDate: string;
  /** Stock that arrived without a receiver, if any. */
  untraced: { qty: number; origin: ProvenanceOrigin } | null;
  /** What is on hand, per unit of measure it is held in.
   *
   *  Not one figure with conversions behind it. Two pallets and three sets are
   *  two different returns: the warehouse holds them as separate things, sends
   *  them back as separate things, and a single number in a single unit could
   *  not say which of them was going. Most items hold stock in one unit, so
   *  this is usually a list of one. */
  stock: ItemStock[];
}

/** On-hand stock in one unit of measure, and how much of it can actually go
 *  back. `qty` is what is in the building; `split.available` is the ceiling a
 *  return is held to. */
export interface ItemStock {
  uom: string;
  qty: number;
  split: StockSplit;
}

/**
 * Stock nobody shipped.
 *
 * Every other item in this catalogue is assembled from receipts, so a vendor
 * falls out of it: the goods arrived from someone, and the return goes back to
 * them. These did not arrive. They were counted in during a stocktake or came
 * across in the migration, and the inventory holds them with no receiver, no
 * order and no supplier behind them.
 *
 * They are returnable all the same -- a warehouse that finds forty of something
 * it cannot sell still sends them somewhere -- but who takes them back is a
 * commercial decision rather than a derived fact, and the flow has to ask
 * instead of stating an answer it does not have.
 */
const UNSOURCED_STOCK: {
  sku: string;
  description: string;
  uom: string;
  qty: number;
  unitPrice: number;
  origin: ProvenanceOrigin;
}[] = [
  {
    sku: 'MISC-BRG-88',
    description: 'Tapered Roller Bearing 88mm - found in stocktake, no receiver',
    uom: 'EA',
    qty: 46,
    unitPrice: 31.4,
    origin: 'adjustment',
  },
  {
    sku: 'MISC-VLV-12',
    description: 'Brass Gate Valve 1/2in - opening balance from migration',
    uom: 'EA',
    qty: 120,
    unitPrice: 18.75,
    origin: 'import',
  },
  {
    sku: 'MISC-GSKT-KIT',
    description: 'Gasket & Seal Kit, assorted - counted in, supplier unknown',
    uom: 'BOX',
    qty: 24,
    unitPrice: 62.0,
    origin: 'adjustment',
  },
];

/** Whether this part has no supplier at all, as opposed to several. */
export function isUnsourced(sku: string): boolean {
  return UNSOURCED_STOCK.some((i) => i.sku === sku);
}

/**
 * The other units a part is held in.
 *
 * Almost everything in a warehouse is held more than one way: loose and on a
 * pallet, sheets and bundles, drums and cans. None of them is a conversion of
 * the others -- nobody breaks a pallet down to make up a shortfall in singles
 * -- so each carries its own on-hand figure and goes back as its own return.
 *
 * Derived rather than listed, because a hand-written list of five items meant
 * that on almost every part searched there was no unit to choose and the
 * question looked like it had not been built.
 */
const PACK_UNITS: Record<string, string[]> = {
  EA: ['PAL', 'BOX'],
  SHT: ['BDL', 'PAL'],
  BOX: ['PAL'],
  PK: ['CTN'],
  RL: ['PAL'],
  FT: ['RL'],
  LBS: ['DRM'],
  KG: ['DRM'],
  SET: ['PAL'],
  PR: ['BOX'],
  GAL: ['DRM'],
  L: ['DRM'],
};

/** Numbered stock has one unit and no other.
 *
 *  Not because a serial means an each: a pallet or a truckload can carry one
 *  number. Because a serialized unit is indivisible, so there is nothing to
 *  convert it into and no second shelf to hold it on. Divisible stock -- plain
 *  and lot-counted -- is what has alternative units. */
function extraStockFor(sku: string, baseUom: string, baseQty: number, serialized: boolean): ItemStock[] {
  if (serialized) return [];
  const units = PACK_UNITS[baseUom] ?? [];
  if (units.length === 0) return [];
  const h = hash(`uom:${sku}`);
  // One extra unit on most parts, two on some, so the list is not uniform.
  const take = h % 5 === 0 ? Math.min(2, units.length) : 1;
  return units.slice(0, take).map((uom, i) => ({
    uom,
    // Its own figure, not the base divided by anything: these are separate
    // shelves and a pallet count has no arithmetic relationship to an each
    // count in the same building.
    // Unsigned shift: `>>` reads the hash as a signed int32, so any hash above
    // 2^31 came out negative, the multiplier went with it, and the shelf was
    // floored to a single pallet against eighteen hundred eaches.
    qty: Math.max(2, Math.round((baseQty * (0.02 + ((h >>> (i * 3)) % 7) * 0.01)) / (i + 1))),
  })).map((shelf) => ({ ...shelf, split: stockSplit(sku, shelf.qty) }));
}

let catalogueCache: ReturnableItem[] | null = null;

/** Every part with stock behind it, richest first. Built once -- the mock
 *  vendor set is static, and walking 40 vendors' receivers per keystroke is
 *  the kind of thing that makes a search feel broken. */
export function returnableItems(): ReturnableItem[] {
  if (catalogueCache) return catalogueCache;

  const byS = new Map<string, ReturnableItem>();
  mockVendors.forEach((vendor: Vendor) => {
    const suppliedHere = new Set<string>();
    vendor.receivingDocuments.forEach((grn) => {
      grn.items.forEach((line) => {
        const entry = byS.get(line.sku) ?? {
          sku: line.sku,
          description: line.description,
          uom: line.uom,
          image: line.image,
          trackingMode: trackingModeFor(line.sku),
          returnableQty: 0,
          receivedQty: 0,
          supplierCount: 0,
          unitPrice: line.unitPrice,
          lastReceivedDate: '',
          untraced: untracedStockFor(line.sku),
          // Filled once the totals are in: it is the same stock, said per unit.
          stock: [],
        };
        entry.receivedQty += line.quantity;
        entry.returnableQty += line.quantity;
        if (!entry.lastReceivedDate || new Date(grn.grnDate) > new Date(entry.lastReceivedDate)) {
          entry.lastReceivedDate = grn.grnDate;
        }
        entry.image ||= line.image;
        suppliedHere.add(line.sku);
        byS.set(line.sku, entry);
      });
    });
    suppliedHere.forEach((sku) => {
      const entry = byS.get(sku);
      if (entry) entry.supplierCount += 1;
    });
  });

  // Untraced stock is returnable too -- it just has no receiver behind it.
  byS.forEach((entry) => {
    if (entry.untraced) entry.returnableQty += entry.untraced.qty;
  });

  // And stock with no receiver at all. It is in the catalogue because it is in
  // the building; what it is missing is a supplier, not a quantity.
  UNSOURCED_STOCK.forEach((item) => {
    if (byS.has(item.sku)) return;
    byS.set(item.sku, {
      sku: item.sku,
      description: item.description,
      uom: item.uom,
      image: undefined,
      trackingMode: trackingModeFor(item.sku),
      returnableQty: item.qty,
      receivedQty: 0,
      supplierCount: 0,
      unitPrice: item.unitPrice,
      lastReceivedDate: '',
      untraced: { qty: item.qty, origin: item.origin },
      stock: [],
    });
  });

  // The base unit first, so the row opens on the one the item is normally
  // counted in, then whatever else it is held in.
  byS.forEach((entry) => {
    entry.stock = [
      { uom: entry.uom, qty: entry.returnableQty },
      ...extraStockFor(entry.sku, entry.uom, entry.returnableQty, hasSerials(entry.trackingMode)),
    ].map((shelf) => ({ ...shelf, split: stockSplit(entry.sku, shelf.qty) }));
  });

  catalogueCache = [...byS.values()].sort((a, b) => b.returnableQty - a.returnableQty);
  return catalogueCache;
}

/** Free-text match over part number and description, so "aluminum" finds the
 *  extrusion without the user knowing the code. */
/** What a search looks through on one item.
 *
 *  The part number, what it is, and what it is controlled by. The control
 *  type is on the chip beside every part, so it is a word people type:
 *  "serialized" for what carries unit numbers, "lot" for what comes in
 *  batches. Written both ways, hyphen and space, so "non serialized" and
 *  "non-serialized" both land. */
export function itemSearchText(item: {
  sku: string;
  description: string;
  trackingMode: TrackingMode;
}): string {
  const name = TRACKING_NAMES[item.trackingMode];
  return `${item.sku} ${item.description} ${name} ${name.replace(/-/g, ' ')}`.toLowerCase();
}

export function searchReturnableItems(query: string): ReturnableItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  // Every word has to land somewhere, so "steel sheet" is narrower than
  // "steel", which is how a search is expected to behave.
  const words = q.split(/\s+/);
  return returnableItems().filter((item) => {
    const hay = itemSearchText(item);
    return words.every((w) => hay.includes(w));
  });
}

/** The handful shown before anything is typed, so the picker opens with
 *  something to act on rather than a bare field. */
export function recentReturnableItems(limit = 6): ReturnableItem[] {
  return [...returnableItems()]
    .sort((a, b) => (b.lastReceivedDate ?? '').localeCompare(a.lastReceivedDate ?? ''))
    .slice(0, limit);
}

/** What a control type is called, in the master's words.
 *
 *  A lot-controlled part reads as two facts rather than one phrase: it is
 *  lot-controlled, and its units are numbered or they are not. `TrackingTag`
 *  draws it that way, a LOT segment joined to the serialization; this is the
 *  serialization half, and the whole label for a part that is not in a lot. */
export const TRACKING_LABELS: Record<TrackingMode, string> = {
  serialized: 'Serialized',
  lot: 'Non-Serialized',
  'lot-serialized': 'Serialized',
  none: 'Non-Serialized',
};

/** The full name, for a sentence or an aria-label, where a two-part tag
 *  cannot be drawn. */
export const TRACKING_NAMES: Record<TrackingMode, string> = {
  serialized: 'Serialized',
  lot: 'LOT Non-Serialized',
  'lot-serialized': 'LOT Serialized',
  none: 'Non-Serialized',
};

/** Serial and lot carry their own paperwork, so they read as resolved; plain
 *  stock does not, so it reads as neutral rather than as a warning. */
export const TRACKING_CHIP: Record<TrackingMode, string> = {
  serialized: 'bg-blue-50 border-blue-200 text-blue-700',
  lot: 'bg-violet-50 border-violet-200 text-violet-700',
  'lot-serialized': 'bg-violet-50 border-violet-200 text-violet-700',
  none: 'bg-slate-100 border-slate-200 text-slate-600',
};

// ─── What stock is free to go back ─────────────────────────────────────────
//
// On hand is not returnable. Three states sit between the two, and they are
// not the same kind of fact:
//
//   allocated    committed to a job or a sales order. NOT returnable, and not
//                negotiable here: releasing it reschedules the job, notifies
//                the customer and resolves the conflict it creates, which is
//                the allocation engine's work and not a return's. The flow
//                states it and stops.
//   quarantined  held while somebody calls the vendor. This is the normal way
//                a return starts, so it goes back, with a word about it.
//   checked out  out with somebody. Same treatment as quarantine.
//
// So availability is `on hand less allocated`, and the other two are warnings
// carried inside it.

export type StockState = 'available' | 'allocated' | 'quarantined' | 'checked-out';

export const STOCK_STATE_LABEL: Record<StockState, string> = {
  available: 'Available',
  allocated: 'Allocated',
  quarantined: 'Quarantined',
  'checked-out': 'Checked out',
};

export interface StockSplit {
  onHand: number;
  /** On hand less what is allocated. The ceiling on a return. */
  available: number;
  /** Committed elsewhere. The hard block. */
  allocated: number;
  /** Inside `available`, and warned about. */
  quarantined: number;
  checkedOut: number;
  /** Set on a return to one vendor: what that vendor delivered, which caps
   *  `available`. Another vendor's boxes are not this one's to take back. */
  receivedFromVendor?: number | undefined;
}

/** How much of one part is spoken for, as shares of what is on hand.
 *
 *  Stable on the part, so the same item behaves the same way every time it is
 *  opened, and spread across the catalogue so every case is reachable: a few
 *  parts entirely allocated, about half partly, quarantine and check-out on
 *  their own cycles. */
function stockProfile(sku: string): {
  fully: boolean;
  allocated: number;
  quarantined: number;
  checkedOut: number;
} {
  const h = hash(`stock:${sku}`);
  return {
    fully: h % 17 === 0,
    allocated: h % 2 === 0 ? ((h >>> 2) % 45) / 100 : 0,
    quarantined: (h >>> 5) % 3 === 0 ? ((h >>> 7) % 18) / 100 : 0,
    checkedOut: (h >>> 9) % 4 === 0 ? ((h >>> 11) % 12) / 100 : 0,
  };
}

/** The split of one quantity of one part: what is free, what is blocked, and
 *  what is free but worth saying out loud. */
export function stockSplit(sku: string, onHand: number): StockSplit {
  const whole = Math.max(0, Math.round(onHand * 100) / 100);
  if (whole <= 0) {
    return { onHand: 0, available: 0, allocated: 0, quarantined: 0, checkedOut: 0 };
  }
  const p = stockProfile(sku);
  // Whole units where the shelf is whole. "448.14 FT allocated" is a figure
  // no warehouse would write down.
  const round = (n: number) =>
    Number.isInteger(whole) ? Math.round(n) : Math.round(n * 100) / 100;
  const allocated = p.fully ? whole : round(whole * p.allocated);
  const available = round(whole - allocated);
  const quarantined = round(available * p.quarantined);
  const checkedOut = round(available * p.checkedOut);
  return { onHand: whole, available, allocated, quarantined, checkedOut };
}

/** Where every unit of a serialized pool stands.
 *
 *  Counted from the same split the quantities use, so the chips in the picker
 *  and the figure on the line can never disagree, and scattered through the
 *  pool rather than taken off the front: allocated stock is not the first
 *  forty units on a shelf. */
export function unitStatesFor(sku: string, serials: string[]): Map<string, StockState> {
  const out = new Map<string, StockState>();
  const split = stockSplit(sku, serials.length);
  const order = serials
    .map((serial, i) => ({ serial, at: (hash(`${sku}:${serial}:state`) + i) >>> 0 }))
    .sort((a, b) => a.at - b.at);
  const take = (n: number, state: StockState) => {
    for (let i = 0; i < n && order.length > 0; i++) {
      const next = order.pop();
      if (next) out.set(next.serial, state);
    }
  };
  take(Math.round(split.allocated), 'allocated');
  take(Math.round(split.quarantined), 'quarantined');
  take(Math.round(split.checkedOut), 'checked-out');
  serials.forEach((serial) => {
    if (!out.has(serial)) out.set(serial, 'available');
  });
  return out;
}

// ─── Lots, and the receipts that brought them in ───────────────────────────
//
// The count planner nests a lot into the locations it is held at, and asks for
// a quantity (or a list of units) against each one. A return has no locations
// to visit -- the goods are going out, not being walked to -- but it has the
// same second level, and it is the one this flow already turns on: the
// receiving documents the batch arrived on. So a lot here opens onto its
// receipts, each with what that delivery brought in of it.

export interface LotReceipt {
  grnNumber: string;
  poNumber: string;
  date: string;
  vendorCode: string;
  vendorName: string;
  /** What this delivery brought in under this lot. The ceiling on its row. */
  qty: number;
}

export interface LotBlock {
  lot: string;
  expiry: string;
  /** Where the batch is held. One of the part's own bins, handed out in turn
   *  so a part's lots sit in different places rather than hashing into one. */
  bin: string;
  /** What every receipt under it adds up to. */
  totalQty: number;
  receipts: LotReceipt[];
}

/** Every delivery of a part, whoever sent it, in one unit. The vendor step's
 *  `allDeliveries` without the screen around it. */
function deliveriesOf(sku: string, uom: string) {
  return mockVendors
    .flatMap((v) =>
      receiversFor(sku, v.vendorCode)
        .filter((r) => r.uom === uom)
        .map((r) => ({ ...r, vendorCode: v.vendorCode, vendorName: v.vendorName })),
    )
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
}

/**
 * The batches a part is held in, and which deliveries brought each one.
 *
 * Two or three lots per part, stable on the part, and every delivery's
 * quantity split across them. The split is deterministic on the document
 * number, so a lot opened twice shows the same receipts carrying the same
 * amounts, and every lot's total is the sum of its rows rather than a figure
 * invented beside them.
 */
export function lotBlocksFor(sku: string, uom: string): LotBlock[] {
  const deliveries = deliveriesOf(sku, uom);
  if (deliveries.length === 0) return [];

  const base = hash(`lots:${sku}`);
  const bins = binsForItem(sku);

  // A batch belongs to one supplier.
  //
  // It used to be built the other way round -- lots first, then every
  // delivery dropped into one by hash -- which put four vendors' goods in a
  // single batch and forced the pickers to refuse a lot one unit at a time.
  // That is not what a lot is. Goods arrive as a batch from a supplier and
  // are held as that batch, so the vendor is a fact about the whole lot, and
  // a return either can take it or cannot.
  const byVendor = new Map<string, typeof deliveries>();
  deliveries.forEach((d) => {
    const held = byVendor.get(d.vendorCode);
    if (held) held.push(d);
    else byVendor.set(d.vendorCode, [d]);
  });

  const out: LotBlock[] = [];
  let index = 0;
  for (const [vendorCode, theirs] of byVendor) {
    // One batch per supplier usually, two where they have shipped enough to
    // have been booked in twice.
    const seed = hash(`${sku}:${vendorCode}:lots`);
    const lotCount = theirs.length > 2 && seed % 3 === 0 ? 2 : 1;
    const lots = Array.from({ length: lotCount }, (_, i) => {
      const code = ((seed + i * 977) * 131).toString(36).toUpperCase().slice(-4);
      const day = 1 + ((base + index + i * 31) % 28);
      const month = 1 + ((base + index + i * 7) % 12);
      const year = 2027 + ((base + index + i) % 2);
      index += 1;
      return {
        lot: `LOT-${sku.slice(0, 3)}-${code}`,
        expiry: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        bin: bins[(index + i) % bins.length]!,
        receipts: [] as LotReceipt[],
      };
    });

    theirs.forEach((d) => {
      const at = lots.length === 1 ? 0 : hash(`${sku}:${d.grnNumber}:lot`) % lots.length;
      if (d.qty <= 0) return;
      lots[at]!.receipts.push({
        grnNumber: d.grnNumber,
        poNumber: d.poNumber,
        date: d.date,
        vendorCode: d.vendorCode,
        vendorName: d.vendorName,
        qty: d.qty,
      });
    });

    lots
      .filter((l) => l.receipts.length > 0)
      .forEach((l) =>
        out.push({
          lot: l.lot,
          expiry: l.expiry,
          bin: l.bin,
          totalQty: Math.round(l.receipts.reduce((n, r) => n + r.qty, 0) * 100) / 100,
          receipts: l.receipts,
        }),
      );
  }

  return out;
}

/** The supplier a batch came in from. One batch, one vendor: it is the
 *  question the pickers ask of a lot, rather than of every unit inside it. */
export function lotVendorFor(block: LotBlock): { vendorCode: string; vendorName: string } | null {
  const first = block.receipts[0];
  return first ? { vendorCode: first.vendorCode, vendorName: first.vendorName } : null;
}

export interface LotUnit {
  serial: string;
  lot: string;
  expiry: string;
  grnNumber: string;
  poNumber: string;
  date: string;
  vendorCode: string;
  vendorName: string;
}

/** Every unit of a lot-serialized part, in lot order, each carrying the
 *  delivery it came in on. The pool the step 2 picker lists and the pool the
 *  later steps read a vendor and a receipt off. */
export function lotUnitPool(sku: string, uom: string): LotUnit[] {
  const out: LotUnit[] = [];
  lotBlocksFor(sku, uom).forEach((block) => {
    block.receipts.forEach((r) => {
      lotUnitsFor(sku, block.lot, r.grnNumber, r.qty).forEach((serial) => {
        out.push({
          serial,
          lot: block.lot,
          expiry: block.expiry,
          grnNumber: r.grnNumber,
          poNumber: r.poNumber,
          date: r.date,
          vendorCode: r.vendorCode,
          vendorName: r.vendorName,
        });
      });
    });
  });
  return out;
}

/** The units of one batch, for the section the picker draws under it. */
export function lotUnitsInLot(sku: string, uom: string, lot: string): LotUnit[] {
  return lotUnitPool(sku, uom).filter((u) => u.lot === lot);
}

/** The unit numbers inside one batch on one delivery.
 *
 *  A lot-serialized part is numbered within its batch, so the pool is scoped
 *  to the pair rather than to the part: the same twelve units come back for
 *  the same lot on the same document, every time it is opened. */
export function lotUnitsFor(sku: string, lot: string, grnNumber: string, qty: number): string[] {
  const n = Math.max(0, Math.floor(qty));
  const base = hash(`${sku}:${lot}:${grnNumber}`);
  const code = lot.split('-').pop();
  // The document's own digits and the unit's place in it are both in the
  // number. A hash alone collided across two deliveries of the same batch,
  // and two units with one number are one unit as far as a picked set is
  // concerned: ticking the second untucked the first.
  const doc = grnNumber.replace(/\D/g, '').slice(-4).padStart(4, '0');
  return Array.from({ length: n }, (_, i) => {
    const body = ((base + i * 2654435761) >>> 0).toString(36).toUpperCase().padStart(4, '0').slice(-4);
    return `${code}-${doc}-${body}${(i + 1).toString(36).toUpperCase()}`;
  });
}

// ─── The other way in: start from the vendor ───────────────────────────────
//
// Some returns begin with the partner rather than the part -- a quarterly
// clear-out, a recall, a vendor being wound down. The question then is not
// "who takes this back" (that is already answered) but "what of theirs do we
// still hold", and the answer can run to hundreds of lines, so it has to be a
// searchable grid rather than a list to scroll.

/** One part this vendor supplied, and what is left to send back to them. */
export interface VendorItem {
  sku: string;
  description: string;
  uom: string;
  image: string | undefined;
  trackingMode: TrackingMode;
  returnableQty: number;
  poNumbers: string[];
  receivings: string[];
  unitPrice: number;
  lastReceivedDate: string;
}

/** A vendor as the picker needs to show them: who they are and how much of
 *  theirs is still on the shelf. */
export interface VendorSummary {
  vendorCode: string;
  vendorName: string;
  category: string;
  imageUrl: string | undefined;
  itemCount: number;
  returnableQty: number;
  lastReceivedDate: string;
}

const vendorItemCache = new Map<string, VendorItem[]>();

/** Everything this vendor has delivered, richest first. */
export function itemsForVendor(vendorCode: string): VendorItem[] {
  const cached = vendorItemCache.get(vendorCode);
  if (cached) return cached;

  const vendor = mockVendors.find((v) => v.vendorCode === vendorCode);
  if (!vendor) return [];

  const bySku = new Map<string, VendorItem>();
  vendor.receivingDocuments.forEach((grn) => {
    grn.items.forEach((line) => {
      const entry = bySku.get(line.sku) ?? {
        sku: line.sku,
        description: line.description,
        uom: line.uom,
        image: line.image,
        trackingMode: trackingModeFor(line.sku),
        returnableQty: 0,
        poNumbers: [],
        receivings: [],
        unitPrice: line.unitPrice,
        lastReceivedDate: '',
      };
      // A return is capped by what physically arrived -- being billed for
      // something does not stop it going back.
      entry.returnableQty += line.quantity;
      if (!entry.poNumbers.includes(grn.poNumber)) entry.poNumbers.push(grn.poNumber);
      if (!entry.receivings.includes(grn.grnNumber)) entry.receivings.push(grn.grnNumber);
      if (!entry.lastReceivedDate || new Date(grn.grnDate) > new Date(entry.lastReceivedDate)) {
        entry.lastReceivedDate = grn.grnDate;
      }
      entry.image ||= line.image;
      bySku.set(line.sku, entry);
    });
  });

  const out = [...bySku.values()].sort((a, b) => b.returnableQty - a.returnableQty);
  vendorItemCache.set(vendorCode, out);
  return out;
}

let vendorSummaryCache: VendorSummary[] | null = null;

/** Every vendor with stock behind them. */
export function vendorSummaries(): VendorSummary[] {
  if (vendorSummaryCache) return vendorSummaryCache;
  vendorSummaryCache = mockVendors
    .map((vendor) => {
      const items = itemsForVendor(vendor.vendorCode);
      return {
        vendorCode: vendor.vendorCode,
        vendorName: vendor.vendorName,
        category: vendor.category,
        imageUrl: vendor.imageUrl,
        itemCount: items.length,
        returnableQty: items.reduce((n, i) => n + i.returnableQty, 0),
        lastReceivedDate: items.reduce(
          (latest, i) => (i.lastReceivedDate > latest ? i.lastReceivedDate : latest),
          '',
        ),
      };
    })
    .filter((v) => v.itemCount > 0)
    .sort((a, b) => (b.lastReceivedDate ?? '').localeCompare(a.lastReceivedDate ?? ''));
  return vendorSummaryCache;
}

/** Free-text match over a vendor's own catalogue. */
export function searchVendorItems(vendorCode: string, query: string): VendorItem[] {
  const all = itemsForVendor(vendorCode);
  const q = query.trim().toLowerCase();
  if (!q) return all;
  const words = q.split(/\s+/);
  return all.filter((item) => {
    const hay = `${item.sku} ${item.description}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}

/** Stock that no receiver stands behind, matched against the search. */
export interface UnlinkedStock {
  sku: string;
  description: string;
  uom: string;
  image: string | undefined;
  trackingMode: TrackingMode;
  /** Only the untraced pool -- what arrived on a receiver is not this. */
  qty: number;
  origin: ProvenanceOrigin;
  unitPrice: number;
}

/**
 * Stock with no receiver behind it, matching the search.
 *
 * Off by default, because a return normally goes back where the goods came
 * from and offering everything else invites the wrong answer. It exists
 * because some stock genuinely has no delivery behind it -- counted in during
 * an adjustment, carried over by a migration -- and no amount of looking at
 * the paperwork will produce a vendor for it. Attaching one is a commercial
 * decision, so nothing reverses on its own and the value is entered by hand.
 *
 * Note this is not "parts this vendor never shipped": those have a receiver,
 * just someone else's, and belong on that vendor's return instead.
 */
export function unlinkedItemsMatching(_vendorCode: string, query: string): UnlinkedStock[] {
  return searchReturnableItems(query).flatMap((item) => {
    if (!item.untraced) return [];
    return [
      {
        sku: item.sku,
        description: item.description,
        uom: item.uom,
        image: item.image,
        trackingMode: item.trackingMode,
        qty: item.untraced.qty,
        origin: item.untraced.origin,
        unitPrice: item.unitPrice,
      },
    ];
  });
}

export const ORIGIN_LABELS: Record<ProvenanceOrigin, string> = {
  received: 'Received',
  adjustment: 'Counted in by adjustment',
  import: 'Carried over by migration',
};
