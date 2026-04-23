import * as React from "react";
import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../ui/dialog";
import { Button } from "../ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "../ui/hover-card";
import { toast } from "sonner";
import { CurrencyFlag } from "../ui/CurrencyFlag";
import {
  BASE_CURRENCY,
  CURRENCY_LIBRARY,
  activeRateSnapshot,
  convertBetween,
  getLibraryCurrency,
  rateTypeLabel,
  type RateType,
} from "@/app/data/currencyLibrary";
import { formatRateUpdatedAs } from "@/app/data/rateDateFormat";
import { useRateContext } from "../../context/RateContext";
import type { PurchaseOrderData } from "../poStore";
import {
  getPOVendorCurrency,
  getPOSettlementCurrency,
  updatePOVendorAmountCurrency,
  updatePOSettlementConfig,
} from "../poStore";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  po: PurchaseOrderData;
}

/**
 * PO-level currency configuration. Converter-style layout:
 *   [ Vendor Amount + currency ]
 *         1 USD = 278.00 PKR  [Mid-market | Corporate]
 *   [ You Pay + currency ]
 *
 * Both amount fields carry a hover showing the base-currency equivalent, the
 * active PO reference rate, and the rate-source metadata. The inline rate-type
 * switch writes through to the shared currency configurator, so the same type
 * label is used everywhere an exchange rate is displayed.
 */
