import { useState, useRef, useEffect } from 'react';
import {
  ExternalLink, ChevronDown,
  FileText, ShoppingCart, Truck, CreditCard, RotateCcw,
  Link2, Banknote, X, Calendar, User
} from 'lucide-react';
import { toast } from 'sonner';
import { SearchInput } from '../shared/SearchInput';
import { FiltersButton } from '../shared/FiltersButton';
import {
  FilterModalShell,
  Pill as FilterModalPill,
  Section as FilterModalSection,
  Divider as FilterModalDivider,
} from '../shared/filterModal';
import { NumberPill } from '../shared/NumberPill';
import { Avatar } from '../shared/Avatar';
import { FilterPill } from '../shared/FilterPill';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/app/components/ui/tooltip';
import { InfoTooltip } from '@/app/components/ui/info-tooltip';
import { EmptyPlaceholder } from '../shared/EmptyPlaceholder';
import { useDocWhole } from '@/app/components/currency/docCurrencyContext';

/* ── Column-header tooltip — Partner v7 parity.
   Portal-rendered so the popover escapes the section's `overflow:hidden`
   container instead of clipping and forcing a scrollbar. The trigger is
   wrapped in a `justify-self: start` cell so the dashed underline hugs
   the label text instead of stretching across the full grid column
   (which would happen by default since grid items stretch). Translucent
   white card + slate copy matches the Partner tooltip primitive. */
