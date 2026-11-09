import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode, type RefObject,
} from 'react'
import { X, ChevronDown, ChevronRight, Route, Search } from 'lucide-react'
import { WALKTHROUGH_CARDS } from './walkthroughCards'
import { cn } from '../../lib/utils'

/* ──────────────────────────────────────────────────────────────────
 * THE READING ROOM
 *
 * The wizard's one help surface: a panel that slides in over the modal and
 * holds the long answers, so the form itself can stay short. It floats over
 * the panel rather than docking beside it, because the form keeps its full
 * width and this is something you finish with and dismiss.
 *
 * ──── WHY ACCORDIONS ────
 * A reader who opens it usually has one question, and a wall of prose makes
 * them hunt for it. Closed, the panel is a list of headings, which is itself
 * the answer for most readers: they see their question named, open that one,
 * and leave. The first section is open on arrival so the panel never opens
 * on a stack of closed boxes, and every section can be closed, so a reader
 * who has finished can get back to the list of headings.
 *
 * ──── THE WAY BACK INTO THE TOUR ────
 * The walkthrough offers itself once a session and is never unprompted
 * again, so it needs one door that is always there. It is `tail`, at the
 * bottom of this panel rather than at the top: the drawer opens on a stack of
 * headings that answer most readers outright, and leading with a call to
 * action would ask them to commit to a tour before they have seen what is on
 * offer. Underneath, the row reads as the next step for whoever got to the
 * bottom and still wanted more.
 *
 * ──── POINTING AT ANOTHER HEADING ────
 * A guide long enough to need groups is long enough that one section has to
 * point at another. The pointer cannot be given a handler, because the copy
 * modules these panels read are static consts with nothing to close over, so
 * the panel publishes what it can do on a context and the link reads it back.
 *
 * ──── SEARCH ────
 * The guides grew into books, and a book needs a way to find the page. Design
 * review, 2026-10-02 - Eli: *"As these How It Works books have gotten longer, I
 * almost wish that there was some sort of search inside of it."* Typing keeps
 * the sections whose heading or text holds the words, opens all of them, and
 * marks every match in the yellow every table search uses. Read off the panel's
 * own text, because a section body is a node and not a string: every body is in
 * the page already, open or closed, so what the reader can read is what is
 * searched. The marks are CSS highlights over the text as it stands, so nothing
 * in the copy is rewrapped to draw them.
 *
 * ──── MOTION ────
 * Hand-rolled CSS throughout, like the rest of this folder. The drawer and
 * scrim ride `coa-sheet` / `coa-sheet-scrim` in `index.css`; a section body
 * opens on a `0fr → 1fr` grid row, which animates to the body's own height
 * without anything having to measure it first.
 * ────────────────────────────────────────────────────────────────── */

export interface ReadingRoomSection {
  title: string
  /* A node rather than a string: a section that has to show a worked example
     needs more than one block, and a string body would have to be one. */
  body: ReactNode
  /* Which part of the guide this heading belongs to, printed above the first
     section that carries it. Only a panel long enough to repeat a heading needs
     one: "Parent" and "Status" are asked of both kinds of account, and a flat
     list would name each of them twice with nothing to tell them apart. */
  group?: string
}

export interface ReadingRoomConfig {
  title: string
  /* One line under the title saying what the whole panel covers, for a subject
     too broad to be named by its heading alone. */
  subtitle?: string
  sections: ReadingRoomSection[]
}

interface ReadingRoomActions {
  openSection: (title: string) => void
  startWalkthrough?: () => void
}
const Actions = createContext<ReadingRoomActions | null>(null)

const LINK = 'text-primary font-semibold hover:underline underline-offset-2 outline-none text-left'

/* Another heading in the same panel, named mid-sentence: opens it and scrolls
   to it. A title that names no section does nothing, which is the right answer
   for a room that carries the copy but not the section being pointed at. */
