import type { ReactNode } from 'react'
import type { ReadingRoomConfig, ReadingRoomSection } from './walkthrough/ReadingRoom'

/* ──────────────────────────────────────────────────────────────────
 * HOW IT WORKS, FOR THE CHART AND THE SETUPS THAT BUILD IT
 *
 * Mahad's copy of 2026-10-08, one guide per screen, each read from the top:
 * Number length and Accounts in both setups (each with its own opening and
 * buttons), Your business in Guided setup, and the chart page, which reads the
 * Accounts guide. Dimensions has its own, in pages/scratchReadingRoom.tsx.
 *
 * It replaces the long reference of 2026-10-02 (numbers, categories, every
 * field by account type, best practice, currencies, how Omne compares), which
 * the setups and the chart page all read until then.
 * ────────────────────────────────────────────────────────────────── */

function P({ children }: { children: ReactNode }) {
  return <p className="mb-2 last:mb-0">{children}</p>
}

/* A worked example, set off from the prose around it. */
function Example({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="my-2.5 rounded-lg border border-border bg-white overflow-hidden">
      {title && <div className="px-3 py-1.5 text-2xs uppercase tracking-[0.06em] text-fg-subtle font-semibold border-b border-border">{title}</div>}
      <div className="px-3 py-2 text-13">{children}</div>
    </div>
  )
}

// Figures line up in a column; prose keeps its own spacing (tabular figures
// widen the hyphen in Freight-In).
const isFigure = (c: ReactNode) => typeof c === 'string' && /^[\d\s,.$]+(to [\d,.$]+)?$/.test(c)

/* A table of any width, for a step's own guide: header row, then rows. A
   column of prose can be given a larger share than its neighbours. */
function Table({ head, rows, shares }: { head: string[]; rows: ReactNode[][]; shares?: number[] }) {
  const cols = { gridTemplateColumns: head.map((_, i) => `minmax(0, ${shares?.[i] ?? 1}fr)`).join(' ') }
  return (
    <div className="text-13">
      <div className="grid gap-2 pb-1 border-b border-border text-2xs text-fg-subtle font-semibold" style={cols}>
        {head.map(h => <div key={h}>{h}</div>)}
      </div>
      {rows.map((r, i) => (
        <div key={i} className="grid gap-2 py-1 border-b border-border last:border-0" style={cols}>
          {r.map((c, j) => <div key={j} className={isFigure(c) ? 'tabular-nums' : undefined}>{c}</div>)}
        </div>
      ))}
    </div>
  )
}

function Points({ children }: { children: ReactNode }) {
  return <ul className="list-disc pl-5 space-y-1 mb-2 last:mb-0 marker:text-fg-subtle">{children}</ul>
}

/* ──────────────────────────────────────────────────────────────────
 * NUMBER LENGTH, IN BOTH WIZARDS
 *
 * How it works on the Number length step, Mahad's copy of 2026-10-08
 * (how-it-works-step-1-number-length.md), written for Guided setup and given to
 * Build from scratch the same day, *"tailored to build from scratch"*. The
 * sections after the first are the same in both. The first says how the wizard
 * runs, so each has its own: Guided setup's verbatim but for two facts the app
 * has moved past since it was written (the last step's button is Publish chart,
 * and Dimensions is a step), Build from scratch's in the same shape for its own
 * three steps, its Publish button, and a chart that starts from the five
 * categories rather than core accounts.
 * ────────────────────────────────────────────────────────────────── */
const GUIDED_NUMBER_LENGTH_INTRO: ReadingRoomSection = {
  title: 'How guided setup works',
  body: <>
    <P>Guided setup builds a chart of accounts based on your answers to a few questions about your business. No changes are saved until you select <b>Publish chart</b> in the final step.</P>
    <P>Guided setup has 4 steps:</P>
    <Points>
      <li><b>Number length.</b> Set the length of your account numbers and the number range for each category.</li>
      <li><b>Your business.</b> Answer questions about your business. Each answer adds the accounts it requires.</li>
      <li><b>Dimensions.</b> Add the things you want to report by, such as Location or Department. You can skip this step.</li>
      <li><b>Add your accounts.</b> Review the chart, then rename, add, or remove accounts before you publish it.</li>
    </Points>
    <P>Every chart also includes 19 core accounts, such as Petty Cash, Retained Earnings, and common operating expenses. These accounts are added regardless of your answers.</P>
  </>,
}

const SCRATCH_NUMBER_LENGTH_INTRO: ReadingRoomSection = {
  title: 'How build from scratch works',
  body: <>
    <P>Build from scratch lets you create your chart of accounts yourself, one account at a time. No changes are saved until you select <b>Publish</b> in the final step.</P>
    <P>Build from scratch has 3 steps:</P>
    <Points>
      <li><b>Number length.</b> Set the length of your account numbers and the number range for each category.</li>
      <li><b>Dimensions.</b> Add the things you want to report by, such as Location or Department. You can skip this step.</li>
      <li><b>Accounts.</b> Add your accounts under the five categories, then publish your chart.</li>
    </Points>
    <P>Your chart starts with the five categories: Asset, Liability, Equity, Revenue, and Expense. Every account you add goes under one of them.</P>
  </>,
}

