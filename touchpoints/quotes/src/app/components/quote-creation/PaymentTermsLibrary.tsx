import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Search, Plus, ChevronRight } from 'lucide-react';

interface PaymentTerm {
  id: string;
  name: string;
  category: 'NET' | 'Prepayment' | 'Split' | 'Custom';
  categoryLabel: string;
  description: string;
  customersApplied: number;
  customerAvatars?: string[];
}

interface PaymentTermsLibraryProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (term: PaymentTerm, saveAsDefault: boolean) => void;
  currentTermId?: string;
  customerName: string;
}

const MOCK_PAYMENT_TERMS: PaymentTerm[] = [
  {
    id: 'net10',
    name: 'Net 10',
    category: 'NET',
    categoryLabel: 'Invoice Date',
    description: 'Payment is due 10 days after the invoice date.',
    customersApplied: 24,
  },
  {
    id: 'net15',
    name: 'Net 15',
    category: 'NET',
    categoryLabel: 'Invoice Date',
    description: 'Payment is due 15 days after the invoice date.',
    customersApplied: 18,
  },
  {
    id: 'net20',
    name: 'Net 20',
    category: 'NET',
    categoryLabel: 'Invoice Date',
    description: 'Payment is due 20 days after the invoice date.',
    customersApplied: 12,
  },
  {
    id: 'net30',
    name: 'Net 30',
    category: 'NET',
    categoryLabel: 'Invoice Date',
    description: 'Payment is due 30 days after the invoice date.',
    customersApplied: 156,
  },
  {
    id: 'net30-shipping',
    name: 'Net 30 Post Shipping',
    category: 'NET',
    categoryLabel: 'Shipping',
    description: 'Full payment is due 30 days after the goods are shipped.',
    customersApplied: 42,
  },
  {
    id: 'net45-delivery',
    name: 'Net 45 Post Delivery',
    category: 'NET',
    categoryLabel: 'Delivery',
    description: 'Payment is due 45 days after goods are delivered',
    customersApplied: 31,
  },
  {
    id: 'net60-production',
    name: 'Net 60 Post Production End',
    category: 'NET',
    categoryLabel: 'Production End',
    description: 'Payment is due 60 days after production is completed.',
    customersApplied: 8,
  },
  {
    id: 'full-advance-order',
    name: 'Full Advance Payment: Order Confirmation',
    category: 'Prepayment',
    categoryLabel: 'Order Confirmation',
    description: '100% of the total amount is paid when the order is confirmed.',
    customersApplied: 67,
  },
  {
    id: 'full-advance-production',
    name: 'Full Advance Payment: Production Begins',
    category: 'Prepayment',
    categoryLabel: 'Production Start',
    description: 'A prepayment is required when production starts.',
    customersApplied: 23,
  },
  {
    id: 'split-30-70',
    name: '30/70 Split: Production Start & Delivery',
    category: 'Split',
    categoryLabel: 'Production Start',
    description: '30% is due at production start, 70% on delivery.',
    customersApplied: 45,
  },
  {
    id: 'split-50-50',
    name: '50/50 Split: Order & Delivery',
    category: 'Split',
    categoryLabel: 'Order & Delivery',
    description: '50% due at order confirmation, 50% on delivery.',
    customersApplied: 89,
  },
  {
    id: 'order-delivery',
    name: 'Order Confirmation & Delivery',
    category: 'Custom',
    categoryLabel: 'Custom',
    description: 'Custom payment schedule tied to order and delivery milestones.',
    customersApplied: 12,
  },
];

const CATEGORIES = [
  { id: 'all', label: 'All Terms', count: MOCK_PAYMENT_TERMS.length },
  { id: 'net', label: 'NET Terms', count: MOCK_PAYMENT_TERMS.filter(t => t.category === 'NET').length },
  { id: 'prepayment', label: 'Prepayment Terms', count: MOCK_PAYMENT_TERMS.filter(t => t.category === 'Prepayment').length },
  { id: 'split', label: 'Split Payment', count: MOCK_PAYMENT_TERMS.filter(t => t.category === 'Split').length },
  { id: 'custom', label: 'Custom Terms', count: MOCK_PAYMENT_TERMS.filter(t => t.category === 'Custom').length },
];

