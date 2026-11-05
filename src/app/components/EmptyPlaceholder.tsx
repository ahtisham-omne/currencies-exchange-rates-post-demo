import React from 'react';
import type { LucideIcon } from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════════════════
 *  EmptyPlaceholder
 *  ────────────────
 *  Partner-consistent empty-state card. Used wherever a list / table /
 *  section has nothing to show: dashed slate border, soft tinted square
 *  icon, bold title, optional helper description, optional primary CTA.
 *
 *  Use `compact` for small inline sections (per-line pricing rules /
 *  one-times in the configurator). Default is the larger card used for
 *  full-modal empty states.
 * ═══════════════════════════════════════════════════════════════════════════ */
export interface EmptyPlaceholderProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  /** When provided alongside `onAction`, renders a primary CTA button
   *  below the description. Omit for read-only contexts. */
  actionLabel?: string;
  onAction?: () => void;
  /** Smaller padding + tighter typography for inline section use. */
  compact?: boolean;
  /** Restrict the card's max width so it doesn't span the full container
   *  on wide layouts. Default 360 (compact) / 420 (regular). */
  maxWidth?: number;
  /** Renders a full-width section card (solid border, taller padding)
   *  instead of the centered compact chip. Use for tab-body empty
   *  states so they read like a normal section card, matching the
   *  ComingSoon panels on the sibling tabs. */
  block?: boolean;
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
}: EmptyPlaceholderProps) {
  const pad = block ? 'px-6 py-14' : compact ? 'px-5 py-6' : 'px-8 py-12';
  const iconBox = compact ? 'w-10 h-10' : 'w-12 h-12';
  const iconSize = compact ? 'w-4 h-4' : 'w-5 h-5';
  const titleSize = compact ? 'text-[12.5px]' : 'text-[13px]';
  const descSize = compact ? 'text-[11.5px]' : 'text-[12px]';
  const mw = block ? undefined : maxWidth ?? (compact ? 360 : 420);
  const border = block ? 'border-border' : 'border-dashed border-[#E8ECF1]';
  const align = block ? '' : 'mx-auto';

  return (
    <div
      className={`rounded-xl border ${border} bg-white text-center ${align} ${pad}`}
      style={{ maxWidth: mw, boxShadow: block ? '0 1px 2px rgba(0,0,0,0.03)' : undefined }}
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
