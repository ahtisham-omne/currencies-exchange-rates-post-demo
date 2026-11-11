/* Ported from the financial reporting module (components/fr/peopleData.ts).

   The roster the person cards read, so a hovered sender reads the same wherever
   the module names them. Contract is the source's (getPersonDetail /
   getPersonAvatar / getInitials) so its PersonHoverCard ports unchanged; only
   the people differ, and they are the ones `lib/comms.ts` actually seeds
   threads with, so a hovered name resolves to whoever sent the mail rather
   than to a stranger.

   Initials come from `initialsOf` rather than a second implementation - the
   avatars the reader hovers are drawn with it, and two rules would drift. */
import { CURRENT_USER as SEAT, SYSTEM_SENDER, initialsOf } from '../../lib/comms'

export interface PersonDetail {
  name: string
  role: string
  department: string
  /** The company the address belongs to. Outside correspondents are their own. */
  org: string
  email: string
  /** Empty for a mailbox that isn't a person, which the cards then skip. */
  phone: string
  avatar?: string
}

/* Addresses are copied from the seeded correspondents on purpose: a roster miss
   falls back to a generated address, and a sender whose real address is on the
   thread would then be shown one it never used. */
const ROSTER: PersonDetail[] = [
  { name: SEAT.name, role: 'Accounting Manager', department: 'Accounting', org: 'Omnesoft', email: SEAT.email, phone: '+1 (512) 555-0102' },
  { name: 'Ayesha Khan', role: 'Controller', department: 'Accounting', org: 'Omnesoft', email: 'ayesha.khan@omne.example', phone: '+1 (512) 555-0113' },
  { name: 'Daniel Osei', role: 'Accountant', department: 'Payables', org: 'Omnesoft', email: 'daniel.osei@omne.example', phone: '+1 (512) 555-0124' },
  { name: 'Priya Raman', role: 'Financial Analyst', department: 'Accounting', org: 'Omnesoft', email: 'priya.raman@omne.example', phone: '+1 (512) 555-0135' },
  { name: 'Tom Brennan', role: 'Group Reporting', department: 'Management', org: 'Omnesoft', email: 'tom.brennan@omne.example', phone: '+1 (512) 555-0146' },
  { name: 'Group treasury', role: 'Treasury', department: 'Management', org: 'Omnesoft', email: 'treasury@omne.example', phone: '+1 (512) 555-0157' },
  { name: 'Hartley & Co', role: 'External auditor', department: 'External', org: 'Hartley & Co', email: 'reviews@hartleyco.example', phone: '+1 (312) 555-0168' },
  { name: 'Meridian Supplies', role: 'Supplier', department: 'External', org: 'Meridian Supplies', email: 'ap@meridiansupplies.example', phone: '+1 (312) 555-0179' },
  { name: SYSTEM_SENDER.name, role: 'Automated Mailbox', department: 'Omne', org: 'Omnesoft', email: SYSTEM_SENDER.email, phone: '' },
]

/** Whoever is signed in. Read from the seat the comms module already owns rather
 *  than restated here, so the two cannot drift. */
export const CURRENT_USER = SEAT.name

/** `Name (me)` for the signed-in account, the plain name for anyone else. */
export function personLabel(name: string): string {
  return name === CURRENT_USER ? `${name} (me)` : name
}

/** Everyone the module knows, in roster order. */
export function allPeople(): PersonDetail[] {
  return ROSTER
}

export function getInitials(name: string): string {
  return initialsOf(name)
}

/* The department tints, in the source's shape. Departments this module has
   nobody in are dropped rather than kept pointing at colour primitives the
   `[data-comms]` block never declared. */
export const DEPT_PALETTES: Record<string, { bg: string; fg: string; border: string }> = {
  Accounting: { bg: 'var(--color-blue-50)', fg: 'var(--color-blue-800)', border: 'var(--color-blue-200)' },
  Receivables: { bg: 'var(--color-emerald-50)', fg: 'var(--color-emerald-800)', border: 'var(--color-emerald-200)' },
  Payables: { bg: 'var(--color-violet-50)', fg: 'var(--color-violet-800)', border: 'var(--color-violet-200)' },
  Management: { bg: 'var(--color-amber-100)', fg: 'var(--color-amber-800)', border: 'var(--color-amber-200)' },
  Operations: { bg: 'var(--color-slate-100)', fg: 'var(--color-slate-700)', border: 'var(--color-slate-200)' },
  External: { bg: 'var(--color-orange-50)', fg: 'var(--color-orange-800)', border: 'var(--color-orange-200)' },
  Omne: { bg: 'var(--color-brand-50)', fg: 'var(--color-brand-800)', border: 'var(--color-brand-175)' },
  General: { bg: 'var(--color-slate-100)', fg: 'var(--color-slate-700)', border: 'var(--color-slate-200)' },
}

export function deptPalette(department: string) {
  return DEPT_PALETTES[department] ?? DEPT_PALETTES.General
}

/**
 * The person behind a name. `emailHint` only fills the fallback: an outside
 * correspondent off the roster still reads as the address the thread carries,
 * rather than as a generated one that never existed.
 */
export function getPersonDetail(name: string, emailHint?: string): PersonDetail {
  const found = ROSTER.find(p => p.name === name)
  if (found) return found
  const slug = name.toLowerCase().replace(/[^a-z]+/g, '.').replace(/^\.+|\.+$/g, '')
  return {
    name,
    role: 'Team Member',
    department: 'General',
    org: 'Omnesoft',
    email: emailHint?.trim() || `${slug}@omnesoft.com`,
    phone: '+1 (512) 555-0100',
  }
}

export function getPersonAvatar(name: string): string {
  return getPersonDetail(name).avatar ?? ''
}
