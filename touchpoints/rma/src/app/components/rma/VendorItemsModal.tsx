/**
 * By-vendor start: pick the partner, then what of theirs is going back.
 *
 * The item route derives the vendor. This one is the opposite case -- a
 * quarterly clear-out, a recall, a supplier being wound down -- where the
 * vendor is the premise and the question is what of theirs is still on the
 * shelf. That answer runs long, so the second phase is a searchable grid
 * rather than a list or a dropdown: a vendor with six hundred parts cannot be
 * scrolled, only searched.
 *
 * Choosing this way answers the vendor question outright, so nothing on the
 * later steps asks it again.
 */

import { TrackingTag } from '@/app/components/rma/TrackingTag';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Building2, Check, ChevronLeft, ChevronRight, Info, Package, Search, X } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Switch } from '@/app/components/ui/switch';
import { ImageWithFallback } from '@/app/components/figma/ImageWithFallback';
import {
  ITEMS_MODULE_URL,
  ItemDescriptionWithToggle,
  longDescriptionFor,
} from '@/app/components/VendorSelectionItemCell';
import { ItemImageWithPreview, ItemQuickViewModal } from '@/app/components/invoice-details/ItemQuickView';
import type { ItemPick } from '@/app/components/rma/itemSelectionBridge';
import { mockVendors } from '@/app/data/mockVendors';
import { QtyUomField } from '@/app/components/rma/QtyUomField';
import {
  ORIGIN_LABELS,
  TRACKING_CHIP,
  TRACKING_LABELS,
  itemsForVendor,
  searchVendorItems,
  unlinkedItemsMatching,
  vendorSummaries,
  type VendorItem,
  type VendorSummary,
} from '@/app/data/itemProvenance';

export interface VendorItemsSelection {
  vendorCode: string;
  vendorName: string;
  /** Parts this vendor actually shipped, with how much of each is going back. */
  picks: ItemPick[];
  /** Stock with no receiver behind it, attached by hand. */
  unlinkedPicks: ItemPick[];
}

interface VendorItemsModalProps {
  onClose: () => void;
  onBack: () => void;
  onContinue: (selection: VendorItemsSelection) => void;
  /** When given, naming the vendor is the whole of this picker: the parts are
   *  not asked for here, because the step behind it already lists every one of
   *  theirs on its rail. Picking from a grid and then picking again from a rail
   *  was the same question twice. */
  onPickVendorOnly?: ((vendor: VendorSummary) => void) | undefined;
}

