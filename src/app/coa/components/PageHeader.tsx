// Ported from chart-of-accounts-v2.1/src/components/PageHeader.tsx; adapted: page tabs may carry a count badge (the detail header card's recipe), for a list page with two tabs.
import { ReactNode } from 'react'
import { ChevronLeft } from 'lucide-react'
import { cn } from '../lib/utils'

export interface PageTab {
  id: string
  label: string
  /** A count badge, as the detail header card draws one (0 is hidden). */
  count?: number
}

export function PageHeader({
  icon, title, subtitle, primaryAction, secondaryActions, noBorder, onBack, backTitle,
  tabs, activeTab, onTabChange,
}: {
  icon?: ReactNode
  title: string
  subtitle?: string
  primaryAction?: ReactNode
  secondaryActions?: ReactNode
  /* Way out for a page reached from another page rather than from the sidebar.
     It leads the title instead of sitting with the actions on the right, because
     it is not something you do to the page - it is how you leave it, and the
     reader looks for that where the breadcrumb above it points. Same control as
     the detail header card's, at the icon tile's size. */
  onBack?: () => void
  backTitle?: string
  // Omit the bottom border when the header sits in a shared white block with a
  // stepper beneath it (the stepper provides the dividing line).
  noBorder?: boolean
  // Optional page-level tabs, for a page that holds more than one table of the
  // same subject. Same underline strip as the detail-page header card, so a tab
  // reads identically wherever it appears.
  tabs?: PageTab[]
  activeTab?: string
  onTabChange?: (id: string) => void
}) {
  const hasTabs = !!tabs?.length
  return (
    <div className={cn('bg-white', !noBorder && 'border-b border-border')}>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 px-6 lg:px-8 py-3.5">
        <div className="flex items-start gap-3 min-w-0">
          {onBack && (
            <button
              onClick={onBack}
              aria-label={backTitle ?? 'Back'}
              title={backTitle ?? 'Back'}
              className="w-8 h-8 rounded-lg border border-border bg-white flex items-center justify-center shrink-0 cursor-pointer text-fg-subtle hover:bg-bg-subtle hover:text-fg transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
          )}
          {icon && (
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: 'hsl(var(--accent))', color: 'hsl(var(--primary))' }}
            >
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-[20px] font-bold tracking-tight text-fg leading-tight">{title}</h1>
            {subtitle && <p className="text-sm text-fg-muted mt-0.5">{subtitle}</p>}
          </div>
        </div>
        <div className="flex items-start gap-2 shrink-0">
          {secondaryActions}
          {primaryAction}
        </div>
      </div>
      {hasTabs && (
        <div className="flex items-center gap-0 overflow-x-auto scrollbar-hide px-6 lg:px-8">
          {tabs!.map(tab => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange?.(tab.id)}
                className={cn(
                  'flex items-center gap-1.5 border-b-2 transition-all duration-200 whitespace-nowrap cursor-pointer',
                  isActive ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300',
                )}
                style={{ padding: '10px 14px', fontSize: 13, fontWeight: isActive ? 600 : 400 }}
              >
                {tab.label}
                {!!tab.count && (
                  <span className={cn('inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-10', isActive ? 'bg-accent text-primary' : 'bg-bg-muted text-slate-500')} style={{ fontWeight: 600 }}>
                    {tab.count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
