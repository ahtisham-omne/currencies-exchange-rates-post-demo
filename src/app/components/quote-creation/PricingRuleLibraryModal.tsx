import { useState } from 'react';
import { X, Plus, Search, Check, AlertCircle, Tag, TrendingDown, TrendingUp, Package, DollarSign, Sparkles } from 'lucide-react';

interface PricingRuleLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  appliedRules: string[];
  onToggleRule: (ruleId: string) => void;
  currentQuantity: number;
  currentValue?: number;
}

interface PricingRule {
  id: string;
  name: string;
  description: string;
  type: 'discount' | 'premium';
  category: 'volume' | 'value' | 'custom';
  conditions: {
    minQuantity?: number;
    maxQuantity?: number;
    minValue?: number;
    maxValue?: number;
  };
  adjustmentType: 'percentage' | 'fixed';
  adjustmentValue: number;
  isMultiTier: boolean;
  tiers?: Array<{
    threshold: number;
    value: number;
  }>;
}

const PRESET_RULES: PricingRule[] = [
  {
    id: 'fleet-volume',
    name: 'Fleet Volume Discount',
    description: 'Discount for multi-unit fleet orders (3+ units)',
    type: 'discount',
    category: 'volume',
    conditions: { minQuantity: 3 },
    adjustmentType: 'percentage',
    adjustmentValue: 7,
    isMultiTier: true,
    tiers: [
      { threshold: 3, value: 4 },
      { threshold: 6, value: 7 },
      { threshold: 10, value: 10 },
    ],
  },
  {
    id: 'gov-contract',
    name: 'Government Contract Pricing',
    description: 'Municipal/state/federal contract discount',
    type: 'discount',
    category: 'custom',
    conditions: {},
    adjustmentType: 'percentage',
    adjustmentValue: 3,
    isMultiTier: false,
  },
  {
    id: 'state-bid',
    name: 'State Cooperative Bid',
    description: 'Cooperative purchasing agreement discount',
    type: 'discount',
    category: 'value',
    conditions: { minValue: 5000 },
    adjustmentType: 'percentage',
    adjustmentValue: 12,
    isMultiTier: false,
  },
  {
    id: 'oem-rebate',
    name: 'OEM Manufacturer Rebate',
    description: 'Pass-through rebate from equipment OEM',
    type: 'discount',
    category: 'value',
    conditions: { minValue: 10000 },
    adjustmentType: 'percentage',
    adjustmentValue: 3,
    isMultiTier: true,
    tiers: [
      { threshold: 10000, value: 3 },
      { threshold: 50000, value: 5 },
    ],
  },
  {
    id: 'rush-build',
    name: 'Expedited Build Premium',
    description: 'Surcharge for rush build schedule under 90 days',
    type: 'premium',
    category: 'custom',
    conditions: {},
    adjustmentType: 'percentage',
    adjustmentValue: 15,
    isMultiTier: false,
  },
  {
    id: 'custom-config',
    name: 'Custom Configuration Premium',
    description: 'Premium for non-standard build specifications',
    type: 'premium',
    category: 'custom',
    conditions: {},
    adjustmentType: 'percentage',
    adjustmentValue: 8,
    isMultiTier: false,
  },
  {
    id: 'small-order',
    name: 'Single-Unit Surcharge',
    description: 'Premium for single-unit conversion orders',
    type: 'premium',
    category: 'volume',
    conditions: { maxQuantity: 2 },
    adjustmentType: 'percentage',
    adjustmentValue: 10,
    isMultiTier: false,
  },
  {
    id: 'early-pay',
    name: 'Early Payment Incentive',
    description: '2% discount for payment within 10 days',
    type: 'discount',
    category: 'custom',
    conditions: {},
    adjustmentType: 'percentage',
    adjustmentValue: 2,
    isMultiTier: false,
  },
];

