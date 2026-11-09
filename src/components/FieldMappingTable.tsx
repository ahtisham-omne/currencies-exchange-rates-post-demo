import React from 'react'
import { Select, Banner } from './ui'
import { cn } from '../lib/utils'
import { MAPPING_COLUMNS, MAPPING_TARGETS } from '../lib/importTemplate'

// Shared field-mapping table for the Upload setup step and the Import modal.
// Each detected column maps onto one of our fields (or is skipped). The header
// copy and surrounding chrome live at the call site; this renders just the
// table, the truncation note, and the "N of M mapped" footer.
export function FieldMappingTable({
  mapping, setMapping, fileName,
}: {
  mapping: Record<string, string>
  setMapping: React.Dispatch<React.SetStateAction<Record<string, string>>>
  fileName?: string | null
}) {
  const columns = MAPPING_COLUMNS
  const mappedCount = columns.filter(c => mapping[c]).length
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-bg-subtle/30 text-fg-muted text-xs border-b border-border">
              <th className="px-3 py-2 text-left font-medium">Your column</th>
              <th className="px-3 py-2 text-left font-medium w-64">Mapped to</th>
            </tr>
          </thead>
          <tbody>
            {columns.map(col => (
              <tr key={col} className="border-b border-border-subtle last:border-0 align-middle">
                <td className="px-3 py-2 font-medium text-fg">{col}</td>
                <td className="px-3 py-2">
                  <div className="max-w-xs">
                    <Select value={mapping[col] ?? ''} onChange={e => setMapping(m => ({ ...m, [col]: e.target.value }))}
                      placeholder="Select a field…"
                      className={cn('input pr-9 appearance-none cursor-pointer', !mapping[col] && 'text-fg-subtle')}>
                      {MAPPING_TARGETS.map(t => <option key={t} value={t}>{t}</option>)}
                      <option value="__skip">Don't import</option>
                    </Select>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {columns.some(c => mapping[c] === 'Description') && (
        <Banner tone="warning">
          One description (Accumulated Depreciation) exceeds the character limit of our Description fields and has been truncated accordingly. You can change this any time afterwards.
        </Banner>
      )}
      <p className="text-2xs text-fg-muted">{mappedCount} of {columns.length} columns mapped{fileName ? ` · ${fileName}` : ''}.</p>
    </div>
  )
}
