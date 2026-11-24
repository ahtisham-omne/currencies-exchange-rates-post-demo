import * as React from "react";
import { BASE_CURRENCY, isBaseCurrency } from "@/app/currency/currencies";
import { formatMoney } from "@/app/currency/money";
import { toBaseNow } from "@/app/currency/partnerCurrency";
import { partnerAmount, shortAxisFormatter, type CurrencyStream, type CurrencyView } from "@/app/currency/partnerAmounts";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/app/components/ui/tooltip";
import { CurrencyAmount } from "./CurrencyAmount";

/* ── A partner profile's amounts ──────────────────────────────────────
 * A partner's figures are kept in its own currency. Its profile shows them
 * in that currency or in the base currency (the Base / Partner switch on
 * the dashboard); every widget reads the choice from here. */

export interface ProfileCurrencyValue {
  view: CurrencyView;
  partnerCurrency: string;
  /** A multi-currency partner's transactions per currency (Total Spent's hover). */
  streams?: CurrencyStream[];
}

const ProfileCurrencyContext = React.createContext<ProfileCurrencyValue>({ view: "base", partnerCurrency: BASE_CURRENCY });

export function ProfileCurrencyProvider({ value, children }: { value: ProfileCurrencyValue; children: React.ReactNode }) {
  return <ProfileCurrencyContext.Provider value={value}>{children}</ProfileCurrencyContext.Provider>;
}

/** Formatters for an amount in the partner's currency, in a profile's view. */
export function profileFormatters({ view, partnerCurrency, streams }: ProfileCurrencyValue) {
  const displayCode = view === "base" || isBaseCurrency(partnerCurrency) ? BASE_CURRENCY : partnerCurrency;
  const toDisplay = (v: number) => (displayCode === partnerCurrency ? v : toBaseNow(v, partnerCurrency));
  const axis = shortAxisFormatter(displayCode);
  return {
    view,
    partnerCurrency,
    displayCode,
    /** The amount with its hover (base equivalent or partner amount, and the rate).
     *  rolledUp: a multi-currency partner's total, whose hover lists each currency. */
    money: (v: number, opts?: { rolledUp?: boolean }) => (
      <CurrencyAmount {...partnerAmount(v, partnerCurrency, view, opts?.rolledUp ? streams : undefined)} />
    ),
    /** As text (chart tooltips, labels): "$12,400.00", "₨3,453,648.00". */
    moneyText: (v: number) => formatMoney(toDisplay(v), displayCode),
    /** Chart axis ticks: "$35K", "₨1.2M". */
    axis: (v: number) => axis(toDisplay(v)),
  };
}

/** profileFormatters for the profile this component is in. */
export function useProfileMoney() {
  const value = React.useContext(ProfileCurrencyContext);
  return React.useMemo(() => profileFormatters(value), [value]);
}

/** The Base / Partner currency switch, in Chart of Accounts' pattern (the
 *  period presets on its dashboard widgets, DetailInsights PeriodSelector):
 *  plain 11px options, the chosen one on a light blue pill, no frame. What
 *  each option shows rides its hover. Hidden for a partner in the base currency. */
export function CurrencyViewToggle({
  view,
  onChange,
  partnerCurrency,
  size: _size = "md",
}: {
  view: CurrencyView;
  onChange: (view: CurrencyView) => void;
  partnerCurrency: string;
  size?: "sm" | "md";
}) {
  if (isBaseCurrency(partnerCurrency)) return null;
  const options: { value: CurrencyView; label: string; tip: string }[] = [
    { value: "base", label: "Base Currency", tip: "Show amounts in your base currency." },
    { value: "partner", label: "Partner Currency", tip: "Show amounts in the currency set for this partner." },
  ];
  return (
    <div className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-white p-0.5 shrink-0" role="radiogroup" aria-label="Show amounts in">
      {options.map((o) => {
        const active = view === o.value;
        return (
          <Tooltip key={o.value} delayDuration={300}>
            <TooltipTrigger asChild>
              <button
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onChange(o.value)}
                className={`px-2 py-0.5 rounded-md text-[11px] whitespace-nowrap transition-colors cursor-pointer ${
                  active ? "bg-[#EDF4FF] text-[#0A77FF]" : "text-muted-foreground hover:bg-muted"
                }`}
                style={{ fontWeight: active ? 500 : 400 }}
              >
                {o.label}
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[240px] text-[11px] leading-snug">{o.tip}</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
