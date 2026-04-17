import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { Info } from "lucide-react";
import { cn } from "./utils";

interface InfoTooltipProps {
  children: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  sideOffset?: number;
  className?: string;
  iconClassName?: string;
}

/**
 * A standardised dark info tooltip with a 400ms hover delay.
 * Use this wherever an ⓘ icon needs to explain a field.
 */
export function InfoTooltip({
  children,
  side = "top",
  sideOffset = 6,
  className,
  iconClassName,
}: InfoTooltipProps) {
  return (
    <TooltipPrimitive.Provider delayDuration={200} skipDelayDuration={100}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>
          <button type="button" className="inline-flex" tabIndex={-1} onClick={(e) => e.stopPropagation()}>
            <Info
              className={cn(
                "w-3 h-3 text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors",
                iconClassName,
              )}
            />
          </button>
        </TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={side}
            sideOffset={sideOffset}
            className={cn(
              "z-[300] max-w-[260px] rounded-xl bg-white/95 backdrop-blur-md text-[#334155] border border-[#E2E8F0]/80 px-3.5 py-2.5 text-[11px] leading-relaxed shadow-[0_8px_32px_-8px_rgba(0,0,0,0.12),0_4px_12px_-4px_rgba(0,0,0,0.05)] animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
              className,
            )}
          >
            {children}
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
