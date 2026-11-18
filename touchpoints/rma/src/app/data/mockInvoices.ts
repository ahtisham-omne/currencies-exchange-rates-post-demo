import { mulberry32 } from './seededRandom';

// Seeded so the listing renders the same 100 invoices on every
// reload — only state mutations (new invoice, status change, etc.)
// should change what the table shows. Bump the seed if a future
// schema change needs a fresh dataset.
const rand = mulberry32(0x100CE10);
// Separate stream for the audit fields (Last Updated By/On) so adding
// them doesn't shift the main sequence and reshuffle the whole dataset.
const auditRand = mulberry32(0x0A0D17);

export interface InvoiceActionHistoryEntry {
  action: string;
  reason: string;
  by: string;
  at: string;
  /** SYSTEM_USERS / SYSTEM_ROLES ids picked in the action's notify
   *  block — resolve flows offer to notify the same people again
   *  (feedback 7/20/26). */
  notifiedRecipientIds?: string[];
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
  amount: number;
  outstandingBalance: number;
  currency: string;
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

// The first rows of a listing are pinned to the real team in order:
// Ahtisham, Eli, Mahreen, Rida, Areeb, Nophil. Every other row draws
// randomly from the whole roster. Shared convention across all mock
// datasets so every data table leads with the same names.
export const PINNED_CREATORS = [
  'Ahtisham Ahmad',
  'Eli Rosenbloom',
  'Mahreen Ghafoor',
  'Rida Iftikhar',
  'Areeb Tanvir',
  'Nophil',
];
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
  'Janitorial and HVAC filter supplies, monthly replenishment'
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

    const dueDate = new Date(invoiceDate);
    dueDate.setDate(invoiceDate.getDate() + 30);
    
    const vendor = vendors[Math.floor(rand() * vendors.length)];
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
      invoiceNumber: `INV-2024-${String(1000 + i).padStart(3, '0')}`,
      type,
      vendor,
      vendorInvoiceNumber,
      reference: type === 'PO-based' ? linkedPOs[0] || `REF-${i + 1}` : type === 'Receiving-based' ? linkedGRNs[0] || `REF-${i + 1}` : `REF-${i + 1}`,
      date: invoiceDate.toISOString().split('T')[0],
      invoiceDate: invoiceDate.toISOString().split('T')[0],
      createdDate: createdDate.toISOString().split('T')[0],
      dueDate: dueDate.toISOString().split('T')[0],
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
    
    // Add posting date only for standalone invoices
    if (type === 'Standalone') {
      const postingDate = new Date(invoiceDate);
      postingDate.setDate(invoiceDate.getDate() + Math.floor(rand() * 5));
      invoice.postingDate = postingDate.toISOString().split('T')[0];
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

    const vendorPrefix = vendor.split(' ')[0].substring(0, 3).toUpperCase();
    const linkedPOs: string[] = [];
    const linkedGRNs: string[] = [];
    if (type !== 'Standalone') linkedPOs.push(String(3000 + i));
    if (type === 'Receiving-based') linkedGRNs.push(`REC-2024-${String(6000 + i).padStart(4, '0')}`);
    const createdBy = users[Math.floor(r() * users.length)];

    out.push({
      id: `inv-rtp-${i + 1}`,
      invoiceNumber: `INV-2024-${1100 + i}`,
      type,
      vendor,
      vendorInvoiceNumber: `${vendorPrefix}-${String(1000 + Math.floor(r() * 9000))}`,
      reference: linkedPOs[0] ?? `REF-RTP-${i + 1}`,
      date: iso(invoiceDate),
      invoiceDate: iso(invoiceDate),
      createdDate: iso(createdDate),
      dueDate: iso(dueDate),
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
      invoiceNumber: `INV-2024-${1300 + i}`,
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

export const mockInvoices = [...generateInvoices(100), ...generateReadyToPayInvoices(100), ...generateAcmePreInvoices(3)];