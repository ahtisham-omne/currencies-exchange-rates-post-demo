import { useState, useMemo, useCallback, useRef, type ReactNode } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
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
import { highlightSubsequence } from "../../lib/highlight-text";
import { matchesSubsequence } from "../../lib/subsequence-match";

export interface ColumnConfig {
  key: string;
  label: string | ReactNode;
  /** Plain-text name for search, for a column whose label is a component
   *  (e.g. a header with an info icon). Falls back to the key. */
  searchText?: string;
}

/** The text the panel search matches and highlights for a column. */
function columnSearchText(c: ColumnConfig): string {
  return typeof c.label === "string" ? c.label : (c.searchText ?? c.key);
}

/* ─── Auto-scroll constants (matched to ExportUsersModal) ─── */
const AUTO_SCROLL_ZONE = 40; // px from edge to trigger
const AUTO_SCROLL_MAX_SPEED = 12; // px per frame

interface ColumnSelectorProps {
  columns: ColumnConfig[];
  columnOrder: string[];
  columnVisibility: Record<string, boolean>;
  onColumnOrderChange: (newOrder: string[]) => void;
  onColumnVisibilityChange: (newVisibility: Record<string, boolean>) => void;
  /** Column keys that cannot be hidden (e.g. sticky name column) */
  lockedColumns?: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/* ─── Trigger button (rendered in the toolbar) ─── */
export function ColumnSelectorTrigger({
  visibleCount,
  active,
  onClick,
  disabled,
}: {
  visibleCount: number;
  active?: boolean;
  onClick: () => void;
  /** Disabled in Card View, column customization doesn't apply to cards. */
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={disabled ? "Switch to a table view to manage columns" : "Manage columns"}
      className={`inline-flex items-center justify-center h-9 gap-2 px-3 rounded-[8px] border shadow-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${
        disabled
          ? "border-border bg-white text-foreground opacity-50 cursor-not-allowed"
          : active
          ? "border-[#007FFF]/30 bg-[#007FFF]/[0.04] text-foreground cursor-pointer hover:bg-[#007FFF]/[0.04]"
          : "border-border bg-white text-foreground cursor-pointer hover:bg-muted/40"
      }`}
    >
      <Columns3 className="w-[18px] h-[18px]" style={{ color: "#94A3B8" }} />
      <span className="text-sm hidden md:inline" style={{ fontWeight: 500 }}>
        Columns
      </span>
      <span
        className="inline-flex items-center justify-center h-5 px-1.5 rounded-full text-[11px]"
        style={{ backgroundColor: "#EDF4FF", color: "#007FFF", fontWeight: 600 }}
      >
        {visibleCount}
      </span>
    </button>
  );
}

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
  /** Currently dragged column key (null when not dragging). */
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  /** In-progress order during a drag. Surrounding rows reflow as this updates;
   *  committed via `onColumnOrderChange` on pointer-up. */
  const [liveOrder, setLiveOrder] = useState<string[] | null>(null);

  /* Refs kept in sync so the global pointermove handler can read current
   * values without closure staleness. */
  const liveOrderRef = useRef<string[] | null>(null);
  const draggingKeyRef = useRef<string | null>(null);
  const pointerYRef = useRef<number>(0);
  const autoScrollRafRef = useRef<number | null>(null);
  liveOrderRef.current = liveOrder;
  draggingKeyRef.current = draggingKey;

  const visibleCount = Object.values(columnVisibility).filter(Boolean).length;
  const totalCount = columns.length;

  // Ordered columns based on the in-progress liveOrder during a drag, or the
  // committed columnOrder otherwise. Surrounding rows reflow in real time as
  // the live order updates.
  const currentOrder = liveOrder ?? columnOrder;
  const orderedColumns = currentOrder
    .map((key) => columns.find((c) => c.key === key))
    .filter(Boolean) as ColumnConfig[];

  // Split into pinned (locked) and reorderable
  const pinnedColumns = useMemo(() => {
    return orderedColumns.filter((c) => lockedColumns.includes(c.key));
  }, [orderedColumns, lockedColumns]);

  const reorderableColumns = useMemo(() => {
    const base = orderedColumns.filter((c) => !lockedColumns.includes(c.key));
    /* In-order letter match, not a run of letters (ERP-5144 AC9, ERP-6899
     * AC12): "iao" finds Invite Accepted On. */
    if (searchQuery) {
      return base.filter((c) => {
        return matchesSubsequence(columnSearchText(c), searchQuery);
      });
    }
    return base;
  }, [orderedColumns, searchQuery, lockedColumns]);

