/* Ported from the vendor invoicing module
   (src/app/components/vendors/SearchableUserPicker.tsx), 1 to 1.

   Mahad, 2026-09-29, of the dialog this used to draw: *"Can we have the exact
   same UI as we have in vendor invoicing?"* So the markup, sizes, colours and
   behaviour are the source's, including the parts the earlier partners port had
   left out or reworded:
   - Roles lead the tabs and open first. No Department filter beside them:
     Mahad, 2026-10-14, *"remove department dropdown from here please."* The
     Department column stays, and the search still reads it.
   - A role row counts the people it reaches, explains itself on its (i), and
     opens its members under "See users".
   - A search reads both lists at once, grouped, whichever tab is open.
   - The count is people, not picks: a role resolves to its members, deduplicated
     against anyone picked by name.
   - Once someone is picked, the trigger is one summary row (stacked initials, the
     count, Manage) whose hover card names them, rather than a list that grows.

   What stays this module's own:
   - The people are this module's roster (`peopleData`), the same names a comms
     thread or a person card shows. Only people inside the company are offered:
     this tells a colleague about an entry, and outside correspondents are not
     colleagues.
   - It is built on this module's portal rather than the source's Radix Dialog
     and Popover, which this module does not have.
   - The title is sentence case, per the module's copy rules.
   - The accent is a tone, mapped onto the source's four accent values: its
     defaults for `primary`, and its payment hold accents for `warning`. */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowRight, Bell, Info, Lock, Plus, Search, Shield, Users, X, type LucideIcon } from 'lucide-react'
import { allPeople, CURRENT_USER } from './comms/peopleData'
import { initialsOf, SYSTEM_SENDER } from '../lib/comms'
import { Tooltip, useEscapeToClose } from './ui'

export interface NotifyRole { id: string; name: string; description: string; department: string; people: { name: string; email: string }[] }
export interface NotifyUser { id: string; name: string; role: string; department: string; email: string }

/* What each role on the roster is for, shown on the role row's (i). */
const ROLE_DESCRIPTIONS: Record<string, string> = {
  'Accounting Manager': 'Runs the accounting team, the month end close and the chart of accounts.',
  'Controller': 'Oversees accounting operations and financial reporting.',
  'Accountant': 'Records and reconciles day to day entries.',
  'Financial Analyst': 'Analyzes results, variances and forecasts.',
  'Group Reporting': 'Consolidates results across the group for reporting.',
  'Treasury': 'Manages cash, bank accounts and funding.',
}

/* Everyone the reader can tell about something, and the roles they fill. Roles
   are read off the people rather than kept as a list of their own, so a role is
   never offered with nobody in it. */
export function notifyDirectory(): { roles: NotifyRole[]; users: NotifyUser[] } {
  const staff = allPeople().filter(p => p.org === 'Omnesoft' && p.name !== SYSTEM_SENDER.name && p.department !== 'External')
  const users = staff
    .filter(p => p.name !== CURRENT_USER)
    .map(p => ({ id: `user:${p.email}`, name: p.name, role: p.role, department: p.department, email: p.email }))
  const byRole = new Map<string, NotifyRole>()
  for (const p of staff) {
    const r = byRole.get(p.role) ?? { id: `role:${p.role}`, name: p.role, description: ROLE_DESCRIPTIONS[p.role] ?? '', department: p.department, people: [] }
    r.people.push({ name: p.name, email: p.email })
    byRole.set(p.role, r)
  }
  return { roles: [...byRole.values()], users }
}

/** The picked ids as the names and addresses a notification is sent to. */
export function notifyRecipients(ids: Set<string>): { names: string[]; emails: string[] } {
  const { roles, users } = notifyDirectory()
  const names: string[] = []
  const emails: string[] = []
  for (const r of roles) if (ids.has(r.id)) { names.push(`${r.name} (role)`); emails.push(...r.people.map(p => p.email)) }
  for (const u of users) if (ids.has(u.id)) { names.push(u.name); emails.push(u.email) }
  return { names, emails: [...new Set(emails)] }
}

type Tone = 'primary' | 'warning'
/* The source's accent props, per tone: its defaults, and its payment hold
   accents, which is the source's own amber notify. */
const ACCENTS: Record<Tone, { color: string; bg: string; border: string; text: string }> = {
  primary: { color: 'hsl(var(--primary))', bg: 'hsl(var(--accent))', border: '#BFDBFE', text: '#1E40AF' },
  warning: { color: '#A16207', bg: '#FEFCE8', border: '#FEF08A', text: '#A16207' },
}

