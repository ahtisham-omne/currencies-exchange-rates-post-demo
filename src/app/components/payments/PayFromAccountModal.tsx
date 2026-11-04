import { Fragment, useEffect, useMemo, useState } from 'react';
import { Landmark, Search, X, Check } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import type { PayFromAccount } from '@/app/data/mockPayments';
import { highlightText } from '@/app/components/InvoiceDataTable';

// Pay-from account picker — mirrors the standalone GL Configuration modal
// (GLAccountConfigModal) so the payment flow's account selection uses the same
// searchable, grouped, radio-row visual rather than a plain dropdown. Tailored
// to PayFromAccount (shows the book balance and groups by account type).

interface PayFromAccountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Currently-saved account id. */
  value: string;
  /** Accounts eligible for the chosen method. */
  accounts: PayFromAccount[];
  onApply: (id: string) => void;
}

const GROUP_LABEL: Record<PayFromAccount['type'], string> = {
  bank: 'Bank Accounts',
  card: 'Card',
  cash: 'Cash',
};
const GROUP_ORDER: PayFromAccount['type'][] = ['bank', 'card', 'cash'];

const fmt = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function PayFromAccountModal({ open, onOpenChange, value, accounts, onApply }: PayFromAccountModalProps) {
  const [draft, setDraft] = useState(value);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (open) {
      setDraft(value);
      setSearch('');
    }
  }, [open, value]);

  const filtered = useMemo(() => {
    if (!search.trim()) return accounts;
    const q = search.toLowerCase();
    return accounts.filter(
      (a) =>
        a.label.toLowerCase().includes(q) ||
        a.creditGl.toLowerCase().includes(q) ||
        (a.bankName?.toLowerCase().includes(q) ?? false) ||
        (a.accountMask?.includes(q) ?? false),
    );
  }, [search, accounts]);

  const grouped = useMemo(() => {
    const g: Record<string, PayFromAccount[]> = {};
    filtered.forEach((a) => {
      (g[a.type] ??= []).push(a);
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
        className="bg-white rounded-2xl shadow-2xl w-full max-w-[520px] max-h-[80vh] flex flex-col overflow-hidden border border-border animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#EEF2F6] flex items-center justify-between gap-3 bg-[#FAFBFC]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/[0.08] flex items-center justify-center shrink-0">
              <Landmark className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h3 className="text-[14px] text-foreground leading-tight" style={{ fontWeight: 600 }}>
                Pay-From Account
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5" style={{ fontWeight: 400 }}>
                Select the account this payment draws from. All balances are book balances from your ledger.
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
              placeholder="Search by account code or name…"
              className="h-10 pl-9 bg-white border-slate-200 text-[12px] text-foreground placeholder:text-slate-400 shadow-none rounded-lg focus:border-primary focus-visible:ring-1 focus-visible:ring-primary/20"
              style={{ fontWeight: 500 }}
              autoFocus
            />
          </div>
        </div>

        {/* Grouped list */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <Search className="w-5 h-5 mb-2" />
              <span className="text-[12px]" style={{ fontWeight: 500 }}>No accounts match your search.</span>
            </div>
          ) : (
            GROUP_ORDER.filter((t) => grouped[t]?.length).map((type) => (
              <div key={type}>
                <div className="px-5 py-2 sticky top-0 bg-white border-b border-slate-100 z-10">
                  <span className="text-[11px] text-slate-500 tracking-wide" style={{ fontWeight: 600 }}>
                    {GROUP_LABEL[type]}
                  </span>
                </div>
                <div className="px-3 py-1.5">
                  {grouped[type].map((acct) => {
                    const isSelected = draft === acct.id;
                    const sub = [
                      acct.bankName,
                      acct.accountMask ? `••••${acct.accountMask}` : null,
                      acct.accountTypeLabel,
                    ].filter(Boolean);
                    return (
                      <button
                        key={acct.id}
                        onClick={() => setDraft(acct.id)}
                        className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-md text-left transition-colors ${isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            {/* No GL chip — the account name IS the GL account
                                (feedback 7/15/26). */}
                            <span
                              className={`text-[12px] truncate ${isSelected ? 'text-primary' : 'text-foreground'}`}
                              style={{ fontWeight: 600 }}
                            >
                              {/* Searchable, so it highlights like every other matched cell (10/9/26). */}
                              {highlightText(acct.label, search)}
                            </span>
                          </div>
                          {sub.length > 0 && (
                            <div className="mt-0.5 text-[10px] text-slate-400 truncate" style={{ fontWeight: 500 }}>
                              {sub.map((part, i) => (
                                <Fragment key={i}>
                                  {i > 0 && ' · '}
                                  {highlightText(part as string, search)}
                                </Fragment>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {/* Every amount is the ledger's book balance
                              (7/15/26) — for a card that's the amount OWED,
                              read back with a small utilization bar and the
                              remaining credit instead of a chip stack. */}
                          {acct.type === 'card' && acct.creditLimit ? (
                            <div className="flex flex-col items-end leading-none">
                              <span className={`text-[12px] ${isSelected ? 'text-primary' : 'text-amber-700'}`} style={{ fontWeight: 600 }}>
                                {fmt(acct.creditLimit - acct.balance)}
                              </span>
                              <span className="text-[9px] text-slate-400 mt-0.5" style={{ fontWeight: 500 }}>
                                Owed · Book Balance
                              </span>
                              <span className="mt-1.5 w-[88px] h-[3px] rounded-full bg-slate-100 overflow-hidden">
                                <span
                                  className="block h-full rounded-full bg-amber-400"
                                  style={{ width: `${Math.min(100, Math.round(((acct.creditLimit - acct.balance) / acct.creditLimit) * 100))}%` }}
                                />
                              </span>
                              <span className="text-[9px] text-slate-400 mt-1 " style={{ fontWeight: 500 }}>
                                {fmt(acct.balance)} available of {fmt(acct.creditLimit)}
                              </span>
                            </div>
                          ) : (
                            <div className="flex flex-col items-end leading-none">
                              <span className={`text-[12px] ${isSelected ? 'text-primary' : 'text-slate-600'}`} style={{ fontWeight: 600 }}>
                                {fmt(acct.balance)}
                              </span>
                              <span className="text-[9px] text-slate-400 mt-0.5" style={{ fontWeight: 500 }}>
                                Book Balance
                              </span>
                            </div>
                          )}
                          {isSelected && <Check className="w-3.5 h-3.5 text-primary" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#EEF2F6] bg-slate-50/40 flex items-center justify-between gap-2">
          <span className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>
            {filtered.length} account{filtered.length !== 1 ? 's' : ''} available
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
