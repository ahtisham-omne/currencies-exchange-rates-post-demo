import { mulberry32 } from '../seededRandom';
import type { PricingAdjustment, UnitAllocation } from './mockCustomerInvoices';
import { arAccountForCategory, CUSTOMER_DEPOSITS_ACCOUNT, DEFAULT_REVENUE_ACCOUNT } from './arGlAccounts';
import { DEFAULT_AR_TERM_ID, arTermById } from './arPaymentTerms';

// Customer master data for Customer Invoicing (PRD §1, §12): each
// customer carries addresses, a billing contact, the accounts the
// invoice derives (A/R, default revenue, deposit), its sales orders
// (with their payment terms and stage event dates), its shipments
// (Shipped is the only invoiceable status, BR-004) and its quotes
// (advance invoices only, BR-008). How much of a shipment is billed is
// DERIVED from the invoices (arBilling.ts), never stored here, so the
// Ready to Invoice tab, the pickers and the detail pages cannot drift.

export interface ItemMaster {
  sku: string;
  description: string;
  uom: string;
  price: number;
  /** BR-010: the revenue account lines post to. Changed on the item. */
  revenueAccount?: string;
  /** How units are tracked: one serial per unit, or lots. */
  tracking: 'Serial' | 'Lot';
  /** Standard cost per unit; Revenue on invoice posts it with the revenue. */
  unitCost: number;
}

export const ITEM_MASTER: ItemMaster[] = [
  { sku: 'ITM-4402', description: 'Thermal insulation wrap, ceramic fiber, 24in roll', uom: 'ft', price: 62, revenueAccount: '4000 Sales of Product Income', tracking: 'Lot', unitCost: 37.2 },
  { sku: 'ITM-4867', description: 'Industrial lubricant grade 46, synthetic, 55 gal drum', uom: 'EA', price: 340, revenueAccount: '4000 Sales of Product Income', tracking: 'Lot', unitCost: 204 },
  { sku: 'ITM-3672', description: 'Ultra pressure sensor PS-3, inline process transducer', uom: 'EA', price: 218.75, revenueAccount: '4010 Sales of Product Income · Equipment', tracking: 'Serial', unitCost: 131.25 },
  { sku: 'ITM-2210', description: '24V relay board, DIN rail mount, 8 channel', uom: 'EA', price: 96.5, revenueAccount: '4010 Sales of Product Income · Equipment', tracking: 'Serial', unitCost: 57.9 },
  { sku: 'ITM-5580', description: 'Cold rolled steel coil, 16 gauge, oiled', uom: 'ton', price: 1240, revenueAccount: '4000 Sales of Product Income', tracking: 'Lot', unitCost: 868 },
  { sku: 'ITM-7031', description: 'Hydraulic fitting kit, JIC 37 degree, assorted', uom: 'KIT', price: 148, revenueAccount: '4000 Sales of Product Income', tracking: 'Lot', unitCost: 88.8 },
  { sku: 'ITM-1188', description: 'Managed switch, 48 port PoE, rack mount', uom: 'EA', price: 1890, revenueAccount: '4010 Sales of Product Income · Equipment', tracking: 'Serial', unitCost: 1134 },
  { sku: 'ITM-6420', description: 'Pallet labels, thermal transfer, 4x6, roll of 500', uom: 'RL', price: 38, tracking: 'Lot', unitCost: 22.8 },
  { sku: 'ITM-8804', description: 'Drive belt, cogged V profile, BX-68', uom: 'EA', price: 27.4, revenueAccount: '4000 Sales of Product Income', tracking: 'Lot', unitCost: 16.44 },
  { sku: 'ITM-9917', description: 'Shipping carton, double wall, 18x14x12, printed', uom: 'CTN', price: 4.15, tracking: 'Lot', unitCost: 2.49 },
];

export function itemBySku(sku: string): ItemMaster | undefined {
  return ITEM_MASTER.find((i) => i.sku === sku);
}

/** Revenue on invoice (Mahreen 11/4): the serials or lots on hand for an
 *  order line, oldest first. Deterministic so the form, the detail page
 *  and the seeds name the same units. Serial = one id per unit; lots are
 *  split into receipts of 12 to 60. */
