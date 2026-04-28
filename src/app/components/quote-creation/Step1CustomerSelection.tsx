import { useState, useRef, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { QuoteDraft } from '@/app/components/CreateQuoteModal';
import { SearchOverlay } from './SearchOverlay';
import { Step2Configuration } from './Step2Configuration';

interface Step1CustomerSelectionProps {
  quoteDraft: QuoteDraft;
  onUpdate: (updates: Partial<QuoteDraft>) => void;
  onNext: () => void;
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

const CITIES = [
  { city: 'Charlotte', state: 'North Carolina', zip: '28202' },
  { city: 'Santa Ana', state: 'Illinois', zip: '85486' },
  { city: 'Hartford', state: 'Connecticut', zip: '06103' },
  { city: 'Mobile', state: 'Connecticut', zip: '06770' },
  { city: 'Aurora', state: 'Maine', zip: '56377' },
  { city: 'Salem', state: 'Oklahoma', zip: '73034' },
  { city: 'Daxton', state: 'Georgia', zip: '30319' },
  { city: 'Oceanside', state: 'Colorado', zip: '81732' },
  { city: 'Georgetown', state: 'Kentucky', zip: '40324' },
  { city: 'San Antonio', state: 'Texas', zip: '78245' },
  { city: 'Indianapolis', state: 'Indiana', zip: '46204' },
  { city: 'Jackson', state: 'Mississippi', zip: '39602' },
  { city: 'Huntsville', state: 'Alabama', zip: '35806' },
  { city: 'Rockford', state: 'Illinois', zip: '61101' },
];

const FIRST_NAMES = ['Sherry', 'Braelyn', 'Leah', 'Jamya', 'Peyton', 'Jama', 'James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda', 'William', 'Elizabeth'];
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

// Generate customers with HUNDREDS of locations each
export const MOCK_CUSTOMERS: Customer[] = CUSTOMER_NAMES.map((name, idx) => {
  const locations: Location[] = [];
  const locationCount = 5 + Math.floor(Math.random() * 10); // 5-15 locations per customer (reduced from 50-200)
  
  for (let i = 0; i < locationCount; i++) {
    const cityData = CITIES[Math.floor(Math.random() * CITIES.length)];
    const locationType = LOCATION_TYPES[Math.floor(Math.random() * LOCATION_TYPES.length)];
    locations.push({
      id: `l${idx}_${i}`,
      name: `${locationType} ${i === 0 ? 'Main' : i % 5 === 0 ? 'North' : i % 3 === 0 ? 'South' : 'East'}`,
      city: `${cityData.city}, ${cityData.state}`,
      address: `${1000 + i * 100} Business Park Dr, ${cityData.city}, ${cityData.state} ${cityData.zip}`,
      isDefault: i === 0
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

// Generate THOUSANDS of contacts
export const MOCK_CONTACTS: Contact[] = [];
MOCK_CUSTOMERS.forEach((customer, cidx) => {
  let totalContactsForCustomer = 0;
  
  customer.locations.forEach((location, lidx) => {
    const contactsPerLocation = 5 + Math.floor(Math.random() * 10); // 5-15 contacts per location (reduced from 10-50)
    totalContactsForCustomer += contactsPerLocation;
    
    for (let i = 0; i < contactsPerLocation; i++) {
      const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
      const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
      
      // Generate alternate emails and phones for some contacts (70% chance - increased for better demo)
      const hasAlternateInfo = Math.random() > 0.3;
      const alternateEmails = hasAlternateInfo ? [
        `${firstName.toLowerCase()}@${customer.name.toLowerCase().replace(/[^a-z]+/g, '')}.com`,
        `${firstName[0].toLowerCase()}${lastName.toLowerCase()}@${customer.name.toLowerCase().replace(/[^a-z]+/g, '')}.com`
      ] : undefined;
      const alternatePhones = hasAlternateInfo ? [
        `(${200 + Math.floor(Math.random() * 800)}) ${200 + Math.floor(Math.random() * 800)}-${1000 + Math.floor(Math.random() * 9000)}`
      ] : undefined;
      
      // Generate tags (40% chance of having tags)
      const contactTags = TAGS.filter(() => Math.random() > 0.6).slice(0, 2);
      
      // Generate notes (50% chance of having notes)
      const contactNotes = Math.random() > 0.5 
        ? NOTES_TEMPLATES[Math.floor(Math.random() * NOTES_TEMPLATES.length)]
        : undefined;
      
      MOCK_CONTACTS.push({
        id: `p${cidx}_${lidx}_${i}`,
        name: `${firstName} ${lastName}`,
        initials: `${firstName[0]}${lastName[0]}`,
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${customer.name.toLowerCase().replace(/[^a-z]+/g, '')}.com`,
        phone: `(${200 + Math.floor(Math.random() * 800)}) ${200 + Math.floor(Math.random() * 800)}-${1000 + Math.floor(Math.random() * 9000)}`,
        mobile: `(${200 + Math.floor(Math.random() * 800)}) ${200 + Math.floor(Math.random() * 800)}-${1000 + Math.floor(Math.random() * 9000)}`,
        extension: String(100 + Math.floor(Math.random() * 9900)),
        title: TITLES[Math.floor(Math.random() * TITLES.length)],
        department: TITLES[Math.floor(Math.random() * TITLES.length)],
        customerId: customer.id,
        customerName: customer.name,
        customerLogo: customer.logo,
        locationId: location.id,
        locationName: location.name,
        locationCity: location.city,
        locationAddress: location.address,
        isPrimary: i === 0,
        // Add random additional information
        alternateEmails,
        alternatePhones,
        tags: contactTags.length > 0 ? contactTags : undefined,
        notes: contactNotes
      });
    }
  });
  
  customer.totalContacts = totalContactsForCustomer;
});

export function Step1CustomerSelection({ quoteDraft, onUpdate, onNext }: Step1CustomerSelectionProps) {
  const [isSearchOverlayOpen, setIsSearchOverlayOpen] = useState(false);
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
    
    // Convert contacts to recipients format
    const recipients = customerContacts.map(contact => ({
      id: contact.id,
      name: contact.name,
      email: contact.email,
      phone: contact.phone,
      mobile: contact.mobile,
      title: contact.title,
      department: contact.department,
      initials: contact.initials,
      isPrimary: contact.isPrimary
    }));
    
    onUpdate({
      customer: {
        id: customer.id,
        name: customer.name,
        location: `${defaultLocation.name} - ${defaultLocation.city}`,
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
        location: `${contact.locationName} - ${contact.locationCity}`,
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

  const handleClearSelection = () => {
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
        <Step2Configuration quoteDraft={quoteDraft} onUpdate={onUpdate} onClearAll={handleClearSelection} />
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
          <h2 className="text-[20px] text-[#1F2937] mb-1" style={{ fontWeight: 600 }}>
            Select Customer and Recipient
          </h2>
          <p className="text-[13px] text-[#6B7280]">
            Choose a contact or create a new one to create this quote.{' '}
            <a 
              href="#" 
              className="text-[#1B6EF3] hover:text-[#0D5ED7] transition-colors inline-flex items-center gap-1"
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

        {/* Search Bar - Click to open overlay */}
        <div ref={searchRef} className="relative mb-4">
          <button
            onClick={handleOpenSearchOverlay}
            className="w-full relative flex items-center border border-[#E5E7EB] rounded-lg hover:border-[#1B6EF3] focus:outline-none focus:border-[#1B6EF3] focus:ring-2 focus:ring-[#1B6EF3] focus:ring-opacity-20 transition-all text-left bg-white shadow-sm hover:shadow-md"
            style={{ height: '44px' }}
          >
            <Search className="absolute left-4 w-[18px] h-[18px] text-[#9CA3AF]" />
            <div className="w-full pl-12 pr-20 py-2.5 text-[14px] text-[#9CA3AF]">
              Search for the customer or contact to create a quote for...
            </div>
            <div className="absolute right-3 px-2.5 py-1 bg-[#F3F4F6] border border-[#E5E7EB] rounded text-[11px] text-[#6B7280]" style={{ fontWeight: 500 }}>
              ⌘K
            </div>
          </button>
        </div>

        {/* Empty State */}
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 mb-3 flex items-center justify-center">
            <Search className="w-12 h-12 text-[#D1D5DB]" strokeWidth={1.5} />
          </div>
          <h3 className="text-[14px] text-[#1F2937] mb-1" style={{ fontWeight: 500 }}>
            No Recipient Selected.
          </h3>
          <p className="text-[13px] text-[#9CA3AF] max-w-md">
            Select the contact you intend to create quote for
          </p>
        </div>
      </div>

      {/* Search Overlay */}
      <SearchOverlay
        isOpen={isSearchOverlayOpen}
        onClose={() => setIsSearchOverlayOpen(false)}
        onSelectCustomer={handleSelectCustomer}
        onSelectContact={handleSelectContact}
        initialSearchRect={searchRef.current?.getBoundingClientRect()}
        customers={MOCK_CUSTOMERS}
        contacts={MOCK_CONTACTS}
        hideLocationsTab
      />
    </div>
  );
}