// A currency's detail page, rebuilt on the CoA kit's detail skeleton: sticky
// DetailHeaderCard (status menu, Actions, full width), tabs that honour ?tab=,
// a Dashboard holding the live exchange rate converter beside the information
// rail, the Linked transactions register, and the record tabs (Notes,
// Attachments, Communications, Activity).
import { useCallback, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Activity, ArrowLeftRight, ChevronDown, CircleSlash, Coins, Download, FileText, Power } from 'lucide-react'
import { CoaPage } from '../coa/components/CoaPage'
import { DetailHeaderCard } from '../coa/components/DetailHeaderCard'
import { DetailPageLayout, DashboardGrid, DetailNotFound, InfoAuditGrid, InfoGrid, InfoPerson, InfoValue, useDetailFullView, useDetailTab } from '../coa/components/DetailPageLayout'
import { DashInfoCard, DashInfoLabel } from '../coa/components/DashInfoCard'
import { Badge, Menu, MenuItem, Tooltip } from '../coa/components/ui'
import { StatusChip, StatusMenu } from '../coa/components/StatusChip'
import { OverflowPills, PARTNER_CHIP_CLS } from '../coa/components/cells'
import { FlagImage } from '../coa/components/FlagImage'
import { NotesTab, useRecordNotes } from '../coa/components/NotesTab'
import { RecordAttachmentsTab, useRecordAttachmentCount } from '../coa/components/AttachmentsTab'
import { CommsTab, useCommsCount, type Subject } from '../coa/components/CommsTab'
import { ChartWidgetCard } from '../coa/components/ChartWidgetCard'
import { ActivityFeed } from '../coa/components/ActivityFeed'
import { recordKey } from '../coa/lib/recordStore'
import { useCommsDirectorySync } from '../coa/store'
import { fmtDate, fmtDateTime } from '../coa/lib/utils'
import { useCurrencies } from '../context/CurrencyContext'
import { useExchangeRates } from '../context/ExchangeRateContext'
import { API_PROVIDER, BASE_CURRENCY_NAME, LAST_SYNC } from '../data/exchangeRates'
import type { Currency } from '../data/currencies'
import { CONVERTER_TOOLTIP, RATE_TOOLTIPS, inverseRateTooltip } from '../utils/rateCopy'
import {
  BASE, CURRENCY_STATUS_OPTIONS, auditFacts, countInUse, countriesOf, countryFlagOf, flagOf, fmtAmount, placeFlagOf, fmtRate,
  linkedDocs, money, regionOf, statusOf,
} from './currency/model'
import { useCurrencyLifecycle } from './currency/useCurrencyLifecycle'
import { CurrencyConverter } from './currency/CurrencyConverter'
import { LinkedTransactionsTab } from './currency/LinkedTransactionsTab'
import { exportLinkedDocs } from './currency/exportCurrencies'
import { commsAnchorIso, currencyActivity, currencyAttachments, currencyNotes } from './currency/recordSamples'
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
  useCommsDirectorySync(currencies, midMarketRates, standardRates)
  const lifecycle = useCurrencyLifecycle()
  const c = getCurrency(code)
  const [tab, setTab] = useDetailTab<Tab>(TABS, code)
  const [fullscreen, toggleFullscreen] = useDetailFullView('currencyDetail.fullView', tab, { linked: true })
  const key = recordKey('currency', code)
  // What the record tabs open with, derived from the currency (CoA's lib/notes
  // and seeded attachments), read by each tab and the count on it alike.
  const derivedNotes = useMemo(() => currencyNotes(c), [c])
  const seedFiles = useCallback(() => currencyAttachments(c), [c])
  const noteCount = useRecordNotes(key, derivedNotes).length
  const attachmentCount = useRecordAttachmentCount(key, seedFiles)
  /* Read before the not-found return, because the thread is a hook (CoA reads
     its comms subject the same way). Nothing is seeded against an empty id. */
  const commsSubject: Subject = {
    subjectId: c ? key : '',
    kind: c?.isBaseCurrency ? 'base' : 'currency',
    label: c ? `${c.code} ${c.name}` : '',
    anchorIso: commsAnchorIso(),
  }
  // Messages, not threads, as CoA counts them.
  const commsCount = useCommsCount(commsSubject)
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
  const corporate = c.isBaseCurrency ? null : standardRates.find(r => r.sourceCurrency === c.code && r.status === 'active') ?? null
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
                <StatusMenu status={status} options={CURRENCY_STATUS_OPTIONS} onPick={next => lifecycle.request(next, c)} />
                <Tooltip side="bottom" content={`${c.name} (${c.code})`}>
                  <span className="inline-flex cursor-default"><Badge tone="neutral">{c.symbol}</Badge></span>
                </Tooltip>
                {c.isBaseCurrency && (
                  <Tooltip side="bottom" content={RATE_TOOLTIPS.baseCurrency}>
                    <span className="inline-flex cursor-default"><Badge tone="base">Base currency</Badge></span>
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
                      disabledReason={`${c.code} is the base currency. Corporate rates are set for other currencies against it.`}
                    >
                      {corporate ? 'Update corporate rate' : 'Set corporate rate'}
                    </MenuItem>
                    <MenuItem
                      icon={<Download size={14} />}
                      onClick={() => { close(); exportLinkedDocs(c.code, c.decimalPlaces, docs) }}
                      disabled={docs.length === 0}
                      disabledReason={`${c.code} is on no open documents, so there is nothing to export.`}
                    >
                      Export linked transactions
                    </MenuItem>
                    {status === 'Active'
                      ? <MenuItem icon={<CircleSlash size={14} />} warning onClick={() => { close(); lifecycle.request('Inactive', c) }}>Deactivate currency</MenuItem>
                      : <MenuItem icon={<Power size={14} />} onClick={() => { close(); lifecycle.request('Active', c) }}>Activate currency</MenuItem>}
                  </>
                )}
              </Menu>
            }
            tabs={[
              { id: 'dashboard', label: 'Dashboard' },
              { id: 'linked', label: 'Linked transactions', count: countInUse(c) },
              { id: 'notes', label: 'Notes', count: noteCount },
              { id: 'attachments', label: 'Attachments', count: attachmentCount },
              { id: 'communications', label: 'Communications', count: commsCount },
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
            onSetCorporate={setCorporate}
          />
        )}
        {tab === 'linked' && <LinkedTransactionsTab currency={c} docs={docs} />}
        {tab === 'notes' && <NotesTab noteKey={key} noun="currency" derived={derivedNotes} />}
        {tab === 'attachments' && <RecordAttachmentsTab recordKey={key} seed={seedFiles} document={{ recordLabel: `${c.code} ${c.name}`, recordKind: 'currency' }} />}
        {tab === 'communications' && <CommsTab {...commsSubject} />}
        {tab === 'activity' && (
          <ChartWidgetCard title="Activity Timeline" icon={Activity}>
            <ActivityFeed items={currencyActivity(c)} />
          </ChartWidgetCard>
        )}
      </DetailPageLayout>
    </CoaPage>
  )
}

