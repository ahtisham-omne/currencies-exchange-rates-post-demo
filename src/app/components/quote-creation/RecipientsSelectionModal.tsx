import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Search, Building2, MapPin, User, Check, Star, Plus, Phone, Mail, ChevronRight, ChevronDown, UserPlus } from 'lucide-react';

interface PoC {
  id: string;
  name: string;
  email: string;
  phone: string;
  landline?: string;
  extension?: string;
  role: string;
  department: string;
  initials: string;
  avatarColor: string;
}

interface Location {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  isPrimary: boolean;
  pocs: PoC[];
}

interface Customer {
  id: string;
  name: string;
  type: string;
  locations: Location[];
}

interface RecipientsSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (recipients: PoC[], primaryPoCId: string, copyToCustomer?: boolean) => void;
  currentCustomerId: string;
  currentCustomerName: string;
  selectedRecipients?: PoC[];
  primaryPoCId?: string;
}

// Data generation helpers
const COMPANY_PREFIXES = ['Toyota', 'Honda', 'Ford', 'GM', 'Nissan', 'Tesla', 'BMW', 'Mercedes', 'Audi', 'Volkswagen', 'Mazda', 'Subaru', 'Hyundai', 'Kia', 'Volvo', 'Jaguar', 'Land Rover', 'Porsche', 'Ferrari', 'Lamborghini', 'Rivian', 'Lucid', 'Polestar', 'Genesis', 'Acura', 'Lexus', 'Infiniti', 'Cadillac', 'Lincoln', 'Buick', 'Chrysler', 'Dodge', 'Jeep', 'Ram', 'Chevrolet', 'GMC', 'Mitsubishi', 'Suzuki', 'Isuzu', 'Fiat', 'Alfa Romeo', 'Maserati', 'Bentley', 'Rolls-Royce', 'McLaren', 'Aston Martin', 'Lotus', 'Mini', 'Smart'];
const COMPANY_TYPES = ['Motor Manufacturing', 'Automotive', 'Industries', 'Corporation', 'International', 'Motors', 'Manufacturing', 'Group', 'Technologies', 'Systems', 'Solutions', 'Enterprises', 'Holdings', 'North America', 'USA', 'Components', 'Parts & Service', 'Assembly', 'Logistics', 'Distribution'];
const COMPANY_SUFFIXES = ['Inc.', 'LLC', 'Corp.', 'Ltd.', 'Co.', 'Group', 'Global', ''];

const LOCATION_TYPES = ['Headquarters', 'Distribution Center', 'Regional Office', 'Manufacturing Plant', 'Assembly Plant', 'Sales Office', 'Service Center', 'Warehouse', 'Logistics Hub', 'R&D Center', 'Tech Center', 'Training Facility'];
const LOCATION_DESCRIPTORS = ['Main', 'North', 'South', 'East', 'West', 'Central', 'Regional', 'Primary', 'Secondary'];

const CITIES = [
  { city: 'Charlotte', state: 'NC' }, { city: 'Rockford', state: 'IL' }, { city: 'Columbus', state: 'OH' },
  { city: 'Dearborn', state: 'MI' }, { city: 'Detroit', state: 'MI' }, { city: 'Smyrna', state: 'TN' },
  { city: 'Lafayette', state: 'IN' }, { city: 'San Antonio', state: 'TX' }, { city: 'Houston', state: 'TX' },
  { city: 'Dallas', state: 'TX' }, { city: 'Austin', state: 'TX' }, { city: 'Phoenix', state: 'AZ' },
  { city: 'Los Angeles', state: 'CA' }, { city: 'San Francisco', state: 'CA' }, { city: 'San Diego', state: 'CA' },
  { city: 'Seattle', state: 'WA' }, { city: 'Portland', state: 'OR' }, { city: 'Denver', state: 'CO' },
  { city: 'Atlanta', state: 'GA' }, { city: 'Miami', state: 'FL' }, { city: 'Orlando', state: 'FL' },
  { city: 'Boston', state: 'MA' }, { city: 'New York', state: 'NY' }, { city: 'Philadelphia', state: 'PA' },
  { city: 'Chicago', state: 'IL' }, { city: 'Milwaukee', state: 'WI' }, { city: 'Minneapolis', state: 'MN' },
  { city: 'Kansas City', state: 'MO' }, { city: 'St. Louis', state: 'MO' }, { city: 'Nashville', state: 'TN' },
  { city: 'Louisville', state: 'KY' }, { city: 'Indianapolis', state: 'IN' }, { city: 'Cincinnati', state: 'OH' },
  { city: 'Cleveland', state: 'OH' }, { city: 'Pittsburgh', state: 'PA' }, { city: 'Buffalo', state: 'NY' },
  { city: 'Salt Lake City', state: 'UT' }, { city: 'Las Vegas', state: 'NV' }, { city: 'Reno', state: 'NV' },
  { city: 'Albuquerque', state: 'NM' }, { city: 'Tucson', state: 'AZ' }, { city: 'Sacramento', state: 'CA' },
  { city: 'Fresno', state: 'CA' }, { city: 'Oakland', state: 'CA' }, { city: 'San Jose', state: 'CA' }
];

