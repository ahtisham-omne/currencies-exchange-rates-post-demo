import { mulberry32 } from './seededRandom';
import { daysForPreset, presetForVendor } from './paymentTermPresets';
import { formatInvoiceId } from '@/app/lib/invoiceIds';
import { resolveRegistryVendor } from './mockVendors';
import { currencyForVendorName, stampRate } from '@/app/currency/invoiceFx';
import type { RateType } from '@/app/currency/rates';
import type { RateDateBasis } from '@/app/hooks/useApSettings';

/** The date an invoice's rate was taken on: a module rate-date basis, the
 *  posting date (seeds), or the payment date (a pre-invoice). */
export type InvoiceRateBasis = RateDateBasis | 'postingDate' | 'paidDate';

// Seeded so the listing renders the same 100 invoices on every
// reload — only state mutations (new invoice, status change, etc.)
// should change what the table shows. Bump the seed if a future
// schema change needs a fresh dataset.
const rand = mulberry32(0x100CE10);
// Separate stream for the audit fields (Last Updated By/On) so adding
// them doesn't shift the main sequence and reshuffle the whole dataset.
const auditRand = mulberry32(0x0A0D17);

/** System invoice numbers are OMNE-generated IN SEQUENCE (9/22/26 user
 *  report + GPT F24): INV-<year>-<seq>, continuing after the highest
 *  seeded 2026 number. The typed vendor invoice number never becomes the
 *  record's identity — it lives in vendorInvoiceNumber. Each call
 *  reserves the next number; an abandoned create leaves a gap, exactly
 *  like a real ERP sequence. */
let systemInvoiceSeq = 217;
export function nextSystemInvoiceNumber(): string {
  return formatInvoiceId(systemInvoiceSeq++);
}

export interface InvoiceActionHistoryEntry {
  action: string;
  reason: string;
  by: string;
  at: string;
  /** SYSTEM_USERS / SYSTEM_ROLES ids picked in the action's notify
   *  block — resolve flows offer to notify the same people again
   *  (feedback 7/20/26). */
  notifiedRecipientIds?: string[];
  /** Supporting document names attached with the action (9/4/26 Eli,
   *  BB-16/BB-24): exceptions, resolutions and hold releases all carry
   *  their documentation — "here's the documentation that he cleared
   *  the exception with." */
  attachments?: string[];
}

/** One explicit additional-charge line persisted at creation (9/22/26
 *  review response): user-created invoices carry exactly the charges the
 *  form held; nothing is synthesized for them. */
export interface InvoiceChargeLine {
  label: string;
  amount: number;
  glAccount: string;
}

export interface InvoiceCharges {
  /** Always 0 from the create screen: the form has no tax field and the
   *  Sep 2 accounts draft keeps tax out of Billy Bob. */
  tax: number;
  freight: number;
  freightGlAccount: string;
  additional: InvoiceChargeLine[];
}

/** A line item exactly as entered on the create form, persisted so the
 *  detail page renders the record instead of a synthesized set. */
export interface SavedInvoiceLineItem {
  sku: string;
  description: string;
  quantity: number;
  uom: string;
  unitPrice: number;
  lineTotal: number;
  glAccount: string;
  poNumber?: string;
  grnNumbers?: string[];
  /** Source-document quantities (Eli 9/24 R02): the PO's ordered and the
   *  receipts' received amounts persist SEPARATELY from the editable
   *  invoice quantity, so the saved detail can show 100 ordered / 15
   *  received / 10 invoiced instead of collapsing all three. */
  orderedQty?: number;
  receivedQty?: number;
  /** The PO unit price when the invoice billed a different one (Mahreen
   *  10/10): an edit re-seeds it so the price difference stays on the
   *  Inventory line. */
  poUnitPrice?: number;
}

/** GL snapshot taken at submit from the same rule the confirmation
 *  renders, so the preview and the saved entry can never disagree. */
