import * as React from "react";
import { ArrowLeftRight } from "lucide-react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "../ui/hover-card";
import { FONT } from "../designTokens";
import { BASE_CURRENCY } from "@/app/currency/currencies";
import { formatMoney } from "@/app/currency/money";
import { localTodayIso } from "@/app/currency/poFx";
import { RATE_PROVIDER, RATE_TYPE_LABEL, corporateRateOn, midRateOn, type RateType } from "@/app/currency/rates";
import { blockRateText } from "./CurrencyBlock";

/* ── Compare rates (Nophil review item 3, 25 Nov 2026) ────────────────
 * An icon beside the rate choice (RateTypeToggle). Hover or focus shows the
 * mid-market and corporate rates for the document's currency to the base
 * currency on its rate date, side by side, and how far apart they are. The
 * same card as Sales Orders'. Read-only: it changes nothing. */

const RATE_HEX: Record<RateType, string> = { mid: "#7C3AED", corporate: "#B45309" };

/** "25 Nov 2026" */
const dayMonthYear = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

function RateRow({
  type,
  rateText,
  source,
  selected,
}: {
  type: RateType;
  rateText: string;
  source: string;
  selected: boolean;
}) {
  return (
    <div className={`rounded-md px-2 py-1.5 ${selected ? "bg-slate-50" : ""}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-1.5 shrink-0">
          <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: RATE_HEX[type] }} />
          <span className="text-slate-700" style={{ fontWeight: 500 }}>{RATE_TYPE_LABEL[type]}</span>
        </span>
        <span className="text-right text-slate-700 tabular-nums whitespace-nowrap" style={{ fontWeight: 500 }}>{rateText}</span>
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
  /** The document's currency (the vendor's, unless changed on the PO). */
  currency: string;
  /** The document's rate date. */
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
      <HoverCardContent
        side="bottom"
        align="end"
        sideOffset={6}
        className="w-[300px] p-2 bg-white rounded-lg border border-[#EEF2F6] text-[12px] shadow-[0_20px_25px_-5px_rgba(0,0,0,0.08),0_8px_10px_-6px_rgba(0,0,0,0.04)] z-[300]"
        style={{ fontFamily: FONT }}
      >
        <p className="px-2 pt-0.5 pb-1.5 text-[12px] text-slate-700" style={{ fontWeight: 600 }}>
          Rates for {code} to {BASE_CURRENCY} {when}
        </p>
        <RateRow
          type="mid"
          rateText={mid != null ? blockRateText(code, mid) : "No rate"}
          source={RATE_PROVIDER}
          selected={selected === "mid"}
        />
        <RateRow
          type="corporate"
          rateText={corp ? blockRateText(code, corp.rate) : "Not set"}
          source={corp ? `Set by finance, effective ${dayMonthYear(corp.effectiveDate)}` : "No corporate rate set"}
          selected={selected === "corporate"}
        />
        {footer && <p className="mt-1 px-2 pt-1.5 pb-0.5 border-t border-slate-100 text-[11px] text-slate-500">{footer}</p>}
      </HoverCardContent>
    </HoverCard>
  );
}
