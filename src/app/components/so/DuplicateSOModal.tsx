/**
 * DuplicateSOModal — replaces the prior basic ConfirmationModal duplicate flow.
 * Mirrors the Quotes module's DuplicateQuoteModal: customer choice, rate option,
 * currency-pair option, and a "what will be different" summary so the user
 * understands what's carrying over and what's being reset.
 */
import { useMemo, useState } from "react";
import { X, Copy, Lock, TrendingUp, ArrowRight, Info } from "lucide-react";
import {
  BASE_CURRENCY,
  convertBetween,
  formatRate,
  getLibraryCurrency,
  rateTypeLabel,
} from "@/app/data/currencyLibrary";
import { useRateContext } from "@/app/context/RateContext";
import { RATE_TYPE_COLORS } from "../currency/MarketCorporateToggle";
import { CurrencyFlag } from "../currency/CurrencyFlag";
import type { SalesOrder } from "./types";

export type DuplicateRateOption = "locked" | "today";

interface Props {
  so: SalesOrder;
  onClose: () => void;
  onConfirm: (opts: {
    customerMode: "same" | "different";
    rateOption: DuplicateRateOption;
    currencyOverride?: string;
  }) => void;
  /** Callback to open the Currency Configurator for the new order. */
  onChangeCurrencyPair?: () => void;
}