export interface InvoiceGlEntry {
  accountCode: string;
  accountName: string;
  description?: string;
  debit?: number;
  credit?: number;
  /** Foreign-currency invoices (Currency & Exchange Rates): debit / credit
   *  are base currency at `rate`; this is the line in the invoice currency. */
  currency?: string;
  foreignAmount?: number;
  rate?: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  type: string;
  vendor: string;
  vendorInvoiceNumber: string;
  reference: string;
  date: string;
  invoiceDate: string;
  createdDate: string;
  dueDate: string;
  /** The date the payment clock runs from (8/25/26): the receiving date
   *  when the term's trigger is Receiving, the vendor invoice date for
   *  Invoice Date terms, or a manually keyed date for other triggers.
   *  Due date = trigger date + term days. Unset on pre-invoices whose
   *  receiving trigger hasn't fired yet. */
  triggerDate?: string;
  /** The trigger event the payment clock runs from ("Order Confirmation",
   *  "Shipping", ...), persisted at create so the detail page reads the
   *  chosen event back instead of assuming receiving (BA 9/28). */
  triggerEvent?: string;
  amount: number;
  outstandingBalance: number;
  currency: string;
  /** Base currency per one unit of `currency`, taken on the posting date
   *  (Currency & Exchange Rates, spec 4.4); 1 on base-currency invoices.
   *  A/P posts at this rate, and a payment is later compared against it.
   *  Unset until posted (a pre-invoice posts when it is paid). */
  exchangeRate?: number;
  /** Mid-market (read-only on the invoice) or corporate (editable). */
  rateType?: RateType;
  /** The day the rate is for: the posting date it was taken on. */
  rateDate?: string;
  /** A corporate rate changed on the invoice from the rate table. */
  rateEdited?: boolean;
  /** Which date the rate was taken on (the "Rate as of" date): the module
   *  default when the invoice was entered (vendor invoice date, receiving
   *  date or PO date), the posting date on the seeds, or the payment date on
   *  a pre-invoice. Absent reads as the posting date. */
  rateBasis?: InvoiceRateBasis;
  apAccount: string;
  description: string;
  postingDate?: string;
  linkedPOs: string[];
  linkedGRNs: string[];
  status: string;
  createdBy: string;
  /** Audit trail: last touch. Optional so UI-created invoices fall back
   *  to created-by/on (a fresh invoice's last update IS its creation). */
  updatedDate?: string;
  updatedBy?: string;
  // Additive fields (PRD §4.1, §4.2, §1.7.4)
  is_payment_held?: boolean;
  is_exception?: boolean;
  actionHistory?: InvoiceActionHistoryEntry[];
  /** File names attached to the record itself — e.g. inside Edit Invoice
   *  (VI-13). Surfaced on the Attachments tab as invoice documents. */
  attachments?: string[];
  /** Reconciliation (Eli, 8/31/26): prepayments consumed at invoice
   *  creation ride the invoice as settlement lines reducing the
   *  payable; the pre-invoices they came from close when reconciled
   *  and the records stay linked. */
  /** Prepayments applied at creation, each with the rate its pre-invoice
   *  was paid at (Currency & Exchange Rates). */
  appliedPrepayments?: { invoiceNumber: string; amount: number; rate?: number; rateDate?: string }[];
  /** Pre-invoice numbers this invoice reconciles (closes on create). */
  reconcilesPreInvoiceNumbers?: string[];
  /** Set on a PRE-INVOICE when it settles: the receiving invoice its
   *  prepayment applied to. Drives the Reconciled card, the timeline
   *  node, and the forward linked record on the pre-invoice side. */
  reconciledIntoInvoiceNumber?: string;
  /** True for records created in this session (create paths + import).
   *  Detail surfaces render ONLY persisted data for these records —
   *  seeded invoices keep their synthesized richness, user-created
   *  records stay faithful to what the form held (9/20/26 reviews). */
  isUserCreated?: boolean;
  /** The term chosen on the create form, verbatim (e.g. "Net 45 Post
   *  Receiving"), so the record never falls back to the vendor default. */
  paymentTerms?: string;
  /** The total printed on the vendor's document, captured for the
   *  reconciliation check (GPT QC12, 9/30 — S3 requires comparing it
   *  with the calculated total). Absent = not provided. */
  vendorStatedTotal?: number;
  /** Why what we pay differs from vendorStatedTotal ("Vendor billed" vs
   *  "We're paying" on the detail page). */
  differenceReason?: string;
  /** Explicit charges as entered; absent on seeds (synthesized there). */
  charges?: InvoiceCharges;
  /** Lines exactly as entered; absent on seeds. */
  savedLineItems?: SavedInvoiceLineItem[];
  /** GL snapshot from the shared posting rule; absent on seeds. */
  glEntries?: InvoiceGlEntry[];
  /** Archive is a lifecycle flag independent of status (9/22/26 review
   *  response, GPT F17): a cancelled invoice stays Cancelled AND
   *  archived, and the flag survives navigation because it lives on the
   *  record, not in page state. */
  isArchived?: boolean;
  /** The status an invoice held immediately before it was cancelled
   *  (user 10/5): "Uncancel" restores THIS exact state (a cancelled
   *  Partially Paid invoice uncancels back to Partially Paid, not a blanket
   *  Pending Approval). Set when cancelling, cleared on uncancel. */
  statusBeforeCancel?: string;
  /** Credit memo total applied this session (Mahreen 10/10): credits
   *  lower the balance but are never payments, so every "partially
   *  paid" check reads cash = amount − outstanding − creditedAmount. */
  creditedAmount?: number;
  /** Real byte sizes of uploaded attachments by file name (BA 10/10). */
  attachmentSizes?: Record<string, number>;
  /** Transient display fact, derived per render from payment state
   *  (9/22/26 review response): a recorded run has scheduled money for
   *  this invoice, so the Payment Status axis reads Scheduled instead of
   *  Unpaid. Never persisted on the record itself. */
  paymentScheduled?: boolean;
}

const vendors = [
  'Global Logistics Partners',
  'Tech Innovations Supply',
  'Premium Materials Corp',
  'Swift Distribution Ltd',
  'Quality Components Inc',
  'Metro Wholesale Group',
  'Pacific Trading Co',
  'Elite Suppliers Network',
  'Acme Supplies Co.',
  'Premier Automotive',
  'Tech Components Inc.',
  'Global Materials Corp',
  'Midwest Manufacturing',
  'Pacific Steel Works',
  'Atlantic Electronics',
  'Summit Distribution',
  'Valley Wholesale',
  'Mountain Equipment Co.',
  'Coastal Logistics LLC',
  'Northern Trading Group',
  'Southern Industrial Supply',
  'Eastern Parts Depot',
  'Western Manufacturing Inc.',
  'Central Warehouse Solutions',
  'Metro Office Supplies',
  'Urban Industrial Group',
  'Rural Equipment Co.',
  'Suburban Services Inc.'
];

// Draft was retired from the workflow — invoices created in the UI now
// land in "Pending Approval" directly. "Rejected" added per BA UX
// feedback so the listing can render an invoice in every possible
// state (Approver-rejected, terminal — separate from Cancelled).
const statuses: Invoice['status'][] = [
  'Pending Approval',
  'Approved',
  'Partially Paid',
  'Paid in Full',
  'Exception',
  'Payment Hold',
  'Rejected',
  'Cancelled'
];

const types: Invoice['type'][] = ['PO-based', 'Receiving-based', 'Standalone', 'Pre-Invoice'];

// The first listing rows are pinned to the real team in order
// (feedback 7/16/26; Irtaza above Rida 8/12/26): Ahtisham, Eli,
// Mahreen, Irtaza, Rida. Every other row draws randomly from the whole
// roster. Shared convention across all mock datasets so every data
// table leads with the same names.
export const PINNED_CREATORS = ['Ahtisham Ahmad', 'Eli Rosenbloom', 'Mahreen Ghafoor', 'Irtaza Abid', 'Rida Iftikhar'];
// The whole roster, exported for assignee pickers (8/5/26).
export const TEAM_ROSTER = [
  ...PINNED_CREATORS,
  'John Smith',
  'Sarah Johnson',
  'Mike Wilson',
  'Emily Brown',
  'David Lee',
  'Jessica Martinez',
  'Robert Chen',
  'Amanda White'
];
const users = TEAM_ROSTER;

