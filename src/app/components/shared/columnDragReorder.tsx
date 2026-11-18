/**
 * Drag reorder for the Export modals' "Columns to Include" list.
 *
 * Mirrors the Financial Reporting "Selected Columns" drag (lovely-ledger
 * ColumnPicker): native Pointer Events on `window`, a 5px activation threshold,
 * the dragged row replaced in the list by a dashed drop slot, a floating ghost
 * card that rides the pointer, midpoint hit testing, auto-scroll near the list
 * edges, and locked rows excluded from dragging and from drop positions.
 * Extract: _crossref/extracts/lovely-ledger/selected-columns-drag-and-drop.md
 */
import { useCallback, useRef, useState } from "react";
import type { CSSProperties, RefObject } from "react";
import { createPortal } from "react-dom";
import { CornerDownLeft, GripVertical } from "lucide-react";

const AUTO_SCROLL_ZONE = 40; // px from edge to trigger
const AUTO_SCROLL_MAX_SPEED = 12; // px per frame
const DRAG_THRESHOLD_PX = 5;
/** Fallback height for the drop slot before a card has been measured. */
const CARD_H = 42;
/** Sits above ModalShell (z 40/41) and the modal's tooltips (z 200). */
const GHOST_Z = 400;

/* role-zen has no primary-blue token (its --primary is near-black), so the
 * extract's resolved values are used directly. */
const PRIMARY = "#0A77FF";
const BLUE_200 = "#BFDBFE";
const BRAND_75 = "#EDF4FF";
const SLATE_900 = "#0F172A";

export interface DragCard {
  label: string;
  width: number;
  height: number;
}

interface UseColumnDragReorderArgs {
  /** Committed order of every row id in the list. */
  order: string[];
  /** Receives the new order on drop. */
  onCommit: (next: string[]) => void;
  lockedIds: Set<string>;
  labelFor: (id: string) => string;
  /** The scrolling list; every row inside carries `data-field-id`. */
  listRef: RefObject<HTMLDivElement | null>;
  /** Pointer released before the threshold: a plain click on the card. */
  onCardClick?: (id: string) => void;
}

