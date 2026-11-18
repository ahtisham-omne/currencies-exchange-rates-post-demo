/**
 * Who takes each item back, and how much of it, inside the confirmation.
 *
 * A return of counted stock answers everything else on the first step, so this
 * is the only place its vendor is decided. The confirmation used to state the
 * drafts it was about to write without letting anyone touch them: the split was
 * already made, from the most recent receivers, and the only way to see or
 * change it was a step that no longer exists for these returns.
 *
 * So it is editable here. Each item lists the vendors carrying it with what
 * each is taking, the figure is adjustable, another vendor can be added and the
 * quantity split onto them, and a vendor cannot be asked for more than they
 * shipped -- the ceiling that the second step used to enforce follows the
 * decision to wherever the decision is made.
 */

import { TrackingTag } from '@/app/components/rma/TrackingTag';
import { useMemo, useState } from 'react';
import { AlertCircle, ArrowRight, Building2, Check, Plus, Search, Trash2 } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/app/components/ui/popover';
import { formatQty } from '@/app/components/vendorSelectionModel';
import { QtyStepper } from '@/app/components/rma/QtyStepper';
import { TRACKING_CHIP, TRACKING_LABELS,
  type TrackingMode,
} from '@/app/data/itemProvenance';

export interface SplitVendor {
  vendorCode: string;
  vendorName: string;
  qty: number;
  /** What they shipped. A vendor credits what they sold, so this is a ceiling. */
  cap: number;
}

export interface SplitItem {
  sku: string;
  uom: string;
  trackingMode: TrackingMode;
  /** How much of it is going back in total, from the first step. */
  qty: number;
  vendors: SplitVendor[];
  /** Vendors who shipped it and are not carrying any of it yet. */
  addable: { code: string; name: string; cap: number }[];
  /** Named units decide their own vendor, so those rows are read only. */
  derived: boolean;
}

