import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/* ══════════════════════════════════════════════════════════════════
   DescriptionReader — the hover card that shows a clamped description
   in full, extracted so every description in the module reads the same
   way instead of each one growing its own `more` / `less` toggle.

   The whole idea is that the text does not move. A clamped line is
   replaced in place by a card whose first line of text sits on the
   exact pixel the clamped text sat on, so the words appear to stay put
   while the rest of them arrive. That is why the card is positioned off
   the TEXT node rather than its container, minus the card's own chrome.

   Two consumers:
     • InlineDescriptionEditor — the record header, editable, so it
       passes a footer with the modified stamp and the edit hint.
     • ItemDescription — table cells and cards, read only, so it passes
       no footer and nothing suggests the text can be changed.

   Design reference: dev-sync-notes/inline-description-editor.{html,md,pdf}
   ══════════════════════════════════════════════════════════════════ */

export const FLOATER_BORDER = 1;
export const READER_PADDING_X = 12;
export const READER_PADDING_Y = 5;
export const READER_INSET_X = FLOATER_BORDER + READER_PADDING_X;
export const READER_INSET_Y = FLOATER_BORDER + READER_PADDING_Y;

/* Hover timings. The open delay is the point: without it, a pointer
   merely crossing a table on its way somewhere else flashes cards on
   every row it passes. The close delay lets the pointer travel off the
   line and into the card without it vanishing on the way. */
export const HOVER_OPEN_DELAY = 250;
export const HOVER_CLOSE_DELAY = 120;

export const FLOATER_MIN_WIDTH = 320;
export const READER_MAX_BODY = 320;
export const READER_MIN_BODY = 96;
/** Height of the optional footer row, reserved when fitting to the viewport. */
export const READER_FOOTER = 26;

export type FloaterPos = {
  top?: number;
  /** Set instead of `top` when the card is flipped above its anchor. */
  bottom?: number;
  left: number;
  width: number;
  bodyMaxHeight: number;
  side: "over" | "below" | "above";
};

/** Partner's hover-card offset from its trigger (`sideOffset={6}`, 48 uses). */
export const ADJACENT_OFFSET = 6;

/**
 * Where the card sits relative to the text it belongs to.
 *
 * `overlay` puts the card's first line of text on the anchor's text, so
 * the words do not move. That is the right signal for something about to
 * become an editable field, and the wrong one for something that is not:
 * a card sitting on the text reads as a promise that clicking will edit
 * it. So read-only descriptions use `adjacent` instead, which is
 * Partner's own hover-card placement — `side="bottom" align="start"`,
 * 6px off the trigger, flipped above when the room below runs out.
 */
export type ReaderPlacement = "overlay" | "adjacent";

/** Partner's hover-card elevation (`0 8px 30px rgba(0,0,0,.12)`, 40 uses). */
export function readerShell(): React.CSSProperties {
  return {
    background: "#FFFFFF",
    border: `${FLOATER_BORDER}px solid var(--border)`,
    borderRadius: 8,
    boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
    overflow: "hidden",
    position: "relative",
  };
}

/**
 * Where a floater goes so that its own text lands on the anchor's text.
 * `fit` is the vertical chrome it carries below that text, so the body
 * can be clamped to what is actually left on screen.
 */
export function measureFloater(
  container: HTMLElement | null,
  textEl: HTMLElement | null,
  fit: number,
  insetX: number,
  insetY: number,
  minWidth = FLOATER_MIN_WIDTH,
): Omit<FloaterPos, "side"> | null {
  if (!container) return null;
  const r = container.getBoundingClientRect();
  // Anything with no text line to sit on falls back to the container:
  // same left edge, one line tall, which is where its copy sits anyway.
  const t = textEl && textEl.getClientRects().length ? textEl.getBoundingClientRect() : r;
  const vW = window.innerWidth;
  const vH = window.innerHeight;
  // Same inset on both sides, so the floated text column is as wide as
  // the anchor's own text column and breaks lines in nearly the same place.
  const width = Math.min(Math.max(minWidth, r.width + insetX * 2), vW - 16);
  const left = Math.max(8, Math.min(t.left - insetX, vW - width - 8));
  const top = t.top - insetY;
  return { top, left, width, bodyMaxHeight: vH - top - fit - 16 };
}

