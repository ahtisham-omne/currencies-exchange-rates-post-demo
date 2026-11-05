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
import { MOCK_CUSTOMERS } from './CreateSOModal';

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

/** Real POCs sourced from the customer record. Shape matches CreateSOModal's
 *  `POC` (and the SO detail page's analogue) so callers can pass through
 *  `customer.pocs` directly. Anything in this list takes precedence over
 *  the synthetic per-customer roster — these are the actual people on
 *  file, including the customer's primary contact. */
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
  /** SO's current customer location. When provided, drives the "This
   *  location only" scope pill so the directory rows filter to the
   *  same location the creation overlay surfaced. Without it the
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

/* Canonical per-customer POC roster — single source of truth backed
   by MOCK_CUSTOMERS[].pocs, with each row tagged by `locationId` so
   the "This location only" scope pill can filter rows to the SO's
   current location. POCs that the post-pass has already anchored
   to a location keep that anchor; un-anchored POCs fall back to the
   customer's default location so they still appear under the
   default-location filter and don't accidentally vanish. */
const ROSTER_AVATAR_COLORS = ['hsl(var(--primary))','hsl(var(--violet))','hsl(var(--success))','hsl(var(--warning))'];
function generateCustomerRoster(currentCustomerName: string, currentCustomerId: string): ContactPerson[] {
  if (!currentCustomerName) return [];
  const customer = MOCK_CUSTOMERS.find((c) => c.id === currentCustomerId || c.name === currentCustomerName);
  if (!customer || !customer.pocs || customer.pocs.length === 0) return [];
  const defaultLocation = customer.locations?.find((l) => l.isDefault) ?? customer.locations?.[0];
  const locationsById = new Map((customer.locations ?? []).map((l) => [l.id, l]));
  return customer.pocs.map((p) => {
    let h = 0;
    for (let j = 0; j < p.id.length; j++) { h = (h * 31 + p.id.charCodeAt(j)) >>> 0; }
    const avatarColor = ROSTER_AVATAR_COLORS[h % ROSTER_AVATAR_COLORS.length];
    /* `role` arrives as "Title | Department" or just "Title"; split
       on the first pipe so the Title column reads cleanly and
       Department carries the second half when present. */
    const parts = (p.role || '').split('|').map((s) => s.trim());
    const title = parts[0] || '';
    const dept = parts[1] || '';
    const locId = p.locationId || defaultLocation?.id;
    const locName = locId ? locationsById.get(locId)?.name : undefined;
    return {
      id: p.id,
      name: p.name,
      company: customer.name,
      department: dept,
      phone: p.phone || '',
      phoneExt: (p.extension || '').replace(/^Ext\.\s*/i, ''),
      secondaryPhone: '',
      secondaryPhoneExt: '',
      email: p.email || '',
      avatarColor,
      role: title,
      locationId: locId,
      locations: locName ? [locName] : undefined,
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

/* Contacts copied in from another customer ("Add to <customer>'s
   contacts"). Session-scoped and keyed by customer name, so the copy is
   one of this customer's contacts on every later open of the picker. */
const copiedCustomerContacts = new Map<string, ContactPerson[]>();

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
  /* Contacts from other customers waiting on the "this order only" vs
     "add to this customer" choice, and the copies chosen so far. Copies
     are saved to the customer only when the selection is confirmed. */
  const [crossCustomerPrompt, setCrossCustomerPrompt] = useState<ContactPerson[] | null>(null);
  const [stagedCopies, setStagedCopies] = useState<ContactPerson[]>([]);
  /* Primary-unselect guard prompt: held when the user tries to
     uncheck the contact currently flagged as primary. Confirm
     reassigns primary to whoever remains; Cancel reverts. When the
     primary is the last selected contact, the prompt switches to a
     hard-block ("Got it") because a quote/order must keep at least
     one point of contact on file. */
  const [primaryUnselectPrompt, setPrimaryUnselectPrompt] = useState<ContactPerson | null>(null);
  /* Scope pills above the directory's standard filter pills.
     Both "Customer's contacts" and "This location only" default ON
     so the picker opens scoped to the right office. Selected POCs
     stay pinned to the top via pinSelectedTop. */
  const [scopeCustomer, setScopeCustomer] = useState(true);
  const [scopeLocation, setScopeLocation] = useState(true);
  /* Browse / Added segmented view toggle. Independent of the scope
     pills above. Default is the Browse view so the picker opens on
     the full result set; flipping to Added narrows the table to only
     the contacts currently checked. */
  const [addedViewActive, setAddedViewActive] = useState(false);

  /* Merge real customer POCs (from the customer record) + previously-
     selected POCs + a deterministic per-customer roster so the picker
     always has customer-tagged rows. `customerPocs` takes precedence
     and is what guarantees the real primary contact (e.g. the
     customer's actual Fire Chief) appears in the picker, even when
     the customer record only has a single POC on file. */
  const mergedContacts = useMemo<ContactPerson[]>(() => {
    const seenIds = new Set<string>(CONTACT_DICTIONARY.map((c) => c.id));
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
    const copies = [...(copiedCustomerContacts.get(currentCustomerName) ?? []), ...stagedCopies]
      .filter((c) => !seenIds.has(c.id) && (seenIds.add(c.id), true));
    return [...customerPocRows, ...copies, ...synthetics, ...customerRoster, ...CONTACT_DICTIONARY];
  }, [customerPocs, selectedRecipients, currentCustomerId, currentCustomerName, stagedCopies]);

  /* A row belongs to another customer when its company names someone
     else. Rows built from this customer's record (its POCs, roster,
     copies, and contacts already on this order) never do, whatever their
     company string says, so a small name drift can't trigger the prompt. */
  const ownContactIds = useMemo(() => {
    const ids = new Set<string>();
    for (const c of mergedContacts) if (c.company === currentCustomerName) ids.add(c.id);
    for (const p of customerPocs) ids.add(p.id);
    for (const p of selectedRecipients) ids.add(p.id);
    for (const c of generateCustomerRoster(currentCustomerName, currentCustomerId)) ids.add(c.id);
    return ids;
  }, [mergedContacts, customerPocs, selectedRecipients, currentCustomerName, currentCustomerId]);
  const isOtherCustomers = useCallback(
    (c?: ContactPerson) => !!c && !!currentCustomerName && !!c.company && !ownContactIds.has(c.id),
    [ownContactIds, currentCustomerName],
  );

  /* Bug A2: directory rows store generic industry labels in `company`
     (e.g. "Manufacturing") rather than the actual customer name, so a
     strict equality filter empties the picker. Detect once whether the
     customer has any matching row; if not, the scope pill still shows
     but its match is relaxed so the user can see every contact and
     swap recipients freely. */
  const customerHasMatches = useMemo(() => {
    if (!currentCustomerName) return false;
    return mergedContacts.some((c) => c.company === currentCustomerName);
  }, [mergedContacts, currentCustomerName]);

  /* Reset ONLY when the modal opens. Depending on `selectedRecipients`
     / `customerPocs` / `primaryPoCId` here is a footgun: those are
     parent props rebuilt on every render (`pocs.map(...)` inline),
     so any unrelated parent state change re-fires this effect and
     wipes the user's in-modal toggles. Pattern: snapshot once per
     open via the wasOpenRef gate. */
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
       diff against it later. */
    initialSelectedIdsRef.current = ids;
    initialPrimaryIdRef.current = initialPrimary;
    setFullView(false);
    setCrossCustomerPrompt(null);
    setStagedCopies([]);
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
    /* Same guard set as the Quote modal:
         · empty unselect is blocked (need ≥ 1 PoC on file);
         · primary removal is confirmed via PrimaryUnselectPrompt;
         · cross-customer adds still route through CrossCustomerPrompt. */
    const newlyAdded: string[] = [];
    const newlyRemoved: string[] = [];
    nextIds.forEach((id) => { if (!selectedIds.has(id)) newlyAdded.push(id); });
    selectedIds.forEach((id) => { if (!nextIds.has(id)) newlyRemoved.push(id); });

    if (newlyRemoved.length > 0 && nextIds.size === 0) {
      const last = mergedContacts.find((m) => m.id === newlyRemoved[0]);
      if (last) {
        setPrimaryUnselectPrompt({ ...last, __lastOne: true } as ContactPerson & { __lastOne?: boolean });
      }
      return;
    }

    if (newlyRemoved.length > 0 && primaryId && newlyRemoved.includes(primaryId)) {
      const removingPrimary = mergedContacts.find((m) => m.id === primaryId);
      if (removingPrimary) {
        setPrimaryUnselectPrompt(removingPrimary);
        return;
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
       how to bring them in: on this order only, or copied into this
       customer's contacts. Everything else commits right away. */
    const lookup = new Map(mergedContacts.map((c) => [c.id, c] as const));
    const slug = currentCustomerName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const rest = new Set(nextIds);
    const crossAdds: ContactPerson[] = [];
    for (const id of newlyAdded) {
      const c = lookup.get(id);
      if (!isOtherCustomers(c)) continue;
      rest.delete(id);
      // Already copied into this customer: select the copy, no prompt.
      const copyId = `${id}--${slug}`;
      if (lookup.has(copyId)) rest.add(copyId);
      else crossAdds.push(c as ContactPerson);
    }
    commit(rest);
    if (crossAdds.length > 0) setCrossCustomerPrompt(crossAdds);
  }, [selectedIds, mergedContacts, primaryId, isOtherCustomers]);

  /* Resolves the cross-customer prompt. "link" selects the contacts as
     they are, for this order only. "copy" selects a copy that becomes
     one of this customer's contacts once the selection is confirmed. */
  const resolveCrossCustomer = useCallback((mode: 'copy' | 'link' | 'cancel') => {
    const contacts = crossCustomerPrompt ?? [];
    setCrossCustomerPrompt(null);
    if (mode === 'cancel' || contacts.length === 0) return;
    let ids = contacts.map((c) => c.id);
    if (mode === 'copy') {
      const slug = currentCustomerName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const copies = contacts.map((c) => ({
        ...c,
        id: `${c.id}--${slug}`,
        company: currentCustomerName,
        companies: [currentCustomerName],
        locationId: currentLocationId || c.locationId,
        locations: undefined,
      } as ContactPerson));
      setStagedCopies((prev) => [...prev, ...copies.filter((c) => !prev.some((p) => p.id === c.id))]);
      ids = copies.map((c) => c.id);
    }
    setSelectedIds((prev) => { const next = new Set(prev); ids.forEach((id) => next.add(id)); return next; });
    setPrimaryId((prev) => prev || ids[0]);
  }, [crossCustomerPrompt, currentCustomerName, currentLocationId]);

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
    const lookup = new Map(mergedContacts.map((c) => [c.id, c] as const));
    const picked: PoC[] = [];
    selectedIds.forEach((id) => {
      const c = lookup.get(id);
      if (c) picked.push(contactToPoC(c, currentCustomerId, currentCustomerName));
    });
    /* Copies that are still selected become this customer's contacts. */
    const keptCopies = stagedCopies.filter((c) => selectedIds.has(c.id));
    if (keptCopies.length > 0) {
      copiedCustomerContacts.set(currentCustomerName, [
        ...(copiedCustomerContacts.get(currentCustomerName) ?? []).filter((c) => !keptCopies.some((k) => k.id === c.id)),
        ...keptCopies,
      ]);
      toast.success(
        keptCopies.length === 1
          ? `${keptCopies[0].name} added to ${currentCustomerName}'s contacts`
          : `${keptCopies.length} contacts added to ${currentCustomerName}'s contacts`,
        { position: 'top-right' },
      );
    }
    onSelect(picked, primaryId, keptCopies.length > 0);
    onClose();
  }, [mergedContacts, selectedIds, primaryId, currentCustomerId, currentCustomerName, stagedCopies, onSelect, onClose]);

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
          /* Smoothly animate the Full view transition. */
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
            `flush` so the directory occupies the parent's flex height
            and routes its own scroll. Without it the table's horizontal
            scrollbar sits halfway up the modal instead of at the bottom
            of the body. Parent drops `overflow-y-auto` so it doesn't
            fight the directory's internal scroller. */}
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
                match: customerHasMatches
                  ? (c) => c.company === currentCustomerName
                  : (_c) => true,
              },
              {
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
                match: currentLocationId
                  ? (c) => c.locationId === currentLocationId
                  : (_c) => true,
              },
            ]}
            hideViewControls
            /* Browse Contacts / Added Contacts toggle — Partner pattern.
               Independent of the scope pills above. "Added Contacts"
               narrows the table to only the contacts currently
               checked; default is Browse Contacts. */
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
            /* Scope notice rendered between the filter pills and the
               table. Visible by default whenever the Customer scope is
               active. Chrome mirrors the Partner Management
               PartnerItemsTab notice strip: full-width edge-to-edge,
               no rounded corners, thin top + bottom strokes, soft
               top-to-bottom gradient. Violet palette ties it to the
               customer scope pill and uses the Building2 icon. */
            scopeNotice={scopeCustomer && (
              <div
                className="px-4 py-2 flex items-start gap-2.5"
                style={{
                  background: 'linear-gradient(180deg, #F5F3FF 0%, rgba(245,243,255,0.5) 100%)',
                  borderTop: '1px solid #DDD6FE',
                  borderBottom: '1px solid #DDD6FE',
                }}
                role="status"
              >
                <Building2 className="w-3.5 h-3.5 mt-px shrink-0" style={{ color: '#6D28D9' }} />
                <p className="text-[12px] leading-relaxed" style={{ color: '#4C1D95', margin: 0 }}>
                  Showing contacts that belong to{' '}
                  <span style={{ fontWeight: 600 }}>{currentCustomerName || 'this customer'}</span>
                  . Turn off{' '}
                  <span style={{ fontWeight: 600 }}>Customer{`'`}s contacts</span>{' '}
                  to browse the full directory.
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
            <button onClick={requestClose} className="px-4 py-2 rounded-lg border border-border bg-white text-[13px] text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer" style={{ fontWeight: 500 }}>Cancel</button>
            {/* A sales order needs at least one point of contact on
                file. Confirm is disabled when nothing's selected so the
                user can't accidentally proceed with an empty roster. */}
            <button
              onClick={handleConfirm}
              disabled={selectedIds.size === 0}
              className="px-5 py-2 rounded-lg bg-primary text-[13px] text-white hover:bg-[#0960D9] transition-colors shadow-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-primary"
              style={{ fontWeight: 600 }}
              title={selectedIds.size === 0 ? 'Select at least one point of contact to continue.' : undefined}
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
          Partner red-themed discard chrome. */}
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
  onResolve: (mode: 'copy' | 'link' | 'cancel') => void;
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
              onClick={() => onResolve('copy')}
              className="w-full rounded-xl border border-primary/30 bg-primary/[0.04] hover:bg-primary/[0.08] px-4 py-3 text-left transition-colors cursor-pointer"
            >
              <div className="flex items-start gap-3">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-primary/30 shrink-0 mt-0.5">
                  <UserPlus className="w-4 h-4 text-primary" />
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] text-primary" style={{ fontWeight: 600, margin: 0 }}>Add to {currentCustomerName}'s contacts</p>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-snug" style={{ marginBottom: 0 }}>
                    Copies {who} into {currentCustomerName}'s contacts for future orders. {single ? `${single.company} keeps the original.` : 'The other customers keep the originals.'}
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
                  <p className="text-[13px] text-slate-800" style={{ fontWeight: 600, margin: 0 }}>Use on this order only</p>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-snug" style={{ marginBottom: 0 }}>
                    Links {who} to this order without adding {single ? 'them' : 'anyone'} to {currentCustomerName}'s contacts.
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
                  ? <>This sales order needs at least one point of contact on file. Add another contact first, then you can swap <strong>{poc.name}</strong> out.</>
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
