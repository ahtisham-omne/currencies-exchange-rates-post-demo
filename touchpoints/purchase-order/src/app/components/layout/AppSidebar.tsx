import React, { useState, useRef, useCallback } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  Settings,
  Bell,
  LogOut,
} from "lucide-react";
import { cn } from "../ui/utils";
import { Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip";
import { FONT } from "../designTokens";
import { NAV_ITEMS } from "./sidebar-config";
import type { NavItem } from "./sidebar-config";
import logoWordmark from "../../../assets/logo-wordmark.png";
import logoIcon from "../../../assets/logo-icon.png";

/* ── Constants ── */
const COLLAPSED_WIDTH = 56;
const MIN_WIDTH = 220;
const MAX_WIDTH = 420;
const DEFAULT_WIDTH = 260;

/* ═══════════════════════════════════════════════════════════════
   APP SIDEBAR — Collapsible / Resizable / Hover-to-Expand-in-Place
   ═══════════════════════════════════════════════════════════════ */

export default function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(true); // Start collapsed; hover to peek, click chevron to pin open
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const [hoverExpanded, setHoverExpanded] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<string[]>([
    "Supply Chain Management",
  ]);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Derived state ── */
  const isVisuallyExpanded = !collapsed || hoverExpanded;
  const currentVisualWidth = collapsed
    ? hoverExpanded
      ? DEFAULT_WIDTH
      : COLLAPSED_WIDTH
    : sidebarWidth;

  /* ── Active-state detection ── */
  const isItemActive = (item: NavItem): boolean => {
    // Homepage ("/") represents the Supply Chain Management module
    if (location.pathname === "/" && item.id === "supply-chain") return true;
    if (item.path === "/" && location.pathname === "/") return true;
    if (item.children) {
      return item.children.some((c) => location.pathname.startsWith(c.path));
    }
    if (
      item.path &&
      item.path !== "/" &&
      location.pathname.startsWith(item.path)
    )
      return true;
    return false;
  };

  /* ── Toggle group expansion ── */
  const toggleGroup = (label: string) => {
    setExpandedGroups((prev) =>
      prev.includes(label)
        ? prev.filter((g) => g !== label)
        : [...prev, label]
    );
  };

  /* ── Hover logic — expands the sidebar itself ── */
  const handleMouseEnter = () => {
    if (collapsed && !hoverExpanded) {
      hoverTimeoutRef.current = setTimeout(() => setHoverExpanded(true), 200);
    }
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    if (hoverExpanded) setHoverExpanded(false);
  };

  /* ── Pin open (from hover) ── */
  const pinOpen = () => {
    setCollapsed(false);
    setHoverExpanded(false);
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  };

  /* ── Resize handler ── */
  const startResize = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
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
      };
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [sidebarWidth]
  );

  /* ═══════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════ */

  // The outer div reserves space in the flex layout
  // When collapsed, we always reserve COLLAPSED_WIDTH — the hover expand overlays
  const layoutWidth = collapsed ? COLLAPSED_WIDTH : sidebarWidth;

  return (
    <div
      className="relative z-50 shrink-0 h-full"
      style={{
        width: layoutWidth,
        transition: isResizing ? "none" : "width 250ms cubic-bezier(.4,0,.2,1)",
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* The actual sidebar — positioned absolute so hover-expand overlays content */}
      <motion.aside
        className="absolute inset-y-0 left-0 flex flex-col bg-card border-r border-border overflow-hidden select-none"
        style={{
          zIndex: hoverExpanded ? 100 : 50,
          boxShadow: hoverExpanded ? "var(--elevation-sm)" : undefined,
        }}
        animate={{ width: currentVisualWidth }}
        transition={
          isResizing
            ? { duration: 0 }
            : { duration: 0.25, ease: [0.4, 0, 0.2, 1] }
        }
      >
        {/* ── Header ── */}
        <header
          className={cn(
            "flex h-12 w-full items-center border-b border-border shrink-0",
            isVisuallyExpanded ? "px-3 gap-2.5" : "justify-center px-2"
          )}
        >
          {isVisuallyExpanded ? (
            <button
              onClick={() => navigate("/")}
              className="flex items-center cursor-pointer transition-opacity hover:opacity-80"
              aria-label="Omnesoft Home"
            >
              <img src={logoWordmark} alt="Omnesoft" className="h-5 shrink-0" />
            </button>
          ) : (
            <button
              onClick={() => navigate("/")}
              className="w-9 h-9 rounded-lg flex items-center justify-center transition-all hover:ring-2 hover:ring-primary/20 cursor-pointer"
              aria-label="Omnesoft Home"
            >
              <img src={logoIcon} alt="Omnesoft" className="w-7 h-7" />
            </button>
          )}

          {/* Spacer + Collapse / Pin toggle */}
          <AnimatePresence>
            {isVisuallyExpanded && (
              <>
                <div className="flex-1" />
                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.1 }}
                  onClick={() => {
                    if (hoverExpanded) {
                      pinOpen();
                    } else {
                      setCollapsed(true);
                    }
                  }}
                  className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0"
                  aria-label={
                    hoverExpanded ? "Pin sidebar open" : "Collapse sidebar"
                  }
                >
                  {hoverExpanded ? (
                    <ChevronsRight className="w-4 h-4" />
                  ) : (
                    <ChevronsLeft className="w-4 h-4" />
                  )}
                </motion.button>
              </>
            )}
          </AnimatePresence>
        </header>

        {/* ── Navigation ── */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-2 px-2">
          <div className="space-y-px">
            {NAV_ITEMS.map((item) => {
              const active = isItemActive(item);
              const Icon = item.icon;
              const hasChildren = !!(item.children && item.children.length > 0);
              const isExpanded = expandedGroups.includes(item.label);

              /* ── Collapsed icon-only ── */
              if (!isVisuallyExpanded) {
                return (
                  <Tooltip key={item.id}>
                    <TooltipTrigger asChild>
                      <button
                        className={cn(
                          "w-full h-10 rounded-lg flex items-center justify-center transition-colors",
                          active
                            ? "text-primary"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                        style={{
                          backgroundColor: active
                            ? "rgba(10, 119, 255, 0.06)"
                            : undefined,
                        }}
                        onClick={() => {
                          if (item.path && !item.children) {
                            navigate(item.path);
                          }
                        }}
                        aria-label={item.label}
                      >
                        <Icon className="w-[18px] h-[18px]" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right">{item.label}</TooltipContent>
                  </Tooltip>
                );
              }

              /* ── Expanded with children ── */
              if (hasChildren) {
                return (
                  <div key={item.id}>
                    <button
                      className={cn(
                        "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] transition-all duration-150",
                        active
                          ? "text-primary"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                      style={{
                        fontFamily: FONT,
                        fontWeight: active ? 500 : 400,
                        backgroundColor: active
                          ? "rgba(10, 119, 255, 0.06)"
                          : undefined,
                      }}
                      onClick={() => toggleGroup(item.label)}
                    >
                      <Icon
                        className={cn(
                          "w-[18px] h-[18px] shrink-0",
                          active && "text-primary"
                        )}
                      />
                      <span className="flex-1 text-left truncate">
                        {item.label}
                      </span>
                      <ChevronDown
                        className={cn(
                          "w-3.5 h-3.5 transition-transform duration-200",
                          isExpanded ? "rotate-0" : "-rotate-90",
                          active ? "text-primary" : "text-muted-foreground"
                        )}
                      />
                    </button>
                    <AnimatePresence initial={false}>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2, ease: "easeInOut" }}
                          className="overflow-hidden"
                        >
                          <div
                            className="ml-[19px] mt-0.5 space-y-px border-l-[1.5px] pl-2.5 py-0.5"
                            style={{ borderColor: "#D6E8FF" }}
                          >
                            {item.children!.map((child) => {
                              /* Each child owns a unique pathname now (the
                                 three PO-listing tabs live on their own
                                 routes), so an exact pathname match is
                                 enough. `.startsWith(childPath + "/")`
                                 keeps sub-routes (PO detail, planner
                                 workspace) highlighting the parent. */
                              const childActive =
                                location.pathname === child.path ||
                                location.pathname.startsWith(child.path + "/");
                              return (
                                <NavLink
                                  key={child.path}
                                  to={child.path}
                                  className={cn(
                                    "block px-2.5 py-1 rounded-md text-[13px] transition-all duration-150",
                                    childActive
                                      ? "text-primary"
                                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                                  )}
                                  style={{
                                    fontFamily: FONT,
                                    fontWeight: childActive ? 500 : 400,
                                    backgroundColor: childActive
                                      ? "rgba(10, 119, 255, 0.05)"
                                      : undefined,
                                  }}
                                >
                                  {child.label}
                                </NavLink>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              }

              /* ── Expanded simple link ── */
              return (
                <NavLink
                  key={item.id}
                  to={item.path}
                  className={({ isActive: linkActive }) =>
                    cn(
                      "flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] transition-all duration-150",
                      linkActive
                        ? "text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )
                  }
                  style={({ isActive: linkActive }) => ({
                    fontFamily: FONT,
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

        {/* ── Bottom Section (Settings + Bell + User profile) ── */}
        <div className="border-t border-border shrink-0">
          {isVisuallyExpanded ? (
            <>
              <div className="px-2 py-1.5 flex items-center gap-1">
                <button
                  className="flex-1 flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[13px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  style={{ fontFamily: FONT, fontWeight: 400 }}
                >
                  <Settings className="w-4 h-4 shrink-0" />
                  <span className="truncate">Settings</span>
                </button>
                <button
                  className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0"
                  aria-label="Notifications"
                >
                  <Bell className="w-4 h-4" />
                </button>
              </div>
              <div className="px-2 pb-2">
                <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-muted transition-colors cursor-pointer">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                    style={{ backgroundColor: "hsl(var(--accent))" }}
                  >
                    <span
                      className="text-[11px]"
                      style={{
                        fontWeight: 600,
                        color: "hsl(var(--primary))",
                        fontFamily: FONT,
                      }}
                    >
                      AT
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-[13px] text-foreground truncate"
                      style={{ fontFamily: FONT, fontWeight: 500 }}
                    >
                      Areeb Tanvir
                    </p>
                    <p
                      className="text-[11px] text-muted-foreground truncate leading-tight"
                      style={{ fontFamily: FONT }}
                    >
                      admin@omnesoft.com
                    </p>
                  </div>
                  <LogOut className="w-4 h-4 text-muted-foreground shrink-0" />
                </div>
              </div>
            </>
          ) : (
            <div className="py-2 flex flex-col items-center gap-0.5 px-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    aria-label="Settings"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">Settings</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    aria-label="Notifications"
                  >
                    <Bell className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">Notifications</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className="w-10 h-10 rounded-full flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-primary/20 transition-all shrink-0"
                    style={{ backgroundColor: "hsl(var(--accent))" }}
                    aria-label="User profile"
                  >
                    <span
                      className="text-[11px]"
                      style={{
                        fontWeight: 600,
                        color: "hsl(var(--primary))",
                        fontFamily: FONT,
                      }}
                    >
                      AT
                    </span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <div className="text-[12px]">
                    <p style={{ fontWeight: 500 }}>Areeb Tanvir</p>
                    <p className="opacity-70">admin@omnesoft.com</p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>
      </motion.aside>

      {/* ── Resize handle (only when fully expanded, not hover) ── */}
      {!collapsed && (
        <div
          onMouseDown={startResize}
          onDoubleClick={() => setCollapsed(true)}
          className={cn(
            "absolute right-0 top-0 h-full w-[4px] cursor-col-resize hover:bg-primary/40 transition-colors z-[60]",
            isResizing && "bg-primary"
          )}
        />
      )}
    </div>
  );
}