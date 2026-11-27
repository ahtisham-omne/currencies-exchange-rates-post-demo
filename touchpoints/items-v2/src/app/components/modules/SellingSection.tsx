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
  Plus, Trash2, Users, Store, Banknote, Info,
  Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
} from 'lucide-react';
import { RadioOption } from './configAtoms';
import { BASE_CURRENCY } from '@/app/currency/currencies';
import { basePrefix } from '@/app/currency/itemMoney';
import { currencyDecimals, formatMoney, formatRateDate, moneyPrefix, rateSentence } from '@/app/currency/money';
import {
  ALL_GROUPS_LABEL, CUSTOMER_PARTNER_GROUPS, RATES_READ_ON,
  nextRegionalCurrency, regionalBaseEquivalent, regionalPriceInvalid, regionalPriceKey, regionalRateToday,
  takenCurrencies, takenGroups,
  type OtherCurrencyPricing, type RegionalPriceDraft,
} from '@/app/currency/regionalPrices';
import { CurrencyPicker } from '../currency/CurrencyPicker';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
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
          icon={Banknote}
          tooltip={`Set a default selling price per unit for this item, in ${BASE_CURRENCY}, the base currency. Defined prices apply to every partner when selling globally.`}
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
            {/* The selling price is the base price (Currency Touchpoints Map,
                Items 4). */}
            <div className="flex flex-col gap-1">
              <p style={{ fontSize: 12, lineHeight: 1.5, color: '#64748B', fontFamily: FONT }}>
                Base price, in {BASE_CURRENCY}.
              </p>
              {/* The item has no rate setting: the customer and the order pick
                  the rate (Mahreen, 27 Nov 2026, agreed in review). */}
              <p className="flex items-start gap-1.5" style={{ fontSize: 12, lineHeight: 1.5, color: '#64748B', fontFamily: FONT }}>
                <Info className="shrink-0" style={{ width: 13, height: 13, color: '#94A3B8', marginTop: 2.5 }} aria-hidden />
                The exchange rate comes from the customer and the order, not the item.
              </p>
            </div>

            {/* Other currencies (Mahreen, 27 Nov 2026; waiting on Eli, built as
                the proposal for Monday): convert the base price, or set a
                price per currency and partner group. Replaces last round's
                Regional prices. */}
            <OtherCurrencies
              mode={config.otherCurrencyPricing ?? 'convert'}
              onModeChange={(next) => onConfigChange('otherCurrencyPricing', next as any)}
              rows={config.regionalPrices || []}
              onRowsChange={(next) => onConfigChange('regionalPrices', next as any)}
            />
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

/* ── OtherCurrencies — how the item sells in currencies other than the base
   (Mahreen, 27 Nov 2026; Spec D). Two RadioOptions, as Selling Scope uses:
   convert the base price at that day's rate, or set a price for each
   currency. The second shows a table: Currency | Partner group | Price per
   unit | In base today, one row per currency + group (never the base
   currency), then "Add a price". Switching back to Convert keeps the rows
   but hides them, so switching again restores them; orders ignore them while
   the item converts. A price must be above 0. ── */
const PRICE_GRID = 'grid grid-cols-[112px_minmax(0,1fr)_minmax(0,1fr)_120px_32px] gap-2 items-center';
const HEAD_CELL = 'text-[10px] text-slate-400 uppercase tracking-wider';
const ALL_GROUPS = '__all';

