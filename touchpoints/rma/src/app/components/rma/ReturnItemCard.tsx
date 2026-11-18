/**
 * The purchase-order cart's vendor group, with its two axes swapped.
 *
 * The cart groups by vendor and lists items inside, because an order has one
 * supplier and many parts. A return is the other way round: the returner has a
 * part in hand and it may have come from any of several suppliers. So the part
 * takes the group header and the vendors take the rows, and everything else is
 * the cart's -- the 12px shell, the header rule that only exists while the card
 * is open, the 36px identity tile, the count pill beside the title, the running
 * figure on the second line, the `+` and the outline action and the chevron as
 * flat siblings, the body inset a unit tighter than the header, and each row a
 * bordered card with a tinted action bar under it.
 *
 * Ported from `purchase-order-cart/components/VendorGroupCard.tsx` and
 * `CartLineItem.tsx`. Two controls did not come with it, because a return has
 * nothing for them to do: the cart's checkboxes choose which lines get ordered,
 * and a part on this return is already going back. What the cart expresses by
 * ticking, this expresses with the quantity -- a vendor at nothing is a vendor
 * taking nothing, and it dims exactly as an unticked cart line does.
 */

import { TrackingTag } from '@/app/components/rma/TrackingTag';
import { ArrowRight, Building2, ChevronDown, ChevronUp, Lock, Package, Pencil, Plus, ScanLine, Search, Trash2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/app/components/ui/popover';
import { ImageWithFallback } from '@/app/components/figma/ImageWithFallback';
import {
  ITEMS_MODULE_URL,
  ItemDescriptionWithToggle,
  imageForSku,
  longDescriptionFor,
} from '@/app/components/VendorSelectionItemCell';
import { ItemImageWithPreview, ItemQuickViewModal } from '@/app/components/invoice-details/ItemQuickView';
import { useState } from 'react';
import { returnableItems,
  type TrackingMode,
} from '@/app/data/itemProvenance';
import { formatQty } from '@/app/components/vendorSelectionModel';
import { QtyStepper } from '@/app/components/rma/QtyStepper';
import { TRACKING_CHIP, TRACKING_LABELS } from '@/app/data/itemProvenance';

const money = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * The vendors that could still take a share of this part.
 *
 * Short lists do not need a filter, but this one is not always short -- a part
 * with five suppliers offers four here, and by-vendor returns reach it with
 * more -- and the name is the only thing anyone scans for. So it takes a query,
 * the same way every other vendor list in the flow does.
 */
function AddVendorList({
  sku,
  addable,
  onAdd,
  unsourced,
  onChosen,
}: {
  sku: string;
  addable: AddableVendor[];
  onAdd: (vendorCode: string) => void;
  /** Nobody shipped it, so the list is every partner rather than the ones who
   *  did -- and the heading has to say so, or 40 names read as a bug. */
  unsourced: boolean | undefined;
  /** Close the list that opened it. A popover that stays open after the choice
   *  sits over whatever is beneath it, which on a dialog is its own footer. */
  onChosen: () => void;
}) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const shown = q ? addable.filter((v) => v.name.toLowerCase().includes(q) || v.code.toLowerCase().includes(q)) : addable;

  return (
    <>
      <p className="px-3 pt-2 text-[10px] text-slate-400 uppercase tracking-wide" style={{ fontWeight: 600 }}>
        {unsourced ? `Who is taking ${sku} back` : `Who else shipped ${sku}`}
      </p>
      <div className="px-3 py-2 border-b border-[#EEF2F6]">
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
      <div className="divide-y divide-[#EEF2F6] max-h-[280px] overflow-y-auto">
        {shown.length === 0 ? (
          <p className="px-3 py-4 text-center text-[12px] text-slate-400">
            No vendor here matches "{query.trim()}".
          </p>
        ) : (
          shown.map((v) => (
            <button
              key={v.code}
              type="button"
              onClick={() => { onAdd(v.code); onChosen(); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-[#F7FAFF]"
            >
              <VendorTile size={24} />
              <span className="min-w-0 flex-1 truncate text-[12px] text-foreground" style={{ fontWeight: 500 }}>
                {v.name}
              </span>
              <span className="shrink-0 text-[10px] text-slate-400 tabular-nums whitespace-nowrap">
                up to {formatQty(v.cap)}
              </span>
            </button>
          ))
        )}
      </div>
    </>
  );
}

/** One vendor taking a share of this part. */
export interface VendorRow {
  vendorCode: string;
  vendorName: string;
  qty: number;
  /** What they shipped, never more than this part still has to give. */
  cap: number;
  /** Whether they have ever delivered this part. A vendor who has not can
   *  still take it back, but nothing of theirs bounds the figure and there is
   *  no delivery for the credit to unwind. */
  shipped?: boolean;
  locked: boolean;
  trail: string;
  unitPrice: number;
}

/** A vendor that shipped this part but has none of it yet. */
export interface AddableVendor {
  code: string;
  name: string;
  cap: number;
}

export function ReturnItemCard({
  sku,
  description,
  uom,
  trackingMode,
  unsourced,
  lineQty,
  rows,
  addable,
  collapsed,
  onToggleCollapse,
  onQty,
  onAddVendor,
  onMoveBalance,
  onOpenVendor,
  onOpenSerials,
  onOpenLine,
}: {
  sku: string;
  description: string;
  uom: string;
  trackingMode: TrackingMode;
  /** No receiver behind this stock, so the vendor is asked rather than derived
   *  and the list of who could take it is not bounded by who shipped it. */
  unsourced?: boolean;
  /** How much of this part is coming back in total. */
  lineQty: number;
  rows: VendorRow[];
  addable: AddableVendor[];
  collapsed: boolean;
  onToggleCollapse: () => void;
  onQty: (vendorCode: string, qty: number) => void;
  onAddVendor: (vendorCode: string) => void;
  /** Cut a row back to what its vendor shipped and give the rest to another. */
  onMoveBalance: (fromVendorCode: string, toVendorCode: string) => void;
  onOpenVendor: (vendorCode: string) => void;
  /** Name the units. On a serialized part this is what the row's edit opens,
   *  because which units go back is the question a serial number answers and a
   *  count cannot. */
  /** Name the units going back to one vendor. Serialized parts only. */
  onOpenSerials: (vendorCode: string) => void;
  onOpenLine: () => void;
}) {
  // The full view is hosted here rather than threaded up to the screen: the
  // card already knows the item, and one preview at a time is the whole state.
  const [previewSku, setPreviewSku] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [chooseOpen, setChooseOpen] = useState(false);
  const unitPrice = rows[0]?.unitPrice ?? 0;
  const placed = rows.reduce((n, r) => n + r.qty, 0);
  const short = Math.round((lineQty - placed) * 100) / 100;
  const done = short <= 0;
  const named = rows.filter((r) => r.qty > 0).length;

  return (
    <div className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-white">
      {/* Header — sibling controls (no nested interactive elements) */}
      <div className={`flex items-center gap-6 px-4 py-3 ${collapsed ? '' : 'border-b border-[#EEF2F6]'}`}>
        {/* Clickable middle: toggles collapse */}
        <div
          role="button"
          tabIndex={0}
          onClick={onToggleCollapse}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleCollapse(); }
          }}
          className="flex min-w-0 flex-1 items-center gap-3 text-left cursor-pointer outline-none focus-visible:underline"
        >
          {/* The cart puts 36px on a group header and 64px on the line, because
              there the line is the item. Here the item IS the group, so the
              weight moves up to it and the vendor rows come down. */}
          {/* The same three affordances the item carries on the search and
              everywhere else in the suite: hover the image for the master-data
              card, click it for the full view, and the item number opens the
              Items module. The card header was the one place in the flow that
              showed a part without them, so checking what was about to be sent
              back meant going to the previous step. */}
          <span onClick={(e) => e.stopPropagation()} className="shrink-0">
            <ItemImageWithPreview
              sku={sku}
              alt={sku}
              onPreview={() => setPreviewSku(sku)}
              disabled={previewSku !== null}
              size={48}
              unitPrice={unitPrice}
              uom={uom}
              serialized={trackingMode === 'serialized'}
              trackingLabel={TRACKING_LABELS[trackingMode]}
              contentZ="z-[260]"
            />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="flex flex-wrap items-center gap-2">
              <a
                href={ITEMS_MODULE_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="truncate text-[14px] text-foreground hover:text-primary hover:underline decoration-primary/60 underline-offset-2 transition-colors"
                style={{ fontWeight: 600 }}
              >
                {sku}
              </a>
              <TrackingTag mode={trackingMode} size="md" />
            </span>
            {/* What the item actually is. A part number alone is not enough to
                check a return against, and the long description is the same one
                the search and the invoicing tables show, with the same toggle,
                so it reads the same wherever it appears. */}
            {/* Held to a readable measure rather than to whatever the card is
                wide. A description running the full width of a 1100px card
                reads as a paragraph pretending to be a subtitle, and it closed
                the gap the vendor controls need on the right. */}
            <span onClick={(e) => e.stopPropagation()} className="block mt-0.5 max-w-[52ch]">
              <ItemDescriptionWithToggle
                description={longDescriptionFor(sku, description)}
                // Nothing was searched for on this step, so nothing is
                // highlighted -- the text passes through as itself.
                highlightText={(text) => text}
                itemSearch=""
                widthClass="w-full"
                hugText
                textClass="text-[12px]"
              />
            </span>
            {/* What was asked for, and whether the vendors underneath account
                for it. "Placed: 6 EA" named the total of the rows below, which
                the rows already state one by one, and left the figure the part
                was actually added with to be inferred from a warning. The
                quantity is the subject here; the rows are where it went. */}
            <span className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[12px] text-slate-500">
              <span className="tabular-nums text-foreground" style={{ fontWeight: 600 }}>
                {formatQty(lineQty)} {uom}
              </span>
              <span>added</span>
              {short === 0 ? (
                <span>· all of it against the {rows.length === 1 ? 'vendor' : 'vendors'} below</span>
              ) : short > 0 ? (
                // The figure that has to reach zero before the step is done.
                <span className="text-amber-700 tabular-nums" style={{ fontWeight: 500 }}>
                  · {formatQty(short)} {uom} still without a vendor
                </span>
              ) : (
                // Over it is fine and simply stated: somebody entered four,
                // opened the card and found the pallet held four hundred.
                <span className="tabular-nums" style={{ fontWeight: 500 }}>
                  · {formatQty(placed)} {uom} against the {rows.length === 1 ? 'vendor' : 'vendors'} below
                </span>
              )}
            </span>
          </span>
        </div>

        {/* The count and the way to change it are one thought, and both are
            about vendors rather than about the item. Sitting them tight against
            the description made the description look like it ran into them. */}
        <span className="shrink-0 pl-2 text-[10px] text-slate-500 tabular-nums whitespace-nowrap" style={{ fontWeight: 500 }}>
          {/* On a part with suppliers the denominator means something: this many
              of the ones who shipped it are taking it back. On unsourced stock
              nobody shipped it, so "0 of 42" claimed forty-two deliveries that
              never happened -- the whole partner list, counted as provenance. */}
          {unsourced
            ? named === 0
              ? 'No vendor yet'
              : `${named} ${named === 1 ? 'vendor' : 'vendors'} named`
            : `${named} of ${rows.length + addable.length} ${rows.length + addable.length === 1 ? 'vendor' : 'vendors'}`}
        </span>

        <div className="flex shrink-0 items-center gap-2">
          {/* Available whether or not the line balances. Splitting a part means
              taking units off one vendor and giving them to another, so the way
              to name the second cannot be hidden by the first having them all.
              The new row opens at nothing and fills as the other one gives. */}
          {/* Named, not just a glyph: a bare plus on a card full of quantities
              reads as "add one of something" rather than "add a supplier".
              And a Popover rather than a positioned div, because the card
              clips its own corners -- an absolute list inside it was cut off
              at the border. This one portals out of the card entirely. */}
          {addable.length > 0 && (
            <Popover open={addOpen} onOpenChange={setAddOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label={`Add a vendor for ${sku}`}
                  className="inline-flex items-center gap-1.5 h-9 rounded-lg px-2.5 text-[12px] border border-slate-200 bg-white text-foreground transition-colors hover:bg-slate-50 hover:border-primary/40 whitespace-nowrap"
                  style={{ fontWeight: 500 }}
                >
                  <Plus className="w-3.5 h-3.5 text-slate-400" />
                  <span className="hidden sm:inline">Add vendor</span>
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                sideOffset={6}
                className="w-[300px] p-0 rounded-lg border border-[#E2E8F0] overflow-hidden z-[220] shadow-[0_8px_30px_rgba(16,24,40,0.12)]"
              >
                <AddVendorList sku={sku} addable={addable} onAdd={onAddVendor} unsourced={unsourced} onChosen={() => setAddOpen(false)} />
              </PopoverContent>
            </Popover>
          )}

          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={collapsed ? `Show vendors for ${sku}` : `Hide vendors for ${sku}`}
            className="flex w-7 h-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100"
          >
            {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Vendors */}
      {!collapsed && (
        <div className="flex flex-col gap-2 px-3 pb-3 pt-3">
          {rows.length === 0 ? (
            // Nothing to list, so the card says what is missing and offers the
            // one move that fills it. A line of grey text pointing at a button
            // elsewhere on the card left the user reading instructions.
            <div className="flex flex-col items-center gap-2.5 px-4 py-6 text-center">
              <span className="flex w-10 h-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-300">
                <Building2 className="w-5 h-5" />
              </span>
              <div>
                <p className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>
                  No vendor on this item yet
                </p>
                <p className="text-[12px] text-slate-500 mt-0.5 max-w-[46ch]">
                  {unsourced
                    ? 'It was counted into stock rather than received, so no order says where it came from. Pick who is taking it back.'
                    : 'Pick who this item goes back to and how much of it is theirs.'}
                </p>
              </div>
              {addable.length > 0 && (
                <Popover open={chooseOpen} onOpenChange={setChooseOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 h-9 rounded-lg bg-primary px-3.5 text-[12px] text-white shadow-sm transition-colors hover:bg-blue-700"
                      style={{ fontWeight: 600 }}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Choose vendor
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="center"
                    sideOffset={6}
                    className="w-[320px] p-0 rounded-lg border border-[#E2E8F0] overflow-hidden z-[220] shadow-[0_8px_30px_rgba(16,24,40,0.12)]"
                  >
                    <AddVendorList sku={sku} addable={addable} onAdd={onAddVendor} unsourced={unsourced} onChosen={() => setChooseOpen(false)} />
                  </PopoverContent>
                </Popover>
              )}
            </div>
          ) : (
            rows.map((row) => (
              <VendorLine
                key={row.vendorCode}
                row={row}
                sku={sku}
                uom={uom}
                trackingMode={trackingMode}
                onQty={(n) => onQty(row.vendorCode, n)}
                onOpen={() => onOpenVendor(row.vendorCode)}
                onEdit={() => onOpenVendor(row.vendorCode)}
                onRemove={() => onQty(row.vendorCode, 0)}
                onPickSerials={() => onOpenSerials(row.vendorCode)}
                unsourced={unsourced}
                moveTargets={[
                  // Its siblings on this card first -- moving between vendors
                  // already on the return is the likeliest fix -- then anyone
                  // else who could take it.
                  ...rows
                    .filter((other) => other.vendorCode !== row.vendorCode && !other.locked)
                    .map((other) => ({ code: other.vendorCode, name: other.vendorName, cap: other.cap })),
                  ...addable,
                ]}
                onMoveBalance={(toVendorCode) => onMoveBalance(row.vendorCode, toVendorCode)}
              />
            ))
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
    </div>
  );
}

/** A vendor is a company, not a product, and a photograph of one says nothing.
 *  The cart draws its partners with a plain glyph in a tinted tile for the same
 *  reason -- and here it also keeps the vendor rows from competing with the
 *  part's own thumbnail on the card above them. */
function VendorTile({ size = 40 }: { name?: string; size?: number }) {
  return (
    <div
      style={{ width: size, height: size }}
      className="flex shrink-0 items-center justify-center rounded-lg border border-[#EEF2F6] bg-slate-50 text-slate-400"
    >
      <Building2 style={{ width: Math.round(size * 0.4), height: Math.round(size * 0.4) }} />
    </div>
  );
}

/** One vendor's share of this part — the cart's line item, with the vendor in
 *  the item's place. A vendor at nothing dims the way an unticked cart line
 *  does: it is on the card, but nothing is going back to them yet. */
function VendorLine({
  row,
  sku,
  uom,
  trackingMode,
  onQty,
  onOpen,
  onEdit,
  onRemove,
  onPickSerials,
  unsourced,
  moveTargets,
  onMoveBalance,
}: {
  row: VendorRow;
  sku: string;
  uom: string;
  trackingMode: TrackingMode;
  onQty: (n: number) => void;
  onOpen: () => void;
  onEdit: () => void;
  onRemove: () => void;
  /** Nobody shipped this stock, so there is no delivery to quote. */
  unsourced: boolean | undefined;
  /** Name which of this vendor's units are going back. Serialized rows only:
   *  there the count is not something to type, it is what naming the units
   *  comes to. */
  onPickSerials: () => void;
  /** Vendors the amount over this one's ceiling could go to instead. */
  moveTargets: AddableVendor[];
  /** Cut this row back to what its vendor shipped, and hand the rest over. */
  onMoveBalance: (vendorCode: string) => void;
}) {
  const active = row.qty > 0;
  // What they are being asked for beyond what they sold. Unsourced stock has no
  // delivery to exceed, so the ceiling there is the stock itself and the same
  // arithmetic still holds.
  const over = Math.round((row.qty - row.cap) * 100) / 100;
  return (
    <div
      className={`overflow-hidden rounded-lg border border-[#E2E8F0] transition-all duration-150 ${
        active ? 'bg-white' : 'bg-slate-100/40 opacity-65'
      }`}
    >
      {/* Main row */}
      <div className="flex items-start gap-3 px-3 py-2.5">
        <VendorTile size={40} />

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-2">
            {/* The name opens the vendor, as the cart's item code opens the item. */}
            <button
              type="button"
              onClick={onOpen}
              title={`Open ${row.vendorName}`}
              className="h-auto min-h-0 p-0 text-left min-w-0"
            >
              <span className="block truncate text-[14px] text-foreground transition-colors hover:text-primary hover:underline" style={{ fontWeight: 600 }}>
                {row.vendorName}
              </span>
            </button>
            {row.locked && (
              <span className="shrink-0 inline-flex items-center gap-1 h-[18px] px-1.5 rounded border border-emerald-200 bg-emerald-50 text-[10px] text-emerald-700" style={{ fontWeight: 600 }}>
                <Lock className="w-2.5 h-2.5" />
                From the receiver
              </span>
            )}
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px] text-slate-500">
            {/* What they shipped -- which on unsourced stock is nothing, so
                saying "up to 46" credited this vendor with a delivery that has
                no receipt behind it. */}
            <span className="inline-flex items-center gap-1">
              <Package className="w-3 h-3" />
              {unsourced ? 'No receipt on file' : `up to ${formatQty(row.cap)} ${uom}`}
            </span>
            <span>·</span>
            <span className="inline-flex items-baseline gap-1">
              <span className="text-foreground tabular-nums" style={{ fontWeight: 600 }}>
                {money(row.unitPrice)}
              </span>
              <span>/ {uom}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-between border-t border-[#EEF2F6] bg-slate-100/30 px-3 py-1.5">
        {row.locked ? (
          <span className="inline-flex items-center gap-1.5 text-[12px] text-emerald-700" style={{ fontWeight: 600 }}>
            <Lock className="w-3 h-3" />
            {formatQty(row.qty)} {uom} · placed by the paperwork
          </span>
        ) : trackingMode === 'serialized' ? (
          // A serialized row has no quantity to type. Which of this vendor's
          // units are going back is the question, and answering it answers the
          // count: five serials named is five units. A stepper here would let
          // the row claim a figure no unit list stands behind, which is the same
          // reason the search offers a picker rather than a field.
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onPickSerials}
              className={
                active
                  ? 'inline-flex items-center gap-1.5 h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-[12px] text-foreground transition-colors hover:bg-slate-50'
                  : 'inline-flex items-center gap-1.5 h-8 rounded-lg bg-primary px-3 text-[12px] text-white shadow-sm transition-colors hover:bg-blue-700'
              }
              style={{ fontWeight: active ? 500 : 600 }}
              aria-label={`Name the ${sku} units going back to ${row.vendorName}`}
            >
              <ScanLine className="w-3.5 h-3.5" />
              {active ? 'Change units' : 'Add units'}
            </button>
            {/* The count sits outside the control, because it is a result. */}
            {active && (
              <span className="inline-flex items-center h-[22px] rounded-md bg-blue-50 border border-blue-100 px-2 text-[11px] text-primary tabular-nums whitespace-nowrap" style={{ fontWeight: 600 }}>
                {formatQty(row.qty)} {uom} selected
              </span>
            )}
          </div>
        ) : (
          // The cart keeps its stepper on the row at all times, and so does
          // this: the figure already exists, so it is being adjusted rather
          // than decided. The Add-then-enter sequence belongs on the search,
          // where typing a figure is what puts a part on the return.
          <div className="flex items-center gap-2.5">
            <QtyStepper
              value={row.qty}
              cap={row.cap}
              ariaLabel={`Quantity of ${sku} going back to ${row.vendorName}`}
              onChange={onQty}
            />
            {/* The cart pluralises its unit label, but its units are words. Ours
                are codes -- BOX, EA, SHT -- and a code does not take an s. */}
            <span className="text-[12px] text-slate-500">{uom}</span>
          </div>
        )}
        {over > 0 && (
          // The ceiling was on the row all along and nothing made it matter.
          // Said here, next to the figure that broke it, with the move that
          // fixes it -- a red border alone tells the user something is wrong
          // and nothing about what to do.
          <div className="flex min-w-0 flex-1 items-center justify-end gap-2 pr-1">
            <span className="truncate text-[11px] text-red-700" style={{ fontWeight: 600 }}>
              {formatQty(over)} {uom} more than they shipped
            </span>
            {moveTargets.length > 0 && (
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="shrink-0 inline-flex items-center gap-1 h-7 rounded-md border border-red-200 bg-white px-2 text-[11px] text-red-700 transition-colors hover:bg-red-50 whitespace-nowrap"
                    style={{ fontWeight: 600 }}
                    aria-label={`Move ${formatQty(over)} ${uom} of ${sku} off ${row.vendorName}`}
                  >
                    <ArrowRight className="w-3 h-3" />
                    Move balance
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  align="end"
                  sideOffset={6}
                  className="w-[300px] p-0 rounded-lg border border-[#E2E8F0] overflow-hidden z-[220] shadow-[0_8px_30px_rgba(16,24,40,0.12)]"
                >
                  <p className="px-3 pt-2 text-[10px] text-slate-400 uppercase tracking-wide" style={{ fontWeight: 600 }}>
                    Who takes the other {formatQty(over)} {uom}
                  </p>
                  <div className="px-3 pb-2 pt-1 text-[11px] text-slate-500 leading-snug">
                    {row.vendorName} keeps {formatQty(row.cap)} {uom}, all they shipped.
                  </div>
                  <div className="divide-y divide-[#EEF2F6] max-h-[260px] overflow-y-auto border-t border-[#EEF2F6]">
                    {moveTargets.map((t) => (
                      <button
                        key={t.code}
                        type="button"
                        onClick={() => onMoveBalance(t.code)}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-[#F7FAFF]"
                      >
                        <VendorTile size={24} />
                        <span className="min-w-0 flex-1 truncate text-[12px] text-foreground" style={{ fontWeight: 500 }}>
                          {t.name}
                        </span>
                        <span className="shrink-0 text-[10px] text-slate-400 tabular-nums whitespace-nowrap">
                          up to {formatQty(t.cap)}
                        </span>
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>
        )}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onEdit}
            aria-label={`How ${sku} comes back from ${row.vendorName}`}
            title={`How ${sku} comes back from ${row.vendorName}`}
            className="flex w-7 h-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-foreground"
          >
            <Pencil className="w-[13px] h-[13px]" />
          </button>
          {!row.locked && (
            <button
              type="button"
              onClick={onRemove}
              aria-label={`Take ${row.vendorName} off ${sku}`}
              title={`Take ${row.vendorName} off ${sku}`}
              className="flex w-7 h-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 className="w-[13px] h-[13px]" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
