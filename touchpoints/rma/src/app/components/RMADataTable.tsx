import { Fragment, createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { rmaShipmentInProcess } from '@/app/data/rmaShipments';
import {
  MoreHorizontal,
  Download,
  Archive,
  FileEdit,
  Replace,
  Undo2,
  CircleDollarSign,
  Truck,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';
import {
  DataTable,
  OverflowTooltip,
  StatusPill,
  type ColumnDef,
  type ColumnFilterState,
  type DensityOption,
  type SortConfig,
  type StatusPillStyle,
} from '@/app/components/data-table';
import { VendorCell, CreatedByCell } from '@/app/components/InvoiceDataTable';
import { deriveInitials } from '@/app/components/VendorAvatar';
import { getAvatarTint } from '@/app/utils/avatarTints';
import {
  receivingsForRMA,
  rmaStatusLabel,
  rmaDaysSinceShipped,
  rmaPaymentOverdue,
  poLabel,
  sourcePOsForRMA,
  trackingModeFor,
  type RMA,
  type RMAStatus,
  type RMAStatusLabel,
  type ReturnType as RMAReturnType,
} from '@/app/data/mockRMAs';
import { ItemImageWithPreview, ItemQuickViewModal } from '@/app/components/invoice-details/ItemQuickView';
import { imageForSku } from '@/app/lib/itemImages';
import { palette } from '@/styles/tokens';
import { isBaseCurrency } from '@/app/currency/currencies';
import { toBase } from '@/app/currency/rates';
import { returnFx, rmaCurrency, rmaCurrencyPO } from '@/app/currency/returnCurrency';
import { BaseMoney } from '@/app/components/currency/Money';
import { CurrencyPill } from '@/app/components/currency/CurrencyChip';
import { returnValueOf } from '@/app/components/currency/ReturnCurrencyConfig';

// ─── STATUS palette — mirrors the vendor-invoicing STATUS_STYLES pattern
// (light/-50 background + -700 foreground + -200 border, terminal states
// get a slightly deeper stop with an icon so they read distinct at a
// glance from the "in progress" pair). Same visual language, RMA vocab.
/** What a return reads as on the list. Archiving is not a lifecycle state --
 *  it is a return put away -- but on a list of statuses it is the answer to
 *  "where did it go", so it stands beside them. Without it an archived return
 *  left the list with no filter that could bring it back. */
export type RMAListStatus = RMAStatusLabel | 'Archived';

export const rmaListStatus = (rma: RMA): RMAListStatus =>
  rma.archived ? 'Archived' : rmaStatusLabel(rma);

export const RMA_STATUS_STYLES: Record<RMAListStatus, StatusPillStyle> = {
  Draft: {
    bg: palette.slate[100],
    fg: palette.slate[600],
    border: palette.slate[300],
  },
  // Sent = submitted, awaiting Approved. Blue reads as "in the review
  // pipeline" — softer than Approved's indigo so the two lifecycle steps
  // remain visually distinct.
  Sent: {
    bg: palette.blue[50],
    fg: palette.blue[700],
    border: palette.blue[200],
  },
  Approved: {
    bg: palette.indigo[50],
    fg: palette.indigo[700],
    border: palette.indigo[200],
  },
  'Shipped to Vendor': {
    bg: palette.amber[50],
    fg: palette.amber[700],
    border: palette.amber[300],
  },
  Closed: {
    bg: palette.emerald[50],
    fg: palette.emerald[700],
    border: palette.emerald[200],
  },
  // Closed, but the vendor settled short and the gap was written off. Red,
  // because money was lost on it.
  'Closed with loss': {
    bg: palette.red[50],
    fg: palette.red[700],
    border: palette.red[200],
  },
  // Red, the same stop every other module gives a cancelled record. Muted
  // slate put it beside Draft, and the two are opposite things: a draft is a
  // return nobody has started, a cancelled one is a return somebody stopped.
  // A reader scanning the column has to be able to tell them apart at a
  // glance, and only one of them is a dead end.
  Cancelled: {
    bg: palette.red[50],
    fg: palette.red[700],
    border: palette.red[200],
  },
  // Put away rather than stopped, so it reads quieter than Cancelled: the
  // same slate, without the ring, so it recedes on a list it only appears on
  // when somebody went looking for it.
  Archived: {
    bg: palette.slate[50],
    fg: palette.slate[500],
    border: palette.slate[200],
  },
};

// ─── RETURN TYPE palette — mirrors TYPE_CONFIG's pattern (icon + tint
// pill). Each family gets its own hue so the column reads as visual
// recognition without the user parsing text.
export const RMA_TYPE_CONFIG: Record<
  RMAReturnType,
  {
    icon: React.ComponentType<{ className?: string }>;
    bg: string;
    fg: string;
    border: string;
  }
> = {
  'Refund/Credit': {
    icon: CircleDollarSign,
    bg: palette.emerald[50],
    fg: palette.emerald[700],
    border: palette.emerald[200],
  },
  Replacement: {
    icon: Replace,
    bg: palette.blue[50],
    fg: palette.blue[700],
    border: palette.blue[200],
  },
  'Return Only': {
    icon: Undo2,
    bg: palette.amber[50],
    fg: palette.amber[700],
    border: palette.amber[200],
  },
};

// Partner-module "No. of Items" cell — first item's photo + SKU
// followed by a primary-blue "+N more" text link. Hovering the "+N more"
// expands the remaining items into an OverflowTooltip card (item photo
// + item number + description) so the user never loses context. The
// thumbnail carries the same two states the partner list gives it: master
// data on hover, the full item quick view on click.
export interface ItemsCellItem {
  id: string;
  sku: string;
  description: string;
  unitPrice?: number | undefined;
  uom?: string | undefined;
}

/** The listing's own items cell, taking a plain list so the same cell can be
 *  drawn anywhere a row is about parts: the returns listing reads it off an
 *  RMA, Linked Records reads it off whatever a document is about. */
export function RMAItemsCell({
  items,
  vendorName,
  empty = '–',
}: {
  items: ItemsCellItem[];
  vendorName: string;
  /** What stands in when the row is about no particular part. */
  empty?: string;
}) {
  const [preview, setPreview] = useState(false);
  const first = items[0];
  if (!first) {
    return <span className="text-muted-foreground/60 text-[12px]">{empty}</span>;
  }
  const rest = items.slice(1);
  const serialized = trackingModeFor(first.sku) === 'serialized';
  return (
    <div className="flex items-center gap-2 min-w-0">
      <ItemImageWithPreview
        sku={first.sku}
        alt={first.sku}
        {...(first.unitPrice !== undefined ? { unitPrice: first.unitPrice } : {})}
        {...(first.uom !== undefined ? { uom: first.uom } : {})}
        serialized={serialized}
        onPreview={() => setPreview(true)}
        disabled={preview}
        size={32}
      />
      <ItemQuickViewModal
        open={preview}
        onClose={() => setPreview(false)}
        sku={first.sku}
        vendorName={vendorName}
        description={first.description}
        {...(first.unitPrice !== undefined ? { unitPrice: first.unitPrice } : {})}
        {...(first.uom !== undefined ? { uom: first.uom } : {})}
        serialized={serialized}
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
            className="text-[12px] cursor-pointer transition-colors shrink-0 whitespace-nowrap hover:underline"
            style={{ color: 'hsl(var(--primary))', fontWeight: 500 }}
          >
            +{rest.length} more
          </span>
        </OverflowTooltip>
      )}
    </div>
  );
}

