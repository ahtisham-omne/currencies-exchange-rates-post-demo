import * as React from 'react';
import { useSyncExternalStore } from 'react';
import { BASE_CURRENCY, isBaseCurrency } from '@/app/currency/currencies';
import { formatMoney } from '@/app/currency/money';
import { toBase, type MoneyFx } from '@/app/currency/rates';

/* ── Which currency a return's page shows its amounts in ───────────────
 * Base Currency (PKR) by default, with the PO's amount and the rate on hover.
 * The header's Base Currency | Vendor Currency switch (restored 25 Nov 2026,
 * the detail-page currency switch) flips the page to the return's currency,
 * the PO's, with PKR on hover. It is a reading, never an edit: the return is
 * unchanged. The choice is kept per return for the session (below), so
 * leaving the page and coming back keeps it. GL Impact and the currency
 * block stay in PKR whichever is chosen.
 *
 * Outside a return's page (creating a return, the printed RMA, its
 * communication) there is no provider and amounts read in the PO's currency,
 * what the vendor sees. */

export type ReturnView = 'base' | 'document';

const ReturnViewContext = React.createContext<ReturnView>('document');

export const ReturnViewProvider = ReturnViewContext.Provider;

export const useReturnView = () => React.useContext(ReturnViewContext);

/* Each return's view for the session, apart from the record, keyed by the
 * return's id (as vendor-invoicing's docView.ts). */
const views = new Map<string, ReturnView>();
const listeners = new Set<() => void>();

export function setReturnView(key: string, view: ReturnView) {
  if ((views.get(key) ?? 'base') === view) return;
  views.set(key, view);
  listeners.forEach((l) => l());
}

/** A return's view: Base Currency until switched, then the session's choice. */
export function useStoredReturnView(key: string | null | undefined): [ReturnView, (view: ReturnView) => void] {
  const view = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    () => (key ? views.get(key) ?? 'base' : 'base'),
    () => 'base' as ReturnView,
  );
  const set = React.useCallback(
    (next: ReturnView) => {
      if (key) setReturnView(key, next);
    },
    [key],
  );
  return [view, set];
}

/** An amount in the PO's currency as text in the shown currency: PKR at the
 *  return's rate on Base Currency, the PO's currency on Vendor Currency and
 *  outside a return's page. */
export function viewMoney(view: ReturnView, amount: number, currency: string, fx: MoneyFx | null | undefined): string {
  if (view === 'base' && fx && !isBaseCurrency(currency)) return formatMoney(toBase(amount, fx.rate), BASE_CURRENCY);
  return formatMoney(amount, currency);
}
