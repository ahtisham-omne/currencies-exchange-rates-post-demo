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
import React, { useState, useContext, createContext } from 'react';
import { Plus, Minus, Info, Check, ChevronDown, ChevronRight, ChevronLeft, Search, Star, Lock } from 'lucide-react';
import type { ItemFieldLocks } from './itemFieldLocks';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { Popover, PopoverTrigger, PopoverContent } from '../ui/popover';

const FONT = 'Inter, system-ui, sans-serif';

/* ── Edit-tracking context (Category parity) ──────────────────────────────
   Surfaces per-field "Modified" badges + "Revert" links inside CfgField when
   the configurator is rendered inside an edit/create modal that provides a
   baseline diff. Detail-page renders simply omit the provider (no badges).
   Field keys are plain strings so this module stays decoupled from the
   AdvancedConfig type (avoids a circular import with ItemConfigurationMaster). */
export interface ConfigEditContextValue {
  /** Keys whose current value differs from the baseline snapshot. */
  modifiedKeys: Set<string>;
  /** Restore a single field to its baseline value. */
  onRevertField: (key: string) => void;
  /** When true the configurator is display-only (detail page). */
  readOnly?: boolean;
  /** Per-field lock/one-way descriptors (edit mode only — see itemFieldLocks). */
  fieldLocks?: ItemFieldLocks;
}
export const ConfigEditContext = createContext<ConfigEditContextValue | null>(null);

/* ── UOM abbreviation map (Category-literal) ── */
/* ── Expanded UOM canonical table.
   Each unit declares its category, conversion factor against the canonical
   base of that category, an abbreviation, and a `type` ("standard" or
   "custom"). Standard units are SI / common engineering units; Custom units
   are packaging or business-defined containers with no universal ratio. ── */
