import { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Search, Building2, MapPin, Check, Copy, GitBranch, X, ChevronDown, FileText, Send, CheckCircle2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';
import type { QuoteVersion } from '@/app/types/quote';

/* ════════════════════════════════════════════════════════════════════
   DuplicateQuoteModal — partner-aligned. Uses the shared Dialog
   primitive, partner pill/card chrome (border-primary + ring-2
   ring-primary/10 for selected radio cards; border-primary bg-accent
   text-primary for selected chips), and Tailwind classes throughout.
   Visually identical to DuplicateSOModal so both modules read the same.
   ════════════════════════════════════════════════════════════════════ */

interface Customer {
  id: string;
  name: string;
  location: string;
}

const CUSTOMERS: Customer[] = [
  { id: 'CUST-001', name: 'Tri-County EMS Authority', location: 'Springfield, IL' },
  { id: 'CUST-002', name: 'TechStart Industries', location: 'California HQ' },
  { id: 'CUST-003', name: 'Global Solutions Ltd', location: 'New York Office' },
  { id: 'CUST-004', name: 'Innovation Labs', location: 'Austin Branch' },
  { id: 'CUST-005', name: 'Enterprise Systems Inc', location: 'Boston HQ' },
  { id: 'CUST-006', name: 'Digital Dynamics', location: 'Seattle Office' },
  { id: 'CUST-007', name: 'Future Tech Group', location: 'Miami Plant' },
  { id: 'CUST-008', name: 'Quantum Industries', location: 'Denver Facility' },
  { id: 'CUST-009', name: 'NextGen Solutions', location: 'Portland Branch' },
  { id: 'CUST-010', name: 'Prime Manufacturing', location: 'Detroit Plant' },
  { id: 'CUST-011', name: 'Stellar Enterprises', location: 'Phoenix Office' },
  { id: 'CUST-012', name: 'Apex Technologies', location: 'Atlanta HQ' },
  { id: 'CUST-013', name: 'Horizon Corp', location: 'Dallas Branch' },
  { id: 'CUST-014', name: 'Velocity Systems', location: 'San Diego Office' },
  { id: 'CUST-015', name: 'Phoenix Industries', location: 'Chicago Plant' },
];

export type DuplicateVersionMode = 'single' | 'all';

export interface DuplicateQuoteConfirmPayload {
  customerId: string;
  customerName: string;
  versionMode: DuplicateVersionMode;
  selectedVersion: number;
}

interface DuplicateQuoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (payload: DuplicateQuoteConfirmPayload) => void;
  currentCustomer?: string;
  quoteNumber?: string;
  availableVersions?: QuoteVersion[];
  currentVersion?: number;
}

function SectionCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ElementType;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <div className="px-4 py-2.5 border-b border-[#EEF2F6] flex items-center gap-2 bg-[#FAFBFC] rounded-t-lg">
        <div className="w-6 h-6 rounded-md bg-primary/8 flex items-center justify-center shrink-0">
          <Icon className="w-3.5 h-3.5 text-primary" />
        </div>
        <div className="flex items-baseline gap-2 flex-wrap min-w-0">
          <span className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>{title}</span>
          {description && (
            <span className="text-[11px] text-muted-foreground truncate">{description}</span>
          )}
        </div>
      </div>
      <div className="p-3 space-y-2">{children}</div>
    </div>
  );
}

