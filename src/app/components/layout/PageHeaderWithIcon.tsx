import React from "react";
import type { ComponentType, CSSProperties } from "react";

/* ── Types ── */

export interface PageHeaderWithIconProps {
  /** Lucide icon (or any component matching that signature) */
  icon: ComponentType<{ className?: string; style?: CSSProperties }>;
  title: string;
  subtitle?: string;
  /** Primary right-side action — typically a Button */
  primaryAction?: React.ReactNode;
  /** Override icon background (defaults to hsl(var(--accent))) */
  iconBg?: string;
  /** Override icon color (defaults to hsl(var(--primary))) */
  iconColor?: string;
  /** Optional tabs row rendered inside the same header chrome,
      sitting on the bottom border so the active underline aligns. */
  tabs?: React.ReactNode;
}

/* ── Component ──
   Mirrors Partners' VendorsListPage page-header pattern (h-12 top-bar
   immediately above; this component renders the row beneath it with
   icon-tinted box + title + subtitle on the left and a primary action on
   the right). Uses negative margins to bleed full-width past the parent's
   horizontal padding.

   When `tabs` is provided, they render inside the same chrome at the
   bottom edge, so the tab underline indicator sits on the header's
   bottom border (HubSpot / shadcn pattern). */

export function PageHeaderWithIcon({
  icon: Icon,
  title,
  subtitle,
  primaryAction,
  iconBg = "hsl(var(--accent))",
  iconColor = "hsl(var(--primary))",
  tabs,
}: PageHeaderWithIconProps) {
  return (
    <div className="-mx-6 lg:-mx-8 -mt-6 px-6 lg:px-8 pt-3.5 bg-card border-b border-border shrink-0 mb-4">
      {/* Title row */}
      <div
        className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${tabs ? "pb-3" : "pb-3.5"}`}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: iconBg }}
          >
            <Icon className="w-4 h-4" style={{ color: iconColor }} />
          </div>
          <div className="min-w-0">
            <h1 className="font-bold text-[20px]">{title}</h1>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
        </div>
        {primaryAction && <div className="shrink-0">{primaryAction}</div>}
      </div>

      {/* Tabs row — flush with the bottom border so the active underline aligns */}
      {tabs && <div className="flex items-center -mb-px">{tabs}</div>}
    </div>
  );
}

export default PageHeaderWithIcon;
