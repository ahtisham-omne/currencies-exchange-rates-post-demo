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
} from "lucide-react";
import { FONT } from "./designTokens";
import { PX, TAB_NAV } from "../../config/responsive-guidelines";

/* ── Tab Definition ── */

export interface POTab {
  id: string;
  label: string;
  icon: React.ElementType;
  count?: number;
}

export const PO_DETAIL_TABS: POTab[] = [
  { id: "items", label: "Items", icon: ShoppingBag },
  { id: "receiving-docs", label: "Receiving Docs", icon: ClipboardList },
  { id: "invoices-payments", label: "Invoices & Payments", icon: FileText },
  { id: "communications", label: "Communications", icon: MessageCircle },
  { id: "versions", label: "Versions", icon: GitBranch },
  { id: "notes", label: "Notes", icon: StickyNote },
  { id: "comments", label: "Comments", icon: MessageSquare },
  { id: "recent-activities", label: "Recent Activities", icon: Activity },
];

/* ═══════════════════════════════════════════════════════════════
   PO DETAIL TABS — Underline-style tab bar (Quotes Detail V6.5)
   ═══════════════════════════════════════════════════════════════ */

interface PODetailTabsProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
  counts?: Record<string, number>;
}

export default function PODetailTabs({
  activeTab,
  onTabChange,
  counts = {},
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

  return (
    <div style={{ fontFamily: FONT }}>
      <div className={PX}>
        <div className="max-w-[1520px] mx-auto">
          <div
            ref={containerRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className={`flex items-center border-b border-border ${TAB_NAV}`}
            role="tablist"
            aria-label="Purchase order detail tabs"
            style={{ gap: 0, cursor: 'grab', scrollbarWidth: 'none' as any }}
          >
            {PO_DETAIL_TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              const count = counts[tab.id];

              return (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`tabpanel-${tab.id}`}
                  className="flex items-center whitespace-nowrap shrink-0 transition-colors duration-150 relative"
                  style={{
                    gap: 5,
                    padding: '8px 16px 10px',
                    color: isActive ? 'var(--primary)' : 'var(--muted-foreground)',
                    fontSize: 'var(--text-caption, 13px)',
                    fontWeight: isActive ? 600 : 500,
                    lineHeight: 1,
                    cursor: 'pointer',
                    background: 'transparent',
                    border: 'none',
                    fontFamily: FONT,
                  }}
                  onClick={() => {
                    if (dragMoved.current) return;
                    onTabChange(tab.id);
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.color = 'var(--foreground)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.color = 'var(--muted-foreground)';
                  }}
                >
                  {tab.label}

                  {/* Count badge */}
                  {count !== undefined && count > 0 && (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        lineHeight: 1,
                        color: isActive ? 'var(--primary)' : 'var(--muted-foreground)',
                        backgroundColor: isActive
                          ? 'color-mix(in srgb, var(--primary) 10%, transparent)'
                          : 'color-mix(in srgb, var(--muted-foreground) 10%, transparent)',
                        padding: '3px 6px',
                        borderRadius: 5,
                        minWidth: 18,
                        textAlign: 'center' as const,
                      }}
                    >
                      {count}
                    </span>
                  )}

                  {/* Active underline indicator */}
                  {isActive && (
                    <span
                      className="absolute bottom-0 left-4 right-4"
                      style={{
                        height: 2,
                        backgroundColor: 'var(--primary)',
                        borderRadius: '1px 1px 0 0',
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