const UOM_CANONICAL: Record<string, { category: string; factor: number; abbrev: string; type: 'standard' | 'custom' }> = {
  // Length — canonical: Meter
  Meter:        { category: 'Length', factor: 1,        abbrev: 'M',   type: 'standard' },
  Kilometer:    { category: 'Length', factor: 1000,     abbrev: 'KM',  type: 'standard' },
  Centimeter:   { category: 'Length', factor: 0.01,     abbrev: 'CM',  type: 'standard' },
  Millimeter:   { category: 'Length', factor: 0.001,    abbrev: 'MM',  type: 'standard' },
  Inch:         { category: 'Length', factor: 0.0254,   abbrev: 'IN',  type: 'standard' },
  Foot:         { category: 'Length', factor: 0.3048,   abbrev: 'FT',  type: 'standard' },
  Yard:         { category: 'Length', factor: 0.9144,   abbrev: 'YD',  type: 'standard' },
  Mile:         { category: 'Length', factor: 1609.344, abbrev: 'MI',  type: 'standard' },

  // Volume — canonical: Liter
  Liter:        { category: 'Volume', factor: 1,           abbrev: 'L',     type: 'standard' },
  Milliliter:   { category: 'Volume', factor: 0.001,       abbrev: 'ML',    type: 'standard' },
  Gallon:       { category: 'Volume', factor: 3.785411784, abbrev: 'GAL',   type: 'standard' },
  Quart:        { category: 'Volume', factor: 0.946352946, abbrev: 'QT',    type: 'standard' },
  Pint:         { category: 'Volume', factor: 0.473176473, abbrev: 'PT',    type: 'standard' },
  'Cubic Meter':{ category: 'Volume', factor: 1000,        abbrev: 'M³',    type: 'standard' },
  'Cubic Foot': { category: 'Volume', factor: 28.3168466,  abbrev: 'FT³',   type: 'standard' },
  'Fluid Ounce':{ category: 'Volume', factor: 0.0295735296,abbrev: 'FL OZ', type: 'standard' },

  // Mass — canonical: Kilogram
  Kilogram:     { category: 'Mass', factor: 1,         abbrev: 'KG', type: 'standard' },
  Gram:         { category: 'Mass', factor: 0.001,     abbrev: 'G',  type: 'standard' },
  Milligram:    { category: 'Mass', factor: 0.000001,  abbrev: 'MG', type: 'standard' },
  'Metric Ton': { category: 'Mass', factor: 1000,      abbrev: 'MT', type: 'standard' },
  Pound:        { category: 'Mass', factor: 0.45359237,abbrev: 'LB', type: 'standard' },
  Ounce:        { category: 'Mass', factor: 0.0283495231, abbrev: 'OZ', type: 'standard' },

  // Quantity — canonical: Each
  Each:         { category: 'Quantity', factor: 1,    abbrev: 'EA', type: 'standard' },
  Dozen:        { category: 'Quantity', factor: 12,   abbrev: 'DZ', type: 'standard' },
  Hundred:      { category: 'Quantity', factor: 100,  abbrev: 'C',  type: 'standard' },
  Thousand:     { category: 'Quantity', factor: 1000, abbrev: 'M',  type: 'standard' },
  Pair:         { category: 'Quantity', factor: 2,    abbrev: 'PR', type: 'standard' },

  // Area — canonical: Square Meter
  'Square Meter': { category: 'Area', factor: 1,           abbrev: 'M²',  type: 'standard' },
  'Square Foot':  { category: 'Area', factor: 0.09290304,  abbrev: 'FT²', type: 'standard' },
  'Square Yard':  { category: 'Area', factor: 0.83612736,  abbrev: 'YD²', type: 'standard' },
  Acre:           { category: 'Area', factor: 4046.8564224,abbrev: 'AC',  type: 'standard' },
  Hectare:        { category: 'Area', factor: 10000,       abbrev: 'HA',  type: 'standard' },

  // Time — canonical: Second
  Second:       { category: 'Time', factor: 1,        abbrev: 'S',   type: 'standard' },
  Minute:       { category: 'Time', factor: 60,       abbrev: 'MIN', type: 'standard' },
  Hour:         { category: 'Time', factor: 3600,     abbrev: 'HR',  type: 'standard' },
  Day:          { category: 'Time', factor: 86400,    abbrev: 'D',   type: 'standard' },
  Week:         { category: 'Time', factor: 604800,   abbrev: 'WK',  type: 'standard' },
  Month:        { category: 'Time', factor: 2629800,  abbrev: 'MO',  type: 'standard' },

  // Temperature — no linear ratio; skip auto-fill
  Celsius:      { category: 'Temperature', factor: NaN, abbrev: '°C', type: 'standard' },
  Fahrenheit:   { category: 'Temperature', factor: NaN, abbrev: '°F', type: 'standard' },
  Kelvin:       { category: 'Temperature', factor: NaN, abbrev: 'K',  type: 'standard' },

  // Packaging (Custom) — no fixed ratio
  Box:          { category: 'Packaging', factor: NaN, abbrev: 'BX',  type: 'custom' },
  Case:         { category: 'Packaging', factor: NaN, abbrev: 'CS',  type: 'custom' },
  Carton:       { category: 'Packaging', factor: NaN, abbrev: 'CT',  type: 'custom' },
  Pallet:       { category: 'Packaging', factor: NaN, abbrev: 'PLT', type: 'custom' },
  Pack:         { category: 'Packaging', factor: NaN, abbrev: 'PK',  type: 'custom' },
  Bundle:       { category: 'Packaging', factor: NaN, abbrev: 'BDL', type: 'custom' },
  Roll:         { category: 'Packaging', factor: NaN, abbrev: 'RL',  type: 'custom' },
  Bag:          { category: 'Packaging', factor: NaN, abbrev: 'BG',  type: 'custom' },
  Drum:         { category: 'Packaging', factor: NaN, abbrev: 'DR',  type: 'custom' },
  Container:    { category: 'Packaging', factor: NaN, abbrev: 'CNT', type: 'custom' },
  Tray:         { category: 'Packaging', factor: NaN, abbrev: 'TY',  type: 'custom' },
  Sleeve:       { category: 'Packaging', factor: NaN, abbrev: 'SLV', type: 'custom' },
  Tube:         { category: 'Packaging', factor: NaN, abbrev: 'TB',  type: 'custom' },
  Spool:        { category: 'Packaging', factor: NaN, abbrev: 'SP',  type: 'custom' },
  Ream:         { category: 'Packaging', factor: NaN, abbrev: 'RM',  type: 'custom' },
  Skid:         { category: 'Packaging', factor: NaN, abbrev: 'SK',  type: 'custom' },

  // Custom Business Units (Custom)
  Set:          { category: 'Custom', factor: NaN, abbrev: 'SET',  type: 'custom' },
  Kit:          { category: 'Custom', factor: NaN, abbrev: 'KIT',  type: 'custom' },
  Assembly:     { category: 'Custom', factor: NaN, abbrev: 'ASSY', type: 'custom' },
  Lot:          { category: 'Custom', factor: NaN, abbrev: 'LOT',  type: 'custom' },
  Batch:        { category: 'Custom', factor: NaN, abbrev: 'BAT',  type: 'custom' },
  Sheet:        { category: 'Custom', factor: NaN, abbrev: 'SH',   type: 'custom' },
  Strip:        { category: 'Custom', factor: NaN, abbrev: 'STR',  type: 'custom' },
  Coil:         { category: 'Custom', factor: NaN, abbrev: 'COL',  type: 'custom' },
  Bar:          { category: 'Custom', factor: NaN, abbrev: 'BAR',  type: 'custom' },
  Piece:        { category: 'Custom', factor: NaN, abbrev: 'PC',   type: 'custom' },
  Unit:         { category: 'Custom', factor: NaN, abbrev: 'UN',   type: 'custom' },

  // Legacy aliases (kept so older saved data still resolves)
  Kg:        { category: 'Mass',     factor: 1,    abbrev: 'KG',   type: 'standard' },
  kg:        { category: 'Mass',     factor: 1,    abbrev: 'KG',   type: 'standard' },
  Lb:        { category: 'Mass',     factor: 0.45359237, abbrev: 'LB', type: 'standard' },
  Ton:       { category: 'Mass',     factor: 1000, abbrev: 'TN',   type: 'standard' },
  m:         { category: 'Length',   factor: 1,    abbrev: 'M',    type: 'standard' },
  Roll100m:  { category: 'Length',   factor: 100,  abbrev: 'R100', type: 'custom' },
};

