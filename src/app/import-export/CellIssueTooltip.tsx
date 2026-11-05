/* Cell-level chrome for the review grid and the import record page (port of
 * role-zen's CellIssueTooltip / UpdateCellTooltip / EditedIndicator /
 * StatusChip / RowOpBadge from ImportReviewModal.tsx). Issues surface as a
 * hover tooltip over the whole cell, never as inline text. */
import type { ReactNode } from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { CellIssue, RowStatus } from "./validation";

export const CELL_FONT = "Aptos, Inter, ui-sans-serif, system-ui, -apple-system";
const MONO_FONT = "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace";

const ARROW_STYLE = { fill: "white", stroke: "#E2E8F0", strokeWidth: 1 } as const;

/* ─── Result pills ─── */

export const ROW_STATUS_TOKENS: Record<RowStatus, { bg: string; text: string; border: string; label: string }> = {
  ready: { bg: "#ECFDF5", text: "#065F46", border: "#D1FAE5", label: "Ready" },
  warning: { bg: "#FFFBEB", text: "#92400E", border: "#FEF3C7", label: "Warning" },
  error: { bg: "#FEF2F2", text: "#991B1B", border: "#FEE2E2", label: "Error" },
};

export function StatusChip({ status }: { status: RowStatus }) {
  const t = ROW_STATUS_TOKENS[status];
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full border whitespace-nowrap"
      style={{ backgroundColor: t.bg, color: t.text, borderColor: t.border, fontSize: "11px", fontWeight: 600 }}
      aria-label={status}
    >
      {t.label}
    </span>
  );
}

export function RowOpBadge({ singular }: { singular: string }) {
  return (
    <span
      className="inline-flex items-center justify-center h-[18px] px-1.5 rounded-full whitespace-nowrap"
      style={{ backgroundColor: "rgba(10,119,255,0.1)", color: "#0A77FF", fontSize: "10px", fontWeight: 600 }}
      title={`Part Number matches an existing ${singular}. This row will update that ${singular}.`}
    >
      Update
    </span>
  );
}

/* ─── Issue tooltip ─── */

const TRIGGER_STYLE: React.CSSProperties = {
  height: "100%",
  width: "calc(100% + 24px)",
  marginLeft: -12,
  marginRight: -12,
  paddingLeft: 12,
  paddingRight: 12,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "pre",
};

/* Every issue is an error (there are no warnings). */
function IssueBadge() {
  return (
    <span
      className="inline-flex items-center self-start px-2 py-0.5 rounded-full border whitespace-nowrap"
      style={{
        backgroundColor: "#FEF2F2",
        color: "#DC2626",
        borderColor: "#FECACA",
        fontSize: "11px",
        fontWeight: 600,
      }}
    >
      Error
    </span>
  );
}

