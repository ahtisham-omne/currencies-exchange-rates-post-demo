import * as React from "react";
import { useMemo, useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  Settings2,
  Check,
  ChevronDown,
  AlertTriangle,
  Lock,
  ArrowRight,
} from "lucide-react";
import { Dialog, DialogContent } from "../ui/dialog";
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
import { CurrencyFlag } from "../ui/CurrencyFlag";
import {
  BASE_CURRENCY,
  CURRENCY_LIBRARY,
  MARKET_RATES,
  activeRateSnapshot,
  getLibraryCurrency,
  rateTypeLabel,
} from "@/app/data/currencyLibrary";
import { formatRateUpdatedAs } from "@/app/data/rateDateFormat";
import type { SelectedPOData } from "../VendorSelectionModalNested";

interface Props {
  selectedPOs: SelectedPOData[];
  onCancel: () => void;
  onContinue: (config: { vendorCurrency: string; settlementCurrency: string }) => void;
}

/**
 * Pre-creation rate-preview modal. Sits between vendor/PO selection and
 * the actual create-invoice screen, giving the user one last look at
 * the FX context before they enter the form:
 *  - PO locked rate (committed at PO date) vs Today's rate (used for the
 *    invoice ledger entry per accounting rules), side by side, with
 *    variance.
 *  - Currency configuration carried over from the PO. Settlement
 *    currency edits freely; vendor currency change requires confirmation
 *    (changing it later in the flow is awkward, so this is the natural
 *    gate).
 */
export function RatePreviewModal({ selectedPOs, onCancel, onContinue }: Props) {
  const referencePO = selectedPOs[0];
  const initialVendorCurrency = (referencePO?.currency || BASE_CURRENCY).toUpperCase();

  const [vendorCurrency, setVendorCurrency] = useState<string>(initialVendorCurrency);
  const [settlementCurrency, setSettlementCurrency] = useState<string>(BASE_CURRENCY);
  const [editing, setEditing] = useState(false);
  const [pendingVendorCurrency, setPendingVendorCurrency] = useState<string | null>(null);

  const baseCur = getLibraryCurrency(BASE_CURRENCY)!;
  const baseSym = baseCur.symbol ?? BASE_CURRENCY;
  const isBaseInvoice = vendorCurrency === BASE_CURRENCY;

  const todayRate = useMemo(() => {
    if (isBaseInvoice) return 1;
    return MARKET_RATES.rates[vendorCurrency] ?? 1;
  }, [vendorCurrency, isBaseInvoice]);

  const poLockedRate = useMemo(() => {
    if (!referencePO || isBaseInvoice) return undefined;
    const seed = referencePO.poDate.split("-").reduce((acc, p) => acc + parseInt(p, 10), 0);
    const variance = ((seed % 30) - 15) / 1000;
    return Number((todayRate * (1 + variance - 0.014)).toFixed(2));
  }, [referencePO, todayRate, isBaseInvoice]);

  const variancePct = useMemo(() => {
    if (poLockedRate === undefined || poLockedRate === 0) return null;
    return ((todayRate - poLockedRate) / poLockedRate) * 100;
  }, [todayRate, poLockedRate]);

  const handleVendorCurrencyChange = (next: string) => {
    if (next === vendorCurrency) return;
    setPendingVendorCurrency(next);
  };

  const confirmVendorCurrencyChange = () => {
    if (pendingVendorCurrency) setVendorCurrency(pendingVendorCurrency);
    setPendingVendorCurrency(null);
  };

  const cancelVendorCurrencyChange = () => setPendingVendorCurrency(null);

  return (
    <>
      <Dialog open={!pendingVendorCurrency} onOpenChange={(o) => { if (!o) onCancel(); }}>
        <DialogContent
          className="max-w-[560px] p-0 overflow-hidden gap-0"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="px-6 pt-6 pb-3">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-[16px] text-slate-900" style={{ fontWeight: 600 }}>
                Currency & Rate Preview
              </h2>
              {referencePO && (
                <span className="text-[11px] text-slate-500 tabular-nums">
                  From {referencePO.poNumber}
                </span>
              )}
            </div>
            <p className="text-[12px] text-slate-500 mt-1 leading-relaxed">
              The PO locked an exchange rate at commitment time. Per accounting rules, the
              invoice records at today's mid-market rate — review the variance below and
              continue.
            </p>
          </div>

          {isBaseInvoice ? (
            <BaseCurrencyNotice />
          ) : (
            <RateComparison
              vendorCurrency={vendorCurrency}
              poLockedRate={poLockedRate}
              poLockedAt={referencePO?.poDate}
              todayRate={todayRate}
              variancePct={variancePct}
              baseSym={baseSym}
            />
          )}

          <div className="px-6 pt-2 pb-2">
            <ConfigSummary
              vendorCurrency={vendorCurrency}
              settlementCurrency={settlementCurrency}
              editing={editing}
              onToggleEdit={() => setEditing((e) => !e)}
            />
            {editing && (
              <ConfigEditor
                vendorCurrency={vendorCurrency}
                settlementCurrency={settlementCurrency}
                onVendorCurrencyChange={handleVendorCurrencyChange}
                onSettlementCurrencyChange={setSettlementCurrency}
              />
            )}
          </div>

          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => onContinue({ vendorCurrency, settlementCurrency })}
              className="gap-1.5"
            >
              Continue to Invoice
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {pendingVendorCurrency && (
        <ConfirmVendorCurrencyDialog
          fromCurrency={vendorCurrency}
          toCurrency={pendingVendorCurrency}
          onCancel={cancelVendorCurrencyChange}
          onConfirm={confirmVendorCurrencyChange}
        />
      )}
    </>
  );
}

