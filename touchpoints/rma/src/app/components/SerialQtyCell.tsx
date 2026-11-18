/**
 * Quantity control for a serialized return line: the count is a consequence of
 * which units were picked, so the cell opens the picker instead of accepting a
 * typed number. Shared by the create flow's line editor and the detail page's
 * line edit modal so a Draft reads the same either side of submission.
 */
import { useMemo } from 'react';
import { ChevronDown } from 'lucide-react';

import { availableSerials } from '@/app/data/mockRMAs';

export function SerialQtyCell({
  sku,
  poLineId,
  receivedQty,
  selected,
  onOpen,
  size = 'sm',
  poolSize,
  align = 'end',
}: {
  sku: string;
  poLineId: string;
  receivedQty: number;
  selected: string[];
  onOpen: () => void;
  /** 'md' matches the 9-unit control height the expanded editor uses, so the
   *  cell lines up with the received field beside it. */
  size?: 'sm' | 'md';
  /** Overrides the derived pool where the caller already knows it, so a line
   *  whose serials were recorded elsewhere still tones correctly. */
  poolSize?: number;
  /** Follows whichever way the numbers beside it read. The grid right-aligns
   *  its quantity column; the expanded editor reads from the left. */
  align?: 'start' | 'end';
}) {
  const derived = useMemo(
    () => availableSerials(sku, poLineId, receivedQty).length,
    [sku, poLineId, receivedQty],
  );
  const total = poolSize ?? derived;

  // Three states, not two: everything going back reads as the default, a
  // narrowed selection is a deliberate choice worth flagging, and an empty
  // one blocks the line.
  const tone = selected.length === 0
    ? 'bg-rose-50 border-rose-300 text-rose-700 hover:bg-rose-100 hover:border-rose-400'
    : selected.length < total
      ? 'bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100 hover:border-amber-400'
      : 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100 hover:border-emerald-400';

  return (
    <button
      type="button"
      onClick={onOpen}
      /* Every other qty cell in the column is a white typed input, so this one
         carries a tinted fill instead: the surface is what says "picked, not
         entered" before the chevron is even read. */
      className={`group/serial flex items-center gap-1 w-full pl-2 pr-1.5 rounded-md border cursor-pointer transition-colors ${
        align === 'start' ? 'justify-start' : 'justify-end'
      } ${size === 'md' ? 'h-9 pr-2.5' : 'h-7'} ${tone}`}
      aria-label={`Choose serial numbers for ${sku}`}
      title={`${selected.length} of ${total} units selected`}
    >
      {selected.length === 0 ? (
        <span className={`truncate ${size === 'md' ? 'text-[12px]' : 'text-[11px]'}`} style={{ fontWeight: 600 }}>Select units</span>
      ) : (
        <>
          <span className={`tabular-nums ${size === 'md' ? 'text-[12px]' : 'text-[11px]'}`} style={{ fontWeight: 600 }}>{selected.length}</span>
          <span className="text-[10px] opacity-70" style={{ fontWeight: 500 }}>units</span>
        </>
      )}
      <ChevronDown className={`w-3 h-3 shrink-0 opacity-60 transition-opacity group-hover/serial:opacity-100 ${align === 'start' ? 'ml-auto' : ''}`} />
    </button>
  );
}
