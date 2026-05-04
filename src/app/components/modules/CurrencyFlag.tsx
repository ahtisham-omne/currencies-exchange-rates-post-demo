import * as React from 'react';
import { Globe } from 'lucide-react';
import { flagUrlFor } from '../../data/rateConstants';

/**
 * Country flag for a currency from flagcdn.com — mirrors the CurrencyFlag /
 * FlagOrGlobe pattern used in the Partners touchpoint repo. Pass an ISO
 * 3166-1 alpha-2 country code (lowercase). For multi-country currencies
 * (EUR, XAF, XOF, XCD, XCG, XPF) pass `null` and a globe fallback renders.
 * EUR callers can pass `'eu'` to get the EU flag instead of the globe.
 */
export function CurrencyFlag({
  country,
  size = 20,
}: {
  country: string | null;
  size?: number;
}) {
  const height = Math.round((size * 3) / 4);
  const url = country ? flagUrlFor(country) : null;
  if (!url) {
    return (
      <span
        className="inline-flex items-center justify-center rounded-sm bg-slate-100 text-slate-500 shrink-0"
        style={{ width: size, height }}
        aria-label="Multi-country currency"
      >
        <Globe className="w-3 h-3" />
      </span>
    );
  }
  return (
    <img
      src={url}
      alt={`${country!.toUpperCase()} flag`}
      loading="lazy"
      className="rounded-sm shrink-0 object-cover bg-slate-100"
      style={{ width: size, height }}
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).style.display = 'none';
      }}
    />
  );
}
