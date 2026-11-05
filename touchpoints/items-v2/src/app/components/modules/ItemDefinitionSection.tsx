// @ts-nocheck
/**
 * ItemDefinitionSection — Category parity rewrite (Slice CAT-PARITY).
 *
 * Source of truth: Category project (edda1394-233a-42be-be90-58ae0a04db60)
 * src/app/components/ConfigureCategory.tsx → ItemDefinitionContent (lines 622–1127).
 *
 * This file is mounted in BOTH render paths:
 *  - Create Item modal (CreateItemModal → ItemConfigurationMaster)
 *  - Item detail Configurations tab (ItemDetail → ItemConfigurationMaster)
 *
 * Parity rules followed:
 *  - Outer columns use semantic tokens (var(--card), var(--border), calc(var(--radius)+2px))
 *  - 3-column simple Inventory Type pills
 *  - Compact 76px Control Type tiles with corner radio
 *  - 56px Lot Tracking row with inline Tags icon + ToggleSwitch atom
 *  - Alternative Units uses styled "Add Unit" pill, AltUomPicker, "= 1 baseUom" suffix
 *  - Acquisition Method uses solid Check circle, accent-colored title, hover ring
 */
import React, { useState, useContext } from 'react';
import { Plus, Trash2, Package, Layers, Info, Tags, Star, ShoppingCart, Wrench, Check, ArrowLeftRight, Lock } from 'lucide-react';
import {
  CfgField, RadioOption, CheckboxControl, ToggleSwitch, AltUomPicker, ConfigEditContext,
  AltUomCascadingPicker,
  autoConversionFactor, UOM_CATEGORIES, unitsByCategory, uomCategory, isStandardConversion,
  UomTypePill, allUnitNames, uomAbbrev,
} from './configAtoms';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { ConfigSelect } from './CreateItemModal';
import type { AdvancedConfig } from './ItemConfigurationMaster';
import { FieldUpgradeConfirmModal } from './FieldUpgradeConfirmModal';

interface ItemDefinitionSectionProps {
  config: AdvancedConfig;
  onConfigChange: (key: keyof AdvancedConfig, value: any) => void;
  setFormData?: (fn: any) => void;
}

const FONT = "'Inter', sans-serif";

