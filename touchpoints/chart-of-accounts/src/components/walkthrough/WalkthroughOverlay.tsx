import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, ChevronLeft, ChevronRight, Check } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { WalkthroughCard, WalkthroughSide } from './walkthroughCards'

/* ──────────────────────────────────────────────────────────────────
 * THE WALKTHROUGH OVERLAY
 *
 * A travelling spotlight and one card, over the import wizard. The five cards
 * and the argument for them are in `walkthroughCards.tsx`; this file is the
 * machine that finds a control, cuts a hole over it, and puts a card beside it
 * without ever covering the thing it is pointing at.
 *
 * ──── THE WIZARD IS INERT WHILE THE TOUR RUNS ────
 * A transparent full-viewport layer sits under the card and over the panel,
 * swallowing every pointer event. The wizard looks exactly as it does normally:
 * nothing is disabled, nothing greys out, no attribute is set on any control. It
 * simply cannot be operated until the tour is closed.
 *
 * A live form under a travelling spotlight produces bugs rather than freedom.
 * The spotlit control answers the pointer, so a control the card is DESCRIBING
 * starts behaving as one the reader is USING, mid explanation, and some of those
 * behaviours move the very rect the spotlight is tracking. Two things fall out
 * of the layer for free: hover states no longer fire anywhere under it, and the
 * layer carries `cursor: default`, so a button underneath does not offer a
 * pointer cursor for a click that will not land.
 *
 * The layer eats the click and does NOT close the tour, deliberately: a misclick
 * on the dim costs nothing. The three ways out are Skip Tour, Got It and Escape.
 *
 * ──── AND IT NAVIGATES THE WIZARD ────
 * Every card carries the step its control lives on, and moves the wizard there,
 * so the card about the dimensions table is read with the dimensions table
 * behind it. Two consequences: the anchor does not exist for the length of the
 * step change, which is what `ANCHOR_GRACE_MS` is for, and the wizard is
 * responsible for putting the reader back where they were on close.
 *
 * ──── THE HOLE IS A BOX SHADOW ────
 * One absolutely positioned div at the target's rect with a 9999px shadow
 * spread. That is the whole dimming layer: the "hole" is the div itself, which
 * paints nothing. The cutout takes a border radius, so it sits on rounded cards
 * rather than clipping their corners, and the spotlight TRAVELS between cards,
 * because moving one div's rect is something a CSS transition already knows how
 * to do. With no anchor the same div collapses to a zero sized point at the
 * centre of the viewport, which leaves the shadow covering everything and the
 * card centred on a plain dim.
 *
 * ──── MEASURING, AND WHY IT IS A LOOP ────
 * A rect here is a moving target. The modal springs its own height on every step
 * change, expands to full screen when the review grid arrives, and re-lays out on
 * a resize. Listening for all of that is several subscriptions plus a
 * ResizeObserver and it still misses the panel's own curve. So the overlay polls
 * one `getBoundingClientRect` per frame while it is open and commits to state
 * only when the rounded rect actually changes. One rect per frame on one element
 * is cheap; a spotlight sitting 40px off a control is not.
 *
 * ──── NO ANIMATION LIBRARY ────
 * The reference this is ported from drives its springs with `motion`. Nothing
 * here does: every move is a CSS transition or a keyframe, because this module
 * carries ten dependencies and a spotlight is not worth an eleventh. The two
 * curves below are the mapping. A `motion` spring of duration 0.5 with no bounce
 * is a critically damped travel that arrives quickly and settles late, which is
 * what `GLIDE` is; everything the reference gave a plain ease to is `EASE_OUT`.
 * ────────────────────────────────────────────────────────────────── */

const still = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true

/* Dark enough that a white card and a lit control both read as lifted out of it,
   light enough that the form stays legible underneath. */
const SCRIM = 'rgba(15, 23, 42, 0.50)'

/* Room between the lit control's edge and the hole's, so the ring reads as a
   frame around the control rather than as a border on it. */
const HALO = 6
/* The card's gap from the hole, and from the viewport's edge. */
const GUTTER = 14
const EDGE = 16

/* ──────── How long to wait for an anchor that is on its way ────────
   Every card navigates, and the wizard's body swaps while the panel springs its
   own height, so for a few hundred milliseconds the control this card is about
   is not in the document at all.

   Without a grace period the loop would measure null, collapse the spotlight to
   a point at the centre of the viewport, centre the card on a full dim, and then
   fly both back out to the control: a flash of a completely different layout in
   the middle of one step change. So while a card cannot find its anchor, the
   previous measurement is left standing. The spotlight holds on the outgoing
   control for the length of the change and then travels, which reads as the
   panel changing underneath a light that follows.

   Past the deadline it does commit null, because an anchor that is genuinely
   absent has to be allowed to fall back to a centred card. */
const ANCHOR_GRACE_MS = 700

/* The transparent layer that makes the wizard inert. Above `FormModal` (70) and
   below the dim (190), so the card and its own controls stay live. Nothing in
   the module sits between: the menu portal is at 200, and no menu can be open
   while the wizard cannot be operated. */
const INERT_Z = 189

const CARD_W = 400

/* The travel curve. See the note on animation at the top of the file. */
const GLIDE_MS = 500
const GLIDE = 'cubic-bezier(0.16, 1, 0.3, 1)'

/* How long the dim and the card take to go, and therefore how long the wizard
   waits to be handed back. Kept in one place because the unmount has to outlast
   the fade: cut it short and the dim pops off screen half faded. */