const NUMBER_LENGTH_SECTIONS: ReadingRoomSection[] = [
  {
    title: 'Why do accounts need numbers?',
    body: <>
      <P>An account number determines where the account appears in your chart. Related accounts are grouped together, and the chart follows the same order as your financial statements.</P>
      <P>Numbers also prevent confusion between accounts with similar names. Two accounts may both be called &quot;Bank&quot;, but each has a unique number, such as 11130.</P>
      <P>Omne suggests a number for every account you add, so you do not need to assign numbers manually.</P>
    </>,
  },
  {
    title: 'How many digits should I use?',
    body: <>
      <P>Omne uses 5 digits by default. A longer number leaves more room between accounts as your chart grows.</P>
      <Example>
        <Table head={['Digits', 'Example: Cash on Hand']} rows={[['4', '1120'], ['5', '11120'], ['6', '111200']]} />
      </Example>
      <P><b>How to choose</b></P>
      <Points>
        <li><b>5 digits</b> is recommended for most businesses.</li>
        <li><b>4 digits</b> suits smaller businesses with fewer accounts, or businesses whose current chart uses 4 digits.</li>
        <li><b>6 or more digits</b> suits businesses that expect a large number of accounts in one area, or whose current chart uses longer numbers.</li>
        <li><b>If you are moving from another system,</b> use the same length as your current chart, so your team and your accountant can keep using the numbers they know.</li>
      </Points>
      <P>This setting only affects the numbers Omne suggests. You can enter a number of a different length when you add an account.</P>
    </>,
  },
  {
    title: 'Category number ranges',
    body: <>
      <P>Each category is assigned its own number range. Every account in that category uses a number from its range.</P>
      <Example>
        <Table head={['Category', 'Number range']} rows={[
          ['Asset', '10000 to 19999'],
          ['Liability', '20000 to 29999'],
          ['Equity', '30000 to 39999'],
          ['Revenue', '40000 to 49999'],
          ['Expense', '50000 to 59999'],
        ]} />
      </Example>
      <P>A number inside one category&apos;s range cannot be used by another category. This keeps related accounts together and reserves space to add new accounts in the correct position.</P>
    </>,
  },
  {
    title: 'How do I change a range?',
    body: <>
      <P>Select <b>Edit ranges</b>, then update the start or end number for a category.</P>
      <P>Each range must:</P>
      <Points>
        <li>Use the same number of digits as your account numbers.</li>
        <li>Contain at least 100 numbers.</li>
        <li>Not overlap with another category&apos;s range.</li>
      </Points>
      <P><b>How to choose</b></P>
      <Points>
        <li><b>Keep the default ranges</b> if you are setting up a new chart. They follow the structure accountants commonly use.</li>
        <li><b>Change the ranges</b> only if you need to match an existing numbering plan from your current system or your accountant.</li>
      </Points>
    </>,
  },
  {
    title: 'Why are suggested numbers 10 apart?',
    body: <>
      <P>Omne suggests account numbers in steps of 10, such as 11110, 11120, and 11130. The numbers in between are reserved, so you can add an account in the correct position later without renumbering existing accounts.</P>
    </>,
  },
  {
    title: 'What are the five categories?',
    body: <>
      <P>Every chart of accounts has five categories, and each account belongs to one of them. The category determines which financial statement the account appears on and whether it normally increases with a debit or a credit.</P>
      <Example>
        <Table head={['Category', 'Description', 'Financial statement', 'Increases with']} shares={[0.8, 1.9, 1.2, 0.9]} rows={[
          ['Asset', 'What the business owns or is owed', 'Balance sheet', 'Debit'],
          ['Liability', 'What the business owes', 'Balance sheet', 'Credit'],
          ['Equity', 'The owners\' share of the business', 'Balance sheet', 'Credit'],
          ['Revenue', 'Income the business earns', 'Income statement', 'Credit'],
          ['Expense', 'Costs of running the business', 'Income statement', 'Debit'],
        ]} />
      </Example>
    </>,
  },
]

const NUMBER_LENGTH_SUBTITLE = 'How account numbers and number ranges work in your chart.'

export const GUIDED_NUMBER_LENGTH_READING_ROOM: ReadingRoomConfig = {
  title: 'Number length',
  subtitle: NUMBER_LENGTH_SUBTITLE,
  sections: [GUIDED_NUMBER_LENGTH_INTRO, ...NUMBER_LENGTH_SECTIONS],
}

export const SCRATCH_NUMBER_LENGTH_READING_ROOM: ReadingRoomConfig = {
  title: 'Number length',
  subtitle: NUMBER_LENGTH_SUBTITLE,
  sections: [SCRATCH_NUMBER_LENGTH_INTRO, ...NUMBER_LENGTH_SECTIONS],
}

