/**
 * One part, as a row you tick and put a figure against.
 *
 * The row it replaces led with an Add button that opened a field, recorded the
 * figure and closed again -- the purchasing catalogue's sequence, which suits a
 * cart being filled from a long list. A return is not that: the person already
 * knows what is going back and how much, and the flow's job is to take the
 * number and check it. So the field is always there, what is on hand sits
 * beside it, and typing a figure selects the row.
 *
 * Stock is stated per unit of measure and returned per unit of measure. Two
 * pallets and three sets are two different returns; a single figure could not
 * say which of them was going, so the row asks which unit before it asks how
 * many, and validates against that unit's own shelf.
 */

import { hasSerials } from '@/app/data/itemTracking';
import { TrackingTag } from '@/app/components/rma/TrackingTag';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Check } from 'lucide-react';
import {
  ITEMS_MODULE_URL,
  ItemDescriptionWithToggle,
  longDescriptionFor,
} from '@/app/components/VendorSelectionItemCell';
import { ItemImageWithPreview } from '@/app/components/invoice-details/ItemQuickView';
import { formatQty } from '@/app/components/vendorSelectionModel';
import { QtyUomField, useRefusalNotice } from '@/app/components/rma/QtyUomField';
import { TRACKING_CHIP, TRACKING_LABELS, type ReturnableItem,
  stockSplit,
} from '@/app/data/itemProvenance';