function BaseCurrencyNotice() {
  return (
    <div className="mx-6 mb-3 rounded-lg border border-slate-200 bg-slate-50/70 px-3.5 py-3 text-[12px] text-slate-600">
      This invoice is denominated in the company base currency ({BASE_CURRENCY}). No
      FX conversion or rate variance applies — you can continue straight to the invoice
      form.
    </div>
  );
}

function RateComparison({
  vendorCurrency,
  poLockedRate,
  poLockedAt,
  todayRate,
  variancePct,
  baseSym,
}: {
  vendorCurrency: string;
  poLockedRate: number | undefined;
  poLockedAt: string | undefined;
  todayRate: number;
  variancePct: number | null;
  baseSym: string;
}) {
  const snap = activeRateSnapshot();
  const hex = snap.type === "market" ? "#7c3aed" : "#d97706";
  const isUp = (variancePct ?? 0) > 0;
  const isFlat = Math.abs(variancePct ?? 0) < 0.05;

  return (
    <div className="mx-6 mb-3">
      <div className="grid grid-cols-2 gap-2">
        <RateCard
          label="PO locked rate"
          subLabel="Committed at PO send"
          rate={poLockedRate}
          dateLabel={poLockedAt ? formatLockedDate(poLockedAt) : undefined}
          dateCaption="locked"
          accent="#0ea5e9"
          icon={<Lock className="w-3 h-3" />}
          fromCode={vendorCurrency}
          toCode={BASE_CURRENCY}
          baseSym={baseSym}
        />
        <RateCard
          label="Today's rate"
          subLabel="Will record the invoice"
          rate={todayRate}
          dateLabel={formatRateUpdatedAs(snap.lastSyncAt)}
          dateCaption="updated"
          accent={hex}
          icon={<span className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: hex }} />}
          fromCode={vendorCurrency}
          toCode={BASE_CURRENCY}
          baseSym={baseSym}
          rateTypeLabel={rateTypeLabel(snap.type)}
        />
      </div>

      {variancePct !== null && (
        <div
          className="mt-2 rounded-md border px-3 py-2 flex items-center gap-2.5"
          style={{
            backgroundColor: isFlat ? "#f8fafc" : isUp ? "#fef2f2" : "#ecfdf5",
            borderColor: isFlat ? "#e2e8f0" : isUp ? "#fecaca" : "#a7f3d0",
          }}
        >
          {!isFlat && (
            <span style={{ color: isUp ? "#dc2626" : "#059669" }}>
              {isUp ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            </span>
          )}
          <div className="flex-1">
            <div
              className="text-[12px] tabular-nums"
              style={{ color: isFlat ? "#475569" : isUp ? "#991b1b" : "#065f46", fontWeight: 600 }}
            >
              {isFlat
                ? "Negligible FX change between PO and today"
                : `Variance: ${variancePct >= 0 ? "+" : ""}${variancePct.toFixed(2)}%`}
            </div>
            <div className="text-[10.5px] text-slate-500 leading-snug mt-0.5">
              {isFlat
                ? "The committed rate and today's market rate are essentially the same."
                : isUp
                ? "Vendor currency strengthened — recording at today's rate costs more PKR than the PO budget."
                : "Vendor currency weakened — recording at today's rate costs less PKR than the PO budget."}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RateCard({
  label,
  subLabel,
  rate,
  dateLabel,
  dateCaption,
  accent,
  icon,
  fromCode,
  toCode,
  baseSym,
  rateTypeLabel: rateTypeText,
}: {
  label: string;
  subLabel: string;
  rate: number | undefined;
  dateLabel: string | undefined;
  dateCaption: string;
  accent: string;
  icon: React.ReactNode;
  fromCode: string;
  toCode: string;
  baseSym: string;
  rateTypeLabel?: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[10.5px]" style={{ color: accent, fontWeight: 600 }}>
        <span className="inline-flex">{icon}</span>
        <span>{label}</span>
      </div>
      <div className="text-[10px] text-slate-500 mt-0.5">{subLabel}</div>
      <div className="mt-2 text-[13px] text-slate-900 tabular-nums" style={{ fontWeight: 600 }} dir="ltr">
        1 {fromCode.toUpperCase()} = <bdi>{baseSym}</bdi>{" "}
        {rate !== undefined ? formatNumber(rate, BASE_CURRENCY) : "—"} {toCode.toUpperCase()}
      </div>
      {rateTypeText && (
        <div className="text-[10px] text-slate-500 mt-1.5">{rateTypeText}</div>
      )}
      {dateLabel && (
        <div className="text-[10px] text-slate-400 mt-0.5">
          {dateCaption} {dateLabel}
        </div>
      )}
    </div>
  );
}

function ConfigSummary({
  vendorCurrency,
  settlementCurrency,
  editing,
  onToggleEdit,
}: {
  vendorCurrency: string;
  settlementCurrency: string;
  editing: boolean;
  onToggleEdit: () => void;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/40 px-3.5 py-2.5 flex flex-col gap-2">
      <div className="flex items-center gap-3 flex-wrap">
        <ChipPair label="Vendor billed in" code={vendorCurrency} />
        <span className="text-slate-300">·</span>
        <ChipPair label="You'll settle in" code={settlementCurrency} />
      </div>
      <button
        type="button"
        onClick={onToggleEdit}
        className="inline-flex self-start items-center gap-1.5 h-7 px-2.5 rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors text-[11px]"
        style={{ fontWeight: 500 }}
      >
        <Settings2 className="w-3 h-3" />
        {editing ? "Done editing" : "Edit Currency Configuration"}
      </button>
    </div>
  );
}

function ChipPair({ label, code }: { label: string; code: string }) {
  const cur = getLibraryCurrency(code);
  return (
    <div className="inline-flex items-center gap-1.5 min-w-0">
      <span className="text-[11px] text-slate-500 whitespace-nowrap">{label}</span>
      <span className="inline-flex items-center gap-1.5 h-6 px-2 rounded-md bg-white border border-slate-200">
        {cur && <CurrencyFlag currency={cur} size={14} />}
        <span className="text-[11.5px] text-slate-800 tabular-nums" style={{ fontWeight: 600 }}>
          {code.toUpperCase()}
        </span>
      </span>
    </div>
  );
}

function ConfigEditor({
  vendorCurrency,
  settlementCurrency,
  onVendorCurrencyChange,
  onSettlementCurrencyChange,
}: {
  vendorCurrency: string;
  settlementCurrency: string;
  onVendorCurrencyChange: (v: string) => void;
  onSettlementCurrencyChange: (v: string) => void;
}) {
  return (
    <div className="mt-2 rounded-lg border border-slate-200 bg-white px-3.5 py-3 flex flex-col gap-3">
      <Field
        label="Vendor billed in"
        helper="The currency on the vendor's invoice. Inherited from the PO; changing this requires confirmation."
        value={vendorCurrency}
        onChange={onVendorCurrencyChange}
        warnOnChange
      />
      <Field
        label="You'll settle in"
        helper="The currency the company books this liability in. Defaults to base currency."
        value={settlementCurrency}
        onChange={onSettlementCurrencyChange}
      />
      <div className="text-[10.5px] text-slate-500">
        Base currency stays {BASE_CURRENCY} — that's how cross-vendor totals stay
        comparable.
      </div>
    </div>
  );
}

function Field({
  label,
  helper,
  value,
  onChange,
  warnOnChange,
}: {
  label: string;
  helper: string;
  value: string;
  onChange: (v: string) => void;
  warnOnChange?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex-1 min-w-0">
        <div className="text-[11.5px] text-slate-700" style={{ fontWeight: 600 }}>{label}</div>
        <div className="text-[10.5px] text-slate-500 mt-0.5 leading-snug">{helper}</div>
      </div>
      <div className="shrink-0">
        <CurrencySelect value={value} onChange={onChange} subtleWarning={warnOnChange} />
      </div>
    </div>
  );
}

function CurrencySelect({
  value,
  onChange,
  subtleWarning,
}: {
  value: string;
  onChange: (v: string) => void;
  subtleWarning?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const cur = getLibraryCurrency(value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-2 h-9 px-3 rounded-md border border-slate-200 bg-white text-[13px] hover:bg-slate-50 transition-colors min-w-[150px]"
        >
          {cur && <CurrencyFlag currency={cur} size={18} />}
          <span className="text-slate-800" style={{ fontWeight: 600 }}>
            {value.toUpperCase()}
          </span>
          {subtleWarning && (
            <AlertTriangle className="w-3 h-3 text-amber-500 ml-0.5" />
          )}
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-auto" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={4}
        className="p-0 w-[280px] rounded-lg border border-slate-200 shadow-lg z-[200]"
      >
        <Command
          filter={(itemValue, search) => {
            const q = search.trim().toLowerCase();
            if (!q) return 1;
            return itemValue.toLowerCase().includes(q) ? 1 : 0;
          }}
        >
          <CommandInput placeholder="Search currency..." className="h-10 text-[13px]" />
          <CommandList className="max-h-[260px] overflow-y-auto">
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

function ConfirmVendorCurrencyDialog({
  fromCurrency,
  toCurrency,
  onCancel,
  onConfirm,
}: {
  fromCurrency: string;
  toCurrency: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const fromCur = getLibraryCurrency(fromCurrency);
  const toCur = getLibraryCurrency(toCurrency);
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent
        className="max-w-[460px] p-0 overflow-hidden gap-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="px-6 pt-6 pb-2 flex items-start gap-3">
          <div
            className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center"
            style={{ backgroundColor: "#fef3c7", color: "#b45309" }}
          >
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div className="flex-1">
            <h3 className="text-[15px] text-slate-900" style={{ fontWeight: 600 }}>
              Change vendor currency?
            </h3>
            <p className="text-[12px] text-slate-500 mt-1 leading-relaxed">
              The vendor billed this PO in <strong>{fromCurrency}</strong>. Changing the
              vendor currency to <strong>{toCurrency}</strong> means line-item amounts will
              be re-interpreted in the new currency for this invoice. This is rarely
              correct — only do this if the vendor's actual invoice differs from the PO.
            </p>
            <div className="mt-3 inline-flex items-center gap-2 text-[12px] text-slate-700 tabular-nums px-3 py-1.5 rounded-md bg-slate-50 border border-slate-100">
              {fromCur && <CurrencyFlag currency={fromCur} size={16} />}
              <span style={{ fontWeight: 600 }}>{fromCurrency}</span>
              <ArrowRight className="w-3 h-3 text-slate-400" />
              {toCur && <CurrencyFlag currency={toCur} size={16} />}
              <span style={{ fontWeight: 600 }}>{toCurrency}</span>
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            Yes, change to {toCurrency}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function formatLockedDate(input: string): string {
  const d = new Date(input);
  if (isNaN(d.getTime())) return input;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatNumber(value: number, code: string): string {
  const zeroDecimals = new Set(["JPY", "KRW", "VND", "IDR", "HUF", "ISK", "CLP"]);
  const threeDecimals = new Set(["KWD", "BHD", "OMR", "JOD", "TND"]);
  const upper = code.toUpperCase();
  const decimals = zeroDecimals.has(upper) ? 0 : threeDecimals.has(upper) ? 3 : 2;
  return value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
