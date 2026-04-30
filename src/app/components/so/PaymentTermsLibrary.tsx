import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Search, Plus, Receipt, Building2, Check, Copy, Eye, Lock } from 'lucide-react';

/* ─── Types ─── */
export interface PaymentTermPreset {
  id: string;
  name: string;
  category: 'net' | 'prepayment' | 'split';
  typeBadge: string;
  badgeColor: string;
  trigger: string;
  description: string;
  customersApplied: number;
  duration?: string;
  applyDiscount?: boolean;
  discountPercent?: string;
  discountMode?: 'percent' | 'fixed';
  discountPeriod?: string;
}

interface PaymentTermsLibraryProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (term: PaymentTermPreset, saveAsDefault: boolean) => void;
  currentTermId?: string;
  customerName: string;
}

/* ─── Data ─── */
const MOCK_PAYMENT_TERMS: PaymentTermPreset[] = [
  { id: 'pt-1', name: 'Net 10', category: 'net', typeBadge: 'NET', badgeColor: '#0A77FF', trigger: 'Invoice Date', description: 'Payment is due 10 days after the invoice date.', customersApplied: 24, duration: '10' },
  { id: 'pt-2', name: 'Net 15', category: 'net', typeBadge: 'NET', badgeColor: '#0A77FF', trigger: 'Invoice Date', description: 'Payment is due 15 days after the invoice date.', customersApplied: 18, duration: '15' },
  { id: 'pt-3', name: 'Net 20', category: 'net', typeBadge: 'NET', badgeColor: '#0A77FF', trigger: 'Invoice Date', description: 'Payment is due 20 days after the invoice date.', customersApplied: 12, duration: '20' },
  { id: 'pt-4', name: 'Net 30 Post Shipping', category: 'net', typeBadge: 'NET', badgeColor: '#0A77FF', trigger: 'Shipping', description: 'Full payment is due 30 days after the goods are shipped.', customersApplied: 42, duration: '30' },
  { id: 'pt-5', name: 'Net 45 Post Delivery', category: 'net', typeBadge: 'NET', badgeColor: '#0A77FF', trigger: 'Delivery', description: 'Payment is due 45 days after goods are delivered.', customersApplied: 31, duration: '45' },
  { id: 'pt-6', name: 'Net 60 Post Production End', category: 'net', typeBadge: 'NET', badgeColor: '#0A77FF', trigger: 'Production End', description: 'Payment is due 60 days after production is completed.', customersApplied: 8, duration: '60' },
  { id: 'pt-7', name: 'Full Advance Payment: Order Confirmation', category: 'prepayment', typeBadge: 'Pre', badgeColor: '#7C3AED', trigger: 'Order Confirmation', description: '100% of the total amount is paid when the order is confirmed.', customersApplied: 67 },
  { id: 'pt-8', name: 'Full Advance Payment: Production Begins', category: 'prepayment', typeBadge: 'Pre', badgeColor: '#7C3AED', trigger: 'Production Start', description: 'A prepayment is required when production starts.', customersApplied: 23 },
  { id: 'pt-9', name: '30/70 Split: Production Start & Delivery', category: 'split', typeBadge: 'Split', badgeColor: '#D97706', trigger: 'Production Start', description: '30% is due at production start, 70% on delivery.', customersApplied: 45 },
  { id: 'pt-10', name: '50/50 Split: Order & Delivery', category: 'split', typeBadge: 'Split', badgeColor: '#D97706', trigger: 'Order Confirmation', description: '50% due at order confirmation, 50% on delivery.', customersApplied: 89 },
  { id: 'pt-11', name: '2/10 Net 30', category: 'net', typeBadge: 'NET', badgeColor: '#0A77FF', trigger: 'Invoice Date', description: '2% discount if paid in 10 days, otherwise net 30.', customersApplied: 156, duration: '30', applyDiscount: true, discountPercent: '2', discountPeriod: '10' },
];

const CATEGORIES = [
  { id: 'all', label: 'All Terms' },
  { id: 'net', label: 'NET Terms' },
  { id: 'prepayment', label: 'Prepayment' },
  { id: 'split', label: 'Split Payment' },
];