const apAccounts = [
  '2100-AP',
  '2110-AP-Trade',
  '2120-AP-Services',
  '2130-AP-Utilities',
  '2140-AP-Rent'
];

// Written the way a real AP clerk would describe the bill (peer review
// 7/7/26): what was bought, how much of it, and the period or order it
// belongs to.
const descriptions = [
  'Copy paper, toner and desk supplies for the Chicago office, June restock',
  '400 units of 24V relay boards for the assembly line, order PO-2024-0871',
  'Cold rolled steel coil, 12 tons for the fabrication shop',
  'Overnight freight on 6 pallets, Dallas to Columbus',
  '250 hydraulic fittings, goods received in part, remainder in transit',
  'Warehouse restock: shrink wrap, strapping and 500 pallet labels',
  'Resale merchandise for the spring catalog, 1,200 assorted items',
  '2 managed switches and 48 patch cables for the server room refresh',
  'Contract trucking for weekly store deliveries, week of invoice date',
  'Bearing kits and drive belts for the stamping press, preventive stock',
  '15 laptops with docking stations, new hire onboarding batch',
  'Drywall, lumber and fasteners for the loading dock buildout',
  '10,000 printed shipping cartons, 3 sizes, with company branding',
  'Quarterly equipment calibration and safety inspection service',
  'Janitorial and HVAC filter supplies, monthly replenishment',
  'Quarterly restock of safety gloves and high visibility vests for the Milwaukee floor crew, net of the agreed volume rebate',
  'Annual boiler service and combustion tune for the Columbus plant, parts and labor on one ticket',
  'Spot buy of 800 corrugated mailers to cover the holiday promo overflow, rush production surcharge included',
  'Powder coating of 1,450 bracket assemblies, priced per the 2026 rate card',
  'Replacement forklift tires and scheduled 500 hour service on units FL-03 and FL-07'
];

function generateInvoices(count: number): Invoice[] {
  const invoices: Invoice[] = [];
  // Spread invoice dates over the last ~365 days so the Performance
  // Insights date-range dropdown (Last 7/30/90 days, Last 12 months,
  // All time) actually filters real data instead of empty windows.
  const today = new Date();
  const SPAN_DAYS = 365;
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - SPAN_DAYS);

  for (let i = 0; i < count; i++) {
    const invoiceDate = new Date(startDate);
    invoiceDate.setDate(startDate.getDate() + Math.floor((i / count) * SPAN_DAYS));

    const createdDate = new Date(invoiceDate);
    createdDate.setDate(invoiceDate.getDate() + Math.floor(rand() * 3));

    const vendor = vendors[Math.floor(rand() * vendors.length)];
    // Due date runs from the trigger date, not the posting date (8/25/26).
    // Mock rows anchor the trigger to the vendor invoice date and add the
    // vendor's NET term days (30 when the term has no fixed offset).
    const termDays = daysForPreset(presetForVendor(vendor)) || 30;
    const dueDate = new Date(invoiceDate);
    dueDate.setDate(invoiceDate.getDate() + termDays);
    // The first three rows walk the user through the invoice journey in
    // order (design feedback 7/8/26): a PO-based inventory invoice, then
    // a pre-invoice, then a standalone — all entering at Pending
    // Approval, the workflow's starting state. Everything after is a
    // seeded mix of types and statuses.
    const JOURNEY_TYPES: Invoice['type'][] = ['PO-based', 'Pre-Invoice', 'Standalone'];
    const type = i < JOURNEY_TYPES.length
      ? JOURNEY_TYPES[i]
      : types[Math.floor(rand() * types.length)];
    const status = i < JOURNEY_TYPES.length
      ? ('Pending Approval' as Invoice['status'])
      : statuses[Math.floor(rand() * statuses.length)];
    const amount = Math.floor(rand() * 50000) + 5000;
    // rand() is drawn either way so the seeded stream (and every field
    // after it) stays identical whether or not the row is pinned.
    const randomCreator = users[Math.floor(rand() * users.length)];
    const createdBy = i < PINNED_CREATORS.length ? PINNED_CREATORS[i] : randomCreator;
    const apAccount = apAccounts[Math.floor(rand() * apAccounts.length)];
    const description = descriptions[Math.floor(rand() * descriptions.length)];
    
    // Calculate outstanding balance based on status
    let outstandingBalance = amount;
    if (status === 'Paid in Full') {
      outstandingBalance = 0;
    } else if (status === 'Partially Paid') {
      outstandingBalance = Math.floor(amount * (rand() * 0.5 + 0.2));
    }
    
    // Generate vendor invoice number
    const vendorPrefix = vendor.split(' ')[0].substring(0, 3).toUpperCase();
    const vendorInvoiceNumber = `${vendorPrefix}-${String(1000 + Math.floor(rand() * 9000))}`;
    
    // Generate linked POs and GRNs based on type.
    //   PO-based         -> PO(s) only
    //   Receiving-based  -> PO(s) + GRN(s) (3-way match story)
    //   Pre-Invoice      -> PO(s) ONLY, never receivers. A pre-invoice is billed
    //                       against a PO before goods are received; the moment a
    //                       receiving document exists it is no longer a
    //                       pre-invoice (it becomes a normal Receiving-based
    //                       invoice). This mirrors the ERP rule enforced in the
    //                       creation flow (isPreInvoice = grns.length === 0).
    //   Standalone       -> neither
    const linkedPOs: string[] = [];
    const linkedGRNs: string[] = [];

    if (type === 'PO-based' || type === 'Receiving-based' || type === 'GRN-based' || type === 'Pre-Invoice') {
      const poCount = Math.floor(rand() * 3) + 1;
      for (let j = 0; j < poCount; j++) {
        linkedPOs.push(String(2000 + i * 10 + j));
      }
    }

    // Receivers attach to every receiving-invoice flavor (PO-based included:
    // per the lifecycle spec a receiving invoice is created from a PO or its
    // receiving documents) — NEVER a Pre-Invoice (a pre-invoice has no
    // receivers by definition).
    if (type === 'PO-based' || type === 'Receiving-based' || type === 'GRN-based') {
      const grnCount = Math.floor(rand() * 2) + 1;
      for (let j = 0; j < grnCount; j++) {
        linkedGRNs.push(`REC-2024-${String(5000 + i * 10 + j).padStart(4, '0')}`);
      }
    }
    
    const invoice: Invoice = {
      id: `inv-${i + 1}`,
      invoiceNumber: formatInvoiceId(1 + i),
      type,
      vendor,
      vendorInvoiceNumber,
      reference: type === 'PO-based' ? linkedPOs[0] || `REF-${i + 1}` : type === 'Receiving-based' ? linkedGRNs[0] || `REF-${i + 1}` : `REF-${i + 1}`,
      date: invoiceDate.toISOString().split('T')[0],
      invoiceDate: invoiceDate.toISOString().split('T')[0],
      createdDate: createdDate.toISOString().split('T')[0],
      dueDate: dueDate.toISOString().split('T')[0],
      // Trigger date is mandatory on every invoice (user 10/5: there is no
      // "set on receiving" row) — all types anchor to the invoice date.
      triggerDate: invoiceDate.toISOString().split('T')[0],
      amount,
      outstandingBalance,
      currency: 'USD',
      apAccount,
      description,
      linkedPOs,
      linkedGRNs,
      status,
      createdBy
    };

    // Last touch lands between creation and today; a different teammate
    // than the creator about half the time, like a real audit trail.
    const updatedDate = new Date(createdDate);
    updatedDate.setDate(createdDate.getDate() + Math.floor(auditRand() * 45));
    if (updatedDate > today) updatedDate.setTime(today.getTime());
    invoice.updatedDate = updatedDate.toISOString().split('T')[0];
    invoice.updatedBy =
      auditRand() < 0.5 ? createdBy : users[Math.floor(auditRand() * users.length)];
    
    // Posting date is the ledger entry date (8/25/26): every type now
    // carries one (user 10/5: dates in every cell, no blank posting date).
    // Standalone keeps its seeded offset so the rand() stream (and every
    // row after) is unchanged; all other types anchor to the created date
    // without drawing from the stream.
    if (type === 'Standalone') {
      const postingDate = new Date(invoiceDate);
      postingDate.setDate(invoiceDate.getDate() + Math.floor(rand() * 5));
      invoice.postingDate = postingDate.toISOString().split('T')[0];
    } else {
      invoice.postingDate = createdDate.toISOString().split('T')[0];
    }
    
    invoices.push(invoice);
  }
  
  return invoices;
}

