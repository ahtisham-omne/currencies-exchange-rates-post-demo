/* StagePopover — hoverable overlay card on the status pill.
   Shows stage-specific audit info: who triggered the transition, when, notes, attachments. */

import { useState, useRef, useEffect, type ReactNode } from "react";
import {
  Pencil, Send, ShieldCheck, Truck, PackageCheck, Clock,
  Paperclip, CheckCircle2, History,
} from "lucide-react";
import type { SalesOrder, SOStatus } from "./types";

/* ── Mock stage history — in production this comes from the API ── */
export interface StageEvent {
  stage: string;
  triggeredBy: string;
  initials: string;
  timestamp: string;
  note?: string;
  attachment?: { name: string; size: string };
}

/** Build mock stage history based on the SO's current status. */
export function buildStageHistory(so: SalesOrder): StageEvent[] {
  const events: StageEvent[] = [];
  const statusOrder: SOStatus[] = ["Draft", "Pending Review", "Cleared", "Partially Shipped", "Shipped"];
  const currentIdx = statusOrder.indexOf(so.status as any);
  const effectiveIdx = currentIdx >= 0 ? currentIdx : (() => {
    if (so.previousStatus) {
      const pi = statusOrder.indexOf(so.previousStatus as any);
      return pi >= 0 ? pi : 0;
    }
    return 0;
  })();

  // Draft — always present
  events.push({
    stage: "Draft",
    triggeredBy: "Sarah Mitchell",
    initials: "SM",
    timestamp: so.createdDate || "03/12/2026",
    note: "Created from Quote QT-2026-0117",
  });

  if (effectiveIdx >= 1) {
    events.push({
      stage: "Pending Review",
      triggeredBy: "Sarah Mitchell",
      initials: "SM",
      timestamp: "03/13/2026",
      note: "Submitted for operations clearance",
    });
  }

  if (effectiveIdx >= 2) {
    events.push({
      stage: "Cleared",
      triggeredBy: "Marcus Chen",
      initials: "MC",
      timestamp: "03/14/2026",
      note: "Inventory verified, credit approved. Ready for fulfillment.",
      attachment: { name: "ops-clearance-report.pdf", size: "124 KB" },
    });
  }

  if (effectiveIdx >= 3) {
    events.push({
      stage: "Partially Shipped",
      triggeredBy: "Diana Reyes",
      initials: "DR",
      timestamp: "03/15/2026",
      note: "Batch 1 dispatched via UPS LTL. Remaining items pending pick.",
    });
  }

  if (effectiveIdx >= 4) {
    events.push({
      stage: "Shipped",
      triggeredBy: "James Park",
      initials: "JP",
      timestamp: "03/16/2026",
      note: "All shipments confirmed. Final batch dispatched.",
      attachment: { name: "proof-of-delivery.pdf", size: "2.1 MB" },
    });
  }

  return events;
}

/* ── Stage display config ── */
const stageConfig: Record<string, { icon: typeof Pencil; color: string; label: string }> = {
  Draft:              { icon: Pencil,       color: "var(--foreground)", label: "Draft Created" },
  "Pending Review":   { icon: Send,         color: "var(--chart-3)",   label: "Submitted for Review" },
  Cleared:            { icon: ShieldCheck,  color: "var(--primary)",   label: "Cleared by Ops" },
  "Partially Shipped":{ icon: Truck,        color: "var(--chart-4)",   label: "Partially Shipped" },
  Shipped:            { icon: PackageCheck, color: "var(--accent)",    label: "Shipped" },
};

/* ── Initials circle (soft pastel bg/12, full-color text, semibold 600) ── */
function InitialsCircle({ initials, color }: { initials: string; color: string }) {
  return (
    <div className="relative shrink-0" style={{ width: 22, height: 22 }}>
      <div
        className="absolute inset-0 rounded-full"
        style={{ backgroundColor: color, opacity: 0.12 }}
      />
      <div
        className="absolute inset-0 rounded-full flex items-center justify-center"
        style={{
          fontSize: "var(--text-micro)",
          fontWeight: "var(--font-weight-semibold)",
          color,
        }}
      >
        {initials}
      </div>
    </div>
  );
}