/* ─── Split tier parser (mirrors Partner Management) ─── */
function parseSplits(desc: string): { pct: string; label: string }[] {
  const matches = desc.match(/(\d+)%/g);
  if (!matches || matches.length < 2) return [];
  return matches.map((s, i) => {
    const pct = s.replace('%', '');
    const parts = desc.split(s);
    const afterText = parts[1]?.split(/[,.]/).shift()?.trim().replace(/^(is )?due (at |on )?/, '').replace(/^at /, '').trim() || '';
    return { pct, label: afterText || `Event ${i + 1}` };
  });
}

/* ─── Split Tier Display ─── */
function SplitTierDisplay({ term }: { term: PaymentTermPreset }) {
  const splits = parseSplits(term.description);
  const [activeIdx, setActiveIdx] = useState(0);
  const shown = splits[activeIdx];
  if (splits.length === 0) return null;

  return (
    <>
      <div className="flex items-baseline gap-2 shrink-0">
        <span className="text-[22px] text-[#0F172A] tabular-nums leading-none tracking-tight" style={{ fontWeight: 600 }}>{splits.length}</span>
        <span className="text-[11px] text-[#94A3B8]" style={{ fontWeight: 500 }}>{splits.length === 1 ? 'split' : 'splits'}</span>
      </div>
      <div className="mt-auto pt-2 shrink-0" onClick={(e) => e.stopPropagation()}>
        <div className={`h-[24px] mb-1.5 ${splits.length > 1 ? 'flex items-center gap-[3px]' : ''}`}>
          {splits.length > 1 && splits.map((s, i) => {
            const isActive = activeIdx === i;
            return (
              <button key={i} onClick={(e) => { e.stopPropagation(); setActiveIdx(i); }}
                className={`h-[22px] rounded-md text-[10px] tabular-nums transition-all cursor-pointer flex items-center justify-center px-2 ${isActive ? 'shadow-sm' : 'bg-transparent text-[#C0C9D4] hover:text-[#94A3B8]'}`}
                style={{ fontWeight: isActive ? 600 : 500, ...(isActive ? { backgroundColor: `${term.badgeColor}18`, color: term.badgeColor, boxShadow: `0 0 0 1px ${term.badgeColor}40` } : {}) }}
              >
                S{i + 1}
                {isActive && <span className="ml-1 text-[9px] opacity-60" style={{ fontWeight: 400 }}>{s.pct}%</span>}
              </button>
            );
          })}
        </div>
        {shown && (
          <div className="flex items-center justify-between px-3 py-[6px] rounded-lg border border-[#E8ECF1] bg-[#FAFBFC] text-[11px] tabular-nums min-w-0">
            <span className="text-[#64748B] capitalize truncate" style={{ fontWeight: 400 }}>{shown.label}</span>
            <span className="shrink-0 ml-2 text-[#0F172A]" style={{ fontWeight: 600 }}>{shown.pct}%</span>
          </div>
        )}
      </div>
    </>
  );
}

