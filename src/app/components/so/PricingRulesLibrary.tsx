import { useState } from 'react';
import { X, Search, Plus, Info, TrendingDown, TrendingUp, Check, Lock, Building2, Copy } from 'lucide-react';

interface PricingRule {
  id: string;
  name: string;
  type: 'discount' | 'premium';
  basis: 'value' | 'volume';
  tierStructure: 'single' | 'multi';
  description: string;
  tiers: { minValue: string; maxValue: string; discount: string }[];
  vendorsApplied?: number;
  status?: 'applied-active' | 'applied-inactive' | 'available';
}

interface PricingRulesLibraryProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (rules: PricingRule[], saveAsDefault: boolean) => void;
  currentRules?: PricingRule[];
  customerName: string;
  itemName?: string;
  currentQuantity?: number;
  currentValue?: number;
}

const MOCK_PRICING_RULES: PricingRule[] = [
  {
    id: 'fleet-volume', name: 'Fleet Volume Discount', type: 'discount', basis: 'volume', tierStructure: 'multi',
    description: '4% off for 3+ units, 7% off for 6+ units, 10% for 10+', vendorsApplied: 24,
    tiers: [{ minValue: '3 EA', maxValue: '5 EA', discount: '4%' }, { minValue: '6 EA', maxValue: '9 EA', discount: '7%' }, { minValue: '10+ EA', maxValue: '∞', discount: '10%' }],
  },
  {
    id: 'gov-contract', name: 'Government Contract Pricing', type: 'discount', basis: 'value', tierStructure: 'single',
    description: '3% discount for verified municipal/state/federal contracts', vendorsApplied: 18,
    tiers: [{ minValue: '$0', maxValue: '∞', discount: '3%' }],
  },
  {
    id: 'state-bid', name: 'State Cooperative Bid Pricing', type: 'discount', basis: 'value', tierStructure: 'single',
    description: '12% off state cooperative purchasing agreement pricing', vendorsApplied: 12,
    tiers: [{ minValue: '$5,000', maxValue: '∞', discount: '12%' }],
  },
  {
    id: 'multi-build', name: 'Multi-Unit Build Discount', type: 'discount', basis: 'volume', tierStructure: 'multi',
    description: '5% off 2 units, 7% off 3+ units of the same build spec', vendorsApplied: 31,
    tiers: [{ minValue: '2 EA', maxValue: '2 EA', discount: '5%' }, { minValue: '3+ EA', maxValue: '∞', discount: '7%' }],
  },
  {
    id: 'oem-rebate', name: 'OEM Manufacturer Rebate', type: 'discount', basis: 'value', tierStructure: 'multi',
    description: 'Manufacturer rebate: 3% on $10k+, 5% on $50k+', vendorsApplied: 8,
    tiers: [{ minValue: '$10,000', maxValue: '$49,999', discount: '3%' }, { minValue: '$50,000', maxValue: '∞', discount: '5%' }],
  },
  {
    id: 'early-payment', name: 'Early Payment Incentive', type: 'discount', basis: 'value', tierStructure: 'single',
    description: '2% discount for payment within 10 days of invoice', vendorsApplied: 156,
    tiers: [{ minValue: '$0', maxValue: '∞', discount: '2%' }],
  },
  {
    id: 'custom-config', name: 'Custom Configuration Premium', type: 'premium', basis: 'value', tierStructure: 'single',
    description: '8% premium for non-standard build specifications', vendorsApplied: 42,
    tiers: [{ minValue: '$0', maxValue: '∞', discount: '8%' }],
  },
  {
    id: 'rush-build', name: 'Expedited Build Premium', type: 'premium', basis: 'value', tierStructure: 'single',
    description: '15% surcharge for rush build schedule (under 90 days)', vendorsApplied: 15,
    tiers: [{ minValue: '$0', maxValue: '∞', discount: '15%' }],
  },
  {
    id: 'small-order', name: 'Small Order Surcharge', type: 'premium', basis: 'volume', tierStructure: 'multi',
    description: '10% surcharge for single-unit orders, 5% for 2 units', vendorsApplied: 67,
    tiers: [{ minValue: '1 EA', maxValue: '1 EA', discount: '10%' }, { minValue: '2 EA', maxValue: '2 EA', discount: '5%' }],
  },
  {
    id: 'remote-delivery', name: 'Remote Delivery Premium', type: 'premium', basis: 'value', tierStructure: 'single',
    description: '4% premium for delivery to remote/island locations', vendorsApplied: 23,
    tiers: [{ minValue: '$0', maxValue: '∞', discount: '4%' }],
  },
];

