// Currency lifecycle on CoA's pattern (AccountActions.tsx + lib/accountLifecycle.ts
// planBulk): one rule set for every door - the row menu, the status chip, the
// detail page's Actions menu and the bulk bar - planned here, run by the kit's
// useLifecycleFlow (refusal dialog, confirm dialog, or immediate commit, then a toast).
// The bulk bar's Activate / Deactivate open the Currency Library's own bulk
// dialog (BulkStatusDialog) instead, which lists every currency it touches.
import { useState } from 'react'
import { useCurrencies } from '../../context/CurrencyContext'
import { countOpenDocuments, hasOpenDocuments, type Currency } from '../../data/currencies'
import { lifecycleIcon, useLifecycleFlow, type LifecyclePlan } from '../../coa/lib/lifecycle'
import { pushToast } from '../../coa/lib/toast'
import { BASE_CURRENCY_LOCKED, openDocBreakdown, plural, type CurrencyStatus } from './model'
import { BulkStatusDialog, type BulkStatusPlan } from './BulkStatusDialog'

/** Why a currency stays active in a bulk Deactivate, shown beside it; null when it can go. */
function heldBecause(c: Currency): string | null {
  if (c.isBaseCurrency) return 'Base currency'
  if (hasOpenDocuments(c)) return `${plural(countOpenDocuments(c), 'open transaction', 'open transactions')}`
  return null
}

export function useCurrencyLifecycle() {
  const { activateCurrency, deactivateCurrency, bulkActivate, bulkDeactivate } = useCurrencies()
  const flow = useLifecycleFlow()

  const plan = (next: CurrencyStatus, c: Currency): LifecyclePlan => {
    if (next === 'Active') {
      return { allowed: true, commit: () => activateCurrency(c.code), toast: 'Currency activated' }
    }
    // The menus grey Deactivate out for the base currency; this is the backstop.
    if (c.isBaseCurrency) {
      return {
        allowed: false,
        commit: () => {},
        refusal: {
          title: "Can't deactivate this currency",
          description: [BASE_CURRENCY_LOCKED],
          dismissLabel: 'Got It',
        },
      }
    }
    if (hasOpenDocuments(c)) {
      return {
        allowed: false,
        commit: () => {},
        refusal: {
          title: "Can't deactivate this currency yet",
          description: ['This currency is on open transactions. Close or settle them first, then deactivate it.'],
          reasonsTitle: 'Still Open',
          reasons: openDocBreakdown(c),
        },
      }
    }
    return {
      allowed: true,
      confirm: {
        tone: 'warning',
        icon: lifecycleIcon('deactivate'),
        title: 'Deactivate this currency?',
        description: ['This currency will stop being offered on new transactions. Its rates and history are kept, and you can activate it again anytime.'],
        confirmLabel: 'Deactivate Currency',
      },
      commit: () => deactivateCurrency(c.code),
      toast: 'Currency deactivated',
    }
  }

  /** One currency, from the row menu, the status chip or the Actions menu. */
  const request = (next: CurrencyStatus, c: Currency, onDone?: () => void) => {
    if (next === statusLabel(c)) return
    flow.request(plan(next, c), onDone)
  }

  /* The bulk bar: `picked` is the whole selection, and the plan works out which
     ones move. The base currency can be selected (it exports with the rest), but
     neither action touches it: it is active already, and it always stays active.
     The dialog lists it under Staying Active with the reason, so nobody wonders
     why it was left out. */
  const [bulk, setBulk] = useState<{ plan: BulkStatusPlan; onDone: () => void } | null>(null)

  const requestBulk = (next: CurrencyStatus, picked: Currency[], onDone: () => void) => {
    if (next === 'Active') {
      const targets = picked.filter(c => c.status === 'inactive')
      if (!targets.length) return
      const stays = picked.filter(c => c.status !== 'inactive').map(c => ({ currency: c, reason: 'Already active' }))
      setBulk({ plan: { mode: 'activate', selected: picked.length, targets, stays, notes: [] }, onDone })
      return
    }

    const active = picked.filter(c => c.status === 'active')
    const targets = active.filter(c => heldBecause(c) === null)
    const stays = active.filter(c => heldBecause(c) !== null).map(c => ({ currency: c, reason: heldBecause(c)! }))
    const alreadyInactive = picked.length - active.length
    if (!targets.length && !stays.length) return
    const notes = [
      ...(stays.some(s => s.currency.isBaseCurrency) ? [BASE_CURRENCY_LOCKED] : []),
      ...(stays.some(s => !s.currency.isBaseCurrency) ? ['A currency with open transactions can be deactivated once those transactions are closed or settled.'] : []),
      ...(alreadyInactive ? [`${plural(alreadyInactive, 'currency you picked is', 'currencies you picked are')} already inactive.`] : []),
    ]
    setBulk({ plan: { mode: 'deactivate', selected: picked.length, targets, stays, notes }, onDone })
  }

  const confirmBulk = () => {
    if (!bulk) return
    const { plan: p, onDone } = bulk
    const n = p.targets.length
    const codes = p.targets.map(c => c.code)
    if (p.mode === 'activate') {
      bulkActivate(codes)
      pushToast(`${plural(n, 'currency', 'currencies')} activated`, 'success',
        p.stays.length ? `${p.stays.length} ${p.stays.length === 1 ? 'was' : 'were'} already active.` : undefined)
    } else {
      bulkDeactivate(codes)
      pushToast(`${plural(n, 'currency', 'currencies')} deactivated`, p.stays.length ? 'info' : 'success',
        p.stays.length ? `${p.stays.length} stayed active.` : undefined)
    }
    setBulk(null)
    onDone()
  }

  const bulkModal = bulk && <BulkStatusDialog plan={bulk.plan} onConfirm={confirmBulk} onClose={() => setBulk(null)} />

  return { request, requestBulk, modal: <>{flow.modal}{bulkModal}</> }
}

const statusLabel = (c: Currency): CurrencyStatus => (c.status === 'active' ? 'Active' : 'Inactive')
