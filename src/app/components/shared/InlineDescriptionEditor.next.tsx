/* ══════════════════════════════════════════════════════════════════
   SHELVED — not wired into the app.

   This is the hover-reader / click-to-edit-in-place version of the
   header description: the row holds one truncated line, hovering floats
   the full text forward on the same text origin, clicking turns it into
   an editable field in the same spot, and leaving a changed draft rings
   the card in --destructive and asks before discarding.

   It was backlogged in favour of the older more/less + pencil UI, which
   is what `InlineDescriptionEditor.tsx` now holds again. Nothing imports
   this file, so it does not ship; it is kept compiling so it does not
   rot while it waits.

   To bring it back:
     1. Replace the body of `InlineDescriptionEditor.tsx` with this file's
        (drop this header and rename the export back).
     2. In the header call sites, pass `lastModified` again — Quotes:
        `getQuoteDescriptionUpdatedAt(descriptionKey) ?? quote?.lastUpdated`;
        Sales Orders: `so.lastUpdated || so.createdDate`.
     3. Set the header wrapper's cap back to 48px. The old UI expands
        inline and needs the 2000px headroom; this one never grows.
   The `attention-shake` keyframe it uses is already in `theme.css`.
   Design reference: dev-sync-notes/inline-description-editor.{html,md,pdf}
   ══════════════════════════════════════════════════════════════════ */

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Clock, Pencil } from "lucide-react";

/* ════════════════════════════════════════════════════════════════
   InlineDescriptionEditor — the detail-header description, built as
   the desktop file-rename gesture rather than as a panel you open.

   Resting, the row is one line of text: Partner's
   `<p class="text-[12px] text-slate-500 leading-[1.6]">` plus
   `truncate`, so a long description ends in a native `…` and can
   never push the header past a single line.

   Hovering the row lights Partner's `hover:bg-muted` across it and
   floats the full description forward; clicking turns that into an
   editable field. Both surfaces open ON the text, not under it: their
   first line lands on the exact pixel the read line's text occupies,
   so the words never move. That is the whole trick behind renaming a
   file on Windows or macOS, and the reason the anchoring below
   measures `descRef` (the text) rather than its container, then
   subtracts its own chrome.

   The pencil lives on the reader and nowhere else. Putting one on the
   row too meant watching it fade up only to be covered a heartbeat
   later by the card carrying its own. It sits in the card's top
   corner, beside the first line, and is deliberately inert —
   `pointer-events: none`, `aria-hidden` — because it is a label, not a
   button: the target is the whole card. Nothing to hunt for and
   nothing to hit.

   Because the reader covers the row it also takes the click, so there
   is no dead zone: the line and the floated card both open the editor.

   Both floaters fade in on pure opacity. Nothing scales or slides,
   because any transform would move the text off the line it is
   standing in for.

   Nothing here carries a `title`. The browser renders those as its own
   tooltip after the pointer rests, which would surface a second, native
   label on top of the reader — so hints are `aria-label` only.
   ═══════════════════════════════════════════════════════════════ */

interface InlineDescriptionEditorProps {
  value: string;
  onChange: (next: string) => void;
  /** Read-only consumers can omit this (no pencil, no click-to-edit). */
  editable?: boolean;
  placeholder?: string;
  /** Characters allowed. Undefined means no limit, which is the default for a
   *  record description: the field is prose about the deal, and a ceiling on it
   *  only ever truncates something someone meant to write. */
  maxLength?: number;
  /** When the description was last edited, shown in the reader's footer.
   *  Seed it from the record's own updated-at; the component re-stamps it
   *  locally the moment the user saves an edit. Omit it and the footer's
   *  meta slot simply stays empty. */
  lastModified?: string | Date | null;
  className?: string;
}

/* Read row geometry. TEXT_BLEED lets the row's hover background sit a
   touch outside the text without shifting it, so the description stays
   optically aligned with the record number above. The row carries no
   pencil at all — see the reader below. */
const TEXT_BLEED = 6;

