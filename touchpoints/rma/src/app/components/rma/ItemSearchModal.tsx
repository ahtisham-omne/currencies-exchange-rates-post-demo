/**
 * By-item start: pick the parts that are going back.
 *
 * The old picker asked for a vendor first and worked out the goods second.
 * That is backwards -- a return starts with something physically in hand, and
 * for anything serialized or lot-controlled the unit already knows its vendor.
 * So this screen asks one question, "what is going back", and says nothing
 * about who it goes back to. The vendor is derived on the next step, and only
 * asked where it genuinely cannot be.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Package, PackageSearch, Search, X } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { ItemQuickViewModal } from '@/app/components/invoice-details/ItemQuickView';
import { formatQty } from '@/app/components/vendorSelectionModel';
import type { ItemPick } from '@/app/components/rma/itemSelectionBridge';
import { ItemSelectRow } from '@/app/components/rma/ItemSelectRow';
import {
  TRACKING_LABELS,
  returnableItems,
  searchReturnableItems,
  type ReturnableItem,
} from '@/app/data/itemProvenance';

interface ItemSearchModalProps {
  onClose: () => void;
  onBack: () => void;
  onContinue: (picks: ItemPick[]) => void;
  /** Parts already on the return. Shown, but not selectable -- silently
   *  dropping them left the user picking something that never appeared. */
  alreadyAdded?: string[];
  /** Reworded when the picker is reopened to extend a return in progress. */
  title?: string;
  subtitle?: string;
  /** Figures already entered when the picker opens. The worked example uses
   *  it to arrive with its two parts answered. */
  initialPicks?: ItemPick[];
}


