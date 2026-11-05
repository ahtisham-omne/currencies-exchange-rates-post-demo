/**
 * Sales Module Sidebar — direct port of Partner Management's AppSidebar.
 * Default-collapsed (icon rail) on first load; hover-expand reveals the
 * full nav as a floating overlay. Cmd/Ctrl+B toggles the pinned state.
 * Width and collapsed flag persist in localStorage between visits.
 */
import { useLocation, useNavigate } from "react-router-dom";
import type { ComponentType, MouseEvent as ReactMouseEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import logoWordmark from "@/assets/2d714e5c28dc2bd9f7623aa6a3775402653c048e.png";
import logoIcon from "@/assets/62fad9647d1ac360c4b31106f9625b8201efb089.png";
import {
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  ShoppingCart,
  Boxes,
  Handshake,
  Truck,
  Factory,
  Calculator,
  UsersRound,
  Building2,
  LogOut,
  Bell,
  Settings,
} from "lucide-react";
import { useState, useRef, useCallback, useEffect } from "react";
import { usePersona, type Persona } from "./PersonaContext";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/app/components/ui/tooltip";

interface NavChild {
  label: string;
  path: string;
  disabled?: boolean;
}

interface NavItem {
  label: string;
  icon: ComponentType<{ className?: string }>;
  path: string;
  disabled?: boolean;
  children?: NavChild[];
}

const navItems: NavItem[] = [
  { label: "Items & Inventory",        icon: Boxes,       path: "/items",         disabled: true },
  { label: "Partners Management",      icon: Handshake,   path: "/partners",      disabled: true },
  { label: "Supply Chain Management",  icon: Truck,       path: "/supply-chain",  disabled: true },
  { label: "Production & Planning",    icon: Factory,     path: "/production",    disabled: true },
  {
    label: "Sales",
    icon: ShoppingCart,
    path: "/",
    children: [
      /* Quotes lives in the sibling repo. Surface the entry so the
         nav reads the same as the Partner-aligned design, but mark
         it disabled here because /quotes is not a real route in this
         module. */
      { label: "Quotes",       path: "/quotes", disabled: true },
      { label: "Sales Orders", path: "/sales-orders" },
    ],
  },
  { label: "Accounting & Finance", icon: Calculator,  path: "/accounting",    disabled: true },
  { label: "People Management",    icon: UsersRound,  path: "/people",        disabled: true },
  { label: "Company Setup",        icon: Building2,   path: "/company-setup", disabled: true },
];

const COLLAPSED_WIDTH = 60;
const MIN_WIDTH = 220;
const MAX_WIDTH = 420;
const DEFAULT_WIDTH = 272;
const STORAGE_KEY_COLLAPSED = "omnesoft:sidebar-collapsed";
const STORAGE_KEY_WIDTH = "omnesoft:sidebar-width";
/* Below xl the nav drops to its icon rail, as Purchase Order's nav
   does by default. Expanded, its 272px would leave the detail page
   a ~370px content column at 1024px. The rail is a layout fallback,
   not a preference: it is never written to storage, and widening
   the window back past 1280px restores whatever the user pinned. */
const COMPACT_QUERY = "(max-width: 1279px)";

function isCompactViewport(): boolean {
  try { return window.matchMedia(COMPACT_QUERY).matches; } catch { return false; }
}

function readStoredBoolean(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    if (v === "true") return true;
    if (v === "false") return false;
  } catch { /* ignore */ }
  return fallback;
}

