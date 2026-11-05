import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export interface OnTimeCellProps {
  onTimePercent: number;
  onTimeCount: number;
  onTimeTotal: number;
}

function tierColor(p: number): string {
  if (p >= 95) return "text-emerald-700";
  if (p >= 80) return "text-amber-700";
  return "text-rose-800";
}

/**
 * Ship-on-Time cell: tinted percentage + supporting `(N/M)` + tooltip with the formula.
 * Color tiers: ≥95 emerald, ≥80 amber, <80 rose.
 */
export function OnTimeCell({ onTimePercent, onTimeCount, onTimeTotal }: OnTimeCellProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-baseline gap-1.5 cursor-default">
          <span className={`text-sm font-semibold ${tierColor(onTimePercent)}`}>
            {onTimePercent}%
          </span>
          <span className="text-xs text-muted-foreground">
            ({onTimeCount}/{onTimeTotal})
          </span>
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[260px]">
        <p className="text-xs">
          On-time deliveries: {onTimeCount} of {onTimeTotal} orders delivered on or
          before due date ({onTimePercent}%).
        </p>
      </TooltipContent>
    </Tooltip>
  );
}