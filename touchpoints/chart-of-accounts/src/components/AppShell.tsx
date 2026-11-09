import { Fragment, useState, useRef, useCallback, useEffect } from 'react'
import type { ComponentType, MouseEvent as ReactMouseEvent } from 'react'
import { NavLink, Link, useLocation, useNavigate } from 'react-router-dom'
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
  Search as SearchIcon,
  Eye,
  X,
  CheckCircle2,
  Info,
  AlertCircle,
  RotateCcw,
} from 'lucide-react'
import { cn } from '../lib/utils'
import { useStore } from '../store'
import { embedded } from '../embedding'
import { ConfirmModal } from './ui'
import { clearSavedState } from '../lib/persistence'
import logoWordmark from '../assets/omne-wordmark.png'
import logoIcon from '../assets/omne-icon.png'

/* ─── Navigation model ───
   Mirrors the Omnesoft ERP shell used by Partner Management, Vendors:
   the full module list with a single active, expandable module. Here the
   active module is Accounting & Finance. Its sub-modules are shown as a
   nested accordion, only Chart of Accounts (and its screens) are wired up;
   the rest are non-clickable placeholders for the wider ERP. */
interface NavNode {
  label: string
  icon?: ComponentType<{ className?: string }>
  path?: string
  disabled?: boolean
  children?: NavNode[]
}

const navItems: NavNode[] = [
  { label: 'Items & Inventory', icon: Boxes, disabled: true },
  { label: 'Partners Management', icon: Handshake, disabled: true },
  { label: 'Supply Chain Management', icon: Truck, disabled: true },
  { label: 'Production & Planning', icon: Factory, disabled: true },
  { label: 'Sales', icon: ShoppingCart, disabled: true },
  {
    label: 'Accounting',
    icon: Calculator,
    children: [
      { label: 'Overview', path: '/accounting' },
      // Chart of Accounts is the only wired-up area. Its sub-screens
      // (Numbering, Merge, Setup) are reached from the Setup
      // dropdown on the main page, so they aren't repeated in the nav.
      { label: 'Chart of Accounts', path: '/chart-of-accounts' },
      { label: 'General Ledger', path: '/general-ledger' },
    ],
  },
  { label: 'People Management', icon: UsersRound, disabled: true },
  { label: 'Company Setup', icon: Building2, disabled: true },
]

const COLLAPSED_WIDTH = 60
const MIN_WIDTH = 220
const MAX_WIDTH = 420
const DEFAULT_WIDTH = 272
const STORAGE_KEY_COLLAPSED = 'omnesoft:sidebar-collapsed'
const STORAGE_KEY_WIDTH = 'omnesoft:sidebar-width'
const ACTIVE_BG = 'rgba(10, 119, 255, 0.06)'
const CHILD_BORDER = '#D6E8FF'

function readStoredBoolean(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key)
    if (v === 'true') return true
    if (v === 'false') return false
  } catch { /* ignore */ }
  return fallback
}
function readStoredNumber(key: string, fallback: number, min: number, max: number): number {
  try {
    const v = localStorage.getItem(key)
    if (v !== null) {
      const n = Number(v)
      if (!Number.isNaN(n) && n >= min && n <= max) return n
    }
  } catch { /* ignore */ }
  return fallback
}

const COA_PATHS = ['/chart-of-accounts', '/numbering', '/merge', '/fiscal-year', '/dimensions']

function isAccountingActive(pathname: string): boolean {
  return COA_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))
}

/** Is a leaf link the active route? `/chart-of-accounts` owns the account
 *  detail pages (`/chart-of-accounts/:id`) but NOT the Setup sub-route, which
 *  is its own leaf. */
function isLeafActive(path: string, current: string): boolean {
  // The single Chart of Accounts entry owns the whole module, its
  // sub-screens (Numbering, Merge, Setup) live behind the
  // page's Setup dropdown, so it stays highlighted while you're in any of them.
  if (path === '/chart-of-accounts') return isAccountingActive(current)
  return current === path || current.startsWith(path + '/')
}

