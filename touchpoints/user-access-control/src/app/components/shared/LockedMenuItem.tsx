import type { ReactNode } from "react";
import { DropdownMenuItem } from "../ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

/**
 * A menu item that is visible but can't be used, with the reason on hover.
 *
 * The wrapper div is a real box on purpose: a disabled Radix item swallows
 * pointer events, so the tooltip needs something else to hover. (ERP-5150
 * AC-9 shipped inert once because the wrapper was `display: contents`.)
 */
export function LockedMenuItem({
  reason,
  className = "gap-2",
  side = "left",
  children,
}: {
  reason: string;
  className?: string;
  side?: "left" | "right" | "top" | "bottom";
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div>
          <DropdownMenuItem
            disabled
            className={`${className} opacity-50 cursor-not-allowed`}
            onSelect={(e) => e.preventDefault()}
          >
            {children}
          </DropdownMenuItem>
        </div>
      </TooltipTrigger>
      <TooltipContent side={side} className="max-w-[280px] text-xs">
        {reason}
      </TooltipContent>
    </Tooltip>
  );
}