  const toggleVisibility = (key: string) => {
    if (lockedColumns.includes(key)) return;
    onColumnVisibilityChange({
      ...columnVisibility,
      [key]: !columnVisibility[key],
    });
  };

  const selectAll = () => {
    const newVis = { ...columnVisibility };
    columns.forEach((c) => {
      newVis[c.key] = true;
    });
    onColumnVisibilityChange(newVis);
  };

  const deselectAll = () => {
    const newVis = { ...columnVisibility };
    columns.forEach((c) => {
      if (!lockedColumns.includes(c.key)) {
        newVis[c.key] = false;
      }
    });
    onColumnVisibilityChange(newVis);
  };

  const resetColumns = () => {
    const newVis = { ...columnVisibility };
    columns.forEach((c) => {
      newVis[c.key] = true;
    });
    onColumnVisibilityChange(newVis);
    onColumnOrderChange(columns.map((c) => c.key));
  };

  const listScrollRef = useRef<HTMLDivElement | null>(null);
  const columnOrderRef = useRef(columnOrder);
  columnOrderRef.current = columnOrder;
  const onColumnOrderChangeRef = useRef(onColumnOrderChange);
  onColumnOrderChangeRef.current = onColumnOrderChange;
  const lockedColumnsRef = useRef(lockedColumns);
  lockedColumnsRef.current = lockedColumns;
  const searchQueryRef = useRef(searchQuery);
  searchQueryRef.current = searchQuery;
  const columnsRef = useRef(columns);
  columnsRef.current = columns;

  const startAutoScroll = useCallback(() => {
    const tick = () => {
      const listEl = listScrollRef.current;
      if (!listEl || !draggingKeyRef.current) {
        autoScrollRafRef.current = null;
        return;
      }
      const listRect = listEl.getBoundingClientRect();
      const y = pointerYRef.current;
      const distFromTop = y - listRect.top;
      const distFromBottom = listRect.bottom - y;
      if (distFromTop < AUTO_SCROLL_ZONE && distFromTop > 0) {
        const intensity = 1 - distFromTop / AUTO_SCROLL_ZONE;
        listEl.scrollTop -= Math.round(AUTO_SCROLL_MAX_SPEED * intensity);
      } else if (distFromBottom < AUTO_SCROLL_ZONE && distFromBottom > 0) {
        const intensity = 1 - distFromBottom / AUTO_SCROLL_ZONE;
        listEl.scrollTop += Math.round(AUTO_SCROLL_MAX_SPEED * intensity);
      }
      autoScrollRafRef.current = requestAnimationFrame(tick);
    };
    if (autoScrollRafRef.current) cancelAnimationFrame(autoScrollRafRef.current);
    autoScrollRafRef.current = requestAnimationFrame(tick);
  }, []);

  const stopAutoScroll = useCallback(() => {
    if (autoScrollRafRef.current) {
      cancelAnimationFrame(autoScrollRafRef.current);
      autoScrollRafRef.current = null;
    }
  }, []);

