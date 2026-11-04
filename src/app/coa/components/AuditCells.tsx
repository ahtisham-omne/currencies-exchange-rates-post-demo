// Ported from chart-of-accounts-v2.1/src/components/AuditCells.tsx; adapted: the comms people directory (allPeople) is stubbed.
import { createContext, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Building2, Mail, Phone } from 'lucide-react'
import { avatarColor, cleanName, initialsOf } from './Avatar'
import { cn, fmtDateTime } from '../lib/utils'
import { Marked } from './ui'

// The comms people directory is out of scope here; the hover card falls back to
// CHART_PEOPLE and the role a name carries in brackets.
const allPeople = (): { name: string; role: string; department: string; email: string; phone: string }[] => []

/* ─────────────────────── Who made it, and when ───────────────────────
   The four audit columns every grid offers: Created by, Created on, Last
   updated by and Last updated on. Design review, 2026-10-02, Eli: *"created
   by and last modified should be surfacable in every grid ... Dates, times, and
   whose."* He went looking for the entry he had just posted and had nothing to
   find it by.

   One cell per kind of value, shared by the chart, the ledger and the
   dimensions list, so a person and a moment read the same in every grid they
   appear in - and the same as the "Created by" card on a detail page, which is
   where these columns' answers used to be the only place to look. */

/* ─────────────────────── The person, drawn the Partners way ───────────────────────
   Mahad, 2026-10-05: *"Make sure we are using the same UI here as partners
   module."* Ported from the Partners listing's Created By and Last Updated By
   cells (`VendorsListPage.tsx`): its `LogoAvatar` in person mode, its pastel
   `getAvatarTint`, its first-name photo lookup and the dark-header hover card
   over the avatar. Condensed draws a 32px avatar and the name at 14px; Comfort
   a 40px avatar, the name at 13px/500 and the role in a 10px line under it.

   Partners' two clicks are not carried over: the avatar opens its contact quick
   view and the name opens the contact's page, and neither has a destination in
   this module. */

// Partners' `AVATAR_TINTS` (utils/avatarTints.ts), in its order, with its hash.
const AVATAR_TINTS = [
  { bg: 'hsl(var(--accent))', fg: 'hsl(var(--primary))' },
  { bg: '#F0FDF4', fg: '#16A34A' },
  { bg: '#FFF7ED', fg: '#EA580C' },
  { bg: '#F5F3FF', fg: 'hsl(var(--violet))' },
  { bg: '#ECFEFF', fg: '#0891B2' },
  { bg: '#FFF1F2', fg: '#E11D48' },
  { bg: '#FEF9C3', fg: '#A16207' },
  { bg: '#F0FDFA', fg: '#0D9488' },
  { bg: '#FDF2F8', fg: '#DB2777' },
  { bg: '#EFF6FF', fg: '#2563EB' },
  { bg: '#F5F5F4', fg: '#57534E' },
]

function avatarTint(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_TINTS[Math.abs(hash) % AVATAR_TINTS.length]
}

