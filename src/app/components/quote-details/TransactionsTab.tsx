import React, { useState, useRef, useEffect } from 'react';
import { CurrencyAmount } from '../ui/CurrencyAmount';
import { BASE_CURRENCY, convertBetween, getLibraryCurrency } from '../../data/currencyLibrary';
import {
  Search, ExternalLink, ChevronDown, SlidersHorizontal,
  FileText, ShoppingCart, Truck, CreditCard, RotateCcw,
  Link2, Banknote, X, Calendar, User
} from 'lucide-react';
import { toast } from 'sonner';

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
  /** Optional locked rate at the time of this transaction (base-per-customer-unit). When omitted, falls back to the live snapshot. */
  lockedRate?: number;
  /** ISO date the rate was locked. Surfaces in the hover tooltip. */
  lockedAt?: string;
  /** Rate book that was active at lock time. */
  rateType?: 'market' | 'corporate';
}

// ── Config ─────────────────────────────────────────────────────────
const TYPE_CONFIG: Record<TransactionType, { label: string; pluralLabel: string; icon: any; color: string; bg: string }> = {
  'sales-order': { label: 'Sales Order', pluralLabel: 'Sales Orders', icon: ShoppingCart, color: '#1E40AF', bg: '#DBEAFE' },
  'invoice': { label: 'Invoice', pluralLabel: 'Invoices', icon: FileText, color: '#065F46', bg: '#D1FAE5' },
  'payment': { label: 'Payment Receipt', pluralLabel: 'Payment Receipts', icon: Banknote, color: '#047857', bg: '#D1FAE5' },
  'delivery': { label: 'Shipment', pluralLabel: 'Shipments', icon: Truck, color: '#92400E', bg: '#FEF3C7' },
  'return': { label: 'Return', pluralLabel: 'Returns', icon: RotateCcw, color: '#991B1B', bg: '#FEE2E2' },
  'credit-memo': { label: 'Credit Memo', pluralLabel: 'Credit Memos', icon: CreditCard, color: '#6B21A8', bg: '#F3E8FF' },
};

const STATUS_CONFIG: Record<TransactionStatus, { label: string; color: string; bg: string }> = {
  'draft': { label: 'Draft', color: '#374151', bg: '#F3F4F6' },
  'confirmed': { label: 'Confirmed', color: '#1E40AF', bg: '#DBEAFE' },
  'in-progress': { label: 'In Progress', color: '#92400E', bg: '#FEF3C7' },
  'completed': { label: 'Completed', color: '#065F46', bg: '#D1FAE5' },
  'cancelled': { label: 'Cancelled', color: '#991B1B', bg: '#FEE2E2' },
  'partial': { label: 'Partial', color: '#9A3412', bg: '#FED7AA' },
  'overdue': { label: 'Overdue', color: '#991B1B', bg: '#FEE2E2' },
  'pending': { label: 'Pending', color: '#92400E', bg: '#FEF3C7' },
};

