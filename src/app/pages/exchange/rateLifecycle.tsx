// Exchange Rates screens: the corporate rate lifecycle, CoA-style (plan, then a
// refusal, a confirmation or an immediate commit, then the toast). One rule set
// for every door: the row menu, the status chip, the Actions menu and the bulk bar.
import { useExchangeRates } from '../../context/ExchangeRateContext'
import { useCurrencies } from '../../context/CurrencyContext'
import { activeStandardRateFor, type StandardRate } from '../../data/exchangeRates'
import { useLifecycleFlow, lifecycleIcon } from '../../coa/lib/lifecycle'
import type { StatusOption } from '../../coa/components/StatusChip'
import { fmtDate } from '../../coa/lib/utils'
import { corporateRateDocs, docTypeMeta, type LinkedDoc } from '../currency/model'
import { BASE, fmtRate, type CorpStatus } from './rateModel'

export const CORPORATE_STATUS_OPTIONS: StatusOption<CorpStatus>[] = [
  { value: 'Active', verb: 'Restore', meaning: ['The rate in effect for this pair. It can be selected on new transactions.'] },
  { value: 'Archived', verb: 'Archive', meaning: ['Kept in rate history, but it can no longer be selected on new transactions.'] },
]

export const MID_STATUS_OPTIONS: StatusOption<'Active'>[] = [
  { value: 'Active', verb: 'Activate', meaning: ['Synced from the rate provider.'] },
]

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)

/** "INV-000217 · Vendor Invoice · Acme Corp", the first six, then a count. */
const docLines = (docs: LinkedDoc[]) => docs.slice(0, 6)
  .map(d => `${d.number} · ${docTypeMeta(d.type).label} · ${d.party}`)
  .concat(docs.length > 6 ? [`and ${docs.length - 6} more`] : [])

export function useCorporateRateLifecycle() {
  const { standardRates, archiveStandardRates, restoreStandardRate } = useExchangeRates()
  const { currencies } = useCurrencies()
  const flow = useLifecycleFlow()

  /** The active transactions priced at this rate: any at all keeps it from being archived. */
  const linkedTo = (r: StandardRate): LinkedDoc[] => {
    const c = currencies.find(x => x.code === r.sourceCurrency)
    return c ? corporateRateDocs(c) : []
  }

  const archive = (r: StandardRate, onDone?: () => void) => {
    const linked = r.status === 'active' ? linkedTo(r) : []
    if (linked.length) {
      const n = linked.length
      flow.request({
        allowed: false,
        commit: () => {},
        refusal: {
          title: "Can't archive this corporate rate",
          description: [`${n} active ${plural(n, 'transaction is', 'transactions are')} priced at this rate. Close or settle ${plural(n, 'it', 'them')} first, then archive the rate.`],
          reasonsTitle: 'Linked Transactions',
          reasons: docLines(linked),
          dismissLabel: 'Got It',
        },
      })
      return
    }
    flow.request({
      allowed: r.status === 'active',
      confirm: {
        tone: 'danger',
        icon: lifecycleIcon('archive'),
        title: 'Archive this corporate rate?',
        description: [
          'This corporate rate will be archived. It stays in rate history, but it can no longer be selected for new transactions.',
          'The currency falls back to the mid-market rate until a new corporate rate is set.',
        ],
        confirmLabel: 'Archive Rate',
      },
      commit: () => archiveStandardRates([r.id]),
      toast: 'Corporate rate archived',
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
          title: "Can't restore this corporate rate",
          description: ['This currency already has an active corporate rate, and a pair has one at a time. Archive that one first, or update it instead.'],
          reasonsTitle: 'Active Now',
          reasons: [`${fmtRate(other.standardRate)} ${BASE} · effective ${fmtDate(other.effectiveDate)}`],
          dismissLabel: 'Got It',
        },
      })
      return
    }
    flow.request({
      allowed: r.status === 'archived',
      commit: () => restoreStandardRate(r.id),
      toast: 'Corporate rate restored',
    }, onDone)
  }

  /** The status chip's pick: Archived archives, Active restores. */
  const request = (next: CorpStatus, r: StandardRate, onDone?: () => void) => (next === 'Archived' ? archive(r, onDone) : restore(r, onDone))

  const archiveBulk = (records: StandardRate[], onDone?: () => void) => {
    // Each picked rate either archives, is archived already, or is held by active transactions.
    const linkedOf = new Map(records.filter(r => r.status === 'active').map(r => [r.id, linkedTo(r)]))
    const ok = records.filter(r => r.status === 'active' && !linkedOf.get(r.id)!.length)
    const held = records.filter(r => !ok.includes(r))
    const why = (h: StandardRate) => {
      const k = linkedOf.get(h.id)?.length ?? 0
      return k ? `${h.sourceCurrency} · on ${k} active ${plural(k, 'transaction', 'transactions')}` : `${h.sourceCurrency} · already archived`
    }
    const heldByDocs = held.filter(h => (linkedOf.get(h.id)?.length ?? 0) > 0).length
    const alreadyArchived = held.length - heldByDocs
    if (!ok.length) {
      flow.request({
        allowed: false,
        commit: () => {},
        refusal: {
          title: 'Nothing to archive',
          description: [
            heldByDocs && !alreadyArchived
              ? `${plural(held.length, 'The rate you picked is', 'Every rate you picked is')} priced into active transactions. Close or settle them first, then archive.`
              : !heldByDocs
                ? 'Every rate you picked is archived already.'
                : 'Each rate you picked is either archived already or priced into active transactions.',
          ],
          reasonsTitle: 'Why Each One Stayed',
          reasons: held.map(why),
          dismissLabel: 'Got It',
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
        reasonsTitle: held.length ? 'Not Included' : 'Rates to Archive',
        reasons: held.length
          ? held.map(why)
          : ok.slice(0, 6).map(r => `${r.sourceCurrency} · ${fmtRate(r.standardRate)} ${BASE}`).concat(ok.length > 6 ? [`and ${ok.length - 6} more`] : []),
        confirmLabel: `Archive ${plural(n, 'Rate', 'Rates')}`,
      },
      commit: () => archiveStandardRates(ok.map(r => r.id)),
      toast: `${n} corporate ${plural(n, 'rate', 'rates')} archived`,
      toastDescription: held.length
        ? `${[heldByDocs ? `${heldByDocs} held by active transactions` : '', alreadyArchived ? `${alreadyArchived} already archived` : ''].filter(Boolean).join(' · ')}.`
        : undefined,
      toastTone: held.length ? 'info' : 'success',
    }, onDone)
  }

  /** Whether archive would go through: active, and no active transaction priced at it. */
  const canArchive = (r: StandardRate) => r.status === 'active' && !linkedTo(r).length

  return { archive, restore, request, archiveBulk, canArchive, modal: flow.modal }
}
