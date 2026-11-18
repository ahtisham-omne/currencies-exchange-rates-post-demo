/**
 * Edits one return line from the RMA detail page. Same dialog recipe as the
 * create flow's row editor so a Draft reads and edits the same either side of
 * submission. Changes are held locally and applied on Done, so backing out of
 * the modal leaves the RMA alone.
 */
import { useEffect, useMemo, useState } from 'react';
import { Paperclip, ScanLine, Upload, X } from 'lucide-react';

import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/app/components/ui/dialog';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Textarea } from '@/app/components/ui/textarea';
import { Button } from '@/app/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import { ImageWithFallback } from '@/app/components/figma/ImageWithFallback';
import { imageForSku } from '@/app/lib/itemImages';
import { SerialQtyCell } from '@/app/components/SerialQtyCell';
import { SerialSelectionModal } from '@/app/components/SerialSelectionModal';
import {
  RETURN_REASONS,
  availableSerials,
  trackingModeFor,
  type RMALineItem,
  type RMALineSettlement,
  type ReturnReason,
  type ReturnType,
} from '@/app/data/mockRMAs';
import type { LineInvoiceSplit } from '@/app/data/receiptInvoiceStatus';
import { accrualWarning, defaultReturnType, returnTypeOptions } from '@/app/data/rmaReturnTypeRules';
import { ReturnAllocationControl } from '@/app/components/ReturnAllocationControl';
import {
  BUCKET_LABELS,
  RETURN_BUCKETS,
  allocationTotal,
  autoAllocate,
  bucketCount,
  bucketDefaultReturnType,
  emptyAllocation,
  type ReturnAllocation,
  type ReturnBucket,
} from '@/app/data/rmaReturnAllocation';

