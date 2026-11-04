import * as React from 'react';
import { FlagImage } from './FlagImage';

/**
 * A country's flag, drawn by FlagImage the way the Currency & Exchange Rates
 * shell draws it. Pass an ISO 3166-1 alpha-2 country code (lowercase); for a
 * currency, pass `flagCodeForCurrency(currency)` so shared currencies (EUR,
 * XAF, XOF, XCD, XCG, XPF) get the shell's stand-in flag. `size` is the
 * flag's width in px.
 */
export function CurrencyFlag({
  country,
  size = 20,
}: {
  country: string | null;
  size?: number;
}) {
  // FlagImage is 1.33em wide, so this font size makes it `size` px wide.
  return <FlagImage code={country} style={{ fontSize: size * 0.75 }} />;
}