// A dedicated block of ready-to-pay invoices (feedback 7/22/26): the
// Vendor Payments "Invoices to pay" tab and its Performance Insights KPIs
// were nearly empty because only a handful of seeded invoices were
// Approved. This adds ~100 approved, non-pre-invoice invoices with an
// outstanding balance, spread across due-date urgency buckets (overdue /
// due today / due this week / upcoming) and varied amounts, with most
// created inside the last 30 days so the default KPI range is populated.
function generateReadyToPayInvoices(count: number): Invoice[] {
  const r = mulberry32(0x2EAD7CE);
  const today = new Date();
  const iso = (d: Date) => d.toISOString().split('T')[0];
  const rtpTypes: Invoice['type'][] = ['PO-based', 'Receiving-based', 'Standalone'];
  const out: Invoice[] = [];
  for (let i = 0; i < count; i++) {
    const type = rtpTypes[Math.floor(r() * rtpTypes.length)];
    const vendor = vendors[Math.floor(r() * vendors.length)];
    const amount = Math.floor(r() * 60000) + 1500;

    // Most created within the last 30 days so the Last-30-days KPI band
    // (module default) reflects real numbers; a tail is older.
    const createdAgo = r() < 0.72 ? Math.floor(r() * 30) : 30 + Math.floor(r() * 75);
    const createdDate = new Date(today);
    createdDate.setDate(today.getDate() - createdAgo);
    const invoiceDate = new Date(createdDate);
    invoiceDate.setDate(createdDate.getDate() - Math.floor(r() * 3));

    // Due-date urgency spread so every KPI has something to show.
    const bucket = r();
    const dueOffset =
      bucket < 0.32 ? -(1 + Math.floor(r() * 50)) // overdue
        : bucket < 0.38 ? 0 // due today
          : bucket < 0.58 ? 1 + Math.floor(r() * 6) // due this week
            : 8 + Math.floor(r() * 45); // upcoming
    const dueDate = new Date(today);
    dueDate.setDate(today.getDate() + dueOffset);
    // Keep the trigger math honest: due date = trigger date + term days,
    // so the trigger is back-derived from the urgency-bucketed due date.
    const rtpTermDays = daysForPreset(presetForVendor(vendor)) || 30;
    const triggerDate = new Date(dueDate);
    triggerDate.setDate(dueDate.getDate() - rtpTermDays);

    const vendorPrefix = vendor.split(' ')[0].substring(0, 3).toUpperCase();
    const linkedPOs: string[] = [];
    const linkedGRNs: string[] = [];
    if (type !== 'Standalone') linkedPOs.push(String(3000 + i));
    if (type === 'Receiving-based') linkedGRNs.push(`REC-2024-${String(6000 + i).padStart(4, '0')}`);
    const createdBy = users[Math.floor(r() * users.length)];

    out.push({
      id: `inv-rtp-${i + 1}`,
      invoiceNumber: formatInvoiceId(101 + i),
      type,
      vendor,
      vendorInvoiceNumber: `${vendorPrefix}-${String(1000 + Math.floor(r() * 9000))}`,
      reference: linkedPOs[0] ?? `REF-RTP-${i + 1}`,
      date: iso(invoiceDate),
      invoiceDate: iso(invoiceDate),
      createdDate: iso(createdDate),
      dueDate: iso(dueDate),
      triggerDate: iso(triggerDate),
      amount,
      outstandingBalance: amount,
      currency: 'USD',
      apAccount: apAccounts[Math.floor(r() * apAccounts.length)],
      description: descriptions[Math.floor(r() * descriptions.length)],
      linkedPOs,
      linkedGRNs,
      status: 'Approved',
      createdBy,
      updatedBy: createdBy,
      updatedDate: iso(createdDate),
    });
  }

  // Backdated-payment demo (user 9/25): INV-000153 is the story row
  // for "the payment date changes what you owe". Pinned to Acme Supplies
  // Co., due 3 days ago on a 2/10 Net 30 Post Shipping term with the
  // invoice dated 12 days back, so in Record Payment step 3:
  //   - today: Overdue by 3 days, discount window closed
  //   - payment date backdated to the due date: overdue clears AND the
  //     2% early-pay discount (invoice date + 10 = the day after due)
  //     comes alive on the row.
  const demo = out.find((inv) => inv.id === 'inv-rtp-53');
  if (demo) {
    const dIso = (days: number) => {
      const d = new Date(today);
      d.setDate(today.getDate() + days);
      return iso(d);
    };
    demo.vendor = 'Acme Supplies Co.';
    demo.vendorInvoiceNumber = 'ACM-2152';
    demo.paymentTerms = '2/10 Net 30 Post Shipping';
    demo.dueDate = dIso(-3);
    demo.triggerDate = dIso(-33); // shipping date: due = trigger + 30
    demo.date = dIso(-12);
    demo.invoiceDate = dIso(-12); // discount deadline = invoice + 10 = today - 2
    demo.createdDate = dIso(-12);
    demo.updatedDate = dIso(-12);
    demo.description = 'Warehouse racking and pallet stock, shipped Net 30 with a 2% early-pay window.';
  }

  // A guaranteed block of LIVE early-pay discounts in the run pool (Eli
  // 9/25): at least a dozen approved invoices on 2/10 Net 30 Post Shipping,
  // dated in the last week and due ~3 weeks out, so the discount window is
  // open TODAY (invoice date + 10 ≥ today, due date in the future). These
  // demonstrate the Discount column when building a payment run — and,
  // being not-overdue, they never contradict the "overdue ⇒ no discount"
  // rule that the deadline cap now enforces.
  const dIso = (days: number) => {
    const d = new Date(today);
    d.setDate(today.getDate() + days);
    return iso(d);
  };
  for (let i = 0; i < 12; i++) {
    const vendor = vendors[Math.floor(r() * vendors.length)];
    const amount = Math.floor(r() * 45000) + 3000;
    const invAgo = Math.floor(r() * 8); // 0..7 days ago → within the 10-day window
    const invoiceDate = dIso(-invAgo);
    const createdBy = users[Math.floor(r() * users.length)];
    out.push({
      id: `inv-rtp-disc-${i + 1}`,
      invoiceNumber: formatInvoiceId(201 + i),
      type: 'Standalone',
      vendor,
      vendorInvoiceNumber: `${vendor.split(' ')[0].substring(0, 3).toUpperCase()}-${String(2200 + i)}`,
      reference: `REF-DISC-${i + 1}`,
      date: invoiceDate,
      invoiceDate,
      createdDate: invoiceDate,
      dueDate: dIso(30 - invAgo), // due = invoice + 30, still in the future
      triggerDate: invoiceDate,
      paymentTerms: '2/10 Net 30 Post Shipping',
      amount,
      outstandingBalance: amount,
      currency: 'USD',
      apAccount: apAccounts[Math.floor(r() * apAccounts.length)],
      description: descriptions[Math.floor(r() * descriptions.length)],
      linkedPOs: [],
      linkedGRNs: [],
      status: 'Approved',
      createdBy,
      updatedBy: createdBy,
      updatedDate: invoiceDate,
      postingDate: invoiceDate,
    });
  }
  return out;
}

