import { useEffect, useRef, useState } from 'react'
import {
  WalkthroughWelcomeShell,
  HeroWordmark,
  HeroCursor,
  HeroClick,
  FILLS,
  HERO_W,
  reducedMotion,
  type Guard,
} from './walkthroughWelcome'
import { CHART_LABEL } from './chartCards'

/* ──────────────────────────────────────────────────────────────────
 * THE CHART OF ACCOUNTS WALKTHROUGH'S DOOR
 *
 * The same panel as the import's and the dimensions', because every surface in
 * this module that means "you have not been here before" is the same object.
 * Only the hero differs, and it draws the tour's two halves in one gesture: a
 * summary arrives, two posting accounts are added under it on the branch lines
 * the table draws, and then each one is checked off. Build, then validate.
 *
 * Blue is an account here as it is in the other two heroes. The tick is the
 * module's green for a step done, the colour the step trail turns.
 * ────────────────────────────────────────────────────────────────── */

const WORDMARK = 'CHART OF ACCOUNTS'

/* ──────── Hero geometry ────────
 * Arithmetic off the summary chip, so nothing is measured. */
const SUM_W = 222
const SUM_H = 30
const SUM_Y = 54
const INDENT = 34
const POST_W = SUM_W - INDENT
const POST_H = 28
const POST_Y = [96, 134]
const BADGE = 18
const BADGE_GAP = 10

const ROW_W = SUM_W + BADGE_GAP + BADGE
const ROW_L = Math.round((HERO_W - ROW_W) / 2)
const TRUNK_X = ROW_L + 14
const POST_L = ROW_L + INDENT
const BADGE_L = ROW_L + SUM_W + BADGE_GAP
const postCY = (i: number) => POST_Y[i] + POST_H / 2
const RISE = 8

/* The worked example the cards quote, so the reader meets one branch three times. */
const SUMMARY = { no: '11000', name: 'Current Assets' }
const POSTINGS = [
  { no: '11100', name: 'Cash' },
  { no: '11200', name: 'Accounts Receivable' },
]

/* The wordmark line, the branch at its widest and its last row, plus air. */
const GUARD: Guard = { x0: 116, x1: 404, y0: 14, y1: 172 }

const LINE = 'rgba(148, 163, 184, 0.55)'

function Chip({ left, top, width, height, no, name, show, strong }: {
  left: number; top: number; width: number; height: number
  no: string; name: string; show: boolean; strong?: boolean
}) {
  const acc = FILLS.account
  return (
    <div
      style={{
        position: 'absolute',
        left, top, width, height,
        borderRadius: 7,
        border: `1px ${acc.borderStyle} ${acc.borderColor}`,
        background: acc.background,
        color: acc.color,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '0 10px',
        fontSize: strong ? 13 : 12,
        fontWeight: 600,
        fontVariantNumeric: 'tabular-nums',
        whiteSpace: 'nowrap',
        opacity: show ? 1 : 0,
        transform: show ? 'translateY(0) scale(1)' : 'translateY(-6px) scale(.9)',
        transition: 'opacity .28s ease, transform .34s cubic-bezier(.16,1,.3,1)',
        zIndex: 5,
      }}
    >
      <span>{no}</span>
      <span style={{ fontWeight: strong ? 600 : 500, opacity: 0.88 }}>{name}</span>
    </div>
  )
}

function Tick({ top, show }: { top: number; show: boolean }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: BADGE_L,
        top,
        width: BADGE,
        height: BADGE,
        borderRadius: 999,
        background: 'rgba(16, 185, 129, 0.92)',
        boxShadow: '0 0 0 3px rgba(16, 185, 129, 0.18)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: show ? 1 : 0,
        transform: show ? 'scale(1)' : 'scale(.4)',
        transition: 'opacity .22s ease, transform .3s cubic-bezier(.34,1.56,.64,1)',
        zIndex: 6,
      }}
    >
      <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
        <path d="M2.5 6.2 5 8.6l4.5-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

/* The trunk under the summary and the elbow into one posting row, as the
   table's own guides draw them. */
function Branch({ index, show }: { index: number; show: boolean }) {
  const cy = postCY(index)
  const top = index === 0 ? SUM_Y + SUM_H + 4 : postCY(index - 1) - RISE
  return (
    <div style={{ opacity: show ? 1 : 0, transition: 'opacity .3s ease' }}>
      <div style={{ position: 'absolute', left: TRUNK_X, top, width: 1, height: cy - RISE - top, background: LINE }} />
      <div
        style={{
          position: 'absolute',
          left: TRUNK_X,
          top: cy - RISE,
          width: INDENT - 14 - 6,
          height: RISE,
          borderLeft: `1px solid ${LINE}`,
          borderBottom: `1px solid ${LINE}`,
          borderBottomLeftRadius: 8,
        }}
      />
    </div>
  )
}

