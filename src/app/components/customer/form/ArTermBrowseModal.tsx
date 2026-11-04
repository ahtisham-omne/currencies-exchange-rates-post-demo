import { useEffect, useMemo, useState } from 'react';
import { TableEmptyState, resolveTableEmptyKind } from '@/app/components/ui/table-empty-state';
import { findSearchSuggestion } from '@/app/utils/searchSuggestion';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Building2,
  Check,
  Clock,
  Lock,
  Maximize2,
  Minimize2,
  Receipt,
  Search,
  SquareSplitHorizontal,
  Tag,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Dialog, DialogContent } from '@/app/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/app/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/app/components/ui/tooltip';
import { FilterPills } from '@/app/components/vendors/FilterPills';
import { PaymentTermCard } from '@/app/components/vendors/PaymentTermCard';
import type { PaymentTermCategory, PaymentTermPreset } from '@/app/data/paymentTermPresets';
import { AR_PAYMENT_TERMS, termLockReason, type ArInvoiceKind } from '@/app/data/ar/arPaymentTerms';

// Fork of the vendor "Browse Payment Terms" dialog (CreateInvoiceScreen,
// partner shell): search, NET / Pre / Split type toggle with counts and
// examples, status pills, sort popover, PaymentTermCard grid and the
// "Apply to invoice" footer. The catalogue is the AR one and the kind
// lock follows BR-007 (an advance takes prepayment or split only).

type SortKey = 'name' | 'vendorsApplied' | 'duration' | 'category';

