import { Lock, Wand2 } from 'lucide-react';
import { Checkbox } from '@/app/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/app/components/ui/popover';
import { unitsAllocated } from '@/app/data/ar/mockCustomers';
import type { UnitAllocation } from '@/app/data/ar/mockCustomerInvoices';

/* Locked units (Mahreen 11/4): on a Revenue on invoice advance every open
 * unit on the line is locked to the customer, by serial or by lot. The
 * chip rides the SKU line (user 11/4: no extra row height) and opens the
 * picker; the units are auto-filled oldest first until the user picks. */

export interface LockedUnitsInfo {
  units: UnitAllocation[];
  needed: number;
  pool: UnitAllocation[];
  tracking: 'Serial' | 'Lot';
  auto: boolean;
}

const plural = (n: number, one: string, many: string) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;

function summary(info: LockedUnitsInfo): string {
  const n = unitsAllocated(info.units);
  if (info.tracking === 'Serial') return `${plural(n, 'serial', 'serials')} locked`;
  return `${plural(info.units.length, 'lot', 'lots')} · ${plural(n, 'unit', 'units')} locked`;
}

export function LockedUnitsChip({
  id,
  sku,
  uom,
  info,
  error,
  onChange,
}: {
  id?: string;
  sku: string;
  uom: string;
  info: LockedUnitsInfo;
  error?: boolean;
  /** Omit for read-only (detail page). undefined units = back to auto-fill. */
  onChange?: (units: UnitAllocation[] | undefined) => void;
}) {
  const got = unitsAllocated(info.units);
  const short = got < info.needed;
  const tone = error || (short && onChange)
    ? 'bg-rose-50 text-rose-700 border-rose-200'
    : 'bg-emerald-50 text-emerald-700 border-emerald-200';
  const picked = new Map(info.units.map((u) => [u.id, u.qty]));

  const toggle = (u: UnitAllocation) => {
    if (!onChange) return;
    if (picked.has(u.id)) {
      onChange(info.units.filter((x) => x.id !== u.id));
      return;
    }
    const left = info.needed - got;
    if (left <= 0) return;
    // Pool order is oldest first; keep the picks in that order.
    const next = [...info.units, { id: u.id, qty: Math.min(u.qty, left) }];
    const order = new Map(info.pool.map((p, i) => [p.id, i]));
    onChange(next.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)));
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          onClick={(e) => e.stopPropagation()}
          className={`inline-flex items-center gap-1 px-1.5 py-px rounded border text-[10px] whitespace-nowrap transition-colors hover:brightness-[0.98] ${tone}`}
          style={{ fontWeight: 500 }}
        >
          <Lock className="w-2.5 h-2.5" />
          {short && onChange ? `${got.toLocaleString('en-US')} of ${info.needed.toLocaleString('en-US')} locked` : summary(info)}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" side="bottom" className="w-[300px] p-0 rounded-xl border border-border/60 shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden z-[300]" onClick={(e) => e.stopPropagation()}>
        <div className="px-3.5 py-2.5 border-b border-border/50 bg-[#FAFBFC] flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[12.5px] text-foreground" style={{ fontWeight: 500 }}>
              Locked {info.tracking === 'Serial' ? 'Serial Numbers' : 'Lots'} · {sku}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
              {got.toLocaleString('en-US')} of {info.needed.toLocaleString('en-US')} {uom} locked to this customer
              {info.auto ? ', auto-filled oldest first.' : '.'}
            </p>
          </div>
          {onChange && !info.auto && (
            <button
              type="button"
              onClick={() => onChange(undefined)}
              className="shrink-0 inline-flex items-center gap-1 text-[11px] text-primary hover:text-blue-700 transition-colors"
              style={{ fontWeight: 500 }}
            >
              <Wand2 className="w-3 h-3" />
              Auto-fill
            </button>
          )}
        </div>
        <div className="max-h-[240px] overflow-y-auto custom-scrollbar py-1">
          {(onChange ? info.pool : info.units).map((u) => {
            const on = picked.has(u.id);
            const full = !on && got >= info.needed;
            return (
              <label
                key={u.id}
                className={`flex items-center gap-2.5 px-3.5 py-1.5 text-[12px] ${onChange ? (full ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-slate-50') : ''}`}
              >
                {onChange && <Checkbox checked={on} disabled={full} onCheckedChange={() => toggle(u)} className="rounded border-border" />}
                <span className="text-slate-700 flex-1 min-w-0 truncate">{u.id}</span>
                {info.tracking === 'Lot' && (
                  <span className="text-[11px] text-slate-500 shrink-0">
                    {on ? `${(picked.get(u.id) ?? 0).toLocaleString('en-US')} of ` : ''}
                    {(info.pool.find((p) => p.id === u.id)?.qty ?? u.qty).toLocaleString('en-US')} {uom}
                  </span>
                )}
              </label>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
