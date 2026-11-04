import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export interface StatusPillStyle {
  bg: string;
  fg: string;
  border: string;
  icon?: LucideIcon;
}

interface StatusPillProps {
  /** Text, or text with a search mark inside it (highlightText). */
  label: ReactNode;
  style: StatusPillStyle;
}

/** Generic status chip used across all data tables. The caller supplies
 *  the color tokens and optional icon — the component only handles layout. */
export function StatusPill({ label, style }: StatusPillProps) {
  const Icon = style.icon;
  return (
    <span
      className="inline-flex items-center justify-center gap-1 rounded-full border px-2.5 py-0.5 text-xs whitespace-nowrap shrink-0"
      style={{
        fontWeight: 500,
        backgroundColor: style.bg,
        color: style.fg,
        borderColor: style.border,
      }}
    >
      {Icon && <Icon className="w-3 h-3" />}
      {label}
    </span>
  );
}
