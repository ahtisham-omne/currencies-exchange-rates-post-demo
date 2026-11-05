import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Pencil, ChevronDown, ChevronUp, Maximize2, X } from "lucide-react";

/* ════════════════════════════════════════════════════════════════
   InlineDescriptionEditor — direct port of the Partner module's
   detail-header description (Partner Management Vendors,
   src/app/pages/VendorDetailsPage.tsx around line 813-850).

   Read-mode spec, copied verbatim from Partner:
     • Wrapper:    `overflow-hidden ... max-w-3xl relative`,
                   `maxHeight: descExpanded ? 500 : 20` (1 line collapsed),
                   `marginTop: 6`.
     • Text:       `<p class="text-[12px] text-slate-500 leading-[1.6]">`.
     • More chip:  absolute bottom-right with a white-fade gradient
                   `from-white via-white to-transparent pl-6`,
                   `text-[11px] text-primary` reading `... more ▾`.
     • Less chip:  inline at end of text reading `Show less ▴`.
     • Truncation: `descRef.scrollHeight > 22` toggles the chip.

   Edit mode is a *floating popover* anchored to the description row
   (Partner CreatePartnerModal description chrome — primary glow,
   `Maximize2` chip, `0/MAX` counter) that closes on click-outside
   or ESC, committing the draft on close.
   ═══════════════════════════════════════════════════════════════ */

interface InlineDescriptionEditorProps {
  value: string;
  onChange: (next: string) => void;
  /** Read-only consumers can omit this (no pencil shown). */
  editable?: boolean;
  placeholder?: string;
  /** Char limit shown in the editor footer. Defaults to 5000 (Partner). */
  /** Characters allowed. Undefined means no limit, which is the default for a
   *  record description: the field is prose about the deal, and a ceiling on it
   *  only ever truncates something someone meant to write. */
  maxLength?: number;
  className?: string;
}

const COLLAPSED_HEIGHT = 20; // matches Partner's 1-line clamp
// When expanded, the description container has no max-height — the
// header card is allowed to grow to fit the full text. `Show less`
// always sits inline at the end of the rendered text so the user can
// always reach it (the sticky compact header still kicks in once the
// user scrolls past the natural top of the page).
const EXPANDED_HEIGHT = "none";
const TRUNCATION_THRESHOLD = 22; // matches Partner's `scrollHeight > 22`

