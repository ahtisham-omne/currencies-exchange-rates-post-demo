import { useState, useRef, useMemo, useCallback } from "react";
import React from "react";
import {
  Search,
  GripVertical,
  Columns3,
  X,
  Lock,
  Eye,
  EyeOff,
  RotateCcw,
} from "lucide-react";
import { Input } from "../ui/input";

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query || query.trim().length === 0) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escaped})`, "gi");
  const parts = text.split(regex);
  if (parts.length === 1) return text;
  return parts.map((part, i) =>
    regex.test(part) ? (
      <mark key={i} className="bg-transparent px-0.5 rounded-sm" style={{ backgroundColor: "#FEFCE8", color: "#854D0E", fontWeight: 500 }}>{part}</mark>
    ) : (
      part
    )
  );
}

export interface ColumnConfig {
  key: string;
  label: string;
}

interface ColumnSelectorProps {
  columns: ColumnConfig[];
  columnOrder: string[];
  columnVisibility: Record<string, boolean>;
  onColumnOrderChange: (newOrder: string[]) => void;
  onColumnVisibilityChange: (newVisibility: Record<string, boolean>) => void;
  lockedColumns?: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/* ─── Trigger button (rendered in the toolbar) ─── */
export function ColumnSelectorTrigger({
  visibleCount,
  active,
  onClick,
}: {
  visibleCount: number;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center justify-center h-9 gap-2 px-3 rounded-lg border shadow-sm transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${
        active
          ? "border-primary/30 bg-primary/[0.04] text-foreground"
          : "border-border bg-white text-foreground hover:bg-muted/40"
      }`}
      title="Manage columns"
    >
      <Columns3 className="w-[18px] h-[18px] text-muted-foreground/80" />
      <span className="text-sm hidden md:inline" style={{ fontWeight: 500 }}>
        Columns
      </span>
      <span
        className="inline-flex items-center justify-center h-5 px-1.5 rounded-full text-[11px]"
        style={{ backgroundColor: "#EDF4FF", color: "#0A77FF", fontWeight: 600 }}
      >
        {visibleCount}
      </span>
    </button>
  );
}

/* ─── Auto-scroll constants ─── */
const AUTO_SCROLL_ZONE = 40; // px from edge to trigger
const AUTO_SCROLL_MAX_SPEED = 12; // px per frame

