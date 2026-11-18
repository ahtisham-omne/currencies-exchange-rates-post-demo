/**
 * The picker, as the step.
 *
 * Parts used to be chosen in a modal in front of the first step, which meant
 * the step opened onto a list of decisions already made and hid the one action
 * it exists for. The search is the step now: the same field, the same rows, the
 * same Add. Adding the fifth part is the same gesture as the first.
 *
 * While a query is live the step shows what matched. With the field empty it
 * shows the return being built. One surface, two things to look at, and never
 * both at once -- results and the return read as the same kind of list, and
 * stacking them invites picking from the wrong one.
 */

import { useMemo, useRef, useState } from 'react';
import { PackageSearch, Search, X } from 'lucide-react';
import { Input } from '@/app/components/ui/input';
import { ItemQuickViewModal } from '@/app/components/invoice-details/ItemQuickView';
import { ItemSelectRow } from '@/app/components/rma/ItemSelectRow';
import { ItemResultRow } from '@/app/components/rma/ItemResultRow';
import type { ItemPick } from '@/app/components/rma/itemSelectionBridge';
import {
  TRACKING_LABELS,
  returnableItems,
  searchReturnableItems,
} from '@/app/data/itemProvenance';

/** One part already on the return, and how much of it. */
export interface ReturnLineRow {
  sku: string;
  qty: number;
  /** The unit the figure was entered against. */
  uom: string;
}

