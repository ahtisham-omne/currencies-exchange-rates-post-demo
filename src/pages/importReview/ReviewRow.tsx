import React, { useState, type CSSProperties } from 'react'
import { MoreVertical, AlertTriangle, Copy, RotateCcw, Trash2 } from 'lucide-react'
import { Menu } from '../../components/ui'
import { cn } from '../../lib/utils'
import { SEAM_SHADOW_LEFT } from '../../components/tableColumns'
import {
  ROW_NUM_WIDTH, SELECT_COL_WIDTH, ACTIONS_COL_WIDTH,
  ROW_BG_CLASS, ROW_BG_OPAQUE, isDimensionKey, optionsFor,
  type ColumnKey, type ReviewColumn, type ReviewRowView, type RowTone,
} from './reviewColumns'
import { CellEditor, CellText, EditedCorner, FlagPopover, StatusChip, NeedsDetailsChip, MergedChip, cellRing, flagBg, useFlagPopover, type CellFlag } from './cells'

export interface RowMenuAction { key: 'duplicate' | 'revert' | 'delete'; row: number }

interface ReviewRowProps {
  row: ReviewRowView
  /** Where the row sits in the whole filtered set, so the number survives paging. */
  position: number
  /** In display order, resolved: a dimension column has no entry in any static table. */
  columns: ReviewColumn[]
  widths: Record<string, number>
  rowHeight: number
  query: string
  selected: boolean
  /** The focused / editing column, or null when neither is on this row. */
  activeKey: ColumnKey | null
  editingKey: ColumnKey | null
  /** Cells changed since the file was read, with what they said before. */
  edited: Map<ColumnKey, string>
  zebra: boolean
  seam: boolean
  parentCandidates: { number: string; name: string }[]
  onSelect: (row: number) => void
  onFocusCell: (row: number, key: ColumnKey) => void
  onEditCell: (row: number, key: ColumnKey) => void
  onCommit: (row: number, key: ColumnKey, value: string, move: 'down' | 'right' | 'left' | 'none') => void
  onCancelEdit: () => void
  onRowAction: (action: RowMenuAction) => void
  onContextMenu: (row: number, x: number, y: number) => void
}

function ReviewRowInner({
  row, position, columns, widths, rowHeight, query, selected, activeKey, editingKey, edited,
  zebra, seam, parentCandidates, onSelect, onFocusCell, onEditCell, onCommit, onCancelEdit, onRowAction, onContextMenu,
}: ReviewRowProps) {
  const [hover, setHover] = useState(false)
  const isError = row.verdict === 'error'
  const flagTone: CellFlag['tone'] = isError ? 'error' : 'warning'

  // Strongest state wins, so the row a user is working in never disappears
  // under a zebra stripe or a selection tint.
  const tone: RowTone = activeKey ? 'active' : hover ? 'hover' : selected ? 'selected' : zebra ? 'zebra' : 'plain'
  const rowBg = ROW_BG_CLASS[tone]

  // Frozen cells fill from the opaque map; see ROW_BG_OPAQUE for why they cannot
  // use the class the scrolling cells do.
  const pin = (left: number, z = 10): CSSProperties =>
    ({ position: 'sticky', left, zIndex: z, backgroundColor: ROW_BG_OPAQUE[tone] })
  const cellCls = 'px-3 align-middle border-b border-border-subtle border-r border-r-border-subtle last:border-r-0'

  return (
    <tr
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onContextMenu={e => { e.preventDefault(); onContextMenu(row.row, e.clientX, e.clientY) }}
      className="group"
    >
      <td className={cn(cellCls, 'text-center')} style={{ ...pin(0), height: rowHeight }}>
        <span className={cn('text-xs tabular-nums', activeKey ? 'text-primary font-semibold' : isError ? 'text-danger-600 font-medium' : 'text-fg-subtle')}>
          {position}
        </span>
      </td>
      <td className={cn(cellCls, 'text-center')} style={{ ...pin(ROW_NUM_WIDTH), height: rowHeight }}>
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onSelect(row.row)}
          aria-label={`Select row ${position}`}
          className="h-3.5 w-3.5 rounded border-border accent-primary cursor-pointer"
        />
      </td>
      <td className={cn(cellCls)} style={{ ...pin(ROW_NUM_WIDTH + SELECT_COL_WIDTH), height: rowHeight, boxShadow: seam ? SEAM_SHADOW_LEFT : undefined }}>
        <div className="flex items-center gap-1.5">
          <StatusChip status={row.verdict} query={query} />
          {row.mergedFrom && <MergedChip from={row.mergedFrom} query={query} />}
          {row.needsDetails && !isError && <NeedsDetailsChip query={query} />}
          {isError && <AlertTriangle size={13} className="shrink-0 text-danger-600" />}
        </div>
      </td>

      {columns.map(col => {
        const key = col.key
        const value = String(row[key] ?? '')
        const flag = row.flagged.has(key) ? { tone: flagTone, message: row.message } : undefined
        // A read-only column can be focused and arrowed through, so it is not a
        // hole in the grid, but Enter on it opens nothing.
        const isEditing = editingKey === key && !col.readOnly
        const isActive = activeKey === key
        const originalValue = edited.get(key)
        return (
          <ReviewCell
            key={key}
            col={col}
            value={value}
            width={widths[key] ?? col.defaultWidth}
            rowHeight={rowHeight}
            rowBg={rowBg}
            query={query}
            flag={flag}
            editing={isEditing}
            active={isActive}
            originalValue={originalValue}
            parentCandidates={parentCandidates}
            options={optionsFor(col, row)}
            onFocus={() => onFocusCell(row.row, key)}
            onEdit={() => onEditCell(row.row, key)}
            onCommit={(v, move) => onCommit(row.row, key, v, move)}
            onCancel={onCancelEdit}
          />
        )
      })}

      <td
        className={cn(cellCls, 'text-center')}
        style={{ position: 'sticky', right: 0, zIndex: 10, width: ACTIONS_COL_WIDTH, height: rowHeight, backgroundColor: ROW_BG_OPAQUE[tone], boxShadow: 'inset 1px 0 0 hsl(var(--border))' }}
      >
        <Menu align="right" trigger={
          <button
            aria-label={`Actions for row ${position}`}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-fg-subtle opacity-0 transition-opacity hover:bg-bg-subtle hover:text-fg group-hover:opacity-100 focus:opacity-100"
          >
            <MoreVertical size={14} />
          </button>
        }>
          {close => (
            <div className="w-44 p-1 -my-1">
              <RowMenuItem icon={Copy} label="Duplicate row" onClick={() => { onRowAction({ key: 'duplicate', row: row.row }); close() }} />
              {edited.size > 0 && (
                <RowMenuItem icon={RotateCcw} label="Revert changes" onClick={() => { onRowAction({ key: 'revert', row: row.row }); close() }} />
              )}
              <div className="my-1 h-px bg-border" />
              <RowMenuItem icon={Trash2} label="Delete row" danger onClick={() => { onRowAction({ key: 'delete', row: row.row }); close() }} />
            </div>
          )}
        </Menu>
      </td>
    </tr>
  )
}

