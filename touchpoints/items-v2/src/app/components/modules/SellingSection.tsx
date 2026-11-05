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
import React, { useMemo, useState } from 'react';
import {
  Plus, Trash2, Users, Store, DollarSign,
  Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
} from 'lucide-react';
import { RadioOption } from './configAtoms';
import { BASE_CURRENCY } from '@/app/currency/currencies';
import { basePrefix } from '@/app/currency/itemMoney';
import { ConfigCard, ConfigSelect, UOMS } from './CreateItemModal';
import { SelectCustomersModal } from './SelectCustomersModal';
import { AVAILABLE_VENDORS } from '../../context/purchasing/mockData';
import type { AvailableVendor } from '../../context/purchasing/types';
import type { AdvancedConfig } from './ItemConfigurationMaster';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

const FONT = 'Inter, system-ui, sans-serif';

interface SellingSectionProps {
  config: AdvancedConfig;
  onConfigChange: (key: keyof AdvancedConfig, value: any) => void;
  togglePartner: (partnerId: string) => void;
  updatePartnerRules: (partnerId: string, ruleIds: string[]) => void;
}

export function SellingSection({ config, onConfigChange, togglePartner, updatePartnerRules }: SellingSectionProps) {
  void updatePartnerRules; // pricing rules removed from this surface
  const [partnerModalOpen, setPartnerModalOpen] = useState(false);

  const sellingScope = config.sellingScope;
  const specificPartners = config.specificPartners || [];

  /* ── Custom Price Per Unit handlers (visible only when sellingScope === 'all') ── */
  const pricing = config.pricing || [];
  const addPriceTier = () => {
    onConfigChange('pricing', [
      ...pricing,
      { id: `pt-${Date.now()}`, price: '0.00', uom: 'Each' },
    ] as any);
  };
  const updatePriceTier = (id: string, field: 'price' | 'uom', val: string) => {
    onConfigChange(
      'pricing',
      pricing.map((p: any) => (p.id === id ? { ...p, [field]: val } : p)) as any,
    );
  };
  const removePriceTier = (id: string) => {
    onConfigChange('pricing', pricing.filter((p: any) => p.id !== id) as any);
  };

  /* ── Bulk add from SelectCustomersModal ── */
  const addCustomers = (vendors: AvailableVendor[]) => {
    const ids = vendors.map((v) => v.id);
    const next = Array.from(new Set([...specificPartners, ...ids]));
    onConfigChange('specificPartners', next);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <ConfigCard
        title="Selling Scope"
        icon={Store}
        tooltip="Control which partners can sell this item. Choose between making it available to all partners or restricting it to a specific list."
      >
        <div className="flex flex-col gap-4">
          {/* Scope options — Category-literal RadioOption cards */}
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

          {/* Specific partners config */}
          {sellingScope === 'specific' && (
            <div className="mt-2">
              <SpecificPartnersPanel
                partnerIds={specificPartners}
                onRemove={togglePartner}
                onOpenPicker={() => setPartnerModalOpen(true)}
              />
            </div>
          )}
        </div>
      </ConfigCard>

      {/* Custom Price Per Unit — visible only when selling to all partners */}
      {sellingScope === 'all' && (
        <ConfigCard
          title="Custom Price Per Unit"
          icon={DollarSign}
          tooltip="Set a default selling price per unit for this item. Defined prices apply to every partner when selling globally."
        >
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: '#9CA3AF', fontFamily: FONT }}>Defined Prices</span>
              <button
                onClick={addPriceTier}
                className="flex items-center justify-center hover:bg-secondary transition-colors"
                style={{ width: 28, height: 28, borderRadius: 6, color: 'var(--foreground)' }}
                aria-label="Add price"
              >
                <Plus style={{ width: 14, height: 14 }} />
              </button>
            </div>

            {pricing.length === 0 ? (
              <div className="flex items-center justify-center py-8" style={{ borderRadius: 10, border: '1.5px dashed var(--border)', backgroundColor: 'rgba(247,247,248,0.3)' }}>
                <span style={{ fontSize: 12, color: '#71717A', fontFamily: FONT }}>No prices defined. Click + to add a price tier.</span>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {pricing.map((row: any) => (
                  <div key={row.id} className="flex items-center gap-2">
                    <div className="flex items-center flex-1 min-w-0 bg-white border border-border rounded-lg px-3" style={{ height: 40 }}>
                      <span style={{ fontSize: 13, color: '#94A3B8', fontFamily: FONT, marginRight: 6 }}>{basePrefix()}</span>
                      <input
                        type="number"
                        step="0.01"
                        value={row.price}
                        onChange={(e) => updatePriceTier(row.id, 'price', e.target.value)}
                        className="flex-1 bg-transparent outline-none"
                        style={{ fontSize: 13, fontFamily: "'JetBrains Mono', monospace", color: '#0F172A' }}
                        placeholder="0.00"
                        aria-label={`Price in ${BASE_CURRENCY}`}
                      />
                      {/* Item prices stay in the base currency (spec 4.1). */}
                      <span style={{ fontSize: 11, color: '#94A3B8', fontFamily: FONT, marginLeft: 6 }}>{BASE_CURRENCY}</span>
                    </div>
                    <div style={{ width: 140 }}>
                      <ConfigSelect
                        value={row.uom}
                        onValueChange={(v: string) => updatePriceTier(row.id, 'uom', v)}
                        options={UOMS}
                        placeholder="Unit"
                      />
                    </div>
                    <button
                      onClick={() => removePriceTier(row.id)}
                      className="flex items-center justify-center text-slate-400 hover:text-destructive hover:bg-[#FEF2F2] rounded-md transition-colors shrink-0"
                      style={{ width: 32, height: 40 }}
                      aria-label="Remove price"
                    >
                      <Trash2 style={{ width: 14, height: 14 }} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </ConfigCard>
      )}

      {/* Select Customers Modal — multi-select picker mirroring Add Vendor design */}
      <SelectCustomersModal
        open={partnerModalOpen}
        onOpenChange={setPartnerModalOpen}
        existingIds={specificPartners}
        onSubmit={addCustomers}
      />
    </div>
  );
}

/* ── SpecificPartnersPanel — vendor-style list view for selected customers.
   Mirrors the QualifiedVendorsPanel layout: bordered card with toolbar
   (search + count + "Add Partner" pill button on the right), simplified
   list rows (avatar + name + role badges + location + remove), and a
   pagination footer with records-per-page select. ── */
function SpecificPartnersPanel({
  partnerIds, onRemove, onOpenPicker,
}: {
  partnerIds: string[];
  onRemove: (id: string) => void;
  onOpenPicker: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const partners = useMemo(
    () =>
      partnerIds
        .map((id) => AVAILABLE_VENDORS.find((v) => v.id === id))
        .filter(Boolean) as AvailableVendor[],
    [partnerIds],
  );

  const visible = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return partners;
    return partners.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.address ?? p.location ?? '').toLowerCase().includes(q),
    );
  }, [partners, searchQuery]);

  const totalCount = visible.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(page, totalPages);
  const startIdx = totalCount === 0 ? 0 : (safePage - 1) * pageSize;
  const endIdx = Math.min(safePage * pageSize, totalCount);
  const pageRows = useMemo(
    () => visible.slice((safePage - 1) * pageSize, safePage * pageSize),
    [visible, safePage, pageSize],
  );

  const getPageNumbers = () => {
    const pages: (number | '...')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (safePage > 3) pages.push('...');
      const start = Math.max(2, safePage - 1);
      const end = Math.min(totalPages - 1, safePage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (safePage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  const addPartnerButton = (
    <button
      type="button"
      onClick={onOpenPicker}
      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border text-[13px] cursor-pointer transition-colors"
      style={{ fontWeight: 600, backgroundColor: '#EFF6FF', borderColor: '#BFDBFE', color: '#1E40AF' }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#DBEAFE'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#EFF6FF'; }}
    >
      <Plus className="w-3.5 h-3.5" />
      <span className="hidden sm:inline">Add Partner</span>
    </button>
  );

  const emptyMessage = (() => {
    if (partners.length === 0) return "No partners yet. Click 'Add Partner' to select one or more customers for this item.";
    if (searchQuery.trim() && totalCount === 0) return 'No partners match your search.';
    return null;
  })();

  return (
    <div className="border border-border rounded-xl bg-card flex flex-col overflow-clip">
      {/* Toolbar — Search + count + Add button */}
      <div className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-2 shrink-0 flex-wrap">
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70 pointer-events-none" />
            <Input
              placeholder="Search partners by name or location..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
              className="pl-9 h-9 text-sm bg-white border-border/80 shadow-sm placeholder:text-muted-foreground/50 focus-visible:border-primary focus-visible:ring-primary/20"
            />
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-sm tabular-nums mr-1 hidden sm:inline" style={{ fontWeight: 500 }}>
            {totalCount !== partners.length ? (
              <>
                <span className="text-foreground">{totalCount}</span>
                <span className="text-muted-foreground/60"> of </span>
                <span className="text-muted-foreground">{partners.length}</span>
                <span className="text-muted-foreground/70"> partners</span>
              </>
            ) : (
              <>
                <span className="text-foreground">{partners.length}</span>
                <span className="text-muted-foreground/70"> partners</span>
              </>
            )}
          </span>
          {addPartnerButton}
        </div>
      </div>

      {/* List body / empty state */}
      <div className="border-t border-border/60 flex flex-col">
        {emptyMessage ? (
          <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <Users className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-sm" style={{ fontWeight: 500 }}>{emptyMessage}</p>
          </div>
        ) : (
          <div className="px-4 py-4">
            <div className="flex flex-col gap-2.5">
              {pageRows.map((p) => {
                const avatarLabel = p.code ?? p.name.trim().charAt(0).toUpperCase();
                const avatarBg = p.avatarColor ?? '#1F2937';
                const avatarFs = avatarLabel.length >= 3 ? 11 : avatarLabel.length === 2 ? 13 : 15;
                return (
                  <div
                    key={p.id}
                    className="group bg-white border border-[#E8ECF1] rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:border-blue-200 hover:shadow-[0_4px_16px_-4px_rgba(10,119,255,0.10)] transition-all flex items-center gap-3 p-3"
                  >
                    <div
                      className="rounded-full flex items-center justify-center shrink-0 text-white"
                      style={{ width: 36, height: 36, backgroundColor: avatarBg, fontSize: avatarFs, fontWeight: 700, letterSpacing: '-0.01em' }}
                    >
                      {avatarLabel}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <p className="text-[13px] text-slate-700 truncate" style={{ fontWeight: 600 }}>{p.name}</p>
                        <div className="flex items-center gap-1 shrink-0">
                          {(p.partnerRoles ?? ['Customer']).map((role) => (
                            <span
                              key={role}
                              className="inline-flex items-center px-2 py-0.5 text-[11px] rounded-md border font-medium"
                              style={
                                role === 'Vendor'
                                  ? { backgroundColor: '#EFF6FF', color: '#1E40AF', borderColor: '#BFDBFE' }
                                  : { backgroundColor: '#F5F3FF', color: '#5B21B6', borderColor: '#DDD6FE' }
                              }
                            >
                              {role}
                            </span>
                          ))}
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-500 truncate leading-relaxed mt-0.5">{p.address ?? p.location}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemove(p.id)}
                      className="shrink-0 w-8 h-8 rounded-md flex items-center justify-center text-slate-400 hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                      title="Remove partner"
                      aria-label={`Remove ${p.name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Pagination */}
        {totalCount > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-center px-4 py-3 border-t border-border gap-3 shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Records per page</span>
                <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
                  <SelectTrigger className="w-[70px] h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <span className="text-xs text-muted-foreground hidden sm:inline">
                Showing {startIdx + 1}-{endIdx} of {totalCount}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" disabled={safePage === 1} onClick={() => setPage(1)}>
                <ChevronsLeft className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" className="h-8 gap-1 text-sm text-muted-foreground" disabled={safePage === 1} onClick={() => setPage(Math.max(1, safePage - 1))}>
                <ChevronLeft className="w-3.5 h-3.5" />
                Prev
              </Button>
              {getPageNumbers().map((pg, idx) =>
                pg === '...' ? (
                  <span key={`dots-${idx}`} className="px-1 text-sm text-muted-foreground">...</span>
                ) : (
                  <Button
                    key={pg}
                    variant={safePage === pg ? 'default' : 'ghost'}
                    size="sm"
                    className={`h-8 w-8 p-0 text-sm ${safePage === pg ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
                    onClick={() => setPage(pg as number)}
                  >
                    {pg}
                  </Button>
                ),
              )}
              <Button variant="ghost" size="sm" className="h-8 gap-1 text-sm text-muted-foreground" disabled={safePage === totalPages} onClick={() => setPage(Math.min(totalPages, safePage + 1))}>
                Next
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" disabled={safePage === totalPages} onClick={() => setPage(totalPages)}>
                <ChevronsRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