export function InlineDescriptionEditor({
  value,
  onChange,
  editable = true,
  placeholder = "Add a description...",
  maxLength,
  className,
}: InlineDescriptionEditorProps) {
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [needsTruncation, setNeedsTruncation] = useState(false);
  const [draft, setDraft] = useState(value);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number; width: number; minHeight: number } | null>(null);

  const descRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { setDraft(value); }, [value]);

  // Partner's exact detection — does the natural height exceed one line?
  useEffect(() => {
    const check = () => {
      const el = descRef.current;
      if (!el) return;
      setNeedsTruncation(el.scrollHeight > TRUNCATION_THRESHOLD);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [value, editing]);

  // Anchor the popover ON TOP of the description row so it OVERLAPS the
  // read-mode text (no duplicate text visible — the popover replaces the
  // read view in place, then expands downward as the user types).
  // Width matches the description container; clamp to viewport on narrow
  // screens. Offset top by -4 so the popover's border sits flush with the
  // line of read text rather than nudging the layout.
  useLayoutEffect(() => {
    if (!editing) return;
    const anchor = containerRef.current;
    if (!anchor) return;
    const update = () => {
      const r = anchor.getBoundingClientRect();
      const descEl = descRef.current;
      // Measure the natural (unclamped) height of the description block so
      // the popover never appears smaller than the read-mode text it's
      // overlapping. We temporarily disable line-clamp to read scrollHeight.
      let naturalDescHeight = r.height;
      if (descEl) {
        const prevMax = descEl.style.maxHeight;
        const prevDisp = descEl.style.display;
        const prevClamp = descEl.style.webkitLineClamp;
        descEl.style.maxHeight = "none";
        descEl.style.display = "block";
        descEl.style.webkitLineClamp = "unset";
        naturalDescHeight = descEl.scrollHeight;
        descEl.style.maxHeight = prevMax;
        descEl.style.display = prevDisp;
        descEl.style.webkitLineClamp = prevClamp;
      }
      const minWidth = 320;
      const maxWidth = Math.max(minWidth, window.innerWidth - r.left - 16);
      setPopoverPos({
        top: r.top - 4,
        left: r.left,
        width: Math.min(maxWidth, Math.max(minWidth, r.width)),
        // Reserve enough textarea height to fully cover the description text
        // — clamp between a sensible single-line floor and the popover's max.
        minHeight: Math.max(72, Math.min(naturalDescHeight + 8, 320)),
      });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [editing]);

  // Auto-grow the textarea while editing — never shrink below the
  // measured description height so the popover always fully covers the
  // read text underneath.
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    const floor = popoverPos?.minHeight ?? 72;
    el.style.height = "auto";
    el.style.height = `${Math.max(floor, Math.min(360, el.scrollHeight))}px`;
  }, [draft, editing, popoverPos?.minHeight]);

  // Click-outside + ESC DISCARDS the draft (no implicit save). Save only
  // happens when the user explicitly clicks the Save button or hits
  // ⌘/Ctrl+Enter — matches the explicit Save / Discard contract every
  // other modal in the app uses.
  useEffect(() => {
    if (!editing) return;
    const onMouseDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (popoverRef.current?.contains(t)) return;
      if (containerRef.current?.contains(t)) return;
      setDraft(value);
      setEditing(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); setDraft(value); setEditing(false); }
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); onChange(draft); setEditing(false); }
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [editing, draft, onChange, value]);

  /* ── Floating editor popover ──────────────────────────────────── */
  const popover = editing && popoverPos
    ? createPortal(
        <div
          ref={popoverRef}
          style={{
            position: "fixed",
            top: popoverPos.top,
            left: popoverPos.left,
            width: popoverPos.width,
            zIndex: 12500,
          }}
        >
          <div
            style={{
              // White-card chrome consistent with other hovering modals —
              // subtle hairline border, soft modal shadow, no glowing
              // primary ring. The text area sits flush inside; an explicit
              // Save / Discard footer is the only way to commit (or
              // revert) — clicking outside or pressing Esc discards.
              position: "relative",
              background: "#FFFFFF",
              border: "1px solid var(--border)",
              borderRadius: 10,
              boxShadow: "0 18px 40px -12px rgba(15, 23, 42, 0.18), 0 6px 14px -6px rgba(15, 23, 42, 0.10)",
              padding: 12,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <div style={{ position: "relative" }}>
              <textarea
                ref={textareaRef}
                autoFocus
                value={draft}
                onChange={(e) => setDraft(maxLength ? e.target.value.slice(0, maxLength) : e.target.value)}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "var(--primary)";
                  e.currentTarget.style.boxShadow = "0 0 0 3px rgba(27, 110, 243, 0.12)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "var(--border)";
                  e.currentTarget.style.boxShadow = "none";
                }}
                placeholder={placeholder || "Enter description..."}
                {...(maxLength ? { maxLength } : {})}
                rows={3}
                className="text-[12px] text-slate-700 leading-[1.6]"
                style={{
                  width: "100%", minHeight: popoverPos.minHeight, maxHeight: 360,
                  resize: "none", outline: "none",
                  padding: "10px 12px",
                  background: "#FFFFFF",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontFamily: "Inter, system-ui, sans-serif",
                  transition: "border-color 120ms, box-shadow 120ms",
                  display: "block",
                }}
              />
            </div>
            <div className="flex items-center justify-end">
              <div className="flex items-center" style={{ gap: 6 }}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={(e) => { e.stopPropagation(); setDraft(value); setEditing(false); }}
                  style={{
                    height: 30, padding: "0 12px", borderRadius: 8,
                    border: "1px solid var(--border)", background: "#FFFFFF",
                    color: "var(--foreground)", fontSize: 13, fontWeight: 500,
                    cursor: "pointer", transition: "all 150ms",
                    fontFamily: "Inter, system-ui, sans-serif",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--muted)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#FFFFFF"; }}
                >
                  Discard
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={(e) => { e.stopPropagation(); onChange(draft); setEditing(false); }}
                  style={{
                    height: 30, padding: "0 14px", borderRadius: 8,
                    border: "none", background: "var(--primary)",
                    color: "#FFFFFF", fontSize: 13, fontWeight: 600,
                    cursor: "pointer", transition: "background-color 150ms",
                    fontFamily: "Inter, system-ui, sans-serif",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#0D5ED7"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "var(--primary)"; }}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )
    : null;

  /* ── Read mode — verbatim Partner pattern ─────────────────────── */
  const hasValue = !!value?.trim();

  if (!hasValue) {
    if (!editable) return null;
    /* Empty-state affordance — inline text + pencil sitting right
       after the copy. Previously the pencil was absolutely positioned
       at the row's right edge, which read as disconnected from the
       "Add a description" label. Now the button is `inline-flex` so
       the pencil hugs the text like Partner's inline-edit pencils do
       (see `VendorDetailsPage` header row). The pencil turns primary
       on hover so it reads as a real affordance, not decoration. */
    return (
      <>
        <div
          ref={containerRef}
          className={`max-w-3xl relative ${className ?? ""}`.trim()}
          style={{ marginTop: 6 }}
        >
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="group inline-flex items-center text-left text-[12px] text-slate-500 leading-[1.6] hover:text-slate-700 transition-colors"
            style={{
              gap: 6, padding: 0, border: "none", background: "transparent",
              cursor: "pointer",
            }}
          >
            <span>{placeholder}</span>
            <Pencil
              className="text-slate-400 group-hover:text-primary transition-colors"
              style={{ width: 12, height: 12 }}
            />
          </button>
        </div>
        {popover}
      </>
    );
  }

  return (
    <>
      <div
        ref={containerRef}
        className={`transition-all duration-250 ease-in-out max-w-3xl relative ${className ?? ""}`.trim()}
        style={{
          // Expanded mode: no maxHeight at all so the header card grows
          // to fit the full description and the inline `Show less` chip
          // + edit pencil sit at the end without being clipped.
          // Collapsed mode keeps a one-line clamp + overflow:hidden so
          // the truncated read view + absolute "more" chip line up.
          ...(expanded ? {} : { maxHeight: COLLAPSED_HEIGHT, overflow: "hidden" }),
          marginTop: 6,
        }}
      >
        <div
          ref={descRef}
          // In expanded mode drop the overflow:hidden + max-height so the
          // text + inline "Show less" + edit pencil are never clipped.
          className={expanded ? undefined : "overflow-hidden"}
          style={expanded ? undefined : { maxHeight: COLLAPSED_HEIGHT }}
        >
          <p className="text-[12px] text-slate-500 leading-[1.6]">
            {value}
            {expanded && needsTruncation && (
              <>
                {" "}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setExpanded(false); }}
                  className="inline-flex items-center gap-0.5 text-[11px] hover:opacity-80 cursor-pointer align-baseline"
                  style={{ fontWeight: 500, color: "#0F62D6" }}
                >
                  Show less <ChevronUp className="w-3 h-3 inline" />
                </button>
                {editable && (
                  <>
                    {" "}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setEditing(true); }}
                      aria-label="Edit description"
                      className="inline-flex items-center justify-center align-baseline"
                      style={{
                        width: 18, height: 18, borderRadius: 4,
                        border: "none", background: "transparent", cursor: "pointer",
                        color: "#94A3B8", verticalAlign: "middle",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = "var(--primary)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = "#94A3B8"; }}
                    >
                      <Pencil style={{ width: 12, height: 12 }} />
                    </button>
                  </>
                )}
              </>
            )}
          </p>
        </div>
        {/* Trailing affordance — combines the "more" chip with the inline
            edit pencil so the pencil sits next to "more ▾" instead of
            floating at the row's right edge. */}
        {!expanded && (
          // Wider transparent→white fade so the trailing "more ▾" chip
          // never appears to overlap the description text — the gradient
          // takes ~40px to reach full white, giving a comfortable gap.
          <div
            className="absolute right-0 bottom-0 inline-flex items-center"
            style={{
              gap: 6,
              lineHeight: "20px",
              paddingLeft: 40,
              backgroundImage: "linear-gradient(to left, #FFFFFF 0%, #FFFFFF 70%, rgba(255,255,255,0) 100%)",
            }}
          >
            {needsTruncation && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setExpanded(true); }}
                className="inline-flex items-center gap-0.5 text-[11px] hover:opacity-80 cursor-pointer"
                style={{ fontWeight: 500, color: "#0F62D6" }}
              >
                ... more <ChevronDown className="w-3 h-3" />
              </button>
            )}
            {editable && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setEditing(true); }}
                aria-label="Edit description"
                className="inline-flex items-center justify-center"
                style={{
                  width: 18, height: 18, borderRadius: 4,
                  border: "none", background: "transparent", cursor: "pointer",
                  color: "#94A3B8",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "var(--primary)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "#94A3B8"; }}
              >
                <Pencil style={{ width: 12, height: 12 }} />
              </button>
            )}
          </div>
        )}
      </div>
      {popover}
    </>
  );
}

export default InlineDescriptionEditor;
