import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, MapPin, Building2, Search, Check, Users, Plus, Star } from 'lucide-react';
import { toast } from 'sonner';

interface Address {
  id: string;
  label: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  isDefault: boolean;
  mapPreview?: string;
  pocCount?: number;
  primaryContact?: string;
}

interface Partner {
  id: string;
  name: string;
  type: string;
  location: string;
}

interface AddressSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (address: Address, partner: Partner, defaultChanged?: boolean) => void;
  type: 'billing' | 'shipping';
  customerName: string;
  currentCustomer: Partner;
  currentAddress: Address | null;
}

const MOCK_PARTNERS: Partner[] = [
  { id: 'partner1', name: 'Tri-County EMS Authority', type: 'Customer', location: 'Springfield, IL' },
  { id: 'partner2', name: 'Global Industries Inc', type: 'Customer', location: 'New York, NY' },
  { id: 'partner3', name: 'Tech Solutions Ltd', type: 'Customer', location: 'San Francisco, CA' },
  { id: 'partner4', name: 'Enterprise Systems', type: 'Customer', location: 'Boston, MA' },
];

const PARTNER_ADDRESSES: Record<string, Address[]> = {
  partner1: [
    { id: 'addr1', label: 'Headquarters', street: '1234 Innovation Drive', city: 'Torrance', state: 'CA', zip: '90503', country: 'USA', isDefault: true, pocCount: 4, primaryContact: 'Sarah Chen' },
    { id: 'addr2', label: 'Billing Office', street: 'PO Box 5678', city: 'New York', state: 'NY', zip: '10002', country: 'USA', isDefault: false, pocCount: 2, primaryContact: 'James Liu' },
    { id: 'addr3', label: 'Warehouse', street: '5678 Progress Avenue', city: 'Carson City', state: 'NV', zip: '89701', country: 'USA', isDefault: false, pocCount: 1, primaryContact: 'Mike Torres' },
    { id: 'addr4', label: 'East Coast Office', street: '2234 Tech Parkway', city: 'Boston', state: 'MA', zip: '02101', country: 'USA', isDefault: false, pocCount: 3, primaryContact: 'Emily Park' },
  ],
  partner2: [
    { id: 'addr5', label: 'Main Office', street: '789 Business Blvd', city: 'New York', state: 'NY', zip: '10001', country: 'USA', isDefault: true, pocCount: 5, primaryContact: 'David Kim' },
    { id: 'addr6', label: 'Distribution Center', street: '456 Logistics Lane', city: 'Newark', state: 'NJ', zip: '07102', country: 'USA', isDefault: false, pocCount: 2, primaryContact: 'Anna Reyes' },
  ],
  partner3: [
    { id: 'addr7', label: 'HQ - Downtown', street: '321 Market Street', city: 'San Francisco', state: 'CA', zip: '94102', country: 'USA', isDefault: true, pocCount: 3, primaryContact: 'Raj Patel' },
  ],
  partner4: [
    { id: 'addr8', label: 'Corporate Office', street: '555 Innovation Way', city: 'Boston', state: 'MA', zip: '02101', country: 'USA', isDefault: true, pocCount: 6, primaryContact: 'Lisa Wang' },
  ],
};

export type { Address, Partner };

