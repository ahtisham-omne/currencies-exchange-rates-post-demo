// @ts-nocheck
/**
 * configAtoms — small Category-literal helper components shared by the
 * Item Definition + Stock & Logistics tab content bodies. Lifted verbatim from
 * Category project (edda1394-233a-42be-be90-58ae0a04db60)
 * src/app/components/ConfigureCategory.tsx — Slice Pair A.
 *
 * Why local: these are 4 tiny presentation helpers used in two adjacent files.
 * Forking them into ui/ atoms would muddy the design system (per Atomic Design
 * memory) since they're Category-specific visual treatments, not project-wide.
 */
import React, { useState } from 'react';
import { Plus, Minus, Info, Check, ChevronDown, Search, Star } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { Popover, PopoverTrigger, PopoverContent } from '../ui/popover';

const FONT = 'Inter, system-ui, sans-serif';

/* ── CfgField — label + hint + optional info tooltip wrapper ── */
export function CfgField({ label, hint, tooltip, children }: { label: React.ReactNode; hint?: string; tooltip?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-1.5">
        <span style={{ fontSize: '12px', fontWeight: 500, color: '#475569', fontFamily: FONT }}>{label}</span>
        {tooltip && (
          <TooltipProvider delayDuration={200}>
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
          </TooltipProvider>
        )}
      </div>
      {hint && <span style={{ fontSize: '11px', fontWeight: 400, color: '#94A3B8', fontFamily: FONT, lineHeight: 1.4, marginTop: '2px' }}>{hint}</span>}
      {children}
    </div>
  );
}

/* ── RadioOption — single-line radio row used inside Lot Tracking sub-fields ── */
export function RadioOption({ selected, onSelect, label, desc }: { selected: boolean; onSelect: () => void; label: string; desc: string }) {
  return (
    <button
      onClick={onSelect}
      className={`group relative rounded-xl overflow-hidden border transition-all duration-200 w-full text-left ${
        selected
          ? 'border-[#93C5FD]/70 bg-[#EFF6FF] shadow-[0_1px_4px_rgba(10,119,255,0.06)]'
          : 'border-[#E2E8F0] bg-white hover:border-[#BFDBFE] hover:bg-[#F8FAFF]'
      }`}
    >
      <div className="relative flex items-center gap-3 p-3.5">
        <div className="w-[18px] h-[18px] rounded-full flex items-center justify-center shrink-0 transition-all duration-200" style={{
          border: selected ? '2px solid #3B82F6' : '1.5px solid #D1D5DB',
          backgroundColor: 'white',
        }}>
          {selected && <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#3B82F6' }} />}
        </div>
        <div className="flex flex-col">
          <span className="text-[13px] font-medium text-[#0F172A]" style={{ fontFamily: FONT }}>{label}</span>
          <span className="text-[12px] text-[#94A3B8]" style={{ fontFamily: FONT }}>{desc}</span>
        </div>
      </div>
    </button>
  );
}

/* ── CheckboxControl — flat 16×16 box, primary fill when checked ── */
export function CheckboxControl({ checked, onChange }: { checked: boolean; onChange: (c: boolean) => void }) {
  return (
    <button onClick={() => onChange(!checked)} className="shrink-0 flex items-center justify-center transition-colors" style={{ width: '16px', height: '16px', borderRadius: '4px', border: checked ? 'none' : '1.5px solid var(--border)', backgroundColor: checked ? 'var(--primary)' : 'transparent' }}>
      {checked && <Check style={{ width: '12px', height: '12px', color: 'white' }} />}
    </button>
  );
}

/* ── StepperInput — − value + numeric stepper used by Stock Limits ── */
export function StepperInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const numVal = parseInt(value) || 0;
  return (
    <div className="flex items-center mt-2" style={{ borderRadius: 'var(--radius)', border: '1px solid var(--border)', overflow: 'hidden', height: 40 }}>
      <button
        onClick={() => onChange(String(Math.max(0, numVal - 1)))}
        className="flex items-center justify-center shrink-0 hover:opacity-80 transition-colors"
        style={{ width: 40, height: '100%', borderRight: '1px solid var(--border)', backgroundColor: '#F1F5F9' }}
      >
        <Minus style={{ width: 14, height: 14, color: '#64748B' }} />
      </button>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 bg-white text-foreground outline-none text-center"
        style={{ height: '100%', fontSize: 13, fontFamily: FONT, fontWeight: 500, minWidth: 0 }}
        placeholder={placeholder}
      />
      <button
        onClick={() => onChange(String(numVal + 1))}
        className="flex items-center justify-center shrink-0 hover:opacity-80 transition-colors"
        style={{ width: 40, height: '100%', borderLeft: '1px solid var(--border)', backgroundColor: '#F1F5F9' }}
      >
        <Plus style={{ width: 14, height: 14, color: '#64748B' }} />
      </button>
    </div>
  );
}

