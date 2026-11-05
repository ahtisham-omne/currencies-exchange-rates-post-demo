import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Phone, Mail, Building2, Settings2, Star, X } from "lucide-react";
import { PrimaryPill } from "./PrimaryPill";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../ui/popover";
import type { ContactPerson } from "./partnerConstants";

export const POC_DEPT_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  "Sales": { bg: "#EBF3FF", text: "rgb(var(--primary))", dot: "rgb(var(--primary))" },
  "Supply Chain Management": { bg: "#E8FAF3", text: "rgb(var(--success))", dot: "rgb(var(--success))" },
  "Finance": { bg: "#FEF5E7", text: "rgb(var(--warning))", dot: "rgb(var(--warning))" },
};

export const POC_AVATAR_TINTS: Record<string, { bg: string; text: string }> = {
  "rgb(var(--primary))": { bg: "#EBF3FF", text: "rgb(var(--primary))" },
  "rgb(var(--violet))": { bg: "#F0EBFF", text: "rgb(var(--violet))" },
  "rgb(var(--success))": { bg: "#E8FAF3", text: "rgb(var(--success))" },
  "rgb(var(--warning))": { bg: "#FEF5E7", text: "#B45D04" },
  "rgb(var(--destructive))": { bg: "#FEF2F2", text: "rgb(var(--destructive))" },
  "#0891B2": { bg: "#ECFEFF", text: "#0891B2" },
  "#4F46E5": { bg: "#EEF2FF", text: "#4F46E5" },
  "#BE185D": { bg: "#FDF2F8", text: "#BE185D" },
  "#65A30D": { bg: "#F7FEE7", text: "#65A30D" },
  "#EA580C": { bg: "#FFF7ED", text: "#EA580C" },
  "#16A34A": { bg: "#F0FDF4", text: "#16A34A" },
  "#CA8A04": { bg: "#FEFCE8", text: "#CA8A04" },
  // Vendor data bgColor values
  "#0ea5e9": { bg: "#F0F9FF", text: "#0284C7" },
  "#8b5cf6": { bg: "#F5F3FF", text: "rgb(var(--violet))" },
  "#f59e0b": { bg: "#FFFBEB", text: "rgb(var(--warning))" },
  "#10b981": { bg: "#ECFDF5", text: "rgb(var(--success))" },
  "#6366f1": { bg: "#EEF2FF", text: "#4F46E5" },
  "#ec4899": { bg: "#FDF2F8", text: "#DB2777" },
};

export function getPocAvatarTint(color: string) {
  return POC_AVATAR_TINTS[color] || { bg: "#F0F4FF", text: color };
}

export function getPocInitials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

// ── Shared hover intent for quick-view popovers ──
// Opening waits `openDelay` so the card doesn't flash while the cursor
// sweeps across a row of pills; closing waits `closeDelay` so the user
// can travel from trigger into the card without it collapsing.
function useHoverIntent(openDelay = 400, closeDelay = 200) {
  const [open, setOpen] = useState(false);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleEnter = useCallback(() => {
    if (leaveTimer.current) { clearTimeout(leaveTimer.current); leaveTimer.current = null; }
    if (openTimer.current) return;
    openTimer.current = setTimeout(() => {
      openTimer.current = null;
      setOpen(true);
    }, openDelay);
  }, [openDelay]);

  const handleLeave = useCallback(() => {
    if (openTimer.current) { clearTimeout(openTimer.current); openTimer.current = null; }
    leaveTimer.current = setTimeout(() => setOpen(false), closeDelay);
  }, [closeDelay]);

  useEffect(() => () => {
    if (openTimer.current) clearTimeout(openTimer.current);
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
  }, []);

  return { open, setOpen, handleEnter, handleLeave };
}

