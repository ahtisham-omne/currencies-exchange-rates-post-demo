import { useNavigate } from 'react-router-dom'
import { Coins, ArrowLeftRight, Wallet, BookOpen, Book, Receipt, ArrowRight, ExternalLink } from 'lucide-react'
import { useStore } from '../store'
import { cn } from '../lib/utils'

// Accounting & Finance module overview - mirrors the Partners Management
// home page (PartnersHomePage): same container width, page header type
// scale, "Modules" label, and module-card anatomy (32px icon tile, 13px/500
// title, 11px muted description, hover "Open →" affordance).
interface ModuleCard {
  key: string
  title: string
  description: string
  icon: React.ElementType
  iconColor: string
  iconBg: string
  path?: string          // internal route…
  href?: string          // …or external module (opens in a new tab)
  comingSoon?: boolean   // otherwise shows the pill / toast
}

const MODULES: ModuleCard[] = [
  {
    key: 'chart-of-accounts',
    title: 'Chart of Accounts',
    description: 'Define and organize your account structure.',
    icon: BookOpen, iconColor: 'hsl(var(--primary))', iconBg: 'hsl(var(--accent))',
    path: '/chart-of-accounts',
  },
  {
    key: 'general-ledger',
    title: 'General Ledger',
    description: 'View journal entries, postings, and account balances.',
    icon: Book, iconColor: '#4F46E5', iconBg: '#EEF2FF',
    path: '/general-ledger',
  },
  {
    key: 'currency-library',
    title: 'Currency Library',
    description: 'Manage currencies available across the system.',
    icon: Coins, iconColor: '#7C3AED', iconBg: '#F5F3FF',
    href: 'https://cash-management-v2.lovable.app/accounting/currencies',
  },
  {
    key: 'exchange-rates',
    title: 'Exchange Rates',
    description: 'Configure exchange rate types and rates.',
    icon: ArrowLeftRight, iconColor: '#059669', iconBg: '#ECFDF5',
    href: 'https://cash-management-v2.lovable.app/accounting/exchange-rates',
  },
  {
    key: 'cash-management',
    title: 'Cash Management',
    description: 'Bank accounts, feeds, transactions, and reconciliation.',
    icon: Wallet, iconColor: '#0891B2', iconBg: '#ECFEFF',
    href: 'https://cash-management-v2.lovable.app/accounting/cash',
  },
  {
    key: 'tax-setup',
    title: 'Tax Setup',
    description: 'Set up tax codes and rules.',
    icon: Receipt, iconColor: '#EA580C', iconBg: '#FFF7ED',
    comingSoon: true,
  },
]

export default function AccountingOverviewPage() {
  const navigate = useNavigate()
  const pushToast = useStore(s => s.pushToast)
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-4 sm:px-5 lg:px-6 py-3 sm:py-4 w-full max-w-[1120px] mx-auto">
        {/* Page Header */}
        <div className="mb-3 sm:mb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-0.5">
            <h1 className="text-xl sm:text-2xl font-bold">Accounting</h1>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Manage your financial operations, currencies, exchange rates, and chart of accounts.{' '}
            <button className="inline-flex items-center gap-1 text-xs sm:text-sm hover:underline" style={{ color: 'hsl(var(--primary))', fontWeight: 500 }}>
              Learn more
              <ExternalLink className="w-3 h-3" />
            </button>
          </p>
        </div>

        {/* Modules Section */}
        <div className="mb-4 sm:mb-5">
          <h4 className="text-sm text-muted-foreground mb-2 sm:mb-2.5" style={{ fontWeight: 500 }}>
            Modules
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-2.5">
            {MODULES.map(m => {
              const Icon = m.icon
              return (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => {
                    if (m.path) navigate(m.path)
                    else if (m.href) window.open(m.href, '_blank', 'noopener')
                    else pushToast(`${m.title} is coming soon`, 'info')
                  }}
                  className={cn(
                    'group/card relative text-left bg-card border border-border rounded-xl px-3.5 pt-3 pb-3 transition-all duration-200 cursor-pointer',
                    'hover:shadow-md hover:border-primary/20',
                  )}
                >
                  {/* Hover action - top right: "Open →" (Coming Soon pill for unbuilt modules) */}
                  {m.comingSoon ? (
                    <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full text-[11px] bg-amber-50 text-amber-600 border border-amber-200" style={{ fontWeight: 500 }}>
                      Coming Soon
                    </span>
                  ) : (
                    <div className="absolute top-2.5 right-2.5 flex items-center gap-2 opacity-0 group-hover/card:opacity-100 transition-opacity z-10">
                      <span className="inline-flex items-center gap-0.5 text-[11px]" style={{ color: 'hsl(var(--primary))', fontWeight: 500 }}>
                        Open
                        <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                  )}

                  <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-2" style={{ backgroundColor: m.iconBg }}>
                    <Icon className="w-4 h-4" style={{ color: m.iconColor }} />
                  </div>
                  <p className="text-[13px] mb-0.5" style={{ fontWeight: 500 }}>{m.title}</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{m.description}</p>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