/* ──────── The choreography ────────
 * A list of `setTimeout`s built once per loop and torn down whole, like the
 * other heroes. Under `prefers-reduced-motion` the clock never runs and the
 * hero renders its last frame. */
function ChartHeroAnimation() {
  const still = reducedMotion()

  const [chars, setChars] = useState(still ? WORDMARK.length : 0)
  const [summaryIn, setSummaryIn] = useState(still)
  // How many posting rows have been added, and how many rows have been checked
  // (the summary first, then each posting in turn).
  const [added, setAdded] = useState(still ? POSTINGS.length : 0)
  const [checked, setChecked] = useState(still ? POSTINGS.length + 1 : 0)
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
    const at = (ms: number, fn: () => void) => { timers.current.push(window.setTimeout(fn, ms)) }
    setChars(0)
    setSummaryIn(false)
    setAdded(0)
    setChecked(0)
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
      t += WORDMARK[i - 1] === ' ' ? 110 : 58
    }

    /* 2 · The summary arrives on its own. */
    t += 200
    at(t, () => setSummaryIn(true))
    t += 560

    /* 3 · The cursor adds two posting accounts under it, top to bottom. */
    const spot = (i: number) => ({ x: POST_L + 40, y: postCY(i) })
    at(t, () => { setCursorDur(40); setCursorVis(true) })
    at(t + 60, () => { setCursorDur(660); setCursor(spot(0)) })
    t += 820
    POSTINGS.forEach((_, i) => {
      if (i > 0) {
        at(t, () => { setCursorDur(420); setCursor(spot(i)) })
        t += 500
      }
      at(t, () => { setPressing(true); setRipple({ ...spot(i), k: t }) })
      at(t + 170, () => setPressing(false))
      at(t + 90, () => setAdded(i + 1))
      t += 640
    })

    /* 4 · The cursor leaves, and each row is checked off in turn. */
    at(t, () => { setCursorDur(700); setCursor({ x: 470, y: -40 }) })
    t += 420
    for (let i = 1; i <= POSTINGS.length + 1; i++) {
      const n = i
      at(t, () => setChecked(n))
      t += 300
    }
    at(t, () => setCursorVis(false))

    /* 5 · Hold on the checked branch, then clear and go again. */
    t += 2000
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
      style={{ position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none', opacity: fading ? 0 : 1, transition: 'opacity .55s ease' }}
    >
      <HeroWordmark text={WORDMARK} chars={chars} still={still} />

      <Chip left={ROW_L} top={SUM_Y} width={SUM_W} height={SUM_H} no={SUMMARY.no} name={SUMMARY.name} show={summaryIn} strong />
      <Tick top={SUM_Y + (SUM_H - BADGE) / 2} show={checked >= 1} />

      {POSTINGS.map((p, i) => (
        <div key={p.no}>
          <Branch index={i} show={i < added} />
          <Chip left={POST_L} top={POST_Y[i]} width={POST_W} height={POST_H} no={p.no} name={p.name} show={i < added} />
          <Tick top={POST_Y[i] + (POST_H - BADGE) / 2} show={checked >= i + 2} />
        </div>
      ))}

      <HeroClick ripple={ripple} />
      <HeroCursor x={cursor.x} y={cursor.y} visible={cursorVis} pressing={pressing} dur={cursorDur} />
    </div>
  )
}

export function ChartWelcome({ onStart, onSkip, greeting = "Welcome to your chart of accounts", subline = "Add your accounts here. Omne checks each one as you go.", label, startLabel = 'Start walkthrough' }: {
  onStart: () => void
  onSkip: () => void
  /* Another flow's words over the same hero: Guided setup opens with this tour
     and greets the setup as a whole rather than the step. */
  greeting?: string
  subline?: string
  label?: string
  startLabel?: string
}) {
  return (
    <WalkthroughWelcomeShell
      label={label ?? CHART_LABEL}
      hero={<ChartHeroAnimation />}
      guard={GUARD}
      greeting={greeting}
      subline={subline}
      startLabel={startLabel}
      skipLabel="Skip for now"
      onStart={onStart}
      onSkip={onSkip}
    />
  )
}
