/**
 * Whose units are going back, on the step that names them.
 *
 * Ported from the count planner's Configure step
 * (`cycle-count/_components/create/StepConfigure.tsx`): an item card with one
 * row per place its stock sits, each row carrying a checkbox, a name, an
 * address, and on the right a `3 / 12 units` button that opens the units
 * themselves in a modal. A return has no locations to visit, but it has the
 * thing every serial already knows: the vendor it came back through.
 *
 * So a serialized line reads as four or five vendor rows rather than nine
 * hundred serials, and the serials open behind the row that owns them.
 *
 * One rule governs the list. The first unit picked settles who the return is
 * with, because an RMA is raised against one vendor and credited by them, so
 * every other row goes quiet until those picks are dropped. Vendor invoicing
 * behaves the same way.
 */

import { ArrowUpRight, Barcode, Building2, Check, Lock, Minus, Plus } from 'lucide-react';

import { formatQty } from '@/app/components/vendorSelectionModel';
import { vendorAddress } from '@/app/data/mockVendors';
import type { TrackingMode } from '@/app/data/mockRMAs';
import { possessive } from '@/app/lib/possessive';

export interface SerialVendorRow {
  vendorCode: string;
  vendorName: string;
  /** Every unit of this line that came back through them. */
  total: number;
  /** What is free to return: their units less anything allocated elsewhere. */
  available: number;
  /** How many of their units this line is already taking. */
  picked: number;
  /** No receipt on file names them for this part. The return can still go to
   *  them -- one bolt is any bolt -- and the row says so rather than quoting
   *  a shelf figure it does not have. */
  noHistory?: boolean;
}

