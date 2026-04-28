import { Quote, QuoteStatus, Priority, SalesRep, Customer, PointOfContact } from '@/app/types/quote';

const SALES_REPS: SalesRep[] = [
  { id: 'sr1', name: 'Sarah Lindquist', email: 'sarah.l@vanguardvehicles.com' },
  { id: 'sr2', name: 'Michael Tran', email: 'michael.t@vanguardvehicles.com' },
  { id: 'sr3', name: 'Emily Rios', email: 'emily.r@vanguardvehicles.com' },
  { id: 'sr4', name: 'David Kowalski', email: 'david.k@vanguardvehicles.com' },
  { id: 'sr5', name: 'Jessica Mbeki', email: 'jessica.m@vanguardvehicles.com' },
  { id: 'sr6', name: 'Robert Navarro', email: 'robert.n@vanguardvehicles.com' },
  { id: 'sr7', name: 'Amanda Chen', email: 'amanda.c@vanguardvehicles.com' },
  { id: 'sr8', name: 'James Hatfield', email: 'james.h@vanguardvehicles.com' },
];

const CUSTOMERS: Customer[] = [
  { id: 'CUST-001', name: 'Metro City Fire & Rescue', location: { name: 'Station 1 HQ', isPrimary: true } },
  { id: 'CUST-002', name: 'Tri-County EMS Authority', location: { name: 'Central Dispatch', isPrimary: true } },
  { id: 'CUST-003', name: 'Lakewood Community Hospital', location: { name: 'Fleet Services', isPrimary: false } },
  { id: 'CUST-004', name: 'Pinecrest Volunteer Fire Dept', location: { name: 'Main Station', isPrimary: true } },
  { id: 'CUST-005', name: 'Summit Regional Medical Center', location: { name: 'Transport Division', isPrimary: true } },
  { id: 'CUST-006', name: 'Eagle County Sheriff\'s Office', location: { name: 'Fleet Management', isPrimary: false } },
  { id: 'CUST-007', name: 'Pacific Northwest Ambulance Co.', location: { name: 'Portland Base', isPrimary: true } },
  { id: 'CUST-008', name: 'Riverside Utility District', location: { name: 'Operations Yard', isPrimary: false } },
  { id: 'CUST-009', name: 'Heartland Air Ambulance', location: { name: 'Hangar/Fleet HQ', isPrimary: true } },
  { id: 'CUST-010', name: 'Great Plains Fire Protection', location: { name: 'District Office', isPrimary: true } },
  { id: 'CUST-011', name: 'Coastal Search & Rescue', location: { name: 'Galveston Station', isPrimary: false } },
  { id: 'CUST-012', name: 'Valley Health System', location: { name: 'Central Supply', isPrimary: true } },
  { id: 'CUST-013', name: 'Cedar Falls Township FD', location: { name: 'Station 3', isPrimary: true } },
  { id: 'CUST-014', name: 'National Park Service - Region 4', location: { name: 'Regional Fleet', isPrimary: false } },
  { id: 'CUST-015', name: 'Dispatch Medical Transport', location: { name: 'Chicago Hub', isPrimary: true } },
  { id: 'CUST-016', name: 'Blue Ridge EMS Cooperative', location: { name: 'Admin Center', isPrimary: true } },
  { id: 'CUST-017', name: 'Sunbelt Municipal Services', location: { name: 'Phoenix Office', isPrimary: false } },
  { id: 'CUST-018', name: 'Northern Tier Volunteer Rescue', location: { name: 'Bangor Base', isPrimary: true } },
  { id: 'CUST-019', name: 'Lakeshore Police Department', location: { name: 'Motor Pool', isPrimary: true } },
  { id: 'CUST-020', name: 'Red Rock Indian Health Service', location: { name: 'Window Rock Clinic', isPrimary: false } },
];

const FIRST_NAMES = ['John', 'Jane', 'Mike', 'Sarah', 'Tom', 'Lisa', 'Chris', 'Amy', 'David', 'Emma', 'Robert', 'Maria', 'William', 'Jennifer', 'Richard'];
const LAST_NAMES = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Lee', 'Anderson', 'Wilson', 'Moore', 'Taylor'];

const STATUSES: QuoteStatus[] = ['Draft', 'Sent to Customer', 'Unconfirmed SO', 'Confirmed SO', 'Cancelled', 'Archived', 'Expired'];
const PRIORITIES: Priority[] = ['Urgent', 'Medium', 'Low'];

const TAGS = ['Ambulance Build', 'Police Upfit', 'Fire Apparatus', 'Fleet Replacement', 'Custom Conversion', 'Warranty / Service', 'Remount', 'Government Contract'];