// Partners' `getPersonAvatar`, read by first name as it is there.
const PERSON_PHOTOS: Record<string, string> = {
  Sarah: 'https://randomuser.me/api/portraits/women/44.jpg',
  Michael: 'https://randomuser.me/api/portraits/men/32.jpg',
  Emily: 'https://randomuser.me/api/portraits/women/65.jpg',
  David: 'https://randomuser.me/api/portraits/men/75.jpg',
  Rachel: 'https://randomuser.me/api/portraits/women/28.jpg',
  James: 'https://randomuser.me/api/portraits/men/46.jpg',
  Lisa: 'https://randomuser.me/api/portraits/women/17.jpg',
  Robert: 'https://randomuser.me/api/portraits/men/22.jpg',
  Amanda: 'https://randomuser.me/api/portraits/women/56.jpg',
  Kevin: 'https://randomuser.me/api/portraits/men/64.jpg',
  Maria: 'https://randomuser.me/api/portraits/women/33.jpg',
  Chris: 'https://randomuser.me/api/portraits/men/85.jpg',
  Jessica: 'https://randomuser.me/api/portraits/women/91.jpg',
  Andrew: 'https://randomuser.me/api/portraits/men/41.jpg',
  Nicole: 'https://randomuser.me/api/portraits/women/72.jpg',
  Thomas: 'https://randomuser.me/api/portraits/men/55.jpg',
  Stephanie: 'https://randomuser.me/api/portraits/women/15.jpg',
  Daniel: 'https://randomuser.me/api/portraits/men/18.jpg',
  Karen: 'https://randomuser.me/api/portraits/women/48.jpg',
  Brian: 'https://randomuser.me/api/portraits/men/67.jpg',
  Ahtisham: '/avatars/ahtisham-ahmad.jpg',
  Irtaza: '/avatars/irtaza-abid.jpg',
  Mahreen: '/avatars/mahreen-ghafoor.png',
  Nophil: '/avatars/nophil-anwer.png',
  Eli: '/avatars/eli-rosenbloom.png',
  Abdullah: 'https://randomuser.me/api/portraits/men/29.jpg',
}

const photoOf = (name: string): string | undefined => PERSON_PHOTOS[name.split(' ')[0]]

/* What the hover card states about a person. The comms roster first, so someone
   who also writes mail reads the same in both places; then the people this
   chart's seed names who are not on it. Ahtisham's facts are Partners' own, as
   he is the same person there. Anyone else reads the role their name carries. */
const CHART_PEOPLE: Record<string, { role: string; dept: string; email: string; phone: string }> = {
  'Ahtisham Ahmad': { role: 'Senior Product Designer', dept: 'Design', email: 'ahtisham@omnesoft.com', phone: '(312) 555-0164' },
  'Marcus Lee': { role: 'Accountant', dept: 'Accounting', email: 'marcus.lee@omnesoft.com', phone: '(512) 555-0171' },
  'Ravi Menon': { role: 'Plant Supervisor', dept: 'Operations', email: 'ravi.menon@omnesoft.com', phone: '(512) 555-0182' },
  'Hannah Weiss': { role: 'Sales Director', dept: 'Sales', email: 'hannah.weiss@omnesoft.com', phone: '(512) 555-0193' },
  'Priya Nair': { role: 'Engineering Manager', dept: 'Engineering', email: 'priya.nair@omnesoft.com', phone: '(512) 555-0104' },
  // The ledger's automated poster, on the address the comms module mails from.
  System: { role: 'Automated', dept: 'Omne', email: 'no-reply@omnesoft.com', phone: '' },
}

function personFacts(raw: string) {
  const name = cleanName(raw)
  const roster = allPeople().find(p => p.name === name)
  if (roster) return { role: roster.role, dept: roster.department, email: roster.email, phone: roster.phone }
  const known = CHART_PEOPLE[name]
  if (known) return known
  const tag = raw.match(/\((.*?)\)/)?.[1]
  return {
    role: tag && tag !== 'You' ? tag : 'Team member',
    dept: 'General',
    email: `${name.toLowerCase().replace(/[^a-z]+/g, '.')}@omnesoft.com`,
    phone: '',
  }
}

/** Partners' `LogoAvatar` with `type="person"`: the photo where there is one,
 *  otherwise the initials on the name's tint, inside a hairline ring. */
function PersonAvatar({ name, size }: { name: string; size: 'md' | 'lg' }) {
  const photo = photoOf(name)
  const [failed, setFailed] = useState(false)
  const showImg = photo && !failed
  return (
    <div
      className={cn(size === 'lg' ? 'w-10 h-10' : 'w-8 h-8', 'rounded-full flex items-center justify-center shrink-0 overflow-hidden border border-[#E8ECF1]')}
      style={{ backgroundColor: showImg ? 'transparent' : avatarTint(name).bg }}
    >
      {showImg
        ? <img src={photo} alt="" className="w-full h-full object-cover" onError={() => setFailed(true)} />
        : <span className={cn(size === 'lg' ? 'text-[11px]' : 'text-[10px]', 'text-slate-700')} style={{ fontWeight: 700 }}>{initialsOf(name)}</span>}
    </div>
  )
}