export function useColumnDragReorder({
  order,
  onCommit,
  lockedIds,
  labelFor,
  listRef,
  onCardClick,
}: UseColumnDragReorderArgs) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  /** The card that rides the cursor, measured off the row it was lifted from. */
  const [dragCard, setDragCard] = useState<DragCard | null>(null);
  /** The list as it stands mid-drag. Committed on pointer-up. */
  const [liveOrder, setLiveOrder] = useState<string[] | null>(null);

  const draggedIdRef = useRef<string | null>(null);
  const liveOrderRef = useRef<string[] | null>(null);
  const committedRef = useRef(order);
  const ghostRef = useRef<HTMLDivElement | null>(null);
  /** Where inside the card the grab landed, so it does not jump to the cursor. */
  const grabOffsetRef = useRef({ x: 0, y: 0 });
  const pointerYRef = useRef(0);
  const autoScrollRafRef = useRef<number | null>(null);
  const callbacksRef = useRef({ onCommit, onCardClick, labelFor });
  draggedIdRef.current = draggedId;
  liveOrderRef.current = liveOrder;
  committedRef.current = order;
  callbacksRef.current = { onCommit, onCardClick, labelFor };

  const startAutoScroll = useCallback(() => {
    const tick = () => {
      const listEl = listRef.current;
      if (!listEl || !draggedIdRef.current) {
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
  }, [listRef]);

  const stopAutoScroll = useCallback(() => {
    if (autoScrollRafRef.current) {
      cancelAnimationFrame(autoScrollRafRef.current);
      autoScrollRafRef.current = null;
    }
  }, []);

  /* Compare the pointer against each row's midpoint, skipping the dragged row
     so its own slot is a deadzone. Locked rows are never a target, so nothing
     lands above the locked block at the front. */
  const projectOrder = useCallback(
    (clientY: number) => {
      const listEl = listRef.current;
      const id = draggedIdRef.current;
      if (!id) return;
      const base = committedRef.current.filter((k) => k !== id);

      let insertAt = base.length;
      if (listEl) {
        const rows = Array.from(listEl.querySelectorAll<HTMLElement>("[data-field-id]")).filter((r) => {
          const k = r.getAttribute("data-field-id");
          return k !== null && k !== id && !lockedIds.has(k);
        });
        let visibleAt = rows.length;
        for (let i = 0; i < rows.length; i++) {
          const rect = rows[i].getBoundingClientRect();
          if (clientY < rect.top + rect.height / 2) {
            visibleAt = i;
            break;
          }
        }
        const targetKey = visibleAt >= rows.length ? null : rows[visibleAt].getAttribute("data-field-id");
        insertAt = targetKey ? base.indexOf(targetKey) : base.length;
        if (insertAt < 0) insertAt = base.length;
      }

      const next = [...base];
      next.splice(insertAt, 0, id);
      setLiveOrder((prev) =>
        prev && prev.length === next.length && prev.every((k, i) => k === next[i]) ? prev : next,
      );
    },
    [listRef, lockedIds],
  );

  /* The lifted copy is moved by touching its transform directly rather than
     by re-rendering the modal sixty times a second. */
  const moveGhost = useCallback((clientX: number, clientY: number) => {
    pointerYRef.current = clientY;
    const el = ghostRef.current;
    if (!el) return;
    const { x, y } = grabOffsetRef.current;
    el.style.transform = `translate3d(${clientX - x}px, ${clientY - y}px, 0) rotate(-1.5deg)`;
  }, []);

  /* Card-wide pointerdown opens a drag-or-click session. Nothing commits to a
     drag until the pointer passes DRAG_THRESHOLD_PX. */
  const handleCardPointerDown = useCallback(
    (e: React.PointerEvent, id: string) => {
      if (e.button !== 0) return;
      if (lockedIds.has(id)) return;

      const startX = e.clientX;
      const startY = e.clientY;
      // Measured before the row is replaced by its slot.
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      let activated = false;

      const activateDrag = (clientX: number, clientY: number) => {
        activated = true;
        grabOffsetRef.current = { x: startX - rect.left, y: startY - rect.top };
        setDragCard({ label: callbacksRef.current.labelFor(id), width: rect.width, height: rect.height });
        setDraggedId(id);
        draggedIdRef.current = id;
        setLiveOrder(committedRef.current);
        moveGhost(clientX, clientY);
        startAutoScroll();
        document.body.style.userSelect = "none";
        document.body.style.cursor = "grabbing";
      };

      const handleMove = (ev: PointerEvent) => {
        if (!activated) {
          if (Math.abs(ev.clientX - startX) + Math.abs(ev.clientY - startY) < DRAG_THRESHOLD_PX) return;
          activateDrag(ev.clientX, ev.clientY);
        }
        moveGhost(ev.clientX, ev.clientY);
        projectOrder(ev.clientY);
      };

      const end = (commit: boolean) => {
        window.removeEventListener("pointermove", handleMove);
        window.removeEventListener("pointerup", handleUp);
        window.removeEventListener("pointercancel", handleCancel);
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
        if (activated) {
          const projected = liveOrderRef.current;
          if (commit && projected) callbacksRef.current.onCommit(projected);
          setDraggedId(null);
          draggedIdRef.current = null;
          setDragCard(null);
          setLiveOrder(null);
          stopAutoScroll();
        } else if (commit) {
          callbacksRef.current.onCardClick?.(id);
        }
      };
      const handleUp = () => end(true);
      const handleCancel = () => end(false);

      window.addEventListener("pointermove", handleMove);
      window.addEventListener("pointerup", handleUp);
      window.addEventListener("pointercancel", handleCancel);
    },
    [lockedIds, moveGhost, projectOrder, startAutoScroll, stopAutoScroll],
  );

  const renderedOrder = liveOrder ?? order;
  const draggedPosition = draggedId ? renderedOrder.indexOf(draggedId) + 1 || 1 : 0;

  /** List panel state while dragging: inset ring + faint wash, 150ms fade. */
  const listDragStyle: CSSProperties = {
    transition: "background-color .15s, box-shadow .15s",
    ...(draggedId
      ? {
          backgroundColor: "rgba(10,119,255,0.03)",
          boxShadow: "inset 0 0 0 2px rgba(10,119,255,0.22)",
        }
      : null),
  };

  return {
    draggedId,
    dragCard,
    liveOrder,
    ghostRef,
    handleCardPointerDown,
    listDragStyle,
    /** 1-based position of the dragged row in the live list. */
    draggedPosition,
    total: renderedOrder.length,
  };
}

/** The dashed slot that stands where the dragged row will land. */
export function ColumnDropSlot({
  id,
  height,
  position,
  total,
}: {
  id: string;
  height: number | undefined;
  position: number;
  total: number;
}) {
  return (
    <div
      data-field-id={id}
      className="flex items-center justify-center shrink-0 gap-1.5"
      style={{
        height: height ?? CARD_H,
        borderRadius: 10,
        border: "2px dashed rgba(10,119,255,0.55)",
        background: `color-mix(in srgb, ${PRIMARY} 7%, #FFFFFF)`,
        fontSize: 12.5,
        fontWeight: 600,
        color: PRIMARY,
      }}
    >
      <CornerDownLeft size={13} />
      Drop here · position {position} of {total}
    </div>
  );
}

/** The floating copy that rides the pointer. Portaled to <body> because
 *  ModalShell animates a transform, which would trap `position: fixed`. */
export function ColumnDragGhost({
  ghostRef,
  dragCard,
  position,
  total,
}: {
  ghostRef: RefObject<HTMLDivElement | null>;
  dragCard: DragCard | null;
  position: number;
  total: number;
}) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      ref={ghostRef}
      aria-hidden="true"
      className="items-center gap-2.5"
      style={{
        display: dragCard ? "flex" : "none",
        position: "fixed",
        top: 0,
        left: 0,
        zIndex: GHOST_Z,
        pointerEvents: "none",
        width: dragCard?.width,
        height: dragCard?.height,
        padding: "10px 12px",
        borderRadius: 10,
        background: "#FFFFFF",
        border: "1px solid rgba(10,119,255,0.45)",
        boxShadow: "0 16px 32px -8px rgba(0,0,0,0.26), 0 3px 8px rgba(0,0,0,0.10)",
      }}
    >
      <span
        className="shrink-0 flex items-center justify-center"
        style={{ width: 22, height: 22, color: PRIMARY }}
      >
        <GripVertical size={16} />
      </span>
      <span
        className="truncate flex-1 min-w-0"
        style={{ fontSize: 13, fontWeight: 600, color: SLATE_900 }}
      >
        {dragCard?.label}
      </span>
      <span
        className="shrink-0"
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: PRIMARY,
          background: BRAND_75,
          border: `1px solid ${BLUE_200}`,
          borderRadius: 9999,
          padding: "1px 8px",
          lineHeight: "16px",
        }}
      >
        {position} of {total}
      </span>
    </div>,
    document.body,
  );
}