const ROLE_COLORS = ['hsl(var(--accent))', '#F0FDF4', '#F5F3FF', '#FEFCE8', '#FEF2F2', '#ECFDF5', '#FDF4FF', '#FFFBEB']
const ROLE_TEXT_COLORS = ['#1D4ED8', '#15803D', 'hsl(var(--violet))', '#A16207', 'hsl(var(--destructive))', 'hsl(var(--success))', '#A21CAF', '#B45309']
const USER_BG_COLORS = ['#DBEAFE', '#D1FAE5', '#EDE9FE', '#FEF9C3', '#FEE2E2', '#CFFAFE', '#FCE7F3', '#FEF3C7']
const USER_TEXT_COLORS = ['#1E40AF', '#166534', '#5B21B6', '#854D0E', '#991B1B', '#0E7490', '#9D174D', '#92400E']

const getRoleColor = (i: number) => ({ bg: ROLE_COLORS[i % ROLE_COLORS.length], text: ROLE_TEXT_COLORS[i % ROLE_TEXT_COLORS.length] })
const getUserColor = (i: number) => ({ bg: USER_BG_COLORS[i % USER_BG_COLORS.length], text: USER_TEXT_COLORS[i % USER_TEXT_COLORS.length] })

function HighlightText({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'))
  return <>{parts.map((p, i) => p.toLowerCase() === query.toLowerCase()
    ? <mark key={i} className="bg-transparent px-0.5 rounded-sm" style={{ backgroundColor: '#FEFCE8', color: '#854D0E', fontWeight: 500 }}>{p}</mark>
    : <React.Fragment key={i}>{p}</React.Fragment>)}</>
}

const CheckMark = () => (
  <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
)

function CheckBox({ on, color }: { on: boolean; color: string }) {
  return (
    <div className="w-[16px] h-[16px] rounded-[4px] border-[1.5px] flex items-center justify-center shrink-0 transition-all"
      style={{ borderColor: on ? color : '#CBD5E1', backgroundColor: on ? color : 'transparent' }}>
      {on && <CheckMark />}
    </div>
  )
}

/** Expandable member preview for a role: first N people, "+X more". */
function RoleUsersPreview({ people }: { people: { name: string; email: string }[] }) {
  const SHOWN = 8
  const shown = people.slice(0, SHOWN)
  const more = people.length - shown.length
  return (
    <div className="mt-1.5 rounded-lg border border-border/70 bg-slate-50/60 max-h-[148px] overflow-y-auto divide-y divide-border/50">
      {shown.map((u, i) => {
        const c = getUserColor(i)
        return (
          <div key={u.email} className="flex items-center gap-2 px-2.5 py-1.5">
            <span className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] shrink-0" style={{ fontWeight: 700, backgroundColor: c.bg, color: c.text }}>
              {initialsOf(u.name)}
            </span>
            <span className="text-[11px] text-foreground truncate flex-1" style={{ fontWeight: 500 }}>{u.name}</span>
            <span className="text-[10px] text-slate-400 truncate max-w-[140px]">{u.email}</span>
          </div>
        )
      })}
      {more > 0 && (
        <div className="px-2.5 py-1.5 text-[10px] text-slate-400" style={{ fontWeight: 600 }}>+{more} more</div>
      )}
      {people.length === 0 && (
        <div className="px-2.5 py-2 text-[11px] text-slate-400">No active users in this role yet.</div>
      )}
    </div>
  )
}

/* The source's hover panel over the stacked avatars (its data-table
   OverflowTooltip, in the initials form this picker draws). Every row and the
   footer link open Manage. */
interface RecipientItem { id: string; name: string; subtitle: string; initials: string; avatarBg: string; avatarFg: string }
const TIP_MAX_VISIBLE = 10
const TIP_SCROLL_VISIBLE = 5
const TIP_ROW_H = 44
const tipWidth = () => (window.innerWidth < 640 ? 220 : window.innerWidth < 1024 ? 250 : 280)