// ── Quick View Card for a POC Contact ──
export function PocQuickViewCard({ contact, isPrimary = false, onSetPrimary, onRemove }: {
  contact: ContactPerson;
  /** When true, the header carries a Primary pill — the current
   *  designated primary POC for this surface. */
  isPrimary?: boolean;
  /** When provided, the footer renders a "Set as Primary" pill button
   *  so the user can promote this contact directly from the hover
   *  card. Suppressed automatically when isPrimary is already true. */
  onSetPrimary?: () => void;
  /** When provided, the footer renders a Remove button so the user
   *  can drop this POC from the surface without re-opening the
   *  picker modal. */
  onRemove?: () => void;
}) {
  const dc = POC_DEPT_COLORS[contact.department] || POC_DEPT_COLORS["Sales"];
  const at = getPocAvatarTint(contact.avatarColor);
  const initials = getPocInitials(contact.name);

  return (
    <div className="w-[280px] rounded-xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-border/60">
      {/* Dark gradient header */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-700 px-3.5 py-3 relative overflow-hidden">
        <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/[0.04]" />
        <div className="flex items-center gap-2.5 relative">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] shrink-0"
            style={{ backgroundColor: at.bg, color: at.text, fontWeight: 700 }}
          >
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-white text-[13px] block truncate" style={{ fontWeight: 600 }}>
              {contact.name}
            </span>
            <span className="text-[11px] text-slate-400 block truncate">
              {contact.department}
            </span>
          </div>
          {isPrimary && <PrimaryPill className="shrink-0" />}
        </div>
      </div>
      {/* Body */}
      <div className="bg-white px-3.5 py-3 space-y-2.5">
        {contact.company && (
          <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
            <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
            <span className="truncate">{contact.company}</span>
          </div>
        )}
        {contact.phone && (
          <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
            <Phone className="w-3 h-3 text-slate-400 shrink-0" />
            <span className="truncate">{contact.phone}{contact.phoneExt ? ` ext. ${contact.phoneExt}` : ""}</span>
          </div>
        )}
        {contact.email && (
          <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
            <Mail className="w-3 h-3 text-slate-400 shrink-0" />
            <span className="truncate">{contact.email}</span>
          </div>
        )}
        {/* Footer actions — Set as Primary on the left, Remove on the
            right. Department pill dropped because the header already
            carries it under the contact name. Footer hidden entirely
            when neither callback is wired (e.g. read-only directories). */}
        {(onSetPrimary || onRemove) && (
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-muted">
            <div className="shrink-0">
              {onSetPrimary && !isPrimary ? (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onSetPrimary(); }}
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border border-border bg-white text-[11px] text-slate-600 hover:text-slate-800 hover:border-slate-300 hover:bg-slate-50 transition-colors cursor-pointer"
                  style={{ fontWeight: 500 }}
                  aria-label="Set as Primary POC"
                >
                  <Star className="w-3 h-3" />
                  Set as Primary
                </button>
              ) : null}
            </div>
            {onRemove && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onRemove(); }}
                className="inline-flex items-center justify-center w-6 h-6 rounded-md border border-border bg-white text-slate-400 hover:text-destructive hover:border-destructive/30 hover:bg-red-50 transition-colors cursor-pointer shrink-0"
                aria-label="Remove POC"
                title="Remove this contact"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Hoverable POC Chip with Quick View Popover ──
export function PocChipWithPopover({ contact, isPrimary = false, onSetPrimary, onRemove }: {
  contact: ContactPerson;
  /** True when this pill represents the primary POC for the parent
   *  surface — the chip renders a leading amber star and the hover
   *  card carries a Primary badge. */
  isPrimary?: boolean;
  /** When provided, the hover card adds a "Set as primary" CTA so the
   *  user can promote this contact directly. */
  onSetPrimary?: () => void;
  /** When provided, the hover card adds a Remove button so the user
   *  can drop this POC from the surface. */
  onRemove?: () => void;
}) {
  const { open: chipOpen, setOpen: setChipOpen, handleEnter, handleLeave } = useHoverIntent();
  const dc = POC_DEPT_COLORS[contact.department] || POC_DEPT_COLORS["Sales"];
  const at = getPocAvatarTint(contact.avatarColor);
  const initials = getPocInitials(contact.name);

  return (
    <Popover open={chipOpen} onOpenChange={(o) => { if (!o) setChipOpen(false); }}>
      <PopoverTrigger
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        className={`inline-flex items-center gap-1.5 pl-1.5 pr-2 py-1 rounded-lg text-[11px] border transition-all duration-150 cursor-default shrink-0 ${
          isPrimary
            ? "bg-blue-50 border-blue-200 text-blue-900 hover:bg-blue-100/70 hover:shadow-[0_2px_8px_-2px_rgba(10,119,255,0.18)]"
            : "bg-slate-50 border-border text-slate-700 hover:border-blue-200 hover:bg-accent hover:shadow-[0_2px_8px_-2px_rgba(10,119,255,0.10)]"
        }`}
        style={{ fontWeight: 500 }}
      >
        {/* Star indicator — primary only (stakeholder ask 2026-08-20:
            no grey outline stars on the other pills). Promotion happens
            via the hover card's "Set as Primary" action. */}
        {isPrimary && <Star className="w-3 h-3 text-blue-800 fill-blue-800 shrink-0" />}
        <span
          className="w-[18px] h-[18px] rounded-full flex items-center justify-center text-[7px] shrink-0"
          style={{ backgroundColor: at.bg, color: at.text, fontWeight: 700 }}
        >
          {initials}
        </span>
        {contact.name.split(" ")[0]}
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        sideOffset={6}
        className="p-0 w-auto border-0 shadow-none bg-transparent z-[200]"
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <PocQuickViewCard contact={contact} isPrimary={isPrimary} onSetPrimary={onSetPrimary} onRemove={onRemove} />
      </PopoverContent>
    </Popover>
  );
}

// ── Overflow list row with side quick-view on hover ──
export function PocOverflowRow({ contact, isPrimary = false, onSetPrimary, onRemove, pin }: {
  contact: ContactPerson;
  isPrimary?: boolean;
  onSetPrimary?: () => void;
  onRemove?: () => void;
  /** Hover handlers of the parent overflow dropdown. The side quick-view
   *  card renders in a portal outside the dropdown's DOM, so hovering it
   *  would otherwise read as leaving the dropdown and collapse it. */
  pin?: { enter: () => void; leave: () => void };
}) {
  const { open: hovered, setOpen: setHovered, handleEnter, handleLeave } = useHoverIntent();
  const at = getPocAvatarTint(contact.avatarColor);
  const initials = getPocInitials(contact.name);

  return (
    <Popover open={hovered} onOpenChange={(o) => { if (!o) setHovered(false); }}>
      <PopoverTrigger
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        className={`flex items-center gap-2.5 w-full px-3 py-[9px] text-left transition-colors duration-100 cursor-default ${
          hovered ? "bg-accent" : "hover:bg-slate-50"
        }`}
      >
        {/* Star indicator — primary only, mirroring the chip pattern
            (no grey outline stars). Promotion happens via the side
            quick-view card's "Set as Primary" action. */}
        {isPrimary && <Star className="w-3 h-3 text-blue-800 fill-blue-800 shrink-0" />}
        <span
          className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] shrink-0"
          style={{ backgroundColor: at.bg, color: at.text, fontWeight: 700 }}
        >
          {initials}
        </span>
        <span
          className={`flex-1 text-[13px] truncate ${hovered ? "text-primary" : "text-foreground"}`}
          style={{ fontWeight: hovered ? 600 : 500 }}
        >
          {contact.name}
        </span>
        <span className="text-[11px] text-slate-400 shrink-0" style={{ fontWeight: 400 }}>
          {contact.department === "Supply Chain Management" ? "SCM" : contact.department}
        </span>
      </PopoverTrigger>
      <PopoverContent
        side="right"
        align="start"
        sideOffset={4}
        className="p-0 w-auto border-0 shadow-none bg-transparent z-[200]"
        onMouseEnter={() => { handleEnter(); pin?.enter(); }}
        onMouseLeave={() => { handleLeave(); pin?.leave(); }}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <PocQuickViewCard contact={contact} isPrimary={isPrimary} onSetPrimary={onSetPrimary} onRemove={onRemove} />
      </PopoverContent>
    </Popover>
  );
}