const CATEGORIES = [
  { id: 'all', label: 'All Rules' },
  { id: 'discounts', label: 'Discounts' },
  { id: 'premium', label: 'Premium' },
  { id: 'applied', label: 'Applied' },
];

/* ── Highlight helper ── */
function highlightMatch(text: string, search: string) {
  if (!search?.trim()) return text;
  const idx = text.toLowerCase().indexOf(search.toLowerCase());
  if (idx === -1) return text;
  return <>{text.slice(0, idx)}<mark className="bg-transparent px-0.5 rounded-sm" style={{ backgroundColor: '#FEFCE8', color: '#854D0E', fontWeight: 500 }}>{text.slice(idx, idx + search.length)}</mark>{text.slice(idx + search.length)}</>;
}

/* ── Card component (Partner Management style) ── */
function PricingRuleCard({ rule, isSelected, searchText, onApply, onDuplicate }: {
  rule: PricingRule; isSelected: boolean; searchText?: string; onApply: () => void; onDuplicate: () => void;
}) {
  const [activeTier, setActiveTier] = useState(0);
  const isDis = rule.type === 'discount';
  const isMulti = rule.tierStructure === 'multi' && rule.tiers.length > 1;
  const shownTier = rule.tiers[isMulti ? activeTier : 0];
  const pill = isDis
    ? { text: '#047857', bg: '#ECFDF5', border: '#D1FAE5' }
    : { text: '#6D28D9', bg: '#F5F3FF', border: '#EDE9FE' };

  return (
    <div
      onClick={onApply}
      className={`bg-white border rounded-xl cursor-pointer group transition-all duration-200 flex flex-col relative ${
        isSelected
          ? 'border-[#0A77FF]/25 shadow-[0_2px_12px_rgba(10,119,255,0.10)]'
          : 'border-[#E8ECF1] shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:border-[#BFDBFE] hover:shadow-[0_4px_16px_-4px_rgba(10,119,255,0.10)]'
      }`}
    >
      {isSelected && (
        <div className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-[#0A77FF] flex items-center justify-center z-10 shadow-sm">
          <Check className="w-3 h-3 text-white" />
        </div>
      )}

      <div className="p-3.5 flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Row 1: Type pill + Template badge */}
        <div className="flex items-center justify-between gap-2 mb-2 shrink-0">
          <span className="inline-flex items-stretch rounded-full overflow-hidden border shrink-0" style={{ borderColor: pill.border }}>
            <span className="inline-flex items-center gap-1 px-2 py-[2px] text-[10px]" style={{ fontWeight: 600, color: pill.text, backgroundColor: pill.bg }}>
              {isDis ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
              {isDis ? 'Discount' : 'Premium'}
            </span>
            <span className="inline-flex items-center px-2 py-[2px] text-[10px] bg-white text-[#64748B] border-l" style={{ fontWeight: 500, borderColor: pill.border }}>
              {rule.basis === 'volume' ? 'Volume' : 'Value'}
            </span>
          </span>
          <span className="inline-flex items-center gap-1 px-1.5 py-[3px] rounded-md border bg-[#F1F5F9] border-[#CBD5E1] text-[9px] text-[#64748B] shrink-0" style={{ fontWeight: 600 }}>
            <Lock className="w-2.5 h-2.5" /> TEMPLATE
          </span>
        </div>

        {/* Row 2: Name */}
        <div className="shrink-0 mb-1">
          <p className="text-[13px] text-[#0F172A] truncate" style={{ fontWeight: 600 }}>{highlightMatch(rule.name, searchText || '')}</p>
        </div>

        {/* Row 3: Description */}
        <div className="h-[32px] shrink-0 mb-2">
          <p className="text-[11px] text-[#64748B] line-clamp-2 leading-relaxed" style={{ fontWeight: 400 }}>{highlightMatch(rule.description, searchText || '')}</p>
        </div>

        {/* Row 4: Hero value + usage count */}
        <div className="flex items-baseline justify-between shrink-0">
          <div className="flex items-baseline gap-2">
            <span className="text-[22px] text-[#0F172A] tabular-nums leading-none tracking-tight" style={{ fontWeight: 600 }}>
              {rule.tiers[0]?.discount ?? '—'}
            </span>
            <span className="text-[11px] text-[#94A3B8]" style={{ fontWeight: 500 }}>
              {isDis ? 'off' : 'markup'}
            </span>
          </div>
          <span className="inline-flex items-center gap-1 text-[10px] text-[#94A3B8]" style={{ fontWeight: 500 }}>
            <Building2 className="w-3 h-3" /> {rule.vendorsApplied || 0} in use
          </span>
        </div>

        {/* Row 5: Tier selector + detail */}
        <div className="mt-auto pt-2 shrink-0" onClick={(e) => e.stopPropagation()}>
          <div className={`h-[24px] mb-1.5 ${isMulti ? 'flex items-center gap-[3px]' : ''}`}>
            {isMulti && rule.tiers.map((_, i) => {
              const isActive = activeTier === i;
              return (
                <button key={i} onClick={(e) => { e.stopPropagation(); setActiveTier(i); }}
                  className={`h-[22px] rounded-md text-[10px] tabular-nums transition-all duration-200 cursor-pointer flex items-center justify-center px-2 ${
                    isActive ? 'shadow-sm' : 'bg-transparent text-[#C0C9D4] hover:text-[#94A3B8]'
                  }`}
                  style={{
                    fontWeight: isActive ? 600 : 500,
                    ...(isActive ? { backgroundColor: `${pill.text}18`, color: pill.text, boxShadow: `0 0 0 1px ${pill.text}40` } : {}),
                  }}
                >
                  T{i + 1}
                  {isActive && <span className="ml-1 text-[9px] opacity-60" style={{ fontWeight: 400 }}>{rule.tiers[i]?.discount}</span>}
                </button>
              );
            })}
          </div>
          {shownTier && (
            <div className="flex items-center justify-between px-3 py-[6px] rounded-lg border border-[#E8ECF1] bg-[#FAFBFC] text-[11px] tabular-nums min-w-0">
              <div className="flex items-center gap-1.5 text-[#64748B] min-w-0">
                <span style={{ fontWeight: 400 }}>{shownTier.minValue}</span>
                <span className="text-[#CBD5E1]">–</span>
                <span style={{ fontWeight: 400 }}>{shownTier.maxValue}</span>
              </div>
              <span className="shrink-0 ml-2 text-[#0F172A]" style={{ fontWeight: 600 }}>{shownTier.discount}</span>
            </div>
          )}
        </div>
      </div>

      {/* Footer — Apply + Duplicate */}
      <div className="grid grid-cols-2 border-t border-[#F1F5F9] shrink-0">
        <button onClick={(e) => { e.stopPropagation(); onApply(); }}
          className="inline-flex items-center justify-center gap-1 py-2 text-[11px] text-[#64748B] hover:text-[#0A77FF] hover:bg-[#F8FAFC] transition-colors border-r border-[#F1F5F9]"
          style={{ fontWeight: 500 }}
        >
          <Check className="w-3 h-3" /> Apply
        </button>
        <button onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
          className="inline-flex items-center justify-center gap-1 py-2 text-[11px] text-[#64748B] hover:text-[#0A77FF] hover:bg-[#F8FAFC] transition-colors"
          style={{ fontWeight: 500 }}
        >
          <Copy className="w-3 h-3" /> Duplicate
        </button>
      </div>
    </div>
  );
}

/* ── Main Library Modal ── */
export function PricingRulesLibrary({
  isOpen, onClose, onApply, currentRules = [], customerName, itemName,
}: PricingRulesLibraryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedRuleIds, setSelectedRuleIds] = useState<Set<string>>(new Set(currentRules.map((r) => r.id)));
  const [showSaveConfirmation, setShowSaveConfirmation] = useState(false);

  if (!isOpen) return null;

  const filteredRules = MOCK_PRICING_RULES.filter((rule) => {
    const matchesSearch = rule.name.toLowerCase().includes(searchQuery.toLowerCase()) || rule.description.toLowerCase().includes(searchQuery.toLowerCase());
    let matchesCategory = true;
    if (selectedCategory === 'discounts') matchesCategory = rule.type === 'discount';
    else if (selectedCategory === 'premium') matchesCategory = rule.type === 'premium';
    else if (selectedCategory === 'applied') matchesCategory = selectedRuleIds.has(rule.id);
    return matchesSearch && matchesCategory;
  });

  const handleToggleRule = (ruleId: string) => {
    const newSelection = new Set(selectedRuleIds);
    if (newSelection.has(ruleId)) newSelection.delete(ruleId);
    else newSelection.add(ruleId);
    setSelectedRuleIds(newSelection);
  };

  const handleApplyRules = (saveAsDefault: boolean) => {
    const selectedRules = MOCK_PRICING_RULES.filter((r) => selectedRuleIds.has(r.id));
    onApply(selectedRules as any, saveAsDefault);
    setShowSaveConfirmation(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 10001, backgroundColor: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(1px)' }}
      onClick={(e) => { if (e.target === e.currentTarget && !showSaveConfirmation) onClose(); }}
    >
      <div className="bg-white flex flex-col" style={{ width: '90vw', maxWidth: 1200, height: '85vh', maxHeight: 800, borderRadius: 12 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3 flex items-center justify-between shrink-0 border-b border-[#E2E8F0]">
          <div>
            <h2 className="text-sm text-[#0F172A]" style={{ fontWeight: 600 }}>Pricing Rules Library</h2>
            <p className="text-[12px] text-[#64748B] mt-0.5">{itemName ? `Select pricing rules for ${itemName}` : 'Select pricing rules for this order'}</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="h-8 px-3 bg-[#0A77FF] text-white text-[12px] hover:bg-[#0862D0] transition-colors flex items-center gap-1.5 rounded-lg" style={{ fontWeight: 600 }}>
              <Plus className="w-3.5 h-3.5" />Create
            </button>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center hover:bg-[#F8FAFC] transition-colors rounded-lg">
              <X className="w-4 h-4 text-[#64748B]" />
            </button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar */}
          <div className="flex flex-col bg-[#FAFBFC]" style={{ width: 220, borderRight: '1px solid #E2E8F0' }}>
            <div className="p-3 space-y-0.5">
              {CATEGORIES.map((cat) => {
                const count = cat.id === 'all' ? MOCK_PRICING_RULES.length
                  : cat.id === 'discounts' ? MOCK_PRICING_RULES.filter(r => r.type === 'discount').length
                  : cat.id === 'premium' ? MOCK_PRICING_RULES.filter(r => r.type === 'premium').length
                  : selectedRuleIds.size;
                return (
                  <button key={cat.id} onClick={() => setSelectedCategory(cat.id)}
                    className={`w-full text-left px-3 h-8 text-[12px] transition-all flex items-center justify-between rounded-lg ${
                      selectedCategory === cat.id ? 'bg-[#EDF4FF] text-[#0A77FF]' : 'text-[#64748B] hover:bg-white hover:text-[#334155]'
                    }`}
                    style={{ fontWeight: 500 }}
                  >
                    <span>{cat.label}</span>
                    <span className={`text-[10px] rounded-full px-1.5 py-0.5 min-w-[18px] text-center ${selectedCategory === cat.id ? 'bg-[#0A77FF]/10 text-[#0A77FF]' : 'bg-[#F1F5F9] text-[#94A3B8]'}`} style={{ fontWeight: 600 }}>{count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-5 py-3 shrink-0 border-b border-[#E2E8F0]">
              <div className="relative max-w-[320px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#94A3B8]" />
                <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search pricing rules..."
                  className="w-full h-9 pl-9 pr-3 text-[12px] bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg focus:outline-none focus:border-[#0A77FF] focus:ring-1 focus:ring-[#0A77FF]/20 transition-colors placeholder:text-[#94A3B8]"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              <div className="grid grid-cols-3 gap-3">
                {filteredRules.map((rule) => (
                  <PricingRuleCard
                    key={rule.id}
                    rule={rule}
                    isSelected={selectedRuleIds.has(rule.id)}
                    searchText={searchQuery}
                    onApply={() => handleToggleRule(rule.id)}
                    onDuplicate={() => {}}
                  />
                ))}
              </div>
              {filteredRules.length === 0 && <div className="text-center py-12 text-[13px] text-[#94A3B8]">No pricing rules found</div>}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-[#E2E8F0] px-5 py-3 flex items-center justify-between shrink-0 bg-[#FAFBFC]" style={{ borderRadius: '0 0 12px 12px' }}>
          <div className="flex items-center gap-4">
            <div>
              <div className="text-[10px] text-[#94A3B8] mb-0.5" style={{ fontWeight: 500 }}>Selected</div>
              <div className="text-[13px] text-[#0F172A]" style={{ fontWeight: 600 }}>{selectedRuleIds.size} rules</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-3 h-8 border border-[#E2E8F0] text-[12px] text-[#64748B] hover:bg-white transition-colors rounded-lg" style={{ fontWeight: 500 }}>Cancel</button>
            <button onClick={() => setShowSaveConfirmation(true)} className="px-3 h-8 bg-[#0A77FF] text-white text-[12px] hover:bg-[#0862D0] transition-colors rounded-lg" style={{ fontWeight: 600 }}>Confirm</button>
          </div>
        </div>

        {/* Save Confirmation */}
        {showSaveConfirmation && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center" style={{ borderRadius: 12 }}>
            <div className="bg-white p-6" style={{ borderRadius: 12, width: 480, boxShadow: '0 24px 48px -12px rgba(0,0,0,0.18)' }}>
              <h3 className="text-sm text-[#0F172A] mb-2" style={{ fontWeight: 600 }}>Save pricing rules as default?</h3>
              <p className="text-[13px] text-[#64748B] mb-5">
                Apply these rules only to this order, or also save as defaults for <span style={{ fontWeight: 500 }}>{customerName}</span>{itemName ? <> with <span style={{ fontWeight: 500 }}>{itemName}</span></> : ''}?
              </p>
              <div className="space-y-2.5 mb-5">
                <button onClick={() => handleApplyRules(false)} className="w-full text-left p-4 rounded-xl border border-[#E2E8F0] bg-white hover:border-[#BFDBFE] hover:bg-[#F8FAFC] transition-all">
                  <div className="text-[13px] text-[#0F172A] mb-1" style={{ fontWeight: 600 }}>This order only</div>
                  <div className="text-[12px] text-[#64748B]">Apply without changing customer defaults</div>
                </button>
                <button onClick={() => handleApplyRules(true)} className="w-full text-left p-4 rounded-xl border border-[#E2E8F0] bg-white hover:border-[#BFDBFE] hover:bg-[#F8FAFC] transition-all">
                  <div className="text-[13px] text-[#0F172A] mb-1" style={{ fontWeight: 600 }}>Save as customer default</div>
                  <div className="text-[12px] text-[#64748B]">Apply and associate with {customerName}'s records{itemName ? ` for ${itemName}` : ''}</div>
                </button>
              </div>
              <button onClick={() => setShowSaveConfirmation(false)}
                className="w-full h-8 text-[12px] rounded-lg border border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC] transition-colors" style={{ fontWeight: 500 }}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
