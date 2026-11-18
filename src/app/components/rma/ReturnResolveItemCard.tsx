/**
 * Where a counted part goes back to, and what the return unwinds.
 *
 * A serialized unit names its own vendor: the serial was on a receiver and the
 * receiver was against an order. A counted part cannot. One bolt is any bolt,
 * so no system can say which delivery a given unit came off -- but the return
 * still has to name somebody, and it may have to name more than one: four
 * hundred going back where the likeliest vendor only ever delivered three
 * hundred is two vendors, not an error.
 *
 * Two questions, so two columns, in the line sheet's own sections. Who takes
 * it leads, because nothing else can be answered until it is. What the credit
 * unwinds sits beside it, grouped under the vendor whose deliveries they are:
 * they used to be folded inside each vendor row, which made the row tall
 * enough to push the second vendor off the screen and buried the thing the
 * step exists to decide.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { stockSplit } from '@/app/data/itemProvenance';
import {
  AlertCircle,
  AlertTriangle,
  Building2,
  FileText,
  Link2Off,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/app/components/ui/popover';
import { formatQty } from '@/app/components/vendorSelectionModel';
import { hasSerials, trackingModeFor } from '@/app/data/itemTracking';
import { QtyUomField } from '@/app/components/rma/QtyUomField';
import { ResolveSection, SectionAction } from '@/app/components/rma/ReturnResolvePane';
import type { ItemReceiver } from '@/app/data/itemProvenance';

export interface VendorCandidate {
  vendorCode: string;
  vendorName: string;
  /** Everything they have ever delivered of this part: the ceiling on what can
   *  be tied to them, and on what they will credit. */
  lifetime: number;
  /** And what they delivered lately, which is the better guess. */
  recent: number;
  shipped: boolean;
}

export interface VendorShare {
  vendorCode: string;
  vendorName: string;
  qty: number;
  cap: number;
  /** Whether they have ever delivered this part. When they have not, the cap
   *  is not a ceiling of theirs and there is no delivery to unwind. */
  shipped: boolean;
  receivers: ItemReceiver[];
  ties: Record<string, number>;
  untied: boolean;
  /** Other branches of the same company that delivered this part and are not
   *  on the return yet. A branch is its own vendor with its own receivers, so
   *  when one cannot cover a share the answer is usually next door. */
  siblings: { vendorCode: string; vendorName: string; lifetime: number }[];
}

