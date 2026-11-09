import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ChevronRight, Check, FileSpreadsheet, ListTree, type LucideIcon } from 'lucide-react'

/* ──────────────────────────────────────────────────────────────────
 * THE WALKTHROUGH'S INTRO SLIDE
 *
 * The door. The tour could have started on its first card, but a card is the
 * same object as every other card and therefore says nothing about arriving.
 * This is a panel with a hero, a sentence and two choices, and the cards start
 * after it.
 *
 * ──── THE ANATOMY IS THE CALENDARS MODULE'S ────
 * A 196px slate hero carrying a skewed grid of cells that light at random, a
 * radial vignette feathering them into the backdrop, a two line greeting under
 * it on a blue tinted gradient, and a stacked pair of buttons at 70% of the
 * column. Two surfaces in the same product that both mean "you have not been
 * here before" should be the same object, so every measurement, every easing
 * and every keyframe here is that file's.
 *
 * WHAT IS NOT BORROWED is the thing inside the hero. Theirs paints a month and
 * observes two days as something other than working, because that is what a
 * calendar is. An import is not, so `WalkthroughWelcomeShell` takes the hero as
 * a prop and each wizard draws its own.
 *
 * ──── TWO HEROES LIVE HERE ────
 * `ImportHeroAnimation` is the one the import slide mounts: rows crossing from a
 * file into a chart, which is what the door leads to.
 *
 * `NumberHeroAnimation` is the one it replaced, and it is kept on purpose rather
 * than deleted. It draws this module's harder claim, an account number arriving
 * whole and splitting into the pieces it was hiding, in `FILLS`' two tones, so
 * the blue and the purple are the same two the reader meets at full size on the
 * dimension table. It is exported and currently mounted nowhere. If it is still
 * unmounted the next time somebody reads this, it has outlived its reprieve.
 *
 * Its PICTURE is not unused, though. `walkthroughArt.tsx` draws the same number
 * coming apart on the card that defines the word: the tour's own specimen rather
 * than the gate's, no cursor over it, and in the card's own greys rather than on
 * slate, because a dark panel inside a white card competes with the paragraph
 * above it. What is kept here is the hero-sized telling, which is the one that
 * earns the slate: a loop, a wordmark, and a hand answering for each piece.
 *
 * ──── THE CURSOR IS DOING THE EXPLAINING ────
 * In the two heroes that draw a choice, every act is pointed at by a cursor that
 * clicks, with the reference's five layer ripple under it. Without it the chips
 * rearrange themselves and read as decoration; with it, every change has a
 * cause, which is the sentence those panels are making: somebody decided this.
 * The import hero has no cursor, because an import is a transfer and not a
 * choice, and a hand over it would be claiming otherwise.
 *
 * Timers and CSS transitions rather than an animation library. This is a ten
 * second choreography of about a dozen cues, and a library's value is
 * interruption and layout, neither of which applies to a decorative loop
 * nothing can interrupt. Under `prefers-reduced-motion` the whole clock is
 * skipped and the hero renders its final frame.
 * ────────────────────────────────────────────────────────────────── */

export const reducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true

/* ──────── Hero geometry ────────
 * Every position in the hero is arithmetic off these, including the cursor's
 * targets, so nothing has to be measured and the choreography cannot drift out
 * of step with the layout on a re-render. */
export const HERO_W = 520
export const HERO_H = 196

const WORD_Y = 26

/* The three pieces of the worked number, and the two layouts they take.
 * The middle one is PINNED to the centre and the outer two travel away from it,
 * so the number opens outwards from where it already was rather than sliding
 * across the hero while it opens. Widths are the digit counts of `PARTS`: two,
 * three and four. */
const CHIP_H = 34
const CHIP_Y = 78
const CHIP_W = [54, 62, 78]
const JOIN_GAP = 10
const SPLIT_GAP = 34

const MID_L = Math.round((HERO_W - CHIP_W[1]) / 2)
const joinedL = [MID_L - JOIN_GAP - CHIP_W[0], MID_L, MID_L + CHIP_W[1] + JOIN_GAP]
const splitL = [MID_L - SPLIT_GAP - CHIP_W[0], MID_L, MID_L + CHIP_W[1] + SPLIT_GAP]

const chipCX = (i: number) => splitL[i] + CHIP_W[i] / 2
const CHIP_CY = CHIP_Y + CHIP_H / 2
const LABEL_Y = CHIP_Y + CHIP_H + 13

const WORDMARK = 'IMPORT ACCOUNTS'
/* The same number the gate's subtitle takes apart, in the same order and with
   the same names. The slide is shown directly on top of that step, so a second
   worked number would read as a second subject. */
const PARTS = ['01', '100', '5020']
const PART_NAMES = ['Location', 'Department', 'GL account no.']

/* ──────── Where the background grid is not allowed to bloom ────────
 * Hero coordinates, covering everything the mock draws: the wordmark line, the
 * chips at their widest, and the labels under them, plus a few pixels of air. A
 * lit cell inside this box sits directly behind a chip and reads as part of the
 * number rather than behind it, which is the whole complaint. Left as literals
 * derived from the geometry above rather than computed from it, because the
 * labels' width depends on their words. */
export interface Guard { x0: number; x1: number; y0: number; y1: number }
const GUARD: Guard = { x0: 108, x1: 420, y0: 14, y1: 152 }

/* ──────── The three fills ────────
 * `PART_TONE` at full strength is a set of pastels for a white table; on a slate
 * hero the same hues are carried at low alpha over the dark, with the border
 * doing the identifying. Same families, same meanings: brand blue is the GL
 * account number, purple is a Dimension, and a piece nobody has answered for
 * yet wears the dashed outline the real table gives it. */
