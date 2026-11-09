import { MessageSquareText, Info, ListChecks, BookOpen, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import type { WalkthroughCard } from './walkthroughCards'
import { chartCards, type ChartPath } from './chartCards'

/* ──────────────────────────────────────────────────────────────────
 * GUIDED SETUP'S WALKTHROUGHS
 *
 * Guided setup had its walkthrough taken out on 2026-10-02 (Mahad: *"Please
 * remove the walkthrough experience from the guided setup flow"*) and the
 * design review that same day asked for it back. Eli: *"Why did I get that
 * really nice overview and I don't get it on the guided setup? ... Think about
 * who goes through a guided setup. Somebody who doesn't know. Somebody who
 * doesn't know is the person who you want to inform."*
 *
 * So each of its three screens gets the introduction Build from scratch gives
 * its own: the account numbers tour on the first, these cards on the questions,
 * and the chart tour on Add your accounts - where it also names the + between
 * rows and the row menu's Create account above / below, which Eli found only by
 * accident: *"This hover state is completely lost to me until I accidentally
 * looked at it."* Each ends by pointing at How it works.
 * ────────────────────────────────────────────────────────────────── */

const T = ({ children }: { children: ReactNode }) => (
  <b style={{ color: '#0F172A', fontWeight: 600 }}>{children}</b>
)

export type GuidedQuestionsStep = 'questions'
export type GuidedQuestionsAnchor = 'guided-questions' | 'guided-answer-info' | 'guided-added' | 'wizard-learn'

export const GUIDED_QUESTIONS_LABEL = 'Your business walkthrough'

interface Card extends WalkthroughCard<GuidedQuestionsStep> {
  anchor: GuidedQuestionsAnchor | null
  icon: LucideIcon
}

/* Mahad's copy for guided setup's welcomes and its questions tour, 2026-10-07, verbatim. */

export const GUIDED_NUMBERING_WELCOME = {
  greeting: 'Welcome to guided setup',
}

export const GUIDED_QUESTIONS_WELCOME = {
  greeting: 'Tell us about your business',
  subline: 'Answer a few questions. Each answer adds the accounts your business needs.',
}

export const GUIDED_QUESTION_CARDS: Card[] = [
  {
    id: 'gq-questions',
    eyebrow: '',
    // Mahad's copy, 2026-10-08.
    title: 'Tell us about your business',
    lead: "Each answer adds the accounts your business needs. Skip anything that doesn't apply, except the accounting method.",
    points: [],
    icon: MessageSquareText,
    anchor: 'guided-questions',
    prefer: 'right',
    step: 'questions',
  },
  {
    id: 'gq-info',
    eyebrow: '',
    title: 'See what each answer adds',
    lead: 'Hover over the information icon next to an answer to see which accounts it adds.',
    points: [],
    icon: Info,
    anchor: 'guided-answer-info',
    prefer: 'right',
    step: 'questions',
  },
  {
    id: 'gq-added',
    eyebrow: '',
    // Mahad's copy, 2026-10-08.
    title: 'Your accounts so far',
    lead: 'As you answer, the accounts Omne adds show up here. Your 19 core accounts are listed at the top.',
    points: [],
    icon: ListChecks,
    anchor: 'guided-added',
    prefer: 'left',
    step: 'questions',
  },
  {
    id: 'gq-learn',
    eyebrow: '',
    title: 'Need help?',
    lead: <>Open <T>How it works</T> to learn about accounting methods, legal structures, sales tax, and currencies.</>,
    points: [],
    icon: BookOpen,
    anchor: 'wizard-learn',
    prefer: 'below',
    step: 'questions',
  },
]

/* The chart tour, on the chart guided setup has just built: Build from
   scratch's cards, without the example accounts. This chart is never empty, so
   there is always a real row to point at. */
export const GUIDED_CHART_PATH: ChartPath = { createLabel: 'Publish chart' }
export const GUIDED_CHART_CARDS = chartCards(GUIDED_CHART_PATH).map(c => ({ ...c, demo: undefined }))
