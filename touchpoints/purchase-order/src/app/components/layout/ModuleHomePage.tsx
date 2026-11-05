import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  RotateCcw,
  ExternalLink,
  Save,
  ArrowRight,
} from "lucide-react";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { toast } from "sonner";
import { FONT } from "../designTokens";

/* ═══════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════ */

export interface ModuleCardItem {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  path: string;
  enabled?: boolean;
  badge?: string;
}

export interface QuickActionItem {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  path?: string;
  onClick?: () => void;
  disabled?: boolean;
}

export interface ActivityItem {
  id: string;
  label: string;
  time: string;
  dotColor: string;
}

export interface ModuleHomePageProps {
  pageTitle: string;
  pageSubtitle: string;
  learnMoreUrl?: string;
  modules: ModuleCardItem[];
  modulesSectionTitle?: string;
  gridCols?: 2 | 3 | 4;
  storageKey: string;
  draggable?: boolean;
  quickActions?: QuickActionItem[];
  quickActionsSectionTitle?: string;
  recentActivity?: ActivityItem[];
  onViewMoreActivity?: () => void;
  bottomSection?: React.ReactNode;
  headerActions?: React.ReactNode;
}

/* ═══════════════════════════════════════════════════════════════
   TYPOGRAPHY — matched to Figma design
   ═══════════════════════════════════════════════════════════════ */

const st = {
  pageTitle: {
    fontSize: "24px",
    fontWeight: "var(--font-weight-semibold)",
    lineHeight: "32px",
    fontFamily: FONT,
    letterSpacing: "-0.24px",
  } as React.CSSProperties,
  pageSub: {
    fontSize: "var(--text-label)",
    fontWeight: "var(--font-weight-normal)",
    lineHeight: "20px",
    fontFamily: FONT,
  } as React.CSSProperties,
  sectionTitle: {
    fontSize: "var(--text-label)",
    fontWeight: "var(--font-weight-medium)",
    lineHeight: "20px",
    fontFamily: FONT,
    letterSpacing: "-0.14px",
  } as React.CSSProperties,
  cardTitle: {
    fontSize: "13px",
    fontWeight: "var(--font-weight-medium)",
    lineHeight: "18px",
    fontFamily: FONT,
  } as React.CSSProperties,
  cardDesc: {
    fontSize: "11px",
    fontWeight: "var(--font-weight-normal)",
    lineHeight: "15px",
    fontFamily: FONT,
  } as React.CSSProperties,
  cardOpenLink: {
    fontSize: "12px",
    fontWeight: "var(--font-weight-medium)",
    lineHeight: "16px",
    fontFamily: FONT,
  } as React.CSSProperties,
  actionTitle: {
    fontSize: "13px",
    fontWeight: "var(--font-weight-medium)",
    lineHeight: "19.5px",
    fontFamily: FONT,
  } as React.CSSProperties,
  actionDesc: {
    fontSize: "11px",
    fontWeight: "var(--font-weight-medium)",
    lineHeight: "16.5px",
    fontFamily: FONT,
  } as React.CSSProperties,
  activityText: {
    fontSize: "13px",
    fontWeight: "var(--font-weight-normal)",
    lineHeight: "19.5px",
    fontFamily: FONT,
  } as React.CSSProperties,
  activityTime: {
    fontSize: "11px",
    fontWeight: "var(--font-weight-normal)",
    lineHeight: "16.5px",
    fontFamily: FONT,
  } as React.CSSProperties,
  learnMore: {
    fontSize: "var(--text-label)",
    fontWeight: "var(--font-weight-medium)",
    lineHeight: "20px",
    fontFamily: FONT,
  } as React.CSSProperties,
  resetBtn: {
    fontSize: "12px",
    fontWeight: "var(--font-weight-medium)",
    lineHeight: "16px",
    fontFamily: FONT,
  } as React.CSSProperties,
  viewMore: {
    fontSize: "12px",
    fontWeight: "var(--font-weight-medium)",
    lineHeight: "16px",
    fontFamily: FONT,
  } as React.CSSProperties,
};

/* ═══════════════════════════════════════════════════════════════
   DND MODULE CARD — matches Figma card style with "Open →" hover
   ═══════════════════════════════════════════════════════════════ */

const DND_TYPE = "MODULE_CARD";

interface DndModuleCardProps {
  module: ModuleCardItem;
  index: number;
  moveCard: (dragIndex: number, hoverIndex: number) => void;
  draggable: boolean;
}

