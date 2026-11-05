import { useState, useEffect } from 'react';
import {
  X, Maximize2, Minimize2, Info, Check, ChevronRight, ArrowLeft, Plus,
  TrendingDown, TrendingUp, BarChart3, DollarSign, Search, Upload, Package, FolderOpen,
} from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/app/components/ui/dialog';
import { Input } from '@/app/components/ui/input';
import { Switch } from '@/app/components/ui/switch';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/app/components/ui/tooltip';
import { ExpandableTextarea } from '@/app/components/so/ExpandableTextarea';
import { PctAmountToggle } from '@/app/components/so/PctAmountToggle';
import { InfoTooltip } from '@/app/components/so/InfoTooltip';
import { toast } from 'sonner';
import type { PricingRule } from '@/app/components/so/PricingRulesLibrary';

export interface CreatePricingRulePrefill {
  name?: string;
  description?: string;
  category?: 'discount' | 'premium';
  basis?: 'value' | 'volume';
  hasDateLimit?: boolean;
  validFrom?: string;
  validTo?: string;
  tiers?: PricingRule['tiers'];
}

interface CreatePricingRuleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: (rule: Partial<PricingRule>) => void;
  prefill?: CreatePricingRulePrefill;
  /** Title prefix for the rule-type badge in the header. Defaults to "Customer Pricing Rule". */
  scopeLabel?: string;
}

interface CreateTierState {
  discount: string;
  fixRate: boolean;
  qtyLimits: boolean;
  minQty: string;
  maxQty: string;
}

const makeTier = (): CreateTierState => ({ discount: '', fixRate: false, qtyLimits: false, minQty: '', maxQty: '' });

