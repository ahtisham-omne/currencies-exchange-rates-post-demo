import { type ReactNode } from "react";
import { X as XIcon } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip";

export interface BulkAction {
  key: string;
  label: string;
  icon: ReactNode;
  /** "default" | "warning" | "danger" */
  variant?: "default" | "warning" | "danger";
  /** If provided, renders a dropdown with sub-options instead of a single button */
  subActions?: { key: string; label: string; icon: ReactNode; onClick: () => void }[];
  onClick?: () => void;
  /** When true, the button is greyed and non-interactive (kept hoverable so the
   *  tooltip still explains why). Used e.g. when every selected row is excluded
   *  from a status change. */
  disabled?: boolean;
  /** Optional explanatory tooltip shown on hover. Rendered even when disabled so
   *  the button can educate on why the action is unavailable. */
  tooltip?: ReactNode;
  /** Trailing adornment after the label (e.g. an Info glyph signalling a tooltip). */
  trailing?: ReactNode;
}

interface BulkActionBarProps {
  selectedCount: number;
  actions: BulkAction[];
  onCancel: () => void;
  /** Shown in place of the action group when `actions` is empty — e.g. when the
   *  active access persona may run none of them. Keeps the selection count and
   *  Cancel reachable instead of leaving a blank strip. */
  emptyNote?: ReactNode;
}

const VARIANT_STYLES = {
  default: {
    border: "#CBD5E1",
    color: "#334155",
    hoverBg: "#F1F5F9",
  },
  warning: {
    border: "#FCD34D",
    color: "#B45309",
    hoverBg: "#FFFBEB",
  },
  danger: {
    border: "#FECACA",
    color: "#DC2626",
    hoverBg: "#FEF2F2",
  },
};

export function BulkActionBar({ selectedCount, actions, onCancel, emptyNote }: BulkActionBarProps) {
  return (
    <div
      className="flex items-center gap-2 px-4 pb-3 shrink-0"
      style={{ background: "linear-gradient(to top, #F0F7FF 0%, #FFFFFF 100%)" }}
    >
      {/* Left: action buttons */}
      <div className="flex items-center gap-1.5">
        {actions.length === 0 && emptyNote}
        {actions.map((action) => {
          const variant = VARIANT_STYLES[action.variant ?? "default"];
          const disabled = !!action.disabled;
          const button = (
            <button
              key={action.key}
              onClick={() => { if (!disabled) action.onClick?.(); }}
              aria-disabled={disabled}
              className="inline-flex items-center gap-1.5 py-1.5 px-2.5 rounded-[6px] border text-[12px] transition-colors"
              style={{
                fontWeight: 500,
                color: variant.color,
                borderColor: variant.border,
                backgroundColor: "white",
                opacity: disabled ? 0.45 : 1,
                cursor: disabled ? "not-allowed" : "pointer",
              }}
              onMouseEnter={(e) => {
                if (!disabled) e.currentTarget.style.backgroundColor = variant.hoverBg;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "white";
              }}
            >
              {action.icon}
              {action.label}
              {action.trailing}
            </button>
          );
          if (action.tooltip) {
            return (
              <Tooltip key={action.key}>
                <TooltipTrigger asChild>{button}</TooltipTrigger>
                <TooltipContent side="top" sideOffset={6} className="max-w-[300px] bg-white text-foreground">
                  {action.tooltip}
                </TooltipContent>
              </Tooltip>
            );
          }
          return button;
        })}
      </div>

      <div className="flex-1" />

      {/* Right: count + cancel */}
      <div className="flex items-center gap-2.5">
        <span
          className="text-[13px]"
          style={{ fontWeight: 600, color: "#007FFF" }}
        >
          {selectedCount} selected
        </span>
        <button
          onClick={onCancel}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] border text-[12px] transition-colors cursor-pointer"
          style={{
            fontWeight: 500,
            color: "#64748B",
            borderColor: "#CBD5E1",
            backgroundColor: "white",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#94A3B8"; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#CBD5E1"; }}
        >
          <XIcon className="w-3 h-3" />
          Cancel
        </button>
      </div>
    </div>
  );
}
