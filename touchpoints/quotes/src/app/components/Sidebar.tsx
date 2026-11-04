/**
 * Sales Module Sidebar — collapsible, hover-expandable, resizable.
 * Ported from Sales Order V5's AppSidebar pattern.
 */
import { useLocation, useNavigate } from "react-router-dom";
import type { ComponentType, MouseEvent as ReactMouseEvent } from "react";
import {
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  FileText,
  ShoppingCart,
  Receipt,
  BarChart3,
  Package,
  RotateCcw,
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
  { label: "Items & Inventory", icon: Boxes, path: "/items", disabled: true },
  { label: "Partners Management", icon: Handshake, path: "/partners", disabled: true },
  { label: "Supply Chain", icon: Truck, path: "/supply-chain", disabled: true },
  { label: "Production", icon: Factory, path: "/production", disabled: true },
  {
    label: "Sales",
    icon: ShoppingCart,
    path: "/",
    children: [
      { label: "Overview", path: "/" },
      { label: "Quotes", path: "/quotes" },
      { label: "Sales Orders", path: "/sales-orders" },
      { label: "Invoicing", path: "/invoicing" },
      { label: "Inventory Allocation", path: "/allocation" },
      { label: "Sales Analytics", path: "/analytics" },
      { label: "Returns & Credits", path: "/returns" },
    ],
  },
  { label: "Accounting", icon: Calculator, path: "/accounting", disabled: true },
  { label: "People", icon: UsersRound, path: "/people", disabled: true },
  { label: "Company Setup", icon: Building2, path: "/company-setup", disabled: true },
];

const COLLAPSED_WIDTH = 60;
const MIN_WIDTH = 220;
const MAX_WIDTH = 420;
const DEFAULT_WIDTH = 260;

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [expandedItems, setExpandedItems] = useState<string[]>(["Sales"]);
  const [collapsed, setCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_WIDTH);
  const [hoverExpanded, setHoverExpanded] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const actualWidth = collapsed ? COLLAPSED_WIDTH : sidebarWidth;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "b") {
        e.preventDefault();
        setCollapsed(prev => !prev);
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
      return location.pathname === "/" || location.pathname.startsWith("/quotes");
    }
    return location.pathname === item.path || location.pathname.startsWith(item.path + "/");
  };

  const isChildActive = (path: string) => {
    if (path === "/quotes") return location.pathname === "/" || location.pathname.startsWith("/quotes");
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
        <div className="h-12 px-3 flex items-center gap-2.5 border-b border-border shrink-0">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground" style={{ fontSize: 11, fontWeight: 700 }}>O</span>
          </div>
          <span className="text-foreground text-[13px] flex-1 truncate" style={{ fontWeight: 600 }}>Omnesoft</span>
          <button
            onClick={() => { if (isOverlay) { setCollapsed(false); setHoverExpanded(false); } else { setCollapsed(true); setHoverExpanded(false); } }}
            className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0"
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
                return (
                  <div key={item.label} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] cursor-not-allowed" style={{ fontWeight: 400, color: "#64748B" }}>
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
              <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "#EDF4FF" }}>
                <span className="text-[11px]" style={{ fontWeight: 600, color: "#0A77FF" }}>AA</span>
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
          <button onClick={() => setCollapsed(false)} className="w-9 h-9 rounded-lg flex items-center justify-center transition-all hover:ring-2 hover:ring-[#0A77FF]/20">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground" style={{ fontSize: 11, fontWeight: 700 }}>O</span>
            </div>
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto py-3 w-full">
          <div className="flex flex-col items-center gap-0.5 px-2">
            {navItems.map(item => {
              const Icon = item.icon;
              const active = isItemActive(item);
              const disabled = item.disabled;
              return (
                <div
                  key={item.label}
                  className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                    active ? "text-[#0A77FF]" : disabled ? "text-muted-foreground/50 cursor-not-allowed" : "text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
                  }`}
                  style={{ backgroundColor: active ? "rgba(10, 119, 255, 0.06)" : undefined }}
                  title={item.label}
                >
                  <Icon className="w-[18px] h-[18px]" />
                </div>
              );
            })}
          </div>
        </nav>
        <div className="border-t border-border w-full shrink-0">
          <div className="py-2 flex flex-col items-center gap-0.5 px-2">
            <button className="w-10 h-10 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" title="Settings">
              <Settings className="w-[16px] h-[16px]" />
            </button>
            <button className="w-10 h-10 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" title="Notifications">
              <Bell className="w-[16px] h-[16px]" />
            </button>
          </div>
          <div className="px-2 pb-3 flex justify-center">
            <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 cursor-pointer hover:ring-2 hover:ring-[#0A77FF]/20 transition-all" style={{ backgroundColor: "#EDF4FF" }}>
              <span className="text-[11px]" style={{ fontWeight: 600, color: "#0A77FF" }}>AA</span>
            </div>
          </div>
        </div>
      </aside>
    );
  }

  return (
    <div
      className="relative flex-shrink-0 h-full"
      style={{ width: actualWidth, transition: isResizing ? "none" : "width 200ms cubic-bezier(0.4, 0, 0.2, 1)" }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {collapsed && renderCollapsedBar()}
      {collapsed && hoverExpanded && (
        <aside
          className="absolute left-0 top-0 h-full bg-card border-r border-border flex flex-col z-50"
          style={{ width: sidebarWidth, borderTopRightRadius: 12, borderBottomRightRadius: 12, boxShadow: "0 20px 60px -12px rgba(0,0,0,0.15), 0 8px 20px -8px rgba(0,0,0,0.1)", animation: "slideIn 150ms ease-out" }}
        >
          {renderFullContent(true)}
        </aside>
      )}
      {!collapsed && (
        <aside className="h-full bg-card border-r border-border flex flex-col overflow-hidden">
          {renderFullContent(false)}
        </aside>
      )}
      {!collapsed && (
        <div className="absolute right-0 top-0 bottom-0 w-[5px] cursor-col-resize z-30 group" onMouseDown={startResize} onDoubleClick={() => setCollapsed(true)}>
          <div className={`absolute inset-y-0 right-0 w-[2px] transition-colors duration-150 ${isResizing ? "bg-[#0A77FF]" : "bg-transparent group-hover:bg-[#0A77FF]/40"}`} />
        </div>
      )}
    </div>
  );
}
