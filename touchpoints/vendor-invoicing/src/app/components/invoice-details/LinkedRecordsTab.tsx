import { TableEmptyState, resolveTableEmptyKind } from '@/app/components/ui/table-empty-state';
import { findSearchSuggestion } from '@/app/utils/searchSuggestion';
import { useMemo, useState } from 'react';
import { formatUsDateTime } from '@/app/lib/dueBucket';
import {
  Wallet,
  Banknote,
  Receipt,
  ShoppingCart,
  PackageCheck,
  Link2,
  Search,
  X,
  ChevronDown,
  SlidersHorizontal,
  MoreHorizontal,
  Eye,
  Download,
  Package,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';
import { Invoice } from '@/app/data/mockInvoices';
import {
  countsTowardBalance,
  isProcurementType,
  type LinkedFinancialRecord,
  type LinkedGroupType as GroupType,
  type LinkedApplicationStatus,
  type LinkedRecordStatus as RecordStatus,
} from '@/app/data/invoiceLinkedRecords';
import { CreatedByCell, highlightAmount, highlightText } from '@/app/components/InvoiceDataTable';
import { formatMoney as formatInCurrency } from '@/app/currency/money';

/** Search highlight for a record's amount (10/9/26): the filter matches the
 *  raw figure ("1250" or "1250.00"), so the digits only mark when that
 *  match really happened, never on a digit run from another field. */
const amountMatches = (amount: number, query: string) => {
  const q = query.trim().toLowerCase();
  return !!q && (amount.toFixed(2).includes(q) || String(Math.round(amount)).includes(q));
};
import { CollapseReveal } from '@/app/components/ui/collapse-reveal';

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
  // Type colors stay unique (user 10/10): teal belongs to Standalone, so
  // receiving reads green; violet is the prepayment identity, payments indigo.
  'Receiving Document': { icon: PackageCheck, plural: 'Receiving Documents', chipBg: '#ECFDF5', chipText: '#047857', chipBorder: '#A7F3D0', href: null },
  Prepayment: { icon: Wallet, plural: 'Prepayments', chipBg: '#F5F3FF', chipText: '#6D28D9', chipBorder: '#DDD6FE', href: '/prepayments' },
  Payment: { icon: Banknote, plural: 'Payments', chipBg: '#EEF2FF', chipText: '#4338CA', chipBorder: '#C7D2FE', href: '/payments-v2' },
  'Credit Memo': { icon: Receipt, plural: 'Credit Memos', chipBg: '#FFFBEB', chipText: '#B45309', chipBorder: '#FDE68A', href: null },
  // Forward reconciliation link (9/2/26): the receiving invoice a settled
  // pre-invoice reconciled into: an INVENTORY invoice, so blue (user 10/10).
  Invoice: { icon: Package, plural: 'Invoices', chipBg: '#EFF6FF', chipText: '#1D4ED8', chipBorder: '#BFDBFE', href: null },
};

// Fixed render order for the section cards — procurement (source) documents
// first, then the financial records applied to the invoice.
const GROUP_ORDER: GroupType[] = ['Purchase Order', 'Receiving Document', 'Prepayment', 'Payment', 'Credit Memo', 'Invoice'];