export const FILLS = {
  unmapped: {
    background: 'rgba(30, 41, 59, 0.92)',
    borderColor: 'rgba(100, 116, 139, 0.85)',
    borderStyle: 'dashed' as const,
    color: 'rgba(226, 232, 240, 0.95)',
  },
  account: {
    background: 'rgba(37, 99, 235, 0.34)',
    borderColor: 'rgba(96, 165, 250, 0.68)',
    borderStyle: 'solid' as const,
    color: 'rgba(219, 234, 254, 0.98)',
  },
  filter: {
    background: 'rgba(147, 51, 234, 0.32)',
    borderColor: 'rgba(192, 132, 252, 0.68)',
    borderStyle: 'solid' as const,
    color: 'rgba(243, 232, 255, 0.98)',
  },
} as const

type PartKind = keyof typeof FILLS

/* Which piece becomes what, in the order the cursor answers them: left to
 * right, which is reading order and also the order the real table asks. */
const ANSWERS: PartKind[] = ['filter', 'filter', 'account']

/* Soft blue tints for the background grid's random bloom. Kept in the brand's
 * family, at the reference's low saturation, so the ambient pulse reads as
 * texture rather than as pops of colour. */
const BOXES_PALETTE = [
  'rgb(219 234 254)',
  'rgb(191 219 254)',
  'rgb(186 230 253)',
  'rgb(207 219 252)',
  'rgb(224 231 255)',
  'rgb(199 210 254)',
  'rgb(165 211 250)',
  'rgb(196 213 245)',
]

/* ──────── One injected stylesheet ────────
 * Idempotent, and the only place in this file that is not inline: keyframes
 * cannot be expressed as a style object, and the background grid is 600 cells
 * whose hover rule has to live in CSS rather than on every node. */
export function injectWelcomeStyles() {
  if (typeof document === 'undefined') return
  if (document.getElementById('__coa-welcome-styles')) return
  const style = document.createElement('style')
  style.id = '__coa-welcome-styles'
  style.textContent = `
    @keyframes coaWelcomeFade { from { opacity: 0 } to { opacity: 1 } }
    @keyframes coaWelcomeRise {
      from { opacity: 0; transform: translateY(8px) scale(0.985) }
      to   { opacity: 1; transform: translateY(0) scale(1) }
    }

    /* Background grid - the reference's skewed matrix, sized to overflow the
       hero after the transform so no cell ends on a visible edge. */
    .__coa-boxes {
      position: absolute;
      inset: -40% -25%;
      transform: skewX(-22deg) skewY(10deg) scale(.92);
      transform-origin: center;
      display: flex; align-items: center; justify-content: center;
      pointer-events: auto;
    }
    .__coa-boxes-row {
      display: flex; flex-direction: column;
      width: 56px; flex-shrink: 0;
      border-left: 1px solid #223247;
    }
    .__coa-boxes-cell {
      width: 56px; height: 28px;
      border-right: 1px solid #223247;
      border-top: 1px solid #223247;
      position: relative;
      background-color: transparent;
      transition: background-color 3.4s cubic-bezier(.4,0,.2,1), opacity 3.4s ease;
    }
    /* A pastel blue at 42% over slate-900 lands somewhere around mid grey, so a
       lit cell reads as a panel rather than as a bloom and merges with the mock
       in front of it. At 16% the hue survives and the cell stays behind
       everything. */
    .__coa-boxes-cell:hover, .__coa-boxes-cell.lit {
      background-color: var(--c); opacity: .16;
      transition: background-color 1s cubic-bezier(.2,.7,.2,1), opacity .6s ease;
    }
    /* The cells the mock stands on never light. Marked at runtime by
       measurement, because the grid is skewed and scaled and no index maps to a
       screen position. Both the pulse and the hover are suppressed, so a pointer
       crossing the hero cannot light what the timer is forbidden to. */
    .__coa-boxes-cell.guard:hover { background-color: transparent; opacity: 1; }
    .__coa-boxes-plus {
      position: absolute; top: -10px; left: -16px;
      width: 32px; height: 20px;
      color: #223247; pointer-events: none;
      stroke: currentColor; stroke-width: 1.2; fill: none;
    }

    /* The wordmark types one character at a time. */
    @keyframes coaWmKeyIn {
      0%   { opacity: 0; transform: translateY(-3px) scale(.92); filter: blur(2px) }
      55%  { filter: blur(0) }
      100% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0) }
    }
    .__coa-wm-char { display: inline-block; animation: coaWmKeyIn .22s cubic-bezier(.22,1,.36,1) backwards }
    @keyframes coaWmCaret { 0%,100% { opacity: 1 } 50% { opacity: 0 } }
    .__coa-wm-caret {
      display: inline-block; width: 2px; height: 1.05em;
      background: rgba(226,232,240,.95);
      margin-left: 3px; vertical-align: middle; border-radius: 1px;
      animation: coaWmCaret .5s step-start infinite;
    }

    /* A chip arriving, and the pulse it gives when the cursor answers it. */
    @keyframes coaChipDrop {
      0%   { opacity: 0; transform: scale(.72) translateY(2px) }
      100% { opacity: 1; transform: scale(1) translateY(0) }
    }
    @keyframes coaChipSet {
      0%   { box-shadow: 0 0 0 0 rgba(255,255,255,.34) }
      100% { box-shadow: 0 0 0 7px rgba(255,255,255,0) }
    }

    /* The click ripple's three rings, its flash and its sparks. */
    @keyframes coaPulseWave {
      0%   { opacity: 1; transform: scale(.12) }
      100% { opacity: 0; transform: scale(var(--max, 4)) }
    }
    .__coa-wave1 { animation: coaPulseWave .55s cubic-bezier(.16,1,.3,1) forwards }
    .__coa-wave2 { animation: coaPulseWave .68s cubic-bezier(.16,1,.3,1) .12s both }
    .__coa-wave3 { animation: coaPulseWave .80s cubic-bezier(.16,1,.3,1) .24s both }
    @keyframes coaPulseFlash {
      0%   { opacity: 0;   transform: scale(0) }
      20%  { opacity: 1;   transform: scale(1.35) }
      45%  { opacity: .85; transform: scale(1.05) }
      100% { opacity: 0;   transform: scale(.7) }
    }
    .__coa-flash { animation: coaPulseFlash .58s cubic-bezier(.16,1,.3,1) forwards }
    @keyframes coaPulseSpark {
      0%   { opacity: 0; transform: translate(0,0) scale(0) }
      18%  { opacity: 1; transform: translate(calc(var(--tx) * .35), calc(var(--ty) * .35)) scale(1.2) }
      100% { opacity: 0; transform: translate(var(--tx), var(--ty)) scale(.3) }
    }
    .__coa-spark { animation: coaPulseSpark .72s cubic-bezier(.2,.8,.25,1) forwards }

    /* The name landing under the piece it names. */
    @keyframes coaLabelIn {
      0%   { opacity: 0; transform: translateY(-4px) scale(.9) }
      100% { opacity: 1; transform: translateY(0) scale(1) }
    }
  `
  document.head.appendChild(style)
}

