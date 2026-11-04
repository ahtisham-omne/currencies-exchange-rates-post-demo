import { mockVendors, type LineItem, type Vendor, type VendorGRN, type VendorPO } from '@/app/data/mockVendors';
import type { Customer } from '@/app/data/ar/mockCustomers';
import type { CustomerInvoice } from '@/app/data/ar/mockCustomerInvoices';
import {
  advanceInvoicesFor,
  availableQty,
  billingByShipmentLine,
  isInvoiceableShipment,
  lineAvailableToAdvance,
  orderBilling,
  quoteAdvanceLockReason,
  quoteAvailableToAdvance,
  shipmentBillingStatus,
  soAdvanceLockReason,
} from '@/app/data/ar/arBilling';
import { arTermById } from '@/app/data/ar/arPaymentTerms';

// Adapter that feeds customer data (data/ar/*, billing math in
// arBilling.ts) into the vendor picker's shapes, so the forked
// CustomerSelectionModalNested keeps the vendor JSX untouched:
//   Vendor            ← Customer
//   VendorPO          ← Sales Order (Shipment flow, Advance flow) or Quote (Advance flow)
//   VendorGRN         ← Shipment (Shipped only, BR-004)
//   LineItem          ← SO / quote line (quantity = ordered, receivedQty = shipped,
//                       invoicedQty = shipped units already on an invoice)
// AR-only facts ride on the objects as `ar*` fields (LineItem has an index
// signature; the PO/GRN/Vendor extensions are typed below).

export const PARTNER_CREATE_CUSTOMER_URL = 'https://partner-management-module.lovable.app/vendors?from=customer-invoicing';

/** The customer pool overlaps the vendor universe on purpose; reuse the logo. */
export function customerImageUrl(name: string): string | undefined {
  return mockVendors.find((v) => v.vendorName === name)?.imageUrl;
}

export function describeCustomer(c: Customer): string {
  const addr = c.addresses.find((a) => a.id === c.defaultBillToId) ?? c.addresses[0];
  const where = addr ? `${addr.city}, ${addr.region}` : '';
  return `${c.category} customer${where ? ` based in ${where}` : ''}. Billed in ${c.currency} on ${c.paymentTerms} terms. Billing contact ${c.billingContact.name}, ${c.billingContact.email}.`;
}

export interface ArPO extends VendorPO {
  arKind: 'so' | 'quote';
  arCurrency: string;
  arTermId: string;
  /** Why the whole order / quote cannot be picked in this flow. */
  arLockReason: string | null;
  /** Advance flow: value still open to advance-bill. */
  arAvailableToAdvance?: number;
  /** Shipment flow: advance billed and not yet carried (BR-009), for the violet chip. */
  arAdvanceRemaining?: number;
  arAdvanceInvoiceNumber?: string;
  /** Advance flow: the quote this order came from / quote status. */
  arDocStatus: string;
}

export interface ArGRN extends VendorGRN {
  arCurrency: string;
  arTermId: string;
}