export function unitPoolFor(sku: string, soLineId: string, onHand: number): UnitAllocation[] {
  const item = itemBySku(sku);
  const code = sku.replace(/\D/g, '');
  const seed = [...soLineId].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const qty = Math.max(0, Math.floor(onHand));
  if (item?.tracking === 'Serial') {
    const start = 1000 + (seed % 8000);
    return Array.from({ length: qty }, (_, i) => ({ id: `SN-${code}-${String(start + i).padStart(5, '0')}`, qty: 1 }));
  }
  const lots: UnitAllocation[] = [];
  let left = qty;
  let n = seed % 90;
  while (left > 0) {
    const size = Math.min(left, 12 + ((seed + n * 17) % 49));
    lots.push({ id: `LOT-${code}-26${String(10 + (n % 90)).padStart(2, '0')}`, qty: size });
    left -= size;
    n += 1;
  }
  return lots;
}

/** Fills `needed` units from the pool, oldest first. */
export function autoAllocateUnits(pool: UnitAllocation[], needed: number): UnitAllocation[] {
  const out: UnitAllocation[] = [];
  let left = Math.max(0, Math.floor(needed));
  for (const u of pool) {
    if (left <= 0) break;
    const take = Math.min(u.qty, left);
    out.push({ id: u.id, qty: take });
    left -= take;
  }
  return out;
}

export const unitsAllocated = (units: UnitAllocation[] | undefined) => (units ?? []).reduce((a, u) => a + u.qty, 0);

export interface CustomerAddress {
  id: string;
  label: string;
  line1: string;
  city: string;
  region: string;
  postal: string;
  country: string;
}

export interface CustomerContact {
  name: string;
  email: string;
  phone: string;
}

export interface CustomerSOLine {
  id: string;
  sku: string;
  description: string;
  uom: string;
  orderedQty: number;
  /** Price from the order version the goods shipped against (PRD §16). */
  unitPrice: number;
  /** FAD 11/2 (proposed revenue gate): units on hand and allocatable to
   *  this line. Unset = all on hand. */
  onHand?: number;
  /** FAD 11/2: pricing-rule premiums and discounts already inside
   *  unitPrice (the net price). List price = unitPrice minus their sum. */
  pricingAdjustments?: PricingAdjustment[];
}

export type SalesOrderStatus = 'Draft' | 'Confirmed' | 'Partially Shipped' | 'Shipped' | 'Cancelled';

export interface CustomerSO {
  soNumber: string;
  soDate: string;
  status: SalesOrderStatus;
  customerPONumber?: string;
  currency: string;
  paymentTermId: string;
  billToAddressId: string;
  /** Freight billed to the customer, carried to the invoice (PRD §7.4). */
  freightAmount?: number;
  notesToCustomer?: string;
  /** Stage event dates: an advance stage falls due on its event (PRD §8.2). */
  confirmationDate?: string;
  productionStartDate?: string;
  productionEndDate?: string;
  /** The quote this order came from, when one did (PRD §8.3). */
  quoteNumber?: string;
  lines: CustomerSOLine[];
  totalValue: number;
}

export interface CustomerShipmentLine {
  id: string;
  soLineId: string;
  sku: string;
  description: string;
  uom: string;
  orderedQty: number;
  shippedQty: number;
  unitPrice: number;
}

export type ShipmentStatus = 'Ready to Ship' | 'Shipped' | 'Reversed';

export interface CustomerShipment {
  shipmentNumber: string;
  soNumber: string;
  /** Date the shipment was marked Shipped (planned date while Ready to Ship). */
  shipDate: string;
  status: ShipmentStatus;
  carrier: string;
  attachments?: { name: string; kind: 'Packing slip' | 'BOL' }[];
  lines: CustomerShipmentLine[];
  totalValue: number;
}

export type QuoteStatus = 'Draft' | 'Sent' | 'Confirmed' | 'Expired' | 'Cancelled';

export interface CustomerQuote {
  quoteNumber: string;
  quoteDate: string;
  expiresOn: string;
  status: QuoteStatus;
  currency: string;
  paymentTermId: string;
  billToAddressId: string;
  /** When the quote became a sales order, its advances moved there (PRD §8.3). */
  convertedToSO?: string;
  lines: CustomerSOLine[];
  totalValue: number;
}