function ColumnHeaderTooltip({ label, tooltip, align = 'start' }: { label: string; tooltip: string; align?: 'start' | 'end' }) {
  return (
    <div style={{ justifySelf: align, display: 'inline-flex' }}>
      <TooltipProvider delayDuration={400}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className="cursor-default border-b border-dashed border-foreground/15"
              style={{ fontSize: '11px', fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'none', lineHeight: '1' }}
            >
              {label}
            </span>
          </TooltipTrigger>
          <TooltipContent
            side="bottom"
            sideOffset={6}
            className="bg-white/95 backdrop-blur-md text-slate-700 border border-border/80 rounded-xl px-3.5 py-2.5 text-[11px] leading-relaxed max-w-[260px] z-[300]"
            style={{ boxShadow: '0 8px 32px -8px rgba(0,0,0,0.12), 0 4px 12px -4px rgba(0,0,0,0.05)' }}
          >
            {tooltip}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

// ── Types ──────────────────────────────────────────────────────────
type TransactionType = 'sales-order' | 'invoice' | 'payment' | 'delivery' | 'return' | 'credit-memo';
type TransactionStatus = 'draft' | 'confirmed' | 'in-progress' | 'completed' | 'cancelled' | 'partial' | 'overdue' | 'pending';

interface LinkedTransaction {
  id: string;
  type: TransactionType;
  number: string;
  title: string;
  status: TransactionStatus;
  createdDate: string;
  dueDate?: string;
  total: number;
  lineItemCount: number;
  assignee: string;
  assigneeInitials: string;
  notes?: string;
  parentId?: string;
  parentNumber?: string;
}

// ── Config ─────────────────────────────────────────────────────────
const TYPE_CONFIG: Record<TransactionType, { label: string; pluralLabel: string; icon: any; color: string; bg: string }> = {
  'sales-order': { label: 'Sales Order', pluralLabel: 'Sales Orders', icon: ShoppingCart, color: 'var(--primary)', bg: 'var(--accent)' },
  'invoice': { label: 'Invoice', pluralLabel: 'Invoices', icon: FileText, color: 'var(--success)', bg: 'rgba(5, 150, 105, 0.2)' },
  'payment': { label: 'Payment Receipt', pluralLabel: 'Payment Receipts', icon: Banknote, color: 'var(--success)', bg: 'rgba(5, 150, 105, 0.2)' },
  'delivery': { label: 'Shipment', pluralLabel: 'Shipments', icon: Truck, color: 'var(--warning)', bg: 'rgba(217, 119, 6, 0.2)' },
  'return': { label: 'Return', pluralLabel: 'Returns', icon: RotateCcw, color: 'var(--destructive)', bg: 'rgba(220, 38, 38, 0.2)' },
  'credit-memo': { label: 'Credit Memo', pluralLabel: 'Credit Memos', icon: CreditCard, color: 'var(--primary)', bg: 'var(--accent)' },
};

const STATUS_CONFIG: Record<TransactionStatus, { label: string; color: string; bg: string }> = {
  'draft': { label: 'Draft', color: 'var(--foreground)', bg: 'var(--muted)' },
  'confirmed': { label: 'Confirmed', color: 'var(--primary)', bg: 'var(--accent)' },
  'in-progress': { label: 'In Progress', color: 'var(--warning)', bg: 'rgba(217, 119, 6, 0.2)' },
  'completed': { label: 'Completed', color: 'var(--success)', bg: 'rgba(5, 150, 105, 0.2)' },
  'cancelled': { label: 'Cancelled', color: 'var(--destructive)', bg: 'rgba(220, 38, 38, 0.2)' },
  'partial': { label: 'Partial', color: '#9A3412', bg: '#FED7AA' },
  'overdue': { label: 'Overdue', color: 'var(--destructive)', bg: 'rgba(220, 38, 38, 0.2)' },
  'pending': { label: 'Pending', color: 'var(--warning)', bg: 'rgba(217, 119, 6, 0.2)' },
};

// ── Mock Data ─────────────────────────────────────────────────────
/* Linked-transaction model for a Quote
   ────────────────────────────────────
   A Quote can ONLY ever link to a Sales Order — and only the one it
   was converted into. Invoices, Payment Receipts, Shipments and Credit
   Memos all live one layer deeper: they belong to the SO, not the
   Quote. Surfacing them here would advertise downstream artifacts the
   quote itself has no claim on.

   The "linked SO" row is built lazily from the current quote's number,
   customer and total via `buildLinkedSO()` below, so the data stays
   in lockstep with whichever quote you opened. */
function buildLinkedSO(opts: {
  quoteNumber: string;
  customerName: string;
  total: number;
  lineItemCount: number;
}): LinkedTransaction {
  // Derive the SO number from the quote number: Q-2026-0142 → SO-2026-0142.
  const soNumber = opts.quoteNumber.replace(/^Q-/i, 'SO-');
  return {
    id: `SO-FROM-${opts.quoteNumber}`,
    type: 'sales-order',
    number: soNumber,
    title: `${opts.customerName} — Converted from ${opts.quoteNumber}`,
    status: 'confirmed',
    createdDate: new Date().toISOString().split('T')[0],
    total: opts.total,
    lineItemCount: opts.lineItemCount,
    assignee: 'Sarah Chen',
    assigneeInitials: 'SC',
    notes: `Auto-converted on quote acceptance. Downstream documents (invoices, shipments, payments) live on ${soNumber}, not here.`,
  };
}

// ── Helpers ────────────────────────────────────────────────────────
/* Amounts are in the quote's currency (useDocWhole in each component). */
const formatDateShort = (d: string) => {
  const date = new Date(d + 'T00:00:00');
  return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}/${date.getFullYear()}`;
};

const getAvatarColor = (initials: string) => {
  const colors = [
    { bg: 'rgba(217, 119, 6, 0.3)', text: 'var(--warning)' },
    { bg: 'var(--accent)', text: 'var(--primary)' },
    { bg: '#FED7AA', text: '#9A3412' },
    { bg: '#C7D2FE', text: 'var(--primary)' },
    { bg: '#FCA5A5', text: 'var(--destructive)' },
    { bg: 'rgba(5, 150, 105, 0.2)', text: 'var(--success)' },
  ];
  const hash = initials.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return colors[hash % colors.length];
};

// ── Table grid ─────────────────────────────────────────────────────
const TABLE_GRID = 'minmax(80px,110px) minmax(140px,1fr) 90px 80px 90px 16px 80px 28px';

// ── Component ──────────────────────────────────────────────────────
interface TransactionsTabProps {
  quoteNumber?: string;
  customerName?: string;
  readOnly?: boolean;
  /** Quote lifecycle status. A Quote shows a linked Sales Order ONLY
   *  once it's been converted; before that there's nothing downstream
   *  to point at. Other downstream artefacts (invoices, payments,
   *  shipments, credit memos) belong to the SO, not the Quote. */
  quoteStatus?: string;
  /** Snapshot of the quote totals used to mirror into the linked-SO
   *  row when conversion has happened. Falls back to demo values. */
  quoteTotal?: number;
  quoteLineItemCount?: number;
  isNewlyCreated?: boolean;
}

export function TransactionsTab({
  quoteNumber = 'Q-2026-0142',
  customerName = 'Tri-County EMS Authority',
  readOnly = false,
  quoteStatus,
  quoteTotal = 81275,
  quoteLineItemCount = 5,
  isNewlyCreated = false,
}: TransactionsTabProps) {
  const formatCurrency = useDocWhole();
  /* A Quote can only legitimately show a linked Sales Order, and only
     after it's been converted. Everything else (invoices, shipments,
     payments, credit memos) belongs to the SO, so it's excluded here.
     Draft / Sent / Confirmed quotes show an empty state. */
  const isConverted = quoteStatus === 'converted';
  const isConfirmed = quoteStatus === 'confirmed';
  const RAW_TRANSACTIONS: LinkedTransaction[] = isConverted || isConfirmed
    ? [
        buildLinkedSO({
          quoteNumber,
          customerName,
          total: quoteTotal,
          lineItemCount: quoteLineItemCount,
        }),
      ]
    : [];
  /* Stage gating:
     - draft / sent: hide SO, shipment, invoice, payment, credit-memo, return rows
     - confirmed: show SO rows only (customer confirmed)
     - converted: show everything (most data-rich)
     - cancelled / archived / expired: show everything that existed */
  const EFFECTIVE_TRANSACTIONS: LinkedTransaction[] = (() => {
    if (quoteStatus === 'draft' || quoteStatus === 'sent') return [];
    if (isConfirmed) return RAW_TRANSACTIONS.filter(t => t.type === 'sales-order');
    return RAW_TRANSACTIONS;
  })();
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<TransactionType | 'all'>('all');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<TransactionType>>(new Set());

  /* Advanced filters — staged through the shared `FilterModalShell`.
     Mirrors the listing's `QuoteFiltersModal` chrome exactly so the
     tab feels like the same component. `dateRange` is a single
     bucket (one preset at a time), the others are multi-select. */
  type TxnDateRange = 'any' | 'today' | 'this-week' | 'this-month' | 'older';
  type TxnAdvancedFilters = {
    statuses: TransactionStatus[];
    assignees: string[];
    dateRange: TxnDateRange;
  };
  const EMPTY_TXN_FILTERS: TxnAdvancedFilters = { statuses: [], assignees: [], dateRange: 'any' };
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [txnFilters, setTxnFilters] = useState<TxnAdvancedFilters>(EMPTY_TXN_FILTERS);
  const { statuses: statusFilters, assignees: assigneeFilters, dateRange: dateRangeFilter } = txnFilters;

  // Unique assignees from data
  const allAssignees = Array.from(new Set(EFFECTIVE_TRANSACTIONS.map(t => t.assignee)));
  const allStatuses: TransactionStatus[] = ['draft', 'confirmed', 'in-progress', 'completed', 'pending', 'cancelled', 'partial', 'overdue'];
  const usedStatuses = allStatuses.filter(s => EFFECTIVE_TRANSACTIONS.some(t => t.status === s));

  const countTxnFilters = (f: TxnAdvancedFilters) =>
    f.statuses.length + f.assignees.length + (f.dateRange !== 'any' ? 1 : 0);
  const activeFilterCount = countTxnFilters(txnFilters);

  const toggleGroup = (type: TransactionType) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  /* Pure predicate so the listing pipeline and the FilterModalShell's
     preview count call the same matcher. */
  const matchesDateBucket = (dateStr: string, bucket: TxnDateRange) => {
    if (bucket === 'any') return true;
    const d = new Date(dateStr + 'T00:00:00');
    const now = new Date('2026-02-19T00:00:00');
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    switch (bucket) {
      case 'today': return d.toDateString() === now.toDateString();
      case 'this-week': return d >= startOfWeek && d <= now;
      case 'this-month': return d >= startOfMonth && d <= now;
      case 'older': return d < startOfMonth;
      default: return true;
    }
  };
  const txnMatchesAdvanced = (t: LinkedTransaction, f: TxnAdvancedFilters) => {
    if (f.statuses.length > 0 && !f.statuses.includes(t.status)) return false;
    if (f.assignees.length > 0 && !f.assignees.includes(t.assignee)) return false;
    if (!matchesDateBucket(t.createdDate, f.dateRange)) return false;
    return true;
  };

  // Payment-related transaction types are temporarily hidden behind a
  // Coming Soon panel. The data + render branches are kept in the file
  // (just filtered out at the source) so they can be reinstated by
  // removing this constant.
  const HIDDEN_TXN_TYPES = new Set<TransactionType>(['invoice', 'payment', 'credit-memo']);

  // Filter transactions
  const filteredTxns = EFFECTIVE_TRANSACTIONS.filter(txn => {
    if (HIDDEN_TXN_TYPES.has(txn.type)) return false;
    const q = searchQuery.toLowerCase();
    const matchesSearch = !searchQuery ||
      txn.number.toLowerCase().includes(q) ||
      txn.title.toLowerCase().includes(q) ||
      txn.assignee.toLowerCase().includes(q);
    const matchesType = typeFilter === 'all' || txn.type === typeFilter;
    return matchesSearch && matchesType && txnMatchesAdvanced(txn, txnFilters);
  });

  // Group by type
  const grouped = filteredTxns.reduce((acc, txn) => {
    if (!acc[txn.type]) acc[txn.type] = [];
    acc[txn.type].push(txn);
    return acc;
  }, {} as Record<TransactionType, LinkedTransaction[]>);

  const groupOrder: TransactionType[] = ['sales-order', 'invoice', 'delivery', 'payment', 'credit-memo', 'return'];
  const totalCount = filteredTxns.length;
  const totalValue = filteredTxns.reduce((sum, t) => sum + t.total, 0);

  /* Newly-created quotes never have any linked transactions yet, show a
     single empty-state card and skip the rest of the tab UI. Placed
     AFTER every hook so React sees the same hook order on every render. */
  if (isNewlyCreated) {
    return (
      <div style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
        <EmptyPlaceholder
          block
          icon={Link2}
          title="No linked transactions yet"
          description="Other Omne records that reference this quote will appear here, including the converted sales order, procurement orders, shipments, invoices, returns, and credit memos."
        />
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* ── Toolbar card, Partner white-card chrome ─────────────────────────────── */}
      <div style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '12px',
        border: '1px solid var(--border)',
        overflow: 'visible',
        position: 'relative',
        zIndex: 5,
        boxShadow: '0 1px 2px 0 rgba(15, 23, 42, 0.04), 0 1px 3px 0 rgba(15, 23, 42, 0.04)',
      }}>
        {/* Row 1: Search + Filters button | Summary + Action buttons */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', gap: '12px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search transactions..."
              widthClassName="w-[260px] shrink-0"
            />

            {/* Filter trigger — opens the shared FilterModalShell so this
                surface looks and behaves identically to the listing
                FiltersModal (Dialog + staged-apply + Show N CTA). */}
            <FiltersButton
              count={activeFilterCount}
              active={showFilterModal}
              onClick={() => setShowFilterModal(true)}
            />
            <FilterModalShell<TxnAdvancedFilters>
              open={showFilterModal}
              onOpenChange={setShowFilterModal}
              applied={txnFilters}
              empty={EMPTY_TXN_FILTERS}
              onApply={(next) => setTxnFilters(next)}
              countActive={countTxnFilters}
              getDraftMatchCount={(draft) => EFFECTIVE_TRANSACTIONS.filter(t => !HIDDEN_TXN_TYPES.has(t.type) && txnMatchesAdvanced(t, draft)).length}
              itemLabel="transaction"
              itemLabelPlural="transactions"
            >
              {({ draft, update, toggleMulti }) => (
                <>
                  <FilterModalSection title="Status" subtitle="Filter by where each transaction currently sits.">
                    <div className="flex flex-wrap gap-1.5">
                      <FilterModalPill
                        label="Any"
                        selected={draft.statuses.length === 0}
                        onClick={() => update('statuses', [])}
                      />
                      {usedStatuses.map(s => (
                        <FilterModalPill
                          key={s}
                          label={STATUS_CONFIG[s].label}
                          selected={draft.statuses.includes(s)}
                          onClick={() => toggleMulti('statuses', s)}
                          count={EFFECTIVE_TRANSACTIONS.filter(t => !HIDDEN_TXN_TYPES.has(t.type) && t.status === s).length}
                        />
                      ))}
                    </div>
                  </FilterModalSection>
                  <FilterModalDivider />
                  <FilterModalSection title="Date range" subtitle="Filter by when each transaction was created.">
                    <div className="flex flex-wrap gap-1.5">
                      {([
                        { key: 'any', label: 'Any time' },
                        { key: 'today', label: 'Today' },
                        { key: 'this-week', label: 'This week' },
                        { key: 'this-month', label: 'This month' },
                        { key: 'older', label: 'Older' },
                      ] as { key: TxnDateRange; label: string }[]).map(opt => (
                        <FilterModalPill
                          key={opt.key}
                          label={opt.label}
                          selected={draft.dateRange === opt.key}
                          onClick={() => update('dateRange', opt.key)}
                        />
                      ))}
                    </div>
                  </FilterModalSection>
                  <FilterModalDivider />
                  <FilterModalSection title="Created by" subtitle="Filter by who originated the transaction.">
                    <div className="flex flex-wrap gap-1.5">
                      <FilterModalPill
                        label="Everyone"
                        selected={draft.assignees.length === 0}
                        onClick={() => update('assignees', [])}
                      />
                      {allAssignees.map(name => (
                        <FilterModalPill
                          key={name}
                          label={name}
                          selected={draft.assignees.includes(name)}
                          onClick={() => toggleMulti('assignees', name)}
                          count={EFFECTIVE_TRANSACTIONS.filter(t => !HIDDEN_TXN_TYPES.has(t.type) && t.assignee === name).length}
                        />
                      ))}
                    </div>
                  </FilterModalSection>
                </>
              )}
            </FilterModalShell>

            {/* Active filter chips — one per selected value in the
                applied advanced filter set. */}
            {activeFilterCount > 0 && (
              <>
                <div style={{ width: '1px', height: '20px', backgroundColor: 'var(--border)', flexShrink: 0 }} />
                {statusFilters.map(s => (
                  <span key={`st-${s}`} style={{
                    display: 'flex', alignItems: 'center', gap: '4px', height: '24px', padding: '0 6px 0 8px',
                    fontSize: '11px', fontWeight: 500, color: 'var(--primary)', backgroundColor: 'var(--accent)',
                    borderRadius: '6px', whiteSpace: 'nowrap', lineHeight: '1',
                  }}>
                    {STATUS_CONFIG[s].label}
                    <button onClick={() => setTxnFilters(prev => ({ ...prev, statuses: prev.statuses.filter(x => x !== s) }))} style={{ width: '14px', height: '14px', borderRadius: '3px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                      <X style={{ width: '10px', height: '10px', color: 'var(--primary)' }} />
                    </button>
                  </span>
                ))}
                {dateRangeFilter !== 'any' && (
                  <span style={{
                    display: 'flex', alignItems: 'center', gap: '4px', height: '24px', padding: '0 6px 0 8px',
                    fontSize: '11px', fontWeight: 500, color: 'var(--primary)', backgroundColor: 'var(--accent)',
                    borderRadius: '6px', whiteSpace: 'nowrap', lineHeight: '1',
                  }}>
                    {dateRangeFilter === 'today' ? 'Today' : dateRangeFilter === 'this-week' ? 'This Week' : dateRangeFilter === 'this-month' ? 'This Month' : 'Older'}
                    <button onClick={() => setTxnFilters(prev => ({ ...prev, dateRange: 'any' }))} style={{ width: '14px', height: '14px', borderRadius: '3px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                      <X style={{ width: '10px', height: '10px', color: 'var(--primary)' }} />
                    </button>
                  </span>
                )}
                {assigneeFilters.map(a => (
                  <span key={`as-${a}`} style={{
                    display: 'flex', alignItems: 'center', gap: '4px', height: '24px', padding: '0 6px 0 8px',
                    fontSize: '11px', fontWeight: 500, color: 'var(--primary)', backgroundColor: 'var(--accent)',
                    borderRadius: '6px', whiteSpace: 'nowrap', lineHeight: '1',
                  }}>
                    {a}
                    <button onClick={() => setTxnFilters(prev => ({ ...prev, assignees: prev.assignees.filter(x => x !== a) }))} style={{ width: '14px', height: '14px', borderRadius: '3px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                      <X style={{ width: '10px', height: '10px', color: 'var(--primary)' }} />
                    </button>
                  </span>
                ))}
              </>
            )}
          </div>

          {/* Right: Summary + actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            <span style={{ fontSize: '12px', color: 'var(--muted-foreground)', whiteSpace: 'nowrap', lineHeight: '1' }}>
              {totalCount} transaction{totalCount !== 1 ? 's' : ''}
            </span>
            <InfoTooltip side="bottom">
              Links to the documents connected to this Quote across the order-to-cash chain: RFQs, sales orders, shipment documents, invoices, credit memos, and payment receipts. Open any link to go straight to that document.
            </InfoTooltip>
          </div>
        </div>

        {/* Row 2: Type filter pills */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '10px 16px',
          flexWrap: 'wrap',
        }}>
          {[
            { key: 'all' as const, label: 'All' },
            ...groupOrder.map(t => ({ key: t, label: TYPE_CONFIG[t].pluralLabel })),
          ].map(chip => {
            const count = chip.key === 'all' ? EFFECTIVE_TRANSACTIONS.length : EFFECTIVE_TRANSACTIONS.filter(t => t.type === chip.key).length;
            return (
              <FilterPill
                key={chip.key}
                label={chip.label}
                count={count}
                active={typeFilter === chip.key}
                onClick={() => setTypeFilter(chip.key as any)}
              />
            );
          })}
        </div>

      </div>{/* close toolbar card */}

      {/* ── Transaction group sections — each its own card ── */}
      {totalCount === 0 ? (
        <EmptyPlaceholder
          block
          icon={Link2}
          title="No linked transactions yet"
          description="Other Omne records that reference this quote will appear here, including the converted sales order, procurement orders, shipments, invoices, returns, and credit memos."
        />
      ) : (
        groupOrder.filter(type => grouped[type] && grouped[type].length > 0).map((type) => {
          const items = grouped[type];
          const config = TYPE_CONFIG[type];
          const Icon = config.icon;
          const isCollapsed = collapsedGroups.has(type);
          const groupTotal = items.reduce((s, t) => s + t.total, 0);

          return (
            <div key={type} className="rounded-xl" style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid var(--border)', overflow: 'hidden',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
            }}>
              {/* Group header — Partner TitledSection chrome */}
              <button
                type="button"
                onClick={() => toggleGroup(type)}
                className="w-full px-3.5 py-2.5 flex items-center gap-2 cursor-pointer hover:bg-[#F4F6F9] transition-colors"
                style={{ borderBottom: !isCollapsed ? '1px solid #EEF2F6' : 'none', backgroundColor: '#FAFBFC', fontFamily: 'Inter, system-ui, sans-serif' }}
              >
                <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="w-3.5 h-3.5 text-primary" />
                </div>
                <span className="text-[13px] text-foreground text-left" style={{ fontWeight: 600 }}>
                  {config.pluralLabel}
                </span>
                <NumberPill count={items.length} />
                <span className="text-[12px] text-muted-foreground ml-auto" style={{ lineHeight: '1' }}>
                  {formatCurrency(groupTotal)}
                </span>
                <ChevronDown
                  className="w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
                  style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}
                />
              </button>

              {/* Table header + rows */}
              {!isCollapsed && (
                <>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: TABLE_GRID,
                      padding: '0 16px',
                      height: '32px',
                      alignItems: 'center',
                      borderBottom: '1px solid var(--border)',
                      /* Header row on white (matches SO LinkedTransactionsTab
                         and Partner v7 — Partner uses `bg-card` for the table
                         head, not the heavier `muted` token). */
                      backgroundColor: 'var(--card)',
                    }}
                  >
                    <ColumnHeaderTooltip label="Number" tooltip="Unique document reference number" />
                    <ColumnHeaderTooltip label="Description" tooltip="Brief summary of the transaction" />
                    <ColumnHeaderTooltip label="Status" tooltip="Current lifecycle state of the document" />
                    <ColumnHeaderTooltip label="Created On" tooltip="Date the document was created" />
                    <ColumnHeaderTooltip label="Amount" tooltip="Total monetary value of the transaction" align="end" />
                    <span />
                    <ColumnHeaderTooltip label="Created By" tooltip="User who created this document" />
                    <span />
                  </div>
                  {items.map((txn) => (
                    <TransactionRow key={txn.id} txn={txn} />
                  ))}
                </>
              )}
            </div>
          );
        })
      )}

    </div>
  );
}

// ── Transaction Row ────────────────────────────────────────────────
function TransactionRow({ txn }: { txn: LinkedTransaction }) {
  const formatCurrency = useDocWhole();
  const [hovered, setHovered] = useState(false);
  const status = STATUS_CONFIG[txn.status];

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => toast.info(`Open ${txn.number} — coming soon`, { position: 'top-right' })}
      style={{
        display: 'grid',
        gridTemplateColumns: TABLE_GRID,
        padding: '0 16px',
        height: '40px',
        alignItems: 'center',
        cursor: 'pointer',
        backgroundColor: hovered ? '#F0F7FF' : '#FFFFFF',
        borderBottom: '1px solid var(--muted)',
        transition: 'background-color 150ms',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      {/* Number */}
      <div style={{ minWidth: 0, overflow: 'hidden' }}>
        <span style={{
          fontSize: '13px', fontWeight: 500, color: 'var(--primary)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          display: 'block', lineHeight: '1',
        }}>
          {txn.number}
        </span>
      </div>

      {/* Description + parent */}
      <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', paddingRight: '8px' }}>
        <span style={{
          fontSize: '13px', color: 'var(--foreground)', lineHeight: '1',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          flex: 1, minWidth: 0,
        }}>
          {txn.title}
        </span>
        {txn.parentNumber && (
          <span style={{
            fontSize: '11px', color: 'var(--muted-foreground)', whiteSpace: 'nowrap', flexShrink: 0, lineHeight: '1',
          }}>
            via {txn.parentNumber}
          </span>
        )}
      </div>

      {/* Status badge */}
      <div>
        <span style={{
          display: 'inline-flex', alignItems: 'center',
          height: '20px', padding: '0 6px', borderRadius: '4px',
          backgroundColor: status.bg,
          fontSize: '11px', fontWeight: 500, color: status.color,
          lineHeight: '1', whiteSpace: 'nowrap',
        }}>
          {status.label}
        </span>
      </div>

      {/* Date */}
      <span style={{ fontSize: '12px', color: 'var(--muted-foreground)', whiteSpace: 'nowrap', lineHeight: '1' }}>
        {formatDateShort(txn.createdDate)}
      </span>

      {/* Amount — right-aligned */}
      <span style={{
        fontSize: '13px', fontWeight: 500, color: 'var(--foreground)',
        whiteSpace: 'nowrap', textAlign: 'right', lineHeight: '1',
      }}>
        {formatCurrency(txn.total)}
      </span>

      {/* Spacer */}
      <span />

      {/* Created by */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
        <Avatar name={txn.assignee} size={20} initials={txn.assigneeInitials} />
        <span style={{
          fontSize: '12px', color: 'var(--muted-foreground)', lineHeight: '1',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          minWidth: 0,
        }}>
          {txn.assignee}
        </span>
      </div>

      {/* Open icon */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <ExternalLink style={{
          width: '13px', height: '13px',
          color: hovered ? 'var(--primary)' : 'var(--border)',
          transition: 'color 150ms',
        }} />
      </div>
    </div>
  );
}