const LEAVE_MS = 220

interface Rect { x: number; y: number; width: number; height: number }

type Side = WalkthroughSide | 'center'

/* ──────── One key, and everything wearing it ────────
   Most anchors are a single control, but a column is not: it is a heading and a
   cell in every row on the page, and no one element in the DOM is the column.
   So a key may be worn by every piece of the thing being pointed at, and the
   spotlight is their union.

   A rect that is present but has no box is NOT part of it. Every one of these
   keys is on something that is unmounted on another step, and a 0x0 rect at the
   origin would drag the spotlight into the top left corner.

   The union is clipped to the nearest enclosing `[data-walkthrough-clip]`,
   because a row scrolled below the fold still reports a rect: unioned raw, a
   column would light up a band running off the bottom of the panel. */
function anchorRect(key: string | null): Rect | null {
  if (key === null) return null
  const els = Array.from(document.querySelectorAll<HTMLElement>(`[data-walkthrough="${key}"]`))
  let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity
  for (const el of els) {
    const box = el.getBoundingClientRect()
    if (box.width < 8 || box.height < 8) continue
    l = Math.min(l, box.left); t = Math.min(t, box.top)
    r = Math.max(r, box.right); b = Math.max(b, box.bottom)
  }
  if (l === Infinity) return null

  const clip = els[0].closest<HTMLElement>('[data-walkthrough-clip]')
  if (clip) {
    const c = clip.getBoundingClientRect()
    l = Math.max(l, c.left); t = Math.max(t, c.top)
    r = Math.min(r, c.right); b = Math.min(b, c.bottom)
  }
  /* And to whatever actually clips it on screen: every ancestor that hides or
     scrolls its overflow - a step's scrolling panel, the modal around it - and
     the window. Only the part a reader can see is lit. Without it, a target
     taller than its scrolling panel lit the whole of itself, and in a modal
     outside full view the spotlight ran past the modal's bottom edge onto the
     page behind (Mahad, 2026-10-07). */
  for (let el = els[0].parentElement; el && el !== document.body; el = el.parentElement) {
    const st = getComputedStyle(el)
    if (st.overflowX === 'visible' && st.overflowY === 'visible') continue
    const c = el.getBoundingClientRect()
    if (st.overflowX !== 'visible') { l = Math.max(l, c.left); r = Math.min(r, c.right) }
    if (st.overflowY !== 'visible') { t = Math.max(t, c.top); b = Math.min(b, c.bottom) }
  }
  l = Math.max(l, 0); t = Math.max(t, 0)
  r = Math.min(r, window.innerWidth); b = Math.min(b, window.innerHeight)
  if (r - l < 8 || b - t < 8) return null
  return { x: l, y: t, width: r - l, height: b - t }
}

/* Only ever used to scroll the target into view, so the first piece of it will
   do: bringing a column's heading into view brings the column with it. */
const anchorEl = (key: string | null) =>
  key === null ? null : document.querySelector<HTMLElement>(`[data-walkthrough="${key}"]`)

const rectKey = (r: Rect | null) =>
  r ? `${Math.round(r.x)}:${Math.round(r.y)}:${Math.round(r.width)}:${Math.round(r.height)}` : ''

/* ──────── Placement ────────
   Below, then above, then beside, then centred, with one exception that earns its
   own branch: a TALL anchor. The review surface is the full height of the panel,
   so "below" is off the bottom of the window and "above" is off the top; the only
   honest answer for a column is a card beside it. The test is against the
   viewport rather than a pixel count, because full view changes what tall means. */
function place(
  rect: Rect | null,
  cardH: number,
  vw: number,
  vh: number,
  /* The side a card ASKS for, tried ahead of the fallback order and dropped if it
     does not fit. */
  prefer?: WalkthroughSide,
): { left: number; top: number; side: Side } {
  if (!rect) {
    return {
      left: Math.round((vw - CARD_W) / 2),
      top: Math.round(Math.max(EDGE, (vh - cardH) / 2)),
      side: 'center',
    }
  }

  const clampX = (x: number) => Math.min(Math.max(x, EDGE), Math.max(EDGE, vw - CARD_W - EDGE))
  const clampY = (y: number) => Math.min(Math.max(y, EDGE), Math.max(EDGE, vh - cardH - EDGE))

  const below = vh - (rect.y + rect.height) - HALO - GUTTER
  const above = rect.y - HALO - GUTTER
  const right = vw - (rect.x + rect.width) - HALO - GUTTER
  const left = rect.x - HALO - GUTTER

  const centeredX = clampX(rect.x + rect.width / 2 - CARD_W / 2)
  const centeredY = clampY(rect.y + rect.height / 2 - cardH / 2)

  const tall = rect.height > vh * 0.45

  /* The fallback order picks the first side the card FITS on, which makes the
     side a function of the card's height, and so of how many sentences the copy
     happens to run to. `prefer` pins the side the card was designed around; it is
     still only a request, and it is dropped if it genuinely does not fit. */
  const base: Side[] = tall ? ['left', 'right', 'below', 'above'] : ['below', 'above', 'right', 'left']
  const order: Side[] = prefer ? [prefer, ...base.filter(sd => sd !== prefer)] : base

  for (const side of order) {
    if (side === 'below' && below >= cardH + EDGE) return { left: centeredX, top: rect.y + rect.height + HALO + GUTTER, side }
    if (side === 'above' && above >= cardH + EDGE) return { left: centeredX, top: rect.y - HALO - GUTTER - cardH, side }
    if (side === 'right' && right >= CARD_W + EDGE) return { left: rect.x + rect.width + HALO + GUTTER, top: centeredY, side }
    if (side === 'left' && left >= CARD_W + EDGE) return { left: rect.x - HALO - GUTTER - CARD_W, top: centeredY, side }
  }

  /* Nothing fits beside it, which means the anchor is most of the screen - the
     review grid in full view, every time. The card goes to the bottom of the
     viewport rather than over the middle of the lit control: covering the thing
     being pointed at is the one failure this whole file exists to avoid. */
  return { left: clampX(centeredX), top: Math.max(EDGE, vh - cardH - EDGE), side: 'center' }
}

