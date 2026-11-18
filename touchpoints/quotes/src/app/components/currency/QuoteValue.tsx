import type { Quote } from "@/app/types/quote";
import { BASE_CURRENCY } from "@/app/currency/currencies";
import { quoteFx } from "@/app/currency/qFx";
import { formatWhole } from "@/app/currency/quoteMoney";
import { toBase } from "@/app/currency/rates";
import { BaseMoney } from "./Money";

/** A quote's value in the base currency at its own rate, with the
 *  customer's amount (the quote's currency) and the rate on hover, as
 *  Quotes shows amounts by default. `whole` drops the minor units, as the
 *  cards and summaries write it. */
export function QuoteValue({ quote, whole = false, className }: { quote: Pick<Quote, "totalValue" | "currency" | "exchangeRate" | "rateType" | "rateDate" | "rateEdited" | "createdDate" | "customer">; whole?: boolean; className?: string }) {
  const fx = quoteFx(quote);
  const value = quote.totalValue || 0;
  return (
    <BaseMoney value={value} currency={fx.currency} fx={fx.isBase ? null : fx} className={className}>
      {whole ? formatWhole(fx.isBase ? value : toBase(value, fx.rate), fx.isBase ? fx.currency : BASE_CURRENCY) : undefined}
    </BaseMoney>
  );
}