export interface Customer {
  id: string;
  customerCode: string;
  customerName: string;
  category: string;
  currency: string;
  /** Default term name, kept for the existing list and payment surfaces. */
  paymentTerms: string;
  paymentTermId: string;
  /** Empty when the customer has none (PRD §16: submit is blocked). */
  arAccount: string;
  /** BR-010 fallback when an item has no revenue account. */
  defaultRevenueAccount?: string;
  depositAccount: string;
  billingContact: CustomerContact;
  addresses: CustomerAddress[];
  defaultBillToId: string;
  /** Deactivated customers keep their shipped lines invoiceable (PRD §16). */
  active: boolean;
  creditLimit?: number;
  creditHold?: boolean;
  profile?: string;
  salesOrders: CustomerSO[];
  shipments: CustomerShipment[];
  quotes: CustomerQuote[];
}

interface CustomerSeed {
  name: string;
  category: string;
  termId: string;
  city: string;
  region: string;
  contact: string;
  currency?: string;
  noArAccount?: boolean;
  noDefaultRevenue?: boolean;
  inactive?: boolean;
}

// Name pool overlaps the vendor universe on purpose so avatars and
// color seeds stay consistent across modules.
const CUSTOMER_SEEDS: CustomerSeed[] = [
  { name: 'Rural Equipment Co.', category: 'Buyer (Items)', termId: 'ar-net-30', city: 'Des Moines', region: 'IA', contact: 'Dana Whitfield' },
  { name: 'Acme Supplies Co.', category: 'Buyer (Items)', termId: 'ar-2-10-net-30', city: 'Columbus', region: 'OH', contact: 'Marcus Reyes' },
  { name: 'Coastal Logistics LLC', category: 'Distributor', termId: 'ar-net-45', city: 'Savannah', region: 'GA', contact: 'Priya Natarajan' },
  { name: 'Central Warehouse Solutions', category: 'Distributor', termId: 'ar-net-30', city: 'Indianapolis', region: 'IN', contact: 'Tom Ellison' },
  { name: 'Atlantic Electronics', category: 'Buyer (Items)', termId: 'ar-net-15', city: 'Newark', region: 'NJ', contact: 'Claire Dubois' },
  { name: 'Western Manufacturing Inc.', category: 'Buyer (Items)', termId: 'ar-1-10-net-30-ship', city: 'Fresno', region: 'CA', contact: 'Hector Alvarez' },
  { name: 'Mountain Equipment Co.', category: 'Buyer (Items)', termId: 'ar-net-30-ship', city: 'Boulder', region: 'CO', contact: 'Jenna Holt' },
  { name: 'Metro Wholesale Group', category: 'Distributor', termId: 'ar-net-60', city: 'Chicago', region: 'IL', contact: 'Samir Haddad' },
  { name: 'Northern Trading Group', category: 'Buyer (Items)', termId: 'ar-net-30', city: 'Duluth', region: 'MN', contact: 'Erik Lindqvist', noDefaultRevenue: true },
  { name: 'Premier Automotive', category: 'Buyer (Items)', termId: 'ar-net-45', city: 'Detroit', region: 'MI', contact: 'Ava Thompson' },
  { name: 'Urban Industrial Group', category: 'Buyer (Services)', termId: 'ar-net-30', city: 'Pittsburgh', region: 'PA', contact: 'Leon Brooks' },
  { name: 'Summit Distribution', category: 'Distributor', termId: 'ar-net-30', city: 'Salt Lake City', region: 'UT', contact: 'Maya Chen', noArAccount: true },
  { name: 'Pacific Trading Co', category: 'Intercompany', termId: 'ar-net-60', city: 'Vancouver', region: 'BC', contact: 'Kenji Watanabe', currency: 'CAD' },
  { name: 'Metro Office Supplies', category: 'Buyer (Items)', termId: 'ar-net-15', city: 'Baltimore', region: 'MD', contact: 'Rosa Jimenez', inactive: true },
];

const CARRIERS = ['FedEx Freight', 'UPS Ground', 'XPO Logistics', 'Old Dominion', 'Estes Express'];

const round2 = (n: number) => Math.round(n * 100) / 100;
const today = new Date();
const iso = (d: Date) => d.toISOString().split('T')[0];
const daysAgo = (n: number) => {
  const d = new Date(today);
  d.setDate(today.getDate() - n);
  return iso(d);
};

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');

/** Pinned story documents (stable numbers the invoice seeds and the
 *  walkthrough reference). `ship` describes each shipment: 'full' ships
 *  everything, 'part' ships a share, 'ready' is Ready to Ship. */
