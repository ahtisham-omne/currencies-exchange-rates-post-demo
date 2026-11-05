import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  X, Search, MapPin, Check, ChevronDown, ChevronRight, Star, Plus, Truck, Receipt,
} from "lucide-react";
import { toast } from "sonner";
import { HighlightText } from "@/app/components/HighlightText";

/* ════════════════════════════════════════════════════════════════════
   Billing / Shipping selection modal — Partner-faithful port of the
   "Select Ship To" / "Select Bill To" picker used inside Partner
   Management. The visual contract (icon badge header, search row,
   expandable partner rows, footer with selected pill + Done) matches
   `renderTargetPicker` in `CreatePartnerLocationModal.tsx`.

   Local additions on top of Partner's picker:
   1. "Set as primary" hover pill on the right of every non-primary
      location row — mirrors the star pill used elsewhere in Partner.
   2. "Add location" button next to the close X — fires a toast that
      points the user to Partner Management for the real flow.

   Props interface preserved so existing callers (SO sidebar)
   continue working unchanged.
   ════════════════════════════════════════════════════════════════════ */

export interface Address {
  id: string;
  label: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  isDefault: boolean;
  pocCount?: number;
  primaryContact?: string;
}

export interface Partner {
  id: string;
  name: string;
  type: string;
  location: string;
}

interface AddressSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (address: Address, partner: Partner, defaultChanged?: boolean) => void;
  type: "billing" | "shipping";
  customerName: string;
  currentCustomer: Partner;
  currentAddress: Address | null;
}

const MOCK_PARTNERS: Partner[] = [
  { id: "partner1", name: "Tri-County EMS Authority", type: "Customer", location: "Springfield, IL" },
  { id: "partner2", name: "Global Industries Inc",    type: "Customer", location: "New York, NY" },
  { id: "partner3", name: "Tech Solutions Ltd",       type: "Customer", location: "San Francisco, CA" },
  { id: "partner4", name: "Enterprise Systems",       type: "Customer", location: "Boston, MA" },
];

const PARTNER_ADDRESSES: Record<string, Address[]> = {
  partner1: [
    { id: "addr1", label: "Headquarters",      street: "1234 Innovation Drive", city: "Torrance",    state: "CA", zip: "90503", country: "USA", isDefault: true,  pocCount: 4, primaryContact: "Sarah Chen" },
    { id: "addr2", label: "Billing Office",    street: "PO Box 5678",            city: "New York",    state: "NY", zip: "10002", country: "USA", isDefault: false, pocCount: 2, primaryContact: "James Liu" },
    { id: "addr3", label: "Warehouse",         street: "5678 Progress Avenue",   city: "Carson City", state: "NV", zip: "89701", country: "USA", isDefault: false, pocCount: 1, primaryContact: "Mike Torres" },
    { id: "addr4", label: "East Coast Office", street: "2234 Tech Parkway",      city: "Boston",      state: "MA", zip: "02101", country: "USA", isDefault: false, pocCount: 3, primaryContact: "Emily Park" },
  ],
  partner2: [
    { id: "addr5", label: "Main Office",         street: "789 Business Blvd",  city: "New York", state: "NY", zip: "10001", country: "USA", isDefault: true,  pocCount: 5, primaryContact: "David Kim" },
    { id: "addr6", label: "Distribution Center", street: "456 Logistics Lane", city: "Newark",   state: "NJ", zip: "07102", country: "USA", isDefault: false, pocCount: 2, primaryContact: "Anna Reyes" },
  ],
  partner3: [
    { id: "addr7", label: "HQ - Downtown", street: "321 Market Street", city: "San Francisco", state: "CA", zip: "94102", country: "USA", isDefault: true, pocCount: 3, primaryContact: "Raj Patel" },
  ],
  partner4: [
    { id: "addr8", label: "Corporate Office", street: "555 Innovation Way", city: "Boston", state: "MA", zip: "02101", country: "USA", isDefault: true, pocCount: 6, primaryContact: "Lisa Wang" },
  ],
};

/* Stable partner-avatar colors so initials read consistently between
   the picker and the rest of the app. Unknown partners fall back to a
   neutral slate. */
