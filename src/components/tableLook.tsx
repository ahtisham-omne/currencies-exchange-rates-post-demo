/* ─────────────────────────────────────────────────────────────────────────────
   tableLook.tsx - the table controls every listing in this module shares.

   Ported from the financial reporting module's table-view-controls.tsx, to the
   spec in "Table Controls Density and Configure Visuals". Two controls stand
   together above a table: the density button, which now also carries Tree
   layout and Column widths, and the Columns button, whose panel now carries
   Configure Visuals. A table passes only what it can honestly offer, and each
   control shrinks to fit rather than showing a dead option - a flat register is
   not asked to choose between two ways of drawing a tree it does not have.

   The switches are LIVE. Each flip reaches the table at once, so there is
   nothing to save and nothing to discard, and the back arrow is the only way
   out of the view.

   Everything the switches actually DRAW lives in index.css under the
   `fr-report--*` classes. The names are the reporting module's, kept on
   purpose: a striped row, a grid line, a row number and a clipped cell are
   meant to be the same object in both modules, and renaming them here would
   have let the two drift the moment either was touched.
   ───────────────────────────────────────────────────────────────────────────── */
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode, type RefObject } from 'react'
import { ChevronLeft, ChevronRight, Info, Minus, Plus, Settings } from 'lucide-react'
import { Toggle, Tooltip } from './ui'
import { useRememberedState } from '../lib/rememberedState'

/* ── What a table's look is ────────────────────────────────────────────────── */

/** The six Configure Visuals switches. */
export interface VisualValues {
  crosshair: boolean
  zebra: boolean
  gridLines: boolean
  rowNumbers: boolean
  pinGroups: boolean
  truncate: boolean
}

export type Density = 'condensed' | 'comfort'
export type TreeStyle = 'lines' | 'arrows'
/** `custom` is what a hand-dragged column edge leaves behind: an honest state
 *  that matches none of the three cards, so none of them is lit. */
export type ColumnSizing = 'default' | 'fit' | 'equal' | 'custom'

export interface TableLook extends VisualValues {
  density: Density
  treeStyle: TreeStyle
  columnSizing: ColumnSizing
}

/** The opening state, and it is not negotiable per table: the crosshair on,
 *  every other switch off, Condensed, Tree lines, Default widths. A table that
 *  opens differently is wrong even if every control on it works. */
export const DEFAULT_LOOK: TableLook = {
  crosshair: true,
  zebra: false,
  gridLines: false,
  rowNumbers: false,
  pinGroups: false,
  truncate: false,
  density: 'condensed',
  treeStyle: 'lines',
  columnSizing: 'default',
}

/**
 * Holds a table's look for the session.
 *
 * Session state on purpose: which columns you keep is a decision about the
 * work and is persisted under the table's storageKey, but how the rows are
 * shaded is a decision about this sitting. It is also never read from storage
 * in a render or a useState initializer, so the first paint is the same on
 * every machine.
 */
export function useTableLook(initial?: Partial<TableLook>, rememberAs?: string) {
  /* Kept for the page's return when it names a key (rememberAs), so the look a
     reader set comes back with the columns they set beside it. */
  const [look, setLook] = useRememberedState<TableLook>(rememberAs, () => ({ ...DEFAULT_LOOK, ...initial }))
  const toggle = (k: keyof VisualValues) => setLook(v => ({ ...v, [k]: !v[k] }))
  const set = <K extends keyof TableLook>(k: K, v: TableLook[K]) => setLook(p => ({ ...p, [k]: v }))
  /* One class per switch that draws in CSS. Crosshair is not here - it is DOM
     work that runs while the pointer is over the table - and density, tree
     style and widths are read by the table itself. */
  const lookClass = useMemo(() => [
    look.zebra && 'fr-report--zebra',
    look.gridLines && 'fr-report--grid',
    look.rowNumbers && 'fr-report--rownum',
    look.pinGroups && 'fr-report--pingroups',
    look.truncate && 'fr-report--truncate',
  ].filter(Boolean).join(' '), [look.zebra, look.gridLines, look.rowNumbers, look.pinGroups, look.truncate])
  return { look, setLook, toggle, set, lookClass }
}

/* ── The toolbar pair's chrome (spec §1) ───────────────────────────────────── */

