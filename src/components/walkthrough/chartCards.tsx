import { FolderTree, Layers, Plus, Rocket, BetweenHorizontalStart, BookOpen, type LucideIcon } from 'lucide-react'
import { useEffect, type ReactNode, type RefObject } from 'react'
import type { WalkthroughCard } from './walkthroughCards'

/* ──────────────────────────────────────────────────────────────────
 * THE CHART OF ACCOUNTS WALKTHROUGH'S CARDS
 *
 * Six cards over the Accounts step of Build from scratch, where the chart itself
 * is built. Offered once a session, the first time the step is reached, and
 * again from the bottom of How it works. Guided setup had the same tour on Add
 * your accounts until Mahad took it out (2026-10-02). The copy was Mahad's of 2026-10-02 (Build from scratch UX copy):
 * a title and a short paragraph each, no eyebrow chip. Rewritten shorter and
 * plainer on 2026-10-07 - Mahad: *"improve the content (copies) in a more
 * humanized manner ... keep them very straight forward and to the point."* The card that
 * pointed at the step trail ("Where you are") was taken out the same day. It replaced a
 * first draft of eight cards whose last three were about validation.
 *
 * ──── ONE PATH, PASSED IN ────
 * The button that publishes comes in as a ChartPath, so the cards say nothing the
 * wizard behind them does not show.
 *
 * ──── THE EMPTY STEP ────
 * Build from scratch opens on five category rows and nothing else, so the cards
 * about account types and numbers would point at a column with nothing in it.
 * While they are up the wizard stands three example accounts under Assets, the
 * way the dimensions tour stands two filters in its empty editor. Never written
 * to the draft.
 *
 * ──── COPY ────
 * Mahad's, then reworked in the design review of 2026-10-02:
 *
 * - The five categories said every account belongs to one of five, which reads
 *   as all there will ever be. Eli: *"we start with these five groupings
 *   because these are the core of what you need. The remaining groups are being
 *   left purposely for the future"*, and the structure is the accepted one,
 *   not ours.
 * - Summary and posting is said plainer, as two kinds of account.
 * - Adding an account was one card for two ways in. Eli: *"You're jamming too
 *   many concepts together for a tour"* - so the form and adding in place are a
 *   card each, and the place-in-the-chart card names the hover + and the row's
 *   Create account above / below, which he could not find.
 * - How it works gets a card of its own, last before publishing - *"Always
 *   point out the how it works part. Show it off a little bit."*
 * - The account numbers card came out on 2026-10-08 (Mahad); numbers are the
 *   Number length step's own tour.
 *
 * The words today are Mahad's of 2026-10-08 (walkthrough-accounts-step.md),
 * written for Guided setup and given to Build from scratch the same day,
 * verbatim but for the button, which each wizard names its own way.
 * ────────────────────────────────────────────────────────────────── */

/* A specimen, quoted. The same tint the other two tours quote with. */
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

/* A control on the screen behind the card, named so the reader can find it. */
const T = ({ children }: { children: ReactNode }) => (
  <b style={{ color: '#0F172A', fontWeight: 600 }}>{children}</b>
)

/** The only step this tour runs on. */
export type ChartStep = 'accounts'

/** The `data-walkthrough` keys this tour expects the step to be wearing. */
export type ChartAnchor = 'chart-table' | 'chart-type' | 'chart-actions' | 'chart-add' | 'wizard-footer' | 'wizard-learn'

/** The one demo surface: three example accounts stood under Assets. */
export const CHART_DEMO = 'chart'

export const CHART_LABEL = 'Chart of accounts walkthrough'

/** The columns a card lights whole, keyed by the column they light. */
export const CHART_COLUMN_ANCHORS: Record<string, ChartAnchor> = { glType: 'chart-type', actions: 'chart-actions' }

interface Card extends WalkthroughCard<ChartStep> {
  anchor: ChartAnchor | null
  icon: LucideIcon
}

export interface ChartPath {
  /** The footer button that publishes the chart. */
  createLabel: string
}

export const SCRATCH_CHART_PATH: ChartPath = { createLabel: 'Publish' }

/* Numbered steps inside a card's text. Spans rather than a list: the text sits
   in a paragraph, which a list cannot go inside. */
const Steps = ({ items }: { items: ReactNode[] }) => (
  <span style={{ display: 'block', marginTop: 6 }}>
    {items.map((item, i) => (
      <span key={i} style={{ display: 'flex', gap: 6, marginTop: i ? 2 : 0 }}>
        <span style={{ flexShrink: 0, minWidth: 14, fontVariantNumeric: 'tabular-nums' }}>{i + 1}.</span>
        <span>{item}</span>
      </span>
    ))}
  </span>
)

/* A heading inside a card's text, for a card that explains two things in turn. */
const Sub = ({ children }: { children: ReactNode }) => (
  <span style={{ display: 'block', marginTop: 10, color: '#0F172A', fontWeight: 600 }}>{children}</span>
)

/* A second paragraph under the first, for a card that closes on an example. */
const Then = ({ children }: { children: ReactNode }) => <span style={{ display: 'block', marginTop: 8 }}>{children}</span>

