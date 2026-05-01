import * as React from "react";
import { useMemo, useState } from "react";
import {
  Lock,
  RefreshCw,
  Settings2,
  ArrowRight,
  AlertTriangle,
  Check,
  ChevronDown,
  X,
} from "lucide-react";
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
} from "@/app/data/currencyLibrary";
import { formatRateUpdatedAs } from "@/app/data/rateDateFormat";
import type { SelectedPOData } from "../VendorSelectionModalNested";

interface Props {
  selectedPOs: SelectedPOData[];
  onCancel: () => void;
  onContinue: (config: { vendorCurrency: string; settlementCurrency: string }) => void;
}

/**
 * Pre-creation rate-preview modal. Visual language follows the Quotes
 * module's `DuplicateQuoteModal`: uppercase section headers, side-by-side
 * rate cards with a colored accent, a tinted "What to expect" summary at
 * the bottom, and a discreet outlined "Edit Currency Configuration"
 * button that hands off to an inline editor.
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
    return Math.round(((todayRate - poLockedRate) / poLockedRate) * 1000) / 10;
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
      <div
        className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-[1px]"
        onClick={onCancel}
      >
        <div
          className="bg-white rounded-xl w-[520px] max-w-[95vw] max-h-[85vh] flex flex-col shadow-[0_20px_60px_rgba(0,0,0,0.15)]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 pt-5 pb-4 border-b border-slate-100 shrink-0">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-blue-500" />
                <h2 className="text-[15px] text-slate-900 leading-none m-0" style={{ fontWeight: 600 }}>
                  Currency &amp; Rate Preview
                </h2>
              </div>
              <button
                onClick={onCancel}
                className="w-7 h-7 rounded-md hover:bg-slate-100 flex items-center justify-center transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            <p className="text-[12px] text-slate-500 m-0 leading-relaxed">
              The PO locked an exchange rate at commitment time. Per accounting rules,
              the invoice records at today's mid-market rate — review the variance and
              continue.
              {referencePO && (
                <>
                  {" "}
                  <span className="text-slate-700">From {referencePO.poNumber}</span>
                  {referencePO.poDate ? ` · ${formatLockedDate(referencePO.poDate)}` : ""}
                </>
              )}
            </p>
          </div>

          {/* Content */}
          <div className="px-6 py-4 flex-1 overflow-y-auto flex flex-col gap-4">
            {isBaseInvoice ? (
              <BaseCurrencyNotice />
            ) : (
              <>
                <RateComparisonSection
                  vendorCurrency={vendorCurrency}
                  poLockedRate={poLockedRate}
                  poLockedAt={referencePO?.poDate}
                  todayRate={todayRate}
                  variancePct={variancePct}
                  baseSym={baseSym}
                />
                <Divider />
              </>
            )}

            <CurrencyConfigSection
              vendorCurrency={vendorCurrency}
              settlementCurrency={settlementCurrency}
              editing={editing}
              onToggleEdit={() => setEditing((e) => !e)}
              onVendorCurrencyChange={handleVendorCurrencyChange}
              onSettlementCurrencyChange={setSettlementCurrency}
            />

            <Divider />

            <WhatToExpectSection
              vendorCurrency={vendorCurrency}
              settlementCurrency={settlementCurrency}
              poLockedRate={poLockedRate}
              todayRate={todayRate}
              variancePct={variancePct}
              baseSym={baseSym}
              isBaseInvoice={isBaseInvoice}
            />
          </div>

          {/* Footer */}
          <div className="px-6 py-3.5 border-t border-slate-100 shrink-0 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="h-9 px-3.5 text-[13px] text-slate-600 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors"
              style={{ fontWeight: 500 }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onContinue({ vendorCurrency, settlementCurrency })}
              className="inline-flex items-center gap-1.5 h-9 px-4 text-[13px] text-white bg-blue-500 hover:bg-blue-600 rounded-md transition-colors"
              style={{ fontWeight: 500 }}
            >
              Continue to Invoice
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

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

function Divider() {
  return <div className="h-px bg-slate-100 -mx-6" />;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="text-[11px] text-slate-500 uppercase mb-2"
      style={{ fontWeight: 600, letterSpacing: "0.04em" }}
    >
      {children}
    </div>
  );
}

function BaseCurrencyNotice() {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-3.5 py-3 text-[12.5px] text-slate-600 leading-relaxed">
      This invoice is denominated in the company base currency ({BASE_CURRENCY}). No
      FX conversion or rate variance applies — you can continue straight to the invoice
      form.
    </div>
  );
}

