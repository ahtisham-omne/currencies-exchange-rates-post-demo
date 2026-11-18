/**
 * useColumnDrag: Pointer-event column reorder with FLIP slide animation.
 *
 * Adapted from the vendor table draggable-column-system.
 * Cursor tracking is decoupled from React state, the floating preview is
 * positioned via direct DOM writes. React only re-renders on:
 *   - drag start  (1 render)
 *   - column swap (1 render per swap, for FLIP)
 *   - drag end    (1 render)
 *
 * Draggable columns are identified by `data-drag-col` attribute.
 */

import { useRef, useState, useCallback, useEffect, useLayoutEffect } from "react";
import type React from "react";

/* ─── Types ─── */
export interface DragState {
  key: string;
  currentIndex: number;
  width: number;
  label: string | React.ReactNode;
}

/* ─── Constants ─── */
const DRAG_COL_ATTR = "data-drag-col";
const DRAG_COL_TH_SELECTOR = `th[${DRAG_COL_ATTR}]`;

/* ─── Options ─── */
interface ColumnDragOptions {
  dragThreshold?: number;
  edgeZone?: number;
  maxScrollSpeed?: number;
  flipDuration?: number;
  flipEasing?: string;
}

/* ─── Hook ─── */
export function useColumnDrag(
  columns: { key: string; label: string | React.ReactNode; width: number }[],
  moveColumn: (from: number, to: number) => void,
  scrollContainerRef: React.RefObject<HTMLElement | null>,
  options?: ColumnDragOptions
) {
  const {
    dragThreshold = 3,
    edgeZone = 80,
    maxScrollSpeed = 20,
    flipDuration = 150,
    flipEasing = "cubic-bezier(0.25, 1, 0.5, 1)",
  } = options ?? {};

  const [dragState, setDragState] = useState<DragState | null>(null);
  const previewElRef = useRef<HTMLDivElement | null>(null);

  // Mutable refs for tight pointer-move loop
  const columnsRef = useRef(columns);
  columnsRef.current = columns;
  const moveColumnRef = useRef(moveColumn);
  moveColumnRef.current = moveColumn;
  const sessionRef = useRef<(DragState & { startX: number; startY: number }) | null>(null);
  const scrollRafRef = useRef<number | null>(null);
  const scrollSpeedRef = useRef(0);
  const lastSwapTimeRef = useRef(0);
  const flipSnapshotRef = useRef<Map<string, number>>(new Map());

  /* ─── Edge scroll rAF loop ─── */
  const startEdgeScroll = useCallback(() => {
    if (scrollRafRef.current !== null) return;
    const tick = () => {
      const el = scrollContainerRef.current;
      if (!el || scrollSpeedRef.current === 0) {
        scrollRafRef.current = null;
        return;
      }
      el.scrollLeft += scrollSpeedRef.current;
      scrollRafRef.current = requestAnimationFrame(tick);
    };
    scrollRafRef.current = requestAnimationFrame(tick);
  }, [scrollContainerRef]);

  const stopEdgeScroll = useCallback(() => {
    scrollSpeedRef.current = 0;
    if (scrollRafRef.current !== null) {
      cancelAnimationFrame(scrollRafRef.current);
      scrollRafRef.current = null;
    }
  }, []);

  /* ─── Snapshot draggable-column left positions before a swap ─── */
  const snapshotColumnPositions = useCallback(() => {
    const scrollEl = scrollContainerRef.current;
    if (!scrollEl) return;
    const ths = scrollEl.querySelectorAll<HTMLElement>(DRAG_COL_TH_SELECTOR);
    const map = new Map<string, number>();
    ths.forEach((th) => {
      const key = th.getAttribute(DRAG_COL_ATTR);
      if (key) map.set(key, th.getBoundingClientRect().left);
    });
    flipSnapshotRef.current = map;
  }, [scrollContainerRef]);

  /* ─── FLIP: apply after React commits a column reorder ─── */
  useLayoutEffect(() => {
    const snapshot = flipSnapshotRef.current;
    if (!snapshot.size) return;

    const scrollEl = scrollContainerRef.current;
    if (!scrollEl) {
      snapshot.clear();
      return;
    }

    const ths = scrollEl.querySelectorAll<HTMLElement>(DRAG_COL_TH_SELECTOR);
    const trs = scrollEl.querySelectorAll("tbody tr");

    type FlipEntry = { delta: number; th: HTMLElement; tds: HTMLElement[] };
    const entries: FlipEntry[] = [];

    ths.forEach((th) => {
      const key = th.getAttribute(DRAG_COL_ATTR);
      if (!key) return;
      const prevLeft = snapshot.get(key);
      if (prevLeft === undefined) return;

      const newLeft = th.getBoundingClientRect().left;
      const delta = prevLeft - newLeft;
      if (Math.abs(delta) < 0.5) return;

      const tds: HTMLElement[] = [];
      trs.forEach((tr) => {
        const td = tr.querySelector<HTMLElement>(`td[${DRAG_COL_ATTR}="${key}"]`);
        if (td) tds.push(td);
      });

      entries.push({ delta, th, tds });
    });

    snapshot.clear();
    if (entries.length === 0) return;

    // Invert
    entries.forEach(({ delta, th, tds }) => {
      th.style.transition = "none";
      th.style.transform = `translateX(${delta}px)`;
      tds.forEach((td) => {
        td.style.transition = "none";
        td.style.transform = `translateX(${delta}px)`;
      });
    });

    // Force reflow
    void scrollEl.offsetHeight;

    // Play
    requestAnimationFrame(() => {
      entries.forEach(({ th, tds }) => {
        th.style.transition = `transform ${flipDuration}ms ${flipEasing}`;
        th.style.transform = "";
        tds.forEach((td) => {
          td.style.transition = `transform ${flipDuration}ms ${flipEasing}`;
          td.style.transform = "";
        });
      });

      setTimeout(() => {
        entries.forEach(({ th, tds }) => {
          th.style.transition = "";
          th.style.transform = "";
          tds.forEach((td) => {
            td.style.transition = "";
            td.style.transform = "";
          });
        });
      }, flipDuration + 10);
    });
  }, [columns, scrollContainerRef, flipDuration, flipEasing]);

  /* ─── Pointer down handler ─── */
  const onHeaderPointerDown = useCallback(
    (e: React.PointerEvent, index: number) => {
      if (e.button !== 0) return;
      e.preventDefault();

      const col = columnsRef.current[index];
      if (!col) return;

      const startX = e.clientX;
      const startY = e.clientY;
      let activated = false;

      const pending = {
        key: col.key,
        currentIndex: index,
        width: col.width,
        label: col.label,
        startX,
        startY,
      };

      const onPointerMove = (ev: PointerEvent) => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;

        if (!activated) {
          if (Math.abs(dx) + Math.abs(dy) < dragThreshold) return;
          activated = true;
          document.body.style.userSelect = "none";
          document.body.style.cursor = "grabbing";
          sessionRef.current = { ...pending };
          setDragState({
            key: pending.key,
            currentIndex: pending.currentIndex,
            width: pending.width,
            label: pending.label,
          });
        }

        const session = sessionRef.current;
        if (!session) return;

        // Position preview pill via direct DOM write
        const el = previewElRef.current;
        if (el) {
          el.style.left = `${ev.clientX + 12}px`;
          el.style.top = `${ev.clientY - 14}px`;
          el.style.display = "";
        }

        // Live column reorder via DOM hit-testing
        const scrollEl = scrollContainerRef.current;
        if (scrollEl) {
          const dragThs = scrollEl.querySelectorAll<HTMLElement>(DRAG_COL_TH_SELECTOR);
          const cursorX = ev.clientX;

          for (let i = 0; i < dragThs.length; i++) {
            if (i === session.currentIndex) continue;
            const rect = dragThs[i].getBoundingClientRect();
            if (cursorX >= rect.left && cursorX < rect.right) {
              const now = performance.now();
              if (now - lastSwapTimeRef.current < flipDuration) break;
              lastSwapTimeRef.current = now;

              snapshotColumnPositions();
              moveColumnRef.current(session.currentIndex, i);
              session.currentIndex = i;
              setDragState({
                key: session.key,
                currentIndex: i,
                width: session.width,
                label: session.label,
              });
              break;
            }
          }

          // Edge scrolling
          const containerRect = scrollEl.getBoundingClientRect();
          const distFromLeft = ev.clientX - containerRect.left;
          const distFromRight = containerRect.right - ev.clientX;

          let speed = 0;
          if (distFromLeft < edgeZone && distFromLeft >= 0) {
            const ratio = 1 - distFromLeft / edgeZone;
            speed = -(ratio * ratio * maxScrollSpeed);
          } else if (distFromRight < edgeZone && distFromRight >= 0) {
            const ratio = 1 - distFromRight / edgeZone;
            speed = ratio * ratio * maxScrollSpeed;
          }

          if (speed !== 0 && scrollSpeedRef.current === 0) {
            scrollSpeedRef.current = speed;
            startEdgeScroll();
          } else if (speed === 0 && scrollSpeedRef.current !== 0) {
            stopEdgeScroll();
          } else {
            scrollSpeedRef.current = speed;
          }
        }
      };

      const onPointerUp = () => {
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
        stopEdgeScroll();
        sessionRef.current = null;
        setDragState(null);
      };

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
    },
    [scrollContainerRef, startEdgeScroll, stopEdgeScroll, snapshotColumnPositions, dragThreshold, edgeZone, maxScrollSpeed, flipDuration]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => stopEdgeScroll();
  }, [stopEdgeScroll]);

  return {
    dragState,
    draggedIndex: dragState?.currentIndex ?? null,
    onHeaderPointerDown,
    previewElRef,
  };
}