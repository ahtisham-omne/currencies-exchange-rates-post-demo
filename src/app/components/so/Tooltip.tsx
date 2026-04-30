import { useState, useRef, useEffect } from "react";

/**
 * Lightweight tooltip — pure CSS variable styling, uses Inter font.
 * Positions above by default, falls back to below if no room.
 */
interface TooltipProps {
  text: string;
  children: React.ReactNode;
  position?: "top" | "bottom";
  delay?: number;
}

export function Tooltip({ text, children, position = "top", delay = 300 }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = () => {
    timerRef.current = setTimeout(() => setVisible(true), delay);
  };
  const hide = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisible(false);
  };

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return (
    <span className="relative inline-flex" onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}>
      {children}
      {visible && text && (
        <span
          role="tooltip"
          className="absolute left-1/2 pointer-events-none whitespace-nowrap"
          style={{
            transform: "translateX(-50%)",
            ...(position === "top" ? { bottom: "calc(100% + 6px)" } : { top: "calc(100% + 6px)" }),
            zIndex: "var(--z-tooltip)",
            padding: "4px 8px",
            borderRadius: "var(--radius-sm)",
            backgroundColor: "var(--foreground)",
            color: "var(--background)",
            fontSize: "var(--text-micro)",
            fontWeight: "var(--font-weight-medium)",
            boxShadow: "var(--elevation-2)",
            maxWidth: 260,
            whiteSpace: "normal",
            lineHeight: 1.4,
          }}
        >
          {text}
        </span>
      )}
    </span>
  );
}

/**
 * Wrap a table header <th> content with a tooltip.
 */
export function ThTooltip({ label, tooltip }: { label: string; tooltip: string }) {
  return (
    <Tooltip text={tooltip} position="bottom" delay={400}>
      <span className="cursor-default border-b border-dashed border-foreground/15">{label}</span>
    </Tooltip>
  );
}