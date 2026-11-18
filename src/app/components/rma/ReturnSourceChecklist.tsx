/**
 * The resolving step's answer, as one checklist.
 *
 * Ported from the cycle count planner's Configure step, whose detail pane is a
 * flat list of the places a count will happen: one row per location, a
 * checkbox to include it, the quantity stated as a fact rather than typed, and
 * a units button on the rows that are serialized. The total is derived into
 * the header rather than being another thing to fill in.
 *
 * A receiving document is to a return what a location is to a count: the
 * source the units are coming off. So the same shape answers the return, and
 * answering it settles the vendor at the same time -- a delivery knows who
 * sent it, so ticking the delivery names the vendor. That is what collapses
 * the two columns this replaced. `Goes back to` was only ever a restatement of
 * what the ticked rows already said, and asking it separately made a counted
 * part and a serialized part look like two different jobs when they are one.
 *
 * Two things the count planner has no need of.
 *
 * A figure to satisfy: its quantity is whatever is on the shelf and so is
 * right by construction, where a return's comes from the first step and can
 * fall short. That is the header badge.
 *
 * And a fold. An item lives in three or four locations, so the planner can
 * list them all; a part has been delivered a hundred times, and listing those
 * put a hundred rows on the screen the step exists to shorten. So the list is
 * the deliveries in use plus the few most recent, and the rest are a click
 * away. A serialized line folds all the way down: its rows are derived from
 * the units named, so before any are named there is nothing to show and the
 * only thing on offer is the picker.
 */

import { type TrackingMode } from '@/app/data/itemProvenance';
import { useState, type ReactNode } from 'react';
import { FileText, Barcode, Building2, Link2Off, ChevronDown } from 'lucide-react';
import { Checkbox } from '@/app/components/ui/checkbox';
import { Switch } from '@/app/components/ui/switch';
import { formatQty } from '@/app/components/vendorSelectionModel';

/** One delivery of this part: a row on the checklist. */
export interface ChecklistSource {
  grnNumber: string;
  poNumber: string;
  /** Received on. Blank where the provenance record has no date. */
  date: string;
  vendorCode: string;
  vendorName: string;
  /** What the delivery brought in, which is the ceiling for its share. */
  available: number;
  /** How much of the return comes off it. Zero means it is not in use. */
  taken: number;
  /** Serialized lines only: the units named against this delivery. */
  serials?: string[] | undefined;
}

