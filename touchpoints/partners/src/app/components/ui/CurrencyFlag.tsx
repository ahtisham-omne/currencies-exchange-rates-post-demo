import * as React from "react";
import { flagCodeForCurrency, type LibraryCurrency } from "@/app/data/currencyLibrary";
import { FlagImage } from "./FlagImage";

/**
 * A currency's flag, drawn by FlagImage the way the Currency & Exchange Rates
 * shell draws it. Shared currencies (EUR, XAF, XOF, XCD, XCG, XPF) show the
 * same stand-in flag the shell does. `size` is the flag's width in px.
 */
export function CurrencyFlag({
  currency,
  size = 20,
}: {
  currency: LibraryCurrency;
  size?: number;
}) {
  // FlagImage is 1.33em wide, so this font size makes it `size` px wide.
  return <FlagImage code={flagCodeForCurrency(currency)} style={{ fontSize: size * 0.75 }} />;
}
