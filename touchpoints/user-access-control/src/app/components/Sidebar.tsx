import { NavLink, useLocation, useNavigate } from "react-router-dom";
import type { MouseEvent as ReactMouseEvent } from "react";
import {
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  LogOut,
  Bell,
  Settings,
} from "lucide-react";
import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "./ui/tooltip";
import { NAV_ITEMS, EXACT_MATCH_PATHS } from "./sidebar/nav-data";
import type { NavItem } from "./sidebar/nav-data";
import { useViewer } from "../data/viewer";
import { getCompanyName } from "../data/tenant";
import { getInitials } from "../lib/avatar";

/* ─── Sidebar dimensions & storage ─── */
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

/* ─── Determine which nav sections are active from pathname ─── */
function getActiveSections(pathname: string): string[] {
  if (pathname === "/") return ["Company Setup"];

  const exactChildMatches: string[] = [];
  NAV_ITEMS.forEach((item) => {
    if (item.children?.some((child) => pathname === child.path)) {
      exactChildMatches.push(item.label);
    }
  });
  if (exactChildMatches.length > 0) return exactChildMatches;

  const prefixMatches: string[] = [];
  NAV_ITEMS.forEach((item) => {
    if (!item.children || item.children.length === 0) return;
    const isActive =
      pathname === item.path ||
      pathname.startsWith(item.path + "/") ||
      (item.path === "/partners" &&
        (pathname === "/vendors" || pathname.startsWith("/vendors/")));
    if (isActive) prefixMatches.push(item.label);
  });
  return prefixMatches;
}

/* ─── Logo Header ─── */
function SidebarLogo({
  isOverlay,
  onCollapse,
  onPin,
}: {
  isOverlay: boolean;
  onCollapse: () => void;
  onPin: () => void;
}) {
  return (
    <div className="h-[64px] px-4 flex items-center gap-3 border-b border-border shrink-0">
      <div
        className="w-9 h-9 rounded-[8px] flex items-center justify-center shrink-0"
        style={{ backgroundColor: "#007FFF" }}
      >
        <span
          className="text-white text-sm"
          style={{ fontWeight: 700, letterSpacing: "-0.02em" }}
        >
          O
        </span>
      </div>
      <div className="flex-1 flex flex-col min-w-0">
        <span
          className="text-[15px] text-foreground tracking-tight truncate"
          style={{ fontWeight: 600 }}
        >
          {/* The tenant's name: the sample's, or the company onboarding set up. */}
          {getCompanyName()}
        </span>
        <span
          className="text-[11px] text-muted-foreground leading-tight truncate"
          style={{ fontWeight: 400 }}
        >
          Enterprise Resource Planning
        </span>
      </div>
      <button
        onClick={isOverlay ? onPin : onCollapse}
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
  );
}

/* ─── Bottom Section ─── */
function SidebarFooter() {
  const viewer = useViewer();
  return (
    <div className="border-t border-border shrink-0">
      <div className="px-3 py-2 flex items-center gap-1">
        <button
          className="flex-1 flex items-center gap-2 px-3 py-2 rounded-[8px] text-[13px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          style={{ fontWeight: 400 }}
        >
          <Settings className="w-[16px] h-[16px] shrink-0" />
          <span className="truncate">Settings</span>
        </button>
        <button className="p-2 rounded-[8px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0">
          <Bell className="w-[16px] h-[16px]" />
        </button>
      </div>
      <div className="px-3 pb-3">
        <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-[8px] hover:bg-muted transition-colors cursor-pointer">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: "#EDF4FF" }}
          >
            <span
              className="text-[11px]"
              style={{ fontWeight: 600, color: "#007FFF" }}
            >
              {getInitials(viewer.name)}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p
              className="text-[13px] text-foreground truncate"
              style={{ fontWeight: 500 }}
            >
              {viewer.name}
            </p>
            <p className="text-[11px] text-muted-foreground truncate leading-tight">
              {viewer.email}
            </p>
          </div>
          <LogOut className="w-4 h-4 text-muted-foreground shrink-0" />
        </div>
      </div>
    </div>
  );
}