function DashboardTab({ c, mid, corporate, onSetCorporate }: {
  c: Currency
  mid: number | null
  corporate: { standardRate: number; effectiveDate: string; createdBy: string } | null
  onSetCorporate: () => void
}) {
  const dp = c.decimalPlaces
  const rateDp = (n: number) => (n < 1 ? 6 : 4)
  const variance = corporate && mid ? ((corporate.standardRate - mid) / mid) * 100 : null
  const signed = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(2)}%`
  const facts = auditFacts(c)
  const region = regionOf(c)

  return (
    <DashboardGrid
      main={
        <ChartWidgetCard
          title="Live exchange rate converter"
          icon={ArrowLeftRight}
          tooltip={CONVERTER_TOOLTIP}
        >
          <CurrencyConverter detail={c} />
        </ChartWidgetCard>
      }
      rail={
        <>
          <DashInfoCard title="Currency information" icon={FileText}>
            <InfoGrid>
              <div className="min-w-0"><DashInfoLabel>Currency code</DashInfoLabel><InfoValue strong>{c.code}</InfoValue></div>
              <div className="min-w-0"><DashInfoLabel align="right">Symbol</DashInfoLabel><InfoValue strong>{c.symbol}</InfoValue></div>
            </InfoGrid>
            <div className="mb-2.5 min-w-0"><DashInfoLabel>Currency name</DashInfoLabel><InfoValue title={c.name}>{c.name}</InfoValue></div>
            <InfoGrid>
              <div className="min-w-0"><DashInfoLabel tooltip="The ISO 4217 three-digit code.">Numeric code</DashInfoLabel><InfoValue className="tabular-nums">{c.numericCode}</InfoValue></div>
              <div className="min-w-0"><DashInfoLabel align="right" tooltip="Digits after the decimal point that amounts in this currency carry.">Decimal places</DashInfoLabel><InfoValue className="tabular-nums">{c.decimalPlaces}</InfoValue></div>
              <div className="min-w-0">
                <DashInfoLabel tooltip="How an amount of 1,000 is written in this currency.">Format preview</DashInfoLabel>
                <InfoValue className="tabular-nums">{money(c.symbol, 1000, dp)}</InfoValue>
              </div>
              <div className="min-w-0">
                <DashInfoLabel align="right" tooltip={RATE_TOOLTIPS.baseCurrency}>Base currency</DashInfoLabel>
                <div className="mt-0.5"><Badge tone={c.isBaseCurrency ? 'base' : 'neutral'} className={PARTNER_CHIP_CLS}>{c.isBaseCurrency ? 'Yes' : 'No'}</Badge></div>
              </div>
              <div className="min-w-0"><DashInfoLabel>Region</DashInfoLabel>{region ? <InfoValue>{region}</InfoValue> : <InfoValue empty>-</InfoValue>}</div>
              <div className="min-w-0"><DashInfoLabel align="right">Status</DashInfoLabel><div className="mt-0.5"><StatusChip status={statusOf(c)} /></div></div>
            </InfoGrid>
            <div className="mb-2.5 min-w-0">
              <DashInfoLabel>Countries / regions</DashInfoLabel>
              <div className="mt-0.5">
                <OverflowPills
                  category="Countries / Regions"
                  values={countriesOf(c).map((name, i) => ({ name, icon: <FlagImage code={i === 0 ? placeFlagOf(name, c.code) : countryFlagOf(name)} className="text-[13px]" /> }))}
                />
              </div>
            </div>
            <InfoAuditGrid>
              <div className="min-w-0"><DashInfoLabel>Created by</DashInfoLabel><InfoPerson name={facts.createdBy} /></div>
              <div className="min-w-0"><DashInfoLabel align="right">Created on</DashInfoLabel><InfoValue>{facts.createdAt ? fmtDate(facts.createdAt) : '-'}</InfoValue></div>
              <div className="min-w-0"><DashInfoLabel>Last updated by</DashInfoLabel><InfoPerson name={facts.updatedBy} /></div>
              <div className="min-w-0"><DashInfoLabel align="right">Last updated on</DashInfoLabel><InfoValue>{facts.updatedAt ? fmtDate(facts.updatedAt) : '-'}</InfoValue></div>
            </InfoAuditGrid>
          </DashInfoCard>

          <DashInfoCard title="Exchange rate" icon={ArrowLeftRight} tooltip={`Quoted against ${BASE} (${BASE_CURRENCY_NAME}).`}>
            <InfoGrid>
              <div className="min-w-0">
                <DashInfoLabel tooltip={RATE_TOOLTIPS.midMarket}>Mid-market rate</DashInfoLabel>
                {mid != null ? <InfoValue strong className="tabular-nums">{fmtRate(mid, rateDp(mid))}</InfoValue> : <InfoValue empty>Not available</InfoValue>}
              </div>
              <div className="min-w-0">
                <DashInfoLabel align="right" tooltip={mid ? inverseRateTooltip(c.code, BASE, fmtRate(1 / mid, 6)) : RATE_TOOLTIPS.inverse}>Inverse rate</DashInfoLabel>
                {mid ? <InfoValue className="tabular-nums">{fmtRate(1 / mid, 6)}</InfoValue> : <InfoValue empty>-</InfoValue>}
              </div>
              <div className="min-w-0">
                <DashInfoLabel tooltip={RATE_TOOLTIPS.corporate}>Corporate rate</DashInfoLabel>
                {c.isBaseCurrency
                  ? <InfoValue empty>Not applicable</InfoValue>
                  : corporate
                    ? <InfoValue className="tabular-nums">{fmtRate(corporate.standardRate, rateDp(corporate.standardRate))}</InfoValue>
                    : <button type="button" onClick={onSetCorporate} className="text-[12px] text-primary hover:text-[#0862D0] hover:underline underline-offset-2 mt-0.5" style={{ fontWeight: 500 }}>Not set. Set one</button>}
              </div>
              <div className="min-w-0">
                <DashInfoLabel align="right" tooltip={RATE_TOOLTIPS.variance}>Variance</DashInfoLabel>
                {variance != null ? <InfoValue className="tabular-nums">{signed(variance)}</InfoValue> : <InfoValue empty>-</InfoValue>}
              </div>
              <div className="min-w-0"><DashInfoLabel>Source</DashInfoLabel><InfoValue>{c.isBaseCurrency ? 'Base currency' : API_PROVIDER}</InfoValue></div>
              <div className="min-w-0"><DashInfoLabel align="right" tooltip={RATE_TOOLTIPS.lastSync}>Last sync</DashInfoLabel><InfoValue>{fmtDateTime(LAST_SYNC)}</InfoValue></div>
            </InfoGrid>
            {corporate && (
              <div className="pt-2.5 border-t border-muted text-[11px] text-slate-500">
                Corporate rate set by {corporate.createdBy}, effective {fmtDate(corporate.effectiveDate)}.
              </div>
            )}
          </DashInfoCard>
        </>
      }
    />
  )
}
