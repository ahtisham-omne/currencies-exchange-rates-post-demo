import * as React from 'react';
import { BASE_CURRENCY, isBaseCurrency } from '@/app/currency/currencies';
import { formatMoney } from '@/app/currency/money';
import { toBase, type MoneyFx } from '@/app/currency/rates';

/* ── Which currency a return's page shows its amounts in ───────────────
 * Mahreen, 2026-11-20: a return's page opens on Base Currency (PKR); the
 * header's Vendor Currency switch shows the PO's currency (GBP). Set up the
 * same way as Purchase Orders. The view is a reading, never an edit, kept per
 * return for the session.
 *
 * Outside a return's page (creating a return, the printed RMA, its
 * communication) there is no provider and amounts read in the PO's currency,
 * what the vendor sees. */

export type ReturnView = 'base' | 'document';

const ReturnViewContext = React.createContext<ReturnView>('document');

export const ReturnViewProvider = ReturnViewContext.Provider;

export const useReturnView = () => React.useContext(ReturnViewContext);

const stored = new Map<string, ReturnView>();

/** A return's view, Base Currency until switched; kept for the session. */
export function useStoredReturnView(key: string | null | undefined): [ReturnView, (view: ReturnView) => void] {
  const [view, setView] = React.useState<ReturnView>(() => (key && stored.get(key)) || 'base');
  React.useEffect(() => {
    setView((key && stored.get(key)) || 'base');
  }, [key]);
  const set = React.useCallback(
    (next: ReturnView) => {
      if (key) stored.set(key, next);
      setView(next);
    },
    [key],
  );
  return [view, set];
}

/** An amount in the PO's currency as text in the shown currency: PKR at the
 *  return's rate in Base Currency, the PO's currency otherwise. */
export function viewMoney(view: ReturnView, amount: number, currency: string, fx: MoneyFx | null | undefined): string {
  if (view === 'base' && fx && !isBaseCurrency(currency)) return formatMoney(toBase(amount, fx.rate), BASE_CURRENCY);
  return formatMoney(amount, currency);
}