function RadioOptionCard({
  selected,
  onSelect,
  children,
  disabled,
}: {
  selected: boolean;
  onSelect: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <div
      role="radio"
      aria-checked={selected}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      onClick={() => { if (!disabled) onSelect(); }}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(); }
      }}
      className={`group rounded-lg border bg-white px-3 py-2.5 transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 ${
        disabled
          ? 'opacity-50 cursor-not-allowed'
          : selected
            ? 'border-primary ring-2 ring-primary/10'
            : 'border-border hover:border-slate-300'
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`mt-[3px] w-[16px] h-[16px] rounded-full shrink-0 flex items-center justify-center transition-colors ${
            selected ? 'bg-primary' : 'border-2 border-slate-300 group-hover:border-slate-400'
          }`}
        >
          {selected && <span className="w-[6px] h-[6px] rounded-full bg-white" />}
        </div>
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  );
}

/* Returns true when a Radix outside-click event originated inside our
   portalled version dropdown panel. Reads `composedPath` so the lookup
   survives any retargeting and works on text-node click targets. */
function isClickInsideVersionPanel(e: any): boolean {
  const orig = e?.detail?.originalEvent;
  const path: EventTarget[] = typeof orig?.composedPath === 'function' ? orig.composedPath() : [];
  for (const node of path) {
    const el = node as Element | null;
    if (el && typeof (el as any).getAttribute === 'function' && (el as Element).getAttribute('data-duplicate-version-panel') !== null) {
      return true;
    }
  }
  const target = (orig?.target ?? e?.target) as HTMLElement | null;
  if (target && typeof target.closest === 'function' && target.closest('[data-duplicate-version-panel]')) {
    return true;
  }
  return false;
}

/* Lightweight version picker that mirrors the visual language of the
   detail-page VersionDropdown header trigger. Pure selection: no
   compare / edit-as-draft / view-history side-effects. Used here in
   place of the older pill row so the duplicate flow reads the same as
   the header. */
function VersionSelect({
  versions,
  selectedVersion,
  latestVersion,
  onSelect,
}: {
  versions: QuoteVersion[];
  selectedVersion: number;
  latestVersion: number;
  onSelect: (version: number) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  /* Viewport-space coordinates for the panel. We portal the panel to
     document.body so the Dialog's transform (`translate(-50%, -50%)`
     on the content wrapper) doesn't reinterpret our fixed-position
     coordinates in the dialog's local space — the symptom was the
     panel landing in the bottom-right corner instead of under the
     trigger. React events still propagate through the virtual tree
     so the panel stays interactive while inside Radix's
     DismissableLayer. */
  const [panelPos, setPanelPos] = useState<{ top: number; left: number; minWidth: number; placeAbove: boolean } | null>(null);

  useEffect(() => {
    if (!isOpen) { setPanelPos(null); return; }
    const reposition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const panelHeight = 320;
      const spaceBelow = window.innerHeight - rect.bottom;
      const placeAbove = spaceBelow < panelHeight && rect.top > panelHeight;
      setPanelPos({
        top: placeAbove ? rect.top - 6 : rect.bottom + 6,
        left: rect.left,
        minWidth: Math.max(rect.width, 360),
        placeAbove,
      });
    };
    reposition();
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
      setIsOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setIsOpen(false); } };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [isOpen]);

  const selected = versions.find(v => v.version === selectedVersion) ?? versions[0];
  if (!selected) return null;

  /* Status visuals — mirror VersionDropdown.tsx so the trigger reads
     the same as the header pill: blue Sent, green Confirmed, slate
     Draft. */
  const visuals = (() => {
    if (selected.versionStatus === 'sent') return { Icon: Send, color: '#1D4ED8', bg: '#EFF6FF', border: '#93C5FD' };
    if (selected.versionStatus === 'confirmed') return { Icon: CheckCircle2, color: '#047857', bg: '#ECFDF5', border: '#86EFAC' };
    return { Icon: FileText, color: '#475569', bg: '#F1F5F9', border: '#CBD5E1' };
  })();
  const Icon = visuals.Icon;
  const isLatest = selected.version === latestVersion;

  return (
    /* Wrapper has `position: relative` so the trigger ref resolves in
       a sensible coordinate space. The panel below is portalled to
       document.body via React Portal — events still propagate through
       the React virtual tree so the panel stays interactive inside
       Radix's DismissableLayer. */
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(o => !o)}
        className="inline-flex items-center gap-2 rounded-lg border border-border bg-white hover:bg-slate-50 transition-colors cursor-pointer"
        style={{ height: 34, padding: '0 10px', minWidth: 200 }}
      >
        <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: visuals.color }} />
        <span className="text-[13px] text-foreground" style={{ fontWeight: 600, lineHeight: 1 }}>
          V{selected.version}
        </span>
        <span
          style={{
            fontSize: 10, fontWeight: 600,
            color: isLatest ? '#1E40AF' : visuals.color,
            backgroundColor: isLatest ? '#EFF6FF' : visuals.bg,
            border: `1px solid ${isLatest ? '#93C5FD' : visuals.border}`,
            padding: '1px 6px', borderRadius: 3, lineHeight: 1,
          }}
        >
          {isLatest ? 'Current' : (selected.versionStatus === 'confirmed' ? 'Confirmed' : selected.versionStatus === 'sent' ? 'Sent' : 'Draft')}
        </span>
        {selected.date && (
          <span className="text-[11px] text-muted-foreground" style={{ lineHeight: 1 }}>
            {selected.date}
          </span>
        )}
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 ml-auto transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && panelPos && typeof document !== 'undefined' && createPortal(
        <div
          ref={panelRef}
          data-duplicate-version-panel
          className="bg-white"
          style={{
            position: 'fixed',
            top: panelPos.placeAbove ? undefined : panelPos.top,
            bottom: panelPos.placeAbove ? window.innerHeight - panelPos.top : undefined,
            left: panelPos.left,
            minWidth: panelPos.minWidth,
            borderRadius: 8,
            border: '1px solid var(--border)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
            overflow: 'hidden',
            zIndex: 12500,
            /* Radix Dialog sets `pointer-events: none` on body when the
               scroll-lock is active. Since this panel is portalled to
               body, it inherits that and becomes unclickable. Restore
               pointer-events on the panel subtree so the rows are
               selectable. */
            pointerEvents: 'auto',
            fontFamily: 'Inter, system-ui, sans-serif',
          }}
        >
          <div className="px-3 py-2 border-b border-[#F1F5F9]">
            <div className="text-[12px] text-foreground" style={{ fontWeight: 600 }}>Select version to duplicate</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{versions.length} version{versions.length === 1 ? '' : 's'} available</div>
          </div>
          <div className="max-h-[280px] overflow-y-auto">
            {versions.map((v) => {
              const rowSelected = v.version === selectedVersion;
              const rowLatest = v.version === latestVersion;
              const rowVisuals = (() => {
                if (v.versionStatus === 'sent') return { Icon: Send, color: '#1D4ED8' };
                if (v.versionStatus === 'confirmed') return { Icon: CheckCircle2, color: '#047857' };
                return { Icon: FileText, color: '#475569' };
              })();
              const RowIcon = rowVisuals.Icon;
              return (
                <button
                  key={v.version}
                  type="button"
                  onClick={() => { onSelect(v.version); setIsOpen(false); }}
                  className={`w-full h-9 flex items-center gap-2.5 px-3 text-left transition-colors hover:bg-slate-50 ${rowSelected ? 'bg-accent/60' : ''}`}
                >
                  <RowIcon className="w-3.5 h-3.5 shrink-0" style={{ color: rowVisuals.color }} />
                  <span className="text-[13px] text-foreground tabular-nums" style={{ fontWeight: 500 }}>V{v.version}</span>
                  {rowLatest && (
                    <span
                      style={{
                        fontSize: 9, fontWeight: 600, color: '#1E40AF',
                        backgroundColor: '#EFF6FF', border: '1px solid #93C5FD',
                        padding: '1px 5px', borderRadius: 3, lineHeight: 1,
                      }}
                    >
                      Current
                    </span>
                  )}
                  {v.date && (
                    <span className="text-[11px] text-muted-foreground ml-auto tabular-nums">
                      {v.date}
                    </span>
                  )}
                  {rowSelected && (
                    <Check className={`w-3.5 h-3.5 text-primary shrink-0 ${v.date ? '' : 'ml-auto'}`} strokeWidth={3} />
                  )}
                </button>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export function DuplicateQuoteModal({
  isOpen,
  onClose,
  onConfirm,
  currentCustomer = 'Tri-County EMS Authority',
  quoteNumber,
  availableVersions,
  currentVersion,
}: DuplicateQuoteModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [useSameCustomer, setUseSameCustomer] = useState(true);
  const searchRef = useRef<HTMLInputElement>(null);

  const versions = useMemo<QuoteVersion[]>(() => {
    if (availableVersions && availableVersions.length > 0) {
      /* Hide versions the caller has flagged non-duplicable (typically
         the version tied to a Quote-to-SO conversion, or any version on
         a Cancelled / Archived / Expired record). Fall back to the full
         list if every version was flagged so the modal still surfaces
         something selectable instead of going empty. */
      const sorted = [...availableVersions].sort((a, b) => b.version - a.version);
      const duplicable = sorted.filter(v => v.canDuplicate !== false);
      return duplicable.length > 0 ? duplicable : sorted;
    }
    const latest = currentVersion ?? 1;
    return [{ version: latest, versionStatus: 'draft', date: '', author: '', summary: '' }];
  }, [availableVersions, currentVersion]);

  const latestVersionNum = useMemo(() => {
    if (currentVersion) return currentVersion;
    return versions[0]?.version ?? 1;
  }, [versions, currentVersion]);

  const onlyOneVersion = versions.length === 1;

  /* Single-version mode is the only path now. The "All version
     history" option was removed because copying every prior revision
     onto a fresh duplicate created confusion about which version the
     new quote was actually seeded from. The mode field stays in the
     payload for backward compatibility with the existing duplicate
     helper, but the modal never emits 'all'. */
  const [selectedVersion, setSelectedVersion] = useState<number>(latestVersionNum);

  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setSelectedCustomer(null);
      setUseSameCustomer(true);
      setSelectedVersion(latestVersionNum);
    }
  }, [isOpen, latestVersionNum]);

  const filteredCustomers = CUSTOMERS.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.location.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleConfirm = () => {
    onConfirm({
      customerId: useSameCustomer ? '' : (selectedCustomer?.id ?? ''),
      customerName: useSameCustomer ? currentCustomer : (selectedCustomer?.name ?? ''),
      versionMode: 'single',
      selectedVersion,
    });
  };

  const canConfirm = useSameCustomer || selectedCustomer !== null;

  return (
    <Dialog open={isOpen} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent
        hideCloseButton
        className="flex flex-col p-0 gap-0 border-0 sm:border max-w-[560px] sm:max-w-[560px]"
        style={{ boxShadow: '0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)' }}
        /* The version dropdown panel is portalled to document.body so
           it escapes the dialog's transformed ancestor. Radix wraps
           the outside-click handler in a CustomEvent whose `target`
           is the Radix layer, not the click target — the real path
           lives on `e.detail.originalEvent`. We walk that event's
           composedPath so a click anywhere inside an element tagged
           `data-duplicate-version-panel` reads as in-bounds and the
           dialog stays open. */
        onPointerDownOutside={(e) => {
          if (isClickInsideVersionPanel(e)) e.preventDefault();
        }}
        onInteractOutside={(e) => {
          if (isClickInsideVersionPanel(e)) e.preventDefault();
        }}
        onFocusOutside={(e) => {
          if (isClickInsideVersionPanel(e)) e.preventDefault();
        }}
      >
        <DialogTitle className="sr-only">Duplicate Quote</DialogTitle>
        <DialogDescription className="sr-only">
          Pick a customer and version to seed the duplicate from.
        </DialogDescription>

        {/* Header */}
        <div className="px-5 pt-4 pb-3 shrink-0 bg-white border-b border-[#EEF2F6] rounded-t-2xl">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-md bg-primary/8 flex items-center justify-center shrink-0">
                  <Copy className="w-4 h-4 text-primary" />
                </div>
                <h2 className="text-[16px] text-foreground" style={{ fontWeight: 700 }}>
                  Duplicate Quote
                </h2>
              </div>
              <p className="text-[12px] text-muted-foreground mt-1.5 ml-9 leading-snug">
                {quoteNumber ? <>Create a copy of <span className="text-foreground" style={{ fontWeight: 500 }}>{quoteNumber}</span>.</> : 'Create a copy of this quote.'}{' '}
                Pick the customer and which version to seed it from.
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-500 hover:bg-muted transition-all cursor-pointer shrink-0"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto bg-[#FAFBFC] px-4 py-4 space-y-3">

          <SectionCard icon={Building2} title="Customer">
            <RadioOptionCard
              selected={useSameCustomer}
              onSelect={() => { setUseSameCustomer(true); setSelectedCustomer(null); }}
            >
              <div className="text-[13px] text-foreground leading-tight" style={{ fontWeight: 500 }}>
                Same customer
              </div>
              <div className="flex items-center gap-1.5 mt-1 text-[11.5px] text-muted-foreground">
                <Building2 className="w-3 h-3 shrink-0" />
                <span className="truncate">{currentCustomer}</span>
              </div>
            </RadioOptionCard>

            <RadioOptionCard
              selected={!useSameCustomer}
              onSelect={() => { setUseSameCustomer(false); setTimeout(() => searchRef.current?.focus(), 80); }}
            >
              <div className="text-[13px] text-foreground leading-tight" style={{ fontWeight: 500 }}>
                Different customer
              </div>
              <div className="text-[11.5px] text-muted-foreground mt-1">
                Reassign the duplicate to a different account.
              </div>

              {!useSameCustomer && (
                <div className="mt-3" onClick={(e) => e.stopPropagation()}>
                  <div className="relative mb-2">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/70 pointer-events-none" />
                    <input
                      ref={searchRef}
                      type="text"
                      placeholder="Search customers..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full h-9 pl-8 pr-3 text-[13px] border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary placeholder:text-muted-foreground/50"
                    />
                  </div>
                  <div className="border border-border rounded-lg max-h-[200px] overflow-y-auto bg-white">
                    {filteredCustomers.map((customer, idx) => {
                      const isSelected = selectedCustomer?.id === customer.id;
                      return (
                        <button
                          key={customer.id}
                          type="button"
                          onClick={() => setSelectedCustomer(customer)}
                          className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors ${
                            idx > 0 ? 'border-t border-[#F1F5F9]' : ''
                          } ${isSelected ? 'bg-accent/60' : 'hover:bg-slate-50'}`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center shrink-0">
                              <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-[13px] text-foreground leading-tight truncate" style={{ fontWeight: 500 }}>
                                {customer.name}
                              </div>
                              <div className="flex items-center gap-1 mt-1 text-[10.5px] text-muted-foreground">
                                <MapPin className="w-2.5 h-2.5 shrink-0" />
                                <span className="truncate">{customer.location}</span>
                              </div>
                            </div>
                          </div>
                          {isSelected && (
                            <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center shrink-0">
                              <Check className="w-3 h-3 text-white" strokeWidth={3} />
                            </div>
                          )}
                        </button>
                      );
                    })}
                    {filteredCustomers.length === 0 && (
                      <div className="py-5 text-center text-[12px] text-muted-foreground">No customers found</div>
                    )}
                  </div>
                </div>
              )}
            </RadioOptionCard>
          </SectionCard>

          {/* Version section — hidden entirely when the quote has only
              one revision on file. With a single version the choice is
              not meaningful and the section just clutters the modal. */}
          {!onlyOneVersion && (
            <SectionCard
              icon={GitBranch}
              title="Version to duplicate"
              description={`${versions.length} versions available`}
            >
              <div className="px-1 pt-1 pb-0.5">
                <div className="text-[11.5px] text-muted-foreground mb-2">
                  Select version to duplicate. Current is selected by default.
                </div>
                <VersionSelect
                  versions={versions}
                  selectedVersion={selectedVersion}
                  latestVersion={latestVersionNum}
                  onSelect={setSelectedVersion}
                />
              </div>
            </SectionCard>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[#EEF2F6] bg-white rounded-b-2xl shrink-0">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="gap-1.5"
          >
            <Copy className="w-3.5 h-3.5" />
            Duplicate
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
