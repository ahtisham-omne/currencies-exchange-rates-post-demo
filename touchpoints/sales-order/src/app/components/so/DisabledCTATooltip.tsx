import { useState, useRef, useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Info } from "lucide-react";

interface Props {
  disabled: boolean;
  reason: string;
  action?: string;
  children: ReactNode;
}

/**
 * Wraps a CTA button. When the button is disabled, hovering shows
 * a custom styled tooltip explaining why and what to do.
 */
export function DisabledCTATooltip({ disabled, reason, action, children }: Props) {
  const [show, setShow] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!show || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const tooltipHeight = 80; // approximate
    const fitsAbove = rect.top - tooltipHeight - 8 > 0;
    setPos({
      top: fitsAbove ? rect.top - tooltipHeight - 8 : rect.bottom + 8,
      left: Math.max(8, Math.min(rect.left + rect.width / 2 - 140, window.innerWidth - 288)),
    });
  }, [show]);

  if (!disabled) return <>{children}</>;

  return (
    <div
      ref={ref}
      className="relative inline-flex"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && createPortal(
        <div
          className="bg-card border border-border rounded-lg"
          style={{
            position: "fixed",
            top: pos.top,
            left: pos.left,
            width: 280,
            padding: "10px 14px",
            boxShadow: "var(--elevation-3)",
            zIndex: "var(--z-tooltip)" as any,
          }}
        >
          <div className="flex items-start gap-2.5">
            <Info className="w-4 h-4 text-chart-3 shrink-0 mt-0.5" />
            <div>
              <div className="text-foreground" style={{ fontSize: "var(--text-caption)", fontWeight: 600, marginBottom: 2 }}>
                {reason}
              </div>
              {action && (
                <div className="text-foreground/50" style={{ fontSize: "var(--text-small)", lineHeight: 1.4 }}>
                  {action}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
