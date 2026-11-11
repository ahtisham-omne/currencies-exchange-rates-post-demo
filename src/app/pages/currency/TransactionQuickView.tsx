// A linked transaction's quick view, on the shell CoA's journal entries open in
// (QuickViewModal): the number as the title, its type and party under it, the
// status and date in the meta row, then what the currency page cares about -
// the amount, the rate it was priced at and what that comes to in the base
// currency - and one way out to the full transaction.
//
// The full transaction belongs to the module that raised it, so "Open Full
// Transaction" leaves for a new tab there, as CoA's linked documents do. Like
// CoA, every transaction lands on one real invoice in Vendor Invoicing: these
// references are seeded here, in the modules' own ID formats.
import { ArrowLeftRight, FileText } from 'lucide-react'
import type { Currency } from '../../data/currencies'
import { corporateRateInEffect } from '../../data/exchangeRates'
import { useExchangeRates } from '../../context/ExchangeRateContext'
import { QuickViewCard, QuickViewFields, QuickViewModal } from '../../coa/components/QuickView'
import { fmtDate, todayIso } from '../../coa/lib/utils'
import { BASE, decimalsOf, fmtPairRate, symbolOf } from '../exchange/rateModel'
import { docStatusTone, docTypeMeta, money, type LinkedDoc } from './model'

/** The one real invoice every transaction opens to, in the Vendor Invoicing module. */
const FULL_TRANSACTION_URL = '/accounting/vendor-invoicing/invoices/INV-000001'

export function TransactionQuickView({ doc, currency: c, onClose }: {
  doc: LinkedDoc
  currency: Currency
  onClose: () => void
}) {
  const { midMarketRates, standardRates } = useExchangeRates()
  const meta = docTypeMeta(doc.type)
  const dp = c.decimalPlaces
  const corporate = c.isBaseCurrency ? undefined : corporateRateInEffect(c.code, standardRates, todayIso())
  const mid = c.isBaseCurrency ? 1 : midMarketRates.find(m => m.sourceCurrency === c.code)?.rate
  // The rate it was priced at: the corporate rate when it used one and one is in effect, else mid-market.
  const usedCorporate = doc.rateType === 'corporate' && !!corporate
  const rate = usedCorporate ? corporate!.standardRate : mid
  const baseValue = rate != null ? doc.amount * rate : null

  const openFull = () => {
    onClose()
    window.open(FULL_TRANSACTION_URL, '_blank', 'noopener,noreferrer')
  }

  return (
    <QuickViewModal
      open
      onClose={onClose}
      icon={<FileText size={17} />}
      id={doc.number}
      title={doc.party}
      meta={{
        status: doc.status ? { label: doc.status, tone: docStatusTone(doc.status) } : undefined,
        facts: [meta.label, fmtDate(doc.date)],
      }}
      openLabel="Open Full Transaction"
      onOpen={openFull}
      widthClass="max-w-[640px]"
    >
      <QuickViewCard title="Transaction Details" icon={FileText}>
        <QuickViewFields fields={[
          { label: 'ID', value: doc.number },
          { label: 'Type', value: meta.label },
          { label: meta.party, value: doc.party },
          { label: 'Status', value: doc.status || 'No Status' },
          { label: 'Date', value: fmtDate(doc.date) },
          { label: 'Amount', value: money(c.symbol, doc.amount, dp) },
        ]} />
      </QuickViewCard>
      {!c.isBaseCurrency && (
        <QuickViewCard title="Exchange Rate" icon={ArrowLeftRight}>
          <QuickViewFields fields={[
            { label: 'Rate Used', value: usedCorporate ? 'Corporate Rate' : 'Mid-Market Rate' },
            { label: 'Exchange Rate', value: rate != null ? fmtPairRate(c.code, rate) : 'Not available' },
            { label: `Value in ${BASE}`, value: baseValue != null ? money(symbolOf(BASE), baseValue, decimalsOf(BASE)) : '–' },
          ]} />
        </QuickViewCard>
      )}
    </QuickViewModal>
  )
}