/* ──────── The lit frame ────────
   Three shadows, always three, because the layer transitions between the lit and
   the unlit state and a transition between two shadow lists of different length
   is a jump cut. The ring and its glow fade to zero alpha and zero spread while
   the scrim behind them stays exactly where it is. */
const spotShadow = (lit: boolean) => [
  `0 0 0 ${lit ? 1.5 : 0}px rgba(10, 124, 255, ${lit ? 0.85 : 0})`,
  `0 0 0 ${lit ? 6 : 0}px rgba(10, 124, 255, ${lit ? 0.16 : 0})`,
  `0 0 0 9999px ${SCRIM}`,
].join(', ')

/* The two keyframes the card needs. The ripple plays once when the spotlight
   lands and the body fades up when it swaps; both are keyed on the card, so
   React remounting the element is what replays them. Nothing loops. */
function injectOverlayStyles() {
  if (typeof document === 'undefined') return
  if (document.getElementById('__coa-walkthrough-styles')) return
  const style = document.createElement('style')
  style.id = '__coa-walkthrough-styles'
  style.textContent = `
@keyframes coaTourPing {
  from { opacity: .75; transform: scale(1); }
  to   { opacity: 0;   transform: scale(1.05); }
}
@keyframes coaTourBody {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: none; }
}`
  document.head.appendChild(style)
}

