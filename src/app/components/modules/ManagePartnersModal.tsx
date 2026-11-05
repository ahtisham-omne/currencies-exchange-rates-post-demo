// @ts-nocheck
/**
 * ManagePartnersModal — Category-literal port (Slice CAT-PARITY-Selling).
 *
 * Source of truth: Category project (edda1394-233a-42be-be90-58ae0a04db60)
 * src/app/components/ConfigureCategory.tsx → ManagePartnersModal (lines 2097–2489).
 *
 * Why a portal: rendered as a fixed overlay on document.body so it escapes
 * any ancestor `overflow: hidden` (which previously clipped the small popover
 * inside ConfigCard and made partner selection impossible).
 *
 * The Items MOCK_PARTNERS shape is `{ id, name }` only. We deterministically
 * derive partnerTypes / country / countryFlag / creditLimit / status by hashing
 * the partner id so every partner stays stable across renders.
 */
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Plus, Trash2, Users, Check, Search,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
} from 'lucide-react';
import { CheckboxControl } from './configAtoms';
import { MOCK_PARTNERS } from './CreateItemModal';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

const FONT = "'Inter', sans-serif";

/* ── Derived metadata helpers ────────────────────────────────── */

type PartnerStatus = 'active' | 'inactive' | 'archived';
type PartnerType = 'vendor' | 'customer';

const COUNTRIES: Array<{ name: string; flag: string }> = [
  { name: 'United States', flag: '🇺🇸' },
  { name: 'Germany', flag: '🇩🇪' },
  { name: 'Canada', flag: '🇨🇦' },
  { name: 'United Kingdom', flag: '🇬🇧' },
  { name: 'Japan', flag: '🇯🇵' },
  { name: 'France', flag: '🇫🇷' },
  { name: 'Australia', flag: '🇦🇺' },
  { name: 'Brazil', flag: '🇧🇷' },
];

