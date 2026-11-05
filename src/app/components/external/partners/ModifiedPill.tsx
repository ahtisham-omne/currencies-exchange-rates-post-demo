/**
 * Canonical "Overridden" pill — surfaces when a partner's
 * configuration deviates from its group template's defaults.
 * Mirrors the Items module's identically-purposed chip Eli flagged
 * as the canonical reference, and follows the project rule of never
 * putting dot / circle indicators inside pills (see
 * memory/feedback_no_dots_in_pills.md).
 *
 * The look: light amber tint, amber border, bold dark-amber label.
 * No leading icon, no status dot — terse and consistent everywhere
 * a group→partner inheritance relationship surfaces an override.
 *
 * Sizes:
 *   "sm" (default) — 10px text, used on cards / banner rows.
 *   "xs"           — 9px text, used in tight nav rails and table rows.
 */
export function ModifiedPill({
  size = "sm",
  label = "Overridden",
  className = "",
  title,
}: {
  size?: "sm" | "xs";
  /** Display label. Defaults to "Overridden" — the canonical word
   *  across the partner-management module. Items uses "Custom
   *  Configuration"; pass that as `label` for surfaces that want
   *  the Items-style copy. */
  label?: string;
  className?: string;
  title?: string;
}) {
  const text = size === "xs" ? "text-[9px]" : "text-[10px]";
  const padX = size === "xs" ? "px-1.5" : "px-2";
  const padY = size === "xs" ? "py-[1px]" : "py-[2px]";
  return (
    <span
      className={`inline-flex items-center ${padX} ${padY} rounded-md text-amber-800 bg-amber-50 border border-amber-200 ${text} ${className}`}
      style={{ fontWeight: 600 }}
      title={title}
    >
      {label}
    </span>
  );
}
