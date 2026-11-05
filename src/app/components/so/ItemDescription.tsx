import { useState, useRef, useLayoutEffect } from "react";
import { ChevronDown } from "lucide-react";

/**
 * ItemDescription — clamped description with an inline `more` / `less`
 * toggle that expands it in place. Toggle styled after Purchase Order's
 * `TruncatedItemName`: primary text, hover underline, a single rotating
 * ChevronDown, matching the description's own size and line height.
 *
 * Truncation runs to the very end of the space, then `more`:
 *   1 line : a native single-line ellipsis that cuts at the character,
 *            with `more` directly after it. The text fills right up to
 *            the toggle.
 *   N lines: the text is measured and cut to the last character that
 *            still fits N lines with "… more ⌄" on the end. CSS line-clamp
 *            can't do this: it breaks the last line at a word and appends
 *            the ellipsis there, which left a ragged gap before `more`.
 *
 * Earlier versions reserved 56px of padding for an absolutely positioned
 * `more` and faded the text out behind it with a white gradient. The
 * reserve is what left the gap, and the gradient showed as a white box on
 * any row that wasn't white (hover, selected). Neither is needed now:
 * `more` sits in the flow, so nothing has to be covered.
 */

const baseDescStyle: React.CSSProperties = {
  fontSize: "var(--text-caption)",
  fontWeight: "var(--font-weight-normal)",
  color: "var(--muted-foreground)",
  lineHeight: 1.45,
};

const toggleStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 2,
  fontSize: "inherit",
  fontWeight: 500,
  lineHeight: "inherit",
  border: "none",
  background: "transparent",
  cursor: "pointer",
  padding: 0,
  whiteSpace: "nowrap",
  verticalAlign: "baseline",
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

function MoreButton({ onClick, tabIndex }: { onClick?: () => void; tabIndex?: number }) {
  return (
    <button
      type="button"
      tabIndex={tabIndex}
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      style={toggleStyle}
      className="text-primary hover:underline transition-colors"
      aria-label="Show more"
    >
      more <ChevronDown style={{ width: 10, height: 10, marginLeft: 1 }} aria-hidden />
    </button>
  );
}

/** One line: native ellipsis at the character, `more` right after it. */
function SingleLine({ text, style, className, onMore }: { text: string; style: React.CSSProperties; className: string; onMore: () => void }) {
  const textRef = useRef<HTMLSpanElement>(null);
  const [clamped, setClamped] = useState(false);

  /* Width only shrinks when `more` appears, so this settles in one pass:
     overflowing text stays overflowing with the toggle beside it, and text
     that fits once the toggle is gone keeps fitting without it. */
  useLayoutEffect(() => {
    const el = textRef.current;
    if (!el) return;
    const update = () => setClamped(el.scrollWidth > el.clientWidth + 1);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [text]);

  return (
    /* `contain: inline-size` stops the one-line text from setting the
       width of whatever holds it. In an auto-layout table a nowrap line
       would otherwise widen the column to the full sentence and push the
       table into horizontal scroll; contained, it fills the width the
       column already has and truncates there. */
    <div className={className} style={{ ...style, display: "flex", alignItems: "baseline", minWidth: 0, gap: 4, contain: "inline-size" }}>
      <span
        ref={textRef}
        style={{ flex: "1 1 auto", minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
      >
        {text}
      </span>
      {clamped && <MoreButton onClick={onMore} />}
    </div>
  );
}

/** N lines: cut at the last character that fits, then "… more". */
function MultiLine({ text, maxLines, style, className, onMore }: { text: string; maxLines: number; style: React.CSSProperties; className: string; onMore: () => void }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLDivElement>(null);
  const probeTextRef = useRef<HTMLSpanElement>(null);
  const probeMoreRef = useRef<HTMLSpanElement>(null);
  /* null = the whole text fits in maxLines, no toggle needed. */
  const [cut, setCut] = useState<number | null>(null);

  useLayoutEffect(() => {
    const box = boxRef.current, probe = probeRef.current;
    const probeText = probeTextRef.current, probeMore = probeMoreRef.current;
    if (!box || !probe || !probeText || !probeMore) return;

    const fit = () => {
      probe.style.width = `${box.clientWidth}px`;
      const lineHeight = parseFloat(getComputedStyle(probe).lineHeight) || 17;
      const limit = lineHeight * maxLines + 1;
      const fits = (k: number | null) => {
        probeText.textContent = k === null ? text : `${text.slice(0, k).trimEnd()}…`;
        probeMore.style.display = k === null ? "none" : "inline";
        return probe.scrollHeight <= limit;
      };
      if (fits(null)) { setCut(null); return; }
      /* Largest prefix that still fits with "… more ⌄" on the end. */
      let lo = 0, hi = text.length;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (fits(mid)) lo = mid; else hi = mid - 1;
      }
      setCut(lo);
    };

    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    return () => ro.disconnect();
  }, [text, maxLines]);

  return (
    <div ref={boxRef} className={className} style={{ ...style, position: "relative" }}>
      {cut === null ? text : (
        <>
          {`${text.slice(0, cut).trimEnd()}…`}{" "}
          <MoreButton onClick={onMore} />
        </>
      )}
      {/* Off-screen twin used only for measuring: same type, same width. */}
      <div
        ref={probeRef}
        aria-hidden
        style={{ position: "absolute", left: 0, top: 0, visibility: "hidden", pointerEvents: "none" }}
      >
        <span ref={probeTextRef} />{" "}
        <span ref={probeMoreRef}><MoreButton tabIndex={-1} /></span>
      </div>
    </div>
  );
}

export function ItemDescription({ text, maxLines = 2, className = "", variant = "default" }: Props) {
  const [expanded, setExpanded] = useState(false);

  const baseStyle: React.CSSProperties = variant === "micro"
    ? { ...baseDescStyle, fontSize: "var(--text-micro)" }
    : baseDescStyle;

  if (expanded) {
    return (
      <div style={baseStyle} className={className}>
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

  return maxLines <= 1
    ? <SingleLine text={text} style={baseStyle} className={className} onMore={() => setExpanded(true)} />
    : <MultiLine text={text} maxLines={maxLines} style={baseStyle} className={className} onMore={() => setExpanded(true)} />;
}
