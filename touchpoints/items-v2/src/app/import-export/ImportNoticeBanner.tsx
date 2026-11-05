/* Post-import notice on the Items listing (port of the UAC users-tab banner):
 * "Last import finished. 3 items created, 1 item updated, 1 row skipped."
 * Click opens the import record in a new tab (UAC parity); X dismisses. */
import { CheckCircle2, X } from "lucide-react";
import { ITEMS_IMPORT_SPEC } from "./spec";
import { useImportNotice } from "./importNotice";

function part(n: number, singular: string, plural: string, color?: string) {
  if (n <= 0) return null;
  return (
    <span key={singular} style={color ? { color } : undefined}>
      {n} {n === 1 ? singular : plural}
    </span>
  );
}

export function ImportNoticeBanner() {
  const [notice, dismiss] = useImportNotice();
  if (!notice) return null;
  const { singular, plural } = ITEMS_IMPORT_SPEC.nouns;
  const parts = [
    part(notice.created, `${singular} created`, `${plural} created`, "#15803D"),
    part(notice.updated, `${singular} updated`, `${plural} updated`),
    part(notice.skipped, "row skipped", "rows skipped", "#B91C1C"),
  ].filter(Boolean);
  const href = ITEMS_IMPORT_SPEC.routes.record.replace(":importId", notice.importId);
  return (
    <div
      className="relative mb-3 rounded-xl border overflow-hidden shrink-0"
      style={{ backgroundColor: "#EFF6FF", borderColor: "#BFDBFE" }}
      role="status"
    >
      <button
        type="button"
        onClick={() => window.open(href, "_blank", "noopener,noreferrer")}
        aria-label="View import details (opens in new tab)"
        className="flex items-center gap-3 px-4 py-2.5 w-full text-left cursor-pointer transition-colors hover:bg-[#DBEAFE]/60"
      >
        <CheckCircle2 className="w-5 h-5 shrink-0" style={{ color: "#1D4ED8" }} />
        <span className="flex-1 text-[13.5px]" style={{ color: "#1E3A8A", fontWeight: 500 }}>
          {parts.length === 0
            ? "Last import finished."
            : (
              <>
                {"Last import finished. "}
                {parts.map((p, i) => (
                  <span key={i}>
                    {i > 0 ? ", " : null}
                    {p}
                  </span>
                ))}
                {"."}
              </>
            )}
        </span>
        {/* Spacer reserves room for the absolutely-positioned X */}
        <span aria-hidden className="shrink-0" style={{ width: 28, height: 28 }} />
      </button>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-md flex items-center justify-center hover:bg-[#BFDBFE] transition-colors cursor-pointer"
        style={{ color: "#1E3A8A" }}
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