// A dedicated block of open pre-invoices for the first Vendor Payments
// vendor (7/24/26): the vendor-first flow's Pre-Invoices tab and the
// Step 2 "Pay against pre-invoices" list need a vendor with several
// live pre-invoices to demo multi-prepayment runs.
function generateAcmePreInvoices(count: number): Invoice[] {
  const r = mulberry32(0xACE501);
  const today = new Date();
  const iso = (d: Date) => d.toISOString().split('T')[0];
  const out: Invoice[] = [];
  for (let i = 0; i < count; i++) {
    const amount = Math.floor(r() * 40000) + 4000;
    const createdDate = new Date(today);
    createdDate.setDate(today.getDate() - (3 + Math.floor(r() * 21)));
    const dueDate = new Date(createdDate);
    dueDate.setDate(createdDate.getDate() + 30);
    const createdBy = users[Math.floor(r() * users.length)];
    out.push({
      id: `inv-acme-pre-${i + 1}`,
      invoiceNumber: formatInvoiceId(213 + i),
      type: 'Pre-Invoice',
      vendor: 'Acme Supplies Co.',
      vendorInvoiceNumber: `ACM-${String(7000 + Math.floor(r() * 2000))}`,
      reference: String(4100 + i),
      date: iso(createdDate),
      invoiceDate: iso(createdDate),
      createdDate: iso(createdDate),
      dueDate: iso(dueDate),
      amount,
      outstandingBalance: amount,
      currency: 'USD',
      apAccount: apAccounts[Math.floor(r() * apAccounts.length)],
      description: descriptions[Math.floor(r() * descriptions.length)],
      linkedPOs: [String(4100 + i)],
      linkedGRNs: [],
      status: 'Approved',
      createdBy,
      updatedBy: createdBy,
      updatedDate: iso(createdDate),
    });
  }
  return out;
}

