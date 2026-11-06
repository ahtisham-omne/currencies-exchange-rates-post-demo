// @ts-nocheck
/**
 * ColumnConfigSidebar — Partner Management ColumnSelector pattern
 * Inline side-drawer (not modal), pointer-based drag reorder, pinned columns, search
 */
import { useState, useRef, useMemo, useCallback } from 'react';
import React from 'react';
import { Search, GripVertical, Columns3, X, Lock, Eye, EyeOff, RotateCcw } from 'lucide-react';
import { ColumnConfig } from '@/app/types/quote';

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query || query.trim().length === 0) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(regex);
  if (parts.length === 1) return text;
  return parts.map((part, i) =>
    regex.test(part) ? (
      <mark key={i} className="bg-[#FDE68A] text-inherit rounded-[2px] px-[1px]">{part}</mark>
    ) : part
  );
}

/* ─── Trigger button ─── */
export function ColumnSelectorTrigger({ visibleCount, active, onClick }: { visibleCount: number; active?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center justify-center h-9 gap-2 px-3 rounded-lg border shadow-sm transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${
        active
          ? 'border-primary/30 bg-primary/[0.04] text-foreground'
          : 'border-border bg-card text-foreground hover:bg-muted/40'
      }`}
      title="Manage columns"
    >
      <Columns3 className="w-[18px] h-[18px] text-muted-foreground/80" />
      <span className="text-sm hidden md:inline" style={{ fontWeight: 500 }}>Columns</span>
      <span className="inline-flex items-center justify-center h-5 px-1.5 rounded-full text-[11px]"
        style={{ backgroundColor: '#EDF4FF', color: 'hsl(var(--primary))', fontWeight: 600 }}>
        {visibleCount}
      </span>
    </button>
  );
}

/* ─── Auto-scroll constants ─── */
const AUTO_SCROLL_ZONE = 40;
const AUTO_SCROLL_MAX_SPEED = 12;

interface ColumnConfigSidebarProps {
  columns: ColumnConfig[];
  onClose: () => void;
  onColumnsUpdate: (columns: ColumnConfig[]) => void;
  defaultColumns: ColumnConfig[];
}

export function ColumnConfigSidebar({ columns, onClose, onColumnsUpdate, defaultColumns }: ColumnConfigSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  const [liveOrder, setLiveOrder] = useState<ColumnConfig[] | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const liveOrderRef = useRef<ColumnConfig[] | null>(null);
  const draggingKeyRef = useRef<string | null>(null);
  const autoScrollRaf = useRef<number | null>(null);
  const pointerYRef = useRef<number>(0);
  const columnsRef = useRef(columns);
  const onColumnsUpdateRef = useRef(onColumnsUpdate);

  liveOrderRef.current = liveOrder;
  draggingKeyRef.current = draggingKey;
  columnsRef.current = columns;
  onColumnsUpdateRef.current = onColumnsUpdate;

  const localColumns = liveOrder ?? columns;

  const LOCKED_KEYS = ['quoteNumber'];

  const pinnedColumns = useMemo(() => localColumns.filter(c => LOCKED_KEYS.includes(c.key)), [localColumns]);
  const reorderableColumns = useMemo(() => {
    const base = localColumns.filter(c => !LOCKED_KEYS.includes(c.key));
    if (searchQuery) return base.filter(c => c.label.toLowerCase().includes(searchQuery.toLowerCase()));
    return base;
  }, [localColumns, searchQuery]);

  const visibleCount = localColumns.filter(c => c.visible).length;
  const totalCount = localColumns.length;

  const handleToggleVisibility = (key: string) => {
    if (LOCKED_KEYS.includes(key)) return;
    const updated = localColumns.map(col => col.key === key ? { ...col, visible: !col.visible } : col);
    onColumnsUpdate(updated);
  };

  const selectAll = () => {
    const updated = localColumns.map(c => ({ ...c, visible: true }));
    onColumnsUpdate(updated);
  };

  const deselectAll = () => {
    const updated = localColumns.map(c => LOCKED_KEYS.includes(c.key) ? c : { ...c, visible: false });
    onColumnsUpdate(updated);
  };

  const resetColumns = () => {
    onColumnsUpdate(JSON.parse(JSON.stringify(defaultColumns)));
    setLiveOrder(null);
  };

  /* ─── Auto-scroll loop ─── */
  const startAutoScroll = useCallback(() => {
    const tick = () => {
      const listEl = listRef.current;
      if (!listEl || !draggingKeyRef.current) { autoScrollRaf.current = null; return; }
      const listRect = listEl.getBoundingClientRect();
      const y = pointerYRef.current;
      const distFromTop = y - listRect.top;
      const distFromBottom = listRect.bottom - y;
      if (distFromTop < AUTO_SCROLL_ZONE && distFromTop > 0) {
        listEl.scrollTop -= Math.round(AUTO_SCROLL_MAX_SPEED * (1 - distFromTop / AUTO_SCROLL_ZONE));
      } else if (distFromBottom < AUTO_SCROLL_ZONE && distFromBottom > 0) {
        listEl.scrollTop += Math.round(AUTO_SCROLL_MAX_SPEED * (1 - distFromBottom / AUTO_SCROLL_ZONE));
      }
      autoScrollRaf.current = requestAnimationFrame(tick);
    };
    if (autoScrollRaf.current) cancelAnimationFrame(autoScrollRaf.current);
    autoScrollRaf.current = requestAnimationFrame(tick);
  }, []);

  const stopAutoScroll = useCallback(() => {
    if (autoScrollRaf.current) { cancelAnimationFrame(autoScrollRaf.current); autoScrollRaf.current = null; }
  }, []);

  /* ─── Reorder logic ─── */
  const performReorder = useCallback((clientY: number) => {
    const listEl = listRef.current;
    if (!listEl) return;
    const rows = Array.from(listEl.querySelectorAll<HTMLElement>('[data-col-key]'));
    const currentKey = draggingKeyRef.current;
    if (!currentKey) return;
    let targetIdx = -1;
    for (let i = 0; i < rows.length; i++) {
      const rect = rows[i].getBoundingClientRect();
      if (clientY < rect.top + rect.height / 2) { targetIdx = i; break; }
    }
    if (targetIdx === -1) targetIdx = rows.length - 1;
    const currentIdx = rows.findIndex(r => r.getAttribute('data-col-key') === currentKey);
    if (currentIdx === -1 || currentIdx === targetIdx) return;

    setLiveOrder(prev => {
      if (!prev) return prev;
      const locked = prev.filter(c => LOCKED_KEYS.includes(c.key));
      const reorderable = prev.filter(c => !LOCKED_KEYS.includes(c.key));
      const fromIdx = reorderable.findIndex(c => c.key === currentKey);
      if (fromIdx === -1) return prev;
      const clamped = Math.max(0, Math.min(targetIdx, reorderable.length - 1));
      if (fromIdx === clamped) return prev;
      const newReorderable = [...reorderable];
      newReorderable.splice(fromIdx, 1);
      newReorderable.splice(clamped, 0, reorderable[fromIdx]);
      return [...locked, ...newReorderable];
    });
  }, []);

  /* ─── Pointer-based drag ─── */
  const handlePointerDown = useCallback((e: React.PointerEvent, key: string) => {
    if (searchQuery) return;
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDraggingKey(key);
    setLiveOrder(columns);
    pointerYRef.current = e.clientY;
    startAutoScroll();

    const handleMove = (ev: PointerEvent) => { pointerYRef.current = ev.clientY; performReorder(ev.clientY); };
    const handleUp = () => {
      const finalOrder = liveOrderRef.current;
      if (finalOrder) onColumnsUpdateRef.current(finalOrder);
      setDraggingKey(null);
      setLiveOrder(null);
      stopAutoScroll();
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  }, [columns, searchQuery, startAutoScroll, stopAutoScroll, performReorder]);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={onClose} />

      {/* Sidebar — Partner Management ColumnSelector pattern */}
      <div className="h-full border-l border-border bg-card flex flex-col shrink-0 overflow-hidden fixed top-0 right-0 z-50"
        style={{ width: 280, minWidth: 280 }}>
        {/* Header */}
        <div className="px-3.5 pt-3 pb-3 border-b border-border/50 shrink-0 bg-secondary/30">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ backgroundColor: '#EDF4FF' }}>
                <Columns3 className="w-3.5 h-3.5" style={{ color: 'hsl(var(--primary))' }} />
              </div>
              <span className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>Columns</span>
              <span className="inline-flex items-center text-[11px] tabular-nums px-2 py-[2px] rounded-full"
                style={{ fontWeight: 600, color: 'hsl(var(--primary))', backgroundColor: '#EDF4FF' }}>
                {visibleCount}/{totalCount}
              </span>
            </div>
            <button onClick={onClose} className="p-1 rounded-md hover:bg-muted/60 text-muted-foreground/60 hover:text-foreground transition-colors cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Search */}
          <div className="relative mb-2.5">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50 pointer-events-none" />
            <input placeholder="Search columns…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-8 h-[30px] text-xs bg-card border border-border/60 rounded-md outline-none focus:ring-2 focus:ring-ring/20 placeholder:text-muted-foreground/40" />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-muted/60 text-muted-foreground/40 hover:text-muted-foreground transition-colors cursor-pointer">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1">
            <button onClick={selectAll} className="inline-flex items-center gap-1 text-[11px] px-2 py-[3px] rounded-md hover:bg-[#EDF4FF] transition-colors cursor-pointer" style={{ fontWeight: 500, color: 'hsl(var(--primary))' }}>
              <Eye className="w-3 h-3" /> Show All
            </button>
            <button onClick={deselectAll} className="inline-flex items-center gap-1 text-[11px] px-2 py-[3px] rounded-md hover:bg-muted/60 text-muted-foreground transition-colors cursor-pointer" style={{ fontWeight: 500 }}>
              <EyeOff className="w-3 h-3" /> Hide All
            </button>
            <div className="flex-1" />
            <button onClick={resetColumns} className="inline-flex items-center gap-1 text-[11px] px-2 py-[3px] rounded-md hover:bg-muted/60 text-muted-foreground transition-colors cursor-pointer" style={{ fontWeight: 500 }}>
              <RotateCcw className="w-3 h-3" /> Reset
            </button>
          </div>
        </div>

        {/* Column list */}
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide" ref={listRef}>
          {/* Pinned */}
          {pinnedColumns.length > 0 && !searchQuery && (
            <>
              <div className="px-3.5 pt-2.5 pb-1">
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground/50" style={{ fontWeight: 600 }}>Pinned</span>
              </div>
              {pinnedColumns.map(col => (
                <div key={col.key} className="flex items-center gap-2 px-3.5 py-[7px] mx-1.5 rounded-md select-none">
                  <div className="w-[18px] h-[18px] rounded flex items-center justify-center bg-muted/50 shrink-0">
                    <Lock className="w-2.5 h-2.5 text-muted-foreground/40" />
                  </div>
                  <span className="flex-1 text-[12.5px] text-muted-foreground/60 truncate" style={{ fontWeight: 450 }}>{col.label}</span>
                  <Eye className="w-3.5 h-3.5 text-muted-foreground/25 shrink-0" />
                </div>
              ))}
              <div className="my-1 border-t border-border/30 mx-3.5" />
            </>
          )}

          {/* Reorderable */}
          {!searchQuery && (
            <div className="px-3.5 pt-2 pb-1">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground/50" style={{ fontWeight: 600 }}>Columns</span>
            </div>
          )}

          {searchQuery && reorderableColumns.length > 0 && (
            <div className="px-3.5 pt-2 pb-1">
              <span className="text-[11px] text-muted-foreground/50" style={{ fontWeight: 500 }}>
                {reorderableColumns.length} result{reorderableColumns.length !== 1 ? 's' : ''}
              </span>
            </div>
          )}

          {reorderableColumns.map((col, idx) => {
            const isVisible = col.visible !== false;
            const isDragging = draggingKey === col.key;
            return (
              <div key={col.key} data-col-key={col.key}
                ref={el => { if (el) rowRefs.current.set(col.key, el); else rowRefs.current.delete(col.key); }}
                className="mx-1.5 select-none">
                <div className={`group/item flex items-center gap-2 px-2 py-[7px] rounded-md transition-all duration-150 ${
                  isDragging ? 'bg-[hsl(var(--primary))]/[0.04] border border-dashed border-[hsl(var(--primary))]/25 opacity-40 scale-[0.97]' : 'hover:bg-muted/30 border border-transparent'
                }`}>
                  {/* Drag handle */}
                  <div
                    onPointerDown={e => handlePointerDown(e, col.key)}
                    className={`shrink-0 transition-all duration-150 touch-none ${
                      searchQuery ? 'opacity-0 w-0 overflow-hidden' : isDragging ? 'opacity-100 cursor-grabbing' : 'opacity-0 group-hover/item:opacity-100 cursor-grab active:cursor-grabbing'
                    }`}>
                    <GripVertical className="w-3.5 h-3.5 text-muted-foreground/40" />
                  </div>

                  <span className={`flex-1 text-[12.5px] truncate transition-colors ${isVisible ? 'text-foreground' : 'text-muted-foreground/40'}`} style={{ fontWeight: 450 }}>
                    {highlightMatch(col.label, searchQuery)}
                  </span>

                  <button onClick={e => { e.stopPropagation(); handleToggleVisibility(col.key); }}
                    className={`w-[18px] h-[18px] rounded flex items-center justify-center shrink-0 transition-all ${
                      isVisible ? 'text-primary hover:bg-primary/10' : 'text-muted-foreground/25 hover:bg-muted/50 hover:text-muted-foreground/50'
                    }`}>
                    {isVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-3.5 py-2.5 flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground/40" style={{ fontWeight: 500 }}>Drag to reorder · Toggle to show/hide</span>
          <button onClick={onClose}
            className="inline-flex items-center h-7 px-3 text-[12px] text-white rounded-md transition-colors cursor-pointer"
            style={{ fontWeight: 500, backgroundColor: 'hsl(var(--primary))', border: 'none' }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#0860D0'; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'hsl(var(--primary))'; }}>
            Done
          </button>
        </div>
      </div>
    </>
  );
}
