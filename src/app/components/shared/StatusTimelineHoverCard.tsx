import React from "react";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import { Clock } from "lucide-react";

/* ════════════════════════════════════════════════════════════════
   StatusTimelineHoverCard — Partner-style status timeline overlay.

   Wraps the header status pill with a Radix HoverCard that renders
   a compact dark header + white scrollable body listing every
   transition oldest → newest. The header shows a fixed "Status
   timeline" label (record number + counter are redundant — the
   number already sits in the header above the pill, and the count
   is derivable from the list).

   Body caps around five visible rows before scrolling, so records
   with 20-50 rejections/reactivations still fit into the same
   fixed card.
   ═══════════════════════════════════════════════════════════════ */

export interface StatusTimelineEntry {
  timestamp: string | Date;
  label: string;
  detail?: string;
  tone?: "neutral" | "info" | "success" | "warning" | "destructive";
}

interface StatusTimelineHoverCardProps {
  entries: StatusTimelineEntry[];
  /** Optional version label (e.g. "V2") shown next to the title so
   *  it's clear the trail is scoped to a specific version. */
  versionLabel?: string;
  children: React.ReactNode;
}

const TONE_DOT: Record<NonNullable<StatusTimelineEntry["tone"]>, string> = {
  neutral: "#94A3B8",
  info: "#0A77FF",
  success: "#059669",
  warning: "#D97706",
  destructive: "#DC2626",
};

function fmtStamp(ts: string | Date): string {
  try {
    const d = ts instanceof Date ? ts : new Date(ts);
    if (Number.isNaN(d.getTime())) return String(ts);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${mm}/${dd}/${yyyy} ${hh}:${mi}`;
  } catch {
    return String(ts);
  }
}

export function StatusTimelineHoverCard({ entries, versionLabel, children }: StatusTimelineHoverCardProps) {
  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent
        side="bottom"
        align="start"
        sideOffset={8}
        className="w-[280px] p-0 rounded-xl border-0 shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden z-[500]"
      >
        <div className="bg-gradient-to-br from-slate-800 to-slate-700 px-3.5 py-2.5 relative overflow-hidden">
          <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/[0.04]" />
          <div className="relative flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
              <Clock className="w-3.5 h-3.5 text-white" strokeWidth={2} />
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <p className="text-[12px] text-white truncate" style={{ fontWeight: 600, letterSpacing: "0.01em" }}>Status History</p>
              {versionLabel && (
                <span
                  className="text-[10px] text-white/85"
                  style={{
                    padding: "1px 6px", borderRadius: 999,
                    background: "rgba(255,255,255,0.14)",
                    fontWeight: 600, letterSpacing: "0.04em",
                  }}
                >
                  {versionLabel}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white" style={{ maxHeight: 260, overflowY: "auto" }}>
          {entries.length === 0 ? (
            <div className="px-3.5 py-4 text-[12px] text-slate-500">
              No status transitions yet.
            </div>
          ) : (
            <ol className="relative px-3.5 py-3" style={{ margin: 0 }}>
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  left: 24,
                  top: 22,
                  bottom: 22,
                  width: 1,
                  backgroundColor: "#E2E8F0",
                }}
              />
              {entries.map((e, i) => {
                const dotColor = TONE_DOT[e.tone ?? "neutral"];
                const isLast = i === entries.length - 1;
                return (
                  <li key={`${i}-${e.timestamp}`} className="relative flex items-start gap-3" style={{ paddingBottom: isLast ? 0 : 12, listStyle: "none" }}>
                    <div
                      aria-hidden
                      style={{
                        width: 11,
                        height: 11,
                        borderRadius: 999,
                        backgroundColor: dotColor,
                        border: "2px solid #FFFFFF",
                        boxShadow: `0 0 0 1px ${dotColor}55`,
                        marginTop: 4,
                        marginLeft: 5,
                        flexShrink: 0,
                        zIndex: 1,
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] text-slate-500 tabular-nums whitespace-nowrap leading-none">
                        {fmtStamp(e.timestamp)}
                      </div>
                      <div className="text-[12.5px] text-slate-900 truncate mt-0.5" style={{ fontWeight: 600 }}>
                        {e.label}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

export default StatusTimelineHoverCard;
