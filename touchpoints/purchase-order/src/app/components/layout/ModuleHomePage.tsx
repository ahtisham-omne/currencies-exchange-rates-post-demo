import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  GripVertical,
  RotateCcw,
  ExternalLink,
  Save,
  ArrowRight,
} from "lucide-react";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend, getEmptyImage } from "react-dnd-html5-backend";
import { useDragLayer } from "react-dnd";
import { toast } from "sonner";
import { FONT } from "../designTokens";
import {
  DASHBOARD_PADDING,
  PAGE_HEADER_FLEX,
  SIDE_BY_SIDE,
} from "../../../config/responsive-guidelines";

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

interface DragItem {
  index: number;
  module: ModuleCardItem;
  width?: number;
}

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
    <div className="px-3.5 pt-3 pb-3.5">
      {/* Icon row */}
      <div className="flex items-start mb-2.5">
        <div
          className="flex items-center justify-center size-8 rounded-[8px]"
          style={{ backgroundColor: module.iconBg }}
        >
          <Icon
            className="size-4"
            strokeWidth={1.33}
            style={{ color: module.iconColor }}
          />
        </div>
      </div>
      {/* Title + badge row */}
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className="text-foreground" style={st.cardTitle}>
          {module.title}
        </span>
        {module.badge && (
          <span
            className="inline-flex items-center rounded-full px-1.5 py-px shrink-0"
            style={{
              fontSize: "10px",
              fontWeight: "var(--font-weight-medium)",
              lineHeight: "14px",
              fontFamily: FONT,
              backgroundColor: "var(--secondary)",
              color: "var(--muted-foreground)",
            }}
          >
            {module.badge}
          </span>
        )}
      </div>
      {/* Description */}
      <span className="text-muted-foreground" style={st.cardDesc}>
        {module.description}
      </span>
    </div>
  );
}