/** The returns listing's own use of it. */
function ItemsCell({ rma }: { rma: RMA }) {
  return (
    <RMAItemsCell
      items={rma.items.map((li) => ({
        id: li.id,
        sku: li.sku,
        description: li.description,
        unitPrice: li.unitPrice,
        uom: li.uom,
      }))}
      vendorName={rma.vendor}
    />
  );
}

/**
 * Return ship-to — the party the shipment is addressed to, with the site it
 * goes to underneath.
 *
 * A return that fans out addresses one leg per vendor site, and those used to
 * collapse to the word "Per site", which named none of them and left the
 * partner column empty. The first leg now reads inline and the rest open in a
 * hover card, so a fan-out says where the goods actually go.
 */
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Sep 12, 2026", the way the linked records table writes a date. */
function formatCreatedOn(iso: string): string {
  const [y, m, d] = (iso ?? '').split('-');
  if (!y || !m || !d) return iso ?? '–';
  return `${MONTH_SHORT[parseInt(m, 10) - 1] ?? m} ${parseInt(d, 10)}, ${y}`;
}

function LinkedDocsCell({ rma }: { rma: RMA }) {
  const pos = sourcePOsForRMA(rma);
  const receivings = receivingsForRMA(rma);
  if (pos.length === 0 && receivings.length === 0)
    return <span className="text-muted-foreground">–</span>;
  // A document number says nothing at a glance, so each kind reads as a
  // labelled chip carrying its count, with the identifiers in the hover card.
  const chip = (label: string, category: string, values: string[]) => (
    <OverflowTooltip
      category={category}
      items={values.map((v) => ({
        id: `${rma.id}-${category}-${v}`,
        name: v,
        subtitle: rma.vendor,
      }))}
    >
      <span
        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-border bg-white text-[11px] text-foreground whitespace-nowrap shrink-0 cursor-pointer transition-colors hover:bg-muted/50"
        style={{ fontWeight: 500 }}
      >
        {label}
        <span
          className="text-[10px] tabular-nums rounded-full px-1.5 py-px bg-muted text-muted-foreground"
          style={{ fontWeight: 600 }}
        >
          {values.length}
        </span>
      </span>
    </OverflowTooltip>
  );
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      {pos.length > 0 &&
        chip(
          'PO',
          'Purchase orders',
          pos.map(poLabel),
        )}
      {receivings.length > 0 && chip('Receiving', 'Receiving documents', receivings)}
    </div>
  );
}

