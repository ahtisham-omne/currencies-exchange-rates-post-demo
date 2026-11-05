/**
 * How a number cell reads in the import grids: thousands separated, decimals
 * kept exactly as typed. "20000" shows as "20,000", "1250.5" as "1,250.5".
 * Display only: the stored value, validation and the import keep what was typed.
 * Anything that is not a plain number (blank, "-500" is fine, "abc", "1,200")
 * is shown unchanged so the error the user has to fix stays visible.
 */
export function formatNumberDisplay(raw: string): string {
  const v = String(raw ?? "").trim();
  const m = /^(-?)(\d+)(\.\d+)?$/.exec(v);
  if (!m) return raw;
  return `${m[1]}${m[2].replace(/\B(?=(\d{3})+(?!\d))/g, ",")}${m[3] ?? ""}`;
}
