import { useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback, useRef, type ComponentType, type CSSProperties, type MouseEvent as ReactMouseEvent } from "react";
// @ts-ignore
import { DndProvider, useDrag, useDrop } from "react-dnd";
// @ts-ignore
import { HTML5Backend } from "react-dnd-html5-backend";
import { toast } from "sonner";
import {
  ShoppingCart, FileText, DollarSign, Package,
  TrendingUp, Plus, Upload, ExternalLink,
  RotateCcw, Save, ArrowRight, RefreshCw,
} from "lucide-react";
import { useSOStore } from "./store";
import { IMPORT_EXPORT_ENABLED } from "@/app/config/featureFlags";

/* ═══════════════════════════════════════════════════════════════════════════
 *  Module cards
 * ═══════════════════════════════════════════════════════════════════════════ */
interface ModuleCard {
  title: string;
  description: string;
  icon: ComponentType<{ className?: string; style?: CSSProperties }>;
  iconColor: string;
  iconBg: string;
  path: string;
  enabled: boolean;
}

const modules: ModuleCard[] = [
  {
    title: "Quotes",
    description: "Create, send, and track customer quotes.",
    icon: FileText,
    iconColor: "var(--chart-4)",
    iconBg: "var(--chart-4)",
    path: "/quotes",
    enabled: true,
  },
  {
    title: "Sales Orders",
    description: "Manage orders, allocations, and shipments.",
    icon: ShoppingCart,
    iconColor: "var(--primary)",
    iconBg: "var(--primary)",
    path: "/sales-orders",
    enabled: true,
  },
  {
    title: "Invoicing",
    description: "Generate invoices and track payments.",
    icon: DollarSign,
    iconColor: "var(--success)",
    iconBg: "var(--success)",
    path: "/invoicing",
    enabled: false,
  },
  {
    title: "Inventory Allocation",
    description: "View and manage inventory reservations.",
    icon: Package,
    iconColor: "var(--chart-3)",
    iconBg: "var(--chart-3)",
    path: "/allocation",
    enabled: false,
  },
  {
    title: "Sales Analytics",
    description: "Pipeline metrics, forecasts, and trends.",
    icon: TrendingUp,
    iconColor: "var(--primary)",
    iconBg: "var(--primary)",
    path: "/analytics",
    enabled: false,
  },
  {
    title: "Returns & Credits",
    description: "Process returns, credits, and adjustments.",
    icon: RefreshCw,
    iconColor: "var(--chart-4)",
    iconBg: "var(--chart-4)",
    path: "/returns",
    enabled: false,
  },
];

/* ═══════════════════════════════════════════════════════════════════════════
 *  Recommended actions
 * ═══════════════════════════════════════════════════════════════════════════ */
interface RecommendedAction {
  title: string;
  description: string;
  icon: ComponentType<{ className?: string; style?: CSSProperties }>;
  iconColor: string;
  iconBg: string;
  path?: string;
}

const allRecommendedActions: RecommendedAction[] = [
  {
    title: "Create Sales Order",
    description: "Start a new sales order from scratch.",
    icon: Plus,
    iconColor: "var(--primary)",
    iconBg: "var(--primary)",
    path: "/sales-orders",
  },
  {
    title: "Create Quote",
    description: "Draft a new customer quote.",
    icon: FileText,
    iconColor: "var(--chart-4)",
    iconBg: "var(--chart-4)",
    path: "/quotes",
  },
  {
    title: "Import Orders",
    description: "Bulk import from a spreadsheet.",
    icon: Upload,
    iconColor: "var(--success)",
    iconBg: "var(--success)",
  },
];

/* "Import Orders" is hidden while import / export is on the backlog
   (IMPORT_EXPORT_ENABLED). */
const recommendedActions: RecommendedAction[] = allRecommendedActions.filter(
  (a) => IMPORT_EXPORT_ENABLED || a.title !== "Import Orders",
);

/* ═══════════════════════════════════════════════════════════════════════════
 *  Recent activity
 * ═══════════════════════════════════════════════════════════════════════════ */
interface ActivityItem {
  label: string;
  time: string;
  dotColor: string;
}