function highlightText(text: string, query?: string): ReactNode {
  if (!query || !query.trim()) return text;
  const q = query.trim();
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx < 0) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark
        className="bg-yellow-100 text-inherit rounded-sm px-0.5"
        style={{ padding: '0 1px' }}
      >
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </>
  );
}

// ─── RMA_COLUMNS — the catalog. Same shape as INVOICE_COLUMNS so it
// plugs straight into DataTable (column selector, header sort/filter
// menus, freeze, resize all work for free). Order here is the default
// column order; ColumnSelector persists user changes.
/** Lets the RMA ID cell open the version history without threading a callback
 *  through DataTable — the column catalog is a module-level const, so the
 *  handler has to arrive out of band. Unset outside the list screen, which
 *  hides the badge. */
const VersionHistoryContext = createContext<((rma: RMA) => void) | null>(null);

export function RMAVersionHistoryProvider({
  onOpen,
  children,
}: {
  onOpen: (rma: RMA) => void;
  children: ReactNode;
}) {
  return <VersionHistoryContext.Provider value={onOpen}>{children}</VersionHistoryContext.Provider>;
}

function VersionBadge({ rma }: { rma: RMA }) {
  const onOpen = useContext(VersionHistoryContext);
  if (!onOpen) return null;
  const version = rma.currentVersion ?? rma.versions?.[0]?.version ?? 1;
  return (
    <button
      type="button"
      /* The row navigates on click and the checkbox cell drag-selects on
         mousedown, so both have to be stopped or the badge loses the click. */
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onOpen(rma);
      }}
      title={`View the version history of ${rma.rmaNumber}`}
      aria-label={`View the version history of ${rma.rmaNumber}`}
      className="inline-flex items-center justify-center rounded-[4px] px-1.5 shrink-0 cursor-pointer transition-colors hover:brightness-95"
      style={{
        fontSize: 10,
        lineHeight: '14px',
        fontWeight: 600,
        backgroundColor: 'hsl(var(--secondary))',
        color: 'hsl(var(--muted-foreground))',
        border: '1px solid hsl(var(--border))',
      }}
    >
      V{version}
    </button>
  );
}