/* ── The popover card ── */
function StageCard({ events, currentStatus }: { events: StageEvent[]; currentStatus: SOStatus }) {
  const currentStageEvent = events[events.length - 1];

  return (
    <div
      className="bg-card border border-border rounded-xl"
      style={{
        boxShadow: "var(--elevation-3)",
        width: 360,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center"
        style={{
          padding: "14px 18px",
          gap: "var(--space-inline-gap)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        {(() => {
          const cfg = stageConfig[currentStageEvent?.stage] || stageConfig.Draft;
          const Icon = cfg.icon;
          return (
            <div className="flex items-center" style={{ gap: 10 }}>
              <div className="relative shrink-0" style={{ width: 30, height: 30 }}>
                <div
                  className="absolute inset-0 rounded-lg"
                  style={{ backgroundColor: cfg.color, opacity: 0.1 }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Icon style={{ width: 14, height: 14, color: cfg.color }} />
                </div>
              </div>
              <div>
                <div
                  className="text-foreground"
                  style={{ fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-semibold)" }}
                >
                  Stage History
                </div>
                <div
                  className="text-muted-foreground"
                  style={{ fontSize: "var(--text-micro)", marginTop: 1 }}
                >
                  {events.length} transition{events.length !== 1 ? "s" : ""} recorded
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Timeline */}
      <div style={{ padding: "14px 18px 18px" }}>
        {events.map((ev, i) => {
          const cfg = stageConfig[ev.stage] || stageConfig.Draft;
          const Icon = cfg.icon;
          const isLast = i === events.length - 1;
          const isCurrent = isLast;

          return (
            <div key={ev.stage} className="flex" style={{ gap: 14 }}>
              {/* Timeline column */}
              <div className="flex flex-col items-center shrink-0" style={{ width: 24 }}>
                {/* Dot / icon */}
                <div className="relative shrink-0" style={{ width: 22, height: 22 }}>
                  <div
                    className="absolute inset-0 rounded-full"
                    style={{
                      backgroundColor: cfg.color,
                      opacity: isCurrent ? 1 : 0.12,
                    }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    {isCurrent ? (
                      <Icon style={{ width: 10, height: 10, color: "var(--primary-foreground)" }} />
                    ) : (
                      <CheckCircle2 style={{ width: 10, height: 10, color: cfg.color }} />
                    )}
                  </div>
                </div>
                {/* Connector line */}
                {!isLast && (
                  <div
                    className="flex-1"
                    style={{
                      width: 1.5,
                      backgroundColor: "var(--border)",
                      minHeight: 16,
                    }}
                  />
                )}
              </div>

              {/* Content */}
              <div style={{ paddingBottom: isLast ? 0 : 16, flex: 1, minWidth: 0 }}>
                <div className="flex items-center justify-between" style={{ gap: 8 }}>
                  <span
                    style={{
                      fontSize: "var(--text-caption)",
                      fontWeight: "var(--font-weight-semibold)",
                      color: isCurrent ? cfg.color : "var(--foreground)",
                    }}
                  >
                    {cfg.label}
                  </span>
                  <span
                    className="flex items-center shrink-0 text-muted-foreground"
                    style={{ fontSize: "var(--text-micro)", gap: 4 }}
                  >
                    <Clock style={{ width: 10, height: 10 }} />
                    {ev.timestamp}
                  </span>
                </div>

                {/* Who triggered */}
                <div className="flex items-center" style={{ gap: 8, marginTop: 6 }}>
                  <InitialsCircle initials={ev.initials} color={cfg.color} />
                  <span
                    className="text-foreground"
                    style={{ fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-medium)" }}
                  >
                    {ev.triggeredBy}
                  </span>
                </div>

                {/* Note */}
                {ev.note && (
                  <div
                    className="text-muted-foreground"
                    style={{ fontSize: "var(--text-micro)", marginTop: 5, lineHeight: 1.5 }}
                  >
                    {ev.note}
                  </div>
                )}

                {/* Attachment */}
                {ev.attachment && (
                  <div
                    className="flex items-center bg-secondary/50 rounded-md"
                    style={{
                      gap: 6,
                      padding: "5px 10px",
                      marginTop: 8,
                      cursor: "pointer",
                    }}
                  >
                    <Paperclip
                      style={{ width: 10, height: 10, color: "var(--muted-foreground)", flexShrink: 0 }}
                    />
                    <span
                      className="text-foreground truncate"
                      style={{ fontSize: "var(--text-micro)", fontWeight: "var(--font-weight-medium)" }}
                    >
                      {ev.attachment.name}
                    </span>
                    <span
                      className="text-muted-foreground shrink-0"
                      style={{ fontSize: "var(--text-micro)" }}
                    >
                      {ev.attachment.size}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Exported wrapper that handles hover positioning ── */
export function StagePopover({
  children,
  so,
  shippedHeader,
}: {
  children: (state: { isHovered: boolean; isOpen: boolean }) => ReactNode;
  so: SalesOrder;
  shippedHeader?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [position, setPosition] = useState<"below" | "above">("below");
  const triggerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const events = buildStageHistory(so);

  const handleEnter = () => {
    setIsHovered(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setIsOpen(true), 200);
  };

  const handleLeave = () => {
    setIsHovered(false);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setIsOpen(false), 150);
  };

  useEffect(() => {
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, []);

  /* Position check — if near bottom of viewport, show above */
  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPosition(rect.bottom + 420 > window.innerHeight ? "above" : "below");
    }
  }, [isOpen]);

  return (
    <div
      ref={triggerRef}
      className="relative inline-flex"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      {/* Trigger child (the status badge with icon rendered inside) */}
      <div className="cursor-pointer">
        {children({ isHovered, isOpen })}
      </div>

      {/* Popover */}
      {isOpen && (
        <div
          ref={popoverRef}
          className="absolute"
          style={{
            zIndex: "var(--z-popover)",
            ...(position === "below"
              ? { top: "calc(100% + 6px)", left: "50%", transform: "translateX(-50%)" }
              : { bottom: "calc(100% + 6px)", left: "50%", transform: "translateX(-50%)" }
            ),
          }}
          onMouseEnter={handleEnter}
          onMouseLeave={handleLeave}
        >
          <StageCard events={events} currentStatus={so.status} />
        </div>
      )}
    </div>
  );
}