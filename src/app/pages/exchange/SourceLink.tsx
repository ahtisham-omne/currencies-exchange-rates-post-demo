// The rate provider's name as a link to its site, opening in a new tab with the
// external-link mark: the Exchange Rates banner and strip, and the currency
// page's converter, all point to Open Exchange Rates the same way.
import { ExternalLink } from 'lucide-react'
import { API_PROVIDER, API_PROVIDER_URL } from '../../data/exchangeRates'
import { cn } from '../../coa/lib/utils'

export function SourceLink({ className }: { className?: string }) {
  return (
    <a href={API_PROVIDER_URL} target="_blank" rel="noopener noreferrer" className={cn('inline-flex items-center gap-0.5 font-medium hover:opacity-80', className)}>
      {API_PROVIDER}<ExternalLink size={11} aria-hidden />
    </a>
  )
}
