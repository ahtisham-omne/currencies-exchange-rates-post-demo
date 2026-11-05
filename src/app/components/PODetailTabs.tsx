import React, { useRef, useCallback } from "react";
import {
  ShoppingBag,
  FileText,
  MessageSquare,
  ClipboardList,
  Activity,
  MessageCircle,
  GitBranch,
  StickyNote,
  Paperclip,
} from "lucide-react";
import { FONT } from "./designTokens";
import { TAB_NAV } from "../../config/responsive-guidelines";

/* ── Tab Definition ── */

export interface POTab {
  id: string;
  label: string;
  icon: React.ElementType;
}

export const PO_DETAIL_TABS: POTab[] = [
  { id: "items", label: "Items", icon: ShoppingBag },
  { id: "receiving-docs", label: "Receiving Docs", icon: ClipboardList },
  { id: "invoices-payments", label: "Invoices & Payments", icon: FileText },
  { id: "communications", label: "Communications", icon: MessageCircle },
  { id: "versions", label: "Versions", icon: GitBranch },
  { id: "notes", label: "Notes", icon: StickyNote },
  { id: "comments", label: "Comments", icon: MessageSquare },
  { id: "attachments", label: "Attachments", icon: Paperclip },
  { id: "recent-activities", label: "Recent Activities", icon: Activity },
];

/* ═══════════════════════════════════════════════════════════════
   PO DETAIL TABS — Underline-style tab bar (Quotes Detail V6.5)
   ═══════════════════════════════════════════════════════════════ */

interface PODetailTabsProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
  /** Scroll-morphed compact variant. Matches Partners' tab-bar morph
   *  (`Partners/.../VendorDetailsPage.tsx:940-941`): padding `8px 14px`
   *  and fontSize `12` when scrolled (expanded values: `10px 14px` / `13`). */
  compact?: boolean;
}

export default function PODetailTabs({
  activeTab,
  onTabChange,
  compact = false,
}: PODetailTabsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const dragMoved = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true;
    dragMoved.current = false;
    startX.current = e.pageX;
    scrollLeft.current = containerRef.current?.scrollLeft || 0;
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current || !containerRef.current) return;
    const dx = e.pageX - startX.current;
    if (Math.abs(dx) > 3) dragMoved.current = true;
    containerRef.current.scrollLeft = scrollLeft.current - dx;
  }, []);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  // 1:1 port of Partners' tab bar recipe (`Partners/.../VendorDetailsPage.tsx:920-951`).
  // The outer PX/max-width wrapping is supplied by the parent header card, so this
  // component renders only the tablist itself. Recipe choices that mirror Partners
  // verbatim:
  //   - Container: `gap-0 overflow-x-auto scrollbar-hide border-t border-muted px-4 lg:px-5`
  //     (`border-muted` is the softer divider; `border-border` was a hair too dark.)
  //   - Tab button uses its own `border-b-2` as the active/hover indicator —
  //     no absolute-positioned span overlay. Hover lights up the bottom border to
  //     `border-slate-300`, telegraphing "this tab can become active."
  //   - Literal `text-slate-500` / `text-slate-700` for inactive + hover (Partners
  //     hard-codes these instead of going through `--muted-foreground`).
  //   - Transition `transition-all duration-200`.
  //   - No `lineHeight: 1` override — inherits the body line-height so the underline
  //     sits with the same baseline as Partners.
  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      className={`flex items-center gap-0 overflow-x-auto scrollbar-hide border-t border-muted px-4 lg:px-5 ${TAB_NAV}`}
      role="tablist"
      aria-label="Purchase order detail tabs"
      style={{ cursor: 'grab', fontFamily: FONT }}
    >
      {PO_DETAIL_TABS.map((tab) => {
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            aria-controls={`tabpanel-${tab.id}`}
            className={`flex items-center gap-1.5 border-b-2 whitespace-nowrap shrink-0 cursor-pointer ${
              isActive
                ? "border-primary text-primary"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            }`}
            style={{
              // Partners ladder: expanded `10px 14px` / 13px → compact `8px 14px` / 12px
              // (`Partners/.../VendorDetailsPage.tsx:940-943`). The morph is inline-style
              // driven so padding + fontSize + colour + border-color all animate on the
              // same 250ms curve as the rest of the title row.
              padding: compact ? '8px 14px' : '10px 14px',
              fontSize: compact ? 12 : 13,
              fontWeight: isActive ? 600 : 400,
              background: 'transparent',
              fontFamily: FONT,
              transition: 'all 250ms cubic-bezier(0.4, 0, 0.2, 1)',
            }}
            onClick={() => {
              if (dragMoved.current) return;
              onTabChange(tab.id);
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
