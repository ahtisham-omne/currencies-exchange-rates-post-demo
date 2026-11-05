/**
 * Isolated test of the plan-hit-button drag pattern used by
 * PlannerGapGraph.tsx. Mirrors the button's event handlers 1-for-1 so
 * the pipeline can be validated without needing Recharts / jsdom SVG
 * geometry. The goal is to answer: "does the pointerdown → pointercapture
 * → pointermove → onMoveEvent chain actually work?"
 */

import { describe, it, expect, vi } from "vitest";
import { render, act } from "@testing-library/react";
import { useRef, useState, useEffect } from "react";

interface DragButtonProps {
  day: number;
  dragId?: string;
  onMoveEvent: (id: string, day: number) => void;
  dayFromClientX: (clientX: number) => number | null;
  /** Bump this to force a re-render of the button (simulates parent
   *  state changes during drag). */
  renderTick?: number;
}

/** Copy of the plan-hit-button drag logic from PlannerGapGraph.tsx:2716-2762 —
 *  refs + state exactly mirror the production component. */
function DragButton({ day, dragId, onMoveEvent, dayFromClientX, renderTick }: DragButtonProps) {
  const dotDragRef = useRef(false);
  const dragActiveRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragIdRef = useRef<string | null>(null);
  const clickSwallowRef = useRef(false);
  const [armedDay, setArmedDay] = useState<number | null>(null);

  return (
    <button
      data-testid="plan-hit"
      data-armed={armedDay === day ? "true" : "false"}
      data-tick={renderTick ?? 0}
      style={{ cursor: dragId ? (armedDay === day ? "grabbing" : "grab") : "pointer" }}
      onPointerDown={(e) => {
        if (!dragId) return;
        e.preventDefault();
        e.stopPropagation();
        try {
          (e.currentTarget as HTMLButtonElement).setPointerCapture(e.pointerId);
        } catch { /* jsdom may not support setPointerCapture; test still valid */ }
        dotDragRef.current = false;
        dragActiveRef.current = true;
        setArmedDay(day);
        dragStartXRef.current = e.clientX;
        dragIdRef.current = dragId;
      }}
      onPointerMove={(e) => {
        if (!dragActiveRef.current || !dragIdRef.current) return;
        if (
          !dotDragRef.current &&
          Math.abs(e.clientX - dragStartXRef.current) > 2
        ) {
          dotDragRef.current = true;
          clickSwallowRef.current = true;
        }
        if (!dotDragRef.current) return;
        const d = dayFromClientX(e.clientX);
        if (d != null) onMoveEvent(dragIdRef.current, d);
      }}
      onPointerUp={(e) => {
        try {
          (e.currentTarget as HTMLButtonElement).releasePointerCapture(e.pointerId);
        } catch { /* pointer already released */ }
        dragActiveRef.current = false;
        dragIdRef.current = null;
        setArmedDay(null);
        setTimeout(() => { dotDragRef.current = false; }, 0);
      }}
    />
  );
}

/** Synthetic PointerEvent — jsdom exposes it, but the constructor
 *  accepts a narrow shape. We include the fields the drag logic reads. */
function pointerEvent(type: string, clientX: number, pointerId = 1): PointerEvent {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ev = new Event(type, { bubbles: true, cancelable: true }) as any;
  ev.clientX = clientX;
  ev.pointerId = pointerId;
  ev.button = 0;
  ev.pointerType = "mouse";
  return ev as PointerEvent;
}

