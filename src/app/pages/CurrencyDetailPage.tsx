// A currency's detail page, rebuilt on the CoA kit's detail skeleton: sticky
// DetailHeaderCard (status menu, Actions, full width), tabs that honour ?tab=,
// a Dashboard holding the live exchange rate converter beside the information
// rail, the Linked transactions register, and the record tabs (Notes,
// Attachments, Communications, Activity).
import { useCallback, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeftRight, ChevronDown, CircleSlash, Coins, Download, FileText, History, MessageSquare, Power } from 'lucide-react'
import { CoaPage } from '../coa/components/CoaPage'
import { DetailHeaderCard } from '../coa/components/DetailHeaderCard'
import { DetailPageLayout, DashboardGrid, DetailNotFound, InfoAuditGrid, InfoGrid, InfoPerson, InfoValue, useDetailFullView, useDetailTab } from '../coa/components/DetailPageLayout'
import { DashInfoCard, DashInfoLabel } from '../coa/components/DashInfoCard'
import { Badge, Menu, MenuItem, Tooltip } from '../coa/components/ui'
import { StatusChip, StatusMenu } from '../coa/components/StatusChip'
import { PARTNER_CHIP_CLS } from '../coa/components/cells'
import { FlagImage } from '../coa/components/FlagImage'
import { useRecordNotes } from '../coa/components/NotesTab'
import { RecordAttachmentsTab, useRecordAttachmentCount } from '../coa/components/AttachmentsTab'
import { ChartWidgetCard } from '../coa/components/ChartWidgetCard'
import { recordKey } from '../coa/lib/recordStore'
import { fmtDate, fmtDateTime, todayIso } from '../coa/lib/utils'
import { useCurrencies } from '../context/CurrencyContext'
import { useExchangeRates } from '../context/ExchangeRateContext'
import { API_PROVIDER, LAST_SYNC, corporateRateInEffect, upcomingRateOf } from '../data/exchangeRates'
import type { Currency } from '../data/currencies'
import { CURRENCY_TOOLTIPS, MID_MARKET_DETAIL_TOOLTIP, RATE_TOOLTIPS } from '../utils/rateCopy'
import { auditTooltips } from './auditColumns'
import { fmtVariance } from './exchange/rateModel'
import {
  BASE, auditFacts, BASE_CURRENCY_LOCKED, countInUse, fmtRate, formatPreview, linkedDocs, placeFlagOf,
  regionOf, statusOf, statusOptionsFor,
} from './currency/model'
import { useCurrencyLifecycle } from './currency/useCurrencyLifecycle'
import { CurrencyConverter } from './currency/CurrencyConverter'
import { LinkedTransactionsTab } from './currency/LinkedTransactionsTab'
import { exportLinkedDocs } from './currency/exportCurrencies'
import { currencyAttachments, currencyNotes } from './currency/recordSamples'
import { RecordNotesTab } from './recordTabs/NotesTab'
import { ComingSoonTab } from './recordTabs/ComingSoonTab'
import { CX_TITLE } from './CurrencyExchangeHeader'

const TABS = ['dashboard', 'linked', 'notes', 'attachments', 'communications', 'activity'] as const
type Tab = typeof TABS[number]

const LIST_PATH = '/accounting/currencies'
const ACTIONS_TRIGGER = 'h-9 px-3.5 text-[13px] rounded-lg border border-border bg-white hover:bg-slate-50 text-slate-700 inline-flex items-center gap-1.5 transition-all duration-200 cursor-pointer shadow-sm'