export function chartCards(path: ChartPath): Card[] {
  return [
    {
      id: 'ca-categories',
      eyebrow: '',
      // Mahad's copy, 2026-10-08.
      title: 'The five categories',
      lead: 'Every account you add goes under one of five categories: Asset, Liability, Equity, Revenue, or Expense. The category decides which financial statement the account shows up on.',
      points: [],
      icon: FolderTree,
      anchor: 'chart-table',
      prefer: 'right',
      step: 'accounts',
      demo: CHART_DEMO,
    },
    {
      id: 'ca-types',
      eyebrow: '',
      // Mahad's copy, 2026-10-08.
      title: 'Summary and posting accounts',
      lead: <>Your chart has two types of accounts: summary and posting.
        <Sub>Summary account</Sub>
        A summary account groups related accounts and shows their total balance. You can&apos;t use it for transactions.
        <Then><i>Create one when</i> you want to group similar accounts together. For example, add <N>11000 Current Assets</N> to group the money your business has or will receive soon.</Then>
        <Sub>Posting account</Sub>
        Posting accounts are used in transactions. Each one keeps its own balance, which adds up into the summary account above it.
        <Then><i>Create one when</i> you need to track a specific amount. For example, add <N>11100 Cash</N> for money in your bank, or <N>11200 Accounts Receivable</N> for money customers owe you.</Then></>,
      points: [],
      icon: Layers,
      anchor: 'chart-type',
      prefer: 'left',
      step: 'accounts',
      demo: CHART_DEMO,
    },
    {
      id: 'ca-add',
      eyebrow: '',
      // Mahad's copy, 2026-10-08.
      title: 'Add an account',
      lead: <>Select <T>Add account</T> to open the form, then:
        <Steps items={[
          'Choose the GL account category, such as Asset or Expense.',
          'Choose the GL account type: summary or posting.',
          'Select the summary account it belongs under.',
          'Enter the GL account name.',
        ]} />
        <Then>Omne fills in the next available GL account number for you. You can change it if you need to.</Then></>,
      points: [],
      icon: Plus,
      anchor: 'chart-add',
      prefer: 'below',
      step: 'accounts',
    },
    {
      id: 'ca-between',
      eyebrow: '',
      // Mahad's copy, 2026-10-08, lighting only the Actions column it names.
      title: 'Add an account above or below a row',
      lead: <>Open the <T>Actions</T> menu (⋯) on any row and select <T>Create account above</T> or <T>Create account below</T>. The new account is added right next to that row.</>,
      points: [],
      icon: BetweenHorizontalStart,
      anchor: 'chart-actions',
      prefer: 'left',
      step: 'accounts',
      demo: CHART_DEMO,
    },
    {
      id: 'ca-learn',
      eyebrow: '',
      title: 'Need help?',
      lead: <>Open <T>How it works</T> any time for detailed explanations of categories, account types, numbers, and each field, with examples.</>,
      points: [],
      icon: BookOpen,
      anchor: 'wizard-learn',
      prefer: 'below',
      step: 'accounts',
    },
    {
      id: 'ca-create',
      eyebrow: '',
      title: 'Publish your chart',
      lead: <>When your accounts are ready, select <T>{path.createLabel}</T> to save them as your chart of accounts. You can still edit any account later from the chart of accounts.</>,
      points: [],
      icon: Rocket,
      anchor: 'wizard-footer',
      prefer: 'above',
      step: 'accounts',
    },
  ]
}

/* ──────── Lighting a whole column ────────
   The overlay lights the union of everything wearing a key, so a column is lit
   by putting the key on its heading and on its cell in every row. The table is
   shared with the listing, which knows nothing of tours, so the step tags the
   cells itself while its tour is up: each heading says which column it is, and
   the cell under it in a full-width row is the one at the same index. Rows that
   span the table (Add row) have fewer cells and are left out.

   Re-tagged whenever the rows change, as they do when a demo account is stood in
   or a branch opens. Watching children only, never attributes, or tagging would
   wake its own observer. */
export function useColumnAnchors(active: boolean, root: RefObject<HTMLElement | null>, map: Record<string, string>) {
  useEffect(() => {
    const el = root.current
    if (!active || !el) return
    const clear = () => el.querySelectorAll('[data-walkthrough-col]').forEach(n => {
      n.removeAttribute('data-walkthrough')
      n.removeAttribute('data-walkthrough-col')
    })
    const tag = () => {
      clear()
      const table = el.querySelector('table')
      const head = table?.tHead?.rows[0]
      if (!table || !head) return
      const width = head.cells.length
      const mark = (n: Element, key: string) => {
        n.setAttribute('data-walkthrough', key)
        n.setAttribute('data-walkthrough-col', '')
      }
      for (const th of Array.from(head.cells)) {
        // Actions has no column key of its own - it is not a column the reader
        // can move or hide - so it is known by the attribute it does carry.
        const head = th as HTMLElement
        const key = map[head.dataset.colHead ?? (head.hasAttribute('data-actions-cell') ? 'actions' : '')]
        if (!key) continue
        mark(th, key)
        for (const body of Array.from(table.tBodies)) {
          for (const tr of Array.from(body.rows)) if (tr.cells.length === width) mark(tr.cells[th.cellIndex], key)
        }
      }
    }
    tag()
    const mo = new MutationObserver(tag)
    mo.observe(el, { childList: true, subtree: true })
    return () => { mo.disconnect(); clear() }
  }, [active, root, map])
}