const money = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function ReturnResolveItemCard({
  sku,
  uom,
  unitPrice,
  qty,
  shares,
  candidates,
  onQty,
  onAddVendor,
  onCreateVendor,
  onRemoveVendor,
  onToggleTie,
  onUntied,
}: {
  sku: string;
  uom: string;
  unitPrice: number;
  qty: number;
  shares: VendorShare[];
  /** Everyone who could take it: those who delivered it, then everyone else. */
  candidates: VendorCandidate[];
  onQty: (vendorCode: string, qty: number) => void;
  onAddVendor: (vendorCode: string) => void;
  /** File a vendor the master does not carry, and hand back its code. */
  onCreateVendor: (vendorName: string) => string;
  onRemoveVendor: (vendorCode: string) => void;
  /** Add or drop a receiving document from what this share unwinds. How much
   *  comes off each is arithmetic the flow does, not a figure to type. */
  onToggleTie: (vendorCode: string, grnNumber: string, on: boolean) => void;
  onUntied: (vendorCode: string, next: boolean) => void;
}) {
  const placed = shares.reduce((n, s) => n + s.qty, 0);
  const left = Math.round((qty - placed) * 100) / 100;
  const taken = new Set(shares.map((s) => s.vendorCode));
  const addable = candidates.filter((c) => !taken.has(c.vendorCode));

  // Tied across every share, and what is still loose. A share sent untied on
  // purpose is answered, so it counts as settled rather than as a shortfall.
  const tied = shares.reduce(
    (n, s) => n + (s.untied ? s.qty : Object.values(s.ties).reduce((m, v) => m + v, 0)),
    0,
  );

  return (
    <>
      {/* ── who takes it ── */}
      <div className="flex min-w-0 flex-col gap-3">
        <ResolveSection
          icon={Building2}
          title="Goes back to"
          subtitle="A counted part cannot name its own source, so this is chosen."
          figure={formatQty(placed)}
          unit={`of ${formatQty(qty)} ${uom}`}
          money={money(placed * unitPrice)}
          tone={left === 0 && placed > 0 ? 'done' : 'todo'}
          hint={
            left > 0
              ? shares.length === 0
                ? 'Pick the vendor, or split it across more than one.'
                : `${formatQty(left)} ${uom} still without a vendor.`
              : left < 0
                ? `${formatQty(-left)} ${uom} more is placed than is going back.`
                : 'All of it placed.'
          }
          actions={
            shares.length > 0 && addable.length > 0 ? (
              <VendorPicker
                sku={sku}
                uom={uom}
                candidates={addable}
                onPick={onAddVendor}
                onCreate={onCreateVendor}
                label="Split onto another vendor"
              />
            ) : undefined
          }
        >
          {shares.length === 0 ? (
            // The one thing this step is for. A link in the strip put the
            // step's only action in its quietest slot, and left the body a
            // grey sentence saying nothing had happened yet.
            <div className="flex flex-col items-center gap-3 px-4 py-7 text-center">
              <GoingBack sku={sku} uom={uom} qty={qty} />
              <div>
                <p className="text-[14px] text-foreground" style={{ fontWeight: 700 }}>
                  Who is taking it back?
                </p>
                <p className="mx-auto mt-1 max-w-[44ch] text-[12px] leading-snug text-slate-500">
                  Counted parts do not record which delivery they came from, so nothing is
                  chosen for you. Name the vendor and their latest delivery is tied to it.
                </p>
              </div>
              <VendorPicker
                sku={sku}
                uom={uom}
                candidates={addable}
                onPick={onAddVendor}
                onCreate={onCreateVendor}
                label="Choose vendor"
                primary
              />
            </div>
          ) : (
            <div>
              {/* The same statement, kept once a vendor is on the line. It was
                  in the empty state only, so the figure and its unit vanished
                  the moment the work started -- and the unit is the thing a
                  vendor's own figure has to be read against. */}
              <div className="border-b border-[#EEF2F6] px-4 py-2">
                <GoingBack sku={sku} uom={uom} qty={qty} compact />
              </div>
              <div className="divide-y divide-[#EEF2F6]">
              {shares.map((share) => (
                <VendorRow
                  key={share.vendorCode}
                  sku={sku}
                  uom={uom}
                  share={share}
                  unplaced={left}
                  onQty={(n) => onQty(share.vendorCode, n)}
                  onRemove={() => onRemoveVendor(share.vendorCode)}
                  onSplitTo={onAddVendor}
                />
              ))}
              </div>
            </div>
          )}
        </ResolveSection>
      </div>

      {/* ── what it unwinds, and what it becomes ── */}
      <div className="flex min-w-0 flex-col gap-3">
        <ResolveSection
          icon={FileText}
          title="What the credit unwinds"
          subtitle="Defaulted to the most recent deliveries, and changeable."
          figure={formatQty(tied)}
          unit={`of ${formatQty(qty)} ${uom} tied`}
          tone={tied === qty && qty > 0 ? 'done' : 'todo'}
          hint="Their latest delivery, tied for you. Swap it for another if it is wrong."
        >
          {shares.length === 0 ? (
            <p className="px-4 py-8 text-center text-[12px] text-slate-400">
              A credit unwinds a vendor's own deliveries, so this fills in once one is named.
            </p>
          ) : (
            <div className="divide-y divide-[#EEF2F6]">
              {shares.map((share) => (
                <TieGroup
                  key={share.vendorCode}
                  sku={sku}
                  uom={uom}
                  share={share}
                  single={shares.length === 1}
                  onToggle={(grn, on) => onToggleTie(share.vendorCode, grn, on)}
                  onUntied={(next) => onUntied(share.vendorCode, next)}
                />
              ))}
            </div>
          )}
        </ResolveSection>
      </div>
    </>
  );
}