/* ── Landing both floaters on the read text ───────────────────────
   Each floating surface has chrome — a border, then padding — between
   its border-box origin and where its text actually starts. To put its
   first line of text on the read line, position it at
   (text origin − these insets), which is what keeps the words still.

   The two carry DIFFERENT padding, for a reason worth stating. Because
   a floater is anchored on its text, its top edge rises by
   (border + padding) — and the description row sits only 6px under the
   status pills. The editor is a surface someone sits in and types in,
   so it takes the roomier padding and accepts covering the pills while
   it is open. The reader only appears under the pointer, so it stays
   inside that 6px and never hides the pills behind it. Keep these in
   step with the padding literals in the JSX. */
const FLOATER_BORDER = 1;
const EDITOR_PADDING_X = 14;
const EDITOR_PADDING_Y = 10;
const READER_PADDING_X = 12;
const READER_PADDING_Y = 5;
const EDITOR_INSET_X = FLOATER_BORDER + EDITOR_PADDING_X;
const EDITOR_INSET_Y = FLOATER_BORDER + EDITOR_PADDING_Y;
const READER_INSET_X = FLOATER_BORDER + READER_PADDING_X;
const READER_INSET_Y = FLOATER_BORDER + READER_PADDING_Y;

/* Hover timings. The open delay is the point: without it, a pointer
   merely crossing the header on its way somewhere else flashes the card,
   and the reader fires on rows nobody meant to read. Partner's
   OverflowTooltip waits 180ms, which is right for a small pill you aim
   at deliberately; this row is the full width of the header and the card
   opens exactly on the text, so nothing travels and 180ms did not read
   as a pause at all. 250ms does, and still answers a deliberate hover
   immediately enough. The close delay lets the pointer travel off the
   line and into the card without it vanishing on the way. */
const HOVER_OPEN_DELAY = 250;
const HOVER_CLOSE_DELAY = 120;

const FLOATER_MIN_WIDTH = 320;
/** Text height past which the reader scrolls internally. */
const READER_MAX_BODY = 320;
const READER_MIN_BODY = 96;
/** The reader's footer row, subtracted when fitting it below the line. */
const READER_FOOTER = 26;
/** Textarea height bounds while editing. */
const EDITOR_MIN_BODY = 44;
const EDITOR_MAX_BODY = 320;
/** The editor's counter + Save/Discard row, same purpose as above. */
const EDITOR_FOOTER = 36;

/** `mm/dd/yyyy - HH:MM`. Returns null for anything unparseable so the
 *  meta slot renders nothing rather than "Invalid Date". */
function formatModified(value: string | Date): string | null {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getMonth() + 1)}/${p(d.getDate())}/${d.getFullYear()} - ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Where a floater goes: its border-box, derived from the read text's
 *  origin so its own text lands on top of that text. */
type FloaterPos = { top: number; left: number; width: number; bodyMaxHeight: number };

/* The shared chrome both floaters wear. White surface, hairline border,
   soft shadow, Partner's `overflowTooltipIn` entrance. The editor swaps
   the border for the primary glow Partner puts on an active description
   field. */
