/* PartnersShellPage — Partner Management new-tab shell.
 * Renders the verbatim Partner Management `VendorsListPage` as the
 * backdrop, with `CreatePartnerModal` / `CreateContactModal` /
 * `CreatePartnerLocationModal` mounted on top. When the URL params
 * specify an action, the matching create modal auto-opens. Mirrors
 * Partner Management's pattern: on submit we post the result to the
 * opener tab, fire the same `toast.success` PM fires from its list
 * page, then close the tab once the toast has had time to render. */
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { VendorsListPage } from './PartnersVendorsListPage';
import { CreatePartnerModal } from '../components/external/partners/CreatePartnerModal';
import { CreatePartnerLocationModal } from '../components/external/partners/CreatePartnerLocationModal';
import { CreateContactModal, type CreatedContactPayload } from '../components/external/partners/CreateContactModal';
import { postPartnerTabResult, type PartnerTabAction } from '../components/external/partners/openPartnerTab';
import { MOCK_CUSTOMERS } from '../components/quote-creation/Step1CustomerSelection';

function parseAddress(full: string) {
  const trimmed = (full || '').trim();
  if (!trimmed) return { street: '', city: '', state: '', zip: '', cityState: '', full: '' };
  const parts = trimmed.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 3) {
    const stateZip = parts[parts.length - 1];
    const city = parts[parts.length - 2];
    const street = parts.slice(0, parts.length - 2).join(', ');
    const stateZipMatch = stateZip.match(/^(\S+)\s+(\S+)$/);
    const state = stateZipMatch ? stateZipMatch[1] : stateZip;
    const zip = stateZipMatch ? stateZipMatch[2] : '';
    return { street, city, state, zip, cityState: `${city}, ${state}`, full: trimmed };
  }
  return { street: trimmed, city: '', state: '', zip: '', cityState: '', full: trimmed };
}

export function PartnersShellPage() {
  const [params] = useSearchParams();
  const action = (params.get('action') as PartnerTabAction | null) || null;
  const seed = params.get('seed') || '';
  const customerId = params.get('customerId') || '';
  const customerName = params.get('customerName') || '';

  const [customerOpen, setCustomerOpen] = useState(action === 'create-customer');
  const [pocOpen, setPocOpen] = useState(action === 'create-poc');
  const [locationOpen, setLocationOpen] = useState(action === 'create-location');

  const savingRef = useRef(false);

  useEffect(() => {
    if (!action) {
      toast.info('Open this page from Quote / SO to create a customer, contact, or location.');
    }
    document.title = 'Partner Management';
  }, [action]);

  // Mirror PM's list-page success path: post the IPC result to the
  // opener, fire the same toast PM fires, then give it ~900 ms to
  // render before closing the tab.
  const finishWith = (next: PartnerTabAction, payload: Record<string, unknown>, toastMessage: string) => {
    savingRef.current = true;
    postPartnerTabResult(next, payload);
    toast.success(toastMessage, { duration: 5000 });
    setTimeout(() => window.close(), 900);
  };

  return (
    <>
      <VendorsListPage />

      {customerOpen && (
        <CreatePartnerModal
          open={customerOpen}
          onOpenChange={(next) => {
            setCustomerOpen(next);
            if (!next && action === 'create-customer' && !savingRef.current) {
              setTimeout(() => window.close(), 60);
            }
          }}
          customerOnly
          seedName={seed}
          existingCustomers={MOCK_CUSTOMERS.map((c) => {
            const defLoc = c.locations.find((l) => l.isDefault) || c.locations[0];
            return {
              id: c.id,
              name: c.name,
              logo: c.logo,
              subtitle: defLoc ? `${defLoc.name} · ${defLoc.address || defLoc.city}` : undefined,
            };
          })}
          onUseExistingCustomer={(id, name) => {
            const existing = MOCK_CUSTOMERS.find((c) => c.id === id);
            if (existing) {
              finishWith(
                'create-customer',
                { useExisting: true, existingId: existing.id, existingName: existing.name },
                `Using existing customer "${existing.name}"`
              );
            } else {
              window.close();
            }
            void name;
          }}
          onPartnerCreated={(data) => {
            const name = String((data as Record<string, unknown>).partnerName || '').trim();
            const phone = String((data as Record<string, unknown>).partnerPhone || '').trim();
            const website = String((data as Record<string, unknown>).website || '').trim();
            const addressRaw = String((data as Record<string, unknown>).address || '').trim();
            const payload = {
              name,
              phone,
              website,
              logoLetter: (name[0] || 'A').toUpperCase(),
              defaultAddress: parseAddress(addressRaw),
            };
            finishWith('create-customer', payload, `Customer "${name || 'New customer'}" created successfully`);
          }}
        />
      )}

      {pocOpen && (
        <CreateContactModal
          open={pocOpen}
          onOpenChange={(next) => {
            setPocOpen(next);
            if (!next && action === 'create-poc' && !savingRef.current) setTimeout(() => window.close(), 60);
          }}
          seedName={seed}
          contextName={customerName}
          companyOptions={MOCK_CUSTOMERS.map((c) => ({ id: c.id, name: c.name, subtitle: c.locations[0]?.city }))}
          companyRequired
          companyLabel="Customer"
          initialCompanyId={customerId || undefined}
          initialCompanyName={customerName || undefined}
          onCreated={(payload: CreatedContactPayload) => {
            finishWith('create-poc', payload as unknown as Record<string, unknown>, `Contact "${payload.name}" created successfully`);
          }}
        />
      )}

      {locationOpen && (
        <CreatePartnerLocationModal
          open={locationOpen}
          onOpenChange={(next) => {
            setLocationOpen(next);
            if (!next && action === 'create-location' && !savingRef.current) setTimeout(() => window.close(), 60);
          }}
          onLocationCreated={(data) => {
            const name = String((data as Record<string, unknown>).locationName || '').trim();
            const phone = String((data as Record<string, unknown>).phone || '').trim();
            const email = String((data as Record<string, unknown>).email || '').trim();
            const addressRaw = String((data as Record<string, unknown>).address || '').trim();
            const payload = { name, phone, email, address: parseAddress(addressRaw), customerId, customerName };
            finishWith('create-location', payload, `Location "${name || 'New location'}" created successfully`);
          }}
        />
      )}
    </>
  );
}

export default PartnersShellPage;
