import type { ReactNode, ComponentType, CSSProperties } from "react";
import { ChevronLeft } from "lucide-react";

interface PageHeaderProps {
  icon: ComponentType<{ className?: string; style?: CSSProperties }>;
  iconBg?: string;
  iconColor?: string;
  title: string;
  subtitle?: string;
  /** Right-aligned action buttons. */
  actions?: ReactNode;
  /** Renders inside the card, below the title row, for tabs or sub-navigation.
   *  Pass a `HeaderTabs` strip here — it brings its own top hairline. */
  bottomSlot?: ReactNode;
  /** When provided, renders a back button before the icon. */
  onBack?: () => void;
  /** Accessible label for the back button. */
  backLabel?: string;
}

/** Shared page header used by listing pages (User Access Control, Items Library, …).
 *
 *  Card design ported from the Partner Detail page header (Partner Management,
 *  `VendorDetailsPage.tsx:730`): a rounded-xl white card with a #E2E8F0 border
 *  and `shadow-sm`, a single 12px/16px content row, and 44px rounded-xl back
 *  button + icon tile. `overflow-hidden` lets a `bottomSlot` tab strip run flush
 *  to the card's edges with its underline clipped by the corner radius. */
export function PageHeader({
  icon: Icon,
  iconBg = "#EDF4FF",
  iconColor = "#007FFF",
  title,
  subtitle,
  actions,
  bottomSlot,
  onBack,
  backLabel = "Back",
}: PageHeaderProps) {
  return (
    <div className="shrink-0 px-6 lg:px-8 pt-4">
      <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden shadow-sm">
        <div
          className="flex items-center justify-between gap-4"
          style={{ padding: "12px 16px" }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                aria-label={backLabel}
                className="w-11 h-11 rounded-xl border border-[#E2E8F0] bg-white hover:bg-slate-50 flex items-center justify-center shrink-0 cursor-pointer shadow-[0_1px_3px_0_rgba(0,0,0,0.04),0_1px_2px_-1px_rgba(0,0,0,0.03)] transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-slate-400" />
              </button>
            )}
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border border-white shadow-[0_1px_3px_0_rgba(0,0,0,0.06),0_0_0_2px_rgba(10,119,255,0.10)]"
              style={{ backgroundColor: iconBg }}
            >
              <Icon className="w-5 h-5" style={{ color: iconColor }} />
            </div>
            <div className="min-w-0">
              <h1
                className="text-[#0F172A] truncate"
                style={{ fontSize: "16px", fontWeight: 700, lineHeight: "22px" }}
              >
                {title}
              </h1>
              {subtitle && (
                <p
                  className="text-[12px] text-slate-500 leading-[1.6]"
                  style={{ marginTop: 6 }}
                >
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          {actions && (
            <div className="flex items-center gap-2 shrink-0">{actions}</div>
          )}
        </div>
        {bottomSlot}
      </div>
    </div>
  );
}