interface PinnedSO {
  so: string;
  cpo?: string;
  termId?: string;
  status?: SalesOrderStatus;
  confirmedAgo?: number;
  productionStartAgo?: number;
  productionEndAgo?: number;
  currency?: string;
  skus?: string[];
  /** FAD 11/2: the first N lines are short on hand (revenue gate story). */
  shortOnHand?: number;
  ships: Array<{ shp: string; kind: 'full' | 'part' | 'ready' | 'reversed'; ago: number }>;
}

const PINNED_DOCS: Record<string, PinnedSO[]> = {
  'Rural Equipment Co.': [
    { so: '2000', cpo: 'CPO-8841', confirmedAgo: 70, ships: [{ shp: 'SHP 3001', kind: 'full', ago: 52 }] },
    // Net 45 against the customer's Net 30 default: billing SHP 3002
    // with another Rural shipment asks for one term (BR-003).
    { so: '2001', termId: 'ar-net-45', confirmedAgo: 30, ships: [{ shp: 'SHP 3002', kind: 'part', ago: 9 }] },
    // Split term, production started: its 30% stage has fallen due and
    // waits in Ready to Invoice (PRD §8.2).
    { so: '2002', cpo: 'CPO-9010', termId: 'ar-split-30-70', confirmedAgo: 20, productionStartAgo: 6, ships: [] },
  ],
  'Acme Supplies Co.': [
    { so: '2010', cpo: 'CPO-5127', confirmedAgo: 40, ships: [{ shp: 'SHP 3009', kind: 'part', ago: 18 }, { shp: 'SHP 3010', kind: 'part', ago: 4 }] },
    // Different term on a second shipped order: billing both together
    // asks for one term (BR-003).
    { so: '2011', cpo: 'CPO-5190', termId: 'ar-net-45', confirmedAgo: 25, ships: [{ shp: 'SHP 3011', kind: 'full', ago: 7 }] },
  ],
  'Coastal Logistics LLC': [
    // Net term, confirmed, unshipped: an advance needs a term swap (BR-007).
    { so: '2020', termId: 'ar-net-45', confirmedAgo: 12, ships: [] },
    // 30% deposit story: advance billed and paid, then the balance
    // invoice billed only the 70% the advance did not cover (BR-009).
    { so: '2021', cpo: 'CPO-7719', termId: 'ar-pre-30', confirmedAgo: 45, ships: [{ shp: 'SHP 3014', kind: 'full', ago: 21 }] },
  ],
  'Central Warehouse Solutions': [
    // Two lines short on hand: a Revenue pre-invoice here posts as a
    // Deposit and says why (FAD 11/2 revenue gate, proposed).
    { so: '2024', termId: 'ar-split-50-50', confirmedAgo: 14, shortOnHand: 2, ships: [] },
    { so: '2025', status: 'Draft', ships: [] },
  ],
  'Mountain Equipment Co.': [
    { so: '2030', cpo: 'CPO-6203', confirmedAgo: 30, ships: [{ shp: 'SHP 3020', kind: 'full', ago: 3 }, { shp: 'SHP 3021', kind: 'ready', ago: -2 }] },
  ],
  'Atlantic Electronics': [
    // A second currency for one customer (BR-002).
    { so: '2035', cpo: 'CPO-1180', currency: 'EUR', confirmedAgo: 28, ships: [{ shp: 'SHP 3025', kind: 'full', ago: 11 }] },
  ],
  'Northern Trading Group': [
    // Carries an item with no revenue account and no customer default (BR-010).
    { so: '2038', cpo: 'CPO-3321', confirmedAgo: 22, skus: ['ITM-9917', 'ITM-8804'], ships: [{ shp: 'SHP 3027', kind: 'full', ago: 8 }] },
  ],
  'Summit Distribution': [
    // Customer with no A/R account (PRD §16).
    { so: '2039', confirmedAgo: 18, ships: [{ shp: 'SHP 3028', kind: 'full', ago: 6 }] },
  ],
  'Western Manufacturing Inc.': [
    { so: '2036', cpo: 'CPO-4410', confirmedAgo: 60, ships: [{ shp: 'SHP 3024', kind: 'full', ago: 40 }, { shp: 'SHP 3026', kind: 'reversed', ago: 15 }] },
  ],
};