/** What the first step answered, in the unit it answered it in.
 *
 *  The second step asks who takes a quantity back. Stating the quantity where
 *  the question is asked is the difference between a decision and a guess --
 *  and the unit especially, since thirty pallets and thirty each are different
 *  returns and a vendor's own figure means nothing without it. */
function GoingBack({
  sku,
  uom,
  qty,
  compact,
}: {
  sku: string;
  uom: string;
  qty: number;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <p className="flex items-baseline gap-1.5 text-[11px] text-slate-500">
        <span className="text-[13px] text-foreground tabular-nums" style={{ fontWeight: 700 }}>
          {formatQty(qty)}
        </span>
        <span className="text-[11px] text-slate-600" style={{ fontWeight: 600 }}>
          {uom}
        </span>
        <span>going back, to be placed with a vendor</span>
      </p>
    );
  }
  return (
    <span className="inline-flex items-baseline gap-1.5 rounded-lg border border-[#E2E8F0] bg-[#FAFBFC] px-3 py-1.5">
      <span className="text-[17px] text-foreground tabular-nums" style={{ fontWeight: 700 }}>
        {formatQty(qty)}
      </span>
      <span className="text-[12px] text-slate-500" style={{ fontWeight: 600 }}>
        {uom}
      </span>
      <span className="text-[12px] text-slate-500">of {sku} going back</span>
    </span>
  );
}

/** One vendor's share of the return. The figure and its ceiling; the ties are
 *  in the column beside it, under this vendor's name. */
