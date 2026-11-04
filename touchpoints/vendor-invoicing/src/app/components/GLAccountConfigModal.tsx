import { useEffect, useMemo, useState } from 'react';
import { Layers, Search, X, Check, AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { GL_ACCOUNTS, groupGLAccounts } from '@/app/data/glAccounts';
import { highlightText } from '@/app/components/InvoiceDataTable';

interface GLAccountConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Currently-saved account on the field this modal edits. */
  value: string;
  /** Account this field was originally seeded with — used to surface a
   *  "reset to default" affordance and tag the row as "Default". */
  defaultValue?: string;
  /** Title displayed in the modal header (e.g. "Freight GL", "Charge GL"). */
  title?: string;
  /** Subtitle copy below the title. */
  subtitle?: string;
  /** Optional override of the catalogue — defaults to GL_ACCOUNTS. */
  accountList?: string[];
  /** Fired when the user clicks **Done**. */
  onApply: (next: string) => void;
}

/**
 * Reusable GL-account picker modal — mirrors the in-screen A/P
 * Configuration modal recipe (CreateInvoiceScreen.tsx ~4083). Used by the
 * Freight section and per-row Additional Charges so users can configure
 * any GL field through the same modal pattern. The Done button commits
 * the in-modal draft; Cancel (or close X) discards it.
 */
export function GLAccountConfigModal({
  open,
  onOpenChange,
  value,
  defaultValue,
  title = 'GL Account',
  subtitle = 'Pick the GL account this amount should post to.',
  accountList = GL_ACCOUNTS,
  onApply,
}: GLAccountConfigModalProps) {
  const [draft, setDraft] = useState(value);
  const [search, setSearch] = useState('');

  // Sync draft when the modal is (re)opened with a new committed value.
  useEffect(() => {
    if (open) {
      setDraft(value);
      setSearch('');
    }
  }, [open, value]);

  const filtered = useMemo(() => {
    if (!search.trim()) return accountList;
    const q = search.toLowerCase();
    return accountList.filter((a) => a.toLowerCase().includes(q));
  }, [search, accountList]);

  const grouped = useMemo(() => groupGLAccounts(filtered), [filtered]);

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
        {/* Header — Layers icon tile, title, subtitle, X close */}
        <div className="px-5 py-4 border-b border-[#EEF2F6] flex items-center justify-between gap-3 bg-[#FAFBFC]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/[0.08] flex items-center justify-center shrink-0">
              <Layers className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h3 className="text-[14px] text-foreground leading-tight" style={{ fontWeight: 600 }}>
                {title}
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5" style={{ fontWeight: 400 }}>
                {subtitle}
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

        {/* Default override banner — only when the draft diverges from
            the field's seed. Reset jumps draft back to defaultValue. */}
        {defaultValue && draft !== defaultValue && (
          <div className="px-5 py-2.5 border-b border-amber-200 bg-amber-50/70 flex items-center gap-2.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
            <span className="text-[11px] text-amber-900 flex-1" style={{ fontWeight: 500 }}>
              Currently overriding the default, {' '}
              <button
                type="button"
                onClick={() => setDraft(defaultValue)}
                className="text-[11px] text-amber-900 underline decoration-amber-700/70 underline-offset-2 hover:decoration-amber-900 transition-colors"
                style={{ fontWeight: 600 }}
              >
                <RotateCcw className="w-3 h-3 inline-block mr-0.5 -mt-0.5" />
                reset to {defaultValue}
              </button>
            </span>
          </div>
        )}

        {/* Search */}
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

        {/* Grouped list */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <Search className="w-5 h-5 mb-2" />
              <span className="text-[12px]" style={{ fontWeight: 500 }}>
                No accounts match your search.
              </span>
            </div>
          ) : (
            Object.entries(grouped).map(([category, accounts]) => (
              <div key={category}>
                <div className="px-5 py-2 sticky top-0 bg-white border-b border-slate-100 z-10">
                  <span className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>
                    {category}
                  </span>
                </div>
                <div className="px-3 py-1.5">
                  {accounts.map((account) => {
                    const isSelected = draft === account;
                    const isDefault = account === defaultValue;
                    const code = account.split(' ')[0];
                    const name = account.substring(code.length + 1);
                    return (
                      <button
                        key={account}
                        onClick={() => setDraft(account)}
                        className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-md text-left transition-colors ${
                          isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'
                        }`}
                      >
                        <span
                          className={`text-[12px] shrink-0 ${isSelected ? 'text-primary' : 'text-slate-500'}`}
                          style={{ fontWeight: 600 }}
                        >
                          {/* Searchable, so it highlights like every other matched cell (10/9/26). */}
                          {highlightText(code, search)}
                        </span>
                        <span
                          className={`text-[12px] truncate flex-1 ${isSelected ? 'text-primary' : 'text-foreground'}`}
                          style={{ fontWeight: 500 }}
                        >
                          {highlightText(name, search)}
                        </span>
                        {isDefault && !isSelected && (
                          <span
                            className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded shrink-0"
                            style={{ fontWeight: 600 }}
                          >
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

        {/* Footer — count on the left, Cancel + Done on the right.
            Cancel uses the forced-white recipe. */}
        <div className="px-5 py-3 border-t border-[#EEF2F6] bg-slate-50/40 flex items-center justify-between gap-2">
          <span className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>
            {filtered.length} account{filtered.length !== 1 ? 's' : ''}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#F8FAFC';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#FFFFFF';
              }}
              className="inline-flex items-center justify-center h-8 rounded-md px-4 text-[12px] border border-slate-200 cursor-pointer transition-colors"
              style={{ fontWeight: 500, color: '#0F172A', backgroundColor: '#FFFFFF' }}
            >
              Cancel
            </button>
            <Button
              size="sm"
              onClick={() => {
                onApply(draft);
                onOpenChange(false);
              }}
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
