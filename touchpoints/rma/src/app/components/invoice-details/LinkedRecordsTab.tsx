import { formatMoney as moneyIn } from '@/app/currency/money';
import { BASE_CURRENCY } from '@/app/currency/currencies';
import { toBase } from '@/app/currency/rates';
import { linkedRecordFx, returnSettlementFx } from '@/app/currency/returnSettlement';
import { BaseMoney } from '@/app/components/currency/Money';
import { CurrencyPill } from '@/app/components/currency/CurrencyChip';
import { useMemo, useState } from 'react';
import {
  Wallet,
  Banknote,
  Receipt,
  ShoppingCart,
  PackageCheck,
  ClipboardList,
  FileText,
  Truck,
  Undo2,
  Unlink,
  Info,
  Link2,
  Paperclip,
  Search,
  X,
  ChevronDown,
  SlidersHorizontal,
  MoreHorizontal,
  Eye,
  Download,
} from 'lucide-react';
import { toast } from 'sonner';
import { EmptyState } from '@/app/components/EmptyState';
import { Popover, PopoverContent, PopoverTrigger } from '@/app/components/ui/popover';
import { AttachmentPreviewModal } from '@/app/components/shared/attachments/attachment-preview-modal';
import { filesForRecord, type RecordFile } from '@/app/components/invoice-details/linkedRecordFiles';
import { RMAItemsCell } from '@/app/components/RMADataTable';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';
import { Invoice } from '@/app/data/mockInvoices';
import type { RMA } from '@/app/data/mockRMAs';
import {
  countsTowardBalance,
  isProcurementType,
  type LinkedFinancialRecord,
  type LinkedGroupType as GroupType,
  type LinkedApplicationStatus,
  type LinkedRecordStatus as RecordStatus,
} from '@/app/data/invoiceLinkedRecords';
import { CreatedByCell, highlightText } from '@/app/components/InvoiceDataTable';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/app/components/ui/hover-card';

// Linked Records tab — accordion section cards, one per record type, mirroring
// the Sales-Order "Linked Transactions" recipe (search + type pills toolbar
// card, then an independent collapsible card per type with a compact table).
// KPIs were removed per design feedback; the reconciliation still drives the
// per-group "applied" totals shown in each section header.
//
// Record vocabulary stays per invoice-screens-spec.md: prepayments, payments,
// credit memos; Applied / Partially applied count toward the balance,
// Reversed / Returned / Void are excluded (struck-through + omitted from the
// section total).

const GROUP_META: Record<GroupType, {
  icon: typeof Wallet;
  plural: string;
  /** Accent family per type — colours the section icon tile + count pill. */
  chipBg: string;
  chipText: string;
  chipBorder: string;
  /** In-app route for the record's own detail page; null = no page yet. */
  href: string | null;
}> = {
  'Purchase Order': { icon: ShoppingCart, plural: 'Purchase Orders', chipBg: '#EFF6FF', chipText: '#1D4ED8', chipBorder: '#BFDBFE', href: null },
  'Receiving Document': { icon: PackageCheck, plural: 'Receiving Documents', chipBg: '#F0FDFA', chipText: '#0F766E', chipBorder: '#99F6E4', href: null },
  Prepayment: { icon: Wallet, plural: 'Prepayments', chipBg: '#EEF2FF', chipText: '#4338CA', chipBorder: '#C7D2FE', href: '/prepayments' },
  Payment: { icon: Banknote, plural: 'Payments', chipBg: '#F5F3FF', chipText: '#6D28D9', chipBorder: '#DDD6FE', href: '/payments-v2' },
  'Credit Memo': { icon: Receipt, plural: 'Credit Memos', chipBg: '#FFFBEB', chipText: '#B45309', chipBorder: '#FDE68A', href: null },
  // A return's own chain, in the order it happens.
  'Vendor Invoice': { icon: FileText, plural: 'Vendor Invoices', chipBg: '#F8FAFC', chipText: '#334155', chipBorder: '#E2E8F0', href: null },
  'Picking Document': { icon: ClipboardList, plural: 'Picking Documents', chipBg: '#FEFCE8', chipText: '#854D0E', chipBorder: '#FEF08A', href: null },
  'Shipping Document': { icon: Truck, plural: 'Shipping Documents', chipBg: '#F0F9FF', chipText: '#0369A1', chipBorder: '#BAE6FD', href: null },
  Reversal: { icon: Undo2, plural: 'Reversals', chipBg: '#FDF4FF', chipText: '#A21CAF', chipBorder: '#F5D0FE', href: null },
  Unlinked: { icon: Unlink, plural: 'Unlinked Stock', chipBg: '#F8FAFC', chipText: '#64748B', chipBorder: '#E2E8F0', href: null },
};