export default function POCurrencyConfigModal({ open, onOpenChange, po }: Props) {
  const readOnly = po.status !== "Draft";
  const { rateType, setRateType } = useRateContext();

  // "You Pay" defaults to the base currency unless the PO explicitly set a different settlement currency.
  const initialSettlement = (): string => {
    const vendor = getPOVendorCurrency(po);
    const saved = getPOSettlementCurrency(po);
    return saved === vendor ? BASE_CURRENCY : saved;
  };

  const [vendorCurrency, setVendorCurrency] = useState<string>(getPOVendorCurrency(po));
  const [settlementCurrency, setSettlementCurrency] = useState<string>(initialSettlement());

  React.useEffect(() => {
    if (open) {
      setVendorCurrency(getPOVendorCurrency(po));
      setSettlementCurrency(initialSettlement());
    }
  }, [open, po]);

  const totalPKR = po.total ?? 0;

  const vendorAmount = useMemo(() => {
    if (vendorCurrency.toUpperCase() === BASE_CURRENCY) return totalPKR;
    return convertBetween(totalPKR, BASE_CURRENCY, vendorCurrency);
  }, [totalPKR, vendorCurrency, rateType]);

  const settlementAmount = useMemo(() => {
    if (settlementCurrency.toUpperCase() === BASE_CURRENCY) return totalPKR;
    return convertBetween(totalPKR, BASE_CURRENCY, settlementCurrency);
  }, [totalPKR, settlementCurrency, rateType]);

  const crossRate = useMemo(() => {
    if (vendorCurrency.toUpperCase() === settlementCurrency.toUpperCase()) return 1;
    return convertBetween(1, vendorCurrency, settlementCurrency);
  }, [vendorCurrency, settlementCurrency, rateType]);

  const settlementRateAtSave = useMemo(() => {
    if (settlementCurrency.toUpperCase() === BASE_CURRENCY) return 1;
    return convertBetween(1, BASE_CURRENCY, settlementCurrency);
  }, [settlementCurrency, rateType]);

  const handleSave = () => {
    if (readOnly) {
      onOpenChange(false);
      return;
    }
    if (po.lineItems.length === 0 && vendorCurrency !== getPOVendorCurrency(po)) {
      updatePOVendorAmountCurrency(po.id, vendorCurrency);
    }
    updatePOSettlementConfig(po.id, settlementCurrency, settlementAmount, settlementRateAtSave);
    toast.success("Currency configuration saved", { description: `This PO will settle in ${settlementCurrency}` });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[560px] p-0 overflow-hidden gap-0">
        <DialogHeader className="px-6 pt-6 pb-3">
          <DialogTitle className="text-[16px]" style={{ fontWeight: 600 }}>Currency Configuration</DialogTitle>
          <DialogDescription className="text-[12px] text-slate-500 mt-1">
            This configuration applies only to this PO. The vendor's default currency stays the same.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pt-4 pb-6 flex flex-col gap-1">
          <AmountField
            label="Vendor Amount"
            helper="The currency the vendor will receive the amount in. Changing this only applies to this PO."
            amount={vendorAmount}
            currency={vendorCurrency}
            onCurrencyChange={setVendorCurrency}
            readOnly={readOnly}
            basePKR={totalPKR}
          />

          <RateDivider
            fromCurrency={vendorCurrency}
            toCurrency={settlementCurrency}
            rate={crossRate}
            rateType={rateType}
            onRateTypeChange={setRateType}
            readOnly={readOnly}
          />

          <AmountField
            label="You Pay"
            helper="The currency you settle the payment in. Defaults to base currency but can be changed for this PO."
            amount={settlementAmount}
            currency={settlementCurrency}
            onCurrencyChange={setSettlementCurrency}
            readOnly={readOnly}
            basePKR={totalPKR}
          />
        </div>

        <DialogFooter className="px-6 py-4 border-t border-slate-100 flex items-center gap-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={readOnly}>
            Save Configuration
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AmountField({
  label,
  helper,
  amount,
  currency,
  onCurrencyChange,
  readOnly,
  basePKR,
}: {
  label: string;
  helper: string;
  amount: number;
  currency: string;
  onCurrencyChange: (v: string) => void;
  readOnly?: boolean;
  basePKR: number;
}) {
  const cur = getLibraryCurrency(currency);
  const formatted = formatCurrency(amount, currency);

  return (
    <section className="flex flex-col gap-2 py-1">
      <label className="text-[12.5px] text-slate-700" style={{ fontWeight: 600 }}>{label}</label>

      <HoverCard openDelay={150} closeDelay={80}>
        <HoverCardTrigger asChild>
          <div
            className={`flex items-stretch rounded-xl border transition-colors cursor-help ${
              readOnly
                ? "bg-slate-50 border-slate-200 opacity-70"
                : "bg-white border-slate-200 hover:border-slate-300"
            }`}
          >
            <div className="flex-1 flex items-center px-4 min-w-0">
              <input
                type="text"
                readOnly
                value={formatted}
                aria-label={`${label} in ${currency}`}
                className={`w-full h-12 bg-transparent text-[18px] tabular-nums outline-none cursor-help ${
                  readOnly ? "text-slate-500" : "text-slate-900"
                }`}
                style={{ fontWeight: 600 }}
              />
            </div>
            <div className="shrink-0 border-l border-slate-200">
              <CurrencySelect value={currency} onChange={onCurrencyChange} disabled={readOnly} />
            </div>
          </div>
        </HoverCardTrigger>
        <HoverCardContent side="top" align="start" className="w-[320px] p-3 rounded-lg border border-slate-200 shadow-lg bg-white">
          <RateDetailBody amount={amount} currency={currency} basePKR={basePKR} />
        </HoverCardContent>
      </HoverCard>

      <p className="text-[11.5px] text-slate-500 leading-relaxed">{helper}</p>
    </section>
  );
}

function CurrencySelect({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const cur = getLibraryCurrency(value);
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger
        className="h-12 min-w-[128px] rounded-none rounded-r-xl border-0 px-3.5 text-[13px] bg-transparent"
        style={{ fontWeight: 600 }}
      >
        <SelectValue>
          <span className="inline-flex items-center gap-2">
            {cur && <CurrencyFlag currency={cur} size={16} />}
            <span className="text-slate-800" style={{ fontWeight: 600 }}>{value.toUpperCase()}</span>
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="max-h-[300px]">
        {CURRENCY_LIBRARY.map((c) => (
          <SelectItem key={c.code} value={c.code} className="text-[13px]">
            <span className="inline-flex items-center gap-2">
              <CurrencyFlag currency={c} size={14} />
              <span style={{ fontWeight: 600 }}>{c.code}</span>
              <span className="text-slate-500">— {c.name}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function RateDivider({
  fromCurrency,
  toCurrency,
  rate,
  rateType,
  onRateTypeChange,
  readOnly,
}: {
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  rateType: RateType;
  onRateTypeChange: (t: RateType) => void;
  readOnly?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="h-px flex-1 bg-slate-200" />
      <div className="inline-flex items-center gap-2">
        <span className="text-[12.5px] text-slate-700 tabular-nums" style={{ fontWeight: 500 }}>
          1 {fromCurrency.toUpperCase()} = {formatCurrency(rate, toCurrency)} {toCurrency.toUpperCase()}
        </span>
        <RateTypeSwitch rateType={rateType} onChange={onRateTypeChange} disabled={readOnly} />
      </div>
      <div className="h-px flex-1 bg-slate-200" />
    </div>
  );
}

function RateTypeSwitch({
  rateType,
  onChange,
  disabled,
}: {
  rateType: RateType;
  onChange: (t: RateType) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={`inline-flex items-center gap-0.5 h-7 rounded-md border border-slate-200 p-0.5 bg-white ${
        disabled ? "opacity-60" : ""
      }`}
    >
      {(["market", "corporate"] as RateType[]).map((t) => {
        const active = rateType === t;
        const shortLabel = t === "market" ? "Mid-market" : "Corporate";
        return (
          <button
            key={t}
            type="button"
            onClick={() => !disabled && onChange(t)}
            disabled={disabled}
            className={`inline-flex items-center h-full px-2 rounded text-[11px] whitespace-nowrap transition-colors ${
              active
                ? "bg-[var(--primary-tint)] text-primary"
                : "text-slate-500 hover:text-slate-700"
            } ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
            style={{ fontWeight: active ? 600 : 500 }}
          >
            {shortLabel}
          </button>
        );
      })}
    </div>
  );
}

function RateDetailBody({
  amount,
  currency,
  basePKR,
}: {
  amount: number;
  currency: string;
  basePKR: number;
}) {
  const snap = activeRateSnapshot();
  const typeLabel = rateTypeLabel(snap.type);
  const typeHex = snap.type === "market" ? "#7c3aed" : "#d97706";
  const baseCur = getLibraryCurrency(BASE_CURRENCY)!;
  const baseSym = baseCur.symbol ?? BASE_CURRENCY;
  const upperCurrency = currency.toUpperCase();
  const sameAsBase = upperCurrency === BASE_CURRENCY;
  const ratePerUnit = sameAsBase ? 1 : convertBetween(1, currency, BASE_CURRENCY);
  const updatedAs = formatRateUpdatedAs(snap.lastSyncAt);
  const isMarket = snap.type === "market";

  const cur = getLibraryCurrency(currency);
  const currencySymbol = cur?.symbol ?? upperCurrency;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline gap-2 text-[13px] text-slate-900">
        <CurrencyFlag currency={cur ?? baseCur} size={18} />
        <span style={{ fontWeight: 600 }}>{(cur ?? baseCur).name} ({upperCurrency})</span>
      </div>
      <div className="h-px bg-slate-100" />
      {!sameAsBase && (
        <div className="text-[12px] text-slate-700 tabular-nums">
          Base equivalent: {baseSym} {formatCurrency(basePKR, BASE_CURRENCY)} {BASE_CURRENCY}
        </div>
      )}
      <div className="px-2 py-1.5 rounded-md bg-slate-50 border border-slate-100">
        {!sameAsBase && (
          <div className="text-[11px] text-slate-700 tabular-nums leading-4">
            1 {upperCurrency} = {baseSym} {formatCurrency(ratePerUnit, BASE_CURRENCY)} {BASE_CURRENCY}
          </div>
        )}
        <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1.5">
          <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: typeHex }} />
          <span style={{ color: typeHex, fontWeight: 600 }}>{typeLabel}</span>
          {isMarket && <span className="text-slate-400">· Source: {snap.source}</span>}
        </div>
        {updatedAs && (
          <div className="text-[10px] text-slate-400 mt-0.5">Updated as of {updatedAs}</div>
        )}
        <div className="text-[10px] text-slate-400 mt-0.5 italic">Captured at PO creation rate</div>
      </div>
    </div>
  );
}

function formatCurrency(value: number, code: string): string {
  const zeroDecimals = new Set(["JPY", "KRW", "VND", "IDR", "HUF", "ISK", "CLP"]);
  const threeDecimals = new Set(["KWD", "BHD", "OMR", "JOD", "TND"]);
  const upper = code.toUpperCase();
  const decimals = zeroDecimals.has(upper) ? 0 : threeDecimals.has(upper) ? 3 : 2;
  return value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
