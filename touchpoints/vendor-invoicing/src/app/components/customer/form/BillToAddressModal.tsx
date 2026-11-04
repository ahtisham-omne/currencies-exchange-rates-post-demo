import { useEffect, useMemo, useState } from 'react';
import { MapPin, Search, X, Check } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { highlightText } from '@/app/components/InvoiceDataTable';
import type { CustomerAddress } from '@/app/data/ar/mockCustomers';

// Bill-To address picker (user 11/4): the vendor payment flow's Pay-From
// modal (PayFromAccountModal) verbatim in chrome, search and radio rows,
// listing the customer's saved addresses instead of accounts.

interface BillToAddressModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerName: string;
  /** Currently-saved address id. */
  value: string;
  addresses: CustomerAddress[];
  defaultId?: string;
  onApply: (id: string) => void;
}

export const addressLine = (a: CustomerAddress) => [a.line1, a.city, a.region, a.postal, a.country].filter(Boolean).join(', ');

export function BillToAddressModal({ open, onOpenChange, customerName, value, addresses, defaultId, onApply }: BillToAddressModalProps) {
  const [draft, setDraft] = useState(value);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (open) {
      setDraft(value);
      setSearch('');
    }
  }, [open, value]);

  const filtered = useMemo(() => {
    if (!search.trim()) return addresses;
    const q = search.toLowerCase();
    return addresses.filter((a) => a.label.toLowerCase().includes(q) || addressLine(a).toLowerCase().includes(q));
  }, [search, addresses]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 z-[230] flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-[520px] max-h-[80vh] flex flex-col overflow-hidden border border-border animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#EEF2F6] flex items-center justify-between gap-3 bg-[#FAFBFC]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/[0.08] flex items-center justify-center shrink-0">
              <MapPin className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h3 className="text-[14px] text-foreground leading-tight" style={{ fontWeight: 600 }}>
                Bill-To Address
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5" style={{ fontWeight: 400 }}>
                Select where {customerName} is billed. Addresses come from the customer profile.
              </p>
            </div>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="shrink-0 w-8 h-8 rounded-md flex items-center justify-center text-slate-400 hover:text-foreground hover:bg-slate-100 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-[#EEF2F6]">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, street or city…"
              className="h-10 pl-9 bg-white border-slate-200 text-[12px] text-foreground placeholder:text-slate-400 shadow-none rounded-lg focus:border-primary focus-visible:ring-1 focus-visible:ring-primary/20"
              style={{ fontWeight: 500 }}
              autoFocus
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <Search className="w-5 h-5 mb-2" />
              <span className="text-[12px]" style={{ fontWeight: 500 }}>No addresses match your search.</span>
            </div>
          ) : (
            <div>
              <div className="px-5 py-2 sticky top-0 bg-white border-b border-slate-100 z-10">
                <span className="text-[11px] text-slate-500 tracking-wide" style={{ fontWeight: 600 }}>
                  Saved Addresses
                </span>
              </div>
              <div className="px-3 py-1.5">
                {filtered.map((a) => {
                  const isSelected = draft === a.id;
                  return (
                    <button
                      key={a.id}
                      onClick={() => setDraft(a.id)}
                      className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-md text-left transition-colors ${isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                    >
                      <div className="min-w-0 flex-1">
                        <span className={`text-[12px] truncate block ${isSelected ? 'text-primary' : 'text-foreground'}`} style={{ fontWeight: 600 }}>
                          {highlightText(a.label, search)}
                        </span>
                        <div className="mt-0.5 text-[10px] text-slate-400 truncate" style={{ fontWeight: 500 }}>
                          {highlightText(addressLine(a), search)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {a.id === defaultId && (
                          <span className="text-[9px] text-slate-400" style={{ fontWeight: 500 }}>
                            Default
                          </span>
                        )}
                        {isSelected && <Check className="w-3.5 h-3.5 text-primary" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#EEF2F6] bg-slate-50/40 flex items-center justify-between gap-2">
          <span className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>
            {filtered.length} address{filtered.length !== 1 ? 'es' : ''} available
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F8FAFC'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
              className="inline-flex items-center justify-center h-8 rounded-md px-4 text-[12px] border border-slate-200 cursor-pointer transition-colors"
              style={{ fontWeight: 500, color: '#0F172A', backgroundColor: '#FFFFFF' }}
            >
              Cancel
            </button>
            <Button
              size="sm"
              onClick={() => { onApply(draft); onOpenChange(false); }}
              disabled={draft === value}
              className="h-8 px-4 text-[12px] bg-primary hover:bg-primary/90 text-primary-foreground rounded-md shadow-sm disabled:opacity-50"
              style={{ fontWeight: 600 }}
            >
              Done
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
