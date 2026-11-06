// @ts-nocheck
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Maximize2, Minimize2, Plus, Users, AlertTriangle, Building2, MapPin, Info, Check, UserPlus, Link2 } from 'lucide-react';
import { toast } from 'sonner';

import { ContactsDirectoryPage } from '@/app/components/shared/contactDirectory/ContactsDirectoryPage';
import { ConfirmDiscardModal } from '@/app/components/shared/ConfirmDiscardModal';
import {
  CONTACT_DICTIONARY,
  type ContactPerson,
} from '@/app/components/shared/contactDirectory/partnerConstants';
import { MOCK_CONTACTS, MOCK_CUSTOMERS } from '@/app/components/quote-creation/Step1CustomerSelection';

/* ════════════════════════════════════════════════════════════════════════
   "Select Point of Contact" modal — now backed by the embedded
   ContactsDirectoryPage from Partner Management (ported under
   components/shared/contactDirectory). The previous bespoke 3-pane
   table has been retired; the modal keeps its public contract so
   existing callers (Step2Configuration, RightSidebar) don't change.

   Public surface preserved:
     - isOpen, onClose, onSelect(recipients, primaryPoCId, copyToCustomer?)
     - currentCustomerId, currentCustomerName, selectedRecipients,
       primaryPoCId
     - The bridgeIntoRow helper keeps a previously-selected POC visible
       even when its id doesn't exist in the directory roster.
   ════════════════════════════════════════════════════════════════════════ */

export interface PoC {
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
  customerId?: string;
  customerName?: string;
  locationId?: string;
  locationName?: string;
  locationCity?: string;
  locationState?: string;
}

/** Real POCs sourced from the customer record. Shape matches
 *  CreateQuoteModal's `POC` so callers can pass through
 *  `customer.pocs` directly. Anything in this list takes precedence
 *  over the synthetic per-customer roster — these are the actual
 *  people on file, including the customer's primary contact. */
export interface CustomerPoc {
  id: string;
  name: string;
  initials?: string;
  isPrimary?: boolean;
  role?: string;
  phone?: string;
  extension?: string;
  email?: string;
  department?: string;
}

export interface RecipientsSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (recipients: PoC[], primaryPoCId: string, copyToCustomer?: boolean) => void;
  currentCustomerId: string;
  currentCustomerName: string;
  selectedRecipients?: PoC[];
  primaryPoCId?: string;
  /** Real POCs from the customer record — takes precedence over the
   *  synthetic roster. The first entry flagged `isPrimary` is selected
   *  by default when nothing's been selected yet. */
  customerPocs?: CustomerPoc[];
  /** Quote/SO's current customer location. When provided, drives the
   *  "This location only" scope pill so the directory rows filter to
   *  the same location the creation overlay surfaced. Without it the
   *  location pill stays a no-op (matches any contact). */
  currentLocationId?: string;
}

/* ─── Helpers ─────────────────────────────────────────────────────────── */

function getInitials(name: string): string {
  const parts = (name || '').trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (name || '').slice(0, 2).toUpperCase();
}

/** Bridge a previously-selected POC whose id may not exist in the directory
 *  roster into a synthetic ContactPerson row so the picker still recognises
 *  it. Without this, an already-picked primary POC would silently vanish
 *  when the modal reopens. */
function bridgeIntoRow(p: PoC, currentCustomerId: string, currentCustomerName: string, fallbackLocationId?: string): ContactPerson {
  return {
    id: p.id,
    name: p.name,
    company: p.customerName || currentCustomerName,
    department: p.department || '',
    phone: p.phone || '',
    phoneExt: p.extension || '',
    secondaryPhone: p.landline || '',
    secondaryPhoneExt: '',
    email: p.email || '',
    avatarColor: p.avatarColor || '#94A3B8',
    role: p.role || '',
    locationId: p.locationId || fallbackLocationId,
    locations: p.locationName ? [p.locationName] : undefined,
  } as ContactPerson;
}

/** Bridge a real customer POC (sourced from the customer record) into
 *  a ContactPerson row tagged with the current customer name, so the
 *  "Customer's contacts" scope picks it up via strict equality. */
function customerPocToRow(p: CustomerPoc, currentCustomerName: string, fallbackLocationId?: string): ContactPerson {
  return {
    id: p.id,
    name: p.name,
    company: currentCustomerName,
    department: p.department || '',
    phone: p.phone || '',
    phoneExt: p.extension || '',
    secondaryPhone: '',
    secondaryPhoneExt: '',
    email: p.email || '',
    avatarColor: '#0F62D6',
    role: p.role || '',
    locationId: (p as any).locationId || fallbackLocationId,
  } as ContactPerson;
}

/* Canonical per-customer POC roster — pulls directly from the same
   `MOCK_CONTACTS` seed the SearchOverlay (creation customer search) and
   the LocationSelectionModal read. Single source of truth: a contact
   that appears under "Toyota Texas" in the creation overlay must also
   appear here when the recipients picker opens with that customer +
   location, and the same id must reach the details-page picker too. */