/** Everything a return can be found by, each under the name somebody would
 *  look for it under.
 *
 *  The list's filter reads this and so does the hint on the row, so a search
 *  can never match on something the row is then unable to show. It also
 *  carries the printed form of a number alongside the stored one: a PO is
 *  held as "11211" and printed as "PO-11211", and typing what the product
 *  printed used to find nothing. */
export function rmaSearchFields(rma: RMA): Array<{ label: string; value: string }> {
  const out: Array<{ label: string; value: string }> = [
    { label: 'RMA', value: rma.rmaNumber },
    { label: 'Vendor', value: rma.vendor },
  ];
  if (rma.vendorRMANumber) out.push({ label: 'Vendor RMA', value: rma.vendorRMANumber });
  sourcePOsForRMA(rma).forEach((po) => out.push({ label: 'PO', value: poLabel(po) }));
  (rma.receivingNumbers ?? []).forEach((grn) => out.push({ label: 'Receipt', value: grn }));
  rma.items.forEach((li) => {
    out.push({ label: 'Item', value: li.sku });
    out.push({ label: 'Item', value: li.description });
  });
  (rma.tags ?? []).forEach((tag) => out.push({ label: 'Tag', value: tag }));
  out.push({ label: 'Owner', value: rma.owner });
  if (rma.createdBy) out.push({ label: 'Created by', value: rma.createdBy });
  if (rma.pointOfContact) out.push({ label: 'Contact', value: rma.pointOfContact });
  if (rma.returnShipTo) out.push({ label: 'Ship to', value: rma.returnShipTo });
  return out;
}

export function rmaMatchesSearch(rma: RMA, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return rmaSearchFields(rma).some((f) => f.value.toLowerCase().includes(q));
}

/** Where a search landed when it did not land on the number in this cell.
 *  Returned so the row can say what it matched on, rather than appearing in
 *  the results with nothing on it that contains what was typed. */
function offNumberMatch(rma: RMA, query: string): { label: string; value: string } | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  if (rma.rmaNumber.toLowerCase().includes(q)) return null;
  return rmaSearchFields(rma).find((f) => f.value.toLowerCase().includes(q)) ?? null;
}