/** Amber chip on the matched substring, the same match treatment the vendor
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

export interface RowEntry {
  qty: number;
  uom: string;
}

export function ItemSelectRow({
  item,
  query,
  entry,
  onCommit,
  onRemove,
  onPreview,
  quickViewOpen,
  showErrors,
  onTick,
  totalOnly = false,
}: {
  item: ReturnableItem;
  query: string;
  /** What is already on the return for this part, if anything. */
  entry: RowEntry | undefined;
  onCommit: (next: RowEntry) => void;
  onRemove: () => void;
  onPreview: (sku: string) => void;
  quickViewOpen: boolean;
  /** Only true once the user has tried to save. Ticking a row and reaching for
   *  the field should not be met with an error between the two gestures. */
  showErrors: boolean;
  /** Ticked, but with nothing in the field yet. The step has to know, because
   *  it is what a save has to refuse. */
  onTick: (sku: string, tickedEmpty: boolean) => void;
  /** The picker asks what is coming back, not how much. The figure is the
   *  quantity step's question and asking it twice made the two steps say the
   *  same thing, so here the row states what was received and ticks. */
  totalOnly?: boolean;
}) {
  const stock =
    item.stock.length > 0
      ? item.stock
      : [
          {
            uom: item.uom,
            qty: item.returnableQty,
            split: stockSplit(item.sku, item.returnableQty),
          },
        ];
  const [uom, setUom] = useState(() => entry?.uom ?? stock[0]!.uom);
  const [draft, setDraft] = useState(() => (entry ? String(entry.qty) : ''));
  // Ticked with nothing in the field. Not an error the moment it happens --
  // the field is where the cursor goes next -- but it is one the step cannot
  // continue past, so it says so on the row.
  const [ticked, setTicked] = useState(() => (entry?.qty ?? 0) > 0);
  const committed = useRef(entry?.qty ?? 0);
  // Set when the row itself takes the line off the return because what is in
  // the field cannot go back -- too many, or nothing at all. The line leaving
  // is then this row's own doing, not an edit from elsewhere, and the figure
  // has to stay on screen for the error beneath it to be about anything.
  const selfCleared = useRef(false);
  // A shelf the user has chosen but the return has not caught up with, because
  // the figure in the field does not fit it yet. Until it does, the row's own
  // choice outranks the line's unit -- otherwise picking a shelf the current
  // figure overflows snapped straight back to the old one.
  const uomChosen = useRef(false);

  // The return is the source of truth for everything except the figure being
  // typed. When it changes underneath the row -- removed from the list below,
  // edited in a sheet -- the row follows; while the row is the one changing it,
  // it leaves its own field alone.
  useEffect(() => {
    // A line left on the return at zero is not on the return. Reading it as
    // one re-ticked the box the moment it was cleared, so unticking a row
    // emptied its field and then said the row was still selected.
    if (entry && entry.qty > 0) {
      selfCleared.current = false;
      if (entry.uom === uom) uomChosen.current = false;
      else if (!uomChosen.current) setUom(entry.uom);
      if (entry.qty !== committed.current) setDraft(String(entry.qty));
      committed.current = entry.qty;
      setTicked(true);
      return;
    }
    if (selfCleared.current) return;
    if (committed.current !== 0) {
      committed.current = 0;
      setDraft('');
      setTicked(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry?.qty, entry?.uom, entry]);

  const onHand = useMemo(
    () => stock.find((s) => s.uom === uom)?.qty ?? 0,
    [stock, uom],
  );
  /** Serialized parts are counted, never measured. */
  const [decimalRefused, refuseDecimal] = useRefusalNotice();
  const typed = draft.trim() === '' ? null : Number(draft);
  const invalid = typed !== null && (!Number.isFinite(typed) || typed < 0);
  const over = typed !== null && Number.isFinite(typed) && typed > onHand;
  const emptyButTicked = ticked && typed === null;
  const error = decimalRefused
    ? `${item.sku} goes back in whole ${uom}. Enter a whole number.`
    : invalid
    ? 'Enter a number'
    : over
      ? `Only ${formatQty(onHand)} ${uom} on-hand`
      // Nothing typed yet is not a mistake until the user says they are done.
      // Flagging it the instant a row is ticked told them off for the gesture
      // they had just made, one keystroke before they answered it.
      : emptyButTicked && showErrors && !totalOnly
        ? 'Enter a quantity'
        : null;

  useEffect(() => {
    onTick(item.sku, emptyButTicked);
    return () => onTick(item.sku, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emptyButTicked, item.sku]);

  /** A figure that is real and possible goes on the return as it is typed. */
  const push = (nextDraft: string, nextUom: string) => {
    const n = nextDraft.trim() === '' ? null : Number(nextDraft);
    if (n === null || !Number.isFinite(n) || n <= 0 || n > (stock.find((s) => s.uom === nextUom)?.qty ?? 0)) {
      if (entry) {
        selfCleared.current = true;
        committed.current = 0;
        onRemove();
      }
      return;
    }
    selfCleared.current = false;
    committed.current = n;
    onCommit({ qty: n, uom: nextUom });
  };

  const setQty = (next: string) => {
    if (!/^\d*(?:\.\d{0,2})?$/.test(next)) return;
    // Goods go back in whole units, whatever the part is tracked by, and the
    // field used to swallow the decimal point rather than say so: 2.5
    // committed as 2, the commit pushed "2" back into the box, and the 5
    // landed behind it as 25. Refused out loud instead.
    // Serial-numbered parts go back whole; anything else can go back in
    // part, a partial box or a cut length (ERP-8654 AC3).
    if (hasSerials(item.trackingMode) && next.includes('.')) { refuseDecimal(); return; }
    setDraft(next);
    // Typing a figure is the selection. Asking for a tick as well would make
    // the number mean nothing until a second gesture agreed with it.
    if (next.trim() !== '') setTicked(true);
    push(next, uom);
  };

  const toggle = () => {
    if (ticked) {
      selfCleared.current = false;
      committed.current = 0;
      setTicked(false);
      setDraft('');
      if (entry) onRemove();
      return;
    }
    setTicked(true);
    push(draft, uom);
  };

  const pickUom = (next: string) => {
    if (next === uom) return;
    uomChosen.current = true;
    setUom(next);
    // The figure was against the old shelf. Carrying it over only holds if the
    // new one can cover it; where it cannot, the row asks again rather than
    // flagging a number the user did not type against this shelf.
    const fits = Number(draft) > 0 && Number(draft) <= (stock.find((s) => s.uom === next)?.qty ?? 0);
    if (fits) { push(draft, next); return; }
    setDraft('');
    setTicked(true);
    if (entry) { selfCleared.current = true; committed.current = 0; onRemove(); }
  };

  return (
    <div
      className={`border-b border-[#EEF2F6] transition-colors ${
        error ? 'bg-red-50/40' : ticked ? 'bg-[#F8FAFF]' : 'hover:bg-[#FAFBFC]'
      }`}
    >
      <div className="flex items-center gap-3 px-6 py-3">
        <button
          type="button"
          role="checkbox"
          aria-checked={ticked}
          onClick={toggle}
          aria-label={`Put ${item.sku} on this return`}
          className={`flex w-[18px] h-[18px] shrink-0 items-center justify-center rounded border transition-colors ${
            ticked
              ? 'border-primary bg-primary text-white'
              : error
                ? 'border-red-300 bg-white'
                : 'border-slate-300 bg-white hover:border-primary/50'
          }`}
        >
          {ticked && <Check className="w-3 h-3" strokeWidth={3} />}
        </button>

        <div onClick={(e) => e.stopPropagation()} className="shrink-0">
          <ItemImageWithPreview
            sku={item.sku}
            alt={item.sku}
            onPreview={() => onPreview(item.sku)}
            disabled={quickViewOpen}
            size={40}
            unitPrice={item.unitPrice}
            uom={uom}
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
          <div onClick={(e) => e.stopPropagation()} className="max-w-[52ch]">
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

        {/* What was received, stated and not asked. The picker's job is to
            say which parts are coming back; how much of each is the quantity
            step's question, and a field here answered it before the step that
            exists to ask it. */}
        {totalOnly ? (
          <div className="shrink-0 pl-8 text-right">
            <p className="text-[15px] text-foreground tabular-nums" style={{ fontWeight: 600 }}>
              {formatQty(item.returnableQty)}{' '}
              <span className="text-[12px] text-slate-500" style={{ fontWeight: 500 }}>
                {item.uom}
              </span>
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500">available to return</p>
          </div>
        ) : (
        <div className="shrink-0 pl-8">
          <QtyUomField
            id={`qty-${item.sku}`}
            value={draft}
            uom={uom}
            shelves={stock}
            invalid={error !== null}
            ariaLabel={item.sku}
            onValue={setQty}
            onUom={pickUom}
          />
          {/* Under the field, because it is what the field is measured against
              rather than a second thing to fill in. */}
          <p className="mt-1 text-right text-[11px] text-slate-500 tabular-nums">
            <span className="text-foreground" style={{ fontWeight: 600 }}>{formatQty(onHand)}</span>{' '}
            on-hand
          </p>
        </div>
        )}
      </div>

      {error && (
        <p className="flex items-center gap-1.5 px-6 pb-2.5 -mt-1 text-[11px] text-red-700" style={{ fontWeight: 500 }}>
          <AlertCircle className="w-3 h-3 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