export const uomAbbrev = (v: string) =>
  UOM_CANONICAL[v]?.abbrev ?? v.slice(0, 3).toUpperCase();

/** Returns "standard" | "custom" | undefined for a unit. */
export function uomType(unit: string): 'standard' | 'custom' | undefined {
  return UOM_CANONICAL[unit]?.type;
}

/** Names of every unit in the library — useful for plain selects. */
export function allUnitNames(): string[] {
  // Filter out lowercase legacy aliases for display purposes.
  return Object.keys(UOM_CANONICAL).filter(k => k !== 'kg' && k !== 'm' && k !== 'Kg' && k !== 'Lb' && k !== 'Ton' && k !== 'Roll100m');
}

export function uomCategory(unit: string): string | undefined {
  return UOM_CANONICAL[unit]?.category;
}

/* ── UOM category list (full taxonomy shown in Category dropdown) ── */
export const UOM_CATEGORIES = [
  'Length', 'Area', 'Volume', 'Mass', 'Quantity', 'Time', 'Temperature',
  'Packaging', 'Custom',
];

/* ── UomTypePill — small Standard/Custom badge shown in unit dropdowns
   and next to selected units in the Alternative Units row. ── */
export function UomTypePill({ unit }: { unit: string }) {
  const t = uomType(unit);
  if (!t) return null;
  const isStd = t === 'standard';
  return (
    <span
      className={
        isStd
          ? 'bg-gray-100 text-gray-600 text-[10px] px-1.5 py-0.5 rounded-full font-medium'
          : 'bg-blue-50 text-blue-600 text-[10px] px-1.5 py-0.5 rounded-full font-medium'
      }
      style={{ fontFamily: FONT, lineHeight: 1.2 }}
    >
      {isStd ? 'Standard' : 'Custom'}
    </span>
  );
}