function IssueBlock({ issue, first }: { issue: CellIssue; first: boolean }) {
  const hasOptions = !!issue.options && issue.options.length > 0;
  return (
    <div className={`p-3 flex flex-col gap-2 ${first ? "" : "border-t border-[#E2E8F0]"}`}>
      <IssueBadge />
      <p className="text-[#1E293B]" style={{ fontSize: "13px", fontWeight: 400, lineHeight: 1.5 }}>
        {issue.explanation || issue.message}
      </p>
      {(issue.example || hasOptions) && (
        <div className="rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-2 flex flex-col gap-1">
          <span className="text-[#94A3B8] uppercase" style={{ fontSize: "11px", fontWeight: 500, letterSpacing: "0.04em" }}>
            {hasOptions ? "Options" : "Example"}
          </span>
          {hasOptions ? (
            <div className="flex flex-wrap gap-1">
              {issue.options!.slice(0, 12).map((o) => (
                <span
                  key={o}
                  className="inline-flex items-center px-1.5 py-0.5 rounded border border-[#E2E8F0] bg-white text-[#475569]"
                  style={{ fontSize: "11px", fontWeight: 500 }}
                >
                  {o}
                </span>
              ))}
              {issue.options!.length > 12 && (
                <span className="inline-flex items-center px-1.5 py-0.5 text-[#94A3B8]" style={{ fontSize: "11px", fontWeight: 500 }}>
                  +{issue.options!.length - 12} more
                </span>
              )}
            </div>
          ) : (
            <span className="text-[#334155] break-words" style={{ fontSize: "13px", fontWeight: 500, fontFamily: MONO_FONT, lineHeight: 1.4 }}>
              {issue.example}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function CellIssueTooltip({ issues, children }: { issues: CellIssue[]; children: ReactNode }) {
  return (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>
        <span className="flex items-center cursor-help" style={TRIGGER_STYLE}>
          {/* Its own box, so a long value ends in "…" like every other cell. */}
          <span className="block min-w-0 truncate">{children}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        sideOffset={8}
        collisionPadding={12}
        className="z-[200] max-w-[320px] bg-white border border-[#E2E8F0] rounded-lg p-0 text-[#0F172A]"
        style={{ boxShadow: "0 4px 12px rgba(0,0,0,0.10)" }}
      >
        {issues.map((issue, i) => (
          <IssueBlock key={`${issue.code}-${i}`} issue={issue} first={i === 0} />
        ))}
        <TooltipPrimitive.Arrow width={10} height={5} style={ARROW_STYLE} />
      </TooltipContent>
    </Tooltip>
  );
}

export function UpdateCellTooltip({ singular, children }: { singular: string; children: ReactNode }) {
  return (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>
        <span className="flex items-center cursor-help" style={TRIGGER_STYLE}>
          {/* Its own box, so a long value ends in "…" like every other cell. */}
          <span className="block min-w-0 truncate">{children}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        sideOffset={8}
        collisionPadding={12}
        className="z-[200] max-w-[320px] bg-white border border-[#E2E8F0] rounded-lg p-0 text-[#0F172A]"
        style={{ boxShadow: "0 4px 12px rgba(0,0,0,0.10)" }}
      >
        <div className="p-3 flex flex-col gap-2">
          <span
            className="inline-flex items-center self-start px-2 py-0.5 rounded-full border whitespace-nowrap"
            style={{ backgroundColor: "#EFF6FF", color: "#0A77FF", borderColor: "#BFDBFE", fontSize: "11px", fontWeight: 600 }}
          >
            Update
          </span>
          <p className="text-[#1E293B]" style={{ fontSize: "13px", lineHeight: 1.5 }}>
            This row updates an existing {singular}, matched by part number. This value will replace the {singular}'s current value on
            import.
          </p>
        </div>
        <TooltipPrimitive.Arrow width={10} height={5} style={ARROW_STYLE} />
      </TooltipContent>
    </Tooltip>
  );
}

/* ─── Edited-cell corner triangle ─── */

export function EditedIndicator({ originalValue }: { originalValue: string }) {
  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <span
          className="absolute top-0 left-0 cursor-help"
          style={{ width: 0, height: 0, borderTop: "6px solid #0A77FF", borderRight: "6px solid transparent", zIndex: 2 }}
          aria-label="Edited cell"
        />
      </TooltipTrigger>
      <TooltipContent
        side="top"
        sideOffset={6}
        className="z-[200] max-w-[260px] bg-white border border-[#BFDBFE] text-[#0F172A] px-3 py-2 rounded-lg shadow-lg"
      >
        <span style={{ fontSize: "12.5px", fontWeight: 500, lineHeight: 1.4 }}>
          Edited, original value:{" "}
          {originalValue.trim() === "" ? <em className="text-[#94A3B8] not-italic">empty</em> : `"${originalValue}"`}
        </span>
        <TooltipPrimitive.Arrow width={10} height={5} style={{ fill: "white", stroke: "#BFDBFE", strokeWidth: 1 }} />
      </TooltipContent>
    </Tooltip>
  );
}
