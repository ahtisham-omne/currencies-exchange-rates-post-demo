/**
 * Turning an item-first selection into something the create screen can render.
 *
 * The create screen was built for a vendor-first world: it takes purchase
 * orders and lays their lines out. Starting from the item means there is no
 * order yet -- the part is known, the vendor is not -- so each picked part
 * becomes one line carrying everything that is true at this point (what it is,
 * how much of it exists to send back, how it is tracked) and nothing that
 * isn't (who takes it back).
 *
 * The vendor supplies ride along on the line so the next step can offer the
 * choice, capped per vendor, without going back to the catalogue.
 */

import type { SelectedPOData } from '@/app/components/VendorSelectionModalNested';
import { mockVendors, type LineItem, type VendorGRN } from '@/app/data/mockVendors';
import { trackingModeFor } from '@/app/data/mockRMAs';
import { itemsForVendor, returnableItems, vendorsForItem, type VendorSupply } from '@/app/data/itemProvenance';

/** What the by-item start adds to a selection the create screen already
 *  understands. Optional throughout, so a vendor-first selection is unchanged. */
export interface ItemFirstSelection extends SelectedPOData {
  /** True while the vendor is still a question. Step 2 asks; step 1 must not. */
  vendorUnresolved?: boolean;
  /** Every vendor that could take this part back, with its own cap. */
  supplies?: VendorSupply[];
}

/** A part with exactly one supplier has no vendor question -- the answer is
 *  already the only answer. Anything else waits for the vendor step. */
/** A part and how much of it is going back, as picked. */
export interface ItemPick {
  sku: string;
  /** What the user typed in the picker. Zero means they left it for step 1. */
  qty: number;
  /** Which unit of measure the figure is in. Absent means the item's base
   *  unit, which is what a single-unit part has and all the older callers
   *  assume. */
  uom?: string;
}

const asPicks = (input: string[] | ItemPick[]): ItemPick[] =>
  input.map((entry) => (typeof entry === 'string' ? { sku: entry, qty: 0 } : entry));

/** The unit a pick is in, and how much of it is on the shelf in that unit.
 *  A part held as pallets and singles has a figure for each, and the return
 *  is bounded by the one it was entered against. */
function shelf(item: { uom: string; returnableQty: number; stock?: { uom: string; qty: number }[] }, uom?: string) {
  if (!uom || uom === item.uom) return { uom: item.uom, qty: item.returnableQty };
  const found = item.stock?.find((s) => s.uom === uom);
  return found ? { uom: found.uom, qty: found.qty } : { uom: item.uom, qty: item.returnableQty };
}

