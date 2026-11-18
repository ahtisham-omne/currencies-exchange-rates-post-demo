import { useMemo, useState, type ReactNode } from "react";
import { Check, ChevronDown, ChevronUp, Lock, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { CURRENCIES, getCurrency } from "../../currency/currencies";
import { FlagImage } from "./FlagImage";

/* ── The currency dropdown every module uses ──────────────────────────
 * Ported from Partners' CurrencyDropdown (components/vendors/config-helpers.tsx):
 * a 40px field showing the flag and "PKR, Pakistani Rupee", opening on a search
 * by code, name or country over every active currency in the Currency Library,
 * each row its flag, symbol and name. Blues are written out because this app's
 * `primary` token is its near-black, not the Omne blue the dropdown uses.
 *
 * `FlagSearchDropdown` is that dropdown with any list of flagged options, so
 * a country picker in the same form looks and behaves the same. */

export interface FlagOption {
  id: string;
  label: string;
  /** flag-icons code (ISO 3166 alpha-2, lower case, or e.g. "eu"). */
  flag: string | null;
  /** Shown in a narrow column before the label (a currency's symbol). */
  symbol?: string;
  /** Extra words the search matches, e.g. a currency's country. */
  keywords?: string;
}

export function FlagSearchDropdown({
  options,
  value,
  onChange,
  placeholder,
  searchPlaceholder,
  ariaLabel,
  locked,
}: {
  options: FlagOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder: string;
  searchPlaceholder: string;
  ariaLabel: string;
  /** Why it can't be changed. Locked, it keeps the dropdown's face (flag and
   *  label) with a padlock in place of the chevron, and the reason on hover. */
  locked?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selected = options.find((o) => o.id === value);

  if (locked) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            role="button"
            aria-disabled="true"
            aria-label={`${ariaLabel}: ${selected?.label ?? value}. ${locked}`}
            tabIndex={0}
            className="mt-1 w-full h-10 px-3 rounded-lg border border-[#E2E8F0] bg-slate-50 flex items-center justify-between gap-2 text-sm cursor-not-allowed select-none"
          >
            <span className="flex items-center gap-2 min-w-0 text-[#0F172A] truncate" style={{ fontWeight: 500 }}>
              {selected && <FlagImage code={selected.flag} className="shrink-0 text-[13px]" />}
              <span className="truncate">{selected?.label ?? value}</span>
            </span>
            <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="z-[250] max-w-[280px] text-[12px] leading-[1.5]">
          {locked}
        </TooltipContent>
      </Tooltip>
    );
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q) || (o.keywords ?? "").toLowerCase().includes(q));
  }, [options, search]);

  const close = () => {
    setOpen(false);
    setSearch("");
  };

  return (
    <Popover open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={ariaLabel}
          className={`mt-1 w-full h-10 px-3 rounded-lg border bg-white flex items-center justify-between gap-2 text-sm transition-colors cursor-pointer outline-none ${
            open ? "border-[#0A77FF] ring-2 ring-[#0A77FF]/10" : "border-border hover:border-slate-300"
          }`}
        >
          {selected ? (
            <span className="flex items-center gap-2 min-w-0 text-[#0F172A] truncate" style={{ fontWeight: 500 }}>
              <FlagImage code={selected.flag} className="shrink-0 text-[13px]" />
              <span className="truncate">{selected.label}</span>
            </span>
          ) : (
            <span className="text-slate-400">{placeholder}</span>
          )}
          {open ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0 rounded-xl border border-border bg-white shadow-lg z-[250]"
        align="start"
        sideOffset={4}
        style={{ maxHeight: "min(380px, var(--radix-popover-content-available-height))" }}
      >
        <div className="p-3 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full h-9 pl-9 pr-3 rounded-lg border border-border bg-white text-sm text-[#0F172A] placeholder:text-slate-400 focus:outline-none focus:border-[#0A77FF] focus:ring-2 focus:ring-[#0A77FF]/10"
              autoFocus
            />
          </div>
        </div>
        <div className="border-t border-slate-100 overscroll-contain" style={{ maxHeight: 300, overflowY: "auto" }} role="listbox">
          {filtered.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-400">No results found</div>
          ) : (
            filtered.map((o) => (
              <button
                key={o.id}
                type="button"
                role="option"
                aria-selected={value === o.id}
                onClick={() => {
                  onChange(o.id);
                  close();
                }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-slate-50 cursor-pointer ${
                  value === o.id ? "bg-[#EDF4FF]/60" : ""
                }`}
              >
                <FlagImage code={o.flag} className="shrink-0 text-[13px]" />
                {o.symbol !== undefined && (
                  <span className="w-7 text-center text-[12px] text-slate-500 shrink-0" style={{ fontWeight: 600 }}>
                    {o.symbol}
                  </span>
                )}
                <span className="text-sm text-[#0F172A] truncate" style={{ fontWeight: 500 }}>{o.label}</span>
                {value === o.id && <Check className="w-4 h-4 text-[#0A77FF] ml-auto shrink-0" />}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Every active currency, as Partners lists them: "USD, United States Dollar". */
const CURRENCY_OPTIONS: FlagOption[] = CURRENCIES.map((c) => ({
  id: c.code,
  label: `${c.code}, ${c.name}`,
  flag: c.flag,
  symbol: c.symbol,
  keywords: c.country,
}));

export function CurrencyDropdown({ value, onChange, ariaLabel = "Currency", locked }: { value: string; onChange: (code: string) => void; ariaLabel?: string; locked?: string }) {
  return (
    <FlagSearchDropdown
      options={CURRENCY_OPTIONS}
      value={value.toUpperCase()}
      onChange={onChange}
      placeholder="Select a currency"
      searchPlaceholder="Search by code, name, or country…"
      ariaLabel={ariaLabel}
      locked={locked}
    />
  );
}

/** "PKR · Pakistani Rupee [₨]": a currency as General Settings shows a saved one. */
export function CurrencyValue({ code, trailing }: { code: string; trailing?: ReactNode }) {
  const c = getCurrency(code);
  return (
    <span className="flex items-center gap-2 min-w-0">
      <FlagImage code={c?.flag} className="shrink-0 text-[15px]" />
      <span className="flex items-center gap-1.5 min-w-0">
        <span className="shrink-0">{c?.code ?? code}</span>
        <span aria-hidden="true" className="shrink-0 text-[#64748B] text-[1.25em] leading-none" style={{ fontWeight: 700 }}>·</span>
        <span className="truncate">{c?.name ?? code}</span>
      </span>
      {c?.symbol && (
        <span
          className="shrink-0 inline-flex items-center justify-center px-1.5 h-[20px] min-w-[28px] rounded-md border text-[12px]"
          style={{ backgroundColor: "#F1F5F9", borderColor: "#E2E8F0", color: "#334155", fontWeight: 600 }}
        >
          {c.symbol}
        </span>
      )}
      {trailing}
    </span>
  );
}
