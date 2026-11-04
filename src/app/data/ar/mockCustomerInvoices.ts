import { mulberry32 } from '../seededRandom';
import { PINNED_CREATORS } from '../mockInvoices';
import {
  DEFAULT_REVENUE_ACCOUNT,
  FREIGHT_INCOME_ACCOUNT,
  CHARGE_DEFAULT_ACCOUNT,
  SALES_RETURNS_ACCOUNT,
  type CustomerChargeType,
} from './arGlAccounts';
import { arTermById, advanceStagesFor, netDaysFor, stageLabel, stagesForTerm, triggerEventFor } from './arPaymentTerms';
import {
  mockCustomers,
  revenueAccountFor,
  type Customer,
  type CustomerShipment,
  type CustomerSO,
  type CustomerQuote,
} from './mockCustomers';
import { formatInvoiceId } from '@/app/lib/invoiceIds';

// Customer invoices (PRD §12). ONE array holds the three invoice types
// plus customer credit memos. Status model per PRD §14: Draft, Pending
// Approval, Approved, Rejected, Cancelled, with Archived as a flag on a
// cancelled invoice and Sent as a flag with a date (never a status).
// Payment-side fields (receipts, deposits, credit hold, write-off,
// dispute) stay as they were until the Customer Payments PRD.

export type CustomerDocKind = 'Shipment Invoice' | 'Advance Invoice' | 'Standalone' | 'Credit Memo';

export type CustomerInvoiceStatus = 'Draft' | 'Pending Approval' | 'Approved' | 'Rejected' | 'Cancelled';

export interface CustomerInvoiceLine {
  id: string;
  sku: string;
  description: string;
  uom: string;
  orderedQty: number;
  shippedQty?: number;
  invoiceQty: number;
  unitPrice: number;
  /** BR-014: the sales order price, kept so an edited price can be restored. */
  originalUnitPrice?: number;
  /** Quantity × price before any advance coverage (shipment lines). */
  grossTotal?: number;
  /** BR-009: the share of this line already billed on an advance invoice. */
  advanceCovered?: number;
  /** What this line bills. */
  total: number;
  /** Revenue account. Empty on advance lines (PRD §8.4). */
  glAccount: string;
  soNumber?: string;
  soLineId?: string;
  shipmentNumber?: string;
  shipmentLineId?: string;
  chargeTemplateId?: string;
  /** Advance lines: the percent of the line billed. */
  advancePercent?: number;
  /** Credit memo lines: the invoice line being credited. */
  creditOfLineId?: string;
  /** FAD 11/2: a free-text line typed on the invoice, no inventory link. */
  manual?: boolean;
  /** FAD 11/2: pricing-rule premiums and discounts already in the SO price,
   *  shown on the line (moved here from Payments). Negative = discount. */
  pricingAdjustments?: PricingAdjustment[];
  /** Revenue on invoice advances: the serials or lots locked to the
   *  customer at posting (hard allocation). */
  lockedUnits?: UnitAllocation[];
}

/** One serial (qty 1) or one lot (qty drawn from it). */
export interface UnitAllocation {
  id: string;
  qty: number;
}

export interface PricingAdjustment {
  rule: string;
  kind: 'Premium' | 'Discount';
  /** Per-unit amount; negative for a discount. */
  perUnit: number;
  /** Percent of list when the rule is a percentage. */
  percent?: number;
}

/** FAD 11/2 pre-invoice treatment: Revenue books revenue at invoice and
 *  locks the units; Deposit holds the money as a liability until goods ship. */
export type PreInvoiceTreatment = 'Revenue' | 'Deposit';

/** Who flagged an invoice and why (dispute or exception, vendor parity). */
export interface InvoiceFlagDetail {
  reason: string;
  by: string;
  at: string;
}

/** A Deposit pre-invoice turning into revenue as a shipment goes out. */
export interface ShipmentSettlement {
  shipmentNumber: string;
  date: string;
  units: number;
  amount: number;
}

export interface CustomerInvoiceCharge {
  id: string;
  type: CustomerChargeType;
  description: string;
  amount: number;
  account: string;
}

export interface CustomerSendRecord {
  id: string;
  at: string;
  by: string;
  to: string[];
  cc: string[];
  subject: string;
  message: string;
  outcome: 'sent' | 'failed';
}

export interface AdvanceStageRef {
  index: number;
  total: number;
  percent: number;
  trigger: string;
  label: string;
}

export interface ReceiptApplication {
  id: string;
  date: string;
  method: string;
  reference: string;
  amount: number;
}

export interface DepositApplication {
  depositId: string;
  amount: number;
  appliedOn: string;
}

export interface CustomerInvoiceHistoryEntry {
  action: string;
  reason: string;
  by: string;
  at: string;
  notifiedRecipientIds?: string[];
}

