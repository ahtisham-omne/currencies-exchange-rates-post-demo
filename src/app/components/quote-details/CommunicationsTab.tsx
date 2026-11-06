// @ts-nocheck
import React, { useState, useRef } from 'react';
import {
  MessageSquare, Mail, Send, Paperclip, X, Plus, Calendar, User,
  Reply, Forward, AtSign, ChevronDown, Smile, CornerDownRight, Clock, Check, CheckCheck, Eye, AlertTriangle, Package
} from 'lucide-react';
import { toast } from 'sonner';
import { SearchInput } from '../shared/SearchInput';
import { FiltersButton } from '../shared/FiltersButton';
import { Avatar } from '../shared/Avatar';
import { ComingSoonBanner } from '../shared/ComingSoonBanner';
import { FilterPill } from '../shared/FilterPill';

// ── Types ──────────────────────────────────────────────────────────
interface InternalMessage {
  id: string;
  author: string;
  avatar: string;
  avatarColor: string;
  timestamp: string;
  dateGroup: string;
  content: string;
  mentions?: string[];
  attachments?: { name: string; size: string }[];
  reactions?: { emoji: string; count: number; reacted: boolean }[];
  isEdited?: boolean;
  isUnread?: boolean;
  replyTo?: string;
}

interface EmailThread {
  id: string;
  threadId: string;
  subject: string;
  from: { name: string; email: string; avatar: string; avatarColor: string };
  to: { name: string; email: string }[];
  cc?: { name: string; email: string }[];
  timestamp: string;
  relativeTime: string;
  body: string;
  status: 'sent' | 'delivered' | 'read' | 'replied' | 'bounced';
  attachments?: { name: string; size: string; type: string }[];
  isOutbound: boolean;
  isUnread?: boolean;
}

// ── Mock Data ──────────────────────────────────────────────────────
const MOCK_MESSAGES: InternalMessage[] = [
  {
    id: 'M001', author: 'David Kim', avatar: 'DK', avatarColor: 'var(--warning)',
    timestamp: '9:12 AM', dateGroup: 'Yesterday',
    content: 'Quick heads up — I spoke with Tri-County EMS\'s procurement team and they\'re keen on getting this quote finalized by Thursday. Let\'s make sure we have the pricing locked down.',
    mentions: [],
    reactions: [{ emoji: '👍', count: 3, reacted: false }],
  },
  {
    id: 'M002', author: 'Michael Rodriguez', avatar: 'MR', avatarColor: 'var(--primary)',
    timestamp: '9:45 AM', dateGroup: 'Yesterday',
    content: 'I\'ve reviewed the discount tiers and I think we should go with Option B — the volume discount structure that kicks in at 50 units. It\'ll give them better value and we still maintain healthy margins.',
    mentions: [],
    attachments: [{ name: 'Discount_Tiers_Comparison.xlsx', size: '340 KB' }],
  },
  {
    id: 'M003', author: 'Sarah Chen', avatar: 'SC', avatarColor: 'var(--primary)',
    timestamp: '2:30 PM', dateGroup: 'Today',
    content: 'I\'ve updated the pricing for the Ford E-450 chassis line items per @Michael Rodriguez\'s suggestion. The fleet volume discount now reflects the new tier structure. Can someone review before we send the revised quote?',
    mentions: ['Michael Rodriguez'],
    reactions: [{ emoji: '👍', count: 2, reacted: true }, { emoji: '✅', count: 1, reacted: false }],
  },
  {
    id: 'M004', author: 'Michael Rodriguez', avatar: 'MR', avatarColor: 'var(--primary)',
    timestamp: '3:15 PM', dateGroup: 'Today',
    content: 'Looks good! The discount structure aligns with what we discussed. One note: make sure we include the extended warranty pricing since Tri-County EMS specifically asked for it in their last email.',
    mentions: [],
    reactions: [{ emoji: '👍', count: 1, reacted: false }],
  },
  {
    id: 'M005', author: 'Emily Park', avatar: 'EP', avatarColor: '#EC4899',
    timestamp: '4:05 PM', dateGroup: 'Today',
    content: 'I reviewed the warranty terms. Here\'s the updated spec sheet that includes the 3-year extended coverage option. @Sarah Chen please attach this to the quote before sending.',
    mentions: ['Sarah Chen'],
    attachments: [{ name: 'Extended_Warranty_Spec_v2.pdf', size: '1.2 MB' }],
    isUnread: true,
  },
  {
    id: 'M006', author: 'David Kim', avatar: 'DK', avatarColor: 'var(--warning)',
    timestamp: '4:32 PM', dateGroup: 'Today',
    content: 'Quick note — Tri-County EMS\'s procurement lead mentioned they need the quote by EOD Thursday. Let\'s prioritize getting the final approval from finance. @James Wilson can you expedite?',
    mentions: ['James Wilson'],
    isUnread: true,
  },
  {
    id: 'M007', author: 'Sarah Chen', avatar: 'SC', avatarColor: 'var(--primary)',
    timestamp: '4:48 PM', dateGroup: 'Today',
    content: 'Got it. I\'ll finalize everything by tomorrow morning. Thanks for the heads up David!',
    mentions: [],
    isEdited: true,
  },
];

const MOCK_EMAILS: EmailThread[] = [
  {
    id: 'E003', threadId: 'TH-001',
    subject: 'Quote Q-2026-0142 — Ambulance Fleet Package',
    from: { name: 'Sarah Chen', email: 'sarah.chen@company.com', avatar: 'SC', avatarColor: 'var(--primary)' },
    to: [{ name: 'Karen Rodriguez', email: 'k.rodriguez@tricountyems.gov' }],
    cc: [{ name: 'Tom Mitchell', email: 't.mitchell@tricountyems.gov' }],
    timestamp: '01/28/2026',
    relativeTime: '2 weeks ago',
    body: 'Dear Karen,\n\nPlease find attached the revised quote for the ambulance fleet build package we discussed during our call last week. This version includes:\n\n• Updated pricing with volume discounts\n• Shipping and logistics estimates\n• Payment terms (Net 30)\n\nThe quote is valid for 30 days from the date of issue. Please review and let us know if you have any questions.\n\nBest regards,\nSarah Chen\nSenior Sales Representative',
    status: 'read',
    attachments: [{ name: 'Quote_Q-2026-0142_v2.pdf', size: '2.4 MB', type: 'pdf' }],
    isOutbound: true,
  },
  {
    id: 'E001', threadId: 'TH-001',
    subject: 'RE: Quote Q-2026-0142 — Ambulance Fleet Package',
    from: { name: 'Karen Rodriguez', email: 'k.rodriguez@tricountyems.gov', avatar: 'KR', avatarColor: 'var(--success)' },
    to: [{ name: 'Sarah Chen', email: 'sarah.chen@company.com' }],
    cc: [{ name: 'Tom Mitchell', email: 't.mitchell@tricountyems.gov' }],
    timestamp: '02/05/2026',
    relativeTime: '3 hours ago',
    body: 'Hi Sarah,\n\nThank you for the updated quote. We have a few questions regarding the warranty terms on the Stryker stretcher units. Specifically, does the standard warranty cover on-site maintenance, or is that part of the extended coverage?\n\nAlso, could you clarify the build timeline for the Type III ambulance modules? Our fleet replacement schedule requires delivery by June 15th.\n\nBest regards,\nKaren Rodriguez\nEMS Division Chief, Tri-County EMS Authority',
    status: 'delivered',
    isOutbound: false,
    isUnread: true,
  },
  {
    id: 'E002', threadId: 'TH-001',
    subject: 'RE: Quote Q-2026-0142 — Ambulance Fleet Package',
    from: { name: 'Sarah Chen', email: 'sarah.chen@company.com', avatar: 'SC', avatarColor: 'var(--primary)' },
    to: [{ name: 'Karen Rodriguez', email: 'k.rodriguez@tricountyems.gov' }],
    cc: [{ name: 'Tom Mitchell', email: 't.mitchell@tricountyems.gov' }, { name: 'Michael Rodriguez', email: 'michael.r@company.com' }],
    timestamp: '02/05/2026',
    relativeTime: '1 hour ago',
    body: 'Hi Karen,\n\nGreat questions. Let me address both:\n\n1. Warranty: The standard warranty includes on-site maintenance for the first year. The extended warranty (3-year) covers full on-site maintenance including parts replacement. I\'ve attached an updated spec sheet with complete details.\n\n2. Lead Time: The Type III ambulance modules have a 12-16 week build time from order confirmation. Given your March 15th deadline, we would need the SO confirmed by February 1st at the latest.\n\nPlease let me know if you need any clarification.\n\nBest regards,\nSarah Chen\nSenior Sales Representative',
    status: 'delivered',
    attachments: [{ name: 'Warranty_Coverage_Details.pdf', size: '890 KB', type: 'pdf' }],
    isOutbound: true,
  },
];

const TEAM_MEMBERS = [
  { name: 'Sarah Chen', email: 'sarah.chen@company.com' },
  { name: 'Michael Rodriguez', email: 'michael.r@company.com' },
  { name: 'Emily Park', email: 'emily.park@company.com' },
  { name: 'David Kim', email: 'david.kim@company.com' },
  { name: 'James Wilson', email: 'james.w@company.com' },
];

