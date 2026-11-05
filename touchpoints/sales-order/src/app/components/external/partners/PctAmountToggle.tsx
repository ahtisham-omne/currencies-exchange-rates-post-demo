import { Tooltip, TooltipTrigger, TooltipContent } from "../../ui/tooltip";

interface PctAmountToggleProps {
  isFixed: boolean;
  onChange: (fixed: boolean) => void;
  percentTooltip?: string;
  amountTooltip?: string;
  className?: string;
}

/**
 * Shared % / $ segmented toggle with info tooltips.
 * Preserves the exact existing design — only adds hover tooltips that
 * explain the two modes. Use wherever a value can be entered as a
 * percentage or a fixed dollar amount.
 */
export function PctAmountToggle({
  isFixed,
  onChange,
  percentTooltip = "Enter as a percentage of the base value.",
  amountTooltip = "Enter as a fixed dollar amount.",
  className = "",
}: PctAmountToggleProps) {
  return (
    <div className={`inline-flex items-center h-[22px] rounded-full bg-muted p-0.5 ${className}`}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => onChange(false)}
            className={`px-2 h-[18px] rounded-full text-[10px] transition-all ${!isFixed ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            style={{ fontWeight: 600 }}
          >
            %
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={6} className="max-w-[220px] text-[11px] leading-[1.5] z-[14300]">
          <p className="text-slate-500">{percentTooltip}</p>
        </TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => onChange(true)}
            className={`px-2 h-[18px] rounded-full text-[10px] transition-all ${isFixed ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            style={{ fontWeight: 600 }}
          >
            $
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={6} className="max-w-[220px] text-[11px] leading-[1.5] z-[14300]">
          <p className="text-slate-500">{amountTooltip}</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
