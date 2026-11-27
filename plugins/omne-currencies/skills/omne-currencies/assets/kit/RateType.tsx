import { Lock, LockOpen } from 'lucide-react';
import { RATE_HEX, RATE_TINT, RATE_TYPE_LABEL, type RateType } from './rates';

/* ── OMNE currency kit: rate type and lock ────────────────────────────
 *  - RateTypeChip: "● Mid-market" (purple) or "● Corporate" (amber), after
 *    a rate.
 *  - RateTypeToggle: Mid-market | Corporate, where the rate type is chosen
 *    (a document's Currency configuration, the create screen). Put
 *    CompareRates right after it on sales and purchase orders.
 *  - LockChip / LockLine: whether a document's rate can still change.
 *    Unlocked (amber) until the event the BA's document names, then Locked
 *    (green). The block itself shows no lock; the configuration dialog does.
 *
 * Shared file. Do not edit it in a module. */

export function RateTypeChip({ type }: { type: RateType }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] whitespace-nowrap"
      style={{ color: RATE_HEX[type], backgroundColor: RATE_TINT[type], fontWeight: 600 }}
    >
      <span className="inline-block w-1 h-1 rounded-full" style={{ backgroundColor: RATE_HEX[type] }} />
      {RATE_TYPE_LABEL[type]}
    </span>
  );
}

/** Mid-market | Corporate, as the Exchange Rates module names them. */
export function RateTypeToggle({
  value,
  onChange,
  corporateAvailable = true,
  disabled = false,
  className = '',
}: {
  value: RateType;
  onChange: (type: RateType) => void;
  /** False when finance has set no corporate rate for the currency on the day. */
  corporateAvailable?: boolean;
  /** A locked document: shown, not changeable. */
  disabled?: boolean;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-lg border border-border bg-white p-0.5 ${className}`} role="radiogroup" aria-label="Rate type">
      {(['mid', 'corporate'] as RateType[]).map((t) => (
        <button
          key={t}
          type="button"
          role="radio"
          aria-checked={value === t}
          disabled={disabled}
          onClick={() => value !== t && onChange(t)}
          title={t === 'corporate' && !corporateAvailable ? 'No corporate rate is set for this currency. Enter one.' : undefined}
          className={`px-2 py-0.5 rounded-md text-[11px] whitespace-nowrap transition-colors ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} ${
            value === t ? 'bg-[#EDF4FF] text-[#0A77FF]' : 'text-muted-foreground hover:bg-muted'
          }`}
          style={{ fontWeight: value === t ? 500 : 400 }}
        >
          {RATE_TYPE_LABEL[t]}
        </button>
      ))}
    </span>
  );
}

/** Locked (green) or Unlocked (amber), with when it locks in its title. */
export function LockChip({ locked, title }: { locked: boolean; title?: string }) {
  const Icon = locked ? Lock : LockOpen;
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] cursor-default whitespace-nowrap"
      style={locked ? { color: '#047857', backgroundColor: '#ECFDF5', fontWeight: 600 } : { color: '#92400E', backgroundColor: '#FFFBEB', fontWeight: 600 }}
      title={title}
    >
      <Icon className="w-2.5 h-2.5" />
      {locked ? 'Locked' : 'Unlocked'}
    </span>
  );
}

/**
 * The rate's lock line in a Currency configuration dialog:
 * "[Unlocked] locks when the PO is confirmed" or "[Locked] locked when the
 * PO was confirmed". Pass the event in both tenses, as the BA's document
 * words it.
 */
export function LockLine({
  locked,
  locksWhen,
  lockedWhen,
  className = '',
}: {
  locked: boolean;
  /** "the PO is confirmed", "the invoice posts". */
  locksWhen: string;
  /** "the PO was confirmed", "the invoice posted". */
  lockedWhen: string;
  className?: string;
}) {
  const text = locked ? `locked when ${lockedWhen}` : `locks when ${locksWhen}`;
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] text-slate-500 ${className}`}>
      <LockChip locked={locked} title={text.charAt(0).toUpperCase() + text.slice(1)} />
      {text}
    </span>
  );
}
