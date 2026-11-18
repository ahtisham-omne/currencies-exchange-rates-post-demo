import { formatMoney as moneyIn } from '@/app/currency/money';
import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Truck } from 'lucide-react';
import { LineItemsTable } from './LineItemsTab';
import { EmptyState } from '@/app/components/EmptyState';
import { OverflowTooltip } from '@/app/components/data-table/OverflowTooltip';
import { StatusPill } from '@/app/components/data-table/StatusPill';
import type { ColumnDef } from '@/app/components/data-table/types';
import type { StatusPillStyle } from '@/app/components/data-table/StatusPill';
import { VendorCell } from '@/app/components/InvoiceDataTable';
import type { Invoice } from '@/app/data/mockInvoices';
import type { RMA, RMALineItem } from '@/app/data/mockRMAs';
import { authorizedQty } from '@/app/data/mockRMAs';
import {
  buildRMAShipments,
  rmaShipmentInProcess,
  type RMAShipment,
  type RMAShipmentStatus,
} from '@/app/data/rmaShipments';
import { imageForSku } from '@/app/lib/itemImages';
import { palette } from '@/styles/tokens';

// Shipments live in their own module, so the Shipping ID leaves this app the
// way the sidebar's Vendor link leaves for partner-management. Host is a
// placeholder until the deployed Shipments URL is known; the /shipments/:id
// path matches that module's route.
const SHIPMENTS_MODULE_URL = 'https://shipments.lovable.app/shipments';

type ShipmentStatus = RMAShipmentStatus;

const SHIPMENT_STATUS_STYLES: Record<ShipmentStatus, StatusPillStyle> = {
  Shipped: {
    bg: palette.emerald[50],
    fg: palette.emerald[700],
    border: palette.emerald[200],
  },
  'In progress': {
    bg: palette.amber[50],
    fg: palette.amber[700],
    border: palette.amber[300],
  },
};

// The grouping and what counts as shipped live in `rmaShipments.ts`, so the
// line actions and the status tag read the same rule as this tab.
const buildShipments = buildRMAShipments;

// First item's photo + SKU, then a primary-blue "+N more" that opens the
// remaining items in a hover card — the RMA listing's "Ordered items" cell.
function ShipmentItemsCell({ items }: { items: RMALineItem[] }) {
  const first = items[0];
  if (!first) return <span className="text-muted-foreground/60 text-[12px]">No items</span>;
  const rest = items.slice(1);
  return (
    <div className="flex items-center gap-2 min-w-0">
      <img
        src={imageForSku(first.sku, 64)}
        alt={first.sku}
        className="w-6 h-6 rounded-md object-cover shrink-0 border border-slate-100"
        loading="lazy"
      />
      <span className="text-[12px] text-foreground font-mono truncate" style={{ fontWeight: 500 }}>
        {first.sku}
      </span>
      {rest.length > 0 && (
        <OverflowTooltip
          category="Items"
          items={rest.map((li) => ({
            id: li.id,
            name: li.sku,
            subtitle: li.description,
            imageUrl: imageForSku(li.sku, 64),
          }))}
        >
          <span
            className="text-[12px] cursor-pointer transition-colors shrink-0 hover:underline"
            style={{ color: 'hsl(var(--primary))', fontWeight: 500 }}
          >
            +{rest.length} more
          </span>
        </OverflowTooltip>
      )}
    </div>
  );
}

function FulfilmentCell({ shipment }: { shipment: RMAShipment }) {
  const pct = shipment.qtyToShip === 0 ? 0 : Math.round((shipment.shippedQty / shipment.qtyToShip) * 100);
  const done = pct === 100;
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5 text-[12px] tabular-nums" style={{ fontWeight: 500 }}>
        <span className="text-foreground">{shipment.shippedQty}</span>
        <span className="text-muted-foreground/60">of</span>
        <span className="text-muted-foreground">{shipment.qtyToShip} units</span>
      </div>
      <div className="mt-1 h-1.5 w-full max-w-[120px] rounded-full bg-slate-100 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${pct}%`,
            backgroundColor: done ? palette.emerald[500] : palette.amber[500],
          }}
        />
      </div>
    </div>
  );
}

