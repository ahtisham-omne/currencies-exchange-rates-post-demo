import type { ReactNode } from 'react'
import { Quoted } from '../components/ui'

/* What the Dimensions column means, for the (i) in its header.

   This is the one column explanation that has to show its example rather than
   state it. "Dimensions are segments of an account number" is a sentence about
   a shape, and a reader who has not met a segmented chart cannot picture the
   shape from the sentence - they have to see which piece of 01-100-5020 is
   which. So the card carries the worked example, and the parts of it live here
   as data rather than as a paragraph, because the number and its readings have
   to line up with each other on the screen. */

export const DIMENSIONS_HELP_INTRO =
  'Dimensions are segments of an account number that you can use to group and filter accounts by specific values.'

/* The same number the import reading room teaches this on, deliberately: a
   reader who met dimensions during an import should not have to re-learn them
   from a second example here. Pinned in dimensionsCopy.test.ts. */
export const DIMENSIONS_EXAMPLE_NUMBER = '01-100-5020'

// In number order, so the example reads left to right the way the number does.
export const DIMENSIONS_EXAMPLE: { code: string; dimension: string; value?: string }[] = [
  { code: '01', dimension: 'Location', value: 'London' },
  { code: '100', dimension: 'Department', value: 'Marketing' },
  // No value: the account number is the account itself, not something the
  // account is cut by.
  { code: '5020', dimension: 'GL account number' },
]

export const DIMENSIONS_HELP_FILTERING =
  'This lets you filter accounts using a dimension value, e.g. Location → London or Department → Marketing.'

const Strong = ({ children }: { children: ReactNode }) => (
  <span className="text-fg" style={{ fontWeight: 600 }}>{children}</span>
)

/* Carries its own card chrome, matching GLTypeLegend: a rich Tooltip supplies
   only the white card and shadow. Callers must pass `rich`. */
export function DimensionsHelp() {
  return (
    <div className="w-[320px] p-3.5">
      <p className="text-11 text-fg-muted leading-relaxed">{DIMENSIONS_HELP_INTRO}</p>
      <p className="mt-2 text-11 text-fg-muted leading-relaxed">
        For example, if an account number is <Quoted>{DIMENSIONS_EXAMPLE_NUMBER}</Quoted>:
      </p>
      {/* The codes are set in a column of their own so the eye can run down the
          pieces of the number without reading the sentences beside them. */}
      <ul className="mt-2 rounded-lg border border-border bg-bg-subtle/50 px-3 py-2.5 space-y-2">
        {DIMENSIONS_EXAMPLE.map(row => (
          <li key={row.code} className="flex gap-2 text-11 text-fg-muted leading-relaxed">
            {/* Fixed width, or the three readings start at three different
                x positions and the column stops being a column. */}
            <span className="shrink-0 min-w-[42px]"><Quoted>{row.code}</Quoted></span>
            <span>
              can be the{' '}
              {row.value
                ? <>
                    <Strong>{row.dimension}</Strong> dimension, with a value like{' '}
                    <Strong>{row.value}</Strong>
                  </>
                : <Strong>{row.dimension}</Strong>}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-11 text-fg-muted leading-relaxed">
        This lets you filter accounts using a dimension value, e.g.{' '}
        <Strong>Location {'→'} London</Strong> or <Strong>Department {'→'} Marketing</Strong>.
      </p>
    </div>
  )
}