export function ItemSearchModal({
  onClose,
  onBack,
  onContinue,
  alreadyAdded = [],
  title = 'Search items',
  subtitle = 'Search for a part, tick it, then search again for the next one. Everything you add stays on the list below.',
  initialPicks = [],
}: ItemSearchModalProps) {
  const onReturn = useMemo(() => new Set(alreadyAdded), [alreadyAdded]);
  const [query, setQuery] = useState('');
  // How much of each part is going back. Entering a figure is what puts the
  // part on the return -- the same gesture the purchase-order modal uses to put
  // an item on an order -- so there is no separate tick, and no way to select a
  // part without saying how much of it is coming back.
  const [picked, setPicked] = useState<Map<string, number>>(
    () => new Map(initialPicks.map((p) => [p.sku, p.qty])),
  );
  const [previewSku, setPreviewSku] = useState<string | null>(null);
  /** Which shelf each picked part is written on, so the figure and its unit
   *  travel to the first step together. */
  const [units, setUnits] = useState<Map<string, string>>(
    () => new Map(initialPicks.filter((p) => p.uom).map((p) => [p.sku, p.uom!])),
  );
  /** Parts ticked without a figure. Checking one is a statement that it is
   *  going back; how much of it is a question the first step can answer better,
   *  with the part in front of you and the receipts beside it. They travel at
   *  zero and the step asks for the number. */
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const searchRef = useRef<HTMLInputElement>(null);

  // The whole screen is a search, so the cursor belongs in it on open.
  useEffect(() => { searchRef.current?.focus(); }, []);

  const searching = query.trim().length > 0;
  // Nothing is offered before a search. A list of parts reads as a
  // recommendation, and the returner is not choosing what to send back -- they
  // are holding it. Offering forty parts they did not ask about only invites
  // them to scan a list for something they already know the number of.
  const results = useMemo(() => (searching ? searchReturnableItems(query) : []), [query, searching]);

  // A part already given a quantity stays on screen even when the query moves
  // off it, otherwise the figure becomes invisible and feels lost.
  const pickedItems = useMemo(
    () => returnableItems().filter((i) => picked.has(i.sku) || ticked.has(i.sku)),
    [picked, ticked],
  );
  const rows = useMemo(() => {
    const shown = new Set(results.map((i) => i.sku));
    return [...results, ...pickedItems.filter((i) => !shown.has(i.sku))];
  }, [results, pickedItems]);
  /** What is on the return and not in front of the current query. It used to
   *  be run in under the results with nothing between them, so a second search
   *  looked like it had replaced the first one's answer. It is its own list
   *  now, headed, under the results, and it never empties on a new query. */
  const alsoOn = useMemo(() => {
    const shown = new Set(results.map((i) => i.sku));
    return pickedItems.filter((i) => !shown.has(i.sku));
  }, [results, pickedItems]);

  /** Write a part's quantity. Emptying the field takes the part off the return,
   *  because a part going back in a quantity of nothing is not going back. */
  const setQty = (sku: string, qty: number, cap: number) => {
    if (onReturn.has(sku)) return;
    setPicked((prev) => {
      const next = new Map(prev);
      const clamped = Math.min(Math.max(0, qty), cap);
      if (clamped <= 0) next.delete(sku);
      else next.set(sku, clamped);
      return next;
    });
  };

  // What the footer can honestly say. Quantities across different units of
  // measure do not add up to anything, so the total only names a unit when
  // every part picked shares one.
  const summary = useMemo(() => {
    const entries = [...picked.entries()];
    const catalogue = new Map(returnableItems().map((i) => [i.sku, i]));
    const uoms = new Set(entries.map(([sku]) => catalogue.get(sku)?.uom).filter(Boolean));
    const units = entries.reduce((n, [, qty]) => n + qty, 0);
    return { parts: entries.length, units, uom: uoms.size === 1 ? [...uoms][0]! : 'units' };
  }, [picked]);

  /** Everything on the return: the parts with a figure, and the parts ticked
   *  without one. A tick with no figure is still a part going back. */
  const onReturnCount = useMemo(
    () => new Set([...picked.keys(), ...ticked]).size,
    [picked, ticked],
  );

  const renderRow = (item: ReturnableItem) => {
    const qty = picked.get(item.sku) ?? 0;
    const uom = units.get(item.sku) ?? item.uom;
    return (
      <ItemSelectRow
        key={item.sku}
        item={item}
        query={searching ? query.trim() : ''}
        entry={qty > 0 ? { qty, uom } : undefined}
        // The picker says which parts, the quantity step says how much. The
        // field here asked the second step's question one screen early and
        // left both steps saying the same thing.
        totalOnly
        onCommit={(next) => {
          setUnits((prev) => new Map(prev).set(item.sku, next.uom));
          const shelf = item.stock.find((sh) => sh.uom === next.uom)?.qty ?? item.returnableQty;
          setQty(item.sku, next.qty, shelf);
        }}
        onRemove={() => setQty(item.sku, 0, item.returnableQty)}
        onPreview={setPreviewSku}
        quickViewOpen={previewSku !== null}
        showErrors={false}
        onTick={(sku, empty) =>
          setTicked((prev) => {
            if (prev.has(sku) === empty) return prev;
            const next = new Set(prev);
            if (empty) next.add(sku);
            else next.delete(sku);
            return next;
          })
        }
      />
    );
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-[150]" onClick={onClose} />

      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[151] bg-white border border-border w-[calc(100%-2rem)] max-w-[100%] sm:max-w-[min(70vw,1320px)] h-[100dvh] sm:h-[90vh] max-h-[100dvh] sm:max-h-[90vh] rounded-none sm:rounded-2xl overflow-hidden">
        <div className="h-full flex flex-col">

          {/* Header — same frame as the vendor picker: back chevron, blue
              Package identity tile, title + subtitle, close. */}
          <div className="px-3 sm:px-4 lg:px-5 pt-3 sm:pt-4 pb-3 sm:pb-4 shrink-0 bg-white border-b border-[#EEF2F6]">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5 min-w-0">
                <button
                  type="button"
                  onClick={onBack}
                  className="mt-0.5 w-8 h-8 rounded-lg border border-border bg-white hover:bg-slate-50 hover:border-slate-300 flex items-center justify-center shrink-0 cursor-pointer transition-all"
                  aria-label="Back to previous step"
                  title="Back"
                >
                  <ChevronLeft className="w-4 h-4 text-slate-500" />
                </button>
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                  <Package className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-[15px] sm:text-[17px] text-foreground truncate" style={{ fontWeight: 700 }}>
                    {title}
                  </h2>
                  <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5" style={{ fontWeight: 400 }}>
                    {subtitle}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-500 hover:bg-muted transition-all"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* One field. The four-box hybrid search belonged to the
                vendor-first flow and has no place on an item-first one. */}
            <div className="-mx-3 sm:-mx-4 lg:-mx-5 -mb-3 sm:-mb-4 mt-4 px-3 sm:px-4 lg:px-5 py-3 sm:py-3.5 bg-[#FAFBFC] border-t border-[#EEF2F6]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <Input
                  ref={searchRef}
                  type="text"
                  placeholder="Search by part number or description"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-9 pr-9 h-10 text-[13px] bg-white border-border rounded-lg shadow-sm transition-all focus-visible:ring-2 focus-visible:ring-primary/15 focus-visible:border-primary"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => { setQuery(''); searchRef.current?.focus(); }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded inline-flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                    aria-label="Clear search"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto overscroll-none bg-white">

            {/* The query found nothing, or nothing has been asked yet. Either way
                the pane says so -- and it still says so while a part picked
                under an earlier query sits below, because that part is not a
                result for this one. */}
            {(searching ? results.length === 0 : rows.length === 0) && (
              // Centred in the pane rather than sitting near the top of it: with
              // nothing listed there is no reading order to respect, and an
              // empty pane with its message pinned to the top reads as a list
              // that failed to load.
              <div className="h-full min-h-[320px] flex flex-col items-center justify-center px-6 text-center">
                <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-300 mb-3">
                  {searching ? <Search className="w-5 h-5" /> : <PackageSearch className="w-5 h-5" />}
                </div>
                {/* Naming the three kinds of tracking here is the one place the
                    flow can say, before anything is typed, that all of them
                    come back through the same search. The wording matches the
                    chip each result carries, so the answer looks like the
                    question. */}
                <p className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>
                  {searching
                    ? `Nothing matches "${query.trim()}"`
                    : 'Search serialized, lot tracked and non-serialized items'}
                </p>
                <p className="text-[12px] text-slate-500 mt-1 max-w-sm">
                  {searching
                    ? 'Try the part number, or a word from the description. Stock created in inventory, with no receipt behind it, can be returned too.'
                    : 'Type a part number, or a word from the description, then tick the parts coming back. How much of each is the next step.'}
                </p>
              </div>
            )}

            {/* The results for this query, and under them the running list of
                what is already on the return. Two headed lists rather than one
                run-on: a second search used to look as though it had replaced
                the first one's answer, which is exactly the thing nobody could
                tell from this screen.

                One array, not two, and the bands are members of it. React keys
                are scoped to the array a child sits in, so rendering the two
                lists as separate children unmounted a row the moment it moved
                from the results into the running list -- and the tick, which
                the row holds, went with it. */}
            {[
              ...(searching && results.length > 0
                ? [
                    <div
                      key="__results"
                      className="sticky top-0 z-20 bg-white flex items-center justify-between px-6 pt-4 pb-2 gap-3 border-b border-[#EEF2F6]"
                    >
                      <span className="text-[12px] text-slate-600 truncate" style={{ fontWeight: 500 }}>
                        Showing results for
                        <span className="ml-1 text-foreground" style={{ fontWeight: 600 }}>{`"${query.trim()}"`}</span>
                      </span>
                      <span className="text-[11px] text-slate-500 shrink-0 tabular-nums" style={{ fontWeight: 500 }}>
                        {results.length} {results.length === 1 ? 'result' : 'results'}
                      </span>
                    </div>,
                  ]
                : []),
              ...results.map(renderRow),
              ...(alsoOn.length > 0
                ? [
                    // Tinted, and it says what it is for. The running list is
                    // the one thing on this screen that survives a new query,
                    // so it is the one thing that has to look like it will.
                    <div
                      key="__running"
                      className="sticky top-0 z-10 border-y border-[#E3EAF5] bg-[#F5F8FE] px-6 py-2.5"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[12px] text-foreground truncate" style={{ fontWeight: 600 }}>
                          On this return
                        </span>
                        <span
                          className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-white px-1.5 text-[11px] text-slate-600 tabular-nums"
                          style={{ fontWeight: 600 }}
                        >
                          {alsoOn.length}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        {searching
                          ? 'Kept while you search. Search again to add the next part.'
                          : 'Search again to add the next part. Untick a row to take it off.'}
                      </p>
                    </div>,
                  ]
                : []),
              ...alsoOn.map(renderRow),
            ]}
          </div>

          <div className="shrink-0 border-t border-[#EEF2F6] bg-white px-3 sm:px-4 lg:px-5 py-2.5 sm:py-3 flex items-center justify-end gap-2 sm:gap-2.5 sm:rounded-b-2xl">
            <div className="text-xs sm:text-[13px] text-slate-500 mr-auto" style={{ fontWeight: 500 }}>
              <span className="text-foreground tabular-nums" style={{ fontWeight: 600 }}>{onReturnCount}</span>{' '}
              {onReturnCount === 1 ? 'item' : 'items'}
              {summary.parts > 0 && (
                <>
                  {' · '}
                  <span className="text-foreground tabular-nums" style={{ fontWeight: 600 }}>
                    {formatQty(summary.units)}
                  </span>{' '}
                  {summary.uom}
                </>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F8FAFC'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
              className="inline-flex items-center justify-center h-8 sm:h-9 rounded-lg px-3 sm:px-5 text-xs sm:text-[13px] border border-slate-200 cursor-pointer transition-colors"
              style={{ fontWeight: 500, color: '#0F172A', backgroundColor: '#FFFFFF' }}
            >
              Cancel
            </button>
            <Button
              // The unit travels with the figure. Without it a pallet count
              // arrived on the first step as an each count.
              onClick={() =>
                onContinue(
                  [...new Set([...picked.keys(), ...ticked])].map((sku) => {
                    const qty = picked.get(sku) ?? 0;
                    const uom = units.get(sku);
                    return uom ? { sku, qty, uom } : { sku, qty };
                  }),
                )
              }
              disabled={onReturnCount === 0}
              className="gap-1.5 rounded-lg px-3 sm:px-5 text-xs sm:text-[13px] h-8 sm:h-9 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* The full item view, opened off a thumbnail. It stacks above the picker
          so the picker stays put underneath rather than closing to show it. */}
      {previewSku && (() => {
        const item = returnableItems().find((i) => i.sku === previewSku);
        return (
          <ItemQuickViewModal
            open
            onClose={() => setPreviewSku(null)}
            sku={previewSku}
            {...(item ? { description: item.description, unitPrice: item.unitPrice, uom: item.uom, serialized: item.trackingMode === 'serialized', trackingLabel: TRACKING_LABELS[item.trackingMode] } : {})}
          />
        );
      })()}
    </>
  );
}