function readStoredNumber(key: string, fallback: number, min: number, max: number): number {
  try {
    const v = localStorage.getItem(key);
    if (v !== null) {
      const n = Number(v);
      if (!Number.isNaN(n) && n >= min && n <= max) return n;
    }
  } catch { /* ignore */ }
  return fallback;
}

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { persona, setPersona } = usePersona();
  const [expandedItems, setExpandedItems] = useState<string[]>(["Sales"]);
  /* Default expanded (matches Partner Management's open-by-default
     state). The collapsed flag is still persisted, so users who pin
     it shut keep that preference across visits. */
  const [collapsed, setCollapsed] = useState(() => isCompactViewport() || readStoredBoolean(STORAGE_KEY_COLLAPSED, false));
  const [sidebarWidth, setSidebarWidth] = useState(() => readStoredNumber(STORAGE_KEY_WIDTH, DEFAULT_WIDTH, MIN_WIDTH, MAX_WIDTH));
  const [hoverExpanded, setHoverExpanded] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Suppress the width transition on first render so the rail doesn't animate
  // from full to collapsed on load.
  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => { requestAnimationFrame(() => setHasMounted(true)); }, []);

  const actualWidth = collapsed ? COLLAPSED_WIDTH : sidebarWidth;

  /* Only an explicit user toggle is saved. The compact-viewport rail
     below goes through plain `setCollapsed` so it never overwrites the
     stored choice. */
  const setCollapsedByUser = useCallback((next: boolean | ((prev: boolean) => boolean)) => {
    setCollapsed((prev) => {
      const value = typeof next === "function" ? next(prev) : next;
      try { localStorage.setItem(STORAGE_KEY_COLLAPSED, String(value)); } catch { /* ignore */ }
      return value;
    });
  }, []);

  useEffect(() => {
    const mq = window.matchMedia(COMPACT_QUERY);
    const apply = () => {
      setCollapsed(mq.matches || readStoredBoolean(STORAGE_KEY_COLLAPSED, false));
      setHoverExpanded(false);
    };
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY_WIDTH, String(sidebarWidth)); } catch { /* ignore */ }
  }, [sidebarWidth]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "b") {
        e.preventDefault();
        setCollapsedByUser(prev => !prev);
        setHoverExpanded(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const toggleExpand = (label: string) => {
    setExpandedItems(prev =>
      prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label]
    );
  };

  const isItemActive = (item: NavItem) => {
    if (item.path === "/") {
      return location.pathname === "/" || location.pathname.startsWith("/sales-orders") || location.pathname.startsWith("/quotes");
    }
    return location.pathname === item.path || location.pathname.startsWith(item.path + "/");
  };

  const isChildActive = (path: string) => {
    if (path === "/sales-orders") return location.pathname === "/sales-orders" || location.pathname.startsWith("/sales-orders/");
    if (path === "/") return location.pathname === "/";
    return location.pathname === path || location.pathname.startsWith(path + "/");
  };

  const startResize = useCallback((e: ReactMouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    const startX = e.clientX;
    const startWidth = sidebarWidth;
    const onMouseMove = (moveEvent: MouseEvent) => {
      setSidebarWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + (moveEvent.clientX - startX))));
    };
    const onMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [sidebarWidth]);

  const handleMouseEnter = useCallback(() => {
    if (collapsed) {
      hoverTimeoutRef.current = setTimeout(() => setHoverExpanded(true), 200);
    }
  }, [collapsed]);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimeoutRef.current) { clearTimeout(hoverTimeoutRef.current); hoverTimeoutRef.current = null; }
    setHoverExpanded(false);
  }, []);

  useEffect(() => { return () => { if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current); }; }, []);

  function renderFullContent(isOverlay: boolean) {
    return (
      <>
        {/* Logo header — Partner wordmark + collapse toggle. h-12, px-3, gap-2.5. */}
        <div className="h-12 px-3 flex items-center gap-2.5 border-b border-border shrink-0">
          <img src={logoWordmark} alt="Omnesoft" className="h-5 shrink-0" />
          <div className="flex-1 min-w-0" />
          <button
            onClick={() => { if (isOverlay) { setCollapsedByUser(false); setHoverExpanded(false); } else { setCollapsedByUser(true); setHoverExpanded(false); } }}
            className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0"
            title={isOverlay ? "Pin sidebar open" : "Collapse sidebar"}
          >
            {isOverlay ? <ChevronsRight className="w-4 h-4" /> : <ChevronsLeft className="w-4 h-4" />}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-2 px-2">
          <div className="space-y-px">
            {navItems.map(item => {
              const Icon = item.icon;
              const hasChildren = item.children && item.children.length > 0;
              const isExpanded = expandedItems.includes(item.label);
              const active = isItemActive(item);
              const disabled = item.disabled;

              if (hasChildren) {
                return (
                  <div key={item.label}>
                    <button
                      onClick={() => toggleExpand(item.label)}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] transition-all duration-150 ${
                        active ? "text-[#0A77FF]" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                      style={{ fontWeight: active ? 500 : 400, backgroundColor: active ? "rgba(10, 119, 255, 0.06)" : undefined }}
                    >
                      <Icon className={`w-[18px] h-[18px] shrink-0 ${active ? "text-[#0A77FF]" : ""}`} />
                      <span className="flex-1 text-left truncate">{item.label}</span>
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? "rotate-0" : "-rotate-90"} ${active ? "text-[#0A77FF]" : "text-muted-foreground"}`} />
                    </button>
                    {isExpanded && (
                      <div className="ml-[19px] mt-0.5 space-y-px border-l-[1.5px] pl-2.5 py-0.5" style={{ borderColor: "#D6E8FF" }}>
                        {item.children!.map(child => {
                          const childActive = isChildActive(child.path);
                          if (child.disabled) {
                            return (
                              <div
                                key={child.path}
                                className="block px-2.5 py-1 rounded-md text-[13px] cursor-not-allowed text-muted-foreground/80"
                                style={{ fontWeight: 400 }}
                                title="Lives in the Quote module"
                              >
                                {child.label}
                              </div>
                            );
                          }
                          return (
                            <button
                              key={child.path}
                              onClick={() => navigate(child.path)}
                              className={`block w-full text-left px-2.5 py-1 rounded-md text-[13px] transition-all duration-150 ${
                                childActive ? "text-[#0A77FF]" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                              }`}
                              style={{ fontWeight: childActive ? 500 : 400, backgroundColor: childActive ? "rgba(10, 119, 255, 0.05)" : undefined }}
                            >
                              {child.label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              if (disabled) {
                /* Disabled top-level items share the same color as the
                   inactive/non-disabled state (`text-muted-foreground`).
                   We previously hard-coded #64748B (slate-500) which
                   read noticeably lighter than Partner Management's
                   sidebar — switching to the design-system token lands
                   the text near slate-600 / close to the foreground. */
                return (
                  <div key={item.label} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] cursor-not-allowed text-muted-foreground" style={{ fontWeight: 400 }}>
                    <Icon className="w-[18px] h-[18px] shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </div>
                );
              }

              return (
                <button
                  key={item.label}
                  onClick={() => navigate(item.path)}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] transition-all duration-150 ${
                    active ? "text-[#0A77FF]" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                  style={{ fontWeight: active ? 500 : 400, backgroundColor: active ? "rgba(10, 119, 255, 0.06)" : undefined }}
                >
                  <Icon className="w-[18px] h-[18px] shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        <div className="border-t border-border shrink-0">
          {/* Persona toggle */}
          <div className="px-2 pt-2 pb-1">
            <div className="flex items-center rounded-lg bg-secondary/60 p-0.5" style={{ height: 32 }}>
              {([
                { key: "creator" as Persona, label: "Sales View" },
                { key: "reviewer" as Persona, label: "Approver View" },
              ]).map(p => {
                const isActive = persona === p.key;
                return (
                  <button
                    key={p.key}
                    onClick={() => setPersona(p.key)}
                    className="flex-1 flex items-center justify-center rounded-md transition-all text-[11px]"
                    style={{
                      height: 26,
                      fontWeight: isActive ? 600 : 400,
                      backgroundColor: isActive ? "#FFFFFF" : "transparent",
                      color: isActive ? "#0A77FF" : "#64748B",
                      boxShadow: isActive ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                      cursor: "pointer",
                      border: "none",
                    }}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="px-2 py-1.5 flex items-center gap-1">
            <button className="flex-1 flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[13px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" style={{ fontWeight: 400 }}>
              <Settings className="w-[16px] h-[16px] shrink-0" /><span className="truncate">Settings</span>
            </button>
            <button className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0">
              <Bell className="w-[16px] h-[16px]" />
            </button>
          </div>
          <div className="px-2 pb-2">
            <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-muted transition-colors cursor-pointer">
              <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--accent)" }}>
                <span className="text-[11px]" style={{ fontWeight: 600, color: "var(--primary)" }}>AA</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] text-foreground truncate" style={{ fontWeight: 500 }}>Ahtisham Ahmad</p>
                <p className="text-[11px] text-muted-foreground truncate leading-tight">admin@omnesoft.com</p>
              </div>
              <LogOut className="w-4 h-4 text-muted-foreground shrink-0" />
            </div>
          </div>
        </div>
      </>
    );
  }

  function renderCollapsedBar() {
    return (
      <aside className="absolute inset-0 bg-card border-r border-border flex flex-col items-center z-10">
        <div className="h-12 flex items-center justify-center border-b border-border w-full shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setCollapsedByUser(false)}
                className="w-9 h-9 rounded-lg flex items-center justify-center transition-all hover:ring-2 hover:ring-primary/20"
                aria-label="Expand sidebar"
              >
                <img src={logoIcon} alt="Omnesoft" className="w-7 h-7" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>Expand sidebar</TooltipContent>
          </Tooltip>
        </div>
        <nav className="flex-1 overflow-y-auto py-3 w-full">
          <div className="flex flex-col items-center gap-0.5 px-2">
            {navItems.map(item => {
              const Icon = item.icon;
              const active = isItemActive(item);
              const disabled = item.disabled;
              return (
                <Tooltip key={item.label}>
                  <TooltipTrigger asChild>
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                        active ? "text-[#0A77FF]" : disabled ? "text-muted-foreground/50 cursor-not-allowed" : "text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
                      }`}
                      style={{ backgroundColor: active ? "rgba(10, 119, 255, 0.06)" : undefined }}
                    >
                      <Icon className="w-[18px] h-[18px]" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={8}>{item.label}</TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </nav>
        <div className="border-t border-border w-full shrink-0">
          <div className="py-2 flex flex-col items-center gap-0.5 px-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="w-10 h-10 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                  <Settings className="w-[16px] h-[16px]" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>Settings</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="w-10 h-10 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                  <Bell className="w-[16px] h-[16px]" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>Notifications</TooltipContent>
            </Tooltip>
          </div>
          <div className="px-2 pb-3 flex justify-center">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 cursor-pointer hover:ring-2 hover:ring-primary/20 transition-all" style={{ backgroundColor: "var(--accent)" }}>
                  <span className="text-[11px]" style={{ fontWeight: 600, color: "var(--primary)" }}>AA</span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                <div>
                  <p style={{ fontWeight: 500 }}>Ahtisham Ahmad</p>
                  <p className="opacity-70">admin@omnesoft.com</p>
                </div>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </aside>
    );
  }

  return (
    <div
      className="relative flex-shrink-0 h-full"
      style={{
        width: actualWidth,
        transition: (!hasMounted || isResizing) ? "none" : "width 200ms cubic-bezier(0.4, 0, 0.2, 1)",
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {collapsed && renderCollapsedBar()}

      <AnimatePresence>
        {collapsed && hoverExpanded && (
          <motion.aside
            key="sidebar-overlay"
            initial={{ x: -8, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -8, opacity: 0 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute left-0 top-0 h-full bg-card border-r border-border flex flex-col z-50"
            style={{
              width: sidebarWidth,
              borderTopRightRadius: 12,
              borderBottomRightRadius: 12,
              boxShadow: "0 20px 60px -12px rgba(0,0,0,0.15), 0 8px 20px -8px rgba(0,0,0,0.1)",
            }}
          >
            {renderFullContent(true)}
          </motion.aside>
        )}
      </AnimatePresence>

      {!collapsed && (
        <aside className="h-full bg-card border-r border-border flex flex-col overflow-hidden">
          {renderFullContent(false)}
        </aside>
      )}

      {!collapsed && (
        <div
          className="absolute right-0 top-0 bottom-0 w-[5px] cursor-col-resize z-30 group"
          onMouseDown={startResize}
          onDoubleClick={() => setCollapsedByUser(true)}
          title="Drag to resize · Double-click to collapse"
        >
          <div className={`absolute inset-y-0 right-0 w-[2px] transition-colors duration-150 ${isResizing ? "bg-[#0A77FF]" : "bg-transparent group-hover:bg-[#0A77FF]/40"}`} />
        </div>
      )}
    </div>
  );
}