function floaterShell(active: boolean, danger = false): React.CSSProperties {
  /* State lives in the outline. Editing rings the card in --primary;
     an unanswered change rings it in --destructive. Nothing gets a
     coloured fill: Partner's own "needs attention" card is
     `border border-red-500/15 bg-white`, an outline on white, and a
     tinted band inside a card this small read as a warning stripe
     rather than as the card itself needing an answer.

     Both rings are the real token at an opacity that carries: Partner
     rings an active field at `ring-2 ring-primary/15`
     (CreatePartnerModal's description field), and 3px at 0.22 is what
     that idea needs to read against a white header rather than sink
     into it. */
  const ringColor = danger ? "rgba(220, 38, 38, 0.22)" : "rgba(10, 119, 255, 0.22)";
  const edge = danger ? "var(--destructive)" : active ? "var(--primary)" : "var(--border)";
  /* Two elevations, both Partner's. The reader takes the hover-card tier
     (`0 8px 30px rgba(0,0,0,0.12)`, 40 uses); the editor takes the modal
     tier (`0 24px 80px -12px rgba(0,0,0,0.25)`, 57 uses). The reader used
     to carry OverflowTooltip's much lighter tooltip shadow, which did not
     lift it off a white header at all. Keeping them on different tiers
     also says something true: one is a thing you glance at, the other is
     a thing you are working in. */
  return {
    background: "#FFFFFF",
    border: `${FLOATER_BORDER}px solid ${edge}`,
    borderRadius: 8,
    boxShadow: active || danger
      ? `0 0 0 3px ${ringColor}, 0 24px 80px -12px rgba(0,0,0,0.25)`
      : "0 8px 30px rgba(0,0,0,0.12)",
    overflow: "hidden",
  };
}