/* ──────── The background grid ────────
 * A 600 cell matrix that lights one random cell every 600ms and lets it fade out
 * over the next three seconds, so the hero is never still and never moving
 * enough to compete with the animation in front of it. Hover paints the same
 * colour, which is the reference's small delight: the grid answers a pointer. */
export function BoxesBackground({ guard = GUARD }: { guard?: Guard }) {
  const gridRef = useRef<HTMLDivElement | null>(null)
  const cells = useMemo(() => {
    const rows: string[][] = []
    for (let i = 0; i < 30; i++) {
      const row: string[] = []
      for (let j = 0; j < 20; j++) {
        row.push(BOXES_PALETTE[Math.floor(Math.random() * BOXES_PALETTE.length)])
      }
      rows.push(row)
    }
    return rows
  }, [])

  useEffect(() => {
    if (reducedMotion()) return
    const root = gridRef.current
    if (!root) return
    const all = Array.from(root.querySelectorAll<HTMLElement>('.__coa-boxes-cell'))
    if (all.length === 0) return

    const timeouts: number[] = []
    let outer: HTMLElement[] = all
    let id = 0

    /* ──── Which cells are allowed to light ────
       Measured rather than indexed: the grid is skewed and scaled, so no row and
       column maps to a screen position. Each cell's rect is compared against the
       guard box in hero coordinates, and anything overlapping it is marked out of
       play for the life of the panel. */
    const measure = () => {
      const host = root.parentElement
      if (!host) return
      const base = host.getBoundingClientRect()
      outer = all.filter(cell => {
        const r = cell.getBoundingClientRect()
        const x0 = r.left - base.left
        const x1 = r.right - base.left
        const y0 = r.top - base.top
        const y1 = r.bottom - base.top
        const hits = x1 > guard.x0 && x0 < guard.x1 && y1 > guard.y0 && y0 < guard.y1
        if (hits) cell.classList.add('guard')
        return !hits
      })
      if (outer.length === 0) return
      id = window.setInterval(() => {
        const cell = outer[Math.floor(Math.random() * outer.length)]
        if (cell.classList.contains('lit')) return
        cell.classList.add('lit')
        timeouts.push(window.setTimeout(() => cell.classList.remove('lit'), 1200))
      }, 600)
    }

    const start = window.setTimeout(measure, 420)
    return () => {
      window.clearTimeout(start)
      window.clearInterval(id)
      timeouts.forEach(t => window.clearTimeout(t))
    }
  }, [])

  return (
    <div ref={gridRef} className="__coa-boxes" aria-hidden="true">
      {cells.map((row, i) => (
        <div key={i} className="__coa-boxes-row">
          {row.map((color, j) => (
            <div key={j} className="__coa-boxes-cell" style={{ ['--c' as string]: color }}>
              {i % 2 === 0 && j % 2 === 0 && (
                <svg viewBox="0 0 24 24" className="__coa-boxes-plus" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 6v12m6-6H6" />
                </svg>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

/* ──────── The cursor ────────
 * The reference's arrow, at its size and with its two shadows. It travels on a
 * transition whose duration is set per move, so a long approach and a short hop
 * between two adjacent chips both read as one gesture. */
export function HeroCursor({ x, y, visible, pressing, dur }: {
  x: number; y: number; visible: boolean; pressing: boolean; dur: number
}) {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        left: x,
        top: y,
        opacity: visible ? 1 : 0,
        transform: pressing
          ? 'scale(0.84) translateY(1px) rotate(-2deg)'
          : 'scale(1) translateY(0) rotate(0deg)',
        transformOrigin: '1.2px 1px',
        transition: [
          `left ${dur}ms cubic-bezier(.22,.7,.2,1)`,
          `top ${dur}ms cubic-bezier(.22,.7,.2,1)`,
          'opacity .22s ease',
          pressing
            ? 'transform .09s cubic-bezier(.4, 0, .68, 0)'
            : 'transform .32s cubic-bezier(.34, 1.7, .5, 1)',
        ].join(', '),
        pointerEvents: 'none',
        zIndex: 10,
        filter: pressing
          ? 'drop-shadow(0 2px 4px rgba(2,6,23,.55)) drop-shadow(0 0 10px rgba(96,165,250,.7))'
          : 'drop-shadow(0 2px 3px rgba(0,0,0,.45)) drop-shadow(0 0 1px rgba(0,0,0,.3))',
      }}
    >
      <svg width="18" height="22" viewBox="0 0 18 22" fill="none">
        <path
          d="M1.2 1L1.2 17.2L5.2 13.2L8.4 19.8L11 18.7L7.7 12L13.4 12L1.2 1Z"
          fill="#FAFBFC"
          stroke="#0F172A"
          strokeWidth="1.15"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
    </div>
  )
}

/* ──────── The click ────────
 * Three expanding rings, six sparks and a centre flash, keyed so it plays once
 * per click. The whole burst is under 0.8s: it is punctuation on the cursor's
 * gesture, not an event of its own. */
const SPARKS = [0, 60, 120, 180, 240, 300].map((angle, i) => ({
  tx: Math.cos(((angle - 90) * Math.PI) / 180) * (i % 2 ? 30 : 26),
  ty: Math.sin(((angle - 90) * Math.PI) / 180) * (i % 2 ? 30 : 26),
}))

export function HeroClick({ ripple }: { ripple: { x: number; y: number; k: number } | null }) {
  if (!ripple) return null
  const base: React.CSSProperties = {
    position: 'absolute',
    left: ripple.x,
    top: ripple.y,
    borderRadius: '50%',
    pointerEvents: 'none',
    transformOrigin: 'center center',
    opacity: 0,
  }
  const ring = { ...base, width: 18, height: 18, marginLeft: -9, marginTop: -9, zIndex: 12 }
  return (
    <div key={ripple.k} aria-hidden="true">
      <div className="__coa-wave1" style={{ ...ring, border: '3px solid rgba(186,230,253,.98)', ['--max' as string]: 3.4 }} />
      <div className="__coa-wave2" style={{ ...ring, border: '2px solid rgba(147,197,253,.85)', ['--max' as string]: 4.2 }} />
      <div className="__coa-wave3" style={{ ...ring, border: '1.5px solid rgba(96,165,250,.55)', ['--max' as string]: 5.2 }} />
      {SPARKS.map((s, i) => (
        <div
          key={i}
          className="__coa-spark"
          style={{
            ...base,
            width: 4,
            height: 4,
            marginLeft: -2,
            marginTop: -2,
            background: 'rgba(219,234,254,.98)',
            boxShadow: '0 0 6px rgba(147,197,253,.9)',
            ['--tx' as string]: `${s.tx}px`,
            ['--ty' as string]: `${s.ty}px`,
            animationDelay: `${i * 14}ms`,
            zIndex: 14,
          }}
        />
      ))}
      <div
        className="__coa-flash"
        style={{
          ...base,
          width: 22,
          height: 22,
          marginLeft: -11,
          marginTop: -11,
          background:
            'radial-gradient(circle, #FFFFFF 0%, rgba(219,234,254,.95) 30%, rgba(147,197,253,.75) 55%, rgba(96,165,250,0) 78%)',
          zIndex: 16,
        }}
      />
    </div>
  )
}

/* ──────── The name of the thing being done ────────
 * Typed one character at a time, with a caret while it types. Shared by every
 * hero rather than restated in each: the panel is the same door whichever wizard
 * it opens, so the line naming which one has to arrive the same way.
 *
 * The character it substitutes for a space is a non-breaking one. Each character
 * is its own inline-block so it can be animated on its own, and a plain space
 * between two inline-blocks collapses. */
export function HeroWordmark({ text, chars, still }: {
  text: string
  /* How many characters have been typed. Driven by the caller's clock, because
     the wordmark is the first act of a choreography and not a thing that runs
     on its own. */
  chars: number
  still: boolean
}) {
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: WORD_Y,
        textAlign: 'center',
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '0.26em',
        textTransform: 'uppercase',
        color: 'rgba(226, 232, 240, 0.94)',
        textShadow: '0 1px 12px rgba(15, 23, 42, 0.8)',
        whiteSpace: 'nowrap',
      }}
    >
      {text.slice(0, chars).split('').map((ch, i) => (
        <span key={i} className={still ? undefined : '__coa-wm-char'}>
          {ch === ' ' ? ' ' : ch}
        </span>
      ))}
      {!still && chars > 0 && chars < text.length && <span className="__coa-wm-caret" />}
    </div>
  )
}

/* The name a piece was just given, landing under it. */
function PartLabel({ index, show, kind }: { index: number; show: boolean; kind: PartKind }) {
  if (!show) return null
  const tone = FILLS[kind]
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        left: splitL[index],
        top: LABEL_Y,
        width: CHIP_W[index],
        textAlign: 'center',
        fontSize: 8.5,
        fontWeight: 650,
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
        color: tone.color,
        whiteSpace: 'nowrap',
        animation: 'coaLabelIn .32s cubic-bezier(.16,1,.3,1) both',
        zIndex: 6,
      }}
    >
      {PART_NAMES[index]}
    </div>
  )
}

/* ──────── The choreography ────────
 * Ten seconds, six acts, then it starts again. The clock is a list of
 * `setTimeout`s built once per loop and torn down whole, which is the same shape
 * the reference uses and the reason a re-render cannot desynchronise it: nothing
 * in here reads state to decide when the next cue fires. */
export function NumberHeroAnimation() {
  const still = reducedMotion()

  const [chars, setChars] = useState(still ? WORDMARK.length : 0)
  const [chipsIn, setChipsIn] = useState(still)
  const [split, setSplit] = useState(still)
  /* How many pieces have been answered, left to right. The chip reads its own
     fill off this, so one counter drives three chips and their three labels. */
  const [answered, setAnswered] = useState(still ? PARTS.length : 0)
  const [fading, setFading] = useState(false)

  const [cursor, setCursor] = useState({ x: 430, y: 214 })
  const [cursorVis, setCursorVis] = useState(false)
  const [cursorDur, setCursorDur] = useState(620)
  const [pressing, setPressing] = useState(false)
  const [ripple, setRipple] = useState<{ x: number; y: number; k: number } | null>(null)

  const [loop, setLoop] = useState(0)
  const timers = useRef<number[]>([])

  useEffect(() => {
    if (still) return
    timers.current.forEach(t => window.clearTimeout(t))
    timers.current = []
    const at = (ms: number, fn: () => void) => {
      timers.current.push(window.setTimeout(fn, ms))
    }
    /* Every loop starts from the empty hero rather than from wherever the last
       one left off, so a tab that was backgrounded mid run resumes cleanly. */
    setChars(0)
    setChipsIn(false)
    setSplit(false)
    setAnswered(0)
    setFading(false)
    setCursorVis(false)
    setPressing(false)
    setRipple(null)
    setCursorDur(620)
    setCursor({ x: 430, y: 214 })

    let t = 220

    /* 1 · The name types itself. */
    for (let i = 1; i <= WORDMARK.length; i++) {
      const n = i
      at(t, () => setChars(n))
      t += WORDMARK[i - 1] === ' ' ? 120 : 68
    }

    /* 2 · The number arrives, whole. */
    t += 200
    at(t, () => setChipsIn(true))
    t += 420

    /* 3 · The cursor arrives and takes it apart. */
    at(t, () => {
      setCursorDur(40)
      setCursorVis(true)
    })
    at(t + 60, () => {
      setCursorDur(640)
      setCursor({ x: HERO_W / 2 - 1, y: CHIP_CY - 1 })
    })
    t += 800
    at(t, () => {
      setPressing(true)
      setRipple({ x: HERO_W / 2, y: CHIP_CY, k: t })
    })
    at(t + 170, () => setPressing(false))
    at(t + 90, () => setSplit(true))
    t += 760

    /* 4 · Each piece is then told what it is, left to right, which is reading
           order and also the order the real table asks in. */
    PARTS.forEach((_, i) => {
      at(t, () => {
        setCursorDur(i === 0 ? 520 : 440)
        setCursor({ x: chipCX(i) - 1, y: CHIP_CY - 1 })
      })
      t += i === 0 ? 600 : 520
      at(t, () => {
        setPressing(true)
        setRipple({ x: chipCX(i), y: CHIP_CY, k: t })
      })
      at(t + 170, () => setPressing(false))
      at(t + 90, () => setAnswered(i + 1))
      t += 640
    })

    /* 5 · Hold on the finished number, then clear and go again. */
    t += 2100
    at(t, () => {
      setCursorDur(700)
      setCursor({ x: 430, y: -40 })
    })
    t += 620
    at(t, () => setCursorVis(false))
    at(t, () => setFading(true))
    t += 900
    at(t, () => setLoop(n => n + 1))

    return () => {
      timers.current.forEach(x => window.clearTimeout(x))
      timers.current = []
    }
  }, [loop, still])

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 2,
        pointerEvents: 'none',
        opacity: fading ? 0 : 1,
        transition: 'opacity .55s ease',
      }}
    >
      <HeroWordmark text={WORDMARK} chars={chars} still={still} />

      {/* The dashes that hold the number together, and go when it comes apart. */}
      {[0, 1].map(i => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: joinedL[i] + CHIP_W[i],
            top: CHIP_Y,
            width: JOIN_GAP,
            height: CHIP_H,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 13,
            fontWeight: 600,
            color: 'rgba(148, 163, 184, 0.9)',
            opacity: chipsIn && !split ? 1 : 0,
            transition: 'opacity .24s ease',
            zIndex: 4,
          }}
        >
          -
        </div>
      ))}

      {/* The three pieces. Each carries its own entrance delay and then a single
          transition on the fill and the position, so the split and the three
          answers all read as the same object being changed rather than as chips
          being swapped out. */}
      {PARTS.map((part, i) => {
        const kind: PartKind = i < answered ? ANSWERS[i] : 'unmapped'
        const tone = FILLS[kind]
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: split ? splitL[i] : joinedL[i],
              top: CHIP_Y,
              width: CHIP_W[i],
              height: CHIP_H,
              borderRadius: 7,
              border: '1px solid',
              borderStyle: tone.borderStyle,
              background: tone.background,
              borderColor: tone.borderColor,
              color: tone.color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 13.5,
              fontWeight: 650,
              letterSpacing: '0.01em',
              fontVariantNumeric: 'tabular-nums',
              opacity: chipsIn ? 1 : 0,
              animation:
                still || !chipsIn
                  ? undefined
                  : `coaChipDrop .3s cubic-bezier(.16,1,.3,1) ${i * 60}ms backwards`,
              transition: [
                'left .42s cubic-bezier(.16,1,.3,1)',
                'background-color .42s ease',
                'border-color .42s ease',
                'color .42s ease',
                'opacity .3s ease',
              ].join(', '),
              boxShadow: i < answered ? '0 0 12px -2px rgba(15, 23, 42, 0.9)' : 'none',
              zIndex: 5,
            }}
          >
            {part}
          </div>
        )
      })}

      {PARTS.map((_, i) => (
        <PartLabel key={i} index={i} show={i < answered} kind={ANSWERS[i]} />
      ))}

      <HeroClick ripple={ripple} />
      <HeroCursor x={cursor.x} y={cursor.y} visible={cursorVis} pressing={pressing} dur={cursorDur} />
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────
 * THE IMPORT HERO
 *
 * What the slide draws now. Two places and the rows that move between them: a
 * file on the left, a chart on the right, and every row leaving the one to land
 * in the other. That is an import and nothing else, which is the point of it.
 *
 * ──── WHY IT REPLACED THE NUMBER COMING APART ────
 * The old hero drew this module's particular claim, a number splitting into the
 * dimensions it was hiding. It is a good drawing and it is still in this file,
 * but it was answering a question the reader has not been asked yet. The slide
 * is the first thing they see, before the wizard has asked them anything, and a
 * greeting that opens on the hardest idea in the flow is a greeting that has to
 * be read twice. The cards teach the number. This says what the door leads to.
 *
 * ──── NO CURSOR ────
 * The other two heroes are pointed at by a cursor that clicks, because both draw
 * a choice somebody makes and without a hand the chips read as decoration. An
 * import is not a choice, it is a transfer, so nothing here needs a hand: rows
 * cross on their own and that is the honest picture.
 * ────────────────────────────────────────────────────────────────── */

