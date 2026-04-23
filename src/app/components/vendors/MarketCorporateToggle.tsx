import * as React from "react";
import { Check, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { useRateContext } from "../../context/RateContext";
import { cn } from "../ui/utils";
import type { RateType } from "../../data/currencyLibrary";

export const RATE_TYPE_COLORS: Record<RateType, { hex: string; text: string; bg: string; border: string; dot: string }> = {
  market: {
    hex: "#7c3aed",
    text: "text-[#7c3aed]",
    bg: "bg-[#7c3aed]/5",
    border: "border-[#7c3aed]/20",
    dot: "bg-[#7c3aed]",
  },
  corporate: {
    hex: "#d97706",
    text: "text-[#d97706]",
    bg: "bg-[#d97706]/5",
    border: "border-[#d97706]/20",
    dot: "bg-[#d97706]",
  },
};

const RATE_TYPE_LABEL: Record<RateType, string> = {
  market: "Market",
  corporate: "Corporate",
};

const RATE_TYPE_DESCRIPTION: Record<RateType, string> = {
  market: "Live mid-market rates, refreshed every 15 minutes. Use for up-to-the-minute analytics.",
  corporate: "Treasury-locked book rates for the current quarter. Matches what finance uses for accruals and reporting.",
};

interface MarketCorporateToggleProps {
  /**
   * - "pill": rounded neutral trigger, white bg, list-page toolbar style.
   * - "inline": compact rectangular, profile-page dashboard bar style.
   * - "badge": tinted pill matching the rate-type colours (for inline use inside
   *   the RateContextStrip where the badge itself is the trigger).
   */
  variant?: "pill" | "inline" | "badge";
  className?: string;
  /** Override the main label. Defaults to e.g. "Market" / "Corporate". */
  label?: string;
}

/**
 * Dropdown selector that switches the active FX snapshot between live
 * mid-market and the corporate book. Display-only — amounts re-render against
 * the selected table, but nothing in the data layer changes.
 */
export function MarketCorporateToggle({ variant = "pill", className, label }: MarketCorporateToggleProps) {
  const { rateType, setRateType } = useRateContext();
  const active = RATE_TYPE_COLORS[rateType];

  let triggerClass = "";
  if (variant === "pill") {
    triggerClass =
      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border bg-white text-[11px] whitespace-nowrap cursor-pointer transition-colors hover:bg-slate-50 shrink-0";
  } else if (variant === "inline") {
    triggerClass =
      "inline-flex items-center gap-1.5 h-7 px-2 rounded-lg border border-border bg-white text-[11px] whitespace-nowrap cursor-pointer transition-colors hover:bg-slate-50 shadow-sm shrink-0";
  } else {
    // "badge" — tinted trigger that reads as the live rate-type badge itself
    triggerClass = cn(
      "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10.5px] whitespace-nowrap cursor-pointer transition-colors hover:brightness-[0.98] shrink-0",
      active.bg,
      active.border,
      active.text,
    );
  }

  const renderTriggerLabel = () => {
    const finalLabel = label ?? `${RATE_TYPE_LABEL[rateType]} rates`;
    if (variant === "badge") {
      return <span style={{ fontWeight: 600 }}>{finalLabel}</span>;
    }
    return (
      <>
        <span className={active.text}>{RATE_TYPE_LABEL[rateType]}</span>
        <span className="text-slate-400" style={{ fontWeight: 500 }}>rates</span>
      </>
    );
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={cn(triggerClass, className)} style={{ fontWeight: 600 }}>
          <span className={cn("w-1.5 h-1.5 rounded-full", active.dot)} />
          {renderTriggerLabel()}
          <ChevronDown
            className={cn(
              "w-3 h-3",
              variant === "badge" ? active.text : "text-slate-400",
            )}
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6} className="w-[260px] p-1">
        {(Object.keys(RATE_TYPE_LABEL) as RateType[]).map((type) => {
          const colors = RATE_TYPE_COLORS[type];
          const selected = rateType === type;
          return (
            <DropdownMenuItem
              key={type}
              onClick={() => setRateType(type)}
              className="flex items-start gap-2.5 px-2.5 py-2 rounded-md cursor-pointer"
            >
              <span className={cn("mt-1 w-2 h-2 rounded-full shrink-0", colors.dot)} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={cn("text-[12.5px]", colors.text)} style={{ fontWeight: 600 }}>
                    {RATE_TYPE_LABEL[type]} rates
                  </span>
                  {selected && <Check className="w-3.5 h-3.5 text-primary ml-auto shrink-0" />}
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                  {RATE_TYPE_DESCRIPTION[type]}
                </p>
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
