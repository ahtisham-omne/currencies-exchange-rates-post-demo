import React, { useCallback, useLayoutEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { FONT } from "./designTokens";

/* ═══════════════════════════════════════════════════════════════
   TruncatedItemName — Reusable more/less truncation component
   
   Usage:
     <TruncatedItemName name={item.descriptiveName} maxChars={80} />
   
   Touch point guidelines:
     PO Detail Line Items:    maxChars={80}
     OrderFlow header:        maxChars={60}
     Catalogue modal cards:   maxChars={50}
     Cart item cards:         maxChars={50}
     Listing table cells:     maxChars={30}
     Recently ordered cards:  maxChars={40}
     MiniCartDrawer:          maxChars={30}
     PurchaseSearchModal:     maxChars={50}
   ═══════════════════════════════════════════════════════════════ */

interface TruncatedItemNameProps {
  name: string;
  maxChars?: number;
  collapsedLines?: number;
  /** CSS styles for the text — fontSize, lineHeight, fontWeight etc. */
  style?: React.CSSProperties;
  /** Additional class names for the text */
  className?: string;
  /** Optional: highlight function for search results */
  highlightFn?: (text: string) => React.ReactNode;
  /** If true, use tooltip on hover instead of inline more/less (for very tight spaces) */
  tooltipOnly?: boolean;
}

export default function TruncatedItemName({
  name,
  maxChars = 80,
  collapsedLines,
  style,
  className = "text-muted-foreground",
  highlightFn,
  tooltipOnly = false,
}: TruncatedItemNameProps) {
  const [expanded, setExpanded] = useState(false);
  const [isLineClampOverflowing, setIsLineClampOverflowing] = useState(false);
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const needsTruncation = collapsedLines ? (expanded || isLineClampOverflowing) : name.length > maxChars;

  const toggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setExpanded((prev) => !prev);
  }, []);

  const baseStyle: React.CSSProperties = {
    fontFamily: FONT,
    ...style,
  };

  const linkStyle: React.CSSProperties = {
    fontSize: style?.fontSize,
    fontWeight: "var(--font-weight-medium)" as string,
    lineHeight: style?.lineHeight,
    fontFamily: FONT,
    color: "hsl(var(--primary))",
    cursor: "pointer",
  };

  useLayoutEffect(() => {
    if (!collapsedLines || tooltipOnly) {
      setIsLineClampOverflowing(false);
      return;
    }

    const wrapper = wrapperRef.current;
    const measureEl = measureRef.current;
    if (!wrapper || !measureEl) return;

    const checkOverflow = () => {
      const computed = window.getComputedStyle(measureEl);
      const measuredLineHeight = parseFloat(computed.lineHeight);
      const fallbackLineHeight = typeof style?.lineHeight === "number"
        ? style.lineHeight
        : parseFloat(String(style?.lineHeight ?? ""));
      const lineHeight = Number.isFinite(measuredLineHeight)
        ? measuredLineHeight
        : Number.isFinite(fallbackLineHeight)
          ? fallbackLineHeight
          : 16;

      setIsLineClampOverflowing(measureEl.scrollHeight > lineHeight * collapsedLines + 1);
    };

    checkOverflow();

    if (typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(checkOverflow);
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, [collapsedLines, expanded, name, style, tooltipOnly]);

  // Tooltip-only mode: just truncate with CSS, no toggle
  if (tooltipOnly) {
    return (
      <span className={`truncate block ${className}`} style={baseStyle} title={name}>
        {highlightFn ? highlightFn(name) : name}
      </span>
    );
  }

  if (collapsedLines && !expanded) {
    return (
      <span ref={wrapperRef} className={`relative block ${className}`} style={baseStyle}>
        <span
          className={`block ${isLineClampOverflowing ? "pr-16" : ""}`}
          style={{
            display: "-webkit-box",
            WebkitBoxOrient: "vertical",
            WebkitLineClamp: collapsedLines,
            overflow: "hidden",
            whiteSpace: "normal",
          }}
        >
          {highlightFn ? highlightFn(name) : name}
        </span>

        {isLineClampOverflowing && (
          <button
            className="absolute bottom-0 right-0 inline-flex items-center gap-0.5 bg-card pl-1 hover:underline"
            style={linkStyle}
            onClick={toggle}
          >
            … more <ChevronDown className="size-2.5 inline" />
          </button>
        )}

        <span
          ref={measureRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 block overflow-hidden opacity-0"
          style={{
            ...baseStyle,
            whiteSpace: "normal",
          }}
        >
          {name}
        </span>
      </span>
    );
  }

  // No truncation needed
  if (!needsTruncation) {
    return (
      <span className={className} style={baseStyle}>
        {highlightFn ? highlightFn(name) : name}
      </span>
    );
  }

  // Collapsed state
  if (!expanded) {
    const truncated = name.slice(0, maxChars) + "…";
    return (
      <span className={className} style={baseStyle}>
        {highlightFn ? highlightFn(truncated) : truncated}
        <button
          className="shrink-0 inline-flex items-center gap-0.5 ml-1 hover:underline"
          style={linkStyle}
          onClick={toggle}
        >
          more <ChevronDown className="size-2.5 inline" />
        </button>
      </span>
    );
  }

  // Expanded state
  return (
    <span className={className} style={baseStyle}>
      {highlightFn ? highlightFn(name) : name}
      <button
        className="shrink-0 inline-flex items-center gap-0.5 ml-1 hover:underline"
        style={linkStyle}
        onClick={toggle}
      >
        less <ChevronDown className="size-2.5 inline" style={{ transform: "rotate(180deg)" }} />
      </button>
    </span>
  );
}
