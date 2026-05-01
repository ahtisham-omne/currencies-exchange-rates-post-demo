import * as React from "react";
import { useMemo, useState } from "react";
import { Check, ChevronDown, Lock, RotateCcw, TrendingUp, TrendingDown } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../ui/dialog";
import { Button } from "../ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../ui/command";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "../ui/hover-card";
import { toast } from "sonner";
import { CurrencyFlag } from "../ui/CurrencyFlag";
import {
  BASE_CURRENCY,
  CURRENCY_LIBRARY,
  convertBetween,
  getLibraryCurrency,
} from "@/app/data/currencyLibrary";
import { formatRateUpdatedAs } from "@/app/data/rateDateFormat";
import type { Invoice } from "@/app/data/mockInvoices";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  invoice: Invoice;
}

/**
 * Invoice-level currency configuration. Mirrors the PO config modal visually
 * but adapts to the vendor-invoicing reality:
 *  - Vendor Invoiced is fully read-only — the currency is fixed by the
 *    vendor's invoice and cannot be changed at recording time.
 *  - You Record In (settlement) defaults to the company base currency and
 *    is editable until the invoice is approved/posted.
 *  - No rate-type switch. Vendor invoices must record at the mid-market rate
 *    on invoice date (accounting requirement).
 *  - Rate panel shows TWO rates side by side: the invoice-date mid-market
 *    rate and the rate that was locked when the originating PO was created.
 *    Variance between them is the FX impact of the commitment-vs-record gap.
 */
