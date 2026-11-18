import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "../ui/utils";

/**
 * A user-entered description, collapsed to `lines` lines by default.
 *
 * Descriptions have no length cap in Omne, so long text is clamped with a faded
 * "... more" on its last visible line; expanded, the full text ends in an inline
 * "Show less". The toggle only renders when the text overflows. Pattern source:
 * the Partner detail header (partner-management-module, VendorDetailsPage).
 *
 * Typography (size, colour, weight, leading) comes from `className` / `style`;
 * the toggle inherits the size and leading.
 */
export function ExpandableDescription({
  text,
  lines = 1,
  maxExpandedLines,
  fadeColor = "#FFFFFF",
  prefix,
  className,
  style,
}: {
  text: string;
  /** Lines visible while collapsed. */
  lines?: number;
  /** Cap on the expanded height, in lines; past it the text scrolls (hover
   *  cards don't scroll, and a header shouldn't swallow the screen). */
  maxExpandedLines?: number;
  /** Surface colour behind the text, so the "... more" fade blends into it. */
  fadeColor?: string;
  /** Inline lead-in rendered before the text, e.g. a bold "Description: " label. */
  prefix?: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const textRef = useRef<HTMLParagraphElement>(null);
  // index.css gives every button 1rem / 1.5; the toggle must match the text so
  // "... more" is exactly one line tall and "Show less" reads as part of it.
  const inheritType: CSSProperties = { fontSize: "inherit", lineHeight: "inherit" };

  // A different record in the same slot starts collapsed again.
  useEffect(() => setExpanded(false), [text]);

  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    // scrollHeight is the full text height whether or not it is clamped, so the
    // same check holds in both states.
    const measure = () => {
      const computed = getComputedStyle(el);
      const lineHeight = parseFloat(computed.lineHeight) || parseFloat(computed.fontSize) * 1.2;
      setOverflows(el.scrollHeight > lineHeight * lines + 1);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [text, lines]);

  return (
    <div className={cn("relative min-w-0", className)} style={style}>
      <p
        ref={textRef}
        className="whitespace-pre-line break-words"
        style={
          !expanded
            ? { maxHeight: `${lines}lh`, overflow: "hidden" }
            : maxExpandedLines
              ? { maxHeight: `${maxExpandedLines}lh`, overflowY: "auto", overscrollBehavior: "contain" }
              : undefined
        }
      >
        {prefix}
        {text}
        {expanded && overflows && (
          <>
            {" "}
            <button
              type="button"
              aria-expanded
              onClick={(e) => { e.stopPropagation(); setExpanded(false); }}
              className="inline-flex items-center gap-0.5 align-baseline font-medium text-[#007FFF] hover:text-[#0066D6] cursor-pointer"
              style={inheritType}
            >
              Show less <ChevronUp className="w-3 h-3" />
            </button>
          </>
        )}
      </p>
      {!expanded && overflows && (
        <button
          type="button"
          aria-expanded={false}
          onClick={(e) => { e.stopPropagation(); setExpanded(true); }}
          className="absolute bottom-0 right-0 inline-flex items-center gap-0.5 pl-6 font-medium text-[#007FFF] hover:text-[#0066D6] cursor-pointer"
          style={{ ...inheritType, background: `linear-gradient(to right, transparent, ${fadeColor} 1.5rem)` }}
        >
          ... more <ChevronDown className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}