export function ItemDefinitionSection({ config, onConfigChange, setFormData }: ItemDefinitionSectionProps) {
  const [lotControlOpen, setLotControlOpen] = useState(true);

  // ── Field edit-state locks (edit mode only; see itemFieldLocks) ──
  const editCtx = useContext(ConfigEditContext);
  const locks = editCtx?.fieldLocks;
  const uomLocked = !!locks?.locked?.uom;
  const oneWay = locks?.oneWay ?? {};
  const ctDisabled = (id) => oneWay.controlType?.disabledOptions?.[id];
  const invTypeDisabled = (id) => oneWay.inventoryType?.disabledOptions?.[id];
  const lotOffDisabled = oneWay.lotControlEnabled?.disabledOptions?.['false'];
  const lotLocked = !!lotOffDisabled;
  const [confirmState, setConfirmState] = useState(null);

  /** Apply a config change plus any UI side-effects. */
  const applyChange = (key, value) => {
    onConfigChange(key, value);
    if (key === 'lotControlEnabled' && value === true) setLotControlOpen(true);
  };
  /** Apply a change, but route one-way "upgrade" values through the confirm modal first. */
  const requestChange = (key, value) => {
    if (String(config[key]) === String(value)) return; // no-op when unchanged
    const copy = oneWay[key]?.confirm?.[String(value)];
    if (copy) { setConfirmState({ key, value, copy }); return; }
    applyChange(key, value);
  };

  const updateAltUnits = (next: any[]) => {
    if (setFormData) {
      setFormData((prev: any) => ({
        ...prev,
        config: { ...prev.config, alternativeUnits: next },
      }));
    } else {
      onConfigChange('alternativeUnits', next as any);
    }
  };

  const altUnits = config.alternativeUnits || [];

  const toggleAcquisitionMethod = (methodId: string) => {
    const current = config.acquisitionMethod || [];
    const isActive = current.includes(methodId);
    const updated = isActive ? current.filter(m => m !== methodId) : [...current, methodId];
    onConfigChange('acquisitionMethod', updated);
    if (updated.length === 1) onConfigChange('primaryAcquisition', updated[0] as any);
  };

  return (
    <div className="grid grid-cols-2 gap-4 items-stretch">
      {/* ───────── Left column: Identity & Tracking ───────── */}
      <div className="flex flex-col h-full" style={{ borderRadius: 'calc(var(--radius) + 2px)', border: '1px solid #E2E8F0', backgroundColor: 'var(--card)', overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
        <div className="px-4 flex items-center gap-2.5" style={{ height: 44, borderBottom: '1px solid #EEF2F6', backgroundColor: '#FAFBFC' }}>
          <div className="flex items-center justify-center shrink-0" style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: '#EDF4FF' }}>
            <Package style={{ width: 14, height: 14, color: '#0A77FF' }} />
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--foreground)', opacity: 0.7, letterSpacing: '0.8px', textTransform: 'uppercase', fontFamily: FONT }}>Identity & Tracking</span>
        </div>
        <div className="p-4 flex flex-col gap-4">
          {/* Inventory Type — 3-col simple pill buttons (Category parity) */}
          <CfgField
            label="Inventory Type"
            fieldKey="inventoryType"
            hint="Determine how this item is tracked in your inventory system."
            tooltip={'Determines whether this item is physically stocked.\n\nEXAMPLE: **Stock** — Raw materials kept in the warehouse.\n\nEXAMPLE: **Non-stock** — Office stationery, ordered when needed.'}
          >
            <div className="grid grid-cols-3 gap-2 mt-2">
              {(['Stock', 'Non-stock', 'Asset'] as const).map(id => {
                const isActive = config.inventoryType === id;
                const disabledReason = invTypeDisabled(id);
                const btn = (
                  <button
                    key={id}
                    onClick={() => { if (disabledReason) return; onConfigChange('inventoryType', id); }}
                    aria-disabled={!!disabledReason}
                    className={`transition-all duration-150 flex items-center justify-center ${disabledReason ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                    style={{
                      height: 44,
                      borderRadius: 8,
                      border: `1px solid ${isActive ? '#93C5FD' : '#E2E8F0'}`,
                      backgroundColor: isActive ? '#EFF6FF' : disabledReason ? '#F8FAFC' : 'white',
                      color: isActive ? '#0A77FF' : disabledReason ? '#CBD5E1' : '#334155',
                      fontSize: 13,
                      fontWeight: isActive ? 600 : 500,
                      fontFamily: FONT,
                      opacity: disabledReason ? 0.65 : 1,
                    }}
                  >
                    {id}
                  </button>
                );
                return disabledReason ? <LockTip key={id} reason={disabledReason}>{btn}</LockTip> : btn;
              })}
            </div>
          </CfgField>

          {/* Control Type — compact 76px tiles with corner radio (Category parity) */}
          <CfgField
            label="Control Type"
            fieldKey="controlType"
            hint="Define how individual units are identified and traced."
            tooltip={'Defines how individual units are tracked.\n\nEXAMPLE: **Serialized** — A laptop with a unique serial number.\n\nEXAMPLE: **Non-serialized** — Bolts tracked as a quantity.'}
          >
            <div className="grid grid-cols-1 gap-2 mt-2">
              {([
                { id: 'Serialized', desc: 'Unique ID per unit.' },
                { id: 'Non-serialized', desc: 'Tracked in bulk by quantity.' },
              ] as const).map(ct => {
                const isActive = config.controlType === ct.id;
                const disabledReason = ctDisabled(ct.id);
                const btn = (
                  <button
                    key={ct.id}
                    onClick={() => { if (disabledReason) return; requestChange('controlType', ct.id); }}
                    aria-disabled={!!disabledReason}
                    className={`relative transition-all duration-150 flex flex-col items-start justify-center gap-1 text-left ${disabledReason ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                    style={{
                      height: 76,
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: `1px solid ${isActive ? '#93C5FD' : '#E2E8F0'}`,
                      backgroundColor: isActive ? '#EFF6FF' : disabledReason ? '#F8FAFC' : 'white',
                      fontFamily: FONT,
                      opacity: disabledReason ? 0.6 : 1,
                    }}
                  >
                    <div className="absolute top-2.5 right-2.5 rounded-full flex items-center justify-center shrink-0" style={{
                      width: 16, height: 16,
                      border: isActive ? '2px solid #3B82F6' : '1.5px solid #D1D5DB',
                      backgroundColor: 'white',
                    }}>
                      {isActive && <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#3B82F6' }} />}
                    </div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: disabledReason ? '#94A3B8' : '#0F172A', fontFamily: FONT, margin: 0, paddingRight: 20 }}>{ct.id}</p>
                    <p className="line-clamp-1" style={{ fontSize: 11, color: '#94A3B8', fontFamily: FONT, margin: 0 }}>{ct.desc}</p>
                  </button>
                );
                return disabledReason ? <LockTip key={ct.id} reason={disabledReason}>{btn}</LockTip> : btn;
              })}
            </div>
          </CfgField>

          {/* Lot Tracking — compact 56px single-row tile with ToggleSwitch (Category parity) */}
          <div className="flex flex-col">
            <div className="border rounded-lg overflow-hidden" style={{ borderColor: '#E2E8F0', backgroundColor: 'white' }}>
              {(() => {
                const row = (
                  <div
                    className={`flex items-center justify-between gap-3 ${lotLocked ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                    style={{ minHeight: 56, padding: '8px 12px' }}
                    onClick={() => {
                      if (lotLocked) return;
                      const newVal = !config.lotControlEnabled;
                      if (newVal) requestChange('lotControlEnabled', true);
                      else applyChange('lotControlEnabled', false);
                    }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Tags style={{ width: 16, height: 16, color: config.lotControlEnabled ? '#0A77FF' : '#64748B', flexShrink: 0 }} />
                      <div className="min-w-0">
                        <p style={{ fontSize: 14, fontWeight: 600, color: '#0F172A', fontFamily: FONT, margin: 0 }}>Lot Tracking</p>
                        <p style={{ fontSize: 12, color: '#94A3B8', fontFamily: FONT, margin: 0, marginTop: 1, lineHeight: 1.3 }}>Enable batch-level traceability.</p>
                      </div>
                    </div>
                    <div onClick={(e) => e.stopPropagation()} className="shrink-0" style={lotLocked ? { pointerEvents: 'none', opacity: 0.7 } : undefined}>
                      <ToggleSwitch
                        checked={!!config.lotControlEnabled}
                        onChange={(v) => {
                          if (lotLocked) return;
                          if (v) requestChange('lotControlEnabled', true);
                          else applyChange('lotControlEnabled', false);
                        }}
                      />
                    </div>
                  </div>
                );
                return lotLocked ? <LockTip reason={lotOffDisabled}>{row}</LockTip> : row;
              })()}
              {config.lotControlEnabled && lotControlOpen && (
                <div className="px-3 pb-3 pt-1 flex flex-col gap-3" style={{ background: '#FAFBFC', borderTop: '1px solid #EEF2F6' }} onClick={(e) => e.stopPropagation()}>
                  <CfgField label="Lot ID Assignment" hint="" fieldKey="lotIdSource">
                    <div className="flex flex-col gap-2 mt-2">
                      <RadioOption selected={config.lotIdSource === 'system'} onSelect={() => onConfigChange('lotIdSource', 'system')} label="System Generated" desc="Auto-generate IDs based on prefix." />
                      <RadioOption selected={config.lotIdSource === 'vendor'} onSelect={() => onConfigChange('lotIdSource', 'vendor')} label="Use vendor lot as lot ID" desc="Vendor lot number becomes Lot ID." />
                    </div>
                  </CfgField>

                  <DurationToggleField
                    label="Set Shelf Life"
                    enabled={!!config.shelfLifeEnabled}
                    value={config.shelfLifeValue ?? ''}
                    unit={config.shelfLifeUnit ?? 'days'}
                    onToggle={(c) => onConfigChange('shelfLifeEnabled', c)}
                    onValueChange={(v) => onConfigChange('shelfLifeValue', v)}
                    onUnitChange={(u) => onConfigChange('shelfLifeUnit', u)}
                    tooltip="The default number of days from creation before a lot of this item is considered expired, used to auto-calculate the expiry date when a new lot is received."
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ───────── Right column: Measurement & Source ───────── */}
      <div className="flex flex-col h-full" style={{ borderRadius: 'calc(var(--radius) + 2px)', border: '1px solid #E2E8F0', backgroundColor: 'var(--card)', alignSelf: 'start', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
        <div className="px-4 flex items-center gap-2.5" style={{ height: 44, borderBottom: '1px solid #EEF2F6', backgroundColor: '#FAFBFC', borderTopLeftRadius: 'calc(var(--radius) + 2px)', borderTopRightRadius: 'calc(var(--radius) + 2px)' }}>
          <div className="flex items-center justify-center shrink-0" style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: '#EDF4FF' }}>
            <Layers style={{ width: 14, height: 14, color: '#0A77FF' }} />
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--foreground)', opacity: 0.7, letterSpacing: '0.8px', textTransform: 'uppercase', fontFamily: FONT }}>Measurement & Source</span>
        </div>
        <div className="p-4 flex flex-col gap-4">
          {/* Base UOM */}
          <CfgField
            label="Base Unit of Measure (UOM)"
            fieldKey="uom"
            hint="The primary unit used for counting and valuing this item."
            tooltip={'The unit your inventory uses to count and store this item. All stock levels, valuations, and movements are recorded in this unit. You can still buy or sell in other units by defining alternative units with conversions.\n\nEXAMPLE: **Each** — Bolts counted as individual units.\n\nEXAMPLE: **Kg** — Steel rods stored and valued by weight.'}
          >
            <div style={uomLocked ? { pointerEvents: 'none', opacity: 0.6 } : undefined} aria-disabled={uomLocked || undefined}>
              <ConfigSelect
                value={config.uom}
                onValueChange={(v: string) => onConfigChange('uom', v)}
                options={allUnitNames()}
                placeholder="Select UOM..."
                renderItemRight={(opt: string) => <UomTypePill unit={opt} />}
              />
            </div>
          </CfgField>

          {/* Alternative Units — heading + info on left, Add Unit pill button right (Category parity) */}
          <div className="flex flex-col">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 min-w-0">
                <span style={{ fontSize: 12, fontWeight: 500, color: '#475569', fontFamily: FONT }}>Alternative Units</span>
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="shrink-0 flex items-center justify-center cursor-help">
                        <Info style={{ width: 12, height: 12, color: '#94A3B8' }} />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" style={{ maxWidth: 340 }}>
                      <p style={{ fontSize: 12, lineHeight: 1.6, fontFamily: FONT, whiteSpace: 'pre-line' }}>
                        {'Define how this item is bought or sold in different units. Each conversion you set here is unique to this item. For example, if you purchase in Boxes but stock in Each, enter how many Each fit in one Box.'}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <button
                onClick={() => {
                  const baseCat = uomCategory(config.uom || 'Each') || '';
                  const next = [
                    ...altUnits,
                    { id: `au-${Date.now()}`, category: baseCat, unit: '', conversionFactor: '' },
                  ];
                  updateAltUnits(next);
                }}
                className="inline-flex items-center gap-1.5 px-3 hover:bg-[#EDF4FF] transition-colors shrink-0"
                style={{ height: 32, borderRadius: 8, border: '1px solid #BFDBFE', fontSize: 12, fontWeight: 500, fontFamily: FONT, color: '#0A77FF', background: '#F8FBFF' }}
              >
                <Plus style={{ width: 13, height: 13 }} /> Add Unit
              </button>
            </div>
            <span style={{ fontSize: 11, fontWeight: 400, color: '#94A3B8', fontFamily: FONT, lineHeight: 1.4, marginTop: 2 }}>
              Defined relative to the base unit. Alternatives must come from a different unit category.
            </span>

            {altUnits.length === 0 ? (
              <div
                className="mt-3 flex flex-col items-center justify-center gap-2.5 px-4"
                style={{
                  minHeight: 132,
                  borderRadius: 10,
                  border: '1.5px dashed #CBD5E1',
                  background: 'linear-gradient(180deg, #FAFBFC 0%, #F4F6F8 100%)',
                }}
              >
                <div
                  className="flex items-center justify-center"
                  style={{ width: 36, height: 36, borderRadius: 10, background: '#FFFFFF', border: '1px solid #E2E8F0' }}
                >
                  <Layers style={{ width: 16, height: 16, color: '#94A3B8' }} />
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: '#475569', fontFamily: FONT, lineHeight: 1.3 }}>
                    No alternative units added
                  </span>
                  <span style={{ fontSize: 11, color: '#94A3B8', fontFamily: FONT, textAlign: 'center', lineHeight: 1.4, maxWidth: 360 }}>
                    Each alternative is converted back to <strong style={{ color: '#475569', fontWeight: 600 }}>{config.uom || 'Each'}</strong>. Add units from other categories (like Cases, Pallets, or Meters) to define item-specific conversions.
                  </span>
                </div>
              </div>
            ) : (
              <div className="mt-3 flex flex-col gap-2">
                {altUnits.map((au: any, idx: number) => {
                  const usedUnits = new Set(
                    altUnits.filter((_: any, i: number) => i !== idx).map((x: any) => x.unit).filter(Boolean)
                  );
                  const baseUom = config.uom || 'Each';
                  const category = au.category || '';
                  const isStandard = !!au.unit && isStandardConversion(au.unit, baseUom);
                  const cfNum = parseFloat(au.conversionFactor);
                  const cfValid = isFinite(cfNum) && cfNum > 0;
                  const oneToOneWarn = cfValid && cfNum === 1 && au.unit && au.unit !== baseUom;
                  const baseCat = uomCategory(baseUom) || '';
                  const altCat = au.unit ? (uomCategory(au.unit) || category) : '';
                  const sharesBaseCat = !!au.unit && !!baseCat && altCat === baseCat;
                  return (
                    <div key={au.id} className="relative flex flex-col gap-1 p-2 rounded-lg border border-[#E2E8F0] bg-white">
                      <div className="flex items-start gap-3 px-1 py-1">
                        {/* LEFT: base anchor + connector + alt picker */}
                        <div className="min-w-0" style={{ flex: '0 0 52%' }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.5px', textTransform: 'uppercase', fontFamily: FONT, marginBottom: 3 }}>Unit pairing</div>
                          <div className="flex items-center gap-2">
                            {/* Base anchor (read-only) */}
                            <div
                              className="flex items-center gap-2 shrink-0"
                              style={{ background: '#F1F5F9', border: '1px solid #E2E8F0', borderRadius: 10, padding: '6px 10px 6px 8px', height: 40 }}
                              title={`Base unit — ${baseUom}${baseCat ? ` (${baseCat})` : ''}`}
                            >
                              <div className="flex items-center justify-center shrink-0" style={{ width: 26, height: 26, borderRadius: 6, background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                                <span style={{ fontSize: 10, fontWeight: 700, color: '#475569', fontFamily: FONT, letterSpacing: 0.4 }}>{uomAbbrev(baseUom)}</span>
                              </div>
                              <div className="min-w-0">
                                <div style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', fontFamily: FONT, lineHeight: 1.2 }}>{baseUom}</div>
                                <div style={{ fontSize: 10, color: '#94A3B8', fontFamily: FONT, lineHeight: 1.2, marginTop: 1 }}>Base unit</div>
                              </div>
                            </div>
                            {/* Connector */}
                            <div className="flex items-center justify-center shrink-0" style={{ width: 18, height: 40 }}>
                              <ArrowLeftRight style={{ width: 12, height: 12, color: '#CBD5E1' }} />
                            </div>
                            {/* Alt picker */}
                            <div className="min-w-0 flex-1">
                              <AltUomCascadingPicker
                                value={au.unit}
                                onChange={(val, cat) => {
                                  const next = [...altUnits];
                                  const auto = autoConversionFactor(val, baseUom);
                                  next[idx] = {
                                    ...au,
                                    category: cat,
                                    unit: val,
                                    conversionFactor: auto != null ? String(auto) : '',
                                  };
                                  updateAltUnits(next);
                                }}
                                baseUom={baseUom}
                                excludeUnits={Array.from(usedUnits) as string[]}
                              />
                            </div>
                          </div>
                          {altCat && (
                            <div className="flex items-center gap-1.5" style={{ marginTop: 4, paddingLeft: 2 }}>
                              <span style={{ fontSize: 11, color: '#94A3B8', fontFamily: FONT }}>{altCat}</span>
                              {au.unit && <UomTypePill unit={au.unit} />}
                            </div>
                          )}
                        </div>
                        {/* RIGHT: equals / conversion */}
                        <div className="min-w-0 flex-1">
                          <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.5px', textTransform: 'uppercase', fontFamily: FONT, marginBottom: 3 }}>Equals (in base unit)</div>
                          <div className="flex items-center gap-2.5" style={{ height: 40 }}>
                            {!au.unit ? (
                              <span style={{ fontSize: 12, color: '#94A3B8', fontFamily: FONT }}>
                                Select a unit to define the conversion rate
                              </span>
                            ) : (
                              <>
                                <span className="whitespace-nowrap" style={{ fontSize: 12, color: '#64748B', fontFamily: FONT }}>
                                  1 {au.unit} =
                                </span>
                                {isStandard ? (
                                  <div
                                    className="flex items-center gap-1.5"
                                    style={{ height: 36, padding: '0 10px', borderRadius: 8, background: '#F1F5F9', border: '1px solid #E2E8F0', minWidth: 140 }}
                                    title="Locked — defined in the company UOM conversion table"
                                  >
                                    <Lock style={{ width: 11, height: 11, color: '#94A3B8' }} />
                                    <span style={{ fontSize: 13, fontWeight: 600, color: '#0F172A', fontFamily: FONT }}>{au.conversionFactor}</span>
                                    <span style={{ fontSize: 12, color: '#94A3B8', fontFamily: FONT, marginLeft: 'auto' }}>{baseUom}</span>
                                  </div>
                                ) : (
                                  <div className="relative" style={{ width: 140 }}>
                                    <input
                                      type="number"
                                      value={au.conversionFactor}
                                      onChange={(e) => {
                                        const next = [...altUnits];
                                        next[idx] = { ...au, conversionFactor: e.target.value };
                                        updateAltUnits(next);
                                      }}
                                      className="w-full rounded-md border border-[#E2E8F0] pl-2 outline-none focus:border-[#93C5FD]"
                                      style={{ height: 36, fontSize: 13, fontFamily: FONT, color: '#0F172A', paddingRight: 56, background: '#FFFFFF' }}
                                      placeholder="0"
                                    />
                                    <span
                                      className="absolute pointer-events-none whitespace-nowrap"
                                      style={{ right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: '#94A3B8', fontFamily: FONT }}
                                    >
                                      {baseUom}
                                    </span>
                                  </div>
                                )}
                                {isStandard && (
                                  <span
                                    style={{ fontSize: 10, fontWeight: 600, color: '#0A77FF', background: '#EFF6FF', border: '1px solid #BFDBFE', padding: '2px 6px', borderRadius: 999, fontFamily: FONT, whiteSpace: 'nowrap' }}
                                  >
                                    From company UOM table
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            const next = altUnits.filter((x: any) => x.id !== au.id);
                            updateAltUnits(next);
                          }}
                          className="flex items-center justify-center text-slate-400 hover:text-destructive hover:bg-[#FEF2F2] rounded-md transition-colors shrink-0"
                          style={{ width: 24, height: 40, marginTop: 18 }}
                          title="Remove"
                        >
                          <Trash2 style={{ width: 13, height: 13 }} />
                        </button>
                      </div>
                      {sharesBaseCat && (
                        <div style={{ fontSize: 11, color: '#B91C1C', fontFamily: FONT, paddingLeft: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                          ⚠ This alternative shares a category with the base unit. Remove or change it.
                        </div>
                      )}
                      {au.unit && isStandard && !sharesBaseCat && (
                        <div style={{ fontSize: 11, color: '#475569', fontFamily: FONT, paddingLeft: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Lock style={{ width: 10, height: 10, color: '#94A3B8' }} />
                          Locked — defined in the company UOM conversion table.
                        </div>
                      )}
                      {au.unit && !isStandard && !sharesBaseCat && (
                        <div style={{ fontSize: 11, color: '#94A3B8', fontFamily: FONT, paddingLeft: 4 }}>
                          Custom conversion — applies to this item only and won't affect the company UOM table.
                        </div>
                      )}
                      {oneToOneWarn && !isStandard && (
                        <div style={{ fontSize: 11, color: '#B45309', fontFamily: FONT, paddingLeft: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                          ⚠ 1 {au.unit} = 1 {baseUom} — are you sure? These units typically have different conversion rates.
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Acquisition Method — side-by-side cards (Category parity, grid-cols-2) */}
          <CfgField
            label="Acquisition Method"
            fieldKey="acquisitionMethod"
            hint="How is this item brought into stock? (Select all that apply)"
            tooltip={'Defines how this item is brought into stock — sourced from a vendor, produced internally, or both. The system uses this setting to recommend the right replenishment action: a Purchase Order (PO) or a Work Order (WO).\n\nEXAMPLE: **Purchased** — Engine filters bought from a vendor trigger a PO recommendation.\n\nEXAMPLE: **Manufactured** — Sub-assemblies built in-house trigger a WO recommendation.'}
          >
            <div className="grid grid-cols-2 gap-2 mt-2">
              {[
                {
                  id: 'Purchased',
                  label: 'Purchased',
                  Icon: ShoppingCart,
                  desc: 'Sourced from a vendor — triggers a Purchase Order recommendation.',
                  accent: '#0A77FF',
                  bgSelected: '#EFF6FF',
                  borderSelected: '#93C5FD',
                  iconBgSelected: '#D6E8FF',
                },
                {
                  id: 'Manufactured',
                  label: 'Manufactured',
                  Icon: Wrench,
                  desc: 'Produced in-house — triggers a Work Order recommendation.',
                  accent: '#D97706',
                  bgSelected: '#FFFBEB',
                  borderSelected: '#FCD34D',
                  iconBgSelected: '#FEF3C7',
                },
              ].map((method) => {
                const acqs = config.acquisitionMethod || [];
                const isActive = acqs.includes(method.id);
                const bothSelected = acqs.includes('Purchased') && acqs.includes('Manufactured');
                const isPrimary = config.primaryAcquisition === method.id;
                return (
                  <div
                    key={method.id}
                    onClick={() => toggleAcquisitionMethod(method.id)}
                    className={`group relative cursor-pointer p-3 rounded-lg border transition-all duration-150 flex flex-col items-start gap-1.5 ${
                      isActive ? '' : 'bg-white hover:bg-[#FAFCFF] hover:border-[#CBD5E1]'
                    }`}
                    style={{
                      fontFamily: FONT,
                      minHeight: 96,
                      backgroundColor: isActive ? method.bgSelected : 'white',
                      borderColor: isActive ? method.borderSelected : '#E2E8F0',
                      boxShadow: isActive
                        ? `0 0 0 1px ${method.borderSelected}55, 0 1px 3px rgba(0,0,0,0.04)`
                        : '0 2px 8px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)',
                    }}
                  >
                    {/* Top-right action zone */}
                    <div className="absolute top-2.5 right-2.5 flex items-center justify-center" style={{ minWidth: 20, height: 20 }}>
                      {isActive ? (
                        bothSelected ? (
                          isPrimary ? (
                            <span
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center px-2 py-0.5 rounded-md"
                              style={{ fontSize: 10, fontWeight: 600, fontFamily: FONT, background: method.accent, color: '#FFFFFF' }}
                            >
                              Primary
                            </span>
                          ) : (
                            <Star
                              onClick={(e) => { e.stopPropagation(); onConfigChange('primaryAcquisition', method.id as any); }}
                              className="cursor-pointer text-slate-400 transition-colors"
                              style={{ width: 16, height: 16, fill: 'none' }}
                              onMouseEnter={(e) => { (e.currentTarget as unknown as SVGSVGElement).style.color = method.accent; }}
                              onMouseLeave={(e) => { (e.currentTarget as unknown as SVGSVGElement).style.color = ''; }}
                            />
                          )
                        ) : (
                          <div className="flex items-center justify-center rounded-full" style={{ width: 20, height: 20, backgroundColor: method.accent }}>
                            <Check style={{ width: 12, height: 12, color: 'white' }} strokeWidth={3} />
                          </div>
                        )
                      ) : (
                        <div
                          className="rounded-full border-2 border-slate-300 bg-white opacity-0 group-hover:opacity-100 transition-opacity"
                          style={{ width: 20, height: 20 }}
                        />
                      )}
                    </div>

                    {/* Icon */}
                    <div
                      className="flex items-center justify-center shrink-0 rounded-md"
                      style={{
                        width: 28,
                        height: 28,
                        backgroundColor: isActive ? method.iconBgSelected : '#F1F5F9',
                      }}
                    >
                      <method.Icon style={{ width: 14, height: 14, color: isActive ? method.accent : '#64748B' }} />
                    </div>

                    {/* Title */}
                    <span
                      className="block"
                      style={{
                        fontSize: 13,
                        fontWeight: isActive ? 600 : 500,
                        color: isActive ? method.accent : 'var(--foreground)',
                        fontFamily: FONT,
                        lineHeight: 1.2,
                      }}
                    >
                      {method.label}
                    </span>

                    {/* Subtext */}
                    <span
                      className="block line-clamp-2"
                      style={{
                        fontSize: 11,
                        color: '#94A3B8',
                        fontFamily: FONT,
                        lineHeight: 1.35,
                        paddingRight: 28,
                      }}
                    >
                      {method.desc}
                    </span>
                  </div>
                );
              })}
            </div>
          </CfgField>
        </div>
      </div>

      <FieldUpgradeConfirmModal
        open={!!confirmState}
        title={confirmState?.copy.title ?? ''}
        body={confirmState?.copy.body ?? ''}
        confirmLabel={confirmState?.copy.confirmLabel ?? ''}
        onConfirm={() => { if (confirmState) applyChange(confirmState.key, confirmState.value); setConfirmState(null); }}
        onCancel={() => setConfirmState(null)}
      />
    </div>
  );
}

/* ── LockTip — wraps a control so hovering shows the one-way "disabled" reason.
   Radix Tooltip with asChild adds no in-flow DOM, so grid/flow layout stays intact. ── */
function LockTip({ reason, children }: { reason: string; children: React.ReactElement }) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side="top" style={{ maxWidth: 260 }}>
          <p style={{ fontSize: 12, lineHeight: 1.5, fontFamily: FONT, margin: 0 }}>{reason}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/* ── DurationToggleField — checkbox + numeric input + unit selector ───────── */
function DurationToggleField({
  label, enabled, value, unit, onToggle, onValueChange, onUnitChange, tooltip,
}: {
  label: string;
  enabled: boolean;
  value: string | number;
  unit: 'days' | 'months' | 'years' | string;
  onToggle: (c: boolean) => void;
  onValueChange: (v: string) => void;
  onUnitChange: (u: string) => void;
  tooltip?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <CheckboxControl checked={enabled} onChange={onToggle} />
        <label
          onClick={() => onToggle(!enabled)}
          className="flex items-center gap-1.5 cursor-pointer"
          style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', fontFamily: FONT }}
        >
          {label}
          {tooltip ? (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center justify-center cursor-help"
                  >
                    <Info style={{ width: 13, height: 13, color: 'var(--foreground)', opacity: 0.45 }} />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" style={{ maxWidth: 320 }}>
                  <p style={{ fontSize: 12, lineHeight: 1.5, fontFamily: FONT, margin: 0 }}>{tooltip}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <Info style={{ width: 13, height: 13, color: 'var(--foreground)', opacity: 0.35 }} />
          )}
        </label>
      </div>
      {enabled && (
        <div className="flex gap-2 ml-7" style={{ width: 'calc(80% - 28px)' }}>
          <input
            type="number"
            min={0}
            value={value}
            onChange={(e) => onValueChange(e.target.value)}
            placeholder="Enter value"
            className="flex-1 bg-background border border-border outline-none px-3 rounded-md focus:ring-2 focus:ring-[#0A77FF]/20"
            style={{ height: 38, fontSize: 13, fontFamily: FONT, minWidth: 0 }}
          />
          <select
            value={unit}
            onChange={(e) => onUnitChange(e.target.value)}
            className="bg-background border border-border outline-none px-3 rounded-md cursor-pointer"
            style={{ height: 38, fontSize: 13, fontFamily: FONT, width: 92, flexShrink: 0 }}
          >
            <option value="days">Days</option>
            <option value="months">Months</option>
            <option value="years">Years</option>
          </select>
        </div>
      )}
    </div>
  );
}