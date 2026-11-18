/**
 * The first step: find what is coming back, say how much, and read up on it
 * without leaving.
 *
 * Ported from the cycle count planner's Select Items step. Its shape, in its
 * order: a basis strip across the top, a toolbar with the search on the left
 * and the selection count on the right, a row of filter pills with the
 * card/list toggle at its end, then the catalogue itself as either a card grid
 * or a list. An eye on every card and row opens the item without disturbing
 * the selection.
 *
 * The structural borrowing is not the grid, it is that the catalogue is always
 * what is on screen. What the step showed before flipped between two lists --
 * results while something was typed, the return once the field was cleared --
 * so the return and the catalogue were never visible at the same time and
 * neither was ever the whole picture. The planner never flips: one list, and
 * being selected is a state a row is in. That is what lets the step be one
 * step.
 *
 * Two of the planner's slots hold something else here, because a count and a
 * return do not ask the same thing.
 *
 * Its basis strip picks what a count is scoped by -- items, locations,
 * categories. A return has its own three ways in: the part, the vendor it came
 * from, or the document it arrived on. The last two scope the catalogue rather
 * than replacing it, since what goes on a return is always a part in the end.
 *
 * And its cards carry what is on hand, which for a count is the whole answer.
 * Here that slot is the quantity going back: the figure a row rests on until
 * it is selected, and the field once it is.
 */