export function CurrencyDetailPage() {
  const { code: raw } = useParams<{ code: string }>()
  const code = (raw ?? '').toUpperCase()
  const navigate = useNavigate()
  const { getCurrency, currencies } = useCurrencies()
  const { midMarketRates, standardRates } = useExchangeRates()
  const lifecycle = useCurrencyLifecycle()
  const c = getCurrency(code)
  const [tab, setTab] = useDetailTab<Tab>(TABS, code)
  const [fullscreen, toggleFullscreen] = useDetailFullView('currencyDetail.fullView', tab)
  const key = recordKey('currency', code)
  // What the record tabs open with, derived from the currency (CoA's lib/notes
  // and seeded attachments), read by each tab and the count on it alike.
  const derivedNotes = useMemo(() => currencyNotes(c), [c])
  const seedFiles = useCallback(() => currencyAttachments(c), [c])
  const noteCount = useRecordNotes(key, derivedNotes).length
  const attachmentCount = useRecordAttachmentCount(key, seedFiles)
  const docs = useMemo(() => (c ? linkedDocs(c) : []), [c])

  const crumbs = [{ label: 'Accounting', to: '/accounting' }, { label: CX_TITLE, to: LIST_PATH }, { label: code }]
  if (!c) {
    return (
      <CoaPage crumbs={crumbs}>
        <DetailNotFound icon={<Coins size={20} />} title="Currency not found" onBack={() => navigate(LIST_PATH)} backLabel="Back to Currency Library" />
      </CoaPage>
    )
  }

  const mid = c.isBaseCurrency ? 1 : midMarketRates.find(r => r.sourceCurrency === c.code)?.rate ?? null
  // The corporate rate in effect today; one dated for later shows as Upcoming.
  const today = todayIso()
  const corporate = c.isBaseCurrency ? null : corporateRateInEffect(c.code, standardRates, today) ?? null
  const record = c.isBaseCurrency ? undefined : standardRates.find(r => r.sourceCurrency === c.code && r.status === 'active')
  const upcoming = record ? upcomingRateOf(record, today) : null
  const setCorporate = () => navigate(`/accounting/exchange-rates?addCorp=${encodeURIComponent(c.code)}`)
  const status = statusOf(c)

  return (
    <CoaPage crumbs={crumbs}>
      <DetailPageLayout
        fullscreen={fullscreen}
        fillsWindow={tab === 'linked'}
        swapKey={tab}
        header={
          <DetailHeaderCard
            fullscreen={fullscreen}
            onToggleFullscreen={toggleFullscreen}
            onBack={() => navigate(LIST_PATH)}
            backTitle="Back to Currency Library"
            numberLabel={c.code}
            title={c.name}
            tone={status === 'Inactive' ? 'warning' : 'default'}
            typeLine={<><FlagImage code={placeFlagOf(c.country, c.code)} className="text-[13px]" />{c.country} · {c.decimalPlaces} decimal {c.decimalPlaces === 1 ? 'place' : 'places'}</>}
            titleBadges={
              <>
                <StatusMenu status={status} options={statusOptionsFor(c)} onPick={next => lifecycle.request(next, c)} />
                <Tooltip side="bottom" content={`${c.name} (${c.code})`}>
                  <span className="inline-flex cursor-default"><Badge tone="neutral">{c.symbol}</Badge></span>
                </Tooltip>
                {c.isBaseCurrency && (
                  <Tooltip side="bottom" content={RATE_TOOLTIPS.baseCurrency}>
                    <span className="inline-flex cursor-default"><Badge tone="base">Base Currency</Badge></span>
                  </Tooltip>
                )}
              </>
            }
            actions={
              <Menu trigger={
                <button type="button" aria-label="Currency actions" className={ACTIONS_TRIGGER} style={{ fontWeight: 500 }}>
                  Actions
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>
              }>
                {close => (
                  <>
                    <MenuItem
                      icon={<ArrowLeftRight size={14} />}
                      onClick={() => { close(); setCorporate() }}
                      disabled={c.isBaseCurrency}
                      disabledReason="This is the base currency. Corporate rates are set for other currencies against it."
                    >
                      {record ? 'Update Corporate Rate' : 'Set Corporate Rate'}
                    </MenuItem>
                    <MenuItem
                      icon={<Download size={14} />}
                      onClick={() => { close(); exportLinkedDocs(c.code, c.decimalPlaces, docs) }}
                      disabled={docs.length === 0}
                      disabledReason="This currency is on no open transactions, so there is nothing to export."
                    >
                      Export Linked Transactions
                    </MenuItem>
                    {status === 'Active'
                      ? <MenuItem icon={<CircleSlash size={14} />} warning onClick={() => { close(); lifecycle.request('Inactive', c) }} disabled={c.isBaseCurrency} disabledReason={BASE_CURRENCY_LOCKED}>Deactivate Currency</MenuItem>
                      : <MenuItem icon={<Power size={14} />} onClick={() => { close(); lifecycle.request('Active', c) }}>Activate Currency</MenuItem>}
                  </>
                )}
              </Menu>
            }
            tabs={[
              { id: 'dashboard', label: 'Dashboard' },
              { id: 'linked', label: 'Linked Transactions', count: countInUse(c) },
              { id: 'notes', label: 'Notes', count: noteCount },
              { id: 'attachments', label: 'Attachments', count: attachmentCount },
              { id: 'communications', label: 'Communications' },
              { id: 'activity', label: 'Activity' },
            ]}
            activeTab={tab}
            onTabChange={id => setTab(id as Tab)}
          />
        }
        overlays={lifecycle.modal}
      >
        {tab === 'dashboard' && (
          <DashboardTab
            c={c}
            mid={mid}
            corporate={corporate}
            upcoming={upcoming}
          />
        )}
        {tab === 'linked' && <LinkedTransactionsTab currency={c} docs={docs} />}
        {tab === 'notes' && <RecordNotesTab noteKey={key} noun="currency" derived={derivedNotes} />}
        {tab === 'attachments' && <RecordAttachmentsTab recordKey={key} seed={seedFiles} document={{ recordLabel: `${c.code} ${c.name}`, recordKind: 'currency' }} />}
        {/* Communications and Activity follow Vendor Invoicing, which shows these
            two as Coming Soon until their backends land. */}
        {tab === 'communications' && (
          <ComingSoonTab label="Communications" icon={MessageSquare}
            description="Message history for this currency, with your team and partners, will live here. The shared communication surface keeps every conversation attached to the record it is about." />
        )}
        {tab === 'activity' && (
          <ComingSoonTab label="Activity" icon={History}
            description="A chronological audit trail of every action on this currency: status changes, rate updates and edits. The activity feed arrives with backend integration." />
        )}
      </DetailPageLayout>
    </CoaPage>
  )
}