/** Returns all units that belong to a given category. */
export function unitsByCategory(cat: string): string[] {
  return Object.entries(UOM_CANONICAL)
    .filter(([, v]) => v.category === cat)
    .map(([k]) => k);
}

/** True when a standard, system-defined conversion exists between alt and base. */
export function isStandardConversion(altUnit: string, baseUnit: string): boolean {
  return autoConversionFactor(altUnit, baseUnit) != null;
}

/** Returns the auto conversion factor: how many base units equal 1 alt unit.
 *  Returns null when categories differ or when either unit lacks a canonical factor. */
export function autoConversionFactor(altUnit: string, baseUnit: string): number | null {
  const a = UOM_CANONICAL[altUnit];
  const b = UOM_CANONICAL[baseUnit];
  if (!a || !b) return null;
  if (a.category !== b.category) return null;
  if (!isFinite(a.factor) || !isFinite(b.factor) || b.factor === 0) return null;
  const ratio = a.factor / b.factor;
  // Round to 4 significant decimals
  return Math.round(ratio * 10000) / 10000;
}

/* ── ToggleSwitch — Category-literal switch atom (40×22) ── */
export function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (c: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="relative shrink-0 transition-colors"
      style={{ width: '40px', height: '22px', borderRadius: '11px', backgroundColor: checked ? 'hsl(var(--primary))' : '#CBD5E1' }}
    >
      <div
        className="absolute bg-white rounded-full shadow-sm"
        style={{ width: '18px', height: '18px', top: '2px', left: checked ? '20px' : '2px', transition: 'left 0.15s ease' }}
      />
    </button>
  );
}

/* ── AltUomPicker — vendor-card-style trigger + searchable popover.
   Lifted verbatim from Category. ── */