export const RMA_COLUMNS: ColumnDef<RMA>[] = [
  {
    key: 'rmaNumber',
    label: 'RMA ID',
    // Room for the longest number beside its version badge.
    minWidth: 170,
    defaultWidth: 180,
    sortable: true,
    locked: true,
    sticky: 'left',
    filterable: false,
    filterType: 'text',
    getValue: (row) => row.rmaNumber,
    render: (row, { density, searchQuery }) => (
      // Plain slate text — same recipe as vendor-invoicing's Invoice ID
      // column (no hover styling per design feedback). Row click still
      // opens the detail via the DataTable's row handler.
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="flex items-center gap-1.5 min-w-0">
          <span
            className={`truncate whitespace-nowrap text-left ${
              density === 'comfort' ? 'text-[13px]' : 'text-sm'
            }`}
            style={{ fontWeight: 500, color: palette.slate[800] }}
          >
            {highlightText(row.rmaNumber, searchQuery)}
          </span>
          <VersionBadge rma={row} />
        </span>
        {/* A return can be found by things this table has no column for --
            a receipt number, a part code, a tag. Landing in the results with
            nothing on the row containing what was typed reads as a wrong
            result, so the row says where the words actually were. */}
        {(() => {
          const hit = offNumberMatch(row, searchQuery ?? '');
          if (!hit) return null;
          return (
            <span className="flex min-w-0 items-center gap-1 text-[11px] text-slate-500">
              <span className="shrink-0" style={{ fontWeight: 500 }}>{hit.label}</span>
              <span className="truncate">{highlightText(hit.value, searchQuery)}</span>
            </span>
          );
        })()}
      </span>
    ),
  },
  {
    key: 'vendor',
    label: 'Vendor',
    minWidth: 200,
    defaultWidth: 240,
    sortable: true,
    filterType: 'multiselect',
    uniqueValues: (rows) => Array.from(new Set(rows.map((r) => r.vendor))).sort(),
    getValue: (row) => row.vendor,
    render: (row, { density, searchQuery }) => (
      // VendorCell — avatar tile + hover-card + description sub-line in
      // comfort density. Imported from InvoiceDataTable so both listings
      // render vendor context identically.
      <VendorCell
        vendor={row.vendor}
        description={row.notes ?? `Source ${poLabel(row.sourcePO)}`}
        density={density}
        searchQuery={searchQuery}
        // The return's currency on a foreign-currency return (2026-11-24);
        // a PKR return gets none.
        tag={
          isBaseCurrency(rmaCurrency(row)) ? undefined : (
            <CurrencyPill code={rmaCurrency(row)} note={`The return's currency, from PO-${rmaCurrencyPO(row)}.`} />
          )
        }
      />
    ),
  },
  {
    key: 'status',
    label: 'Status',
    // Fits the longest pills, Shipped to Vendor and Closed with loss.
    minWidth: 170,
    defaultWidth: 180,
    sortable: true,
    filterType: 'multiselect',
    uniqueValues: () => [
      'Draft',
      'Sent',
      'Approved',
      'Shipped to Vendor',
      'Closed',
      'Closed with loss',
      'Cancelled',
      'Archived',
    ],
    getValue: (row) => rmaListStatus(row),
    render: (row) => (
      <span className="flex min-w-0 flex-col items-start gap-0.5">
        <StatusPill label={rmaListStatus(row)} style={RMA_STATUS_STYLES[rmaListStatus(row)]} />
        {/* ERP-8637 AC9: an Approved return partway out keeps its status and
            says so underneath, the same tag the detail header carries. */}
        {rmaShipmentInProcess(row) && (
          <span
            className="inline-flex items-center gap-1 text-[10px] text-slate-500 whitespace-nowrap"
            style={{ fontWeight: 500 }}
          >
            <Truck className="h-3 w-3" />
            Shipment in process
          </span>
        )}
        {/* DQ-02: a refund still out past the company's setting. */}
        {rmaPaymentOverdue(row) && (
          <span
            className="inline-flex items-center gap-1 text-[10px] text-red-700 whitespace-nowrap"
            style={{ fontWeight: 600 }}
            title={`Shipped ${rmaDaysSinceShipped(row)} days ago and the refund has not been logged.`}
          >
            <AlertTriangle className="h-3 w-3" />
            Payment overdue
          </span>
        )}
      </span>
    ),
  },
  {
    // What the goods going back are worth, in PKR at the receiving rate, the
    // rate their receipt was booked at (Currency Touchpoints Map,
    // 2026-11-24). A foreign-currency return shows its own amount and the
    // rate on hover; a PKR one is plain.
    key: 'returnValue',
    label: 'Return value',
    minWidth: 150,
    defaultWidth: 160,
    sortable: true,
    filterType: 'range',
    filterable: true,
    align: 'right',
    getValue: (row) => {
      const fx = returnFx(row);
      const value = returnValueOf(row);
      return fx ? toBase(value, fx.rate) : value;
    },
    render: (row) => (
      <span className="text-[13px] text-foreground tabular-nums" style={{ fontWeight: 500 }}>
        <BaseMoney value={returnValueOf(row)} currency={rmaCurrency(row)} fx={returnFx(row)} role="Return currency" />
      </span>
    ),
  },
  {
    key: 'items',
    label: 'Returned items',
    minWidth: 200,
    defaultWidth: 240,
    sortable: true,
    filterType: 'range',
    filterable: true,
    // Sort + range filter by item count so the column keeps behaving
    // like a numeric column even though it renders as an image + code.
    getValue: (row) => row.items.length,
    getSortValue: (row) => row.items.length,
    // Partner "No. of Items" recipe: first item's photo + SKU, then a
    // primary-blue "+N more" text link that expands the remaining items
    // into an OverflowTooltip hover card.
    render: (row) => <ItemsCell rma={row} />,
  },
  {
    key: 'linkedDocs',
    label: 'Linked docs',
    // Both chips side by side, PO and Receiving with their counts.
    minWidth: 200,
    defaultWidth: 210,
    sortable: true,
    filterType: 'multiselect',
    // Keyed on the PO, since that is the primary line and a return spanning
    // several POs has no single receipt to filter on.
    uniqueValues: (rows) =>
      Array.from(new Set(rows.map((r) => poLabel(sourcePOsForRMA(r)[0] ?? '')))).sort(),
    getValue: (row) => poLabel(sourcePOsForRMA(row)[0] ?? ''),
    render: (row) => <LinkedDocsCell rma={row} />,
  },
  {
    key: 'pointOfContact',
    label: 'Point of contact',
    minWidth: 180,
    defaultWidth: 200,
    sortable: true,
    filterType: 'multiselect',
    uniqueValues: (rows) =>
      Array.from(new Set(rows.map((r) => r.pointOfContact ?? '').filter(Boolean))).sort(),
    getValue: (row) => row.pointOfContact ?? '',
    // Same avatar + hover-card recipe as Created by. Point of contact is
    // whoever owns the return on our side.
    render: (row, { density }) =>
      row.pointOfContact ? (
        <CreatedByCell name={row.pointOfContact} vendor={row.vendor} density={density} />
      ) : (
        <span className="text-muted-foreground">–</span>
      ),
  },
  {
    // When the return was raised. Created by was on the list without the one
    // thing that makes it answerable -- when -- and where the goods ship back
    // to is a logistics decision that reads on the return itself.
    key: 'createdDate',
    label: 'Created on',
    minWidth: 132,
    defaultWidth: 148,
    sortable: true,
    getValue: (row) => row.createdDate,
    render: (row) => (
      <span className="text-[13px] text-foreground tabular-nums" style={{ fontWeight: 500 }}>
        {formatCreatedOn(row.createdDate)}
      </span>
    ),
  },
  {
    key: 'createdBy',
    label: 'Created by',
    minWidth: 180,
    defaultWidth: 200,
    sortable: true,
    filterType: 'multiselect',
    uniqueValues: (rows) => Array.from(new Set(rows.map((r) => r.createdBy))).sort(),
    getValue: (row) => row.createdBy,
    render: (row, { density }) => (
      <CreatedByCell name={row.createdBy} vendor={row.vendor} density={density} />
    ),
  },
  // Return type is gone from the listing. How a return settles is decided on
  // the return itself and read on its own page; a column of it here was a
  // value nobody filtered a list by.
];

