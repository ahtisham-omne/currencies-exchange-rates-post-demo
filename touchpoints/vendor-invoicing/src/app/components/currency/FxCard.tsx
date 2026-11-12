import * as React from 'react';
import * as HoverCardPrimitive from '@radix-ui/react-hover-card';

/* ── The currency hover card ──────────────────────────────────────────
 * One layout for every card that explains an amount's currency: this module's
 * rate card, the Partners currency card and the Chart of Accounts FX card,
 * which it follows. The currency on top, the amount in it, then a grey block
 * with the base-currency figure and the rate behind it.
 *
 * Sizes and colours are px and hex rather than theme tokens, so the card
 * measures the same in every module whatever its root font size (Chart of
 * Accounts runs on a 13px root, the others on 16px). Each module carries a copy
 * of this file; keep them identical. */

/** Flag height in the header. FlagImage is 1em tall and 1.33em wide. */
export const FX_FLAG_PX = 15;

const INK = '#0F1729';
const MUTED = '#48566A';
const LINE = '#EEF2F6';
const RATE_COLOR = { mid: '#7C3AED', corporate: '#B45309' } as const;

/** For the HoverCardContent that holds a card. */
export const FX_CARD_CLASS =
  'w-max p-[12px] bg-white text-left rounded-[12px] border border-[#EEF2F6] shadow-[0_20px_25px_-5px_rgba(0,0,0,0.08),0_8px_10px_-6px_rgba(0,0,0,0.04)]';

/** Keeps the pointer clear of the card's rounded corners. */
export const FX_ARROW_PADDING = 14;

/** "€16,692.29" → "€16,692.29 EUR"; a code-prefixed amount keeps its one code. */
export function withCode(text: string, code: string): string {
  return text.includes(code) ? text : `${text} ${code}`;
}

/** Flag, "Euro (EUR)", then what the currency is to this record. */
export function FxHead({ flag, name, code, role }: { flag?: React.ReactNode; name: string; code?: string; role?: string }) {
  return (
    <div className="flex items-center gap-[6px] whitespace-nowrap">
      {flag && <span className="inline-flex shrink-0 leading-none">{flag}</span>}
      <span className="text-[12px] leading-[16px]" style={{ color: INK, fontWeight: 600 }}>
        {name}
        {code ? ` (${code})` : ''}
      </span>
      {role && <span className="text-[12px] leading-[16px]" style={{ color: MUTED, fontWeight: 400 }}>· {role}</span>}
    </div>
  );
}

/** The figures under the header. */
export function FxLines({ children }: { children: React.ReactNode }) {
  return <div className="mt-[8px] space-y-[4px]">{children}</div>;
}

/** Label left, amount right, so the card's amounts line up down one edge. */
export function FxLine({ label, value, strong }: { label: React.ReactNode; value: React.ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-[24px] whitespace-nowrap">
      <span className="text-[12px] leading-[16px]" style={{ color: MUTED, fontWeight: 400 }}>{label}</span>
      <span className="text-[12px] leading-[16px] tabular-nums" style={{ color: INK, fontWeight: strong ? 600 : 500 }}>{value}</span>
    </div>
  );
}

/** The grey block: the figure that matters and the rate behind it. Amber marks
 *  a figure that is indicative only. */
export function FxInset({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'amber' }) {
  return (
    <div
      className="mt-[8px] rounded-[10px] border p-[10px] space-y-[5px]"
      style={tone === 'amber' ? { background: '#FFFBEB', borderColor: '#FDE68A' } : { background: 'rgba(241,245,249,0.5)', borderColor: LINE }}
    >
      {children}
    </div>
  );
}

/** A line of explanation inside the grey block. `small` for a footnote. */
export function FxNote({ children, small }: { children: React.ReactNode; small?: boolean }) {
  return (
    <div className={small ? 'text-[10px] leading-[14px] whitespace-nowrap' : 'text-[11px] leading-[15px] whitespace-nowrap'} style={{ color: MUTED }}>
      {children}
    </div>
  );
}

/** "● Mid-market · Open Exchange Rates", purple for mid-market, amber for corporate. */
export function FxRateType({ type, label, source }: { type: 'mid' | 'corporate'; label: string; source?: string }) {
  const color = RATE_COLOR[type];
  return (
    <div className="flex items-center gap-[6px] whitespace-nowrap text-[11px] leading-[15px]">
      <span className="w-[6px] h-[6px] rounded-full shrink-0" style={{ background: color }} />
      <span style={{ color, fontWeight: 600 }}>{label}</span>
      {source && <span style={{ color: MUTED }}>· {source}</span>}
    </div>
  );
}

/** An amber caution line, e.g. a rate that is not fixed yet. */
export function FxAlert({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-[6px] whitespace-nowrap text-[11px] leading-[15px]">
      <span className="w-[6px] h-[6px] rounded-full shrink-0 bg-amber-500" />
      <span className="text-amber-700" style={{ fontWeight: 500 }}>{children}</span>
    </div>
  );
}

/** The pointer at the card's edge, toward the amount it explains: white, with
 *  the card's border on its two outer sides, overlapping the card's border by a
 *  pixel so the line doesn't run under it. */
export function FxArrow() {
  return (
    <HoverCardPrimitive.Arrow asChild width={12} height={6}>
      <svg width="12" height="6" viewBox="0 0 12 6" style={{ display: 'block', marginTop: -1 }} aria-hidden>
        <path d="M0 0 L6 6 L12 0" fill="#fff" stroke={LINE} />
      </svg>
    </HoverCardPrimitive.Arrow>
  );
}
