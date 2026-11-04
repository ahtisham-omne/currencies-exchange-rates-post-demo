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

// Mock partners
const MOCK_PARTNERS: Partner[] = [
  {
    id: 'partner1',
    name: 'Tri-County EMS Authority',
    type: 'Customer',
    location: 'Springfield, IL',
  },
  {
    id: 'partner2',
    name: 'Global Industries Inc',
    type: 'Customer',
    location: 'New York, NY',
  },
  {
    id: 'partner3',
    name: 'Tech Solutions Ltd',
    type: 'Customer',
    location: 'San Francisco, CA',
  },
  {
    id: 'partner4',
    name: 'Enterprise Systems',
    type: 'Customer',
    location: 'Boston, MA',
  },
];

// Mock addresses for each partner
const PARTNER_ADDRESSES: Record<string, Address[]> = {
  partner1: [
    {
      id: 'addr1',
      label: 'Headquarters',
      street: '1234 Innovation Drive',
      city: 'Torrance',
      state: 'CA',
      zip: '90503',
      country: 'USA',
      isDefault: true,
      pocCount: 4,
      primaryContact: 'Sarah Chen',
    },
    {
      id: 'addr2',
      label: 'Billing Office',
      street: 'PO Box 5678',
      city: 'New York',
      state: 'NY',
      zip: '10002',
      country: 'USA',
      isDefault: false,
      pocCount: 2,
      primaryContact: 'James Liu',
    },
    {
      id: 'addr3',
      label: 'Warehouse',
      street: '5678 Progress Avenue',
      city: 'Carson City',
      state: 'NV',
      zip: '89701',
      country: 'USA',
      isDefault: false,
      pocCount: 1,
      primaryContact: 'Mike Torres',
    },
    {
      id: 'addr4',
      label: 'East Coast Office',
      street: '2234 Tech Parkway',
      city: 'Boston',
      state: 'MA',
      zip: '02101',
      country: 'USA',
      isDefault: false,
      pocCount: 3,
      primaryContact: 'Emily Park',
    },
  ],
  partner2: [
    {
      id: 'addr5',
      label: 'Main Office',
      street: '789 Business Blvd',
      city: 'New York',
      state: 'NY',
      zip: '10001',
      country: 'USA',
      isDefault: true,
      pocCount: 5,
      primaryContact: 'David Kim',
    },
    {
      id: 'addr6',
      label: 'Distribution Center',
      street: '456 Logistics Lane',
      city: 'Newark',
      state: 'NJ',
      zip: '07102',
      country: 'USA',
      isDefault: false,
      pocCount: 2,
      primaryContact: 'Anna Reyes',
    },
  ],
  partner3: [
    {
      id: 'addr7',
      label: 'HQ - Downtown',
      street: '321 Market Street',
      city: 'San Francisco',
      state: 'CA',
      zip: '94102',
      country: 'USA',
      isDefault: true,
      pocCount: 3,
      primaryContact: 'Raj Patel',
    },
  ],
  partner4: [
    {
      id: 'addr8',
      label: 'Corporate Office',
      street: '555 Innovation Way',
      city: 'Boston',
      state: 'MA',
      zip: '02101',
      country: 'USA',
      isDefault: true,
      pocCount: 6,
      primaryContact: 'Lisa Wang',
    },
  ],
};