/* ──────────────────────────────────────────────────────────────────
 * GUIDED SETUP, STEP 2: YOUR BUSINESS
 *
 * How it works on the Your business step, Mahad's copy of 2026-10-08
 * (how-it-works-step-2-your-business.md), verbatim but for what the app does
 * differently: the step after this one is Dimensions, so "the next step" is
 * named Add your accounts; and a skipped question is not always empty-handed,
 * since four of them take a default at publish (computeGuidedChart(_, true)).
 * Every account list here is the one guidedSetup.ts adds for that answer.
 * ────────────────────────────────────────────────────────────────── */
const GUIDED_YOUR_BUSINESS_SECTIONS: ReadingRoomSection[] = [
  {
    title: 'How do my answers add accounts?',
    body: <>
      <P>Each answer adds the accounts it requires. The panel beside the questions lists all accounts added so far. To see which accounts a specific answer adds, hover over the information icon next to it.</P>
      <P>If two answers require the same account, Omne creates it once.</P>
      <P>All questions are optional except the accounting method. Most skipped questions add no accounts. A few add the basic accounts every business needs, such as Sales, Accounts Receivable, and Accounts Payable. You can add other accounts manually on Add your accounts.</P>
      <P>Your 19 core accounts are always included.</P>
      <P>Below is a detailed description of each question in guided setup.</P>
    </>,
  },
  {
    title: 'Where is your business based?',
    body: <>
      <P>Your country determines which questions appear in this step.</P>
      <Points>
        <li><b>United States:</b> includes additional questions about your legal structure and sales tax.</li>
        <li><b>Other countries:</b> these questions do not appear. A general equity section is added, which you can edit on Add your accounts.</li>
      </Points>
      <P><b>How to choose</b></P>
      <P>Select the country where your business is registered and files its taxes. If you operate in more than one country, select the country this chart of accounts is for.</P>
    </>,
  },
  {
    title: 'What does your business do?',
    body: <>
      <P>Select every option that applies. Each option adds the accounts it requires.</P>
      <Example>
        <Table head={['Option', 'Accounts added']} shares={[1, 2]} rows={[
          ['Manufacture products', 'Raw Materials, Work in Process, Finished Goods, Product Sales, Direct Materials, Direct Labor, Manufacturing Overhead, Freight-In, Inventory Adjustments, Purchase Price Variance'],
          ['Resell products you buy', 'Inventory, Product Sales, Cost of Goods Sold, Freight-In, Inventory Adjustments, Purchase Discounts'],
          ['Provide services', 'Service Revenue, Cost of Services'],
          ['Sell subscriptions or prepaid plans', 'Subscription Revenue, Deferred Revenue'],
          ['Work on long-term contracts', 'Contract Revenue, Contract Assets, Contract Liabilities, Retainage Receivable, Retainage Payable'],
        ]} />
      </Example>
      <P><b>Key terms</b></P>
      <Points>
        <li><b>Deferred Revenue:</b> payments received for goods or services not yet delivered. The amount moves to revenue once it is earned.</li>
        <li><b>Retainage:</b> a portion of a payment withheld until a project is complete.</li>
        <li><b>Work in Process:</b> the value of products that are partly finished.</li>
      </Points>
      <P><b>How to choose</b></P>
      <Points>
        <li><b>Manufacture products:</b> you make, build, or assemble products from raw materials or components.</li>
        <li><b>Resell products you buy:</b> you buy finished products and sell them without changing them, through wholesale, retail, or e-commerce.</li>
        <li><b>Provide services:</b> you charge for time, expertise, or labor, such as consulting, repair, or installation.</li>
        <li><b>Sell subscriptions or prepaid plans:</b> customers pay in advance for goods or services delivered over time, such as software, memberships, or maintenance contracts.</li>
        <li><b>Work on long-term contracts:</b> your projects run over several months, are billed in stages, or include retainage.</li>
      </Points>
      <P>Select more than one option if it applies. For example, a manufacturer that also installs its products should select both <b>Manufacture products</b> and <b>Provide services</b>.</P>
    </>,
  },
  {
    title: 'Which accounting method does your business use?',
    body: <>
      <P>The accounting method determines when income and expenses are recorded. It does not add accounts, because the chart is the same for both methods. This question is required, and the method is difficult to change once you start recording transactions.</P>
      <Example>
        <P><b>Example:</b> you invoice a customer $5,000 in March, and the customer pays in April.</P>
        <Table head={['Method', 'Income is recorded in']} rows={[
          ['Accrual basis', 'March, when the invoice is issued'],
          ['Cash basis', 'April, when the payment is received'],
        ]} />
      </Example>
      <P><b>Accrual basis</b> records income when it is earned and expenses when they are incurred, regardless of when payment is made. Reports reflect actual performance for each period. Accrual is required under US GAAP and is expected by lenders, investors, and auditors.</P>
      <P><b>Cash basis</b> records income when payment is received and expenses when payment is made. It is simpler to maintain because it follows your bank activity. However, it can misrepresent performance for a period. For example, an invoice issued in March and paid in May does not appear in March.</P>
      <P><b>How to choose</b></P>
      <P>Select <b>Accrual basis</b> if any of the following apply:</P>
      <Points>
        <li>You invoice customers and receive payment later.</li>
        <li>You hold inventory.</li>
        <li>You have, or plan to have, investors or bank financing.</li>
        <li>You need audited or GAAP-compliant financial statements.</li>
      </Points>
      <P>Select <b>Cash basis</b> only if all of the following apply:</P>
      <Points>
        <li>Customers pay at the time of sale.</li>
        <li>You have few unpaid vendor invoices at any time.</li>
        <li>No lender or investor requires GAAP financial statements.</li>
      </Points>
      <P><b>US tax requirements:</b> some businesses, such as C corporations above an annual IRS sales threshold, must use accrual for tax purposes. Your books and your tax return can use different methods. Consult your accountant to confirm which requirements apply.</P>
    </>,
  },
  {
    title: 'How is your business legally set up?',
    body: <>
      <P><i>US businesses only.</i> Your legal structure determines how owner contributions and withdrawals are recorded.</P>
      <Example>
        <Table head={['Legal structure', 'Accounts added']} rows={[
          ['Sole proprietorship or single-member LLC', "Owner's Contributions, Owner's Draws"],
          ['Partnership or multi-member LLC', 'A capital account and a draws account for each partner'],
          ['S corporation', 'Common Stock, Additional Paid-in Capital, Shareholder Distributions'],
          ['C corporation', 'Common Stock, Additional Paid-in Capital, Dividends Declared, Income Taxes Payable, Income Tax Expense'],
        ]} />
      </Example>
      <P>Owner draws are not an expense and do not reduce profit. C corporations pay their own income tax, so income tax accounts are added for this structure.</P>
      <P><b>How to choose</b></P>
      <P>Use the federal tax return your business files:</P>
      <Example>
        <Table head={['Tax return filed', 'Select']} rows={[
          ["Schedule C, filed with the owner's personal return", 'Sole proprietorship or single-member LLC'],
          ['Form 1065', 'Partnership or multi-member LLC'],
          ['Form 1120-S', 'S corporation'],
          ['Form 1120', 'C corporation'],
        ]} />
      </Example>
      <P><b>For LLCs,</b> select the option that matches how the LLC is taxed. For example, an LLC that has elected S corporation status should select <b>S corporation</b>.</P>
      <P>If your business has not filed a tax return yet, refer to your formation documents or consult your accountant.</P>
    </>,
  },
  {
    title: 'How do customers pay you?',
    body: <>
      <P>Select all that apply.</P>
      <Example>
        <Table head={['Payment method', 'Accounts added']} rows={[
          ['We invoice and get paid later', 'Accounts Receivable, Allowance for Credit Losses, Customer Deposits'],
          ['They pay at the time of sale', 'Cash on Hand, Payments to Deposit, Merchant Fees'],
        ]} />
      </Example>
      <P><b>Key terms</b></P>
      <Points>
        <li><b>Accounts Receivable:</b> amounts customers owe your business.</li>
        <li><b>Allowance for Credit Losses:</b> the portion of receivables you do not expect to collect.</li>
        <li><b>Customer Deposits:</b> payments received before goods or services are delivered.</li>
        <li><b>Payments to Deposit:</b> payments received but not yet deposited in the bank.</li>
        <li><b>Merchant Fees:</b> fees charged for processing card payments.</li>
      </Points>
      <P><b>How to choose</b></P>
      <Points>
        <li><b>We invoice and get paid later:</b> you issue invoices with payment terms, such as net 30.</li>
        <li><b>They pay at the time of sale:</b> customers pay by card, cash, or online checkout at the time of purchase.</li>
        <li><b>Both:</b> select both if you use both methods. For example, a business that sells online and also invoices wholesale customers.</li>
      </Points>
    </>,
  },
  {
    title: 'How do you pay vendors?',
    body: <>
      <P>Select all that apply.</P>
      <Example>
        <Table head={['Payment method', 'Accounts added']} rows={[
          ['Vendors invoice you and you pay later', 'Accounts Payable, AP Accrual, Vendor Prepayments'],
          ['By company credit card', 'Credit Card Payable'],
        ]} />
      </Example>
      <P><b>Key terms</b></P>
      <Points>
        <li><b>Accounts Payable:</b> amounts your business owes vendors.</li>
        <li><b>AP Accrual:</b> costs incurred but not yet invoiced by the vendor.</li>
        <li><b>Vendor Prepayments:</b> payments made to vendors in advance.</li>
        <li><b>Credit Card Payable:</b> the balance owed on company credit cards.</li>
      </Points>
      <P><b>How to choose</b></P>
      <Points>
        <li><b>Vendors invoice you and you pay later:</b> vendors send invoices that you pay by a due date.</li>
        <li><b>By company credit card:</b> you use a business credit card for purchases.</li>
        <li><b>Neither:</b> if you pay all purchases directly from your bank account at the time of purchase, you can skip this question.</li>
      </Points>
    </>,
  },
  {
    title: 'Do you deal in multiple currencies?',
    body: <>
      <P>Your books are kept in a single base currency. Select <b>Yes</b> if you also buy, sell, or hold money in other currencies.</P>
      <P><b>Accounts added:</b> Realized Foreign Exchange Gain or Loss, Unrealized Foreign Exchange Gain or Loss.</P>
      <P>Exchange rates change over time, which changes the value of foreign currency amounts in your base currency. These accounts record that difference.</P>
      <Points>
        <li><b>Realized:</b> the gain or loss on amounts that have been paid or converted.</li>
        <li><b>Unrealized:</b> the gain or loss on amounts you still hold.</li>
      </Points>
      <P>Only bank and cash on hand accounts can hold a foreign currency. All other accounts use your base currency.</P>
      <P><b>How to choose</b></P>
      <P>Select <b>Yes</b> if any of the following apply:</P>
      <Points>
        <li>You hold a bank account in another currency.</li>
        <li>You invoice customers in another currency.</li>
        <li>Vendors invoice you in another currency.</li>
      </Points>
      <P>Select <b>No</b> if all transactions are in US dollars, including those with international customers or vendors.</P>
    </>,
  },
  {
    title: 'Do you collect sales tax from customers?',
    body: <>
      <P><i>US businesses only.</i></P>
      <P><b>Accounts added:</b> Sales Tax Payable.</P>
      <P>Sales tax collected from customers is not income. It is owed to the state and is recorded as a liability until it is paid. In the US, one account is sufficient for sales tax.</P>
      <P><b>How to choose</b></P>
      <Points>
        <li><b>Yes:</b> you are registered to collect sales tax in one or more states, or you charge sales tax on invoices or receipts.</li>
        <li><b>No:</b> you do not charge sales tax on any sales.</li>
        <li><b>If you are unsure whether you are required to collect sales tax,</b> consult your accountant. Requirements depend on what you sell and where your customers are located.</li>
      </Points>
    </>,
  },
  {
    title: 'Do you have employees on payroll?',
    body: <>
      <P><b>Accounts added if Yes:</b> Wages Expense, Payroll Tax Expense, Payroll Liabilities.</P>
      <P>Payroll Liabilities records taxes and deductions withheld from employee pay that have not yet been paid. If you select <b>Not yet</b>, no accounts are added. You can add payroll accounts later.</P>
      <P><b>How to choose</b></P>
      <Points>
        <li><b>Yes:</b> you pay employees through payroll and withhold taxes. This includes owners who receive a salary.</li>
        <li><b>Not yet:</b> you only pay contractors or freelancers. These payments are recorded in Contractor &amp; Professional Fees, which is included in your core accounts.</li>
      </Points>
    </>,
  },
  {
    title: 'Do you own or lease long-term assets, or have business loans?',
    body: <>
      <P>Select all that apply. Items your business uses for more than one year are recorded as assets, and their cost is spread over their useful life.</P>
      <Example>
        <Table head={['Answer', 'Accounts added']} rows={[
          ['We own equipment, vehicles or property', 'Machinery and Equipment, Vehicles, Furniture and Fixtures, Accumulated Depreciation, Depreciation Expense'],
          ['We lease equipment or space', 'Right-of-Use Assets, Lease Liabilities - Current, Lease Liabilities - Non-current'],
          ['We have loans or financing', 'Notes Payable - Current, Notes Payable - Non-current, Interest Expense'],
          ['None of these', 'No accounts added'],
        ]} />
      </Example>
      <P><b>Key terms</b></P>
      <Points>
        <li><b>Depreciation:</b> the allocation of an asset&apos;s cost over its useful life.</li>
        <li><b>Right-of-use asset:</b> your right to use leased equipment or property over the lease term.</li>
        <li><b>Current and non-current:</b> current amounts are due within 12 months. Non-current amounts are due after 12 months.</li>
      </Points>
      <P><b>How to choose</b></P>
      <Points>
        <li><b>We own equipment, vehicles or property:</b> you have purchased high-value items you will use for more than one year, such as machinery, vehicles, computers, or furniture.</li>
        <li><b>We lease equipment or space:</b> you have a lease with a term longer than 12 months. Leases of 12 months or less, or month-to-month rentals, are recorded in Rent &amp; Lease, which is included in your core accounts.</li>
        <li><b>We have loans or financing:</b> you have borrowed money, such as a bank loan, an SBA loan, or equipment financing.</li>
        <li><b>None of these:</b> none of the above apply. You can add these accounts later if needed.</li>
      </Points>
    </>,
  },
]

