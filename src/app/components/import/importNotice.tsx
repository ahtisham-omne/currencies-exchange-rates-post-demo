import React, { useSyncExternalStore } from "react";
import { CheckCircle2, X as CloseIcon } from "lucide-react";

/**
 * The listing's post-import banner, ported from User Access Control.
 *
 * A modal that closes takes its summary with it. UAC leaves the outcome on
 * the listing itself, as a dismissible bar that survives navigating away
 * and back, so the person who imported forty records this morning can
 * still see how it went. Same store shape (module-level value plus
 * listeners, read through `useSyncExternalStore`), same bar: `#EFF6FF` on
 * `#BFDBFE`, severity-tinted counts, click-through to the run's detail
 * page, and an X that clears it until the next import.
 */

export type ImportNotice = {
  created: number;
  updated: number;
  skipped: number;
  warnings: number;
  importId: string;
} | null;

let notice: ImportNotice = null;
const listeners = new Set<() => void>();
function notify() {
  for (const fn of listeners) fn();
}

export function setImportNotice(summary: {
  created: number;
  updated: number;
  skipped: number;
  warnings: number;
  importId: string;
}): void {
  notice = { ...summary };
  notify();
}

export function dismissImportNotice(): void {
  if (notice === null) return;
  notice = null;
  notify();
}

export function useImportNotice(): ImportNotice {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    () => notice,
    () => notice,
  );
}

/* Outcome segments are tinted by severity (created in green 700, skipped in
 * red 700, warnings in amber 700) so the banner reads at a glance. */
function formatImportSummary(
  counts: { created: number; updated: number; skipped: number; warnings: number },
  entity: { singular: string; plural: string },
): React.ReactNode {
  const noun = (n: number, singular: string, plural: string) => `${n} ${n === 1 ? singular : plural}`;
  const parts: React.ReactNode[] = [];
  if (counts.created > 0) {
    parts.push(
      <span key="created" style={{ color: "#15803D" }}>
        {noun(counts.created, entity.singular, entity.plural)} created
      </span>,
    );
  }
  if (counts.updated > 0) {
    parts.push(<span key="updated">{noun(counts.updated, entity.singular, entity.plural)} updated</span>);
  }
  if (counts.skipped > 0) {
    parts.push(
      <span key="skipped" style={{ color: "#B91C1C" }}>
        {noun(counts.skipped, "row", "rows")} skipped
      </span>,
    );
  }
  if (counts.warnings > 0) {
    parts.push(
      <span key="warnings" style={{ color: "#B45309" }}>
        {noun(counts.warnings, "warning", "warnings")}
      </span>,
    );
  }
  if (parts.length === 0) return "Last import finished.";
  const out: React.ReactNode[] = ["Last import finished. "];
  parts.forEach((p, i) => {
    if (i > 0) out.push(", ");
    out.push(p);
  });
  out.push(".");
  return out;
}

export function ImportNoticeBanner({
  notice: value,
  entity,
  onOpenDetails,
  onDismiss,
}: {
  notice: NonNullable<ImportNotice>;
  entity: { singular: string; plural: string };
  onOpenDetails: () => void;
  onDismiss: () => void;
}) {
  return (
    <div
      className="relative mb-3 rounded-xl border overflow-hidden shrink-0"
      style={{ backgroundColor: "#EFF6FF", borderColor: "#BFDBFE" }}
      role="status"
    >
      <button
        type="button"
        onClick={onOpenDetails}
        aria-label="View import details (opens in new tab)"
        className="flex items-center gap-3 px-4 py-2.5 w-full text-left cursor-pointer transition-colors hover:bg-[#DBEAFE]/60"
      >
        <CheckCircle2 className="w-5 h-5 shrink-0" style={{ color: "#1D4ED8" }} />
        <span className="flex-1 text-[13.5px]" style={{ color: "#1E3A8A", fontWeight: 500 }}>
          {formatImportSummary(value, entity)}
        </span>
        {/* Spacer reserves room for the absolutely-positioned X */}
        <span aria-hidden className="shrink-0" style={{ width: 28, height: 28 }} />
      </button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-md flex items-center justify-center hover:bg-[#BFDBFE] transition-colors cursor-pointer"
        style={{ color: "#1E3A8A" }}
      >
        <CloseIcon className="w-4 h-4" />
      </button>
    </div>
  );
}
