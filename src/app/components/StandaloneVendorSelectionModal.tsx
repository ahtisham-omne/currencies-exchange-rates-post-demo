import { useState, useMemo, useRef } from 'react';
import { TableEmptyState, resolveTableEmptyKind } from '@/app/components/ui/table-empty-state';
import {
  X,
  Search,
  Check,
  AlertTriangle,
  Building2,
  Calendar,
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  Package,
  ShoppingCart,
  ExternalLink,
  FileText,
} from 'lucide-react';
import { Input } from '@/app/components/ui/input';
import { Button } from '@/app/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/app/components/ui/dropdown-menu';
import { mockVendors } from '@/app/data/mockVendors';
import { ImageWithFallback } from '@/app/components/figma/ImageWithFallback';
import { highlightText as sharedHighlightText } from '@/app/components/InvoiceDataTable';

// "Create new partner" deep link — opens Partner Management in a new
// tab when the search dead-ends. ?from=vendor-invoicing pre-tags the
// upstream form with our originating context. Same URL the inventory
// modal uses.
const PARTNER_CREATE_URL = 'https://partner-management-module.lovable.app/vendors?from=vendor-invoicing';

// Levenshtein edit distance — short strings only, O(m*n) is fine for
// vendor names and codes.
const editDistance = (a: string, b: string): number => {
  const s1 = a.toLowerCase();
  const s2 = b.toLowerCase();
  const m = s1.length;
  const n = s2.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const prev = new Array(n + 1);
  const curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j];
  }
  return prev[n];
};

// Best fuzzy candidate within an edit-distance threshold proportional to
// query length. Returns null when nothing crosses the bar so we don't
// suggest wildly unrelated names. Skips candidates that already contain
// the query as a substring — those would be matches, not "did you mean".
const findFuzzyMatch = (query: string, candidates: string[]): string | null => {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return null;
  const threshold = Math.min(3, Math.max(1, Math.floor(q.length / 4) + 1));
  let best: { candidate: string; distance: number } | null = null;
  for (const candidate of candidates) {
    const c = candidate.toLowerCase();
    if (c.includes(q)) return null;
    const tokens = [c, ...c.split(/\s+/)];
    let minDist = Infinity;
    for (const token of tokens) {
      const d = editDistance(q, token);
      if (d < minDist) minDist = d;
    }
    if (minDist <= threshold && (!best || minDist < best.distance)) {
      best = { candidate, distance: minDist };
    }
  }
  return best ? best.candidate : null;
};

export interface StandaloneVendorData {
  vendorId: string;
  vendorCode: string;
  vendorName: string;
  vendorCategory: string;
  currency: string;
  paymentTerms: string;
  imageUrl?: string;
}

interface StandaloneVendorSelectionModalProps {
  isOpen: boolean;
  /** Dismiss the modal entirely — Cancel / X / backdrop close the whole
   *  creation flow back to the invoice listing. */
  onClose: () => void;
  /** Optional: go back to the previous step (the invoice-type picker).
   *  When provided, a back button is shown in the header. */
  onBack?: () => void;
  onSelectVendor: (vendor: StandaloneVendorData) => void;
  /** Route the user into the inventory PO/receiver picker for this vendor
   *  instead of a standalone invoice — used by the "open documents found"
   *  prompt when the picked vendor has open POs / receiving documents. */
  onSwitchToInventory?: (vendorId: string) => void;
}

type SortKey = 'date' | 'name';
type SortDir = 'asc' | 'desc';

