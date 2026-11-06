import { Quote, QuoteStatus, Priority, SalesRep, Customer, PointOfContact, QuoteVersion, QuoteVersionStatus, QuoteStatusHistoryEntry } from '@/app/types/quote';
import { SAMPLE_EMPTY_CUSTOMER } from '@/app/components/shared/customerDefaults';
import { DESIGN_CURRENCY, convertOn, customerCurrency, stampQuoteRate } from '@/app/currency/qFx';

const SALES_REPS: SalesRep[] = [
  /* "rep-yn" is the canonical id for the signed-in user (Yahya
     Naveed) from the shared sales-rep roster. Seeding the mock
     catalogue with this rep means Me mode in the listing actually
     returns a slice instead of zero rows. */
  { id: 'rep-yn', name: 'Yahya Naveed', email: 'yahya.naveed@pioneer.com' },
  { id: 'sr1', name: 'Sarah Lindquist', email: 'sarah.l@vanguardvehicles.com' },
  { id: 'sr2', name: 'Michael Tran', email: 'michael.t@vanguardvehicles.com' },
  { id: 'sr3', name: 'Emily Rios', email: 'emily.r@vanguardvehicles.com' },
  { id: 'sr4', name: 'David Kowalski', email: 'david.k@vanguardvehicles.com' },
  { id: 'sr5', name: 'Jessica Mbeki', email: 'jessica.m@vanguardvehicles.com' },
  { id: 'sr6', name: 'Robert Navarro', email: 'robert.n@vanguardvehicles.com' },
  { id: 'sr7', name: 'Amanda Chen', email: 'amanda.c@vanguardvehicles.com' },
  { id: 'sr8', name: 'James Hatfield', email: 'james.h@vanguardvehicles.com' },
];

/* Index of the signed-in user inside SALES_REPS — used by the
   generator to make every Nth quote land on the current user (as
   primary) and to occasionally include the user among additional
   sales reps. */
const CURRENT_USER_REP_INDEX = 0;

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

const STATUSES: QuoteStatus[] = ['Draft', 'Sent to Customer', 'Unconfirmed SO', 'Confirmed SO', 'Rejected', 'Cancelled', 'Archived', 'Expired'];
const PRIORITIES: Priority[] = ['High', 'Standard', 'Low'];

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

// Fixed status cycle to guarantee even distribution. Rejected sits
// alongside Cancelled / Expired as a rare-but-present negative terminal
// so the listing has a handful of records to demo the reactivate + reason
// carry-forward flow without hunting.
const STATUS_CYCLE: QuoteStatus[] = [
  'Draft', 'Sent to Customer', 'Draft', 'Confirmed SO', 'Unconfirmed SO',
  'Sent to Customer', 'Draft', 'Cancelled', 'Sent to Customer', 'Confirmed SO',
  'Unconfirmed SO', 'Draft', 'Sent to Customer', 'Expired', 'Rejected',
  'Sent to Customer', 'Unconfirmed SO', 'Confirmed SO', 'Archived', 'Draft',
  'Sent to Customer', 'Draft', 'Confirmed SO', 'Sent to Customer', 'Cancelled',
  'Expired', 'Rejected', 'Sent to Customer', 'Draft', 'Draft',
];