export function PaymentTermsLibrary({
  isOpen,
  onClose,
  onSelect,
  currentTermId,
  customerName,
}: PaymentTermsLibraryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedTermId, setSelectedTermId] = useState<string | null>(currentTermId || null);
  const [showSaveConfirmation, setShowSaveConfirmation] = useState(false);
  const [pendingTerm, setPendingTerm] = useState<PaymentTerm | null>(null);

  if (!isOpen) return null;

  const filteredTerms = MOCK_PAYMENT_TERMS.filter((term) => {
    const matchesSearch =
      term.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      term.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategory === 'all' || term.category.toLowerCase() === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleTermClick = (term: PaymentTerm) => {
    setSelectedTermId(term.id);
    setPendingTerm(term);
    setShowSaveConfirmation(true);
  };

  const handleConfirm = (saveAsDefault: boolean) => {
    if (pendingTerm) {
      onSelect(pendingTerm, saveAsDefault);
      setShowSaveConfirmation(false);
      setPendingTerm(null);
      onClose();
    }
  };

  const getCategoryBadgeColor = (category: string) => {
    switch (category) {
      case 'NET':
        return 'bg-[#DBEAFE] text-[#1E40AF]';
      case 'Prepayment':
        return 'bg-[#E0E7FF] text-[#3730A3]';
      case 'Split':
        return 'bg-[#FCE7F3] text-[#9F1239]';
      case 'Custom':
        return 'bg-[#F3F4F6] text-[#374151]';
      default:
        return 'bg-[#F3F4F6] text-[#374151]';
    }
  };

  return createPortal(
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
              Select payment terms
            </h2>
            <p className="text-[12px] text-[#6B7280] mt-1">
              Choose payment terms for this quote
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              className="h-8 px-4 bg-[#1B6EF3] text-white text-[13px] hover:bg-[#0D5ED7] transition-colors flex items-center gap-2"
              style={{ borderRadius: '6px', fontWeight: 500 }}
              onClick={() => {
                // TODO: Open create payment terms flow
                console.log('Create payment terms');
              }}
            >
              <Plus className="w-4 h-4" />
              Create Payment Terms
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

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar */}
          <div
            className="border-r border-[#E5E7EB] flex flex-col bg-[#FAFBFC]"
            style={{ width: '240px' }}
          >
            <div className="p-4 space-y-1">
              {CATEGORIES.map((category) => (
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
                    {category.count}
                  </span>
                </button>
              ))}
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
                  placeholder="Search payment terms..."
                  className="w-full h-10 pl-10 pr-4 text-[13px] border border-[#E5E7EB] bg-white focus:outline-none focus:ring-2 focus:ring-[#1B6EF3] focus:border-transparent"
                  style={{ borderRadius: '6px' }}
                  autoFocus
                />
              </div>
            </div>

            {/* Terms Grid */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="grid grid-cols-3 gap-4">
                {filteredTerms.map((term) => {
                  const isSelected = selectedTermId === term.id;
                  const isCurrent = currentTermId === term.id;

                  return (
                    <button
                      key={term.id}
                      onClick={() => handleTermClick(term)}
                      className={`text-left border-2 transition-all p-4 hover:border-[#1B6EF3] relative group`}
                      style={{
                        borderRadius: '8px',
                        borderColor: isSelected ? '#1B6EF3' : '#E5E7EB',
                        backgroundColor: isSelected ? '#F3F7FF' : 'white',
                        minHeight: '140px',
                      }}
                    >
                      {/* Category Badge */}
                      <div className="flex items-center gap-2 mb-3">
                        <div
                          className={`px-2 py-1 text-[11px] ${getCategoryBadgeColor(term.category)}`}
                          style={{ borderRadius: '4px', fontWeight: 500 }}
                        >
                          {term.category}
                        </div>
                        {isCurrent && (
                          <div
                            className="px-2 py-1 text-[11px] bg-[#F3F4F6] text-[#6B7280]"
                            style={{ borderRadius: '4px', fontWeight: 500 }}
                          >
                            Current
                          </div>
                        )}
                      </div>

                      {/* Term Name */}
                      <div className="text-[13px] text-[#1F2937] mb-1" style={{ fontWeight: 600 }}>
                        {term.name}
                      </div>

                      {/* Category Label */}
                      <div className="text-[11px] text-[#9CA3AF] mb-2">{term.categoryLabel}</div>

                      {/* Description */}
                      <div className="text-[12px] text-[#6B7280] mb-3 line-clamp-2">
                        {term.description}
                      </div>

                      {/* Customers Applied */}
                      <div className="flex items-center gap-2 mt-auto">
                        <div className="flex -space-x-2">
                          {[1, 2, 3].map((i) => (
                            <div
                              key={i}
                              className="w-6 h-6 rounded-full bg-gradient-to-br from-[#1B6EF3] to-[#9333EA] border-2 border-white flex items-center justify-center text-[10px] text-white"
                              style={{ fontWeight: 600 }}
                            >
                              {String.fromCharCode(64 + i)}
                            </div>
                          ))}
                        </div>
                        <span className="text-[11px] text-[#9CA3AF]">
                          +{term.customersApplied - 3} customers
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {filteredTerms.length === 0 && (
                <div className="text-center py-12">
                  <div className="text-[13px] text-[#6B7280]">No payment terms found</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Save Confirmation Dialog Overlay */}
        {showSaveConfirmation && pendingTerm && (
          <div
            className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center"
            style={{ borderRadius: '12px' }}
          >
            <div className="bg-white p-6" style={{ borderRadius: '12px', width: '480px' }}>
              <h3 className="text-[14px] text-[#1F2937] mb-2" style={{ fontWeight: 600 }}>
                Save payment term as default?
              </h3>
              <p className="text-[13px] text-[#6B7280] mb-6">
                Do you want to apply "{pendingTerm.name}" only to this quote, or also save it as the
                default payment term for <span style={{ fontWeight: 500 }}>{customerName}</span> for
                all future quotes?
              </p>

              <div className="space-y-3 mb-6">
                <button
                  onClick={() => handleConfirm(false)}
                  className="w-full text-left border border-[#E5E7EB] bg-white hover:border-[#1B6EF3] hover:bg-[#FAFBFC] transition-all p-4"
                  style={{ borderRadius: '8px' }}
                >
                  <div className="text-[13px] text-[#1F2937] mb-1" style={{ fontWeight: 600 }}>
                    This quote only
                  </div>
                  <div className="text-[12px] text-[#6B7280]">
                    Apply this payment term to the current quote without changing customer defaults
                  </div>
                </button>

                <button
                  onClick={() => handleConfirm(true)}
                  className="w-full text-left border border-[#E5E7EB] bg-white hover:border-[#1B6EF3] hover:bg-[#FAFBFC] transition-all p-4"
                  style={{ borderRadius: '8px' }}
                >
                  <div className="text-[13px] text-[#1F2937] mb-1" style={{ fontWeight: 600 }}>
                    Save as customer default
                  </div>
                  <div className="text-[12px] text-[#6B7280]">
                    Apply to this quote and update {customerName}'s default for future quotes
                  </div>
                </button>
              </div>

              <button
                onClick={() => {
                  setShowSaveConfirmation(false);
                  setPendingTerm(null);
                }}
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
  , document.body);
}