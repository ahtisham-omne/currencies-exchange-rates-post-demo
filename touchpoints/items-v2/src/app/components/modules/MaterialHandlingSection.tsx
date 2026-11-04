// @ts-nocheck
/**
 * MaterialHandlingSection — Cycle Counting + Scan Enforcement.
 * Lifted literally from Category project's CycleCountingSection
 * (src/app/components/ConfigureCategory.tsx, lines 2189-2361).
 *
 * MOCK_APPROVERS decision (Slice M.3): Items reuses its own MOCK_USERS shape
 * (id/name/role/initials/color) instead of forking. Adapted at use sites.
 *
 * Uses Items' atom components per Atomic Design memory:
 *   - Switch (instead of Category's ToggleSwitch)
 *   - Checkbox (instead of Category's CheckboxControl)
 *   - ConfigCard (Items' shell, visually matched to Category)
 */
import React, { useState } from 'react';
import { ChevronDown, Search, X, ScanLine, ClipboardList } from 'lucide-react';
import { Switch } from '../ui/switch';
import { Checkbox } from '../ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { Info } from 'lucide-react';
import { MOCK_USERS, ConfigCard } from './CreateItemModal';
import type { AdvancedConfig } from './ItemConfigurationMaster';

const FONT = 'Inter, system-ui, sans-serif';

