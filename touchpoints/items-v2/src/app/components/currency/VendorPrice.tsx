import * as React from 'react';
import { isBaseCurrency } from '@/app/currency/currencies';
import type { VendorRate } from '@/app/currency/vendorFx';
import { BaseMoney } from './Money';

/* ── A vendor's price on the item's vendor list ───────────────────────
 * In the base currency, so vendors quoting in different currencies compare
 * at a glance (Currency Touchpoints Map, Items 2, 24 Nov 2026): "₨361,727.85
 * / km". A foreign vendor's price has the rate card on hover: the vendor's
 * own price in its currency, the base figure, and the rate it converts at
 * (the vendor's rate type, today). A base-currency vendor's price is plain. */
export function VendorPrice({
  price,
  fx,
  uom,
  className = '',
}: {
  /** In the vendor's currency. */
  price: number;
  fx: VendorRate;
  /** "m (Meter)" → "₨142,857.00 / m (Meter)". */
  uom?: string;
  className?: string;
}) {
  const isBase = isBaseCurrency(fx.currency);
  return (
    <span className={`inline-flex min-w-0 truncate ${className}`}>
      <span className="truncate">
        <BaseMoney value={price} currency={fx.currency} fx={isBase ? null : fx} className="text-foreground font-medium" />
        {uom && <span className="text-muted-foreground"> / {uom}</span>}
      </span>
    </span>
  );
}
