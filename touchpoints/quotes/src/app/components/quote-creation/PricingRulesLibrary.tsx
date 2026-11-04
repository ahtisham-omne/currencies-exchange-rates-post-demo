import { useState } from 'react';
import { X, Search, Plus, Info, TrendingDown, TrendingUp, Check } from 'lucide-react';

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

  const handleConfirm = () => {
    setShowSaveConfirmation(true);
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

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 10001, backgroundColor: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(1px)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !showSaveConfirmation) onClose();
      }}
    >
      <div
        className="bg-white flex flex-col"
        style={{
          width: '90vw',
          maxWidth: '1200px',
          height: '85vh',
          maxHeight: '800px',
          borderRadius: '12px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-[#E5E7EB] px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-[14px] text-[#1F2937]" style={{ fontWeight: 600 }}>
              Pricing rule presets library
            </h2>
            <p className="text-[12px] text-[#6B7280] mt-1">
              {itemName ? `Select pricing rules for ${itemName}` : 'Select pricing rules'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              className="h-8 px-4 bg-[#1B6EF3] text-white text-[13px] hover:bg-[#0D5ED7] transition-colors flex items-center gap-2"
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
              className="w-8 h-8 flex items-center justify-center hover:bg-[#F3F4F6] transition-colors"
              style={{ borderRadius: '6px' }}
            >
              <X className="w-4 h-4 text-[#6B7280]" />
            </button>
          </div>
        </div>

        {/* Smart Suggestions Banner */}
        {smartSuggestions.length > 0 && (
          <div className="px-6 py-3 bg-[#FEF3C7] border-b border-[#FDE68A] flex-shrink-0">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-[#D97706] flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="text-[12px] text-[#92400E]" style={{ fontWeight: 500 }}>
                  Unlock better discounts!
                </div>
                <div className="text-[11px] text-[#92400E] mt-1">
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
            className="border-r border-[#E5E7EB] flex flex-col bg-[#FAFBFC]"
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
                        ? 'bg-[#E7F3FF] text-[#1B6EF3]'
                        : 'text-[#6B7280] hover:bg-white hover:text-[#1F2937]'
                    }`}
                    style={{ borderRadius: '6px', fontWeight: 500 }}
                  >
                    <span>{category.label}</span>
                    <span
                      className={`text-[11px] ${
                        selectedCategory === category.id ? 'text-[#1B6EF3]' : 'text-[#9CA3AF]'
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
            <div className="px-6 py-4 border-b border-[#E5E7EB] flex-shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search pricing rule..."
                  className="w-full h-10 pl-10 pr-4 text-[13px] border border-[#E5E7EB] bg-white focus:outline-none focus:ring-2 focus:ring-[#1B6EF3] focus:border-transparent"
                  style={{ borderRadius: '6px' }}
                  autoFocus
                />
              </div>
            </div>

            {/* Rules Grid */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                {filteredRules.map((rule) => {
                  const isSelected = selectedRuleIds.has(rule.id);
                  const isActive = rule.status === 'applied-active';
                  const isInactive = rule.status === 'applied-inactive';

                  return (
                    <button
                      key={rule.id}
                      onClick={() => handleToggleRule(rule.id)}
                      className={`text-left border-2 transition-all p-4 relative group ${
                        isActive
                          ? 'border-[#10B981] bg-[#ECFDF5]'
                          : isInactive
                          ? 'border-[#F59E0B] bg-[#FFFBEB]'
                          : isSelected
                          ? 'border-[#1B6EF3] bg-[#F3F7FF]'
                          : 'border-[#E5E7EB] bg-white hover:border-[#1B6EF3]'
                      }`}
                      style={{
                        borderRadius: '8px',
                        minHeight: '180px',
                      }}
                    >
                      {/* Top Badges */}
                      <div className="flex items-center gap-2 mb-3 flex-wrap">
                        <div
                          className={`px-2 py-1 text-[11px] ${
                            rule.type === 'discount'
                              ? 'bg-[#D1FAE5] text-[#065F46]'
                              : 'bg-[#EDE9FE] text-[#5B21B6]'
                          }`}
                          style={{ borderRadius: '4px', fontWeight: 500 }}
                        >
                          {rule.type === 'discount' ? (
                            <span className="flex items-center gap-1">
                              <TrendingDown className="w-3 h-3" />
                              Discount
                            </span>
                          ) : (
                            <span className="flex items-center gap-1">
                              <TrendingUp className="w-3 h-3" />
                              Premium
                            </span>
                          )}
                        </div>
                        <div
                          className="px-2 py-1 text-[11px] bg-[#F3F4F6] text-[#374151]"
                          style={{ borderRadius: '4px', fontWeight: 500 }}
                        >
                          {rule.basis === 'value' ? 'Value-Based' : 'Volume-Based'}
                        </div>
                        {isActive && (
                          <div
                            className="px-2 py-1 text-[11px] bg-[#D1FAE5] text-[#065F46] flex items-center gap-1"
                            style={{ borderRadius: '4px', fontWeight: 500 }}
                          >
                            <Check className="w-3 h-3" />
                            Applied
                          </div>
                        )}
                        {isInactive && (
                          <div
                            className="px-2 py-1 text-[11px] bg-[#FEF3C7] text-[#92400E]"
                            style={{ borderRadius: '4px', fontWeight: 500 }}
                          >
                            Applied
                          </div>
                        )}
                      </div>

                      {/* Rule Name */}
                      <div className="text-[13px] text-[#1F2937] mb-2" style={{ fontWeight: 600 }}>
                        {rule.name}
                      </div>

                      {/* Description */}
                      <div className="text-[12px] text-[#6B7280] mb-3">{rule.description}</div>

                      {/* Tier Structure */}
                      <div className="space-y-1 mb-3">
                        {rule.tierStructure === 'multi' ? (
                          <div className="text-[11px] text-[#9CA3AF]">
                            Multiple tier · {rule.tiers?.length || 0} tiers
                          </div>
                        ) : (
                          <div className="text-[11px] text-[#9CA3AF]">Single tier</div>
                        )}
                      </div>

                      {/* Conditions */}
                      <div className="space-y-1 text-[11px]">
                        {rule.minOrderQuantity !== undefined && (
                          <div className="flex justify-between text-[#6B7280]">
                            <span>Min Order Quantity</span>
                            <span style={{ fontWeight: 500 }}>{rule.minOrderQuantity} EA</span>
                          </div>
                        )}
                        {rule.maxOrderQuantity !== undefined && (
                          <div className="flex justify-between text-[#6B7280]">
                            <span>Max Order Quantity</span>
                            <span style={{ fontWeight: 500 }}>{rule.maxOrderQuantity} EA</span>
                          </div>
                        )}
                        {rule.minOrderValue !== undefined && (
                          <div className="flex justify-between text-[#6B7280]">
                            <span>Min Order Value</span>
                            <span style={{ fontWeight: 500 }}>${rule.minOrderValue}</span>
                          </div>
                        )}
                        {rule.discountPercentage !== undefined && (
                          <div className="flex justify-between text-[#065F46]">
                            <span>Discount</span>
                            <span style={{ fontWeight: 600 }}>{rule.discountPercentage}%</span>
                          </div>
                        )}
                        {rule.premiumPercentage !== undefined && (
                          <div className="flex justify-between text-[#7C3AED]">
                            <span>Premium</span>
                            <span style={{ fontWeight: 600 }}>+{rule.premiumPercentage}%</span>
                          </div>
                        )}
                      </div>

                      {/* Status indicator */}
                      {isActive && (
                        <div className="absolute top-3 right-3 w-5 h-5 bg-[#10B981] rounded-full flex items-center justify-center">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      )}
                      {isInactive && (
                        <div className="absolute top-3 right-3 w-5 h-5 bg-[#F59E0B] rounded-full flex items-center justify-center">
                          <Info className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {filteredRules.length === 0 && (
                <div className="text-center py-12">
                  <div className="text-[13px] text-[#6B7280]">No pricing rules found</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer with Cumulative Effect */}
        <div className="border-t border-[#E5E7EB] px-6 py-4 flex items-center justify-between flex-shrink-0 bg-[#FAFBFC]">
          <div className="flex items-center gap-6">
            <div>
              <div className="text-[11px] text-[#6B7280] mb-1">Selected Rules</div>
              <div className="text-[14px] text-[#1F2937]" style={{ fontWeight: 600 }}>
                {selectedRuleIds.size} rules
              </div>
            </div>
            <div className="h-10 w-px bg-[#E5E7EB]"></div>
            <div>
              <div className="text-[11px] text-[#6B7280] mb-1">Cumulative Effect</div>
              <div
                className={`text-[14px] ${
                  netEffect > 0
                    ? 'text-[#10B981]'
                    : netEffect < 0
                    ? 'text-[#7C3AED]'
                    : 'text-[#6B7280]'
                }`}
                style={{ fontWeight: 600 }}
              >
                {netEffect > 0 ? '-' : '+'}
                {Math.abs(netEffect)}% {netEffect > 0 ? 'discount' : netEffect < 0 ? 'premium' : ''}
              </div>
            </div>
            {totalDiscount > 0 && totalPremium > 0 && (
              <div className="text-[11px] text-[#9CA3AF]">
                ({totalDiscount}% discount - {totalPremium}% premium)
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 h-8 border border-[#E5E7EB] text-[13px] text-[#6B7280] hover:bg-white transition-colors"
              style={{ borderRadius: '6px', fontWeight: 500 }}
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className="px-4 h-8 bg-[#1B6EF3] text-white text-[13px] hover:bg-[#0D5ED7] transition-colors"
              style={{ borderRadius: '6px', fontWeight: 500 }}
            >
              Confirm
            </button>
          </div>
        </div>

        {/* Save Confirmation Dialog Overlay */}
        {showSaveConfirmation && (
          <div
            className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center"
            style={{ borderRadius: '12px' }}
          >
            <div className="bg-white p-6" style={{ borderRadius: '12px', width: '480px' }}>
              <h3 className="text-[14px] text-[#1F2937] mb-2" style={{ fontWeight: 600 }}>
                Save pricing rules as default?
              </h3>
              <p className="text-[13px] text-[#6B7280] mb-6">
                Do you want to apply these pricing rules only to this quote, or also save them as
                associated rules for <span style={{ fontWeight: 500 }}>{customerName}</span> with{' '}
                {itemName ? (
                  <span style={{ fontWeight: 500 }}>{itemName}</span>
                ) : (
                  'this item'
                )}{' '}
                for future quotes?
              </p>

              <div className="space-y-3 mb-6">
                <button
                  onClick={() => handleApplyRules(false)}
                  className="w-full text-left border border-[#E5E7EB] bg-white hover:border-[#1B6EF3] hover:bg-[#FAFBFC] transition-all p-4"
                  style={{ borderRadius: '8px' }}
                >
                  <div className="text-[13px] text-[#1F2937] mb-1" style={{ fontWeight: 600 }}>
                    This quote only
                  </div>
                  <div className="text-[12px] text-[#6B7280]">
                    Apply these pricing rules to the current quote without saving to customer records
                  </div>
                </button>

                <button
                  onClick={() => handleApplyRules(true)}
                  className="w-full text-left border border-[#E5E7EB] bg-white hover:border-[#1B6EF3] hover:bg-[#FAFBFC] transition-all p-4"
                  style={{ borderRadius: '8px' }}
                >
                  <div className="text-[13px] text-[#1F2937] mb-1" style={{ fontWeight: 600 }}>
                    Save as customer-item association
                  </div>
                  <div className="text-[12px] text-[#6B7280]">
                    Apply to this quote and associate with {customerName}'s records for {itemName || 'this item'}
                  </div>
                </button>
              </div>

              <button
                onClick={() => setShowSaveConfirmation(false)}
                className="w-full h-8 border border-[#E5E7EB] text-[13px] text-[#6B7280] hover:bg-[#F9FAFB] transition-colors"
                style={{ borderRadius: '6px', fontWeight: 500 }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}