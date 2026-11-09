import type { ReactNode } from 'react'
import type { ReadingRoomConfig } from '../components/walkthrough/ReadingRoom'

/* ──────────────────────────────────────────────────────────────────
 * WHAT "MOVE UNDER A NEW SUMMARY ACCOUNT" EXPLAINS
 *
 * The long answer behind the move, in the Reading Room the journal entry guides
 * and the import wizard use. Design review, 2026-09-24 - Eli: *"You've got to
 * give them a bunch of information. You need to explain to them that you can't
 * move it underneath a pre-existing one ... What you can do is you can create
 * it as another child under a new parent ... The parent will inherit all of the
 * legacy data because it is a parent ... And you need to explain that whole
 * behavior, the mechanisms, what's going on clearly."*
 *
 * Copy only, like `journalGuides.tsx`. Sentence case, no em dashes. Written for
 * someone who has never kept books.
 * ────────────────────────────────────────────────────────────────── */

function P({ children }: { children: ReactNode }) {
  return <p className="mb-2 last:mb-0">{children}</p>
}

/* A small before-and-after tree. Indentation is the whole message, so it is
   drawn with padding rather than described. */
function Tree({ title, rows }: { title: string; rows: { label: string; depth: number; tone?: 'new' | 'moved' | 'muted' }[] }) {
  return (
    <div className="rounded-lg border border-border bg-white/70 my-2.5 overflow-hidden">
      <div className="px-3 py-1.5 text-2xs uppercase tracking-[0.06em] text-fg-subtle font-semibold border-b border-border">{title}</div>
      <div className="px-3 py-2 space-y-1 text-13">
        {rows.map((r, i) => (
          <div key={i} style={{ paddingLeft: r.depth * 16 }}
            className={r.tone === 'new' ? 'text-primary font-semibold' : r.tone === 'moved' ? 'text-fg font-medium' : r.tone === 'muted' ? 'text-fg-subtle' : 'text-fg-muted'}>
            {r.depth > 0 && <span className="text-fg-subtle mr-1.5">└</span>}{r.label}
          </div>
        ))}
      </div>
    </div>
  )
}

export const MOVE_UNDER_SUMMARY_GUIDE: ReadingRoomConfig = {
  title: 'Moving an account under a new summary',
  subtitle: 'What the move does, why it only works one way, and how it lets you split an account up.',
  sections: [
    {
      title: 'What this does',
      body: <>
        <P>It puts a new summary account in the place your account sits today, and moves your account underneath it. The new summary is created inside the same parent, so it sits exactly where your account did.</P>
        <P>Nothing about your account changes. It keeps its number, its name, its balance and every transaction ever posted to it.</P>
      </>,
    },
    {
      title: 'Why you would do it: splitting an account up',
      body: <>
        {/* A generic example anyone follows. Design review, 2026-09-30 - Eli:
            the product lines were too specific, *"I've always tracked sales
            globally, and I want to break out Canada, the United States, and
            Mexico."* */}
        <P>Say you have always recorded all your sales in one account. Now you want to see sales by country, with Canada, the United States and Mexico each in their own account.</P>
        <P>A posting account cannot have accounts under it, and you cannot move the old sales account somewhere else without dragging all its history along. So instead you put a new summary above it. The old account becomes one of its children, and you add the country accounts beside it:</P>
        <Tree title="After" rows={[
          { label: 'Sales (new summary)', depth: 0, tone: 'new' },
          { label: 'Sales, all countries (your old account, unchanged)', depth: 1, tone: 'moved' },
          { label: 'Sales - Canada (new)', depth: 1, tone: 'muted' },
          { label: 'Sales - United States (new)', depth: 1, tone: 'muted' },
          { label: 'Sales - Mexico (new)', depth: 1, tone: 'muted' },
        ]} />
        <P>From then on, new sales go to the country accounts, and the summary adds everything up.</P>
      </>,
    },
    {
      title: 'What happens to the history',
      body: <>
        <P>A summary account has no transactions of its own. Its figures are always the total of the accounts under it. So the moment it is created, the new summary shows everything your account ever held, past periods included. In a sense it inherits the account's whole history.</P>
        <P>Every total above it stays exactly the same, because the same money is still inside the same parent. Reports for past periods do not change.</P>
      </>,
    },
    {
      /* What the form offers, and why. Design review, 2026-10-02 - Eli: the
         summary takes the number in front of the account, and the block runs
         to the end of the account's block. */
      title: 'The number the new summary gets',
      body: <>
        <P>A summary sits above the accounts it adds up, so the new one takes the number directly in front of your account, and sets aside the numbers from there to the end of your account&apos;s block. Your account keeps its own number inside that block.</P>
        <Tree title="Example" rows={[
          { label: '11100 Cash and Cash Equivalents', depth: 0, tone: 'muted' },
          { label: '11109 Petty cash funds (new summary, sets aside 11109-11119)', depth: 1, tone: 'new' },
          { label: '11110 Petty Cash (your account, unchanged)', depth: 2, tone: 'moved' },
        ]} />
        <P>This is why accounts are numbered in steps of ten: there is room in front of each one. If the number in front of your account is already taken, the summary takes the next free number after it instead. You can always change the number before you save.</P>
      </>,
    },
    {
      title: 'Why it cannot go anywhere else',
      body: <>
        <P>Your account can only move under a new summary, and only inside the parent it is already in. It cannot move into a summary that already exists, and it cannot move up or down a level.</P>
        <P>That is because an account carries its whole history wherever it goes. Moving it to a different parent would take money out of one total and add it to another, for every past period too, so reports that were already produced would suddenly show different numbers. Adding a new summary in place is the one change that keeps every existing total the same.</P>
      </>,
    },
    {
      title: 'After the move',
      body: <>
        <P>The new summary opens on its own page. From there you can add accounts under it, rename it, or give it a description. Your moved account is still reachable from the chart and keeps its own page, exactly as before.</P>
      </>,
    },
  ],
}
