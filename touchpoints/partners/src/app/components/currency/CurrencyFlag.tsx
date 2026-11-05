import * as React from "react";
import { getCurrency } from "@/app/currency/currencies";
import { FlagImage } from "./FlagImage";

/**
 * A currency's flag, drawn by FlagImage the way the Currency & Exchange Rates
 * shell draws it. Shared currencies (EUR, XAF, XOF, XCD, XCG, XPF) show the
 * member flag the shell uses. Like the shell's table and list flags it is
 * 17×13 px (the shell's text-base is 13px) unless `className` sizes it otherwise.
 */
export function CurrencyFlag({ code, className = "text-[13px]" }: { code: string | null | undefined; className?: string }) {
  return <FlagImage code={getCurrency(code)?.flag} className={className} />;
}
