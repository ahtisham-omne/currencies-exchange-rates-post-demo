import { useEffect, useState } from 'react';
import { toast } from 'sonner';

// Hard ceiling for hand-typed amounts so absurd values (review found
// $1,000,000,000,038,040) can't reach the formatter or the ledger.
const MAX_AMOUNT = 999_999_999.99;
const clampAmount = (raw: number) => Math.min(MAX_AMOUNT, Math.max(0, raw));

// ── Money input (meeting feedback 7/17/26) ──────────────────────────
// A text-mode amount field that groups thousands WHILE typing, grows
// with the value instead of clipping, never renders exponentials (no
// `e` key like type=number), and comfortably takes nine-digit amounts.
// Extracted from RecordPaymentFlow (7/29/26) so the payment run's
// proposal shares the exact same field.
export function formatMoneyText(raw: string): string {
  const cleaned = raw.replace(/[^\d.]/g, '');
  const [intPartRaw, ...rest] = cleaned.split('.');
  const intPart = intPartRaw.replace(/^0+(?=\d)/, '');
  const dec = rest.length > 0 ? '.' + rest.join('').slice(0, 2) : '';
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + dec;
}
export function parseMoneyText(text: string): number {
  const n = Number(text.replace(/,/g, ''));
  return Number.isFinite(n) ? clampAmount(n) : 0;
}
// ── Max chip (user 9/9) ──────────────────────────────────────────────
// The one "fill to the cap" affordance for every money input that carries
// a maximum (credit draws, prepayment steppers). Sits INSIDE the field at
// the right edge like modern fintech amount inputs, instead of a bare
// text link floating beside it. Give the host input enough right padding
// (pr-11) and a `relative` wrapper.
// States: idle = quiet slate chip that lifts to primary on hover; over
// the cap = rose, because clicking it IS the fix; already at the cap =
// muted and inert.
export function MaxChip({
  onClick,
  atMax = false,
  over = false,
  title,
}: {
  onClick: () => void;
  /** Already at the cap — the chip stays for layout but goes inert. */
  atMax?: boolean;
  /** The typed value exceeds the cap — the chip is the one-click fix. */
  over?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={atMax && !over}
      title={title ?? 'Fill to the maximum'}
      className={`absolute right-1 top-1/2 -translate-y-1/2 inline-flex items-center h-5 px-1.5 rounded border text-[9px] transition-colors ${
        over
          ? 'border-rose-300 bg-rose-50 text-rose-600 hover:bg-rose-100 cursor-pointer'
          : atMax
            ? 'border-slate-100 bg-slate-50 text-slate-300 cursor-default'
            : 'border-slate-200 bg-white text-slate-500 hover:border-primary/40 hover:text-primary hover:bg-accent cursor-pointer'
      }`}
      style={{ fontWeight: 700 }}
    >
      Max
    </button>
  );
}

export function MoneyInput({
  value,
  onValueChange,
  className,
  placeholder = '0.00',
  autoFocus,
  fluid = false,
  // Nine-digit baseline (Eli's standard, reaffirmed 9/8): a formatted
  // nine-digit amount is 14 characters (123,456,789.00) — the field's
  // BASE width holds that without shrinking, and only grows past it for
  // genuinely enormous values.
  minWidthCh = 14,
}: {
  value: number;
  onValueChange: (n: number) => void;
  className?: string;
  placeholder?: string;
  autoFocus?: boolean;
  /** Fill the parent instead of sizing to the typed value. */
  fluid?: boolean;
  minWidthCh?: number;
}) {
  const [text, setText] = useState(value ? formatMoneyText(value.toFixed(2)) : '');
  const [focused, setFocused] = useState(false);
  // Rejected-character feedback (GPT QC21, 9/30 — S2#35: no silent input
  // correction): a typed minus or a third decimal digit never alters the
  // value quietly; the field flashes the module's rose ring and the
  // tooltip names what was dropped.
  const [rejected, setRejected] = useState<'negative' | 'precision' | null>(null);
  useEffect(() => {
    if (!rejected) return;
    const t = setTimeout(() => setRejected(null), 2000);
    return () => clearTimeout(t);
  }, [rejected]);
  // Snap-back links and programmatic updates land while unfocused —
  // resync the visible text then.
  useEffect(() => {
    if (!focused) setText(value ? formatMoneyText(value.toFixed(2)) : '');
  }, [value, focused]);
  return (
    <input
      type="text"
      inputMode="decimal"
      autoFocus={autoFocus}
      value={text}
      placeholder={placeholder}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={(e) => {
        const raw = e.target.value;
        // A minus sign or a third decimal is REFUSED WITH A MESSAGE (VI-27),
        // never corrected silently: the field flashes the rose ring and a
        // toast names exactly what was dropped, once per rejection burst.
        const rej: 'negative' | 'precision' | null =
          raw.includes('-') ? 'negative' : /\.\d{3,}/.test(raw) ? 'precision' : null;
        if (rej && rej !== rejected) {
          toast.info(
            rej === 'negative' ? 'Amounts cannot be negative' : 'Amounts use two decimals',
            { description: rej === 'negative' ? 'The minus sign was removed.' : 'The extra decimal digit was dropped.' },
          );
        }
        if (rej) setRejected(rej);
        const next = formatMoneyText(raw);
        setText(next);
        onValueChange(parseMoneyText(next));
      }}
      title={
        rejected === 'negative'
          ? 'Amounts are positive here. The minus sign was ignored.'
          : rejected === 'precision'
            ? 'Amounts carry two decimals. Extra digits were ignored.'
            : undefined
      }
      // Placeholder tone baseline (contrast standard 7/24/26): hints are
      // slate-400 everywhere, never the dark muted-foreground.
      className={`placeholder:text-slate-400 transition-shadow ${rejected ? 'ring-2 ring-rose-200 border-rose-300' : ''} ${className ?? ''}`}
      style={fluid ? undefined : { width: `${Math.max(minWidthCh, text.length + 4)}ch` }}
    />
  );
}
