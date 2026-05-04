import React, { useState } from 'react';
import { CurrencyFlag } from './CurrencyFlag';

const FONT = 'Inter, system-ui, sans-serif';

interface CurrencySymbolProps {
  /** Symbol text to display (e.g. "Rs"). Defaults to system base currency. */
  symbol?: string;
  /** ISO 4217 code shown in hover tooltip. */
  code?: string;
  /** Full currency name shown in hover tooltip. */
  name?: string;
  /** Optional className for the visible symbol span. */
  className?: string;
  /** Optional inline style for the visible symbol span. */
  style?: React.CSSProperties;
}

/**
 * Base-currency symbol with a hover tooltip revealing the full currency
 * identity (flag + name + ISO code). Mirrors the Exchange Rate Library
 * tooltip pattern used across the Partners touchpoint.
 */
export function CurrencySymbol({
  symbol = 'Rs',
  code = 'PKR',
  name = 'Pakistani Rupee',
  className,
  style,
}: CurrencySymbolProps) {
  const [hover, setHover] = useState(false);

  return (
    <span
      className={className}
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', cursor: 'help', ...style }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      aria-label={`${name} (${code})`}
    >
      {symbol}
      {hover && (
        <span
          role="tooltip"
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 8px)',
            left: 0,
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: 10,
            padding: '10px 12px',
            boxShadow: '0 8px 24px -6px rgba(15, 23, 42, 0.18), 0 2px 6px -2px rgba(15, 23, 42, 0.08)',
            fontFamily: FONT,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            zIndex: 10000,
            cursor: 'default',
          }}
        >
          <CurrencyFlag country="pk" size={28} />
          <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6, lineHeight: 1.2 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>
              {name} ({code})
            </span>
            <span style={{ fontSize: 12, color: '#94A3B8', fontWeight: 400 }}>
              — base currency
            </span>
          </span>
        </span>
      )}
    </span>
  );
}
