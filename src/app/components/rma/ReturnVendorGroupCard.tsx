/**
 * One vendor's return, with its parts inside.
 *
 * The mirror of `ReturnItemCard`. Coming in by item, the part is the group and
 * the vendors are its rows; coming in by vendor it is the other way round, so
 * each route ends in the shape it came in through and neither has to be read
 * against the other.
 *
 * Same card either way -- it is the purchase-order cart's, which groups by
 * vendor to begin with: the 12px shell, the header rule that exists only while
 * the card is open, the count in its own slot, the body inset a unit tighter
 * than the header, and each part a bordered row with a tinted action bar
 * carrying its stepper.
 */

import { TrackingTag } from '@/app/components/rma/TrackingTag';
import { ArrowRight, Building2, ChevronDown, ChevronUp, Lock, Package, Pencil, Plus, ScanLine, Trash2 } from 'lucide-react';
import { ImageWithFallback } from '@/app/components/figma/ImageWithFallback';
import { imageForSku } from '@/app/components/VendorSelectionItemCell';
import { formatQty } from '@/app/components/vendorSelectionModel';
import { Popover, PopoverContent, PopoverTrigger } from '@/app/components/ui/popover';
import { QtyStepper } from '@/app/components/rma/QtyStepper';
import { TRACKING_CHIP, TRACKING_LABELS,
  type TrackingMode,
} from '@/app/data/itemProvenance';

const money = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** One part going back to this vendor. */
/** A vendor this item's excess could go to instead. */
export interface MoveTarget {
  code: string;
  name: string;
  cap: number;
}

export interface PartRow {
  key: string;
  sku: string;
  description: string;
  uom: string;
  qty: number;
  cap: number;
  locked: boolean;
  trackingMode: TrackingMode;
  unitPrice: number;
  /** Other vendors who shipped this item, for when this one is asked for more
   *  than it ever sold. */
  moveTargets: MoveTarget[];
}