export default function VICurrencyConfigModal({ open, onOpenChange, invoice }: Props) {
  const isLocked = invoice.status !== "Pending Approval";
  const readOnly = isLocked;
  const vendorCurrency = (invoice.currency || BASE_CURRENCY).toUpperCase();
  const isBaseInvoice = vendorCurrency === BASE_CURRENCY;

  const initialSettlement = (): string => BASE_CURRENCY;

  const [settlementCurrency, setSettlementCurrency] = useState<string>(initialSettlement());

  React.useEffect(() => {
    if (open) {
      setSettlementCurrency(initialSettlement());
    }
  }, [open, invoice.id]);

  // Vendor's invoice amount in their currency (already what's stored on Invoice).
  const vendorAmount = invoice.amount;

  // Invoice-date rate captured on the invoice. Falls back to live conversion
  // for the rare case of unseeded mock data.
  const invoiceRate = invoice.lockedRate ?? (isBaseInvoice ? 1 : convertBetween(1, vendorCurrency, BASE_CURRENCY));
  const baseAmount = vendorAmount * invoiceRate;

  // Settlement amount = base PKR cost converted to the chosen settlement currency.
  const settlementAmount = useMemo(() => {
    if (settlementCurrency.toUpperCase() === BASE_CURRENCY) return baseAmount;
    return convertBetween(baseAmount, BASE_CURRENCY, settlementCurrency);
  }, [baseAmount, settlementCurrency]);

  const handleSave = () => {
    if (readOnly) {
      onOpenChange(false);
      return;
    }
    toast.success("Currency configuration saved", {
      description: `Settlement currency set to ${settlementCurrency}`,
    });
    onOpenChange(false);
  };

  const handleResetToDefault = () => {
    if (readOnly) return;
    setSettlementCurrency(BASE_CURRENCY);
    toast("Reverted to defaults", { description: `Settlement: ${BASE_CURRENCY}` });
  };

  const lockedAtDisplay = invoice.lockedAt
    ? new Date(invoice.lockedAt).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })
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
            This configuration applies only to this invoice. The vendor's invoice currency is fixed; only settlement and reporting currencies can be adjusted.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pt-4 pb-2 flex flex-col gap-3">
          <AmountField
            label="Vendor Invoiced"
            helper="The amount and currency on the vendor's invoice. Locked — comes directly from the vendor."
            amount={vendorAmount}
            currency={vendorCurrency}
            onCurrencyChange={() => {}}
            readOnly
            basePKR={baseAmount}
          />

          <AmountField
            label="You Record In"
            helper="The currency the company books this liability in. Defaults to base currency."
            amount={settlementAmount}
            currency={settlementCurrency}
            onCurrencyChange={setSettlementCurrency}
            readOnly={readOnly}
            basePKR={baseAmount}
            showBaseEquivalent
          />

          <RatePanel invoice={invoice} />

          {!isLocked && (
            <div
              className="mt-2 inline-flex items-start gap-2 rounded-md px-3 py-2 text-[11.5px] leading-relaxed"
              style={{ backgroundColor: "#fffbeb", color: "#92400e", border: "1px solid #fde68a" }}
            >
              <Lock className="w-3 h-3 mt-[1px] shrink-0" />
              <span>Rate will be locked once the invoice is approved. After that, totals stay fixed even if market rates move.</span>
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

/**
 * Two-rate panel: invoice-date mid-market rate (locked at posting) on top, PO
 * commitment rate beneath, plus the FX variance between them.
 */
function RatePanel({ invoice }: { invoice: Invoice }) {
  const vendorCurrency = (invoice.currency || BASE_CURRENCY).toUpperCase();
  if (vendorCurrency === BASE_CURRENCY) return null;

  const invoiceRate = invoice.lockedRate;
  const poRate = invoice.poLockedRate;

  const variancePct =
    invoiceRate !== undefined && poRate !== undefined && poRate !== 0
      ? ((invoiceRate - poRate) / poRate) * 100
      : null;

  return (
    <div className="flex flex-col gap-2">
      <RateBlock
        label="Invoice rate"
        sublabel="Mid-market on invoice date — used to record this liability"
        rate={invoiceRate}
        capturedAt={invoice.lockedAt}
        vendorCurrency={vendorCurrency}
        accent="#7c3aed"
      />
      {poRate !== undefined && (
        <RateBlock
          label="PO creation rate"
          sublabel="Mid-market locked when the originating PO was committed"
          rate={poRate}
          capturedAt={invoice.poLockedAt}
          vendorCurrency={vendorCurrency}
          accent="#0ea5e9"
        />
      )}
      {variancePct !== null && (
        <FXVarianceLine variancePct={variancePct} />
      )}
    </div>
  );
}

function RateBlock({
  label,
  sublabel,
  rate,
  capturedAt,
  vendorCurrency,
  accent,
}: {
  label: string;
  sublabel: string;
  rate: number | undefined;
  capturedAt: string | undefined;
  vendorCurrency: string;
  accent: string;
}) {
  const baseCur = getLibraryCurrency(BASE_CURRENCY)!;
  const baseSym = baseCur.symbol ?? BASE_CURRENCY;
  const vendorCur = getLibraryCurrency(vendorCurrency);
  const vendorSym = vendorCur?.symbol ?? vendorCurrency;
  const updatedAs = formatRateUpdatedAs(capturedAt);

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2.5">
      <div className="flex items-center gap-2 text-[11.5px]">
        <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: accent }} />
        <span style={{ color: accent, fontWeight: 600 }}>{label}</span>
        <span className="text-slate-500">· Source: Open Exchange Rates</span>
      </div>
      <div className="text-[10.5px] text-slate-500 mt-0.5">{sublabel}</div>

      {rate !== undefined ? (
        <div className="mt-2 text-[11.5px] text-slate-700 tabular-nums leading-5" dir="ltr">
          <div>1 {vendorCurrency} = <bdi>{baseSym}</bdi> {formatRate(rate)} {BASE_CURRENCY}</div>
          <div>1 {BASE_CURRENCY} = <bdi>{vendorSym}</bdi> {formatRate(1 / rate)} {vendorCurrency}</div>
        </div>
      ) : (
        <div className="mt-2 text-[11.5px] text-slate-400">Not captured for this invoice</div>
      )}

      {updatedAs && (
        <div className="mt-1.5 text-[10.5px] text-slate-500">Captured {updatedAs}</div>
      )}
    </div>
  );
}