import { TrackingTag } from '@/app/components/rma/TrackingTag';
import { useMemo, useState } from 'react';
import {
  Eye,
  FileText,
  LayoutGrid,
  LayoutList,
  Package,
  PackageSearch,
  ScanLine,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { Input } from '@/app/components/ui/input';
import { Checkbox } from '@/app/components/ui/checkbox';
import { ItemQuickViewModal, ItemImageWithPreview } from '@/app/components/invoice-details/ItemQuickView';
import {
  ITEMS_MODULE_URL,
  ItemDescriptionWithToggle,
  longDescriptionFor,
} from '@/app/components/VendorSelectionItemCell';
import { ReturnQtyField } from '@/app/components/rma/ReturnQtyField';
import { highlight } from '@/app/components/rma/ItemResultRow';
import { formatDate, formatQty } from '@/app/components/vendorSelectionModel';
import { mockVendors } from '@/app/data/mockVendors';
import {
  TRACKING_CHIP,
  TRACKING_LABELS,
  returnableItems,
  searchReturnableItems,
  type ReturnableItem,
  type TrackingMode,
} from '@/app/data/itemProvenance';

/** What the return is being built from. The planner's `countBasis`. */
export type ReturnBasis = 'item' | 'vendor' | 'document';

/** The vendor or document the catalogue is narrowed to, if any. */
export interface ReturnScope {
  kind: 'vendor' | 'document';
  id: string;
  name: string;
}

const BASES: { key: ReturnBasis; label: string }[] = [
  { key: 'item', label: 'Item' },
  { key: 'vendor', label: 'Vendor' },
  { key: 'document', label: 'Receiving document' },
];

/** The pills, in the order the planner orders its control types: the plain
 *  case first, then the tracked ones. */
const TRACKING_ORDER: ('none' | 'serialized' | 'lot')[] = ['none', 'serialized', 'lot'];

export function ReturnSelectItemsStep({
  query,
  onQuery,
  lines,
  onQty,
  onDrop,
  onOpenLine,
  onPickSerials,
}: {
  query: string;
  onQuery: (next: string) => void;
  /** What is on the return, and how much of each. */
  lines: { sku: string; qty: number; uom: string }[];
  onQty: (sku: string, qty: number) => void;
  onDrop: (sku: string) => void;
  /** The rest of the line: reason, remedy, notes, files. */
  onOpenLine: (sku: string) => void;
  onPickSerials: (sku: string) => void;
}) {
  const [basis, setBasis] = useState<ReturnBasis>('item');
  const [view, setView] = useState<'card' | 'list'>('card');
  const [tracking, setTracking] = useState<TrackingMode | null>(null);
  const [scope, setScope] = useState<ReturnScope | null>(null);
  const [previewSku, setPreviewSku] = useState<string | null>(null);

  const picked = useMemo(() => new Map(lines.map((l) => [l.sku, l.qty])), [lines]);
  const catalogue = useMemo(() => returnableItems(), []);

  /** The parts a vendor has delivered, or a document carried. Read off the
   *  paperwork rather than the catalogue, because that is where the answer
   *  actually is. */
  const inScope = useMemo(() => {
    if (!scope) return null;
    const skus = new Set<string>();
    mockVendors.forEach((v) => {
      if (scope.kind === 'vendor' && v.vendorCode !== scope.id) return;
      v.receivingDocuments.forEach((grn) => {
        if (scope.kind === 'document' && grn.grnNumber !== scope.id) return;
        grn.items.forEach((li) => skus.add(li.sku));
      });
    });
    return skus;
  }, [scope]);

  const trackingCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    catalogue.forEach((i) => {
      counts[i.trackingMode] = (counts[i.trackingMode] ?? 0) + 1;
    });
    return counts;
  }, [catalogue]);

  const shown = useMemo(() => {
    let items = query.trim() ? searchReturnableItems(query) : catalogue;
    if (tracking) items = items.filter((i) => i.trackingMode === tracking);
    if (inScope) items = items.filter((i) => inScope.has(i.sku));
    return items;
  }, [query, catalogue, tracking, inScope]);

  const vendors = useMemo(
    () =>
      mockVendors
        .map((v) => ({
          id: v.vendorCode,
          name: v.vendorName,
          items: new Set(v.receivingDocuments.flatMap((g) => g.items.map((i) => i.sku))).size,
          docs: v.receivingDocuments.length,
        }))
        .filter((v) => v.items > 0)
        .sort((a, b) => b.items - a.items),
    [],
  );

  const documents = useMemo(
    () =>
      mockVendors
        .flatMap((v) =>
          v.receivingDocuments.map((g) => ({
            id: g.grnNumber,
            name: g.grnNumber,
            vendorName: v.vendorName,
            date: g.grnDate,
            poNumber: g.poNumber,
            items: new Set(g.items.map((i) => i.sku)).size,
          })),
        )
        .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')),
    [],
  );

  const selectedCount = lines.filter((l) => l.qty > 0).length;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* Which way in. */}
      <div className="shrink-0 px-4 sm:px-5 pt-3">
        <div className="inline-flex items-center gap-0.5 rounded-lg border border-[#E8ECF1] bg-[#F7F9FC] p-0.5">
          {BASES.map((b) => (
            <button
              key={b.key}
              type="button"
              onClick={() => setBasis(b.key)}
              aria-pressed={basis === b.key}
              className={`h-7 rounded-md px-3 text-[12px] transition-colors ${
                basis === b.key
                  ? 'bg-white text-primary shadow-[0_1px_2px_rgba(15,23,42,0.06)]'
                  : 'text-slate-500 hover:text-foreground'
              }`}
              style={{ fontWeight: 600 }}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>

      {/* Search on the left, what is selected on the right. */}
      <div className="flex shrink-0 flex-col gap-3 px-4 sm:px-5 pt-4 pb-3">
        <div className="flex items-center gap-3">
          <div className="relative w-full max-w-[250px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <Input
              type="text"
              placeholder={
                basis === 'vendor'
                  ? 'Search vendors'
                  : basis === 'document'
                    ? 'Search receiving documents'
                    : 'Search items'
              }
              value={query}
              onChange={(e) => onQuery(e.target.value)}
              aria-label="Search parts to return"
              className="pl-9 pr-8 h-9 text-[13px] bg-white border-border rounded-lg shadow-sm transition-all focus-visible:ring-2 focus-visible:ring-primary/15 focus-visible:border-primary"
            />
            {query && (
              <button
                type="button"
                onClick={() => onQuery('')}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded inline-flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* What the catalogue has been narrowed to, and the way out of it. */}
          {scope && (
            <span
              className="inline-flex h-7 shrink-0 items-center gap-1 rounded-full border border-primary/30 bg-blue-50 pl-2.5 pr-1 text-[12px] text-primary"
              style={{ fontWeight: 600 }}
            >
              {scope.kind === 'vendor' ? (
                <Package className="w-3 h-3" />
              ) : (
                <FileText className="w-3 h-3" />
              )}
              {scope.name}
              <button
                type="button"
                onClick={() => setScope(null)}
                aria-label="Clear the scope"
                className="flex w-5 h-5 items-center justify-center rounded-full transition-colors hover:bg-primary/10"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          <div className="ml-auto shrink-0">
            {selectedCount > 0 ? (
              <span
                className="inline-flex h-7 items-center gap-1 rounded-full border border-primary bg-blue-50 pl-3 pr-1 text-[12px] text-primary tabular-nums"
                style={{ fontWeight: 600 }}
              >
                {selectedCount} {selectedCount === 1 ? 'item' : 'items'} on this return
                <button
                  type="button"
                  onClick={() => lines.forEach((l) => onDrop(l.sku))}
                  aria-label="Clear selection"
                  className="flex w-5 h-5 items-center justify-center rounded-full transition-colors hover:bg-primary/10"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ) : (
              <span
                className="inline-flex h-7 items-center rounded-full border border-[#E8ECF1] bg-white px-3 text-[12px] text-slate-500 tabular-nums"
                style={{ fontWeight: 600 }}
              >
                {basis === 'vendor'
                  ? `${vendors.length} vendors`
                  : basis === 'document'
                    ? `${documents.length} documents`
                    : `${shown.length} items`}
              </span>
            )}
          </div>
        </div>

        {/* How it is tracked, and how it is laid out. */}
        {basis === 'item' && (
          <div className="flex items-center gap-2">
            <FilterPill
              label="Show All"
              count={catalogue.length}
              active={tracking === null}
              onClick={() => setTracking(null)}
            />
            {TRACKING_ORDER.filter((m) => trackingCounts[m]).map((mode) => (
              <FilterPill
                key={mode}
                label={TRACKING_LABELS[mode]}
                count={trackingCounts[mode] ?? 0}
                active={tracking === mode}
                onClick={() => setTracking(tracking === mode ? null : mode)}
              />
            ))}
            <div className="ml-auto flex items-center gap-1">
              <ViewButton
                active={view === 'card'}
                label="Card view"
                onClick={() => setView('card')}
                icon={<LayoutGrid className="w-4 h-4" />}
              />
              <ViewButton
                active={view === 'list'}
                label="List view"
                onClick={() => setView('list')}
                icon={<LayoutList className="w-4 h-4" />}
              />
            </div>
          </div>
        )}
      </div>

      {/* The catalogue. */}
      <div className="min-h-0 flex-1 overflow-y-auto items-scroll border-t border-[#EEF2F6] bg-white">
        {basis === 'vendor' ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3 p-4">
            {vendors
              .filter((v) => !query.trim() || v.name.toLowerCase().includes(query.trim().toLowerCase()))
              .map((v) => (
                <GroupCard
                  key={v.id}
                  icon={<Package className="w-5 h-5 text-slate-500" />}
                  title={v.name}
                  subtitle={`${v.docs} ${v.docs === 1 ? 'delivery' : 'deliveries'} on file`}
                  meta={`${v.items} ${v.items === 1 ? 'item' : 'items'}`}
                  query={query}
                  selected={scope?.kind === 'vendor' && scope.id === v.id}
                  onClick={() => {
                    setScope({ kind: 'vendor', id: v.id, name: v.name });
                    setBasis('item');
                    onQuery('');
                  }}
                />
              ))}
          </div>
        ) : basis === 'document' ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3 p-4">
            {documents
              .filter(
                (d) =>
                  !query.trim() ||
                  d.name.toLowerCase().includes(query.trim().toLowerCase()) ||
                  d.poNumber.toLowerCase().includes(query.trim().toLowerCase()),
              )
              .slice(0, 120)
              .map((d) => (
                <GroupCard
                  key={d.id}
                  icon={<FileText className="w-5 h-5 text-slate-500" />}
                  title={d.name}
                  subtitle={`${d.date} · PO ${d.poNumber} · ${d.vendorName}`}
                  meta={`${d.items} ${d.items === 1 ? 'item' : 'items'}`}
                  query={query}
                  selected={scope?.kind === 'document' && scope.id === d.id}
                  onClick={() => {
                    setScope({ kind: 'document', id: d.id, name: d.name });
                    setBasis('item');
                    onQuery('');
                  }}
                />
              ))}
          </div>
        ) : shown.length === 0 ? (
          <div className="flex min-h-[300px] flex-col items-center justify-center px-6 text-center">
            <div className="mb-3 flex w-12 h-12 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-300">
              <PackageSearch className="w-5 h-5" />
            </div>
            <p className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>
              {query.trim() ? `Nothing matches “${query.trim()}”` : 'Nothing to return here'}
            </p>
            <p className="mt-1 max-w-sm text-[12px] text-slate-500">
              Try the part number, or a word from the description. Stock created in
              inventory, with no receipt behind it, can be returned too.
            </p>
          </div>
        ) : view === 'card' ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3 p-4">
            {shown.map((item) => (
              <ItemCard
                key={item.sku}
                item={item}
                qty={picked.get(item.sku) ?? 0}
                query={query.trim()}
                onQty={onQty}
                onDrop={onDrop}
                onOpenLine={onOpenLine}
                onPickSerials={onPickSerials}
                onPreview={setPreviewSku}
                previewOpen={previewSku !== null}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col">
            {shown.map((item) => (
              <ItemListRow
                key={item.sku}
                item={item}
                qty={picked.get(item.sku) ?? 0}
                query={query.trim()}
                onQty={onQty}
                onDrop={onDrop}
                onOpenLine={onOpenLine}
                onPickSerials={onPickSerials}
                onPreview={setPreviewSku}
                previewOpen={previewSku !== null}
              />
            ))}
          </div>
        )}
      </div>

      {previewSku && (() => {
        const item = catalogue.find((i) => i.sku === previewSku);
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

/** The planner's pill: a label and its count, the count in its own bubble. */
function FilterPill({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-[12px] transition-colors ${
        active
          ? 'border-primary bg-blue-50 text-primary'
          : 'border-[#E8ECF1] bg-white text-slate-500 hover:bg-slate-50'
      }`}
      style={{ fontWeight: 600 }}
    >
      {label}
      <span
        className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] tabular-nums ${
          active ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-500'
        }`}
        style={{ fontWeight: 600 }}
      >
        {count}
      </span>
    </button>
  );
}

function ViewButton({
  active,
  label,
  onClick,
  icon,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={`flex w-8 h-8 items-center justify-center rounded-md border transition-colors ${
        active
          ? 'border-primary/30 bg-blue-50 text-primary'
          : 'border-transparent text-slate-400 hover:bg-slate-100 hover:text-slate-600'
      }`}
    >
      {icon}
    </button>
  );
}

/** A vendor or a document, in the shape the planner gives a category. Clicking
 *  it narrows the catalogue rather than putting anything on the return: what
 *  goes on a return is a part, whichever way you came in. */
function GroupCard({
  icon,
  title,
  subtitle,
  meta,
  query,
  selected,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  meta: string;
  query: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col gap-2 rounded-lg border px-3.5 pt-4 pb-3 text-left transition-all ${
        selected
          ? 'border-primary bg-blue-50/60'
          : 'border-[#E8ECF1] bg-white hover:border-primary/40 hover:shadow-[0_2px_8px_rgba(15,23,42,0.06)]'
      }`}
    >
      <span className="flex w-9 h-9 items-center justify-center rounded-md border border-[#EEF2F6] bg-slate-50">
        {icon}
      </span>
      <span className="truncate text-[13px] text-foreground" style={{ fontWeight: 700 }}>
        {highlight(title, query)}
      </span>
      <span className="line-clamp-2 text-[11px] text-slate-500">{subtitle}</span>
      <span className="mt-auto text-[11px] text-slate-500" style={{ fontWeight: 600 }}>
        {meta}
      </span>
    </button>
  );
}

/** The quantity, wherever it sits. The planner's card and row both end in
 *  what is on hand; a return ends in how much of it is going back, so this is
 *  the one control and it is in that place. */
function QtySlot({
  item,
  qty,
  onQty,
  onPickSerials,
}: {
  item: ReturnableItem;
  qty: number;
  onQty: (sku: string, qty: number) => void;
  onPickSerials: (sku: string) => void;
}) {
  if (item.trackingMode === 'serialized') {
    return (
      <span className="inline-flex items-center gap-2">
        {/* The ceiling, said the way the counted field says it: what is left
            of the receipt once what is named is taken off. */}
        <span className="text-[12px] text-foreground tabular-nums whitespace-nowrap" style={{ fontWeight: 600 }}>
          {formatQty(Math.max(0, item.returnableQty - qty))}{' '}
          <span className="text-[10px] text-slate-500" style={{ fontWeight: 500 }}>{item.uom}</span>
        </span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onPickSerials(item.sku);
        }}
        className={`inline-flex items-center justify-center gap-1.5 h-8 rounded-lg px-3 text-[12px] whitespace-nowrap transition-colors ${
          qty > 0
            ? 'border border-slate-200 bg-white text-foreground hover:bg-slate-50'
            : 'bg-primary text-white shadow-sm hover:bg-blue-700'
        }`}
        style={{ fontWeight: qty > 0 ? 500 : 600 }}
      >
        <ScanLine className="w-3.5 h-3.5" />
        {qty > 0 ? `${formatQty(qty)} ${item.uom} named` : 'Add units'}
      </button>
      </span>
    );
  }
  return (
    <div onClick={(e) => e.stopPropagation()}>
      <ReturnQtyField
        sku={item.sku}
        qty={qty}
        cap={item.returnableQty}
        uom={item.uom}
        trackingMode={item.trackingMode}
        onQty={(n) => onQty(item.sku, n)}
      />
    </div>
  );
}

/** What a part was last seen doing, in the slot the planner keeps for when it
 *  was last counted. */
function LastReceivedPill({ date }: { date: string }) {
  if (!date) return null;
  return (
    <span
      className="inline-flex h-5 shrink-0 items-center rounded-full border border-[#EEF2F6] bg-slate-50 px-1.5 text-[10px] text-slate-500 whitespace-nowrap"
      style={{ fontWeight: 600 }}
    >
      In {formatDate(date)}
    </span>
  );
}

function ItemCard({
  item,
  qty,
  query,
  onQty,
  onDrop,
  onOpenLine,
  onPickSerials,
  onPreview,
  previewOpen,
}: {
  item: ReturnableItem;
  qty: number;
  query: string;
  onQty: (sku: string, qty: number) => void;
  onDrop: (sku: string) => void;
  onOpenLine: (sku: string) => void;
  onPickSerials: (sku: string) => void;
  onPreview: (sku: string) => void;
  previewOpen: boolean;
}) {
  const on = qty > 0;
  return (
    <div
      className={`group relative flex flex-col overflow-hidden rounded-lg border transition-all ${
        on
          ? 'border-primary bg-blue-50/40'
          : 'border-[#E8ECF1] bg-white hover:shadow-[0_2px_8px_rgba(15,23,42,0.06)]'
      }`}
    >
      <div className="relative flex h-[120px] w-full items-center justify-center overflow-hidden border-b border-[#EEF2F6] bg-[#F7F9FC]">
        <div onClick={(e) => e.stopPropagation()}>
          <ItemImageWithPreview
            sku={item.sku}
            alt={item.sku}
            onPreview={() => onPreview(item.sku)}
            disabled={previewOpen}
            size={48}
            unitPrice={item.unitPrice}
            uom={item.uom}
            serialized={item.trackingMode === 'serialized'}
            trackingLabel={TRACKING_LABELS[item.trackingMode]}
            contentZ="z-[260]"
          />
        </div>
        <span className="absolute top-2 left-2"><TrackingTag mode={item.trackingMode} size="md" /></span>
        <span
          className={`absolute top-2 right-2 flex items-center gap-1 transition-opacity ${
            on ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onPreview(item.sku);
            }}
            aria-label={`Preview ${item.sku}`}
            className="flex w-6 h-6 items-center justify-center rounded-full border border-[#E8ECF1] bg-white text-slate-500 shadow-sm transition-colors hover:text-primary"
          >
            <Eye className="w-3 h-3" />
          </button>
          {on && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDrop(item.sku);
              }}
              aria-label={`Take ${item.sku} off this return`}
              className="flex w-6 h-6 items-center justify-center rounded-full border border-[#E8ECF1] bg-white text-slate-400 shadow-sm transition-colors hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-1.5 px-3.5 pt-3 pb-3.5">
        <div className="flex items-center gap-1.5">
          <a
            href={ITEMS_MODULE_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="truncate text-[13px] text-foreground transition-colors hover:text-primary hover:underline decoration-primary/60 underline-offset-2"
            style={{ fontWeight: 700 }}
          >
            {highlight(item.sku, query)}
          </a>
        </div>
        <button
          type="button"
          onClick={() => onOpenLine(item.sku)}
          className="line-clamp-2 text-left text-[12px] text-slate-500 transition-colors hover:text-foreground"
        >
          {highlight(item.description, query)}
        </button>
        <div className="mt-1 flex items-center gap-1.5">
          <LastReceivedPill date={item.lastReceivedDate} />
        </div>
        {/* The planner's card ends in what is on hand. Here it ends in how
            much is going back, and the field states the ceiling itself, so
            there is nothing to repeat above it. */}
        <div className="mt-2 flex items-center justify-end">
          <QtySlot item={item} qty={qty} onQty={onQty} onPickSerials={onPickSerials} />
        </div>
      </div>
    </div>
  );
}

function ItemListRow({
  item,
  qty,
  query,
  onQty,
  onDrop,
  onOpenLine,
  onPickSerials,
  onPreview,
  previewOpen,
}: {
  item: ReturnableItem;
  qty: number;
  query: string;
  onQty: (sku: string, qty: number) => void;
  onDrop: (sku: string) => void;
  onOpenLine: (sku: string) => void;
  onPickSerials: (sku: string) => void;
  onPreview: (sku: string) => void;
  previewOpen: boolean;
}) {
  const on = qty > 0;
  return (
    <div
      className={`group flex items-center gap-3 border-b border-[#EEF2F6] px-4 sm:px-5 py-2.5 transition-colors ${
        on ? 'bg-blue-50/40' : 'hover:bg-[#FAFBFC]'
      }`}
    >
      <Checkbox
        checked={on}
        onCheckedChange={(next) => {
          if (next === true) onQty(item.sku, item.trackingMode === 'serialized' ? 0 : 1);
          else onDrop(item.sku);
        }}
        aria-label={`Put ${item.sku} on this return`}
      />
      <button
        type="button"
        onClick={() => onPreview(item.sku)}
        aria-label={`Preview ${item.sku}`}
        className="flex w-6 h-6 shrink-0 items-center justify-center rounded-md text-primary opacity-0 transition-opacity hover:bg-primary/5 group-hover:opacity-100"
      >
        <Eye className="w-3.5 h-3.5" />
      </button>
      <div onClick={(e) => e.stopPropagation()} className="shrink-0">
        <ItemImageWithPreview
          sku={item.sku}
          alt={item.sku}
          onPreview={() => onPreview(item.sku)}
          disabled={previewOpen}
          size={40}
          unitPrice={item.unitPrice}
          uom={item.uom}
          serialized={item.trackingMode === 'serialized'}
          trackingLabel={TRACKING_LABELS[item.trackingMode]}
          contentZ="z-[260]"
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <a
            href={ITEMS_MODULE_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="truncate text-[14px] text-foreground transition-colors hover:text-primary hover:underline decoration-primary/60 underline-offset-2"
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
      <div className="flex shrink-0 items-center gap-2">
        <LastReceivedPill date={item.lastReceivedDate} />
        <QtySlot item={item} qty={qty} onQty={onQty} onPickSerials={onPickSerials} />
        {on && (
          <button
            type="button"
            onClick={() => onDrop(item.sku)}
            aria-label={`Take ${item.sku} off this return`}
            className="flex w-7 h-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