// Nested detail — the line-item level breakdown of one shipment. Three
// columns only (Line item · Qty to Ship · Shipped); the parent row already
// carries the shipment-level context.
function ShipmentLinesPanel({ shipment }: { shipment: RMAShipment }) {
  return (
    <div className="pl-8 pr-3 py-2.5 border-l-2 border-primary/30">
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="grid grid-cols-[minmax(0,1fr)_120px_120px] gap-3 px-3 py-2 border-b border-border bg-slate-50/80 text-[11px] uppercase tracking-wider text-slate-500" style={{ fontWeight: 600 }}>
          <span>Line item</span>
          <span className="text-right">Qty to Ship</span>
          <span className="text-right">Shipped</span>
        </div>
        {shipment.items.map((li) => {
          const shipped = shipment.status === 'Shipped' ? authorizedQty(li) : 0;
          return (
            <div
              key={li.id}
              className="grid grid-cols-[minmax(0,1fr)_120px_120px] gap-3 px-3 py-2 items-center border-b border-border/60 last:border-b-0"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <img
                  src={imageForSku(li.sku, 64)}
                  alt={li.sku}
                  className="w-7 h-7 rounded-md object-cover shrink-0 border border-slate-100"
                  loading="lazy"
                />
                <div className="min-w-0">
                  <div className="text-[12px] text-slate-900 font-mono truncate" style={{ fontWeight: 700 }}>{li.sku}</div>
                  <div className="text-[11px] text-slate-500 truncate">{li.description}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="tabular-nums text-[13px] text-foreground" style={{ fontWeight: 500 }}>{authorizedQty(li)}</div>
                <div className="text-[10px] text-slate-400" style={{ fontWeight: 500 }}>{li.uom}</div>
              </div>
              <div className="text-right">
                <div className="tabular-nums text-[13px] text-foreground" style={{ fontWeight: 500 }}>{shipped}</div>
                <div className="text-[10px] text-slate-400" style={{ fontWeight: 500 }}>{li.uom}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatDate(iso?: string) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** In the return's (the PO's) currency, with its symbol: £30.23 (app/currency/money.ts). */
function formatMoney(amount: number, currency: string) {
  return moneyIn(amount, currency);
}

export function ShippingTab({ invoice, rma }: { invoice: Invoice; rma: RMA }) {
  // Nothing is staged until the first shipment leaves the dock, so a Draft,
  // Sent or Cancelled RMA, or an Approved one with no shipment in process,
  // has no shipment data to show.
  const hasShipped =
    rma.status === 'Shipped to Vendor' || rma.status === 'Closed' || rmaShipmentInProcess(rma);
  const shipments = useMemo(() => (hasShipped ? buildShipments(rma) : []), [rma, hasShipped]);
  const totalValue = shipments.reduce((s, sh) => s + sh.value, 0);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const toggleExpanded = (id: string) =>
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (!hasShipped) {
    return (
      <div className="border border-border rounded-xl bg-card">
        <EmptyState
          icon={Truck}
          title="No shipment yet"
          description="A return shipment surfaces here once you execute Ship Now on this RMA."
        />
      </div>
    );
  }

  const columns: ColumnDef<RMAShipment>[] = [
    {
      key: 'shippingId', label: 'Shipping ID', minWidth: 180, defaultWidth: 200,
      sortable: true, locked: true, sticky: 'left', flex: true,
      getValue: (s) => s.shippingId,
      render: (s) => {
        const open = expandedIds.has(s.id);
        return (
          <div className="flex items-center gap-1.5 min-w-0">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); toggleExpanded(s.id); }}
              className="shrink-0 inline-flex items-center justify-center w-5 h-5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              aria-expanded={open}
              aria-label={open ? `Hide line items for ${s.shippingId}` : `Show line items for ${s.shippingId}`}
              title={open ? 'Hide line items' : 'Show line items'}
            >
              {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>
            <a
              href={`${SHIPMENTS_MODULE_URL}/${s.shippingId}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="block truncate text-[13px] text-foreground hover:text-primary hover:underline decoration-primary/50 underline-offset-2 transition-colors"
              style={{ fontWeight: 500 }}
              title={`Open ${s.shippingId} in Shipments`}
            >
              {s.shippingId}
            </a>
          </div>
        );
      },
    },
    {
      key: 'status', label: 'Status', minWidth: 130, defaultWidth: 150, sortable: true,
      getValue: (s) => s.status,
      render: (s) => <StatusPill label={s.status} style={SHIPMENT_STATUS_STYLES[s.status]} />,
    },
    {
      key: 'fulfilment', label: 'Shipment fulfilment', minWidth: 160, defaultWidth: 180, sortable: true,
      tooltip: 'Units already dispatched on this shipment against the units it carries.',
      getValue: (s) => (s.qtyToShip === 0 ? 0 : s.shippedQty / s.qtyToShip),
      render: (s) => <FulfilmentCell shipment={s} />,
    },
    {
      key: 'items', label: 'Items', minWidth: 180, defaultWidth: 220, sortable: true,
      getValue: (s) => s.items.length,
      getSortValue: (s) => s.items.length,
      render: (s) => <ShipmentItemsCell items={s.items} />,
    },
    {
      key: 'shippedOn', label: 'Shipped on', minWidth: 130, defaultWidth: 150, sortable: true,
      getValue: (s) => s.shippedOn ?? '',
      render: (s) => {
        const date = formatDate(s.shippedOn);
        return date ? (
          <span className="text-[12px] text-slate-700 tabular-nums whitespace-nowrap" style={{ fontWeight: 500 }}>
            {date}
          </span>
        ) : (
          <span className="text-[12px] text-slate-400">Not shipped</span>
        );
      },
    },
    {
      key: 'shipTo', label: 'Ship To', minWidth: 200, defaultWidth: 230, sortable: true,
      getValue: (s) => s.shipTo,
      render: (s, { density, searchQuery }) => (
        <VendorCell vendor={rma.vendor} description={s.shipTo} density={density} searchQuery={searchQuery ?? ''} />
      ),
    },
  ];

  const catalog = columns.map((c) => ({ key: c.key, label: c.label }));

  return (
    <LineItemsTable<RMAShipment>
      rows={shipments}
      columns={columns}
      catalog={catalog}
      lockedKeys={['shippingId']}
      storageKey="omnesoft:rma-shipping-v1"
      getRowId={(s) => s.id}
      expandedIds={expandedIds}
      renderExpandedRow={(s) => <ShipmentLinesPanel shipment={s} />}
      subtotalLabel="Return value"
      subtotalValue={formatMoney(totalValue, invoice.currency)}
      rowHeight={58}
      title="Shipping"
      countNoun="shipments"
      searchAccessor={(s) =>
        `${s.shippingId} ${s.status} ${s.shipTo} ${s.items.map((li) => `${li.sku} ${li.description}`).join(' ')}`
      }
      searchPlaceholder="Search shipments…"
      emptyIcon={Truck}
      emptyTitle="No shipments yet"
      emptyMessage="This return has no shipments staged."
    />
  );
}
