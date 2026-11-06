import { useState, useRef, useEffect, useCallback, CSSProperties } from 'react';
import {
  X,
  Pencil,
  FileText,
  Tag,
  BarChart3,
  Link2,
  Layers,
  StickyNote,
  Target,
  Upload,
  Paperclip,
  Trash2,
  Megaphone,
  CalendarClock,
  Swords,
  CalendarCheck,
  ChevronDown,
  User,
  Plus,
  Calendar,
  Clock,
  Lock,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  getPreQuoteDocs,
  addPreQuoteDoc,
  removePreQuoteDoc,
  subscribePreQuoteDocs,
  PreQuoteDocument,
} from '../../data/quoteStore';
/* Attach-link chip / picker imports are preserved for the future when
   the per-note link-attach affordance is reintroduced. See the
   commented-out blocks further down for the previous implementation.
   For now the Links section is a plain textarea (External Links) and
   no note surface renders a link picker. */
import {
  // getLinksForId,
  // addLinkForId,
  // removeLinkForId,
  subscribeToLinksRepository,
  getExternalLinksText,
  setExternalLinksText,
  // type ExternalLink as RepositoryLink,
} from '../../data/linksRepository';
// import { AttachedLinkChip } from '../shared/AttachedLinkChip';
// import { LinkPickerPopover } from '../shared/LinkPickerPopover';
// import { AddExternalLinkModal } from '../shared/AddExternalLinkModal';
import { TitledSection } from '../shared/TitledSection';
import { AttachmentCard } from '../shared/attachments/attachment-card';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Calendar as CalendarPicker } from '../ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Slider } from '../ui/slider';

interface OverviewTabProps {
  quoteNumber?: string;
  customerName?: string;
  contactName?: string;
  readOnly?: boolean;
  tags?: string[];
  priority?: 'High' | 'Standard' | 'Low' | 'Urgent' | 'Medium';
  winProbability?: number;
  salesRep?: { id: string; name: string; email: string };
  /** Called when a non-material deal information field changes */
  onNonMaterialChange?: (fieldKey: string, fieldLabel: string, oldValue?: string, newValue?: string) => void;
  /** True for quotes created via the in-app wizard. When set, every card
   *  on this tab initializes empty so the user fills them directly
   *  instead of inheriting demo-mock content from the seed quote. */
  isNewlyCreated?: boolean;
}

// ─── Shared card wrapper — Partner TitledSection chrome ──────────────────────
function FieldCard({
  title,
  icon,
  children,
  style: _style,
}: {
  title?: string;
  icon?: React.ElementType;
  children: React.ReactNode;
  style?: CSSProperties;
}) {
  if (title) {
    return (
      <TitledSection title={title} icon={icon}>
        {/* Body wraps children in a vertical flex so description + hint /
            editable row always stack as separate rows. The TitledSection
            header (icon + title) is intentionally rendered above this body
            and never receives any editable controls — keeps the bottom-right
            editable pattern enforceable across every deal-info card. */}
        <div style={{ padding: '8px 6px 4px', display: 'flex', flexDirection: 'column' }}>{children}</div>
      </TitledSection>
    );
  }
  return (
    <div className="rounded-lg border border-border bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)]" style={{ padding: '20px 24px' }}>
      {children}
    </div>
  );
}

