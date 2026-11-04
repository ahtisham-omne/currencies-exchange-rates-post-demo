// Currency lifecycle on CoA's pattern (AccountActions.tsx + lib/accountLifecycle.ts
// planBulk): one rule set for every door - the row menu, the status chip, the
// detail page's Actions menu and the bulk bar - planned here, run by the kit's
// useLifecycleFlow (refusal dialog, confirm dialog, or immediate commit, then a toast).
import type { ReactNode } from 'react'
import { FileText } from 'lucide-react'
import { useCurrencies } from '../../context/CurrencyContext'
import { hasOpenDocuments, type Currency } from '../../data/currencies'
import { Quoted } from '../../coa/components/ui'
import { OverflowCard } from '../../coa/components/cells'
import { lifecycleIcon, useLifecycleFlow, type LifecyclePlan } from '../../coa/lib/lifecycle'
import { openDocBreakdown, plural, type CurrencyStatus } from './model'

/** "AED United Arab Emirates Dirham" with the code in CoA's Quoted pill. */
function named(c: Currency, tail?: string): ReactNode {
  return <span><Quoted>{c.code}</Quoted> {c.name}{tail ? `: ${tail}` : ''}</span>
}

/* The first five by name, the rest behind CoA's overflow card: a dialog that is
   there to say which currencies cannot end on "and 41 more" alone. */
function nameSome(lines: { node: ReactNode; text: string }[], title: string): ReactNode[] {
  const shown = lines.slice(0, 5).map(l => l.node)
  const rest = lines.slice(5)
  if (!rest.length) return shown
  return [
    ...shown,
    <OverflowCard key="rest" category={title} icon={FileText} items={rest.map(r => ({ name: r.text }))}>
      <span className="underline decoration-dotted underline-offset-2">and {rest.length} more</span>
    </OverflowCard>,
  ]
}

/** Why a currency cannot be deactivated, or null when it can. */
function heldBecause(c: Currency): string | null {
  if (c.isBaseCurrency) return 'base currency'
  if (hasOpenDocuments(c)) return openDocBreakdown(c).join(', ')
  return null
}