export interface CustomerInvoice {
  id: string;
  /** One sequence for every invoice type (PRD §8.4); CRN- for credit memos. */
  invoiceNumber: string;
  /** The invoice number printed for the customer (BA 10/29): SI- sequence,
   *  user-editable, separate from the system Invoice ID. */
  documentNumber?: string;
  docKind: CustomerDocKind;
  customer: string;
  /** Customer PO number, or the customer reference on a standalone. */
  customerPONumber?: string;
  invoiceDate: string;
  createdDate: string;
  /** Open period only. Empty on advance invoices (D2). */
  postingDate?: string;
  triggerDate?: string;
  /** BR-016: trigger date plus the term's days. Never typed. */
  dueDate?: string;
  paymentTermId?: string;
  paymentTerms?: string;
  advanceStage?: AdvanceStageRef;
  /** Advance invoices billed from a quote (PRD §8.3). */
  quoteNumber?: string;
  billToAddressId?: string;
  /** Document total; NEGATIVE on credit memos. */
  amount: number;
  freightAmount?: number;
  freightAccount?: string;
  carrier?: string;
  charges: CustomerInvoiceCharge[];
  currency: string;
  arAccount: string;
  /** Advance invoices: the customer deposit account (PRD §8.4). */
  depositAccount?: string;
  description: string;
  notesToCustomer?: string;
  linkedSOs: string[];
  linkedShipments: string[];
  /** Credit memo → its invoice; standalone → the earlier invoice it bills more on. */
  relatedInvoiceNumber?: string;
  /** BR-009: advance invoices that already billed part of this invoice's value. */
  advanceReferences?: Array<{ invoiceNumber: string; amount: number }>;
  invoiceStatus: CustomerInvoiceStatus;
  /** A cancelled invoice hidden from active views (PRD §14). */
  archived?: boolean;
  /** BR-019: kept after resubmitting. */
  rejectionReason?: string;
  /** Last time the invoice was sent (PRD §10.3). */
  sentAt?: string;
  sendLog?: CustomerSendRecord[];
  submittedBy?: string;
  submittedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  /** Credit memos: how the credit was built. */
  creditBasis?: 'lines' | 'amount';
  creditReason?: string;
  rmaNumber?: string;
  // ── FAD review 11/2 ──
  /** Advance invoices only: how the pre-invoice posts. Locked once approved. */
  treatment?: PreInvoiceTreatment;
  /** Why the treatment differs from what was picked (revenue gate). */
  treatmentNote?: string;
  /** Per-SO customer PO numbers on a combined invoice. */
  poBySo?: Record<string, string>;
  /** Invoice currency rate to the company currency (USD) at invoice date. */
  fxRate?: number;
  /** Who flagged the dispute and why. */
  disputeDetail?: InvoiceFlagDetail;
  /** Exception flag, set on create or afterwards (vendor parity). */
  exception?: InvoiceFlagDetail;
  /** Revise: version number (1 = original). The number takes a -N suffix. */
  revision?: number;
  /** Revise: the id of the version this one replaced. */
  revisedFromId?: string;
  /** Revise: set on the old version once a new one is posted. */
  supersededById?: string;
  /** Deposit pre-invoice: revenue recognised per shipment, same invoice. */
  settlements?: ShipmentSettlement[];
  /** Advance invoice: the prepayment was refunded or reversed. */
  prepaymentReversal?: { mode: 'refund' | 'reverse'; amount: number; reason: string; by: string; at: string };
  /** Write off: the amount moved to bad debt. */
  writeOffAmount?: number;
  // ── Payment-side fields (unchanged until Customer Payments) ──
  writtenOff?: boolean;
  disputed?: boolean;
  creditHold?: boolean;
  /** Advance invoices: the customer paid the advance. */
  depositReceived?: boolean;
  depositApplications: DepositApplication[];
  receipts: ReceiptApplication[];
  /** Total credited by approved credit memos against this invoice. */
  creditApplied: number;
  lines: CustomerInvoiceLine[];
  createdBy: string;
  updatedBy?: string;
  updatedDate?: string;
  actionHistory?: CustomerInvoiceHistoryEntry[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const today = new Date();
const iso = (d: Date) => d.toISOString().split('T')[0];
export const daysFromToday = (n: number) => {
  const d = new Date(today);
  d.setDate(today.getDate() + n);
  return iso(d);
};
const addDays = (isoDate: string, n: number) => {
  const d = new Date(isoDate + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return iso(d);
};
const atIso = (date: string, hour = 10) => `${date}T${String(hour).padStart(2, '0')}:15:00.000Z`;

const customer = (name: string) => mockCustomers.find((c) => c.customerName === name)!;
const soOf = (c: Customer, n: string) => c.salesOrders.find((s) => s.soNumber === n)!;
const shpOf = (c: Customer, n: string) => c.shipments.find((s) => s.shipmentNumber === n)!;

/** Shipment invoice lines from a shipment. `share` bills that fraction
 *  of the shipped qty; `advanceShare` is the fraction of value an
 *  advance already billed (BR-009). */
function shipmentLines(c: Customer, s: CustomerShipment, share = 1, advanceShare = 0): CustomerInvoiceLine[] {
  return s.lines.map((l, i) => {
    const qty = Math.max(1, Math.floor(l.shippedQty * share));
    const gross = round2(qty * l.unitPrice);
    const covered = round2(gross * advanceShare);
    return {
      id: `L${i + 1}`,
      sku: l.sku,
      description: l.description,
      uom: l.uom,
      orderedQty: l.orderedQty,
      shippedQty: l.shippedQty,
      invoiceQty: qty,
      unitPrice: l.unitPrice,
      originalUnitPrice: l.unitPrice,
      grossTotal: gross,
      advanceCovered: covered > 0 ? covered : undefined,
      total: round2(gross - covered),
      glAccount: revenueAccountFor(l.sku, c) ?? DEFAULT_REVENUE_ACCOUNT,
      soNumber: s.soNumber,
      soLineId: l.soLineId,
      shipmentNumber: s.shipmentNumber,
      shipmentLineId: l.id,
    };
  });
}

function advanceLines(src: CustomerSO | CustomerQuote, percent: number): CustomerInvoiceLine[] {
  return src.lines.map((l, i) => {
    const total = round2(l.orderedQty * l.unitPrice * (percent / 100));
    return {
      id: `L${i + 1}`,
      sku: l.sku,
      description: l.description,
      uom: l.uom,
      orderedQty: l.orderedQty,
      shippedQty: 0,
      invoiceQty: l.orderedQty,
      unitPrice: l.unitPrice,
      total,
      glAccount: '',
      soNumber: 'soNumber' in src ? src.soNumber : undefined,
      soLineId: l.id,
      advancePercent: percent,
    };
  });
}

function sumLines(lines: CustomerInvoiceLine[]) {
  return round2(lines.reduce((s, l) => s + l.total, 0));
}

function dueFor(kind: 'Shipment Invoice' | 'Advance Invoice' | 'Standalone', termId: string, triggerDate: string | undefined, stage?: number) {
  if (!triggerDate) return undefined;
  return addDays(triggerDate, netDaysFor(kind, arTermById(termId), stage));
}

function base(c: Customer): Pick<CustomerInvoice, 'currency' | 'arAccount' | 'charges' | 'depositApplications' | 'receipts' | 'creditApplied' | 'billToAddressId'> {
  return {
    currency: c.currency,
    arAccount: c.arAccount,
    charges: [],
    depositApplications: [],
    receipts: [],
    creditApplied: 0,
    billToAddressId: c.defaultBillToId,
  };
}

function approvedMeta(date: string, by: string, approver = 'Eli Mansour') {
  return {
    submittedBy: by,
    submittedAt: atIso(date, 9),
    approvedBy: approver,
    approvedAt: atIso(date, 15),
  };
}

function sentMeta(c: Customer, invoiceNumber: string, date: string, by: string, docTitle = 'Invoice'): Pick<CustomerInvoice, 'sentAt' | 'sendLog'> {
  const at = atIso(date, 16);
  return {
    sentAt: at,
    sendLog: [
      {
        id: `snd-${invoiceNumber}`,
        at,
        by,
        to: [c.billingContact.email],
        cc: [],
        subject: `${docTitle} ${invoiceNumber} from Omnesoft Industries`,
        message: `Hello ${c.billingContact.name.split(' ')[0]},\n\nPlease find ${docTitle} ${invoiceNumber} attached.\n\nThank you for your business.`,
        outcome: 'sent',
      },
    ],
  };
}

function shipmentInvoice(opts: {
  n: string;
  c: Customer;
  shipments: CustomerShipment[];
  share?: number;
  advanceShare?: number;
  advanceRef?: string;
  invoiceAgo: number;
  status: CustomerInvoiceStatus;
  sent?: boolean;
  by: string;
  description: string;
  extra?: Partial<CustomerInvoice>;
}): CustomerInvoice {
  const { c } = opts;
  const so = soOf(c, opts.shipments[0].soNumber);
  const lines = opts.shipments.flatMap((s) => shipmentLines(c, s, opts.share ?? 1, opts.advanceShare ?? 0)).map((l, i) => ({ ...l, id: `L${i + 1}` }));
  const invoiceDate = daysFromToday(-opts.invoiceAgo);
  const latestShip = opts.shipments.map((s) => s.shipDate).sort().at(-1)!;
  const term = arTermById(so.paymentTermId)!;
  const trigger = triggerEventFor('Shipment Invoice', term) === 'Shipping' ? latestShip : invoiceDate;
  const freight = opts.share && opts.share < 1 ? 0 : so.freightAmount ?? 0;
  const subtotal = sumLines(lines);
  const covered = round2(lines.reduce((s, l) => s + (l.advanceCovered ?? 0), 0));
  const charges = opts.extra?.charges ?? [];
  const amount = round2(subtotal + freight + charges.reduce((s, ch) => s + ch.amount, 0));
  const posted = opts.status === 'Approved';
  return {
    id: `cinv-${opts.n}`,
    invoiceNumber: opts.n,
    docKind: 'Shipment Invoice',
    customer: c.customerName,
    customerPONumber: so.customerPONumber,
    invoiceDate,
    createdDate: invoiceDate,
    postingDate: latestShip,
    triggerDate: trigger,
    dueDate: dueFor('Shipment Invoice', so.paymentTermId, trigger),
    paymentTermId: term.id,
    paymentTerms: term.name,
    ...base(c),
    billToAddressId: so.billToAddressId,
    amount,
    freightAmount: freight > 0 ? freight : undefined,
    freightAccount: freight > 0 ? FREIGHT_INCOME_ACCOUNT : undefined,
    carrier: opts.shipments[0].carrier,
    description: opts.description,
    notesToCustomer: so.notesToCustomer,
    linkedSOs: [...new Set(opts.shipments.map((s) => s.soNumber))],
    linkedShipments: opts.shipments.map((s) => s.shipmentNumber),
    advanceReferences: opts.advanceRef && covered > 0 ? [{ invoiceNumber: opts.advanceRef, amount: covered }] : undefined,
    invoiceStatus: opts.status,
    ...(opts.status !== 'Draft' ? { submittedBy: opts.by, submittedAt: atIso(invoiceDate, 9) } : {}),
    ...(posted ? approvedMeta(invoiceDate, opts.by) : {}),
    ...(posted && opts.sent ? sentMeta(c, opts.n, invoiceDate, opts.by) : {}),
    lines,
    createdBy: opts.by,
    ...opts.extra,
    charges,
  };
}

function advanceInvoice(opts: {
  n: string;
  c: Customer;
  so?: CustomerSO;
  quote?: CustomerQuote;
  stageIndex: number;
  invoiceAgo: number;
  status: CustomerInvoiceStatus;
  sent?: boolean;
  by: string;
  description: string;
  extra?: Partial<CustomerInvoice>;
}): CustomerInvoice {
  const { c } = opts;
  const src = (opts.so ?? opts.quote)!;
  const term = arTermById(src.paymentTermId)!;
  const stages = stagesForTerm(term);
  const stage = stages.find((s) => s.index === opts.stageIndex) ?? advanceStagesFor(term)[0];
  const lines = advanceLines(src, stage.percent);
  const invoiceDate = daysFromToday(-opts.invoiceAgo);
  const eventDate = opts.so
    ? stage.trigger === 'Order Confirmation' ? opts.so.confirmationDate
      : stage.trigger === 'Production Start' ? opts.so.productionStartDate
        : stage.trigger === 'Production End' ? opts.so.productionEndDate : undefined
    : opts.quote?.quoteDate;
  const posted = opts.status === 'Approved';
  return {
    id: `cinv-${opts.n}`,
    invoiceNumber: opts.n,
    docKind: 'Advance Invoice',
    customer: c.customerName,
    customerPONumber: opts.so?.customerPONumber,
    invoiceDate,
    createdDate: invoiceDate,
    triggerDate: eventDate,
    dueDate: dueFor('Advance Invoice', term.id, eventDate, stage.index),
    paymentTermId: term.id,
    paymentTerms: term.name,
    advanceStage: { index: stage.index, total: stages.length, percent: stage.percent, trigger: stage.trigger, label: stageLabel(stage, stages.length) },
    quoteNumber: opts.quote?.quoteNumber,
    ...base(c),
    billToAddressId: src.billToAddressId,
    depositAccount: c.depositAccount,
    amount: sumLines(lines),
    description: opts.description,
    notesToCustomer: opts.so?.notesToCustomer,
    linkedSOs: opts.so ? [opts.so.soNumber] : [],
    linkedShipments: [],
    invoiceStatus: opts.status,
    ...(opts.status !== 'Draft' ? { submittedBy: opts.by, submittedAt: atIso(invoiceDate, 9) } : {}),
    ...(posted ? approvedMeta(invoiceDate, opts.by) : {}),
    ...(posted && opts.sent ? sentMeta(c, opts.n, invoiceDate, opts.by, 'Advance Invoice') : {}),
    lines,
    createdBy: opts.by,
    ...opts.extra,
  };
}

// ── Pinned story rows ──
function pinnedInvoices(): CustomerInvoice[] {
  const rows: CustomerInvoice[] = [];
  const rural = customer('Rural Equipment Co.');
  const acme = customer('Acme Supplies Co.');
  const coastal = customer('Coastal Logistics LLC');
  const central = customer('Central Warehouse Solutions');
  const mountain = customer('Mountain Equipment Co.');
  const western = customer('Western Manufacturing Inc.');
  const atlantic = customer('Atlantic Electronics');
  const urban = customer('Urban Industrial Group');
  const [A, B, C, D] = PINNED_CREATORS;

  // Shipped in full, sent, now past its Net 30 due date.
  rows.push(shipmentInvoice({
    n: 'INV-000101', c: rural, shipments: [shpOf(rural, 'SHP 3001')], invoiceAgo: 50, status: 'Approved', sent: true, by: A,
    description: 'Insulation wrap and pressure sensors for the loading dock retrofit, shipped in full on SHP 3001',
    extra: { charges: [{ id: 'ch-1', type: 'Handling', description: 'Liftgate delivery', amount: 85, account: CHARGE_DEFAULT_ACCOUNT.Handling }] },
  }));

  // Sent, partially paid.
  rows.push(shipmentInvoice({
    n: 'INV-000102', c: acme, shipments: [shpOf(acme, 'SHP 3009')], invoiceAgo: 17, status: 'Approved', sent: true, by: B,
    description: 'First part shipment of relay boards and lubricant drums on SO 2010',
  }));
  rows[1].receipts = [{ id: 'rc-1001-1', date: daysFromToday(-6), method: 'ACH', reference: 'ACH-771204', amount: round2(rows[1].amount * 0.45) }];

  // 30% deposit on SO 2021: billed at order confirmation, paid.
  const so2021 = soOf(coastal, '2021');
  rows.push(advanceInvoice({
    n: 'INV-000088', c: coastal, so: so2021, stageIndex: 1, invoiceAgo: 44, status: 'Approved', sent: true, by: C,
    description: '30% deposit at order confirmation on SO 2021',
    extra: { depositReceived: true },
  }));

  // 50% at order confirmation on SO 2024, sent, deposit awaited.
  rows.push(advanceInvoice({
    n: 'INV-000089', c: central, so: soOf(central, '2024'), stageIndex: 1, invoiceAgo: 13, status: 'Approved', sent: true, by: D,
    description: '50% at order confirmation on SO 2024, before production',
  }));

  // SO 2021 shipped: the balance invoice bills only the 70% the advance did not cover (BR-009).
  rows.push(shipmentInvoice({
    n: 'INV-000103', c: coastal, shipments: [shpOf(coastal, 'SHP 3014')], advanceShare: 0.3, advanceRef: 'INV-000088',
    invoiceAgo: 20, status: 'Approved', sent: true, by: C,
    description: 'Balance invoice for SO 2021 once SHP 3014 went out, 30% already billed on INV-000088',
  }));

  // Standalone, pending approval.
  rows.push({
    id: 'cinv-INV-000104',
    invoiceNumber: 'INV-000104',
    docKind: 'Standalone',
    customer: atlantic.customerName,
    customerPONumber: 'REF-Q3-COMM',
    invoiceDate: daysFromToday(-4),
    createdDate: daysFromToday(-4),
    postingDate: daysFromToday(-4),
    triggerDate: daysFromToday(-4),
    dueDate: daysFromToday(11),
    paymentTermId: atlantic.paymentTermId,
    paymentTerms: atlantic.paymentTerms,
    ...base(atlantic),
    amount: 2750,
    description: 'On-site commissioning service for the Q3 install, one-off charge, no sales order',
    linkedSOs: [],
    linkedShipments: [],
    invoiceStatus: 'Pending Approval',
    submittedBy: A,
    submittedAt: atIso(daysFromToday(-4), 9),
    lines: [
      { id: 'L1', sku: '', description: 'On-site commissioning service, per technician day', uom: 'd', orderedQty: 2, invoiceQty: 2, unitPrice: 1375, total: 2750, glAccount: '4100 Service Fee Income', chargeTemplateId: 'ct-commission' },
    ],
    createdBy: A,
  });

  // Earlier Western invoice, paid; the return credit below reduces it.
  const westernInv = shipmentInvoice({
    n: 'INV-000095', c: western, shipments: [shpOf(western, 'SHP 3024')], invoiceAgo: 38, status: 'Approved', sent: true, by: B,
    description: 'Shipment invoice for SO 2036 on SHP 3024',
  });
  rows.push(westernInv);

  // Customer credit memo: return credit for part of the first line.
  const creditLine = westernInv.lines[0];
  const creditQty = Math.max(1, Math.floor(creditLine.invoiceQty / 4));
  const creditTotal = round2(creditQty * creditLine.unitPrice);
  westernInv.creditApplied = creditTotal;
  rows.push({
    id: 'cinv-CRN-000003',
    invoiceNumber: 'CRN-000003',
    docKind: 'Credit Memo',
    customer: western.customerName,
    customerPONumber: westernInv.customerPONumber,
    invoiceDate: daysFromToday(-9),
    createdDate: daysFromToday(-9),
    postingDate: daysFromToday(-9),
    ...base(western),
    amount: -creditTotal,
    description: `Return credit on INV-000095, ${creditQty} ${creditLine.uom} damaged: ${creditLine.description.split(',')[0]}`,
    linkedSOs: westernInv.linkedSOs,
    linkedShipments: westernInv.linkedShipments,
    relatedInvoiceNumber: 'INV-000095',
    invoiceStatus: 'Approved',
    creditBasis: 'lines',
    creditReason: 'Return',
    rmaNumber: 'RMA-2025-0042',
    ...approvedMeta(daysFromToday(-9), B),
    ...sentMeta(western, 'CRN-000003', daysFromToday(-9), B, 'Credit Memo'),
    lines: [
      { ...creditLine, id: 'L1', invoiceQty: creditQty, total: -creditTotal, unitPrice: creditLine.unitPrice, grossTotal: undefined, advanceCovered: undefined, glAccount: SALES_RETURNS_ACCOUNT, creditOfLineId: creditLine.id },
    ],
    createdBy: B,
  });

  // Pulled from a shipment, still a Draft.
  rows.push(shipmentInvoice({
    n: 'INV-000105', c: mountain, shipments: [shpOf(mountain, 'SHP 3020')], invoiceAgo: 2, status: 'Draft', by: D,
    description: 'Steel coil and fitting kits shipped on SHP 3020, drafted from the shipment, not yet submitted',
  }));

  // Sent back by the approver.
  rows.push(shipmentInvoice({
    n: 'INV-000106', c: acme, shipments: [shpOf(acme, 'SHP 3010')], invoiceAgo: 3, status: 'Rejected', by: A,
    description: 'Second part shipment on SO 2010',
    extra: {
      rejectionReason: 'Customer PO number is missing the release suffix. Use CPO-5127-R2 as printed on their order.',
      actionHistory: [{ action: 'reject', reason: 'Customer PO number is missing the release suffix. Use CPO-5127-R2 as printed on their order.', by: 'Eli Mansour', at: atIso(daysFromToday(-2), 11) }],
    },
  }));

  // Half of a part shipment billed, waiting on the approver.
  rows.push(shipmentInvoice({
    n: 'INV-000107', c: rural, shipments: [shpOf(rural, 'SHP 3002')], share: 0.5, invoiceAgo: 1, status: 'Pending Approval', by: B,
    description: 'Half of SHP 3002 billed now at the customer request, the rest on a later invoice',
  }));

  // Standalone approved, not sent yet.
  rows.push({
    id: 'cinv-INV-000108',
    invoiceNumber: 'INV-000108',
    docKind: 'Standalone',
    customer: urban.customerName,
    customerPONumber: 'SVC-2025-14',
    invoiceDate: daysFromToday(-1),
    createdDate: daysFromToday(-1),
    postingDate: daysFromToday(-1),
    triggerDate: daysFromToday(-1),
    dueDate: daysFromToday(29),
    paymentTermId: urban.paymentTermId,
    paymentTerms: urban.paymentTerms,
    ...base(urban),
    amount: 3050,
    description: 'Quarterly calibration visits and tooling for the press line',
    linkedSOs: [],
    linkedShipments: [],
    invoiceStatus: 'Approved',
    ...approvedMeta(daysFromToday(-1), C),
    lines: [
      { id: 'L1', sku: '', description: 'Quarterly calibration visit under the service contract', uom: 'EA', orderedQty: 1, invoiceQty: 1, unitPrice: 650, total: 650, glAccount: '4100 Service Fee Income', chargeTemplateId: 'ct-calibration' },
      { id: 'L2', sku: '', description: 'Custom tooling and fixture build for the order', uom: 'EA', orderedQty: 1, invoiceQty: 1, unitPrice: 2400, total: 2400, glAccount: '4150 Tooling Income', chargeTemplateId: 'ct-tooling' },
    ],
    createdBy: C,
  });

  // Advance from a confirmed quote, still a draft.
  const q5004 = mountain.quotes.find((q) => q.quoteNumber === 'Q-5004')!;
  rows.push(advanceInvoice({
    n: 'INV-000109', c: mountain, quote: q5004, stageIndex: 1, invoiceAgo: 1, status: 'Draft', by: A,
    description: 'Deposit invoice on quote Q-5004 for the customer financing package',
  }));

  // Cancelled and archived.
  rows.push({
    ...shipmentInvoice({
      n: 'INV-000091', c: western, shipments: [shpOf(western, 'SHP 3024')], share: 0.2, invoiceAgo: 36, status: 'Cancelled', by: D,
      description: 'Duplicate of INV-000095, cancelled before approval',
    }),
    archived: true,
    actionHistory: [
      { action: 'cancel', reason: 'Duplicate of INV-000095', by: D, at: atIso(daysFromToday(-36), 12) },
      { action: 'archive', reason: 'Cleanup', by: D, at: atIso(daysFromToday(-30), 12) },
    ],
  });

  return rows;
}

/** Invoices against the seeded filler shipments so some read fully or
 *  partly billed and the rest wait in Ready to Invoice. */
function shipmentBackedFiller(start: number): CustomerInvoice[] {
  const rand = mulberry32(0xB111ED);
  const out: CustomerInvoice[] = [];
  let n = start;
  const pinnedShipments = new Set(['SHP 3001', 'SHP 3002', 'SHP 3009', 'SHP 3010', 'SHP 3011', 'SHP 3014', 'SHP 3020', 'SHP 3021', 'SHP 3024', 'SHP 3025', 'SHP 3026', 'SHP 3027', 'SHP 3028']);
  for (const c of mockCustomers) {
    for (const s of c.shipments) {
      if (pinnedShipments.has(s.shipmentNumber) || s.status !== 'Shipped') continue;
      const roll = rand();
      if (roll < 0.4) {
        out.push(shipmentInvoice({
          n: formatInvoiceId(111 + n++), c, shipments: [s], invoiceAgo: Math.max(1, Math.floor(rand() * 20)), status: 'Approved', sent: rand() < 0.8,
          by: PINNED_CREATORS[Math.floor(rand() * PINNED_CREATORS.length)],
          description: `Shipment invoice for SO ${s.soNumber} on ${s.shipmentNumber}`,
        }));
      } else if (roll < 0.55) {
        out.push(shipmentInvoice({
          n: formatInvoiceId(111 + n++), c, shipments: [s], share: 0.5, invoiceAgo: Math.max(1, Math.floor(rand() * 10)), status: rand() < 0.5 ? 'Approved' : 'Pending Approval',
          by: PINNED_CREATORS[Math.floor(rand() * PINNED_CREATORS.length)],
          description: `Partial billing of ${s.shipmentNumber}, remainder to follow`,
        }));
      }
    }
  }
  return out;
}

// ── Historical filler: older invoices for volume on the All Invoices tab ──
const FILLER_DESCRIPTIONS = [
  'Monthly replenishment order, shipped complete from the Columbus DC',
  'Spring catalog resale merchandise, second of three releases',
  'Managed switches and patch cables for the customer site refresh',
  'Palletized steel coil, freight billed to the customer',
  'Service contract billing for quarterly calibration visits',
  'Partial shipment of the standing blanket order, remainder to follow',
  'Rush order shipped air, expedite fee included',
  'Consolidated weekly deliveries for the retail stores',
];

function historicalFiller(count: number, startIdx: number): CustomerInvoice[] {
  const rand = mulberry32(0xC0FFEE5);
  const invoices: CustomerInvoice[] = [];
  const active = mockCustomers.filter((c) => c.arAccount);
  const creators = [...PINNED_CREATORS, 'John Smith', 'Sarah Johnson', 'Mike Wilson', 'Emily Brown', 'David Lee'];
  const SPAN = 330;

  for (let i = 0; i < count; i++) {
    const n = startIdx + i;
    const ageDays = Math.floor((1 - i / count) * SPAN) + 25;
    const invoiceDate = daysFromToday(-ageDays);
    const c = active[Math.floor(rand() * active.length)];
    const kindRoll = rand();
    const docKind: CustomerDocKind =
      kindRoll < 0.66 ? 'Shipment Invoice' : kindRoll < 0.78 ? 'Advance Invoice' : kindRoll < 0.92 ? 'Standalone' : 'Credit Memo';
    const createdBy = creators[Math.floor(rand() * creators.length)];

    const statusRoll = rand();
    let invoiceStatus: CustomerInvoiceStatus =
      statusRoll < 0.04 ? 'Draft'
        : statusRoll < 0.1 ? 'Pending Approval'
          : statusRoll < 0.88 ? 'Approved'
            : statusRoll < 0.93 ? 'Rejected'
              : 'Cancelled';
    if (docKind === 'Credit Memo') invoiceStatus = rand() < 0.85 ? 'Approved' : 'Pending Approval';
    const approved = invoiceStatus === 'Approved';
    const sent = approved && rand() < 0.9;
    const item = ['ITM-2210', 'ITM-4402', 'ITM-1188', 'ITM-5580'][Math.floor(rand() * 4)];
    const unitPrice = { 'ITM-2210': 96.5, 'ITM-4402': 62, 'ITM-1188': 1890, 'ITM-5580': 1240 }[item]!;
    const qty = Math.max(1, Math.floor((2000 + rand() * 40000) / unitPrice));
    const gross = round2(qty * unitPrice);
    const so = String(1700 + n);
    const shp = `SHP ${2600 + n}`;
    const term = arTermById(c.paymentTermId)!;
    const termDays = netDaysFor('Shipment Invoice', term);
    const freight = docKind === 'Shipment Invoice' ? round2(90 + rand() * 400) : 0;
    const charges: CustomerInvoiceCharge[] = docKind === 'Shipment Invoice' && rand() < 0.25
      ? [{ id: 'ch-1', type: 'Tax', description: 'Sales tax', amount: round2(gross * 0.06), account: CHARGE_DEFAULT_ACCOUNT.Tax }]
      : [];

    let lines: CustomerInvoiceLine[];
    let amount: number;
    if (docKind === 'Advance Invoice') {
      const pct = [30, 50, 20][Math.floor(rand() * 3)];
      const total = round2(gross * pct / 100);
      lines = [{ id: 'L1', sku: item, description: 'Advance on ordered goods', uom: 'EA', orderedQty: qty, shippedQty: 0, invoiceQty: qty, unitPrice, total, glAccount: '', soNumber: so, advancePercent: pct }];
      amount = total;
    } else if (docKind === 'Standalone') {
      lines = [{ id: 'L1', sku: '', description: 'Service fee', uom: 'EA', orderedQty: 1, invoiceQty: 1, unitPrice: round2(gross / 10), total: round2(gross / 10), glAccount: '4100 Service Fee Income' }];
      amount = lines[0].total;
    } else if (docKind === 'Credit Memo') {
      const credit = round2(gross / 12);
      lines = [{ id: 'L1', sku: '', description: 'Price adjustment', uom: 'EA', orderedQty: 1, invoiceQty: 1, unitPrice: credit, total: -credit, glAccount: DEFAULT_REVENUE_ACCOUNT }];
      amount = -credit;
    } else {
      lines = [{ id: 'L1', sku: item, description: 'Shipped goods', uom: 'EA', orderedQty: qty, shippedQty: qty, invoiceQty: qty, unitPrice, originalUnitPrice: unitPrice, grossTotal: gross, total: gross, glAccount: revenueAccountFor(item, c) ?? DEFAULT_REVENUE_ACCOUNT, soNumber: so, shipmentNumber: shp }];
      amount = round2(gross + freight + charges.reduce((s, ch) => s + ch.amount, 0));
    }

    const receipts: ReceiptApplication[] = [];
    let writtenOff = false;
    if (sent && (docKind === 'Shipment Invoice' || docKind === 'Standalone')) {
      const payRoll = rand();
      if (payRoll < 0.55) receipts.push({ id: `rc-f${n}`, date: daysFromToday(-Math.max(1, ageDays - 25)), method: rand() < 0.6 ? 'ACH' : 'Wire', reference: `ACH-${String(100000 + Math.floor(rand() * 899999))}`, amount });
      else if (payRoll < 0.7) receipts.push({ id: `rc-f${n}`, date: daysFromToday(-Math.max(1, ageDays - 20)), method: 'ACH', reference: `ACH-${String(100000 + Math.floor(rand() * 899999))}`, amount: round2(amount * (0.2 + rand() * 0.5)) });
      else if (payRoll < 0.73) writtenOff = true;
    }

    const number = docKind === 'Credit Memo' ? formatInvoiceId(n - 896, 'CRN') : formatInvoiceId(n - 899);
    const isPosting = docKind !== 'Advance Invoice';
    const inv: CustomerInvoice = {
      id: `cinv-${number}`,
      invoiceNumber: number,
      docKind,
      customer: c.customerName,
      customerPONumber: rand() < 0.6 ? `CPO-${String(4000 + Math.floor(rand() * 5000))}` : undefined,
      invoiceDate,
      createdDate: invoiceDate,
      postingDate: isPosting ? invoiceDate : undefined,
      triggerDate: docKind === 'Credit Memo' ? undefined : invoiceDate,
      dueDate: docKind === 'Credit Memo' ? undefined : addDays(invoiceDate, docKind === 'Advance Invoice' ? 0 : termDays),
      paymentTermId: docKind === 'Credit Memo' ? undefined : term.id,
      paymentTerms: docKind === 'Credit Memo' ? undefined : term.name,
      ...base(c),
      depositAccount: docKind === 'Advance Invoice' ? c.depositAccount : undefined,
      amount,
      freightAmount: freight > 0 ? freight : undefined,
      freightAccount: freight > 0 ? FREIGHT_INCOME_ACCOUNT : undefined,
      charges,
      description: docKind === 'Credit Memo' ? 'Price adjustment agreed with the customer' : FILLER_DESCRIPTIONS[Math.floor(rand() * FILLER_DESCRIPTIONS.length)],
      linkedSOs: docKind === 'Shipment Invoice' || docKind === 'Advance Invoice' ? [so] : [],
      linkedShipments: docKind === 'Shipment Invoice' ? [shp] : [],
      relatedInvoiceNumber: docKind === 'Credit Memo' ? formatInvoiceId(Math.max(1, n - 902)) : undefined,
      invoiceStatus,
      archived: invoiceStatus === 'Cancelled' && rand() < 0.4 ? true : undefined,
      rejectionReason: invoiceStatus === 'Rejected' ? 'Quantities do not match the packing slip.' : undefined,
      creditBasis: docKind === 'Credit Memo' ? 'amount' : undefined,
      creditReason: docKind === 'Credit Memo' ? 'Price adjustment' : undefined,
      ...(invoiceStatus !== 'Draft' ? { submittedBy: createdBy, submittedAt: atIso(invoiceDate, 9) } : {}),
      ...(approved ? approvedMeta(invoiceDate, createdBy) : {}),
      ...(sent ? sentMeta(c, number, invoiceDate, createdBy, docKind === 'Credit Memo' ? 'Credit Memo' : docKind === 'Advance Invoice' ? 'Advance Invoice' : 'Invoice') : {}),
      writtenOff: writtenOff || undefined,
      disputed: docKind === 'Shipment Invoice' && sent && rand() < 0.08 ? true : undefined,
      creditHold: docKind !== 'Credit Memo' && rand() < 0.06 ? true : undefined,
      depositReceived: docKind === 'Advance Invoice' && sent && rand() < 0.6 ? true : undefined,
      lines,
      createdBy,
      updatedBy: rand() < 0.5 ? createdBy : creators[Math.floor(rand() * creators.length)],
      updatedDate: daysFromToday(-Math.max(0, ageDays - Math.floor(rand() * 20))),
    };
    invoices.push(inv);
  }
  return invoices;
}

const pinned = pinnedInvoices();
const backed = shipmentBackedFiller(0);
const assembled: CustomerInvoice[] = [
  ...pinned,
  ...backed,
  ...historicalFiller(Math.max(0, 90 - pinned.length - backed.length), 900),
];
// ── FAD 11/2 seeds: pre-invoice treatment, settlement at shipment,
// dispute and exception detail. Deterministic, so every refresh reads
// the same story. ──
function seedFad(rows: CustomerInvoice[]): CustomerInvoice[] {
  const advances = rows.filter((i) => i.docKind === 'Advance Invoice');
  // Most advances hold the money as a Deposit; every third one books Revenue.
  advances.forEach((a, idx) => {
    a.treatment = a.invoiceNumber === 'INV-000089' || (idx % 3 === 2 && a.invoiceNumber !== 'INV-000088') ? 'Revenue' : 'Deposit';
  });
  // A Revenue pick the revenue gate turned into a Deposit.
  const gated = advances.find((a) => a.treatment === 'Deposit' && a.invoiceStatus === 'Approved' && a.invoiceNumber !== 'INV-000088');
  if (gated) gated.treatmentNote = 'Units not on hand at posting, so revenue is booked on shipment.';
  // Settlement at shipment: a Deposit pre-invoice recognises revenue on
  // the SAME invoice as each shipment goes out (Eli, confirm).
  const settleable = advances.filter(
    (a) => a.treatment === 'Deposit' && a.invoiceStatus === 'Approved' && a.depositReceived && a.invoiceNumber !== 'INV-000088' && a !== gated,
  );
  settleable.slice(0, 2).forEach((a, k) => {
    const shares = k === 0 ? [0.4, 0.25] : [0.5];
    const units = a.lines.reduce((s, l) => s + l.orderedQty, 0);
    const shipBase = 4100 + k * 10;
    // Amounts follow the units that shipped, so settled + held = the advance.
    const perUnit = units > 0 ? a.amount / units : 0;
    let left = Math.max(0, units - 1);
    a.settlements = shares.map((share, j) => {
      const u = Math.min(left, Math.max(1, Math.round(units * share)));
      left -= u;
      return {
        shipmentNumber: `SHP ${shipBase + j}`,
        date: addDays(a.invoiceDate, 12 + j * 9) > daysFromToday(0) ? daysFromToday(-1 - j) : addDays(a.invoiceDate, 12 + j * 9),
        units: u,
        amount: round2(u * perUnit),
      };
    }).filter((x) => x.units > 0);
    // The lines show what shipped.
    let shipped = a.settlements.reduce((t, x) => t + x.units, 0);
    a.lines.forEach((l) => {
      const take = Math.min(l.orderedQty, shipped);
      l.shippedQty = take;
      shipped -= take;
    });
    a.linkedShipments = a.settlements.map((x) => x.shipmentNumber);
  });
  // Who flagged the disputes, and why.
  const DISPUTE_REASONS = ['Pricing disagreement', 'Quantity disagreement', 'Damaged goods', 'Not received'];
  rows.filter((i) => i.disputed).forEach((i, idx) => {
    i.disputeDetail = {
      reason: `${DISPUTE_REASONS[idx % DISPUTE_REASONS.length]}: customer contested the invoice on the remittance call`,
      by: PINNED_CREATORS[idx % PINNED_CREATORS.length],
      at: atIso(addDays(i.invoiceDate, 6), 11),
    };
  });
  // One exception waiting on the approver.
  const exc = rows.find((i) => i.invoiceNumber === 'INV-000107');
  if (exc) exc.exception = { reason: 'Quantity variance: customer PO release shows fewer units than the half shipment billed', by: PINNED_CREATORS[1], at: atIso(daysFromToday(-1), 14) };
  return rows;
}
seedFad(assembled);

// Invoice numbers (SI-) run in invoice-date order, independent of the IDs.
const siOrder = [...assembled].filter((i) => i.docKind !== 'Credit Memo').sort((a, b) => a.invoiceDate.localeCompare(b.invoiceDate) || a.invoiceNumber.localeCompare(b.invoiceNumber));
const siById = new Map(siOrder.map((i, idx) => [i.id, `SI-${String(idx + 1).padStart(6, '0')}`]));
export const mockCustomerInvoices: CustomerInvoice[] = assembled.map((i) => (siById.has(i.id) ? { ...i, documentNumber: siById.get(i.id) } : i));