export function InlineDescriptionEditor({
  value,
  onChange,
  editable = true,
  placeholder = "Add a description...",
  maxLength,
  lastModified,
  className,
}: InlineDescriptionEditorProps) {
  const [editing, setEditing] = useState(false);
  const [readerOpen, setReaderOpen] = useState(false);
  const [needsTruncation, setNeedsTruncation] = useState(false);
  const [draft, setDraft] = useState(value);
  /* Stamped when the user saves, so the reader reflects the edit that
     just happened rather than waiting for the record to round-trip. */
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  /* Set when a click landed outside a changed draft. The card asks rather
     than throwing the edit away, because an outside click is as often a
     slip as it is an intention. */
  const [asking, setAsking] = useState(false);
  const [editorPos, setEditorPos] = useState<FloaterPos | null>(null);
  const [readerPos, setReaderPos] = useState<FloaterPos | null>(null);

  const descRef = useRef<HTMLParagraphElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const readerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const openTimer = useRef<ReturnType<typeof setTimeout>>();
  const closeTimer = useRef<ReturnType<typeof setTimeout>>();
  /* Escape dismisses the reader while the pointer is still sitting on
     the row. Unmounting it hands the row a fresh mouseenter, which would
     re-open it instantly and make Escape look broken — so Escape also
     latches the reader shut until the pointer actually leaves. */
  const suppressed = useRef(false);

  useEffect(() => { setDraft(value); }, [value]);

  useEffect(() => () => {
    if (openTimer.current) clearTimeout(openTimer.current);
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  /* Does the single line overflow its column? Partner tests the wrapped
     height (`scrollHeight > 22`); the width-wise equivalent is the right
     test for a `truncate`d row. A ResizeObserver rather than just a
     window listener because the app's nav rail collapses, which re-flows
     the header without ever firing a window resize. */
  useEffect(() => {
    const el = descRef.current;
    if (!el) return;
    const check = () => setNeedsTruncation(el.scrollWidth > el.clientWidth + 1);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    window.addEventListener("resize", check);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", check);
    };
  }, [value, editing]);

  // A description that no longer overflows has nothing left to reveal.
  useEffect(() => {
    if (!needsTruncation) setReaderOpen(false);
  }, [needsTruncation]);

  /* Measure the read text and hand back a floater box whose own text
     will sit exactly on it. `fit` is how much vertical chrome the
     floater carries below its text, so the body can be clamped to what
     is actually left on screen. */
  const measure = useCallback((fit: number, insetX: number, insetY: number): FloaterPos | null => {
    const box = containerRef.current;
    if (!box) return null;
    const r = box.getBoundingClientRect();
    // The empty state has no text line to sit on, so fall back to the
    // container — same left edge, one line tall, which is where the
    // placeholder copy sits anyway.
    const textEl = descRef.current;
    const t = textEl && textEl.getClientRects().length ? textEl.getBoundingClientRect() : r;
    const vW = window.innerWidth;
    const vH = window.innerHeight;
    // Same inset on both sides, so the floated text column is as wide as
    // the row's own text column and breaks lines in nearly the same place.
    const width = Math.min(
      Math.max(FLOATER_MIN_WIDTH, r.width + insetX * 2),
      vW - 16
    );
    const left = Math.max(8, Math.min(t.left - insetX, vW - width - 8));
    const top = t.top - insetY;
    const room = vH - top - fit - 16;
    return { top, left, width, bodyMaxHeight: room };
  }, []);

  /* ── Reader placement ─────────────────────────────────────────────
     Opens ON the line, never under it, and grows downward from there.
     No flip-above: flipping would move the text off the line it is
     supposed to be replacing, which is the one thing this must not do. */
  useLayoutEffect(() => {
    if (!readerOpen) return;
    const anchor = containerRef.current;
    if (!anchor) return;
    const update = () => {
      const pos = measure(READER_FOOTER, READER_INSET_X, READER_INSET_Y);
      if (!pos) return;
      setReaderPos({
        ...pos,
        bodyMaxHeight: Math.max(READER_MIN_BODY, Math.min(READER_MAX_BODY, pos.bodyMaxHeight)),
      });
    };
    update();
    const onScroll = (e: Event) => {
      // Scrolling *inside* the reader must not reposition it.
      if (readerRef.current?.contains(e.target as Node)) return;
      update();
    };
    /* Scrolling the page swaps the detail header into its compact form,
       which collapses the description row to zero height via an ancestor
       `max-height: 0; overflow: hidden`. The row's own bounding box is
       unchanged by that clip, so only an IntersectionObserver — which
       intersects the target against every ancestor's clip rect — can
       tell that the anchor has gone. Once it has, close: a surface
       floating over the page with nothing under it is worse than none. */
    const io = new IntersectionObserver(
      ([entry]) => { if (entry && !entry.isIntersecting) setReaderOpen(false); },
      { threshold: 0 }
    );
    io.observe(anchor);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      io.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [readerOpen, measure]);

  // ESC dismisses the reader. Click-outside is handled by the row's own
  // mouse-leave, but a click landing elsewhere should drop it too.
  useEffect(() => {
    if (!readerOpen) return;
    const onMouseDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (readerRef.current?.contains(t)) return;
      if (containerRef.current?.contains(t)) return;
      setReaderOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        suppressed.current = true;
        setReaderOpen(false);
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    // Capture phase: the modal-shortcut hooks the pages mount register a
    // capture-phase Escape handler that calls stopPropagation(), so a
    // bubble-phase listener here would never see the key.
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [readerOpen]);

  /* ── Editor placement ─────────────────────────────────────────────
     Identical anchoring to the reader, so clicking a hovered line does
     not shift the words by a single pixel — the field simply becomes
     editable where it already was. */
  useLayoutEffect(() => {
    if (!editing) return;
    const update = () => {
      const pos = measure(EDITOR_FOOTER, EDITOR_INSET_X, EDITOR_INSET_Y);
      if (pos) setEditorPos(pos);
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [editing, measure]);

  // Auto-grow the textarea as the draft changes, within the space left
  // on screen.
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    const ceiling = Math.max(
      EDITOR_MIN_BODY,
      Math.min(EDITOR_MAX_BODY, editorPos?.bodyMaxHeight ?? EDITOR_MAX_BODY)
    );
    el.style.height = "auto";
    el.style.height = `${Math.max(EDITOR_MIN_BODY, Math.min(ceiling, el.scrollHeight))}px`;
  }, [draft, editing, editorPos?.bodyMaxHeight]);

  const clearTimers = () => {
    if (openTimer.current) clearTimeout(openTimer.current);
    if (closeTimer.current) clearTimeout(closeTimer.current);
  };
  const scheduleOpen = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    if (!needsTruncation || editing || suppressed.current) return;
    openTimer.current = setTimeout(() => setReaderOpen(true), HOVER_OPEN_DELAY);
  };
  const scheduleClose = () => {
    if (openTimer.current) clearTimeout(openTimer.current);
    // The pointer has left, so an Escape-latch has served its purpose.
    suppressed.current = false;
    closeTimer.current = setTimeout(() => setReaderOpen(false), HOVER_CLOSE_DELAY);
  };
  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  };

  /* Committing an edit also re-stamps the modified time. */
  const commit = useCallback(() => {
    onChange(draft);
    setSavedAt(new Date());
    setAsking(false);
    setEditing(false);
  }, [draft, onChange]);

  const discard = useCallback(() => {
    setDraft(value);
    setAsking(false);
    setEditing(false);
  }, [value]);

  // Click-outside + ESC DISCARD the draft (no implicit save). Save only
  // happens on the Save button or ⌘/Ctrl+Enter — the explicit
  // Save / Discard contract every other modal in the app uses.
  useEffect(() => {
    if (!editing) return;
    const onMouseDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (editorRef.current?.contains(t)) return;
      if (containerRef.current?.contains(t)) return;
      /* An untouched draft has nothing to lose, so leaving just closes.
         A changed one turns the footer into a question instead: Partner
         would put this in a ConfirmationModal, but stacking a second
         dialog over a field this small costs more than it protects, so
         the card asks in the space it already occupies. */
      if (draft !== value) { setAsking(true); return; }
      discard();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (draft !== value) { setAsking(true); return; }
        discard();
      }
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); commit(); }
    };
    document.addEventListener("mousedown", onMouseDown);
    // Capture phase, same reason as the reader above.
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [editing, discard, commit, draft, value]);

  /* Clicking the line — or the pencil, or the floated reader — all land
     here. The reader retires so the two never stack. */
  const startEditing = (e: React.SyntheticEvent) => {
    if (!editable) return;
    e.stopPropagation();
    clearTimers();
    setReaderOpen(false);
    setAsking(false);
    setEditing(true);
  };

  const modifiedSource = savedAt ?? lastModified ?? null;
  const modifiedLabel = modifiedSource ? formatModified(modifiedSource) : null;

  /* ── Reader: the description floated forward, in place ──────────── */
  const reader = readerOpen && readerPos
    ? createPortal(
        <div
          ref={readerRef}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
          onClick={startEditing}
          className="fixed z-[12400]"
          style={{
            top: readerPos.top,
            left: readerPos.left,
            width: readerPos.width,
            /* A pure opacity fade (Partner's `modal-overlay-in`), NOT
               OverflowTooltip's entrance — that one scales and nudges
               upward, which would make these words shimmer into place
               when the whole point is that they do not move. */
            animation: "modal-overlay-in 110ms ease-out forwards",
            cursor: editable ? "pointer" : "default",
          }}
        >
          <div style={{ ...floaterShell(false), position: "relative" }}>
            {/* The text, and nothing above it — anything stacked on top
                would push these words off the line they are replacing.
                `whitespace-pre-wrap` keeps the paragraph breaks the
                author typed into the editor. */}
            <div
              className="overflow-y-auto"
              style={{
                maxHeight: readerPos.bodyMaxHeight,
                padding: `${READER_PADDING_Y}px ${READER_PADDING_X}px`,
              }}
            >
              <p className="text-[12px] text-slate-600 leading-[1.6] whitespace-pre-wrap break-words">
                {value}
              </p>
            </div>
            {/* Everything but the prose sits underneath it — the text has
                to keep the line it inherited, and anything stacked above
                would push it off. Provenance on the left, the invitation
                on the right: a pencil on its own reads as decoration, so
                it gets words to say what the whole card does. `Click to
                edit` borrows Partner's `Click to upload` hint — same
                verb, same primary-coloured phrasing. */}
            {(modifiedLabel || editable) && (
              <div
                className="flex items-center justify-between gap-3 border-t border-border/40"
                style={{ padding: `6px ${READER_PADDING_X}px` }}
              >
                {modifiedLabel ? (
                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground/50">
                    <Clock className="w-3 h-3 shrink-0" />
                    <span className="tabular-nums whitespace-nowrap">Last modified {modifiedLabel}</span>
                  </span>
                ) : <span />}
                {/* The pencil sits with the words that explain it rather than
                    in the far corner, so icon and label read as one hint.
                    Both are slate, not primary: primary made the label look
                    like the only live thing on a card where the whole surface
                    is the target. Inert, like everything else in this footer. */}
                {editable && (
                  <span
                    aria-hidden="true"
                    className="inline-flex items-center gap-1 text-[10px] text-slate-400 whitespace-nowrap shrink-0"
                    style={{ fontWeight: 500, pointerEvents: "none" }}
                  >
                    Click to edit
                    <Pencil className="w-3 h-3" />
                  </span>
                )}
              </div>
            )}
          </div>
        </div>,
        document.body
      )
    : null;

  /* ── Editor: the same box, now editable ────────────────────────── */
  const editor = editing && editorPos
    ? createPortal(
        <div
          ref={editorRef}
          className="fixed z-[12500]"
          style={{ top: editorPos.top, left: editorPos.left, width: editorPos.width }}
        >
          {/* The shake rides the shell, so the whole card nudges rather than
              its footer blinking. Adding the class is what starts it; no
              `key` remount, which would tear down the textarea and take the
              caret with it. */}
          <div
            className={asking ? "animate-attention-shake" : undefined}
            style={floaterShell(true, asking)}
          >
            {/* Borderless and transparent: the shell above draws the
                field, so the text sits at exactly the inset the
                anchoring maths assumes. */}
            <textarea
              ref={textareaRef}
              autoFocus
              value={draft}
              onChange={(e) => { setAsking(false); setDraft(maxLength ? e.target.value.slice(0, maxLength) : e.target.value); }}
              onFocus={() => setAsking(false)}
              placeholder={placeholder || "Enter description..."}
              {...(maxLength ? { maxLength } : {})}
              className="text-[12px] text-slate-700 leading-[1.6]"
              style={{
                display: "block",
                width: "100%",
                padding: `${EDITOR_PADDING_Y}px ${EDITOR_PADDING_X}px`,
                border: "none",
                outline: "none",
                background: "transparent",
                resize: "none",
                fontFamily: "Inter, system-ui, sans-serif",
              }}
            />
            {/* The explicit Save / Discard pair, below the
                text so they never displace it. */}
            <div
              className="flex items-center justify-between border-t"
              style={{
                padding: `9px ${EDITOR_PADDING_X}px`,
                gap: 10,
                /* Only the rule above the row picks up the colour. The card's
                   outline already carries the state, and filling this band as
                   well made the footer read as the thing in trouble rather
                   than the edit inside it. */
                borderTopColor: asking ? "#FECACA" : "var(--border)",
              }}
            >
              {asking ? (
                <span className="inline-flex items-center text-[11px] whitespace-nowrap" style={{ fontWeight: 600, color: "#991B1B", gap: 6 }}>
                  <AlertTriangle className="w-3 h-3 shrink-0" />
                  You have unsaved changes
                </span>
              ) : <span />}
              {/* Partner's Cancel / Save pair, sized for an inline field
                  rather than a modal: the white-outline secondary from
                  PocModals and the primary from ContactDetailPage's
                  inline tag editor (`h-6 ... hover:bg-[#0862D0]`), which
                  is the closest thing Partner has to this surface.
                  "Cancel" is Partner's word for it — 13 uses to
                  "Discard"'s 2. Both sit below the text so neither can
                  shift it off its line. */}
              <div className="flex items-center" style={{ gap: 6 }}>
                {/* Partners fills a button with --destructive only three times
                    in the module, always as the CTA of something whose whole
                    purpose is to destroy. Its destructive *secondary* carries
                    a label on white and turns red on hover:
                    `bg-white border border-border ... hover:text-destructive
                    hover:border-destructive/30 hover:bg-red-50`. That is what
                    Discard is here, because this card exists to protect the
                    edit, not to throw it away. Saving is the CTA and takes
                    Partner's filled treatment. Sizes are whole pixels. */}
                {/* White at rest, red on hover. That is Partner's destructive
                    secondary wherever it carries a label: `bg-white border
                    border-border ... hover:text-destructive
                    hover:border-destructive/30 hover:bg-red-50`, four uses in
                    the module. A permanently red fill is reserved there for a
                    CTA whose whole purpose is to destroy, which this is not. */}
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={(e) => { e.stopPropagation(); discard(); }}
                  className={`h-8 px-3 rounded-lg border bg-white text-[12px] transition-colors cursor-pointer ${
                    asking
                      ? "border-border text-slate-600 hover:text-destructive hover:border-destructive/30 hover:bg-red-50"
                      : "border-border text-slate-700 hover:bg-slate-50"
                  }`}
                  style={{ fontWeight: 500 }}
                >
                  {asking ? "Discard changes" : "Cancel"}
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={(e) => { e.stopPropagation(); commit(); }}
                  className="h-8 px-3 rounded-lg bg-primary hover:bg-[#0862D0] text-white text-[12px] transition-colors cursor-pointer"
                  style={{ fontWeight: 600, border: "none" }}
                >
                  {asking ? "Save changes" : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )
    : null;

  /* ── Empty state ──────────────────────────────────────────────── */
  const hasValue = !!value?.trim();

  if (!hasValue) {
    if (!editable) return null;
    /* Nothing to float and nothing to truncate — just the invitation,
       with the pencil hugging the copy the way Partner's inline-edit
       pencils do. Kept always-visible here because the placeholder is
       the only cue there is. */
    return (
      <>
        <div
          ref={containerRef}
          className={`max-w-3xl relative ${className ?? ""}`.trim()}
          style={{ marginTop: 6 }}
        >
          <button
            type="button"
            onClick={startEditing}
            className="group inline-flex items-center text-left text-[12px] text-slate-500 leading-[1.6] hover:text-slate-700 transition-colors"
            style={{ gap: 6, padding: 0, border: "none", background: "transparent", cursor: "pointer" }}
          >
            <span>{placeholder}</span>
            <Pencil className="text-slate-400 group-hover:text-primary transition-colors" style={{ width: 12, height: 12 }} />
          </button>
        </div>
        {editor}
      </>
    );
  }

  /* ── The row ──────────────────────────────────────────────────── */
  const interactive = editable || needsTruncation;

  return (
    <>
      <div
        ref={containerRef}
        className={`transition-all duration-250 ease-in-out max-w-3xl relative ${className ?? ""}`.trim()}
        style={{ marginTop: 6 }}
      >
        {/* Just the line. No pencil — one used to fade up here only to be
            covered by the card carrying its own — and no hover box
            either: the reader now opens on the same pointer-enter, so a
            grey panel behind it added nothing but a flash of colour. */}
        <div
          data-description-row=""
          className={`group rounded-md ${editable ? "cursor-pointer" : ""}`.trim()}
          style={{
            marginLeft: -TEXT_BLEED,
            paddingLeft: TEXT_BLEED,
            paddingRight: TEXT_BLEED,
          }}
          onMouseEnter={scheduleOpen}
          onMouseLeave={scheduleClose}
          {...(editable
            ? {
                role: "button",
                tabIndex: 0,
                "aria-label": "Edit description",
                onClick: startEditing,
                onKeyDown: (e: React.KeyboardEvent) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    startEditing(e);
                  }
                },
              }
            : {})}
        >
          {/* No padding on the measured element — `scrollWidth` vs
              `clientWidth` has to compare the text box alone, and the
              floaters anchor on its exact left edge. */}
          <p
            ref={descRef}
            className={`truncate text-[12px] text-slate-500 leading-[1.6] transition-colors ${
              interactive ? "group-hover:text-slate-700" : ""
            }`.trim()}
          >
            {value}
          </p>
        </div>
      </div>
      {reader}
      {editor}
    </>
  );
}

export default InlineDescriptionEditor;
