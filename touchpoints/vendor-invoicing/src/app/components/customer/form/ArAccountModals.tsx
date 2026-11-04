import { useState } from 'react';
import { AlertTriangle, Check, LayoutGrid, Search, Wallet, X } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { highlightText } from '@/app/components/InvoiceDataTable';

// Forks of two vendor CreateInvoiceScreen modals:
//  - ArAccountModal = the "A/P Configuration Modal" (header account
//    picker with the overriding-the-default amber strip), for A/R.
//  - RevenueAccountModal = the standalone "GL Configuration Modal"
//    (per-line account), listing revenue accounts instead of expense.

function groupAr(accounts: readonly string[]): Record<string, string[]> {
  const g: Record<string, string[]> = {};
  for (const a of accounts) {
    const code = parseInt(a.split(' ')[0], 10);
    let cat = 'Other';
    if (code >= 1100 && code < 1200) cat = 'Accounts Receivable';
    else if (code >= 4000 && code < 4100) cat = 'Product Revenue';
    else if (code >= 4100 && code < 4200) cat = 'Service Revenue';
    else if (code >= 4200 && code < 5000) cat = 'Other Revenue';
    else if (code >= 2000 && code < 3000) cat = 'Liabilities';
    (g[cat] ??= []).push(a);
  }
  return g;
}

