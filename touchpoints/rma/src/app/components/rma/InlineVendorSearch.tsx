/**
 * The vendor step: the by-item search, with vendors in the parts' place.
 *
 * Coming in by vendor, what the returner knows is the partner they are
 * clearing, so the step searches vendors. Adding one opens their own book over
 * the step -- a modal rather than a step of its own, because picking parts from
 * a vendor is one move inside choosing the vendor, not a stage after it.
 *
 * Nothing is offered before a search, for the same reason the by-item step
 * offers nothing: a list of forty partners under an empty field is a directory,
 * and the returner already knows whose goods are on the dock. With the field
 * empty the step shows the vendors already on the return and what was taken
 * from each.
 */

import { useMemo, useState } from 'react';
import { Building2, CalendarClock, ExternalLink, Layers, Package, Plus, Search, X } from 'lucide-react';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/app/components/ui/hover-card';
import { ItemDescriptionWithToggle } from '@/app/components/VendorSelectionItemCell';
import { Input } from '@/app/components/ui/input';
import { formatQty } from '@/app/components/vendorSelectionModel';
import { ItemResultRow } from '@/app/components/rma/ItemResultRow';
import type { ItemPick } from '@/app/components/rma/itemSelectionBridge';
import { mockVendors } from '@/app/data/mockVendors';
import {
  itemsForVendor,
  searchVendorItems,
  vendorSummaries,
  type ReturnableItem,
  stockSplit,
} from '@/app/data/itemProvenance';

/** The partner record, opened in a new tab -- the same move the item number
 *  makes to the Items module. */
const PARTNER_URL = 'https://partner-management-module.lovable.app/vendors';

/** The line under a vendor's name, in the words the vendor picker already uses.
 *  The Vendor record ships no description, so the picker synthesises one from
 *  the fields it does have -- trade, settlement currency, terms -- and this says
 *  the same thing rather than a second version of it. */
function vendorBlurb(vendorCode: string, last: string): string {
  const v = mockVendors.find((x) => x.vendorCode === vendorCode);
  if (!v) return '';
  const when = last
    ? new Date(last).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : '';
  return `${v.category} vendor specializing in ${v.type.toLowerCase()} operations. Established supplier with ${v.currency} settlements on ${v.paymentTerms} terms.${when ? ` Last delivery ${when}.` : ''} Goods go back to their own receiving sites.`;
}

/** A vendor already on the return, and what is coming back from them. */
export interface VendorOnReturn {
  vendorCode: string;
  vendorName: string;
  partCount: number;
  units: number;
  uom: string;
}

