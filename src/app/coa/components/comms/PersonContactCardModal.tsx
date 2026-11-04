// Ported from chart-of-accounts-v2.1/src/components/comms/PersonContactCardModal.tsx; adapted: the info toasts say Contacts sit outside the currency screens.
/* Ported from the financial reporting module (components/fr/comms/PersonContactCardModal.tsx).

   The large click-triggered contact card behind a sender's name. Hover stays on
   PersonHoverCard's small dark popover; this opens on click.

   Two adaptations the target forces:

   • The dialog is this module's `Modal`, so it dismisses on Escape and on the
     backdrop the same way every other dialog here does, and its own header
     carries the name and role. The source drew a ✕ and repeated the name under
     the banner; both are dropped rather than shown twice.

   • `Modal` portals to <body>, which is outside the tab's `data-comms` root, so
     the source's colour primitives would resolve to nothing. Re-declaring
     `data-comms` on the content's own wrapper brings the whole block back into
     scope, which is why every colour below is still written exactly as the
     source wrote it.

   The partner block is this module's: there are no orders here, so the pills and
   the stat row name the company, the correspondence and the response time,
   deterministically hashed on the name the way the source hashed its own. */
import { ExternalLink, Globe, Linkedin, Mail, MessageSquare, Phone } from 'lucide-react'
import { Button, Modal } from '../ui'
import { useStore } from '../../store'
import { getInitials, getPersonDetail, deptPalette } from './peopleData'

interface PersonContactCardModalProps {
  open: boolean
  name: string
  email?: string
  initials: string
  /** Avatar tint - falls back to the source's emerald pair when omitted. */
  avatarBg?: string
  avatarFg?: string
  onClose: () => void
}

function hashStr(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h)
  return Math.abs(h)
}

function statsFor(name: string) {
  const h = hashStr(name)
  return {
    threads: (h % 18) + 3,
    messages: (h % 60) + 6,
    avgResponseHrs: (((h % 90) + 10) / 10).toFixed(1),
    extraPhones: h % 3 === 0 ? 1 : 0,
  }
}

