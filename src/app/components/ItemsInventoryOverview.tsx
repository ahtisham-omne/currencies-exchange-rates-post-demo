import { useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback, useRef, type ComponentType, type CSSProperties } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { toast } from "sonner";
import {
  Box,
  ShieldCheck,
  TrendingUp,
  Layers,
  ClipboardCheck,
  ArrowRightLeft,
  RefreshCw,
  MapPin,
  ExternalLink,
  RotateCcw,
  Save,
  Plus,
  Upload,
  Truck,
} from "lucide-react";
import { DraggableModuleCard, type ModuleCard } from "./shared/OverviewModuleCard";
import { sampleOnly } from "../data/tenant";

/* ═══════════════════════════════════════
   MODULE CARDS
   ═══════════════════════════════════════ */

const modules: ModuleCard[] = [
  {
    title: "Items Library",
    description: "Centralized master data for all items, SKUs, and variants.",
    icon: Box,
    iconColor: "#007FFF",
    iconBg: "#EDF4FF",
    path: "/items-inventory/items-library",
    enabled: true,
  },
  {
    title: "Qualified Vendors",
    description: "Approved vendor relationships with lead times.",
    icon: ShieldCheck,
    iconColor: "#059669",
    iconBg: "#ECFDF5",
    path: "/items-inventory/qualified-vendors",
    enabled: true,
  },
  {
    title: "Sales Overview",
    description: "Track revenue, orders, and performance metrics.",
    icon: TrendingUp,
    iconColor: "#2563EB",
    iconBg: "#EFF6FF",
    path: "/items-inventory/sales-overview",
    enabled: true,
  },
  {
    title: "Categories",
    description: "Organize items into families, groups, and tax classes.",
    icon: Layers,
    iconColor: "#EA580C",
    iconBg: "#FFF7ED",
    path: "/items-inventory/categories",
    enabled: false,
  },
  {
    title: "Physical Inventory",
    description: "Full-scale stock taking and reconciliation records.",
    icon: ClipboardCheck,
    iconColor: "#059669",
    iconBg: "#ECFDF5",
    path: "/items-inventory/physical-inventory",
    enabled: false,
  },
  {
    title: "Inventory Movement",
    description: "Track transfers, adjustments, and inbound/outbound history.",
    icon: ArrowRightLeft,
    iconColor: "#7C3AED",
    iconBg: "#F5F3FF",
    path: "/items-inventory/inventory-movement",
    enabled: false,
  },
  {
    title: "Cycle Count",
    description: "Schedule and manage periodic partial stock counts.",
    icon: RefreshCw,
    iconColor: "#EF4444",
    iconBg: "#FEF2F2",
    path: "/items-inventory/cycle-count",
    enabled: false,
  },
  {
    title: "Locations Management",
    description: "Configure warehouse zones, aisles, racks, and bins.",
    icon: MapPin,
    iconColor: "#64748B",
    iconBg: "#F1F5F9",
    path: "/items-inventory/location-management",
    enabled: false,
  },
];

/* ═══════════════════════════════════════
   RECOMMENDED ACTIONS
   ═══════════════════════════════════════ */

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
    iconColor: "#007FFF",
    iconBg: "#EDF4FF",
    path: "/items-inventory/items-library",
  },
  {
    title: "Import Items",
    description: "Bulk import from a spreadsheet.",
    icon: Upload,
    iconColor: "#64748B",
    iconBg: "#F1F5F9",
  },
  {
    title: "Process Inbound",
    description: "Review pending stock transfers.",
    icon: Truck,
    iconColor: "#059669",
    iconBg: "#ECFDF5",
  },
];

/* ═══════════════════════════════════════
   RECENT ACTIVITY
   ═══════════════════════════════════════ */

interface ActivityItem {
  label: string;
  time: string;
  dotColor: string;
}

const recentActivity: ActivityItem[] = [
  { label: 'New Item: Zinc Hex Screw 1/4"-20', time: "2h ago", dotColor: "#007FFF" },
  { label: "Stock Adj: Ergonomic Office Chair", time: "4h ago", dotColor: "#059669" },
  { label: "Item Archived: Legacy Filter Set", time: "1d ago", dotColor: "#475569" },
  { label: "New Vendor: TechParts Industrial", time: "1d ago", dotColor: "#7C3AED" },
  { label: "Cycle Count Started: Warehouse A", time: "2d ago", dotColor: "#EA580C" },
];

/* ═══════════════════════════════════════
   DRAG-AND-DROP PERSISTENCE
   ═══════════════════════════════════════ */

const STORAGE_KEY_MODULES = "items-inventory-module-order";
const DND_MODULE = "ITEMS_INVENTORY_MODULE_CARD";

const DEFAULT_MODULE_ORDER = modules.map((_, i) => i);
const ACTIVE_ITEM_COUNT = 22;

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch { /* ignore */ }
  return fallback;
}

/* ═══════════════════════════════════════
   ITEMS & INVENTORY OVERVIEW PAGE
   ═══════════════════════════════════════ */

export function ItemsInventoryOverview() {
  const navigate = useNavigate();

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
                    className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-[8px] border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors cursor-pointer"
                    style={{ color: "#007FFF", fontWeight: 500 }}
                  >
                    <Save className="w-3 h-3" />
                    Save Layout
                  </button>
                )}
                <button
                  onClick={resetLayout}
                  className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-[8px] border border-border hover:bg-muted/40 text-muted-foreground transition-colors cursor-pointer"
                  style={{ fontWeight: 500 }}
                >
                  <RotateCcw className="w-3 h-3" />
                  <span className="hidden sm:inline">Reset</span>
                </button>
              </div>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Manage your items, inventory, and warehouse operations.{" "}
              <span className="text-foreground" style={{ fontWeight: 600 }}>
                {ACTIVE_ITEM_COUNT} active items
              </span>
              .{" "}
              <button
                className="inline-flex items-center gap-1 text-xs sm:text-sm hover:underline"
                style={{ color: "#007FFF", fontWeight: 500 }}
              >
                Learn more
                <ExternalLink className="w-3 h-3" />
              </button>
            </p>
          </div>

          {/* Modules Section */}
          <div className="mb-4 sm:mb-5">
            <h4 className="text-sm text-muted-foreground mb-2 sm:mb-2.5" style={{ fontWeight: 500 }}>
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
                  dndType={DND_MODULE}
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
                        className="w-8 h-8 rounded-[8px] flex items-center justify-center shrink-0"
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
                  style={{ color: "#007FFF", fontWeight: 500 }}
                >
                  View More
                </button>
              </div>
              <div className="bg-card border border-border rounded-xl divide-y divide-border">
                {/* The sample company's activity; a company from onboarding has none. */}
                {sampleOnly(recentActivity).map((item, idx) => (
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
  );
}