export interface DescriptionReaderOptions {
  /** The prose to show in full. */
  text: string;
  /** Only true when something is actually clamped; nothing to reveal otherwise. */
  enabled: boolean;
  /** The clamped text node. The card anchors on this, not on the container. */
  textRef: React.RefObject<HTMLElement | null>;
  /** The row the card stands in for; used for width and for the clip test. */
  containerRef: React.RefObject<HTMLElement | null>;
  /** Rendered under the prose. Omit for a read-only description. */
  footer?: React.ReactNode;
  /** Called when the card itself is clicked, so the card is never a dead zone. */
  onClick?: (e: React.SyntheticEvent) => void;
  /** Suppress entirely, e.g. while an editor is open over the same row. */
  paused?: boolean;
  /** Minimum card width. Table cells want a narrower floor than the header. */
  minWidth?: number;
  /** Text style of the card body, matched to the anchor so nothing reflows. */
  bodyStyle?: React.CSSProperties;
  /** Extra right padding in the body, e.g. to clear a pinned corner icon. */
  bodyPaddingRight?: number;
  /** See ReaderPlacement. Defaults to the in-place overlay. */
  placement?: ReaderPlacement;
}

/**
 * Returns the handlers to spread on the anchor row, the portal node to
 * render, and a `close` for consumers that take over (an editor opening).
 */
