import * as React from "react";
import { ArrowLeftRight } from "lucide-react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/app/components/ui/hover-card";
import { BASE_CURRENCY } from "@/app/currency/currencies";
import { formatMoney, formatRate, moneyPrefix } from "@/app/currency/money";
import { localTodayIso } from "@/app/currency/soFx";
import { RATE_PROVIDER, RATE_TYPE_LABEL, corporateRateOn, midRateOn, type RateType } from "@/app/currency/rates";

/* ── Compare rates (Nophil review item 3, 25 Nov 2026) ────────────────
 * An icon beside the rate choice (RateTypeToggle). Hover or focus shows the
 * mid-market and corporate rates for the order's currency to the base
 * currency on its rate date, side by side, and how far apart they are. The
 * same card as Purchase Orders' (components/currency/CompareRatesHover.tsx
 * there). Read-only: it changes nothing. */

const FONT = "Inter, system-ui, sans-serif";

const RATE_HEX: Record<RateType, string> = { mid: "#7C3AED", corporate: "#B45309" };

/** "1 USD = ₨278.5200 PKR", as the order's currency block writes a rate. */
const rateText = (code: string, rate: number) => `1 ${code} = ${moneyPrefix(BASE_CURRENCY)}${formatRate(rate)} ${BASE_CURRENCY}`;

/** "25 Nov 2026" */
const dayMonthYear = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

function RateRow({ type, text, source, selected }: { type: RateType; text: string; source: string; selected: boolean }) {
  return (
    <div className={`rounded-md px-2 py-1.5 ${selected ? "bg-slate-50" : ""}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-1.5 shrink-0">
          <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: RATE_HEX[type] }} />
          <span className="text-slate-700" style={{ fontWeight: 500 }}>{RATE_TYPE_LABEL[type]}</span>
        </span>
        <span className="text-right text-slate-700 tabular-nums whitespace-nowrap" style={{ fontWeight: 500 }}>{text}</span>
      </div>
      <div className="mt-0.5 pl-3 flex items-baseline justify-between gap-3 text-[11px] leading-4">
        <span className="text-slate-500">{source}</span>
        {selected && <span className="shrink-0 text-slate-400">Selected</span>}
      </div>
    </div>
  );
}

export function CompareRatesHover({
  currency,
  date,
  selected,
}: {
  /** The order's currency (the customer's, unless changed on the SO). */
  currency: string;
  /** The order's rate date. */
  date: string;
  /** The rate type chosen now. */
  selected: RateType;
}) {
  const code = currency.toUpperCase();
  const day = date.slice(0, 10);
  const mid = midRateOn(code, day);
  const corp = corporateRateOn(code, day);
  const when = day === localTodayIso() ? "today" : `on ${dayMonthYear(day)}`;

  let footer: string | null = null;
  if (mid != null && corp) {
    const diff = corp.rate - mid;
    const pct = mid > 0 ? (Math.abs(diff) / mid) * 100 : 0;
    footer =
      Math.abs(diff) < 0.00005
        ? "Corporate is the same as mid-market."
        : `Corporate is ${formatMoney(Math.abs(diff), BASE_CURRENCY)} (${pct.toFixed(2)}%) ${diff > 0 ? "above" : "below"} mid-market.`;
  }

  return (
    <HoverCard openDelay={150} closeDelay={80}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          aria-label="Compare rates"
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-400 hover:text-primary focus-visible:text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/30 cursor-pointer transition-colors"
        >
          <ArrowLeftRight className="h-3.5 w-3.5" />
        </button>
      </HoverCardTrigger>
      {/* The app's HoverCard portals at z-[1000], above the dialog. */}
      <HoverCardContent
        side="bottom"
        align="end"
        sideOffset={6}
        className="w-[300px] p-2 bg-white rounded-lg border border-[#EEF2F6] text-[12px] shadow-[0_20px_25px_-5px_rgba(0,0,0,0.08),0_8px_10px_-6px_rgba(0,0,0,0.04)]"
        style={{ fontFamily: FONT }}
      >
        <p className="px-2 pt-0.5 pb-1.5 text-[12px] text-slate-700" style={{ fontWeight: 600 }}>
          Rates for {code} to {BASE_CURRENCY} {when}
        </p>
        <RateRow type="mid" text={mid != null ? rateText(code, mid) : "No rate"} source={RATE_PROVIDER} selected={selected === "mid"} />
        <RateRow
          type="corporate"
          text={corp ? rateText(code, corp.rate) : "Not set"}
          source={corp ? `Set by finance, effective ${dayMonthYear(corp.effectiveDate)}` : "No corporate rate set"}
          selected={selected === "corporate"}
        />
        {footer && <p className="mt-1 px-2 pt-1.5 pb-0.5 border-t border-slate-100 text-[11px] text-slate-500">{footer}</p>}
      </HoverCardContent>
    </HoverCard>
  );
}