export function generateMockQuotes(count: number): Quote[] {
  const quotes: Quote[] = [];
  const rng = seededRandom(42);
  /* Relative to the real today (start of day), so the board's time
     presets (Last 7 / 30 days, 6 / 12 months) always have quotes in
     them. Was pinned to 2026-02-16, which left every recent range
     empty once that date passed. */
  const now = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })();
  
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
    
    // Realistic value ranges for vehicle conversions. The mock used to
    // round to the nearest $100, which made every listing row read as
    // "$X,X00.00" and didn't reflect a real grand total. Keep the dollar
    // amount untouched and add deterministic cents (0-99) so the listing
    // shows the exact, non-rounded value the quote would sum to.
    const baseValue = Math.floor(rng() * 450000) + 18000;
    const cents = Math.floor(rng() * 100);
    const totalValue = baseValue + cents / 100;
    
    const desc = QUOTE_DESCS[i % QUOTE_DESCS.length];
    
    /* Synthesize a versions[] list whose latest entry's `version`
       number matches the top-level `version`. The listing badge reads
       `quote.version`; the dropdown, history tab, and history modal
       all read `quote.versions[]`. Without seeding the array, the
       three surfaces showed a hardcoded v1–v3 trio regardless of what
       the listing claimed for that quote. */
    const versionsList: QuoteVersion[] = [];
    for (let vi = version; vi >= 1; vi--) {
      const isCurrent = vi === version;
      const vDate = new Date(createdDate.getTime() + (vi - 1) * 4 * 24 * 60 * 60 * 1000);
      const dStr = `${String(vDate.getMonth() + 1).padStart(2, '0')}/${String(vDate.getDate()).padStart(2, '0')}/${vDate.getFullYear()}`;
      const vStatus: QuoteVersionStatus = !isCurrent
        ? 'confirmed'
        : (weightedStatus === 'Draft' ? 'draft'
            : weightedStatus === 'Sent to Customer' ? 'sent'
            : weightedStatus === 'Confirmed SO' || weightedStatus === 'Unconfirmed SO' ? 'confirmed'
            : 'sent');
      const isFirst = vi === 1;
      const summary = isFirst
        ? `Initial quote — ${desc}`
        : (vi === version ? `Current revision — material changes accumulated` : `Revision ${vi} — line items reconfigured`);
      versionsList.push({
        version: vi,
        versionStatus: vStatus,
        date: dStr,
        sentAt: vStatus !== 'draft' ? dStr : undefined,
        confirmedAt: vStatus === 'confirmed' ? dStr : undefined,
        author: SALES_REPS[(i + vi) % SALES_REPS.length].name,
        summary,
      });
    }

    const quote: Quote = {
      id: `quote-${i}`,
      quoteNumber,
      version,
      versions: versionsList,
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
      /* Seed rejection reason + comments on any Rejected quote so the
         detail-page banner + listing status pill demo end-to-end
         without walking through the reject modal first. */
      /* Seed rejection reason + attribution on any Rejected quote —
         plus a specific "reactivated" index (Q-000-000-015) that
         sits in `Sent to Customer` state but still carries the
         rejection fields, so both the rejection banner AND the
         version-context strip render on first open (deck stack UI
         is demonstrable without walking through Reactivate). */
      ...(weightedStatus === 'Rejected' || i === 15 ? {
        rejectionReason: (['Price too high', 'Chose a competitor', 'Budget not approved', 'Lead time too long', 'Requirements changed'] as const)[i % 5],
        rejectionReasonText: (
          i % 5 === 0 ? 'Customer pushed back on unit pricing after board review — revise below the $92k ceiling.'
          : i % 5 === 1 ? 'Went with a regional vendor promising 14-day delivery; revise our lead time before resubmitting.'
          : i % 5 === 2 ? 'Board deferred capital approval to next quarter; expect to re-engage in Q3.'
          : i % 5 === 3 ? 'Delivery window slipped past their operational deadline; split shipment or expedite.'
          : 'Requested added on-board oxygen bay and a heavier alternator — quote the revised spec.'
        ),
        rejectedAt: now,
        rejectedBy: SALES_REPS[i % SALES_REPS.length].name,
      } : {}),
    };

    /* Synthesise a status-transition timeline for the header hover
       card. Every quote begins as a Draft; downstream transitions
       fire based on the target status. `Rejected` records get the
       "Sent to Customer → Rejected" chain — a couple of seeded rows
       even carry a `Reactivated` cycle so the scroll behaviour has
       something to demo. */
    const authorName = quote.salesRep.name;
    const daysBetween = (days: number) => new Date(createdDate.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
    const history: QuoteStatusHistoryEntry[] = [
      { timestamp: createdDate.toISOString(), label: 'Draft created', detail: `${authorName} · Quote drafted`, tone: 'neutral' },
    ];
    if (weightedStatus !== 'Draft' && weightedStatus !== 'Archived') {
      history.push({ timestamp: daysBetween(1), label: 'Sent to Customer', detail: `${authorName} · Emailed to primary contact`, tone: 'info' });
    }
    if (weightedStatus === 'Unconfirmed SO') {
      history.push({ timestamp: daysBetween(3), label: 'Confirmed by Customer', detail: `${authorName} · Customer signed off`, tone: 'success' });
    }
    if (weightedStatus === 'Confirmed SO') {
      history.push({ timestamp: daysBetween(3), label: 'Confirmed by Customer', detail: `${authorName} · Customer signed off`, tone: 'success' });
      history.push({ timestamp: daysBetween(5), label: 'Converted to Sales Order', detail: `${authorName} · SO created`, tone: 'success' });
    }
    if (weightedStatus === 'Rejected') {
      /* Every 3rd rejected quote gets a Reactivated → Sent → Rejected
         cycle so the timeline demos "20-50 transitions" scrolling. */
      const rejectionCycles = i % 3 === 0 ? 3 : 1;
      for (let r = 0; r < rejectionCycles; r++) {
        history.push({ timestamp: daysBetween(2 + r * 4), label: 'Rejected by Customer', detail: `${quote.rejectedBy ?? authorName} · ${quote.rejectionReason ?? 'Reason logged'}`, tone: 'destructive' });
        if (r < rejectionCycles - 1) {
          history.push({ timestamp: daysBetween(3 + r * 4), label: 'Reactivated', detail: `${authorName} · Resumed on same version`, tone: 'info' });
          history.push({ timestamp: daysBetween(3 + r * 4 + 1), label: 'Sent to Customer', detail: `${authorName} · Revised terms sent`, tone: 'info' });
        }
      }
    }
    if (i === 15) {
      /* Reactivated-from-Rejected demo — timeline shows Draft → Sent →
         Rejected → Reactivated → Sent so the current state (Sent to
         Customer with a rejection reason still on record) reads
         consistently with what the header banners are saying. */
      history.push({ timestamp: daysBetween(2), label: 'Rejected by Customer', detail: `${quote.rejectedBy ?? authorName} · ${quote.rejectionReason ?? 'Reason logged'}`, tone: 'destructive' });
      history.push({ timestamp: daysBetween(3), label: 'Reactivated', detail: `${authorName} · Resumed on same version`, tone: 'info' });
      history.push({ timestamp: daysBetween(4), label: 'Sent to Customer', detail: `${authorName} · Revised terms sent`, tone: 'info' });
    }
    if (weightedStatus === 'Cancelled') {
      history.push({ timestamp: daysBetween(4), label: 'Cancelled', detail: `${authorName} · ${quote.cancellationReason ?? 'Reason logged'}`, tone: 'destructive' });
    }
    if (weightedStatus === 'Expired') {
      history.push({ timestamp: daysBetween(30), label: 'Expired', detail: 'Auto-expired past validity window', tone: 'destructive' });
    }
    if (weightedStatus === 'Archived') {
      history.push({ timestamp: daysBetween(1), label: 'Archived', detail: `${authorName} · Archived from Draft`, tone: 'destructive' });
    }
    quote.statusHistory = history;

    quotes.push(quote);
  }
  
  return quotes;
}

