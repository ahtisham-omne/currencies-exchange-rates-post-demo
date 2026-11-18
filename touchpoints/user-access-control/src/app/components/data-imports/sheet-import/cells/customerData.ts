/* Customers, locations and contacts as the module generates them in
   Step1CustomerSelection, copied so its search overlay runs here without the
   whole creation step coming along. */

export interface Location {
  id: string;
  name: string;
  city: string;
  address: string;
  isDefault: boolean;
  /** Area code for the location's city — used to keep generated
      contact phone numbers consistent with the address (so a contact
      based in Huntsville reads (256) ..., not a random NPA). */
  areaCode: string;
  /** Derived from MOCK_CONTACTS after the contact pass — total number
   *  of POCs whose `locationId` matches this location. */
  pocCount?: number;
  /** Name of the contact flagged `isPrimary: true` for this location.
   *  Every location is guaranteed to have one after enrichment. */
  primaryContact?: string;
  /** Initials for the primary contact's avatar tile on the card. */
  primaryContactInitials?: string;
}

export interface Contact {
  id: string;
  name: string;
  initials: string;
  email: string;
  phone: string;
  mobile: string;
  extension: string;
  title: string;
  department: string;
  customerId: string;
  customerName: string;
  customerLogo: string;
  locationId: string;
  locationName: string;
  locationCity: string;
  locationAddress: string;
  isPrimary: boolean;
  // Additional hidden fields for enhanced search
  alternateEmails?: string[];
  alternatePhones?: string[];
  notes?: string;
  tags?: string[];
}


export interface Customer {
  id: string;
  name: string;
  logo: string;
  status: 'Active' | 'Inactive';
  locations: Location[];
  totalContacts: number;
  recentQuote: string;
}

// Generate mock data with THOUSANDS of contacts
const CUSTOMER_NAMES = [
  'Metro City Fire & Rescue', 'Tri-County EMS Authority', 'Lakewood Community Hospital',
  'Pinecrest Volunteer Fire Dept', 'Summit Regional Medical Center',
  'Eagle County Sheriff\'s Office', 'Pacific Northwest Ambulance Co.',
  'Riverside Utility District', 'Heartland Air Ambulance', 'Great Plains Fire Protection',
  'Coastal Search & Rescue', 'Valley Health System', 'Cedar Falls Township FD',
  'National Park Service - Region 4', 'Dispatch Medical Transport',
  'Blue Ridge EMS Cooperative', 'Sunbelt Municipal Services',
  'Northern Tier Volunteer Rescue', 'Lakeshore Police Department',
  'Red Rock Indian Health Service', 'Bayshore Fire District'
];

/* CITIES — each row is a real US city in the named state, paired with
   its actual area code so every phone number we synthesise for a
   contact at that location reads as plausibly local. Previously the
   `state` field carried AI-corrupted pairings (Santa Ana / Illinois,
   Mobile / Connecticut, Aurora / Maine) which broke believability for
   anyone reading addresses. Fixed to match the real cities. */
const CITIES = [
  { city: 'Charlotte',    state: 'North Carolina', zip: '28202', areaCode: '704' },
  { city: 'Santa Ana',    state: 'California',     zip: '92701', areaCode: '714' },
  { city: 'Hartford',     state: 'Connecticut',    zip: '06103', areaCode: '860' },
  { city: 'Mobile',       state: 'Alabama',        zip: '36602', areaCode: '251' },
  { city: 'Aurora',       state: 'Colorado',       zip: '80012', areaCode: '303' },
  { city: 'Salem',        state: 'Oregon',         zip: '97301', areaCode: '503' },
  { city: 'Daxton',       state: 'Georgia',        zip: '30319', areaCode: '404' },
  { city: 'Oceanside',    state: 'California',     zip: '92054', areaCode: '760' },
  { city: 'Georgetown',   state: 'Kentucky',       zip: '40324', areaCode: '502' },
  { city: 'San Antonio',  state: 'Texas',          zip: '78205', areaCode: '210' },
  { city: 'Indianapolis', state: 'Indiana',        zip: '46204', areaCode: '317' },
  { city: 'Jackson',      state: 'Mississippi',    zip: '39201', areaCode: '601' },
  { city: 'Huntsville',   state: 'Alabama',        zip: '35806', areaCode: '256' },
  { city: 'Rockford',     state: 'Illinois',       zip: '61101', areaCode: '815' },
];

