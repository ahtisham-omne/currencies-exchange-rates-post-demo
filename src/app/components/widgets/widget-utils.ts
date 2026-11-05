/**
 * Widget Utilities — CSS-variable resolvers & color helpers.
 *
 * Designed for CSS-variable-driven design systems. Every color, spacing,
 * and font value is resolved from custom properties at runtime so that
 * re-skinning is a matter of editing CSS alone.
 *
 * Portable: copy this file alongside any widget that needs it.
 */

/* ── Design-system font alias ── */
export const FONT = "var(--font-inter)";

/* ── Shared period options for all widgets (except Stock Health & On-Hand UOM) ── */
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

/**
 * Normalize any CSS color string (including modern formats like
 * `color(srgb …)`, `oklch(…)`, `lab(…)`, etc.) to a hex `#rrggbb`
 * string that Chart.js and canvas APIs can consume.
 *
 * Uses an offscreen 2D canvas context — the browser's built-in
 * serializer always returns `#rrggbb` or `rgba(r,g,b,a)`.
 */
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
  ctx.fillStyle = "#000000"; // reset
  ctx.fillStyle = color;
  return ctx.fillStyle; // "#rrggbb" or possibly "rgba(r,g,b,a)"
}

/**
 * Resolve a CSS custom-property `var(--*)` token to its computed value,
 * then normalise to a format Chart.js / canvas can consume.
 * Returns the token string itself as a fallback.
 */
export function resolveVar(token: string): string {
  if (!token.startsWith("var(")) return normalizeColor(token);
  const name = token.replace(/^var\(\s*/, "").replace(/\s*\)$/, "");
  const raw =
    getComputedStyle(document.documentElement)
      .getPropertyValue(name)
      .trim() || token;
  return normalizeColor(raw);
}

/**
 * Resolve a CSS font-family custom property.
 * Falls back to `"Inter, sans-serif"` if unresolvable.
 */
export function resolveFont(token: string): string {
  if (!token.startsWith("var(")) return token;
  const name = token.replace(/^var\(\s*/, "").replace(/\s*\)$/, "");
  return (
    getComputedStyle(document.documentElement)
      .getPropertyValue(name)
      .trim() || "Inter, sans-serif"
  );
}

/**
 * Apply an alpha value (0-1) to a resolved color string.
 * Handles any format by first normalising through the canvas context.
 */
export function withAlpha(resolved: string, alpha: number): string {
  // Normalise to #rrggbb or rgba(…)
  const norm = normalizeColor(resolved);

  // Handle rgba / rgb
  const rgbaMatch = norm.match(
    /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/,
  );
  if (rgbaMatch) {
    return `rgba(${rgbaMatch[1]}, ${rgbaMatch[2]}, ${rgbaMatch[3]}, ${alpha})`;
  }
  // Handle 6/8-digit hex
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

/* ══════════════════════════════════════════════════════════════════════
 *  Shared Chart.js tooltip & hover configuration
 *
 *  Uses an *external* HTML tooltip element so all Chart.js charts share
 *  the same look, animate smoothly via CSS transitions (no canvas
 *  redraw flicker), and honour the design-system tokens.
 * ══════════════════════════════════════════════════════════════════════ */

const TOOLTIP_ID = "chart-tooltip-el";

function getOrCreateTooltipEl(): HTMLDivElement {
  let el = document.getElementById(TOOLTIP_ID) as HTMLDivElement | null;
  if (!el) {
    el = document.createElement("div");
    el.id = TOOLTIP_ID;
    Object.assign(el.style, {
      position: "fixed",
      pointerEvents: "none",
      zIndex: "9999",
      opacity: "0",
      transition: "opacity 0.15s ease, transform 0.15s ease",
      transform: "translateY(2px)",
      fontFamily: "var(--font-inter)",
    });
    document.body.appendChild(el);
  }
  return el;
}

/**
 * External tooltip handler shared by every Chart.js widget.
 * Renders a styled HTML tooltip positioned near the hovered data point.
 */
export function externalTooltipHandler(context: any) {
  const { chart, tooltip } = context;
  const el = getOrCreateTooltipEl();

  // Hide
  if (tooltip.opacity === 0) {
    el.style.opacity = "0";
    el.style.transform = "translateY(2px)";
    return;
  }

  // Build content
  if (tooltip.body) {
    const titleLines: string[] = tooltip.title || [];
    const bodyLines: any[] = tooltip.body.map((b: any) => b.lines);

    let html = "";

    // Title
    if (titleLines.length) {
      html += `<div style="
        font-size:var(--text-caption);
        font-weight:var(--font-weight-medium);
        color:var(--text-tertiary);
        margin-bottom:var(--spacing-0-5);
        line-height:1.3;
      ">${titleLines.join("<br>")}</div>`;
    }

    // Body rows
    bodyLines.forEach((lines: string[], i: number) => {
      const colors = tooltip.labelColors?.[i];
      lines.forEach((line: string) => {
        const dotColor = colors?.backgroundColor || "var(--piw-primary)";
        html += `<div style="
          display:flex;align-items:center;gap:6px;
          font-size:var(--text-body-sm);
          font-weight:var(--font-weight-semibold);
          color:var(--piw-foreground);
          line-height:1.4;
        ">
          <span style="
            width:8px;height:8px;border-radius:2px;flex-shrink:0;
            background:${dotColor};
          "></span>
          ${line}
        </div>`;
      });
    });

    el.innerHTML = html;
  }

  // Style the container
  Object.assign(el.style, {
    background: "var(--piw-card)",
    border: "1px solid var(--piw-border)",
    borderRadius: "var(--radius-md)",
    padding: "var(--spacing-2) var(--spacing-3)",
    boxShadow: "0 4px 16px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.05)",
    fontFamily: "var(--font-inter)",
    maxWidth: "220px",
  });

  // Position
  const canvasRect = chart.canvas.getBoundingClientRect();
  const left = canvasRect.left + tooltip.caretX;
  const top = canvasRect.top + tooltip.caretY;

  // Measure tooltip dimensions
  const elW = el.offsetWidth;
  const elH = el.offsetHeight;

  // Clamp horizontal: keep inside viewport with 8px margin
  let posLeft = left - elW / 2;
  posLeft = Math.max(8, Math.min(posLeft, window.innerWidth - elW - 8));

  // Vertical: prefer above, fall below if not enough room
  let posTop = top - elH - 10;
  if (posTop < 8) posTop = top + 14;

  el.style.left = `${posLeft}px`;
  el.style.top = `${posTop}px`;
  el.style.opacity = "1";
  el.style.transform = "translateY(0)";
}

/**
 * Returns a consistent Chart.js tooltip plugin config.
 * Use `enabled: false` + `external` for the HTML tooltip.
 */
export function chartTooltipConfig() {
  return {
    enabled: false,
    external: externalTooltipHandler,
    mode: "index" as const,
    intersect: false,
  };
}

/**
 * Returns shared Chart.js interaction config for consistent hover.
 */
export function chartInteractionConfig() {
  return {
    mode: "index" as const,
    intersect: false,
  };
}

/**
 * Shared animation config for all Chart.js widgets.
 */
export function chartAnimationConfig() {
  return {
    duration: 500,
    easing: "easeOutQuart" as const,
  };
}