import * as React from "react";
import { BASE_CURRENCY } from "@/app/currency/currencies";
import { quoteFx, type QuoteFx } from "@/app/currency/qFx";
import { formatWhole } from "@/app/currency/quoteMoney";
import { toBase } from "@/app/currency/rates";
import { getVersionRate, getVersionRateRevision, subscribeVersionRates } from "@/app/data/quoteStore";
import { docInBase, useDocCurrency } from "./docCurrencyContext";
import type { MoneyFx } from "./Money";

/* ── Versions shown in base, at each version's own rate ───────────────
 * Like the rest of the quote, versions show their amounts in the base
 * currency unless the page's switch shows the customer's: each at the rate
 * that version locked in (quoteStore's version rates), so a version made
 * with today's rate reads differently from one that kept its old rate.
 * Outside the quote page (the listing's history), base. A version on record
 * in another currency than the quote's now (changed while a Draft) falls
 * back to the quote's rate, as the design restates every version in the
 * quote's currency. */

/** The rate each version of a quote locked in, for DocCurrency's `versionFx`. */
export function useQuoteVersionFx(quoteId: string | undefined, currency: string): (version: number) => QuoteFx | null {
  const revision = React.useSyncExternalStore(subscribeVersionRates, getVersionRateRevision);
  return React.useCallback(
    (version: number) => {
      if (!quoteId) return null;
      const stamp = getVersionRate(quoteId, version);
      if (!stamp || stamp.currency.toUpperCase() !== currency.toUpperCase()) return null;
      const fx = quoteFx(stamp);
      return fx.isBase ? null : fx;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [quoteId, currency, revision],
  );
}

/** Version amounts as shown: `fxOf` a version's rate, `whole` an amount in
 *  the quote's currency written in base at that rate, or in the quote's. */
export function useVersionMoney() {
  const doc = useDocCurrency();
  const inBase = docInBase(doc);
  return React.useMemo(() => {
    const fxOf = (version: number): MoneyFx | null => doc.versionFx?.(version) ?? doc.fx;
    return {
      inBase,
      currency: doc.currency,
      fxOf,
      whole: (n: number, version: number) =>
        inBase ? formatWhole(toBase(n, fxOf(version)?.rate ?? 1), BASE_CURRENCY) : formatWhole(n, doc.currency),
    };
  }, [doc, inBase]);
}