/* ── Static card renderer (shared by card + drag layer) ── */
function ModuleCardContent({ module }: { module: ModuleCardItem }) {
  const Icon = module.icon;
  return (
    <div className="px-3.5 pt-3 pb-3">
      {/* Icon */}
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center mb-2"
        style={{ backgroundColor: module.iconBg }}
      >
        <Icon className="w-4 h-4" style={{ color: module.iconColor }} />
      </div>
      {/* Title + badge row */}
      <div className="flex items-center gap-1.5 mb-0.5">
        <p className="text-[13px]" style={{ fontWeight: 500, fontFamily: FONT }}>
          {module.title}
        </p>
        {module.badge && (
          <span
            className="inline-flex items-center rounded-full px-1.5 py-px shrink-0 bg-muted text-muted-foreground"
            style={{
              fontSize: "10px",
              fontWeight: 500,
              lineHeight: "14px",
              fontFamily: FONT,
            }}
          >
            {module.badge}
          </span>
        )}
      </div>
      {/* Description */}
      <p
        className="text-[11px] text-muted-foreground leading-relaxed"
        style={{ fontFamily: FONT }}
      >
        {module.description}
      </p>
    </div>
  );
}

function DndModuleCard({
  module,
  index,
  moveCard,
  draggable,
}: DndModuleCardProps) {
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);

  const [{ isDragging }, drag, preview] = useDrag(
    () => ({
      type: DND_TYPE,
      item: () => ({ index, module }),
      canDrag: draggable,
      collect: (m) => ({ isDragging: m.isDragging() }),
    }),
    [index, module, draggable]
  );

  const [{ isOver }, drop] = useDrop(
    () => ({
      accept: DND_TYPE,
      collect: (monitor) => ({ isOver: monitor.isOver() }),
      hover(item: { index: number }, monitor) {
        if (!ref.current) return;
        const dragIndex = item.index;
        const hoverIndex = index;
        if (dragIndex === hoverIndex) return;
        const hoverRect = ref.current.getBoundingClientRect();
        const hoverMiddleX = (hoverRect.right - hoverRect.left) / 2;
        const hoverMiddleY = (hoverRect.bottom - hoverRect.top) / 2;
        const clientOffset = monitor.getClientOffset();
        if (!clientOffset) return;
        const hoverClientX = clientOffset.x - hoverRect.left;
        const hoverClientY = clientOffset.y - hoverRect.top;
        if (
          dragIndex < hoverIndex &&
          hoverClientY < hoverMiddleY &&
          hoverClientX < hoverMiddleX
        )
          return;
        if (
          dragIndex > hoverIndex &&
          hoverClientY > hoverMiddleY &&
          hoverClientX > hoverMiddleX
        )
          return;
        moveCard(dragIndex, hoverIndex);
        item.index = hoverIndex;
      },
    }),
    [index, moveCard]
  );

  // Partners pattern: preview = card itself + drop target; drag = same ref
  preview(drop(ref));
  drag(ref);

  // Track mouse-down position so we can distinguish a click from a drag.
  // Without this, react-dnd may fire onClick at the end of a drag attempt,
  // causing the card to navigate when the user only meant to reorder.
  const mouseDownPos = useRef<{ x: number; y: number } | null>(null);
  const handleMouseDown = (e: React.MouseEvent) => {
    mouseDownPos.current = { x: e.clientX, y: e.clientY };
  };
  const handleClick = (e: React.MouseEvent) => {
    const start = mouseDownPos.current;
    mouseDownPos.current = null;
    if (isDragging) return;
    if (!start) return;
    const dx = Math.abs(e.clientX - start.x);
    const dy = Math.abs(e.clientY - start.y);
    if (dx < 5 && dy < 5) navigate(module.path);
  };

  return (
    <div
      ref={ref}
      className={`group/card relative bg-card border rounded-xl transition-all duration-200 ease-out w-full ${
        isDragging
          ? "border-dashed border-primary/40 bg-primary/[0.02] opacity-40 pointer-events-none"
          : isOver
          ? "border-primary/40 bg-primary/[0.04] shadow-[0_0_0_2px_rgba(10,119,255,0.10)] scale-[1.02] cursor-pointer active:cursor-grabbing"
          : "border-border hover:shadow-md hover:border-primary/20 cursor-pointer active:cursor-grabbing"
      }`}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") navigate(module.path);
      }}
    >
      {/* Drop-zone preview overlay */}
      {isOver && !isDragging && (
        <div className="absolute inset-0 rounded-xl bg-primary/[0.03] pointer-events-none" />
      )}

      {/* "Open →" link — visible on hover, top-right */}
      {!isDragging && !isOver && (
        <div className="absolute top-2.5 right-2.5 flex items-center gap-2 opacity-0 group-hover/card:opacity-100 transition-opacity z-10">
          <span
            className="inline-flex items-center gap-0.5 text-[11px]"
            style={{ color: "hsl(var(--primary))", fontWeight: 500, fontFamily: FONT }}
          >
            Open
            <ArrowRight className="w-3 h-3" />
          </span>
        </div>
      )}

      {/* Card content */}
      <ModuleCardContent module={module} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   QUICK ACTION CARD — horizontal layout matching Figma
   ═══════════════════════════════════════════════════════════════ */

