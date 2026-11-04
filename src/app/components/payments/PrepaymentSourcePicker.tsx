import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { formatUsDate } from '@/app/lib/dueBucket';
import { Wallet, Check, ChevronDown, Lock, X } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/app/components/ui/dialog';
import { Checkbox } from '@/app/components/ui/checkbox';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/app/components/ui/tooltip';
import { HoverCard, HoverCardTrigger, HoverCardContent } from '@/app/components/ui/hover-card';
import { MoneyInput, MaxChip } from '@/app/components/payments/MoneyInput';

// Vendor-level prepayment source picker (feedback 7/22/26). When a
// vendor holds MULTIPLE on-account prepayment records, the user picks
// which record(s) to draw from and how much, instead of a blunt
// "apply all" toggle — so the system can track consumption per record
// (Unapplied → Partially applied → Fully applied). Advances anchored to
// a pre-invoice are NOT selectable here: they auto-apply to their own
// invoice. The drawn total still spreads across the invoices being paid
// oldest-due-first (that logic lives in the caller).
//
// The modal lists VENDOR-LEVEL (on-account) sources ONLY (8/28/26
// late): invoice-anchored advances auto-assign to their own invoice
// and are edited inline on that row, never in here.
//
// Rebuilt as a centered MODAL (7/24/26): the old anchored popover
// re-positioned itself (bottom → top) as rows expanded and "Apply
// available" left it open. Now it follows the Payment-method modal
// recipe: fixed size, ~2 source cards in view with the rest scrolling,
// Cancel reverts to the state it opened with, and both Apply actions
// close the modal.

export interface PrepaySource {
  id: string;
  /** e.g. "2024-1004" — plain number, no letter prefix (Eli 9/24). */
  label: string;
  date: string;
  /** Unapplied amount still available on this record. */
  remaining: number;
  /** Credit facts for the hover quick card (Jennifer 9/1/26): enough to
   *  answer "is this genuinely an open credit, or was it meant for a
   *  specific invoice and nobody made the link?" without leaving the
   *  step. All optional — callers without the full record skip the card. */
  original?: number;
  method?: string;
  memo?: string;
  appliedInvoices?: { invoiceNumber: string; amount: number }[];
  recordedBy?: string;
}

/** Credit quick card (Jennifer 9/1/26): hover any credit record to see
 *  what it is IN PLACE — recorded when and by whom, original amount,
 *  where the rest already went — so deciding "apply here or go fix its
 *  link" never costs your place in the run. */