/* ── LocationMultiSelect — multi-select with searchable dropdown + chips with default Star ──
   Lifted verbatim from Category. Displays selected items as 30px chips below.
   Star toggles default-pin. Backed by simple string[] selected list. */
export function LocationMultiSelect({ label, tooltip, placeholder, options, selected, defaultValue, onToggle, onDefaultChange }: {
  label: string; tooltip?: string; placeholder: string; options: string[]; selected: string[]; defaultValue?: string;
  onToggle: (loc: string) => void; onDefaultChange: (loc: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const filtered = options.filter(o => o.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', fontFamily: FONT }}>{label}</span>
        {tooltip && (
          <TooltipProvider delayDuration={200}>
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
          </TooltipProvider>
        )}
      </div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button className="flex items-center justify-between w-full bg-background border border-border px-3" style={{ height: 40, borderRadius: 'var(--radius)', fontSize: 13, fontFamily: FONT, color: selected.length > 0 ? 'var(--foreground)' : '#9CA3AF' }}>
            {selected.length > 0 ? (selected.length === 1 ? selected[0] : `${selected[0]} +${selected.length - 1} more`) : placeholder}
            <ChevronDown style={{ width: 14, height: 14, opacity: 0.5 }} />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={4}
          collisionPadding={8}
          avoidCollisions={true}
          className="p-0 w-[--radix-popover-trigger-width] bg-card"
          style={{ border: '0.75px solid var(--border)', borderRadius: 10, boxShadow: '0 4px 24px -4px rgba(0,0,0,0.15)', overflow: 'hidden', maxHeight: 220 }}
        >
          <div className="sticky top-0 z-10 p-2" style={{ borderBottom: '0.75px solid var(--border)', background: 'var(--card)' }}>
            <div className="relative">
              <Search style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: '#9CA3AF' }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="w-full outline-none bg-transparent pl-8" style={{ height: 32, fontSize: 12, fontFamily: FONT }} autoFocus />
            </div>
          </div>
          <div style={{ maxHeight: 170, overflowY: 'auto' }}>
            {filtered.map(loc => {
              const isSelected = selected.includes(loc);
              return (
                <div key={loc} onClick={() => onToggle(loc)} className="flex items-center gap-2 px-3 cursor-pointer transition-colors" style={{ height: 36, fontSize: 12, fontFamily: FONT }}
                  onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'var(--secondary)')}
                  onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
                >
                  <CheckboxControl checked={isSelected} onChange={() => onToggle(loc)} />
                  <span className="flex-1 truncate">{loc}</span>
                  {isSelected && <Check style={{ width: 12, height: 12, color: 'var(--primary)' }} />}
                </div>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
      {selected.length > 0 && (
        <div className="flex flex-col gap-1.5 mt-1">
          {selected.map(loc => {
            const isDefault = defaultValue === loc;
            return (
              <div key={loc} className="flex items-center gap-2 px-2.5"
                style={{
                  height: 30, borderRadius: 6, fontSize: 12, fontFamily: FONT,
                  border: isDefault ? '1px solid hsl(var(--primary) / 0.3)' : '1px solid var(--border)',
                  backgroundColor: isDefault ? 'hsl(var(--primary) / 0.04)' : 'var(--card)',
                }}
              >
                <button onClick={() => onDefaultChange(isDefault ? '' : loc)} className="shrink-0 flex items-center justify-center" style={{ width: 18, height: 18 }}>
                  <Star style={{
                    width: 14, height: 14,
                    color: isDefault ? '#0A77FF' : '#D1D5DB',
                    fill: isDefault ? '#0A77FF' : 'none',
                    cursor: 'pointer',
                  }} />
                </button>
                <span className="flex-1 truncate" style={{ fontWeight: isDefault ? 600 : 400, color: isDefault ? 'var(--foreground)' : '#475569' }}>{loc}</span>
                {isDefault && <span style={{ fontSize: 10, fontWeight: 600, color: '#0A77FF' }}>Default</span>}
                <button onClick={() => onToggle(loc)} className="shrink-0 flex items-center justify-center text-[#9CA3AF] hover:text-destructive transition-colors" style={{ width: 16, height: 16 }}>
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