/* ── Custom Drag Layer — renders the card following the cursor ── */
function CustomDragLayer() {
  const { itemType, isDragging, item, currentOffset } = useDragLayer(
    (monitor) => ({
      item: monitor.getItem() as DragItem | null,
      itemType: monitor.getItemType(),
      currentOffset: monitor.getSourceClientOffset(),
      isDragging: monitor.isDragging(),
    })
  );

  if (!isDragging || itemType !== DND_TYPE || !currentOffset || !item?.module) {
    return null;
  }

  return (
    <div
      style={{
        position: "fixed",
        pointerEvents: "none",
        zIndex: 9999,
        left: 0,
        top: 0,
        width: "100%",
        height: "100%",
      }}
    >
      <div
        style={{
          transform: `translate(${currentOffset.x}px, ${currentOffset.y}px)`,
          width: item.width ?? 300,
        }}
      >
        <div
          className="rounded-[12px] border border-primary/30"
          style={{
            backgroundColor: "var(--card)",
            boxShadow: "var(--elevation-drag)",
            transform: "rotate(1.5deg) scale(1.02)",
            transition: "none",
          }}
        >
          <ModuleCardContent module={item.module} />
        </div>
      </div>
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

  const [{ isDragging }, drag, dragPreview] = useDrag(
    () => ({
      type: DND_TYPE,
      item: () => ({
        index,
        module,
        width: ref.current?.getBoundingClientRect().width ?? 300,
      }),
      canDrag: draggable,
      collect: (m) => ({ isDragging: m.isDragging() }),
    }),
    [index, module, draggable]
  );

  const [, drop] = useDrop(
    () => ({
      accept: DND_TYPE,
      hover(item: { index: number }, monitor) {
        if (!ref.current) return;
        const dragIndex = item.index;
        const hoverIndex = index;
        if (dragIndex === hoverIndex) return;

        const hoverBoundingRect = ref.current.getBoundingClientRect();
        const clientOffset = monitor.getClientOffset();
        if (!clientOffset) return;

        // For grid layouts we need both axes
        const hoverMiddleX =
          (hoverBoundingRect.right - hoverBoundingRect.left) / 2;
        const hoverMiddleY =
          (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
        const hoverClientX = clientOffset.x - hoverBoundingRect.left;
        const hoverClientY = clientOffset.y - hoverBoundingRect.top;

        // Determine if the two cards sit on the same visual row
        const sameRow =
          Math.abs(hoverBoundingRect.top + hoverMiddleY - clientOffset.y) <
          hoverMiddleY * 1.2;

        if (sameRow) {
          // Horizontal neighbours — use X threshold
          if (dragIndex < hoverIndex && hoverClientX < hoverMiddleX) return;
          if (dragIndex > hoverIndex && hoverClientX > hoverMiddleX) return;
        } else {
          // Different rows — use Y threshold
          if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) return;
          if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) return;
        }

        moveCard(dragIndex, hoverIndex);
        item.index = hoverIndex;
      },
    }),
    [index, moveCard]
  );

  // Suppress the default HTML5 drag ghost
  useEffect(() => {
    dragPreview(getEmptyImage(), { captureDraggingState: true });
  }, [dragPreview]);

  // Canonical react-dnd pattern: combine drag + drop on a single ref.
  // This is called during render so that by the time the layout effects
  // inside useRegisteredDragSource / useRegisteredDropTarget fire
  // (which call connector.receiveHandlerId → reconnect), the
  // connector already has a ref whose .current is the DOM node
  // (set during the previous commit, or on first mount after commit).
  drag(drop(ref));

  return (
    <div
      ref={ref}
      className={`group relative rounded-[12px] border cursor-pointer transition-all duration-200 ease-out w-full ${
        isDragging
          ? "border-dashed border-primary/40 shadow-none"
          : "border-border hover:shadow-elevation-sm hover:-translate-y-0.5 hover:border-primary/20"
      }`}
      style={{
        backgroundColor: isDragging ? "var(--primary-tint)" : "var(--card)",
        opacity: isDragging ? 0.55 : 1,
      }}
      onClick={() => !isDragging && navigate(module.path)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") navigate(module.path);
      }}
    >
      {/* "Open →" link — visible on hover, top-right */}
      {!isDragging && (
        <div
          className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10"
          style={{ color: "var(--primary)" }}
        >
          <span style={st.cardOpenLink}>Open</span>
          <ArrowRight className="size-3" strokeWidth={2} />
        </div>
      )}

      {/* Drag handle indicator — visual only, bottom-right */}
      {draggable && !isDragging && (
        <div
          className="absolute bottom-3 right-3 flex items-center justify-center size-6 rounded-[var(--radius-sm)] opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing hover:bg-secondary z-10"
        >
          <GripVertical
            className="size-3.5 text-muted-foreground"
            strokeWidth={1.5}
          />
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

  return (
    <button
      className={`group flex items-center gap-3 rounded-[12px] border border-border pl-[15px] pr-1 py-1 text-left transition-all duration-200 ease-out cursor-pointer focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none w-full hover:shadow-elevation-sm hover:-translate-y-0.5 hover:border-primary/20 h-[62px] ${action.disabled ? "opacity-60" : ""}`}
      style={{ backgroundColor: "var(--card)" }}
      onClick={() => {
        if (action.onClick) action.onClick();
        else if (action.path) navigate(action.path);
      }}
    >
      <div
        className="flex items-center justify-center size-8 rounded-[8px] shrink-0"
        style={{
          backgroundColor: action.iconBg,
        }}
      >
        <Icon
          className="size-4"
          strokeWidth={1.33}
          style={{ color: action.iconColor }}
        />
      </div>
      <div className="flex flex-col min-w-0 flex-1">
        <span className="text-foreground truncate" style={st.actionTitle}>
          {action.title}
        </span>
        <span className="text-muted-foreground truncate" style={st.actionDesc}>
          {action.description}
        </span>
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
    <div className="flex flex-col gap-2.5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground" style={st.sectionTitle}>
          Recent Activity
        </span>
        {onViewMore && (
          <button
            className="text-primary hover:underline cursor-pointer"
            style={st.viewMore}
            onClick={onViewMore}
          >
            View more
          </button>
        )}
      </div>

      {/* List in a card */}
      <div
        className="rounded-[12px] border border-border overflow-hidden"
        style={{ backgroundColor: "var(--card)" }}
      >
        {items.map((item, idx) => (
          <div
            key={item.id}
            className={`flex items-center gap-2.5 px-3.5 transition-colors hover:bg-secondary/50 cursor-pointer ${idx < items.length - 1 ? "border-b border-border" : ""}`}
            style={{ height: "40.5px" }}
          >
            <span
              className="size-1.5 rounded-full shrink-0"
              style={{ backgroundColor: item.dotColor }}
            />
            <span
              className="text-foreground flex-1 truncate min-w-0"
              style={st.activityText}
            >
              {item.label}
            </span>
            <span
              className="text-muted-foreground shrink-0"
              style={st.activityTime}
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
      ? "md:grid-cols-2"
      : gridCols === 4
        ? "sm:grid-cols-2 lg:grid-cols-4"
        : "md:grid-cols-2 lg:grid-cols-3 3xl:grid-cols-4";

  return (
    <DndProvider backend={HTML5Backend}>
      <CustomDragLayer />
      <div
        className="flex-1 overflow-y-auto"
        style={{ backgroundColor: "var(--secondary)" }}
      >
        <div className={`mx-auto max-w-[1440px] ${DASHBOARD_PADDING}`}>
          {/* ── Page Header ── */}
          <div className={`${PAGE_HEADER_FLEX} md:items-start pb-4`}>
            <div className="flex flex-col gap-0.5 min-w-0">
              <h2 className="text-foreground" style={st.pageTitle}>
                {pageTitle}
              </h2>
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-muted-foreground" style={st.pageSub}>
                  {pageSubtitle}
                </span>
                {learnMoreUrl && (
                  <a
                    href={learnMoreUrl}
                    className="inline-flex items-center gap-1 text-primary hover:underline shrink-0"
                    style={st.learnMore}
                  >
                    Learn more{" "}
                    <ExternalLink className="size-3" strokeWidth={1.5} />
                  </a>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {headerActions}
              {draggable && (
                <>
                  {/* Save Layout button — shown when there's a pending drag change */}
                  {pendingOrder && (
                    <button
                      onClick={saveLayout}
                      className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] px-3 py-1.5 text-primary-foreground transition-colors cursor-pointer shrink-0"
                      style={{
                        ...st.resetBtn,
                        backgroundColor: "var(--primary)",
                      }}
                    >
                      <Save className="size-3" strokeWidth={1.5} /> Save
                      Layout
                    </button>
                  )}
                  <button
                    onClick={resetOrder}
                    className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-border px-3 py-1.5 text-muted-foreground hover:bg-secondary transition-colors cursor-pointer shrink-0"
                    style={st.resetBtn}
                  >
                    <RotateCcw className="size-3" strokeWidth={1.5} /> Reset
                  </button>
                </>
              )}
            </div>
          </div>

          {/* ── Content ── */}
          <div className="flex flex-col gap-6">
            {/* Module Cards */}
            <section>
              <div className="mb-2.5">
                <span className="text-muted-foreground" style={st.sectionTitle}>
                  {modulesSectionTitle}
                </span>
              </div>
              <div className={`grid grid-cols-1 ${gridClass} gap-2.5`}>
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
            </section>

            {/* Recommended Actions + Recent Activity */}
            {(quickActions || recentActivity) && (
              <section className={SIDE_BY_SIDE}>
                {quickActions && quickActions.length > 0 && (
                  <div className="flex-1 lg:flex-[2]">
                    <div className="mb-2.5">
                      <span
                        className="text-muted-foreground"
                        style={st.sectionTitle}
                      >
                        {quickActionsSectionTitle}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {quickActions.map((action) => (
                        <QuickActionCard key={action.id} action={action} />
                      ))}
                    </div>
                  </div>
                )}
                {recentActivity && recentActivity.length > 0 && (
                  <div className="flex-1">
                    <ActivityFeed
                      items={recentActivity}
                      onViewMore={onViewMoreActivity}
                    />
                  </div>
                )}
              </section>
            )}

            {/* Optional bottom section */}
            {bottomSection}
          </div>
        </div>
      </div>
    </DndProvider>
  );
}