// Partners' `HoverCard` defaults: opens after 200ms, closes 100ms after leaving.
const OPEN_DELAY_MS = 200
const CLOSE_DELAY_MS = 100
const CARD_W = 280
const SIDE_OFFSET = 6

function PersonHoverCard({ name, anchor, onEnter, onLeave }: {
  name: string
  anchor: DOMRect
  onEnter: () => void
  onLeave: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [above, setAbove] = useState(false)
  const [entered, setEntered] = useState(false)
  useEffect(() => {
    const h = ref.current?.offsetHeight ?? 0
    setAbove(anchor.bottom + SIDE_OFFSET + h > window.innerHeight - 8 && anchor.top - SIDE_OFFSET - h > 8)
    const raf = requestAnimationFrame(() => setEntered(true))
    return () => cancelAnimationFrame(raf)
  }, [anchor])
  const shown = cleanName(name)
  const photo = photoOf(shown)
  const facts = personFacts(name)
  const left = Math.max(8, Math.min(anchor.left, window.innerWidth - CARD_W - 8))
  const top = above ? anchor.top - SIDE_OFFSET - (ref.current?.offsetHeight ?? 0) : anchor.bottom + SIDE_OFFSET
  return createPortal(
    <div
      ref={ref}
      data-person-card
      role="tooltip"
      className="fixed z-[90] rounded-xl border-0 shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden"
      style={{
        width: CARD_W, left, top,
        opacity: entered ? 1 : 0,
        transform: entered ? 'none' : `scale(0.95) translateY(${above ? 8 : -8}px)`,
        transformOrigin: above ? 'bottom left' : 'top left',
        transition: 'opacity 150ms ease-out, transform 150ms ease-out',
      }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onClick={e => e.stopPropagation()}
    >
      <div className="bg-gradient-to-br from-slate-800 to-slate-700 px-4 py-3 relative overflow-hidden">
        <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/[0.04]" />
        <div className="flex items-center gap-3 relative">
          <div className="w-11 h-11 rounded-full overflow-hidden border-2 border-white/20 shrink-0" style={{ backgroundColor: photo ? 'transparent' : avatarColor(shown) }}>
            {photo
              ? <img src={photo} alt="" className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center text-[13px] text-white" style={{ fontWeight: 700 }}>{initialsOf(shown)}</div>}
          </div>
          <div className="min-w-0">
            <p className="text-[14px] text-white truncate" style={{ fontWeight: 600 }}>{shown}</p>
            <p className="text-[11px] text-slate-400 truncate">{facts.role}</p>
          </div>
        </div>
      </div>
      <div className="bg-white px-4 py-3 space-y-2">
        <div className="flex items-center gap-2.5 text-[12px] text-slate-700"><Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" /><span className="truncate">{facts.email}</span></div>
        <div className="flex items-center gap-2.5 text-[12px] text-slate-700"><Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" /><span>{facts.dept}</span></div>
        {facts.phone && <div className="flex items-center gap-2.5 text-[12px] text-slate-700"><Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" /><span>{facts.phone}</span></div>}
      </div>
    </div>,
    document.body,
  )
}

/** Whether the grid is in Comfort density, for the chart's list and tree, whose
 *  rows are drawn too far from the density control to be handed it. */
export const GridComfort = createContext(false)

/** The vertical padding of a person's cell, in place of the grid's own, so the
 *  avatar never makes a row taller than the grid draws it. Partners' rows are
 *  built around its avatars and ours are not: the grids' 12px in Comfort would
 *  push a 40px avatar's row from 57 to 65 on the chart and from 46 to 53 on the
 *  ledger. 2px seats both sizes in the shortest row of each density - the 32px
 *  in the chart's 37, the 40px in the ledger's 46 - and the avatar is centred,
 *  so the padding itself never shows. */
export const PERSON_PAD = 'py-0.5'

/** A person as a grid shows one: avatar and name, without the "(You)" or role
 *  suffix. `comfort` is the grid's Comfort density. */
export function PersonCell({ name, comfort = false, q = '' }: { name?: string; comfort?: boolean; q?: string }) {
  const [anchor, setAnchor] = useState<DOMRect | null>(null)
  const trigger = useRef<HTMLDivElement>(null)
  const openTimer = useRef<number>()
  const closeTimer = useRef<number>()
  useEffect(() => () => { window.clearTimeout(openTimer.current); window.clearTimeout(closeTimer.current) }, [])
  // A scroll moves the avatar out from under a card positioned on it.
  useEffect(() => {
    if (!anchor) return
    const close = () => setAnchor(null)
    window.addEventListener('scroll', close, true)
    return () => window.removeEventListener('scroll', close, true)
  }, [anchor])

  if (!name) return <span className={cn(comfort ? 'text-[13px]' : 'text-sm', 'text-fg-subtle')}>-</span>
  const shown = cleanName(name)
  const role = personFacts(name).role

  const enter = () => {
    window.clearTimeout(closeTimer.current)
    if (anchor) return
    openTimer.current = window.setTimeout(() => {
      if (trigger.current) setAnchor(trigger.current.getBoundingClientRect())
    }, OPEN_DELAY_MS)
  }
  const leave = () => {
    window.clearTimeout(openTimer.current)
    closeTimer.current = window.setTimeout(() => setAnchor(null), CLOSE_DELAY_MS)
  }

  return (
    <div className={cn('flex items-center min-w-0', comfort ? 'gap-2.5' : 'gap-2')}>
      <div ref={trigger} data-person-avatar className="cursor-pointer" onMouseEnter={enter} onMouseLeave={leave}>
        <PersonAvatar name={shown} size={comfort ? 'lg' : 'md'} />
      </div>
      {anchor && <PersonHoverCard name={name} anchor={anchor} onEnter={enter} onLeave={leave} />}
      <div className="min-w-0 flex-1">
        <span className={cn(comfort ? 'text-[13px]' : 'text-sm', 'block truncate text-slate-700')} style={{ fontWeight: comfort ? 500 : undefined }}><Marked text={shown} q={q} /></span>
        {comfort && <span className="text-[10px] text-muted-foreground/50 truncate block">{role}</span>}
      </div>
    </div>
  )
}

/** A moment as a grid shows one: the date and the time of day. */
export function StampCell({ at, q = '' }: { at?: string; q?: string }) {
  if (!at) return <span className="text-fg-subtle">-</span>
  return <span className="text-sm text-slate-700 tabular-nums whitespace-nowrap"><Marked text={stampText(at)} q={q} /></span>
}

/** A moment as its cell prints it, for a search to read. */
export const stampText = (at?: string) => (at ? fmtDateTime(at) : '')

/** A person's name as a filter offers it - the name the cell shows. */
export const personText = (name?: string) => (name ? cleanName(name) : '')

/** The people in a set, each once, in alphabetical order, for a "who" filter. */
export const peopleIn = (names: (string | undefined)[]) =>
  [...new Set(names.map(personText).filter(Boolean))].sort((a, b) => a.localeCompare(b))

export const AUDIT_HELP = {
  createdBy: 'Who added it.',
  createdAt: 'When it was added, in your time zone.',
  updatedBy: 'Who changed it last. Until someone changes it, this is whoever added it.',
  updatedAt: 'When it was last changed, in your time zone. Until someone changes it, this is when it was added.',
} as const
