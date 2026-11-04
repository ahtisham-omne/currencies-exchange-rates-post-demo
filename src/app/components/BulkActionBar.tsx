import { type ReactNode } from "react";
import { X, type LucideIcon } from "lucide-react";

export type BulkActionTone = "primary" | "warning" | "destructive" | "success" | "neutral";

export type BulkAction = {
  key: string;
  label: string;
  icon?: LucideIcon;
  /** Semantic tone — drives the button's color coding. */
  tone?: BulkActionTone;
  /** Optional count badge rendered after the label, e.g. "Mark as Inactive (12)".
   *  When omitted no badge is shown. When 0 the action is hidden automatically. */
  count?: number;
  onClick: () => void;
  disabled?: boolean;
};

// 1:1 port of the partner module's BulkActionBar (7/16/26): flat row,
// plain-text count indicator, and BORDERED TINTED chip buttons per tone.
const TONE_CLASS: Record<BulkActionTone, string> = {
  primary:
    "border-primary/30 text-primary bg-primary/5 hover:bg-primary/10 hover:border-primary/50 active:bg-primary/15",
  warning:
    "border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100 hover:border-amber-400 active:bg-amber-200",
  destructive:
    "border-red-300 text-destructive bg-red-50 hover:bg-red-100 hover:border-red-400 active:bg-red-200",
  success:
    "border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 hover:border-emerald-400 active:bg-emerald-200",
  neutral:
    "border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-muted-foreground/30 active:bg-muted",
};

type BulkActionBarProps = {
  /** Number of currently selected rows. Bar is hidden when 0. */
  count: number;
  /** Singular noun for the selected entity, e.g. "partner", "group", "contact". */
  noun: string;
  /** Plural noun. If omitted, defaults to `${noun}s`. */
  nounPlural?: string;
  /** Action buttons rendered to the right of the count pill. */
  actions: BulkAction[];
  /** Reset selection. */
  onClear: () => void;
  /** Optional trailing slot (e.g. extra menu). */
  trailing?: ReactNode;
};

/**
 * Bulk Action Bar — appears between the search/filter toolbar and the table
 * header when rows are selected. Matches the partner listing exactly:
 *   N invoices selected | [Action (n)] [Action (n)] ...        ✕ Clear selection
 *
 * Designed to be drop-in across list pages. Each page passes its own
 * confirmed action set.
 */
export function BulkActionBar({
  count,
  noun,
  nounPlural,
  actions,
  onClear,
  trailing,
}: BulkActionBarProps) {
  if (count === 0) return null;

  const label = count === 1 ? noun : (nounPlural ?? `${noun}s`);

  return (
    <div className="flex items-center justify-between gap-3 px-4 pb-3 text-[13px] shrink-0">
      <div className="flex items-center gap-2 min-w-0 overflow-x-auto">
        {/* Plain-text selection indicator — sits left of the actions so it
            reads as a status label, not another clickable pill. */}
        <span
          className="inline-flex items-center gap-1 text-xs whitespace-nowrap shrink-0"
          style={{ color: "hsl(var(--primary))", fontWeight: 500 }}
        >
          <span className="">{count}</span>
          <span>{label} selected</span>
        </span>

        {/* Vertical separator to set selection indicator apart from actions */}
        <div className="w-px h-5 bg-border shrink-0" />

        {actions.map((action) => {
          // Hide actions whose target set is empty — e.g. "Mark as Active"
          // when no inactive rows are selected.
          if (action.count === 0) return null;
          const Icon = action.icon;
          const tone = action.tone ?? "neutral";
          return (
            <button
              key={action.key}
              type="button"
              disabled={action.disabled}
              onClick={action.onClick}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer ${TONE_CLASS[tone]} disabled:opacity-50 disabled:cursor-not-allowed`}
              style={{ fontWeight: 500 }}
            >
              {Icon && <Icon className="w-3.5 h-3.5" />}
              <span>{action.label}</span>
              {typeof action.count === "number" && (
                <span className="opacity-80">({action.count})</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {trailing}
        <button
          type="button"
          onClick={onClear}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap cursor-pointer"
          aria-label="Clear Selection"
        >
          <X className="w-3.5 h-3.5" />
          Clear Selection
        </button>
      </div>
    </div>
  );
}