/* ─── Side drawer panel ─── */
export function ColumnSelector({
  columns,
  columnOrder,
  columnVisibility,
  onColumnOrderChange,
  onColumnVisibilityChange,
  lockedColumns = [],
  open,
  onOpenChange,
}: ColumnSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  const [liveOrder, setLiveOrder] = useState<string[] | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const liveOrderRef = useRef<string[] | null>(null);
  const draggingKeyRef = useRef<string | null>(null);
  const autoScrollRaf = useRef<number | null>(null);
  const pointerYRef = useRef<number>(0);

  // Keep refs in sync
  liveOrderRef.current = liveOrder;
  draggingKeyRef.current = draggingKey;

  const visibleCount = Object.values(columnVisibility).filter(Boolean).length;
  const totalCount = columns.length;

  const currentOrder = liveOrder ?? columnOrder;

  const orderedColumns = currentOrder
    .map((key) => columns.find((c) => c.key === key))
    .filter(Boolean) as ColumnConfig[];

  const pinnedColumns = useMemo(() => {
    return orderedColumns.filter((c) => lockedColumns.includes(c.key));
  }, [orderedColumns, lockedColumns]);

  const reorderableColumns = useMemo(() => {
    const base = orderedColumns.filter((c) => !lockedColumns.includes(c.key));
    if (searchQuery) {
      return base.filter((c) =>
        c.label.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    return base;
  }, [orderedColumns, searchQuery, lockedColumns]);

  const toggleVisibility = useCallback((key: string) => {
    if (lockedColumns.includes(key)) return;
    onColumnVisibilityChange({
      ...columnVisibility,
      [key]: !columnVisibility[key],
    });
  }, [lockedColumns, columnVisibility, onColumnVisibilityChange]);

  const selectAll = () => {
    const newVis = { ...columnVisibility };
    columns.forEach((c) => { newVis[c.key] = true; });
    onColumnVisibilityChange(newVis);
  };

  const deselectAll = () => {
    const newVis = { ...columnVisibility };
    columns.forEach((c) => {
      if (!lockedColumns.includes(c.key)) newVis[c.key] = false;
    });
    onColumnVisibilityChange(newVis);
  };

  const resetColumns = () => {
    const newVis = { ...columnVisibility };
    columns.forEach((c) => { newVis[c.key] = true; });
    onColumnVisibilityChange(newVis);
    onColumnOrderChange(columns.map((c) => c.key));
    setLiveOrder(null);
  };

  /* ─── Stable refs for reorder logic ─── */
  const lockedColumnsRef = useRef(lockedColumns);
  lockedColumnsRef.current = lockedColumns;
  const searchQueryRef = useRef(searchQuery);
  searchQueryRef.current = searchQuery;
  const columnsRef = useRef(columns);
  columnsRef.current = columns;
  const onColumnOrderChangeRef = useRef(onColumnOrderChange);
  onColumnOrderChangeRef.current = onColumnOrderChange;

  /* ─── Auto-scroll loop ─── */
  const startAutoScroll = useCallback(() => {
    const tick = () => {
      const listEl = listRef.current;
      if (!listEl || !draggingKeyRef.current) {
        autoScrollRaf.current = null;
        return;
      }

      const listRect = listEl.getBoundingClientRect();
      const y = pointerYRef.current;
      const distFromTop = y - listRect.top;
      const distFromBottom = listRect.bottom - y;

      if (distFromTop < AUTO_SCROLL_ZONE && distFromTop > 0) {
        // Scroll up — speed proportional to proximity
        const intensity = 1 - distFromTop / AUTO_SCROLL_ZONE;
        listEl.scrollTop -= Math.round(AUTO_SCROLL_MAX_SPEED * intensity);
      } else if (distFromBottom < AUTO_SCROLL_ZONE && distFromBottom > 0) {
        // Scroll down
        const intensity = 1 - distFromBottom / AUTO_SCROLL_ZONE;
        listEl.scrollTop += Math.round(AUTO_SCROLL_MAX_SPEED * intensity);
      }

      autoScrollRaf.current = requestAnimationFrame(tick);
    };
    if (autoScrollRaf.current) cancelAnimationFrame(autoScrollRaf.current);
    autoScrollRaf.current = requestAnimationFrame(tick);
  }, []);

  const stopAutoScroll = useCallback(() => {
    if (autoScrollRaf.current) {
      cancelAnimationFrame(autoScrollRaf.current);
      autoScrollRaf.current = null;
    }
  }, []);

  /* ─── Reorder helper (extracted for reuse by auto-scroll) ─── */
  const performReorder = useCallback((clientY: number) => {
    const listEl = listRef.current;
    if (!listEl) return;

    const rows = Array.from(listEl.querySelectorAll<HTMLElement>("[data-col-key]"));
    const currentKey = draggingKeyRef.current;
    if (!currentKey) return;

    let targetIdx = -1;
    for (let i = 0; i < rows.length; i++) {
      const rect = rows[i].getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      if (clientY < midY) {
        targetIdx = i;
        break;
      }
    }
    if (targetIdx === -1) targetIdx = rows.length - 1;

    const currentIdx = rows.findIndex(
      (r) => r.getAttribute("data-col-key") === currentKey
    );
    if (currentIdx === -1 || currentIdx === targetIdx) return;

    setLiveOrder((prevOrder) => {
      if (!prevOrder) return prevOrder;
      const locked = lockedColumnsRef.current;
      const reorderableKeys = prevOrder.filter((k) => !locked.includes(k));
      const lockedKeys = prevOrder.filter((k) => locked.includes(k));

      const sq = searchQueryRef.current;
      let filteredKeys = reorderableKeys;
      if (sq) {
        filteredKeys = reorderableKeys.filter((k) => {
          const col = columnsRef.current.find((c) => c.key === k);
          return col && col.label.toLowerCase().includes(sq.toLowerCase());
        });
      }

      const fromIdx = filteredKeys.indexOf(currentKey);
      if (fromIdx === -1) return prevOrder;

      const clampedTarget = Math.max(0, Math.min(targetIdx, filteredKeys.length - 1));
      if (fromIdx === clampedTarget) return prevOrder;

      if (sq) {
        const targetKey = filteredKeys[clampedTarget];
        const realFrom = reorderableKeys.indexOf(currentKey);
        const realTo = reorderableKeys.indexOf(targetKey);
        if (realFrom === -1 || realTo === -1) return prevOrder;
        const newReorderable = [...reorderableKeys];
        newReorderable.splice(realFrom, 1);
        newReorderable.splice(realTo, 0, currentKey);
        return [...lockedKeys, ...newReorderable];
      }

      const newReorderable = [...reorderableKeys];
      newReorderable.splice(fromIdx, 1);
      newReorderable.splice(clampedTarget, 0, currentKey);
      return [...lockedKeys, ...newReorderable];
    });
  }, []);

  /* ─── Pointer-based drag logic ─── */
  const handlePointerDown = useCallback(
    (e: React.PointerEvent, key: string, idx: number) => {
      if (searchQueryRef.current) return;
      e.preventDefault();
      e.stopPropagation();

      const row = rowRefs.current.get(key);
      if (!row) return;

      (e.target as HTMLElement).setPointerCapture(e.pointerId);

      setDraggingKey(key);
      setLiveOrder(columnOrder);
      pointerYRef.current = e.clientY;

      // Start auto-scroll loop
      startAutoScroll();

      const handleMove = (ev: PointerEvent) => {
        pointerYRef.current = ev.clientY;
        performReorder(ev.clientY);
      };

      const handleUp = () => {
        const finalOrder = liveOrderRef.current;
        if (finalOrder) {
          onColumnOrderChangeRef.current(finalOrder);
        }
        setDraggingKey(null);
        setLiveOrder(null);
        stopAutoScroll();
        window.removeEventListener("pointermove", handleMove);
        window.removeEventListener("pointerup", handleUp);
      };

      window.addEventListener("pointermove", handleMove);
      window.addEventListener("pointerup", handleUp);
    },
    [columnOrder, startAutoScroll, stopAutoScroll, performReorder]
  );

  return (
    <div
      className="h-full border-l border-border bg-white flex flex-col shrink-0 overflow-hidden transition-all duration-200 ease-in-out"
      style={{
        width: open ? 280 : 0,
        minWidth: open ? 280 : 0,
        opacity: open ? 1 : 0,
        borderLeftWidth: open ? 1 : 0,
      }}
    >
      {/* Header */}
      <div className="px-3.5 pt-3 pb-3 border-b border-border/50 shrink-0 bg-[#fafbfc]">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded-md flex items-center justify-center"
              style={{ backgroundColor: "#EDF4FF" }}
            >
              <Columns3 className="w-3.5 h-3.5" style={{ color: "#0A77FF" }} />
            </div>
            <span className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>
              Columns
            </span>
            <span
              className="inline-flex items-center text-[11px] tabular-nums px-2 py-[2px] rounded-full"
              style={{ fontWeight: 600, color: "#0A77FF", backgroundColor: "#EDF4FF" }}
            >
              {visibleCount}/{totalCount}
            </span>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="p-1 rounded-md hover:bg-muted/60 text-muted-foreground/60 hover:text-foreground transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-2.5">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50 pointer-events-none" />
          <Input
            placeholder="Search columns…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 pr-8 h-[30px] text-xs bg-white border-border/60 shadow-xs placeholder:text-muted-foreground/40 rounded-md"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-muted/60 text-muted-foreground/40 hover:text-muted-foreground transition-colors cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={selectAll}
            className="inline-flex items-center gap-1 text-[11px] px-2 py-[3px] rounded-md hover:bg-[#EDF4FF] transition-colors cursor-pointer"
            style={{ fontWeight: 500, color: "#0A77FF" }}
          >
            <Eye className="w-3 h-3" />
            Show All
          </button>
          <button
            onClick={deselectAll}
            className="inline-flex items-center gap-1 text-[11px] px-2 py-[3px] rounded-md hover:bg-muted/60 text-muted-foreground transition-colors cursor-pointer"
            style={{ fontWeight: 500 }}
          >
            <EyeOff className="w-3 h-3" />
            Hide All
          </button>
          <div className="flex-1" />
          <button
            onClick={resetColumns}
            className="inline-flex items-center gap-1 text-[11px] px-2 py-[3px] rounded-md hover:bg-muted/60 text-muted-foreground transition-colors cursor-pointer"
            style={{ fontWeight: 500 }}
          >
            <RotateCcw className="w-3 h-3" />
            Reset
          </button>
        </div>
      </div>

      {/* Column list */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide" ref={listRef}>
        {/* Pinned columns section */}
        {pinnedColumns.length > 0 && !searchQuery && (
          <>
            <div className="px-3.5 pt-2.5 pb-1">
              <span
                className="text-[10px] uppercase tracking-widest text-muted-foreground/50"
                style={{ fontWeight: 600 }}
              >
                Pinned
              </span>
            </div>
            {pinnedColumns.map((col) => (
              <div
                key={col.key}
                className="flex items-center gap-2 px-3.5 py-[7px] mx-1.5 rounded-md select-none"
              >
                <div className="w-[18px] h-[18px] rounded flex items-center justify-center bg-muted/50 shrink-0">
                  <Lock className="w-2.5 h-2.5 text-muted-foreground/40" />
                </div>
                <span
                  className="flex-1 text-[12.5px] text-muted-foreground/60 truncate"
                  style={{ fontWeight: 450 }}
                >
                  {col.label}
                </span>
                <Eye className="w-3.5 h-3.5 text-muted-foreground/25 shrink-0" />
              </div>
            ))}
            <div className="my-1 border-t border-border/30 mx-3.5" />
          </>
        )}

        {/* Reorderable columns section */}
        {!searchQuery && (
          <div className="px-3.5 pt-2 pb-1">
            <span
              className="text-[10px] uppercase tracking-widest text-muted-foreground/50"
              style={{ fontWeight: 600 }}
            >
              Columns
            </span>
          </div>
        )}

        {searchQuery && reorderableColumns.length > 0 && (
          <div className="px-3.5 pt-2 pb-1">
            <span className="text-[11px] text-muted-foreground/50" style={{ fontWeight: 500 }}>
              {reorderableColumns.length} result{reorderableColumns.length !== 1 ? "s" : ""}
            </span>
          </div>
        )}

        {reorderableColumns.map((col, idx) => {
          const isVisible = columnVisibility[col.key] !== false;
          const isDragging = draggingKey === col.key;

          return (
            <div
              key={col.key}
              data-col-key={col.key}
              ref={(el) => {
                if (el) rowRefs.current.set(col.key, el);
                else rowRefs.current.delete(col.key);
              }}
              className="mx-1.5 select-none"
            >
              <div
                className={`group/item flex items-center gap-2 px-2 py-[7px] rounded-md transition-all duration-150 ${
                  isDragging
                    ? "bg-[#0A77FF]/[0.04] border border-dashed border-[#0A77FF]/25 opacity-40 scale-[0.97]"
                    : "hover:bg-muted/30 border border-transparent"
                }`}
              >
                {/* Drag handle */}
                <div
                  onPointerDown={(e) => handlePointerDown(e, col.key, idx)}
                  className={`shrink-0 transition-all duration-150 touch-none ${
                    searchQuery
                      ? "opacity-0 w-0 overflow-hidden"
                      : isDragging
                        ? "opacity-100 cursor-grabbing"
                        : "opacity-0 group-hover/item:opacity-100 cursor-grab active:cursor-grabbing"
                  }`}
                >
                  <GripVertical className="w-3.5 h-3.5 text-muted-foreground/40" />
                </div>

                {/* Visibility toggle */}
                <button
                  type="button"
                  onClick={() => toggleVisibility(col.key)}
                  className={`shrink-0 w-[18px] h-[18px] rounded flex items-center justify-center transition-colors cursor-pointer ${
                    isVisible
                      ? "bg-[#D6E8FF] text-[#3D95FF]"
                      : "bg-muted/40 text-muted-foreground/25 hover:bg-muted/60 hover:text-muted-foreground/40"
                  }`}
                >
                  {isVisible ? (
                    <Eye className="w-2.5 h-2.5" />
                  ) : (
                    <EyeOff className="w-2.5 h-2.5" />
                  )}
                </button>

                {/* Label */}
                <span
                  className={`flex-1 text-[12.5px] truncate transition-colors duration-100 ${
                    isVisible ? "text-foreground" : "text-muted-foreground/40 line-through decoration-muted-foreground/20"
                  }`}
                  style={{ fontWeight: isVisible ? 450 : 400 }}
                >
                  {highlightMatch(col.label, searchQuery)}
                </span>
              </div>
            </div>
          );
        })}

        {reorderableColumns.length === 0 && searchQuery && (
          <div className="px-4 py-8 text-center">
            <Search className="w-5 h-5 text-muted-foreground/20 mx-auto mb-2" />
            <p className="text-[12px] text-muted-foreground/50" style={{ fontWeight: 500 }}>
              No columns match "{searchQuery}"
            </p>
          </div>
        )}
      </div>

    </div>
  );
}
