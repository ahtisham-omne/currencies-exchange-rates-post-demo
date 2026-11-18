/**
 * How a return line settles, stated per invoice state.
 *
 * A line that was part paid, part billed and part still on accrual settles
 * three ways at once, so quantity, reason, remedy and price are all answered
 * per state rather than per line. A line sitting in one state answers the same
 * questions once, through the same card, so the two read as one thing.
 */

import { ScanLine, RotateCcw, CalendarClock } from 'lucide-react';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import type { ReturnReason } from '@/app/data/mockRMAs';
import type { LineInvoiceSplit } from '@/app/data/receiptInvoiceStatus';
import {
  allocationTotal,
  autoAllocate,
  BUCKET_CHIP,
  BUCKET_HINTS,
  BUCKET_LABELS,
  bucketReturnTypeOptions,
  RETURN_BUCKETS,
  type ReturnAllocation,
  type ReturnBucket,
} from '@/app/data/rmaReturnAllocation';

export function ReturnAllocationControl({
  split,
  uom,
  allocation,
  onAllocationChange,
  bucketTypeFor,
  onBucketTypeChange,
  bucketReasonFor,
  onBucketReasonChange,
  bucketPriceFor,
  reasons,
  onPickUnits,
  expectedResolution,
  onExpectedResolutionChange,
}: {
  split: LineInvoiceSplit;
  uom: string;
  allocation: ReturnAllocation;
  onAllocationChange: (next: ReturnAllocation) => void;
  bucketTypeFor: (bucket: ReturnBucket, bucketQty: number) => string;
  onBucketTypeChange: (bucket: ReturnBucket, next: string) => void;
  bucketReasonFor: (bucket: ReturnBucket) => string;
  onBucketReasonChange: (bucket: ReturnBucket, next: string) => void;
  bucketPriceFor: (bucket: ReturnBucket) => number;
  reasons: readonly string[];
  /** Serialized lines return named units, so the bucket quantity is the count
   *  of units chosen in the picker rather than a typed number. */
  onPickUnits?: ((bucket: ReturnBucket) => void) | undefined;
  /** When this line's credit is expected to settle. A forecast the user can
   *  move, so it arrives as an ISO date with a setter rather than as text. */
  expectedResolution?: string | undefined;
  onExpectedResolutionChange?: ((next: string) => void) | undefined;
}) {
  const allocated = allocationTotal(allocation);

  const setBucket = (bucket: ReturnBucket, raw: string) => {
    const capped = Math.min(Math.max(0, Number(raw) || 0), split[bucket]);
    onAllocationChange({ ...allocation, [bucket]: capped });
  };

  const round2 = (n: number) => String(Number(n.toFixed(2)));

  const buckets = RETURN_BUCKETS.filter((b) => split[b] > 0.004);

  return (
    <div className="rounded-2xl border border-[#E8ECF1] bg-white overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#DBEAFE] border border-blue-200 shrink-0">
            <RotateCcw className="w-3.5 h-3.5 text-primary" />
          </span>
          <div className="min-w-0">
            <p className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>
              {buckets.length > 1 ? 'Return breakdown' : 'Return details'}
            </p>
            <p className="text-[11px] text-slate-500 mt-px tabular-nums">
              {allocated} of {split.received} {uom} going back
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onAllocationChange(autoAllocate(split.received, split))}
          className="h-6 px-2 rounded-md text-[11px] text-primary hover:bg-primary/5 transition-colors shrink-0"
          style={{ fontWeight: 600 }}
        >
          Return all
        </button>
      </div>

      <div className="border-t border-[#EEF2F6] p-3 sm:p-4 space-y-2.5 bg-white">

      {/* Only worth saying when there is more than one state to reconcile. */}
      {buckets.length > 1 && (
        <p className="text-[11px] text-slate-500 leading-snug">
          These units were billed in different states. Set how much goes back under each, why, and
          how you want it settled.
        </p>
      )}

      <div className="space-y-2">
        {buckets.map((bucket) => {
          const bucketQty = allocation[bucket];
          const price = bucketPriceFor(bucket);
          return (
            <div key={bucket} className="rounded-lg border border-[#E8ECF1] bg-white overflow-hidden">
              <div className="px-3 py-2 border-b border-[#F1F5F9] bg-[#FAFBFC] flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className={`inline-flex items-center px-1.5 py-px rounded-full text-[10px] border ${BUCKET_CHIP[bucket]}`}
                      style={{ fontWeight: 600 }}
                    >
                      {BUCKET_LABELS[bucket]}
                    </span>
                    <span className="text-[11px] text-slate-500 tabular-nums" style={{ fontWeight: 500 }}>
                      {split[bucket]} {uom} available
                    </span>
                  </div>
                </div>
                {onPickUnits ? (
                  <button
                    type="button"
                    onClick={() => onPickUnits(bucket)}
                    className={`shrink-0 h-9 rounded-md border bg-white px-2.5 flex items-center gap-1.5 transition-colors ${
                      bucketQty > 0 ? 'border-emerald-200 hover:border-emerald-300' : 'border-slate-200 hover:border-primary/40'
                    }`}
                  >
                    <ScanLine className={`w-3.5 h-3.5 shrink-0 ${bucketQty > 0 ? 'text-emerald-600' : 'text-primary'}`} />
                    <span className={`text-[11px] tabular-nums whitespace-nowrap ${bucketQty > 0 ? 'text-emerald-700' : 'text-foreground'}`} style={{ fontWeight: 600 }}>
                      {bucketQty > 0 ? `${bucketQty} ${uom}` : 'Select units'}
                    </span>
                  </button>
                ) : (
                  <label className={`shrink-0 h-9 w-[96px] rounded-md border bg-white px-2.5 flex items-center gap-1 cursor-text focus-within:ring-1 ${
                    bucketQty > 0 ? 'border-emerald-200 focus-within:ring-emerald-100' : 'border-slate-200 focus-within:ring-primary/20'
                  }`}>
                    <span className="text-[11px] text-slate-500 shrink-0" style={{ fontWeight: 600 }}>{uom}</span>
                    <Input
                      type="number"
                      min={0}
                      max={split[bucket]}
                      value={bucketQty}
                      onChange={(e) => setBucket(bucket, e.target.value)}
                      className={`h-7 flex-1 min-w-0 border-0 bg-transparent p-0 text-left text-[12px] md:text-[12px] tabular-nums font-semibold shadow-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus-visible:ring-0 focus-visible:ring-offset-0 ${
                        bucketQty > 0 ? 'text-emerald-700' : 'text-foreground'
                      }`}
                    />
                  </label>
                )}
              </div>
              <div className="p-3 space-y-2.5 bg-white">
              <p className="text-[11px] text-slate-500 leading-snug">
                {BUCKET_HINTS[bucket]}
              </p>

              {/* The reason, on its own. The type each bucket settles as is
                  still decided from it, and still posts -- it is simply not
                  asked of anybody any more. */}
              <div className="grid grid-cols-1 gap-2">
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>Return Reason</Label>
                  <Select
                    value={bucketReasonFor(bucket)}
                    onValueChange={(next) => onBucketReasonChange(bucket, next)}
                    disabled={bucketQty <= 0}
                  >
                    <SelectTrigger className="h-9 text-[12px] bg-white border-slate-200 hover:border-primary/40 focus:ring-1 focus:ring-primary/20 rounded-md">
                      <SelectValue placeholder="Select reason" />
                    </SelectTrigger>
                    <SelectContent className="text-[12px] z-[220]">
                      {reasons.map((r) => (
                        <SelectItem key={r} value={r} className="text-[12px]">{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {/* Price and total are read-only: the price comes off the
                  receipt the units were billed at, so the return states it
                  rather than letting it be re-typed. */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>Price Per Unit</Label>
                  <div className="h-9 rounded-md border border-slate-200 bg-slate-50 px-2.5 flex items-center gap-1">
                    <span className="text-[11px] text-slate-500" style={{ fontWeight: 600 }}>$</span>
                    <span
                      className={`text-[12px] tabular-nums ${bucketQty > 0 ? 'text-foreground' : 'text-slate-400'}`}
                      style={{ fontWeight: 600 }}
                    >
                      {round2(price)}
                    </span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>Total</Label>
                  <div className="h-9 rounded-md border border-slate-200 bg-slate-50 px-2.5 flex items-center gap-1">
                    <span className="text-[11px] text-slate-500" style={{ fontWeight: 600 }}>$</span>
                    <span
                      className={`text-[12px] tabular-nums ${bucketQty > 0 ? 'text-foreground' : 'text-slate-400'}`}
                      style={{ fontWeight: 600 }}
                    >
                      {round2(bucketQty * price)}
                    </span>
                  </div>
                </div>
              </div>

              {expectedResolution && (
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>Expected resolution date</Label>
                  <label className="h-9 rounded-md border border-slate-200 bg-white px-2.5 flex items-center gap-1.5 cursor-text focus-within:ring-1 focus-within:ring-primary/20 focus-within:border-primary transition-colors">
                    <CalendarClock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <Input
                      type="date"
                      value={expectedResolution}
                      onChange={(e) => onExpectedResolutionChange?.(e.target.value)}
                      className="h-7 flex-1 min-w-0 border-0 bg-transparent p-0 text-[12px] shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                      style={{ fontWeight: 600 }}
                    />
                  </label>
                </div>
              )}
              </div>
            </div>
          );
        })}
      </div>
      </div>
    </div>
  );
}
