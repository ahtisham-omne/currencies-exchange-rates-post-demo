// Exchange Rate Library: the two tables' columns (CoA §4 cell recipes over
// rate data) and the Region filters modal.
import { useEffect, useState } from 'react'
import { Minus, TrendingDown, TrendingUp } from 'lucide-react'
import { REGION_LIST } from '../../data/currencies'
import { RATE_TOOLTIPS } from '../../utils/rateCopy'
import { Badge, Marked, Tooltip } from '../../coa/components/ui'
import type { CoaColumn } from '../../coa/components/CoaDataTable'
import { CurrencyCell, EmptyCell, PARTNER_CHIP_CLS } from '../../coa/components/cells'
import { PersonCell, StampCell, personText, stampText } from '../../coa/components/AuditCells'
import { StatusMenu } from '../../coa/components/StatusChip'
import { FlagImage } from '../../coa/components/FlagImage'
import { FiltersModal, Section, PillSection, AllPill } from '../../coa/components/Filters'
import { cn, fmtDate, fmtNumber } from '../../coa/lib/utils'
import { CORPORATE_STATUS_OPTIONS } from './rateLifecycle'
import { BASE, fmtInverse, fmtPairRate, fmtRate, fmtSignedPct, type CorpRow, type CorpStatus, type MidRow } from './rateModel'

/* ── Cells ──────────────────────────────────────────────────────────────── */

/* A rate as the pair it prices, "1 AED = 75.8400 PKR": the figure carries the
   weight, the units around it are quieter so a column still scans by number. */
const RateText = ({ from, value, to, q, strong }: { from: string; value: string; to: string; q: string; strong?: boolean }) => (
  <span className="text-sm tabular-nums whitespace-nowrap">
    <span className="text-fg-subtle">1 {from} = </span>
    <span className={strong ? 'font-medium text-slate-700' : 'text-slate-500'}><Marked text={value} q={q} /></span>
    <span className="text-fg-subtle"> {to}</span>
  </span>
)

function ChangeCell({ value }: { value: number }) {
  const Icon = value > 0 ? TrendingUp : value < 0 ? TrendingDown : Minus
  return (
    <span className={cn('inline-flex items-center justify-end gap-1 text-sm tabular-nums whitespace-nowrap', value > 0 ? 'text-success-700' : value < 0 ? 'text-danger-700' : 'text-fg-subtle')} style={{ fontWeight: 500 }}>
      <Icon size={12} />{fmtSignedPct(value)}
    </span>
  )
}

/** The rate a corporate row shows: the one in effect, else the one coming. */
const shownRate = (r: CorpRow) => r.rate ?? r.upcoming?.rate ?? null
/** When that rate takes (or took) effect. */
const shownDate = (r: CorpRow) => (r.rate != null ? r.effectiveDate : r.upcoming?.effectiveDate ?? '')

/* A corporate rate with a change booked for later carries an Upcoming pill
   beside its figure; the hover says what and when. A rate added for a later
   date with none in effect yet shows that coming figure, pill included, and
   its date in Effective Date. The pill sits before the number so the figures
   keep their right-aligned column. */
function CorpRateCell({ r, q }: { r: CorpRow; q: string }) {
  const rate = shownRate(r)
  if (rate == null) return <EmptyCell />
  const up = r.upcoming
  const hint = !up ? null : r.rate != null
    ? `${fmtPairRate(r.code, up.rate)} from ${fmtDate(up.effectiveDate)}. The current rate stays in effect until then.`
    : `Takes effect ${fmtDate(up.effectiveDate)}. No corporate rate is in effect until then.`
  return (
    <span className="inline-flex items-center justify-end gap-1.5">
      {hint && (
        <Tooltip content={hint} side="top" align="right">
          <Badge tone="info" className={cn(PARTNER_CHIP_CLS, 'cursor-default')}>Upcoming</Badge>
        </Tooltip>
      )}
      <RateText from={r.code} value={fmtRate(rate)} to={BASE} q={q} strong />
    </span>
  )
}

function CountryCell({ row, q }: { row: { flag: string; country: string; region: string | null }; q: string }) {
  if (!row.country) return <EmptyCell />
  return (
    <span className="inline-flex items-center gap-1.5 min-w-0 text-sm text-slate-700" title={row.region ? `${row.country} · ${row.region}` : row.country}>
      <FlagImage code={row.flag} className="text-base" />
      <span className="truncate"><Marked text={row.country} q={q} /></span>
      {row.region && row.region !== row.country && <span className="text-fg-subtle truncate">· <Marked text={row.region} q={q} /></span>}
    </span>
  )
}

/* ── Mid-market table ───────────────────────────────────────────────────── */

