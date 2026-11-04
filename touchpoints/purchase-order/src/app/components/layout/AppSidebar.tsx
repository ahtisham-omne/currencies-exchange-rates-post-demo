import React, { useState, useRef, useCallback } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronsLeft, ChevronsRight } from "lucide-react";
import { cn } from "../ui/utils";
import { Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip";
import { FONT } from "../designTokens";
import { NAV_ITEMS } from "./sidebar-config";
import type { NavItem } from "./sidebar-config";

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
  const [collapsed, setCollapsed] = useState(true); // Changed to true to start collapsed by default
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
        className="absolute inset-y-0 left-0 flex flex-col border-r border-sidebar-border overflow-hidden select-none"
        style={{
          backgroundColor: "var(--sidebar)",
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
        <header className="flex h-12 w-full items-center gap-3 border-b border-sidebar-border px-3 shrink-0">
          <button
            className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-lg)] shrink-0 cursor-pointer transition-transform hover:scale-105"
            style={{ backgroundColor: "var(--primary)" }}
            onClick={() => navigate("/")}
            aria-label="Omnesoft Home"
          >
            <span
              style={{
                color: "var(--primary-foreground)",
                fontSize: "var(--text-label)",
                fontWeight: "var(--font-weight-semibold)",
                fontFamily: FONT,
                lineHeight: "1",
              }}
            >
              O
            </span>
          </button>

          {/* Brand text — fades in/out */}
          <AnimatePresence>
            {isVisuallyExpanded && (
              <motion.div
                className="flex flex-1 flex-col overflow-hidden min-w-0"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15, delay: 0.05 }}
              >
                <span
                  className="text-foreground truncate"
                  style={{
                    fontSize: "var(--text-label)",
                    fontWeight: "var(--font-weight-semibold)",
                    fontFamily: FONT,
                    lineHeight: "20px",
                  }}
                >
                  Omnesoft
                </span>
                <span
                  className="text-muted-foreground truncate"
                  style={{
                    fontSize: "10px",
                    fontWeight: "var(--font-weight-normal)",
                    fontFamily: FONT,
                    lineHeight: "14px",
                  }}
                >
                  ERP Module
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Collapse / Pin toggle */}
          <AnimatePresence>
            {isVisuallyExpanded && (
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
                className="p-1.5 hover:bg-muted rounded-[var(--radius-sm)] text-muted-foreground cursor-pointer shrink-0"
                aria-label={
                  hoverExpanded ? "Pin sidebar open" : "Collapse sidebar"
                }
              >
                {hoverExpanded ? (
                  <ChevronsRight className="size-4" />
                ) : (
                  <ChevronsLeft className="size-4" />
                )}
              </motion.button>
            )}
          </AnimatePresence>
        </header>

        {/* ── Navigation ── */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden p-2 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const active = isItemActive(item);
            const Icon = item.icon;
            const hasChildren = !!(item.children && item.children.length > 0);
            const isExpanded = expandedGroups.includes(item.label);

            return (
              <div key={item.id}>
                {/* ── Collapsed icon-only item ── */}
                {!isVisuallyExpanded ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        className={cn(
                          "flex items-center justify-center w-full h-10 rounded-[var(--radius-md)] transition-all duration-150 cursor-pointer",
                          active
                            ? "bg-primary/10 text-primary shadow-sm"
                            : "text-muted-foreground hover:bg-primary/10 hover:text-primary"
                        )}
                        onClick={() => {
                          if (item.path && !item.children) {
                            navigate(item.path);
                          }
                        }}
                        aria-label={item.label}
                      >
                        {active ? (
                          <span
                            className="flex items-center justify-center size-7 rounded-[var(--radius-sm)]"
                            style={{ backgroundColor: "var(--primary-tint)" }}
                          >
                            <Icon className="size-[18px]" strokeWidth={1.5} style={{ color: "var(--primary)" }} />
                          </span>
                        ) : (
                          <Icon className="size-[18px]" strokeWidth={1.5} />
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right">{item.label}</TooltipContent>
                  </Tooltip>
                ) : (
                  /* ── Expanded item ── */
                  <>
                    {hasChildren ? (
                      <button
                        className={cn(
                          "flex items-center gap-3 w-full rounded-[var(--radius-md)] px-2.5 py-2 transition-colors cursor-pointer whitespace-nowrap",
                          active
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:bg-primary/10 hover:text-primary"
                        )}
                        style={{
                          fontSize: "13px",
                          fontWeight: active
                            ? "var(--font-weight-medium)"
                            : "var(--font-weight-normal)",
                          fontFamily: FONT,
                          lineHeight: "20px",
                        }}
                        onClick={() => toggleGroup(item.label)}
                      >
                        {active ? (
                          <span
                            className="flex items-center justify-center size-7 rounded-[var(--radius-sm)] shrink-0"
                            style={{ backgroundColor: "var(--primary-tint)" }}
                          >
                            <Icon
                              className="size-[18px]"
                              strokeWidth={1.5}
                              style={{ color: "var(--primary)" }}
                            />
                          </span>
                        ) : (
                          <Icon
                            className="size-[18px] shrink-0"
                            strokeWidth={1.5}
                          />
                        )}
                        <span className="flex-1 truncate text-left">
                          {item.label}
                        </span>
                        <ChevronDown
                          className={cn(
                            "size-3.5 transition-transform duration-200 shrink-0",
                            isExpanded ? "" : "-rotate-90"
                          )}
                        />
                      </button>
                    ) : (
                      <NavLink
                        to={item.path}
                        className={cn(
                          "flex items-center gap-3 rounded-[var(--radius-md)] px-2.5 py-2 transition-colors whitespace-nowrap",
                          active
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:bg-primary/10 hover:text-primary"
                        )}
                        style={{
                          fontSize: "13px",
                          fontWeight: active
                            ? "var(--font-weight-medium)"
                            : "var(--font-weight-normal)",
                          fontFamily: FONT,
                          lineHeight: "20px",
                        }}
                      >
                        {active ? (
                          <span
                            className="flex items-center justify-center size-7 rounded-[var(--radius-sm)] shrink-0"
                            style={{ backgroundColor: "var(--primary-tint)" }}
                          >
                            <Icon
                              className="size-[18px]"
                              strokeWidth={1.5}
                              style={{ color: "var(--primary)" }}
                            />
                          </span>
                        ) : (
                          <Icon
                            className="size-[18px] shrink-0"
                            strokeWidth={1.5}
                          />
                        )}
                        <span className="flex-1 truncate">{item.label}</span>
                      </NavLink>
                    )}

                    {/* ─ Children submenu (animated) ─ */}
                    {hasChildren && (
                      <AnimatePresence initial={false}>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{
                              duration: 0.2,
                              ease: "easeInOut",
                            }}
                            className="overflow-hidden"
                          >
                            <div className="ml-4 pl-3 border-l border-border space-y-0.5 py-1">
                              {item.children!.map((child) => {
                                const childActive =
                                  location.pathname === child.path;
                                const ChildIcon = child.icon;
                                return (
                                  <NavLink
                                    key={child.path}
                                    to={child.path}
                                    className={cn(
                                      "flex items-center gap-2.5 rounded-[var(--radius-sm)] px-2 py-1.5 transition-colors whitespace-nowrap",
                                      childActive
                                        ? "bg-primary/8 text-primary"
                                        : "text-muted-foreground hover:bg-primary/8 hover:text-primary"
                                    )}
                                    style={{
                                      fontSize: "12px",
                                      fontWeight: childActive
                                        ? "var(--font-weight-medium)"
                                        : "var(--font-weight-normal)",
                                      fontFamily: FONT,
                                      lineHeight: "18px",
                                    }}
                                  >
                                    {ChildIcon && (
                                      <ChildIcon
                                        className="size-3.5 shrink-0"
                                        strokeWidth={1.5}
                                      />
                                    )}
                                    <span className="truncate">
                                      {child.label}
                                    </span>
                                  </NavLink>
                                );
                              })}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </nav>
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