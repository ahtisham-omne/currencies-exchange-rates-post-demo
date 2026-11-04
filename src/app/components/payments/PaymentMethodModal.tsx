import { useEffect, useMemo, useState } from 'react';
import { Wallet, Search, X, Check } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { paymentMethodInfo, methodCategoryColors } from '@/app/data/paymentMethodCatalog';
import { methodDataRows, type VendorPaymentMethod } from '@/app/data/vendorPaymentMethods';
import { PrimaryPill } from './PrimaryPill';
import { highlightText } from '@/app/components/InvoiceDataTable';

/** Data-row labels whose values the search filter matches on. */
const SEARCHED_ROW_LABELS = new Set(['Bank', 'Account Number', 'Card Number']);

// Payment-method picker — same searchable, grouped, footer layout as
// PayFromAccountModal, but each row is a partner-style saved-method card
// (icon + nickname + type pill + Primary badge + masked detail rows) so the
// user can tell exactly which account they're paying from. Handles multiple
// methods of the same type (e.g. two ACH accounts) since each is its own card.

interface PaymentMethodModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Currently-selected method id. */
  value: string;
  /** The vendor's saved methods. */
  methods: VendorPaymentMethod[];
  vendorName?: string;
  onApply: (id: string) => void;
  /** Payment runs hide the Primary badge (8/7/26): the run picks a
   *  method for THIS run, the partner default carries no weight here. */
  hidePrimary?: boolean;
}

const GROUP_ORDER = ['Bank', 'Card', 'Traditional'] as const;
const GROUP_LABEL: Record<string, string> = {
  Bank: 'Bank Accounts',
  Card: 'Cards',
  Traditional: 'Other Methods',
};

