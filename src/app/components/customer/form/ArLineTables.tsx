import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, BadgePercent, ChevronDown, Info, Lock, Maximize2, PenLine, Plus, Search, Settings2, ShoppingCart, Trash2, Truck, Wallet, X } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Checkbox } from '@/app/components/ui/checkbox';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/app/components/ui/hover-card';
import { Popover, PopoverContent, PopoverTrigger } from '@/app/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/app/components/ui/tooltip';
import { ExpandableTextarea } from '@/app/components/ExpandableTextarea';
import { MoneyInput, formatMoneyText } from '@/app/components/payments/MoneyInput';
import { highlightText } from '@/app/components/InvoiceDataTable';
import { formatUsDate } from '@/app/lib/dueBucket';
import { CHARGE_TEMPLATES, type ChargeTemplate } from '@/app/data/ar/chargeTemplates';
import { REVENUE_ACCOUNTS } from '@/app/data/ar/arGlAccounts';
import { EPS, fmtQty, money, parseQty, round2, type DuplicateHit, type FormLine, type LineMoney } from './formModel';
import { fid } from './formValidation';
import {
  DestructiveConfirm,
  GLAccountPicker,
  ItemQuickView,
  ITEMS_MODULE_URL,
  LineItemDescription,
  LineItemImage,
  SALES_ORDER_URL,
  SHIPMENT_URL,
  imageForSku,
} from './VendorFormKit';
import { RevenueAccountModal } from './ArAccountModals';
import { LockedUnitsChip, type LockedUnitsInfo } from './LockedUnitsChip';
import type { UnitAllocation } from '@/app/data/ar/mockCustomerInvoices';
import { TableEmptyRow } from '@/app/components/ui/table-empty-state';
import { findSearchSuggestion } from '@/app/utils/searchSuggestion';

// The line item cards of the customer invoice form, forked from the
// vendor CreateInvoiceScreen: the PO-tab card (title row with the
// match-status pill, search, Full view, the PO pills band and the
// sticky-column table) becomes one tab per Shipment (shipment invoice)
// or the source Sales Order / Quote (advance invoice); the standalone
// card keeps Line No., GL Account, Description, Amount.

export interface SourceTab {
  key: string;
  kind: 'shipment' | 'so' | 'quote';
  number: string;
  soNumber?: string;
  date?: string;
  dateLabel: string;
  currency: string;
}

/** Quantity text field (vendor qty input look, never type=number). */
function QtyInput({
  value,
  disabled,
  onChange,
  className,
  style,
}: {
  value: number;
  disabled?: boolean;
  onChange: (n: number) => void;
  className: string;
  style?: React.CSSProperties;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <Input
      type="text"
      inputMode="decimal"
      disabled={disabled}
      value={draft ?? fmtQty(value)}
      onFocus={() => setDraft(String(value))}
      onBlur={() => setDraft(null)}
      onChange={(e) => {
        const raw = e.target.value.replace(/[^\d.]/g, '');
        setDraft(raw);
        onChange(parseQty(raw));
      }}
      className={className}
      style={style}
    />
  );
}

function FixLink({ onClick, children, label }: { onClick: () => void; children: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-[11px] leading-snug text-primary underline decoration-primary/60 underline-offset-2 hover:text-blue-700 hover:decoration-primary transition-colors cursor-pointer p-0 bg-transparent border-0 align-baseline"
      style={{ fontWeight: 600, fontFamily: 'inherit' }}
      aria-label={label}
    >
      {children}
    </button>
  );
}

