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
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { toast } from "sonner";
import {
  Package,
  Layers,
  ClipboardCheck,
  ArrowRightLeft,
  RefreshCw,
  ExternalLink,
  RotateCcw,
  Save,
  ArrowRight,
} from "lucide-react";
import { NotificationBell } from "../components/notifications/NotificationBell";

interface ModuleCard {
  title: string;
  description: string;
  icon: ComponentType<{ className?: string; style?: CSSProperties }>;
  iconColor: string;
  iconBg: string;
  /** Omitted for screens not built in this app yet; clicking shows a notice instead. */
  path?: string;
}

// Mirrors the Items & Inventory section of the side nav (AppSidebar), in the same order.
const modules: ModuleCard[] = [
  {
    title: "Categories",
    description: "Organize items into families, groups, and tax classes.",
    icon: Layers,
    iconColor: "#EA580C",
    iconBg: "#FFF7ED",
  },
  {
    title: "Items",
    description: "Centralized master data for all items, SKUs, and variants.",
    icon: Package,
    iconColor: "#0A77FF",
    iconBg: "#EDF4FF",
    path: "/items",
  },
  {
    title: "Physical Inventory",
    description: "Full-scale stock taking and reconciliation records.",
    icon: ClipboardCheck,
    iconColor: "#0891B2",
    iconBg: "#ECFEFF",
  },
  {
    title: "Cycle Counting",
    description: "Schedule and manage periodic partial stock counts.",
    icon: RefreshCw,
    iconColor: "#E11D48",
    iconBg: "#FFF1F2",
  },
  {
    title: "Inventory Movement",
    description: "Track transfers, adjustments, and inbound/outbound history.",
    icon: ArrowRightLeft,
    iconColor: "#7C3AED",
    iconBg: "#F5F3FF",
  },
];

const STORAGE_KEY_MODULES = "items-home-module-order-v2";
const DND_MODULE = "MODULE_CARD";

const DEFAULT_MODULE_ORDER = modules.map((_, i) => i);

function loadModuleOrder(): number[] {
  const order = loadFromStorage<number[]>(STORAGE_KEY_MODULES, DEFAULT_MODULE_ORDER);
  const valid =
    Array.isArray(order) &&
    order.length === modules.length &&
    DEFAULT_MODULE_ORDER.every((i) => order.includes(i));
  return valid ? order : DEFAULT_MODULE_ORDER;
}

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
  onNavigate: (mod: ModuleCard) => void;
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
    // Only open if the mouse barely moved (not a drag)
    if (dx < 5 && dy < 5) {
      onNavigate(mod);
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
  const cardStateClass = isOver
    ? "border-primary/40 bg-primary/[0.04] shadow-[0_0_0_2px_rgba(10,119,255,0.10)] scale-[1.02] cursor-pointer active:cursor-grabbing"
    : "border-border hover:shadow-md hover:border-primary/20 cursor-pointer active:cursor-grabbing";

  return (
    <div
      ref={ref}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      className={`${baseCardClass} ${cardStateClass}`}
    >
      {/* Drop zone preview indicator */}
      {isOver && (
        <div className="absolute inset-0 rounded-xl bg-primary/[0.03] pointer-events-none" />
      )}

      {/* Hover action — top right: "Open →" */}
      <div className="absolute top-2.5 right-2.5 flex items-center gap-2 opacity-0 group-hover/card:opacity-100 transition-opacity z-10">
        <span
          className="inline-flex items-center gap-0.5 text-[11px]"
          style={{ color: "#0A77FF", fontWeight: 500 }}
        >
          Open
          <ArrowRight className="w-3 h-3" />
        </span>
      </div>

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
  const [moduleOrder, setModuleOrder] = useState<number[]>(loadModuleOrder);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const savedModuleOrder = useRef(loadModuleOrder());

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

  const openModule = useCallback(
    (mod: ModuleCard) => {
      if (mod.path) navigate(mod.path);
      else toast.info(`${mod.title} isn't available in this app yet.`);
    },
    [navigate]
  );

  const orderedModules = moduleOrder.map((i) => modules[i]).filter(Boolean);

  return (
    <div className="flex flex-col h-full bg-[#F8FAFC]">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-6 lg:px-8 h-12 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
          <span style={{ fontWeight: 500 }}>Items & Inventory</span>
          <span>/</span>
          <span style={{ fontWeight: 500 }} className="text-foreground">
            Overview
          </span>
        </div>
        <div className="flex items-center gap-3">
          <NotificationBell />
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
                <h1 className="text-xl sm:text-2xl font-bold">Items & Inventory</h1>
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
                Manage your items, categories, stock counts, and inventory movement.{" "}
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
            <div>
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
                    onNavigate={openModule}
                  />
                ))}
              </div>
            </div>
          </div>
        </DndProvider>
      </div>
    </div>
  );
}