export function PersonContactCardModal({
  open,
  name,
  email,
  avatarBg = 'var(--color-emerald-100)',
  avatarFg = 'var(--color-emerald-700)',
  onClose,
}: PersonContactCardModalProps) {
  const pushToast = useStore(s => s.pushToast)
  const person = getPersonDetail(name, email)
  const stats = statsFor(name)
  const pal = deptPalette(person.department)
  const orgCode = getInitials(person.org)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={person.name}
      subtitle={person.role}
      width="md"
      bodyClassName="!p-0"
      footerAlign="between"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
          <Button
            size="sm"
            iconRight={<ExternalLink size={14} />}
            onClick={() => pushToast('Contacts are outside the Currency Library.', 'info')}
          >
            Go to contact
          </Button>
        </>
      }
    >
      <div data-comms className="pb-4">
        {/* Gradient banner + avatar */}
        <div
          className="relative px-4 pt-4 pb-7"
          style={{ background: `linear-gradient(135deg, ${avatarBg} 0%, var(--color-white) 100%)` }}
        >
          <span
            className="inline-flex items-center gap-1.5 h-6 px-2 rounded-full text-[11px]"
            style={{ backgroundColor: 'var(--color-emerald-100)', color: 'var(--color-emerald-700)', fontWeight: 600 }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--color-emerald-500)' }} />
            Active
          </span>
          <div className="flex items-center justify-center mt-3">
            <div
              className="w-20 h-20 rounded-full bg-white flex items-center justify-center shadow-[0_2px_12px_rgba(15,23,42,0.08)]"
              style={{ color: avatarFg, fontWeight: 700, fontSize: 22 }}
            >
              {getInitials(person.name)}
            </div>
          </div>
        </div>

        {/* Company + department */}
        <div className="px-4 flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 h-6 px-2 rounded-full bg-[var(--color-slate-50)] border border-[var(--color-slate-200)] text-[11.5px] text-[var(--color-slate-700)]" style={{ fontWeight: 500 }}>
            <span className="w-3.5 h-3.5 rounded flex items-center justify-center text-[8px] text-white" style={{ backgroundColor: avatarFg, fontWeight: 700 }}>
              {orgCode}
            </span>
            {person.org}
          </span>
          <span className="inline-flex items-center h-5 px-1.5 rounded text-[10px]" style={{ backgroundColor: pal.bg, color: pal.fg, border: `1px solid ${pal.border}`, fontWeight: 600 }}>
            {person.department}
          </span>
        </div>

        {/* Stats grid */}
        <div className="px-4 mt-3 grid grid-cols-4 gap-2">
          <div className="rounded-lg border border-[var(--color-slate-200)] bg-white px-2 py-2 text-center">
            <p className="text-[12px] text-[var(--color-slate-900)]" style={{ fontWeight: 700, lineHeight: 1.1 }}>{orgCode}</p>
            <p className="text-[10px] text-[var(--color-slate-400)] mt-1" style={{ fontWeight: 500 }}>Company</p>
          </div>
          <div className="rounded-lg border border-[var(--color-slate-200)] bg-white px-2 py-2 text-center">
            <p className="text-[14px] text-[var(--color-slate-900)]" style={{ fontWeight: 700, lineHeight: 1 }}>{stats.threads}</p>
            <p className="text-[10px] text-[var(--color-slate-400)] mt-1" style={{ fontWeight: 500 }}>Threads</p>
          </div>
          <div className="rounded-lg border border-[var(--color-slate-200)] bg-white px-2 py-2 text-center">
            <p className="text-[14px] text-[var(--color-slate-900)]" style={{ fontWeight: 700, lineHeight: 1 }}>{stats.messages}</p>
            <p className="text-[10px] text-[var(--color-slate-400)] mt-1" style={{ fontWeight: 500 }}>Messages</p>
          </div>
          <div className="rounded-lg border border-[var(--color-slate-200)] bg-white px-2 py-2 text-center">
            <p className="text-[14px] text-[var(--color-slate-900)]" style={{ fontWeight: 700, lineHeight: 1 }}>
              {stats.avgResponseHrs}<span className="text-[10px] text-[var(--color-slate-400)] ml-0.5" style={{ fontWeight: 500 }}>hrs</span>
            </p>
            <p className="text-[10px] text-[var(--color-slate-400)] mt-1" style={{ fontWeight: 500 }}>Avg response</p>
          </div>
        </div>

        {/* Phone + email rows */}
        <div className="px-4 mt-3 space-y-2">
          {person.phone && (
            <div className="flex items-center gap-2.5 text-[12px] text-[var(--color-slate-700)]">
              <Phone className="w-3.5 h-3.5 text-[var(--color-slate-400)] shrink-0" />
              <span>{person.phone}</span>
              {stats.extraPhones > 0 && (
                <button
                  type="button"
                  onClick={() => pushToast('Only the primary number is held in this demo.', 'info')}
                  className="text-[11px] text-[var(--color-sky-500)] hover:underline cursor-pointer"
                  style={{ fontWeight: 500 }}
                >
                  +{stats.extraPhones} more
                </button>
              )}
            </div>
          )}
          <div className="flex items-center gap-2.5 text-[12px] text-[var(--color-slate-700)]">
            <Mail className="w-3.5 h-3.5 text-[var(--color-slate-400)] shrink-0" />
            <span className="truncate">{person.email}</span>
          </div>
        </div>

        {/* Send message */}
        <div className="px-4 mt-3">
          <button
            type="button"
            onClick={() => pushToast('Messaging is not wired in this demo.', 'info')}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-[var(--color-slate-200)] bg-[var(--color-slate-100)] text-[12.5px] text-[var(--color-slate-700)] hover:bg-[var(--color-slate-200)] transition-colors cursor-pointer"
            style={{ fontWeight: 500 }}
            title={`Message ${person.name}`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Send message
          </button>
        </div>

        {/* Connect rail */}
        <div className="px-4 mt-3 flex items-center gap-2.5">
          <span className="text-[11px] text-[var(--color-slate-400)]" style={{ fontWeight: 600 }}>Connect</span>
          <button type="button" onClick={() => pushToast('Profiles open from Contacts, outside the Currency Library.', 'info')} className="w-6 h-6 rounded flex items-center justify-center text-[var(--color-slate-500)] hover:bg-[var(--color-slate-100)] hover:text-[var(--color-brand-700)] transition-colors" aria-label="LinkedIn">
            <Linkedin className="w-3.5 h-3.5" />
          </button>
          <button type="button" onClick={() => pushToast('Websites open from Contacts, outside the Currency Library.', 'info')} className="w-6 h-6 rounded flex items-center justify-center text-[var(--color-slate-500)] hover:bg-[var(--color-slate-100)] hover:text-[var(--color-sky-500)] transition-colors" aria-label="Website">
            <Globe className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </Modal>
  )
}
