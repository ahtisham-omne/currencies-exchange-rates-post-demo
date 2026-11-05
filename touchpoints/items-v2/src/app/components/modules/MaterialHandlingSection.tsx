// @ts-nocheck
/**
 * MaterialHandlingSection — full 1:1 migration of Category's CycleCountingSection
 * (Cycle Counting + Scan Enforcement) from `ConfigureCategory.tsx`.
 *
 * Pulled verbatim from Category: CfgField, ToggleSwitch, CheckboxControl,
 * MOCK_APPROVERS, the variance slider, the portaled approver dropdown, and the
 * scan-enforcement rows. Only the data binding (config / onConfigChange) and the
 * card shell (Items' ConfigCard — visually identical to Category's) are adapted.
 */
import React, { useState, useRef, useLayoutEffect, useEffect, useContext } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search, X, ScanLine, ClipboardList, Info, Check } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { ConfigCard } from './CreateItemModal';
import { ConfigEditContext } from './configAtoms';
import type { AdvancedConfig } from './ItemConfigurationMaster';

const FONT = 'Inter, system-ui, sans-serif';

/* Approver list — pulled 1:1 from Category's ConfigureCategory MOCK_APPROVERS. */
export const MOCK_APPROVERS = [
  { name: 'Ahtsham Ahmad', initials: 'AA', color: '#0A77FF', role: 'Senior Inventory Manager' },
  { name: 'Faizan Khan', initials: 'FK', color: '#059669', role: 'Category Lead' },
  { name: 'Areeb Tanveer', initials: 'AT', color: '#7C3AED', role: 'Warehouse Supervisor' },
  { name: 'Nophil Anwer', initials: 'NA', color: '#D97706', role: 'Inventory Analyst' },
  { name: 'Irtaza Abid', initials: 'IA', color: '#DC2626', role: 'Supply Chain Coordinator' },
  { name: 'Eli Rosenbloom', initials: 'ER', color: '#059669', role: 'Distribution Manager' },
  { name: 'Sarah Chen', initials: 'SC', color: '#6366F1', role: 'Operations Director' },
  { name: 'James Wilson', initials: 'JW', color: '#0891B2', role: 'Procurement Manager' },
];

/* CfgField — verbatim from Category, now wired to the shared ConfigEditContext
   so per-field "Modified" badge + "Revert" link appear in the create/edit modal
   (no-op on the detail page, which mounts no provider). */
function CfgField({ label, hint, tooltip, children, fieldKey }: { label: React.ReactNode; hint?: string; tooltip?: string; children: React.ReactNode; fieldKey?: string }) {
  const editCtx = useContext(ConfigEditContext);
  const isModified = !!fieldKey && !!editCtx && editCtx.modifiedKeys.has(fieldKey);
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-1.5">
        <span style={{ fontSize: '14px', fontWeight: 600, color: '#0F172A', fontFamily: FONT, letterSpacing: '-0.1px' }}>{label}</span>
        {tooltip && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="shrink-0 flex items-center justify-center cursor-help">
                <Info style={{ width: 13, height: 13, color: '#94A3B8' }} />
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" style={{ maxWidth: 340 }}>
              <p style={{ fontSize: 12, lineHeight: 1.6, fontFamily: FONT, whiteSpace: 'pre-line' }}>{tooltip}</p>
            </TooltipContent>
          </Tooltip>
        )}
        {isModified && (
          <>
            <span style={{ fontSize: 10, fontWeight: 600, fontFamily: FONT, letterSpacing: 0.2, color: '#92400E', backgroundColor: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 9999, padding: '1px 6px', lineHeight: 1.3 }}>
              Modified
            </span>
            <button
              type="button"
              onClick={() => editCtx!.onRevertField(fieldKey!)}
              className="inline-flex items-center transition-colors"
              style={{ fontSize: 11, fontWeight: 500, fontFamily: FONT, color: '#B45309', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2 }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#92400E'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#B45309'; }}
            >
              Revert
            </button>
          </>
        )}
      </div>
      {hint && <span style={{ fontSize: '12px', fontWeight: 400, color: '#64748B', fontFamily: FONT, lineHeight: 1.4, marginTop: '4px' }}>{hint}</span>}
      {children}
    </div>
  );
}