export function CreditQuickCard({
  source,
  fmt,
  children,
}: {
  source: PrepaySource;
  fmt: (n: number) => string;
  children: ReactNode;
}) {
  const applied = source.original != null ? Math.round((source.original - source.remaining) * 100) / 100 : null;
  return (
    <HoverCard openDelay={300} closeDelay={120}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent
        side="top"
        align="start"
        sideOffset={8}
        className="w-[290px] p-0 rounded-xl border-0 shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden z-[400] bg-white"
      >
        <div className="px-4 py-3 flex items-center gap-3 border-b border-border/60">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: '#F3E8FF' }}>
            <Wallet className="w-[18px] h-[18px]" style={{ color: '#7E22CE' }} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] text-foreground truncate " style={{ fontWeight: 500 }}>{source.label}</p>
            <span
              className="inline-flex items-center mt-0.5 px-1.5 py-px rounded-full text-[10px]"
              style={{ fontWeight: 500, backgroundColor: '#F3E8FF', color: '#7E22CE' }}
            >
              Open Credit
            </span>
          </div>
        </div>
        <div className="p-3">
          <div className="rounded-lg bg-slate-50 px-3 py-2 space-y-1.5">
            <div className="flex items-center justify-between gap-2 text-[11.5px]">
              <span className="text-slate-500">Recorded</span>
              <span className="text-slate-700" style={{ fontWeight: 500 }}>
                {formatUsDate(source.date)}{source.recordedBy ? ` by ${source.recordedBy}` : ''}
              </span>
            </div>
            {source.method && (
              <div className="flex items-center justify-between gap-2 text-[11.5px]">
                <span className="text-slate-500">Method</span>
                <span className="text-slate-700" style={{ fontWeight: 500 }}>{source.method}</span>
              </div>
            )}
            {source.original != null && (
              <div className="flex items-center justify-between gap-2 text-[11.5px]">
                <span className="text-slate-500">Original Amount</span>
                <span className="text-slate-700 " style={{ fontWeight: 500 }}>{fmt(source.original)}</span>
              </div>
            )}
            {applied != null && applied > 0.004 && (
              <div className="flex items-center justify-between gap-2 text-[11.5px]">
                <span className="text-slate-500">Already Applied</span>
                <span className="text-slate-700 " style={{ fontWeight: 500 }}>{fmt(applied)}</span>
              </div>
            )}
            {(source.appliedInvoices ?? []).slice(0, 3).map((a) => (
              <div key={a.invoiceNumber} className="flex items-center justify-between gap-2 text-[11px] pl-2">
                <span className="text-slate-400 truncate ">{a.invoiceNumber}</span>
                <span className="text-slate-500 ">{fmt(a.amount)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between gap-2 text-[11.5px] pt-1 border-t border-slate-200/70">
              <span className="text-slate-500">Remaining</span>
              <span className="text-purple-700 " style={{ fontWeight: 600 }}>{fmt(source.remaining)}</span>
            </div>
            {source.memo && (
              <p className="text-[11px] text-slate-500 italic leading-snug pt-1 border-t border-slate-200/70">"{source.memo}"</p>
            )}
          </div>
          <p className="text-[10.5px] text-slate-400 leading-snug mt-2">
            On-account credit, not tied to any invoice. If it was meant for a specific invoice, apply it from the payment record and it drops out of this list.
          </p>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

interface PrepaymentSourcePickerProps {
  sources: PrepaySource[];
  /** paymentId → amount drawn in this run. */
  draws: Record<string, number>;
  /** The most the run can absorb (gross of the selected invoices). */
  maxTotal: number;
  /** Credit tied to a specific invoice, auto-applied (8/28/26): counted
   *  into the chip total and shown as the locked info line. */
  anchoredTotal: number;
  /** How many anchored records the auto-applied total spans. */
  anchoredCount?: number;
  onChange: (draws: Record<string, number>) => void;
  fmt: (n: number) => string;
  /** Bump to a new truthy value to open the modal from outside (the
   *  "Review prepayments" nudge routes here, 7/24/26). */
  openSignal?: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function PrepaymentSourcePicker({
  sources,
  draws,
  maxTotal,
  anchoredTotal,
  anchoredCount = 0,
  onChange,
  fmt,
  openSignal,
}: PrepaymentSourcePickerProps) {
  const [open, setOpen] = useState(false);
  // Snapshot on open so Cancel can revert live edits.
  const [snapshot, setSnapshot] = useState<Record<string, number>>({});

  const drawnTotal = useMemo(
    () => round2(Object.values(draws).reduce((s, v) => s + (v || 0), 0)),
    [draws],
  );
  const selectedCount = Object.values(draws).filter((v) => (v || 0) > 0.004).length;

  // Remaining headroom for a given source: the run can't draw more than
  // maxTotal across all sources, nor more than a source's own remaining.
  const headroomFor = (id: string) => {
    const others = round2(drawnTotal - (draws[id] || 0));
    return round2(Math.max(0, maxTotal - others));
  };

  // No silent capping (BA 8/12/26, matching the run's prepayment
  // stepper): the field keeps what the user typed; an over-max draw
  // turns red with a tooltip and a one-click fix. Apply stays locked
  // while any row is over, and closing the modal reverts over values.
  const maxDrawFor = (id: string, remaining: number) => round2(Math.min(remaining, headroomFor(id)));
  const setDraw = (id: string, raw: number) => {
    const amount = round2(Math.max(0, raw));
    const next = { ...draws };
    if (amount <= 0.004) delete next[id];
    else next[id] = amount;
    onChange(next);
  };

  const toggle = (id: string, remaining: number) => {
    if ((draws[id] || 0) > 0.004) {
      const next = { ...draws };
      delete next[id];
      onChange(next);
    } else {
      setDraw(id, maxDrawFor(id, remaining));
    }
  };

  const anyOver = sources.some((s) => (draws[s.id] || 0) > maxDrawFor(s.id, s.remaining) + 0.004);

  // Auto-fill oldest record first up to what the run can absorb.
  const autoFill = () => {
    let need = maxTotal;
    const next: Record<string, number> = {};
    for (const s of [...sources].sort((a, b) => a.date.localeCompare(b.date))) {
      if (need <= 0.004) break;
      const take = round2(Math.min(s.remaining, need));
      if (take > 0.004) {
        next[s.id] = take;
        need = round2(need - take);
      }
    }
    onChange(next);
  };

  const clearAll = () => onChange({});

  const active = drawnTotal > 0.004;
  // The chip totals INCLUDE the auto-applied anchored slice (8/28/26):
  // the card control reads the vendor's full applied prepayment.
  const shownTotal = round2(drawnTotal + anchoredTotal);
  const shownCount = selectedCount + anchoredCount;
  const chipActive = shownTotal > 0.004;

  const openModal = () => {
    setSnapshot(draws);
    setOpen(true);
  };
  const cancel = () => {
    onChange(snapshot);
    setOpen(false);
  };

  // External open (the "Review prepayments" nudge): each new signal value
  // opens the modal with a fresh Cancel snapshot.
  useEffect(() => {
    if (openSignal) openModal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openSignal]);

  return (
    <>
      {/* Prepayment purple (8/28/26): the chip matches the Prepayment
          type pill's identity everywhere, never amber. */}
      <button
        type="button"
        onClick={openModal}
        className={`inline-flex items-center gap-2 h-8 pl-1.5 pr-2.5 rounded-full border text-[12px] transition-colors cursor-pointer shrink-0 ${
          chipActive
            ? 'border-purple-300 bg-purple-50 text-purple-900 hover:bg-purple-100'
            : 'border-purple-300 bg-white text-purple-900 hover:bg-purple-50 hover:border-purple-400'
        }`}
        style={{ fontWeight: 600 }}
      >
        <span className="w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center shrink-0">
          <Wallet className="w-3 h-3" />
        </span>
        {chipActive ? (
          <span className="">
            {fmt(shownTotal)}
            <span className="text-purple-700" style={{ fontWeight: 500 }}> from {shownCount} credit memo{shownCount === 1 ? '' : 's'}</span>
          </span>
        ) : (
          'Apply Vendor Credit'
        )}
        <ChevronDown className="w-3.5 h-3.5 text-purple-500" />
      </button>

      <Dialog open={open} onOpenChange={(o) => { if (!o) { if (anyOver) onChange(snapshot); setOpen(false); } }}>
        <DialogContent
          showCloseButton={false}
          overlayClassName="z-[330]"
          className="!p-0 !gap-0 !bg-white overflow-hidden flex flex-col z-[340] w-[calc(100%-2rem)] sm:w-[620px] max-h-[85vh] rounded-2xl border-0"
          style={{ maxWidth: 'min(620px, calc(100vw - 2rem))', boxShadow: '0 24px 80px -12px rgba(0,0,0,0.25)' }}
        >
          <DialogTitle className="sr-only">Apply Vendor Credit</DialogTitle>
          <DialogDescription className="sr-only">Choose which vendor credit records to draw from for this payment.</DialogDescription>

          {/* Header — compact PURPLE gradient hero (8/28/26: prepayment's
              own identity, never amber), close X floating top-right. */}
          <div
            className="relative flex flex-col items-center pt-6 pb-3.5 shrink-0"
            style={{ background: 'linear-gradient(180deg, #F3E8FF 0%, rgba(243,232,255,0.3) 70%, transparent 100%)' }}
          >
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[200px] h-[80px] rounded-full opacity-25 pointer-events-none" style={{ backgroundColor: '#7E22CE', filter: 'blur(50px)' }} />
            <button
              type="button"
              onClick={() => { if (anyOver) onChange(snapshot); setOpen(false); }}
              className="absolute top-3 right-3 w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-white/70 transition-all cursor-pointer"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="relative w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#E9D5FF' }}>
              <Wallet className="w-6 h-6" style={{ color: '#7E22CE', strokeWidth: 2 }} />
            </div>
            <p className="mt-2.5 text-[17px] tracking-[-0.02em] text-foreground" style={{ fontWeight: 600, lineHeight: 1.3 }}>Apply vendor credit to this invoice?</p>
            {/* ONE copy family for every vendor-credit prompt (BA 9/25):
                the Record Payment interstitial's phrasing — who has how
                much, apply here or keep it. */}
            <p className="text-[12px] mt-0.5 mx-auto text-muted-foreground text-center px-8" style={{ lineHeight: 1.6, maxWidth: '440px' }}>
              This vendor has <span className="text-foreground" style={{ fontWeight: 600 }}>{fmt(round2(sources.reduce((s, x) => s + x.remaining, 0)))}</span> in vendor credit. Apply it here, or keep it for a later invoice.
            </p>
          </div>

          {/* Sources — single-row cards with the amount inline on the right
              (7/24/26): typing an amount selects the record, the checkbox
              toggles the full draw. Every card shows at once; the list only
              scrolls when the modal hits the viewport height. */}
          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-3 space-y-1.5 bg-slate-50/40">
            {sources.length === 0 ? (
              <p className="px-2 py-8 text-[12px] text-slate-400 text-center">No vendor credit available for this vendor.</p>
            ) : (
              sources.map((s) => {
                const drawn = draws[s.id] || 0;
                const checked = drawn > 0.004;
                const cap = maxDrawFor(s.id, s.remaining);
                const over = drawn > cap + 0.004;
                return (
                  <div
                    key={s.id}
                    className={`rounded-lg border pl-3 pr-2.5 py-2 transition-colors cursor-pointer ${
                      over
                        ? 'border-rose-300 bg-rose-50/40'
                        : checked
                          ? 'border-purple-300 bg-purple-50/60'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                    onClick={() => toggle(s.id, s.remaining)}
                  >
                    <div className="flex items-center gap-2.5">
                      <Checkbox checked={checked} onCheckedChange={() => toggle(s.id, s.remaining)} onClick={(e) => e.stopPropagation()} />
                      {/* Record number leads, BLACK, hover reveals the link
                          it is (blue + underline). The "Credit memo" type
                          pill is GONE (BA 9/25): these rows are advances,
                          the pill mislabeled them — the number and the
                          purple left-chip say everything. */}
                      <div className="min-w-0 flex-1">
                        <a
                          href={`/payments-v2/${encodeURIComponent(s.label)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="block text-[12px] text-foreground truncate hover:text-primary hover:underline transition-colors"
                          style={{ fontWeight: 600 }}
                        >
                          {s.label}
                        </a>
                        <p className="text-[10px] text-slate-400 mt-0.5">Recorded {formatUsDate(s.date)}</p>
                      </div>
                      {/* Dynamic remaining (Eli 7/22/26): the "left" reflects the
                          advance's balance AFTER this run's draw. Hovering this
                          NUMBER opens the credit quick card (user 9/9: it used
                          to fire from the whole label and got in the way) —
                          purple, matching the credit identity, not grey. */}
                      <CreditQuickCard source={s} fmt={fmt}>
                        <span className="shrink-0 inline-flex items-center rounded-full bg-purple-50 text-purple-700 border border-purple-200 text-[10px] px-2 py-0.5 cursor-help" style={{ fontWeight: 600 }}>
                          {fmt(round2(Math.max(0, s.remaining - drawn)))} left
                        </span>
                      </CreditQuickCard>
                      <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                        {/* Over-max warning (BA 8/12/26): never silently
                            snap the typed value; go red with a tooltip and
                            leave the fix to the user. */}
                        <Tooltip open={over ? undefined : false}>
                          <TooltipTrigger asChild>
                            <div className="relative w-[136px]">
                              <span className={`absolute left-2 top-1/2 -translate-y-1/2 text-[11px] ${over ? 'text-rose-400' : 'text-slate-400'}`}>$</span>
                              <MoneyInput
                                fluid
                                value={drawn}
                                onValueChange={(n) => setDraw(s.id, n)}
                                placeholder="0.00"
                                className={`flex h-8 w-full min-w-0 rounded-md border bg-white pl-5 pr-11 py-1 text-[11px] outline-none transition-[color,box-shadow] focus-visible:ring-[3px] ${
                                  over
                                    ? 'border-rose-400 text-rose-600 focus-visible:border-rose-500 focus-visible:ring-rose-100'
                                    : checked
                                      ? 'border-purple-300 focus-visible:border-ring focus-visible:ring-ring/50'
                                      : 'border-slate-200 focus-visible:border-ring focus-visible:ring-ring/50'
                                }`}
                              />
                              {/* Inset Max chip (user 9/9): the shared
                                  fill-to-cap control, inside the field
                                  like modern amount inputs. */}
                              <MaxChip
                                onClick={() => setDraw(s.id, cap)}
                                atMax={drawn >= cap - 0.004}
                                over={over}
                                title={`Fill to ${fmt(cap)}`}
                              />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="z-[400] max-w-[250px] p-2.5 bg-white border border-border rounded-lg shadow-md">
                            <p className="text-[11px] text-rose-600" style={{ fontWeight: 600 }}>Exceeds the max draw</p>
                            <p className="text-[11px] text-slate-600 mt-1 leading-snug ">
                              Left on this advance: {fmt(s.remaining)}.<br />
                              This payment can take: {fmt(cap)}.
                            </p>
                            <p className="text-[11px] text-slate-400 mt-1 leading-snug">Lower the amount, or use Max.</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer — matches the run's prepayment stepper (8/12/26): the
              "Applying" readout is gone, the Apply button carries the live
              amount; Cancel reverts, the primary applies and CLOSES
              (auto-fill when nothing is drawn yet). */}
          {/* Anchored-advance footnote, reconciliation model (Eli,
              8/31/26): pre-invoice prepayments apply at invoice creation. */}
          <p className="px-4 sm:px-5 pt-2.5 text-[11px] text-slate-400 text-center shrink-0" style={{ fontWeight: 500 }}>
            Prepayments made against a pre-invoice apply when the invoice is created, not here.
          </p>
          <div className="px-4 sm:px-5 py-3 border-t border-slate-100 flex items-center justify-between gap-2 bg-white shrink-0">
            <div className="flex items-center gap-1.5 text-[12px]">
              {active && (
                <button type="button" onClick={clearAll} className="text-[11px] text-slate-400 hover:text-red-500 cursor-pointer" style={{ fontWeight: 500 }}>
                  Clear
                </button>
              )}
            </div>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={cancel}
                className="h-9 px-4 rounded-lg border border-border bg-white text-[13px] text-muted-foreground hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer"
                style={{ fontWeight: 500 }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!active) autoFill();
                  setOpen(false);
                }}
                disabled={sources.length === 0 || (maxTotal <= 0.004 && !active) || anyOver}
                className="inline-flex items-center gap-1 h-9 px-4 rounded-lg bg-primary text-white text-[13px] hover:bg-primary/90 transition-colors cursor-pointer disabled:opacity-40 shadow-sm"
                style={{ fontWeight: 600 }}
              >
                <Check className="w-3.5 h-3.5" />
                {active ? `Apply ${fmt(drawnTotal)}` : 'Apply Selected'}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
