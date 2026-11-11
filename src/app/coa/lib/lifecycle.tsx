// Ported from chart-of-accounts-v2.1/src/pages/AccountActions.tsx (useAccountLifecycle, LifecycleConfirm, RefusalAlert, ICON); adapted: generic - the page builds a plan (allowed / refusal / confirm copy / commit / toast) for its own rules, and this runs it: refusal dialog, confirm dialog or immediate commit, then the toast.
import { useState, type ReactNode } from 'react'
import { Archive, ArchiveRestore, CircleSlash, Power, Trash2 } from 'lucide-react'
import { ConfirmModal } from '../components/ui'
import { pushToast } from './toast'

export type LifecycleVerb = 'deactivate' | 'activate' | 'archive' | 'unarchive' | 'delete'

/** The 26px dialog icon CoA gives each lifecycle verb, tinted to the tone. */
export function lifecycleIcon(verb: LifecycleVerb, tone: 'warning' | 'danger' | 'info' = verb === 'archive' || verb === 'delete' ? 'danger' : 'warning'): ReactNode {
  const cls = tone === 'danger' ? 'text-danger-600' : tone === 'info' ? 'text-primary' : 'text-warning-600'
  switch (verb) {
    case 'deactivate': return <CircleSlash size={26} className={cls} />
    case 'activate': return <Power size={26} className={cls} />
    case 'archive': return <Archive size={26} className={cls} />
    case 'unarchive': return <ArchiveRestore size={26} className={cls} />
    case 'delete': return <Trash2 size={26} className={cls} />
  }
}

/** What a refusal says: one button, a reasons box listing what blocks it. */
export interface RefusalSpec {
  title: string
  description: ReactNode | ReactNode[]
  reasonsTitle?: string
  reasons?: ReactNode[]
  /** "Close" by default; "Got it" where the reader has nothing to go and fix. */
  dismissLabel?: string
}

/** What a confirmation says. Titles that ask or state are sentence case; buttons are Title Case. No em dashes, plain consequences. */
export interface ConfirmSpec {
  tone: 'warning' | 'danger' | 'info'
  icon?: ReactNode
  badge?: string
  title: string
  description: ReactNode | ReactNode[]
  /** The verb + noun, in Title Case like the menu item: "Deactivate Currency", "Archive Rate". */
  confirmLabel: string
  dismissLabel?: string
  reasonsTitle?: string
  reasons?: ReactNode[]
  asideTitle?: string
  aside?: ReactNode[]
  widthClass?: string
}

/** One request, planned by the page against its own rules. */
export interface LifecyclePlan {
  /** False = refused; `refusal` says why. */
  allowed: boolean
  refusal?: RefusalSpec
  /** Present = ask first; absent = commit at once (CoA: Activate is immediate). */
  confirm?: ConfirmSpec
  /** Do it. Return { ok: false, error } to report a failure as a danger toast. */
  commit: () => void | { ok: boolean; error?: string }
  /** The success toast after commit: "EUR deactivated". */
  toast?: string
  toastDescription?: string
  /** Toast tone; 'info' for a partial result ("3 deactivated. 2 skipped."). */
  toastTone?: 'success' | 'info'
}

/**
 * CoA's lifecycle flow, one rule set for every door (row menu, status chip,
 * Actions menu, bulk bar): `request(plan)` shows the refusal, or the
 * confirmation, or commits straight away, and toasts the result. Render
 * `modal` once on the page.
 */
export function useLifecycleFlow() {
  const [pending, setPending] = useState<{ plan: LifecyclePlan; onDone?: () => void } | null>(null)
  const [refused, setRefused] = useState<RefusalSpec | null>(null)

  const commit = (plan: LifecyclePlan, onDone?: () => void) => {
    const r = plan.commit()
    if (r && r.ok === false) { pushToast(r.error ?? 'Action not allowed', 'danger'); return }
    if (plan.toast) pushToast(plan.toast, plan.toastTone ?? 'success', plan.toastDescription)
    onDone?.()
  }

  /** `onDone` runs after the action goes through, and only then. */
  const request = (plan: LifecyclePlan, onDone?: () => void) => {
    if (!plan.allowed) { if (plan.refusal) setRefused(plan.refusal); return }
    if (plan.confirm) setPending({ plan, onDone })
    else commit(plan, onDone)
  }

  const c = pending?.plan.confirm
  const modal = (
    <>
      {c && (
        <ConfirmModal
          open
          tone={c.tone}
          icon={c.icon}
          badge={c.badge}
          title={c.title}
          description={c.description}
          reasonsTitle={c.reasonsTitle}
          reasons={c.reasons}
          asideTitle={c.asideTitle}
          aside={c.aside}
          confirmLabel={c.confirmLabel}
          dismissLabel={c.dismissLabel ?? 'Cancel'}
          widthClass={c.widthClass}
          onConfirm={() => { const p = pending!; setPending(null); commit(p.plan, p.onDone) }}
          onDismiss={() => setPending(null)}
        />
      )}
      {refused && (
        <ConfirmModal
          open
          tone="warning"
          title={refused.title}
          description={refused.description}
          reasonsTitle={refused.reasonsTitle}
          reasons={refused.reasons}
          confirmLabel={refused.dismissLabel ?? 'Close'}
          onConfirm={() => setRefused(null)}
          onDismiss={() => setRefused(null)}
        />
      )}
    </>
  )
  return { request, modal }
}