/* ──────── Hero geometry ────────
 * Both panels carry the same four slots at the same heights, so a row crossing
 * moves horizontally and only horizontally. A row that also rose or fell would
 * read as being rearranged on the way, and nothing is rearranged: the file's
 * fourth line is the chart's fourth account. */
const PANEL_W = 112
const PANEL_Y = 58
const PANEL_PAD = 8
const ROW_H = 12
const ROW_STRIDE = 18
const ROWS_Y = PANEL_Y + 26

/* The rows, as a number and a bar. Real enough to read as accounts, varied
   enough in the bar to read as different ones, and not a worked example: the
   cards own the worked example and this is the greeting in front of them. */
const IMPORT_ROWS = [
  { no: '1000', bar: 52 },
  { no: '1200', bar: 40 },
  { no: '4000', bar: 56 },
  { no: '5020', bar: 46 },
]

const PANEL_H = ROWS_Y - PANEL_Y + (IMPORT_ROWS.length - 1) * ROW_STRIDE + ROW_H + PANEL_PAD
const FILE_L = 98
const CHART_L = HERO_W - FILE_L - PANEL_W
const ROW_W = PANEL_W - PANEL_PAD * 2
const rowTop = (i: number) => ROWS_Y + i * ROW_STRIDE

/* A flight is longer than the gap between two departures, so there are two rows
   in the air at the busiest moment. One at a time reads as a queue being served;
   overlapping reads as a file being moved. */
