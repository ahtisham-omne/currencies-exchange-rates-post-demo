// @ts-nocheck
/**
 * GovernanceSection — Pioneer 3-slot Ownership rebuild.
 *
 * Slots (matches Item Ownership spec, Pioneer scope):
 *   1. Material Handling Owner — multi-user, fully wired
 *   2. Purchasing Owner        — single-user, data only (Billy Bob wires later)
 *   3. Finance Owner           — single-user, data only (Billy Bob wires later)
 *
 * State shape (config):
 *   owners: { materialHandling: string[]; purchasing: string|null; finance: string|null }
 *   inheritedOwners?: { materialHandling?: string[]; purchasing?: string; finance?: string }
 *
 * Resolution chain per slot: Item Override → Category Default → Unassigned.
 * Inheritance UI shows muted inherited chip(s) + "Inherited from category"
 * caption + "Override" ghost button until user opts to set an item-level value.
 *
 * Picker is split into "Suggested" (users whose `permissions` intersect the
 * slot's permission keys) and "All people". Soft-filter only — assigning a
 * user without the relevant permission renders an inline amber AlertTriangle
 * warning on the chip but does NOT block.
 *
 * Mounted from BOTH render paths: CreateItemModal (Configure step) and
 * ItemConfigurationMaster (detail page Configurations tab). Inventory
 * Valuation card above is unchanged.
 */
import React, { useState, useContext } from 'react';
import { Check, Info, Plus, X, Calculator, Users, AlertTriangle, Lock } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { Popover, PopoverTrigger, PopoverContent } from '../ui/popover';
import { MOCK_USERS } from './CreateItemModal';
import { InitialAvatar } from '../items-v3/InitialAvatar';
import { basePrefix } from '@/app/currency/itemMoney';
import type { AdvancedConfig } from './ItemConfigurationMaster';
import { ConfigEditContext, LockNotice } from './configAtoms';

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

// Amber warning token (Partners) — used inline on chips when assignee lacks slot permission.
const AMBER = '#B45309';

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
        {[10, 12, 11].map(n => `${basePrefix()}${n}`).map(p => (
          <span key={p} className="inline-flex items-center justify-center rounded-md" style={{ width: 34, height: 26, fontSize: 10, fontWeight: 600, color: '#15803D', border: '1px solid #BBF7D0', backgroundColor: '#F0FDF4' }}>{p}</span>
        ))}
        <span style={{ fontSize: 13, color: 'var(--foreground)', opacity: 0.25 }}>→</span>
        <span className="inline-flex items-center justify-center rounded-full" style={{ height: 26, paddingLeft: 10, paddingRight: 10, fontSize: 11, fontWeight: 700, color: 'white', backgroundColor: '#22C55E' }}>{basePrefix()}11.00</span>
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

/* ─────────────────────────────────────────────────────────────────────────
   Slot definitions — Pioneer 3-slot scope.
   `permissions` lists the keys a user must hold to be "Suggested" for
   the slot. Soft filter only: non-matching users are still pickable
   (under "All people") and will be flagged with an inline warning chip.
   `wiringNote` renders a second small Info pill on the slot label —
   present for the two data-only slots (Purchasing, Finance), absent on
   Material Handling (which is fully wired).
   ───────────────────────────────────────────────────────────────────── */
type OwnerKey = 'materialHandling' | 'purchasing' | 'finance';
type OwnerSlotDef = {
  key: OwnerKey;
  label: string;
  variant: 'multi' | 'single';
  permissions: string[];
  tooltip: string;        // existing notification-routing tooltip
  wiringNote?: string;    // optional "Data only — routing activates with Billy Bob"
};

const OWNER_SLOTS: OwnerSlotDef[] = [
  {
    key: 'materialHandling',
    label: 'Material Handling Owner',
    variant: 'multi',
    permissions: ['receiving', 'shipping', 'movement'],
    tooltip:
      'Assigned users are notified for all warehouse and material movement activity for this item. Notified when: a receipt, putaway, pick, pack, ship, or stock movement task is generated. Multiple owners distribute the workload across the team. Falls back to the unassigned pool when empty.',
  },
  {
    key: 'purchasing',
    label: 'Purchasing Owner',
    variant: 'single',
    permissions: ['purchasing'],
    tooltip:
      'Assigned user is notified for all purchasing and receiving activity. Notified when: a PO is raised, modified, or received for this item.',
    wiringNote: 'Data only — routing activates with Billy Bob.',
  },
  {
    key: 'finance',
    label: 'Finance Owner',
    variant: 'single',
    permissions: ['finance', 'gl'],
    tooltip:
      'Assigned user is notified for all financial and accounting activity for this item — invoicing, cost updates, payments, and GL postings.',
    wiringNote: 'Data only — routing activates with Billy Bob.',
  },
];

