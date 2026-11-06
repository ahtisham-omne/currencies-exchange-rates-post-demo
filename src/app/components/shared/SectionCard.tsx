import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface SectionCardProps {
  /** Left icon of the header strip, shown in Partners' tinted 24px tile. */
  icon: LucideIcon;
  title: string;
  /** Small uppercase hint beside the title, e.g. "Required". */
  meta?: string;
  /** Right side of the header strip, e.g. a Clear All button. */
  actions?: React.ReactNode;
  /** Set false when the body supplies its own padding. */
  padded?: boolean;
  className?: string;
  children: React.ReactNode;
}

/* The boxed section card used by Partner creation (CreatePartnerStep2):
   a white card with a tinted header strip, a 24px icon tile, a 13px
   semibold title, and an optional action on the right. Both Quote and
   Sales Order creation steps build their sections from this so the two
   modules read the same as Partners. */
export function SectionCard({
  icon: Icon,
  title,
  meta,
  actions,
  padded = true,
  className,
  children,
}: SectionCardProps) {
  return (
    <div
      className={`rounded-lg border border-border bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)] ${className ?? ''}`}
    >
      <div className="px-3 sm:px-4 py-2 sm:py-2.5 border-b border-[#EEF2F6] flex items-center justify-between gap-2 bg-[#FAFBFC] rounded-t-lg">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-md bg-primary/8 flex items-center justify-center shrink-0">
            <Icon className="w-3.5 h-3.5 text-primary" />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs sm:text-[13px] text-foreground" style={{ fontWeight: 600 }}>
              {title}
            </span>
            {meta && (
              <span
                className="text-[9px] sm:text-[10px] text-slate-400 tracking-wider uppercase hidden min-[480px]:inline"
                style={{ fontWeight: 500 }}
              >
                {meta}
              </span>
            )}
          </div>
        </div>
        {actions}
      </div>
      <div className={padded ? 'px-2.5 sm:px-3 pt-2 sm:pt-2.5 pb-1.5 sm:pb-2' : undefined}>
        {children}
      </div>
    </div>
  );
}

/* Partners' header-strip action geometry with its destructive Clear all
   colouring (SearchableUserPicker): neutral until hover, red on hover. */
export function SectionClearButton({ onClick, label = 'Clear All' }: { onClick?: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg border border-border bg-white text-muted-foreground hover:text-red-500 hover:bg-red-50 hover:border-red-200 transition-all shrink-0 text-[11px] sm:text-xs cursor-pointer"
      style={{ fontWeight: 600 }}
    >
      {label}
    </button>
  );
}