export function ReturnVendorSplitList({
  items,
  onQty,
  onAddVendor,
  onRemoveVendor,
}: {
  items: SplitItem[];
  onQty: (sku: string, vendorCode: string, qty: number) => void;
  onAddVendor: (sku: string, vendorCode: string) => void;
  onRemoveVendor: (sku: string, vendorCode: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      {items.map((item) => {
        const placed = item.vendors.reduce((n, v) => n + v.qty, 0);
        const short = Math.round((item.qty - placed) * 100) / 100;
        return (
          <div key={item.sku} className="overflow-hidden rounded-lg border border-[#E2E8F0]">
            <div className="flex items-center gap-2 border-b border-[#EEF2F6] bg-[#FAFBFC] px-3 py-2">
              <span className="truncate text-[12px] text-foreground" style={{ fontWeight: 700 }}>
                {item.sku}
              </span>
              <TrackingTag mode={item.trackingMode} />
              <span className="min-w-0 flex-1" />
              <span className="shrink-0 text-[11px] text-slate-500 tabular-nums whitespace-nowrap">
                {formatQty(item.qty)} {item.uom} going back
              </span>
            </div>

            <div className="divide-y divide-[#EEF2F6]">
              {item.vendors.length === 0 ? (
                <p className="px-3 py-3 text-center text-[12px] text-slate-400">
                  No vendor on this item yet.
                </p>
              ) : (
                item.vendors.map((v) => {
                  const over = Math.round((v.qty - v.cap) * 100) / 100;
                  return (
                    <div key={v.vendorCode} className="px-3 py-2">
                      <div className="flex items-center gap-2.5">
                        <span className="flex w-6 h-6 shrink-0 items-center justify-center rounded-md border border-[#EEF2F6] bg-slate-50 text-slate-400">
                          <Building2 className="w-3 h-3" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[12px] text-foreground" style={{ fontWeight: 600 }}>
                            {v.vendorName}
                          </p>
                          <p className="text-[10px] text-slate-500 tabular-nums">
                            {item.derived ? 'From their receiving doc' : `up to ${formatQty(v.cap)} ${item.uom}`}
                          </p>
                        </div>
                        {item.derived ? (
                          // Named units carry their own vendor. Offering a
                          // field here would invite a figure the serials
                          // cannot back up.
                          <span className="shrink-0 text-[12px] text-foreground tabular-nums whitespace-nowrap" style={{ fontWeight: 600 }}>
                            {formatQty(v.qty)}{' '}
                            <span className="text-[10px] text-slate-500" style={{ fontWeight: 500 }}>{item.uom}</span>
                          </span>
                        ) : (
                          <div className="flex shrink-0 items-center gap-1.5">
                            <QtyStepper
                              value={v.qty}
                              cap={v.cap}
                              ariaLabel={`Quantity of ${item.sku} going back to ${v.vendorName}`}
                              onChange={(n) => onQty(item.sku, v.vendorCode, n)}
                            />
                            <span className="text-[11px] text-slate-500 w-8">{item.uom}</span>
                            <button
                              type="button"
                              onClick={() => onRemoveVendor(item.sku, v.vendorCode)}
                              aria-label={`Take ${v.vendorName} off ${item.sku}`}
                              className="flex w-6 h-6 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                      {over > 0 && (
                        <p className="flex items-center gap-1.5 pl-8 pt-1 text-[11px] text-red-700" style={{ fontWeight: 600 }}>
                          <AlertCircle className="w-3 h-3 shrink-0" />
                          {formatQty(over)} {item.uom} more than they shipped
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {!item.derived && (
              <div className="flex items-center justify-between gap-3 border-t border-[#EEF2F6] px-3 py-2">
                {/* What is not yet with anybody. It is the figure that has to
                    reach zero, so it is stated next to the way to fix it. */}
                <span
                  className={`min-w-0 truncate text-[11px] tabular-nums ${
                    short > 0 ? 'text-amber-700' : 'text-slate-500'
                  }`}
                  style={{ fontWeight: short > 0 ? 600 : 500 }}
                >
                  {short > 0
                    ? `${formatQty(short)} ${item.uom} still without a vendor`
                    : short < 0
                      ? `${formatQty(placed)} ${item.uom} placed, ${formatQty(-short)} over`
                      : 'All of it placed'}
                </span>
                <AddVendor
                  sku={item.sku}
                  addable={item.addable}
                  uom={item.uom}
                  onAdd={(code) => onAddVendor(item.sku, code)}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Another vendor to carry part of it, searchable because the list is as long
 *  as the number of partners who ever shipped the part. */
function AddVendor({
  sku,
  addable,
  uom,
  onAdd,
}: {
  sku: string;
  addable: { code: string; name: string; cap: number }[];
  uom: string;
  onAdd: (code: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? addable.filter((v) => v.name.toLowerCase().includes(q) || v.code.toLowerCase().includes(q)) : addable;
  }, [query, addable]);

  if (addable.length === 0) return null;

  return (
    // Controlled, because choosing a vendor has to close it. Left open, the
    // list sat over the dialog's own footer and covered the Save button that
    // the choice had just enabled.
    <Popover open={open} onOpenChange={(next) => { setOpen(next); if (!next) setQuery(''); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Add a vendor for ${sku}`}
          className="shrink-0 inline-flex items-center gap-1 h-7 rounded-md border border-slate-200 bg-white px-2 text-[11px] text-foreground transition-colors hover:bg-slate-50 hover:border-primary/40 whitespace-nowrap"
          style={{ fontWeight: 600 }}
        >
          <Plus className="w-3 h-3 text-slate-400" />
          Add vendor
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={6}
        className="w-[280px] p-0 rounded-lg border border-[#E2E8F0] overflow-hidden z-[220] shadow-[0_8px_30px_rgba(16,24,40,0.12)]"
      >
        <div className="p-2 border-b border-[#EEF2F6]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search vendors"
              aria-label={`Search vendors that shipped ${sku}`}
              className="h-8 w-full rounded-md border border-slate-200 bg-white pl-8 pr-2 text-[12px] text-foreground placeholder:text-slate-400 outline-none transition-colors focus:border-primary/40 focus:ring-1 focus:ring-primary/20"
            />
          </div>
        </div>
        {shown.length === 0 ? (
          <p className="px-3 py-4 text-center text-[12px] text-slate-400">
            No vendor here matches "{query.trim()}".
          </p>
        ) : (
          <div className="divide-y divide-[#EEF2F6] max-h-[240px] overflow-y-auto">
            {shown.map((v) => (
              <button
                key={v.code}
                type="button"
                onClick={() => { onAdd(v.code); setOpen(false); setQuery(''); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-[#F7FAFF]"
              >
                <span className="flex w-6 h-6 shrink-0 items-center justify-center rounded-md border border-[#EEF2F6] bg-slate-50 text-slate-400">
                  <Building2 className="w-3 h-3" />
                </span>
                <span className="min-w-0 flex-1 truncate text-[12px] text-foreground" style={{ fontWeight: 500 }}>
                  {v.name}
                </span>
                <span className="shrink-0 text-[10px] text-slate-400 tabular-nums whitespace-nowrap">
                  up to {formatQty(v.cap)} {uom}
                </span>
              </button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
