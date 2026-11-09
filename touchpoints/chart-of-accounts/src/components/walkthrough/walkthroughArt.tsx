import { useEffect, useRef, useState } from 'react'
import { injectWelcomeStyles, reducedMotion } from './walkthroughWelcome'

/* ──────────────────────────────────────────────────────────────────
 * THE DIAGRAM A CARD DRAWS
 *
 * A card carries a picture in exactly one situation: when the thing it is
 * talking about is not on the screen. The tour spotlights the real control
 * wherever the real control is mounted, because a diagram of a thing you can see
 * is worse than the thing. There is one card in this tour with nothing to point
 * at - the one defining the word "dimension" before the word is used - and this
 * is what it draws instead.
 *
 * It is written against SPECIMEN_PARTS rather than against a fixed count, so how
 * many pieces there are is the example file's to decide. The widths, the two rows
 * of x positions and the box the whole thing sits in all fall out of that array.
 *
 * ──── IT SITS ON THE CARD, NOT IN A WINDOW ────
 * The reference module's diagrams are drawn on a pale panel the width of the
 * card, in the card's own greys, so the picture reads as part of the card rather
 * than as a screen embedded in it. The frame is the overlay's; what is here is
 * the drawing. An earlier pass put this on the welcome slide's dark slate, which
 * made a 331px box compete with the paragraph above it for being the thing on
 * screen.
 *
 * ──── IT PLAYS ONCE AND HOLDS ────
 * Which is the one place this departs from the welcome slide's hero. That hero
 * runs on a loop because it is the only thing on the slide and there is nothing
 * to read yet. This sits under a paragraph somebody is reading, and a picture
 * that restarts every few seconds beside a paragraph competes with the paragraph
 * forever. It assembles once, on arrival, and then stops. Pressing Previous and
 * Next replays it, because the card body is keyed on the card and remounts.
 *
 * ──── WHAT IT REFUSES TO SAY ────
 * Nothing here is coloured in. The hero paints its pieces blue and purple as a
 * cursor answers for them, and the next three cards are what teach those
 * answers. This card only has to land one sentence - the number comes apart, and
 * each piece it comes apart into is a dimension - so every piece stays in the
 * dashed outline the real table gives a dimension nobody has answered for yet,
 * and the only thing written under them is which number they are.
 * ────────────────────────────────────────────────────────────────── */

/** The number the tour quotes, in pieces. Drawn here, quoted by the card that
    defines the word, and written out again by the gate step behind it - one
    const rather than three literals, so the picture, the card and the screen
    under them cannot come to show three different numbers. */
export const SPECIMEN_PARTS = ['01', '100', '5020']

/* ──────── Geometry ────────
 * Written against a fixed box so the card's measured height is right on the
 * first frame: the overlay sizes the card off its content, and a picture that
 * grows as it assembles would have the card growing with it.
 *
 * Sized to fit the card the tour already has rather than widening the card for
 * it. The reference module widens, because its diagram is a month grid beside an
 * arrow beside a stack of chips; this is a short row of boxes, and a tour whose
 * cards change width as well as position is one more thing moving. */
const PART_H = 30
const JOIN_GAP = 11
const SPLIT_GAP = 22
const LABEL_Y = PART_H + 10
const ART_H = LABEL_Y + 11

/* Roomy enough for four digits without measuring text: the pieces are digits in
   a tabular face, so a width per character holds for any specimen. */
const partW = (p: string) => 24 + 11 * p.length

const WIDTHS = SPECIMEN_PARTS.map(partW)
const SUM_W = WIDTHS.reduce((a, b) => a + b, 0)
const GAPS = SPECIMEN_PARTS.length - 1

const SPLIT_SPAN = SUM_W + GAPS * SPLIT_GAP
/* The margin is set by the LABELS, not the pieces: "Dimension 1" is wider than
   the two digits it sits under and overhangs its own piece at both ends. */
const ART_W = SPLIT_SPAN + 38

const runL = (gap: number) => {
  const start = (ART_W - (SUM_W + GAPS * gap)) / 2
  let x = start
  return WIDTHS.map(w => {
    const at = x
    x += w + gap
    return at
  })
}
const JOINED_L = runL(JOIN_GAP)
const SPLIT_L = runL(SPLIT_GAP)