const FLIGHT_MS = 620
const LAUNCH_MS = 460

/* Hero coordinates the background grid may not light a cell inside: both panels,
   the badge that overhangs the right one's corner, and a little air. Derived
   rather than written down, because unlike the other two heroes there is no text
   here whose width depends on its words. */
const IMPORT_GUARD: Guard = {
  x0: FILE_L - 12,
  x1: CHART_L + PANEL_W + 12,
  y0: 14,
  y1: PANEL_Y + PANEL_H + 8,
}

/* The neutral a row wears while it is still a line in a file. Deliberately not
   `FILLS.unmapped`, whose dashed outline means "nobody has answered for this
   yet" everywhere else in the module. A row in a file is not unanswered. */
const FILE_ROW = {
  background: 'rgba(51, 65, 85, 0.96)',
  borderColor: 'rgba(148, 163, 184, 0.5)',
  color: 'rgba(203, 213, 225, 0.95)',
  bar: 'rgba(148, 163, 184, 0.45)',
}
const CHART_ROW = {
  background: FILLS.account.background,
  borderColor: FILLS.account.borderColor,
  color: FILLS.account.color,
  bar: 'rgba(147, 197, 253, 0.55)',
}

/* One of the two places. It draws its own empty slots and the rows travel over
   them, so a row is one object moving between two places that both already
   exist rather than one row disappearing and another appearing. */
