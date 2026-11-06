import { useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { X, Search, Plus, Info, TrendingDown, TrendingUp, Pencil, Package, Users, Layers } from 'lucide-react';

interface PricingRule {
  id: string;
  name: string;
  type: 'discount' | 'premium';
  basis: 'value' | 'volume';
  tierStructure: 'single' | 'multi';
  description: string;
  minOrderQuantity?: number;
  maxOrderQuantity?: number;
  minOrderValue?: number;
  maxOrderValue?: number;
  discountPercentage?: number;
  premiumPercentage?: number;
  tiers?: Array<{
    min: number;
    max?: number;
    percentage: number;
  }>;
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
    id: 'fleet-volume',
    name: 'Fleet Volume Discount',
    type: 'discount',
    basis: 'volume',
    tierStructure: 'multi',
    description: '4% off for 3+ units, 7% off for 6+ units, 10% for 10+',
    tiers: [
      { min: 3, max: 6, percentage: 4 },
      { min: 6, max: 10, percentage: 7 },
      { min: 10, percentage: 10 },
    ],
  },
  {
    id: 'gov-contract',
    name: 'Government Contract Pricing',
    type: 'discount',
    basis: 'value',
    tierStructure: 'single',
    description: '3% discount for verified municipal/state/federal contracts',
    minOrderValue: 0,
    discountPercentage: 3,
  },
  {
    id: 'state-bid',
    name: 'State Cooperative Bid Pricing',
    type: 'discount',
    basis: 'value',
    tierStructure: 'single',
    description: '12% off state cooperative purchasing agreement pricing',
    minOrderValue: 5000,
    discountPercentage: 12,
  },
  {
    id: 'multi-build',
    name: 'Multi-Unit Build Discount',
    type: 'discount',
    basis: 'volume',
    tierStructure: 'multi',
    description: '5% off 2 units, 7% off 3+ units of the same build spec',
    tiers: [
      { min: 2, max: 3, percentage: 5 },
      { min: 3, percentage: 7 },
    ],
  },
  {
    id: 'oem-rebate',
    name: 'OEM Manufacturer Rebate',
    type: 'discount',
    basis: 'value',
    tierStructure: 'multi',
    description: 'Manufacturer rebate: 3% on $10k+, 5% on $50k+',
    tiers: [
      { min: 10000, max: 50000, percentage: 3 },
      { min: 50000, percentage: 5 },
    ],
  },
  {
    id: 'early-payment',
    name: 'Early Payment Incentive',
    type: 'discount',
    basis: 'value',
    tierStructure: 'single',
    description: '2% discount for payment within 10 days of invoice',
    minOrderValue: 0,
    discountPercentage: 2,
  },
  {
    id: 'custom-config',
    name: 'Custom Configuration Premium',
    type: 'premium',
    basis: 'value',
    tierStructure: 'single',
    description: '8% premium for non-standard build specifications',
    minOrderValue: 0,
    premiumPercentage: 8,
  },
  {
    id: 'rush-build',
    name: 'Expedited Build Premium',
    type: 'premium',
    basis: 'value',
    tierStructure: 'single',
    description: '15% surcharge for rush build schedule (under 90 days)',
    minOrderValue: 0,
    premiumPercentage: 15,
  },
  {
    id: 'small-order',
    name: 'Small Order Surcharge',
    type: 'premium',
    basis: 'volume',
    tierStructure: 'multi',
    description: '10% surcharge for single-unit orders, 5% for 2 units',
    tiers: [
      { min: 0, max: 2, percentage: 10 },
      { min: 2, max: 3, percentage: 5 },
    ],
  },
  {
    id: 'remote-delivery',
    name: 'Remote Delivery Premium',
    type: 'premium',
    basis: 'value',
    tierStructure: 'single',
    description: '4% premium for delivery to remote/island locations',
    minOrderValue: 0,
    premiumPercentage: 4,
  },
];

