import React from 'react';

/* ── One collapse animation for every accordion (user 10/8) ───────────
 * The module's canonical expand/collapse: the grid-rows 0fr ↔ 1fr trick
 * animates height without measuring, with the create-screen's easing
 * curve (cubic-bezier(0.32, 0.72, 0, 1)) and a fade + slight slide so
 * opening reads as a smooth waterfall instead of an instant snap.
 * Content stays mounted, so tables and inputs keep their state. */
export function CollapseReveal({ open, children }: { open: boolean; children: React.ReactNode }) {
  return (
    <div
      className="grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
      style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
    >
      <div className="min-h-0 overflow-hidden">
        <div
          className="transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
          style={{ opacity: open ? 1 : 0, transform: open ? 'translateY(0)' : 'translateY(-8px)' }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
