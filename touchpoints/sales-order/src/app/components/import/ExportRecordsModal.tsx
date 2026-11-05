import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Columns3, Download, FileType, GripVertical, Info, Layers, Loader2, Lock, Maximize2, Minimize2, Search, X,
} from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/app/components/ui/checkbox";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/app/components/ui/tooltip";
import { COLUMNS, KEY_COLUMN, RECORD_LABEL, RECORD_NOUN, RECORD_NOUN_PLURAL } from "./importSpec";
import { exportSubsetCsv, exportSubsetPdf, exportSubsetXlsx, type ExportRecord } from "./importExport";

/**
 * Export, ported from User Access Control's `ExportUsersModal`.
 *
 * Same two-panel shape: File Format on the left as three cards with a badge,
 * a radio and a plain-language description, Columns to Include on the right
 * with a search, a tri-state select-all, and one draggable card per column.
 * Same header (icon tile, title, subtitle, Full View, X), same scope banner,
 * same footer with the format-specific CTA and its spinner.
 *
 * What differs is the column list, which is this module's import template
 * rather than a user table. The template's optional columns start unchecked:
 * an export that mirrors what the importer actually needs is the useful
 * default, and 38 columns checked by default is not.
 */

type ExportFormat = "pdf" | "excel" | "csv";

const SHARED_BLUE = { border: "#2563EB", cardBg: "#F5FAFF", radio: "#2563EB", button: "#2563EB" };
const FORMAT_THEMES: Record<ExportFormat, { badgeBg: string; badgeText: string } & typeof SHARED_BLUE> = {
  pdf: { badgeBg: "#EFF6FF", badgeText: "#2563EB", ...SHARED_BLUE },
  excel: { badgeBg: "#ECFDF5", badgeText: "#047857", ...SHARED_BLUE },
  csv: { badgeBg: "#FFFBEB", badgeText: "#B45309", ...SHARED_BLUE },
};

const FORMAT_CARDS: { key: ExportFormat; badge: string; title: string; description: string }[] = [
  { key: "pdf", badge: "PDF", title: "PDF Document",
    description: "Best for reading and printing. Looks the same on any device, but cannot be edited." },
  { key: "excel", badge: "XLS", title: "Excel Spreadsheet",
    description: "Best for working with the data. Opens in Excel or Google Sheets, ready to sort, filter, and total." },
  { key: "csv", badge: "CSV", title: "CSV File",
    description: "Best for moving data between systems. A plain file that opens almost anywhere and keeps the raw values with no formatting." },
];

/** What each column means, for the row's info tooltip. */
function hintFor(key: string): string {
  const c = COLUMNS.find((x) => x.key === key);
  if (!c) return "";
  const level = c.level === "line" ? "One value per line item." : `One value per ${RECORD_NOUN}.`;
  const req =
    c.requirement === "required"
      ? "Required by the importer."
      : c.requirement === "conditional"
        ? c.conditionalNote ?? "Required in some cases."
        : "Optional.";
  const list = c.list ? " Holds a list, separated by a pipe." : "";
  return `${level} ${req}${list}`;
}