export function midColumns(): CoaColumn<MidRow>[] {
  return [
    {
      key: 'currency', label: 'Source Currency', locked: true, width: 300, info: RATE_TOOLTIPS.sourceCurrency,
      render: (r, ctx) => <CurrencyCell code={r.code} country={r.flag} name={r.name} q={ctx.q} showName strong={ctx.band} onOpen={ctx.openRow} />,
      sortValue: r => r.code, searchText: r => [r.code, r.name], filter: 'text', filterValue: r => `${r.code} ${r.name}`,
    },
    {
      key: 'rate', label: 'Mid-Market Exchange Rate', align: 'right', cellClassName: 'pl-4 pr-4', headerClassName: 'min-w-[210px]', info: RATE_TOOLTIPS.midMarket,
      render: (r, ctx) => <RateText from={r.code} value={fmtRate(r.rate)} to={BASE} q={ctx.q} strong />,
      sortValue: r => r.rate, searchText: r => fmtRate(r.rate), filter: 'range',
    },
    {
      key: 'inverse', label: 'Inverse Rate', align: 'right', cellClassName: 'pl-4 pr-4', headerClassName: 'min-w-[180px]', info: RATE_TOOLTIPS.inverse,
      render: (r, ctx) => <RateText from={BASE} value={fmtInverse(r.rate)} to={r.code} q={ctx.q} />,
      // The inverse is not a stored field, so it sorts on the figure it prints.
      sortValue: r => 1 / r.rate, searchText: r => fmtInverse(r.rate), filter: 'range', filterValue: r => 1 / r.rate,
    },
    {
      key: 'change', label: 'Change (24h)', align: 'right', cellClassName: 'pl-4 pr-4', headerClassName: 'min-w-[140px]', info: RATE_TOOLTIPS.change24h,
      render: r => <ChangeCell value={r.change24h} />,
      sortValue: r => r.change24h, searchText: r => fmtSignedPct(r.change24h), filter: 'range',
    },
    {
      key: 'country', label: 'Country / Region', defaultHidden: true, headerClassName: 'min-w-[240px]',
      info: 'Where the currency is used, and the region the Region filter files it under.',
      render: (r, ctx) => <CountryCell row={r} q={ctx.q} />,
      sortValue: r => r.country, searchText: r => [r.country, r.region ?? ''], filter: 'multiselect', filterValue: r => r.region ?? '',
    },
    {
      key: 'effective', label: 'Last Synced', defaultHidden: true, headerClassName: 'min-w-[130px]',
      info: 'The day the provider last refreshed this rate.',
      render: (r, ctx) => <span className="text-sm text-slate-700 tabular-nums whitespace-nowrap"><Marked text={fmtDate(r.effectiveDate)} q={ctx.q} /></span>,
      sortValue: r => r.effectiveDate, searchText: r => fmtDate(r.effectiveDate), filter: 'date', filterValue: r => r.effectiveDate,
    },
  ]
}

/* ── Corporate table ────────────────────────────────────────────────────── */

