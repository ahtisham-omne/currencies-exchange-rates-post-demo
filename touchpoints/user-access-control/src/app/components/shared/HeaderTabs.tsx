import type { ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import { cn } from "../ui/utils";
import { Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip";

export interface HeaderTabDef<K extends string = string> {
  id: K;
  label: string;
  /** Appends the external-link glyph, for tabs that open another module. */
  external?: boolean;
  /** Locks the tab: it still renders in place, but takes no click and shows the
   *  not-allowed cursor, matching how the sidebar renders a locked module. */
  disabled?: boolean;
  /** Hover copy for a locked tab, rendered in the white tooltip. */
  disabledTooltip?: string;
}

interface HeaderTabsProps<K extends string> {
  tabs: readonly HeaderTabDef<K>[];
  value: K;
  onChange: (id: K) => void;
  /** Active text + underline colour. Defaults to the Omne blue. */
  accent?: string;
}

const DEFAULT_ACCENT = "#0A77FF";

/** White tooltip used for locked tabs. Same container treatment as the
 *  "Imports Coming Soon" tooltip on the Data Imports module cards. */
function LockedTabTooltip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      {/* Drops below the strip: the strip sits on the header card's bottom
          edge, so a top-side tooltip would cover the page subtitle. */}
      <TooltipContent
        side="bottom"
        sideOffset={8}
        className="bg-white text-[#0F172A] border border-[#E2E8F0] text-[13px] px-3 py-2 rounded-lg shadow-[0_8px_24px_-8px_rgba(15,23,42,0.18),0_2px_6px_-2px_rgba(15,23,42,0.06)]"
        style={{ fontWeight: 500 }}
      >
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

/** Tab strip that sits at the bottom of a page-header card.
 *
 *  Ported verbatim from the Partner Detail page header (Partner Management,
 *  `VendorDetailsPage.tsx:939`): a #F1F5F9 hairline on top of the strip — one
 *  step lighter than the card's own #E2E8F0 border, which is what makes it read
 *  as a subtle divider — and a 2px bottom border per tab that doubles as the
 *  active indicator. Inactive tabs reserve the same 2px in transparent, so
 *  nothing shifts when the selection moves. The strip scrolls horizontally with
 *  the scrollbar suppressed; the parent card's `overflow-hidden rounded-xl`
 *  clips the first and last underline against the corner radius. */
export function HeaderTabs<K extends string>({
  tabs,
  value,
  onChange,
  accent = DEFAULT_ACCENT,
}: HeaderTabsProps<K>) {
  return (
    <div className="flex items-center gap-0 overflow-x-auto scrollbar-hide border-t border-[#F1F5F9] px-4 lg:px-5">
      {tabs.map((tab) => {
        const isActive = value === tab.id;
        /* Locked tabs keep their place and their label untouched — only the
         * click and the hover affordance are withheld. The native `disabled`
         * attribute is deliberately NOT set, so the tab still receives the
         * pointer events its tooltip needs. */
        const button = (
          <button
            key={tab.id}
            type="button"
            onClick={tab.disabled ? undefined : () => onChange(tab.id)}
            aria-disabled={tab.disabled || undefined}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex items-center gap-1.5 border-b-2 transition-all duration-200 whitespace-nowrap",
              tab.disabled
                ? "border-transparent text-slate-500 cursor-not-allowed"
                : isActive
                  ? "cursor-pointer"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 cursor-pointer",
            )}
            style={{
              padding: "10px 14px",
              fontSize: 13,
              fontWeight: isActive ? 600 : 400,
              ...(isActive && !tab.disabled ? { borderBottomColor: accent, color: accent } : {}),
            }}
          >
            {tab.label}
            {tab.external && <ExternalLink className="w-3 h-3 opacity-70" />}
          </button>
        );

        if (tab.disabled && tab.disabledTooltip) {
          return (
            <LockedTabTooltip key={tab.id} label={tab.disabledTooltip}>
              {button}
            </LockedTabTooltip>
          );
        }
        return button;
      })}
    </div>
  );
}
