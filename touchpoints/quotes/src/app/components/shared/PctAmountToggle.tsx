import { Tooltip, TooltipTrigger, TooltipContent } from '@/app/components/ui/tooltip';

interface PctAmountToggleProps {
  isFixed: boolean;
  onChange: (fixed: boolean) => void;
  percentTooltip?: string;
  amountTooltip?: string;
  className?: string;
}

/* % | $ as Chart of Accounts draws its period presets: a frameless row of
   options, the chosen one a light-blue pill. */
const OPTION = 'px-2 py-0.5 rounded-md text-[11px] whitespace-nowrap transition-colors cursor-pointer';
const ON = 'bg-[#EDF4FF] text-[#0A77FF]';
const OFF = 'text-muted-foreground hover:bg-muted';

export function PctAmountToggle({
  isFixed,
  onChange,
  percentTooltip = 'Enter as a percentage of the base value.',
  amountTooltip = 'Enter as a fixed dollar amount.',
  className = '',
}: PctAmountToggleProps) {
  return (
    <div className={`inline-flex items-center gap-0.5 rounded-lg border border-border bg-white p-0.5 ${className}`} role="radiogroup" aria-label="Amount type">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            role="radio"
            aria-checked={!isFixed}
            onClick={() => onChange(false)}
            className={`${OPTION} ${!isFixed ? ON : OFF}`}
            style={{ fontWeight: !isFixed ? 500 : 400 }}
          >
            %
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={6} className="max-w-[220px] text-[11px] leading-[1.5] z-[12200]">
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
            className={`${OPTION} ${isFixed ? ON : OFF}`}
            style={{ fontWeight: isFixed ? 500 : 400 }}
          >
            $
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={6} className="max-w-[220px] text-[11px] leading-[1.5] z-[12200]">
          <p className="text-slate-500">{amountTooltip}</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