/** A toolbar button at rest: 36 tall, an 8px radius, one pixel of --border, and
 *  the same faint lift every raised control in the module carries. Its ink is
 *  the Insights button's beside it - dark text, its icon in the muted grey at 80%
 *  (`.fr-tool-btn > svg`, index.css). Mahad, 2026-10-01: *"the grey color on the
 *  icon and text is not right on these two buttons ... Please use the same colors
 *  as we have in the insights button."* It was --text-secondary for both. */
export const TOOL_BTN: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  height: 36,
  padding: '0 12px',
  borderRadius: 8,
  border: '1px solid hsl(var(--border))',
  backgroundColor: 'hsl(var(--card))',
  boxShadow: 'var(--elevation-xs)',
  fontSize: 13,
  fontWeight: 500,
  color: 'hsl(var(--foreground))',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

/** The same button while it is pressed or its panel is open: a 30% primary
 *  border over a 4% primary wash, the text left dark. The whole `border`
 *  shorthand, because the base sets one and React warns when a longhand has to
 *  be unset over a shorthand. */
export const TOOL_BTN_ACTIVE: CSSProperties = {
  border: '1px solid color-mix(in srgb, hsl(var(--primary)) 30%, transparent)',
  backgroundColor: 'color-mix(in srgb, hsl(var(--primary)) 4%, transparent)',
  color: 'hsl(var(--foreground))',
}

/** The gutter Row numbers opens: 16px in, 8px per tabular digit, 16px out, and
 *  never narrower than two digits (spec §8). It is a transparent left BORDER on
 *  the row's first cell, so whichever column leads the row has to carry that
 *  much extra width or its own content is squeezed into what is left. */
export const rowNumberGutter = (rows: number) => 32 + 8 * Math.max(2, String(Math.max(rows, 1)).length)

/** The count beside the Columns label: how many of the table's columns are
 *  showing, over how many it has. */
export const COUNT_BADGE: CSSProperties = {
  minWidth: 18,
  height: 20,
  padding: '0 6px',
  borderRadius: 9999,
  fontSize: 11,
  fontWeight: 600,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'var(--color-blue-50)',
  color: 'hsl(var(--primary))',
}

/* ── The density menu's extra blocks (spec §2) ─────────────────────────────── */

/** A tiny mock of a table, one per column-width mode: the option SHOWS its
 *  behaviour rather than asking for it to be imagined. Default draws the grid's
 *  own mixed widths, Fit hugs each column to what it holds, Equal splits the
 *  frame evenly. */
