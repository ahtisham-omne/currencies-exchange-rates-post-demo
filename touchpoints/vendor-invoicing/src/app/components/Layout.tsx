import {
  useState,
  useRef,
  useCallback,
  useEffect,
  type ComponentType,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { motion, AnimatePresence } from 'motion/react';
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
  Search,
  Plus,
  ExternalLink,
} from 'lucide-react';
import logoWordmark from '@/assets/omne-wordmark.png';
import logoIcon from '@/assets/omne-icon.png';
import userPhoto from '@/assets/ahtisham-ahmad.jpg';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/app/components/ui/tooltip';
import { SystemSettingsModal } from '@/app/components/SystemSettingsModal';
import { ArSettingsModal } from '@/app/components/customer/ArSettingsModal';
import { ApSettingsModal, type ApSettingsScope } from '@/app/components/ApSettingsModal';
import { Input } from '@/app/components/ui/input';
import { Button } from '@/app/components/ui/button';
import { palette, accent } from '@/styles/tokens';
import { CollapseReveal } from '@/app/components/ui/collapse-reveal';
import { embedded } from '@/embedding';

export type AppView =
  | 'overview'
  | 'dashboard'
  | 'invoices'
  | 'prepayments'
  | 'payments-v2'
  | 'customer-invoices'
  | 'customer-payments'
  | 'receiving';

interface LayoutProps {
  children: React.ReactNode;
  activeView: AppView;
  onViewChange: (view: AppView) => void;
}

interface NavChild {
  label: string;
  /** In-app view to switch to when this nav item is clicked. Required when
   *  externalHref is absent. */
  view?: AppView;
  /** When set, clicking the nav item opens this URL in a new browser tab
   *  instead of switching the in-app view. Used for cross-module links
   *  (e.g. Cash Management lives in a sibling Lovable app). */
  externalHref?: string;
  /** When true, render as a disabled "Coming soon" entry — the item shows
   *  in the nav as its own entity but isn't navigable yet. Used for the AR
   *  side (Customer Invoicing / Customer Payments) until those ship. */
  comingSoon?: boolean;
  /** When true, render greyed-out and non-interactive with no badge —
   *  used for deprecated surfaces kept visible for reference (V1). */
  disabled?: boolean;
}

interface NavItem {
  label: string;
  icon: ComponentType<{ className?: string }>;
  active?: boolean;
  disabled?: boolean;
  children?: NavChild[];
}

// External URL for accounting modules that live in the sibling Cash
// Management Lovable app — Currency Library, Exchange Rates, Cash Management
// all link to this single landing page in a new tab.
const ACCOUNTING_EXTERNAL_URL = 'https://cash-management-v2.lovable.app/accounting';

// Updated Accounting & Finance IA — only Overview, Invoicing, and Payments
// route internally in this app. The rest are landing-page links to the
// sibling Cash Management Lovable app (placeholder until each one is
// built out as its own internal module).
//
// Per BA feedback:
//   - AP and AR are now first-class nav entities instead of in-page tabs:
//     Vendor Invoicing / Vendor Payments route internally; Customer
//     Invoicing / Customer Payments are "Coming soon" placeholders (the AR
//     module isn't built yet) — they show as their own entries so the IA
//     reads as four distinct ledgers.
//   - Vendor Invoicing's route + AppView stay as 'invoices' so existing
//     deep links don't break. Vendor Payments runs the V2 workspace on
//     'payments-v2'; the deprecated V1 'payments' surface was removed.
//   - "Chart of Accounts" + "General Ledger" merged to one item
//     (they already linked to the same external destination)
//   - "Currency Library" + "Exchange Rate Library" merged similarly
//   - "Costing Methods" lives under Company Setup now (one-time setup,
//     not a recurring task) — see COMPANY_SETUP_CHILDREN below
const FINANCE_CHILDREN: NavChild[] = [
  { label: 'Overview', view: 'overview' },
  { label: 'Dashboard', view: 'dashboard' },
  { label: 'Vendor Invoicing', view: 'invoices' },
  { label: 'Vendor Payments', view: 'payments-v2' },
  // AR modules (7/17/26): the same screens as the AP side running on the
  // same data — a terminology layer swaps vendor/PO wording for
  // customer/SO while these views are active.
  { label: 'Customer Invoicing', view: 'customer-invoices' },
  { label: 'Customer Payments', view: 'customer-payments' },
  { label: 'Chart of Accounts & General Ledger', externalHref: ACCOUNTING_EXTERNAL_URL },
  { label: 'Currency Library & Exchange Rate Library', externalHref: ACCOUNTING_EXTERNAL_URL },
  { label: 'Cash Management', externalHref: ACCOUNTING_EXTERNAL_URL },
  { label: 'Financial Reporting', externalHref: ACCOUNTING_EXTERNAL_URL },
];

