/**
 * How much of a part is going back, asked the way purchasing asks it.
 *
 * The row rests with a single Add button and no field. Pressing it opens the
 * stepper in place, seeded at nothing, with its own Add to confirm and an X to
 * back out. Confirming records the figure and the stepper goes away again, so
 * the row spends almost all its life showing an answer rather than an empty
 * input. Add more reopens it and the next figure is added to what is already
 * recorded, which is how a picker built for one part at a time behaves when
 * somebody counts a pallet, walks off, and comes back with the rest.
 *
 * Ported from the create-purchase-order catalogue row: same 32px stepper frame,
 * same 48px centred field between two 28px buttons, text input with inputMode
 * rather than a number spinner, draft-on-type, Enter to confirm, Escape to back
 * out, focus selecting what is there. Serialized units step whole, since half a
 * serial number is not a thing; anything else takes two decimals, because feet
 * and litres arrive in fractions.
 *
 * Two things differ, because a return is not an order.
 *
 * A ceiling: nothing beyond what was received ever went out, so nothing beyond
 * it can come back. The figure on the right counts down as units are recorded,
 * each round is capped at what is left of it, and Add more disappears once the
 * whole receipt is spoken for.
 *
 * A way back out: purchasing can drop a line from the cart, which is a screen
 * away. Here this row is the only record, so a recorded figure can be cleared
 * from it -- otherwise a mistyped quantity would survive all the way to the
 * grid before anyone could touch it.
 */

import { hasSerials } from '@/app/data/itemTracking';
import { isLotMode } from '@/app/data/mockRMAs';
import { type TrackingMode } from '@/app/data/itemProvenance';
import { useRefusalNotice } from '@/app/components/rma/QtyUomField';
import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, Layers, Minus, Package, Plus, X } from 'lucide-react';
import { formatQty } from '@/app/components/vendorSelectionModel';

/** Whole units for serial-numbered parts, two decimals for everything else:
 *  a partial box, roll or cut length goes back as entered (ERP-8654 AC3). */
const roundTo = (whole: boolean) => (n: number) => (whole ? Math.round(n) : Math.round(n * 100) / 100);

/** How long the confirmation stands before the row settles. */
const FLASH_MS = 1200;

type Mode = 'rest' | 'adding' | 'added';

