// Mirrors Partner Management's DashInfoCard exactly so right-sidebar sections
// have a full-width title stroke (border-bottom on the header spans edge-to-edge).
// Source of truth: Partners VendorDetailsPage.tsx lines 3511-3570.
import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Info } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

interface SidebarInfoCardProps {
  title: string;
  icon?: React.ElementType;
  count?: number;
  tooltip?: string;
  defaultOpen?: boolean;
  /** Right-aligned action area in the header (e.g. edit/manage button) */
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export function SidebarInfoCard({
  title,
  icon: Icon,
  count,
  tooltip,
  defaultOpen = true,
  actions,
  children,
}: SidebarInfoCardProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight);
    }
  }, [children]);

  return (
    <div className="rounded-xl border border-border bg-white overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <button
        type="button"
        className="w-full px-3.5 py-2.5 flex items-center gap-2 cursor-pointer hover:bg-[#FAFBFC] transition-colors"
        style={{ borderBottom: isOpen ? '1px solid var(--muted)' : 'none' }}
        onClick={() => setIsOpen((v) => !v)}
      >
        {Icon && (
          <div
            className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
            style={{ backgroundColor: '#EDF4FF' }}
          >
            <Icon className="w-3 h-3" style={{ color: 'var(--primary)' }} />
          </div>
        )}
        <span
          className="text-[12px] text-left"
          style={{ fontWeight: 600, color: 'var(--foreground)' }}
        >
          {title}
        </span>
        {tooltip && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex shrink-0" onClick={(e) => e.stopPropagation()}>
                <Info className="w-3 h-3 text-slate-300 hover:text-slate-400 transition-colors cursor-help" />
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6} className="max-w-[260px] z-[300]">
              {tooltip}
            </TooltipContent>
          </Tooltip>
        )}
        {count != null && (
          <span
            className="text-[10px] px-1.5 py-0.5 rounded-md"
            style={{ fontWeight: 600, color: 'var(--primary)', backgroundColor: '#EDF4FF' }}
          >
            {count}
          </span>
        )}
        {actions && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="ml-auto flex items-center gap-1 shrink-0"
          >
            {actions}
          </div>
        )}
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-300 ${actions ? '' : 'ml-auto'}`}
          style={{
            transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
            transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        />
      </button>
      <div
        className="overflow-hidden transition-[max-height,opacity] duration-300"
        style={{
          maxHeight: isOpen ? (contentHeight != null ? contentHeight + 24 + 'px' : '2000px') : '0px',
          opacity: isOpen ? 1 : 0,
          transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
          transitionDelay: isOpen ? '0ms, 80ms' : '0ms, 0ms',
        }}
      >
        <div ref={contentRef} className="px-3.5 py-3">
          {children}
        </div>
      </div>
    </div>
  );
}