const STATUS_PALETTE: Record<RecordStatus, { bg: string; text: string; border: string }> = {
  // Financial application statuses
  Applied: { bg: '#ECFDF5', text: '#065F46', border: '#A7F3D0' },
  'Partially Applied': { bg: '#FFFBEB', text: '#92400E', border: '#FDE68A' },
  Reversed: { bg: '#FEF2F2', text: '#991B1B', border: '#FECACA' },
  Returned: { bg: '#FEF2F2', text: '#991B1B', border: '#FECACA' },
  Void: { bg: '#FEF2F2', text: '#991B1B', border: '#FECACA' },
  // Procurement (PO / receiving) statuses
  Confirmed: { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
  'Partially Invoiced': { bg: '#FFFBEB', text: '#92400E', border: '#FDE68A' },
  Billed: { bg: '#ECFDF5', text: '#065F46', border: '#A7F3D0' },
  Closed: { bg: '#F1F5F9', text: '#475569', border: '#E2E8F0' },
  Cancelled: { bg: '#FEF2F2', text: '#991B1B', border: '#FECACA' },
  Received: { bg: '#ECFDF5', text: '#065F46', border: '#A7F3D0' },
  'Partially Received': { bg: '#FFFBEB', text: '#92400E', border: '#FDE68A' },
  Inspected: { bg: '#EEF2FF', text: '#4338CA', border: '#C7D2FE' },
};

// A row is excluded from its group total / shown struck-through when it no
// longer counts. Financial: anything not Applied/Partially applied. Procurement:
// only Cancelled (PO) or Returned (receiving).
function isExcludedRow(r: LinkedFinancialRecord): boolean {
  return isProcurementType(r.type)
    ? r.status === 'Cancelled' || r.status === 'Returned'
    : !countsTowardBalance(r.status as LinkedApplicationStatus);
}

// Each currency with its own symbol and decimals (Currency & Exchange Rates).
const formatMoney = (amount: number, currency: string) => formatInCurrency(amount, currency);

// Linked-record dates show date + time (user 10/7), via the shared
// date-time formatter seeded by the record date.
function formatHumanDate(iso: string) {
  return formatUsDateTime(iso);
}

type ChipFilter = 'all' | GroupType;

export function LinkedRecordsTab({
  invoice,
  records,
  onViewCreditMemo,
}: {
  invoice: Invoice;
  records: LinkedFinancialRecord[];
  /** Retained for API compatibility with the detail page; reconciliation now
   *  lives in the right-rail summary, so the tab no longer renders KPIs. */
  totalAmount?: number;
  /** Opens a credit memo's own page IN-APP (VI-18). A new tab can't see the
   *  session's memo state, so the memo reference routes through the app. */
  onViewCreditMemo?: (creditMemoNumber: string) => void;
}) {
  const [activeChip, setActiveChip] = useState<ChipFilter>('all');
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggle = (key: string) => setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));

  // References open in a NEW TAB (user 10/5): the record page loads
  // fresh while this invoice stays put. Known trade-off (accepted):
  // session-created records won't resolve in a fresh tab; seeds do.
  const recordHref = (r: LinkedFinancialRecord): string | null => {
    // Reconciled pre-invoice rows carry the pre-invoice's own number:
    // link to that invoice, not the prepayments listing. The forward
    // Invoice link (settled pre-invoice → receiving invoice) too.
    if (r.type === 'Invoice' || (r.type === 'Prepayment' && r.reference.startsWith('INV-'))) {
      return `/invoices/${r.reference}`;
    }
    // A real payment or advance record opens ITS page (Eli 9/24 R09),
    // never the generic listing.
    if ((r.type === 'Payment' || r.type === 'Prepayment') && /^(PMT|PRE)-/.test(r.reference)) {
      return `/payments-v2/${encodeURIComponent(r.reference)}`;
    }
    // Credit memos open their own page IN-APP (VI-18): a fresh tab can't
    // see the session's memo state, so the row routes through the app
    // handler instead of window.open'ing a URL that resolves to the list.
    if (r.type === 'Credit Memo') return onViewCreditMemo ? 'credit-memo' : null;
    // POs and receivings belong to other modules that aren't wired to this
    // prototype — the old links opened one fixed record (po-10) or an empty
    // Receiving search (VI-24). Until those pages resolve a reference, the
    // number stays plain text rather than a link to the wrong record.
    return null;
  };

  const openRecord = (r: LinkedFinancialRecord) => {
    if (r.type === 'Credit Memo') { onViewCreditMemo?.(r.reference); return; }
    const href = recordHref(r);
    if (href && href !== 'credit-memo') window.open(href, '_blank', 'noopener,noreferrer');
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
        || String(Math.round(r.amount)).includes(q),
    );
  }, [records, query]);

  // ── Group the (search-filtered) records by type, newest first. ──
  const groups = useMemo(() => {
    return GROUP_ORDER.map((type) => {
      const items = filteredRecords
        .filter((r) => r.type === type)
        .sort((a, b) => b.date.localeCompare(a.date));
      const total = items.reduce(
        (s, r) => s + (!isExcludedRow(r) ? r.amount : 0),
        0,
      );
      return { type, items, total };
    }).filter((g) => g.items.length > 0);
  }, [filteredRecords]);

  // Type pills — counts come from the unfiltered set so they stay stable
  // while searching.
  const counts: Record<ChipFilter, number> = {
    all: records.length,
    'Purchase Order': records.filter((r) => r.type === 'Purchase Order').length,
    'Receiving Document': records.filter((r) => r.type === 'Receiving Document').length,
    Prepayment: records.filter((r) => r.type === 'Prepayment').length,
    Payment: records.filter((r) => r.type === 'Payment').length,
    'Credit Memo': records.filter((r) => r.type === 'Credit Memo').length,
    Invoice: records.filter((r) => r.type === 'Invoice').length,
  };

  const chips: Array<{ key: ChipFilter; label: string }> = [
    { key: 'all', label: 'All' },
    { key: 'Purchase Order', label: 'Purchase Orders' },
    { key: 'Receiving Document', label: 'Receiving Documents' },
    { key: 'Prepayment', label: 'Prepayments' },
    { key: 'Payment', label: 'Payments' },
    { key: 'Credit Memo', label: 'Credit Memos' },
    ...(counts.Invoice > 0 ? [{ key: 'Invoice' as const, label: 'Invoices' }] : []),
  ];

  const visibleGroups = activeChip === 'all' ? groups : groups.filter((g) => g.type === activeChip);
  const resultCount = visibleGroups.reduce((s, g) => s + g.items.length, 0);

  if (records.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-white">
        {/* Table Empty & Error States Standard (11/3/26), compact in a tab. */}
        <TableEmptyState
          compact
          kind="no-data"
          entity={{ singular: 'linked record', plural: 'linked records' }}
          title="No linked records yet"
          description="Purchase orders, receiving documents, prepayments, payments, and credit memos linked to this invoice will appear here."
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
                placeholder="Search type, ref, status, creator…"
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
            <span className="text-sm hidden sm:inline" style={{ fontWeight: 500 }}>
              <span className="text-foreground">{resultCount}</span>
              <span className="text-muted-foreground/70"> record{resultCount !== 1 ? 's' : ''}</span>
            </span>
          </div>
        </div>

        {/* Type filter pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto px-4 pb-3">
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
                  className={`text-[10px] rounded-full px-1.5 py-px min-w-[18px] text-center ${
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
        <div className="rounded-xl border border-border bg-white">
          {/* Table Empty & Error States Standard (11/3/26): the type pill
              counts as a filter when it isn't All. */}
          <TableEmptyState
            compact
            kind={resolveTableEmptyKind({ totalCount: records.length, filteredCount: 0, searchQuery: query, filterCount: activeChip === 'all' ? 0 : 1 }) ?? 'no-filter-results'}
            entity={{ singular: 'linked record', plural: 'linked records' }}
            searchQuery={query}
            suggestion={query.trim() ? findSearchSuggestion(query, records.flatMap((r) => [r.reference, r.description, r.status, r.createdBy, r.type])) : null}
            onApplySuggestion={setQuery}
            filterCount={activeChip === 'all' ? 0 : 1}
            onClearSearch={() => setQuery('')}
            onClearFilters={() => setActiveChip('all')}
            onClearAll={() => { setQuery(''); setActiveChip('all'); }}
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
                  {/* Record type is searchable, so the section title marks the hit (10/9/26). */}
                  {query.trim() && type.toLowerCase().includes(query.trim().toLowerCase()) ? highlightText(meta.plural, query) : meta.plural}
                </span>
                <span
                  className="inline-flex items-center justify-center h-5 px-1.5 rounded-full text-[11px] "
                  style={{ backgroundColor: 'hsl(var(--accent))', color: 'hsl(var(--primary))', fontWeight: 600 }}
                >
                  {items.length}
                </span>
                {total > 0 && (
                  <span className="ml-auto text-foreground text-[13px]" style={{ fontWeight: 600 }}>
                    {formatMoney(total, invoice.currency)}
                  </span>
                )}
                <ChevronDown
                  className={`w-4 h-4 text-muted-foreground/60 shrink-0 transition-transform duration-300 ${total > 0 ? 'ml-2.5' : 'ml-auto'}`}
                  style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }}
                  aria-hidden="true"
                />
              </button>

              <CollapseReveal open={open}>
                <div className="overflow-x-auto" id={`linked-${type}`}>
                  <table className="w-full table-fixed text-[12px]">
                    <thead>
                      <tr className="border-b border-border bg-white">
                        {[
                          { col: 'Reference', width: '15%', align: 'text-left', hide: '' },
                          { col: 'Description', width: '23%', align: 'text-left', hide: 'hidden sm:table-cell' },
                          { col: 'Status', width: '12%', align: 'text-left', hide: '' },
                          { col: 'Date', width: '12%', align: 'text-left', hide: 'hidden md:table-cell' },
                          { col: 'Amount', width: '12%', align: 'text-right', hide: '' },
                          { col: 'Last Updated By', width: '13%', align: 'text-left', hide: 'hidden lg:table-cell' },
                          { col: 'Created By', width: '13%', align: 'text-left', hide: 'hidden lg:table-cell' },
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
                        const linked = recordHref(r) !== null;
                        return (
                          <tr
                            key={r.id}
                            onClick={() => openRecord(r)}
                            className={`border-b border-border/70 last:border-b-0 hover:bg-muted/30 transition-colors group ${linked ? 'cursor-pointer' : 'cursor-default'}`}
                          >
                            <td className="py-2.5 px-4">
                              {linked ? (
                                /* Black at rest, blue + underline on hover,
                                   NO icon (user 10/5, supersedes 10/4's
                                   blue-with-glyph): the code itself is the
                                   link and opens in a new tab. */
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); openRecord(r); }}
                                  className="max-w-full text-foreground hover:text-primary hover:underline underline-offset-2 text-[12px] truncate block text-left transition-colors cursor-pointer"
                                  style={{ fontWeight: 600 }}
                                  aria-label={`Open ${r.reference} in a new tab`}
                                >
                                  {highlightText(r.reference, query)}
                                </button>
                              ) : (
                                <span className="text-foreground text-[12px] truncate block max-w-full" style={{ fontWeight: 600 }}>
                                  {highlightText(r.reference, query)}
                                </span>
                              )}
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
                                  className={`${excluded ? 'text-slate-400 line-through' : 'text-foreground'}`}
                                  style={{ fontWeight: 600 }}
                                  title={excluded ? 'Excluded from totals, no longer counts toward the balance' : undefined}
                                >
                                  {amountMatches(r.amount, query)
                                    ? highlightAmount(formatMoney(r.amount, invoice.currency), query)
                                    : formatMoney(r.amount, invoice.currency)}
                                </span>
                              ) : null}
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
                                  {/* Named for what opens (Nophil 9/28) —
                                      matches the Payments tab's specific
                                      "View payment" / "View credit memo". */}
                                  {linked && (
                                    <DropdownMenuItem onClick={() => openRecord(r)}>
                                      <Eye className="w-4 h-4 mr-2 text-muted-foreground" />
                                      {r.type === 'Credit Memo'
                                        ? 'View Credit Memo'
                                        : r.type === 'Payment'
                                          ? 'View Payment'
                                          : r.type === 'Prepayment'
                                            ? (r.reference.startsWith('INV-') ? 'View Pre-Invoice' : 'View Prepayment')
                                            : r.type === 'Invoice'
                                              ? 'View Invoice'
                                              : r.type === 'Purchase Order'
                                                ? 'View Purchase Order'
                                                : r.type === 'Receiving Document'
                                                  ? 'View Receiving'
                                                  : 'View Details'}
                                    </DropdownMenuItem>
                                  )}
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
              </CollapseReveal>
            </div>
          );
        })
      )}
    </div>
  );
}
