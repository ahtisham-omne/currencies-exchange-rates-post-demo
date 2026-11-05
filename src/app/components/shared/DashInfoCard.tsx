import React, { useEffect, useRef, useState } from "react";
import { ChevronDown, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

export function DashInfoCard({
  title,
  icon: Icon,
  count,
  tooltip: cardTooltip,
  children,
  defaultOpen = true,
  trailing,
}: {
  title: string;
  icon?: React.ElementType;
  count?: number;
  tooltip?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  trailing?: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState<number | undefined>(undefined);

  /* Track content height with a `ResizeObserver` so the card grows when
     nested controls expand (e.g. an `InnerAccordion` opens, a long
     `SecondaryContactsToggle` reveals its list, a payment-method
     reference-note appears). Previously the height was measured once
     in a `useEffect([children])` — because React reuses the children
     reference across renders, the observer-less version never picked
     up subtree size changes and the outer card clipped the new
     content with `overflow: hidden` + a stale `maxHeight`. */
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const measure = () => setContentHeight(el.scrollHeight);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="rounded-xl border border-border bg-white overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <button
        type="button"
        className="w-full px-3.5 py-2.5 flex items-center gap-2 cursor-pointer hover:bg-[#FAFBFC] transition-colors"
        style={{ borderBottom: isOpen ? "1px solid #F1F5F9" : "none" }}
        onClick={() => setIsOpen((v) => !v)}
      >
        {Icon && (
          <div className="w-6 h-6 rounded-md bg-accent flex items-center justify-center shrink-0">
            <Icon className="w-3 h-3 text-primary" />
          </div>
        )}
        <span className="text-[12px] text-slate-700 text-left" style={{ fontWeight: 600 }}>
          {title}
        </span>
        {cardTooltip && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex shrink-0" onClick={(e) => e.stopPropagation()}>
                <Info className="w-3 h-3 text-slate-300 hover:text-slate-400 transition-colors cursor-help" />
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6} className="max-w-[260px] z-[300]">
              {cardTooltip}
            </TooltipContent>
          </Tooltip>
        )}
        {count != null && (
          <span
            className="text-[10px] text-primary px-1.5 py-0.5 rounded-md bg-accent"
            style={{ fontWeight: 600 }}
          >
            {count}
          </span>
        )}
        {trailing && (
          <span className="ml-auto inline-flex items-center" onClick={(e) => e.stopPropagation()}>
            {trailing}
          </span>
        )}
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${trailing ? "" : "ml-auto"}`}
          style={{ transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)" }}
        />
      </button>
      <div
        className="overflow-hidden transition-[max-height,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{
          maxHeight: isOpen ? (contentHeight != null ? contentHeight + 24 + "px" : "1000px") : "0px",
          opacity: isOpen ? 1 : 0,
          transitionDelay: isOpen ? "0ms, 80ms" : "0ms, 0ms",
        }}
      >
        <div ref={contentRef} className="px-3.5 py-3">
          {children}
        </div>
      </div>
    </div>
  );
}

export function DashInfoLabel({
  children,
  tooltip: labelTooltip,
}: {
  children: React.ReactNode;
  tooltip?: string;
}) {
  return (
    <div className="flex items-center gap-1 mb-px">
      <p className="text-[10px] text-slate-400" style={{ fontWeight: 500 }}>
        {children}
      </p>
      {labelTooltip && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex shrink-0">
              <Info className="w-2.5 h-2.5 text-[#D1D5DB] hover:text-slate-400 transition-colors cursor-help" />
            </span>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={4} className="max-w-[240px] z-[300]">
            {labelTooltip}
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