export function ExportRecordsModal({
  open,
  onClose,
  records,
  scopeNote,
}: {
  open: boolean;
  onClose: () => void;
  records: ExportRecord[];
  /** What the export covers, e.g. "Every quote on your list will be exported". */
  scopeNote: string;
}) {
  const [format, setFormat] = useState<ExportFormat>("excel");
  const [search, setSearch] = useState("");
  const [exporting, setExporting] = useState(false);
  const [fullScreen, setFullScreen] = useState(false);
  /* Order is the picker's, so a reorder changes the column order in the file. */
  const [order, setOrder] = useState<string[]>(() => COLUMNS.map((c) => c.key));
  const [checked, setChecked] = useState<Set<string>>(
    () => new Set(COLUMNS.filter((c) => c.requirement !== "optional").map((c) => c.key)),
  );
  const dragFrom = useRef<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const fields = useMemo(
    () => order.map((k) => COLUMNS.find((c) => c.key === k)).filter((c): c is (typeof COLUMNS)[number] => !!c),
    [order],
  );
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? fields.filter((c) => c.label.toLowerCase().includes(q)) : fields;
  }, [fields, search]);

  const master: boolean | "indeterminate" =
    checked.size === COLUMNS.length ? true : checked.size === 0 ? false : "indeterminate";

  const toggle = (key: string) => {
    if (key === KEY_COLUMN) return; /* the record's own number always ships */
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleAll = () => {
    setChecked((prev) =>
      prev.size === COLUMNS.length ? new Set([KEY_COLUMN]) : new Set(COLUMNS.map((c) => c.key)),
    );
  };

  const move = (from: string, to: string) => {
    if (from === to) return;
    setOrder((prev) => {
      const next = prev.filter((k) => k !== from);
      next.splice(next.indexOf(to), 0, from);
      return next;
    });
  };

  const selectedKeys = order.filter((k) => checked.has(k));

  const handleExport = async () => {
    if (exporting || selectedKeys.length === 0 || records.length === 0) return;
    setExporting(true);
    try {
      const stem = `${RECORD_LABEL.replace(/\s+/g, "_")}s_export`;
      if (format === "csv") exportSubsetCsv(records, selectedKeys, stem);
      else if (format === "excel") await exportSubsetXlsx(records, selectedKeys, stem);
      else await exportSubsetPdf(records, selectedKeys, stem);
      toast.success(`Exported ${records.length} ${records.length === 1 ? RECORD_NOUN : RECORD_NOUN_PLURAL}.`);
      onClose();
    } catch {
      toast.error("Export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  if (!open) return null;

  const exportLabel = exporting
    ? "Exporting…"
    : format === "pdf" ? "Export as PDF" : format === "excel" ? "Export as Excel" : "Export as CSV";

  return createPortal(
    <TooltipProvider delayDuration={200}>
      <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 12300, background: "rgba(15,23,42,0.6)" }} onClick={onClose}>
        <div
          className="bg-white flex flex-col overflow-hidden"
          style={{
            width: fullScreen ? "calc(100vw - 24px)" : "min(1060px, calc(100vw - 48px))",
            height: fullScreen ? "calc(100vh - 24px)" : "auto",
            maxHeight: fullScreen ? undefined : "min(900px, calc(100vh - 64px))",
            borderRadius: 16,
            boxShadow: "0 24px 80px -12px rgba(0,0,0,0.3)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* ── Header ── */}
          <div className="px-4 lg:px-5 pt-4 pb-4 shrink-0 bg-white border-b border-border">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="shrink-0 w-9 h-9 rounded-[10px] flex items-center justify-center" style={{ backgroundColor: "#EFF6FF" }}>
                  <Download className="w-[18px] h-[18px]" style={{ color: "#2563EB" }} />
                </div>
                <div className="min-w-0">
                  <h2 className="text-[15px] sm:text-[17px] text-foreground" style={{ fontWeight: 700 }}>
                    Export {RECORD_LABEL}s
                  </h2>
                  <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
                    Choose a format and the columns to include. Your export covers the {RECORD_NOUN_PLURAL} shown on the list now, with any filters or search you have applied.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => setFullScreen((v) => !v)}
                  className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] border border-border bg-white text-xs text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors cursor-pointer"
                  style={{ fontWeight: 500 }}
                >
                  {fullScreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                  {fullScreen ? "Exit Full" : "Full View"}
                </button>
                <button onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-[8px] flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* ── Body ── */}
          <div className="flex-1 min-h-0 bg-[#FAFBFC] overflow-hidden px-4 lg:px-6 py-4 lg:py-5 flex flex-col gap-4">
            <div className="shrink-0 rounded-[10px] border px-4 py-2.5 flex items-center gap-2.5" style={{ backgroundColor: "#F1F5F9", borderColor: "var(--border)" }}>
              <Layers className="w-[18px] h-[18px] shrink-0" style={{ color: "#64748B" }} />
              <div className="flex-1 min-w-0 text-[13px] leading-[20px] truncate text-left text-foreground">
                <span style={{ fontWeight: 600 }}>
                  {records.length} {records.length === 1 ? RECORD_NOUN : RECORD_NOUN_PLURAL}
                </span>{" "}
                <span className="text-slate-500">({scopeNote})</span>
              </div>
            </div>

            {/* What a row in the file is. Versions are the surprise worth
                stating: only the current one leaves. */}
            <p className="shrink-0 text-[11.5px] text-slate-500 px-1" style={{ marginTop: -6 }}>
              Only the latest version of each order is exported. Earlier versions stay in Omne.
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-[1.55fr_1fr] gap-5 flex-1 min-h-0">
              {/* ── File format ── */}
              <div className="rounded-[12px] border border-border bg-white flex flex-col overflow-hidden">
                <div className="px-5 pt-3 pb-3 shrink-0 flex items-center gap-2" style={{ backgroundColor: "#F8FAFC" }}>
                  <FileType className="w-4 h-4 shrink-0" style={{ color: "#64748B" }} />
                  <h3 className="text-[14px] text-foreground" style={{ fontWeight: 600 }}>File Format</h3>
                </div>
                <div className="border-t border-border shrink-0" />
                <div className="flex-1 overflow-y-auto px-5 pb-3 pt-4" style={{ minHeight: 0 }}>
                  <div className="space-y-3">
                    {FORMAT_CARDS.map((card) => (
                      <FormatCardRow key={card.key} card={card} isSelected={format === card.key} onSelect={() => setFormat(card.key)} />
                    ))}
                  </div>
                </div>
              </div>

              {/* ── Columns ── */}
              <div className="rounded-[12px] border border-border bg-white flex flex-col overflow-hidden">
                <div className="px-5 pt-3 pb-3 shrink-0 flex items-center gap-2" style={{ backgroundColor: "#F8FAFC" }}>
                  <Columns3 className="w-4 h-4 shrink-0" style={{ color: "#64748B" }} />
                  <h3 className="text-[14px] text-foreground" style={{ fontWeight: 600 }}>Columns to Include</h3>
                </div>
                <div className="border-t border-border shrink-0" />

                <div className="px-5 pt-4 pb-2 shrink-0">
                  <div className="flex items-center gap-2 px-3 h-9 rounded-[8px] border border-border bg-white">
                    <Search className="w-4 h-4 text-slate-400" />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search columns"
                      className="flex-1 outline-none text-[13px] bg-transparent placeholder:text-slate-400"
                    />
                    {search && (
                      <button onClick={() => setSearch("")} aria-label="Clear search" className="p-0.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="px-5 py-2 flex items-center gap-2 shrink-0">
                  <Checkbox checked={master} onCheckedChange={toggleAll} aria-label="Select all columns" />
                  <span className="text-[12px] text-slate-600" style={{ fontWeight: 500 }}>
                    {master === true
                      ? `All ${COLUMNS.length} columns selected`
                      : checked.size > 0
                        ? `${checked.size} of ${COLUMNS.length} columns selected`
                        : "Select All Columns"}
                  </span>
                </div>

                {checked.size === 0 && (
                  <div className="px-5 py-2 border-b shrink-0" style={{ backgroundColor: "#FEF3C7", borderColor: "#FDE68A", color: "#92400E" }}>
                    <span className="text-[12px]" style={{ fontWeight: 500 }}>Pick at least one column to export.</span>
                  </div>
                )}

                <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1.5" style={{ minHeight: 0 }}>
                  {filtered.length === 0 ? (
                    <div className="px-4 py-12 text-center text-[12.5px] text-slate-400">No Columns Match Your Search.</div>
                  ) : (
                    filtered.map((c) => (
                      <FieldCard
                        key={c.key}
                        label={c.label}
                        hint={hintFor(c.key)}
                        locked={c.key === KEY_COLUMN}
                        checked={checked.has(c.key)}
                        onToggle={() => toggle(c.key)}
                        onDragStart={() => { dragFrom.current = c.key; }}
                        onDropOn={() => { if (dragFrom.current) move(dragFrom.current, c.key); dragFrom.current = null; }}
                      />
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── Footer ── */}
          <div className="shrink-0 border-t border-border bg-white px-4 lg:px-5 py-2.5 sm:py-3 flex items-center gap-2 sm:gap-2.5">
            <div className="flex-1" />
            <button
              onClick={onClose}
              className="inline-flex items-center justify-center px-3 sm:px-5 h-8 sm:h-9 rounded-[8px] border border-border bg-white text-xs sm:text-[13px] text-slate-500 hover:text-foreground hover:border-slate-300 transition-colors cursor-pointer"
              style={{ fontWeight: 500 }}
            >
              Cancel
            </button>
            <button
              onClick={handleExport}
              disabled={checked.size === 0 || exporting || records.length === 0}
              className="inline-flex items-center gap-1.5 px-3 sm:px-5 h-8 sm:h-9 rounded-[8px] text-white shadow-sm transition-colors cursor-pointer text-xs sm:text-[13px] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ fontWeight: 600, backgroundColor: "#2563EB" }}
            >
              {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              {exportLabel}
            </button>
          </div>
        </div>
      </div>
    </TooltipProvider>,
    document.body,
  );
}

function FormatCardRow({
  card, isSelected, onSelect,
}: {
  card: (typeof FORMAT_CARDS)[number];
  isSelected: boolean;
  onSelect: () => void;
}) {
  const t = FORMAT_THEMES[card.key];
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="w-full text-left rounded-[12px] border p-3.5 transition-all duration-150 cursor-pointer"
      style={{
        borderColor: isSelected ? "#0A77FF" : hovered ? "#CBD5E1" : "#E2E8F0",
        backgroundColor: isSelected ? "#F5F9FF" : hovered ? "#FAFCFF" : "#FFFFFF",
        boxShadow: isSelected
          ? "0 0 0 1px rgba(10,119,255,0.15), 0 1px 3px rgba(10,119,255,0.06)"
          : hovered
            ? "0 2px 8px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)"
            : "0 1px 2px 0 rgba(15, 23, 42, 0.04), 0 1px 3px 0 rgba(15, 23, 42, 0.06)",
      }}
    >
      <div className="flex items-start justify-between mb-2.5">
        <span
          className="inline-flex items-center justify-center w-9 h-9 rounded-[8px] text-[10px] tracking-[0.04em]"
          style={{ backgroundColor: t.badgeBg, color: t.badgeText, fontWeight: 700 }}
        >
          {card.badge}
        </span>
        <span className="shrink-0 w-4 h-4 rounded-full border-[1.5px] flex items-center justify-center mt-1" style={{ borderColor: isSelected ? t.radio : "#CBD5E1" }}>
          {isSelected && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: t.radio }} />}
        </span>
      </div>
      <div className="text-[13px] leading-[18px] text-foreground" style={{ fontWeight: 600 }}>{card.title}</div>
      <div className="text-[11.5px] leading-[15px] mt-1 text-slate-500">{card.description}</div>
    </button>
  );
}

function FieldCard({
  label, hint, locked, checked, onToggle, onDragStart, onDropOn,
}: {
  label: string;
  hint: string;
  locked: boolean;
  checked: boolean;
  onToggle: () => void;
  onDragStart: () => void;
  onDropOn: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const showHover = hovered && !locked;
  return (
    <div
      draggable={!locked}
      onDragStart={onDragStart}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDropOn}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onToggle}
      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-[10px] border transition-colors ${locked ? "cursor-default" : "cursor-pointer"}`}
      style={{
        borderColor: showHover ? "#CBD5E1" : checked ? "#BFDBFE" : "#E2E8F0",
        backgroundColor: showHover ? "#FAFCFF" : "#FFFFFF",
      }}
    >
      <span className={`shrink-0 ${locked ? "text-slate-200" : "text-slate-300"}`} aria-hidden>
        <GripVertical className="w-3.5 h-3.5" />
      </span>
      <span onClick={(e) => e.stopPropagation()} className="shrink-0">
        <Checkbox checked={checked} disabled={locked} onCheckedChange={onToggle} aria-label={label} />
      </span>
      {locked && <Lock className="w-3 h-3 text-slate-400 shrink-0" />}
      <span className="text-[13px] text-foreground truncate flex-1">{label}</span>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="shrink-0 text-slate-400 cursor-help" onClick={(e) => e.stopPropagation()}>
            <Info className="w-3.5 h-3.5" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="left" className="max-w-[240px] text-[11.5px] leading-[1.5] z-[12400]">
          {hint}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
