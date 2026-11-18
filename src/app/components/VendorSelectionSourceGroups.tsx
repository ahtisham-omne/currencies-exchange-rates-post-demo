import React from 'react';
import { Building2, CheckCircle2, ChevronDown, ChevronRight, MapPin, Package, ShoppingCart, Tag } from 'lucide-react';
import { Checkbox } from '@/app/components/ui/checkbox';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/app/components/ui/tooltip';
import {
  ItemDescriptionWithToggle,
  ItemImageWithPreview,
  ITEMS_MODULE_URL,
  imageForSku,
  longDescriptionFor,
} from '@/app/components/VendorSelectionItemCell';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/app/components/ui/hover-card';
import { ImageWithFallback } from '@/app/components/figma/ImageWithFallback';
import {
  PO_STATUS_COLORS,
  formatDate,
  formatMoney,
  formatQty,
  initials,
  buildSourceGroups,
  buildVendorSources,
  deriveGRNStatus,
  derivePOState,
  isSourceSelected,
  type GRNStatusLabels,
  type ItemSource,
  type SelectionGroupBy,
  type SourceGroup,
  type VendorOffer,
} from '@/app/components/vendorSelectionModel';
import { trackingModeFor } from '@/app/data/mockRMAs';
import type { LineItem, Vendor, VendorGRN, VendorPO } from '@/app/data/mockVendors';

/** Verbatim from the qualified-vendors modal — the divider + falloff that
 *  separates a pinned column from the content scrolling under it. */
const STICKY_SHADOW = 'inset -1px 0 0 0 rgba(0,0,0,0.06), 3px 0 6px -2px rgba(0,0,0,0.05)';
/** Column widths, pinned the way that modal pins its own so the table keeps
 *  its rhythm when it has to scroll sideways. */
const COL = {
  select: 40,
  item: 240,
  po: 160,
  qty: 130,
  price: 130,
  available: 150,
  value: 150,
  docs: 200,
} as const;
/** Status labels, matching the Active / category pills on the vendor row:
 *  rounded-full, roomier padding, 10px, and a -50 fill over a -100 border
 *  rather than an alpha tint. */
const STATUS_PILL =
  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] whitespace-nowrap border';
/** The "selected" chip, matching the one on the vendor row: 10px on a -50
 *  fill with a real border, weight 600, and a CheckCircle2 glyph. */
const SELECTED_PILL =
  'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border border-blue-200 bg-blue-50 text-primary text-[10px] whitespace-nowrap';
/** Compact chip for document references inside table rows, where a taller
 *  pill would push the row height around. */
const DOC_PILL =
  'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] whitespace-nowrap';

/** The stat box on a row's right edge. This is the vendor row's box, lifted
 *  out so the vendor, item, PO and receiving rows all render the one
 *  component rather than four lookalikes.
 *
 *  It is a button only when given an `onClick` -- the vendor's boxes
 *  deep-link into the row, the lens ones have nowhere to go, and a plain
 *  div keeps the hover lift and pointer cursor off the ones that do
 *  nothing. */