export function AltUomPicker({ value, onChange, options, baseUom: _baseUom }: {
  value: string; onChange: (val: string) => void; options: string[]; baseUom: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const filtered = options.filter(o => o.toLowerCase().includes(search.toLowerCase()));
  const abbrev = value ? uomAbbrev(value) : '—';

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setSearch(''); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 w-full hover:border-[#BFDBFE] transition-colors"
          style={{
            background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10,
            padding: '6px 8px', cursor: 'pointer', textAlign: 'left', height: 40,
          }}
        >
          <div className="flex items-center justify-center shrink-0"
            style={{ width: 26, height: 26, borderRadius: 6, background: value ? '#EDF4FF' : '#F1F5F9' }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: value ? '#0A77FF' : '#94A3B8', fontFamily: FONT, letterSpacing: 0.4 }}>
              {abbrev}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate" style={{ fontSize: 12, fontWeight: 700, color: value ? '#0F172A' : '#94A3B8', fontFamily: FONT, lineHeight: 1.2 }}>
              {value || 'Select unit'}
            </div>
          </div>
          <ChevronDown style={{ width: 12, height: 12, color: '#94A3B8' }} className="shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={4}
        collisionPadding={8}
        avoidCollisions
        className="p-0 w-[--radix-popover-trigger-width] z-50 bg-card"
        style={{ border: '0.75px solid var(--border)', borderRadius: 10, boxShadow: '0 4px 24px -4px rgba(0,0,0,0.15)', overflow: 'hidden', minWidth: 200 }}
      >
        <div className="p-2" style={{ borderBottom: '0.75px solid var(--border)' }}>
          <div className="relative">
            <Search style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: '#9CA3AF' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="w-full outline-none bg-transparent pl-8" style={{ height: 32, fontSize: 12, fontFamily: FONT }} autoFocus />
          </div>
        </div>
        <div style={{ maxHeight: 200, overflowY: 'auto' }}>
          {filtered.map(opt => (
            <div
              key={opt}
              onClick={() => { onChange(opt); setOpen(false); setSearch(''); }}
              className="flex items-center gap-2 px-2 cursor-pointer transition-colors"
              style={{ height: 36, fontSize: 13, fontFamily: FONT, color: 'var(--foreground)' }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'var(--secondary)')}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
            >
              <div className="flex items-center justify-center shrink-0"
                style={{ width: 26, height: 26, borderRadius: 6, background: '#EDF4FF' }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#0A77FF', letterSpacing: 0.4 }}>
                  {uomAbbrev(opt)}
                </span>
              </div>
              <span className="flex-1">{opt}</span>
              <UomTypePill unit={opt} />
              {value === opt && <Check style={{ width: 14, height: 14, color: 'var(--primary)' }} />}
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="flex items-center justify-center py-4" style={{ fontSize: 12, color: '#71717A' }}>No results</div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ── AltUomCascadingPicker — single dropdown with two-level cascade
   (Category → Unit). Same trigger footprint as AltUomPicker but inside
   the popover the user first sees a category list and drills in. ── */
export function AltUomCascadingPicker({
  value,
  onChange,
  baseUom: _baseUom,
  excludeUnits = [],
}: {
  value: string;
  onChange: (val: string, category: string) => void;
  baseUom: string;
  excludeUnits?: string[];
}) {
  const [open, setOpen] = useState(false);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const abbrev = value ? uomAbbrev(value) : '—';
  const valueCategory = value ? uomCategory(value) : undefined;
  const excluded = new Set(excludeUnits);
  const baseCategory = uomCategory(_baseUom);

  // Counts of selectable units per category (excluding base + already-used)
  const catCounts: Record<string, number> = {};
  UOM_CATEGORIES.forEach(c => {
    catCounts[c] = unitsByCategory(c).filter(u => u !== _baseUom && !excluded.has(u)).length;
  });

  const trimmed = search.trim().toLowerCase();

  // Cross-category unit search when typing at the category level.
  const crossUnitMatches = !activeCat && trimmed
    ? Object.keys(UOM_CANONICAL)
        .filter(u => u !== _baseUom && !excluded.has(u) && uomCategory(u) !== baseCategory)
        .filter(u => u.toLowerCase().includes(trimmed))
    : [];

  const filteredCats = UOM_CATEGORIES.filter(c =>
    !trimmed ? true : c.toLowerCase().includes(trimmed)
  );

  const unitsInActive = activeCat
    ? unitsByCategory(activeCat).filter(u => u !== _baseUom && !excluded.has(u))
    : [];
  const filteredUnits = unitsInActive.filter(u => u.toLowerCase().includes(trimmed));

  const reset = () => { setActiveCat(null); setSearch(''); };

  const pick = (unit: string) => {
    const cat = uomCategory(unit) || activeCat || '';
    onChange(unit, cat);
    setOpen(false);
    reset();
  };

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 w-full hover:border-[#BFDBFE] transition-colors"
          style={{
            background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10,
            padding: '6px 8px', cursor: 'pointer', textAlign: 'left', height: 40,
          }}
        >
          <div className="flex items-center justify-center shrink-0"
            style={{ width: 26, height: 26, borderRadius: 6, background: value ? '#EDF4FF' : '#F1F5F9' }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: value ? '#0A77FF' : '#94A3B8', fontFamily: FONT, letterSpacing: 0.4 }}>
              {abbrev}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate" style={{ fontSize: 12, fontWeight: 700, color: value ? '#0F172A' : '#94A3B8', fontFamily: FONT, lineHeight: 1.2 }}>
              {value || 'Select unit'}
            </div>
          </div>
          <ChevronDown style={{ width: 12, height: 12, color: '#94A3B8' }} className="shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={4}
        collisionPadding={8}
        avoidCollisions
        className="p-0 w-[--radix-popover-trigger-width] z-50 bg-card"
        style={{ border: '0.75px solid var(--border)', borderRadius: 10, boxShadow: '0 4px 24px -4px rgba(0,0,0,0.15)', overflow: 'hidden', minWidth: 240 }}
      >
        {/* Header: back arrow + active category, when drilled in */}
        {activeCat && (
          <div
            className="flex items-center gap-2 px-2"
            style={{ height: 36, borderBottom: '0.75px solid var(--border)', background: '#FAFBFC', cursor: 'pointer' }}
            onClick={() => { setActiveCat(null); setSearch(''); }}
          >
            <ChevronLeft style={{ width: 14, height: 14, color: '#475569' }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: '#0F172A', fontFamily: FONT }}>{activeCat}</span>
          </div>
        )}

        {/* Search */}
        <div className="p-2" style={{ borderBottom: '0.75px solid var(--border)' }}>
          <div className="relative">
            <Search style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: '#9CA3AF' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={activeCat ? 'Search units...' : 'Search categories or units...'}
              className="w-full outline-none bg-transparent pl-8"
              style={{ height: 32, fontSize: 12, fontFamily: FONT }}
              autoFocus
            />
          </div>
        </div>

        <div style={{ maxHeight: 260, overflowY: 'auto' }}>
          {!activeCat && (
            <>
              {/* Cross-category direct unit matches when searching */}
              {crossUnitMatches.length > 0 && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', letterSpacing: 0.5, textTransform: 'uppercase', padding: '6px 10px 2px', fontFamily: FONT }}>
                    Units
                  </div>
                  {crossUnitMatches.map(u => (
                    <div
                      key={u}
                      onClick={() => pick(u)}
                      className="flex items-center gap-2 px-2 cursor-pointer"
                      style={{ height: 36, fontSize: 13, fontFamily: FONT, color: 'var(--foreground)' }}
                      onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'var(--secondary)')}
                      onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
                    >
                      <div className="flex items-center justify-center shrink-0"
                        style={{ width: 26, height: 26, borderRadius: 6, background: '#EDF4FF' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#0A77FF', letterSpacing: 0.4 }}>{uomAbbrev(u)}</span>
                      </div>
                      <span className="flex-1">{u}</span>
                      <UomTypePill unit={u} />
                    </div>
                  ))}
                  <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
                </div>
              )}

              {/* Categories */}
              {filteredCats.length === 0 && crossUnitMatches.length === 0 && (
                <div className="flex items-center justify-center py-4" style={{ fontSize: 12, color: '#71717A' }}>No results</div>
              )}
              {filteredCats.map(cat => {
                const count = catCounts[cat] ?? 0;
                const isBaseCat = cat === baseCategory;
                return (
                  <div
                    key={cat}
                    onClick={() => { if (!isBaseCat) { setActiveCat(cat); setSearch(''); } }}
                    className={`flex items-center gap-2 px-3 ${isBaseCat ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                    style={{ height: 38, fontSize: 13, fontFamily: FONT, color: isBaseCat ? '#CBD5E1' : 'var(--foreground)', opacity: isBaseCat ? 0.7 : 1 }}
                    onMouseEnter={e => { if (!isBaseCat) (e.currentTarget as HTMLElement).style.background = 'var(--secondary)'; }}
                    onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
                    title={isBaseCat ? 'Same as base unit category — not available' : undefined}
                  >
                    <span className="flex-1" style={{ fontWeight: 500 }}>{cat}</span>
                    {isBaseCat ? (
                      <span style={{ fontSize: 10, color: '#94A3B8', fontFamily: FONT, fontStyle: 'italic' }}>Same as base unit category — not available</span>
                    ) : (
                      <>
                        <span style={{ fontSize: 11, color: '#94A3B8', fontFamily: FONT }}>({count})</span>
                        <ChevronRight style={{ width: 14, height: 14, color: '#94A3B8' }} />
                      </>
                    )}
                  </div>
                );
              })}
            </>
          )}

          {activeCat && (
            <>
              {filteredUnits.length === 0 && (
                <div className="flex items-center justify-center py-4" style={{ fontSize: 12, color: '#71717A' }}>No units</div>
              )}
              {filteredUnits.map(u => (
                <div
                  key={u}
                  onClick={() => pick(u)}
                  className="flex items-center gap-2 px-2 cursor-pointer"
                  style={{ height: 36, fontSize: 13, fontFamily: FONT, color: 'var(--foreground)' }}
                  onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'var(--secondary)')}
                  onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
                >
                  <div className="flex items-center justify-center shrink-0"
                    style={{ width: 26, height: 26, borderRadius: 6, background: '#EDF4FF' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#0A77FF', letterSpacing: 0.4 }}>{uomAbbrev(u)}</span>
                  </div>
                  <span className="flex-1">{u}</span>
                  <UomTypePill unit={u} />
                  {value === u && <Check style={{ width: 14, height: 14, color: 'var(--primary)' }} />}
                </div>
              ))}
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ── FieldLockBadge — small lock icon + reason tooltip, shown next to a locked field's label ── */
export function FieldLockBadge({ reason, tier = 1 }: { reason: string; tier?: 1 | 2 }) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center cursor-help" style={{ marginLeft: 2 }}>
            <Lock style={{ width: 11, height: 11, color: tier === 1 ? '#EF4444' : '#6B7280' }} />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" style={{ maxWidth: 280 }}>
          <p style={{ fontSize: 12, lineHeight: 1.5, fontFamily: FONT, margin: 0 }}>{reason}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/* ── LockNotice — inline banner for locked fields that don't use CfgField (e.g. card grids) ── */
export function LockNotice({ reason, tier = 1 }: { reason: string; tier?: 1 | 2 }) {
  const isT1 = tier === 1;
  return (
    <div
      className="flex items-start gap-2.5"
      style={{ padding: '10px 14px', borderRadius: 8, border: `1px solid ${isT1 ? '#FDE68A' : '#BFDBFE'}`, backgroundColor: isT1 ? '#FFFBEB' : '#EFF6FF' }}
    >
      <Lock style={{ width: 13, height: 13, color: isT1 ? '#B45309' : '#2563EB', marginTop: 1, flexShrink: 0 }} />
      <p style={{ fontSize: 12, lineHeight: 1.5, color: '#1F2937', fontFamily: FONT, margin: 0 }}>{reason}</p>
    </div>
  );
}

/* ── CfgField — label + hint + optional info tooltip wrapper ──
   When a `fieldKey` is supplied AND an edit-tracking provider is mounted, the
   label gains a "Modified" badge + inline "Revert" link once the field differs
   from its baseline (Category parity). ── */
export function CfgField({ label, hint, tooltip, children, fieldKey }: { label: React.ReactNode; hint?: string; tooltip?: string; children: React.ReactNode; fieldKey?: string }) {
  const editCtx = useContext(ConfigEditContext);
  const isModified = !!fieldKey && !!editCtx && editCtx.modifiedKeys.has(fieldKey);
  const lock = fieldKey ? editCtx?.fieldLocks?.locked?.[fieldKey] : undefined;
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
        {lock && <FieldLockBadge reason={lock.reason} tier={lock.tier} />}
        {isModified && (
          <>
            <span
              style={{
                fontSize: 10, fontWeight: 600, fontFamily: FONT, letterSpacing: 0.2,
                color: '#92400E', backgroundColor: '#FFFBEB', border: '1px solid #FDE68A',
                borderRadius: 9999, padding: '1px 6px', lineHeight: 1.3,
              }}
            >
              Modified
            </span>
            <button
              type="button"
              onClick={() => editCtx!.onRevertField(fieldKey!)}
              className="inline-flex items-center transition-colors"
              style={{
                fontSize: 11, fontWeight: 500, fontFamily: FONT, color: '#B45309',
                background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
                textDecoration: 'underline', textUnderlineOffset: 2,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#92400E'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#B45309'; }}
            >
              Revert
            </button>
          </>
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
    <button type="button" onClick={() => onChange(!checked)} className="shrink-0 flex items-center justify-center transition-colors" style={{ width: '16px', height: '16px', borderRadius: '4px', border: checked ? '1.5px solid hsl(var(--primary))' : '1.5px solid hsl(var(--border, 214 32% 80%))', backgroundColor: checked ? 'hsl(var(--primary))' : '#FFFFFF' }}>
      {checked && <Check style={{ width: '12px', height: '12px', color: 'white' }} />}
    </button>
  );
}

/* ── UnitDisplayCard — read-only base UOM display with badge + name + sublabel.
   Used by Stock Limit UOM and Purchase UOM fields where the value is always
   inherited from the item's Base UOM. ── */
export function UnitDisplayCard({ unit, sublabel = 'Base unit' }: { unit: string; sublabel?: string }) {
  const abbrev = uomAbbrev(unit || 'Each');
  const name = unit || 'Each';
  return (
    <div
      className="mt-2 flex items-center gap-3"
      style={{
        borderRadius: 12,
        border: '1px solid #E2E8F0',
        backgroundColor: '#F8FAFC',
        padding: 12,
      }}
    >
      <div
        className="flex items-center justify-center shrink-0"
        style={{ width: 40, height: 40, borderRadius: 10, background: '#EDF4FF' }}
      >
        <span style={{ fontSize: 12, fontWeight: 700, color: '#0A77FF', fontFamily: FONT, letterSpacing: 0.4 }}>
          {abbrev}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', fontFamily: FONT, lineHeight: 1.2 }}>
          {name}
        </div>
        <div style={{ fontSize: 12, fontWeight: 400, color: '#94A3B8', fontFamily: FONT, lineHeight: 1.4, marginTop: 2 }}>
          {sublabel}
        </div>
      </div>
    </div>
  );
}

/* ── StepperInput — − value + numeric stepper used by Stock Limits ── */
export function StepperInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const numVal = parseInt(value) || 0;
  return (
    <div className="flex items-center mt-2" style={{ borderRadius: 'var(--radius)', border: '1px solid #E2E8F0', overflow: 'hidden', height: 40, backgroundColor: '#FFFFFF' }}>
      <button
        onClick={() => onChange(String(Math.max(0, numVal - 1)))}
        className="flex items-center justify-center shrink-0 hover:opacity-80 transition-colors"
        style={{ width: 40, height: '100%', borderRight: '1px solid #E2E8F0', backgroundColor: '#F1F5F9' }}
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
        style={{ width: 40, height: '100%', borderLeft: '1px solid #E2E8F0', backgroundColor: '#F1F5F9' }}
      >
        <Plus style={{ width: 14, height: 14, color: '#64748B' }} />
      </button>
    </div>
  );
}

/* ── LocationMultiSelect — multi-select with searchable dropdown + chips with default Star ──
   Lifted verbatim from Category. Displays selected items as 30px chips below.
   Star toggles default-pin. Backed by simple string[] selected list. */
export function LocationMultiSelect({ label, tooltip, placeholder, options, selected, defaultValue, onToggle, onDefaultChange, dataOnly, dataOnlyNote }: {
  label: string; tooltip?: string; placeholder: string; options: string[]; selected: string[]; defaultValue?: string;
  onToggle: (loc: string) => void; onDefaultChange: (loc: string) => void;
  /** Prototype marker: field captures/stores a value but isn't wired to live behaviour yet. */
  dataOnly?: boolean; dataOnlyNote?: string;
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
        {dataOnly && (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className="inline-flex items-center gap-1 cursor-help"
                  style={{ height: 18, padding: '0 6px', borderRadius: 9999, backgroundColor: '#F1F5F9', color: '#64748B', fontSize: 10, fontWeight: 600, fontFamily: FONT, letterSpacing: 0.2, border: '0.75px solid #E2E8F0' }}
                >
                  <Info style={{ width: 10, height: 10 }} />
                  Data only
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" style={{ maxWidth: 320 }}>
                <p style={{ fontSize: 12, lineHeight: 1.6, fontFamily: FONT }}>
                  {dataOnlyNote || 'Captured for reference in this prototype — not yet wired to receiving or shipping flows.'}
                </p>
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
          /* z-[260]: this popover portals to <body>, and the Configure-Item modal's
             DialogContent is forced to !z-50. Without lifting above it, the dropdown
             opens *behind* the modal and reads as "won't open". Mirrors the z-[250]
             the Select dropdowns in CreateItemModal already use. */
          className="p-0 w-[--radix-popover-trigger-width] bg-card z-[260]"
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
