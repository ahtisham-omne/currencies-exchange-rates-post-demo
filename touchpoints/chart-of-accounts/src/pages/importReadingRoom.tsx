import type { ReactNode } from 'react'
import { Quoted } from '../components/ui'
import { WalkthroughLink, type ReadingRoomConfig } from '../components/walkthrough/ReadingRoom'
import { EXAMPLE_FILTERS } from '../components/walkthrough/walkthroughExample'
import { TEMPLATE_COLUMNS, type RowField } from '../lib/importTemplate'
import { ACCOUNT_TYPE_META, CATEGORY_ORDER, CLASSIFICATIONS_BY_CATEGORY, ROLES_BY_CATEGORY, SOLE_ROLES } from '../types'

/* ──────────────────────────────────────────────────────────────────
 * WHAT THE IMPORT'S READING ROOM SAYS
 *
 * One guide in two parts. The first is about the file: which columns are
 * required, what each one is for, and every value a column will take. The
 * second is about the account number itself, which is a new idea for most
 * readers and needs a page rather than a tooltip.
 *
 * Each part belongs to a step, and the panel shows only the part for the step
 * the reader is standing on: the file guide while they are choosing and mapping
 * a file, the dimension guide once they reach the numbering question. The two
 * are kept in one config so the copy and the tests that pin it stay in one
 * place; `importGuideFor` at the foot of this file scopes that config to the
 * one part the reader needs.
 *
 * This file holds copy and nothing else. The panel that renders it lives in
 * `components/walkthrough/ReadingRoom.tsx`; a component declared beside these
 * configs would cost the module its fast refresh.
 *
 * ──── COPY ────
 * Sentence case, no em dashes, third person. A section body is a node rather
 * than a string so it can carry more than one paragraph and can show a worked
 * example, which several of these need.
 *
 * ──── WHAT IS DERIVED, AND WHY ────
 * Every column name, every explanation, every allowed value and every role is
 * read off `TEMPLATE_COLUMNS` and the type constants. The guide and the file it
 * describes are two readings of one thing, and a guide typed out by hand is a
 * guide that goes stale the first time a column moves.
 * ────────────────────────────────────────────────────────────────── */

function P({ children }: { children: ReactNode }) {
  return <p className="mb-2 last:mb-0">{children}</p>
}

/* The panel a worked example sits in. Whiter and harder-edged than the section
   card around it, so it reads as a specimen rather than as more prose. */
function Example({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={'rounded-lg border border-border bg-white/70 px-3 py-2.5 my-2.5 text-13 tabular-nums ' + (className ?? '')}
    >
      {children}
    </div>
  )
}

/* A named thing and what it is. Carries the field reference, the roles under
   each category and the three answers the numbering step takes, all of which
   are the same shape: a label the reader is scanning for, and a line under it.
   The label is where the em dash would have gone. */
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mb-2.5 last:mb-0">
      <div className="text-13 font-semibold text-fg">{label}</div>
      <div className="text-13 text-slate-700 mt-0.5 leading-[1.6]">{children}</div>
    </div>
  )
}

// =========================
// Part one: the file.
// =========================

/* Required first, then optional, which is not the order the columns sit in the
   file. A reader filling the sheet in reads left to right; a reader looking a
   column up wants the four they cannot skip named together. */
const FIELD_REFERENCE = [
  ...TEMPLATE_COLUMNS.filter(c => c.required),
  ...TEMPLATE_COLUMNS.filter(c => !c.required),
]

/* What a blank cell does, in a clause. The template's own Field Reference tab
   answers the same question as a noun ("Your base currency") under a column
   headed "If you leave it blank"; here the label stands alone and has to read
   as a sentence. Keyed by field, so an optional column added to the template
   without one fails the test rather than printing a label with a gap in it. */
const BLANK_MEANS: Partial<Record<RowField, string>> = {
  description: 'Blank leaves it empty',
  classification: 'Blank has Omne work it out',
  normalBalance: 'Blank sets it from the category',
  parent: 'Blank sits it under its category',
  role: 'Blank means no role',
  currency: 'Blank means your base currency',
  status: 'Blank means Active',
}

/* What this panel says about a column that the file cannot say for itself. One
   tells the reader a hyphenated number becomes dimensions, which the numbering
   step then explains in full; the other is about commas, which are only a
   problem in the CSV and would be advice about the wrong file on an Excel tab. */
const MORE: Partial<Record<RowField, ReactNode>> = {
  number: (
    <span className="block mt-1.5">
      If your numbers have separators, such as hyphens, periods or spaces, import them as they are.
      Omne recognises this as a segmented account number and gives you the option to create
      dimensions from its segments.
    </span>
  ),
  description: <>{' '}If you use a comma, wrap the whole cell in double quotes.</>,
}