export const GUIDED_YOUR_BUSINESS_READING_ROOM: ReadingRoomConfig = {
  title: 'Your business',
  subtitle: 'What each question means and the accounts it adds.',
  sections: GUIDED_YOUR_BUSINESS_SECTIONS,
}

/* ──────────────────────────────────────────────────────────────────
 * ACCOUNTS, IN BOTH WIZARDS AND ON THE CHART
 *
 * How it works on the step accounts are added on (Add your accounts in Guided
 * setup, Accounts in Build from scratch) and on the chart page, Mahad's copy of
 * 2026-10-09 (how-it-works-accounts-step-1.md), verbatim but for the names of
 * the place's own buttons: the chart page adds from Create GL account, and each
 * setup publishes with its own button (Publish chart, or Publish). The chart
 * page has nothing to publish, so it stops before "What happens when I
 * publish?" (Mahad: *"listing (before what happens when I publish)"*).
 * ────────────────────────────────────────────────────────────────── */

/* A numbered sequence of steps. */
function Steps({ children }: { children: ReactNode }) {
  return <ol className="list-decimal pl-5 space-y-1 mb-2 last:mb-0 marker:text-fg-subtle">{children}</ol>
}

/* One field of the form: its name, then what it means. */
function Field({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div className="mb-3 last:mb-0">
      <div className="text-fg mb-0.5" style={{ fontWeight: 600 }}>{name}</div>
      {children}
    </div>
  )
}

