/* The three answers to the dimensions step wear the icons that step's own
   dropdown puts on them, so a card's icon is the icon in the row it lights. */
import { Split, Minus, ListFilter, Ban, Tag, Table2, Download, Upload, HelpCircle, Hash, Info, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { DimensionSplitArt, SPECIMEN_PARTS } from './walkthroughArt'

/* ──────────────────────────────────────────────────────────────────
 * THE IMPORT WALKTHROUGH'S CARDS
 *
 * Cards over the import wizard, offered once per session as the upload step
 * opens. The copy lives here and nowhere else: the overlay renders it, the
 * wizard never restates it.
 *
 * Each one points at a control the reader is about to use. None of them recites
 * the step trail: a list of the four steps says only that there are four, which
 * the trail behind the card already says, and the reader on the upload step has
 * not yet decided whether they are taking those steps at all.
 *
 * ──── A CARD PER ANSWER, WHERE THE ANSWERS ARE THE STEP ────
 * A step whose answers are the decision gets a card each, and each card lights
 * the control that answer is given by: the gate's two answers, the three things
 * a dimension can be, and the three things you can do to a value. A single card
 * listing them has to light the whole step, which leaves the reader matching
 * three points to three rows themselves.
 *
 * A step that is one job rather than a set of answers keeps one card: upload,
 * review. So the count is not a target - it follows from how many answers the
 * reader is actually choosing between.
 *
 * What no card does is recite the step trail. The order is still forward, one
 * pass, ending where the reader came in.
 *
 * ──── ANCHORS ────
 * A card names the `data-walkthrough` key of the real control it is about, and
 * the overlay spotlights whatever is mounted under that key. Where the control
 * lives on a later step, the card names that step too and the overlay takes the
 * wizard there, then hands it back when the tour closes.
 *
 * ──── ONE WORKED EXAMPLE, NOT SIX DIAGRAMS ────
 * The reference module draws a picture on a card only when the thing it is
 * talking about is not on the screen, because a diagram of a thing you can see
 * is worse than the thing. The tour opens before there is a file, so every step
 * past the upload has nothing of the reader's to show - and rather than draw
 * each one, the wizard mounts the real step and feeds it an example file. So
 * the rule still holds: every card points at the control it describes, and the
 * control is the real one. See `walkthroughExample.tsx` for the file, and the
 * `demo` field below for which cards ask for it.
 *
 * ──── COPY ────
 * Sentence case throughout, no em dashes, third person. A point is one row of
 * the card, so each has to stand on its own: the reader is scanning, not
 * reading a paragraph. Three is the working limit and five the hard ceiling.
 *
 * Points are nodes rather than strings because most of them quote something -
 * a number, or the column heading they are defining - and a quoted number set
 * in running prose is the one thing a reader cannot pick out at a glance.
 * ────────────────────────────────────────────────────────────────── */

/* A number, quoted. Tinted rather than italicised because these are read as
   specimens and not as emphasis, and because there is no monospace in this
   module to set them apart with. */
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

/* A heading on the step behind the card, named so the reader can find it there.
   These points define a column, so the term has to look like the thing it is
   pointing at rather than like stressed prose. */
const T = ({ children }: { children: ReactNode }) => (
  <b style={{ color: '#0F172A', fontWeight: 600 }}>{children}</b>
)

/* Between a value and what it is called. The arrow is how the gate step and the
   labelling step both write this pairing on screen, so the cards write it the
   same way rather than saying "becomes" in prose. */
const To = () => <span aria-hidden style={{ color: '#94A3B8' }}> &rarr; </span>

/** Which step of the import a card wants the wizard to be standing on. */
export type WalkthroughStep = 'upload' | 'split' | 'dimensions' | 'labels' | 'review'

/** The `data-walkthrough` keys the import wizard mounts. */
export type WalkthroughAnchor =
  | 'template' | 'dropzone'
  | 'gate-yes' | 'gate-no'
  | 'dimension-filter' | 'dimension-ignore' | 'dimension-account'
  | 'value-named' | 'value-blank' | 'value-excluded'
  | 'review-dimensions'
  | 'how-it-works'

export type WalkthroughSide = 'below' | 'above' | 'left' | 'right'

/* Generic over the step names, so a wizard keeps its own union and a card that
   names a step that wizard does not have fails to compile. The anchor and the
   demo stay plain strings: the overlay only ever compares them to what is
   mounted, and a union per tour would have to be threaded through the overlay
   to buy nothing. */
export interface WalkthroughCard<S extends string = string> {
  id: string
  eyebrow: string
  title: string
  /** An opening line above the points, for a card that introduces rather than instructs. */
  lead?: ReactNode
  /** One point to a row, ticked unless the card is `numbered`. */
  points: ReactNode[]
  /** Numbered rather than ticked, for a list whose order is itself the message. */
  numbered?: boolean
  icon: LucideIcon
  /** The `data-walkthrough` key of the control to spotlight. A key may be worn by
      several elements, in which case the spotlight is their union - that is how a
      whole column is lit.
      `null` points at nothing on purpose: the dim covers the whole window and the
      card stands in the middle of it. That is for a card that defines a word
      before the word is used, where lighting any one control would say the word
      means that control. */
  anchor: string | null
  /** Side to try first. The overlay falls back through the others if it does not fit. */
  prefer?: WalkthroughSide
  /** The step this card's control lives on. The overlay moves the wizard to it. */
  step: S
  /** The example surface the wizard stands the reader on while this card is up,
      for a step that would otherwise have nothing on it to point at. */
  demo?: string
  /** A diagram, drawn under the points, for a card whose subject is not on the
      screen at all. Only ever shown while nothing is lit: a picture of a thing
      the reader can see beside it is worse than the thing. */
  art?: () => JSX.Element
}

/** The specimen number, whole, as the gate step behind the card also writes it. */
const SPECIMEN = SPECIMEN_PARTS.join('-')

export const WALKTHROUGH_CARDS: WalkthroughCard<WalkthroughStep>[] = [
  {
    id: 'template',
    eyebrow: 'Before you upload',
    title: 'Download the template',
    points: [
      <>Pick <T>Excel</T> or <T>CSV</T>.</>,
      <>The Excel file has instructions on its own tab. For CSV, see <T>How it works</T>.</>,
    ],
    icon: Download,
    anchor: 'template',
    prefer: 'below',
    step: 'upload',
  },
  {
    id: 'dropzone',
    eyebrow: 'Your file',
    title: 'Fill in and upload',
    points: [
      'Fill it in with your accounts, then upload it here.',
    ],
    icon: Upload,
    anchor: 'dropzone',
    prefer: 'below',
    step: 'upload',
  },
  /* ──── The word, before the step that asks about it ────
     Unanchored on purpose. "Dimension" is being defined here, and lighting
     either answer to the gate while defining it would say the word means that
     answer. The card after it lights the pair. */
  {
    id: 'dimension-word',
    eyebrow: 'Before you answer',
    title: 'What is a segment?',
    lead: <>A segment is one part of an account number that's split into parts. Each part can mean something different.</>,
    points: [
      <>In <N>{SPECIMEN}</N>, Omne sees three parts: <N>{SPECIMEN_PARTS[0]}</N>, <N>{SPECIMEN_PARTS[1]}</N>, and <N>{SPECIMEN_PARTS[2]}</N>. Each one is a segment you can define and label.</>,
    ],
    icon: HelpCircle,
    anchor: null,
    /* The only card in the tour with a picture, because it is the only one whose
       subject is a word rather than a control. The gate behind it draws its own
       worked example, but the card is centred over a dimmed screen with nothing
       lit, so the reader is being asked to hold a number in their head while
       reading about it. */
    art: DimensionSplitArt,
    step: 'split',
    demo: 'split',
  },
  /* One card per answer, because this is the one step whose two answers lead
     somewhere different: yes is three more screens and no is the review grid.
     "If you say Yes" is the title rather than the opening of every point, so the
     spotlight on the answer and the heading over the points say the same thing. */
  {
    id: 'gate-yes',
    eyebrow: 'Step 1, yes',
    title: 'If you say Yes',
    points: [
      'Omne checks that your numbers use separators, like hyphens, periods or spaces. Then you define each segment and label its values.',
      <>For example: <N>{SPECIMEN}</N><To /><T>Location</T> | <T>Department</T> | <T>GL account number</T></>,
      "No separators? You'll be asked to fix your file and upload it again.",
    ],
    icon: Split,
    anchor: 'gate-yes',
    prefer: 'below',
    step: 'split',
    demo: 'split',
  },
  {
    id: 'gate-no',
    eyebrow: 'Step 1, no',
    title: 'If you say No',
    points: [
      'Omne imports your account numbers as they are and takes you straight to the review.',
    ],
    icon: Minus,
    anchor: 'gate-no',
    prefer: 'below',
    step: 'split',
    demo: 'split',
  },
  /* ──── The step, before the answers to it ────
     Unanchored, for the same reason the card defining the word is: three answers
     are about to be lit one at a time, and lighting one of them while saying what
     the step is for would read as that answer being what the step is for. So the
     screen is dimmed whole and the reader is told what they are being asked
     before they are shown where to answer it.

     No picture. The table this describes is on the screen behind the card, dim
     but legible, and a drawing of a table beside a real one is the worse of the
     two. */
  {
    id: 'dimensions-step',
    eyebrow: 'Step 2',
    title: 'Define the segments',
    /* A lead and no points. The card says one thing, and a tick beside a single
       sentence reads as the first item of a list the reader then looks for. */
    lead: 'Tell Omne what each part of the account number means and how to use it.',
    points: [],
    icon: HelpCircle,
    anchor: null,
    step: 'dimensions',
    demo: 'dimensions',
  },
  /* ──── One card per answer, down the table ────
     The three answers this step offers, a card each, and each card lights the row
     of the example file where its answer is given. Which is what the example file
     was built for: three dimensions, one answer apiece, no row left over.

     Ordered as the table is rather than as a list would be, because the cards are
     read in sequence and the spotlight travels with them. Leading on the GL
     account number would light the bottom row first and then jump back up. */
  {
    id: 'dimension-filter',
    eyebrow: 'Step 2, dimension',
    title: 'Dimension',
    points: [
      <>A segment you want to filter accounts by. It becomes a dimension, such as Department<To />Operations.</>,
    ],
    icon: ListFilter,
    anchor: 'dimension-filter',
    prefer: 'right',
    step: 'dimensions',
    demo: 'dimensions',
  },
  {
    id: 'dimension-ignore',
    eyebrow: 'Step 2, ignore',
    title: 'Ignore',
    points: [
      "A segment you don't need in Omne.",
    ],
    icon: Ban,
    anchor: 'dimension-ignore',
    prefer: 'right',
    step: 'dimensions',
    demo: 'dimensions',
  },
  {
    id: 'dimension-account',
    eyebrow: 'Step 2, GL account number',
    title: 'GL account number',
    points: [
      'The segment that identifies each account.',
    ],
    icon: Hash,
    anchor: 'dimension-account',
    prefer: 'right',
    step: 'dimensions',
    demo: 'dimensions',
  },
  /* ──── The step, before the answers to it ────
     As the dimensions step above: unanchored, so the screen dims whole and the
     reader is told what they are being asked before any one answer is lit. */
  {
    id: 'labels-step',
    eyebrow: 'Step 3',
    title: 'Label values',
    lead: 'Give your dimension values readable labels, so they are easier to understand and filter.',
    points: [],
    icon: HelpCircle,
    anchor: null,
    step: 'labels',
    demo: 'labels',
  },
  /* ──── One card per answer, down the table ────
     As the dimensions step above. The example file's one filter carries its three
     values in the three states this step allows - one named, one left alone, one
     excluded - so each card lights the row already showing its answer, in the
     order those rows sit in. */
  {
    id: 'value-named',
    eyebrow: 'Step 3, label a value',
    title: 'Label a value',
    points: [
      <>Give it a name people will recognize, for example <N>100</N><To />Operations.</>,
    ],
    icon: Tag,
    anchor: 'value-named',
    prefer: 'right',
    step: 'labels',
    demo: 'labels',
  },
  {
    id: 'value-blank',
    eyebrow: 'Step 3, leave it as is',
    title: 'Leave it as is',
    points: [
      'No label? Omne keeps the value as it is.',
    ],
    icon: Minus,
    anchor: 'value-blank',
    prefer: 'right',
    step: 'labels',
    demo: 'labels',
  },
  {
    id: 'value-excluded',
    eyebrow: 'Step 3, exclude a value',
    title: 'Exclude a value',
    points: [
      "Leave out any values you don't want in Omne.",
    ],
    icon: Ban,
    anchor: 'value-excluded',
    prefer: 'right',
    step: 'labels',
    demo: 'labels',
  },
  {
    id: 'review',
    eyebrow: 'Step 4',
    title: 'Review before importing',
    points: [
      'Check your accounts and the dimension columns Omne has added.',
      'Start the import when everything looks right.',
    ],
    icon: Table2,
    /* The dimension columns alone, not the grid. The accounts are the reader's
       own rows and they can see those; what they cannot pick out is which of
       twenty columns came from the answers they just gave, so that is what is
       lit. No single element is a column, so the key is worn by the heading and
       by every cell under it and the overlay unions them.
       Left, because the dimension columns are appended after the standing ones
       and so sit at the right-hand end of the grid. */
    anchor: 'review-dimensions',
    prefer: 'left',
    step: 'review',
    demo: 'review',
  },

  /* ──── The way back in ────
     The one card that walks the reader BACKWARDS, to the step they started on.
     It is not a step of the import: it is where the tour puts them down, and
     what it points at is how to get all of this back without a tour. Ending on
     the review grid would leave them standing on a screen they cannot use yet,
     holding a file they have not uploaded. */
  {
    id: 'how-it-works',
    eyebrow: 'Whenever you need it',
    title: 'Need help?',
    points: [
      <>Open <T>How it works</T> any time to read more about importing and dimensions, or to replay this walkthrough.</>,
    ],
    icon: Info,
    anchor: 'how-it-works',
    prefer: 'below',
    step: 'upload',
  },
]