/** Does any descendant leaf of this node match the current route? Drives the
 *  active highlight on collapsible groups like "Chart of Accounts". */
function hasActiveLeaf(node: NavNode, current: string): boolean {
  if (node.children) return node.children.some(c => hasActiveLeaf(c, current))
  return !node.disabled && !!node.path && isLeafActive(node.path, current)
}

export function AppShell({ children }: { children: React.ReactNode }) {
  // The Guided wizard / setup flow renders its own full-screen chrome, so the
  // app's left nav and top bar are hidden while it's active.
  const location = useLocation()
  const inWizard = location.pathname === '/chart-of-accounts/setup'
  // Full-view mode (toggled from a page's table toolbar) drops the sidebar and
  // top bar so the content fills the viewport.
  const fullView = useStore(s => s.fullView)
  const hideChrome = inWizard || fullView
  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* Inside the Currency & Exchange shell, the shell's sidebar replaces it. */}
      {!hideChrome && !embedded && <AppSidebar />}
      <main className="flex-1 min-w-0 overflow-hidden flex flex-col relative z-0">
        {/* TopBar lives INSIDE the scroll container (sticky), like the
            Partners pages' top nav - so it shares the same right edge as the
            content instead of extending under the scrollbar gutter. */}
        {/* A column, so a page that wants to fill the viewport and scroll only its
            own table can say so with `flex-1 min-h-0` and get the height left over
            after the TopBar. A page that does not stays taller than the container
            on its own content and scrolls here as it always did. */}
        <div className="flex-1 overflow-auto scrollbar-thin flex flex-col">
          {!hideChrome && <TopBar />}
          {/* Keyed by pathname so every route change remounts this wrapper and
              replays the page-in entrance - a consistent fade-and-rise across
              the whole module, mirroring the account-detail open effect. The
              wizard is excluded: it renders its own full-screen chrome with
              position:fixed footers, and the wrapper's transform would become
              their containing block and break the fixed positioning. */}
          {inWizard ? (
            children
          ) : (
            <div key={location.pathname} className="animate-page-in flex-1 min-h-0 flex flex-col">
              {children}
            </div>
          )}
        </div>
      </main>
      {!inWizard && <DemoControls />}
      <ToastViewport />
    </div>
  )
}

// Global, auto-dismissing toast stack (top-right, tinted - matches the
// Partner module's sonner richColors toasts). Backed by the store so
// any flow can fire one via useStore.getState().pushToast(...).
function ToastViewport() {
  const toasts = useStore(s => s.toasts)
  const dismiss = useStore(s => s.dismissToast)
  if (toasts.length === 0) return null
  const tone = {
    success: { box: 'bg-success-50 border-success-100 text-success-700', icon: 'fill-success-600 text-success-50', Icon: CheckCircle2 },
    info: { box: 'bg-info-50 border-info-100 text-info-700', icon: 'fill-info-600 text-info-50', Icon: Info },
    danger: { box: 'bg-danger-50 border-danger-100 text-danger-700', icon: 'fill-danger-600 text-danger-50', Icon: AlertCircle },
  }
  return (
    <div className="fixed top-16 right-4 z-[80] flex flex-col gap-2 w-80 max-w-[calc(100vw-2rem)]">
      {toasts.map(t => {
        const c = tone[t.tone]
        const Icon = c.Icon
        return (
          <div key={t.id} className={cn('flex items-start gap-2.5 rounded-xl border shadow-lg px-3.5 py-3 animate-[treeRowIn_240ms_ease-out]', c.box)}>
            <Icon size={18} className={cn('shrink-0 mt-px', c.icon)} />
            <div className="flex-1 min-w-0">
              <div className="text-sm" style={{ fontWeight: 500 }}>{t.message}</div>
              {t.description && <div className="text-xs opacity-80 mt-0.5">{t.description}</div>}
              {t.action && (
                <button
                  onClick={() => { t.action!.onClick(); dismiss(t.id) }}
                  className="mt-1.5 inline-flex items-center h-7 px-2.5 rounded-md border border-current/30 bg-white/60 text-xs font-semibold hover:bg-white transition-colors"
                >
                  {t.action.label}
                </button>
              )}
            </div>
            <button onClick={() => dismiss(t.id)} className="shrink-0 opacity-50 hover:opacity-100"><X size={15} /></button>
          </div>
        )
      })}
    </div>
  )
}