// ── Prepayment → receiving-invoice reconciliation demo (9/3/26) ─────
// Stakeholder walkthrough under the picker's FIRST vendor (Acme Corp),
// both halves of the story on real Acme POs:
//
//   BEFORE (run it live): PO 1003 is Fully Received ($111,600) and
//   carries a PAID 30% pre-invoice ($33,480). Open Create Invoice →
//   Acme Corp → PO 1003: the violet Prepaid chip + strip show on the
//   card, Continue fires the "Prepayment already recorded" gate, the
//   create screen reduces the total by $33,480, and Submit settles the
//   pre-invoice as Reconciled.
//
//   AFTER (already done): PO 1004's receiving invoice INV-000216
//   ($64,575) consumed PRE-000001 ($19,372.50) at creation — the
//   invoice detail shows the applied prepayment and "amount due after
//   prepayments" $45,202.50, the settled pre-invoice shows "Reconciled
//   into INV-000216", and every pay surface (Ready to pay, run pool,
//   proposal lines, Record Payment) wears the violet "after $19,372.50
//   prepaid" tag on the balance.
function generatePrepayReconciliationDemo(): Invoice[] {
  const today = new Date();
  const iso = (daysFromToday: number) => {
    const d = new Date(today);
    d.setDate(today.getDate() + daysFromToday);
    return d.toISOString().split('T')[0];
  };
  return [
    // BEFORE — paid, unsettled pre-invoice waiting on PO 1003.
    {
      id: 'inv-demo-pre-open',
      invoiceNumber: 'PRE-000002',
      type: 'Pre-Invoice',
      vendor: 'Acme Corp',
      vendorInvoiceNumber: 'ACM-30PCT-1003',
      reference: '1003',
      date: iso(-18),
      invoiceDate: iso(-18),
      createdDate: iso(-18),
      dueDate: iso(-4),
      amount: 33480,
      outstandingBalance: 0, // fully paid → the picker flags PO 1003 "Prepaid · $33,480"
      currency: 'USD',
      apAccount: '2110-AP-Trade',
      description: '30% production prepayment on PO 1003. Applies automatically when the received goods are invoiced; this pre-invoice then settles as reconciled.',
      linkedPOs: ['1003'],
      linkedGRNs: [],
      status: 'Paid in Full',
      createdBy: 'Ahtisham Ahmad',
      updatedBy: 'Ahtisham Ahmad',
      updatedDate: iso(-12),
    },
    // AFTER — the settled pre-invoice, reconciled into INV-000216.
    {
      id: 'inv-demo-pre-settled',
      invoiceNumber: 'PRE-000001',
      type: 'Pre-Invoice',
      vendor: 'Acme Corp',
      vendorInvoiceNumber: 'ACM-30PCT-1004',
      reference: '1004',
      date: iso(-32),
      invoiceDate: iso(-32),
      createdDate: iso(-32),
      dueDate: iso(-18),
      amount: 19372.5,
      outstandingBalance: 0,
      currency: 'USD',
      apAccount: '2110-AP-Trade',
      description: '30% production prepayment on PO 1004, reconciled into INV-000216 when the received goods were invoiced.',
      linkedPOs: ['1004'],
      linkedGRNs: [],
      status: 'Settled',
      createdBy: 'Ahtisham Ahmad',
      updatedBy: 'Ahtisham Ahmad',
      updatedDate: iso(-5),
      reconciledIntoInvoiceNumber: 'INV-000216',
      actionHistory: [
        {
          action: 'reconciled',
          reason: 'Reconciled into INV-000216; the prepayment applied there',
          by: 'Ahtisham Ahmad',
          at: `${iso(-5)}T10:24:00.000Z`,
        },
      ],
    },
    // AFTER — the receiving invoice that consumed it, sitting in Ready
    // to pay with the violet "after $19,372.50 prepaid" balance tag.
    {
      id: 'inv-demo-receiving-reconciled',
      invoiceNumber: 'INV-000216',
      type: 'Receiving-based',
      vendor: 'Acme Corp',
      vendorInvoiceNumber: 'ACM-8842',
      reference: '1004',
      date: iso(-5),
      invoiceDate: iso(-5),
      createdDate: iso(-5),
      dueDate: iso(9),
      triggerDate: iso(-5),
      amount: 64575,
      outstandingBalance: 45202.5, // 64,575 − 19,372.50 prepaid at creation
      currency: 'USD',
      apAccount: '2110-AP-Trade',
      description: 'Receiving Invoice for PO(s): 1004',
      postingDate: iso(-5),
      linkedPOs: ['1004'],
      linkedGRNs: ['REC-V001-PO4-A', 'REC-V001-PO4-B'],
      status: 'Approved',
      createdBy: 'Ahtisham Ahmad',
      updatedBy: 'Ahtisham Ahmad',
      updatedDate: iso(-5),
      appliedPrepayments: [{ invoiceNumber: 'PRE-000001', amount: 19372.5 }],
      reconcilesPreInvoiceNumbers: ['PRE-000001'],
    },
  ];
}

/* No impossible states (9/4/26 Eli, BB-22): the exception/hold dialogs
 * make reason mandatory ("I would not have been able to save it"), so a
 * flagged invoice without a recorded reason cannot exist. Every seeded
 * Exception / Payment Hold / Rejected / Cancelled row gets the flag +
 * the actionHistory entry the real flow would have written — reason,
 * who, when, and supporting documents. Deterministic (index-keyed), so
 * the dataset stays stable across reloads. */
const EXCEPTION_SEED_REASONS = [
  'Price Discrepancy: vendor billed $48.50/unit against the PO price of $42.00',
  'Quantity Mismatch: invoice bills 120 units, receiver shows 100',
  'Duplicate Invoice: possible duplicate of an earlier bill for the same PO',
  'Damaged Goods: 8 cartons arrived water-damaged, pending vendor credit',
];
/* Pre-invoices have NO receivings (BA 9/5: "can't have a receiving error
 * on a pre-invoice") — their exception reasons speak PO language only:
 * never receivers, never damaged goods. */
