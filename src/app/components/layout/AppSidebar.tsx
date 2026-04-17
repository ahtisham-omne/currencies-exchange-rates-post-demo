import { NavLink, useLocation } from "react-router-dom";
import type { ComponentType, MouseEvent as ReactMouseEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import logoWordmark from "@/assets/2d714e5c28dc2bd9f7623aa6a3775402653c048e.png";
import logoIcon from "@/assets/62fad9647d1ac360c4b31106f9625b8201efb089.png";
import {
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  Boxes,
  Handshake,
  Truck,
  Factory,
  ShoppingCart,
  Calculator,
  UsersRound,
  Building2,
  LogOut,
  Bell,
  Settings,
} from "lucide-react";
import { useState, useRef, useCallback, useEffect } from "react";
import { Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip";

interface NavChild {
  label: string;
  path: string;
}

interface NavItem {
  label: string;
  icon: ComponentType<{ className?: string }>;
  path: string;
  disabled?: boolean;
  children?: NavChild[];
}

const navItems: NavItem[] = [
  {
    label: "Items & Inventory",
    icon: Boxes,
    path: "/items",
    disabled: true,
  },
  {
    label: "Partners Management",
    icon: Handshake,
    path: "/partners",
    children: [
      { label: "Overview", path: "/partners" },
      { label: "Partners", path: "/vendors" },
      { label: "Partner Groups", path: "/partners/groups" },
      { label: "Contacts Directory", path: "/partners/contacts" },
      { label: "Credit Management", path: "/partners/credit" },
      { label: "Carrier Management", path: "/partners/carriers" },
      { label: "Partner Locations", path: "/partners/locations" },
      { label: "Qualified Vendors", path: "/partners/qualified-vendors" },
      { label: "Reports & Analytics", path: "/partners/reports" },
    ],
  },
  {
    label: "Supply Chain Management",
    icon: Truck,
    path: "/supply-chain",
    disabled: true,
  },
  {
    label: "Production & Planning",
    icon: Factory,
    path: "/production",
    disabled: true,
  },
  {
    label: "Sales",
    icon: ShoppingCart,
    path: "/sales",
    disabled: true,
  },
  {
    label: "Accounting & Finance",
    icon: Calculator,
    path: "/accounting",
    children: [
      { label: "Overview", path: "/accounting" },
      { label: "Currency Library", path: "/accounting/currencies" },
      { label: "Exchange Rates", path: "/accounting/exchange-rates" },
    ],
  },
  {
    label: "People Management",
    icon: UsersRound,
    path: "/people",
    disabled: true,
  },
  {
    label: "Company Setup",
    icon: Building2,
    path: "/company-setup",
    disabled: true,
  },
];

const COLLAPSED_WIDTH = 60;
const MIN_WIDTH = 220;
const MAX_WIDTH = 420;
const DEFAULT_WIDTH = 272;
const STORAGE_KEY_COLLAPSED = "omnesoft:sidebar-collapsed";
const STORAGE_KEY_WIDTH = "omnesoft:sidebar-width";

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
  const [expandedItems, setExpandedItems] = useState<string[]>([
    "Partners Management",
    "Accounting & Finance",
  ]);
  const [collapsed, setCollapsed] = useState(() => readStoredBoolean(STORAGE_KEY_COLLAPSED, false));
  const [sidebarWidth, setSidebarWidth] = useState(() => readStoredNumber(STORAGE_KEY_WIDTH, DEFAULT_WIDTH, MIN_WIDTH, MAX_WIDTH));
  const [hoverExpanded, setHoverExpanded] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const actualWidth = collapsed ? COLLAPSED_WIDTH : sidebarWidth;

  /* ─── Persist sidebar state to localStorage ─── */
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY_COLLAPSED, String(collapsed)); } catch { /* ignore */ }
  }, [collapsed]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY_WIDTH, String(sidebarWidth)); } catch { /* ignore */ }
  }, [sidebarWidth]);

  /* ─── Ctrl+B keyboard shortcut to toggle sidebar ─── */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "b") {
        e.preventDefault();
        setCollapsed((prev) => !prev);
        setHoverExpanded(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const toggleExpand = (label: string) => {
    setExpandedItems((prev) =>
      prev.includes(label)
        ? prev.filter((l) => l !== label)
        : [...prev, label]
    );
  };

  const isItemActive = (item: NavItem) => {
    if (item.path === "/partners") {
      return (
        location.pathname === "/partners" ||
        location.pathname.startsWith("/partners/") ||
        location.pathname === "/vendors" ||
        location.pathname.startsWith("/vendors/")
      );
    }
    if (item.path === "/accounting") {
      return (
        location.pathname === "/accounting" ||
        location.pathname.startsWith("/accounting/")
      );
    }
    return (
      location.pathname === item.path ||
      location.pathname.startsWith(item.path + "/")
    );
  };

  /* ─── Resize ─── */
  const startResize = useCallback(
    (e: ReactMouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsResizing(true);
      const startX = e.clientX;
      const startWidth = sidebarWidth;

      const onMouseMove = (moveEvent: MouseEvent) => {
        const newWidth = Math.min(
          MAX_WIDTH,
          Math.max(MIN_WIDTH, startWidth + (moveEvent.clientX - startX))
        );
        setSidebarWidth(newWidth);
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
    },
    [sidebarWidth]
  );

  const handleResizeDoubleClick = useCallback(() => {
    setCollapsed(true);
  }, []);

  /* ─── Hover expand ─── */
  const handleMouseEnter = useCallback(() => {
    if (collapsed) {
      hoverTimeoutRef.current = setTimeout(() => {
        setHoverExpanded(true);
      }, 200);
    }
  }, [collapsed]);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setHoverExpanded(false);
  }, []);

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  /* ─── Full sidebar content (reused for expanded & overlay) ─── */
  function renderFullContent(isOverlay: boolean) {
    return (
      <>
        {/* Logo header */}
        <div className="h-12 px-3 flex items-center gap-2.5 border-b border-border shrink-0">
          <img src={logoWordmark} alt="Omnesoft" className="h-5 shrink-0" />
          <div className="flex-1 min-w-0">
            
          </div>
          <button
            onClick={() => {
              if (isOverlay) {
                /* Pin sidebar open */
                setCollapsed(false);
                setHoverExpanded(false);
              } else {
                /* Collapse sidebar */
                setCollapsed(true);
                setHoverExpanded(false);
              }
            }}
            className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0"
            title={isOverlay ? "Pin sidebar open" : "Collapse sidebar"}
          >
            {isOverlay ? (
              <ChevronsRight className="w-4 h-4" />
            ) : (
              <ChevronsLeft className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-2 px-2">
          <div className="space-y-px">
            {navItems.map((item) => {
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
                        active
                          ? "text-[#0A77FF]"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                      style={{
                        fontWeight: active ? 500 : 400,
                        backgroundColor: active
                          ? "rgba(10, 119, 255, 0.06)"
                          : undefined,
                      }}
                    >
                      <Icon
                        className={`w-[18px] h-[18px] shrink-0 ${
                          active ? "text-[#0A77FF]" : ""
                        }`}
                      />
                      <span className="flex-1 text-left truncate">
                        {item.label}
                      </span>
                      <ChevronDown
                        className={`w-3.5 h-3.5 transition-transform duration-200 ${
                          isExpanded ? "rotate-0" : "-rotate-90"
                        } ${
                          active
                            ? "text-[#0A77FF]"
                            : "text-muted-foreground"
                        }`}
                      />
                    </button>
                    {isExpanded && (
                      <div
                        className="ml-[19px] mt-0.5 space-y-px border-l-[1.5px] pl-2.5 py-0.5"
                        style={{ borderColor: "#D6E8FF" }}
                      >
                        {item.children!.map((child) => (
                          <NavLink
                            key={child.path}
                            to={child.path}
                            end={
                              child.path === "/vendors" ||
                              child.path === "/partners"
                            }
                            className={({ isActive: linkActive }) =>
                              `block px-2.5 py-1 rounded-md text-[13px] transition-all duration-150 ${
                                linkActive
                                  ? "text-[#0A77FF]"
                                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
                              }`
                            }
                            style={({ isActive: linkActive }) => ({
                              fontWeight: linkActive ? 500 : 400,
                              backgroundColor: linkActive
                                ? "rgba(10, 119, 255, 0.05)"
                                : undefined,
                            })}
                          >
                            {child.label}
                          </NavLink>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }

              if (disabled) {
                return (
                  <div
                    key={item.label}
                    className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] cursor-not-allowed"
                    style={{ fontWeight: 400, color: "#64748B" }}
                  >
                    <Icon className="w-[18px] h-[18px] shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </div>
                );
              }

              return (
                <NavLink
                  key={item.label}
                  to={item.path}
                  className={({ isActive: linkActive }) =>
                    `flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] transition-all duration-150 ${
                      linkActive
                        ? "text-[#0A77FF]"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`
                  }
                  style={({ isActive: linkActive }) => ({
                    fontWeight: linkActive ? 500 : 400,
                    backgroundColor: linkActive
                      ? "rgba(10, 119, 255, 0.06)"
                      : undefined,
                  })}
                >
                  <Icon className="w-[18px] h-[18px] shrink-0" />
                  <span className="truncate">{item.label}</span>
                </NavLink>
              );
            })}
          </div>
        </nav>

        {/* Bottom Section */}
        <div className="border-t border-border shrink-0">
          <div className="px-2 py-1.5 flex items-center gap-1">
            <button
              className="flex-1 flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[13px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              style={{ fontWeight: 400 }}
            >
              <Settings className="w-[16px] h-[16px] shrink-0" />
              <span className="truncate">Settings</span>
            </button>
            <button className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0">
              <Bell className="w-[16px] h-[16px]" />
            </button>
          </div>
          <div className="px-2 pb-2">
            <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-muted transition-colors cursor-pointer">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: "#EDF4FF" }}
              >
                <span
                  className="text-[11px]"
                  style={{ fontWeight: 600, color: "#0A77FF" }}
                >
                  AA
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className="text-[13px] text-foreground truncate"
                  style={{ fontWeight: 500 }}
                >
                  Ahtisham Ahmad
                </p>
                <p className="text-[11px] text-muted-foreground truncate leading-tight">
                  admin@omnesoft.com
                </p>
              </div>
              <LogOut className="w-4 h-4 text-muted-foreground shrink-0" />
            </div>
          </div>
        </div>
      </>
    );
  }

  /* ─── Collapsed icon bar ─── */
  function renderCollapsedBar() {
    return (
      <aside className="absolute inset-0 bg-card border-r border-border flex flex-col items-center z-10">
        {/* Logo */}
        <div className="h-12 flex items-center justify-center border-b border-border w-full shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setCollapsed(false)}
                className="w-9 h-9 rounded-lg flex items-center justify-center transition-all hover:ring-2 hover:ring-[#0A77FF]/20"
                aria-label="Expand sidebar"
              >
                <img src={logoIcon} alt="Omnesoft" className="w-7 h-7" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              Expand sidebar
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Nav icons */}
        <nav className="flex-1 overflow-y-auto py-3 w-full">
          <div className="flex flex-col items-center gap-0.5 px-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isItemActive(item);
              const disabled = item.disabled;

              return (
                <Tooltip key={item.label}>
                  <TooltipTrigger asChild>
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                        active
                          ? "text-[#0A77FF]"
                          : disabled
                          ? "text-muted-foreground/50 cursor-not-allowed"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
                      }`}
                      style={{
                        backgroundColor: active
                          ? "rgba(10, 119, 255, 0.06)"
                          : undefined,
                      }}
                    >
                      <Icon className="w-[18px] h-[18px]" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={8}>
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </nav>

        {/* Bottom icons */}
        <div className="border-t border-border w-full shrink-0">
          <div className="py-2 flex flex-col items-center gap-0.5 px-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="w-10 h-10 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                  <Settings className="w-[16px] h-[16px]" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                Settings
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="w-10 h-10 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                  <Bell className="w-[16px] h-[16px]" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                Notifications
              </TooltipContent>
            </Tooltip>
          </div>
          <div className="px-2 pb-3 flex justify-center">
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 cursor-pointer hover:ring-2 hover:ring-[#0A77FF]/20 transition-all"
                  style={{ backgroundColor: "#EDF4FF" }}
                >
                  <span
                    className="text-[11px]"
                    style={{ fontWeight: 600, color: "#0A77FF" }}
                  >
                    AA
                  </span>
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
      ref={wrapperRef}
      className="relative flex-shrink-0 h-full"
      style={{
        width: actualWidth,
        transition: isResizing ? "none" : "width 200ms cubic-bezier(0.4, 0, 0.2, 1)",
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Collapsed icon bar (visible when collapsed) */}
      {collapsed && renderCollapsedBar()}

      {/* Hover overlay (animated, visible when collapsed + hovering) */}
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
              boxShadow:
                "0 20px 60px -12px rgba(0,0,0,0.15), 0 8px 20px -8px rgba(0,0,0,0.1)",
            }}
          >
            {renderFullContent(true)}
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Normal expanded sidebar */}
      {!collapsed && (
        <aside className="h-full bg-card border-r border-border flex flex-col overflow-hidden">
          {renderFullContent(false)}
        </aside>
      )}

      {/* Resize handle (expanded mode only) */}
      {!collapsed && (
        <div
          className="absolute right-0 top-0 bottom-0 w-[5px] cursor-col-resize z-30 group"
          onMouseDown={startResize}
          onDoubleClick={handleResizeDoubleClick}
          title="Drag to resize · Double-click to collapse"
        >
          <div
            className={`absolute inset-y-0 right-0 w-[2px] transition-colors duration-150 ${
              isResizing
                ? "bg-[#0A77FF]"
                : "bg-transparent group-hover:bg-[#0A77FF]/40"
            }`}
          />
        </div>
      )}
    </div>
  );
}