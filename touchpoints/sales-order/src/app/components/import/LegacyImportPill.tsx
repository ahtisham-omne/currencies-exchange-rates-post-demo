import { History } from "lucide-react";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/app/components/ui/hover-card";

/**
 * "Legacy Import" — the header pill for a record that came from another
 * system rather than from Omne.
 *
 * The review sheet already carries this chip, so the same violet tone and
 * History glyph follow the record onto its detail page: someone who
 * imported a batch this morning should recognise the marker without
 * being told. Chrome is the header's own pill scale (24/22px tall, 11px
 * 600 text, shrinking with the sticky header like the version and
 * priority pills next to it), and the hover card is the shared
 * Partner-style dark-header card the status pill uses, because the
 * questions this pill invites, which run, which file, which rows, are
 * exactly the kind of provenance those cards answer elsewhere.
 */

export interface LegacyImportPillMeta {
  importedAt: string;
  importName?: string;
  fileName?: string;
  sourceRows: number[];
  sourceKey: string;
}

function fmtStamp(ts: string): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${mm}/${dd}/${d.getFullYear()} ${hh}:${mi}`;
}

/** "rows 4-6" for a contiguous run, "rows 4, 7, 9" otherwise. */
function fmtRows(rows: number[]): string {
  if (rows.length === 0) return "";
  if (rows.length === 1) return `row ${rows[0]}`;
  const contiguous = rows.every((r, i) => i === 0 || r === rows[i - 1] + 1);
  return contiguous ? `rows ${rows[0]}-${rows[rows.length - 1]}` : `rows ${rows.join(", ")}`;
}

export function LegacyImportPill({
  meta,
  isScrolled = false,
  recordNoun = "order",
}: {
  meta: LegacyImportPillMeta;
  isScrolled?: boolean;
  recordNoun?: string;
}) {
  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        <span
          className="inline-flex items-center gap-1 whitespace-nowrap bg-violet-50 border border-violet-200 text-violet-700"
          style={{
            height: isScrolled ? 22 : 24,
            padding: "0 8px",
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 600,
            cursor: "help",
            transition: "filter 150ms, box-shadow 150ms, transform 150ms",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.filter = "brightness(0.97)";
            e.currentTarget.style.boxShadow = "0 2px 8px -2px rgba(15, 23, 42, 0.14)";
            e.currentTarget.style.transform = "translateY(-0.5px)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.filter = "";
            e.currentTarget.style.boxShadow = "";
            e.currentTarget.style.transform = "";
          }}
        >
          <History style={{ width: 11, height: 11 }} strokeWidth={2.25} />
          Legacy Import
        </span>
      </HoverCardTrigger>

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
              <History className="w-3.5 h-3.5 text-white" strokeWidth={2} />
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <p className="text-[12px] text-white truncate" style={{ fontWeight: 600, letterSpacing: "0.01em" }}>
                Legacy Import
              </p>
              <span
                className="text-[10px] text-white/85"
                style={{ padding: "1px 6px", borderRadius: 999, background: "rgba(255,255,255,0.14)", fontWeight: 600, letterSpacing: "0.04em" }}
              >
                V1
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white px-3.5 py-3 flex flex-col" style={{ gap: 8 }}>
          <p className="text-[12px] text-slate-600" style={{ lineHeight: 1.55, margin: 0 }}>
            This {recordNoun} was brought in from a previous system, not created in Omne. It carries its original number and
            imported as version 1.
          </p>
          <Row label="Imported" value={fmtStamp(meta.importedAt)} />
          {meta.importName && <Row label="Run" value={meta.importName} />}
          {meta.fileName && <Row label="File" value={meta.fileName} />}
          <Row label="Source" value={`${meta.sourceKey}${meta.sourceRows.length ? ` · ${fmtRows(meta.sourceRows)}` : ""}`} />
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 min-w-0">
      <span className="text-[11px] text-slate-400 shrink-0" style={{ fontWeight: 600, width: 58 }}>
        {label}
      </span>
      <span className="text-[11.5px] text-foreground min-w-0 break-words" style={{ fontWeight: 500 }}>
        {value}
      </span>
    </div>
  );
}