export function SectionLink({ to, children }: { to: string; children: ReactNode }) {
  const actions = useContext(Actions)
  return (
    <button type="button" className={LINK} onClick={() => actions?.openSection(to)}>
      {children} <span aria-hidden>&rarr;</span>
    </button>
  )
}

/* The tour, named mid-sentence rather than as the standing row at the foot of
   the panel. Plain text where the panel was mounted without a tour to start, so
   the copy cannot offer a door that opens on nothing. */
export function WalkthroughLink({ children }: { children: ReactNode }) {
  const start = useContext(Actions)?.startWalkthrough
  if (!start) return <>{children}</>
  return (
    <button type="button" className={LINK} onClick={start}>
      {children} <span aria-hidden>&rarr;</span>
    </button>
  )
}

export function ReadingRoom({ open, onClose, config, tail, openAt, onStartWalkthrough }: {
  open: boolean
  onClose: () => void
  config: ReadingRoomConfig
  tail?: ReactNode
  /* The heading to arrive on, for a panel whose reader is already standing
     somewhere in the flow it explains. Anything else, including a title this
     config does not carry, opens the first section. */
  openAt?: string
  onStartWalkthrough?: () => void
}) {
  const scroller = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  /* Which sections hold the words, read off the rendered text after each change.
     Null while nothing is typed: every section shows, one open at a time. */
  const [hits, setHits] = useState<Set<number> | null>(null)
  useEffect(() => {
    if (!q || !scroller.current) { setHits(null); return }
    const found = new Set<number>()
    scroller.current.querySelectorAll<HTMLElement>('[data-section]').forEach((el, i) => {
      if ((el.textContent ?? '').toLowerCase().includes(q)) found.add(i)
    })
    setHits(found)
  }, [q, config])
  useSearchMarks(scroller, q, open)
  const indexOf = (title?: string) => {
    const i = config.sections.findIndex(s => s.title === title)
    return i < 0 ? 0 : i
  }

  /* One open at a time, and -1 for none. Re-seeded when the panel is given a
     different subject, so a reader who left section four open on one config
     does not arrive at section four of the next. */
  const [openIndex, setOpenIndex] = useState(() => indexOf(openAt))
  useEffect(() => { setOpenIndex(indexOf(openAt)) }, [config, openAt])
  // A new subject starts unsearched.
  useEffect(() => { setQuery('') }, [config])

  const openSection = useCallback((title: string) => {
    const i = config.sections.findIndex(s => s.title === title)
    if (i < 0) return
    setOpenIndex(i)
    /* Next frame, so the scroll lands on a card that is about to have a body
       rather than on the closed one that is still there this frame. */
    requestAnimationFrame(() => {
      scroller.current?.querySelectorAll('[data-section]')[i]
        ?.scrollIntoView({ block: 'start', behavior: 'smooth' })
    })
  }, [config])
  const actions = useMemo<ReadingRoomActions>(
    () => ({ openSection, startWalkthrough: onStartWalkthrough }),
    [openSection, onStartWalkthrough],
  )

  // The modal closes on Escape too. Capturing at the document means one press
  // closes the panel and the modal behind it keeps its own press for later.
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      onClose()
    }
    document.addEventListener('keydown', h, true)
    return () => document.removeEventListener('keydown', h, true)
  }, [open, onClose])

  if (!open) return null
  return (
    <>
      {/* The module's one backdrop, as the Customize insights panel draws it
          (`coa-scrim`). It used to be a white wash with a blur, which Mahad
          ruled out on 2026-10-08: *"the background becomes white and blurred
          which we dont want and is not part of our UI pattern."* */}
      <div
        className="absolute inset-0 z-40 coa-scrim coa-sheet-scrim"
        onClick={onClose}
      />
      <div
        className="absolute z-50 flex flex-col overflow-hidden coa-sheet bg-white border border-border shadow-xl"
        role="dialog"
        aria-label={config.title}
        style={{ top: 6, right: 6, bottom: 6, width: 548, maxWidth: 'calc(100% - 12px)', borderRadius: 16 }}
      >
        <div className="px-6 pt-5 pb-4 flex items-start justify-between gap-3 shrink-0 border-b border-border">
          <div className="min-w-0">
            {/* Named as the button that opens it (Mahad's header copy, 2026-10-08). */}
            <div className="text-2xs font-semibold uppercase tracking-[0.08em] text-primary">How it works</div>
            <h3 className="text-xl font-semibold text-fg mt-1 leading-tight">{config.title}</h3>
            {config.subtitle && <p className="text-13 text-fg-muted mt-1 leading-snug">{config.subtitle}</p>}
            <div className="relative mt-3">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-subtle pointer-events-none" />
              <input
                type="search"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search this guide"
                aria-label="Search this guide"
                className="w-full h-8 pl-8 pr-8 rounded-lg border border-border bg-white text-13 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 [&::-webkit-search-cancel-button]:hidden"
              />
              {query && (
                <button type="button" onClick={() => setQuery('')} aria-label="Clear search"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-md flex items-center justify-center text-fg-subtle hover:text-fg hover:bg-bg-subtle">
                  <X size={13} />
                </button>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close guide"
            className="shrink-0 w-[30px] h-[30px] rounded-lg border border-border bg-white text-fg-muted hover:text-fg hover:bg-bg-subtle flex items-center justify-center transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        <Actions.Provider value={actions}>
        <div ref={scroller} className="flex-1 overflow-auto scrollbar-thin p-6">
          {config.sections.map((s, i) => {
            /* Hidden rather than dropped while a search is on, so the next
               keystroke can still read its text. */
            const shown = !hits || hits.has(i)
            const shownBefore = hits ? config.sections.slice(0, i).filter((_, j) => hits.has(j)) : config.sections.slice(0, i)
            const newGroup = !!s.group && s.group !== shownBefore[shownBefore.length - 1]?.group
            return (
              <div key={s.title} data-section={s.title} hidden={!shown}>
                {newGroup && (
                  <div className={cn('text-2xs font-semibold uppercase tracking-[0.08em] text-fg-subtle px-[18px] pb-1.5', shownBefore.length > 0 && 'pt-3')}>
                    {s.group}
                  </div>
                )}
                <Section
                  section={s}
                  open={hits ? true : i === openIndex}
                  last={i === config.sections.length - 1}
                  onToggle={() => setOpenIndex(cur => (cur === i ? -1 : i))}
                />
              </div>
            )
          })}
          {hits && hits.size === 0 && (
            <div className="text-center py-10" data-guide-no-match>
              <p className="text-13 font-semibold text-fg">Nothing in this guide matches &ldquo;{query.trim()}&rdquo;</p>
              <p className="text-2xs text-fg-muted mt-1">Try a different word, or clear the search to see every section.</p>
            </div>
          )}
          {tail && !hits && <div className="mt-4">{tail}</div>}
        </div>
        </Actions.Provider>
      </div>
    </>
  )
}

/* Marks every match inside the panel, the way a table's search marks its cells.
   Drawn with the CSS Custom Highlight API: ranges over the text nodes as they
   stand, so the copy is not rewrapped in <mark>s. Where the browser has no such
   API the matching sections still show and open; only the yellow is missing. */
const SEARCH_HIGHLIGHT = 'guide-search'
function useSearchMarks(root: RefObject<HTMLElement>, q: string, open: boolean) {
  useEffect(() => {
    const registry = (globalThis as unknown as { CSS?: { highlights?: Map<string, unknown> } }).CSS?.highlights
    const HighlightCtor = (globalThis as unknown as { Highlight?: new (...r: Range[]) => unknown }).Highlight
    if (!registry || !HighlightCtor) return
    if (!q || !open || !root.current) { registry.delete(SEARCH_HIGHLIGHT); return }
    // After the sections open, so the ranges cover what is now showing.
    const t = window.setTimeout(() => {
      if (!root.current) return
      const ranges: Range[] = []
      const walker = document.createTreeWalker(root.current, NodeFilter.SHOW_TEXT)
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const text = (n.textContent ?? '').toLowerCase()
        for (let at = text.indexOf(q); at >= 0; at = text.indexOf(q, at + q.length)) {
          const r = document.createRange()
          r.setStart(n, at)
          r.setEnd(n, at + q.length)
          ranges.push(r)
        }
      }
      registry.set(SEARCH_HIGHLIGHT, new HighlightCtor(...ranges))
    }, 0)
    return () => { window.clearTimeout(t); registry.delete(SEARCH_HIGHLIGHT) }
  }, [root, q, open])
}

