import * as React from 'react';
import { Banknote, Check, ChevronDown, Landmark, Lock, Wallet } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/app/components/ui/popover';
import type { PayFromAccount } from '@/app/data/mockPayments';
import { formatMoney } from '@/app/currency/money';
import { isBaseCurrency } from '@/app/currency/currencies';
import { CurrencyFlag } from './CurrencyChip';

/* ── Pay-from account picker (Currency Touchpoints Map, 24 Nov 2026) ────
 * "1010 · JPMorgan Operating · PKR ▾": the account a document is paid
 * from, beside its "You pay" amount in a Currency Configuration. The caller
 * passes the accounts to list (an invoice: every one; a payment: the base
 * currency or the invoices' own). Each row is flag, label and code, with
 * the balance in the account's currency. Read-only shows it locked. */

const iconFor = (a: Pick<PayFromAccount, 'type'>) => (a.type === 'cash' ? Banknote : a.type === 'card' ? Wallet : Landmark);

export function PayFromAccountPicker({
  value,
  accounts,
  onChange,
  readOnly = false,
  documentCurrency,
  ariaLabel = 'Pay from account',
}: {
  value: string;
  /** The eligible accounts, in order. */
  accounts: PayFromAccount[];
  onChange?: (id: string) => void;
  readOnly?: boolean;
  /** The document's currency, to say which accounts convert. */
  documentCurrency: string;
  ariaLabel?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const current = accounts.find((a) => a.id === value);
  const face = (
    <span className="flex items-center gap-2 min-w-0">
      {current ? (
        <>
          <CurrencyFlag code={current.currency} size={16} />
          <span className="truncate text-[12.5px]" style={{ fontWeight: 500 }}>{current.label}</span>
          <span className="text-[11px] text-slate-500 shrink-0" style={{ fontWeight: 600 }}>· {current.currency}</span>
        </>
      ) : (
        <span className="text-slate-400 text-[12.5px]">Select account</span>
      )}
    </span>
  );
  if (readOnly) {
    return (
      <div
        className="h-10 w-full rounded-lg text-sm px-3 flex items-center justify-between gap-2 border border-slate-200 bg-slate-50 cursor-not-allowed"
        aria-label={ariaLabel}
        aria-readonly="true"
      >
        {face}
        <Lock className="w-3.5 h-3.5 text-slate-300 shrink-0" />
      </div>
    );
  }
  return (
    /* modal: the list sits in a portal outside the dialog, whose scroll lock
       would otherwise swallow the mouse wheel over it. */
    <Popover modal open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={ariaLabel}
          className="h-10 w-full rounded-lg text-sm px-3 flex items-center justify-between gap-2 bg-white border border-border hover:border-primary/45 focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none cursor-pointer transition-colors"
        >
          {face}
          <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[340px] p-1 rounded-lg z-[300]">
        <div className="max-h-[280px] overflow-y-auto" role="listbox" aria-label={ariaLabel}>
          {accounts.map((a) => {
            const Icon = iconFor(a);
            const selected = a.id === value;
            const same = a.currency.toUpperCase() === documentCurrency.toUpperCase();
            return (
              <button
                key={a.id}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onChange?.(a.id);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-left cursor-pointer transition-colors ${selected ? 'bg-primary/[0.06]' : 'hover:bg-slate-50'}`}
              >
                <span className="w-6 h-6 rounded-md bg-slate-50 text-slate-500 flex items-center justify-center shrink-0">
                  <Icon className="w-3.5 h-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 min-w-0">
                    <CurrencyFlag code={a.currency} size={13} />
                    <span className={`text-[12px] truncate ${selected ? 'text-primary' : 'text-foreground'}`} style={{ fontWeight: 600 }}>{a.label}</span>
                    <span className="text-[10.5px] text-slate-500 shrink-0" style={{ fontWeight: 600 }}>{a.currency}</span>
                  </span>
                  <span className="block text-[10.5px] text-slate-400 truncate">
                    {!same ? 'The bank converts' : isBaseCurrency(documentCurrency) ? 'No conversion' : 'Nothing converts'} · {formatMoney(a.balance, a.currency)}
                  </span>
                </span>
                {selected && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