const CATEGORIES = [
  { id: 'all', label: 'All rules', count: MOCK_PRICING_RULES.length },
  {
    id: 'discounts',
    label: 'Discounts',
    count: MOCK_PRICING_RULES.filter((r) => r.type === 'discount').length,
  },
  {
    id: 'premium',
    label: 'Premium',
    count: MOCK_PRICING_RULES.filter((r) => r.type === 'premium').length,
  },
  {
    id: 'applied',
    label: 'Applied to Item',
    count: 0,
  },
];

export function PricingRulesLibrary({
  isOpen,
  onClose,
  onApply,
  currentRules = [],
  customerName,
  itemName,
  currentQuantity = 50,
  currentValue = 750,
}: PricingRulesLibraryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedRuleIds, setSelectedRuleIds] = useState<Set<string>>(
    new Set(currentRules.map((r) => r.id))
  );
  const [showSaveConfirmation, setShowSaveConfirmation] = useState(false);

  if (!isOpen) return null;

  // Calculate rule status based on current quantity/value
  const rulesWithStatus = MOCK_PRICING_RULES.map((rule) => {
    const isApplied = selectedRuleIds.has(rule.id);
    
    if (!isApplied) {
      return { ...rule, status: 'available' as const };
    }

    // Check if conditions are met
    let isActive = false;
    
    if (rule.basis === 'volume') {
      if (rule.minOrderQuantity !== undefined && currentQuantity >= rule.minOrderQuantity) {
        if (rule.maxOrderQuantity === undefined || currentQuantity <= rule.maxOrderQuantity) {
          isActive = true;
        }
      }
    } else if (rule.basis === 'value') {
      if (rule.minOrderValue !== undefined && currentValue >= rule.minOrderValue) {
        if (rule.maxOrderValue === undefined || currentValue <= rule.maxOrderValue) {
          isActive = true;
        }
      }
      // Check tiers
      if (rule.tiers) {
        isActive = rule.tiers.some(
          (tier) => currentValue >= tier.min && (!tier.max || currentValue < tier.max)
        );
      }
    }

    return {
      ...rule,
      status: isActive ? ('applied-active' as const) : ('applied-inactive' as const),
    };
  });

  const filteredRules = rulesWithStatus.filter((rule) => {
    const matchesSearch =
      rule.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rule.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    let matchesCategory = true;
    if (selectedCategory === 'discounts') {
      matchesCategory = rule.type === 'discount';
    } else if (selectedCategory === 'premium') {
      matchesCategory = rule.type === 'premium';
    } else if (selectedCategory === 'applied') {
      matchesCategory = selectedRuleIds.has(rule.id);
    }
    
    return matchesSearch && matchesCategory;
  });

  const handleToggleRule = (ruleId: string) => {
    const newSelection = new Set(selectedRuleIds);
    if (newSelection.has(ruleId)) {
      newSelection.delete(ruleId);
    } else {
      newSelection.add(ruleId);
    }
    setSelectedRuleIds(newSelection);
  };

  /* Apply has been renamed to Modify and is intentionally a no-op
     for now — only Deactivate / Reactivate of existing customer rules
     is wired up. The toast tells the user where the real apply flow
     lives. */
  const handleConfirm = () => {
    toast.info("Modify is handled in the Pricing Rule Presets library — use Deactivate / Reactivate on existing rules here.");
  };

  const handleApplyRules = (saveAsDefault: boolean) => {
    const selectedRules = MOCK_PRICING_RULES.filter((r) => selectedRuleIds.has(r.id));
    onApply(selectedRules, saveAsDefault);
    setShowSaveConfirmation(false);
    onClose();
  };

  // Calculate cumulative effect
  const calculateCumulativeEffect = () => {
    const selectedRules = rulesWithStatus.filter((r) => selectedRuleIds.has(r.id) && r.status === 'applied-active');
    
    let totalDiscount = 0;
    let totalPremium = 0;
    
    selectedRules.forEach((rule) => {
      if (rule.type === 'discount') {
        if (rule.discountPercentage) {
          totalDiscount += rule.discountPercentage;
        } else if (rule.tiers) {
          const activeTier = rule.tiers.find(
            (tier) =>
              (rule.basis === 'value' ? currentValue : currentQuantity) >= tier.min &&
              (!tier.max || (rule.basis === 'value' ? currentValue : currentQuantity) < tier.max)
          );
          if (activeTier) {
            totalDiscount += activeTier.percentage;
          }
        }
      } else {
        if (rule.premiumPercentage) {
          totalPremium += rule.premiumPercentage;
        }
      }
    });
    
    return { totalDiscount, totalPremium, netEffect: totalDiscount - totalPremium };
  };

  const { totalDiscount, totalPremium, netEffect } = calculateCumulativeEffect();

  // Find smart suggestions
  const smartSuggestions = rulesWithStatus
    .filter((rule) => {
      if (!selectedRuleIds.has(rule.id)) return false;
      if (rule.status === 'applied-active') return false;
      
      // Only suggest for inactive rules that are close to being activated
      if (rule.basis === 'volume' && rule.minOrderQuantity) {
        const unitsNeeded = rule.minOrderQuantity - currentQuantity;
        return unitsNeeded > 0 && unitsNeeded <= 30; // Close to unlock
      }
      if (rule.basis === 'value' && rule.minOrderValue) {
        const valueNeeded = rule.minOrderValue - currentValue;
        return valueNeeded > 0 && valueNeeded <= 500; // Close to unlock
      }
      return false;
    })
    .slice(0, 2); // Limit to 2 suggestions

  return createPortal(
    <div
      // Position/layout intentionally on inline styles (not Tailwind classes)
      // so the overlay can't be reflowed by any ancestor className collision —
      // it always sits flush to the viewport edges and centers the modal.
      style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, left: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 12100, backgroundColor: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(2px)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !showSaveConfirmation) onClose();
      }}
    >
      <div
        className="bg-white flex flex-col rounded-xl shadow-2xl ring-1 ring-black/5 overflow-hidden" style={{
          width: '90vw',
          maxWidth: '1200px',
          maxHeight: 'min(85vh, 800px)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-border px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-[14px] text-foreground" style={{ fontWeight: 600 }}>
              Pricing rule presets library
            </h2>
            <p className="text-[12px] text-muted-foreground mt-1">
              {itemName ? `Select pricing rules for ${itemName}` : 'Select pricing rules'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              className="h-8 px-4 bg-primary text-white text-[13px] hover:bg-primary/90 transition-colors flex items-center gap-2"
              style={{ borderRadius: '6px', fontWeight: 500 }}
              onClick={() => {
                // TODO: Open create pricing rule flow
                console.log('Create pricing rule');
              }}
            >
              <Plus className="w-4 h-4" />
              Create Pricing Rule
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center hover:bg-muted transition-colors"
              style={{ borderRadius: '6px' }}
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Smart Suggestions Banner */}
        {smartSuggestions.length > 0 && (
          <div className="px-6 py-3 bg-[rgba(217, 119, 6, 0.2)] border-b border-[rgba(217, 119, 6, 0.3)] flex-shrink-0">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="text-[12px] text-warning" style={{ fontWeight: 500 }}>
                  Unlock better discounts!
                </div>
                <div className="text-[11px] text-warning mt-1">
                  {smartSuggestions.map((rule, idx) => {
                    if (rule.basis === 'volume' && rule.minOrderQuantity) {
                      const unitsNeeded = rule.minOrderQuantity - currentQuantity;
                      return (
                        <div key={rule.id}>
                          Add {unitsNeeded} more units to unlock {rule.name} (
                          {rule.discountPercentage}% off)
                        </div>
                      );
                    }
                    if (rule.basis === 'value' && rule.minOrderValue) {
                      const valueNeeded = rule.minOrderValue - currentValue;
                      return (
                        <div key={rule.id}>
                          Add ${valueNeeded.toFixed(2)} more in value to unlock {rule.name}
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar */}
          <div
            className="border-r border-border flex flex-col bg-muted/40"
            style={{ width: '240px' }}
          >
            <div className="p-4 space-y-1">
              {CATEGORIES.map((category) => {
                const count =
                  category.id === 'applied'
                    ? selectedRuleIds.size
                    : category.count;
                
                return (
                  <button
                    key={category.id}
                    onClick={() => setSelectedCategory(category.id)}
                    className={`w-full text-left px-3 h-8 text-[13px] transition-all flex items-center justify-between group ${
                      selectedCategory === category.id
                        ? 'bg-accent text-primary'
                        : 'text-muted-foreground hover:bg-white hover:text-foreground'
                    }`}
                    style={{ borderRadius: '6px', fontWeight: 500 }}
                  >
                    <span>{category.label}</span>
                    <span
                      className={`text-[11px] ${
                        selectedCategory === category.id ? 'text-primary' : 'text-muted-foreground'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Search Bar */}
            <div className="px-6 py-4 border-b border-border flex-shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search pricing rule..."
                  className="w-full h-10 pl-10 pr-4 text-[13px] border border-border bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  style={{ borderRadius: '6px' }}
                  autoFocus
                />
              </div>
            </div>

            {/* Rules Grid — chrome ported verbatim from Partner Management's
                PricingRulesTab.tsx PresetCard so this library matches the
                Sales Order library and the shared PricingRulePresetModal.
                Fixed-height cards, description with fixed 2-line height,
                tier section pinned to bottom, and a pinned footer with
                Package / Layers / Users counts + Active status pill. */}
            <div className="flex-1 overflow-y-auto px-6 py-4 bg-[#FAFBFC]">
              <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))' }}>
                {filteredRules.map((rule) => {
                  const isDis = rule.type === 'discount';
                  const pill = isDis
                    ? { text: '#047857', bg: '#ECFDF5', border: '#D1FAE5' }
                    : { text: '#6D28D9', bg: '#F5F3FF', border: '#EDE9FE' };
                  const heroPct = rule.discountPercentage ?? rule.premiumPercentage
                    ?? (rule.tiers && rule.tiers.length > 0
                      ? Math.max(...rule.tiers.map((t) => t.percentage))
                      : undefined);
                  const heroValue = heroPct != null ? `${heroPct}%` : '—';
                  const basis = rule.basis === 'volume' ? 'Volume' : 'Value';
                  const TrendIcon = isDis ? TrendingDown : TrendingUp;

                  // Synthesise items / categories / partners counts so the
                  // Partner-style footer can render consistently. The legacy
                  // rule shape doesn't carry these fields; seed deterministically
                  // from the id so counts stay stable across re-renders.
                  const seed = rule.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
                  const itemCount = 5 + (seed % 18);
                  const categoryCount = 1 + (seed % 8);
                  const partnerCount = 2 + (seed % 14);

                  return (
                    <button
                      key={rule.id}
                      onClick={() => handleToggleRule(rule.id)}
                      className="text-left relative group transition-all bg-white border border-border rounded-xl flex flex-col h-[260px] overflow-hidden"
                      style={{
                        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                        fontFamily: 'Inter, system-ui, sans-serif',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#BFDBFE';
                        e.currentTarget.style.boxShadow = '0 4px 16px -4px rgba(10,119,255,0.10), 0 0 0 1px #BFDBFE';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border)';
                        e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.03)';
                      }}
                    >
                      <div className="p-3.5 flex-1 flex flex-col min-h-0 overflow-hidden">
                        {/* Row 1: combined Type/Basis pill */}
                        <div className="flex items-center justify-between gap-2 mb-2 shrink-0">
                          <span
                            className="inline-flex items-stretch rounded-full overflow-hidden border shrink-0"
                            style={{ borderColor: pill.border }}
                          >
                            <span
                              className="inline-flex items-center gap-1 px-2 py-[2px] text-[10px]"
                              style={{ fontWeight: 600, color: pill.text, backgroundColor: pill.bg, lineHeight: 1 }}
                            >
                              <TrendIcon className="w-3 h-3" />
                              {isDis ? 'Discount' : 'Premium'}
                            </span>
                            <span
                              className="inline-flex items-center px-2 py-[2px] text-[10px] bg-white text-slate-500"
                              style={{ fontWeight: 500, borderLeft: `1px solid ${pill.border}`, lineHeight: 1 }}
                            >
                              {basis}
                            </span>
                          </span>
                        </div>

                        {/* Row 2: Name */}
                        <div className="shrink-0 mb-1">
                          <p className="text-[13px] text-slate-700 truncate" style={{ fontWeight: 600, margin: 0 }}>{rule.name}</p>
                        </div>

                        {/* Row 3: Description — fixed 2-line height keeps cards aligned */}
                        <div className="h-[32px] shrink-0 mb-2">
                          <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed" style={{ fontWeight: 400, margin: 0 }}>{rule.description}</p>
                        </div>

                        {/* Row 4: Hero value */}
                        <div className="flex items-baseline gap-2 shrink-0">
                          <span
                            className="text-[22px] text-slate-700 tabular-nums leading-none tracking-tight"
                            style={{ fontWeight: 600 }}
                          >
                            {heroValue}
                          </span>
                          <span className="text-[11px] text-slate-400" style={{ fontWeight: 500 }}>
                            {isDis ? 'off' : 'markup'}
                          </span>
                        </div>

                        {/* Row 5: Tier / range row — pinned to the bottom of the body */}
                        <div className="mt-auto pt-2 shrink-0">
                          <div
                            className="flex items-center justify-between px-3 py-[6px] rounded-lg border text-[11px] tabular-nums"
                            style={{ borderColor: '#E8ECF1', backgroundColor: '#FAFBFC' }}
                          >
                            <div className="flex items-center gap-1.5 text-slate-500 min-w-0">
                              {rule.minOrderQuantity !== undefined ? (
                                <>
                                  <span style={{ fontWeight: 400 }}>Min {rule.minOrderQuantity} EA</span>
                                  {rule.maxOrderQuantity !== undefined && (
                                    <>
                                      <span className="text-slate-300">–</span>
                                      <span style={{ fontWeight: 400 }}>Max {rule.maxOrderQuantity} EA</span>
                                    </>
                                  )}
                                </>
                              ) : rule.minOrderValue !== undefined ? (
                                <>
                                  <span style={{ fontWeight: 400 }}>Min ${rule.minOrderValue}</span>
                                  {rule.maxOrderValue !== undefined && (
                                    <>
                                      <span className="text-slate-300">–</span>
                                      <span style={{ fontWeight: 400 }}>Max ${rule.maxOrderValue}</span>
                                    </>
                                  )}
                                </>
                              ) : rule.tierStructure === 'multi' && rule.tiers && rule.tiers.length > 1 ? (
                                <span style={{ fontWeight: 400 }}>{rule.tiers.length} tiers</span>
                              ) : (
                                <span style={{ fontWeight: 400 }}>No conditions</span>
                              )}
                            </div>
                            <span className="shrink-0 ml-2 text-slate-700" style={{ fontWeight: 600 }}>{heroValue}</span>
                          </div>
                        </div>
                      </div>

                      {/* Footer — Partner-faithful: items · categories · partners
                          on the left, Active status pill on the right. */}
                      <div className="flex items-center gap-2 px-3.5 py-2.5 border-t border-muted shrink-0">
                        <span className="inline-flex items-center gap-1 text-[10px] text-slate-400" style={{ fontWeight: 500 }}>
                          <Package className="w-3 h-3" /> {itemCount}
                        </span>
                        <span className="w-px h-3 bg-[#E8ECF1]" />
                        <span className="inline-flex items-center gap-1 text-[10px] text-slate-400" style={{ fontWeight: 500 }}>
                          <Layers className="w-3 h-3" /> {categoryCount}
                        </span>
                        <span className="w-px h-3 bg-[#E8ECF1]" />
                        <span className="inline-flex items-center gap-1 text-[10px] text-slate-400" style={{ fontWeight: 500 }}>
                          <Users className="w-3 h-3" /> {partnerCount}
                        </span>
                        <span
                          className="ml-auto px-2 py-[2px] rounded-full text-[10px] border"
                          style={{
                            fontWeight: 500,
                            color: '#059669',
                            backgroundColor: '#F0FDF4',
                            borderColor: '#BBF7D0',
                          }}
                        >
                          Active
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {filteredRules.length === 0 && (
                <div className="text-center py-12">
                  <div className="text-[13px] text-muted-foreground">No pricing rules found</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer — matches the SO pricing rules library exactly:
            tinted bg, "Selected | N rules" left, Cancel + Activate right. */}
        <div className="border-t border-border px-5 py-3 flex items-center justify-between shrink-0 bg-[#FAFBFC]">
          <div className="flex items-center gap-4">
            <div>
              <div className="text-[10px] text-slate-400 mb-0.5" style={{ fontWeight: 500 }}>Selected</div>
              <div className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>{selectedRuleIds.size} rules</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 h-8 border border-border text-[12px] text-muted-foreground hover:bg-white transition-colors rounded-lg"
              style={{ fontWeight: 500 }}
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className="px-3 h-8 bg-primary text-white text-[12px] hover:bg-[#0862D0] transition-colors rounded-lg inline-flex items-center gap-1.5"
              style={{ fontWeight: 600 }}
            >
              <Pencil className="w-3 h-3" /> Modify
            </button>
          </div>
        </div>

        {/* Save Confirmation Dialog Overlay — portaled to body so it
            centers against the viewport even when this library is nested
            inside another modal stacking context. */}
        {showSaveConfirmation && createPortal(
          <div
            style={{
              position: 'fixed', top: 0, right: 0, bottom: 0, left: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 12300, backgroundColor: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)',
            }}
            onClick={(e) => { if (e.target === e.currentTarget) setShowSaveConfirmation(false); }}
          >
            <div
              className="bg-white p-6"
              style={{ borderRadius: '12px', width: '480px', maxWidth: '90vw', boxShadow: '0 24px 48px -12px rgba(0,0,0,0.22)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-[14px] text-foreground mb-2" style={{ fontWeight: 600 }}>
                Apply pricing rules
              </h3>
              <p className="text-[13px] text-muted-foreground mb-5">
                Apply these rules only on this quote, or also save as defaults for{' '}
                <span style={{ fontWeight: 500 }}>{customerName}</span>
                {itemName ? <> with <span style={{ fontWeight: 500 }}>{itemName}</span></> : ''}?
              </p>

              <div className="space-y-2.5 mb-5">
                <button
                  onClick={() => handleApplyRules(false)}
                  className="w-full text-left border border-border bg-white hover:border-primary hover:bg-[#F0F7FF] transition-all p-4"
                  style={{ borderRadius: '8px' }}
                >
                  <div className="text-[13px] text-foreground mb-1" style={{ fontWeight: 600 }}>
                    This quote only
                  </div>
                  <div className="text-[12px] text-muted-foreground">
                    Apply without changing customer defaults
                  </div>
                </button>

                <button
                  onClick={() => handleApplyRules(true)}
                  className="w-full text-left border border-border bg-white hover:border-primary hover:bg-[#F0F7FF] transition-all p-4"
                  style={{ borderRadius: '8px' }}
                >
                  <div className="text-[13px] text-foreground mb-1" style={{ fontWeight: 600 }}>
                    Save as customer default
                  </div>
                  <div className="text-[12px] text-muted-foreground">
                    Apply and associate with {customerName}'s records{itemName ? ` for ${itemName}` : ''}
                  </div>
                </button>
              </div>

              <button
                onClick={() => setShowSaveConfirmation(false)}
                className="w-full h-8 border border-border text-[13px] text-muted-foreground hover:bg-[#F0F7FF] transition-colors"
                style={{ borderRadius: '6px', fontWeight: 500 }}
              >
                Cancel
              </button>
            </div>
          </div>,
          document.body
        )}
      </div>
    </div>,
    document.body
  );
}