describe("plan-hit-button drag pattern", () => {
  it("fires onMoveEvent with the derived day after pointer moves past threshold", () => {
    const onMove = vi.fn();
    const dayFromClientX = (x: number) => Math.round(x);
    const { getByTestId } = render(
      <DragButton
        day={5}
        dragId="proposed-vendor-A"
        onMoveEvent={onMove}
        dayFromClientX={dayFromClientX}
      />,
    );
    const btn = getByTestId("plan-hit") as HTMLButtonElement;

    expect(btn.dataset.armed).toBe("false");
    expect(btn.style.cursor).toBe("grab");

    act(() => {
      btn.dispatchEvent(pointerEvent("pointerdown", 100));
    });
    expect(btn.dataset.armed).toBe("true");
    expect(btn.style.cursor).toBe("grabbing");

    act(() => {
      btn.dispatchEvent(pointerEvent("pointermove", 101));
    });
    expect(onMove).not.toHaveBeenCalled();

    act(() => {
      btn.dispatchEvent(pointerEvent("pointermove", 130));
    });
    expect(onMove).toHaveBeenCalledWith("proposed-vendor-A", 130);

    act(() => {
      btn.dispatchEvent(pointerEvent("pointermove", 150));
    });
    expect(onMove).toHaveBeenCalledWith("proposed-vendor-A", 150);

    act(() => {
      btn.dispatchEvent(pointerEvent("pointerup", 150));
    });
    expect(btn.dataset.armed).toBe("false");
  });

  it("no-ops when dragId is undefined", () => {
    const onMove = vi.fn();
    const { getByTestId } = render(
      <DragButton
        day={5}
        dragId={undefined}
        onMoveEvent={onMove}
        dayFromClientX={() => 42}
      />,
    );
    const btn = getByTestId("plan-hit") as HTMLButtonElement;
    expect(btn.style.cursor).toBe("pointer");
    act(() => {
      btn.dispatchEvent(pointerEvent("pointerdown", 100));
      btn.dispatchEvent(pointerEvent("pointermove", 200));
      btn.dispatchEvent(pointerEvent("pointerup", 200));
    });
    expect(onMove).not.toHaveBeenCalled();
  });

  it("does NOT fire onMoveEvent when dayFromClientX returns null (geom not ready) — silent-failure trap", () => {
    const onMove = vi.fn();
    const { getByTestId } = render(
      <DragButton
        day={5}
        dragId="proposed-vendor-A"
        onMoveEvent={onMove}
        dayFromClientX={() => null}
      />,
    );
    const btn = getByTestId("plan-hit") as HTMLButtonElement;
    act(() => {
      btn.dispatchEvent(pointerEvent("pointerdown", 100));
      btn.dispatchEvent(pointerEvent("pointermove", 200));
    });
    expect(onMove).not.toHaveBeenCalled();
  });

  it("still fires onMoveEvent after the setArmedDay re-render", () => {
    const onMove = vi.fn();
    const { getByTestId } = render(
      <DragButton
        day={5}
        dragId="proposed-vendor-A"
        onMoveEvent={onMove}
        dayFromClientX={(x) => Math.round(x)}
      />,
    );
    const btn = getByTestId("plan-hit") as HTMLButtonElement;
    act(() => {
      btn.dispatchEvent(pointerEvent("pointerdown", 100));
    });
    expect(btn.dataset.armed).toBe("true");
    act(() => {
      btn.dispatchEvent(pointerEvent("pointermove", 150));
    });
    expect(onMove).toHaveBeenCalledWith("proposed-vendor-A", 150);
  });

  it("survives parent-driven re-render mid-drag (refs persist across renders)", () => {
    const onMove = vi.fn();
    let bumpRender = () => {};
    function Parent() {
      const [tick, setTick] = useState(0);
      useEffect(() => { bumpRender = () => setTick((t) => t + 1); });
      return (
        <DragButton
          day={5}
          dragId="proposed-vendor-A"
          onMoveEvent={onMove}
          dayFromClientX={(x) => Math.round(x)}
          renderTick={tick}
        />
      );
    }
    const { getByTestId } = render(<Parent />);
    const btn = getByTestId("plan-hit") as HTMLButtonElement;
    expect(btn.dataset.tick).toBe("0");
    act(() => {
      btn.dispatchEvent(pointerEvent("pointerdown", 100));
    });
    // Simulate a parent re-render mid-drag (e.g. a hover state change,
    // a proposedArrival Map update).
    act(() => { bumpRender(); });
    expect(btn.dataset.tick).toBe("1");
    act(() => {
      btn.dispatchEvent(pointerEvent("pointermove", 150));
    });
    expect(onMove).toHaveBeenCalledWith("proposed-vendor-A", 150);
  });

  it("BUG PROBE: refs get reset if the button UNMOUNTS + remounts between pointerdown and pointermove", () => {
    /* Production symptom: cursor shows grab + armed halo appears
       (proving pointerdown fired), but subsequent pointermove doesn't
       reschedule. If the button unmounts (e.g. userAddedDays no longer
       includes `day`) and remounts, the refs reset to their initial
       values. We show that explicitly here. */
    const onMove = vi.fn();
    let unmount = () => {};
    function Parent() {
      const [visible, setVisible] = useState(true);
      useEffect(() => { unmount = () => setVisible(false); });
      return visible ? (
        <DragButton
          day={5}
          dragId="proposed-vendor-A"
          onMoveEvent={onMove}
          dayFromClientX={(x) => Math.round(x)}
        />
      ) : null;
    }
    const { queryByTestId } = render(<Parent />);
    const btn = queryByTestId("plan-hit") as HTMLButtonElement;
    act(() => { btn.dispatchEvent(pointerEvent("pointerdown", 100)); });
    expect(btn.dataset.armed).toBe("true");
    // Unmount + remount would blow away refs. This is what a
    // clusterData recompute that transiently drops the day would do.
    act(() => { unmount(); });
    // Button gone → pointermove has no target.
    expect(queryByTestId("plan-hit")).toBeNull();
    expect(onMove).not.toHaveBeenCalled();
  });
});

/* ─── Document-level fix: attach pointermove/pointerup to `document`
   so drag survives button unmount. This is the production fix
   applied in PlannerGapGraph.tsx. */

interface DocDragButtonProps {
  day: number;
  dragId?: string;
  onMoveEvent: (id: string, day: number) => void;
  dayFromClientX: (clientX: number) => number | null;
}