export function ReturnQtyField({
  sku,
  qty,
  cap,
  uom,
  trackingMode = 'none',
  onQty,
}: {
  sku: string;
  /** What is recorded against this part so far. */
  qty: number;
  /** Everything received. The most that can come back. */
  cap: number;
  uom: string;
  /** How the part is tracked. Only the icon on the opening button depends on
   *  it: the row already says which kind of part this is, and the button
   *  saying the same thing again means the two cannot drift apart. */
  trackingMode?: TrackingMode;
  onQty: (total: number) => void;
}) {
  const [mode, setMode] = useState<Mode>('rest');
  const [draft, setDraft] = useState('');
  // Escape backs out and then blurs, and blur settles the draft. Without this
  // the settle reads the draft it was told to abandon and keeps it.
  const abandoning = useRef(false);
  const flash = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (flash.current) clearTimeout(flash.current); }, []);

  const wholeOnly = hasSerials(trackingMode);
  const round = roundTo(wholeOnly);
  const left = Math.max(0, round(cap - qty));
  const typed = Number.parseFloat(draft);
  const entered = Number.isFinite(typed) ? typed : 0;
  const over = entered > left;
  // Every quantity on a return is whole, whatever the part is tracked by.
  const pattern = wholeOnly ? /^\d*$/ : /^\d*(?:\.\d{0,2})?$/;
  // A decimal on a line that counts whole units used to disappear into the
  // mask, so 2.5 landed as 25 without a word. Still refused, but out loud.
  const [decimalRefused, refuseDecimal] = useRefusalNotice();

  const open = () => { setDraft(''); setMode('adding'); };
  const close = () => { abandoning.current = true; setDraft(''); setMode('rest'); };

  /** Record what was entered on top of what is already down. */
  const confirm = () => {
    if (entered <= 0) return;
    onQty(round(qty + Math.min(entered, left)));
    setDraft('');
    setMode('added');
    if (flash.current) clearTimeout(flash.current);
    flash.current = setTimeout(() => setMode('rest'), FLASH_MS);
  };

  const step = (delta: number) => {
    const next = Math.min(Math.max(0, round(entered + delta)), left);
    setDraft(next <= 0 ? '' : String(next));
  };

  /** The same two facts on every state: what has been recorded, and what is
   *  still there to record. Neither replaces the other. */
  const info = (
    <>
      {qty > 0 && <Added n={qty} uom={uom} />}
      {/* Nothing left is not a figure worth stating. "40 BOX added · 0 BOX"
          reads as a fault rather than as a finished row. */}
      {(left > 0 || qty <= 0) && <Amount n={left} uom={uom} over={over && mode === 'adding'} />}
    </>
  );

  // ---- Recorded, just now -------------------------------------------------
  if (mode === 'added') {
    return (
      <Slot info={info}>
        <span
          className="inline-flex h-8 items-center gap-1.5 rounded-full bg-emerald-50 px-3 text-[11px] text-emerald-700"
          style={{ fontWeight: 600 }}
        >
          <Check className="w-3 h-3" />
          On the return
        </span>
      </Slot>
    );
  }

  // ---- Entering a figure --------------------------------------------------
  if (mode === 'adding') {
    return (
      <Slot info={info}>
        <span className="relative inline-flex">
        <div
          className={`inline-flex h-8 items-stretch overflow-hidden rounded-md border bg-white ${
            over ? 'border-red-400' : 'border-[#E2E8F0]'
          }`}
        >
          <button
            type="button"
            aria-label={`One less ${sku}`}
            disabled={entered <= 0}
            onClick={() => step(-1)}
            className="flex w-7 items-center justify-center text-slate-400 transition-colors hover:bg-slate-50 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Minus className="w-[13px] h-[13px]" />
          </button>
          <input
            type="text"
            autoFocus
            inputMode={wholeOnly ? 'numeric' : 'decimal'}
            aria-label={`Quantity of ${sku} going back`}
            value={draft}
            placeholder="0"
            onChange={(e) => {
              const next = e.target.value;
              if (pattern.test(next)) { setDraft(next); return; }
              if (/[.,]/.test(next)) refuseDecimal();
            }}
            onFocus={(e) => e.target.select()}
            onBlur={() => {
              if (abandoning.current) { abandoning.current = false; return; }
              // Settle a figure past what is left back onto what is left.
              if (over) setDraft(String(left));
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); confirm(); }
              if (e.key === 'Escape') { close(); }
            }}
            className={`w-12 min-w-0 border-x bg-transparent px-1 text-center text-[13px] tabular-nums outline-none placeholder:text-slate-300 ${
              over ? 'border-red-400 text-red-700' : 'border-[#E2E8F0] text-foreground'
            }`}
            style={{ fontWeight: 600 }}
          />
          <button
            type="button"
            aria-label={`One more ${sku}`}
            disabled={entered >= left}
            onClick={() => step(1)}
            className="flex w-7 items-center justify-center text-slate-400 transition-colors hover:bg-slate-50 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus className="w-[13px] h-[13px]" />
          </button>
        </div>
          {/* Outside the flow, so saying it cannot move the row. */}
          {decimalRefused && (
            <span
              role="status"
              aria-live="polite"
              className="absolute left-0 top-full z-20 mt-1 whitespace-nowrap rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-800"
              style={{ fontWeight: 500 }}
            >
              Whole units only. Serial-numbered {uom} go back whole.
            </span>
          )}
        </span>

        <button
          type="button"
          disabled={entered <= 0}
          onClick={confirm}
          className="inline-flex items-center justify-center h-8 rounded-lg px-3 text-[12px] bg-primary text-white transition-colors hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ fontWeight: 600 }}
        >
          Add
        </button>
        <button
          type="button"
          aria-label={`Stop adding ${sku}`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={close}
          className="flex w-8 h-8 items-center justify-center rounded-md border border-[#E2E8F0] text-slate-400 transition-colors hover:text-foreground"
        >
          <X className="w-3 h-3" />
        </button>
      </Slot>
    );
  }

  // ---- At rest ------------------------------------------------------------
  return qty > 0 ? (
    <Slot info={info}>
      <button
        type="button"
        aria-label={`Take ${sku} off the return`}
        onClick={() => onQty(0)}
        className="flex w-8 h-8 items-center justify-center rounded-md border border-[#E2E8F0] text-slate-400 transition-colors hover:text-foreground"
      >
        <X className="w-3 h-3" />
      </button>
      {/* The part is already answered, so adding to it is the quieter of the
          two actions on this row rather than the loud one. */}
      {left > 0 && (
        <button
          type="button"
          onClick={open}
          className="inline-flex items-center justify-center h-8 rounded-lg px-3 text-[12px] border border-slate-200 bg-white text-foreground transition-colors hover:bg-slate-50 whitespace-nowrap"
          style={{ fontWeight: 500 }}
        >
          Add more
        </button>
      )}
    </Slot>
  ) : (
    <Slot info={info}>
      <button
        type="button"
        onClick={open}
        className="inline-flex items-center justify-center gap-1.5 h-8 rounded-lg px-3.5 text-[12px] bg-primary text-white shadow-sm transition-colors hover:bg-blue-700"
        style={{ fontWeight: 600 }}
      >
        {/* Three icons that have to read as a set. A scan target for a named
            unit, strata for a lot, and a plain box for stock that is only
            counted. Stacked boxes sat too close to the strata to tell apart at
            14px, which is the size they are actually read at. */}
        {trackingMode && isLotMode(trackingMode) ? <Layers className="w-3.5 h-3.5" /> : <Package className="w-3.5 h-3.5" />}
        Add units
      </button>
    </Slot>
  );
}

