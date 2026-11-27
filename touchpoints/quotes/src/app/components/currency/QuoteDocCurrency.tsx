import * as React from "react";
import type { Quote } from "@/app/types/quote";
import { isoDay, quoteFx } from "@/app/currency/qFx";
import { DocCurrencyProvider } from "./DocCurrency";
import { useQuoteVersionFx } from "./versionMoney";

/** A quote's currency and rate for what renders inside (docCurrencyContext):
 *  modals opened from the listing or the board, outside the quote page.
 *  Amounts there stay in base, as the listing shows them (the quote page
 *  opens in the customer's currency since 27 Nov 2026), each version at its
 *  own rate. */
export function QuoteDocCurrency({ quote, children }: { quote: Quote | undefined; children: React.ReactNode }) {
  const fx = quoteFx(quote ?? {});
  const versionFx = useQuoteVersionFx(quote?.id, fx.currency);
  return (
    <DocCurrencyProvider
      currency={fx.currency}
      fx={fx.isBase ? null : fx}
      rateDate={quote?.createdDate ? isoDay(quote.createdDate) : fx.rateDate}
      dateLabel="quote date"
      role="customer currency"
      view="base"
      versionFx={versionFx}
    >
      {children}
    </DocCurrencyProvider>
  );
}