export function StandaloneVendorSelectionModal({
  isOpen,
  onClose,
  onBack,
  onSelectVendor,
  onSwitchToInventory,
}: StandaloneVendorSelectionModalProps) {
  const [search, setSearch] = useState('');
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Open-documents prompt — shown after picking a vendor that has open POs /
  // receiving documents, offering to invoice against one instead.
  const [showOpenDocsPrompt, setShowOpenDocsPrompt] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(new Set());
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  // Whether the discard confirmation, once confirmed, should close the
  // modal entirely (Cancel / X / backdrop) or step back to the picker
  // (header back button).
  const discardActionRef = useRef<'close' | 'back'>('close');

  // Cancel / X / backdrop dismiss the modal. The discard confirmation only
  // fires when a vendor has actually been picked; otherwise close straight
  // through — mirrors the inventory invoice flow.
  const handleCancelClick = () => {
    if (!selectedId) {
      onClose();
      return;
    }
    discardActionRef.current = 'close';
    setShowDiscardConfirm(true);
  };

  // Header back button — returns to the invoice-type picker, guarded the
  // same way so a picked vendor isn't lost without confirmation.
  const handleBackClick = () => {
    if (!onBack) return;
    if (!selectedId) {
      onBack();
      return;
    }
    discardActionRef.current = 'back';
    setShowDiscardConfirm(true);
  };

  const toggleDescription = (id: string) => {
    setExpandedDescriptions((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Vendor → 2-line descriptor matching the nested inventory modal's
  // verbose pattern (category, type, currency, payment terms, and a
  // qualitative blurb) so both flows surface the same depth of context
  // in the picker.
  const describeVendor = (vendor: { category: string; type: string; currency: string; paymentTerms: string }) =>
    `${vendor.category} vendor specializing in ${vendor.type} operations. Established supplier with ${vendor.currency} settlements on ${vendor.paymentTerms} terms. Active across multiple purchase orders with consistent on-time delivery and competitive pricing for the supply chain.`;

  const filteredVendors = useMemo(() => {
    let list = [...mockVendors];
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (v) =>
          v.vendorName.toLowerCase().includes(q) ||
          v.vendorCode.toLowerCase().includes(q) ||
          v.category.toLowerCase().includes(q) ||
          v.createdBy.toLowerCase().includes(q),
      );
    }
    list.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'date') cmp = new Date(a.createdOn).getTime() - new Date(b.createdOn).getTime();
      else if (sortKey === 'name') cmp = a.vendorName.localeCompare(b.vendorName);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [search, sortKey, sortDir]);

  const selectedVendor = useMemo(
    () => (selectedId ? mockVendors.find((v) => v.id === selectedId) ?? null : null),
    [selectedId],
  );

  // Fuzzy suggestion — only when search produced zero results so a typo
  // doesn't dead-end the picker. Searches the full vendor list (not the
  // filtered slice) across name + code so "ecma" -> "Acme Corp".
  const fuzzySuggestion = useMemo(() => {
    if (filteredVendors.length > 0 || !search.trim()) return null;
    const candidates = mockVendors.flatMap((v) => [v.vendorName, v.vendorCode]);
    return findFuzzyMatch(search, candidates);
  }, [filteredVendors.length, search]);

  // Shared yellow search mark (10/9/26), was a local bg-amber-100 variant.
  const highlightText = (text: string, query: string) => sharedHighlightText(text, query);

  const openPoCount = selectedVendor?.purchaseOrders?.length ?? 0;
  const openReceiverCount = selectedVendor?.receivingDocuments?.length ?? 0;
  const hasOpenDocuments = openPoCount + openReceiverCount > 0;

  const proceedToStandalone = () => {
    if (!selectedVendor) return;
    onSelectVendor({
      vendorId: selectedVendor.id,
      vendorCode: selectedVendor.vendorCode,
      vendorName: selectedVendor.vendorName,
      vendorCategory: selectedVendor.category,
      currency: selectedVendor.currency,
      paymentTerms: selectedVendor.paymentTerms,
      imageUrl: selectedVendor.imageUrl,
    });
  };

  const handleContinue = () => {
    if (!selectedVendor) return;
    // If the vendor has open POs / receivers, surface the prompt offering to
    // invoice against one of those instead of a blank standalone invoice.
    if (hasOpenDocuments && onSwitchToInventory) {
      setShowOpenDocsPrompt(true);
      return;
    }
    proceedToStandalone();
  };

  if (!isOpen) return null;

  // Same modal frame as VendorSelectionModalNested: 70vw cap with 1320px hard
  // ceiling on desktop, 90vh, slides to nearly full-screen in "Full view".
  const modalClasses = isFullScreen
    ? 'fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[151] bg-white border border-border w-[calc(100%-1rem)] max-w-[calc(100%-1rem)] h-[calc(100dvh-1rem)] sm:h-[calc(100dvh-2rem)] max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)] rounded-none sm:rounded-2xl overflow-hidden transition-[max-width,max-height,height,border-radius] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]'
    : 'fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[151] bg-white border border-border w-[calc(100%-2rem)] max-w-[100%] sm:max-w-[min(70vw,1320px)] h-[100dvh] sm:h-[90vh] max-h-[100dvh] sm:max-h-[90vh] rounded-none sm:rounded-2xl overflow-hidden transition-[max-width,max-height,height,border-radius] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]';

  const sortLabel =
    sortKey === 'date'
      ? sortDir === 'desc'
        ? 'Newest First'
        : 'Oldest First'
      : sortDir === 'asc'
        ? 'A → Z'
        : 'Z → A';

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-[150]" onClick={handleCancelClick} />

      <div className={modalClasses}>
        <div className="h-full flex flex-col">
          {/* Header — partner CreatePartnerModal recipe verbatim */}
          <div className="px-3 sm:px-4 lg:px-5 pt-3 sm:pt-4 pb-3 sm:pb-4 shrink-0 bg-white border-b border-[#EEF2F6]">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5 min-w-0">
                {/* Back to invoice-type picker. */}
                {onBack && (
                  <button
                    type="button"
                    onClick={handleBackClick}
                    className="mt-0.5 w-8 h-8 rounded-lg border border-border bg-white hover:bg-slate-50 hover:border-slate-300 flex items-center justify-center shrink-0 cursor-pointer transition-all"
                    aria-label="Back to previous step"
                    title="Back"
                  >
                    <ChevronLeft className="w-4 h-4 text-slate-500" />
                  </button>
                )}
                {/* Type icon — mirrors the Standalone Invoice card on the
                    type picker (FileText, TEAL identity, user 10/10). */}
                <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center text-teal-600 shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-[15px] sm:text-[17px] text-foreground truncate" style={{ fontWeight: 700 }}>
                    Create New Standalone Invoice
                  </h2>
                  <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5" style={{ fontWeight: 400 }}>
                    Bill a vendor directly without a purchase order, start by choosing who to invoice.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsFullScreen(!isFullScreen)}
                  className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-white text-xs text-muted-foreground hover:bg-slate-50 hover:border-slate-300 transition-all"
                  style={{ fontWeight: 500 }}
                >
                  {isFullScreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                  {isFullScreen ? 'Exit Full' : 'Full View'}
                </button>
                <button
                  type="button"
                  onClick={handleCancelClick}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-500 hover:bg-muted transition-all"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Filter band — same edge-to-edge slate tint as the nested
                modal, but with a single vendor-search segment since
                standalone doesn't have PO / Receiver / Item context. */}
            <div className="-mx-3 sm:-mx-4 lg:-mx-5 -mb-3 sm:-mb-4 mt-4 px-3 sm:px-4 lg:px-5 py-3 sm:py-3.5 bg-[#FAFBFC] border-t border-[#EEF2F6]">
              <div className="flex items-stretch border border-border rounded-lg bg-white shadow-sm overflow-hidden transition-all focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15 hover:border-primary/50">
                <div className="relative flex-1">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Search vendors by name, category, or owner…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 pr-3 h-10 bg-white border-0 rounded-lg focus-visible:ring-0 focus-visible:ring-offset-0 hover:bg-muted/20 focus:bg-white transition-all text-[13px]"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Results heading — "Recently used" / "Showing results for …" +
              sort menu. Matches the nested modal's heading bar exactly. */}
          {filteredVendors.length > 0 && (
            <div className="shrink-0 flex items-center justify-between px-6 pt-4 pb-2 gap-3">
              <span className="text-[12px] text-slate-600 truncate" style={{ fontWeight: 500 }}>
                {search.trim() ? (
                  <>
                    Showing results for
                    <span className="ml-1 text-foreground" style={{ fontWeight: 600 }}>
                      "{search}"
                    </span>
                  </>
                ) : (
                  'Recently Used'
                )}
              </span>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>
                  {filteredVendors.length} of {mockVendors.length} vendors
                </span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-border bg-white text-[12px] text-slate-600 hover:text-foreground hover:border-slate-300 transition-colors"
                      style={{ fontWeight: 500 }}
                    >
                      <ArrowUpDown className="w-3.5 h-3.5" />
                      <span className="text-foreground" style={{ fontWeight: 500 }}>
                        {sortLabel}
                      </span>
                      <ChevronDown className="w-3 h-3 text-slate-400" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-[200px]">
                    <DropdownMenuLabel className="text-[10px] text-slate-500" style={{ fontWeight: 600 }}>
                      <Calendar className="w-3 h-3 inline-block mr-1.5 -mt-0.5" />
                      Date
                    </DropdownMenuLabel>
                    {[
                      { key: 'date' as const, dir: 'desc' as const, label: 'Newest First' },
                      { key: 'date' as const, dir: 'asc' as const, label: 'Oldest First' },
                    ].map((opt) => {
                      const active = sortKey === opt.key && sortDir === opt.dir;
                      return (
                        <DropdownMenuItem
                          key={`${opt.key}-${opt.dir}`}
                          onSelect={() => {
                            setSortKey(opt.key);
                            setSortDir(opt.dir);
                          }}
                          className="text-[12px] flex items-center justify-between"
                        >
                          {opt.label}
                          {active && <Check className="w-3.5 h-3.5 text-primary" />}
                        </DropdownMenuItem>
                      );
                    })}
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-[10px] text-slate-500" style={{ fontWeight: 600 }}>
                      <Building2 className="w-3 h-3 inline-block mr-1.5 -mt-0.5" />
                      Name
                    </DropdownMenuLabel>
                    {[
                      { key: 'name' as const, dir: 'asc' as const, label: 'A → Z' },
                      { key: 'name' as const, dir: 'desc' as const, label: 'Z → A' },
                    ].map((opt) => {
                      const active = sortKey === opt.key && sortDir === opt.dir;
                      return (
                        <DropdownMenuItem
                          key={`${opt.key}-${opt.dir}`}
                          onSelect={() => {
                            setSortKey(opt.key);
                            setSortDir(opt.dir);
                          }}
                          className="text-[12px] flex items-center justify-between"
                        >
                          {opt.label}
                          {active && <Check className="w-3.5 h-3.5 text-primary" />}
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          )}

          {/* Vendor list */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {filteredVendors.length === 0 ? (
              /* Table Empty States Standard (11/3/26). */
              <div className="flex flex-col">
                <TableEmptyState
                  compact
                  kind={resolveTableEmptyKind({ totalCount: mockVendors.length, filteredCount: 0, searchQuery: search }) ?? 'no-data'}
                  entity={{ singular: 'vendor', plural: 'vendors' }}
                  searchQuery={search}
                  suggestion={fuzzySuggestion ?? null}
                  onApplySuggestion={setSearch}
                  onClearSearch={() => setSearch('')}
                />
                {search.trim() && (
                  <a
                    href={PARTNER_CREATE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="-mt-4 mb-8 mx-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary text-white text-[12px] hover:bg-primary/90 transition-colors"
                    style={{ fontWeight: 600 }}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Create New Partner
                  </a>
                )}
              </div>
            ) : (
              <div>
                {filteredVendors.map((vendor) => {
                  const isSelected = selectedId === vendor.id;
                  const description = describeVendor(vendor);
                  const showFullDescription = expandedDescriptions.has(vendor.id);
                  return (
                    <div
                      key={vendor.id}
                      onClick={() => setSelectedId(isSelected ? null : vendor.id)}
                      className="transition-colors duration-150 border-b border-[#EEF2F6] last:border-0 cursor-pointer group select-none"
                      style={{ backgroundColor: isSelected ? '#F8FAFF' : '#FFFFFF' }}
                      onMouseEnter={(e) => {
                        if (!isSelected) e.currentTarget.style.backgroundColor = '#F0F7FF';
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) e.currentTarget.style.backgroundColor = '#FFFFFF';
                      }}
                    >
                      <div className="flex items-center gap-3 px-5 py-2.5">
                        {/* Selection indicator — radio-style box, single-select */}
                        <div
                          className="flex-shrink-0 flex items-center justify-center w-[18px] h-[18px] rounded-[5px] border-[1.5px] transition-all"
                          style={{
                            borderColor: isSelected ? 'hsl(var(--primary))' : '#CBD5E1',
                            backgroundColor: isSelected ? 'hsl(var(--primary))' : 'transparent',
                          }}
                        >
                          {isSelected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                        </div>

                        {/* Vendor avatar */}
                        <div
                          className="flex-shrink-0 w-10 h-10 rounded-md overflow-hidden flex items-center justify-center bg-white transition-all"
                          style={{
                            border: isSelected ? '1px solid rgba(10,119,255,0.25)' : '1px solid hsl(var(--border))',
                            boxShadow: isSelected
                              ? '0 0 0 1px rgba(10,119,255,0.10)'
                              : '0 1px 2px rgba(0,0,0,0.03)',
                          }}
                        >
                          {vendor.imageUrl ? (
                            <ImageWithFallback
                              src={vendor.imageUrl}
                              alt={vendor.vendorName}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Building2 className={`w-5 h-5 ${isSelected ? 'text-primary' : 'text-slate-400'}`} />
                          )}
                        </div>

                        {/* Vendor info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h3 className="text-[14px] text-foreground tracking-tight truncate" style={{ fontWeight: 600 }}>
                              {highlightText(vendor.vendorName, search)}
                            </h3>
                            <span
                              className="inline-flex items-center px-2 py-0 rounded-full text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-100"
                              style={{ fontWeight: 500 }}
                            >
                              Active
                            </span>
                            <span
                              className="inline-flex items-center px-2 py-0 rounded-full text-[10px] bg-slate-50 text-slate-600 border border-slate-200"
                              style={{ fontWeight: 500 }}
                            >
                              {/* Searchable, so it highlights like every other matched cell (10/9/26). */}
                              {highlightText(vendor.category, search)}
                            </span>
                          </div>

                          {/* Description with inline more / Show less toggle — same
                              pattern as the inventory modal's vendor row. */}
                          <div className="mt-0.5 text-[11px] text-slate-500 leading-snug" style={{ fontWeight: 400 }}>
                            {showFullDescription ? (
                              <>
                                <span>{description}</span>{' '}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleDescription(vendor.id);
                                  }}
                                  className="inline-flex items-center gap-0.5 text-primary hover:text-blue-700 transition-colors align-baseline text-[11px]"
                                  style={{ fontWeight: 500 }}
                                >
                                  Show Less
                                  <ChevronUp className="w-3 h-3" />
                                </button>
                              </>
                            ) : (
                              <span className="flex items-center gap-1">
                                <span className="truncate min-w-0">{description}</span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleDescription(vendor.id);
                                  }}
                                  className="inline-flex items-center gap-0.5 text-primary hover:text-blue-700 transition-colors shrink-0 text-[11px]"
                                  style={{ fontWeight: 500 }}
                                >
                                  More
                                  <ChevronDown className="w-3 h-3" />
                                </button>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* KPI tiles removed — open POs / receivers now
                            surface as an "open documents found" prompt after
                            the vendor is picked (keeps the list clean for the
                            common case of no open documents). */}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer — partner CreatePartnerModal byte-exact, same as the
              nested invoice modal. Cancel forced-white to read crisply
              against the off-white app background. */}
          <div className="shrink-0 border-t border-[#EEF2F6] bg-white px-3 sm:px-4 lg:px-5 py-2.5 sm:py-3 flex items-center justify-end gap-2 sm:gap-2.5 sm:rounded-b-2xl">
            <div className="text-xs sm:text-[13px] text-slate-500 mr-auto" style={{ fontWeight: 500 }}>
              {selectedVendor ? (
                <>
                  <span className="text-foreground" style={{ fontWeight: 600 }}>{selectedVendor.vendorName}</span>{' '}
                  selected
                </>
              ) : (
                'No vendor selected'
              )}
            </div>
            <button
              type="button"
              onClick={handleCancelClick}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#F8FAFC';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#FFFFFF';
              }}
              className="inline-flex items-center justify-center h-8 sm:h-9 rounded-lg px-3 sm:px-5 text-xs sm:text-[13px] border border-slate-200 cursor-pointer transition-colors"
              style={{ fontWeight: 500, color: '#0F172A', backgroundColor: '#FFFFFF' }}
            >
              Cancel
            </button>
            <Button
              onClick={handleContinue}
              disabled={!selectedId}
              className="gap-1.5 rounded-lg px-3 sm:px-5 text-xs sm:text-[13px] h-8 sm:h-9 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* ─── Discard Confirmation — same partner Create-modal pattern as the
          inventory invoice flow: soft red glow header, AlertTriangle tile,
          DISCARD chip, deep-red primary, Continue editing
          footer. Fires only when a vendor has been picked. ─── */}
      {showDiscardConfirm && (
        <div
          className="fixed inset-0 z-[180] flex items-center justify-center bg-black/70 p-4 animate-in fade-in duration-150"
          onClick={() => setShowDiscardConfirm(false)}
        >
          <div
            className="relative bg-white w-full sm:max-w-[420px] rounded-2xl overflow-hidden animate-in zoom-in-95 duration-150"
            style={{ boxShadow: '0 24px 80px -12px rgba(0,0,0,0.25)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="relative flex flex-col items-center pt-10 pb-6"
              style={{
                background:
                  'linear-gradient(180deg, #FEF2F2 0%, rgba(254,242,242,0.3) 70%, transparent 100%)',
              }}
            >
              <div
                className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full opacity-25 pointer-events-none"
                style={{ backgroundColor: '#EF4444', filter: 'blur(50px)' }}
              />
              <div
                className="relative w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ backgroundColor: '#FEE2E2' }}
              >
                <AlertTriangle className="w-8 h-8" style={{ color: 'hsl(var(--destructive))' }} />
              </div>
              <span
                className="mt-4 px-3 py-1 rounded-full text-[11px]"
                style={{
                  fontWeight: 600,
                  backgroundColor: '#FEF2F2',
                  color: '#991B1B',
                }}
              >
                Discard
              </span>
            </div>

            <div className="flex flex-col items-center text-center px-8 pb-8">
              <h3
                className="text-[18px] tracking-[-0.02em]"
                style={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}
              >
                Discard vendor selection?
              </h3>
              <p
                className="text-[13px] mt-2 mx-auto"
                style={{ color: 'hsl(var(--muted-foreground))', lineHeight: 1.65, maxWidth: '300px' }}
              >
                The vendor you selected will be cleared. This action cannot be undone.
              </p>

              <div className="w-full mt-7 flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedId(null);
                    setShowDiscardConfirm(false);
                    // Resolve to the action that opened the prompt: the back
                    // button steps back to the type picker, Cancel / X close
                    // the whole flow.
                    if (discardActionRef.current === 'back') {
                      onBack?.();
                    } else {
                      onClose();
                    }
                  }}
                  className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90"
                  style={{
                    fontWeight: 600,
                    backgroundColor: 'hsl(var(--destructive))',
                    color: '#fff',
                  }}
                >
                  Discard Changes
                </button>
                <button
                  type="button"
                  onClick={() => setShowDiscardConfirm(false)}
                  className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
                  style={{
                    fontWeight: 500,
                    backgroundColor: '#F8FAFC',
                    color: '#334155',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F1F5F9'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#F8FAFC'; }}
                >
                  Continue Editing
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Open documents found — shown when the picked vendor has open
          POs / receiving documents, offering to invoice against one instead
          of a blank standalone invoice. Blue/info tone. ─── */}
      {showOpenDocsPrompt && selectedVendor && (
        <div
          className="fixed inset-0 z-[180] flex items-center justify-center bg-black/70 p-4 animate-in fade-in duration-150"
          onClick={() => setShowOpenDocsPrompt(false)}
        >
          <div
            className="relative bg-white w-full sm:max-w-[420px] rounded-2xl overflow-hidden animate-in zoom-in-95 duration-150"
            style={{ boxShadow: '0 24px 80px -12px rgba(0,0,0,0.25)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="relative flex flex-col items-center pt-10 pb-6"
              style={{ background: 'linear-gradient(180deg, #EBF3FF 0%, rgba(235,243,255,0.3) 70%, transparent 100%)' }}
            >
              <div
                className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full opacity-25 pointer-events-none"
                style={{ backgroundColor: '#0A77FF', filter: 'blur(50px)' }}
              />
              <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#D6E8FF' }}>
                <ShoppingCart className="w-8 h-8" style={{ color: 'hsl(var(--primary))' }} />
              </div>
            </div>

            <div className="flex flex-col items-center text-center px-8 pb-8">
              <h3 className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                Open Documents Found for {selectedVendor.vendorName}
              </h3>
              <p className="text-[13px] mt-2 mx-auto" style={{ color: 'hsl(var(--muted-foreground))', lineHeight: 1.65, maxWidth: '340px' }}>
                We found {openPoCount} open purchase order{openPoCount === 1 ? '' : 's'} and {openReceiverCount} receiving document{openReceiverCount === 1 ? '' : 's'} for {selectedVendor.vendorName}. Would you like to invoice against one of these?
              </p>

              {/* Count chips — quick visual reinforcement of the two numbers. */}
              <div className="flex items-center gap-2 mt-4">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-amber-200 bg-amber-50 text-[12px] text-amber-700" style={{ fontWeight: 600 }}>
                  <ShoppingCart className="w-3.5 h-3.5" />
                  {openPoCount} PO{openPoCount === 1 ? '' : 's'}
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-blue-200 bg-blue-50 text-[12px] text-primary" style={{ fontWeight: 600 }}>
                  <Package className="w-3.5 h-3.5" />
                  {openReceiverCount} Receiving{openReceiverCount === 1 ? '' : 's'}
                </span>
              </div>

              <div className="w-full mt-7 flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setShowOpenDocsPrompt(false);
                    onSwitchToInventory?.(selectedVendor.id);
                  }}
                  className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-opacity hover:opacity-90"
                  style={{ fontWeight: 600, backgroundColor: 'hsl(var(--primary))', color: '#fff' }}
                >
                  Select a Document
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowOpenDocsPrompt(false);
                    proceedToStandalone();
                  }}
                  className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
                  style={{ fontWeight: 500, backgroundColor: '#F8FAFC', color: '#334155' }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F1F5F9'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#F8FAFC'; }}
                >
                  Continue Without
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
