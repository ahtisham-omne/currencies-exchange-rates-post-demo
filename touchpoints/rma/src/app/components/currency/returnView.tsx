import * as React from 'react';
import { BASE_CURRENCY, isBaseCurrency } from '@/app/currency/currencies';
import { formatMoney } from '@/app/currency/money';
import { toBase, type MoneyFx } from '@/app/currency/rates';

/* ── Which currency a return's page shows its amounts in ───────────────
 * PKR, the base currency, with the PO's amount and the rate on hover
 * (Currency Touchpoints Map, 2026-11-24). The page header has no Base |
 * Vendor Currency toggle any more: it carries the return's currency tag and
 * the Currency button, as every document does. Mahreen's toggle of
 * 2026-11-20 is gone; the return page pins this view to 'base'.
 *
 * Outside a return's page (creating a return, the printed RMA, its
 * communication) there is no provider and amounts read in the PO's currency,
 * what the vendor sees. */

export type ReturnView = 'base' | 'document';

const ReturnViewContext = React.createContext<ReturnView>('document');

export const ReturnViewProvider = ReturnViewContext.Provider;

export const useReturnView = () => React.useContext(ReturnViewContext);

/** An amount in the PO's currency as text in the shown currency: PKR at the
 *  return's rate on the return's page, the PO's currency elsewhere. */
export function viewMoney(view: ReturnView, amount: number, currency: string, fx: MoneyFx | null | undefined): string {
  if (view === 'base' && fx && !isBaseCurrency(currency)) return formatMoney(toBase(amount, fx.rate), BASE_CURRENCY);
  return formatMoney(amount, currency);
}
