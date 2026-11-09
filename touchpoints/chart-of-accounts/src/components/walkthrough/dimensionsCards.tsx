import { Layers, Plus, SkipForward, Tag, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import type { WalkthroughCard } from './walkthroughCards'

/* ──────────────────────────────────────────────────────────────────
 * THE DIMENSIONS WALKTHROUGH'S CARDS
 *
 * Four cards over the build-from-scratch wizard, offered once per session when
 * the dimensions step is first reached. The step is one editor and one
 * question, so the tour is short: what the thing is, how you make one, what it
 * buys you, and that you need not.
 *
 * ──── WHY THIS STEP GETS A TOUR AT ALL ────
 * The import's tour explains a shape the reader can see in their own numbers.
 * This one explains an idea the reader has never met, on a step that opens
 * empty. There is nothing on screen to read the concept off, which is exactly
 * the case the reference module says a picture is for, and it is why the welcome
 * slide here draws the claim rather than decorating it. See
 * `dimensionsWelcome.tsx`.
 *
 * ──── THE EMPTY STEP ────
 * Two of these cards point at an editor that has nothing in it, so the wizard
 * stands two dimensions in while they are up: a card pointing at an empty box
 * explains the box, not the idea. The import's tour does the same thing at
 * whole-step scale, in `walkthroughExample.tsx`.
 *
 * ──── COPY ────
 * Sentence case, no em dashes, third person, and the noun is "dimension"
 * throughout. Nothing this flow shows says "dimension" out loud.
 * ────────────────────────────────────────────────────────────────── */

/* A specimen, quoted. Tinted rather than italicised, because these are read as
   things on the screen behind the card and not as stressed prose. */
const N = ({ children }: { children: ReactNode }) => (
  <span
    style={{
      background: '#F1F5F9',
      color: '#0F172A',
      borderRadius: 4,
      padding: '1px 5px',
      fontWeight: 600,
      fontVariantNumeric: 'tabular-nums',
      whiteSpace: 'nowrap',
    }}
  >
    {children}
  </span>
)

/* A filter named by way of example. Weight rather than a chip, because these are
   words the reader is about to type, not things already on the screen. */
const B = ({ children }: { children: ReactNode }) => (
  <span style={{ fontWeight: 600 }}>{children}</span>
)

/** The only step this tour runs on. Kept a union so a card cannot name another. */
export type DimensionsStep = 'dimensions'

/** The `data-walkthrough` keys this tour expects the wizard to be wearing. */
export type DimensionsAnchor = 'dimensions' | 'dimensions-add' | 'wizard-footer'

/** The one demo surface: the editor, stood up with two filters in it. */
export const DIMENSIONS_DEMO = 'dimensions'

export const DIMENSIONS_LABEL = 'Dimensions walkthrough'

interface Card extends WalkthroughCard<DimensionsStep> {
  anchor: DimensionsAnchor | null
  icon: LucideIcon
}

/* Mahad's copy of 2026-10-02 (Build from scratch UX copy), each a short
   paragraph under a title, with no eyebrow chip, rewritten plainer and shorter
   on 2026-10-07 at his ask. Four cards: the one that
   pointed at the step trail ("Where you are") was taken out the same day. */
export const DIMENSIONS_CARDS: Card[] = [
  {
    id: 'gf-what',
    eyebrow: '',
    title: 'What a dimension is',
    lead: 'A dimension is a way to sort and filter your accounts, like Location or Department. Each one has its own list of values, such as USA or United Kingdom.',
    points: [],
    icon: Layers,
    anchor: 'dimensions',
    prefer: 'right',
    step: 'dimensions',
    demo: DIMENSIONS_DEMO,
  },
  {
    id: 'gf-add',
    eyebrow: '',
    title: 'Add a dimension',
    lead: 'Name it, then add its values. For example, Location with USA, Singapore and United Kingdom. You need at least one value, and you can add more later.',
    points: [],
    icon: Plus,
    anchor: 'dimensions-add',
    prefer: 'right',
    step: 'dimensions',
    demo: DIMENSIONS_DEMO,
  },
  /* Nothing on this step is the account form, so the card stands centred
     rather than lighting a control it is not about. */
  {
    id: 'gf-values',
    eyebrow: '',
    title: 'Values on an account',
    lead: 'Each account can have one or more values for a dimension. If you give it more than one, choose a default. A journal entry starts with the default, and you can switch a line to the account\'s other values.',
    points: [],
    icon: Tag,
    anchor: null,
    step: 'dimensions',
  },
  {
    id: 'gf-skip',
    eyebrow: '',
    title: 'You can skip this',
    lead: 'Dimensions are optional. Skip this step and your accounts are created without them. You can add them later from the chart of accounts.',
    points: [],
    icon: SkipForward,
    anchor: 'wizard-footer',
    prefer: 'above',
    step: 'dimensions',
  },
]
