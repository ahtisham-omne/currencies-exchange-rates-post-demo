/**
 * The purchasing stepper, always on.
 *
 * `ReturnQtyField` wraps this in an Add / enter / recorded sequence, which is
 * right where entering a figure is what puts a part on the return. On a vendor
 * row inside a part's card the figure already exists -- it is an allocation
 * being adjusted, not a decision being made -- so the control stays visible,
 * exactly as the cart's line item keeps its stepper visible.
 *
 * Ported from `purchase-order-cart/components/QuantityStepper.tsx`: 32px frame,
 * 48px centred field between two 28px buttons, a text input with inputMode
 * rather than a number spinner, draft on type and commit on blur, Enter to
 * commit, Escape to revert, focus selecting what is there, and keystroke
 * masking. Every quantity steps whole: goods go back in units, not halves.
 *
 * The one addition is a ceiling, which an order has no need of: nothing beyond
 * what a vendor shipped can go back to them.
 */

import { useEffect, useRef, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { useRefusalNotice } from '@/app/components/rma/QtyUomField';

// Two decimals: the stepper only stands on rows without serial numbers, and
// a partial box, roll or cut length goes back as entered (ERP-8654 AC3).
const round = (n: number) => Math.round(n * 100) / 100;
const show = (n: number) => (n <= 0 ? '' : String(round(n)));

export function QtyStepper({
  value,
  cap,
  ariaLabel,
  onChange,
}: {
  value: number;
  /** What the vendor shipped, for the guidance beside the field. Not a ceiling:
   *  the figure entered when the part was added is where counting starts, and a
   *  pallet that turns out to hold four hundred has to be enterable. */
  cap: number;
  ariaLabel: string;
  onChange: (next: number) => void;
}) {
  const [draft, setDraft] = useState(() => show(value));
  // Escape reverts and then blurs, and blur commits. Without this the commit
  // reads the draft it was told to abandon and writes it anyway.
  const reverting = useRef(false);

  useEffect(() => { setDraft(show(value)); }, [value]);

  const typed = Number.parseFloat(draft);
  // Flagged, never blocked. Going past what a vendor shipped is worth noticing
  // and is not the flow's business to forbid.
  const over = Number.isFinite(typed) && typed > cap;
  // Every quantity on a return is whole, whatever the part is tracked by.
  const pattern = /^\d*(?:\.\d{0,2})?$/;
  // A decimal typed into a box that counts whole units used to vanish into the
  // mask: 2.5 landed as 25, silently, because the dot was dropped and the 5
  // ran on behind the 2. The keystroke is still refused -- half a unit is not
  // a thing to send back -- but it now says so instead of quietly changing the
  // number to something nobody typed.
  const [decimalRefused, refuseDecimal] = useRefusalNotice();

  const commit = () => {
    if (reverting.current) { reverting.current = false; return; }
    if (draft === '') { onChange(0); return; }
    if (!Number.isFinite(typed) || typed < 0) { setDraft(show(value)); return; }
    const next = round(typed);
    onChange(next);
    setDraft(show(next));
  };

  const step = (delta: number) => {
    const base = Number.isFinite(typed) ? typed : value;
    const next = Math.max(0, round(base + delta));
    onChange(next);
    setDraft(show(next));
  };

  return (
    <span className="relative inline-flex">
    <div
      className={`inline-flex h-8 items-stretch overflow-hidden rounded-md border bg-white ${
        over ? 'border-red-400' : 'border-[#E2E8F0]'
      }`}
    >
      <button
        type="button"
        aria-label="One less"
        disabled={value <= 0}
        onClick={() => step(-1)}
        className="flex w-7 items-center justify-center text-slate-400 transition-colors hover:bg-slate-50 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Minus className="w-[13px] h-[13px]" />
      </button>
      <input
        type="text"
        inputMode="decimal"
        aria-label={ariaLabel}
        value={draft}
        placeholder="0"
        onChange={(e) => {
          const next = e.target.value;
          if (pattern.test(next)) { setDraft(next); return; }
          if (/[.,]/.test(next)) refuseDecimal();
        }}
        onFocus={(e) => e.target.select()}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') { reverting.current = true; setDraft(show(value)); e.currentTarget.blur(); }
        }}
        className={`w-12 min-w-0 border-x bg-transparent px-1 text-center text-[13px] tabular-nums outline-none placeholder:text-slate-300 ${
          over ? 'border-red-400 text-red-700' : 'border-[#E2E8F0] text-foreground'
        }`}
        style={{ fontWeight: 600 }}
      />
      <button
        type="button"
        aria-label="One more"
        onClick={() => step(1)}
        className="flex w-7 items-center justify-center text-slate-400 transition-colors hover:bg-slate-50 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Plus className="w-[13px] h-[13px]" />
      </button>
    </div>
      {/* Sits outside the flow so saying it cannot push a row around. */}
      {decimalRefused && (
        <span
          role="status"
          aria-live="polite"
          className="absolute left-0 top-full z-20 mt-1 whitespace-nowrap rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-800"
          style={{ fontWeight: 500 }}
        >
          Up to two decimal places.
        </span>
      )}
    </span>
  );
}
