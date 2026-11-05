/**
 * AttachmentsTab — canonical density + card-size pattern.
 *
 * Stakeholder approved this as the standard for tab content density
 * across the partner detail page ("It's got what I want on a card
 * size — yeah, this feels really good. Done."). The three-tier
 * density selector (condensed / comfort / card) plus the card-size
 * sub-menu under the "card" tier is the reference any other tab
 * should follow when adding density controls.
 *
 * If you're building a new tab and considering density toggles, mirror
 * the ATTACH_DENSITY_CONFIG shape and the dropdown structure below
 * rather than inventing a new pattern.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Input } from "../ui/input";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "../ui/dropdown-menu";
import {
  Search, X, Upload, LayoutGrid, List, AlignJustify, MoreVertical,
  ChevronDown, Check, FileText, FileSpreadsheet, Image as ImageIcon, Paperclip,
  Download, Eye, Trash2, ArrowUp, ArrowDown, ArrowUpDown,
} from "lucide-react";
import { toast } from "sonner";
import { TableEmptyState, TableSkeletonRows, CardSkeletonGrid, resolveTableEmptyKind, useTableLoadState, isBlockingLoadState } from "../ui/table-empty-state";
import { findSearchSuggestion } from "../../utils/searchSuggestion";
import {
  ColumnHeaderMenu,
  ActiveFiltersBar,
  createBlankFilter,
  isFilterActive,
  applyFilters,
  sortRows,
  getUniqueColumnValues,
  type CellAccessor,
  type ColumnFilterState,
  type FilterType,
  type SortConfig,
} from "./ColumnHeaderMenu";

/* ─── Sample data ─── */
export type AttachmentFileType = "pdf" | "doc" | "img" | "xlsx" | "other";
export interface AttachmentFile {
  id: number | string;
  name: string;
  size: string;
  date: string;
  type: AttachmentFileType | string;
  uploadedBy: string;
}

const ATTACHMENTS_DATA: AttachmentFile[] = [
  { id: 1, name: "NDA_Agreement_2026.pdf", size: "1.2 MB", date: "2026-03-10T09:00:00Z", type: "pdf", uploadedBy: "Sarah Johnson" },
  { id: 2, name: "Contact_Onboarding_Form.docx", size: "340 KB", date: "2026-01-15T14:20:00Z", type: "doc", uploadedBy: "Admin" },
  { id: 3, name: "ID_Verification.png", size: "2.8 MB", date: "2025-12-05T10:45:00Z", type: "img", uploadedBy: "Michael Lee" },
  { id: 4, name: "Meeting_Notes_Q1.pdf", size: "520 KB", date: "2026-03-28T16:00:00Z", type: "pdf", uploadedBy: "Sarah Johnson" },
  { id: 5, name: "Vendor_Agreement_v2.xlsx", size: "890 KB", date: "2026-02-20T11:30:00Z", type: "xlsx", uploadedBy: "Elena Volkov" },
  { id: 6, name: "Partnership_Contract.pdf", size: "3.4 MB", date: "2026-01-05T08:30:00Z", type: "pdf", uploadedBy: "Daniel Adams" },
  { id: 7, name: "Company_Logo.jpg", size: "1.8 MB", date: "2025-11-20T15:00:00Z", type: "img", uploadedBy: "Alex Morgan" },
  { id: 8, name: "Financial_Report_Q4.xlsx", size: "2.1 MB", date: "2026-02-10T09:45:00Z", type: "xlsx", uploadedBy: "Lisa Park" },
];

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
  } catch {
    return dateStr;
  }
}

/* Written badge label per file extension (no display case transform). */
const EXT_LABELS: Record<string, string> = {
  pdf: "PDF", doc: "DOC", docx: "DOCX", xls: "XLS", xlsx: "XLSX", csv: "CSV", txt: "TXT",
  png: "PNG", jpg: "JPG", jpeg: "JPEG", gif: "GIF", svg: "SVG", webp: "WEBP", heic: "HEIC",
  zip: "ZIP", ppt: "PPT", pptx: "PPTX",
};

