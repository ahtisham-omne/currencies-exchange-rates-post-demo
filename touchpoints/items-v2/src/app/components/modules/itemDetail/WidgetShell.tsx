// Partners-parity widget shell — literal port of `ContentCard` from
// VendorDetailsPage (cross-project ref). Drag handle is the entire header bar
// (cursor-grab); Info tooltip on the title; remove × fades in on hover.
// Size variants from Partners are out of scope (D1c) — fixed padding.
import React, { useState } from "react";
import { Info, Trash2 } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

interface WidgetShellProps {
  title: string;
  icon?: React.ElementType;
  tooltip?: string;
  action?: React.ReactNode;
  onRemove?: () => void;
  isOver?: boolean;
  isDragging?: boolean;
  children: React.ReactNode;
}

export function WidgetShell({
  title, icon: Icon, tooltip, action, onRemove, isOver, isDragging, children,
}: WidgetShellProps) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className={`rounded-xl border bg-white overflow-hidden h-full flex flex-col transition-[box-shadow,border-color] duration-300 ${
        isOver && !isDragging
          ? "border-primary/30 shadow-[0_0_0_2px_rgba(10,119,255,0.10)]"
          : "border-border shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06)]"
      }`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Header bar — drag handle */}
      <div className="px-4 py-2.5 border-b border-muted flex items-center justify-between shrink-0 cursor-grab active:cursor-grabbing select-none">
        <div className="flex items-center gap-2 pointer-events-none">
          {Icon && (
            <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center shrink-0">
              <Icon className="w-3.5 h-3.5 text-primary" />
            </div>
          )}
          <span className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>{title}</span>
          {tooltip && (
            <span className="pointer-events-auto">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex"
                    tabIndex={-1}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Info className="w-3 h-3 text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors" />
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="bottom"
                  sideOffset={6}
                  className="z-[300] max-w-[260px] rounded-xl bg-white/95 backdrop-blur-md text-slate-700 border border-border/80 px-3.5 py-2.5 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.12),0_4px_12px_-4px_rgba(0,0,0,0.05)]"
                >
                  <p className="text-[11px] leading-relaxed">{tooltip}</p>
                </TooltipContent>
              </Tooltip>
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 pointer-events-auto">
          {action && <span onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>{action}</span>}
          {onRemove && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              onMouseDown={(e) => e.stopPropagation()}
              className={`group/rm w-7 h-7 rounded-md flex items-center justify-center text-slate-400 transition-all duration-150 cursor-pointer hover:bg-red-100 hover:text-destructive ${
                hovered ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}
              title={`Remove ${title}`}
              aria-label={`Remove ${title} widget`}
            >
              <Trash2 className="w-3.5 h-3.5 transition-transform duration-150 group-hover/rm:scale-110" />
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 flex flex-col p-4">{children}</div>
    </div>
  );
}