export function ReturnSourceChecklist({
  uom,
  qty,
  trackingMode,
  sources,
  untied,
  onToggle,
  onToggleAll,
  onOpenUnits,
  onUntied,
  footer,
}: {
  uom: string;
  /** What the first step said is coming back. The figure to satisfy. */
  qty: number;
  trackingMode: TrackingMode;
  sources: ChecklistSource[];
  untied: boolean;
  onToggle: (grnNumber: string, on: boolean) => void;
  onToggleAll: (on: boolean) => void;
  /** Serialized only: name the units coming off one delivery. */
  onOpenUnits: (grnNumber: string) => void;
  onUntied: (next: boolean) => void;
  /** The way out for a return with no delivery to point at. */
  footer?: ReactNode | undefined;
}) {
  const [showAll, setShowAll] = useState(false);
  const serialized = trackingMode === 'serialized';
  const inUse = sources.filter((s) => s.taken > 0);
  const named = inUse.reduce((n, s) => n + s.taken, 0);
  const short = Math.round((qty - named) * 100) / 100;
  const settled = untied || short === 0;
  const allOn = sources.length > 0 && sources.every((s) => s.taken > 0);

  /** What the list shows. A serialized line shows only what its units point
   *  at, because nothing else is a candidate: the unit decides, not the user.
   *  A counted line shows what is in use and the few most recent besides,
   *  since a return comes off the last delivery far more often than the
   *  fortieth. */
  const RECENT = 4;
  const spare = sources.filter((row) => row.taken === 0);
  const shown = serialized
    ? inUse
    : showAll
      ? sources
      : [...inUse, ...spare.slice(0, Math.max(0, RECENT - inUse.length))].sort(
          (a, b) => (b.date ?? '').localeCompare(a.date ?? ''),
        );
  const hidden = sources.length - shown.length;

  return (
    <div className="overflow-hidden rounded-2xl border border-[#E8ECF1] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      {/* What is being asked, and how far off the answer is. The figure is the
          return's own count, so the row it lands on is the one the user typed
          on the first step. */}
      <div className="flex items-start justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="inline-flex w-8 h-8 shrink-0 items-center justify-center rounded-lg border border-blue-200 bg-[#DBEAFE]">
            <FileText className="w-3.5 h-3.5 text-primary" />
          </span>
          <div className="min-w-0">
            <p className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>
              Where these came from
            </p>
            <p className="text-[11px] text-slate-500 mt-px">
              {serialized
                ? 'Name the units. Each one carries the delivery and the vendor with it.'
                : 'Tick the deliveries these are coming off. The vendor comes with them.'}
            </p>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="tabular-nums leading-none">
            <span
              className={`text-[20px] ${settled ? 'text-emerald-700' : 'text-slate-300'}`}
              style={{ fontWeight: 700 }}
            >
              {formatQty(named)}
            </span>
            <span className="text-[13px] text-slate-400" style={{ fontWeight: 600 }}>
              {' '}
              / {formatQty(qty)}
            </span>
            <span className="ml-1 text-[11px] text-slate-500" style={{ fontWeight: 500 }}>
              {uom}
            </span>
          </p>
          <p
            className={`mt-1 text-[11px] tabular-nums ${
              settled ? 'text-slate-500' : 'text-amber-700'
            }`}
            style={{ fontWeight: settled ? 500 : 600 }}
          >
            {untied
              ? 'Going back untied'
              : short > 0
                ? `${formatQty(short)} ${uom} still to name`
                : short < 0
                  ? `${formatQty(-short)} ${uom} over`
                  : 'All named'}
          </p>
        </div>
      </div>

      {/* Take the lot, or send it back with nothing to unwind. Both are one
          gesture because both are common: most returns come off the last
          delivery or two, and a return of stock nobody can place has to be
          able to leave anyway. */}
      <div className="flex items-center justify-between gap-2 border-y border-[#F1F5F9] bg-[#FAFBFC] px-4 py-2">
        {serialized ? (
          <>
            <span className="min-w-0 truncate text-[11px] text-slate-500">
              {inUse.length === 0
                ? 'Nothing named yet.'
                : `Off ${inUse.length} ${inUse.length === 1 ? 'delivery' : 'deliveries'}.`}
            </span>
            <button
              type="button"
              onClick={() => onOpenUnits('')}
              className="inline-flex shrink-0 items-center gap-1 h-6 px-2 rounded-md text-[11px] text-primary transition-colors hover:bg-primary/5"
              style={{ fontWeight: 600 }}
            >
              <Barcode className="w-3 h-3" />
              {inUse.length === 0 ? 'Name the units' : 'Change the units'}
            </button>
          </>
        ) : (
          <>
            <label className="flex min-w-0 items-center gap-2">
              <Switch
                checked={allOn}
                onCheckedChange={(on) => onToggleAll(on === true)}
                disabled={untied || sources.length === 0}
                aria-label="Use every delivery"
                className="scale-[0.8]"
              />
              <span className="truncate text-[11px] text-slate-500" style={{ fontWeight: 600 }}>
                Use every delivery
              </span>
            </label>
            <button
              type="button"
              onClick={() => onUntied(!untied)}
              className={`inline-flex shrink-0 items-center gap-1 h-6 px-2 rounded-md text-[11px] transition-colors ${
                untied ? 'text-primary bg-primary/10' : 'text-slate-500 hover:bg-slate-100'
              }`}
              style={{ fontWeight: 600 }}
            >
              <Link2Off className="w-3 h-3" />
              {untied ? 'Tied to nothing' : 'Send it untied'}
            </button>
          </>
        )}
      </div>

      {/* The rows. Newest first, because a return comes off the last delivery
          far more often than the first. */}
      {shown.length === 0 ? (
        <div className="flex flex-col items-center gap-1 border-t border-[#F1F5F9] px-4 py-8 text-center">
          {serialized ? (
            <>
              <Barcode className="w-5 h-5 text-slate-300" />
              <p className="text-[12px] text-foreground" style={{ fontWeight: 600 }}>
                {formatQty(qty)} {uom} to name
              </p>
              <p className="max-w-[300px] text-[11px] text-slate-500">
                Pick the units coming back. Each one knows which delivery it arrived on and who
                sent it, so naming them answers the rest of this line.
              </p>
              <button
                type="button"
                onClick={() => onOpenUnits('')}
                className="mt-2 inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary text-[12px] text-white shadow-sm transition-colors hover:bg-blue-700"
                style={{ fontWeight: 600 }}
              >
                <Barcode className="w-3.5 h-3.5" />
                Name the units
              </button>
            </>
          ) : (
            <>
              <Building2 className="w-5 h-5 text-slate-300" />
              <p className="text-[12px] text-foreground" style={{ fontWeight: 600 }}>
                No delivery of this part on file
              </p>
              <p className="max-w-[280px] text-[11px] text-slate-500">
                Nothing in {uom} came in against it, so there is no document for the credit to
                reverse. Name who is taking it back and send it untied.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className={`flex flex-col ${untied ? 'opacity-40 pointer-events-none' : ''}`}>
          {shown.map((source) => {
            const on = source.taken > 0;
            return (
              <div
                key={source.grnNumber}
                className={`flex items-center gap-2.5 border-t border-[#F1F5F9] px-4 py-2.5 transition-colors ${
                  on ? 'bg-primary/[0.04]' : 'bg-white'
                }`}
              >
                <Checkbox
                  checked={on}
                  onCheckedChange={(next) => onToggle(source.grnNumber, next === true)}
                  aria-label={`Take ${source.grnNumber} off this return`}
                />
                <span
                  className={`inline-flex w-7 h-7 shrink-0 items-center justify-center rounded-md border ${
                    on ? 'border-primary/30 bg-blue-50 text-primary' : 'border-[#EEF2F6] bg-slate-50 text-slate-400'
                  }`}
                >
                  <FileText className="w-3 h-3" />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-1.5">
                    <span className="truncate text-[13px] text-foreground" style={{ fontWeight: 600 }}>
                      {source.grnNumber}
                    </span>
                    <span className="shrink-0 text-[10px] text-slate-400 whitespace-nowrap">
                      {source.date ? `${source.date} · ` : ''}PO {source.poNumber}
                    </span>
                  </div>
                  {/* The vendor rides on the document, which is the whole
                      reason this step no longer asks for one. */}
                  <p className="truncate text-[11px] text-slate-500 mt-px">{source.vendorName}</p>
                </div>

                {serialized ? (
                  <button
                    type="button"
                    onClick={() => onOpenUnits(source.grnNumber)}
                    aria-label={`Name the ${source.grnNumber} units`}
                    className={`inline-flex shrink-0 items-center gap-1 h-7 px-2 rounded-md text-[11px] tabular-nums transition-colors ${
                      on ? 'text-primary hover:bg-primary/10' : 'text-slate-500 hover:bg-slate-100'
                    }`}
                    style={{ fontWeight: 600 }}
                  >
                    <Barcode className="w-3 h-3" />
                    {formatQty(source.taken)} / {formatQty(source.available)} units
                  </button>
                ) : (
                  <span className="shrink-0 text-right tabular-nums whitespace-nowrap">
                    <span
                      className={`text-[13px] ${on ? 'text-foreground' : 'text-slate-400'}`}
                      style={{ fontWeight: 600 }}
                    >
                      {on ? formatQty(source.taken) : formatQty(source.available)}
                    </span>
                    <span className="ml-1 text-[10px] text-slate-500" style={{ fontWeight: 500 }}>
                      {uom}
                    </span>
                    {/* What the row could still absorb, so a short return
                        says where the rest can come from. */}
                    {on && source.taken < source.available && (
                      <span className="block text-[10px] text-slate-400" style={{ fontWeight: 500 }}>
                        of {formatQty(source.available)}
                      </span>
                    )}
                  </span>
                )}
              </div>
            );
          })}

          {/* The rest of the part's history, which is long and almost never
              what the return came off. */}
          {!serialized && (hidden > 0 || showAll) && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="flex items-center justify-center gap-1 border-t border-[#F1F5F9] px-4 py-2 text-[11px] text-slate-500 transition-colors hover:bg-slate-50 hover:text-primary"
              style={{ fontWeight: 600 }}
            >
              <ChevronDown className={`w-3 h-3 transition-transform ${showAll ? 'rotate-180' : ''}`} />
              {showAll ? 'Show the recent ones only' : `Show ${hidden} older ${hidden === 1 ? 'delivery' : 'deliveries'}`}
            </button>
          )}
        </div>
      )}

      {footer && (
        <div className="border-t border-[#F1F5F9] bg-[#FAFBFC] px-4 py-2">{footer}</div>
      )}
    </div>
  );
}