function QuickActionCard({ action }: { action: QuickActionItem }) {
  const Icon = action.icon;
  const navigate = useNavigate();
  const isInteractive = !action.disabled && (action.onClick || action.path);

  return (
    <button
      className={`flex items-center gap-3 bg-card border border-border rounded-xl px-3.5 py-3 text-left transition-all w-full ${
        isInteractive
          ? "hover:shadow-sm hover:border-primary/20 cursor-pointer"
          : "opacity-60 cursor-default"
      }`}
      onClick={() => {
        if (!isInteractive) return;
        if (action.onClick) action.onClick();
        else if (action.path) navigate(action.path);
      }}
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style={{ backgroundColor: action.iconBg }}
      >
        <Icon className="w-4 h-4" style={{ color: action.iconColor }} />
      </div>
      <div className="min-w-0">
        <p
          className="text-[13px]"
          style={{ fontWeight: 500, fontFamily: FONT }}
        >
          {action.title}
        </p>
        <p
          className="text-[11px] text-muted-foreground"
          style={{ fontFamily: FONT }}
        >
          {action.description}
        </p>
      </div>
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ACTIVITY FEED — matching Figma border-row style
   ═══════════════════════════════════════════════════════════════ */

function ActivityFeed({
  items,
  onViewMore,
}: {
  items: ActivityItem[];
  onViewMore?: () => void;
}) {
  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-2 sm:mb-2.5">
        <h4
          className="text-sm text-muted-foreground"
          style={{ fontWeight: 500, fontFamily: FONT }}
        >
          Recent Activity
        </h4>
        {onViewMore && (
          <button
            className="text-xs hover:underline cursor-pointer"
            style={{ color: "hsl(var(--primary))", fontWeight: 500, fontFamily: FONT }}
            onClick={onViewMore}
          >
            View more
          </button>
        )}
      </div>

      {/* List in a card */}
      <div className="bg-card border border-border rounded-xl divide-y divide-border">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-2.5 px-3.5 py-2.5"
          >
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ backgroundColor: item.dotColor }}
            />
            <span
              className="text-[13px] flex-1 min-w-0 truncate"
              style={{ fontFamily: FONT }}
            >
              {item.label}
            </span>
            <span
              className="text-[11px] text-muted-foreground shrink-0"
              style={{ fontWeight: 400, fontFamily: FONT }}
            >
              {item.time}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MODULE HOME PAGE
   ═══════════════════════════════════════════════════════════════ */

export default function ModuleHomePage({
  pageTitle,
  pageSubtitle,
  learnMoreUrl,
  modules,
  modulesSectionTitle = "Modules",
  gridCols = 3,
  storageKey,
  draggable = true,
  quickActions,
  quickActionsSectionTitle = "Recommended Actions",
  recentActivity,
  onViewMoreActivity,
  bottomSection,
  headerActions,
}: ModuleHomePageProps) {
  /* ── Drag-to-reorder state ── */
  const [orderedModules, setOrderedModules] =
    useState<ModuleCardItem[]>(modules);
  const [pendingOrder, setPendingOrder] = useState<string[] | null>(null);

  // Load saved order from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const savedIds: string[] = JSON.parse(saved);
        const reordered = savedIds
          .map((id) => modules.find((m) => m.id === id))
          .filter(Boolean) as ModuleCardItem[];
        const remaining = modules.filter((m) => !savedIds.includes(m.id));
        setOrderedModules([...reordered, ...remaining]);
      } else {
        setOrderedModules(modules);
      }
    } catch {
      setOrderedModules(modules);
    }
  }, [modules, storageKey]);

  const moveCard = useCallback(
    (dragIndex: number, hoverIndex: number) => {
      setOrderedModules((prev) => {
        const updated = [...prev];
        const [removed] = updated.splice(dragIndex, 1);
        updated.splice(hoverIndex, 0, removed);
        // Track pending order but don't save to localStorage yet
        setPendingOrder(updated.map((m) => m.id));
        return updated;
      });
    },
    []
  );

  const saveLayout = useCallback(() => {
    const ids = orderedModules.map((m) => m.id);
    localStorage.setItem(storageKey, JSON.stringify(ids));
    setPendingOrder(null);
    toast.success("Layout saved", {
      description: "Your module layout has been saved.",
    });
  }, [orderedModules, storageKey]);

  const resetOrder = useCallback(() => {
    localStorage.removeItem(storageKey);
    setOrderedModules(modules);
    setPendingOrder(null);
    toast.info("Layout reset", {
      description: "Module layout has been reset to default.",
    });
  }, [modules, storageKey]);

  const gridClass =
    gridCols === 2
      ? "sm:grid-cols-2"
      : gridCols === 4
        ? "sm:grid-cols-2 lg:grid-cols-4"
        : "sm:grid-cols-3 lg:grid-cols-3";

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="flex-1 overflow-y-auto bg-slate-50">
        <div className="px-4 sm:px-5 lg:px-6 py-3 sm:py-4 w-full max-w-[1120px] mx-auto">
          {/* ── Page Header ── */}
          <div className="mb-3 sm:mb-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-0.5">
              <h1 className="text-xl sm:text-2xl font-bold text-foreground min-w-0 truncate">
                {pageTitle}
              </h1>
              <div className="flex items-center gap-1.5 shrink-0">
                {headerActions}
                {draggable && (
                  <>
                    {pendingOrder && (
                      <button
                        onClick={saveLayout}
                        className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors cursor-pointer"
                        style={{ color: "hsl(var(--primary))", fontWeight: 500 }}
                      >
                        <Save className="w-3 h-3" />
                        Save Layout
                      </button>
                    )}
                    <button
                      onClick={resetOrder}
                      className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-border hover:bg-muted/40 text-muted-foreground transition-colors cursor-pointer"
                      style={{ fontWeight: 500 }}
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span className="hidden sm:inline">Reset</span>
                    </button>
                  </>
                )}
              </div>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {pageSubtitle}
              {learnMoreUrl && (
                <>
                  {" "}
                  <a
                    href={learnMoreUrl}
                    className="inline-flex items-center gap-1 text-xs sm:text-sm hover:underline"
                    style={{ color: "hsl(var(--primary))", fontWeight: 500 }}
                  >
                    Learn more
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </>
              )}
            </p>
          </div>

          {/* ── Modules Section ── */}
          <div className="mb-4 sm:mb-5">
            <h4
              className="text-sm text-muted-foreground mb-2 sm:mb-2.5"
              style={{ fontWeight: 500 }}
            >
              {modulesSectionTitle}
            </h4>
            <div className={`grid grid-cols-2 ${gridClass} gap-2.5`}>
              {orderedModules.map((mod, idx) => (
                <DndModuleCard
                  key={mod.id}
                  module={mod}
                  index={idx}
                  moveCard={moveCard}
                  draggable={draggable}
                />
              ))}
            </div>
          </div>

          {/* ── Recommended Actions + Recent Activity ── */}
          {(quickActions || recentActivity) && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-2.5">
              {quickActions && quickActions.length > 0 && (
                <div className="lg:col-span-2">
                  <h4
                    className="text-sm text-muted-foreground mb-2 sm:mb-2.5"
                    style={{ fontWeight: 500 }}
                  >
                    {quickActionsSectionTitle}
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {quickActions.map((action) => (
                      <QuickActionCard key={action.id} action={action} />
                    ))}
                  </div>
                </div>
              )}
              {recentActivity && recentActivity.length > 0 && (
                <div className="lg:col-span-1">
                  <ActivityFeed
                    items={recentActivity}
                    onViewMore={onViewMoreActivity}
                  />
                </div>
              )}
            </div>
          )}

          {/* Optional bottom section */}
          {bottomSection && <div className="mt-4">{bottomSection}</div>}
        </div>
      </div>
    </DndProvider>
  );
}