export function selectionFromItems(input: string[] | ItemPick[]): ItemFirstSelection[] {
  const catalogue = new Map(returnableItems().map((i) => [i.sku, i]));

  return asPicks(input).flatMap(({ sku, qty, uom }): ItemFirstSelection[] => {
    const item = catalogue.get(sku);
    if (!item) return [];
    const supplies = vendorsForItem(sku);
    const primary = supplies[0];

    // Stock nobody shipped. Dropping it here is why picking one of these parts
    // looked like nothing happened: the search added it, the bridge returned no
    // entry, and the line never existed. It has a quantity and no supplier, so
    // it goes on the return with the vendor left open for the second step to
    // ask about.
    if (!primary) {
      const shelved = shelf(item, uom);
      const line: LineItem = {
        id: `item-${sku}-${shelved.uom}`,
        sku,
        description: item.description,
        quantity: shelved.qty,
        uom: shelved.uom,
        unitPrice: item.unitPrice,
        totalPrice: item.unitPrice * shelved.qty,
        receivedQty: shelved.qty,
        invoicedQty: 0,
        ...(item.image ? { image: item.image } : {}),
        trackingMode: trackingModeFor(sku),
        ...(qty > 0 ? { customInvoiceQty: Math.min(qty, shelved.qty) } : {}),
        // No receiver stands behind it, which is the whole reason the vendor is
        // a question. The flow has to keep that rather than dress it up as a
        // normal return line.
        unlinked: true,
        ...(item.untraced ? { unlinkedOrigin: item.untraced.origin } : {}),
      };
      return [
        {
          vendorCode: '',
          vendorName: '',
          vendorCategory: '',
          currency: 'USD',
          paymentTerms: '',
          poNumber: `Unsourced · ${sku}`,
          poDate: '',
          poAmount: 0,
          poStatus: 'Received',
          originId: '',
          originName: '',
          itemCount: 1,
          isPreInvoice: false,
          relatedGRNs: [],
          items: [line],
          selectedItemIds: [line.id],
          vendorUnresolved: true,
          supplies: [],
        },
      ];
    }

    const shelved = shelf(item, uom);
    const resolved = supplies.length === 1;
    const vendor = mockVendors.find((v) => v.vendorCode === primary.vendorCode);
    const poNumber = primary.poNumbers[0] ?? '';
    const po = vendor?.purchaseOrders.find((p) => p.poNumber === poNumber);
    // The catalogue line is the truthful source for description, price and
    // image; only the quantity is ours, because it spans every supplier.
    const source = po?.items.find((i) => i.sku === sku);

    const line: LineItem = {
      // Keyed by the part, not by the purchase-order line it was found on.
      // Two parts can share a vendor and a PO, and the create screen merges
      // selections onto one entry per PO number, deduping items by id -- and
      // these mock PO line ids repeat across a vendor's orders. So adding a
      // third part silently deleted the first: same id, treated as already
      // present. The part number cannot collide with itself.
      // Keyed by part AND unit. A part can come back on two lines, in two
      // units, from two vendors: some suppliers ship by the each and some by
      // the box. Keyed by the part alone the second line was read as already
      // present and never arrived.
      id: `item-${sku}-${shelved.uom}`,
      sku,
      description: item.description,
      // In the unit the figure was entered against, with that unit's own shelf
      // as the ceiling. A part held as pallets and singles has two shelves and
      // the return belongs to one of them.
      quantity: shelved.qty,
      uom: shelved.uom,
      unitPrice: source?.unitPrice ?? item.unitPrice,
      totalPrice: (source?.unitPrice ?? item.unitPrice) * shelved.qty,
      receivedQty: shelved.qty,
      // Nothing has gone back yet on a return being drafted, and leaving the
      // received figure net of prior invoicing would understate the cap.
      invoicedQty: 0,
      ...(source?.image ?? item.image ? { image: (source?.image ?? item.image)! } : {}),
      trackingMode: trackingModeFor(sku),
      // The figure the user already typed. The create screen reads this as the
      // line's starting quantity and, because it is set, stops folding later
      // receipts into it -- an item-first line spans every receiver carrying
      // the part, and forty of them adding their remainder back would bury
      // what was asked for.
      ...(qty > 0 ? { customInvoiceQty: Math.min(qty, shelved.qty) } : {}),
    };

    // Every receiver carrying this part, whoever shipped it. The create screen
    // builds the line's capacity from these, and the cap on an item-first line
    // is everything that arrived -- the vendor split comes after, not before.
    //
    // Except when the return is being made in a unit the receipts are not in.
    // A receiver records eaches; a pallet going back is not one of its lines,
    // and letting the screen rebuild the line from those receipts overwrote the
    // chosen unit with theirs -- two pallets arrived at the second step as two
    // eaches. So a non-base unit carries no receivers, and its vendor is asked
    // for rather than derived, which is what happens to untraceable stock
    // everywhere else in this flow.
    const baseUnit = shelved.uom === item.uom;
    const relatedGRNs: VendorGRN[] = !baseUnit ? [] : mockVendors
      .flatMap((v) => v.receivingDocuments.filter((grn) => grn.items.some((i) => i.sku === sku)))
      // Newest first. A named unit takes its vendor from the receipt its serial
      // falls in, and the serials are laid out in this order, so leaving it as
      // vendor order meant the first units on every return belonged to whoever
      // happened to sit earliest in the vendor list rather than to whoever
      // shipped last. Returns come off the latest delivery far more often than
      // not, which is the same rule the supplier ranking already follows.
      //
      // Round-robining suppliers instead was tried, to put two branches in the
      // first handful of units. It does not work: one receipt carries dozens of
      // units, so the first two picked sit inside it either way, and it cost
      // the newest-first rule for nothing.
      .sort((a, b) => (b.grnDate ?? '').localeCompare(a.grnDate ?? ''));

    return [
      {
        vendorCode: resolved ? primary.vendorCode : '',
        vendorName: resolved ? primary.vendorName : '',
        vendorCategory: vendor?.category ?? '',
        currency: vendor?.currency ?? 'USD',
        paymentTerms: vendor?.paymentTerms ?? '',
        poNumber,
        poDate: po?.poDate ?? primary.lastReceivedDate,
        poAmount: po?.poAmount ?? 0,
        poStatus: po?.status ?? 'Received',
        originId: po?.originId ?? primary.vendorCode,
        originName: vendor?.vendorName ?? '',
        itemCount: 1,
        isPreInvoice: false,
        relatedGRNs,
        items: [line],
        selectedItemIds: [line.id],
        ...(resolved && baseUnit ? {} : { vendorUnresolved: true }),
        supplies,
      },
    ];
  });
}