const FIRST_NAMES = ['James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda', 'William', 'Elizabeth', 'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica', 'Thomas', 'Sarah', 'Charles', 'Karen', 'Christopher', 'Nancy', 'Daniel', 'Lisa', 'Matthew', 'Betty', 'Anthony', 'Margaret', 'Donald', 'Sandra', 'Mark', 'Ashley', 'Paul', 'Kimberly', 'Steven', 'Emily', 'Andrew', 'Donna', 'Kenneth', 'Michelle', 'Joshua', 'Dorothy', 'Kevin', 'Carol', 'Brian', 'Amanda', 'George', 'Melissa', 'Edward', 'Deborah', 'Ronald', 'Stephanie', 'Timothy', 'Rebecca', 'Jason', 'Sharon', 'Jeffrey', 'Laura', 'Ryan', 'Cynthia', 'Jacob', 'Kathleen', 'Gary', 'Amy', 'Nicholas', 'Shirley', 'Eric', 'Angela', 'Jonathan', 'Helen', 'Stephen', 'Anna', 'Larry', 'Brenda', 'Justin', 'Pamela', 'Scott', 'Nicole', 'Brandon', 'Emma', 'Benjamin', 'Samantha', 'Samuel', 'Katherine', 'Frank', 'Christine', 'Gregory', 'Debra', 'Raymond', 'Rachel', 'Alexander', 'Catherine', 'Patrick', 'Carolyn', 'Jack', 'Janet', 'Dennis', 'Ruth', 'Jerry', 'Maria'];

const LAST_NAMES = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores', 'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell', 'Carter', 'Roberts', 'Gomez', 'Phillips', 'Evans', 'Turner', 'Diaz', 'Parker', 'Cruz', 'Edwards', 'Collins', 'Reyes', 'Stewart', 'Morris', 'Morales', 'Murphy', 'Cook', 'Rogers', 'Gutierrez', 'Ortiz', 'Morgan', 'Cooper', 'Peterson', 'Bailey', 'Reed', 'Kelly', 'Howard', 'Ramos', 'Kim', 'Cox', 'Ward', 'Richardson', 'Watson', 'Brooks', 'Chavez', 'Wood', 'James', 'Bennett', 'Gray', 'Mendoza', 'Ruiz', 'Hughes', 'Price', 'Alvarez', 'Castillo', 'Sanders', 'Patel', 'Myers', 'Long', 'Ross', 'Foster'];

const TITLES = [
  'Finance Manager', 'Procurement Director', 'Operations Manager', 'Supply Chain Coordinator',
  'Accounting Specialist', 'Logistics Supervisor', 'Senior Buyer', 'Financial Analyst',
  'Production Coordinator', 'Procurement Specialist', 'Controller', 'Operations Director',
  'Warehouse Manager', 'Distribution Supervisor', 'Inventory Manager', 'Shipping Coordinator',
  'Quality Control Lead', 'Logistics Analyst', 'Purchasing Manager', 'VP of Operations',
  'Plant Manager', 'Facilities Manager', 'Materials Manager', 'Vendor Manager',
  'Cost Analyst', 'Budget Analyst', 'Accounts Payable Manager', 'Accounts Receivable Manager',
  'Treasury Manager', 'Tax Manager', 'Audit Manager', 'Compliance Officer',
  'HR Manager', 'IT Manager', 'Sales Manager', 'Marketing Manager', 'Customer Service Manager'
];

const DEPARTMENTS = [
  'Finance', 'Procurement', 'Operations', 'Supply Chain', 'Accounting', 'Logistics',
  'Warehouse', 'Purchasing', 'Quality Control', 'Manufacturing', 'Production',
  'Distribution', 'Facilities', 'Materials', 'Treasury', 'Tax', 'Audit', 'Compliance',
  'HR', 'IT', 'Sales', 'Marketing', 'Customer Service'
];

const AVATAR_COLORS = [
  '#FDE68A', '#BFDBFE', '#D1FAE5', '#FED7AA', '#FCE7F3', '#E0E7FF', '#C7D2FE',
  '#BAE6FD', '#FEF3C7', '#BBF7D0', '#E9D5FF', '#A5F3FC', '#DBEAFE', '#FEE2E2',
  '#FECACA', '#FCA5A5', '#F9A8D4', '#F0ABFC', '#E9D5FF', '#DDD6FE', '#C4B5FD'
];

// Weighted random number generator (favors smaller numbers)
const weightedRandom = (min: number, max: number, weight: number = 2): number => {
  return Math.floor(min + Math.pow(Math.random(), weight) * (max - min + 1));
};

