import React, { useState, useRef, useCallback, useEffect } from "react";
import { Phone, Mail, Building2, Users } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../ui/popover";
import type { ContactPerson } from "./partnerConstants";

export const POC_DEPT_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  "Sales": { bg: "#EBF3FF", text: "hsl(var(--primary))", dot: "hsl(var(--primary))" },
  "Supply Chain Management": { bg: "#E8FAF3", text: "hsl(var(--success))", dot: "hsl(var(--success))" },
  "Finance": { bg: "#FEF5E7", text: "hsl(var(--warning))", dot: "hsl(var(--warning))" },
};

export const POC_AVATAR_TINTS: Record<string, { bg: string; text: string }> = {
  "hsl(var(--primary))": { bg: "#EBF3FF", text: "hsl(var(--primary))" },
  "hsl(var(--violet))": { bg: "#F0EBFF", text: "hsl(var(--violet))" },
  "hsl(var(--success))": { bg: "#E8FAF3", text: "hsl(var(--success))" },
  "hsl(var(--warning))": { bg: "#FEF5E7", text: "#B45D04" },
  "hsl(var(--destructive))": { bg: "#FEF2F2", text: "hsl(var(--destructive))" },
  "#0891B2": { bg: "#ECFEFF", text: "#0891B2" },
  "#4F46E5": { bg: "#EEF2FF", text: "#4F46E5" },
  "#BE185D": { bg: "#FDF2F8", text: "#BE185D" },
  "#65A30D": { bg: "#F7FEE7", text: "#65A30D" },
  "#EA580C": { bg: "#FFF7ED", text: "#EA580C" },
  "#16A34A": { bg: "#F0FDF4", text: "#16A34A" },
  "#CA8A04": { bg: "#FEFCE8", text: "#CA8A04" },
  // Vendor data bgColor values
  "#0ea5e9": { bg: "#F0F9FF", text: "#0284C7" },
  "#8b5cf6": { bg: "#F5F3FF", text: "hsl(var(--violet))" },
  "#f59e0b": { bg: "#FFFBEB", text: "hsl(var(--warning))" },
  "#10b981": { bg: "#ECFDF5", text: "hsl(var(--success))" },
  "#6366f1": { bg: "#EEF2FF", text: "#4F46E5" },
  "#ec4899": { bg: "#FDF2F8", text: "#DB2777" },
};

export function getPocAvatarTint(color: string) {
  return POC_AVATAR_TINTS[color] || { bg: "#F0F4FF", text: color };
}

export function getPocInitials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

// ── Quick View Card for a POC Contact ──
export function PocQuickViewCard({ contact }: { contact: ContactPerson }) {
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
          <div className="min-w-0">
            <span className="text-white text-[13px] block truncate" style={{ fontWeight: 600 }}>
              {contact.name}
            </span>
            <span className="text-[11px] text-slate-400 block truncate">
              {contact.department}
            </span>
          </div>
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
        <div className="flex items-center gap-3 pt-2 border-t border-muted">
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px]"
            style={{ backgroundColor: dc.bg, color: dc.text, fontWeight: 600 }}
          >
            {contact.department}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Hoverable POC Chip with Quick View Popover ──
export function PocChipWithPopover({ contact }: { contact: ContactPerson }) {
  const [chipOpen, setChipOpen] = useState(false);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dc = POC_DEPT_COLORS[contact.department] || POC_DEPT_COLORS["Sales"];
  const at = getPocAvatarTint(contact.avatarColor);
  const initials = getPocInitials(contact.name);

  const handleEnter = useCallback(() => {
    if (leaveTimer.current) { clearTimeout(leaveTimer.current); leaveTimer.current = null; }
    setChipOpen(true);
  }, []);

  const handleLeave = useCallback(() => {
    leaveTimer.current = setTimeout(() => setChipOpen(false), 150);
  }, []);

  return (
    <Popover open={chipOpen} onOpenChange={(o) => { if (!o) setChipOpen(false); }}>
      <PopoverTrigger
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] border border-border bg-slate-50 text-slate-700 hover:border-blue-200 hover:bg-accent hover:shadow-[0_2px_8px_-2px_rgba(10,119,255,0.10)] transition-all duration-150 cursor-default shrink-0"
        style={{ fontWeight: 500 }}
      >
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
        <PocQuickViewCard contact={contact} />
      </PopoverContent>
    </Popover>
  );
}

// ── Overflow list row with side quick-view on hover ──
export function PocOverflowRow({ contact }: { contact: ContactPerson }) {
  const [hovered, setHovered] = useState(false);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const at = getPocAvatarTint(contact.avatarColor);
  const initials = getPocInitials(contact.name);

  const handleEnter = useCallback(() => {
    if (leaveTimer.current) { clearTimeout(leaveTimer.current); leaveTimer.current = null; }
    setHovered(true);
  }, []);

  const handleLeave = useCallback(() => {
    leaveTimer.current = setTimeout(() => setHovered(false), 150);
  }, []);

  return (
    <Popover open={hovered} onOpenChange={(o) => { if (!o) setHovered(false); }}>
      <PopoverTrigger
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        className={`flex items-center gap-2.5 w-full px-3 py-[9px] text-left transition-colors duration-100 cursor-default ${
          hovered ? "bg-accent" : "hover:bg-slate-50"
        }`}
      >
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
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <PocQuickViewCard contact={contact} />
      </PopoverContent>
    </Popover>
  );
}

// ── Single-row POC pills with dynamic overflow detection ──
export function PocPillsRow({
  contacts,
  onManage,
}: {
  contacts: ContactPerson[];
  onManage: () => void;
}) {
  const measureRef = useRef<HTMLDivElement>(null);
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

  const overflowCount = contacts.length - visibleCount;
  const visibleContacts = contacts.slice(0, visibleCount);
  const overflowContacts = contacts.slice(visibleCount);

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
          <Users className="w-3 h-3" />
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
          <PocChipWithPopover key={c.id} contact={c} />
        ))}
        {overflowCount > 0 && (
          <Popover>
            <PopoverTrigger
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
                  <PocOverflowRow key={c.id} contact={c} />
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  );
}