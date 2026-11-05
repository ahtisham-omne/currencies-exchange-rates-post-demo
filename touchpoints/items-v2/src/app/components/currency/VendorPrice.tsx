import * as React from 'react';
import { BASE_CURRENCY, isBaseCurrency } from '@/app/currency/currencies';
import { formatMoney } from '@/app/currency/money';
import { priceInBase, type VendorRate } from '@/app/currency/vendorFx';
import { Money } from './Money';

/* ── A vendor's price, and what it is in base (spec 4.1) ──────────────
 * The vendor's own currency first, the base-currency equivalent
 * underneath, so vendors quoting in different currencies can be compared.
 * The amount has the rate hover. */
export function VendorPrice({
  price,
  fx,
  uom,
  className = '',
  baseClassName = '',
}: {
  price: number;
  fx: VendorRate;
  /** "m (Meter)" → "¥142,857 / m (Meter)". */
  uom?: string;
  className?: string;
  baseClassName?: string;
}) {
  const isBase = isBaseCurrency(fx.currency);
  return (
    <span className={`inline-flex flex-col min-w-0 ${className}`}>
      <span className="truncate">
        <Money value={price} currency={fx.currency} fx={isBase ? null : fx} className="text-foreground font-medium" />
        {uom && <span className="text-muted-foreground"> / {uom}</span>}
      </span>
      {!isBase && price > 0 && (
        <span className={`text-[10.5px] text-muted-foreground tabular-nums truncate ${baseClassName}`}>
          ≈ {formatMoney(priceInBase(price, fx.rate), BASE_CURRENCY)}
          <span className="text-muted-foreground/70"> {BASE_CURRENCY}</span>
        </span>
      )}
    </span>
  );
}
