"use client";

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

import { cn } from "./utils";

// 500ms baseline so tooltips only fire on intentional hovers — passing
// the cursor over a card no longer triggers a popover cascade. Matches
// Partner Management's default.
function TooltipProvider({
  delayDuration = 500,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...props}
    />
  );
}

function Tooltip({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return (
    <TooltipProvider>
      <TooltipPrimitive.Root data-slot="tooltip" {...props} />
    </TooltipProvider>
  );
}

function TooltipTrigger({
  children,
  asChild,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  if (asChild && React.isValidElement(children)) {
    return (
      <TooltipPrimitive.Trigger data-slot="tooltip-trigger" asChild {...props}>
        {children}
      </TooltipPrimitive.Trigger>
    );
  }

  return (
    <TooltipPrimitive.Trigger data-slot="tooltip-trigger" asChild={asChild} {...props}>
      {children}
    </TooltipPrimitive.Trigger>
  );
}

function TooltipContent({
  className,
  sideOffset = 6,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          // Partner Management parity: white/blur surface with arrow,
          // generous padding, 11px copy. Used everywhere; the sidebar
          // rail picks it up unchanged.
          "bg-white/95 backdrop-blur-md text-slate-700 border border-border/80 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.12),0_4px_12px_-4px_rgba(0,0,0,0.05)] animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-[300] max-w-[260px] origin-(--radix-tooltip-content-transform-origin) rounded-xl px-3.5 py-2.5 text-[11px] leading-relaxed",
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
  );
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