const ROSTER_AVATAR_COLORS = ['hsl(var(--primary))','hsl(var(--violet))','hsl(var(--success))','hsl(var(--warning))'];
function generateCustomerRoster(currentCustomerName: string, currentCustomerId: string): ContactPerson[] {
  if (!currentCustomerName) return [];
  const matched = MOCK_CONTACTS.filter((c) => c.customerId === currentCustomerId || c.customerName === currentCustomerName);
  if (matched.length === 0) return [];
  const customer = MOCK_CUSTOMERS.find((c) => c.id === currentCustomerId || c.name === currentCustomerName);
  const customerLocations = customer ? new Map(customer.locations.map((l) => [l.id, l])) : new Map();
  return matched.map((c) => {
    /* Stable avatar tint per contact id — deterministic so repeated
       opens render the same color. */
    let h = 0;
    for (let i = 0; i < c.id.length; i++) { h = (h * 31 + c.id.charCodeAt(i)) >>> 0; }
    const avatarColor = ROSTER_AVATAR_COLORS[h % ROSTER_AVATAR_COLORS.length];
    const loc = customerLocations.get(c.locationId);
    return {
      id: c.id,
      name: c.name,
      company: c.customerName,
      department: c.department,
      phone: c.phone,
      phoneExt: c.extension || '',
      secondaryPhone: c.mobile || '',
      secondaryPhoneExt: '',
      email: c.email,
      avatarColor,
      role: c.title,
      locationId: c.locationId,
      locations: loc ? [loc.name] : (c.locationName ? [c.locationName] : undefined),
    } as ContactPerson;
  });
}

function contactToPoC(c: ContactPerson, currentCustomerId: string, currentCustomerName: string): PoC {
  const firstPhone = (c.phones && c.phones[0]) || null;
  const firstEmail = (c.emails && c.emails[0]) || null;
  return {
    id: c.id,
    name: c.name,
    email: firstEmail?.address || c.email || '',
    phone: firstPhone ? `${firstPhone.code} ${firstPhone.number}` : c.phone || '',
    landline: c.secondaryPhone || undefined,
    extension: firstPhone?.ext || c.phoneExt || undefined,
    role: c.role || '',
    department: c.department || '',
    initials: getInitials(c.name),
    avatarColor: c.avatarColor || '#94A3B8',
    customerId: currentCustomerId,
    customerName: currentCustomerName,
    /* Carry the directory row's locationId out through the PoC so
       later opens of the picker recognise the contact's location and
       the location pill behaves consistently. */
    locationId: c.locationId,
    locationName: c.locations?.[0],
  };
}

/* Contacts from another customer linked to this one ("Add to <customer>'s
   contacts"). It stays one contact, listed under both customers, so ids
   are stored, not copies. Session-scoped and keyed by customer name, so
   the link holds on every later open of the picker. */
const linkedCustomerContacts = new Map<string, string[]>();

function belongsToCustomer(c: ContactPerson, customerName: string): boolean {
  return c.company === customerName || !!c.companies?.includes(customerName);
}

function linkToCustomer(c: ContactPerson, customerName: string): ContactPerson {
  return { ...c, companies: Array.from(new Set([...(c.companies ?? [c.company]), customerName])) } as ContactPerson;
}

/* ─── Modal ───────────────────────────────────────────────────────────── */

