import { useNavigate } from "react-router-dom";
import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type ComponentType,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { useItems } from "../context/ItemsContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { toast } from "sonner";
import {
  Search,
  Package,
  Layers,
  ClipboardCheck,
  ArrowRightLeft,
  RefreshCw,
  MapPin,
  ShieldCheck,
  TrendingUp,
  Plus,
  Upload,
  ExternalLink,
  RotateCcw,
  Save,
  ArrowRight,
  Truck,
} from "lucide-react";

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
    title: "Items Library",
    description: "Centralized master data for all items, SKUs, and variants.",
    icon: Package,
    iconColor: "#0A77FF",
    iconBg: "#EDF4FF",
    path: "/items",
    enabled: true,
  },
  {
    title: "Qualified Vendors",
    description: "Approved vendor relationships with lead times.",
    icon: ShieldCheck,
    iconColor: "#059669",
    iconBg: "#ECFDF5",
    path: "/vendors",
    enabled: true,
  },
  {
    title: "Sales Overview",
    description: "Track revenue, orders, and performance metrics.",
    icon: TrendingUp,
    iconColor: "#0A77FF",
    iconBg: "#EDF4FF",
    path: "/sales",
    enabled: true,
  },
  {
    title: "Categories",
    description: "Organize items into families, groups, and tax classes.",
    icon: Layers,
    iconColor: "#EA580C",
    iconBg: "#FFF7ED",
    path: "/categories",
    enabled: false,
  },
  {
    title: "Physical Inventory",
    description: "Full-scale stock taking and reconciliation records.",
    icon: ClipboardCheck,
    iconColor: "#0891B2",
    iconBg: "#ECFEFF",
    path: "/inventory/physical",
    enabled: false,
  },
  {
    title: "Inventory Movement",
    description: "Track transfers, adjustments, and inbound/outbound history.",
    icon: ArrowRightLeft,
    iconColor: "#7C3AED",
    iconBg: "#F5F3FF",
    path: "/inventory/movement",
    enabled: false,
  },
  {
    title: "Cycle Count",
    description: "Schedule and manage periodic partial stock counts.",
    icon: RefreshCw,
    iconColor: "#E11D48",
    iconBg: "#FFF1F2",
    path: "/inventory/cycle-count",
    enabled: false,
  },
  {
    title: "Locations Management",
    description: "Configure warehouse zones, aisles, racks, and bins.",
    icon: MapPin,
    iconColor: "#475569",
    iconBg: "#F1F5F9",
    path: "/locations",
    enabled: false,
  },
];

interface RecommendedAction {
  title: string;
  description: string;
  icon: ComponentType<{ className?: string; style?: CSSProperties }>;
  iconColor: string;
  iconBg: string;
  path?: string;
}

const recommendedActions: RecommendedAction[] = [
  {
    title: "Add New Item",
    description: "Create a new item with categories and stock.",
    icon: Plus,
    iconColor: "#0A77FF",
    iconBg: "#EDF4FF",
    path: "/items/new",
  },
  {
    title: "Import Items",
    description: "Bulk import from a spreadsheet.",
    icon: Upload,
    iconColor: "#7C3AED",
    iconBg: "#F5F3FF",
  },
  {
    title: "Process Inbound",
    description: "Review pending stock transfers.",
    icon: Truck,
    iconColor: "#059669",
    iconBg: "#ECFDF5",
  },
];

interface ActivityItem {
  label: string;
  time: string;
  dotColor: string;
}

const recentActivity: ActivityItem[] = [
  { label: 'New Item: Zinc Hex Screw 1/4"-20', time: "2h ago", dotColor: "#0A77FF" },
  { label: "Stock Adj: Ergonomic Office Chair", time: "4h ago", dotColor: "#059669" },
  { label: "Item Archived: Legacy Filter Set", time: "1d ago", dotColor: "#475569" },
  { label: "New Vendor: TechParts Industrial", time: "1d ago", dotColor: "#7C3AED" },
  { label: "Cycle Count Started: Warehouse A", time: "2d ago", dotColor: "#EA580C" },
];

const STORAGE_KEY_MODULES = "items-home-module-order";
const DND_MODULE = "MODULE_CARD";

const DEFAULT_MODULE_ORDER = modules.map((_, i) => i);

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch {
    /* ignore */
  }
  return fallback;
}

