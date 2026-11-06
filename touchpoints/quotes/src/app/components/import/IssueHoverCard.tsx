import type { ReactNode } from "react";
import { AlertCircle, AlertTriangle } from "lucide-react";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/app/components/ui/hover-card";
import type { Issue } from "./importModel";

/**
 * What is wrong with this cell, and what happens next.
 *
 * A tinted cell and a tooltip string were not enough: an error and a warning
 * look alike at a glance, and the tooltip could not say what the row would do
 * on import. This is the module's hover card, the same dark-header card the
 * status pills and provenance pills use, carrying three things: the severity,
 * the reason, and the consequence.
 *
 * The consequence line is the important one. An error holds the row back until
 * it is fixed. A warning never does: the row imports as it stands, and fixing
 * it is the reader's choice.
 */
export function IssueHoverCard({ issues, children }: { issues: Issue[]; children: ReactNode }) {
  if (issues.length === 0) return <>{children}</>;

  const worst = issues.find((i) => i.severity === "error") ?? issues[0];
  const isError = worst.severity === "error";
  const Icon = isError ? AlertCircle : AlertTriangle;

  return (
    <HoverCard openDelay={150} closeDelay={80}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent
        side="bottom"
        align="start"
        sideOffset={8}
        className="w-[300px] p-0 rounded-xl border-0 shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden z-[12500]"
      >
        <div className="bg-gradient-to-br from-slate-800 to-slate-700 px-3.5 py-2.5 relative overflow-hidden">
          <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/[0.04]" />
          <div className="relative flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
              <Icon className="w-3.5 h-3.5 text-white" strokeWidth={2} />
            </div>
            <p className="text-[12px] text-white truncate" style={{ fontWeight: 600, letterSpacing: "0.01em" }}>
              {isError ? "Error" : "Warning"}
            </p>
            <span
              className="ml-auto text-[10px] text-white/85 shrink-0"
              style={{ padding: "1px 6px", borderRadius: 999, background: "rgba(255,255,255,0.14)", fontWeight: 600, letterSpacing: "0.04em" }}
            >
              {isError ? "BLOCKS IMPORT" : "IMPORTS AS IS"}
            </span>
          </div>
        </div>

        <div className="bg-white px-3.5 py-3 flex flex-col" style={{ gap: 8 }}>
          {issues.map((issue, i) => (
            <p key={i} className="text-[12px] text-slate-600" style={{ lineHeight: 1.55, margin: 0 }}>
              {issue.message}
            </p>
          ))}
          <p className="text-[11.5px] text-slate-400" style={{ lineHeight: 1.5, margin: 0 }}>
            {isError
              ? "This row stays out of the import until the cell is fixed. It is kept, so it can be finished later."
              : "This row imports as it stands. Fix it here only if the value is wrong."}
          </p>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
