// @ts-nocheck
/**
 * GovernanceSection — Slice Pair C render-path unification.
 * Literal lift of Category's GovernanceSection from
 * ConfigureCategory.tsx lines 1918-2172, adapted to Items' state shape:
 *   - valuationMethod: 'fifo' | 'lifo' | 'wac' | 'specific'  (Category uses 'weighted' for WAC; we map id 'wac')
 *   - owners: stored as 5 separate string[] fields keyed by user id
 *     (engineeringOwner, purchasingOwner, schedulingOwner, salesOwner, arOwner)
 *
 * State-shape divergence from Category: Category stores owners as
 *   `config.owners[roleKey]: string[] (names)`; Items stores them as flat
 *   per-role arrays of user IDs. We adapt addOwner/removeOwner accordingly
 *   and use MOCK_USERS' (id, name, role, initials) shape with a per-user
 *   color hex map for chip/avatar treatment (Category uses inline hex colors
 *   directly on the user object).
 *
 * Mounted from BOTH render paths: CreateItemModal (showConfig render block)
 * and ItemConfigurationMaster (detail page Configurations tab).
 */
import React, { useState } from 'react';
import { Check, Info, Plus, X, Calculator, Users } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { MOCK_USERS } from './CreateItemModal';
import type { AdvancedConfig } from './ItemConfigurationMaster';

/* Local ConfigCard mirror — same shell as the shared ConfigCard in CreateItemModal.tsx
   (lines 891-919, post-M.4). Inlined to avoid a circular import (CreateItemModal also
   imports GovernanceSection). Visual treatment is byte-identical to other 5 tabs. */
function ConfigCard({ title, icon: Icon, tooltip, children }: { title: string; icon?: any; tooltip?: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}
    >
      {Icon && (
        <div className="flex items-center gap-2" style={{ padding: '10px 16px', borderBottom: '1px solid #EEF2F6', backgroundColor: '#FAFBFC' }}>
          <div className="flex items-center justify-center shrink-0" style={{ width: 24, height: 24, borderRadius: 6, backgroundColor: 'rgba(10,119,255,0.08)' }}>
            <Icon style={{ width: 14, height: 14, color: '#0A77FF' }} />
          </div>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>{title}</span>
          {tooltip && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="shrink-0 flex items-center justify-center cursor-help">
                  <Info style={{ width: 13, height: 13, color: '#94A3B8' }} />
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" style={{ maxWidth: 340 }}>
                <p style={{ fontSize: 12, lineHeight: 1.6, whiteSpace: 'pre-line' }}>{tooltip}</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      )}
      <div style={{ padding: '12px 16px' }}>{children}</div>
    </div>
  );
}

const FONT = 'Inter, system-ui, sans-serif';

// Per-user hex color map (Items' MOCK_USERS uses tailwind classes; Category uses inline hex)
const USER_HEX: Record<string, string> = {
  u1: '#0A77FF',
  u2: '#059669',
  u3: '#D97706',
  u4: '#7C3AED',
  u5: '#DC2626',
  u6: '#475569',
  u7: '#0891B2',
};

const valuationCards = [
  {
    id: 'fifo',
    title: 'FIFO',
    subtitle: 'First-In, First-Out',
    desc: 'Oldest inventory sold first',
    visual: (
      <div className="flex items-center gap-1.5 mt-1">
        <span className="inline-flex items-center justify-center rounded-md text-white" style={{ width: 30, height: 26, fontSize: 11, fontWeight: 700, backgroundColor: '#22C55E' }}>1</span>
        <span style={{ fontSize: 13, color: 'var(--foreground)', opacity: 0.25 }}>→</span>
        {[2, 3, 4].map(n => (
          <span key={n} className="inline-flex items-center justify-center rounded-md" style={{ width: 30, height: 26, fontSize: 11, fontWeight: 600, color: 'var(--foreground)', opacity: 0.4, border: '1px solid var(--border)', backgroundColor: 'var(--secondary)' }}>{n}</span>
        ))}
      </div>
    ),
  },
  {
    id: 'lifo',
    title: 'LIFO',
    subtitle: 'Last-In, First-Out',
    desc: 'Newest inventory sold first',
    visual: (
      <div className="flex items-center gap-1.5 mt-1">
        {[1, 2].map(n => (
          <span key={n} className="inline-flex items-center justify-center rounded-md" style={{ width: 30, height: 26, fontSize: 11, fontWeight: 600, color: 'var(--foreground)', opacity: 0.4, border: '1px solid var(--border)', backgroundColor: 'var(--secondary)' }}>{n}</span>
        ))}
        <span className="inline-flex items-center justify-center rounded-md text-white" style={{ width: 30, height: 26, fontSize: 11, fontWeight: 700, backgroundColor: '#0A77FF' }}>3</span>
        <span style={{ fontSize: 13, color: 'var(--foreground)', opacity: 0.25 }}>→</span>
      </div>
    ),
  },
  {
    id: 'wac',
    title: 'WAC',
    subtitle: 'Weighted Average Cost',
    desc: 'Average cost of all units',
    visual: (
      <div className="flex items-center gap-1.5 mt-1">
        {['$10', '$12', '$11'].map(p => (
          <span key={p} className="inline-flex items-center justify-center rounded-md" style={{ width: 34, height: 26, fontSize: 10, fontWeight: 600, color: '#15803D', border: '1px solid #BBF7D0', backgroundColor: '#F0FDF4' }}>{p}</span>
        ))}
        <span style={{ fontSize: 13, color: 'var(--foreground)', opacity: 0.25 }}>→</span>
        <span className="inline-flex items-center justify-center rounded-full" style={{ height: 26, paddingLeft: 10, paddingRight: 10, fontSize: 11, fontWeight: 700, color: 'white', backgroundColor: '#22C55E' }}>$11.00</span>
      </div>
    ),
  },
  {
    id: 'specific',
    title: 'Specific',
    subtitle: 'Specific Identification',
    desc: 'Track each unit individually',
    visual: (
      <div className="flex items-center gap-1.5 mt-1">
        {['A1', 'B2', 'C3'].map((t, i) => {
          const colors = ['#EF4444', '#F97316', '#8B5CF6'];
          const bgs = ['#FEF2F2', '#FFF7ED', '#F5F3FF'];
          const borders = ['#FECACA', '#FED7AA', '#DDD6FE'];
          return (
            <span key={t} className="inline-flex items-center justify-center rounded-md" style={{ width: 30, height: 26, fontSize: 11, fontWeight: 700, color: colors[i], backgroundColor: bgs[i], border: `1px solid ${borders[i]}` }}>{t}</span>
          );
        })}
      </div>
    ),
  },
];