// ── Mock Data ─────────────────────────────────────────────────────
const MOCK_TRANSACTIONS: LinkedTransaction[] = [
  // Sales Orders
  {
    id: 'SO-001', type: 'sales-order', number: 'SO-2026-0089',
    title: 'Tri-County EMS Fleet (Phase 1)',
    status: 'confirmed', createdDate: '2026-02-10', total: 52800,
    lineItemCount: 3, assignee: 'Sarah Chen', assigneeInitials: 'SC',
    notes: 'Phase 1 covers 2x Ford E-450 chassis + modules',
  },
  {
    id: 'SO-002', type: 'sales-order', number: 'SO-2026-0091',
    title: 'Tri-County EMS Fleet (Phase 2)',
    status: 'draft', createdDate: '2026-02-14', total: 28475,
    lineItemCount: 2, assignee: 'Sarah Chen', assigneeInitials: 'SC',
    notes: 'Phase 2: radios, stretchers, and electrical',
  },
  // Invoices
  {
    id: 'INV-001', type: 'invoice', number: 'INV-2026-0142',
    title: 'Phase 1 Deposit (50%)',
    status: 'completed', createdDate: '2026-02-11', dueDate: '2026-03-13', total: 26400,
    lineItemCount: 3, assignee: 'Michael Rodriguez', assigneeInitials: 'MR',
    parentId: 'SO-001', parentNumber: 'SO-2026-0089',
  },
  {
    id: 'INV-002', type: 'invoice', number: 'INV-2026-0158',
    title: 'Phase 1 Final Balance',
    status: 'draft', createdDate: '2026-02-16', dueDate: '2026-03-18', total: 26400,
    lineItemCount: 3, assignee: 'Michael Rodriguez', assigneeInitials: 'MR',
    parentId: 'SO-001', parentNumber: 'SO-2026-0089',
  },
  {
    id: 'INV-003', type: 'invoice', number: 'INV-2026-0167',
    title: 'Phase 2 Advance Payment',
    status: 'pending', createdDate: '2026-02-15', dueDate: '2026-03-15', total: 14238,
    lineItemCount: 2, assignee: 'Michael Rodriguez', assigneeInitials: 'MR',
    parentId: 'SO-002', parentNumber: 'SO-2026-0091',
  },
  // Payment Receipts
  {
    id: 'PMT-001', type: 'payment', number: 'PMT-2026-0078',
    title: 'Wire Transfer — Phase 1 Deposit',
    status: 'completed', createdDate: '2026-02-13', total: 26400,
    lineItemCount: 1, assignee: 'Sarah Chen', assigneeInitials: 'SC',
    parentId: 'INV-001', parentNumber: 'INV-2026-0142',
  },
  // Deliveries / Shipments
  {
    id: 'DEL-001', type: 'delivery', number: 'SHP-2026-0034',
    title: 'Chassis & Modules Shipment',
    status: 'in-progress', createdDate: '2026-02-12', total: 52800,
    lineItemCount: 2, assignee: 'Emily Williams', assigneeInitials: 'EW',
    parentId: 'SO-001', parentNumber: 'SO-2026-0089',
    notes: 'FedEx Freight — ETA 02/28',
  },
  {
    id: 'DEL-002', type: 'delivery', number: 'SHP-2026-0041',
    title: 'Equipment & Accessories Shipment',
    status: 'draft', createdDate: '2026-02-17', total: 28475,
    lineItemCount: 4, assignee: 'Emily Williams', assigneeInitials: 'EW',
    parentId: 'SO-002', parentNumber: 'SO-2026-0091',
  },
  // Credit Memo
  {
    id: 'CM-001', type: 'credit-memo', number: 'CM-2026-0012',
    title: 'Pricing Adjustment — Volume Discount',
    status: 'confirmed', createdDate: '2026-02-14', total: 1580,
    lineItemCount: 1, assignee: 'Sarah Chen', assigneeInitials: 'SC',
    parentId: 'SO-001', parentNumber: 'SO-2026-0089',
  },
];

// ── Helpers ────────────────────────────────────────────────────────
function makeFormatCurrency(customerCurrency: string | undefined, viewMode: 'base' | 'customer') {
  const cur = (customerCurrency || BASE_CURRENCY).toUpperCase();
  const showCustomer = cur !== BASE_CURRENCY && viewMode === 'customer';
  const baseSym = getLibraryCurrency(BASE_CURRENCY)?.symbol ?? BASE_CURRENCY;
  const customerSym = getLibraryCurrency(cur)?.symbol ?? cur;
  // `n` is stored in PKR (base). When the page is in customer view, optionally
  // honor the transaction's locked rate so per-transaction FX stays anchored.
  return (n: number, lockedRate?: number): string => {
    if (showCustomer) {
      const customerValue = typeof lockedRate === 'number' ? n / lockedRate : convertBetween(n, BASE_CURRENCY, cur);
      return `${customerSym} ${customerValue.toLocaleString('en-US')}`;
    }
    return `${baseSym} ${n.toLocaleString('en-US')}`;
  };
}