/* Read/write helpers — owners now live under config.owners.<key>; legacy
   flat fields (engineeringOwner, etc.) are gone. inheritedOwners is an
   optional shadow populated upstream from category defaults; we only
   read it here. */
function readOwnerValue(config: AdvancedConfig, slot: OwnerSlotDef): string[] {
  const owners = (config as any).owners || {};
  if (slot.variant === 'multi') {
    const v = owners[slot.key];
    return Array.isArray(v) ? v : [];
  }
  const v = owners[slot.key];
  return v ? [v] : [];
}

function readInheritedValue(config: AdvancedConfig, slot: OwnerSlotDef): string[] {
  const inh = (config as any).inheritedOwners || {};
  if (slot.variant === 'multi') {
    const v = inh[slot.key];
    return Array.isArray(v) ? v : [];
  }
  const v = inh[slot.key];
  return v ? [v] : [];
}

function userLacksSlotPermission(userId: string, slot: OwnerSlotDef): boolean {
  const u: any = MOCK_USERS.find((x: any) => x.id === userId);
  if (!u || !Array.isArray(u.permissions)) return true;
  return !u.permissions.some((p: string) => slot.permissions.includes(p));
}

interface GovernanceSectionProps {
  config: AdvancedConfig;
  onConfigChange: (key: keyof AdvancedConfig, value: any) => void;
}