const PINNED_QUOTES: Record<string, Array<{ q: string; status: QuoteStatus; ago: number; termId?: string; convertedToSO?: string }>> = {
  'Acme Supplies Co.': [
    { q: 'Q-5001', status: 'Sent', ago: 6, termId: 'ar-pre-30' },
    { q: 'Q-5002', status: 'Draft', ago: 2 },
  ],
  'Rural Equipment Co.': [{ q: 'Q-5003', status: 'Expired', ago: 75 }],
  'Mountain Equipment Co.': [{ q: 'Q-5004', status: 'Confirmed', ago: 9, termId: 'ar-split-50-50' }],
  'Urban Industrial Group': [{ q: 'Q-5005', status: 'Sent', ago: 3, termId: 'ar-pre-100' }],
};

/** FAD 11/2: deterministic pricing rules per SO line (no rand() draw, so
 *  every other seed stays put). unitPrice stays the net price; the rule
 *  explains how the list price got there. */
function pricingFor(soNumber: string, lineIndex: number, net: number): PricingAdjustment[] | undefined {
  const n = Number(soNumber.replace(/\D/g, '')) || 0;
  const slot = (n + lineIndex) % 5;
  if (slot === 0) {
    // Volume Tier 2: 5% off list, so list = net / 0.95.
    const list = round2(net / 0.95);
    return [{ rule: 'Volume Tier 2', kind: 'Discount', perUnit: round2(net - list), percent: -5 }];
  }
  if (slot === 2) return [{ rule: 'Expedite Premium', kind: 'Premium', perUnit: 2.5 }];
  if (slot === 3 && net >= 100) {
    const off = round2(Math.max(1, net * 0.04));
    return [{ rule: 'Contract Price', kind: 'Discount', perUnit: -off }];
  }
  return undefined;
}

