import type { ReactNode } from 'react'
import type { ReadingRoomConfig } from '../components/walkthrough/ReadingRoom'

/* ──────────────────────────────────────────────────────────────────
 * WHAT THE JOURNAL ENTRY GUIDES SAY
 *
 * Three explanations, asked for in the design review of 2026-09-28, each in the
 * Reading Room the import wizard already uses for its "How it works":
 *
 *   - Retained earnings corrections. The thorough one, with a plain-English
 *     story and a worked debit and credit example. Eli: *"we need a good,
 *     thorough explanation ... I want a less thorough explanation for the
 *     normal ones."*
 *   - Journal entries written by hand, in general.
 *   - Accounts the system keeps (control accounts and retained earnings).
 *
 * Written for someone who has never kept books, not only for accountants. Eli:
 * *"You're assuming that the people who are doing this are accountants ...
 * there's a lot of Jennifers in this world who don't really know how it works."*
 *
 * Copy only, like `importReadingRoom.tsx`: the panel lives in
 * `components/walkthrough/ReadingRoom.tsx`. Sentence case, no em dashes.
 * ────────────────────────────────────────────────────────────────── */

function P({ children }: { children: ReactNode }) {
  return <p className="mb-2 last:mb-0">{children}</p>
}

function List({ items }: { items: ReactNode[] }) {
  return (
    <ul className="mb-2 last:mb-0 space-y-1.5 list-disc pl-4 marker:text-fg-subtle">
      {items.map((it, i) => <li key={i}>{it}</li>)}
    </ul>
  )
}

/* A worked entry: the lines as the form would take them, debits and credits in
   their own columns so the two totals can be seen to match. */
function Entry({ lines, caption }: { lines: { account: string; debit?: string; credit?: string }[]; caption?: string }) {
  return (
    <div className="rounded-lg border border-border bg-white/70 my-2.5 overflow-hidden">
      <table className="w-full text-13 tabular-nums">
        <thead>
          <tr className="text-2xs uppercase tracking-[0.06em] text-fg-subtle border-b border-border">
            <th className="text-left font-semibold px-3 py-1.5">Account</th>
            <th className="text-right font-semibold px-3 py-1.5">Debit</th>
            <th className="text-right font-semibold px-3 py-1.5">Credit</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i} className="border-b border-border-subtle last:border-0">
              <td className={'px-3 py-1.5 ' + (l.credit ? 'pl-7' : '')}>{l.account}</td>
              <td className="px-3 py-1.5 text-right">{l.debit ?? ''}</td>
              <td className="px-3 py-1.5 text-right">{l.credit ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {caption && <p className="px-3 py-1.5 text-2xs text-fg-muted border-t border-border-subtle bg-bg-subtle/40">{caption}</p>}
    </div>
  )
}