function RecipientsHoverCard({ items, category, onItemClick, onViewMore, viewMoreLabel, children }: {
  items: RecipientItem[]
  category: string
  onItemClick: () => void
  onViewMore: () => void
  viewMoreLabel: string
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [box, setBox] = useState({ top: 0, left: 0, width: 280, above: false })
  const trigger = useRef<HTMLSpanElement>(null)
  const openAt = useRef<number>()
  const closeAt = useRef<number>()

  const place = useCallback(() => {
    const r = trigger.current?.getBoundingClientRect()
    if (!r) return
    const width = tipWidth()
    const h = Math.min(items.length, TIP_SCROLL_VISIBLE) * TIP_ROW_H + 40
    const above = r.bottom + h + 8 > window.innerHeight && r.top - h - 8 > 0
    setBox({
      top: above ? r.top - h - 6 : r.bottom + 6,
      left: Math.max(8, Math.min(r.left + r.width / 2 - width / 2, window.innerWidth - width - 8)),
      width,
      above,
    })
  }, [items.length])

  useEffect(() => {
    if (!open) return
    const on = () => place()
    window.addEventListener('scroll', on, true)
    window.addEventListener('resize', on)
    return () => { window.removeEventListener('scroll', on, true); window.removeEventListener('resize', on) }
  }, [open, place])
  useEffect(() => () => { window.clearTimeout(openAt.current); window.clearTimeout(closeAt.current) }, [])

  const enter = () => { window.clearTimeout(closeAt.current); openAt.current = window.setTimeout(() => { place(); setOpen(true) }, 180) }
  const leave = () => { window.clearTimeout(openAt.current); closeAt.current = window.setTimeout(() => setOpen(false), 120) }

  const max = window.innerHeight < 600 ? 7 : TIP_MAX_VISIBLE
  const visible = items.slice(0, max)
  const showViewMore = items.length > max
  const scrolls = items.length > TIP_SCROLL_VISIBLE
  const pick = (fn: () => void) => (e: React.SyntheticEvent) => { e.stopPropagation(); setOpen(false); fn() }

  return (
    <>
      <span ref={trigger} onMouseEnter={enter} onMouseLeave={leave} className="cursor-default">{children}</span>
      {open && createPortal(
        <div onMouseEnter={() => window.clearTimeout(closeAt.current)} onMouseLeave={leave}
          className="fixed z-[300] pointer-events-auto"
          style={{ top: box.top, left: box.left, width: box.width, animation: 'coaOverflowTipIn 120ms ease-out forwards' }}>
          <div className="absolute left-1/2 -translate-x-1/2" style={box.above ? { bottom: -4 } : { top: -4 }}>
            <div className="w-2 h-2 rotate-45 bg-white border-border/50"
              style={box.above ? { borderBottomWidth: 1, borderRightWidth: 1 } : { borderTopWidth: 1, borderLeftWidth: 1 }} />
          </div>
          <div className="bg-white rounded-lg border border-border/50 overflow-hidden" style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.04)' }}>
            <div className="px-3 pt-2.5 pb-1.5 flex items-center justify-between">
              <span className="text-[11px] tracking-wide text-muted-foreground/70" style={{ fontWeight: 600 }}>{category}</span>
              <span className="text-[10px] text-muted-foreground/50">{items.length}</span>
            </div>
            <div className={`px-1.5 pb-1.5 ${scrolls ? 'overflow-y-auto' : ''}`} style={scrolls ? { maxHeight: TIP_SCROLL_VISIBLE * TIP_ROW_H } : undefined}>
              {visible.map(item => (
                <div key={item.id} role="button" tabIndex={0} onClick={pick(onItemClick)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(onItemClick)(e) } }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md transition-colors hover:bg-muted cursor-pointer text-left group/ovitem">
                  <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 text-[9px]"
                    style={{ backgroundColor: item.avatarBg, color: item.avatarFg, fontWeight: 600 }}>
                    {item.initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[12px] truncate block text-foreground group-hover/ovitem:text-primary group-hover/ovitem:underline transition-colors" style={{ fontWeight: 500 }}>{item.name}</span>
                    {item.subtitle && <span className="text-[10px] text-muted-foreground/60 block truncate">{item.subtitle}</span>}
                  </div>
                </div>
              ))}
            </div>
            {showViewMore && (
              <div className="border-t border-border/40">
                <button type="button" onClick={pick(onViewMore)}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 text-[11px] text-primary hover:bg-primary/5 transition-colors cursor-pointer" style={{ fontWeight: 600 }}>
                  <span>{viewMoreLabel}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}

/* What the picker calls itself and the people in it. The notification words are
   the default; a restricted account's access list uses the same dialog in its
   own words (Mahad, 2026-10-08: *"a small modal, just like our 'Notify' modal,
   where you can click and select the people you want to give access to"*). */
export interface PickerCopy {
  title: string
  subtitle: string
  /** The call to action while nothing is picked. */
  add: string
  /** What one and several of the picked people are called. */
  one: string
  many: string
  icon: LucideIcon
}
const NOTIFY_COPY: PickerCopy = {
  title: 'Notification recipients',
  subtitle: 'Select roles or individual users to notify',
  add: 'Add notification recipients',
  one: 'recipient',
  many: 'recipients',
  icon: Bell,
}
const capital = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)

/* Someone who is always on the list and cannot be taken off it: shown ticked,
   greyed and locked, with why. A restricted account's owner (Eli, 2026-10-08:
   *"the account owner role will always show as available and blocked and
   grayed out"*). */
export interface LockedPick { id: string; name: string; note: string }

/** The picked roles and people, by name, for a surface that states the list
 *  rather than editing it. */
export function describePicked(ids: Iterable<string>): string[] {
  const { roles, users } = notifyDirectory()
  const picked = new Set(ids)
  return [...roles.filter(r => picked.has(r.id)).map(r => r.name), ...users.filter(u => picked.has(u.id)).map(u => u.name)]
}

export function NotifyRecipientsPicker({ selectedIds, onSelectionChange, tone = 'primary', label = 'Select recipients', copy = NOTIFY_COPY, inline = false, locked = [], list = false }: {
  selectedIds: Set<string>
  onSelectionChange: (ids: Set<string>) => void
  tone?: Tone
  label?: string
  copy?: PickerCopy
  /** A compact trigger that sits beside another control rather than filling a row. */
  inline?: boolean
  /** Always on the list, never removable. */
  locked?: LockedPick[]
  /** The Partners picker's selected list: a white card per role and person,
      with a dashed Manage button under it, instead of the one-row summary.
      Mahad, 2026-10-08: the summary's tinted row *"shouldn't be there ... only
      use the UI patterns from partners"*. Also Eli's Manage that stays a button. */
  list?: boolean
}) {
  const Icon = copy.icon
  const noun = (n: number) => (n === 1 ? copy.one : copy.many)
  const { color: accentColor, bg: accentBg, border: accentBorder, text: accentText } = ACCENTS[tone]
  const { roles, users } = useMemo(notifyDirectory, [])
  const [modalOpen, setModalOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<'roles' | 'users'>('roles')
  const [expandedRoles, setExpandedRoles] = useState<Set<string>>(new Set())
  const close = useCallback(() => setModalOpen(false), [])
  useEscapeToClose(modalOpen, close)

  const filteredUsers = useMemo(() => {
    let list = users
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(u => u.name.toLowerCase().includes(q) || u.role.toLowerCase().includes(q) || u.department.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
    }
    return list
  }, [users, search])

  const filteredRoles = useMemo(() => {
    let list = roles
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(r => r.name.toLowerCase().includes(q) || r.department.toLowerCase().includes(q))
    }
    return list
  }, [roles, search])

  const selectedUsers = useMemo(() => users.filter(u => selectedIds.has(u.id)), [users, selectedIds])
  const selectedRoles = useMemo(() => roles.filter(r => selectedIds.has(r.id)), [roles, selectedIds])
  /* The count is the people who will be told: a role resolves to its members,
     deduplicated against anyone picked by name. */
  const totalSelected = useMemo(() => {
    const people = new Set(selectedUsers.map(u => u.email))
    selectedRoles.forEach(r => r.people.forEach(p => people.add(p.email)))
    return people.size
  }, [selectedUsers, selectedRoles])

  const toggle = (id: string) => { const next = new Set(selectedIds); next.has(id) ? next.delete(id) : next.add(id); onSelectionChange(next) }
  const toggleExpanded = (id: string) => setExpandedRoles(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
  // What the trigger counts: the picked people and anyone who is always there.
  const shownCount = totalSelected + locked.length
  const openManage = () => { setModalOpen(true); setSearch('') }

  return (
    <div data-notify-picker className={inline ? 'inline-flex' : list ? 'w-full' : undefined}>
      {label && !inline && (
        <div className="mb-2">
          <p className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>{label}</p>
        </div>
      )}

      {/* One fixed-height summary row: stacked initials, the count, Manage. It
          never grows with the selection; the hover card names everyone, and
          Manage is the place to change them. */}
      {!list && shownCount > 0 && (() => {
        const entries = [
          ...locked.map(l => ({ id: l.id, name: l.name, isRole: false, count: 0, sub: 'Always has access', locked: true })),
          ...selectedRoles.map(r => ({ id: r.id, name: r.name, isRole: true, count: r.people.length, sub: '', locked: false })),
          ...selectedUsers.map(u => ({ id: u.id, name: u.name, isRole: false, count: 0, sub: u.role, locked: false })),
        ]
        const STACKED = 4
        const stacked = entries.slice(0, STACKED)
        const extra = entries.length - stacked.length
        return (
          <div className={inline ? 'inline-flex items-center gap-2 h-8 px-2.5 rounded-md border' : 'flex items-center gap-2 h-9 px-2.5 rounded-md border'} style={{ backgroundColor: accentBg, borderColor: accentBorder }}>
            <RecipientsHoverCard
              category={capital(copy.many)}
              items={entries.map(e => ({
                id: e.id,
                name: e.name,
                subtitle: e.isRole ? `Role · ${e.count} ${noun(e.count)}` : e.sub,
                initials: initialsOf(e.name),
                avatarBg: accentBg,
                avatarFg: accentText,
              }))}
              onItemClick={openManage}
              onViewMore={openManage}
              viewMoreLabel={`Manage all ${shownCount} ${copy.many}`}
            >
              <span className="flex items-center cursor-default">
                {stacked.map((e, i) => (
                  <span key={e.id}
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[8px] ring-2 ring-white shrink-0 overflow-hidden ${i > 0 ? '-ml-1' : ''}`}
                    style={{ fontWeight: 700, backgroundColor: e.locked ? '#94A3B8' : accentColor, color: '#fff', zIndex: STACKED - i }}>
                    {initialsOf(e.name)}
                  </span>
                ))}
                {extra > 0 && (
                  <span className="w-6 h-6 rounded-full flex items-center justify-center text-[8px] ring-2 ring-white bg-white shrink-0 -ml-1.5" style={{ fontWeight: 700, color: accentText }}>
                    +{extra}
                  </span>
                )}
              </span>
            </RecipientsHoverCard>
            <span className="text-[11px] min-w-0 truncate" style={{ fontWeight: 600, color: accentText }}>
              {shownCount} {noun(shownCount)}
            </span>
            <button type="button" onClick={e => { e.stopPropagation(); e.preventDefault(); openManage() }}
              className={inline ? 'ml-1 text-[11px] shrink-0 hover:underline cursor-pointer' : 'ml-auto text-[11px] shrink-0 hover:underline cursor-pointer'} style={{ fontWeight: 600, color: accentText }}>
              Manage
            </button>
          </div>
        )
      })()}

      {/* One call to action per state: this exists only while nothing is picked. */}
      {/* An avatar group on the page itself, no tinted row behind it (Mahad,
          2026-10-08: the blue background *"shouldn't be there"*, and *"we
          should have the avatar group ... similar to what we had before"*). The
          avatars take the Partners picker's own tints (vendors/
          SearchableUserPicker: a role's colour, a person's colour); anyone
          locked on is grey. The hover card names everyone, and the Partners
          dashed call to action stays a button beside them. */}
      {list && (() => {
        const members = [
          ...locked.map(l => ({ id: l.id, name: l.name, subtitle: 'Always has access', bg: '#F1F5F9', fg: '#64748B' })),
          ...selectedRoles.map((r, i) => ({ id: r.id, name: r.name, subtitle: `Role · ${r.people.length} ${noun(r.people.length)}`, bg: getRoleColor(i).bg, fg: getRoleColor(i).text })),
          ...selectedUsers.map((u, i) => ({ id: u.id, name: u.name, subtitle: u.role, bg: getUserColor(i).bg, fg: getUserColor(i).text })),
        ]
        const SHOWN = 5
        const stacked = members.slice(0, SHOWN)
        const extra = members.length - stacked.length
        return (
          <div data-picker-list className="flex items-center gap-3 flex-wrap">
            {members.length > 0 && (
              <div className="flex items-center gap-2" data-avatar-group>
                <RecipientsHoverCard
                  category={capital(copy.many)}
                  items={members.map(m => ({ id: m.id, name: m.name, subtitle: m.subtitle, initials: initialsOf(m.name), avatarBg: m.bg, avatarFg: m.fg }))}
                  onItemClick={openManage}
                  onViewMore={openManage}
                  viewMoreLabel={`Manage all ${shownCount} ${copy.many}`}
                >
                  <span className="flex items-center cursor-default">
                    {stacked.map((m, i) => (
                      <span key={m.id} data-avatar
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] shrink-0 ${i > 0 ? '-ml-1' : ''}`}
                        // A white gap and a hairline, so light tints stay apart on a white page.
                        style={{ fontWeight: 700, backgroundColor: m.bg, color: m.fg, zIndex: SHOWN - i, boxShadow: '0 0 0 2px #FFFFFF, 0 0 0 3px #E2E8F0' }}>
                        {initialsOf(m.name)}
                      </span>
                    ))}
                    {extra > 0 && (
                      <span className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] bg-muted text-slate-500 shrink-0 -ml-1" style={{ fontWeight: 700, boxShadow: '0 0 0 2px #FFFFFF, 0 0 0 3px #E2E8F0' }}>
                        +{extra}
                      </span>
                    )}
                  </span>
                </RecipientsHoverCard>
                <span className="text-[12px] text-slate-600" style={{ fontWeight: 600 }} data-avatar-count>
                  {shownCount} {noun(shownCount)}
                </span>
              </div>
            )}
            <button type="button" data-picker-manage onClick={e => { e.stopPropagation(); e.preventDefault(); openManage() }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-dashed transition-all cursor-pointer text-[12px] hover:bg-[#FAFBFC]"
              style={{ borderColor: accentBorder, color: accentText, fontWeight: 600 }}
            >
              <Plus className="w-3.5 h-3.5" />{totalSelected > 0 ? `Manage ${copy.many}` : copy.add}
            </button>
          </div>
        )
      })()}

      {!list && shownCount === 0 && (
        <button type="button" onClick={e => { e.stopPropagation(); e.preventDefault(); openManage() }}
          className={inline
            ? 'inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg border bg-white shadow-sm transition-all cursor-pointer text-[12px]'
            : 'w-full inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-lg border bg-white shadow-sm transition-all cursor-pointer text-[12px]'}
          style={{ borderColor: accentBorder, color: accentText, fontWeight: 600 }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = accentBg }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#FFFFFF' }}
        >
          <Plus className="w-3.5 h-3.5" />{copy.add}
        </button>
      )}

      {/* Above the FormModal it is opened from (z-[70]), at the level the
          confirmation dialogs use. */}
      {modalOpen && createPortal(
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="absolute inset-0 coa-scrim animate-overlay-in" onClick={close} />
          <div role="dialog" aria-modal="true" aria-label={copy.title}
            className="relative bg-white overflow-hidden flex flex-col border border-border/60 w-[calc(100%-2rem)] sm:w-[520px] animate-modal-in"
            style={{ maxWidth: 'min(560px, calc(100vw - 2rem))', maxHeight: 'min(80vh, 640px)', borderRadius: 16, boxShadow: '0 24px 80px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)' }}>

            <div className="px-4 pt-4 pb-3 border-b border-border bg-white shrink-0">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: accentBg }}><Icon className="w-4 h-4" style={{ color: accentColor }} /></div>
                  <div>
                    <h3 className="text-[14px] text-foreground" style={{ fontWeight: 700 }}>{copy.title}</h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">{copy.subtitle}</p>
                  </div>
                </div>
                <button type="button" onClick={close} aria-label="Close" className="p-1.5 rounded-lg hover:bg-muted transition-colors cursor-pointer"><X className="w-4 h-4 text-slate-400" /></button>
              </div>

              <div className="relative mb-2.5">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search users and roles by name, department, or email…"
                  className="w-full h-9 pl-9 pr-8 rounded-lg border border-border bg-slate-50 text-[12px] text-foreground placeholder:text-slate-400/60 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 focus:bg-white transition-colors" autoFocus />
                {search && (
                  <button type="button" onClick={() => setSearch('')} aria-label="Clear search" className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted transition-colors cursor-pointer">
                    <X className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {(['roles', 'users'] as const).map(t => {
                  const isActive = tab === t
                  const count = t === 'roles' ? filteredRoles.length : filteredUsers.length
                  return (
                    <button key={t} type="button" onClick={() => { setTab(t); setSearch('') }}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        isActive
                          ? 'border-primary bg-accent hover:bg-[#D6E8FF]'
                          : 'border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-muted-foreground/30'
                      }`}
                      style={{ fontWeight: isActive ? 500 : 400, color: isActive ? 'hsl(var(--primary))' : undefined }}
                    >
                      {t === 'roles' ? <Shield className="w-3 h-3" /> : <Users className="w-3 h-3" />}
                      {t === 'roles' ? 'Roles' : 'Users'}
                      <span className={`text-[10px] rounded-full px-1.5 py-px min-w-[18px] text-center ${isActive ? 'bg-primary/10' : 'bg-muted'}`}
                        style={{ fontWeight: 600, color: isActive ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))' }}>{count}</span>
                    </button>
                  )
                })}

              </div>
            </div>

            <div className="flex items-center gap-3 mx-3 px-4 py-1.5 bg-muted/30 border-b border-border shrink-0 rounded-t-md">
              {(() => {
                const allIds = (tab === 'roles' ? filteredRoles : filteredUsers).map(item => item.id)
                const allSelected = allIds.length > 0 && allIds.every(id => selectedIds.has(id))
                const someSelected = !allSelected && allIds.some(id => selectedIds.has(id))
                return (
                  <button type="button" aria-label="Select all" onClick={() => {
                    const next = new Set(selectedIds)
                    if (allSelected) allIds.forEach(id => next.delete(id)); else allIds.forEach(id => next.add(id))
                    onSelectionChange(next)
                  }}
                    className="w-[16px] h-[16px] rounded-[4px] border-[1.5px] flex items-center justify-center shrink-0 transition-all cursor-pointer"
                    style={{ borderColor: allSelected || someSelected ? accentColor : '#CBD5E1', backgroundColor: allSelected ? accentColor : 'transparent' }}
                  >
                    {allSelected && <CheckMark />}
                    {someSelected && !allSelected && <div className="w-2 h-0.5 rounded-full" style={{ backgroundColor: accentColor }} />}
                  </button>
                )
              })()}
              <div className="w-7" />
              <span className="flex-1 text-muted-foreground text-[11px] font-normal">{tab === 'roles' ? 'Role' : 'User'}</span>
              <span className="w-[110px] text-muted-foreground text-[11px] font-normal">{tab === 'roles' ? capital(copy.many) : 'Role'}</span>
              <span className="w-[100px] text-muted-foreground text-[11px] font-normal">Department</span>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide bg-white px-3 pb-2">
              {/* A search reads both lists, grouped, whichever tab is open. The
                  tabs still scope browsing when there is no query. */}
              {(() => {
                const searchActive = search.trim().length > 0
                const showRoles = searchActive ? filteredRoles.length > 0 : tab === 'roles'
                const showUsers = searchActive ? filteredUsers.length > 0 : tab === 'users'
                const nothingToShow = searchActive
                  ? filteredRoles.length === 0 && filteredUsers.length === 0
                  : tab === 'roles' ? filteredRoles.length === 0 : filteredUsers.length === 0
                if (nothingToShow) {
                  return (
                    <div className="px-4 py-10 text-center">
                      <Users className="w-8 h-8 text-border mx-auto mb-2" />
                      <p className="text-[12px] text-slate-400" style={{ fontWeight: 500 }}>
                        {searchActive ? 'No users or roles match your search' : tab === 'roles' ? 'No roles match your filters' : 'No users match your filters'}
                      </p>
                    </div>
                  )
                }
                return (
                  <>
                    {showRoles && (
                      <div>
                        {searchActive && (
                          <div className="flex items-center gap-1.5 px-4 py-1 bg-muted/30 border-b border-border/50">
                            <Shield className="w-3 h-3 text-slate-400" />
                            <span className="text-[10px] text-slate-400 tracking-wide" style={{ fontWeight: 600 }}>Roles ({filteredRoles.length})</span>
                          </div>
                        )}
                        {locked.filter(l => !search.trim() || l.name.toLowerCase().includes(search.toLowerCase())).map(l => (
                          <div key={l.id} aria-disabled="true" data-locked-pick className="border-b border-border/50 bg-muted/30 cursor-not-allowed">
                            <div className="w-full flex items-center gap-3 px-4 py-2 text-left opacity-70">
                              <CheckBox on color="#94A3B8" />
                              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-slate-100"><Lock className="w-3.5 h-3.5 text-slate-500" /></div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[12px] text-foreground truncate" style={{ fontWeight: 600 }}>{l.name}</p>
                                <p className="text-[10px] text-slate-500 leading-snug mt-0.5">{l.note}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                        {filteredRoles.map((role, i) => {
                          const isSelected = selectedIds.has(role.id)
                          const c = getRoleColor(i)
                          const expanded = expandedRoles.has(role.id)
                          return (
                            <div key={role.id} className={`border-b border-border/50 ${isSelected ? 'bg-primary/[0.03]' : 'hover:bg-muted/50'}`}>
                              <div role="button" tabIndex={0} aria-pressed={isSelected} onClick={() => toggle(role.id)}
                                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(role.id) } }}
                                className="w-full flex items-center gap-3 px-4 py-2 text-left transition-colors cursor-pointer">
                                <CheckBox on={isSelected} color={accentColor} />
                                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: c.bg }}><Shield className="w-3.5 h-3.5" style={{ color: c.text }} /></div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <p className="text-[12px] text-foreground truncate" style={{ fontWeight: 600 }}><HighlightText text={role.name} query={search} /></p>
                                    {role.description && (
                                      <Tooltip side="bottom" content={<span className="block max-w-[240px] text-[11px]">{role.description}</span>}>
                                        <span><Info className="w-3 h-3 text-slate-300 shrink-0" /></span>
                                      </Tooltip>
                                    )}
                                  </div>
                                </div>
                                <div className="w-[110px] flex items-center gap-1.5 shrink-0">
                                  <span className="text-[10px] px-1.5 py-[2px] rounded-full bg-muted text-slate-500" style={{ fontWeight: 600 }}>{role.people.length}</span>
                                  <button type="button" onClick={e => { e.stopPropagation(); toggleExpanded(role.id) }}
                                    className="text-[10px] text-primary hover:text-blue-700 transition-colors cursor-pointer" style={{ fontWeight: 600 }}>
                                    {expanded ? 'Hide' : 'See users'}
                                  </button>
                                </div>
                                <span className="w-[100px] text-[11px] text-slate-500 truncate shrink-0"><HighlightText text={role.department} query={search} /></span>
                              </div>
                              {expanded && (
                                <div className="px-4 pb-2 pl-[72px]">
                                  <RoleUsersPreview people={role.people} />
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                    {showUsers && (
                      <div>
                        {searchActive && (
                          <div className="flex items-center gap-1.5 px-4 py-1 bg-muted/30 border-b border-border/50">
                            <Users className="w-3 h-3 text-slate-400" />
                            <span className="text-[10px] text-slate-400 tracking-wide" style={{ fontWeight: 600 }}>Users ({filteredUsers.length})</span>
                          </div>
                        )}
                        {filteredUsers.map((user, i) => {
                          const isSelected = selectedIds.has(user.id)
                          const c = getUserColor(i)
                          return (
                            <button key={user.id} type="button" aria-pressed={isSelected} onClick={() => toggle(user.id)}
                              className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors border-b border-border/50 ${isSelected ? 'bg-primary/[0.03]' : 'hover:bg-muted/50'}`}>
                              <CheckBox on={isSelected} color={accentColor} />
                              <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] shrink-0" style={{ fontWeight: 700, backgroundColor: c.bg, color: c.text }}>
                                {initialsOf(user.name)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[12px] text-foreground truncate" style={{ fontWeight: 600 }}><HighlightText text={user.name} query={search} /></p>
                                <p className="text-[10px] text-slate-400 truncate mt-0.5">{user.email}</p>
                              </div>
                              <span className="w-[110px] text-[11px] text-slate-500 truncate shrink-0"><HighlightText text={user.role} query={search} /></span>
                              <span className="w-[100px] text-[11px] text-slate-500 truncate shrink-0"><HighlightText text={user.department} query={search} /></span>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </>
                )
              })()}
            </div>

            <div className="flex items-center justify-between px-4 py-2.5 border-t border-border bg-white shrink-0">
              <span className="text-[12px] text-slate-500" style={{ fontWeight: 500 }}>{totalSelected > 0 ? `${totalSelected} ${noun(totalSelected)} selected` : `No ${copy.many} selected`}</span>
              <div className="flex items-center gap-2.5">
                {totalSelected > 0 && (
                  <button type="button" onClick={() => onSelectionChange(new Set())} className="text-[12px] text-slate-500 hover:text-red-500 transition-colors cursor-pointer px-3 py-1.5 rounded-lg hover:bg-red-50 border border-border hover:border-red-200" style={{ fontWeight: 500 }}>Clear all</button>
                )}
                <button type="button" onClick={close} className="px-4 py-1.5 rounded-lg text-[12px] text-white cursor-pointer transition-colors hover:opacity-90 shadow-sm" style={{ fontWeight: 600, backgroundColor: accentColor }}>Done</button>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
