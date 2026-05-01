import * as React from "react";
import { useMemo } from "react";
import {
  Lock,
  RefreshCw,
  ArrowRight,
  AlertTriangle,
  Check,
  X,
} from "lucide-react";
import { InfoTooltip } from "../ui/info-tooltip";
import {
  BASE_CURRENCY,
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
 * rate cards with a colored accent, and a tinted "What to expect" summary
 * at the bottom. Renders on top of the "Add Items to Invoice" picker
 * (which the runtime keeps mounted, blurred, behind this modal) so the
 * user retains spatial context while reviewing the FX preview.
 */
export function RatePreviewModal({ selectedPOs, onCancel, onContinue }: Props) {
  const referencePO = selectedPOs[0];
  const vendorCurrency = (referencePO?.currency || BASE_CURRENCY).toUpperCase();
  const settlementCurrency = BASE_CURRENCY;

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

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/30 backdrop-blur-[3px]"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-xl w-[520px] max-w-[95vw] max-h-[85vh] flex flex-col shadow-[0_20px_60px_rgba(0,0,0,0.18)]"
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
            This invoice will use today's Mid-market rate, in accordance with foreign
            currency accounting standards.{" "}
            <InfoTooltip side="bottom" iconClassName="w-3 h-3 inline-block align-[-1px]">
              Per IAS 21 (IFRS) and ASC 830 (US GAAP), foreign currency transactions
              must be recorded at the spot exchange rate on the transaction date.
            </InfoTooltip>{" "}
            The PO's locked rate is shown below for reference, along with the variance
            you can expect.
          </p>
          {referencePO && (
            <p className="text-[11.5px] text-slate-400 m-0 mt-1.5">
              From <span className="text-slate-700">{referencePO.poNumber}</span>
              {referencePO.poDate ? ` · ${formatLockedDate(referencePO.poDate)}` : ""}
            </p>
          )}
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
            The currency setup is carried over from the PO. You can adjust it for
            this invoice if needed.
          </li>
          <li>
            Vendor will receive in: <strong>{vendorCurrency}</strong>
          </li>
          <li>
            You will pay in: <strong>{settlementCurrency}</strong>
          </li>
          <li>
            Recording rate:{" "}
            {isBaseInvoice ? (
              <strong>No conversion needed — invoice is in base currency</strong>
            ) : (
              <>
                <strong>
                  Today's Mid-market — 1 {vendorCurrency} = {baseSym}{" "}
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