const COMPANY_SETUP_CHILDREN: NavChild[] = [
  { label: 'Costing Methods', externalHref: ACCOUNTING_EXTERNAL_URL },
];

const navItems: NavItem[] = [
  { label: 'Items & Inventory', icon: Boxes, disabled: true },
  { label: 'Partners Management', icon: Handshake, disabled: true },
  { label: 'Supply Chain Management', icon: Truck, disabled: true },
  { label: 'Production & Planning', icon: Factory, disabled: true },
  { label: 'Sales', icon: ShoppingCart, disabled: true },
  { label: 'Accounting & Finance', icon: Calculator, active: true, children: FINANCE_CHILDREN },
  { label: 'People Management', icon: UsersRound, disabled: true },
  { label: 'Company Setup', icon: Building2, children: COMPANY_SETUP_CHILDREN },
];

const COLLAPSED_WIDTH = 60;
const MIN_WIDTH = 220;
const MAX_WIDTH = 420;
const DEFAULT_WIDTH = 272;
const STORAGE_KEY_COLLAPSED = 'omnesoft:sidebar-collapsed';
const STORAGE_KEY_WIDTH = 'omnesoft:sidebar-width';

function readStoredBoolean(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    if (v === 'true') return true;
    if (v === 'false') return false;
  } catch {
    /* ignore */
  }
  return fallback;
}

function readStoredNumber(key: string, fallback: number, min: number, max: number): number {
  try {
    const v = localStorage.getItem(key);
    if (v !== null) {
      const n = Number(v);
      if (!Number.isNaN(n) && n >= min && n <= max) return n;
    }
  } catch {
    /* ignore */
  }
  return fallback;
}