function getFileTypeInfo(type: string, name: string) {
  const rawExt = name.split(".").pop() || "";
  const ext = EXT_LABELS[rawExt.toLowerCase()] ?? rawExt;
  switch (type) {
    case "pdf": return { color: "rgb(var(--destructive))", bg: "#FEF2F2", label: "PDF", Icon: FileText };
    case "doc": return { color: "#086AE6", bg: "#EBF3FF", label: "DOC", Icon: FileText };
    case "img": return { color: "rgb(var(--violet))", bg: "#F5F3FF", label: ext, Icon: ImageIcon };
    case "xlsx": return { color: "rgb(var(--success))", bg: "#ECFDF5", label: "XLSX", Icon: FileSpreadsheet };
    default: return { color: "#64748B", bg: "#F8FAFC", label: ext, Icon: FileText };
  }
}

const ATTACH_DENSITY_CONFIG = [
  { key: "condensed" as const, label: "Condensed", description: "Compact list view", icon: "align-justify" },
  { key: "comfort" as const, label: "Comfort", description: "Relaxed list view", icon: "list" },
  { key: "card" as const, label: "Card", description: "Thumbnail grid", icon: "layout-grid" },
];

/* ─── Column defs — `filterType` follows the Column Filters spec's
 * data-type rule: file name → text; size → text (formatted "198 KB"
 * strings, not clean numbers, so the text fallback applies); date →
 * date (raw ISO strings); uploaded_by → fixed pick-list → multiselect.
 * Fixed px widths keep the sticky-freeze offsets exact while matching
 * the current visual proportions. `responsiveClass` preserves the
 * original `hidden md:table-cell` behavior on the same columns. ─── */
const ATTACH_COLUMN_DEFS: {
  key: string; label: string; width: number; sortable: boolean;
  filterType: FilterType; responsiveClass?: string;
}[] = [
  { key: "file_name", label: "File Name", width: 260, sortable: true, filterType: "text" },
  { key: "size", label: "Size", width: 90, sortable: true, filterType: "text" },
  { key: "date", label: "Date", width: 120, sortable: true, filterType: "date", responsiveClass: "hidden md:table-cell" },
  { key: "uploaded_by", label: "Uploaded By", width: 150, sortable: true, filterType: "multiselect", responsiveClass: "hidden md:table-cell" },
];
const ATTACH_LOCKED_COLUMN = "file_name";
const attachFilterTypeFor = (key: string): FilterType =>
  ATTACH_COLUMN_DEFS.find((c) => c.key === key)?.filterType ?? "text";

/** (row, columnKey) → raw filterable/sortable value. Date stays the raw ISO string. */
const attachmentCellValue: CellAccessor<AttachmentFile> = (f, columnKey) => {
  switch (columnKey) {
    case "file_name": return f.name;
    case "size": return f.size;
    case "date": return f.date;
    case "uploaded_by": return f.uploadedBy;
    default: return undefined;
  }
};

interface AttachmentsTabProps {
  /** Override the default sample file list — pass the entity-specific files. */
  files?: AttachmentFile[];
  /**
   * Compact "modal/embedded" layout: drops the outer card chrome + min-height
   * floor and starts in Comfort density so it fits inside detail modals.
   * Defaults to false for the canonical Partner Detail page usage.
   */
  embedded?: boolean;
  /** Default density. If omitted, "card" for full-page, "comfort" for embedded. */
  initialDensity?: "condensed" | "comfort" | "card";
  /** Optional aggregate-size label override; computed from `files` when omitted. */
  totalSizeLabel?: string;
  /**
   * Override the upload-button click. When omitted the component opens its own
   * native file picker and adds the chosen files to local state.
   */
  onUpload?: () => void;
  /** Notify the parent whenever the file list changes (upload / delete). */
  onFilesChange?: (files: AttachmentFile[]) => void;
  /** Caller-supplied uploader name — defaults to "You" for in-session uploads. */
  uploadedByName?: string;
}

/** Bytes → human-readable size (e.g. "1.2 MB"). */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Map a File to an AttachmentFile using the canonical type buckets. */
function fileToAttachment(f: File, uploadedBy: string): AttachmentFile {
  const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
  let type: AttachmentFileType = "other";
  if (ext === "pdf") type = "pdf";
  else if (["doc", "docx", "rtf", "txt"].includes(ext)) type = "doc";
  else if (["png", "jpg", "jpeg", "gif", "webp", "svg", "heic"].includes(ext)) type = "img";
  else if (["xls", "xlsx", "csv", "ods"].includes(ext)) type = "xlsx";
  return {
    id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: f.name,
    size: formatBytes(f.size),
    date: new Date().toISOString(),
    type,
    uploadedBy,
  };
}

