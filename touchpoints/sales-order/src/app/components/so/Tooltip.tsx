import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

/**
 * Portal-rendered tooltip — escapes ancestor `overflow:auto`/`overflow:hidden`
 * containers so column-header hovers no longer get clipped (and don't add
 * scrollbars to the table wrapper). Visual style mirrors Partner v7's
 * tooltip: translucent white card, slate copy, soft layered shadow.
 *
 * Public API (`Tooltip`, `ThTooltip`) is unchanged so callers don't need to
 * be touched — the rewrite is implementation-only.
 */

interface TooltipProps {
  text: string;
  children: React.ReactNode;
  position?: "top" | "bottom" | "left" | "right";
  delay?: number;
}

export function Tooltip({ text, children, position = "top", delay = 300 }: TooltipProps) {
  if (!text) return <>{children}</>;
  return (
    <TooltipPrimitive.Provider delayDuration={delay} skipDelayDuration={100}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>
          <span className="inline-flex">{children}</span>
        </TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={position}
            sideOffset={6}
            collisionPadding={8}
            className="bg-white/95 backdrop-blur-md text-slate-700 border border-border/80 rounded-xl px-3.5 py-2.5 text-[11px] leading-relaxed max-w-[260px] z-[300] animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
            style={{
              boxShadow:
                "0 8px 32px -8px rgba(0,0,0,0.12), 0 4px 12px -4px rgba(0,0,0,0.05)",
            }}
          >
            {text}
            <TooltipPrimitive.Arrow
              width={11}
              height={5}
              className="fill-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.06)]"
            />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}

/**
 * Wrap a table header label with a tooltip. The dashed underline cues the
 * user that hovering reveals more context.
 */
export function ThTooltip({ label, tooltip }: { label: string; tooltip: string }) {
  return (
    <Tooltip text={tooltip} position="bottom" delay={400}>
      <span className="cursor-default border-b border-dashed border-foreground/15">
        {label}
      </span>
    </Tooltip>
  );
}
