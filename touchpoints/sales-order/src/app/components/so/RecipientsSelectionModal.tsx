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

export interface RecipientsSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (recipients: PoC[], primaryPoCId: string) => void;
  currentCustomerId: string;
  currentCustomerName: string;
  selectedRecipients?: PoC[];
  primaryPoCId?: string;
}

// Simplified mock data — enough for demo
const AVATAR_COLORS = ['#FDE68A', '#BFDBFE', '#D1FAE5', '#FED7AA', '#FCE7F3', '#E0E7FF', '#C7D2FE'];

const MOCK_CUSTOMERS: Customer[] = [
  {
    id: 'C-001', name: 'Metro City Fire & Rescue', type: 'Customer',
    locations: [
      {
        id: 'loc1', name: 'Illinois Headquarters', address: '6145 Logistics Center Blvd.', city: 'Rockford', state: 'IL', isPrimary: true,
        pocs: [
          { id: 'P-001', name: 'Jane Ellison', email: 'jane.ellison@metrocityfire.gov', phone: '(718) 264-8918', landline: '(815) 961-4200', extension: '2045', role: 'Finance Director', department: 'Finance', initials: 'JE', avatarColor: '#FDE68A' },
          { id: 'P-002', name: 'Michael Chen', email: 'michael.chen@metrocityfire.gov', phone: '(390) 412-9012', landline: '(815) 961-4200', extension: '2156', role: 'Procurement Director', department: 'Procurement', initials: 'MC', avatarColor: '#BFDBFE' },
          { id: 'P-003', name: 'Sarah Williams', email: 'sarah.w@metrocityfire.gov', phone: '(390) 412-9013', role: 'Operations Manager', department: 'Operations', initials: 'SW', avatarColor: '#D1FAE5' },
        ],
      },
      {
        id: 'loc2', name: 'Distribution Center', address: '2890 Industrial Pkwy', city: 'Springfield', state: 'IL', isPrimary: false,
        pocs: [
          { id: 'P-004', name: 'James Rodriguez', email: 'james.r@metrocityfire.gov', phone: '(390) 555-0101', role: 'Warehouse Manager', department: 'Warehouse', initials: 'JR', avatarColor: '#FED7AA' },
        ],
      },
    ],
  },
  {
    id: 'C-002', name: 'Tri-County EMS Authority', type: 'Customer',
    locations: [{
      id: 'loc3', name: 'Main Office', address: '1000 Business Park Dr', city: 'Daxton', state: 'GA', isPrimary: true,
      pocs: [
        { id: 'P-005', name: 'Braelyn Miller', email: 'braelyn.miller@tricountyems.org', phone: '(568) 530-1789', role: 'EMS Director', department: 'Operations', initials: 'BM', avatarColor: '#FCE7F3' },
        { id: 'P-006', name: 'Janna Rodriguez', email: 'janna.rodriguez@tricountyems.org', phone: '(270) 393-8736', role: 'Captain', department: 'Operations', initials: 'JR', avatarColor: '#E0E7FF' },
      ],
    }],
  },
];

export type { PoC };

