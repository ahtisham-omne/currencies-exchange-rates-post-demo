// @ts-nocheck
/**
 * SellingSection — Slice Pair B render-path unification.
 * Literal extraction of `SellingBody` + `PartnerPopover` + `RulesPopover`
 * from ConfigurationSections.tsx (lines 840-1097). No markup changes.
 *
 * Source of original Category lift: ConfigureCategory.tsx FulfillmentSection
 * (lines 1651-1912). Items state binds: sellingScope, specificPartners,
 * partnerRules, plus togglePartner & updatePartnerRules callbacks.
 */
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Search, Check, ChevronDown, X, Trash2, Users, Store, DollarSign } from 'lucide-react';
import { RadioOption, CheckboxControl } from './configAtoms';
import { ConfigCard, MOCK_PARTNERS, PRICING_RULES } from './CreateItemModal';
import { CurrencySymbol } from './CurrencySymbol';
import type { AdvancedConfig } from './ItemConfigurationMaster';

const FONT = 'Inter, system-ui, sans-serif';

interface SellingSectionProps {
  config: AdvancedConfig;
  onConfigChange: (key: keyof AdvancedConfig, value: any) => void;
  togglePartner: (partnerId: string) => void;
  updatePartnerRules: (partnerId: string, ruleIds: string[]) => void;
}

