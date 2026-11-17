// A record's Activity Logs tab: OMNE's shared activity log
// (components/activity-log, installed by the omne-activity-logs plugin and
// never edited here), fed with the BA's entries ("Activity Logs: Currency &
// Exchange Rates") and with each record's own history in the same use cases'
// words (./activityHistory). The renderer is imported before the profile and
// the data, because they import each other (the plugin's build.md, section 4).
import { useMemo } from 'react'
import { EntityActivityLog } from '../../components/activity-log/activity-log'
import { CURRENCY_PROFILE, EXCHANGE_RATE_PROFILE } from '../../components/activity-log/activity-profile'
import { getCurrencyActivity, getExchangeRateActivity } from '../../components/activity-log/activity-data'
import { recordKey, useRecordStore } from '../../coa/lib/recordStore'
import { useCurrencies } from '../../context/CurrencyContext'
import { useExchangeRates } from '../../context/ExchangeRateContext'
import { midMarketHistory } from '../../data/exchangeRates'
import { currencyAttachments, currencyNotes } from '../currency/recordSamples'
import { pairAttachments, pairNotes } from '../exchange/recordSamples'
import { corporateRecordFor } from '../exchange/pairData'
import { currencyHistory, everSeen, exchangeRateHistory, mergeActivity } from './activityHistory'

/** The log's toolbar stays put and only its list scrolls, so the tab holds a
 *  fixed height: the column down to the window's foot, as Coming Soon filled it. */
const FRAME = { height: 'max(480px, calc(100vh - 220px))' }

/** A year of daily syncs, as the pair's Rate history lists them. */
const SYNC_DAYS = 365

/** A currency's own log (the Currency Library's records). */
export function CurrencyActivityLogsTab({ code, name }: { code: string; name: string }) {
  const { getCurrency } = useCurrencies()
  const c = getCurrency(code)
  const key = recordKey('currency', code)
  const written = useRecordStore(s => s.recordNotes[key])
  const files = useRecordStore(s => s.attachments[key])
  const events = useMemo(() => {
    const showcase = getCurrencyActivity(code)
    if (!c) return showcase
    return mergeActivity(showcase, currencyHistory(c, everSeen(currencyNotes(c), written), everSeen(currencyAttachments(c), files)))
  }, [c, code, written, files])
  return (
    <div style={FRAME}>
      <EntityActivityLog entityCode={code} entityName={name} events={events} profile={CURRENCY_PROFILE} />
    </div>
  )
}

/** An exchange rate's own log, by its source currency: one log for the pair,
 *  read the same from its mid-market and its corporate view. */
export function ExchangeRateActivityLogsTab({ code, name }: { code: string; name: string }) {
  const { midMarketRates, standardRates, rateAudit } = useExchangeRates()
  const mid = midMarketRates.find(m => m.sourceCurrency === code)
  const record = corporateRecordFor(code, standardRates)
  const midKey = recordKey('exchangeRate', `${code}:mid`)
  const stdKey = recordKey('exchangeRate', `${code}:std`)
  const midNotes = useRecordStore(s => s.recordNotes[midKey])
  const stdNotes = useRecordStore(s => s.recordNotes[stdKey])
  const midFiles = useRecordStore(s => s.attachments[midKey])
  const stdFiles = useRecordStore(s => s.attachments[stdKey])
  const events = useMemo(() => {
    const series = mid ? midMarketHistory(mid).slice(-(SYNC_DAYS + 1)) : []
    const notes = everSeen([...pairNotes(code, 'mid', record), ...pairNotes(code, 'std', record)], midNotes, stdNotes)
    const files = everSeen([...pairAttachments(code, 'mid', record), ...pairAttachments(code, 'std', record)], midFiles, stdFiles)
    return mergeActivity(getExchangeRateActivity(code), exchangeRateHistory(code, series, rateAudit, notes, files))
  }, [code, mid, record, rateAudit, midNotes, stdNotes, midFiles, stdFiles])
  return (
    <div style={FRAME}>
      <EntityActivityLog entityCode={code} entityName={name} events={events} profile={EXCHANGE_RATE_PROFILE} />
    </div>
  )
}