export function RecipientsSelectionModal({
  isOpen, onClose, onSelect, currentCustomerId, currentCustomerName, selectedRecipients = [], primaryPoCId,
}: RecipientsSelectionModalProps) {
  const currentCustomer = MOCK_CUSTOMERS.find((c) => c.id === currentCustomerId) || MOCK_CUSTOMERS.find((c) => c.name === currentCustomerName) || MOCK_CUSTOMERS[0];
  const defaultLocation = currentCustomer.locations.find(l => l.isPrimary) || currentCustomer.locations[0];

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(currentCustomer);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(defaultLocation);
  const [tempSelectedPocs, setTempSelectedPocs] = useState<PoC[]>(selectedRecipients);
  const [tempPrimaryId, setTempPrimaryId] = useState<string>(primaryPoCId || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [pocSearchQuery, setPocSearchQuery] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCustomerSelect = (customer: Customer) => { setSelectedCustomer(customer); setSelectedLocation(null); };
  const handleLocationSelect = (location: Location) => { setSelectedLocation(location); };

  const handlePocToggle = (poc: PoC) => {
    const isSelected = tempSelectedPocs.some((p) => p.id === poc.id);
    if (isSelected) {
      const newSelected = tempSelectedPocs.filter((p) => p.id !== poc.id);
      setTempSelectedPocs(newSelected);
      if (tempPrimaryId === poc.id && newSelected.length > 0) setTempPrimaryId(newSelected[0].id);
      else if (newSelected.length === 0) setTempPrimaryId('');
    } else {
      const newSelected = [...tempSelectedPocs, poc];
      setTempSelectedPocs(newSelected);
      if (tempSelectedPocs.length === 0) setTempPrimaryId(poc.id);
    }
  };

  const handleConfirm = () => {
    if (tempSelectedPocs.length > 0) { onSelect(tempSelectedPocs, tempPrimaryId); onClose(); }
  };

  const filteredCustomers = MOCK_CUSTOMERS.filter((c) => c.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const getDisplayPocs = (): PoC[] => {
    if (!selectedLocation) return [];
    if (pocSearchQuery.trim()) {
      const q = pocSearchQuery.toLowerCase();
      return selectedLocation.pocs.filter(poc => poc.name.toLowerCase().includes(q) || poc.email.toLowerCase().includes(q) || poc.role.toLowerCase().includes(q));
    }
    return selectedLocation.pocs;
  };

  return createPortal(
    <>
      <div className="fixed inset-0" style={{ zIndex: 10001, backgroundColor: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(1px)' }} onClick={onClose} />
      <div
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-xl shadow-2xl flex flex-col overflow-hidden"
        style={{ zIndex: 10001, width: 920, height: 680, background: 'var(--card)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--foreground)' }}>Select Point of Contacts</h2>
            <p style={{ fontSize: 13, color: 'var(--muted-foreground)', marginTop: 4 }}>Choose one or more points of contact for this sales order</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded hover:bg-secondary transition-colors">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex">
          {/* Left Panel - Customer & Location */}
          <div className="flex flex-col" style={{ width: 320, borderRight: '1px solid var(--border)' }}>
            <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input type="text" placeholder="Search customers..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 text-[13px] rounded-md h-8 focus:outline-none focus:border-primary/50"
                  style={{ border: '1px solid var(--border)', color: 'var(--foreground)', background: 'var(--card)' }}
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {filteredCustomers.map((customer, index) => {
                const totalPocs = customer.locations.reduce((sum, loc) => sum + loc.pocs.length, 0);
                const isExpanded = selectedCustomer?.id === customer.id;
                return (
                  <div key={customer.id} className={index < filteredCustomers.length - 1 ? 'border-b border-border' : ''}>
                    <div
                      className={`flex items-center gap-2 px-4 py-3 cursor-pointer transition-colors ${customer.id === currentCustomerId ? 'bg-primary/5' : 'hover:bg-secondary'}`}
                      onClick={() => handleCustomerSelect(customer)}
                    >
                      {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                      <Building2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>{customer.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{customer.locations.length} location{customer.locations.length > 1 ? 's' : ''} · {totalPocs} contacts</div>
                      </div>
                      {customer.id === currentCustomerId && (
                        <span className="inline-flex items-center h-5 px-2 text-[10px] bg-accent/10 text-accent rounded flex-shrink-0" style={{ fontWeight: 500 }}>Selected</span>
                      )}
                    </div>
                    {isExpanded && (
                      <div className="bg-secondary/50" style={{ borderTop: '1px solid var(--border)' }}>
                        {customer.locations.map((location, locIndex) => (
                          <div
                            key={location.id}
                            className={`flex items-start gap-3 px-4 py-2.5 ml-6 cursor-pointer transition-colors ${selectedLocation?.id === location.id ? 'bg-primary/10' : 'hover:bg-secondary'} ${locIndex < customer.locations.length - 1 ? 'border-b border-border' : ''}`}
                            onClick={() => handleLocationSelect(location)}
                          >
                            <MapPin className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>{location.name}</div>
                              <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{location.city}, {location.state}</div>
                            </div>
                            {location.isPrimary && <span className="text-[11px] text-primary bg-primary/10 px-2 py-0.5 rounded flex-shrink-0" style={{ fontWeight: 500 }}>Primary</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Panel - PoC Selection */}
          <div className="flex-1 flex flex-col">
            {selectedLocation ? (
              <>
                <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input type="text" placeholder="Search point of contacts..." value={pocSearchQuery} onChange={(e) => setPocSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 text-[13px] rounded-md h-8 focus:outline-none focus:border-primary/50"
                      style={{ border: '1px solid var(--border)', color: 'var(--foreground)', background: 'var(--card)' }}
                    />
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                  <div className="grid grid-cols-2 gap-3">
                    {getDisplayPocs().map((poc) => {
                      const isSelected = tempSelectedPocs.some((p) => p.id === poc.id);
                      const isPrimary = tempPrimaryId === poc.id;
                      return (
                        <div
                          key={poc.id}
                          className={`relative p-3 rounded-lg border transition-all cursor-pointer ${isSelected ? 'bg-primary/5 border-primary/30' : 'bg-card border-border hover:border-primary/30'}`}
                          onClick={() => handlePocToggle(poc)}
                        >
                          <div className="flex items-start gap-2.5">
                            <div className="w-9 h-9 rounded-full flex items-center justify-center text-[12px] flex-shrink-0" style={{ backgroundColor: poc.avatarColor, fontWeight: 600, color: '#000' }}>{poc.initials}</div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>{poc.name}</span>
                                {isPrimary && <span className="inline-flex items-center h-4 px-1.5 text-[10px] bg-primary/10 text-primary rounded" style={{ fontWeight: 500 }}>Primary</span>}
                              </div>
                              <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{poc.role}</div>
                              <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 8 }}>{poc.department}</div>
                              <div className="space-y-1">
                                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><Phone className="w-3 h-3" /><span>{poc.phone}</span></div>
                                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><Mail className="w-3 h-3" /><span className="truncate">{poc.email}</span></div>
                              </div>
                            </div>
                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${isSelected ? 'bg-primary border-primary' : 'border-border bg-card'}`}>
                              {isSelected && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                            </div>
                          </div>
                          {isSelected && !isPrimary && (
                            <button
                              className="absolute bottom-2 right-2 flex items-center gap-1 px-2 py-0.5 text-[10px] text-primary bg-card hover:bg-primary/10 border border-primary/30 rounded transition-colors"
                              style={{ fontWeight: 500 }}
                              onClick={(e) => { e.stopPropagation(); setTempPrimaryId(poc.id); }}
                            >
                              <Star className="w-2.5 h-2.5" />Set as Primary
                            </button>
                          )}
                        </div>
                      );
                    })}
                    {/* Create New PoC */}
                    <div className="p-3 rounded-lg border-2 border-dashed border-border hover:border-primary/30 hover:bg-secondary/50 transition-colors cursor-pointer bg-card flex flex-col items-center justify-center text-center" style={{ minHeight: 140 }}
                      onClick={() => alert('Create New PoC form — coming soon')}
                    >
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center mb-2"><Plus className="w-4 h-4 text-primary" /></div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>Create New Point of Contact</div>
                      <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>for {selectedLocation.name}</div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <User className="w-12 h-12 mx-auto mb-3 text-border" />
                  <p style={{ fontSize: 14 }}>Select a location to view contacts</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>
            {tempSelectedPocs.length > 0 ? `${tempSelectedPocs.length} contact${tempSelectedPocs.length > 1 ? 's' : ''} selected` : 'No contacts selected'}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="px-4 h-8 text-[13px] hover:bg-secondary transition-colors flex items-center gap-2" style={{ borderRadius: 6, fontWeight: 500, border: '1px solid var(--border)', color: 'var(--muted-foreground)' }}>
              Cancel <div className="px-1.5 py-0.5 bg-secondary text-muted-foreground text-[10px] rounded" style={{ fontWeight: 500 }}>ESC</div>
            </button>
            <button onClick={handleConfirm} disabled={tempSelectedPocs.length === 0}
              className={`px-4 h-8 text-[13px] transition-colors flex items-center gap-2 ${tempSelectedPocs.length > 0 ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'bg-secondary text-muted-foreground cursor-not-allowed'}`}
              style={{ borderRadius: 6, fontWeight: 500 }}
            >Confirm Selection</button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