export function InlineItemSearch({
  query,
  onQuery,
  lines,
  onAdd,
  onUom,
  showErrors,
  onTick,
  onQty,
  onDrop,
  onOpenLine,
  onPickSerials,
  searchable = true,
}: {
  query: string;
  onQuery: (next: string) => void;
  /** What is on the return. With the field empty, this is what the step shows. */
  lines: ReturnLineRow[];
  onAdd: (picks: ItemPick[]) => void;
  /** Move a part already on the return onto a different unit of measure. */
  onUom: (sku: string, pick: ItemPick) => void;
  /** True once a save has been attempted, so rows may state what is missing. */
  showErrors: boolean;
  /** Rows ticked with nothing in the field, which is what a save refuses. */
  onTick: (sku: string, tickedEmpty: boolean) => void;
  /** Change a part already on the return. */
  onQty: (sku: string, qty: number) => void;
  /** Take the part off the return outright. Setting its quantity to zero left
   *  the line in place, which is a different thing and reads as still chosen. */
  onDrop: (sku: string) => void;
  /** Open everything else about the line -- reason, remedy, units, notes. */
  onOpenLine: (sku: string) => void;
  /** Put a serialized part on the return by naming its units. */
  onPickSerials: (sku: string) => void;
  /** Whether the step searches the whole catalogue. Coming in by vendor it does
   *  not: another part has to come from that vendor's book, which their own
   *  picker is scoped to. The list of lines is the same either way. */
  searchable?: boolean;
}) {
  const [previewSku, setPreviewSku] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const onReturn = useMemo(
    () => new Map(lines.map((l) => [l.sku, { qty: l.qty, uom: l.uom }])),
    [lines],
  );
  const searching = searchable && query.trim().length > 0;
  const results = useMemo(
    () => (searching ? searchReturnableItems(query) : []),
    [query, searching],
  );
  // With nothing typed the step is the return itself. The catalogue is looked
  // up rather than carried on the line so a row here reads exactly like a row
  // in the results -- same thumbnail, same chip, same ceiling.
  const onIt = useMemo(() => {
    const catalogue = new Map(returnableItems().map((i) => [i.sku, i]));
    return lines.flatMap((l) => {
      const item = catalogue.get(l.sku);
      return item ? [{ item, qty: l.qty }] : [];
    });
  }, [lines]);

  return (
    <>
      {searchable && (
      <div className="shrink-0 px-4 sm:px-5 pt-3 pb-2.5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <Input
            ref={searchRef}
            type="text"
            // Less that is true beats more that is false: the field does not
            // promise a list of the fields it matches, and will not have to be
            // corrected when it matches more of them.
            placeholder="Search items"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            aria-label="Search parts to return"
            className="pl-9 pr-9 h-10 text-[13px] bg-white border-border rounded-lg shadow-sm transition-all focus-visible:ring-2 focus-visible:ring-primary/15 focus-visible:border-primary"
          />
          {query && (
            <button
              type="button"
              onClick={() => { onQuery(''); searchRef.current?.focus(); }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded inline-flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              aria-label="Clear search"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
      )}

      {searching && (
        <div className="flex-1 min-h-0 overflow-y-auto items-scroll bg-white border-t border-[#EEF2F6]">
          <div className="sticky top-0 z-20 bg-white flex items-center justify-between px-4 sm:px-5 pt-3 pb-2 gap-3 border-b border-[#EEF2F6]">
            <span className="text-[12px] text-slate-600 truncate" style={{ fontWeight: 500 }}>
              Showing results for
              <span className="ml-1 text-foreground" style={{ fontWeight: 600 }}>{`"${query.trim()}"`}</span>
            </span>
            <span className="text-[11px] text-slate-500 shrink-0 tabular-nums" style={{ fontWeight: 500 }}>
              {results.length} {results.length === 1 ? 'result' : 'results'}
            </span>
          </div>

          {results.length === 0 ? (
            <div className="min-h-[280px] flex flex-col items-center justify-center px-6 text-center">
              <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-300 mb-3">
                <PackageSearch className="w-5 h-5" />
              </div>
              <p className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>
                Nothing matches “{query.trim()}”
              </p>
              <p className="text-[12px] text-slate-500 mt-1 max-w-sm">
                Try the part number, or a word from the description. Stock created in
                inventory, with no receipt behind it, can be returned too.
              </p>
            </div>
          ) : (
            results.map((item) => (
              <ItemSelectRow
                key={item.sku}
                item={item}
                query={query.trim()}
                entry={onReturn.get(item.sku)}
                // Ticking a row puts the part on the return outright. There is
                // no basket to gather into: the list behind an empty field is
                // the return, and it is one keystroke away. A part already on
                // it takes the same control, so a second pallet found mid-search
                // does not have to be added somewhere else.
                onCommit={(next) => {
                  const on = onReturn.get(item.sku);
                  if (!on) onAdd([{ sku: item.sku, qty: next.qty, uom: next.uom }]);
                  else if (on.uom !== next.uom) onUom(item.sku, { sku: item.sku, qty: next.qty, uom: next.uom });
                  else onQty(item.sku, next.qty);
                }}
                onRemove={() => { if (onReturn.has(item.sku)) onDrop(item.sku); }}
                onPreview={setPreviewSku}
                quickViewOpen={previewSku !== null}
                showErrors={showErrors}
                onTick={onTick}
              />
            ))
          )}
        </div>
      )}

      {!searching && (
        <div className="flex-1 min-h-0 overflow-y-auto items-scroll bg-white border-t border-[#EEF2F6]">
          {onIt.length === 0 ? (
            <div className="min-h-[300px] flex flex-col items-center justify-center px-6 text-center">
              <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-300 mb-3">
                <PackageSearch className="w-5 h-5" />
              </div>
              {/* Naming the three kinds of tracking here is the one place the
                  flow can say, before anything is typed, that all of them come
                  back through the same search. The wording matches the chip
                  each result carries, so the answer looks like the question. */}
              <p className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>
                Search serialized, lot tracked and non-serialized items
              </p>
              <p className="text-[12px] text-slate-500 mt-1 max-w-sm">
                Type a part number, or a word from the description, then enter how much of it is
                going back.
              </p>
            </div>
          ) : (
            <>
              <div className="sticky top-0 z-20 bg-white flex items-center justify-between px-4 sm:px-5 pt-3 pb-2 gap-3 border-b border-[#EEF2F6]">
                <span className="text-[12px] text-slate-600 truncate" style={{ fontWeight: 500 }}>
                  On this return
                </span>
                <span className="text-[11px] text-slate-500 shrink-0 tabular-nums" style={{ fontWeight: 500 }}>
                  {onIt.length} {onIt.length === 1 ? 'item' : 'items'}
                </span>
              </div>
              {/* A row here is the same row as a result, plus the rest of the
                  line behind it: clicking opens reason, remedy, named units,
                  notes and files. The quantity control stays on the row because
                  changing how much comes back is the one thing done often
                  enough not to be worth a modal. */}
              {onIt.map(({ item, qty }) => (
                <div key={item.sku} onClick={(e) => {
                  const t = e.target as HTMLElement;
                  if (!e.currentTarget.contains(t)) return;
                  if (t.closest('input, button, select, textarea, a, [role="combobox"]')) return;
                  onOpenLine(item.sku);
                }} className="cursor-pointer">
                  <ItemResultRow
                    item={item}
                    query=""
                    qty={qty}
                    added={false}
                    onQty={(n) => onQty(item.sku, n)}
                    onRemove={() => onDrop(item.sku)}
                    onPreview={setPreviewSku}
                    quickViewOpen={previewSku !== null}
                    onPickSerials={onPickSerials}
                  />
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {previewSku && (() => {
        const item = returnableItems().find((i) => i.sku === previewSku);
        return (
          <ItemQuickViewModal
            open
            onClose={() => setPreviewSku(null)}
            sku={previewSku}
            {...(item
              ? {
                  description: item.description,
                  unitPrice: item.unitPrice,
                  uom: item.uom,
                  serialized: item.trackingMode === 'serialized',
                  trackingLabel: TRACKING_LABELS[item.trackingMode],
                }
              : {})}
          />
        );
      })()}
    </>
  );
}