function Sidebar({
  activeView,
  onViewChange,
}: {
  activeView: AppView;
  onViewChange: (v: AppView) => void;
}) {
  const [expandedItems, setExpandedItems] = useState<string[]>(['Accounting & Finance']);
  const [collapsed, setCollapsed] = useState(() => readStoredBoolean(STORAGE_KEY_COLLAPSED, false));
  const [sidebarWidth, setSidebarWidth] = useState(() =>
    readStoredNumber(STORAGE_KEY_WIDTH, DEFAULT_WIDTH, MIN_WIDTH, MAX_WIDTH)
  );
  const [hoverExpanded, setHoverExpanded] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => {
    requestAnimationFrame(() => setHasMounted(true));
  }, []);

  const actualWidth = collapsed ? COLLAPSED_WIDTH : sidebarWidth;

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_COLLAPSED, String(collapsed));
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_WIDTH, String(sidebarWidth));
    } catch {
      /* ignore */
    }
  }, [sidebarWidth]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        setCollapsed((prev) => !prev);
        setHoverExpanded(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const toggleExpand = (label: string) => {
    setExpandedItems((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
    );
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
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [sidebarWidth]
  );

  const handleResizeDoubleClick = useCallback(() => {
    setCollapsed(true);
  }, []);

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

  function renderFullContent(isOverlay: boolean) {
    return (
      <>
        {/* Logo */}
        <div className="h-12 px-3 flex items-center gap-2.5 border-b border-border shrink-0">
          <img src={logoWordmark} alt="Omnesoft" className="h-5 shrink-0" />
          <div className="flex-1 min-w-0" />
          <button
            onClick={() => {
              if (isOverlay) {
                setCollapsed(false);
                setHoverExpanded(false);
              } else {
                setCollapsed(true);
                setHoverExpanded(false);
              }
            }}
            className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0"
            title={isOverlay ? 'Pin sidebar open' : 'Collapse sidebar'}
          >
            {isOverlay ? <ChevronsRight className="w-4 h-4" /> : <ChevronsLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-2 px-2">
          <div className="space-y-px">
            {navItems.map((item) => {
              const Icon = item.icon;
              const hasChildren = !!item.children?.length;
              const isExpanded = expandedItems.includes(item.label);
              const active = !!item.active;

              if (hasChildren) {
                return (
                  <div key={item.label}>
                    <button
                      onClick={() => toggleExpand(item.label)}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] transition-all duration-150 ${
                        active
                          ? 'text-primary'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                      style={{
                        fontWeight: active ? 500 : 400,
                        backgroundColor: active ? 'rgba(10, 119, 255, 0.06)' : undefined,
                      }}
                    >
                      <Icon
                        className={`w-[18px] h-[18px] shrink-0 ${active ? 'text-primary' : ''}`}
                      />
                      <span className="flex-1 text-left truncate">{item.label}</span>
                      <ChevronDown
                        className={`w-3.5 h-3.5 transition-transform duration-200 ${
                          isExpanded ? 'rotate-0' : '-rotate-90'
                        } ${active ? 'text-primary' : 'text-muted-foreground'}`}
                      />
                    </button>
                    <CollapseReveal open={isExpanded}>
                      <div
                        className="ml-[19px] mt-0.5 space-y-px border-l-[1.5px] pl-2.5 py-0.5"
                        style={{ borderColor: accent.pillHover }}
                      >
                        {item.children!.map((child) => {
                          const linkActive = child.view ? activeView === child.view : false;
                          const isExternal = !!child.externalHref;

                          // AR placeholders — shown as their own nav entity but
                          // not navigable yet. Disabled + "Soon" badge, matching
                          // the disabled-tab pattern used elsewhere in the app.
                          // Deprecated entries: greyed out, no badge, no click.
                          if (child.disabled) {
                            return (
                              <div
                                key={child.label}
                                className="flex items-center w-full text-left px-2.5 py-1 rounded-md text-[13px] text-muted-foreground/50 cursor-not-allowed select-none"
                                style={{ fontWeight: 400 }}
                              >
                                <span className="truncate">{child.label}</span>
                              </div>
                            );
                          }

                          if (child.comingSoon) {
                            return (
                              <div
                                key={child.label}
                                title={`${child.label}, coming soon.`}
                                className="flex items-center justify-between w-full text-left px-2.5 py-1 rounded-md text-[13px] text-muted-foreground/60 cursor-not-allowed select-none"
                                style={{ fontWeight: 400 }}
                              >
                                <span className="truncate">{child.label}</span>
                                <span
                                  className="inline-flex items-center whitespace-nowrap px-1.5 py-0 rounded-md text-[10px] bg-slate-50 text-slate-400 border border-slate-200 shrink-0 ml-2"
                                  style={{ fontWeight: 500 }}
                                >
                                  Coming Soon
                                </span>
                              </div>
                            );
                          }

                          return (
                            <button
                              key={child.label}
                              onClick={() => {
                                if (isExternal) {
                                  window.open(child.externalHref!, '_blank', 'noopener');
                                  return;
                                }
                                if (child.view) onViewChange(child.view);
                              }}
                              className={`flex items-center justify-between w-full text-left px-2.5 py-1 rounded-md text-[13px] transition-all duration-150 group/navchild ${
                                linkActive
                                  ? 'text-primary'
                                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                              }`}
                              style={{
                                fontWeight: linkActive ? 500 : 400,
                                backgroundColor: linkActive ? 'rgba(10, 119, 255, 0.05)' : undefined,
                              }}
                            >
                              <span>{child.label}</span>
                              {isExternal && (
                                <ExternalLink
                                  className="w-3 h-3 opacity-0 group-hover/navchild:opacity-60 transition-opacity shrink-0"
                                  aria-label="opens in new tab"
                                />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </CollapseReveal>
                  </div>
                );
              }

              return (
                <div
                  key={item.label}
                  className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] cursor-not-allowed"
                  style={{ fontWeight: 400, color: palette.slate[500] }}
                >
                  <Icon className="w-[18px] h-[18px] shrink-0" />
                  <span className="truncate">{item.label}</span>
                </div>
              );
            })}
          </div>
        </nav>

        {/* Footer */}
        <div className="border-t border-border shrink-0">
          <div className="px-2 py-1.5 flex items-center gap-1">
            {/* Disabled (BA 9/8): the nav Settings opened the System
                settings modal, which isn't this entry's job — parked
                until a real settings surface exists. */}
            <button
              disabled
              aria-disabled="true"
              className="flex-1 flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[13px] text-muted-foreground/40 cursor-not-allowed"
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
              <div className="w-8 h-8 rounded-full shrink-0 overflow-hidden">
                <img src={userPhoto} alt="Ahtisham Ahmad" className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] text-foreground truncate" style={{ fontWeight: 500 }}>
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

  function renderCollapsedBar() {
    return (
      <aside className="absolute inset-0 bg-card border-r border-border flex flex-col items-center z-10">
        <div className="h-12 flex items-center justify-center border-b border-border w-full shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setCollapsed(false)}
                className="w-9 h-9 rounded-lg flex items-center justify-center transition-all hover:ring-2 hover:ring-primary/20"
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

        <nav className="flex-1 overflow-y-auto py-3 w-full">
          <div className="flex flex-col items-center gap-0.5 px-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = !!item.active;
              const disabled = item.disabled;
              return (
                <Tooltip key={item.label}>
                  <TooltipTrigger asChild>
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                        active
                          ? 'text-primary'
                          : disabled
                          ? 'text-muted-foreground/50 cursor-not-allowed'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer'
                      }`}
                      style={{
                        backgroundColor: active ? 'rgba(10, 119, 255, 0.06)' : undefined,
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

        <div className="border-t border-border w-full shrink-0">
          <div className="py-2 flex flex-col items-center gap-0.5 px-2">
            <Tooltip>
              <TooltipTrigger asChild>
                {/* Disabled (BA 9/8) — see the expanded-rail twin. */}
                <span className="inline-flex">
                  <button
                    disabled
                    aria-disabled="true"
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-muted-foreground/40 cursor-not-allowed"
                  >
                    <Settings className="w-[16px] h-[16px]" />
                  </button>
                </span>
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
                <div className="w-10 h-10 rounded-full shrink-0 overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary/20 transition-all">
                  <img src={userPhoto} alt="Ahtisham Ahmad" className="w-full h-full object-cover" />
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
      // The sidebar names BOTH ledgers (Vendor/Customer Invoicing), so the
      // AR terminology layer must never rewrite it.
      data-term-keep=""
      className="relative flex-shrink-0 h-full"
      style={{
        width: actualWidth,
        transition: !hasMounted || isResizing ? 'none' : 'width 200ms cubic-bezier(0.4, 0, 0.2, 1)',
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
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute left-0 top-0 h-full bg-card border-r border-border flex flex-col z-50"
            style={{
              width: sidebarWidth,
              borderTopRightRadius: 12,
              borderBottomRightRadius: 12,
              boxShadow:
                '0 20px 60px -12px rgba(0,0,0,0.15), 0 8px 20px -8px rgba(0,0,0,0.1)',
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
        // Deliberately no z-index: the app's modals render inside <main>
        // (which is a z-0 stacking context), so any z here would float the
        // handle above every overlay and keep it draggable behind modals.
        // With z-auto the handle still wins over the sidebar's own static
        // content, but full-screen overlays (painted later in the DOM) cover it.
        <div
          className="absolute right-0 top-0 bottom-0 w-[5px] cursor-col-resize group"
          onMouseDown={startResize}
          onDoubleClick={handleResizeDoubleClick}
          title="Drag to resize · Double-click to collapse"
        >
          <div
            className={`absolute inset-y-0 right-0 w-[2px] transition-colors duration-150 ${
              isResizing ? 'bg-primary' : 'bg-transparent group-hover:bg-primary/40'
            }`}
          />
        </div>
      )}

      <SystemSettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}

function TopBar({
  section,
  leaf,
  onSectionClick,
  customerSettings,
  apSettings,
}: {
  section: string;
  leaf?: string;
  onSectionClick?: () => void;
  /** Customer Invoices pages swap the + for the module settings gear
   *  (user 10/27). Every other page keeps the + exactly as before. */
  customerSettings?: boolean;
  /** Vendor Invoicing and Vendor Payments get their own settings gear the
   *  same way (Currency & Exchange Rates: module defaults, rate permissions). */
  apSettings?: ApSettingsScope;
}) {
  const [arSettingsOpen, setArSettingsOpen] = useState(false);
  const [apSettingsOpen, setApSettingsOpen] = useState(false);
  const apSettingsLabel = apSettings === 'payments' ? 'Vendor payments settings' : 'Vendor invoicing settings';
  return (
    // px-3 matches the module's 12px page gutter so the breadcrumb, page
    // header text, and content cards all share one left edge.
    <div className="flex items-center justify-between px-3 h-12 border-b border-border bg-card shrink-0">
      <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
        {leaf ? (
          <>
            <button
              onClick={onSectionClick}
              className="hover:text-foreground transition-colors cursor-pointer"
              style={{ fontWeight: 500 }}
            >
              {section}
            </button>
            <span className="text-muted-foreground">/</span>
            <span style={{ fontWeight: 500 }} className="text-foreground">
              {leaf}
            </span>
          </>
        ) : (
          <span style={{ fontWeight: 500 }} className="text-foreground">
            {section}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        {customerSettings ? (
          <>
            <Tooltip delayDuration={200}>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 w-8 p-0" aria-label="Customer invoicing settings" onClick={() => setArSettingsOpen(true)}>
                  <Settings className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Customer invoicing settings</TooltipContent>
            </Tooltip>
            <ArSettingsModal open={arSettingsOpen} onOpenChange={setArSettingsOpen} />
          </>
        ) : apSettings ? (
          <>
            <Tooltip delayDuration={200}>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 w-8 p-0" aria-label={apSettingsLabel} onClick={() => setApSettingsOpen(true)}>
                  <Settings className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">{apSettingsLabel}</TooltipContent>
            </Tooltip>
            <ApSettingsModal open={apSettingsOpen} onOpenChange={setApSettingsOpen} scope={apSettings} />
          </>
        ) : (
          <Button variant="outline" size="sm" className="h-8 w-8 p-0">
            <Plus className="w-4 h-4" />
          </Button>
        )}
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
          <Input
            placeholder="Search..."
            className="pl-9 w-[260px] h-8 bg-white border-border/60 text-[13px] placeholder:text-muted-foreground/50"
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full overflow-hidden">
            <img src={userPhoto} alt="Ahtisham Ahmad" className="w-full h-full object-cover" />
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
  );
}

const BREADCRUMB_LEAF: Record<AppView, string | undefined> = {
  overview: undefined,
  dashboard: 'Dashboard',
  invoices: 'Vendor Invoicing',
  prepayments: 'Vendor Prepayments',
  'payments-v2': 'Vendor Payments',
  'customer-invoices': 'Customer Invoicing',
  'customer-payments': 'Customer Payments',
  receiving: 'Receiving Documents',
};

export function Layout({ children, activeView, onViewChange }: LayoutProps) {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* Inside the Currency & Exchange Rates shell, its sidebar stands in for this one. */}
      {!embedded && <Sidebar activeView={activeView} onViewChange={onViewChange} />}
      <main className="flex-1 min-w-0 overflow-hidden flex flex-col relative z-0">
        <TopBar
          section="Accounting & Finance"
          leaf={BREADCRUMB_LEAF[activeView]}
          onSectionClick={() => onViewChange('overview')}
          customerSettings={activeView === 'customer-invoices'}
          apSettings={activeView === 'invoices' ? 'invoices' : activeView === 'payments-v2' ? 'payments' : undefined}
        />
        <div className="flex-1 overflow-y-auto">{children}</div>
      </main>
    </div>
  );
}
