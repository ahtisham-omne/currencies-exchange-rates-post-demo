import { useState, useRef, useEffect } from 'react';
import { Search, X, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { QuoteDraft } from '@/app/components/CreateQuoteModal';
import { SearchOverlay } from './SearchOverlay';
import { Step2Configuration } from './Step2Configuration';
import { ConfirmDiscardModal } from '@/app/components/shared/ConfirmDiscardModal';
import type { CreatedCustomerPayload } from '@/app/components/external/partners/CreateCustomerModal';
import type { CreatedContactPayload } from '@/app/components/external/partners/CreateContactModal';
import { openPartnerTab } from '@/app/components/external/partners/openPartnerTab';
import StateTransitionOverlay from '@/app/components/shared/StateTransitionOverlay';
import { SAMPLE_EMPTY_CUSTOMER, getCustomerDefaults } from '@/app/components/shared/customerDefaults';
import { FIELD_RULES, FieldErrorText } from '@/app/components/shared/fieldRequirements';

interface Step1CustomerSelectionProps {
  quoteDraft: QuoteDraft;
  onUpdate: (updates: Partial<QuoteDraft>) => void;
  onNext: () => void;
  /* Pass-through from the parent modal so Step 2's selected-customer
     surface can reflow into a two-column layout when there's
     horizontal space. */
  isFullView?: boolean;
  /** Set by the parent after a Continue / Create click with a required
   *  selection missing. Paints the search bar, or the empty point of
   *  contact row, with the Partner field-error chrome. */
  showErrors?: boolean;
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

/* Name-only customer (Partners only requires a name). No locations and
   no contacts, so the creation flow can be checked against missing
   data. Listed first so it shows in the recent customers list. */
MOCK_CUSTOMERS.unshift({
  id: SAMPLE_EMPTY_CUSTOMER.id,
  name: SAMPLE_EMPTY_CUSTOMER.name,
  logo: 'HP',
  status: 'Active',
  locations: [],
  totalContacts: 0,
  recentQuote: 'Today',
});

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

export function Step1CustomerSelection({ quoteDraft, onUpdate, onNext, isFullView = false, showErrors = false }: Step1CustomerSelectionProps) {
  const [isSearchOverlayOpen, setIsSearchOverlayOpen] = useState(false);
  /* Slim "Create Customer" modal lives under external/partners so it
     can be replaced/deleted independently of the rest of the creation
     flow. Opens when the user clicks "Add New Customer" in the empty
     state; on submit, the new customer is synthesised into a Customer
     record (with a single default location seeded from the address)
     and `handleSelectCustomer` runs as if the user had picked an
     existing customer. */
  /* Partner-tab handshake — when the new Partner Management tab posts
     back a created record, we hold the payload here so the existing
     creation animation + handleSelectCustomer/Contact pipeline still
     runs in the originating tab. The partner tab plays its own
     "Adding…" overlay before closing; we play a brief continuation
     so the user sees the work land here. */
  const [pendingCustomerCreation, setPendingCustomerCreation] = useState<CreatedCustomerPayload | null>(null);
  const [pendingContactCreation, setPendingContactCreation] = useState<CreatedContactPayload | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  // Add keyboard shortcut support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ⌘K or Ctrl+K to open search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOverlayOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleOpenSearchOverlay = () => {
    setIsSearchOverlayOpen(true);
  };

  const handleSelectCustomer = (customer: Customer) => {
    const defaultLocation = customer.locations.find(l => l.isDefault) || customer.locations[0];
    
    // Get all contacts for this customer
    const customerContacts = MOCK_CONTACTS.filter(c => c.customerId === customer.id);
    
    // Find the primary contact
    const primaryContact = customerContacts.find(c => c.isPrimary) || customerContacts[0];

    /* Seed the recipients list with the PRIMARY contact only. The
       customer's secondary POCs still live in MOCK_CONTACTS and are
       reachable through the "Add Secondary POC" picker — they just
       shouldn't auto-attach to every quote. Forcing the user to opt
       in keeps the recipient list scoped to who actually needs the
       quote, and lines up with what Step 1b renders below. */
    const recipients = primaryContact ? [{
      id: primaryContact.id,
      name: primaryContact.name,
      email: primaryContact.email,
      phone: primaryContact.phone,
      mobile: primaryContact.mobile,
      title: primaryContact.title,
      department: primaryContact.department,
      initials: primaryContact.initials,
      isPrimary: true,
    }] : [];
    
    onUpdate({
      customer: {
        id: customer.id,
        name: customer.name,
        /* A name-only customer has no locations, so there is no
           location to carry. Left undefined rather than " - ". */
        location: defaultLocation ? `${defaultLocation.name} - ${defaultLocation.city}` : undefined,
      },
      primaryPoC: primaryContact ? {
        id: primaryContact.id,
        name: primaryContact.name,
        email: primaryContact.email
      } : null,
      recipients
    });
    setIsSearchOverlayOpen(false);
  };

  const handleSelectContact = (contact: Contact) => {
    // When selecting a specific contact, only add that contact to recipients
    // and set them as the primary POC
    onUpdate({
      customer: {
        id: contact.customerId,
        name: contact.customerName,
        location: contact.locationName ? `${contact.locationName} - ${contact.locationCity}` : undefined,
      },
      primaryPoC: {
        id: contact.id,
        name: contact.name,
        email: contact.email
      },
      recipients: [{
        id: contact.id,
        name: contact.name,
        email: contact.email,
        phone: contact.phone,
        mobile: contact.mobile,
        title: contact.title,
        department: contact.department,
        initials: contact.initials,
        isPrimary: true
      }]
    });
    setIsSearchOverlayOpen(false);
  };

  /* Synthesise a Customer record from the CreateCustomerModal payload
     and push it into `MOCK_CUSTOMERS` so subsequent renders + the
     search overlay can find it. The new customer's address becomes
     its single default location (which then surfaces as the default
     ship-to + bill-to until real locations are added from Partner
     Management). Mirrors the shape of the existing seeded customers
     so the rest of Step 1's logic doesn't need to branch. */
  const handleCustomerCreated = (payload: CreatedCustomerPayload) => {
    const newId = `c_new_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const defaultLocId = `${newId}_loc0`;
    const defaultLocation: Location = {
      id: defaultLocId,
      name: 'Headquarters Main',
      city: payload.defaultAddress.cityState,
      address: payload.defaultAddress.full,
      isDefault: true,
      areaCode: '000',
      pocCount: 0,
      primaryContact: '',
      primaryContactInitials: '—',
    };
    const newCustomer: Customer = {
      id: newId,
      name: payload.name,
      logo: payload.logoLetter,
      status: 'Active',
      locations: [defaultLocation],
      totalContacts: 0,
      recentQuote: '—',
    };
    /* `MOCK_CUSTOMERS` is the in-memory directory the SearchOverlay
       reads from. Mutating in-place keeps the modal's exported list
       consistent across opens within the same session. */
    MOCK_CUSTOMERS.unshift(newCustomer);
    handleSelectCustomer(newCustomer);
  };

  /* Clear-all guard. The Clear All button now opens a confirmation
     modal first; only on confirm does the customer + primary POC
     actually reset. Mirrors the SO module's pattern. */
  const [showClearAllConfirm, setShowClearAllConfirm] = useState(false);
  const handleClearSelection = () => setShowClearAllConfirm(true);
  const performClearSelection = () => {
    onUpdate({
      customer: null,
      primaryPoC: null
    });
  };

  // If customer is selected, show configuration body
  if (quoteDraft.customer) {
    return (
      <div className="flex flex-col h-full relative">
        {/* Configuration Body */}
        <Step2Configuration quoteDraft={quoteDraft} onUpdate={onUpdate} onClearAll={handleClearSelection} isFullView={isFullView} showPocError={showErrors && !quoteDraft.primaryPoC} />

        {/* Clear All confirmation — mirrors the Partner red-themed
            discard chrome used across the suite. Copy avoids any
            em-dashes per the suite-wide rule. */}
        <ConfirmDiscardModal
          open={showClearAllConfirm}
          onOpenChange={(o) => { if (!o) setShowClearAllConfirm(false); }}
          title="Clear customer and contact selection?"
          description="The selected customer, point of contact, billing and shipping addresses, payment terms, and sales rep choices will be cleared. You can pick a customer again to start over."
          confirmLabel="Clear selection"
          cancelLabel="Keep selection"
          onConfirm={() => {
            setShowClearAllConfirm(false);
            performClearSelection();
          }}
        />
      </div>
    );
  }

  // Otherwise, show search interface
  return (
    <div className="flex flex-col h-full bg-white">
      {/* Content with padding */}
      <div className="px-6 py-5 flex-1 overflow-y-auto flex flex-col">
        {/* Title and Description */}
        <div className="mb-4">
          <h2 className="text-[20px] text-foreground mb-1" style={{ fontWeight: 600 }}>
            Select Customer and Point of Contact
          </h2>
          <p className="text-[13px] text-muted-foreground">
            Choose a contact or create a new one to create this quote.{' '}
            <a
              href="#"
              className="text-primary hover:text-primary/80 transition-colors inline-flex items-center gap-1"
              style={{ fontWeight: 500 }}
              onClick={(e) => e.preventDefault()}
            >
              Learn more
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" className="inline-block">
                <path d="M3 9L9 3M9 3H4.5M9 3V7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </a>
          </p>
        </div>

        {/* Search Bar - Click to open overlay (Partners search styling) */}
        <div ref={searchRef} className="relative mb-4" data-field="customer">
          <button
            onClick={handleOpenSearchOverlay}
            aria-invalid={showErrors}
            aria-describedby={showErrors ? 'create-quote-recipient-error' : undefined}
            className={`w-full relative flex items-center border rounded-lg focus:outline-none transition-all text-left bg-white ${
              showErrors
                ? 'border-red-400 hover:border-red-500 focus:border-red-500 shadow-[0_0_0_3px_rgba(239,68,68,0.12)] hover:shadow-[0_0_0_4px_rgba(239,68,68,0.18)]'
                : 'border-border hover:border-primary focus:border-primary focus:ring-2 focus:ring-primary/20 shadow-sm hover:shadow-md'
            }`}
            style={{ height: '44px' }}
          >
            <Search className="absolute left-4 w-[18px] h-[18px] text-muted-foreground" />
            <div className="w-full pl-12 pr-20 py-2.5 text-[14px] text-muted-foreground">
              Search for the customer or contact to create a quote for...
            </div>
            <div className="absolute right-3 px-2.5 py-1 bg-muted border border-border rounded text-[11px] text-muted-foreground" style={{ fontWeight: 500 }}>
              ⌘K
            </div>
          </button>
          {showErrors && (
            <FieldErrorText id="create-quote-recipient-error">
              {FIELD_RULES.customer.missingMessage}
            </FieldErrorText>
          )}
        </div>

        {/* Empty State (Partners empty-state pattern). The "Add new
            customer" affordance keeps the flow unblocked when the
            account isn't already on file — toast for now while the
            create-customer modal is being built out. */}
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <div className="w-11 h-11 rounded-xl bg-muted flex items-center justify-center mb-3">
            <Search className="w-5 h-5 text-muted-foreground" strokeWidth={1.75} />
          </div>
          <h3 className="text-[13px] text-foreground mb-1" style={{ fontWeight: 600 }}>
            No Customer Selected
          </h3>
          <p className="text-xs text-muted-foreground max-w-md mb-4">
            Select the customer you intend to create a quote for.
          </p>
          <button
            type="button"
            onClick={async () => {
              /* Empty-state CTA — opens the Partner Management new
                 tab so the user gets the full create flow in its
                 native chrome. The partner tab posts the payload
                 back via window.opener.postMessage and self-closes;
                 we play a brief continuation overlay before dropping
                 the new customer into MOCK_CUSTOMERS via the
                 existing handleCustomerCreated pipeline. */
              const result = await openPartnerTab<CreatedCustomerPayload>('create-customer', { origin: 'quote' });
              if (result) setPendingCustomerCreation(result.payload);
            }}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-primary text-white hover:bg-[#0862D0] transition-colors cursor-pointer shadow-sm"
            style={{ fontSize: 13, fontWeight: 600 }}
          >
            <UserPlus className="w-3.5 h-3.5" />
            Create New Customer
          </button>
        </div>
      </div>

      {/* Search Overlay */}
      <SearchOverlay
        isOpen={isSearchOverlayOpen}
        onClose={() => setIsSearchOverlayOpen(false)}
        onSelectCustomer={handleSelectCustomer}
        onSelectContact={handleSelectContact}
        onAddNew={async (tab, query) => {
          /* All / Customers → customer create.
             Contacts → contact create.
             Both routes open the Partner Management new tab seeded
             with the typed query. On payload return, the local
             pipeline (handleCustomerCreated / handleSelectContact)
             still runs so the rest of Step 1 doesn't have to
             branch on the new tab origin. */
          if (tab === 'customers' || tab === 'all') {
            setIsSearchOverlayOpen(false);
            const result = await openPartnerTab<CreatedCustomerPayload>('create-customer', { seedName: query, origin: 'quote' });
            if (result) setPendingCustomerCreation(result.payload);
          } else if (tab === 'contacts') {
            setIsSearchOverlayOpen(false);
            const result = await openPartnerTab<CreatedContactPayload>('create-poc', {
              seedName: query,
              customerId: quoteDraft.customer?.id,
              customerName: quoteDraft.customer?.name,
              origin: 'quote',
            });
            if (result) setPendingContactCreation(result.payload);
          }
        }}
        initialSearchRect={searchRef.current?.getBoundingClientRect()}
        customers={MOCK_CUSTOMERS}
        contacts={MOCK_CONTACTS}
        hideLocationsTab
      />

      {/* Continuation animations for partner-tab payloads. The
          Partner Management tab plays its own "Adding customer" arc
          before posting back; these overlays cover the brief moment
          between window.close() over there and the new record
          landing in our local pipeline. Each onComplete runs the
          same handler the in-tab modal used to call. */}
      <StateTransitionOverlay
        isActive={pendingCustomerCreation !== null}
        heading="Adding customer"
        fromLabel="Partner Management"
        toLabel={pendingCustomerCreation?.name || 'Customer'}
        tone="success"
        meta="Bringing the customer into this quote"
        duration={1200}
        onComplete={() => {
          if (pendingCustomerCreation) {
            const existing = (pendingCustomerCreation as unknown as { useExisting?: boolean; existingId?: string }).useExisting
              ? MOCK_CUSTOMERS.find((c) => c.id === (pendingCustomerCreation as unknown as { existingId: string }).existingId)
              : null;
            if (existing) {
              handleSelectCustomer(existing);
              toast.success(`Using existing customer "${existing.name}"`, { position: 'top-right' });
            } else {
              handleCustomerCreated(pendingCustomerCreation);
              toast.success(`Customer "${pendingCustomerCreation.name}" added`, { position: 'top-right' });
            }
          }
          setPendingCustomerCreation(null);
        }}
      />
      <StateTransitionOverlay
        isActive={pendingContactCreation !== null}
        heading="Adding contact"
        fromLabel="Partner Management"
        toLabel={pendingContactCreation?.name || 'Contact'}
        tone="success"
        meta="Bringing the contact into this quote"
        duration={1200}
        onComplete={() => {
          if (pendingContactCreation) {
            const payload = pendingContactCreation;
            const fullCust = payload.companyId ? MOCK_CUSTOMERS.find((c) => c.id === payload.companyId) : undefined;
            const newContact: Contact = {
              id: payload.id,
              name: payload.name,
              initials: payload.initials,
              email: payload.email,
              phone: payload.phone,
              mobile: payload.mobile,
              extension: payload.phoneExt,
              title: payload.role,
              department: payload.department,
              customerId: fullCust?.id || '',
              customerName: fullCust?.name || payload.companyName,
              customerLogo: fullCust?.logo || '',
              locationId: fullCust?.locations?.[0]?.id || '',
              locationName: fullCust?.locations?.[0]?.name || '',
              locationCity: fullCust?.locations?.[0]?.city || '',
              locationAddress: fullCust?.locations?.[0]?.address || '',
              isPrimary: false,
            };
            MOCK_CONTACTS.unshift(newContact);
            handleSelectContact(newContact);
            toast.success(`Contact "${newContact.name}" added`, { position: 'top-right' });
          }
          setPendingContactCreation(null);
        }}
      />
    </div>
  );
}