export function AddressSelectionModal({
  isOpen, onClose, onSelect, type, customerName, currentCustomer, currentAddress,
}: AddressSelectionModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>(currentCustomer.id);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(currentAddress?.id || null);
  const [defaultAddressId, setDefaultAddressId] = useState<string | null>(() => {
    const partnerAddrs = PARTNER_ADDRESSES[currentCustomer.id] || [];
    return partnerAddrs.find((a) => a.isDefault)?.id || null;
  });
  const [showPartnerSelector, setShowPartnerSelector] = useState(false);

  if (!isOpen) return null;

  const selectedPartner = MOCK_PARTNERS.find((p) => p.id === selectedPartnerId) || currentCustomer;
  const availableAddresses = PARTNER_ADDRESSES[selectedPartnerId] || [];
  const filteredAddresses = availableAddresses.filter((addr) =>
    [addr.label, addr.street, addr.city, addr.state].some((f) => f.toLowerCase().includes(searchQuery.toLowerCase()))
  );
  const filteredPartners = MOCK_PARTNERS.filter((p) =>
    [p.name, p.location].some((f) => f.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleConfirm = () => {
    const selected = availableAddresses.find((a) => a.id === selectedAddressId);
    if (selected) {
      const originalDefault = availableAddresses.find((a) => a.isDefault);
      onSelect(selected, selectedPartner, defaultAddressId !== (originalDefault?.id || null));
      onClose();
    }
  };

  const handlePartnerSelect = (partnerId: string) => {
    setSelectedPartnerId(partnerId);
    setSelectedAddressId(null);
    const partnerAddrs = PARTNER_ADDRESSES[partnerId] || [];
    setDefaultAddressId(partnerAddrs.find((a) => a.isDefault)?.id || null);
    setShowPartnerSelector(false);
  };

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 10001, backgroundColor: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(1px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="flex flex-col"
        style={{ width: '85vw', maxWidth: '900px', height: '80vh', maxHeight: '85vh', borderRadius: '12px', background: 'var(--card)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
          <div>
            <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>
              {showPartnerSelector ? 'Select Partner' : `Select ${type === 'billing' ? 'Billing' : 'Shipping'} Address`}
            </h2>
            <p style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 4 }}>
              {showPartnerSelector ? `Choose the partner for ${type} address` : `${selectedPartner.name} · ${selectedPartner.location}`}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center hover:bg-secondary transition-colors" style={{ borderRadius: 6 }}>
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Partner Toggle */}
        {!showPartnerSelector && (
          <div className="px-6 py-3 flex items-center justify-between bg-secondary flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-muted-foreground" />
              <span style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>
                Showing addresses for: <span style={{ fontWeight: 500, color: 'var(--foreground)' }}>{selectedPartner.name}</span>
              </span>
            </div>
            <button onClick={() => setShowPartnerSelector(true)} className="text-primary hover:underline" style={{ fontSize: 13, fontWeight: 500 }}>
              Change partner
            </button>
          </div>
        )}

        {/* Search */}
        <div className="px-6 py-4 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={showPartnerSelector ? 'Search partners...' : 'Search by location name, address, city...'}
              className="w-full h-10 pl-10 pr-4 text-[13px] focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              style={{ borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--foreground)' }}
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {showPartnerSelector ? (
            <div className="space-y-3">
              {filteredPartners.map((partner) => (
                <button
                  key={partner.id} onClick={() => handlePartnerSelect(partner.id)}
                  className="w-full text-left p-4 group transition-all hover:border-primary hover:bg-secondary/50"
                  style={{ borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)' }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded flex items-center justify-center flex-shrink-0 bg-secondary group-hover:bg-primary/10 transition-colors">
                      <Building2 className="w-5 h-5 text-muted-foreground group-hover:text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>{partner.name}</div>
                        {partner.id === currentCustomer.id && (
                          <div className="px-2 py-0.5 text-[11px] bg-primary/10 text-primary" style={{ borderRadius: 4, fontWeight: 500 }}>Current Customer</div>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 4 }}>{partner.type} · {partner.location}</div>
                    </div>
                  </div>
                </button>
              ))}
              <button
                className="w-full text-left p-4 group transition-all hover:border-primary/40 hover:bg-primary/5"
                style={{ borderRadius: 8, border: '2px dashed var(--border)', background: 'var(--card)' }}
                onClick={() => alert('Add New Customer form — coming soon')}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded flex items-center justify-center flex-shrink-0 bg-primary/10 group-hover:bg-primary/20 transition-colors">
                    <Plus className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <div className="text-primary" style={{ fontSize: 13, fontWeight: 500 }}>
                      {searchQuery.trim() ? <>Add &ldquo;{searchQuery.trim()}&rdquo; as New Customer</> : 'Add New Customer'}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 2 }}>Create a new customer record</div>
                  </div>
                </div>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {filteredAddresses.map((address) => {
                const isSelected = selectedAddressId === address.id;
                const isPrimary = defaultAddressId === address.id;
                return (
                  <div key={address.id} className="relative group">
                    <div
                      onClick={() => setSelectedAddressId(address.id)}
                      role="button" tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedAddressId(address.id); } }}
                      className="w-full text-left transition-all relative cursor-pointer"
                      style={{ borderRadius: 8, borderWidth: '1.5px', borderStyle: 'solid', borderColor: isSelected ? 'var(--primary)' : 'var(--border)', backgroundColor: isSelected ? 'var(--primary-hover-bg, hsl(var(--primary) / 0.05))' : 'var(--card)' }}
                    >
                      <div className="flex items-center gap-2.5 px-3 py-2.5" style={{ borderBottom: '1px solid', borderBottomColor: isSelected ? 'hsl(var(--primary) / 0.15)' : 'var(--secondary)' }}>
                        <div className="w-8 h-8 flex items-center justify-center flex-shrink-0" style={{ borderRadius: 6, backgroundColor: isSelected ? 'hsl(var(--primary) / 0.1)' : 'var(--secondary)' }}>
                          <MapPin className="w-4 h-4" style={{ color: isSelected ? 'var(--primary)' : 'var(--muted-foreground)' }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="truncate" style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', lineHeight: 1.2 }}>{address.label}</div>
                        </div>
                        {isSelected && (
                          <div className="w-5 h-5 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
                            <Check className="w-3 h-3 text-primary-foreground" />
                          </div>
                        )}
                      </div>
                      <div className="px-3 py-2.5">
                        <div className="truncate" style={{ fontSize: 12, color: 'var(--muted-foreground)', lineHeight: 1.4 }}>{address.street}</div>
                        <div className="truncate" style={{ fontSize: 12, color: 'var(--muted-foreground)', lineHeight: 1.4 }}>{address.city}, {address.state} {address.zip} · {address.country}</div>
                        <div className="flex items-center mt-2">
                          <div className="flex items-center gap-1.5 flex-1 min-w-0">
                            <Users className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--muted-foreground)' }}>{address.pocCount || 0} contacts</span>
                            {address.primaryContact && (
                              <><span style={{ fontSize: 11, color: 'var(--border)' }}>·</span><span className="truncate" style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{address.primaryContact}</span></>
                            )}
                          </div>
                          {isPrimary ? (
                            <span className="inline-flex items-center gap-1 flex-shrink-0 ml-2 px-2 bg-primary/10 text-primary" style={{ height: 22, borderRadius: 20, fontSize: 11, fontWeight: 500 }}>
                              <Star className="w-3 h-3" style={{ fill: 'var(--primary)' }} />Primary {type === 'billing' ? 'Billing' : 'Shipping'}
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setDefaultAddressId(address.id); toast.success(`"${address.label}" set as primary ${type} address`, { position: 'top-right', duration: 2500 }); }}
                              className="inline-flex items-center gap-1 flex-shrink-0 ml-2 opacity-0 group-hover:opacity-100 transition-all px-2 hover:bg-primary/10 hover:text-primary hover:border-primary/30"
                              style={{ height: 22, borderRadius: 20, border: '1px solid var(--border)', backgroundColor: 'var(--card)', fontSize: 11, fontWeight: 500, color: 'var(--muted-foreground)', cursor: 'pointer' }}
                            >
                              <Star className="w-3 h-3" />Set as Primary
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {/* Add New Address */}
              <div className="cursor-pointer group" onClick={() => alert('Add New Address form — coming soon')} role="button" tabIndex={0}>
                <div className="flex flex-col items-center justify-center text-center h-full transition-all" style={{ borderRadius: 8, border: '2px dashed var(--border)', backgroundColor: 'var(--card)', minHeight: 140, padding: 16 }}>
                  <div className="w-9 h-9 bg-primary/10 rounded-full flex items-center justify-center mb-2 group-hover:bg-primary/20 transition-colors">
                    <Plus className="w-4 h-4 text-primary" />
                  </div>
                  <div className="text-primary" style={{ fontSize: 13, fontWeight: 500 }}>
                    {searchQuery.trim() ? <>Add &ldquo;{searchQuery.trim()}&rdquo; as New Address</> : 'Add New Address'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>for {selectedPartner.name}</div>
                </div>
              </div>
            </div>
          )}

          {!showPartnerSelector && filteredAddresses.length === 0 && (
            <div className="text-center py-12">
              <MapPin className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--border)' }} />
              <p style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>No addresses found</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 flex items-center justify-end flex-shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
          {!showPartnerSelector ? (
            <div className="flex items-center gap-3">
              <button onClick={onClose} className="px-4 h-8 text-[13px] hover:bg-secondary transition-colors" style={{ borderRadius: 6, fontWeight: 500, border: '1px solid var(--border)', color: 'var(--muted-foreground)' }}>Cancel</button>
              <button
                onClick={handleConfirm} disabled={!selectedAddressId}
                className={`px-4 h-8 text-[13px] transition-colors ${selectedAddressId ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'bg-secondary text-muted-foreground cursor-not-allowed'}`}
                style={{ borderRadius: 6, fontWeight: 500 }}
              >Confirm</button>
            </div>
          ) : (
            <button onClick={() => setShowPartnerSelector(false)} className="px-4 h-8 text-[13px] hover:bg-secondary transition-colors" style={{ borderRadius: 6, fontWeight: 500, border: '1px solid var(--border)', color: 'var(--muted-foreground)' }}>← Back to addresses</button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