const FIRST_NAMES = ['Sherry', 'Braelyn', 'Leah', 'Jamya', 'Peyton', 'Jama', 'James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda', 'William', 'Elizabeth', 'Sarah'];
const LAST_NAMES = ['Brown', 'Lowe', 'Wilkins', 'House', 'Ellison', 'Sherry', 'Smith', 'Johnson', 'Williams', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez'];
const TITLES = [
  'Fleet Manager', 'Fire Chief', 'EMS Director', 'Procurement Officer',
  'Captain', 'Logistics Coordinator', 'Finance Director', 'Operations Chief',
  'Deputy Chief', 'Battalion Chief', 'Maintenance Supervisor', 'Supply Officer',
  'Medical Director', 'Administrative Assistant', 'Station Captain'
];

const LOCATION_TYPES = ['Headquarters', 'Station', 'Regional Office', 'Maintenance Facility', 'Dispatch Center', 'Training Center', 'Fleet Yard'];

const TAGS = ['VIP', 'Key Decision Maker', 'Preferred Contact', 'Authorized Signer', 'Technical Lead', 'Budget Owner'];
const NOTES_TEMPLATES = [
  'Previously managed fleet at neighboring district',
  'Handles all apparatus procurement for this agency',
  'Former board member of state EMS association',
  'Also reachable via station phone',
  'Prefers email communication for quotes',
  'Available Mon-Thu; off-shift Fri-Sun rotation'
];

/* Bug B3: this module used to seed every count + pick with Math.random,
   which produced different values on every full page refresh — the
   user reported contact counts of 68 then 107 for the same customer
   across reloads. Counts (locationCount, contactsPerLocation) and any
   selection that affects derived counts now use a tiny deterministic
   PRNG keyed by stable identifiers (customer index, location index,
   etc.). The visual noise (tags, notes, alternate email presence) can
   stay random — it doesn't show up in summary counts. */
function seededRand(seed: number): number {
  let t = (seed + 0x6D2B79F5) | 0;
  t = Math.imul(t ^ (t >>> 15), 1 | t);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function seededInt(seed: number, min: number, span: number): number {
  return min + Math.floor(seededRand(seed) * span);
}

// Generate customers with HUNDREDS of locations each
export const MOCK_CUSTOMERS: Customer[] = CUSTOMER_NAMES.map((name, idx) => {
  const locations: Location[] = [];
  const locationCount = seededInt(idx * 101 + 17, 5, 10); // 5-15 locations per customer (deterministic)

  for (let i = 0; i < locationCount; i++) {
    const cityData = CITIES[seededInt(idx * 101 + i * 7 + 23, 0, CITIES.length)];
    const locationType = LOCATION_TYPES[seededInt(idx * 101 + i * 7 + 41, 0, LOCATION_TYPES.length)];
    locations.push({
      id: `l${idx}_${i}`,
      name: `${locationType} ${i === 0 ? 'Main' : i % 5 === 0 ? 'North' : i % 3 === 0 ? 'South' : 'East'}`,
      city: `${cityData.city}, ${cityData.state}`,
      address: `${1000 + i * 100} Business Park Dr, ${cityData.city}, ${cityData.state} ${cityData.zip}`,
      isDefault: i === 0,
      areaCode: cityData.areaCode,
    });
  }
  
  return {
    id: `c${idx + 1}`,
    name,
    logo: name.split(' ').slice(0, 2).map(w => w[0]).join(''),
    status: 'Active',
    locations,
    totalContacts: 0, // Will be calculated
    recentQuote: `${idx + 1} days ago`
  };
});

/* Three "Ovex LLC" entries with distinct addresses so the duplicate-
   customer confirmation has a real multi-match case to demonstrate.
   Same name, different cities — the picker has to surface the
   address sub-line for the user to disambiguate. Name is short and
   easy to type so it's quick to reproduce in QA. */
const OVEX_VARIANTS: Customer[] = [
  {
    id: 'c_ovex_la',
    name: 'Ovex LLC',
    logo: 'OL',
    status: 'Active',
    totalContacts: 0,
    recentQuote: '2 days ago',
    locations: [
      { id: 'c_ovex_la_l0', name: 'Headquarters', city: 'Los Angeles, CA', address: '450 S Spring St, Los Angeles, CA 90013', isDefault: true, areaCode: '213' },
      { id: 'c_ovex_la_l1', name: 'Distribution Center', city: 'Long Beach, CA', address: '1200 Pier S Ave, Long Beach, CA 90802', isDefault: false, areaCode: '562' },
    ],
  },
  {
    id: 'c_ovex_dallas',
    name: 'Ovex LLC',
    logo: 'OL',
    status: 'Active',
    totalContacts: 0,
    recentQuote: '6 days ago',
    locations: [
      { id: 'c_ovex_dallas_l0', name: 'Regional Office', city: 'Dallas, TX', address: '500 N Akard St, Dallas, TX 75201', isDefault: true, areaCode: '214' },
    ],
  },
  {
    id: 'c_ovex_atl',
    name: 'Ovex LLC',
    logo: 'OL',
    status: 'Active',
    totalContacts: 0,
    recentQuote: '11 days ago',
    locations: [
      { id: 'c_ovex_atl_l0', name: 'Atlanta Branch', city: 'Atlanta, GA', address: '1180 W Peachtree St NW, Atlanta, GA 30309', isDefault: true, areaCode: '404' },
    ],
  },
];
MOCK_CUSTOMERS.unshift(...OVEX_VARIANTS);

// Generate THOUSANDS of contacts
export const MOCK_CONTACTS: Contact[] = [];
MOCK_CUSTOMERS.forEach((customer, cidx) => {
  let totalContactsForCustomer = 0;

  /* Names are uniqued per CUSTOMER (not per location) so a contact
     never appears twice in the picker when the location pill is off.
     Was per-location before — that left collisions visible whenever
     two of the same customer's offices generated the same first +
     last name combination (e.g. Elizabeth Brown in two Heartland
     locations). The picker shows the union of locations, so any
     cross-location duplicate read as the same person twice. */
  const usedNamesForCustomer = new Set<string>();

  /* Heartland Air Ambulance is the demo's reference customer; we
     reserve specific slots so the picker + search overlay always
     surface the same canonical people:
       · slot 0 of location 0 → Leah Davis (primary)
       · slot 1 of location 0 → Sarah Johnson (NOT primary — she's
         the "add a new contact" demo target)
     Other customers get the standard seeded draw. */
  const isHeartland = customer.name === 'Heartland Air Ambulance';
  const reservedSlots: Record<string, { first: string; last: string }> = isHeartland
    ? { '0:0': { first: 'Leah', last: 'Davis' }, '0:1': { first: 'Sarah', last: 'Johnson' } }
    : {};

  customer.locations.forEach((location, lidx) => {
    /* Bug B3: contactsPerLocation drives the visible "X contacts"
       count, so it must be deterministic across page refreshes. */
    const contactsPerLocation = seededInt(cidx * 257 + lidx * 13 + 7, 5, 10);
    totalContactsForCustomer += contactsPerLocation;

    for (let i = 0; i < contactsPerLocation; i++) {
      const baseSeed = cidx * 100003 + lidx * 1009 + i * 17;
      let firstName: string;
      let lastName: string;
      /* Apply any reserved slot for this (location, contact) pair
         before falling through to the seeded draw. */
      const slotKey = `${lidx}:${i}`;
      const reserved = reservedSlots[slotKey];
      if (reserved) {
        firstName = reserved.first;
        lastName = reserved.last;
      } else {
        firstName = FIRST_NAMES[seededInt(baseSeed + 1, 0, FIRST_NAMES.length)];
        lastName = LAST_NAMES[seededInt(baseSeed + 2, 0, LAST_NAMES.length)];
        /* Re-roll on collision against the customer-wide set. Worst-
           case bound is FIRST_NAMES.length × LAST_NAMES.length (≈238
           combos); the per-customer total is well under that, so the
           loop normally lands on the first try. */
        let salt = 3;
        while (usedNamesForCustomer.has(`${firstName} ${lastName}`)) {
          firstName = FIRST_NAMES[seededInt(baseSeed + salt * 31, 0, FIRST_NAMES.length)];
          lastName = LAST_NAMES[seededInt(baseSeed + salt * 47, 0, LAST_NAMES.length)];
          salt += 1;
          if (salt > 400) break; // safety net — should never trigger
        }
      }
      usedNamesForCustomer.add(`${firstName} ${lastName}`);

      /* Visual noise (tags, notes, alternate-info flags) stays
         random-ish but is now seeded for reproducibility, so the
         same person renders with the same chrome across reloads. */
      const hasAlternateInfo = seededRand(baseSeed + 5) > 0.3;
      const alternateEmails = hasAlternateInfo ? [
        `${firstName.toLowerCase()}@${customer.name.toLowerCase().replace(/[^a-z]+/g, '')}.com`,
        `${firstName[0].toLowerCase()}${lastName.toLowerCase()}@${customer.name.toLowerCase().replace(/[^a-z]+/g, '')}.com`
      ] : undefined;
      /* Every phone for this contact uses the LOCATION's area code so
         the directory reads as a single office (Huntsville (256), San
         Antonio (210), etc.) instead of a random mix of NPAs. */
      const npa = location.areaCode;
      const alternatePhones = hasAlternateInfo ? [
        `(${npa}) ${seededInt(baseSeed + 6, 200, 800)}-${seededInt(baseSeed + 7, 1000, 9000)}`
      ] : undefined;

      const contactTags = TAGS.filter((_, ti) => seededRand(baseSeed + 8 + ti) > 0.6).slice(0, 2);
      const contactNotes = seededRand(baseSeed + 9) > 0.5
        ? NOTES_TEMPLATES[seededInt(baseSeed + 10, 0, NOTES_TEMPLATES.length)]
        : undefined;

      MOCK_CONTACTS.push({
        id: `p${cidx}_${lidx}_${i}`,
        name: `${firstName} ${lastName}`,
        initials: `${firstName[0]}${lastName[0]}`,
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${customer.name.toLowerCase().replace(/[^a-z]+/g, '')}.com`,
        phone: `(${npa}) ${seededInt(baseSeed + 11, 200, 800)}-${seededInt(baseSeed + 12, 1000, 9000)}`,
        mobile: `(${npa}) ${seededInt(baseSeed + 13, 200, 800)}-${seededInt(baseSeed + 14, 1000, 9000)}`,
        extension: String(seededInt(baseSeed + 15, 100, 9900)),
        title: TITLES[seededInt(baseSeed + 16, 0, TITLES.length)],
        department: TITLES[seededInt(baseSeed + 17, 0, TITLES.length)],
        customerId: customer.id,
        customerName: customer.name,
        customerLogo: customer.logo,
        locationId: location.id,
        locationName: location.name,
        locationCity: location.city,
        locationAddress: location.address,
        isPrimary: i === 0,
        alternateEmails,
        alternatePhones,
        tags: contactTags.length > 0 ? contactTags : undefined,
        notes: contactNotes,
      });
    }
  });
  
  customer.totalContacts = totalContactsForCustomer;
});

/* Second pass — decorate each location with its POC count and the
   flagged primary contact derived from MOCK_CONTACTS. Without this,
   the LocationSelectionModal cards show "0 contacts" + "No primary
   contact on file" even though the underlying data has them. */
MOCK_CUSTOMERS.forEach((customer) => {
  customer.locations.forEach((location) => {
    const locContacts = MOCK_CONTACTS.filter(
      (c) => c.customerId === customer.id && c.locationId === location.id,
    );
    const primary = locContacts.find((c) => c.isPrimary) ?? locContacts[0];
    location.pocCount = locContacts.length;
    location.primaryContact = primary?.name;
    location.primaryContactInitials = primary?.initials;
  });
});

