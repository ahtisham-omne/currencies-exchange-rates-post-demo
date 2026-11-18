import type { ReactNode } from "react";
import { Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip";

export interface SegmentedTabDef<K extends string = string> {
  key: K;
  label: ReactNode;
  /** Active text color (hex). Defaults to #0A77FF when omitted. */
  color?: string;
  /** Optional badge count rendered to the right of the label */
  badge?: number;
  /** Badge background color (defaults to #D97706 amber) */
  badgeColor?: string;
  /** Locks the tab: it still renders with its label and badge, but takes no
   *  click and shows the not-allowed cursor, as the sidebar does for a locked
   *  module. */
  disabled?: boolean;
  /** Hover copy for a locked tab, rendered in the white tooltip. */
  disabledTooltip?: string;
}

interface SegmentedTabsProps<K extends string> {
  tabs: SegmentedTabDef<K>[];
  value: K;
  onChange: (key: K) => void;
  /** When true, every tab gets equal width (driven by the widest label) */
  equalWidth?: boolean;
}

const DEFAULT_ACTIVE_COLOR = "#0A77FF";
const INACTIVE_COLOR = "#475569"; // slate-600

/* Single source of truth for label typography, applied identically to active
 * AND inactive tabs so the only visible difference is color/background. */
const LABEL_TYPOGRAPHY: React.CSSProperties = {
  fontFamily: "inherit",
  fontSize: 13,
  fontWeight: 450,
  lineHeight: "20px",
  letterSpacing: 0,
};

/** Pill-style segmented control. */
export function SegmentedTabs<K extends string>({ tabs, value, onChange, equalWidth }: SegmentedTabsProps<K>) {
  return (
    <div
      className="inline-grid items-center rounded-lg bg-slate-100 p-0.5"
      style={
        equalWidth
          ? { gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }
          : { gridAutoFlow: "column", gridAutoColumns: "max-content" }
      }
    >
      {tabs.map((t) => {
        const isActive = value === t.key;
        const activeColor = t.color ?? DEFAULT_ACTIVE_COLOR;
        /* Locked tabs keep their label and badge — only the click and the
         * pointer cursor are withheld. The native `disabled` attribute is
         * deliberately NOT set, so the tab still receives the pointer events
         * its tooltip needs. */
        const button = (
          <button
            key={t.key}
            type="button"
            onClick={t.disabled ? undefined : () => onChange(t.key)}
            aria-disabled={t.disabled || undefined}
            className={`inline-flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-md ${
              t.disabled ? "cursor-not-allowed" : "cursor-pointer"
            }`}
            style={{
              transition: "background-color 150ms, box-shadow 150ms, color 150ms",
              backgroundColor: isActive ? "#FFFFFF" : "transparent",
              boxShadow: isActive
                ? "0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)"
                : "none",
            }}
          >
            <span
              style={{
                ...LABEL_TYPOGRAPHY,
                color: isActive ? activeColor : INACTIVE_COLOR,
              }}
            >
              {t.label}
            </span>
            {t.badge != null && t.badge > 0 && (
              <span
                className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full text-white"
                style={{
                  backgroundColor: t.badgeColor ?? "#D97706",
                  fontSize: "10.5px",
                  fontWeight: 700,
                  lineHeight: 1,
                }}
              >
                {t.badge}
              </span>
            )}
          </button>
        );

        if (t.disabled && t.disabledTooltip) {
          return (
            <Tooltip key={t.key}>
              <TooltipTrigger asChild>{button}</TooltipTrigger>
              <TooltipContent
                side="top"
                sideOffset={8}
                className="bg-white text-[#0F172A] border border-[#E2E8F0] text-[13px] px-3 py-2 rounded-lg shadow-[0_8px_24px_-8px_rgba(15,23,42,0.18),0_2px_6px_-2px_rgba(15,23,42,0.06)]"
                style={{ fontWeight: 500 }}
              >
                {t.disabledTooltip}
              </TooltipContent>
            </Tooltip>
          );
        }
        return button;
      })}
    </div>
  );
}