const PRE_EXCEPTION_SEED_REASONS = [
  'Price Discrepancy: vendor billed $48.50/unit against the PO price of $42.00',
  'Quantity Mismatch: pre-invoice bills 120 units, the PO orders 100',
  'Duplicate Invoice: possible duplicate of an earlier pre-invoice for this PO',
  'Incorrect Vendor: the PO belongs to a different vendor account',
];
// Typed like the hold dialog writes them ("Type: note"), so the hold
// indicator can show the hold type on its own line.
const HOLD_SEED_REASONS = [
  'Vendor dispute in progress: waiting on corrected pricing from the vendor',
  'Credit memo expected: vendor is issuing a credit for 8 damaged cartons',
  'Vendor payment details not verified: new remit-to bank account awaiting callback',
];
const REJECT_SEED_REASONS = [
  'Wrong PO referenced, the lines belong to a different order',
  'Amount exceeds the approved PO total without a change order',
];
const CANCEL_SEED_REASONS = [
  'Vendor reissued the invoice under a corrected number',
  'Order returned in full, invoice no longer applies',
];
const SEED_DOCS = ['vendor-email.pdf', 'po-comparison.xlsx', 'receiver-photo.jpg', 'credit-note-request.pdf'];

function backfillActionHistory(list: Invoice[]): Invoice[] {
  return list.map((inv, i) => {
    const at = `${inv.createdDate}T14:${String(10 + (i % 45)).padStart(2, '0')}:00.000Z`;
    const by = inv.updatedBy || inv.createdBy;
    const hasEntry = (a: string) => inv.actionHistory?.some((e) => e.action === a);
    if (inv.status === 'Exception' && !hasEntry('flagException')) {
      const pool = inv.type === 'Pre-Invoice' ? PRE_EXCEPTION_SEED_REASONS : EXCEPTION_SEED_REASONS;
      const docs = inv.type === 'Pre-Invoice' ? SEED_DOCS.filter((d) => d !== 'receiver-photo.jpg') : SEED_DOCS;
      return {
        ...inv,
        is_exception: true,
        actionHistory: [
          ...(inv.actionHistory ?? []),
          {
            action: 'flagException',
            reason: pool[i % pool.length],
            by,
            at,
            // Real recipients (BA 9/6): the seeded flag names who was
            // notified, so reopening the invoice shows them in the picker.
            notifiedRecipientIds: ['U-001', 'U-002', 'U-005'].slice(0, 1 + (i % 3)),
            attachments: [docs[i % docs.length]],
          },
        ],
      };
    }
    if ((inv.status === 'Payment Hold' || inv.is_payment_held) && !hasEntry('paymentHold')) {
      return {
        ...inv,
        is_payment_held: true,
        actionHistory: [
          ...(inv.actionHistory ?? []),
          {
            action: 'paymentHold',
            reason: HOLD_SEED_REASONS[i % HOLD_SEED_REASONS.length],
            by,
            at,
            notifiedRecipientIds: ['U-002', 'U-005'].slice(0, 1 + (i % 2)),
            attachments: i % 2 === 0 ? [SEED_DOCS[(i + 1) % SEED_DOCS.length]] : undefined,
          },
        ],
      };
    }
    if (inv.status === 'Rejected' && !hasEntry('reject')) {
      return {
        ...inv,
        actionHistory: [
          ...(inv.actionHistory ?? []),
          { action: 'reject', reason: REJECT_SEED_REASONS[i % REJECT_SEED_REASONS.length], by, at },
        ],
      };
    }
    if (inv.status === 'Cancelled' && !hasEntry('cancel')) {
      return {
        ...inv,
        actionHistory: [
          ...(inv.actionHistory ?? []),
          { action: 'cancel', reason: CANCEL_SEED_REASONS[i % CANCEL_SEED_REASONS.length], by, at },
        ],
      };
    }
    return inv;
  });
}

/* Pay-queue demo arrangement (user 9/15/26): the Invoices to pay tab
 * sorts by due date, so the payable rows are rearranged to lead with a
 * clean story — the FIRST row reads Unpaid (Approved, full balance) and
 * the next three read Partially paid (a deterministic slice of the
 * balance left open). Only rows already payable are touched; blocked
 * statuses (hold, exception, pending) keep their seeds. */
function arrangePayQueueDemo(list: Invoice[]): Invoice[] {
  const payable = list
    .filter(
      (inv) =>
        (inv.status === 'Approved' || inv.status === 'Partially Paid') &&
        inv.outstandingBalance > 0 &&
        inv.type !== 'Pre-Invoice',
    )
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const patch = new Map<string, Partial<Invoice>>();
  if (payable[0]) {
    patch.set(payable[0].id, { status: 'Approved', outstandingBalance: payable[0].amount });
  }
  // Fraction of the balance still open on each partially paid row.
  const PARTIAL_OPEN = [0.62, 0.35, 0.48];
  PARTIAL_OPEN.forEach((f, k) => {
    const inv = payable[k + 1];
    if (!inv) return;
    patch.set(inv.id, {
      status: 'Partially Paid',
      outstandingBalance: Math.round(inv.amount * f * 100) / 100,
    });
  });
  return list.map((inv) => (patch.has(inv.id) ? { ...inv, ...patch.get(inv.id) } : inv));
}

// Trigger + posting dates are mandatory on every row (user 10/5: a date in
// every cell, no "set on receiving"). Generators that left them unset — the
// hand-authored pre-invoice demos — get them backfilled here: trigger
// anchors to the invoice date, posting to the created (then invoice) date.
function withMandatoryDates(list: Invoice[]): Invoice[] {
  return list.map((inv) => ({
    ...inv,
    triggerDate: inv.triggerDate ?? inv.invoiceDate ?? inv.date,
    postingDate: inv.postingDate ?? inv.createdDate ?? inv.invoiceDate ?? inv.date,
  }));
}

/* Payment hold is a flag, not a status (ERP-8796, AC7): any row seeded
 * with the retired "Payment Hold" status reads its real Invoice Status
 * (Approved, or Partially Paid/Prepaid when cash already went out) with
 * the hold flag still open. Runs after the backfill so the hold's reason
 * entry is already written. */