function OtherCurrencies({
  mode,
  onModeChange,
  rows,
  onRowsChange,
}: {
  mode: OtherCurrencyPricing;
  onModeChange: (next: OtherCurrencyPricing) => void;
  rows: RegionalPriceDraft[];
  onRowsChange: (next: RegionalPriceDraft[]) => void;
}) {
  // A row left blank shows its error once the field has been left; keyed by
  // currency + group, as the rows are.
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const nextCurrency = nextRegionalCurrency(rows);

  const add = () => {
    if (nextCurrency) onRowsChange([...rows, { currency: nextCurrency, unitPrice: '', partnerGroup: null }]);
  };
  const update = (idx: number, patch: Partial<RegionalPriceDraft>) => {
    const row = { ...rows[idx], ...patch };
    const before = regionalPriceKey(rows[idx]);
    const after = regionalPriceKey(row);
    if (before !== after && touched.has(before)) {
      setTouched((prev) => {
        const next = new Set(prev);
        next.delete(before);
        next.add(after);
        return next;
      });
    }
    onRowsChange(rows.map((r, i) => (i === idx ? row : r)));
  };
  const remove = (idx: number) => {
    const key = regionalPriceKey(rows[idx]);
    setTouched((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
    onRowsChange(rows.filter((_, i) => i !== idx));
  };

  return (
    <div className="flex flex-col gap-3" style={{ borderTop: '1px solid #EEF2F6', paddingTop: 14, marginTop: 2 }}>
      <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: '#9CA3AF', fontFamily: FONT }}>Other currencies</span>

      <div className="flex flex-col gap-3">
        <RadioOption
          selected={mode === 'convert'}
          onSelect={() => onModeChange('convert')}
          label="Convert from the base price"
          desc="Uses that day's rate. Orders mark it as an estimate."
        />
        <RadioOption
          selected={mode === 'perCurrency'}
          onSelect={() => onModeChange('perCurrency')}
          label="Set a price for each currency"
          desc="Currencies without a price still convert."
        />
      </div>

      {mode === 'perCurrency' && (
        <div className="flex flex-col gap-2">
          <div className="rounded-lg overflow-hidden" style={{ border: '1px solid #EEF2F6' }}>
            <div className={`${PRICE_GRID} px-3 h-8`} style={{ backgroundColor: '#FAFBFC', borderBottom: '1px solid #EEF2F6' }}>
              <span className={HEAD_CELL} style={{ fontWeight: 600 }}>Currency</span>
              <span className={HEAD_CELL} style={{ fontWeight: 600 }}>Partner group</span>
              <span className={HEAD_CELL} style={{ fontWeight: 600 }}>Price per unit</span>
              <span className={`${HEAD_CELL} text-right`} style={{ fontWeight: 600 }}>In base today</span>
              <span aria-hidden />
            </div>

            {rows.length === 0 ? (
              <p className="px-3 py-3" style={{ fontSize: 12, color: '#94A3B8', fontFamily: FONT }}>
                No prices yet. Every currency converts from the base price.
              </p>
            ) : (
              rows.map((row, idx) => {
                const key = regionalPriceKey(row);
                const amount = Number(row.unitPrice);
                const invalid = regionalPriceInvalid(row);
                const showError = invalid && (row.unitPrice !== '' || touched.has(key));
                const base = !invalid ? regionalBaseEquivalent(row.currency, amount) : null;
                const rate = regionalRateToday(row.currency);
                const decimals = currencyDecimals(row.currency);
                const groupsTaken = takenGroups(rows, idx);
                const groupLabel = row.partnerGroup ?? ALL_GROUPS_LABEL;
                return (
                  <div key={key} className="px-3 py-2 flex flex-col gap-1" style={{ borderTop: idx === 0 ? undefined : '1px solid #F1F5F9' }}>
                    <div className={PRICE_GRID}>
                      <CurrencyPicker
                        value={row.currency}
                        onPick={(code) => update(idx, { currency: code })}
                        exclude={takenCurrencies(rows, idx)}
                        ariaLabel={`Currency, ${groupLabel}`}
                      />
                      <Select
                        value={row.partnerGroup ?? ALL_GROUPS}
                        onValueChange={(v) => update(idx, { partnerGroup: v === ALL_GROUPS ? null : v })}
                      >
                        <SelectTrigger
                          aria-label={`Partner group for the ${row.currency} price`}
                          className="!h-10 rounded-lg text-[13px] bg-white border-border hover:border-slate-300 transition-colors focus:border-primary focus:ring-1 focus:ring-primary/20 [&>svg]:text-slate-400"
                          style={{ fontFamily: FONT, color: '#0F172A' }}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="z-[250] rounded-lg">
                          <SelectItem value={ALL_GROUPS} disabled={groupsTaken.includes(null)}>{ALL_GROUPS_LABEL}</SelectItem>
                          {CUSTOMER_PARTNER_GROUPS.map((g) => (
                            <SelectItem key={g.name} value={g.name} disabled={groupsTaken.includes(g.name)}>
                              {g.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div
                        className={`flex items-center min-w-0 bg-white border rounded-lg px-3 ${showError ? 'border-[#FCA5A5]' : 'border-border'}`}
                        style={{ height: 40 }}
                      >
                        <span className="shrink-0" style={{ fontSize: 13, color: '#94A3B8', fontFamily: FONT, marginRight: 6 }}>{moneyPrefix(row.currency).trim()}</span>
                        <input
                          type="number"
                          min="0"
                          step={decimals ? (1 / 10 ** decimals).toString() : '1'}
                          value={row.unitPrice}
                          onChange={(e) => update(idx, { unitPrice: e.target.value })}
                          onBlur={() => setTouched((prev) => new Set(prev).add(key))}
                          className="flex-1 min-w-0 bg-transparent outline-none"
                          style={{ fontSize: 13, fontFamily: "'JetBrains Mono', monospace", color: '#0F172A' }}
                          placeholder={decimals ? (0).toFixed(decimals) : '0'}
                          aria-label={`Price per unit in ${row.currency}, ${groupLabel}`}
                          aria-invalid={showError}
                        />
                      </div>
                      <div className="text-right min-w-0">
                        {base != null && rate != null ? (
                          <Tooltip delayDuration={250}>
                            <TooltipTrigger asChild>
                              <span className="tabular-nums cursor-default whitespace-nowrap" style={{ fontSize: 12, color: '#64748B', fontFamily: FONT }}>
                                ≈ {formatMoney(base, BASE_CURRENCY)}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              At today's daily market rate, {rateSentence(row.currency, rate)}. Read on {formatRateDate(RATES_READ_ON)}.
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <span style={{ fontSize: 12, color: '#CBD5E1', fontFamily: FONT }}>—</span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => remove(idx)}
                        className="flex items-center justify-center text-slate-400 hover:text-destructive hover:bg-[#FEF2F2] rounded-md transition-colors shrink-0"
                        style={{ width: 32, height: 40 }}
                        aria-label={`Remove the ${row.currency} price for ${groupLabel}`}
                      >
                        <Trash2 style={{ width: 14, height: 14 }} />
                      </button>
                    </div>
                    {showError && (
                      <div className={PRICE_GRID}>
                        <span className="col-start-3 col-span-3" style={{ fontSize: 11, color: '#B91C1C', fontFamily: FONT }}>
                          Enter a price above 0.
                        </span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {nextCurrency && (
            <div>
              <button
                type="button"
                onClick={add}
                className="inline-flex items-center gap-1.5 hover:underline underline-offset-2"
                style={{ fontSize: 12, fontWeight: 500, fontFamily: FONT, color: '#0A77FF' }}
              >
                <Plus style={{ width: 13, height: 13 }} /> Add a price
              </button>
            </div>
          )}
        </div>
      )}
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
