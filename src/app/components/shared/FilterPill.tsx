import type { ComponentType } from "react";

interface FilterPillProps {
  label: string;
  count?: number;
  active?: boolean;
  onClick?: () => void;
  /**
   * Tone variant.
   * - `default`: primary-blue active state, muted neutral at rest. Used by
   *   every standard filter pill.
   * - `destructive`: red accent at rest AND when active. Reserved for
   *   destructive filter pills (Archived) so the user gets a visual flag
   *   that the bucket they're entering is for soft-deleted records.
   *   Mirrors Partner Management's `VendorsListPage` destructive treatment.
   */
  tone?: "default" | "destructive";
  /** Optional leading icon (e.g. `Archive` for the destructive pill). */
  icon?: ComponentType<{ className?: string }>;
}

/**
 * Shared filter pill — Partner Management `VendorsListPage` parity. Reuse this
 * everywhere a filter chip / quick-filter pill is rendered (listings, detail
 * tabs, picker modals) so size, padding, border-radius, hover, and badge
 * styling stay in lockstep across the suite.
 *
 * Spec (matches Partner exactly):
 * - Container: `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs`
 * - Active default: `border-primary bg-accent` with `hover:bg-[#D6E8FF] active:bg-[#ADD1FF]`
 * - Inactive default: `border-border text-muted-foreground` with
 *   `hover:bg-muted/60 hover:text-foreground hover:border-muted-foreground/30 active:bg-muted`
 * - Active destructive: `border-red-300 bg-red-50 hover:bg-red-100 active:bg-red-200`
 * - Inactive destructive: `border-red-200 text-destructive hover:bg-red-50 hover:border-red-300 active:bg-red-100`
 * - Count badge: `text-[10px] rounded-full px-1.5 py-px min-w-[18px] text-center`
 *   with the inner background tinted to match the tone (`bg-primary/10` /
 *   `bg-red-100` when active, `bg-muted` / `bg-red-50` at rest).
 */
export function FilterPill({ label, count, active, onClick, tone = "default", icon: Icon }: FilterPillProps) {
  const isDestructive = tone === "destructive";
  const stateClasses = active
    ? (isDestructive
        ? "border-red-300 bg-red-50 hover:bg-red-100 active:bg-red-200"
        : "border-primary bg-accent hover:bg-[#D6E8FF] active:bg-[#ADD1FF]")
    : (isDestructive
        ? "border-red-200 text-destructive hover:bg-red-50 hover:border-red-300 active:bg-red-100"
        : "border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-muted-foreground/30 active:bg-muted");

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer ${stateClasses}`}
      style={{
        fontWeight: active ? 500 : 400,
        /* `--destructive` and `--primary` are stored as plain hex/oklch
           values in this theme, not HSL components, so they must be
           referenced via `var(...)` directly. Wrapping in `hsl(...)`
           (the Partner pattern) produces invalid CSS here and falls
           back to inherited foreground (black). */
        color: active
          ? (isDestructive ? "var(--destructive)" : "var(--primary)")
          : (isDestructive ? "var(--destructive)" : undefined),
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      {Icon && <Icon className="w-3 h-3" />}
      {label}
      {count != null && (
        <span
          className={`text-[10px] rounded-full px-1.5 py-px min-w-[18px] text-center ${
            active
              ? (isDestructive ? "bg-red-100" : "bg-primary/10")
              : (isDestructive ? "bg-red-50" : "bg-muted")
          }`}
          style={{
            fontWeight: 600,
            color: active
              ? (isDestructive ? "var(--destructive)" : "var(--primary)")
              : (isDestructive ? "var(--destructive)" : "var(--muted-foreground)"),
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}