// =========================
// Retained earnings corrections
// =========================
export const RETAINED_EARNINGS_GUIDE: ReadingRoomConfig = {
  title: 'Correcting retained earnings',
  subtitle: 'What retained earnings is, when you would change it by hand, and how to do it without making things worse.',
  sections: [
    {
      title: 'What retained earnings is',
      body: <>
        <P>Retained earnings is all the profit the business has kept since it started, after any losses and after anything paid out to the owners. It is a running total of past years, not cash in the bank: the money itself may long since have been spent on stock, machines or wages.</P>
        <P>You do not normally touch it. When a year is closed, Omne works out that year's profit or loss and adds it to retained earnings for you, in <strong>Retained System Earnings</strong>.</P>
      </>,
    },
    {
      title: 'When you would change it by hand',
      body: <>
        <P>Only to fix a year that has already been closed. If a closed year turns out to have been wrong, for example an expense was never recorded or a sale was counted twice, that year's profit was wrong, and so is the retained earnings it was added to. The close will not run again for that year, so the fix has to be made by hand.</P>
        <P>A correction goes to <strong>Manual GL Transactions</strong>, never to the system account. Both sit under Retained Earnings and add up to the one figure on your balance sheet, but keeping them apart means anyone can see which part the close worked out and which part people changed.</P>
      </>,
    },
    {
      title: 'A worked example: insurance nobody expensed',
      body: <>
        <P>In January 2025 the business paid 12,000 for a year of insurance. Because the cover was not used yet, the payment was recorded as <strong>Prepaid Insurance</strong>, something the business owns, and 1,000 was meant to move into insurance expense each month.</P>
        <P>When 2025 was closed, only 9,000 had been moved. Nobody recorded the last three months. So 2025's profit was 3,000 too high, and Prepaid Insurance still shows 3,000 of cover that was used up long ago.</P>
        <P>It is now 2026 and 2025 is closed. The correction takes the 3,000 back out of retained earnings and writes the prepaid balance down:</P>
        <Entry
          lines={[
            { account: '32200 Manual GL Transactions', debit: '3,000' },
            { account: '11510 Prepaid Insurance', credit: '3,000' },
          ]}
          caption="Reason: 2025 insurance expense was 3,000 short. Prepaid balance written down to match."
        />
        <P>Afterwards Prepaid Insurance is right, and retained earnings is 3,000 lower, which is exactly what it would have been if 2025 had been recorded properly. This year's profit does not move at all.</P>
      </>,
    },
    {
      title: 'Why not just expense it this year?',
      body: <>
        <P>Recording last year's 3,000 as this year's insurance expense would make this year look 3,000 worse than it was, and leave last year looking 3,000 better than it was. Both years would be wrong instead of one.</P>
        <P>Retained earnings is where past years' profit lives, so a mistake in a past year is fixed there.</P>
      </>,
    },
    {
      title: 'What to watch out for',
      body: <List items={[
        <><strong>Do not use it to hide this year's costs.</strong> Posting a current expense to retained earnings makes this year's profit look better than it is. It is the most common misuse, and the first thing an auditor looks for.</>,
        <><strong>Do not correct twice.</strong> If the original mistake was already fixed some other way, a second correction doubles it. Check the account's history first.</>,
        <><strong>Reports already sent do not change.</strong> Statements given to owners, lenders or the tax office still show the old figure. Tell whoever relies on them.</>,
        <><strong>Taxes may change too.</strong> A correction to a past year's profit can change the tax owed for that year. Check with your accountant before posting.</>,
        <><strong>A negative balance is allowed.</strong> Retained earnings can go below zero after losses. That alone is not a sign of a mistake, and it should not stop a valid correction.</>,
        <><strong>Nothing is erased.</strong> The entry stays on the ledger with its reason. To undo it, reverse it.</>,
      ]} />,
    },
    {
      title: 'What Omne asks for, and why',
      body: <>
        <List items={[
          <><strong>A written reason</strong>, required. Someone reading the books a year from now will need to know what was fixed and why.</>,
          <><strong>The document behind it</strong>, recommended. The schedule, the letter or the invoice that shows the mistake.</>,
          <><strong>Someone to tell</strong>, optional. A bookkeeper might let the accountant know, so the change does not come as a surprise.</>,
        ]} />
        <P>Later, posting here will need permission, and anyone without it will send the entry for approval instead.</P>
      </>,
    },
    {
      title: 'How other systems handle this',
      body: <>
        <P>NetSuite and QuickBooks Online both let you post journal entries to retained earnings by hand. Sage Intacct recommends keeping those corrections in a separate retained earnings adjustment account that rolls up into retained earnings. That is the approach Omne takes.</P>
      </>,
    },
  ],
}

