import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Maximize2, Minimize2 } from "lucide-react";

interface ExpandableTextareaProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  maxLength?: number;
  label?: string;
  /**
   * "full" (default): the partner Create-Partner description box — expands
   *   as a FLOATING OVERLAY (absolute, drop-shadow, click-away backdrop) so
   *   it grows over the content below WITHOUT pushing the section taller.
   *   Use where there's room below and no clipping scroll container right
   *   under it (e.g. a form header).
   * "contained": a compact single-line (40px) variant that grows IN FLOW.
   *   Use inside tight scroll/overflow containers like table cells, where a
   *   floating overlay would get clipped — the row just grows with it.
   */
  expandMode?: "full" | "contained";
  /**
   * Collapsed (rest) height in px for "full" mode. Defaults to 72 (the
   * multi-line box). Pass a small value (e.g. 32) to render a single-line
   * rest that matches sibling inputs in a table row, while still expanding
   * into the floating overlay on double-click / expand control.
   */
  collapsedHeight?: number;
  /**
   * "full" mode only. When true, the expanded box renders to <body> via a
   * portal, positioned over the collapsed field. Use inside clipping
   * containers (e.g. a table cell with overflow-x-auto) where the in-place
   * floating overlay would otherwise get cut off.
   */
  portalExpand?: boolean;
  /** Hide the character counter (e.g. compact sidebar fields). */
  hideCounter?: boolean;
}

/**
 * Expandable description textarea matching the partner module's design:
 * a multi-line box with a character counter and a corner expand control.
 * Double-click (or the control) grows it for more writing space; Escape,
 * blur, or a click on the backdrop collapses it.
 */