/* ─── Payment Term Card (Partner Management style) ─── */
function PaymentTermCard({ term, isSelected, isCurrent, onClick, searchText }: {
  term: PaymentTermPreset; isSelected: boolean; isCurrent: boolean; onClick: () => void; searchText?: string;
}) {
  const ptDays = term.duration || (term.name.match(/\d+/) ? term.name.match(/\d+/)![0] : '30');
  const badgeColor = term.badgeColor;

  function highlight(text: string) {
    if (!searchText?.trim()) return text;
    const idx = text.toLowerCase().indexOf(searchText.toLowerCase());
    if (idx === -1) return text;
    return <>{text.slice(0, idx)}<mark className="bg-transparent px-0.5 rounded-sm" style={{ backgroundColor: '#FEFCE8', color: '#854D0E', fontWeight: 500 }}>{text.slice(idx, idx + searchText.length)}</mark>{text.slice(idx + searchText.length)}</>;
  }

  return (
    <div onClick={onClick}
      className={`bg-white border rounded-xl cursor-pointer group transition-all flex flex-col relative ${
        isSelected ? 'border-[#0A77FF]/25 shadow-[0_2px_12px_rgba(10,119,255,0.10)]' : 'border-[#E8ECF1] shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:border-[#BFDBFE] hover:shadow-[0_4px_16px_-4px_rgba(10,119,255,0.10)]'
      }`}
    >
      {isSelected && (
        <div className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-[#0A77FF] flex items-center justify-center z-10 shadow-sm">
          <Check className="w-3 h-3 text-white" />
        </div>
      )}

      <div className="p-3 flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Type pill + trigger */}
        <div className="flex items-center justify-between gap-2 mb-2 shrink-0">
          <span className="inline-flex items-stretch rounded-full overflow-hidden border shrink-0" style={{ borderColor: badgeColor + '40' }}>
            <span className="inline-flex items-center gap-1 px-2 py-[2px] text-[10px]" style={{ fontWeight: 600, color: badgeColor, backgroundColor: badgeColor + '15' }}>
              <Receipt className="w-3 h-3" />{term.typeBadge}
            </span>
            <span className="inline-flex items-center px-2 py-[2px] text-[10px] bg-white text-[#64748B] border-l" style={{ fontWeight: 500, borderColor: badgeColor + '40' }}>
              {term.trigger}
            </span>
          </span>
          {isCurrent && (
            <span className="inline-flex items-center gap-1 px-1.5 py-[3px] rounded-md border border-[#CBD5E1] bg-[#F1F5F9] text-[9px] text-[#64748B]" style={{ fontWeight: 600 }}>CURRENT</span>
          )}
        </div>

        {/* Name */}
        <div className="shrink-0 mb-1">
          <p className="text-[13px] text-[#0F172A] truncate" style={{ fontWeight: 600 }}>{highlight(term.name)}</p>
        </div>

        {/* Description */}
        <div className="h-[32px] shrink-0 mb-2">
          <p className="text-[11px] text-[#64748B] line-clamp-2 leading-relaxed" style={{ fontWeight: 400 }}>{highlight(term.description)}</p>
        </div>

        {/* Hero value */}
        {term.category === 'split' ? (
          <SplitTierDisplay term={term} />
        ) : (
          <div className="flex items-baseline justify-between shrink-0">
            <div className="flex items-baseline gap-2">
              <span className="text-[22px] text-[#0F172A] tabular-nums leading-none tracking-tight" style={{ fontWeight: 600 }}>{ptDays}</span>
              <span className="text-[11px] text-[#94A3B8]" style={{ fontWeight: 500 }}>days</span>
            </div>
            <span className="inline-flex items-center gap-1 text-[10px] text-[#94A3B8]" style={{ fontWeight: 500 }}>
              <Building2 className="w-3 h-3" /> {term.customersApplied} in use
            </span>
          </div>
        )}

        {/* Discount info */}
        {(term.applyDiscount || term.discountPercent) && (
          <div className="pt-1.5 shrink-0">
            <div className="flex items-center px-2.5 py-[5px] rounded-lg border border-[#E8ECF1] bg-[#FAFBFC] text-[11px] tabular-nums">
              <span className="text-[#64748B]" style={{ fontWeight: 400 }}>
                Early pay {term.discountPercent || '2'}% within {term.discountPeriod || '10'} days
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="grid grid-cols-2 border-t border-[#F1F5F9] shrink-0">
        <button onClick={(e) => { e.stopPropagation(); onClick(); }}
          className="inline-flex items-center justify-center gap-1 py-2 text-[11px] text-[#64748B] hover:text-[#0A77FF] hover:bg-[#F8FAFC] transition-colors border-r border-[#F1F5F9]"
          style={{ fontWeight: 500 }}
        >
          <Check className="w-3 h-3" /> Apply
        </button>
        <button onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center justify-center gap-1 py-2 text-[11px] text-[#64748B] hover:text-[#0A77FF] hover:bg-[#F8FAFC] transition-colors"
          style={{ fontWeight: 500 }}
        >
          <Copy className="w-3 h-3" /> Duplicate
        </button>
      </div>
    </div>
  );
}

/* ─── Main Library Modal ─── */
// Keep the old PaymentTerm type export for backward compat
export type PaymentTerm = PaymentTermPreset;

export function PaymentTermsLibrary({ isOpen, onClose, onSelect, currentTermId, customerName }: PaymentTermsLibraryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedTermId, setSelectedTermId] = useState<string | null>(currentTermId || null);
  const [showSaveConfirmation, setShowSaveConfirmation] = useState(false);
  const [pendingTerm, setPendingTerm] = useState<PaymentTermPreset | null>(null);

  if (!isOpen) return null;

  const filteredTerms = MOCK_PAYMENT_TERMS.filter((term) => {
    const matchesSearch = term.name.toLowerCase().includes(searchQuery.toLowerCase()) || term.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || term.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleTermClick = (term: PaymentTermPreset) => {
    setSelectedTermId(term.id);
    setPendingTerm(term);
    setShowSaveConfirmation(true);
  };

  const handleConfirm = (saveAsDefault: boolean) => {
    if (pendingTerm) {
      onSelect(pendingTerm as any, saveAsDefault);
      setShowSaveConfirmation(false);
      setPendingTerm(null);
      onClose();
    }
  };

  return createPortal(
    <div className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 10001, backgroundColor: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(1px)' }}
      onClick={(e) => { if (e.target === e.currentTarget && !showSaveConfirmation) onClose(); }}
    >
      <div className="flex flex-col bg-white" style={{ width: '90vw', maxWidth: 1200, height: '85vh', maxHeight: 800, borderRadius: 12 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3 flex items-center justify-between shrink-0 border-b border-[#E2E8F0]">
          <div>
            <h2 className="text-sm text-[#0F172A]" style={{ fontWeight: 600 }}>Select Payment Terms</h2>
            <p className="text-[12px] text-[#64748B] mt-0.5">Choose payment terms for this sales order</p>
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
                const count = cat.id === 'all' ? MOCK_PAYMENT_TERMS.length : MOCK_PAYMENT_TERMS.filter(t => t.category === cat.id).length;
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
                <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search payment terms..."
                  className="w-full h-9 pl-9 pr-3 text-[12px] bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg focus:outline-none focus:border-[#0A77FF] focus:ring-1 focus:ring-[#0A77FF]/20 transition-colors placeholder:text-[#94A3B8]"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              <div className="grid grid-cols-3 gap-3">
                {filteredTerms.map((term) => (
                  <PaymentTermCard
                    key={term.id}
                    term={term}
                    isSelected={selectedTermId === term.id}
                    isCurrent={currentTermId === term.id}
                    onClick={() => handleTermClick(term)}
                    searchText={searchQuery}
                  />
                ))}
              </div>
              {filteredTerms.length === 0 && <div className="text-center py-12 text-[13px] text-[#94A3B8]">No payment terms found</div>}
            </div>
          </div>
        </div>

        {/* Save Confirmation Overlay */}
        {showSaveConfirmation && pendingTerm && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center" style={{ borderRadius: 12 }}>
            <div className="bg-white p-6" style={{ borderRadius: 12, width: 480, boxShadow: '0 24px 48px -12px rgba(0,0,0,0.18)' }}>
              <h3 className="text-sm text-[#0F172A] mb-2" style={{ fontWeight: 600 }}>Save payment term as default?</h3>
              <p className="text-[13px] text-[#64748B] mb-5">
                Apply "<span style={{ fontWeight: 500 }}>{pendingTerm.name}</span>" only to this order, or also save as the default for <span style={{ fontWeight: 500 }}>{customerName}</span>?
              </p>
              <div className="space-y-2.5 mb-5">
                <button onClick={() => handleConfirm(false)} className="w-full text-left p-4 rounded-xl border border-[#E2E8F0] bg-white hover:border-[#BFDBFE] hover:bg-[#F8FAFC] transition-all">
                  <div className="text-[13px] text-[#0F172A] mb-1" style={{ fontWeight: 600 }}>This order only</div>
                  <div className="text-[12px] text-[#64748B]">Apply without changing customer defaults</div>
                </button>
                <button onClick={() => handleConfirm(true)} className="w-full text-left p-4 rounded-xl border border-[#E2E8F0] bg-white hover:border-[#BFDBFE] hover:bg-[#F8FAFC] transition-all">
                  <div className="text-[13px] text-[#0F172A] mb-1" style={{ fontWeight: 600 }}>Save as customer default</div>
                  <div className="text-[12px] text-[#64748B]">Apply and update {customerName}'s default for future orders</div>
                </button>
              </div>
              <button onClick={() => { setShowSaveConfirmation(false); setPendingTerm(null); }}
                className="w-full h-8 text-[12px] rounded-lg border border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC] transition-colors" style={{ fontWeight: 500 }}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
