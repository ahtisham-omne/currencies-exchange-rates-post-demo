import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { ChevronDown } from "lucide-react";

/**
 * ItemDescription
 *
 * Ported from the Sales Order module, which had it as a component while
 * this repo only had the same clamp-and-`more` pattern inlined in
 * `ItemsTabTableClean`. Same behaviour, now reusable, so the import
 * module's item picker can present a row identical to the line tables'. — line-clamped description with an inline `more` /
 * `less` toggle. Styled to match Purchase Order's LineItemCard toggle:
 * single rotating ChevronDown, muted-foreground at rest, foreground on
 * hover, 10px medium weight. The accent-blue treatment was dropped — the
 * toggle is metadata, not a primary action, so it shouldn't compete with
 * row-level affordances for the reader's attention.
 */

const baseDescStyle: React.CSSProperties = {
  fontSize: "var(--text-caption)",
  fontWeight: "var(--font-weight-normal)",
  color: "var(--muted-foreground)",
  lineHeight: 1.45,
};

/* Match PO `TruncatedItemName` link chrome: matches the parent description's
   font-size and line-height so the toggle visually sits on the same row,
   medium weight, hairline gap between text and chevron. */
const toggleStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 2,
  fontSize: "var(--text-caption)",
  fontWeight: 500,
  lineHeight: 1.45,
  border: "none",
  background: "transparent",
  cursor: "pointer",
  padding: 0,
  whiteSpace: "nowrap",
};

interface Props {
  /** Full description text */
  text: string;
  /** Max visible lines before clamping (default 2) */
  maxLines?: number;
  /** Extra className on the outer wrapper */
  className?: string;
  /** Smaller variant for tight cards / sidebars */
  variant?: "default" | "micro";
}

export function ItemDescription({ text, maxLines = 2, className = "", variant = "default" }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [isClamped, setIsClamped] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);

  /* Measure overflow using scrollHeight vs clientHeight; re-runs on
     resize so the toggle disappears once the row is wide enough to fit
     the full description on N lines. */
  useLayoutEffect(() => {
    const el = textRef.current;
    if (!el) return;
    const update = () => setIsClamped(el.scrollHeight > el.clientHeight + 1);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [text, maxLines]);

  const baseStyle: React.CSSProperties = variant === "micro"
    ? { ...baseDescStyle, fontSize: "var(--text-micro)" }
    : baseDescStyle;

  if (expanded) {
    return (
      <div ref={wrapperRef} style={baseStyle} className={className}>
        <span>{text} </span>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setExpanded(false); }}
          style={{ ...toggleStyle, marginLeft: 4 }}
          className="text-primary hover:underline transition-colors"
          aria-label="Show less"
        >
          less <ChevronDown style={{ width: 10, height: 10, marginLeft: 1, transform: "rotate(180deg)" }} aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <div
      ref={wrapperRef}
      className={className}
      style={{ ...baseStyle, position: "relative" }}
    >
      <span
        ref={textRef}
        style={{
          display: "-webkit-box",
          overflow: "hidden",
          WebkitLineClamp: maxLines,
          WebkitBoxOrient: "vertical" as any,
          // Reserve space at the end of the last line so the absolutely
          // positioned `more` button doesn't sit on top of real text.
          paddingRight: isClamped ? 56 : 0,
        }}
      >
        {text}
      </span>
      {isClamped && (
        <span
          style={{
            position: "absolute",
            right: 0,
            bottom: 0,
            display: "inline-flex",
            alignItems: "center",
            paddingLeft: 28,
            // Fade the trailing characters out behind the toggle so the
            // word break under it doesn't look abrupt. Background matches
            // the surrounding card; rgba covers var(--card)=#FFFFFF too.
            background: "linear-gradient(to right, rgba(255,255,255,0) 0%, rgba(255,255,255,1) 24px, rgba(255,255,255,1) 100%)",
            pointerEvents: "auto",
            lineHeight: 1.45,
          }}
        >
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setExpanded(true); }}
            style={toggleStyle}
            className="text-primary hover:underline transition-colors"
            aria-label="Show more"
          >
            more <ChevronDown style={{ width: 10, height: 10, marginLeft: 1 }} aria-hidden />
          </button>
        </span>
      )}
    </div>
  );
}