function buildCustomers(): Customer[] {
  const rand = mulberry32(0xA11CE5);
  let soCounter = 2040;
  let shpCounter = 3030;

  const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];

  const makeLines = (prefix: string, skus?: string[], shortOnHand = 0, priced = false): CustomerSOLine[] => {
    const chosen = skus
      ? skus.map((s) => itemBySku(s)!)
      : Array.from({ length: 2 + Math.floor(rand() * 3) }, () => pick(ITEM_MASTER));
    const seen = new Set<string>();
    return chosen
      .filter((it) => (seen.has(it.sku) ? false : (seen.add(it.sku), true)))
      .map((item, li) => {
        const orderedQty = item.price > 1000 ? 2 + Math.floor(rand() * 10) : 10 + Math.floor(rand() * 90);
        return {
          id: `${prefix}-L${li + 1}`,
          sku: item.sku,
          description: item.description,
          uom: item.uom,
          orderedQty,
          unitPrice: item.price,
          onHand: li < shortOnHand ? Math.floor(orderedQty * 0.4) : orderedQty,
          pricingAdjustments: priced ? pricingFor(prefix, li, item.price) : undefined,
        };
      });
  };

  const total = (lines: CustomerSOLine[]) => round2(lines.reduce((s, l) => s + l.orderedQty * l.unitPrice, 0));

  const makeShipment = (
    shipmentNumber: string,
    so: CustomerSO,
    kind: 'full' | 'part' | 'ready' | 'reversed',
    shipDate: string,
    shareOf?: { index: number; count: number },
  ): CustomerShipment => {
    const lines: CustomerShipmentLine[] = so.lines.map((l, li) => {
      let shippedQty = l.orderedQty;
      if (shareOf) shippedQty = Math.max(1, Math.floor(l.orderedQty / shareOf.count));
      else if (kind === 'part') shippedQty = Math.max(1, Math.floor(l.orderedQty * (0.35 + rand() * 0.3)));
      return {
        id: `${shipmentNumber.replace(' ', '-')}-L${li + 1}`,
        soLineId: l.id,
        sku: l.sku,
        description: l.description,
        uom: l.uom,
        orderedQty: l.orderedQty,
        shippedQty,
        unitPrice: l.unitPrice,
      };
    });
    return {
      shipmentNumber,
      soNumber: so.soNumber,
      shipDate,
      status: kind === 'ready' ? 'Ready to Ship' : kind === 'reversed' ? 'Reversed' : 'Shipped',
      carrier: pick(CARRIERS),
      attachments: [
        { name: `Packing slip ${shipmentNumber.replace(' ', '-')}.pdf`, kind: 'Packing slip' },
        { name: `BOL ${shipmentNumber.replace(' ', '-')}.pdf`, kind: 'BOL' },
      ],
      lines,
      totalValue: round2(lines.reduce((sum, l) => sum + l.shippedQty * l.unitPrice, 0)),
    };
  };

  return CUSTOMER_SEEDS.map((c, idx) => {
    const currency = c.currency ?? 'USD';
    const addresses: CustomerAddress[] = [
      { id: `addr-${idx + 1}-1`, label: 'Billing HQ', line1: `${100 + idx * 37} Commerce Way`, city: c.city, region: c.region, postal: String(10000 + idx * 4111).slice(0, 5), country: c.region === 'BC' ? 'Canada' : 'United States' },
      { id: `addr-${idx + 1}-2`, label: 'Accounts Payable Office', line1: `${20 + idx * 11} Market Street, Suite ${200 + idx}`, city: c.city, region: c.region, postal: String(10050 + idx * 4111).slice(0, 5), country: c.region === 'BC' ? 'Canada' : 'United States' },
    ];
    const salesOrders: CustomerSO[] = [];
    const shipments: CustomerShipment[] = [];
    const quotes: CustomerQuote[] = [];
    const termFor = (id?: string) => id ?? c.termId;

    const pushSO = (p: PinnedSO) => {
      const lines = makeLines(p.so, p.skus, p.shortOnHand, true);
      const shippedKinds = p.ships.filter((s) => s.kind === 'full' || s.kind === 'part');
      const shippedInFull = p.ships.length === 1 && p.ships[0].kind === 'full';
      const status: SalesOrderStatus = p.status
        ?? (shippedKinds.length === 0 ? 'Confirmed' : shippedInFull ? 'Shipped' : 'Partially Shipped');
      const so: CustomerSO = {
        soNumber: p.so,
        soDate: daysAgo((p.confirmedAgo ?? 10) + 3),
        status,
        customerPONumber: p.cpo,
        currency: p.currency ?? currency,
        paymentTermId: termFor(p.termId),
        billToAddressId: addresses[0].id,
        freightAmount: round2(120 + rand() * 520),
        notesToCustomer: rand() < 0.5 ? 'Please reference the sales order number on your remittance.' : undefined,
        confirmationDate: status === 'Draft' ? undefined : daysAgo(p.confirmedAgo ?? 10),
        productionStartDate: p.productionStartAgo !== undefined ? daysAgo(p.productionStartAgo) : undefined,
        productionEndDate: p.productionEndAgo !== undefined ? daysAgo(p.productionEndAgo) : undefined,
        lines,
        totalValue: total(lines),
      };
      salesOrders.push(so);
      // Several shipments on one order split it evenly so they never
      // ship more than was ordered.
      p.ships.forEach((s, h) => {
        shipments.push(
          makeShipment(s.shp, so, s.kind, daysAgo(s.ago), p.ships.length > 1 ? { index: h, count: p.ships.length } : undefined),
        );
      });
    };

    for (const p of PINNED_DOCS[c.name] ?? []) pushSO(p);

    // Seeded filler so every customer has something to bill.
    const fillerCount = (PINNED_DOCS[c.name] ? 1 : 2) + Math.floor(rand() * 2);
    for (let s = 0; s < fillerCount; s++) {
      const roll = rand();
      const kind: PinnedSO['ships'][number]['kind'] | 'none' = roll < 0.45 ? 'full' : roll < 0.7 ? 'part' : roll < 0.8 ? 'ready' : 'none';
      pushSO({
        so: String(soCounter++),
        cpo: rand() < 0.7 ? `CPO-${String(4000 + Math.floor(rand() * 5000))}` : undefined,
        confirmedAgo: 15 + Math.floor(rand() * 90),
        ships: kind === 'none' ? [] : [{ shp: `SHP ${shpCounter++}`, kind, ago: kind === 'ready' ? -3 : 3 + Math.floor(rand() * 45) }],
      });
    }

    for (const q of PINNED_QUOTES[c.name] ?? []) {
      const lines = makeLines(q.q);
      quotes.push({
        quoteNumber: q.q,
        quoteDate: daysAgo(q.ago),
        expiresOn: daysAgo(q.ago - 30),
        status: q.status,
        currency,
        paymentTermId: q.termId ?? c.termId,
        billToAddressId: addresses[0].id,
        convertedToSO: q.convertedToSO,
        lines,
        totalValue: total(lines),
      });
    }

    const term = arTermById(c.termId) ?? arTermById(DEFAULT_AR_TERM_ID)!;
    return {
      id: `cust-${idx + 1}`,
      customerCode: `C-${String(1001 + idx)}`,
      customerName: c.name,
      category: c.category,
      currency,
      paymentTerms: term.name,
      paymentTermId: term.id,
      arAccount: c.noArAccount ? '' : arAccountForCategory(c.category),
      defaultRevenueAccount: c.noDefaultRevenue ? undefined : DEFAULT_REVENUE_ACCOUNT,
      depositAccount: c.category === 'Intercompany' ? '2410 Customer Deposits · Intercompany' : CUSTOMER_DEPOSITS_ACCOUNT,
      billingContact: {
        name: c.contact,
        email: `${c.contact.split(' ')[0].toLowerCase()}.${c.contact.split(' ')[1]?.toLowerCase() ?? 'ap'}@${slug(c.name)}.com`,
        phone: `(${300 + idx * 13}) 555-${String(1000 + idx * 271).slice(0, 4)}`,
      },
      addresses,
      defaultBillToId: addresses[0].id,
      active: !c.inactive,
      creditLimit: 50_000 + Math.floor(rand() * 20) * 25_000,
      creditHold: c.name === 'Metro Wholesale Group',
      profile: `${c.category} account, ${currency} settlements on ${term.name} terms, established ${2019 + Math.floor(rand() * 5)}.`,
      salesOrders,
      shipments,
      quotes,
    };
  });
}

