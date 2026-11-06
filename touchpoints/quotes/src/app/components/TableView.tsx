import { useState, useRef, useEffect } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, MoreHorizontal, GripVertical, AlertTriangle, Eye, Copy, Archive, Ban, Printer, FileDown } from 'lucide-react';
import { Quote, ColumnConfig } from '@/app/types/quote';
import { SortConfig } from '@/app/utils/quoteUtils';
import { formatCurrency, formatDate, isExpiringSoon, isExpired } from '@/app/utils/quoteUtils';
import { StatusBadge } from '@/app/components/StatusBadge';
import { PriorityBadge } from '@/app/components/PriorityBadge';
import { VersionHistoryModal } from '@/app/components/VersionHistoryModal';
import { VersionBadge } from '@/app/components/VersionBadge';
import { BulkActionsToolbar } from '@/app/components/BulkActionsToolbar';
import { HighlightText } from '@/app/components/HighlightText';
import { toast } from 'sonner';
import { DuplicateQuoteModal } from '@/app/components/quote-details/DuplicateQuoteModal';
import { PocCellRich, CustomerCellRich, SalesRepCellRich, DeliveryLocationCell } from '@/app/components/shared/ListingCells';

interface TableViewProps {
  quotes: Quote[];
  columns: ColumnConfig[];
  selectedQuotes: Set<string>;
  onSelectQuote: (quoteId: string) => void;
  onSelectAll: (selected: boolean) => void;
  sortConfig: SortConfig | null;
  onSort: (key: string) => void;
  viewDensity: 'comfortable' | 'compact';
  onColumnsReorder: (columns: ColumnConfig[]) => void;
  onColumnResize: (key: string, width: number) => void;
  onQuoteClick: (quoteId: string) => void;
  onBulkArchive: () => void;
  onBulkAssignRep: () => void;
  onBulkExportCSV: () => void;
  onBulkPrint: () => void;
  onClearSelection: () => void;
  searchTerm: string;
}

const FROZEN_KEYS = new Set(['quoteNumber', 'customer', 'status']);
const CHECKBOX_COL_WIDTH = 40;