function ReviewCell({ col, value, width, rowHeight, rowBg, query, flag, editing, active, originalValue, parentCandidates, options, onFocus, onEdit, onCommit, onCancel }: {
  col: ReviewColumn
  value: string
  width: number
  rowHeight: number
  rowBg: string
  query: string
  flag?: CellFlag
  editing: boolean
  active: boolean
  originalValue?: string
  parentCandidates: { number: string; name: string }[]
  /* Resolved against this row rather than read off the column, because the
     roles on offer depend on the category the row states. */
  options?: string[]
  onFocus: () => void
  onEdit: () => void
  onCommit: (v: string, move: 'down' | 'right' | 'left' | 'none') => void
  onCancel: () => void
}) {
  const { ref, rect, onEnter, onLeave } = useFlagPopover(!!flag && !editing)
  return (
    <td
      ref={ref}
      data-cell-key={col.key}
      /* The walkthrough spotlights a whole dimension column, which is no single
         element, so every cell in it wears the key and the overlay unions them. */
      data-walkthrough={isDimensionKey(col.key) ? 'review-dimensions' : undefined}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onClick={() => { onFocus(); if (!editing && !col.readOnly) onEdit() }}
      className={cn(
        'relative align-middle border-b border-border-subtle border-r border-r-border-subtle overflow-hidden whitespace-nowrap',
        editing ? 'bg-white' : cn(rowBg, flagBg(flag)),
        cellRing({ editing, active, flag }),
        editing ? 'cursor-text' : col.readOnly ? 'cursor-default' : 'cursor-cell',
        !editing && 'px-3',
      )}
      style={{ width, height: rowHeight, fontSize: 13 }}
    >
      {editing
        ? <CellEditor column={col} value={value} options={options} candidates={parentCandidates} onCommit={onCommit} onCancel={onCancel} />
        : <CellText value={value} query={query} mono={col.mono} muted={col.key === 'description'} />}
      {originalValue !== undefined && !editing && <EditedCorner original={originalValue} />}
      {rect && flag && <FlagPopover rect={rect} flag={flag} example={value || undefined} options={options} />}
    </td>
  )
}

function RowMenuItem({ icon: Icon, label, onClick, danger }: {
  icon: typeof Copy; label: string; onClick: () => void; danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={cn('flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors hover:bg-bg-subtle',
        danger ? 'text-danger-600' : 'text-fg')}
    >
      <Icon size={14} className="shrink-0" />
      {label}
    </button>
  )
}

/* Memoised on purpose: an arrow-key move changes one cell's focus, and without
   this every row in the grid re-renders, which a few hundred rows in is felt. */
export const ReviewRow = React.memo(ReviewRowInner)