// ─── Row actions. The lifecycle verbs (submit / approve / ship / receive /
// resolve / cancel) live on the detail page where they have their confirm
// modals; the row menu is a fixed placeholder set that does not depend on
// status. The lifecycle ids stay in the union because the bulk action bar
// still emits them.
export type RMARowActionId =
  | 'view'
  | 'submit'
  | 'approve'
  | 'reject'
  | 'ship'
  | 'close'
  | 'cancel'
  | 'download'
  | 'archive';

interface RMARowActionDef {
  id: RMARowActionId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  destructive?: boolean;
}

const ROW_ACTIONS: RMARowActionDef[] = [
  { id: 'download', label: 'Download', icon: Download },
];

/** Archiving is putting a return away, and only a return that is over and
 *  settled nothing can be put away. A live one still has a next step, and a
 *  closed one is the record of a credit -- neither belongs in an archive, so
 *  the action is offered on a cancelled return and nowhere else. */
function getRowActionGroups(rma: RMA): RMARowActionDef[][] {
  if (rma.status !== 'Cancelled') return [ROW_ACTIONS];
  return [ROW_ACTIONS, [{ id: 'archive', label: 'Archive', icon: Archive }]];
}

// ─── The table wrapper — DataTable does all the heavy lifting; this
// component owns the row-actions renderer so the caller only supplies
// an onRowAction callback.
interface RMADataTableProps {
  rmas: RMA[];
  optionRows?: RMA[];
  selectedIds: Set<string>;
  onSelectionChange: (next: Set<string>) => void;
  columnOrder: string[];
  onColumnOrderChange: (next: string[]) => void;
  columnVisibility: Record<string, boolean>;
  columnFilters: Record<string, ColumnFilterState>;
  onColumnFilterChange: (columnKey: string, filter: ColumnFilterState) => void;
  onAddColumnFilter: (columnKey: string) => void;
  onHideColumn: (columnKey: string) => void;
  sortConfig: SortConfig | null;
  onSort: (columnKey: string, direction: 'asc' | 'desc' | null) => void;
  frozenColumns: Set<string>;
  onFreezeColumn: (columnKey: string) => void;
  density: DensityOption;
  currentPage: number;
  recordsPerPage: number;
  totalRows: number;
  onPageChange: (page: number) => void;
  onRecordsPerPageChange: (n: number) => void;
  onRowClick?: (rma: RMA) => void;
  onRowAction?: (actionId: RMARowActionId, rmaId: string) => void;
  searchQuery?: string;
  emptyState?: ReactNode;
  newlyCreatedId?: string | null;
}