// DEV ONLY. The floating demo controls, as one row so they cannot overlap:
// preview the brand-new-tenant experience, or put the seeded chart back.
function DemoControls() {
  return (
    <div className="fixed top-6 -translate-y-1/2 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-2">
      <FirstTimeUserButton />
      <ResetDemoDataButton />
    </div>
  )
}

// DEV ONLY, floating control to discard everything saved in this browser and
// return to the chart as it ships.
function ResetDemoDataButton() {
  const [confirming, setConfirming] = useState(false)

  // A reload rather than a set() back to the seed: seed.ts dates its demo
  // history from the day it is evaluated, so only a fresh load puts eleven
  // thousand postings back against today instead of against the day the reader
  // first opened the app.
  const reset = async () => {
    await clearSavedState()
    location.reload()
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        title="Discard everything saved in this browser and restore the seeded chart of accounts"
        className="inline-flex items-center gap-1.5 h-7 pl-3 pr-3.5 rounded-full text-2xs font-medium shadow-md bg-white text-fg border border-border hover:bg-bg-subtle hover:border-border-strong transition-colors cursor-pointer"
      >
        <RotateCcw size={14} className="shrink-0" />
        Reset demo data
      </button>
      <ConfirmModal
        open={confirming}
        tone="danger"
        icon={<RotateCcw size={26} className="text-danger-600" />}
        badge="Reset demo data"
        title="Reset to the seeded chart?"
        description={[
          'Every account, entry and edit saved in this browser is discarded.',
          'The demo chart comes back as it ships, dated to today.',
        ]}
        confirmLabel="Reset demo data"
        dismissLabel="Cancel"
        onConfirm={reset}
        onDismiss={() => setConfirming(false)}
      />
    </>
  )
}

// DEV ONLY, floating control to preview the brand-new-tenant experience.
// Resets the store to a zero-account, setup-incomplete state and jumps into
// the guided wizard. While setup is incomplete it stays in an active state
// with a pulsing indicator. Remove (along with store.resetToFirstTimeUser)
// before shipping.
function FirstTimeUserButton() {
  const navigate = useNavigate()
  // Driven by the persistent preview flag (not setupComplete) so the active
  // state survives publishing - the user is still in the simulated tenant.
  const previewActive = useStore(s => s.firstTimePreview)
  const reset = useStore(s => s.resetToFirstTimeUser)
  const restore = useStore(s => s.exitFirstTimeUser)

  // Enter the preview: blank-slate tenant, then show the first-time setup
  // view (the three-path selector) on the main Chart of Accounts route.
  const enter = () => {
    reset()
    navigate('/chart-of-accounts')
  }
  // Return to the first-time setup view without resetting again.
  const resume = () => navigate('/chart-of-accounts')
  // Leave the preview: restore the seeded, fully set-up tenant.
  const exit = () => {
    restore()
    navigate('/chart-of-accounts')
  }

  if (!previewActive) {
    return (
      <button
        type="button"
        onClick={enter}
        title="Developer preview: reset to a brand-new tenant with zero accounts and open the first-time setup view"
        className="inline-flex items-center gap-1.5 h-7 pl-3 pr-3.5 rounded-full text-2xs font-medium shadow-md bg-white text-fg border border-border hover:bg-bg-subtle hover:border-border-strong transition-colors cursor-pointer"
      >
        <Eye size={14} className="shrink-0" />
        View as first-time user
      </button>
    )
  }

  return (
    <div className="coa-glow inline-flex items-center h-7 rounded-full text-2xs font-medium bg-success text-success-foreground ring-2 ring-success/30 overflow-hidden">
      <button
        onClick={resume}
        title="First-time view active. Return to the setup options."
        className="inline-flex items-center gap-1.5 h-full pl-3 pr-2.5 hover:bg-white/10 transition-colors"
      >
        <span className="relative flex h-2 w-2" aria-hidden>
          <span className="absolute inline-flex h-full w-full rounded-full bg-white opacity-60 animate-ping" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
        </span>
        First-time view active
      </button>
      <span className="h-4 w-px bg-white/30" aria-hidden />
      <button
        onClick={exit}
        title="Exit the first-time view and restore the seeded chart of accounts"
        className="inline-flex items-center gap-1 h-full pl-2.5 pr-3 hover:bg-white/10 transition-colors"
      >
        <X size={13} className="shrink-0" />
        Exit
      </button>
    </div>
  )
}

