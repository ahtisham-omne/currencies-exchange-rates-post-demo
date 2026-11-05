/* The correction marker shown next to the "Review and Fix Your Data" title
   (ported from the hub's import-review/CorrectionBanner.tsx). A small chip,
   not a banner: it says which import these rows nest under, with the one
   action to overrule it. Returns null when nothing was detected. */

import type { ReactNode } from "react";
import { CornerDownRight } from "lucide-react";
import type { CorrectionDetection } from "./importHistory";

export interface CorrectionBannerProps {
  detection: CorrectionDetection;
  /** Fix Failed Rows: always part of that import, so no "Import separately". */
  locked?: boolean;
  linked: boolean;
  onLinkChange: (linked: boolean) => void;
  /** Kept for the callers; the chip no longer lists the buckets. */
  counts?: { matched: number; resolved: number; new: number };
  alreadyImportedCount: number;
  onRemoveAlreadyImported: () => void;
}

export function CorrectionBanner({ detection, locked = false, linked, onLinkChange, alreadyImportedCount: removable, onRemoveAlreadyImported }: CorrectionBannerProps) {
  if (detection.kind === "none") return null;
  const { parent, confidence } = detection;

  if (!linked) {
    return (
      <Chip
        tone="neutral"
        title={
          confidence === "suggested"
            ? `These rows look like corrections of ${parent.fileName}. Link them and the rows you fixed will close out on that import instead of importing as a separate one.`
            : `This file came from ${parent.fileName}, but it will be recorded as a separate import.`
        }
        action={<ChipAction tone="neutral" onClick={() => onLinkChange(true)}>Link to it</ChipAction>}
      >
        {confidence === "suggested" ? `Corrections of ${parent.fileName}?` : "Importing on its own"}
      </Chip>
    );
  }

  const alreadyImportedCount = removable;
  return (
    <Chip
      tone="info"
      title={`Correcting ${parent.fileName}`}
      action={
        <>
          {alreadyImportedCount > 0 && (
            <ChipAction tone="info" onClick={onRemoveAlreadyImported}>
              Remove the {alreadyImportedCount === 1 ? "row" : `${alreadyImportedCount} rows`} already imported
            </ChipAction>
          )}
          {!locked && (
            <ChipAction tone="info" onClick={() => onLinkChange(false)}>
              Import separately
            </ChipAction>
          )}
        </>
      }
    >
      Correcting {parent.fileName}
    </Chip>
  );
}

const CHIP_TONES = {
  info: { bg: "#EFF6FF", border: "#BFDBFE", text: "#1E3A8A", icon: "#0A77FF", action: "#0A77FF", actionHover: "#0066D6" },
  neutral: { bg: "#F8FAFC", border: "#E2E8F0", text: "#334155", icon: "#64748B", action: "#334155", actionHover: "#0F172A" },
} as const;

function Chip({ tone, title, action, children }: { tone: keyof typeof CHIP_TONES; title: string; action?: ReactNode; children: ReactNode }) {
  const t = CHIP_TONES[tone];
  return (
    <span
      className="inline-flex items-center gap-1.5 h-[22px] px-2 rounded-md border min-w-0 max-w-full shrink"
      style={{ backgroundColor: t.bg, borderColor: t.border, color: t.text, fontSize: "11.5px", fontWeight: 500 }}
      title={title}
    >
      <CornerDownRight className="w-3 h-3 shrink-0" style={{ color: t.icon }} aria-hidden />
      <span className="truncate">{children}</span>
      {action}
    </span>
  );
}

function ChipAction({ tone, onClick, children }: { tone: keyof typeof CHIP_TONES; onClick: () => void; children: ReactNode }) {
  const t = CHIP_TONES[tone];
  return (
    <>
      <span aria-hidden className="w-px h-3 shrink-0" style={{ backgroundColor: t.border }} />
      <button
        type="button"
        onClick={onClick}
        className="shrink-0 whitespace-nowrap cursor-pointer underline-offset-2 hover:underline focus-visible:underline outline-none transition-colors"
        style={{ color: t.action, fontSize: "11.5px", fontWeight: 600 }}
        onMouseEnter={(e) => (e.currentTarget.style.color = t.actionHover)}
        onMouseLeave={(e) => (e.currentTarget.style.color = t.action)}
      >
        {children}
      </button>
    </>
  );
}
