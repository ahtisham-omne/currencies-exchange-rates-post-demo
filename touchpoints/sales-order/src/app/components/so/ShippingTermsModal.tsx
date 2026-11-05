import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Search, Check, Truck, Info } from 'lucide-react';

interface ShippingTerm {
  id: string;
  name: string;
  code: string;
  description: string;
  responsibility: string;
}

interface ShippingTermsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (term: ShippingTerm) => void;
  currentTermId?: string;
}

const SHIPPING_TERMS: ShippingTerm[] = [
  { id: 'fob-origin', name: 'FOB Origin (Shipping Point)', code: 'FOB Origin', description: 'Buyer assumes ownership and risk when goods leave the seller\'s shipping dock.', responsibility: 'Buyer pays freight' },
  { id: 'fob-destination', name: 'FOB Destination', code: 'FOB Dest.', description: 'Seller retains ownership and risk until goods reach the buyer\'s location.', responsibility: 'Seller pays freight' },
  { id: 'cif', name: 'CIF (Cost, Insurance & Freight)', code: 'CIF', description: 'Seller pays cost, insurance, and freight to the destination port.', responsibility: 'Seller pays to port of destination' },
  { id: 'exw', name: 'EXW (Ex Works)', code: 'EXW', description: 'Buyer bears all costs and risks from the seller\'s premises onward.', responsibility: 'Buyer arranges all transport' },
  { id: 'ddp', name: 'DDP (Delivered Duty Paid)', code: 'DDP', description: 'Seller delivers goods cleared for import, with all duties and taxes paid.', responsibility: 'Seller bears all costs' },
  { id: 'dap', name: 'DAP (Delivered at Place)', code: 'DAP', description: 'Seller delivers goods to a named place, buyer handles import clearance.', responsibility: 'Seller delivers, buyer clears' },
];

export type { ShippingTerm };

export function ShippingTermsModal({ isOpen, onClose, onSelect, currentTermId }: ShippingTermsModalProps) {
  const [selectedTermId, setSelectedTermId] = useState<string | null>(currentTermId || null);
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const filteredTerms = SHIPPING_TERMS.filter((t) =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) || t.code.toLowerCase().includes(searchQuery.toLowerCase()) || t.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleConfirm = () => {
    const selected = SHIPPING_TERMS.find((t) => t.id === selectedTermId);
    if (selected) { onSelect(selected); onClose(); }
  };

  return createPortal(
    <>
      <div className="fixed inset-0" style={{ zIndex: 10001, backgroundColor: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(1px)' }} onClick={onClose} />
      <div
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-xl shadow-2xl flex flex-col"
        style={{ zIndex: 10001, width: 600, height: 620, background: 'var(--card)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — Quotes canonical: 32px icon chip (Truck), 14px title, 11px muted subtitle, 28px close. */}
        <div className="flex items-center justify-between" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-accent flex items-center justify-center" style={{ width: 32, height: 32 }}>
              <Truck className="text-primary" style={{ width: 16, height: 16 }} />
            </div>
            <div>
              <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)', lineHeight: 1, marginBottom: 5 }}>Select Shipping Terms</h2>
              <p style={{ fontSize: 11, color: 'var(--muted-foreground)', lineHeight: 1.4, margin: 0 }}>Choose incoterms / shipping terms for this order</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-md flex items-center justify-center transition-colors"
            style={{ width: 28, height: 28, border: 'none', backgroundColor: 'transparent', cursor: 'pointer' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--muted)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <X style={{ width: 16, height: 16, color: 'var(--muted-foreground)' }} />
          </button>
        </div>

        <div className="p-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input type="text" placeholder="Search shipping terms..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-[13px] rounded focus:outline-none focus:border-primary/50"
              style={{ border: '1px solid var(--border)', color: 'var(--foreground)', background: 'var(--card)' }} autoFocus
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-3">
            {filteredTerms.map((term) => {
              const isSelected = selectedTermId === term.id;
              const isCurrent = currentTermId === term.id;
              return (
                <div
                  key={term.id}
                  className={`flex items-start gap-4 p-4 rounded-lg border-2 transition-all cursor-pointer ${isSelected ? 'border-primary' : 'border-border hover:border-primary/30'}`}
                  style={{ backgroundColor: isSelected ? 'hsl(var(--primary) / 0.05)' : 'var(--card)' }}
                  onClick={() => setSelectedTermId(term.id)}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-primary' : 'bg-secondary'}`}>
                    <Truck className={`w-5 h-5 ${isSelected ? 'text-primary-foreground' : 'text-muted-foreground'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>{term.name}</span>
                      {isCurrent && <span className="inline-flex items-center h-5 px-2 text-[11px] bg-secondary text-muted-foreground rounded" style={{ fontWeight: 500 }}>Current</span>}
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--muted-foreground)', marginBottom: 6 }}>{term.description}</p>
                    <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                      <span style={{ fontWeight: 500 }}>Responsibility:</span><span>{term.responsibility}</span>
                    </div>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${isSelected ? 'bg-primary border-primary' : 'border-border bg-card'}`}>
                    {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                  </div>
                </div>
              );
            })}
          </div>
          {filteredTerms.length === 0 && <div className="text-center py-12" style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>No shipping terms found</div>}
        </div>

        <div className="px-6 py-4 flex items-center justify-end gap-3" style={{ borderTop: '1px solid var(--border)' }}>
          <button onClick={onClose} className="px-4 py-2 text-[13px] text-muted-foreground hover:text-foreground transition-colors" style={{ fontWeight: 500 }}>Cancel</button>
          <button onClick={handleConfirm} disabled={!selectedTermId}
            className={`px-4 py-2 text-[13px] rounded transition-colors ${selectedTermId ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'bg-secondary text-muted-foreground cursor-not-allowed'}`}
            style={{ fontWeight: 500 }}
          >Confirm Selection</button>
        </div>
      </div>
    </>,
    document.body
  );
}
