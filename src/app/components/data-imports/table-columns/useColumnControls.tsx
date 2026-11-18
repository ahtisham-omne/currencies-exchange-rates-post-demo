/**
 * useColumnControls: column order, hide, freeze, sort and header drag-reorder
 * for the Data Import tables. Behaviour mirrors Inventory-Movement-Web's
 * listing table: live-swap drag with a floating ghost, a grip revealed on
 * header hover, frozen columns snapped to the end of the frozen block, drags
 * never cross the freeze boundary, and hiding a column clears its sort and
 * freeze.
 */
import { useCallback, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowDown, ArrowUp, GripVertical } from "lucide-react";
import type { ColumnSortDirection, ColumnSortState } from "./ImportColumnHeaderMenu";

export interface ControlledColumn {
  key: string;
  label: string;
  width: number;
}

export function useColumnControls<C extends ControlledColumn>(
  columns: readonly C[],
  opts: { initialSort?: ColumnSortState | null } = {},
) {
  const [order, setOrder] = useState<string[]>(() => columns.map((c) => c.key));
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const [frozen, setFrozen] = useState<Set<string>>(() => new Set());
  const [sort, setSort] = useState<ColumnSortState | null>(opts.initialSort ?? null);
  const [draggingKey, setDraggingKey] = useState<string | null>(null);

  const frozenRef = useRef(frozen);
  frozenRef.current = frozen;

  const byKey = useMemo(() => new Map(columns.map((c) => [c.key, c])), [columns]);

  /** Ordered visible columns, frozen block first. */
  const visibleColumns = useMemo(() => {
    const known = order.filter((k) => byKey.has(k));
    for (const c of columns) if (!known.includes(c.key)) known.push(c.key);
    return known.filter((k) => !hidden.has(k)).map((k) => byKey.get(k)!) as C[];
  }, [order, hidden, byKey, columns]);

  const frozenColumns = useMemo(() => visibleColumns.filter((c) => frozen.has(c.key)), [visibleColumns, frozen]);
  const scrollColumns = useMemo(() => visibleColumns.filter((c) => !frozen.has(c.key)), [visibleColumns, frozen]);

  /** Left offsets for frozen columns, starting after `base` px of fixed leading columns. */
  const frozenLefts = useCallback(
    (base: number) => {
      const out: Record<string, number> = {};
      let left = base;
      for (const c of frozenColumns) { out[c.key] = left; left += c.width; }
      return out;
    },
    [frozenColumns],
  );

  const onSort = useCallback((key: string, direction: ColumnSortDirection | null) => {
    setSort(direction ? { key, direction } : null);
  }, []);

  const onHide = useCallback((key: string) => {
    setHidden((prev) => new Set(prev).add(key));
    setSort((s) => (s?.key === key ? null : s));
    setFrozen((prev) => { const n = new Set(prev); n.delete(key); return n; });
  }, []);

  const onFreeze = useCallback((key: string) => {
    const next = new Set(frozenRef.current);
    if (next.has(key)) next.delete(key); else next.add(key);
    setFrozen(next);
    setOrder((prevOrder) => {
      const rest = prevOrder.filter((k) => k !== key);
      let lastFrozen = -1;
      rest.forEach((k, i) => { if (next.has(k)) lastFrozen = i; });
      rest.splice(lastFrozen + 1, 0, key);
      return rest;
    });
  }, []);

  const showAll = useCallback(() => setHidden(new Set()), []);
  const toggleHidden = useCallback((key: string) => {
    setHidden((prev) => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  }, []);
  const reset = useCallback(() => {
    setOrder(columns.map((c) => c.key));
    setHidden(new Set());
    setFrozen(new Set());
  }, [columns]);

  /* ── Drag reorder (mouse-event based, live swap) ── */
  const dragRef = useRef<{ key: string; x: number; y: number; dragging: boolean; lastSwap: number } | null>(null);
  const suppressRef = useRef(false);
  const ghostRef = useRef<HTMLDivElement>(null);
  const tableId = useRef(`ic-${Math.random().toString(36).slice(2, 8)}`).current;

  const onHeaderMouseDown = useCallback(
    (e: React.MouseEvent, key: string) => {
      if (e.button !== 0) return;
      dragRef.current = { key, x: e.clientX, y: e.clientY, dragging: false, lastSwap: 0 };
      const onMove = (ev: MouseEvent) => {
        const d = dragRef.current;
        if (!d) return;
        if (!d.dragging) {
          if (Math.hypot(ev.clientX - d.x, ev.clientY - d.y) < 5) return;
          d.dragging = true;
          document.body.style.userSelect = "none";
          document.body.style.cursor = "grabbing";
          setDraggingKey(d.key);
        }
        if (ghostRef.current) ghostRef.current.style.transform = `translate(${ev.clientX}px, ${ev.clientY}px)`;
        const now = performance.now();
        if (now - d.lastSwap < 60) return;
        const sel = `th[data-col-drag-table="${tableId}"]`;
        const draggedTh = document.querySelector<HTMLElement>(`${sel}[data-col-drag-key="${d.key}"]`);
        if (!draggedTh) return;
        const r = draggedTh.getBoundingClientRect();
        if (ev.clientX >= r.left && ev.clientX <= r.right) return;
        for (const th of document.querySelectorAll<HTMLElement>(sel)) {
          const rect = th.getBoundingClientRect();
          if (ev.clientX < rect.left || ev.clientX > rect.right) continue;
          const k = th.getAttribute("data-col-drag-key");
          if (!k || k === d.key) break;
          const fz = frozenRef.current;
          if (fz.has(d.key) !== fz.has(k)) break;
          setOrder((prev) => {
            const s = prev.indexOf(d.key);
            const t = prev.indexOf(k);
            if (s === -1 || t === -1) return prev;
            const next = [...prev];
            next.splice(s, 1);
            next.splice(t, 0, d.key);
            return next;
          });
          d.lastSwap = now;
          break;
        }
      };
      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
        if (dragRef.current?.dragging) {
          suppressRef.current = true;
          requestAnimationFrame(() => { suppressRef.current = false; });
        }
        dragRef.current = null;
        setDraggingKey(null);
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [tableId],
  );

  /** Spread onto a draggable <th>. */
  const headerDragProps = useCallback(
    (key: string) => ({
      "data-col-drag-key": key,
      "data-col-drag-table": tableId,
      onMouseDown: (e: React.MouseEvent) => onHeaderMouseDown(e, key),
      onClickCapture: (e: React.MouseEvent) => {
        if (suppressRef.current) { e.stopPropagation(); e.preventDefault(); }
      },
    }),
    [onHeaderMouseDown, tableId],
  );

  const suppressClick = useCallback(() => suppressRef.current, []);

  /** Accent bar + grip overlaid on a draggable header (the <th> needs `relative group/colheader`). */
  const dragAdornments = (key: string) => {
    const active = draggingKey === key;
    return (
      <>
        {active && <div className="absolute top-0 left-0 right-0 h-[2px] rounded-b-full" style={{ backgroundColor: "#0A77FF" }} />}
        <GripVertical
          size={12}
          className={`absolute left-1 top-1/2 -translate-y-1/2 transition-opacity z-[5] pointer-events-none ${active ? "opacity-100" : "opacity-0 group-hover/colheader:opacity-100"}`}
          style={{ color: active ? "#0A77FF" : "#94A3B8" }}
        />
      </>
    );
  };

  /** Gradient wash on the header being dragged. */
  const draggedHeaderStyle = (key: string): React.CSSProperties =>
    draggingKey === key
      ? { background: "linear-gradient(180deg, rgba(10,119,255,0.08) 0%, rgba(10,119,255,0.03) 100%)" }
      : {};

  /** Opaque tint for body cells of the dragged column. */
  const draggedCellStyle = (key: string): React.CSSProperties =>
    draggingKey === key ? { backgroundColor: "#F7FAFF" } : {};

  const ghost = createPortal(
    <div
      ref={ghostRef}
      style={{
        position: "fixed", top: 0, left: 0, zIndex: 9999, pointerEvents: "none",
        opacity: draggingKey ? 1 : 0, transition: "opacity 80ms ease-out", willChange: "transform",
      }}
    >
      {draggingKey && (
        <div
          className="flex items-center gap-1.5 h-[32px] pl-2 pr-3 rounded-md whitespace-nowrap"
          style={{
            marginLeft: 12, marginTop: -14,
            backgroundColor: "rgba(255,255,255,0.92)",
            backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
            border: "1px solid rgba(10,119,255,0.3)",
            boxShadow: "0 1px 3px rgba(10,119,255,0.08), 0 6px 20px rgba(0,0,0,0.1)",
          }}
        >
          <GripVertical size={12} className="shrink-0" style={{ color: "#0A77FF" }} />
          <span className="text-[13px]" style={{ color: "#0A77FF", fontWeight: 500 }}>{byKey.get(draggingKey)?.label}</span>
          {sort?.key === draggingKey && (sort.direction === "asc"
            ? <ArrowUp size={12} className="shrink-0" style={{ color: "#0A77FF" }} />
            : <ArrowDown size={12} className="shrink-0" style={{ color: "#0A77FF" }} />)}
        </div>
      )}
    </div>,
    document.body,
  );

  /** Sorts rows by the active column using `get` to read a cell's value. */
  const sortRows = useCallback(
    <R,>(rows: R[], get: (row: R, key: string) => unknown): R[] => {
      if (!sort) return rows;
      const dir = sort.direction === "asc" ? 1 : -1;
      return [...rows].sort((a, b) => {
        const va = get(a, sort.key);
        const vb = get(b, sort.key);
        const ea = va === undefined || va === null || va === "";
        const eb = vb === undefined || vb === null || vb === "";
        if (ea && eb) return 0;
        if (ea) return 1;
        if (eb) return -1;
        if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
        return String(va).localeCompare(String(vb), undefined, { numeric: true, sensitivity: "base" }) * dir;
      });
    },
    [sort],
  );

  return {
    visibleColumns, frozenColumns, scrollColumns, frozenLefts,
    hidden, frozen, sort, setSort, onSort, onHide, onFreeze, showAll, toggleHidden, reset, order, setOrder,
    draggingKey, headerDragProps, dragAdornments, draggedHeaderStyle, draggedCellStyle, suppressClick, ghost, sortRows,
  };
}
