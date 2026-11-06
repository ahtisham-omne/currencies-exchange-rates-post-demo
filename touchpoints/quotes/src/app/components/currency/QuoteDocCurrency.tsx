import * as React from "react";
import type { Quote } from "@/app/types/quote";
import { quoteFx } from "@/app/currency/qFx";
import { DocCurrencyProvider } from "./DocCurrency";

/** A quote's currency and rate for what renders inside (docCurrencyContext):
 *  modals opened from the listing or the board, outside the quote page. */
export function QuoteDocCurrency({ quote, children }: { quote: Quote | undefined; children: React.ReactNode }) {
  const fx = quoteFx(quote ?? {});
  return (
    <DocCurrencyProvider currency={fx.currency} fx={fx.isBase ? null : fx} rateDate={fx.rateDate} dateLabel="quote date" role="quote currency">
      {children}
    </DocCurrencyProvider>
  );
}
