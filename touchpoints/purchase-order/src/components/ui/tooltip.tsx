import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

import { cn } from "@/lib/utils";

const TooltipProvider = TooltipPrimitive.Provider;

const Tooltip = TooltipPrimitive.Root;

const TooltipTrigger = TooltipPrimitive.Trigger;

// Glass-effect tooltip — mirrors the primary `app/components/ui/tooltip.tsx`
// recipe so both shadcn entry points render the same Partners-aligned
// look (`Partners/.../ui/tooltip.tsx:70-96`).
const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 6, children, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "bg-white/95 backdrop-blur-md text-slate-700 border border-border/80 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.12),0_4px_12px_-4px_rgba(0,0,0,0.05)] z-[300] max-w-[260px] rounded-xl px-3.5 py-2.5 text-[11px] leading-relaxed",
        "animate-dropdown-enter [transform-origin:var(--radix-tooltip-content-transform-origin)]",
        className,
      )}
      {...props}
    >
      {children}
      <TooltipPrimitive.Arrow
        width={11}
        height={5}
        className="fill-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.06)]"
      />
    </TooltipPrimitive.Content>
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