function DashboardTab({ c, mid, corporate, upcoming }: {
  c: Currency
  mid: number | null
  corporate: { standardRate: number; effectiveDate: string; createdBy: string } | null
  /** A corporate rate dated for later. */
  upcoming: { standardRate: number; effectiveDate: string } | null
}) {
  const variance = corporate && mid ? ((corporate.standardRate - mid) / mid) * 100 : null
  const facts = auditFacts(c)
  const region = regionOf(c)
  const preview = formatPreview(c)

  return (
    <DashboardGrid
      main={
        <ChartWidgetCard
          title="Live Exchange Rate Converter"
          icon={ArrowLeftRight}
        >
          <CurrencyConverter detail={c} />
        </ChartWidgetCard>
      }
      rail={
        <>
          <DashInfoCard title="Currency Information" icon={FileText}>
            <InfoGrid>
              <div className="min-w-0"><DashInfoLabel>Currency Code</DashInfoLabel><InfoValue strong>{c.code}</InfoValue></div>
              <div className="min-w-0"><DashInfoLabel align="right" tooltip={CURRENCY_TOOLTIPS.symbol}>Symbol</DashInfoLabel><InfoValue strong>{c.symbol}</InfoValue></div>
            </InfoGrid>
            <div className="mb-2.5 min-w-0"><DashInfoLabel>Currency Name</DashInfoLabel><InfoValue title={c.name}>{c.name}</InfoValue></div>
            <InfoGrid>
              <div className="min-w-0"><DashInfoLabel tooltip={CURRENCY_TOOLTIPS.numericCode}>ISO Numeric Code</DashInfoLabel><InfoValue className="tabular-nums">{c.numericCode}</InfoValue></div>
              <div className="min-w-0"><DashInfoLabel align="right" tooltip={CURRENCY_TOOLTIPS.decimals}>Decimal Places</DashInfoLabel><InfoValue className="tabular-nums">{c.decimalPlaces}</InfoValue></div>
              <div className="min-w-0">
                <DashInfoLabel tooltip="How a large amount is written in this currency: the thousand and decimal separators and where the symbol goes.">Format Preview</DashInfoLabel>
                <InfoValue className="tabular-nums"><span dir="ltr">{preview.text}</span></InfoValue>
              </div>
              <div className="min-w-0">
                <DashInfoLabel align="right" tooltip={RATE_TOOLTIPS.baseCurrency}>Base Currency</DashInfoLabel>
                <div className="mt-0.5"><Badge tone={c.isBaseCurrency ? 'base' : 'neutral'} className={PARTNER_CHIP_CLS}>{c.isBaseCurrency ? 'Yes' : 'No'}</Badge></div>
              </div>
              <div className="min-w-0"><DashInfoLabel tooltip={CURRENCY_TOOLTIPS.region}>Region</DashInfoLabel>{region ? <InfoValue>{region}</InfoValue> : <InfoValue empty>–</InfoValue>}</div>
              <div className="min-w-0"><DashInfoLabel align="right" tooltip={CURRENCY_TOOLTIPS.status}>Status</DashInfoLabel><div className="mt-0.5"><StatusChip status={statusOf(c)} /></div></div>
            </InfoGrid>
            {/* Who made and last changed it, and when: the same four as the library's audit columns. */}
            <InfoAuditGrid>
              <div className="min-w-0"><DashInfoLabel tooltip={auditTooltips('currency').createdBy}>Created By</DashInfoLabel><InfoPerson name={facts.createdBy} /></div>
              <div className="min-w-0"><DashInfoLabel align="right" tooltip={auditTooltips('currency').createdAt}>Created On</DashInfoLabel><InfoValue>{facts.createdAt ? fmtDateTime(facts.createdAt) : '–'}</InfoValue></div>
              <div className="min-w-0"><DashInfoLabel tooltip={auditTooltips('currency').updatedBy}>Last Updated By</DashInfoLabel><InfoPerson name={facts.updatedBy} /></div>
              <div className="min-w-0"><DashInfoLabel align="right" tooltip={auditTooltips('currency').updatedAt}>Last Updated On</DashInfoLabel><InfoValue>{facts.updatedAt ? fmtDateTime(facts.updatedAt) : '–'}</InfoValue></div>
            </InfoAuditGrid>
          </DashInfoCard>

          <DashInfoCard title="Exchange Rate" icon={ArrowLeftRight} tooltip="Rates for 1 unit of this currency in your base currency.">
            <InfoGrid>
              <div className="min-w-0">
                <DashInfoLabel tooltip={MID_MARKET_DETAIL_TOOLTIP}>Mid-Market Rate</DashInfoLabel>
                {mid != null ? <InfoValue strong className="tabular-nums">{fmtRate(mid)}</InfoValue> : <InfoValue empty>Not available</InfoValue>}
              </div>
              <div className="min-w-0">
                <DashInfoLabel align="right" tooltip={RATE_TOOLTIPS.inverse}>Inverse Rate</DashInfoLabel>
                {mid ? <InfoValue className="tabular-nums">{fmtRate(1 / mid)}</InfoValue> : <InfoValue empty>–</InfoValue>}
              </div>
              <div className="min-w-0">
                <DashInfoLabel tooltip={RATE_TOOLTIPS.corporate}>Corporate Rate</DashInfoLabel>
                {c.isBaseCurrency
                  ? <InfoValue empty>Not applicable</InfoValue>
                  : corporate
                    ? <InfoValue className="tabular-nums">{fmtRate(corporate.standardRate)}</InfoValue>
                    : upcoming
                      ? <InfoValue empty>None in effect yet</InfoValue>
                      : <InfoValue empty>–</InfoValue>}
              </div>
              <div className="min-w-0">
                <DashInfoLabel align="right" tooltip={RATE_TOOLTIPS.variance}>Variance</DashInfoLabel>
                {variance != null && corporate && mid ? <InfoValue className="tabular-nums">{fmtVariance(corporate.standardRate, mid)}</InfoValue> : <InfoValue empty>–</InfoValue>}
              </div>
              {/* The base currency's rates come from no provider, so it has no Source;
                  Last Synced then opens the row on the left. */}
              {!c.isBaseCurrency && <div className="min-w-0"><DashInfoLabel>Source</DashInfoLabel><InfoValue>{API_PROVIDER}</InfoValue></div>}
              <div className="min-w-0"><DashInfoLabel align={c.isBaseCurrency ? undefined : 'right'} tooltip={RATE_TOOLTIPS.lastSync}>Last Synced</DashInfoLabel><InfoValue>{fmtDateTime(LAST_SYNC)}</InfoValue></div>
            </InfoGrid>
            {(corporate || upcoming) && (
              <div className="pt-2.5 border-t border-muted text-[11px] text-slate-500 space-y-1">
                {corporate && <p>Corporate rate set by {corporate.createdBy}, effective {fmtDate(corporate.effectiveDate)}.</p>}
                {upcoming && (
                  <p className="flex items-center gap-1.5 tabular-nums">
                    <Badge tone="info">Upcoming</Badge>
                    {fmtRate(upcoming.standardRate)} {BASE} from {fmtDate(upcoming.effectiveDate)}
                  </p>
                )}
              </div>
            )}
          </DashInfoCard>
        </>
      }
    />
  )
}