/* ──────── The card's own greys ────────
 * A dimension nobody has answered for is a dashed white badge on the real table,
 * and this is that badge. Named only settles the outline: on a pale panel a
 * border going from hairline to legible is a clear enough beat, and it costs no
 * colour the next three cards are about to need. */
const CHIP = {
  background: '#FFFFFF',
  color: '#0F172A',
  waiting: '#E2E8F0',
  named: '#94A3B8',
  shadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
}
const MUTED = '#94A3B8'

/* ──────── The beats ────────
 * Four, and the whole thing is over inside three seconds, because the reader is
 * looking at the prose above it and a diagram still assembling when they glance
 * down has failed. */
const ARRIVE_MS = 140
const HOLD_WHOLE_MS = 760
const SLIDE_MS = 420
const COUNT_STEP_MS = 140

export function DimensionSplitArt() {
  injectWelcomeStyles()
  const still = reducedMotion()

  const [arrived, setArrived] = useState(still)
  const [split, setSplit] = useState(still)
  /* How many pieces have been named, left to right, which is reading order and
     also the order the real table asks in. One counter drives four labels. */
  const [counted, setCounted] = useState(still ? SPECIMEN_PARTS.length : 0)
  const timers = useRef<number[]>([])

  useEffect(() => {
    if (still) return
    const at = (ms: number, fn: () => void) => {
      timers.current.push(window.setTimeout(fn, ms))
    }

    let t = ARRIVE_MS
    at(t, () => setArrived(true))

    t += HOLD_WHOLE_MS
    at(t, () => setSplit(true))

    t += SLIDE_MS - 80
    SPECIMEN_PARTS.forEach((_, i) => {
      at(t + i * COUNT_STEP_MS, () => setCounted(i + 1))
    })

    return () => {
      timers.current.forEach(x => window.clearTimeout(x))
      timers.current = []
    }
  }, [still])

  return (
    <div aria-hidden="true" style={{ position: 'relative', width: ART_W, height: ART_H }}>
      {/* The hyphens that hold the number together, and go when it comes apart.
          Drawn in the gap rather than inside a piece, so what disappears is the
          joining and not part of any one number. */}
      {SPECIMEN_PARTS.slice(0, -1).map((_, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: JOINED_L[i] + WIDTHS[i],
            top: 0,
            width: JOIN_GAP,
            height: PART_H,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 13,
            fontWeight: 600,
            color: MUTED,
            opacity: arrived && !split ? 1 : 0,
            transition: 'opacity .22s ease',
          }}
        >
          -
        </div>
      ))}

      {/* The pieces. One transition on the position, so the split reads as the
          same four objects being moved rather than as one number being swapped
          for four. */}
      {SPECIMEN_PARTS.map((part, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: split ? SPLIT_L[i] : JOINED_L[i],
            top: 0,
            width: WIDTHS[i],
            height: PART_H,
            borderRadius: 7,
            border: '1px dashed',
            borderColor: i < counted ? CHIP.named : CHIP.waiting,
            background: CHIP.background,
            color: CHIP.color,
            boxShadow: CHIP.shadow,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 13.5,
            fontWeight: 650,
            letterSpacing: '0.01em',
            fontVariantNumeric: 'tabular-nums',
            opacity: arrived ? 1 : 0,
            animation: still || !arrived
              ? undefined
              : `coaChipDrop .3s cubic-bezier(.16,1,.3,1) ${i * 55}ms backwards`,
            transition: `left ${SLIDE_MS}ms cubic-bezier(.16,1,.3,1), border-color .3s ease, opacity .24s ease`,
          }}
        >
          {part}
        </div>
      ))}

      {/* Which number each piece is, and nothing else about it. The real table
          heads its rows the same way, so this is the vocabulary the next two
          cards will use to say which one they are talking about. */}
      {SPECIMEN_PARTS.map((_, i) => (
        i < counted && (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: SPLIT_L[i] + WIDTHS[i] / 2 - 40,
              top: LABEL_Y,
              width: 80,
              textAlign: 'center',
              fontSize: 8,
              fontWeight: 600,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              color: MUTED,
              whiteSpace: 'nowrap',
              animation: still ? undefined : 'coaLabelIn .3s cubic-bezier(.16,1,.3,1) both',
            }}
          >
            Segment {i + 1}
          </div>
        )
      ))}
    </div>
  )
}
