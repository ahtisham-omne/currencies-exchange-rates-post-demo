import { useEffect, useRef, useState } from 'react'
import {
  WalkthroughWelcomeShell,
  HeroWordmark,
  FILLS,
  HERO_W,
  reducedMotion,
  type Guard,
} from './walkthroughWelcome'
import { NUMBERING_LABEL } from './numberingCards'

/* ──────────────────────────────────────────────────────────────────
 * THE ACCOUNT NUMBERS WALKTHROUGH'S DOOR
 *
 * The first step of Build from scratch and of Guided setup, and the one step
 * that had no introduction. Design review, 2026-10-02 - Eli, after the
 * dimensions one: *"I'm just wondering why I didn't have some of the same thing
 * for the first page ... each one requires its own thing, or if you want to,
 * you could skip it."*
 *
 * The same panel as the other tours'. The hero draws what the step sets: the
 * five categories arrive one under another, each with the block of numbers it
 * keeps, the chart's own order top to bottom.
 * ────────────────────────────────────────────────────────────────── */

const WORDMARK = 'ACCOUNT NUMBERS'

const CATEGORIES = [
  { name: 'Asset', range: '10000 – 19999', dot: 'rgb(16, 185, 129)' },
  { name: 'Liability', range: '20000 – 29999', dot: 'rgb(245, 158, 11)' },
  { name: 'Equity', range: '30000 – 39999', dot: 'rgb(139, 92, 246)' },
  { name: 'Revenue', range: '40000 – 49999', dot: 'rgb(14, 165, 233)' },
  { name: 'Expense', range: '50000 – 59999', dot: 'rgb(244, 63, 94)' },
]

/* ──────── Hero geometry ──────── */
const NAME_W = 130
const RANGE_W = 150
const GAP = 12
const ROW_H = 22
const ROW_STEP = 27
const TOP = 52
const ROW_L = Math.round((HERO_W - (NAME_W + GAP + RANGE_W)) / 2)

const GUARD: Guard = { x0: 100, x1: 420, y0: 14, y1: TOP + ROW_STEP * CATEGORIES.length + 6 }

function Row({ i, show }: { i: number; show: boolean }) {
  const c = CATEGORIES[i]
  const acc = FILLS.account
  const chip = (left: number, width: number) => ({
    position: 'absolute' as const,
    left,
    top: TOP + i * ROW_STEP,
    width,
    height: ROW_H,
    borderRadius: 6,
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    padding: '0 9px',
    fontSize: 12,
    whiteSpace: 'nowrap' as const,
    opacity: show ? 1 : 0,
    transform: show ? 'translateX(0)' : 'translateX(-8px)',
    transition: 'opacity .28s ease, transform .34s cubic-bezier(.16,1,.3,1)',
    zIndex: 5,
  })
  return (
    <>
      <div style={{ ...chip(ROW_L, NAME_W), color: 'rgba(226, 232, 240, 0.95)', fontWeight: 600 }}>
        <span style={{ width: 7, height: 7, borderRadius: 99, background: c.dot, flexShrink: 0 }} />
        {c.name}
      </div>
      <div
        style={{
          ...chip(ROW_L + NAME_W + GAP, RANGE_W),
          justifyContent: 'center',
          border: `1px ${acc.borderStyle} ${acc.borderColor}`,
          background: acc.background,
          color: acc.color,
          fontWeight: 600,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {c.range}
      </div>
    </>
  )
}

/* ──────── The choreography ────────
 * Built once per loop and torn down whole, like the other heroes. Under
 * `prefers-reduced-motion` the clock never runs and the hero shows its last
 * frame. */
function NumberingHeroAnimation() {
  const still = reducedMotion()
  const [chars, setChars] = useState(still ? WORDMARK.length : 0)
  const [shown, setShown] = useState(still ? CATEGORIES.length : 0)
  const [fading, setFading] = useState(false)
  const [loop, setLoop] = useState(0)
  const timers = useRef<number[]>([])

  useEffect(() => {
    if (still) return
    timers.current.forEach(t => window.clearTimeout(t))
    timers.current = []
    const at = (ms: number, fn: () => void) => { timers.current.push(window.setTimeout(fn, ms)) }
    setChars(0)
    setShown(0)
    setFading(false)

    let t = 220
    for (let i = 1; i <= WORDMARK.length; i++) {
      const n = i
      at(t, () => setChars(n))
      t += WORDMARK[i - 1] === ' ' ? 110 : 58
    }
    t += 260
    for (let i = 1; i <= CATEGORIES.length; i++) {
      const n = i
      at(t, () => setShown(n))
      t += 260
    }
    t += 2400
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
      {CATEGORIES.map((_, i) => <Row key={i} i={i} show={i < shown} />)}
    </div>
  )
}

export function NumberingWelcome({ onStart, onSkip, greeting = 'Welcome to Build from Scratch', subline, label, startLabel = 'Start walkthrough' }: {
  onStart: () => void
  onSkip: () => void
  /* Both setups open on this tour, so it greets the setup as a whole rather
     than the step: Build from scratch by default, Guided setup in its own
     words. No line under the greeting in either (Mahad, 2026-10-08). */
  greeting?: string
  subline?: string
  label?: string
  startLabel?: string
}) {
  return (
    <WalkthroughWelcomeShell
      label={label ?? NUMBERING_LABEL}
      hero={<NumberingHeroAnimation />}
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
