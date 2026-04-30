import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Search, CreditCard, Building, Landmark, FileText, Check, Info } from 'lucide-react';

interface PaymentMethod {
  id: string;
  name: string;
  icon: 'CreditCard' | 'Building' | 'Landmark' | 'FileText';
  description: string;
  processingTime: string;
  fees?: string;
  isDefault?: boolean;
}

interface PaymentMethodSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (method: PaymentMethod, saveAsDefault: boolean) => void;
  currentMethodId?: string;
  customerName: string;
}

const PAYMENT_METHODS: PaymentMethod[] = [
  { id: 'ach', name: 'ACH/Direct Deposit', icon: 'Building', description: 'Electronic bank transfer for domestic payments', processingTime: '1-3 business days', fees: 'No fee', isDefault: true },
  { id: 'wire', name: 'Wire Transfer', icon: 'Landmark', description: 'Fast electronic transfer for large amounts or international payments', processingTime: 'Same day', fees: '$25-50 fee' },
  { id: 'check', name: 'Check', icon: 'FileText', description: 'Traditional paper check payment', processingTime: '5-7 business days', fees: 'No fee' },
  { id: 'credit', name: 'Credit Card', icon: 'CreditCard', description: 'Pay with Visa, Mastercard, American Express, or Discover', processingTime: 'Immediate', fees: '2.9% + $0.30 processing fee' },
  { id: 'net_banking', name: 'Net Banking', icon: 'Building', description: 'Direct payment through online banking portal', processingTime: 'Immediate', fees: 'No fee' },
  { id: 'letter_of_credit', name: 'Letter of Credit', icon: 'FileText', description: 'Bank guarantee for international trade transactions', processingTime: '7-14 business days', fees: 'Varies by bank' },
];

const ICON_MAP = { CreditCard, Building, Landmark, FileText };

export type { PaymentMethod };

export function PaymentMethodSelectionModal({ isOpen, onClose, onSelect, currentMethodId = 'ach', customerName }: PaymentMethodSelectionModalProps) {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>(PAYMENT_METHODS.find((m) => m.id === currentMethodId) || PAYMENT_METHODS[0]);
  const [saveAsDefault, setSaveAsDefault] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const filteredMethods = PAYMENT_METHODS.filter((m) =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) || m.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleConfirm = () => { onSelect(selectedMethod, saveAsDefault); onClose(); };

  return createPortal(
    <>
      <div className="fixed inset-0" style={{ zIndex: 10001, backgroundColor: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(1px)' }} onClick={onClose} />
      <div
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-xl shadow-2xl flex flex-col"
        style={{ zIndex: 10001, width: 600, height: 700, background: 'var(--card)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--foreground)' }}>Select Payment Method</h2>
            <p style={{ fontSize: 13, color: 'var(--muted-foreground)', marginTop: 4 }}>Choose how the customer should pay for this order</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded hover:bg-secondary transition-colors">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input type="text" placeholder="Search payment methods..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-[13px] rounded focus:outline-none focus:border-primary/50"
              style={{ border: '1px solid var(--border)', color: 'var(--foreground)', background: 'var(--card)' }}
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-3">
            {filteredMethods.map((method) => {
              const Icon = ICON_MAP[method.icon];
              const isSelected = selectedMethod.id === method.id;
              return (
                <div
                  key={method.id}
                  className={`flex items-start gap-4 p-4 rounded-lg border-2 transition-all cursor-pointer ${isSelected ? 'border-primary' : 'border-border hover:border-primary/30'}`}
                  style={{ backgroundColor: isSelected ? 'hsl(var(--primary) / 0.05)' : 'var(--card)' }}
                  onClick={() => setSelectedMethod(method)}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-primary' : 'bg-secondary'}`}>
                    <Icon className={`w-5 h-5 ${isSelected ? 'text-primary-foreground' : 'text-muted-foreground'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>{method.name}</span>
                      {method.isDefault && <span className="inline-flex items-center h-5 px-2 text-[11px] bg-secondary text-muted-foreground rounded" style={{ fontWeight: 500 }}>Default</span>}
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--muted-foreground)', marginBottom: 8 }}>{method.description}</p>
                    <div className="flex items-center gap-4 text-[12px]">
                      <div className="flex items-center gap-1.5 text-muted-foreground"><span style={{ fontWeight: 500 }}>Processing:</span><span>{method.processingTime}</span></div>
                      {method.fees && <div className="flex items-center gap-1.5 text-muted-foreground"><span style={{ fontWeight: 500 }}>Fees:</span><span>{method.fees}</span></div>}
                    </div>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${isSelected ? 'bg-primary border-primary' : 'border-border bg-card'}`}>
                    {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 flex items-start gap-3 p-4 bg-primary/5 border border-primary/20 rounded-lg">
            <Info className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>Payment method can be changed after order creation</p>
              <p style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 4 }}>The selected payment method will be displayed on the order and can be updated before sending to the customer.</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-secondary/50" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="mb-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={saveAsDefault} onChange={(e) => setSaveAsDefault(e.target.checked)}
                className="w-4 h-4 mt-0.5 border-2 border-border rounded appearance-none checked:bg-primary checked:border-primary cursor-pointer transition-colors"
                style={{ backgroundImage: saveAsDefault ? 'url("data:image/svg+xml,%3Csvg width=\'12\' height=\'12\' viewBox=\'0 0 12 12\' fill=\'none\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M10 3L4.5 8.5L2 6\' stroke=\'white\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'/%3E%3C/svg%3E")' : 'none', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }}
              />
              <div className="flex-1">
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>Save as default payment method for {customerName}</span>
                <p style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 2 }}>This payment method will be automatically selected for future orders with this customer</p>
              </div>
            </label>
          </div>
          <div className="flex items-center justify-end gap-3">
            <button onClick={onClose} className="px-4 py-2 text-[13px] text-muted-foreground hover:text-foreground transition-colors" style={{ fontWeight: 500 }}>Cancel</button>
            <button onClick={handleConfirm} className="px-4 py-2 text-[13px] text-primary-foreground bg-primary hover:bg-primary/90 rounded transition-colors" style={{ fontWeight: 500 }}>Confirm Selection</button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
