import type { ReactNode } from 'react'
import { Quoted } from '../components/ui'
import type { ReadingRoomConfig, ReadingRoomSection } from '../components/walkthrough/ReadingRoom'

/* ──────────────────────────────────────────────────────────────────
 * WHAT THE DIMENSIONS READING ROOMS SAY
 *
 * Two surfaces explain dimensions at length and they share most of their
 * answer, so both configs are built here from the same sections.
 *
 * The build-from-scratch step is the only place a customer building a chart
 * from nothing meets the idea, and it arrives with an empty editor and no
 * example on screen to infer it from. The step itself asks the question in one
 * line; this is the long answer, in the order someone works it out: what the
 * thing is, what it does for them once it exists, and that they need not have
 * one.
 *
 * The Dimensions page is met later, by someone who already has a chart. It
 * takes the same two answers and swaps the skippable-step note for where a
 * dimension comes from when the numbers arrived segmented, because that is the
 * question the page's own copy raises and cannot finish.
 *
 * Copy and nothing else, like `importReadingRoom.tsx`. The panel that renders
 * it is `components/walkthrough/ReadingRoom.tsx`; a component declared beside
 * these configs would cost the module its fast refresh.
 *
 * ──── COPY ────
 * Sentence case, no em dashes, third person. The noun for the thing is
 * "dimension" throughout. "Segment" is used only for the piece of an account
 * number a dimension can be read out of, never as a second word for the
 * dimension itself.
 * ────────────────────────────────────────────────────────────────── */

function P({ children }: { children: ReactNode }) {
  return <p className="mb-2 last:mb-0">{children}</p>
}

/* Whiter and harder-edged than the section card around it, so a worked example
   reads as a specimen rather than as more prose. */
function Example({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={'rounded-lg border border-border bg-white/70 px-3 py-2.5 my-2.5 text-13 tabular-nums ' + (className ?? '')}
    >
      {children}
    </div>
  )
}

/* Mahad's copy of 2026-10-02 (Build from scratch UX copy), verbatim. Shared
   with the Dimensions page's guide. */
const WHAT_A_DIMENSION_IS: ReadingRoomSection = {
  title: 'What a dimension is',
  body: (
    <>
      <P>
        A dimension is something your company wants to organize or filter accounts by, such as the
        location an account belongs to or the department that uses it. You name the dimension, then
        add the values inside it.
      </P>
      <Example className="space-y-2">
        {[
          ['Location', 'USA, Hong Kong, Singapore, United Kingdom'],
          ['Department', 'Business, Design, Engineering, Sales, Operations'],
        ].map(([name, values]) => (
          <div key={name} className="flex items-baseline gap-3">
            <span className="w-[86px] shrink-0 text-fg" style={{ fontWeight: 600 }}>{name}</span>
            <span className="min-w-0 text-slate-700">{values}</span>
          </div>
        ))}
      </Example>
    </>
  ),
}

/* Mahad's copy of 2026-10-08 (how-dimensions-work.md), verbatim, in every
   dimensions guide: both setups and the Dimensions page. */
const HOW_YOU_USE_THEM: ReadingRoomSection = {
  title: 'How dimensions work',
  body: (
    <>
      <P>
        Set up your dimensions and their values here. When you create or edit an account, select one
        or more values for each dimension. If you select more than one, mark one as the default.
      </P>
      <Example className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="text-2xs font-semibold uppercase tracking-[0.06em] text-fg-subtle">
              <th className="pr-4 pb-1.5 font-semibold whitespace-nowrap">GL account no.</th>
              <th className="pr-4 pb-1.5 font-semibold">Name</th>
              <th className="pr-4 pb-1.5 font-semibold">Location</th>
              <th className="pb-1.5 font-semibold">Department</th>
            </tr>
          </thead>
          <tbody className="text-slate-700">
            {[
              ['51090', 'Travel', 'USA (default), Singapore', 'Sales'],
              ['51080', 'Advertising', 'Hong Kong', 'Marketing'],
              ['51060', 'Software', 'USA', 'Engineering'],
            ].map(([no, name, loc, dept]) => (
              <tr key={no} className="border-t border-border/70">
                <td className="pr-4 py-1 text-fg whitespace-nowrap" style={{ fontWeight: 600 }}>{no}</td>
                <td className="pr-4 py-1 whitespace-nowrap">{name}</td>
                {/* The one cell that wraps, so the table fits the panel without scrolling. */}
                <td className="pr-4 py-1">{loc}</td>
                <td className="py-1 whitespace-nowrap">{dept}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Example>
      <P><span className="text-fg" style={{ fontWeight: 600 }}>Filtering</span></P>
      <P>
        Filter Location by Singapore and you see <Quoted>51090</Quoted>. Filter by USA and you see{' '}
        <Quoted>51090</Quoted> and <Quoted>51060</Quoted>.
      </P>
      <P><span className="text-fg" style={{ fontWeight: 600 }}>Posting</span></P>
      <P>
        When you use <Quoted>51090 Travel</Quoted> in a journal entry, the line fills in with USA and
        Sales. USA is the default location, and you can switch it to Singapore on that line.
      </P>
    </>
  ),
}

const STEP_IS_OPTIONAL: ReadingRoomSection = {
  title: 'This step is optional',
  body: (
    <P>
      You don&apos;t have to create dimensions. If you skip this step, your accounts are created
      without them. You can add a dimension later from the chart of accounts listing.
    </P>
  ),
}

/* The wizard's, where the step can be walked past. */
export const DIMENSIONS_READING_ROOM: ReadingRoomConfig = {
  title: 'Dimensions in Omne',
  sections: [
    WHAT_A_DIMENSION_IS,
    HOW_YOU_USE_THEM,
    STEP_IS_OPTIONAL,
  ],
}

/* The page's: the same guide as the setups' (Mahad, 2026-10-08: *"Make it the
   same as it is in build from scratch and guided setup"*), without the one
   section about walking past a step the page doesn't have. */
export const DIMENSIONS_PAGE_READING_ROOM: ReadingRoomConfig = {
  title: DIMENSIONS_READING_ROOM.title,
  sections: DIMENSIONS_READING_ROOM.sections.filter(s => s !== STEP_IS_OPTIONAL),
}
