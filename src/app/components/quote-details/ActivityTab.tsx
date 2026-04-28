import { useState, useRef, useEffect } from 'react';
import { Search, Filter, X, Clock, User, Mail, DollarSign, GitBranch, Package, Tag, ArrowRight, Calendar, Paperclip, Shield } from 'lucide-react';

interface AuditEntry {
  id: string;
  type: 'version' | 'status' | 'line-item' | 'pricing' | 'config' | 'email' | 'document' | 'access';
  action: string;
  field?: string;
  oldValue?: string;
  newValue?: string;
  user: string;
  userAvatar: string;
  userColor: string;
  timestamp: string;
  date: string;
  versionRef?: number;
  reason?: string;
  isRevert?: boolean;
  revertedFrom?: number;
}

const MOCK_AUDIT: AuditEntry[] = [
  { id: 'A01', type: 'status', action: 'Status changed', field: 'Quote Status', oldValue: 'Draft', newValue: 'Sent', user: 'Sarah Chen', userAvatar: 'SC', userColor: '#3B82F6', timestamp: '10:32 AM', date: '02/05/2026', versionRef: 3 },
  { id: 'A02', type: 'pricing', action: 'Pricing rule applied', field: 'Government Contract Pricing', oldValue: '—', newValue: '3% discount on all items', user: 'Michael Rodriguez', userAvatar: 'MR', userColor: '#8B5CF6', timestamp: '10:28 AM', date: '02/05/2026', versionRef: 3 },
  { id: 'A03', type: 'pricing', action: 'Unit price updated', field: 'Ford E-450 Chassis · Unit Price', oldValue: '$49,500', newValue: '$48,200', user: 'Sarah Chen', userAvatar: 'SC', userColor: '#3B82F6', timestamp: '10:30 AM', date: '02/05/2026', versionRef: 3 },
  { id: 'A04', type: 'config', action: 'Payment terms updated', field: 'Payment Terms', oldValue: 'Net 30', newValue: 'Net 45', user: 'Sarah Chen', userAvatar: 'SC', userColor: '#3B82F6', timestamp: '10:25 AM', date: '02/05/2026', versionRef: 3 },
  { id: 'A05', type: 'version', action: 'Version 3 created', field: 'Quote Version', oldValue: 'v2', newValue: 'v3', user: 'Sarah Chen', userAvatar: 'SC', userColor: '#3B82F6', timestamp: '10:24 AM', date: '02/05/2026', reason: 'Updated pricing per fleet volume negotiation with Tri-County EMS' },
  { id: 'A17', type: 'access', action: 'Quote viewed', field: 'Access', newValue: 'Viewed by Emily Park', user: 'Emily Park', userAvatar: 'EP', userColor: '#EC4899', timestamp: '11:20 AM', date: '02/03/2026' },
  { id: 'A06', type: 'email', action: 'Email sent', field: 'External Communication', newValue: 'RE: Quote Q-2026-0142 — to k.rodriguez@tricountyems.gov', user: 'Sarah Chen', userAvatar: 'SC', userColor: '#3B82F6', timestamp: '4:00 PM', date: '01/28/2026' },
  { id: 'A07', type: 'document', action: 'Document uploaded', field: 'Type III module spec sheet', newValue: 'Type_III_Module_Specifications.pdf (4.7 MB)', user: 'Sarah Chen', userAvatar: 'SC', userColor: '#3B82F6', timestamp: '2:58 PM', date: '01/28/2026', versionRef: 2 },
  { id: 'A08', type: 'line-item', action: 'Line item added', field: 'Stryker Power-PRO XT Stretcher', newValue: 'Qty: 3 · Unit: $18,500 · Total: $55,500', user: 'Sarah Chen', userAvatar: 'SC', userColor: '#3B82F6', timestamp: '3:15 PM', date: '01/28/2026', versionRef: 2 },
  { id: 'A09', type: 'line-item', action: 'Line item modified', field: 'Ford E-450 Chassis · Quantity', oldValue: '1', newValue: '2', user: 'David Kim', userAvatar: 'DK', userColor: '#F59E0B', timestamp: '3:10 PM', date: '01/28/2026', versionRef: 2 },
  { id: 'A10', type: 'config', action: 'Delivery address added', field: 'Delivery Address', oldValue: '—', newValue: '4500 Emergency Services Dr, Springfield, IL 62704', user: 'Sarah Chen', userAvatar: 'SC', userColor: '#3B82F6', timestamp: '3:05 PM', date: '01/28/2026', versionRef: 2 },
  { id: 'A11', type: 'config', action: 'Payment terms set', field: 'Payment Terms', oldValue: '—', newValue: 'Net 30', user: 'Sarah Chen', userAvatar: 'SC', userColor: '#3B82F6', timestamp: '3:02 PM', date: '01/28/2026', versionRef: 2 },
  { id: 'A12', type: 'version', action: 'Version 2 created', field: 'Quote Version', oldValue: 'v1', newValue: 'v2', user: 'Sarah Chen', userAvatar: 'SC', userColor: '#3B82F6', timestamp: '3:00 PM', date: '01/28/2026', reason: 'Added medical equipment and delivery details' },
  { id: 'A13', type: 'line-item', action: 'Line item added', field: 'Ford E-450 Stripped Chassis', newValue: 'Qty: 1 · Unit: $49,200 · Total: $49,200', user: 'Sarah Chen', userAvatar: 'SC', userColor: '#3B82F6', timestamp: '9:45 AM', date: '01/20/2026', versionRef: 1 },
  { id: 'A14', type: 'line-item', action: 'Line item added', field: 'Type III Ambulance Module', newValue: 'Qty: 3 · Unit: $94,200 · Total: $282,600', user: 'Sarah Chen', userAvatar: 'SC', userColor: '#3B82F6', timestamp: '9:45 AM', date: '01/20/2026', versionRef: 1 },
  { id: 'A15', type: 'config', action: 'Customer set', field: 'Customer', oldValue: '—', newValue: 'Tri-County EMS Authority · Karen Rodriguez', user: 'Sarah Chen', userAvatar: 'SC', userColor: '#3B82F6', timestamp: '9:42 AM', date: '01/20/2026', versionRef: 1 },
  { id: 'A16', type: 'version', action: 'Quote created (v1)', field: 'Quote', newValue: 'From opportunity OPP-2026-0089', user: 'Sarah Chen', userAvatar: 'SC', userColor: '#3B82F6', timestamp: '9:40 AM', date: '01/20/2026', reason: 'Initial quote created from opportunity OPP-2026-0089' },
];