export function DuplicateSOModal({ so, onClose, onConfirm, onChangeCurrencyPair }: Props) {
  const { rateType } = useRateContext();
  const [customerMode, setCustomerMode] = useState<"same" | "different">("same");
  const customerCurrency = (so.currency || BASE_CURRENCY).toUpperCase();
  const showFx = customerCurrency !== BASE_CURRENCY;
  const todayRate = showFx ? convertBetween(1, customerCurrency, BASE_CURRENCY) : 0;
  const lockedRate = so.lockedRate ?? (showFx ? +(todayRate * 0.99).toFixed(4) : 0);
  const drift = useMemo(() => {
    if (!showFx || !lockedRate) return 0;
    return +(((todayRate - lockedRate) / lockedRate) * 100).toFixed(1);
  }, [todayRate, lockedRate, showFx]);

  const initialRateOption: DuplicateRateOption = so.lockedRate ? "locked" : "today";
  const [rateOption, setRateOption] = useState<DuplicateRateOption>(initialRateOption);

  const cur = getLibraryCurrency(customerCurrency);
  const baseCur = getLibraryCurrency(BASE_CURRENCY)!;
  const baseSym = baseCur.symbol ?? BASE_CURRENCY;
  const colors = RATE_TYPE_COLORS[rateType];

  const handleConfirm = () => {
    onConfirm({ customerMode, rateOption });
  };

  return (
    <div className="fixed inset-0 z-[10002] flex items-center justify-center">
      <div className="absolute inset-0" style={{ backgroundColor: "rgba(0,0,0,0.35)" }} onClick={onClose} />
      <div
        className="relative bg-white rounded-xl flex flex-col"
        style={{ width: 560, maxHeight: "85vh", boxShadow: "0 16px 48px rgba(0,0,0,0.14)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#EDF4FF" }}>
              <Copy className="w-4 h-4" style={{ color: "#0A77FF" }} />
            </div>
            <div>
              <div className="text-[14px]" style={{ fontWeight: 600 }}>Duplicate Sales Order</div>
              <div className="text-[11.5px] text-slate-500">From {so.soNumber}</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-md hover:bg-slate-100 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-5 py-4 flex flex-col gap-5">
          {/* Customer choice */}
          <Section title="WHICH CUSTOMER WILL THIS ORDER BE FOR?">
            <div className="grid grid-cols-2 gap-2">
              <ChoiceCard
                active={customerMode === "same"}
                onClick={() => setCustomerMode("same")}
                title="Same customer"
                subtitle={so.customer}
              />
              <ChoiceCard
                active={customerMode === "different"}
                onClick={() => setCustomerMode("different")}
                title="Different customer"
                subtitle="Pick during creation"
              />
            </div>
          </Section>

          {/* Rate option (only if FX is in play) */}
          {showFx && (
            <Section title="WHICH EXCHANGE RATE SHOULD BE USED FOR THE NEW ORDER?">
              <div className="flex flex-col gap-2">
                <RateOptionRow
                  active={rateOption === "locked"}
                  onClick={() => setRateOption("locked")}
                  icon={<Lock className="w-3.5 h-3.5" style={{ color: "#047857" }} />}
                  title="Use the locked rate from the original order"
                  rate={`1 ${customerCurrency} = ${baseSym} ${formatRate(lockedRate)} ${BASE_CURRENCY}`}
                  meta={so.lockedAt ? `Locked on ${formatLockedDate(so.lockedAt)}` : "Captured at order send-time"}
                />
                <RateOptionRow
                  active={rateOption === "today"}
                  onClick={() => setRateOption("today")}
                  icon={<TrendingUp className="w-3.5 h-3.5" style={{ color: colors.hex }} />}
                  title={`Use today's ${rateTypeLabel(rateType)}`}
                  rate={`1 ${customerCurrency} = ${baseSym} ${formatRate(todayRate)} ${BASE_CURRENCY}`}
                  meta={
                    drift !== 0
                      ? `${drift >= 0 ? "+" : ""}${drift}% vs locked rate`
                      : "No movement vs locked rate"
                  }
                  metaColor={drift >= 0 ? "#059669" : "#DC2626"}
                />
              </div>
            </Section>
          )}

          {/* Currency-pair section */}
          {showFx && (
            <Section title="NEED A DIFFERENT CURRENCY PAIR?">
              <p className="text-[11.5px] text-slate-500 leading-relaxed mb-2">
                By default the new order keeps the same {customerCurrency} → {BASE_CURRENCY} pair. Change it via the Currency Configurator.
              </p>
              <button
                type="button"
                onClick={onChangeCurrencyPair}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-slate-200 bg-white text-[12px] cursor-pointer hover:bg-slate-50 transition-colors"
                style={{ fontWeight: 500 }}
              >
                {cur && <CurrencyFlag currency={cur} size={14} />}
                Change currency pair
              </button>
            </Section>
          )}

          {/* Summary */}
          <Section title="WHAT WILL BE DIFFERENT">
            <ul className="flex flex-col gap-1.5">
              <SummaryRow label="Customer" value={customerMode === "same" ? so.customer : "To be selected"} />
              {showFx && (
                <>
                  <SummaryRow label="Currency pair" value={`${customerCurrency} → ${BASE_CURRENCY}`} />
                  <SummaryRow
                    label="Exchange rate"
                    value={
                      rateOption === "locked"
                        ? `Locked (${baseSym} ${formatRate(lockedRate)})`
                        : `Today's ${rateTypeLabel(rateType)} (${baseSym} ${formatRate(todayRate)})`
                    }
                  />
                </>
              )}
              <SummaryRow label="Fulfillment progress" value="Reset to zero" />
              <SummaryRow label="Status" value="New Draft" />
            </ul>
          </Section>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-100">
          <button
            onClick={onClose}
            className="h-9 px-4 text-[13px] rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 cursor-pointer transition-colors"
            style={{ fontWeight: 500 }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="h-9 px-4 text-[13px] rounded-md bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer transition-colors inline-flex items-center gap-1.5"
            style={{ fontWeight: 600 }}
          >
            <Copy className="w-3.5 h-3.5" /> Duplicate
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="text-[10px] text-slate-400" style={{ fontWeight: 600, letterSpacing: "0.06em" }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function ChoiceCard({
  active,
  onClick,
  title,
  subtitle,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  subtitle: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left p-3 rounded-lg border transition-colors cursor-pointer ${
        active ? "border-primary/50 bg-primary/[0.04]" : "border-slate-200 bg-white hover:bg-slate-50"
      }`}
    >
      <div className="text-[12px] text-slate-800" style={{ fontWeight: 600 }}>{title}</div>
      <div className="text-[11px] text-slate-500 mt-0.5 truncate">{subtitle}</div>
    </button>
  );
}

function RateOptionRow({
  active,
  onClick,
  icon,
  title,
  rate,
  meta,
  metaColor,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  rate: string;
  meta: string;
  metaColor?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left p-3 rounded-lg border transition-colors cursor-pointer flex items-start gap-3 ${
        active ? "border-primary/50 bg-primary/[0.04]" : "border-slate-200 bg-white hover:bg-slate-50"
      }`}
    >
      <span
        className={`mt-0.5 inline-block w-3.5 h-3.5 rounded-full border-2 shrink-0 ${
          active ? "border-primary" : "border-slate-300"
        }`}
        style={active ? { boxShadow: "inset 0 0 0 2px white", backgroundColor: "var(--primary)" } : {}}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {icon}
          <span className="text-[12.5px] text-slate-800" style={{ fontWeight: 600 }}>{title}</span>
        </div>
        <div className="text-[11.5px] text-slate-700 mt-1 tabular-nums">{rate}</div>
        <div className="text-[11px] mt-0.5 tabular-nums" style={{ color: metaColor ?? "#6B7280" }}>
          {meta}
        </div>
      </div>
    </button>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex items-center justify-between text-[12px]">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-800" style={{ fontWeight: 500 }}>{value}</span>
    </li>
  );
}

function formatLockedDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
  } catch {
    return iso;
  }
}