function FXVarianceLine({ variancePct }: { variancePct: number }) {
  const isUp = variancePct > 0;
  const isFlat = Math.abs(variancePct) < 0.05;
  const color = isFlat ? "#64748b" : isUp ? "#dc2626" : "#059669";
  const Icon = isFlat ? null : isUp ? TrendingUp : TrendingDown;
  const label = isFlat
    ? "No material FX change between PO and invoice"
    : isUp
    ? "Vendor currency strengthened against base — costs you more PKR"
    : "Vendor currency weakened against base — costs you less PKR";

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 flex items-center gap-2.5">
      {Icon && <Icon className="w-3.5 h-3.5 shrink-0" style={{ color }} />}
      <div className="flex flex-col">
        <div className="text-[11.5px] tabular-nums" style={{ color, fontWeight: 600 }}>
          FX variance: {variancePct >= 0 ? "+" : ""}{variancePct.toFixed(2)}%
        </div>
        <div className="text-[10.5px] text-slate-500">{label}</div>
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
  const formatted = formatCurrency(amount, currency);
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
        <HoverCard openDelay={150} closeDelay={80}>
          <HoverCardTrigger asChild>
            <div
              role="textbox"
              aria-readonly="true"
              aria-disabled="true"
              aria-label={`${label} in ${currency}`}
              className="flex-1 flex items-center px-4 min-w-0 h-12 rounded-l-xl bg-slate-100 text-slate-400 cursor-help select-none"
            >
              <span
                className="w-full text-[18px] tabular-nums truncate"
                style={{ fontWeight: 500 }}
                dir="ltr"
              >
                {formatted}
              </span>
            </div>
          </HoverCardTrigger>
          <HoverCardContent side="top" align="start" className="w-[320px] p-3 rounded-lg border border-slate-200 shadow-lg bg-white">
            <RateDetailBody amount={amount} currency={currency} basePKR={basePKR} />
          </HoverCardContent>
        </HoverCard>
        <div className="shrink-0 border-l border-slate-200">
          <CurrencySelect value={currency} onChange={onCurrencyChange} disabled={readOnly} />
        </div>
      </div>

      {showBaseEquivalent && !isBase && (
        <div className="text-[11.5px] text-slate-600 tabular-nums" dir="ltr">
          <span className="text-slate-400">≈ </span>
          <bdi>{baseSym}</bdi> {formatCurrency(basePKR, BASE_CURRENCY)} {BASE_CURRENCY}
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
        className="p-0 w-[280px] rounded-lg border border-slate-200 shadow-lg z-[200]"
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

function RateDetailBody({
  amount,
  currency,
  basePKR,
}: {
  amount: number;
  currency: string;
  basePKR: number;
}) {
  const baseCur = getLibraryCurrency(BASE_CURRENCY)!;
  const baseSym = baseCur.symbol ?? BASE_CURRENCY;
  const upperCurrency = currency.toUpperCase();
  const sameAsBase = upperCurrency === BASE_CURRENCY;
  const ratePerUnit = sameAsBase ? 1 : convertBetween(1, currency, BASE_CURRENCY);

  const cur = getLibraryCurrency(currency);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline gap-2 text-[13px] text-slate-900">
        <CurrencyFlag currency={cur ?? baseCur} size={18} />
        <span style={{ fontWeight: 600 }}>{(cur ?? baseCur).name} ({upperCurrency})</span>
      </div>
      <div className="h-px bg-slate-100" />
      {!sameAsBase && (
        <div className="text-[12px] text-slate-700 tabular-nums" dir="ltr">
          Base equivalent: <bdi>{baseSym}</bdi> {formatCurrency(basePKR, BASE_CURRENCY)} {BASE_CURRENCY}
        </div>
      )}
      <div className="px-2 py-1.5 rounded-md bg-slate-50 border border-slate-100">
        {!sameAsBase && (
          <div className="text-[11px] text-slate-700 tabular-nums leading-4" dir="ltr">
            1 {upperCurrency} = <bdi>{baseSym}</bdi> {formatCurrency(ratePerUnit, BASE_CURRENCY)} {BASE_CURRENCY}
          </div>
        )}
        <div className="text-[10px] text-slate-500 mt-0.5">Mid-market — Open Exchange Rates</div>
      </div>
    </div>
  );
}

function formatRate(value: number): string {
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
