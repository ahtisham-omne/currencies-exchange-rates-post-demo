/**
 * What this return adds up to, and how many returns it becomes.
 *
 * The purchasing cart's order summary, in the same four bands: a title, a
 * per-partner breakdown, the totals with the last one escalated, and the note
 * that says the thing the grouping only implies -- that this is about to become
 * several documents rather than one.
 *
 * The step's own footer carries the save action, so the panel does not repeat
 * it. The cart needs its button here because its page has no footer; ours does,
 * and two primary buttons on one screen is a question rather than an action.
 */

import { formatQty } from '@/app/components/vendorSelectionModel';

const money = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export interface ReturnSummaryGroup {
  vendorName: string;
  partCount: number;
  units: number;
  uom: string;
  value: number;
}

export function ReturnSummaryPanel({
  groups,
  total,
}: {
  groups: ReturnSummaryGroup[];
  total: number;
}) {
  const units = groups.reduce((n, g) => n + g.units, 0);
  const parts = groups.reduce((n, g) => n + g.partCount, 0);
  const uoms = new Set(groups.map((g) => g.uom));
  const unitLabel = uoms.size === 1 ? [...uoms][0]! : 'units';

  return (
    <div className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-white">
      <div className="border-b border-[#EEF2F6] px-5 py-3">
        <span className="text-[13px] text-foreground" style={{ fontWeight: 700 }}>Return summary</span>
      </div>

      {/* One row per vendor, which is one row per return this becomes. */}
      <div className="flex flex-col gap-2.5 border-b border-[#EEF2F6] px-5 py-3">
        {groups.length === 0 ? (
          <p className="text-[12px] text-slate-500">
            Name a vendor on each line and this will say what goes back to whom.
          </p>
        ) : (
          groups.map((g) => (
            <div key={g.vendorName} className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12px] text-slate-600">{g.vendorName}</div>
                <div className="text-[10px] text-slate-400" style={{ fontWeight: 500 }}>
                  {g.partCount} {g.partCount === 1 ? 'item' : 'items'} · {formatQty(g.units)} {g.uom}
                </div>
              </div>
              <span className="shrink-0 text-[12px] text-foreground tabular-nums" style={{ fontWeight: 600 }}>
                {money(g.value)}
              </span>
            </div>
          ))
        )}
      </div>

      <div className="flex flex-col gap-2 px-5 py-3">
        <div className="flex items-center justify-between text-[12px] text-slate-500">
          <span>Going back ({parts} {parts === 1 ? 'item' : 'items'})</span>
          <span className="text-foreground tabular-nums" style={{ fontWeight: 500 }}>
            {formatQty(units)} {unitLabel}
          </span>
        </div>
        {/* The last figure escalates, as the cart's total does: a bigger, bolder
            number so the eye stops on the one that matters. */}
        <div className="mt-1 flex items-center justify-between border-t border-[#EEF2F6] pt-2 text-[13px] text-foreground" style={{ fontWeight: 600 }}>
          <span>Return value</span>
          <span className="text-[15px] tabular-nums" style={{ fontWeight: 700 }}>{money(total)}</span>
        </div>
      </div>

    </div>
  );
}