// Field shell mirroring Category's CfgField
function CfgField({ label, hint, tooltip, children }: { label: React.ReactNode; hint?: string; tooltip?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-1.5">
        <label style={{ fontSize: 13, fontWeight: 600, color: '#0F172A', fontFamily: FONT }}>{label}</label>
        {tooltip && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="shrink-0 flex items-center justify-center cursor-help">
                <Info style={{ width: 12, height: 12, color: '#94A3B8' }} />
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" style={{ maxWidth: 340 }}>
              <p style={{ fontSize: 12, lineHeight: 1.6, fontFamily: FONT, whiteSpace: 'pre-line' }}>{tooltip}</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      {hint && (
        <span style={{ fontSize: 11, color: '#64748B', fontFamily: FONT, marginTop: 2 }}>{hint}</span>
      )}
      {children}
    </div>
  );
}

interface MaterialHandlingSectionProps {
  config: AdvancedConfig;
  onConfigChange: (key: keyof AdvancedConfig, value: any) => void;
}

export function MaterialHandlingSection({ config, onConfigChange }: MaterialHandlingSectionProps) {
  const [approverOpen, setApproverOpen] = useState(false);
  const [approverSearch, setApproverSearch] = useState('');

  const selectedApprovers = config.approvers || [];
  const filteredApprovers = MOCK_USERS.filter(u =>
    u.name.toLowerCase().includes(approverSearch.toLowerCase()) && !selectedApprovers.includes(u.name)
  );

  const removeApprover = (name: string) =>
    onConfigChange('approvers', selectedApprovers.filter(n => n !== name));
  const addApprover = (name: string) =>
    onConfigChange('approvers', [...selectedApprovers, name]);

  // Map Tailwind color tokens (e.g. "bg-blue-100 text-blue-700") to a single hex for chips
  const colorHex = (twClass: string): string => {
    if (twClass.includes('blue')) return '#0A77FF';
    if (twClass.includes('green')) return '#059669';
    if (twClass.includes('amber')) return '#D97706';
    if (twClass.includes('purple')) return '#7C3AED';
    if (twClass.includes('rose')) return '#E11D48';
    if (twClass.includes('cyan')) return '#0891B2';
    return '#94A3B8';
  };

  const tolerance = config.cycleTolerance ?? config.cycleDeviation ?? '0';

  const scanRows = [
    { key: 'scanLocation', label: 'Location Scan', desc: 'Require location barcode scan before proceeding' },
    { key: 'scanItem', label: 'Item / Part Number Scan', desc: 'Require item barcode scan for identification' },
    { key: 'scanLot', label: 'Lot Control Scan', desc: 'Require lot number barcode scan for lot-tracked items' },
    { key: 'scanSerial', label: 'Serial Scan', desc: 'Require serial number scan for serialized items' },
  ] as const;

  return (
    <TooltipProvider delayDuration={300}>
      <div className="grid grid-cols-2 gap-6 animate-in fade-in duration-500" style={{ alignItems: 'start', width: '100%' }}>
        {/* CYCLE COUNTING */}
        <ConfigCard icon={ClipboardList} title="Cycle Counting"><div className="flex flex-col gap-6">
          {/* Acceptable Variance */}
          <CfgField
            label="Acceptable Variance (%)"
            hint="Maximum allowed percentage difference (±) before requiring approval."
            tooltip="If the counted quantity differs from the system quantity by more than this percentage — in either direction — an approval is required before the adjustment is processed. Within the threshold, adjustments proceed without approval.&#10;&#10;EXAMPLE: 5% variance — a system quantity of 100 units would accept counts between 95 and 105 without requiring approval."
          >
            <div className="flex items-center gap-3 mt-2">
              <input
                type="number"
                min="0"
                value={tolerance}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '' || parseFloat(val) >= 0) onConfigChange('cycleTolerance', val);
                }}
                className="bg-background border border-border text-foreground outline-none px-3"
                style={{ height: 40, borderRadius: 'var(--radius)', fontSize: 13, fontFamily: FONT, width: 120 }}
                placeholder="0"
              />
              <span style={{ fontSize: 13, color: '#71717A', fontFamily: FONT }}>%</span>
            </div>
            {/* Gradient slider bar */}
            <div className="flex items-center gap-2 mt-3">
              <span style={{ fontSize: 10, fontWeight: 600, fontFamily: FONT, color: '#22C55E' }}>Tight</span>
              <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'linear-gradient(90deg, #22C55E 0%, #F59E0B 50%, #EF4444 100%)', overflow: 'hidden', position: 'relative' }}>
                <div style={{
                  position: 'absolute',
                  left: `${Math.min(100, Math.max(0, parseFloat(tolerance || '0') * 5))}%`,
                  top: -3,
                  width: 12, height: 12, borderRadius: '50%',
                  backgroundColor: 'white',
                  border: '2px solid ' + (parseFloat(tolerance || '0') <= 5 ? '#22C55E' : parseFloat(tolerance || '0') <= 10 ? '#F59E0B' : '#EF4444'),
                  transform: 'translateX(-50%)',
                  transition: 'left 0.3s',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                }} />
              </div>
              <span style={{ fontSize: 10, fontWeight: 600, fontFamily: FONT, color: '#EF4444' }}>Loose</span>
            </div>
          </CfgField>

          {/* Approver Selection */}
          <CfgField label="Approver" hint="Select who can approve adjustments when variance exceeds the threshold.">
            <div className="relative mt-2">
              <button
                onClick={() => setApproverOpen(!approverOpen)}
                className="flex items-center justify-between w-full bg-background border border-border px-3"
                style={{ height: 40, borderRadius: 'var(--radius)', fontSize: 13, fontFamily: FONT, color: selectedApprovers.length > 0 ? 'var(--foreground)' : '#9CA3AF' }}
              >
                {selectedApprovers.length > 0 ? `${selectedApprovers.length} approver${selectedApprovers.length > 1 ? 's' : ''} selected` : 'Select approvers...'}
                <ChevronDown style={{ width: 14, height: 14, opacity: 0.5 }} />
              </button>
              {approverOpen && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setApproverOpen(false)} />
                  <div className="absolute left-0 right-0 z-30" style={{ top: 'calc(100% + 4px)', background: 'var(--card)', border: '0.75px solid var(--border)', borderRadius: 10, boxShadow: '0 4px 24px -4px rgba(0,0,0,0.15)', overflow: 'hidden' }}>
                    <div className="sticky top-0 z-10 p-2" style={{ borderBottom: '0.75px solid var(--border)', background: 'var(--card)' }}>
                      <div className="relative">
                        <Search style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: '#9CA3AF' }} />
                        <input value={approverSearch} onChange={e => setApproverSearch(e.target.value)} placeholder="Search approvers..." className="w-full outline-none bg-transparent pl-8" style={{ height: 32, fontSize: 12, fontFamily: FONT }} autoFocus />
                      </div>
                    </div>
                    <div style={{ maxHeight: 5 * 48, overflowY: 'auto' }}>
                      {filteredApprovers.map(u => (
                        <button
                          key={u.id}
                          onClick={() => addApprover(u.name)}
                          className="flex items-center gap-3 w-full px-3 transition-colors hover:bg-secondary"
                          style={{ height: 48, fontSize: 12, fontFamily: FONT }}
                        >
                          <Checkbox checked={false} onCheckedChange={() => addApprover(u.name)} />
                          <div className="flex items-center justify-center shrink-0" style={{ width: 28, height: 28, borderRadius: 6, background: colorHex(u.color), fontSize: 10, fontWeight: 600, color: 'white' }}>{u.initials}</div>
                          <div className="text-left flex-1 min-w-0">
                            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)', lineHeight: '16px' }}>{u.name}</div>
                            <div style={{ fontSize: 11, color: '#71717A', lineHeight: '14px' }}>{u.role}</div>
                          </div>
                        </button>
                      ))}
                      {filteredApprovers.length === 0 && (
                        <div className="flex items-center justify-center py-4" style={{ fontSize: 12, color: '#71717A', fontFamily: FONT }}>No results</div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
            {/* Selected approver chips */}
            {selectedApprovers.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {selectedApprovers.map(name => {
                  const user = MOCK_USERS.find(u => u.name === name);
                  return (
                    <div key={name} className="flex items-center gap-1.5 pl-1.5 pr-1" style={{ height: 28, borderRadius: 9999, background: 'var(--secondary)', border: '0.75px solid var(--border)' }}>
                      <div className="flex items-center justify-center shrink-0" style={{ width: 20, height: 20, borderRadius: 5, background: colorHex(user?.color || ''), fontSize: 8, fontWeight: 600, color: 'white' }}>{user?.initials || '?'}</div>
                      <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--foreground)', fontFamily: FONT }}>{name.split(' ')[0]}</span>
                      <button onClick={() => removeApprover(name)} className="flex items-center justify-center hover:bg-foreground/10 transition-colors" style={{ width: 16, height: 16, borderRadius: 9999 }}>
                        <X style={{ width: 10, height: 10, color: '#71717A' }} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </CfgField>
        </div></ConfigCard>

        {/* SCAN ENFORCEMENT */}
        <ConfigCard icon={ScanLine} title="Scan Enforcement">
          <div className="flex flex-col">
            <p style={{ fontSize: 12, color: '#64748B', fontFamily: FONT, lineHeight: 1.5, marginBottom: 16 }}>
              Control whether barcode scanning is required or optional during cycle counting, inventory movements, and picking. These can be activated per category as barcoding is deployed across your facility.
            </p>
            {scanRows.map((row, idx, arr) => {
              const checked = !!config[row.key];
              return (
                <div
                  key={row.key}
                  className="flex items-center justify-between py-4"
                  style={{ borderBottom: idx < arr.length - 1 ? '1px solid var(--border)' : 'none' }}
                >
                  <div className="flex flex-col">
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', fontFamily: FONT }}>{row.label}</span>
                    <span style={{ fontSize: 12, color: '#64748B', fontFamily: FONT, marginTop: 2 }}>{row.desc}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span style={{ fontSize: 11, fontWeight: 500, color: checked ? 'var(--primary)' : '#94A3B8', fontFamily: FONT }}>
                      {checked ? 'Required' : 'Optional'}
                    </span>
                    <Switch checked={checked} onCheckedChange={(c) => onConfigChange(row.key as keyof AdvancedConfig, c)} />
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
