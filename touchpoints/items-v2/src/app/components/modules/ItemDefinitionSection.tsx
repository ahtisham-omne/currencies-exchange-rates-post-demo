// @ts-nocheck
/**
 * ItemDefinitionSection — Slice Pair A render-path unification.
 * Literal extraction of the previous `ItemDefinitionContent` export that lived
 * in ItemConfigurationMaster.tsx (lines 254-642). No logic / markup changes —
 * pure file move so both render paths (Create modal + Detail page) mount the
 * same single source of truth.
 *
 * Source of original Category lift: ConfigureCategory.tsx ItemDefinitionContent
 * (lines 579-908). Category-literal two-column layout.
 */
import React, { useState } from 'react';
import {
  Plus, ChevronDown, Trash2, Box, Layers, Info, ShieldCheck, Tags, Star, ShoppingCart, Wrench,
} from 'lucide-react';
import { CfgField, RadioOption, CheckboxControl } from './configAtoms';
import { ConfigCard, ConfigSelect, UOMS } from './CreateItemModal';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import type { AdvancedConfig } from './ItemConfigurationMaster';

interface ItemDefinitionSectionProps {
  config: AdvancedConfig;
  onConfigChange: (key: keyof AdvancedConfig, value: any) => void;
  setFormData?: (fn: any) => void;
}

const FONT = 'Inter, system-ui, sans-serif';