function CellWarn({ tone, label, children }: { tone: 'red' | 'amber' | 'slate'; label: string; children: React.ReactNode }) {
  const cls =
    tone === 'red' ? 'text-red-500 hover:bg-red-100' : tone === 'amber' ? 'text-amber-500 hover:bg-amber-100' : 'text-slate-400 hover:bg-slate-200/70';
  return (
    <HoverCard openDelay={300} closeDelay={120}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          tabIndex={-1}
          className={`absolute left-1.5 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-4 h-4 rounded-full transition-colors cursor-help ${cls}`}
          aria-label={label}
        >
          {tone === 'slate' ? <Lock className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
        </button>
      </HoverCardTrigger>
      <HoverCardContent side="top" className="max-w-[280px] p-2.5 bg-white border border-border rounded-lg shadow-md z-[300]">
        {children}
      </HoverCardContent>
    </HoverCard>
  );
}

// ── Shipment / Advance card ──────────────────────────────────────────

export function SourceLinesCard({
  kind,
  tabs,
  activeTab,
  onTab,
  lines,
  currency,
  customerName,
  shipAvail,
  advCap,
  lineMoney,
  ratioBySo,
  canChangePrice,
  termLocked,
  stagePill,
  hasError,
  cardError,
  onQty,
  onPrice,
  onAdvance,
  onRemoveLines,
  onRemoveTab,
  onAddMore,
  prepay,
  orderedLeft,
  duplicates,
  manual,
  prepayCaption,
  discount,
  lockedUnits,
}: {
  kind: 'Shipment Invoice' | 'Advance Invoice';
  tabs: SourceTab[];
  activeTab: string;
  onTab: (key: string) => void;
  lines: FormLine[];
  currency: string;
  customerName: string;
  shipAvail: Map<string, number>;
  advCap: Map<string, number>;
  lineMoney: Map<string, LineMoney>;
  ratioBySo: Map<string, number>;
  canChangePrice: boolean;
  termLocked: boolean;
  stagePill?: string;
  hasError: (id: string) => boolean;
  cardError: boolean;
  onQty: (key: string, n: number) => void;
  onPrice: (key: string, n: number) => void;
  onAdvance: (key: string, patch: { advancePercent: number; advanceAmount: number }) => void;
  onRemoveLines: (keys: string[]) => void;
  onRemoveTab: (tabKey: string) => void;
  /** Vendor parity (10/29): Add More Items / Add More Shipments reopen the
   *  selection modal pinned to this customer. Shipment invoices only. */
  onAddMore?: () => void;
  /** Customer prepayment entered per line (BA 10/29). Shipment only. */
  prepay?: { values: Record<string, number>; maxFor: (key: string) => number; onChange: (key: string, n: number) => void };
  /** FAD 11/2: units still open on each line's SO line (over-ordered warning). */
  orderedLeft?: Map<string, number>;
  /** FAD 11/2: lines already billed on another live invoice. */
  duplicates?: Map<string, DuplicateHit>;
  /** FAD 11/2: free-text lines on a shipment invoice (Add Line). */
  manual?: {
    currency: string;
    onAdd: () => void;
    onChange: (key: string, patch: Partial<FormLine>) => void;
    onRemove: (key: string) => void;
  };
  /** FAD 11/2: where the deposits come from, for the Prepayment tooltip. */
  prepayCaption?: string;
  /** Early-pay discount from the payment term (user 11/4: back on the form). */
  discount?: EarlyPayDiscount;
  /** Mahreen 11/4: Revenue on invoice advances lock serials or lots per line. */
  lockedUnits?: { byLine: Map<string, LockedUnitsInfo>; onChange: (key: string, units: UnitAllocation[] | undefined) => void };
}) {
  const isShip = kind === 'Shipment Invoice';
  const showDiscount = isShip && !!discount && discount.percent > 0;
  const showPrepay = isShip && !!prepay;
  const manualLines = isShip ? lines.filter((l) => l.manual) : [];
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState(false);
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<number | null>(null);
  const [preview, setPreview] = useState<{ src: string; sku: string; description?: string } | null>(null);
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({});
  const [itemToRemove, setItemToRemove] = useState<FormLine | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [tabToRemove, setTabToRemove] = useState<SourceTab | null>(null);

  const openFull = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    setClosing(false);
    setExpanded(true);
  };
  const collapse = () => {
    setClosing(true);
    closeTimer.current = window.setTimeout(() => {
      setExpanded(false);
      setClosing(false);
    }, 200);
  };
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') collapse();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded]);

  const tabLines = isShip ? lines.filter((l) => !l.manual && l.shipmentNumber === activeTab) : lines;
  const q = search.trim().toLowerCase();
  const shown = useMemo(
    () => (q ? tabLines.filter((l) => [l.sku, l.description, l.soNumber ?? '', l.shipmentNumber ?? ''].some((v) => v.toLowerCase().includes(q))) : tabLines),
    [tabLines, q],
  );
  useEffect(() => setSelectedIds(new Set()), [activeTab]);

  const hasIssue = isShip
    ? tabLines.some(
        (l) =>
          l.invoiceQty > (shipAvail.get(l.shipmentLineId ?? '') ?? 0) + EPS ||
          l.invoiceQty > (orderedLeft?.get(l.key) ?? Infinity) + EPS ||
          duplicates?.has(l.key),
      )
    : tabLines.some((l) => (l.advanceAmount ?? 0) > (advCap.get(l.soLineId ?? '') ?? 0) + EPS);
  const statusColor = hasIssue
    ? 'bg-destructive/10 border-destructive/20 text-destructive'
    : isShip
      ? 'bg-blue-50 border-blue-200 text-blue-700'
      : 'bg-violet-50 border-violet-200 text-violet-700';
  const dotColor = hasIssue ? 'bg-destructive' : isShip ? 'bg-blue-500' : 'bg-violet-500';
  const pillLabel = hasIssue ? (isShip ? 'Over the Shipped Quantity' : 'Over the Order Value') : isShip ? 'Shipped Goods (Invoice)' : stagePill ? `Advance (${stagePill})` : 'Advance Invoice';
  const covered = isShip && lines.some((l) => (lineMoney.get(l.key)?.covered ?? 0) > EPS);
  const colCount = (isShip ? 8 : 7) + (showDiscount ? 1 : 0) + (showPrepay ? 1 : 0);

  const renderBreakdown = (tab: SourceTab) => {
    const items = isShip ? lines.filter((l) => l.shipmentNumber === tab.number) : lines;
    const isAdvTab = !isShip;
    const total = items.reduce((a, l) => a + (lineMoney.get(l.key)?.total ?? 0), 0);
    const href = tab.kind === 'shipment' ? SHIPMENT_URL(tab.number) : SALES_ORDER_URL(tab.number);
    return (
      <HoverCardContent className="w-80 p-0 overflow-hidden rounded-xl border border-border/60 shadow-[0_8px_30px_rgba(0,0,0,0.12)] z-[300]" align="start">
        <div className={`bg-gradient-to-br px-3.5 py-3 relative overflow-hidden ${isAdvTab ? 'from-violet-700 to-violet-600' : 'from-slate-800 to-slate-700'}`}>
          <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/[0.04]" />
          <div className="flex items-center justify-between gap-2 relative">
            <div className="flex items-center gap-2 min-w-0">
              {tab.kind === 'shipment' ? <Truck className="w-3.5 h-3.5 text-white/70 shrink-0" /> : <ShoppingCart className="w-3.5 h-3.5 text-white/70 shrink-0" />}
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-white text-[13px] truncate cursor-pointer hover:text-blue-300 hover:underline transition-colors"
                style={{ fontWeight: 600 }}
              >
                <span className="text-white/60">{tab.kind === 'shipment' ? 'Shipment No.' : tab.kind === 'so' ? 'SO No.' : 'Quote No.'}</span> {tab.number}
              </a>
            </div>
            <span
              className={`inline-flex items-center px-1.5 py-px rounded border text-[9px] shrink-0 ${isAdvTab ? 'bg-violet-50 text-violet-700 border-violet-300 border-dashed' : 'bg-blue-50 text-blue-700 border-blue-200'}`}
              style={{ fontWeight: 700 }}
            >
              {isAdvTab ? 'Advance' : 'Invoice'}
            </span>
          </div>
          <p className="text-[11px] text-white/50 mt-1" style={{ fontWeight: 400 }}>
            {tab.dateLabel} {tab.date ? formatUsDate(tab.date) : ''}
            {tab.soNumber && tab.kind === 'shipment' ? ` · SO No. ${tab.soNumber}` : ''}
          </p>
        </div>
        <div className="px-3.5 py-3 space-y-2.5 bg-white">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>
              Billed Items <span className="text-slate-400">·</span> <span className="text-slate-700" style={{ fontWeight: 600 }}>{items.length}</span>
            </span>
            <span className={`inline-flex items-center gap-1 text-[11px] ${isAdvTab ? 'text-violet-700' : 'text-blue-700'}`} style={{ fontWeight: 600 }}>
              <span className={`w-1.5 h-1.5 rounded-full ${isAdvTab ? 'bg-violet-500' : 'bg-blue-500'}`} />
              {isAdvTab ? 'Billed Before Shipping' : 'Shipped Goods'}
            </span>
          </div>
          <div className="space-y-0.5 max-h-[220px] overflow-y-auto pr-1 custom-scrollbar -mx-1">
            {items.map((item) => (
              <div key={item.key} className="flex items-center gap-2.5 py-1.5 px-1 border-b border-slate-50 last:border-0">
                <LineItemImage sku={item.sku} src={imageForSku(item.sku)} alt={item.sku} onPreview={() => setPreview({ src: imageForSku(item.sku), sku: item.sku, description: item.description })} />
                <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                  <a
                    href={ITEMS_MODULE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-[12px] text-slate-800 leading-tight truncate hover:text-primary hover:underline decoration-primary/60 underline-offset-2 transition-colors"
                    style={{ fontWeight: 600 }}
                  >
                    {item.sku}
                  </a>
                  <span className="text-[10px] text-slate-500 leading-tight truncate">{item.description}</span>
                </div>
                <div className="text-right shrink-0 ml-2">
                  {isAdvTab ? (
                    <span className="text-[12px] text-slate-800" style={{ fontWeight: 600 }}>{money(item.advanceAmount ?? 0, currency)}</span>
                  ) : (
                    <span className="text-[12px] text-slate-800" style={{ fontWeight: 600 }}>
                      {fmtQty(item.invoiceQty)} {item.uom}
                    </span>
                  )}
                  <p className="text-[10px] text-slate-400 mt-0.5" style={{ fontWeight: 500 }}>{money(item.unitPrice, currency)}/unit</p>
                </div>
              </div>
            ))}
          </div>
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-accent flex items-center justify-center border border-primary/15">
                <Wallet className="w-3.5 h-3.5 text-primary" />
              </div>
              <div>
                <p className="text-[10px] text-slate-400 leading-none" style={{ fontWeight: 500 }}>Line Items Total</p>
                <p className="text-[14px] text-slate-800 mt-0.5" style={{ fontWeight: 600 }}>{money(total, currency)}</p>
              </div>
            </div>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] text-slate-600 bg-slate-50 border border-slate-200" style={{ fontWeight: 600 }}>
              {tab.currency}
            </span>
          </div>
        </div>
      </HoverCardContent>
    );
  };

  return (
    <section id={fid.lines} className="min-h-0 flex flex-col">
      {expanded && (
        <div
          className={`fixed inset-0 z-[140] bg-black/40 ${closing ? 'animate-out fade-out duration-200' : 'animate-in fade-in duration-200'}`}
          style={{ animationFillMode: 'both', animationTimingFunction: 'ease-out' }}
          onClick={collapse}
        />
      )}
      <div
        className={
          expanded
            ? `fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[150] w-[calc(100vw-3rem)] max-w-[1380px] h-[calc(100vh-4rem)] max-h-[88vh] rounded-xl border border-border bg-white shadow-2xl overflow-hidden flex flex-col duration-200 ${
                closing ? 'animate-out fade-out-0 zoom-out-95 slide-out-to-left-1/2 slide-out-to-top-1/2' : 'animate-in fade-in-0 zoom-in-95 slide-in-from-left-1/2 slide-in-from-top-1/2'
              }`
            : `min-h-0 flex flex-col rounded-lg border bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)] overflow-hidden ${cardError ? 'border-red-300 ring-2 ring-red-100' : 'border-border'}`
        }
        style={expanded ? { animationFillMode: 'both' } : undefined}
      >
        <div className="px-3 sm:px-4 py-2 sm:py-2.5 border-b border-[#EEF2F6] bg-[#FAFBFC] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs sm:text-[13px] text-foreground" style={{ fontWeight: 600 }}>Invoice Line Items</span>
            <HoverCard openDelay={300}>
              <HoverCardTrigger asChild>
                <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border cursor-help ${statusColor}`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                  <span className="text-[11px]" style={{ fontWeight: 600 }}>{pillLabel}</span>
                </div>
              </HoverCardTrigger>
              <HoverCardContent side="top" className="w-[280px] p-3 z-[300] bg-white border border-border rounded-lg shadow-md">
                <p className="text-[12px] text-foreground leading-snug" style={{ fontWeight: 600 }}>
                  {hasIssue ? 'Billing Discrepancy' : isShip ? 'Shipment Invoice' : 'Advance Invoice'}
                </p>
                <p className="text-[11px] text-slate-500 leading-relaxed mt-1.5" style={{ fontWeight: 400 }}>
                  {hasIssue
                    ? isShip
                      ? 'An invoice quantity is above what is left to invoice on the shipment. Fix it before submitting.'
                      : 'An advance amount is above what is left to advance-bill on the order. Fix it before submitting.'
                    : isShip
                      ? 'Quantities and prices come from the shipped lines and their sales order, so the invoice ties out across Sales Order + Shipment + Invoice.'
                      : 'Bills part of the order before it ships. Nothing posts to the GL; the shipment invoice releases it from Customer Deposits.'}
                </p>
              </HoverCardContent>
            </HoverCard>
            {covered && (
              <HoverCard openDelay={300}>
                <HoverCardTrigger asChild>
                  <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border cursor-help bg-violet-50 border-violet-200 text-violet-700">
                    <div className="w-1.5 h-1.5 rounded-full bg-violet-500" />
                    <span className="text-[11px]" style={{ fontWeight: 600 }}>Part Billed on Advance</span>
                  </div>
                </HoverCardTrigger>
                <HoverCardContent side="top" className="w-[280px] p-3 z-[300] bg-white border border-border rounded-lg shadow-md">
                  <p className="text-[12px] text-foreground leading-snug" style={{ fontWeight: 600 }}>Advance Coverage</p>
                  <p className="text-[11px] text-slate-500 leading-relaxed mt-1.5">
                    Part of these lines was billed on an advance invoice. Each line total shows only what is still owed, so nothing is billed twice.
                  </p>
                </HoverCardContent>
              </HoverCard>
            )}
          </div>
          <div className="flex items-center gap-2">
            {selectedIds.size > 0 ? (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setBulkOpen(true)}
                className="h-7 px-2.5 text-[10px] font-bold bg-red-50 text-red-600 border-red-100 hover:bg-red-600 hover:text-white shadow-none rounded-md tracking-wider gap-1.5 border transition-all animate-in fade-in slide-in-from-right-1"
              >
                <Trash2 className="w-3 h-3" />
                Remove {selectedIds.size} Item{selectedIds.size === 1 ? '' : 's'}
              </Button>
            ) : (
              <>
                <div className="relative w-[200px] sm:w-[240px] shrink-0 hidden sm:block">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search items…"
                    className="h-8 pl-8 pr-8 text-[11px] bg-white border-slate-200 shadow-none rounded-md focus-visible:ring-1 focus-visible:ring-primary/20 focus-visible:border-primary placeholder:text-slate-400"
                  />
                  {search && (
                    <button type="button" onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors" aria-label="Clear search">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                {!expanded && (
                  <button
                    type="button"
                    onClick={openFull}
                    className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-white text-xs text-muted-foreground hover:bg-slate-50 hover:border-slate-300 transition-all shrink-0"
                    style={{ fontWeight: 500 }}
                    aria-label="Full View"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                    Full View
                  </button>
                )}
                {isShip && onAddMore && (
                  <>
                    <button
                      type="button"
                      onClick={onAddMore}
                      className="shrink-0 inline-flex items-center gap-1 px-2 py-[5px] rounded-md bg-white border border-primary text-primary text-[11px] hover:bg-primary/5 hover:shadow-sm transition-all duration-150"
                      style={{ fontWeight: 500 }}
                    >
                      <Plus className="w-3 h-3" />
                      Add More Items
                    </button>
                    <button
                      type="button"
                      onClick={onAddMore}
                      className="shrink-0 inline-flex items-center gap-1 px-2 py-[5px] rounded-md bg-white border border-primary text-primary text-[11px] hover:bg-primary/5 hover:shadow-sm transition-all duration-150"
                      style={{ fontWeight: 500 }}
                    >
                      <Plus className="w-3 h-3" />
                      Add More Shipments
                    </button>
                  </>
                )}
              </>
            )}
            {expanded && (
              <button
                type="button"
                onClick={() => (!closing ? collapse() : undefined)}
                className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-slate-500 hover:bg-muted transition-all shrink-0"
                aria-label="Close full view"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Source pills band: one per shipment, or the order / quote. */}
        <div className="px-3 sm:px-4 py-2 border-b border-[#EEF2F6] bg-white flex items-center gap-2 shrink-0">
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide items-center flex-1 min-w-0">
            {tabs.map((tab) => {
              const isAdvTab = tab.kind !== 'shipment';
              const active = activeTab === tab.key;
              const removable = isShip && tabs.length > 1;
              return (
                <HoverCard key={tab.key} openDelay={1200} closeDelay={120} open={tabToRemove || itemToRemove ? false : undefined}>
                  <HoverCardTrigger asChild>
                    <div
                      className={`group flex items-center gap-1.5 pl-2.5 ${removable ? 'pr-1' : 'pr-2.5'} py-1 rounded-lg border transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                        isAdvTab
                          ? `border-dashed ${active ? 'bg-violet-50 text-violet-800 border-violet-400' : 'bg-white text-slate-700 border-violet-400 hover:border-violet-500'}`
                          : active
                            ? 'bg-accent text-primary border-primary/30'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <button type="button" onClick={() => onTab(tab.key)} className="flex items-center gap-1.5 text-[12px]" style={{ fontWeight: 500 }}>
                        {tab.kind === 'shipment' ? (
                          <Truck className={`w-3 h-3 ${active ? 'text-primary/70' : 'text-slate-400'}`} />
                        ) : (
                          <ShoppingCart className={`w-3 h-3 ${active ? 'text-violet-600' : 'text-slate-400'}`} />
                        )}
                        <span>
                          <span className="text-slate-400" style={{ fontWeight: 600 }}>{tab.kind === 'shipment' ? 'Shipment No.' : tab.kind === 'so' ? 'SO No.' : 'Quote No.'}</span> {tab.number}
                        </span>
                        {isAdvTab && (
                          <span className="px-1.5 py-[1px] rounded text-[9.5px] bg-violet-100 text-violet-700" style={{ fontWeight: 700 }}>
                            Advance
                          </span>
                        )}
                      </button>
                      {removable && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setTabToRemove(tab);
                          }}
                          className="w-5 h-5 rounded-full flex items-center justify-center text-red-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                          aria-label={`Remove ${tab.number}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </HoverCardTrigger>
                  {renderBreakdown(tab)}
                </HoverCard>
              );
            })}
          </div>
        </div>

        <div className="min-h-0 overflow-y-scroll overflow-x-hidden items-scroll pb-4">
          <table className="w-full table-fixed text-left border-collapse text-[11px]">
            {/* Every rendered column owns a <col> (10/30): the Discount and
                Prepayment columns had none, so the fixed layout overflowed
                and crushed Items and GL Account. Widths follow the vendor
                line table; the optional columns borrow from Items. */}
            <colgroup>
              {expanded ? (
                <>
                  <col className="w-[4%]" />
                  <col />
                  <col className="w-[8%]" />
                  <col className="w-[10%]" />
                  <col className="w-[10%]" />
                  <col className={isShip ? 'w-[8%]' : 'w-[15%]'} />
                  {showDiscount && <col className="w-[9%]" />}
                  {showPrepay && <col className="w-[10%]" />}
                  {isShip && <col className="w-[15%]" />}
                  <col className="w-[5%]" />
                </>
              ) : (
                <>
                  <col className="w-[30px]" />
                  <col />
                  {/* Vendor line-table widths (user 11/4). */}
                  <col className="w-[98px]" />
                  <col className="w-[146px]" />
                  <col className={isShip ? 'w-[124px]' : 'w-[96px]'} />
                  <col className={isShip ? 'w-[98px]' : 'w-[150px]'} />
                  {showDiscount && <col className="w-[120px]" />}
                  {showPrepay && <col className="w-[116px]" />}
                  {isShip && <col className="w-[150px]" />}
                  <col className="w-[34px]" />
                </>
              )}
            </colgroup>
            <thead className="sticky top-0 z-30 bg-gray-50 border-b border-gray-100 text-slate-500 text-[11px]" style={{ fontWeight: 500 }}>
              <tr>
                <th className="px-0 py-2 sticky left-0 bg-gray-50 border-r border-gray-100 z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                  <div className="flex items-center justify-center">
                    <Checkbox
                      checked={shown.length > 0 && selectedIds.size === shown.length}
                      disabled={termLocked}
                      onCheckedChange={() => setSelectedIds(selectedIds.size === shown.length ? new Set() : new Set(shown.map((l) => l.key)))}
                      className="rounded border-border"
                      aria-label="Select all lines"
                    />
                  </div>
                </th>
                <th className="px-4 py-2 whitespace-nowrap">
                  Items
                  <span className="ml-1.5 text-slate-400" style={{ fontWeight: 500 }}>
                    {q ? `(${shown.length} of ${tabLines.length})` : `(${tabLines.length})`}
                  </span>
                </th>
                <th className="px-2 py-2 text-right leading-tight">Shipped / Ordered</th>
                <th className="px-2 py-2 text-right whitespace-nowrap">{isShip ? 'Price per Unit' : 'Available to Advance'}</th>
                <th className={`px-2 py-2 text-right leading-tight ${isShip ? 'bg-emerald-50/40 text-emerald-700' : 'bg-violet-50/50 text-violet-700'}`}>{isShip ? 'Invoice Qty' : 'Advance %'}</th>
                <th className={`px-2 py-2 text-right whitespace-nowrap ${isShip ? '' : 'bg-violet-50/50 text-violet-700'}`}>{isShip ? 'Total' : 'Advance Amount'}</th>
                {showDiscount && <th className="px-2 py-2 text-right whitespace-nowrap">Discount</th>}
                {showPrepay && <th className="px-2 py-2 text-right whitespace-nowrap bg-violet-50/50 text-violet-700">Prepayment</th>}
                {isShip && <th className="px-3 py-2">GL Account</th>}
                <th className="px-0 py-2 text-center sticky right-0 bg-gray-50 border-l border-gray-100 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.05)] z-20 whitespace-nowrap">
                  {expanded && selectedIds.size === 0 ? 'Action' : <span aria-hidden>&nbsp;</span>}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {shown.length === 0 && (
                /* Table Empty States Standard (11/3/26): compact, with Did you mean. */
                <TableEmptyRow
                  colSpan={colCount}
                  compact
                  kind={q && tabLines.length > 0 ? 'no-results' : 'no-data'}
                  entity={{ singular: 'line item', plural: 'line items' }}
                  title={isShip ? 'No lines left to invoice' : 'No lines on this order yet'}
                  description={isShip ? 'Every line on this shipment is already billed.' : 'Lines added to the order show up here.'}
                  searchQuery={search}
                  suggestion={q ? findSearchSuggestion(search, tabLines.flatMap((l) => [l.sku, l.description])) : null}
                  onApplySuggestion={setSearch}
                  onClearSearch={() => setSearch('')}
                />
              )}
              {shown.map((item) => {
                const isSelected = selectedIds.has(item.key);
                const m = lineMoney.get(item.key) ?? { gross: 0, covered: 0, total: 0 };
                const priceChanged = Math.abs(item.unitPrice - item.originalUnitPrice) > EPS;
                const rowLocked = !isShip && termLocked;
                // Shipment row
                const avail = shipAvail.get(item.shipmentLineId ?? '') ?? 0;
                const isOverBilled = isShip && item.invoiceQty > avail + EPS;
                // FAD 11/2: also over what is left on the order line.
                const left = orderedLeft?.get(item.key);
                const isOverOrdered = isShip && !isOverBilled && left !== undefined && item.invoiceQty > left + EPS;
                const dup = duplicates?.get(item.key);
                const isUnderBilled = isShip && !isOverBilled && !isOverOrdered && item.invoiceQty > EPS && item.invoiceQty < avail - EPS;
                const qtyErr = isOverBilled || isOverOrdered || !!dup || hasError(fid.qty(item.key));
                // Advance row
                const value = round2(item.orderedQty * item.unitPrice);
                const cap = advCap.get(item.soLineId ?? '') ?? 0;
                const amount = item.advanceAmount ?? 0;
                const advOver = !isShip && amount > cap + EPS;
                const advErr = advOver || hasError(fid.advAmount(item.key));
                const setPct = (pct: number) => onAdvance(item.key, { advancePercent: pct, advanceAmount: round2((value * pct) / 100) });
                const setAmt = (amt: number) => onAdvance(item.key, { advanceAmount: amt, advancePercent: value > 0 ? round2((amt / value) * 100) : 0 });
                const ratio = ratioBySo.get(item.soNumber ?? '') ?? 0;
                return (
                  <tr key={item.key} className={`transition-colors group ${rowLocked ? 'opacity-60 bg-slate-50/70' : isSelected ? 'bg-blue-50' : 'hover:bg-[#F5F9FF]'}`}>
                    <td
                      className={`px-0 py-2 sticky left-0 z-10 border-r border-gray-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] transition-colors ${
                        rowLocked ? 'bg-slate-50' : isSelected ? 'bg-blue-50' : 'bg-white group-hover:bg-[#F5F9FF]'
                      }`}
                    >
                      <div className="flex items-center justify-center">
                        <Checkbox
                          checked={isSelected}
                          disabled={rowLocked}
                          onCheckedChange={() => {
                            const next = new Set(selectedIds);
                            if (next.has(item.key)) next.delete(item.key);
                            else next.add(item.key);
                            setSelectedIds(next);
                          }}
                          className="rounded border-border"
                          aria-label={`Select ${item.sku}`}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-3">
                        <LineItemImage sku={item.sku} src={imageForSku(item.sku)} alt={item.sku} onPreview={() => setPreview({ src: imageForSku(item.sku), sku: item.sku, description: item.description })} />
                        <div className="min-w-0">
                          {/* Pricing-rule pill rides the SKU line (user 11/4), so the
                              row keeps the vendor height: no extra line under the price. */}
                          <div className="flex items-center gap-1.5 min-w-0">
                            <a
                              href={ITEMS_MODULE_URL}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-gray-900 hover:text-primary hover:underline decoration-primary/60 underline-offset-2 transition-colors inline-block"
                              style={{ fontWeight: 600 }}
                            >
                              {highlightText(item.sku, search)}
                            </a>
                            {isShip && item.pricingAdjustments?.length ? <PricingRuleChip line={item} currency={currency} /> : null}
                            {!isShip && lockedUnits && (item.advanceAmount ?? 0) > EPS && lockedUnits.byLine.get(item.key) ? (
                              <LockedUnitsChip
                                id={fid.units(item.key)}
                                sku={item.sku}
                                uom={item.uom}
                                info={lockedUnits.byLine.get(item.key)!}
                                error={hasError(fid.units(item.key))}
                                onChange={(units) => lockedUnits.onChange(item.key, units)}
                              />
                            ) : null}
                          </div>
                          <LineItemDescription description={item.description} query={search} />
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-2 text-right whitespace-nowrap">
                      <span className="text-[12px] font-semibold text-gray-900">{fmtQty(item.shippedQty)}</span>
                      <span className="text-[11px] text-gray-300 mx-1">/</span>
                      <span className="text-[12px] font-medium text-gray-500">{fmtQty(item.orderedQty)}</span>
                      <span className="text-[10px] font-medium text-gray-400 ml-1">{item.uom}</span>
                    </td>

                    {isShip ? (
                      <td className={`px-2 py-2 transition-colors ${priceChanged ? 'bg-amber-50/60' : ''}`}>
                        <div className="relative w-full">
                          {!canChangePrice ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="absolute left-1.5 top-1/2 -translate-y-1/2 z-10 inline-flex items-center justify-center w-4 h-4 text-slate-300 cursor-help">
                                  <Lock className="w-3 h-3" />
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-[260px] p-2.5 bg-white border border-border rounded-lg shadow-md z-[300]">
                                <p className="text-[11px] text-foreground leading-snug" style={{ fontWeight: 600 }}>Price from the sales order</p>
                                <p className="text-[11px] text-slate-500 leading-snug mt-0.5">Changing the price needs the Change Price permission.</p>
                              </TooltipContent>
                            </Tooltip>
                          ) : priceChanged ? (
                            <HoverCard openDelay={300} closeDelay={120}>
                              <HoverCardTrigger asChild>
                                <button
                                  type="button"
                                  tabIndex={-1}
                                  className="absolute left-1.5 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-4 h-4 rounded-full text-amber-500 hover:bg-amber-100 transition-colors cursor-help z-10"
                                  aria-label="Differs from the SO price"
                                >
                                  <AlertTriangle className="w-3 h-3" />
                                </button>
                              </HoverCardTrigger>
                              <HoverCardContent side="top" className="max-w-[260px] p-2.5 bg-white border border-border rounded-lg shadow-md z-[300]">
                                <p className="text-[11px] text-foreground leading-snug" style={{ fontWeight: 600 }}>Differs from the SO price</p>
                                <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
                                  SO {item.soNumber} prices this item at {money(item.originalUnitPrice, currency)} per {item.uom}.{' '}
                                  <FixLink onClick={() => onPrice(item.key, item.originalUnitPrice)} label={`Revert unit price to ${item.originalUnitPrice}`}>
                                    Revert to {money(item.originalUnitPrice, currency)}
                                  </FixLink>
                                </p>
                              </HoverCardContent>
                            </HoverCard>
                          ) : (
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-slate-500" style={{ fontWeight: 600 }}>$</span>
                          )}
                          <Input
                            id={fid.price(item.key)}
                            type="text"
                            inputMode="decimal"
                            readOnly={!canChangePrice}
                            value={
                              priceDrafts[item.key] ??
                              (Number.isInteger(item.unitPrice) ? formatMoneyText(String(item.unitPrice)) : formatMoneyText(item.unitPrice.toFixed(2)))
                            }
                            onChange={(e) => {
                              if (!canChangePrice) return;
                              const raw = e.target.value.replace(/[^\d.]/g, '');
                              setPriceDrafts((prev) => ({ ...prev, [item.key]: raw }));
                              onPrice(item.key, Number(raw) || 0);
                            }}
                            onBlur={() =>
                              setPriceDrafts((prev) => {
                                const next = { ...prev };
                                delete next[item.key];
                                return next;
                              })
                            }
                            className={`h-7 pl-5 text-right text-[11px] shadow-none rounded-md font-semibold focus-visible:ring-1 ${
                              !canChangePrice
                                ? 'pl-7 bg-slate-50 border-slate-200 text-slate-500 cursor-not-allowed'
                                : priceChanged
                                  ? 'pl-7 bg-white border-amber-400 text-amber-700 focus-visible:ring-amber-100 focus-visible:border-amber-500'
                                  : 'text-gray-900 bg-white border-slate-200 hover:border-slate-300 focus-visible:ring-primary/20 focus-visible:border-primary'
                            }`}
                            style={{ paddingRight: `${14 + (item.uom.length + 1) * 6}px` }}
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none whitespace-nowrap" style={{ fontWeight: 500 }}>
                            /{item.uom}
                          </span>
                        </div>
                      </td>
                    ) : (
                      <td className="px-2 py-2 text-right whitespace-nowrap">
                        <div className="text-[12px] font-semibold text-gray-900">{money(cap, currency)}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">of {money(value, currency)}</div>
                      </td>
                    )}

                    {isShip ? (
                      <td id={fid.qty(item.key)} className={`px-2 py-2 transition-colors ${qtyErr ? 'bg-red-50/60' : isUnderBilled ? 'bg-amber-50/60' : 'bg-emerald-50/[0.4]'}`}>
                        <div className="relative w-full">
                          <QtyInput
                            value={item.invoiceQty}
                            onChange={(n) => onQty(item.key, n)}
                            className={`h-7 w-full text-right text-[11px] shadow-none rounded-md font-semibold focus-visible:ring-1 ${
                              qtyErr
                                ? 'pl-7 bg-white border-red-400 ring-2 ring-red-100 text-red-600 focus-visible:ring-red-100 focus-visible:border-red-500'
                                : isUnderBilled
                                  ? 'pl-7 bg-white border-amber-400 text-amber-700 focus-visible:ring-amber-100 focus-visible:border-amber-500'
                                  : 'pl-2 text-emerald-700 bg-white border-emerald-200 focus-visible:ring-emerald-100'
                            }`}
                            style={{ paddingRight: `${14 + item.uom.length * 6}px` }}
                          />
                          {isOverOrdered && left !== undefined && (
                            <CellWarn tone="red" label="Invoice quantity exceeds what is left on the order">
                              <p className="text-[11px] text-foreground leading-snug" style={{ fontWeight: 600 }}>Exceeds Ordered</p>
                              <div className="mt-1 space-y-0.5 text-[11px] text-slate-500 leading-snug">
                                <p>
                                  Ordered on SO {item.soNumber}: <span className="text-foreground" style={{ fontWeight: 600 }}>{fmtQty(item.orderedQty)} {item.uom}</span>
                                </p>
                                <p>
                                  Already invoiced: <span className="text-foreground" style={{ fontWeight: 600 }}>{fmtQty(Math.max(0, round2(item.orderedQty - left)))} {item.uom}</span>
                                </p>
                                <p>
                                  Remaining:{' '}
                                  <FixLink onClick={() => onQty(item.key, left)} label={`Set invoice quantity to ${fmtQty(left)} ${item.uom}`}>
                                    {fmtQty(left)} {item.uom}
                                  </FixLink>
                                </p>
                              </div>
                              <p className="text-[11px] text-slate-500 leading-snug mt-1.5">You can bill up to {fmtQty(left)} more on this order line. Click the number to reset it.</p>
                            </CellWarn>
                          )}
                          {(isUnderBilled || isOverBilled) && (
                            <CellWarn tone={isOverBilled ? 'red' : 'amber'} label={isOverBilled ? 'Invoice quantity exceeds what is left' : 'Invoicing less than what is left'}>
                              <p className="text-[11px] text-foreground leading-snug" style={{ fontWeight: 600 }}>{isOverBilled ? 'Exceeds Remaining' : 'Below Remaining'}</p>
                              <div className="mt-1 space-y-0.5 text-[11px] text-slate-500 leading-snug">
                                <p>
                                  Shipped: <span className="text-foreground" style={{ fontWeight: 600 }}>{fmtQty(item.shippedQty)} {item.uom}</span>
                                </p>
                                <p>
                                  Already invoiced: <span className="text-foreground" style={{ fontWeight: 600 }}>{fmtQty(Math.max(0, item.shippedQty - avail))} {item.uom}</span>
                                </p>
                                <p>
                                  Remaining:{' '}
                                  <FixLink onClick={() => onQty(item.key, avail)} label={`Set invoice quantity to ${fmtQty(avail)} ${item.uom}`}>
                                    {fmtQty(avail)} {item.uom}
                                  </FixLink>
                                </p>
                              </div>
                              <p className="text-[11px] text-slate-500 leading-snug mt-1.5">
                                {isOverBilled
                                  ? `You can bill up to ${fmtQty(avail)} on this line. Click the number to reset it.`
                                  : `You're invoicing less than the remaining ${fmtQty(avail)} ${item.uom}. The other ${fmtQty(round2(avail - item.invoiceQty))} ${item.uom} will stay open for a future invoice.`}
                              </p>
                            </CellWarn>
                          )}
                          <span
                            className={`absolute right-2 top-1/2 -translate-y-1/2 text-[10px] pointer-events-none whitespace-nowrap ${qtyErr ? 'text-red-400' : isUnderBilled ? 'text-amber-500' : 'text-emerald-700/70'}`}
                            style={{ fontWeight: 500 }}
                          >
                            {item.uom}
                          </span>
                        </div>
                        {dup ? (
                          <p className="text-[10px] text-red-500 mt-1 leading-tight" style={{ fontWeight: 500 }}>
                            Already invoiced.{' '}
                            <a
                              href={`/customer-invoices/${encodeURIComponent(dup.invoiceNumber)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary underline decoration-primary/60 underline-offset-2 hover:text-blue-700"
                              style={{ fontWeight: 500 }}
                            >
                              View {dup.invoiceNumber}
                            </a>
                          </p>
                        ) : isOverBilled ? (
                          <p className="text-[10px] text-red-500 mt-1 leading-tight" style={{ fontWeight: 500 }}>
                            You can bill up to {fmtQty(avail)} on this line.
                          </p>
                        ) : isOverOrdered && left !== undefined ? (
                          <p className="text-[10px] text-red-500 mt-1 leading-tight" style={{ fontWeight: 500 }}>
                            Only {fmtQty(left)} left on the order.
                          </p>
                        ) : null}
                      </td>
                    ) : (
                      <td className="px-2 py-2 bg-violet-50/50">
                        <div className="relative w-full">
                          <QtyInput
                            value={item.advancePercent ?? 0}
                            disabled={rowLocked}
                            onChange={setPct}
                            className={`h-7 w-full text-right text-[11px] shadow-none rounded-md font-semibold focus-visible:ring-1 ${
                              rowLocked ? 'pl-7 bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed' : 'pl-2 text-violet-700 bg-white border-violet-200 focus-visible:ring-violet-100 focus-visible:border-violet-400'
                            }`}
                            style={{ paddingRight: '20px' }}
                          />
                          {rowLocked && (
                            <CellWarn tone="slate" label="Apply a prepayment or split term first">
                              <p className="text-[11px] text-foreground leading-snug" style={{ fontWeight: 600 }}>Pick a term first</p>
                              <p className="text-[11px] text-slate-500 leading-snug mt-0.5">The order carries a net term. Use Change on Payment Terms to pick a prepayment or split term.</p>
                            </CellWarn>
                          )}
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] pointer-events-none whitespace-nowrap text-violet-700/70" style={{ fontWeight: 500 }}>%</span>
                        </div>
                      </td>
                    )}

                    {isShip ? (
                      <td className="px-2 py-2 text-right">
                        <div className="text-[11px] font-semibold text-gray-900 whitespace-nowrap">{money(m.total, currency)}</div>
                        {m.covered > EPS && (
                          <div className="text-[10px] text-slate-400 leading-tight mt-0.5">
                            of {money(m.gross, currency)} · {Math.round(ratio * 100)}% on advance
                          </div>
                        )}
                      </td>
                    ) : (
                      <td id={fid.advAmount(item.key)} className={`px-2 py-2 transition-colors ${advErr ? 'bg-red-50/60' : 'bg-violet-50/50'}`}>
                        <div className="relative w-full">
                          {advOver ? (
                            <CellWarn tone="red" label="Advance amount exceeds what is left">
                              <p className="text-[11px] text-foreground leading-snug" style={{ fontWeight: 600 }}>Exceeds Remaining</p>
                              <div className="mt-1 space-y-0.5 text-[11px] text-slate-500 leading-snug">
                                <p>
                                  Ordered value: <span className="text-foreground" style={{ fontWeight: 600 }}>{money(value, currency)}</span>
                                </p>
                                <p>
                                  Already advance-billed: <span className="text-foreground" style={{ fontWeight: 600 }}>{money(Math.max(0, value - cap), currency)}</span>
                                </p>
                                <p>
                                  Available:{' '}
                                  <FixLink onClick={() => setAmt(cap)} label={`Set advance amount to ${money(cap, currency)}`}>
                                    {money(cap, currency)}
                                  </FixLink>
                                </p>
                              </div>
                              <p className="text-[11px] text-slate-500 leading-snug mt-1.5">You can advance-bill up to {money(cap, currency)} on this line. Click the amount to reset it.</p>
                            </CellWarn>
                          ) : (
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-slate-500 pointer-events-none" style={{ fontWeight: 600 }}>$</span>
                          )}
                          <MoneyInput
                            fluid
                            value={amount}
                            onValueChange={setAmt}
                            className={`flex h-7 w-full min-w-0 rounded-md border py-1 text-right text-[11px] shadow-none outline-none font-semibold focus-visible:ring-1 ${
                              rowLocked
                                ? 'pl-5 pr-2 bg-slate-50 border-slate-200 text-slate-400 pointer-events-none'
                                : advErr
                                  ? 'pl-7 pr-2 bg-white border-red-400 text-red-600 focus-visible:ring-red-100'
                                  : 'pl-5 pr-2 bg-white border-violet-200 text-violet-700 focus-visible:ring-violet-100 focus-visible:border-violet-400'
                            }`}
                          />
                        </div>
                        {advOver && (
                          <p className="text-[10px] text-red-500 mt-1 leading-tight" style={{ fontWeight: 500 }}>
                            You can advance-bill up to {money(cap, currency)} on this line.
                          </p>
                        )}
                      </td>
                    )}

                    {showDiscount && discount && (
                      <td className="px-2 py-2 text-right whitespace-nowrap">
                        <DiscountPill amount={round2((m.total * discount.percent) / 100)} discount={discount} currency={currency} />
                      </td>
                    )}
                    {showPrepay && prepay && (() => {
                      const value = prepay.values[item.key] ?? 0;
                      const max = prepay.maxFor(item.key);
                      const over = value > max + EPS;
                      return (
                        <td className={`px-2 py-2 transition-colors ${over ? 'bg-red-50/60' : 'bg-violet-50/50'}`}>
                          {/* Prepayment wears the system's violet identity (10/30), same as the
                              Prepaid pills and the Prepayment applied line.
                              Single-line row like the vendor table (10/30):
                              the cap lives on hover, the helper line only
                              shows when the entry is over it. */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="relative w-full">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-slate-500 pointer-events-none" style={{ fontWeight: 600 }}>$</span>
                                <MoneyInput
                                  fluid
                                  value={value}
                                  onValueChange={(n) => prepay.onChange(item.key, n)}
                                  className={`flex h-7 w-full min-w-0 rounded-md border py-1 pl-5 pr-2 text-right text-[11px] shadow-none outline-none font-semibold focus-visible:ring-1 ${
                                    over ? 'bg-white border-red-400 text-red-600 focus-visible:ring-red-100' : 'bg-white border-violet-200 text-violet-700 focus-visible:ring-violet-100 focus-visible:border-violet-400'
                                  }`}
                                />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-[240px] p-2.5 bg-white border border-border rounded-lg shadow-md z-[300]">
                              <p className="text-[11px] text-slate-500 leading-snug">
                                Up to <span className="text-foreground" style={{ fontWeight: 600 }}>{money(max, currency)}</span> from {prepayCaption ?? "the customer's held deposits"}.
                              </p>
                            </TooltipContent>
                          </Tooltip>
                          {over && (
                            <button type="button" onClick={() => prepay.onChange(item.key, max)} className="text-[10px] text-red-500 mt-1 leading-tight hover:underline cursor-pointer text-left" style={{ fontWeight: 500 }}>
                              Up to {money(max, currency)}. Click to set.
                            </button>
                          )}
                        </td>
                      );
                    })()}
                    {isShip && (
                      <td className="px-3 py-2">
                        <GLAccountPicker
                          id={fid.rev(item.key)}
                          value={item.glAccount}
                          defaultValue={item.glAccount}
                          accounts={REVENUE_ACCOUNTS}
                          onChange={() => undefined}
                          disabled
                          error={!item.glAccount}
                          lockedTitle={item.glAccount ? undefined : 'No revenue account'}
                          lockedBody={
                            item.glAccount
                              ? "Mapped from the item master, or the customer's default. Open the item to change it."
                              : `Set a revenue account on ${item.sku} first.`
                          }
                        />
                      </td>
                    )}
                    <td
                      className={`px-0 py-2 text-center sticky right-0 z-10 border-l border-gray-100 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.05)] transition-colors ${
                        rowLocked ? 'bg-slate-50' : isSelected ? 'bg-blue-50' : 'bg-white group-hover:bg-[#F5F9FF]'
                      }`}
                    >
                      {selectedIds.size === 0 && !rowLocked && (
                        <div className="flex items-center justify-center">
                          <button
                            type="button"
                            onClick={() => setItemToRemove(item)}
                            className="p-1 hover:bg-red-50 text-gray-300 hover:text-red-500 rounded-md transition-colors"
                            aria-label={`Remove ${item.sku}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {/* Add Line removed (user 11/4): shipment lines come from the
              shipment only; saved free-text lines still show. */}
          {isShip && manual && manualLines.length > 0 && (
            <ManualLinesBlock lines={manualLines} lineMoney={lineMoney} currency={manual.currency} hasError={hasError} onAdd={manual.onAdd} onChange={manual.onChange} onRemove={manual.onRemove} />
          )}
        </div>
      </div>

      <ItemQuickView preview={preview} partnerName={customerName} onClose={() => setPreview(null)} />
      <DestructiveConfirm
        open={!!itemToRemove}
        chip="Remove Item"
        title={`Remove item ${itemToRemove?.sku ?? ''}?`}
        body={
          isShip
            ? `The line comes off this invoice. Its quantity stays on shipment ${itemToRemove?.shipmentNumber ?? ''} and can be billed on a future invoice.`
            : 'The line comes off this advance invoice. Its value stays billable on a later invoice.'
        }
        confirmLabel="Yes, Remove It"
        cancelLabel="Keep It on the Invoice"
        onConfirm={() => {
          if (itemToRemove) onRemoveLines([itemToRemove.key]);
          setItemToRemove(null);
        }}
        onCancel={() => setItemToRemove(null)}
      />
      <DestructiveConfirm
        open={bulkOpen}
        chip="Remove Items"
        title={`Remove ${selectedIds.size} item${selectedIds.size === 1 ? '' : 's'}?`}
        body={
          isShip
            ? 'The selected lines come off this invoice, and their quantities stay billable on their shipments.'
            : 'The selected lines come off this advance invoice, and their value stays billable later.'
        }
        confirmLabel="Yes, Remove Them"
        cancelLabel="Keep Them on the Invoice"
        onConfirm={() => {
          onRemoveLines([...selectedIds]);
          setSelectedIds(new Set());
          setBulkOpen(false);
        }}
        onCancel={() => setBulkOpen(false)}
      />
      <DestructiveConfirm
        open={!!tabToRemove}
        chip="Remove Shipment"
        title={`Remove shipment ${tabToRemove?.number ?? ''}?`}
        body="It leaves this invoice and every line it brought along is cleared. The shipment itself is untouched and stays ready to invoice."
        confirmLabel="Yes, Remove It"
        cancelLabel="Keep It on the Invoice"
        onConfirm={() => {
          if (tabToRemove) onRemoveTab(tabToRemove.key);
          setTabToRemove(null);
        }}
        onCancel={() => setTabToRemove(null)}
      />
    </section>
  );
}

// ── Standalone card ──────────────────────────────────────────────────

export function StandaloneLinesCard({
  lines,
  currency,
  lineMoney,
  attempted,
  hasError,
  cardError,
  onChange,
  onAdd,
  onAddTemplate,
  onRemove,
  discount,
}: {
  lines: FormLine[];
  currency: string;
  lineMoney: Map<string, LineMoney>;
  attempted: boolean;
  hasError: (id: string) => boolean;
  cardError: boolean;
  onChange: (key: string, patch: Partial<FormLine>) => void;
  onAdd: () => void;
  onAddTemplate: (t: ChargeTemplate) => void;
  onRemove: (keys: string[]) => void;
  /** Early-pay discount from the payment term (user 11/4). */
  discount?: EarlyPayDiscount;
}) {
  const showDiscount = !!discount && discount.percent > 0;
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [glKey, setGlKey] = useState<string | null>(null);
  const [toRemove, setToRemove] = useState<{ key: string; label: string } | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const glLine = lines.find((l) => l.key === glKey);

  return (
    <section id={fid.lines} className="scroll-mt-4">
      <div className={`rounded-lg border bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)] overflow-hidden ${cardError ? 'border-red-300 ring-2 ring-red-100' : 'border-border'}`}>
        <div className="px-3 sm:px-4 py-2 sm:py-2.5 border-b border-[#EEF2F6] bg-[#FAFBFC] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs sm:text-[13px] text-foreground" style={{ fontWeight: 600 }}>Invoice Line Items</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full border bg-teal-50 border-teal-200 text-teal-700 text-[11px]" style={{ fontWeight: 600 }}>
              Manual Entry
            </span>
          </div>
          <div className="flex items-center gap-2">
            {selected.size > 0 ? (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setBulkOpen(true)}
                className="h-7 px-2.5 text-[10px] font-bold bg-red-50 text-red-600 border-red-100 hover:bg-red-600 hover:text-white shadow-none rounded-md tracking-wider gap-1.5 border transition-all animate-in fade-in slide-in-from-right-1"
              >
                <Trash2 className="w-3 h-3" />
                Remove {selected.size} Item{selected.size === 1 ? '' : 's'}
              </Button>
            ) : (
              <>
                {/* Add from Template removed (user 11/4). */}
                <button
                  type="button"
                  onClick={onAdd}
                  className="shrink-0 inline-flex items-center gap-1 px-2 py-[5px] rounded-md bg-white border border-primary text-primary text-[11px] hover:bg-primary/5 hover:shadow-sm transition-all duration-150"
                  style={{ fontWeight: 500 }}
                >
                  <Plus className="w-3 h-3" />
                  Add More Items
                </button>
              </>
            )}
          </div>
        </div>

        <div className="overflow-x-auto relative">
          <table className="w-full text-left border-collapse min-w-[720px]">
            <thead className="bg-gray-50 border-b border-gray-100 text-slate-500 text-[11px]" style={{ fontWeight: 500 }}>
              <tr>
                <th className="pl-3 pr-1 py-2 w-[36px]">
                  <div className="flex items-center justify-center">
                    <Checkbox
                      checked={lines.length > 0 && selected.size === lines.length}
                      onCheckedChange={() => setSelected(selected.size === lines.length ? new Set() : new Set(lines.map((l) => l.key)))}
                      className="rounded border-border"
                      aria-label="Select all lines"
                    />
                  </div>
                </th>
                <th className="px-1.5 py-2 w-[64px] text-center whitespace-nowrap" style={{ fontWeight: 500 }}>Line No.</th>
                <th className="px-1.5 py-2 w-[180px]" style={{ fontWeight: 500 }}>
                  <span className="inline-flex items-center gap-1.5">
                    GL Account
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex items-center justify-center cursor-help">
                          <Info className="w-3 h-3 text-slate-300 hover:text-slate-500 transition-colors" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[280px] z-[300]">
                        <p className="text-[11px] text-foreground" style={{ fontWeight: 600 }}>Revenue account</p>
                        <p className="text-[11px] text-slate-500 leading-snug mt-0.5">Filled in from the charge template when you add one. You can change it per line.</p>
                        <p className="text-[11px] text-slate-500 leading-snug mt-1.5">Only active revenue accounts are listed, and every line needs one before you can submit.</p>
                      </TooltipContent>
                    </Tooltip>
                  </span>
                </th>
                <th className="px-1.5 py-2" style={{ fontWeight: 500 }}>
                  Description<span className="text-red-500">*</span>
                  <span className="ml-1.5 text-slate-400" style={{ fontWeight: 500 }}>({lines.length})</span>
                </th>
                {/* Quantity × Rate = Amount (FAD 11/2). */}
                <th className="px-1.5 py-2 w-[84px] text-right" style={{ fontWeight: 500 }}>Quantity</th>
                <th className="px-1.5 py-2 w-[120px] text-right" style={{ fontWeight: 500 }}>Rate</th>
                <th className="px-1.5 py-2 w-[110px] text-right" style={{ fontWeight: 500 }}>Amount</th>
                {showDiscount && <th className="px-1.5 py-2 w-[130px] text-right" style={{ fontWeight: 500 }}>Discount</th>}
                <th className="px-1.5 py-2 w-9 text-center" style={{ fontWeight: 500 }}>Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {lines.map((item, index) => {
                const glMissing = hasError(fid.rev(item.key));
                const descErr = hasError(fid.desc(item.key));
                const amount = lineMoney.get(item.key)?.total ?? 0;
                const qtyErr = hasError(fid.qty(item.key));
                return (
                  <tr key={item.key} className={`transition-colors group ${selected.has(item.key) ? 'bg-blue-50' : 'hover:bg-gray-50/50'}`}>
                    <td className="pl-3 pr-1 py-2">
                      <div className="flex items-center justify-center">
                        <Checkbox
                          checked={selected.has(item.key)}
                          onCheckedChange={() => {
                            const next = new Set(selected);
                            if (next.has(item.key)) next.delete(item.key);
                            else next.add(item.key);
                            setSelected(next);
                          }}
                          className="rounded border-border"
                          aria-label={`Select line ${index + 1}`}
                        />
                      </div>
                    </td>
                    <td className="px-1.5 py-2 text-center">
                      <span className="text-[12px] text-foreground" style={{ fontWeight: 400 }}>{index + 1}</span>
                    </td>
                    <td className="px-1.5 py-1.5">
                      <button
                        id={fid.rev(item.key)}
                        type="button"
                        onClick={() => setGlKey(item.key)}
                        className={`w-full inline-flex items-center justify-between gap-2 h-8 px-2 rounded-md border bg-white text-[11px] transition-colors ${
                          glMissing ? 'border-red-300 text-red-600 hover:border-red-400' : 'border-slate-200 text-foreground hover:bg-primary/[0.03] hover:border-primary/40'
                        }`}
                        style={{ fontWeight: 500 }}
                      >
                        <span className={`truncate ${item.glAccount ? '' : glMissing ? 'italic' : 'italic text-slate-400'}`}>{item.glAccount || 'No account'}</span>
                        <Settings2 className={`w-3 h-3 shrink-0 ${glMissing ? 'text-red-400' : 'text-slate-400'}`} />
                      </button>
                    </td>
                    <td className="px-1.5 py-1.5">
                      <div id={fid.desc(item.key)} className={descErr ? 'rounded-md ring-2 ring-red-100 [&_textarea]:border-red-300' : ''}>
                        <ExpandableTextarea
                          value={item.description}
                          onChange={(val) => onChange(item.key, { description: val })}
                          placeholder="Enter description..."
                          expandMode="full"
                          collapsedHeight={32}
                          portalExpand
                        />
                      </div>
                    </td>
                    <td className="px-1.5 py-1.5" id={fid.qty(item.key)}>
                      <QtyInput
                        value={item.invoiceQty}
                        onChange={(n) => onChange(item.key, { invoiceQty: n, orderedQty: n })}
                        className={`h-8 w-full text-right text-[11px] shadow-none rounded-md bg-white focus-visible:ring-1 focus-visible:ring-blue-100 ${qtyErr ? 'border-red-300 ring-2 ring-red-100' : 'border-border'}`}
                        style={{ fontWeight: 500 }}
                      />
                    </td>
                    <td className="px-1.5 py-1.5">
                      <div className="relative w-full">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-slate-500" style={{ fontWeight: 500 }}>$</span>
                        <MoneyInput
                          fluid
                          value={item.unitPrice}
                          onValueChange={(n) => onChange(item.key, { unitPrice: n, originalUnitPrice: n })}
                          placeholder="0.00"
                          className={`flex h-8 w-full min-w-0 rounded-md border bg-white pl-5 pr-2 py-1 text-right text-[11px] shadow-none outline-none focus-visible:ring-1 focus-visible:ring-blue-100 ${
                            attempted && cardError && item.unitPrice <= 0 ? 'border-red-300 ring-2 ring-red-100' : 'border-border'
                          }`}
                        />
                      </div>
                    </td>
                    <td className="px-1.5 py-1.5 text-right whitespace-nowrap">
                      <span className="text-[11px] text-foreground" style={{ fontWeight: 500 }}>{money(amount, currency)}</span>
                    </td>
                    {showDiscount && discount && (
                      <td className="px-1.5 py-1.5 text-right whitespace-nowrap">
                        <DiscountPill amount={round2((amount * discount.percent) / 100)} discount={discount} currency={currency} />
                      </td>
                    )}
                    <td className="px-1.5 py-1.5 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          const desc = item.description.trim();
                          setToRemove({ key: item.key, label: desc ? `line ${index + 1}, ${desc.length > 40 ? desc.slice(0, 40) + '…' : desc}` : `line ${index + 1}` });
                        }}
                        className="p-1 hover:bg-red-50 text-gray-300 hover:text-red-500 rounded-md transition-colors disabled:opacity-30"
                        disabled={lines.length <= 1}
                        aria-label={`Remove line ${index + 1}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {glKey && (
        <RevenueAccountModal
          open
          accounts={REVENUE_ACCOUNTS}
          value={glLine?.glAccount ?? ''}
          onPick={(a) => onChange(glKey, { glAccount: a })}
          onClose={() => setGlKey(null)}
        />
      )}
      <DestructiveConfirm
        open={!!toRemove}
        chip="Remove Item"
        title="Remove this line item?"
        body={`The ${toRemove?.label ?? 'line'} comes off this invoice and its amount leaves the total.`}
        confirmLabel="Yes, Remove It"
        cancelLabel="Keep It on the Invoice"
        onConfirm={() => {
          if (toRemove) onRemove([toRemove.key]);
          setToRemove(null);
        }}
        onCancel={() => setToRemove(null)}
      />
      <DestructiveConfirm
        open={bulkOpen}
        chip="Remove Items"
        title={`Remove ${selected.size} item${selected.size === 1 ? '' : 's'}?`}
        body="The selected lines come off this invoice and their amounts leave the total."
        confirmLabel="Yes, Remove Them"
        cancelLabel="Keep Them on the Invoice"
        onConfirm={() => {
          onRemove([...selected]);
          setSelected(new Set());
          setBulkOpen(false);
        }}
        onCancel={() => setBulkOpen(false)}
      />
    </section>
  );
}

// ── Early-pay discount pill (user 11/4): the listing's Discount pill ──

export interface EarlyPayDiscount {
  percent: number;
  /** Days after the trigger date the discount stays open. */
  days: number;
  termName: string;
}

function DiscountPill({ amount, discount, currency }: { amount: number; discount: EarlyPayDiscount; currency: string }) {
  if (amount <= EPS) return null;
  return (
    <HoverCard openDelay={150} closeDelay={80}>
      <HoverCardTrigger asChild>
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[11px] cursor-help whitespace-nowrap" style={{ fontWeight: 500 }}>
          {discount.percent}% · −{money(amount, currency)}
        </span>
      </HoverCardTrigger>
      <HoverCardContent side="top" align="end" className="w-[260px] p-3 rounded-xl border border-border shadow-lg bg-white z-[300]">
        <p className="text-[12px] text-foreground" style={{ fontWeight: 500 }}>Early-pay discount, {discount.termName}</p>
        <p className="text-[11px] text-slate-500 leading-relaxed mt-1">
          The customer takes {discount.percent}% off this line when they pay within {discount.days} day{discount.days === 1 ? '' : 's'} of the trigger date.
        </p>
      </HoverCardContent>
    </HoverCard>
  );
}

// ── FAD 11/2: pricing-rule chip (premiums and discounts in the SO price) ──

function PricingRuleChip({ line, currency }: { line: FormLine; currency: string }) {
  const adj = line.pricingAdjustments ?? [];
  const net = line.originalUnitPrice;
  const perUnit = round2(adj.reduce((a, r) => a + r.perUnit, 0));
  const list = round2(net - perUnit);
  const isDiscount = perUnit < 0;
  const label = adj.length > 1 ? `${adj.length} Rules` : adj[0].kind;
  return (
    <HoverCard openDelay={250} closeDelay={120}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          tabIndex={-1}
          className={`inline-flex items-center gap-1 px-1.5 py-px rounded-full border text-[9.5px] cursor-help shrink-0 ${
            isDiscount ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-amber-50 border-amber-200 text-amber-700'
          }`}
          style={{ fontWeight: 500 }}
          aria-label="Pricing rules on this line"
        >
          <BadgePercent className="w-2.5 h-2.5 shrink-0" />
          <span className="truncate">{label}</span>
        </button>
      </HoverCardTrigger>
      <HoverCardContent side="top" className="w-[280px] p-3 bg-white border border-border rounded-lg shadow-md z-[300]">
        <p className="text-[12px] text-foreground leading-snug" style={{ fontWeight: 500 }}>Pricing Rule</p>
        <p className="text-[11px] text-slate-500 leading-snug mt-0.5">Already inside the SO price. Shown so the customer can see how the price was set.</p>
        <div className="mt-2 rounded-lg border border-slate-100 overflow-hidden text-[11px]">
          <div className="flex items-center justify-between px-2.5 py-1.5 bg-slate-50/70">
            <span className="text-slate-500">List Price</span>
            <span className="text-foreground" style={{ fontWeight: 500 }}>{money(list, currency)}/{line.uom}</span>
          </div>
          {adj.map((r) => {
            const tone = r.perUnit < 0 ? 'text-emerald-700' : 'text-amber-700';
            const sign = r.perUnit < 0 ? '−' : '+';
            return (
              <div key={r.rule} className="px-2.5 py-1.5 border-t border-slate-100">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-foreground truncate" style={{ fontWeight: 500 }}>
                    {r.rule}
                    {r.percent !== undefined ? <span className="text-slate-400" style={{ fontWeight: 400 }}> · {Math.abs(r.percent)}%</span> : null}
                  </span>
                  <span className={tone} style={{ fontWeight: 500 }}>
                    {sign}
                    {money(Math.abs(r.perUnit), currency)}/{line.uom}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {r.kind} on this line: {sign}
                  {money(Math.abs(round2(r.perUnit * line.invoiceQty)), currency)} for {fmtQty(line.invoiceQty)} {line.uom}
                </p>
              </div>
            );
          })}
          <div className="flex items-center justify-between px-2.5 py-1.5 border-t border-slate-200 bg-slate-50/70">
            <span className="text-slate-500">Net Price</span>
            <span className="text-foreground" style={{ fontWeight: 500 }}>{money(net, currency)}/{line.uom}</span>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

// ── FAD 11/2: manual lines on a shipment invoice ─────────────────────

function ManualLinesBlock({
  lines,
  lineMoney,
  currency,
  hasError,
  onAdd,
  onChange,
  onRemove,
}: {
  lines: FormLine[];
  lineMoney: Map<string, LineMoney>;
  currency: string;
  hasError: (id: string) => boolean;
  onAdd: () => void;
  onChange: (key: string, patch: Partial<FormLine>) => void;
  onRemove: (key: string) => void;
}) {
  const [glKey, setGlKey] = useState<string | null>(null);
  const glLine = lines.find((l) => l.key === glKey);
  return (
    <div className="px-3 sm:px-4 pt-3">
      {lines.length > 0 && (
        <div className="rounded-lg border border-slate-200 overflow-hidden mb-2.5">
          <div className="px-3 py-1.5 bg-[#FAFBFC] border-b border-slate-100 flex items-center gap-1.5">
            <PenLine className="w-3 h-3 text-slate-400" />
            <span className="text-[11px] text-slate-600" style={{ fontWeight: 500 }}>Added Lines</span>
            <span className="text-[11px] text-slate-400">· not linked to inventory</span>
          </div>
          <table className="w-full table-fixed text-left border-collapse text-[11px]">
            <colgroup>
              <col />
              <col className="w-[84px]" />
              <col className="w-[116px]" />
              <col className="w-[170px]" />
              <col className="w-[96px]" />
              <col className="w-[34px]" />
            </colgroup>
            <thead className="bg-gray-50 border-b border-gray-100 text-slate-500 text-[11px]" style={{ fontWeight: 500 }}>
              <tr>
                <th className="px-3 py-1.5" style={{ fontWeight: 500 }}>Description<span className="text-red-500">*</span></th>
                <th className="px-1.5 py-1.5 text-right" style={{ fontWeight: 500 }}>Quantity</th>
                <th className="px-1.5 py-1.5 text-right" style={{ fontWeight: 500 }}>Rate</th>
                <th className="px-1.5 py-1.5" style={{ fontWeight: 500 }}>Revenue Account</th>
                <th className="px-1.5 py-1.5 text-right" style={{ fontWeight: 500 }}>Amount</th>
                <th className="px-0 py-1.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {lines.map((l) => {
                const descErr = hasError(fid.desc(l.key));
                const qtyErr = hasError(fid.qty(l.key));
                const rateErr = hasError(fid.price(l.key));
                const glErr = hasError(fid.rev(l.key));
                return (
                  <tr key={l.key} className="group hover:bg-[#F5F9FF] transition-colors">
                    <td className="px-3 py-1.5">
                      <Input
                        id={fid.desc(l.key)}
                        value={l.description}
                        onChange={(e) => onChange(l.key, { description: e.target.value })}
                        placeholder="What is this line for?"
                        className={`h-7 text-[11px] bg-white shadow-none placeholder:text-slate-400 focus-visible:ring-1 focus-visible:ring-primary/20 focus-visible:border-primary ${descErr ? 'border-red-400 ring-2 ring-red-100' : 'border-slate-200'}`}
                      />
                    </td>
                    <td className="px-1.5 py-1.5" id={fid.qty(l.key)}>
                      <QtyInput
                        value={l.invoiceQty}
                        onChange={(n) => onChange(l.key, { invoiceQty: n, orderedQty: n })}
                        className={`h-7 w-full text-right text-[11px] shadow-none rounded-md bg-white focus-visible:ring-1 ${qtyErr ? 'border-red-400 ring-2 ring-red-100' : 'border-slate-200'}`}
                        style={{ fontWeight: 500 }}
                      />
                    </td>
                    <td className="px-1.5 py-1.5" id={fid.price(l.key)}>
                      <div className="relative w-full">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-slate-500 pointer-events-none" style={{ fontWeight: 500 }}>$</span>
                        <MoneyInput
                          fluid
                          value={l.unitPrice}
                          onValueChange={(n) => onChange(l.key, { unitPrice: n, originalUnitPrice: n })}
                          placeholder="0.00"
                          className={`flex h-7 w-full min-w-0 rounded-md border bg-white pl-5 pr-2 py-1 text-right text-[11px] shadow-none outline-none focus-visible:ring-1 focus-visible:ring-primary/20 ${rateErr ? 'border-red-400 ring-2 ring-red-100' : 'border-slate-200'}`}
                        />
                      </div>
                    </td>
                    <td className="px-1.5 py-1.5">
                      <button
                        id={fid.rev(l.key)}
                        type="button"
                        onClick={() => setGlKey(l.key)}
                        className={`w-full inline-flex items-center justify-between gap-2 h-7 px-2 rounded-md border bg-white text-[11px] transition-colors ${
                          glErr ? 'border-red-300 text-red-600' : 'border-slate-200 text-foreground hover:bg-primary/[0.03] hover:border-primary/40'
                        }`}
                        style={{ fontWeight: 500 }}
                      >
                        <span className={`truncate ${l.glAccount ? '' : 'italic text-slate-400'}`}>{l.glAccount || 'No account'}</span>
                        <Settings2 className="w-3 h-3 shrink-0 text-slate-400" />
                      </button>
                    </td>
                    <td className="px-1.5 py-1.5 text-right whitespace-nowrap text-foreground" style={{ fontWeight: 500 }}>
                      {money(lineMoney.get(l.key)?.total ?? 0, currency)}
                    </td>
                    <td className="px-0 py-1.5 text-center">
                      <button
                        type="button"
                        onClick={() => onRemove(l.key)}
                        className="p-1 hover:bg-red-50 text-gray-300 hover:text-red-500 rounded-md transition-colors"
                        aria-label="Remove added line"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {glKey && (
        <RevenueAccountModal open accounts={REVENUE_ACCOUNTS} value={glLine?.glAccount ?? ''} onPick={(a) => onChange(glKey, { glAccount: a })} onClose={() => setGlKey(null)} />
      )}
    </div>
  );
}
