import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, Lock, RotateCcw } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/app/components/ui/dialog";
import { Button } from "@/app/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/app/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/app/components/ui/command";
import { toast } from "sonner";
import { CurrencyFlag } from "./CurrencyFlag";
import {
  BASE_CURRENCY,
  CURRENCY_LIBRARY,
  CORPORATE_RATES,
  activeRateSnapshot,
  convertBetween,
  getLibraryCurrency,
  rateTypeLabel,
  formatRate,
  formatMoney,
  type RateType,
} from "@/app/data/currencyLibrary";
import { formatRateUpdatedAs } from "@/app/data/rateDateFormat";
import { useRateContext } from "@/app/context/RateContext";

export interface OrderCurrencyConfig {
  /** The currency the customer is invoiced / pays in. Defaults to customer's primary on first open. */
  currency: string;
  /** The currency we settle into our books. Defaults to base (PKR). */
  settlementCurrency: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Customer's primary currency — used as the "Reset to default" target. */
  customerDefaultCurrency: string;
  /** Current configuration. */
  config: OrderCurrencyConfig;
  /** When `true`, the order has been sent — modal is read-only and the lock chip is shown. */
  locked?: boolean;
  /** ISO date the order was sent. Surfaces inside the lock chip when present. */
  lockedAt?: string;
  /** Order total in PKR (base). Drives the Customer Amount / You Receive display values. */
  orderTotalPKR?: number;
  /** Persisted on save. */
  onSave: (next: OrderCurrencyConfig) => void;
}

/**
 * Order-level currency configuration. Mirrors the Quotes module's
 * QuoteCurrencyConfigModal 1:1, with copy adapted for the sales-order
 * workflow.
 *
 * Layout:
 *   [ Customer Amount + currency ]
 *   [ You Receive + currency ]
 *   Rate type   [Mid-market | Corporate]
 *   [ Rate metadata card ]
 *   [ Lock warning ]
 */
