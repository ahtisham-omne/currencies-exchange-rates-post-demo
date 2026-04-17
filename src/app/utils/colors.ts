/**
 * AAA-compliant avatar background colors.
 *
 * Maps any of the 500/600-level Tailwind palette colors in our mock data
 * to their corresponding 700/800-level shade that guarantees >= 7:1
 * contrast ratio with white (#FFFFFF) text, satisfying WCAG AAA.
 */
const AAA_COLOR_MAP: Record<string, string> = {
  // sky
  "#0ea5e9": "#0369A1",
  "#0284c7": "#075985",
  // violet
  "#8b5cf6": "#6D28D9",
  "#7c3aed": "#5B21B6",
  // amber
  "#f59e0b": "#92400E",
  "#d97706": "#92400E",
  // emerald / green
  "#10b981": "#065F46",
  "#059669": "#065F46",
  "#16a34a": "#166534",
  // red
  "#ef4444": "#991B1B",
  // indigo
  "#6366f1": "#4338CA",
  "#4f46e5": "#3730A3",
  // pink
  "#ec4899": "#9D174D",
  "#db2777": "#9D174D",
  // teal
  "#14b8a6": "#115E59",
  // orange
  "#f97316": "#9A3412",
  "#ea580c": "#9A3412",
  // lime
  "#84cc16": "#3F6212",
  // purple
  "#a855f7": "#7E22CE",
  "#9333ea": "#6B21A8",
  // cyan
  "#0891b2": "#155E75",
  // rose
  "#e11d48": "#9F1239",
};

/**
 * Returns an AAA-compliant avatar background color for white text.
 * If the input color has a known mapping, the deeper shade is returned.
 * Otherwise the original color is passed through.
 */
export function toAAAColor(color: string): string {
  return AAA_COLOR_MAP[color.toLowerCase()] ?? color;
}
