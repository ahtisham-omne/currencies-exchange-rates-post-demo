import React from 'react';
import type { LucideIcon } from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════════════════
 *  EmptyPlaceholder — Partner-consistent empty-state card.
 *  Mirrors Sales-Order-V5/.../EmptyPlaceholder.tsx; the two modules live
 *  in separate src trees so the duplication is intentional.
 * ═══════════════════════════════════════════════════════════════════════════ */
export interface EmptyPlaceholderProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
  maxWidth?: number;
  /** Full-width section card. Use for tab-body empty states. */
  block?: boolean;
  /** Drop the outer card chrome entirely. Use when the placeholder sits
   *  inside another card that already carries its own border — avoids the
   *  "box in a box" dashed outline that reads as visual noise. */
  borderless?: boolean;
}

export function EmptyPlaceholder({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  compact = false,
  maxWidth,
  block = false,
  borderless = false,
}: EmptyPlaceholderProps) {
  const pad = block ? 'px-6 py-14' : compact ? 'px-5 py-6' : 'px-8 py-12';
  const iconBox = compact ? 'w-10 h-10' : 'w-12 h-12';
  const iconSize = compact ? 'w-4 h-4' : 'w-5 h-5';
  const titleSize = compact ? 'text-[12.5px]' : 'text-[13px]';
  const descSize = compact ? 'text-[11.5px]' : 'text-[12px]';
  const mw = block ? undefined : maxWidth ?? (compact ? 360 : 420);
  const border = borderless
    ? ''
    : block
      ? 'border border-border'
      : 'border border-dashed border-[#E8ECF1]';
  const align = block ? '' : 'mx-auto';

  return (
    <div
      className={`rounded-xl ${border} bg-transparent text-center ${align} ${pad}`}
      style={{ maxWidth: mw, boxShadow: block && !borderless ? '0 1px 2px rgba(0,0,0,0.03)' : undefined, backgroundColor: borderless ? undefined : '#FFFFFF' }}
    >
      <div className={`${iconBox} mx-auto rounded-xl bg-[#F1F5F9] flex items-center justify-center mb-3`}>
        <Icon className={`${iconSize} text-slate-400`} />
      </div>
      <p className={`${titleSize} text-foreground`} style={{ fontWeight: 600 }}>
        {title}
      </p>
      {description && (
        <p className={`${descSize} text-slate-500 mt-1 mx-auto`} style={{ maxWidth: 420 }}>{description}</p>
      )}
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-primary hover:bg-[#0862D0] text-white text-[12px] cursor-pointer shadow-sm transition-colors"
          style={{ fontWeight: 600 }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
