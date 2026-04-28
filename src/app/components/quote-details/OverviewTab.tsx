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

interface OverviewTabProps {
  quoteNumber?: string;
  customerName?: string;
  contactName?: string;
  readOnly?: boolean;
  tags?: string[];
  priority?: 'Urgent' | 'Medium' | 'Low';
  winProbability?: number;
  salesRep?: { id: string; name: string; email: string };
  /** Called when a non-material deal information field changes */
  onNonMaterialChange?: (fieldKey: string, fieldLabel: string, oldValue?: string, newValue?: string) => void;
}

// ─── Shared card wrapper ─────────────────────────────────────────────────────
function FieldCard({ children, style }: { children: React.ReactNode; style?: CSSProperties }) {
  return (
    <div style={{
      backgroundColor: '#FFFFFF',
      borderRadius: '10px',
      borderWidth: '1px', borderStyle: 'solid', borderColor: '#E5E7EB',
      padding: '20px 24px',
      ...style,
    }}>
      {children}
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
}: OverviewTabProps) {
  const [winProbability, setWinProbability] = useState(initialWinProb ?? 65);

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

  const [tags, setTags] = useState<string[]>(initialTags && initialTags.length > 0 ? initialTags : ['Engine Components', 'Hydraulics']);
  const [isEditingTags, setIsEditingTags] = useState(false);
  const [newTag, setNewTag] = useState('');

  // External Notes state (included in PDF)
  const [externalNotes, setExternalNotes] = useState('Customer prefers email communication. Budget approved for Q1 2026. Follow up with procurement team by end of month regarding fleet discount eligibility.');

  // Internal Notes state (NOT included in PDF — team only)
  const [internalNotes, setInternalNotes] = useState('Spoke with CFO on Mar 3 — they have budget but need board sign-off. Competitor (FleetPro) quoted 8% lower but without conversion package. Push delivery timeline to lock commitment before Q2 review.');

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

  const [leadSources, setLeadSources] = useState<Array<{ key: string; detail: string }>>([
    { key: 'inbound_rfq', detail: 'RFQ-2026-0042 via procurement portal' },
  ]);
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

  // Expected Close Date
  const [expectedCloseDate, setExpectedCloseDate] = useState('2026-04-15');

  // Competitive Situation
  const COMPETITIVE_OPTIONS = [
    { key: 'none', label: 'None' },
    { key: 'competitive', label: 'Competitive' },
    { key: 'sole_source', label: 'Sole Source' },
    { key: 'incumbent', label: 'Incumbent' },
  ] as const;
  const [competitiveSituation, setCompetitiveSituation] = useState<string>('sole_source');

  // Follow-up Date / Next Action
  const [followUpDate, setFollowUpDate] = useState('2026-03-01');
  const [assignedTo, setAssignedTo] = useState('Sarah Chen');
  const [nextAction, setNextAction] = useState('Call Sarah to discuss procurement timeline and confirm fleet specs');

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
    if (winProbability >= 70) return '#059669';
    if (winProbability >= 40) return '#D97706';
    return '#DC2626';
  };

  // Shared styles
  const iconBox: CSSProperties = {
    width: '28px', height: '28px', borderRadius: '7px', backgroundColor: '#F3F4F6',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  };
  const titleStyle: CSSProperties = {
    fontSize: '13px', fontWeight: 600, color: '#1F2937', lineHeight: '1.2',
  };
  const descStyle: CSSProperties = {
    fontSize: '12px', color: '#9CA3AF', lineHeight: '1.5', marginTop: '6px',
  };
  const hintStyle: CSSProperties = {
    display: 'flex', alignItems: 'flex-start', gap: '5px',
    fontSize: '11px', color: '#9CA3AF', lineHeight: '1.4', marginTop: '6px',
  };

  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}>

        {/* ── Win Probability ── */}
        <FieldCard>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={iconBox}><Target style={{ width: '14px', height: '14px', color: '#9CA3AF' }} /></div>
            <span style={titleStyle}>Win Probability</span>
          </div>
          <div style={descStyle}>
            Estimate the likelihood this quote converts into a confirmed sales order. This percentage feeds directly into your pipeline revenue forecasts and weighted booking reports.
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: '12px', gap: '16px' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={hintStyle}>
                <BarChart3 style={{ width: '12px', height: '12px', flexShrink: 0, marginTop: '1px' }} />
                <span>
                  {winProbability >= 70
                    ? 'Strong confidence — included in committed forecast at full weighted value.'
                    : winProbability >= 40
                      ? 'Moderate confidence — in the pipeline forecast but not yet committed.'
                      : 'At risk — consider a follow-up or pricing adjustment to improve close rate.'}
                </span>
              </div>
            </div>
            <div style={{ flexShrink: 0, width: '260px' }}>
              <div style={{
                display: 'flex', alignItems: 'center',
                height: '32px', borderRadius: '6px',
                borderWidth: '1px', borderStyle: 'solid', borderColor: '#E5E7EB',
                backgroundColor: '#FFFFFF', overflow: 'hidden',
                transition: 'border-color 150ms, box-shadow 150ms',
              }}
                onFocus={(e) => {
                  if (!readOnly) {
                    e.currentTarget.style.borderColor = '#3B82F6';
                    e.currentTarget.style.boxShadow = '0 0 0 2px rgba(59,130,246,0.12)';
                  }
                }}
                onBlur={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    e.currentTarget.style.borderColor = '#E5E7EB';
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
                  style={{
                    width: '44px', height: '100%', textAlign: 'center',
                    border: 'none', fontSize: '13px', fontWeight: 600,
                    color: getWinProbColor(),
                    outline: 'none', fontFamily: 'Inter, system-ui, sans-serif', padding: '0 2px 0 8px',
                    backgroundColor: 'transparent',
                    cursor: readOnly ? 'default' : 'text',
                    MozAppearance: 'textfield' as any,
                  }}
                />
                <span style={{
                  fontSize: '12px', fontWeight: 500, color: '#9CA3AF',
                  paddingRight: '10px', flexShrink: 0,
                  borderRightWidth: '1px', borderRightStyle: 'solid', borderRightColor: '#E5E7EB',
                  height: '100%', display: 'flex', alignItems: 'center', paddingLeft: '0',
                }}>%</span>
                <div style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'center', padding: '0 10px', gap: '8px' }}>
                  <div
                    style={{
                      flex: 1, height: '6px', borderRadius: '3px',
                      backgroundColor: '#F3F4F6', overflow: 'hidden',
                      cursor: readOnly ? 'default' : 'pointer',
                      position: 'relative',
                    }}
                    onClick={readOnly ? undefined : (e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const pct = Math.round(((e.clientX - rect.left) / rect.width) * 100);
                      setWinProbability(Math.min(100, Math.max(0, pct)));
                    }}
                  >
                    <div style={{
                      width: `${winProbability}%`, height: '100%', borderRadius: '3px',
                      backgroundColor: getWinProbColor(),
                      transition: 'width 300ms ease, background-color 300ms ease',
                      pointerEvents: 'none',
                    }} />
                  </div>
                  <span style={{
                    fontSize: '11px', fontWeight: 600, color: getWinProbColor(),
                    whiteSpace: 'nowrap', flexShrink: 0,
                  }}>
                    {winProbability >= 70 ? 'Strong' : winProbability >= 40 ? 'Moderate' : 'At Risk'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </FieldCard>

        {/* ── RFQ ID & Document Upload ── */}
        <FieldCard>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={iconBox}><FileText style={{ width: '14px', height: '14px', color: '#9CA3AF' }} /></div>
            <span style={titleStyle}>RFQ/RFP ID & Documents</span>
          </div>
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
                  borderWidth: '1px', borderStyle: 'solid', borderColor: '#E5E7EB',
                  backgroundColor: '#F9FAFB',
                  fontSize: '13px', fontWeight: rfqId ? 600 : 400,
                  color: rfqId ? '#1F2937' : '#9CA3AF',
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
                      fontSize: '10px', fontWeight: 500, color: '#6B7280',
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
                      borderWidth: '1px', borderStyle: 'solid', borderColor: '#E5E7EB',
                      borderRadius: '6px', fontSize: '13px', fontWeight: 500, color: '#1F2937',
                      outline: 'none', fontFamily: 'Inter, system-ui, sans-serif',
                      padding: '0 10px', backgroundColor: '#FFFFFF',
                      boxSizing: 'border-box' as const,
                      transition: 'border-color 150ms, box-shadow 150ms',
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = '#3B82F6';
                      e.currentTarget.style.boxShadow = '0 0 0 2px rgba(59,130,246,0.12)';
                    }}
                    onBlurCapture={(e) => {
                      e.currentTarget.style.borderColor = '#E5E7EB';
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
                      borderWidth: '1px', borderStyle: 'solid', borderColor: '#E5E7EB',
                      backgroundColor: '#FFFFFF', color: '#6B7280',
                      fontSize: '12px', fontWeight: 500, cursor: 'pointer',
                      lineHeight: '1', transition: 'all 120ms',
                      fontFamily: 'Inter, system-ui, sans-serif',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#D1D5DB'; e.currentTarget.style.backgroundColor = '#F9FAFB'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
                  >
                    <Upload style={{ width: '13px', height: '13px' }} />
                    Upload RFQ/RFP
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Uploaded RFQ files list */}
          {rfqFiles.length > 0 && (
            <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '11px', fontWeight: 500, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Attached Documents ({rfqFiles.length})
              </span>
              {rfqFiles.map((file) => (
                <div
                  key={file.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '8px 12px', borderRadius: '6px',
                    backgroundColor: '#F9FAFB',
                    border: '1px solid #E5E7EB',
                    transition: 'background-color 150ms',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F3F4F6'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#F9FAFB'; }}
                >
                  <div style={{
                    width: '28px', height: '28px', borderRadius: '6px',
                    backgroundColor: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <Paperclip style={{ width: '13px', height: '13px', color: '#DC2626' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: '13px', fontWeight: 500, color: '#1F2937',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {file.name}
                    </div>
                    <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '1px' }}>
                      {file.size} · Uploaded {file.uploadedAt}
                    </div>
                  </div>
                  <span style={{
                    fontSize: '10px', fontWeight: 500, color: '#0891B2', backgroundColor: '#ECFEFF',
                    padding: '2px 6px', borderRadius: '3px', lineHeight: '1', flexShrink: 0,
                    border: '1px solid #A5F3FC',
                  }}>
                    Pre-Quote
                  </span>
                  {!readOnly && (
                    <button
                      onClick={() => handleRemoveRfqFile(file.id)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: '24px', height: '24px', borderRadius: '4px',
                        border: 'none', backgroundColor: 'transparent',
                        color: '#9CA3AF', cursor: 'pointer', transition: 'all 120ms',
                        flexShrink: 0,
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#FEE2E2'; e.currentTarget.style.color = '#DC2626'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#9CA3AF'; }}
                    >
                      <Trash2 style={{ width: '13px', height: '13px' }} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </FieldCard>

        {/* ── Tags ── */}
        <FieldCard>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={iconBox}><Tag style={{ width: '14px', height: '14px', color: '#9CA3AF' }} /></div>
            <span style={titleStyle}>Tags</span>
          </div>
          <div style={descStyle}>
            Categorize this quote with labels for filtering and reporting. Tags are shared across your organization and help group related quotes by product line, department, or campaign.
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: '12px', gap: '16px' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={hintStyle}>
                <Layers style={{ width: '12px', height: '12px', flexShrink: 0, marginTop: '1px' }} />
                <span>Used in list views, saved filters, and automated reports. Up to 5 tags per quote.</span>
              </div>
            </div>
            <div style={{ flexShrink: 0, position: 'relative', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: '320px' }}>
              {tags.length > 0 ? (
                tags.map((tag, idx) => (
                  <span key={idx} style={{
                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                    height: '26px', padding: '0 10px', borderRadius: '5px',
                    backgroundColor: '#F3F4F6', color: '#374151',
                    fontSize: '12px', fontWeight: 500, whiteSpace: 'nowrap',
                  }}>
                    {tag}
                    {!readOnly && isEditingTags && (
                      <button onClick={(e) => { e.stopPropagation(); setTags(tags.filter((_, i) => i !== idx)); }}
                        style={{ border: 'none', backgroundColor: 'transparent', cursor: 'pointer', padding: 0, display: 'flex', color: '#9CA3AF', marginLeft: '2px' }}>
                        <X style={{ width: '12px', height: '12px' }} />
                      </button>
                    )}
                  </span>
                ))
              ) : (
                <span style={{ fontSize: '13px', color: '#9CA3AF', fontWeight: 400 }}>No tags</span>
              )}
              {!readOnly && !isEditingTags && (
                <button onClick={() => setIsEditingTags(true)} style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: '26px', height: '26px', borderRadius: '5px',
                  borderWidth: '1px', borderStyle: 'dashed', borderColor: '#D1D5DB',
                  backgroundColor: 'transparent', cursor: 'pointer', transition: 'all 120ms', color: '#9CA3AF',
                }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#93C5FD'; e.currentTarget.style.color = '#3B82F6'; e.currentTarget.style.backgroundColor = '#F0F7FF'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#D1D5DB'; e.currentTarget.style.color = '#9CA3AF'; e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <Pencil style={{ width: '11px', height: '11px' }} />
                </button>
              )}

              {/* Tag editor popover */}
              {isEditingTags && !readOnly && (
                <>
                  <div style={{ position: 'fixed', inset: 0, zIndex: 10 }} onClick={() => setIsEditingTags(false)} />
                  <div onClick={(e) => e.stopPropagation()} style={{
                    position: 'absolute', top: '100%', right: 0, marginTop: '6px',
                    backgroundColor: '#FFFFFF', borderWidth: '1px', borderStyle: 'solid', borderColor: '#E5E7EB',
                    borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 20,
                    padding: '10px', width: '320px',
                  }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap',
                      padding: '6px 8px', borderWidth: '1px', borderStyle: 'solid', borderColor: '#E5E7EB',
                      borderRadius: '6px', minHeight: '36px',
                    }}>
                      {tags.map((tag, idx) => (
                        <div key={idx} style={{
                          display: 'flex', alignItems: 'center', gap: '4px',
                          padding: '2px 8px', borderRadius: '4px',
                          backgroundColor: '#F3F4F6', color: '#374151', fontSize: '11px', fontWeight: 500,
                        }}>
                          {tag}
                          <button onClick={() => setTags(tags.filter((_, i) => i !== idx))}
                            style={{ border: 'none', backgroundColor: 'transparent', cursor: 'pointer', padding: 0, display: 'flex', color: '#9CA3AF' }}>
                            <X style={{ width: '12px', height: '12px' }} />
                          </button>
                        </div>
                      ))}
                      <input type="text" placeholder={tags.length === 0 ? 'Add tags...' : ''}
                        value={newTag} onChange={(e) => setNewTag(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && newTag.trim() && tags.length < 5) { setTags([...tags, newTag.trim()]); setNewTag(''); }
                          else if (e.key === 'Backspace' && newTag === '' && tags.length > 0) { setTags(tags.slice(0, -1)); }
                        }}
                        autoFocus
                        style={{
                          flex: 1, minWidth: '80px', fontSize: '12px', color: '#1F2937',
                          border: 'none', outline: 'none', backgroundColor: 'transparent',
                          fontFamily: 'Inter, system-ui, sans-serif',
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px', padding: '0 4px' }}>
                      <span style={{ fontSize: '11px', color: '#9CA3AF' }}>Enter to add · {tags.length}/5</span>
                      <button onClick={() => { setIsEditingTags(false); onNonMaterialChange?.('tags', 'Tags', undefined, tags.join(', ')); }} style={{
                        fontSize: '11px', fontWeight: 500, color: '#3B82F6',
                        border: 'none', backgroundColor: 'transparent', cursor: 'pointer',
                        fontFamily: 'Inter, system-ui, sans-serif',
                      }}>Done</button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </FieldCard>

        {/* ── External Notes ── */}
        <FieldCard>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <div style={{ ...iconBox, backgroundColor: '#F3F4F6' }}>
              <StickyNote style={{ width: '14px', height: '14px', color: '#6B7280' }} />
            </div>
            <span style={titleStyle}>External Notes</span>
          </div>
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
                    backgroundColor: '#FFFFFF', borderWidth: '1px', borderStyle: 'solid', borderColor: '#E5E7EB',
                    fontSize: '13px', color: '#1F2937', lineHeight: '1.6',
                  }}
                >
                  {externalNotes}
                </div>
              ) : (
                <div style={{
                  padding: '10px 12px', borderRadius: '6px',
                  backgroundColor: '#F9FAFB', borderWidth: '1px', borderStyle: 'solid', borderColor: '#E5E7EB',
                  fontSize: '13px', color: '#9CA3AF', lineHeight: '1.6',
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
                  width: '100%', padding: '10px 12px', fontSize: '13px', color: '#1F2937',
                  borderWidth: '1px', borderStyle: 'solid', borderColor: '#E5E7EB',
                  borderRadius: '6px', outline: 'none', backgroundColor: '#FFFFFF',
                  fontFamily: 'Inter, system-ui, sans-serif', lineHeight: '1.6',
                  resize: 'vertical', minHeight: '72px',
                  boxSizing: 'border-box' as const,
                  transition: 'border-color 150ms, box-shadow 150ms',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#93C5FD';
                  e.currentTarget.style.boxShadow = '0 0 0 2px rgba(59,130,246,0.12)';
                }}
                onBlurCapture={(e) => {
                  e.currentTarget.style.borderColor = '#E5E7EB';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
            )}
          </div>
        </FieldCard>

        {/* ── Internal Notes ── */}
        <FieldCard>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <div style={{ ...iconBox, backgroundColor: '#F3F4F6' }}>
              <Lock style={{ width: '14px', height: '14px', color: '#6B7280' }} />
            </div>
            <span style={titleStyle}>Internal Notes</span>
            <span style={{
              fontSize: '10px', fontWeight: 600, letterSpacing: '0.5px',
              color: '#6B7280', backgroundColor: '#F3F4F6',
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
                    backgroundColor: '#FFFFFF', borderWidth: '1px', borderStyle: 'solid', borderColor: '#E5E7EB',
                    fontSize: '13px', color: '#1F2937', lineHeight: '1.6',
                  }}
                >
                  {internalNotes}
                </div>
              ) : (
                <div style={{
                  padding: '10px 12px', borderRadius: '6px',
                  backgroundColor: '#F9FAFB', borderWidth: '1px', borderStyle: 'solid', borderColor: '#E5E7EB',
                  fontSize: '13px', color: '#9CA3AF', lineHeight: '1.6',
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
                  width: '100%', padding: '10px 12px', fontSize: '13px', color: '#1F2937',
                  borderWidth: '1px', borderStyle: 'solid', borderColor: '#E5E7EB',
                  borderRadius: '6px', outline: 'none', backgroundColor: '#FFFFFF',
                  fontFamily: 'Inter, system-ui, sans-serif', lineHeight: '1.6',
                  resize: 'vertical', minHeight: '72px',
                  boxSizing: 'border-box' as const,
                  transition: 'border-color 150ms, box-shadow 150ms',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#93C5FD';
                  e.currentTarget.style.boxShadow = '0 0 0 2px rgba(59,130,246,0.12)';
                }}
                onBlurCapture={(e) => {
                  e.currentTarget.style.borderColor = '#E5E7EB';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
            )}
          </div>
        </FieldCard>

        {/* ── Lead Source ── */}
        <FieldCard>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '16px' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={iconBox}><Megaphone style={{ width: '14px', height: '14px', color: '#9CA3AF' }} /></div>
                <span style={titleStyle}>Lead Source</span>
              </div>
              <div style={descStyle}>
                How this opportunity originated. Helps measure channel effectiveness and attribute pipeline revenue to the right acquisition channel.
              </div>
            </div>
            {/* Add source dropdown — right-aligned */}
            {!readOnly && (
              <div ref={leadSourceDropdownRef} style={{ position: 'relative', width: '240px', flexShrink: 0 }}>
                <button
                  onClick={() => setShowLeadSourceDropdown(!showLeadSourceDropdown)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    width: '240px', height: '32px', padding: '0 12px',
                    fontSize: '13px', color: '#6B7280',
                    border: '1px solid #E5E7EB', borderRadius: '6px',
                    outline: 'none', backgroundColor: '#FFFFFF',
                    fontFamily: 'Inter, system-ui, sans-serif',
                    boxSizing: 'border-box' as const,
                    cursor: 'pointer',
                    transition: 'border-color 150ms',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#D1D5DB'; }}
                  onMouseLeave={e => { if (!showLeadSourceDropdown) e.currentTarget.style.borderColor = '#E5E7EB'; }}
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
                    backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB',
                    borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                    zIndex: 20, overflow: 'hidden',
                  }}>
                    {LEAD_SOURCES.filter(s => !leadSources.some(ls => ls.key === s.key)).length === 0 ? (
                      <div style={{ padding: '10px 12px', fontSize: '12px', color: '#9CA3AF', textAlign: 'center' }}>
                        All sources added
                      </div>
                    ) : (
                      LEAD_SOURCES.filter(s => !leadSources.some(ls => ls.key === s.key)).map(src => (
                        <button
                          key={src.key}
                          onClick={() => addLeadSource(src.key)}
                          style={{
                            display: 'block', width: '100%', textAlign: 'left',
                            padding: '8px 12px', fontSize: '13px', fontWeight: 400, color: '#1F2937',
                            border: 'none', backgroundColor: 'transparent', cursor: 'pointer',
                            fontFamily: 'Inter, system-ui, sans-serif',
                            transition: 'background-color 100ms',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#F3F4F6'; }}
                          onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                        >
                          {src.label}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          {/* Capsule cards — one per selected source */}
          <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {leadSources.length === 0 && (
              <div style={{ padding: '12px', fontSize: '13px', color: '#9CA3AF', textAlign: 'center', border: '1px dashed #D1D5DB', borderRadius: '8px' }}>
                No lead sources selected
              </div>
            )}
            {leadSources.map(ls => {
              const meta = LEAD_SOURCE_META[ls.key];
              const srcLabel = LEAD_SOURCES.find(s => s.key === ls.key)?.label || ls.key;
              return (
                <div key={ls.key} style={{
                  backgroundColor: '#FAFBFC', border: '1px solid #E5E7EB',
                  borderRadius: '8px', padding: '10px 12px',
                  display: 'flex', flexDirection: 'column', gap: '8px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center',
                      height: '24px', padding: '0 10px', borderRadius: '5px',
                      backgroundColor: '#E7F3FF', color: '#1B6EF3',
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
                          color: '#9CA3AF', cursor: 'pointer', transition: 'all 120ms',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#FEE2E2'; e.currentTarget.style.color = '#DC2626'; }}
                        onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#9CA3AF'; }}
                      >
                        <X style={{ width: '12px', height: '12px' }} />
                      </button>
                    )}
                  </div>
                  <div>
                    <label style={{
                      fontSize: '11px', fontWeight: 500, color: '#6B7280',
                      display: 'block', marginBottom: '4px',
                      textTransform: 'uppercase', letterSpacing: '0.3px',
                    }}>
                      {meta.detailLabel}
                    </label>
                    {readOnly ? (
                      <div style={{
                        padding: '7px 12px', borderRadius: '6px',
                        backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB',
                        fontSize: '13px', color: ls.detail ? '#1F2937' : '#9CA3AF',
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
                          fontSize: '13px', color: '#1F2937',
                          border: '1px solid #E5E7EB', borderRadius: '6px',
                          outline: 'none', backgroundColor: '#FFFFFF',
                          fontFamily: 'Inter, system-ui, sans-serif',
                          boxSizing: 'border-box' as const,
                          transition: 'border-color 150ms, box-shadow 150ms',
                        }}
                        onFocus={e => { e.currentTarget.style.borderColor = '#93C5FD'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(59,130,246,0.12)'; }}
                        onBlurCapture={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.boxShadow = 'none'; }}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </FieldCard>

        {/* ── Expected Close Date ── */}
        <FieldCard>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '16px' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={iconBox}><CalendarClock style={{ width: '14px', height: '14px', color: '#9CA3AF' }} /></div>
                <span style={titleStyle}>Expected Close Date</span>
              </div>
              <div style={descStyle}>
                When you expect this deal to convert to a Sales Order. Used for pipeline forecasting and capacity planning.
              </div>
            </div>
            <div style={{ flexShrink: 0 }}>
              {readOnly ? (
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: '8px', height: '32px', padding: '0 12px', borderRadius: '6px',
                  backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB',
                  fontSize: '13px', fontWeight: 500, color: expectedCloseDate ? '#1F2937' : '#9CA3AF',
                }}>
                  {expectedCloseDate ? (() => { const d = new Date(expectedCloseDate + 'T00:00:00'); return `${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}/${d.getFullYear()}`; })() : 'Not set'}
                  <Calendar style={{ width: '13px', height: '13px', color: '#9CA3AF', flexShrink: 0 }} />
                </div>
              ) : (
                <input
                  type="date"
                  value={expectedCloseDate}
                  onChange={e => setExpectedCloseDate(e.target.value)}
                  onBlur={() => {
                    const formatted = expectedCloseDate ? (() => { const d = new Date(expectedCloseDate + 'T00:00:00'); return `${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}/${d.getFullYear()}`; })() : '';
                    onNonMaterialChange?.('expected_close_date', 'Expected Close Date', undefined, formatted);
                  }}
                  style={{
                    width: '180px', height: '32px', padding: '0 12px',
                    fontSize: '13px', color: '#1F2937',
                    border: '1px solid #E5E7EB', borderRadius: '6px',
                    outline: 'none', backgroundColor: '#FFFFFF',
                    fontFamily: 'Inter, system-ui, sans-serif',
                    boxSizing: 'border-box' as const,
                    transition: 'border-color 150ms, box-shadow 150ms',
                    cursor: 'pointer',
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = '#93C5FD'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(59,130,246,0.12)'; }}
                  onBlurCapture={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.boxShadow = 'none'; }}
                />
              )}
            </div>
          </div>
        </FieldCard>

        {/* ── Competitive Situation ── */}
        <FieldCard>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '16px' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={iconBox}><Swords style={{ width: '14px', height: '14px', color: '#9CA3AF' }} /></div>
                <span style={titleStyle}>Competitive Situation</span>
              </div>
              <div style={descStyle}>
                Classify the competitive landscape for this deal. Impacts sales strategy and helps forecast win rates by deal type.
              </div>
            </div>
            <div style={{ flexShrink: 0 }}>
              {readOnly ? (
                <div style={{
                  display: 'inline-flex', alignItems: 'center', height: '32px', padding: '0 12px', borderRadius: '6px',
                  backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB',
                  fontSize: '13px', fontWeight: 500, color: '#1F2937',
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
                    width: '220px', height: '32px', padding: '0 12px',
                    fontSize: '13px', fontWeight: 500, color: '#1F2937',
                    border: '1px solid #E5E7EB', borderRadius: '6px',
                    outline: 'none', backgroundColor: '#FFFFFF',
                    fontFamily: 'Inter, system-ui, sans-serif',
                    boxSizing: 'border-box' as const,
                    appearance: 'none', WebkitAppearance: 'none',
                    cursor: 'pointer',
                    transition: 'border-color 150ms, box-shadow 150ms',
                    paddingRight: '36px',
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = '#93C5FD'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(59,130,246,0.12)'; }}
                  onBlur={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.boxShadow = 'none'; }}
                >
                  {COMPETITIVE_OPTIONS.map(opt => (
                    <option key={opt.key} value={opt.key}>{opt.label}</option>
                  ))}
                </select>
                <ChevronDown style={{
                  position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                  width: '14px', height: '14px', color: '#9CA3AF', pointerEvents: 'none',
                }} />
              </div>
            )}
            </div>
          </div>
        </FieldCard>

        {/* ── Follow-up Date / Next Action ── */}
        <FieldCard>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={iconBox}><CalendarCheck style={{ width: '14px', height: '14px', color: '#9CA3AF' }} /></div>
            <span style={titleStyle}>Follow-up Date / Next Action</span>
          </div>
          <div style={descStyle}>
            Schedule the next follow-up and describe what needs to happen. Shows on your dashboard reminders and team calendar.
          </div>
          {/* Capsule card grouping all three fields */}
          <div style={{
            marginTop: '12px', backgroundColor: '#FAFBFC', border: '1px solid #E5E7EB',
            borderRadius: '8px', padding: '12px',
            display: 'flex', flexDirection: 'column', gap: '10px',
          }}>
            {/* Follow-up Date + Assigned To — same row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{
                  fontSize: '11px', fontWeight: 500, color: '#6B7280',
                  display: 'block', marginBottom: '4px',
                  textTransform: 'uppercase', letterSpacing: '0.3px',
                }}>
                  Follow-up Date
                </label>
                {readOnly ? (
                  <div style={{
                    display: 'flex', alignItems: 'center', height: '32px', padding: '0 12px', borderRadius: '6px',
                    backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB',
                    fontSize: '13px', fontWeight: 500, color: followUpDate ? '#1F2937' : '#9CA3AF',
                  }}>
                    {followUpDate ? (() => { const d = new Date(followUpDate + 'T00:00:00'); return `${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}/${d.getFullYear()}`; })() : 'Not set'}
                    <Calendar style={{ width: '13px', height: '13px', color: '#9CA3AF', flexShrink: 0, marginLeft: 'auto' }} />
                  </div>
                ) : (
                  <input
                    type="date"
                    value={followUpDate}
                    onChange={e => setFollowUpDate(e.target.value)}
                    onBlur={() => {
                      const formatted = followUpDate ? (() => { const d = new Date(followUpDate + 'T00:00:00'); return `${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}/${d.getFullYear()}`; })() : '';
                      onNonMaterialChange?.('follow_up_date', 'Follow-up Date', undefined, formatted);
                    }}
                    style={{
                      width: '100%', height: '32px', padding: '0 12px',
                      fontSize: '13px', color: '#1F2937',
                      border: '1px solid #E5E7EB', borderRadius: '6px',
                      outline: 'none', backgroundColor: '#FFFFFF',
                      fontFamily: 'Inter, system-ui, sans-serif',
                      boxSizing: 'border-box' as const,
                      transition: 'border-color 150ms, box-shadow 150ms',
                      cursor: 'pointer',
                    }}
                    onFocus={e => { e.currentTarget.style.borderColor = '#93C5FD'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(59,130,246,0.12)'; }}
                    onBlurCapture={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.boxShadow = 'none'; }}
                  />
                )}
              </div>
              <div ref={assignedToRef} style={{ position: 'relative' }}>
                <label style={{
                  fontSize: '11px', fontWeight: 500, color: '#6B7280',
                  display: 'block', marginBottom: '4px',
                  textTransform: 'uppercase', letterSpacing: '0.3px',
                }}>
                  Assigned To
                </label>
                {readOnly ? (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '8px', height: '32px', padding: '0 12px', borderRadius: '6px',
                    backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB',
                    fontSize: '13px', fontWeight: 500, color: assignedTo ? '#1F2937' : '#9CA3AF',
                  }}>
                    <User style={{ width: '13px', height: '13px', color: '#9CA3AF', flexShrink: 0 }} />
                    {assignedTo || 'Not assigned'}
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => setShowAssignedToDropdown(!showAssignedToDropdown)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        width: '100%', height: '32px', padding: '0 12px',
                        fontSize: '13px', color: assignedTo ? '#1F2937' : '#9CA3AF',
                        border: '1px solid #E5E7EB', borderRadius: '6px',
                        outline: 'none', backgroundColor: '#FFFFFF',
                        fontFamily: 'Inter, system-ui, sans-serif',
                        boxSizing: 'border-box' as const,
                        cursor: 'pointer',
                        transition: 'border-color 150ms',
                        textAlign: 'left',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = '#D1D5DB'; }}
                      onMouseLeave={e => { if (!showAssignedToDropdown) e.currentTarget.style.borderColor = '#E5E7EB'; }}
                    >
                      <User style={{ width: '13px', height: '13px', color: '#9CA3AF', flexShrink: 0 }} />
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: assignedTo ? 500 : 400 }}>
                        {assignedTo || 'Select team member...'}
                      </span>
                      <ChevronDown style={{ width: '13px', height: '13px', color: '#9CA3AF', flexShrink: 0, transition: 'transform 150ms', transform: showAssignedToDropdown ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                    </button>
                    {showAssignedToDropdown && (
                      <div style={{
                        position: 'absolute', bottom: '100%', left: 0, right: 0, marginBottom: '4px',
                        backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB',
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
                                padding: '8px 12px', fontSize: '13px', color: '#1F2937',
                                border: 'none', backgroundColor: isSelected ? '#F3F7FF' : 'transparent',
                                cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif',
                                transition: 'background-color 100ms',
                              }}
                              onMouseEnter={e => { if (!isSelected) e.currentTarget.style.backgroundColor = '#F9FAFB'; }}
                              onMouseLeave={e => { if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent'; }}
                            >
                              <div style={{
                                width: '26px', height: '26px', borderRadius: '13px',
                                backgroundColor: isSelected ? '#1B6EF3' : '#E5E7EB',
                                color: isSelected ? '#FFFFFF' : '#6B7280',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '10px', fontWeight: 600, flexShrink: 0,
                                letterSpacing: '0.3px',
                              }}>
                                {member.initials}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: '13px', fontWeight: isSelected ? 600 : 400, color: '#1F2937', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {member.name}
                                </div>
                                <div style={{ fontSize: '11px', color: '#9CA3AF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '1px' }}>
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
                fontSize: '11px', fontWeight: 500, color: '#6B7280',
                display: 'block', marginBottom: '4px',
                textTransform: 'uppercase', letterSpacing: '0.3px',
              }}>
                Next Action
              </label>
              {readOnly ? (
                <div style={{
                  padding: '7px 12px', borderRadius: '6px',
                  backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB',
                  fontSize: '13px', color: nextAction ? '#1F2937' : '#9CA3AF',
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
                    fontSize: '13px', color: '#1F2937',
                    border: '1px solid #E5E7EB', borderRadius: '6px',
                    outline: 'none', backgroundColor: '#FFFFFF',
                    fontFamily: 'Inter, system-ui, sans-serif',
                    boxSizing: 'border-box' as const,
                    transition: 'border-color 150ms, box-shadow 150ms',
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = '#93C5FD'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(59,130,246,0.12)'; }}
                  onBlurCapture={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.boxShadow = 'none'; }}
                />
              )}
            </div>
          </div>
        </FieldCard>
      </div>
    </div>
  );
}