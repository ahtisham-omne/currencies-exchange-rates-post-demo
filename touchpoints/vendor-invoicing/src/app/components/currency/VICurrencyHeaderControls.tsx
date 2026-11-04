import * as React from "react";
import { Settings2 } from "lucide-react";
import { InfoTooltip } from "../ui/info-tooltip";
import type { Invoice } from "@/app/data/mockInvoices";
import { BASE_CURRENCY } from "@/app/data/currencyLibrary";
import type { InvoiceViewMode } from "./InvoiceViewModeContext";

interface Props {
  invoice: Invoice;
  viewMode: InvoiceViewMode;
  onViewModeChange: (mode: InvoiceViewMode) => void;
  onOpenConfig: () => void;
}

/**
 * Right-side header controls for the invoice detail screen: the
 * Base ↔ Vendor view toggle and the Currency Configurator button.
 * The toggle is hidden when the invoice's currency is already PKR — there's
 * nothing to flip between.
 */
export function VICurrencyHeaderControls({ invoice, viewMode, onViewModeChange, onOpenConfig }: Props) {
  const vendorCurrency = (invoice.currency || BASE_CURRENCY).toUpperCase();
  const isBase = vendorCurrency === BASE_CURRENCY;

  return (
    <div className="flex items-center gap-1.5 shrink-0">
      {!isBase && (
        <div className="inline-flex items-center gap-0.5 h-8 rounded-lg border border-border p-0.5 bg-white shadow-sm shrink-0">
          <button
            type="button"
            onClick={() => onViewModeChange("base")}
            aria-pressed={viewMode === "base"}
            className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11px] whitespace-nowrap cursor-pointer transition-colors ${
              viewMode === "base"
                ? "bg-blue-50 text-blue-600"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            }`}
            style={{ fontWeight: viewMode === "base" ? 600 : 500 }}
          >
            Base Currency
            <InfoTooltip side="bottom" iconClassName="w-3 h-3">
              Show amounts in the company's base currency ({BASE_CURRENCY}). Values stay comparable across all invoices regardless of the vendor's transaction currency.
            </InfoTooltip>
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange("vendor")}
            aria-pressed={viewMode === "vendor"}
            className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11px] whitespace-nowrap cursor-pointer transition-colors ${
              viewMode === "vendor"
                ? "bg-blue-50 text-blue-600"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            }`}
            style={{ fontWeight: viewMode === "vendor" ? 600 : 500 }}
          >
            Vendor Currency
            <InfoTooltip side="bottom" iconClassName="w-3 h-3">
              Show amounts in the vendor's invoice currency ({vendorCurrency}). The base-currency equivalent remains available on hover for reporting.
            </InfoTooltip>
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={onOpenConfig}
        title="Currency settings for this invoice"
        aria-label="Open currency configuration"
        className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-border bg-white text-muted-foreground hover:bg-slate-50 hover:text-foreground transition-colors cursor-pointer shrink-0 text-[11px]"
        style={{ fontWeight: 500 }}
      >
        <Settings2 className="w-3.5 h-3.5" />
        <span className="whitespace-nowrap">Currency</span>
      </button>
    </div>
  );
}