export function ItemDefinitionSection({ config, onConfigChange, setFormData }: ItemDefinitionSectionProps) {
  const [lotControlOpen, setLotControlOpen] = useState(true);

  const toggleAcquisitionMethod = (method: string) => {
    const current = config.acquisitionMethod || [];
    const updated = current.includes(method)
      ? current.filter(m => m !== method)
      : [...current, method];
    onConfigChange('acquisitionMethod', updated);
    if (updated.length === 1) onConfigChange('primaryAcquisition', updated[0]);
  };

  return (
    <div className="grid grid-cols-2 gap-6" style={{ alignItems: 'start' }}>
      {/* Left column: Identity & Tracking */}
      <div className="flex flex-col" style={{ borderRadius: 8, border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF', overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
        <div className="px-5 flex items-center gap-2.5" style={{ height: '44px', borderBottom: '1px solid #EEF2F6', backgroundColor: '#FAFBFC' }}>
          <div className="flex items-center justify-center shrink-0" style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: '#EDF4FF' }}>
            <Box style={{ width: 14, height: 14, color: '#0A77FF' }} />
          </div>
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--foreground)', opacity: 0.7, letterSpacing: '0.8px', textTransform: 'uppercase', fontFamily: FONT }}>Identity & Tracking</span>
        </div>
        <div className="p-5 flex flex-col gap-5">
          {/* Inventory Type */}
          <CfgField label="Inventory Type" hint="Determine how this item is tracked in your inventory system." tooltip="Determines whether this item is physically stocked and counted in your warehouse or sourced only when needed.">
            {/* 2-col layout: Stock + Non-stock on row 1, Asset alone on row 2 left (Items viewport-aware divergence — Category uses 3-col but text wraps in modal-in-modal). */}
            <div className="grid grid-cols-2 gap-3 mt-2">
              {([
                { id: 'Stock', icon: Box, desc: 'Counted and replenished regularly.' },
                { id: 'Non-stock', icon: Layers, desc: 'Procured on-demand, not counted.' },
                { id: 'Asset', icon: ShieldCheck, desc: 'High-value, tracked individually.' },
              ] as const).map(t => {
                const isActive = config.inventoryType === t.id;
                return (
                  <button key={t.id} onClick={() => onConfigChange('inventoryType', t.id)}
                    className={`group relative rounded-xl overflow-hidden border transition-all duration-200 cursor-pointer text-left ${
                      isActive
                        ? 'border-[#93C5FD]/70 bg-[#EFF6FF] shadow-[0_1px_4px_rgba(10,119,255,0.06)]'
                        : 'border-[#E2E8F0] bg-white hover:border-[#BFDBFE] hover:bg-[#F8FAFF]'
                    }`}
                  >
                    <div className="relative flex flex-col items-start gap-2 p-4">
                      <div className="flex items-start justify-between w-full">
                        <div className={`w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0 transition-all duration-200 ${
                          isActive
                            ? 'bg-white text-[#0A77FF] shadow-[0_1px_3px_rgba(0,0,0,0.08)]'
                            : 'bg-[#F1F5F9] text-[#64748B] group-hover:scale-105'
                        }`}>
                          <t.icon className="w-[18px] h-[18px]" />
                        </div>
                        <div className="w-[18px] h-[18px] rounded-full flex items-center justify-center transition-all duration-200 shrink-0 mt-0.5" style={{
                          border: isActive ? '2px solid #3B82F6' : '1.5px solid #D1D5DB',
                          backgroundColor: 'white',
                        }}>
                          {isActive && <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#3B82F6' }} />}
                        </div>
                      </div>
                      <div>
                        <p className="text-[14px] font-semibold text-[#0F172A]" style={{ fontFamily: FONT }}>{t.id}</p>
                        <p className="text-[12px] mt-0.5 text-[#94A3B8]" style={{ fontFamily: FONT, lineHeight: 1.4 }}>{t.desc}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </CfgField>

          {/* Control Type */}
          <CfgField label="Control Type" hint="Define how individual units are identified and traced." tooltip="Defines how individual units of an item are identified and tracked inside inventory.">
            <div className="grid grid-cols-2 gap-3 mt-2">
              {([
                { id: 'Serialized', desc: 'Unique ID per unit.', slashed: false },
                { id: 'Non-serialized', desc: 'Tracked in bulk by quantity.', slashed: true },
              ] as const).map(ct => {
                const isActive = config.controlType === ct.id;
                return (
                  <button key={ct.id} onClick={() => onConfigChange('controlType', ct.id)}
                    className={`group relative rounded-xl overflow-hidden border transition-all duration-200 cursor-pointer text-left ${
                      isActive
                        ? 'border-[#93C5FD]/70 bg-[#EFF6FF] shadow-[0_1px_4px_rgba(10,119,255,0.06)]'
                        : 'border-[#E2E8F0] bg-white hover:border-[#BFDBFE] hover:bg-[#F8FAFF]'
                    }`}
                  >
                    <div className="relative flex flex-col items-start gap-2 p-4">
                      <div className="flex items-start justify-between w-full">
                        <div className={`w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0 transition-all duration-200 ${
                          isActive
                            ? 'bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08)]'
                            : 'bg-[#F1F5F9] group-hover:scale-105'
                        }`}>
                          <svg width="18" height="18" viewBox="0 0 28 28" fill="none">
                            <rect x="3" y="4" width="2.5" height="20" rx="1" fill={isActive ? '#0A77FF' : '#64748B'} />
                            <rect x="8" y="4" width="1.5" height="20" rx="0.75" fill={isActive ? '#0A77FF' : '#64748B'} />
                            <rect x="12" y="4" width="3" height="20" rx="1" fill={isActive ? '#0A77FF' : '#64748B'} />
                            <rect x="17.5" y="4" width="1.5" height="20" rx="0.75" fill={isActive ? '#0A77FF' : '#64748B'} />
                            <rect x="22" y="4" width="2.5" height="20" rx="1" fill={isActive ? '#0A77FF' : '#64748B'} />
                            {ct.slashed && <line x1="2" y1="26" x2="26" y2="2" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round" />}
                          </svg>
                        </div>
                        <div className="w-[18px] h-[18px] rounded-full flex items-center justify-center transition-all duration-200 shrink-0 mt-0.5" style={{
                          border: isActive ? '2px solid #3B82F6' : '1.5px solid #D1D5DB',
                          backgroundColor: 'white',
                        }}>
                          {isActive && <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#3B82F6' }} />}
                        </div>
                      </div>
                      <div>
                        <p className="text-[14px] font-semibold text-[#0F172A]" style={{ fontFamily: FONT }}>{ct.id}</p>
                        <p className="text-[12px] mt-0.5 text-[#94A3B8]" style={{ fontFamily: FONT, lineHeight: 1.4 }}>{ct.desc}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </CfgField>

          {/* Lot Tracking — ITEMS-NATIVE DIVERGENCE from Category: Lot Tracking is a toggle in Items, not a full card. */}
          <div className="flex flex-col gap-3">
            <div
              className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl border transition-all duration-200 cursor-pointer ${
                config.lotControlEnabled
                  ? 'border-[#93C5FD]/70 bg-[#EFF6FF]'
                  : 'border-[#E2E8F0] bg-white hover:border-[#BFDBFE] hover:bg-[#F8FAFF]'
              }`}
              onClick={() => {
                const newVal = !config.lotControlEnabled;
                onConfigChange('lotControlEnabled', newVal);
                if (newVal) setLotControlOpen(true);
              }}
            >
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 transition-all duration-200 ${
                  config.lotControlEnabled
                    ? 'bg-white text-[#0A77FF] shadow-[0_1px_3px_rgba(0,0,0,0.08)]'
                    : 'bg-[#F1F5F9] text-[#64748B]'
                }`}>
                  <Tags className="w-[16px] h-[16px]" />
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-[#0F172A]" style={{ fontFamily: FONT }}>Lot Tracking</p>
                  <p className="text-[11px] text-[#94A3B8]" style={{ fontFamily: FONT, lineHeight: 1.4 }}>Enable strict lot control.</p>
                </div>
              </div>
              {/* Toggle switch */}
              <button
                type="button"
                role="switch"
                aria-checked={!!config.lotControlEnabled}
                onClick={(e) => {
                  e.stopPropagation();
                  const newVal = !config.lotControlEnabled;
                  onConfigChange('lotControlEnabled', newVal);
                  if (newVal) setLotControlOpen(true);
                }}
                className="relative inline-flex shrink-0 cursor-pointer items-center rounded-full transition-colors"
                style={{
                  width: 36, height: 20,
                  backgroundColor: config.lotControlEnabled ? '#0A77FF' : '#E2E8F0',
                }}
              >
                <span
                  className="inline-block rounded-full bg-white shadow transition-transform"
                  style={{
                    width: 16, height: 16,
                    transform: config.lotControlEnabled ? 'translateX(18px)' : 'translateX(2px)',
                  }}
                />
              </button>
            </div>

            {config.lotControlEnabled && lotControlOpen && (
              <div className="flex flex-col gap-4 pl-1 pr-1">
                <CfgField label="Lot ID Assignment" hint="">
                  <div className="flex flex-col gap-2 mt-2">
                    <RadioOption selected={config.lotIdSource === 'system'} onSelect={() => onConfigChange('lotIdSource', 'system')} label="System Generated" desc="Auto-generate IDs based on prefix." />
                    <RadioOption selected={config.lotIdSource === 'vendor'} onSelect={() => onConfigChange('lotIdSource', 'vendor')} label="Use vendor lot as lot ID" desc="The vendor's lot number becomes the Lot ID in your system." />
                  </div>
                </CfgField>

                <div className="flex items-center gap-3">
                  <CheckboxControl checked={!!config.shelfLifeEnabled} onChange={(c) => onConfigChange('shelfLifeEnabled', c)} />
                  <label className="flex items-center gap-1.5 cursor-pointer" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--foreground)', fontFamily: FONT }}>
                    Shelf Life & Quarantine Period
                    <Info style={{ width: '13px', height: '13px', color: 'var(--foreground)', opacity: 0.35 }} />
                  </label>
                </div>

                <CfgField label="Item ID Prefix" hint="">
                  <div className="flex mt-2" style={{ borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                    <div className="px-3 py-2 flex items-center border border-r-0 border-border" style={{ backgroundColor: 'var(--secondary)', fontSize: '13px', fontFamily: "'JetBrains Mono', monospace", color: 'var(--foreground)', opacity: 0.5 }}>
                      LOT—
                    </div>
                    <input
                      value={(config.lotPrefix ?? '').replace('LOT-', '')}
                      onChange={(e) => onConfigChange('lotPrefix', `LOT-${e.target.value}`)}
                      className="flex-1 bg-background border border-border outline-none px-3 border-l-0"
                      style={{ height: '40px', fontSize: '13px', fontFamily: "'JetBrains Mono', monospace" }}
                      placeholder="Enter Item Prefix"
                    />
                  </div>
                </CfgField>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right column: Measurement & Source */}
      <div className="flex flex-col" style={{ borderRadius: 8, border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF', overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
        <div className="px-5 flex items-center gap-2.5" style={{ height: '44px', borderBottom: '1px solid #EEF2F6', backgroundColor: '#FAFBFC' }}>
          <div className="flex items-center justify-center shrink-0" style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: '#EDF4FF' }}>
            <Layers style={{ width: 14, height: 14, color: '#0A77FF' }} />
          </div>
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--foreground)', opacity: 0.7, letterSpacing: '0.8px', textTransform: 'uppercase', fontFamily: FONT }}>Measurement & Source</span>
        </div>
        <div className="p-5 flex flex-col gap-6">
          {/* Base UOM */}
          <CfgField label="Base Unit of Measure (UOM)" hint="The primary unit used for counting and valuing this item." tooltip="The unit your inventory uses to count and store this item — for example, Each, Kg, or Litre.">
            <div className="mt-2">
              <ConfigSelect value={config.uom} onValueChange={(v: string) => onConfigChange('uom', v)} options={UOMS} placeholder="Select UOM..." />
            </div>
          </CfgField>

          {/* Alternative Units */}
          <CfgField label={
            <div className="flex items-center justify-between w-full">
              <span>Alternative Units</span>
              <button
                onClick={() => {
                  if (setFormData) {
                    const newUnit = { id: String(Date.now()), unit: '', conversionFactor: '1' };
                    setFormData((prev: any) => ({
                      ...prev,
                      config: { ...prev.config, alternativeUnits: [...(prev.config.alternativeUnits || []), newUnit] },
                    }));
                  }
                }}
                className="flex items-center gap-1.5"
                style={{ fontSize: '13px', fontWeight: 500, fontFamily: FONT, color: 'var(--foreground)' }}
              >
                <Plus style={{ width: 14, height: 14 }} /> Add Unit
              </button>
            </div>
          } hint="Define unit conversions for flexible ordering and selling." tooltip="Define additional units of measure that can be used instead of the base UOM when transacting.">
            {(!config.alternativeUnits || config.alternativeUnits.length === 0) ? (
              <div className="mt-2 flex items-center justify-center" style={{
                minHeight: '150px', borderRadius: '8px',
                border: '1.5px dashed var(--border)',
                backgroundColor: 'rgba(247,247,248,0.3)',
              }}>
                <span style={{ fontSize: '12px', color: 'var(--foreground)', opacity: 0.4, fontFamily: FONT, textAlign: 'center', lineHeight: 1.5 }}>
                  No alternative units defined.<br />Click 'Add Unit' to create conversions.
                </span>
              </div>
            ) : (
              <div className="mt-2 space-y-2">
                {config.alternativeUnits.map((altUnit: any) => (
                  <div key={altUnit.id} className="flex items-center gap-2 p-3 rounded-lg border border-[var(--border)] bg-[var(--card)]/50">
                    <div className="flex-1 grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase text-[var(--muted-foreground)] font-semibold">Unit</Label>
                        <ConfigSelect
                          value={altUnit.unit}
                          onValueChange={(v: string) => {
                            if (setFormData) {
                              setFormData((prev: any) => ({
                                ...prev,
                                config: {
                                  ...prev.config,
                                  alternativeUnits: prev.config.alternativeUnits?.map((u: any) =>
                                    u.id === altUnit.id ? { ...u, unit: v } : u
                                  ),
                                },
                              }));
                            }
                          }}
                          options={UOMS.filter((u: string) => u !== config.uom)}
                          placeholder="Select unit"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase text-[var(--muted-foreground)] font-semibold">Conversion Factor</Label>
                        <Input
                          type="number"
                          value={altUnit.conversionFactor}
                          onChange={(e) => {
                            if (setFormData) {
                              setFormData((prev: any) => ({
                                ...prev,
                                config: {
                                  ...prev.config,
                                  alternativeUnits: prev.config.alternativeUnits?.map((u: any) =>
                                    u.id === altUnit.id ? { ...u, conversionFactor: e.target.value } : u
                                  ),
                                },
                              }));
                            }
                          }}
                          className="h-9 border-[var(--border)]"
                          placeholder="1"
                        />
                      </div>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        if (setFormData) {
                          setFormData((prev: any) => ({
                            ...prev,
                            config: {
                              ...prev.config,
                              alternativeUnits: prev.config.alternativeUnits?.filter((u: any) => u.id !== altUnit.id),
                            },
                          }));
                        }
                      }}
                      className="h-9 w-9 text-[var(--muted-foreground)] hover:text-[var(--destructive)] shrink-0"
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CfgField>

          {/* Acquisition Method */}
          <CfgField label="Acquisition Method" hint="How is this item brought into stock? (Select all that apply)" tooltip="Defines how this item is brought into stock — sourced from a vendor, produced internally, or both.">
            <div className="grid grid-cols-2 gap-3 mt-2">
              {[
                { id: 'Purchased', label: 'Purchased', Icon: ShoppingCart, desc: 'Sourced from external vendors or suppliers through purchase orders.', colors: { border: '#93C5FD', icon: '#0A77FF', badge: '#3B82F6', bgSel: '#EFF6FF' } },
                { id: 'Manufactured', label: 'Manufactured', Icon: Wrench, desc: 'Produced in-house using internal resources and raw materials.', colors: { border: '#FCD34D', icon: '#D97706', badge: '#D97706', bgSel: '#FFFBEB' } },
              ].map((method) => {
                const isActive = (config.acquisitionMethod || []).includes(method.id);
                const bothSelected = (config.acquisitionMethod || []).includes('Purchased') && (config.acquisitionMethod || []).includes('Manufactured');
                const isPrimary = config.primaryAcquisition === method.id;
                const c = method.colors;
                return (
                  <button key={method.id}
                    onClick={() => toggleAcquisitionMethod(method.id)}
                    className="group relative rounded-xl overflow-hidden transition-all duration-200 cursor-pointer text-left"
                    style={{
                      border: isActive ? `1px solid ${c.border}` : '1px solid #E2E8F0',
                      backgroundColor: 'white',
                      boxShadow: isActive ? `0 1px 4px ${c.badge}10` : 'none',
                    }}
                  >
                    <div className="absolute inset-0 pointer-events-none transition-all duration-300" style={{
                      background: isActive ? `linear-gradient(135deg, ${c.bgSel}80, transparent)` : 'none',
                    }} />
                    <div className="relative flex flex-col items-start gap-2 p-4">
                      <div className="flex items-start justify-between w-full">
                        <div className="w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0 transition-all duration-200" style={{
                          backgroundColor: isActive ? 'white' : '#F1F5F9',
                          boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                          color: isActive ? c.icon : '#64748B',
                        }}>
                          <method.Icon className="w-[18px] h-[18px]" />
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                          {bothSelected && isActive && (
                            isPrimary ? (
                              <span className="inline-flex items-center px-2 py-[3px] rounded-md text-[10px] text-white" style={{ fontWeight: 600, fontFamily: FONT, backgroundColor: c.badge }}>
                                Primary
                              </span>
                            ) : (
                              <Star
                                onClick={(e) => { e.stopPropagation(); onConfigChange('primaryAcquisition', method.id); }}
                                className="cursor-pointer transition-all hover:opacity-80"
                                style={{ width: 16, height: 16, color: '#D1D5DB', fill: 'none' }}
                              />
                            )
                          )}
                        </div>
                      </div>
                      <div>
                        <p className="text-[14px] font-semibold text-[#0F172A]" style={{ fontFamily: FONT }}>{method.label}</p>
                        <p className="text-[12px] mt-0.5 text-[#94A3B8]" style={{ fontFamily: FONT, lineHeight: 1.4 }}>{method.desc}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </CfgField>
        </div>
      </div>
    </div>
  );
}
