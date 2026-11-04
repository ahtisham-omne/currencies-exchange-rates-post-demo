import * as React from "react";
import { useEffect, useState } from "react";
import { Printer } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { FONT } from "./designTokens";

export type PrintCurrencyMode = "vendor" | "base";

export interface PrintOptions {
  /** Show side-by-side currency-conversion details on every numeric cell. */
  showConversion: boolean;
  /** Render the rate source + lock timestamp in the header / footer. */
  includeRateInfo: boolean;
  /** Which currency the document is printed in. */
  currencyMode: PrintCurrencyMode;
}

export const DEFAULT_PRINT_OPTIONS: PrintOptions = {
  showConversion: true,
  includeRateInfo: true,
  currencyMode: "base",
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: (options: PrintOptions) => void;
  /** Render hint shown beneath the title — e.g. "PO 395-9900 · v3". */
  context?: string;
  /** Hide the currency mode selector when the PO is in base currency only. */
  hideCurrencyMode?: boolean;
}

/**
 * Lightweight pre-print dialog that exposes the currency / rate display knobs
 * required by the print spec. The dialog is intentionally minimal — it
 * collects three settings and hands them to the caller, which then drives
 * `printPurchaseOrder` with the resulting options.
 */
export default function PrintOptionsDialog({ open, onOpenChange, onConfirm, context, hideCurrencyMode }: Props) {
  const [options, setOptions] = useState<PrintOptions>(DEFAULT_PRINT_OPTIONS);

  useEffect(() => {
    if (open) setOptions(DEFAULT_PRINT_OPTIONS);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px] p-0 gap-0 overflow-hidden" style={{ fontFamily: FONT }}>
        <div className="px-5 pt-5 pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Printer className="size-4 text-primary" />
            <DialogTitle className="text-foreground" style={{ fontSize: "13.5px", fontWeight: 600 }}>
              Print options
            </DialogTitle>
          </div>
          {context && (
            <DialogDescription className="text-muted-foreground mt-1" style={{ fontSize: "11.5px" }}>
              {context}
            </DialogDescription>
          )}
        </div>

        <div className="px-5 py-4 flex flex-col gap-3">
          <Toggle
            label="Show currency conversion details"
            description="Adds the partner-currency equivalent next to every amount."
            checked={options.showConversion}
            onChange={(v) => setOptions((o) => ({ ...o, showConversion: v }))}
          />

          <Toggle
            label="Include rate source and timestamp"
            description="Prints the rate type, source, and the lock timestamp in the header and footer."
            checked={options.includeRateInfo}
            onChange={(v) => setOptions((o) => ({ ...o, includeRateInfo: v }))}
          />

          {!hideCurrencyMode && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[11.5px] text-slate-700" style={{ fontWeight: 600 }}>Print in</span>
              <div className="flex flex-col gap-1.5">
                {(["base", "vendor"] as PrintCurrencyMode[]).map((mode) => {
                  const active = options.currencyMode === mode;
                  const label = mode === "vendor" ? "Vendor currency" : "Base currency";
                  const description = mode === "vendor"
                    ? "Print all amounts in the vendor's currency"
                    : "Print all amounts in the company base currency (PKR)";
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setOptions((o) => ({ ...o, currencyMode: mode }))}
                      className={`flex items-start gap-2.5 rounded-[var(--radius-md)] border px-3 py-2.5 text-left transition-colors cursor-pointer ${
                        active ? "border-primary bg-primary/5" : "border-border hover:bg-secondary/40"
                      }`}
                    >
                      <span
                        className="mt-0.5 flex items-center justify-center size-4 rounded-full shrink-0 border"
                        style={{
                          borderColor: active ? "var(--primary)" : "var(--border)",
                          backgroundColor: active ? "var(--primary)" : "var(--card)",
                        }}
                      >
                        {active && <span className="size-1.5 rounded-full bg-white" />}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-foreground text-[12px]" style={{ fontWeight: 600 }}>{label}</div>
                        <div className="text-muted-foreground text-[11px] mt-0.5 leading-relaxed">{description}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border bg-secondary/30">
          <Button variant="outline" size="sm" className="h-8 px-3" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="h-8 px-4 gap-1.5"
            onClick={() => {
              onConfirm(options);
              onOpenChange(false);
            }}
          >
            <Printer className="size-3.5" />
            Print
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-start justify-between gap-3 rounded-[var(--radius-md)] border border-border px-3 py-2.5 hover:bg-secondary/40 transition-colors text-left cursor-pointer"
    >
      <div className="min-w-0 flex-1">
        <div className="text-foreground text-[12px]" style={{ fontWeight: 600 }}>{label}</div>
        <div className="text-muted-foreground text-[11px] mt-0.5 leading-relaxed">{description}</div>
      </div>
      <span
        aria-hidden
        className="mt-0.5 inline-flex items-center shrink-0 w-8 h-[18px] rounded-full p-0.5 transition-colors"
        style={{ backgroundColor: checked ? "var(--primary)" : "color-mix(in srgb, var(--muted-foreground) 25%, transparent)" }}
      >
        <span
          className="block w-[14px] h-[14px] rounded-full bg-white shadow-sm transition-transform"
          style={{ transform: checked ? "translateX(14px)" : "translateX(0)" }}
        />
      </span>
    </button>
  );
}