/** Sum the displayed size strings (e.g. "1.2 MB", "340 KB") into one label. */
function aggregateSize(items: AttachmentFile[]): string {
  let totalKb = 0;
  for (const f of items) {
    const m = f.size.match(/^([\d.]+)\s*(B|KB|MB|GB)$/i);
    if (!m) continue;
    const n = parseFloat(m[1]);
    const unit = m[2].toUpperCase();
    totalKb += unit === "GB" ? n * 1024 * 1024 : unit === "MB" ? n * 1024 : unit === "B" ? n / 1024 : n;
  }
  if (totalKb < 1) return "0 KB";
  if (totalKb < 1024) return `${Math.round(totalKb)} KB`;
  return `${(totalKb / 1024).toFixed(1)} MB`;
}

export function AttachmentsTab({
  files,
  embedded = false,
  initialDensity,
  totalSizeLabel,
  onUpload,
  onFilesChange,
  uploadedByName = "You",
}: AttachmentsTabProps = {}) {
  // Internal file state — seeded from the prop and editable via Upload / Delete.
  // When the `files` prop changes (parent passes a new list) we re-sync.
  const [items, setItems] = useState<AttachmentFile[]>(files ?? ATTACHMENTS_DATA);
  useEffect(() => {
    if (files) setItems(files);
  }, [files]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [search, setSearch] = useState("");
  const [density, setDensity] = useState<"condensed" | "comfort" | "card">(
    initialDensity ?? (embedded ? "comfort" : "card")
  );
  const [cardSize, setCardSize] = useState<"small" | "medium" | "large">("medium");

  /* ─── Column header state (sort / filter / hide / freeze) — shared by
   * the condensed + comfort list variants (same data, two densities). ─── */
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [columnFilters, setColumnFilters] = useState<Record<string, ColumnFilterState>>({});
  const [autoOpenFilterKey, setAutoOpenFilterKey] = useState<string | null>(null);
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [frozenColumns, setFrozenColumns] = useState<Set<string>>(new Set([ATTACH_LOCKED_COLUMN]));

  const columnFiltersList = useMemo(() => Object.values(columnFilters), [columnFilters]);
  const columnLabels = useMemo(() => Object.fromEntries(ATTACH_COLUMN_DEFS.map((c) => [c.key, c.label])), []);
  const uniqueValuesMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    ATTACH_COLUMN_DEFS.forEach((c) => {
      if (c.filterType === "multiselect") map[c.key] = getUniqueColumnValues(c.key, items, attachmentCellValue);
    });
    return map;
  }, [items]);

  const handleSort = useCallback((key: string, direction: "asc" | "desc" | null) => {
    setSortConfig(direction === null ? null : { key, direction });
  }, []);
  const handleAddColumnFilter = useCallback((columnKey: string) => {
    setColumnFilters((prev) => prev[columnKey] ? prev : { ...prev, [columnKey]: createBlankFilter(columnKey, attachFilterTypeFor(columnKey)) });
  }, []);
  const handleAddColumnFilterWithAutoOpen = useCallback((columnKey: string) => {
    setColumnFilters((prev) => prev[columnKey] ? prev : { ...prev, [columnKey]: createBlankFilter(columnKey, attachFilterTypeFor(columnKey)) });
    setAutoOpenFilterKey(null);
    setTimeout(() => setAutoOpenFilterKey(columnKey), 0);
  }, []);
  const handleColumnFilterChange = useCallback((columnKey: string, filter: ColumnFilterState) => {
    setColumnFilters((prev) => ({ ...prev, [columnKey]: filter }));
  }, []);
  const handleRemoveColumnFilter = useCallback((columnKey: string) => {
    setColumnFilters((prev) => { const next = { ...prev }; delete next[columnKey]; return next; });
  }, []);
  const handleClearAllColumnFilters = useCallback(() => setColumnFilters({}), []);
  const handleHideColumn = useCallback((columnKey: string) => {
    setHiddenColumns((prev) => new Set(prev).add(columnKey));
    setSortConfig((prev) => (prev?.key === columnKey ? null : prev));
  }, []);
  const handleFreezeColumn = useCallback((columnKey: string) => {
    setFrozenColumns((prev) => {
      const next = new Set(prev);
      if (next.has(columnKey) && columnKey !== ATTACH_LOCKED_COLUMN) next.delete(columnKey); else next.add(columnKey);
      return next;
    });
  }, []);

  const visibleColumns = useMemo(() => ATTACH_COLUMN_DEFS.filter((c) => !hiddenColumns.has(c.key)), [hiddenColumns]);

  /* Frozen columns stack from the left in visible order — cumulative px
   * offsets from the fixed column widths (same math as the reference). */
  const frozenOffsets = useMemo(() => {
    const offsets: Record<string, number> = {};
    let left = 0;
    visibleColumns.forEach((c) => {
      if (frozenColumns.has(c.key)) { offsets[c.key] = left; left += c.width; }
    });
    return offsets;
  }, [visibleColumns, frozenColumns]);
  const lastFrozenKey = useMemo(() => {
    const frozen = visibleColumns.filter((c) => frozenColumns.has(c.key));
    return frozen.length ? frozen[frozen.length - 1].key : null;
  }, [visibleColumns, frozenColumns]);

  /* Pipeline: search → column filters → sort. */
  const filtered = useMemo(() => {
    let result = items;
    if (search) result = result.filter(f => f.name.toLowerCase().includes(search.toLowerCase()));
    result = applyFilters(result, columnFiltersList, attachmentCellValue);
    return sortRows(result, sortConfig, attachmentCellValue, attachFilterTypeFor);
  }, [search, items, columnFiltersList, sortConfig]);

  /* Global empty / error states */
  const attachLoad = useTableLoadState();
  const attachFilterCount = Object.keys(columnFilters).length;
  const attachEmptyKind = resolveTableEmptyKind({
    loadState: attachLoad.loadState,
    totalCount: attachLoad.forceEmpty ? 0 : items.length,
    filteredCount: attachLoad.forceEmpty ? 0 : filtered.length,
    searchQuery: search,
    filterCount: attachFilterCount,
  });
  const attachSuggestion = useMemo(() => {
    if (attachEmptyKind !== "no-results" && attachEmptyKind !== "no-results-filtered") return null;
    return findSearchSuggestion(search, items.map((f) => f.name));
  }, [attachEmptyKind, search, items]);
  /** Rows to render — hidden while loading, on a blocking error, or in the simulated empty state. */
  const visibleFiles = attachLoad.forceEmpty || attachLoad.loadState === "loading" || isBlockingLoadState(attachLoad.loadState) ? [] : filtered;

  const handleUploadClick = () => {
    if (onUpload) { onUpload(); return; }
    fileInputRef.current?.click();
  };

  const handleFilesPicked = (picked: FileList | null) => {
    if (!picked || picked.length === 0) return;
    const incoming = Array.from(picked).map((f) => fileToAttachment(f, uploadedByName));
    setItems((prev) => {
      const next = [...incoming, ...prev];
      onFilesChange?.(next);
      return next;
    });
    toast.success(`${incoming.length} ${incoming.length === 1 ? "file" : "files"} uploaded`);
  };

  const handleDelete = (id: AttachmentFile["id"]) => {
    setItems((prev) => {
      const next = prev.filter((f) => f.id !== id);
      onFilesChange?.(next);
      return next;
    });
    toast.success("Attachment removed");
  };

  const handleDownload = (f: AttachmentFile) => {
    toast.info(`Downloading ${f.name}…`);
  };

  const handlePreview = (f: AttachmentFile) => {
    toast.info(`Previewing ${f.name}…`);
  };

  const isCondensed = density === "condensed";
  const isComfort = density === "comfort";
  const isCard = density === "card";

  // Embedded mode skips the bordered card wrapper + the tall min-height floor
  // so the same component drops cleanly into detail modals.
  const wrapperClass = embedded
    ? "flex flex-col flex-1 min-h-0"
    : "bg-white border border-border rounded-xl overflow-hidden flex flex-col flex-1 min-h-[calc(100vh-260px)]";
  // Live size label. Caller can still override via `totalSizeLabel`.
  const sizeLabel = totalSizeLabel ?? aggregateSize(items);

  const frozenShadow = "inset -1px 0 0 0 rgba(0,0,0,0.08), 3px 0 6px -2px rgba(0,0,0,0.06)";

  /* Shared header row for both list densities — only vertical padding differs. */
  const renderColumnHeaders = (py: string) =>
    visibleColumns.map((def) => {
      const isFrozen = frozenColumns.has(def.key);
      const isLocked = def.key === ATTACH_LOCKED_COLUMN;
      const currentColSort: "asc" | "desc" | null = sortConfig?.key === def.key ? sortConfig.direction : null;
      const hasFilter = columnFilters[def.key] ? isFilterActive(columnFilters[def.key]) : false;
      return (
        <th
          key={def.key}
          className={`text-left text-[11px] text-slate-400 px-4 ${py} whitespace-nowrap relative group/colheader ${def.responsiveClass ?? ""} ${isFrozen ? "sticky bg-slate-50 z-20" : ""} ${hasFilter && !isFrozen ? "bg-primary/[0.03]" : ""}`}
          style={{
            fontWeight: 600,
            minWidth: `${def.width}px`,
            ...(isFrozen ? { left: `${frozenOffsets[def.key] ?? 0}px` } : {}),
            ...(def.key === lastFrozenKey ? { boxShadow: frozenShadow } : {}),
          }}
        >
          <div className="flex items-center">
            <ColumnHeaderMenu
              columnKey={def.key}
              label={def.label}
              sortable={def.sortable}
              sortConfig={sortConfig}
              onSort={handleSort}
              onAddFilter={handleAddColumnFilter}
              onHideColumn={handleHideColumn}
              onFreezeColumn={handleFreezeColumn}
              isFrozen={isFrozen}
              isLocked={isLocked}
              hasActiveFilter={hasFilter}
              filter={columnFilters[def.key] ?? null}
              uniqueValues={uniqueValuesMap[def.key]}
              filterTypeOverride={def.filterType}
              onFilterChange={handleColumnFilterChange}
            >
              <div className="inline-flex items-center gap-1">
                <span style={currentColSort || hasFilter ? { color: "rgb(var(--primary))" } : undefined}>{def.label}</span>
                {hasFilter && !currentColSort && (
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: "rgb(var(--primary))" }} />
                )}
                {currentColSort === "asc" && <ArrowUp className="w-3 h-3 shrink-0" style={{ color: "rgb(var(--primary))" }} />}
                {currentColSort === "desc" && <ArrowDown className="w-3 h-3 shrink-0" style={{ color: "rgb(var(--primary))" }} />}
                {!currentColSort && !hasFilter && def.sortable && (
                  <ArrowUpDown className="w-3 h-3 shrink-0 text-muted-foreground opacity-0 group-hover/colheader:opacity-100 transition-opacity" />
                )}
              </div>
            </ColumnHeaderMenu>
          </div>
        </th>
      );
    });

  /* Body <td> class/style for a column — responsive + frozen sticky offsets. */
  const bodyCellProps = (key: string, base: string) => {
    const def = ATTACH_COLUMN_DEFS.find((c) => c.key === key);
    const isFrozen = frozenColumns.has(key);
    return {
      className: `${base} ${def?.responsiveClass ?? ""} ${isFrozen ? "sticky bg-white z-10" : ""}`,
      style: {
        ...(isFrozen ? { left: `${frozenOffsets[key] ?? 0}px` } : {}),
        ...(key === lastFrozenKey ? { boxShadow: frozenShadow } : {}),
      } as React.CSSProperties,
    };
  };

  /* Notion-style active-filter chips bar — rendered above the table. */
  const activeFiltersBar = columnFiltersList.length > 0 ? (
    <div className="pt-2.5">
      <ActiveFiltersBar
        columnFilters={columnFiltersList}
        columnLabels={columnLabels}
        uniqueValuesByKey={uniqueValuesMap}
        lockedColumnKey={ATTACH_LOCKED_COLUMN}
        onFilterChange={handleColumnFilterChange}
        onRemoveFilter={handleRemoveColumnFilter}
        onAddFilter={handleAddColumnFilterWithAutoOpen}
        onClearAll={handleClearAllColumnFilters}
        autoOpenKey={autoOpenFilterKey}
        onAutoOpened={() => setAutoOpenFilterKey(null)}
        availableColumns={ATTACH_COLUMN_DEFS.map((c) => ({ key: c.key, label: c.label }))}
      />
    </div>
  ) : null;

  return (
    <div className={wrapperClass}>
      {/* Hidden file picker — wired to the Upload button. Multiple-file pick
          allowed; native dialog filters to common file types. */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          handleFilesPicked(e.target.files);
          // Reset so the same file can be picked twice in a row.
          e.target.value = "";
        }}
      />

      {/* Toolbar */}
      <div className="px-4 py-3 flex items-center gap-3 border-b border-muted shrink-0">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50 pointer-events-none" />
          <Input
            placeholder="Search attachments..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-8 h-9 text-sm bg-white border-border/80 shadow-sm placeholder:text-muted-foreground/50"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <span className="text-sm ml-auto" style={{ fontWeight: 500 }}>
          <span className="text-foreground">{filtered.length}</span>
          <span className="text-muted-foreground/70"> {filtered.length === 1 ? "file" : "files"} · {sizeLabel}</span>
        </span>

        {/* Density dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="inline-flex items-center justify-center h-9 gap-2 px-3 rounded-lg border border-border bg-white text-foreground shadow-sm hover:bg-muted/40 transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
              {isCondensed && <AlignJustify className="w-[18px] h-[18px] text-muted-foreground/80" />}
              {isComfort && <List className="w-[18px] h-[18px] text-muted-foreground/80" />}
              {isCard && <LayoutGrid className="w-[18px] h-[18px] text-muted-foreground/80" />}
              <span className="text-sm hidden md:inline" style={{ fontWeight: 500 }}>
                {ATTACH_DENSITY_CONFIG.find(d => d.key === density)?.label}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/60" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[230px] p-1.5">
            {ATTACH_DENSITY_CONFIG.map((opt) => (
              <DropdownMenuItem key={opt.key} className="flex items-center gap-3 py-2.5 px-3 cursor-pointer rounded-md" onSelect={(e) => { if (opt.key === "card") e.preventDefault(); setDensity(opt.key); }}>
                {opt.icon === "align-justify" && <AlignJustify className="w-5 h-5 text-muted-foreground shrink-0" />}
                {opt.icon === "list" && <List className="w-5 h-5 text-muted-foreground shrink-0" />}
                {opt.icon === "layout-grid" && <LayoutGrid className="w-5 h-5 text-muted-foreground shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="text-sm" style={{ fontWeight: 500 }}>{opt.label}</div>
                  <div className="text-xs text-muted-foreground">{opt.description}</div>
                </div>
                {density === opt.key && <Check className="w-4 h-4 shrink-0" style={{ color: "rgb(var(--primary))" }} />}
              </DropdownMenuItem>
            ))}
            {isCard && (
              <>
                <div className="mx-2 my-1.5 border-t border-muted" />
                <div className="px-3 py-1.5">
                  <p className="text-[10px] text-slate-400 tracking-wide mb-2" style={{ fontWeight: 600 }}>Card Size</p>
                  <div className="flex items-center gap-1.5">
                    {(["large", "medium", "small"] as const).map((size) => (
                      <button key={size} onClick={() => setCardSize(size)} className={`flex-1 py-1.5 rounded-md text-[11px] text-center transition-all cursor-pointer ${cardSize === size ? "bg-primary text-white shadow-sm" : "bg-muted text-slate-500 hover:bg-border"}`} style={{ fontWeight: cardSize === size ? 600 : 500 }}>
                        {size === "large" ? "Large" : size === "medium" ? "Medium" : "Small"}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Upload CTA — opens native file picker (or caller's onUpload override) */}
        <button
          onClick={handleUploadClick}
          className="inline-flex items-center justify-center h-9 gap-1.5 px-3.5 rounded-lg bg-primary text-white shadow-sm hover:bg-primary/90 transition-colors cursor-pointer text-sm"
          style={{ fontWeight: 500 }}
        >
          <Upload className="w-4 h-4" />
          Upload
        </button>
      </div>


      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Card View — column filters set in list densities still apply,
            so keep the chips bar visible (never silently filter). */}
        {isCard && activeFiltersBar && (
          <div className="border border-border bg-white rounded-xl overflow-hidden mb-4 pb-2.5">
            {activeFiltersBar}
          </div>
        )}
        {isCard && attachLoad.loadState === "loading" && <CardSkeletonGrid count={8} />}
        {isCard && (
          <div className={`grid gap-4 ${
            cardSize === "large" ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" :
            cardSize === "small" ? "grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6" :
            "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
          }`}>
            {visibleFiles.map((file) => {
              const info = getFileTypeInfo(file.type, file.name);
              const previewH = cardSize === "large" ? "h-[160px]" : cardSize === "small" ? "h-[100px]" : "h-[130px]";
              const iconSz = cardSize === "large" ? "w-12 h-12" : cardSize === "small" ? "w-8 h-8" : "w-10 h-10";
              return (
                <div key={file.id} className={`group rounded-xl border border-border bg-white overflow-hidden hover:shadow-md hover:border-slate-300 transition-all`}>
                  <div className={`relative ${previewH} flex items-center justify-center`} style={{ backgroundColor: info.bg }}>
                    <info.Icon className={iconSz} style={{ color: info.color, opacity: 0.35 }} />
                    <span className="absolute top-2.5 right-2.5 px-1.5 py-0.5 rounded text-[9px] tracking-wide" style={{ fontWeight: 700, color: info.color, backgroundColor: `${info.color}15`, border: `1px solid ${info.color}25` }}>
                      {info.label}
                    </span>
                  </div>
                  <div className={cardSize === "large" ? "px-4 pt-3 pb-3.5" : cardSize === "small" ? "px-2.5 pt-2 pb-2.5" : "px-3 pt-2.5 pb-3"}>
                    <div className="flex items-start justify-between gap-1 mb-1">
                      <span className={`${cardSize === "small" ? "text-[11px]" : "text-[12px]"} text-foreground truncate leading-tight`} style={{ fontWeight: 500 }}>{file.name}</span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="shrink-0 p-0.5 rounded hover:bg-muted/60 text-muted-foreground/50 hover:text-foreground transition-colors cursor-pointer opacity-0 group-hover:opacity-100">
                            <MoreVertical className="w-3.5 h-3.5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[150px]">
                          <DropdownMenuItem onClick={() => handlePreview(file)}>
                            <Eye className="w-3.5 h-3.5 mr-2" /> Preview
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDownload(file)}>
                            <Download className="w-3.5 h-3.5 mr-2" /> Download
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDelete(file.id)} className="text-destructive focus:text-destructive">
                            <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <p className={`${cardSize === "small" ? "text-[10px]" : "text-[11px]"} text-slate-400 leading-tight`}>{formatDate(file.date)}</p>
                    <p className={`${cardSize === "small" ? "text-[10px]" : "text-[11px]"} text-slate-400 leading-tight`}>{file.size} · {file.uploadedBy}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Condensed List View */}
        {isCondensed && (
          <div className="border border-border bg-white rounded-xl overflow-hidden">
            {activeFiltersBar}
            <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-muted">
                  {renderColumnHeaders("py-2")}
                  <th className="w-[36px]" />
                </tr>
              </thead>
              <tbody>
                {attachLoad.loadState === "loading" && <TableSkeletonRows columns={visibleColumns.length + 1} rows={6} />}
                {visibleFiles.map((file) => {
                  const info = getFileTypeInfo(file.type, file.name);
                  const cell = (key: string) => {
                    switch (key) {
                      case "file_name":
                        return (
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: info.bg }}>
                              <info.Icon className="w-3.5 h-3.5" style={{ color: info.color }} />
                            </div>
                            <span className="text-[12px] text-slate-700 truncate" style={{ fontWeight: 500 }}>{file.name}</span>
                          </div>
                        );
                      case "size":
                        return <span className="text-[11px] text-slate-500">{file.size}</span>;
                      case "date":
                        return <span className="text-[11px] text-slate-500">{formatDate(file.date)}</span>;
                      case "uploaded_by":
                        return <span className="text-[11px] text-slate-500">{file.uploadedBy}</span>;
                      default:
                        return null;
                    }
                  };
                  return (
                    <tr key={file.id} className="border-b border-muted last:border-b-0 hover:bg-slate-50 transition-colors group">
                      {visibleColumns.map((def) => (
                        <td key={def.key} {...bodyCellProps(def.key, "px-4 py-1.5")}>
                          {cell(def.key)}
                        </td>
                      ))}
                      <td className="px-2 py-1.5">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="p-1 rounded hover:bg-muted/60 text-muted-foreground/40 hover:text-foreground transition-colors cursor-pointer opacity-0 group-hover:opacity-100">
                              <MoreVertical className="w-3.5 h-3.5" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-[150px]">
                            <DropdownMenuItem onClick={() => handlePreview(file)}>
                              <Eye className="w-3.5 h-3.5 mr-2" /> Preview
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDownload(file)}>
                              <Download className="w-3.5 h-3.5 mr-2" /> Download
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDelete(file.id)} className="text-destructive focus:text-destructive">
                              <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </div>
        )}

        {/* Comfort List View */}
        {isComfort && (
          <div className="border border-border bg-white rounded-xl overflow-hidden">
            {activeFiltersBar}
            <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-muted">
                  {renderColumnHeaders("py-2.5")}
                  <th className="w-[40px]" />
                </tr>
              </thead>
              <tbody>
                {attachLoad.loadState === "loading" && <TableSkeletonRows columns={visibleColumns.length + 1} rows={6} />}
                {visibleFiles.map((file) => {
                  const info = getFileTypeInfo(file.type, file.name);
                  const cell = (key: string) => {
                    switch (key) {
                      case "file_name":
                        return (
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: info.bg }}>
                              <info.Icon className="w-4.5 h-4.5" style={{ color: info.color }} />
                            </div>
                            <div className="min-w-0">
                              <span className="text-[12px] text-slate-700 truncate block" style={{ fontWeight: 500 }}>{file.name}</span>
                              <span className="text-[11px] text-slate-400">{file.size}</span>
                            </div>
                          </div>
                        );
                      case "size":
                        return <span className="text-[12px] text-slate-500">{file.size}</span>;
                      case "date":
                        return <span className="text-[12px] text-slate-500">{formatDate(file.date)}</span>;
                      case "uploaded_by":
                        return <span className="text-[12px] text-slate-500">{file.uploadedBy}</span>;
                      default:
                        return null;
                    }
                  };
                  return (
                    <tr key={file.id} className="border-b border-muted last:border-b-0 hover:bg-slate-50 transition-colors group">
                      {visibleColumns.map((def) => (
                        <td key={def.key} {...bodyCellProps(def.key, "px-4 py-3")}>
                          {cell(def.key)}
                        </td>
                      ))}
                      <td className="px-2 py-3">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="p-1 rounded hover:bg-muted/60 text-muted-foreground/40 hover:text-foreground transition-colors cursor-pointer opacity-0 group-hover:opacity-100">
                              <MoreVertical className="w-4 h-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-[150px]">
                            <DropdownMenuItem onClick={() => handlePreview(file)}>
                              <Eye className="w-3.5 h-3.5 mr-2" /> Preview
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDownload(file)}>
                              <Download className="w-3.5 h-3.5 mr-2" /> Download
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDelete(file.id)} className="text-destructive focus:text-destructive">
                              <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </div>
        )}

        {attachEmptyKind && (
          <TableEmptyState
            kind={attachEmptyKind}
            entity={{ singular: "attachment", plural: "attachments" }}
            searchQuery={search}
            suggestion={attachSuggestion}
            onApplySuggestion={(q) => setSearch(q)}
            filterCount={attachFilterCount}
            onClearSearch={() => setSearch("")}
            onClearFilters={handleClearAllColumnFilters}
            onClearAll={() => { setSearch(""); handleClearAllColumnFilters(); }}
            onRetry={attachLoad.retry}
            retrying={attachLoad.retrying}
            compact={embedded}
            title="No attachments yet"
            description="Files you upload will show up here."
            onCreate={handleUploadClick}
            createLabel="Upload Your First File"
          />
        )}
      </div>
    </div>
  );
}