const fieldLabel = (header: string, required: boolean, blank?: string) =>
  required ? `${header} · Required` : `${header} · Optional · ${blank}`

// The values a column's dropdown offers, so the allowed list and the dropdown
// in the file cannot come to disagree.
const listed = (field: RowField) => {
  const list = TEMPLATE_COLUMNS.find(c => c.field === field)?.list
  return list && 'values' in list ? list.values.join(', ') : ''
}

// 'Balance Sheet' is how the code names it; a sentence names it 'Balance sheet'.
const sentenceCase = (s: string) => s.charAt(0) + s.slice(1).toLowerCase()

// =========================
// Part two: the number.
//
// The one labelled value the walkthrough teaches from. The tour's last card
// sends the reader here calling it the same guide in writing, and two worked
// examples of one idea have the reader checking whether they are looking at the
// same thing.
// =========================
const LABELLED = EXAMPLE_FILTERS[0].values.find(v => v.label)!

export const DIMENSIONS_SECTION = 'What is a segment'

/* The two halves of the guide, each the eyebrow over the sections it owns and
   each shown on its own step. `importGuideFor` reads them back to scope the
   panel; keeping the group names here is what lets the sections and the scope
   never drift apart. */
export const IMPORT_GUIDE_GROUP = 'COA import guide'
export const DIMENSION_GUIDE_GROUP = 'What is a segment'