// Fixed render order for the section cards — procurement (source) documents
// first, then the financial records applied to the invoice.
const GROUP_ORDER: GroupType[] = [
  'Purchase Order',
  'Receiving Document',
  'Vendor Invoice',
  'Prepayment',
  'Payment',
  'Credit Memo',
  'Picking Document',
  'Shipping Document',
  'Reversal',
  'Unlinked',
];

const STATUS_PALETTE: Record<RecordStatus, { bg: string; text: string; border: string }> = {
  // Financial application statuses
  Applied: { bg: '#ECFDF5', text: '#065F46', border: '#A7F3D0' },
  'Partially applied': { bg: '#FFFBEB', text: '#92400E', border: '#FDE68A' },
  Reversed: { bg: '#FEF2F2', text: '#991B1B', border: '#FECACA' },
  Returned: { bg: '#FEF2F2', text: '#991B1B', border: '#FECACA' },
  Void: { bg: '#FEF2F2', text: '#991B1B', border: '#FECACA' },
  // Procurement (PO / receiving) statuses
  Open: { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
  'Partially invoiced': { bg: '#FFFBEB', text: '#92400E', border: '#FDE68A' },
  Billed: { bg: '#ECFDF5', text: '#065F46', border: '#A7F3D0' },
  Closed: { bg: '#F1F5F9', text: '#475569', border: '#E2E8F0' },
  Cancelled: { bg: '#FEF2F2', text: '#991B1B', border: '#FECACA' },
  Received: { bg: '#ECFDF5', text: '#065F46', border: '#A7F3D0' },
  'Partially received': { bg: '#FFFBEB', text: '#92400E', border: '#FDE68A' },
  Inspected: { bg: '#EEF2FF', text: '#4338CA', border: '#C7D2FE' },
  Paid: { bg: '#ECFDF5', text: '#065F46', border: '#A7F3D0' },
  Picked: { bg: '#FEFCE8', text: '#854D0E', border: '#FEF08A' },
  Shipped: { bg: '#F0F9FF', text: '#0369A1', border: '#BAE6FD' },
  Posted: { bg: '#FDF4FF', text: '#A21CAF', border: '#F5D0FE' },
  'Not linked': { bg: '#F8FAFC', text: '#64748B', border: '#E2E8F0' },
  'Pending confirmation': { bg: '#FFFBEB', text: '#92400E', border: '#FDE68A' },
};

// A row is excluded from its group total / shown struck-through when it no
// longer counts. Financial: anything not Applied/Partially applied. Procurement:
// only Cancelled (PO) or Returned (receiving).
function isExcludedRow(r: LinkedFinancialRecord): boolean {
  // Raised and waiting on accounting: it still counts, it just is not final.
  if (r.status === 'Pending confirmation') return false;
  return isProcurementType(r.type)
    ? r.status === 'Cancelled' || r.status === 'Returned'
    : !countsTowardBalance(r.status as LinkedApplicationStatus);
}

/** In the return's (the PO's) currency, with its symbol: £30.23 (app/currency/money.ts). */
function formatMoney(amount: number, currency: string) {
  return moneyIn(amount, currency);
}

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function formatHumanDate(iso: string) {
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  const mi = parseInt(m, 10) - 1;
  return `${MONTH_SHORT[mi] || m} ${parseInt(d, 10)}, ${y}`;
}

type ChipFilter = 'all' | GroupType;

/** The paperwork on one row: a count that opens the list, each file opening
 *  the same preview the Attachments tab uses. A document with nothing behind
 *  it says so rather than showing a zero. */
function RecordFilesCell({
  record,
  onOpen,
}: {
  record: LinkedFinancialRecord;
  onOpen: (file: RecordFile) => void;
}) {
  const files = filesForRecord(record);
  if (files.length === 0) {
    return <span className="text-muted-foreground/50 text-[11px]">None</span>;
  }
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-600 transition-colors hover:border-primary/30 hover:text-primary"
          style={{ fontWeight: 600 }}
          aria-label={`${files.length} files on ${record.reference}`}
        >
          <Paperclip className="w-3 h-3" />
          {files.length}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-[300px] p-0 z-[300]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-border px-3 py-2">
          <p className="text-[12px] text-foreground" style={{ fontWeight: 600 }}>
            {record.reference}
          </p>
          <p className="text-[11px] text-slate-500">
            {files.length} {files.length === 1 ? 'file' : 'files'} on this {record.type.toLowerCase()}
          </p>
        </div>
        <div className="flex flex-col py-1">
          {files.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => onOpen(f)}
              className="flex items-center gap-2 px-3 py-1.5 text-left transition-colors hover:bg-slate-50"
            >
              <span className="flex w-6 h-6 shrink-0 items-center justify-center rounded-md bg-slate-100 text-[10px] uppercase text-slate-500" style={{ fontWeight: 700 }}>
                {f.kind}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[11px] text-foreground" style={{ fontWeight: 600 }}>
                  {f.data.fileName}
                </span>
                <span className="block text-[10px] text-slate-500">
                  {f.data.fileSize} · {f.data.uploadedBy}
                </span>
              </span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function LinkedRecordsTab({
  invoice,
  records,
  rma,
}: {
  invoice: Invoice;
  records: LinkedFinancialRecord[];
  /** Retained for API compatibility with the detail page; reconciliation now
   *  lives in the right-rail summary, so the tab no longer renders KPIs. */
  totalAmount?: number;
  /** Present when the tab is rendered for a return, which swaps the
   *  balance-oriented copy for return vocabulary. */
  rma?: RMA;
}) {
  const isRma = !!rma;
  const [activeChip, setActiveChip] = useState<ChipFilter>('all');
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  /** A file opened from a row, in the preview the Attachments tab uses. */
  const [preview, setPreview] = useState<RecordFile | null>(null);
  const toggle = (key: string) => setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));

  const openRecord = (r: LinkedFinancialRecord) => {
    const meta = GROUP_META[r.type];
    if (meta.href) {
      window.location.href = meta.href;
      return;
    }
    toast.info(`${r.type} details`, { description: `${r.type} page coming soon.` });
  };

  // ── Search narrows the full record set before grouping. ──
  const filteredRecords = useMemo(() => {
    if (!query.trim()) return records;
    const q = query.trim().toLowerCase();
    return records.filter(
      (r) =>
        r.reference.toLowerCase().includes(q)
        || r.description.toLowerCase().includes(q)
        || r.status.toLowerCase().includes(q)
        || r.createdBy.toLowerCase().includes(q)
        || r.type.toLowerCase().includes(q)
        || r.amount.toFixed(2).includes(q)
        || String(Math.round(r.amount)).includes(q)
        // The part is how somebody looks for the document: "which receipt
        // brought in the pump" is the question this tab is opened with.
        || (r.items ?? []).some(
          (i) =>
            i.sku.toLowerCase().includes(q) || i.description.toLowerCase().includes(q),
        ),
    );
  }, [records, query]);

  // A return's records read in PKR, each at its own rate, with the return's
  // currency tag and its amount on hover (Currency Touchpoints Map,
  // 2026-11-24); the section totals add the PKR figures up.
  const settle = useMemo(() => (rma ? returnSettlementFx(rma) : null), [rma]);
  const fxOf = (r: LinkedFinancialRecord) => (rma && settle ? linkedRecordFx(rma, r, settle) : null);
  const baseOf = (r: LinkedFinancialRecord) => {
    const fx = fxOf(r);
    return fx ? toBase(r.amount, fx.rate) : r.amount;
  };

  // ── Group the (search-filtered) records by type, newest first. ──
  const groups = useMemo(() => {
    return GROUP_ORDER.map((type) => {
      const items = filteredRecords
        .filter((r) => r.type === type)
        .sort((a, b) => b.date.localeCompare(a.date));
      const total = Math.round(
        items.reduce((s, r) => s + (!isExcludedRow(r) ? baseOf(r) : 0), 0) * 100,
      ) / 100;
      return { type, items, total };
    }).filter((g) => g.items.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredRecords, settle]);

  // Type pills — counts come from the unfiltered set so they stay stable
  // while searching.
  const counts = {
    all: records.length,
    ...(Object.fromEntries(
      GROUP_ORDER.map((t) => [t, records.filter((r) => r.type === t).length]),
    ) as Record<GroupType, number>),
  } as Record<ChipFilter, number>;

  // A type only earns a pill once it has a record. Without this an RMA — which
  // never carries prepayments or receiving documents — showed three pills stuck
  // at 0 that could not be filtered to anything.
  const chips: Array<{ key: ChipFilter; label: string }> = [
    { key: 'all', label: 'All' },
    { key: 'Purchase Order', label: 'Purchase Orders' },
    { key: 'Receiving Document', label: 'Receiving Documents' },
    { key: 'Vendor Invoice', label: 'Vendor Invoices' },
    { key: 'Prepayment', label: 'Prepayments' },
    { key: 'Payment', label: 'Payments' },
    { key: 'Credit Memo', label: 'Credit Memos' },
    { key: 'Picking Document', label: 'Picking Documents' },
    { key: 'Shipping Document', label: 'Shipping Documents' },
    { key: 'Reversal', label: 'Reversals' },
    { key: 'Unlinked', label: 'Unlinked Stock' },
  ].filter((c) => c.key === 'all' || counts[c.key as ChipFilter] > 0) as Array<{ key: ChipFilter; label: string }>;

  const visibleGroups = activeChip === 'all' ? groups : groups.filter((g) => g.type === activeChip);
  const resultCount = visibleGroups.reduce((s, g) => s + g.items.length, 0);

  if (records.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-white py-6">
        <EmptyState
          icon={Link2}
          title="No linked records yet"
          description={isRma
            ? 'The order and receipt these goods came in on, what was billed and paid for them, and everything this return raises as it ships and settles will appear here.'
            : 'Purchase orders, receiving documents, prepayments, payments, and credit memos linked to this invoice will appear here.'}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3" role="region" aria-label="Linked Records">
      {/* ── Toolbar card — search + type pills. ── */}
      <div className="border border-border rounded-xl bg-card overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70 pointer-events-none" />
              <input
                placeholder="Search item, type, ref, status, creator…"
                className="w-full pl-9 pr-8 h-9 text-sm rounded-lg border bg-white border-border/80 shadow-sm placeholder:text-muted-foreground/50 outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 transition-shadow"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  aria-label="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <button
              onClick={() => toast.info('Advanced filters', { description: 'Date range, status, and amount filters coming soon.' })}
              className="inline-flex items-center justify-center h-9 gap-1.5 px-3 rounded-lg border bg-white shadow-sm hover:bg-muted/50 transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring/50 shrink-0 text-foreground border-border/80"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-sm hidden md:inline" style={{ fontWeight: 500 }}>Filters</span>
            </button>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-sm tabular-nums hidden sm:inline" style={{ fontWeight: 500 }}>
              <span className="text-foreground">{resultCount}</span>
              <span className="text-muted-foreground/70"> record{resultCount !== 1 ? 's' : ''}</span>
            </span>
          </div>
        </div>

        {/* Type filter pills. They wrap rather than scroll: a return carries
            ten kinds of record now, and the last of them sat off the right
            edge of a row nobody knew could be scrolled. */}
        <div className="flex flex-wrap items-center gap-1.5 px-4 pb-3">
          {chips.map((chip) => {
            const isActive = activeChip === chip.key;
            return (
              <button
                key={chip.key}
                onClick={() => setActiveChip(chip.key)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
                    ? 'border-primary bg-accent'
                    : 'border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-muted-foreground/30'
                }`}
                style={isActive ? { color: 'hsl(var(--primary))', fontWeight: 500 } : { fontWeight: 400 }}
              >
                {chip.label}
                <span
                  className={`text-[10px] tabular-nums rounded-full px-1.5 py-px min-w-[18px] text-center ${
                    isActive ? 'bg-primary/10' : 'bg-muted'
                  }`}
                  style={{
                    color: isActive ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                    fontWeight: 600,
                  }}
                >
                  {counts[chip.key]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Section cards — one collapsible card per record type. ── */}
      {visibleGroups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white py-2">
          {/* Module-standard empty state (EmptyState component, 7/15/26). */}
          <EmptyState
            icon={Search}
            title="No matching records"
            description="No records match the current search or filter."
          />
        </div>
      ) : (
        visibleGroups.map(({ type, items, total }) => {
          const meta = GROUP_META[type];
          const Icon = meta.icon;
          const open = collapsed[type] !== true;
          return (
            <div
              key={type}
              className="border border-border rounded-xl bg-card overflow-hidden"
              style={{ boxShadow: '0 1px 2px 0 rgba(0,0,0,0.03)' }}
            >
              <button
                type="button"
                onClick={() => toggle(type)}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 bg-[#fafbfc] hover:bg-[#f4f6f9] transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30"
                style={{ borderBottom: open ? '1px solid #EEF2F6' : 'none' }}
                aria-expanded={open}
                aria-controls={`linked-${type}`}
              >
                <div
                  className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 border"
                  style={{ backgroundColor: meta.chipBg, color: meta.chipText, borderColor: meta.chipBorder }}
                >
                  <Icon className="w-4 h-4" aria-hidden="true" />
                </div>
                <span className="text-foreground text-left text-[13px]" style={{ fontWeight: 600 }}>
                  {meta.plural}
                </span>
                <span
                  className="inline-flex items-center justify-center h-5 px-1.5 rounded-full text-[11px] tabular-nums"
                  style={{ backgroundColor: 'hsl(var(--accent))', color: 'hsl(var(--primary))', fontWeight: 600 }}
                >
                  {items.length}
                </span>
                {total > 0 && (
                  <span className="ml-auto text-foreground tabular-nums text-[13px]" style={{ fontWeight: 600 }}>
                    {formatMoney(total, isRma ? BASE_CURRENCY : invoice.currency)}
                  </span>
                )}
                {/* Stock with nothing behind it is a state, not an absence.
                    It has no order and no receipt, so no invoice and no
                    payment can ever exist for it, and somebody reconciling
                    this return needs to be told that rather than left
                    hunting for documents that were never raised. */}
                {type === 'Unlinked' && (
                  <HoverCard openDelay={80} closeDelay={140}>
                    <HoverCardTrigger asChild>
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex h-5 items-center gap-1 rounded-full border border-slate-200 bg-white px-1.5 text-[10px] text-slate-500"
                        style={{ fontWeight: 600 }}
                      >
                        <Info className="w-3 h-3" />
                        Why is this empty?
                      </span>
                    </HoverCardTrigger>
                    <HoverCardContent
                      align="start"
                      sideOffset={8}
                      className="w-[320px] rounded-lg border border-border bg-white p-3.5 shadow-lg"
                    >
                      <p className="text-[12px] text-foreground" style={{ fontWeight: 600 }}>
                        No documents downstream of this stock
                      </p>
                      <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
                        These units have no purchase order and no receiving document behind them,
                        which is what a stocktake count or a migration leaves. Nothing was ordered,
                        so nothing was billed and nothing was paid: there is no invoice and no
                        payment to find. The return still settles, it simply unwinds nothing.
                      </p>
                    </HoverCardContent>
                  </HoverCard>
                )}
                <ChevronDown
                  className={`w-4 h-4 text-muted-foreground/60 shrink-0 transition-transform duration-300 ${total > 0 ? 'ml-2.5' : 'ml-auto'}`}
                  style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }}
                  aria-hidden="true"
                />
              </button>

              {open && (
                <div className="overflow-x-auto" id={`linked-${type}`}>
                  <table className="w-full table-fixed text-[12px]">
                    <thead>
                      <tr className="border-b border-border bg-white">
                        {[
                          { col: 'Reference', width: '13%', align: 'text-left', hide: '' },
                          { col: 'Item', width: '23%', align: 'text-left', hide: '' },
                          { col: 'Description', width: '14%', align: 'text-left', hide: 'hidden sm:table-cell' },
                          { col: 'Status', width: '10%', align: 'text-left', hide: '' },
                          { col: 'Date', width: '10%', align: 'text-left', hide: 'hidden md:table-cell' },
                          { col: 'Amount', width: '9%', align: 'text-right', hide: '' },
                          { col: 'Files', width: '8%', align: 'text-left', hide: '' },
                          { col: 'Last Updated By', width: '7%', align: 'text-left', hide: 'hidden lg:table-cell' },
                          { col: 'Created By', width: '7%', align: 'text-left', hide: 'hidden lg:table-cell' },
                        ].map((c) => (
                          <th
                            key={c.col}
                            scope="col"
                            className={`py-2 px-4 text-[11px] text-muted-foreground/60 whitespace-nowrap ${c.align} ${c.hide}`}
                            style={{ width: c.width, fontWeight: 600 }}
                          >
                            {c.col}
                          </th>
                        ))}
                        <th className="w-[4%]"><span className="sr-only">Actions</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((r) => {
                        const s = STATUS_PALETTE[r.status];
                        const excluded = isExcludedRow(r);
                        return (
                          <tr
                            key={r.id}
                            onClick={() => openRecord(r)}
                            className="border-b border-border/70 last:border-b-0 hover:bg-muted/30 transition-colors group cursor-pointer"
                          >
                            <td className="py-2.5 px-4">
                              <span className="flex min-w-0 items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); openRecord(r); }}
                                  className="text-foreground hover:text-primary hover:underline text-[12px] tabular-nums truncate block text-left max-w-full transition-colors"
                                  style={{ fontWeight: 600 }}
                                  aria-label={`Open ${r.reference}`}
                                >
                                  {highlightText(r.reference, query)}
                                </button>
                                {/* The return's currency, on every record with
                                    an amount (2026-11-24): "PO-11233 EUR". */}
                                {isRma && settle?.foreign && r.amount > 0 && (
                                  <span className="shrink-0" onClick={(e) => e.stopPropagation()}>
                                    <CurrencyPill code={invoice.currency} note={`In ${invoice.currency}, the return's currency. The amount reads in ${BASE_CURRENCY}.`} />
                                  </span>
                                )}
                              </span>
                            </td>
                            {/* Which of the lines this document is about.
                                One part named, the rest behind a count that
                                opens on hover: seventeen skus in a cell is a
                                paragraph, and one of them is an answer. */}
                            <td className="py-2.5 px-4">
                              {/* The returns listing's own items cell, so a
                                  part reads the same here as it does on the
                                  list it was found from: the thumbnail with
                                  its master-data hover and quick view, the
                                  part number, and "+N more" opening the rest.
                                  A document about no particular part says so
                                  rather than showing a dash. */}
                              <RMAItemsCell
                                items={(r.items ?? []).map((i) => ({
                                  id: `${r.id}-${i.sku}`,
                                  sku: i.sku,
                                  description: i.description,
                                  unitPrice: i.unitPrice,
                                  uom: i.uom,
                                }))}
                                vendorName={invoice.vendor}
                                empty="Whole return"
                              />
                            </td>
                            <td className="py-2.5 px-4 hidden sm:table-cell">
                              <span className="text-muted-foreground truncate block" title={r.description}>
                                {highlightText(r.description, query)}
                              </span>
                            </td>
                            <td className="py-2.5 px-4">
                              <span
                                className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] border whitespace-nowrap"
                                style={{ fontWeight: 500, backgroundColor: s.bg, color: s.text, borderColor: s.border }}
                              >
                                {/* Display rename 7/15/26 — the PO state reads
                                    "Invoiced", the raw key stays Billed. */}
                                {r.status === 'Billed' ? 'Invoiced' : r.status}
                              </span>
                            </td>
                            <td className="py-2.5 px-4 text-muted-foreground whitespace-nowrap hidden md:table-cell">
                              {formatHumanDate(r.date)}
                            </td>
                            <td className="py-2.5 px-4 text-right">
                              {r.amount > 0 ? (
                                <span
                                  className={`tabular-nums ${excluded ? 'text-slate-400 line-through' : 'text-foreground'}`}
                                  style={{ fontWeight: 600 }}
                                  title={excluded ? (isRma ? 'Excluded from totals, this record no longer counts' : 'Excluded from totals, no longer counts toward the balance') : undefined}
                                >
                                  {isRma ? (
                                    <BaseMoney value={r.amount} currency={invoice.currency} fx={fxOf(r)} role="Return currency" />
                                  ) : (
                                    formatMoney(r.amount, invoice.currency)
                                  )}
                                </span>
                              ) : (
                                // A stray comma sat here, which read as a
                                // number that had lost its digits. An empty
                                // cell says nothing; a dash says there is
                                // nothing to say.
                                <span className="text-slate-300" title="Receiving documents track quantity received, not money">–</span>
                              )}
                            </td>
                            {/* What the document itself carries: its own
                                confirmation, docket or backup. The files hang
                                off the record, so they read on its row rather
                                than in a view of their own. */}
                            <td className="py-2.5 px-4">
                              <RecordFilesCell record={r} onOpen={setPreview} />
                            </td>
                            <td className="py-2.5 px-4 hidden lg:table-cell">
                              <CreatedByCell name={r.updatedBy} vendor={invoice.vendor} density="condensed" />
                            </td>
                            <td className="py-2.5 px-4 hidden lg:table-cell">
                              <CreatedByCell name={r.createdBy} vendor={invoice.vendor} density="condensed" />
                            </td>
                            <td className="py-2.5 px-2">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                  <button
                                    type="button"
                                    className="inline-flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground/60 hover:bg-muted/60 hover:text-foreground transition-colors cursor-pointer opacity-40 group-hover:opacity-100 focus-visible:opacity-100"
                                    aria-label="Row actions"
                                  >
                                    <MoreHorizontal className="w-4 h-4" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-[180px]" onClick={(e) => e.stopPropagation()}>
                                  <DropdownMenuItem onClick={() => openRecord(r)}>
                                    <Eye className="w-4 h-4 mr-2 text-muted-foreground" />
                                    View Details
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => toast.success('Download started', { description: `Downloading ${r.reference} as PDF...` })}
                                  >
                                    <Download className="w-4 h-4 mr-2 text-muted-foreground" />
                                    Download
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })
      )}
    {preview && (
        <AttachmentPreviewModal
          attachment={{
            ...preview.data,
            source: `${preview.record.type} · ${preview.record.reference}`,
          }}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}