function ImportPanel({ left, caption, icon: Icon, lit, show }: {
  left: number
  caption: string
  icon: LucideIcon
  /* The chart lights once the last row is in. The file never does: it is where
     the reader came from and the panel should not congratulate it. */
  lit: boolean
  show: boolean
}) {
  return (
    <div
      style={{
        position: 'absolute',
        left,
        top: PANEL_Y,
        width: PANEL_W,
        height: PANEL_H,
        borderRadius: 9,
        border: '1px solid',
        borderColor: lit ? FILLS.account.borderColor : 'rgba(100, 116, 139, 0.5)',
        background: lit ? 'rgba(37, 99, 235, 0.12)' : 'rgba(30, 41, 59, 0.72)',
        opacity: show ? 1 : 0,
        transform: show ? 'scale(1)' : 'scale(.86)',
        transition: [
          'opacity .3s ease',
          'transform .38s cubic-bezier(.16,1,.3,1)',
          'border-color .45s ease',
          'background-color .45s ease',
        ].join(', '),
        zIndex: 4,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          fontSize: 8.5,
          fontWeight: 650,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          color: lit ? FILLS.account.color : 'rgba(148, 163, 184, 0.92)',
          whiteSpace: 'nowrap',
          transition: 'color .45s ease',
        }}
      >
        <Icon style={{ width: 10, height: 10 }} />
        {caption}
      </div>

      {IMPORT_ROWS.map((_, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: PANEL_PAD,
            top: rowTop(i) - PANEL_Y,
            width: ROW_W,
            height: ROW_H,
            borderRadius: 4,
            border: '1px dashed rgba(100, 116, 139, 0.32)',
          }}
        />
      ))}
    </div>
  )
}

