import { Children, Fragment, ReactNode, type MouseEvent as ReactMouseEvent, isValidElement, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, ChevronDown, Search, Check, AlertTriangle, Maximize2, Minimize2, Info, CheckCircle2, AlertCircle, Plus } from 'lucide-react'
import { cn, groupAmount, sanitizeAmount } from '../lib/utils'
import { searchPatternSource } from '../lib/tableSearch'

// =========================
// Responsive icon sizing
// =========================
// Returns an icon size that scales with the same breakpoints as the root
// font-size scaling in src/index.css (1536 / 1366 / 1180). Use for icons that
// sit inline with text in the page chrome (buttons, inputs, pills, headers) so
// fixed-px lucide icons don't feel chunky relative to the shrunken type at
// narrow widths. Decorative / standalone icons can keep their natural size.
export function useResponsiveIconSize(base: number = 14) {
  const [size, setSize] = useState(base)
  useEffect(() => {
    let raf = 0
    function update() {
      // Debounce to one update per animation frame so dragging the window edge
      // doesn't fire setState on every pixel.
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const w = window.innerWidth
        if (w <= 1180) setSize(Math.round(base * 0.85))
        else if (w <= 1366) setSize(Math.round(base * 0.90))
        else if (w <= 1536) setSize(Math.round(base * 0.95))
        else setSize(base)
      })
    }
    update()
    window.addEventListener('resize', update)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', update) }
  }, [base])
  return size
}

// =========================
// Badge / Chip
// =========================
export type BadgeTone =
  | 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'brand'
  | 'purple' | 'teal' | 'indigo' | 'sky' | 'rose' | 'slate' | 'orange'
  /** The base currency's yellow "Base" chip. */
  | 'base'

export function Badge({ tone = 'neutral', children, className }: {
  tone?: BadgeTone
  children: ReactNode
  className?: string
}) {
  const cls = {
    success: 'badge-success',
    warning: 'badge-warning',
    danger:  'badge-danger',
    info:    'badge-info',
    neutral: 'badge-neutral',
    brand:   'badge-brand',
    purple:  'badge-purple',
    teal:    'badge-teal',
    indigo:  'badge-indigo',
    sky:     'badge-sky',
    rose:    'badge-rose',
    slate:   'badge-slate',
    orange:  'badge-orange',
    base:    'badge-base',
  }[tone]
  return (
    <span className={cn(cls, className)}>
      {children}
    </span>
  )
}

// =========================
// Button
// =========================
export function Button({
  variant = 'primary', size = 'md', icon, iconRight, children, className, ...props
}: {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
  icon?: ReactNode
  iconRight?: ReactNode
  children?: ReactNode
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const variantCls = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    ghost: 'btn-ghost',
    danger: 'btn-danger',
  }[variant]
  return (
    <button className={cn(variantCls, size === 'sm' && 'btn-sm', className)} {...props}>
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
      {iconRight && <span className="shrink-0">{iconRight}</span>}
    </button>
  )
}

/* Escape closes the top modal, and only the top one.
 *
 * Every panel here listens on the document, so with two of them open the one
 * keypress reached both: dismissing the little form you opened over a wizard
 * also dismissed the wizard, and the half-filled account behind it. A stack in
 * open order settles it - the last one registered is the one on screen, and it
 * is the only one that answers. */
const escapeStack: symbol[] = []

/** Whether a media query matches, kept live as the window resizes. */
export function useMediaQuery(query: string): boolean {
  const read = () => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(query).matches
  const [matches, setMatches] = useState(read)
  useEffect(() => {
    if (!window.matchMedia) return
    const mq = window.matchMedia(query)
    const on = () => setMatches(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [query])
  return matches
}

export function useEscapeToClose(open: boolean, onClose: () => void) {
  /* Held in a ref so the stack is ordered by when each layer opened, not by when
     it last re-rendered. Keyed on the callback, a modal whose parent passes an
     inline onClose re-pushed itself on every render, landing above a list opened
     inside it - so one Escape shut the modal and the list together. */
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  useEffect(() => {
    if (!open) return
    const me = Symbol('modal')
    escapeStack.push(me)
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && escapeStack[escapeStack.length - 1] === me) onCloseRef.current()
    }
    document.addEventListener('keydown', h)
    return () => {
      document.removeEventListener('keydown', h)
      const i = escapeStack.indexOf(me)
      if (i >= 0) escapeStack.splice(i, 1)
    }
  }, [open])
}