/* ToggleSwitch — verbatim from Category. */
function ToggleSwitch({ checked, onChange, disabled }: { checked: boolean; onChange: (c: boolean) => void; disabled?: boolean }) {
  return (
    <button
      onClick={() => { if (!disabled) onChange(!checked); }}
      disabled={disabled}
      className="relative shrink-0 transition-colors"
      style={{
        width: '40px',
        height: '22px',
        borderRadius: '11px',
        backgroundColor: checked && !disabled ? 'hsl(var(--primary))' : 'hsl(var(--border))',
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      <div className="absolute bg-white rounded-full shadow-sm" style={{ width: '18px', height: '18px', top: '2px', left: checked ? '20px' : '2px', transition: 'left 0.15s ease' }} />
    </button>
  );
}

/* CheckboxControl — verbatim from Category. */
function CheckboxControl({ checked, onChange }: { checked: boolean; onChange: (c: boolean) => void }) {
  return (
    <button onClick={() => onChange(!checked)} className="shrink-0 flex items-center justify-center transition-colors" style={{ width: '16px', height: '16px', borderRadius: '4px', border: checked ? 'none' : '1.5px solid hsl(var(--border))', backgroundColor: checked ? 'hsl(var(--primary))' : 'transparent' }}>
      {checked && <Check style={{ width: '12px', height: '12px', color: 'white' }} />}
    </button>
  );
}

interface MaterialHandlingSectionProps {
  config: AdvancedConfig;
  onConfigChange: (key: keyof AdvancedConfig, value: any) => void;
}

export function MaterialHandlingSection({ config, onConfigChange }: MaterialHandlingSectionProps) {
  // Alias so the ported Category body reads verbatim.
  const updateConfig = onConfigChange;

  const [approverOpen, setApproverOpen] = useState(false);
  const [approverSearch, setApproverSearch] = useState('');
  const selectedApprovers = config.approvers ?? [];
  const approverBtnRef = useRef<HTMLButtonElement>(null);
  const [approverRect, setApproverRect] = useState<{ top: number; left: number; width: number } | null>(null);

  const scanLocation = !!config.scanLocation;
  const scanItem = !!config.scanItem;
  const scanLot = !!config.scanLot;
  const scanSerial = !!config.scanSerial;
  const setScanLocation = (v: boolean) => updateConfig('scanLocation', v);
  const setScanItem = (v: boolean) => updateConfig('scanItem', v);
  const setScanLot = (v: boolean) => updateConfig('scanLot', v);
  const setScanSerial = (v: boolean) => updateConfig('scanSerial', v);
  const isSerialized = config.controlType === 'Serialized';
  // Auto-disable serial scan when control type is non-serialized.
  useEffect(() => {
    if (!isSerialized && scanSerial) updateConfig('scanSerial', false);
  }, [isSerialized, scanSerial]);

  const filteredApprovers = MOCK_APPROVERS.filter(a =>
    a.name.toLowerCase().includes(approverSearch.toLowerCase()) && !selectedApprovers.includes(a.name)
  );

  useLayoutEffect(() => {
    if (!approverOpen) return;
    const update = () => {
      const el = approverBtnRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setApproverRect({ top: r.bottom + 4, left: r.left, width: r.width });
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [approverOpen]);

  const removeApprover = (name: string) => updateConfig('approvers', selectedApprovers.filter(n => n !== name));
  const addApprover = (name: string) => updateConfig('approvers', selectedApprovers.includes(name) ? selectedApprovers : [...selectedApprovers, name]);

  const tolerance = config.cycleTolerance ?? config.cycleDeviation ?? '0';

  const scanRows = [
    { label: 'Location Scan', desc: 'Require location barcode scan before proceeding', checked: scanLocation, onChange: setScanLocation, disabled: false },
    { label: 'Item / Part Number Scan', desc: 'Require item barcode scan for identification', checked: scanItem, onChange: setScanItem, disabled: false },
    { label: 'Lot Control Scan', desc: 'Require lot number barcode scan for lot-tracked items', checked: scanLot, onChange: setScanLot, disabled: false },
    { label: 'Serial Scan', desc: isSerialized ? 'Require serial number scan for serialized items' : 'Available only when Control Type is Serialized', checked: isSerialized && scanSerial, onChange: setScanSerial, disabled: !isSerialized },
  ];

  return (
    <TooltipProvider delayDuration={300}>
      <div className="grid grid-cols-2 gap-6 animate-in fade-in duration-500" style={{ alignItems: 'start', width: '100%' }}>
        {/* CYCLE COUNTING */}
        <ConfigCard icon={ClipboardList} title="Cycle Counting">
          <div className="flex flex-col gap-6">
            {/* Acceptable Variance */}
            <CfgField
              label="Acceptable Variance (%)"
              fieldKey="cycleTolerance"
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
                    if (val === '' || parseFloat(val) >= 0) updateConfig('cycleTolerance', val);
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
            <CfgField label="Approver" fieldKey="approvers" hint="Select who can approve adjustments when variance exceeds the threshold.">
              <div className="relative mt-2">
                <button
                  ref={approverBtnRef}
                  onClick={() => setApproverOpen(!approverOpen)}
                  className="flex items-center justify-between w-full bg-background border border-border px-3"
                  style={{ height: 40, borderRadius: 'var(--radius)', fontSize: 13, fontFamily: FONT, color: selectedApprovers.length > 0 ? 'hsl(var(--foreground))' : '#9CA3AF' }}
                >
                  {selectedApprovers.length > 0 ? `${selectedApprovers.length} approver${selectedApprovers.length > 1 ? 's' : ''} selected` : 'Select approvers...'}
                  <ChevronDown style={{ width: 14, height: 14, opacity: 0.5 }} />
                </button>
                {approverOpen && approverRect && createPortal(
                  <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={() => setApproverOpen(false)} />
                    <div style={{ position: 'fixed', top: approverRect.top, left: approverRect.left, width: approverRect.width, zIndex: 9999, background: 'hsl(var(--card))', border: '0.75px solid hsl(var(--border))', borderRadius: 10, boxShadow: '0 8px 24px -8px rgba(15,23,42,0.18), 0 2px 6px -2px rgba(15,23,42,0.08)', overflow: 'hidden' }}>
                      <div className="sticky top-0 z-10 p-2" style={{ borderBottom: '0.75px solid hsl(var(--border))', background: 'hsl(var(--card))' }}>
                        <div className="relative">
                          <Search style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: '#9CA3AF' }} />
                          <input value={approverSearch} onChange={e => setApproverSearch(e.target.value)} placeholder="Search approvers..." className="w-full outline-none bg-transparent pl-8" style={{ height: 32, fontSize: 12, fontFamily: FONT }} autoFocus />
                        </div>
                      </div>
                      <div style={{ maxHeight: 5 * 48, overflowY: 'auto' }}>
                        {filteredApprovers.map(u => (
                          <button
                            key={u.name}
                            onClick={() => addApprover(u.name)}
                            className="flex items-center gap-3 w-full px-3 transition-colors"
                            style={{ height: 48, fontSize: 12, fontFamily: FONT }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'hsl(var(--secondary))')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                          >
                            <CheckboxControl checked={false} onChange={() => addApprover(u.name)} />
                            <div className="flex items-center justify-center shrink-0" style={{ width: 28, height: 28, borderRadius: 6, background: u.color, fontSize: 10, fontWeight: 600, color: 'white' }}>{u.initials}</div>
                            <div className="text-left flex-1 min-w-0">
                              <div style={{ fontSize: 13, fontWeight: 500, color: 'hsl(var(--foreground))', lineHeight: '16px' }}>{u.name}</div>
                              <div style={{ fontSize: 11, color: '#71717A', lineHeight: '14px' }}>{u.role}</div>
                            </div>
                          </button>
                        ))}
                        {filteredApprovers.length === 0 && (
                          <div className="flex items-center justify-center py-4" style={{ fontSize: 12, color: '#71717A', fontFamily: FONT }}>No results</div>
                        )}
                      </div>
                    </div>
                  </>,
                  document.body
                )}
              </div>
              {/* Selected approver chips. Hidden while the dropdown is open: the
                  config renders inside a Radix Dialog whose stacking lets the chips
                  bleed over the portaled menu, so we hide them to reproduce
                  Category's clean open-state look (chips return on close). */}
              {selectedApprovers.length > 0 && !approverOpen && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedApprovers.map(name => {
                    const user = MOCK_APPROVERS.find(u => u.name === name);
                    return (
                      <div key={name} className="flex items-center gap-1.5 pl-1.5 pr-1" style={{ height: 28, borderRadius: 9999, background: 'hsl(var(--secondary))', border: '0.75px solid hsl(var(--border))' }}>
                        <div className="flex items-center justify-center shrink-0" style={{ width: 20, height: 20, borderRadius: 5, background: user?.color || '#94A3B8', fontSize: 8, fontWeight: 600, color: 'white' }}>{user?.initials || '?'}</div>
                        <span style={{ fontSize: 11, fontWeight: 500, color: 'hsl(var(--foreground))', fontFamily: FONT }}>{name.split(' ')[0]}</span>
                        <button onClick={() => removeApprover(name)} className="flex items-center justify-center hover:bg-foreground/10 transition-colors" style={{ width: 16, height: 16, borderRadius: 9999 }}>
                          <X style={{ width: 10, height: 10, color: '#71717A' }} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </CfgField>
          </div>
        </ConfigCard>

        {/* SCAN ENFORCEMENT */}
        <ConfigCard icon={ScanLine} title="Scan Enforcement">
          <div className="flex flex-col">
            <p style={{ fontSize: 12, color: '#64748B', fontFamily: FONT, lineHeight: 1.5, marginBottom: 16 }}>
              Control whether barcode scanning is disabled or enabled during cycle counting, inventory movements, and picking. These can be activated per category as barcoding is deployed across your facility.
            </p>
            {scanRows.map((row, idx, arr) => (
              <div
                key={row.label}
                className="flex items-center justify-between py-4"
                style={{ borderBottom: idx < arr.length - 1 ? '1px solid hsl(var(--border))' : 'none', opacity: row.disabled ? 0.6 : 1 }}
              >
                <div className="flex flex-col">
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'hsl(var(--foreground))', fontFamily: FONT }}>{row.label}</span>
                  <span style={{ fontSize: 12, color: '#64748B', fontFamily: FONT, marginTop: 2 }}>{row.desc}</span>
                </div>
                <div className="flex items-center gap-2">
                  <ToggleSwitch checked={row.checked} onChange={row.onChange} disabled={row.disabled} />
                </div>
              </div>
            ))}
          </div>
        </ConfigCard>
      </div>
    </TooltipProvider>
  );
}
