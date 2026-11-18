/**
 * One part, as a searchable result row.
 *
 * The by-item picker and the search section on the first step list the same
 * thing and must list it identically, so the row lives here rather than inside
 * either of them. Thumbnail, identity, how it is tracked, what the description
 * says, and how much of it is going back -- nothing about vendors, which is the
 * whole point of asking for the item first.
 */

import { TrackingTag } from '@/app/components/rma/TrackingTag';
import {
  ITEMS_MODULE_URL,
  ItemDescriptionWithToggle,
  longDescriptionFor,
} from '@/app/components/VendorSelectionItemCell';
import { ItemImageWithPreview } from '@/app/components/invoice-details/ItemQuickView';
import { ScanLine, Trash2 } from 'lucide-react';
import { formatQty } from '@/app/components/vendorSelectionModel';
import { ReturnQtyField } from '@/app/components/rma/ReturnQtyField';
import { TRACKING_CHIP, TRACKING_LABELS, type ReturnableItem } from '@/app/data/itemProvenance';


/** Amber chip on the matched substring — the same match treatment the vendor
 *  picker uses, so a search result reads the same wherever it appears. */
export function highlight(text: string, query: string) {
  const q = query.trim();
  if (!q) return text;
  const parts = text.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === q.toLowerCase() ? (
          <mark key={i} className="bg-amber-100 text-amber-900 rounded-sm px-0.5" style={{ fontWeight: 'inherit' }}>
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
}


/** One part. Thumbnail, identity, how it is tracked, and what is left to send
 *  back -- nothing about vendors, which is the whole point of this step. */
export function ItemResultRow({
  item,
  query,
  qty,
  added,
  onQty,
  onRemove,
  onPreview,
  quickViewOpen,
  onPickSerials,
}: {
  item: ReturnableItem;
  query: string;
  qty: number;
  added: boolean;
  onQty: (qty: number) => void;
  /** Take it off the return. Only on rows that are already on it, where
   *  changing your mind is otherwise a matter of clearing a field and hoping. */
  onRemove?: (() => void) | undefined;
  onPreview: (sku: string) => void;
  quickViewOpen: boolean;
  /** Serialized parts do not take a typed figure. Naming the units is the
   *  quantity, so Add opens the unit picker instead of a stepper. Absent on
   *  surfaces that have no picker to open, where the stepper stands in. */
  onPickSerials?: ((sku: string) => void) | undefined;
}) {
  const picked = qty > 0;
  return (
    <div
      className={`flex items-center gap-3 px-6 py-3 border-b border-[#EEF2F6] transition-colors ${
        added ? 'opacity-60' : picked ? 'bg-[#F8FAFF]' : 'hover:bg-[#FAFBFC]'
      }`}
      title={added ? 'Already on this return' : undefined}
    >
      {/* The same three affordances an item carries everywhere else in the
          suite: hover the image for the master-data card, click it for the
          full view, and the item number opens the Items module. A part is
          being sent back to a supplier here, so being able to check what it
          actually is matters more on this screen than on most. */}
      <div onClick={(e) => e.stopPropagation()} className="shrink-0">
        <ItemImageWithPreview
          sku={item.sku}
          alt={item.sku}
          onPreview={() => onPreview(item.sku)}
          disabled={quickViewOpen}
          size={40}
          unitPrice={item.unitPrice}
          uom={item.uom}
          serialized={item.trackingMode === 'serialized'}
          trackingLabel={TRACKING_LABELS[item.trackingMode]}
          contentZ="z-[260]"
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 min-w-0">
          <a
            href={ITEMS_MODULE_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-[14px] text-foreground truncate hover:text-primary hover:underline decoration-primary/60 underline-offset-2 transition-colors"
            style={{ fontWeight: 600 }}
          >
            {highlight(item.sku, query)}
          </a>
          <TrackingTag mode={item.trackingMode} size="md" />
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <ItemDescriptionWithToggle
            description={longDescriptionFor(item.sku, item.description)}
            highlightText={highlight}
            itemSearch={query}
            widthClass="w-full"
            hugText
            textClass="text-[12px]"
          />
        </div>
      </div>
      {/* The count is a different question from the identity, so it is given
          room rather than butted against the description. */}
      {/* Saying how much is coming back is the same act as putting the part on
          the return, so the field is the only control on the row. The ceiling
          sits against it rather than in a tooltip: it is the number that
          decides whether what is being typed is possible at all. */}
      {added ? (
        <div className="shrink-0 pl-10">
          <p className="text-[11px] text-slate-500" style={{ fontWeight: 600 }}>
            On this return
          </p>
        </div>
      ) : item.trackingMode === 'serialized' && onPickSerials ? (
        // A serialized return does not take a count. Which units are going back
        // is the question, and answering it answers the quantity: five serials
        // picked is five units. Typing 5 into a stepper would leave the return
        // claiming a number no unit list can back up.
        <div className="shrink-0 pl-10 flex flex-col items-end gap-2 min-w-[206px]">
          <div className="flex items-center justify-end gap-1.5">
            {/* Named units, said the same way a typed figure is: what is on the
                return, then what is left of the receipt. */}
            {picked && (
              <span
                className="inline-flex items-center h-[20px] rounded-md bg-blue-50 border border-blue-100 px-1.5 text-[10px] text-primary tabular-nums whitespace-nowrap"
                style={{ fontWeight: 600 }}
              >
                {formatQty(qty)} {item.uom} selected
              </span>
            )}
            <span className="text-[13px] text-foreground tabular-nums whitespace-nowrap" style={{ fontWeight: 600 }}>
              {formatQty(Math.max(0, item.returnableQty - qty))}{' '}
              <span className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>{item.uom}</span>
            </span>
          </div>
          {/* A serialized row printed the figure and its unit and nothing
              else, while a counted row beside it said "available to return"
              under the same number. One of them was a quantity somebody had
              to guess the meaning of. */}
          <p className="-mt-1 text-[11px] text-slate-500">available to return</p>
          <button
            type="button"
            onClick={() => onPickSerials(item.sku)}
            className={
              picked
                ? 'inline-flex items-center justify-center gap-1.5 h-8 rounded-lg px-3 text-[12px] border border-slate-200 bg-white text-foreground transition-colors hover:bg-slate-50 whitespace-nowrap'
                : 'inline-flex items-center justify-center gap-1.5 h-8 rounded-lg px-3.5 text-[12px] bg-primary text-white shadow-sm transition-colors hover:bg-blue-700'
            }
            style={{ fontWeight: picked ? 500 : 600 }}
          >
            <ScanLine className="w-3.5 h-3.5" />
            {picked ? 'Change units' : 'Add units'}
          </button>
        </div>
      ) : (
        <ReturnQtyField
          sku={item.sku}
          qty={qty}
          cap={item.returnableQty}
          uom={item.uom}
          trackingMode={item.trackingMode}
          onQty={onQty}
        />
      )}

      {/* Changing your mind about a part is as ordinary as adding one, and on
          this list there was no way to do it: clearing the field left the line
          on the return at zero. */}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          aria-label={`Take ${item.sku} off this return`}
          className="ml-2 shrink-0 flex w-7 h-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
