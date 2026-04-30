import { useState, useRef, useEffect } from "react";
import { ChevronUp } from "lucide-react";

/**
 * ItemDescription — 2-line clamped description with inline "more >>" / "less" toggle.
 *
 * Shared across CancellationModal, AttachmentsTab, AddLineItemDialog, CreateSOStep2, etc.
 * All typography uses CSS variable tokens only; font family is Inter via --text-* / --font-weight-*.
 */

const descStyle: React.CSSProperties = {
  fontSize: "var(--text-caption)",
  fontWeight: "var(--font-weight-normal)",
  color: "var(--foreground)",
  opacity: 0.5,
  lineHeight: 1.45,
};

const moreButtonStyle: React.CSSProperties = {
  fontSize: "var(--text-caption)",
  fontWeight: "var(--font-weight-medium)",
  color: "var(--primary)",
  border: "none",
  background: "transparent",
  cursor: "pointer",
  padding: 0,
  marginLeft: 4,
};

const lessButtonStyle: React.CSSProperties = {
  fontSize: "var(--text-small)",
  fontWeight: "var(--font-weight-medium)",
  color: "var(--primary)",
  border: "none",
  background: "transparent",
  cursor: "pointer",
  padding: 0,
  marginLeft: 4,
  display: "inline-flex",
  alignItems: "center",
  gap: 2,
};

interface Props {
  /** The full item description / name text */
  text: string;
  /** Max visible lines before clamping (default 2) */
  maxLines?: number;
  /** Additional className on the outer wrapper */
  className?: string;
  /** Micro variant for smaller right-panel cards */
  variant?: "default" | "micro";
}

export function ItemDescription({ text, maxLines = 2, className = "", variant = "default" }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [isClamped, setIsClamped] = useState(false);
  const textRef = useRef<HTMLSpanElement>(null);

  /* Detect whether the text is actually overflowing */
  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    // Compare scrollHeight to clientHeight to know if line-clamp is truncating
    setIsClamped(el.scrollHeight > el.clientHeight + 1);
  }, [text, maxLines]);

  const baseStyle: React.CSSProperties = variant === "micro"
    ? { ...descStyle, fontSize: "var(--text-micro)" }
    : descStyle;

  if (expanded) {
    return (
      <div style={baseStyle} className={className}>
        <span>{text}</span>
        <button
          onClick={e => { e.stopPropagation(); setExpanded(false); }}
          style={lessButtonStyle}
        >
          <ChevronUp style={{ width: 12, height: 12 }} /> less
        </button>
      </div>
    );
  }

  return (
    <div style={baseStyle} className={className}>
      <span
        ref={textRef}
        style={{
          display: "-webkit-box",
          overflow: "hidden",
          WebkitLineClamp: maxLines,
          WebkitBoxOrient: "vertical" as any,
        }}
      >
        {text}
      </span>
      {isClamped && (
        <button
          onClick={e => { e.stopPropagation(); setExpanded(true); }}
          style={moreButtonStyle}
        >
          more &gt;&gt;
        </button>
      )}
    </div>
  );
}