type SubTab = 'internal' | 'external';
type InternalFilter = 'all' | 'mentions' | 'attachments';
type ExternalFilter = 'all' | 'sent' | 'received' | 'with-attachments';
type DateRangeFilter = 'any' | 'today' | 'yesterday' | 'this-week' | 'this-month';

const CURRENT_USER = 'Sarah Chen';

// Export unread count for tab badge in QuoteDetails
export function getUnreadCommsCount(): number {
  const unreadInternal = MOCK_MESSAGES.filter(m => m.isUnread).length;
  const unreadExternal = MOCK_EMAILS.filter(e => e.isUnread).length;
  return unreadInternal + unreadExternal;
}

interface CommunicationsTabProps {
  quoteNumber?: string;
  customerName?: string;
  contactName?: string;
  readOnly?: boolean;
}

export function CommunicationsTab(_props: CommunicationsTabProps) {
  return (
    <ComingSoonBanner
      title="Communications"
      message="Threaded internal notes and customer-facing email history will live here. Stay tuned."
    />
  );
}

function _CommunicationsTabLegacy({ quoteNumber = 'Q-000-000-000', customerName = 'Tri-County EMS Authority', contactName = 'Karen Rodriguez', readOnly = false }: CommunicationsTabProps) {
  const [subTab, setSubTab] = useState<SubTab>('internal');
  const [searchQuery, setSearchQuery] = useState('');

  // Internal
  const [internalFilter, setInternalFilter] = useState<InternalFilter>('all');
  const [newMessage, setNewMessage] = useState('');
  const [messages, setMessages] = useState(MOCK_MESSAGES);
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [replyingTo, setReplyingTo] = useState<InternalMessage | null>(null);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);

  // External
  const [externalFilter, setExternalFilter] = useState<ExternalFilter>('all');
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [collapsedEmails, setCollapsedEmails] = useState<Set<string>>(new Set(['E003']));

  // Advanced filters
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [dateRangeFilter, setDateRangeFilter] = useState<DateRangeFilter>('any');
  const [authorFilter, setAuthorFilter] = useState<string>('all');
  const filterRef = useRef<HTMLDivElement>(null);

  const activeFilterCount = (dateRangeFilter !== 'any' ? 1 : 0) + (authorFilter !== 'all' ? 1 : 0);

  // Close filter dropdown on outside click
  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setShowFilterDropdown(false);
      }
    };
    if (showFilterDropdown) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showFilterDropdown]);

  // Build unique author list for filter
  const internalAuthors = [...new Set(messages.map(m => m.author))];
  const externalAuthors = [...new Set(MOCK_EMAILS.map(e => e.from.name))];
  const authorOptions = subTab === 'internal' ? internalAuthors : externalAuthors;

  // ── Internal filters ──────────────────────────────────────────
  const filteredMessages = messages.filter(m => {
    const matchesSearch = !searchQuery ||
      m.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.author.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesDateRange = dateRangeFilter === 'any' ||
      (dateRangeFilter === 'today' && m.dateGroup === 'Today') ||
      (dateRangeFilter === 'yesterday' && m.dateGroup === 'Yesterday') ||
      (dateRangeFilter === 'this-week') ||
      (dateRangeFilter === 'this-month');

    const matchesAuthor = authorFilter === 'all' || m.author === authorFilter;

    if (internalFilter === 'mentions') return matchesSearch && matchesDateRange && matchesAuthor && m.mentions && m.mentions.length > 0;
    if (internalFilter === 'attachments') return matchesSearch && matchesDateRange && matchesAuthor && m.attachments && m.attachments.length > 0;
    return matchesSearch && matchesDateRange && matchesAuthor;
  });

  // ── External filters ──────────────────────────────────────────
  const filteredEmails = MOCK_EMAILS.filter(e => {
    const matchesSearch = !searchQuery ||
      e.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.from.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.body.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesAuthor = authorFilter === 'all' || e.from.name === authorFilter;

    if (externalFilter === 'sent') return matchesSearch && matchesAuthor && e.isOutbound;
    if (externalFilter === 'received') return matchesSearch && matchesAuthor && !e.isOutbound;
    if (externalFilter === 'with-attachments') return matchesSearch && matchesAuthor && e.attachments && e.attachments.length > 0;
    return matchesSearch && matchesAuthor;
  });

  const handlePostMessage = () => {
    if (!newMessage.trim()) return;
    const mentionMatches = newMessage.match(/@(\w+\s?\w*)/g);
    const mentions = mentionMatches?.map(m => m.slice(1)) || [];

    const msg: InternalMessage = {
      id: `M${Date.now()}`,
      author: 'Sarah Chen',
      avatar: 'SC',
      avatarColor: 'var(--primary)',
      timestamp: 'Just now',
      dateGroup: 'Today',
      content: newMessage.trim(),
      mentions,
      replyTo: replyingTo?.id,
    };
    setMessages(prev => [...prev, msg]);
    setNewMessage('');
    setReplyingTo(null);
    toast.success(replyingTo ? 'Reply posted' : 'Message posted');
  };

  const handleReplyTo = (msg: InternalMessage) => {
    setReplyingTo(msg);
    setNewMessage('');
    messageInputRef.current?.focus();
  };

  const handleMarkAsRead = (msgId: string) => {
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, isUnread: false } : m));
  };

  const unreadInternalCount = messages.filter(m => m.isUnread).length;
  const unreadExternalCount = MOCK_EMAILS.filter(e => e.isUnread).length;

  const handleMentionInsert = (name: string) => {
    setNewMessage(prev => {
      const atIdx = prev.lastIndexOf('@');
      return prev.substring(0, atIdx) + `@${name} `;
    });
    setShowMentionDropdown(false);
    setMentionSearch('');
    messageInputRef.current?.focus();
  };

  const toggleEmailCollapse = (id: string) => {
    setCollapsedEmails(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const internalFilterPills: { key: InternalFilter; label: string }[] = [
    { key: 'all', label: 'All Messages' },
    { key: 'mentions', label: '@Mentions' },
    { key: 'attachments', label: 'Attachments' },
  ];

  const externalFilterPills: { key: ExternalFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'sent', label: 'Sent' },
    { key: 'received', label: 'Received' },
    { key: 'with-attachments', label: 'With Files' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* ── Sub-tab header + search/filters ──────────────────── */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '12px 12px 0 0',
          border: '1px solid var(--border)',
          borderBottom: 'none',
          boxShadow: '0 1px 2px 0 rgba(15, 23, 42, 0.04)',
        }}
      >
        {/* Sub-tab row */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 20px', borderBottom: '1px solid var(--border)' }}>
          {([
            { key: 'internal' as SubTab, label: 'Internal', icon: MessageSquare, count: messages.length, unread: unreadInternalCount },
            { key: 'external' as SubTab, label: 'External', icon: Mail, count: MOCK_EMAILS.length, unread: unreadExternalCount },
          ]).map(tab => {
            const isActive = subTab === tab.key;
            const TIcon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => { setSubTab(tab.key); setSearchQuery(''); setInternalFilter('all'); setExternalFilter('all'); setDateRangeFilter('any'); setAuthorFilter('all'); setShowFilterDropdown(false); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '14px 0', fontSize: '13px', fontWeight: isActive ? 600 : 500,
                  color: isActive ? 'var(--primary)' : 'var(--muted-foreground)',
                  backgroundColor: 'transparent', border: 'none', cursor: 'pointer',
                  position: 'relative', transition: 'color 150ms',
                  fontFamily: 'Inter, system-ui, sans-serif', lineHeight: '1',
                  marginRight: '20px',
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = 'var(--foreground)'; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = 'var(--muted-foreground)'; }}
              >
                <TIcon style={{ width: '14px', height: '14px' }} />
                {tab.label}
                <span style={{
                  fontSize: '11px', fontWeight: 600, padding: '2px 6px', borderRadius: '8px',
                  backgroundColor: tab.unread > 0 ? 'rgba(220, 38, 38, 0.2)' : (isActive ? 'var(--accent)' : 'var(--muted)'),
                  color: tab.unread > 0 ? 'var(--destructive)' : (isActive ? 'var(--primary)' : 'var(--muted-foreground)'), lineHeight: '1',
                }}>
                  {tab.unread > 0 ? tab.unread : tab.count}
                </span>
                {tab.unread > 0 && (
                  <span style={{
                    width: '6px', height: '6px', borderRadius: '50%',
                    backgroundColor: 'var(--destructive)', flexShrink: 0,
                  }} />
                )}
                {isActive && (
                  <div style={{ position: 'absolute', bottom: '-1px', left: '0', right: '0', height: '2px', backgroundColor: 'var(--primary)', borderRadius: '1px 1px 0 0' }} />
                )}
              </button>
            );
          })}
          <div style={{ flex: 1 }} />
          {subTab === 'external' && !readOnly && (
            <button
              onClick={() => setShowComposeModal(true)}
              style={{
                height: '32px', padding: '0 14px', fontSize: '13px', fontWeight: 600,
                color: '#FFFFFF', backgroundColor: 'var(--primary)', border: 'none',
                borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center',
                gap: '5px', fontFamily: 'Inter, system-ui, sans-serif',
                lineHeight: '1', transition: 'background-color 150ms',
              }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#0D5ED7'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'var(--primary)'; }}
            >
              <Plus style={{ width: '14px', height: '14px' }} />
              Compose
            </button>
          )}
        </div>

        {/* Search + filter bar */}
        <div style={{ padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* Row 1: Search + Filters button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder={subTab === 'internal' ? 'Search messages...' : 'Search emails...'}
            widthClassName="w-[260px] shrink-0"
          />

          {/* Filter button with dropdown */}
          <div ref={filterRef} style={{ position: 'relative', flexShrink: 0 }}>
            <FiltersButton
              count={activeFilterCount}
              active={showFilterDropdown}
              onClick={() => setShowFilterDropdown(p => !p)}
            />

            {/* Filter dropdown */}
            {showFilterDropdown && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, marginTop: '4px', zIndex: 20,
                backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid var(--border)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)', width: '260px',
                fontFamily: 'Inter, system-ui, sans-serif',
              }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid var(--muted)' }}>
                  <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--foreground-soft)' }}>Filters</span>
                  {activeFilterCount > 0 && (
                    <button
                      onClick={() => { setDateRangeFilter('any'); setAuthorFilter('all'); }}
                      style={{
                        fontSize: '11px', fontWeight: 500, color: 'var(--destructive)', backgroundColor: 'transparent',
                        border: 'none', cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif',
                        padding: '2px 6px', borderRadius: '4px', transition: 'background-color 100ms',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(220, 38, 38, 0.1)'; }}
                      onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                    >
                      Clear all
                    </button>
                  )}
                </div>

                {/* Date range */}
                <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--muted)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                    <Calendar style={{ width: '12px', height: '12px', color: 'var(--muted-foreground)' }} />
                    <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'none' }}>Date Range</span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {([
                      { key: 'any' as DateRangeFilter, label: 'Any Time' },
                      { key: 'today' as DateRangeFilter, label: 'Today' },
                      { key: 'yesterday' as DateRangeFilter, label: 'Yesterday' },
                      { key: 'this-week' as DateRangeFilter, label: 'This Week' },
                      { key: 'this-month' as DateRangeFilter, label: 'This Month' },
                    ]).map(d => {
                      const active = dateRangeFilter === d.key;
                      return (
                        <button
                          key={d.key}
                          onClick={() => setDateRangeFilter(d.key)}
                          style={{
                            height: '26px', padding: '0 10px', fontSize: '11px', fontWeight: 500,
                            color: active ? 'var(--primary)' : 'var(--muted-foreground)',
                            backgroundColor: active ? 'var(--accent)' : 'var(--muted)',
                            border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                            borderRadius: '6px', cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif',
                            lineHeight: '1', transition: 'all 100ms',
                          }}
                        >
                          {d.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Author / Person */}
                <div style={{ padding: '10px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                    <User style={{ width: '12px', height: '12px', color: 'var(--muted-foreground)' }} />
                    <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'none' }}>
                      {subTab === 'internal' ? 'Author' : 'Person'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <button
                      onClick={() => setAuthorFilter('all')}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
                        padding: '6px 8px', fontSize: '12px', fontWeight: authorFilter === 'all' ? 600 : 400,
                        color: authorFilter === 'all' ? 'var(--primary)' : 'var(--foreground)',
                        backgroundColor: authorFilter === 'all' ? 'var(--accent)' : 'transparent',
                        border: 'none', borderRadius: '6px', cursor: 'pointer',
                        fontFamily: 'Inter, system-ui, sans-serif', textAlign: 'left',
                        transition: 'background-color 100ms',
                      }}
                      onMouseEnter={e => { if (authorFilter !== 'all') e.currentTarget.style.backgroundColor = 'var(--muted)'; }}
                      onMouseLeave={e => { if (authorFilter !== 'all') e.currentTarget.style.backgroundColor = 'transparent'; }}
                    >
                      Everyone
                    </button>
                    {authorOptions.map(a => {
                      const active = authorFilter === a;
                      const isYou = a === CURRENT_USER;
                      return (
                        <button
                          key={a}
                          onClick={() => setAuthorFilter(a)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
                            padding: '6px 8px', fontSize: '12px', fontWeight: active ? 600 : 400,
                            color: active ? 'var(--primary)' : 'var(--foreground)',
                            backgroundColor: active ? 'var(--accent)' : 'transparent',
                            border: 'none', borderRadius: '6px', cursor: 'pointer',
                            fontFamily: 'Inter, system-ui, sans-serif', textAlign: 'left',
                            transition: 'background-color 100ms',
                          }}
                          onMouseEnter={e => { if (!active) e.currentTarget.style.backgroundColor = 'var(--muted)'; }}
                          onMouseLeave={e => { if (!active) e.currentTarget.style.backgroundColor = 'transparent'; }}
                        >
                          {a}{isYou && <span style={{ fontSize: '10px', color: 'var(--muted-foreground)', fontWeight: 400 }}>(you)</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          </div>

          {/* Row 2: Quick filter pills + active filter tags */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          {(subTab === 'internal' ? internalFilterPills : externalFilterPills).map(f => {
            const isActive = subTab === 'internal'
              ? internalFilter === f.key
              : externalFilter === f.key;
            return (
              <FilterPill
                key={f.key}
                label={f.label}
                active={isActive}
                onClick={() => subTab === 'internal' ? setInternalFilter(f.key as InternalFilter) : setExternalFilter(f.key as ExternalFilter)}
              />
            );
          })}

          {/* Active filter tags */}
          {activeFilterCount > 0 && (
            <>
              <div style={{ width: '1px', height: '20px', backgroundColor: 'var(--border)', flexShrink: 0 }} />
              {dateRangeFilter !== 'any' && (
                <span style={{
                  display: 'flex', alignItems: 'center', gap: '4px', height: '24px', padding: '0 6px 0 8px',
                  fontSize: '11px', fontWeight: 500, color: 'var(--primary)', backgroundColor: 'var(--accent)',
                  borderRadius: '6px', whiteSpace: 'nowrap', lineHeight: '1',
                }}>
                  {dateRangeFilter === 'today' ? 'Today' : dateRangeFilter === 'yesterday' ? 'Yesterday' : dateRangeFilter === 'this-week' ? 'This Week' : 'This Month'}
                  <button
                    onClick={() => setDateRangeFilter('any')}
                    style={{ width: '14px', height: '14px', borderRadius: '3px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                  >
                    <X style={{ width: '10px', height: '10px', color: 'var(--primary)' }} />
                  </button>
                </span>
              )}
              {authorFilter !== 'all' && (
                <span style={{
                  display: 'flex', alignItems: 'center', gap: '4px', height: '24px', padding: '0 6px 0 8px',
                  fontSize: '11px', fontWeight: 500, color: 'var(--primary)', backgroundColor: 'var(--accent)',
                  borderRadius: '6px', whiteSpace: 'nowrap', lineHeight: '1',
                }}>
                  {authorFilter === CURRENT_USER ? 'You' : authorFilter}
                  <button
                    onClick={() => setAuthorFilter('all')}
                    style={{ width: '14px', height: '14px', borderRadius: '3px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                  >
                    <X style={{ width: '10px', height: '10px', color: 'var(--primary)' }} />
                  </button>
                </span>
              )}
            </>
          )}
          </div>
        </div>
      </div>

      {/* ── Content area ─────────────────────────────────────── */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '0 0 12px 12px',
          border: '1px solid var(--border)',
          overflow: 'hidden',
          boxShadow: '0 1px 3px 0 rgba(15, 23, 42, 0.04)',
        }}
      >
        {subTab === 'internal' ? (
          <InternalCommsContent
            messages={filteredMessages}
            allMessages={messages}
            newMessage={newMessage}
            setNewMessage={setNewMessage}
            onPost={handlePostMessage}
            showMentionDropdown={showMentionDropdown}
            setShowMentionDropdown={setShowMentionDropdown}
            mentionSearch={mentionSearch}
            setMentionSearch={setMentionSearch}
            onMentionInsert={handleMentionInsert}
            messageInputRef={messageInputRef}
            replyingTo={replyingTo}
            onReplyTo={handleReplyTo}
            onCancelReply={() => setReplyingTo(null)}
            onMarkAsRead={handleMarkAsRead}
            readOnly={readOnly}
          />
        ) : (
          <ExternalCommsContent
            emails={filteredEmails}
            collapsedEmails={collapsedEmails}
            toggleEmailCollapse={toggleEmailCollapse}
          />
        )}
      </div>

      {/* Compose modal */}
      {showComposeModal && (
        <ComposeEmailModal onClose={() => setShowComposeModal(false)} />
      )}
    </div>
  );
}

// ── Internal Comms ────────────────────────────────────────────────
function InternalCommsContent({ messages, allMessages, newMessage, setNewMessage, onPost, showMentionDropdown, setShowMentionDropdown, mentionSearch, setMentionSearch, onMentionInsert, messageInputRef, replyingTo, onReplyTo, onCancelReply, onMarkAsRead, readOnly }: {
  messages: InternalMessage[];
  allMessages: InternalMessage[];
  newMessage: string;
  setNewMessage: (v: string) => void;
  onPost: () => void;
  showMentionDropdown: boolean;
  setShowMentionDropdown: (v: boolean) => void;
  mentionSearch: string;
  setMentionSearch: (v: string) => void;
  onMentionInsert: (name: string) => void;
  messageInputRef: React.RefObject<HTMLTextAreaElement | null>;
  replyingTo: InternalMessage | null;
  onReplyTo: (msg: InternalMessage) => void;
  onCancelReply: () => void;
  onMarkAsRead: (msgId: string) => void;
  readOnly: boolean;
}) {
  const filteredMembers = TEAM_MEMBERS.filter(m =>
    !mentionSearch || m.name.toLowerCase().includes(mentionSearch.toLowerCase())
  );

  const handleInputChange = (val: string) => {
    setNewMessage(val);
    const lastAt = val.lastIndexOf('@');
    if (lastAt >= 0 && (lastAt === val.length - 1 || !val.substring(lastAt).includes(' '))) {
      setShowMentionDropdown(true);
      setMentionSearch(val.substring(lastAt + 1));
    } else {
      setShowMentionDropdown(false);
    }
  };

  const highlightMentions = (text: string) => {
    return text.replace(/@(\w+\s?\w*)/g, '<span style="color:var(--primary);font-weight:500;background:var(--accent);padding:1px 4px;border-radius:3px">@$1</span>');
  };

  // Group messages by dateGroup
  const dateGroups: { date: string; messages: InternalMessage[] }[] = [];
  messages.forEach(msg => {
    const last = dateGroups[dateGroups.length - 1];
    if (last && last.date === msg.dateGroup) {
      last.messages.push(msg);
    } else {
      dateGroups.push({ date: msg.dateGroup, messages: [msg] });
    }
  });

  // Group consecutive messages by same author
  const buildAuthorGroups = (msgs: InternalMessage[]): AuthorGroup[] => {
    const groups: AuthorGroup[] = [];
    msgs.forEach(msg => {
      const last = groups[groups.length - 1];
      if (last && last.author === msg.author) {
        last.messages.push(msg);
      } else {
        groups.push({ author: msg.author, avatar: msg.avatar, avatarColor: msg.avatarColor, messages: [msg] });
      }
    });
    return groups;
  };

  const renderAttachment = (att: { name: string; size: string }) => (
    <div
      key={att.name}
      style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '8px 12px', backgroundColor: '#F4F6F8',
        border: '1px solid #E8EBF0', borderRadius: '8px', cursor: 'pointer',
        transition: 'all 150ms',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(10, 119, 255, 0.4)'; (e.currentTarget as HTMLDivElement).style.backgroundColor = 'var(--accent)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#E8EBF0'; (e.currentTarget as HTMLDivElement).style.backgroundColor = '#F4F6F8'; }}
    >
      <div style={{
        width: '28px', height: '28px', borderRadius: '6px',
        backgroundColor: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Paperclip style={{ width: '13px', height: '13px', color: 'var(--primary)' }} />
      </div>
      <div>
        <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--foreground)', lineHeight: '1.2' }}>{att.name}</div>
        <div style={{ fontSize: '10px', color: 'var(--muted-foreground)', lineHeight: '1', marginTop: '2px' }}>{att.size}</div>
      </div>
    </div>
  );

  const renderReactions = (reactions: NonNullable<InternalMessage['reactions']>) => (
    <div style={{ marginTop: '6px', display: 'flex', gap: '4px', alignItems: 'center' }}>
      {reactions.map(r => (
        <button
          key={r.emoji}
          style={{
            display: 'flex', alignItems: 'center', gap: '4px',
            padding: '3px 8px', fontSize: '12px', borderRadius: '12px',
            border: `1px solid ${r.reacted ? 'var(--accent)' : '#E0E3E8'}`,
            backgroundColor: r.reacted ? 'var(--accent)' : '#FFFFFF',
            cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif',
            lineHeight: '1', transition: 'all 100ms',
          }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = r.reacted ? 'var(--accent)' : 'var(--muted)'; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = r.reacted ? 'var(--accent)' : '#FFFFFF'; }}
        >
          <span style={{ fontSize: '13px' }}>{r.emoji}</span>
          <span style={{ fontSize: '11px', color: r.reacted ? 'var(--primary)' : 'var(--muted-foreground)', fontWeight: 600 }}>{r.count}</span>
        </button>
      ))}
      <button
        style={{
          width: '24px', height: '24px', borderRadius: '12px',
          border: '1px dashed var(--border)', backgroundColor: 'transparent',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 100ms',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(10, 119, 255, 0.4)'; e.currentTarget.style.backgroundColor = 'var(--accent)'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.backgroundColor = 'transparent'; }}
        title="Add reaction"
      >
        <Smile style={{ width: '12px', height: '12px', color: 'var(--muted-foreground)' }} />
      </button>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Messages list */}
      <div style={{
        maxHeight: '520px', overflowY: 'auto', scrollbarWidth: 'thin',
        backgroundColor: '#F4F5F7',
      }}>
        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <MessageSquare style={{ width: '24px', height: '24px', color: 'var(--border)', margin: '0 auto 8px' }} />
            <div style={{ fontSize: '13px', color: 'var(--muted-foreground)' }}>No messages match your search</div>
          </div>
        ) : (
          <div style={{ padding: '8px 16px 16px' }}>
            {dateGroups.map((group, groupIdx) => {
              const authorGroups = buildAuthorGroups(group.messages);
              return (
                <div key={group.date}>
                  {/* Date separator pill */}
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: groupIdx === 0 ? '10px 0 14px' : '18px 0 14px',
                  }}>
                    <span style={{
                      fontSize: '11px', fontWeight: 600, color: 'var(--muted-foreground)',
                      backgroundColor: '#FFFFFF', border: '1px solid var(--border)',
                      padding: '4px 12px', borderRadius: '12px', lineHeight: '1',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                    }}>
                      {group.date}
                    </span>
                  </div>

                  {/* Author groups as thread cards */}
                  {authorGroups.map((ag, agIdx) => {
                    const isYou = ag.author === CURRENT_USER;

                    return (
                      <div
                        key={`${ag.author}-${agIdx}`}
                        style={{
                          display: 'flex', gap: '0', marginBottom: '6px',
                          position: 'relative',
                          flexDirection: isYou ? 'row-reverse' : 'row',
                        }}
                      >
                        {/* Avatar column with thread connector */}
                        <div style={{
                          display: 'flex', flexDirection: 'column', alignItems: 'center',
                          width: '40px', flexShrink: 0, paddingTop: '14px',
                        }}>
                          <div style={{
                            width: '32px', height: '32px', borderRadius: '50%',
                            backgroundColor: ag.avatarColor, display: 'flex', alignItems: 'center',
                            justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: '#FFFFFF',
                            lineHeight: '1', flexShrink: 0,
                            boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
                          }}>
                            {ag.avatar}
                          </div>
                          {ag.messages.length > 1 && (
                            <div style={{
                              flex: 1, width: '2px', backgroundColor: ag.avatarColor + '30',
                              marginTop: '4px', borderRadius: '1px', minHeight: '8px',
                            }} />
                          )}
                        </div>

                        {/* Message card */}
                        <MessageCard
                          ag={ag}
                          isYou={isYou}
                          highlightMentions={highlightMentions}
                          renderAttachment={renderAttachment}
                          renderReactions={renderReactions}
                          onReplyTo={onReplyTo}
                          onMarkAsRead={onMarkAsRead}
                          allMessages={allMessages}
                        />
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Compose area */}
      {!readOnly && <div style={{ borderTop: '1px solid var(--border)', backgroundColor: '#FAFBFC', position: 'relative' }}>
        {/* Reply-to context bar */}
        {replyingTo && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '8px 20px',
            backgroundColor: 'var(--accent)', borderBottom: '1px solid var(--accent)',
          }}>
            <Reply style={{ width: '13px', height: '13px', color: 'var(--primary)', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--primary)' }}>
                Replying to {replyingTo.author === CURRENT_USER ? 'yourself' : replyingTo.author}
              </span>
              <span style={{ fontSize: '12px', color: 'var(--muted-foreground)', marginLeft: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {replyingTo.content.substring(0, 80)}{replyingTo.content.length > 80 ? '...' : ''}
              </span>
            </div>
            <button
              onClick={onCancelReply}
              style={{
                width: '20px', height: '20px', borderRadius: '4px', border: 'none',
                backgroundColor: 'transparent', cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                transition: 'background-color 100ms',
              }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--accent)'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              <X style={{ width: '12px', height: '12px', color: 'var(--muted-foreground)' }} />
            </button>
          </div>
        )}

        <div style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
          {/* Current user avatar */}
          <div style={{
            width: '32px', height: '32px', borderRadius: '50%',
            backgroundColor: 'var(--primary)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: '#FFFFFF',
            flexShrink: 0, lineHeight: '1', marginTop: '2px',
          }}>
            SC
          </div>
          <div style={{ flex: 1, position: 'relative' }}>
            <textarea
              ref={messageInputRef}
              value={newMessage}
              onChange={e => handleInputChange(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onPost(); } }}
              placeholder="Write a message... Use @ to mention someone"
              rows={2}
              style={{
                width: '100%', fontSize: '13px', fontWeight: 400, color: 'var(--foreground)',
                border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 14px',
                paddingBottom: '40px',
                outline: 'none', resize: 'none', fontFamily: 'Inter, system-ui, sans-serif',
                lineHeight: '1.5', boxSizing: 'border-box', transition: 'border-color 150ms, box-shadow 150ms',
                backgroundColor: '#FFFFFF',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = 'rgba(10, 119, 255, 0.4)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--accent)40'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}
            />

            {/* Toolbar inside textarea area */}
            <div style={{
              position: 'absolute', bottom: '8px', left: '8px', right: '8px',
              display: 'flex', alignItems: 'center', gap: '2px',
            }}>
              <button
                title="Attach file"
                style={{ width: '28px', height: '28px', borderRadius: '6px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background-color 100ms' }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--muted)'; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <Paperclip style={{ width: '15px', height: '15px', color: 'var(--muted-foreground)' }} />
              </button>
              <button
                title="Mention someone"
                onClick={() => { setNewMessage(prev => prev + '@'); setShowMentionDropdown(true); messageInputRef.current?.focus(); }}
                style={{ width: '28px', height: '28px', borderRadius: '6px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background-color 100ms' }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--muted)'; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <AtSign style={{ width: '15px', height: '15px', color: 'var(--muted-foreground)' }} />
              </button>
              <button
                title="Add emoji"
                style={{ width: '28px', height: '28px', borderRadius: '6px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background-color 100ms' }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--muted)'; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <Smile style={{ width: '15px', height: '15px', color: 'var(--muted-foreground)' }} />
              </button>
              <div style={{ flex: 1 }} />
              <button
                disabled={!newMessage.trim()}
                onClick={onPost}
                style={{
                  height: '32px', padding: '0 14px', fontSize: '12px', fontWeight: 600,
                  color: '#FFFFFF', backgroundColor: newMessage.trim() ? 'var(--primary)' : 'var(--border)',
                  border: 'none', borderRadius: '8px', cursor: newMessage.trim() ? 'pointer' : 'not-allowed',
                  display: 'flex', alignItems: 'center', gap: '5px',
                  fontFamily: 'Inter, system-ui, sans-serif', lineHeight: '1', transition: 'background-color 150ms',
                }}
                onMouseEnter={e => { if (newMessage.trim()) e.currentTarget.style.backgroundColor = '#0D5ED7'; }}
                onMouseLeave={e => { if (newMessage.trim()) e.currentTarget.style.backgroundColor = 'var(--primary)'; }}
              >
                <Send style={{ width: '12px', height: '12px' }} />
                Send
              </button>
            </div>

            {/* Mention dropdown */}
            {showMentionDropdown && filteredMembers.length > 0 && (
              <div
                style={{
                  position: 'absolute', bottom: '100%', left: 0, marginBottom: '4px',
                  backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid var(--border)',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: '6px', minWidth: '240px',
                  zIndex: 10,
                }}
              >
                <div style={{ padding: '6px 10px 8px', fontSize: '10px', fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'none' }}>
                  Team Members
                </div>
                {filteredMembers.map(m => (
                  <button
                    key={m.name}
                    onClick={() => onMentionInsert(m.name)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '8px 10px', fontSize: '13px', fontWeight: 500, color: 'var(--foreground)',
                      backgroundColor: 'transparent', border: 'none', borderRadius: '6px',
                      cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', lineHeight: '1',
                      transition: 'background-color 100ms', textAlign: 'left',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--muted)'; }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    <div style={{
                      width: '24px', height: '24px', borderRadius: '6px',
                      backgroundColor: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <AtSign style={{ width: '12px', height: '12px', color: 'var(--primary)' }} />
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--foreground)' }}>{m.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--muted-foreground)', marginTop: '1px' }}>{m.email}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        </div>
      </div>}
    </div>
  );
}

// ── MessageCard component ──────────────────────────────────────────
type AuthorGroup = { author: string; avatar: string; avatarColor: string; messages: InternalMessage[] };

function MessageCard({ ag, isYou, highlightMentions, renderAttachment, renderReactions, onReplyTo, onMarkAsRead, allMessages }: {
  ag: AuthorGroup;
  isYou: boolean;
  highlightMentions: (text: string) => string;
  renderAttachment: (att: { name: string; size: string }) => React.ReactNode;
  renderReactions: (reactions: NonNullable<InternalMessage['reactions']>) => React.ReactNode;
  onReplyTo: (msg: InternalMessage) => void;
  onMarkAsRead: (msgId: string) => void;
  allMessages: InternalMessage[];
}) {
  const [hoveredMsgId, setHoveredMsgId] = useState<string | null>(null);
  const hasUnread = ag.messages.some(m => m.isUnread);

  return (
    <div style={{
      flex: 1, minWidth: 0, maxWidth: 'calc(100% - 80px)',
      backgroundColor: isYou ? 'var(--accent)' : (hasUnread ? 'rgba(217, 119, 6, 0.1)' : '#FFFFFF'),
      border: `1px solid ${hasUnread ? 'rgba(217, 119, 6, 0.3)' : (isYou ? 'var(--accent)' : 'var(--border)')}`,
      borderLeft: hasUnread ? '3px solid var(--warning)' : undefined,
      borderRadius: '12px',
      padding: '12px 16px',
      marginLeft: isYou ? '0' : '8px',
      marginRight: isYou ? '8px' : '0',
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      transition: 'all 150ms',
      position: 'relative',
    }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)'; }}
    >
      {hasUnread && (
        <div style={{
          position: 'absolute', top: '10px', right: isYou ? undefined : '10px', left: isYou ? '10px' : undefined,
          display: 'flex', alignItems: 'center', gap: '4px',
        }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--destructive)' }} />
          <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--destructive)', lineHeight: '1' }}>New</span>
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: isYou ? 'var(--primary)' : 'var(--foreground)', lineHeight: '1' }}>
          {isYou ? 'You' : ag.author}
        </span>
        <span style={{ fontSize: '11px', color: isYou ? 'rgba(10, 119, 255, 0.4)' : 'var(--muted-foreground)', lineHeight: '1' }}>
          {ag.messages[0].timestamp}
          {ag.messages.length > 1 && ` — ${ag.messages[ag.messages.length - 1].timestamp}`}
        </span>
        {ag.messages.some(m => m.isEdited) && (
          <span style={{ fontSize: '10px', color: isYou ? 'rgba(10, 119, 255, 0.4)' : 'var(--border)', lineHeight: '1' }}>(edited)</span>
        )}
      </div>
      {ag.messages.map((msg, msgIdx) => {
        const parentMsg = msg.replyTo ? allMessages.find(m => m.id === msg.replyTo) : null;
        return (
          <div key={msg.id} style={{ paddingTop: msgIdx > 0 ? '10px' : '0', marginTop: msgIdx > 0 ? '10px' : '0', borderTop: msgIdx > 0 ? `1px solid ${isYou ? 'var(--accent)' : 'var(--muted)'}` : 'none', position: 'relative' }}
            onMouseEnter={() => setHoveredMsgId(msg.id)} onMouseLeave={() => setHoveredMsgId(null)}>
            {parentMsg && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 8px', marginBottom: '6px', backgroundColor: isYou ? 'var(--accent)' : 'var(--muted)', borderRadius: '6px', borderLeft: '2px solid var(--muted-foreground)' }}>
                <Reply style={{ width: '10px', height: '10px', color: 'var(--muted-foreground)', flexShrink: 0 }} />
                <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--muted-foreground)' }}>{parentMsg.author === CURRENT_USER ? 'You' : parentMsg.author}:</span>
                <span style={{ fontSize: '11px', color: 'var(--muted-foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{parentMsg.content.substring(0, 60)}{parentMsg.content.length > 60 ? '...' : ''}</span>
              </div>
            )}
            {msgIdx > 0 && (
              <div style={{ fontSize: '10px', color: isYou ? 'rgba(10, 119, 255, 0.4)' : 'var(--muted-foreground)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Clock style={{ width: '10px', height: '10px' }} />
                {msg.timestamp}
                {msg.isEdited && <span style={{ fontStyle: 'italic' }}>(edited)</span>}
              </div>
            )}
            <div style={{ fontSize: '13px', color: isYou ? '#1E3A5F' : 'var(--foreground)', lineHeight: '1.6', wordBreak: 'break-word' }} dangerouslySetInnerHTML={{ __html: highlightMentions(msg.content) }} />
            {msg.attachments && msg.attachments.length > 0 && (
              <div style={{ marginTop: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>{msg.attachments.map(att => renderAttachment(att))}</div>
            )}
            {msg.reactions && msg.reactions.length > 0 && renderReactions(msg.reactions)}
            {hoveredMsgId === msg.id && !isYou && (
              <div style={{ position: 'absolute', top: msgIdx > 0 ? '10px' : '0', right: '0', display: 'flex', alignItems: 'center', gap: '2px', backgroundColor: '#FFFFFF', border: '1px solid var(--border)', borderRadius: '6px', padding: '2px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                <button onClick={() => onReplyTo(msg)} title="Reply" style={{ width: '26px', height: '26px', borderRadius: '4px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background-color 100ms' }}
                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--accent)'; }} onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}>
                  <Reply style={{ width: '13px', height: '13px', color: 'var(--primary)' }} />
                </button>
                {msg.isUnread && (
                  <button onClick={() => onMarkAsRead(msg.id)} title="Mark as read" style={{ width: '26px', height: '26px', borderRadius: '4px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background-color 100ms' }}
                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(5, 150, 105, 0.1)'; }} onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}>
                    <Check style={{ width: '13px', height: '13px', color: 'var(--success)' }} />
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── External Comms (Thread View) ──────────────────────────────────
function ExternalCommsContent({ emails, collapsedEmails, toggleEmailCollapse }: {
  emails: EmailThread[];
  collapsedEmails: Set<string>;
  toggleEmailCollapse: (id: string) => void;
}) {
  if (emails.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 0' }}>
        <Mail style={{ width: '24px', height: '24px', color: 'var(--border)', margin: '0 auto 8px' }} />
        <div style={{ fontSize: '13px', color: 'var(--muted-foreground)' }}>No emails match your search</div>
      </div>
    );
  }

  // Group by thread
  const threadIds = [...new Set(emails.map(e => e.threadId))];

  const getStatusIcon = (status: EmailThread['status']) => {
    switch (status) {
      case 'sent': return <Check style={{ width: '12px', height: '12px', color: 'var(--muted-foreground)' }} />;
      case 'delivered': return <CheckCheck style={{ width: '12px', height: '12px', color: 'var(--primary)' }} />;
      case 'read': return <Eye style={{ width: '12px', height: '12px', color: 'var(--success)' }} />;
      case 'replied': return <CornerDownRight style={{ width: '12px', height: '12px', color: 'var(--success)' }} />;
      case 'bounced': return <AlertTriangle style={{ width: '12px', height: '12px', color: 'var(--destructive)' }} />;
    }
  };

  const getStatusLabel = (status: EmailThread['status']) => {
    const labels: Record<string, string> = {
      sent: 'Sent', delivered: 'Delivered', read: 'Read', replied: 'Replied', bounced: 'Bounced',
    };
    return labels[status];
  };

  return (
    <div style={{ padding: '0' }}>
      {threadIds.map((tid) => {
        const threadEmails = emails.filter(e => e.threadId === tid);
        const subject = threadEmails[0]?.subject?.replace(/^RE:\s*/i, '').replace(/^FW:\s*/i, '') || '';

        return (
          <div key={tid}>
            {/* Thread subject header */}
            <div style={{
              padding: '16px 24px 12px',
              borderBottom: '1px solid var(--muted)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '32px', height: '32px', borderRadius: '8px',
                  backgroundColor: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Mail style={{ width: '15px', height: '15px', color: 'var(--primary)' }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--foreground)', lineHeight: '1.3' }}>
                    {subject}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--muted-foreground)', lineHeight: '1', marginTop: '4px' }}>
                    {threadEmails.length} messages in thread
                  </div>
                </div>
              </div>
            </div>

            {/* Thread conversation */}
            <div style={{ padding: '8px 16px 16px' }}>
              {threadEmails.map((email, emailIdx) => {
                const isCollapsed = collapsedEmails.has(email.id);
                const isLast = emailIdx === threadEmails.length - 1;

                return (
                  <div key={email.id} style={{ position: 'relative', paddingLeft: '20px' }}>
                    {/* Thread line */}
                    {!isLast && (
                      <div style={{
                        position: 'absolute', left: '15px', top: '40px', bottom: '0',
                        width: '2px', backgroundColor: 'var(--border)',
                      }} />
                    )}

                    {/* Thread dot */}
                    <div style={{
                      position: 'absolute', left: '10px', top: '16px',
                      width: '12px', height: '12px', borderRadius: '50%',
                      backgroundColor: email.isOutbound ? 'var(--primary)' : 'var(--success)',
                      border: '2px solid var(--background)',
                      boxShadow: '0 0 0 2px ' + (email.isOutbound ? 'var(--accent)' : 'rgba(5, 150, 105, 0.2)'),
                      zIndex: 1,
                    }} />

                    {/* Email card */}
                    <div
                      style={{
                        marginLeft: '16px',
                        marginBottom: isLast ? '0' : '4px',
                        border: `1px solid ${email.isOutbound ? 'var(--accent)' : 'var(--border)'}`,
                        borderRadius: '8px',
                        overflow: 'hidden',
                        transition: 'box-shadow 150ms',
                        backgroundColor: email.isOutbound ? 'var(--accent)' : '#FFFFFF',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)'; }}
                      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; }}
                    >
                      {/* Email header — always visible */}
                      <div
                        onClick={() => toggleEmailCollapse(email.id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '12px',
                          padding: '12px 16px',
                          cursor: 'pointer',
                          backgroundColor: isCollapsed
                            ? (email.isOutbound ? 'var(--accent)' : '#FFFFFF')
                            : (email.isOutbound ? 'var(--accent)' : '#FAFBFC'),
                          transition: 'background-color 150ms',
                        }}
                      >
                        {/* Avatar */}
                        <div style={{
                          width: '32px', height: '32px', borderRadius: '8px',
                          backgroundColor: email.from.avatarColor,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '11px', fontWeight: 700, color: '#FFFFFF',
                          flexShrink: 0, lineHeight: '1',
                        }}>
                          {email.from.avatar}
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--foreground-soft)', lineHeight: '1' }}>
                              {email.isOutbound ? 'You' : email.from.name}
                            </span>
                            {email.isOutbound ? (
                              <span style={{
                                fontSize: '10px', fontWeight: 600, color: 'var(--primary)', backgroundColor: 'var(--accent)',
                                padding: '2px 6px', borderRadius: '4px', lineHeight: '1',
                              }}>
                                Sent
                              </span>
                            ) : (
                              <span style={{
                                fontSize: '10px', fontWeight: 600, color: 'var(--success)', backgroundColor: 'rgba(5, 150, 105, 0.1)',
                                padding: '2px 6px', borderRadius: '4px', lineHeight: '1',
                              }}>
                                Received
                              </span>
                            )}
                          </div>
                          {isCollapsed && (
                            <div style={{
                              fontSize: '12px', color: 'var(--muted-foreground)', lineHeight: '1.3', marginTop: '4px',
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                              {email.body.substring(0, 120)}...
                            </div>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                          {email.attachments && email.attachments.length > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <Paperclip style={{ width: '12px', height: '12px', color: 'var(--muted-foreground)' }} />
                              <span style={{ fontSize: '11px', color: 'var(--muted-foreground)' }}>{email.attachments.length}</span>
                            </div>
                          )}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }} title={getStatusLabel(email.status)}>
                            {getStatusIcon(email.status)}
                          </div>
                          <span style={{ fontSize: '11px', color: 'var(--muted-foreground)', lineHeight: '1' }}>
                            {email.relativeTime}
                          </span>
                          <ChevronDown style={{
                            width: '14px', height: '14px', color: 'var(--muted-foreground)',
                            transform: isCollapsed ? 'rotate(0deg)' : 'rotate(180deg)',
                            transition: 'transform 150ms',
                          }} />
                        </div>
                      </div>

                      {/* Expanded body */}
                      {!isCollapsed && (
                        <div style={{ padding: '0 16px 16px 60px' }}>
                          {/* Recipients */}
                          <div style={{
                            fontSize: '12px', color: 'var(--muted-foreground)', lineHeight: '1.5',
                            marginBottom: '14px', paddingBottom: '12px',
                            borderBottom: '1px solid var(--muted)',
                          }}>
                            <div>
                              <span style={{ color: 'var(--muted-foreground)' }}>To: </span>
                              <span style={{ color: 'var(--foreground)', fontWeight: 500 }}>
                                {email.to.map(t => t.name).join(', ')}
                              </span>
                              <span style={{ color: 'var(--border)' }}> · </span>
                              <span style={{ color: 'var(--muted-foreground)' }}>{email.to.map(t => t.email).join(', ')}</span>
                            </div>
                            {email.cc && email.cc.length > 0 && (
                              <div style={{ marginTop: '2px' }}>
                                <span style={{ color: 'var(--muted-foreground)' }}>CC: </span>
                                <span style={{ color: 'var(--foreground)', fontWeight: 500 }}>
                                  {email.cc.map(c => c.name).join(', ')}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Body */}
                          <div style={{
                            fontSize: '13px', color: 'var(--foreground)', lineHeight: '1.7',
                            whiteSpace: 'pre-wrap', marginBottom: '16px',
                          }}>
                            {email.body}
                          </div>

                          {/* Attachments */}
                          {email.attachments && email.attachments.length > 0 && (
                            <div style={{ marginBottom: '16px' }}>
                              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'none', marginBottom: '8px' }}>
                                Attachments
                              </div>
                              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                {email.attachments.map(att => (
                                  <div key={att.name} style={{
                                    display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px',
                                    backgroundColor: '#FAFBFC', border: '1px solid var(--border)', borderRadius: '8px',
                                    cursor: 'pointer', transition: 'all 150ms',
                                  }}
                                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(10, 119, 255, 0.4)'; e.currentTarget.style.backgroundColor = 'var(--accent)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.backgroundColor = '#FAFBFC'; }}
                                  >
                                    <div style={{
                                      width: '32px', height: '32px', borderRadius: '6px',
                                      backgroundColor: att.type === 'pdf' ? 'rgba(220, 38, 38, 0.2)' : 'var(--accent)',
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    }}>
                                      <Paperclip style={{ width: '14px', height: '14px', color: att.type === 'pdf' ? 'var(--destructive)' : 'var(--primary)' }} />
                                    </div>
                                    <div>
                                      <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--foreground)', lineHeight: '1.2' }}>{att.name}</div>
                                      <div style={{ fontSize: '11px', color: 'var(--muted-foreground)', lineHeight: '1', marginTop: '3px' }}>{att.size}</div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Action buttons */}
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button style={{
                              height: '32px', padding: '0 12px', fontSize: '12px', fontWeight: 500, color: 'var(--foreground)',
                              backgroundColor: '#FFFFFF', border: '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer',
                              display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'Inter, system-ui, sans-serif',
                              lineHeight: '1', transition: 'all 150ms',
                            }}
                              onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--muted)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
                              onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#FFFFFF'; e.currentTarget.style.borderColor = 'var(--border)'; }}
                            >
                              <Reply style={{ width: '13px', height: '13px', color: 'var(--muted-foreground)' }} />
                              Reply
                            </button>
                            <button style={{
                              height: '32px', padding: '0 12px', fontSize: '12px', fontWeight: 500, color: 'var(--foreground)',
                              backgroundColor: '#FFFFFF', border: '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer',
                              display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'Inter, system-ui, sans-serif',
                              lineHeight: '1', transition: 'all 150ms',
                            }}
                              onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--muted)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
                              onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#FFFFFF'; e.currentTarget.style.borderColor = 'var(--border)'; }}
                            >
                              <Forward style={{ width: '13px', height: '13px', color: 'var(--muted-foreground)' }} />
                              Forward
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Compose Email Modal ───────────────────────────────────────────
function ComposeEmailModal({ onClose }: { onClose: () => void }) {
  const [toEmails, setToEmails] = useState<string[]>(['k.rodriguez@tricountyems.gov']);
  const [ccEmails, setCcEmails] = useState<string[]>(['t.mitchell@tricountyems.gov']);
  const [bccEmails, setBccEmails] = useState<string[]>([]);
  const [toInput, setToInput] = useState('');
  const [ccInput, setCcInput] = useState('');
  const [bccInput, setBccInput] = useState('');
  const [subject, setSubject] = useState('RE: Quote Q-2026-0142 — Enterprise Equipment Package');
  const [body, setBody] = useState('');
  const [showCc, setShowCc] = useState(true);
  const [showBcc, setShowBcc] = useState(false);
  const [attachedItems, setAttachedItems] = useState<string[]>([]);
  const [showItemPicker, setShowItemPicker] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<{ name: string; size: string }[]>([]);

  const toInputRef = useRef<HTMLInputElement>(null);
  const ccInputRef = useRef<HTMLInputElement>(null);
  const bccInputRef = useRef<HTMLInputElement>(null);

  const QUOTE_LINE_ITEMS = [
    { id: '501-100-001', description: 'E-450 stripped chassis, 176" WB, 7.3L V8, DRW, 16,000 GVWR, ambulance prep package.', qty: 2, price: '$48,200', thumbColor: 'var(--accent)' },
    { id: '501-100-002', description: 'Cutaway-mount modular body, 152in patient compartment, 72in headroom, KKK compliant.', qty: 3, price: '$94,200', thumbColor: 'rgba(5, 150, 105, 0.2)' },
    { id: '501-100-003', description: 'P25 Phase II mobile radio, all-band, AES 256 encryption.', qty: 3, price: '$7,850', thumbColor: 'rgba(220, 38, 38, 0.2)' },
    { id: '501-100-004', description: 'Powered stretcher, 700 lb cap, Power-LOAD compatible.', qty: 3, price: '$18,500', thumbColor: 'var(--accent)' },
    { id: '501-100-005', description: '3000W pure sine inverter with 75A charger auto transfer.', qty: 3, price: '$1,650', thumbColor: 'rgba(217, 119, 6, 0.2)' },
  ];

  const CONTACT_SUGGESTIONS = [
    { name: 'Karen Rodriguez', email: 'k.rodriguez@tricountyems.gov' },
    { name: 'Tom Mitchell', email: 't.mitchell@tricountyems.gov' },
    { name: 'Michael Rodriguez', email: 'michael.r@company.com' },
    { name: 'Sarah Chen', email: 'sarah.chen@company.com' },
    { name: 'David Kim', email: 'david.kim@company.com' },
  ];

  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleEmailKeyDown = (
    e: React.KeyboardEvent,
    input: string,
    setInput: (v: string) => void,
    emails: string[],
    setEmails: (v: string[]) => void,
  ) => {
    if (e.key === 'Enter' || e.key === 'Tab' || e.key === ',') {
      e.preventDefault();
      const email = input.trim().replace(/,$/, '');
      if (email && isValidEmail(email) && !emails.includes(email)) {
        setEmails([...emails, email]);
        setInput('');
      } else if (email && !isValidEmail(email)) {
        toast.error('Invalid email address');
      }
    } else if (e.key === 'Backspace' && !input && emails.length > 0) {
      setEmails(emails.slice(0, -1));
    }
  };

  const handleSend = () => {
    if (toEmails.length === 0 || !subject.trim()) {
      toast.error('Please add at least one recipient and a subject');
      return;
    }
    toast.success('Email sent successfully');
    onClose();
  };

  const handleFileAttach = () => {
    setAttachedFiles(prev => [...prev, { name: `Attachment_${prev.length + 1}.pdf`, size: `${Math.floor(Math.random() * 3000 + 100)} KB` }]);
    toast.success('File attached');
  };

  const EmailPillField = ({ label, emails, setEmails, input, setInput, inputRef, rightActions }: {
    label: string; emails: string[]; setEmails: (v: string[]) => void;
    input: string; setInput: (v: string) => void; inputRef: React.RefObject<HTMLInputElement | null>;
    rightActions?: React.ReactNode;
  }) => {
    const [showSug, setShowSug] = useState(false);
    const filtered = CONTACT_SUGGESTIONS.filter(c =>
      !emails.includes(c.email) &&
      (c.name.toLowerCase().includes(input.toLowerCase()) || c.email.toLowerCase().includes(input.toLowerCase()))
    );
    return (
      <div style={{ display: 'flex', alignItems: 'flex-start', borderBottom: '1px solid var(--muted)', position: 'relative' }}>
        <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--muted-foreground)', lineHeight: '1', padding: '10px 0', width: '36px', flexShrink: 0 }}>{label}</span>
        <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px', padding: '6px 0', minHeight: '36px', cursor: 'text' }}
          onClick={() => inputRef.current?.focus()}>
          {emails.map(email => {
            const contact = CONTACT_SUGGESTIONS.find(c => c.email === email);
            return (
              <span key={email} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', height: '24px', padding: '0 4px 0 8px', borderRadius: '12px', backgroundColor: 'var(--accent)', border: '1px solid var(--accent)', fontSize: '12px', fontWeight: 500, color: 'var(--primary)', lineHeight: '1', maxWidth: '220px' }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{contact ? contact.name : email}</span>
                <button onClick={e => { e.stopPropagation(); setEmails(emails.filter(x => x !== email)); }} style={{ width: '16px', height: '16px', borderRadius: '50%', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, flexShrink: 0, transition: 'background-color 100ms' }}
                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--accent)'; }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}>
                  <X style={{ width: '10px', height: '10px', color: 'var(--primary)' }} />
                </button>
              </span>
            );
          })}
          <div style={{ position: 'relative', flex: 1, minWidth: '120px' }}>
            <input ref={inputRef} value={input}
              onChange={e => { setInput(e.target.value); setShowSug(true); }}
              onKeyDown={e => { handleEmailKeyDown(e, input, setInput, emails, setEmails); if (e.key === 'Escape') setShowSug(false); }}
              onFocus={() => setShowSug(true)}
              onBlur={() => setTimeout(() => setShowSug(false), 150)}
              placeholder={emails.length === 0 ? 'Type email address...' : ''}
              style={{ width: '100%', border: 'none', outline: 'none', fontSize: '13px', fontWeight: 400, color: 'var(--foreground)', fontFamily: 'Inter, system-ui, sans-serif', lineHeight: '24px', backgroundColor: 'transparent', padding: 0 }}
            />
            {showSug && input && filtered.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: '4px', zIndex: 30, backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid var(--border)', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', width: '280px', maxHeight: '180px', overflowY: 'auto' }}>
                {filtered.map(c => (
                  <button key={c.email} onMouseDown={e => { e.preventDefault(); if (!emails.includes(c.email)) setEmails([...emails, c.email]); setInput(''); setShowSug(false); }}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', fontSize: '12px', color: 'var(--foreground)', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', textAlign: 'left', transition: 'background-color 100ms' }}
                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--muted)'; }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}>
                    <Avatar name={c.name} size={24} />
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--foreground)', lineHeight: '1.2' }}>{c.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--muted-foreground)', lineHeight: '1', marginTop: '2px' }}>{c.email}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        {rightActions && <div style={{ padding: '8px 0', flexShrink: 0 }}>{rightActions}</div>}
      </div>
    );
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.3)' }} onClick={onClose} />
      <div style={{ position: 'relative', backgroundColor: 'var(--card)', borderRadius: '12px', width: '620px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)', fontFamily: 'Inter, system-ui, sans-serif' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Mail style={{ width: '16px', height: '16px', color: 'var(--primary)' }} />
            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--foreground)', lineHeight: '1' }}>New Email</span>
          </div>
          <button onClick={onClose} style={{ width: '28px', height: '28px', borderRadius: '6px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background-color 100ms' }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--muted)'; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}>
            <X style={{ width: '16px', height: '16px', color: 'var(--muted-foreground)' }} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '0 20px' }}>
            {/* From */}
            <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--muted)', padding: '10px 0' }}>
              <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--muted-foreground)', lineHeight: '1', width: '36px', flexShrink: 0 }}>From</span>
              <span style={{ fontSize: '13px', color: 'var(--muted-foreground)', lineHeight: '1' }}>Sarah Chen &lt;sarah.chen@company.com&gt;</span>
            </div>

            {/* To */}
            <EmailPillField label="To" emails={toEmails} setEmails={setToEmails} input={toInput} setInput={setToInput} inputRef={toInputRef}
              rightActions={
                <div style={{ display: 'flex', gap: '2px' }}>
                  {!showCc && <button onClick={() => setShowCc(true)} style={{ fontSize: '12px', fontWeight: 500, color: 'var(--primary)', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 6px', borderRadius: '4px', fontFamily: 'Inter, system-ui, sans-serif', transition: 'background-color 100ms' }} onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--accent)'; }} onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}>Cc</button>}
                  {!showBcc && <button onClick={() => setShowBcc(true)} style={{ fontSize: '12px', fontWeight: 500, color: 'var(--primary)', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 6px', borderRadius: '4px', fontFamily: 'Inter, system-ui, sans-serif', transition: 'background-color 100ms' }} onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--accent)'; }} onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}>Bcc</button>}
                </div>
              }
            />

            {/* CC */}
            {showCc && <EmailPillField label="Cc" emails={ccEmails} setEmails={setCcEmails} input={ccInput} setInput={setCcInput} inputRef={ccInputRef} />}

            {/* BCC */}
            {showBcc && <EmailPillField label="Bcc" emails={bccEmails} setEmails={setBccEmails} input={bccInput} setInput={setBccInput} inputRef={bccInputRef} />}

            {/* Subject */}
            <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--muted)', padding: '8px 0' }}>
              <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--muted-foreground)', lineHeight: '1', width: '36px', flexShrink: 0 }}>Subj</span>
              <input value={subject} onChange={e => setSubject(e.target.value)}
                style={{ flex: 1, border: 'none', outline: 'none', fontSize: '13px', fontWeight: 500, color: 'var(--foreground)', fontFamily: 'Inter, system-ui, sans-serif', lineHeight: '1', backgroundColor: 'transparent', padding: 0 }} />
            </div>
          </div>

          {/* Body */}
          <div style={{ flex: 1, padding: '12px 20px' }}>
            <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Compose your message..."
              style={{ width: '100%', minHeight: '200px', fontSize: '13px', fontWeight: 400, color: 'var(--foreground)', border: 'none', outline: 'none', resize: 'none', fontFamily: 'Inter, system-ui, sans-serif', lineHeight: '1.7', boxSizing: 'border-box', backgroundColor: 'transparent' }} />
          </div>

          {/* Attached Items */}
          {attachedItems.length > 0 && (
            <div style={{ padding: '0 20px 12px', borderTop: '1px solid var(--muted)' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'none', padding: '10px 0 6px', lineHeight: '1' }}>Referenced Line Items</div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {attachedItems.map(id => {
                  const item = QUOTE_LINE_ITEMS.find(i => i.id === id);
                  if (!item) return null;
                  return (
                    <span key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', height: '24px', padding: '0 4px 0 8px', borderRadius: '6px', backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', fontSize: '11px', fontWeight: 500, color: '#166534', lineHeight: '1' }}>
                      <span style={{ color: '#22C55E', fontWeight: 600 }}>#</span>{item.id}
                      <span style={{ color: 'var(--muted-foreground)', fontWeight: 400 }}>·</span>
                      <span style={{ color: 'var(--foreground)', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.description.split(',')[0]}</span>
                      <button onClick={() => setAttachedItems(prev => prev.filter(i => i !== id))} style={{ width: '14px', height: '14px', borderRadius: '3px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                        <X style={{ width: '9px', height: '9px', color: 'var(--success)' }} />
                      </button>
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Attached Files */}
          {attachedFiles.length > 0 && (
            <div style={{ padding: '0 20px 12px', borderTop: attachedItems.length > 0 ? 'none' : '1px solid var(--muted)' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'none', padding: '10px 0 6px', lineHeight: '1' }}>Attachments</div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {attachedFiles.map((f, idx) => (
                  <span key={idx} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', height: '28px', padding: '0 6px 0 10px', borderRadius: '6px', backgroundColor: 'var(--muted)', border: '1px solid var(--border)', fontSize: '12px', fontWeight: 500, color: 'var(--foreground)', lineHeight: '1' }}>
                    <Paperclip style={{ width: '11px', height: '11px', color: 'var(--muted-foreground)' }} />
                    {f.name}
                    <span style={{ fontSize: '10px', color: 'var(--muted-foreground)' }}>{f.size}</span>
                    <button onClick={() => setAttachedFiles(prev => prev.filter((_, i) => i !== idx))} style={{ width: '14px', height: '14px', borderRadius: '3px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                      <X style={{ width: '9px', height: '9px', color: 'var(--muted-foreground)' }} />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Item Picker Popover */}
        {showItemPicker && (
          <div style={{ position: 'absolute', bottom: '60px', left: '20px', zIndex: 30, backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid var(--border)', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', width: '360px', fontFamily: 'Inter, system-ui, sans-serif' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid var(--muted)' }}>
              <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--foreground-soft)' }}>Reference Line Items</span>
              <button onClick={() => setShowItemPicker(false)} style={{ width: '20px', height: '20px', borderRadius: '4px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X style={{ width: '12px', height: '12px', color: 'var(--muted-foreground)' }} />
              </button>
            </div>
            <div style={{ maxHeight: '220px', overflowY: 'auto', padding: '4px' }}>
              {QUOTE_LINE_ITEMS.map(item => {
                const isAttached = attachedItems.includes(item.id);
                return (
                  <button key={item.id} onClick={() => isAttached ? setAttachedItems(prev => prev.filter(i => i !== item.id)) : setAttachedItems(prev => [...prev, item.id])}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '6px', border: 'none', backgroundColor: isAttached ? '#F0FDF4' : 'transparent', cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', textAlign: 'left', transition: 'background-color 100ms' }}
                    onMouseEnter={e => { if (!isAttached) e.currentTarget.style.backgroundColor = 'var(--muted)'; }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = isAttached ? '#F0FDF4' : 'transparent'; }}>
                    <div style={{ width: '16px', height: '16px', borderRadius: '4px', border: isAttached ? 'none' : '1.5px solid var(--border)', backgroundColor: isAttached ? '#22C55E' : '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {isAttached && <Check style={{ width: '10px', height: '10px', color: '#FFFFFF' }} strokeWidth={3} />}
                    </div>
                    <div style={{ width: '24px', height: '24px', borderRadius: '4px', flexShrink: 0, backgroundColor: item.thumbColor || 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Package style={{ width: '11px', height: '11px', color: 'var(--muted-foreground)', opacity: 0.6 }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--muted-foreground)', lineHeight: '1', marginBottom: '3px' }}>{item.id}</div>
                      <div style={{ fontSize: '11px', color: 'var(--foreground)', lineHeight: '1.3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.description}</div>
                      <div style={{ fontSize: '10px', color: 'var(--muted-foreground)', lineHeight: '1', marginTop: '3px' }}>Qty: {item.qty} · {item.price}/unit</div>
                    </div>
                  </button>
                );
              })}
            </div>
            <div style={{ padding: '8px 10px', borderTop: '1px solid var(--muted)', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowItemPicker(false)} style={{ height: '28px', padding: '0 12px', fontSize: '12px', fontWeight: 500, color: '#FFFFFF', backgroundColor: 'var(--primary)', border: 'none', borderRadius: '6px', cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', lineHeight: '1', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                Done
                {attachedItems.length > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: '16px', height: '16px', padding: '0 4px', backgroundColor: 'rgba(255,255,255,0.25)', color: '#FFFFFF', borderRadius: '4px', fontSize: '10px', fontWeight: 600, lineHeight: '1' }}>{attachedItems.length}</span>}
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
            <button onClick={handleFileAttach} title="Attach file" style={{ width: '32px', height: '32px', borderRadius: '6px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background-color 100ms' }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--muted)'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}>
              <Paperclip style={{ width: '15px', height: '15px', color: 'var(--muted-foreground)' }} />
            </button>
            <button onClick={() => setShowItemPicker(!showItemPicker)} title="Reference line items" style={{ width: '32px', height: '32px', borderRadius: '6px', border: 'none', backgroundColor: showItemPicker ? 'var(--accent)' : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background-color 100ms', position: 'relative' }}
              onMouseEnter={e => { if (!showItemPicker) e.currentTarget.style.backgroundColor = 'var(--muted)'; }}
              onMouseLeave={e => { if (!showItemPicker) e.currentTarget.style.backgroundColor = 'transparent'; }}>
              <Package style={{ width: '15px', height: '15px', color: showItemPicker ? 'var(--primary)' : 'var(--muted-foreground)' }} />
              {attachedItems.length > 0 && (
                <span style={{ position: 'absolute', top: '2px', right: '2px', width: '14px', height: '14px', borderRadius: '50%', backgroundColor: '#22C55E', color: '#FFFFFF', fontSize: '9px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: '1' }}>{attachedItems.length}</span>
              )}
            </button>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={onClose} style={{ height: '36px', padding: '0 16px', fontSize: '13px', fontWeight: 500, color: 'var(--muted-foreground)', backgroundColor: '#FFFFFF', border: '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', lineHeight: '1', transition: 'all 150ms' }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--muted)'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#FFFFFF'; }}>
              Discard
            </button>
            <button onClick={handleSend} style={{ height: '32px', padding: '0 16px', fontSize: '13px', fontWeight: 500, color: '#FFFFFF', backgroundColor: 'var(--primary)', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontFamily: 'Inter, system-ui, sans-serif', lineHeight: '1', transition: 'background-color 150ms' }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#0D5ED7'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'var(--primary)'; }}>
              <Send style={{ width: '12px', height: '12px' }} />
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
