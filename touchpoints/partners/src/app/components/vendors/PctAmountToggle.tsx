import { Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip";

interface PctAmountToggleProps {
  isFixed: boolean;
  onChange: (fixed: boolean) => void;
  percentTooltip?: string;
  amountTooltip?: string;
  /** The fixed side's label: the amount's currency symbol ("₨" for pricing rules). */
  amountLabel?: string;
  className?: string;
}

/**
 * Shared % / $ switch with info tooltips. Drawn frameless like Chart of
 * Accounts' period presets: the chosen side is a light-blue pill. Hover
 * tooltips explain the two modes. Use wherever a value can be entered as a
 * percentage or a fixed dollar amount.
 */
export function PctAmountToggle({
  isFixed,
  onChange,
  percentTooltip = "Enter as a percentage of the base value.",
  amountTooltip = "Enter as a fixed dollar amount.",
  amountLabel = "$",
  className = "",
}: PctAmountToggleProps) {
  return (
    <div className={`inline-flex items-center gap-0.5 rounded-lg border border-border bg-white p-0.5 ${className}`} role="radiogroup" aria-label="Value type">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            role="radio"
            aria-checked={!isFixed}
            onClick={() => onChange(false)}
            className={`px-2 py-0.5 rounded-md text-[11px] whitespace-nowrap transition-colors cursor-pointer ${!isFixed ? "bg-[#EDF4FF] text-[#0A77FF]" : "text-muted-foreground hover:bg-muted"}`}
            style={{ fontWeight: !isFixed ? 500 : 400 }}
          >
            %
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={6} className="max-w-[220px] text-[11px] leading-[1.5] z-[300]">
          <p className="text-slate-500">{percentTooltip}</p>
        </TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            role="radio"
            aria-checked={isFixed}
            onClick={() => onChange(true)}
            className={`px-2 py-0.5 rounded-md text-[11px] whitespace-nowrap transition-colors cursor-pointer ${isFixed ? "bg-[#EDF4FF] text-[#0A77FF]" : "text-muted-foreground hover:bg-muted"}`}
            style={{ fontWeight: isFixed ? 500 : 400 }}
          >
            {amountLabel}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={6} className="max-w-[220px] text-[11px] leading-[1.5] z-[300]">
          <p className="text-slate-500">{amountTooltip}</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