export function RecipientsSelectionModal({
  isOpen,
  onClose,
  onSelect,
  currentCustomerId,
  currentCustomerName,
  selectedRecipients = [],
  primaryPoCId,
  customerPocs = [],
  currentLocationId,
}: RecipientsSelectionModalProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [primaryId, setPrimaryId] = useState<string>('');
  const [fullView, setFullView] = useState(false);
  /* Contacts from other customers waiting on the "this quote only" vs
     "add to this customer" choice, and the links chosen so far. Links
     are saved to the customer only when the selection is confirmed. */
  const [crossCustomerPrompt, setCrossCustomerPrompt] = useState<ContactPerson[] | null>(null);
  const [stagedLinks, setStagedLinks] = useState<string[]>([]);
  /* Set when Confirm is pressed with nothing selected. */
  const [showConfirmError, setShowConfirmError] = useState(false);
  /* Primary-unselect guard prompt: triggered when the user tries to
     uncheck the contact currently flagged as primary. Holds the id
     pending confirmation; on Confirm we reassign primary to whoever
     remains, on Cancel we revert. */
  const [primaryUnselectPrompt, setPrimaryUnselectPrompt] = useState<ContactPerson | null>(null);
  /* Scope pills above the directory's standard filter pills. Both open
     ON so the picker starts scoped to the right office, except that a
     customer with no contacts opens on the full directory and one with
     no location has no location chip (set on open). Selected POCs stay
     pinned to the top via pinSelectedTop. */
  const [scopeCustomer, setScopeCustomer] = useState(true);
  const [scopeLocation, setScopeLocation] = useState(true);
  /* Browse / Added segmented view toggle. Independent of the scope
     pills above. Default is the Browse view so the picker opens on
     the full result set; flipping to Added narrows the table to only
     the contacts currently checked. */
  const [addedViewActive, setAddedViewActive] = useState(false);

  /* Merge synthetic rows for previously-selected POCs that don't exist
     in the directory, so they remain visible / selectable on reopen.
     Also inject a deterministic per-customer roster so the picker has
     real customer-tagged contacts to show under the "Customer's
     contacts" scope, even when none of them are currently selected. */
  const mergedContacts = useMemo<ContactPerson[]>(() => {
    const seenIds = new Set<string>(CONTACT_DICTIONARY.map((c) => c.id));
    /* Real customer POCs win first — these are the actual people on
       file (including the flagged primary), so they must show up in
       the picker before the synthetic roster fills in extras. */
    const customerPocRows: ContactPerson[] = [];
    for (const p of customerPocs) {
      if (!seenIds.has(p.id)) {
        customerPocRows.push(customerPocToRow(p, currentCustomerName, currentLocationId));
        seenIds.add(p.id);
      }
    }
    const synthetics: ContactPerson[] = [];
    for (const p of selectedRecipients) {
      if (!seenIds.has(p.id)) {
        synthetics.push(bridgeIntoRow(p, currentCustomerId, currentCustomerName, currentLocationId));
        seenIds.add(p.id);
      }
    }
    const customerRoster = generateCustomerRoster(currentCustomerName, currentCustomerId)
      .filter((c) => !seenIds.has(c.id));
    const all = [...customerPocRows, ...synthetics, ...customerRoster, ...CONTACT_DICTIONARY];
    const linked = new Set([...(linkedCustomerContacts.get(currentCustomerName) ?? []), ...stagedLinks]);
    return linked.size ? all.map((c) => (linked.has(c.id) ? linkToCustomer(c, currentCustomerName) : c)) : all;
  }, [customerPocs, selectedRecipients, currentCustomerId, currentCustomerName, stagedLinks]);

  /* A row belongs to another customer when its company names someone
     else. Rows built from this customer's record (its POCs, roster,
     linked contacts, and contacts already on this quote) never do, whatever their
     company string says, so a small name drift can't trigger the prompt. */
  const ownContactIds = useMemo(() => {
    const ids = new Set<string>();
    for (const c of mergedContacts) if (belongsToCustomer(c, currentCustomerName)) ids.add(c.id);
    for (const p of customerPocs) ids.add(p.id);
    for (const p of selectedRecipients) ids.add(p.id);
    for (const c of generateCustomerRoster(currentCustomerName, currentCustomerId)) ids.add(c.id);
    return ids;
  }, [mergedContacts, customerPocs, selectedRecipients, currentCustomerName, currentCustomerId]);
  const isOtherCustomers = useCallback(
    (c?: ContactPerson) => !!c && !!currentCustomerName && !!c.company && !ownContactIds.has(c.id),
    [ownContactIds, currentCustomerName],
  );

  /* Whether the customer has any contacts at all. With none, the picker
     opens with Customer's contacts off on the full directory and says so,
     instead of showing the chip on over every contact. */
  const customerHasMatches = useMemo(() => {
    if (!currentCustomerName) return false;
    return mergedContacts.some((c) => belongsToCustomer(c, currentCustomerName));
  }, [mergedContacts, currentCustomerName]);

  /* Reset ONLY when the modal opens. Depending on `selectedRecipients`
     / `customerPocs` / `primaryPoCId` here is a footgun: those are
     parent props rebuilt on every render (`pocs.map(...)` inline),
     so any unrelated parent state change re-fires this effect and
     wipes the user's in-modal toggles. Pattern: snapshot once per
     open via the wasOpenRef gate and let the callsite reopen the
     modal to force a re-seed. */
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (!isOpen) {
      wasOpenRef.current = false;
      return;
    }
    if (wasOpenRef.current) return; // already seeded this opening
    wasOpenRef.current = true;

    const ids = new Set<string>(selectedRecipients.map((r) => r.id));
    const customerPrimary = customerPocs.find((p) => p.isPrimary) ?? customerPocs[0];
    if (ids.size === 0 && customerPrimary) {
      ids.add(customerPrimary.id);
    }
    setSelectedIds(ids);
    /* `||` rather than `??` here so an empty-string primaryPoCId
       (the typical "not set yet" default from callers) falls through
       to the customer's flagged primary. */
    const initialPrimary =
      primaryPoCId
      || selectedRecipients[0]?.id
      || customerPrimary?.id
      || '';
    setPrimaryId(initialPrimary);
    /* Snapshot the initial state so the discard-confirm guard can
       diff against it later. The picker is "dirty" when the current
       selection or primary differs from what the user opened with. */
    initialSelectedIdsRef.current = ids;
    initialPrimaryIdRef.current = initialPrimary;
    setFullView(false);
    setCrossCustomerPrompt(null);
    setStagedLinks([]);
    setShowConfirmError(false);
    /* No contacts: start on the full directory. No location: there is
       no location chip to turn on. */
    setScopeCustomer(customerHasMatches);
    setScopeLocation(customerHasMatches && !!currentLocationId);
    setShowDiscardConfirm(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  /* Discard-guard state: snapshot of the selection/primary at open
     time, plus the confirmation modal's visibility. Any close path
     (overlay, X, Cancel, ESC) runs requestClose which prompts when
     the user has drifted from the snapshot. */
  const initialSelectedIdsRef = useRef<Set<string>>(new Set());
  const initialPrimaryIdRef = useRef<string>('');
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const isDirty = useCallback(() => {
    const init = initialSelectedIdsRef.current;
    if (init.size !== selectedIds.size) return true;
    for (const id of selectedIds) if (!init.has(id)) return true;
    if (primaryId !== initialPrimaryIdRef.current) return true;
    return false;
  }, [selectedIds, primaryId]);
  const requestClose = useCallback(() => {
    if (isDirty()) {
      setShowDiscardConfirm(true);
    } else {
      onClose();
    }
  }, [isDirty, onClose]);

  // ESC dismisses through the discard guard.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // An open prompt takes Escape first.
      if (crossCustomerPrompt) { setCrossCustomerPrompt(null); return; }
      if (primaryUnselectPrompt) { setPrimaryUnselectPrompt(null); return; }
      requestClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, requestClose, crossCustomerPrompt, primaryUnselectPrompt]);

  const handleSelectionChange = useCallback((nextIds: Set<string>) => {
    /* Diff to find newly-added / removed ids in this update.
       Three guard rails ride on top of the base behaviour:
         · You can't unselect the LAST remaining contact — every
           quote/SO must have a primary on file. Surface a yellow
           Partner-style warning instead of silently swallowing.
         · You can't unselect the PRIMARY without confirming the
           hand-off; we hold the removal pending until the user
           clicks through the warning. Confirm → drop them and
           reassign primary to whoever's first in the remaining set.
         · Cross-customer adds still route through the existing
           CrossCustomerPrompt. */
    const newlyAdded: string[] = [];
    const newlyRemoved: string[] = [];
    nextIds.forEach((id) => { if (!selectedIds.has(id)) newlyAdded.push(id); });
    selectedIds.forEach((id) => { if (!nextIds.has(id)) newlyRemoved.push(id); });

    // Block unselect when it would leave the picker empty.
    if (newlyRemoved.length > 0 && nextIds.size === 0) {
      const last = mergedContacts.find((m) => m.id === newlyRemoved[0]);
      if (last) {
        setPrimaryUnselectPrompt({ ...last, __lastOne: true } as ContactPerson & { __lastOne?: boolean });
      }
      return; // selection unchanged
    }

    // Intercept primary removal — confirm before committing.
    if (newlyRemoved.length > 0 && primaryId && newlyRemoved.includes(primaryId)) {
      const removingPrimary = mergedContacts.find((m) => m.id === primaryId);
      if (removingPrimary) {
        setPrimaryUnselectPrompt(removingPrimary);
        return; // hold removal until user confirms
      }
    }

    const commit = (committed: Set<string>) => {
      setSelectedIds(committed);
      if (primaryId && !committed.has(primaryId)) {
        const firstRemaining = committed.values().next().value as string | undefined;
        setPrimaryId(firstRemaining || '');
      } else if (!primaryId && committed.size > 0) {
        setPrimaryId(committed.values().next().value as string);
      }
    };

    /* Contacts from another customer are held back and the user picks
       how to bring them in: on this quote only, or linked to this
       customer's contacts. Everything else commits right away. */
    const lookup = new Map(mergedContacts.map((c) => [c.id, c] as const));
    const rest = new Set(nextIds);
    const crossAdds: ContactPerson[] = [];
    for (const id of newlyAdded) {
      const c = lookup.get(id);
      if (!isOtherCustomers(c)) continue;
      rest.delete(id);
      crossAdds.push(c as ContactPerson);
    }
    commit(rest);
    if (crossAdds.length > 0) setCrossCustomerPrompt(crossAdds);
  }, [selectedIds, mergedContacts, primaryId, isOtherCustomers]);

  /* Resolves the cross-customer prompt. "link" selects the contacts for
     this quote only. "add" also links them to this customer's contacts
     once the selection is confirmed; their own customer keeps them. */
  const resolveCrossCustomer = useCallback((mode: 'add' | 'link' | 'cancel') => {
    const contacts = crossCustomerPrompt ?? [];
    setCrossCustomerPrompt(null);
    if (mode === 'cancel' || contacts.length === 0) return;
    const ids = contacts.map((c) => c.id);
    if (mode === 'add') setStagedLinks((prev) => [...prev, ...ids.filter((id) => !prev.includes(id))]);
    setSelectedIds((prev) => { const next = new Set(prev); ids.forEach((id) => next.add(id)); return next; });
    setPrimaryId((prev) => prev || ids[0]);
  }, [crossCustomerPrompt]);

  /* Called from PrimaryUnselectPrompt when the user confirms the
     hand-off. Drops the primary from selection and promotes the next
     contact (first remaining) into the primary slot. */
  const handleConfirmPrimaryRemoval = useCallback(() => {
    if (!primaryUnselectPrompt) return;
    const removedId = primaryUnselectPrompt.id;
    const next = new Set(selectedIds);
    next.delete(removedId);
    const newPrimary = next.values().next().value as string | undefined;
    setSelectedIds(next);
    setPrimaryId(newPrimary || '');
    setPrimaryUnselectPrompt(null);
  }, [primaryUnselectPrompt, selectedIds]);

  const handleConfirm = useCallback(() => {
    if (selectedIds.size === 0) { setShowConfirmError(true); return; }
    const lookup = new Map(mergedContacts.map((c) => [c.id, c] as const));
    const picked: PoC[] = [];
    selectedIds.forEach((id) => {
      const c = lookup.get(id);
      if (c) picked.push(contactToPoC(c, currentCustomerId, currentCustomerName));
    });
    /* Links that are still selected become this customer's contacts too. */
    const keptLinks = stagedLinks.filter((id) => selectedIds.has(id));
    if (keptLinks.length > 0) {
      linkedCustomerContacts.set(currentCustomerName, Array.from(new Set([
        ...(linkedCustomerContacts.get(currentCustomerName) ?? []),
        ...keptLinks,
      ])));
      toast.success(
        keptLinks.length === 1
          ? `${lookup.get(keptLinks[0])?.name ?? 'Contact'} linked to ${currentCustomerName}'s contacts`
          : `${keptLinks.length} contacts linked to ${currentCustomerName}'s contacts`,
        { position: 'top-right' },
      );
    }
    onSelect(picked, primaryId, keptLinks.length > 0);
    onClose();
  }, [mergedContacts, selectedIds, primaryId, currentCustomerId, currentCustomerName, stagedLinks, onSelect, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <>
      <div
        className="fixed inset-0"
        style={{ zIndex: 12100, backgroundColor: 'rgba(15, 23, 42, 0.55)', backdropFilter: 'blur(2px)' }}
        onClick={requestClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        /* Marks the picker as an open dialog so the creation modal
           underneath leaves Escape to it. */
        data-state="open"
        className="fixed shadow-2xl flex flex-col overflow-hidden"
        style={{
          zIndex: 12101,
          width: fullView ? '100vw' : 'min(96vw, 1360px)',
          height: fullView ? '100vh' : 'min(92vh, 880px)',
          left: fullView ? 0 : '50%',
          top: fullView ? 0 : '50%',
          transform: fullView ? 'none' : 'translate(-50%, -50%)',
          borderRadius: fullView ? 0 : 16,
          background: 'var(--card)',
          fontFamily: 'Inter, system-ui, sans-serif',
          /* Smoothly animate the Full view transition. Keeps every
             dimension property on the same easing curve so the modal
             expands/contracts as one motion rather than snapping. */
          transition: 'width 220ms cubic-bezier(0.4, 0, 0.2, 1), height 220ms cubic-bezier(0.4, 0, 0.2, 1), border-radius 220ms cubic-bezier(0.4, 0, 0.2, 1), top 220ms cubic-bezier(0.4, 0, 0.2, 1), left 220ms cubic-bezier(0.4, 0, 0.2, 1), transform 220ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — matches Partner Management's Select POC modal */}
        <div className="px-5 pt-4 pb-3 shrink-0 border-b border-border bg-white" style={{ borderTopLeftRadius: fullView ? 0 : 16, borderTopRightRadius: fullView ? 0 : 16 }}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-[15px] sm:text-[17px] text-foreground" style={{ fontWeight: 700 }}>
                Select Point of Contact
              </h2>
              <p className="text-[12px] text-slate-500 mt-0.5" style={{ fontWeight: 400 }}>
                Choose from your saved contacts or create a new one to assign to {currentCustomerName || 'this customer'}.
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => setFullView((v) => !v)}
                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-white text-xs text-muted-foreground hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer"
                style={{ fontWeight: 500 }}
              >
                {fullView ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                {fullView ? 'Exit full' : 'Full view'}
              </button>
              <button onClick={requestClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-500 hover:bg-muted transition-all cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* (The scope banner that used to live here has moved inside
            ContactsDirectoryPage via the new `scopeNotice` prop so it
            sits between the filter pill row and the table, matching
            the Partner Management notice-bar placement.) */}

        {/* Embedded Contacts Directory
            `flush` makes the directory occupy the parent's full flex
            height and routes its own scroll. Without it the directory
            shrinks to its natural content height and the table's
            horizontal scrollbar floats halfway up the modal instead
            of sitting at the bottom of the body. Parent wrapper drops
            `overflow-y-auto` to avoid a double-scroller fight with the
            directory's internal scroller. */}
        <div className="flex-1 min-h-0 flex flex-col">
          <ContactsDirectoryPage
            embedded
            flush
            embeddedContacts={mergedContacts}
            selectable
            selectedIds={selectedIds}
            onSelectionChange={handleSelectionChange}
            defaultVisibleColumns={["contact_name", "company", "phones", "emails", "role"]}
            pinSelectedTop
            /* Scope pills — independent of the Browse / Added view
               toggle. "Customer's contacts" filters the directory to
               contacts that belong to this account; "This location
               only" further narrows to the currently selected office. */
            scopePills={[
              {
                key: 'customer',
                label: `Customer's contacts`,
                active: scopeCustomer,
                /* Turning off the customer scope implicitly turns off
                   "This location only" — once we're browsing the
                   whole directory, locations are different for each
                   customer, so the per-customer location filter no
                   longer makes sense. Re-enabling the customer scope
                   does not auto-restore the location pill; the user
                   opts back into the narrower view explicitly. */
                onChange: (next) => {
                  setScopeCustomer(next);
                  if (!next) setScopeLocation(false);
                },
                icon: Building2,
                accent: 'purple',
                tooltip: {
                  title: `Customer's contacts`,
                  description: `Limits the directory to people who belong to ${currentCustomerName || 'this customer'}. Turn it off to browse every contact across all customers in your directory.`,
                },
                match: (c) => belongsToCustomer(c, currentCustomerName),
              },
              ...(currentLocationId ? [{
                key: 'location',
                label: 'This location only',
                active: scopeLocation,
                onChange: setScopeLocation,
                icon: MapPin,
                accent: 'green',
                tooltip: {
                  title: 'This location only',
                  description: `Narrows the list to contacts at this customer's selected location (for example, the New York branch of a multi-site customer). Turn it off to see this customer's point of contacts across all of their locations.`,
                },
                match: (c) => c.locationId === currentLocationId,
              }] : []),
            ]}
            hideViewControls
            /* Browse Contacts / Added Contacts segmented toggle —
               independent of the scope pills above. "Added Contacts"
               narrows the table to only the contacts the user has
               currently checked. Default = Browse Contacts so the
               picker opens on the full result set; users flip to
               Added Contacts to review what they've staged so far. */
            viewToggle={{
              options: [
                {
                  key: 'browse',
                  label: 'Browse Contacts',
                  icon: Users,
                  activeTone: 'primary',
                  count: mergedContacts.length,
                  match: (_c) => true,
                },
                {
                  key: 'added',
                  label: 'Added Contacts',
                  icon: Check,
                  activeTone: 'success',
                  count: selectedIds.size,
                  match: (c) => selectedIds.has(c.id),
                },
              ],
              activeKey: addedViewActive ? 'added' : 'browse',
              onChange: (key) => setAddedViewActive(key === 'added'),
            }}
            /* Scope notice between the filter pills and the table, in the
               amber strip Partners uses for restricted mode (Items They
               Buy, "Approved to Buy" on). Shown while the customer filter
               is on, and when the customer has no contacts to filter to. */
            scopeNotice={(scopeCustomer || !customerHasMatches) && (
              <div className="shrink-0 border-b border-amber-200 bg-amber-50/70 px-4 py-2 flex items-center gap-2.5" role="status">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-white border border-amber-200 text-amber-700 shrink-0">
                  <Building2 className="w-3.5 h-3.5" />
                </span>
                <p className="text-[11px] text-amber-900 min-w-0 flex-1" style={{ fontWeight: 500, margin: 0 }}>
                  {!customerHasMatches ? (
                    <>
                      <span style={{ fontWeight: 600 }}>{currentCustomerName || 'This customer'}</span> has no contacts yet.{' '}
                      {scopeCustomer
                        ? <>Turn off <span style={{ fontWeight: 600 }}>Customer{`'`}s contacts</span> to browse the full directory.</>
                        : 'Showing the full directory.'}
                    </>
                  ) : (
                    <>
                      Showing contacts that belong to{' '}
                      <span style={{ fontWeight: 600 }}>{currentCustomerName || 'this customer'}</span>
                      . Turn off{' '}
                      <span style={{ fontWeight: 600 }}>Customer{`'`}s contacts</span>{' '}
                      to browse the full directory.
                    </>
                  )}
                </p>
              </div>
            )}
            primaryContactId={primaryId || undefined}
            customerName={currentCustomerName}
            onSetPrimaryContact={(id) => setPrimaryId(id)}
            embeddedToolbarRight={
              <button
                type="button"
                onClick={() => {/* parent does not currently expose a create flow; left as no-op */}}
                className="inline-flex items-center justify-center h-9 gap-1.5 px-3 rounded-lg bg-primary text-white shadow-sm hover:bg-[#0960D9] transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                style={{ fontWeight: 500 }}
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="text-sm">Create New</span>
              </button>
            }
          />
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border bg-white flex items-center justify-between shrink-0" style={{ borderBottomLeftRadius: fullView ? 0 : 16, borderBottomRightRadius: fullView ? 0 : 16 }}>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/8 border border-primary/12">
              <Users className="w-3 h-3 text-primary" />
              <span className="text-[11px] text-primary" style={{ fontWeight: 700 }}>{selectedIds.size}</span>
            </div>
            <span className="text-[13px] text-slate-500" style={{ fontWeight: 500 }}>selected</span>
          </div>
          <div className="flex items-center gap-2.5">
            {showConfirmError && selectedIds.size === 0 && (
              <span role="alert" className="text-red-500 text-xs">Select a point of contact to continue.</span>
            )}
            <button onClick={requestClose} className="px-4 py-2 rounded-lg border border-border bg-white text-[13px] text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer" style={{ fontWeight: 500 }}>Cancel</button>
            {/* Confirm stays clickable. With nothing picked it explains why
                instead of going grey (same as the payment method picker). */}
            <button
              onClick={handleConfirm}
              className="px-5 py-2 rounded-lg bg-primary text-[13px] text-white hover:bg-[#0960D9] transition-colors shadow-sm cursor-pointer"
              style={{ fontWeight: 600 }}
            >
              Confirm Selection
            </button>
          </div>
        </div>

        {crossCustomerPrompt && (
          <CrossCustomerPrompt
            contacts={crossCustomerPrompt}
            currentCustomerName={currentCustomerName}
            onResolve={resolveCrossCustomer}
          />
        )}

        {primaryUnselectPrompt && (
          <PrimaryUnselectPrompt
            poc={primaryUnselectPrompt}
            isLastOne={!!(primaryUnselectPrompt as any).__lastOne}
            onResolve={(mode) => {
              if (mode === 'confirm') handleConfirmPrimaryRemoval();
              else setPrimaryUnselectPrompt(null);
            }}
          />
        )}
      </div>

      {/* Discard guard — surfaced when the user attempts to close the
          picker after changing the selection or primary. Mirrors the
          Partner red-themed discard chrome used elsewhere in the suite
          so the prompt is recognisable across modules. */}
      <ConfirmDiscardModal
        open={showDiscardConfirm}
        onOpenChange={(o) => { if (!o) setShowDiscardConfirm(false); }}
        title="Discard recipient changes?"
        description="Your selection and primary contact updates will be lost. Reopening the picker starts from the saved list."
        confirmLabel="Discard changes"
        cancelLabel="Continue editing"
        onConfirm={() => {
          setShowDiscardConfirm(false);
          onClose();
        }}
      />
    </>,
    document.body
  );
}

/* ─── Cross-customer prompt ───────────────────────────────────────────
   Partners' scope-choice dialog (PartnerItemsTab "Edit shared rule"):
   gradient header with icon and badge, centered title and description,
   two full-width option cards, full-width Cancel. */
function CrossCustomerPrompt({
  contacts,
  currentCustomerName,
  onResolve,
}: {
  contacts: ContactPerson[];
  currentCustomerName: string;
  onResolve: (mode: 'add' | 'link' | 'cancel') => void;
}) {
  const single = contacts.length === 1 ? contacts[0] : null;
  const first = single ? single.name.split(' ')[0] : '';
  const who = single ? first : 'them';
  return (
    <div
      className="absolute inset-0 z-20 flex items-center justify-center"
      style={{ background: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(2px)' }}
      onClick={() => onResolve('cancel')}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="cross-customer-title"
        onClick={(e) => e.stopPropagation()}
        className="w-[min(92%,440px)] rounded-2xl bg-white overflow-hidden shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)]"
        style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
      >
        <div className="relative flex flex-col items-center pt-8 pb-5" style={{ background: 'linear-gradient(180deg, #EBF3FF 0%, rgba(239,246,255,0.3) 70%, transparent 100%)' }}>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25" style={{ backgroundColor: '#3B82F6' }} />
          <div className="relative w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#DBEAFE' }}>
            <Users className="w-7 h-7" style={{ color: '#1D4ED8' }} />
          </div>
          <span className="mt-3 px-3 py-1 rounded-full text-[11px]" style={{ fontWeight: 600, backgroundColor: '#EFF6FF', color: '#1E40AF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Other customer
          </span>
        </div>
        <div className="flex flex-col items-center text-center px-7 pb-7">
          <h3 id="cross-customer-title" className="text-[17px] tracking-[-0.02em] text-foreground" style={{ fontWeight: 600, margin: 0 }}>
            {single ? `Add ${single.name} to ${currentCustomerName}?` : `Add ${contacts.length} contacts to ${currentCustomerName}?`}
          </h3>
          <p className="text-[13px] mt-2 max-w-[360px] mx-auto text-muted-foreground" style={{ lineHeight: 1.65, marginBottom: 0 }}>
            {single
              ? <>{first} is a contact of <span className="text-foreground" style={{ fontWeight: 600 }}>{single.company}</span>. Choose how to use them here.</>
              : <>These contacts belong to other customers. Choose how to use them here.</>}
          </p>
          <div className="w-full mt-5 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={() => onResolve('add')}
              className="w-full rounded-xl border border-primary/30 bg-primary/[0.04] hover:bg-primary/[0.08] px-4 py-3 text-left transition-colors cursor-pointer"
            >
              <div className="flex items-start gap-3">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-primary/30 shrink-0 mt-0.5">
                  <UserPlus className="w-4 h-4 text-primary" />
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] text-primary" style={{ fontWeight: 600, margin: 0 }}>Add to {currentCustomerName}'s contacts</p>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-snug" style={{ marginBottom: 0 }}>
                    Links {who} to {currentCustomerName}'s contacts for future quotes. {single ? `${single.company} keeps them too.` : 'The other customers keep them too.'}
                  </p>
                </div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => onResolve('link')}
              className="w-full rounded-xl border border-border bg-white hover:bg-slate-50 px-4 py-3 text-left transition-colors cursor-pointer"
            >
              <div className="flex items-start gap-3">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-border shrink-0 mt-0.5">
                  <Link2 className="w-4 h-4 text-slate-500" />
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] text-slate-800" style={{ fontWeight: 600, margin: 0 }}>Use on this quote only</p>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-snug" style={{ marginBottom: 0 }}>
                    Links {who} to this quote without adding {single ? 'them' : 'anyone'} to {currentCustomerName}'s contacts.
                  </p>
                </div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => onResolve('cancel')}
              className="w-full h-10 text-[13px] rounded-xl bg-muted text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
              style={{ fontWeight: 500 }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Primary-unselect warning prompt ─────────────────────────────────
   Same Partner-yellow chrome as the cross-customer prompt above. Two
   modes:
     · isLastOne === true → block the unselect entirely (single OK
       button reads "Got it"); a quote/SO cannot exist without at
       least one point of contact.
     · isLastOne === false → confirm the primary hand-off; on Confirm
       the caller drops the primary from selection and promotes the
       next contact in line. */
function PrimaryUnselectPrompt({
  poc,
  isLastOne,
  onResolve,
}: {
  poc: ContactPerson;
  isLastOne: boolean;
  onResolve: (mode: 'confirm' | 'cancel') => void;
}) {
  return (
    <div
      style={{
        position: 'absolute', inset: 0, zIndex: 20,
        background: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(2px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={() => onResolve('cancel')}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(92%, 460px)', borderRadius: 16, background: 'var(--card)',
          boxShadow: '0 24px 48px rgba(15, 23, 42, 0.25)', overflow: 'hidden',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        <div style={{ padding: '20px 22px 16px' }}>
          <div className="flex items-start" style={{ gap: 12 }}>
            <div
              className="flex items-center justify-center shrink-0"
              style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(245, 158, 11, 0.14)' }}
            >
              <AlertTriangle style={{ width: 18, height: 18, color: '#B45309' }} />
            </div>
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--foreground)', margin: 0, lineHeight: 1.3 }}>
                {isLastOne
                  ? `Keep at least one point of contact`
                  : `Remove ${poc.name} as primary?`}
              </h3>
              <p style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 6, lineHeight: 1.5 }}>
                {isLastOne
                  ? <>This quote/order needs at least one point of contact on file. Add another contact first, then you can swap <strong>{poc.name}</strong> out.</>
                  : <><strong>{poc.name}</strong> is currently the primary point of contact. Removing them will promote the next selected contact to primary. You can change the primary again any time.</>}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end" style={{ padding: '12px 22px 18px', gap: 8 }}>
          {isLastOne ? (
            <button
              type="button"
              onClick={() => onResolve('cancel')}
              style={{ height: 34, padding: '0 14px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: '#FFFFFF', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              Got it
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => onResolve('cancel')}
                style={{ height: 34, padding: '0 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--foreground)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
              >
                Keep as primary
              </button>
              <button
                type="button"
                onClick={() => onResolve('confirm')}
                style={{ height: 34, padding: '0 14px', borderRadius: 8, border: 'none', background: '#B45309', color: '#FFFFFF', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                Remove &amp; reassign
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