/* ── RFQ/RFP attachment carousel — horizontal scroll of attachment cards ── */
function RfqCarousel({ files, onRemove }: { files: PreQuoteDocument[]; onRemove?: (id: string) => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollBy = (dir: 1 | -1) => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: dir * 240, behavior: 'smooth' });
  };

  return (
    // Partner-style nested capsule — gives the attachments section its own
    // outline so the carousel doesn't visually bleed into the description /
    // input rows above it inside the RFQ/RFP card.
    <div
      style={{
        marginTop: 14,
        backgroundColor: '#FAFBFC',
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: 12,
      }}
    >
      <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
        <span
          className="inline-flex items-center"
          style={{
            fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)',
            textTransform: 'uppercase', letterSpacing: '0.05em',
          }}
        >
          Attached Documents
          <span
            style={{
              marginLeft: 6, padding: '1px 6px', borderRadius: 999,
              background: '#FFFFFF', border: '1px solid var(--border)',
              fontSize: 10, fontWeight: 600, color: 'var(--foreground)',
              letterSpacing: 'normal', textTransform: 'none',
            }}
          >
            {files.length}
          </span>
        </span>
        {files.length > 3 && (
          <div className="flex items-center" style={{ gap: 4 }}>
            <button
              onClick={() => scrollBy(-1)}
              className="rounded-md border border-border bg-white hover:bg-[var(--surface-secondary)]"
              style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              aria-label="Scroll left"
            >
              <ChevronLeft className="w-3.5 h-3.5" style={{ color: 'var(--text-secondary)' }} />
            </button>
            <button
              onClick={() => scrollBy(1)}
              className="rounded-md border border-border bg-white hover:bg-[var(--surface-secondary)]"
              style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              aria-label="Scroll right"
            >
              <ChevronRight className="w-3.5 h-3.5" style={{ color: 'var(--text-secondary)' }} />
            </button>
          </div>
        )}
      </div>

      <div
        ref={scrollRef}
        style={{
          display: 'flex',
          gap: 12,
          overflowX: 'auto',
          paddingBottom: 4,
          scrollSnapType: 'x mandatory',
          scrollbarWidth: 'thin',
        }}
      >
        {files.map((file) => (
          <div key={file.id} style={{ flex: '0 0 220px', scrollSnapAlign: 'start' }}>
            <AttachmentCard
              compact
              att={{
                fileName: file.name,
                fileType: (file.type || 'pdf').toLowerCase(),
                fileSize: file.size,
                uploadedDate: file.uploadedAt,
                uploadedTime: '',
                uploadedBy: file.uploadedBy,
              }}
              pills={
                <span
                  className="inline-flex items-center"
                  style={{
                    padding: '1px 6px', borderRadius: 9999,
                    background: 'var(--reason-tag-bg)', border: '1px solid var(--reason-tag-border)', color: 'var(--reason-tag-text)',
                    fontWeight: 500, fontSize: 9, gap: 3, whiteSpace: 'nowrap', backdropFilter: 'blur(4px)',
                  }}
                >
                  RFQ/RFP
                </span>
              }
              onPreview={() => toast.info(`Preview: ${file.name}`)}
              onDownload={() => toast.info(`Downloading ${file.name}...`)}
              onCardClick={() => toast.info(`Preview: ${file.name}`)}
              onDelete={onRemove ? () => onRemove(file.id) : undefined}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── DealDateInput — Partner v7-aligned date picker ─────────────────
   Trigger is a 36-px field (matches the freight modal's DateInput chrome)
   with a leading Calendar icon. Clicking opens a `react-day-picker`
   calendar inside a `Popover` — the same `Calendar` primitive ships in
   Partner v7 via shadcn (see `ui/calendar.tsx`). This replaces the
   browser-native `<input type="date">` dropdown so the picker UI matches
   Partner across modules. */
function DealDateInput({
  value, onChange, onCommit, disabled, ariaLabel, width = '100%',
}: {
  value: string;
  onChange: (iso: string) => void;
  onCommit?: () => void;
  disabled?: boolean;
  ariaLabel?: string;
  width?: number | string;
}) {
  const [open, setOpen] = useState(false);
  const selected = value ? new Date(value + 'T00:00:00') : undefined;
  const formatted = selected
    ? `${String(selected.getMonth() + 1).padStart(2, '0')}/${String(selected.getDate()).padStart(2, '0')}/${selected.getFullYear()}`
    : '';

  return (
    <Popover open={open} onOpenChange={(o) => { if (disabled) return; setOpen(o); if (!o) onCommit?.(); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label={ariaLabel}
          style={{
            position: 'relative', width,
            height: 36, padding: '0 12px 0 32px',
            fontSize: 13, fontWeight: formatted ? 500 : 400,
            color: disabled ? '#94A3B8' : (formatted ? 'var(--foreground)' : 'var(--muted-foreground)'),
            border: `1px solid ${open ? '#0A77FF' : 'var(--border)'}`,
            borderRadius: 8,
            outline: 'none',
            backgroundColor: disabled ? '#F8FAFC' : '#FFFFFF',
            fontFamily: 'Inter, system-ui, sans-serif',
            boxSizing: 'border-box',
            textAlign: 'left',
            transition: 'border-color 150ms, box-shadow 150ms',
            cursor: disabled ? 'not-allowed' : 'pointer',
            boxShadow: open ? '0 0 0 3px rgba(10, 119, 255, 0.12)' : 'none',
          }}
        >
          <Calendar
            style={{
              position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
              width: 14, height: 14, color: disabled ? '#CBD5E1' : '#94A3B8', pointerEvents: 'none',
            }}
          />
          {formatted || 'Pick a date'}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0" sideOffset={6}>
        <CalendarPicker
          mode="single"
          selected={selected}
          onSelect={(d) => {
            if (!d) return;
            const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            onChange(iso);
            setOpen(false);
            onCommit?.();
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}

/* ── DealTimeInput — segmented 24-h HH:MM picker matching the freight
   modal's TimeInput24 chrome (`ShipmentMethodModal.tsx`). Stays the
   same height as DealDateInput (36px) so it lines up in a row. */
function DealTimeInput({
  value, onChange, onCommit, disabled, ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  onCommit?: () => void;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  const [focused, setFocused] = useState(false);
  const [hh, mm] = (() => {
    const [h, m] = (value || '09:00').split(':');
    return [h ?? '09', m ?? '00'];
  })();
  const hourRef = useRef<HTMLInputElement>(null);
  const minRef = useRef<HTMLInputElement>(null);

  const clampN = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
  const commit = (nextH: number, nextM: number) => {
    const h = clampN(Number.isFinite(nextH) ? nextH : 0, 0, 23);
    const m = clampN(Number.isFinite(nextM) ? nextM : 0, 0, 59);
    onChange(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  };
  const onHourChange = (raw: string) => {
    const cleaned = raw.replace(/\D/g, '').slice(0, 2);
    commit(parseInt(cleaned || '0', 10), parseInt(mm, 10));
    if (cleaned.length === 2) minRef.current?.focus();
  };
  const onMinChange = (raw: string) => {
    const cleaned = raw.replace(/\D/g, '').slice(0, 2);
    commit(parseInt(hh, 10), parseInt(cleaned || '0', 10));
  };

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      onClick={() => hourRef.current?.focus()}
      style={{
        display: 'inline-flex', alignItems: 'center',
        height: 36, paddingLeft: 32, paddingRight: 12,
        backgroundColor: disabled ? '#F8FAFC' : '#FFFFFF',
        border: `1px solid ${focused && !disabled ? '#0A77FF' : 'var(--border)'}`,
        borderRadius: 8,
        boxShadow: focused && !disabled ? '0 0 0 3px rgba(10, 119, 255, 0.12)' : 'none',
        cursor: disabled ? 'not-allowed' : 'text',
        position: 'relative',
        boxSizing: 'border-box',
        transition: 'border-color 150ms, box-shadow 150ms',
        width: 124,
      }}
    >
      <Clock
        style={{
          position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
          width: 14, height: 14, color: disabled ? '#CBD5E1' : '#94A3B8', pointerEvents: 'none',
        }}
      />
      <input
        ref={hourRef}
        type="text"
        inputMode="numeric"
        value={hh}
        disabled={disabled}
        onChange={e => onHourChange(e.target.value)}
        onFocus={e => { setFocused(true); e.currentTarget.select(); }}
        onBlur={e => {
          setFocused(false);
          commit(clampN(parseInt(e.currentTarget.value || '0', 10) || 0, 0, 23), parseInt(mm, 10));
          onCommit?.();
        }}
        aria-label="Hours"
        maxLength={2}
        style={{
          width: 22, fontSize: 13, textAlign: 'center', outline: 'none',
          backgroundColor: 'transparent', border: 'none',
          fontFeatureSettings: "'tnum'", fontVariantNumeric: 'tabular-nums',
          color: disabled ? '#94A3B8' : '#0F172A',
          cursor: disabled ? 'not-allowed' : 'text',
        }}
      />
      <span style={{ color: disabled ? '#CBD5E1' : '#94A3B8', padding: '0 2px', fontFeatureSettings: "'tnum'", fontVariantNumeric: 'tabular-nums' }}>:</span>
      <input
        ref={minRef}
        type="text"
        inputMode="numeric"
        value={mm}
        disabled={disabled}
        onChange={e => onMinChange(e.target.value)}
        onFocus={e => { setFocused(true); e.currentTarget.select(); }}
        onBlur={e => {
          setFocused(false);
          commit(parseInt(hh, 10), clampN(parseInt(e.currentTarget.value || '0', 10) || 0, 0, 59));
          onCommit?.();
        }}
        aria-label="Minutes"
        maxLength={2}
        style={{
          width: 22, fontSize: 13, textAlign: 'center', outline: 'none',
          backgroundColor: 'transparent', border: 'none',
          fontFeatureSettings: "'tnum'", fontVariantNumeric: 'tabular-nums',
          color: disabled ? '#94A3B8' : '#0F172A',
          cursor: disabled ? 'not-allowed' : 'text',
        }}
      />
    </div>
  );
}

/* ── DealTimeDisplay — read-only chip mirroring DealTimeInput ── */
function DealTimeDisplay({ value }: { value: string }) {
  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', width: 124 }}>
      <Clock style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: '#94A3B8', pointerEvents: 'none' }} />
      <div style={{
        flex: 1, height: 36, padding: '0 12px 0 32px', display: 'flex', alignItems: 'center',
        backgroundColor: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 8,
        fontSize: 13, fontWeight: 500, color: value ? 'var(--foreground)' : 'var(--muted-foreground)',
        fontFeatureSettings: "'tnum'", fontVariantNumeric: 'tabular-nums',
        boxSizing: 'border-box',
      }}>
        {value || '--:--'}
      </div>
    </div>
  );
}

/* ── DealDateDisplay — read-only chip mirroring the input chrome ── */
function DealDateDisplay({ value, width = '100%' }: { value: string; width?: number | string }) {
  const formatted = value ? (() => {
    const d = new Date(value + 'T00:00:00');
    return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
  })() : '';
  return (
    <div style={{ position: 'relative', width }}>
      <Calendar
        style={{
          position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
          width: 14, height: 14, color: '#94A3B8', pointerEvents: 'none',
        }}
      />
      <div style={{
        height: 36, padding: '0 12px 0 32px', display: 'flex', alignItems: 'center',
        backgroundColor: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 8,
        fontSize: 13, fontWeight: 500,
        color: formatted ? 'var(--foreground)' : 'var(--muted-foreground)',
        boxSizing: 'border-box',
      }}>
        {formatted || 'Not set'}
      </div>
    </div>
  );
}

export function OverviewTab({
  quoteNumber = 'Q-000-000-000',
  customerName = 'Tri-County EMS Authority',
  contactName = 'Karen Rodriguez',
  readOnly = false,
  onNonMaterialChange,
  tags: initialTags,
  priority: initialPriority,
  winProbability: initialWinProb,
  salesRep: initialSalesRep,
  isNewlyCreated = false,
}: OverviewTabProps) {
  /* Win probability starts at a neutral 50% for newly-created quotes,
     letting the user nudge up or down from a midpoint without having
     to drag from 0. Existing mock quotes keep the demo 65% seed. */
  const [winProbability, setWinProbability] = useState(
    initialWinProb ?? (isNewlyCreated ? 50 : 65)
  );

  const [rfqId, setRfqId] = useState('');

  // RFQ/RFP file upload — backed by shared store so Attachments tab sees them
  const storeKey = quoteNumber;
  const [rfqFiles, setRfqFiles] = useState<PreQuoteDocument[]>(() => getPreQuoteDocs(storeKey));
  const rfqFileInputRef = useRef<HTMLInputElement>(null);

  // Keep local state in sync with the shared store
  useEffect(() => {
    const unsub = subscribePreQuoteDocs(storeKey, () => {
      setRfqFiles(getPreQuoteDocs(storeKey));
    });
    // Also sync on mount in case store already has data
    setRfqFiles(getPreQuoteDocs(storeKey));
    return unsub;
  }, [storeKey]);

  const handleRfqFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const ext = (name: string) => name.split('.').pop()?.toLowerCase() || 'pdf';
    Array.from(files).forEach(f => {
      const doc: PreQuoteDocument = {
        id: `pq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: f.name,
        size: f.size < 1024 * 1024 ? `${Math.round(f.size / 1024)} KB` : `${(f.size / (1024 * 1024)).toFixed(1)} MB`,
        type: ext(f.name),
        uploadedBy: 'You',
        uploadedAt: (() => { const d = new Date(); return `${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}/${d.getFullYear()}`; })(),
      };
      addPreQuoteDoc(storeKey, doc);
    });
    toast.success(`${files.length} file${files.length > 1 ? 's' : ''} uploaded`, {
      description: 'Also visible in Attachments → Pre-Quote Documents.',
      position: 'top-right',
    });
    if (e.target) e.target.value = '';
  }, [storeKey]);

  const handleRemoveRfqFile = useCallback((docId: string) => {
    removePreQuoteDoc(storeKey, docId);
    toast.info('File removed', { position: 'top-right' });
  }, [storeKey]);

  const [tags, setTags] = useState<string[]>(
    initialTags && initialTags.length > 0
      ? initialTags
      : (isNewlyCreated ? [] : ['Engine Components', 'Hydraulics'])
  );

  // External Notes state (included in PDF)
  const [externalNotes, setExternalNotes] = useState(
    isNewlyCreated
      ? ''
      : 'Customer prefers email communication. Budget approved for Q1 2026. Follow up with procurement team by end of month regarding fleet discount eligibility.'
  );

  /* Attach-link plumbing (per-note picker + chip repository) is
     currently disabled. State + helpers are kept commented in case we
     re-enable the per-note attach flow later. */
  // const [externalNoteLinkIds, setExternalNoteLinkIds] = useState<string[]>([]);
  // const [showExternalNoteLinkPicker, setShowExternalNoteLinkPicker] = useState(false);
  // const [externalLinkPickerAnchor, setExternalLinkPickerAnchor] = useState<HTMLButtonElement | null>(null);
  // const [internalNoteLinkIds, setInternalNoteLinkIds] = useState<string[]>([]);
  // const [showInternalNoteLinkPicker, setShowInternalNoteLinkPicker] = useState(false);
  // const [internalLinkPickerAnchor, setInternalLinkPickerAnchor] = useState<HTMLButtonElement | null>(null);
  // const [showAddLinkModal, setShowAddLinkModal] = useState(false);

  /* External Links textarea — Deal Info's Links section is now a
     single multi-line textarea. One URL per line, no descriptions or
     metadata. The PDF's References section renders the list plain
     (no `[N]` markers). */
  const [linksRepoVersion, setLinksRepoVersion] = useState(0);
  useEffect(() => subscribeToLinksRepository(() => setLinksRepoVersion((v) => v + 1)), []);
  void linksRepoVersion;
  const [externalLinksText, setExternalLinksTextLocal] = useState<string>(() => getExternalLinksText(storeKey));
  useEffect(() => { setExternalLinksTextLocal(getExternalLinksText(storeKey)); }, [storeKey]);

  // Internal Notes state (NOT included in PDF — team only)
  const [internalNotes, setInternalNotes] = useState(
    isNewlyCreated
      ? ''
      : 'Spoke with CFO on Mar 3 — they have budget but need board sign-off. Competitor (FleetPro) quoted 8% lower but without conversion package. Push delivery timeline to lock commitment before Q2 review.'
  );

  // Lead Source state
  const LEAD_SOURCES = [
    { key: 'inbound_rfq', label: 'Inbound RFQ' },
    { key: 'trade_show', label: 'Trade Show' },
    { key: 'referral', label: 'Referral' },
    { key: 'existing_customer_reorder', label: 'Existing Customer Reorder' },
    { key: 'cold_outreach', label: 'Cold Outreach' },
    { key: 'other', label: 'Other' },
  ] as const;

  const LEAD_SOURCE_META: Record<string, { detailLabel: string; placeholder: string }> = {
    inbound_rfq: { detailLabel: 'RFQ REFERENCE', placeholder: 'e.g. RFQ-2026-0042 via procurement portal' },
    trade_show: { detailLabel: 'TRADE SHOW NAME & LINK', placeholder: 'e.g. FDIC 2026, Chicago' },
    referral: { detailLabel: 'REFERRED BY', placeholder: 'e.g. John Smith, ABC Corp' },
    existing_customer_reorder: { detailLabel: 'ORIGINAL ORDER REFERENCE', placeholder: 'e.g. SO-2025-0188' },
    cold_outreach: { detailLabel: 'OUTREACH CAMPAIGN / NOTES', placeholder: 'e.g. LinkedIn sequence, Q1 campaign' },
    other: { detailLabel: 'DETAILS', placeholder: 'Add any relevant context' },
  };

  const [leadSources, setLeadSources] = useState<Array<{ key: string; detail: string }>>(
    isNewlyCreated ? [] : [{ key: 'inbound_rfq', detail: 'RFQ-2026-0042 via procurement portal' }]
  );
  const [showLeadSourceDropdown, setShowLeadSourceDropdown] = useState(false);
  const leadSourceDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (leadSourceDropdownRef.current && !leadSourceDropdownRef.current.contains(e.target as Node)) {
        setShowLeadSourceDropdown(false);
      }
    };
    if (showLeadSourceDropdown) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showLeadSourceDropdown]);

  const addLeadSource = (key: string) => {
    if (!leadSources.find(s => s.key === key)) {
      setLeadSources([...leadSources, { key, detail: '' }]);
      const label = LEAD_SOURCES.find(s => s.key === key)?.label || key;
      onNonMaterialChange?.('lead_source', 'Lead Source', undefined, `Added: ${label}`);
    }
    setShowLeadSourceDropdown(false);
  };

  const removeLeadSource = (key: string) => {
    const label = LEAD_SOURCES.find(s => s.key === key)?.label || key;
    setLeadSources(leadSources.filter(s => s.key !== key));
    onNonMaterialChange?.('lead_source', 'Lead Source', label, 'Removed');
  };

  const updateLeadSourceDetail = (key: string, detail: string) => {
    setLeadSources(leadSources.map(s => s.key === key ? { ...s, detail } : s));
  };

  // Expected Close Date — empty for newly-created so the date picker opens fresh
  const [expectedCloseDate, setExpectedCloseDate] = useState(isNewlyCreated ? '' : '2026-04-15');

  // Competitive Situation — default to "none" for newly-created so the user makes an explicit pick
  const COMPETITIVE_OPTIONS = [
    { key: 'none', label: 'None' },
    { key: 'competitive', label: 'Competitive' },
    { key: 'sole_source', label: 'Sole Source' },
    { key: 'incumbent', label: 'Incumbent' },
  ] as const;
  const [competitiveSituation, setCompetitiveSituation] = useState<string>(isNewlyCreated ? 'none' : 'sole_source');

  // Follow-up Date / Next Action — empty for newly-created
  const [followUpDate, setFollowUpDate] = useState(isNewlyCreated ? '' : '2026-03-01');
  const [followUpTime, setFollowUpTime] = useState(isNewlyCreated ? '' : '09:00');
  const [assignedTo, setAssignedTo] = useState(isNewlyCreated ? '' : 'Sarah Chen');
  const [nextAction, setNextAction] = useState(isNewlyCreated ? '' : 'Call Sarah to discuss procurement timeline and confirm fleet specs');

  // Team members for Assigned To dropdown
  const TEAM_MEMBERS = [
    { id: 'sc', name: 'Sarah Chen', initials: 'SC', roles: ['Sales Manager', 'Team Lead'] },
    { id: 'jd', name: 'James Donovan', initials: 'JD', roles: ['Account Executive'] },
    { id: 'mp', name: 'Maria Perez', initials: 'MP', roles: ['Sales Engineer', 'Technical Advisor'] },
    { id: 'rk', name: 'Raj Kumar', initials: 'RK', roles: ['Business Development Rep'] },
    { id: 'lw', name: 'Lisa Wang', initials: 'LW', roles: ['Senior Account Executive', 'Key Accounts'] },
    { id: 'th', name: 'Tom Harris', initials: 'TH', roles: ['Solutions Consultant'] },
    { id: 'ab', name: 'Angela Brooks', initials: 'AB', roles: ['Sales Operations', 'Pricing Analyst'] },
  ];
  const [showAssignedToDropdown, setShowAssignedToDropdown] = useState(false);
  const assignedToRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (assignedToRef.current && !assignedToRef.current.contains(e.target as Node)) {
        setShowAssignedToDropdown(false);
      }
    };
    if (showAssignedToDropdown) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showAssignedToDropdown]);

  const getWinProbColor = () => {
    if (winProbability >= 70) return 'var(--success)';
    if (winProbability >= 40) return 'var(--warning)';
    return 'var(--destructive)';
  };

  // Shared styles — Partner v7 typography hierarchy:
  //   Title       13px / 600 / slate-900 (defined in TitledSection)
  //   Description 13px / 400 / slate-600 — main explanatory copy. Same size as
  //                                        the title but lighter weight, so it
  //                                        reads as primary body text without
  //                                        out-sizing the title (Partner pattern).
  //   Hint        12px / 400 / slate-400 — italic, leading 12-px icon, on its
  //                                        own line under a dashed hairline.
  //   Editable    For cards WITHOUT hints, the input row drops to bottom-right
  //                                        under a matching dashed hairline so
  //                                        the editable feels grouped with the
  //                                        description rather than floating.
  const iconBox: CSSProperties = {
    width: '28px', height: '28px', borderRadius: '7px', backgroundColor: 'var(--muted)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  };
  const titleStyle: CSSProperties = {
    fontSize: '13px', fontWeight: 600, color: 'var(--foreground)', lineHeight: '1.2',
  };
  const descStyle: CSSProperties = {
    fontSize: '13px', fontWeight: 400, color: '#475569', lineHeight: '1.55', marginTop: '2px',
  };
  const hintStyle: CSSProperties = {
    display: 'flex', alignItems: 'flex-start', gap: '6px',
    fontSize: '12px', fontWeight: 400, fontStyle: 'italic',
    color: '#94A3B8', lineHeight: '1.5',
    marginTop: '12px', paddingTop: '10px',
    borderTop: '1px dashed #E2E8F0',
  };
  // Editable row that sits at the bottom-right of a card body with the same
  // dashed hairline that separates hints — keeps the bottom strip rhythm
  // consistent across hint-bearing and hint-less cards.
  const editableRowStyle: CSSProperties = {
    display: 'flex', justifyContent: 'flex-end',
    marginTop: '12px', paddingTop: '10px',
    borderTop: '1px dashed #E2E8F0',
  };

  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}>

        {/* ── Win Probability ── */}
        <FieldCard title="Win Probability" icon={Target}>
          <div style={descStyle}>
            Probability this quote converts into a confirmed sales order. The percentage feeds the pipeline revenue forecast and weighted booking report.
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: '12px', gap: '16px' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={hintStyle}>
                <BarChart3 style={{ width: '12px', height: '12px', flexShrink: 0, marginTop: '1px' }} />
                <span>
                  {winProbability >= 70
                    ? 'Strong confidence. Included in the committed forecast at full weighted value.'
                    : winProbability >= 40
                      ? 'Moderate confidence. Counted in the pipeline forecast but not the committed forecast.'
                      : 'At risk. Consider a follow-up or pricing review before the validity window closes.'}
                </span>
              </div>
            </div>
            <div style={{ flexShrink: 0, width: '280px' }}>
              {/* Partners-chrome wrapper: rounded-lg (8px), 36px tall,
                  hairline border, subtle muted backdrop. The slider
                  thumb (16px white circle with tier-color border) sits
                  visually proud of the track so its draggability reads
                  immediately. */}
              <div style={{
                display: 'flex', alignItems: 'center',
                height: '36px', borderRadius: '8px',
                borderWidth: '1px', borderStyle: 'solid', borderColor: 'var(--border)',
                backgroundColor: '#FFFFFF', overflow: 'hidden',
                transition: 'border-color 150ms, box-shadow 150ms',
              }}
                onFocus={(e) => {
                  if (!readOnly) {
                    e.currentTarget.style.borderColor = 'var(--primary)';
                    e.currentTarget.style.boxShadow = '0 0 0 2px rgba(59,130,246,0.12)';
                  }
                }}
                onBlur={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    e.currentTarget.style.borderColor = 'var(--border)';
                    e.currentTarget.style.boxShadow = 'none';
                  }
                }}
              >
                <input
                  type="number" min={0} max={100}
                  value={winProbability}
                  readOnly={readOnly}
                  onChange={(e) => {
                    const v = parseInt(e.target.value);
                    if (!isNaN(v)) setWinProbability(Math.min(100, Math.max(0, v)));
                  }}
                  onBlur={() => {
                    onNonMaterialChange?.('win_probability', 'Win Probability', undefined, `${winProbability}%`);
                  }}
                  className="tabular-nums"
                  style={{
                    width: '44px', height: '100%', textAlign: 'right',
                    border: 'none', fontSize: '13px', fontWeight: 600,
                    color: getWinProbColor(),
                    outline: 'none', fontFamily: 'Inter, system-ui, sans-serif', padding: '0 2px 0 10px',
                    backgroundColor: 'transparent',
                    cursor: readOnly ? 'default' : 'text',
                    MozAppearance: 'textfield' as any,
                  }}
                />
                <span style={{
                  fontSize: '12px', fontWeight: 500, color: 'var(--muted-foreground)',
                  paddingRight: '10px', flexShrink: 0,
                  borderRightWidth: '1px', borderRightStyle: 'solid', borderRightColor: 'var(--border)',
                  height: '100%', display: 'flex', alignItems: 'center', paddingLeft: '4px',
                }}>%</span>
                <div
                  style={{
                    flex: 1, height: '100%', display: 'flex', alignItems: 'center',
                    padding: '0 12px', gap: '10px',
                    /* Scope the slider's primary color to the tier
                       (success / warning / destructive) so the range fill
                       and thumb border match the existing Strong /
                       Moderate / At Risk semantic. Slider primitive uses
                       Tailwind `bg-primary` + `border-primary`, both of
                       which resolve through this CSS variable. */
                    ['--primary' as any]: getWinProbColor(),
                    ['--ring' as any]: getWinProbColor(),
                  }}
                >
                  <Slider
                    value={[winProbability]}
                    min={0}
                    max={100}
                    step={1}
                    disabled={readOnly}
                    onValueChange={(vals) => {
                      const v = Array.isArray(vals) ? vals[0] : vals;
                      if (typeof v === 'number') setWinProbability(Math.min(100, Math.max(0, v)));
                    }}
                    onValueCommit={(vals) => {
                      const v = Array.isArray(vals) ? vals[0] : vals;
                      if (typeof v === 'number') onNonMaterialChange?.('win_probability', 'Win Probability', undefined, `${v}%`);
                    }}
                    className="flex-1"
                  />
                  <span style={{
                    fontSize: '12px', fontWeight: 500, color: getWinProbColor(),
                    whiteSpace: 'nowrap', flexShrink: 0, letterSpacing: '0.01em',
                  }}>
                    {winProbability >= 70 ? 'Strong' : winProbability >= 40 ? 'Moderate' : 'At Risk'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </FieldCard>

        {/* ── RFQ ID & Document Upload ── */}
        <FieldCard title="RFQ/RFP ID & Documents" icon={FileText}>
          <div style={descStyle}>
            Link this quote to the customer's Request for Quotation or Proposal reference number and upload the original document. Uploaded files are also accessible under Pre-Quote Documents in the Attachments tab.
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: '12px', gap: '16px' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={hintStyle}>
                <Link2 style={{ width: '12px', height: '12px', flexShrink: 0, marginTop: '1px' }} />
                <span>Linking an RFQ/RFP makes this quote searchable by the customer's reference and auto-populates the field on quote exports.</span>
              </div>
            </div>
            <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              {readOnly ? (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', height: '32px', padding: '0 12px', borderRadius: '6px',
                  borderWidth: '1px', borderStyle: 'solid', borderColor: 'var(--border)',
                  backgroundColor: 'var(--muted)',
                  fontSize: '13px', fontWeight: rfqId ? 600 : 400,
                  color: rfqId ? 'var(--foreground)' : 'var(--muted-foreground)',
                  lineHeight: '1', fontFamily: 'Inter, system-ui, sans-serif',
                  whiteSpace: 'nowrap',
                }}>
                  {rfqId || 'Not linked'}
                </span>
              ) : (
                <div style={{ position: 'relative' }}>
                  <label
                    style={{
                      position: 'absolute', top: '-7px', left: '9px',
                      fontSize: '10px', fontWeight: 500, color: 'var(--muted-foreground)',
                      backgroundColor: '#FFFFFF', padding: '0 3px',
                      lineHeight: '1', zIndex: 1,
                    }}
                  >
                    Enter RFQ/RFP ID
                  </label>
                  <input
                    type="text"
                    value={rfqId}
                    onChange={(e) => setRfqId(e.target.value)}
                    onBlur={() => {
                      if (onNonMaterialChange) {
                        onNonMaterialChange('rfqId', 'RFQ/RFP ID', undefined, rfqId);
                      }
                    }}
                    placeholder="e.g. RFQ-2026-0042"
                    style={{
                      width: '200px', height: '32px',
                      borderWidth: '1px', borderStyle: 'solid', borderColor: 'var(--border)',
                      borderRadius: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--foreground)',
                      outline: 'none', fontFamily: 'Inter, system-ui, sans-serif',
                      padding: '0 10px', backgroundColor: '#FFFFFF',
                      boxSizing: 'border-box' as const,
                      transition: 'border-color 150ms, box-shadow 150ms',
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = 'var(--primary)';
                      e.currentTarget.style.boxShadow = '0 0 0 2px rgba(59,130,246,0.12)';
                    }}
                    onBlurCapture={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  />
                </div>
              )}
              {/* Upload button */}
              {!readOnly && (
                <>
                  <input
                    ref={rfqFileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.doc,.docx,.xlsx,.xls,.csv,.png,.jpg,.jpeg"
                    onChange={handleRfqFileUpload}
                    style={{ display: 'none' }}
                  />
                  <button
                    onClick={() => rfqFileInputRef.current?.click()}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '5px',
                      height: '32px', padding: '0 12px', borderRadius: '6px',
                      borderWidth: '1px', borderStyle: 'solid', borderColor: 'var(--border)',
                      backgroundColor: '#FFFFFF', color: 'var(--muted-foreground)',
                      fontSize: '12px', fontWeight: 500, cursor: 'pointer',
                      lineHeight: '1', transition: 'all 120ms',
                      fontFamily: 'Inter, system-ui, sans-serif',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.backgroundColor = 'var(--muted)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
                  >
                    <Upload style={{ width: '13px', height: '13px' }} />
                    Upload RFQ/RFP
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Uploaded RFQ files — horizontal carousel of attachment cards */}
          {rfqFiles.length > 0 && (
            <RfqCarousel files={rfqFiles} onRemove={readOnly ? undefined : handleRemoveRfqFile} />
          )}
        </FieldCard>

        {/* Tags moved to the sidebar's quote information card, with the other
            created facts. */}

        {/* ── External Notes ── */}
        <FieldCard title="External Notes" icon={StickyNote}>
          <div style={descStyle}>
            Customer-facing notes that will appear on the generated quote — special terms, clarifications, or any context the customer should see alongside the line items.
          </div>
          {/* Always-editable notes area */}
          <div style={{ marginTop: '12px' }}>
            {readOnly ? (
              externalNotes ? (
                <div
                  style={{
                    padding: '10px 12px', borderRadius: '6px',
                    backgroundColor: '#FFFFFF', borderWidth: '1px', borderStyle: 'solid', borderColor: 'var(--border)',
                    fontSize: '13px', color: 'var(--foreground)', lineHeight: '1.6',
                  }}
                >
                  {externalNotes}
                </div>
              ) : (
                <div style={{
                  padding: '10px 12px', borderRadius: '6px',
                  backgroundColor: 'var(--muted)', borderWidth: '1px', borderStyle: 'solid', borderColor: 'var(--border)',
                  fontSize: '13px', color: 'var(--muted-foreground)', lineHeight: '1.6',
                }}>
                  No external notes added.
                </div>
              )
            ) : (
              <textarea
                value={externalNotes}
                onChange={(e) => setExternalNotes(e.target.value)}
                onBlur={() => {
                  onNonMaterialChange?.('externalNotes', 'External Notes', undefined, externalNotes);
                }}
                placeholder="Add notes to include in the quote..."
                rows={3}
                style={{
                  width: '100%', padding: '10px 12px', fontSize: '13px', color: 'var(--foreground)',
                  borderWidth: '1px', borderStyle: 'solid', borderColor: 'var(--border)',
                  borderRadius: '6px', outline: 'none', backgroundColor: '#FFFFFF',
                  fontFamily: 'Inter, system-ui, sans-serif', lineHeight: '1.6',
                  resize: 'vertical', minHeight: '72px',
                  boxSizing: 'border-box' as const,
                  transition: 'border-color 150ms, box-shadow 150ms',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(10, 119, 255, 0.4)';
                  e.currentTarget.style.boxShadow = '0 0 0 2px rgba(59,130,246,0.12)';
                }}
                onBlurCapture={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
            )}
            {/* Attached links + attach affordance — External Notes can
                reference links from the Deal Info Links repository so
                context that lives outside the app (compliance docs,
                shared workspaces, portals) travels with the note. */}
            {/* Attach-link affordance disabled — chip render + picker
                code preserved as a commented block so we can bring the
                per-note attach flow back later.
                {(externalNoteLinks.length > 0 || !readOnly) && (
                  <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                    {externalNoteLinks.map((link) => (
                      <AttachedLinkChip
                        key={link.id}
                        link={link}
                        onRemove={readOnly ? undefined : () => setExternalNoteLinkIds((prev) => prev.filter((id) => id !== link.id))}
                      />
                    ))}
                    {!readOnly && (
                      <>
                        <button
                          ref={setExternalLinkPickerAnchor}
                          type="button"
                          onClick={() => setShowExternalNoteLinkPicker((v) => !v)}
                          className="inline-flex items-center gap-1 rounded-full hover:bg-slate-50 transition-colors"
                          style={{ padding: '2px 10px', border: '1px dashed var(--border)', background: 'var(--card)',
                            color: 'var(--muted-foreground)', fontSize: 11.5, fontWeight: 500, cursor: 'pointer' }}
                        >
                          <Link2 style={{ width: 11, height: 11 }} />
                          Attach a link
                        </button>
                        {showExternalNoteLinkPicker && (
                          <LinkPickerPopover
                            anchor={externalLinkPickerAnchor}
                            docId={storeKey}
                            attachedIds={externalNoteLinkIds}
                            currentUser={assignedTo || 'Sarah Chen'}
                            onPick={(link) => {
                              setExternalNoteLinkIds((prev) => (prev.includes(link.id) ? prev : [...prev, link.id]));
                              setShowExternalNoteLinkPicker(false);
                            }}
                            onClose={() => setShowExternalNoteLinkPicker(false)}
                          />
                        )}
                      </>
                    )}
                  </div>
                )}
            */}
          </div>
        </FieldCard>

        {/* ── External Links ── */}
        <FieldCard title="External Links" icon={Link2}>
          <div style={descStyle}>
            Paste any URLs relevant to this quote — one link per line.
            The list is repeated in the References section of the quote
            PDF so the customer can open them; reference a specific URL
            from a line-item description if you want to point at it
            directly.
          </div>
          <div style={{ marginTop: 12 }}>
            <textarea
              value={externalLinksText}
              onChange={(e) => { if (readOnly) return; setExternalLinksTextLocal(e.target.value); setExternalLinksText(storeKey, e.target.value); }}
              readOnly={readOnly}
              placeholder={'https://docs.example.com/agreements/mpa-2026\nhttps://sharepoint.example.com/safety/nfpa1917'}
              rows={4}
              style={{
                width: '100%', fontSize: 12, color: 'var(--foreground)',
                border: '1px solid var(--border)', borderRadius: 8,
                background: 'var(--card)', padding: '10px 12px',
                lineHeight: 1.6, resize: 'vertical', minHeight: 96,
                boxSizing: 'border-box', outline: 'none',
                fontFamily: 'Inter, system-ui, sans-serif',
              }}
            />
          </div>
          {/* Previous chip-based Links section preserved as a commented
              block for a future restore.
              <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                {repoLinks.map((link) => (
                  <AttachedLinkChip
                    key={link.id}
                    link={link}
                    onRemove={readOnly ? undefined : () => removeLinkForId(storeKey, link.id)}
                  />
                ))}
                {repoLinks.length === 0 && readOnly && (
                  <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>No links added.</span>
                )}
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => setShowAddLinkModal(true)}
                    className="inline-flex items-center gap-1 rounded-full hover:bg-slate-50 transition-colors"
                    style={{ padding: '2px 10px', border: '1px dashed var(--border)', background: 'var(--card)',
                      color: 'var(--muted-foreground)', fontSize: 11.5, fontWeight: 500, cursor: 'pointer' }}
                  >
                    <Plus style={{ width: 11, height: 11 }} />
                    Add link
                  </button>
                )}
              </div>
              <AddExternalLinkModal
                open={showAddLinkModal}
                onClose={() => setShowAddLinkModal(false)}
                onAdd={(label, url) => {
                  addLinkForId(storeKey, { label, url, addedBy: assignedTo || 'Sarah Chen' });
                  setShowAddLinkModal(false);
                }}
                title="Add link"
                confirmLabel="Add link"
              />
          */}
        </FieldCard>

        {/* ── Internal Notes ── */}
        <FieldCard title="Internal Notes" icon={Lock}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <span style={{
              fontSize: '10px', fontWeight: 600, letterSpacing: '0.5px',
              color: 'var(--muted-foreground)', backgroundColor: 'var(--muted)',
              padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase' as const,
            }}>Team Only</span>
          </div>
          <div style={descStyle}>
            Private notes visible only to your team — strategy, negotiation context, competitor intel, or follow-up reminders. Never included in customer-facing documents.
          </div>
          {/* Always-editable notes area */}
          <div style={{ marginTop: '12px' }}>
            {readOnly ? (
              internalNotes ? (
                <div
                  style={{
                    padding: '10px 12px', borderRadius: '6px',
                    backgroundColor: '#FFFFFF', borderWidth: '1px', borderStyle: 'solid', borderColor: 'var(--border)',
                    fontSize: '13px', color: 'var(--foreground)', lineHeight: '1.6',
                  }}
                >
                  {internalNotes}
                </div>
              ) : (
                <div style={{
                  padding: '10px 12px', borderRadius: '6px',
                  backgroundColor: 'var(--muted)', borderWidth: '1px', borderStyle: 'solid', borderColor: 'var(--border)',
                  fontSize: '13px', color: 'var(--muted-foreground)', lineHeight: '1.6',
                }}>
                  No internal notes added.
                </div>
              )
            ) : (
              <textarea
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                onBlur={() => {
                  onNonMaterialChange?.('internalNotes', 'Internal Notes', undefined, internalNotes);
                }}
                placeholder="Add private team notes — strategy, context, reminders..."
                rows={3}
                style={{
                  width: '100%', padding: '10px 12px', fontSize: '13px', color: 'var(--foreground)',
                  borderWidth: '1px', borderStyle: 'solid', borderColor: 'var(--border)',
                  borderRadius: '6px', outline: 'none', backgroundColor: '#FFFFFF',
                  fontFamily: 'Inter, system-ui, sans-serif', lineHeight: '1.6',
                  resize: 'vertical', minHeight: '72px',
                  boxSizing: 'border-box' as const,
                  transition: 'border-color 150ms, box-shadow 150ms',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(10, 119, 255, 0.4)';
                  e.currentTarget.style.boxShadow = '0 0 0 2px rgba(59,130,246,0.12)';
                }}
                onBlurCapture={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
            )}
            {/* Attach-link affordance disabled — chip render + picker
                code preserved as a commented block for a future restore.
                {(internalNoteLinks.length > 0 || !readOnly) && (
                  <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                    {internalNoteLinks.map((link) => (
                      <AttachedLinkChip
                        key={link.id}
                        link={link}
                        onRemove={readOnly ? undefined : () => setInternalNoteLinkIds((prev) => prev.filter((id) => id !== link.id))}
                      />
                    ))}
                    {!readOnly && (
                      <>
                        <button
                          ref={setInternalLinkPickerAnchor}
                          type="button"
                          onClick={() => setShowInternalNoteLinkPicker((v) => !v)}
                          className="inline-flex items-center gap-1 rounded-full hover:bg-slate-50 transition-colors"
                          style={{ padding: '2px 10px', border: '1px dashed var(--border)', background: 'var(--card)',
                            color: 'var(--muted-foreground)', fontSize: 11.5, fontWeight: 500, cursor: 'pointer' }}
                        >
                          <Link2 style={{ width: 11, height: 11 }} />
                          Attach a link
                        </button>
                        {showInternalNoteLinkPicker && (
                          <LinkPickerPopover
                            anchor={internalLinkPickerAnchor}
                            docId={storeKey}
                            attachedIds={internalNoteLinkIds}
                            currentUser={assignedTo || 'Sarah Chen'}
                            onPick={(link) => {
                              setInternalNoteLinkIds((prev) => (prev.includes(link.id) ? prev : [...prev, link.id]));
                              setShowInternalNoteLinkPicker(false);
                            }}
                            onClose={() => setShowInternalNoteLinkPicker(false)}
                          />
                        )}
                      </>
                    )}
                  </div>
                )}
            */}
          </div>
        </FieldCard>

        {/* ── Lead Source ── */}
        <FieldCard title="Lead Source" icon={Megaphone}>
          <div style={descStyle}>
            How this opportunity originated. Helps measure channel effectiveness and attribute pipeline revenue to the right acquisition channel.
          </div>
          {/* Add source dropdown — bottom-right (cards without hint sections
              stack the editable below the description on its own row). */}
          {!readOnly && (
            <div style={editableRowStyle}>
              <div ref={leadSourceDropdownRef} style={{ position: 'relative', width: '240px' }}>
                <button
                  onClick={() => setShowLeadSourceDropdown(!showLeadSourceDropdown)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    width: '240px', height: '36px', padding: '0 12px',
                    fontSize: '13px', color: 'var(--muted-foreground)',
                    border: '1px solid var(--border)', borderRadius: '8px',
                    outline: 'none', backgroundColor: '#FFFFFF',
                    fontFamily: 'Inter, system-ui, sans-serif',
                    boxSizing: 'border-box' as const,
                    cursor: 'pointer',
                    transition: 'border-color 150ms, box-shadow 150ms',
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = '#0A77FF'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(10, 119, 255, 0.12)'; }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Plus style={{ width: '13px', height: '13px' }} />
                    Add source...
                  </span>
                  <ChevronDown style={{ width: '13px', height: '13px', transition: 'transform 150ms', transform: showLeadSourceDropdown ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                </button>
                {showLeadSourceDropdown && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px',
                    backgroundColor: '#FFFFFF', border: '1px solid var(--border)',
                    borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                    zIndex: 20, overflow: 'hidden',
                  }}>
                    {LEAD_SOURCES.filter(s => !leadSources.some(ls => ls.key === s.key)).length === 0 ? (
                      <div style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--muted-foreground)', textAlign: 'center' }}>
                        All sources added
                      </div>
                    ) : (
                      LEAD_SOURCES.filter(s => !leadSources.some(ls => ls.key === s.key)).map(src => (
                        <button
                          key={src.key}
                          onClick={() => addLeadSource(src.key)}
                          style={{
                            display: 'block', width: '100%', textAlign: 'left',
                            padding: '8px 12px', fontSize: '13px', fontWeight: 400, color: 'var(--foreground)',
                            border: 'none', backgroundColor: 'transparent', cursor: 'pointer',
                            fontFamily: 'Inter, system-ui, sans-serif',
                            transition: 'background-color 100ms',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--muted)'; }}
                          onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                        >
                          {src.label}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
          {/* Capsule cards — one per selected source */}
          <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {leadSources.length === 0 && (
              <div style={{ padding: '12px', fontSize: '13px', color: 'var(--muted-foreground)', textAlign: 'center', border: '1px dashed var(--border)', borderRadius: '8px' }}>
                No lead sources selected
              </div>
            )}
            {leadSources.map(ls => {
              const meta = LEAD_SOURCE_META[ls.key];
              const srcLabel = LEAD_SOURCES.find(s => s.key === ls.key)?.label || ls.key;
              return (
                <div key={ls.key} style={{
                  backgroundColor: '#FAFBFC', border: '1px solid var(--border)',
                  borderRadius: '8px', padding: '10px 12px',
                  display: 'flex', flexDirection: 'column', gap: '8px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center',
                      height: '24px', padding: '0 10px', borderRadius: '6px',
                      backgroundColor: '#E7F3FF', color: 'var(--primary)',
                      fontSize: '12px', fontWeight: 500, whiteSpace: 'nowrap',
                    }}>
                      {srcLabel}
                    </span>
                    {!readOnly && (
                      <button
                        onClick={() => removeLeadSource(ls.key)}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          width: '22px', height: '22px', borderRadius: '4px',
                          border: 'none', backgroundColor: 'transparent',
                          color: 'var(--muted-foreground)', cursor: 'pointer', transition: 'all 120ms',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(220, 38, 38, 0.2)'; e.currentTarget.style.color = 'var(--destructive)'; }}
                        onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--muted-foreground)'; }}
                      >
                        <X style={{ width: '12px', height: '12px' }} />
                      </button>
                    )}
                  </div>
                  <div>
                    <label style={{
                      fontSize: '11px', fontWeight: 500, color: 'var(--muted-foreground)',
                      display: 'block', marginBottom: '4px',
                      textTransform: 'none',
                    }}>
                      {meta.detailLabel}
                    </label>
                    {readOnly ? (
                      <div style={{
                        padding: '7px 12px', borderRadius: '6px',
                        backgroundColor: '#FFFFFF', border: '1px solid var(--border)',
                        fontSize: '13px', color: ls.detail ? 'var(--foreground)' : 'var(--muted-foreground)',
                        lineHeight: '1.5', minHeight: '32px', display: 'flex', alignItems: 'center',
                      }}>
                        {ls.detail || 'No details provided'}
                      </div>
                    ) : (
                      <input
                        type="text"
                        value={ls.detail}
                        onChange={e => updateLeadSourceDetail(ls.key, e.target.value)}
                        onBlur={() => { onNonMaterialChange?.('lead_source_detail', `${srcLabel} Detail`, undefined, ls.detail); }}
                        placeholder={meta.placeholder}
                        style={{
                          width: '100%', height: '32px', padding: '0 12px',
                          fontSize: '13px', color: 'var(--foreground)',
                          border: '1px solid var(--border)', borderRadius: '6px',
                          outline: 'none', backgroundColor: '#FFFFFF',
                          fontFamily: 'Inter, system-ui, sans-serif',
                          boxSizing: 'border-box' as const,
                          transition: 'border-color 150ms, box-shadow 150ms',
                        }}
                        onFocus={e => { e.currentTarget.style.borderColor = 'rgba(10, 119, 255, 0.4)'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(59,130,246,0.12)'; }}
                        onBlurCapture={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </FieldCard>

        {/* ── Expected Close Date ── */}
        <FieldCard title="Expected Close Date" icon={CalendarClock}>
          <div style={descStyle}>
            When you expect this deal to convert to a Sales Order. Used for pipeline forecasting and capacity planning.
          </div>
          <div style={editableRowStyle}>
            {readOnly ? (
              <DealDateDisplay value={expectedCloseDate} width={200} />
            ) : (
              <DealDateInput
                width={200}
                value={expectedCloseDate}
                onChange={setExpectedCloseDate}
                ariaLabel="Expected Close Date"
                onCommit={() => {
                  const formatted = expectedCloseDate ? (() => { const d = new Date(expectedCloseDate + 'T00:00:00'); return `${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}/${d.getFullYear()}`; })() : '';
                  onNonMaterialChange?.('expected_close_date', 'Expected Close Date', undefined, formatted);
                }}
              />
            )}
          </div>
        </FieldCard>

        {/* ── Competitive Situation ── */}
        <FieldCard title="Competitive Situation" icon={Swords}>
          <div style={descStyle}>
            Classify the competitive landscape for this deal. Impacts sales strategy and helps forecast win rates by deal type.
          </div>
          <div style={editableRowStyle}>
            {readOnly ? (
              <div style={{
                display: 'inline-flex', alignItems: 'center', height: '36px', padding: '0 12px', borderRadius: '8px',
                backgroundColor: 'var(--muted)', border: '1px solid var(--border)',
                fontSize: '13px', fontWeight: 500, color: 'var(--foreground)',
              }}>
                {COMPETITIVE_OPTIONS.find(o => o.key === competitiveSituation)?.label || 'None'}
              </div>
            ) : (
              <div style={{ position: 'relative', width: '220px' }}>
                <select
                  value={competitiveSituation}
                  onChange={e => {
                    const prev = COMPETITIVE_OPTIONS.find(o => o.key === competitiveSituation)?.label || '';
                    setCompetitiveSituation(e.target.value);
                    const newLabel = COMPETITIVE_OPTIONS.find(o => o.key === e.target.value)?.label || '';
                    onNonMaterialChange?.('competitive_situation', 'Competitive Situation', prev, newLabel);
                  }}
                  style={{
                    width: '220px', height: '36px', padding: '0 36px 0 12px',
                    fontSize: '13px', fontWeight: 500, color: 'var(--foreground)',
                    border: '1px solid var(--border)', borderRadius: '8px',
                    outline: 'none', backgroundColor: '#FFFFFF',
                    fontFamily: 'Inter, system-ui, sans-serif',
                    boxSizing: 'border-box' as const,
                    appearance: 'none', WebkitAppearance: 'none',
                    cursor: 'pointer',
                    transition: 'border-color 150ms, box-shadow 150ms',
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = '#0A77FF'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(10, 119, 255, 0.12)'; }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}
                >
                  {COMPETITIVE_OPTIONS.map(opt => (
                    <option key={opt.key} value={opt.key}>{opt.label}</option>
                  ))}
                </select>
                <ChevronDown style={{
                  position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                  width: '14px', height: '14px', color: 'var(--muted-foreground)', pointerEvents: 'none',
                }} />
              </div>
            )}
          </div>
        </FieldCard>

        {/* ── Follow-up Date / Next Action ── */}
        <FieldCard title="Follow-up Date / Next Action" icon={CalendarCheck}>
          <div style={descStyle}>
            Schedule the next follow-up and describe what needs to happen. Shows on your dashboard reminders and team calendar.
          </div>
          {/* Capsule card grouping all three fields */}
          <div style={{
            marginTop: '12px', backgroundColor: '#FAFBFC', border: '1px solid var(--border)',
            borderRadius: '8px', padding: '12px',
            display: 'flex', flexDirection: 'column', gap: '10px',
          }}>
            {/* Follow-up Date + Time + Assigned To — same row.
                Date stretches; Time is a 124-px segmented HH:MM next to it. */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{
                  fontSize: '11px', fontWeight: 500, color: 'var(--muted-foreground)',
                  display: 'block', marginBottom: '4px',
                  textTransform: 'none',
                }}>
                  Follow-up Date &amp; Time
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {readOnly ? (
                      <DealDateDisplay value={followUpDate} />
                    ) : (
                      <DealDateInput
                        value={followUpDate}
                        onChange={setFollowUpDate}
                        ariaLabel="Follow-up Date"
                        onCommit={() => {
                          const formatted = followUpDate ? (() => { const d = new Date(followUpDate + 'T00:00:00'); return `${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}/${d.getFullYear()}`; })() : '';
                          onNonMaterialChange?.('follow_up_date', 'Follow-up Date', undefined, formatted);
                        }}
                      />
                    )}
                  </div>
                  {readOnly ? (
                    <DealTimeDisplay value={followUpTime} />
                  ) : (
                    <DealTimeInput
                      value={followUpTime}
                      onChange={setFollowUpTime}
                      ariaLabel="Follow-up Time"
                      onCommit={() => {
                        onNonMaterialChange?.('follow_up_time', 'Follow-up Time', undefined, followUpTime);
                      }}
                    />
                  )}
                </div>
              </div>
              <div ref={assignedToRef} style={{ position: 'relative' }}>
                <label style={{
                  fontSize: '11px', fontWeight: 500, color: 'var(--muted-foreground)',
                  display: 'block', marginBottom: '4px',
                  textTransform: 'none',
                }}>
                  Assigned To
                </label>
                {readOnly ? (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '8px', height: '36px', padding: '0 12px', borderRadius: '8px',
                    backgroundColor: 'var(--muted)', border: '1px solid var(--border)',
                    fontSize: '13px', fontWeight: 500, color: assignedTo ? 'var(--foreground)' : 'var(--muted-foreground)',
                  }}>
                    <User style={{ width: '13px', height: '13px', color: 'var(--muted-foreground)', flexShrink: 0 }} />
                    {assignedTo || 'Not assigned'}
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => setShowAssignedToDropdown(!showAssignedToDropdown)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        width: '100%', height: '36px', padding: '0 12px',
                        fontSize: '13px', color: assignedTo ? 'var(--foreground)' : 'var(--muted-foreground)',
                        border: '1px solid var(--border)', borderRadius: '8px',
                        outline: 'none', backgroundColor: '#FFFFFF',
                        fontFamily: 'Inter, system-ui, sans-serif',
                        boxSizing: 'border-box' as const,
                        cursor: 'pointer',
                        transition: 'border-color 150ms, box-shadow 150ms',
                        textAlign: 'left',
                      }}
                      onFocus={e => { e.currentTarget.style.borderColor = '#0A77FF'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(10, 119, 255, 0.12)'; }}
                      onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}
                    >
                      <User style={{ width: '13px', height: '13px', color: 'var(--muted-foreground)', flexShrink: 0 }} />
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: assignedTo ? 500 : 400 }}>
                        {assignedTo || 'Select team member...'}
                      </span>
                      <ChevronDown style={{ width: '13px', height: '13px', color: 'var(--muted-foreground)', flexShrink: 0, transition: 'transform 150ms', transform: showAssignedToDropdown ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                    </button>
                    {showAssignedToDropdown && (
                      <div style={{
                        position: 'absolute', bottom: '100%', left: 0, right: 0, marginBottom: '4px',
                        backgroundColor: '#FFFFFF', border: '1px solid var(--border)',
                        borderRadius: '8px', boxShadow: '0 -8px 24px rgba(0,0,0,0.12)',
                        zIndex: 20, overflow: 'hidden', maxHeight: '240px', overflowY: 'auto',
                      }}>
                        {TEAM_MEMBERS.map(member => {
                          const isSelected = assignedTo === member.name;
                          return (
                            <button
                              key={member.id}
                              onClick={() => {
                                const prev = assignedTo;
                                setAssignedTo(member.name);
                                setShowAssignedToDropdown(false);
                                onNonMaterialChange?.('assigned_to', 'Assigned To', prev, member.name);
                              }}
                              style={{
                                display: 'flex', alignItems: 'center', gap: '10px',
                                width: '100%', textAlign: 'left',
                                padding: '8px 12px', fontSize: '13px', color: 'var(--foreground)',
                                border: 'none', backgroundColor: isSelected ? '#F3F7FF' : 'transparent',
                                cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif',
                                transition: 'background-color 100ms',
                              }}
                              onMouseEnter={e => { if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--muted)'; }}
                              onMouseLeave={e => { if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent'; }}
                            >
                              <div style={{
                                width: '26px', height: '26px', borderRadius: '13px',
                                backgroundColor: isSelected ? 'var(--primary)' : 'var(--border)',
                                color: isSelected ? 'var(--background)' : 'var(--muted-foreground)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '10px', fontWeight: 600, flexShrink: 0,
                                letterSpacing: '0.3px',
                              }}>
                                {member.initials}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: '13px', fontWeight: isSelected ? 600 : 400, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {member.name}
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--muted-foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '1px' }}>
                                  {member.roles.join(' · ')}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
            {/* Next Action — full width */}
            <div>
              <label style={{
                fontSize: '11px', fontWeight: 500, color: 'var(--muted-foreground)',
                display: 'block', marginBottom: '4px',
                textTransform: 'none',
              }}>
                Next Action
              </label>
              {readOnly ? (
                <div style={{
                  padding: '7px 12px', borderRadius: '6px',
                  backgroundColor: '#FFFFFF', border: '1px solid var(--border)',
                  fontSize: '13px', color: nextAction ? 'var(--foreground)' : 'var(--muted-foreground)',
                  lineHeight: '1.5', minHeight: '32px', display: 'flex', alignItems: 'center',
                }}>
                  {nextAction || 'No action defined'}
                </div>
              ) : (
                <input
                  type="text"
                  value={nextAction}
                  onChange={e => setNextAction(e.target.value)}
                  onBlur={() => { onNonMaterialChange?.('next_action', 'Next Action', undefined, nextAction); }}
                  placeholder="e.g. Call Sarah March 1 to discuss procurement timeline"
                  style={{
                    width: '100%', height: '32px', padding: '0 12px',
                    fontSize: '13px', color: 'var(--foreground)',
                    border: '1px solid var(--border)', borderRadius: '6px',
                    outline: 'none', backgroundColor: '#FFFFFF',
                    fontFamily: 'Inter, system-ui, sans-serif',
                    boxSizing: 'border-box' as const,
                    transition: 'border-color 150ms, box-shadow 150ms',
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = 'rgba(10, 119, 255, 0.4)'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(59,130,246,0.12)'; }}
                  onBlurCapture={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}
                />
              )}
            </div>
          </div>
        </FieldCard>
      </div>
    </div>
  );
}