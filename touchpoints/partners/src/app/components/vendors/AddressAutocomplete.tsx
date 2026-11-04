import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { Search, X, MapPin } from "lucide-react";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

const MOCK_ADDRESS_SUGGESTIONS = [
  { main: "350 Fifth Avenue", secondary: "New York, NY 10118, USA" },
  { main: "1600 Amphitheatre Parkway", secondary: "Mountain View, CA 94043, USA" },
  { main: "1 Apple Park Way", secondary: "Cupertino, CA 95014, USA" },
  { main: "One Microsoft Way", secondary: "Redmond, WA 98052, USA" },
  { main: "410 Terry Ave North", secondary: "Seattle, WA 98109, USA" },
  { main: "1 Hacker Way", secondary: "Menlo Park, CA 94025, USA" },
  { main: "Unter den Linden 77", secondary: "10117 Berlin, Germany" },
  { main: "1-7-1 Konan, Minato-ku", secondary: "Tokyo 108-0075, Japan" },
  { main: "221B Baker Street", secondary: "London, NW1 6XE, United Kingdom" },
  { main: "1 Infinite Loop", secondary: "Cupertino, CA 95014, USA" },
  { main: "30 Hudson Yards", secondary: "New York, NY 10001, USA" },
  { main: "233 S Wacker Dr", secondary: "Chicago, IL 60606, USA" },
  { main: "4 Privet Drive", secondary: "Little Whinging, Surrey, UK" },
  { main: "1313 Disneyland Dr", secondary: "Anaheim, CA 92802, USA" },
  { main: "11 Wall Street", secondary: "New York, NY 10005, USA" },
  { main: "1 World Trade Center", secondary: "New York, NY 10007, USA" },
  { main: "500 Terry A Francois Blvd", secondary: "San Francisco, CA 94158, USA" },
  { main: "2300 Traverwood Dr", secondary: "Ann Arbor, MI 48105, USA" },
  { main: "8 Rue du Faubourg", secondary: "75008 Paris, France" },
  { main: "Marienplatz 1", secondary: "80331 Munich, Germany" },
  { main: "1 Harbourside Crescent", secondary: "Sydney, NSW 2000, Australia" },
  { main: "Via Roma 28", secondary: "00184 Rome, Italy" },
  { main: "Rua Augusta 274", secondary: "S\u00e3o Paulo, SP 01305-000, Brazil" },
  { main: "100 Universal City Plaza", secondary: "Universal City, CA 91608, USA" },
];

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  id?: string;
}

export function AddressAutocomplete({
  value,
  onChange,
  label = "Address",
  placeholder = "Search for an address...",
  id = "address-field",
}: AddressAutocompleteProps) {
  const [focused, setFocused] = useState(false);
  const [selected, setSelected] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const suggestions = useMemo(() => {
    if (!value.trim() || value.length < 2 || selected) return [];
    const words = value.toLowerCase().split(/\s+/).filter(Boolean);
    return MOCK_ADDRESS_SUGGESTIONS.filter((s) => {
      const full = `${s.main} ${s.secondary}`.toLowerCase();
      return words.every((w) => full.includes(w));
    }).slice(0, 6);
  }, [value, selected]);

  // Close dropdown when clicking outside both input area and dropdown
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (wrapperRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setFocused(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = useCallback(
    (main: string, secondary: string) => {
      onChange(`${main}, ${secondary}`);
      setFocused(false);
      setSelected(true);
    },
    [onChange]
  );

  const handleClear = useCallback(() => {
    onChange("");
    setFocused(true);
    setSelected(false);
  }, [onChange]);

  return (
    <div ref={wrapperRef} className="relative">
      {label && (
        <Label htmlFor={id} className="text-xs sm:text-[13px] text-foreground" style={{ fontWeight: 500 }}>
          {label}
        </Label>
      )}
      <div className="relative mt-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none z-[1]" />
        <Input
          id={id}
          placeholder={placeholder}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setSelected(false);
          }}
          onFocus={() => {
            setFocused(true);
            if (selected) setSelected(false);
          }}
          className="pl-9 pr-8 rounded-lg border-border bg-white !h-10 text-sm text-foreground placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary/20"
        />
        {value.length > 0 && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-500 transition-colors z-[1]"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        {/* Suggestions dropdown — absolute below input */}
        {focused && suggestions.length > 0 && (
          <div
            ref={dropdownRef}
            className="absolute left-0 right-0 top-full z-[100] rounded-lg border border-border bg-white overflow-hidden"
            style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.04)" }}
          >
            {suggestions.map((suggestion, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelect(suggestion.main, suggestion.secondary)}
                className="w-full flex items-start gap-3 px-3 py-2.5 text-left hover:bg-[#F0F7FF] transition-colors cursor-pointer border-b border-muted last:border-b-0"
              >
                <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
                  <MapPin className="w-3.5 h-3.5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] text-foreground truncate" style={{ fontWeight: 500 }}>{suggestion.main}</div>
                  <div className="text-[11px] text-slate-400 truncate mt-0.5">{suggestion.secondary}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