function VendorRow({
  sku,
  uom,
  share,
  unplaced,
  onQty,
  onRemove,
  onSplitTo,
}: {
  sku: string;
  uom: string;
  share: VendorShare;
  /** What the line still has to place. A branch already at its ceiling with
   *  units left over is the moment the sibling matters. */
  unplaced: number;
  onQty: (qty: number) => void;
  onRemove: () => void;
  onSplitTo: (vendorCode: string) => void;
}) {
  // Only a vendor who has delivered the part has a figure to exceed.
  const over = share.shipped && share.qty > share.cap;
  const reachable = share.receivers.reduce((n, r) => n + r.qty, 0);
  const capped = share.shipped && share.qty >= share.cap;

  // The field is typed into, so the row carries the keystrokes and the return
  // carries the figure. Emptying it is a state the field has to be allowed to
  // be in without the share being taken off the line.
  const [draft, setDraft] = useState(() => (share.qty > 0 ? String(share.qty) : ''));
  const committed = useRef(share.qty);
  useEffect(() => {
    if (share.qty === committed.current) return;
    committed.current = share.qty;
    setDraft(share.qty > 0 ? String(share.qty) : '');
  }, [share.qty]);

  // Only a serial is indivisible. Every other part goes back in decimals,
  // Box and Each included (Eli, 28 Oct; ERP-8654).
  const wholeOnly = hasSerials(trackingModeFor(sku));
  const setQty = (next: string) => {
    if (!/^\d*(?:\.\d{0,2})?$/.test(next)) return;
    // A fraction on a serialized part goes into the box and the share drops
    // to nothing; dropping the keystroke instead is what turned 2.5 into 25,
    // the dot swallowed and the 5 landing behind the 2.
    setDraft(next);
    const n =
      next.trim() === '' || next === '.' ? 0 : wholeOnly && next.includes('.') ? 0 : Number(next);
    if (!Number.isFinite(n)) return;
    committed.current = n;
    onQty(n);
  };

  return (
    <div className="px-4 py-2.5">
      <div className="flex items-center gap-2.5">
        <span className="flex w-7 h-7 shrink-0 items-center justify-center rounded-md border border-[#EEF2F6] bg-slate-50 text-slate-400">
          <Building2 className="w-3.5 h-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] text-foreground" style={{ fontWeight: 600 }}>
            {share.vendorName}
          </p>
          <p className="truncate text-[10px] text-slate-500 tabular-nums">
            {share.shipped
              ? `${formatQty(share.cap)} ${uom} received from them`
              : 'No delivery of this part from them'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {/* The same composite field the first step uses. The figure and its
              unit are one answer, and typing it on one step and stepping it on
              the next made them look like two different questions. The unit is
              settled by then, so its segment states it and offers nothing. */}
          <QtyUomField
            id={`share-${sku}-${share.vendorCode}`}
            value={draft}
            uom={uom}
            shelves={[{ uom, qty: share.cap, split: stockSplit(sku, share.cap) }]}
            invalid={over}
            ariaLabel={`Quantity of ${sku} going back to ${share.vendorName}`}
            onValue={setQty}
            onUom={() => undefined}
          />
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Take ${share.vendorName} off ${sku}`}
            className="flex w-6 h-6 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {over && (
        <p
          className="flex items-start gap-1.5 pl-[38px] pt-1 text-[10px] text-red-700"
          style={{ fontWeight: 600 }}
        >
          <AlertCircle className="w-3 h-3 shrink-0 mt-px" />
          {formatQty(share.qty - share.cap)} {uom} more than they ever delivered
        </p>
      )}

      {!over && !share.untied && reachable < share.qty && (
        <p
          className="flex items-start gap-1.5 pl-[38px] pt-1 text-[10px] text-red-700"
          style={{ fontWeight: 500 }}
        >
          <AlertCircle className="w-3 h-3 shrink-0 mt-px" />
          {share.receivers.length === 0
            ? 'Nothing of theirs can be unwound, so this share can only go back untied.'
            : `Their deliveries only carry ${formatQty(reachable)} ${uom}.`}
        </p>
      )}

      {/* A branch that cannot cover its share usually has a sibling that can,
          and the two are separate vendors with separate receivers. */}
      {(over || capped) && unplaced > 0 && share.siblings.length > 0 && (
        <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1 pl-[38px] pt-1.5">
          <span className="text-[10px] text-slate-500">Same company, other branch:</span>
          {share.siblings.map((sib) => (
            <button
              key={sib.vendorCode}
              type="button"
              onClick={() => onSplitTo(sib.vendorCode)}
              className="inline-flex items-baseline gap-1 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] text-primary transition-colors hover:border-primary/40 hover:bg-[#F7FAFF]"
              style={{ fontWeight: 600 }}
            >
              {sib.vendorName}
              <span className="text-slate-400 tabular-nums" style={{ fontWeight: 500 }}>
                {formatQty(sib.lifetime)} {uom}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** The deliveries one vendor's share unwinds.
 *
 *  A row is a document, ticked or not. How much comes off each is stated, not
 *  typed: the share is known and a delivery cannot give back more than it
 *  brought in, so the figures are arithmetic and the only real question is
 *  which documents the credit reverses. The list also stops being a list of
 *  things already chosen plus a picker for the rest -- everything of theirs is
 *  here, and the ticks say which are in use. */
function TieGroup({
  sku,
  uom,
  share,
  single,
  onToggle,
  onUntied,
}: {
  sku: string;
  uom: string;
  share: VendorShare;
  /** With one vendor on the line their name is already on the card, so the
   *  group heading would only repeat it. */
  single: boolean;
  onToggle: (grnNumber: string, on: boolean) => void;
  onUntied: (next: boolean) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const tied = Object.values(share.ties).reduce((n, v) => n + v, 0);
  const left = Math.round((share.qty - tied) * 100) / 100;

  // What the credit actually reverses, and nothing else. Listing every
  // delivery of theirs with a tick made twelve rows to read a decision that
  // concerns one or two of them; the rest belong behind a picker, the way the
  // vendors themselves do.
  const used = share.receivers.filter((r) => (share.ties[r.grnNumber] ?? 0) > 0);
  const spare = share.receivers.filter((r) => (share.ties[r.grnNumber] ?? 0) <= 0);
  const shown = showAll ? used : used.slice(0, 3);
  const hidden = used.length - shown.length;

  return (
    <div className="py-1">
      {(!single || !share.untied) && (
        <div className="flex items-baseline justify-between gap-2 px-4 pb-1 pt-2">
          {single ? (
            <span className="text-[10px] uppercase tracking-wide text-slate-400" style={{ fontWeight: 600 }}>
              Receiving documents
            </span>
          ) : (
            <span
              className="min-w-0 truncate text-[10px] uppercase tracking-wide text-slate-500"
              style={{ fontWeight: 600 }}
            >
              {share.vendorName}
            </span>
          )}
          {!share.untied && (
            <span
              className={`shrink-0 text-[10px] tabular-nums whitespace-nowrap ${
                left === 0 ? 'text-slate-500' : 'text-amber-700'
              }`}
              style={{ fontWeight: 600 }}
            >
              {formatQty(tied)} of {formatQty(share.qty)} {uom}
            </span>
          )}
        </div>
      )}

      {share.untied ? (
        <div className="px-4 pb-2.5 pt-1">
          <p className="flex items-start gap-1.5 text-[11px] text-amber-900" style={{ fontWeight: 600 }}>
            <AlertTriangle className="w-3 h-3 shrink-0 mt-px" />
            Not tied to a receiving document
          </p>
          <p className="mt-0.5 text-[10px] leading-snug text-amber-800">
            Nothing unwinds on its own, so this comes back as a floating credit against{' '}
            {share.vendorName} for someone to apply to an invoice by hand.
          </p>
          <button
            type="button"
            onClick={() => onUntied(false)}
            className="mt-1 text-[10px] text-primary hover:underline"
            style={{ fontWeight: 600 }}
          >
            Tie it to a receiving document instead
          </button>
        </div>
      ) : share.receivers.length === 0 ? (
        // Nothing of theirs to reverse, so untied is the only answer -- which
        // means the action that gets there has to be here. Without it the row
        // stated a dead end and offered no way out of it.
        <div className="flex items-center justify-between gap-2 px-4 pb-2">
          <span className="min-w-0 text-[10px] text-amber-700" style={{ fontWeight: 600 }}>
            No delivery of {sku} from them to reverse
          </span>
          <SectionAction onClick={() => onUntied(true)}>
            <span className="inline-flex items-center gap-1">
              <Link2Off className="w-3 h-3" />
              Send it untied
            </span>
          </SectionAction>
        </div>
      ) : (
        <>
          <div className="divide-y divide-[#F5F8FB]">
            {shown.map((r, i) => {
              const on = share.ties[r.grnNumber] ?? 0;
              const whole = on >= r.qty;
              return (
                <div key={r.grnNumber} className="flex items-center gap-2.5 px-4 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 min-w-0">
                      <span className="truncate text-[12px] text-foreground" style={{ fontWeight: 600 }}>
                        {r.grnNumber}
                      </span>
                      {/* Newest first is what the flow tied, so the one it
                          picked says so rather than leaving the order to be
                          inferred from the dates. */}
                      {i === 0 && !showAll && (
                        <span
                          className="shrink-0 rounded border border-blue-100 bg-blue-50 px-1 text-[10px] text-primary"
                          style={{ fontWeight: 600 }}
                        >
                          Latest
                        </span>
                      )}
                    </p>
                    <p className="truncate text-[10px] text-slate-500 tabular-nums">
                      {r.date} · PO {r.poNumber}
                    </p>
                  </div>
                  <span className="shrink-0 text-right">
                    <span
                      className="block text-[12px] text-foreground tabular-nums whitespace-nowrap"
                      style={{ fontWeight: 600 }}
                    >
                      {formatQty(on)} {r.uom}
                    </span>
                    <span className="block text-[10px] text-slate-400" style={{ fontWeight: 500 }}>
                      {whole ? 'all of it' : `of ${formatQty(r.qty)}`}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => onToggle(r.grnNumber, false)}
                    aria-label={`Stop unwinding ${r.grnNumber} for ${sku}`}
                    className="flex w-5 h-5 shrink-0 items-center justify-center rounded text-slate-400 transition-colors hover:bg-slate-100 hover:text-foreground"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
            {hidden > 0 && (
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="w-full px-4 py-1.5 text-left text-[10px] text-primary transition-colors hover:bg-[#F7FAFF]"
                style={{ fontWeight: 600 }}
              >
                {hidden} more {hidden === 1 ? 'delivery' : 'deliveries'},{' '}
                {formatQty(used.slice(shown.length).reduce((n, r) => n + (share.ties[r.grnNumber] ?? 0), 0))}{' '}
                {uom}
              </button>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-[#F1F5F9] px-4 py-1.5">
            <ReceiverPicker
              sku={sku}
              uom={uom}
              vendorName={share.vendorName}
              receivers={spare}
              onPick={(grn) => onToggle(grn, true)}
            />
            <SectionAction onClick={() => onUntied(true)} muted>
              <span className="inline-flex items-center gap-1">
                <Link2Off className="w-3 h-3" />
                Don't tie
              </span>
            </SectionAction>
          </div>
          {left > 0 && (
            <p className="px-4 pb-2 text-[10px] text-amber-700" style={{ fontWeight: 600 }}>
              {formatQty(left)} {uom} not on a delivery yet.
            </p>
          )}
        </>
      )}
    </div>
  );
}

/** The vendor's other deliveries, behind a button.
 *
 *  Only what the credit reverses is on the card. A vendor with a dozen
 *  receipts against this part has eleven that are merely available, and listing
 *  them turned a decision about one document into a page of them -- so they
 *  live here, the way the vendors themselves do. */
function ReceiverPicker({
  sku,
  uom,
  vendorName,
  receivers,
  onPick,
}: {
  sku: string;
  uom: string;
  vendorName: string;
  receivers: ItemReceiver[];
  onPick: (grnNumber: string) => void;
}) {
  const [open, setOpen] = useState(false);
  if (receivers.length === 0) {
    return (
      <span className="text-[10px] text-slate-400">Every delivery of theirs is in use</span>
    );
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Choose another delivery of ${sku} from ${vendorName}`}
          className="h-6 -ml-2 inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 text-[10px] text-primary transition-colors hover:bg-primary/5"
          style={{ fontWeight: 600 }}
        >
          <Plus className="w-3 h-3" />
          Choose a different delivery
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-[320px] overflow-hidden rounded-xl border border-[#E2E8F0] p-0 shadow-[0_8px_30px_rgba(16,24,40,0.12)] z-[220]"
      >
        <p
          className="border-b border-[#EEF2F6] bg-[#FAFBFC] px-3 py-2 text-[10px] uppercase tracking-wide text-slate-500"
          style={{ fontWeight: 600 }}
        >
          {vendorName} · {receivers.length} more {receivers.length === 1 ? 'delivery' : 'deliveries'}
        </p>
        <div className="max-h-[240px] divide-y divide-[#EEF2F6] overflow-y-auto">
          {receivers.map((r) => (
            <button
              key={r.grnNumber}
              type="button"
              onClick={() => { onPick(r.grnNumber); setOpen(false); }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-[#F7FAFF]"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] text-foreground" style={{ fontWeight: 600 }}>
                  {r.grnNumber}
                </p>
                <p className="truncate text-[10px] text-slate-500 tabular-nums">
                  {r.date} · PO {r.poNumber}
                </p>
              </div>
              <span className="shrink-0 whitespace-nowrap text-[10px] text-slate-400 tabular-nums">
                {formatQty(r.qty)} {r.uom}
              </span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** The vendors that could take it, on demand rather than listed. */
export function VendorPicker({
  sku,
  uom,
  candidates,
  onPick,
  onCreate,
  label,
  primary,
}: {
  sku: string;
  uom: string;
  candidates: VendorCandidate[];
  onPick: (vendorCode: string) => void;
  /** Name a vendor the master does not carry. Returns the code it was filed
   *  under, so the pick can follow immediately. */
  onCreate: (vendorName: string) => string;
  /** What the action says. It is the only thing to do on an unanswered line
   *  and one option among several once it is answered. */
  label: string;
  /** The unanswered line's own call to action, rather than a link in a strip. */
  primary?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');

  const close = () => { setOpen(false); setQuery(''); setNaming(false); setName(''); };
  const create = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onPick(onCreate(trimmed));
    close();
  };
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q
      ? candidates.filter((c) => c.vendorName.toLowerCase().includes(q) || c.vendorCode.toLowerCase().includes(q))
      : candidates;
  }, [query, candidates]);

  const delivered = shown.filter((c) => c.shipped);
  const others = shown.filter((c) => !c.shipped);

  return (
    <Popover open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Pick a vendor for ${sku}`}
          className={
            primary
              ? 'inline-flex items-center gap-1.5 h-9 rounded-lg bg-primary px-4 text-[13px] text-white shadow-sm transition-colors hover:bg-blue-700'
              : 'h-6 px-2 rounded-md text-[11px] text-primary transition-colors hover:bg-primary/5 inline-flex items-center gap-1 whitespace-nowrap'
          }
          style={{ fontWeight: 600 }}
        >
          <Plus className={primary ? 'w-3.5 h-3.5' : 'w-3 h-3'} />
          {label}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={6}
        className="w-[340px] p-0 rounded-xl border border-[#E2E8F0] overflow-hidden z-[220] shadow-[0_8px_30px_rgba(16,24,40,0.12)]"
      >
        <div className="p-2 border-b border-[#EEF2F6]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search vendors"
              aria-label={`Search vendors for ${sku}`}
              className="h-8 w-full rounded-md border border-slate-200 bg-white pl-8 pr-2 text-[12px] text-foreground placeholder:text-slate-400 outline-none transition-colors focus:border-primary/40 focus:ring-1 focus:ring-primary/20"
            />
          </div>
        </div>

        {shown.length === 0 ? (
          <p className="px-3 py-4 text-center text-[12px] text-slate-400">
            No vendor on file matches "{query.trim()}".
          </p>
        ) : (
          <div className="max-h-[280px] overflow-y-auto p-1.5">
            {[
              { label: 'Delivered this part', rows: delivered },
              { label: 'Never delivered it', rows: others },
            ].map(({ label, rows }) =>
              rows.length === 0 ? null : (
                <div key={label}>
                  <p className="px-2 pb-1 pt-2 text-[10px] text-slate-500 first:pt-1" style={{ fontWeight: 600 }}>
                    {label}
                  </p>
                  {rows.map((c) => (
                    <button
                      key={c.vendorCode}
                      type="button"
                      onClick={() => { onPick(c.vendorCode); setOpen(false); setQuery(''); }}
                      className="w-full flex items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-[#F7FAFF]"
                    >
                      <span className="flex w-6 h-6 shrink-0 items-center justify-center rounded-md border border-[#EEF2F6] bg-slate-50 text-slate-400">
                        <Building2 className="w-3 h-3" />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[12px] text-foreground" style={{ fontWeight: 500 }}>
                        {c.vendorName}
                      </span>
                      {c.shipped && (
                        <span className="shrink-0 text-[10px] text-slate-400 tabular-nums whitespace-nowrap">
                          {formatQty(c.lifetime)} {uom}
                          {c.recent > 0 && ` · ${formatQty(c.recent)} lately`}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              ),
            )}
          </div>
        )}

        {/* The goods may be going back to somebody the system has never dealt
            with. A list built out of history cannot contain them, so the list
            has to end in a way to write one down. */}
        <div className="border-t border-[#EEF2F6] bg-[#FAFBFC] p-2">
          {naming ? (
            <div className="flex items-center gap-1.5">
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); create(); }
                  if (e.key === 'Escape') { e.preventDefault(); setNaming(false); setName(''); }
                }}
                placeholder="Vendor name"
                aria-label="Name of the vendor to add"
                className="h-8 min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2.5 text-[12px] text-foreground placeholder:text-slate-400 outline-none transition-colors focus:border-primary/40 focus:ring-1 focus:ring-primary/20"
              />
              <button
                type="button"
                onClick={create}
                disabled={name.trim() === ''}
                className="shrink-0 h-8 rounded-md bg-primary px-2.5 text-[12px] text-white transition-colors hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400"
                style={{ fontWeight: 600 }}
              >
                Add
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => { setNaming(true); setName(query.trim()); }}
              className="w-full inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-[12px] text-primary transition-colors hover:bg-[#F7FAFF]"
              style={{ fontWeight: 600 }}
            >
              <Plus className="w-3.5 h-3.5" />
              {query.trim() ? `Add "${query.trim()}" as a new vendor` : 'Add a vendor that is not on file'}
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