function AppSidebar() {
  const location = useLocation()
  const [expandedItems, setExpandedItems] = useState<string[]>(['Accounting'])
  const [collapsed, setCollapsed] = useState(() => readStoredBoolean(STORAGE_KEY_COLLAPSED, true))
  const [sidebarWidth, setSidebarWidth] = useState(() => readStoredNumber(STORAGE_KEY_WIDTH, DEFAULT_WIDTH, MIN_WIDTH, MAX_WIDTH))
  const [hoverExpanded, setHoverExpanded] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** Suppress the width transition on first render so a collapsed sidebar
   *  doesn't visibly animate from full-width on load. */
  const [hasMounted, setHasMounted] = useState(false)
  useEffect(() => { requestAnimationFrame(() => setHasMounted(true)) }, [])

  const actualWidth = collapsed ? COLLAPSED_WIDTH : sidebarWidth

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY_COLLAPSED, String(collapsed)) } catch { /* ignore */ }
  }, [collapsed])
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY_WIDTH, String(sidebarWidth)) } catch { /* ignore */ }
  }, [sidebarWidth])

  /* Ctrl/Cmd+B toggles the sidebar */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault()
        setCollapsed(prev => !prev)
        setHoverExpanded(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const toggleExpand = (label: string) =>
    setExpandedItems(prev => (prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label]))

  const isItemActive = (item: NavNode) => {
    if (item.label === 'Accounting') return isAccountingActive(location.pathname) || hasActiveLeaf(item, location.pathname)
    if (item.disabled || !item.path) return false
    return location.pathname === item.path || location.pathname.startsWith(item.path + '/')
  }

  /* ─── Recursive nav node renderer (expanded sidebar / hover overlay) ───
     depth 0 = top-level module (icon + chevron), depth ≥ 1 = nested items
     inside an indented rail. Collapsible groups toggle; leaves either link
     (Chart of Accounts screens) or render as inert placeholders. */
  function renderNavNode(node: NavNode, depth: number) {
    const Icon = node.icon
    const current = location.pathname

    if (node.children && node.children.length > 0) {
      const isExpanded = expandedItems.includes(node.label)
      const active = hasActiveLeaf(node, current)
      const pad = depth === 0 ? 'px-2.5 py-2' : 'px-2.5 py-1.5'
      return (
        <div key={node.label}>
          <button
            onClick={() => toggleExpand(node.label)}
            className={cn(
              'w-full flex items-center gap-2.5 rounded-lg text-[13px] transition-all duration-150',
              pad,
              active ? 'text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
            style={{ fontWeight: active ? 500 : 400, backgroundColor: active ? ACTIVE_BG : undefined }}
          >
            {Icon && <Icon className={cn('w-[18px] h-[18px] shrink-0', active && 'text-primary')} />}
            <span className="flex-1 text-left truncate">{node.label}</span>
            <ChevronDown
              className={cn(
                'w-3.5 h-3.5 shrink-0 transition-transform duration-200',
                isExpanded ? 'rotate-0' : '-rotate-90',
                active ? 'text-primary' : 'text-muted-foreground'
              )}
            />
          </button>
          {isExpanded && (
            <div
              className={cn('mt-0.5 space-y-px border-l-[1.5px] py-0.5', depth === 0 ? 'ml-[19px] pl-2.5' : 'ml-3 pl-2.5')}
              style={{ borderColor: CHILD_BORDER }}
            >
              {node.children.map(child => renderNavNode(child, depth + 1))}
            </div>
          )}
        </div>
      )
    }

    // Inert placeholder (non-COA modules/pages, not yet wired up)
    if (node.disabled || !node.path) {
      return (
        <div
          key={node.label}
          className={cn('flex items-center gap-2.5 rounded-lg text-[13px] cursor-not-allowed text-muted-foreground/70', depth === 0 ? 'px-2.5 py-2' : 'px-2.5 py-1')}
          style={{ fontWeight: 400 }}
          title="Coming soon"
        >
          {Icon && <Icon className="w-[18px] h-[18px] shrink-0" />}
          <span className="truncate">{node.label}</span>
        </div>
      )
    }

    // Clickable leaf
    const linkActive = isLeafActive(node.path, current)
    return (
      <NavLink
        key={node.path}
        to={node.path}
        className={cn(
          'block rounded-md text-[13px] transition-all duration-150',
          depth === 0 ? 'px-2.5 py-2' : 'px-2.5 py-1',
          linkActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
        )}
        style={{ fontWeight: linkActive ? 500 : 400, backgroundColor: linkActive ? 'rgba(10, 119, 255, 0.05)' : undefined }}
      >
        {node.label}
      </NavLink>
    )
  }

  /* ─── Resize ─── */
  const startResize = useCallback((e: ReactMouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsResizing(true)
    const startX = e.clientX
    const startWidth = sidebarWidth
    const onMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + (moveEvent.clientX - startX)))
      setSidebarWidth(newWidth)
    }
    const onMouseUp = () => {
      setIsResizing(false)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [sidebarWidth])

  const handleResizeDoubleClick = useCallback(() => setCollapsed(true), [])

  /* ─── Hover-to-expand (collapsed mode) ─── */
  const handleMouseEnter = useCallback(() => {
    if (collapsed) {
      hoverTimeoutRef.current = setTimeout(() => setHoverExpanded(true), 200)
    }
  }, [collapsed])
  const handleMouseLeave = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
      hoverTimeoutRef.current = null
    }
    setHoverExpanded(false)
  }, [])
  useEffect(() => () => { if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current) }, [])

  /* ─── Logo mark (official Omne wordmark) ─── */
  function Logo() {
    return (
      <div className="flex items-center min-w-0">
        <img src={logoWordmark} alt="Omnesoft" className="h-5 shrink-0" />
      </div>
    )
  }

  /* ─── Full sidebar content (expanded + hover overlay) ─── */
  function renderFullContent(isOverlay: boolean) {
    return (
      <>
        {/* Logo header */}
        <div className="h-12 px-3 flex items-center gap-2.5 border-b border-border shrink-0">
          <Logo />
          <div className="flex-1" />
          <button
            onClick={() => { setCollapsed(!isOverlay); setHoverExpanded(false) }}
            className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0"
            title={isOverlay ? 'Pin sidebar open' : 'Collapse sidebar'}
          >
            {isOverlay ? <ChevronsRight className="w-4 h-4" /> : <ChevronsLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto scrollbar-thin py-2 px-2">
          <div className="space-y-px">
            {navItems.map(item => renderNavNode(item, 0))}
          </div>
        </nav>

        {/* Bottom section */}
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
              <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: 'hsl(var(--accent))' }}>
                <span className="text-[11px]" style={{ fontWeight: 600, color: 'hsl(var(--primary))' }}>AA</span>
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
    )
  }

  /* ─── Collapsed icon bar ─── */
  function renderCollapsedBar() {
    return (
      <aside className="absolute inset-0 bg-card border-r border-border flex flex-col items-center z-10">
        <div className="h-12 flex items-center justify-center border-b border-border w-full shrink-0">
          <button
            onClick={() => setCollapsed(false)}
            className="w-9 h-9 rounded-lg flex items-center justify-center transition-all hover:ring-2 hover:ring-primary/20"
            aria-label="Expand sidebar"
            title="Expand sidebar"
          >
            <img src={logoIcon} alt="Omnesoft" className="w-7 h-7" />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto scrollbar-thin py-3 w-full">
          <div className="flex flex-col items-center gap-0.5 px-2">
            {navItems.map(item => {
              const Icon = item.icon
              const active = isItemActive(item)
              const disabled = item.disabled
              return (
                <div
                  key={item.label}
                  title={item.label}
                  className={cn(
                    'w-10 h-10 rounded-lg flex items-center justify-center transition-colors',
                    active
                      ? 'text-primary'
                      : disabled
                      ? 'text-muted-foreground/50 cursor-not-allowed'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer'
                  )}
                  style={{ backgroundColor: active ? ACTIVE_BG : undefined }}
                >
                  {Icon && <Icon className="w-[18px] h-[18px]" />}
                </div>
              )
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
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 cursor-pointer hover:ring-2 hover:ring-primary/20 transition-all"
              style={{ backgroundColor: 'hsl(var(--accent))' }}
              title="Ahtisham Ahmad · admin@omnesoft.com"
            >
              <span className="text-[11px]" style={{ fontWeight: 600, color: 'hsl(var(--primary))' }}>AA</span>
            </div>
          </div>
        </div>
      </aside>
    )
  }

  return (
    <div
      className="relative flex-shrink-0 h-full"
      style={{ width: actualWidth, transition: !hasMounted || isResizing ? 'none' : 'width 200ms cubic-bezier(0.4, 0, 0.2, 1)' }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Collapsed icon bar */}
      {collapsed && renderCollapsedBar()}

      {/* Hover overlay (collapsed + hovering) */}
      {collapsed && (
        <aside
          className={cn(
            'absolute left-0 top-0 h-full bg-card border-r border-border flex flex-col z-50',
            hoverExpanded ? 'opacity-100 translate-x-0 pointer-events-auto' : 'opacity-0 -translate-x-2 pointer-events-none'
          )}
          style={{
            width: sidebarWidth,
            borderTopRightRadius: 12,
            borderBottomRightRadius: 12,
            boxShadow: '0 20px 60px -12px rgba(0,0,0,0.15), 0 8px 20px -8px rgba(0,0,0,0.1)',
            transition: 'opacity 150ms ease-out, transform 150ms ease-out',
          }}
        >
          {renderFullContent(true)}
        </aside>
      )}

      {/* Expanded sidebar */}
      {!collapsed && (
        <aside className="h-full bg-card border-r border-border flex flex-col overflow-hidden">
          {renderFullContent(false)}
        </aside>
      )}

      {/* Resize handle */}
      {!collapsed && (
        <div
          className="absolute right-0 top-0 bottom-0 w-[5px] cursor-col-resize z-30 group"
          onMouseDown={startResize}
          onDoubleClick={handleResizeDoubleClick}
          title="Drag to resize · Double-click to collapse"
        >
          <div className={cn('absolute inset-y-0 right-0 w-[2px] transition-colors duration-150', isResizing ? 'bg-primary' : 'bg-transparent group-hover:bg-primary/40')} />
        </div>
      )}
    </div>
  )
}

function TopBar() {
  const loc = useLocation()
  const accounts = useStore(s => s.accounts)
  const crumbs = breadcrumbs(loc.pathname)
  // On an account detail route, show the account's name as the final crumb
  // (e.g. "… / Chart of Accounts / Operating Bank Account"), like Partners.
  const detail = loc.pathname.match(/^\/chart-of-accounts\/([^/]+)$/)
  if (detail && detail[1] !== 'setup') {
    const acct = accounts.find(a => a.id === detail[1])
    if (acct) crumbs[crumbs.length - 1] = { label: acct.accountName }
  }
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between px-6 lg:px-8 h-12 border-b border-border bg-card shrink-0">
      {/* Breadcrumb - matches the Partners TOP BAR breadcrumb (see
          ContactDetailPage.tsx / VendorsListPage.tsx top nav), which is
          hand-rolled there: 13px, "/" text separators, weight-500 crumbs,
          muted parents, foreground current crumb. (Partners' shadcn
          ui/breadcrumb with ChevronRight is only used inside page bodies,
          e.g. VendorCreatePage - not in the top bar.) */}
      <div className="flex items-center gap-2 text-[13px] text-muted-foreground min-w-0 overflow-hidden whitespace-nowrap">
        {crumbs.map((c, i) => {
          const isLast = i === crumbs.length - 1
          return (
            <Fragment key={i}>
              {i > 0 && <span className="text-muted-foreground">/</span>}
              {!isLast ? (
                /* Parent crumbs are always clickable; crumbs without an
                   explicit route fall back to the module root. */
                <Link to={c.to ?? '/accounting'} className="hover:text-foreground transition-colors cursor-pointer shrink-0" style={{ fontWeight: 500 }}>{c.label}</Link>
              ) : (
                /* Current crumb sits one step smaller than the parent links. */
                <span className="text-foreground text-xs truncate" style={{ fontWeight: 500 }}>{c.label}</span>
              )}
            </Fragment>
          )
        })}
      </div>
      {/* Right cluster never shrinks past the header padding - the breadcrumb
          side truncates instead, so the profile keeps the same right margin
          as the Partners top nav. */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="relative hidden md:block">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
          <input
            placeholder="Search…"
            className="pl-9 w-[260px] h-8 bg-white border border-border/60 rounded-md text-[13px] outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all"
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: 'hsl(var(--accent))' }}>
            <span className="text-[11px]" style={{ fontWeight: 600, color: 'hsl(var(--primary))' }}>AA</span>
          </div>
          <div className="hidden sm:block whitespace-nowrap">
            <p className="text-[13px]" style={{ fontWeight: 500 }}>Ahtisham Ahmad</p>
            <p className="text-[11px] text-muted-foreground leading-tight">Controller</p>
          </div>
        </div>
      </div>
    </header>
  )
}