function migrateHoldStatus(list: Invoice[]): Invoice[] {
  return list.map((inv) => {
    if (inv.status !== 'Payment Hold') return inv;
    const partial = inv.outstandingBalance > 0.004 && inv.outstandingBalance < inv.amount - (inv.creditedAmount ?? 0) - 0.004;
    const status = partial ? (inv.type === 'Pre-Invoice' ? 'Partially Prepaid' : 'Partially Paid') : 'Approved';
    return { ...inv, status, is_payment_held: true };
  });
}

/* Hold demo (user 10/26/26): one held invoice of every type inside the
 * listing's first 10 rows, each on a different status, so the yellow lock
 * beside the Invoice ID and the On hold toggle are visible on load: a
 * pending Standalone, a Pre-Invoice in Exception (both flags at once) and
 * an approved Inventory Invoice. */
const HOLD_DEMO_NUMBERS = ['INV-000006', 'INV-000010', 'INV-000012'];
function seedHoldDemo(list: Invoice[]): Invoice[] {
  return list.map((inv) => {
    const n = HOLD_DEMO_NUMBERS.indexOf(inv.invoiceNumber);
    if (n < 0 || inv.is_payment_held) return inv;
    return {
      ...inv,
      is_payment_held: true,
      actionHistory: [
        ...(inv.actionHistory ?? []),
        {
          action: 'paymentHold',
          reason: HOLD_SEED_REASONS[n % HOLD_SEED_REASONS.length],
          by: PINNED_CREATORS[n % PINNED_CREATORS.length],
          at: inv.updatedDate ?? inv.createdDate,
          notifiedRecipientIds: ['U-002'],
        },
      ],
    };
  });
}

/* Currency & Exchange Rates (spec 4.2, 4.4): each invoice is in its
 * vendor's currency (the partner record's, which the registry and its POs
 * carry too) with the mid-market rate on its posting date. Applied last,
 * after the dates settle, so no earlier seed step or rand() stream changes.
 * A pre-invoice posts when it is paid, so it takes its rate then: a paid one
 * carries the rate of its last update (its payment, in the seeds), an unpaid
 * one carries none yet. */
// Settled pre-invoices were paid before they were reconciled, so they carry
// their payment's rate too (the reconciliation demo's PRE-000001).
const PAID_STATUSES = new Set(['Paid in Full', 'Partially Paid', 'Prepaid', 'Partially Prepaid', 'Settled']);
/* A vendor billing in two currencies (Currency & Exchange Rates): Elite
 * Suppliers Network bills in EUR, but two standalone invoices came in USD.
 * One payment can't mix currencies, so a payment run pays the vendor once
 * per currency and Record Payment pays one currency at a time. */
const SECOND_CURRENCY_INVOICES: Record<string, string> = {
  'inv-rtp-26': 'USD',
  'inv-rtp-15': 'USD',
};

function withVendorCurrency(list: Invoice[]): Invoice[] {
  return list.map((inv) => {
    const currency =
      SECOND_CURRENCY_INVOICES[inv.id] ?? resolveRegistryVendor(inv.vendor)?.currency ?? currencyForVendorName(inv.vendor);
    const isPre = inv.type === 'Pre-Invoice';
    const rateDay = !isPre
      ? inv.postingDate ?? inv.invoiceDate
      : PAID_STATUSES.has(inv.status)
        ? inv.updatedDate ?? inv.postingDate ?? inv.invoiceDate
        : undefined;
    const stamp = stampRate(currency, rateDay);
    return { ...inv, currency, ...stamp, ...(stamp.exchangeRate ? { rateBasis: isPre ? ('paidDate' as const) : ('postingDate' as const) } : {}) };
  });
}

/* Vendor billed vs We're paying (Currency & Exchange Rates): some invoices
 * carry the total printed on the vendor's document where it differs from
 * the total being paid, with the reason. Picked by invoice number, so no
 * other seed changes. Most land inside the default 1% allowed difference;
 * a few are over it and need review. */
const DIFFERENCE_CASES: { pct: number; reason: string }[] = [
  { pct: 0.0042, reason: 'Exchange rate. The PO was priced in the base currency and the vendor converted it at its bank’s rate.' },
  { pct: -0.0018, reason: 'Rounding. The vendor rounded each line total; the invoice rounds the total once.' },
  { pct: 0.0235, reason: 'Unit price. The vendor billed a price above the PO on one line; the invoice pays the PO price.' },
  { pct: 0.0071, reason: 'Freight. The vendor added freight the PO did not include.' },
  { pct: -0.0156, reason: 'Short shipment. The vendor billed units that were not received.' },
];
/* An applied prepayment shows the rate its pre-invoice was paid at. */
function withPrepaidRates(list: Invoice[]): Invoice[] {
  const byNumber = new Map(list.map((inv) => [inv.invoiceNumber, inv]));
  return list.map((inv) =>
    inv.appliedPrepayments?.length
      ? {
          ...inv,
          appliedPrepayments: inv.appliedPrepayments.map((p) => {
            const pre = byNumber.get(p.invoiceNumber);
            return p.rate || !pre?.exchangeRate ? p : { ...p, rate: pre.exchangeRate, rateDate: pre.rateDate };
          }),
        }
      : inv,
  );
}

function withVendorStatedTotals(list: Invoice[]): Invoice[] {
  return list.map((inv) => {
    if (inv.type === 'Pre-Invoice' || inv.vendorStatedTotal != null || !(inv.amount > 0)) return inv;
    const n = parseInt(inv.id.replace(/\D/g, ''), 10) || 0;
    if (n % 6 !== 1) return inv;
    const c = DIFFERENCE_CASES[Math.floor(n / 6) % DIFFERENCE_CASES.length];
    const billed = Math.round(inv.amount * (1 + c.pct) * 100) / 100;
    return { ...inv, vendorStatedTotal: billed, differenceReason: c.reason };
  });
}

export const mockInvoices = withPrepaidRates(withVendorStatedTotals(withVendorCurrency(seedHoldDemo(migrateHoldStatus(arrangePayQueueDemo(backfillActionHistory(withMandatoryDates([
  ...generateInvoices(100),
  ...generateReadyToPayInvoices(100),
  ...generateAcmePreInvoices(3),
  ...generatePrepayReconciliationDemo(),
]))))))));