export function ArAccountModal({
  open,
  title = 'A/R Account',
  subtitle = 'Pick the accounts-receivable account to debit on this invoice.',
  accounts,
  value,
  defaultValue,
  onPick,
  onClose,
}: {
  open: boolean;
  title?: string;
  subtitle?: string;
  accounts: readonly string[];
  value: string;
  defaultValue: string;
  onPick: (account: string) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  if (!open) return null;
  const filtered = accounts.filter((a) => a.toLowerCase().includes(search.toLowerCase()));
  const grouped = groupAr(filtered);
  return (
    <div className="fixed inset-0 bg-black/40 z-[210] flex items-center justify-center p-4 animate-in fade-in duration-150" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[520px] max-h-[80vh] flex flex-col overflow-hidden border border-border animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-[#EEF2F6] flex items-center justify-between gap-3 bg-[#FAFBFC]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/[0.08] flex items-center justify-center shrink-0">
              <Wallet className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h3 className="text-[14px] text-foreground leading-tight" style={{ fontWeight: 600 }}>{title}</h3>
              <p className="text-[11px] text-slate-500 mt-0.5" style={{ fontWeight: 400 }}>{subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 w-8 h-8 rounded-md flex items-center justify-center text-slate-400 hover:text-foreground hover:bg-slate-100 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {defaultValue && value !== defaultValue && (
          <div className="px-5 py-2.5 border-b border-amber-200 bg-amber-50/70 flex items-center gap-2.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
            <span className="text-[11px] text-amber-900 flex-1" style={{ fontWeight: 500 }}>
              Currently overriding the customer default.{' '}
              <button
                type="button"
                onClick={() => onPick(defaultValue)}
                className="text-[11px] text-amber-900 underline decoration-amber-700/70 underline-offset-2 hover:decoration-amber-900 transition-colors"
                style={{ fontWeight: 600 }}
              >
                reset to {defaultValue}
              </button>
            </span>
          </div>
        )}

        <div className="px-5 py-3 border-b border-[#EEF2F6]">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by code or name…"
              className="h-10 pl-9 bg-white border-slate-200 text-[12px] text-foreground placeholder:text-slate-400 shadow-none rounded-lg focus:border-primary focus-visible:ring-1 focus-visible:ring-primary/20"
              style={{ fontWeight: 500 }}
              autoFocus
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <Search className="w-5 h-5 mb-2" />
              <span className="text-[12px]" style={{ fontWeight: 500 }}>No accounts match your search.</span>
            </div>
          ) : (
            Object.entries(grouped).map(([category, list]) => (
              <div key={category}>
                <div className="px-5 py-2 sticky top-0 bg-white border-b border-slate-100 z-10">
                  <span className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>{category}</span>
                </div>
                <div className="px-3 py-1.5">
                  {list.map((account) => {
                    const isSelected = value === account;
                    const isDefault = account === defaultValue;
                    const code = account.split(' ')[0];
                    const name = account.substring(code.length + 1);
                    return (
                      <button
                        key={account}
                        type="button"
                        onClick={() => {
                          onPick(account);
                          onClose();
                        }}
                        className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-md text-left transition-colors ${isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                      >
                        <span className={`text-[12px] shrink-0 ${isSelected ? 'text-primary' : 'text-slate-500'}`} style={{ fontWeight: 600 }}>
                          {highlightText(code, search)}
                        </span>
                        <span className={`text-[12px] truncate flex-1 ${isSelected ? 'text-primary' : 'text-foreground'}`} style={{ fontWeight: 500 }}>
                          {highlightText(name, search)}
                        </span>
                        {isDefault && !isSelected && (
                          <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded shrink-0" style={{ fontWeight: 600 }}>
                            Default
                          </span>
                        )}
                        {isSelected && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="px-5 py-3 border-t border-[#EEF2F6] bg-slate-50/40 flex items-center justify-between">
          <span className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>
            {filtered.length} account{filtered.length !== 1 ? 's' : ''}
          </span>
          <Button size="sm" onClick={onClose} className="h-8 px-4 text-[12px] bg-primary hover:bg-primary/90 text-primary-foreground rounded-md shadow-sm" style={{ fontWeight: 600 }}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}

export function RevenueAccountModal({
  open,
  accounts,
  value,
  onPick,
  onClose,
}: {
  open: boolean;
  accounts: readonly string[];
  value: string;
  onPick: (account: string) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  if (!open) return null;
  const filtered = accounts.filter((a) => a.toLowerCase().includes(search.toLowerCase()));
  const grouped = groupAr(filtered);
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[210] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[520px] max-h-[80vh] flex flex-col overflow-hidden border border-border" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 pt-5 pb-3 border-b border-border/60">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center">
                <LayoutGrid className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <h3 className="text-[13px] font-bold text-foreground">Revenue Account</h3>
                <p className="text-[10px] text-muted-foreground/70 font-medium">Select a revenue account to credit for this line item</p>
              </div>
            </div>
            <button type="button" onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-muted-foreground/70 hover:text-muted-foreground" aria-label="Close">
              <X className="w-4 h-4" />
            </button>
          </div>
          {value && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50/60 border border-blue-100 mb-3">
              <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span className="text-[11px] font-bold text-blue-700">Current: {value}</span>
            </div>
          )}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/70" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by account code or name..."
              className="h-[34px] pl-9 bg-muted/40 border-border text-[11px] font-medium shadow-none rounded-lg focus-visible:ring-1 focus-visible:ring-blue-200 placeholder:text-slate-400"
              autoFocus
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-2 custom-scrollbar">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground/70">
              <Search className="w-5 h-5 mb-2 text-gray-300" />
              <span className="text-[11px] font-medium">No accounts match your search</span>
            </div>
          ) : (
            Object.entries(grouped).map(([category, list]) => (
              <div key={category} className="mb-2">
                <div className="sticky top-0 z-10 bg-white px-2 py-1.5">
                  <span className="text-[9px] font-semibold text-muted-foreground/70 tracking-widest">{category}</span>
                </div>
                <div className="space-y-0.5">
                  {list.map((account) => {
                    const isSelected = value === account;
                    const code = account.split(' ')[0];
                    const name = account.substring(code.length + 1);
                    return (
                      <button
                        key={account}
                        type="button"
                        onClick={() => {
                          onPick(account);
                          onClose();
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left group/item ${
                          isSelected ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50 border border-transparent'
                        }`}
                      >
                        <div
                          className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                            isSelected ? 'bg-blue-600 border-blue-600' : 'border-border group-hover/item:border-input'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 text-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`text-[11px] font-semibold tracking-tight ${isSelected ? 'text-blue-700' : 'text-muted-foreground'}`}>{highlightText(code, search)}</span>
                            <span className={`text-[11px] font-medium truncate ${isSelected ? 'text-blue-600' : 'text-muted-foreground'}`}>{highlightText(name, search)}</span>
                          </div>
                        </div>
                        <span className="text-[9px] font-bold text-gray-300 shrink-0">CR</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="px-5 py-3 border-t border-border/60 bg-gray-50/50 flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground/70 font-medium">
            {filtered.length} account{filtered.length !== 1 ? 's' : ''} available
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (value) onPick('');
                onClose();
              }}
              className="h-8 px-3 text-[10px] font-bold border-border text-muted-foreground shadow-none"
            >
              {value ? 'Clear & Close' : 'Cancel'}
            </Button>
            <Button size="sm" onClick={onClose} className="h-8 px-4 text-[10px] font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-none">
              Done
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