export function InlineVendorSearch({
  query,
  onQuery,
  onReturn,
  onAdd,
  onOpenVendor,
  onPickSerials,
}: {
  query: string;
  onQuery: (next: string) => void;
  onReturn: VendorOnReturn[];
  /** Parts taken from one vendor. */
  onAdd: (vendorCode: string, picks: ItemPick[]) => void;
  onOpenVendor: (vendorCode: string) => void;
  /** Naming units is how a serialized part joins the return. */
  onPickSerials: (sku: string) => void;
}) {
  const [openVendor, setOpenVendor] = useState<string | null>(null);
  const searching = query.trim().length > 0;

  const results = useMemo(() => {
    if (!searching) return [];
    const q = query.trim().toLowerCase();
    return vendorSummaries().filter(
      (v) => v.vendorName.toLowerCase().includes(q) || v.category.toLowerCase().includes(q),
    );
  }, [query, searching]);

  return (
    <>
      <div className="shrink-0 px-4 sm:px-5 pt-3 pb-2.5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <Input
            type="text"
            placeholder="Search vendors by name"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            aria-label="Search vendors to return to"
            className="pl-9 pr-9 h-10 text-[13px] bg-white border-border rounded-lg shadow-sm transition-all focus-visible:ring-2 focus-visible:ring-primary/15 focus-visible:border-primary"
          />
          {query && (
            <button
              type="button"
              onClick={() => onQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded inline-flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              aria-label="Clear search"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto items-scroll bg-white border-t border-[#EEF2F6]">
        {searching ? (
          <>
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
              <Empty
                title={`Nothing matches “${query.trim()}”`}
                detail="Only vendors you have received goods from can take a return. Try their name or their category."
              />
            ) : (
              results.map((v) => {
                const on = onReturn.find((x) => x.vendorCode === v.vendorCode);
                return (
                  <VendorRow
                    key={v.vendorCode}
                    name={v.vendorName}
                    meta={`${v.category} · ${v.itemCount} ${v.itemCount === 1 ? 'item' : 'items'} received`}
                    vendorCode={v.vendorCode}
                    category={v.category}
                    last={v.lastReceivedDate}
                    itemCount={v.itemCount}
                    {...(on ? { taken: `${on.partCount} ${on.partCount === 1 ? 'item' : 'items'}` } : {})}
                    onAdd={() => setOpenVendor(v.vendorCode)}
                  />
                );
              })
            )}
          </>
        ) : onReturn.length === 0 ? (
          <Empty
            title="Search the vendors you have received from"
            detail="Type a name or a trade, then pick what is coming back to them."
            icon={<Building2 className="w-5 h-5" />}
          />
        ) : (
          <>
            <div className="sticky top-0 z-20 bg-white flex items-center justify-between px-4 sm:px-5 pt-3 pb-2 gap-3 border-b border-[#EEF2F6]">
              <span className="text-[12px] text-slate-600" style={{ fontWeight: 500 }}>On this return</span>
              <span className="text-[11px] text-slate-500 shrink-0 tabular-nums" style={{ fontWeight: 500 }}>
                {onReturn.length} {onReturn.length === 1 ? 'vendor' : 'vendors'}
              </span>
            </div>
            {onReturn.map((v) => (
              <VendorRow
                key={v.vendorCode}
                name={v.vendorName}
                meta={`${formatQty(v.units)} ${v.uom} coming back`}
                vendorCode={v.vendorCode}
                category={vendorSummaries().find((x) => x.vendorCode === v.vendorCode)?.category ?? ''}
                last={vendorSummaries().find((x) => x.vendorCode === v.vendorCode)?.lastReceivedDate ?? ''}
                taken={`${v.partCount} ${v.partCount === 1 ? 'item' : 'items'}`}
                onOpen={() => onOpenVendor(v.vendorCode)}
                onAdd={() => setOpenVendor(v.vendorCode)}
              />
            ))}
          </>
        )}
      </div>

      {openVendor && (
        <VendorItemsSheet
          vendorCode={openVendor}
          onClose={() => setOpenVendor(null)}
          onAdd={(picks) => { onAdd(openVendor, picks); setOpenVendor(null); }}
          onPickSerials={(sku) => { setOpenVendor(null); onPickSerials(sku); }}
        />
      )}
    </>
  );
}

function Empty({ title, detail, icon }: { title: string; detail: string; icon?: React.ReactNode }) {
  return (
    <div className="h-full min-h-[300px] flex flex-col items-center justify-center px-6 text-center">
      <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-300 mb-3">
        {icon ?? <Search className="w-5 h-5" />}
      </div>
      <p className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>{title}</p>
      <p className="text-[12px] text-slate-500 mt-1 max-w-sm">{detail}</p>
    </div>
  );
}

/** A vendor, drawn the way a part is drawn on the by-item step: identity on the
 *  left, and a right-hand slot with the figure above and the action below. The
 *  two steps list different things and should still read the same. */
function VendorTile({
  name,
  category,
  itemCount,
  last,
}: {
  name: string;
  category?: string;
  itemCount?: number;
  last?: string;
}) {
  return (
    <HoverCard openDelay={300} closeDelay={80}>
      <HoverCardTrigger asChild>
        <a
          href={PARTNER_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          aria-label={`Open ${name} in Partner Management`}
          className="flex w-10 h-10 shrink-0 items-center justify-center rounded-lg border border-[#EEF2F6] bg-slate-50 text-slate-400 transition-colors hover:border-primary/40 hover:text-primary"
        >
          <Building2 className="w-4 h-4" />
        </a>
      </HoverCardTrigger>
      <HoverCardContent
        side="right"
        align="start"
        sideOffset={8}
        className="w-[280px] p-0 rounded-xl border-0 overflow-hidden z-[220]"
        style={{ boxShadow: '0 8px 30px rgba(0,0,0,0.12)' }}
      >
        <div className="bg-gradient-to-br from-slate-800 to-slate-700 px-3.5 py-3 relative overflow-hidden">
          <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/[0.04]" />
          <div className="flex items-center gap-3 relative">
            <span className="flex w-9 h-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white/80">
              <Building2 className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[14px] text-white truncate" style={{ fontWeight: 600 }}>{name}</p>
              <p className="text-[11px] text-slate-400 truncate">{category || 'Supplier'}</p>
            </div>
          </div>
        </div>
        <div className="bg-white px-3.5 py-3 space-y-2">
          {itemCount != null && (
            <div className="flex items-center gap-2.5 text-[12px] text-slate-700">
              <Layers className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>{itemCount} {itemCount === 1 ? 'item' : 'items'} received</span>
            </div>
          )}
          <div className="flex items-center gap-2.5 text-[12px] text-slate-700">
            <CalendarClock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>
              {last
                ? `Last delivery ${new Date(last).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
                : 'No recorded delivery'}
            </span>
          </div>
        </div>
        <div className="bg-slate-50/60 border-t border-border/40 px-3.5 py-2 flex items-center justify-end">
          <a
            href={PARTNER_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
            style={{ fontWeight: 500 }}
          >
            Open partner
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

function VendorRow({
  name,
  meta,
  vendorCode,
  category,
  itemCount,
  last,
  taken,
  onAdd,
  onOpen,
}: {
  name: string;
  meta: string;
  vendorCode?: string;
  category?: string;
  last?: string;
  /** How many parts of theirs could come back. */
  itemCount?: number;
  /** What is already on the return from them. Its presence turns Add into
   *  Add more, as an added part's row does on the by-item step. */
  taken?: string;
  onAdd: () => void;
  onOpen?: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-4 sm:px-6 py-3 border-b border-[#EEF2F6] transition-colors hover:bg-[#FAFBFC]">
      {/* The same three affordances a part carries: hover the tile for the
          partner card, click it for their record, and the name opens what it
          names. A vendor is as much a thing to check before shipping to as a
          part is before sending back. */}
      <VendorTile name={name} {...(category ? { category } : {})} {...(itemCount != null ? { itemCount } : {})} {...(last ? { last } : {})} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 min-w-0">
          {onOpen ? (
            <button
              type="button"
              onClick={onOpen}
              className="min-w-0 max-w-full truncate text-left text-[14px] text-foreground transition-colors hover:text-primary hover:underline"
              style={{ fontWeight: 600 }}
            >
              {name}
            </button>
          ) : (
            <a
              href={PARTNER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="min-w-0 max-w-full truncate text-[14px] text-foreground transition-colors hover:text-primary hover:underline"
              style={{ fontWeight: 600 }}
            >
              {name}
            </a>
          )}
          {category && (
            <>
              <span
                className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-100 whitespace-nowrap"
                style={{ fontWeight: 600 }}
              >
                Active
              </span>
              <span
                className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] bg-slate-50 text-slate-600 border border-slate-200 whitespace-nowrap"
                style={{ fontWeight: 500 }}
              >
                {category}
              </span>
            </>
          )}
        </div>
        {/* One line under the name, as a part has. The meta line said the trade
            and the part count, the blurb opened with both, and the figure on
            the right stated the count a third time. */}
        {!category && <p className="truncate text-[12px] text-slate-500 mt-0.5">{meta}</p>}
        {category && (
          <ItemDescriptionWithToggle
            description={vendorBlurb(vendorCode ?? '', last ?? '')}
            highlightText={(t) => t}
            itemSearch=""
            widthClass="w-full"
            hugText
            textClass="text-[12px]"
          />
        )}
      </div>

      <div className="shrink-0 pl-10 flex flex-col items-end gap-2 min-w-[206px]">
        <div className="flex items-center justify-end gap-1.5">
          {taken && (
            <span
              className="inline-flex items-center h-[20px] rounded-md bg-blue-50 border border-blue-100 px-1.5 text-[10px] text-primary tabular-nums whitespace-nowrap"
              style={{ fontWeight: 600 }}
            >
              {taken} added
            </span>
          )}
          {itemCount != null && (
            <span className="text-[13px] text-foreground tabular-nums whitespace-nowrap" style={{ fontWeight: 600 }}>
              {formatQty(itemCount)}{' '}
              <span className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>
                {itemCount === 1 ? 'item' : 'items'}
              </span>
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onAdd}
          className={
            taken
              ? 'inline-flex items-center justify-center gap-1.5 h-8 rounded-lg px-3 text-[12px] border border-slate-200 bg-white text-foreground transition-colors hover:bg-slate-50 whitespace-nowrap'
              : 'inline-flex items-center justify-center gap-1.5 h-8 rounded-lg px-3.5 text-[12px] bg-primary text-white shadow-sm transition-colors hover:bg-blue-700 whitespace-nowrap'
          }
          style={{ fontWeight: taken ? 500 : 600 }}
        >
          <Plus className="w-3.5 h-3.5" />
          {taken ? 'Add more' : 'Add'}
        </button>
      </div>
    </div>
  );
}

/** One vendor's book, over the step.
 *
 *  A modal rather than a step: picking parts from a vendor is one move inside
 *  choosing that vendor, and sending the user forward and back for it made the
 *  second vendor cost twice what the first did. */
/** The vendor's own catalogue, on top of whatever opened it. Exported because
 *  the second step's vendor card adds items the same way the first step does:
 *  it is the same act against the same vendor, and sending someone back a step
 *  to do it made the second item cost a different set of moves from the
 *  first. */
export function VendorItemsSheet({
  vendorCode,
  onClose,
  onAdd,
  onPickSerials,
}: {
  vendorCode: string;
  onClose: () => void;
  onAdd: (picks: ItemPick[]) => void;
  onPickSerials: (sku: string) => void;
}) {
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<Map<string, number>>(new Map());
  const all = useMemo(() => itemsForVendor(vendorCode), [vendorCode]);
  const vendorName = useMemo(
    () => vendorSummaries().find((v) => v.vendorCode === vendorCode)?.vendorName ?? '',
    [vendorCode],
  );
  const rows = useMemo(
    () => (q.trim() ? searchVendorItems(vendorCode, q) : all),
    [q, vendorCode, all],
  );

  // The result row speaks the catalogue's language, so a vendor's part is
  // shaped into the same thing rather than given a second row design.
  const asResult = (i: (typeof all)[number]): ReturnableItem => ({
    sku: i.sku,
    description: i.description,
    uom: i.uom,
    image: i.image,
    trackingMode: i.trackingMode,
    returnableQty: i.returnableQty,
    receivedQty: i.returnableQty,
    // What this vendor shipped, in the unit they shipped it in. A vendor's
    // sheet is bounded by their own deliveries, so it does not carry the
    // other units the warehouse happens to hold the part in.
    stock: [{ uom: i.uom, qty: i.returnableQty, split: stockSplit(i.sku, i.returnableQty) }],
    supplierCount: 1,
    unitPrice: i.unitPrice,
    lastReceivedDate: i.lastReceivedDate,
    untraced: null,
  });

  const total = picked.size;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-[168]" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Parts from ${vendorName}`}
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[169] flex flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-[0_24px_60px_rgba(16,24,40,0.18)] w-[calc(100%-2rem)]"
        style={{ maxWidth: 'min(74vw, 980px)', maxHeight: 'min(86vh, 820px)' }}
      >
        <div className="shrink-0 flex items-center justify-between gap-4 border-b border-border px-5 py-3">
          <div className="min-w-0">
            <h2 className="text-[14px] text-foreground truncate" style={{ fontWeight: 700 }}>{vendorName}</h2>
            <p className="text-[12px] text-slate-500 truncate">
              {all.length} {all.length === 1 ? 'item' : 'items'} received from them. Pick what is going back.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 inline-flex items-center gap-1.5 h-8 rounded-lg px-3 text-[12px] border border-slate-200 bg-white text-foreground transition-colors hover:bg-slate-50"
            style={{ fontWeight: 500 }}
          >
            <X className="w-3.5 h-3.5" />
            Close
          </button>
        </div>

        <div className="shrink-0 px-5 py-2.5 border-b border-[#EEF2F6]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <Input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search their parts by number or description"
              aria-label={`Search parts from ${vendorName}`}
              className="pl-9 h-9 text-[13px]"
            />
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto items-scroll bg-white">
          {rows.length === 0 ? (
            <Empty
              title={`Nothing matches “${q.trim()}”`}
              detail="Only items received from this vendor can go back to them."
            />
          ) : (
            rows.map((i) => (
              <ItemResultRow
                key={i.sku}
                item={asResult(i)}
                query={q.trim()}
                qty={picked.get(i.sku) ?? 0}
                added={false}
                onQty={(n) =>
                  setPicked((prev) => {
                    const next = new Map(prev);
                    if (n <= 0) next.delete(i.sku);
                    else next.set(i.sku, n);
                    return next;
                  })
                }
                onPreview={() => {}}
                quickViewOpen={false}
                onPickSerials={onPickSerials}
              />
            ))
          )}
        </div>

        <div className="shrink-0 border-t border-[#EEF2F6] bg-white px-5 py-3 flex items-center justify-end gap-2.5">
          <span className="text-[12px] text-slate-500 mr-auto" style={{ fontWeight: 500 }}>
            <span className="text-foreground tabular-nums" style={{ fontWeight: 600 }}>{total}</span>{' '}
            {total === 1 ? 'item' : 'items'} ready to add
          </span>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center h-9 rounded-lg px-4 text-[13px] border border-slate-200 bg-white text-foreground transition-colors hover:bg-slate-50"
            style={{ fontWeight: 500 }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={total === 0}
            onClick={() => onAdd([...picked].map(([sku, qty]) => ({ sku, qty })))}
            className="inline-flex items-center gap-1.5 h-9 rounded-lg px-4 text-[13px] bg-primary text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ fontWeight: 600 }}
          >
            <Package className="w-3.5 h-3.5" />
            Add to return
          </button>
        </div>
      </div>
    </>
  );
}