export function SellingSection({ config, onConfigChange, togglePartner, updatePartnerRules }: SellingSectionProps) {
  const [partnerSearch, setPartnerSearch] = useState('');
  const [partnerPopoverOpen, setPartnerPopoverOpen] = useState(false);
  const [rulesPopoverPartner, setRulesPopoverPartner] = useState<string | null>(null);

  const pricing = config.pricing || [];
  const PRICE_UOMS = ['Each', 'Box', 'Case', 'Pallet', 'kg', 'm'];
  const [openUomId, setOpenUomId] = useState<string | null>(null);
  const [uomSearch, setUomSearch] = useState('');
  const [dropdownPos, setDropdownPos] = useState<{ top: number; right: number }>({ top: 0, right: 0 });

  const addPriceRow = () => {
    const newId = Math.random().toString(36).substr(2, 9);
    onConfigChange('pricing', [...pricing, { id: newId, price: '', uom: '' }]);
  };
  const removePriceRow = (id: string) => {
    onConfigChange('pricing', pricing.filter((p: any) => p.id !== id));
  };
  const updatePriceField = (id: string, field: string, val: string) => {
    onConfigChange('pricing', pricing.map((p: any) => p.id === id ? { ...p, [field]: val } : p));
  };

  const addRule = (partnerId: string, ruleId: string) => {
    const current = config.partnerRules?.[partnerId] || [];
    if (!current.includes(ruleId)) updatePartnerRules(partnerId, [...current, ruleId]);
  };
  const removeRule = (partnerId: string, ruleId: string) => {
    const current = config.partnerRules?.[partnerId] || [];
    updatePartnerRules(partnerId, current.filter((id: string) => id !== ruleId));
  };

  const sellingScope = config.sellingScope;
  const specificPartners = config.specificPartners || [];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <ConfigCard
        title="Selling Scope"
        icon={Store}
        tooltip="Control which partners can sell this item. Choose between making it available to all partners or restricting it to a specific list."
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3">
            <RadioOption
              selected={sellingScope === 'all'}
              onSelect={() => onConfigChange('sellingScope', 'all')}
              label="Sell to all partners (customers)"
              desc="This item is available to all partners with no exception."
            />
            <RadioOption
              selected={sellingScope === 'specific'}
              onSelect={() => onConfigChange('sellingScope', 'specific')}
              label="Sell to specific partners only"
              desc="Restricts this item to a selected list of partners only. Useful for exclusive products or contract-based arrangements."
            />
          </div>

          {sellingScope === 'specific' && (
            <div className="mt-2">
              {specificPartners.length > 0 ? (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: '#9CA3AF', fontFamily: FONT }}>Partner Configuration</span>
                    <div className="relative">
                      <button onClick={() => setPartnerPopoverOpen(!partnerPopoverOpen)} className="flex items-center gap-1.5 px-3 border border-dashed border-border hover:bg-secondary/50 transition-colors" style={{ height: 28, borderRadius: 6, fontSize: 12, fontWeight: 500, fontFamily: FONT, color: 'var(--foreground)' }}>
                        <Plus style={{ width: 12, height: 12 }} />
                        Add / Remove Partners
                      </button>
                      {partnerPopoverOpen && (
                        <PartnerPopover
                          search={partnerSearch}
                          setSearch={setPartnerSearch}
                          selectedPartners={specificPartners}
                          onToggle={togglePartner}
                          onClose={() => setPartnerPopoverOpen(false)}
                        />
                      )}
                    </div>
                  </div>

                  <div style={{ borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
                    {specificPartners.map((partnerId, idx) => {
                      const partner = MOCK_PARTNERS.find(p => p.id === partnerId);
                      if (!partner) return null;
                      const ruleIds = config.partnerRules?.[partnerId] || [];
                      const hasRules = ruleIds.length > 0;
                      return (
                        <div key={partnerId} className="flex items-center justify-between px-4 py-3 group hover:bg-secondary/30 transition-colors" style={{ borderBottom: idx < specificPartners.length - 1 ? '1px solid var(--border)' : 'none' }}>
                          <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center" style={{ width: 28, height: 28, borderRadius: 6, background: 'hsl(var(--primary) / 0.08)', fontSize: 10, fontWeight: 700, color: 'var(--primary)', border: '1px solid hsl(var(--primary) / 0.15)' }}>{partner.name.substring(0, 2).toUpperCase()}</div>
                            <div>
                              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)', fontFamily: FONT }}>{partner.name}</span>
                              <div className="flex items-center gap-1.5">
                                <span style={{ fontSize: 10, color: '#9CA3AF', fontFamily: FONT }}>{partner.id}</span>
                                {hasRules && (
                                  <>
                                    <span style={{ width: 3, height: 3, borderRadius: '50%', backgroundColor: 'var(--border)', display: 'inline-block' }} />
                                    <span style={{ fontSize: 10, color: 'var(--primary)', fontWeight: 600, fontFamily: FONT }}>{ruleIds.length} Rules Active</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                            <div className="relative">
                              <button
                                onClick={() => setRulesPopoverPartner(rulesPopoverPartner === partnerId ? null : partnerId)}
                                className="flex items-center gap-1 px-2 hover:bg-secondary transition-colors"
                                style={{ height: 26, borderRadius: 6, fontSize: 11, fontWeight: 500, fontFamily: FONT, color: hasRules ? 'var(--primary)' : 'var(--foreground)', border: '1px solid var(--border)' }}
                              >
                                {hasRules ? 'Edit Rules' : 'Add Rule'}
                                <ChevronDown style={{ width: 10, height: 10, opacity: 0.5 }} />
                              </button>
                              {rulesPopoverPartner === partnerId && (
                                <RulesPopover
                                  partnerId={partnerId}
                                  partnerName={partner.name}
                                  activeRuleIds={ruleIds}
                                  onAddRule={(ruleId) => addRule(partnerId, ruleId)}
                                  onRemoveRule={(ruleId) => removeRule(partnerId, ruleId)}
                                  onClose={() => setRulesPopoverPartner(null)}
                                />
                              )}
                            </div>
                            <button onClick={() => togglePartner(partnerId)} className="flex items-center justify-center hover:bg-destructive/10 hover:text-destructive transition-colors" style={{ width: 28, height: 28, borderRadius: 6 }}>
                              <Trash2 style={{ width: 13, height: 13, color: '#9CA3AF' }} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10" style={{ borderRadius: 10, border: '1.5px dashed var(--border)', backgroundColor: 'rgba(247,247,248,0.3)' }}>
                  <Users style={{ width: 36, height: 36, color: '#9CA3AF', marginBottom: 8 }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', fontFamily: FONT }}>No Specific Partners</span>
                  <span style={{ fontSize: 12, color: '#71717A', fontFamily: FONT, marginTop: 4, textAlign: 'center', maxWidth: 240 }}>Standard global pricing will apply to all customers unless specified here.</span>
                  <div className="relative mt-3">
                    <button onClick={() => setPartnerPopoverOpen(!partnerPopoverOpen)} className="flex items-center gap-1.5 px-4 border border-dashed border-border hover:bg-secondary/50 transition-colors" style={{ height: 32, borderRadius: 6, fontSize: 12, fontWeight: 500, fontFamily: FONT, color: 'var(--foreground)' }}>
                      <Plus style={{ width: 14, height: 14 }} /> Select Partners
                    </button>
                    {partnerPopoverOpen && (
                      <PartnerPopover
                        search={partnerSearch}
                        setSearch={setPartnerSearch}
                        selectedPartners={specificPartners}
                        onToggle={togglePartner}
                        onClose={() => setPartnerPopoverOpen(false)}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </ConfigCard>

      {/* Custom Price Per Unit — manual card to allow dropdown overflow */}
      <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 8, boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
        {/* Card header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', borderRadius: '8px 8px 0 0' }}>
          <div style={{ width: 24, height: 24, borderRadius: 6, backgroundColor: '#EDF4FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <DollarSign style={{ width: 13, height: 13, color: '#3B82F6' }} />
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#1E293B', fontFamily: FONT }}>Custom Price Per Unit</span>
        </div>
        {/* Card body */}
        <div style={{ padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: '#9CA3AF', fontFamily: FONT }}>
              Defined Prices
            </span>
            <button
              onClick={addPriceRow}
              disabled={pricing.length >= PRICE_UOMS.length}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', cursor: pricing.length >= PRICE_UOMS.length ? 'not-allowed' : 'pointer', opacity: pricing.length >= PRICE_UOMS.length ? 0.4 : 1 }}
            >
              <Plus style={{ width: 12, height: 12 }} />
            </button>
          </div>

          {pricing.length === 0 ? (
            <div style={{ padding: '20px 0', textAlign: 'center', color: '#9CA3AF', fontSize: 13, fontFamily: FONT }}>
              No prices defined. Click + to add one.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {pricing.map((row: any) => {
                const usedUoms = pricing.filter((p: any) => p.id !== row.id).map((p: any) => p.uom);
                const availableUoms = PRICE_UOMS.filter(u => !usedUoms.includes(u));
                return (
                  <div key={row.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <CurrencySymbol
                        style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', fontSize: 13, fontFamily: FONT, fontWeight: 500 }}
                      />
                      <input
                        value={row.price}
                        onChange={(e) => { const v = e.target.value; if (/^\d*\.?\d*$/.test(v)) updatePriceField(row.id, 'price', v); }}
                        placeholder="0.00"
                        style={{ width: '100%', paddingLeft: 34, paddingRight: 8, height: 36, border: '1px solid #E2E8F0', borderRadius: 6, background: '#fff', fontSize: 13, fontFamily: FONT, outline: 'none', color: 'var(--foreground)' }}
                      />
                    </div>
                    <button
                      onClick={(e) => {
                        if (openUomId === row.id) { setOpenUomId(null); return; }
                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        setDropdownPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
                        setUomSearch('');
                        setOpenUomId(row.id);
                      }}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, height: 36, paddingLeft: 10, paddingRight: 8, border: '1px solid #E2E8F0', borderRadius: 6, background: '#fff', fontSize: 13, fontFamily: FONT, minWidth: 110, cursor: 'pointer', color: 'var(--foreground)', flexShrink: 0 }}
                    >
                      <span>{row.uom || 'Select unit'}</span>
                      <ChevronDown style={{ width: 12, height: 12, opacity: 0.5, flexShrink: 0 }} />
                    </button>
                    <button
                      onClick={() => removePriceRow(row.id)}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', flexShrink: 0 }}
                    >
                      <Trash2 style={{ width: 13, height: 13, color: '#9CA3AF' }} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* UOM dropdown — portaled to document.body so position:fixed anchors to
          the viewport, not a transformed ancestor (framer-motion wrappers in
          the create-item modal leave residual transforms that otherwise
          hijack the containing block). */}
      {openUomId !== null && typeof document !== 'undefined' && (() => {
        const row = pricing.find((p: any) => p.id === openUomId);
        if (!row) return null;
        const usedUoms = pricing.filter((p: any) => p.id !== openUomId).map((p: any) => p.uom);
        const availableUoms = PRICE_UOMS.filter(u => !usedUoms.includes(u));
        const filteredUoms = availableUoms.filter(u => u.toLowerCase().includes(uomSearch.toLowerCase()));
        return createPortal(
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={() => setOpenUomId(null)} />
            <div style={{ position: 'fixed', top: dropdownPos.top, right: dropdownPos.right, zIndex: 9999, width: 150, background: 'var(--card)', border: '0.75px solid var(--border)', borderRadius: 10, boxShadow: '0 4px 24px -4px rgba(0,0,0,0.15)', overflow: 'hidden' }}>
              <div style={{ padding: '6px 10px', borderBottom: '0.75px solid var(--border)' }}>
                <div style={{ position: 'relative' }}>
                  <Search style={{ position: 'absolute', left: 6, top: '50%', transform: 'translateY(-50%)', width: 12, height: 12, color: '#9CA3AF' }} />
                  <input
                    value={uomSearch}
                    onChange={e => setUomSearch(e.target.value)}
                    placeholder="Search..."
                    autoFocus
                    style={{ width: '100%', paddingLeft: 22, height: 28, border: 'none', outline: 'none', background: 'transparent', fontSize: 12, fontFamily: FONT }}
                  />
                </div>
              </div>
              <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                {filteredUoms.length === 0 ? (
                  <div style={{ padding: '10px 12px', fontSize: 12, color: '#9CA3AF', fontFamily: FONT }}>No results.</div>
                ) : (
                  filteredUoms.map(uom => (
                    <div
                      key={uom}
                      onClick={() => { updatePriceField(openUomId, 'uom', uom); setOpenUomId(null); setUomSearch(''); }}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', cursor: 'pointer', fontSize: 13, fontFamily: FONT, color: 'var(--foreground)' }}
                      onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'var(--secondary)')}
                      onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
                    >
                      <Check style={{ width: 12, height: 12, color: 'var(--primary)', opacity: row.uom === uom ? 1 : 0, flexShrink: 0 }} />
                      {uom}
                    </div>
                  ))
                )}
              </div>
            </div>
          </>,
          document.body
        );
      })()}

    </div>
  );
}

/* ── Partner Popover — Category-literal lift (ConfigureCategory.tsx 1806-1841) ── */
function PartnerPopover({ search, setSearch, selectedPartners, onToggle, onClose }: {
  search: string; setSearch: (s: string) => void; selectedPartners: string[]; onToggle: (id: string) => void; onClose: () => void;
}) {
  const filtered = MOCK_PARTNERS.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
  return (
    <>
      <div className="fixed inset-0 z-20" onClick={onClose} />
      <div className="absolute right-0 z-30" style={{ top: 'calc(100% + 4px)', width: 300, background: 'var(--card)', border: '0.75px solid var(--border)', borderRadius: 10, boxShadow: '0 4px 24px -4px rgba(0,0,0,0.15)', overflow: 'hidden' }}>
        <div className="px-3 py-2" style={{ borderBottom: '0.75px solid var(--border)' }}>
          <div className="relative">
            <Search style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: '#9CA3AF' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search partners..." className="w-full outline-none bg-transparent pl-8" style={{ height: 32, fontSize: 12, fontFamily: FONT }} autoFocus />
          </div>
        </div>
        <div style={{ maxHeight: 240, overflowY: 'auto' }}>
          {filtered.map(partner => {
            const isSelected = selectedPartners.includes(partner.id);
            return (
              <div key={partner.id} onClick={() => { onToggle(partner.id); onClose(); }} className="flex items-center gap-2 px-3 cursor-pointer transition-colors" style={{ height: 40, fontSize: 12, fontFamily: FONT }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'var(--secondary)')}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
              >
                <CheckboxControl checked={isSelected} onChange={() => { onToggle(partner.id); onClose(); }} />
                <div className="flex-1 min-w-0">
                  <div style={{ fontSize: 12, fontWeight: isSelected ? 600 : 400, color: 'var(--foreground)' }}>{partner.name}</div>
                  <div style={{ fontSize: 10, color: '#9CA3AF' }}>{partner.id}</div>
                </div>
                {isSelected && <Check style={{ width: 12, height: 12, color: 'var(--primary)' }} />}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

/* ── Rules Popover — Category-literal lift (ConfigureCategory.tsx 1845-1912) ── */
function RulesPopover({ partnerId, partnerName, activeRuleIds, onAddRule, onRemoveRule, onClose }: {
  partnerId: string; partnerName: string; activeRuleIds: string[];
  onAddRule: (ruleId: string) => void; onRemoveRule: (ruleId: string) => void; onClose: () => void;
}) {
  const activeRules = PRICING_RULES.filter(r => activeRuleIds.includes(r.id));
  const availableRules = PRICING_RULES.filter(r => !activeRuleIds.includes(r.id));

  return (
    <>
      <div className="fixed inset-0 z-20" onClick={onClose} />
      <div className="absolute right-0 z-[100]" style={{ top: 'calc(100% + 4px)', width: 340, background: 'var(--card)', border: '0.75px solid var(--border)', borderRadius: 10, boxShadow: '0 4px 24px -4px rgba(0,0,0,0.15)' }}>
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '0.75px solid var(--border)' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', fontFamily: FONT }}>Pricing Rules</span>
          <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 6, backgroundColor: 'hsl(var(--primary) / 0.08)', color: 'var(--primary)', fontFamily: FONT }}>{partnerName}</span>
        </div>

        {activeRules.length > 0 && (
          <div className="px-3 py-2">
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', color: '#94A3B8', fontFamily: FONT }}>Active</span>
            <div className="flex flex-col gap-1.5 mt-2">
              {activeRules.map(rule => (
                <div key={rule.id} className="flex items-start justify-between p-2.5" style={{ borderRadius: 8, border: '1px solid hsl(var(--primary) / 0.15)', backgroundColor: 'hsl(var(--primary) / 0.03)' }}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--foreground)', fontFamily: FONT }}>{rule.name}</span>
                      <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--primary)', fontFamily: FONT }}>{rule.value}</span>
                    </div>
                    <span style={{ fontSize: 10, color: '#71717A', fontFamily: FONT }}>{rule.summary}</span>
                  </div>
                  <button onClick={() => onRemoveRule(rule.id)} className="shrink-0 flex items-center justify-center hover:bg-foreground/10 transition-colors" style={{ width: 18, height: 18, borderRadius: 9999 }}>
                    <X style={{ width: 10, height: 10, color: '#9CA3AF' }} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {availableRules.length > 0 && (
          <div className="px-3 py-2" style={{ borderTop: activeRules.length > 0 ? '0.75px solid var(--border)' : 'none' }}>
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', color: '#94A3B8', fontFamily: FONT }}>Available to Add</span>
            <div className="flex flex-col mt-2">
              {availableRules.map(rule => (
                <div
                  key={rule.id}
                  onClick={() => onAddRule(rule.id)}
                  className="flex items-start justify-between p-2.5 cursor-pointer hover:bg-secondary/50 transition-colors"
                  style={{ borderRadius: 8 }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--foreground)', fontFamily: FONT }}>{rule.name}</span>
                      <span style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', fontFamily: FONT }}>{rule.value}</span>
                    </div>
                    <span style={{ fontSize: 10, color: '#71717A', fontFamily: FONT }}>{rule.summary}</span>
                  </div>
                  <Plus style={{ width: 12, height: 12, color: '#9CA3AF', marginTop: 2 }} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
