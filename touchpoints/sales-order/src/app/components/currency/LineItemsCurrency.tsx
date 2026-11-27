import * as React from "react";
import { ArrowLeftRight, Globe } from "lucide-react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/app/components/ui/hover-card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/app/components/ui/tooltip";
import { BASE_CURRENCY, isBaseCurrency } from "@/app/currency/currencies";
import { formatMoney, formatRate, formatRateDate, moneyPrefix } from "@/app/currency/money";
import { RATE_TYPE_LABEL, toBase, type RateType } from "@/app/currency/rates";
import { shortRateText } from "@/app/currency/itemPrices";
import { currencyChipLabel } from "./CurrencyChip";
import { useDocCurrency } from "./docCurrencyContext";
import { FX_ARROW_PADDING, FX_CARD_CLASS, FxArrow, FxLine, FxLines } from "./FxCard";

/* ── The line items card's currency (Mahreen, 27 Nov 2026, 4a and 4c) ──
 * The order's currency and rate, said once for the whole card rather than
 * on every line:
 *  - "Prices in USD" after the "Line Items" title (4c, proposed): the
 *    currency the order's prices are kept in, whichever one the page shows
 *    them in. The brand-tint chip of Purchase Orders' PricesInChip
 *    (VendorCurrencyTag, variant 1).
 *  - "Exchange rate: daily market rate · 1 USD = ₨278.5200", top right
 *    (4c, proposed): the order's rate type and rate.
 *  - The Total's convert icon (4a): hover for the total in base, the rate
 *    type, the rate, the rate date, and that it is an estimate.
 * Each reads the order's currency and rate from docCurrencyContext. None of
 * them shows on an order in the base currency (no rate there: fx is null). */

const INK = "#0F1729";
const MUTED = "#48566A";
const RATE_DOT: Record<RateType, string> = { mid: "#7C3AED", corporate: "#B45309" };

/** "1 USD = ₨278.5200 PKR", as the order's currency block writes a rate. */
const rateWithCode = (code: string, rate: number) => `1 ${code} = ${moneyPrefix(BASE_CURRENCY)}${formatRate(rate)} ${BASE_CURRENCY}`;

/** Is there a rate to say anything about? */
function useForeignFx() {
  const { currency, fx } = useDocCurrency();
  return fx && !isBaseCurrency(currency) ? { currency, fx } : null;
}

/** "🌐 Prices in USD" after the card's title. */
export function PricesInChip({ noun = "Order" }: { noun?: string }) {
  const doc = useForeignFx();
  if (!doc) return null;
  return (
    <Tooltip delayDuration={250}>
      <TooltipTrigger asChild>
        <span
          className="inline-flex items-center gap-1 px-1.5 py-0 rounded-full text-[10px] leading-[16px] border shrink-0 cursor-default bg-[#EDF4FF] text-[#0A77FF] border-[#0A77FF]/20"
          style={{ fontWeight: 500 }}
        >
          <Globe className="w-2.5 h-2.5 shrink-0" />
          Prices in {doc.currency}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">{currencyChipLabel(doc.currency, noun)}</TooltipContent>
    </Tooltip>
  );
}

/** "Exchange rate: daily market rate · 1 USD = ₨278.5200", top right of the card. */
export function LineItemsRateNote({ className = "" }: { className?: string }) {
  const doc = useForeignFx();
  if (!doc) return null;
  const { currency, fx } = doc;
  return (
    <span className={`text-[11.5px] text-slate-500 tabular-nums whitespace-nowrap ${className}`} title={`Rate date ${formatRateDate(fx.rateDate)}`}>
      Exchange rate: {RATE_TYPE_LABEL[fx.rateType].toLowerCase()} · {shortRateText(currency, fx.rate)}
    </span>
  );
}

/** The Total's convert icon and its hover: "$1,860.00 ≈ ₨518,047.20", rate
 *  type, rate, rate date, "Estimate. Nothing posts from a sales order." */
export function TotalFxHover({ total, noun = "a sales order" }: { total: number; noun?: string }) {
  const doc = useForeignFx();
  if (!doc || !total) return null;
  const { currency, fx } = doc;
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  return (
    <HoverCard openDelay={150} closeDelay={80}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          aria-label={`Total in ${BASE_CURRENCY}`}
          onClick={stop}
          onPointerDown={stop}
          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-400 hover:text-primary focus-visible:text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/30 cursor-pointer transition-colors"
        >
          <ArrowLeftRight className="h-3.5 w-3.5" />
        </button>
      </HoverCardTrigger>
      <HoverCardContent
        side="top"
        align="end"
        sideOffset={6}
        arrowPadding={FX_ARROW_PADDING}
        className={FX_CARD_CLASS}
        arrow={<FxArrow />}
        onClick={stop}
      >
        <p className="text-[12px] leading-[16px] tabular-nums whitespace-nowrap" style={{ color: INK, fontWeight: 600 }}>
          {formatMoney(total, currency)} ≈ {formatMoney(toBase(total, fx.rate), BASE_CURRENCY)}
        </p>
        <FxLines>
          <FxLine
            label="Rate type"
            value={
              <span className="inline-flex items-center gap-[6px]">
                <span className="w-[6px] h-[6px] rounded-full shrink-0" style={{ background: RATE_DOT[fx.rateType] }} />
                {RATE_TYPE_LABEL[fx.rateType]}
              </span>
            }
          />
          <FxLine label="Rate" value={rateWithCode(currency, fx.rate)} />
          <FxLine label="Rate date" value={formatRateDate(fx.rateDate)} />
        </FxLines>
        <p className="mt-[8px] pt-[8px] border-t border-[#EEF2F6] text-[11px] leading-[15px]" style={{ color: MUTED }}>
          Estimate. Nothing posts from {noun}.
        </p>
      </HoverCardContent>
    </HoverCard>
  );
}
