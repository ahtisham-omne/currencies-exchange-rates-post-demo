import * as React from "react";
import { useMemo, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/app/components/ui/popover";
import { CurrencyFlag } from "@/app/components/ui/CurrencyFlag";
import { CURRENCY_LIBRARY, getLibraryCurrency } from "@/app/data/currencyLibrary";

interface Props {
  /** Active quote currency (ISO 4217 alpha-3, uppercase). */
  value: string;
  /** Customer's primary currency. Used to render a "Customer default" hint when `value` matches it, or "Custom for this quote" when it differs. */
  customerDefault?: string;
  onChange: (code: string) => void;
}

/**
 * Per-quote currency selector. Pre-populated from the customer's primary
 * currency at selection time; user-overrideable without affecting the
 * customer's default. Search-driven popover backed by the full ISO 4217 list.
 */
export function QuoteCurrencyPicker({ value, customerDefault, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const current = getLibraryCurrency(value) ?? getLibraryCurrency("PKR")!;
  const isDefault = customerDefault
    ? value.toUpperCase() === customerDefault.toUpperCase()
    : true;

  const filtered = useMemo(() => {
    if (!query.trim()) return CURRENCY_LIBRARY;
    const q = query.trim().toLowerCase();
    return CURRENCY_LIBRARY.filter(
      c =>
        c.code.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.region.toLowerCase().includes(q),
    );
  }, [query]);

  // Pin the customer default to the top so it's always reachable in the list.
  const ordered = useMemo(() => {
    if (!customerDefault) return filtered;
    const def = customerDefault.toUpperCase();
    const head = filtered.filter(c => c.code === def);
    const rest = filtered.filter(c => c.code !== def);
    return [...head, ...rest];
  }, [filtered, customerDefault]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-2 cursor-pointer focus:outline-none"
        >
          <span className="flex items-center gap-1.5">
            <CurrencyFlag currency={current} size={16} />
            <span className="text-[13px] text-[#1F2937]" style={{ fontWeight: 600 }}>
              {current.symbol ?? current.code} {current.code}
            </span>
            {!isDefault && (
              <span
                className="inline-flex items-center px-1.5 py-px text-[10px] rounded-full border whitespace-nowrap"
                style={{
                  backgroundColor: "#FFFBEB",
                  borderColor: "#FDE68A",
                  color: "#92400E",
                  fontWeight: 600,
                }}
                title={`Customer default is ${customerDefault}. This quote will settle in ${current.code}.`}
              >
                Custom for this quote
              </span>
            )}
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-[#9CA3AF]" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={6}
        className="w-[300px] p-0 z-[120] rounded-lg border border-slate-200 shadow-xl bg-white"
      >
        <div className="px-3 pt-2.5 pb-2 border-b border-slate-100">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search currency, name, or country…"
              className="w-full h-8 pl-7 pr-2 text-[12px] bg-slate-50 border border-slate-100 rounded-md outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
            />
          </div>
        </div>
        <div className="max-h-[300px] overflow-y-auto py-1">
          {ordered.length === 0 && (
            <div className="px-3 py-6 text-center text-[12px] text-slate-400">No matches</div>
          )}
          {ordered.map(c => {
            const selected = c.code === value.toUpperCase();
            const isCustomerDefault = customerDefault?.toUpperCase() === c.code;
            return (
              <button
                key={c.code}
                type="button"
                onClick={() => {
                  onChange(c.code);
                  setOpen(false);
                  setQuery("");
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-slate-50 transition-colors ${
                  selected ? "bg-primary/5" : ""
                }`}
              >
                <CurrencyFlag currency={c} size={18} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[12.5px] text-slate-900" style={{ fontWeight: 600 }}>
                      {c.code}
                    </span>
                    <span className="text-[11px] text-slate-500 truncate">· {c.name}</span>
                    {isCustomerDefault && (
                      <span
                        className="inline-flex items-center px-1.5 py-px text-[9.5px] rounded-full bg-primary/10 text-primary"
                        style={{ fontWeight: 600 }}
                      >
                        Customer default
                      </span>
                    )}
                  </div>
                  <span className="text-[10.5px] text-slate-400 block truncate">{c.region}</span>
                </div>
                {selected && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