/** The right-hand column, built the way the purchasing catalogue row builds it:
 *  what the part amounts to on top, what you can do about it underneath. A
 *  fixed floor on the width keeps the column straight down the list even though
 *  the three states are different widths. */
function Slot({ info, children }: { info?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="shrink-0 pl-10 flex flex-col items-end gap-2 min-w-[206px]">
      {info && <div className="flex items-center justify-end gap-1.5">{info}</div>}
      {children && <div className="flex items-center justify-end gap-2">{children}</div>}
    </div>
  );
}

/** What is still available to send back. The figure carries the weight; the
 *  unit stays quiet beside it, the same split the purchase-order row makes
 *  between a price and its per-unit tail.
 *
 *  It counts down as units are recorded, so the row always answers "how much of
 *  this can still go on the return" rather than restating a receipt the user
 *  has already drawn from. */
function Amount({ n, uom, over = false }: { n: number; uom: string; over?: boolean }) {
  return (
    <span
      className={`text-[13px] tabular-nums whitespace-nowrap flex items-center gap-1 ${
        over ? 'text-red-700' : 'text-foreground'
      }`}
      style={{ fontWeight: 600 }}
    >
      {over && <AlertTriangle className="w-3 h-3 shrink-0" />}
      {formatQty(n)}{' '}
      <span
        className={`text-[11px] ${over ? 'text-red-600' : 'text-slate-500'}`}
        style={{ fontWeight: 500 }}
      >
        {uom}
      </span>
    </span>
  );
}

/** What has been recorded so far, which stays on the row from the moment it is
 *  entered. The figure beside it is what is left, so without this the quantity
 *  the user actually typed would vanish the instant it took effect. */
function Added({ n, uom }: { n: number; uom: string }) {
  return (
    <span
      className="inline-flex items-center h-[20px] rounded-md bg-blue-50 border border-blue-100 px-1.5 text-[10px] text-primary tabular-nums whitespace-nowrap"
      style={{ fontWeight: 600 }}
    >
      {formatQty(n)} {uom} added
    </span>
  );
}