/* ─── Nav Section (parent with children) ─── */
function NavSection({
  item,
  isExpanded,
  isActive,
  onToggle,
}: {
  item: NavItem;
  isExpanded: boolean;
  isActive: boolean;
  onToggle: () => void;
}) {
  const Icon = item.icon;
  return (
    <div>
      <button
        onClick={onToggle}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[8px] text-[13px] transition-all duration-150 ${
          isActive
            ? "text-[#007FFF]"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        }`}
        style={{
          fontWeight: isActive ? 500 : 400,
          backgroundColor: isActive ? "rgba(10, 119, 255, 0.06)" : undefined,
        }}
      >
        <Icon
          className={`w-[18px] h-[18px] shrink-0 ${isActive ? "text-[#007FFF]" : ""}`}
        />
        <span className="flex-1 text-left truncate">{item.label}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 transition-transform duration-200 ${
            isExpanded ? "rotate-0" : "-rotate-90"
          } ${isActive ? "text-[#007FFF]" : "text-muted-foreground"}`}
        />
      </button>
      {isExpanded && item.children && (
        <div
          className="ml-[21px] mt-0.5 space-y-0.5 border-l-[1.5px] pl-3 py-0.5"
          style={{ borderColor: "#D6E8FF" }}
        >
          {item.children.map((child) =>
            child.externalUrl ? (
              <a
                key={child.path}
                href={child.externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block px-3 py-1.5 rounded-md text-[13px] transition-all duration-150 text-muted-foreground hover:text-foreground hover:bg-muted"
                style={{ fontWeight: 400 }}
              >
                {child.label}
              </a>
            ) : (
              <NavLink
                key={child.path}
                to={child.path}
                end={EXACT_MATCH_PATHS.has(child.path)}
                className={({ isActive: linkActive }) =>
                  `block px-3 py-1.5 rounded-md text-[13px] transition-all duration-150 ${
                    linkActive
                      ? "text-[#007FFF]"
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
            )
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Collapsed sidebar bar ─── */
function CollapsedBar({
  onExpand,
  isItemActive,
}: {
  onExpand: () => void;
  isItemActive: (item: NavItem) => boolean;
}) {
  const viewer = useViewer();
  return (
    <aside className="h-full bg-card border-r border-border flex flex-col items-center">
      {/* Logo */}
      <div className="h-[64px] flex items-center justify-center border-b border-border w-full shrink-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onExpand}
              className="w-9 h-9 rounded-[8px] flex items-center justify-center transition-all hover:ring-2 hover:ring-[#007FFF]/20"
              style={{ backgroundColor: "#007FFF" }}
              aria-label="Expand sidebar"
            >
              <span
                className="text-white text-sm"
                style={{ fontWeight: 700, letterSpacing: "-0.02em" }}
              >
                O
              </span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={8}>
            Expand Sidebar
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Nav icons */}
      <nav className="flex-1 overflow-y-auto py-3 w-full">
        <div className="flex flex-col items-center gap-0.5 px-2">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isItemActive(item);
            const disabled = item.disabled;

            return (
              <Tooltip key={item.label}>
                <TooltipTrigger asChild>
                  <div
                    className={`w-10 h-10 rounded-[8px] flex items-center justify-center transition-colors ${
                      active
                        ? "text-[#007FFF]"
                        : disabled
                        ? "text-muted-foreground cursor-not-allowed"
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
              <button className="w-10 h-10 rounded-[8px] flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                <Settings className="w-[16px] h-[16px]" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              Settings
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="w-10 h-10 rounded-[8px] flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
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
                className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 cursor-pointer hover:ring-2 hover:ring-[#007FFF]/20 transition-all"
                style={{ backgroundColor: "#EDF4FF" }}
              >
                <span
                  className="text-[11px]"
                  style={{ fontWeight: 600, color: "#007FFF" }}
                >
                  {getInitials(viewer.name)}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              <div>
                <p style={{ fontWeight: 500 }}>{viewer.name}</p>
                <p className="opacity-70">{viewer.email}</p>
              </div>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </aside>
  );
}

/* ═══════════════════════════════════════════════ */
/*  Main Sidebar Component                        */
/* ═══════════════════════════════════════════════ */

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();

  const [expandedItems, setExpandedItems] = useState<string[]>(() => {
    const expanded = getActiveSections(location.pathname);
    if (expanded.length === 0) expanded.push("Company Setup");
    return expanded;
  });
  const [collapsed, setCollapsed] = useState(() =>
    readStoredBoolean(STORAGE_KEY_COLLAPSED, false)
  );
  const [sidebarWidth, setSidebarWidth] = useState(() =>
    readStoredNumber(STORAGE_KEY_WIDTH, DEFAULT_WIDTH, MIN_WIDTH, MAX_WIDTH)
  );
  const [hoverExpanded, setHoverExpanded] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const actualWidth = collapsed ? COLLAPSED_WIDTH : sidebarWidth;

  const isItemActive = useCallback(
    (item: NavItem) => getActiveSections(location.pathname).includes(item.label),
    [location.pathname]
  );

  /* ─── Sync expanded items with route ─── */
  useEffect(() => {
    setExpandedItems(getActiveSections(location.pathname));
  }, [location.pathname]);

  /* ─── Persist state ─── */
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY_COLLAPSED, String(collapsed)); } catch { /* ignore */ }
  }, [collapsed]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY_WIDTH, String(sidebarWidth)); } catch { /* ignore */ }
  }, [sidebarWidth]);

  /* ─── Ctrl+B shortcut ─── */
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

  /* ─── Hover expand/collapse cleanup ─── */
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    };
  }, []);

  const handleSectionClick = (item: NavItem) => {
    if (item.externalUrl) {
      window.open(item.externalUrl, "_blank", "noopener,noreferrer");
      return;
    }
    const isExpanded = expandedItems.includes(item.label);
    const active = isItemActive(item);

    if (isExpanded && active) {
      setExpandedItems((prev) => prev.filter((l) => l !== item.label));
    } else {
      setExpandedItems([item.label]);
      if (item.children && item.children.length > 0) {
        navigate(item.children[0].path);
      }
    }
  };

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

  const handleMouseEnter = useCallback(() => {
    if (collapsed) {
      hoverTimeoutRef.current = setTimeout(() => setHoverExpanded(true), 200);
    }
  }, [collapsed]);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setHoverExpanded(false);
  }, []);

  /* ─── Full sidebar content (shared between pinned & overlay) ─── */
  function renderFullContent(isOverlay: boolean) {
    return (
      <>
        <SidebarLogo
          isOverlay={isOverlay}
          onCollapse={() => {
            setCollapsed(true);
            setHoverExpanded(false);
          }}
          onPin={() => {
            setCollapsed(false);
            setHoverExpanded(false);
          }}
        />

        <nav className="flex-1 overflow-y-auto py-3 px-3">
          <div className="space-y-0.5">
            {NAV_ITEMS.map((item) => {
              const hasChildren = item.children && item.children.length > 0;
              const active = isItemActive(item);
              const disabled = item.disabled;

              /* A locked module is non-interactive: rendered as a plain div with
               * no link/handler and no expandable children, so neither the module
               * nor its sub-items can be clicked. Checked before `hasChildren` so
               * it wins even though every module carries children. Mirrors the
               * Partners app's sidebar lock behavior. */
              if (disabled) {
                const Icon = item.icon;
                return (
                  <div
                    key={item.label}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-[8px] text-[13px] cursor-not-allowed text-muted-foreground"
                    style={{ fontWeight: 400 }}
                  >
                    <Icon className="w-[18px] h-[18px] shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </div>
                );
              }

              if (hasChildren) {
                return (
                  <NavSection
                    key={item.label}
                    item={item}
                    isExpanded={expandedItems.includes(item.label)}
                    isActive={active}
                    onToggle={() => handleSectionClick(item)}
                  />
                );
              }

              const Icon = item.icon;
              return (
                <NavLink
                  key={item.label}
                  to={item.path}
                  className={({ isActive: linkActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-[8px] text-[13px] transition-all duration-150 ${
                      linkActive
                        ? "text-[#007FFF]"
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

        <SidebarFooter />
      </>
    );
  }

  return (
    <div
      ref={wrapperRef}
      className="relative flex-shrink-0 h-full"
      style={{ width: actualWidth }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {collapsed && (
        <CollapsedBar
          onExpand={() => setCollapsed(false)}
          isItemActive={isItemActive}
        />
      )}

      <AnimatePresence>
        {collapsed && hoverExpanded && (
          <motion.aside
            key="sidebar-overlay"
            initial={{ x: -8, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -8, opacity: 0 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="fixed left-0 top-0 h-screen bg-card border-r border-border flex flex-col z-50"
            style={{
              width: sidebarWidth,
              borderTopRightRadius: 12,
              borderBottomRightRadius: 12,
              boxShadow:
                "0 20px 60px -12px rgba(0,0,0,0.15), 0 8px 20px -8px rgba(0,0,0,0.1)",
            }}
            onMouseEnter={() => {
              if (hoverTimeoutRef.current) {
                clearTimeout(hoverTimeoutRef.current);
                hoverTimeoutRef.current = null;
              }
            }}
            onMouseLeave={() => setHoverExpanded(false)}
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
          onDoubleClick={() => setCollapsed(true)}
          title="Drag to resize · Double-click to collapse"
        >
          <div
            className={`absolute inset-y-0 right-0 w-[2px] transition-colors duration-150 ${
              isResizing
                ? "bg-[#007FFF]"
                : "bg-transparent group-hover:bg-[#007FFF]/40"
            }`}
          />
        </div>
      )}
    </div>
  );
}