/* Hero record for the "Outdated Configurations" demo. Its id
   (`q-outdated-demo`) matches the key exported from
   `data/outdatedConfigs.ts`, so this is the ONE quote in the
   listing that lights up the amber pill next to its status
   badge — every other row reads as up to date. Inserted at
   position #3 (index 2) so it's visible without scrolling. */
function buildOutdatedDemoQuote(): Quote {
  const customer = CUSTOMERS[0]; // Metro City Fire & Rescue
  const now = new Date('2026-06-30T09:15:00');
  const created = new Date('2026-05-14T10:20:00');
  const expiry = new Date('2026-08-01T00:00:00');
  const requested = new Date('2026-07-15T00:00:00');
  const respondBy = new Date('2026-07-10T00:00:00');
  const version = 1;
  const versions: QuoteVersion[] = [
    {
      version: 1,
      versionStatus: 'draft',
      date: '05/14/2026',
      author: SALES_REPS[0].name,
      summary: 'Draft — Type III ambulance conversion',
    },
  ];
  return {
    id: 'q-outdated-demo',
    quoteNumber: 'Q-000-000-042',
    version,
    versions,
    customer,
    primaryPoC: { id: 'poc-outdated-1', name: 'Marcus Chen', email: 'm.chen@metrofire.gov', role: 'Fleet Manager' },
    status: 'Draft',
    totalValue: 184250.75,
    createdDate: created,
    expiryDate: expiry,
    salesRep: SALES_REPS[0],
    priority: 'High',
    tags: ['Ambulance Build', 'Government Contract'],
    description: 'Type III ambulance conversion — Metro City Fire & Rescue',
    hasUnreadMessages: false,
    unreadMessageCount: 0,
    daysInCurrentStage: 12,
    requestedDate: requested,
    respondBy,
    winProbability: 78,
    lastUpdated: now,
  } as Quote;
}

