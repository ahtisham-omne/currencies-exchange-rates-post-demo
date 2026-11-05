/**
 * Column Configurator — cloned from Partner Management's ColumnSelector.
 * Side drawer panel with search, show/hide all, reset, pinned section,
 * drag reorder with auto-scroll, and visual toggle dots.
 */
import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { Search, GripVertical, X, RotateCcw, Eye, EyeOff, Lock, Columns3 } from "lucide-react";
import { createPortal } from "react-dom";

export interface ColumnDef {
  key: string;
  label: string;
  visible: boolean;
  locked?: boolean;
}

interface Props {
  columns: ColumnDef[];
  onChange: (cols: ColumnDef[]) => void;
  onClose: () => void;
}

/* ═══ Trigger button (for toolbar) ═══ */
export function ColumnSelectorTrigger({ visibleCount, active, onClick }: { visibleCount: number; active?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center justify-center h-9 gap-2 px-3 rounded-lg border shadow-sm transition-colors cursor-pointer outline-none ${
        active ? "border-primary/30 bg-primary/[0.04] text-foreground" : "border-border bg-white text-foreground hover:bg-muted/40"
      }`}
    >
      <Columns3 className="w-[18px] h-[18px] text-muted-foreground/80" />
      <span className="text-sm hidden md:inline" style={{ fontWeight: 500 }}>Columns</span>
      <span className="inline-flex items-center justify-center h-5 px-1.5 rounded-full text-[11px]" style={{ backgroundColor: "#EDF4FF", color: "#0A77FF", fontWeight: 600 }}>{visibleCount}</span>
    </button>
  );
}

const AUTO_SCROLL_ZONE = 40;
const AUTO_SCROLL_MAX_SPEED = 12;

export function SOColumnConfigurator({ columns, onChange, onClose }: Props) {
  const [search, setSearch] = useState("");
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  const [draggingLabel, setDraggingLabel] = useState<string | null>(null);
  const [liveOrder, setLiveOrder] = useState<ColumnDef[] | null>(null);
  const [previewPos, setPreviewPos] = useState<{ x: number; y: number } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const draggingKeyRef = useRef<string | null>(null);
  const autoScrollRaf = useRef<number | null>(null);
  const pointerYRef = useRef<number>(0);

  draggingKeyRef.current = draggingKey;

  const currentColumns = liveOrder ?? columns;
  const locked = currentColumns.filter(c => c.locked);
  const configurable = currentColumns.filter(c => !c.locked);
  const visibleCount = configurable.filter(c => c.visible).length;
  const totalCount = configurable.length;

  const filtered = search
    ? configurable.filter(c => c.label.toLowerCase().includes(search.toLowerCase()))
    : configurable;

  const toggleColumn = (key: string) => {
    onChange(columns.map(c => c.key === key ? { ...c, visible: !c.visible } : c));
  };

  const showAll = () => onChange(columns.map(c => c.locked ? c : { ...c, visible: true }));
  const hideAll = () => onChange(columns.map(c => c.locked ? c : { ...c, visible: false }));
  const reset = () => onChange(columns.map(c => c.locked ? c : { ...c, visible: true }));

  /* ── Auto-scroll ── */
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

  /* ── Drag reorder ── */
  const performReorder = useCallback((clientY: number) => {
    const listEl = listRef.current;
    if (!listEl) return;
    const rows = Array.from(listEl.querySelectorAll<HTMLElement>("[data-col-key]"));
    const currentKey = draggingKeyRef.current;
    if (!currentKey) return;
    let targetIdx = -1;
    for (let i = 0; i < rows.length; i++) {
      const rect = rows[i].getBoundingClientRect();
      if (clientY < rect.top + rect.height / 2) { targetIdx = i; break; }
    }
    if (targetIdx === -1) targetIdx = rows.length - 1;
    const currentIdx = rows.findIndex(r => r.getAttribute("data-col-key") === currentKey);
    if (currentIdx === -1 || currentIdx === targetIdx) return;

    setLiveOrder(prev => {
      if (!prev) return prev;
      const reorderable = prev.filter(c => !c.locked);
      const lockedCols = prev.filter(c => c.locked);
      const fromIdx = reorderable.findIndex(c => c.key === currentKey);
      if (fromIdx === -1) return prev;
      const clamped = Math.max(0, Math.min(targetIdx, reorderable.length - 1));
      if (fromIdx === clamped) return prev;
      const next = [...reorderable];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(clamped, 0, moved);
      return [...lockedCols, ...next];
    });
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent, key: string) => {
    if (search) return;
    e.preventDefault();
    e.stopPropagation();
    const col = columns.find(c => c.key === key);
    setDraggingLabel(col?.label ?? key);
    setDraggingKey(key);
    setLiveOrder([...columns]);
    setPreviewPos({ x: e.clientX, y: e.clientY });
    pointerYRef.current = e.clientY;
    startAutoScroll();

    const handleMove = (ev: PointerEvent) => {
      pointerYRef.current = ev.clientY;
      setPreviewPos({ x: ev.clientX, y: ev.clientY });
      performReorder(ev.clientY);
    };
    const handleUp = () => {
      setLiveOrder(prev => { if (prev) onChange(prev); return null; });
      setDraggingKey(null);
      setDraggingLabel(null);
      setPreviewPos(null);
      stopAutoScroll();
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  }, [columns, search, startAutoScroll, stopAutoScroll, performReorder, onChange]);

  return (
    <>
      <div
        className="h-full border-l border-border bg-white flex flex-col shrink-0 overflow-hidden"
        style={{ width: 280, minWidth: 280 }}
      >
        {/* Header */}
        <div className="px-3.5 pt-3 pb-3 border-b border-border/50 shrink-0 bg-[#fafbfc]">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ backgroundColor: "#EDF4FF" }}>
                <Columns3 className="w-3.5 h-3.5" style={{ color: "#0A77FF" }} />
              </div>
              <span className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>Columns</span>
              <span className="inline-flex items-center text-[11px] tabular-nums px-2 py-[2px] rounded-full" style={{ fontWeight: 600, color: "#0A77FF", backgroundColor: "#EDF4FF" }}>
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
            <input
              placeholder="Search columns…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-8 h-[30px] text-xs bg-white border border-border/60 rounded-md outline-none focus:ring-2 focus:ring-ring/20 placeholder:text-muted-foreground/40"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-muted/60 text-muted-foreground/40 hover:text-muted-foreground transition-colors cursor-pointer">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1">
            <button onClick={showAll} className="inline-flex items-center gap-1 text-[11px] px-2 py-[3px] rounded-md hover:bg-[#EDF4FF] transition-colors cursor-pointer" style={{ fontWeight: 500, color: "#0A77FF" }}>
              <Eye className="w-3 h-3" /> Show All
            </button>
            <button onClick={hideAll} className="inline-flex items-center gap-1 text-[11px] px-2 py-[3px] rounded-md hover:bg-muted/60 text-muted-foreground transition-colors cursor-pointer" style={{ fontWeight: 500 }}>
              <EyeOff className="w-3 h-3" /> Hide All
            </button>
            <div className="flex-1" />
            <button onClick={reset} className="inline-flex items-center gap-1 text-[11px] px-2 py-[3px] rounded-md hover:bg-muted/60 text-muted-foreground transition-colors cursor-pointer" style={{ fontWeight: 500 }}>
              <RotateCcw className="w-3 h-3" /> Reset
            </button>
          </div>
        </div>

        {/* Column list */}
        <div className="flex-1 min-h-0 overflow-y-auto" ref={listRef}>
          {/* Pinned columns */}
          {locked.length > 0 && !search && (
            <>
              <div className="px-3.5 pt-2.5 pb-1">
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground/50" style={{ fontWeight: 600 }}>Pinned</span>
              </div>
              {locked.map(col => (
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

          {!search && (
            <div className="px-3.5 pt-2 pb-1">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground/50" style={{ fontWeight: 600 }}>Columns</span>
            </div>
          )}

          {search && filtered.length > 0 && (
            <div className="px-3.5 pt-2 pb-1">
              <span className="text-[11px] text-muted-foreground/50" style={{ fontWeight: 500 }}>{filtered.length} result{filtered.length !== 1 ? "s" : ""}</span>
            </div>
          )}

          {filtered.map(col => {
            const isDragging = draggingKey === col.key;
            return (
              <div
                key={col.key}
                data-col-key={col.key}
                ref={el => { if (el) rowRefs.current.set(col.key, el); else rowRefs.current.delete(col.key); }}
                className="mx-1.5 select-none"
              >
                <div className={`group/item flex items-center gap-2 px-2 py-[7px] rounded-md transition-all duration-150 ${
                  isDragging ? "bg-[#0A77FF]/[0.04] border border-dashed border-[#0A77FF]/25 opacity-40 scale-[0.97]" : "hover:bg-muted/30 border border-transparent"
                }`}>
                  <div
                    onPointerDown={e => handlePointerDown(e, col.key)}
                    className={`w-[18px] h-[18px] rounded flex items-center justify-center shrink-0 transition-colors ${search ? "opacity-30 cursor-not-allowed" : "cursor-grab hover:bg-muted/50"}`}
                    style={{ touchAction: "none" }}
                  >
                    <GripVertical className="w-3 h-3 text-muted-foreground/30 group-hover/item:text-muted-foreground/50" />
                  </div>

                  <span className={`flex-1 text-[12.5px] truncate transition-colors ${col.visible ? "text-foreground" : "text-muted-foreground/40"}`} style={{ fontWeight: 450 }}>
                    {col.label}
                  </span>

                  <button
                    onClick={() => toggleColumn(col.key)}
                    className={`w-[18px] h-[18px] rounded flex items-center justify-center shrink-0 transition-all ${
                      col.visible ? "text-[#0A77FF] hover:bg-[#EDF4FF]" : "text-muted-foreground/25 hover:bg-muted/50 hover:text-muted-foreground/50"
                    }`}
                  >
                    {col.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="text-center text-muted-foreground/40 text-xs py-8 px-4">No columns match search.</div>
          )}
        </div>

        {/* Footer hint */}
        <div className="border-t border-border px-3.5 py-2.5">
          <span className="text-[10px] text-muted-foreground/40" style={{ fontWeight: 500 }}>Drag to reorder · Toggle eye to show/hide</span>
        </div>
      </div>

      {/* Floating drag preview */}
      {draggingKey && draggingLabel && previewPos && createPortal(
        <div
          style={{
            position: "fixed", left: previewPos.x + 14, top: previewPos.y - 16,
            zIndex: 9999, pointerEvents: "none",
            display: "flex", alignItems: "center", gap: 6,
            padding: "5px 12px", background: "white",
            border: "1.5px solid #0A77FF", borderRadius: 6,
            boxShadow: "0 4px 20px rgba(0,0,0,0.08)", opacity: 0.92,
            fontSize: "12.5px", fontWeight: 500, color: "#0A77FF", whiteSpace: "nowrap",
          }}
        >
          <GripVertical className="w-3 h-3" style={{ opacity: 0.5 }} />
          {draggingLabel}
        </div>,
        document.body
      )}
    </>
  );
}
