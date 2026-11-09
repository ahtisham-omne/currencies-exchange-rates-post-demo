import { useEffect, useMemo, useState } from 'react'
import { Info, ArrowRight } from 'lucide-react'
import { SlideOver } from './ui'
import { AccountTree, DEFAULT_COLUMNS, useTreeExpansion } from './AccountTable'
import type { Account } from '../types'

// The summary chip that sits atop the wizard's focused right pane: it counts the
// accounts accumulated from prior steps and opens "Your chart so far" - a
// read-only peek at the full working chart - on click or by pressing `?`.
export function AccountChartChip({
  priorCount, accounts,
}: {
  priorCount: number
  accounts: Account[]
}) {
  const [open, setOpen] = useState(false)
  const { expanded, setExpanded, toggle } = useTreeExpansion(accounts)

  const classificationCount = useMemo(
    () => new Set(accounts.map(a => a.statementClassification)).size,
    [accounts],
  )

  // `?` opens the full-chart panel while the wizard is focused.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '?' && !open) {
        const el = document.activeElement
        const typing = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || (el as HTMLElement)?.isContentEditable
        if (typing) return
        e.preventDefault()
        setOpen(true)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  // Reopen the whole chart each time the panel opens. It is a read-only peek, so
  // it should always show everything rather than remember a previous collapse.
  useEffect(() => {
    if (open) setExpanded(new Set(accounts.filter(a => !a.isPosting).map(a => a.id)))
  }, [open, accounts])

  if (priorCount <= 0) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-2 rounded-md border border-border bg-bg-subtle px-3 py-2 text-left hover:border-border-strong transition-colors"
      >
        <Info size={14} className="text-fg-muted shrink-0" />
        <span className="text-sm text-fg flex-1 truncate">
          <span className="font-medium">{priorCount}</span> accounts already in your chart
        </span>
        <span className="inline-flex items-center gap-1 text-sm text-primary shrink-0">View <ArrowRight size={13} /></span>
      </button>

      <SlideOver
        open={open}
        onClose={() => setOpen(false)}
        title="Your chart so far"
        subtitle={`${accounts.length} accounts across ${classificationCount} statement classifications`}
        widthClass="max-w-[582px]"
      >
        <div className="p-2">
          <AccountTree
            accounts={accounts}
            query=""
            density="condensed"
            columns={DEFAULT_COLUMNS}
            onAction={() => {}}
            onOpen={() => {}}
            expanded={expanded}
            onToggle={toggle}
            readOnly
          />
        </div>
      </SlideOver>
    </>
  )
}
