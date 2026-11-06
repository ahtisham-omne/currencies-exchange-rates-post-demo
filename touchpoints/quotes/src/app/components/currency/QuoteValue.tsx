import type { Quote } from "@/app/types/quote";
import { quoteFx } from "@/app/currency/qFx";
import { formatWhole } from "@/app/currency/quoteMoney";
import { Money } from "./Money";

/** A quote's value in its own currency (spec 4.3), with the rate on hover.
 *  `whole` drops the minor units, as the cards and summaries write it. */
export function QuoteValue({ quote, whole = false, className }: { quote: Pick<Quote, "totalValue" | "currency" | "exchangeRate" | "rateType" | "rateDate" | "rateEdited" | "createdDate" | "customer">; whole?: boolean; className?: string }) {
  const fx = quoteFx(quote);
  const value = quote.totalValue || 0;
  return (
    <Money value={value} currency={fx.currency} fx={fx.isBase ? null : fx} className={className}>
      {whole ? formatWhole(value, fx.currency) : undefined}
    </Money>
  );
}
