import type { ReactNode } from 'react';
import { getCurrency } from './currencies';

/* ── A Currency column's cell, as the Currency Library draws it ──────────
 * The shell's Currency Library (src/app/coa/components/cells.tsx,
 * CurrencyCell): a blue pill with the ISO code, then the currency's name.
 * Every listing table's Currency column uses this, so a currency reads the
 * same in every module. The pill's values are the library's as rendered:
 * #EFF6FF fill, #1D4ED8 text, #DBEAFE border, 11px/14px semibold, 2px 6px
 * padding, 8px radius, 6px before the name (#1E293B, regular). The name
 * takes the table's own text size and truncates with the full name on hover.
 *
 * Shared file. Do not edit it in a module. */

export const CURRENCY_CODE_PILL_STYLE = {
  display: 'inline-flex',
  alignItems: 'center',
  flexShrink: 0,
  padding: '2px 6px',
  borderRadius: 8,
  border: '1px solid #DBEAFE',
  background: '#EFF6FF',
  color: '#1D4ED8',
  fontSize: 11,
  lineHeight: '14px',
  fontWeight: 600,
} as const;

export function CurrencyCodeCell({
  code,
  showName = true,
  highlight,
  title,
}: {
  code: string | null | undefined;
  /** False for a narrow cell: the pill alone, the name on hover. */
  showName?: boolean;
  /** Marks a search match (the table's own highlighter). */
  highlight?: (text: string) => ReactNode;
  /** Extra words for the hover, after the name. */
  title?: string;
}) {
  const iso = (code ?? '').toUpperCase();
  if (!iso) return <span style={{ color: '#94A3B8' }}>—</span>;
  const name = getCurrency(iso)?.name ?? iso;
  return (
    <span className="inline-flex items-center min-w-0 max-w-full" style={{ gap: 6 }} title={title ? `${name} (${iso}) · ${title}` : `${name} (${iso})`}>
      <span style={CURRENCY_CODE_PILL_STYLE}>{highlight ? highlight(iso) : iso}</span>
      {showName && (
        <span className="truncate" style={{ color: '#1E293B', fontWeight: 400 }}>
          {highlight ? highlight(name) : name}
        </span>
      )}
    </span>
  );
}
