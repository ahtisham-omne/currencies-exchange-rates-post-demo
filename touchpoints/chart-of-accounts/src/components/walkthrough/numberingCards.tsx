import { Hash, Rows3, Pencil, BookOpen, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import type { WalkthroughCard } from './walkthroughCards'

/* ──────────────────────────────────────────────────────────────────
 * THE ACCOUNT NUMBERS WALKTHROUGH'S CARDS
 *
 * Four cards over the Number length step, the first step of Build from scratch
 * and of Guided setup. Offered once a session, the first time the step is
 * reached, and again from the bottom of How it works - as the dimensions and
 * chart tours are on theirs. Design review, 2026-10-02 - Eli: every step should
 * have its own introduction, skippable, and the first one had none. Guided
 * setup has it too: *"Think about who goes through a guided setup. Somebody who
 * doesn't know."*
 *
 * The long answers - why numbers are reserved, steps of ten, ranges on
 * summaries - are in How it works, which the last card points to.
 *
 * Mahad's copy, written for Guided setup on 2026-10-07 and given to Build from
 * scratch too on 2026-10-08: one set of words for the one step both share.
 * ────────────────────────────────────────────────────────────────── */

const T = ({ children }: { children: ReactNode }) => (
  <b style={{ color: '#0F172A', fontWeight: 600 }}>{children}</b>
)

/** The only step this tour runs on. */
export type NumberingStep = 'numbering'

/** The `data-walkthrough` keys the step wears. */
export type NumberingAnchor = 'numbering-length' | 'numbering-ranges' | 'numbering-edit' | 'wizard-learn'

export const NUMBERING_LABEL = 'Account numbers walkthrough'

interface Card extends WalkthroughCard<NumberingStep> {
  anchor: NumberingAnchor | null
  icon: LucideIcon
}

export const NUMBERING_CARDS: Card[] = [
  {
    id: 'nu-length',
    eyebrow: '',
    // Mahad's copy, 2026-10-08.
    title: 'Default account number length',
    lead: 'Choose how many digits your GL account numbers usually have. Omne uses this length to suggest a number each time you add a GL account. Most businesses use 5, which leaves room to add accounts later.',
    points: [],
    icon: Hash,
    anchor: 'numbering-length',
    prefer: 'below',
    step: 'numbering',
  },
  {
    id: 'nu-ranges',
    eyebrow: '',
    // Mahad's copy, 2026-10-08.
    title: 'Number ranges by category',
    lead: 'Your chart of accounts has five categories: assets, liabilities, equity, revenue, and expenses. Each one gets its own range of numbers, so its accounts stay together.',
    points: [],
    icon: Rows3,
    anchor: 'numbering-ranges',
    prefer: 'above',
    step: 'numbering',
  },
  {
    id: 'nu-edit',
    eyebrow: '',
    title: 'Change a range',
    lead: <>Select <T>Edit ranges</T> to change where a category starts or ends. Ranges can&apos;t overlap, and each one needs at least 100 numbers.</>,
    points: [],
    icon: Pencil,
    anchor: 'numbering-edit',
    prefer: 'left',
    step: 'numbering',
  },
  {
    id: 'nu-learn',
    eyebrow: '',
    title: 'Need help?',
    // Mahad's copy, 2026-10-08.
    lead: <>Open <T>How it works</T> for explanations and examples. You&apos;ll find it on every step.</>,
    points: [],
    icon: BookOpen,
    anchor: 'wizard-learn',
    prefer: 'below',
    step: 'numbering',
  },
]