function RateComparisonSection({
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
  const isUp = (variancePct ?? 0) > 0;
  const isFlat = Math.abs(variancePct ?? 0) < 0.05;
  const code = vendorCurrency.toUpperCase();

  return (
    <div>
      <SectionLabel>Exchange rate comparison</SectionLabel>
      <div className="grid grid-cols-2 gap-2">
        <RateCard
          accent="emerald"
          icon={<Lock className="w-3 h-3" />}
          eyebrow="PO locked"
          eyebrowDetail={poLockedAt ? `Committed ${formatLockedDate(poLockedAt)}` : "Committed at PO send"}
          rate={poLockedRate}
          fromCode={code}
          baseSym={baseSym}
        />
        <RateCard
          accent="violet"
          icon={<RefreshCw className="w-3 h-3" />}
          eyebrow="Today's rate"
          eyebrowDetail="Will record the invoice"
          rate={todayRate}
          fromCode={code}
          baseSym={baseSym}
          footer={`Mid-market · updated ${formatRateUpdatedAs(snap.lastSyncAt)}`}
        />
      </div>

      {variancePct !== null && (
        <div
          className="mt-2.5 rounded-lg border px-3 py-2.5 flex items-start gap-2.5"
          style={{
            backgroundColor: isFlat ? "#f8fafc" : isUp ? "#fff7ed" : "#ecfdf5",
            borderColor: isFlat ? "#e2e8f0" : isUp ? "#fed7aa" : "#a7f3d0",
          }}
        >
          <span
            className="shrink-0 mt-0.5 inline-flex items-center justify-center w-5 h-5 rounded-full"
            style={{
              backgroundColor: isFlat ? "#e2e8f0" : isUp ? "#fed7aa" : "#a7f3d0",
              color: isFlat ? "#475569" : isUp ? "#9a3412" : "#065f46",
            }}
          >
            {isFlat ? <Check className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
          </span>
          <div className="flex-1 min-w-0">
            <div
              className="text-[12px] tabular-nums"
              style={{ color: isFlat ? "#475569" : isUp ? "#9a3412" : "#065f46", fontWeight: 600 }}
            >
              {isFlat
                ? "FX is essentially flat between PO and today"
                : `Variance: ${variancePct >= 0 ? "+" : ""}${variancePct.toFixed(2)}% vs locked rate`}
            </div>
            <div className="text-[11px] text-slate-600 leading-snug mt-0.5">
              {isFlat
                ? "The committed rate and today's market rate are the same to the dollar."
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
  accent,
  icon,
  eyebrow,
  eyebrowDetail,
  rate,
  fromCode,
  baseSym,
  footer,
}: {
  accent: "emerald" | "violet";
  icon: React.ReactNode;
  eyebrow: string;
  eyebrowDetail: string;
  rate: number | undefined;
  fromCode: string;
  baseSym: string;
  footer?: string;
}) {
  const accentColors = accent === "emerald"
    ? { iconBg: "#ecfdf5", iconText: "#047857", eyebrowText: "#047857" }
    : { iconBg: "#f5f3ff", iconText: "#7c3aed", eyebrowText: "#7c3aed" };

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <span
          className="inline-flex items-center justify-center w-5 h-5 rounded"
          style={{ backgroundColor: accentColors.iconBg, color: accentColors.iconText }}
        >
          {icon}
        </span>
        <span
          className="text-[10.5px] uppercase tracking-wider"
          style={{ color: accentColors.eyebrowText, fontWeight: 700, letterSpacing: "0.04em" }}
        >
          {eyebrow}
        </span>
      </div>
      <div className="text-[10.5px] text-slate-500 leading-tight">{eyebrowDetail}</div>
      <div className="text-[14px] text-slate-900 tabular-nums" style={{ fontWeight: 600 }} dir="ltr">
        1 {fromCode} = <bdi>{baseSym}</bdi>{" "}
        {rate !== undefined ? formatNumber(rate, BASE_CURRENCY) : "—"} {BASE_CURRENCY}
      </div>
      {footer && <div className="text-[10.5px] text-slate-500">{footer}</div>}
    </div>
  );
}

function CurrencyConfigSection({
  vendorCurrency,
  settlementCurrency,
  editing,
  onToggleEdit,
  onVendorCurrencyChange,
  onSettlementCurrencyChange,
}: {
  vendorCurrency: string;
  settlementCurrency: string;
  editing: boolean;
  onToggleEdit: () => void;
  onVendorCurrencyChange: (v: string) => void;
  onSettlementCurrencyChange: (v: string) => void;
}) {
  return (
    <div>
      <SectionLabel>Currency configuration</SectionLabel>
      <div className="rounded-lg border border-slate-200 bg-white px-3.5 py-3 flex flex-col gap-2.5">
        <ConfigRow label="Vendor billed in" code={vendorCurrency} hint="From PO" />
        <ConfigRow label="You'll settle in" code={settlementCurrency} hint="Defaults to base" />
        <ConfigRow
          label="Base currency"
          code={BASE_CURRENCY}
          hint="Locked"
          locked
        />
        <button
          type="button"
          onClick={onToggleEdit}
          className="self-start mt-1 inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md border border-slate-200 bg-white hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 text-[12px] text-slate-700 transition-colors"
          style={{ fontWeight: 500 }}
        >
          <Settings2 className="w-3.5 h-3.5 text-blue-500" />
          {editing ? "Done editing" : "Edit Currency Configuration"}
        </button>
      </div>

      {editing && (
        <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50/40 px-3.5 py-3 flex flex-col gap-3">
          <FieldRow
            label="Vendor billed in"
            helper="From the PO. Changing this requires confirmation — only use it if the vendor's actual invoice differs from what was committed."
            value={vendorCurrency}
            onChange={onVendorCurrencyChange}
            warnOnChange
          />
          <FieldRow
            label="You'll settle in"
            helper="The currency the company books this liability in. Defaults to base."
            value={settlementCurrency}
            onChange={onSettlementCurrencyChange}
          />
          <div className="text-[10.5px] text-slate-500 leading-relaxed">
            Base currency stays {BASE_CURRENCY} so cross-vendor totals stay comparable.
          </div>
        </div>
      )}
    </div>
  );
}

function ConfigRow({
  label,
  code,
  hint,
  locked,
}: {
  label: string;
  code: string;
  hint?: string;
  locked?: boolean;
}) {
  const cur = getLibraryCurrency(code);
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-[12px] text-slate-700">{label}</span>
        {hint && <span className="text-[10.5px] text-slate-400">· {hint}</span>}
      </div>
      <span className="inline-flex items-center gap-1.5 h-7 px-2 rounded-md bg-slate-50 border border-slate-200">
        {cur && <CurrencyFlag currency={cur} size={14} />}
        <span className="text-[12px] text-slate-800 tabular-nums" style={{ fontWeight: 600 }}>
          {code.toUpperCase()}
        </span>
        {locked && <Lock className="w-2.5 h-2.5 text-slate-400" />}
      </span>
    </div>
  );
}

function FieldRow({
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
        <div className="text-[12px] text-slate-700" style={{ fontWeight: 600 }}>{label}</div>
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
        className="p-0 w-[280px] rounded-lg border border-slate-200 shadow-lg z-[210]"
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

function WhatToExpectSection({
  vendorCurrency,
  settlementCurrency,
  poLockedRate,
  todayRate,
  variancePct,
  baseSym,
  isBaseInvoice,
}: {
  vendorCurrency: string;
  settlementCurrency: string;
  poLockedRate: number | undefined;
  todayRate: number;
  variancePct: number | null;
  baseSym: string;
  isBaseInvoice: boolean;
}) {
  return (
    <div>
      <SectionLabel>What to expect</SectionLabel>
      <div
        className="rounded-lg px-3.5 py-3 border"
        style={{ backgroundColor: "#F8FAFF", borderColor: "#E0E7FF" }}
      >
        <ul className="m-0 pl-4 text-[12px] text-slate-800 leading-[1.7]" style={{ listStyle: "disc" }}>
          <li>
            Invoice currency:{" "}
            <strong>
              {vendorCurrency} {isBaseInvoice ? "(base)" : "(carried over from PO)"}
            </strong>
          </li>
          <li>
            Settlement currency: <strong>{settlementCurrency}</strong>
          </li>
          <li>
            Recording rate:{" "}
            {isBaseInvoice ? (
              <strong>No conversion needed — invoice is in base currency</strong>
            ) : (
              <>
                <strong>
                  Today's mid-market: 1 {vendorCurrency} = {baseSym}{" "}
                  {formatNumber(todayRate, BASE_CURRENCY)} {BASE_CURRENCY}
                </strong>
                {variancePct !== null && Math.abs(variancePct) >= 0.05 && (
                  <span
                    style={{
                      marginLeft: 6,
                      color: variancePct > 0 ? "#9a3412" : "#065f46",
                    }}
                  >
                    ({variancePct > 0 ? "+" : ""}
                    {variancePct.toFixed(2)}% vs PO rate of {baseSym}{" "}
                    {poLockedRate !== undefined ? formatNumber(poLockedRate, BASE_CURRENCY) : "—"})
                  </span>
                )}
              </>
            )}
          </li>
        </ul>
      </div>
    </div>
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
    <div
      className="fixed inset-0 z-[210] flex items-center justify-center bg-black/40 backdrop-blur-[1px]"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-xl w-[460px] max-w-[95vw] shadow-[0_20px_60px_rgba(0,0,0,0.18)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-5 pb-2 flex items-start gap-3">
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
              vendor currency to <strong>{toCurrency}</strong> means line-item amounts
              will be re-interpreted in the new currency for this invoice. This is rarely
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
        <div className="px-6 py-3.5 border-t border-slate-100 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-9 px-3.5 text-[13px] text-slate-600 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors"
            style={{ fontWeight: 500 }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="h-9 px-4 text-[13px] text-white bg-amber-600 hover:bg-amber-700 rounded-md transition-colors"
            style={{ fontWeight: 500 }}
          >
            Yes, change to {toCurrency}
          </button>
        </div>
      </div>
    </div>
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