// ── Single-row POC pills with dynamic overflow detection ──
export function PocPillsRow({
  contacts,
  onManage,
  primaryPocId,
  onSetPrimary,
  onRemove,
}: {
  contacts: ContactPerson[];
  onManage: () => void;
  /** Id of the contact currently designated as primary. The matching
   *  pill renders a leading amber star and its hover card carries a
   *  Primary badge. */
  primaryPocId?: string | null;
  /** When provided, every non-primary pill's hover card adds a
   *  "Set as primary" CTA so the user can promote a contact without
   *  opening the picker modal. */
  onSetPrimary?: (contactId: string) => void;
  /** When provided, every pill's hover card adds a Remove button so
   *  the user can drop a contact from the surface without re-opening
   *  the picker. Caller is responsible for the underlying state. */
  onRemove?: (contactId: string) => void;
}) {
  const measureRef = useRef<HTMLDivElement>(null);
  const overflowHover = useHoverIntent(150);
  const [visibleCount, setVisibleCount] = useState(contacts.length);
  const contactsLenRef = useRef(contacts.length);
  contactsLenRef.current = contacts.length;

  useEffect(() => {
    const el = measureRef.current;
    if (!el) return;

    function measure() {
      if (!el) return;
      const children = Array.from(el.children) as HTMLElement[];
      if (children.length === 0) { setVisibleCount(contactsLenRef.current); return; }

      const rowTop = children[0]?.offsetTop ?? 0;
      let firstOverflow = children.length;

      for (let i = 1; i < children.length; i++) {
        if (children[i].offsetTop > rowTop + 2) {
          firstOverflow = i;
          break;
        }
      }

      if (firstOverflow >= contactsLenRef.current) {
        setVisibleCount(contactsLenRef.current);
      } else {
        setVisibleCount(Math.max(1, firstOverflow - 1));
      }
    }

    const ro = new ResizeObserver(() => {
      setVisibleCount(contactsLenRef.current);
      requestAnimationFrame(measure);
    });
    ro.observe(el);
    requestAnimationFrame(measure);

    return () => ro.disconnect();
  }, [contacts]);

  // Pin the primary POC to the front of the list so it always renders
  // as the first (most-visible) pill — primary should never disappear
  // into the +N overflow if the user has many contacts.
  const orderedContacts = useMemo(() => {
    if (!primaryPocId) return contacts;
    const primary = contacts.find((c) => c.id === primaryPocId);
    if (!primary) return contacts;
    return [primary, ...contacts.filter((c) => c.id !== primaryPocId)];
  }, [contacts, primaryPocId]);
  const overflowCount = orderedContacts.length - visibleCount;
  const visibleContacts = orderedContacts.slice(0, visibleCount);
  const overflowContacts = orderedContacts.slice(visibleCount);

  return (
    <div className="px-3 py-2.5">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[12px] text-foreground" style={{ fontWeight: 600 }}>
          {contacts.length} Contact{contacts.length !== 1 ? "s" : ""} Assigned
        </p>
        <button
          onClick={onManage}
          className="inline-flex items-center gap-1 px-2.5 py-[5px] rounded-lg bg-slate-50 border border-border text-[11px] text-muted-foreground hover:bg-white hover:border-slate-300 hover:shadow-sm transition-all duration-150 shrink-0 cursor-pointer"
          style={{ fontWeight: 500 }}
        >
          <Settings2 className="w-3 h-3" />
          Manage
        </button>
      </div>
      {/* Hidden measurement row */}
      <div
        ref={measureRef}
        aria-hidden="true"
        className="flex flex-wrap items-center gap-1.5"
        style={{ position: "absolute", visibility: "hidden", pointerEvents: "none", left: 12, right: 12, maxHeight: 34, overflow: "hidden" }}
      >
        {contacts.map((c) => (
          <span
            key={c.id}
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] border border-transparent shrink-0"
            style={{ fontWeight: 500 }}
          >
            <span className="w-[18px] h-[18px] rounded-full shrink-0" />
            {c.name.split(" ")[0]}
            <span className="w-1.5 h-1.5 rounded-full shrink-0" />
          </span>
        ))}
      </div>
      {/* Visible row */}
      <div className="flex items-center gap-1.5 flex-nowrap overflow-hidden">
        {visibleContacts.map((c) => (
          <PocChipWithPopover
            key={c.id}
            contact={c}
            isPrimary={primaryPocId === c.id}
            onSetPrimary={onSetPrimary ? () => onSetPrimary(c.id) : undefined}
            onRemove={onRemove ? () => onRemove(c.id) : undefined}
          />
        ))}
        {overflowCount > 0 && (
          <Popover open={overflowHover.open} onOpenChange={(o) => { if (!o) overflowHover.setOpen(false); }}>
            <PopoverTrigger
              onMouseEnter={overflowHover.handleEnter}
              onMouseLeave={overflowHover.handleLeave}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] border border-border bg-slate-50 text-slate-500 hover:border-slate-300 hover:bg-muted transition-all duration-150 cursor-default shrink-0"
              style={{ fontWeight: 500 }}
            >
              +{overflowCount} more
            </PopoverTrigger>
            <PopoverContent
              side="bottom"
              align="start"
              sideOffset={6}
              className="p-0 w-[300px] rounded-xl z-[200] overflow-hidden"
              onMouseEnter={overflowHover.handleEnter}
              onMouseLeave={overflowHover.handleLeave}
              onOpenAutoFocus={(e) => e.preventDefault()}
            >
              <div className="px-3 pt-3 pb-2">
                <p className="text-[13px] text-slate-500" style={{ fontWeight: 500 }}>
                  +{overflowCount} more contact{overflowCount !== 1 ? "s" : ""}
                </p>
              </div>
              <div className="border-t border-muted" />
              <div className="max-h-[320px] overflow-y-auto py-1">
                {overflowContacts.map((c) => (
                  <PocOverflowRow
                    key={c.id}
                    contact={c}
                    isPrimary={primaryPocId === c.id}
                    onSetPrimary={onSetPrimary ? () => onSetPrimary(c.id) : undefined}
                    onRemove={onRemove ? () => onRemove(c.id) : undefined}
                    pin={{ enter: overflowHover.handleEnter, leave: overflowHover.handleLeave }}
                  />
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  );
}