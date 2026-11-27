import * as React from "react";
import type { SalesOrder } from "@/app/components/so/types";
import { soFx } from "@/app/currency/soFx";
import { DocCurrencyProvider } from "./DocCurrency";
import { useDocViewOf } from "./docView";

/** An order's currency and rate for what renders inside (docCurrencyContext):
 *  modals opened from the listing or the board, outside the SO page. Shown
 *  the way the order's page shows it: in the customer's currency by default
 *  (27 Nov 2026, D1), the base amount on hover, or in base if the order's
 *  Base Currency | Customer Currency switch says so (docView.ts). */
export function SODocCurrency({ so, children }: { so: SalesOrder; children: React.ReactNode }) {
  const fx = soFx(so);
  const view = useDocViewOf(`so:${so.id}`);
  return (
    <DocCurrencyProvider currency={fx.currency} fx={fx.isBase ? null : fx} rateDate={fx.rateDate} dateLabel="order date" role="customer currency" view={view}>
      {children}
    </DocCurrencyProvider>
  );
}