/* ──────── The choreography ────────
 * A list of `setTimeout`s built once per loop and torn down whole, like the other
 * two heroes'. Nothing in here reads state to decide when the next cue fires, so
 * a re-render cannot desynchronise it. Under `prefers-reduced-motion` the clock
 * never runs and the hero renders its last frame: every row already across.
 */
function ImportHeroAnimation() {
  const still = reducedMotion()

  const [chars, setChars] = useState(still ? WORDMARK.length : 0)
  const [panelsIn, setPanelsIn] = useState(still)
  const [rowsIn, setRowsIn] = useState(still)
  /* How many rows have left, and how many have arrived. Two counters and not one
     because a row is in the air between them, and the row reads its position off
     the first and its colour off the second: it turns into an account when it
     lands, not when it sets off. */
  const [sent, setSent] = useState(still ? IMPORT_ROWS.length : 0)
  const [landed, setLanded] = useState(still ? IMPORT_ROWS.length : 0)
  const [fading, setFading] = useState(false)

  const [loop, setLoop] = useState(0)
  const timers = useRef<number[]>([])

  useEffect(() => {
    if (still) return
    timers.current.forEach(t => window.clearTimeout(t))
    timers.current = []
    const at = (ms: number, fn: () => void) => {
      timers.current.push(window.setTimeout(fn, ms))
    }
    setChars(0)
    setPanelsIn(false)
    setRowsIn(false)
    setSent(0)
    setLanded(0)
    setFading(false)

    let t = 220

    /* 1 · The name types itself. */
    for (let i = 1; i <= WORDMARK.length; i++) {
      const n = i
      at(t, () => setChars(n))
      t += WORDMARK[i - 1] === ' ' ? 120 : 68
    }

    /* 2 · The two places arrive empty, and then the file fills. Empty first, so
           the chart is somewhere the rows are going rather than somewhere they
           turn out to have gone. */
    t += 200
    at(t, () => setPanelsIn(true))
    t += 380
    at(t, () => setRowsIn(true))
    t += 640

    /* 3 · The rows cross, top to bottom. */
    IMPORT_ROWS.forEach((_, i) => {
      at(t, () => setSent(i + 1))
      at(t + FLIGHT_MS, () => setLanded(i + 1))
      t += LAUNCH_MS
    })
    t += FLIGHT_MS - LAUNCH_MS

    /* 4 · Hold on the filled chart, then clear and go again. */
    t += 1900
    at(t, () => setFading(true))
    t += 900
    at(t, () => setLoop(n => n + 1))

    return () => {
      timers.current.forEach(x => window.clearTimeout(x))
      timers.current = []
    }
  }, [loop, still])

  const done = landed >= IMPORT_ROWS.length

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 2,
        pointerEvents: 'none',
        opacity: fading ? 0 : 1,
        transition: 'opacity .55s ease',
      }}
    >
      <HeroWordmark text={WORDMARK} chars={chars} still={still} />

      <ImportPanel left={FILE_L} caption="Your file" icon={FileSpreadsheet} lit={false} show={panelsIn} />
      <ImportPanel left={CHART_L} caption="Your chart" icon={ListTree} lit={done} show={panelsIn} />

      {/* The rows. One transition on the position and one on the fill, so a row
          crossing and a row becoming an account are the same object changing
          rather than two objects being swapped. */}
      {IMPORT_ROWS.map((row, i) => {
        const gone = i < sent
        const tone = i < landed ? CHART_ROW : FILE_ROW
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: (gone ? CHART_L : FILE_L) + PANEL_PAD,
              top: rowTop(i),
              width: ROW_W,
              height: ROW_H,
              borderRadius: 4,
              border: `1px solid ${tone.borderColor}`,
              background: tone.background,
              color: tone.color,
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '0 5px',
              fontSize: 8,
              fontWeight: 650,
              letterSpacing: '0.01em',
              fontVariantNumeric: 'tabular-nums',
              opacity: rowsIn ? 1 : 0,
              /* Lifted off the panels while it is in the air, and set back down
                 on arrival, so the crossing happens over the picture rather than
                 through it. */
              boxShadow: gone && i >= landed ? '0 5px 12px -3px rgba(2, 6, 23, 0.85)' : 'none',
              animation:
                still || !rowsIn
                  ? undefined
                  : `coaChipDrop .3s cubic-bezier(.16,1,.3,1) ${i * 70}ms backwards`,
              /* The crossing is only a transition while the rows are shown. The
                 loop resets them to the file in the same commit that hides them,
                 and without this they would glide back across the hero, which is
                 an import running in reverse. */
              transition: [
                rowsIn ? `left ${FLIGHT_MS}ms cubic-bezier(.5,0,.2,1)` : 'left 0s',
                'background-color .34s ease',
                'border-color .34s ease',
                'color .34s ease',
                'opacity .3s ease',
                'box-shadow .3s ease',
              ].join(', '),
              zIndex: 6,
            }}
          >
            <span>{row.no}</span>
            <span
              style={{
                height: 3,
                width: row.bar,
                borderRadius: 2,
                background: tone.bar,
                transition: 'background-color .34s ease',
              }}
            />
          </div>
        )
      })}

      {/* The one beat of punctuation: the chart is full. */}
      {done && (
        <div
          style={{
            position: 'absolute',
            left: CHART_L + PANEL_W - 9,
            top: PANEL_Y - 9,
            width: 18,
            height: 18,
            borderRadius: 9,
            background: '#2563EB',
            border: '1px solid rgba(147, 197, 253, 0.85)',
            boxShadow: '0 2px 8px rgba(2, 6, 23, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: still ? undefined : 'coaChipDrop .34s cubic-bezier(.16,1,.3,1) both',
            zIndex: 8,
          }}
        >
          <Check style={{ width: 11, height: 11, color: '#FFFFFF' }} strokeWidth={3} />
        </div>
      )}
    </div>
  )
}

