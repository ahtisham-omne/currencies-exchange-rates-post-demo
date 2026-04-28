import { useState, useEffect } from 'react';
import { MapPin, Building2, Plus, X, Calendar, Info, DollarSign, FileText, Clock, Tag, Settings, Phone, Mail, Pencil, MapPinned, CreditCard, User, ArrowLeftRight, Edit2, Check } from 'lucide-react';
import { QuoteDraft } from '@/app/components/CreateQuoteModal';
import { AddressSelectionModal } from '@/app/components/quote-creation/AddressSelectionModal';
import { PaymentTermsLibrary } from '@/app/components/quote-creation/PaymentTermsLibrary';
import { PricingRulesLibrary } from '@/app/components/quote-creation/PricingRulesLibrary';
import { RecipientsSelectionModal } from '@/app/components/quote-creation/RecipientsSelectionModal';
import { PaymentMethodSelectionModal } from '@/app/components/quote-creation/PaymentMethodSelectionModal';
import { DateConfigCards } from '@/app/components/quote-creation/DateConfigCards';
import { DateEditModal } from '@/app/components/quote-creation/DateEditModal';
import { LocationSelectionModal } from '@/app/components/quote-creation/LocationSelectionModal';
import { SalesRepSelector, SelectedSalesRep, SalesRepOption } from '@/app/components/shared/SalesRepSelector';

interface Step2ConfigurationProps {
  quoteDraft: QuoteDraft;
  onUpdate: (updates: Partial<QuoteDraft>) => void;
  onClearAll?: () => void;
}

interface Address {
  id: string;
  label: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  isDefault: boolean;
}

// Mock customer defaults
const CUSTOMER_DEFAULTS = {
  pricingRule: 'Volume Discount - 10%',
  paymentTerms: 'NET 30',
  billingAddress: {
    id: 'addr1',
    label: 'Headquarters',
    street: '6145 Logistics Center Blvd. Rockford',
    city: 'Illinois 61101',
    state: '',
    zip: '',
    country: 'United States',
    isDefault: true,
  } as Address,
  shippingAddress: {
    id: 'addr1',
    label: 'Headquarters',
    street: '6145 Logistics Center Blvd. Rockford',
    city: 'Illinois 61101',
    state: '',
    zip: '',
    country: 'United States',
    isDefault: true,
  } as Address,
};