const AVATAR_COLORS: Record<string, string> = {
  partner1: "#7C3AED",
  partner2: "#1E293B",
  partner3: "#1D4ED8",
  partner4: "#DC2626",
};
const DEFAULT_AVATAR = "#475569";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function AddressSelectionModal({
  isOpen, onClose, onSelect, type, currentCustomer, currentAddress,
}: AddressSelectionModalProps) {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  /* Primary is scoped to the customer for whom this Quote/SO is being
     built — only that customer's default location carries the "Primary"
     pill. Other partners shown in the picker are reference data only;
     their defaults are not surfaced here. */
  const [primaryAddressId, setPrimaryAddressId] = useState<string | null>(() => {
    const own = PARTNER_ADDRESSES[currentCustomer.id] || [];
    return own.find((a) => a.isDefault)?.id ?? null;
  });

  useEffect(() => {
    if (!isOpen) return;
    setSearch("");
    setExpanded(new Set([currentCustomer.id]));
    /* Re-seed primary on open in case the parent's customer changed
       between opens (e.g. user switched SOs). */
    const own = PARTNER_ADDRESSES[currentCustomer.id] || [];
    setPrimaryAddressId(own.find((a) => a.isDefault)?.id ?? null);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, currentCustomer.id, onClose]);

  const config = useMemo(() => (
    type === "shipping"
      ? {
          icon: <Truck className="w-4 h-4" style={{ color: "#16A34A" }} />,
          iconBg: "#DCFCE7",
          title: "Select Ship To",
          description: "Choose delivery destination",
        }
      : {
          icon: <Receipt className="w-4 h-4" style={{ color: "#7C3AED" }} />,
          iconBg: "#F5F3FF",
          title: "Select Bill To",
          description: "Choose billing address",
        }
  ), [type]);

  const matchesQuery = useCallback((addr: Address, q: string) => (
    addr.label.toLowerCase().includes(q) ||
    `${addr.city} ${addr.state}`.toLowerCase().includes(q) ||
    addr.street.toLowerCase().includes(q)
  ), []);

  const filteredPartners = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return MOCK_PARTNERS;
    return MOCK_PARTNERS.filter((p) => {
      if (p.name.toLowerCase().includes(q)) return true;
      const locs = PARTNER_ADDRESSES[p.id] || [];
      return locs.some((l) => matchesQuery(l, q));
    });
  }, [search, matchesQuery]);

  const toggleExpand = useCallback((pid: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(pid)) next.delete(pid); else next.add(pid);
      return next;
    });
  }, []);

  const setPrimary = useCallback((partner: Partner, addr: Address) => {
    /* Set-as-primary only affects the current customer. Stays local —
       the modal keeps the pill in sync inside this session, but the
       durable customer default lives in Partner Management and is not
       changed by this action. Tapping a row (handleSelect) is the only
       interaction that updates the parent card. */
    if (partner.id !== currentCustomer.id) return;
    setPrimaryAddressId(addr.id);
    toast.success(`Primary set to ${addr.label}`, {
      description: `Default ${type === "shipping" ? "shipping" : "billing"} for ${partner.name}.`,
      position: "top-right",
    });
  }, [type, currentCustomer.id]);

  const handleSelect = useCallback((addr: Address, partner: Partner) => {
    onSelect(addr, partner, false);
    onClose();
  }, [onSelect, onClose]);

  const handleAddLocation = useCallback(() => {
    toast("New locations are added in Partner Management.", {
      description: "Open the customer's profile there to add a new address.",
      position: "top-right",
    });
  }, []);

  if (!isOpen || typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 10100,
        background: "rgba(15,23,42,0.40)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        className="bg-white rounded-2xl overflow-hidden flex flex-col"
        style={{
          width: "100%", maxWidth: 520, maxHeight: "90vh",
          boxShadow: "0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)",
        }}
      >
        {/* Header */}
        <div className="px-5 pt-4 pb-3 border-b border-muted shrink-0">
          <div className="flex items-center justify-between mb-3 gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: config.iconBg }}
              >
                {config.icon}
              </div>
              <div className="min-w-0">
                <h3 className="text-sm text-foreground truncate" style={{ fontWeight: 600 }}>
                  {config.title}
                </h3>
                <p className="text-[11px] text-slate-500 truncate">{config.description}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleAddLocation}
                className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-border bg-white text-slate-700 text-[12px] hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer"
                style={{ fontWeight: 500 }}
              >
                <Plus className="w-3.5 h-3.5" />
                Add location
              </button>
              <span aria-hidden className="h-5 w-px bg-[#E8ECF1]" />
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-500 hover:bg-muted transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search partners & locations..."
              className="w-full h-9 pl-9 pr-3 rounded-lg border border-border bg-white text-sm text-foreground placeholder:text-slate-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
              autoFocus
            />
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto" style={{ maxHeight: 420 }}>
          {filteredPartners.length === 0 ? (
            <div className="py-10 text-center">
              <Search className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500" style={{ fontWeight: 500 }}>No results found</p>
              <p className="text-xs text-slate-400 mt-0.5">Try a different search term</p>
            </div>
          ) : (
            <div className="py-1">
              {filteredPartners.map((p) => {
                const allLocs = PARTNER_ADDRESSES[p.id] || [];
                const q = search.trim().toLowerCase();
                const hasSearch = q.length > 0;
                const matchedLocs = hasSearch
                  ? allLocs.filter((l) => matchesQuery(l, q))
                  : allLocs;
                const partnerNameMatch = hasSearch && p.name.toLowerCase().includes(q);
                const isExpanded = hasSearch
                  ? (matchedLocs.length > 0 || partnerNameMatch)
                  : expanded.has(p.id);
                /* Primary only renders for the current customer.
                   Other partners' defaults are reference data, not
                   "primary for this Quote/SO". */
                const isCurrentCustomer = p.id === currentCustomer.id;
                const partnerHasPrimary = isCurrentCustomer && primaryAddressId != null && allLocs.some((l) => l.id === primaryAddressId);
                const avatarColor = AVATAR_COLORS[p.id] ?? DEFAULT_AVATAR;
                const locsToShow = hasSearch && !partnerNameMatch ? matchedLocs : allLocs;
                return (
                  <div key={p.id} className="border-b border-slate-50 last:border-b-0">
                    <button
                      type="button"
                      onClick={() => toggleExpand(p.id)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-slate-50 text-left"
                    >
                      <div className="w-5 h-5 flex items-center justify-center rounded text-slate-400 shrink-0">
                        {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      </div>
                      <div
                        className="w-8 h-8 rounded-md flex items-center justify-center text-white text-[10px] shrink-0"
                        style={{ fontWeight: 700, backgroundColor: avatarColor }}
                      >
                        {initials(p.name)}
                      </div>
                      <span className="text-[13px] text-foreground truncate flex-1" style={{ fontWeight: 600 }}>
                        <HighlightText text={p.name} searchTerm={search} />
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        {partnerHasPrimary && (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-[2px] rounded-md text-blue-800 bg-blue-50 border border-blue-200 text-[10px]"
                            style={{ fontWeight: 600 }}
                          >
                            <Star className="w-2.5 h-2.5 fill-blue-800 text-blue-800" />
                            Primary
                          </span>
                        )}
                        <span
                          className="text-[10px] text-slate-400 bg-slate-50 border border-[#E8ECF1] px-1.5 py-0.5 rounded"
                          style={{ fontWeight: 500 }}
                        >
                          {allLocs.length} loc{allLocs.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </button>
                    {isExpanded && locsToShow.length > 0 && (
                      <div className="ml-9 border-l border-[#E8ECF1] bg-[#FAFBFC]/50">
                        {locsToShow.map((addr) => {
                          /* Primary + Set-as-primary affordances only
                             render for the current customer's rows. */
                          const isPrimary = isCurrentCustomer && primaryAddressId === addr.id;
                          const canSetPrimary = isCurrentCustomer && !isPrimary;
                          const isSelected = currentAddress?.id === addr.id;
                          return (
                            <div
                              key={addr.id}
                              className={`group relative w-full flex items-center gap-3 pl-4 pr-4 py-2 transition-colors hover:bg-muted ${isSelected ? "bg-accent/60" : ""}`}
                            >
                              <button
                                type="button"
                                onClick={() => handleSelect(addr, p)}
                                className="flex items-center gap-3 flex-1 min-w-0 text-left cursor-pointer"
                              >
                                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <div className="flex flex-col min-w-0">
                                  <span className="text-[12px] text-slate-700 truncate" style={{ fontWeight: 500 }}>
                                    <HighlightText text={addr.label} searchTerm={search} />
                                  </span>
                                  <span className="text-[10.5px] text-slate-500 truncate">
                                    <HighlightText text={`${addr.city}, ${addr.state} · ${addr.country}`} searchTerm={search} />
                                  </span>
                                </div>
                              </button>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {isPrimary && (
                                  <span
                                    className="inline-flex items-center gap-1 px-2 py-[2px] rounded-md text-blue-800 bg-blue-50 border border-blue-200 text-[10px]"
                                    style={{ fontWeight: 600 }}
                                  >
                                    <Star className="w-2.5 h-2.5 fill-blue-800 text-blue-800" />
                                    Primary
                                  </span>
                                )}
                                {canSetPrimary && (
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setPrimary(p, addr); }}
                                    title="Set as primary"
                                    className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity inline-flex items-center gap-1 px-2 py-[2px] rounded-md text-slate-600 bg-white border border-slate-200 hover:text-blue-800 hover:bg-blue-50 hover:border-blue-200 text-[10px] cursor-pointer"
                                    style={{ fontWeight: 600 }}
                                  >
                                    <Star className="w-2.5 h-2.5" />
                                    Set as primary
                                  </button>
                                )}
                                {isSelected && <Check className="w-4 h-4 text-primary" />}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-muted bg-[#FAFBFC] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            {currentAddress ? (
              <>
                <div className="w-1.5 h-1.5 rounded-full bg-[#22C55E] shrink-0" />
                <span className="text-xs text-slate-700 truncate" style={{ fontWeight: 500 }}>
                  Selected: <span style={{ fontWeight: 600 }}>{currentAddress.label}</span>
                </span>
              </>
            ) : (
              <span className="text-[11px] text-slate-500">Pick a partner location to continue.</span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs hover:bg-[#0966DB] transition-colors cursor-pointer"
            style={{ fontWeight: 600 }}
          >
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