const ownerRoles = [
  { key: 'engineeringOwner', label: 'Engineering Owner', tooltip: 'Assigned users are notified for all manufacturing and item configuration activity. Notified when: An item config is created or updated, a BOM changes, or a manufacturing-related action is triggered for this item.' },
  { key: 'purchasingOwner', label: 'Purchasing Owner', tooltip: 'Assigned users are notified for all purchasing and receiving activity. Notified when: A PO is raised, modified, or received for this item.' },
  { key: 'schedulingOwner', label: 'Scheduling Owner', tooltip: 'Assigned users are notified for all scheduling and rescheduling activity. Notified when: A production schedule is created, updated, or rescheduled for this item.' },
  { key: 'salesOwner', label: 'Sales Owner', tooltip: 'Assigned users are notified for all sales-related activity. Notified when: A Sales Order is created, modified, fulfilled, or cancelled for this item.' },
  { key: 'arOwner', label: 'Finance Owner', tooltip: 'Assigned users are notified for all financial and accounting activity. Notified when: Any financial or accounting event occurs for this item — including invoicing, cost updates, payments, and GL postings.' },
] as const;

interface GovernanceSectionProps {
  config: AdvancedConfig;
  onConfigChange: (key: keyof AdvancedConfig, value: any) => void;
}

