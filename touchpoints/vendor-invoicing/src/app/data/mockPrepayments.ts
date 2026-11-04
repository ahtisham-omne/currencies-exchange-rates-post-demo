import { mulberry32 } from './seededRandom';

// Seeded so prepayments are stable across reloads — see
// mockInvoices.ts for the rationale.
const rand = mulberry32(0x9AE9A1D);

export interface Prepayment {
  id: string;
  prepaymentNumber: string;
  vendor: string;
  poNumber?: string;
  date: string;
  originalAmount: number;
  appliedAmount: number;
  remainingBalance: number;
  status: 'Active' | 'Partial' | 'Applied';
}

const vendors = [
  'Acme Supplies Co.',
  'Tech Components Inc.',
  'Global Materials Corp',
  'Pacific Steel Works',
  'Midwest Manufacturing',
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
  'Metro Office Supplies'
];

function generatePrepayments(count: number): Prepayment[] {
  const prepayments: Prepayment[] = [];
  const startDate = new Date('2023-01-01');
  
  for (let i = 0; i < count; i++) {
    const prepaymentDate = new Date(startDate);
    prepaymentDate.setDate(startDate.getDate() + Math.floor(i * 3));
    
    const vendor = vendors[Math.floor(rand() * vendors.length)];
    const originalAmount = Math.floor(rand() * 40000) + 5000;
    
    // Randomly determine status and applied amounts
    const statusRand = rand();
    let status: Prepayment['status'];
    let appliedAmount: number;
    
    if (statusRand < 0.3) {
      // Active - not yet applied
      status = 'Active';
      appliedAmount = 0;
    } else if (statusRand < 0.7) {
      // Partial - partially applied
      status = 'Partial';
      appliedAmount = Math.floor(originalAmount * (rand() * 0.6 + 0.2)); // 20-80%
    } else {
      // Applied - fully applied
      status = 'Applied';
      appliedAmount = originalAmount;
    }
    
    const remainingBalance = originalAmount - appliedAmount;
    
    // 70% chance of having a PO number
    const hasPO = rand() > 0.3;
    const poNumber = hasPO ? String(3000 + i) : undefined;
    
    prepayments.push({
      id: `prep-${i + 1}`,
      prepaymentNumber: `PREP-${String(i + 1).padStart(6, '0')}`,
      vendor,
      poNumber,
      date: prepaymentDate.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
      originalAmount,
      appliedAmount,
      remainingBalance,
      status
    });
  }
  
  return prepayments;
}

export const mockPrepayments = generatePrepayments(100);