// Deterministic per-transaction locked-rate cycle so the demo shows a mix of
// rate books and slight rate drift across linked transactions. In production
// this comes from each transaction's saved rate snapshot at creation time.
const DEMO_LOCKED_RATE_CYCLE: Array<{ rate: number; rateType: 'market' | 'corporate'; offsetDays: number }> = [
  { rate: 278.00, rateType: 'market', offsetDays: 0 },
  { rate: 280.00, rateType: 'corporate', offsetDays: 7 },
  { rate: 281.50, rateType: 'market', offsetDays: 14 },
  { rate: 277.20, rateType: 'market', offsetDays: 21 },
  { rate: 279.10, rateType: 'corporate', offsetDays: 28 },
];
const formatDateShort = (d: string) => {
  const date = new Date(d + 'T00:00:00');
  return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}/${date.getFullYear()}`;
};

const getAvatarColor = (initials: string) => {
  const colors = [
    { bg: '#FDE68A', text: '#92400E' },
    { bg: '#DBEAFE', text: '#1E40AF' },
    { bg: '#FED7AA', text: '#9A3412' },
    { bg: '#C7D2FE', text: '#3730A3' },
    { bg: '#FCA5A5', text: '#991B1B' },
    { bg: '#D1FAE5', text: '#065F46' },
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
  /** Customer's quote currency (ISO 4217). Drives the per-transaction hover + rate-divergence indicator. */
  customerCurrency?: string;
  /** Quote's locked customer→base rate. Each transaction's locked rate is compared against this to flag divergence. */
  quoteLockedRate?: number;
  /** Quote's rate type at lock time, for indicator styling. */
  quoteRateType?: 'market' | 'corporate';
  /** Page-level Base ↔ Customer currency view. Drives the symbol on transaction totals. */
  viewMode?: 'base' | 'customer';
}

export function TransactionsTab({
  quoteNumber = 'Q-2026-0142',
  customerName = 'Tri-County EMS Authority',
  readOnly = false,
  customerCurrency,
  quoteLockedRate,
  quoteRateType,
  viewMode = 'base',
}: TransactionsTabProps) {
  const cur = (customerCurrency || 'PKR').toUpperCase();
  const showFx = cur !== 'PKR';
  const formatCurrency = React.useMemo(() => makeFormatCurrency(customerCurrency, viewMode), [customerCurrency, viewMode]);

  // Hydrate transactions with deterministic locked-rate snapshots so the demo
  // surfaces hover, rate-type, and rate-divergence indicators realistically.
  const transactionsWithRates = React.useMemo(() => {
    if (!showFx) return MOCK_TRANSACTIONS;
    return MOCK_TRANSACTIONS.map((t, idx) => {
      if (t.lockedRate !== undefined) return t;
      const seed = DEMO_LOCKED_RATE_CYCLE[idx % DEMO_LOCKED_RATE_CYCLE.length];
      return { ...t, lockedRate: seed.rate, rateType: seed.rateType, lockedAt: t.createdDate };
    });
  }, [showFx]);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<TransactionType | 'all'>('all');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<TransactionType>>(new Set());

  // Advanced filters
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [statusFilters, setStatusFilters] = useState<Set<TransactionStatus>>(new Set());
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');
  const [dateRangeFilter, setDateRangeFilter] = useState<'any' | 'today' | 'this-week' | 'this-month' | 'older'>('any');
  const filterRef = useRef<HTMLDivElement>(null);

  // Close filter panel on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setShowFilterPanel(false);
      }
    };
    if (showFilterPanel) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showFilterPanel]);

  // Unique assignees from data
  const allAssignees = Array.from(new Set(MOCK_TRANSACTIONS.map(t => t.assignee)));
  const allStatuses: TransactionStatus[] = ['draft', 'confirmed', 'in-progress', 'completed', 'pending', 'cancelled', 'partial', 'overdue'];
  const usedStatuses = allStatuses.filter(s => MOCK_TRANSACTIONS.some(t => t.status === s));

  const activeFilterCount =
    (statusFilters.size > 0 ? 1 : 0) +
    (assigneeFilter !== 'all' ? 1 : 0) +
    (dateRangeFilter !== 'any' ? 1 : 0);

  const toggleGroup = (type: TransactionType) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const toggleStatus = (s: TransactionStatus) => {
    setStatusFilters(prev => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  };

  const clearAllFilters = () => {
    setStatusFilters(new Set());
    setAssigneeFilter('all');
    setDateRangeFilter('any');
  };

  // Date range helper
  const matchesDateRange = (dateStr: string) => {
    if (dateRangeFilter === 'any') return true;
    const d = new Date(dateStr + 'T00:00:00');
    const now = new Date('2026-02-19T00:00:00'); // today per system
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    switch (dateRangeFilter) {
      case 'today': return d.toDateString() === now.toDateString();
      case 'this-week': return d >= startOfWeek && d <= now;
      case 'this-month': return d >= startOfMonth && d <= now;
      case 'older': return d < startOfMonth;
      default: return true;
    }
  };

  // Filter transactions
  const filteredTxns = transactionsWithRates.filter(txn => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = !searchQuery ||
      txn.number.toLowerCase().includes(q) ||
      txn.title.toLowerCase().includes(q) ||
      txn.assignee.toLowerCase().includes(q);
    const matchesType = typeFilter === 'all' || txn.type === typeFilter;
    const matchesStatus = statusFilters.size === 0 || statusFilters.has(txn.status);
    const matchesAssignee = assigneeFilter === 'all' || txn.assignee === assigneeFilter;
    const matchesDate = matchesDateRange(txn.createdDate);
    return matchesSearch && matchesType && matchesStatus && matchesAssignee && matchesDate;
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

  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* ── Toolbar card ─────────────────────────────── */}
      <div style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '10px',
        border: '1px solid #E5E7EB',
        overflow: 'hidden',
      }}>
        {/* Row 1: Search + Filters button | Summary + Action buttons */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', gap: '12px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
            {/* Search */}
            <div style={{ position: 'relative', width: '240px', flexShrink: 0 }}>
              <Search style={{
                position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)',
                width: '14px', height: '14px', color: '#9CA3AF',
              }} />
              <input
                type="text"
                placeholder="Search transactions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%', height: '32px', paddingLeft: '32px', paddingRight: '12px',
                  fontSize: '13px', color: '#1F2937', border: '1px solid #E5E7EB',
                  borderRadius: '6px', outline: 'none', fontFamily: 'Inter, system-ui, sans-serif',
                  backgroundColor: '#FFFFFF',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#93C5FD'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(147,197,253,0.3)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.boxShadow = 'none'; }}
              />
            </div>

            {/* Filters button + dropdown */}
            <div ref={filterRef} style={{ position: 'relative', flexShrink: 0 }}>
              <button
                onClick={() => setShowFilterPanel(v => !v)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  height: '32px', padding: '0 12px', borderRadius: '6px',
                  border: `1px solid ${showFilterPanel || activeFilterCount > 0 ? '#1B6EF3' : '#E5E7EB'}`,
                  backgroundColor: showFilterPanel || activeFilterCount > 0 ? '#F0F7FF' : '#FFFFFF',
                  color: showFilterPanel || activeFilterCount > 0 ? '#1B6EF3' : '#6B7280',
                  fontSize: '13px', fontWeight: 500,
                  cursor: 'pointer', transition: 'all 150ms',
                  fontFamily: 'Inter, system-ui, sans-serif', lineHeight: '1',
                }}
                onMouseEnter={(e) => {
                  if (!showFilterPanel && activeFilterCount === 0) {
                    e.currentTarget.style.backgroundColor = '#F9FAFB';
                    e.currentTarget.style.borderColor = '#9CA3AF';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!showFilterPanel && activeFilterCount === 0) {
                    e.currentTarget.style.backgroundColor = '#FFFFFF';
                    e.currentTarget.style.borderColor = '#E5E7EB';
                  }
                }}
              >
                <SlidersHorizontal style={{ width: '14px', height: '14px' }} />
                Filters
                {activeFilterCount > 0 && (
                  <span style={{
                    fontSize: '10px', fontWeight: 600, color: '#FFFFFF', backgroundColor: '#1B6EF3',
                    width: '16px', height: '16px', borderRadius: '50%', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', lineHeight: '1',
                  }}>
                    {activeFilterCount}
                  </span>
                )}
              </button>

              {/* Filter dropdown panel */}
              {showFilterPanel && (
                <div style={{
                  position: 'absolute', top: '36px', left: 0, zIndex: 50,
                  width: '320px', backgroundColor: '#FFFFFF',
                  borderRadius: '8px', border: '1px solid #E5E7EB',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                  fontFamily: 'Inter, system-ui, sans-serif',
                }}>
                  {/* Panel header */}
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 14px', borderBottom: '1px solid #E5E7EB',
                  }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#1F2937', lineHeight: '1' }}>Filters</span>
                    {activeFilterCount > 0 && (
                      <button
                        onClick={clearAllFilters}
                        style={{
                          fontSize: '11px', fontWeight: 500, color: '#1B6EF3', backgroundColor: 'transparent',
                          border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'Inter, system-ui, sans-serif',
                          lineHeight: '1',
                        }}
                      >
                        Clear all
                      </button>
                    )}
                  </div>

                  {/* Status section */}
                  <div style={{ padding: '10px 14px', borderBottom: '1px solid #F3F4F6' }}>
                    <div style={{ fontSize: '11px', fontWeight: 500, color: '#6B7280', marginBottom: '8px', lineHeight: '1', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Status</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {usedStatuses.map(s => {
                        const cfg = STATUS_CONFIG[s];
                        const isSelected = statusFilters.has(s);
                        return (
                          <button
                            key={s}
                            onClick={() => toggleStatus(s)}
                            style={{
                              height: '26px', padding: '0 8px', borderRadius: '5px',
                              border: `1px solid ${isSelected ? '#1B6EF3' : '#E5E7EB'}`,
                              backgroundColor: isSelected ? '#E7F3FF' : '#FFFFFF',
                              color: isSelected ? '#1B6EF3' : '#6B7280',
                              fontSize: '11px', fontWeight: 500, cursor: 'pointer',
                              display: 'flex', alignItems: 'center', gap: '5px',
                              transition: 'all 120ms', fontFamily: 'Inter, system-ui, sans-serif',
                              lineHeight: '1',
                            }}
                          >
                            <span style={{
                              width: '6px', height: '6px', borderRadius: '50%',
                              backgroundColor: cfg.color, flexShrink: 0,
                            }} />
                            {cfg.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Date range section */}
                  <div style={{ padding: '10px 14px', borderBottom: '1px solid #F3F4F6' }}>
                    <div style={{ fontSize: '11px', fontWeight: 500, color: '#6B7280', marginBottom: '8px', lineHeight: '1', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Date Range</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {([
                        { key: 'any' as const, label: 'Any Time' },
                        { key: 'today' as const, label: 'Today' },
                        { key: 'this-week' as const, label: 'This Week' },
                        { key: 'this-month' as const, label: 'This Month' },
                        { key: 'older' as const, label: 'Older' },
                      ]).map(opt => {
                        const isSelected = dateRangeFilter === opt.key;
                        return (
                          <button
                            key={opt.key}
                            onClick={() => setDateRangeFilter(opt.key)}
                            style={{
                              height: '26px', padding: '0 8px', borderRadius: '5px',
                              border: `1px solid ${isSelected ? '#1B6EF3' : '#E5E7EB'}`,
                              backgroundColor: isSelected ? '#E7F3FF' : '#FFFFFF',
                              color: isSelected ? '#1B6EF3' : '#6B7280',
                              fontSize: '11px', fontWeight: 500, cursor: 'pointer',
                              transition: 'all 120ms', fontFamily: 'Inter, system-ui, sans-serif',
                              lineHeight: '1',
                            }}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Assignee section */}
                  <div style={{ padding: '10px 14px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 500, color: '#6B7280', marginBottom: '8px', lineHeight: '1', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Assignee</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <button
                        onClick={() => setAssigneeFilter('all')}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '8px',
                          padding: '6px 8px', borderRadius: '5px', border: 'none',
                          backgroundColor: assigneeFilter === 'all' ? '#F0F7FF' : 'transparent',
                          cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif',
                          width: '100%', textAlign: 'left', transition: 'background-color 100ms',
                        }}
                        onMouseEnter={e => { if (assigneeFilter !== 'all') e.currentTarget.style.backgroundColor = '#F9FAFB'; }}
                        onMouseLeave={e => { if (assigneeFilter !== 'all') e.currentTarget.style.backgroundColor = 'transparent'; }}
                      >
                        <User style={{ width: '12px', height: '12px', color: assigneeFilter === 'all' ? '#1B6EF3' : '#9CA3AF' }} />
                        <span style={{ fontSize: '12px', fontWeight: 500, color: assigneeFilter === 'all' ? '#1B6EF3' : '#374151', lineHeight: '1' }}>All Assignees</span>
                      </button>
                      {allAssignees.map(name => {
                        const initials = name.split(' ').map(w => w[0]).join('');
                        const color = getAvatarColor(initials);
                        const isSelected = assigneeFilter === name;
                        return (
                          <button
                            key={name}
                            onClick={() => setAssigneeFilter(isSelected ? 'all' : name)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '8px',
                              padding: '6px 8px', borderRadius: '5px', border: 'none',
                              backgroundColor: isSelected ? '#F0F7FF' : 'transparent',
                              cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif',
                              width: '100%', textAlign: 'left', transition: 'background-color 100ms',
                            }}
                            onMouseEnter={e => { if (!isSelected) e.currentTarget.style.backgroundColor = '#F9FAFB'; }}
                            onMouseLeave={e => { if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent'; }}
                          >
                            <div style={{
                              width: '18px', height: '18px', borderRadius: '50%',
                              backgroundColor: color.bg, color: color.text,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '8px', fontWeight: 600, lineHeight: '1', flexShrink: 0,
                            }}>
                              {initials}
                            </div>
                            <span style={{ fontSize: '12px', fontWeight: 500, color: isSelected ? '#1B6EF3' : '#374151', lineHeight: '1' }}>{name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Active filter tags */}
            {activeFilterCount > 0 && (
              <>
                <div style={{ width: '1px', height: '20px', backgroundColor: '#E5E7EB', flexShrink: 0 }} />
                {statusFilters.size > 0 && (
                  <span style={{
                    display: 'flex', alignItems: 'center', gap: '4px', height: '24px', padding: '0 6px 0 8px',
                    fontSize: '11px', fontWeight: 500, color: '#1B6EF3', backgroundColor: '#EFF6FF',
                    borderRadius: '5px', whiteSpace: 'nowrap', lineHeight: '1',
                  }}>
                    {statusFilters.size === 1 ? STATUS_CONFIG[Array.from(statusFilters)[0]].label : `${statusFilters.size} statuses`}
                    <button onClick={() => setStatusFilters(new Set())} style={{ width: '14px', height: '14px', borderRadius: '3px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                      <X style={{ width: '10px', height: '10px', color: '#3B82F6' }} />
                    </button>
                  </span>
                )}
                {dateRangeFilter !== 'any' && (
                  <span style={{
                    display: 'flex', alignItems: 'center', gap: '4px', height: '24px', padding: '0 6px 0 8px',
                    fontSize: '11px', fontWeight: 500, color: '#1B6EF3', backgroundColor: '#EFF6FF',
                    borderRadius: '5px', whiteSpace: 'nowrap', lineHeight: '1',
                  }}>
                    {dateRangeFilter === 'today' ? 'Today' : dateRangeFilter === 'this-week' ? 'This Week' : dateRangeFilter === 'this-month' ? 'This Month' : 'Older'}
                    <button onClick={() => setDateRangeFilter('any')} style={{ width: '14px', height: '14px', borderRadius: '3px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                      <X style={{ width: '10px', height: '10px', color: '#3B82F6' }} />
                    </button>
                  </span>
                )}
                {assigneeFilter !== 'all' && (
                  <span style={{
                    display: 'flex', alignItems: 'center', gap: '4px', height: '24px', padding: '0 6px 0 8px',
                    fontSize: '11px', fontWeight: 500, color: '#1B6EF3', backgroundColor: '#EFF6FF',
                    borderRadius: '5px', whiteSpace: 'nowrap', lineHeight: '1',
                  }}>
                    {assigneeFilter}
                    <button onClick={() => setAssigneeFilter('all')} style={{ width: '14px', height: '14px', borderRadius: '3px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                      <X style={{ width: '10px', height: '10px', color: '#3B82F6' }} />
                    </button>
                  </span>
                )}
              </>
            )}
          </div>

          {/* Right: Summary + actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <span style={{ fontSize: '12px', color: '#9CA3AF', whiteSpace: 'nowrap', lineHeight: '1' }}>
              {totalCount} transaction{totalCount !== 1 ? 's' : ''} · {formatCurrency(totalValue)}
            </span>
          </div>
        </div>

        {/* Row 2: Type filter pills */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '10px 16px',
        }}>
          {[
            { key: 'all' as const, label: 'All' },
            ...groupOrder.map(t => ({ key: t, label: TYPE_CONFIG[t].pluralLabel })),
          ].map(chip => {
            const isActive = typeFilter === chip.key;
            const count = chip.key === 'all' ? MOCK_TRANSACTIONS.length : MOCK_TRANSACTIONS.filter(t => t.type === chip.key).length;
            return (
              <button
                key={chip.key}
                onClick={() => setTypeFilter(chip.key as any)}
                style={{
                  height: '28px', padding: '0 10px', borderRadius: '14px',
                  border: `1px solid ${isActive ? '#1B6EF3' : '#E2E8F0'}`,
                  backgroundColor: isActive ? '#E7F3FF' : '#FFFFFF',
                  color: isActive ? '#1B6EF3' : '#6B7280',
                  fontSize: '12px', fontWeight: 500, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '4px',
                  transition: 'all 150ms', fontFamily: 'Inter, system-ui, sans-serif',
                  lineHeight: '1',
                }}
              >
                {chip.label}
                {count > 0 && (
                  <span style={{ fontSize: '11px', color: isActive ? '#1B6EF3' : '#9CA3AF', lineHeight: '1' }}>{count}</span>
                )}
              </button>
            );
          })}
        </div>

      </div>{/* close toolbar card */}

      {/* ── Transaction group sections — each its own card ── */}
      {totalCount === 0 ? (
        <div style={{
          backgroundColor: '#FFFFFF', borderRadius: '10px', border: '1px solid #E5E7EB',
          textAlign: 'center', padding: '48px 20px',
          color: '#9CA3AF', fontSize: '13px',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}>
          <Link2 style={{ width: '32px', height: '32px', color: '#D1D5DB', margin: '0 auto 12px' }} />
          <div style={{ fontWeight: 500, color: '#6B7280', marginBottom: '4px', fontSize: '13px', lineHeight: '1.5' }}>No linked transactions</div>
          <div style={{ fontSize: '12px', lineHeight: '1.5' }}>Transactions like Sales Orders, Invoices, and Deliveries will appear here once created.</div>
        </div>
      ) : (
        groupOrder.filter(type => grouped[type] && grouped[type].length > 0).map((type) => {
          const items = grouped[type];
          const config = TYPE_CONFIG[type];
          const Icon = config.icon;
          const isCollapsed = collapsedGroups.has(type);
          const groupTotal = items.reduce((s, t) => s + t.total, 0);

          return (
            <div key={type} style={{
              backgroundColor: '#FFFFFF', borderRadius: '10px',
              border: '1px solid #E5E7EB', overflow: 'hidden',
            }}>
              {/* Group header */}
              <button
                onClick={() => toggleGroup(type)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
                  padding: '11px 16px', border: 'none',
                  backgroundColor: '#FFFFFF', cursor: 'pointer',
                  fontFamily: 'Inter, system-ui, sans-serif',
                  transition: 'background-color 100ms',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F9FAFB'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
              >
                <ChevronDown style={{
                  width: '14px', height: '14px', color: '#6B7280', flexShrink: 0,
                  transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                  transition: 'transform 150ms',
                }} />
                <Icon style={{ width: '15px', height: '15px', color: config.color, flexShrink: 0 }} />
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#1F2937', lineHeight: '1' }}>
                  {config.pluralLabel}
                </span>
                <span style={{
                  fontSize: '11px', fontWeight: 500, color: '#6B7280',
                  backgroundColor: '#F3F4F6',
                  padding: '2px 7px', borderRadius: '10px', lineHeight: '1',
                }}>
                  {items.length}
                </span>
                <div style={{ flex: 1 }} />
                <span style={{ fontSize: '12px', color: '#9CA3AF', lineHeight: '1' }}>
                  {formatCurrency(groupTotal)}
                </span>
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
                      borderBottom: '1px solid #E5E7EB',
                      borderTop: '1px solid #F3F4F6',
                      backgroundColor: '#F9FAFB',
                    }}
                  >
                    <span style={{ fontSize: '11px', fontWeight: 500, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px', lineHeight: '1' }}>Number</span>
                    <span style={{ fontSize: '11px', fontWeight: 500, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px', lineHeight: '1' }}>Description</span>
                    <span style={{ fontSize: '11px', fontWeight: 500, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px', lineHeight: '1' }}>Status</span>
                    <span style={{ fontSize: '11px', fontWeight: 500, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px', lineHeight: '1' }}>Date</span>
                    <span style={{ fontSize: '11px', fontWeight: 500, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px', lineHeight: '1', textAlign: 'right' }}>Amount</span>
                    <span />
                    <span style={{ fontSize: '11px', fontWeight: 500, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px', lineHeight: '1' }}>Created by</span>
                    <span />
                  </div>
                  {items.map((txn) => (
                    <TransactionRow key={txn.id} txn={txn} customerCurrency={customerCurrency} quoteLockedRate={quoteLockedRate} quoteRateType={quoteRateType} viewMode={viewMode} formatCurrency={formatCurrency} />
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
function TransactionRow({ txn, customerCurrency, quoteLockedRate, quoteRateType, viewMode, formatCurrency }: {
  txn: LinkedTransaction;
  customerCurrency?: string;
  quoteLockedRate?: number;
  quoteRateType?: 'market' | 'corporate';
  viewMode: 'base' | 'customer';
  formatCurrency: (n: number, lockedRate?: number) => string;
}) {
  const showFx = !!customerCurrency && customerCurrency.toUpperCase() !== 'PKR';
  const [hovered, setHovered] = useState(false);
  const status = STATUS_CONFIG[txn.status];
  const avatarColor = getAvatarColor(txn.assigneeInitials);

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
        backgroundColor: hovered ? '#F9FAFB' : '#FFFFFF',
        borderBottom: '1px solid #F3F4F6',
        transition: 'background-color 150ms',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      {/* Number */}
      <div style={{ minWidth: 0, overflow: 'hidden' }}>
        <span style={{
          fontSize: '13px', fontWeight: 500, color: '#1B6EF3',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          display: 'block', lineHeight: '1',
        }}>
          {txn.number}
        </span>
      </div>

      {/* Description + parent */}
      <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', paddingRight: '8px' }}>
        <span style={{
          fontSize: '13px', color: '#1F2937', lineHeight: '1',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          flex: 1, minWidth: 0,
        }}>
          {txn.title}
        </span>
        {txn.parentNumber && (
          <span style={{
            fontSize: '11px', color: '#9CA3AF', whiteSpace: 'nowrap', flexShrink: 0, lineHeight: '1',
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
      <span style={{ fontSize: '12px', color: '#9CA3AF', whiteSpace: 'nowrap', lineHeight: '1' }}>
        {formatDateShort(txn.createdDate)}
      </span>

      {/* Amount — right-aligned. Each linked transaction shows its own
          locked rate; hover reveals the customer-currency equivalent at
          that rate. A small chip flags rate divergence vs. the quote's rate. */}
      <span style={{
        fontSize: '13px', fontWeight: 500, color: '#1F2937',
        whiteSpace: 'nowrap', textAlign: 'right', lineHeight: '1',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6,
      }}>
        {showFx ? (
          <>
            {(() => {
              const partnerCur = customerCurrency!.toUpperCase();
              const lr = txn.lockedRate;
              const partnerValue = lr !== undefined
                ? (txn.total / lr)
                : convertBetween(txn.total, BASE_CURRENCY, partnerCur);
              if (viewMode === 'customer') {
                return (
                  <CurrencyAmount
                    mode="listing-partner"
                    currency={partnerCur}
                    value={partnerValue}
                    lockedRate={lr}
                    lockedAt={txn.lockedAt}
                  />
                );
              }
              return (
                <CurrencyAmount
                  mode="listing-base"
                  currency={BASE_CURRENCY}
                  value={txn.total}
                  partnerDefaultCurrency={partnerCur}
                  partnerDefaultValue={partnerValue}
                  lockedRate={lr}
                  lockedAt={txn.lockedAt}
                />
              );
            })()}
            {(() => {
              if (txn.lockedRate === undefined || quoteLockedRate === undefined) return null;
              const diverged = Math.abs(txn.lockedRate - quoteLockedRate) > 0.01 || (txn.rateType && quoteRateType && txn.rateType !== quoteRateType);
              if (!diverged) return null;
              return (
                <span
                  title={`Locked at 1 ${customerCurrency} = ₨ ${txn.lockedRate.toFixed(2)} PKR · Quote rate: ₨ ${quoteLockedRate.toFixed(2)}`}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 3,
                    padding: '1px 5px', borderRadius: 999,
                    backgroundColor: '#FFFBEB', color: '#92400E',
                    border: '1px solid #FDE68A',
                    fontSize: 9, fontWeight: 600, cursor: 'help',
                    flexShrink: 0,
                  }}
                >
                  Rate differs
                </span>
              );
            })()}
          </>
        ) : (
          formatCurrency(txn.total)
        )}
      </span>

      {/* Spacer */}
      <span />

      {/* Created by */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
        <div title={txn.assignee} style={{
          width: '20px', height: '20px', borderRadius: '50%',
          backgroundColor: avatarColor.bg, color: avatarColor.text,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '9px', fontWeight: 600, lineHeight: '1', flexShrink: 0,
        }}>
          {txn.assigneeInitials}
        </div>
        <span style={{
          fontSize: '12px', color: '#6B7280', lineHeight: '1',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          minWidth: 0,
        }}>
          {txn.assignee.split(' ')[0]}
        </span>
      </div>

      {/* Open icon */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <ExternalLink style={{
          width: '13px', height: '13px',
          color: hovered ? '#1B6EF3' : '#D1D5DB',
          transition: 'color 150ms',
        }} />
      </div>
    </div>
  );
}