export function Step2Configuration({ quoteDraft, onUpdate, onClearAll }: Step2ConfigurationProps) {
  const [requestDateType, setRequestDateType] = useState<'absolute' | 'relative'>('absolute');
  const [validUntilType, setValidUntilType] = useState<'absolute' | 'relative'>('relative');
  const [expiryType, setExpiryType] = useState<'absolute' | 'relative'>('relative');
  const [hasExpiry, setHasExpiry] = useState(true);
  const [effectiveWhenSent, setEffectiveWhenSent] = useState(true);
  const [relativeRequestDays, setRelativeRequestDays] = useState('7');
  const [relativeValidDays, setRelativeValidDays] = useState('0');
  const [relativeExpiryDays, setRelativeExpiryDays] = useState('30');
  const [requestUnit, setRequestUnit] = useState<'hours' | 'days' | 'weeks' | 'months'>('days');
  const [validUntilUnit, setValidUntilUnit] = useState<'hours' | 'days' | 'weeks' | 'months'>('days');
  const [expiryUnit, setExpiryUnit] = useState<'hours' | 'days' | 'weeks' | 'months'>('days');
  
  // Edit modal states
  const [editingDateCard, setEditingDateCard] = useState<'request' | 'effective' | 'expiry' | null>(null);
  
  // Address selection state
  const [addressModalType, setAddressModalType] = useState<'billing' | 'shipping' | null>(null);
  const [selectedBillingAddress, setSelectedBillingAddress] = useState<Address>(
    CUSTOMER_DEFAULTS.billingAddress
  );
  const [selectedBillingPartner, setSelectedBillingPartner] = useState(
    quoteDraft.customer
      ? {
          name: quoteDraft.customer.name,
          location: quoteDraft.customer.location || '',
        }
      : {
          name: 'Toyota Motor Manufacturing, Illinois (TMMI)',
          location: 'Torrance, CA',
        }
  );
  const [selectedShippingAddress, setSelectedShippingAddress] = useState<Address>(
    CUSTOMER_DEFAULTS.shippingAddress
  );
  const [selectedShippingPartner, setSelectedShippingPartner] = useState(
    quoteDraft.customer
      ? {
          name: quoteDraft.customer.name,
          location: quoteDraft.customer.location || '',
        }
      : {
          name: 'Toyota Motor Manufacturing, Illinois (TMMI)',
          location: 'Torrance, CA',
        }
  );
  
  // Pricing/Terms state
  const [selectedPaymentTerms, setSelectedPaymentTerms] = useState(CUSTOMER_DEFAULTS.paymentTerms);
  const [showPaymentTermsLibrary, setShowPaymentTermsLibrary] = useState(false);

  // New interactive states
  const [showPaymentMethodDropdown, setShowPaymentMethodDropdown] = useState(false);
  const [showRecipientsEditor, setShowRecipientsEditor] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  
  // Recipients state
  const [selectedRecipientsData, setSelectedRecipientsData] = useState<any[]>([]);
  const [primaryRecipientId, setPrimaryRecipientId] = useState('');
  
  // Priority and Tags state
  const [priority, setPriority] = useState<'low' | 'standard' | 'high'>('standard');
  const [tags, setTags] = useState<string[]>(['Engine Components', 'Hydraulics']);
  const [isEditingPriority, setIsEditingPriority] = useState(false);
  const [isEditingTags, setIsEditingTags] = useState(false);
  const [newTag, setNewTag] = useState('');
  
  // Initialize recipients from quoteDraft
  useEffect(() => {
    if (quoteDraft.recipients && quoteDraft.recipients.length > 0) {
      setSelectedRecipientsData(quoteDraft.recipients);
      const primary = quoteDraft.recipients.find(r => r.isPrimary);
      if (primary) {
        setPrimaryRecipientId(primary.id);
      } else {
        setPrimaryRecipientId(quoteDraft.recipients[0].id);
      }
    }
  }, [quoteDraft.recipients]);

  const [selectedCustomerLocation, setSelectedCustomerLocation] = useState({
    id: 'loc1',
    name: 'Torrance, CA (Headquarters)',
    address: '2972 Westheimer Rd. Santa Ana, Illinois 85486',
    isDefault: true,
  });

  // Multiple sales reps support
  const [selectedSalesReps, setSelectedSalesReps] = useState<SelectedSalesRep[]>([
    { id: 'rep1', name: 'Yahya Naveed', initials: 'YN', isPrimary: true, isCurrentUser: true, isCustomerDefault: false },
  ]);

  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState({
    id: 'ach',
    name: 'ACH/Direct Deposit',
    icon: 'CreditCard',
  });

  // Mock sales rep data
  const AVAILABLE_SALES_REPS: SalesRepOption[] = [
    { id: 'rep1', name: 'Yahya Naveed', initials: 'YN', isCurrentUser: true, isCustomerDefault: false },
    { id: 'rep2', name: 'Sarah Mitchell', initials: 'SM', isCurrentUser: false, isCustomerDefault: true },
    { id: 'rep3', name: 'David Chen', initials: 'DC', isCurrentUser: false, isCustomerDefault: false },
    { id: 'rep4', name: 'Emily Rodriguez', initials: 'ER', isCurrentUser: false, isCustomerDefault: false },
    { id: 'rep5', name: 'Michael Johnson', initials: 'MJ', isCurrentUser: false, isCustomerDefault: false },
    { id: 'rep6', name: 'Jessica Williams', initials: 'JW', isCurrentUser: false, isCustomerDefault: false },
  ];

  // Mock customer locations
  const CUSTOMER_LOCATIONS = [
    {
      id: 'loc1',
      name: 'Torrance, CA (Headquarters)',
      address: '2972 Westheimer Rd. Santa Ana, Illinois 85486',
      isDefault: true,
    },
    {
      id: 'loc2',
      name: 'Chicago, IL (Manufacturing Plant)',
      address: '4521 Industrial Way, Chicago, IL 60601',
      isDefault: false,
    },
    {
      id: 'loc3',
      name: 'Austin, TX (Distribution Center)',
      address: '789 Warehouse Blvd, Austin, TX 78701',
      isDefault: false,
    },
    {
      id: 'loc4',
      name: 'Seattle, WA (Regional Office)',
      address: '123 Tech Drive, Seattle, WA 98101',
      isDefault: false,
    },
  ];

  const handleAddressSelect = (address: Address, partner: any, saveAsDefault?: boolean) => {
    if (addressModalType === 'billing') {
      setSelectedBillingAddress(address);
      setSelectedBillingPartner({ name: partner.name, location: partner.location });
      if (saveAsDefault) {
        console.log('Saving billing address as default for partner:', partner, address);
      }
    } else if (addressModalType === 'shipping') {
      setSelectedShippingAddress(address);
      setSelectedShippingPartner({ name: partner.name, location: partner.location });
      if (saveAsDefault) {
        console.log('Saving shipping address as default for partner:', partner, address);
      }
    }
  };

  const handlePaymentTermsSelect = (term: any, saveAsDefault: boolean) => {
    setSelectedPaymentTerms(term.name);
    if (saveAsDefault) {
      console.log('Saving payment term as customer default:', term);
    }
  };

  // Initialize primary POC when component mounts
  useEffect(() => {
    // Only set if there's a default recipient and no primary POC set yet
    if (!quoteDraft.primaryPoC && selectedRecipientsData.length > 0 && primaryRecipientId) {
      const primaryRecipient = selectedRecipientsData.find(r => r.id === primaryRecipientId);
      if (primaryRecipient) {
        onUpdate({
          primaryPoC: {
            id: primaryRecipient.id,
            name: primaryRecipient.name,
            email: primaryRecipient.email,
          }
        });
      }
    }
  }, []); // Run only once on mount

  // Helper function to generate avatar background color based on initials
  const getAvatarColor = (initials: string) => {
    const colors = [
      { bg: '#FDE68A', text: '#92400E' }, // Yellow
      { bg: '#DBEAFE', text: '#1E40AF' }, // Blue
      { bg: '#FED7AA', text: '#9A3412' }, // Orange
      { bg: '#C7D2FE', text: '#3730A3' }, // Indigo
      { bg: '#FCA5A5', text: '#991B1B' }, // Red
      { bg: '#D1FAE5', text: '#065F46' }, // Green
      { bg: '#E9D5FF', text: '#6B21A8' }, // Purple
      { bg: '#FBCFE8', text: '#831843' }, // Pink
    ];
    const hash = initials.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  return (
    <>
      {/* Main Content - Gray Background */}
      <div className="flex-1 overflow-y-auto" style={{ backgroundColor: '#FAFBFC' }}>
        <div className="mx-auto" style={{ maxWidth: '1200px', padding: '16px 48px 16px 48px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* White Card Container */}
            <div
              style={{
                backgroundColor: '#FFFFFF',
                border: '1px solid #E5E7EB',
                borderRadius: '8px',
                padding: '16px 20px',
              }}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[14px] text-[#1F2937]" style={{ fontWeight: 600 }}>
                  Selected Customer and Recipient
                </h2>
                <button className="text-[13px] text-[#EF4444] hover:bg-[#FEF2F2] hover:border-[#FCA5A5] flex items-center gap-1 px-3 py-1.5 rounded transition-all border border-transparent" onClick={onClearAll}>
                  <X className="w-3.5 h-3.5" />
                  Clear All
                </button>
              </div>

              {/* Single Blue Card - Contains two white sub-boxes */}
              <div
                style={{
                  backgroundColor: '#F7F8F9',
                  border: '1px solid #E5E7EB',
                  borderRadius: '6px',
                  padding: '12px',
                }}
              >
                {/* First White Sub-Box: Customer Details + Recipients */}
                <div
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: '6px',
                    padding: '12px',
                    marginBottom: '12px',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
                  }}
                >
                  {/* Customer Details */}
                  <div className="flex items-start justify-between gap-6 mb-3">
                    {/* Left: Company Details */}
                    <div className="flex items-start gap-3 flex-1">
                      <div className="w-10 h-10 bg-[#F9FAFB] rounded flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-5 h-5 text-[#6B7280]" />
                      </div>
                      
                      <div className="flex-1 min-w-0 relative">
                        <h3 className="text-[14px] text-[#1F2937] mb-1" style={{ fontWeight: 600 }}>
                          {quoteDraft.customer?.name || 'Toyota Motor Manufacturing..'}
                        </h3>
                        <div className="flex items-center gap-2 mb-2">
                          <p className="text-[12px] text-[#6B7280]">
                            {selectedCustomerLocation.address}
                          </p>
                          <button
                            onClick={() => setShowLocationModal(true)}
                            className="flex-shrink-0 flex items-center gap-1 hover:opacity-80 transition-opacity"
                            style={{ borderBottom: '1px dotted #1B6EF3' }}
                          >
                            <ArrowLeftRight className="w-3 h-3 text-[#1B6EF3]" />
                            <span className="text-[11px] text-[#1B6EF3]" style={{ fontWeight: 500 }}>
                              Change
                            </span>
                          </button>
                        </div>
                        
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="inline-flex items-center h-5 px-2 text-[10px] bg-[#DBEAFE] border border-[#93C5FD] text-[#1E40AF] rounded" style={{ fontWeight: 500 }}>
                            Customer
                          </span>
                          {selectedCustomerLocation.isDefault && (
                            <span className="inline-flex items-center h-5 px-2 text-[10px] bg-[#DBEAFE] border border-[#93C5FD] text-[#1E40AF] rounded" style={{ fontWeight: 500 }}>
                              {selectedCustomerLocation.name.split('(')[0].trim()}
                            </span>
                          )}
                          <span className="inline-flex items-center h-5 px-2 text-[10px] bg-[#D1FAE5] border border-[#A7F3D0] text-[#065F46] rounded" style={{ fontWeight: 500 }}>
                            Active
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Right: Contact Information */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2 text-[12px] text-[#6B7280]">
                        <Phone className="w-3.5 h-3.5 flex-shrink-0 text-[#9CA3AF]" />
                        <span>(390) 412-9011</span>
                      </div>
                      <div className="flex items-center gap-2 text-[12px] text-[#6B7280]">
                        <Phone className="w-3.5 h-3.5 flex-shrink-0 text-[#9CA3AF]" />
                        <span>(928) 630-9272</span>
                        <span className="text-[#9CA3AF] text-[11px]">Ext. 789</span>
                      </div>
                      <div className="flex items-center gap-2 text-[12px] text-[#6B7280]">
                        <Mail className="w-3.5 h-3.5 flex-shrink-0 text-[#9CA3AF]" />
                        <span>business@toyota.technical.com</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Recipients Row */}
                  {selectedRecipientsData.length > 0 && (
                    <div 
                      className="flex items-center gap-3 p-3 rounded-md border border-[#E5E7EB] hover:border-[#BFDBFE] hover:bg-[#F0F7FF] mt-4 cursor-pointer group transition-all"
                      onClick={() => setShowRecipientsEditor(true)}
                      style={{
                        transition: 'all 150ms ease',
                      }}
                    >
                      <label className="text-[13px] text-[#6B7280]" style={{ fontWeight: 400 }}>
                        Recipients
                      </label>
                      
                      <div className="flex items-center gap-3 flex-1">
                        {/* Primary Recipient - Filled Pill */}
                        {(() => {
                          const primaryRecipient = selectedRecipientsData.find(r => r.id === primaryRecipientId) || selectedRecipientsData[0];
                          const primaryColor = getAvatarColor(primaryRecipient.initials || primaryRecipient.name.split(' ').map((n: string) => n[0]).join(''));
                          
                          return (
                            <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-[#F3F4F6] group-hover:bg-white transition-colors" style={{ transition: 'all 150ms ease' }}>
                              <div 
                                className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] flex-shrink-0" 
                                style={{ 
                                  backgroundColor: primaryColor.bg, 
                                  color: primaryColor.text,
                                  fontWeight: 600 
                                }}
                              >
                                {primaryRecipient.initials || primaryRecipient.name.split(' ').map((n: string) => n[0]).join('')}
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[13px] text-[#1F2937]" style={{ fontWeight: 500 }}>
                                    {primaryRecipient.name}
                                  </span>
                                  <span className="inline-flex items-center h-4 px-1.5 text-[10px] bg-[#1B6EF3] text-white rounded" style={{ fontWeight: 500 }}>
                                    Primary
                                  </span>
                                </div>
                                <p className="text-[11px] text-[#9CA3AF]">{primaryRecipient.title}</p>
                              </div>
                            </div>
                          );
                        })()}
                        
                        {/* Secondary Recipients - Overlapping circles */}
                        {selectedRecipientsData.length > 1 && (
                          <div className="flex items-center">
                            {selectedRecipientsData
                              .filter(r => r.id !== primaryRecipientId)
                              .slice(0, 3)
                              .map((recipient, idx) => {
                                const color = getAvatarColor(recipient.initials || recipient.name.split(' ').map((n: string) => n[0]).join(''));
                                return (
                                  <div 
                                    key={recipient.id}
                                    className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] cursor-pointer hover:z-10 hover:scale-110 transition-all border-2 border-white" 
                                    style={{ 
                                      backgroundColor: color.bg,
                                      color: color.text,
                                      fontWeight: 600, 
                                      marginLeft: idx === 0 ? '0' : '-10px' 
                                    }}
                                    title={`${recipient.name} - ${recipient.title}`}
                                  >
                                    {recipient.initials || recipient.name.split(' ').map((n: string) => n[0]).join('')}
                                  </div>
                                );
                              })
                            }
                            {/* +X more badge */}
                            {selectedRecipientsData.length > 4 && (
                              <div 
                                className="w-8 h-8 rounded-full bg-[#1B6EF3] flex items-center justify-center text-[11px] text-white cursor-pointer hover:bg-[#0D5ED7] transition-colors border-2 border-white" 
                                style={{ fontWeight: 600, marginLeft: '-10px' }}
                                title={`${selectedRecipientsData.length - 4} more recipient${selectedRecipientsData.length - 4 > 1 ? 's' : ''}`}
                              >
                                +{selectedRecipientsData.length - 4}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <Pencil className="w-3.5 h-3.5 text-[#9CA3AF] group-hover:text-[#1B6EF3]" />
                    </div>
                  )}
                </div>

                {/* Second White Sub-Box: Billing, Shipping & Payment */}
                <div
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: '6px',
                    padding: '12px',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
                  }}
                >
                  <h3 className="text-[13px] text-[#6B7280] mb-3" style={{ fontWeight: 500 }}>
                    Billing, Shipping & Payment Configurations
                  </h3>

                  {/* Bill to & Ship to - Side by side */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    {/* Bill to */}
                    <div 
                      className="cursor-pointer group p-3 rounded-md border border-[#E5E7EB] hover:border-[#BFDBFE] hover:bg-[#F0F7FF] transition-all"
                      onClick={() => setAddressModalType('billing')}
                      style={{
                        transition: 'all 150ms ease',
                      }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5">
                          <MapPinned className="w-3.5 h-3.5 text-[#9CA3AF]" />
                          <label className="text-[11px] text-[#9CA3AF] uppercase tracking-wide" style={{ fontWeight: 500, letterSpacing: '0.5px' }}>
                            Bill to
                          </label>
                        </div>
                        <Pencil className="w-3.5 h-3.5 text-[#9CA3AF] group-hover:text-[#1B6EF3]" />
                      </div>
                      <div className="text-[13px] text-[#1F2937] mb-1" style={{ fontWeight: 600 }}>
                        {selectedBillingPartner.name}
                      </div>
                      <p className="text-[12px] text-[#6B7280] leading-relaxed">
                        {selectedBillingAddress.street}
                      </p>
                      <div className="flex items-center gap-2">
                        <p className="text-[12px] text-[#6B7280] leading-relaxed">
                          {selectedBillingAddress.city}, {selectedBillingAddress.country}
                        </p>
                        <span className="inline-flex items-center h-4 px-1.5 text-[10px] bg-[#DBEAFE] border border-[#93C5FD] text-[#1E40AF] rounded" style={{ fontWeight: 500 }}>
                          Default
                        </span>
                      </div>
                    </div>
                    
                    {/* Ship to */}
                    <div 
                      className="cursor-pointer group p-3 rounded-md border border-[#E5E7EB] hover:border-[#BFDBFE] hover:bg-[#F0F7FF] transition-all"
                      onClick={() => setAddressModalType('shipping')}
                      style={{
                        transition: 'all 150ms ease',
                      }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5">
                          <MapPinned className="w-3.5 h-3.5 text-[#9CA3AF]" />
                          <label className="text-[11px] text-[#9CA3AF] uppercase tracking-wide" style={{ fontWeight: 500, letterSpacing: '0.5px' }}>
                            Ship to
                          </label>
                        </div>
                        <Pencil className="w-3.5 h-3.5 text-[#9CA3AF] group-hover:text-[#1B6EF3]" />
                      </div>
                      <div className="text-[13px] text-[#1F2937] mb-1" style={{ fontWeight: 600 }}>
                        {selectedShippingPartner.name}
                      </div>
                      <p className="text-[12px] text-[#6B7280] leading-relaxed">
                        {selectedShippingAddress.street}
                      </p>
                      <div className="flex items-center gap-2">
                        <p className="text-[12px] text-[#6B7280] leading-relaxed">
                          {selectedShippingAddress.city}, {selectedShippingAddress.country}
                        </p>
                        <span className="inline-flex items-center h-4 px-1.5 text-[10px] bg-[#DBEAFE] border border-[#93C5FD] text-[#1E40AF] rounded" style={{ fontWeight: 500 }}>
                          Default
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Payment Details - Simple rows */}
                  <div className="space-y-1">
                    {/* Payment Terms */}
                    <div 
                      className="flex items-center justify-between px-3 py-2 rounded-md hover:bg-[#F9FAFB] cursor-pointer transition-all group"
                      onClick={() => setShowPaymentTermsLibrary(true)}
                      style={{
                        transition: 'all 150ms ease',
                      }}
                    >
                      <label className="text-[13px] text-[#6B7280]" style={{ fontWeight: 400 }}>
                        Payment terms
                      </label>
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] text-[#1F2937]" style={{ fontWeight: 600 }}>
                          Net 30
                        </span>
                        <Pencil className="w-3.5 h-3.5 text-[#9CA3AF] group-hover:text-[#1B6EF3]" />
                      </div>
                    </div>
                    
                    {/* Payment Method */}
                    <div 
                      className="flex items-center justify-between px-3 py-2 rounded-md hover:bg-[#F9FAFB] cursor-pointer transition-all group"
                      onClick={() => setShowPaymentMethodDropdown(true)}
                      style={{
                        transition: 'all 150ms ease',
                      }}
                    >
                      <label className="text-[13px] text-[#6B7280]" style={{ fontWeight: 400 }}>
                        Payment method
                      </label>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5">
                          <CreditCard className="w-3.5 h-3.5 text-[#3B82F6]" />
                          <span className="text-[13px] text-[#1F2937]" style={{ fontWeight: 600 }}>
                            {selectedPaymentMethod.name}
                          </span>
                        </div>
                        <Pencil className="w-3.5 h-3.5 text-[#9CA3AF] group-hover:text-[#1B6EF3]" />
                      </div>
                    </div>
                    
                    {/* Sales Representative */}
                    <SalesRepSelector
                      availableReps={AVAILABLE_SALES_REPS}
                      selectedReps={selectedSalesReps}
                      onSelectedRepsChange={setSelectedSalesReps}
                      dropdownDirection="up"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Date Cards - Outside white card, matching width */}
            <DateConfigCards
              requestDateType={requestDateType}
              requestDateValue={requestDateType === 'absolute' ? quoteDraft.configuration.validUntil || (() => { const d = new Date(); return `${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}/${d.getFullYear()}`; })() : relativeRequestDays}
              requestUnit={requestUnit}
              effectiveWhenSent={effectiveWhenSent}
              effectiveDateType={validUntilType}
              effectiveDateValue={validUntilType === 'absolute' ? quoteDraft.configuration.validUntil : relativeValidDays}
              effectiveUnit={validUntilUnit}
              hasExpiry={hasExpiry}
              expiryType={expiryType}
              expiryValue={expiryType === 'absolute' ? quoteDraft.configuration.expiryDate : relativeExpiryDays}
              expiryUnit={expiryUnit}
              onEdit={setEditingDateCard}
            />

            {/* Priority and Tags Cards - Matching date cards style */}
            <div className="grid grid-cols-3 gap-3">
              {/* Priority Card - Compact */}
              <div
                onClick={() => setIsEditingPriority(!isEditingPriority)}
                className="relative group cursor-pointer"
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '6px',
                  padding: '12px',
                  boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                  border: '1px solid #E5E7EB',
                  transition: 'all 150ms'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#BFDBFE';
                  e.currentTarget.style.backgroundColor = '#F0F7FF';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#E5E7EB';
                  e.currentTarget.style.backgroundColor = '#FFFFFF';
                }}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] text-[#9CA3AF] uppercase tracking-wide" style={{ fontWeight: 500, letterSpacing: '0.5px' }}>
                    Priority
                  </label>
                  <Pencil className="w-3 h-3 text-[#9CA3AF] group-hover:text-[#1B6EF3] transition-colors" />
                </div>
                <div className="flex items-center gap-2">
                  <span 
                    className={`text-[11px] px-2.5 py-1 rounded ${
                      priority === 'high' ? 'bg-[#FEE2E2] text-[#991B1B]' :
                      priority === 'low' ? 'bg-[#F3F4F6] text-[#374151]' :
                      'bg-[#DBEAFE] text-[#1E40AF]'
                    }`}
                    style={{ fontWeight: 500 }}
                  >
                    {priority === 'high' ? 'High' : priority === 'low' ? 'Low' : 'Standard'}
                  </span>
                </div>
                
                {/* Priority Dropdown */}
                {isEditingPriority && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsEditingPriority(false);
                      }}
                    />
                    <div className="absolute bottom-full left-0 mb-1 bg-white border border-[#E5E7EB] rounded-lg shadow-lg z-20 overflow-hidden" style={{ minWidth: '140px' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPriority('high');
                          setIsEditingPriority(false);
                        }}
                        className={`w-full px-3 py-2.5 text-left text-[13px] transition-colors flex items-center justify-between ${
                          priority === 'high' ? 'bg-[#FEF2F2]' : 'hover:bg-[#F9FAFB]'
                        }`}
                      >
                        <span className="text-[11px] px-2.5 py-1 rounded bg-[#FEE2E2] text-[#991B1B]" style={{ fontWeight: 500 }}>High</span>
                        {priority === 'high' && <Check className="w-3.5 h-3.5 text-[#991B1B]" />}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPriority('standard');
                          setIsEditingPriority(false);
                        }}
                        className={`w-full px-3 py-2.5 text-left text-[13px] transition-colors flex items-center justify-between border-t border-[#E5E7EB] ${
                          priority === 'standard' ? 'bg-[#EFF6FF]' : 'hover:bg-[#F9FAFB]'
                        }`}
                      >
                        <span className="text-[11px] px-2.5 py-1 rounded bg-[#DBEAFE] text-[#1E40AF]" style={{ fontWeight: 500 }}>Standard</span>
                        {priority === 'standard' && <Check className="w-3.5 h-3.5 text-[#1E40AF]" />}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPriority('low');
                          setIsEditingPriority(false);
                        }}
                        className={`w-full px-3 py-2.5 text-left text-[13px] transition-colors flex items-center justify-between border-t border-[#E5E7EB] ${
                          priority === 'low' ? 'bg-[#F9FAFB]' : 'hover:bg-[#F9FAFB]'
                        }`}
                      >
                        <span className="text-[11px] px-2.5 py-1 rounded bg-[#F3F4F6] text-[#374151]" style={{ fontWeight: 500 }}>Low</span>
                        {priority === 'low' && <Check className="w-3.5 h-3.5 text-[#374151]" />}
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Tags Card - Expanded */}
              <div
                onClick={() => setIsEditingTags(!isEditingTags)}
                className="relative group cursor-pointer col-span-2"
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '6px',
                  padding: '12px',
                  boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                  border: '1px solid #E5E7EB',
                  transition: 'all 150ms'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#BFDBFE';
                  e.currentTarget.style.backgroundColor = '#F0F7FF';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#E5E7EB';
                  e.currentTarget.style.backgroundColor = '#FFFFFF';
                }}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] text-[#9CA3AF] uppercase tracking-wide flex-shrink-0" style={{ fontWeight: 500, letterSpacing: '0.5px' }}>
                    Tags
                  </label>
                  <Pencil className="w-3 h-3 text-[#9CA3AF] group-hover:text-[#1B6EF3] transition-colors flex-shrink-0" />
                </div>
                <div className="flex items-center gap-1.5 flex-wrap overflow-hidden" style={{ lineHeight: 1.5 }}>
                  {tags.length > 0 ? (
                    <>
                      {tags.slice(0, 4).map((tag, index) => (
                        <span
                          key={index}
                          className="text-[11px] px-2.5 py-1 rounded bg-[#F3F4F6] text-[#374151] group-hover:bg-white transition-colors whitespace-nowrap"
                          style={{ fontWeight: 500 }}
                        >
                          {tag}
                        </span>
                      ))}
                      {tags.length > 4 && (
                        <span
                          className="text-[11px] px-2.5 py-1 rounded bg-[#E5E7EB] text-[#6B7280] whitespace-nowrap"
                          style={{ fontWeight: 500 }}
                        >
                          +{tags.length - 4} more
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-[13px] text-[#9CA3AF]">No tags</span>
                  )}
                </div>
                
                {/* Tags Inline Editor */}
                {isEditingTags && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsEditingTags(false);
                      }}
                    />
                    <div className="absolute bottom-full left-0 right-0 mb-1 bg-white border border-[#E5E7EB] rounded-lg shadow-lg z-20 p-2" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1.5 flex-wrap px-2 py-1.5 border border-[#E5E7EB] rounded bg-white focus-within:border-[#93C5FD] transition-colors min-h-[36px]">
                        {tags.map((tag, index) => (
                          <div
                            key={index}
                            className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#F3F4F6] text-[#374151] hover:bg-[#E5E7EB] transition-colors"
                          >
                            <span className="text-[11px]" style={{ fontWeight: 500 }}>{tag}</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setTags(tags.filter((_, i) => i !== index));
                              }}
                              className="hover:text-[#EF4444] transition-colors"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                        <input
                          type="text"
                          placeholder={tags.length === 0 ? "Add tags..." : ""}
                          value={newTag}
                          onChange={(e) => setNewTag(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && newTag.trim() && tags.length < 5) {
                              setTags([...tags, newTag.trim()]);
                              setNewTag('');
                            } else if (e.key === 'Backspace' && newTag === '' && tags.length > 0) {
                              setTags(tags.slice(0, -1));
                            }
                          }}
                          className="flex-1 min-w-[120px] text-[12px] text-[#1F2937] outline-none bg-transparent placeholder:text-[#D1D5DB]"
                          autoFocus
                        />
                      </div>
                      <div className="flex items-center justify-between mt-1.5 px-1 text-[11px] text-[#9CA3AF]">
                        <span>↵ Enter to add</span>
                        {tags.length >= 5 && <span className="text-[#DC2626]">Max 5 tags</span>}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {addressModalType && (
        <AddressSelectionModal
          isOpen={true}
          onClose={() => setAddressModalType(null)}
          onSelect={handleAddressSelect}
          type={addressModalType}
          customerName={quoteDraft.customer?.name || 'Tri-County EMS Authority'}
          currentCustomer={{
            id: 'partner1',
            name: quoteDraft.customer?.name || 'Tri-County EMS Authority',
            type: 'Customer',
            location: quoteDraft.customer?.location || 'Torrance, CA',
          }}
          currentAddress={
            addressModalType === 'billing' ? selectedBillingAddress : selectedShippingAddress
          }
        />
      )}

      {showPaymentTermsLibrary && (
        <PaymentTermsLibrary
          isOpen={true}
          onClose={() => setShowPaymentTermsLibrary(false)}
          onSelect={handlePaymentTermsSelect}
          currentTermId="net30"
          customerName={quoteDraft.customer?.name || 'Tri-County EMS Authority'}
        />
      )}

      {showPaymentMethodDropdown && (
        <PaymentMethodSelectionModal
          isOpen={true}
          onClose={() => setShowPaymentMethodDropdown(false)}
          onSelect={setSelectedPaymentMethod}
          currentMethodId={selectedPaymentMethod.id}
          customerName={quoteDraft.customer?.name || 'Tri-County EMS Authority'}
        />
      )}

      {showRecipientsEditor && (
        <RecipientsSelectionModal
          isOpen={true}
          onClose={() => setShowRecipientsEditor(false)}
          onSelect={(recipients, primaryId, copyToCustomer) => {
            console.log('Selected recipients:', recipients, 'Primary:', primaryId, 'Copy to customer:', copyToCustomer);
            
            // Update selected recipients state
            setSelectedRecipientsData(recipients);
            setPrimaryRecipientId(primaryId);
            
            // Find the primary recipient and update quoteDraft
            const primaryRecipient = recipients.find((r: any) => r.id === primaryId);
            if (primaryRecipient) {
              onUpdate({
                primaryPoC: {
                  id: primaryRecipient.id,
                  name: primaryRecipient.name,
                  email: primaryRecipient.email,
                }
              });
            }
            
            setShowRecipientsEditor(false);
          }}
          currentCustomerId={quoteDraft.customer?.id || 'cust1'}
          currentCustomerName={quoteDraft.customer?.name || 'Toyota Motor Manufacturing'}
          selectedRecipients={selectedRecipientsData}
          primaryPoCId={primaryRecipientId}
        />
      )}

      {editingDateCard && (
        <DateEditModal
          type={editingDateCard}
          isOpen={true}
          onClose={() => setEditingDateCard(null)}
          onSave={(config) => {
            if (editingDateCard === 'request') {
              setRequestDateType(config.dateType);
              if (config.dateType === 'absolute') {
                onUpdate({
                  configuration: {
                    ...quoteDraft.configuration,
                    validUntil: config.absoluteValue,
                  },
                });
              } else {
                setRelativeRequestDays(config.relativeValue);
                setRequestUnit(config.relativeUnit);
              }
            } else if (editingDateCard === 'effective') {
              setEffectiveWhenSent(config.whenSent);
              if (!config.whenSent) {
                setValidUntilType(config.dateType);
                if (config.dateType === 'absolute') {
                  onUpdate({
                    configuration: {
                      ...quoteDraft.configuration,
                      validUntil: config.absoluteValue,
                    },
                  });
                } else {
                  setRelativeValidDays(config.relativeValue);
                  setValidUntilUnit(config.relativeUnit);
                }
              }
            } else if (editingDateCard === 'expiry') {
              setHasExpiry(config.hasExpiry);
              if (config.hasExpiry) {
                setExpiryType(config.dateType);
                if (config.dateType === 'absolute') {
                  onUpdate({
                    configuration: {
                      ...quoteDraft.configuration,
                      expiryDate: config.absoluteValue,
                    },
                  });
                } else {
                  setRelativeExpiryDays(config.relativeValue);
                  setExpiryUnit(config.relativeUnit);
                }
              }
            }
          }}
          initialConfig={{
            dateType: editingDateCard === 'request' ? requestDateType : editingDateCard === 'effective' ? validUntilType : expiryType,
            absoluteValue: editingDateCard === 'request' 
              ? quoteDraft.configuration.validUntil || (() => { const d = new Date(); return `${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}/${d.getFullYear()}`; })()
              : editingDateCard === 'effective'
              ? quoteDraft.configuration.validUntil
              : quoteDraft.configuration.expiryDate,
            relativeValue: editingDateCard === 'request' ? relativeRequestDays : editingDateCard === 'effective' ? relativeValidDays : relativeExpiryDays,
            relativeUnit: editingDateCard === 'request' ? requestUnit : editingDateCard === 'effective' ? validUntilUnit : expiryUnit,
            whenSent: editingDateCard === 'effective' ? effectiveWhenSent : undefined,
            hasExpiry: editingDateCard === 'expiry' ? hasExpiry : undefined,
          }}
        />
      )}

      {showLocationModal && (
        <LocationSelectionModal
          isOpen={true}
          onClose={() => setShowLocationModal(false)}
          onSelect={setSelectedCustomerLocation}
          currentLocationId={selectedCustomerLocation.id}
          customerName={quoteDraft.customer?.name || 'Tri-County EMS Authority'}
          locations={CUSTOMER_LOCATIONS}
        />
      )}
    </>
  );
}