export function useDescriptionReader({
  text, enabled, textRef, containerRef, footer, onClick,
  paused = false, minWidth = FLOATER_MIN_WIDTH, bodyStyle, bodyPaddingRight,
  placement = "overlay",
}: DescriptionReaderOptions) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<FloaterPos | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const openTimer = useRef<ReturnType<typeof setTimeout>>();
  const closeTimer = useRef<ReturnType<typeof setTimeout>>();
  /* Escape dismisses while the pointer is still on the row. Unmounting
     hands the row a fresh pointer-enter, which would re-open it instantly
     and make Escape look broken, so Escape latches until the pointer
     actually leaves. */
  const suppressed = useRef(false);

  useEffect(() => () => {
    if (openTimer.current) clearTimeout(openTimer.current);
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  // Nothing clamped any more means nothing left to reveal.
  useEffect(() => { if (!enabled) setOpen(false); }, [enabled]);
  useEffect(() => { if (paused) setOpen(false); }, [paused]);

  /* Opens ON the line, never under it, and grows downward. No flip-above:
     flipping would move the text off the line it is standing in for. */
  useLayoutEffect(() => {
    if (!open) return;
    const anchor = containerRef.current;
    if (!anchor) return;
    const fit = footer ? READER_FOOTER : 0;
    const clamp = (room: number) =>
      Math.max(READER_MIN_BODY, Math.min(READER_MAX_BODY, room));

    const update = () => {
      if (placement === "overlay") {
        const p = measureFloater(anchor, textRef.current, fit, READER_INSET_X, READER_INSET_Y, minWidth);
        if (!p) return;
        setPos({ ...p, bodyMaxHeight: clamp(p.bodyMaxHeight), side: "over" });
        return;
      }
      /* Adjacent: Partner's placement. Beside the row, never on it, so
         nothing about the card suggests the text is about to become
         editable. Left-aligned to the anchor (`align="start"`), flipped
         above when the space below cannot hold a useful card. */
      const r = anchor.getBoundingClientRect();
      const vW = window.innerWidth;
      const vH = window.innerHeight;
      const width = Math.min(Math.max(minWidth, r.width), vW - 16);
      const left = Math.max(8, Math.min(r.left, vW - width - 8));
      const below = vH - r.bottom - ADJACENT_OFFSET - fit - 16;
      const above = r.top - ADJACENT_OFFSET - fit - 16;
      if (below >= READER_MIN_BODY || below >= above) {
        setPos({ top: r.bottom + ADJACENT_OFFSET, left, width, bodyMaxHeight: clamp(below), side: "below" });
      } else {
        setPos({ bottom: vH - r.top + ADJACENT_OFFSET, left, width, bodyMaxHeight: clamp(above), side: "above" });
      }
    };
    update();
    const onScroll = (e: Event) => {
      // Scrolling *inside* the card must not reposition it.
      if (cardRef.current?.contains(e.target as Node)) return;
      update();
    };
    /* A collapsing header, or a scrolling table body, can clip the anchor
       to nothing via an ancestor's `overflow: hidden`. The anchor's own
       bounding box is unchanged by that clip, so only an
       IntersectionObserver — which intersects the target against every
       ancestor's clip rect — can tell that it has gone. Once it has,
       close: a card floating with nothing under it is worse than none. */
    const io = new IntersectionObserver(
      ([entry]) => { if (entry && !entry.isIntersecting) setOpen(false); },
      { threshold: 0 },
    );
    io.observe(anchor);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      io.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open, containerRef, textRef, footer, minWidth, placement]);

  // ESC dismisses. A click landing elsewhere drops it too.
  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (cardRef.current?.contains(t)) return;
      if (containerRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); suppressed.current = true; setOpen(false); }
    };
    document.addEventListener("mousedown", onMouseDown);
    /* Capture phase: the modal-shortcut hooks these pages mount register a
       capture-phase Escape handler that calls stopPropagation(), so a
       bubble-phase listener here would never see the key. */
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open, containerRef]);

  const clearTimers = useCallback(() => {
    if (openTimer.current) clearTimeout(openTimer.current);
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  const scheduleOpen = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    if (!enabled || paused || suppressed.current) return;
    openTimer.current = setTimeout(() => setOpen(true), HOVER_OPEN_DELAY);
  }, [enabled, paused]);

  const scheduleClose = useCallback(() => {
    if (openTimer.current) clearTimeout(openTimer.current);
    suppressed.current = false;   // the pointer left; the latch has served its purpose
    closeTimer.current = setTimeout(() => setOpen(false), HOVER_CLOSE_DELAY);
  }, []);

  const cancelClose = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  const close = useCallback(() => { clearTimers(); setOpen(false); }, [clearTimers]);

  const node = open && pos
    ? createPortal(
        <div
          ref={cardRef}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
          onClick={onClick}
          className="fixed z-[12400]"
          style={{
            ...(pos.side === "above" ? { bottom: pos.bottom } : { top: pos.top }),
            left: pos.left, width: pos.width,
            /* A pure opacity fade (Partner's `modal-overlay-in`). Nothing
               scales or slides, because any transform would move the text
               off the line it is standing in for. */
            animation: "modal-overlay-in 110ms ease-out forwards",
            cursor: onClick ? "pointer" : "default",
          }}
        >
          {/* Partner's 8px rotated square, pointing back at the row the
              card belongs to. Only for the adjacent placement: an overlay
              sits on its own text and has nothing to point at. */}
          {pos.side !== "over" && (
            <div
              className="absolute"
              style={{ left: 18, ...(pos.side === "below" ? { top: -4 } : { bottom: -4 }) }}
            >
              <div
                className="w-2 h-2 rotate-45 bg-white border-border/50"
                style={pos.side === "below"
                  ? { borderTopWidth: 1, borderLeftWidth: 1 }
                  : { borderBottomWidth: 1, borderRightWidth: 1 }}
              />
            </div>
          )}
          <div style={readerShell()}>
            <div
              className="overflow-y-auto"
              style={{
                maxHeight: pos.bodyMaxHeight,
                padding: `${READER_PADDING_Y}px ${bodyPaddingRight ?? READER_PADDING_X}px ${READER_PADDING_Y}px ${READER_PADDING_X}px`,
              }}
            >
              <p
                className="whitespace-pre-wrap break-words"
                style={{ margin: 0, fontSize: 12, lineHeight: 1.6, color: "#475569", ...bodyStyle }}
              >
                {text}
              </p>
            </div>
            {footer}
          </div>
        </div>,
        document.body,
      )
    : null;

  return { open, node, close, clearTimers, scheduleOpen, scheduleClose, cancelClose,
           rowHandlers: { onMouseEnter: scheduleOpen, onMouseLeave: scheduleClose } };
}
