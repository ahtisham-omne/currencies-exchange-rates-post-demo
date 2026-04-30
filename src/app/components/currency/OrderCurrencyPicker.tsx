import * as React from "react";
import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/app/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/app/components/ui/command";
import { CurrencyFlag } from "./CurrencyFlag";
import { CURRENCY_LIBRARY, getLibraryCurrency } from "@/app/data/currencyLibrary";

interface Props {
  value: string;
  onChange: (code: string) => void;
  /** Customer's default — surfaces a "Customer default" hint. */
  customerDefaultCurrency?: string;
  className?: string;
  disabled?: boolean;
}

/**
 * Compact currency dropdown used in Create-Order Step 1. Shows a flag + ISO
 * code in the trigger and a searchable list of all ISO 4217 currencies in the
 * popover.
 */
export function OrderCurrencyPicker({ value, onChange, customerDefaultCurrency, className, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const cur = getLibraryCurrency(value);
  const isDefault = customerDefaultCurrency
    ? value.toUpperCase() === customerDefaultCurrency.toUpperCase()
    : false;

  return (
    <Popover open={open} onOpenChange={disabled ? undefined : setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <button
          type="button"
          disabled={disabled}
          className={`inline-flex items-center gap-2 h-9 px-3 rounded-lg border border-border bg-white text-[13px] outline-none transition-colors ${
            disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer hover:bg-muted/30"
          } ${className ?? ""}`}
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          {cur && <CurrencyFlag currency={cur} size={18} />}
          <span className="text-foreground" style={{ fontWeight: 600 }}>
            {value.toUpperCase()}
          </span>
          {cur && <span className="text-muted-foreground truncate hidden md:inline">— {cur.name}</span>}
          {isDefault && (
            <span
              className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px]"
              style={{ backgroundColor: "#EDF4FF", color: "#0A77FF", fontWeight: 600 }}
            >
              Customer default
            </span>
          )}
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground ml-auto shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={4}
        className="p-0 w-[300px] rounded-lg border border-border shadow-lg"
        onWheel={(e) => e.stopPropagation()}
      >
        <Command
          filter={(itemValue, search) => {
            const q = search.trim().toLowerCase();
            if (!q) return 1;
            return itemValue.toLowerCase().includes(q) ? 1 : 0;
          }}
        >
          <CommandInput placeholder="Search currency..." className="h-10 text-[13px]" />
          <CommandList className="max-h-[280px] overflow-y-auto" onWheel={(e) => e.stopPropagation()}>
            <CommandEmpty className="py-4 text-center text-[12px] text-muted-foreground">
              No currencies found.
            </CommandEmpty>
            <CommandGroup>
              {CURRENCY_LIBRARY.map((c) => {
                const selected = c.code.toUpperCase() === value.toUpperCase();
                return (
                  <CommandItem
                    key={c.code}
                    value={`${c.code} ${c.name} ${c.region}`}
                    onSelect={() => {
                      onChange(c.code);
                      setOpen(false);
                    }}
                    className="text-[13px] flex items-center gap-2 py-2"
                  >
                    <CurrencyFlag currency={c} size={20} />
                    <span className="text-foreground" style={{ fontWeight: 600 }}>{c.code}</span>
                    <span className="text-muted-foreground truncate">— {c.name}</span>
                    {selected && <Check className="ml-auto w-3.5 h-3.5 text-primary" />}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