export function PricingRuleLibraryModal({
  isOpen,
  onClose,
  appliedRules,
  onToggleRule,
  currentQuantity,
  currentValue = 0,
}: PricingRuleLibraryModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'applied' | 'discount' | 'premium' | 'volume' | 'value'>('all');

  if (!isOpen) return null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const checkRuleCondition = (rule: PricingRule) => {
    const { minQuantity, maxQuantity, minValue, maxValue } = rule.conditions;
    
    let quantityMet = true;
    let valueMet = true;

    if (minQuantity !== undefined) quantityMet = currentQuantity >= minQuantity;
    if (maxQuantity !== undefined) quantityMet = currentQuantity <= maxQuantity;
    if (minValue !== undefined) valueMet = currentValue >= minValue;
    if (maxValue !== undefined) valueMet = currentValue <= maxValue;

    return quantityMet && valueMet;
  };

  const filteredRules = PRESET_RULES.filter((rule) => {
    // Search filter
    const matchesSearch = searchQuery === '' ||
      rule.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rule.description.toLowerCase().includes(searchQuery.toLowerCase());

    // Type/Category filter
    const matchesFilter = 
      filterType === 'all' ||
      (filterType === 'applied' && appliedRules.includes(rule.id)) ||
      (filterType === 'discount' && rule.type === 'discount') ||
      (filterType === 'premium' && rule.type === 'premium') ||
      (filterType === 'volume' && rule.category === 'volume') ||
      (filterType === 'value' && rule.category === 'value');

    return matchesSearch && matchesFilter;
  });

  // Group rules into categories for display
  const appliedRulesList = filteredRules.filter(r => appliedRules.includes(r.id));
  const discountRules = filteredRules.filter(r => r.type === 'discount' && !appliedRules.includes(r.id));
  const premiumRules = filteredRules.filter(r => r.type === 'premium' && !appliedRules.includes(r.id));

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 12000, backgroundColor: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(1px)' }}
      onClick={onClose}
    >
      <div
        className="bg-white flex flex-col overflow-hidden"
        style={{
          width: '70vw',
          maxWidth: '900px',
          height: '65vh',
          maxHeight: '70vh',
          borderRadius: '12px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E5E7EB] bg-white flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-[16px] text-[#1F2937] mb-1" style={{ fontWeight: 600 }}>
                Pricing Rules
              </h2>
              <p className="text-[12px] text-[#6B7280]">
                Apply discounts or premiums based on order quantity or value
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center hover:bg-[#F3F4F6] transition-colors"
              style={{ borderRadius: '6px' }}
            >
              <X className="w-4 h-4 text-[#6B7280]" />
            </button>
          </div>

          {/* Search and Filters */}
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
              <input
                type="text"
                placeholder="Search by name or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-9 pl-10 pr-4 text-[13px] border border-[#E5E7EB] bg-white focus:outline-none focus:ring-2 focus:ring-[#1B6EF3] focus:border-transparent"
                style={{ borderRadius: '6px' }}
              />
            </div>
            <button
              className="flex items-center gap-2 px-4 h-9 bg-[#1B6EF3] text-white text-[13px] hover:bg-[#0D5ED7] transition-colors"
              style={{ borderRadius: '6px', fontWeight: 500 }}
            >
              <Plus className="w-4 h-4" />
              Create Custom Rule
            </button>
          </div>

          {/* Filter Pills */}
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 h-7 text-[12px] transition-colors ${
                filterType === 'all'
                  ? 'bg-[#1B6EF3] text-white'
                  : 'bg-white border border-[#E5E7EB] text-[#6B7280] hover:bg-[#F9FAFB]'
              }`}
              style={{ borderRadius: '6px', fontWeight: 500 }}
            >
              All Rules
            </button>
            <button
              onClick={() => setFilterType('applied')}
              className={`px-3 h-7 text-[12px] transition-colors flex items-center gap-1 ${
                filterType === 'applied'
                  ? 'bg-[#1B6EF3] text-white'
                  : 'bg-white border border-[#E5E7EB] text-[#6B7280] hover:bg-[#F9FAFB]'
              }`}
              style={{ borderRadius: '6px', fontWeight: 500 }}
            >
              Applied
              {appliedRules.length > 0 && (
                <span className={`px-1.5 py-0.5 text-[10px] ${
                  filterType === 'applied' ? 'bg-white text-[#1B6EF3]' : 'bg-[#E5E7EB] text-[#6B7280]'
                }`} style={{ borderRadius: '3px', fontWeight: 600 }}>
                  {appliedRules.length}
                </span>
              )}
            </button>
            <div className="w-px bg-[#E5E7EB] mx-1"></div>
            <button
              onClick={() => setFilterType('discount')}
              className={`px-3 h-7 text-[12px] transition-colors ${
                filterType === 'discount'
                  ? 'bg-[#10B981] text-white'
                  : 'bg-white border border-[#E5E7EB] text-[#6B7280] hover:bg-[#F9FAFB]'
              }`}
              style={{ borderRadius: '6px', fontWeight: 500 }}
            >
              Discounts
            </button>
            <button
              onClick={() => setFilterType('premium')}
              className={`px-3 h-7 text-[12px] transition-colors ${
                filterType === 'premium'
                  ? 'bg-white border border-[#EF4444] text-[#EF4444]'
                  : 'bg-white border border-[#E5E7EB] text-[#6B7280] hover:bg-[#F9FAFB]'
              }`}
              style={{ borderRadius: '6px', fontWeight: 500 }}
            >
              Premiums
            </button>
            <button
              onClick={() => setFilterType('volume')}
              className={`px-3 h-7 text-[12px] transition-colors ${
                filterType === 'volume'
                  ? 'bg-[#6366F1] text-white'
                  : 'bg-white border border-[#E5E7EB] text-[#6B7280] hover:bg-[#F9FAFB]'
              }`}
              style={{ borderRadius: '6px', fontWeight: 500 }}
            >
              Volume-Based
            </button>
            <button
              onClick={() => setFilterType('value')}
              className={`px-3 h-7 text-[12px] transition-colors ${
                filterType === 'value'
                  ? 'bg-[#8B5CF6] text-white'
                  : 'bg-white border border-[#E5E7EB] text-[#6B7280] hover:bg-[#F9FAFB]'
              }`}
              style={{ borderRadius: '6px', fontWeight: 500 }}
            >
              Value-Based
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto bg-[#FAFBFC] p-6">
          {/* Applied Rules Section */}
          {appliedRulesList.length > 0 && filterType !== 'premium' && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Check className="w-4 h-4 text-[#10B981]" />
                <h3 className="text-[13px] text-[#1F2937]" style={{ fontWeight: 600 }}>
                  Applied to This Item ({appliedRulesList.length})
                </h3>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {appliedRulesList.map((rule) => {
                  const conditionMet = checkRuleCondition(rule);
                  return (
                    <RuleCard
                      key={rule.id}
                      rule={rule}
                      isApplied={true}
                      conditionMet={conditionMet}
                      onToggle={onToggleRule}
                      currentQuantity={currentQuantity}
                      currentValue={currentValue}
                      formatCurrency={formatCurrency}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Discount Rules Section */}
          {discountRules.length > 0 && filterType !== 'premium' && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <TrendingDown className="w-4 h-4 text-[#10B981]" />
                <h3 className="text-[13px] text-[#1F2937]" style={{ fontWeight: 600 }}>
                  Available Discounts
                </h3>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {discountRules.map((rule) => {
                  const conditionMet = checkRuleCondition(rule);
                  return (
                    <RuleCard
                      key={rule.id}
                      rule={rule}
                      isApplied={false}
                      conditionMet={conditionMet}
                      onToggle={onToggleRule}
                      currentQuantity={currentQuantity}
                      currentValue={currentValue}
                      formatCurrency={formatCurrency}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Premium Rules Section */}
          {premiumRules.length > 0 && filterType !== 'discount' && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-[#EF4444]" />
                <h3 className="text-[13px] text-[#1F2937]" style={{ fontWeight: 600 }}>
                  Premiums & Surcharges
                </h3>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {premiumRules.map((rule) => {
                  const conditionMet = checkRuleCondition(rule);
                  return (
                    <RuleCard
                      key={rule.id}
                      rule={rule}
                      isApplied={false}
                      conditionMet={conditionMet}
                      onToggle={onToggleRule}
                      currentQuantity={currentQuantity}
                      currentValue={currentValue}
                      formatCurrency={formatCurrency}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Empty State */}
          {filteredRules.length === 0 && (
            <div className="text-center py-16">
              <Tag className="w-12 h-12 text-[#D1D5DB] mx-auto mb-3" />
              <div className="text-[14px] text-[#6B7280] mb-1" style={{ fontWeight: 500 }}>
                No pricing rules found
              </div>
              <p className="text-[12px] text-[#9CA3AF]">
                Try adjusting your search or filters
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-[#E5E7EB] bg-white px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div className="text-[12px] text-[#6B7280]">
            {appliedRules.length > 0 ? (
              <>
                <span style={{ fontWeight: 600 }}>{appliedRules.length}</span> rule{appliedRules.length !== 1 ? 's' : ''} applied
              </>
            ) : (
              'No rules applied'
            )}
          </div>
          <button
            onClick={onClose}
            className="px-4 h-9 bg-[#1B6EF3] text-white text-[13px] hover:bg-[#0D5ED7] transition-colors"
            style={{ borderRadius: '6px', fontWeight: 500 }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

interface RuleCardProps {
  rule: PricingRule;
  isApplied: boolean;
  conditionMet: boolean;
  onToggle: (ruleId: string) => void;
  currentQuantity: number;
  currentValue: number;
  formatCurrency: (amount: number) => string;
}

function RuleCard({
  rule,
  isApplied,
  conditionMet,
  onToggle,
  currentQuantity,
  currentValue,
  formatCurrency,
}: RuleCardProps) {
  const isDiscount = rule.type === 'discount';
  const showWarning = isApplied && !conditionMet;

  // Calculate how close to unlocking
  const getOpportunityMessage = () => {
    const { minQuantity, minValue } = rule.conditions;
    
    if (minQuantity && currentQuantity < minQuantity) {
      const needed = minQuantity - currentQuantity;
      const percentage = (currentQuantity / minQuantity) * 100;
      if (percentage >= 70) {
        return `Add ${needed} more units to unlock this discount`;
      }
    }
    
    if (minValue && currentValue < minValue) {
      const needed = minValue - currentValue;
      const percentage = (currentValue / minValue) * 100;
      if (percentage >= 70) {
        return `Add ${formatCurrency(needed)} more to unlock this discount`;
      }
    }
    
    return null;
  };

  const opportunityMessage = !isApplied && isDiscount ? getOpportunityMessage() : null;

  return (
    <div
      className={`bg-white border-2 p-3 transition-all flex flex-col ${
        isApplied
          ? conditionMet
            ? 'border-[#10B981] shadow-sm'
            : 'border-[#F59E0B] shadow-sm'
          : 'border-[#E5E7EB] hover:border-[#D1D5DB]'
      }`}
      style={{ borderRadius: '8px' }}
    >
      <div className="flex gap-3 mb-3">
        {/* Icon */}
        <div
          className={`w-9 h-9 flex items-center justify-center flex-shrink-0 ${
            isDiscount ? 'bg-[#D1FAE5]' : 'bg-[#FEE2E2]'
          }`}
          style={{ borderRadius: '6px' }}
        >
          {rule.category === 'volume' ? (
            <Package className={`w-4 h-4 ${isDiscount ? 'text-[#065F46]' : 'text-[#991B1B]'}`} />
          ) : rule.category === 'value' ? (
            <DollarSign className={`w-4 h-4 ${isDiscount ? 'text-[#065F46]' : 'text-[#991B1B]'}`} />
          ) : (
            <Tag className={`w-4 h-4 ${isDiscount ? 'text-[#065F46]' : 'text-[#991B1B]'}`} />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                <h4 className="text-[13px] text-[#1F2937] leading-tight" style={{ fontWeight: 600 }}>
                  {rule.name}
                </h4>
                {rule.isMultiTier && (
                  <span
                    className="px-1.5 py-0.5 bg-[#E0F2FE] text-[#075985] text-[10px]"
                    style={{ borderRadius: '3px', fontWeight: 600 }}
                  >
                    MULTI-TIER
                  </span>
                )}
                {isApplied && (
                  conditionMet ? (
                    <span
                      className="px-1.5 py-0.5 bg-[#10B981] text-white text-[10px] flex items-center gap-0.5"
                      style={{ borderRadius: '3px', fontWeight: 600 }}
                    >
                      <Check className="w-2.5 h-2.5" />
                      ACTIVE
                    </span>
                  ) : (
                    <span
                      className="px-1.5 py-0.5 bg-[#F59E0B] text-white text-[10px] flex items-center gap-0.5"
                      style={{ borderRadius: '3px', fontWeight: 600 }}
                    >
                      <AlertCircle className="w-2.5 h-2.5" />
                      PENDING
                    </span>
                  )
                )}
              </div>
              <p className="text-[11px] text-[#6B7280] leading-snug">{rule.description}</p>
            </div>

            {/* Adjustment Value */}
            <div className="text-right flex-shrink-0">
              <div
                className={`text-[16px] leading-none ${isDiscount ? 'text-[#10B981]' : 'text-[#EF4444]'}`}
                style={{ fontWeight: 700 }}
              >
                {isDiscount ? '-' : '+'}
                {rule.adjustmentType === 'percentage'
                  ? `${rule.adjustmentValue}%`
                  : formatCurrency(rule.adjustmentValue)}
              </div>
              <div className="text-[10px] text-[#9CA3AF] leading-none mt-0.5">
                {isDiscount ? 'Discount' : 'Premium'}
              </div>
            </div>
          </div>

          {/* Conditions */}
          {Object.keys(rule.conditions).length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2 text-[10px]">
              {rule.conditions.minQuantity !== undefined && (
                <div className="flex items-center gap-1">
                  <span className="text-[#9CA3AF]">Min Qty:</span>
                  <span className="text-[#1F2937]" style={{ fontWeight: 500 }}>
                    {rule.conditions.minQuantity} units
                  </span>
                </div>
              )}
              {rule.conditions.maxQuantity !== undefined && (
                <div className="flex items-center gap-1">
                  <span className="text-[#9CA3AF]">Max Qty:</span>
                  <span className="text-[#1F2937]" style={{ fontWeight: 500 }}>
                    {rule.conditions.maxQuantity} units
                  </span>
                </div>
              )}
              {rule.conditions.minValue !== undefined && (
                <div className="flex items-center gap-1">
                  <span className="text-[#9CA3AF]">Min Value:</span>
                  <span className="text-[#1F2937]" style={{ fontWeight: 500 }}>
                    {formatCurrency(rule.conditions.minValue)}
                  </span>
                </div>
              )}
              {rule.conditions.maxValue !== undefined && (
                <div className="flex items-center gap-1">
                  <span className="text-[#9CA3AF]">Max Value:</span>
                  <span className="text-[#1F2937]" style={{ fontWeight: 500 }}>
                    {formatCurrency(rule.conditions.maxValue)}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Multi-tier breakdown */}
      {rule.isMultiTier && rule.tiers && (
        <div className="mb-2 p-2 bg-[#F9FAFB] border border-[#E5E7EB]" style={{ borderRadius: '4px' }}>
          <div className="text-[10px] text-[#6B7280] mb-1" style={{ fontWeight: 600 }}>
            TIER BREAKDOWN:
          </div>
          <div className="flex gap-2 flex-wrap text-[10px]">
            {rule.tiers.map((tier, index) => (
              <div key={index}>
                <span className="text-[#9CA3AF]">
                  {tier.threshold}+ {rule.category === 'volume' ? 'units' : ''}:
                </span>{' '}
                <span className="text-[#1F2937]" style={{ fontWeight: 600 }}>
                  {isDiscount ? '-' : '+'}
                  {rule.adjustmentType === 'percentage' ? `${tier.value}%` : formatCurrency(tier.value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Warning or Opportunity */}
      {showWarning && (
        <div className="mb-2 p-2 bg-[#FEF3C7] border border-[#FCD34D] flex items-start gap-1.5" style={{ borderRadius: '4px' }}>
          <AlertCircle className="w-3 h-3 text-[#D97706] flex-shrink-0 mt-0.5" />
          <div className="text-[10px] text-[#92400E] leading-snug">
            {rule.conditions.minQuantity && currentQuantity < rule.conditions.minQuantity &&
              `Needs ${rule.conditions.minQuantity - currentQuantity} more units (currently ${currentQuantity})`}
            {rule.conditions.minValue && currentValue < rule.conditions.minValue &&
              `Needs ${formatCurrency(rule.conditions.minValue - currentValue)} more (currently ${formatCurrency(currentValue)})`}
            {rule.conditions.maxQuantity && currentQuantity > rule.conditions.maxQuantity &&
              `Exceeds maximum quantity of ${rule.conditions.maxQuantity}`}
            {rule.conditions.maxValue && currentValue > rule.conditions.maxValue &&
              `Exceeds maximum value of ${formatCurrency(rule.conditions.maxValue)}`}
          </div>
        </div>
      )}

      {opportunityMessage && (
        <div className="mb-2 p-2 bg-[#FFFBEB] border border-[#FCD34D] flex items-start gap-1.5" style={{ borderRadius: '4px' }}>
          <Sparkles className="w-3 h-3 text-[#F59E0B] flex-shrink-0 mt-0.5" />
          <div className="text-[10px] text-[#92400E] leading-snug" style={{ fontWeight: 500 }}>
            {opportunityMessage}
          </div>
        </div>
      )}

      {/* Actions - Pushed to bottom with margin-top auto */}
      <button
        onClick={() => onToggle(rule.id)}
        className={`w-full h-8 text-[12px] transition-colors flex items-center justify-center gap-1.5 mt-auto ${
          isApplied
            ? 'border border-[#E5E7EB] text-[#6B7280] hover:bg-[#FEE2E2] hover:text-[#991B1B] hover:border-[#FEE2E2]'
            : isDiscount
            ? 'bg-[#1B6EF3] text-white hover:bg-[#0D5ED7]'
            : 'border border-[#EF4444] text-[#EF4444] hover:bg-[#FEF2F2]'
        }`}
        style={{ borderRadius: '6px', fontWeight: 500 }}
      >
        {isApplied ? (
          <>
            <X className="w-3.5 h-3.5" />
            Remove Rule
          </>
        ) : (
          <>
            <Plus className="w-3.5 h-3.5" />
            Apply Rule
          </>
        )}
      </button>
    </div>
  );
}