export function TableView({
  quotes, columns, selectedQuotes, onSelectQuote, onSelectAll, sortConfig, onSort,
  viewDensity, onColumnsReorder, onColumnResize, onQuoteClick,
  onBulkArchive, onBulkAssignRep, onBulkExportCSV, onBulkPrint, onClearSelection, searchTerm,
}: TableViewProps) {
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [versionHistoryQuote, setVersionHistoryQuote] = useState<{ id: string; version: number } | null>(null);
  const [duplicateQuoteId, setDuplicateQuoteId] = useState<string | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const actionRef = useRef<HTMLDivElement>(null);
  const isDraggingScroll = useRef(false);
  const dragStartX = useRef(0);
  const scrollStartX = useRef(0);

  const isCondensed = viewDensity === 'compact';
  const rowH = isCondensed ? 'py-1 px-2' : 'py-2 px-2';

  const handleScrollMouseDown = (e: React.MouseEvent) => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const target = e.target as HTMLElement;
    if (target.closest('button, input, a, [data-menu]')) return;
    if (container.scrollWidth <= container.clientWidth) return;
    isDraggingScroll.current = true;
    dragStartX.current = e.clientX;
    scrollStartX.current = container.scrollLeft;
    container.style.cursor = 'grabbing';
    container.style.userSelect = 'none';
    e.preventDefault();
  };

  useEffect(() => {
    const handleScrollMouseMove = (e: MouseEvent) => {
      if (!isDraggingScroll.current || !scrollContainerRef.current) return;
      scrollContainerRef.current.scrollLeft = scrollStartX.current - (e.clientX - dragStartX.current);
    };
    const handleScrollMouseUp = () => {
      if (!isDraggingScroll.current) return;
      isDraggingScroll.current = false;
      if (scrollContainerRef.current) {
        scrollContainerRef.current.style.cursor = '';
        scrollContainerRef.current.style.userSelect = '';
      }
    };
    document.addEventListener('mousemove', handleScrollMouseMove);
    document.addEventListener('mouseup', handleScrollMouseUp);
    return () => { document.removeEventListener('mousemove', handleScrollMouseMove); document.removeEventListener('mouseup', handleScrollMouseUp); };
  }, []);

  const allSelected = quotes.length > 0 && quotes.every(q => selectedQuotes.has(q.id));
  const someSelected = quotes.some(q => selectedQuotes.has(q.id)) && !allSelected;
  const visibleColumns = columns.filter(col => col.visible);
  const frozenCols = visibleColumns.filter(c => FROZEN_KEYS.has(c.key));
  const scrollCols = visibleColumns.filter(c => !FROZEN_KEYS.has(c.key));
  const actionsW = 60;

  const handleSelectAll = () => onSelectAll(!allSelected);

  // Compute frozen offsets
  const frozenOffsets: Record<string, number> = {};
  let runningLeft = CHECKBOX_COL_WIDTH;
  for (const fc of frozenCols) {
    frozenOffsets[fc.key] = runningLeft;
    runningLeft += fc.width;
  }
  const lastFrozenKey = frozenCols.length > 0 ? frozenCols[frozenCols.length - 1].key : null;

  const handleColumnDragStart = (e: React.DragEvent, columnKey: string) => {
    setDraggedColumn(columnKey);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', '');
  };
  const handleColumnDragOver = (e: React.DragEvent, columnKey: string) => {
    e.preventDefault();
    if (draggedColumn && draggedColumn !== columnKey) setDragOverColumn(columnKey);
  };
  const handleColumnDrop = (e: React.DragEvent, targetKey: string) => {
    e.preventDefault();
    if (!draggedColumn || draggedColumn === targetKey) return;
    const di = columns.findIndex(c => c.key === draggedColumn);
    const ti = columns.findIndex(c => c.key === targetKey);
    if (di === -1 || ti === -1) return;
    const nc = [...columns];
    const [removed] = nc.splice(di, 1);
    nc.splice(ti, 0, removed);
    onColumnsReorder(nc);
    setDraggedColumn(null);
    setDragOverColumn(null);
  };
  const handleResizeStart = (e: React.MouseEvent, columnKey: string) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const column = columns.find(c => c.key === columnKey);
    if (!column) return;
    const startWidth = column.width;
    const handleMouseMove = (e: MouseEvent) => {
      onColumnResize(columnKey, Math.max(80, Math.min(400, startWidth + e.clientX - startX)));
    };
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (activeMenu && !(e.target as Element).closest('[data-menu]')) setActiveMenu(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeMenu]);

  const getContactColor = (name: string) => {
    const themes = [
      { bg: '#DBEAFE', text: '#1E40AF' }, { bg: 'hsl(var(--destructive) / 0.1)', text: 'hsl(var(--destructive))' },
      { bg: '#FEF3C7', text: '#92400E' }, { bg: '#D1FAE5', text: '#065F46' },
      { bg: '#E9D5FF', text: 'hsl(var(--primary))' }, { bg: '#FECACA', text: '#991B1B' },
      { bg: '#BAE6FD', text: '#075985' }, { bg: '#FED7AA', text: '#9A3412' },
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return themes[Math.abs(hash) % themes.length];
  };

  const renderCellContent = (quote: Quote, column: ColumnConfig) => {
    switch (column.key) {
      case 'quoteNumber':
        return (
          <div className="flex items-center" style={{ gap: 8 }}>
            <div
              onMouseEnter={() => setHoveredRow(quote.id)}
              onMouseLeave={() => setHoveredRow(null)}
            >
              <VersionBadge
                version={quote.version}
                compact
                showExpandIcon={hoveredRow === quote.id}
                onClick={(e) => { e.stopPropagation(); setVersionHistoryQuote({ id: quote.quoteNumber, version: quote.version }); }}
              />
            </div>
            <span
              className="text-foreground hover:text-primary hover:underline cursor-pointer whitespace-nowrap text-[13px]"
              style={{ fontWeight: 500 }}
              onClick={(e) => { e.stopPropagation(); onQuoteClick(quote.id); }}
            >
              <HighlightText text={quote.quoteNumber} searchTerm={searchTerm} className="text-[13px]" />
            </span>
          </div>
        );

      case 'customer':
        return (
          <CustomerCellRich
            customer={quote.customer}
            density={isCondensed ? 'compact' : 'comfortable'}
          />
        );

      case 'primaryPoC':
        return (
          <PocCellRich
            primary={quote.primaryPoC}
            additional={quote.additionalPoCs}
            density={isCondensed ? 'compact' : 'comfortable'}
          />
        );

      case 'status':
        return <StatusBadge status={quote.status} />;

      case 'totalValue':
        return (
          <div className="text-right">
            <span className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>{formatCurrency(quote.totalValue)}</span>
          </div>
        );

      case 'createdDate':
        return <span className="text-[13px] text-muted-foreground">{formatDate(quote.createdDate)}</span>;

      case 'requestedDate':
        return <span className="text-[13px] text-muted-foreground">{quote.requestedDate ? formatDate(quote.requestedDate) : '—'}</span>;

      case 'respondBy': {
        const overdue = quote.respondBy && new Date() > quote.respondBy;
        return (
          <div className="flex items-center gap-1">
            {overdue && <AlertTriangle className="w-3 h-3 text-destructive shrink-0" />}
            <span className={`text-[13px] ${overdue ? 'text-destructive font-semibold' : 'text-muted-foreground'}`}>
              {quote.respondBy ? formatDate(quote.respondBy) : '—'}
            </span>
          </div>
        );
      }

      case 'confirmationDate':
        return <span className="text-[13px] text-muted-foreground">{quote.confirmationDate ? formatDate(quote.confirmationDate) : '—'}</span>;

      case 'expiryDate': {
        const expired = isExpired(quote.expiryDate);
        const expiringSoon = isExpiringSoon(quote.expiryDate);
        return (
          <div className="flex items-center gap-1">
            {(expired || expiringSoon) && <AlertTriangle className={`w-3 h-3 shrink-0 ${expired ? 'text-destructive' : 'text-yellow-600'}`} />}
            <span className={`text-[13px] ${expired ? 'text-destructive font-semibold' : expiringSoon ? 'text-yellow-600 font-semibold' : 'text-muted-foreground'}`}>
              {formatDate(quote.expiryDate)}
            </span>
          </div>
        );
      }

      case 'salesRep':
        return (
          <SalesRepCellRich
            rep={quote.salesRep}
            additional={quote.additionalSalesReps ?? []}
            density={isCondensed ? 'compact' : 'comfortable'}
          />
        );

      case 'priority':
        return <PriorityBadge priority={quote.priority} />;

      case 'deliveryLocation':
        return (
          <DeliveryLocationCell
            locationName={quote.customer.location?.name || ''}
            density={isCondensed ? 'compact' : 'comfortable'}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="contents">
      <div className="relative flex-1 overflow-hidden bg-card">
        {selectedQuotes.size > 0 && (
          <div className="absolute top-2 left-4 z-50">
            <BulkActionsToolbar
              selectedCount={selectedQuotes.size}
              onArchive={onBulkArchive}
              onAssignRep={onBulkAssignRep}
              onExportCSV={onBulkExportCSV}
              onPrint={onBulkPrint}
              onClearSelection={onClearSelection}
            />
          </div>
        )}

        <div
          className="flex-1 min-h-0 overflow-auto h-full"
          ref={scrollContainerRef}
          onMouseDown={handleScrollMouseDown}
        >
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-20 bg-card">
              <tr className={`bg-muted/30 hover:bg-muted/30 border-b border-border ${isCondensed ? '[&>th]:h-8' : '[&>th]:h-11'}`}>
                {/* Checkbox header */}
                <th className="sticky left-0 z-20 bg-[hsl(var(--muted))] text-left whitespace-nowrap !pl-2 !pr-0" style={{ width: CHECKBOX_COL_WIDTH, minWidth: CHECKBOX_COL_WIDTH, maxWidth: CHECKBOX_COL_WIDTH }}>
                  <input
                    type="checkbox"
                    className="w-3.5 h-3.5 rounded accent-primary cursor-pointer"
                    checked={allSelected}
                    ref={input => { if (input) input.indeterminate = someSelected; }}
                    onChange={handleSelectAll}
                    aria-label="Select all quotes"
                  />
                </th>

                {/* Frozen column headers */}
                {frozenCols.map(column => (
                  <th
                    key={column.key}
                    className="sticky bg-[hsl(var(--muted))] z-20 whitespace-nowrap relative group/colheader cursor-grab"
                    style={{
                      width: `${column.width}px`,
                      overflow: 'hidden',
                      left: `${frozenOffsets[column.key] ?? 0}px`,
                      ...(column.key === lastFrozenKey ? { boxShadow: 'inset -1px 0 0 0 rgba(0,0,0,0.08), 3px 0 6px -2px rgba(0,0,0,0.06)' } : {}),
                    }}
                    draggable
                    onDragStart={(e) => handleColumnDragStart(e, column.key)}
                    onDragOver={(e) => handleColumnDragOver(e, column.key)}
                    onDrop={(e) => handleColumnDrop(e, column.key)}
                    onDragEnd={() => { setDraggedColumn(null); setDragOverColumn(null); }}
                  >
                    {renderHeaderContent(column)}
                    <div
                      className="absolute right-0 top-1 bottom-1 w-[2px] rounded-full transition-colors bg-transparent group-hover/colheader:bg-primary/40 cursor-col-resize z-10"
                      onMouseDown={(e) => { e.stopPropagation(); handleResizeStart(e, column.key); }}
                    />
                  </th>
                ))}

                {/* Scrollable column headers */}
                {scrollCols.map(column => (
                  <th
                    key={column.key}
                    className={`whitespace-nowrap relative group/colheader cursor-grab ${column.alignment === 'right' ? 'text-right' : ''}`}
                    style={{
                      width: `${column.width}px`,
                      overflow: 'hidden',
                    }}
                    draggable
                    onDragStart={(e) => handleColumnDragStart(e, column.key)}
                    onDragOver={(e) => handleColumnDragOver(e, column.key)}
                    onDrop={(e) => handleColumnDrop(e, column.key)}
                    onDragEnd={() => { setDraggedColumn(null); setDragOverColumn(null); }}
                  >
                    {renderHeaderContent(column)}
                    <div
                      className="absolute right-0 top-1 bottom-1 w-[2px] rounded-full transition-colors bg-transparent group-hover/colheader:bg-primary/40 cursor-col-resize z-10"
                      onMouseDown={(e) => { e.stopPropagation(); handleResizeStart(e, column.key); }}
                    />
                  </th>
                ))}

                {/* Actions header */}
                <th className="sticky right-0 bg-[hsl(var(--muted))] z-20 whitespace-nowrap !pl-2 !pr-2" style={{ width: actionsW, boxShadow: 'inset 1px 0 0 0 rgba(0,0,0,0.08)' }}>
                  <span className="text-[13px]">Actions</span>
                </th>
              </tr>
            </thead>

            <tbody>
              {quotes.map(quote => {
                const isSelected = selectedQuotes.has(quote.id);
                const isHovered = hoveredRow === quote.id;

                return (
                  <tr
                    key={quote.id}
                    className={`border-b border-border/50 transition-colors group ${isSelected ? 'pointer-events-auto' : 'hover:bg-[#F0F7FF] cursor-pointer'}`}
                    style={isSelected ? { backgroundColor: '#EFF6FF', cursor: 'default' } : undefined}
                    onMouseEnter={() => setHoveredRow(quote.id)}
                    onMouseLeave={() => setHoveredRow(null)}
                    onClick={() => { if (!isSelected) onQuoteClick(quote.id); }}
                  >
                    {/* Checkbox */}
                    <td
                      className={`sticky left-0 group-hover:bg-[#F0F7FF] transition-colors ${isSelected ? 'bg-[#EFF6FF]' : 'bg-card'} ${rowH} !pl-2 !pr-0 z-[2]`}
                      style={{ width: CHECKBOX_COL_WIDTH }}
                      onClick={e => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        className="w-3.5 h-3.5 rounded accent-primary cursor-pointer"
                        checked={isSelected}
                        onChange={() => onSelectQuote(quote.id)}
                        aria-label={`Select quote ${quote.quoteNumber}`}
                      />
                    </td>

                    {/* Frozen cells */}
                    {frozenCols.map(column => (
                      <td
                        key={column.key}
                        className={`sticky group-hover:bg-[#F0F7FF] transition-colors ${isSelected ? 'bg-[#EFF6FF]' : 'bg-card'} ${rowH} pl-4 pr-2 z-[2]`}
                        style={{
                          left: frozenOffsets[column.key] ?? CHECKBOX_COL_WIDTH,
                          width: `${column.width}px`,
                          ...(column.key === lastFrozenKey ? { boxShadow: 'inset -1px 0 0 0 rgba(0,0,0,0.08), 3px 0 6px -2px rgba(0,0,0,0.06)' } : {}),
                        }}
                      >
                        {renderCellContent(quote, column)}
                      </td>
                    ))}

                    {/* Scrollable cells */}
                    {scrollCols.map(column => (
                      <td
                        key={column.key}
                        className={`${rowH} pl-4 pr-2 ${column.alignment === 'right' ? 'text-right' : ''}`}
                        style={{ width: `${column.width}px` }}
                      >
                        {renderCellContent(quote, column)}
                      </td>
                    ))}

                    {/* Actions */}
                    <td
                      className={`sticky right-0 group-hover:bg-[#F0F7FF] transition-colors ${isSelected ? 'bg-[#EFF6FF]' : 'bg-card'} ${rowH} z-[2] !pl-2 !pr-2`}
                      style={{ width: actionsW, boxShadow: 'inset 1px 0 0 0 rgba(0,0,0,0.08)' }}
                      onClick={e => e.stopPropagation()}
                    >
                      <div className="relative flex items-center justify-center" ref={activeMenu === quote.id ? actionRef : undefined}>
                        <button
                          onClick={() => setActiveMenu(activeMenu === quote.id ? null : quote.id)}
                          data-menu
                          className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-muted border border-transparent hover:border-border transition-colors text-muted-foreground/60 hover:text-foreground/80"
                          aria-label="Quote actions"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                        {activeMenu === quote.id && (
                          <div
                            data-menu
                            className="absolute right-0 bottom-full bg-popover border border-border/80 rounded-lg z-[200]"
                            style={{ marginBottom: 4, minWidth: 190, padding: '4px 0', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}
                          >
                            <button onClick={() => { onQuoteClick(quote.id); setActiveMenu(null); }} className="w-full text-left flex items-center gap-2 text-foreground/80 hover:bg-muted/60 transition-colors text-[13px] px-3 py-[6px]">
                              <Eye className="w-3.5 h-3.5" /> View Details
                            </button>
                            <div className="border-t border-border/60 my-1" />
                            <button onClick={() => { setDuplicateQuoteId(quote.id); setActiveMenu(null); }} className="w-full text-left flex items-center gap-2 text-foreground/80 hover:bg-muted/60 transition-colors text-[13px] px-3 py-[6px]">
                              <Copy className="w-3.5 h-3.5" /> Duplicate Quote
                            </button>
                            <button onClick={() => { toast.success('Quote archived'); setActiveMenu(null); }} className="w-full text-left flex items-center gap-2 text-foreground/80 hover:bg-muted/60 transition-colors text-[13px] px-3 py-[6px]">
                              <Archive className="w-3.5 h-3.5" /> Archive
                            </button>
                            <div className="border-t border-border/60 my-1" />
                            <button onClick={() => { toast.success('Quote cancelled'); setActiveMenu(null); }} className="w-full text-left flex items-center gap-2 text-destructive hover:bg-destructive/5 transition-colors text-[13px] px-3 py-[6px]" style={{ fontWeight: 500 }}>
                              <Ban className="w-3.5 h-3.5" /> Cancel Quote
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {quotes.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 px-5">
              <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-muted-foreground/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="text-base text-foreground mb-1" style={{ fontWeight: 600 }}>No quotes found</div>
              <div className="text-[13px] text-muted-foreground">Try adjusting your filters or search query</div>
            </div>
          )}
        </div>
      </div>

      {versionHistoryQuote && (
        <VersionHistoryModal
          quoteId={versionHistoryQuote.id}
          currentVersion={versionHistoryQuote.version}
          onClose={() => setVersionHistoryQuote(null)}
        />
      )}

      {duplicateQuoteId && (() => {
        const quote = quotes.find(q => q.id === duplicateQuoteId);
        return (
          <DuplicateQuoteModal
            isOpen={true}
            onClose={() => { setDuplicateQuoteId(null); setActiveMenu(null); }}
            onConfirm={({ customerName }) => {
              setDuplicateQuoteId(null);
              setActiveMenu(null);
              toast.success(`Quote duplicated for ${customerName}`, { description: 'New draft quote created successfully.' });
            }}
            currentCustomer={quote?.customer.name || ''}
            quoteNumber={quote?.quoteNumber}
            availableVersions={quote?.versions}
            currentVersion={quote?.version}
          />
        );
      })()}
    </div>
  );

  function renderHeaderContent(column: ColumnConfig) {
    const currentColSort = sortConfig?.key === column.key ? sortConfig.direction : null;
    return (
      <div className={`flex items-center pl-4 pr-2 ${column.alignment === 'right' ? 'w-full justify-end' : ''}`}>
        <GripVertical className="w-3 h-3 transition-opacity pointer-events-none opacity-0 group-hover/colheader:opacity-100 text-muted-foreground/40 mr-1 shrink-0" />
        {column.sortable ? (
          <button
            onClick={() => onSort(column.key)}
            className="inline-flex items-center gap-1 bg-transparent border-none cursor-pointer text-[13px] text-muted-foreground hover:text-foreground transition-colors"
            style={{ fontWeight: 500 }}
          >
            <span className="overflow-hidden text-ellipsis" style={currentColSort ? { color: 'var(--primary)' } : undefined}>{column.label}</span>
            {currentColSort === 'asc' && <ArrowUp className="w-3 h-3 shrink-0" style={{ color: 'var(--primary)' }} />}
            {currentColSort === 'desc' && <ArrowDown className="w-3 h-3 shrink-0" style={{ color: 'var(--primary)' }} />}
            {!currentColSort && <ArrowUpDown className="w-3 h-3 shrink-0 text-muted-foreground opacity-0 group-hover/colheader:opacity-100 transition-opacity" />}
          </button>
        ) : (
          <span className="text-[13px] text-muted-foreground overflow-hidden text-ellipsis whitespace-nowrap" style={{ fontWeight: 500 }}>
            {column.label}
          </span>
        )}
      </div>
    );
  }
}