function Section({ section, open, last, onToggle }: {
  section: ReadingRoomSection
  open: boolean
  last: boolean
  onToggle: () => void
}) {
  return (
    /* The whole header is the button, padding and all, not only its text
       (Mahad, 2026-10-08). Hovering it lifts the card the way the replay row
       below lifts: the stronger border, and the muted fill while it is shut
       (an open one keeps white behind its body). See .coa-guide-card. */
    <div data-open={open} className={cn('coa-guide-card card transition-[background,border-color] duration-150', !last && 'mb-3')}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="coa-guide-head group w-full flex items-center gap-2 px-[18px] py-4 text-left outline-none rounded-xl"
      >
        {/* Title Case rather than the caps the other reference panels wear: a
            heading here is a question the reader is scanning for, and caps
            slow that scan down. */}
        <span className="flex-1 min-w-0 text-13 font-semibold text-fg-muted transition-colors duration-150 group-hover:text-fg group-focus-visible:text-fg">{section.title}</span>
        <ChevronDown
          className={cn('shrink-0 w-[15px] h-[15px] text-fg-subtle transition-[transform,color] duration-200 group-hover:text-fg-muted', open && 'rotate-180')}
        />
      </button>
      {/* `0fr → 1fr` on a single grid row: the body opens to its own height
          with nothing having to measure it, and closes the same way.

          The body sits 6px into the heading's bottom padding, and that pull is
          on the row, not the body. Inside the `overflow-hidden` box it lifted
          the text past the box's top edge and clipped the first line of every
          open section (Mahad, 2026-10-09: *"the top few lines are getting
          slightly cut off"*). Only while open, so a shut card keeps its full
          padding under the heading. */}
      <div
        className="grid transition-[grid-template-rows,opacity,margin] duration-[240ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
        style={{ gridTemplateRows: open ? '1fr' : '0fr', opacity: open ? 1 : 0, marginTop: open ? -6 : 0 }}
        aria-hidden={!open}
      >
        <div className="overflow-hidden">
          <div className="px-[18px] pb-4 text-13 text-slate-700 leading-[1.65]">{section.body}</div>
        </div>
      </div>
    </div>
  )
}

