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
import { DIMENSIONS_LABEL } from './dimensionsCards'

/* ──────────────────────────────────────────────────────────────────
 * THE DIMENSIONS WALKTHROUGH'S DOOR
 *
 * The same panel as the import's, because two surfaces in the same product that
 * both mean "you have not been here before" have to be the same object. Only the
 * thing inside the hero differs, and it differs for the reason the reference
 * module gives for drawing anything: the step behind this slide is empty, so
 * there is nothing on screen to read the idea off.
 *
 * ──── WHAT IT DRAWS ────
 * The claim, in one gesture. An account arrives on its own, and then somebody
 * tags it: USA under Location, Sales under Department. That is the whole of what
 * a dimension is, and it is drawn in the same two tones the import hero uses,
 * so blue still means the account and purple still means a filter wherever the
 * reader meets them next.
 *
 * The colours, the cursor, the click and the panel are all imported rather than
 * restated. Anything that is here is here because it is about dimensions.
 * ────────────────────────────────────────────────────────────────── */

const WORDMARK = 'DIMENSIONS'

/* ──────── Hero geometry ────────
 * Arithmetic off the account chip, so nothing is measured and the choreography
 * cannot drift out of step with the layout on a re-render. */
const CHIP_Y = 76
const CHIP_H = 34
const ACC_W = 132
const TAG_H = 26
const TAG_W = [54, 62]
const GAP = 12

const ROW_W = ACC_W + GAP + TAG_W[0] + GAP + TAG_W[1]
const ROW_L = Math.round((HERO_W - ROW_W) / 2)
/* Where the account sits before it has been tagged: centred, alone. It glides to
   its place in the row when the first tag lands, so the row assembles around a
   thing the reader has already been looking at. */
const SOLO_L = Math.round((HERO_W - ACC_W) / 2)
const TAG_L = [ROW_L + ACC_W + GAP, ROW_L + ACC_W + GAP + TAG_W[0] + GAP]

const CHIP_CY = CHIP_Y + CHIP_H / 2
const TAG_Y = CHIP_Y + (CHIP_H - TAG_H) / 2
const LABEL_Y = CHIP_Y + CHIP_H + 13
const tagCX = (i: number) => TAG_L[i] + TAG_W[i] / 2

const WORD_Y = 26

/* The account, and the two things it gets tagged with. The same worked example
   the Learn panel and the second card both use, so the reader meets one account
   three times rather than three accounts once. */
const ACCOUNT = { no: '51090', name: 'Travel' }
const TAGS = [
  { value: 'USA', filter: 'Location' },
  { value: 'Sales', filter: 'Department' },
]

/* Hero coordinates the background grid may not light a cell inside: the wordmark
   line, the row at its widest, and the labels under it, plus a little air. */
const GUARD: Guard = { x0: 110, x1: 410, y0: 14, y1: 142 }

function TagChip({ index, show }: { index: number; show: boolean }) {
  const tone = FILLS.filter
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: TAG_L[index],
          top: TAG_Y,
          width: TAG_W[index],
          height: TAG_H,
          borderRadius: 6,
          border: `1px ${tone.borderStyle} ${tone.borderColor}`,
          background: tone.background,
          color: tone.color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: '0.01em',
          opacity: show ? 1 : 0,
          transform: show ? 'scale(1)' : 'scale(.72)',
          transition: 'opacity .28s ease, transform .34s cubic-bezier(.16,1,.3,1)',
          zIndex: 5,
        }}
      >
        {TAGS[index].value}
      </div>
      {show && (
        <div
          style={{
            position: 'absolute',
            left: TAG_L[index] - 12,
            top: LABEL_Y,
            width: TAG_W[index] + 24,
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
          {TAGS[index].filter}
        </div>
      )}
    </>
  )
}

/* ──────── The choreography ────────
 * A list of `setTimeout`s built once per loop and torn down whole, like the
 * import hero's. Nothing in here reads state to decide when the next cue fires,
 * so a re-render cannot desynchronise it. Under `prefers-reduced-motion` the
 * clock never runs and the hero renders its last frame.
 */
function TaggingHeroAnimation() {
  const still = reducedMotion()

  const [chars, setChars] = useState(still ? WORDMARK.length : 0)
  const [accountIn, setAccountIn] = useState(still)
  /* How many tags have landed. One counter drives both chips, both labels and
     the account's own position, so the row can only ever be in one state. */
  const [tagged, setTagged] = useState(still ? TAGS.length : 0)
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
    setChars(0)
    setAccountIn(false)
    setTagged(0)
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

    /* 2 · One account arrives, untagged and on its own. */
    t += 200
    at(t, () => setAccountIn(true))
    t += 560

    /* 3 · The cursor arrives and tags it, left to right. The account slides into
           its place in the row on the first click, so the row is built rather
           than laid out. */
    at(t, () => {
      setCursorDur(40)
      setCursorVis(true)
    })
    at(t + 60, () => {
      setCursorDur(660)
      setCursor({ x: tagCX(0) - 1, y: CHIP_CY - 1 })
    })
    t += 820

    TAGS.forEach((_, i) => {
      if (i > 0) {
        at(t, () => {
          setCursorDur(460)
          setCursor({ x: tagCX(i) - 1, y: CHIP_CY - 1 })
        })
        t += 540
      }
      at(t, () => {
        setPressing(true)
        setRipple({ x: tagCX(i), y: CHIP_CY, k: t })
      })
      at(t + 170, () => setPressing(false))
      at(t + 90, () => setTagged(i + 1))
      t += 680
    })

    /* 4 · Hold on the tagged account, then clear and go again. */
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

  const acc = FILLS.account

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

      {/* The account. One transition on the position, so the move to make room
          for the first tag is the same object shifting rather than a swap. */}
      <div
        style={{
          position: 'absolute',
          left: tagged > 0 ? ROW_L : SOLO_L,
          top: CHIP_Y,
          width: ACC_W,
          height: CHIP_H,
          borderRadius: 7,
          border: `1px ${acc.borderStyle} ${acc.borderColor}`,
          background: acc.background,
          color: acc.color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          fontSize: 13,
          fontWeight: 600,
          fontVariantNumeric: 'tabular-nums',
          opacity: accountIn ? 1 : 0,
          transform: accountIn ? 'scale(1)' : 'scale(.72)',
          transition: 'left .46s cubic-bezier(.16,1,.3,1), opacity .28s ease, transform .34s cubic-bezier(.16,1,.3,1)',
          zIndex: 5,
        }}
      >
        <span>{ACCOUNT.no}</span>
        <span style={{ fontWeight: 500, opacity: 0.88 }}>{ACCOUNT.name}</span>
      </div>

      {TAGS.map((_, i) => (
        <TagChip key={i} index={i} show={i < tagged} />
      ))}

      <HeroClick ripple={ripple} />
      <HeroCursor x={cursor.x} y={cursor.y} visible={cursorVis} pressing={pressing} dur={cursorDur} />
    </div>
  )
}

export function DimensionsWelcome({ onStart, onSkip }: {
  onStart: () => void
  onSkip: () => void
}) {
  return (
    <WalkthroughWelcomeShell
      label={DIMENSIONS_LABEL}
      hero={<TaggingHeroAnimation />}
      guard={GUARD}
      greeting="Welcome to dimensions"
      subline="Choose how you want to sort and filter your accounts."
      startLabel="Start walkthrough"
      skipLabel="Skip for now"
      onStart={onStart}
      onSkip={onSkip}
    />
  )
}