/* A sub-heading inside a section, for the copy's "###" headings. */
function Sub({ children }: { children: ReactNode }) {
  return <div className="mt-3 mb-2 first:mt-0 text-2xs uppercase tracking-[0.06em] text-fg-subtle font-semibold">{children}</div>
}

/* Where the guide is read. A setup names its own add and publish buttons; the
   chart page adds from Create GL account and has nothing to publish. */
interface AccountsGuideWhere {
  addLabel: string
  /** Absent where the chart is already live. */
  publishLabel?: string
}

const accountsSections = ({ addLabel, publishLabel }: AccountsGuideWhere): ReadingRoomSection[] => [
  {
    title: 'What are the five categories?',
    body: <>
      <P>Your chart of accounts lists every account your business records money in. Each account belongs to one of five categories. The category decides which financial statement the account appears on and whether a debit or a credit increases it.</P>
      <Example>
        <Table head={['Category', 'What it holds', 'Examples', 'Shows on', 'Increases with']} shares={[0.9, 1.3, 1.5, 1.1, 0.9]} rows={[
          ['Asset', 'What the business owns or is owed', 'Cash, Accounts Receivable, Inventory, Equipment', 'Balance sheet', 'Debit'],
          ['Liability', 'What the business owes', 'Accounts Payable, Loans, Sales Tax Payable', 'Balance sheet', 'Credit'],
          ['Equity', "The owners' share of the business", "Owner's Contributions, Retained Earnings", 'Balance sheet', 'Credit'],
          ['Revenue', 'What the business earns', 'Product Sales, Service Revenue, Interest Income', 'Income statement', 'Credit'],
          ['Expense', 'What it costs to run the business', 'Rent, Wages, Utilities, Income Tax Expense', 'Income statement', 'Debit'],
        ]} />
      </Example>
      <P>The categories follow the order of your financial statements: the balance sheet first, then the income statement.</P>
    </>,
  },
  {
    title: "What's the difference between summary and posting accounts?",
    body: <>
      <P>Every account is either a summary account or a posting account.</P>
      <P><b>Posting accounts</b> record transactions and hold their own balance. They can&apos;t have accounts under them.</P>
      <P><b>Summary accounts</b> group related accounts and show their combined balance, which updates as the accounts under them change. You can&apos;t record transactions in a summary account.</P>
      <Example>
        <Table head={['GL account no.', 'GL account name', 'GL account type', 'Balance']} rows={[
          ['11000', 'Current Assets', 'Summary', '$25,000.00'],
          ['11100', 'Cash', 'Posting', '$15,000.00'],
          ['11200', 'Accounts Receivable', 'Posting', '$10,000.00'],
        ]} />
      </Example>
      <P>Current Assets shows $25,000.00 because that&apos;s the total of Cash and Accounts Receivable.</P>
      <P><b>Which one to use</b></P>
      <Points>
        <li><b>Summary account:</b> for a group you want to see as one line on your financial statements, like Current Assets.</li>
        <li><b>Posting account:</b> for the detail you record transactions in, like a specific bank account.</li>
      </Points>
    </>,
  },
  {
    title: 'How do I add an account?',
    body: <>
      <P><b>From the {addLabel} button</b></P>
      <Steps>
        <li>Select <b>{addLabel}</b>.</li>
        <li>Choose the <b>category</b>, like Asset or Expense.</li>
        <li>Choose the <b>GL account type</b>: Summary or Posting.</li>
        <li>Select the <b>parent</b>: the category or summary account the new account sits under.</li>
        <li>Enter a <b>GL account name</b>.</li>
        <li>Check the suggested <b>GL account number</b>. You can change it.</li>
        <li>For posting accounts, add <b>dimensions</b> if you use them. This step is optional.</li>
      </Steps>
      <P><b>In a specific place</b></P>
      <P>Open a row&apos;s <b>Actions</b> menu and select <b>Create account above</b> or <b>Create account below</b>. Omne fills in the parent and suggests a number that fits between the rows.</P>
    </>,
  },
  {
    title: 'What does each field mean?',
    body: <>
      <Sub>When you add an account</Sub>
      <Field name="Category">
        <P>Asset, Liability, Equity, Revenue, or Expense. Decides which financial statement the account appears on.</P>
      </Field>
      <Field name="GL account type">
        <P>Summary or Posting. A summary account groups other accounts and shows their total. A posting account records transactions.</P>
      </Field>
      <Field name="Parent">
        <P>The category or summary account this account sits under and adds up into. The parent must be in the same category.</P>
      </Field>
      <Field name="Statement classification">
        <P>The line the account appears under on your financial statements, like Current asset, Non-current liability, or Operating expense.</P>
        <P>The account starts with its parent&apos;s classification. You can choose a different one, and the chart marks it as an override. Keep the parent&apos;s classification unless the account belongs on a different line of your statements.</P>
      </Field>
      <Field name="GL account name">
        <P>The name people see in the chart and on reports. Pick one that makes sense on its own, like &quot;Operating - Chase Bank&quot; instead of &quot;Bank 1.&quot; Don&apos;t include the account number in the name.</P>
      </Field>
      <Field name="GL account number">
        <P>The account&apos;s label. Sets where the account is listed in the chart. Omne suggests one, and you can change it.</P>
      </Field>
      <Field name="Normal balance">
        <P>The side the account increases on. Omne sets it from the category. Switch it only to create a contra account.</P>
        <Example>
          <Table head={['Category', 'Normal balance']} rows={[
            ['Asset, Expense', 'Debit'],
            ['Liability, Equity, Revenue', 'Credit'],
          ]} />
        </Example>
      </Field>
      <Field name="Contra account">
        <P>An account that reduces another account in the same category. It has the opposite normal balance and shows as a deduction on your financial statements.</P>
        <P><i>Example:</i> Accumulated Depreciation reduces Equipment. Both are assets, but Equipment increases with a debit, and Accumulated Depreciation increases with a credit.</P>
        <P><i>When to use it:</i> for amounts that reduce another account, like depreciation, expected bad debts, or sales returns.</P>
        <P><i>How to create one:</i></P>
        <Steps>
          <li>Add a posting account in the same category as the account it reduces. For Accumulated Depreciation, that&apos;s Asset.</li>
          <li>Switch its <b>normal balance</b> to the opposite side, from debit to credit in this example. Omne marks the account <b>Contra</b> in the chart.</li>
          <li>Put it under the same summary account as the account it reduces, so the summary shows the net amount.</li>
        </Steps>
      </Field>
      <Field name="Account role">
        <P>Tells Omne what the account is for, like Bank or Accounts Receivable. Optional. The roles you can pick depend on the statement classification.</P>
        <P><i>When to use it:</i> when the account has a specific job in Omne, like a bank account you pay vendors from.</P>
      </Field>
      <Field name="Control account">
        <P>An account that has to match a list in Omne, like customers or items. Omne sets it from the account&apos;s role, and only Omne records transactions in it.</P>
        <P><i>Example:</i> Accounts Receivable matches your customer invoices. When you invoice a customer, Omne updates the account.</P>
        <P>You can post a manual journal entry to a control account only as an exception, to fix something the source records can&apos;t. A written reason is required.</P>
      </Field>
      <Field name="Currency">
        <P>Only Bank and Cash on Hand accounts can have their own currency. Every other account uses your base currency.</P>
        <P><i>When to use it:</i> when the account holds money in another currency, like a euro bank account.</P>
      </Field>
      <Field name="Dimensions">
        <P>Posting accounts only. Use dimensions to group and filter your accounts, for example by location or department. Select one or more values for each dimension. If you select more than one, mark one as the default.</P>
        <Example>
          <Table head={['GL account no.', 'Name', 'Location', 'Department']} rows={[
            ['51090', 'Travel', 'USA (default), Singapore', 'Sales'],
            ['51080', 'Advertising', 'Hong Kong', 'Marketing'],
            ['51060', 'Software', 'USA', 'Engineering'],
          ]} />
        </Example>
        <P><i>Filtering:</i> filter Location by Singapore and you see 51090. Filter by USA and you see 51090 and 51060.</P>
        <P><i>Posting:</i> when you use 51090 Travel in a journal entry, the line fills in with USA and Sales. USA is the default location, and you can switch it to Singapore on that line.</P>
      </Field>
      <Field name="Restricted account">
        <P>Only people you give access to can see this account, its balance, and its transactions. For example, your bookkeeper can work in the operating account without seeing the money market account that holds your reserves.</P>
      </Field>
      <Field name="Status">
        <Points>
          <li><b>Active:</b> can be used in transactions.</li>
          <li><b>Inactive:</b> stops accepting new postings. It stays in your chart of accounts with its balance and history, and you can reactivate it anytime.</li>
        </Points>
        <P>New accounts are Active. Choose Inactive if you&apos;re adding an account you&apos;re not ready to use.</P>
      </Field>
      <Sub>In the chart of accounts</Sub>
      <P>Once you publish, the chart shows two balances for every account. Both follow the period you select at the top of the chart.</P>
      <Field name="Opening balance">
        <P>The account&apos;s balance at the start of the selected period, before anything posted in it.</P>
        <P><i>Example:</i> with October 2026 selected, the opening balance is the balance on October 1, 2026.</P>
        <P>Revenue and expense accounts start each fiscal year at zero, because the year-end close moves their balances to retained earnings. Their opening balance in the first period of a year is zero.</P>
      </Field>
      <Field name="Running balance">
        <P>The account&apos;s balance right now, including everything posted in the selected period.</P>
        <P><i>Example:</i> Cash opened October at $48,200.00. Since then, $5,000.00 came in and $3,100.00 went out. Its running balance is $50,100.00.</P>
      </Field>
      <P>For a summary account, both balances are the total of the accounts under it.</P>
    </>,
  },
  {
    title: 'How should I organize my chart?',
    body: <>
      <P>None of these are required, but they keep your chart clear and your reports easy to read.</P>
      <P><b>Group accounts under summary accounts</b></P>
      <P>Use summary accounts for the lines you want on your financial statements, like Current Assets or Operating Expenses. Put posting accounts underneath for the detail. Two or three levels are enough for most businesses.</P>
      <P><b>Add a posting account only when you need its balance on its own</b></P>
      <P>You don&apos;t need an account for each customer, vendor, or item. Omne already keeps that detail in your customer, vendor, and item lists.</P>
      <Example>
        <Table head={['Add a posting account for', "Don't add a posting account for"]} rows={[
          ['Each bank account, like Operating - Chase Bank', 'Each customer'],
          ['A cost you want to see on its own, like Software Subscriptions', 'Each vendor'],
          ['A type of income you report separately, like Service Revenue', 'Each item'],
        ]} />
      </Example>
      <P><b>Use dimensions, not account numbers, for locations and departments</b></P>
      <P>One Travel account tagged USA and Singapore is easier to manage than a separate Travel account for each location.</P>
      <P><b>Keep contra accounts with the account they reduce</b></P>
      <P>Put the contra account under the same summary as the account it reduces. The summary then shows the net amount, which is the figure your financial statements report.</P>
      <Example>
        <Table head={['GL account no.', 'GL account name', 'Balance']} shares={[0.8, 1.7, 0.7]} rows={[
          ['15100', 'Equipment, net (summary)', '$40,000.00'],
          ['15110', 'Equipment', '$60,000.00'],
          ['15190', 'Accumulated Depreciation - Equipment (contra)', '-$20,000.00'],
        ]} />
      </Example>
      <P><b>Name accounts clearly</b></P>
      <P>A name should make sense on a report with no other context. &quot;Operating - Chase Bank&quot; is clear. &quot;Bank 1&quot; isn&apos;t.</P>
    </>,
  },
  ...(publishLabel ? [{
    title: 'What happens when I publish?',
    body: <>
      <P>Selecting <b>{publishLabel}</b> saves your accounts as your chart of accounts. Your team can then use them in transactions.</P>
      <P><b>After publishing, you can:</b></P>
      <Points>
        <li>Edit any account from the chart of accounts.</li>
        <li>Add new accounts.</li>
        <li>Deactivate accounts you want to stop using. A deactivated account stops accepting new postings, keeps its balance and history, and can be reactivated anytime.</li>
        <li>Archive accounts you no longer need. They move off the chart and out of reports, and their history is kept.</li>
        <li>Delete an archived account that never had a transaction.</li>
      </Points>
      <P><b>Archiving needs a zero balance.</b> Archived accounts can&apos;t hold a balance, so move it to another account first. The move is posted as a journal entry dated today, and past postings stay on the archived account. Revenue and expense balances move to retained earnings at the year-end close, so archive those accounts after the close, before anything new is posted to them.</P>
      <P><b>Some fields lock after an account&apos;s first transaction.</b> Its number, type, normal balance, role, and statement classification can&apos;t change. You can still edit its name, status, and dimensions.</P>
      <P><b>An account can&apos;t move to a different parent.</b> To reorganize later, add a new summary account above the accounts you want to group.</P>
      <P><b>Before you publish, check that:</b></P>
      <Points>
        <li>Every posting account sits under the right parent.</li>
        <li>GL account names are clear and don&apos;t include numbers.</li>
        <li>Contra accounts sit with the accounts they reduce.</li>
      </Points>
    </>,
  }] : []),
]

const ACCOUNTS_SUBTITLE = 'How to add, organize, and publish the accounts in your chart.'

export const GUIDED_ACCOUNTS_READING_ROOM: ReadingRoomConfig = {
  title: 'Accounts',
  subtitle: ACCOUNTS_SUBTITLE,
  sections: accountsSections({ addLabel: 'Add account', publishLabel: 'Publish chart' }),
}

export const SCRATCH_ACCOUNTS_READING_ROOM: ReadingRoomConfig = {
  title: 'Accounts',
  subtitle: ACCOUNTS_SUBTITLE,
  sections: accountsSections({ addLabel: 'Add account', publishLabel: 'Publish' }),
}

/* The chart page's: the same guide (Mahad, 2026-10-08: *"use the exact same
   content as we did in the build from scratch and guided setup in account
   step"*), read where the chart is live. Named for its page, as each setup
   step's guide is named for its step. */
export const CHART_READING_ROOM: ReadingRoomConfig = {
  title: 'Chart of accounts',
  subtitle: 'How to add and organize the accounts in your chart.',
  sections: accountsSections({ addLabel: 'Create GL account' }),
}