export function RMALineEditModal({
  line,
  split,
  reduceOnly = false,
  onClose,
  onSave,
}: {
  line: RMALineItem;
  /** Locked since the first shipment (ERP-8701): the line can only go down,
   *  on the current version, so price, reason and the units picked stay as
   *  the vendor has them and only fewer of them can be kept back. */
  reduceOnly?: boolean;
  /** Invoice state of this line, which decides whether a credit can be
   *  claimed at all. Absent when the receipt behind the line is unknown. */
  split?: LineInvoiceSplit;
  onClose: () => void;
  onSave: (patch: Partial<RMALineItem>) => void;
}) {
  const [returnQty, setReturnQty] = useState(String(line.returnQty));
  const [unitPrice, setUnitPrice] = useState(String(line.unitPrice));
  const [returnType, setReturnType] = useState<ReturnType>(line.returnType ?? 'Refund/Credit');
  const [reason, setReason] = useState<ReturnReason>(line.reason);
  const [serials, setSerials] = useState<string[]>(line.serialNumbers ?? []);
  const [notes, setNotes] = useState(line.notes ?? '');
  const [attachments, setAttachments] = useState<{ name: string }[]>(line.attachments ?? []);
  const [pickerOpen, setPickerOpen] = useState(false);
  // A line whose goods sat in more than one invoice state settles once per
  // state, so quantity, reason, remedy and price are held per bucket here and
  // collapsed back onto the line on save. Seeded from the saved breakdown when
  // there is one, otherwise from the line's single answer.
  const seedFromLine = (li: RMALineItem, sp: LineInvoiceSplit | undefined) => {
    const saved = li.settlements ?? [];
    const allocation = saved.length > 0 ? emptyAllocation() : autoAllocate(li.returnQty, sp);
    const reasons: Partial<Record<ReturnBucket, string>> = {};
    const types: Partial<Record<ReturnBucket, string>> = {};
    const prices: Partial<Record<ReturnBucket, number>> = {};
    for (const s of saved) {
      allocation[s.state] = s.qty;
      reasons[s.state] = s.reason;
      prices[s.state] = s.unitPrice;
      if (s.returnType) types[s.state] = s.returnType;
    }
    return { allocation, reasons, types, prices };
  };
  const [allocation, setAllocation] = useState<ReturnAllocation>(() => seedFromLine(line, split).allocation);
  const [bucketReasons, setBucketReasons] = useState<Partial<Record<ReturnBucket, string>>>(
    () => seedFromLine(line, split).reasons,
  );
  const [bucketTypes, setBucketTypes] = useState<Partial<Record<ReturnBucket, string>>>(
    () => seedFromLine(line, split).types,
  );
  const [bucketPrices, setBucketPrices] = useState<Partial<Record<ReturnBucket, number>>>(
    () => seedFromLine(line, split).prices,
  );
  // Bucket the units picker is scoped to, when it was opened from the
  // breakdown rather than from the line's own quantity field.
  const [pickerBucket, setPickerBucket] = useState<ReturnBucket | null>(null);
  const [bucketPicks, setBucketPicks] = useState<Partial<Record<ReturnBucket, string[]>>>({});
  // The total is normally read off price times qty, but while it is being
  // typed it holds the raw text so a backspace can empty it instead of
  // snapping back to the derived number.
  const [totalDraft, setTotalDraft] = useState<string | null>(null);

  // The modal stays mounted across rows, so a new line has to reseed the form.
  useEffect(() => {
    setReturnQty(String(line.returnQty));
    setUnitPrice(String(line.unitPrice));
    setTotalDraft(null);
    setReturnType(line.returnType ?? 'Refund/Credit');
    setReason(line.reason);
    setSerials(line.serialNumbers ?? []);
    setNotes(line.notes ?? '');
    setAttachments(line.attachments ?? []);
    const seed = seedFromLine(line, split);
    setAllocation(seed.allocation);
    setBucketReasons(seed.reasons);
    setBucketTypes(seed.types);
    setBucketPrices(seed.prices);
    setPickerBucket(null);
    setBucketPicks({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [line]);

  const serialized = trackingModeFor(line.sku) === 'serialized';
  // Same rule as the create flow: a line with an invoice split answers through
  // the settlement card, so the line-level quantity, price, type and reason
  // fields would be a second, contradictory copy of the same answers.
  // A reduction cuts units, not terms, so it reads as one quantity even on a
  // line that settles per invoice state; the states shrink from the last.
  const useBreakdown = !reduceOnly && bucketCount(split) > 0;

  // The units on a saved line were recorded against the create screen's row
  // key, so regenerating the pool from this line's id would not contain them.
  // Build it around what is already picked instead.
  const serialPool = useMemo(() => {
    if (!serialized) return [];
    const picked = line.serialNumbers ?? [];
    // Reducing can only drop units already on the return.
    if (reduceOnly) return picked;
    const rest = availableSerials(line.sku, line.poLineId, line.receivedQty).filter(
      (sn) => !picked.includes(sn),
    );
    return [...picked, ...rest].slice(0, Math.max(line.receivedQty, picked.length));
  }, [serialized, line, reduceOnly]);

  // There is no per-serial record of which invoice state a unit was billed
  // under, so the pool is cut into contiguous slices in bucket order sized by
  // the split. Allocation fills the buckets in that same order, which keeps a
  // bucket's units and the line's flat list describing the same units.
  const bucketPool = (bucket: ReturnBucket) => {
    if (!split) return [];
    let start = 0;
    for (const b of RETURN_BUCKETS) {
      const size = Math.round(split[b]);
      if (b === bucket) return serialPool.slice(start, start + size);
      start += size;
    }
    return [];
  };
  // Until a state's units are actually picked, the first however many of its
  // own pool stand in for them, so the count and the list always agree.
  const bucketSerials = (bucket: ReturnBucket) =>
    bucketPicks[bucket] ?? bucketPool(bucket).slice(0, Math.max(0, allocation[bucket]));

  const bucketReasonFor = (bucket: ReturnBucket) => bucketReasons[bucket] ?? reason;
  const bucketTypeFor = (bucket: ReturnBucket, bucketQty: number) =>
    bucketTypes[bucket] ?? bucketDefaultReturnType(bucket, bucketReasonFor(bucket) as ReturnReason, bucketQty) ?? '';
  const bucketPriceFor = (bucket: ReturnBucket) => bucketPrices[bucket] ?? Math.max(0, Number(unitPrice) || 0);

  // Serial numbers are picked as units, so the count is the quantity — letting
  // the two drift would ship a line the serial list can't back up.
  const breakdownQty = allocationTotal(allocation);
  const qty = useBreakdown
    ? breakdownQty
    : serialized
      ? serials.length
      : Math.max(1, Number(returnQty) || 1);
  const price = Math.max(0, Number(unitPrice) || 0);
  // Slices can price differently, so the line's value is the sum of them
  // rather than one price times the total.
  const lineTotal = useBreakdown
    ? RETURN_BUCKETS.reduce((sum, b) => sum + allocation[b] * bucketPriceFor(b), 0)
    : qty * price;
  // A reduction stops at what the line already holds; otherwise at what came in.
  const ceiling = reduceOnly ? line.returnQty : line.receivedQty;
  const overReceived = qty > ceiling;
  const noUnits = useBreakdown ? breakdownQty === 0 : serialized && serials.length === 0;
  // Either field may be cleared; the line simply has no value until one of
  // them is filled back in.
  const priceEmpty = unitPrice.trim() === '' || totalDraft?.trim() === '';
  const totalValue = totalDraft ?? (priceEmpty ? '' : String(Number(lineTotal.toFixed(2))));
  const priceChanged =
    !priceEmpty && line.originalUnitPrice !== undefined && Math.abs(price - line.originalUnitPrice) > 0.004;
  const money = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const typeWarning = accrualWarning(returnType, split);

  const save = () => {
    if (reduceOnly) {
      // Take the cut off the last invoice states first, so the earlier ones
      // keep the terms they were agreed on.
      let cut = line.returnQty - qty;
      const settlements = line.settlements
        ? [...line.settlements]
            .reverse()
            .map((s) => {
              const take = Math.min(cut, s.qty);
              cut -= take;
              return { ...s, qty: s.qty - take };
            })
            .filter((s) => s.qty > 0)
            .reverse()
        : undefined;
      onSave({
        returnQty: qty,
        ...(settlements ? { settlements: settlements.length > 1 ? settlements : undefined } : {}),
        notes: notes.trim(),
        attachments,
        ...(serialized ? { serialNumbers: serials } : {}),
      });
      onClose();
      return;
    }
    if (useBreakdown) {
      const settled = RETURN_BUCKETS.filter((b) => allocation[b] > 0.004);
      const settlements: RMALineSettlement[] = settled.map((b) => {
        const bReason = bucketReasonFor(b) as ReturnReason;
        return {
          state: b,
          qty: allocation[b],
          unitPrice: bucketPriceFor(b),
          reason: bReason,
          returnType: bucketTypeFor(b, allocation[b]) as ReturnType,
        };
      });
      // The line still carries one reason, type and price. It takes them from
      // the state covering the most units and keeps the breakdown alongside.
      const lead = [...settlements].sort((a, b) => b.qty - a.qty)[0];
      onSave({
        returnQty: qty,
        unitPrice: qty > 0 ? lineTotal / qty : 0,
        ...(lead ? { returnType: lead.returnType ?? returnType, reason: lead.reason } : {}),
        settlements: settlements.length > 1 ? settlements : undefined,
        notes: notes.trim(),
        attachments,
        ...(serialized ? { serialNumbers: settled.flatMap((b) => bucketSerials(b)) } : {}),
      });
      onClose();
      return;
    }
    onSave({
      returnQty: qty,
      unitPrice: price,
      returnType,
      reason,
      notes: notes.trim(),
      attachments,
      ...(serialized ? { serialNumbers: serials } : {}),
    });
    onClose();
  };

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent
        className="z-[210] flex flex-col gap-0 overflow-hidden border-0 p-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.18)] sm:max-w-none"
        style={{ maxWidth: 520, width: 'calc(100% - 2rem)', borderRadius: 16 }}
        showCloseButton={false}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#EEF2F6] bg-card px-5 py-3.5 shrink-0">
          <div className="flex items-start gap-3 min-w-0">
            <span className="w-8 h-8 rounded-md border border-border bg-slate-50 overflow-hidden shrink-0">
              <ImageWithFallback
                src={imageForSku(line.sku)}
                alt={line.sku}
                className="w-full h-full object-cover"
              />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <DialogTitle className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>{line.sku}</DialogTitle>
                <span className="shrink-0 px-1.5 py-px rounded-full text-[10px] bg-slate-100 border border-slate-200 text-slate-500" style={{ fontWeight: 600 }}>
                  {serialized ? 'Serialized' : 'Non-Serialized'}
                </span>
              </div>
              <DialogDescription className="text-[11px] text-muted-foreground truncate">{line.description}</DialogDescription>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-foreground hover:bg-muted transition-all shrink-0"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 bg-white overflow-y-auto custom-scrollbar" style={{ maxHeight: 'calc(90vh - 140px)' }}>
          {reduceOnly && (
            <p
              className="text-[11px] leading-snug rounded-md px-3 py-2"
              style={{ color: '#475569', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', fontWeight: 500 }}
            >
              This return has started shipping, so this line can only be reduced. The change stays on
              the current version.
            </p>
          )}
          {/* A return settles per invoice state: a line sitting in one state
              answers quantity, reason, remedy and price once, a line spanning
              several answers them once per state. Both go through the same
              card, so the line carries no second copy of those fields. */}
          {useBreakdown && split && (
            <ReturnAllocationControl
              split={split}
              uom={line.uom}
              reasons={RETURN_REASONS}
              allocation={allocation}
              onAllocationChange={(next) => {
                setAllocation(next);
                // Setting a count rather than picking units drops the units
                // that count no longer describes, so the stand-in list rebuilds.
                setBucketPicks((prev) =>
                  Object.fromEntries(
                    RETURN_BUCKETS.filter((b) => prev[b]?.length === next[b]).map((b) => [b, prev[b]!]),
                  ),
                );
              }}
              {...(serialized ? { onPickUnits: (bucket: ReturnBucket) => { setPickerBucket(bucket); setPickerOpen(true); } } : {})}
              bucketPriceFor={bucketPriceFor}
              onBucketPriceChange={(bucket, next) => setBucketPrices((prev) => ({ ...prev, [bucket]: next }))}
              bucketReasonFor={bucketReasonFor}
              onBucketReasonChange={(bucket, next) => {
                setBucketReasons((prev) => ({ ...prev, [bucket]: next }));
                // A new reason re-picks the remedy, since the old one may be
                // something the new reason doesn't allow.
                const seeded = bucketDefaultReturnType(bucket, next as ReturnReason, allocation[bucket]);
                setBucketTypes((prev) => ({ ...prev, [bucket]: seeded ?? undefined }));
              }}
              bucketTypeFor={bucketTypeFor}
              onBucketTypeChange={(bucket, next) => setBucketTypes((prev) => ({ ...prev, [bucket]: next }))}
            />
          )}

          {/* What came in and what goes back read as one comparison, so they
              sit on a single row at the same control height, the received
              side locked. Same arrangement as the create flow's line card. */}
          {!useBreakdown && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>{reduceOnly ? 'On this return now' : 'Received on this PO'}</Label>
              <div className="h-9 rounded-md border border-slate-200 bg-slate-50 px-2.5 flex items-center gap-1.5">
                <span className="text-[11px] text-slate-500" style={{ fontWeight: 600 }}>{line.uom}</span>
                <span className="text-[12px] text-slate-600 tabular-nums" style={{ fontWeight: 600 }}>{ceiling}</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>Return Qty</Label>
              {serialized ? (
                <SerialQtyCell
                  sku={line.sku}
                  poLineId={line.poLineId}
                  receivedQty={line.receivedQty}
                  selected={serials}
                  poolSize={serialPool.length}
                  onOpen={() => setPickerOpen(true)}
                  size="md"
                  align="start"
                />
              ) : (
                <label className={`h-9 rounded-md border bg-white px-2.5 flex items-center gap-1.5 cursor-text focus-within:ring-1 ${
                  overReceived
                    ? 'border-red-400 focus-within:ring-red-100 focus-within:border-red-500'
                    : 'border-emerald-200 focus-within:ring-emerald-100'
                }`}>
                  <span className="text-[11px] text-slate-500 pointer-events-none shrink-0" style={{ fontWeight: 600 }}>{line.uom}</span>
                  <Input
                    type="number"
                    min={1}
                    value={returnQty}
                    onChange={(e) => setReturnQty(e.target.value.replace(/^0+(?=\d)/, ''))}
                    className={`h-7 flex-1 min-w-0 border-0 bg-transparent p-0 text-left text-[12px] tabular-nums shadow-none font-semibold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus-visible:ring-0 focus-visible:ring-offset-0 ${
                      overReceived ? 'text-red-600' : 'text-emerald-700'
                    }`}
                  />
                </label>
              )}
              {overReceived ? (
                <p className="text-[10px] text-red-600" style={{ fontWeight: 500 }}>
                  {reduceOnly
                    ? `This line can only go down from ${ceiling} ${line.uom}.`
                    : `You can't return more than the ${ceiling} ${line.uom} received.`}{' '}
                  <button
                    type="button"
                    onClick={() => setReturnQty(String(ceiling))}
                    className="text-[10px] text-primary underline decoration-primary/60 underline-offset-2 hover:text-blue-700 transition-colors tabular-nums p-0 bg-transparent border-0"
                    style={{ fontWeight: 600, fontFamily: 'inherit' }}
                  >
                    Reset to {ceiling}
                  </button>
                </p>
              ) : null}
            </div>
          </div>
          )}

          {/* Which units are going back is invisible from the count alone, so
              say it, and put the way to narrow it next to what it describes. */}
          {serialized && !useBreakdown && (
            <div className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="flex items-start gap-2 min-w-0">
                <ScanLine className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-px" />
                <p className="text-[10px] text-slate-500 leading-snug" style={{ fontWeight: 500 }}>
                  <span className={serials.length === serialPool.length ? 'text-slate-700' : 'text-amber-700'}>
                    {serials.length === serialPool.length
                      ? reduceOnly
                        ? `All ${serialPool.length} serial numbers on this line are still going back.`
                        : `All ${serialPool.length} serial numbers received on this PO are selected to ship back.`
                      : `${serials.length} of ${serialPool.length} serial numbers selected, ${serialPool.length - serials.length} staying with you.`}
                  </span>{' '}
                  Deselect any unit you are keeping.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="shrink-0 h-7 px-2.5 rounded-md border border-slate-200 bg-white text-[10px] text-slate-600 hover:text-primary hover:border-primary/40 transition-colors cursor-pointer"
                style={{ fontWeight: 600 }}
              >
                Review units
              </button>
            </div>
          )}

          {!useBreakdown && !reduceOnly && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>Price Per Unit</Label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] text-slate-500" style={{ fontWeight: 600 }}>$</span>
                <Input
                  type="number"
                  value={unitPrice}
                  onChange={(e) => { setTotalDraft(null); setUnitPrice(e.target.value); }}
                  className={`h-9 pl-6 pr-3 text-left text-[12px] tabular-nums shadow-none rounded-md font-semibold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus-visible:ring-1 ${
                    priceChanged || priceEmpty
                      ? 'bg-white border-amber-400 text-amber-700 focus-visible:ring-amber-100 focus-visible:border-amber-500'
                      : 'text-gray-900 bg-white border-slate-200 focus-visible:ring-primary/20 focus-visible:border-primary'
                  }`}
                />
              </div>
              {priceChanged && line.originalUnitPrice !== undefined && (
                <p className="text-[10px] text-amber-700" style={{ fontWeight: 500 }}>
                  The PO priced this at{' '}
                  <button
                    type="button"
                    onClick={() => { setTotalDraft(null); setUnitPrice(String(line.originalUnitPrice)); }}
                    className="text-[10px] text-primary underline decoration-primary/60 underline-offset-2 hover:text-blue-700 transition-colors tabular-nums p-0 bg-transparent border-0"
                    style={{ fontWeight: 600, fontFamily: 'inherit' }}
                  >
                    ${line.originalUnitPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </button>
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>Total</Label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] text-slate-500" style={{ fontWeight: 600 }}>$</span>
                <Input
                  type="number"
                  value={totalValue}
                  onChange={(e) => {
                    const raw = e.target.value;
                    setTotalDraft(raw);
                    if (raw.trim() === '') { setUnitPrice(''); return; }
                    const total = Number(raw);
                    if (!isNaN(total) && qty > 0) setUnitPrice(String(total / qty));
                  }}
                  className="h-9 pl-6 pr-3 text-left text-[12px] tabular-nums shadow-none rounded-md font-semibold text-gray-900 bg-white border-slate-200 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus-visible:ring-1 focus-visible:ring-primary/20 focus-visible:border-primary"
                />
              </div>
              {priceEmpty ? (
                <p className="text-[10px] text-amber-700" style={{ fontWeight: 500 }}>This line has no value. Enter a price per unit or a total, whichever you have.</p>
              ) : qty === 0 ? (
                <p className="text-[10px] text-amber-700" style={{ fontWeight: 500 }}>Select at least one unit before entering a total.</p>
              ) : (
                <p className="text-[10px] text-slate-400" style={{ fontWeight: 500 }}>Editing the total back-solves the unit price.</p>
              )}
            </div>
          </div>
          )}

          {/* Return type is not asked any more. The line still carries one --
              the ledger reads it to decide what a return books -- and it is
              seeded from the reason, which is the field that stays. */}
          {!useBreakdown && !reduceOnly && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
            <Label className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>Return Reason</Label>
            <Select
              value={reason}
              onValueChange={(next) => {
                setReason(next as ReturnReason);
                // Why the goods are going back decides which remedies make
                // sense, so a new reason re-picks the type.
                const seeded = defaultReturnType(next as ReturnReason, split);
                if (seeded) setReturnType(seeded);
              }}
            >
              <SelectTrigger className="h-9 text-[12px] bg-white border-slate-200 hover:border-primary/40 focus:ring-1 focus:ring-primary/20 rounded-md">
                <SelectValue placeholder="Select reason" />
              </SelectTrigger>
              <SelectContent className="text-[12px] z-[220]">
                {RETURN_REASONS.map((r) => (
                  <SelectItem key={r} value={r} className="text-[12px]">{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            </div>
          </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>Notes</Label>
            <Textarea
              placeholder="Add context the vendor needs to process this line."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-[68px] text-[11px] bg-white border-slate-200 shadow-none resize-none placeholder:text-[11px] placeholder:text-slate-400 focus-visible:ring-1 focus-visible:ring-primary/20 focus-visible:border-primary"
              style={{ fontWeight: 400 }}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>Supporting Documents</Label>
            <input
              type="file"
              id={`rma-line-upload-${line.id}`}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) setAttachments((prev) => [...prev, { name: file.name }]);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => document.getElementById(`rma-line-upload-${line.id}`)?.click()}
              className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 bg-white px-3 py-2.5 text-[11px] text-slate-600 hover:border-slate-400 hover:bg-slate-50/60 transition-colors"
              style={{ fontWeight: 500 }}
            >
              <Upload className="w-3.5 h-3.5 text-slate-500" />
              <span><span className="text-primary" style={{ fontWeight: 600 }}>Click to upload</span> or drag and drop</span>
            </button>
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {attachments.map((file, idx) => (
                  <div key={idx} className="inline-flex items-center gap-1.5 px-2 py-1 bg-slate-50 border border-slate-200 rounded-md text-[11px] text-slate-600" style={{ fontWeight: 500 }}>
                    <Paperclip className="w-2.5 h-2.5 text-slate-400" />
                    <span className="truncate max-w-[140px]">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                      className="ml-0.5 p-0.5 hover:bg-red-50 rounded-sm text-slate-400 hover:text-red-500 transition-colors"
                      aria-label={`Remove ${file.name}`}
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-[#EEF2F6] bg-card px-5 py-3 shrink-0">
          <span className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>
            Line total{' '}
            <span className="text-[12px] text-gray-900 tabular-nums" style={{ fontWeight: 600 }}>{money(lineTotal)}</span>
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose} className="h-8 px-4 text-[12px] rounded-lg bg-white">Cancel</Button>
            <Button size="sm" onClick={save} disabled={overReceived || noUnits} className="h-8 px-4 text-[12px] rounded-lg">Done</Button>
          </div>
        </div>
      </DialogContent>

      {/* Opened from the breakdown, the picker is scoped to one invoice state:
          only that state's own units are on offer, and what is chosen there is
          that state's return quantity. */}
      {serialized && pickerBucket && split && (
        <SerialSelectionModal
          open={pickerOpen}
          onOpenChange={(v) => { setPickerOpen(v); if (!v) setPickerBucket(null); }}
          lines={[{
            id: line.id,
            sku: line.sku,
            description: line.description,
            receivedQty: split[pickerBucket],
            uom: line.uom,
            serialPool: bucketPool(pickerBucket),
            ...(line.image ? { image: line.image } : {}),
          }]}
          activeLineId={line.id}
          selected={{ [line.id]: bucketSerials(pickerBucket) }}
          onChange={(_, next) => {
            setBucketPicks((prev) => ({ ...prev, [pickerBucket]: next }));
            setAllocation((prev) => ({ ...prev, [pickerBucket]: next.length }));
          }}
          sourceLabel={`${BUCKET_LABELS[pickerBucket]} units`}
        />
      )}

      {serialized && !pickerBucket && (
        <SerialSelectionModal
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          lines={[{
            id: line.id,
            sku: line.sku,
            description: line.description,
            receivedQty: line.receivedQty,
            uom: line.uom,
            serialPool,
            ...(line.image ? { image: line.image } : {}),
          }]}
          activeLineId={line.id}
          selected={{ [line.id]: serials }}
          onChange={(_, next) => setSerials(next)}
        />
      )}
    </Dialog>
  );
}