type AuditFilter = 'all' | 'version' | 'line-item' | 'pricing' | 'config' | 'status' | 'email' | 'document';
type DateFilter = 'any' | 'today' | 'this-week' | 'this-month';
const CURRENT_USER = 'Sarah Chen';

interface ActivityTabProps {
  quoteNumber?: string;
  customerName?: string;
  contactName?: string;
}

export function ActivityTab({ quoteNumber = 'Q-000-000-000', customerName = 'Tri-County EMS Authority', contactName = 'Karen Rodriguez' }: ActivityTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<AuditFilter>('all');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [dateFilter, setDateFilter] = useState<DateFilter>('any');
  const [userFilter, setUserFilter] = useState<string>('all');
  const filterRef = useRef<HTMLDivElement>(null);

  const advancedFilterCount = (dateFilter !== 'any' ? 1 : 0) + (userFilter !== 'all' ? 1 : 0);
  const users = [...new Set(MOCK_AUDIT.map(a => a.user))];

  const filteredAudit = MOCK_AUDIT.filter(a => {
    const matchesSearch = !searchQuery ||
      a.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.field?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.oldValue?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.newValue?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.user.toLowerCase().includes(searchQuery.toLowerCase());
    let matchesType = true;
    if (activeFilter !== 'all') matchesType = a.type === activeFilter;
    const matchesUser = userFilter === 'all' || a.user === userFilter;
    return matchesSearch && matchesType && matchesUser;
  });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setShowFilterDropdown(false);
    };
    if (showFilterDropdown) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showFilterDropdown]);

  const typeConfig: Record<string, { icon: any; color: string; bg: string }> = {
    'version': { icon: GitBranch, color: '#7C3AED', bg: '#EDE9FE' },
    'status': { icon: ArrowRight, color: '#059669', bg: '#D1FAE5' },
    'line-item': { icon: Package, color: '#2563EB', bg: '#DBEAFE' },
    'pricing': { icon: DollarSign, color: '#D97706', bg: '#FEF3C7' },
    'config': { icon: Tag, color: '#6B7280', bg: '#F3F4F6' },
    'email': { icon: Mail, color: '#0891B2', bg: '#CFFAFE' },
    'document': { icon: Paperclip, color: '#059669', bg: '#D1FAE5' },
    'access': { icon: Shield, color: '#6B7280', bg: '#F3F4F6' },
  };

  const filters: { key: AuditFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'version', label: 'Versions' },
    { key: 'status', label: 'Status' },
    { key: 'line-item', label: 'Line Items' },
    { key: 'pricing', label: 'Pricing' },
    { key: 'config', label: 'Config' },
    { key: 'email', label: 'Emails' },
    { key: 'document', label: 'Documents' },
  ];

  // Group entries by date
  const dateGroups: { date: string; entries: AuditEntry[] }[] = [];
  filteredAudit.forEach(entry => {
    const last = dateGroups[dateGroups.length - 1];
    if (last && last.date === entry.date) {
      last.entries.push(entry);
    } else {
      dateGroups.push({ date: entry.date, entries: [entry] });
    }
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Toolbar */}
      <div style={{
        backgroundColor: '#FFFFFF', borderRadius: '8px 8px 0 0', border: '1px solid #E5E7EB',
        borderBottom: 'none', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '10px',
      }}>
        {/* Row 1: Search + Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ position: 'relative', width: '240px', flexShrink: 0 }}>
            <Search style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', width: '14px', height: '14px', color: '#9CA3AF', pointerEvents: 'none' }} />
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search activity..."
              style={{ width: '100%', height: '32px', padding: `0 ${searchQuery ? '32px' : '12px'} 0 32px`, fontSize: '13px', fontWeight: 400, color: '#1F2937', border: '1px solid #E5E7EB', borderRadius: '6px', outline: 'none', backgroundColor: '#FFFFFF', fontFamily: 'Inter, system-ui, sans-serif', transition: 'border-color 150ms', boxSizing: 'border-box' }}
              onFocus={e => { e.currentTarget.style.borderColor = '#93C5FD'; e.currentTarget.style.boxShadow = '0 0 0 2px #DBEAFE'; }}
              onBlur={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.boxShadow = 'none'; }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', width: '20px', height: '20px', borderRadius: '4px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#F3F4F6'; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}>
                <X style={{ width: '12px', height: '12px', color: '#9CA3AF' }} />
              </button>
            )}
          </div>

          {/* Filters dropdown */}
          <div ref={filterRef} style={{ position: 'relative', flexShrink: 0 }}>
            <button onClick={() => setShowFilterDropdown(p => !p)} style={{
              height: '32px', padding: '0 10px', fontSize: '12px', fontWeight: 500,
              color: advancedFilterCount > 0 ? '#1B6EF3' : '#6B7280',
              backgroundColor: advancedFilterCount > 0 ? '#E7F3FF' : '#FFFFFF',
              border: `1px solid ${advancedFilterCount > 0 ? '#1B6EF3' : '#E5E7EB'}`,
              borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center',
              gap: '5px', fontFamily: 'Inter, system-ui, sans-serif', lineHeight: '1', transition: 'all 150ms', whiteSpace: 'nowrap',
            }}
              onMouseEnter={e => { if (!advancedFilterCount) { e.currentTarget.style.backgroundColor = '#F9FAFB'; e.currentTarget.style.borderColor = '#D1D5DB'; } }}
              onMouseLeave={e => { if (!advancedFilterCount) { e.currentTarget.style.backgroundColor = '#FFFFFF'; e.currentTarget.style.borderColor = '#E5E7EB'; } }}>
              <Filter style={{ width: '13px', height: '13px' }} />
              Filters
              {advancedFilterCount > 0 && (
                <span style={{ fontSize: '10px', fontWeight: 700, color: '#FFFFFF', backgroundColor: '#1B6EF3', width: '16px', height: '16px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: '1' }}>{advancedFilterCount}</span>
              )}
            </button>

            {showFilterDropdown && (
              <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: '4px', zIndex: 20, backgroundColor: '#FFFFFF', borderRadius: '10px', border: '1px solid #E5E7EB', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', width: '260px', fontFamily: 'Inter, system-ui, sans-serif' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid #F3F4F6' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#111827' }}>Filters</span>
                  {advancedFilterCount > 0 && (
                    <button onClick={() => { setDateFilter('any'); setUserFilter('all'); }} style={{ fontSize: '11px', fontWeight: 500, color: '#EF4444', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', padding: '2px 6px', borderRadius: '4px' }}
                      onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#FEF2F2'; }}
                      onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}>Clear all</button>
                  )}
                </div>
                <div style={{ padding: '10px 14px', borderBottom: '1px solid #F3F4F6' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                    <Calendar style={{ width: '12px', height: '12px', color: '#9CA3AF' }} />
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Date Range</span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {([{ key: 'any' as DateFilter, label: 'Any' }, { key: 'today' as DateFilter, label: 'Today' }, { key: 'this-week' as DateFilter, label: 'This Week' }, { key: 'this-month' as DateFilter, label: 'This Month' }]).map(d => {
                      const active = dateFilter === d.key;
                      return <button key={d.key} onClick={() => setDateFilter(d.key)} style={{ height: '26px', padding: '0 10px', fontSize: '11px', fontWeight: 500, color: active ? '#1B6EF3' : '#6B7280', backgroundColor: active ? '#EFF6FF' : '#F9FAFB', border: `1px solid ${active ? '#BFDBFE' : '#E5E7EB'}`, borderRadius: '5px', cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', lineHeight: '1' }}>{d.label}</button>;
                    })}
                  </div>
                </div>
                <div style={{ padding: '10px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                    <User style={{ width: '12px', height: '12px', color: '#9CA3AF' }} />
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Changed By</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <button onClick={() => setUserFilter('all')} style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '6px 8px', fontSize: '12px', fontWeight: userFilter === 'all' ? 600 : 400, color: userFilter === 'all' ? '#1B6EF3' : '#374151', backgroundColor: userFilter === 'all' ? '#EFF6FF' : 'transparent', border: 'none', borderRadius: '5px', cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', textAlign: 'left' }}
                      onMouseEnter={e => { if (userFilter !== 'all') e.currentTarget.style.backgroundColor = '#F9FAFB'; }}
                      onMouseLeave={e => { if (userFilter !== 'all') e.currentTarget.style.backgroundColor = 'transparent'; }}>Everyone</button>
                    {users.map(u => {
                      const active = userFilter === u;
                      return <button key={u} onClick={() => setUserFilter(u)} style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '6px 8px', fontSize: '12px', fontWeight: active ? 600 : 400, color: active ? '#1B6EF3' : '#374151', backgroundColor: active ? '#EFF6FF' : 'transparent', border: 'none', borderRadius: '5px', cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', textAlign: 'left' }}
                        onMouseEnter={e => { if (!active) e.currentTarget.style.backgroundColor = '#F9FAFB'; }}
                        onMouseLeave={e => { if (!active) e.currentTarget.style.backgroundColor = 'transparent'; }}>
                        {u}{u === CURRENT_USER && <span style={{ fontSize: '10px', color: '#9CA3AF', fontWeight: 400 }}>(you)</span>}
                      </button>;
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div style={{ flex: 1 }} />
          <span style={{ fontSize: '12px', color: '#9CA3AF', lineHeight: '1' }}>{filteredAudit.length} entries</span>
        </div>

        {/* Row 2: Quick filter pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          {filters.map(f => {
            const isActive = activeFilter === f.key;
            return (
              <button key={f.key} onClick={() => setActiveFilter(f.key)} style={{
                height: '28px', padding: '0 10px', fontSize: '12px', fontWeight: 500,
                color: isActive ? '#1B6EF3' : '#6B7280',
                backgroundColor: isActive ? '#E7F3FF' : '#FFFFFF',
                border: `1px solid ${isActive ? '#1B6EF3' : '#E2E8F0'}`,
                borderRadius: '14px', cursor: 'pointer', whiteSpace: 'nowrap',
                fontFamily: 'Inter, system-ui, sans-serif', lineHeight: '1', transition: 'all 150ms', flexShrink: 0,
              }}
                onMouseEnter={e => { if (!isActive) { e.currentTarget.style.backgroundColor = '#F9FAFB'; e.currentTarget.style.borderColor = '#D1D5DB'; } }}
                onMouseLeave={e => { if (!isActive) { e.currentTarget.style.backgroundColor = '#FFFFFF'; e.currentTarget.style.borderColor = '#E2E8F0'; } }}
              >{f.label}</button>
            );
          })}
          {advancedFilterCount > 0 && (
            <>
              <div style={{ width: '1px', height: '20px', backgroundColor: '#E5E7EB', flexShrink: 0 }} />
              {dateFilter !== 'any' && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', height: '24px', padding: '0 6px 0 8px', fontSize: '11px', fontWeight: 500, color: '#1B6EF3', backgroundColor: '#EFF6FF', borderRadius: '5px', whiteSpace: 'nowrap', lineHeight: '1' }}>
                  {dateFilter === 'today' ? 'Today' : dateFilter === 'this-week' ? 'This Week' : 'This Month'}
                  <button onClick={() => setDateFilter('any')} style={{ width: '14px', height: '14px', borderRadius: '3px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}><X style={{ width: '10px', height: '10px', color: '#3B82F6' }} /></button>
                </span>
              )}
              {userFilter !== 'all' && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', height: '24px', padding: '0 6px 0 8px', fontSize: '11px', fontWeight: 500, color: '#1B6EF3', backgroundColor: '#EFF6FF', borderRadius: '5px', whiteSpace: 'nowrap', lineHeight: '1' }}>
                  {userFilter === CURRENT_USER ? 'You' : userFilter}
                  <button onClick={() => setUserFilter('all')} style={{ width: '14px', height: '14px', borderRadius: '3px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}><X style={{ width: '10px', height: '10px', color: '#3B82F6' }} /></button>
                </span>
              )}
            </>
          )}
        </div>
      </div>

      {/* Timeline content */}
      <div style={{
        backgroundColor: '#FFFFFF', borderRadius: '0 0 8px 8px', border: '1px solid #E5E7EB', overflow: 'hidden',
      }}>
        {filteredAudit.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <Clock style={{ width: '24px', height: '24px', color: '#D1D5DB', margin: '0 auto 8px' }} />
            <div style={{ fontSize: '13px', color: '#9CA3AF' }}>No matching activity entries</div>
          </div>
        ) : (
          <div style={{ maxHeight: '640px', overflowY: 'auto', scrollbarWidth: 'thin', padding: '16px 20px' }}>
            {dateGroups.map((group, gIdx) => (
              <div key={group.date}>
                {/* Date separator */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: gIdx === 0 ? '0 0 12px' : '16px 0 12px',
                }}>
                  <span style={{
                    fontSize: '11px', fontWeight: 600, color: '#374151',
                    backgroundColor: '#F3F4F6', padding: '3px 10px', borderRadius: '10px', lineHeight: '1',
                    whiteSpace: 'nowrap',
                  }}>{group.date}</span>
                  <div style={{ flex: 1, height: '1px', backgroundColor: '#E5E7EB' }} />
                </div>

                {/* Entries for this date */}
                <div style={{ position: 'relative', paddingLeft: '28px' }}>
                  {/* Timeline line */}
                  <div style={{
                    position: 'absolute', left: '11px', top: '0', bottom: '0',
                    width: '1px', backgroundColor: '#E5E7EB',
                  }} />

                  {group.entries.map((entry, eIdx) => {
                    const tc = typeConfig[entry.type] || typeConfig['config'];
                    const TIcon = tc.icon;
                    const isVersion = entry.type === 'version';

                    return (
                      <div key={entry.id} style={{
                        position: 'relative', paddingBottom: eIdx < group.entries.length - 1 ? '16px' : '4px',
                      }}>
                        {/* Timeline dot */}
                        <div style={{
                          position: 'absolute', left: '-28px', top: '2px',
                          width: isVersion ? '22px' : '22px', height: isVersion ? '22px' : '22px',
                          borderRadius: isVersion ? '6px' : '50%',
                          backgroundColor: tc.bg, display: 'flex', alignItems: 'center',
                          justifyContent: 'center', zIndex: 1,
                          border: '2px solid #FFFFFF',
                          boxShadow: isVersion ? '0 0 0 2px ' + tc.bg : 'none',
                        }}>
                          <TIcon style={{ width: isVersion ? '11px' : '10px', height: isVersion ? '11px' : '10px', color: tc.color }} />
                        </div>

                        {/* Entry card */}
                        <div style={{
                          padding: isVersion ? '10px 14px' : '6px 0',
                          backgroundColor: isVersion ? '#F9FAFB' : 'transparent',
                          borderRadius: isVersion ? '8px' : '0',
                          border: isVersion ? '1px solid #E5E7EB' : 'none',
                        }}>
                          {/* Top line: action + field + version badge */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '12px', fontWeight: 600, color: '#1F2937', lineHeight: '1.3' }}>
                              {entry.action}
                            </span>
                            {entry.field && !isVersion && (
                              <span style={{ fontSize: '12px', color: '#6B7280', lineHeight: '1.3' }}>
                                — {entry.field}
                              </span>
                            )}
                            {entry.isRevert && entry.revertedFrom && (
                              <span style={{
                                fontSize: '9px', fontWeight: 600, color: '#92400E', backgroundColor: '#FEF3C7',
                                padding: '2px 5px', borderRadius: '3px', lineHeight: '1',
                              }}>Revert from v{entry.revertedFrom}</span>
                            )}
                            {entry.versionRef && (
                              <span style={{
                                fontSize: '9px', fontWeight: 600, color: '#7C3AED', backgroundColor: '#EDE9FE',
                                padding: '2px 5px', borderRadius: '3px', lineHeight: '1',
                              }}>v{entry.versionRef}</span>
                            )}
                          </div>

                          {/* Reason for version entries */}
                          {isVersion && entry.reason && (
                            <div style={{
                              fontSize: '11px', color: '#6B7280', lineHeight: '1.4', marginTop: '4px',
                              padding: '5px 8px', backgroundColor: '#FFFFFF', borderRadius: '4px',
                              border: '1px solid #F3F4F6',
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                              <span style={{ fontSize: '10px', fontWeight: 600, color: '#9CA3AF', marginRight: '4px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Reason:</span>
                              {entry.reason}
                            </div>
                          )}

                          {/* Value change row */}
                          {(entry.oldValue || entry.newValue) && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                              {entry.oldValue && entry.oldValue !== '—' && (
                                <span style={{
                                  fontSize: '11px', fontWeight: 500, color: '#9CA3AF',
                                  backgroundColor: '#F9FAFB', padding: '2px 8px', borderRadius: '4px',
                                  lineHeight: '1.2', textDecoration: 'line-through',
                                  border: '1px solid #F3F4F6',
                                }}>{entry.oldValue}</span>
                              )}
                              {entry.oldValue && entry.oldValue !== '—' && entry.newValue && (
                                <ArrowRight style={{ width: '10px', height: '10px', color: '#D1D5DB', flexShrink: 0 }} />
                              )}
                              {entry.newValue && (
                                <span style={{
                                  fontSize: '11px', fontWeight: 500, color: '#1F2937',
                                  backgroundColor: '#F0FDF4', padding: '2px 8px', borderRadius: '4px',
                                  lineHeight: '1.2', border: '1px solid #D1FAE5',
                                  maxWidth: '320px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                }}>{entry.newValue}</span>
                              )}
                            </div>
                          )}

                          {/* Bottom line: user + time */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '5px' }}>
                            <div style={{
                              width: '16px', height: '16px', borderRadius: '50%',
                              backgroundColor: entry.userColor, display: 'flex', alignItems: 'center',
                              justifyContent: 'center', fontSize: '7px', fontWeight: 700, color: '#FFFFFF',
                              lineHeight: '1', flexShrink: 0,
                            }}>{entry.userAvatar}</div>
                            <span style={{ fontSize: '11px', color: '#6B7280', lineHeight: '1' }}>
                              {entry.user === CURRENT_USER ? 'You' : entry.user}
                            </span>
                            <span style={{ fontSize: '10px', color: '#D1D5DB', lineHeight: '1' }}>·</span>
                            <span style={{ fontSize: '11px', color: '#9CA3AF', lineHeight: '1' }}>{entry.timestamp}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}