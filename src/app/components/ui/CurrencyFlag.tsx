import * as React from "react";
import { Globe } from "lucide-react";
import { flagUrlFor, type LibraryCurrency } from "@/app/data/currencyLibrary";

/**
 * Country flag for a currency from flagcdn.com. Multi-country currencies
 * (EUR, XAF, XOF, XCD, XCG, XPF — anything with `country: null`) render a
 * neutral globe icon instead, matching the Currency Library reference.
 */
export function CurrencyFlag({
  currency,
  size = 20,
}: {
  currency: LibraryCurrency;
  size?: number;
}) {
  const url = flagUrlFor(currency.country);
  const height = Math.round((size * 3) / 4);
  if (!url) {
    return (
      <span
        className="inline-flex items-center justify-center rounded-sm bg-slate-100 text-slate-500 shrink-0"
        style={{ width: size, height }}
        aria-label={`${currency.code} multi-country`}
      >
        <Globe className="w-3 h-3" />
      </span>
    );
  }
  return (
    <img
      src={url}
      alt={`${currency.code} flag`}
      loading="lazy"
      className="rounded-sm shrink-0 object-cover bg-slate-100"
      style={{ width: size, height }}
      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
    />
  );
}
