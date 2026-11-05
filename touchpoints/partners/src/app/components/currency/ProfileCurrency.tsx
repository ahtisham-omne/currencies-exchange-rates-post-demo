import * as React from "react";
import { BASE_CURRENCY, isBaseCurrency } from "@/app/currency/currencies";
import { formatMoney } from "@/app/currency/money";
import { toBaseNow } from "@/app/currency/partnerCurrency";
import { partnerAmount, shortAxisFormatter, type CurrencyStream, type CurrencyView } from "@/app/currency/partnerAmounts";
import { InfoTooltip } from "@/app/components/ui/info-tooltip";
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

/** The Base / Partner currency switch. Hidden for a partner in the base currency. */
export function CurrencyViewToggle({
  view,
  onChange,
  partnerCurrency,
  size = "md",
}: {
  view: CurrencyView;
  onChange: (view: CurrencyView) => void;
  partnerCurrency: string;
  size?: "sm" | "md";
}) {
  if (isBaseCurrency(partnerCurrency)) return null;
  const options: { value: CurrencyView; label: string; tip: string }[] = [
    { value: "base", label: "Base Currency", tip: `Shows amounts in the company's base currency (${BASE_CURRENCY}), converted at today's mid-market rate.` },
    { value: "partner", label: "Partner Currency", tip: `Shows amounts in this partner's currency (${partnerCurrency.toUpperCase()}).` },
  ];
  return (
    <div className={`inline-flex items-center gap-0.5 rounded-lg border border-border p-0.5 bg-white shadow-sm shrink-0 ${size === "sm" ? "h-7" : "h-8"}`}>
      {/* role="button" spans: each holds an ⓘ button, and buttons can't nest. */}
      {options.map((o) => (
        <span
          key={o.value}
          role="button"
          tabIndex={0}
          onClick={() => onChange(o.value)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onChange(o.value); } }}
          aria-pressed={view === o.value}
          className={`inline-flex items-center gap-1.5 rounded-md text-[11px] whitespace-nowrap cursor-pointer transition-colors ${size === "sm" ? "h-6 px-2" : "h-7 px-2.5"} ${
            view === o.value ? "bg-accent text-primary" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          }`}
          style={{ fontWeight: view === o.value ? 600 : 500 }}
        >
          {o.label}
          <InfoTooltip side="top" iconClassName="w-3 h-3">{o.tip}</InfoTooltip>
        </span>
      ))}
    </div>
  );
}
