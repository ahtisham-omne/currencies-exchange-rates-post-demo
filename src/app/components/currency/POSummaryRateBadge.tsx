import * as React from "react";
import { Lock, Settings2 } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip";
import {
  BASE_CURRENCY,
  convertBetween,
  getLibraryCurrency,
  rateTypeLabel,
} from "@/app/data/currencyLibrary";
import { useRateContext } from "../../context/RateContext";
import type { PurchaseOrderData } from "../poStore";
import {
  getPOVendorCurrency,
  getPOSettlementCurrency,
  poVendorCurrencyIsBase,
} from "../poStore";

interface Props {
  po: PurchaseOrderData;
  /** Open the Currency Configuration modal — wired by the host page. */
  onViewConfig?: () => void;
}

/**
 * Currency summary inside the Order Summary panel. Surfaces the four pieces
 * buyers ask for at a glance: what the vendor is paid in, what we settle in,
 * the base-currency equivalent for finance reporting, and the FX rate(s) /
 * rate type that tie them together.
 *
 * Rows collapse when currencies overlap (e.g. settlement = base means we
 * skip the redundant base-equivalent row). When the PO settles in a non-base
 * currency that also differs from the vendor currency, two FX rates are at
 * play and both are shown.
 */
export function POSummaryRateBadge({ po, onViewConfig }: Props) {
  // Subscribe so the card refreshes when the rate-type toggle flips.
  const { rateType } = useRateContext();

  const vendorCurrency = getPOVendorCurrency(po).toUpperCase();
  const baseCode = BASE_CURRENCY;
  // The store falls settlement back to the vendor currency when unset, but
  // the configurator interprets that state as "pay in base". Mirror that
  // here so an unconfigured PO renders the same rows in both surfaces.
  const rawSettlement = getPOSettlementCurrency(po).toUpperCase();
  const settlementCurrency = rawSettlement === vendorCurrency ? baseCode : rawSettlement;

  // Pure-base PO (vendor and settlement both in base) — no FX info to surface.
  // Keep the configuration link reachable so users can still pick a different
  // settlement currency.
  if (poVendorCurrencyIsBase(po) && settlementCurrency === baseCode) {
    return (
      <div className="flex items-center justify-end gap-2 pt-1">
        {onViewConfig && (
          <button
            type="button"
            onClick={onViewConfig}
            className="inline-flex items-center gap-1 text-[10.5px] text-slate-500 hover:text-primary cursor-pointer"
            style={{ fontWeight: 500 }}
          >
            <Settings2 className="w-2.5 h-2.5" />
            View configuration
          </button>
        )}
      </div>
    );
  }

  // Amounts. po.total is the canonical PKR amount; convert outward as needed.
  const baseTotal = po.total;
  const vendorTotal = vendorCurrency === baseCode
    ? baseTotal
    : convertBetween(baseTotal, baseCode, vendorCurrency);
  const settlementTotal = settlementCurrency === baseCode
    ? baseTotal
    : settlementCurrency === vendorCurrency
      ? vendorTotal
      : convertBetween(baseTotal, baseCode, settlementCurrency);

  type Row = { label: string; currency: string; amount: number };
  const rows: Row[] = [];
  rows.push({ label: "Vendor receives", currency: vendorCurrency, amount: vendorTotal });
  if (settlementCurrency !== vendorCurrency) {
    rows.push({ label: "You pay", currency: settlementCurrency, amount: settlementTotal });
  }
  if (vendorCurrency !== baseCode && settlementCurrency !== baseCode) {
    rows.push({ label: "Base equivalent", currency: baseCode, amount: baseTotal });
  }

  // Build the rate lines that explain how the rows relate. Mirrors the
  // configurator's RateMetadataPanel logic so the same rates show up in
  // both surfaces.
  type RateLine = { from: string; to: string; rate: number };
  const rateLines: RateLine[] = [];
  if (vendorCurrency !== settlementCurrency) {
    rateLines.push({
      from: vendorCurrency,
      to: settlementCurrency,
      rate: convertBetween(1, vendorCurrency, settlementCurrency),
    });
    if (settlementCurrency !== baseCode && vendorCurrency !== baseCode) {
      rateLines.push({
        from: settlementCurrency,
        to: baseCode,
        rate: convertBetween(1, settlementCurrency, baseCode),
      });
    }
  } else if (settlementCurrency !== baseCode) {
    rateLines.push({
      from: vendorCurrency,
      to: baseCode,
      rate: convertBetween(1, vendorCurrency, baseCode),
    });
  }

  const isLocked = po.status !== "Draft";
  const lockedAtRaw = po.sentDate;
  const lockedAtDisplay = lockedAtRaw
    ? new Date(lockedAtRaw + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })
    : null;

  const typeShort = rateType === "market" ? "Mid-market" : "Corporate";
  const typeHex = rateType === "market" ? "#7c3aed" : "#d97706";
  const typeBg = rateType === "market"
    ? "color-mix(in srgb, #7c3aed 8%, transparent)"
    : "color-mix(in srgb, #d97706 10%, transparent)";

  return (
    <div className="mt-2 pt-2 border-t border-slate-100 flex flex-col gap-2">
      {/* Header strip: section label + rate-type / lock chips */}
      <div className="flex items-center justify-between gap-2">
        <span
          className="text-[9.5px] uppercase tracking-wider text-slate-400"
          style={{ fontWeight: 600, letterSpacing: "0.06em" }}
        >
          Currency
        </span>
        <div className="flex items-center gap-1.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] cursor-help"
                style={{ color: typeHex, backgroundColor: typeBg, fontWeight: 600 }}
              >
                <span className="inline-block w-1 h-1 rounded-full" style={{ backgroundColor: typeHex }} />
                {typeShort}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={4} className="text-[11px] max-w-[240px]">
              <div style={{ fontWeight: 600 }}>{rateTypeLabel(rateType)}</div>
              <div className="text-slate-400 mt-0.5">
                {rateType === "market"
                  ? "Live rates from Open Exchange Rates."
                  : "Treasury-managed corporate book rates."}
              </div>
            </TooltipContent>
          </Tooltip>

          {isLocked && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] cursor-help"
                  style={{ color: "#047857", backgroundColor: "#ecfdf5", border: "1px solid #a7f3d0", fontWeight: 600 }}
                >
                  <Lock className="w-2.5 h-2.5" />
                  Locked
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={4} className="text-[11px] max-w-[240px]">
                <div style={{ fontWeight: 600 }}>Rate locked</div>
                <div className="tabular-nums text-slate-400 mt-0.5">
                  {lockedAtDisplay ? `Sent on ${lockedAtDisplay}` : "Locked when PO was sent"}
                </div>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Currency amount rows */}
      <div className="flex flex-col gap-1">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-3 text-[11px]">
            <span className="text-slate-500">{r.label}</span>
            <span className="text-slate-800 tabular-nums" style={{ fontWeight: 500 }}>
              {symbolFor(r.currency)} {fmt(r.amount, r.currency)} {r.currency}
            </span>
          </div>
        ))}
      </div>

      {/* FX rate(s) */}
      {rateLines.length > 0 && (
        <div className="flex flex-col gap-0.5 pt-1.5 border-t border-slate-100">
          {rateLines.map((r) => (
            <div key={`${r.from}-${r.to}`} className="flex items-center justify-between gap-3 text-[10px]">
              <span className="text-slate-400" style={{ fontWeight: 500 }}>
                {rateLines.length > 1 ? `${r.from} → ${r.to}` : "Rate"}
              </span>
              <span className="tabular-nums text-slate-600">
                1 {r.from} = {symbolFor(r.to)} {fmtRate(r.rate)} {r.to}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Footer: configuration link */}
      {onViewConfig && (
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={onViewConfig}
            className="inline-flex items-center gap-1 text-[10.5px] text-slate-500 hover:text-primary cursor-pointer"
            style={{ fontWeight: 500 }}
          >
            <Settings2 className="w-2.5 h-2.5" />
            View configuration
          </button>
        </div>
      )}
    </div>
  );
}

function symbolFor(code: string): string {
  return getLibraryCurrency(code)?.symbol ?? code;
}

function fmt(value: number, code: string): string {
  const zeroDecimals = new Set(["JPY", "KRW", "VND", "IDR", "HUF", "ISK", "CLP"]);
  const threeDecimals = new Set(["KWD", "BHD", "OMR", "JOD", "TND"]);
  const upper = code.toUpperCase();
  const decimals = zeroDecimals.has(upper) ? 0 : threeDecimals.has(upper) ? 3 : 2;
  return value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function fmtRate(value: number): string {
  const abs = Math.abs(value);
  let decimals: number;
  if (abs >= 100) decimals = 2;
  else if (abs >= 1) decimals = 4;
  else if (abs >= 0.01) decimals = 5;
  else decimals = 6;
  return value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
