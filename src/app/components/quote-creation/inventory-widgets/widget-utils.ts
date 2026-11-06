/**
 * Widget Utilities — CSS-variable resolvers & color helpers.
 *
 * Ported verbatim from Physical Inventory (`widgets/widget-utils.ts`).
 * The only adjustment is that the Chart.js-specific helpers are kept as
 * runtime no-ops so the rest of the file remains a 1:1 mirror; SO/Quote
 * modules don't ship Chart.js, so no consumer should import them.
 */

export const FONT = "var(--font-inter)";

export const PERIOD_OPTIONS = [
  "Today",
  "This Week",
  "Last Week",
  "Monthly",
  "Quarterly",
  "Yearly",
  "Custom Date",
] as const;
export type PeriodOption = (typeof PERIOD_OPTIONS)[number];

let _ctx: CanvasRenderingContext2D | null = null;
function getColorCtx(): CanvasRenderingContext2D | null {
  if (!_ctx) {
    _ctx = document.createElement("canvas").getContext("2d");
  }
  return _ctx;
}

export function normalizeColor(color: string): string {
  const ctx = getColorCtx();
  if (!ctx) return color;
  ctx.fillStyle = "#000000";
  ctx.fillStyle = color;
  return ctx.fillStyle;
}

export function resolveVar(token: string): string {
  if (!token.startsWith("var(")) return normalizeColor(token);
  const name = token.replace(/^var\(\s*/, "").replace(/\s*\)$/, "");
  const raw =
    getComputedStyle(document.documentElement)
      .getPropertyValue(name)
      .trim() || token;
  return normalizeColor(raw);
}

export function resolveFont(token: string): string {
  if (!token.startsWith("var(")) return token;
  const name = token.replace(/^var\(\s*/, "").replace(/\s*\)$/, "");
  return (
    getComputedStyle(document.documentElement)
      .getPropertyValue(name)
      .trim() || "Inter, sans-serif"
  );
}

export function withAlpha(resolved: string, alpha: number): string {
  const norm = normalizeColor(resolved);
  const rgbaMatch = norm.match(
    /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/,
  );
  if (rgbaMatch) {
    return `rgba(${rgbaMatch[1]}, ${rgbaMatch[2]}, ${rgbaMatch[3]}, ${alpha})`;
  }
  const hexMatch = norm.match(/^#([0-9a-f]{6,8})$/i);
  if (hexMatch) {
    const hex = hexMatch[1];
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return norm;
}