export function ReturnVendorGroupCard({
  vendorName,
  rows,
  value,
  collapsed,
  onToggleCollapse,
  onQty,
  onPickSerials,
  onMoveBalance,
  onEditRow,
  onAddItems,
}: {
  vendorName: string;
  rows: PartRow[];
  value: number;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onQty: (rowKey: string, qty: number) => void;
  /** Name the units going back to this vendor for one item. */
  onPickSerials: (sku: string) => void;
  /** Move one item's excess off this vendor and onto another. */
  onMoveBalance: (sku: string, toVendorCode: string) => void;
  onEditRow: (sku: string) => void;
  /** Open this vendor's catalogue, the same modal the first step opens. */
  onAddItems: () => void;
}) {
  const units = rows.reduce((n, r) => n + r.qty, 0);
  const uoms = new Set(rows.map((r) => r.uom));
  const unitLabel = uoms.size === 1 ? [...uoms][0]! : 'units';

  return (
    <div className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-white">
      <div className={`flex items-center gap-3 px-4 py-3 ${collapsed ? '' : 'border-b border-[#EEF2F6]'}`}>
        <div
          role="button"
          tabIndex={0}
          onClick={onToggleCollapse}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleCollapse(); }
          }}
          className="flex min-w-0 flex-1 items-center gap-3 text-left cursor-pointer outline-none focus-visible:underline"
        >
          <span className="flex w-12 h-12 shrink-0 items-center justify-center rounded-lg border border-[#EEF2F6] bg-slate-50 text-slate-400">
            <Building2 className="w-5 h-5" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[14px] text-foreground" style={{ fontWeight: 600 }}>{vendorName}</span>
            <span className="mt-1 block text-[12px] text-slate-500">
              Going back:{' '}
              <span className="text-foreground tabular-nums" style={{ fontWeight: 600 }}>
                {formatQty(units)} {unitLabel}
              </span>
              {' · '}
              <span className="text-foreground tabular-nums" style={{ fontWeight: 600 }}>{money(value)}</span>
            </span>
          </span>
        </div>

        <span className="shrink-0 text-[10px] text-slate-500 tabular-nums whitespace-nowrap" style={{ fontWeight: 500 }}>
          {rows.length} {rows.length === 1 ? 'item' : 'items'}
        </span>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onAddItems}
            aria-label={`Add another item from ${vendorName}`}
            className="inline-flex items-center gap-1.5 h-9 rounded-lg px-2.5 text-[12px] border border-slate-200 bg-white text-foreground transition-colors hover:bg-slate-50 hover:border-primary/40 whitespace-nowrap"
            style={{ fontWeight: 500 }}
          >
            <Plus className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">Add item</span>
          </button>
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={collapsed ? `Show items for ${vendorName}` : `Hide items for ${vendorName}`}
            className="flex w-7 h-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100"
          >
            {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="flex flex-col gap-2 px-3 pb-3 pt-3">
          {rows.length === 0 ? (
            <p className="text-[12px] text-slate-500 px-1 py-2 text-center">
              Nothing from {vendorName} yet. Use Add item to pick from their book.
            </p>
          ) : (
            rows.map((row) => (
              <PartLine
                key={row.key}
                row={row}
                vendorName={vendorName}
                onQty={(n) => onQty(row.key, n)}
                onEdit={() => onEditRow(row.sku)}
                onRemove={() => onQty(row.key, 0)}
                onPickSerials={() => onPickSerials(row.sku)}
                onMoveBalance={(toVendorCode) => onMoveBalance(row.sku, toVendorCode)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

/** One part in this vendor's box: the cart's line item, unchanged. */
function PartLine({
  row,
  vendorName,
  onQty,
  onEdit,
  onRemove,
  onPickSerials,
  onMoveBalance,
}: {
  row: PartRow;
  vendorName: string;
  onQty: (n: number) => void;
  /** Name the units. Serialized rows only. */
  onPickSerials: () => void;
  /** Cut this row back to what the vendor shipped and hand the rest over. */
  onMoveBalance: (toVendorCode: string) => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const active = row.qty > 0;
  const over = Math.round((row.qty - row.cap) * 100) / 100;
  return (
    <div
      className={`overflow-hidden rounded-lg border border-[#E2E8F0] transition-all duration-150 ${
        active ? 'bg-white' : 'bg-slate-100/40 opacity-65'
      }`}
    >
      <div className="flex items-start gap-3 px-3 py-2.5">
        <span className="w-10 h-10 shrink-0 rounded-lg overflow-hidden border border-[#EEF2F6] bg-slate-50">
          <ImageWithFallback src={imageForSku(row.sku)} alt={row.sku} className="w-full h-full object-cover" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-2 min-w-0">
            <span className="truncate text-[14px] text-foreground" style={{ fontWeight: 600 }}>{row.sku}</span>
            <TrackingTag mode={row.trackingMode} size="md" />
          </div>
          <p className="mt-0.5 text-[12px] text-slate-500 leading-snug truncate">{row.description}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px] text-slate-500">
            <span className="inline-flex items-center gap-1">
              <Package className="w-3 h-3" /> up to {formatQty(row.cap)} {row.uom}
            </span>
            <span>·</span>
            <span className="inline-flex items-baseline gap-1">
              <span className="text-foreground tabular-nums" style={{ fontWeight: 600 }}>{money(row.unitPrice)}</span>
              <span>/ {row.uom}</span>
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-[#EEF2F6] bg-slate-100/30 px-3 py-1.5">
        {row.locked ? (
          <span className="inline-flex items-center gap-1.5 text-[12px] text-emerald-700" style={{ fontWeight: 600 }}>
            <Lock className="w-3 h-3" />
            {formatQty(row.qty)} {row.uom} · placed by the paperwork
          </span>
        ) : row.trackingMode === 'serialized' ? (
          // Same rule as the by-item card: a serialized row has no quantity to
          // type. Naming which of this vendor's units are going back is what
          // sets the count, so the row offers the picker and shows the result
          // beside it.
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onPickSerials}
              className={
                row.qty > 0
                  ? 'inline-flex items-center gap-1.5 h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-[12px] text-foreground transition-colors hover:bg-slate-50'
                  : 'inline-flex items-center gap-1.5 h-8 rounded-lg bg-primary px-3 text-[12px] text-white shadow-sm transition-colors hover:bg-blue-700'
              }
              style={{ fontWeight: row.qty > 0 ? 500 : 600 }}
              aria-label={`Name the ${row.sku} units going back to ${vendorName}`}
            >
              <ScanLine className="w-3.5 h-3.5" />
              {row.qty > 0 ? 'Change units' : 'Add units'}
            </button>
            {row.qty > 0 && (
              <span className="inline-flex items-center h-[22px] rounded-md bg-blue-50 border border-blue-100 px-2 text-[11px] text-primary tabular-nums whitespace-nowrap" style={{ fontWeight: 600 }}>
                {formatQty(row.qty)} {row.uom} selected
              </span>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <QtyStepper
              value={row.qty}
              cap={row.cap}
              ariaLabel={`Quantity of ${row.sku} going back to ${vendorName}`}
              onChange={onQty}
            />
            <span className="text-[12px] text-slate-500">{row.uom}</span>
          </div>
        )}
        {over > 0 && (
          // Same rule as the by-item card: a vendor credits what they sold, so
          // the row says how far past that it has been pushed and offers the
          // move. Without it this route had the gate and no way through it.
          <div className="flex min-w-0 flex-1 items-center justify-end gap-2 pr-1">
            <span className="truncate text-[11px] text-red-700" style={{ fontWeight: 600 }}>
              {formatQty(over)} {row.uom} more than they shipped
            </span>
            {row.moveTargets.length > 0 && (
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="shrink-0 inline-flex items-center gap-1 h-7 rounded-md border border-red-200 bg-white px-2 text-[11px] text-red-700 transition-colors hover:bg-red-50 whitespace-nowrap"
                    style={{ fontWeight: 600 }}
                    aria-label={`Move ${formatQty(over)} ${row.uom} of ${row.sku} off ${vendorName}`}
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
                    Who takes the other {formatQty(over)} {row.uom}
                  </p>
                  <div className="px-3 pb-2 pt-1 text-[11px] text-slate-500 leading-snug">
                    {vendorName} keeps {formatQty(row.cap)} {row.uom}, all they shipped of {row.sku}.
                  </div>
                  <div className="divide-y divide-[#EEF2F6] max-h-[260px] overflow-y-auto border-t border-[#EEF2F6]">
                    {row.moveTargets.map((t) => (
                      <button
                        key={t.code}
                        type="button"
                        onClick={() => onMoveBalance(t.code)}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-[#F7FAFF]"
                      >
                        <span className="flex w-6 h-6 shrink-0 items-center justify-center rounded-md border border-[#EEF2F6] bg-slate-50 text-slate-400">
                          <Building2 className="w-3 h-3" />
                        </span>
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
            aria-label={`How ${row.sku} comes back from ${vendorName}`}
            title={`How ${row.sku} comes back from ${vendorName}`}
            className="flex w-7 h-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-foreground"
          >
            <Pencil className="w-[13px] h-[13px]" />
          </button>
          {!row.locked && (
            <button
              type="button"
              onClick={onRemove}
              aria-label={`Take ${row.sku} off ${vendorName}`}
              title={`Take ${row.sku} off ${vendorName}`}
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
