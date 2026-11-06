import { useState, useEffect } from 'react';
import { Package, Users, Flag, MapPin, Building2, Plus, Calendar, Info, DollarSign, FileText, Clock, Tag, Settings, Phone, Mail, Pencil, MapPinned, CreditCard, User, ArrowLeftRight, Edit2, Check } from 'lucide-react';
import { QuoteDraft } from '@/app/components/CreateQuoteModal';
import { TagsField } from '@/app/components/shared/EntityTagChip';
import { MOCK_CUSTOMERS } from '@/app/components/quote-creation/Step1CustomerSelection';
import { AddressSelectionModal } from '@/app/components/quote-creation/AddressSelectionModal';
import { PaymentTermsLibrary } from '@/app/components/quote-creation/PaymentTermsLibrary';
import { PricingRulesLibrary } from '@/app/components/quote-creation/PricingRulesLibrary';
import { RecipientsSelectionModal } from '@/app/components/quote-creation/RecipientsSelectionModal';
import { PaymentMethodSelectionModal } from '@/app/components/quote-creation/PaymentMethodSelectionModal';
import { DateConfigCards } from '@/app/components/quote-creation/DateConfigCards';
import { DateEditModal } from '@/app/components/quote-creation/DateEditModal';
import { Avatar } from '@/app/components/shared/Avatar';
import { LocationSelectionModal } from '@/app/components/quote-creation/LocationSelectionModal';
import { SalesRepSelector, SelectedSalesRep, SalesRepOption } from '@/app/components/shared/SalesRepSelector';
import { SALES_REP_ROSTER, CURRENT_USER_REP } from '@/app/components/shared/salesRepRoster';
import { SmallCard } from '@/app/components/shared/SmallCard';
import { SectionCard, SectionClearButton } from '@/app/components/shared/SectionCard';
import { ConfigRow } from '@/app/components/shared/ConfigRow';
import { toast } from 'sonner';
import { isSparseCustomer } from '@/app/components/shared/customerDefaults';
import { FIELD_RULES, FieldErrorText } from '@/app/components/shared/fieldRequirements';