export function OrderCurrencyConfigModal({
  open,
  onOpenChange,
  customerDefaultCurrency,
  config,
  locked,
  lockedAt,
  orderTotalPKR = 0,
  onSave,
}: Props) {
  const readOnly = !!locked;
  const isLocked = !!locked;
  const { rateType, setRateType } = useRateContext();

  const [customerCurrency, setCustomerCurrency] = useState<string>(config.currency);
  const [settlementCurrency, setSettlementCurrency] = useState<string>(config.settlementCurrency);

  useEffect(() => {
    if (open) {
      setCustomerCurrency(config.currency);
      setSettlementCurrency(config.settlementCurrency);
    }
  }, [open, config.currency, config.settlementCurrency]);

  const totalPKR = orderTotalPKR ?? 0;

  const customerAmount = useMemo(() => {
    if (customerCurrency.toUpperCase() === BASE_CURRENCY) return totalPKR;
    return convertBetween(totalPKR, BASE_CURRENCY, customerCurrency);
  }, [totalPKR, customerCurrency, rateType]);

  const settlementAmount = useMemo(() => {
    if (settlementCurrency.toUpperCase() === BASE_CURRENCY) return totalPKR;
    return convertBetween(totalPKR, BASE_CURRENCY, settlementCurrency);
  }, [totalPKR, settlementCurrency, rateType]);

  const handleSave = () => {
    if (readOnly) {
      onOpenChange(false);
      return;
    }
    onSave({
      currency: customerCurrency.toUpperCase(),
      settlementCurrency: settlementCurrency.toUpperCase(),
    });
    toast.success("Currency configuration saved", {
      description: `This order will settle in ${settlementCurrency}`,
    });
    onOpenChange(false);
  };

  const handleResetToDefault = () => {
    if (readOnly) return;
    setCustomerCurrency(customerDefaultCurrency);
    setSettlementCurrency(BASE_CURRENCY);
    setRateType("market");
    toast("Reverted to defaults", {
      description: `Customer: ${customerDefaultCurrency} · Settlement: ${BASE_CURRENCY} · Mid-market`,
    });
  };

  const lockedAtDisplay = lockedAt
    ? (() => {
        try {
          return new Date(lockedAt).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
        } catch {
          return lockedAt;
        }
      })()
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[560px] p-0 overflow-hidden gap-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader className="px-6 pt-6 pb-3">
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="text-[16px]" style={{ fontWeight: 600 }}>Currency Configuration</DialogTitle>
            {isLocked && (
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] tabular-nums"
                style={{ backgroundColor: "#ecfdf5", color: "#047857", fontWeight: 600, border: "1px solid #a7f3d0" }}
                title={lockedAtDisplay ? `Locked on ${lockedAtDisplay}` : "Locked"}
              >
                <Lock className="w-3 h-3" />
                Locked
                {lockedAtDisplay && <span className="text-[10px] text-emerald-700/70 font-normal">· {lockedAtDisplay}</span>}
              </span>
            )}
          </div>
          <DialogDescription className="text-[12px] text-slate-500 mt-1">
            This configuration applies only to this order. The customer's default currency stays the same.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pt-4 pb-2 flex flex-col gap-3">
          <AmountField
            label="Customer Pays"
            helper="The currency the customer pays in on their invoice. Changing this only applies to this order."
            amount={customerAmount}
            currency={customerCurrency}
            onCurrencyChange={setCustomerCurrency}
            readOnly={readOnly}
            basePKR={totalPKR}
          />

          <AmountField
            label="You Receive"
            helper="The currency you settle the payment into your books. Defaults to base currency but can be changed for this order."
            amount={settlementAmount}
            currency={settlementCurrency}
            onCurrencyChange={setSettlementCurrency}
            readOnly={readOnly}
            basePKR={totalPKR}
            showBaseEquivalent
          />

          <div className="mt-1 flex items-center justify-between">
            <span className="text-[11.5px] text-slate-500" style={{ fontWeight: 500 }}>
              Rate type
            </span>
            <RateTypeSwitch rateType={rateType} onChange={setRateType} disabled={readOnly} />
          </div>

          <RateMetadataPanel
            rateType={rateType}
            customerCurrency={customerCurrency}
            settlementCurrency={settlementCurrency}
          />

          {!isLocked && (
            <div
              className="mt-2 inline-flex items-start gap-2 rounded-md px-3 py-2 text-[11.5px] leading-relaxed"
              style={{ backgroundColor: "#fffbeb", color: "#92400e", border: "1px solid #fde68a" }}
            >
              <Lock className="w-3 h-3 mt-[1px] shrink-0" />
              <span>Rate will be locked once the order is sent to the customer. After that, totals stay fixed even if market rates move.</span>
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-2 sm:flex-row sm:justify-between">
          <button
            type="button"
            onClick={handleResetToDefault}
            disabled={readOnly}
            className="inline-flex items-center gap-1.5 text-[11.5px] text-slate-500 hover:text-slate-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            style={{ fontWeight: 500 }}
          >
            <RotateCcw className="w-3 h-3" />
            Reset to default
          </button>
          <div className="inline-flex items-center gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSave} disabled={readOnly}>
              Save Configuration
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RateMetadataPanel({
  rateType,
  customerCurrency,
  settlementCurrency,
}: {
  rateType: RateType;
  customerCurrency: string;
  settlementCurrency: string;
}) {
  const cc = customerCurrency.toUpperCase();
  const sc = settlementCurrency.toUpperCase();
  const baseCode = BASE_CURRENCY;

  type Conv = { from: string; to: string; label: string };
  const conversions: Conv[] = [];

  if (cc !== sc) {
    conversions.push({
      from: cc,
      to: sc,
      label: sc === baseCode ? "Customer amount → Base currency" : "Customer amount → You Receive",
    });
    if (sc !== baseCode && cc !== baseCode) {
      conversions.push({
        from: sc,
        to: baseCode,
        label: "You Receive → Base currency (reporting)",
      });
    }
  } else if (sc !== baseCode) {
    conversions.push({
      from: sc,
      to: baseCode,
      label: "Customer amount → Base currency",
    });
  }

  if (conversions.length === 0) {
    return null;
  }

  const showHeaders = conversions.length > 1;

  return (
    <div className="flex flex-col gap-2">
      {conversions.map((c) => (
        <ConversionBlock
          key={`${c.from}-${c.to}`}
          fromCode={c.from}
          toCode={c.to}
          label={showHeaders ? c.label : undefined}
          rateType={rateType}
        />
      ))}
    </div>
  );
}

function ConversionBlock({
  fromCode,
  toCode,
  label,
  rateType,
}: {
  fromCode: string;
  toCode: string;
  label?: string;
  rateType: RateType;
}) {
  const snap = activeRateSnapshot();
  const typeLabel = rateTypeLabel(rateType);
  const typeHex = rateType === "market" ? "#7c3aed" : "#d97706";
  const updatedAs = formatRateUpdatedAs(snap.lastSyncAt);
  const corporateAsOf = (() => {
    try {
      return new Date(CORPORATE_RATES.asOfDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
    } catch {
      return CORPORATE_RATES.asOfDate;
    }
  })();

  const forwardRate = convertBetween(1, fromCode, toCode);
  const inverseRate = convertBetween(1, toCode, fromCode);
  const fromCur = getLibraryCurrency(fromCode);
  const toCur = getLibraryCurrency(toCode);
  const fromSym = fromCur?.symbol ?? fromCode;
  const toSym = toCur?.symbol ?? toCode;

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2.5">
      {label && (
        <div
          className="text-[10px] text-slate-400 mb-1.5"
          style={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}
        >
          {label}
        </div>
      )}

      <div className="flex items-center gap-2 text-[11.5px]">
        <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: typeHex }} />
        <span style={{ color: typeHex, fontWeight: 600 }}>{typeLabel}</span>
        {rateType === "market" ? (
          <span className="text-slate-500">· Source: Open Exchange Rates</span>
        ) : (
          <span className="text-slate-500">· Created by Treasury · As of {corporateAsOf}</span>
        )}
      </div>

      <div className="mt-2 text-[11.5px] text-slate-700 tabular-nums leading-5">
        <div>1 {fromCode} = {toSym} {formatRate(forwardRate)} {toCode}</div>
        <div>1 {toCode} = {fromSym} {formatRate(inverseRate)} {fromCode}</div>
      </div>

      <div className="mt-1.5 text-[10.5px] text-slate-500">
        {rateType === "market"
          ? <>Last updated {updatedAs ?? "moments ago"}.</>
          : <>Created by Treasury · Last updated {corporateAsOf}.</>}
      </div>
    </div>
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
  showBaseEquivalent,
}: {
  label: string;
  helper: string;
  amount: number;
  currency: string;
  onCurrencyChange: (v: string) => void;
  readOnly?: boolean;
  basePKR: number;
  showBaseEquivalent?: boolean;
}) {
  const formatted = formatMoney(amount, currency);
  const baseCur = getLibraryCurrency(BASE_CURRENCY)!;
  const baseSym = baseCur.symbol ?? BASE_CURRENCY;
  const isBase = currency.toUpperCase() === BASE_CURRENCY;

  return (
    <section className="flex flex-col gap-2 py-1">
      <label className="text-[12.5px] text-slate-700" style={{ fontWeight: 600 }}>{label}</label>

      <div
        className={`flex items-stretch rounded-xl border transition-colors ${
          readOnly
            ? "border-slate-200 opacity-80"
            : "border-slate-200 hover:border-slate-300"
        }`}
      >
        <div
          role="textbox"
          aria-readonly="true"
          aria-disabled="true"
          aria-label={`${label} in ${currency}`}
          className="flex-1 flex items-center px-4 min-w-0 h-12 rounded-l-xl bg-slate-100 text-slate-400 select-none"
        >
          <span
            className="w-full text-[18px] tabular-nums truncate"
            style={{ fontWeight: 500 }}
          >
            {formatted}
          </span>
        </div>
        <div className="shrink-0 border-l border-slate-200">
          <CurrencySelect value={currency} onChange={onCurrencyChange} disabled={readOnly} />
        </div>
      </div>

      {showBaseEquivalent && !isBase && (
        <div className="text-[11.5px] text-slate-600 tabular-nums">
          <span className="text-slate-400">≈ </span>
          {baseSym} {formatMoney(basePKR, BASE_CURRENCY)} {BASE_CURRENCY}
          <span className="text-slate-400"> in base currency</span>
        </div>
      )}

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
  const [open, setOpen] = useState(false);
  const cur = getLibraryCurrency(value);

  return (
    <Popover open={open} onOpenChange={disabled ? undefined : setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <button
          type="button"
          disabled={disabled}
          className={`h-12 min-w-[140px] rounded-none rounded-r-xl border-0 px-3.5 text-[13px] bg-transparent outline-none flex items-center justify-center gap-2 w-full ${
            disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer hover:bg-slate-50"
          }`}
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          {cur && <CurrencyFlag currency={cur} size={22} />}
          <span className="text-slate-800 leading-none" style={{ fontWeight: 600 }}>
            {value.toUpperCase()}
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-auto shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={4}
        className="p-0 w-[280px] rounded-lg border border-slate-200 shadow-lg"
        onWheel={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
      >
        <Command
          filter={(itemValue, search) => {
            const q = search.trim().toLowerCase();
            if (!q) return 1;
            return itemValue.toLowerCase().includes(q) ? 1 : 0;
          }}
        >
          <CommandInput placeholder="Search currency..." className="h-10 text-[13px]" />
          <CommandList
            className="max-h-[260px] overflow-y-auto"
            onWheel={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
          >
            <CommandEmpty className="py-4 text-center text-[12px] text-slate-500">
              No currencies found.
            </CommandEmpty>
            <CommandGroup>
              {CURRENCY_LIBRARY.map((c) => {
                const selected = c.code.toUpperCase() === value.toUpperCase();
                return (
                  <CommandItem
                    key={c.code}
                    value={`${c.code} ${c.name}`}
                    onSelect={() => {
                      onChange(c.code);
                      setOpen(false);
                    }}
                    className="text-[13px] flex items-center gap-2 py-2"
                  >
                    <CurrencyFlag currency={c} size={20} />
                    <span className="text-slate-800" style={{ fontWeight: 600 }}>{c.code}</span>
                    <span className="text-slate-500 truncate">— {c.name}</span>
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
                ? "bg-[#EDF4FF] text-primary"
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
