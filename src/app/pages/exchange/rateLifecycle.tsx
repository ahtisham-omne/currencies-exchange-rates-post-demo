// Exchange Rates screens: the corporate rate lifecycle, CoA-style (plan, then a
// refusal, a confirmation or an immediate commit, then the toast). One rule set
// for every door: the row menu, the status chip, the Actions menu and the bulk bar.
import { useExchangeRates } from '../../context/ExchangeRateContext'
import { activeStandardRateFor, type StandardRate } from '../../data/exchangeRates'
import { useLifecycleFlow, lifecycleIcon } from '../../coa/lib/lifecycle'
import type { StatusOption } from '../../coa/components/StatusChip'
import { fmtDate } from '../../coa/lib/utils'
import { BASE, fmtRate, type CorpStatus } from './rateModel'

export const CORPORATE_STATUS_OPTIONS: StatusOption<CorpStatus>[] = [
  { value: 'Active', verb: 'Restore', meaning: ['The rate in effect for this pair. It can be selected on new transactions.'] },
  { value: 'Archived', verb: 'Archive', meaning: ['Kept in rate history, but it can no longer be selected on new transactions.'] },
]

export const MID_STATUS_OPTIONS: StatusOption<'Active'>[] = [
  { value: 'Active', verb: 'Activate', meaning: ['Synced from the rate provider every 24 hours.'] },
]

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)

export function useCorporateRateLifecycle() {
  const { standardRates, archiveStandardRates, restoreStandardRate } = useExchangeRates()
  const flow = useLifecycleFlow()

  const archive = (r: StandardRate, onDone?: () => void) => {
    const code = r.sourceCurrency
    flow.request({
      allowed: r.status === 'active',
      confirm: {
        tone: 'danger',
        icon: lifecycleIcon('archive'),
        title: `Archive the ${code} corporate rate?`,
        description: [
          `The ${code} corporate rate of ${fmtRate(r.standardRate)} ${BASE} will be archived. It stays in rate history, but it can no longer be selected for new transactions.`,
          `${code} falls back to the mid-market rate until a new corporate rate is set.`,
        ],
        confirmLabel: 'Archive rate',
      },
      commit: () => archiveStandardRates([r.id]),
      toast: `Corporate rate for ${code} archived`,
    }, onDone)
  }

  const restore = (r: StandardRate, onDone?: () => void) => {
    const code = r.sourceCurrency
    const other = activeStandardRateFor(code, standardRates)
    if (other && other.id !== r.id) {
      flow.request({
        allowed: false,
        commit: () => {},
        refusal: {
          title: `Can't restore the ${code} corporate rate`,
          description: [`${code} already has an active corporate rate, and a pair has one at a time. Archive that one first, or update it instead.`],
          reasonsTitle: 'Active now',
          reasons: [`${fmtRate(other.standardRate)} ${BASE} · effective ${fmtDate(other.effectiveDate)}`],
          dismissLabel: 'Got it',
        },
      })
      return
    }
    flow.request({
      allowed: r.status === 'archived',
      commit: () => restoreStandardRate(r.id),
      toast: `Corporate rate for ${code} restored`,
    }, onDone)
  }

  /** The status chip's pick: Archived archives, Active restores. */
  const request = (next: CorpStatus, r: StandardRate, onDone?: () => void) => (next === 'Archived' ? archive(r, onDone) : restore(r, onDone))

  const archiveBulk = (records: StandardRate[], onDone?: () => void) => {
    const ok = records.filter(r => r.status === 'active')
    const held = records.filter(r => r.status !== 'active')
    if (!ok.length) {
      flow.request({
        allowed: false,
        commit: () => {},
        refusal: {
          title: 'Nothing to archive',
          description: ['Every rate you picked is archived already.'],
          reasonsTitle: 'Already archived',
          reasons: held.map(h => `${h.sourceCurrency} · ${fmtRate(h.standardRate)} ${BASE}`),
          dismissLabel: 'Got it',
        },
      })
      return
    }
    const n = ok.length
    flow.request({
      allowed: true,
      confirm: {
        tone: 'danger',
        icon: lifecycleIcon('archive'),
        badge: 'Archive',
        title: `Archive ${n} corporate ${plural(n, 'rate', 'rates')}?`,
        description: [
          `${plural(n, 'It stays', 'They stay')} in rate history, but ${plural(n, 'it', 'they')} can no longer be selected for new transactions. Each currency falls back to the mid-market rate until a new corporate rate is set.`,
        ],
        reasonsTitle: held.length ? 'Not included' : 'Rates to archive',
        reasons: held.length
          ? held.map(h => `${h.sourceCurrency} · already archived`)
          : ok.slice(0, 6).map(r => `${r.sourceCurrency} · ${fmtRate(r.standardRate)} ${BASE}`).concat(ok.length > 6 ? [`and ${ok.length - 6} more`] : []),
        confirmLabel: `Archive ${plural(n, 'rate', 'rates')}`,
      },
      commit: () => archiveStandardRates(ok.map(r => r.id)),
      toast: `${n} corporate ${plural(n, 'rate', 'rates')} archived`,
      toastDescription: held.length ? `${held.length} already archived.` : undefined,
      toastTone: held.length ? 'info' : 'success',
    }, onDone)
  }

  return { archive, restore, request, archiveBulk, modal: flow.modal }
}