export function CreatePricingRuleModal({ isOpen, onClose, onSave, prefill, scopeLabel = 'Customer Pricing Rule' }: CreatePricingRuleModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [fullscreen, setFullscreen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<'discount' | 'premium'>('discount');
  const [basis, setBasis] = useState<'value' | 'volume'>('value');
  const [limitDate, setLimitDate] = useState(false);
  const [validFrom, setValidFrom] = useState('');
  const [validTo, setValidTo] = useState('');
  const [tiers, setTiers] = useState<CreateTierState[]>([makeTier()]);
  const [itemsTab, setItemsTab] = useState<'items' | 'categories' | 'attachments'>('items');

  // Apply prefill on open
  useEffect(() => {
    if (!isOpen) return;
    setStep(1);
    setItemsTab('items');
    if (prefill) {
      setName(prefill.name ?? '');
      setDescription(prefill.description ?? '');
      setCategory(prefill.category ?? 'discount');
      setBasis(prefill.basis ?? 'value');
      setLimitDate(prefill.hasDateLimit ?? false);
      setValidFrom(prefill.validFrom ?? '');
      setValidTo(prefill.validTo ?? '');
      setTiers(
        prefill.tiers && prefill.tiers.length > 0
          ? prefill.tiers.map((t) => ({
              discount: t.discount,
              fixRate: t.discount.includes('$'),
              qtyLimits: !!(t.minQty || t.maxQty),
              minQty: t.minQty || '',
              maxQty: t.maxQty || '',
            }))
          : [makeTier()],
      );
    } else {
      setName(''); setDescription(''); setCategory('discount'); setBasis('value');
      setLimitDate(false); setValidFrom(''); setValidTo(''); setTiers([makeTier()]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  function updateTier(idx: number, patch: Partial<CreateTierState>) {
    setTiers((prev) => prev.map((t, i) => (i === idx ? { ...t, ...patch } : t)));
  }
  function addTier() { setTiers((prev) => [...prev, makeTier()]); }
  function removeTier(idx: number) { setTiers((prev) => prev.filter((_, i) => i !== idx)); }

  function close() {
    onClose();
    setFullscreen(false);
  }

  function handleSave() {
    if (!name.trim()) return;
    onSave?.({
      name,
      description,
      category,
      basis,
      hasDateLimit: limitDate,
      validFrom: limitDate ? validFrom : '',
      validTo: limitDate ? validTo : '',
      totalTiers: tiers.length,
      tierType: tiers.length > 1 ? 'multiple' : 'single',
      tiers: tiers.map((t) => ({
        minQty: t.minQty || '',
        maxQty: t.maxQty || '',
        discount: t.fixRate ? `$${t.discount}` : `${t.discount}%`,
        isFixRate: t.fixRate,
      })),
    });
    toast.success('Pricing rule created successfully.');
    close();
  }

  const isDis = category === 'discount';

  return (
    <TooltipProvider delayDuration={150}>
      <Dialog open={isOpen} onOpenChange={(v) => { if (!v) close(); }}>
        <DialogContent
          hideCloseButton
          overlayClassName="z-[12150]"
          className="p-0 gap-0 overflow-hidden !z-[12151] flex flex-col transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.18)]"
          style={
            fullscreen
              ? { maxWidth: 'calc(100% - 1rem)', width: 'calc(100% - 1rem)', height: 'calc(100dvh - 1rem)', maxHeight: 'calc(100dvh - 1rem)', borderRadius: 16 }
              : { maxWidth: 'min(65vw, 960px)', width: 'calc(100% - 2rem)', height: 'auto', maxHeight: '90vh', borderRadius: 16 }
          }
        >
          <DialogTitle className="sr-only">Create New Pricing Rule</DialogTitle>
          <DialogDescription className="sr-only">Create a new pricing rule for this customer.</DialogDescription>

          {/* Header */}
          <div className="px-3 sm:px-4 lg:px-5 pt-3 sm:pt-4 pb-0 shrink-0 bg-white rounded-t-none sm:rounded-t-2xl border-b border-[#EEF2F6]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2.5">
                  <h2 className="text-[15px] sm:text-[17px] text-foreground" style={{ fontWeight: 700 }}>
                    {prefill ? 'Edit Pricing Rule' : 'Create New Pricing Rule'}
                  </h2>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted text-[11px] text-slate-500" style={{ fontWeight: 500 }}>
                    <BarChart3 className="w-3 h-3" /> {scopeLabel}
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5" style={{ fontWeight: 400 }}>
                  Configure the type, tiers, and assign items for the new rule.
                </p>
              </div>
              <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                <button
                  onClick={() => setFullscreen(!fullscreen)}
                  className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-white text-xs text-muted-foreground hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer"
                  style={{ fontWeight: 500 }}
                >
                  {fullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                  {fullscreen ? 'Exit full' : 'Full view'}
                </button>
                <button
                  onClick={close}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-500 hover:bg-muted transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Step tabs */}
            <div className="flex items-center gap-4 sm:gap-6 mt-3 sm:mt-3.5 overflow-x-auto -mb-px">
              {[
                { num: 1 as const, label: 'Rule Setup', shortLabel: 'Setup', active: step === 1, completed: step === 2 },
                { num: 2 as const, label: 'Items & Attachments', shortLabel: 'Items', active: step === 2, completed: false },
              ].map((tab) => (
                <div
                  key={tab.num}
                  className={`relative flex items-center gap-2 pb-2.5 sm:pb-3 ${
                    tab.num < step || (tab.num === 2 && step === 1 && name.trim()) ? 'cursor-pointer' : 'cursor-default'
                  }`}
                  onClick={() => {
                    if (tab.num < step) setStep(tab.num);
                    if (tab.num === 2 && step === 1 && name.trim()) setStep(2);
                  }}
                >
                  <div
                    className={`w-[22px] h-[22px] sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[11px] sm:text-[12px] shrink-0 transition-all duration-200 ${
                      tab.completed ? 'bg-emerald-500 text-white' : tab.active ? 'bg-primary text-white' : 'border-[1.5px] border-slate-300 text-slate-500 bg-white'
                    }`}
                    style={{ fontWeight: 600 }}
                  >
                    {tab.completed ? <Check className="w-3 h-3" /> : tab.num}
                  </div>
                  <span
                    className={`text-[12px] sm:text-[13px] whitespace-nowrap transition-colors ${
                      tab.active ? 'text-primary' : tab.completed ? 'text-emerald-500' : 'text-slate-700'
                    }`}
                    style={{ fontWeight: tab.active || tab.completed ? 600 : 500 }}
                  >
                    <span className="hidden sm:inline">{tab.label}</span>
                    <span className="sm:hidden">{tab.shortLabel}</span>
                  </span>
                  {(tab.active || tab.completed) && (
                    <div className={`absolute bottom-0 left-0 right-0 h-[2px] rounded-t-full ${tab.completed ? 'bg-emerald-500' : 'bg-primary'}`} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 min-h-0 overflow-y-auto bg-[#FAFBFC]">
            <div className="px-4 py-4">
              {step === 1 && (
                <div className="space-y-5">
                  {/* Pricing Rule Type */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-3">
                      <span className="text-sm text-foreground" style={{ fontWeight: 600 }}>Pricing Rule Type</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span><Info className="w-3.5 h-3.5 text-slate-300 cursor-help" /></span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" sideOffset={6} className="max-w-[260px] text-[11px] leading-[1.5] z-[12200]">
                          <p className="text-slate-500">Discount lowers prices, Premium adds markup. Hover each card for details.</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {/* Discount card */}
                      <div
                        onClick={() => setCategory('discount')}
                        className={`group relative rounded-xl overflow-hidden border transition-all duration-200 cursor-pointer ${
                          category === 'discount'
                            ? 'border-[#86EFAC]/70 bg-white shadow-[0_1px_4px_rgba(4,120,87,0.06)]'
                            : 'border-border bg-white hover:border-[#BBF7D0] hover:shadow-[0_4px_16px_-4px_rgba(4,120,87,0.10)]'
                        }`}
                      >
                        <div
                          className={`absolute inset-0 transition-all duration-300 pointer-events-none ${
                            category === 'discount'
                              ? 'bg-gradient-to-br from-green-50/50 to-transparent'
                              : 'bg-gradient-to-br from-green-50/0 to-green-50/0 group-hover:from-green-50/60 group-hover:to-transparent'
                          }`}
                        />
                        <div className="relative flex items-center gap-3 pl-3.5 pr-3 py-3">
                          <div
                            className={`w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 transition-all duration-200 ${
                              category === 'discount'
                                ? 'bg-gradient-to-br from-[#DCFCE7] to-[#BBF7D0] text-[#15803D]'
                                : 'bg-gradient-to-br from-green-50 to-[#DCFCE7] text-green-600 group-hover:scale-105'
                            }`}
                          >
                            <TrendingDown className="w-[18px] h-[18px]" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-[13px] transition-colors duration-150 ${category === 'discount' ? 'text-[#166534]' : 'text-foreground group-hover:text-slate-800'}`} style={{ fontWeight: 600 }}>
                              Discount
                            </p>
                            <p className={`text-[11px] mt-0.5 truncate transition-colors duration-150 ${category === 'discount' ? 'text-[#22C55E]' : 'text-slate-400'}`}>
                              Lower price adjustment
                            </p>
                          </div>
                          <div
                            className={`w-5 h-5 rounded-full flex items-center justify-center transition-all duration-200 shrink-0 ${
                              category === 'discount' ? '' : 'border-[1.5px] border-[#D1D5DB] bg-white group-hover:border-[#86EFAC]'
                            }`}
                            style={category === 'discount' ? { backgroundColor: '#16A34A', boxShadow: '0 0 0 2px rgba(22,163,74,0.15)' } : {}}
                          >
                            {category === 'discount' && <Check className="w-3 h-3 text-white" strokeWidth={2.5} />}
                          </div>
                        </div>
                      </div>

                      {/* Premium card */}
                      <div
                        onClick={() => setCategory('premium')}
                        className={`group relative rounded-xl overflow-hidden border transition-all duration-200 cursor-pointer ${
                          category === 'premium'
                            ? 'border-[#C4B5FD]/70 bg-white shadow-[0_1px_4px_rgba(124,58,237,0.06)]'
                            : 'border-border bg-white hover:border-[#DDD6FE] hover:shadow-[0_4px_16px_-4px_rgba(124,58,237,0.10)]'
                        }`}
                      >
                        <div
                          className={`absolute inset-0 transition-all duration-300 pointer-events-none ${
                            category === 'premium'
                              ? 'bg-gradient-to-br from-violet-50/50 to-transparent'
                              : 'bg-gradient-to-br from-violet-50/0 to-violet-50/0 group-hover:from-violet-50/60 group-hover:to-transparent'
                          }`}
                        />
                        <div className="relative flex items-center gap-3 pl-3.5 pr-3 py-3">
                          <div
                            className={`w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 transition-all duration-200 ${
                              category === 'premium'
                                ? 'bg-gradient-to-br from-[#EDE9FE] to-[#DDD6FE] text-[#6D28D9]'
                                : 'bg-gradient-to-br from-violet-50 to-[#EDE9FE] text-[#8B5CF6] group-hover:scale-105'
                            }`}
                          >
                            <TrendingUp className="w-[18px] h-[18px]" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-[13px] transition-colors duration-150 ${category === 'premium' ? 'text-[#5B21B6]' : 'text-foreground group-hover:text-slate-800'}`} style={{ fontWeight: 600 }}>
                              Premium
                            </p>
                            <p className={`text-[11px] mt-0.5 truncate transition-colors duration-150 ${category === 'premium' ? 'text-[#8B5CF6]' : 'text-slate-400'}`}>
                              Higher price adjustment
                            </p>
                          </div>
                          <div
                            className={`w-5 h-5 rounded-full flex items-center justify-center transition-all duration-200 shrink-0 ${
                              category === 'premium' ? '' : 'border-[1.5px] border-[#D1D5DB] bg-white group-hover:border-[#C4B5FD]'
                            }`}
                            style={category === 'premium' ? { backgroundColor: '#8B5CF6', boxShadow: '0 0 0 2px rgba(139,92,246,0.15)' } : {}}
                          >
                            {category === 'premium' && <Check className="w-3 h-3 text-white" strokeWidth={2.5} />}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Basis selector pills — same shape as FilterPills (Quotes pattern). */}
                    <div className="flex items-center gap-2 mt-3">
                      <span className="text-[12px] text-slate-500 mr-1" style={{ fontWeight: 500 }}>Basis:</span>
                      {(['volume', 'value'] as const).map((b) => {
                        const isActive = basis === b;
                        return (
                          <button
                            key={b}
                            onClick={() => {
                              if (basis !== b) {
                                setBasis(b);
                                setTiers((prev) => prev.map((t) => ({ ...t, minQty: '', maxQty: '' })));
                              }
                            }}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                              isActive
                                ? 'border-primary bg-accent text-primary hover:bg-[#D6E8FF] active:bg-[#ADD1FF]'
                                : 'border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-muted-foreground/30 active:bg-muted'
                            }`}
                            style={{ fontWeight: isActive ? 600 : 500 }}
                          >
                            {b === 'volume' ? <BarChart3 className="w-3.5 h-3.5" /> : <DollarSign className="w-3.5 h-3.5" />}
                            {b === 'volume' ? 'Volume-Based' : 'Value-Based'}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Pricing Rule Details */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-3">
                      <span className="text-sm text-foreground" style={{ fontWeight: 600 }}>Pricing Rule Details</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span><Info className="w-3.5 h-3.5 text-slate-300 cursor-help" /></span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" sideOffset={6} className="max-w-[260px] text-[11px] leading-[1.5] z-[12200]">
                          <p className="text-slate-500">Name and basis shown on POs and invoices.</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <div className="rounded-xl border border-border bg-white p-4 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-[12px] text-foreground mb-1.5 block" style={{ fontWeight: 600 }}>
                            {isDis ? 'Discount' : 'Premium'} Name
                          </label>
                          <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder={`e.g. ${isDis ? 'Volume Discount for Q4' : 'Premium Markup for VIP'}`}
                            className="rounded-lg border-border bg-white text-[13px]"
                          />
                        </div>
                        <div>
                          <ExpandableTextarea
                            label="Description"
                            value={description}
                            onChange={setDescription}
                            placeholder="Brief summary of pricing rule purpose or context."
                          />
                        </div>
                      </div>

                      {/* Limit to date range toggle + conditional fields */}
                      <div>
                        <div className="flex items-center gap-2.5">
                          <Switch checked={limitDate} onCheckedChange={setLimitDate} />
                          <span className="text-[13px] text-foreground" style={{ fontWeight: 500 }}>Limit Rule to Date Range</span>
                        </div>
                        {limitDate && (
                          <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-muted">
                            <div>
                              <div className="flex items-center gap-1 mb-1.5">
                                <label className="text-[12px] text-foreground" style={{ fontWeight: 600 }}>Valid From</label>
                                <InfoTooltip>Start date for this rule.</InfoTooltip>
                              </div>
                              <Input
                                type="date"
                                value={validFrom}
                                onChange={(e) => setValidFrom(e.target.value)}
                                className="rounded-lg border-border bg-white text-[13px]"
                              />
                            </div>
                            <div>
                              <div className="flex items-center gap-1 mb-1.5">
                                <label className="text-[12px] text-foreground" style={{ fontWeight: 600 }}>Valid To</label>
                                <InfoTooltip>End date for this rule.</InfoTooltip>
                              </div>
                              <Input
                                type="date"
                                value={validTo}
                                onChange={(e) => setValidTo(e.target.value)}
                                className="rounded-lg border-border bg-white text-[13px]"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Tiers */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm text-foreground" style={{ fontWeight: 600 }}>{isDis ? 'Discount' : 'Premium'} Tiers</span>
                        <span className="text-[11px] text-slate-400 bg-muted px-1.5 py-0.5 rounded" style={{ fontWeight: 600 }}>{tiers.length}</span>
                      </div>
                    </div>

                    <div className="space-y-2.5">
                      {tiers.map((tier, idx) => {
                        const accent = isDis ? '#16A34A' : '#8B5CF6';
                        const accentBg = isDis ? '#F0FDF4' : '#F5F3FF';
                        const accentBorder = isDis ? '#BBF7D0' : '#DDD6FE';
                        return (
                          <div key={idx} className="rounded-xl border bg-white overflow-hidden transition-all" style={{ borderColor: tier.qtyLimits ? accentBorder : 'var(--border)' }}>
                            {/* Tier header */}
                            <div className="flex items-center justify-between px-3.5 py-2 border-b border-muted" style={{ backgroundColor: accentBg }}>
                              <div className="flex items-center gap-2">
                                <span className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] text-white" style={{ fontWeight: 700, backgroundColor: accent }}>{idx + 1}</span>
                                <span className="text-[12px] text-foreground" style={{ fontWeight: 600 }}>Tier {idx + 1}</span>
                              </div>
                              {idx > 0 && (
                                <button
                                  onClick={() => removeTier(idx)}
                                  className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-white/60 transition-all cursor-pointer"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>

                            <div className="px-3.5 py-3">
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <div className="flex items-center justify-between mb-1.5">
                                    <label className="text-[12px] text-foreground" style={{ fontWeight: 500 }}>
                                      {isDis ? 'Discount' : 'Premium'} {tier.fixRate ? 'Amount' : 'Rate'}
                                    </label>
                                    <PctAmountToggle
                                      isFixed={tier.fixRate}
                                      onChange={(fixed) => updateTier(idx, { fixRate: fixed })}
                                      percentTooltip={`${isDis ? 'Discount' : 'Premium'} applied as a percentage of the line value.`}
                                      amountTooltip={`${isDis ? 'Discount' : 'Premium'} applied as a fixed dollar amount.`}
                                    />
                                  </div>
                                  <div className="relative">
                                    {tier.fixRate && (
                                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-slate-400">$</span>
                                    )}
                                    <Input
                                      value={tier.discount}
                                      onChange={(e) => updateTier(idx, { discount: e.target.value })}
                                      placeholder={tier.fixRate ? 'e.g. 25.00' : 'e.g. 50'}
                                      className={`rounded-lg border-border bg-white text-[13px] h-9 text-foreground placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary/20 ${tier.fixRate ? 'pl-7 pr-3' : 'pr-8'}`}
                                    />
                                    {!tier.fixRate && (
                                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-slate-400">%</span>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-end h-full pb-[7px]">
                                  <label
                                    className="flex items-center gap-2 cursor-pointer select-none"
                                    onClick={() => updateTier(idx, { qtyLimits: !tier.qtyLimits })}
                                  >
                                    <div className={`w-[16px] h-[16px] rounded-[4px] flex items-center justify-center shrink-0 transition-colors ${tier.qtyLimits ? 'bg-primary' : 'border-[1.5px] border-slate-300 bg-white hover:border-slate-400'}`}>
                                      {tier.qtyLimits && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                                    </div>
                                    <span className="text-[12px] text-slate-700" style={{ fontWeight: 500 }}>
                                      {basis === 'volume' ? 'Order Qty Limits' : 'Order Value Limits'}
                                    </span>
                                    <span onClick={(e) => e.stopPropagation()}>
                                      <InfoTooltip>
                                        {basis === 'volume'
                                          ? 'Restricts this tier to orders within a specific quantity range.'
                                          : 'Restricts this tier to orders within a specific dollar-value range.'}
                                      </InfoTooltip>
                                    </span>
                                  </label>
                                </div>
                              </div>

                              {tier.qtyLimits && (
                                <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-muted">
                                  <div>
                                    <div className="flex items-center gap-1 mb-1.5">
                                      <label className="text-[12px] text-foreground" style={{ fontWeight: 500 }}>{basis === 'volume' ? 'Min Qty' : 'Min Order Value'}</label>
                                      <InfoTooltip>
                                        {basis === 'volume'
                                          ? 'The smallest order quantity at which this tier starts to apply.'
                                          : 'The smallest order value (in $) at which this tier starts to apply.'}
                                      </InfoTooltip>
                                    </div>
                                    <div className="relative">
                                      {basis === 'value' && (
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-slate-400">$</span>
                                      )}
                                      <Input
                                        value={tier.minQty}
                                        onChange={(e) => updateTier(idx, { minQty: e.target.value })}
                                        placeholder={basis === 'volume' ? 'e.g. 100' : 'e.g. 1,000'}
                                        className={`rounded-lg border-border bg-white text-[13px] h-9 ${basis === 'value' ? 'pl-7' : ''}`}
                                      />
                                    </div>
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-1 mb-1.5">
                                      <label className="text-[12px] text-foreground" style={{ fontWeight: 500 }}>{basis === 'volume' ? 'Max Qty' : 'Max Order Value'}</label>
                                      <InfoTooltip>
                                        {basis === 'volume'
                                          ? 'The largest order quantity this tier covers.'
                                          : 'The largest order value (in $) this tier covers.'}
                                      </InfoTooltip>
                                    </div>
                                    <div className="relative">
                                      {basis === 'value' && (
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-slate-400">$</span>
                                      )}
                                      <Input
                                        value={tier.maxQty}
                                        onChange={(e) => updateTier(idx, { maxQty: e.target.value })}
                                        placeholder={basis === 'volume' ? 'e.g. 500' : 'e.g. 5,000'}
                                        className={`rounded-lg border-border bg-white text-[13px] h-9 ${basis === 'value' ? 'pl-7' : ''}`}
                                      />
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <button
                      onClick={addTier}
                      className={`inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-lg border border-dashed text-[12px] transition-all cursor-pointer w-full justify-center ${
                        isDis
                          ? 'border-[#BBF7D0] text-green-600 hover:bg-green-50 hover:border-[#86EFAC]'
                          : 'border-[#DDD6FE] text-[#6D28D9] hover:bg-violet-50 hover:border-[#C4B5FD]'
                      }`}
                      style={{ fontWeight: 600 }}
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Tier
                    </button>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-5">
                  {/* Summary banner */}
                  <div className="rounded-xl border border-border bg-white p-3.5 flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 ${isDis ? 'bg-gradient-to-br from-[#DCFCE7] to-[#BBF7D0]' : 'bg-gradient-to-br from-[#EDE9FE] to-[#DDD6FE]'}`}>
                      {isDis ? <TrendingDown className="w-4 h-4 text-[#15803D]" /> : <TrendingUp className="w-4 h-4 text-[#6D28D9]" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] text-slate-700 truncate" style={{ fontWeight: 600 }}>{name || 'Untitled Rule'}</p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {isDis ? 'Discount' : 'Premium'} · {basis === 'volume' ? 'Volume-Based' : 'Value-Based'} · {tiers.length} tier{tiers.length !== 1 ? 's' : ''}
                        {tiers[0]?.discount ? ` · ${tiers[0].discount}${tiers[0].fixRate ? '$' : '%'}` : ''}
                      </p>
                    </div>
                    <button
                      onClick={() => setStep(1)}
                      className="text-[11px] text-primary hover:text-[#0862D0] transition-colors cursor-pointer shrink-0"
                      style={{ fontWeight: 600 }}
                    >
                      Edit Setup
                    </button>
                  </div>

                  {/* Items, Categories, Attachments */}
                  <div className="rounded-xl border border-border bg-white overflow-hidden">
                    <div className="flex items-center gap-0 border-b border-border px-4">
                      {([
                        { key: 'items' as const, label: 'Items' },
                        { key: 'categories' as const, label: 'Categories' },
                        { key: 'attachments' as const, label: 'Attachments' },
                      ]).map((t) => (
                        <button
                          key={t.key}
                          onClick={() => setItemsTab(t.key)}
                          className={`relative px-3 py-2.5 text-[12px] flex items-center transition-colors cursor-pointer ${itemsTab === t.key ? 'text-primary' : 'text-slate-500 hover:text-slate-700'}`}
                          style={{ fontWeight: itemsTab === t.key ? 600 : 500 }}
                        >
                          {t.label}
                          {itemsTab === t.key && <div className="absolute bottom-0 left-0 right-0 h-[2px] rounded-t-full bg-primary" />}
                        </button>
                      ))}
                    </div>

                    {itemsTab === 'items' && (
                      <div className="p-4">
                        <div className="flex items-center gap-2 mb-4">
                          <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                            <Input placeholder="Search items to assign..." className="pl-9 rounded-lg border-border bg-slate-50 text-[13px] h-9" />
                          </div>
                          <button className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-primary hover:bg-[#0862D0] text-white text-[12px] shadow-sm transition-colors cursor-pointer" style={{ fontWeight: 600 }}>
                            <Plus className="w-3.5 h-3.5" /> Add Items
                          </button>
                        </div>
                        <div className="py-8 text-center">
                          <div className="w-12 h-12 rounded-xl bg-slate-50 border border-[#E8ECF1] flex items-center justify-center mx-auto mb-3">
                            <Package className="w-5 h-5 text-slate-400" />
                          </div>
                          <p className="text-[13px] text-slate-700 mb-1" style={{ fontWeight: 600 }}>No items assigned yet</p>
                          <p className="text-[11px] text-slate-400 max-w-[260px] mx-auto">Search and add items that should be affected by this pricing rule.</p>
                        </div>
                      </div>
                    )}

                    {itemsTab === 'categories' && (
                      <div className="p-4">
                        <div className="flex items-center gap-2 mb-4">
                          <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                            <Input placeholder="Search categories to assign..." className="pl-9 rounded-lg border-border bg-slate-50 text-[13px] h-9" />
                          </div>
                          <button className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-primary hover:bg-[#0862D0] text-white text-[12px] shadow-sm transition-colors cursor-pointer" style={{ fontWeight: 600 }}>
                            <Plus className="w-3.5 h-3.5" /> Add Categories
                          </button>
                        </div>
                        <div className="py-8 text-center">
                          <div className="w-12 h-12 rounded-xl bg-slate-50 border border-[#E8ECF1] flex items-center justify-center mx-auto mb-3">
                            <FolderOpen className="w-5 h-5 text-slate-400" />
                          </div>
                          <p className="text-[13px] text-slate-700 mb-1" style={{ fontWeight: 600 }}>No categories assigned yet</p>
                          <p className="text-[11px] text-slate-400 max-w-[260px] mx-auto">Assign categories to apply this pricing rule to all items within them.</p>
                        </div>
                      </div>
                    )}

                    {itemsTab === 'attachments' && (
                      <div className="p-4">
                        <div className="py-8 text-center">
                          <div className="w-12 h-12 rounded-xl bg-slate-50 border border-[#E8ECF1] border-dashed flex items-center justify-center mx-auto mb-3">
                            <Upload className="w-5 h-5 text-slate-400" />
                          </div>
                          <p className="text-[13px] text-slate-700 mb-1" style={{ fontWeight: 600 }}>No attachments yet</p>
                          <p className="text-[11px] text-slate-400 max-w-[280px] mx-auto mb-3">Upload supporting documents, contracts, or approval files for this pricing rule.</p>
                          <button className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border bg-white text-[12px] text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors cursor-pointer" style={{ fontWeight: 600 }}>
                            <Upload className="w-3.5 h-3.5" /> Upload Files
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="shrink-0 border-t border-[#EEF2F6] bg-white px-3 sm:px-4 lg:px-5 py-2.5 sm:py-3 flex items-center justify-end gap-2 sm:gap-2.5 sm:rounded-b-2xl">
            {step === 1 ? (
              <>
                <button
                  onClick={close}
                  className="px-3 sm:px-5 py-2 rounded-lg border border-border text-xs sm:text-[13px] text-slate-500 hover:text-foreground hover:border-slate-300 hover:bg-slate-50 transition-colors cursor-pointer"
                  style={{ fontWeight: 600 }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => { if (name.trim()) setStep(2); }}
                  disabled={!name.trim()}
                  className="inline-flex items-center gap-1.5 px-3 sm:px-5 py-2 rounded-lg bg-primary text-white text-xs sm:text-[13px] hover:bg-[#0862D0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm cursor-pointer"
                  style={{ fontWeight: 600 }}
                >
                  Continue
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setStep(1)}
                  className="inline-flex items-center gap-1.5 text-xs sm:text-[13px] text-slate-500 hover:text-foreground transition-colors mr-auto cursor-pointer"
                  style={{ fontWeight: 500 }}
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Back</span>
                </button>
                <button
                  onClick={close}
                  className="px-3 sm:px-5 py-2 rounded-lg border border-border text-xs sm:text-[13px] text-slate-500 hover:text-foreground hover:border-slate-300 hover:bg-slate-50 transition-colors cursor-pointer"
                  style={{ fontWeight: 600 }}
                >
                  Discard
                </button>
                <button
                  onClick={handleSave}
                  className="inline-flex items-center gap-1.5 px-3 sm:px-5 py-2 rounded-lg bg-primary text-white text-xs sm:text-[13px] hover:bg-[#0862D0] transition-colors shadow-sm cursor-pointer"
                  style={{ fontWeight: 600 }}
                >
                  <Check className="w-3.5 h-3.5" /> Save Rule
                </button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
