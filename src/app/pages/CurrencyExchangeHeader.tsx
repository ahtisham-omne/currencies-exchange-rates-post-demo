// The Currency & Exchange Rates page's header: one title over CoA line tabs
// (Currency Library | Exchange Rates). Drawn by whichever tab is open so it can
// supply its own actions; see CurrencyExchangePage.
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Coins } from 'lucide-react'
import { PageHeader } from '../coa/components/PageHeader'

export const CX_TITLE = 'Currency & Exchange Rates'
export const CX_PATHS = { currencies: '/accounting/currencies', rates: '/accounting/exchange-rates' } as const
export type CxTab = keyof typeof CX_PATHS

const CX_TABS = [
  { id: 'currencies', label: 'Currency Library' },
  { id: 'rates', label: 'Exchange Rates' },
]

export function CurrencyExchangeHeader({ tab, secondaryActions, primaryAction }: {
  tab: CxTab
  secondaryActions?: ReactNode
  primaryAction?: ReactNode
}) {
  const navigate = useNavigate()
  return (
    <PageHeader
      icon={<Coins size={16} />}
      title={CX_TITLE}
      subtitle="Manage the currencies available across your system and the exchange rates used to convert between them."
      tabs={CX_TABS}
      activeTab={tab}
      onTabChange={id => navigate(CX_PATHS[id as CxTab])}
      secondaryActions={secondaryActions}
      primaryAction={primaryAction}
    />
  )
}
