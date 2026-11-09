// Ported from chart-of-accounts-v2.1/src/components/InternalIdField.tsx; adapted: label constant inlined, toast from the kit store.
import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { Tooltip } from './ui'
import { DashInfoLabel } from './DashInfoCard'
import { pushToast } from '../lib/toast'
const INTERNAL_ID_LABEL = 'Internal ID'

/* The system's ID for a record, in a detail page's rail: stated, never typed,
   and copyable, since the reason to read it is to quote it somewhere else.
   Shared by the account page and the journal entry page, which name the same
   kind of fact the same way. */
export function InternalIdField({ id, help, label = INTERNAL_ID_LABEL }: { id: string | undefined; help: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    if (!id) return
    try {
      await navigator.clipboard.writeText(id)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      pushToast('Could not copy the internal ID', 'danger', id)
    }
  }
  return (
    <div className="min-w-0">
      <DashInfoLabel tooltip={help}>{label}</DashInfoLabel>
      <div className="flex items-center gap-1 mt-0.5 min-w-0">
        <span className="text-[12px] text-slate-700 tabular-nums truncate" style={{ fontWeight: 500 }}>{id || '–'}</span>
        {id && (
          <Tooltip content={copied ? 'Copied' : `Copy ${label.toLowerCase()}`}>
            <button
              type="button"
              onClick={copy}
              aria-label={`Copy ${label.toLowerCase()}`}
              className="inline-flex items-center justify-center w-5 h-5 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors shrink-0"
            >
              {copied ? <Check size={11} /> : <Copy size={11} />}
            </button>
          </Tooltip>
        )}
      </div>
    </div>
  )
}
