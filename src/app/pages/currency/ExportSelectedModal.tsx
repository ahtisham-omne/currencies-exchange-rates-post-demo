// Ported from chart-of-accounts-v2.1/src/pages/ExportAccounts.tsx (FORMAT_CARDS, FORMAT_THEMES, FormatCardRow, the scope banner and the footer that names the format); adapted: on the kit's FormModal, format choice only - the library's export columns are fixed - for the bulk bar's "Export selected".
import { useEffect, useState } from 'react'
import { Download, FileType, ListChecks } from 'lucide-react'
import { Button, FormModal } from '../../coa/components/ui'
import type { Currency } from '../../data/currencies'
import { exportCurrencies, FORMAT_LABEL, type ExportFormat } from './exportCurrencies'

const SHARED_BLUE = { border: '#2563EB', cardBg: '#F5FAFF', radio: '#2563EB', button: '#2563EB' }
const FORMAT_THEMES: Record<ExportFormat, { badgeBg: string; badgeText: string; radio: string }> = {
  pdf: { badgeBg: '#EFF6FF', badgeText: '#2563EB', ...SHARED_BLUE },
  xlsx: { badgeBg: '#ECFDF5', badgeText: '#047857', ...SHARED_BLUE },
  csv: { badgeBg: '#FFFBEB', badgeText: '#B45309', ...SHARED_BLUE },
}
const FORMAT_CARDS: { key: ExportFormat; badge: string; title: string; description: string }[] = [
  { key: 'pdf', badge: 'PDF', title: 'PDF Document', description: 'Best for reading and printing. Looks the same on any device, but cannot be edited.' },
  { key: 'xlsx', badge: 'XLS', title: 'Excel Spreadsheet', description: 'Best for working with the data. Opens in Excel or Google Sheets, ready to sort, filter, and total.' },
  { key: 'csv', badge: 'CSV', title: 'CSV File', description: 'Best for moving data between systems. A plain file that opens almost anywhere and keeps the raw values with no formatting.' },
]

function FormatCardRow({ card, isSelected, onSelect }: { card: (typeof FORMAT_CARDS)[number]; isSelected: boolean; onSelect: () => void }) {
  const t = FORMAT_THEMES[card.key]
  const [isHovered, setIsHovered] = useState(false)
  return (
    <button
      type="button"
      onClick={onSelect}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="w-full text-left rounded-[12px] border p-3.5 transition-all duration-150 cursor-pointer"
      style={{
        borderColor: isSelected ? '#0A77FF' : isHovered ? '#CBD5E1' : '#E2E8F0',
        borderWidth: 1,
        backgroundColor: isSelected ? '#F5F9FF' : isHovered ? '#FAFCFF' : '#FFFFFF',
        boxShadow: isSelected
          ? '0 0 0 1px rgba(10,119,255,0.15), 0 1px 3px rgba(10,119,255,0.06)'
          : isHovered
            ? '0 2px 8px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)'
            : '0 1px 2px 0 rgba(15, 23, 42, 0.04), 0 1px 3px 0 rgba(15, 23, 42, 0.06)',
      }}
    >
      <div className="flex items-start justify-between mb-2.5">
        <span className="inline-flex items-center justify-center w-9 h-9 rounded-[8px] text-[10px] tracking-[0.04em]" style={{ backgroundColor: t.badgeBg, color: t.badgeText, fontWeight: 700 }}>
          {card.badge}
        </span>
        <span className="shrink-0 w-4 h-4 rounded-full border-[1.5px] flex items-center justify-center mt-1" style={{ borderColor: isSelected ? t.radio : '#CBD5E1' }}>
          {isSelected && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: t.radio }} />}
        </span>
      </div>
      <div className="text-[13px] leading-[18px]" style={{ fontWeight: 600, color: '#0F172A' }}>{card.title}</div>
      <div className="text-[11.5px] leading-[15px] mt-1" style={{ color: '#64748B', fontWeight: 400 }}>{card.description}</div>
    </button>
  )
}

export function ExportSelectedModal({ open, onClose, rows }: { open: boolean; onClose: () => void; rows: Currency[] }) {
  const [format, setFormat] = useState<ExportFormat>('csv')
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (open) setBusy(false) }, [open])
  const n = rows.length
  const run = async () => {
    setBusy(true)
    await exportCurrencies(rows, format, 'selected')
    setBusy(false)
    onClose()
  }
  return (
    <FormModal
      open={open}
      onClose={onClose}
      hideFullView
      widthClass="max-w-[760px]"
      icon={<Download size={16} />}
      title="Export currencies"
      subtitle="Choose a format. The file holds the currencies you selected, with code, name, ISO numeric code, symbol, decimal places, every country, whether it is the base currency, and status."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button icon={<Download size={14} />} onClick={run} disabled={busy || n === 0}>Export as {FORMAT_LABEL[format]}</Button>
        </>
      }
    >
      <div className="bg-[#FAFBFC] px-5 py-4 space-y-3">
        <div className="rounded-[10px] border px-4 py-2.5 flex items-center gap-2.5" style={{ backgroundColor: '#F1F5F9', borderColor: '#E2E8F0' }}>
          <ListChecks className="w-[18px] h-[18px] shrink-0" style={{ color: '#64748B' }} />
          <div className="flex-1 min-w-0 text-[13px] leading-[20px] truncate" style={{ color: '#1E293B' }}>
            <span style={{ fontWeight: 600 }}>{n.toLocaleString('en-US')} {n === 1 ? 'currency' : 'currencies'}</span>{' '}
            <span style={{ color: '#64748B', fontWeight: 400 }}>(selected)</span>
          </div>
        </div>
        <div className="rounded-[12px] border bg-white overflow-hidden" style={{ borderColor: '#E2E8F0' }}>
          <div className="px-5 pt-3 pb-3 flex items-center gap-2 border-b" style={{ backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }}>
            <FileType className="w-4 h-4 shrink-0" style={{ color: '#64748B' }} />
            <h3 className="text-[14px]" style={{ color: '#0F172A', fontWeight: 600 }}>File Format</h3>
          </div>
          <div className="px-5 pb-4 pt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {FORMAT_CARDS.map(card => (
              <FormatCardRow key={card.key} card={card} isSelected={format === card.key} onSelect={() => setFormat(card.key)} />
            ))}
          </div>
        </div>
      </div>
    </FormModal>
  )
}