const randomItem = <T,>(array: T[]): T => array[Math.floor(Math.random() * array.length)];

const generatePhoneNumber = (): string => {
  const area = 200 + Math.floor(Math.random() * 800);
  const prefix = 200 + Math.floor(Math.random() * 800);
  const line = 1000 + Math.floor(Math.random() * 9000);
  return `(${area}) ${prefix}-${line}`;
};

const generatePoC = (customerId: string, locationId: string, index: number): PoC => {
  const firstName = randomItem(FIRST_NAMES);
  const lastName = randomItem(LAST_NAMES);
  const initials = `${firstName[0]}${lastName[0]}`;
  
  return {
    id: `poc_${customerId}_${locationId}_${index}`,
    name: `${firstName} ${lastName}`,
    email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@company${customerId}.com`,
    phone: generatePhoneNumber(),
    landline: Math.random() > 0.3 ? generatePhoneNumber() : undefined,
    extension: Math.random() > 0.3 ? String(100 + Math.floor(Math.random() * 9900)) : undefined,
    role: randomItem(TITLES),
    department: randomItem(DEPARTMENTS),
    initials,
    avatarColor: randomItem(AVATAR_COLORS),
  };
};

const generateLocation = (customerId: string, locationIndex: number, isPrimary: boolean): Location => {
  const cityData = randomItem(CITIES);
  const locationType = randomItem(LOCATION_TYPES);
  const descriptor = locationIndex === 0 ? 'Main' : randomItem(LOCATION_DESCRIPTORS);
  const locationId = `loc_${customerId}_${locationIndex}`;
  
  // Generate 5-200 PoCs per location, weighted toward fewer PoCs
  const pocCount = weightedRandom(5, 200, 3);
  const pocs: PoC[] = [];
  
  for (let i = 0; i < pocCount; i++) {
    pocs.push(generatePoC(customerId, locationId, i));
  }
  
  return {
    id: locationId,
    name: `${locationType} ${descriptor}`,
    address: `${1000 + locationIndex * 100} Business Park Dr`,
    city: cityData.city,
    state: cityData.state,
    isPrimary,
    pocs,
  };
};

const generateCustomer = (index: number): Customer => {
  const customerId = `cust${index + 1}`;
  const prefix = randomItem(COMPANY_PREFIXES);
  const type = randomItem(COMPANY_TYPES);
  const suffix = randomItem(COMPANY_SUFFIXES);
  const name = `${prefix} ${type}${suffix ? ' ' + suffix : ''}`;
  
  // Generate 1-100 locations, heavily weighted toward 1-5 locations
  const locationCount = weightedRandom(1, 100, 4);
  const locations: Location[] = [];
  
  for (let i = 0; i < locationCount; i++) {
    locations.push(generateLocation(customerId, i, i === 0));
  }
  
  return {
    id: customerId,
    name,
    type: 'Customer',
    locations,
  };
};

// Generate 200 customers
const MOCK_CUSTOMERS: Customer[] = Array.from({ length: 200 }, (_, i) => generateCustomer(i));

// Override first customer to be Toyota Motor Manufacturing with known data
MOCK_CUSTOMERS[0] = {
  id: 'cust1',
  name: 'Toyota Motor Manufacturing',
  type: 'Customer',
  locations: [
    {
      id: 'loc1',
      name: 'Illinois Headquarters',
      address: '6145 Logistics Center Blvd.',
      city: 'Rockford',
      state: 'IL',
      isPrimary: true,
      pocs: [
        {
          id: 'poc1',
          name: 'Sherry Brown',
          email: 'sherry.brown@toyota.com',
          phone: '(390) 412-9011',
          landline: '(815) 961-4200',
          extension: '2045',
          role: 'Finance Manager',
          department: 'Finance',
          initials: 'SB',
          avatarColor: '#FDE68A',
        },
        {
          id: 'poc2',
          name: 'Michael Chen',
          email: 'michael.chen@toyota.com',
          phone: '(390) 412-9012',
          landline: '(815) 961-4200',
          extension: '2156',
          role: 'Procurement Director',
          department: 'Procurement',
          initials: 'MC',
          avatarColor: '#BFDBFE',
        },
        {
          id: 'poc3',
          name: 'Sarah Williams',
          email: 'sarah.w@toyota.com',
          phone: '(390) 412-9013',
          landline: '(815) 961-4200',
          extension: '2089',
          role: 'Operations Manager',
          department: 'Operations',
          initials: 'SW',
          avatarColor: '#D1FAE5',
        },
      ],
    },
    {
      id: 'loc2',
      name: 'Distribution Center',
      address: '2890 Industrial Pkwy',
      city: 'Springfield',
      state: 'IL',
      isPrimary: false,
      pocs: [
        {
          id: 'poc4',
          name: 'James Rodriguez',
          email: 'james.r@toyota.com',
          phone: '(390) 555-0101',
          landline: '(815) 961-4200',
          extension: '3012',
          role: 'Warehouse Manager',
          department: 'Warehouse',
          initials: 'JR',
          avatarColor: '#FED7AA',
        },
      ],
    },
  ],
};

export function RecipientsSelectionModal({
  isOpen,
  onClose,
  onSelect,
  currentCustomerId,
  currentCustomerName,
  selectedRecipients = [],
  primaryPoCId,
}: RecipientsSelectionModalProps) {
  // Find customer by ID first, then by name as fallback, then use first customer
  const currentCustomer = MOCK_CUSTOMERS.find((c) => c.id === currentCustomerId) 
    || MOCK_CUSTOMERS.find((c) => c.name === currentCustomerName) 
    || MOCK_CUSTOMERS[0];
  const defaultLocation = currentCustomer.locations.find(l => l.isPrimary) || currentCustomer.locations[0];
  
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(currentCustomer);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(defaultLocation);
  const [tempSelectedPocs, setTempSelectedPocs] = useState<PoC[]>(selectedRecipients);
  const [tempPrimaryId, setTempPrimaryId] = useState<string>(primaryPoCId || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [pocSearchQuery, setPocSearchQuery] = useState('');
  const [searchScope, setSearchScope] = useState<'location' | 'customer' | 'system'>('location');
  const [showScopeDropdown, setShowScopeDropdown] = useState(false);
  const [showCopyConfirmation, setShowCopyConfirmation] = useState(false);
  const [pocToCopy, setPocToCopy] = useState<PoC | null>(null);
  
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowScopeDropdown(false);
      }
    };

    if (showScopeDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showScopeDropdown]);

  // ESC key handler
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleEsc);
    }
    return () => {
      window.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCustomerSelect = (customer: Customer) => {
    setSelectedCustomer(customer);
    setSelectedLocation(null);
  };

  const handleLocationSelect = (location: Location) => {
    setSelectedLocation(location);
  };

  const handlePocToggle = (poc: PoC) => {
    // Check if selecting from different customer
    if (selectedCustomer?.id !== currentCustomerId) {
      setPocToCopy(poc);
      setShowCopyConfirmation(true);
      return;
    }

    const isSelected = tempSelectedPocs.some((p) => p.id === poc.id);
    if (isSelected) {
      const newSelected = tempSelectedPocs.filter((p) => p.id !== poc.id);
      setTempSelectedPocs(newSelected);
      // If we're removing the primary, reset it
      if (tempPrimaryId === poc.id && newSelected.length > 0) {
        setTempPrimaryId(newSelected[0].id);
      } else if (newSelected.length === 0) {
        setTempPrimaryId('');
      }
    } else {
      const newSelected = [...tempSelectedPocs, poc];
      setTempSelectedPocs(newSelected);
      // If this is the first one, make it primary
      if (tempSelectedPocs.length === 0) {
        setTempPrimaryId(poc.id);
      }
    }
  };

  const handleCopyConfirmation = (shouldCopy: boolean) => {
    if (pocToCopy) {
      const isSelected = tempSelectedPocs.some((p) => p.id === pocToCopy.id);
      if (isSelected) {
        const newSelected = tempSelectedPocs.filter((p) => p.id !== pocToCopy.id);
        setTempSelectedPocs(newSelected);
        if (tempPrimaryId === pocToCopy.id && newSelected.length > 0) {
          setTempPrimaryId(newSelected[0].id);
        } else if (newSelected.length === 0) {
          setTempPrimaryId('');
        }
      } else {
        const newSelected = [...tempSelectedPocs, pocToCopy];
        setTempSelectedPocs(newSelected);
        if (tempSelectedPocs.length === 0) {
          setTempPrimaryId(pocToCopy.id);
        }
      }
    }
    setShowCopyConfirmation(false);
    setPocToCopy(null);
  };

  const handleSetPrimary = (pocId: string) => {
    setTempPrimaryId(pocId);
  };

  const handleConfirm = () => {
    if (tempSelectedPocs.length > 0) {
      const copyToCustomer = selectedCustomer?.id !== currentCustomerId;
      onSelect(tempSelectedPocs, tempPrimaryId, copyToCustomer);
      onClose();
    }
  };

  const filteredCustomers = MOCK_CUSTOMERS.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getScopeLabel = () => {
    switch (searchScope) {
      case 'location':
        return selectedLocation ? selectedLocation.name : 'This location';
      case 'customer':
        return selectedCustomer ? `All ${selectedCustomer.name} locations` : 'This customer';
      case 'system':
        return 'All customers';
      default:
        return 'This location';
    }
  };

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0"
        style={{ zIndex: 10001, backgroundColor: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(1px)' }}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden"
        style={{ zIndex: 10001, width: '920px', height: '680px' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB]">
          <div>
            <h2 className="text-[18px] text-[#1F2937]" style={{ fontWeight: 600 }}>
              Select Point of Contacts
            </h2>
            <p className="text-[13px] text-[#9CA3AF] mt-1">
              Choose one or more points of contact to receive this quote
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-[#F3F4F6] transition-colors"
          >
            <X className="w-5 h-5 text-[#6B7280]" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Left Panel - Customer & Location Selection */}
          <div className="w-[320px] border-r border-[#E5E7EB] flex flex-col">
            {/* Search */}
            <div className="px-4 py-3 border-b border-[#E5E7EB]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
                <input
                  type="text"
                  placeholder="Search customers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 text-[13px] border border-[#E5E7EB] rounded-md focus:outline-none focus:border-[#93C5FD]"
                  style={{ height: '32px' }}
                />
              </div>
            </div>

            {/* Customer List */}
            <div className="flex-1 overflow-y-auto">
              {filteredCustomers.map((customer, index) => {
                const totalPocs = customer.locations.reduce((sum, loc) => sum + loc.pocs.length, 0);
                const isExpanded = selectedCustomer?.id === customer.id;
                
                return (
                  <div key={customer.id} className={index < filteredCustomers.length - 1 ? 'border-b border-[#E5E7EB]' : ''}>
                    {/* Customer Header */}
                    <div
                      className={`flex items-center gap-2 px-4 py-3 cursor-pointer transition-colors ${
                        customer.id === currentCustomerId
                          ? 'bg-[#F0F7FF]'
                          : 'hover:bg-[#F9FAFB]'
                      }`}
                      onClick={() => handleCustomerSelect(customer)}
                    >
                      {/* Chevron Icon */}
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-[#6B7280] flex-shrink-0" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-[#6B7280] flex-shrink-0" />
                      )}
                      
                      <Building2 className="w-4 h-4 text-[#6B7280] flex-shrink-0" />
                      
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] text-[#1F2937]" style={{ fontWeight: 500 }}>
                          {customer.name}
                        </div>
                        <div className="text-[11px] text-[#9CA3AF]">
                          {customer.locations.length} location{customer.locations.length > 1 ? 's' : ''} · {totalPocs} contact{totalPocs > 1 ? 's' : ''}
                        </div>
                      </div>
                      
                      {/* Selected Customer Badge */}
                      {customer.id === currentCustomer.id && (
                        <span className="inline-flex items-center h-5 px-2 text-[10px] bg-[#D1FAE5] border border-[#A7F3D0] text-[#065F46] rounded flex-shrink-0" style={{ fontWeight: 500 }}>
                          Selected Customer
                        </span>
                      )}
                    </div>

                    {/* Location List (if customer is selected) */}
                    {isExpanded && (
                      <div className="bg-[#FAFBFC] border-t border-[#E5E7EB]">
                        {customer.locations.map((location, locIndex) => (
                          <div
                            key={location.id}
                            className={`flex items-start gap-3 px-4 py-2.5 ml-6 cursor-pointer transition-colors ${
                              selectedLocation?.id === location.id
                                ? 'bg-[#E7F3FF]'
                                : 'hover:bg-[#F3F4F6]'
                            } ${locIndex < customer.locations.length - 1 ? 'border-b border-[#E5E7EB]' : ''}`}
                            onClick={() => handleLocationSelect(location)}
                          >
                            <MapPin className="w-3.5 h-3.5 text-[#9CA3AF] mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="text-[13px] text-[#1F2937]" style={{ fontWeight: 500 }}>
                                {location.name}
                              </div>
                              <div className="text-[11px] text-[#9CA3AF]">
                                {location.city}, {location.state}
                              </div>
                            </div>
                            {location.isPrimary && (
                              <span className="text-[11px] text-[#3B82F6] bg-[#DBEAFE] px-2 py-0.5 rounded flex-shrink-0" style={{ fontWeight: 500 }}>
                                Primary
                              </span>
                            )}
                          </div>
                        ))}
                        {/* Add New Location */}
                        <div
                          className="flex items-center gap-2.5 px-4 py-2.5 ml-6 cursor-pointer transition-colors hover:bg-[#F0F7FF] border-t border-[#E5E7EB]"
                          onClick={(e) => { e.stopPropagation(); alert('Add New Location modal — coming soon'); }}
                        >
                          <div className="w-3.5 h-3.5 rounded-full bg-[#F0F7FF] flex items-center justify-center flex-shrink-0">
                            <Plus className="w-2.5 h-2.5 text-[#1B6EF3]" />
                          </div>
                          <span className="text-[12px] text-[#1B6EF3]" style={{ fontWeight: 500 }}>
                            Add New Location
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Add New Customer — always at bottom, smart suggestion when searching */}
              <div
                className="flex items-center gap-2.5 px-4 py-3 cursor-pointer transition-colors hover:bg-[#F0F7FF] border-t border-[#E5E7EB]"
                onClick={() => alert('Add New Customer form — coming soon')}
              >
                <div className="w-5 h-5 rounded bg-[#F0F7FF] flex items-center justify-center flex-shrink-0">
                  <Plus className="w-3 h-3 text-[#1B6EF3]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] text-[#1B6EF3]" style={{ fontWeight: 500 }}>
                    {searchQuery.trim()
                      ? <>Add &ldquo;{searchQuery.trim()}&rdquo; as New Customer</>
                      : 'Add New Customer'
                    }
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel - PoC Selection */}
          <div className="flex-1 flex flex-col">
            {selectedLocation ? (
              <>
                {/* Search with Scope Dropdown - Rectangle Design */}
                <div className="px-4 py-3 border-b border-[#E5E7EB]">
                  <div className="relative" ref={dropdownRef}>
                    {/* Combined Container */}
                    <div className="flex items-center border border-[#E5E7EB] rounded-md overflow-hidden focus-within:border-[#93C5FD] transition-colors bg-white">
                      {/* Search Input */}
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
                        <input
                          type="text"
                          placeholder="Search point of contacts..."
                          value={pocSearchQuery}
                          onChange={(e) => setPocSearchQuery(e.target.value)}
                          className="w-full pl-9 pr-3 text-[13px] border-0 focus:outline-none bg-transparent"
                          style={{ height: '32px' }}
                        />
                      </div>
                      
                      {/* Scope Dropdown Trigger */}
                      <button
                        onClick={() => setShowScopeDropdown(!showScopeDropdown)}
                        className="flex items-center gap-1.5 px-3 text-[12px] text-[#6B7280] hover:bg-[#F9FAFB] transition-colors border-l border-[#E5E7EB] flex-shrink-0"
                        style={{ fontWeight: 500, height: '32px' }}
                      >
                        <span className="truncate max-w-[140px]">{getScopeLabel()}</span>
                        <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" />
                      </button>
                    </div>

                    {/* Dropdown Menu - Aligned Right */}
                    {showScopeDropdown && (
                      <div className="absolute top-full right-0 mt-1 bg-white border border-[#E5E7EB] rounded-lg shadow-lg z-10 overflow-hidden" style={{ minWidth: '320px' }}>
                        <button
                          onClick={() => {
                            setSearchScope('location');
                            setShowScopeDropdown(false);
                          }}
                          className={`w-full px-3 py-2 text-left text-[13px] transition-colors flex items-center justify-between ${
                            searchScope === 'location'
                              ? 'bg-[#F0F7FF] text-[#1B6EF3]'
                              : 'text-[#1F2937] hover:bg-[#F9FAFB]'
                          }`}
                          style={{ fontWeight: searchScope === 'location' ? 500 : 400 }}
                        >
                          <div>
                            <div>{selectedLocation.name}</div>
                            <div className="text-[11px] text-[#9CA3AF] mt-0.5">Search in this location only</div>
                          </div>
                          {searchScope === 'location' && <Check className="w-4 h-4 flex-shrink-0" />}
                        </button>
                        <button
                          onClick={() => {
                            setSearchScope('customer');
                            setShowScopeDropdown(false);
                          }}
                          className={`w-full px-3 py-2.5 text-left text-[13px] transition-colors flex items-center justify-between border-t border-[#E5E7EB] ${
                            searchScope === 'customer'
                              ? 'bg-[#F0F7FF] text-[#1B6EF3]'
                              : 'text-[#1F2937] hover:bg-[#F9FAFB]'
                          }`}
                          style={{ fontWeight: searchScope === 'customer' ? 500 : 400 }}
                        >
                          <div>
                            <div>All {selectedCustomer?.name} locations</div>
                            <div className="text-[11px] text-[#9CA3AF] mt-0.5">Search across all locations of this customer</div>
                          </div>
                          {searchScope === 'customer' && <Check className="w-4 h-4 flex-shrink-0" />}
                        </button>
                        <button
                          onClick={() => {
                            setSearchScope('system');
                            setShowScopeDropdown(false);
                          }}
                          className={`w-full px-3 py-2.5 text-left text-[13px] transition-colors flex items-center justify-between border-t border-[#E5E7EB] ${
                            searchScope === 'system'
                              ? 'bg-[#F0F7FF] text-[#1B6EF3]'
                              : 'text-[#1F2937] hover:bg-[#F9FAFB]'
                          }`}
                          style={{ fontWeight: searchScope === 'system' ? 500 : 400 }}
                        >
                          <div>
                            <div>All customers</div>
                            <div className="text-[11px] text-[#9CA3AF] mt-0.5">Search across entire system</div>
                          </div>
                          {searchScope === 'system' && <Check className="w-4 h-4 flex-shrink-0" />}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* PoC Grid */}
                <div className="flex-1 overflow-y-auto p-4">
                  <div className="grid grid-cols-2 gap-3">
                    {(() => {
                      // Filter PoCs based on search scope and query
                      let pocsToDisplay: PoC[] = [];
                      
                      if (searchScope === 'system') {
                        // Search across all customers
                        if (pocSearchQuery.trim()) {
                          MOCK_CUSTOMERS.forEach(customer => {
                            customer.locations.forEach(location => {
                              location.pocs.forEach(poc => {
                                const query = pocSearchQuery.toLowerCase();
                                if (
                                  poc.name.toLowerCase().includes(query) ||
                                  poc.email.toLowerCase().includes(query) ||
                                  poc.role.toLowerCase().includes(query) ||
                                  poc.department.toLowerCase().includes(query)
                                ) {
                                  pocsToDisplay.push(poc);
                                }
                              });
                            });
                          });
                        } else {
                          // Show selected location's PoCs when no search query
                          pocsToDisplay = selectedLocation.pocs;
                        }
                      } else if (searchScope === 'customer' && selectedCustomer) {
                        // Search within all locations of selected customer
                        selectedCustomer.locations.forEach(location => {
                          location.pocs.forEach(poc => {
                            if (pocSearchQuery.trim()) {
                              const query = pocSearchQuery.toLowerCase();
                              if (
                                poc.name.toLowerCase().includes(query) ||
                                poc.email.toLowerCase().includes(query) ||
                                poc.role.toLowerCase().includes(query) ||
                                poc.department.toLowerCase().includes(query)
                              ) {
                                pocsToDisplay.push(poc);
                              }
                            } else {
                              // Show all PoCs from all customer locations when no search
                              pocsToDisplay.push(poc);
                            }
                          });
                        });
                      } else {
                        // Search within selected location only
                        if (pocSearchQuery.trim()) {
                          pocsToDisplay = selectedLocation.pocs.filter(poc => {
                            const query = pocSearchQuery.toLowerCase();
                            return (
                              poc.name.toLowerCase().includes(query) ||
                              poc.email.toLowerCase().includes(query) ||
                              poc.role.toLowerCase().includes(query) ||
                              poc.department.toLowerCase().includes(query)
                            );
                          });
                        } else {
                          pocsToDisplay = selectedLocation.pocs;
                        }
                      }

                      return pocsToDisplay.map((poc) => {
                        const isSelected = tempSelectedPocs.some((p) => p.id === poc.id);
                        const isPrimary = tempPrimaryId === poc.id;

                        return (
                          <div
                            key={poc.id}
                            className={`relative p-3 rounded-lg border transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-[#F0F7FF] border-[#93C5FD]'
                                : 'bg-white border-[#E5E7EB] hover:border-[#93C5FD]'
                            }`}
                            onClick={() => handlePocToggle(poc)}
                          >
                            <div className="flex items-start gap-2.5">
                              {/* Avatar */}
                              <div
                                className="w-9 h-9 rounded-full flex items-center justify-center text-[12px] flex-shrink-0"
                                style={{
                                  backgroundColor: poc.avatarColor,
                                  fontWeight: 600,
                                  color: '#000',
                                }}
                              >
                                {poc.initials}
                              </div>

                              {/* Info */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 mb-0.5">
                                  <span className="text-[13px] text-[#1F2937]" style={{ fontWeight: 600 }}>
                                    {poc.name}
                                  </span>
                                  {isPrimary && (
                                    <span className="inline-flex items-center h-4 px-1.5 text-[10px] bg-[#DBEAFE] text-[#1E40AF] rounded" style={{ fontWeight: 500 }}>
                                      Primary
                                    </span>
                                  )}
                                </div>
                                <div className="text-[12px] text-[#6B7280]">{poc.role}</div>
                                <div className="text-[11px] text-[#9CA3AF] mb-2">{poc.department}</div>

                                {/* Contact Details */}
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1.5 text-[11px] text-[#6B7280]">
                                    <Phone className="w-3 h-3 text-[#9CA3AF]" />
                                    <span>{poc.phone}</span>
                                  </div>
                                  {poc.landline && (
                                    <div className="flex items-center gap-1.5 text-[11px] text-[#6B7280]">
                                      <Phone className="w-3 h-3 text-[#9CA3AF]" />
                                      <span>
                                        {poc.landline}
                                        {poc.extension && (
                                          <span className="text-[#9CA3AF]"> ext. {poc.extension}</span>
                                        )}
                                      </span>
                                    </div>
                                  )}
                                  <div className="flex items-center gap-1.5 text-[11px] text-[#6B7280]">
                                    <Mail className="w-3 h-3 text-[#9CA3AF]" />
                                    <span className="truncate">{poc.email}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Checkbox */}
                              <div
                                className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                                  isSelected
                                    ? 'bg-[#1B6EF3] border-[#1B6EF3]'
                                    : 'border-[#D1D5DB] bg-white'
                                }`}
                              >
                                {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                              </div>
                            </div>

                            {/* Set as Primary Button - Appears for selected non-primary */}
                            {isSelected && !isPrimary && (
                              <button
                                className="absolute bottom-2 right-2 flex items-center gap-1 px-2 py-0.5 text-[10px] text-[#1B6EF3] bg-white hover:bg-[#E7F3FF] border border-[#93C5FD] rounded transition-colors"
                                style={{ fontWeight: 500 }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSetPrimary(poc.id);
                                }}
                              >
                                <Star className="w-2.5 h-2.5" />
                                Set as Primary
                              </button>
                            )}
                          </div>
                        );
                      });
                    })()}

                    {/* Create New PoC Card — always visible */}
                    <div
                      className="p-3 rounded-lg border-2 border-dashed border-[#E5E7EB] hover:border-[#93C5FD] hover:bg-[#FAFCFF] transition-colors cursor-pointer bg-white flex flex-col items-center justify-center text-center"
                      style={{ minHeight: '140px' }}
                      onClick={() => alert('Create New PoC form — coming soon')}
                    >
                      <div className="w-9 h-9 rounded-full bg-[#F0F7FF] flex items-center justify-center mb-2">
                        <Plus className="w-4 h-4 text-[#1B6EF3]" />
                      </div>
                      <div className="text-[13px] text-[#1F2937] mb-0.5" style={{ fontWeight: 600 }}>
                        {pocSearchQuery.trim()
                          ? <>Add &ldquo;{pocSearchQuery.trim()}&rdquo; as New Contact</>
                          : 'Create New Point of Contact'
                        }
                      </div>
                      <div className="text-[11px] text-[#9CA3AF]">
                        for {selectedLocation.name}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-[#9CA3AF]">
                <div className="text-center">
                  <User className="w-12 h-12 mx-auto mb-3 text-[#D1D5DB]" />
                  <p className="text-[14px]">Select a location to view contacts</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#E5E7EB]">
          <div className="text-[13px] text-[#6B7280]">
            {tempSelectedPocs.length > 0 ? (
              <span>
                {tempSelectedPocs.length} point of contact{tempSelectedPocs.length > 1 ? 's' : ''} selected
              </span>
            ) : (
              <span>No point of contacts selected</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 h-8 border border-[#E5E7EB] text-[13px] text-[#6B7280] hover:bg-[#F9FAFB] hover:border-[#D1D5DB] transition-colors flex items-center gap-2"
              style={{ borderRadius: '6px', fontWeight: 500 }}
            >
              Cancel
              <div className="px-1.5 py-0.5 bg-[#F3F4F6] text-[#9CA3AF] text-[10px] rounded" style={{ fontWeight: 500 }}>
                ESC
              </div>
            </button>
            <button
              onClick={handleConfirm}
              disabled={tempSelectedPocs.length === 0}
              className={`px-4 h-8 text-[13px] transition-colors flex items-center gap-2 ${
                tempSelectedPocs.length > 0
                  ? 'bg-[#1B6EF3] text-white hover:bg-[#0D5ED7]'
                  : 'bg-[#E5E7EB] text-[#9CA3AF] cursor-not-allowed'
              }`}
              style={{ borderRadius: '6px', fontWeight: 500 }}
            >
              Confirm Selection
              <div className={`px-1.5 py-0.5 text-[10px] rounded ${
                tempSelectedPocs.length > 0
                  ? 'bg-white/20 text-white'
                  : 'bg-[#D1D5DB] text-[#9CA3AF]'
              }`} style={{ fontWeight: 500 }}>
                ⌘↵
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Copy Confirmation Dialog */}
      {showCopyConfirmation && pocToCopy && (
        <>
          <div
            className="fixed inset-0"
            style={{ zIndex: 10002, backgroundColor: 'rgba(0, 0, 0, 0.4)' }}
            onClick={() => handleCopyConfirmation(false)}
          />
          <div
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-2xl p-6"
            style={{ zIndex: 10002, width: '480px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-[16px] text-[#1F2937] mb-2" style={{ fontWeight: 600 }}>
              Copy Contact to {currentCustomerName}?
            </h3>
            <p className="text-[13px] text-[#6B7280] mb-4">
              {pocToCopy.name} is from {selectedCustomer?.name}. Would you like to copy this contact to{' '}
              {currentCustomerName}'s contact list?
            </p>
            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => handleCopyConfirmation(false)}
                className="px-4 py-2 text-[13px] text-[#6B7280] hover:text-[#1F2937] transition-colors"
                style={{ fontWeight: 500 }}
              >
                Use Without Copying
              </button>
              <button
                onClick={() => handleCopyConfirmation(true)}
                className="px-4 py-2 text-[13px] text-white bg-[#1B6EF3] hover:bg-[#0D5ED7] rounded transition-colors"
                style={{ fontWeight: 500 }}
              >
                Copy to {currentCustomerName}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  , document.body);
}