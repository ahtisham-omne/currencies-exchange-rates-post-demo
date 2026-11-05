import React from "react";

/* ════════════════════════════════════════════════════════════════
   NoticeBannerStack — deck-of-cards layout for stacking multiple
   detail-header notices.

   • 0 items → renders nothing.
   • 1 item  → renders it flat (no deck chrome, no visual overhead).
   • 2+      → the top notice renders fully; up to `maxPeek` shell
               cards peek below with a small vertical offset and
               horizontal inset, so the user sees at a glance that
               more notices are queued instead of the current
               "reveal-on-dismiss" flow.

   Accepts children directly — pass conditional banners like
   `{cond && <StatusNoticeBanner .../>}` and the stack filters out
   falsy entries. Peek shells are decorative (`aria-hidden`,
   `pointer-events: none`); the top notice's own dismiss handler
   removes it from children so the next real notice rotates in.
   ═══════════════════════════════════════════════════════════════ */

interface NoticeBannerStackProps {
  children: React.ReactNode;
  /** Max decorative peek cards below the top. Default 2. */
  maxPeek?: number;
}

const PEEK_OFFSET = 5;
const PEEK_INSET = 4;

export function NoticeBannerStack({ children, maxPeek = 2 }: NoticeBannerStackProps) {
  const visible = React.Children.toArray(children).filter(
    (c) => c !== null && c !== undefined && c !== false && c !== "",
  );
  if (visible.length === 0) return null;
  const [topNode, ...rest] = visible;
  if (rest.length === 0) return <>{topNode}</>;

  const peekCount = Math.min(rest.length, maxPeek);

  return (
    <div style={{ position: "relative" }}>
      {Array.from({ length: peekCount }).map((_, i) => {
        const depth = i + 1;
        return (
          <div
            key={`peek-${depth}`}
            aria-hidden
            style={{
              position: "absolute",
              top: depth * PEEK_OFFSET,
              bottom: -(depth * PEEK_OFFSET),
              left: depth * PEEK_INSET,
              right: depth * PEEK_INSET,
              borderRadius: 12,
              background: "var(--card)",
              border: "1px solid var(--border)",
              boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
              zIndex: 1,
              opacity: 1 - depth * 0.2,
              pointerEvents: "none",
            }}
          />
        );
      })}
      <div style={{ position: "relative", zIndex: 10 }}>{topNode}</div>
    </div>
  );
}

export default NoticeBannerStack;