interface Step2ConfigurationProps {
  quoteDraft: QuoteDraft;
  onUpdate: (updates: Partial<QuoteDraft>) => void;
  onClearAll?: () => void;
  /* When the parent modal is in full-view mode, Step 2 reflows the
     bottom two rows (date cards + priority/tags) into a right-side
     column. When false or undefined, everything stacks in a single
     column (the legacy layout). */
  isFullView?: boolean;
  /** True when the user tried to continue without a point of contact. */
  showPocError?: boolean;
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
  /* Net 30 — the canonical Partner-default term every customer
     inherits. The PaymentTermsLibrary now carries a row with the
     matching `net30` id so the trigger label, the highlighted row in
     the library, and the post-save term name all line up. */
  paymentTerms: 'Net 30',
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

export function Step2Configuration({ quoteDraft, onUpdate, onClearAll, isFullView = false, showPocError = false }: Step2ConfigurationProps) {
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
  
  /* Pull the picked customer's default location off MOCK_CUSTOMERS so
     a newly-created customer (which has its typed address as its lone
     location) seeds Bill To / Ship To with THAT address instead of
     the generic CUSTOMER_DEFAULTS placeholder. Falls back to defaults
     when no customer is picked. */
  const customerDefaultAddress: Address | null = (() => {
    const cid = quoteDraft.customer?.id;
    if (!cid) return null;
    const cust = MOCK_CUSTOMERS.find((c) => c.id === cid);
    const loc = cust?.locations?.find((l) => l.isDefault) || cust?.locations?.[0];
    if (!loc) return null;
    return {
      id: loc.id,
      label: loc.name,
      street: loc.address || '',
      city: loc.city || '',
      state: '',
      zip: '',
      country: 'United States',
      isDefault: true,
    } as Address;
  })();

  /* A name-only customer (Partners only requires a name) has no
     address, terms or method on file. Those fields start empty and
     render their FIELD_RULES empty state instead of the placeholder
     defaults every other customer gets. */
  const sparse = isSparseCustomer(quoteDraft.customer?.name);
  const customerRecord = MOCK_CUSTOMERS.find((c) => c.id === quoteDraft.customer?.id);
  const customerHasLocations = customerRecord ? customerRecord.locations.length > 0 : true;

  // Address selection state
  const [addressModalType, setAddressModalType] = useState<'billing' | 'shipping' | null>(null);
  const [selectedBillingAddress, setSelectedBillingAddress] = useState<Address | null>(
    sparse ? null : (customerDefaultAddress ?? CUSTOMER_DEFAULTS.billingAddress)
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
  const [selectedShippingAddress, setSelectedShippingAddress] = useState<Address | null>(
    sparse ? null : (customerDefaultAddress ?? CUSTOMER_DEFAULTS.shippingAddress)
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
  const [selectedPaymentTerms, setSelectedPaymentTerms] = useState(sparse ? '' : CUSTOMER_DEFAULTS.paymentTerms);
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

  const [selectedCustomerLocation, setSelectedCustomerLocation] = useState<{ id: string; name: string; address: string; isDefault: boolean } | null>(sparse ? null : {
    id: 'loc1',
    name: 'Torrance, CA (Headquarters)',
    address: '2972 Westheimer Rd. Santa Ana, Illinois 85486',
    isDefault: true,
  });

  /* Multiple sales reps support. Initialize from the draft if the user
     has already opened-and-edited Step 2 (so navigating Step 2 → Step 3
     → Step 2 doesn't drop their selection), else default to the current
     user picked from the shared roster so the same id flows into the
     detail sidebar after creation. */
  const [selectedSalesReps, setSelectedSalesReps] = useState<SelectedSalesRep[]>(() => {
    const fromDraft = quoteDraft.salesReps;
    if (fromDraft && fromDraft.length > 0) return fromDraft;
    return [{
      id: CURRENT_USER_REP.id,
      name: CURRENT_USER_REP.name,
      initials: CURRENT_USER_REP.initials,
      isPrimary: true,
      isCurrentUser: true,
      isCustomerDefault: false,
    }];
  });

  /* Sync rep selection back into the draft on every change so the
     final create handler reads what the user actually chose instead of
     the prior hardcoded "Unassigned" fallback. */
  useEffect(() => {
    onUpdate({ salesReps: selectedSalesReps });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSalesReps]);

  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<{ id: string; name: string; icon: string } | null>(sparse ? null : {
    id: 'ach',
    name: 'ACH/Direct Deposit',
    icon: 'CreditCard',
  });

  /* Carry the commercial terms onto the draft so the saved quote, and
     therefore the detail page, shows what was picked here. '' means
     "not set" and renders the field's empty state downstream. */
  useEffect(() => {
    const fmt = (a: Address | null) => (a ? [a.street, a.city].filter(Boolean).join(', ') : '');
    onUpdate({
      commercial: {
        billingAddress: fmt(selectedBillingAddress),
        shippingAddress: fmt(selectedShippingAddress),
        paymentTerms: selectedPaymentTerms || '',
        paymentMethod: selectedPaymentMethod?.name || '',
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBillingAddress, selectedShippingAddress, selectedPaymentTerms, selectedPaymentMethod]);

  /* Mock sales rep roster sourced from the shared module so the ids
     match the detail sidebar's picker. */
  const AVAILABLE_SALES_REPS: SalesRepOption[] = SALES_REP_ROSTER.map((r) => ({
    id: r.id,
    name: r.name,
    initials: r.initials,
    isCurrentUser: !!r.isCurrentUser,
    isCustomerDefault: false,
  }));

  /* Mock customer locations — enriched with POC counts + a flagged
     primary contact so the LocationCard chrome reads as a real
     directory card instead of a placeholder. Items count is left
     unset on purpose: the card no longer surfaces it. */
  const CUSTOMER_LOCATIONS = [
    {
      id: 'loc1',
      name: 'Torrance, CA (Headquarters)',
      address: '2972 Westheimer Rd. Santa Ana, Illinois 85486',
      city: 'Torrance',
      state: 'CA',
      isDefault: true,
      status: 'active' as const,
      type: 'Customer' as const,
      contacts: 12,
      pocCount: 12,
      primaryContact: 'Sarah Chen',
      phone: '+1 (310) 555-0110',
      lastUpdated: 'Apr 12, 2026',
    },
    {
      id: 'loc2',
      name: 'Chicago, IL (Manufacturing Plant)',
      address: '4521 Industrial Way, Chicago, IL 60601',
      city: 'Chicago',
      state: 'IL',
      isDefault: false,
      status: 'active' as const,
      type: 'Customer' as const,
      contacts: 8,
      pocCount: 8,
      primaryContact: 'David Park',
      phone: '+1 (312) 555-0210',
      lastUpdated: 'Mar 28, 2026',
    },
    {
      id: 'loc3',
      name: 'Austin, TX (Distribution Center)',
      address: '789 Warehouse Blvd, Austin, TX 78701',
      city: 'Austin',
      state: 'TX',
      isDefault: false,
      status: 'active' as const,
      type: 'Customer' as const,
      contacts: 5,
      pocCount: 5,
      primaryContact: 'Marcus Webb',
      phone: '+1 (512) 555-0310',
      lastUpdated: 'Feb 18, 2026',
    },
    {
      id: 'loc4',
      name: 'Seattle, WA (Regional Office)',
      address: '123 Tech Drive, Seattle, WA 98101',
      city: 'Seattle',
      state: 'WA',
      isDefault: false,
      status: 'active' as const,
      type: 'Customer' as const,
      contacts: 6,
      pocCount: 6,
      primaryContact: 'Linda Patel',
      phone: '+1 (206) 555-0410',
      lastUpdated: 'Jan 30, 2026',
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
      { bg: 'var(--accent)', text: 'var(--primary)' }, // Blue
      { bg: '#FED7AA', text: '#9A3412' }, // Orange
      { bg: '#C7D2FE', text: 'var(--primary)' }, // Indigo
      { bg: 'rgba(220, 38, 38, 0.4)', text: 'var(--destructive)' }, // Red
      { bg: 'rgba(5, 150, 105, 0.15)', text: 'var(--success-foreground)' }, // Green
      { bg: '#E9D5FF', text: 'var(--primary)' }, // Purple
      { bg: '#FBCFE8', text: '#831843' }, // Pink
    ];
    const hash = initials.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  return (
    <>
      {/* Main Content - Gray Background */}
      <div className="flex-1 overflow-y-auto" style={{ backgroundColor: 'rgba(241, 245, 249, 0.4)' }}>
        <div
          className="mx-auto"
          style={{
            /* Same canvas cap and padding as the Sales Order step, so the
               two creation views give their content the same width. */
            maxWidth: '1400px',
            padding: '20px 48px 16px 48px',
          }}
        >
          <div
            style={{
              display: 'grid',
              // Two columns when there's horizontal space, single column otherwise.
              gridTemplateColumns: isFullView ? 'minmax(0, 1fr) minmax(280px, 360px)' : 'minmax(0, 1fr)',
              gap: isFullView ? 16 : 12,
              alignItems: 'start',
            }}
          >
            {/* Left column — main customer + billing/shipping/payment card */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <SectionCard
              icon={Users}
              title="Selected Customer and Point of Contact"
              actions={<SectionClearButton onClick={onClearAll} />}
            >
                <div>
                  {/* Customer Details */}
                  <div className="flex items-start justify-between gap-6 mb-3">
                    {/* Left: Company Details */}
                    <div className="flex items-start gap-3 flex-1">
                      <div className="w-10 h-10 bg-muted/50 rounded flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-5 h-5 text-muted-foreground" />
                      </div>
                      
                      <div className="flex-1 min-w-0 relative">
                        <h3 className="text-[14px] text-foreground mb-1" style={{ fontWeight: 600 }}>
                          {quoteDraft.customer?.name || 'Toyota Motor Manufacturing..'}
                        </h3>
                        <div className="flex items-center gap-2 mb-2">
                          <p className="text-[12px] text-muted-foreground">
                            {selectedCustomerLocation?.address || FIELD_RULES.customerAddress.emptyLabel}
                          </p>
                          {/* No locations on file means nothing to switch to. */}
                          {customerHasLocations && selectedCustomerLocation && (
                          <button
                            onClick={() => setShowLocationModal(true)}
                            className="flex-shrink-0 flex items-center gap-1 hover:opacity-80 transition-opacity"
                            style={{ borderBottom: '1px dotted var(--primary)' }}
                          >
                            <ArrowLeftRight className="w-3 h-3 text-primary" />
                            <span className="text-[11px] text-primary" style={{ fontWeight: 500 }}>
                              Change
                            </span>
                          </button>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] bg-primary/8 text-primary whitespace-nowrap shrink-0" style={{ fontWeight: 600 }}>
                            Customer
                          </span>
                          {selectedCustomerLocation?.isDefault && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] bg-primary/8 text-primary whitespace-nowrap shrink-0" style={{ fontWeight: 600 }}>
                              {selectedCustomerLocation.name.split('(')[0].trim()}
                            </span>
                          )}
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] whitespace-nowrap shrink-0" style={{ fontWeight: 600, backgroundColor: '#ECFDF5', color: '#065F46' }}>
                            Active
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Right: Contact Information. Hidden for a name-only
                        customer: there is no phone or email on file and
                        the placeholder numbers would read as real data. */}
                    {!sparse && (
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                        <Phone className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground" />
                        <span>(390) 412-9011</span>
                      </div>
                      <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                        <Phone className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground" />
                        <span>(928) 630-9272</span>
                        <span className="text-muted-foreground text-[11px]">Ext. 789</span>
                      </div>
                      <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                        <Mail className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground" />
                        <span>business@toyota.technical.com</span>
                      </div>
                    </div>
                    )}
                  </div>
                  
                  {/* Recipients Row */}
                  {selectedRecipientsData.length > 0 && (
                    <div 
                      className="flex items-center gap-3 p-3 rounded-md border border-border hover:border-accent hover:bg-accent mt-4 cursor-pointer group transition-all"
                      onClick={() => setShowRecipientsEditor(true)}
                      style={{
                        transition: 'all 150ms ease',
                      }}
                    >
                      <label className="text-[13px] text-muted-foreground" style={{ fontWeight: 400 }}>
                        Point of contacts
                      </label>
                      
                      <div className="flex items-center gap-3 flex-1">
                        {/* Primary Recipient - Filled Pill */}
                        {(() => {
                          const primaryRecipient = selectedRecipientsData.find(r => r.id === primaryRecipientId) || selectedRecipientsData[0];
                          return (
                            <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-muted group-hover:bg-white transition-colors" style={{ transition: 'all 150ms ease' }}>
                              <Avatar
                                name={primaryRecipient.name}
                                size={32}
                                initials={primaryRecipient.initials}
                              />
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[13px] text-foreground" style={{ fontWeight: 500 }}>
                                    {primaryRecipient.name}
                                  </span>
                                  <span className="inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs whitespace-nowrap shrink-0 bg-primary text-white" style={{ fontWeight: 500 }}>
                                    Primary
                                  </span>
                                </div>
                                <p className="text-[11px] text-muted-foreground">{primaryRecipient.title}</p>
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
                              .map((recipient, idx) => (
                                <span
                                  key={recipient.id}
                                  className="cursor-pointer transition-transform hover:z-10 hover:scale-110"
                                  style={{
                                    marginLeft: idx === 0 ? '0' : '-10px',
                                    boxShadow: '0 0 0 2px var(--card)',
                                    borderRadius: '50%',
                                    display: 'inline-flex',
                                  }}
                                  title={`${recipient.name} - ${recipient.title}`}
                                >
                                  <Avatar name={recipient.name} size={32} initials={recipient.initials} />
                                </span>
                              ))
                            }
                            {/* +X more badge */}
                            {selectedRecipientsData.length > 4 && (
                              <div 
                                className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-[11px] text-white cursor-pointer hover:bg-primary/90 transition-colors border-2 border-white" 
                                style={{ fontWeight: 600, marginLeft: '-10px' }}
                                title={`${selectedRecipientsData.length - 4} more recipient${selectedRecipientsData.length - 4 > 1 ? 's' : ''}`}
                              >
                                +{selectedRecipientsData.length - 4}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Pencil aligned with sidebar HoverEditRow + Partner
                          Management convention: slate-300 default, primary
                          on row hover. Matches the same affordance used
                          everywhere else in both modules. */}
                      <Pencil className="w-3.5 h-3.5 text-slate-300 group-hover:text-primary transition-colors" />
                    </div>
                  )}

                  {/* Empty point of contact row. A customer can be picked
                      with no contact on file, which used to leave no way
                      to see why Continue did nothing. */}
                  {selectedRecipientsData.length === 0 && (
                    <div className="mt-4" data-field="poc">
                      <div
                        role="button"
                        aria-invalid={showPocError}
                        aria-describedby={showPocError ? 'create-quote-poc-error' : undefined}
                        className={`flex items-center gap-3 p-3 rounded-md border cursor-pointer group transition-all ${
                          showPocError
                            ? 'border-red-400 hover:border-red-500 shadow-[0_0_0_3px_rgba(239,68,68,0.12)]'
                            : 'border-border hover:border-accent hover:bg-accent'
                        }`}
                        onClick={() => setShowRecipientsEditor(true)}
                      >
                        <label className="text-[13px] text-muted-foreground cursor-pointer" style={{ fontWeight: 400 }}>
                          Point of contacts
                        </label>
                        <span className="flex-1 text-[13px] text-slate-400">{FIELD_RULES.poc.emptyLabel}</span>
                        <Pencil className="w-3.5 h-3.5 text-slate-300 group-hover:text-primary transition-colors" />
                      </div>
                      {showPocError && (
                        <FieldErrorText id="create-quote-poc-error">
                          {FIELD_RULES.poc.missingMessage}
                        </FieldErrorText>
                      )}
                    </div>
                  )}
                </div>

            </SectionCard>

            <SectionCard icon={CreditCard} title="Billing, Shipping & Payment Configurations">
                <div>

                  {/* Bill to & Ship to — SO V5 sidebar card pattern (avatar chip + Maps link) */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    {/* Bill to */}
                    <div
                      className="cursor-pointer group rounded-xl border border-border bg-white hover:bg-[#F0F7FF] transition-all relative"
                      style={{ padding: '10px 12px', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}
                      onClick={() => setAddressModalType('billing')}
                    >
                      <div className="flex flex-col" style={{ paddingRight: 20 }}>
                        <div className="flex items-center gap-1.5 mb-2">
                          <CreditCard style={{ width: 13, height: 13, color: '#94A3B8', flexShrink: 0 }} />
                          <span style={{ fontSize: 11, fontWeight: 500, color: '#64748B' }}>Bill To</span>
                          <Info className="text-slate-300" style={{ width: 12, height: 12 }} />
                        </div>
                        {!selectedBillingAddress ? (
                          /* Optional and empty: neutral empty state, card
                             stays clickable to add one. */
                          <span className="text-[12px] text-muted-foreground" data-field="billTo">
                            {FIELD_RULES.billTo.emptyLabel}
                          </span>
                        ) : (<>
                        <div className="flex items-center gap-2 mb-1.5">
                          <div style={{ width: 24, height: 24, borderRadius: 6, backgroundColor: '#6366F1', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <span style={{ fontSize: 9, fontWeight: 700, color: '#FFFFFF' }}>
                              {(selectedBillingPartner.name || 'BT').split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                            </span>
                          </div>
                          <span className="text-[13px] text-foreground truncate" style={{ fontWeight: 600 }} title={selectedBillingPartner.name}>
                            {selectedBillingPartner.name}
                          </span>
                        </div>
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${selectedBillingAddress.street}, ${selectedBillingAddress.city}, ${selectedBillingAddress.country}`)}`}
                          target="_blank" rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-start gap-1.5 text-[11px] text-[#64748B] hover:text-primary hover:underline transition-colors leading-snug"
                        >
                          <MapPinned style={{ width: 12, height: 12, flexShrink: 0, marginTop: 2, color: '#94A3B8' }} />
                          <span>{selectedBillingAddress.street}, {selectedBillingAddress.city}, {selectedBillingAddress.country}</span>
                        </a>
                        {selectedBillingAddress.isDefault && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] bg-primary/8 text-primary whitespace-nowrap shrink-0 mt-1.5 self-start" style={{ fontWeight: 600 }}>
                            Default
                          </span>
                        )}
                        </>)}
                      </div>
                      <Pencil className="absolute top-2.5 right-2.5 w-3.5 h-3.5 text-slate-300 group-hover:text-primary transition-colors" />
                    </div>

                    {/* Ship to */}
                    <div
                      className="cursor-pointer group rounded-xl border border-border bg-white hover:bg-[#F0F7FF] transition-all relative"
                      style={{ padding: '10px 12px', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}
                      onClick={() => setAddressModalType('shipping')}
                    >
                      <div className="flex flex-col" style={{ paddingRight: 20 }}>
                        <div className="flex items-center gap-1.5 mb-2">
                          <Package style={{ width: 13, height: 13, color: '#94A3B8', flexShrink: 0 }} />
                          <span style={{ fontSize: 11, fontWeight: 500, color: '#64748B' }}>Ship To</span>
                          <Info className="text-slate-300" style={{ width: 12, height: 12 }} />
                        </div>
                        {!selectedShippingAddress ? (
                          /* Optional and empty: neutral empty state, card
                             stays clickable to add one. */
                          <span className="text-[12px] text-muted-foreground" data-field="shipTo">
                            {FIELD_RULES.shipTo.emptyLabel}
                          </span>
                        ) : (<>
                        <div className="flex items-center gap-2 mb-1.5">
                          <div style={{ width: 24, height: 24, borderRadius: 6, backgroundColor: '#6366F1', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <span style={{ fontSize: 9, fontWeight: 700, color: '#FFFFFF' }}>
                              {(selectedShippingPartner.name || 'ST').split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                            </span>
                          </div>
                          <span className="text-[13px] text-foreground truncate" style={{ fontWeight: 600 }} title={selectedShippingPartner.name}>
                            {selectedShippingPartner.name}
                          </span>
                        </div>
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${selectedShippingAddress.street}, ${selectedShippingAddress.city}, ${selectedShippingAddress.country}`)}`}
                          target="_blank" rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-start gap-1.5 text-[11px] text-[#64748B] hover:text-primary hover:underline transition-colors leading-snug"
                        >
                          <MapPinned style={{ width: 12, height: 12, flexShrink: 0, marginTop: 2, color: '#94A3B8' }} />
                          <span>{selectedShippingAddress.street}, {selectedShippingAddress.city}, {selectedShippingAddress.country}</span>
                        </a>
                        {selectedShippingAddress.isDefault && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] bg-primary/8 text-primary whitespace-nowrap shrink-0 mt-1.5 self-start" style={{ fontWeight: 600 }}>
                            Default
                          </span>
                        )}
                        </>)}
                      </div>
                      <Pencil className="absolute top-2.5 right-2.5 w-3.5 h-3.5 text-slate-300 group-hover:text-primary transition-colors" />
                    </div>
                  </div>

                  {/* Payment Details — one shared row for all three, so the
                      label, value, pencil, spacing and hover area match. */}
                  <div className="space-y-1">
                    <ConfigRow
                      label="Payment terms"
                      value={selectedPaymentTerms}
                      emptyLabel={FIELD_RULES.paymentTerms.emptyLabel}
                      onClick={() => setShowPaymentTermsLibrary(true)}
                    />

                    <ConfigRow
                      label="Payment method"
                      leading={<CreditCard className="w-3.5 h-3.5 text-primary" />}
                      value={selectedPaymentMethod?.name}
                      emptyLabel={FIELD_RULES.paymentMethod.emptyLabel}
                      onClick={() => setShowPaymentMethodDropdown(true)}
                    />

                    <ConfigRow label="Sales Representative" pencil={false}>
                      <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
                        <SalesRepSelector
                          availableReps={AVAILABLE_SALES_REPS}
                          selectedReps={selectedSalesReps}
                          onSelectedRepsChange={setSelectedSalesReps}
                          dropdownDirection="up"
                          label=""
                          affordance="pencil"
                        />
                      </div>
                    </ConfigRow>
                  </div>
                </div>
            </SectionCard>
            </div>
            {/* Right column — date trio + priority/tags. Stacks under the left
                column when isFullView === false (single-column grid). */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Date Cards - Outside white card, matching width */}
            <DateConfigCards
              /* The priority cell sits in the dates row as its fourth column. */
              trailingElement={(
              <div className="relative">
                <SmallCard
                  icon={Flag}
                  variant="field"
                  title="Priority"
                  onClick={() => setIsEditingPriority(!isEditingPriority)}
                >
                  <span
                    className={`inline-flex text-[11px] px-2.5 py-1 rounded ${
                      priority === 'high' ? 'bg-[#FEE2E2] text-destructive' :
                      priority === 'low' ? 'bg-muted text-foreground' :
                      'bg-accent text-primary'
                    }`}
                    style={{ fontWeight: 500 }}
                  >
                    {priority === 'high' ? 'High' : priority === 'low' ? 'Low' : 'Standard'}
                  </span>
                </SmallCard>

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
                    <div className="absolute bottom-full left-0 mb-1 bg-white border border-border rounded-lg shadow-lg z-20 overflow-hidden" style={{ minWidth: '140px' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPriority('high');
                          setIsEditingPriority(false);
                        }}
                        className={`w-full px-3 py-2.5 text-left text-[13px] transition-colors flex items-center justify-between ${
                          priority === 'high' ? 'bg-destructive/10' : 'hover:bg-[#F0F7FF]'
                        }`}
                      >
                        <span className="text-[11px] px-2.5 py-1 rounded bg-[#FEE2E2] text-destructive" style={{ fontWeight: 500 }}>High</span>
                        {priority === 'high' && <Check className="w-3.5 h-3.5 text-destructive" />}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPriority('standard');
                          setIsEditingPriority(false);
                        }}
                        className={`w-full px-3 py-2.5 text-left text-[13px] transition-colors flex items-center justify-between border-t border-border ${
                          priority === 'standard' ? 'bg-accent' : 'hover:bg-[#F0F7FF]'
                        }`}
                      >
                        <span className="text-[11px] px-2.5 py-1 rounded bg-accent text-primary" style={{ fontWeight: 500 }}>Standard</span>
                        {priority === 'standard' && <Check className="w-3.5 h-3.5 text-primary" />}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPriority('low');
                          setIsEditingPriority(false);
                        }}
                        className={`w-full px-3 py-2.5 text-left text-[13px] transition-colors flex items-center justify-between border-t border-border ${
                          priority === 'low' ? 'bg-muted/50' : 'hover:bg-[#F0F7FF]'
                        }`}
                      >
                        <span className="text-[11px] px-2.5 py-1 rounded bg-muted text-foreground" style={{ fontWeight: 500 }}>Low</span>
                        {priority === 'low' && <Check className="w-3.5 h-3.5 text-foreground" />}
                      </button>
                    </div>
                  </>
                )}
              </div>
              )}
              isStacked={isFullView}
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
              /* Inline date picker for the absolute-only common case.
                 Saves a date directly without spinning up the full
                 DateEditModal. The Advanced settings link inside the
                 popover still routes to the modal for relative/toggle
                 configuration. */
              onSimpleDateChange={(card, date) => {
                const mm = String(date.getMonth() + 1).padStart(2, '0');
                const dd = String(date.getDate()).padStart(2, '0');
                const formatted = `${mm}/${dd}/${date.getFullYear()}`;
                if (card === 'request' || card === 'effective') {
                  onUpdate({
                    configuration: {
                      ...quoteDraft.configuration,
                      validUntil: formatted,
                    },
                  });
                } else {
                  onUpdate({
                    configuration: {
                      ...quoteDraft.configuration,
                      expiryDate: formatted,
                    },
                  });
                }
              }}
            />

            {/* Tags: a complete row, the same field the Sales Order creation
                modal uses, so the two read identically. */}
            <div className="mt-3">
              <TagsField tags={tags} onChange={setTags} label="Tags" />
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
          currentTermId={selectedPaymentTerms || undefined}
          customerName={quoteDraft.customer?.name || 'Tri-County EMS Authority'}
        />
      )}

      {showPaymentMethodDropdown && (
        <PaymentMethodSelectionModal
          isOpen={true}
          onClose={() => setShowPaymentMethodDropdown(false)}
          onSelect={setSelectedPaymentMethod}
          currentMethodId={selectedPaymentMethod?.id}
          customerName={quoteDraft.customer?.name || 'Tri-County EMS Authority'}
        />
      )}

      {showRecipientsEditor && (
        <RecipientsSelectionModal
          isOpen={true}
          onClose={() => setShowRecipientsEditor(false)}
          onSelect={(recipients, primaryId, copyToCustomer) => {
            /* The recipients list must always have at least one
               contact — without a primary POC the quote has nobody
               to send to. */
            if (recipients.length === 0) {
              toast.error('Pick at least one contact to keep the quote addressable.', { position: 'top-right' });
              return;
            }

            console.log('Selected recipients:', recipients, 'Primary:', primaryId, 'Copy to customer:', copyToCustomer);

            setSelectedRecipientsData(recipients);
            setPrimaryRecipientId(primaryId);

            const primaryRecipient = recipients.find((r: any) => r.id === primaryId);
            if (primaryRecipient) {
              onUpdate({
                primaryPoC: {
                  id: primaryRecipient.id,
                  name: primaryRecipient.name,
                  email: primaryRecipient.email,
                },
                /* Keep the draft's roster in step with what was picked
                   here so additional contacts survive into the saved
                   quote. */
                recipients: recipients.map((r: any) => ({ ...r, isPrimary: r.id === primaryId })),
              });
            }

            setShowRecipientsEditor(false);
          }}
          currentCustomerId={quoteDraft.customer?.id || 'cust1'}
          currentCustomerName={quoteDraft.customer?.name || 'Toyota Motor Manufacturing'}
          currentLocationId={selectedCustomerLocation?.id || ''}
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
          currentLocationId={selectedCustomerLocation?.id || ''}
          customerName={quoteDraft.customer?.name || 'Tri-County EMS Authority'}
          locations={CUSTOMER_LOCATIONS}
        />
      )}
    </>
  );
}