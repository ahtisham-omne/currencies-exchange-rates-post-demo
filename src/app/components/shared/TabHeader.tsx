import React from 'react';
import { NumberPill } from './NumberPill';

/**
 * TabHeader — canonical detail-page tab header bar.
 *
 * Mirrors the pattern Quotes uses across its detail tabs and the same
 * shape that DashInfoCard uses for its card header. Provides:
 *   - Icon chip (32×32 rounded-md, bg-accent + text-primary)
 *   - 13px slate-700 title
 *   - Optional small count badge (bg-accent + text-primary)
 *   - Right-side toolbar slot via children
 *   - Bottom border
 *
 * Adopt for any tab body that has its own header bar (Shipments, Invoicing,
 * Picking, Sourcing, future Communications).
 */
export function TabHeader({
  icon: Icon,
  title,
  count,
  subtitle,
  children,
}: {
  icon: React.ElementType;
  title: string;
  count?: number;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className="flex items-center justify-between border-b border-border shrink-0"
      style={{ padding: '12px 16px' }}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-7 h-7 rounded-md bg-accent flex items-center justify-center shrink-0">
          <Icon className="w-3.5 h-3.5 text-primary" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-700 truncate" style={{ fontSize: 13, fontWeight: 600 }}>
              {title}
            </span>
            {count != null && <NumberPill count={count} />}
          </div>
          {subtitle && (
            <span style={{ fontSize: 11, color: 'var(--muted-foreground)', lineHeight: 1.3 }}>
              {subtitle}
            </span>
          )}
        </div>
      </div>
      {children && <div className="flex items-center gap-2 shrink-0">{children}</div>}
    </div>
  );
}
