/* Post-import notice shown on the listing (UAC users-tab banner). Click opens
 * the import record in a new tab; X dismisses. */

import { CheckCircle2, X } from "lucide-react";
import type { EntitySpec } from "./spec";

export interface ImportNotice {
  created: number;
  updated: number;
  skipped: number;
  warnings: number;
  importId: string;
}

function part(n: number, label: string, color?: string) {
  if (n <= 0) return null;
  return (
    <span key={label} style={color ? { color } : undefined}>
      {n} {label}
    </span>
  );
}

export function ImportNoticeBanner({ spec, notice, onDismiss }: { spec: EntitySpec<unknown>; notice: ImportNotice | null; onDismiss: () => void }) {
  if (!notice) return null;
  const noun = (n: number) => (n === 1 ? spec.nounLower : spec.nounPluralLower);
  const parts = [
    part(notice.created, `${noun(notice.created)} created`, "#15803D"),
    part(notice.updated, `${noun(notice.updated)} updated`),
    part(notice.skipped, `${notice.skipped === 1 ? "row" : "rows"} skipped`, "#B91C1C"),
    part(notice.warnings, `${notice.warnings === 1 ? "warning" : "warnings"}`, "#B45309"),
  ].filter((p): p is JSX.Element => !!p);
  const href = spec.routes.recordHref(notice.importId);
  return (
    <div className="relative mb-3 rounded-xl border overflow-hidden shrink-0" style={{ backgroundColor: "#EFF6FF", borderColor: "#BFDBFE" }} role="status">
      <button
        type="button"
        onClick={() => window.open(href, "_blank", "noopener,noreferrer")}
        aria-label="View import details (opens in new tab)"
        className="flex items-center gap-3 px-4 py-2.5 w-full text-left cursor-pointer transition-colors hover:bg-[#DBEAFE]/60"
      >
        <CheckCircle2 className="w-5 h-5 shrink-0" style={{ color: "#1D4ED8" }} />
        <span className="flex-1 text-[13.5px]" style={{ color: "#1E3A8A", fontWeight: 500 }}>
          Last import finished.{" "}
          {parts.length > 0 &&
            parts.map((p, i) => (
              <span key={i}>
                {p}
                {i < parts.length - 1 ? ", " : "."}
              </span>
            ))}
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
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
