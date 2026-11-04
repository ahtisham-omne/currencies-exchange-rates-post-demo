import type { ComponentType } from 'react';

/* Segmented count pill (user 10/10): the payment run header's
 * "3 vendors | 8 invoices" recipe, shared so every header that states
 * related-record counts reads the same. First segment is tinted and
 * carries the icon, later segments are white behind a divider. With an
 * onClick the whole pill is one button. */
export function SegmentedCountPill({
  segments,
  icon: Icon,
  onClick,
  title,
}: {
  segments: string[];
  icon?: ComponentType<{ className?: string }>;
  onClick?: () => void;
  title?: string;
}) {
  if (segments.length === 0) return null;
  const body = segments.map((seg, k) => (
    <span
      key={`${k}-${seg}`}
      className={
        k === 0
          ? 'inline-flex items-center gap-1 px-2 py-[2px] text-[11px] bg-slate-50 text-slate-700 transition-colors group-hover/segpill:text-primary'
          : 'inline-flex items-center px-2 py-[2px] text-[11px] bg-white text-slate-500 border-l transition-colors group-hover/segpill:text-primary'
      }
      style={{ fontWeight: k === 0 ? 600 : 500, ...(k > 0 ? { borderColor: 'hsl(var(--border))' } : {}) }}
    >
      {k === 0 && Icon && <Icon className="w-3 h-3 text-slate-400" />}
      {seg}
    </span>
  ));
  const className = 'inline-flex items-stretch rounded-full overflow-hidden border shrink-0';
  const style = { borderColor: 'hsl(var(--border))' };
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        title={title}
        className={`${className} cursor-pointer transition-colors hover:border-primary/40 group/segpill`}
        style={style}
      >
        {body}
      </button>
    );
  }
  return (
    <span className={className} style={style} title={title}>
      {body}
    </span>
  );
}