/** Copy of the production drag flow AFTER the 2026-07-13 fix — uses
 *  document listeners with a captured `dragId` so the drag doesn't
 *  care if the button unmounts partway through. */
function DocDragButton({ day, dragId, onMoveEvent, dayFromClientX }: DocDragButtonProps) {
  const dotDragRef = useRef(false);
  const dragActiveRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragIdRef = useRef<string | null>(null);
  const [armedDay, setArmedDay] = useState<number | null>(null);
  return (
    <button
      data-testid="doc-hit"
      data-armed={armedDay === day ? "true" : "false"}
      onPointerDown={(e) => {
        if (!dragId) return;
        e.preventDefault();
        dotDragRef.current = false;
        dragActiveRef.current = true;
        setArmedDay(day);
        dragStartXRef.current = e.clientX;
        dragIdRef.current = dragId;
        const capturedId = dragId;
        const onMove = (ev: PointerEvent) => {
          if (!dragActiveRef.current) return;
          if (
            !dotDragRef.current &&
            Math.abs(ev.clientX - dragStartXRef.current) > 2
          ) {
            dotDragRef.current = true;
          }
          if (!dotDragRef.current) return;
          const d = dayFromClientX(ev.clientX);
          if (d != null) onMoveEvent(capturedId, d);
        };
        const onUp = () => {
          document.removeEventListener("pointermove", onMove);
          document.removeEventListener("pointerup", onUp);
          dragActiveRef.current = false;
          dragIdRef.current = null;
          setArmedDay(null);
        };
        document.addEventListener("pointermove", onMove);
        document.addEventListener("pointerup", onUp);
      }}
    />
  );
}

describe("plan-hit-button drag pattern (document-level fix)", () => {
  it("delivers onMoveEvent even after the button UNMOUNTS mid-drag", () => {
    /* This is the exact scenario the previous BUG PROBE flagged. With
       the doc-level fix the drag continues via document listeners even
       after the button element is removed from the DOM. */
    const onMove = vi.fn();
    let unmount = () => {};
    function Parent() {
      const [visible, setVisible] = useState(true);
      useEffect(() => { unmount = () => setVisible(false); });
      return visible ? (
        <DocDragButton
          day={5}
          dragId="proposed-vendor-A"
          onMoveEvent={onMove}
          dayFromClientX={(x) => Math.round(x)}
        />
      ) : null;
    }
    const { queryByTestId } = render(<Parent />);
    const btn = queryByTestId("doc-hit") as HTMLButtonElement;
    act(() => { btn.dispatchEvent(pointerEvent("pointerdown", 100)); });
    expect(btn.dataset.armed).toBe("true");
    // Unmount the button — production equivalent is userAddedDays no
    // longer including this day after a state change.
    act(() => { unmount(); });
    expect(queryByTestId("doc-hit")).toBeNull();
    // Move happens on `document` — no button needed.
    act(() => {
      document.dispatchEvent(pointerEvent("pointermove", 150));
    });
    expect(onMove).toHaveBeenCalledWith("proposed-vendor-A", 150);
    act(() => {
      document.dispatchEvent(pointerEvent("pointerup", 150));
    });
  });

  it("delivers onMoveEvent normally when the button stays mounted", () => {
    const onMove = vi.fn();
    const { getByTestId } = render(
      <DocDragButton
        day={5}
        dragId="proposed-vendor-A"
        onMoveEvent={onMove}
        dayFromClientX={(x) => Math.round(x)}
      />,
    );
    const btn = getByTestId("doc-hit") as HTMLButtonElement;
    act(() => { btn.dispatchEvent(pointerEvent("pointerdown", 100)); });
    act(() => { document.dispatchEvent(pointerEvent("pointermove", 130)); });
    expect(onMove).toHaveBeenCalledWith("proposed-vendor-A", 130);
    act(() => { document.dispatchEvent(pointerEvent("pointermove", 200)); });
    expect(onMove).toHaveBeenCalledWith("proposed-vendor-A", 200);
    act(() => { document.dispatchEvent(pointerEvent("pointerup", 200)); });
  });

  it("cleans up document listeners on pointerup (no leak between drags)", () => {
    const onMove = vi.fn();
    const { getByTestId } = render(
      <DocDragButton
        day={5}
        dragId="proposed-vendor-A"
        onMoveEvent={onMove}
        dayFromClientX={(x) => Math.round(x)}
      />,
    );
    const btn = getByTestId("doc-hit") as HTMLButtonElement;
    act(() => { btn.dispatchEvent(pointerEvent("pointerdown", 100)); });
    act(() => { document.dispatchEvent(pointerEvent("pointermove", 150)); });
    act(() => { document.dispatchEvent(pointerEvent("pointerup", 150)); });
    onMove.mockClear();
    // Post-up pointermove on document should be a no-op — listener removed.
    act(() => { document.dispatchEvent(pointerEvent("pointermove", 300)); });
    expect(onMove).not.toHaveBeenCalled();
  });
});