const CANCELLATION_REASONS = [
  'Customer withdrew interest — pursuing an alternative vendor.',
  'Budget was reallocated to a different project.',
  'Pricing no longer valid after supplier cost increase.',
  'Customer company restructured, procurement on hold.',
  'Duplicate quote — consolidated with another active quote.',
  'Vehicle spec requirements changed significantly; starting fresh.',
  'Customer went with competitor offering shorter lead time.',
  'Internal review determined project scope no longer viable.',
];
// Deterministic seeded PRNG (Mulberry32)
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const QUOTE_DESCS = [
  'Type III ambulance conversion on Ford E-450 chassis',
  'Police interceptor fleet upfit – 12 units',
  'Type I ambulance remount on new Ram 5500 chassis',
  'Fire department utility body build',
  'Bariatric ambulance module on Sprinter 3500XD',
  'K-9 unit SUV build – Tahoe PPV',
  'Mobile command vehicle conversion',
  'ALS ambulance re-chassis and refurbishment',
  'Light rescue squad body on F-550',
  'CCT/Neonatal transport ambulance',
  'Volunteer fire department apparatus upgrade',
  'EMS fleet graphics and reflective striping',
  'Medium rescue walk-in body build',
  'Sheriff patrol vehicle upfit – 8 units',
  'Hospital patient transport van conversion',
  'Air ambulance ground support vehicle',
  'Municipal utility truck upfit',
  'Search & rescue vehicle build-out',
  'Police Durango Pursuit upfit package',
  'Ambulance module replacement / remount',
];

function generatePointOfContact(customer: Customer, isPrimary: boolean, rng: () => number): PointOfContact {
  const firstName = FIRST_NAMES[Math.floor(rng() * FIRST_NAMES.length)];
  const lastName = LAST_NAMES[Math.floor(rng() * LAST_NAMES.length)];
  const username = `${firstName.toLowerCase()}.${lastName.toLowerCase()}`;
  const email = `${username}@${customer.name.toLowerCase().replace(/[^a-z0-9]/g, '')}.org`;
  
  const areaCode = Math.floor(rng() * 900) + 100;
  const firstPart = Math.floor(rng() * 900) + 100;
  const lastPart = Math.floor(rng() * 9000) + 1000;
  const phone = `+1 (${areaCode}) ${firstPart}-${lastPart}`;
  const ROLES = ['Fleet Manager', 'Fire Chief', 'EMS Director', 'Procurement Officer', 'Captain', 'Logistics Coordinator', 'Finance Director', 'Operations Chief'];
  
  return {
    id: `poc-${Math.floor(rng() * 1000000).toString(36)}`,
    name: `${firstName} ${lastName}`,
    username,
    email,
    phone,
    isPrimary,
    role: isPrimary ? 'Fleet Manager' : ROLES[Math.floor(rng() * ROLES.length)],
  };
}

// Fixed status cycle to guarantee even distribution
const STATUS_CYCLE: QuoteStatus[] = [
  'Draft', 'Sent to Customer', 'Draft', 'Confirmed SO', 'Unconfirmed SO',
  'Sent to Customer', 'Draft', 'Cancelled', 'Sent to Customer', 'Confirmed SO',
  'Unconfirmed SO', 'Draft', 'Sent to Customer', 'Expired', 'Draft',
  'Sent to Customer', 'Unconfirmed SO', 'Confirmed SO', 'Archived', 'Draft',
  'Sent to Customer', 'Draft', 'Confirmed SO', 'Sent to Customer', 'Cancelled',
  'Expired', 'Unconfirmed SO', 'Sent to Customer', 'Draft', 'Draft',
];