export function PaymentMethodModal({ open, onOpenChange, value, methods, vendorName, onApply, hidePrimary }: PaymentMethodModalProps) {
  const [draft, setDraft] = useState(value);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (open) {
      setDraft(value);
      setSearch('');
    }
  }, [open, value]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return methods;
    return methods.filter((m) => {
      const info = paymentMethodInfo(m.type);
      return (
        m.nickname.toLowerCase().includes(q) ||
        info.label.toLowerCase().includes(q) ||
        (m.bankName?.toLowerCase().includes(q) ?? false) ||
        (m.cardNetwork?.toLowerCase().includes(q) ?? false) ||
        (m.accountMask?.includes(q) ?? false) ||
        (m.cardMask?.includes(q) ?? false)
      );
    });
  }, [search, methods]);

  const grouped = useMemo(() => {
    const g: Record<string, VendorPaymentMethod[]> = {};
    filtered.forEach((m) => {
      const cat = paymentMethodInfo(m.type).category;
      (g[cat] ??= []).push(m);
    });
    return g;
  }, [filtered]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 z-[230] flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-[520px] max-h-[82vh] flex flex-col overflow-hidden border border-border animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/[0.08] flex items-center justify-center shrink-0">
              <Wallet className="w-4 h-4 text-primary" />
            </div>
            <div>
              {/* Vendor-method framing (user 9/9): these are HOW the vendor
                  gets paid, saved on their partner profile — the old copy
                  ("which account this payment is sent from") described the
                  pay-from account and misled the whole picker. */}
              <h3 className="text-[14px] text-foreground leading-tight" style={{ fontWeight: 600 }}>
                {vendorName ? 'Vendor Payment Method' : 'Payment Method'}
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5" style={{ fontWeight: 400 }}>
                {vendorName
                  ? `How ${vendorName} receives this payment. These methods come from the vendor's profile in Partner Management; picking one sets the matching pay-from account.`
                  : 'Choose how this payment goes out. Picking a method sets the matching pay-from account.'}
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
        <div className="px-5 py-3 border-b border-slate-100">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by bank, type, or last 4…"
              className="h-10 pl-9 bg-white border-slate-200 text-[12px] text-foreground placeholder:text-slate-400 shadow-none rounded-lg focus:border-primary focus-visible:ring-1 focus-visible:ring-primary/20"
              style={{ fontWeight: 500 }}
              autoFocus
            />
          </div>
        </div>

        {/* Grouped method cards */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <Search className="w-5 h-5 mb-2" />
              <span className="text-[12px]" style={{ fontWeight: 500 }}>No methods match your search.</span>
            </div>
          ) : (
            GROUP_ORDER.filter((t) => grouped[t]?.length).map((cat) => (
              <div key={cat}>
                <div className="px-5 py-2 sticky top-0 bg-white border-b border-slate-100 z-10">
                  <span className="text-[11px] text-slate-500 tracking-wide" style={{ fontWeight: 600 }}>
                    {GROUP_LABEL[cat] ?? cat}
                  </span>
                </div>
                <div className="px-3 py-2 space-y-2">
                  {grouped[cat].map((m) => {
                    const info = paymentMethodInfo(m.type);
                    const Icon = info.icon;
                    const isSelected = draft === m.id;
                    const rows = methodDataRows(m);
                    const mColors = methodCategoryColors(info.category);
                    return (
                      <button
                        key={m.id}
                        onClick={() => setDraft(m.id)}
                        className={`w-full text-left rounded-xl border p-3 transition-all ${
                          isSelected
                            ? 'border-primary/40 bg-primary/[0.03] shadow-[0_2px_12px_-4px_rgba(10,119,255,0.18)]'
                            : 'border-[#E8ECF1] bg-white hover:border-blue-200 hover:shadow-[0_4px_16px_-4px_rgba(0,0,0,0.06)]'
                        }`}
                      >
                        {/* Header */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div
                              className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${isSelected ? 'bg-primary text-white' : ''}`}
                              style={isSelected ? undefined : { backgroundColor: mColors.bg, color: mColors.color }}
                            >
                              <Icon className="w-3.5 h-3.5" />
                            </div>
                            <div className="min-w-0">
                              <p className={`text-[13px] truncate leading-tight ${isSelected ? 'text-primary' : 'text-foreground'}`} style={{ fontWeight: 600 }}>
                                {/* Searchable, so it highlights like every other matched cell (10/9/26). */}
                                {highlightText(m.nickname, search)}
                              </p>
                              <span className="inline-flex items-center text-[9px] px-1.5 py-[1px] rounded-full mt-0.5" style={{ fontWeight: 600, backgroundColor: mColors.bg, color: mColors.color }}>
                                {highlightText(info.label, search)}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {m.isPrimary && !hidePrimary && <PrimaryPill />}
                            {isSelected && <Check className="w-4 h-4 text-primary" />}
                          </div>
                        </div>

                        {/* Masked data rows — label-over-value pairs in a 2-col grid so
                            the detail reads cleanly with room to breathe. */}
                        {rows.length > 0 && (
                          <div className="mt-2.5 grid grid-cols-2 gap-x-5 gap-y-2.5 py-2.5 px-3 rounded-lg bg-slate-50 border border-muted">
                            {rows.map((r) => (
                              <div key={r.label} className="min-w-0">
                                <p className="text-[9px] text-slate-400 leading-none" style={{ fontWeight: 600 }}>{r.label}</p>
                                <p className="text-[11.5px] text-slate-700 truncate mt-1" style={{ fontWeight: 600 }}>
                                  {/* Only the rows the search reads (bank, account / card mask). */}
                                  {SEARCHED_ROW_LABELS.has(r.label) ? highlightText(r.value, search) : r.value}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/40 flex items-center justify-between gap-2">
          <span className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>
            {filtered.length} method{filtered.length !== 1 ? 's' : ''} on file
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-slate-50)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-white)'; }}
              className="inline-flex items-center justify-center h-8 rounded-md px-4 text-[12px] border border-slate-200 cursor-pointer transition-colors"
              style={{ fontWeight: 500, color: 'var(--color-slate-900)', backgroundColor: 'var(--color-white)' }}
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