export const mockQuotes = (() => {
  const base = generateMockQuotes(750);
  const hero = buildOutdatedDemoQuote();
  /* Splice at index 2 so the hero record sits at listing position
     #3 in the default (unsorted) order. Sort by any column still
     lets the pill find its quote by id — only the display order
     changes. */
  base.splice(2, 0, hero);
  applySparseCustomerSample(base);
  base.forEach(inCustomerCurrency);
  return base;
})();

/* The design's quotes are written in USD. Each is put in its customer's
   default currency (spec 4.3) with the rate on its quote date, and its
   value restated in it at that day's mid-market rate. Applied last, so
   the seeded RNG sequence is unchanged; USD quotes keep their numbers. */
function inCustomerCurrency(q: Quote): void {
  const stamp = stampQuoteRate(customerCurrency(q.customer.name), q.createdDate);
  if (stamp.currency !== DESIGN_CURRENCY) {
    q.totalValue = convertOn(q.totalValue, DESIGN_CURRENCY, stamp.currency, q.createdDate);
  }
  Object.assign(q, stamp);
}

/* Q-000-000-020 (first row of page 2) is repointed at the sample
   name-only customer so every surface can be checked against missing
   data: no contact, no sales rep, no addresses, no payment terms or
   method. Patched after generation so the seeded RNG sequence, and
   therefore every other quote, is unchanged. */
function applySparseCustomerSample(quotes: Quote[]) {
  const q = quotes.find((x) => x.quoteNumber === 'Q-000-000-020');
  if (!q) return;
  q.customer = { id: SAMPLE_EMPTY_CUSTOMER.id, name: SAMPLE_EMPTY_CUSTOMER.name };
  q.primaryPoC = undefined;
  q.additionalPoCs = undefined;
  q.salesRep = undefined;
  q.additionalSalesReps = undefined;
  q.status = 'Draft';
  q.description = '';
  q.billingAddress = '';
  q.shippingAddress = '';
  q.paymentTerms = '';
  q.paymentMethod = '';
  q.confirmationDate = undefined;
  q.cancellationReason = undefined;
  q.rejectionReason = undefined;
  q.rejectionReasonText = undefined;
  q.rejectedAt = undefined;
  q.rejectedBy = undefined;
  q.statusHistory = [
    { timestamp: q.createdDate.toISOString(), label: 'Draft created', detail: 'Quote drafted', tone: 'neutral' },
  ];
  const d = q.createdDate;
  const dStr = `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
  q.version = 1;
  q.versions = [{ version: 1, versionStatus: 'draft', date: dStr, author: 'Current User', summary: 'Initial quote' }];
}
export { SALES_REPS, CUSTOMERS, STATUSES, PRIORITIES, TAGS, CANCELLATION_REASONS };