function hashId(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

function deriveMeta(p: { id: string; name: string }) {
  const h = hashId(p.id);
  const country = COUNTRIES[h % COUNTRIES.length];
  const types: PartnerType[] =
    h % 5 === 0 ? ['vendor'] :
    h % 5 === 1 ? ['customer'] :
    ['vendor', 'customer'];
  const status: PartnerStatus = h % 7 === 0 ? 'inactive' : (h % 13 === 0 ? 'archived' : 'active');
  const creditLimit = 5000 + ((h % 200) * 100); // 5,000–24,900
  return { ...p, country: country.name, countryFlag: country.flag, partnerTypes: types, status, creditLimit };
}

const PARTNER_AVATAR_TINTS = [
  { bg: '#EFF6FF', fg: '#1E40AF' },
  { bg: '#ECFDF5', fg: '#047857' },
  { bg: '#FEF3C7', fg: '#92400E' },
  { bg: '#F5F3FF', fg: '#5B21B6' },
  { bg: '#FFE4E6', fg: '#9F1239' },
  { bg: '#E0F2FE', fg: '#075985' },
];
function partnerTint(id: string) {
  return PARTNER_AVATAR_TINTS[hashId(id) % PARTNER_AVATAR_TINTS.length];
}
function partnerInitials(name: string) {
  return name.split(/\s+/).slice(0, 2).map(s => s[0]?.toUpperCase() ?? '').join('');
}
function formatCurrency(n: number) {
  return `$ ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/* ── Modal ────────────────────────────────────────────────────── */

interface ManagePartnersModalProps {
  open: boolean;
  onClose: () => void;
  selectedPartners: string[];
  onAdd: (ids: string[]) => void;
  onRemove: (ids: string[]) => void;
}

export function ManagePartnersModal({
  open, onClose, selectedPartners, onAdd, onRemove,
}: ManagePartnersModalProps) {
  const [view, setView] = useState<'browse' | 'added'>('browse');
  const [browseSearch, setBrowseSearch] = useState('');
  const [addedSearch, setAddedSearch] = useState('');
  const [browseSel, setBrowseSel] = useState<Set<string>>(new Set());
  const [addedSel, setAddedSel] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<'all' | PartnerStatus>('all');

  if (!open) return null;

  const allPartners = MOCK_PARTNERS.map(deriveMeta);
  const available = allPartners.filter(p => !selectedPartners.includes(p.id));
  const assigned = allPartners.filter(p => selectedPartners.includes(p.id));

  const matchSearch = (p: any, q: string) =>
    !q.trim() || p.name.toLowerCase().includes(q.toLowerCase()) || p.country.toLowerCase().includes(q.toLowerCase());
  const matchStatus = (p: any) => statusFilter === 'all' || p.status === statusFilter;

  const browseRows = available.filter(p => matchSearch(p, browseSearch) && matchStatus(p));
  const addedRows = assigned.filter(p => matchSearch(p, addedSearch) && matchStatus(p));

  const isBrowse = view === 'browse';
  const rows = isBrowse ? browseRows : addedRows;
  const sel = isBrowse ? browseSel : addedSel;
  const setSel = isBrowse ? setBrowseSel : setAddedSel;

  const allChecked = rows.length > 0 && rows.every(r => sel.has(r.id));

  const toggleAll = () => {
    const next = new Set(sel);
    if (allChecked) rows.forEach(r => next.delete(r.id));
    else rows.forEach(r => next.add(r.id));
    setSel(next);
  };
  const toggleOne = (id: string) => {
    const next = new Set(sel);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSel(next);
  };

  const counts = {
    all: (isBrowse ? available : assigned).length,
    active: (isBrowse ? available : assigned).filter(p => p.status === 'active').length,
    inactive: (isBrowse ? available : assigned).filter(p => p.status === 'inactive').length,
  };

  const statusPill = (s: PartnerStatus) => {
    const map: Record<PartnerStatus, { bg: string; fg: string; bd: string; label: string }> = {
      active:   { bg: '#ECFDF5', fg: '#065F46', bd: '#A7F3D0', label: 'Active' },
      inactive: { bg: '#FFFBEB', fg: '#92400E', bd: '#FDE68A', label: 'Inactive' },
      archived: { bg: '#FEF2F2', fg: '#991B1B', bd: '#FECACA', label: 'Archived' },
    };
    const m = map[s];
    return (
      <span
        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] border font-semibold"
        style={{ backgroundColor: m.bg, color: m.fg, borderColor: m.bd, fontFamily: FONT }}
      >
        {m.label}
      </span>
    );
  };

  const typePill = (t: PartnerType) => {
    const map = t === 'vendor'
      ? { bg: '#EFF6FF', fg: '#1E40AF', bd: '#BFDBFE', label: 'Vendor' }
      : { bg: '#F5F3FF', fg: '#5B21B6', bd: '#DDD6FE', label: 'Customer' };
    return (
      <span
        key={t}
        className="inline-flex items-center px-2 py-0.5 text-xs rounded-md border font-medium"
        style={{ backgroundColor: map.bg, color: map.fg, borderColor: map.bd, fontFamily: FONT }}
      >
        {map.label}
      </span>
    );
  };

  const handleAdd = () => {
    if (browseSel.size === 0) return;
    onAdd(Array.from(browseSel));
    setBrowseSel(new Set());
    setView('added');
  };
  const handleRemove = () => {
    if (addedSel.size === 0) return;
    onRemove(Array.from(addedSel));
    setAddedSel(new Set());
  };

  const filterChip = (key: 'all' | PartnerStatus, label: string, count: number) => {
    const active = statusFilter === key;
    return (
      <button
        key={key}
        onClick={() => setStatusFilter(key)}
        className={cn(
          'inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[12px] border transition-colors whitespace-nowrap cursor-pointer',
          active
            ? 'border-primary bg-accent hover:bg-[#D6E8FF] font-medium'
            : 'border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-muted-foreground/30 font-normal',
        )}
        style={active ? { color: 'hsl(var(--primary))' } : undefined}
      >
        {label}
        <span
          className={cn(
            'text-[10px] rounded-full px-1.5 py-px min-w-[18px] text-center font-semibold',
            active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
          )}
        >
          {count}
        </span>
      </button>
    );
  };

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 225, backgroundColor: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex flex-col bg-white"
        style={{
          width: 'min(1040px, 96vw)', maxHeight: '88vh', borderRadius: 16,
          boxShadow: '0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)',
          fontFamily: FONT,
        }}
      >
        {/* Header */}
        <div className="px-5 pt-4 pb-3" style={{ borderBottom: '1px solid #EEF2F6' }}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <span style={{ fontSize: 17, fontWeight: 700, color: '#0F172A' }}>Manage Partners</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600, backgroundColor: '#ECFDF5', color: '#047857', border: '1px solid #A7F3D0', whiteSpace: 'nowrap' }}>
                Selling<span style={{ fontSize: 10, opacity: 0.6 }}>·</span>Sell to specific partners only
              </span>
            </div>
            <button onClick={onClose} className="flex items-center justify-center hover:bg-secondary transition-colors" style={{ width: 32, height: 32, borderRadius: 8 }}>
              <X style={{ width: 16, height: 16, color: '#64748B' }} />
            </button>
          </div>
          <div style={{ marginTop: 4, fontSize: 12, color: '#64748B' }}>
            Browse partners to add, or manage already assigned ones.
          </div>
        </div>

        {/* Toolbar */}
        <div className="px-5 pt-2 bg-white">
          <div className="flex items-center justify-between gap-3">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70 pointer-events-none" />
              <input
                value={isBrowse ? browseSearch : addedSearch}
                onChange={e => isBrowse ? setBrowseSearch(e.target.value) : setAddedSearch(e.target.value)}
                placeholder={isBrowse ? 'Search available partners...' : 'Search assigned partners...'}
                className="w-full pl-9 pr-8 h-8 text-[13px] bg-white border border-border/80 rounded-lg shadow-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 placeholder:text-muted-foreground/50"
                style={{ fontFamily: FONT }}
              />
              {(isBrowse ? browseSearch : addedSearch) && (
                <button
                  onClick={() => isBrowse ? setBrowseSearch('') : setAddedSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted/60 text-muted-foreground hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="inline-flex items-center rounded-lg bg-muted p-0.5 shrink-0">
              {(['browse', 'added'] as const).map(v => {
                const active = view === v;
                const Icon = v === 'browse' ? Users : Check;
                const count = v === 'browse' ? available.length : assigned.length;
                const iconActiveColor = v === 'browse' ? 'text-primary' : 'text-emerald-500';
                const badgeClass = active
                  ? (v === 'browse' ? 'bg-accent text-primary' : 'bg-emerald-50 text-emerald-600')
                  : 'bg-border text-slate-500';
                return (
                  <button
                    key={v}
                    onClick={() => setView(v)}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] transition-all',
                      active
                        ? 'bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08)] text-foreground font-semibold'
                        : 'text-slate-500 hover:text-slate-700 font-medium',
                    )}
                    style={{ fontFamily: FONT }}
                  >
                    <Icon className={cn('w-3.5 h-3.5', active ? iconActiveColor : 'text-slate-400')} />
                    {v === 'browse' ? 'Browse Partners' : 'Assigned Partners'}
                    <span className={cn('text-[10px] rounded-full px-1.5 py-px min-w-[16px] text-center font-semibold', badgeClass)}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2 ml-auto shrink-0">
              {sel.size > 0 && <span className="text-xs text-primary font-semibold">{sel.size} selected</span>}
              <span className="text-xs text-muted-foreground font-medium">{rows.length} {isBrowse ? 'available' : 'partners'}</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 pt-2.5 pb-2.5">
            {filterChip('all', 'All', counts.all)}
            {filterChip('active', 'Active', counts.active)}
            {filterChip('inactive', 'Inactive', counts.inactive)}
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 min-h-0 overflow-auto">
          <Table style={{ tableLayout: 'fixed', minWidth: isBrowse ? 860 : 920, fontFamily: FONT }}>
            <TableHeader>
              <TableRow className="bg-[#FAFBFC] hover:bg-[#FAFBFC] [&>th]:h-8 border-b border-border">
                <TableHead className="sticky left-0 z-20 bg-[#FAFBFC] w-[40px] min-w-[40px] max-w-[40px] !pl-2 !pr-0">
                  <CheckboxControl checked={allChecked} onChange={toggleAll} />
                </TableHead>
                <TableHead className="text-[13px] text-foreground !pl-3 font-semibold" style={{ width: 240 }}>Partner</TableHead>
                <TableHead className="text-[13px] text-foreground !pl-3 font-semibold" style={{ width: 160 }}>Type</TableHead>
                <TableHead className="text-[13px] text-foreground !pl-3 font-semibold" style={{ width: 150 }}>Country</TableHead>
                <TableHead className="text-[13px] text-foreground !pl-3 font-semibold text-right" style={{ width: 130 }}>Credit Limit</TableHead>
                <TableHead className="text-[13px] text-foreground !pl-3 font-semibold" style={{ width: 100 }}>Status</TableHead>
                {!isBrowse && (
                  <TableHead
                    className="sticky right-0 z-20 bg-[#FAFBFC] w-[60px]"
                    style={{ boxShadow: 'inset 1px 0 0 0 rgba(0,0,0,0.08)' }}
                  />
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isBrowse ? 6 : 7} className="text-center py-16 text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <Users className="w-8 h-8" />
                      <p className="text-sm">{isBrowse ? 'No partners available' : 'No partners assigned'}</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : rows.map(p => {
                const isSel = sel.has(p.id);
                const tint = partnerTint(p.id);
                return (
                  <TableRow
                    key={p.id}
                    onClick={() => toggleOne(p.id)}
                    className={cn(
                      'cursor-pointer group bg-white hover:bg-[#F0F7FF] [&>td]:py-1 [&>td]:pl-3 [&>td]:pr-2 border-b border-[#F1F5F9]',
                      isSel && '!bg-accent/60',
                    )}
                  >
                    <TableCell
                      className={cn(
                        'sticky left-0 z-10 !pl-2 !pr-0',
                        isSel ? 'bg-accent/60' : 'bg-white group-hover:bg-[#F0F7FF]',
                      )}
                      onClick={e => e.stopPropagation()}
                    >
                      <CheckboxControl checked={isSel} onChange={() => toggleOne(p.id)} />
                    </TableCell>
                    <TableCell className={cn(isSel ? 'bg-accent/60' : 'bg-white group-hover:bg-[#F0F7FF]')}>
                      <div className="flex items-center gap-2.5">
                        <div
                          className="flex items-center justify-center shrink-0 w-7 h-7 rounded-full border text-[10px] font-bold"
                          style={{ backgroundColor: tint.bg, color: tint.fg, borderColor: `${tint.fg}20` }}
                        >
                          {partnerInitials(p.name)}
                        </div>
                        <span className="text-sm font-medium truncate block max-w-[170px]" style={{ color: '#1E293B' }}>{p.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className={cn(isSel ? 'bg-accent/60' : 'bg-white group-hover:bg-[#F0F7FF]')}>
                      <div className="flex flex-wrap gap-1.5">{p.partnerTypes.map(typePill)}</div>
                    </TableCell>
                    <TableCell className={cn(isSel ? 'bg-accent/60' : 'bg-white group-hover:bg-[#F0F7FF]')}>
                      <div className="flex items-center gap-2">
                        <span className="text-base leading-none">{p.countryFlag}</span>
                        <span className="text-sm" style={{ color: '#1E293B' }}>{p.country}</span>
                      </div>
                    </TableCell>
                    <TableCell
                      className={cn('text-right text-sm tabular-nums', isSel ? 'bg-accent/60' : 'bg-white group-hover:bg-[#F0F7FF]')}
                      style={{ color: '#1E293B' }}
                    >
                      {formatCurrency(p.creditLimit)}
                    </TableCell>
                    <TableCell className={cn(isSel ? 'bg-accent/60' : 'bg-white group-hover:bg-[#F0F7FF]')}>
                      {statusPill(p.status)}
                    </TableCell>
                    {!isBrowse && (
                      <TableCell
                        className={cn(
                          'sticky right-0 z-10 !px-0 text-center',
                          isSel ? 'bg-accent/60' : 'bg-white group-hover:bg-[#F0F7FF]',
                        )}
                        style={{ boxShadow: 'inset 1px 0 0 0 rgba(0,0,0,0.08)' }}
                        onClick={e => e.stopPropagation()}
                      >
                        <button
                          onClick={() => onRemove([p.id])}
                          className="inline-flex items-center justify-center w-7 h-7 rounded-md hover:bg-destructive/10 hover:text-destructive transition-colors"
                          aria-label={`Remove ${p.name}`}
                        >
                          <Trash2 className="w-3.5 h-3.5 text-slate-400" />
                        </button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Pagination row */}
        <div className="flex items-center justify-center px-4 py-2 shrink-0 bg-white" style={{ borderTop: '1px solid #EEF2F6' }}>
          <div className="flex items-center gap-1">
            <button disabled className="hover:bg-secondary transition-colors disabled:opacity-50 inline-flex items-center justify-center" style={{ height: 28, width: 28, padding: 0, borderRadius: 6, color: '#64748B', fontFamily: FONT }} aria-label="First page">
              <ChevronsLeft style={{ width: 14, height: 14 }} />
            </button>
            <button disabled className="hover:bg-secondary transition-colors disabled:opacity-50 inline-flex items-center gap-1" style={{ height: 28, padding: '0 10px', borderRadius: 6, fontSize: 13, color: '#64748B', fontFamily: FONT }}>
              <ChevronLeft style={{ width: 12, height: 12 }} /> Prev
            </button>
            <button className="bg-primary text-primary-foreground" style={{ height: 28, width: 28, padding: 0, borderRadius: 6, fontSize: 13, fontWeight: 600, fontFamily: FONT }}>1</button>
            <button disabled className="hover:bg-secondary transition-colors disabled:opacity-50 inline-flex items-center gap-1" style={{ height: 28, padding: '0 10px', borderRadius: 6, fontSize: 13, color: '#64748B', fontFamily: FONT }}>
              Next <ChevronRight style={{ width: 12, height: 12 }} />
            </button>
            <button disabled className="hover:bg-secondary transition-colors disabled:opacity-50 inline-flex items-center justify-center" style={{ height: 28, width: 28, padding: 0, borderRadius: 6, color: '#64748B', fontFamily: FONT }} aria-label="Last page">
              <ChevronsRight style={{ width: 14, height: 14 }} />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-2.5" style={{ borderTop: '1px solid #EEF2F6' }}>
          <div style={{ fontSize: 12, color: '#64748B' }}>
            <span style={{ color: '#0F172A', fontWeight: 600 }}>{assigned.length}</span> partners assigned
            {isBrowse && browseSel.size > 0 && (
              <> · <span style={{ color: '#0A77FF', fontWeight: 600 }}>{browseSel.size} ready to add</span></>
            )}
            {!isBrowse && addedSel.size > 0 && (
              <> · <span style={{ color: '#DC2626', fontWeight: 600 }}>{addedSel.size} selected</span></>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="hover:bg-slate-50 transition-colors" style={{ height: 36, padding: '0 16px', borderRadius: 8, fontSize: 12, fontWeight: 500, color: '#64748B', border: '1px solid hsl(var(--border))', fontFamily: FONT, backgroundColor: '#FFFFFF' }}>
              Cancel
            </button>
            {isBrowse ? (
              <button
                onClick={handleAdd}
                disabled={browseSel.size === 0}
                className="bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:pointer-events-none inline-flex items-center gap-1.5"
                style={{ height: 36, padding: '0 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, fontFamily: FONT }}
              >
                <Plus style={{ width: 13, height: 13 }} />
                Add Partners {browseSel.size > 0 && <span style={{ opacity: 0.85 }}>({browseSel.size})</span>}
              </button>
            ) : (
              <button
                onClick={handleRemove}
                disabled={addedSel.size === 0}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50 disabled:pointer-events-none inline-flex items-center gap-1.5"
                style={{ height: 36, padding: '0 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, fontFamily: FONT }}
              >
                <Trash2 style={{ width: 13, height: 13 }} />
                Remove {addedSel.size > 0 && <span style={{ opacity: 0.85 }}>({addedSel.size})</span>}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}