function highlight(text: string, query: string) {
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

/** What the partner list says about a vendor, in the words vendor-invoicing
 *  uses. Built off the summary rather than re-read from the master, so the
 *  picker does not have to reach past what it was given. */
function vendorBlurb(v: VendorSummary): string {
  const master = mockVendors.find((m) => m.vendorCode === v.vendorCode);
  const when = v.lastReceivedDate
    ? new Date(v.lastReceivedDate).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '';
  return `${v.category} vendor specializing in ${(master?.type ?? 'Domestic').toLowerCase()} operations. Established supplier with ${master?.currency ?? 'USD'} settlements on ${master?.paymentTerms ?? 'Net 30'} terms.${when ? ` Last delivery ${when}.` : ''} Goods go back to their own receiving sites.`;
}

function Avatar({ name, url, size = 'w-9 h-9' }: { name: string; url?: string | undefined; size?: string }) {
  return (
    <span className={`${size} rounded-md overflow-hidden bg-white border border-[#E8ECF1] flex items-center justify-center shrink-0`}>
      {url ? (
        <ImageWithFallback src={url} alt={name} className="w-full h-full object-cover" />
      ) : (
        <Building2 className="w-4 h-4 text-slate-400" />
      )}
    </span>
  );
}

/**
 * Who this return settles with, as the first step of the wizard rather than a
 * modal in front of it.
 *
 * The by-vendor route used to be a modal that asked the vendor and then picked
 * the parts in a grid, and handed both to a flow that asks for parts again.
 * Naming the vendor is the only thing that route knows first; everything after
 * it is the by-item flow unchanged. So the question is a step, and the step
 * after it is the same Items and quantity screen the other route opens on.
 *
 * The search, the cold start, the cards and their more/Show less blurb are the
 * modal's own, lifted whole rather than rebuilt: this is the same list, in a
 * step's body instead of a dialog's.
 */
export function ReturnPartnerStep({
  chosen,
  onChoose,
}: {
  chosen: string | null;
  onChoose: (vendor: VendorSummary) => void;
}) {
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const id = window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, []);

  const searching = query.trim().length > 0;
  const vendors = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return vendorSummaries().filter((v) =>
      `${v.vendorName} ${v.category}`.toLowerCase().includes(q),
    );
  }, [query]);

  return (
    // Edge to edge, the way the items step's search and rail are: the step
    // body is the container. A rounded card floating inside a padded canvas
    // was a second frame around a list that already has a header and a strip
    // of its own.
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
      <div className="shrink-0 border-b border-border px-4 py-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 w-4 h-4 -translate-y-1/2 text-slate-400" />
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search vendors by name or category"
            aria-label="Search vendors to return to"
            className="h-10 w-full rounded-md border border-border bg-white pl-9 pr-3 text-[13px] text-foreground shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-blue-300 focus:shadow-[0_0_0_2px_var(--color-blue-100,#dbeafe)]"
            style={{ fontWeight: 500 }}
          />
        </div>
        {/* Said before the list rather than left for the radios to imply. One
            RMA is raised against one vendor and credited by them, so this is a
            rule about the document, not a limit on the control. */}
        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-500">
          <Info className="w-3 h-3 shrink-0 text-slate-400" />
          One vendor per RMA. Selecting another replaces this one.
        </p>
      </div>

      <div className="min-h-0 overflow-y-auto">
        {!searching ? (
          <ColdStart />
        ) : vendors.length === 0 ? (
          <Empty query={query} what="vendor" />
        ) : (
          <>
            <SectionLabel
              left={`Showing results for "${query.trim()}"`}
              right={`${vendors.length} ${vendors.length === 1 ? 'vendor' : 'vendors'}`}
            />
            {vendors.map((v) => {
              const picked = v.vendorCode === chosen;
              return (
                <div
                  key={v.vendorCode}
                  role="radio"
                  aria-checked={picked}
                  aria-setsize={vendors.length}
                  tabIndex={0}
                  onClick={() => onChoose(v)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onChoose(v);
                    }
                  }}
                  aria-label={`Return to ${v.vendorName}`}
                  className={`flex w-full cursor-pointer items-center gap-4 border-b border-[#EEF2F6] px-6 py-3 text-left transition-colors ${
                    picked ? 'bg-blue-50/60' : 'hover:bg-[#F0F7FF]'
                  }`}
                >
                  <span
                    className={`flex w-4 h-4 shrink-0 items-center justify-center rounded-full border-2 ${
                      picked ? 'border-primary bg-primary' : 'border-slate-300 bg-white'
                    }`}
                  >
                    {picked && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </span>
                  <Avatar name={v.vendorName} url={v.imageUrl} />
                  <div className="min-w-0 max-w-[620px] flex-1 pr-6">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className="min-w-0 truncate text-[13px] text-foreground"
                        style={{ fontWeight: 600 }}
                      >
                        {highlight(v.vendorName, query)}
                      </span>
                      <span
                        className="shrink-0 inline-flex items-center whitespace-nowrap rounded-full border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-700"
                        style={{ fontWeight: 600 }}
                      >
                        Active
                      </span>
                      <span
                        className="shrink-0 inline-flex items-center whitespace-nowrap rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] text-slate-600"
                        style={{ fontWeight: 500 }}
                      >
                        {v.category}
                      </span>
                    </div>
                    <div onClick={(e) => e.stopPropagation()}>
                      <ItemDescriptionWithToggle
                        description={vendorBlurb(v)}
                        highlightText={(t) => t}
                        itemSearch=""
                        widthClass="w-full"
                        hugText
                        textClass="text-[12px]"
                      />
                    </div>
                  </div>
                  <span className="ml-auto shrink-0 text-right">
                    <span
                      className="block text-[13px] text-foreground tabular-nums"
                      style={{ fontWeight: 600 }}
                    >
                      {v.itemCount}
                    </span>
                    <span className="mt-0.5 block text-[10px] text-slate-400" style={{ fontWeight: 500 }}>
                      {v.itemCount === 1 ? 'item' : 'items'}
                    </span>
                  </span>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}

export function VendorItemsModal({
  onClose,
  onBack,
  onContinue,
  onPickVendorOnly,
}: VendorItemsModalProps) {
  const [vendor, setVendor] = useState<VendorSummary | null>(null);
  const [query, setQuery] = useState('');
  // Entering a quantity is what puts the part on the return, so these hold the
  // figure rather than a tick. Same model as the by-item search.
  const [selected, setSelected] = useState<Map<string, number>>(new Map());
  const [unlinked, setUnlinked] = useState<Map<string, number>>(new Map());
  const [showUnlinked, setShowUnlinked] = useState(false);
  const [previewSku, setPreviewSku] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Both phases are a search, so the cursor belongs in the field on each.
  useEffect(() => {
    setQuery('');
    const id = window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [vendor]);

  // Nothing is listed before a search, the same as the by-item catalogue. A
  // list of partners offered up front reads as a recommendation, and the person
  // clearing a vendor out already knows which one they mean.
  const searching = query.trim().length > 0;
  const vendors = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return vendorSummaries().filter((v) =>
      `${v.vendorName} ${v.category}`.toLowerCase().includes(q),
    );
  }, [query]);

  const items = useMemo(
    () => (vendor ? searchVendorItems(vendor.vendorCode, query) : []),
    [vendor, query],
  );
  const strays = useMemo(
    () => (vendor && showUnlinked ? unlinkedItemsMatching(vendor.vendorCode, query) : []),
    [vendor, showUnlinked, query],
  );

  // A ticked part stays reachable when the query moves off it, so a selection
  // built over several searches never looks lost.
  const stuck = useMemo(() => {
    if (!vendor) return [];
    const shown = new Set(items.map((i) => i.sku));
    return itemsForVendor(vendor.vendorCode).filter((i) => selected.has(i.sku) && !shown.has(i.sku));
  }, [vendor, items, selected]);

  const total = selected.size + unlinked.size;

  /** On the return, or not. The picker asks which parts are coming back; how
   *  much of each is the quantity step's question, and asking it here answered
   *  that step before it was reached. Picks travel at zero and the step asks
   *  for the figure, the same as the by-item route. */
  const flip = (set: typeof setSelected, sku: string) =>
    set((prev) => {
      const next = new Map(prev);
      if (next.has(sku)) next.delete(sku);
      else next.set(sku, 0);
      return next;
    });

  const toggle = (sku: string) => flip(setSelected, sku);
  const toggleUnlinked = (sku: string) => flip(setUnlinked, sku);

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-[150]" onClick={onClose} />

      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[151] bg-white border border-border w-[calc(100%-2rem)] max-w-[100%] sm:max-w-[min(70vw,1320px)] h-[100dvh] sm:h-[90vh] max-h-[100dvh] sm:max-h-[90vh] rounded-none sm:rounded-2xl overflow-hidden">
        <div className="h-full flex flex-col">

          <div className="px-3 sm:px-4 lg:px-5 pt-3 sm:pt-4 pb-3 sm:pb-4 shrink-0 bg-white border-b border-[#EEF2F6]">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5 min-w-0">
                <button
                  type="button"
                  onClick={() => (vendor ? setVendor(null) : onBack())}
                  className="mt-0.5 w-8 h-8 rounded-lg border border-border bg-white hover:bg-slate-50 hover:border-slate-300 flex items-center justify-center shrink-0 cursor-pointer transition-all"
                  aria-label={vendor ? 'Back to vendors' : 'Back to previous step'}
                  title="Back"
                >
                  <ChevronLeft className="w-4 h-4 text-slate-500" />
                </button>
                {vendor ? (
                  <Avatar name={vendor.vendorName} url={vendor.imageUrl} size="w-10 h-10" />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-violet-50 flex items-center justify-center text-violet-600 shrink-0">
                    <Building2 className="w-5 h-5" />
                  </div>
                )}
                <div className="min-w-0">
                  <h2 className="text-[15px] sm:text-[17px] text-foreground truncate" style={{ fontWeight: 700 }}>
                    {vendor ? vendor.vendorName : 'Which vendor are you clearing'}
                  </h2>
                  <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5" style={{ fontWeight: 400 }}>
                    {vendor
                      ? `${vendor.itemCount} ${vendor.itemCount === 1 ? 'item' : 'items'} received from them. Select the items to return.`
                      : 'Each RMA settles with one vendor, so the vendor comes first.'}
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

            <div className="-mx-3 sm:-mx-4 lg:-mx-5 -mb-3 sm:-mb-4 mt-4 px-3 sm:px-4 lg:px-5 py-3 sm:py-3.5 bg-[#FAFBFC] border-t border-[#EEF2F6] space-y-2.5">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <Input
                  ref={searchRef}
                  type="text"
                  placeholder={vendor ? 'Search their parts by number or description' : 'Search vendors by name'}
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

              {/* Off unless asked for. A return goes back where the goods came
                  from; everything else is an exception the user has to opt
                  into, and saying so is the point of the switch. */}
              {vendor && (
                <label className="flex items-center gap-2.5 cursor-pointer w-fit">
                  <Switch
                    checked={showUnlinked}
                    onCheckedChange={setShowUnlinked}
                    aria-label="Show unlinked matching inventory"
                  />
                  <span className="text-[12px] text-slate-600" style={{ fontWeight: 500 }}>
                    Show unlinked matching inventory
                    <span className="text-slate-400" style={{ fontWeight: 400 }}>
                      {' '}· stock with no delivery behind it
                    </span>
                  </span>
                </label>
              )}
            </div>
          </div>

          <div className={`flex-1 min-h-0 overflow-y-auto overscroll-none ${vendor ? 'bg-[#FAFBFC]' : 'bg-white'}`}>
            {!vendor ? (
              <>
                {!searching ? (
                  <ColdStart />
                ) : vendors.length === 0 ? (
                  <Empty query={query} what="vendor" />
                ) : (
                  <>
                <SectionLabel
                  left={`Showing results for "${query.trim()}"`}
                  right={`${vendors.length} ${vendors.length === 1 ? 'vendor' : 'vendors'}`}
                />
                {(
                  vendors.map((v) => (
                    // A div rather than a button: the description's own
                    // more/Show less control is a button, and a button inside a
                    // button is invalid and breaks the click.
                    <div
                      key={v.vendorCode}
                      role="button"
                      tabIndex={0}
                      onClick={() => (onPickVendorOnly ? onPickVendorOnly(v) : setVendor(v))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          if (onPickVendorOnly) onPickVendorOnly(v);
                          else setVendor(v);
                        }
                      }}
                      aria-label={`Choose ${v.vendorName}`}
                      className="w-full flex items-center gap-4 px-6 py-3 border-b border-[#EEF2F6] hover:bg-[#F0F7FF] transition-colors text-left cursor-pointer"
                    >
                      <Avatar name={v.vendorName} url={v.imageUrl} />
                      {/* Capped rather than left to fill the row: at full
                          width the blurb ran the whole way across and sat hard
                          against the count, so the two read as one line. */}
                      <div className="min-w-0 flex-1 max-w-[620px] pr-6">
                        {/* The name, then what the partner list says about
                            them: the status they are in and the trade they are
                            in, as chips. Vendor-invoicing's own row. */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className="min-w-0 truncate text-[13px] text-foreground"
                            style={{ fontWeight: 600 }}
                          >
                            {highlight(v.vendorName, query)}
                          </span>
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
                            {v.category}
                          </span>
                        </div>
                        {/* And the same blurb, behind the same more toggle, so
                            picking a partner here reads as picking one
                            anywhere else in the app. */}
                        <div onClick={(e) => e.stopPropagation()}>
                          <ItemDescriptionWithToggle
                            description={vendorBlurb(v)}
                            highlightText={(t) => t}
                            itemSearch=""
                            widthClass="w-full"
                            hugText
                            textClass="text-[12px]"
                          />
                        </div>
                      </div>
                      {/* How many of their parts are on the return's rail if
                          you pick them, which is what this choice leads to. The
                          units figure summed across every shelf and unit of
                          measure they hold -- eaches and pallets and litres
                          added into one number that stands for nothing. */}
                      <span className="text-right shrink-0 ml-auto">
                        <span className="block text-[13px] text-foreground tabular-nums" style={{ fontWeight: 600 }}>
                          {v.itemCount}
                        </span>
                        <span className="block text-[10px] text-slate-400 mt-0.5" style={{ fontWeight: 500 }}>
                          {v.itemCount === 1 ? 'item' : 'items'}
                        </span>
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                    </div>
                  ))
                )}
                  </>
                )}
              </>
            ) : (
              <>
                <SectionLabel
                  left={query.trim() ? `Showing results for "${query.trim()}"` : `Everything received from ${vendor.vendorName}`}
                  tone="bg-[#FAFBFC]"
                />
                {items.length === 0 && stuck.length === 0 && strays.length === 0 ? (
                  <Empty query={query} what="part" />
                ) : (
                  <div className="px-5 py-4 space-y-4">
                    {/* The parts sit in a card with their count on it, the
                        container vendor-invoicing puts a document's lines in.
                        Full-bleed rows on white left nothing saying where the
                        list started or how long it was. */}
                    <div className="rounded-lg border border-border bg-white overflow-hidden">
                      <div className="flex items-center gap-1.5 px-4 py-2.5 text-[12px] text-slate-600 border-b border-[#EEF2F6] bg-[#FAFBFC]">
                        <Package className="w-3.5 h-3.5 text-slate-400" />
                        {items.length + stuck.length} item{items.length + stuck.length !== 1 ? 's' : ''}
                      </div>
                    {[...items, ...stuck].map((item) => (
                      <ItemRow
                        key={item.sku}
                        sku={item.sku}
                        description={item.description}
                        uom={item.uom}
                        cap={item.returnableQty}
                        trackingMode={item.trackingMode}
                        image={item.image}
                        trail={`PO ${item.poNumbers.slice(0, 2).join(', ')}${item.poNumbers.length > 2 ? ` +${item.poNumbers.length - 2}` : ''}`}
                        query={query.trim()}
                        ticked={selected.has(item.sku)}
                        onToggle={() => toggle(item.sku)}
                        onPreview={setPreviewSku}
                        quickViewOpen={previewSku !== null}
                        unitPrice={item.unitPrice}
                      />
                    ))}
                    </div>
                    {strays.length > 0 && (
                      <div className="rounded-lg border border-amber-200 bg-white overflow-hidden">
                        <div className="px-4 py-2.5 bg-amber-50/70 border-b border-amber-100">
                          <div className="flex items-center gap-1.5">
                            <p className="text-[12px] text-amber-900" style={{ fontWeight: 600 }}>
                              Stock with no receiver
                            </p>
                            <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-white border border-amber-200 px-1.5 text-[10px] text-amber-800 tabular-nums" style={{ fontWeight: 600 }}>
                              {strays.length}
                            </span>
                          </div>
                          <p className="text-[11px] text-amber-800/80 mt-0.5 leading-snug">
                            Counted in or carried over, so no delivery ties it to anyone. Attaching it
                            to {vendor.vendorName} reverses nothing on its own. You enter the value
                            and the reference yourself.
                          </p>
                        </div>
                        {strays.map((item) => (
                          <ItemRow
                            key={`stray-${item.sku}`}
                            sku={item.sku}
                            description={item.description}
                            uom={item.uom}
                            cap={item.qty}
                            trackingMode={item.trackingMode}
                            image={item.image}
                            trail={ORIGIN_LABELS[item.origin]}
                            query={query.trim()}
                            ticked={unlinked.has(item.sku)}
                            onToggle={() => toggleUnlinked(item.sku)}
                            onPreview={setPreviewSku}
                            quickViewOpen={previewSku !== null}
                            unitPrice={item.unitPrice}
                            unlinked
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="shrink-0 border-t border-[#EEF2F6] bg-white px-3 sm:px-4 lg:px-5 py-2.5 sm:py-3 flex items-center justify-end gap-2 sm:gap-2.5 sm:rounded-b-2xl">
            <div className="text-xs sm:text-[13px] text-slate-500 mr-auto truncate" style={{ fontWeight: 500 }}>
              {vendor ? (
                <>
                  <span className="text-foreground tabular-nums" style={{ fontWeight: 600 }}>{total}</span>{' '}
                  {total === 1 ? 'item' : 'items'} from{' '}
                  <span className="text-foreground" style={{ fontWeight: 600 }}>{vendor.vendorName}</span>
                  {unlinked.size > 0 && (
                    <span className="text-amber-700">
                      {' · '}
                      {unlinked.size} attached by hand
                    </span>
                  )}
                </>
              ) : (
                'Pick the vendor this return settles with'
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
              onClick={() =>
                vendor &&
                onContinue({
                  vendorCode: vendor.vendorCode,
                  vendorName: vendor.vendorName,
                  picks: [...selected].map(([sku, qty]) => ({ sku, qty })),
                  unlinkedPicks: [...unlinked].map(([sku, qty]) => ({ sku, qty })),
                })
              }
              disabled={!vendor || total === 0}
              className="gap-1.5 rounded-lg px-3 sm:px-5 text-xs sm:text-[13px] h-8 sm:h-9 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Stacks above the picker so the grid stays put underneath. */}
      {previewSku && (() => {
        const item = items.find((i) => i.sku === previewSku);
        const stray = strays.find((i) => i.sku === previewSku);
        const src = item ?? stray;
        return (
          <ItemQuickViewModal
            open
            onClose={() => setPreviewSku(null)}
            sku={previewSku}
            {...(vendor ? { vendorName: vendor.vendorName } : {})}
            {...(src
              ? {
                  description: src.description,
                  unitPrice: src.unitPrice,
                  uom: src.uom,
                  serialized: src.trackingMode === 'serialized',
                  trackingLabel: TRACKING_LABELS[src.trackingMode],
                }
              : {})}
          />
        );
      })()}
    </>
  );
}

/** The strip over a list. The count is optional: where the list sits in a card
 *  that carries its own figure, repeating it here says it twice. */
function SectionLabel({ left, right, tone = 'bg-white' }: { left: string; right?: string; tone?: string }) {
  return (
    <div className={`sticky top-0 z-20 ${tone} flex items-center justify-between px-6 pt-4 pb-2 gap-3 border-b border-[#EEF2F6]`}>
      <span className="text-[12px] text-slate-600 truncate" style={{ fontWeight: 500 }}>{left}</span>
      {right && (
        <span className="text-[11px] text-slate-500 shrink-0 tabular-nums" style={{ fontWeight: 500 }}>{right}</span>
      )}
    </div>
  );
}

/** Before anything is typed. Says what the field reaches rather than listing
 *  every partner on file, the same cold start the by-item catalogue opens on. */
function ColdStart() {
  return (
    <div className="h-full min-h-[320px] flex flex-col items-center justify-center px-6 text-center">
      <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-300 mb-3">
        <Building2 className="w-5 h-5" />
      </div>
      <p className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>
        Search the vendors you have received from
      </p>
      <p className="text-[12px] text-slate-500 mt-1 max-w-sm">
        Type a vendor name or a category. Picking one opens everything of theirs
        that is still returnable.
      </p>
    </div>
  );
}

function Empty({ query, what }: { query: string; what: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-300 mb-3">
        {what === 'vendor' ? <Building2 className="w-5 h-5" /> : <Package className="w-5 h-5" />}
      </div>
      <p className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>
        Nothing matches {`"${query.trim()}"`}
      </p>
      <p className="text-[12px] text-slate-500 mt-1 max-w-sm">
        {what === 'vendor'
          ? 'Only vendors with stock received from them can accept a return.'
          : 'Try the part number, or a word from the description. Turn on unlinked inventory to reach stock this vendor did not ship.'}
      </p>
    </div>
  );
}

function ItemRow({
  sku,
  description,
  uom,
  cap,
  ticked,
  onToggle,
  trackingMode,
  image,
  trail,
  query,
  onPreview,
  quickViewOpen,
  unitPrice,
  unlinked = false,
}: {
  sku: string;
  description: string;
  uom: string;
  /** Everything received, which is the most that can come back. */
  cap: number;
  /** On the return. Ticking is what puts it there; the figure is the quantity
   *  step's question. */
  ticked: boolean;
  onToggle: () => void;
  trackingMode: VendorItem['trackingMode'];
  image: string | undefined;
  trail: string;
  query: string;
  onPreview: (sku: string) => void;
  quickViewOpen: boolean;
  unitPrice?: number;
  unlinked?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 border-b border-[#EEF2F6] last:border-b-0 transition-colors ${
        ticked ? 'bg-[#F8FAFF]' : 'hover:bg-[#FAFBFC]'
      }`}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={ticked}
        onClick={onToggle}
        aria-label={`Put ${sku} on this return`}
        className={`flex w-[18px] h-[18px] shrink-0 items-center justify-center rounded border transition-colors ${
          ticked
            ? 'border-primary bg-primary text-white'
            : 'border-slate-300 bg-white hover:border-primary/50'
        }`}
      >
        {ticked && <Check className="w-3 h-3" strokeWidth={3} />}
      </button>

      {/* Same item affordances the rest of the suite gives a line: hover the
          thumbnail for master data, click it for the full view, and the item
          number opens the Items module. */}
      <div onClick={(e) => e.stopPropagation()} className="shrink-0">
        <ItemImageWithPreview
          sku={sku}
          alt={sku}
          onPreview={() => onPreview(sku)}
          disabled={quickViewOpen}
          size={40}
          {...(unitPrice != null ? { unitPrice } : {})}
          uom={uom}
          serialized={trackingMode === 'serialized'}
          trackingLabel={TRACKING_LABELS[trackingMode]}
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
            {highlight(sku, query)}
          </a>
          <TrackingTag mode={trackingMode} size="md" />
          {unlinked && (
            <span
              className="shrink-0 inline-flex items-center h-5 px-1.5 rounded border text-[10px] bg-amber-50 border-amber-200 text-amber-800"
              style={{ fontWeight: 600 }}
            >
              No receiver
            </span>
          )}
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <ItemDescriptionWithToggle
            description={longDescriptionFor(sku, description)}
            highlightText={highlight}
            itemSearch={query}
            widthClass="w-full"
            hugText
            textClass="text-[12px]"
          />
        </div>
        <p className="text-[11px] text-slate-400 truncate mt-px">{trail}</p>
      </div>
      {/* What this vendor sent, stated and not asked. Both routes into a
          return now say which parts on the picker and how much on the step
          that exists to ask it. */}
      <div className="shrink-0 text-right">
        <p className="text-[15px] text-foreground tabular-nums" style={{ fontWeight: 600 }}>
          {cap}{' '}
          <span className="text-[12px] text-slate-500" style={{ fontWeight: 500 }}>
            {uom}
          </span>
        </p>
        <p className="mt-0.5 text-[11px] text-slate-500">available to return</p>
      </div>
    </div>
  );
}