export const mockCustomers: Customer[] = buildCustomers();

export function customerByName(name: string, list: Customer[] = mockCustomers): Customer | undefined {
  return list.find((c) => c.customerName === name);
}

export function findSalesOrder(soNumber: string, list: Customer[] = mockCustomers): { customer: Customer; so: CustomerSO } | undefined {
  for (const customer of list) {
    const so = customer.salesOrders.find((s) => s.soNumber === soNumber);
    if (so) return { customer, so };
  }
  return undefined;
}

export function findShipment(shipmentNumber: string, list: Customer[] = mockCustomers): { customer: Customer; shipment: CustomerShipment } | undefined {
  for (const customer of list) {
    const shipment = customer.shipments.find((s) => s.shipmentNumber === shipmentNumber);
    if (shipment) return { customer, shipment };
  }
  return undefined;
}

export function findQuote(quoteNumber: string, list: Customer[] = mockCustomers): { customer: Customer; quote: CustomerQuote } | undefined {
  for (const customer of list) {
    const quote = customer.quotes.find((q) => q.quoteNumber === quoteNumber);
    if (quote) return { customer, quote };
  }
  return undefined;
}

export function addressLine(a: CustomerAddress | undefined): string {
  if (!a) return '';
  return `${a.line1}, ${a.city}, ${a.region} ${a.postal}`;
}

/** BR-010: item account first, then the customer default. */
export function revenueAccountFor(sku: string, customer: Customer | undefined): string | undefined {
  return itemBySku(sku)?.revenueAccount ?? customer?.defaultRevenueAccount;
}

/** The units a Revenue on invoice advance line locks: what the user
 *  picked, or the oldest units on hand when nothing was picked. */
export function lockedUnitsFor(
  line: { sku: string; soLineId?: string; orderedQty: number; shippedQty?: number; lockedUnits?: UnitAllocation[] },
  soLine?: CustomerSOLine,
): { units: UnitAllocation[]; needed: number; pool: UnitAllocation[]; tracking: 'Serial' | 'Lot'; auto: boolean } {
  const needed = Math.max(0, line.orderedQty - (line.shippedQty ?? 0));
  const pool = unitPoolFor(line.sku, line.soLineId ?? line.sku, soLine?.onHand ?? needed);
  const tracking = itemBySku(line.sku)?.tracking ?? 'Lot';
  if (line.lockedUnits) return { units: line.lockedUnits, needed, pool, tracking, auto: false };
  return { units: autoAllocateUnits(pool, needed), needed, pool, tracking, auto: true };
}

/** Standard cost of what an invoice line bills: its total at the item's
 *  cost-to-price ratio. Revenue on invoice posts it with the revenue. */
export function lineCostOf(line: { sku: string; unitPrice: number; total: number }): number {
  const item = itemBySku(line.sku);
  if (!item || line.unitPrice <= 0 || line.total <= 0) return 0;
  return Math.round(line.total * (item.unitCost / line.unitPrice) * 100) / 100;
}