export function ReturnSerialVendors({
  rows,
  need,
  named,
  uom,
  lockedVendor,
  lockedVendorName,
  lockNote,
  heading,
  subheading,
  figureCaption,
  countsUnits = true,
  onFill,
  onClear,
  onOpen,
  onCreateVendor,
}: {
  rows: SerialVendorRow[];
  /** What the line said it is returning. */
  need: number;
  /** How much of that is named. */
  named: number;
  uom: string;
  /** The vendor the return is committed to, or null while nothing is picked. */
  lockedVendor: string | null;
  /** Their name, for the sentence that stands where the list would be. */
  lockedVendorName?: string | null | undefined;
  /** Why the rest of the list is closed, for the rows that are closed. The
   *  serials say it themselves; a plain line is being told what another line
   *  decided, so it has to be told where that came from. */
  lockNote?: string | undefined;
  /** What the card is asking, where the default is not what it is asking.
   *  A plain lot line asks it after the batches, of the suppliers who sent
   *  them, which is a narrower question than "select the vendor". */
  heading?: string | undefined;
  subheading?: string | undefined;
  /** What the figure on the right of each row means, where it is not the
   *  vendor's returnable total. */
  figureCaption?: string | undefined;
  /** Whether the row opens onto units. Plain stock has none: one bolt is any
   *  bolt, so the row is the whole answer and there is nothing behind it. */
  countsUnits?: boolean;
  /** Take what the line still needs from this vendor, top down. */
  onFill: (vendorCode: string) => void;
  /** Give back everything taken from this vendor. */
  onClear: (vendorCode: string) => void;
  /** Open their units and choose by hand. */
  onOpen: (vendorCode: string) => void;
  /** Opens partner creation. The vendor step carried this under its list and
   *  the rows replaced the step, which took the way out with it: a part whose
   *  supplier the master does not carry had nowhere to go. */
  onCreateVendor?: (() => void) | undefined;
}) {
  const short = Math.round((need - named) * 100) / 100;
  /** Placed, but not with the vendor the return is with. A green "placed"
   *  chip over a row the band above has just called wrong said the line was
   *  settled when it is the one thing holding the step. */
  const misplaced =
    !!lockedVendor && rows.some((r) => r.picked > 0 && r.vendorCode !== lockedVendor);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-white shadow-sm">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-muted bg-white px-4 py-3">
        <div className="min-w-0">
          <h3 className="text-sm text-foreground" style={{ fontWeight: 600 }}>
            {heading ?? (countsUnits ? 'Select the vendor and its units' : 'Select the vendor')}
          </h3>
          <p className="truncate text-[11px] text-slate-500">
            {subheading ??
              (countsUnits
                ? 'A serial carries the vendor it came back through, so choosing units chooses the vendor.'
                : lockedVendor
                  ? 'One return goes back to one vendor, and another line on it has already named them.'
                  : "Non-serialized items don't record their vendor. Choose who this goes back to.")}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
        <span
          className={`shrink-0 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] tabular-nums ${
            misplaced
              ? 'border-amber-200 bg-amber-50 text-amber-800'
              : need > 0 && short === 0
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-[#E8ECF1] bg-slate-50 text-slate-600'
          }`}
          style={{ fontWeight: 600 }}
        >
          {misplaced
            ? 'With another vendor'
            : countsUnits
              ? `${formatQty(named)} of ${formatQty(need)} ${uom} selected`
              : named > 0
                ? `${formatQty(need)} ${uom} placed`
                : lockedVendor
                  ? `${formatQty(need)} ${uom} to place`
                  : 'No vendor yet'}
        </span>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3">
        {rows.length === 0 && (
          <p className="px-3 py-6 text-center text-[12px] text-slate-500">
            No receipt on file names a vendor for these units.
          </p>
        )}

        {rows.map((row) => {
          const mine = !lockedVendor || row.vendorCode === lockedVendor;
          const full = row.picked > 0 && row.picked >= Math.min(need, row.available);
          return (
            <div
              key={row.vendorCode}
              className={`flex items-center gap-2.5 rounded-md border px-3 py-2.5 transition-colors ${
                row.picked > 0
                  ? // Picked, and not who the return is with. It is the line's
                    // problem rather than its answer, and drawn in blue it
                    // read as the one row that was settled.
                    mine
                    ? 'border-primary/40 bg-blue-50/50'
                    : 'border-amber-300 bg-amber-50/70'
                  : mine
                    ? 'border-[#E8ECF1] bg-white hover:border-primary/25'
                    : 'border-slate-200 bg-slate-50/70'
              }`}
              title={
                mine
                  ? undefined
                  : lockNote ??
                    'These came from a different vendor. Deselect the current vendor’s serials to choose these instead.'
              }
            >
              {/* Ticking takes what the line still needs from them, which is
                  the answer somebody wanting this vendor is after. Which units
                  exactly is the button beside it. */}
              <button
                type="button"
                disabled={!mine || row.available === 0}
                aria-label={
                  row.picked > 0
                    ? `Take nothing from ${row.vendorName}`
                    : `Return ${formatQty(Math.min(short > 0 ? short : need, row.available))} ${uom} from ${row.vendorName}`
                }
                onClick={() => (row.picked > 0 ? onClear(row.vendorCode) : onFill(row.vendorCode))}
                className={`flex w-[18px] h-[18px] shrink-0 items-center justify-center rounded ${
                  !mine
                    ? 'cursor-not-allowed border-[1.5px] border-slate-200 bg-white text-slate-300'
                    : full
                      ? 'bg-primary text-white'
                      : row.picked > 0
                        ? 'bg-primary text-white'
                        : 'border-[1.5px] border-border bg-white'
                }`}
              >
                {!mine ? (
                  <Lock className="w-2.5 h-2.5" />
                ) : full ? (
                  <Check className="w-3 h-3" />
                ) : row.picked > 0 ? (
                  <Minus className="w-3 h-3" />
                ) : null}
              </button>

              {/* A tile, not a loose glyph. Beside a two-line name the bare
                  icon floated between the tick and the text with nothing to
                  sit on. */}
              <span
                className={`flex w-8 h-8 shrink-0 items-center justify-center rounded-md ${
                  mine ? 'bg-blue-50 text-primary' : 'border border-slate-200 bg-white text-slate-400'
                }`}
              >
                <Building2 className="w-4 h-4" />
              </span>

              <div className="min-w-0 flex-1">
                <p className="flex min-w-0 items-center gap-1.5">
                  <span
                    className={`truncate text-[13px] ${mine ? 'text-foreground' : 'text-slate-500'}`}
                    style={{ fontWeight: 600 }}
                  >
                    {row.vendorName}
                  </span>
                  {row.noHistory && (
                    <span
                      className="inline-flex shrink-0 items-center rounded border border-amber-200 bg-amber-50 px-1.5 text-[10px] uppercase tracking-wide text-amber-700"
                      style={{ fontWeight: 600 }}
                    >
                      No receipt
                    </span>
                  )}
                </p>
                {vendorAddress(row.vendorCode) ? (
                  <p className="truncate text-[11px] text-slate-500">
                    {vendorAddress(row.vendorCode)}
                  </p>
                ) : (
                  <p className="truncate text-[11px] text-slate-400">{row.vendorCode}</p>
                )}
              </div>

              {countsUnits ? (
              <button
                type="button"
                disabled={!mine}
                onClick={() => onOpen(row.vendorCode)}
                aria-label={`Choose which of ${possessive(row.vendorName)} units are going back`}
                className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-[12px] transition-colors ${
                  !mine
                    ? 'cursor-not-allowed border-slate-200 bg-white text-slate-300'
                    : row.picked > 0
                      ? 'border-primary/30 bg-white text-primary'
                      : 'border-[#E8ECF1] bg-white text-slate-600 hover:border-primary/25'
                }`}
                style={{ fontWeight: 600 }}
              >
                <Barcode className="w-3.5 h-3.5" />
                {row.picked > 0
                  ? `${row.picked} of ${row.available} selected`
                  : `${row.available} units`}
              </button>
              ) : (
                // Nothing to open. What the row has to say is how much of the
                // part they can take back at all.
                <span className="shrink-0 pl-3 text-right">
                  <span
                    className="block text-[13px] text-slate-600 tabular-nums whitespace-nowrap"
                    style={{ fontWeight: 600, letterSpacing: '-0.01em' }}
                  >
                    {formatQty(row.picked > 0 ? row.picked : row.available)} {uom}
                  </span>
                  <span className="mt-0.5 block text-[10px] leading-tight text-slate-400">
                    {row.picked > 0
                      ? 'going back to them'
                      : row.noHistory
                        ? 'returning without a receipt'
                        : (figureCaption ?? 'available to return')}
                  </span>
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Under the list, as the vendor step had it: the hint on the left and
          the way out on the right. A vendor the master does not carry is a
          partner record that does not exist yet, not a name typed onto this
          return, so it goes to partner creation in its own tab and the return
          keeps its place. */}
      {onCreateVendor && !lockedVendor && (
        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-[#F1F5F9] bg-[#FAFBFC] px-4 py-2">
          <span className="text-[11px] text-slate-500">
            {rows.length === 0
              ? 'No vendor on file has shipped this item.'
              : 'Not one of these? Add a new vendor.'}
          </span>
          <button
            type="button"
            onClick={onCreateVendor}
            className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2.5 text-[12px] text-primary transition-colors hover:bg-blue-100"
            style={{ fontWeight: 600 }}
          >
            <Plus className="w-3 h-3" />
            Add a new vendor
            <ArrowUpRight className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Only where units are being counted out one by one.
          
          A plain line places its whole figure with one tick, so the strip
          under the list was a running total of a count nobody is keeping: the
          chip at the top already says how much is placed, and the card that
          places it is an inch away. */}
      {countsUnits && need > 0 && short !== 0 && (
        <div className="shrink-0 border-t border-amber-100 bg-amber-50 px-4 py-2.5">
          <p className="text-[12px] text-amber-800">
            {short > 0
              ? `${formatQty(short)} ${uom} still to select. Take more from this vendor, or open their units and choose.`
              : `${formatQty(-short)} ${uom} more is selected than this line is returning.`}
          </p>
        </div>
      )}
    </div>
  );
}


/**
 * A plain line, waiting on the lines that can answer for it.
 *
 * The return goes back to one vendor, and the narrowest definition names it:
 * a serial carries the receipt it arrived on, a batch carries the delivery.
 * Plain stock carries nothing, so it cannot be asked first without asking it
 * to guess at an answer the units are about to give.
 */
export function PlainLineHeld({
  sku,
  mode,
  onGo,
}: {
  /** The controlled line that still has to be answered. */
  sku: string;
  mode: TrackingMode;
  onGo: () => void;
}) {
  const what =
    mode === 'serialized'
      ? 'serial numbers'
      : mode === 'lot-serialized'
        ? 'lots and serial numbers'
        : 'lots';
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-white shadow-sm">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-muted bg-white px-4 py-3">
        <div className="min-w-0">
          <h3 className="text-sm text-foreground" style={{ fontWeight: 600 }}>
            Select the vendor
          </h3>
          <p className="truncate text-[11px] text-slate-500">
            Non-serialized items don&apos;t record their vendor. Choose who this goes back to.
          </p>
        </div>
        <span
          className="shrink-0 whitespace-nowrap rounded-full border border-[#E8ECF1] bg-slate-50 px-2.5 py-1 text-[11px] text-slate-600"
          style={{ fontWeight: 600 }}
        >
          Waiting on {sku}
        </span>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 py-12 text-center">
        <span className="flex w-11 h-11 items-center justify-center rounded-full bg-blue-50 text-primary">
          <Lock className="w-5 h-5" />
        </span>
        <div className="max-w-[420px]">
          <p className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>
            {sku} answers this first
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-slate-500">
            Its {what} name the vendor they came back through, and that vendor is the one this
            whole return is raised against. Answer {sku}, and this line goes back to the same
            vendor.
          </p>
        </div>
        <button
          type="button"
          onClick={onGo}
          className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-[12px] text-primary-foreground transition-opacity hover:opacity-90"
          style={{ fontWeight: 600 }}
        >
          Open {sku}
        </button>
      </div>
    </div>
  );
}