/* The door back into the walkthrough. Pressing it closes the panel first,
   because the panel covers most of the modal and every card after the first
   points at something behind it. */
export function WalkthroughReplayRow({ onStart, count = WALKTHROUGH_CARDS.length, title = 'Take the guided walkthrough', subtitle }: {
  onStart: () => void
  /* The row's wording. The Build from scratch guides name it "Take the
     walkthrough (5 short cards)" (2026-10-02); the import's keeps its own. */
  title?: string
  subtitle?: string
  /* How many cards the tour it opens actually has. There is more than one tour
     now, and a row that promised five cards before showing four would be the
     one detail a reader could catch us on. */
  count?: number
}) {
  return (
    <button
      type="button"
      onClick={onStart}
      className="coa-replay-row group w-full flex items-center gap-3 text-left outline-none rounded-xl px-3.5 py-3 border transition-[background,box-shadow,border-color] duration-150"
    >
      <span className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center border border-border bg-white">
        <Route className="w-4 h-4 text-primary" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-13 font-semibold text-fg">{title}</span>
        <span className="block text-2xs text-fg-muted mt-px">
          {subtitle ?? `${count} short cards, one thing on each.`}
        </span>
      </span>
      <ChevronRight className="shrink-0 w-4 h-4 text-fg-subtle transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-primary" />
    </button>
  )
}