/* ─── Draggable Module Card ─── */
function DraggableModuleCard({
  mod,
  index,
  moveCard,
  onNavigate,
}: {
  mod: ModuleCard;
  index: number;
  moveCard: (from: number, to: number) => void;
  onNavigate: (path: string) => void;
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

  // Track mouse movement to distinguish click from drag
  const mouseDownPos = useRef<{ x: number; y: number } | null>(null);

  const handleMouseDown = (e: ReactMouseEvent) => {
    mouseDownPos.current = { x: e.clientX, y: e.clientY };
  };

  const handleClick = (e: ReactMouseEvent) => {
    if (!mouseDownPos.current) return;
    const dx = Math.abs(e.clientX - mouseDownPos.current.x);
    const dy = Math.abs(e.clientY - mouseDownPos.current.y);
    mouseDownPos.current = null;
    // Only navigate if the mouse barely moved (not a drag) AND module is enabled
    if (dx < 5 && dy < 5 && mod.enabled) {
      onNavigate(mod.path);
    }
  };

  /* When dragging, show a faded-out ghost of the card */
  if (isDragging) {
    return (
      <div
        ref={ref}
        className="rounded-xl border border-dashed border-primary/20 bg-primary/[0.02] min-h-[88px] opacity-40 pointer-events-none"
      >
        <div className="px-3.5 pt-3 pb-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center mb-2 opacity-50"
            style={{ backgroundColor: mod.iconBg }}
          >
            <Icon className="w-4 h-4" style={{ color: mod.iconColor }} />
          </div>
          <p className="text-[13px] mb-0.5 opacity-50" style={{ fontWeight: 500 }}>
            {mod.title}
          </p>
          <p className="text-[11px] text-muted-foreground leading-relaxed opacity-50">
            {mod.description}
          </p>
        </div>
      </div>
    );
  }

  const baseCardClass =
    "group/card relative text-left bg-card border rounded-xl px-3.5 pt-3 pb-3 transition-all duration-200";
  const enabledStateClass = isOver
    ? "border-primary/40 bg-primary/[0.04] shadow-[0_0_0_2px_rgba(10,119,255,0.10)] scale-[1.02] cursor-pointer active:cursor-grabbing"
    : "border-border hover:shadow-md hover:border-primary/20 cursor-pointer active:cursor-grabbing";
  const disabledStateClass = "border-border opacity-60 cursor-not-allowed";

  return (
    <div
      ref={ref}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      className={`${baseCardClass} ${mod.enabled ? enabledStateClass : disabledStateClass}`}
      aria-disabled={!mod.enabled}
    >
      {/* Drop zone preview indicator */}
      {isOver && mod.enabled && (
        <div className="absolute inset-0 rounded-xl bg-primary/[0.03] pointer-events-none" />
      )}

      {/* Hover action — top right: "Open →" (enabled only) */}
      {mod.enabled && (
        <div className="absolute top-2.5 right-2.5 flex items-center gap-2 opacity-0 group-hover/card:opacity-100 transition-opacity z-10">
          <span
            className="inline-flex items-center gap-0.5 text-[11px]"
            style={{ color: "#0A77FF", fontWeight: 500 }}
          >
            Open
            <ArrowRight className="w-3 h-3" />
          </span>
        </div>
      )}

      {/* Coming soon chip — disabled only */}
      {!mod.enabled && (
        <div className="absolute top-2.5 right-2.5 z-10">
          <span
            className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground"
            style={{ fontWeight: 500 }}
          >
            Soon
          </span>
        </div>
      )}

      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center mb-2"
        style={{ backgroundColor: mod.iconBg }}
      >
        <Icon className="w-4 h-4" style={{ color: mod.iconColor }} />
      </div>
      <p className="text-[13px] mb-0.5" style={{ fontWeight: 500 }}>
        {mod.title}
      </p>
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        {mod.description}
      </p>
    </div>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { items } = useItems();

  // Live count: non-archived items (mirrors Partners' activeCount semantic)
  const activeCount = items.filter((i) => i.status !== "Archived").length;

  /* ─── Layout state ─── */
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

  return (
    <div className="flex flex-col h-full bg-[#F8FAFC]">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-6 lg:px-8 h-12 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
          <span style={{ fontWeight: 500 }} className="text-foreground">
            Inventory Management
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => navigate("/items/new")}
          >
            <Plus className="w-4 h-4" />
          </Button>
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
            <Input
              placeholder="Search..."
              className="pl-9 w-[260px] h-8 bg-white border-border/60 text-[13px] placeholder:text-muted-foreground/50"
            />
          </div>
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ backgroundColor: "#EDF4FF" }}
            >
              <span
                className="text-[11px]"
                style={{ fontWeight: 600, color: "#0A77FF" }}
              >
                AA
              </span>
            </div>
            <div className="hidden sm:block">
              <p className="text-[13px]" style={{ fontWeight: 500 }}>
                Ahtisham Ahmad
              </p>
              <p className="text-[11px] text-muted-foreground leading-tight">
                Senior Product Designer
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <DndProvider backend={HTML5Backend}>
          <div className="px-4 sm:px-5 lg:px-6 py-3 sm:py-4 w-full max-w-[1120px] mx-auto">
            {/* Page Header */}
            <div className="mb-3 sm:mb-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-0.5">
                <h1 className="text-xl sm:text-2xl font-bold">Inventory Management</h1>
                {/* Layout Controls */}
                <div className="flex items-center gap-1.5">
                  {hasUnsavedChanges && (
                    <button
                      onClick={saveLayout}
                      className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors cursor-pointer"
                      style={{ color: "#0A77FF", fontWeight: 500 }}
                    >
                      <Save className="w-3 h-3" />
                      Save Layout
                    </button>
                  )}
                  <button
                    onClick={resetLayout}
                    className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-border hover:bg-muted/40 text-muted-foreground transition-colors cursor-pointer"
                    style={{ fontWeight: 500 }}
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span className="hidden sm:inline">Reset</span>
                  </button>
                </div>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Manage your items, inventory, and warehouse operations.{" "}
                <span className="text-foreground" style={{ fontWeight: 500 }}>
                  {activeCount.toLocaleString()}
                </span>{" "}
                active items.{" "}
                <button
                  className="inline-flex items-center gap-1 text-xs sm:text-sm hover:underline"
                  style={{ color: "#0A77FF", fontWeight: 500 }}
                >
                  Learn more
                  <ExternalLink className="w-3 h-3" />
                </button>
              </p>
            </div>

            {/* Modules Section */}
            <div className="mb-4 sm:mb-5">
              <h4
                className="text-sm text-muted-foreground mb-2 sm:mb-2.5"
                style={{ fontWeight: 500 }}
              >
                Modules
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-2.5">
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

            {/* Bottom Section: Recommended Actions + Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-2.5">
              {/* Recommended Actions */}
              <div className="lg:col-span-2">
                <h4
                  className="text-sm text-muted-foreground mb-2 sm:mb-2.5"
                  style={{ fontWeight: 500 }}
                >
                  Recommended Actions
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {recommendedActions.map((action) => {
                    const Icon = action.icon;
                    return (
                      <button
                        key={action.title}
                        onClick={() => action.path && navigate(action.path)}
                        className={`flex items-center gap-3 bg-card border border-border rounded-xl px-3.5 py-3 text-left transition-all ${
                          action.path
                            ? "hover:shadow-sm hover:border-primary/20 cursor-pointer"
                            : "opacity-60 cursor-default"
                        }`}
                      >
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                          style={{ backgroundColor: action.iconBg }}
                        >
                          <Icon className="w-4 h-4" style={{ color: action.iconColor }} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[13px]" style={{ fontWeight: 500 }}>
                            {action.title}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
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
                <div className="flex items-center justify-between mb-2 sm:mb-2.5">
                  <h4
                    className="text-sm text-muted-foreground"
                    style={{ fontWeight: 500 }}
                  >
                    Recent Activity
                  </h4>
                  <button
                    className="text-xs hover:underline"
                    style={{ color: "#0A77FF", fontWeight: 500 }}
                  >
                    View more
                  </button>
                </div>
                <div className="bg-card border border-border rounded-xl divide-y divide-border">
                  {recentActivity.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2.5 px-3.5 py-2.5"
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: item.dotColor }}
                      />
                      <span className="text-[13px] flex-1 min-w-0 truncate">
                        {item.label}
                      </span>
                      <span
                        className="text-[11px] text-muted-foreground shrink-0"
                        style={{ fontWeight: 400 }}
                      >
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