// =========================
// SlideOver
// =========================
export function SlideOver({
  open, onClose, title, subtitle, width = 'lg', widthClass, children, footer, side,
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  width?: 'md' | 'lg' | 'xl' | '2xl'
  /* Arbitrary max-width class, overrides the `width` preset when given. */
  widthClass?: string
  children: ReactNode
  footer?: ReactNode
  side?: ReactNode
}) {
  useEscapeToClose(open, onClose)

  const widthCls = widthClass ?? { md: 'max-w-md', lg: 'max-w-2xl', xl: 'max-w-4xl', '2xl': 'max-w-6xl' }[width]
  const closeSize = useResponsiveIconSize(18)

  if (!open) return null
  // Portaled to <body>, like every overlay here: the app shell wraps each page
  // in an animate-page-in div whose transform sticks around (fill-mode both),
  // so an in-tree fixed overlay would be clipped to the content area and leave
  // the sidebar and top bar uncovered.
  return createPortal(
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 coa-scrim animate-overlay-in" onClick={onClose} />
      <div className={cn('absolute right-0 top-0 h-full w-full bg-white shadow-xl flex flex-col', widthCls)}>
        <div className="flex items-start justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-base font-semibold text-fg">{title}</h2>
            {subtitle && <p className="text-sm text-fg-muted mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="btn-icon"><X size={closeSize} /></button>
        </div>
        <div className="flex-1 overflow-hidden flex">
          <div className="flex-1 overflow-auto scrollbar-thin">{children}</div>
          {side && <div className="w-80 border-l border-border bg-bg-subtle overflow-auto scrollbar-thin">{side}</div>}
        </div>
        {footer && <div className="px-6 py-3 border-t border-border bg-white flex items-center justify-end gap-2">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

// =========================
// FormModal (large centered modal for multi-field flows)
// =========================
// Same API as SlideOver (title/subtitle/footer/side/children) but presented as
// a large centered modal with a blurred overlay and a "Full view" expand
// toggle, matching the Create Partner flow chrome.
/* The look of a button in the modal header's top-right cluster. */
export const modalHeaderActionClass =
  'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-white text-xs text-muted-foreground hover:bg-slate-50 hover:border-slate-300 transition-all'

/* ──────── How it works ────────
   The way into a wizard's written guide. One control across every wizard,
   because a reader who finds help under this word in one wizard and under
   another in the next has to learn the product twice.

   An outline button, the same flat control the rest of the app uses rather than
   a raised one of its own. Held open it keeps the subtle active fill, so the
   press reads as having taken while the panel it opened is still on screen. */
/* An icon button, the info "i" in the secondary button's frame, named "How
   it works" by its tooltip and to a screen reader. Mahad, 2026-10-07: *"Can we
   have How it work buttons as Icon Button? with an icon of a question mark?"*
   The question mark became the "i" on 2026-10-08 - Eli: *"I'm not sure I like the
   question mark button ... We could get a nicer version of the info thing here.
   We're already using some sort of I. That should be a behavior that they
   remember."*
   It takes the frame of the button it stands beside, square, so the two read
   as a pair (Mahad, 2026-10-07: *"How it works button is a bit smaller than
   the one next to it. Please make it consistent."*): `page` is the page
   header's secondary button; `modal`, the default, is a dialog header's Full
   view (`modalHeaderActionClass`); `wizard` is the setup wizards' Full view.

   In a setup it keeps its words: Mahad, 2026-10-07, *"We need to have a full
   'How it works' button in setups. No need for only an icon button there."*
   So `wizard` (Build from scratch, Guided setup) always reads "How it works",
   in exactly the frame of the Full view beside it, and `labelled` does the same
   in a dialog that is a setup path (Import). Elsewhere it is the icon. */
const HOW_IT_WORKS_FRAME = {
  page: { cls: 'btn-secondary !px-0 w-9', icon: 'w-4 h-4' },
  modal: { cls: cn(modalHeaderActionClass, 'justify-center !p-0 w-[calc(1.75rem+2px)] h-[calc(1.75rem+2px)]'), icon: 'w-3.5 h-3.5' },
  wizard: { cls: 'inline-flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-lg border border-border bg-white text-fg-muted hover:bg-slate-50 hover:border-slate-300 transition-all', icon: 'w-[15px] h-[15px]' },
}
const HOW_IT_WORKS_LABELLED = {
  page: { cls: 'btn-secondary', icon: 'w-4 h-4' },
  modal: { cls: modalHeaderActionClass, icon: 'w-3.5 h-3.5' },
  // The Full view button beside it in WizardChrome, class for class.
  wizard: { cls: 'inline-flex items-center gap-1.5 h-8 sm:h-9 px-2.5 sm:px-3 rounded-lg border border-border bg-white text-xs sm:text-[13px] text-fg-muted hover:bg-slate-50 hover:border-slate-300 transition-all', icon: 'w-[15px] h-[15px]' },
}

export function HowItWorksButton({ open, onClick, walkthrough, place = 'modal', labelled }: {
  open: boolean
  onClick: () => void
  place?: keyof typeof HOW_IT_WORKS_FRAME
  /** Show the words beside the icon. Always on in a wizard. */
  labelled?: boolean
  /* The key a walkthrough spotlights this button by, where the wizard has a
     walkthrough that points at it. Left off elsewhere, so two wizards on screen
     at once cannot both answer to the same key. */
  walkthrough?: string
}) {
  if (labelled || place === 'wizard') {
    const f = HOW_IT_WORKS_LABELLED[place]
    return (
      <button
        type="button"
        data-walkthrough={walkthrough}
        onClick={onClick}
        aria-pressed={open}
        className={cn(f.cls, 'shrink-0', open && '!bg-bg-subtle')}
        style={{ fontWeight: 500 }}
      >
        <Info className={f.icon} strokeWidth={2.25} />
        How it works
      </button>
    )
  }
  return (
    <Tooltip side="bottom" content="How it works">
      <button
        type="button"
        data-walkthrough={walkthrough}
        onClick={onClick}
        aria-pressed={open}
        aria-label="How it works"
        className={cn(HOW_IT_WORKS_FRAME[place].cls, 'shrink-0', open && '!bg-bg-subtle')}
      >
        <Info className={HOW_IT_WORKS_FRAME[place].icon} strokeWidth={2.25} />
      </button>
    </Tooltip>
  )
}

export function FormModal({
  open, onClose, title, subtitle, titleMeta, headerExtra, headerActions, children, footer, overlay, hideFullView, icon, autoFull, widthClass, maxHeightClass, fixedHeight, fillBody,
}: {
  open: boolean
  onClose: () => void
  title: string
  /* A node rather than a string, because a subtitle that has to quote the thing
     it is describing - a number, a column name - reads better with that quote
     set apart from the prose than spelled out inside it. */
  subtitle?: ReactNode
  /* A row of facts about the record itself - status, type, date - sitting under
     the title. Distinct from `headerExtra`, whose flush-to-the-divider spacing
     exists for tab strips and would leave a badge crushed against the border. */
  titleMeta?: ReactNode
  /* Full-width node rendered under the title row, inside the header (e.g. a
     Create Partner-style step-tab strip whose underline meets the border). */
  headerExtra?: ReactNode
  /* Buttons that sit in the top-right cluster, ahead of Full view and the close
     ✕. For an action on the panel itself rather than on the record, such as
     opening the side panel, which has nowhere else to live once the footer is
     carrying the flow's own buttons. Style them with `modalHeaderActionClass`
     so they read as one cluster with the Full view button beside them. */
  headerActions?: ReactNode
  children: ReactNode
  footer?: ReactNode
  /* A panel that floats over the body rather than beside it - a reference sheet
     you open, read, and dismiss. Positioned against the panel itself, so it can
     inset from the rounded corners and cast its own scrim over the form without
     the form having to give up any width. */
  overlay?: ReactNode
  hideFullView?: boolean
  /* Optional leading icon shown in a tinted tile to the left of the title. */
  icon?: ReactNode
  /* When set, drives the full-view state (true = edge-to-edge). Changing it
     re-syncs the panel, so a flow can expand to full view on one step and shrink
     back on another. The user can still toggle manually between changes. */
  autoFull?: boolean
  /* Overrides the windowed max-width. Forms whose content is narrower than the
     default 960/1040 read as underfilled at full width - a journal entry is a
     few fields and a line list, not a two-column wizard. Full view ignores it. */
  widthClass?: string
  /* Raises the windowed height cap for forms whose tallest step would otherwise
     scroll. The panel still sizes to its content, so shorter steps are unaffected. */
  maxHeightClass?: string
  /* Holds the windowed panel at one height on every step instead of sizing it to
     each step's content. A wizard whose panel resizes between steps makes the
     reader re-find the footer each time, and the button they are heading for
     moves while they are heading for it. Pass the tallest step's height: the
     shorter steps then leave room empty, which is the cheaper of the two faults.

     A class rather than a number, because the value has to appear literally in
     the caller's source for Tailwind to emit it. It replaces `sm:h-auto` instead
     of being layered over it: `cn` here is plain clsx, so two height utilities on
     one element would be settled by stylesheet order rather than by this call. */
  fixedHeight?: string
  /* Hands the body's scrolling to the child. A grid with frozen columns needs one
     scroll container for both axes, which it cannot have while the modal owns the
     vertical scroll. */
  fillBody?: boolean
}) {
  const [full, setFull] = useState(false)
  useEscapeToClose(open, onClose)
  // Reset to windowed mode whenever the modal is reopened.
  useEffect(() => { if (!open) setFull(false) }, [open])
  // Sync to the caller's desired full-view state when provided.
  // Re-read on every open too, so a caller that wants full view still gets it
  // the second time the modal opens.
  useEffect(() => { if (open && autoFull !== undefined) setFull(!!autoFull) }, [autoFull, open])

  // ── Smooth height ──────────────────────────────────────────────────────
  // `height: auto` can't be CSS-transitioned, so switching steps / revealing
  // content makes the windowed panel jump. We measure the natural content
  // height and drive an explicit `height` (capped by max-h, which lets the body
  // scroll) so growth/shrink animates. Desktop + windowed only; mobile and the
  // full-view mode keep their class-driven height.
  const panelRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const footerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [panelH, setPanelH] = useState<number>()
  useLayoutEffect(() => {
    // A panel held at one height has nothing to measure, and an inline height
    // would win over the class that is holding it there.
    if (!open || full || fixedHeight || !window.matchMedia('(min-width: 640px)').matches) { setPanelH(undefined); return }
    const measure = () => {
      const hH = headerRef.current?.offsetHeight ?? 0
      const fH = footerRef.current?.offsetHeight ?? 0
      const cH = contentRef.current?.offsetHeight ?? 0
      /* The panel is border-box, so its own border eats into the height we set.
         Left out, every modal was permanently that much shorter than what it
         holds and showed a scrollbar for content that fits. */
      const cs = panelRef.current ? getComputedStyle(panelRef.current) : null
      const borders = cs ? parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth) : 0
      setPanelH(hH + fH + cH + borders)
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (contentRef.current) ro.observe(contentRef.current)
    if (headerRef.current) ro.observe(headerRef.current)
    if (footerRef.current) ro.observe(footerRef.current)
    window.addEventListener('resize', measure)
    return () => { ro.disconnect(); window.removeEventListener('resize', measure) }
  }, [open, full, fixedHeight])

  if (!open) return null
  // Portal to <body> so the overlay is always positioned against the viewport
  // and can never be clipped or contained by the app shell (the scroll
  // container / sidebar). z-[70] sits above the floating chip (z-60) and below
  // toasts (z-80). In full view it fills the viewport edge-to-edge.
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 coa-scrim animate-overlay-in" onClick={onClose} />
      {/* Full-view toggle animates max-width/max-height/border-radius with the
          Create Partner modal's curve, the panel stays w-full/h-full and only
          its caps move, so the grow/shrink is one smooth resize. */}
      <div
        ref={panelRef}
        style={panelH !== undefined ? { height: panelH } : undefined}
        className={cn(
        'relative bg-white shadow-xl border border-border flex flex-col overflow-hidden w-full animate-modal-in',
        'transition-[height,max-width,max-height,border-radius] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]',
        full
          ? 'h-full max-w-full max-h-full rounded-2xl'
          : cn('h-full max-h-[100dvh] rounded-xl',
              fixedHeight ?? 'sm:h-auto',
              maxHeightClass ?? 'sm:max-h-[78vh]',
              widthClass ?? 'max-w-[960px] lg:max-w-[1040px]'))}>
        {/* Header spacing + subtitle colour mirror the Create Partner modal
            header (pt above title, slate-500 11px/xs subtitle). */}
        <div ref={headerRef} className={cn('px-5 pt-5 border-b border-border shrink-0', headerExtra ? 'pb-0' : 'pb-4')}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              {icon && <span className="shrink-0 w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center mt-0.5">{icon}</span>}
              <div className="min-w-0">
                <h2 className="text-[17px] font-bold tracking-tight text-fg truncate">{title}</h2>
                {subtitle && <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">{subtitle}</p>}
                {titleMeta && <div className="mt-2">{titleMeta}</div>}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {headerActions}
              {!hideFullView && (
                <button
                  onClick={() => setFull(f => !f)}
                  className={cn(modalHeaderActionClass, 'hidden sm:inline-flex')}
                  style={{ fontWeight: 500 }}
                >
                  {full ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                  {full ? 'Exit full' : 'Full view'}
                </button>
              )}
              <button onClick={onClose} className="btn-icon"><X size={18} /></button>
            </div>
          </div>
          {headerExtra && <div className="mt-3 -mb-px">{headerExtra}</div>}
        </div>
        <div className="flex-1 overflow-hidden flex">
          {fillBody
            ? <div ref={contentRef} className="flex-1 min-w-0 flex flex-col">{children}</div>
            : <div className="flex-1 overflow-auto scrollbar-thin"><div ref={contentRef}>{children}</div></div>}
        </div>
        {footer && <div ref={footerRef} className="px-6 py-3 border-t border-border bg-white flex items-center justify-end gap-2 shrink-0">{footer}</div>}
        {overlay}
      </div>
    </div>,
    document.body,
  )
}

// =========================
// Modal (centered, smaller)
// =========================
export function Modal({
  open, onClose, title, subtitle, subheader, children, footer, width = 'md',
  dismissable = true, bodyClassName, panelClassName, footerAlign = 'end',
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  // Fixed region rendered below the header and above the scrolling body (e.g. a
  // step indicator). Stays put while the body scrolls.
  subheader?: ReactNode
  children: ReactNode
  footer?: ReactNode
  width?: 'sm' | 'md' | 'lg' | 'xl'
  // When false, the close affordances are removed: no ✕, backdrop click is
  // inert, and Escape does nothing (used during an uninterruptible publish).
  dismissable?: boolean
  bodyClassName?: string
  panelClassName?: string
  footerAlign?: 'end' | 'between'
}) {
  useEscapeToClose(open && dismissable, onClose)
  const closeSize = useResponsiveIconSize(18)
  if (!open) return null
  const widthCls = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }[width]
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 coa-scrim animate-overlay-in" onClick={dismissable ? onClose : undefined} />
      <div className={cn('relative bg-white border border-border rounded-xl shadow-xl w-full flex flex-col max-h-[calc(100vh-80px)] animate-modal-in', widthCls, panelClassName)}>
        <div className="px-5 py-4 border-b border-border flex items-start justify-between shrink-0">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-fg">{title}</h3>
            {subtitle && <p className="text-sm text-fg-muted mt-0.5">{subtitle}</p>}
          </div>
          {dismissable && <button onClick={onClose} className="btn-icon shrink-0 -mr-1"><X size={closeSize} /></button>}
        </div>
        {subheader && <div className="shrink-0">{subheader}</div>}
        <div className={cn('px-5 py-4 overflow-y-auto flex-1 scrollbar-thin', bodyClassName)}>{children}</div>
        {footer && <div className={cn('px-5 py-3 border-t border-border flex items-center gap-2 bg-bg-subtle rounded-b-xl shrink-0', footerAlign === 'between' ? 'justify-between' : 'justify-end')}>{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

// =========================
// ConfirmModal (centered action-warning dialog)
// =========================
// Design-system confirmation pattern: a soft radial glow, a tinted icon
// circle, an uppercase badge, centered title and body, an optional reasons
// box, and stacked confirm / dismiss buttons. Tone drives the accent colour
// (warning = amber, danger = red, info = blue).
export function ConfirmModal({
  open, onConfirm, onDismiss, tone = 'warning', icon, badge, title, description,
  confirmLabel, dismissLabel, reasonsTitle, reasons, asideTitle, aside, confirmDisabled, children, widthClass = 'max-w-sm',
}: {
  open: boolean
  onConfirm: () => void
  onDismiss: () => void
  tone?: 'warning' | 'danger' | 'info'
  icon?: ReactNode
  badge?: string
  title: string
  /** One paragraph, or one per line. Nodes rather than strings so a sentence can
      quote a number the reader is meant to recognise. */
  description: ReactNode | ReactNode[]
  confirmLabel: string
  dismissLabel?: string
  reasonsTitle?: string
  reasons?: ReactNode[]
  /* A second box under the first, in neutral rather than the tone colour. For the
     other half of a partial answer - what the action leaves alone - which the tone
     box would otherwise read as part of what it is about to do. */
  asideTitle?: string
  aside?: ReactNode[]
  /** For a confirmation that cannot be answered until the reader supplies something. */
  confirmDisabled?: boolean
  /** A control the confirmation needs, shown between the description and the reasons. */
  children?: ReactNode
  /** The panel's max width. Narrow by default; a dialog carrying a form and a
   *  table of lines (Reverse entry) asks for more. */
  widthClass?: string
}) {
  useEscapeToClose(open, onDismiss)
  if (!open) return null

  const t = {
    warning: { glow: '#F59E0B', circle: 'bg-warning-500/10', icon: 'text-warning-600', badge: 'text-warning-700', btn: 'bg-warning-600 hover:bg-warning-700', box: 'bg-warning-50 border-warning-100', boxText: 'text-warning-700' },
    danger:  { glow: '#EF4444', circle: 'bg-danger-500/10',  icon: 'text-danger-600',  badge: 'text-danger-700',  btn: 'bg-danger-600 hover:bg-danger-700',   box: 'bg-danger-50 border-danger-100',   boxText: 'text-danger-700' },
    info:    { glow: '#3B82F6', circle: 'bg-info-500/10',    icon: 'text-info-600',    badge: 'text-info-700',    btn: 'bg-primary hover:bg-primary/90',       box: 'bg-info-50 border-info-100',       boxText: 'text-info-700' },
  }[tone]
  const lines = Array.isArray(description) ? description : [description]
  const iconNode = icon ?? <AlertTriangle size={26} className={t.icon} />

  // Portal to <body> at z-[80] so the dialog always sits above other modals -
  // notably the FormModal (z-[70], also portaled) it may be confirming the
  // dismissal of. Without this it would render behind, looking like the close
  // button does nothing.
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" role="alertdialog" aria-modal="true">
      <div className="absolute inset-0 coa-scrim animate-overlay-in" onClick={onDismiss} />
      <div className={cn('relative w-full bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col items-center', widthClass)}>
        <div className="absolute inset-x-0 top-0 h-44 pointer-events-none"
          style={{ background: `radial-gradient(ellipse 120% 60% at 50% 0%, ${t.glow} 0%, transparent 70%)`, opacity: 0.12 }} />
        <div className="relative flex flex-col items-center w-full px-8 pt-8 pb-5">
          <div className={cn('flex items-center justify-center rounded-2xl w-14 h-14 mb-3', t.circle)}>{iconNode}</div>
          {badge && <div className={cn('text-2xs font-semibold uppercase tracking-[0.08em] mb-3', t.badge)}>{badge}</div>}
          <h3 className="text-lg font-semibold text-fg text-center mb-1.5">{title}</h3>
          <div className="text-sm text-fg-muted text-center leading-relaxed space-y-0.5">
            {lines.map((l, i) => <div key={i}>{l}</div>)}
          </div>
        </div>
        {children && <div className="relative w-full px-8 pb-3 text-left">{children}</div>}
        {reasons && reasons.length > 0 && (
          <div className="relative w-full px-8 pb-3">
            <div className={cn('border rounded-lg px-4 py-3', t.box)}>
              {reasonsTitle && <div className={cn('text-2xs font-semibold uppercase tracking-wider mb-2', t.boxText)}>{reasonsTitle}</div>}
              <ul className="space-y-1.5">
                {reasons.map((r, i) => (
                  <li key={i} className={cn('text-xs leading-snug flex items-start gap-2', t.boxText)}>
                    <span className="mt-1.5 w-1 h-1 rounded-full bg-current shrink-0" />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
        {aside && aside.length > 0 && (
          <div className="relative w-full px-8 pb-3">
            <div className="border border-border rounded-lg px-4 py-3 bg-bg-subtle">
              {asideTitle && <div className="text-2xs font-semibold uppercase tracking-wider mb-2 text-fg-muted">{asideTitle}</div>}
              <ul className="space-y-1.5">
                {aside.map((r, i) => (
                  <li key={i} className="text-xs leading-snug flex items-start gap-2 text-fg-muted">
                    <span className="mt-1.5 w-1 h-1 rounded-full bg-current shrink-0" />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
        <div className="relative w-full flex flex-col gap-2.5 px-8 pb-7 pt-1">
          <button onClick={onConfirm} disabled={confirmDisabled}
            className={cn('w-full h-11 rounded-xl text-sm font-semibold text-white transition-colors',
              confirmDisabled ? 'bg-fg-subtle/40 cursor-not-allowed' : t.btn)}>{confirmLabel}</button>
          {dismissLabel && <button onClick={onDismiss} className="w-full h-11 rounded-xl text-sm font-medium bg-bg-subtle text-fg hover:bg-bg-muted transition-colors">{dismissLabel}</button>}
        </div>
      </div>
    </div>,
    document.body,
  )
}

// =========================
// Tooltip (simple)
// =========================
export function Tooltip({ content, children, align = 'center', side = 'top', rich, layer = 'default', className, delayMs, anchor }: {
  content: ReactNode; children: ReactNode; align?: 'center' | 'left' | 'right'; side?: 'top' | 'bottom'; rich?: boolean; layer?: 'default' | 'menu'; className?: string; delayMs?: number
  /** A selector, inside the trigger, for the element the card lines up with
   *  across: the hover still belongs to the whole trigger, and the card still
   *  opens off its top or bottom edge. For a wide row whose text is indented. */
  anchor?: string
}) {
  const wrapRef = useRef<HTMLSpanElement>(null)
  const tipRef = useRef<HTMLDivElement>(null)
  // A Menu portals at z-[200], so a tooltip on one of its items has to sit above
  // that or it renders behind the menu it belongs to.
  const z = layer === 'menu' ? 'z-[210]' : 'z-[90]'
  // `rich` renders a structured card (e.g. the FX-rate breakdown). It portals to
  // <body> with fixed positioning so it's never clipped by a scrolling/overflow
  // ancestor (the table container), and sizes to its content so it never wraps.
  const [rect, setRect] = useState<DOMRect | null>(null)
  /* An opening delay for a hover on a control the reader may not want the hint
     from - dragging past a period selector to reach the filters bar shouldn't
     pop the strip's explanation over the row they were heading for. Cleared on
     mouse leave, so a passing hover never shows the tooltip at all. */
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const measure = (el: HTMLSpanElement) => {
    const box = el.getBoundingClientRect()
    const at = anchor ? el.querySelector(anchor)?.getBoundingClientRect() : undefined
    return at ? new DOMRect(at.left, box.top, at.width, box.height) : box
  }
  const enterAt = (el: HTMLSpanElement) => {
    if (!delayMs) return setRect(measure(el))
    openTimer.current = setTimeout(() => setRect(measure(el)), delayMs)
  }
  const leave = () => {
    if (openTimer.current) { clearTimeout(openTimer.current); openTimer.current = null }
    setRect(null)
  }
  /* React works out mouseleave from its own tree, and anything `children`
     portals out - an open dropdown panel, a calendar - is a React descendant of
     this wrapper however far from it the panel actually sits. So moving the
     pointer onto that panel is not a leave, and a panel that unmounts under the
     pointer never delivers one at all: the hint stays on screen with nothing
     beneath it. The document is asked where the pointer really is instead.

     The tooltip's own card is portalled to <body> too, so it counts as inside:
     a `rich` card is reachable, and the pointer crossing the gap onto it is the
     reader reading it, not leaving.

     Also closes on mousedown and on scroll. A reader who has clicked the
     control, or moved the page under it, is acting on it rather than reading
     about it, and a hint anchored to a stale rectangle is worse than none. */
  useEffect(() => {
    if (!rect) return
    const inside = (t: EventTarget | null) =>
      !!t && (!!wrapRef.current?.contains(t as Node) || !!tipRef.current?.contains(t as Node))
    const away = (e: Event) => { if (!inside(e.target)) leave() }
    // A click on the trigger closes the hint even though the trigger is inside:
    // the reader has stopped reading about the control and started using it, and
    // the panel it just opened is what they want to look at.
    const press = (e: Event) => { if (!tipRef.current?.contains(e.target as Node)) leave() }
    document.addEventListener('mouseover', away)
    document.addEventListener('mousedown', press)
    document.addEventListener('scroll', leave, true)
    return () => {
      document.removeEventListener('mouseover', away)
      document.removeEventListener('mousedown', press)
      document.removeEventListener('scroll', leave, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rect])
  if (rich) {
    const above = rect ? rect.top > 260 : true
    // A rich card hangs leftward off the trigger by default, which is what a
    // trigger on the right of the page or at the end of a table row needs.
    // `align="left"` hangs it rightward instead, for a trigger sitting in a
    // form's left column where the default would run off the page edge.
    const fromLeft = align === 'left'
    return (
      <span
        ref={wrapRef}
        className={cn('relative inline-flex', className)}
        onMouseEnter={() => { const el = wrapRef.current; if (el) enterAt(el) }}
        onMouseLeave={leave}
      >
        {children}
        {rect && createPortal(

          <div
            ref={tipRef}
            className={cn('fixed bg-white border border-border rounded-xl shadow-xl w-max text-left', z)}
            style={{
              left: fromLeft ? rect.left : rect.right,
              top: above ? rect.top - 8 : rect.bottom + 8,
              transform: `translate(${fromLeft ? '0' : '-100%'}, ${above ? '-100%' : '0'})`,
            }}
          >
            {content}
            <span className={cn('absolute w-2 h-2 rotate-45 bg-white border-border', fromLeft ? 'left-5' : 'right-5', above ? '-bottom-1 border-b border-r' : '-top-1 border-t border-l')} aria-hidden />
          </div>,
          document.body,
        )}
      </span>
    )
  }
  // Portal to <body> with fixed positioning so the tooltip is never clipped by a
  // scrolling/overflow ancestor (e.g. the table's scroll container).
  const below = side === 'bottom'
  const caretX = align === 'right' ? 'right-3' : align === 'left' ? 'left-3' : 'left-1/2 -translate-x-1/2'
  const caretY = below ? '-top-1 border-t border-l' : '-bottom-1 border-b border-r'
  let left = 0, tx = '-50%'
  if (rect) {
    if (align === 'right') { left = rect.right; tx = '-100%' }
    else if (align === 'left') { left = rect.left; tx = '0' }
    else { left = rect.left + rect.width / 2; tx = '-50%' }
  }
  const top = rect ? (below ? rect.bottom + 8 : rect.top - 8) : 0
  const ty = below ? '0' : '-100%'
  return (
    <span
      ref={wrapRef}
      className={cn('relative inline-flex', className)}
      // `enterAt`/`leave` rather than setting the rect straight: a plain tooltip
      // is the one `delayMs` was added for, and setting it here ignored the delay
      // its only caller asks for.
      onMouseEnter={() => { const el = wrapRef.current; if (el) enterAt(el) }}
      onMouseLeave={leave}
    >
      {children}
      {rect && createPortal(
        <span
          // pointer-events-none: a plain tooltip is a hover hint, never a target.
          // Inside an open dropdown the card sits over the rows below the one it
          // explains, so it must not intercept the pointer on its way down.
          className={cn('fixed pointer-events-none bg-white border border-border rounded-lg shadow-lg w-max max-w-[240px] text-left px-2.5 py-1.5 text-2xs text-fg-muted whitespace-normal leading-snug', z)}
          style={{ left, top, transform: `translate(${tx}, ${ty})` }}
        >
          {content}
          <span className={cn('absolute w-2 h-2 rotate-45 bg-white border-border', caretX, caretY)} aria-hidden />
        </span>,
        document.body,
      )}
    </span>
  )
}

// =========================
// Required field marker
// =========================
export function RequiredMark({ show }: { show?: boolean }) {
  if (!show) return null
  return <span className="text-danger-600 ml-0.5" aria-hidden title="Required">*</span>
}

// =========================
// Quoted value
//
// A number or a column name quoted inside a sentence. Set in a tinted box
// rather than in quotes because the sentence around it often points at its
// pieces one at a time, and a reader has to be able to find "the 100" in it at
// a glance. There is no monospace in this module - `font-mono` resolves to
// Inter - so the digits are held still by `tabular-nums` instead of by the
// typeface.
// =========================
export function Quoted({ children }: { children: ReactNode }) {
  return (
    <span className="rounded bg-bg-muted px-1 py-px text-fg tabular-nums" style={{ fontWeight: 600 }}>
      {children}
    </span>
  )
}

// =========================
// Highlighted match
//
// The yellow behind the letters a reader typed. Every table that offers a search
// box owes them this: a row is in the result because something in it matched,
// and without the mark the reader has to find that something themselves - which
// on a description column is a sentence-long hunt per row.
//
// Renders spans rather than the HTML string `highlightText` builds, so a
// description someone typed into a journal entry can never be injected as markup.
// =========================
export function Marked({ text, q, className }: { text: string; q: string; className?: string }) {
  // The same pattern the tables match with (lib/tableSearch), so whatever a
  // search found it can mark - "1250" marks the "1,250" it found in "$ 1,250.00".
  const source = searchPatternSource(q)
  if (!source || !text) return <>{text}</>
  const parts = text.split(new RegExp(`(${source})`, 'gi'))
  return (
    <span className={className}>
      {parts.map((part, i) =>
        // split() on a capturing group puts the matches at the odd indexes, which
        // is the only place the match can be - no re-testing, and no regex state.
        i % 2 === 1 ? <mark key={i} className="mark">{part}</mark> : <Fragment key={i}>{part}</Fragment>)}
    </span>
  )
}

// =========================
// Input
// =========================
export function Input({ label, hint, error, leadingIcon, required, className, info, ...props }: {
  label?: string
  hint?: string
  error?: ReactNode
  leadingIcon?: ReactNode
  info?: ReactNode
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="label flex items-center gap-1">
          {label}<RequiredMark show={required} />
          {info && (
            <Tooltip content={info} side="top">
              <span className="inline-flex cursor-help text-fg-subtle/60 hover:text-fg-subtle"><Info size={12} /></span>
            </Tooltip>
          )}
        </label>
      )}
      <div className="relative">
        {leadingIcon && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle">{leadingIcon}</span>}
        {/* Error state mirrors the Partner forms: red border + soft red glow
            ring, message below. className merges (not replaces) so per-field
            overrides keep the error chrome. */}
        <input className={cn('input', leadingIcon && 'pl-9', error && 'border-danger-500 ring-4 ring-danger-100 focus:border-danger-500 focus:ring-4 focus:ring-danger-100', className)} {...props} />
      </div>
      {hint && !error && <p className="text-2xs text-fg-subtle">{hint}</p>}
      {error && <p data-field-error className="text-xs text-danger-600">{error}</p>}
    </div>
  )
}

// =========================
// AmountInput - the one place money is typed
// =========================
// Digits only, at most two decimals, thousands separators applied as you type,
// and the currency symbol set inside the field so the number itself stays clean
// and right-aligned. `value` / `onChange` deal in the unformatted string, so
// callers can Number() it without unpicking the display.
export function AmountInput({ value, onChange, symbol, className, ...rest }: {
  value: string
  onChange: (next: string) => void
  symbol?: string
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  const ref = useRef<HTMLInputElement>(null)
  /* Inserting separators shifts every character after the caret, so the caret
     is remembered as "how many value characters precede it" and restored after
     the reformat - otherwise typing the fourth digit of 1,000 jumps it left. */
  const caretChars = useRef<number | null>(null)
  const display = groupAmount(value)

  // Deliberately runs on every render, not just when `display` changes: a
  // keystroke the sanitiser rejects leaves the display identical, and a pending
  // caret that never got consumed would later be applied to the wrong edit.
  useLayoutEffect(() => {
    const el = ref.current
    const target = caretChars.current
    if (!el || target === null) return
    caretChars.current = null
    let pos = 0
    for (let seen = 0; pos < display.length && seen < target; pos++) {
      if (display[pos] !== ',') seen++
    }
    el.setSelectionRange(pos, pos)
  })

  const charsBefore = (text: string, at: number) => text.slice(0, at).replace(/[^\d.]/g, '').length

  return (
    <div className="relative">
      {symbol && (
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[13px] text-fg-subtle pointer-events-none select-none">{symbol}</span>
      )}
      <input
        ref={ref}
        {...rest}
        value={display}
        inputMode="decimal"
        onChange={e => {
          caretChars.current = charsBefore(e.target.value, e.target.selectionStart ?? e.target.value.length)
          onChange(sanitizeAmount(e.target.value))
        }}
        onKeyDown={e => {
          // Backspacing onto a separator would delete a character the formatter
          // immediately puts back, so it takes the digit before it instead.
          const el = e.currentTarget
          const at = el.selectionStart
          if (e.key !== 'Backspace' || at === null || at !== el.selectionEnd || display[at - 1] !== ',') return
          e.preventDefault()
          caretChars.current = charsBefore(display, at - 2)
          onChange(sanitizeAmount(display.slice(0, at - 2) + display.slice(at)))
        }}
        className={cn(symbol && 'pl-6', className)}
      />
    </div>
  )
}

// =========================
// Textarea
// =========================
/* A text box that grows with what is typed into it rather than scrolling
   inside itself - the established pattern for free text (the account page's
   Notes card is the first of it). A box that scrolls inside a page that already
   scrolls hides the start of what the reader wrote the moment it overflows.

   Height is set from the content on every change: collapsed to 'auto' first so
   it can shrink when text is deleted, then to the content's height plus the
   border, which scrollHeight leaves out under border-box sizing. It is set again
   when the box changes width, since the same text wraps to a different number
   of lines - a window resized, or a modal still settling to its width when the
   text first arrived, would otherwise keep the height worked out for the old
   width. */
export function useAutoGrow(ref: React.RefObject<HTMLTextAreaElement>, value: unknown, minHeight = 0, enabled = true) {
  const fit = useCallback(() => {
    const el = ref.current
    if (!el || !enabled) return
    el.style.height = 'auto'
    const border = el.offsetHeight - el.clientHeight
    el.style.height = `${Math.max(minHeight, el.scrollHeight + border)}px`
  }, [ref, minHeight, enabled])
  useLayoutEffect(fit, [fit, value])
  useEffect(() => {
    const el = ref.current
    if (!el || !enabled || typeof ResizeObserver === 'undefined') return
    let width = el.clientWidth
    const ro = new ResizeObserver(() => {
      if (el.clientWidth === width) return
      width = el.clientWidth
      fit()
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref, enabled, fit])
}

export function Textarea({ label, hint, required, autoGrow, className, ...props }: {
  label?: string
  hint?: string
  /** Start one line tall, the height of an input, and grow as the text does. */
  autoGrow?: boolean
} & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useAutoGrow(ref, props.value, 0, !!autoGrow)
  return (
    <div className="space-y-1.5">
      {label && <label className="label block">{label}<RequiredMark show={required} /></label>}
      <textarea
        ref={ref}
        rows={autoGrow ? 1 : undefined}
        className={cn('input py-2', autoGrow ? 'h-auto min-h-9 leading-5 resize-none overflow-hidden' : 'min-h-[72px]', className)}
        {...props}
      />
      {hint && <p className="text-2xs text-fg-subtle">{hint}</p>}
    </div>
  )
}

// =========================
// Select, custom popover dropdown (Partners style), not a native <select>.
// Keeps the familiar API: pass <option value>…</option> children, a controlled
// `value`, and an `onChange` that receives an event-shaped `{ target: { value } }`
// so existing call sites need no changes. The menu is portaled to <body> so it
// is never clipped inside scrollable modals / slide-overs.
// =========================
export function Select({ label, ariaLabel, hint, error, children, required, className, value, onChange, disabled, searchable, placeholder, onCreate, createNoun, createAlways, info, infoRich, openDown, autoOpen, searchPlaceholder, menuMinWidth }: {
  label?: string
  /* Names the trigger. A visible `label` cannot do it on its own - the trigger is
     a button, not an input, so nothing ties the two - and where the same field is
     repeated the labels all read alike: a column of triggers saying "Choose", or
     one "Value for this account" per dimension card, is a set a screen reader
     cannot tell apart. Set this to say which one this is; it wins over `label`,
     which stays as the visible text. */
  ariaLabel?: string
  // Explainer under the field, for a choice that needs saying rather than
  // hovering for. Same treatment as Input's hint; an error takes its place. Takes
  // a node so a field can carry a second line under the first (see the fiscal
  // year's lock cue) without every caller having to lay one out.
  hint?: ReactNode
  error?: string
  children: ReactNode
  // When true, the menu shows a filter input at the top (use for long lists).
  searchable?: boolean
  // Shown on the trigger when nothing is selected (and as the search hint).
  placeholder?: string
  /* When provided, typing something the list does not hold offers a
     + Create "{what was typed}" row under it. Receives that text. */
  onCreate?: (value: string) => void
  // Names the thing in the "No {createNoun}s found" line.
  createNoun?: string
  /* Keeps the create row standing on an empty search, reading "Create new
     {createNoun}" rather than naming something typed. Set it where `onCreate`
     has somewhere to send a reader who has typed nothing - a form that asks for
     the name itself. Without that the row answers the click with nothing, which
     is the bug it was once taken out for; it is not a licence to show an offer
     that cannot be met. */
  createAlways?: boolean
  // Optional explainer shown as an (i) tooltip next to the label.
  info?: ReactNode
  // Set when `info` supplies its own card chrome (see GLTypeLegend), so it isn't
  // wrapped in the plain tooltip's padding a second time.
  infoRich?: boolean
  // Force the menu to always open below the trigger (no upward flip).
  openDown?: boolean
  /* Opens the menu on mount. For a picker that only exists because the reader
     just asked for it - revealed by a button, not sitting on the form - where a
     closed menu would charge a second click for a decision already made. */
  autoOpen?: boolean
  // Placeholder for the in-menu search box (defaults to "Search…"); kept
  // separate from the trigger `placeholder` so the search box reads as a search.
  searchPlaceholder?: string
  // Floor for the menu width, in px. A narrow trigger (e.g. in a table cell)
  // otherwise yields a menu too tight to read long/indented options; the menu
  // grows to at least this width and shifts left to stay on-screen.
  menuMinWidth?: number
} & React.SelectHTMLAttributes<HTMLSelectElement>) {
  const [open, setOpen] = useState(!!autoOpen)
  const [query, setQuery] = useState('')
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const [box, setBox] = useState<{ left: number; width: number; top?: number; bottom?: number } | null>(null)

  // Flatten <option> children → items. Options without an explicit `value`
  // fall back to their text (native <select> semantics).
  const items = Children.toArray(children)
    .filter((c): c is React.ReactElement<any> => isValidElement(c) && c.type === 'option')
    .map(o => ({
      value: String(o.props.value ?? o.props.children ?? ''),
      label: o.props.children as ReactNode,
      disabled: !!o.props.disabled,
      // Optional hierarchy hint: indents the option in the dropdown list (only)
      // so nested groups read as a tree. Ignored in the trigger and in search.
      depth: Number((o.props as Record<string, unknown>)['data-depth'] ?? 0),
      // Optional per-option explainer, shown on hover in the open menu. Lets a
      // list of bare labels (e.g. account roles) carry the same explanation the
      // rest of the form gives, without spelling it out on every row.
      tip: (o.props as Record<string, unknown>)['data-tip'] as ReactNode,
      // Set when the tip supplies its own card chrome, so it isn't wrapped in
      // the plain tooltip's padding a second time.
      tipRich: !!(o.props as Record<string, unknown>)['data-tip-rich'],
      /* Optional second line, always shown under the label in the open menu.
         For a list whose names alone do not say enough to choose between - the
         account roles - without a card opening on every row the pointer
         crosses. Searched along with the label. */
      desc: (o.props as Record<string, unknown>)['data-desc'] as string | undefined,
      /* Optional picture before the label, in the open list and on the trigger:
         a currency's flag. A node rather than part of the label, so the label
         stays the text the search reads and marks. */
      icon: (o.props as Record<string, unknown>)['data-icon'] as ReactNode,
    }))
  const curVal = String(value ?? '')
  const current = items.find(i => i.value === curVal)
  const marked = (text: ReactNode) => searchable && typeof text === 'string' ? <Marked text={text} q={query} /> : text
  // Filtered view when searchable. Empty-value placeholder rows are hidden once
  // the user starts typing. We also never render an empty-value option whose
  // label just repeats the trigger placeholder - the placeholder already shows
  // that empty state, so listing it again is a redundant "select the prompt"
  // row. A distinctly-labelled empty option (e.g. an explicit "No role" clear)
  // still shows, since it reads as a real choice rather than the prompt.
  const q = query.trim().toLowerCase()
  const phLabel = String(placeholder ?? '').trim().toLowerCase()
  const shownItems = (searchable && q
    ? items.filter(i => i.value !== '' && (String(i.label).toLowerCase().includes(q) || (i.desc ?? '').toLowerCase().includes(q)))
    : items
  ).filter(i => !(i.value === '' && phLabel !== '' && String(i.label).trim().toLowerCase() === phLabel))

  /* By default the create row offers the thing typed, so it only exists once
     something has been typed that the list does not already hold. Offered on an
     empty search it read as "open a form for a new one" and answered a click with
     nothing, having no name to give what it would have made - which is what
     `createAlways` has to supply: somewhere to send a reader who typed nothing.
     Either way whatever was typed rides along as a head start. */
  const q0 = query.trim()
  const named = !!q0 && !items.some(i => String(i.label).trim().toLowerCase() === q0.toLowerCase())
  const creatable = named || !!createAlways

  const place = () => {
    const t = triggerRef.current
    if (!t) return
    const r = t.getBoundingClientRect()
    const estimated = Math.min(items.length, 8) * 38 + 8 + (searchable ? 44 : 0)
    const below = openDown || r.bottom + estimated <= window.innerHeight || r.top < estimated
    // Widen a narrow trigger's menu to the requested floor (capped at the
    // viewport), then pull it left if the wider menu would run off the edge.
    const width = Math.min(Math.max(r.width, menuMinWidth ?? 0), window.innerWidth - 16)
    const left = Math.max(8, Math.min(r.left, window.innerWidth - 8 - width))
    setBox(below ? { left, width, top: r.bottom + 4 } : { left, width, bottom: window.innerHeight - r.top + 4 })
  }

  useLayoutEffect(() => { if (open) place() }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  // Reset the filter each time the menu opens, and focus the search box.
  useEffect(() => {
    if (!open) { setQuery(''); return }
    if (searchable) requestAnimationFrame(() => searchRef.current?.focus())
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  /* Escape shuts the list and hands focus back to the trigger. On the modals'
     shared stack rather than a listener of its own: a select opened inside a form
     registers after the form, so it answers the keypress alone. Listening
     separately, one Escape closed the list and the half-filled form behind it -
     which is why the entry-modal tests dismiss their pickers by clicking. */
  const closeList = useCallback(() => {
    if (popRef.current?.contains(document.activeElement)) triggerRef.current?.focus()
    setOpen(false)
  }, [])
  useEscapeToClose(open, closeList)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node) || popRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    // On scroll/resize keep the menu glued to its trigger by repositioning,
    // rather than closing it. Closing on scroll breaks the search box inside a
    // scrolling modal: focusing the input nudges the modal body and the menu
    // would vanish before the user can type. Scrolling within the menu itself
    // (e.g. a long option list) never repositions.
    const onScroll = (e: Event) => {
      if (popRef.current && e.target instanceof Node && popRef.current.contains(e.target)) return
      place()
    }
    document.addEventListener('mousedown', onDoc)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open])

  const pick = (v: string) => {
    setOpen(false)
    onChange?.({ target: { value: v } } as unknown as React.ChangeEvent<HTMLSelectElement>)
  }

  return (
    <div className="space-y-1.5">
      {label && (
        <label className="label flex items-center gap-1">
          {label}<RequiredMark show={required} />
          {info && (
            <Tooltip rich={infoRich} content={info} side="top" align={infoRich ? 'left' : 'center'}>
              <span className="inline-flex cursor-help text-fg-subtle/60 hover:text-fg-subtle"><Info size={12} /></span>
            </Tooltip>
          )}
        </label>
      )}
      <button
        type="button"
        ref={triggerRef}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => !disabled && setOpen(o => !o)}
        // The red ring holds while focused too: a jump to the error focuses the
        // field, and the plain focus style used to wash it grey (Mahad, 2026-10-08).
        className={cn('input pr-9 relative flex items-center text-left cursor-pointer', error && 'border-danger-500 ring-4 ring-danger-100 focus:border-danger-500 focus:ring-4 focus:ring-danger-100', disabled && 'opacity-60 cursor-not-allowed', className)}
      >
        {current && current.value !== '' && current.icon && <span className="inline-flex shrink-0 mr-2 leading-none" aria-hidden>{current.icon}</span>}
        <span className={cn('truncate min-w-0', (!current || current.value === '') && 'coa-placeholder')}>
          {current && current.value !== '' ? current.label : (placeholder ?? current?.label ?? '')}
        </span>
        <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-subtle/60 pointer-events-none" />
      </button>
      {error && <p data-field-error className="text-2xs text-danger-700">{error}</p>}
      {hint && !error && <p className="text-2xs text-fg-subtle">{hint}</p>}
      {open && box && createPortal(
        <div
          ref={popRef}
          role="listbox"
          className="fixed z-[80] bg-white border border-border rounded-lg shadow-lg max-h-72 flex flex-col overflow-hidden"
          style={{ left: box.left, width: box.width, top: box.top, bottom: box.bottom }}
        >
          {searchable && (
            <div className="p-1.5 border-b border-border shrink-0">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-subtle pointer-events-none" />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder={searchPlaceholder ?? 'Search…'}
                  className="w-full h-8 pl-8 pr-2 rounded-md border border-border text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                />
              </div>
            </div>
          )}
          {/* Above the list, not under it. Mahad, 2026-09-29, pointing at the
              carrier picker: the way out of a list you have searched and failed
              is the first thing to reach, not something to scroll past the
              failure to find. Tinted rather than bordered so it reads as an
              offer sitting over the list instead of a first option in it. */}
          {onCreate && creatable && (
            <div className="p-1.5 pb-0 shrink-0">
              <button
                type="button"
                onClick={() => { setOpen(false); onCreate(q0) }}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-md bg-accent text-sm font-medium text-primary hover:bg-primary/[0.12] transition-colors"
              >
                <Plus size={15} className="shrink-0" />
                <span className="truncate">{named ? `Create "${q0}"` : `Create new ${createNoun ?? 'item'}`}</span>
              </button>
            </div>
          )}
          <div className="py-1.5 overflow-auto scrollbar-thin">
            {shownItems.map((it, i) => {
              const selected = it.value === curVal
              const row = (
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  /* aria-disabled rather than the native attribute, as MenuItem
                     does it: a disabled button swallows pointer events, and an
                     option that cannot be picked is exactly the one whose hover
                     has to say why. Design review, 2026-10-02 - Nophil: *"there
                     should be a hover state that tells you why it's not
                     selectable."* The pick is suppressed here instead. */
                  aria-disabled={it.disabled || undefined}
                  onClick={it.disabled ? undefined : () => pick(it.value)}
                  className={cn('w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-left transition-colors',
                    selected ? 'bg-primary/[0.06] text-primary font-medium' : 'text-fg hover:bg-bg-subtle',
                    it.disabled && 'opacity-50 cursor-not-allowed')}
                >
                  <span className="flex items-center min-w-0 flex-1" style={it.depth ? { paddingLeft: it.depth * 16 } : undefined}>
                    {it.depth > 0 && <span data-option-text className="text-fg-subtle/40 mr-1 shrink-0">└</span>}
                    {it.icon && <span className="inline-flex shrink-0 mr-2 leading-none" aria-hidden>{it.icon}</span>}
                    {/* What matched the search, marked in the yellow every table
                        search uses. Design review, 2026-09-30 - Eli: *"This should
                        do the highlighting."* Only plain-text labels can be marked. */}
                    {it.desc ? (
                      <span className="min-w-0 flex flex-col">
                        <span className="truncate">{marked(it.label)}</span>
                        <span className="text-2xs text-fg-subtle leading-snug whitespace-normal" style={{ fontWeight: 400 }}>{marked(it.desc)}</span>
                      </span>
                    ) : (
                      <span className={cn('truncate', !selected && it.value === '' && 'text-fg-subtle')}>{marked(it.label)}</span>
                    )}
                  </span>
                  {selected && <Check size={15} className="text-primary shrink-0" />}
                </button>
              )
              // Opening downward from the option, lined up with where its text
              // starts - the nesting mark on an indented account - so the card
              // points at the account it explains. Aligned to the row's own left
              // edge, every card opened at the panel's edge whatever the depth.
              return it.tip
                ? <Tooltip key={i} rich={it.tipRich} content={it.tip} side="bottom" align="left" anchor="[data-option-text]" className="w-full">{row}</Tooltip>
                : <Fragment key={i}>{row}</Fragment>
            })}
            {shownItems.length === 0 && (
              <div className="px-3 py-3 text-sm text-fg-subtle text-center">No {createNoun ? `${createNoun}s` : 'matches'} found</div>
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}

// =========================
// Toggle
// =========================
export function Toggle({ checked, onChange, label, hint, info, inline }: {
  checked: boolean; onChange: (v: boolean) => void; label?: string; hint?: string; inline?: boolean
  /** An (i) beside the label whose tooltip explains the setting, for an
      explanation too long to sit under the switch. Hovering or clicking it
      leaves the switch as it was. */
  info?: ReactNode
}) {
  const knob = (
    // The 2px nudge is there to sit the track on a label's first line, so it
    // only applies when there is a label to sit on. Bare, the switch is the
    // whole control and centres in its row.
    <span className={cn('inline-flex shrink-0 cursor-pointer items-center rounded-full transition-colors',
      inline ? 'h-[18px] w-8' : cn('h-5 w-9', (label || hint) && 'mt-0.5'),
      checked ? 'bg-brand-600' : 'bg-border-strong')}>
      <span className={cn('inline-block transform rounded-full bg-white shadow transition',
        inline ? 'h-3.5 w-3.5' : 'h-4 w-4',
        checked ? (inline ? 'translate-x-[16px]' : 'translate-x-[18px]') : 'translate-x-0.5')} />
    </span>
  )
  if (inline) {
    return (
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className="inline-flex items-center gap-2 shrink-0"
      >
        {label && <span className={cn('text-xs font-medium whitespace-nowrap', checked ? 'text-fg' : 'text-fg-muted')}>{label}</span>}
        {knob}
      </button>
    )
  }
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn('flex items-start gap-3 text-left', (label || hint) && 'w-full')}
    >
      {knob}
      {(label || hint) && (
        <span className="flex-1">
          {label && (
            <span className="flex items-center gap-1 text-sm font-medium text-fg">
              {label}
              {info && (
                <Tooltip side="top" content={<span className="block max-w-[280px]">{info}</span>}>
                  <span data-toggle-info aria-label={`About ${label}`} onClick={e => e.stopPropagation()}
                    className="inline-flex cursor-help text-fg-subtle/60 hover:text-fg-subtle"><Info size={13} /></span>
                </Tooltip>
              )}
            </span>
          )}
          {hint && <span className="block text-xs text-fg-muted mt-0.5">{hint}</span>}
        </span>
      )}
    </button>
  )
}

// =========================
// Tabs
// =========================
export function Tabs({ tabs, value, onChange, right }: {
  tabs: { id: string; label: string; count?: number; icon?: ReactNode }[]
  value: string
  onChange: (id: string) => void
  right?: ReactNode
}) {
  return (
    <div className="flex items-center justify-between border-b border-border">
      <div className="flex items-center gap-0 min-w-max -mb-px">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={cn(
              'inline-flex items-center gap-1.5 px-3.5 py-2.5 text-[13px] border-b-2 transition-colors whitespace-nowrap',
              value === t.id
                ? 'border-primary text-primary font-medium'
                : 'border-transparent text-fg-muted font-normal hover:text-fg hover:border-border'
            )}
          >
            {t.icon}
            {t.label}
            {typeof t.count === 'number' && (
              <span className={cn('inline-flex items-center justify-center px-1.5 h-4 rounded text-2xs', value === t.id ? 'bg-primary text-white' : 'bg-bg-muted text-fg-muted')}>{t.count}</span>
            )}
          </button>
        ))}
      </div>
      {right && <div>{right}</div>}
    </div>
  )
}

// =========================
// Pill (sorting / filter)
// =========================
export function Pill({ active, onClick, children, count }: { active?: boolean; onClick?: () => void; children: ReactNode; count?: number }) {
  return (
    <button onClick={onClick} className={cn('pill', active && 'pill-active')}>
      {children}
      {typeof count === 'number' && (
        <span className={cn('inline-flex items-center justify-center min-w-[18px] h-4 px-1 rounded text-2xs', active ? 'bg-white/20 text-white' : 'bg-bg-muted text-fg-muted')}>{count}</span>
      )}
    </button>
  )
}

// =========================
// MultiSelect popover (lightweight)
// =========================
export function MultiSelectPopover<T extends string>({
  options, value, onChange, label, placeholder = 'Select…',
}: {
  options: { value: T; label: string; count?: number }[]
  value: T[]
  onChange: (v: T[]) => void
  label?: string
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])
  const toggle = (v: T) => onChange(value.includes(v) ? value.filter(x => x !== v) : [...value, v])
  const filtered = options.filter(o => o.label.toLowerCase().includes(q.toLowerCase()))
  return (
    <div ref={ref} className="relative">
      {label && <label className="label block mb-1.5">{label}</label>}
      <button onClick={() => setOpen(o => !o)} className="input flex items-center justify-between text-left">
        <span className="text-sm truncate">{value.length === 0 ? <span className="coa-placeholder">{placeholder}</span> : `${value.length} selected`}</span>
        <ChevronDown size={16} className="text-fg-subtle/60" />
      </button>
      {open && (
        <div className="absolute z-30 mt-1 w-full bg-white border border-border rounded-md shadow-lg p-1">
          <div className="relative px-1.5 py-1.5">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search…" className="input pl-8 h-8" />
          </div>
          <div className="max-h-56 overflow-auto scrollbar-thin">
            {filtered.map(o => {
              const sel = value.includes(o.value)
              return (
                <button key={o.value} onClick={() => toggle(o.value)} className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-bg-subtle text-sm">
                  <span className={cn('w-4 h-4 rounded border flex items-center justify-center', sel ? 'bg-primary border-primary' : 'border-border-strong')}>
                    {sel && <Check size={12} className="text-white" />}
                  </span>
                  <span className="flex-1 text-left">{o.label}</span>
                  {typeof o.count === 'number' && <span className="text-2xs text-fg-subtle">{o.count}</span>}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// =========================
// KPI Card
// =========================
export function KPICard({
  label, value, delta, hint, icon, onClick, accent, tooltip, subDetail, trend,
}: {
  label: string
  value: ReactNode
  delta?: { value: string; positive?: boolean }
  hint?: ReactNode
  icon?: ReactNode
  onClick?: () => void
  accent?: 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'
  // When set, an info icon sits after the label and reveals this on hover.
  tooltip?: ReactNode
  // A faint one-line descriptor under the value (CM DraggableKpiCard parity).
  subDetail?: ReactNode
  // Coloured directional trend chip next to the value (CM parity).
  trend?: { direction: 'up' | 'down' | 'flat'; pctChange?: number; label?: string }
}) {
  // `hint` is intentionally not rendered, KPI cards follow the Partner
  // detail style: tinted icon tile + label row, large tabular value.
  void hint
  const color = {
    brand: '#0A77FF', success: '#059669', warning: '#EA580C',
    danger: '#E11D48', info: '#7C3AED', neutral: '#64748B',
  }[accent ?? 'brand']
  const trendColor = trend ? { up: '#059669', down: '#DC2626', flat: '#64748B' }[trend.direction] : undefined
  const trendArrow = trend ? { up: '↑', down: '↓', flat: '→' }[trend.direction] : ''
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        // w-full/h-full so the card fills its grid track (or draggable
        // wrapper) instead of shrinking to its content width.
        'w-full h-full min-w-0 bg-card border border-border rounded-lg px-3 py-2 text-left transition-all group',
        onClick ? 'cursor-pointer hover:-translate-y-px hover:border-[#93B8F7] hover:shadow-[0_2px_8px_-3px_rgba(10,119,255,0.10)]' : 'cursor-default'
      )}
    >
      <div className="flex items-center gap-2 mb-1">
        {icon && (
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}10` }}>
            <span className="inline-flex [&_svg]:w-3.5 [&_svg]:h-3.5" style={{ color }}>{icon}</span>
          </div>
        )}
        <span className="text-[10.5px] text-slate-500 truncate" style={{ fontWeight: 500 }}>{label}</span>
        {tooltip && (
          <Tooltip content={tooltip} side="bottom">
            <span onClick={e => { e.stopPropagation(); e.preventDefault() }} className="inline-flex shrink-0 text-slate-400 hover:text-slate-600 cursor-help"><Info className="w-3 h-3" /></span>
          </Tooltip>
        )}
      </div>
      <div className="flex items-baseline gap-1.5">
        <p className="text-[15px] tabular-nums text-slate-700 tracking-tight whitespace-nowrap" style={{ fontWeight: 600, lineHeight: 1.2 }}>{value}</p>
        {delta && (
          <span className={cn('text-[10px] font-medium shrink-0', delta.positive ? 'text-success' : 'text-destructive')}>
            {delta.positive ? '+' : ''}{delta.value}
          </span>
        )}
        {trend && (
          <span className="text-[10px] font-medium shrink-0 whitespace-nowrap" style={{ color: trendColor }}>
            {trendArrow}{typeof trend.pctChange === 'number' ? ` ${trend.pctChange > 0 ? '+' : ''}${trend.pctChange}%` : ''}{trend.label ? ` ${trend.label}` : ''}
          </span>
        )}
      </div>
      {subDetail && (
        <p className="text-[9.5px] text-[#94A3B8] mt-0.5 truncate">{subDetail}</p>
      )}
    </button>
  )
}

// =========================
// Empty State
// =========================
/* The Partners module's empty-state anatomy, ported. Mahad, 2026-09-24, on the
   edit wizard's Review changes step reading as a bare bordered box: *"I think
   if there is nothing to show, we do have UI patterns for emplty state in
   partners module."*

   Four parts stacked and centred: a tile carrying an icon, a title naming what
   is absent, a line saying why, and - where there is one - the thing to do
   about it. A sentence about emptiness is not an empty state; the tile and the
   space around it are what tell a reader the surface is waiting rather than
   broken, which is also why the tile keeps bobbing.

   What varies is the container, and Partners varies it on a single question:
   is the empty state standing in open space, or already inside a card? In open
   space `framed` closes the gap where the content would be; inside a card that
   border is already drawn, and a second one would be a box in a box.

   The frame is the module's ordinary panel and not Partners' dashed outline -
   Mahad, 2026-09-24: *"I really dont like the dashed border around the grey
   area."* Dashes read as a place to drop something into, which is a promise
   none of these surfaces keep: there is nothing to drag here, and the reason
   the panel is empty is already written inside it.

   Two sizes because the same four parts have to sit across the width of a
   table and inside a detail rail.

   `tone` is for the empty states that are an answer rather than an absence -
   the import grid's "No errors." is a result the reader wanted, and a grey tile
   reports it as though something were missing. */
export function EmptyState({ icon, title, description, action, framed, tone = 'neutral', size = 'md', className }: {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  framed?: boolean
  tone?: 'neutral' | 'success' | 'warning'
  size?: 'sm' | 'md'
  className?: string
}) {
  const sm = size === 'sm'
  const toneCls = {
    neutral: 'border border-border bg-gradient-to-br from-white to-bg-muted text-fg-subtle shadow-xs',
    success: 'bg-success-50 text-success-600',
    warning: 'bg-warning-50 text-warning-600',
  }[tone]
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center animate-step-in',
        sm ? 'px-3 py-5' : 'px-6 py-12',
        framed && 'rounded-xl border border-border bg-bg-subtle/40',
        className,
      )}
    >
      {icon && (
        <div
          className={cn(
            'flex items-center justify-center shrink-0 rounded-xl animate-float',
            toneCls,
            sm ? 'w-9 h-9 mb-2.5' : 'w-12 h-12 mb-3',
          )}
        >
          {icon}
        </div>
      )}
      <h3 className={cn('text-fg', sm ? 'text-[11.5px]' : 'text-13')} style={{ fontWeight: 600 }}>{title}</h3>
      {description && (
        <p className={cn('mt-1 text-fg-subtle leading-relaxed', sm ? 'text-11 max-w-[240px]' : 'text-[12px] max-w-[320px]')}>
          {description}
        </p>
      )}
      {action && <div className={sm ? 'mt-3' : 'mt-4'}>{action}</div>}
    </div>
  )
}

// =========================
// Banner / Alert
// =========================
export function Banner({ tone = 'info', title, children, action, className, icon, hideIcon }: {
  tone?: 'info' | 'success' | 'warning' | 'danger'
  title?: string
  children: ReactNode
  action?: ReactNode
  className?: string
  icon?: ReactNode
  hideIcon?: boolean
}) {
  const cls = {
    info: 'bg-info-50 border-info-100 text-info-700',
    success: 'bg-success-50 border-success-100 text-success-700',
    warning: 'bg-warning-50 border-warning-100 text-warning-700',
    danger: 'bg-danger-50 border-danger-100 text-danger-700',
  }[tone]
  const iconCls = {
    info: 'text-info-600', success: 'text-success-600', warning: 'text-warning-600', danger: 'text-danger-600',
  }[tone]
  const defaultIcon = {
    info: <Info size={16} />,
    success: <CheckCircle2 size={16} />,
    warning: <AlertTriangle size={16} />,
    danger: <AlertCircle size={16} />,
  }[tone]
  const iconNode = hideIcon ? null : (icon ?? defaultIcon)
  // Matches the Partners notice style: rounded-xl card, tone-tinted icon, and
  // tone-coloured body text (rather than neutral grey).
  return (
    <div className={cn('border rounded-xl p-3 text-sm flex items-start gap-2.5', cls, className)}>
      {/* The icon centred on the first line of text, which is 1rem tall. A bare
          span took the body's taller line box, so the icon sat below the words
          and a one-line banner read off-centre (Mahad, 2026-10-07). */}
      {iconNode && <span className={cn('shrink-0 flex items-center h-4', iconCls)}>{iconNode}</span>}
      <div className="flex-1 min-w-0">
        {title && <div className="font-semibold text-xs">{title}</div>}
        <div className={cn(title && 'mt-0.5', 'text-xs leading-4 opacity-90')}>{children}</div>
      </div>
      {action}
    </div>
  )
}

// =========================
// Card wrappers
// =========================
export function Card({ children, className, ...rest }: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('card', className)} {...rest}>{children}</div>
}
export function CardHeader({ title, subtitle, action, className }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('px-4 py-3 border-b border-border flex items-start justify-between gap-3', className)}>
      <div>
        <div className="text-[13px] font-semibold text-fg">{title}</div>
        {subtitle && <div className="text-xs text-fg-muted mt-0.5">{subtitle}</div>}
      </div>
      {action}
    </div>
  )
}

// One answer to a question asked as a set of cards. A radio for a single answer,
// a checkbox for a list, so the control says whether picking a second choice
// replaces or adds. The checkbox is the house one (a filled box with a tick),
// not a squared-off radio: a rounded square holding a dot reads as a radio that
// has been drawn slightly wrong, and two of them lit at once then looks like a
// bug rather than two answers.
// The whole card is the button, so everything inside it has to be phrasing
// content - a `div` in here is invalid markup. Diagrams passed as children
// should be built from spans.
export function OptionCard({ active, multi, onClick, label, description, descriptionClass, accessory, className, walkthrough, children }: {
  active: boolean; multi?: boolean; onClick: () => void
  label: string; description?: ReactNode
  /** Sized for a dense column by default; widen it on a roomier surface. */
  descriptionClass?: string
  /** Sits beside the label, e.g. a tooltip explaining the term the label uses. */
  accessory?: ReactNode
  className?: string
  /** The key a walkthrough spotlights this answer by. Carried on the card itself
      rather than a wrapper, because a wrapper around a stretched grid item
      leaves the card at its own height and the row stops lining up. */
  walkthrough?: string
  /** What the answer needs to show under its description, e.g. a worked example. */
  children?: ReactNode
}) {
  return (
    <button
      onClick={onClick}
      data-walkthrough={walkthrough}
      aria-pressed={multi ? active : undefined}
      className={cn('w-full text-left px-4 py-3 rounded-lg border-2 transition-all bg-white flex items-start gap-3',
        active ? 'border-primary shadow-sm' : 'border-border hover:border-border-strong', className)}
    >
      {multi ? (
        <span className={cn('mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0',
          active ? 'bg-primary border-primary' : 'border-border-strong bg-white')}>
          {active && <Check size={12} className="text-white" />}
        </span>
      ) : (
        <span className={cn('mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0',
          active ? 'border-primary' : 'border-border')}>
          {active && <span className="w-2 h-2 rounded-full bg-primary" />}
        </span>
      )}
      <span className="min-w-0">
        <span className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-fg">{label}</span>
          {accessory}
        </span>
        {description && <span className={cn('block text-fg-muted mt-0.5', descriptionClass ?? 'text-2xs')}>{description}</span>}
        {children}
      </span>
    </button>
  )
}

// =========================
// Menu (dropdown)
// =========================
// Menu content portals to document.body (like the Partner module's Radix
// dropdowns) so it can never be clipped by overflow-hidden ancestors such as
// DetailHeaderCard. Position is fixed to the trigger; closes on scroll/resize.

/** Breathing room kept between a portalled panel and the edge of the window. */
const GUTTER = 8

/* What Tab will stop on inside a portalled panel. `aria-disabled` items are
   deliberately included: MenuItem disables that way rather than with the native
   attribute, and an item that refuses itself still has a reason worth reaching. */
const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'

const focusablesIn = (el: HTMLElement | null) =>
  el ? Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(n => n.offsetParent !== null || n === document.activeElement) : []

export function Menu({ trigger, children, align = 'right', flush }: {
  /* A function form for a trigger that has to look different while its panel is
     open - the toolbar buttons carry a pressed fill, and the only thing that
     knows the panel is open is this. */
  trigger: ReactNode | ((open: boolean) => ReactNode)
  children: (close: () => void) => ReactNode
  align?: 'left' | 'right'
  /* Draws no padding of its own, for a panel whose content brings its own inset.
     The default `py-1` is there for `MenuItem`, which is full-bleed horizontally
     and needs the panel to hold it off the top and bottom edges. Content that is
     already inset instead lands 4px further from the top than from the sides, and
     `cn` is plain clsx here so a caller cannot cancel the padding from outside. */
  flush?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number; right: number; anchorTop: number; flipped: boolean } | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  /* The panel is portalled to the end of <body>, so it is nowhere near its
     trigger in tab order: Tab from the trigger used to walk on to the next row
     and leave the menu open behind it, which put every row action out of a
     keyboard's reach. Focus is therefore steered by hand - Tab off the trigger
     goes into the panel, Tab off either end of the panel closes and comes back.
     Nothing traps: every route out is one keypress. */
  const close = useCallback(() => {
    // Only pull focus back if it is inside the panel about to unmount; a menu
    // closed by a click elsewhere must not yank focus off wherever that landed.
    if (menuRef.current?.contains(document.activeElement)) focusablesIn(ref.current)[0]?.focus()
    setOpen(false)
  }, [])

  // Shares the modals' Escape stack rather than listening on its own, so a menu
  // opened over a modal is the only thing the keypress reaches - registered last,
  // it is on top. Left to two independent document listeners, one Escape closed
  // the menu and the half-filled form underneath it together.
  useEscapeToClose(open, close)

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => {
      if (ref.current?.contains(e.target as Node)) return
      if (menuRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    const shut = () => setOpen(false)
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const items = focusablesIn(menuRef.current)
      if (!items.length) return
      const at = items.indexOf(document.activeElement as HTMLElement)
      if (at === -1) {
        // Focus is still on the trigger: Tab steps into the panel rather than
        // past it, which is the order the panel appears in on screen.
        e.preventDefault()
        items[e.shiftKey ? items.length - 1 : 0].focus()
        return
      }
      const leaving = e.shiftKey ? at === 0 : at === items.length - 1
      if (leaving) { e.preventDefault(); close() }
    }
    document.addEventListener('mousedown', h)
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', shut)
    document.addEventListener('scroll', shut, true)
    return () => {
      document.removeEventListener('mousedown', h)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', shut)
      document.removeEventListener('scroll', shut, true)
    }
  }, [open])

  const toggle = (e: ReactMouseEvent) => {
    if (!open && ref.current) {
      const r = ref.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, left: r.left, right: window.innerWidth - r.right, anchorTop: r.top, flipped: false })
      // `detail === 0` means the click came from Enter or Space rather than a
      // pointer. Opened that way there is no cursor to read the panel with, so
      // focus goes to the first item; opened by mouse it stays put.
      if (e.detail === 0) setAutoFocus(true)
    }
    setOpen(o => !o)
  }
  const [autoFocus, setAutoFocus] = useState(false)
  useEffect(() => {
    if (!open || !autoFocus) return
    focusablesIn(menuRef.current)[0]?.focus()
    setAutoFocus(false)
  }, [open, autoFocus, pos])
  // The anchor alone decides nothing about whether the panel fits: a wide one opened
  // from a column near the right edge, or a tall one opened from the last row, hangs
  // off the window. So it is measured once it has a size and pulled back inside,
  // before paint, which is why this runs as a layout effect rather than an effect.
  useLayoutEffect(() => {
    if (!open || !pos || !menuRef.current) return
    const { offsetWidth: w, offsetHeight: h } = menuRef.current
    const wanted = align === 'right' ? window.innerWidth - pos.right - w : pos.left
    const left = Math.min(Math.max(GUTTER, wanted), Math.max(GUTTER, window.innerWidth - w - GUTTER))
    // Above the trigger when there is no room below and more room above, so a menu
    // on the last row opens upward instead of being cut off by the bottom edge.
    const below = window.innerHeight - pos.top - GUTTER
    const flipped = h > below && pos.anchorTop - GUTTER > below
    const top = flipped
      ? Math.max(GUTTER, pos.anchorTop - 4 - h)
      : Math.min(pos.top, Math.max(GUTTER, window.innerHeight - h - GUTTER))
    if (top === pos.top && left === pos.left && flipped === pos.flipped) return
    setPos(p => p && { ...p, top, left, right: window.innerWidth - left - w, flipped })
  }, [open, pos, align])
  return (
    <div ref={ref} className="relative inline-block">
      <span onClick={toggle}>{typeof trigger === 'function' ? trigger(open) : trigger}</span>
      {open && pos && createPortal(
        <div
          ref={menuRef}
          data-menu-panel=""
          className={cn(
            'fixed z-[200] min-w-[180px] max-h-[calc(100vh-16px)] overflow-y-auto bg-white border border-border rounded-md shadow-lg animate-popover-down motion-reduce:animate-none',
            !flush && 'py-1',
          )}
          style={{
            top: pos.top,
            ...(align === 'right' ? { right: pos.right } : { left: pos.left }),
            transformOrigin: `${pos.flipped ? 'bottom' : 'top'} ${align}`,
          }}
        >
          {children(close)}
        </div>,
        document.body,
      )}
    </div>
  )
}
export function MenuItem({ children, onClick, danger, warning, icon, active, disabled, disabledReason }: { children: ReactNode; onClick?: () => void; danger?: boolean; warning?: boolean; icon?: ReactNode; active?: boolean; disabled?: boolean; disabledReason?: string }) {
  const btn = (
    // aria-disabled rather than the native attribute: a disabled button swallows
    // pointer events in Chrome and Safari, which would kill the hover the reason
    // depends on. The click is suppressed here instead.
    <button
      onClick={disabled ? undefined : onClick}
      aria-disabled={disabled || undefined}
      className={cn('w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left whitespace-nowrap',
        disabled ? 'text-fg-subtle opacity-60 cursor-not-allowed' :
        // `active` marks the current selection (Partners-style blue highlight).
        active ? 'bg-accent text-primary font-medium' :
        // Partners "Mark as Inactive" treatment: amber-800 text on an amber-50 hover.
        warning ? 'text-[#92400E] hover:bg-warning-50' : danger ? 'text-danger-700 hover:bg-bg-subtle' : 'text-fg hover:bg-bg-subtle')}>
      {icon}
      {children}
    </button>
  )
  if (!disabled || !disabledReason) return btn
  return <Tooltip content={disabledReason} layer="menu" align="right" className="w-full">{btn}</Tooltip>
}