/**
 * The same translation for a return that started from the vendor.
 *
 * Here the vendor is the premise rather than the conclusion, so every line
 * arrives resolved: the paperwork is that vendor's own orders and receivers,
 * and nothing on the later steps has to ask again. The exception is stock
 * attached by hand -- no receiver ties it to them, so it carries no order and
 * no reversal, and the flow has to keep that distinction rather than dress it
 * up as a normal return line.
 */
export function selectionFromVendorItems(
  vendorCode: string,
  input: string[] | ItemPick[],
  unlinkedInput: string[] | ItemPick[] = [],
): ItemFirstSelection[] {
  const vendor = mockVendors.find((v) => v.vendorCode === vendorCode);
  if (!vendor) return [];
  const theirs = new Map(itemsForVendor(vendorCode).map((i) => [i.sku, i]));
  const catalogue = new Map(returnableItems().map((i) => [i.sku, i]));

  // One entry per purchase order, so a vendor's lines keep the order they were
  // actually raised against rather than being flattened onto one.
  const byPO = new Map<string, ItemFirstSelection>();

  const put = (poNumber: string, line: LineItem, relatedGRNs: VendorGRN[], unlinked: boolean) => {
    const po = vendor.purchaseOrders.find((p) => p.poNumber === poNumber);
    const existing = byPO.get(poNumber);
    if (existing) {
      existing.items.push(line);
      existing.selectedItemIds.push(line.id);
      existing.itemCount = existing.items.length;
      relatedGRNs.forEach((grn) => {
        if (!existing.relatedGRNs.some((g) => g.grnNumber === grn.grnNumber)) {
          existing.relatedGRNs.push(grn);
        }
      });
      return;
    }
    byPO.set(poNumber, {
      vendorCode: vendor.vendorCode,
      vendorName: vendor.vendorName,
      vendorCategory: vendor.category,
      currency: vendor.currency,
      paymentTerms: vendor.paymentTerms,
      poNumber,
      poDate: po?.poDate ?? '',
      poAmount: po?.poAmount ?? 0,
      poStatus: po?.status ?? 'Received',
      originId: po?.originId ?? vendor.vendorCode,
      originName: vendor.vendorName,
      itemCount: 1,
      isPreInvoice: false,
      relatedGRNs,
      items: [line],
      selectedItemIds: [line.id],
      // Hand-attached stock has no receiver behind it, so the vendor is a
      // commercial decision rather than a derived fact -- the later steps need
      // to know which of the two they are looking at.
      ...(unlinked ? { vendorUnresolved: true } : {}),
      supplies: vendorsForItem(line.sku),
    });
  };

  asPicks(input).forEach(({ sku, qty }) => {
    const item = theirs.get(sku);
    if (!item) return;
    const poNumber = item.poNumbers[0] ?? '';
    const source = vendor.purchaseOrders.flatMap((p) => p.items).find((i) => i.sku === sku);
    const unitPrice = source?.unitPrice ?? item.unitPrice;
    put(
      poNumber,
      {
        id: source?.id ?? `vendor-${vendorCode}-${sku}`,
        sku,
        description: item.description,
        quantity: item.returnableQty,
        uom: item.uom,
        unitPrice,
        totalPrice: unitPrice * item.returnableQty,
        receivedQty: item.returnableQty,
        invoicedQty: 0,
        ...(source?.image ?? item.image ? { image: (source?.image ?? item.image)! } : {}),
        trackingMode: trackingModeFor(sku),
        ...(qty > 0 ? { customInvoiceQty: Math.min(qty, item.returnableQty) } : {}),
      },
      vendor.receivingDocuments.filter((grn) => grn.items.some((i) => i.sku === sku)),
      false,
    );
  });

  // Everything attached by hand shares one pseudo-order: there is no real one,
  // and inventing a different placeholder per line would read as paperwork
  // that exists.
  asPicks(unlinkedInput).forEach(({ sku, qty: picked }) => {
    const item = catalogue.get(sku);
    // Only the pool with no receiver behind it goes back this way. What did
    // arrive on a delivery is a normal return line against whoever shipped it.
    const qty = item?.untraced?.qty ?? 0;
    if (!item || qty <= 0) return;
    put(
      `Unlinked · ${vendor.vendorName}`,
      {
        id: `unlinked-${vendorCode}-${sku}`,
        sku,
        description: item.description,
        quantity: qty,
        uom: item.uom,
        unitPrice: item.unitPrice,
        totalPrice: item.unitPrice * qty,
        receivedQty: qty,
        invoicedQty: 0,
        ...(item.image ? { image: item.image } : {}),
        trackingMode: trackingModeFor(sku),
        ...(picked > 0 ? { customInvoiceQty: Math.min(picked, qty) } : {}),
        unlinked: true,
        unlinkedOrigin: item.untraced?.origin,
      },
      [],
      true,
    );
  });

  return [...byPO.values()];
}
