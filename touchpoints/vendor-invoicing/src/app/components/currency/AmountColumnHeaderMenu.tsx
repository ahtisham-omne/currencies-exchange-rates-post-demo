import * as React from "react";
import { useState } from "react";
import { Banknote, Globe, ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import type { InvoiceViewMode } from "./InvoiceViewModeContext";

interface Props {
  label: string;
  viewMode: InvoiceViewMode;
  onViewModeChange: (mode: InvoiceViewMode) => void;
}

/**
 * Column-header dropdown for the listing's Amount column. Mirrors the
 * Quotes module's "Quote Value" column-header menu pattern (Banknote /
 * Globe icons, "Show values as" section, dot indicator on active row) but
 * trimmed down to just the currency-view switcher — sort/filter live
 * elsewhere in this table.
 */
export function AmountColumnHeaderMenu({ label, viewMode, onViewModeChange }: Props) {
  const [open, setOpen] = useState(false);

  const select = (mode: InvoiceViewMode) => {
    onViewModeChange(mode);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1 w-full h-full text-left cursor-pointer select-none group/header transition-colors px-3 py-3"
          aria-haspopup="menu"
          aria-expanded={open}
        >
          <span className="text-xs font-medium text-gray-700">{label}</span>
          <ChevronDown className="w-3 h-3 text-gray-400 opacity-60 group-hover/header:opacity-100 transition-opacity" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={4}
        className="p-0 w-[220px] rounded-lg shadow-lg border border-border/80 z-[200]"
      >
        <div className="px-3 pt-3 pb-2">
          <div className="flex items-center gap-2 h-8 px-2.5 rounded-md border border-border bg-muted/30">
            <span className="text-xs text-muted-foreground" style={{ fontWeight: 500 }}>{label}</span>
          </div>
        </div>
        <div className="border-t border-border/60" />
        <div className="py-1 px-1">
          <div
            className="px-2.5 pt-1 pb-0.5 text-[10.5px] text-muted-foreground/70 uppercase tracking-wider"
            style={{ fontWeight: 600, letterSpacing: "0.04em" }}
          >
            Show values as
          </div>
          <button
            type="button"
            onClick={() => select("base")}
            className={`flex items-center gap-2.5 w-full px-2.5 py-[7px] rounded-md text-[13px] cursor-pointer transition-colors hover:bg-muted/60 ${
              viewMode === "base" ? "text-primary bg-primary/5" : "text-foreground"
            }`}
          >
            <Banknote className="w-4 h-4 text-muted-foreground" />
            <span style={{ fontWeight: 400 }}>Base currency</span>
            {viewMode === "base" && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
          </button>
          <button
            type="button"
            onClick={() => select("vendor")}
            className={`flex items-center gap-2.5 w-full px-2.5 py-[7px] rounded-md text-[13px] cursor-pointer transition-colors hover:bg-muted/60 ${
              viewMode === "vendor" ? "text-primary bg-primary/5" : "text-foreground"
            }`}
          >
            <Globe className="w-4 h-4 text-muted-foreground" />
            <span style={{ fontWeight: 400 }}>Vendor currency</span>
            {viewMode === "vendor" && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