export function GovernanceSection({ config, onConfigChange }: GovernanceSectionProps) {
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [dropdownSearch, setDropdownSearch] = useState('');

  // Cost-accounting / valuation lock (edit mode only — see itemFieldLocks).
  const editCtx = useContext(ConfigEditContext);
  const valuationLock = editCtx?.fieldLocks?.locked?.valuationMethod;

  // Mutate the nested owners object via the existing onConfigChange contract.
  const writeOwners = (next: any) => {
    onConfigChange('owners' as keyof AdvancedConfig, next);
  };

  // Add owner that also promotes inherited values first (so adding to an
  // inherited slot extends the inherited list rather than wiping it).
  const addOwnerWithPromote = (slot: OwnerSlotDef, userId: string) => {
    const itemValue = readOwnerValue(config, slot);
    const inh = readInheritedValue(config, slot);
    const current = (config as any).owners || {};
    if (slot.variant === 'multi') {
      const base: string[] = itemValue.length > 0 ? itemValue : inh;
      if (base.includes(userId)) return;
      writeOwners({ ...current, [slot.key]: [...base, userId] });
    } else {
      writeOwners({ ...current, [slot.key]: userId });
    }
  };

  // Remove that promotes inherited list first if needed.
  const removeOwnerWithPromote = (slot: OwnerSlotDef, userId: string) => {
    const itemValue = readOwnerValue(config, slot);
    const inh = readInheritedValue(config, slot);
    const current = (config as any).owners || {};
    if (slot.variant === 'multi') {
      const base: string[] = itemValue.length > 0 ? itemValue : inh;
      writeOwners({ ...current, [slot.key]: base.filter((id) => id !== userId) });
    } else {
      writeOwners({ ...current, [slot.key]: null });
    }
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div className="animate-in fade-in duration-500 space-y-6">
        {/* Inventory Valuation — wrapped in shared ConfigCard for parity with other 5 tabs */}
        <ConfigCard title="Inventory Valuation" icon={Calculator} tooltip="Cost accounting method for this item. Determines how unit costs flow through inventory and COGS.">
          {valuationLock && (
            <div style={{ marginBottom: 12 }}>
              <LockNotice reason={valuationLock.reason} tier={valuationLock.tier} />
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            {valuationCards.map(card => {
              const isActive = config.valuationMethod === card.id;
              return (
                <button
                  key={card.id}
                  onClick={() => { if (valuationLock) return; onConfigChange('valuationMethod', card.id as AdvancedConfig['valuationMethod']); }}
                  aria-disabled={!!valuationLock}
                  className="flex flex-col text-left p-5 transition-all relative"
                  style={{
                    borderRadius: 12,
                    border: isActive ? '2px solid hsl(var(--primary))' : '1px solid #E2E8F0',
                    backgroundColor: isActive ? '#EDF4FF' : '#FFFFFF',
                    boxShadow: isActive ? 'none' : '0 1px 2px rgba(0,0,0,0.03)',
                    cursor: valuationLock ? 'not-allowed' : 'pointer',
                    opacity: valuationLock && !isActive ? 0.55 : 1,
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

        {/* Ownership & Responsibility — Pioneer 3-slot scope */}
        <ConfigCard
          title="Ownership & Responsibility"
          icon={Users}
          tooltip="Assign owners for this item. Material Handling drives task routing today; Purchasing and Finance owners are stored as data and will route once Billy Bob ships."
        >
          <div className="grid grid-cols-1 gap-3">
            {OWNER_SLOTS.map((slot) => {
              const itemValue = readOwnerValue(config, slot);
              const inheritedValue = readInheritedValue(config, slot);
              const isInherited = itemValue.length === 0 && inheritedValue.length > 0;
              const displayed: string[] = itemValue.length > 0 ? itemValue : inheritedValue;
              const isEmpty = displayed.length === 0;
              const isDropdownOpen = activeDropdown === slot.key;

              // Picker source: exclude already-displayed people, apply search.
              const q = dropdownSearch.toLowerCase();
              const candidates = (MOCK_USERS as any[]).filter((u) => {
                if (slot.variant === 'multi' && displayed.includes(u.id)) return false;
                return u.name.toLowerCase().includes(q);
              });
              const suggested = candidates.filter((u) =>
                Array.isArray(u.permissions) && u.permissions.some((p: string) => slot.permissions.includes(p)),
              );
              const others = candidates.filter((u) => !suggested.includes(u));

              const showAddButton = !(slot.variant === 'single' && displayed.length > 0);

              return (
                <div
                  key={slot.key}
                  className="flex flex-col"
                  style={{
                    borderRadius: 12,
                    border: '1px solid #E2E8F0',
                    backgroundColor: '#FFFFFF',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                  }}
                >
                  {/* Header row */}
                  <div
                    className="flex items-center justify-between gap-2"
                    style={{ padding: '10px 14px', borderBottom: '1px solid #EEF2F6', backgroundColor: '#FAFBFC', borderTopLeftRadius: 12, borderTopRightRadius: 12 }}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#0F172A', fontFamily: FONT }}>{slot.label}</span>
                      {/* Count badge — Categories-style stroke */}
                      {displayed.length > 0 && (
                        <span
                          className="inline-flex items-center justify-center"
                          style={{
                            minWidth: 20,
                            height: 18,
                            padding: '0 6px',
                            borderRadius: 9999,
                            backgroundColor: '#F1F5F9',
                            border: '1px solid #E2E8F0',
                            color: '#475569',
                            fontSize: 10,
                            fontWeight: 700,
                            fontFamily: FONT,
                          }}
                        >
                          {displayed.length}
                        </span>
                      )}
                      {/* Notification routing tooltip */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="shrink-0 flex items-center justify-center cursor-help">
                            <Info style={{ width: 13, height: 13, color: '#94A3B8' }} />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" style={{ maxWidth: 340 }}>
                          <p style={{ fontSize: 12, lineHeight: 1.6, fontFamily: FONT, whiteSpace: 'pre-line' }}>{slot.tooltip}</p>
                        </TooltipContent>
                      </Tooltip>
                      {/* Data-only wiring pill — Purchasing + Finance only */}
                      {slot.wiringNote && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span
                              className="inline-flex items-center gap-1 cursor-help"
                              style={{
                                height: 18,
                                padding: '0 6px',
                                borderRadius: 9999,
                                backgroundColor: '#F1F5F9',
                                color: '#64748B',
                                fontSize: 10,
                                fontWeight: 600,
                                fontFamily: FONT,
                                letterSpacing: 0.2,
                                border: '0.75px solid #E2E8F0',
                              }}
                            >
                              <Info style={{ width: 10, height: 10 }} />
                              Data only
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" style={{ maxWidth: 320 }}>
                            <p style={{ fontSize: 12, lineHeight: 1.6, fontFamily: FONT }}>{slot.wiringNote}</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                      {/* Inherited badge */}
                      {isInherited && (
                        <span
                          className="inline-flex items-center"
                          style={{
                            height: 18,
                            padding: '0 6px',
                            borderRadius: 9999,
                            backgroundColor: '#FEF3C7',
                            color: '#92400E',
                            border: '0.75px solid #FDE68A',
                            fontSize: 10,
                            fontWeight: 600,
                            fontFamily: FONT,
                            letterSpacing: 0.2,
                          }}
                        >
                          Inherited
                        </span>
                      )}
                    </div>

                    {showAddButton && (
                      <Popover
                        open={isDropdownOpen}
                        onOpenChange={(open) => {
                          if (open) {
                            setActiveDropdown(slot.key);
                            setDropdownSearch('');
                          } else {
                            setActiveDropdown(null);
                          }
                        }}
                      >
                        <PopoverTrigger asChild>
                          <button
                            className="inline-flex items-center gap-1 transition-colors hover:brightness-95"
                            style={{
                              height: 26,
                              padding: '0 8px',
                              borderRadius: 6,
                              backgroundColor: '#EFF6FF',
                              border: '1px solid #BFDBFE',
                              color: '#1E40AF',
                              fontSize: 11,
                              fontWeight: 600,
                              fontFamily: FONT,
                            }}
                          >
                            <Plus style={{ width: 12, height: 12 }} />
                            {slot.variant === 'single' && displayed.length === 0 ? 'Assign' : 'Add'}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent
                          side="bottom"
                          align="end"
                          sideOffset={6}
                          className="p-0 z-[100]"
                          style={{ width: 280 }}
                        >
                          <PickerDropdownBody
                            suggested={suggested}
                            others={others}
                            search={dropdownSearch}
                            onSearch={setDropdownSearch}
                            onPick={(uid) => {
                              addOwnerWithPromote(slot, uid);
                              if (slot.variant === 'single') setActiveDropdown(null);
                            }}
                          />
                        </PopoverContent>
                      </Popover>
                    )}
                  </div>

                  {/* Body */}
                  <div style={{ padding: '12px 14px' }}>
                    {isEmpty ? (
                      <div
                        className="flex items-center justify-center"
                        style={{
                          minHeight: 44,
                          borderRadius: 8,
                          border: '1px dashed #E2E8F0',
                          backgroundColor: '#FAFBFC',
                          color: '#94A3B8',
                          fontSize: 12,
                          fontFamily: FONT,
                        }}
                      >
                        No one assigned
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {displayed.map((userId: string) => {
                          const user: any = MOCK_USERS.find((u: any) => u.id === userId);
                          if (!user) return null;
                          const lacks = userLacksSlotPermission(userId, slot);
                          // Single-user slot's chip is also a replace trigger.
                          const isSingleReplace = slot.variant === 'single';
                          const chipInner = (
                            <div
                              className="flex items-center gap-1.5 pl-1 pr-1 transition-colors"
                              style={{
                                height: 28,
                                borderRadius: 9999,
                                background: '#F8FAFC',
                                border: isInherited ? '0.75px dashed #CBD5E1' : '0.75px solid #E2E8F0',
                              }}
                            >
                              <InitialAvatar name={user.name} size="sm" className="!w-5 !h-5" />
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 500,
                                  color: '#0F172A',
                                  fontFamily: FONT,
                                  paddingRight: 2,
                                }}
                              >
                                {user.name.split(' ')[0]}
                              </span>
                              {lacks && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="shrink-0 flex items-center justify-center cursor-help" style={{ width: 14, height: 14 }}>
                                      <AlertTriangle style={{ width: 12, height: 12, color: AMBER }} />
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" style={{ maxWidth: 280 }}>
                                    <p style={{ fontSize: 12, lineHeight: 1.5, fontFamily: FONT }}>
                                      {user.name} lacks {slot.label} permissions. Assignment is allowed but they will not see related tasks until permissions are granted.
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeOwnerWithPromote(slot, userId);
                                }}
                                className="flex items-center justify-center hover:bg-foreground/10 transition-colors"
                                style={{ width: 16, height: 16, borderRadius: 9999 }}
                                aria-label={`Remove ${user.name}`}
                              >
                                <X style={{ width: 10, height: 10, color: '#71717A' }} />
                              </button>
                            </div>
                          );

                          if (isSingleReplace) {
                            return (
                              <Popover
                                key={userId}
                                open={isDropdownOpen}
                                onOpenChange={(open) => {
                                  if (open) {
                                    setActiveDropdown(slot.key);
                                    setDropdownSearch('');
                                  } else {
                                    setActiveDropdown(null);
                                  }
                                }}
                              >
                                <PopoverTrigger asChild>
                                  <button className="cursor-pointer" title="Click to replace">
                                    {chipInner}
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent
                                  side="bottom"
                                  align="start"
                                  sideOffset={6}
                                  className="p-0 z-[100]"
                                  style={{ width: 280 }}
                                >
                                  <PickerDropdownBody
                                    suggested={suggested}
                                    others={others}
                                    search={dropdownSearch}
                                    onSearch={setDropdownSearch}
                                    onPick={(uid) => {
                                      addOwnerWithPromote(slot, uid);
                                      setActiveDropdown(null);
                                    }}
                                  />
                                </PopoverContent>
                              </Popover>
                            );
                          }
                          return <React.Fragment key={userId}>{chipInner}</React.Fragment>;
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </ConfigCard>
      </div>
    </TooltipProvider>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   PickerDropdownBody — internal user picker body. Mounted inside a Radix
   Popover (portaled, floating). Single search input filters both
   "Suggested" (slot-permission match) and "All people" groups in place.
   ───────────────────────────────────────────────────────────────────── */
function PickerDropdownBody({
  suggested,
  others,
  search,
  onSearch,
  onPick,
}: {
  suggested: any[];
  others: any[];
  search: string;
  onSearch: (s: string) => void;
  onPick: (userId: string) => void;
}) {
  return (
    <div style={{ background: 'var(--card)', borderRadius: 6, overflow: 'hidden' }}>
        <div className="px-3 py-2" style={{ borderBottom: '0.75px solid var(--border)' }}>
          <input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search people..."
            className="w-full outline-none bg-transparent"
            style={{ height: 30, fontSize: 12, fontFamily: FONT, color: 'var(--foreground)' }}
            autoFocus
          />
        </div>
        <div style={{ maxHeight: 320, overflowY: 'auto' }}>
          {suggested.length > 0 && (
            <>
              <div
                className="px-3 pt-2 pb-1"
                style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.6, color: '#94A3B8', textTransform: 'uppercase', fontFamily: FONT }}
              >
                Suggested
              </div>
              {suggested.map((u: any) => (
                <PickerRow key={u.id} user={u} onPick={() => onPick(u.id)} />
              ))}
            </>
          )}
          {others.length > 0 && (
            <>
              <div
                className="px-3 pt-2 pb-1"
                style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.6, color: '#94A3B8', textTransform: 'uppercase', fontFamily: FONT }}
              >
                All people
              </div>
              {others.map((u: any) => (
                <PickerRow key={u.id} user={u} onPick={() => onPick(u.id)} />
              ))}
            </>
          )}
          {suggested.length === 0 && others.length === 0 && (
            <div className="flex items-center justify-center py-4" style={{ fontSize: 12, color: '#71717A', fontFamily: FONT }}>
              No results
            </div>
          )}
        </div>
    </div>
  );
}

function PickerRow({ user, onPick }: { user: any; onPick: () => void }) {
  return (
    <button
      onClick={onPick}
      className="flex items-center gap-3 w-full px-3 transition-colors"
      style={{ height: 48, fontSize: 12, fontFamily: FONT }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'var(--secondary)')}
      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
    >
      <InitialAvatar name={user.name} size="sm" />
      <div className="text-left flex-1 min-w-0">
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)', lineHeight: '16px' }}>{user.name}</div>
        <div style={{ fontSize: 11, color: '#71717A', lineHeight: '14px' }}>{user.role}</div>
      </div>
    </button>
  );
}