export const IMPORT_READING_ROOM: ReadingRoomConfig = {
  title: 'Importing accounts in Omne',
  sections: [
    {
      group: IMPORT_GUIDE_GROUP,
      title: 'Filling in the CSV',
      body: (
        <>
          <P>
            Row 1 is the column headers. Each row below it is one account. Two example rows show the
            format. Delete both before you import.
          </P>
          <P>
            Four columns are required and cannot be left blank. The other seven are optional: leave
            a cell blank to use the default, and only fill one in to change it.
          </P>
        </>
      ),
    },
    {
      group: IMPORT_GUIDE_GROUP,
      title: 'Field reference',
      body: (
        <>
          {FIELD_REFERENCE.map(c => (
            <Field key={c.header} label={fieldLabel(c.header, c.required, BLANK_MEANS[c.field])}>
              {c.about}
              {MORE[c.field]}
            </Field>
          ))}
        </>
      ),
    },
    {
      group: IMPORT_GUIDE_GROUP,
      title: 'Categories',
      body: (
        <>
          <Example className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-2xs font-semibold uppercase tracking-[0.06em] text-fg-subtle">
                  <th className="pr-4 pb-1.5 font-semibold">Category</th>
                  <th className="pr-4 pb-1.5 font-semibold">Statement</th>
                  <th className="pb-1.5 font-semibold">Default normal balance</th>
                </tr>
              </thead>
              <tbody className="text-slate-700">
                {CATEGORY_ORDER.map(code => {
                  const meta = ACCOUNT_TYPE_META[code]
                  return (
                    <tr key={code} className="border-t border-border/70">
                      <td className="pr-4 py-1 text-fg whitespace-nowrap" style={{ fontWeight: 600 }}>
                        {meta.label}
                      </td>
                      <td className="pr-4 py-1 whitespace-nowrap">{sentenceCase(meta.statement)}</td>
                      <td className="py-1 whitespace-nowrap">{meta.normal}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </Example>
          <P>A contra account takes the opposite of its category's default normal balance.</P>
        </>
      ),
    },
    {
      group: IMPORT_GUIDE_GROUP,
      title: 'Account roles',
      body: (
        <>
          <P>An account can hold one role, and it must belong to the same category as the account.</P>
          {CATEGORY_ORDER.map(code => {
            const roles = ROLES_BY_CATEGORY[code]
            /* True of equity and nothing else, which is why the sentence can be
               attached by the fact rather than by naming the two roles again.
               Held to by the test beside this file. */
            const allSole = roles.length > 1 && roles.every(r => SOLE_ROLES.includes(r))
            return (
              <Field key={code} label={ACCOUNT_TYPE_META[code].label}>
                {roles.join(', ')}
                {allSole && '. Each of these can be held by one account only.'}
              </Field>
            )
          })}
        </>
      ),
    },
    {
      group: IMPORT_GUIDE_GROUP,
      title: 'Allowed values',
      body: (
        <>
          <Field label="GL account category">{listed('category')}</Field>
          {/* The one column with a fixed list and no dropdown in the file. Which
              eleven of the thirteen are wrong depends on the category beside it,
              so they are named by category here rather than offered as a flat
              list the sheet would hand back wrong answers from. */}
          <Field label="Statement classification">
            Blank to have it worked out, or one of the thirteen that belongs to the account's own
            category:
            {CATEGORY_ORDER.map(code => (
              <span key={code} className="block mt-1">
                <span className="font-semibold text-fg">{ACCOUNT_TYPE_META[code].label}</span>{' '}
                {CLASSIFICATIONS_BY_CATEGORY[code].join(', ')}
              </span>
            ))}
          </Field>
          <Field label="GL account type">{listed('glType')}</Field>
          <Field label="Normal balance">{listed('normalBalance')}. Blank sets it from the category. Posting accounts only.</Field>
          <Field label="Status">{listed('status')}. Blank means Active.</Field>
        </>
      ),
    },
    /* The recommendation from the design review of 2026-09-24: renumber to fit
       rather than switch number protection off. Said up front, where the file is
       still being prepared, and again on the review step if the numbers clash. */
    {
      group: IMPORT_GUIDE_GROUP,
      title: 'Numbers from another system',
      body: (
        <>
          <P>
            Omne keeps each branch of your chart in one run of numbers: a summary account and every account under it sit
            together, and nothing from another branch sits between them. This is called number protection.
          </P>
          <P>
            If your old system numbered things differently, we recommend giving the accounts new numbers that fit, in the file
            or on the review step. The number each account had before stays on it as its prior account number, and you can
            still search by it.
          </P>
          <P>
            If you would rather keep your numbers, you can. The review step shows which accounts sit among another branch's
            numbers, and importing them as they are turns number protection off for your chart.
          </P>
        </>
      ),
    },
    {
      group: IMPORT_GUIDE_GROUP,
      title: 'What this import does not include',
      body: (
        <P>
          Bank name, account number and card details are not columns here. An account with a Bank or
          Credit Card role imports marked Needs details, and you complete it in Omne afterwards.
        </P>
      ),
    },
    {
      group: IMPORT_GUIDE_GROUP,
      title: 'File limits',
      body: (
        <P>
          Excel or CSV, up to 10 MB. Keep the header row as it is and do not add columns of your own.
        </P>
      ),
    },
    {
      group: DIMENSION_GUIDE_GROUP,
      title: DIMENSIONS_SECTION,
      body: (
        <>
          <P>
            A segment is one part of a segmented account number. Each part may represent something
            different.
          </P>
          <P>
            For example, in <Quoted>01-100-5020</Quoted>, Omne recognises three parts:{' '}
            <Quoted>01</Quoted>, <Quoted>100</Quoted>, and <Quoted>5020</Quoted>. Each part is a
            segment that you can define and give a label.
          </P>
        </>
      ),
    },
    {
      group: DIMENSION_GUIDE_GROUP,
      title: 'How older systems did it',
      body: (
        <>
          <P>
            Older systems let you combine several segments into one account number. You defined what
            each part meant, then kept the whole thing as one long number.
          </P>
          <P>
            The information was there, but you had to know the structure to understand each part. A
            shorter account number, like <Quoted>5020</Quoted>, is easier to read, type, and remember
            than <Quoted>01-100-5020</Quoted>.
          </P>
        </>
      ),
    },
    {
      group: DIMENSION_GUIDE_GROUP,
      title: 'How Omne does it',
      body: (
        <>
          <P>
            Omne asks if your account numbers have multiple segments. If you say yes, Omne splits each
            number wherever it finds a character that is not a letter or a digit, such as a hyphen, a
            period, a space or a slash.
          </P>
          <P>You then define each segment:</P>
          <Field label="GL account number">
            The segment that identifies each unique account in your file.
          </Field>
          <Field label="Dimension">
            A segment that becomes a dimension you can filter accounts by, such as showing only
            accounts for <Quoted>London</Quoted>.
          </Field>
          <Field label="Ignore">A segment you do not want to bring into Omne.</Field>
          <P>
            For each dimension, you can give its values labels. For example,{' '}
            <Quoted>{LABELLED.code}</Quoted> can be labelled {LABELLED.label}. Labelling is optional.
            If you leave a value blank, Omne uses the number itself as the label.
          </P>
          <P>
            If you say no, Omne imports your account numbers as they are, without separating them into
            segments. A number with no separator in it always imports whole.
          </P>
          <P>
            If you say yes but your account numbers have no separators, Omne will ask you to upload the
            file again in the expected format.
          </P>
          <P>
            <WalkthroughLink>Start the guided walkthrough</WalkthroughLink>
          </P>
        </>
      ),
    },
  ],
}

/* The guide the reader is standing in front of. The numbering step is the one
   about the account number, so it gets the dimension half; every other step
   where the panel opens is about the file, so it gets the file half. Kept as a
   filter of the one config, so a section moved between halves moves here too. */
export function importGuideFor(step: string): ReadingRoomConfig {
  const group = step === 'split' ? DIMENSION_GUIDE_GROUP : IMPORT_GUIDE_GROUP
  return {
    ...IMPORT_READING_ROOM,
    sections: IMPORT_READING_ROOM.sections.filter(s => s.group === group),
  }
}