/* ──────── The slide ────────
 * Its own scrim rather than the overlay's dim, because there is nothing to
 * spotlight yet: the tour has not started, so the wizard behind it is context
 * and not the subject. The panel's anatomy is the reference's, hero, greeting,
 * two stacked choices, and the greeting is two lines on purpose.
 */
export function WalkthroughWelcome({ onStart, onSkip }: {
  onStart: () => void
  onSkip: () => void
}) {
  return (
    <WalkthroughWelcomeShell
      label="Import accounts walkthrough"
      hero={<ImportHeroAnimation />}
      guard={IMPORT_GUARD}
      greeting={<>Welcome To Import Accounts,<br />Let&apos;s Bring In Your Chart Together.</>}
      onStart={onStart}
      onSkip={onSkip}
    />
  )
}

/* Everything about the slide except the one drawing inside the hero, which is
   the only part that is about a particular wizard. Shared rather than copied,
   because two doors into the same product that both mean "you have not been here
   before" have to be the same object down to the shadow. */
export function WalkthroughWelcomeShell({ label, hero, greeting, subline, startLabel = 'Start The Walkthrough', skipLabel = 'Skip For Now', guard, onStart, onSkip }: {
  label: string
  /* Drawn on the slate, over the grid and the vignette. Positioned in hero
     coordinates, so it is written against `HERO_W` and `HERO_H`. */
  hero: ReactNode
  /* Two lines, on purpose: one line reads as a page title and the second is
     where the panel says what it is about to do. */
  greeting: ReactNode
  /* A line under the heading saying what the tour is about, for a slide whose
     heading is a title rather than two lines (the Build from scratch tours,
     2026-10-02). */
  subline?: ReactNode
  /* The two buttons. The import's tour keeps its own wording; the Build from
     scratch tours pass the sentence-case pair their copy names. */
  startLabel?: string
  skipLabel?: string
  /* Where the hero's drawing sits, so the grid behind it never lights a cell
     under the mock. Hero coordinates. */
  guard?: Guard
  onStart: () => void
  onSkip: () => void
}) {
  injectWelcomeStyles()

  return (
    <div
      data-wizard-overlay=""
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 192,
        background: 'rgba(15, 23, 42, 0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'coaWelcomeFade .18s ease-out',
      }}
      onPointerDown={e => e.preventDefault()}
    >
      <div
        role="dialog"
        aria-modal="false"
        aria-label={label}
        style={{
          width: HERO_W,
          maxWidth: 'calc(100vw - 32px)',
          background: '#FFFFFF',
          borderRadius: 14,
          border: '1px solid #E2E8F0',
          boxShadow: [
            '0 24px 48px -12px rgba(15, 23, 42, 0.34)',
            '0 8px 20px rgba(10, 124, 255, 0.10)',
          ].join(', '),
          overflow: 'hidden',
          animation: 'coaWelcomeRise .3s cubic-bezier(.16,1,.3,1)',
        }}
      >
        {/* Hero - the grid, the vignette that feathers it into the slate, and the
            number being taken apart on top of both. */}
        <div style={{ position: 'relative', height: HERO_H, background: '#0F172A', overflow: 'hidden' }}>
          <BoxesBackground guard={guard} />
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: 0,
              background: '#0F172A',
              WebkitMaskImage: 'radial-gradient(transparent 30%, white 78%)',
              maskImage: 'radial-gradient(transparent 30%, white 78%)',
              pointerEvents: 'none',
              zIndex: 1,
            }}
          />
          {hero}
        </div>

        {/* Greeting and the two choices. */}
        <div
          style={{
            padding: '30px 28px 34px',
            textAlign: 'center',
            background: 'linear-gradient(180deg, #EFF6FF 0%, #FFFFFF 100%)',
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 20,
              fontWeight: 600,
              color: '#0F172A',
              letterSpacing: '-0.012em',
              lineHeight: 1.34,
            }}
          >
            {greeting}
          </h2>
          {subline && (
            <p style={{ margin: '8px 0 0', fontSize: 13.5, lineHeight: 1.5, color: '#475569' }}>{subline}</p>
          )}

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              marginTop: 22,
              width: '70%',
              marginLeft: 'auto',
              marginRight: 'auto',
            }}
          >
            <button
              type="button"
              onClick={onStart}
              className="inline-flex items-center justify-center rounded-[9px] bg-[#0A7CFF] text-white hover:bg-[#0369D9] transition-colors cursor-pointer"
              style={{
                height: 40,
                gap: 6,
                fontSize: 13,
                fontWeight: 600,
                boxShadow: '0 1px 2px rgba(10,124,255,0.28)',
              }}
            >
              {startLabel}
              <ChevronRight style={{ width: 15, height: 15 }} />
            </button>
            <button
              type="button"
              onClick={onSkip}
              className="inline-flex items-center justify-center rounded-[9px] border border-[#E2E8F0] bg-white text-[#475569] hover:bg-[#F8FAFC] hover:border-[#CBD5E1] transition-colors cursor-pointer"
              /* The secondary lifts off the panel like the primary does. Without a
                 shadow it reads as a bordered area rather than as the other button,
                 next to a filled blue one carrying its own. */
              style={{
                height: 40,
                fontSize: 13,
                fontWeight: 500,
                boxShadow: '0 1px 2px rgba(15, 23, 42, 0.07)',
              }}
            >
              {skipLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
