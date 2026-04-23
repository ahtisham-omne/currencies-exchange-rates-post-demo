import React, { useId, useState } from 'react';

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
 * Pakistan flag — 3:2 rectangle with a white hoist stripe (1/4 width), a dark
 * green field, and a white crescent + 5-point star. Rendered as SVG so it's
 * pixel-crisp at any size and doesn't depend on OS emoji fonts.
 */
function PakistanFlagBadge({ width = 28, height = 20 }: { width?: number; height?: number }) {
  const clipId = useId();
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 24 16"
      style={{ flexShrink: 0, display: 'block' }}
      aria-hidden
    >
      <defs>
        <clipPath id={clipId}>
          <rect width="24" height="16" rx="2" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        {/* Dark green field */}
        <rect width="24" height="16" fill="#01411C" />
        {/* White hoist stripe — 1/4 of flag width */}
        <rect width="6" height="16" fill="#FFFFFF" />
        {/* Crescent: white circle with green cutout circle offset to make the curve */}
        <circle cx="13.5" cy="8" r="3" fill="#FFFFFF" />
        <circle cx="14.6" cy="7.5" r="2.5" fill="#01411C" />
        {/* 5-point star, pointing up */}
        <polygon
          points="17,5.5 17.35,6.51 18.43,6.54 17.57,7.19 17.88,8.21 17,7.6 16.12,8.21 16.43,7.19 15.57,6.54 16.65,6.51"
          fill="#FFFFFF"
        />
      </g>
      <rect
        width="24"
        height="16"
        rx="2"
        fill="none"
        stroke="rgba(15, 23, 42, 0.08)"
        strokeWidth="0.75"
      />
    </svg>
  );
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
          <PakistanFlagBadge />
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
