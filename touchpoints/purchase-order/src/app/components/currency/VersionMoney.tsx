import * as React from "react";
import type { PoFx } from "@/app/currency/poFx";
import { BaseMoney, Money } from "./Money";
import { useVersionInBase } from "../poVersionDisplay";

/** A version's amount with its hover, in the page's view: base at the
 *  version's own rate (the vendor's amount on hover), or the version's
 *  currency (base on hover). `children` replaces the text, as with Money. */
export function VersionMoney({ value, fx, children }: { value: number; fx: PoFx; children?: React.ReactNode }) {
  const inBase = useVersionInBase();
  if (inBase && !fx.isBase) {
    return (
      <BaseMoney value={value} currency={fx.currency} fx={fx} dateLabel="PO date" role="Vendor currency">
        {children}
      </BaseMoney>
    );
  }
  return (
    <Money value={value} currency={fx.currency} fx={fx} dateLabel="PO date">
      {children}
    </Money>
  );
}
