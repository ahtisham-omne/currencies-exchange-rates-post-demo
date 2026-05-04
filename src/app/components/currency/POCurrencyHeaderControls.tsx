import * as React from "react";
import { Settings2 } from "lucide-react";
import { InfoTooltip } from "../ui/info-tooltip";
import type { PurchaseOrderData } from "../poStore";
import { getPOVendorCurrency, poVendorCurrencyIsBase, setPOViewMode } from "../poStore";
import { BASE_CURRENCY } from "@/app/data/currencyLibrary";

interface Props {
  po: PurchaseOrderData;
  onOpenConfig: () => void;
}

/**
 * Right-side header controls for the PO detail page: the Base ↔ Partner view
 * toggle and the Currency Configurator button. The toggle is hidden when the
 * PO's vendor-amount currency is already PKR — there's nothing to flip between.
 */
export function POCurrencyHeaderControls({ po, onOpenConfig }: Props) {
  const isBase = poVendorCurrencyIsBase(po);
  const partnerCurrency = getPOVendorCurrency(po);
  const mode = po.viewMode ?? "base";

  return (
    <div className="flex items-center gap-1.5 shrink-0">
      {!isBase && (
        <div className="inline-flex items-center gap-0.5 h-8 rounded-lg border border-border p-0.5 bg-white shadow-sm shrink-0">
          <button
            type="button"
            onClick={() => setPOViewMode(po.id, "base")}
            aria-pressed={mode === "base"}
            className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11px] whitespace-nowrap cursor-pointer transition-colors ${
              mode === "base"
                ? "bg-[var(--primary-tint)] text-primary"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            }`}
            style={{ fontWeight: mode === "base" ? 600 : 500 }}
          >
            Base Currency
            <InfoTooltip side="bottom" iconClassName="w-3 h-3">
              Show amounts in the company's base currency ({BASE_CURRENCY}). Values stay comparable across all purchase orders regardless of the transaction currency.
            </InfoTooltip>
          </button>
          <button
            type="button"
            onClick={() => setPOViewMode(po.id, "partner")}
            aria-pressed={mode === "partner"}
            className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11px] whitespace-nowrap cursor-pointer transition-colors ${
              mode === "partner"
                ? "bg-[var(--primary-tint)] text-primary"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            }`}
            style={{ fontWeight: mode === "partner" ? 600 : 500 }}
          >
            Vendor Currency
            <InfoTooltip side="bottom" iconClassName="w-3 h-3">
              Show amounts in this vendor's own default transaction currency ({partnerCurrency || BASE_CURRENCY}). The base-currency equivalent remains available on hover for reporting.
            </InfoTooltip>
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={onOpenConfig}
        title="Currency settings for this PO"
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