// =========================
// Accounts the system keeps
// =========================
export const SYSTEM_ACCOUNTS_GUIDE: ReadingRoomConfig = {
  title: 'Accounts the system keeps',
  subtitle: 'Why some accounts are filled in for you, and what posting to one by hand means.',
  sections: [
    {
      title: 'What these accounts are',
      body: <>
        <P>Some accounts are filled in by another part of Omne rather than by people. Their balance is meant to be the total of the records behind them:</P>
        <List items={[
          <><strong>Accounts receivable</strong>: what customers owe, from customer invoices and payments.</>,
          <><strong>Accounts payable</strong>: what you owe vendors, from vendor bills and payments.</>,
          <><strong>Inventory</strong>: what your stock is worth, from receiving and shipping.</>,
          <><strong>Retained earnings</strong>: past years' profit, from the year-end close.</>,
        ]} />
        <P>Accountants call the first three control accounts.</P>
      </>,
    },
    {
      title: 'Why you normally leave them alone',
      body: <>
        <P>A hand-written entry changes the account but not the records behind it, so the two stop agreeing. The receivables account might say customers owe 50,000 while the list of unpaid invoices adds up to 48,000, and someone will spend a day finding the 2,000.</P>
      </>,
    },
    {
      title: 'When posting by hand is right',
      body: <>
        <P>When something has to be fixed that the records themselves cannot fix, most often a period that is already closed. Omne lets you, and asks for a written reason so the difference can be explained later.</P>
        <P>For retained earnings, corrections go to a separate manual adjustments account. For a control account, you can add an adjustment account beside it from the account's page, so hand corrections stay apart from what the subledger posts.</P>
      </>,
    },
    {
      title: 'Where their balances start',
      body: <>
        <P>When you set up Omne or bring your books over from another system, each of these accounts has to start from the balance your old books had. How that starting balance comes in, through setup or through an import, is still being settled.</P>
      </>,
    },
  ],
}

// =========================
// Journal entries written by hand
// =========================
export const MANUAL_ENTRIES_GUIDE: ReadingRoomConfig = {
  title: 'Journal entries',
  subtitle: 'What a journal entry is, and what you need to know to write one by hand.',
  sections: [
    {
      title: 'What a journal entry is',
      body: <>
        <P>A journal entry records money moving between accounts. Every entry has at least two lines, and the amounts on one side, the debits, always add up to the amounts on the other, the credits. That is what keeps the books in balance.</P>
        <P>Most entries are written for you when an invoice, a bill or a payment is recorded. You write one by hand for the rest: accruals, moving an amount to the right account, or fixing a mistake.</P>
      </>,
    },
    {
      title: 'Debits and credits in one minute',
      body: <>
        <P>Assets and expenses go up with a debit. Liabilities, equity and revenue go up with a credit. Paying 500 of rent from the bank looks like this:</P>
        <Entry lines={[
          { account: 'Rent Expense', debit: '500' },
          { account: 'Operating bank account', credit: '500' },
        ]} caption="Rent expense goes up by 500, and the bank balance goes down by 500." />
      </>,
    },
    {
      title: 'Description, memo and line descriptions',
      body: <List items={[
        <><strong>Description</strong>: what the entry is, in a few words. It names the entry in the ledger.</>,
        <><strong>Memo</strong>: your notes about it, such as why it was needed or where the figures came from.</>,
        <><strong>Line description</strong>: a note on one line only. Most lines leave it blank.</>,
      ]} />,
    },
    {
      title: 'Dates and periods',
      body: <>
        <P>The date decides which accounting period the entry lands in. A closed period cannot be posted to: a soft-closed one has to be reopened first, and a locked one cannot be posted to at all.</P>
      </>,
    },
    {
      title: 'Once it is posted',
      body: <>
        <P>A posted entry cannot be edited, because other people may already have relied on it. To fix one, reverse it, which posts an equal and opposite entry, and then post the right one. Notes and files can be added to a posted entry at any time.</P>
      </>,
    },
    {
      title: 'Accounts the system keeps',
      body: <>
        <P>Retained earnings and the control accounts, such as receivables and payables, are normally filled in for you. You can still post to them by hand, and the form will ask for a written reason when you do.</P>
      </>,
    },
  ],
}