export function HeaderStat({
  Icon,
  value,
  label,
  muted,
  onClick,
  ariaLabel,
  tooltip,
  hoverTone = 'primary',
}: {
  Icon: typeof Package;
  value: string;
  label: string;
  /** Dims the figure — a zero count, or a closed document. */
  muted?: boolean;
  onClick?: () => void;
  ariaLabel?: string;
  tooltip?: string;
  hoverTone?: 'primary' | 'amber';
}) {
  const tile = muted
    ? 'bg-slate-50 text-slate-400'
    : hoverTone === 'amber'
      ? 'bg-slate-50 text-slate-500 group-hover/metric:bg-amber-50 group-hover/metric:text-amber-700'
      : 'bg-slate-50 text-slate-500 group-hover/metric:bg-blue-50 group-hover/metric:text-primary';

  const body = (
    <>
      <div className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${tile}`}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div className="flex flex-col leading-none">
        <span
          className={`text-[14px] tabular-nums ${muted ? 'text-slate-400' : 'text-foreground'}`}
          style={{ fontWeight: 600 }}
        >
          {value}
        </span>
        <span className="text-[10px] text-slate-500 mt-1 whitespace-nowrap" style={{ fontWeight: 500 }}>
          {label}
        </span>
      </div>
    </>
  );

  const shell = 'flex items-center gap-2.5 bg-white px-2.5 py-1.5 rounded-lg border border-border shrink-0';

  if (!onClick) {
    return <div className={`${shell} group/metric`}>{body}</div>;
  }

  const button = (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={`${shell} ${
        hoverTone === 'amber' ? 'hover:border-amber-300' : 'hover:border-primary/30'
      } hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group/metric text-left`}
    >
      {body}
    </button>
  );

  if (!tooltip) return button;

  return (
    <Tooltip delayDuration={500}>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent
        side="top"
        className="max-w-[260px] p-3 bg-white border border-border rounded-lg shadow-md"
      >
        <p className="text-[12px] text-foreground leading-snug" style={{ fontWeight: 400 }}>
          {tooltip}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}

/** One figure in the run of stats on a vendor row. Counts only: the document
 *  numbers themselves are too long to sit on one line and are already listed in
 *  the table underneath, so they ride along as the hover title. */
function MetaStat({
  value,
  label,
  title,
  accent,
}: {
  value: string;
  label: string;
  title?: string;
  accent?: boolean;
}) {
  return (
    <div className="text-right" title={title}>
      <div
        className={`text-[12px] tabular-nums ${accent ? 'text-primary' : 'text-foreground'}`}
        style={{ fontWeight: 600 }}
      >
        {value}
      </div>
      <div className="text-[10px] text-slate-500 mt-0.5 whitespace-nowrap" style={{ fontWeight: 500 }}>
        {label}
      </div>
    </div>
  );
}

/** The quantity story behind one PO line. It lives on hover because four more
 *  columns would not fit and, once the row is picked, only the available
 *  figure still matters. */
function SourceQuantityCard({ source }: { source: ItemSource }) {
  const rows: { label: string; value: string; strong?: boolean }[] = [
    { label: 'Ordered', value: `${formatQty(source.poItem.quantity)} ${source.uom}` },
    { label: 'Received', value: `${formatQty(source.receivedQty)} ${source.uom}` },
    { label: 'Already returned', value: `${formatQty(source.returnedQty)} ${source.uom}` },
    { label: 'Available to return', value: `${formatQty(source.availableQty)} ${source.uom}`, strong: true },
  ];

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2">
        <span className="w-7 h-7 rounded-md bg-blue-50 flex items-center justify-center text-primary shrink-0">
          <ShoppingCart className="w-3.5 h-3.5" />
        </span>
        <div className="min-w-0">
          <p className="text-[12px] text-gray-900 truncate" style={{ fontWeight: 600 }}>
            {source.po.poNumber}
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5 truncate">
            {source.po.status} · {formatDate(source.po.poDate)}
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-gray-100 divide-y divide-gray-100 overflow-hidden">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3 px-2.5 py-1.5">
            <span className="text-[10px] text-slate-500" style={{ fontWeight: 500 }}>
              {row.label}
            </span>
            <span
              className={`text-[11px] tabular-nums shrink-0 ${row.strong ? 'text-warning' : 'text-foreground'}`}
              style={{ fontWeight: 600 }}
            >
              {row.value}
            </span>
          </div>
        ))}
      </div>

      <p className="text-[10px] text-slate-500 leading-snug">
        Ordered from {source.vendor.vendorName}.
      </p>
    </div>
  );
}

/** Every receipt the line arrived on. The row can only name the first, so the
 *  "+N" is the affordance that opens the rest rather than a dead count. */
function SourceReceiptsCard({ source }: { source: ItemSource }) {
  const receipts = source.grn ? [source.grn] : source.relatedGRNs;

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2">
        <span className="w-7 h-7 rounded-md bg-blue-50 flex items-center justify-center text-primary shrink-0">
          <Package className="w-3.5 h-3.5" />
        </span>
        <div className="min-w-0">
          <p className="text-[12px] text-gray-900 truncate" style={{ fontWeight: 600 }}>
            {receipts.length} receiving document{receipts.length !== 1 ? 's' : ''}
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5 truncate">
            {source.poItem.sku} on {source.po.poNumber}
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-gray-100 divide-y divide-gray-100 overflow-hidden">
        {receipts.map((receipt) => {
          const qty = receipt.items.find((i) => i.sku === source.poItem.sku)?.quantity ?? 0;
          return (
            <div key={receipt.grnNumber} className="flex items-center justify-between gap-3 px-2.5 py-2">
              <div className="min-w-0">
                <p className="text-[11px] text-gray-900 truncate" style={{ fontWeight: 600 }}>
                  {receipt.grnNumber}
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">{formatDate(receipt.grnDate)}</p>
              </div>
              <span
                className="text-[11px] text-foreground tabular-nums shrink-0"
                style={{ fontWeight: 600 }}
              >
                {formatQty(qty)} {source.uom}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** The same table the vendor-first view uses for a PO's line items: a tinted
 *  column for the quantity the user is actually deciding on, and rows flush to
 *  the panel rather than a card floating inside another card. */
/** The line-item table inside a document card. Mirrors the vendor lens's PO
 *  table — same section strip, same item cell with image and description
 *  toggle, same tinted quantity column — with the return-flow columns in
 *  place of the invoicing ones. */
export function SourceRows({
  sources,
  selectedItemIds,
  onToggleSource,
  availableLabel,
  sectionLabel,
  showPOColumn,
  showLinkedDocuments,
  highlightText,
  itemSearch,
  onPreviewItem,
  quickViewOpen,
  lockedVendorCode,
  lockedVendorName,
  receiptByItem,
}: {
  sources: ItemSource[];
  selectedItemIds: Set<string>;
  onToggleSource: (source: ItemSource) => void;
  availableLabel: string;
  /** Names what the rows are, e.g. "All PO Line Items". */
  sectionLabel: string;
  /** Shown in the vendor lens, where one table spans every order the vendor
   *  has open. Redundant inside a PO card, which names the order already. */
  showPOColumn: boolean;
  /** Dropped in the Receiving lens, where every row arrived on the receipt
   *  the card header already names and the chips would repeat it. */
  showLinkedDocuments: boolean;
  highlightText: (text: string, query: string) => React.ReactNode;
  itemSearch: string;
  onPreviewItem: (sku: string, vendorName: string) => void;
  quickViewOpen: boolean;
  /** The vendor the return is already committed to, if any. Lines from any
   *  other vendor cannot join it, so their rows are inert. */
  lockedVendorCode?: string | null;
  lockedVendorName?: string | null;
  receiptByItem: Map<string, string>;
}) {
  const selectedCount = sources.filter((s) =>
    isSourceSelected(s, selectedItemIds, receiptByItem),
  ).length;

  return (
    <div className="bg-white">
      <div className="px-6 py-2 bg-gray-50/50 border-b border-gray-100 flex items-center justify-between">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{sectionLabel}</p>
        <span className="text-[9px] font-medium text-gray-400 bg-white px-2 py-0.5 rounded border border-gray-100">
          {selectedCount} / {sources.length} Selected
        </span>
      </div>

      <div className="overflow-x-auto">
      <table className="w-full text-left text-[11px]">
        <thead
          className="bg-[#f8fafc] border-b border-gray-100 text-slate-500 text-[11px] [&>tr>th]:h-8 [&>tr>th]:py-0 [&>tr>th]:pl-4 [&>tr>th]:pr-2"
          style={{ fontWeight: 500 }}
        >
          <tr>
            <th
              className="sticky left-0 z-20 bg-[#f8fafc] !pl-2 !pr-0"
              style={{ width: COL.select, minWidth: COL.select, maxWidth: COL.select }}
            />
            <th
              className="sticky z-20 bg-[#f8fafc]"
              style={{
                left: COL.select,
                boxShadow: STICKY_SHADOW,
                width: COL.item,
                minWidth: COL.item,
                maxWidth: COL.item,
              }}
            >
              Items
            </th>
            {showPOColumn && (
              <th style={{ width: COL.po, minWidth: COL.po }}>Purchase Order</th>
            )}
            <th className="text-right" style={{ width: COL.qty, minWidth: COL.qty }}>
              Ordered Qty
            </th>
            <th className="text-right" style={{ width: COL.qty, minWidth: COL.qty }}>
              Received Qty
            </th>
            <th className="text-right" style={{ width: COL.price, minWidth: COL.price }}>
              Price per unit
            </th>
            <th
              className="text-right whitespace-nowrap bg-warning/[0.08] text-warning"
              style={{ width: COL.available, minWidth: COL.available }}
            >
              {availableLabel}
            </th>
            <th
              className="text-right whitespace-nowrap"
              style={{ width: COL.value, minWidth: COL.value }}
            >
              Return Value
            </th>
            {showLinkedDocuments && (
              <th className="!pr-5" style={{ width: COL.docs, minWidth: COL.docs }}>
                Linked Documents
              </th>
            )}
          </tr>
        </thead>

        <tbody className="divide-y divide-gray-100">
          {sources.map((source) => {
            const checked = isSourceSelected(source, selectedItemIds, receiptByItem);
            const receipts = source.grn ? [source.grn] : source.relatedGRNs;
            const item = source.poItem;
            const blocked =
              !checked && !!lockedVendorCode && source.vendor.vendorCode !== lockedVendorCode;
            const cellBg = checked ? 'bg-blue-50' : 'bg-white group-hover:bg-[#F0F7FF]';
            // Over-receipt is a real edge case in the mock data, and a
            // return quoted against it would be wrong, so the figure goes
            // red rather than reading as a normal receipt.
            const overReceived = source.receivedQty > item.quantity;

            return (
              <tr
                key={source.id}
                id={`src-${source.poItem.id}`}
                className={`group transition-colors [&>td]:py-1.5 [&>td]:pl-4 [&>td]:pr-2 ${
                  blocked
                    ? 'opacity-45 cursor-not-allowed'
                    : checked
                      ? 'bg-blue-50/50 cursor-pointer'
                      : 'bg-white hover:bg-[#F0F7FF] cursor-pointer'
                }`}
                onClick={() => {
                  if (!blocked) onToggleSource(source);
                }}
              >
                {/* One selection control everywhere: the same checkbox the
                    group headers use, so picking a line inside Vendor, PO or
                    Receiving looks like picking one under Item. The round
                    add-pill borrowed from the qualified-vendors modal read as
                    a different kind of control on the same list (2/9/26). */}
                <td
                  className={`sticky left-0 z-10 !pl-2 !pr-0 ${cellBg}`}
                  style={{ width: COL.select, minWidth: COL.select, maxWidth: COL.select }}
                >
                  <Checkbox
                    checked={checked}
                    disabled={blocked}
                    onCheckedChange={() => {
                      if (!blocked) onToggleSource(source);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`Select ${item.sku} on PO ${source.po.poNumber}`}
                    title={
                      blocked && lockedVendorName
                        ? `Not supplied by ${lockedVendorName}. Clear the selection to return it from another vendor.`
                        : undefined
                    }
                    className="shrink-0 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                  />
                </td>

                <td
                  className={`sticky z-10 ${cellBg}`}
                  style={{
                    left: COL.select,
                    boxShadow: STICKY_SHADOW,
                    width: COL.item,
                    minWidth: COL.item,
                    maxWidth: COL.item,
                  }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div onClick={(e) => e.stopPropagation()}>
                      <ItemImageWithPreview
                        sku={item.sku}
                        src={imageForSku(item.sku)}
                        alt={item.sku}
                        onPreview={() => onPreviewItem(item.sku, source.vendor.vendorName)}
                        size={36}
                        disabled={quickViewOpen}
                      />
                    </div>
                    <div className="min-w-0">
                      <a
                        href={ITEMS_MODULE_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="font-semibold text-gray-900 hover:text-primary hover:underline decoration-primary/60 underline-offset-2 transition-colors inline-block"
                      >
                        {highlightText(item.sku, itemSearch)}
                      </a>
                      <div onClick={(e) => e.stopPropagation()}>
                        <ItemDescriptionWithToggle
                          description={longDescriptionFor(item.sku, item.description)}
                          highlightText={highlightText}
                          itemSearch={itemSearch}
                        />
                      </div>
                    </div>
                  </div>
                </td>

                {showPOColumn && (
                  <td>
                    <HoverCard openDelay={200} closeDelay={120}>
                      <HoverCardTrigger asChild>
                        <div
                          className="inline-block min-w-0 cursor-help"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div
                            className="text-[12px] text-gray-900 truncate decoration-dotted decoration-slate-300 underline-offset-4 hover:underline hover:text-primary transition-colors"
                            style={{ fontWeight: 600 }}
                          >
                            {source.po.poNumber}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            {formatDate(source.po.poDate)}
                          </div>
                        </div>
                      </HoverCardTrigger>
                      <HoverCardContent side="top" align="start" className="w-[260px] p-3">
                        <SourceQuantityCard source={source} />
                      </HoverCardContent>
                    </HoverCard>
                  </td>
                )}

                <td className="text-right">
                  <div className="font-semibold text-gray-900 tabular-nums">
                    {formatQty(item.quantity)} {source.uom}
                  </div>
                  <div className="text-[10px] font-medium text-gray-500 tabular-nums">
                    {formatMoney(item.quantity * source.unitPrice)}
                  </div>
                </td>

                <td className="text-right">
                  <div
                    className={`font-semibold tabular-nums ${
                      overReceived ? 'text-destructive' : source.receivedQty > 0 ? 'text-gray-900' : 'text-gray-400'
                    }`}
                  >
                    {formatQty(source.receivedQty)} {source.uom}
                  </div>
                  <div className="text-[10px] text-gray-500 tabular-nums" style={{ fontWeight: 500 }}>
                    of {formatQty(item.quantity)} ordered
                  </div>
                </td>

                <td className="text-right">
                  <div className="font-semibold text-gray-900 tabular-nums">
                    {formatMoney(source.unitPrice)}
                  </div>
                  <div className="text-[10px] text-slate-400" style={{ fontWeight: 500 }}>
                    per {source.uom}
                  </div>
                </td>

                <td className="text-right bg-warning/[0.04]">
                  <div className="font-bold text-warning tabular-nums">
                    {formatQty(source.availableQty)} {source.uom}
                  </div>
                  <div className="text-[10px] font-medium text-gray-500 tabular-nums">
                    of {formatQty(source.receivedQty)} received
                  </div>
                </td>

                <td className="text-right">
                  <div className="font-semibold text-gray-900 tabular-nums">
                    {formatMoney(source.availableQty * source.unitPrice)}
                  </div>
                  <div className="text-[10px] text-gray-500 tabular-nums" style={{ fontWeight: 500 }}>
                    {formatQty(source.availableQty)} {source.uom}
                  </div>
                </td>

                {showLinkedDocuments && (
                  <td className="!pr-5">
                    {receipts.length === 0 ? (
                      <span className="text-[11px] text-slate-400">Not received</span>
                    ) : (
                      <div className="flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
                        <HoverCard openDelay={200} closeDelay={120}>
                          <HoverCardTrigger asChild>
                            <span
                              className={`${DOC_PILL} bg-gray-600/15 text-gray-600 cursor-help`}
                              style={{ fontWeight: 700 }}
                            >
                              <Package className="w-2.5 h-2.5" />
                              {receipts[0]!.grnNumber}
                            </span>
                          </HoverCardTrigger>
                          <HoverCardContent side="top" align="start" className="w-[260px] p-3">
                            <SourceReceiptsCard source={source} />
                          </HoverCardContent>
                        </HoverCard>
                        {receipts.length > 1 && (
                          <HoverCard openDelay={200} closeDelay={120}>
                            <HoverCardTrigger asChild>
                              <span
                                className={`${DOC_PILL} bg-primary/15 text-primary cursor-help`}
                                style={{ fontWeight: 700 }}
                              >
                                + {receipts.length - 1} more
                              </span>
                            </HoverCardTrigger>
                            <HoverCardContent side="top" align="start" className="w-[260px] p-3">
                              <SourceReceiptsCard source={source} />
                            </HoverCardContent>
                          </HoverCard>
                        )}
                      </div>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}


/** One vendor's whole position on the item: every receipt they supplied it
 *  on, combined into a single row. A vendor that delivered the part four
 *  times is one decision, not four, so the row carries the summed quantity
 *  and ticking it takes the lot. */
/** One item inside whichever entity leads the lens, and whatever is left of
 *  the chain beneath it. The item lens leads with the item and nests vendor →
 *  PO → receiving; the other three lead with their own entity and nest what
 *  that entity has not already fixed: a PO knows its vendor, a receipt knows
 *  both, so neither is repeated on the rows underneath.
 *
 *  `depth` says how far down there is still to go:
 *    'po'      the item spans orders  — expands to POs, each to its receipts
 *    'receipt' the order is fixed     — expands straight to receipts
 *    'none'    the receipt is fixed   — the item is the leaf
 */
export function GroupItemRow({
  sku,
  sources,
  depth,
  selectedItemIds,
  receiptByItem,
  onSelectSources,
  blocked,
  blockedTitle,
  autoOpen = false,
  autoOpenReceipts = false,
  highlightText,
  itemSearch,
  poSearch,
  grnSearch,
}: {
  sku: string;
  sources: ItemSource[];
  depth: 'po' | 'receipt' | 'none';
  selectedItemIds: Set<string>;
  receiptByItem: Map<string, string>;
  onSelectSources: (sources: ItemSource[], select: boolean) => void;
  blocked: boolean;
  blockedTitle?: string | undefined;
  autoOpen?: boolean;
  autoOpenReceipts?: boolean;
  highlightText: (text: string, query: string) => React.ReactNode;
  itemSearch: string;
  poSearch: string;
  grnSearch: string;
}) {
  const [manual, setManual] = React.useState<boolean | null>(null);
  const open = manual ?? autoOpen;
  const selectedCount = sources.filter((s) => isSourceSelected(s, selectedItemIds, receiptByItem)).length;
  const state: boolean | 'indeterminate' =
    selectedCount === 0 ? false : selectedCount === sources.length ? true : 'indeterminate';
  const qty = sources.reduce((n, s) => n + s.availableQty, 0);
  const value = sources.reduce((n, s) => n + s.availableQty * s.unitPrice, 0);
  const uom = sources[0]?.uom ?? '';
  const description = sources[0]?.poItem.description ?? '';

  const poGroups = React.useMemo(() => {
    const byPO = new Map<string, ItemSource[]>();
    sources.forEach((src) => {
      const list = byPO.get(src.po.poNumber) ?? [];
      list.push(src);
      byPO.set(src.po.poNumber, list);
    });
    return [...byPO.entries()];
  }, [sources]);

  const receipts = React.useMemo(
    () =>
      Array.from(
        new Map(
          sources.flatMap((s) => (s.grn ? [s.grn] : s.relatedGRNs)).map((g) => [g.grnNumber, g]),
        ).values(),
      ),
    [sources],
  );

  const expandable = depth === 'po' ? poGroups.length > 0 : depth === 'receipt' ? receipts.length > 0 : false;

  return (
    <div className="border-t border-[#EEF2F6] first:border-t-0">
      <div
        className={`flex items-center gap-2.5 px-4 py-2.5 transition-colors ${
          blocked ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-[#F0F7FF]'
        }`}
        onClick={() => !blocked && onSelectSources(sources, selectedCount === 0)}
      >
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setManual(!open); }}
          className="w-4 h-4 flex items-center justify-center rounded text-slate-400 hover:text-slate-600 shrink-0"
          aria-label={open ? `Collapse ${sku}` : `Expand ${sku}`}
          disabled={!expandable}
        >
          {!expandable ? null : open ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
        </button>
        <Checkbox
          checked={state}
          disabled={blocked}
          onCheckedChange={() => !blocked && onSelectSources(sources, selectedCount === 0)}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Select ${sku}`}
          title={blockedTitle}
          className="shrink-0 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
        />
        <span className="w-8 h-8 rounded-md overflow-hidden border border-[#E8ECF1] bg-white shrink-0">
          <ImageWithFallback src={imageForSku(sku)} alt={sku} className="w-full h-full object-cover" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] text-foreground truncate" style={{ fontWeight: 600 }}>
            {highlightText(sku, itemSearch)}
          </p>
          <p className="text-[10.5px] text-slate-500 truncate mt-px">
            {highlightText(description, itemSearch)}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[12px] text-foreground tabular-nums" style={{ fontWeight: 600 }}>
            {formatQty(qty)} {uom}
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5" style={{ fontWeight: 500 }}>
            {formatMoney(value)}
          </p>
        </div>
      </div>

      {open && depth === 'po' && (
        <div className="border-t border-[#EEF2F6] bg-[#FAFBFC] border-l-2 border-l-[#E2E8F0] ml-4">
          {poGroups.map(([poNumber, poSources]) => (
            <OfferPORow
              key={poNumber}
              poNumber={poNumber}
              sources={poSources}
              selectedItemIds={selectedItemIds}
              receiptByItem={receiptByItem}
              onSelectSources={onSelectSources}
              blocked={blocked}
              blockedTitle={blockedTitle}
              autoOpen={autoOpenReceipts}
              highlightText={highlightText}
              poSearch={poSearch}
              grnSearch={grnSearch}
            />
          ))}
        </div>
      )}

      {open && depth === 'receipt' && (
        <div className="bg-[#FBFCFD] border-t border-[#EEF2F6]">
          {receipts.map((grn) => {
            const forGrn = sources
              .filter((s) => (s.grn ? s.grn.grnNumber === grn.grnNumber : s.relatedGRNs.some((g) => g.grnNumber === grn.grnNumber)))
              .map((s) => ({ ...s, grn }));
            const on = forGrn.some((x) => isSourceSelected(x, selectedItemIds, receiptByItem));
            const grnQty = forGrn.reduce((n, x) => n + x.availableQty, 0);
            return (
              <div
                key={grn.grnNumber}
                className={`flex items-center gap-2.5 pl-9 pr-4 py-1.5 border-t border-[#EEF2F6] transition-colors ${
                  blocked ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-[#F0F7FF]'
                }`}
                onClick={() => !blocked && onSelectSources(forGrn, !on)}
              >
                <Checkbox
                  checked={on}
                  disabled={blocked}
                  onCheckedChange={() => !blocked && onSelectSources(forGrn, !on)}
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`Select receiving ${grn.grnNumber}`}
                  title={blockedTitle}
                  className="shrink-0 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                />
                <Package className="w-3 h-3 text-slate-400 shrink-0" />
                <span className="text-[11px] text-slate-600 shrink-0" style={{ fontWeight: 600 }}>
                  {highlightText(grn.grnNumber, grnSearch)}
                </span>
                <span className="text-[10px] text-slate-400 truncate min-w-0 flex-1" style={{ fontWeight: 500 }}>
                  {formatDate(grn.grnDate)}
                </span>
                <span className="text-[11px] text-slate-500 tabular-nums shrink-0" style={{ fontWeight: 600 }}>
                  {formatQty(grnQty)} {uom}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** One purchase order inside a vendor's offer, and the receipts it arrived
 *  on. The item lens used to stop at the vendor, which answered "who can take
 *  this back" and left "off which order, on which delivery" to be found by
 *  switching lenses -- so a user who searched a receipt could not see that
 *  receipt in the results they were looking at. */
function OfferPORow({
  poNumber,
  sources,
  selectedItemIds,
  receiptByItem,
  onSelectSources,
  blocked,
  blockedTitle,
  autoOpen = false,
  highlightText,
  poSearch,
  grnSearch,
}: {
  poNumber: string;
  sources: ItemSource[];
  selectedItemIds: Set<string>;
  receiptByItem: Map<string, string>;
  onSelectSources: (sources: ItemSource[], select: boolean) => void;
  blocked: boolean;
  blockedTitle?: string | undefined;
  autoOpen?: boolean;
  highlightText: (text: string, query: string) => React.ReactNode;
  poSearch: string;
  grnSearch: string;
}) {
  // Searching a receipt should show that receipt, not a chain of chevrons
  // leading to it. The row opens itself while such a search is running, and
  // stops following it the moment the user opens or closes it by hand.
  const [manual, setManual] = React.useState<boolean | null>(null);
  const open = manual ?? autoOpen;
  const setOpen = (fn: (v: boolean) => boolean) => setManual(fn(open));
  const selectedCount = sources.filter((s) => isSourceSelected(s, selectedItemIds, receiptByItem)).length;
  const state: boolean | 'indeterminate' =
    selectedCount === 0 ? false : selectedCount === sources.length ? true : 'indeterminate';
  const qty = sources.reduce((n, s) => n + s.availableQty, 0);
  const uom = sources[0]?.uom ?? '';

  // A line can have arrived on several deliveries, so the receipts under a PO
  // are the union of them, each carrying the lines that came in on it.
  const receipts = Array.from(
    new Map(
      sources.flatMap((s) => (s.grn ? [s.grn] : s.relatedGRNs)).map((g) => [g.grnNumber, g]),
    ).values(),
  );

  return (
    <div className="border-t border-[#F1F5F9] first:border-t-0">
      <div
        className={`flex items-center gap-2.5 pl-3 pr-4 py-2 transition-colors ${
          blocked ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-[#F0F7FF]'
        }`}
        onClick={() => !blocked && onSelectSources(sources, selectedCount === 0)}
      >
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
          className="w-4 h-4 flex items-center justify-center rounded text-slate-400 hover:text-slate-600 shrink-0"
          aria-label={open ? 'Collapse receivings' : 'Expand receivings'}
          disabled={receipts.length === 0}
        >
          {receipts.length === 0 ? null : open ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
        </button>
        <Checkbox
          checked={state}
          disabled={blocked}
          onCheckedChange={() => !blocked && onSelectSources(sources, selectedCount === 0)}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Select PO ${poNumber}`}
          title={blockedTitle}
          className="shrink-0 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
        />
        <ShoppingCart className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        <span className="text-[12px] text-foreground shrink-0" style={{ fontWeight: 600 }}>
          PO {highlightText(poNumber, poSearch)}
        </span>
        <span className="text-[10px] text-slate-400 truncate min-w-0 flex-1" style={{ fontWeight: 500 }}>
          {receipts.length} receiving{receipts.length !== 1 ? 's' : ''}
        </span>
        <span className="text-[11px] text-slate-600 tabular-nums shrink-0" style={{ fontWeight: 600 }}>
          {formatQty(qty)} {uom}
        </span>
      </div>

      {open &&
        receipts.map((grn) => {
          // Selecting a receipt names it, so the line comes back on that
          // delivery rather than on every one that carried the part.
          const forGrn = sources
            .filter((s) => (s.grn ? s.grn.grnNumber === grn.grnNumber : s.relatedGRNs.some((g) => g.grnNumber === grn.grnNumber)))
            .map((s) => ({ ...s, grn }));
          const on = forGrn.some((s) => isSourceSelected(s, selectedItemIds, receiptByItem));
          const grnQty = forGrn.reduce((n, s) => n + s.availableQty, 0);
          return (
            <div
              key={grn.grnNumber}
              className={`flex items-center gap-2.5 pl-9 pr-4 py-1.5 border-t border-[#EEF2F6] transition-colors ${
                blocked ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-[#F0F7FF]'
              }`}
              onClick={() => !blocked && onSelectSources(forGrn, !on)}
            >
              <Checkbox
                checked={on}
                disabled={blocked}
                onCheckedChange={() => !blocked && onSelectSources(forGrn, !on)}
                onClick={(e) => e.stopPropagation()}
                aria-label={`Select receiving ${grn.grnNumber}`}
                title={blockedTitle}
                className="shrink-0 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
              />
              <Package className="w-3 h-3 text-slate-400 shrink-0" />
              <span className="text-[11px] text-slate-600 shrink-0" style={{ fontWeight: 600 }}>
                {highlightText(grn.grnNumber, grnSearch)}
              </span>
              <span className="text-[10px] text-slate-400 truncate min-w-0 flex-1" style={{ fontWeight: 500 }}>
                {formatDate(grn.grnDate)}
              </span>
              <span className="text-[11px] text-slate-500 tabular-nums shrink-0" style={{ fontWeight: 600 }}>
                {formatQty(grnQty)} {uom}
              </span>
            </div>
          );
        })}
    </div>
  );
}

function VendorOfferRow({
  offer,
  selectedItemIds,
  onSelectSources,
  blocked,
  blockedTitle,
  receiptByItem,
  autoOpen = false,
  autoOpenReceipts = false,
  highlightText,
  vendorSearch,
  poSearch,
  grnSearch,
}: {
  offer: VendorOffer;
  selectedItemIds: Set<string>;
  receiptByItem: Map<string, string>;
  onSelectSources: (sources: ItemSource[], select: boolean) => void;
  blocked: boolean;
  blockedTitle?: string | undefined;
  autoOpen?: boolean;
  autoOpenReceipts?: boolean;
  highlightText: (text: string, query: string) => React.ReactNode;
  vendorSearch: string;
  poSearch: string;
  grnSearch: string;
}) {
  const selectedCount = offer.sources.filter((s) =>
    isSourceSelected(s, selectedItemIds, receiptByItem),
  ).length;
  const isSelected = selectedCount > 0;
  const checkboxState: boolean | 'indeterminate' =
    selectedCount === 0 ? false : selectedCount === offer.sources.length ? true : 'indeterminate';

  const receipts = Array.from(
    new Map(
      offer.sources.flatMap((s) => (s.grn ? [s.grn] : s.relatedGRNs)).map((g) => [g.grnNumber, g]),
    ).values(),
  );
  const poCount = new Set(offer.sources.map((s) => s.po.poNumber)).size;
  const returnValue = offer.sources.reduce((sum, s) => sum + s.availableQty * s.unitPrice, 0);

  const toggle = () => {
    if (blocked) return;
    onSelectSources(offer.sources, selectedCount === 0);
  };

  const [manual, setManual] = React.useState<boolean | null>(null);
  const open = manual ?? autoOpen;
  const setOpen = (fn: (v: boolean) => boolean) => setManual(fn(open));
  // The vendor's position, broken back down into the orders it came off.
  const poGroups = React.useMemo(() => {
    const byPO = new Map<string, ItemSource[]>();
    offer.sources.forEach((src) => {
      const list = byPO.get(src.po.poNumber) ?? [];
      list.push(src);
      byPO.set(src.po.poNumber, list);
    });
    return [...byPO.entries()];
  }, [offer.sources]);

  return (
    <div
      className="transition-colors border-t border-[#EEF2F6] first:border-t-0"
      style={{
        borderLeft: isSelected ? '3px solid hsl(var(--primary))' : '3px solid transparent',
        backgroundColor: isSelected ? '#F0F7FF' : undefined,
        opacity: blocked ? 0.45 : undefined,
      }}
    >
      <div
        className={`flex items-center gap-3 px-4 py-3 transition-colors ${
          blocked ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-[#F0F7FF]'
        }`}
        onClick={toggle}
      >
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
          className="w-4 h-4 flex items-center justify-center rounded text-slate-400 hover:text-slate-600 shrink-0"
          aria-label={open ? `Collapse ${offer.vendorName}` : `Expand ${offer.vendorName}`}
        >
          {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>
        <Checkbox
          checked={checkboxState}
          disabled={blocked}
          onCheckedChange={toggle}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Select ${offer.vendorName}`}
          title={blockedTitle}
          className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
        />

        <div
          className="flex items-center justify-center size-8 rounded-full shrink-0 text-[10px]"
          style={{
            backgroundColor: isSelected ? 'rgba(10,119,255,0.10)' : 'hsl(var(--secondary))',
            color: isSelected ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
            fontWeight: 600,
          }}
        >
          {offer.abbr}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[13px] text-gray-900 truncate" style={{ fontWeight: 600 }}>
              {highlightText(offer.vendorName, vendorSearch)}
            </span>
            {isSelected && (
              <span
                className={`${SELECTED_PILL} shrink-0`}
                style={{ fontWeight: 600 }}
              >
                <CheckCircle2 className="w-2.5 h-2.5" />
                {selectedCount === offer.sources.length
                  ? 'Selected'
                  : `${selectedCount} of ${offer.sources.length}`}
              </span>
            )}
          </div>
          {/* Counts rather than document numbers: a vendor with a dozen
              receipts cannot list them on one line, and the exact papers
              are in the lens that leads with them. */}
          <span className="block text-[11px] text-slate-500 truncate mt-0.5" style={{ fontWeight: 500 }}>
            {poCount} PO{poCount !== 1 ? 's' : ''}
            {receipts.length > 0 && (
              <>
                <span className="text-slate-300 mx-1">·</span>
                {receipts.length} receiving{receipts.length !== 1 ? 's' : ''}
                <span className="text-slate-300 mx-1">·</span>
                {formatDate(offer.lastDate)}
              </>
            )}
          </span>
        </div>

        <MetaStat
          value={formatMoney(returnValue)}
          label="Return value"
          title={[offer.vendorCode, ...receipts.map((r) => r.grnNumber)].join(' · ')}
          accent
        />

        <div className="w-px h-7 bg-[#EEF2F6] shrink-0" />

        <div className="text-right shrink-0">
          <div className="text-[13px] text-foreground tabular-nums" style={{ fontWeight: 600 }}>
            {formatQty(offer.availableQty)} {offer.uom}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5" style={{ fontWeight: 500 }}>
            {formatMoney(offer.unitPrice)} per {offer.uom}
          </div>
        </div>
      </div>

      {/* Item, then who can take it, then off which order, then on which
          delivery. The chain is the same one the other three lenses each
          lead with, so a user who searched a receipt can find that receipt
          without leaving the view they searched from. */}
      {open && (
        <div className="bg-[#FBFCFD] border-t border-[#EEF2F6]">
          {poGroups.map(([poNumber, poSources]) => (
            <OfferPORow
              key={poNumber}
              poNumber={poNumber}
              sources={poSources}
              selectedItemIds={selectedItemIds}
              receiptByItem={receiptByItem}
              onSelectSources={onSelectSources}
              blocked={blocked}
              blockedTitle={blockedTitle}
              autoOpen={autoOpenReceipts}
              highlightText={highlightText}
              poSearch={poSearch}
              grnSearch={grnSearch}
            />
          ))}
        </div>
      )}
    </div>
  );
}


interface SourceGroupRowProps {
  group: SourceGroup;
  groupBy: Exclude<SelectionGroupBy, 'vendor'>;
  isExpanded: boolean;
  onToggle: () => void;
  selectedItemIds: Set<string>;
  onToggleSource: (source: ItemSource) => void;
  onSelectSources: (sources: ItemSource[], select: boolean) => void;
  lockedVendorCode: string | null;
  lockedVendorName: string | null;
  highlightText: (text: string, query: string) => React.ReactNode;
  itemSearch: string;
  /** Highlights the PO lens's group titles, which are PO numbers rather
   *  than the item text the other lenses lead with. */
  poSearch: string;
  /** Same job for the Receiving lens, whose titles are receipt numbers. */
  grnSearch: string;
  vendorSearch: string;
  /** Variant wording for the receipt status badge — the return flow says
   *  "Not Returned" where invoicing says "Not Invoiced". */
  grnStatusLabels: GRNStatusLabels;
  availableLabel: string;
  /** Opens the full-size item lightbox, same as the vendor lens tables. */
  onPreviewItem: (sku: string, vendorName: string) => void;
  /** Suppresses the item hover-card while the QuickView modal is open, so
   *  the small card never stacks against the big one. */
  quickViewOpen: boolean;
  /** Which receipt each picked PO line was taken from. */
  receiptByItem: Map<string, string>;
}

export function SourceGroupRow({
  group,
  groupBy,
  isExpanded,
  onToggle,
  selectedItemIds,
  onToggleSource,
  onSelectSources,
  lockedVendorCode,
  lockedVendorName,
  highlightText,
  itemSearch,
  poSearch,
  grnSearch,
  vendorSearch,
  grnStatusLabels,
  availableLabel,
  onPreviewItem,
  quickViewOpen,
  receiptByItem,
}: SourceGroupRowProps) {
  const selectedCount = group.sources.filter((s) =>
    isSourceSelected(s, selectedItemIds, receiptByItem),
  ).length;
  const hasSelection = selectedCount > 0;
  const byVendor = groupBy === 'item';
  const LeadIcon = byVendor ? Tag : Package;

  const groupCheckboxState: boolean | 'indeterminate' =
    selectedCount === 0 ? false : selectedCount === group.sources.length ? true : 'indeterminate';

  // Every source in a PO group is a line on the same order from the same
  // vendor, so the first one carries the header's facts.
  const poLead = groupBy === 'po' ? group.sources[0] : undefined;
  const poReceipts = poLead
    ? Array.from(
        new Map(
          group.sources.flatMap((s) => s.relatedGRNs).map((g) => [g.grnNumber, g]),
        ).values(),
      )
    : [];
  const poState = poLead ? derivePOState(poLead.po, poReceipts) : undefined;

  // The Receiving lens's rows are all lines on one receipt, so the first
  // row carries the document. `grn` is only ever set in that grouping.
  const grnLead = groupBy === 'receiver' ? group.sources[0]?.grn : undefined;
  const grnStatus = grnLead ? deriveGRNStatus(grnLead.status, grnStatusLabels) : undefined;
  // The receipt's own value, not the returnable slice of it, so the figure
  // matches the card reached through the vendor lens.
  const grnTotalAmt = grnLead
    ? grnLead.items.reduce((sum, i) => sum + i.totalPrice, 0)
    : 0;
  const poOrigin = poLead
    ? poLead.vendor.locations.find((l) => l.id === poLead.po.originId)?.name ?? poLead.vendor.vendorName
    : '';
  const poClosed =
    poState?.displayStatus === 'Closed' || poState?.displayStatus === 'Fully Invoiced';

  const lockedOffer =
    byVendor && lockedVendorCode
      ? group.offers.find((o) => o.vendorCode === lockedVendorCode)
      : undefined;
  // A return goes to one vendor, so an item that vendor never supplied cannot
  // join the run. Blocking the box is what keeps ticking a second item from
  // switching vendors and clearing everything already picked.
  const blockedByVendorLock = byVendor && !!lockedVendorCode && !lockedOffer && !hasSelection;

  // A PO or a receipt comes from exactly one vendor, so a group from any
  // other vendor cannot join a return that is already committed. Without
  // this the document lenses let a selection span vendors, which the item
  // lens has always refused.
  const docVendorCode = group.sources[0]?.vendor.vendorCode;
  const docBlockedByVendorLock =
    !byVendor && !!lockedVendorCode && docVendorCode !== lockedVendorCode && !hasSelection;
  const lockTitle =
    lockedVendorName && (blockedByVendorLock || docBlockedByVendorLock)
      ? `Not supplied by ${lockedVendorName}. Clear the selection to return it from another vendor.`
      : undefined;

  // Ticking an item takes one line from the vendor already on the return, or
  // from the best-ranked vendor when nothing is committed yet, so a run of
  // items can be picked without opening each one.
  const toggleGroupSelection = () => {
    if (blockedByVendorLock || docBlockedByVendorLock) return;
    if (hasSelection) {
      onSelectSources(
        group.sources.filter((s) => isSourceSelected(s, selectedItemIds, receiptByItem)),
        false,
      );
      return;
    }
    if (!byVendor) {
      onSelectSources(group.sources, true);
      return;
    }
    // Ticking the item takes the item: every vendor that can take it back,
    // not the first one that happens to be listed. The return decides which of
    // them the credit settles against later, and starting from one supplier's
    // slice quietly made that decision here instead.
    if (lockedOffer) {
      onSelectSources(lockedOffer.sources, true);
      return;
    }
    onSelectSources(group.sources, true);
  };

  // The PO lens reuses the card the vendor lens shows one level down, so an
  // order looks the same whichever way the user reached it: PO# and derived
  // status lead, the line/receipt/selection counts sit under them, and the
  // order value anchors the right edge.
  const poHeader = poLead && poState && (
    <div
      className="flex items-center gap-3 px-5 py-2.5 cursor-pointer group select-none"
      onClick={onToggle}
    >
      <Checkbox
        checked={groupCheckboxState}
        disabled={docBlockedByVendorLock}
        onCheckedChange={toggleGroupSelection}
        onClick={(e) => e.stopPropagation()}
        aria-label={`Select PO ${group.title}`}
        title={lockTitle}
        className="shrink-0 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
      />

      <div
        className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-md transition-colors"
        style={{
          backgroundColor: isExpanded ? '#D6E8FF' : 'hsl(var(--muted))',
          color: isExpanded ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
        }}
      >
        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </div>

      <div
        className="flex-shrink-0 w-10 h-10 rounded-md overflow-hidden flex items-center justify-center bg-white transition-all"
        style={{
          border: isExpanded ? '1px solid rgba(10,119,255,0.25)' : '1px solid hsl(var(--border))',
          boxShadow: isExpanded ? '0 0 0 1px rgba(10,119,255,0.10)' : '0 1px 2px rgba(0,0,0,0.03)',
        }}
      >
        <ShoppingCart className={`w-5 h-5 ${isExpanded ? 'text-primary' : 'text-slate-400'}`} />
      </div>

      <div className="flex-1 min-w-0 flex items-center justify-between">
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={`text-[14px] tracking-tight ${
                poClosed
                  ? 'text-gray-500 line-through decoration-gray-300'
                  : 'text-foreground group-hover:text-blue-600 transition-colors'
              }`}
              style={{ fontWeight: 600 }}
            >
              <span className="text-slate-400">PO#</span> {highlightText(group.title, poSearch)}
            </span>
            <span
              className={`${STATUS_PILL} ${
                PO_STATUS_COLORS[poState.displayStatus] || 'bg-slate-50 text-slate-600 border-slate-200'
              }`}
              style={{ fontWeight: 600 }}
            >
              {poState.displayStatus}
            </span>
            {poState.isInvoiced && !poState.isFullyInvoiced && (
              <span
                className={`${STATUS_PILL} bg-purple-50 text-purple-700 border-purple-100`}
                style={{ fontWeight: 600 }}
              >
                Partially Invoiced
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500" style={{ fontWeight: 400 }}>
            {/* An order belongs to a vendor, and a vendor search has to land
                somewhere in every lens or the result looks unrelated to what
                was typed. */}
            <span className="flex items-center gap-1 text-gray-600 max-w-[220px] min-w-0" style={{ fontWeight: 600 }}>
              <Building2 className="w-2.5 h-2.5 shrink-0 text-gray-400" />
              <span className="truncate">{highlightText(poLead.vendor.vendorName, vendorSearch)}</span>
            </span>
            <span className="text-gray-300 font-normal">•</span>
            <span className="text-gray-400">
              {group.sources.length} {group.sources.length === 1 ? 'item' : 'items'}
            </span>
            {/* Suppressed for a single-site vendor, where the origin adds
                nothing the vendor name has not already said. */}
            {/* The site, only when it is not simply the vendor again. A
                headquarters carries the vendor's own name, so with the vendor
                now stated beside it the origin chip printed it twice. */}
            {poLead.vendor.locations.length > 1 && poOrigin !== poLead.vendor.vendorName && (
              <>
                <span className="text-gray-300 font-normal">•</span>
                <span className="flex items-center gap-1 text-gray-500 max-w-[170px] min-w-0">
                  <MapPin className="w-2.5 h-2.5 shrink-0 text-gray-400" />
                  <span className="truncate">{poOrigin}</span>
                </span>
              </>
            )}
            {poReceipts.length > 0 && (
              <>
                <span className="text-gray-300 font-normal">•</span>
                <span className="text-gray-400">
                  {poReceipts.length} {poReceipts.length === 1 ? 'receiving' : 'receivings'}
                </span>
              </>
            )}
            {hasSelection && (
              <>
                <span className="text-gray-300 font-normal">•</span>
                <span
                  className={`${SELECTED_PILL}`}
                  style={{ fontWeight: 600 }}
                >
                  <CheckCircle2 className="w-2.5 h-2.5" />
                  {selectedCount} selected
                </span>
              </>
            )}
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-2">
          {poState.isInvoiced && (
              <span
                className={`${STATUS_PILL} ${
                  poState.isPreInvoiceEligible
                    ? 'bg-amber-50 text-amber-700 border-amber-100'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                }`}
                style={{ fontWeight: 600 }}
              >
                {poState.isPreInvoiceEligible ? (
                  <Tag className="w-2.5 h-2.5" />
                ) : (
                  <CheckCircle2 className="w-2.5 h-2.5" />
                )}
                {poState.isPreInvoiceEligible ? 'Pre-Invoiced' : 'Invoiced'}: $
                {poLead.po.invoicedAmount?.toLocaleString()}
              </span>
            )}
          <HeaderStat
            Icon={ShoppingCart}
            value={`$${poLead.po.poAmount.toLocaleString()}`}
            label="PO Value"
            muted={poClosed}
          />
        </div>
      </div>
    </div>
  );

  // The Receiving lens gets the same card the vendor lens shows under its
  // Receivers tab, so a receipt reads identically either way in.
  const grnHeader = grnLead && grnStatus && (
    <div
      className="flex items-center gap-3 px-5 py-2.5 cursor-pointer group select-none"
      onClick={onToggle}
    >
      <Checkbox
        checked={groupCheckboxState}
        disabled={docBlockedByVendorLock}
        onCheckedChange={toggleGroupSelection}
        onClick={(e) => e.stopPropagation()}
        aria-label={`Select receiving ${group.title}`}
        title={lockTitle}
        className="shrink-0 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
      />

      <div
        className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-md transition-colors"
        style={{
          backgroundColor: isExpanded ? '#D6E8FF' : 'hsl(var(--muted))',
          color: isExpanded ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
        }}
      >
        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </div>

      <div
        className="flex-shrink-0 w-10 h-10 rounded-md overflow-hidden flex items-center justify-center bg-white transition-all"
        style={{
          border: isExpanded ? '1px solid rgba(10,119,255,0.25)' : '1px solid hsl(var(--border))',
          boxShadow: isExpanded ? '0 0 0 1px rgba(10,119,255,0.10)' : '0 1px 2px rgba(0,0,0,0.03)',
        }}
      >
        <Package className={`w-5 h-5 ${isExpanded ? 'text-primary' : 'text-slate-400'}`} />
      </div>

      <div className="flex-1 min-w-0 flex items-center justify-between">
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="text-[14px] text-foreground tracking-tight group-hover:text-blue-600 transition-colors"
              style={{ fontWeight: 600 }}
            >
              {highlightText(group.title, grnSearch)}
            </span>
            <span className={`${STATUS_PILL} ${grnStatus.styles}`} style={{ fontWeight: 600 }}>
              {grnStatus.label}
            </span>
          </div>

          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500" style={{ fontWeight: 400 }}>
            {/* Static here, unlike the vendor lens where the same line jumps
                to the PO tab — this lens has no sibling tab to land on. */}
            <span className="flex items-center gap-1 text-gray-600 max-w-[220px] min-w-0" style={{ fontWeight: 600 }}>
              <Building2 className="w-2.5 h-2.5 shrink-0 text-gray-400" />
              <span className="truncate">
                {highlightText(group.sources[0]?.vendor.vendorName ?? '', vendorSearch)}
              </span>
            </span>
            <span className="text-gray-300 font-normal">•</span>
            <span className="flex items-center gap-1 font-bold text-gray-500">
              <ShoppingCart className="w-3 h-3" />
              <span className="text-gray-400">PO#</span> {highlightText(grnLead.poNumber, poSearch)}
            </span>
            <span className="text-gray-300 font-normal">•</span>
            <span>
              {group.sources.length} {group.sources.length === 1 ? 'item' : 'items'}
            </span>
            <span className="text-gray-300 font-normal">•</span>
            <span>{formatDate(grnLead.grnDate)}</span>
            {hasSelection && (
              <>
                <span className="text-gray-300 font-normal">•</span>
                <span
                  className={`${SELECTED_PILL}`}
                  style={{ fontWeight: 600 }}
                >
                  <CheckCircle2 className="w-2.5 h-2.5" />
                  {selectedCount} selected
                </span>
              </>
            )}
          </div>
        </div>

        <HeaderStat
          Icon={Package}
          value={`$${grnTotalAmt.toLocaleString()}`}
          label="Receiving value"
        />
      </div>
    </div>
  );

  const header = (
    <div
      className="flex items-center gap-3 px-5 py-2.5 select-none transition-all cursor-pointer"
      onClick={onToggle}
    >
      <Checkbox
        checked={groupCheckboxState}
        disabled={blockedByVendorLock}
        onCheckedChange={toggleGroupSelection}
        onClick={(e) => e.stopPropagation()}
        aria-label={`Select ${group.title}`}
        title={lockTitle}
        className="shrink-0 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
      />

      <div
        className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-md transition-colors"
        style={{
          backgroundColor: isExpanded ? '#D6E8FF' : 'hsl(var(--muted))',
          color: isExpanded ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
        }}
      >
        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </div>

      <div
        className="flex-shrink-0 w-10 h-10 rounded-md overflow-hidden flex items-center justify-center bg-white transition-all"
        style={{
          border: isExpanded ? '1px solid rgba(10,119,255,0.25)' : '1px solid hsl(var(--border))',
          boxShadow: isExpanded ? '0 0 0 1px rgba(10,119,255,0.10)' : '0 1px 2px rgba(0,0,0,0.03)',
        }}
      >
        {group.image ? (
          <ImageWithFallback src={group.image} alt={group.title} className="w-full h-full object-cover" />
        ) : (
          <LeadIcon className={`w-5 h-5 ${isExpanded ? 'text-primary' : 'text-slate-400'}`} />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <h3 className="text-[14px] text-foreground tracking-tight truncate" style={{ fontWeight: 600 }}>
            {byVendor ? highlightText(group.title, itemSearch) : group.title}
          </h3>
          {/* Whether the item is tracked by named unit decides what the user
              has to do once they get to step 1 -- a serialized line starts
              with nothing picked and needs its units chosen one by one -- so
              it is worth knowing before the item is taken, not after.
              `trackingModeFor` is the same source step 1 reads, so the chip
              cannot say one thing here and another there. */}
          {byVendor && (
            <span
              className={`${STATUS_PILL} shrink-0 bg-slate-50 text-slate-600 border-slate-200`}
              style={{ fontWeight: 600 }}
            >
              {trackingModeFor(group.title) === 'serialized' ? 'Serialized' : 'Non-Serialized'}
            </span>
          )}
          {hasSelection && (
            <span
              className={`${SELECTED_PILL}`}
              style={{ fontWeight: 600 }}
            >
              <CheckCircle2 className="w-2.5 h-2.5" />
              {selectedCount} selected
            </span>
          )}
        </div>
        <p className="text-[11px] text-slate-500 truncate mt-0.5" style={{ fontWeight: 400 }}>
          {byVendor ? highlightText(group.subtitle, itemSearch) : group.subtitle}
        </p>
      </div>

      <HeaderStat
        Icon={Tag}
        value={`${formatQty(group.totalAvailable)} ${group.uom}`}
        label={availableLabel}
      />
    </div>
  );

  // Every lens shares one outer shell -- the divided row the item and
  // vendor lenses have always used. The document lenses briefly drew their
  // own bordered cards, which made the same list look like two different
  // components depending on how the user got there.
  // The group's lines gathered per item, which is what every lens except the
  // item lens still has to break down.
  const itemsInGroup = React.useMemo(() => {
    const bySku = new Map<string, ItemSource[]>();
    group.sources.forEach((src) => {
      const list = bySku.get(src.poItem.sku) ?? [];
      list.push(src);
      bySku.set(src.poItem.sku, list);
    });
    return [...bySku.entries()];
  }, [group.sources]);

  const documentHeader = poHeader || grnHeader;

  return (
    <div
      className={`transition-all duration-150 border-b border-[#EEF2F6] last:border-0 ${
        poClosed ? 'opacity-70 grayscale-[0.4]' : ''
      }`}
      // Resting rows carry a faint neutral fill so the list reads as bands
      // rather than text floating on white. Expanded / selected keeps the
      // blue tint, which stays legible against it because the two differ in
      // hue rather than only in lightness.
      style={{ backgroundColor: isExpanded || hasSelection ? '#F8FAFF' : '#FAFBFC' }}
    >
      {documentHeader ?? header}

      {isExpanded && (
        <div className="px-5 pb-3">
          <div className="rounded-lg border border-border bg-white overflow-hidden">
            {documentHeader ? (
              <>
                {/* Lead with the document, then the items on it. A PO already
                    names its vendor and a receipt names both, so neither is
                    repeated below -- what is left to open is only what the
                    document has not already fixed. */}
                <div className="flex items-center gap-1.5 px-4 py-2.5 text-[12px] text-slate-600 border-b border-[#EEF2F6] bg-[#FAFBFC]">
                  <Package className="w-3.5 h-3.5 text-slate-400" />
                  {itemsInGroup.length} item{itemsInGroup.length !== 1 ? 's' : ''}
                </div>
                {itemsInGroup.map(([sku, itemSources]) => (
                  <GroupItemRow
                    key={sku}
                    sku={sku}
                    sources={itemSources}
                    depth={grnHeader ? 'none' : 'receipt'}
                    selectedItemIds={selectedItemIds}
                    receiptByItem={receiptByItem}
                    onSelectSources={onSelectSources}
                    blocked={docBlockedByVendorLock}
                    blockedTitle={lockTitle}
                    autoOpen={poSearch.trim().length > 1 || grnSearch.trim().length > 1}
                    highlightText={highlightText}
                    itemSearch={itemSearch}
                    poSearch={poSearch}
                    grnSearch={grnSearch}
                  />
                ))}
              </>
            ) : (
              <>
                {/* One row per vendor now, with that vendor's receipts
                    combined into it, so the row count is the vendor count. */}
                {/* The count, nothing else. "can take this back" restated the
                    lens, and the line total repeated what the rows below it
                    already add up to. */}
                <div className="flex items-center gap-1.5 px-4 py-2.5 text-[12px] text-slate-600">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  {group.vendorCount} vendor{group.vendorCount !== 1 ? 's' : ''}
                </div>
                {group.offers.map((offer) => (
                  <VendorOfferRow
                    key={offer.vendorCode}
                    autoOpen={poSearch.trim().length > 1 || grnSearch.trim().length > 1}
                    autoOpenReceipts={poSearch.trim().length > 1 || grnSearch.trim().length > 1}
                    highlightText={highlightText}
                    vendorSearch={vendorSearch}
                    poSearch={poSearch}
                    grnSearch={grnSearch}
                    offer={offer}
                    selectedItemIds={selectedItemIds}
                    onSelectSources={onSelectSources}
                    blocked={!!lockedVendorCode && offer.vendorCode !== lockedVendorCode}
                    blockedTitle={lockTitle}
                    receiptByItem={receiptByItem}
                  />
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
