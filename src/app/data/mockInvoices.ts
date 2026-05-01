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

function generateInvoices(count: number): Invoice[] {
  const invoices: Invoice[] = [];
  const startDate = new Date('2024-01-01');
  
  for (let i = 0; i < count; i++) {
    const invoiceDate = new Date(startDate);
    invoiceDate.setDate(startDate.getDate() + i);
    
    const createdDate = new Date(invoiceDate);
    createdDate.setDate(invoiceDate.getDate() + Math.floor(Math.random() * 3));
    
    const dueDate = new Date(invoiceDate);
    dueDate.setDate(invoiceDate.getDate() + 30);
    
    const vendor = vendors[Math.floor(Math.random() * vendors.length)];
    const type = types[Math.floor(Math.random() * types.length)];
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const amount = Math.floor(Math.random() * 50000) + 5000;
    const createdBy = users[Math.floor(Math.random() * users.length)];
    const apAccount = apAccounts[Math.floor(Math.random() * apAccounts.length)];
    const description = descriptions[Math.floor(Math.random() * descriptions.length)];
    
    // Calculate outstanding balance based on status
    let outstandingBalance = amount;
    if (status === 'Paid') {
      outstandingBalance = 0;
    } else if (status === 'Partially Paid') {
      outstandingBalance = Math.floor(amount * (Math.random() * 0.5 + 0.2));
    }
    
    // Generate vendor invoice number
    const vendorPrefix = vendor.split(' ')[0].substring(0, 3).toUpperCase();
    const vendorInvoiceNumber = `${vendorPrefix}-${String(1000 + Math.floor(Math.random() * 9000))}`;
    
    // Generate linked POs and GRNs based on type
    const linkedPOs: string[] = [];
    const linkedGRNs: string[] = [];
    
    if (type === 'PO-based') {
      const poCount = Math.floor(Math.random() * 3) + 1;
      for (let j = 0; j < poCount; j++) {
        linkedPOs.push(`PO-2024-${String(1000 + i * 10 + j).padStart(4, '0')}`);
      }
    }
    
    if (type === 'Receiving-based' || type === 'GRN-based') {
      const grnCount = Math.floor(Math.random() * 2) + 1;
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
    
    // Add posting date only for standalone invoices
    if (type === 'Standalone') {
      const postingDate = new Date(invoiceDate);
      postingDate.setDate(invoiceDate.getDate() + Math.floor(Math.random() * 5));
      invoice.postingDate = postingDate.toISOString().split('T')[0];
    }
    
    invoices.push(invoice);
  }
  
  return invoices;
}

export const mockInvoices = generateInvoices(100);