export interface ArVendor extends Vendor {
  purchaseOrders: ArPO[];
  receivingDocuments: ArGRN[];
  quotes: ArPO[];
  arActive: boolean;
  arDescription: string;
  /** Uninvoiced shipments (Shipment flow stat box). */
  arOpenShipments: number;
  /** Orders / quotes with something to bill in this flow. */
  arOpenOrders: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const EPS = 0.004;

export function buildCustomerVendors(
  customers: Customer[],
  invoices: CustomerInvoice[],
  flow: 'shipment' | 'advance',
  quotesOnly = false,
): ArVendor[] {
  const billing = billingByShipmentLine(invoices);
  // Invoices holding each shipment line (for the Invoiced hover card).
  const refs = new Map<string, Array<{ invoiceNumber: string; qty: number; amount: number }>>();
  for (const inv of invoices) {
    if (inv.docKind !== 'Shipment Invoice' || inv.invoiceStatus === 'Cancelled') continue;
    for (const l of inv.lines) {
      if (!l.shipmentLineId) continue;
      const list = refs.get(l.shipmentLineId) ?? [];
      list.push({ invoiceNumber: inv.invoiceNumber, qty: l.invoiceQty, amount: l.total });
      refs.set(l.shipmentLineId, list);
    }
  }
  return customers.map((c) => {
    const shipped = c.shipments.filter(isInvoiceableShipment);

    // ── Shipments (GRN slot) ──
    const receivingDocuments: ArGRN[] = flow === 'advance' ? [] : shipped.map((s) => {
      const so = c.salesOrders.find((o) => o.soNumber === s.soNumber);
      const status = shipmentBillingStatus(s, billing);
      return {
        grnNumber: s.shipmentNumber,
        grnDate: s.shipDate,
        receivedQty: s.lines.reduce((a, l) => a + l.shippedQty, 0),
        poNumber: s.soNumber,
        status,
        vendorName: c.customerName,
        vendorCode: c.customerCode,
        arCurrency: so?.currency ?? c.currency,
        arTermId: so?.paymentTermId ?? c.paymentTermId,
        items: s.lines.map((l): LineItem => {
          const avail = availableQty(l, billing);
          return {
            id: l.id,
            sku: l.sku,
            description: l.description,
            quantity: l.shippedQty,
            uom: l.uom,
            unitPrice: l.unitPrice,
            totalPrice: round2(l.shippedQty * l.unitPrice),
            receivedQty: l.shippedQty,
            invoicedQty: l.shippedQty - avail,
            arAvailable: avail,
            arSoLineId: l.soLineId,
            arInvoiceRefs: refs.get(l.id) ?? [],
          };
        }),
      };
    });

    // ── Sales orders (PO slot) ──
    // Shipment flow (user 11/4): only Partially Shipped or Shipped orders
    // list; on a partly shipped order only the shipped lines can tick.
    const listedSOs =
      flow === 'advance'
        ? quotesOnly ? [] : c.salesOrders
        : c.salesOrders.filter((so) => so.status === 'Partially Shipped' || so.status === 'Shipped');
    const purchaseOrders: ArPO[] = listedSOs.map((so) => {
      const ob = orderBilling(so, c, invoices);
      const soShipments = shipped.filter((s) => s.soNumber === so.soNumber);
      const lockAdvance = flow === 'advance' ? soAdvanceLockReason(so, c, invoices) : null;
      let invoicedValue = 0;
      const items = so.lines.map((line): LineItem => {
        const shipLines = soShipments.flatMap((s) => s.lines.filter((l) => l.soLineId === line.id));
        const shippedQty = shipLines.reduce((a, l) => a + l.shippedQty, 0);
        const billedQty = shipLines.reduce((a, l) => a + (l.shippedQty - availableQty(l, billing)), 0);
        const avail = shippedQty - billedQty;
        invoicedValue += billedQty * line.unitPrice;
        const advanceAvail = flow === 'advance' ? lineAvailableToAdvance(line, so, c, ob) : 0;
        return {
          id: line.id,
          sku: line.sku,
          description: line.description,
          quantity: line.orderedQty,
          uom: line.uom,
          unitPrice: line.unitPrice,
          totalPrice: round2(line.orderedQty * line.unitPrice),
          receivedQty: shippedQty,
          invoicedQty: billedQty,
          arAvailable: avail,
          arAvailableToAdvance: advanceAvail,
          arEligible: flow === 'advance' ? !lockAdvance && advanceAvail > EPS : avail > 0,
          arLockTitle:
            flow === 'advance'
              ? 'Nothing left to advance-bill'
              : shippedQty === 0
                ? 'Not shipped yet'
                : 'Nothing shipped is left to bill',
          arLockBody:
            flow === 'advance'
              ? lockAdvance ?? 'This line has shipped or is covered by advances already billed.'
              : shippedQty === 0
                ? "This line has not shipped, so it can't be billed yet. To bill it before it ships, use the Advance Invoice flow."
                : 'Every shipped unit of this line is already on an invoice. The rest has not shipped yet.',
        };
      });
      const advances = advanceInvoicesFor(so, invoices);
      return {
        poNumber: so.soNumber,
        poDate: so.soDate,
        poAmount: so.totalValue,
        status: so.status === 'Draft' ? 'Draft' : so.status === 'Cancelled' ? 'Closed' : 'Confirmed',
        itemCount: items.length,
        items,
        invoicedAmount: round2(flow === 'advance' ? ob.advanceBilled : invoicedValue),
        paymentTerms: arTermById(so.paymentTermId)?.name,
        arKind: 'so',
        arCurrency: so.currency,
        arTermId: so.paymentTermId,
        arLockReason: lockAdvance,
        arAvailableToAdvance: ob.availableToAdvance,
        arAdvanceRemaining: flow === 'shipment' ? ob.advanceRemaining : undefined,
        arAdvanceInvoiceNumber: advances[0]?.invoiceNumber,
        arDocStatus: so.status,
      };
    });

    // ── Quotes (Advance flow, second tab) ──
    const quotes: ArPO[] = flow !== 'advance' ? [] : c.quotes.map((q) => {
      const lock = quoteAdvanceLockReason(q, invoices);
      const available = quoteAvailableToAdvance(q, invoices);
      const ratio = q.totalValue > 0 ? available / q.totalValue : 0;
      return {
        poNumber: q.quoteNumber,
        poDate: q.quoteDate,
        poAmount: q.totalValue,
        status: q.status === 'Draft' ? 'Draft' : q.status === 'Sent' ? 'Sent' : q.status === 'Confirmed' ? 'Confirmed' : 'Closed',
        itemCount: q.lines.length,
        invoicedAmount: round2(q.totalValue - available),
        paymentTerms: arTermById(q.paymentTermId)?.name,
        items: q.lines.map((line): LineItem => ({
          id: line.id,
          sku: line.sku,
          description: line.description,
          quantity: line.orderedQty,
          uom: line.uom,
          unitPrice: line.unitPrice,
          totalPrice: round2(line.orderedQty * line.unitPrice),
          receivedQty: 0,
          invoicedQty: 0,
          arAvailableToAdvance: round2(line.orderedQty * line.unitPrice * ratio),
          arEligible: !lock && available > EPS,
          arLockTitle: 'Nothing left to advance-bill',
          arLockBody: lock ?? 'This quote is fully advance-billed.',
        })),
        arKind: 'quote',
        arCurrency: q.currency,
        arTermId: q.paymentTermId,
        arLockReason: lock,
        arAvailableToAdvance: available,
        arDocStatus: q.status,
      };
    });

    const arOpenOrders =
      flow === 'advance'
        ? [...purchaseOrders, ...quotes].filter((p) => p.status !== 'Draft' && !p.arLockReason && p.items.some((i) => i.arEligible)).length
        : purchaseOrders.filter((p) => p.status !== 'Draft' && p.items.some((i) => i.arEligible)).length;

    return {
      id: c.id,
      vendorCode: c.customerCode,
      vendorName: c.customerName,
      category: c.category,
      currency: c.currency,
      paymentTerms: c.paymentTerms,
      purchaseOrders,
      receivingDocuments,
      quotes,
      createdBy: c.billingContact.name,
      createdOn: '',
      type: 'Domestic',
      imageUrl: customerImageUrl(c.customerName),
      arActive: c.active,
      arDescription: describeCustomer(c),
      arOpenShipments: receivingDocuments.filter((g) => g.status !== 'Fully Invoiced').length,
      arOpenOrders,
    };
  });
}
