import * as React from "react";
import { ChevronDown, ChevronUp, Search, Check, Globe } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { cn } from "./utils";
import {
  CURRENCY_LIBRARY,
  flagUrlFor,
  getLibraryCurrency,
  type LibraryCurrency,
} from "@/app/data/currencyLibrary";

export interface CurrencyLibrarySelectProps {
  value: string | undefined;            // ISO 4217 alpha-3 (any case)
  onChange: (code: string) => void;     // emits uppercase code
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  /** Width of the popover content. Defaults to matching the trigger. */
  contentWidthClass?: string;
}

/**
 * Currency selector that mirrors the Currency Library dropdown:
 * - Full ISO 4217 list (156 active currencies).
 * - Each row: [country flag from flagcdn.com] [CODE bold] [Full name].
 * - Multi-country currencies (EUR, XAF, XOF, XCD, XCG, XPF) show a globe fallback.
 * - Search filters across code, name, and country/region in real time.
 */
export function CurrencyLibrarySelect({
  value,
  onChange,
  disabled,
  placeholder = "Select a currency",
  className,
  contentWidthClass = "w-[var(--radix-popover-trigger-width)]",
}: CurrencyLibrarySelectProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const selected = getLibraryCurrency(value);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return CURRENCY_LIBRARY;
    return CURRENCY_LIBRARY.filter((c) => {
      return (
        c.code.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.region.toLowerCase().includes(q)
      );
    });
  }, [search]);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSearch("");
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "w-full h-10 px-3 rounded-lg border bg-white flex items-center justify-between text-sm transition-colors",
            open ? "border-primary ring-2 ring-primary/10" : "border-border hover:border-slate-300",
            disabled && "opacity-60 cursor-not-allowed hover:border-border",
            className,
          )}
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          {selected ? (
            <span className="flex items-center gap-2 text-foreground truncate">
              <FlagOrGlobe currency={selected} size={20} />
              <span className="font-semibold">{selected.code}</span>
              <span className="text-slate-600 truncate">{selected.name}</span>
            </span>
          ) : (
            <span className="text-slate-400">{placeholder}</span>
          )}
          {open ? (
            <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className={cn(contentWidthClass, "p-0 rounded-xl border border-border shadow-lg z-[250]")}
        align="start"
        sideOffset={4}
        style={{ maxHeight: "min(420px, var(--radix-popover-content-available-height))" }}
      >
        <div className="p-3 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by code, name, or country…"
              className="w-full h-9 pl-9 pr-3 rounded-lg border border-border bg-white text-sm text-foreground placeholder:text-slate-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
              autoFocus
            />
          </div>
        </div>
        <div className="border-t border-muted" style={{ maxHeight: 340, overflowY: "auto" }}>
          {filtered.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-400">No currencies match "{search}"</div>
          ) : (
            <ul role="listbox" className="py-1">
              {filtered.map((c) => {
                const isSelected = selected?.code === c.code;
                return (
                  <li key={c.code}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => {
                        onChange(c.code);
                        setOpen(false);
                        setSearch("");
                      }}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-slate-50",
                        isSelected && "bg-accent/40",
                      )}
                    >
                      <FlagOrGlobe currency={c} size={20} />
                      <span className="w-12 text-[13px] font-semibold text-foreground shrink-0">{c.code}</span>
                      <span className="flex-1 min-w-0 text-[13px] text-slate-600 truncate">{c.name}</span>
                      {isSelected && <Check className="w-4 h-4 text-primary shrink-0" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function FlagOrGlobe({ currency, size = 20 }: { currency: LibraryCurrency; size?: number }) {
  const url = flagUrlFor(currency.country);
  const height = Math.round((size * 3) / 4);
  if (!url) {
    return (
      <span
        className="inline-flex items-center justify-center rounded-sm bg-slate-100 text-slate-500 shrink-0"
        style={{ width: size, height }}
        aria-label={`${currency.code} multi-country`}
      >
        <Globe className="w-3 h-3" />
      </span>
    );
  }
  return (
    <img
      src={url}
      width={size}
      height={height}
      loading="lazy"
      alt={`${currency.code} flag`}
      className="rounded-sm shrink-0 object-cover bg-slate-100"
      style={{ width: size, height }}
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).style.display = "none";
      }}
    />
  );
}