export function corpColumns(onStatus: (next: CorpStatus, row: CorpRow) => void): CoaColumn<CorpRow>[] {
  return [
    {
      key: 'currency', label: 'Source Currency', locked: true, width: 300, info: RATE_TOOLTIPS.sourceCurrency,
      render: (r, ctx) => <CurrencyCell code={r.code} country={r.flag} name={r.name} q={ctx.q} showName strong={ctx.band} onOpen={ctx.openRow} />,
      sortValue: r => r.code, searchText: r => [r.code, r.name], filter: 'text', filterValue: r => `${r.code} ${r.name}`,
    },
    {
      key: 'rate', label: 'Corporate Exchange Rate', align: 'right', cellClassName: 'pl-4 pr-4', headerClassName: 'min-w-[210px]', info: RATE_TOOLTIPS.corporate,
      render: (r, ctx) => <CorpRateCell r={r} q={ctx.q} />,
      sortValue: r => shownRate(r),
      searchText: r => {
        const rate = shownRate(r)
        return rate == null ? '' : r.upcoming ? [fmtRate(rate), 'Upcoming', fmtRate(r.upcoming.rate)] : fmtRate(rate)
      },
      filter: 'range', filterValue: r => shownRate(r),
    },
    {
      key: 'inverse', label: 'Inverse Rate', align: 'right', cellClassName: 'pl-4 pr-4', headerClassName: 'min-w-[180px]', info: RATE_TOOLTIPS.inverse,
      // The inverse of the figure the row shows, so the two always pair up.
      render: (r, ctx) => { const rate = shownRate(r); return rate == null ? <EmptyCell /> : <RateText from={BASE} value={fmtInverse(rate)} to={r.code} q={ctx.q} /> },
      sortValue: r => { const rate = shownRate(r); return rate == null ? null : 1 / rate },
      searchText: r => { const rate = shownRate(r); return rate == null ? '' : fmtInverse(rate) },
      filter: 'range', filterValue: r => { const rate = shownRate(r); return rate == null ? null : 1 / rate },
    },
    {
      key: 'mid', label: 'Mid-Market Exchange Rate', align: 'right', cellClassName: 'pl-4 pr-4', headerClassName: 'min-w-[210px]', info: RATE_TOOLTIPS.midMarket,
      render: (r, ctx) => (r.mid == null ? <EmptyCell /> : <RateText from={r.code} value={fmtRate(r.mid)} to={BASE} q={ctx.q} />),
      sortValue: r => r.mid, searchText: r => (r.mid == null ? '' : fmtRate(r.mid)), filter: 'range',
    },
    {
      key: 'variance', label: 'Variance', align: 'right', cellClassName: 'pl-4 pr-4', headerClassName: 'min-w-[120px]', info: RATE_TOOLTIPS.variance,
      render: (r, ctx) => (r.variance == null ? <EmptyCell /> : (
        <Badge tone={Math.abs(r.variance) > 1 ? 'warning' : 'success'} className={cn(PARTNER_CHIP_CLS, 'tabular-nums')}><Marked text={fmtSignedPct(r.variance)} q={ctx.q} /></Badge>
      )),
      sortValue: r => r.variance, searchText: r => (r.variance == null ? '' : fmtSignedPct(r.variance)), filter: 'range',
    },
    {
      key: 'effective', label: 'Effective Date', headerClassName: 'min-w-[140px]', info: RATE_TOOLTIPS.effectiveDate,
      // The date of the figure in the rate column: the upcoming one's when none is in effect yet.
      render: (r, ctx) => { const d = shownDate(r); return d ? <span className="text-sm text-slate-700 tabular-nums whitespace-nowrap"><Marked text={fmtDate(d)} q={ctx.q} /></span> : <EmptyCell /> },
      sortValue: r => shownDate(r) || null, searchText: r => (shownDate(r) ? fmtDate(shownDate(r)) : ''), filter: 'date', filterValue: r => shownDate(r) || null,
    },
    {
      key: 'createdBy', label: 'Created By', pad: 'person', cellClassName: 'px-4 max-w-[220px]', headerClassName: 'min-w-[170px]',
      info: 'Who set the rate up.',
      render: (r, ctx) => (r.createdBy ? <PersonCell name={r.createdBy} comfort={ctx.comfort} q={ctx.q} /> : <EmptyCell />),
      sortValue: r => personText(r.createdBy) || null, searchText: r => personText(r.createdBy), filter: 'multiselect', filterValue: r => personText(r.createdBy),
    },
    {
      key: 'status', label: 'Status', headerClassName: 'min-w-[120px]',
      info: 'Active rates can be selected on new transactions. Archived ones stay in rate history only.',
      render: (r, ctx) => <StatusMenu status={r.status} options={CORPORATE_STATUS_OPTIONS} onPick={next => onStatus(next, r)} q={ctx.q} />,
      sortValue: r => r.status, searchText: r => r.status, filter: 'multiselect', filterValue: r => r.status,
    },
    {
      key: 'updatedAt', label: 'Last Updated On', defaultHidden: true, headerClassName: 'min-w-[170px]',
      info: 'When the rate was changed last, in your time zone.',
      render: (r, ctx) => (r.updatedAt ? <StampCell at={r.updatedAt} q={ctx.q} /> : <EmptyCell />),
      sortValue: r => r.updatedAt || null, searchText: r => stampText(r.updatedAt), filter: 'date', filterValue: r => r.updatedAt || null,
    },
    {
      key: 'notes', label: 'Notes', defaultHidden: true, headerClassName: 'min-w-[220px]',
      info: 'What the team noted when they set the rate.',
      render: (r, ctx) => (r.notes ? <span className="text-sm text-slate-700 block truncate max-w-[320px]" title={r.notes}><Marked text={r.notes} q={ctx.q} /></span> : <EmptyCell />),
      sortValue: r => r.notes || null, searchText: r => r.notes, filter: 'text',
    },
    {
      key: 'country', label: 'Country / Region', defaultHidden: true, headerClassName: 'min-w-[240px]',
      info: 'Where the currency is used, and the region the Region filter files it under.',
      render: (r, ctx) => <CountryCell row={r} q={ctx.q} />,
      sortValue: r => r.country, searchText: r => [r.country, r.region ?? ''], filter: 'multiselect', filterValue: r => r.region ?? '',
    },
  ]
}

/* ── Filters modal: Region (every region listed, zero counts included) ────── */

export function RateFiltersModal({ open, onClose, regions, setRegions, countFor, matchCount }: {
  open: boolean
  onClose: () => void
  regions: string[]
  setRegions: (next: string[]) => void
  /** Rates on the open tab in a region. */
  countFor: (region: string) => number
  /** Rates the draft would list. */
  matchCount: (draft: string[]) => number
}) {
  const [draft, setDraft] = useState<string[]>(regions)
  useEffect(() => { if (open) setDraft(regions) }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  const n = matchCount(draft)
  return (
    <FiltersModal
      open={open}
      onClose={onClose}
      activeCount={draft.length ? 1 : 0}
      onClear={() => setDraft([])}
      onApply={() => { setRegions(draft); onClose() }}
      applyLabel={`Show ${fmtNumber(n)} ${n === 1 ? 'Rate' : 'Rates'}`}
    >
      <Section title="Region" desc="Filter by geographic region.">
        <PillSection
          options={REGION_LIST.map(r => ({ value: r, label: r }))}
          selected={draft}
          onToggle={r => setDraft(d => (d.includes(r) ? d.filter(x => x !== r) : [...d, r]))}
          getCount={countFor}
          leading={<AllPill active={!draft.length} onClick={() => setDraft([])} />}
        />
      </Section>
    </FiltersModal>
  )
}
