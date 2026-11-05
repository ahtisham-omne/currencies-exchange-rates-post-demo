// @ts-nocheck
import { useMemo } from "react";
import { SearchOverlay } from "./SearchOverlayQuoteStyle";
import { MOCK_CUSTOMERS, type Customer, type POC } from "./CreateSOModal";

/* SO change-customer overlay — wraps the Quote-style SearchOverlay
   verbatim so the visual + interaction language is identical across
   modules. SO's `Customer` and `POC` mock shapes are adapted into the
   overlay's Contact/Customer/Location shapes inside this wrapper so
   the overlay component itself stays a black box.

   Public surface:
     · onSelectCustomer(customer) — sidebar then opens a location
       picker step
     · onSelectContact(customer, poc) — sidebar branches between the
       same-customer POC-override prompt and the different-customer
       location → confirm pipeline
*/

interface Props {
  open: boolean;
  currentCustomerName: string;
  onClose: () => void;
  onSelectCustomer: (customer: Customer) => void;
  onSelectContact: (customer: Customer, poc: POC) => void;
  /** Fired when the user clicks "Create new …" inside the overlay. */
  onAddNew?: (tab: 'all' | 'customers' | 'contacts' | 'locations', query: string) => void;
}

export function ChangeCustomerModal({
  open,
  currentCustomerName,
  onClose,
  onSelectCustomer,
  onSelectContact,
  onAddNew,
}: Props) {
  /* Build the adapter once. The overlay expects an ID-based lookup
     from contact → customer, so we maintain a parallel index here. */
  const { adaptedCustomers, adaptedContacts, pocLookup, customerLookup } = useMemo(() => {
    const customerLookup = new Map<string, Customer>();
    const pocLookup = new Map<string, { customer: Customer; poc: POC }>();
    const adaptedCustomers = MOCK_CUSTOMERS.map((c) => {
      customerLookup.set(c.id, c);
      return {
        id: c.id,
        name: c.name,
        logo: c.initials,
        status: 'Active' as const,
        locations: (c.locations || []).map((l) => ({
          id: l.id,
          name: l.name,
          city: l.city,
          address: l.address,
          isDefault: l.isDefault,
        })),
        totalContacts: (c.pocs || []).length,
        recentQuote: '',
      };
    });
    const adaptedContacts: any[] = [];
    MOCK_CUSTOMERS.forEach((c) => {
      (c.pocs || []).forEach((p) => {
        pocLookup.set(p.id, { customer: c, poc: p });
        /* Map a POC's `role` (Quote's directory uses `title`) and
           derive sensible defaults for fields SO doesn't carry. */
        adaptedContacts.push({
          id: p.id,
          name: p.name,
          initials: p.initials,
          email: p.email,
          phone: p.phone || '',
          mobile: '',
          extension: p.extension || '',
          title: p.role || 'Contact',
          department: p.role?.split('|')[0]?.trim() || 'Contact',
          customerId: c.id,
          customerName: c.name,
          customerLogo: c.initials,
          locationId: p.locationId || (c.locations?.[0]?.id ?? ''),
          locationName: c.locations?.find((l) => l.id === p.locationId)?.name || c.locations?.[0]?.name || '',
          locationCity: c.locations?.find((l) => l.id === p.locationId)?.city || c.locations?.[0]?.city || '',
          locationAddress: c.locations?.find((l) => l.id === p.locationId)?.address || c.address,
          isPrimary: p.isPrimary,
        });
      });
    });
    return { adaptedCustomers, adaptedContacts, pocLookup, customerLookup };
  }, []);

  if (!open) return null;

  return (
    <SearchOverlay
      isOpen={open}
      onClose={onClose}
      customers={adaptedCustomers as any}
      contacts={adaptedContacts as any}
      currentCustomerName={currentCustomerName}
      hideLocationsTab
      onSelectCustomer={(adapted: any) => {
        const real = customerLookup.get(adapted.id);
        if (real) onSelectCustomer(real);
      }}
      onSelectContact={(contactRow: any) => {
        const entry = pocLookup.get(contactRow.id);
        if (entry) onSelectContact(entry.customer, entry.poc);
      }}
      onAddNew={onAddNew}
    />
  );
}