export function WalkthroughOverlay<S extends string>({ cards, label, welcome, currentStep, onGoToStep, onDemo, onClose, skipLabel = 'Skip Tour' }: {
  /* The tour to run. Passed in rather than imported, because there is more than
     one wizard worth touring and everything below this line is about pointing at
     a control, not about which controls exist. */
  cards: WalkthroughCard<S>[]
  /* Names the tour to a screen reader, who has no spotlight to go on. */
  label: string
  /* The door the tour opens on. A render prop rather than a card, for the reason
     given at `intro` below, and per tour because the slide's whole job is to
     draw the one idea the wizard behind it is about. */
  welcome: (props: { onStart: () => void; onSkip: () => void }) => ReactNode
  /* Where the wizard is standing, so a card only navigates when it has to. */
  currentStep: S
  /* Moves the wizard to the step a card is about. The footer's own gates are
     deliberately bypassed: the tour is reading the form, not filling it in. */
  onGoToStep: (step: S) => void
  /* The demo surface the ACTIVE card wants mounted inside the wizard, or null,
     for a card whose subject would otherwise be an empty step. The overlay only
     announces it; the step that can render it decides how. */
  onDemo: (demo: string | null) => void
  onClose: () => void
  /* The way out on every card. The Build from scratch tours say "Skip tour"
     (2026-10-02); the import's keeps its own. */
  skipLabel?: string
}) {
  injectOverlayStyles()

  const [index, setIndex] = useState(0)
  /* ──────── THE TOUR OPENS ON A DOOR, NOT ON A CARD ────────
     `intro` is the welcome slide, and it is a PHASE rather than one more entry in
     `cards` because it is a different object: no anchor, no beak, no
     dots, its own scrim, and a hero animation instead of a body. Modelling it as
     a card would have meant every branch in this file asking "unless it is card
     zero". One way in and no way back: Previous is disabled on card one rather
     than returning here. */
  const [intro, setIntro] = useState(true)

  /* ──────── ONE FRAME, COMMITTED ATOMICALLY ────────
     The anchor's rect and the card's own height both feed `place()`, and
     committing them separately is what makes a card hunt its position: the height
     of the NEW card lands two frames before the rect of the NEW anchor, so the
     card sets off toward a target that is nobody's and is re-aimed mid flight.
     Both live in one object and are committed together, only once the whole
     measurement has agreed with itself for two consecutive frames. */
  const [frame, setFrame] = useState<{ rect: Rect | null; cardH: number; forCard: string }>({
    rect: null, cardH: 196, forCard: '',
  })
  const rect = frame.rect
  const cardH = frame.cardH

  const [viewport, setViewport] = useState(() => ({
    vw: typeof window === 'undefined' ? 1440 : window.innerWidth,
    vh: typeof window === 'undefined' ? 900 : window.innerHeight,
  }))

  /* The inner stack, at its natural height. See the measurement note below for
     why the outer card is the wrong thing to measure. */
  const contentRef = useRef<HTMLDivElement | null>(null)
  /* Last frame's measurement key, so a frame is only committed once two
     consecutive frames agree on it. */
  const pendingKey = useRef('')
  /* When the current card's anchor stops being allowed to be missing. */
  const anchorDeadline = useRef(0)
  /* Which card the loop is allowed to commit for. Written during RENDER, so it is
     already the new card by the time the outgoing effect's last frames run. */
  const activeCardId = useRef('')

  const card = cards[index]
  activeCardId.current = card.id
  const total = cards.length
  const isFirst = index === 0
  const isLast = index === total - 1
  const reduced = still()

  /* ──────── LEAVING IS A FRAME, NOT A CUT ────────
     A full-viewport dim vanishing between two frames reads as a crash. The three
     ways out all set this instead: the dim and the card fade, and the wizard is
     handed back once they have. Latched, so a second Escape during the fade
     cannot start a second timer.

     Not from the welcome slide, which has no dim of its own to take down and
     nothing behind it to reveal - leaving from there is the reader saying no
     before anything started, and it should feel that immediate. */
  const [leaving, setLeaving] = useState(false)
  const leavingRef = useRef(false)
  const dismiss = useCallback(() => {
    if (leavingRef.current) return
    leavingRef.current = true
    if (intro || still()) { onClose(); return }
    setLeaving(true)
    window.setTimeout(onClose, LEAVE_MS + 20)
  }, [onClose, intro])

  const next = useCallback(() => setIndex(i => (i >= total - 1 ? i : i + 1)), [total])
  /* ──── The welcome slide is a DOOR, not card zero ────
     Previous is disabled on the first card rather than walking back into it. The
     slide is how the tour is entered, and a Previous that re-opens it makes it a
     step in the sequence, which then wants a place in the dots, a Next of its
     own, and a reader wondering whether they missed something. */
  const back = useCallback(() => setIndex(i => Math.max(0, i - 1)), [])

  /* ──── The card takes the wizard to its own step ────
     Keyed on the CARD rather than on the index, so paging back and forth does not
     re-fire a navigation that already happened.

     The grace deadline is armed only when something is actually on its way: this
     card navigating, or a demo having to mount. Arming it on every card meant a
     card whose anchor is genuinely absent held the PREVIOUS card's spotlight for
     the full 700ms before collapsing, so the reader saw a new card pointing at
     the old card's control and then the light going out.

     A card with no anchor at all never arms it. It is not waiting for anything:
     `anchor: null` is the card saying it points at nothing on purpose, so the
     previous spotlight has to go out on the same frame the card arrives. */
  useEffect(() => {
    const navigating = card.step !== currentStep
    const mountingDemo = card.demo !== undefined
    anchorDeadline.current = card.anchor !== null && (navigating || mountingDemo)
      ? (typeof performance === 'undefined' ? 0 : performance.now()) + ANCHOR_GRACE_MS
      : 0
    onDemo(card.demo ?? null)
    if (navigating) onGoToStep(card.step)
    /* `currentStep` is deliberately NOT a dependency: it changes as a RESULT of
       this effect, and depending on it would re-run the effect on the change it
       just caused. The card is the trigger. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.id, onGoToStep, onDemo])

  /* Leaving the tour takes its demo with it. Without this, closing on the labels
     card would leave the mock table standing in the step. */
  useEffect(() => () => onDemo(null), [onDemo])

  /* ──── The one measurement loop ────
     Rect, card height and viewport together, since placement reads all three and
     a resize moves all three. */
  useEffect(() => {
    let raf = 0
    /* NOT a key `rectKey` can return. An unanchored card measures null, and if the
       loop starts out believing it has already committed null it never commits
       anything, so the previous card's spotlight stays lit around a control this
       card is not talking about. */
    let seen = ' unmeasured'
    const myCardId = card.id
    const tick = () => {
      /* ──── A DYING LOOP COMMITS NOTHING ────
         React flushes passive effects asynchronously, so the OUTGOING card's loop
         gets one or two more frames after the index has changed. Those frames are
         poison: this closure measures the PREVIOUS card's anchor, which is still
         mounted, while `contentRef` already holds the NEW card's body. Committing
         that pairs an old rect with a new height, which is precisely the split
         frame the atomic commit exists to prevent, arriving through the back
         door. */
      if (activeCardId.current !== myCardId) { raf = requestAnimationFrame(tick); return }

      const measured = anchorRect(card.anchor)

      /* ──── An anchor that is on its way is not a missing anchor ────
         Skipping the commit, rather than committing the previous rect again, is
         what leaves the last measurement standing: the spotlight and the card
         both hold where they are while the step underneath changes, and then make
         one move. `pendingKey` is deliberately not updated while waiting, so the
         two-frame agreement starts fresh from the first frame that has something
         real to measure. */
      const waiting = measured === null &&
        (typeof performance === 'undefined' ? 0 : performance.now()) < anchorDeadline.current

      setViewport(v => (v.vw === window.innerWidth && v.vh === window.innerHeight
        ? v
        : { vw: window.innerWidth, vh: window.innerHeight }))

      if (waiting) { raf = requestAnimationFrame(tick); return }

      /* ──── MEASURE THE CONTENT, NOT THE CARD ────
         The outer card's height is itself being transitioned. Sampling it every
         frame and feeding it to `place()` is a feedback loop: sixty new targets a
         second, so the card visibly hunts its way to each step instead of
         travelling to it. `contentRef` wraps the inner stack at its NATURAL
         height, so this reads the target rather than the in-flight value. */
      const h = contentRef.current?.offsetHeight

      /* ──── COMMIT ONLY A SETTLED FRAME ────
         Requiring two consecutive identical measurements throws away the
         intermediate ones, and a freshly mounted step's anchor moves once as the
         panel finishes springing its height. Committed early, that is a target
         the card sets off toward and then has to correct. The cost of waiting is
         one frame on numbers that only seed a transition. */
      const key = `${rectKey(measured)}|${h ?? 0}`
      if (key === pendingKey.current && key !== seen && h) {
        seen = key
        setFrame(cur => (
          cur.forCard === myCardId && rectKey(cur.rect) === rectKey(measured) && Math.abs(cur.cardH - h) <= 1
            ? cur
            : { rect: measured, cardH: h, forCard: myCardId }
        ))
      }
      pendingKey.current = key
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
    /* Keyed on the CARD, not just the anchor: two cards sharing one anchor would
       otherwise keep the first card's loop, and the guard above would then
       silence it forever. */
  }, [card.id, card.anchor])

  /* Bring the anchor into view once per card. `block: 'nearest'` so a control
     already on screen is not scrolled at all, which matters because most of these
     are: scrolling a form that did not need scrolling reads as the page jumping
     under the reader.

     Retried until it turns up rather than tried once, for the same reason the
     measurement loop has a grace period: a card that navigates or mounts a demo
     is asking for something the wizard has not rendered yet. The dimension
     columns are the case that needs it - they arrive a frame late and sit off the
     right edge of the grid, so a single miss would leave the spotlight tracking a
     column nobody can see. */
  useEffect(() => {
    if (card.anchor === null) return
    let raf = 0
    const now = () => (typeof performance === 'undefined' ? 0 : performance.now())
    const deadline = now() + ANCHOR_GRACE_MS
    const bring = () => {
      const el = anchorEl(card.anchor)
      if (el) {
        el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: still() ? 'auto' : 'smooth' })
        return
      }
      if (now() < deadline) raf = requestAnimationFrame(bring)
    }
    bring()
    return () => cancelAnimationFrame(raf)
  }, [card.anchor])

  /* ──── Keyboard ────
     Escape is captured and stopped here, so one press closes the walkthrough and
     not the wizard behind it: `FormModal` listens for Escape on `document` in the
     bubble phase, and this runs first. The arrows page the cards, which is the
     only reason a keyboard reader would want them here. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        e.preventDefault()
        dismiss()
        return
      }
      /* Never while somebody is typing in the form underneath: the arrows are the
         caret's before they are ours. */
      const target = e.target as HTMLElement | null
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable === true) return
      /* The welcome slide has two buttons and no sequence, so the arrows have
         nothing to page. Escape above still closes from it. */
      if (intro) {
        if (e.key === 'ArrowRight') { e.stopPropagation(); setIntro(false) }
        return
      }
      if (e.key === 'ArrowRight') {
        e.stopPropagation()
        if (isLast) dismiss()
        else next()
      }
      if (e.key === 'ArrowLeft' && !isFirst) {
        e.stopPropagation()
        back()
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [dismiss, next, back, isFirst, isLast, intro])

  /* ──── The entrance is one frame behind the mount ────
     The card renders once at its offset, unlit and untransitioned, and is moved
     to its resting place on the next frame so the transition has two ends to run
     between. Reset when the welcome slide closes, because that is when the card
     tree actually mounts. */
  const [settledIn, setSettledIn] = useState(false)
  useEffect(() => {
    if (intro) { setSettledIn(false); return }
    const r = requestAnimationFrame(() => setSettledIn(true))
    return () => cancelAnimationFrame(r)
  }, [intro])

  const lit = rect !== null

  /* ──── THE HOLD COVERS THE PLACEMENT, NOT JUST THE RECT ────
     The grace period leaves the previous measurement standing while a card
     navigates, so the spotlight sits on the outgoing control through the step
     change and the card holds with it. If `place()` were re-run every frame of
     that window it would be given the OLD rect and the NEW card's inputs, and
     those inputs decide the side, so the card would set off for a position
     belonging to neither card and turn round when the real anchor arrived. A
     placement is only recomputed once the committed frame BELONGS to the card
     being drawn. */
  const placement = place(rect, cardH, viewport.vw, viewport.vh, card.prefer)
  const measured = frame.forCard === card.id
  const held = useRef(placement)
  if (measured) held.current = placement
  const { left, top, side } = measured ? placement : held.current

  /* The hole, when there is no anchor: a point in the middle of the window. */
  const spot: Rect = rect ?? { x: viewport.vw / 2, y: viewport.vh / 2, width: 0, height: 0 }

  /* The welcome slide stands alone: no dim, no hole, no card, because there is
     nothing being pointed at yet. Rendered after every hook above so the
     measurement loop is already running by the time the first card arrives. */
  if (intro) {
    return createPortal(
      welcome({ onStart: () => setIntro(false), onSkip: dismiss }),
      document.body,
    )
  }

  const travel = reduced ? 'none'
    : `left ${GLIDE_MS}ms ${GLIDE}, top ${GLIDE_MS}ms ${GLIDE}, width ${GLIDE_MS}ms ${GLIDE}, height ${GLIDE_MS}ms ${GLIDE}, box-shadow ${GLIDE_MS}ms ${GLIDE}, opacity ${leaving ? LEAVE_MS : 280}ms ease-out`

  const cardStyle: CSSProperties = {
    position: 'fixed',
    left: 0,
    top: 0,
    width: CARD_W,
    zIndex: 191,
    /* ──── THREE LAYERS, EACH WITH ONE JOB ────
       This element carries POSITION and nothing else: no background, no border,
       no clip. The chrome and the height transition live on the shell below it,
       and the reason is the beak - a box that clips its children cannot also hold
       something that has to stick out past its own edge. Putting the clip on the
       shell lets the beak be a sibling of it, outside the clip, while the shell
       still trims its content to the rounded shape while its height is moving. */
    overflow: 'visible',
    /* ──── POSITION IS A TRANSFORM ────
       `left`/`top` would ask the browser to lay the card out again on every frame
       of the travel. A transform is composited, so the same journey costs nothing
       and cannot interleave with the layout the height change is already causing.
       The element sits at 0,0 and the transform does all the moving. The entrance
       rise folds into it: "start 18px below where you land" is one more pixel on
       the same translate rather than a second offset. */
    transform: `translate3d(${left}px, ${top + (settledIn && !leaving ? 0 : leaving ? 8 : 18)}px, 0) scale(${settledIn && !leaving ? 1 : 0.985})`,
    opacity: settledIn && !leaving ? 1 : 0,
    transition: reduced ? 'none'
      : leaving
        ? `transform ${LEAVE_MS}ms ease-out, opacity ${LEAVE_MS}ms ease-out`
        : `transform ${GLIDE_MS}ms ${GLIDE}, opacity 300ms ease-out`,
  }

  return createPortal(
    <>
      {/* ──── The layer that makes the wizard inert ────
          Transparent, full viewport, under the dim and over the panel. It exists
          only to swallow pointer events. It is NOT a dismiss surface: a click here
          does nothing at all, which is deliberate, because the reader is being
          shown a form they did not ask to have taken away and losing the
          explanation to a stray click on the dim is the one failure worth
          avoiding. Preventing default on the pointer keeps focus where it is, so a
          click on the dim cannot blur the field the reader was in. */}
      <div
        aria-hidden="true"
        onPointerDown={e => e.preventDefault()}
        style={{ position: 'fixed', inset: 0, zIndex: INERT_Z, background: 'transparent', cursor: 'default' }}
      />

      {/* ──── The dim, the hole and the ring, in one element ──── */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          left: spot.x - (lit ? HALO : 0),
          top: spot.y - (lit ? HALO : 0),
          width: spot.width + (lit ? HALO * 2 : 0),
          height: spot.height + (lit ? HALO * 2 : 0),
          borderRadius: 10,
          boxShadow: spotShadow(lit),
          opacity: leaving || !settledIn ? 0 : 1,
          /* Still `none`, but for a different reason than the inert layer's: that
             layer already stops everything reaching the wizard, and this element
             must not steal the events it is there to eat. */
          pointerEvents: 'none',
          zIndex: 190,
          transition: settledIn ? travel : 'none',
        }}
      />

      {/* ──── The arrival ripple ────
          One soft ring expanding out of the hole and fading, keyed to the card so
          it plays exactly once when the spotlight LANDS. It is doing the job an
          animation is actually good at: the spotlight travels across the panel in
          half a second and the eye needs telling that it has arrived, which is
          otherwise a static frame appearing in peripheral vision. Never a loop. */}
      {lit && !reduced && !leaving && (
        <div
          key={`ping-${card.id}`}
          aria-hidden="true"
          style={{
            position: 'fixed',
            left: spot.x - HALO,
            top: spot.y - HALO,
            width: spot.width + HALO * 2,
            height: spot.height + HALO * 2,
            borderRadius: 10,
            border: '1.5px solid rgba(10, 124, 255, 0.55)',
            boxShadow: '0 0 14px rgba(10, 124, 255, 0.28)',
            pointerEvents: 'none',
            zIndex: 190,
            animation: 'coaTourPing .85s ease-out forwards',
          }}
        />
      )}

      {/* ──── The card ──── */}
      <div role="dialog" aria-modal="false" aria-label={label} style={cardStyle}>
        {/* ──── The beak, OUTSIDE the card and above it ────
            A sibling of the clipped stack rather than a child of it, so nothing
            trims it, and drawn after so its base merges into the card's own border
            instead of sitting behind it. Suppressed when the card is centred, since
            there is nothing to point at. */}
        {side !== 'center' && (
          <Beak side={side} rect={rect} cardLeft={left} cardTop={top} cardH={cardH} />
        )}

        <div
          /* The height transition lives here, on the box that clips. One target
             per card, on the same curve as the position, so a taller or shorter
             body grows into place instead of snapping when the text swaps. */
          style={{
            height: cardH,
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: 14,
            /* Two shadows and a brand tinted third: the card has to lift off a
               dimmed screen without reading as a second modal, so the elevation is
               a modal's and the tint is the help family's. */
            boxShadow: [
              '0 24px 48px -12px rgba(15, 23, 42, 0.28)',
              '0 8px 20px rgba(10, 124, 255, 0.10)',
              '0 0 0 1px rgba(255, 255, 255, 0.9) inset',
            ].join(', '),
            overflow: 'hidden',
            transition: settledIn && !reduced ? `height ${GLIDE_MS}ms ${GLIDE}` : 'none',
          }}
        >
          <div ref={contentRef}>
            {/* ──── ONE BLOCK, THEN A FOOTER ────
                One padded block carrying a step chip, a title and a ticked list,
                closed by a single rule above the actions. There is no header zone,
                no progress bar and no close glyph: the dots in the footer are the
                position, the chip carries the step, and Skip is right there in the
                header, named, which is a clearer way out than an unlabelled X. */}
            <div style={{ padding: '16px 18px 14px' }}>
              {/* The chip and the way out, on one line. Centred against each other
                  rather than both pinned to the top of the block, because the chip
                  is 22px tall and a 12px label aligned to its top edge reads as
                  having slipped. */}
              <div className="flex items-center gap-2">
                {/* Slate, not blue: the chip is the only one of the three coloured
                    things on this card that is not a control, so in slate it reads
                    as a label and the two blues left are the two places to press. */}
                {card.eyebrow && <span
                  className="inline-flex items-center gap-1.5 rounded-full border"
                  style={{
                    background: '#F1F5F9', borderColor: '#E2E8F0', color: '#475569',
                    fontSize: 11.5, fontWeight: 600, letterSpacing: '-0.005em', padding: '3px 10px',
                  }}
                >
                  {/* The card's own icon rather than one glyph for all five: it is
                      the only thing on the chip that says WHICH card. */}
                  <card.icon style={{ width: 12, height: 12 }} />
                  {card.eyebrow}
                </span>}

                <button
                  type="button"
                  onClick={dismiss}
                  className="ml-auto shrink-0 rounded-[6px] px-1.5 py-0.5 text-[#0A7CFF] hover:bg-[#EFF6FF] transition-colors cursor-pointer"
                  style={{ fontSize: 12, fontWeight: 500 }}
                >
                  {skipLabel}
                </button>
              </div>

              {/* ──── THE BODY SWAPS AT ONCE, THEN FADES IN ────
                  Keying the element on the card and giving it no exit swaps it on
                  the same frame as the click. The new body fades up while the card
                  is still travelling, so the two read as one movement, and the
                  height is right from the first frame of it. Fading the old one out
                  first would sequence a step change as three events rather than
                  one, and would leave the DOM holding the outgoing body while the
                  index had already changed - which is a wrong height for the
                  measurement loop to find. */}
              <div key={card.id} style={{ animation: reduced ? undefined : 'coaTourBody .24s cubic-bezier(.16,1,.3,1) both' }}>
                <h3
                  className="mt-[18px] text-[#0F172A]"
                  style={{ fontSize: 15, fontWeight: 650, lineHeight: 1.34, letterSpacing: '-0.01em' }}
                >
                  {card.title}
                </h3>

                {/* An opening line, for a card that has to say what its list is
                    a list OF before the list can be read. */}
                {card.lead && (
                  <p
                    className="text-[#475569]"
                    style={{ fontSize: 12.75, lineHeight: 1.6, fontWeight: 400, margin: '10px 0 0' }}
                  >
                    {card.lead}
                  </p>
                )}

                {/* ──── The message, one point to a line ────
                    One mark for every row rather than a per-point glyph, because
                    the ticks are punctuation here and five different marks down
                    one card would be a legend to learn.

                    A numbered card swaps the tick for its position, which is the
                    one case where the mark carries meaning: the list is the
                    order the steps happen in, and ticking it would say those
                    four things were already done. */}
                {/* Dropped rather than emptied: a card whose whole message is its
                    lead would otherwise carry the list's top margin under it. */}
                {card.points.length > 0 && (
                <ul aria-live="polite" className="flex flex-col gap-2 p-0" style={{ listStyle: 'none', margin: '12px 0 0' }}>
                  {card.points.map((p, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2.5 text-[#475569]"
                      style={{ fontSize: 12.75, lineHeight: 1.6, fontWeight: 400 }}
                    >
                      {card.numbered ? (
                        <span
                          className="shrink-0 flex items-center justify-center rounded-full"
                          style={{
                            width: 16, height: 16, marginTop: 2,
                            background: '#EFF6FF', color: '#0A7CFF',
                            fontSize: 10, fontWeight: 600, fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {i + 1}
                        </span>
                      ) : (
                        <CheckCircle2 className="shrink-0" style={{ width: 14, height: 14, color: '#0A7CFF', marginTop: 3 }} />
                      )}
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
                )}

                {/* ──── A picture, only where there is nothing to point at ────
                    A card carries art when its subject is not on the screen, and
                    the test for that is the spotlight: if something is lit, the
                    reader can look at the real thing, and a drawing of it beside
                    the real thing is the worse of the two. So the art is bound to
                    `lit` rather than to the card, and a card that asks for one and
                    finds its anchor after all quietly drops it. */}
                {!lit && card.art && (
                  <div
                    className="flex items-center justify-center rounded-[10px] border"
                    style={{
                      marginTop: 16,
                      borderColor: '#EDF2F8',
                      background: 'linear-gradient(180deg, #FCFDFF 0%, #F6F9FD 100%)',
                      padding: '18px 14px',
                    }}
                  >
                    <card.art />
                  </div>
                )}
              </div>
            </div>

            {/* ──── Footer: where you are on the left, where you can go on the right ────
                Skip is in the header, which is where it belongs: leaving is not a
                step in the sequence, and a third button beside Previous and Next
                would make the footer read as three equal choices. */}
            <div
              className="flex items-center gap-2"
              style={{ padding: '12px 18px 13px', borderTop: '1px solid #F1F5F9', background: '#FBFCFD' }}
            >
              <Dots index={index} total={total} onPick={setIndex} reduced={reduced} />
              <span className="ml-auto shrink-0" />
              {/* Always rendered, so the footer's geometry does not shift between
                  the first card and the rest, and disabled on card one, because
                  there is nothing behind it now that the welcome slide is a door
                  rather than a step. */}
              <button
                type="button"
                onClick={back}
                disabled={isFirst}
                className={cn(
                  'inline-flex items-center rounded-[7px] border border-[#E2E8F0] bg-white px-2.5 transition-colors',
                  isFirst ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-[#F8FAFC] hover:border-[#CBD5E1]',
                )}
                style={{
                  fontSize: 12, fontWeight: 500, height: 34, gap: 4,
                  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.07)',
                  color: isFirst ? '#94A3B8' : '#475569',
                  opacity: isFirst ? 0.62 : 1,
                }}
              >
                <ChevronLeft style={{ width: 14, height: 14 }} />
                Previous
              </button>
              <button
                type="button"
                onClick={isLast ? dismiss : next}
                className="inline-flex items-center rounded-[7px] bg-[#0A7CFF] px-3.5 text-white hover:bg-[#0369D9] transition-colors cursor-pointer"
                style={{
                  fontSize: 12, fontWeight: 600, height: 34, gap: 5,
                  boxShadow: '0 1px 2px rgba(10,124,255,0.28)',
                }}
              >
                {isLast ? 'Done' : 'Next'}
                {isLast ? <Check style={{ width: 14, height: 14 }} /> : <ChevronRight style={{ width: 14, height: 14 }} />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body,
  )
}

/* ──────── The dots ────────
 * One per card, and every one is a control: a reader who wants the card about
 * the review grid and nothing else should not have to press Next four times to
 * reach it. The current one is a PILL rather than a bigger dot, which is what
 * lets the row read as a position in a sequence instead of a row of equal
 * buttons with one of them selected.
 *
 * The dots shrink past nine, because the row shares a fixed 400px card with
 * Previous and Next and those two cannot give any width back. Sized off the
 * count rather than measured: the alternative is a row that wraps to a second
 * line on one tour and not another, which moves the card's whole footer. */
function Dots({ index, total, onPick, reduced }: {
  index: number
  total: number
  onPick: (i: number) => void
  reduced: boolean
}) {
  const tight = total > 9
  const dot = tight ? 6 : 7
  const pill = tight ? 17 : 22
  return (
    <div className="flex items-center" style={{ gap: tight ? 3 : 4 }} role="tablist" aria-label="Walkthrough cards">
      {Array.from({ length: total }, (_, i) => {
        const current = i === index
        const seen = i < index
        return (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={current}
            aria-label={`Card ${i + 1} of ${total}`}
            onClick={() => onPick(i)}
            className="cursor-pointer"
            style={{
              width: current ? pill : dot,
              height: dot,
              borderRadius: 999,
              padding: 0,
              border: 'none',
              background: current ? '#0A7CFF' : seen ? '#93C5FD' : '#D1D9E2',
              transition: reduced ? 'none' : 'width .28s cubic-bezier(.16,1,.3,1), background-color .28s cubic-bezier(.16,1,.3,1)',
            }}
          />
        )
      })}
    </div>
  )
}

/* The pointer, drawn the way the module's tooltips draw theirs (Mahad,
 * 2026-10-08: *"It should be like how we have this in the tooltips. Where the
 * triangle and the rectangle feel like one shape."*): a square turned 45
 * degrees, in the card's fill, bordered on its two outer sides only, centred on
 * the card's edge. Half of it lies over the card, and that half's fill covers
 * the card's border along the join at any pixel ratio, so the card's outline
 * runs up one side of the point and down the other with no line across its
 * base. The two triangles before it stopped at the edge, and the border showed
 * through between them.
 *
 * Drawn as a SIBLING of the clipped card stack, after it, so the card neither
 * trims the overhanging half nor paints over the inner one.
 *
 * `side` is which side of the ANCHOR the card ended up on, so the pointer goes on
 * the opposite edge and aims back, and the fill follows the surface it sits on:
 * white for three edges, the footer's wash for the bottom one. */
function Beak({ side, rect, cardLeft, cardTop, cardH }: {
  side: Side
  rect: Rect | null
  cardLeft: number
  cardTop: number
  cardH: number
}) {
  if (!rect) return null

  /* The square's side. Its half-diagonal, about 9px, is how far the point
     stands off the card. */
  const SIZE = 13

  /* Where along the shared edge the pointer sits: the anchor's centre, clamped so
     it never rides out past the card's own corner radius. */
  const clamp = (v: number, max: number) => Math.min(Math.max(v, 18), Math.max(18, max - 18))
  const alongX = clamp(rect.x + rect.width / 2 - cardLeft, CARD_W)
  const alongY = clamp(rect.y + rect.height / 2 - cardTop, cardH)

  const fill = side === 'above' ? '#FBFCFD' : '#FFFFFF'
  const line = '1px solid #E2E8F0'
  const half = SIZE / 2

  /* Turned 45 degrees clockwise, the square's top-left corner points up, its
     bottom-right down, its bottom-left left and its top-right right; the two
     sides meeting at that corner are the ones that carry the border. */
  const box: CSSProperties = { position: 'absolute', width: SIZE, height: SIZE, background: fill, transform: 'rotate(45deg)', pointerEvents: 'none' }
  const placed: CSSProperties =
    side === 'below' ? { left: alongX - half, top: -half, borderTop: line, borderLeft: line }
    : side === 'above' ? { left: alongX - half, top: cardH - half, borderBottom: line, borderRight: line }
    : side === 'right' ? { left: -half, top: alongY - half, borderBottom: line, borderLeft: line }
    : { left: CARD_W - half, top: alongY - half, borderTop: line, borderRight: line }

  return <span aria-hidden="true" style={{ ...box, ...placed }} />
}