export function ExpandableTextarea({
  value,
  onChange,
  placeholder,
  // No character cap by default — the global 5,000-char description limit
  // was removed (design review 7/9/26, confirmed prior decision). Pass an
  // explicit maxLength only where a real constraint exists.
  maxLength = Number.POSITIVE_INFINITY,
  label,
  expandMode = "full",
  collapsedHeight,
  portalExpand = false,
  hideCounter = false,
}: ExpandableTextareaProps) {
  const [expanded, setExpanded] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);
  // Portal mode drives the open/close height transition: `expanded` controls
  // mount, `tall` is flipped a frame later so the box animates collapsedH→160
  // (and back) instead of popping.
  const [tall, setTall] = useState(false);
  const isOverlay = expandMode === "full";

  useEffect(() => {
    if (expanded && textareaRef.current) {
      textareaRef.current.focus();
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
    }
  }, [expanded]);

  // Portal mode: keep the floating box aligned over the collapsed field as
  // the page scrolls or resizes while it's open.
  useEffect(() => {
    if (!portalExpand || !expanded) return;
    const update = () => {
      if (wrapperRef.current) {
        const r = wrapperRef.current.getBoundingClientRect();
        setRect({ top: r.top, left: r.left, width: r.width });
      }
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [expanded, portalExpand]);

  // Grow the portal box one frame after it mounts (and shrink it when
  // collapsing) so CSS can animate the height change.
  useEffect(() => {
    if (!portalExpand) return;
    if (expanded) {
      const id = requestAnimationFrame(() => setTall(true));
      return () => cancelAnimationFrame(id);
    }
    setTall(false);
  }, [expanded, portalExpand]);

  const openPortal = () => {
    if (wrapperRef.current) {
      const r = wrapperRef.current.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width });
    }
    setExpanded(true);
  };

  // Animate the shrink, then unmount once the transition finishes.
  const closePortal = () => {
    setTall(false);
    window.setTimeout(() => setExpanded(false), 280);
  };

  const labelEl = label ? (
    <label className="text-[12px] text-foreground mb-1.5 block" style={{ fontWeight: 500 }}>
      {label}
    </label>
  ) : null;

  // ── Partner-style floating overlay (default) ──
  // A 72px wrapper holds the layout space; the textarea is absolutely
  // positioned so expanding it floats over the content below instead of
  // pushing the section taller. A fixed backdrop catches click-away.
  if (isOverlay) {
    // Rest height. Default 72 = the multi-line box. A small value renders a
    // single-line rest (matching sibling table inputs) that still expands
    // into the floating overlay.
    const collapsedH = collapsedHeight ?? 72;
    const compact = collapsedH <= 48;
    // Hide the char counter at rest in compact mode (no room on one line);
    // the expand button vertically centers within the collapsed height.

    // ── Portal variant ──
    // The collapsed field stays in flow (reserving layout space); the
    // expanded box renders to <body> positioned over it, so a clipping
    // ancestor (e.g. a table with overflow-x-auto) can't cut it off.
    if (portalExpand) {
      const baseClass =
        "w-full rounded-md bg-white resize-none text-[13px] text-foreground placeholder:text-slate-400 pl-3 pr-9 border outline-none";
      return (
        <div>
          {labelEl}
          <div ref={wrapperRef} className="relative" style={{ height: collapsedH }}>
            <textarea
              value={value}
              onChange={(e) => {
                if (e.target.value.length <= maxLength) onChange(e.target.value);
              }}
              onDoubleClick={() => {
                if (!expanded) openPortal();
              }}
              placeholder={placeholder}
              title={expanded ? undefined : "Double-click to expand"}
              className={`${baseClass} ${
                compact ? "py-[7px] overflow-hidden" : "pt-2 pb-6"
              } border-border focus:border-primary focus:ring-1 focus:ring-primary/20`}
              style={{ height: collapsedH, visibility: expanded ? "hidden" : "visible" }}
            />
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={openPortal}
              className="absolute right-2 w-6 h-6 rounded-md flex items-center justify-center cursor-pointer text-slate-400 hover:text-primary hover:bg-accent"
              style={{ top: compact ? (collapsedH - 24) / 2 : 8, visibility: expanded ? "hidden" : "visible" }}
              title="Expand"
            >
              <Maximize2 className="w-3 h-3" />
            </button>
          </div>
          {expanded && rect &&
            createPortal(
              <>
                <div
                  className="fixed inset-0 z-[199]"
                  style={{ opacity: tall ? 1 : 0, transition: "opacity 200ms ease" }}
                  onClick={closePortal}
                />
                <div className="fixed z-[200]" style={{ top: rect.top, left: rect.left, width: rect.width }}>
                  <textarea
                    ref={textareaRef}
                    value={value}
                    onChange={(e) => {
                      if (e.target.value.length <= maxLength) onChange(e.target.value);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") closePortal();
                    }}
                    placeholder={placeholder}
                    className={`${baseClass} ${tall ? "pt-2 pb-6" : "py-[7px] overflow-hidden"} border-primary ring-2 ring-primary/15`}
                    style={{
                      height: tall ? 160 : collapsedH,
                      boxShadow: tall ? "0 12px 40px -8px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.03)" : "none",
                      transition:
                        "height 300ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 300ms cubic-bezier(0.16, 1, 0.3, 1)",
                    }}
                  />
                  {tall && !hideCounter && (
                    <p className="absolute bottom-1.5 right-2.5 text-[11px] text-slate-400 pointer-events-none ">
                      {Number.isFinite(maxLength) ? `${value.length}/${maxLength}` : value.length.toLocaleString()}
                    </p>
                  )}
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={closePortal}
                    className="absolute right-2 w-6 h-6 rounded-md flex items-center justify-center cursor-pointer text-primary hover:bg-accent"
                    style={{ top: tall ? 8 : (collapsedH - 24) / 2, transition: "top 300ms cubic-bezier(0.16, 1, 0.3, 1)" }}
                    title="Collapse"
                  >
                    <Minimize2 className="w-3 h-3" />
                  </button>
                </div>
              </>,
              document.body,
            )}
        </div>
      );
    }

    return (
      <div>
        {labelEl}
        <div className="relative" style={{ height: collapsedH }}>
          {expanded && <div className="fixed inset-0 z-[99]" onClick={() => setExpanded(false)} />}
          <div
            className="absolute top-0 left-0 right-0 z-[100]"
            style={{
              left: expanded ? "-2.5%" : 0,
              marginRight: expanded ? "-2.5%" : 0,
              transition: "left 300ms cubic-bezier(0.16, 1, 0.3, 1), margin 300ms cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => {
                if (e.target.value.length <= maxLength) onChange(e.target.value);
              }}
              onDoubleClick={() => {
                if (!expanded) setExpanded(true);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape" && expanded) setExpanded(false);
              }}
              placeholder={placeholder}
              title={expanded ? undefined : "Double-click to expand"}
              className={`w-full rounded-lg bg-white resize-none text-[13px] text-foreground placeholder:text-slate-400 pl-3 pr-9 border outline-none ${
                expanded ? "pt-2 pb-6" : compact ? "py-[7px] overflow-hidden" : "pt-2 pb-6"
              } ${
                expanded
                  ? "border-primary ring-2 ring-primary/15"
                  : "border-border focus:border-primary focus:ring-1 focus:ring-primary/20"
              }`}
              style={{
                height: expanded ? 160 : collapsedH,
                boxShadow: expanded
                  ? "0 12px 40px -8px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.03)"
                  : "none",
                transition: "height 300ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 300ms cubic-bezier(0.16, 1, 0.3, 1), border-color 200ms ease",
              }}
            />
            {(expanded || !compact) && !hideCounter && (
              <p className="absolute bottom-1.5 right-2.5 text-[11px] text-slate-400 pointer-events-none ">
                {Number.isFinite(maxLength) ? `${value.length}/${maxLength}` : value.length.toLocaleString()}
              </p>
            )}
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setExpanded((prev) => !prev)}
              className={`absolute right-2 w-6 h-6 rounded-md flex items-center justify-center cursor-pointer ${
                expanded ? "text-primary hover:bg-accent" : "text-slate-400 hover:text-primary hover:bg-accent"
              }`}
              style={{
                top: expanded ? 8 : compact ? (collapsedH - 24) / 2 : 8,
                transition: "color 200ms ease, background-color 200ms ease",
              }}
              title={expanded ? "Collapse" : "Expand"}
            >
              {expanded ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Compact in-flow variant (table cells) ──
  // Grows in flow so it's never clipped by a scroll/overflow container; the
  // row simply grows with it. Single-line at rest, counter only when open.
  const showCounter = expanded;
  return (
    <div>
      {labelEl}
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            if (e.target.value.length <= maxLength) onChange(e.target.value);
          }}
          onDoubleClick={() => {
            if (!expanded) setExpanded(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape" && expanded) setExpanded(false);
          }}
          onBlur={() => setExpanded(false)}
          placeholder={placeholder}
          title={expanded ? undefined : "Double-click to expand"}
          className={`w-full rounded-lg bg-white resize-none text-[13px] text-foreground placeholder:text-slate-400 pl-3 pr-9 border outline-none ${
            showCounter ? "pt-2 pb-6" : "py-[9px] overflow-hidden"
          } ${
            expanded
              ? "border-primary ring-2 ring-primary/15"
              : "border-border focus:border-primary focus:ring-1 focus:ring-primary/20"
          }`}
          style={{
            height: expanded ? 120 : 40,
            transition: "height 260ms cubic-bezier(0.16, 1, 0.3, 1), border-color 200ms ease, box-shadow 200ms ease",
          }}
        />
        {showCounter && !hideCounter && (
          <p className="absolute bottom-1.5 right-2.5 text-[11px] text-slate-400 pointer-events-none ">
            {Number.isFinite(maxLength) ? `${value.length}/${maxLength}` : value.length.toLocaleString()}
          </p>
        )}
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setExpanded((prev) => !prev)}
          className={`absolute top-[8px] right-2 w-6 h-6 rounded-md flex items-center justify-center cursor-pointer ${
            expanded ? "text-primary hover:bg-accent" : "text-slate-400 hover:text-primary hover:bg-accent"
          }`}
          style={{ transition: "color 200ms ease, background-color 200ms ease" }}
          title={expanded ? "Collapse" : "Expand"}
        >
          {expanded ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
        </button>
      </div>
    </div>
  );
}