export function WidthThumb({ kind }: { kind: 'default' | 'fit' | 'equal' }) {
  const widths = kind === 'default' ? [44, 28, 28] : kind === 'fit' ? [26, 52, 22] : [33.4, 33.3, 33.3]
  return (
    <span
      className="flex"
      style={{ width: '100%', height: 52, borderRadius: 4, background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', overflow: 'hidden' }}
    >
      {widths.map((w, i) => (
        <span
          key={i}
          className="flex flex-col"
          style={{ width: `${w}%`, padding: '7px 6px', gap: 6, borderRight: i < widths.length - 1 ? '1px solid hsl(var(--border))' : 'none' }}
        >
          <span style={{ display: 'block', height: 5, borderRadius: 2, background: 'var(--color-slate-400)', width: '70%' }} />
          <span style={{ display: 'block', height: 4, borderRadius: 2, background: 'var(--color-slate-300)', width: kind === 'fit' ? '92%' : '55%' }} />
          <span style={{ display: 'block', height: 4, borderRadius: 2, background: 'var(--color-slate-300)', width: kind === 'fit' ? '80%' : '65%' }} />
        </span>
      ))}
    </span>
  )
}

/** A tiny mock of nested rows, one per tree style: the option shows what it
 *  looks like instead of asking to be imagined. */
export function NestingThumb({ kind }: { kind: 'arrows' | 'lines' }) {
  const bar = (w: number) => (
    <span style={{ display: 'inline-block', width: w, height: 4, borderRadius: 2, background: 'var(--color-slate-300)' }} />
  )
  const frame: CSSProperties = {
    width: '100%', height: 52, borderRadius: 4, background: 'hsl(var(--card))',
    border: '1px solid hsl(var(--border))', padding: '0 10px', gap: 7,
  }
  if (kind === 'arrows') {
    return (
      <span className="flex flex-col justify-center" style={frame}>
        <span className="flex items-center" style={{ gap: 5 }}>
          <ChevronRight size={9} style={{ color: 'var(--text-tertiary)', transform: 'rotate(90deg)' }} />
          {bar(36)}
        </span>
        <span className="flex items-center" style={{ gap: 5, paddingLeft: 13 }}>
          <ChevronRight size={9} style={{ color: 'var(--text-tertiary)' }} />
          {bar(26)}
        </span>
        <span className="flex items-center" style={{ gap: 5, paddingLeft: 13 }}>
          <ChevronRight size={9} style={{ color: 'var(--text-tertiary)' }} />
          {bar(31)}
        </span>
      </span>
    )
  }
  const disc = (open: boolean) => (
    <span
      className="inline-flex items-center justify-center shrink-0"
      style={{
        width: 11, height: 11, borderRadius: '50%',
        border: `1.5px solid ${open ? 'hsl(var(--primary))' : 'color-mix(in srgb, hsl(var(--primary)) 30%, var(--color-slate-50))'}`,
        background: open ? 'hsl(var(--primary))' : 'hsl(var(--card))',
        color: open ? 'hsl(var(--card))' : 'hsl(var(--primary))',
      }}
    >
      {open ? <Minus size={6} strokeWidth={3.5} /> : <Plus size={6} strokeWidth={3.5} />}
    </span>
  )
  const elbow = (
    <span
      aria-hidden
      className="shrink-0"
      style={{
        width: 8, height: 12, marginLeft: 5, marginTop: -8,
        borderLeft: '1px solid var(--color-slate-300)',
        borderBottom: '1px solid var(--color-slate-300)',
        borderBottomLeftRadius: 4,
      }}
    />
  )
  return (
    <span className="flex flex-col justify-center" style={frame}>
      <span className="flex items-center" style={{ gap: 5 }}>{disc(true)}{bar(34)}</span>
      <span className="flex items-end" style={{ gap: 5 }}>{elbow}{disc(false)}{bar(24)}</span>
      <span className="flex items-end" style={{ gap: 5 }}>{elbow}{bar(30)}</span>
    </span>
  )
}

/* Tree layout and Column widths are ways of DRAWING the same rows, which is
   what the density menu is already for, so they ride under it rather than
   opening a control of their own. A table passes only the blocks it can
   honestly offer, and the menu narrows to 230 when it is passed none. */
export type LookSection = {
  title: string
  value: string
  options: { key: string; label: string; thumb: ReactNode }[]
  onChange: (key: string) => void
}

export function lookSections(opts: {
  /** Offered only where rows nest: a flat register has no tree to style. */
  tree?: { value: TreeStyle; onChange: (v: TreeStyle) => void }
  widths?: { value: ColumnSizing; onChange: (v: 'default' | 'fit' | 'equal') => void }
}): LookSection[] {
  const out: LookSection[] = []
  if (opts.tree) {
    const tree = opts.tree
    out.push({
      title: 'Tree layout',
      value: tree.value,
      options: [
        { key: 'lines', label: 'Tree lines', thumb: <NestingThumb kind="lines" /> },
        { key: 'arrows', label: 'Arrows', thumb: <NestingThumb kind="arrows" /> },
      ],
      onChange: k => tree.onChange(k === 'arrows' ? 'arrows' : 'lines'),
    })
  }
  if (opts.widths) {
    const widths = opts.widths
    out.push({
      title: 'Column widths',
      value: widths.value,
      options: [
        { key: 'default', label: 'Default', thumb: <WidthThumb kind="default" /> },
        { key: 'fit', label: 'Fit', thumb: <WidthThumb kind="fit" /> },
        { key: 'equal', label: 'Equal', thumb: <WidthThumb kind="equal" /> },
      ],
      onChange: k => widths.onChange(k === 'fit' ? 'fit' : k === 'equal' ? 'equal' : 'default'),
    })
  }
  return out
}

/* ── Configure Visuals (spec §3 and §4) ────────────────────────────────────── */

/** The button that stands above Pinned inside the Columns panel. It wears the
 *  toolbar buttons' own chrome so it reads as the same kind of thing, and it
 *  opens a view over the column list rather than a second drawer. */
export function ConfigureVisualButton({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="fr-tool-btn inline-flex items-center justify-center w-full"
      data-active={open}
      aria-expanded={open}
      style={{
        height: 36, padding: '0 12px', gap: 8, borderRadius: 8,
        border: open ? TOOL_BTN_ACTIVE.border : '1px solid hsl(var(--border))',
        backgroundColor: open ? TOOL_BTN_ACTIVE.backgroundColor : 'hsl(var(--card))',
        boxShadow: 'var(--elevation-xs)',
        cursor: 'pointer', fontSize: 13, fontWeight: 500,
        color: open ? TOOL_BTN_ACTIVE.color : 'var(--text-secondary)',
        whiteSpace: 'nowrap',
      }}
    >
      <Settings style={{ width: 18, height: 18 }} />
      Configure Visuals
    </button>
  )
}

/** The ⓘ beside a switch whose name cannot carry its own meaning. Most of these
 *  switches say what they do; three of them cannot. */
function LookInfo({ text }: { text: string }) {
  return (
    <Tooltip
      rich
      align="left"
      className="ml-[3px] align-middle"
      content={<span style={{ display: 'block', width: 264, padding: '10px 12px', fontSize: 12, lineHeight: 1.55, color: 'var(--text-secondary)' }}>{text}</span>}
    >
      <span style={{ display: 'inline-flex', color: 'var(--text-tertiary)', cursor: 'help' }} aria-label={text}>
        <Info size={12} />
      </span>
    </Tooltip>
  )
}

/** Label on the left, switch on the right - the shape every on/off in this
 *  panel takes. */
export function SwitchRow({ label, on, onToggle, info }: { label: string; on: boolean; onToggle: () => void; info?: string }) {
  return (
    <div className="flex items-center justify-between" style={{ gap: 12 }}>
      <span style={{ fontSize: 14, color: 'hsl(var(--foreground))' }}>
        {label}
        {info && <LookInfo text={info} />}
      </span>
      <Toggle checked={on} onChange={onToggle} />
    </div>
  )
}

/** What each table can offer. A switch that would draw nothing on this table is
 *  left out rather than shown dead: Pin group headings needs groups, Row
 *  numbers needs rows worth counting. */
export interface VisualOffers {
  pinGroups?: boolean
}

export function VisualConfigView({ values, offers, onToggle, onBack }: {
  values: VisualValues
  offers: VisualOffers
  onToggle: (k: keyof VisualValues) => void
  onBack: () => void
}) {
  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center" style={{ padding: '12px 14px 4px', gap: 8 }}>
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to columns"
          className="inline-flex items-center justify-center cursor-pointer shrink-0"
          style={{
            width: 30, height: 30, borderRadius: 8, border: '1px solid hsl(var(--border))',
            background: 'hsl(var(--card))', color: 'var(--text-secondary)',
            boxShadow: 'var(--elevation-xs)', transition: 'background 150ms ease',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'hsl(210, 100%, 96%)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'hsl(var(--card))' }}
        >
          <ChevronLeft size={15} />
        </button>
        {/* The panel header's own size and ink, not the list's tracked caption:
            this is the view's title, not a section label. */}
        <span style={{ fontSize: 13, fontWeight: 600, color: 'hsl(var(--foreground))' }}>Configure Visuals</span>
      </div>
      <div className="flex flex-col" style={{ padding: '14px 14px 12px', gap: 12 }}>
        <SwitchRow label="Crosshair on hover" on={values.crosshair} onToggle={() => onToggle('crosshair')} info="Hovering a figure shades its row and column, so you can see exactly which line and which column it belongs to." />
        <SwitchRow label="Striped rows" on={values.zebra} onToggle={() => onToggle('zebra')} />
        <SwitchRow label="Lines between columns" on={values.gridLines} onToggle={() => onToggle('gridLines')} />
        <SwitchRow label="Row numbers" on={values.rowNumbers} onToggle={() => onToggle('rowNumbers')} />
        <SwitchRow label="Truncate long text" on={values.truncate} onToggle={() => onToggle('truncate')} info="Cuts text off at the column edge with three dots instead of wrapping it. Drag a column edge to set how much shows." />
        {offers.pinGroups && (
          <SwitchRow label="Pin group headings" on={values.pinGroups} onToggle={() => onToggle('pinGroups')} info="Keeps a group's heading under the column headings while its own rows scroll past." />
        )}
      </div>
      {/* No footer: the switches are live, so there is nothing to save and
          nothing to discard, and the arrow above is the way back. */}
    </div>
  )
}

/* ── The crosshair (spec §7 and §8) ────────────────────────────────────────── */

/**
 * Hovering a figure shades its whole row and its whole column, so one cell can
 * be traced across a wide grid. Hover-transient: it never touches the view,
 * never exports, and puts back whatever the cell wore before it passed.
 *
 * Plain DOM work rather than CSS, because a column has no element: shading one
 * means touching the nth cell of every row.
 */
export function useCrosshair(rootRef: RefObject<HTMLElement | null>, on: boolean) {
  useEffect(() => {
    const rootEl = rootRef.current
    if (!rootEl || !on) return
    const clear = () => {
      rootEl.querySelectorAll<HTMLElement>('[data-xh]').forEach(el => {
        const prev = el.getAttribute('data-xh-prev') ?? ''
        const prevShorthand = el.getAttribute('data-xh-prev-bg') ?? ''
        if (prev) el.style.setProperty('background-color', prev)
        else {
          el.style.removeProperty('background-color')
          // Put the shorthand back AFTER the longhand is gone, or removing the
          // longhand takes the restored declaration with it.
          if (prevShorthand) el.style.setProperty('background', prevShorthand)
        }
        el.removeAttribute('data-xh')
        el.removeAttribute('data-xh-prev')
        el.removeAttribute('data-xh-prev-bg')
      })
    }
    const shade = (el: HTMLElement, strong: boolean) => {
      if (!el.hasAttribute('data-xh')) {
        /* A cell can wear its fill as the `background` SHORTHAND rather than the
           longhand, and a frozen cell does - written with a var() inside it. A
           shorthand holding a var() is a pending substitution in the CSSOM:
           `background-color` reads back empty, so there is nothing to record,
           and removing it on the way out throws the whole shorthand away. The
           cell then loses its opaque fill for good and the columns scrolling
           under it show straight through. Record whichever form it wore. */
        const own = el.style.getPropertyValue('background-color')
        if (own) el.setAttribute('data-xh-prev', own)
        else {
          const shorthand = el.style.getPropertyValue('background')
          if (shorthand) el.setAttribute('data-xh-prev-bg', shorthand)
        }
      }
      /* A slate carries the band and the red is only a whisper; any more of it
         and the pair reads as pink rather than as a shaded cross. !important so
         it covers a stripe, a hover and a selected row alike - the crosshair
         overlays them while it passes and hands them back after. */
      el.style.setProperty(
        'background-color',
        strong
          ? 'color-mix(in srgb, var(--color-red-400) 5%, color-mix(in srgb, var(--color-slate-200) 55%, var(--color-slate-100)))'
          : 'color-mix(in srgb, var(--color-red-400) 3%, color-mix(in srgb, var(--color-slate-100) 55%, var(--color-slate-50)))',
        'important',
      )
      el.setAttribute('data-xh', '1')
    }
    const onOver = (e: Event) => {
      const td = (e.target as HTMLElement).closest('td') as HTMLElement | null
      if (!td || !rootEl.contains(td) || td.closest('thead')) return
      const tr = td.closest('tr')
      const table = td.closest('table')
      if (!tr || !table) return
      clear()
      /* A full-width row's single cell IS the first column, so hovering it pins
         column 0; hovering any other row pins its own column. */
      const isFullWidth = tr.children.length <= 1
      const ci = isFullWidth ? 0 : Array.from(tr.children).indexOf(td)
      Array.from(tr.children).forEach(c => shade(c as HTMLElement, false))
      table.querySelectorAll('tbody tr').forEach(r => {
        if (r.children.length <= 1) {
          if (ci === 0) shade(r.children[0] as HTMLElement, false)
          return
        }
        const c = r.children[ci] as HTMLElement | undefined
        if (c) shade(c, false)
      })
      // The band runs to the top: the column's own heading is part of it.
      const th = table.querySelectorAll('thead th')[ci] as HTMLElement | undefined
      if (th) shade(th, false)
      shade(td, true)
    }
    rootEl.addEventListener('mouseover', onOver)
    rootEl.addEventListener('mouseleave', clear)
    return () => {
      clear()
      rootEl.removeEventListener('mouseover', onOver)
      rootEl.removeEventListener('mouseleave', clear)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on])
}