export function GovernanceSection({ config, onConfigChange }: GovernanceSectionProps) {
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [dropdownSearch, setDropdownSearch] = useState('');

  const addOwner = (roleKey: string, userId: string) => {
    const current = (config[roleKey as keyof AdvancedConfig] as string[]) || [];
    if (!current.includes(userId)) {
      onConfigChange(roleKey as keyof AdvancedConfig, [...current, userId]);
    }
  };

  const removeOwner = (roleKey: string, userId: string) => {
    const current = (config[roleKey as keyof AdvancedConfig] as string[]) || [];
    onConfigChange(roleKey as keyof AdvancedConfig, current.filter((id: string) => id !== userId));
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div className="animate-in fade-in duration-500 space-y-6">
        {/* Inventory Valuation — wrapped in shared ConfigCard for parity with other 5 tabs */}
        <ConfigCard title="Inventory Valuation" icon={Calculator} tooltip="Cost accounting method for this item. Determines how unit costs flow through inventory and COGS.">
          <div className="grid grid-cols-2 gap-4">
            {valuationCards.map(card => {
              const isActive = config.valuationMethod === card.id;
              return (
                <button
                  key={card.id}
                  onClick={() => onConfigChange('valuationMethod', card.id as AdvancedConfig['valuationMethod'])}
                  className="flex flex-col text-left p-5 transition-all relative"
                  style={{
                    borderRadius: 12,
                    border: isActive ? '2px solid var(--primary)' : '1px solid var(--border)',
                    backgroundColor: isActive ? '#EDF4FF' : 'var(--card)',
                  }}
                >
                  {isActive && (
                    <div className="absolute top-4 right-4">
                      <Check style={{ width: 18, height: 18, color: 'var(--primary)' }} />
                    </div>
                  )}
                  <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--foreground)', fontFamily: FONT }}>{card.title}</span>
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--primary)', fontFamily: FONT, marginTop: 2 }}>{card.subtitle}</span>
                  <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--foreground)', opacity: 0.5, fontFamily: FONT, marginTop: 4 }}>{card.desc}</span>
                  <div style={{ marginTop: 16 }}>{card.visual}</div>
                </button>
              );
            })}
          </div>
        </ConfigCard>

        {/* Ownership & Responsibility — wrapped in shared ConfigCard */}
        <ConfigCard title="Ownership & Responsibility" icon={Users} tooltip="Assign roles for this item's lifecycle management. Each role receives notifications for the activities described in their tooltip.">
          <div className="grid grid-cols-2 gap-4">
            {ownerRoles.map(role => {
              const owners = (config[role.key as keyof AdvancedConfig] as string[]) || [];
              const isDropdownOpen = activeDropdown === role.key;
              const filteredDropdownUsers = MOCK_USERS.filter(
                (u: any) =>
                  u.name.toLowerCase().includes(dropdownSearch.toLowerCase()) &&
                  !owners.includes(u.id)
              );
              return (
                <div
                  key={role.key}
                  className="flex flex-col p-4 transition-all"
                  style={{
                    borderRadius: 12,
                    border: '1px solid var(--border)',
                    backgroundColor: 'var(--card)',
                  }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5">
                        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)', fontFamily: FONT }}>{role.label}</span>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="shrink-0 flex items-center justify-center cursor-help">
                              <Info style={{ width: 13, height: 13, color: '#94A3B8' }} />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top" style={{ maxWidth: 340 }}>
                            <p style={{ fontSize: 12, lineHeight: 1.6, fontFamily: FONT, whiteSpace: 'pre-line' }}>{role.tooltip}</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--foreground)', opacity: 0.45, fontFamily: FONT, marginTop: 2 }}>
                        {owners.length > 0 ? `${owners.length} assigned` : 'No one assigned'}
                      </span>
                    </div>
                    <div className="relative">
                      <button
                        onClick={() => { setActiveDropdown(isDropdownOpen ? null : role.key); setDropdownSearch(''); }}
                        className="flex items-center justify-center shrink-0 hover:bg-secondary transition-colors"
                        style={{ width: 32, height: 32, borderRadius: 9999, border: '1px solid var(--border)' }}
                      >
                        <Plus style={{ width: 16, height: 16, color: 'var(--foreground)', opacity: 0.4 }} />
                      </button>
                      {isDropdownOpen && (
                        <div className="absolute right-0 z-30" style={{ top: 'calc(100% + 4px)', width: 280, background: 'var(--card)', border: '0.75px solid var(--border)', borderRadius: 10, boxShadow: '0 4px 24px -4px rgba(0,0,0,0.15)', overflow: 'hidden' }}>
                          <div className="px-3 py-2" style={{ borderBottom: '0.75px solid var(--border)' }}>
                            <input
                              value={dropdownSearch}
                              onChange={e => setDropdownSearch(e.target.value)}
                              placeholder="Search people..."
                              className="w-full outline-none bg-transparent"
                              style={{ height: 30, fontSize: 12, fontFamily: FONT, color: 'var(--foreground)' }}
                              autoFocus
                            />
                          </div>
                          <div style={{ maxHeight: 5 * 48, overflowY: 'auto' }}>
                            {filteredDropdownUsers.map((u: any) => (
                              <button
                                key={u.id}
                                onClick={() => { addOwner(role.key, u.id); }}
                                className="flex items-center gap-3 w-full px-3 transition-colors"
                                style={{ height: 48, fontSize: 12, fontFamily: FONT }}
                                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'var(--secondary)')}
                                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
                              >
                                <div className="flex items-center justify-center shrink-0" style={{ width: 28, height: 28, borderRadius: 6, background: USER_HEX[u.id] || '#94A3B8', fontSize: 10, fontWeight: 600, color: 'white' }}>{u.initials}</div>
                                <div className="text-left flex-1 min-w-0">
                                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)', lineHeight: '16px' }}>{u.name}</div>
                                  <div style={{ fontSize: 11, color: '#71717A', lineHeight: '14px' }}>{u.role}</div>
                                </div>
                              </button>
                            ))}
                            {filteredDropdownUsers.length === 0 && (
                              <div className="flex items-center justify-center py-4" style={{ fontSize: 12, color: '#71717A', fontFamily: FONT }}>No results</div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  {owners.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {owners.map((userId: string) => {
                        const user = MOCK_USERS.find((u: any) => u.id === userId);
                        if (!user) return null;
                        return (
                          <div key={userId} className="flex items-center gap-1.5 pl-1.5 pr-1" style={{ height: 28, borderRadius: 9999, background: 'var(--secondary)', border: '0.75px solid var(--border)' }}>
                            <div className="flex items-center justify-center shrink-0" style={{ width: 20, height: 20, borderRadius: 5, background: USER_HEX[userId] || '#94A3B8', fontSize: 8, fontWeight: 600, color: 'white' }}>{user.initials}</div>
                            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--foreground)', fontFamily: FONT }}>{user.name.split(' ')[0]}</span>
                            <button onClick={() => removeOwner(role.key, userId)} className="flex items-center justify-center hover:bg-foreground/10 transition-colors" style={{ width: 16, height: 16, borderRadius: 9999 }}>
                              <X style={{ width: 10, height: 10, color: '#71717A' }} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ConfigCard>
      </div>
    </TooltipProvider>
  );
}
