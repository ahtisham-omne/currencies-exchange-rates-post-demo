/**
 * The shipments a return goes out on, and what "shipped" means for it.
 *
 * ERP-8637 AC9: Shipped to Vendor means every shipment on the RMA has
 * shipped. Until the last one goes, the RMA keeps its status, Approved, with
 * the Shipment in process tag. The prototype used to flip a return to Shipped
 * to Vendor on the first dispatch and then show its last shipment as In
 * progress, which left lines still in the warehouse on a return the rest of
 * the page treated as gone (review R-18).
 *
 * Lines are grouped three to a shipment so a multi-line return reads as the
 * staged dispatches it is. While a shipment is in process every shipment but
 * the last has gone; the last is still being staged.
 */

import type { RMA, RMALineItem } from './mockRMAs';
import { authorizedQty } from './mockRMAs';

export type RMAShipmentStatus = 'Shipped' | 'In progress';

export interface RMAShipment {
  id: string;
  shippingId: string;
  status: RMAShipmentStatus;
  items: RMALineItem[];
  shippedOn?: string | undefined;
  shipTo: string;
  qtyToShip: number;
  shippedQty: number;
  value: number;
}

/** Approved, with at least one shipment out and at least one still to go. */
export function rmaShipmentInProcess(rma: RMA): boolean {
  return rma.status === 'Approved' && Boolean(rma.shipmentStartedDate) && rma.items.length > 3;
}

export function buildRMAShipments(rma: RMA): RMAShipment[] {
  const groups: RMALineItem[][] = [];
  for (let i = 0; i < rma.items.length; i += 3) {
    groups.push(rma.items.slice(i, i + 3));
  }
  // Everything has gone once the return is Shipped to Vendor or past it.
  const allShipped = rma.status === 'Shipped to Vendor' || rma.status === 'Closed';
  const inProcess = rmaShipmentInProcess(rma);
  const suffix = rma.rmaNumber.replace(/^RMA-/, '');

  return groups.map((items, i) => {
    const isLast = i === groups.length - 1;
    const shipped = allShipped || (inProcess && !isLast);
    const qtyToShip = items.reduce((s, li) => s + authorizedQty(li), 0);
    const value = items.reduce((s, li) => s + authorizedQty(li) * li.unitPrice, 0);
    return {
      id: `shp-${rma.id}-${i + 1}`,
      shippingId: `SHP-${suffix}-${String(i + 1).padStart(2, '0')}`,
      status: shipped ? 'Shipped' : 'In progress',
      items,
      shippedOn: shipped ? (rma.shippedDate ?? rma.shipmentStartedDate) : undefined,
      shipTo: rma.returnShipTo ?? `${rma.vendor} Returns Dept`,
      qtyToShip,
      shippedQty: shipped ? qtyToShip : 0,
      value: Math.round(value * 100) / 100,
    };
  });
}

/** The shipment a line has already gone out on, or null while it is still
 *  in the warehouse. A shipped line can no longer be cancelled. */
export function shipmentForShippedLine(rma: RMA, lineId: string): RMAShipment | null {
  return (
    buildRMAShipments(rma).find(
      (s) => s.status === 'Shipped' && s.items.some((li) => li.id === lineId),
    ) ?? null
  );
}

/** How far the shipments have got, for the tag and the banner. */
export function rmaShipmentProgress(rma: RMA): { shipped: number; total: number } {
  const all = buildRMAShipments(rma);
  return { shipped: all.filter((s) => s.status === 'Shipped').length, total: all.length };
}
