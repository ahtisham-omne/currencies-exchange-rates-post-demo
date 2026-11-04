// Currency & Exchange Rates: one page holding the Currency Library and the
// Exchange Rates, as CoA line tabs under one header (CurrencyExchangeHeader).
// Each tab keeps its own path (/accounting/currencies, /accounting/exchange-rates)
// so links, Back and the detail pages' breadcrumbs land on the right tab; the
// frame stays mounted across the switch, so changing tab doesn't replay the
// page entrance. Each tab's search, filters and sort are remembered for the session.
import { useLocation } from 'react-router-dom'
import { CoaPage } from '../coa/components/CoaPage'
import { CX_PATHS, CX_TITLE, type CxTab } from './CurrencyExchangeHeader'
import { CurrencyLibraryPanel } from './CurrencyListPage'
import { ExchangeRatesPanel } from './ExchangeRateLibraryPage'

export function CurrencyExchangePage() {
  const { pathname } = useLocation()
  const tab: CxTab = pathname.startsWith(CX_PATHS.rates) ? 'rates' : 'currencies'
  return (
    <CoaPage crumbs={[{ label: 'Accounting', to: '/accounting' }, { label: CX_TITLE }]} pageKey="currency-exchange">
      {tab === 'rates' ? <ExchangeRatesPanel /> : <CurrencyLibraryPanel />}
    </CoaPage>
  )
}