export function ArTermBrowseModal({
  open,
  onOpenChange,
  kind,
  currentId,
  inheritedId,
  kindConflict,
  onApply,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  kind: ArInvoiceKind;
  currentId: string;
  inheritedId?: string;
  /** BR-007: opened because the order carries a net term. */
  kindConflict?: boolean;
  onApply: (t: PaymentTermPreset) => void;
}) {
  const [fullscreen, setFullscreen] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<PaymentTermCategory>('net');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortOpen, setSortOpen] = useState(false);
  const [sortBy, setSortBy] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [pendingId, setPendingId] = useState<string | null>(null);

  const allowed = useMemo(() => AR_PAYMENT_TERMS.filter((t) => termLockReason(kind, t) === null), [kind]);
  const categoryAllowed = (c: PaymentTermCategory) => allowed.some((t) => t.category === c);

  useEffect(() => {
    if (!open) {
      setFullscreen(false);
      setPendingId(null);
      return;
    }
    const current = AR_PAYMENT_TERMS.find((t) => t.id === currentId);
    const currentOk = current && termLockReason(kind, current) === null;
    setPendingId(currentOk ? current.id : null);
    setTypeFilter(currentOk ? current.category : kind === 'Advance Invoice' ? 'prepayment' : 'net');
    setStatusFilter('all');
    setSearch('');
  }, [open, currentId, kind]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = allowed.filter(
      (t) =>
        t.category === typeFilter &&
        (statusFilter === 'all' || statusFilter === 'preset' || (statusFilter === 'in_use' && t.vendorsApplied >= 1)) &&
        (!q || t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)),
    );
    const dur = (t: PaymentTermPreset) => parseInt(t.duration ?? '0', 10) || 0;
    const cmp = (a: PaymentTermPreset, b: PaymentTermPreset) =>
      sortBy === 'name'
        ? a.name.localeCompare(b.name)
        : sortBy === 'vendorsApplied'
          ? a.vendorsApplied - b.vendorsApplied
          : sortBy === 'duration'
            ? dur(a) - dur(b)
            : a.category.localeCompare(b.category);
    return [...list].sort((a, b) => (sortDir === 'asc' ? cmp(a, b) : -cmp(a, b)));
  }, [allowed, typeFilter, statusFilter, search, sortBy, sortDir]);

  const base = allowed.filter((t) => t.category === typeFilter);
  const pending = pendingId ? AR_PAYMENT_TERMS.find((t) => t.id === pendingId) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="z-[210] flex flex-col gap-0 overflow-hidden border-0 p-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.18)] transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] sm:max-w-none"
        style={
          fullscreen
            ? { maxWidth: 'calc(100% - 1rem)', width: 'calc(100% - 1rem)', height: 'calc(100dvh - 1rem)', maxHeight: 'calc(100dvh - 1rem)', borderRadius: 16 }
            : { maxWidth: 'min(75vw, 1080px)', width: 'calc(100% - 2rem)', height: 'min(88vh, 1080px)', maxHeight: 'min(88vh, 1080px)', minHeight: 640, borderRadius: 16 }
        }
        showCloseButton={false}
      >
        <div className="flex items-center justify-between border-b border-[#EEF2F6] bg-card px-6 h-12 shrink-0">
          <div className="flex items-center gap-3">
            <div>
              <h3 className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>Payment Terms</h3>
              <p className="text-[11px] text-muted-foreground" style={{ fontWeight: 400 }}>Browse customer payment term templates</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFullscreen(!fullscreen)}
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-white text-xs text-muted-foreground hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer"
              style={{ fontWeight: 500 }}
            >
              {fullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              {fullscreen ? 'Exit Full' : 'Full View'}
            </button>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-foreground hover:bg-muted transition-all cursor-pointer"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 min-w-0 flex flex-col overflow-hidden bg-white">
            {kindConflict && (
              <div className="shrink-0 flex items-start gap-2 px-5 py-2 bg-amber-50/70 border-b border-amber-200">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-px" />
                <p className="text-[11px] text-amber-800 leading-snug" style={{ fontWeight: 500 }}>
                  <span style={{ fontWeight: 600 }}>The order uses a NET term, which applies only after shipping.</span> Since this is an advance invoice, choose a prepayment or split term here.
                </p>
              </div>
            )}
            <div className="shrink-0 bg-white border-b border-[#EEF2F6] px-5 pt-4 pb-3 space-y-3">
              <div className="flex items-center gap-3">
                <div className="relative shrink-0">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search payment terms..."
                    className="pl-9 pr-8 rounded-lg border-[#D0D7E1] h-9 bg-white text-[13px] w-[220px] placeholder:text-slate-400 shadow-[0_1px_2px_rgba(0,0,0,0.05)] focus:border-primary focus:shadow-[0_0_0_3px_rgba(10,119,255,0.08)]"
                  />
                  {search && (
                    <button type="button" onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-foreground transition-colors" aria-label="Clear search">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="inline-flex items-center rounded-lg bg-slate-50 border border-border/60 p-0.5 shrink-0">
                  {([
                    { key: 'net', label: 'NET', color: 'hsl(var(--primary))', bg: '#EBF3FF', icon: Receipt, tip: 'Payment is due a fixed number of days after an event (invoice date, shipping, etc.).', example: <><span className="text-primary" style={{ fontWeight: 600 }}>Net 30</span>: full payment due 30 days after invoice.</> },
                    { key: 'prepayment', label: 'Pre', color: '#7C3AED', bg: '#F5F3FF', icon: Clock, tip: 'Prepayment terms bill part of the order on an advance invoice, before the goods ship.', example: <><span style={{ color: '#7C3AED', fontWeight: 600 }}>30% deposit</span> at order confirmation.</> },
                    { key: 'split', label: 'Split', color: '#B45309', bg: '#FFFBEB', icon: SquareSplitHorizontal, tip: 'Payment is divided into stages, each due at a different milestone.', example: <><span className="text-amber-600" style={{ fontWeight: 600 }}>30/70 split</span>: 30% at production start, 70% after shipping.</> },
                  ] as const).map((cat) => {
                    const active = typeFilter === cat.key;
                    const count = allowed.filter((t) => t.category === cat.key).length;
                    const blocked = !categoryAllowed(cat.key);
                    return (
                      <Tooltip key={cat.key}>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => {
                              if (!blocked) setTypeFilter(cat.key);
                            }}
                            aria-disabled={blocked}
                            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md text-[12px] transition-all ${
                              blocked ? 'opacity-45 cursor-not-allowed' : active ? 'shadow-sm cursor-pointer' : 'hover:bg-white/60 cursor-pointer'
                            }`}
                            style={{ fontWeight: active ? 600 : 500, color: active ? cat.color : '#334155', backgroundColor: active ? cat.bg : undefined }}
                          >
                            {blocked ? <Lock className="w-3.5 h-3.5" /> : <cat.icon className="w-3.5 h-3.5" />}
                            {cat.label}
                            <span
                              className="text-[10px] rounded-full px-1.5 py-px min-w-[18px] text-center"
                              style={{ fontWeight: 600, color: active ? cat.color : 'hsl(var(--muted-foreground))', backgroundColor: active ? `${cat.color}15` : 'hsl(var(--border))' }}
                            >
                              {count}
                            </span>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" sideOffset={8} className="max-w-[260px] text-[11px] leading-[1.5] z-[300]">
                          {blocked && (
                            <p className="text-amber-700 mb-1.5" style={{ fontWeight: 600 }}>
                              {kind === 'Advance Invoice' ? 'NET terms apply after the goods ship, so they don’t fit an advance invoice.' : 'Full prepayment terms are billed on an advance invoice.'}
                            </p>
                          )}
                          <p className="text-slate-500">{cat.tip}</p>
                          <div className="mt-2 px-2.5 py-2 rounded-lg bg-slate-50 border border-muted">
                            <p className="text-[10px] text-slate-400 tracking-wide" style={{ fontWeight: 600 }}>Example</p>
                            <p className="text-[11px] text-slate-700 mt-1">{cat.example}</p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>

                <div className="flex-1" />
                <div className="flex items-center gap-2 shrink-0">
                  <span className="inline-flex items-center justify-center min-w-[22px] h-[20px] px-1.5 rounded-md bg-primary/[0.04] text-[11px] text-slate-500" style={{ fontWeight: 600 }}>
                    {filtered.length}
                  </span>
                  <Popover open={sortOpen} onOpenChange={setSortOpen}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className={`inline-flex items-center gap-1 text-[12px] transition-colors px-2 py-1 rounded-md border ${sortOpen ? 'text-primary bg-blue-50 border-blue-100' : 'text-slate-500 hover:text-foreground hover:bg-slate-50 border-transparent hover:border-border'}`}
                        style={{ fontWeight: 500 }}
                      >
                        <ArrowUpDown className="w-3 h-3" />
                        {sortBy === 'name' ? 'Name' : sortBy === 'vendorsApplied' ? 'In Use' : sortBy === 'duration' ? 'Duration' : 'Type'}
                        {sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-[200px] p-1.5 rounded-lg z-[250]" sideOffset={6}>
                      <div className="space-y-0.5">
                        {([
                          { key: 'name', label: 'Name', icon: <ArrowUpDown className="w-3.5 h-3.5" /> },
                          { key: 'vendorsApplied', label: 'In Use', icon: <Building2 className="w-3.5 h-3.5" /> },
                          { key: 'duration', label: 'Duration', icon: <Clock className="w-3.5 h-3.5" /> },
                          { key: 'category', label: 'Type', icon: <Tag className="w-3.5 h-3.5" /> },
                        ] as const).map((opt) => {
                          const isActive = sortBy === opt.key;
                          return (
                            <button
                              key={opt.key}
                              type="button"
                              onClick={() => {
                                if (isActive) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
                                else {
                                  setSortBy(opt.key);
                                  setSortDir('asc');
                                }
                                setSortOpen(false);
                              }}
                              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[12px] transition-all ${isActive ? 'bg-blue-50 text-primary' : 'text-muted-foreground hover:bg-slate-50 hover:text-foreground'}`}
                              style={{ fontWeight: isActive ? 600 : 500 }}
                            >
                              <span className={isActive ? 'text-primary' : 'text-slate-400'}>{opt.icon}</span>
                              <span className="flex-1 text-left">{opt.label}</span>
                              {isActive && (sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />)}
                            </button>
                          );
                        })}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="flex items-center overflow-x-auto">
                <FilterPills
                  options={[
                    { key: 'all', label: 'All', count: base.length, showCount: true },
                    { key: 'preset', label: 'Template', count: base.length, showCount: true },
                    { key: 'custom', label: 'Custom', count: 0, showCount: true },
                    { key: 'created_by_me', label: 'Created by Me', count: 0, showCount: true },
                    { key: 'in_use', label: 'In Use', count: base.filter((t) => t.vendorsApplied >= 1).length, showCount: true },
                  ]}
                  activeKey={statusFilter}
                  onSelect={(k) => setStatusFilter(k)}
                />
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-5">
              {filtered.length === 0 ? (
                /* Table Empty States Standard (11/3/26); the type tab is part
                   of the catalog, so only the status pill counts as a filter. */
                <TableEmptyState
                  compact
                  kind={resolveTableEmptyKind({ totalCount: allowed.length, filteredCount: 0, searchQuery: search, filterCount: statusFilter !== 'all' ? 1 : 0 }) ?? 'no-data'}
                  entity={{ singular: 'payment term', plural: 'payment terms' }}
                  searchQuery={search}
                  filterCount={statusFilter !== 'all' ? 1 : 0}
                  suggestion={findSearchSuggestion(search, allowed.filter((t) => t.category === typeFilter).map((t) => t.name))}
                  onApplySuggestion={setSearch}
                  onClearSearch={() => setSearch('')}
                  onClearFilters={() => setStatusFilter('all')}
                  onClearAll={() => { setSearch(''); setStatusFilter('all'); }}
                />
              ) : (
                <div className="@container/ptgrid">
                  <div className="grid grid-cols-1 @[400px]/ptgrid:grid-cols-2 @[750px]/ptgrid:grid-cols-3 auto-rows-fr gap-4">
                    {filtered.map((term) => (
                      <PaymentTermCard
                        key={term.id}
                        term={term}
                        isSelected={pendingId === term.id}
                        selectedRing
                        selectControl
                        onClick={() => setPendingId(term.id)}
                        searchText={search}
                        showPresetBadge
                        isInherited={term.id === inheritedId}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="shrink-0 flex items-center justify-between gap-3 border-t border-[#EEF2F6] bg-card px-5 py-3">
              <p className="text-[11px] text-slate-500 truncate" style={{ fontWeight: 500 }}>
                {pending ? (
                  <>
                    <span className="text-foreground" style={{ fontWeight: 600 }}>{pending.name}</span> selected
                  </>
                ) : (
                  'Select a term to apply'
                )}
              </p>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="h-9 px-4 rounded-lg border border-slate-200 bg-white text-[13px] text-foreground hover:bg-slate-50 transition-colors cursor-pointer"
                  style={{ fontWeight: 500 }}
                >
                  Cancel
                </button>
                <Button
                  onClick={() => {
                    if (!pending) {
                      toast.error('Pick a term first', { description: 'Select a payment term from the list to apply it.' });
                      return;
                    }
                    onApply(pending);
                    onOpenChange(false);
                  }}
                  className="bg-primary text-primary-foreground h-9 px-4 text-[13px]"
                >
                  <Check className="w-4 h-4 mr-1.5" /> Apply to Invoice
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