  /* Reorder by comparing the pointer's y to each non-dragged, non-locked row's
   * midpoint. Skipping the dragged row itself creates a natural deadzone over
   * its current slot, the cursor must cross a neighbor's midpoint before any
   * swap happens, so the card sits under the pointer instead of jumping one
   * slot away on first move. Locked fields keep their relative order (held at
   * the front). */
  const performReorder = useCallback((clientY: number) => {
    const listEl = listScrollRef.current;
    const currentKey = draggingKeyRef.current;
    if (!listEl || !currentKey) return;

    const locked = lockedColumnsRef.current;
    const allRows = Array.from(
      listEl.querySelectorAll<HTMLElement>("[data-col-key]")
    );
    const movableRows = allRows.filter((r) => {
      const id = r.getAttribute("data-col-key");
      return id !== null && id !== currentKey && !locked.includes(id);
    });
    if (movableRows.length === 0) return;

    let insertAt = movableRows.length;
    for (let i = 0; i < movableRows.length; i++) {
      const rect = movableRows[i].getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      if (clientY < midY) {
        insertAt = i;
        break;
      }
    }

    setLiveOrder((prevOrder) => {
      if (!prevOrder) return prevOrder;
      const reorderable = prevOrder.filter((k) => !locked.includes(k));
      const lockedKeys = prevOrder.filter((k) => locked.includes(k));
      const reorderableWithoutDragged = reorderable.filter(
        (k) => k !== currentKey
      );

      // Translate the visible-DOM insertAt into a position in the full
      // reorderable list. When search filters out items, this preserves the
      // relative position of the hidden ones.
      let dataInsertAt: number;
      if (insertAt >= movableRows.length) {
        const lastKey = movableRows[movableRows.length - 1].getAttribute(
          "data-col-key"
        );
        const lastIdx = lastKey ? reorderableWithoutDragged.indexOf(lastKey) : -1;
        dataInsertAt =
          lastIdx === -1 ? reorderableWithoutDragged.length : lastIdx + 1;
      } else {
        const targetKey = movableRows[insertAt].getAttribute("data-col-key");
        const targetIdx = targetKey
          ? reorderableWithoutDragged.indexOf(targetKey)
          : -1;
        dataInsertAt =
          targetIdx === -1 ? reorderableWithoutDragged.length : targetIdx;
      }

      const nextReorderable = [...reorderableWithoutDragged];
      nextReorderable.splice(dataInsertAt, 0, currentKey);
      const nextOrder = [...lockedKeys, ...nextReorderable];

      if (
        nextOrder.length === prevOrder.length &&
        nextOrder.every((k, i) => k === prevOrder[i])
      ) {
        return prevOrder;
      }
      return nextOrder;
    });
  }, []);

  const handleGripPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>, key: string) => {
      if (lockedColumnsRef.current.includes(key)) return;
      if (searchQueryRef.current) return;
      e.preventDefault();
      e.stopPropagation();

      (e.target as HTMLElement).setPointerCapture(e.pointerId);

      setDraggingKey(key);
      setLiveOrder(columnOrderRef.current);
      pointerYRef.current = e.clientY;

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
    [startAutoScroll, stopAutoScroll, performReorder]
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
              <Columns3 className="w-3.5 h-3.5" style={{ color: "#007FFF" }} />
            </div>
            <span className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>
              Columns
            </span>
            <span
              className="inline-flex items-center text-[11px] tabular-nums px-2 py-[2px] rounded-full"
              style={{ fontWeight: 600, color: "#007FFF", backgroundColor: "#EDF4FF" }}
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
            style={{ fontWeight: 500, color: "#007FFF" }}
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
      <div
        ref={listScrollRef}
        className="flex-1 min-h-0 overflow-y-auto"
      >
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
                className="flex items-center gap-2 px-2 py-[7px] mx-1.5 rounded-md select-none"
              >
                <div className="shrink-0 w-[18px] h-[18px] rounded flex items-center justify-center bg-[#D6E8FF] text-[#3D95FF]">
                  <Lock className="w-2.5 h-2.5" />
                </div>
                <span
                  className="flex-1 text-[12.5px] text-foreground truncate"
                  style={{ fontWeight: 450 }}
                >
                  {col.label}
                </span>
              </div>
            ))}

            {/* Separator */}
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

        {reorderableColumns.map((col) => {
          const isVisible = columnVisibility[col.key] !== false;
          const isDragging = draggingKey === col.key;

          return (
            <div key={col.key} className="relative mx-1.5">
              <div
                data-col-key={col.key}
                className={`group/item flex items-center gap-2 px-2 py-[7px] rounded-md transition-all duration-150 select-none ${
                  isDragging ? "" : "hover:bg-muted/30 border border-transparent"
                }`}
                style={
                  isDragging
                    ? {
                        opacity: 0.4,
                        transform: "scale(0.97)",
                        backgroundColor: "rgba(10,119,255,0.04)",
                        border: "1px dashed rgba(10,119,255,0.4)",
                      }
                    : undefined
                }
              >
                {/* Drag handle: grip-only drag activation, mirrors ExportUsersModal */}
                <div
                  onPointerDown={(e) => handleGripPointerDown(e, col.key)}
                  className={`shrink-0 transition-opacity duration-100 touch-none ${
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
                  {typeof col.label === "string"
                    ? highlightSubsequence(col.label, searchQuery)
                    : searchQuery
                      ? highlightSubsequence(columnSearchText(col), searchQuery)
                      : col.label}
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