import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import { X, Lock, RotateCcw, Settings2, ArrowRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/app/components/ui/dialog";
import { Button } from "@/app/components/ui/button";
import { CurrencyFlag } from "@/app/components/ui/CurrencyFlag";
import { QuoteCurrencyPicker } from "./QuoteCurrencyPicker";
import { MarketCorporateToggle } from "./MarketCorporateToggle";
import { useRateContext } from "@/app/context/RateContext";
import {
  BASE_CURRENCY,
  convertBetween,
  getLibraryCurrency,
  rateTypeLabel,
  type RateType,
} from "@/app/data/currencyLibrary";
import { formatRateUpdatedAs } from "@/app/data/rateDateFormat";

export interface QuoteCurrencyConfig {
  /** The currency the customer is invoiced / pays in. Defaults to customer's primary on first open. */
  currency: string;
  /** The currency we settle into our books. Defaults to base (PKR). */
  settlementCurrency: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Customer's primary currency — used as the "Reset to default" target and to surface "Custom for this quote" hints. */
  customerDefaultCurrency: string;
  /** Current configuration. Pass `currency` (defaults to customer default) and `settlementCurrency` (defaults to base). */
  config: QuoteCurrencyConfig;
  /** When `true`, the quote has been sent to the customer — rates are locked, the modal is read-only, and the lock chip is shown. */
  locked?: boolean;
  /** ISO date the quote was sent. Surfaces inside the lock chip when present. */
  lockedAt?: string;
  /** Persisted on save. Caller should propagate back to its `Quote.currency` / `paymentCurrency` fields. */
  onSave: (next: QuoteCurrencyConfig) => void;
}

const RATE_TYPE_HEX: Record<RateType, string> = { market: "#7c3aed", corporate: "#d97706" };

/**
 * Quote-level currency configuration modal — opened from the Quote Details
 * header (or the Duplicate flow). Mirrors the PO Currency Configuration modal
 * inverted to the sell-side: "Customer pays" + "You receive" with conditional
 * one-leg or two-leg rate cards underneath.
 */
export function QuoteCurrencyConfigModal({
  open,
  onOpenChange,
  customerDefaultCurrency,
  config,
  locked,
  lockedAt,
  onSave,
}: Props) {
  // Subscribe so rate cards refresh when the user flips Mid-market / Corporate.
  const { rateType, snapshot } = useRateContext();

  const [currency, setCurrency] = useState(config.currency);
  const [settlement, setSettlement] = useState(config.settlementCurrency);

  useEffect(() => {
    if (open) {
      setCurrency(config.currency);
      setSettlement(config.settlementCurrency);
    }
  }, [open, config.currency, config.settlementCurrency]);

  const customerCur = useMemo(() => getLibraryCurrency(currency)!, [currency]);
  const settlementCur = useMemo(() => getLibraryCurrency(settlement)!, [settlement]);
  const baseCur = getLibraryCurrency(BASE_CURRENCY)!;
  const baseSym = baseCur.symbol ?? BASE_CURRENCY;

  const currencyIsBase = currency.toUpperCase() === BASE_CURRENCY;
  const settlementIsBase = settlement.toUpperCase() === BASE_CURRENCY;
  const currencyEqualsSettlement = currency.toUpperCase() === settlement.toUpperCase();

  // Rate legs:
  //  - all-base       → no conversion to display
  //  - one-leg        → currency → base (settlement lives at base, or settlement = currency)
  //  - two-leg        → currency → settlement, then settlement → base
  type RateLeg = { from: string; to: string; rate: number };
  const legs: RateLeg[] = useMemo(() => {
    if (currencyIsBase && settlementIsBase) return [];
    if (currencyEqualsSettlement || settlementIsBase) {
      // Single conversion: customer currency → base
      const r = convertBetween(1, currency, BASE_CURRENCY);
      return [{ from: currency, to: BASE_CURRENCY, rate: r }];
    }
    if (currencyIsBase) {
      // Customer pays in PKR, settle in non-PKR — single leg base → settlement
      const r = convertBetween(1, BASE_CURRENCY, settlement);
      return [{ from: BASE_CURRENCY, to: settlement, rate: r }];
    }
    // Two legs: customer → settlement, settlement → base
    return [
      { from: currency, to: settlement, rate: convertBetween(1, currency, settlement) },
      { from: settlement, to: BASE_CURRENCY, rate: convertBetween(1, settlement, BASE_CURRENCY) },
    ];
  }, [currency, settlement, currencyIsBase, settlementIsBase, currencyEqualsSettlement, snapshot.type]);

  const isCustomCurrency = currency.toUpperCase() !== customerDefaultCurrency.toUpperCase();
  const isCustomSettlement = settlement.toUpperCase() !== BASE_CURRENCY;
  const dirty = currency !== config.currency || settlement !== config.settlementCurrency;

  const handleReset = () => {
    setCurrency(customerDefaultCurrency);
    setSettlement(BASE_CURRENCY);
  };

  const handleSave = () => {
    onSave({ currency: currency.toUpperCase(), settlementCurrency: settlement.toUpperCase() });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-5 pt-4 pb-3 border-b border-slate-100 flex-row items-center justify-between gap-2 space-y-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#EDF4FF] flex items-center justify-center">
              <Settings2 className="w-4 h-4 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-[15px] text-slate-900" style={{ fontWeight: 600 }}>
                Currency configuration
              </DialogTitle>
              <p className="text-[11.5px] text-slate-500">
                Set the currency the customer pays in and what you receive into your books.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="p-1.5 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </DialogHeader>

        {/* Body */}
        <div className="px-5 py-4 max-h-[70vh] overflow-y-auto">
          {/* Lock notice */}
          {locked ? (
            <div className="mb-4 flex items-start gap-2 px-3 py-2 rounded-md bg-emerald-50 border border-emerald-200">
              <Lock className="w-3.5 h-3.5 text-emerald-700 mt-0.5 shrink-0" />
              <div className="text-[11.5px] text-emerald-800 leading-snug">
                <div style={{ fontWeight: 600 }}>Rate locked</div>
                <div>
                  {lockedAt
                    ? `This quote was sent on ${new Date(lockedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}. The rate captured at send time is preserved.`
                    : "This quote has been sent. The rate captured at send time is preserved."}
                </div>
              </div>
            </div>
          ) : (
            <div className="mb-4 flex items-start gap-2 px-3 py-2 rounded-md bg-amber-50 border border-amber-200">
              <Lock className="w-3.5 h-3.5 text-amber-700 mt-0.5 shrink-0" />
              <div className="text-[11.5px] text-amber-900 leading-snug">
                Rate will be locked once the quote is sent to the customer.
              </div>
            </div>
          )}

          {/* Currency rows */}
          <div className="rounded-lg border border-slate-200 bg-white overflow-hidden divide-y divide-slate-100">
            {/* Customer pays */}
            <div className="px-3.5 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[12.5px] text-slate-900" style={{ fontWeight: 600 }}>
                  Customer pays
                </div>
                <div className="text-[11px] text-slate-500 leading-snug">
                  The currency on the customer's invoice.
                  {isCustomCurrency && customerDefaultCurrency && (
                    <> Customer's default is <span className="text-slate-700" style={{ fontWeight: 500 }}>{customerDefaultCurrency}</span>.</>
                  )}
                </div>
              </div>
              <div className="shrink-0">
                {locked ? (
                  <span className="inline-flex items-center gap-1.5 text-[12.5px] text-slate-700">
                    <CurrencyFlag currency={customerCur} size={16} />
                    <span style={{ fontWeight: 600 }}>{customerCur.symbol ?? customerCur.code} {customerCur.code}</span>
                  </span>
                ) : (
                  <QuoteCurrencyPicker
                    value={currency}
                    customerDefault={customerDefaultCurrency}
                    onChange={setCurrency}
                  />
                )}
              </div>
            </div>

            {/* You receive */}
            <div className="px-3.5 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[12.5px] text-slate-900" style={{ fontWeight: 600 }}>
                  You receive
                </div>
                <div className="text-[11px] text-slate-500 leading-snug">
                  Currency settled into your books. Defaults to base currency ({BASE_CURRENCY}).
                </div>
              </div>
              <div className="shrink-0">
                {locked ? (
                  <span className="inline-flex items-center gap-1.5 text-[12.5px] text-slate-700">
                    <CurrencyFlag currency={settlementCur} size={16} />
                    <span style={{ fontWeight: 600 }}>{settlementCur.symbol ?? settlementCur.code} {settlementCur.code}</span>
                  </span>
                ) : (
                  <QuoteCurrencyPicker
                    value={settlement}
                    customerDefault={BASE_CURRENCY}
                    onChange={setSettlement}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Rate type toggle — applies to all rate legs in this modal. */}
          {legs.length > 0 && (
            <div className="mt-4 flex items-center justify-between">
              <span className="text-[11.5px] text-slate-500" style={{ fontWeight: 500 }}>
                Rate type {legs.length > 1 && <span className="text-slate-400">— applies to both legs</span>}
              </span>
              <MarketCorporateToggle variant="inline" />
            </div>
          )}

          {/* Rate cards */}
          {legs.length === 0 ? (
            <div className="mt-3 px-3 py-3 rounded-md bg-slate-50 border border-slate-100 text-[12px] text-slate-600">
              All amounts settle in {BASE_CURRENCY} (base currency) — no FX conversion needed.
            </div>
          ) : (
            <div className="mt-3 flex flex-col gap-2">
              {legs.map((leg, idx) => (
                <RateCard
                  key={`${leg.from}-${leg.to}`}
                  leg={leg}
                  rateType={rateType}
                  snapshot={snapshot}
                  legIndex={legs.length > 1 ? idx + 1 : undefined}
                />
              ))}

              {/* Base-equivalent helper: if neither currency nor settlement is base, surface the implied base value of 1 customer unit. */}
              {!currencyIsBase && !settlementIsBase && currency !== settlement && (
                <div className="text-[11px] text-slate-500 px-1">
                  Base equivalent of 1 {currency}: <span className="text-slate-700 tabular-nums" style={{ fontWeight: 500 }}>
                    {baseSym} {convertBetween(1, currency, BASE_CURRENCY).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {BASE_CURRENCY}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Reset row */}
          {!locked && (isCustomCurrency || isCustomSettlement) && (
            <button
              type="button"
              onClick={handleReset}
              className="mt-4 inline-flex items-center gap-1.5 text-[11.5px] text-slate-600 hover:text-primary transition-colors cursor-pointer"
              style={{ fontWeight: 500 }}
            >
              <RotateCcw className="w-3 h-3" />
              Reset to default
            </button>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            {locked ? "Close" : "Cancel"}
          </Button>
          {!locked && (
            <Button size="sm" onClick={handleSave} disabled={!dirty}>
              Save changes
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RateCard({
  leg,
  rateType,
  snapshot,
  legIndex,
}: {
  leg: { from: string; to: string; rate: number };
  rateType: RateType;
  snapshot: { source: string; lastSyncAt: string };
  legIndex?: number;
}) {
  const fromCur = getLibraryCurrency(leg.from)!;
  const toCur = getLibraryCurrency(leg.to)!;
  const fromSym = fromCur.symbol ?? fromCur.code;
  const toSym = toCur.symbol ?? toCur.code;
  const inverse = leg.rate !== 0 ? 1 / leg.rate : 0;
  const hex = RATE_TYPE_HEX[rateType];
  const updated = formatRateUpdatedAs(snapshot.lastSyncAt);

  // Mid-market metadata: source + last-updated. Corporate metadata: created by + last-updated date.
  const meta = rateType === "market"
    ? <>Source: <span className="text-slate-700" style={{ fontWeight: 500 }}>{snapshot.source}</span> · Updated as of {updated}</>
    : <>Created by <span className="text-slate-700" style={{ fontWeight: 500 }}>Treasury</span> · {snapshot.source} · Effective {updated}</>;

  return (
    <div className="rounded-md border border-slate-200 bg-white">
      {/* Heading */}
      <div className="px-3.5 py-2 flex items-center justify-between border-b border-slate-100">
        <div className="flex items-center gap-2 text-[11.5px] text-slate-700">
          {legIndex && (
            <span
              className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] tabular-nums shrink-0"
              style={{ fontWeight: 600 }}
            >
              {legIndex}
            </span>
          )}
          <span className="inline-flex items-center gap-1" style={{ fontWeight: 600 }}>
            <CurrencyFlag currency={fromCur} size={14} /> {fromCur.code}
          </span>
          <ArrowRight className="w-3 h-3 text-slate-400" />
          <span className="inline-flex items-center gap-1" style={{ fontWeight: 600 }}>
            <CurrencyFlag currency={toCur} size={14} /> {toCur.code}
          </span>
        </div>
        <span
          className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full"
          style={{ color: hex, backgroundColor: `color-mix(in srgb, ${hex} 8%, transparent)`, fontWeight: 600 }}
        >
          <span className="w-1 h-1 rounded-full" style={{ backgroundColor: hex }} />
          {rateTypeLabel(rateType)}
        </span>
      </div>
      {/* Bidirectional rates */}
      <div className="px-3.5 py-2.5 grid grid-cols-2 gap-3 text-[12px] tabular-nums">
        <div>
          <div className="text-[10px] text-slate-400 uppercase tracking-wide" style={{ fontWeight: 600, letterSpacing: "0.04em" }}>Forward</div>
          <div className="text-slate-800" style={{ fontWeight: 600 }}>
            1 {fromCur.code} = {toSym} {fmtRate(leg.rate)} {toCur.code}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-slate-400 uppercase tracking-wide" style={{ fontWeight: 600, letterSpacing: "0.04em" }}>Inverse</div>
          <div className="text-slate-800" style={{ fontWeight: 600 }}>
            1 {toCur.code} = {fromSym} {fmtRate(inverse)} {fromCur.code}
          </div>
        </div>
      </div>
      {/* Metadata */}
      <div className="px-3.5 pb-2.5 text-[10.5px] text-slate-500">
        {meta}
      </div>
    </div>
  );
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
