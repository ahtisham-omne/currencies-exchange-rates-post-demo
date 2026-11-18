/* The correction banner shown at the top of both import review modals.
 *
 * Module-agnostic on purpose: everything it renders comes out of
 * correctionLink.ts, which speaks in parent snapshots and row buckets rather
 * than users or roles. The Users and Roles review modals are otherwise
 * mirrored line for line, but duplicating ~180 lines of banner into both
 * would guarantee they drift.
 *
 * This is the one place the system states what it believes this upload is,
 * and the one place the admin can overrule it. */

import type { ReactNode } from "react";
import { CornerDownRight, Link2 } from "lucide-react";
import { cn } from "../../ui/utils";
import type { BucketCounts, CorrectionDetection } from "../correctionLink";

/* Sits between the modal header and the grid so it reads before the data,
 * not as an afterthought under it. */
export function CorrectionBanner({
  detection,
  linked,
  onLinkChange,
  counts,
  alreadyImportedCount,
  onRemoveAlreadyImported,
}: {
  detection: CorrectionDetection;
  linked: boolean;
  onLinkChange: (next: boolean) => void;
  counts: BucketCounts;
  alreadyImportedCount: number;
  onRemoveAlreadyImported: () => void;
}) {
  if (detection.kind === "none") return null;

  const { parent, confidence } = detection;

  /* Detected but not linked: either a key-matched guess awaiting
   * confirmation, or a link the admin deliberately turned off. */
  if (!linked) {
    return (
      <BannerShell
        tone="neutral"
        icon={<CornerDownRight className="w-4 h-4" style={{ color: "#64748B" }} />}
        action={
          <BannerButton tone="neutral" onClick={() => onLinkChange(true)}>
            <Link2 className="w-3.5 h-3.5" />
            Link to it
          </BannerButton>
        }
      >
        {confidence === "suggested" ? (
          <>
            <span style={{ fontWeight: 600 }}>These rows look like corrections of {parent.fileName}.</span>{" "}
            Link them and the rows you fixed will close out on that import instead of importing as a
            separate one.
          </>
        ) : (
          <>
            <span style={{ fontWeight: 600 }}>Importing on its own.</span> This file came from{" "}
            {parent.fileName}, but it will be recorded as a separate import.
          </>
        )}
      </BannerShell>
    );
  }

  const confidenceNote =
    confidence === "session"
      ? "you opened this from that import"
      : "matched on the rows themselves";

  return (
    <BannerShell
      tone="info"
      icon={<CornerDownRight className="w-4 h-4" style={{ color: "#0A77FF" }} />}
      action={
        <BannerButton tone="info" onClick={() => onLinkChange(false)}>
          Import separately
        </BannerButton>
      }
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span style={{ fontWeight: 600, color: "#0F172A" }}>
          Correcting {parent.fileName}
        </span>
        <span style={{ color: "#64748B" }}>({confidenceNote})</span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
        <BucketPill tone="info">{counts.matched} matched</BucketPill>
        {counts.resolved > 0 && <BucketPill tone="muted">{counts.resolved} already imported</BucketPill>}
        {counts.new > 0 && <BucketPill tone="muted">{counts.new} new</BucketPill>}
        {alreadyImportedCount > 0 && (
          <button
            type="button"
            onClick={onRemoveAlreadyImported}
            className="underline underline-offset-2 text-[#0A77FF] hover:text-[#0066D6] cursor-pointer ml-0.5"
            style={{ fontSize: "12px", fontWeight: 500 }}
          >
            Remove the {alreadyImportedCount === 1 ? "row" : `${alreadyImportedCount} rows`} already
            imported
          </button>
        )}
      </div>
    </BannerShell>
  );
}

const BANNER_TONES = {
  info: { bg: "#EFF6FF", border: "#BFDBFE", text: "#1E3A8A" },
  neutral: { bg: "#F8FAFC", border: "#E2E8F0", text: "#334155" },
} as const;

function BannerShell({
  tone,
  icon,
  action,
  children,
}: {
  tone: keyof typeof BANNER_TONES;
  icon: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  const t = BANNER_TONES[tone];
  return (
    <div
      className="shrink-0 flex items-start gap-2.5 px-4 lg:px-6 py-2.5 border-b"
      style={{ backgroundColor: t.bg, borderBottomColor: t.border }}
    >
      <span className="shrink-0 mt-0.5">{icon}</span>
      <div className="min-w-0 flex-1" style={{ fontSize: "12.5px", lineHeight: 1.5, color: t.text }}>
        {children}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

function BannerButton({
  tone,
  onClick,
  children,
}: {
  tone: "info" | "neutral";
  onClick: () => void;
  children: ReactNode;
}) {
  const info = tone === "info";
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 h-8 px-3 rounded-md border bg-white shadow-sm transition-colors cursor-pointer",
        info
          ? "border-[#BFDBFE] text-[#0A77FF] hover:bg-[#EFF6FF]"
          : "border-[#CBD5E1] text-[#334155] hover:bg-[#F1F5F9]",
      )}
      style={{ fontSize: "12.5px", fontWeight: 500 }}
    >
      {children}
    </button>
  );
}

function BucketPill({ tone, children }: { tone: "info" | "muted"; children: ReactNode }) {
  const info = tone === "info";
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full border whitespace-nowrap"
      style={{
        fontSize: "11.5px",
        fontWeight: 500,
        backgroundColor: info ? "#DBEAFE" : "#F1F5F9",
        color: info ? "#1E40AF" : "#475569",
        borderColor: info ? "#BFDBFE" : "#E2E8F0",
      }}
    >
      {children}
    </span>
  );
}
