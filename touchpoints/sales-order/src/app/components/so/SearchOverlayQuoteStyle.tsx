// @ts-nocheck
import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search, Building2, Mail, Phone, MapPin, Users as UsersIcon, Plus, X, Smartphone, FileText, MoreHorizontal } from 'lucide-react';
import { FIELD_RULES } from "@/app/components/shared/fieldRequirements";

interface Contact {
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

interface Location {
  id: string;
  name: string;
  city: string;
  address: string;
  isDefault: boolean;
}

interface Customer {
  id: string;
  name: string;
  logo: string;
  status: 'Active' | 'Inactive';
  locations: Location[];
  totalContacts: number;
  recentQuote: string;
}

interface SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCustomer: (customer: Customer) => void;
  onSelectContact: (contact: Contact) => void;
  onSelectLocation?: (location: Location & { customerId: string; customerName: string; customerLogo: string }) => void;
  initialSearchRect?: DOMRect | null;
  customers: Customer[];
  contacts: Contact[];
  currentCustomerName?: string;
  hideLocationsTab?: boolean;
  /** Fired when the user clicks the "Create new …" bottom CTA. */
  onAddNew?: (tab: TabType, query: string) => void;
}

type TabType = 'all' | 'customers' | 'locations' | 'contacts';

export function SearchOverlay({
  isOpen,
  onClose,
  onSelectCustomer,
  onSelectContact,
  onSelectLocation,
  initialSearchRect,
  customers,
  contacts,
  currentCustomerName,
  hideLocationsTab,
  onAddNew,
}: SearchOverlayProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [showInactive, setShowInactive] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  /* Per-customer-group expansion state. Each customer group starts
     out showing 8 contacts; clicking "Show N more" extends the
     visible count by another 8 (or by the remaining filtered count,
     whichever is smaller). Previously the "Show N more" button had
     no onClick and so did nothing. Reset whenever the search term
     or the active tab changes — a new query is a fresh slate. */
  const SHOW_MORE_STEP = 8;
  const [groupVisibleCount, setGroupVisibleCount] = useState<Record<string, number>>({});
  useEffect(() => {
    setGroupVisibleCount({});
  }, [searchQuery, activeTab]);
  const expandGroup = (customerId: string, totalFiltered: number) => {
    setGroupVisibleCount((prev) => {
      const current = prev[customerId] ?? SHOW_MORE_STEP;
      const next = Math.min(current + SHOW_MORE_STEP, totalFiltered);
      return { ...prev, [customerId]: next };
    });
  };

  // Simulate search delay
  useEffect(() => {
    if (searchQuery.trim()) {
      setIsSearching(true);
      const timer = setTimeout(() => {
        setIsSearching(false);
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setIsSearching(false);
    }
  }, [searchQuery]);

  // Auto-focus search input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        document.getElementById('overlay-search-input')?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Get recent customers and contacts (first 8 of each)
  const recentCustomers = useMemo(() => customers.slice(0, 8), [customers]);
  const recentContacts = useMemo(() => contacts.slice(0, 8), [contacts]);

  // Highlight search matches
  const highlightMatch = (text: string, query: string) => {
    if (!query) return <span>{text}</span>;
    
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return (
      <span>
        {parts.map((part, i) => 
          part.toLowerCase() === query.toLowerCase() ? (
            <mark key={i} style={{ backgroundColor: '#FEF08A', color: 'inherit', padding: 0 }}>{part}</mark>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </span>
    );
  };

  // Helper function to check if hidden fields match the query
  const checkHiddenFieldsMatch = (contact: Contact, query: string): number => {
    let matchCount = 0;
    
    // Check alternate emails
    if (contact.alternateEmails) {
      matchCount += contact.alternateEmails.filter(email => 
        email.toLowerCase().includes(query)
      ).length;
    }
    
    // Check alternate phones
    if (contact.alternatePhones) {
      matchCount += contact.alternatePhones.filter(phone => 
        phone.toLowerCase().includes(query)
      ).length;
    }
    
    // Check notes
    if (contact.notes && contact.notes.toLowerCase().includes(query)) {
      matchCount += 1;
    }
    
    // Check tags
    if (contact.tags) {
      matchCount += contact.tags.filter(tag => 
        tag.toLowerCase().includes(query)
      ).length;
    }
    
    return matchCount;
  };

  // Helper function to check if customer has hidden field matches (e.g., in locations, contacts)
  const checkCustomerHiddenFieldsMatch = (customer: Customer, query: string): boolean => {
    // Check if any non-default location matches
    const nonDefaultLocations = customer.locations.filter(l => !l.isDefault);
    return nonDefaultLocations.some(loc => 
      loc.name.toLowerCase().includes(query) ||
      loc.city.toLowerCase().includes(query) ||
      loc.address.toLowerCase().includes(query)
    );
  };

  // Search logic
  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return {
        customers: [],
        contactsByCustomer: [],
        locations: [] as (Location & { customerId: string; customerName: string; customerLogo: string })[],
      };
    }

    const filteredCustomers = customers.filter(customer =>
      customer.name.toLowerCase().includes(query) &&
      (showInactive || customer.status === 'Active')
    );

    // Location search - flatten all locations from all customers
    const filteredLocations = customers.flatMap(customer => {
      if (!showInactive && customer.status !== 'Active') return [];
      return customer.locations.filter(loc =>
        loc.name.toLowerCase().includes(query) ||
        loc.city.toLowerCase().includes(query) ||
        loc.address.toLowerCase().includes(query)
      ).map(loc => ({
        ...loc,
        customerId: customer.id,
        customerName: customer.name,
        customerLogo: customer.logo,
        customerTotalContacts: customer.totalContacts,
      }));
    });

    // For PoC tab, only show contacts that match the search term in their own fields
    // For All tab, show all contacts from matching customers
    const filteredContacts = contacts.filter(contact => {
      const matchesContact = 
        contact.name.toLowerCase().includes(query) ||
        contact.email.toLowerCase().includes(query) ||
        contact.title.toLowerCase().includes(query) ||
        contact.department.toLowerCase().includes(query) ||
        checkHiddenFieldsMatch(contact, query) > 0;
      
      const matchesCustomer = contact.customerName.toLowerCase().includes(query);
      const isActiveCustomer = showInactive || customers.find(c => c.id === contact.customerId)?.status === 'Active';
      
      if (activeTab === 'contacts') {
        // In PoC tab, only show contacts that match in their own fields
        return matchesContact && isActiveCustomer;
      } else {
        // In All tab, show contacts if they match OR their customer matches
        return (matchesContact || matchesCustomer) && isActiveCustomer;
      }
    });

    // Group contacts by customer
    const contactsByCustomer = customers
      .map(customer => ({
        customer,
        contacts: filteredContacts.filter(c => c.customerId === customer.id)
      }))
      .filter(group => group.contacts.length > 0);

    return {
      customers: activeTab === 'all' || activeTab === 'customers' ? filteredCustomers : [],
      contactsByCustomer: activeTab === 'all' || activeTab === 'contacts' ? contactsByCustomer : [],
      locations: (activeTab === 'all' || activeTab === 'locations') && !hideLocationsTab ? filteredLocations : [],
    };
  }, [searchQuery, activeTab, customers, contacts, showInactive, hideLocationsTab]);

  const totalResults = searchResults.customers.length + searchResults.contactsByCustomer.reduce((sum, group) => sum + group.contacts.length, 0) + searchResults.locations.length;

  // Get button text based on active tab
  const getAddNewButtonText = () => {
    if (activeTab === 'contacts') {
      return searchQuery 
        ? `Create a new point of contact '${searchQuery}'`
        : 'Create a new point of contact';
    }
    if (activeTab === 'locations') {
      return searchQuery
        ? `Add a new location '${searchQuery}'`
        : 'Add a new location';
    }
    // For 'all' and 'customers' tabs, show customer option
    return searchQuery 
      ? `Create a new customer '${searchQuery}'`
      : 'Create a new customer';
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 animate-in fade-in duration-200"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(2px)', zIndex: 10001 }}
        onClick={onClose}
      />

      {/* Search Overlay Container */}
      <div className="fixed inset-0 flex flex-col items-center pt-12 pb-12 px-4 pointer-events-none" style={{ zIndex: 10001 }}>
        <div className="w-full flex flex-col gap-3 pointer-events-auto animate-in fade-in zoom-in-95 duration-200" style={{ maxWidth: '1200px', maxHeight: 'calc(100vh - 96px)' }}>
          {/* Search Bar Section */}
          <div className="flex gap-3">
            <div
              className="flex-1 bg-white rounded-lg shadow-2xl px-3 py-2"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative flex items-center">
                <Search className="absolute left-0 w-4 h-4 text-muted-foreground" />
                <input
                  id="overlay-search-input"
                  type="text"
                  placeholder="Search for a customer or a point of contact..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full pl-8 pr-20 py-1 text-[13px] text-foreground bg-transparent focus:outline-none placeholder:text-muted-foreground"
                />
                <div className="absolute right-0 px-2 py-0.5 bg-muted border border-border rounded text-[11px] text-muted-foreground" style={{ fontWeight: 500 }}>
                  esc
                </div>
              </div>
            </div>
            
            {/* Close Button */}
            <button
              onClick={onClose}
              className="h-10 w-10 flex items-center justify-center bg-white hover:bg-[#F0F7FF] rounded-lg shadow-2xl transition-colors"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          {/* Results Section (Separate Box) */}
          <div
            className="bg-white rounded-xl shadow-2xl flex flex-col flex-1 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            style={{ minHeight: '500px' }}
          >
            {/* Tabs */}
            <div className="px-4 pt-3 flex gap-4 border-b border-border">
              <button
                onClick={() => setActiveTab('all')}
                className={`pb-2.5 px-1 text-[13px] transition-colors border-b-2 ${
                  activeTab === 'all'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
                style={{ fontWeight: activeTab === 'all' ? 600 : 400 }}
              >
                All
              </button>
              <button
                onClick={() => setActiveTab('customers')}
                className={`pb-2.5 px-1 text-[13px] transition-colors border-b-2 ${
                  activeTab === 'customers'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
                style={{ fontWeight: activeTab === 'customers' ? 600 : 400 }}
              >
                Customers
              </button>
              {!hideLocationsTab && (
                <button
                  onClick={() => setActiveTab('locations')}
                  className={`pb-2.5 px-1 text-[13px] transition-colors border-b-2 ${
                    activeTab === 'locations'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                  style={{ fontWeight: activeTab === 'locations' ? 600 : 400 }}
                >
                  Locations
                </button>
              )}
              <button
                onClick={() => setActiveTab('contacts')}
                className={`pb-2.5 px-1 text-[13px] transition-colors border-b-2 ${
                  activeTab === 'contacts'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
                style={{ fontWeight: activeTab === 'contacts' ? 600 : 400 }}
              >
                Point of Contact
              </button>
            </div>

            {/* Results Area */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-4">
                {/* Loading State */}
                {isSearching && (
                  <div className="flex items-center justify-center py-12">
                    <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
                      <div className="w-4 h-4 border-2 border-border border-t-[var(--primary)] rounded-full animate-spin"></div>
                      <span>Searching...</span>
                    </div>
                  </div>
                )}

                {/* Recent Results - Show when no search query */}
                {!searchQuery && !isSearching && (
                  <>
                    {/* Empty State - Centered */}
                    {recentCustomers.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-24">
                        <div className="w-16 h-16 mb-4 border-2 border-border rounded-lg flex items-center justify-center">
                          <FileText className="w-8 h-8 text-muted-foreground" strokeWidth={1.5} />
                        </div>
                        <p className="text-[13px] text-muted-foreground text-center">
                          Start typing to search for customers or contacts
                        </p>
                      </div>
                    )}
                  
                    {/* Recent Results */}
                    {recentCustomers.length > 0 && (
                      <div className="space-y-6">
                        {/* Recently Searched Customers */}
                        {(activeTab === 'all' || activeTab === 'customers') && (
                          <div>
                            <h3 className="text-[11px] text-muted-foreground mb-3 px-3" style={{ fontWeight: 500, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                              Recently Searched Customers
                            </h3>
                            <div className="space-y-1">
                              {recentCustomers.map(customer => {
                                const defaultLocation = customer.locations.find(l => l.isDefault) || customer.locations[0];
                                const isCurrent = currentCustomerName && customer.name === currentCustomerName;
                                
                                return (
                                  <button
                                    key={customer.id}
                                    onClick={() => {
                                      onSelectCustomer(customer);
                                      onClose();
                                    }}
                                    className={`w-full px-3 py-2 rounded-lg transition-colors text-left flex items-start gap-3 ${
                                      isCurrent
                                        ? 'bg-accent hover:bg-[#E7F1FF]'
                                        : 'hover:bg-[#F0F7FF]'
                                    }`}
                                  >
                                    {/* Company Logo — left stroke removed;
                                        the row backdrop + "CURRENT" badge
                                        carry the affordance instead. */}
                                    <div
                                      className="w-9 h-9 rounded flex items-center justify-center flex-shrink-0 text-white text-[12px]"
                                      style={{
                                        backgroundColor: '#7C3AED', fontWeight: 600,
                                      }}
                                    >
                                      {customer.logo}
                                    </div>
                                    
                                    {/* Customer Info */}
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                        <span className="text-[13px] text-foreground" style={{ fontWeight: 500 }}>
                                          {customer.name}
                                        </span>
                                        {isCurrent && (
                                          <span className="inline-flex items-center px-1.5 py-0.5 bg-accent text-primary rounded text-[9px]" style={{ fontWeight: 600 }}>
                                            CURRENT
                                          </span>
                                        )}
                                        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                                          <UsersIcon className="w-3 h-3" />
                                          {customer.totalContacts}
                                        </span>
                                      </div>
                                      <div className="text-[12px] text-muted-foreground">
                                        {defaultLocation?.address || FIELD_RULES.customerAddress.emptyLabel}
                                      </div>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Recently Engaged Contacts - Grouped by Customer */}
                        {(activeTab === 'all' || activeTab === 'contacts') && (
                          <div>
                            <h3 className="text-[11px] text-muted-foreground mb-3 px-3" style={{ fontWeight: 500, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                              Recent Point of Contacts
                            </h3>
                            <div className="space-y-4">
                              {recentCustomers.slice(0, 3).map(customer => {
                                const defaultLocation = customer.locations.find(l => l.isDefault) || customer.locations[0];
                                const customerContacts = contacts.filter(c => c.customerId === customer.id).slice(0, 4);
                                const remainingContactsCount = customer.totalContacts - 4;
                                
                                if (customerContacts.length === 0) return null;
                                
                                return (
                                  <div key={customer.id} className="space-y-2">
                                    {/* Customer Header */}
                                    <button
                                      onClick={() => {
                                        onSelectCustomer(customer);
                                        onClose();
                                      }}
                                      className="w-full px-3 py-2 hover:bg-[#F0F7FF] rounded-lg transition-colors text-left flex items-start gap-3"
                                    >
                                      {/* Company Logo */}
                                      <div
                                        className="w-9 h-9 rounded flex items-center justify-center flex-shrink-0 text-white text-[12px]"
                                        style={{ backgroundColor: '#7C3AED', fontWeight: 600 }}
                                      >
                                        {customer.logo}
                                      </div>
                                      
                                      {/* Customer Info */}
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                          <span className="text-[13px] text-foreground" style={{ fontWeight: 500 }}>
                                            {customer.name}
                                          </span>
                                          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                                            <UsersIcon className="w-3 h-3" />
                                            {customer.totalContacts}
                                          </span>
                                        </div>
                                        <div className="text-[12px] text-muted-foreground">
                                          {defaultLocation?.address || FIELD_RULES.customerAddress.emptyLabel}
                                        </div>
                                      </div>
                                    </button>

                                    {/* Contact Cards Grid */}
                                    <div className="pl-12 pr-3">
                                      <div className="grid grid-cols-4 gap-2 mb-2">
                                        {customerContacts.map(contact => (
                                          <button
                                            key={contact.id}
                                            onClick={() => {
                                              onSelectContact(contact);
                                              onClose();
                                            }}
                                            className="p-3 hover:bg-[#F0F7FF] border border-border rounded-lg transition-all text-left relative group/card hover:shadow-md"
                                          >
                                            {/* PRIMARY badge - upper right */}
                                            {contact.isPrimary && (
                                              <span className="absolute top-2 right-2 inline-flex items-center px-1 py-0.5 bg-accent text-primary rounded text-[9px]" style={{ fontWeight: 600 }}>
                                                PRIMARY
                                              </span>
                                            )}

                                            {/* More menu - bottom right */}
                                            <span
                                              className="absolute bottom-2 right-2 w-6 h-6 flex items-center justify-center rounded hover:bg-muted opacity-0 group-hover/card:opacity-100 transition-opacity"
                                              onClick={(e) => { e.stopPropagation(); }}
                                            >
                                              <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                                            </span>

                                            {/* Avatar + Name/Position Row */}
                                            <div className="flex items-center gap-2 mb-2">
                                              <div
                                                className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0 text-white text-[10px]"
                                                style={{ backgroundColor: 'var(--primary)', fontWeight: 600 }}
                                              >
                                                {contact.initials}
                                              </div>
                                              <div className="flex-1 min-w-0">
                                                <div className="text-[13px] text-foreground truncate" style={{ fontWeight: 500 }} title={contact.name}>
                                                  {contact.name}
                                                </div>
                                                <div className="text-[11px] text-muted-foreground truncate" title={`${contact.title} | ${contact.department}`}>
                                                  {contact.title} | {contact.department}
                                                </div>
                                              </div>
                                            </div>
                                            
                                            {/* Contact Details */}
                                            <div className="space-y-0.5">
                                              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                                <Phone className="w-3 h-3 flex-shrink-0" />
                                                <span className="truncate">{contact.phone}</span>
                                              </div>
                                              {contact.mobile && (
                                                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                                  <Smartphone className="w-3 h-3 flex-shrink-0" />
                                                  <span className="truncate">
                                                    {contact.mobile}
                                                    {contact.extension && <span className="text-muted-foreground"> Ext. {contact.extension}</span>}
                                                  </span>
                                                </div>
                                              )}
                                              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                                <Mail className="w-3 h-3 flex-shrink-0" />
                                                <span className="truncate">{contact.email}</span>
                                              </div>
                                            </div>
                                          </button>
                                        ))}
                                      </div>
                                      
                                      {/* Show more contacts link */}
                                      {remainingContactsCount > 0 && (
                                        <div className="flex items-center justify-between">
                                          <button className="text-[13px] text-primary hover:underline" style={{ fontWeight: 500 }}>
                                            Show {Math.min(remainingContactsCount, 20)} more
                                          </button>
                                          <span className="text-[11px] text-muted-foreground">
                                            {customer.totalContacts} total
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}

                {/* No Results */}
                {searchQuery && totalResults === 0 && !isSearching && (
                  <div>
                    {/* Show Inactive Toggle - Always visible during search */}
                    <div className="flex items-center justify-end px-4 mb-4">
                      <button
                        onClick={() => setShowInactive(!showInactive)}
                        className="flex items-center gap-2 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <div className={`w-7 h-4 rounded-full transition-colors relative ${
                          showInactive 
                            ? 'bg-primary' 
                            : 'bg-border'
                        }`}>
                          <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
                            showInactive ? 'translate-x-3.5' : 'translate-x-0.5'
                          }`}></div>
                        </div>
                        <span>Show Inactive</span>
                      </button>
                    </div>
                    
                    <div className="text-center py-12">
                      <p className="text-[13px] text-muted-foreground">
                        No results found for "{searchQuery}"
                      </p>
                    </div>
                  </div>
                )}

                {/* Search Results */}
                {!isSearching && searchQuery && totalResults > 0 && (
                  <div className="space-y-6">
                    {/* Results Header */}
                    <div className="flex items-center justify-between">
                      <div className="text-[12px] text-muted-foreground">
                        {/* Show specific count based on what's displayed */}
                        {activeTab === 'customers' && searchResults.customers.length > 0 && (
                          <>Showing {searchResults.customers.length} customer{searchResults.customers.length !== 1 ? 's' : ''} containing '{searchQuery}'</>
                        )}
                        {activeTab === 'contacts' && searchResults.contactsByCustomer.length > 0 && (
                          <>Showing {searchResults.contactsByCustomer.reduce((sum, group) => sum + group.contacts.length, 0)} point of contact{searchResults.contactsByCustomer.reduce((sum, group) => sum + group.contacts.length, 0) !== 1 ? 's' : ''} containing '{searchQuery}'</>
                        )}
                        {activeTab === 'locations' && searchResults.locations.length > 0 && (
                          <>Showing {searchResults.locations.length} location{searchResults.locations.length !== 1 ? 's' : ''} containing '{searchQuery}'</>
                        )}
                        {activeTab === 'all' && (
                          <>
                            {searchResults.customers.length > 0 && searchResults.contactsByCustomer.length === 0 && (
                              <>Showing {searchResults.customers.length} customer{searchResults.customers.length !== 1 ? 's' : ''} containing '{searchQuery}'</>
                            )}
                            {searchResults.customers.length === 0 && searchResults.contactsByCustomer.length > 0 && (
                              <>Showing {searchResults.contactsByCustomer.reduce((sum, group) => sum + group.contacts.length, 0)} point of contact{searchResults.contactsByCustomer.reduce((sum, group) => sum + group.contacts.length, 0) !== 1 ? 's' : ''} containing '{searchQuery}'</>
                            )}
                            {searchResults.customers.length > 0 && searchResults.contactsByCustomer.length > 0 && (
                              <>Showing {totalResults} result{totalResults !== 1 ? 's' : ''} containing '{searchQuery}'</>
                            )}
                          </>
                        )}
                      </div>
                      
                      {/* Show Inactive Toggle */}
                      <button
                        onClick={() => setShowInactive(!showInactive)}
                        className="flex items-center gap-2 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <div className={`w-7 h-4 rounded-full transition-colors relative ${
                          showInactive 
                            ? 'bg-primary' 
                            : 'bg-border'
                        }`}>
                          <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
                            showInactive ? 'translate-x-3.5' : 'translate-x-0.5'
                          }`}></div>
                        </div>
                        <span>Show Inactive</span>
                      </button>
                    </div>

                    {/* Customers Section */}
                    {searchResults.customers.length > 0 && (
                      <div>
                        <div className="space-y-0.5">
                          {searchResults.customers.slice(0, 8).map(customer => {
                            const defaultLocation = customer.locations.find(l => l.isDefault) || customer.locations[0];
                            const hasHiddenMatch = checkCustomerHiddenFieldsMatch(customer, searchQuery.trim().toLowerCase());
                            const isCurrent = currentCustomerName && customer.name === currentCustomerName;
                            
                            return (
                              <button
                                key={customer.id}
                                onClick={() => {
                                  onSelectCustomer(customer);
                                  onClose();
                                }}
                                className={`w-full px-3 py-2.5 rounded-lg transition-colors text-left flex items-start gap-3 ${
                                  isCurrent 
                                    ? 'bg-accent hover:bg-[#E7F1FF] border-l-[3px] border-l-primary' 
                                    : 'hover:bg-[#F0F7FF]'
                                }`}
                              >
                                {/* Company Logo */}
                                <div
                                  className="w-9 h-9 rounded flex items-center justify-center flex-shrink-0 text-white text-[12px]"
                                  style={{ 
                                    backgroundColor: '#7C3AED', fontWeight: 600,
                                    ...(isCurrent ? { boxShadow: '0 0 0 2px var(--primary)' } : {}),
                                  }}
                                >
                                  {customer.logo}
                                </div>
                                
                                {/* Customer Info */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                    <span className="text-[13px] text-foreground" style={{ fontWeight: 500 }}>
                                      {highlightMatch(customer.name, searchQuery)}
                                    </span>
                                    {isCurrent && (
                                      <span className="inline-flex items-center px-1.5 py-0.5 bg-accent text-primary rounded text-[9px]" style={{ fontWeight: 600 }}>
                                        CURRENT
                                      </span>
                                    )}
                                    {showInactive && (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-success/15 text-success-foreground rounded text-[10px]" style={{ fontWeight: 500 }}>
                                        <div className="w-1.5 h-1.5 rounded-full bg-success"></div>
                                        {customer.status}
                                      </span>
                                    )}
                                    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                                      <UsersIcon className="w-3 h-3" />
                                      {customer.totalContacts}
                                    </span>
                                  </div>
                                  <div className="text-[12px] text-muted-foreground flex items-center gap-1.5">
                                    <span>{defaultLocation?.address || FIELD_RULES.customerAddress.emptyLabel}</span>
                                    {hasHiddenMatch && (
                                      <span 
                                        className="text-[11px] text-[#78716C] px-1.5 py-0.5 rounded flex-shrink-0"
                                        style={{ backgroundColor: '#FEF08A', fontWeight: 400 }}
                                        title="Additional locations match your search"
                                      >
                                        ...
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                        {searchResults.customers.length > 8 && (
                          <button className="mt-2 text-[13px] text-primary hover:underline px-3" style={{ fontWeight: 500 }}>
                            See all {searchResults.customers.length} customers
                          </button>
                        )}
                      </div>
                    )}

                    {/* Locations Section */}
                    {searchResults.locations.length > 0 && (
                      <div>
                        {searchResults.customers.length > 0 && (
                          <div className="mb-3 px-3 text-[12px] text-muted-foreground">
                            Locations containing '{searchQuery}'
                          </div>
                        )}
                        <div className="space-y-0.5">
                          {searchResults.locations.slice(0, 20).map(location => (
                            <button
                              key={location.id}
                              onClick={() => {
                                onSelectLocation?.(location);
                                onClose();
                              }}
                              className="w-full px-3 py-2.5 hover:bg-[#F0F7FF] rounded-lg transition-colors text-left flex items-start gap-3"
                            >
                              {/* Location Icon */}
                              <div
                                className="w-9 h-9 rounded flex items-center justify-center flex-shrink-0"
                                style={{ backgroundColor: 'var(--muted)' }}
                              >
                                <MapPin className="w-4 h-4 text-muted-foreground" />
                              </div>
                              
                              {/* Location Info */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                  <span className="text-[13px] text-foreground" style={{ fontWeight: 500 }}>
                                    {highlightMatch(location.name, searchQuery)}
                                  </span>
                                  {location.isDefault && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 bg-success/15 text-success-foreground rounded text-[9px]" style={{ fontWeight: 600 }}>
                                      PRIMARY
                                    </span>
                                  )}
                                  {currentCustomerName && location.customerName === currentCustomerName && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 bg-accent text-primary rounded text-[9px]" style={{ fontWeight: 600 }}>
                                      CURRENT
                                    </span>
                                  )}
                                </div>
                                <div className="text-[12px] text-muted-foreground flex items-center gap-1">
                                  <span className="text-muted-foreground" style={{ fontWeight: 500 }}>{location.customerName}</span>
                                  <span>·</span>
                                  <span>{highlightMatch(location.address, searchQuery)}</span>
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                        {searchResults.locations.length > 20 && (
                          <button className="mt-2 text-[13px] text-primary hover:underline px-3" style={{ fontWeight: 500 }}>
                            See all {searchResults.locations.length} locations
                          </button>
                        )}
                      </div>
                    )}

                    {/* Contacts Section */}
                    {searchResults.contactsByCustomer.length > 0 && (
                      <div>
                        {searchResults.customers.length > 0 && (
                          <div className="mb-3 px-3 text-[12px] text-muted-foreground">
                            Point of contacts containing '{searchQuery}'
                          </div>
                        )}
                        <div className="space-y-0.5">
                          {searchResults.contactsByCustomer.slice(0, 20).map(group => (
                            <div key={group.customer.id} className="mb-4">
                              {/* Customer Header */}
                              <button
                                onClick={() => {
                                  onSelectCustomer(group.customer);
                                  onClose();
                                }}
                                className="w-full px-3 py-2.5 hover:bg-[#F0F7FF] rounded-lg transition-colors text-left flex items-start gap-3"
                              >
                                {/* Company Logo */}
                                <div
                                  className="w-9 h-9 rounded flex items-center justify-center flex-shrink-0 text-white text-[12px]"
                                  style={{ backgroundColor: '#7C3AED', fontWeight: 600 }}
                                >
                                  {group.customer.logo}
                                </div>
                                
                                {/* Customer Info */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                    <span className="text-[13px] text-foreground" style={{ fontWeight: 500 }}>
                                      {group.customer.name}
                                    </span>
                                    {showInactive && (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-success/15 text-success-foreground rounded text-[10px]" style={{ fontWeight: 500 }}>
                                        <div className="w-1.5 h-1.5 rounded-full bg-success"></div>
                                        {group.customer.status}
                                      </span>
                                    )}
                                    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                                      <UsersIcon className="w-3 h-3" />
                                      {group.customer.totalContacts}
                                    </span>
                                  </div>
                                  <div className="text-[12px] text-muted-foreground">
                                    {group.customer.locations.find(l => l.isDefault)?.address || group.customer.locations[0]?.address || FIELD_RULES.customerAddress.emptyLabel}
                                  </div>
                                </div>
                              </button>

                              {/* Contact Cards Grid */}
                              <div className="pl-12 pr-3">
                                <div className="grid grid-cols-4 gap-2 mb-2">
                                  {(() => {
                                    const visible = groupVisibleCount[group.customer.id] ?? SHOW_MORE_STEP;
                                    return group.contacts.slice(0, visible);
                                  })().map(contact => {
                                    const hiddenMatchCount = checkHiddenFieldsMatch(contact, searchQuery.trim().toLowerCase());
                                    
                                    return (
                                    <button
                                      key={contact.id}
                                      onClick={() => {
                                        onSelectContact(contact);
                                        onClose();
                                      }}
                                      className="p-3 hover:bg-[#F0F7FF] border border-border rounded-lg transition-all text-left relative group/card hover:shadow-md"
                                    >
                                    {/* PRIMARY badge - upper right */}
                                    {contact.isPrimary && (
                                      <span className="absolute top-2 right-2 inline-flex items-center px-1 py-0.5 bg-accent text-primary rounded text-[9px]" style={{ fontWeight: 600 }}>
                                        PRIMARY
                                      </span>
                                    )}

                                    {/* More menu - bottom right */}
                                    <span
                                      className="absolute bottom-2 right-2 w-6 h-6 flex items-center justify-center rounded hover:bg-muted opacity-0 group-hover/card:opacity-100 transition-opacity"
                                      onClick={(e) => { e.stopPropagation(); }}
                                    >
                                      <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                                    </span>

                                    {/* Avatar + Name/Position Row */}
                                    <div className="flex items-center gap-2 mb-2">
                                      <div
                                        className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0 text-white text-[10px]"
                                        style={{ backgroundColor: 'var(--primary)', fontWeight: 600 }}
                                      >
                                        {contact.initials}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="text-[13px] text-foreground truncate" style={{ fontWeight: 500 }} title={contact.name}>
                                          {highlightMatch(contact.name, searchQuery)}
                                        </div>
                                        <div className="text-[11px] text-muted-foreground truncate" title={`${contact.title} | ${contact.department}`}>
                                          {highlightMatch(contact.title, searchQuery)} | {highlightMatch(contact.department, searchQuery)}
                                        </div>
                                      </div>
                                    </div>
                                    
                                    {/* Contact Details */}
                                    <div className="space-y-0.5">
                                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                        <Phone className="w-3 h-3 flex-shrink-0" />
                                        <span className="truncate">{contact.phone}</span>
                                      </div>
                                      {contact.mobile && (
                                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                          <Smartphone className="w-3 h-3 flex-shrink-0" />
                                          <span className="truncate">
                                            {contact.mobile}
                                            {contact.extension && <span className="text-muted-foreground"> Ext. {contact.extension}</span>}
                                          </span>
                                        </div>
                                      )}
                                      {/* Email row with hidden field indicator on the right */}
                                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                        <Mail className="w-3 h-3 flex-shrink-0" />
                                        <span className="truncate flex-1" style={hiddenMatchCount > 0 ? { 
                                          maskImage: 'linear-gradient(to right, black 60%, transparent 100%)',
                                          WebkitMaskImage: 'linear-gradient(to right, black 60%, transparent 100%)'
                                        } : undefined}>
                                          {highlightMatch(contact.email, searchQuery)}
                                        </span>
                                        {hiddenMatchCount > 0 && (
                                          <span 
                                            className="text-[11px] text-[#78716C] px-1.5 py-0.5 rounded flex-shrink-0"
                                            style={{ backgroundColor: '#FEF08A', fontWeight: 400 }}
                                            title={`${hiddenMatchCount} additional field${hiddenMatchCount > 1 ? 's' : ''} match your search`}
                                          >
                                            ...
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </button>
                                    );
                                  })}
                                </div>
                                
                                {/* Show more contacts link — pagination
                                    that increments by SHOW_MORE_STEP each
                                    click. Previously this button had no
                                    onClick and showed `total - 8` as the
                                    remaining count, so it never extended
                                    the list. Now it surfaces the actual
                                    hidden remainder against the current
                                    search filter, and clicking reveals
                                    the next 8 contacts. */}
                                {(() => {
                                  const visible = groupVisibleCount[group.customer.id] ?? SHOW_MORE_STEP;
                                  const remaining = group.contacts.length - visible;
                                  if (remaining <= 0) return null;
                                  return (
                                    <div className="flex items-center justify-between">
                                      <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); expandGroup(group.customer.id, group.contacts.length); }}
                                        className="text-[13px] text-primary hover:underline cursor-pointer"
                                        style={{ fontWeight: 500 }}
                                      >
                                        Show {Math.min(remaining, SHOW_MORE_STEP)} more
                                      </button>
                                      <span className="text-[11px] text-muted-foreground">
                                        {visible} of {group.contacts.length}
                                      </span>
                                    </div>
                                  );
                                })()}
                              </div>
                            </div>
                          ))}
                        </div>
                        {searchResults.contactsByCustomer.length > 20 && (
                          <button className="mt-2 text-[13px] text-primary hover:underline px-3" style={{ fontWeight: 500 }}>
                            See all {searchResults.contactsByCustomer.reduce((sum, group) => sum + group.contacts.length, 0)} point of contacts
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Fixed Bottom "Add New" Button */}
            <div className="p-4 border-t border-border bg-white">
              <button
                type="button"
                onClick={() => onAddNew?.(activeTab, searchQuery.trim())}
                className="flex items-center gap-2 text-[13px] text-primary hover:underline cursor-pointer"
                style={{ fontWeight: 500 }}
              >
                <Plus className="w-4 h-4" />
                {getAddNewButtonText()}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}