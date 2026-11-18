import * as React from "react";
import type { SalesOrder } from "@/app/components/so/types";
import { soFx } from "@/app/currency/soFx";
import { DocCurrencyProvider } from "./DocCurrency";

/** An order's currency and rate for what renders inside (docCurrencyContext):
 *  modals opened from the listing or the board, outside the SO page. Shown
 *  in base, as the rest of Sales Orders is, the customer's amount on hover. */
export function SODocCurrency({ so, children }: { so: SalesOrder; children: React.ReactNode }) {
  const fx = soFx(so);
  return (
    <DocCurrencyProvider currency={fx.currency} fx={fx.isBase ? null : fx} rateDate={fx.rateDate} dateLabel="order date" role="customer currency" view="base">
      {children}
    </DocCurrencyProvider>
  );
}
