import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { ChevronUp, ChevronDown, Search, Check } from "lucide-react";
import { highlightMatch } from "../../lib/highlight-text";
import { formatPhone, maxFormattedLength } from "../../lib/phone-format";

const COUNTRIES = [
  { code: "+1", flag: "🇺🇸", label: "USA" },
  { code: "+44", flag: "🇬🇧", label: "UK" },
  { code: "+49", flag: "🇩🇪", label: "Germany" },
  { code: "+81", flag: "🇯🇵", label: "Japan" },
  { code: "+91", flag: "🇮🇳", label: "India" },
  { code: "+33", flag: "🇫🇷", label: "France" },
  { code: "+86", flag: "🇨🇳", label: "China" },
  { code: "+61", flag: "🇦🇺", label: "Australia" },
  { code: "+971", flag: "🇦🇪", label: "UAE" },
  { code: "+55", flag: "🇧🇷", label: "Brazil" },
  { code: "+1", flag: "🇨🇦", label: "Canada" },
  { code: "+52", flag: "🇲🇽", label: "Mexico" },
  { code: "+82", flag: "🇰🇷", label: "South Korea" },
  { code: "+39", flag: "🇮🇹", label: "Italy" },
  { code: "+34", flag: "🇪🇸", label: "Spain" },
];

const DROPDOWN_HEIGHT = 300; // search + list max height estimate

interface PhoneInputProps {
  countryCode: string;
  number: string;
  onCountryCodeChange: (code: string) => void;
  onNumberChange: (num: string) => void;
  placeholder?: string;
  className?: string;
}

export function PhoneInput({
  countryCode,
  number,
  onCountryCodeChange,
  onNumberChange,
  placeholder = "(555) 123-4567",
  className = "",
}: PhoneInputProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; direction: "down" | "up" }>({ top: 0, left: 0, direction: "down" });

  const selected = COUNTRIES.find((c) => c.code === countryCode) || COUNTRIES[0];

  const filtered = COUNTRIES.filter(
    (c) =>
      c.label.toLowerCase().includes(search.toLowerCase()) ||
      c.code.includes(search)
  );

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < DROPDOWN_HEIGHT && rect.top > spaceBelow;
    setPos({
      top: openUp ? rect.top + window.scrollY : rect.bottom + window.scrollY + 4,
      left: rect.left + window.scrollX,
      direction: openUp ? "up" : "down",
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, updatePosition]);

  return (
    <div className={`relative ${className}`}>
      <div
        className={`flex items-center rounded-[8px] border border-[#E2E8F0] bg-white shadow-xs overflow-hidden
          focus-within:ring-1 focus-within:ring-[#007FFF]/20 focus-within:border-[#007FFF] transition-all`}
      >
        {/* Country code trigger */}
        <button
          ref={triggerRef}
          type="button"
          onClick={() => { setOpen(!open); setSearch(""); }}
          className="flex items-center gap-1.5 h-9 sm:h-10 pl-3 pr-2 text-sm text-[#0F172A] bg-transparent hover:bg-[#F8FAFC] transition-colors shrink-0 cursor-pointer"
        >
          <span className="text-base leading-none">{selected.flag}</span>
          <span className="font-medium">{selected.code}</span>
          {open ? (
            <ChevronUp className="w-3.5 h-3.5 text-[#94A3B8]" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-[#94A3B8]" />
          )}
        </button>

        {/* Divider */}
        <div className="w-px self-stretch bg-[#E2E8F0] shrink-0" />

        {/* Phone number input, formatted live by formatPhone() so the value
         *  stays in canonical shape (e.g. "(390) 412-9029") for the current
         *  dial code regardless of what the user types or pastes. `maxLength`
         *  caps the input at the formatted length, so keystrokes past a full
         *  number are silently ignored by the browser. */}
        <input
          type="tel"
          value={number}
          onChange={(e) => onNumberChange(formatPhone(e.target.value, countryCode))}
          maxLength={maxFormattedLength(countryCode)}
          placeholder={placeholder}
          className="flex-1 min-w-0 h-9 sm:h-10 px-3 text-sm text-[#0F172A] bg-transparent focus:outline-none placeholder:text-[#94A3B8]"
        />
      </div>

      {/* Dropdown, portaled to body to escape overflow clipping */}
      {open && createPortal(
        <div
          ref={dropdownRef}
          className="fixed z-[9999] w-[280px] bg-white rounded-xl border border-[#E2E8F0] shadow-lg overflow-hidden"
          style={{
            top: pos.direction === "up" ? undefined : pos.top,
            bottom: pos.direction === "up" ? window.innerHeight - pos.top + 4 : undefined,
            left: pos.left,
          }}
        >
          {/* Search */}
          <div className="p-2">
            <div className="flex items-center gap-2 px-3 h-9 rounded-[8px] border border-[#E2E8F0] bg-white">
              <Search className="w-4 h-4 text-[#94A3B8] shrink-0" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search country..."
                className="flex-1 text-sm text-[#0F172A] bg-transparent focus:outline-none placeholder:text-[#94A3B8]"
                autoFocus
              />
            </div>
          </div>

          {/* List */}
          <div className="max-h-[240px] overflow-y-auto">
            {filtered.length === 0 && (
              <div className="px-4 py-3 text-sm text-[#94A3B8]">No Results</div>
            )}
            {filtered.map((c, i) => {
              const isSelected = c.code === selected.code && c.label === selected.label;
              return (
                <button
                  key={`${c.label}-${i}`}
                  type="button"
                  onClick={() => {
                    onCountryCodeChange(c.code);
                    /* Re-apply the new dial code's formatting pattern to the
                     * existing digits so the displayed number snaps to the
                     * country's canonical shape (e.g. switching +1 → +44
                     * regroups "(390) 412-9029" → "3904 129 029"). */
                    if (number) onNumberChange(formatPhone(number, c.code));
                    setOpen(false);
                    setSearch("");
                  }}
                  className={`w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-[#F0F5FA] transition-colors cursor-pointer ${
                    isSelected ? "bg-[#EBF5FF]" : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg leading-none">{c.flag}</span>
                    <span className={`font-medium ${isSelected ? "text-[#007FFF]" : "text-[#0F172A]"}`}>{highlightMatch(c.label, search)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={isSelected ? "text-[#007FFF]" : "text-[#64748B]"}>{highlightMatch(c.code, search)}</span>
                    {isSelected && <Check className="w-4 h-4 text-[#007FFF]" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
