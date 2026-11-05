"use client";

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

import { cn } from "./utils";

// 500ms baseline so tooltips only fire on intentional hovers — passing the
// cursor over a card no longer triggers a popover cascade. Mirrors the
// Partners app convention (`Partners/.../ui/tooltip.tsx:12`).
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
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

// Glass-effect tooltip — ported verbatim from Partners' app
// (`Partners/.../ui/tooltip.tsx:70-96`). Soft 95%-opaque white surface
// with backdrop blur, slate-700 text, and a hairline border so the
// tooltip reads as elevated paper instead of the default shadcn blue
// solid. Used as the default across the PO app so Pay To / Ship To /
// Funded By address tooltips and every other hover popover match the
// Partners design system 1:1.
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
          "bg-white/95 backdrop-blur-md text-slate-700 border border-border/80 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.12),0_4px_12px_-4px_rgba(0,0,0,0.05)] animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-[300] max-w-[260px] origin-[var(--radix-tooltip-content-transform-origin)] rounded-xl px-3.5 py-2.5 text-[11px] leading-relaxed",
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
