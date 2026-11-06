/**
 * Shared detail-page tab strip — Partner Management `VendorDetailsPage`
 * parity. Used by Quote and Sales Order detail pages so typography,
 * spacing, hover, and the morph-on-scroll behaviour are identical
 * across the suite.
 *
 * Spec (matches Partner exactly, line-for-line):
 * - Container: `flex items-center gap-0 overflow-x-auto scrollbar-hide border-t border-muted px-4 lg:px-5`
 * - Per-tab button base: `flex items-center gap-1.5 px-3.5 border-b-2 transition-all duration-200 whitespace-nowrap cursor-pointer`
 * - Active: `border-primary text-primary`
 * - Inactive: `border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300`
 * - Inline style (morphs with `isScrolled`):
 *     padding: 8/14 when scrolled, 10/14 when at top
 *     fontSize: 12 when scrolled, 13 when at top
 *     fontWeight: 600 active, 400 inactive
 *     transition: padding 250ms + font-size 250ms ease
 *
 * Per-tab count pills were intentionally dropped — the labels alone
 * read cleaner across the strip, and the in-tab content already
 * surfaces its own count where useful (e.g. line count inside Line
 * Items). Partner's own tab strip also renders labels-only.
 */
import type { ReactNode } from "react";

export interface DetailTab<TId extends string = string> {
  id: TId;
  label: string;
  /** Optional trailing slot (e.g. external-link arrow) rendered after the label. */
  trailing?: ReactNode;
}

interface DetailTabStripProps<TId extends string> {
  tabs: DetailTab<TId>[];
  activeId: TId;
  onSelect: (id: TId) => void;
  /** Drives the morph between full-height and compact tab rows.
   *  Mirrors Partner's `isScrolled` flag from its IntersectionObserver. */
  isScrolled?: boolean;
}

export function DetailTabStrip<TId extends string>({
  tabs,
  activeId,
  onSelect,
  isScrolled = false,
}: DetailTabStripProps<TId>) {
  return (
    <div className="flex items-center gap-0 overflow-x-auto scrollbar-hide border-t border-muted px-4 lg:px-5">
      {tabs.map((tab) => {
        const isActive = activeId === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onSelect(tab.id)}
            className={`flex items-center gap-1.5 px-3.5 border-b-2 transition-all duration-200 whitespace-nowrap cursor-pointer ${
              isActive
                ? "border-primary text-primary"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            }`}
            style={{
              padding: isScrolled ? "8px 14px" : "10px 14px",
              fontSize: isScrolled ? 12 : 13,
              fontWeight: isActive ? 600 : 400,
              transition: "padding 250ms ease, font-size 250ms ease",
            }}
          >
            {tab.label}
            {tab.trailing}
          </button>
        );
      })}
    </div>
  );
}
