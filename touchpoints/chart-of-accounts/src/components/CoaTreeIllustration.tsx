import { CSSProperties } from 'react'

// Animated chart-of-accounts tree shown in the guided wizard's orientation step.
// Fluidly scales to its container width via viewBox + preserveAspectRatio; the
// host sets the 200px height. Entirely neutral-toned (greys only) and drawn
// from existing tokens (fg, background, bg-muted, fg-muted, border, border-strong).
//
// Motion:
//   • Connectors are right-angled elbows that GROW from parent to child.
//   • Each child pill fades in only once its incoming connector has formed.
//   • After a connector forms, it becomes a dashed line whose dashes march
//     leftward continuously; the root pill breathes opacity 0.85 ↔ 0.45.
//   • prefers-reduced-motion → settled state, all opacity 1, no motion.

const TYPES: { label: string; leaves: string[] }[] = [
  { label: 'Assets', leaves: ['Cash', 'Receivables'] },
  { label: 'Liabilities', leaves: ['Payables'] },
  { label: 'Equity', leaves: ['Capital'] },
  { label: 'Revenue', leaves: ['Sales'] },
  { label: 'Expenses', leaves: ['Rent', 'Payroll'] },
]

const TYPE_CENTERS = [100, 250, 400, 550, 700]
const ROOT = { cx: 400, y: 26, w: 150, h: 34 }
const TYPE = { y: 200, h: 32, w: 108 }
const LEAF = { y: 380, h: 28, w: 70 }
const leafOffsets = (n: number) => (n === 1 ? [0] : [-38, 38])

// Right-angled elbow: down to the mid-Y, across, then down to the child.
const elbow = (x1: number, y1: number, x2: number, y2: number) => {
  const midY = (y1 + y2) / 2
  return `M ${x1} ${y1} V ${midY} H ${x2} V ${y2}`
}

const d = (seconds: number): CSSProperties => ({ ['--d' as string]: `${seconds}s` } as CSSProperties)

// Entrance timing (seconds)
const typeGrow = (i: number) => 0.4 + i * 0.12
const typePill = (i: number) => typeGrow(i) + 0.55
const leafGrow = (i: number, j: number) => 1.2 + i * 0.12 + j * 0.06
const leafPill = (i: number, j: number) => leafGrow(i, j) + 0.55

const CSS = `
/* Grower: a solid stroke revealed via dashoffset (pathLength normalized to 1),
   then faded out as the dashed marcher takes its place. */
.coatree-grow {
  animation: coatreeGrow .5s ease-out var(--d, 0s) both,
             coatreeGrowOut .3s ease-out calc(var(--d, 0s) + .5s) forwards;
}
.coatree-march {
  opacity: 0;
  animation: coatreeFadeIn .3s ease-out calc(var(--d, 0s) + .5s) forwards,
             coatreeMarch 5s linear calc(var(--d, 0s) + .8s) infinite;
}
.coatree-fade { opacity: 0; animation: coatreeFadeIn .4s ease-out var(--d, 0s) forwards; }
.coatree-root { opacity: 0; animation: coatreeFadeIn .5s ease-out forwards, coatreeRootPulse 2.2s ease-in-out .7s infinite; }

@keyframes coatreeGrow { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } }
@keyframes coatreeGrowOut { to { opacity: 0; } }
@keyframes coatreeFadeIn { to { opacity: 1; } }
@keyframes coatreeMarch { from { stroke-dashoffset: 0; } to { stroke-dashoffset: -52; } }
@keyframes coatreeRootPulse { 0%, 100% { opacity: .85; } 50% { opacity: .45; } }

@media (prefers-reduced-motion: reduce) {
  .coatree-grow { opacity: 0 !important; animation: none !important; }
  .coatree-march { opacity: 1 !important; animation: none !important; stroke-dashoffset: 0 !important; }
  .coatree-fade, .coatree-root { opacity: 1 !important; animation: none !important; }
}
`

function Connector({ d: path, delay }: { d: string; delay: number }) {
  return (
    <g>
      <path className="coatree-grow stroke-border-strong" style={d(delay)} d={path}
        pathLength={1} strokeDasharray={1} strokeDashoffset={1}
        fill="none" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <path className="coatree-march stroke-border-strong" style={d(delay)} d={path}
        fill="none" strokeWidth={1.5} strokeDasharray="4 9" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  )
}

function Pill({ cx, y, w, h, label, rectClass, textClass, fontSize, weight, className, style }: {
  cx: number; y: number; w: number; h: number; label: string
  rectClass: string; textClass: string; fontSize: number; weight: number
  className: string; style?: CSSProperties
}) {
  return (
    <g className={className} style={style}>
      <rect x={cx - w / 2} y={y} width={w} height={h} rx={h / 2} className={rectClass} strokeWidth={1} />
      <text x={cx} y={y + h / 2 + 0.5} textAnchor="middle" dominantBaseline="middle" fontSize={fontSize} fontWeight={weight} className={textClass}>{label}</text>
    </g>
  )
}

export function CoaTreeIllustration() {
  return (
    <div className="w-full min-h-[440px] flex items-center justify-center" aria-hidden="true">
      <svg viewBox="0 0 800 440" preserveAspectRatio="xMidYMid meet" width="100%" style={{ height: 'auto' }} role="img" aria-label="Diagram of a chart of accounts as a branching tree">
        <style dangerouslySetInnerHTML={{ __html: CSS }} />

        {/* Connectors: root → type pills */}
        {TYPE_CENTERS.map((cx, i) => (
          <Connector key={`tl-${i}`} d={elbow(ROOT.cx, ROOT.y + ROOT.h, cx, TYPE.y)} delay={typeGrow(i)} />
        ))}

        {/* Connectors: type pills → leaves */}
        {TYPES.map((t, i) => {
          const cx = TYPE_CENTERS[i]
          return leafOffsets(t.leaves.length).map((off, j) => (
            <Connector key={`ll-${i}-${j}`} d={elbow(cx, TYPE.y + TYPE.h, cx + off, LEAF.y)} delay={leafGrow(i, j)} />
          ))
        })}

        {/* Root pill (white fill, outlined) */}
        <Pill cx={ROOT.cx} y={ROOT.y} w={ROOT.w} h={ROOT.h} label="Your business"
          rectClass="fill-white stroke-border-strong" textClass="fill-fg" fontSize={14} weight={600}
          className="coatree-root" />

        {/* Type pills (outlined neutral) */}
        {TYPES.map((t, i) => (
          <Pill key={`tp-${i}`} cx={TYPE_CENTERS[i]} y={TYPE.y} w={TYPE.w} h={TYPE.h} label={t.label}
            rectClass="fill-background stroke-border-strong" textClass="fill-fg" fontSize={13} weight={600}
            className="coatree-fade" style={d(typePill(i))} />
        ))}

        {/* Leaf pills (muted grey) */}
        {TYPES.map((t, i) => {
          const cx = TYPE_CENTERS[i]
          const offs = leafOffsets(t.leaves.length)
          return t.leaves.map((leaf, j) => (
            <Pill key={`lp-${i}-${j}`} cx={cx + offs[j]} y={LEAF.y} w={LEAF.w} h={LEAF.h} label={leaf}
              rectClass="fill-bg-muted stroke-border" textClass="fill-fg-muted" fontSize={11} weight={500}
              className="coatree-fade" style={d(leafPill(i, j))} />
          ))
        })}
      </svg>
    </div>
  )
}