const recentActivity: ActivityItem[] = [
  { label: "SO-2026-0042 created for Mercy Health", time: "1h ago", dotColor: "var(--primary)" },
  { label: "SO-2026-0039 shipped — 3 packages", time: "3h ago", dotColor: "var(--success)" },
  { label: "Quote QT-1089 converted to SO", time: "5h ago", dotColor: "var(--chart-4)" },
  { label: "SO-2026-0035 cleared by Ops", time: "1d ago", dotColor: "var(--chart-3)" },
  { label: "Invoice INV-4521 payment received", time: "1d ago", dotColor: "var(--success)" },
];

/* ═══════════════════════════════════════════════════════════════════════════
 *  Drag & drop constants
 * ═══════════════════════════════════════════════════════════════════════════ */
const STORAGE_KEY_MODULES = "sales-home-module-order";
const DND_MODULE = "SALES_MODULE_CARD";
const DEFAULT_MODULE_ORDER = modules.map((_, i) => i);

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch { /* ignore */ }
  return fallback;
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  Draggable module card
 * ═══════════════════════════════════════════════════════════════════════════ */
function DraggableModuleCard({
  mod, index, moveCard, onNavigate,
}: {
  mod: ModuleCard; index: number; moveCard: (from: number, to: number) => void; onNavigate: (path: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const [{ isDragging }, drag, preview] = useDrag({
    type: DND_MODULE,
    item: () => ({ index }),
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  });

  const [{ isOver }, drop] = useDrop({
    accept: DND_MODULE,
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
      if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY && hoverClientX < hoverMiddleX) return;
      if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY && hoverClientX > hoverMiddleX) return;
      moveCard(dragIndex, hoverIndex);
      item.index = hoverIndex;
    },
    collect: (monitor) => ({ isOver: monitor.isOver() }),
  });

  preview(drop(ref));
  drag(ref);

  const Icon = mod.icon;
  const mouseDownPos = useRef<{ x: number; y: number } | null>(null);

  const handleMouseDown = (e: ReactMouseEvent) => {
    mouseDownPos.current = { x: e.clientX, y: e.clientY };
  };

  const handleClick = (e: ReactMouseEvent) => {
    if (!mouseDownPos.current) return;
    const dx = Math.abs(e.clientX - mouseDownPos.current.x);
    const dy = Math.abs(e.clientY - mouseDownPos.current.y);
    mouseDownPos.current = null;
    if (dx < 5 && dy < 5 && mod.enabled) {
      onNavigate(mod.path);
    }
  };

  /* Drag ghost placeholder */
  if (isDragging) {
    return (
      <div ref={ref} className="rounded-xl border border-dashed border-primary/20 bg-primary/[0.02] min-h-[88px] opacity-40 pointer-events-none">
        <div style={{ padding: "12px 14px" }}>
          <div
            className="rounded-lg flex items-center justify-center opacity-50"
            style={{ width: 32, height: 32, marginBottom: 8 }}
          >
            <div className="absolute inset-0 rounded-[inherit]" style={{ backgroundColor: mod.iconBg, opacity: 0.12 }} />
            <Icon className="w-4 h-4 relative" style={{ color: mod.iconColor, opacity: 0.5 }} />
          </div>
          <p className="opacity-50" style={{ fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-medium)", marginBottom: 2 }}>{mod.title}</p>
          <p className="text-muted-foreground opacity-50" style={{ fontSize: "var(--text-small)" }}>{mod.description}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={ref}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      className={`group/card relative text-left bg-card border rounded-xl transition-all cursor-pointer active:cursor-grabbing ${
        isOver
          ? "border-primary/40 bg-primary/[0.04] shadow-[0_0_0_2px_var(--primary-glow-subtle)] scale-[1.02]"
          : mod.enabled
            ? "border-border hover:border-primary/20"
            : "border-border opacity-60 cursor-default"
      }`}
      style={{ padding: "12px 14px" }}
    >
      {isOver && <div className="absolute inset-0 rounded-xl bg-primary/[0.03] pointer-events-none" />}

      {/* Hover "Open →" */}
      {mod.enabled && (
        <div className="absolute top-2.5 right-2.5 flex items-center gap-2 opacity-0 group-hover/card:opacity-100 transition-opacity" style={{ zIndex: "var(--z-raised)" as any }}>
          <span className="inline-flex items-center gap-0.5 text-primary" style={{ fontSize: "var(--text-small)", fontWeight: "var(--font-weight-medium)" }}>
            Open <ArrowRight className="w-3 h-3" />
          </span>
        </div>
      )}

      <div
        className="rounded-lg flex items-center justify-center relative overflow-hidden"
        style={{ width: 32, height: 32, marginBottom: 8 }}
      >
        <div className="absolute inset-0 rounded-[inherit]" style={{ backgroundColor: mod.iconBg, opacity: 0.12 }} />
        <Icon className="w-4 h-4 relative" style={{ color: mod.iconColor }} />
      </div>
      <p className="text-foreground" style={{ fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-medium)", marginBottom: 2 }}>
        {mod.title}
      </p>
      <p className="text-muted-foreground" style={{ fontSize: "var(--text-small)", lineHeight: 1.5 }}>
        {mod.description}
      </p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  Sales Home Page
 * ═══════════════════════════════════════════════════════════════════════════ */
export function SalesHomePage() {
  const navigate = useNavigate();
  const { salesOrders } = useSOStore();

  /* Pipeline summary stats */
  const draftCount = salesOrders.filter(so => so.status === "Draft").length;
  const pendingCount = salesOrders.filter(so => so.status === "Pending Review").length;
  const clearedCount = salesOrders.filter(so => so.status === "Cleared").length;
  const shippedCount = salesOrders.filter(so => so.status === "Shipped" || so.status === "Partially Shipped").length;
  const totalSOs = salesOrders.length;

  /* Layout state — drag-and-drop reordering with localStorage persistence */
  const [moduleOrder, setModuleOrder] = useState<number[]>(() =>
    loadFromStorage(STORAGE_KEY_MODULES, DEFAULT_MODULE_ORDER)
  );
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const savedModuleOrder = useRef(loadFromStorage(STORAGE_KEY_MODULES, DEFAULT_MODULE_ORDER));

  useEffect(() => {
    const modulesChanged = JSON.stringify(moduleOrder) !== JSON.stringify(savedModuleOrder.current);
    setHasUnsavedChanges(modulesChanged);
  }, [moduleOrder]);

  const moveModuleCard = useCallback((from: number, to: number) => {
    setModuleOrder((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }, []);

  const saveLayout = useCallback(() => {
    localStorage.setItem(STORAGE_KEY_MODULES, JSON.stringify(moduleOrder));
    savedModuleOrder.current = moduleOrder;
    setHasUnsavedChanges(false);
    toast.success("Layout saved", { description: "Your custom layout has been saved." });
  }, [moduleOrder]);

  const resetLayout = useCallback(() => {
    setModuleOrder(DEFAULT_MODULE_ORDER);
    localStorage.removeItem(STORAGE_KEY_MODULES);
    savedModuleOrder.current = DEFAULT_MODULE_ORDER;
    setHasUnsavedChanges(false);
    toast.info("Layout reset", { description: "Restored to default layout." });
  }, []);

  const orderedModules = moduleOrder.map((i) => modules[i]).filter(Boolean);

  /* Pipeline stat cards — meaningful cross-module metrics */
  const pipelineValue = salesOrders
    .filter(so => ["Draft", "Pending Review", "Cleared"].includes(so.status))
    .reduce((sum, so) => sum + so.total, 0);
  const awaitingVerification = salesOrders.filter(so => so.status === "Pending Review").length;
  const shippedThisMonth = salesOrders.filter(so => {
    if (so.status !== "Shipped" && so.status !== "Partially Shipped") return false;
    const d = new Date();
    const soDate = new Date(so.orderDate);
    return soDate.getMonth() === d.getMonth() && soDate.getFullYear() === d.getFullYear();
  }).length;
  const conversionRate = 72; // mock — % of quotes converted to SOs
  const pendingQuotes = 8;   // mock — quotes not yet converted

  const pipelineStats = [
    { label: "Pipeline Value", value: `$${(pipelineValue / 1000).toFixed(0)}k`, color: "var(--primary)" },
    { label: "Pending Quotes", value: String(pendingQuotes), color: "var(--chart-4)" },
    { label: "Awaiting Verification", value: String(awaitingVerification), color: "var(--chart-3)" },
    { label: "Conversion Rate", value: `${conversionRate}%`, color: "var(--success)" },
    { label: "Shipped This Month", value: String(shippedThisMonth), color: "var(--success)" },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <DndProvider backend={HTML5Backend}>
          <div className="w-full" style={{ maxWidth: 1120, margin: "0 auto", padding: "12px 16px" }}>
            {/* Page header */}
            <div style={{ marginBottom: 12 }}>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between" style={{ gap: 8, marginBottom: 2 }}>
                <h1 className="text-foreground" style={{ fontSize: "var(--text-h4)", fontWeight: "var(--font-weight-semibold)" }}>
                  Sales Management
                </h1>
                {/* Layout controls */}
                <div className="flex items-center" style={{ gap: 6 }}>
                  {hasUnsavedChanges && (
                    <button
                      onClick={saveLayout}
                      className="inline-flex items-center rounded-lg border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors cursor-pointer text-primary"
                      style={{ gap: 6, padding: "6px 10px", fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-medium)" }}
                    >
                      <Save className="w-3 h-3" />
                      Save Layout
                    </button>
                  )}
                  <button
                    onClick={resetLayout}
                    className="inline-flex items-center rounded-lg border border-border hover:bg-secondary text-foreground/50 transition-colors cursor-pointer"
                    style={{ gap: 6, padding: "6px 10px", fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-medium)" }}
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span className="hidden sm:inline">Reset</span>
                  </button>
                </div>
              </div>
              <p className="text-muted-foreground" style={{ fontSize: "var(--text-caption)" }}>
                Manage your sales orders, quotes, and order operations.{" "}
                <button
                  className="inline-flex items-center text-primary hover:underline"
                  style={{ gap: 4, fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-medium)" }}
                >
                  Learn more <ExternalLink className="w-3 h-3" />
                </button>
              </p>
            </div>

            {/* Pipeline summary strip removed — difficult to configure period and KPI types */}

            {/* Modules section */}
            <div style={{ marginBottom: 16 }}>
              <h4 className="text-foreground/50" style={{ fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-medium)", marginBottom: 8 }}>
                Modules
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4" style={{ gap: 10 }}>
                {orderedModules.map((mod, idx) => (
                  <DraggableModuleCard
                    key={mod.title}
                    mod={mod}
                    index={idx}
                    moveCard={moveModuleCard}
                    onNavigate={navigate}
                  />
                ))}
              </div>
            </div>

            {/* Bottom section: Recommended + Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-3" style={{ gap: 10 }}>
              {/* Recommended Actions */}
              <div className="lg:col-span-2">
                <h4 className="text-foreground/50" style={{ fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-medium)", marginBottom: 8 }}>
                  Recommended Actions
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 10 }}>
                  {recommendedActions.map((action) => {
                    const Icon = action.icon;
                    return (
                      <button
                        key={action.title}
                        onClick={() => action.path && navigate(action.path)}
                        className={`flex items-center bg-card border border-border rounded-xl text-left transition-all ${
                          action.path
                            ? "hover:border-primary/20 cursor-pointer"
                            : "opacity-60 cursor-default"
                        }`}
                        style={{ gap: 12, padding: "12px 14px" }}
                      >
                        <div
                          className="rounded-lg flex items-center justify-center shrink-0 relative overflow-hidden"
                          style={{ width: 32, height: 32 }}
                        >
                          <div className="absolute inset-0 rounded-[inherit]" style={{ backgroundColor: action.iconBg, opacity: 0.12 }} />
                          <Icon className="w-4 h-4 relative" style={{ color: action.iconColor }} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-foreground" style={{ fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-medium)" }}>
                            {action.title}
                          </p>
                          <p className="text-muted-foreground" style={{ fontSize: "var(--text-small)" }}>
                            {action.description}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Recent Activity */}
              <div className="lg:col-span-1">
                <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
                  <h4 className="text-foreground/50" style={{ fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-medium)" }}>
                    Recent Activity
                  </h4>
                  <button
                    className="text-primary hover:underline"
                    style={{ fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-medium)" }}
                  >
                    View more
                  </button>
                </div>
                <div className="bg-card border border-border rounded-xl divide-y divide-border">
                  {recentActivity.map((item, idx) => (
                    <div key={idx} className="flex items-center" style={{ gap: 10, padding: "10px 14px" }}>
                      <span className="rounded-full shrink-0" style={{ width: 6, height: 6, backgroundColor: item.dotColor }} />
                      <span className="flex-1 min-w-0 truncate text-foreground" style={{ fontSize: "var(--text-caption)" }}>
                        {item.label}
                      </span>
                      <span className="text-muted-foreground shrink-0" style={{ fontSize: "var(--text-small)" }}>
                        {item.time}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </DndProvider>
      </div>
    </div>
  );
}

export default SalesHomePage;