export function RMADataTable({
  rmas,
  optionRows,
  selectedIds,
  onSelectionChange,
  columnOrder,
  onColumnOrderChange,
  columnVisibility,
  columnFilters,
  onColumnFilterChange,
  onAddColumnFilter,
  onHideColumn,
  sortConfig,
  onSort,
  frozenColumns,
  onFreezeColumn,
  density,
  currentPage,
  recordsPerPage,
  totalRows,
  onPageChange,
  onRecordsPerPageChange,
  onRowClick,
  onRowAction,
  searchQuery,
  emptyState,
  newlyCreatedId,
}: RMADataTableProps) {
  const renderRowActions = useMemo(
    () =>
      onRowAction
        ? (rma: RMA) => (
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-muted">
                  <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-[220px]"
                onClick={(e) => e.stopPropagation()}
              >
                {getRowActionGroups(rma).map((group, gi) => (
                  <Fragment key={gi}>
                    {gi > 0 && <DropdownMenuSeparator />}
                    {group.map((action) => {
                      const Icon = action.icon;
                      return (
                        <DropdownMenuItem
                          key={action.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            onRowAction(action.id, rma.id);
                          }}
                          className={
                            action.destructive
                              ? 'text-rose-600 focus:text-rose-700 focus:bg-rose-50'
                              : undefined
                          }
                        >
                          <Icon className={`w-4 h-4 mr-2 ${action.destructive ? 'text-rose-500' : ''}`} />
                          {action.label}
                        </DropdownMenuItem>
                      );
                    })}
                  </Fragment>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )
        : undefined,
    [onRowAction],
  );

  return (
    <DataTable
      rows={rmas}
      optionRows={optionRows}
      columns={RMA_COLUMNS}
      // Spread the container across every visible column on wider screens,
      // so RMA #, Vendor, Status, etc. each expand proportionally instead
      // of the whole slack collapsing into the Vendor column.
      fillMode="spread"
      getRowId={(rma) => rma.id}
      selectedIds={selectedIds}
      onSelectionChange={onSelectionChange}
      columnOrder={columnOrder}
      onColumnOrderChange={onColumnOrderChange}
      columnVisibility={columnVisibility}
      columnFilters={columnFilters}
      onColumnFilterChange={onColumnFilterChange}
      onAddColumnFilter={onAddColumnFilter}
      onHideColumn={onHideColumn}
      sortConfig={sortConfig}
      onSort={onSort}
      frozenColumns={frozenColumns}
      onFreezeColumn={onFreezeColumn}
      density={density}
      onRowClick={onRowClick}
      renderRowActions={renderRowActions}
      searchQuery={searchQuery}
      emptyState={emptyState}
      newlyCreatedId={newlyCreatedId}
      currentPage={currentPage}
      recordsPerPage={recordsPerPage}
      totalRows={totalRows}
      onPageChange={onPageChange}
      onRecordsPerPageChange={onRecordsPerPageChange}
    />
  );
}