export function AddressSelectionModal({
  isOpen,
  onClose,
  onSelect,
  type,
  customerName,
  currentCustomer,
  currentAddress,
}: AddressSelectionModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>(currentCustomer.id);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(
    currentAddress?.id || null
  );
  const [defaultAddressId, setDefaultAddressId] = useState<string | null>(() => {
    const partnerAddrs = PARTNER_ADDRESSES[currentCustomer.id] || [];
    const defaultAddr = partnerAddrs.find((a) => a.isDefault);
    return defaultAddr?.id || null;
  });
  const [showPartnerSelector, setShowPartnerSelector] = useState(false);

  if (!isOpen) return null;

  const selectedPartner = MOCK_PARTNERS.find((p) => p.id === selectedPartnerId) || currentCustomer;
  const availableAddresses = PARTNER_ADDRESSES[selectedPartnerId] || [];

  const filteredAddresses = availableAddresses.filter((addr) =>
    [addr.label, addr.street, addr.city, addr.state].some((field) =>
      field.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  const filteredPartners = MOCK_PARTNERS.filter((partner) =>
    [partner.name, partner.location].some((field) =>
      field.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  const handleConfirm = () => {
    const selected = availableAddresses.find((a) => a.id === selectedAddressId);
    if (selected) {
      const originalDefault = availableAddresses.find((a) => a.isDefault);
      const defaultChanged = defaultAddressId !== (originalDefault?.id || null);
      onSelect(selected, selectedPartner, defaultChanged);
      onClose();
    }
  };

  const handlePartnerSelect = (partnerId: string) => {
    setSelectedPartnerId(partnerId);
    setSelectedAddressId(null);
    const partnerAddrs = PARTNER_ADDRESSES[partnerId] || [];
    const defaultAddr = partnerAddrs.find((a) => a.isDefault);
    setDefaultAddressId(defaultAddr?.id || null);
    setShowPartnerSelector(false);
  };

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 10001, backgroundColor: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(1px)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-white flex flex-col"
        style={{
          width: '85vw',
          maxWidth: '900px',
          height: '80vh',
          maxHeight: '85vh',
          borderRadius: '12px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-[#E5E7EB] px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-[14px] text-[#1F2937]" style={{ fontWeight: 600 }}>
              {showPartnerSelector
                ? 'Select Partner'
                : `Select ${type === 'billing' ? 'Billing' : 'Shipping'} Address`}
            </h2>
            <p className="text-[12px] text-[#6B7280] mt-1">
              {showPartnerSelector
                ? `Choose the partner for ${type} address`
                : `${selectedPartner.name} · ${selectedPartner.location}`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center hover:bg-[#F3F4F6] transition-colors"
            style={{ borderRadius: '6px' }}
          >
            <X className="w-4 h-4 text-[#6B7280]" />
          </button>
        </div>

        {/* Partner Toggle - Only show when not in partner selector */}
        {!showPartnerSelector && (
          <div className="px-6 py-3 border-b border-[#E5E7EB] flex items-center justify-between bg-[#F9FAFB] flex-shrink-0">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#6B7280]" />
              <span className="text-[13px] text-[#6B7280]">
                Showing addresses for:{' '}
                <span className="text-[#1F2937]" style={{ fontWeight: 500 }}>
                  {selectedPartner.name}
                </span>
              </span>
            </div>
            <button
              onClick={() => setShowPartnerSelector(true)}
              className="text-[13px] text-[#1B6EF3] hover:text-[#0D5ED7] hover:underline"
              style={{ fontWeight: 500 }}
            >
              Change partner
            </button>
          </div>
        )}

        {/* Search */}
        <div className="px-6 py-4 border-b border-[#E5E7EB] flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                showPartnerSelector
                  ? 'Search partners...'
                  : 'Search by location name, address, city...'
              }
              className="w-full h-10 pl-10 pr-4 text-[13px] border border-[#E5E7EB] bg-white focus:outline-none focus:ring-2 focus:ring-[#1B6EF3] focus:border-transparent"
              style={{ borderRadius: '6px' }}
            />
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {showPartnerSelector ? (
            /* Partner Selection */
            <div className="space-y-3">
              {filteredPartners.map((partner) => {
                const isCurrentCustomer = partner.id === currentCustomer.id;

                return (
                  <button
                    key={partner.id}
                    onClick={() => handlePartnerSelect(partner.id)}
                    className="w-full text-left border border-[#E5E7EB] bg-white hover:border-[#1B6EF3] hover:bg-[#FAFBFC] transition-all p-4 group"
                    style={{ borderRadius: '8px' }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[#F3F4F6] rounded flex items-center justify-center flex-shrink-0 group-hover:bg-[#E7F3FF] transition-colors">
                        <Building2 className="w-5 h-5 text-[#6B7280] group-hover:text-[#1B6EF3]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <div
                            className="text-[13px] text-[#1F2937] truncate"
                            style={{ fontWeight: 600 }}
                          >
                            {partner.name}
                          </div>
                          {isCurrentCustomer && (
                            <div
                              className="px-2 py-0.5 text-[11px] bg-[#DBEAFE] text-[#1E40AF] flex-shrink-0"
                              style={{ borderRadius: '4px', fontWeight: 500 }}
                            >
                              Current Customer
                            </div>
                          )}
                        </div>
                        <div className="text-[12px] text-[#6B7280] mt-1">
                          {partner.type} · {partner.location}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}

              {/* Add New Customer/Partner */}
              <button
                className="w-full text-left border-2 border-dashed border-[#E5E7EB] bg-white hover:border-[#BFDBFE] hover:bg-[#FAFCFF] transition-all p-4 group"
                style={{ borderRadius: '8px' }}
                onClick={() => alert('Add New Customer form — coming soon')}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#F0F7FF] rounded flex items-center justify-center flex-shrink-0 group-hover:bg-[#DBEAFE] transition-colors">
                    <Plus className="w-5 h-5 text-[#1B6EF3]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] text-[#1B6EF3]" style={{ fontWeight: 500 }}>
                      {searchQuery.trim()
                        ? <>Add &ldquo;{searchQuery.trim()}&rdquo; as New Customer</>
                        : 'Add New Customer'
                      }
                    </div>
                    <div className="text-[12px] text-[#9CA3AF] mt-0.5">
                      Create a new customer record
                    </div>
                  </div>
                </div>
              </button>
            </div>
          ) : (
            /* Address Selection */
            <div className="grid grid-cols-2 gap-3">
              {filteredAddresses.map((address) => {
                const isSelected = selectedAddressId === address.id;
                const isPrimary = defaultAddressId === address.id;
                const pocCount = address.pocCount || 0;

                return (
                  <div
                    key={address.id}
                    className="relative group"
                  >
                    <div
                      onClick={() => setSelectedAddressId(address.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedAddressId(address.id); } }}
                      className="w-full text-left transition-all relative cursor-pointer"
                      style={{
                        borderRadius: '8px',
                        borderWidth: '1.5px',
                        borderStyle: 'solid',
                        borderColor: isSelected ? '#1B6EF3' : '#E5E7EB',
                        backgroundColor: isSelected ? '#F8FBFF' : 'white',
                      }}
                    >
                      {/* Card Header — icon, label, badges */}
                      <div
                        className="flex items-center gap-2.5 px-3 py-2.5"
                        style={{
                          borderBottom: '1px solid',
                          borderBottomColor: isSelected ? '#DBEAFE' : '#F3F4F6',
                        }}
                      >
                        <div
                          className="w-8 h-8 flex items-center justify-center flex-shrink-0"
                          style={{
                            borderRadius: '6px',
                            backgroundColor: isSelected ? '#DBEAFE' : '#F3F4F6',
                          }}
                        >
                          <MapPin
                            className="w-4 h-4"
                            style={{ color: isSelected ? '#1B6EF3' : '#6B7280' }}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div
                            className="text-[13px] text-[#1F2937] truncate"
                            style={{ fontWeight: 600, lineHeight: '1.2' }}
                          >
                            {address.label}
                          </div>
                        </div>
                        {/* Selection check */}
                        {isSelected && (
                          <div className="w-5 h-5 bg-[#1B6EF3] rounded-full flex items-center justify-center flex-shrink-0">
                            <Check className="w-3 h-3 text-white" />
                          </div>
                        )}
                      </div>

                      {/* Card Body — address + contacts + primary pill */}
                      <div className="px-3 py-2.5">
                        <div
                          className="text-[12px] text-[#6B7280] truncate"
                          style={{ lineHeight: '1.4' }}
                        >
                          {address.street}
                        </div>
                        <div
                          className="text-[12px] text-[#6B7280] truncate"
                          style={{ lineHeight: '1.4' }}
                        >
                          {address.city}, {address.state} {address.zip} · {address.country}
                        </div>

                        {/* Contact info row + primary pill inline */}
                        <div className="flex items-center mt-2">
                          <div className="flex items-center gap-1.5 flex-1 min-w-0">
                            <Users className="w-3 h-3 text-[#9CA3AF] flex-shrink-0" />
                            <span className="text-[11px] text-[#9CA3AF]" style={{ fontWeight: 500 }}>
                              {pocCount} {pocCount === 1 ? 'contact' : 'contacts'}
                            </span>
                            {address.primaryContact && (
                              <>
                                <span className="text-[11px] text-[#D1D5DB]">·</span>
                                <span className="text-[11px] text-[#6B7280] truncate">
                                  {address.primaryContact}
                                </span>
                              </>
                            )}
                          </div>

                          {/* Primary pill — right-aligned, same row */}
                          {isPrimary ? (
                            <span
                              className="inline-flex items-center gap-1 flex-shrink-0 ml-2"
                              style={{
                                height: '22px',
                                padding: '0 8px',
                                borderRadius: '20px',
                                backgroundColor: '#EFF6FF',
                                borderWidth: '1px',
                                borderStyle: 'solid',
                                borderColor: '#BFDBFE',
                                fontSize: '11px',
                                fontWeight: 500,
                                color: '#1E40AF',
                                lineHeight: '1',
                              }}
                            >
                              <Star className="w-3 h-3" style={{ fill: '#1E40AF' }} />
                              Primary {type === 'billing' ? 'Billing' : 'Shipping'}
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDefaultAddressId(address.id);
                                toast.success(
                                  `"${address.label}" set as primary ${type} address`,
                                  { position: 'top-right', duration: 2500 }
                                );
                              }}
                              className="inline-flex items-center gap-1 flex-shrink-0 ml-2 opacity-0 group-hover:opacity-100 transition-all"
                              style={{
                                height: '22px',
                                padding: '0 8px',
                                borderRadius: '20px',
                                backgroundColor: '#FFFFFF',
                                borderWidth: '1px',
                                borderStyle: 'solid',
                                borderColor: '#E5E7EB',
                                fontSize: '11px',
                                fontWeight: 500,
                                color: '#6B7280',
                                cursor: 'pointer',
                                lineHeight: '1',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.borderColor = '#93C5FD';
                                e.currentTarget.style.backgroundColor = '#EFF6FF';
                                e.currentTarget.style.color = '#1B6EF3';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.borderColor = '#E5E7EB';
                                e.currentTarget.style.backgroundColor = '#FFFFFF';
                                e.currentTarget.style.color = '#6B7280';
                              }}
                            >
                              <Star className="w-3 h-3" />
                              Set as Primary
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Add New Address card */}
              <div
                className="cursor-pointer group"
                onClick={() => alert('Add New Address form — coming soon')}
                role="button"
                tabIndex={0}
              >
                <div
                  className="flex flex-col items-center justify-center text-center h-full transition-all"
                  style={{
                    borderRadius: '8px',
                    borderWidth: '2px',
                    borderStyle: 'dashed',
                    borderColor: '#E5E7EB',
                    backgroundColor: 'white',
                    minHeight: '140px',
                    padding: '16px',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#BFDBFE';
                    e.currentTarget.style.backgroundColor = '#FAFCFF';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#E5E7EB';
                    e.currentTarget.style.backgroundColor = 'white';
                  }}
                >
                  <div className="w-9 h-9 bg-[#F0F7FF] rounded-full flex items-center justify-center mb-2 group-hover:bg-[#DBEAFE] transition-colors">
                    <Plus className="w-4 h-4 text-[#1B6EF3]" />
                  </div>
                  <div className="text-[13px] text-[#1B6EF3] mb-0.5" style={{ fontWeight: 500 }}>
                    {searchQuery.trim()
                      ? <>Add &ldquo;{searchQuery.trim()}&rdquo; as New Address</>
                      : 'Add New Address'
                    }
                  </div>
                  <div className="text-[11px] text-[#9CA3AF]">
                    for {selectedPartner.name}
                  </div>
                </div>
              </div>
            </div>
          )}

          {!showPartnerSelector && filteredAddresses.length === 0 && (
            <div className="text-center py-12">
              <MapPin className="w-12 h-12 text-[#E5E7EB] mx-auto mb-3" />
              <p className="text-[13px] text-[#6B7280] mb-4">No addresses found</p>
              {searchQuery.trim() && (
                <button
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md border-2 border-dashed border-[#BFDBFE] bg-[#FAFCFF] hover:bg-[#F0F7FF] transition-colors cursor-pointer"
                  onClick={() => alert('Add New Address form — coming soon')}
                >
                  <Plus className="w-4 h-4 text-[#1B6EF3]" />
                  <span className="text-[13px] text-[#1B6EF3]" style={{ fontWeight: 500 }}>
                    Add &ldquo;{searchQuery.trim()}&rdquo; as New Address
                  </span>
                </button>
              )}
            </div>
          )}

          {showPartnerSelector && filteredPartners.length === 0 && (
            <div className="text-center py-12">
              <Building2 className="w-12 h-12 text-[#E5E7EB] mx-auto mb-3" />
              <p className="text-[13px] text-[#6B7280] mb-4">No partners found</p>
              {searchQuery.trim() && (
                <button
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md border-2 border-dashed border-[#BFDBFE] bg-[#FAFCFF] hover:bg-[#F0F7FF] transition-colors cursor-pointer"
                  onClick={() => alert('Add New Customer form — coming soon')}
                >
                  <Plus className="w-4 h-4 text-[#1B6EF3]" />
                  <span className="text-[13px] text-[#1B6EF3]" style={{ fontWeight: 500 }}>
                    Add &ldquo;{searchQuery.trim()}&rdquo; as New Customer
                  </span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-[#E5E7EB] px-6 py-4 flex items-center justify-end flex-shrink-0">
          {!showPartnerSelector ? (
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="px-4 h-8 border border-[#E5E7EB] text-[13px] text-[#6B7280] hover:bg-[#F9FAFB] transition-colors"
                style={{ borderRadius: '6px', fontWeight: 500 }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={!selectedAddressId}
                className={`px-4 h-8 text-[13px] transition-colors ${
                  selectedAddressId
                    ? 'bg-[#1B6EF3] text-white hover:bg-[#0D5ED7]'
                    : 'bg-[#E5E7EB] text-[#9CA3AF] cursor-not-allowed'
                }`}
                style={{ borderRadius: '6px', fontWeight: 500 }}
              >
                Confirm
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowPartnerSelector(false)}
              className="px-4 h-8 border border-[#E5E7EB] text-[13px] text-[#6B7280] hover:bg-[#F9FAFB] transition-colors"
              style={{ borderRadius: '6px', fontWeight: 500 }}
            >
              ← Back to addresses
            </button>
          )}
        </div>
      </div>
    </div>
  , document.body);
}