type Crumb = { label: string; to?: string }
function breadcrumbs(path: string): Crumb[] {
  // The module root now points at the Accounting overview landing page.
  const root: Crumb = { label: 'Accounting', to: '/accounting' }
  const coa: Crumb = { label: 'Chart of Accounts', to: '/chart-of-accounts' }
  const gl: Crumb = { label: 'General ledger', to: '/general-ledger' }
  if (path.startsWith('/accounting')) return [root, { label: 'Overview' }]
  // The entry's own number, which the route carries and a reader recognises. An
  // account detail can only say "Account" because its route carries an opaque id.
  const entry = path.match(/^\/general-ledger\/entry\/([^/]+)$/)
  if (entry) return [root, gl, { label: decodeURIComponent(entry[1]) }]
  if (path.startsWith('/general-ledger')) return [root, { label: 'General ledger' }]
  if (path.startsWith('/chart-of-accounts/setup')) return [root, coa, { label: 'Setup' }]
  if (path.match(/^\/chart-of-accounts\/[^/]+$/)) return [root, coa, { label: 'Account' }]
  if (path.startsWith('/chart-of-accounts')) return [root, { label: 'Chart of Accounts' }]
  if (path.startsWith('/numbering')) return [root, { label: 'Account numbering' }]
  if (path.startsWith('/merge')) return [root, { label: 'Merge Accounts' }]
  if (path.startsWith('/fiscal-year')) return [root, { label: 'Fiscal Year' }]
  // Reached only from the Chart of Accounts Actions menu, so the trail says so
  // rather than hanging the page straight off the module root.
  if (path.startsWith('/dimensions')) return [root, coa, { label: 'Dimensions' }]
  return [root, { label: 'Chart of Accounts' }]
}