export function useCurrencyLifecycle() {
  const { activateCurrency, deactivateCurrency, bulkActivate, bulkDeactivate } = useCurrencies()
  const flow = useLifecycleFlow()

  const plan = (next: CurrencyStatus, c: Currency): LifecyclePlan => {
    if (next === 'Active') {
      return { allowed: true, commit: () => activateCurrency(c.code), toast: `${c.code} activated` }
    }
    if (c.isBaseCurrency) {
      return {
        allowed: false,
        commit: () => {},
        refusal: {
          title: `Can't deactivate ${c.code}`,
          description: [
            `${c.code} is your base currency. Every exchange rate is quoted against it, so it stays active.`,
            'To deactivate it, change your base currency in Company Settings first.',
          ],
          dismissLabel: 'Got it',
        },
      }
    }
    if (hasOpenDocuments(c)) {
      return {
        allowed: false,
        commit: () => {},
        refusal: {
          title: `Can't deactivate ${c.code} yet`,
          description: [`${c.code} is on open documents. Close or settle them first, then deactivate it.`],
          reasonsTitle: 'Still open',
          reasons: openDocBreakdown(c),
        },
      }
    }
    return {
      allowed: true,
      confirm: {
        tone: 'warning',
        icon: lifecycleIcon('deactivate'),
        title: `Deactivate ${c.code}?`,
        description: [`${c.code} will stop being offered on new transactions. Its rates and history are kept, and you can activate it again anytime.`],
        confirmLabel: 'Deactivate currency',
      },
      commit: () => deactivateCurrency(c.code),
      toast: `${c.code} deactivated`,
    }
  }

  /** One currency, from the row menu, the status chip or the Actions menu. */
  const request = (next: CurrencyStatus, c: Currency, onDone?: () => void) => {
    if (next === statusLabel(c)) return
    flow.request(plan(next, c), onDone)
  }

  /** The bulk bar: `picked` is the whole selection; the plan works out which ones move. */
  const requestBulk = (next: CurrencyStatus, picked: Currency[], onDone: () => void) => {
    if (next === 'Active') {
      const targets = picked.filter(c => c.status === 'inactive')
      const already = picked.length - targets.length
      if (!targets.length) return
      const n = targets.length
      flow.request({
        allowed: true,
        confirm: {
          tone: 'warning',
          icon: lifecycleIcon('activate'),
          title: `Activate ${plural(n, 'currency', 'currencies')}?`,
          description: [n === 1
            ? 'It will be offered on new transactions, rates and reports again.'
            : 'They will be offered on new transactions, rates and reports again.'],
          reasonsTitle: 'Currencies affected',
          reasons: nameSome(targets.map(c => ({ node: named(c), text: `${c.code} ${c.name}` })), 'Currencies affected'),
          confirmLabel: `Activate ${plural(n, 'currency', 'currencies')}`,
        },
        commit: () => { bulkActivate(targets.map(c => c.code)) },
        toast: `${plural(n, 'currency', 'currencies')} activated`,
        toastDescription: already > 0 ? `${already} ${already === 1 ? 'was' : 'were'} already active.` : undefined,
      }, onDone)
      return
    }

    const active = picked.filter(c => c.status === 'active')
    const held = active.filter(c => heldBecause(c) !== null)
    const targets = active.filter(c => heldBecause(c) === null)
    const heldLines = held.map(c => ({ node: named(c, heldBecause(c)!), text: `${c.code} ${c.name}: ${heldBecause(c)}` }))

    // Nothing can move: the answer is owed in the same place it was asked, one
    // reason per currency (CoA planBulk's refusal).
    if (!targets.length) {
      if (!held.length) return
      flow.request({
        allowed: false,
        commit: () => {},
        refusal: {
          title: `Can't deactivate ${plural(held.length, 'currency', 'currencies')}`,
          description: [
            held.length === 1
              ? 'The currency below stays as it is, for the reason given beside it.'
              : 'The currencies below stay as they are, each for the reason given beside it.',
            ...(held.some(c => !c.isBaseCurrency) ? ['A currency on open documents can be deactivated once they are closed or settled.'] : []),
          ],
          reasonsTitle: 'Why each one stayed',
          reasons: nameSome(heldLines, 'Why each one stayed'),
        },
      })
      return
    }

    const n = targets.length
    flow.request({
      allowed: true,
      confirm: {
        tone: 'warning',
        icon: lifecycleIcon('deactivate'),
        title: `Deactivate ${plural(n, 'currency', 'currencies')}?`,
        description: [
          n === 1
            ? 'It will stop being offered on new transactions. Its rates and history are kept, and you can activate it again anytime.'
            : 'They will stop being offered on new transactions. Their rates and history are kept, and you can activate them again anytime.',
          ...(held.length ? [`${held.length === 1 ? '1 currency stays as it is' : `${held.length} currencies stay as they are`}, named below.`] : []),
        ],
        reasonsTitle: 'Currencies affected',
        reasons: nameSome(targets.map(c => ({ node: named(c), text: `${c.code} ${c.name}` })), 'Currencies affected'),
        asideTitle: held.length ? 'Why each one stayed' : undefined,
        aside: held.length ? nameSome(heldLines, 'Why each one stayed') : undefined,
        confirmLabel: `Deactivate ${plural(n, 'currency', 'currencies')}`,
      },
      commit: () => { bulkDeactivate(targets.map(c => c.code)) },
      toast: `${plural(n, 'currency', 'currencies')} deactivated${held.length ? `, ${held.length} skipped` : ''}`,
      toastTone: held.length ? 'info' : 'success',
    }, onDone)
  }

  return { request, requestBulk, modal: flow.modal }
}

const statusLabel = (c: Currency): CurrencyStatus => (c.status === 'active' ? 'Active' : 'Inactive')