export function generateMockQuotes(count: number): Quote[] {
  const quotes: Quote[] = [];
  const rng = seededRandom(42);
  const now = new Date('2026-02-16'); // today per system prompt
  
  for (let i = 0; i < count; i++) {
    const customer = CUSTOMERS[i % CUSTOMERS.length];
    // Format: Q-xxx-xxx-xxx 
    const numStr = String(i).padStart(9, '0');
    const quoteNumber = `Q-${numStr.substring(0, 3)}-${numStr.substring(3, 6)}-${numStr.substring(6, 9)}`;
    const version = (Math.floor(rng() * 5) + 1);
    
    // Spread created dates: 40% in the past (up to 90 days), 60% recent (within last 30 days)
    // This ensures many quotes have future respond-by and expiry dates
    const recentBias = rng();
    const daysAgo = recentBias < 0.6
      ? Math.floor(rng() * 30)       // 60% within last 30 days
      : Math.floor(rng() * 90) + 30; // 40% older (30-120 days ago)
    const createdDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    
    // Use the deterministic cycle for status distribution
    const weightedStatus = STATUS_CYCLE[i % STATUS_CYCLE.length];

    // Expired quotes need a past expiry date
    const expiryDate = weightedStatus === 'Expired'
      ? new Date(now.getTime() - (5 + Math.floor(rng() * 25)) * 24 * 60 * 60 * 1000) // 5-30 days ago
      : new Date(createdDate.getTime() + (30 + Math.floor(rng() * 90)) * 24 * 60 * 60 * 1000);
    
    const hasUnreadMessages = rng() > 0.7;
    const unreadMessageCount = hasUnreadMessages ? Math.floor(rng() * 5) + 1 : 0;
    
    // Generate additional POCs for some quotes
    const additionalPoCs: PointOfContact[] = [];
    if (rng() > 0.6) {
      const numAdditional = Math.floor(rng() * 3) + 1;
      for (let j = 0; j < numAdditional; j++) {
        additionalPoCs.push(generatePointOfContact(customer, false, rng));
      }
    }
    
    // Generate additional dates
    const requestedDate = new Date(createdDate.getTime() - Math.floor(rng() * 7) * 24 * 60 * 60 * 1000);
    // Respond-by: spread 7–45 days into the future from creation for Sent quotes
    const respondBy = weightedStatus === 'Sent to Customer' 
      ? new Date(createdDate.getTime() + (7 + Math.floor(rng() * 38)) * 24 * 60 * 60 * 1000)
      : undefined;
    const confirmationDate = (weightedStatus === 'Confirmed SO' || weightedStatus === 'Unconfirmed SO')
      ? new Date(createdDate.getTime() + (5 + Math.floor(rng() * 15)) * 24 * 60 * 60 * 1000)
      : undefined;
    
    // Calculate win probability based on status
    let winProbability: number;
    switch (weightedStatus) {
      case 'Draft':
        winProbability = Math.floor(rng() * 30) + 10;
        break;
      case 'Sent to Customer':
        winProbability = Math.floor(rng() * 30) + 35;
        break;
      case 'Unconfirmed SO':
        winProbability = Math.floor(rng() * 20) + 65;
        break;
      case 'Confirmed SO':
        winProbability = 100;
        break;
      case 'Expired':
        winProbability = Math.floor(rng() * 15) + 5;
        break;
      default:
        winProbability = Math.floor(rng() * 20) + 5;
    }
    
    const lastUpdated = new Date(createdDate.getTime() + Math.floor(rng() * (now.getTime() - createdDate.getTime())));
    
    // Realistic value ranges for vehicle conversions
    const baseValue = Math.floor(rng() * 450000) + 18000;
    const totalValue = Math.round(baseValue / 100) * 100; // Round to nearest 100
    
    const desc = QUOTE_DESCS[i % QUOTE_DESCS.length];
    
    const quote: Quote = {
      id: `quote-${i}`,
      quoteNumber,
      version,
      customer,
      primaryPoC: generatePointOfContact(customer, true, rng),
      additionalPoCs: additionalPoCs.length > 0 ? additionalPoCs : undefined,
      status: weightedStatus,
      totalValue,
      createdDate,
      expiryDate,
      salesRep: SALES_REPS[i % SALES_REPS.length],
      additionalSalesReps: rng() > 0.55
        ? Array.from(
            { length: Math.floor(rng() * 2) + 1 },
            (_, j) => SALES_REPS[(i + j + 1) % SALES_REPS.length]
          ).filter(r => r.id !== SALES_REPS[i % SALES_REPS.length].id)
        : undefined,
      priority: PRIORITIES[i % PRIORITIES.length],
      tags: rng() > 0.5 ? [TAGS[i % TAGS.length], TAGS[(i + 3) % TAGS.length]] : [TAGS[i % TAGS.length]],
      description: desc,
      hasUnreadMessages,
      unreadMessageCount,
      daysInCurrentStage: Math.floor(rng() * 30) + 1,
      requestedDate,
      respondBy,
      confirmationDate,
      winProbability,
      lastUpdated,
      ...(weightedStatus === 'Cancelled' ? { cancellationReason: CANCELLATION_REASONS[i % CANCELLATION_REASONS.length] } : {}),
    };
    
    quotes.push(quote);
  }
  
  return quotes;
}

export const mockQuotes = generateMockQuotes(750);
export { SALES_REPS, CUSTOMERS, STATUSES, PRIORITIES, TAGS, CANCELLATION_REASONS };