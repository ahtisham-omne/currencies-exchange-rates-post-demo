import { MARKET_RATES, BASE_CURRENCY } from './currencyLibrary';

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
  /** ISO 4217 alpha-3 the invoice is denominated in (vendor's currency). */
  currency: string;
  apAccount: string;
  description: string;
  postingDate?: string;
  linkedPOs: string[];
  linkedGRNs: string[];
  status: string;
  createdBy: string;
  /**
   * Base-per-1-foreign mid-market rate captured on invoice date. This is the
   * accounting rate used for the ledger entry. Undefined when invoice
   * currency equals the company base currency (PKR).
   */
  lockedRate?: number;
  /** ISO timestamp the invoice rate was captured (typically posting time). */
  lockedAt?: string;
  /**
   * Base-per-1-foreign mid-market rate captured at PO commitment time. Carried
   * forward from the originating PO so users can compare PO-rate vs
   * invoice-rate FX impact in the amount tooltips.
   */
  poLockedRate?: number;
  /** ISO timestamp when the PO rate was locked (typically PO send date). */
  poLockedAt?: string;
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

const statuses: Invoice['status'][] = [
  'Pending Approval',
  'Approved',
  'Partially Paid',
  'Paid',
  'Exception',
  'Payment Hold',
  'Cancelled'
];

const types: Invoice['type'][] = ['PO-based', 'Receiving-based', 'Standalone', 'Pre-Invoice'];

const users = [
  'John Smith',
  'Sarah Johnson',
  'Mike Wilson',
  'Emily Brown',
  'David Lee',
  'Jessica Martinez',
  'Robert Chen',
  'Amanda White'
];

const apAccounts = [
  '2100-AP',
  '2110-AP-Trade',
  '2120-AP-Services',
  '2130-AP-Utilities',
  '2140-AP-Rent'
];

const descriptions = [
  'Office supplies Q1',
  'Electronic components',
  'Raw materials for manufacturing',
  'Express shipping services',
  'Components pending receiving',
  'Wholesale supplies',
  'Trading goods',
  'Network equipment',
  'Logistics services - pending delivery',
  'Industrial parts and supplies',
  'IT hardware and software',
  'Building materials',
  'Packaging supplies',
  'Professional services',
  'Maintenance supplies'
];

/** Mix of currencies represented across the seeded invoices. */
const currencyMix = ['USD', 'USD', 'USD', 'EUR', 'EUR', 'GBP', 'AED', 'SAR', 'CNY', 'JPY', 'PKR'];

/**
 * Seeded pseudo-random number generator so mock data stays stable between
 * reloads (deterministic test/demo experience).
 */
function seeded(i: number, salt: number): number {
  const x = Math.sin(i * 9301 + salt * 49297) * 233280;
  return x - Math.floor(x);
}

/** Apply a small ±pct variance to a rate to simulate market drift. */
function withVariance(rate: number, pct: number, salt: number): number {
  const v = (salt - 0.5) * 2 * pct;
  return Number((rate * (1 + v)).toFixed(4));
}

function generateInvoices(count: number): Invoice[] {
  const invoices: Invoice[] = [];
  const startDate = new Date('2024-01-01');

  for (let i = 0; i < count; i++) {
    const invoiceDate = new Date(startDate);
    invoiceDate.setDate(startDate.getDate() + i);

    const createdDate = new Date(invoiceDate);
    createdDate.setDate(invoiceDate.getDate() + Math.floor(seeded(i, 1) * 3));

    const dueDate = new Date(invoiceDate);
    dueDate.setDate(invoiceDate.getDate() + 30);

    const vendor = vendors[Math.floor(seeded(i, 2) * vendors.length)];
    const type = types[Math.floor(seeded(i, 3) * types.length)];
    const status = statuses[Math.floor(seeded(i, 4) * statuses.length)];
    const amount = Math.floor(seeded(i, 5) * 50000) + 5000;
    const createdBy = users[Math.floor(seeded(i, 6) * users.length)];
    const apAccount = apAccounts[Math.floor(seeded(i, 7) * apAccounts.length)];
    const description = descriptions[Math.floor(seeded(i, 8) * descriptions.length)];
    const currency = currencyMix[Math.floor(seeded(i, 9) * currencyMix.length)];

    let outstandingBalance = amount;
    if (status === 'Paid') {
      outstandingBalance = 0;
    } else if (status === 'Partially Paid') {
      outstandingBalance = Math.floor(amount * (seeded(i, 10) * 0.5 + 0.2));
    }

    const vendorPrefix = vendor.split(' ')[0].substring(0, 3).toUpperCase();
    const vendorInvoiceNumber = `${vendorPrefix}-${String(1000 + Math.floor(seeded(i, 11) * 9000))}`;

    const linkedPOs: string[] = [];
    const linkedGRNs: string[] = [];

    if (type === 'PO-based') {
      const poCount = Math.floor(seeded(i, 12) * 3) + 1;
      for (let j = 0; j < poCount; j++) {
        linkedPOs.push(`PO-2024-${String(1000 + i * 10 + j).padStart(4, '0')}`);
      }
    }

    if (type === 'Receiving-based' || type === 'GRN-based') {
      const grnCount = Math.floor(seeded(i, 13) * 2) + 1;
      for (let j = 0; j < grnCount; j++) {
        linkedGRNs.push(`REC-2024-${String(5000 + i * 10 + j).padStart(4, '0')}`);
      }
    }

    // FX snapshot. Skip when invoice currency equals base currency (PKR).
    const isBase = currency === BASE_CURRENCY;
    const baseRate = MARKET_RATES.rates[currency];
    const lockedRate = !isBase && baseRate !== undefined
      ? withVariance(baseRate, 0.02, seeded(i, 14))
      : undefined;
    const lockedAt = !isBase
      ? new Date(invoiceDate.getTime() + 9 * 60 * 60 * 1000).toISOString()
      : undefined;

    // PO commitment rate is captured 14–30 days before invoice date. Seeded
    // variance is intentionally larger (±3%) so the PO-vs-invoice gap is
    // visible in the tooltip on most rows.
    const hasPO = type === 'PO-based';
    const poLockedRate = !isBase && hasPO && baseRate !== undefined
      ? withVariance(baseRate, 0.03, seeded(i, 15))
      : undefined;
    const poDaysAgo = 14 + Math.floor(seeded(i, 16) * 16);
    const poLockedAt = !isBase && hasPO
      ? new Date(invoiceDate.getTime() - poDaysAgo * 24 * 60 * 60 * 1000).toISOString()
      : undefined;

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
      currency,
      apAccount,
      description,
      linkedPOs,
      linkedGRNs,
      status,
      createdBy,
      lockedRate,
      lockedAt,
      poLockedRate,
      poLockedAt,
    };

    if (type === 'Standalone') {
      const postingDate = new Date(invoiceDate);
      postingDate.setDate(invoiceDate.getDate() + Math.floor(seeded(i, 17) * 5));
      invoice.postingDate = postingDate.toISOString().split('T')[0];
    }

    invoices.push(invoice);
  }

  return invoices;
}

export const mockInvoices = generateInvoices(100);
