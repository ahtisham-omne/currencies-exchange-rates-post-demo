/* "Export Items" modal: port of role-zen's shared/ExportUsersModal.tsx,
 * parameterised by ITEMS_IMPORT_SPEC.exportFields (Part Number locked).
 * Three format cards (PDF default), searchable column picker with
 * tri-state select-all, pointer drag reorder mirrored from Financial
 * Reporting's Selected Columns (5px threshold, dashed drop slot, floating
 * ghost with position badge, auto-scroll), Move to Top / Bottom chevrons with a 1.5s ring flash, and
 * the Full View toggle. Rows arrive already scoped by the parent. */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  CornerDownLeft,
  Download,
  X,
  Search,
  Lock,
  GripVertical,
  Maximize2,
  Minimize2,
  ChevronsUp,
  ChevronsDown,
  Package,
  Loader2,
  CheckCircle2,
  FileType,
  Columns3,
  Info,
  ListChecks,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import type { Item } from "@/app/context/ItemsContext";
import { ModalShell } from "./ModalShell";
import { highlightLabel } from "./HighlightMatch";
import { ITEMS_IMPORT_SPEC, type EntitySpec, type ExportField } from "./spec";
import { exportFieldHelp, exportFilename, exportItems, type ExportFormat as FileFormat } from "./export";

export type ExportFormat = "pdf" | "excel" | "csv";

/** Context describing which Export button opened the modal. */
export type ExportContext =
  | { kind: "all"; totalCount: number }
  | { kind: "filtered"; filteredCount: number; totalCount: number }
  | { kind: "selected"; selectedCount: number };

interface ExportModalProps {
  open: boolean;
  onClose: () => void;
  /** Provided by the trigger that opened the modal. Null when modal is closed. */
  context: ExportContext | null;
  /** Per-column visibility map from the listing table, used to pre-check the listing columns. */
  tableColumnVisibility?: Record<string, boolean>;
  /** Rows to include in the export. Already resolved by the parent based on context (all/filtered/selected). */
  rows: Item[];
  spec?: EntitySpec;
  /** Filtered scope: resets the listing's filters, quick filters and search so the export covers every record. */
  onClearFilters?: () => void;
  /** Selected scope: selects every record in the listing so the export covers them all. */
  onSelectAll?: () => void;
}

interface PickerField {
  id: string;
  label: string;
  locked?: boolean;
  listing: boolean;
  helpText?: string;
}

/* ─── Auto-scroll constants (matched to UAC) ─── */
const AUTO_SCROLL_ZONE = 40; // px from edge to trigger
const AUTO_SCROLL_MAX_SPEED = 12; // px per frame
const DRAG_THRESHOLD_PX = 5;
/** Fallback height for the drop slot before a card has been measured. */
const CARD_H = 38;
/** Floating drag card sits above the modal (ModalShell z 40/41) and its tooltips (z 200). */
const DRAG_GHOST_Z = 400;

interface FormatTheme {
  badgeBg: string;
  badgeText: string;
  border: string;
  cardBg: string;
  radio: string;
  button: string;
}

const SHARED_BLUE = { border: "#2563EB", cardBg: "#F5FAFF", radio: "#2563EB", button: "#2563EB" };

const FORMAT_THEMES: Record<ExportFormat, FormatTheme> = {
  pdf: { badgeBg: "#EFF6FF", badgeText: "#2563EB", ...SHARED_BLUE },
  excel: { badgeBg: "#ECFDF5", badgeText: "#047857", ...SHARED_BLUE },
  csv: { badgeBg: "#FFFBEB", badgeText: "#B45309", ...SHARED_BLUE },
};

const FORMAT_CARDS: { key: ExportFormat; badge: string; title: string; description: string }[] = [
  {
    key: "pdf",
    badge: "PDF",
    title: "PDF Document",
    description: "Best for reading and printing. Can't be edited.",
  },
  {
    key: "excel",
    badge: "XLS",
    title: "Excel Spreadsheet",
    description: "Best for working with the data in Excel or Google Sheets.",
  },
  {
    key: "csv",
    badge: "CSV",
    title: "CSV File",
    description:
      "Best for moving data to another system. Plain text, no formatting.",
  },
];

function pickerFieldsFor(spec: EntitySpec): PickerField[] {
  return spec.exportFields.map((f: ExportField) => ({ id: f.id, label: f.label, locked: f.locked, listing: f.listing, helpText: exportFieldHelp(f, spec) }));
}

function buildScopeBanner(context: ExportContext | null, spec: EntitySpec): { count: string; subtext: string } | null {
  if (!context) return null;
  const word = (n: number) => (n === 1 ? spec.nouns.singular : spec.nouns.plural);
  if (context.kind === "filtered") {
    return {
      count: `${context.filteredCount} ${word(context.filteredCount)}`,
      subtext: `Only the ${spec.nouns.plural} matching your current filters will be exported`,
    };
  }
  if (context.kind === "selected") {
    return {
      count: `${context.selectedCount} ${word(context.selectedCount)}`,
      subtext: `Only the ${spec.nouns.plural} you selected will be exported`,
    };
  }
  return {
    count: `${context.totalCount} ${word(context.totalCount)}`,
    subtext: `Every ${spec.nouns.singular} on your list will be exported, except archived ${spec.nouns.plural}`,
  };
}

function computeDefaultChecked(fields: PickerField[], tableColumnVisibility: Record<string, boolean> | undefined): Set<string> {
  const checked = new Set<string>();
  for (const field of fields) {
    if (!field.listing && !field.locked) continue;
    const visible = tableColumnVisibility ? tableColumnVisibility[field.id] !== false : true;
    if (field.locked || visible) checked.add(field.id);
  }
  return checked;
}

function FormatBadge({ format, label }: { format: ExportFormat; label: string }) {
  const theme = FORMAT_THEMES[format];
  return (
    <span
      className="inline-flex items-center justify-center w-9 h-9 rounded-[8px] text-[10px] tracking-[0.04em]"
      style={{ backgroundColor: theme.badgeBg, color: theme.badgeText, fontWeight: 700 }}
    >
      {label}
    </span>
  );
}

function FieldCard({
  field,
  checked,
  dragActive,
  onToggle,
  onCardPointerDown,
  searchQuery,
  showQuickReorder,
  onMoveToTop,
  onMoveToBottom,
  isRecentlyMoved,
  lockTooltip,
}: {
  field: PickerField;
  checked: boolean;
  /** A drag is in progress somewhere in the list: every resting card dims. */
  dragActive: boolean;
  onToggle: () => void;
  onCardPointerDown: (e: React.PointerEvent, fieldId: string) => void;
  searchQuery: string;
  showQuickReorder: boolean;
  onMoveToTop: () => void;
  onMoveToBottom: () => void;
  isRecentlyMoved: boolean;
  lockTooltip: string;
}) {
  const isLocked = !!field.locked;
  const [isHovered, setIsHovered] = useState(false);
  const showHover = isHovered && !isLocked && !dragActive && !isRecentlyMoved;
  const borderColor = isRecentlyMoved ? "#007FFF" : showHover ? "#CBD5E1" : checked ? "#BFDBFE" : "#E2E8F0";
  const backgroundColor = showHover ? "#FAFCFF" : "#FFFFFF";
  const boxShadow = showHover ? "0 2px 8px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)" : undefined;

  return (
    <div
      data-field-id={field.id}
      onPointerDown={(e) => onCardPointerDown(e, field.id)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`group flex items-center gap-3 px-3 py-2 rounded-[8px] transition-all duration-150 ${
        isLocked ? "cursor-default" : "cursor-grab"
      } ${isRecentlyMoved ? "ring-2 ring-[#007FFF]/60" : ""}`}
      style={{
        backgroundColor,
        border: `1px solid ${borderColor}`,
        boxShadow,
        opacity: dragActive ? 0.55 : 1,
      }}
    >
      <div
        className={`shrink-0 flex items-center justify-center w-5 h-5 transition-colors ${
          isLocked ? "text-[#E2E8F0]" : "text-[#94A3B8] group-hover:text-[#475569]"
        }`}
        aria-hidden="true"
      >
        <GripVertical className="w-4 h-4" />
      </div>

      <div
        className="flex"
        style={isLocked && checked ? { opacity: 0.55 } : undefined}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <Checkbox checked={checked} disabled={isLocked} onCheckedChange={onToggle} aria-label={`Select ${field.label}`} />
      </div>

      <div className="flex items-center gap-2 flex-1 min-w-0">
        {isLocked && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                className="order-last ml-auto shrink-0 inline-flex items-center justify-center cursor-help"
                aria-label="Locked"
              >
                <Lock className="w-3.5 h-3.5" style={{ color: "#94A3B8" }} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={6} className="z-[200] text-xs">
              {lockTooltip}
            </TooltipContent>
          </Tooltip>
        )}
        <span className="text-[13px] truncate" style={{ color: isLocked ? "#64748B" : "#0F172A", fontWeight: 500 }}>
          {highlightLabel(field.label, searchQuery)}
        </span>
        {field.helpText && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                className="shrink-0 inline-flex items-center justify-center cursor-help"
                aria-label={`About ${field.label}`}
              >
                <Info className="w-3.5 h-3.5" style={{ color: "#94A3B8" }} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={6} className="z-[200] max-w-[260px] text-xs">
              {field.helpText}
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {!isLocked && showQuickReorder && (
        <div className="-my-0.5 shrink-0 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onMoveToTop();
                }}
                className="w-6 h-6 rounded-[6px] border bg-white flex items-center justify-center text-[#475569] hover:bg-[#F1F5F9] transition-colors cursor-pointer"
                style={{ borderColor: "#F1F5F9" }}
                aria-label="Move to Top"
              >
                <ChevronsUp className="w-3.5 h-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={6} className="z-[200] text-xs">
              Move to Top
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onMoveToBottom();
                }}
                className="w-6 h-6 rounded-[6px] border bg-white flex items-center justify-center text-[#475569] hover:bg-[#F1F5F9] transition-colors cursor-pointer"
                style={{ borderColor: "#F1F5F9" }}
                aria-label="Move to Bottom"
              >
                <ChevronsDown className="w-3.5 h-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={6} className="z-[200] text-xs">
              Move to Bottom
            </TooltipContent>
          </Tooltip>
        </div>
      )}
    </div>
  );
}

function FormatCardRow({
  card,
  isSelected,
  onSelect,
}: {
  card: (typeof FORMAT_CARDS)[number];
  isSelected: boolean;
  onSelect: () => void;
}) {
  const t = FORMAT_THEMES[card.key];
  const [isHovered, setIsHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onSelect}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="w-full text-left rounded-[12px] border p-3.5 transition-all duration-150 cursor-pointer"
      style={{
        borderColor: isSelected ? "#0A77FF" : isHovered ? "#CBD5E1" : "#E2E8F0",
        borderWidth: 1,
        backgroundColor: isSelected ? "#F5F9FF" : isHovered ? "#FAFCFF" : "#FFFFFF",
        boxShadow: isSelected
          ? "0 0 0 1px rgba(10,119,255,0.15), 0 1px 3px rgba(10,119,255,0.06)"
          : isHovered
            ? "0 2px 8px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)"
            : "0 1px 2px 0 rgba(15, 23, 42, 0.04), 0 1px 3px 0 rgba(15, 23, 42, 0.06)",
      }}
    >
      <div className="flex items-start justify-between mb-2.5">
        <FormatBadge format={card.key} label={card.badge} />
        <span
          className="shrink-0 w-4 h-4 rounded-full border border-[#E2E8F0] bg-white flex items-center justify-center mt-1"
        >
          {isSelected && <span className="w-2 h-2 rounded-full bg-[#0A77FF]" />}
        </span>
      </div>
      <div className="text-[13px] leading-[18px]" style={{ fontWeight: 600, color: "#0F172A" }}>
        {card.title}
      </div>
      <div className="text-[11.5px] leading-[15px] mt-1" style={{ color: "#64748B", fontWeight: 400 }}>
        {card.description}
      </div>
    </button>
  );
}

export function ExportModal({ open, onClose, context, onClearFilters, onSelectAll, tableColumnVisibility, rows, spec = ITEMS_IMPORT_SPEC }: ExportModalProps) {
  const ALL_FIELDS = useMemo(() => pickerFieldsFor(spec), [spec]);
  const LOCKED_FIELD_IDS = useMemo(() => new Set(ALL_FIELDS.filter((f) => f.locked).map((f) => f.id)), [ALL_FIELDS]);
  const keyLabel = spec.columnByKey[spec.keyColumn].label;
  const lockTooltip = `${keyLabel} is always included. It is how each ${spec.nouns.singular} is identified in the file.`;

  const [format, setFormat] = useState<ExportFormat>("pdf");
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);
  const [search, setSearch] = useState("");
  const [fieldOrder, setFieldOrder] = useState<string[]>(() => ALL_FIELDS.map((f) => f.id));
  const [draggedFieldId, setDraggedFieldId] = useState<string | null>(null);
  const [liveFieldOrder, setLiveFieldOrder] = useState<string[] | null>(null);
  /** The card that rides the cursor, measured off the row it was lifted from. */
  const [dragCard, setDragCard] = useState<{ label: string; width: number; height: number } | null>(null);

  const liveFieldOrderRef = useRef<string[] | null>(null);
  const draggedFieldIdRef = useRef<string | null>(null);
  const dragGhostRef = useRef<HTMLDivElement | null>(null);
  /** Where inside the card the grab landed, so the ghost does not jump to the cursor. */
  const grabOffsetRef = useRef({ x: 0, y: 0 });
  const pointerYRef = useRef<number>(0);
  const autoScrollRafRef = useRef<number | null>(null);
  liveFieldOrderRef.current = liveFieldOrder;
  draggedFieldIdRef.current = draggedFieldId;
  const [isFullScreen, setIsFullScreen] = useState(false);
  const columnListScrollRef = useRef<HTMLDivElement | null>(null);
  const [recentlyMovedFieldId, setRecentlyMovedFieldId] = useState<string | null>(null);
  const recentMoveTimerRef = useRef<number | null>(null);

  // Reset all state whenever the modal is opened fresh.
  useEffect(() => {
    if (!open) return;
    setFormat("pdf");
    setChecked(computeDefaultChecked(ALL_FIELDS, tableColumnVisibility));
    setSearch("");
    setFieldOrder(ALL_FIELDS.map((f) => f.id));
    setDraggedFieldId(null);
    setLiveFieldOrder(null);
    setDragCard(null);
    setIsFullScreen(false);
    setRecentlyMovedFieldId(null);
    setExporting(false);
    if (recentMoveTimerRef.current !== null) {
      window.clearTimeout(recentMoveTimerRef.current);
      recentMoveTimerRef.current = null;
    }
  }, [open, tableColumnVisibility, ALL_FIELDS]);

  const scopeBanner = buildScopeBanner(context, spec);
  const theme = FORMAT_THEMES[format];

  const exportFieldIds = useMemo(() => fieldOrder.filter((id) => checked.has(id)), [fieldOrder, checked]);

  const handleExport = async () => {
    if (exporting || exportFieldIds.length === 0 || rows.length === 0) return;
    setExporting(true);
    try {
      const ext: FileFormat = format === "excel" ? "xlsx" : format;
      await exportItems(rows, exportFieldIds, ext, spec);
      toast.success(`Exported ${exportFilename(ext, spec)}`, {
        icon: <CheckCircle2 className="w-4 h-4" style={{ color: "#16A34A" }} />,
        duration: 3000,
      });
      onClose();
    } catch (err) {
      console.error("Export failed", err);
      toast.error("Export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  const exportLabel = exporting ? "Exporting…" : format === "pdf" ? "Export as PDF" : format === "excel" ? "Export as Excel" : "Export as CSV";

  /* ─── Column picker derived data ─── */
  const normalizedQuery = search.trim().toLowerCase();
  const currentOrder = liveFieldOrder ?? fieldOrder;
  const orderedFields = useMemo(() => {
    const byId = new Map(ALL_FIELDS.map((f) => [f.id, f]));
    return currentOrder.map((id) => byId.get(id)).filter((f): f is PickerField => !!f);
  }, [currentOrder, ALL_FIELDS]);

  const filteredFields = useMemo(() => {
    if (!normalizedQuery) return orderedFields;
    return orderedFields.filter((f) => f.label.toLowerCase().includes(normalizedQuery));
  }, [orderedFields, normalizedQuery]);

  const noResults = filteredFields.length === 0;

  const visibleSelectable = filteredFields.filter((f) => !f.locked);
  const allVisibleSelected = visibleSelectable.length > 0 && visibleSelectable.every((f) => checked.has(f.id));
  const someVisibleSelected = visibleSelectable.some((f) => checked.has(f.id)) && !allVisibleSelected;
  const masterCheckboxState: boolean | "indeterminate" = allVisibleSelected ? true : someVisibleSelected ? "indeterminate" : false;

  const handleSelectAllToggle = () => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) for (const f of visibleSelectable) next.delete(f.id);
      else for (const f of visibleSelectable) next.add(f.id);
      return next;
    });
  };

  /* ─── Drag-reorder handlers ─── */
  const fieldOrderRef = useRef(fieldOrder);
  fieldOrderRef.current = fieldOrder;

  const startAutoScroll = useCallback(() => {
    const tick = () => {
      const listEl = columnListScrollRef.current;
      if (!listEl || !draggedFieldIdRef.current) {
        autoScrollRafRef.current = null;
        return;
      }
      const listRect = listEl.getBoundingClientRect();
      const y = pointerYRef.current;
      const distFromTop = y - listRect.top;
      const distFromBottom = listRect.bottom - y;
      if (distFromTop < AUTO_SCROLL_ZONE && distFromTop > 0) {
        const intensity = 1 - distFromTop / AUTO_SCROLL_ZONE;
        listEl.scrollTop -= Math.round(AUTO_SCROLL_MAX_SPEED * intensity);
      } else if (distFromBottom < AUTO_SCROLL_ZONE && distFromBottom > 0) {
        const intensity = 1 - distFromBottom / AUTO_SCROLL_ZONE;
        listEl.scrollTop += Math.round(AUTO_SCROLL_MAX_SPEED * intensity);
      }
      autoScrollRafRef.current = requestAnimationFrame(tick);
    };
    if (autoScrollRafRef.current) cancelAnimationFrame(autoScrollRafRef.current);
    autoScrollRafRef.current = requestAnimationFrame(tick);
  }, []);

  const stopAutoScroll = useCallback(() => {
    if (autoScrollRafRef.current) {
      cancelAnimationFrame(autoScrollRafRef.current);
      autoScrollRafRef.current = null;
    }
  }, []);

  /* Compare the pointer against each row's midpoint, skipping the dragged row
     (its own slot is a deadzone) and locked rows (they hold the front). */
  const projectOrder = useCallback(
    (clientY: number) => {
      const listEl = columnListScrollRef.current;
      const key = draggedFieldIdRef.current;
      if (!key) return;
      const base = fieldOrderRef.current.filter((k) => k !== key);

      let insertAt = base.length;
      if (listEl) {
        const rows = Array.from(listEl.querySelectorAll<HTMLElement>("[data-field-id]")).filter((r) => {
          const k = r.getAttribute("data-field-id");
          return k !== null && k !== key && !LOCKED_FIELD_IDS.has(k);
        });
        let visibleAt = rows.length;
        for (let i = 0; i < rows.length; i++) {
          const rect = rows[i].getBoundingClientRect();
          if (clientY < rect.top + rect.height / 2) {
            visibleAt = i;
            break;
          }
        }
        const targetKey = visibleAt >= rows.length ? null : rows[visibleAt].getAttribute("data-field-id");
        insertAt = targetKey ? base.indexOf(targetKey) : base.length;
        if (insertAt < 0) insertAt = base.length;
      }

      const next = [...base];
      next.splice(insertAt, 0, key);
      setLiveFieldOrder((prev) =>
        prev && prev.length === next.length && prev.every((k, i) => k === next[i]) ? prev : next,
      );
    },
    [LOCKED_FIELD_IDS],
  );

  /* The lifted copy is moved by touching its transform directly rather than by
     re-rendering the modal sixty times a second. */
  const moveGhost = useCallback((clientX: number, clientY: number) => {
    pointerYRef.current = clientY;
    const el = dragGhostRef.current;
    if (!el) return;
    const { x, y } = grabOffsetRef.current;
    el.style.transform = `translate3d(${clientX - x}px, ${clientY - y}px, 0) rotate(-1.5deg)`;
  }, []);

  /* Card-wide pointerdown opens a drag-or-click session. Nothing commits to a
     drag until the pointer passes DRAG_THRESHOLD_PX; below it the press is a
     click that toggles the column, as before. */
  const handleCardPointerDown = useCallback(
    (e: React.PointerEvent, fieldId: string) => {
      if (e.button !== 0) return;
      if (LOCKED_FIELD_IDS.has(fieldId)) return;

      const startX = e.clientX;
      const startY = e.clientY;
      // Measured before the row is replaced by its slot, so the lifted copy is
      // the same size as the card it came from.
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const label = ALL_FIELDS.find((f) => f.id === fieldId)?.label ?? fieldId;
      let activated = false;

      const activateDrag = (clientX: number, clientY: number) => {
        activated = true;
        grabOffsetRef.current = { x: startX - rect.left, y: startY - rect.top };
        setDragCard({ label, width: rect.width, height: rect.height });
        setDraggedFieldId(fieldId);
        draggedFieldIdRef.current = fieldId;
        setLiveFieldOrder(fieldOrderRef.current);
        pointerYRef.current = clientY;
        moveGhost(clientX, clientY);
        startAutoScroll();
        document.body.style.userSelect = "none";
        document.body.style.cursor = "grabbing";
      };

      const handleMove = (ev: PointerEvent) => {
        if (!activated) {
          if (Math.abs(ev.clientX - startX) + Math.abs(ev.clientY - startY) < DRAG_THRESHOLD_PX) return;
          activateDrag(ev.clientX, ev.clientY);
        }
        pointerYRef.current = ev.clientY;
        moveGhost(ev.clientX, ev.clientY);
        projectOrder(ev.clientY);
      };

      const endSession = (commit: boolean) => {
        window.removeEventListener("pointermove", handleMove);
        window.removeEventListener("pointerup", handleUp);
        window.removeEventListener("pointercancel", handleCancel);
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
        if (activated) {
          const projected = liveFieldOrderRef.current;
          if (commit && projected) setFieldOrder(projected);
          setDraggedFieldId(null);
          setDragCard(null);
          setLiveFieldOrder(null);
          stopAutoScroll();
        } else if (commit) {
          setChecked((prev) => {
            const next = new Set(prev);
            if (next.has(fieldId)) next.delete(fieldId);
            else next.add(fieldId);
            return next;
          });
        }
      };
      const handleUp = () => endSession(true);
      const handleCancel = () => endSession(false);

      window.addEventListener("pointermove", handleMove);
      window.addEventListener("pointerup", handleUp);
      window.addEventListener("pointercancel", handleCancel);
    },
    [LOCKED_FIELD_IDS, ALL_FIELDS, startAutoScroll, stopAutoScroll, projectOrder, moveGhost],
  );

  const smoothScrollTo = (el: HTMLElement, targetTop: number, duration = 800) => {
    const start = el.scrollTop;
    const distance = targetTop - start;
    if (Math.abs(distance) < 1) return;
    const startTime = performance.now();
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      el.scrollTop = start + distance * easeOutCubic(progress);
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  const flashRecentlyMoved = (fieldId: string) => {
    setRecentlyMovedFieldId(fieldId);
    if (recentMoveTimerRef.current !== null) window.clearTimeout(recentMoveTimerRef.current);
    recentMoveTimerRef.current = window.setTimeout(() => {
      setRecentlyMovedFieldId(null);
      recentMoveTimerRef.current = null;
    }, 1500);
  };

  const handleMoveToTop = (fieldId: string) => {
    if (LOCKED_FIELD_IDS.has(fieldId)) return;
    const el = columnListScrollRef.current;
    const startScroll = el?.scrollTop ?? 0;
    setFieldOrder((prev) => {
      const next = prev.filter((id) => id !== fieldId);
      let insertAt = 0;
      while (insertAt < next.length && LOCKED_FIELD_IDS.has(next[insertAt])) insertAt++;
      next.splice(insertAt, 0, fieldId);
      return next;
    });
    flashRecentlyMoved(fieldId);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!el) return;
        el.scrollTop = startScroll;
        smoothScrollTo(el, 0);
      });
    });
  };

  const handleMoveToBottom = (fieldId: string) => {
    if (LOCKED_FIELD_IDS.has(fieldId)) return;
    const el = columnListScrollRef.current;
    const startScroll = el?.scrollTop ?? 0;
    setFieldOrder((prev) => {
      const next = prev.filter((id) => id !== fieldId);
      next.push(fieldId);
      return next;
    });
    flashRecentlyMoved(fieldId);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!el) return;
        el.scrollTop = startScroll;
        smoothScrollTo(el, el.scrollHeight);
      });
    });
  };

  const titlePlural = spec.nouns.titlePlural;

  return (
    <ModalShell open={open} onClose={onClose} z={40}>
      <div
        className="bg-white flex flex-col overflow-hidden transition-[max-width,max-height] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
        style={{
          width: "100vw",
          height: "100vh",
          maxWidth: isFullScreen ? "calc(100vw - 2rem)" : "1024px",
          maxHeight: isFullScreen ? "calc(100vh - 2rem)" : "min(860px, calc(100vh - 48px))",
          borderRadius: 16,
          boxShadow: "0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)",
        }}
      >
        {/* Header */}
        <div className="px-4 lg:px-5 pt-4 pb-4 shrink-0 bg-white border-b border-[#EEF2F6]" style={{ borderTopLeftRadius: 16, borderTopRightRadius: 16 }}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="shrink-0 w-9 h-9 rounded-[10px] flex items-center justify-center" style={{ backgroundColor: "#EFF6FF" }}>
                <Download className="w-[18px] h-[18px]" style={{ color: "#2563EB" }} />
              </div>
              <div className="min-w-0">
                <h2 className="text-[15px] sm:text-[17px] text-[#0F172A]" style={{ fontWeight: 700 }}>
                  Export {titlePlural}
                </h2>
                <p className="text-[11px] sm:text-xs text-[#64748B] mt-0.5" style={{ fontWeight: 400 }}>
                  Choose a format and the columns to include. Your export covers the {spec.nouns.plural} shown on the list now, with any
                  filters or search you have applied.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setIsFullScreen((v) => !v)}
                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] border border-[#E2E8F0] bg-white text-xs text-[#475569] hover:bg-[#F8FAFC] hover:border-[#CBD5E1] transition-colors cursor-pointer"
                style={{ fontWeight: 500 }}
              >
                {isFullScreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                {isFullScreen ? "Exit Full" : "Full View"}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-[8px] flex items-center justify-center text-[#94A3B8] hover:text-[#64748B] hover:bg-[#F1F5F9] transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 bg-[#FAFBFC] overflow-hidden px-4 lg:px-6 py-4 lg:py-5 flex flex-col gap-4">
          {scopeBanner && (
            <div
              className="shrink-0 rounded-[10px] border border-[#E2E8F0] bg-[#F1F5F9] px-4 py-2.5 flex items-center gap-2.5 transition-[background-color,border-color,box-shadow] duration-150 hover:bg-[#ECF0F4] hover:border-[#D6DCE5] hover:shadow-sm"
            >
              <Package className="w-[18px] h-[18px] shrink-0" style={{ color: "#64748B" }} />
              <div className="flex-1 min-w-0 text-[13px] leading-[20px] truncate text-left" style={{ color: "#1E293B" }}>
                <span style={{ fontWeight: 600 }}>{scopeBanner.count}</span>{" "}
                <span style={{ color: "#64748B", fontWeight: 400 }}>({scopeBanner.subtext})</span>
              </div>
              {context?.kind === "filtered" && onClearFilters && (
                <button
                  type="button"
                  onClick={onClearFilters}
                  className="shrink-0 inline-flex items-center gap-1 text-[13px] leading-[20px] cursor-pointer hover:underline underline-offset-2"
                  style={{ color: "#0A77FF", fontWeight: 500 }}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Clear filters
                </button>
              )}
              {context?.kind === "selected" && onSelectAll && (
                <button
                  type="button"
                  onClick={onSelectAll}
                  className="shrink-0 inline-flex items-center gap-1 text-[13px] leading-[20px] cursor-pointer hover:underline underline-offset-2"
                  style={{ color: "#0A77FF", fontWeight: 500 }}
                >
                  <ListChecks className="w-3.5 h-3.5" />
                  Select all
                </button>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-[1.55fr_1fr] gap-5 flex-1 min-h-0">
            {/* LEFT: format cards */}
            <div className="rounded-[12px] border bg-white flex flex-col overflow-hidden" style={{ borderColor: "#E2E8F0" }}>
              <div className="px-5 pt-3 pb-3 shrink-0 flex items-center gap-2" style={{ backgroundColor: "#F8FAFC" }}>
                <FileType className="w-4 h-4 shrink-0" style={{ color: "#64748B" }} />
                <h3 className="text-[14px]" style={{ color: "#0F172A", fontWeight: 600 }}>
                  File Format
                </h3>
              </div>
              <div className="border-t shrink-0" style={{ borderColor: "#E2E8F0" }} />
              <div className="flex-1 overflow-y-auto px-5 pb-3 pt-4" style={{ minHeight: 0 }}>
                <div className="space-y-3">
                  {FORMAT_CARDS.map((card) => (
                    <FormatCardRow key={card.key} card={card} isSelected={format === card.key} onSelect={() => setFormat(card.key)} />
                  ))}
                </div>
              </div>
            </div>

            {/* RIGHT: column picker */}
            <div className="rounded-[12px] border bg-white flex flex-col overflow-hidden" style={{ borderColor: "#E2E8F0" }}>
              <div className="px-5 pt-3 pb-3 shrink-0 flex items-center gap-2" style={{ backgroundColor: "#F8FAFC" }}>
                <Columns3 className="w-4 h-4 shrink-0" style={{ color: "#64748B" }} />
                <h3 className="text-[14px]" style={{ color: "#0F172A", fontWeight: 600 }}>
                  Columns to Include
                </h3>
              </div>
              <div className="border-t shrink-0" style={{ borderColor: "#E2E8F0" }} />
              <div className="px-5 pt-4 pb-2 shrink-0">
                <div className="flex items-center gap-2 px-3 h-9 rounded-[8px] border bg-white" style={{ borderColor: "#E2E8F0" }}>
                  <Search className="w-4 h-4 text-[#94A3B8]" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search columns"
                    className="flex-1 outline-none text-[13px] bg-transparent placeholder:text-[#94A3B8]"
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => setSearch("")}
                      className="p-0.5 rounded-full hover:bg-[#F1F5F9] text-[#94A3B8] hover:text-[#475569] transition-colors cursor-pointer"
                      aria-label="Clear search"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="px-5 py-2 flex items-center gap-2 shrink-0">
                <Checkbox checked={masterCheckboxState} onCheckedChange={handleSelectAllToggle} aria-label="Select All Columns" />
                <span className="text-[12px]" style={{ color: "#475569", fontWeight: 500 }}>
                  {masterCheckboxState === true
                    ? `All ${ALL_FIELDS.length} columns selected`
                    : checked.size > 0
                      ? `${checked.size} of ${ALL_FIELDS.length} columns selected`
                      : "Select All Columns"}
                </span>
              </div>

              {checked.size === 0 && !noResults && (
                <div className="px-5 py-2 border-b shrink-0" style={{ backgroundColor: "#FEF3C7", borderColor: "#FDE68A", color: "#92400E" }}>
                  <span className="text-[12px]" style={{ fontWeight: 500 }}>
                    Pick at least one column to export.
                  </span>
                </div>
              )}

              <div
                ref={columnListScrollRef}
                className="flex-1 overflow-y-auto px-5 pt-1 pb-3 space-y-1.5"
                style={{
                  minHeight: 0,
                  scrollbarWidth: "thin",
                  scrollbarColor: "#CBD5E1 transparent",
                  overflowAnchor: "none",
                  transition: "background-color .15s, box-shadow .15s",
                  ...(draggedFieldId
                    ? {
                        backgroundColor: "color-mix(in srgb, var(--piw-primary) 3%, transparent)",
                        boxShadow: "inset 0 0 0 2px color-mix(in srgb, var(--piw-primary) 22%, transparent)",
                      }
                    : null),
                }}
              >
                {noResults ? (
                  <div className="px-4 py-12 text-center text-[12.5px]" style={{ color: "#94A3B8" }}>
                    No Columns Match Your Search.
                  </div>
                ) : (
                  filteredFields.map((field, idx) =>
                    draggedFieldId === field.id ? (
                      <div
                        key={field.id}
                        data-field-id={field.id}
                        className="flex items-center justify-center shrink-0"
                        style={{
                          height: dragCard?.height ?? CARD_H,
                          borderRadius: 10,
                          border: "2px dashed color-mix(in srgb, var(--piw-primary) 55%, transparent)",
                          background: "color-mix(in srgb, var(--piw-primary) 7%, #FFFFFF)",
                          gap: 6,
                          fontSize: 12.5,
                          fontWeight: 600,
                          color: "var(--piw-primary)",
                        }}
                      >
                        <CornerDownLeft size={13} />
                        Drop here · position {idx + 1} of {filteredFields.length}
                      </div>
                    ) : (
                    <FieldCard
                      key={field.id}
                      field={field}
                      checked={checked.has(field.id)}
                      dragActive={draggedFieldId !== null}
                      onToggle={() =>
                        setChecked((prev) => {
                          const next = new Set(prev);
                          if (next.has(field.id)) next.delete(field.id);
                          else next.add(field.id);
                          return next;
                        })
                      }
                      onCardPointerDown={handleCardPointerDown}
                      searchQuery={search}
                      showQuickReorder={idx >= 6}
                      onMoveToTop={() => handleMoveToTop(field.id)}
                      onMoveToBottom={() => handleMoveToBottom(field.id)}
                      isRecentlyMoved={recentlyMovedFieldId === field.id}
                      lockTooltip={lockTooltip}
                    />
                    ),
                  )
                )}
              </div>
              {createPortal(
                <div
                  ref={dragGhostRef}
                  aria-hidden="true"
                  className="items-center"
                  style={{
                    display: dragCard ? "flex" : "none",
                    position: "fixed",
                    top: 0,
                    left: 0,
                    zIndex: DRAG_GHOST_Z,
                    pointerEvents: "none",
                    width: dragCard?.width,
                    height: dragCard?.height,
                    gap: 10,
                    padding: "10px 12px",
                    borderRadius: 10,
                    background: "#FFFFFF",
                    border: "1px solid color-mix(in srgb, var(--piw-primary) 45%, transparent)",
                    boxShadow: "0 16px 32px -8px rgba(0,0,0,0.26), 0 3px 8px rgba(0,0,0,0.10)",
                    boxSizing: "border-box",
                  }}
                >
                  <span className="shrink-0 flex items-center justify-center" style={{ width: 22, height: 22, color: "var(--piw-primary)" }}>
                    <GripVertical size={16} />
                  </span>
                  <span className="truncate flex-1 min-w-0" style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>
                    {dragCard?.label}
                  </span>
                  <span
                    className="shrink-0"
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: "var(--piw-primary)",
                      background: "#EDF4FF",
                      border: "1px solid #BFDBFE",
                      borderRadius: 9999,
                      padding: "1px 8px",
                      lineHeight: "16px",
                    }}
                  >
                    {filteredFields.findIndex((f) => f.id === draggedFieldId) + 1 || 1} of {filteredFields.length}
                  </span>
                </div>,
                document.body,
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className="shrink-0 border-t border-[#EEF2F6] bg-white px-4 lg:px-5 py-2.5 sm:py-3 flex items-center gap-2 sm:gap-2.5"
          style={{ borderBottomLeftRadius: 16, borderBottomRightRadius: 16 }}
        >
          <div className="flex-1" />
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center px-3 sm:px-5 h-8 sm:h-9 rounded-[8px] border border-[#E2E8F0] bg-white text-xs sm:text-[13px] text-[#64748B] hover:text-[#0F172A] hover:border-[#CBD5E1] transition-colors cursor-pointer"
            style={{ fontWeight: 500 }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={checked.size === 0 || exporting || rows.length === 0}
            className="inline-flex items-center gap-1.5 px-3 sm:px-5 h-8 sm:h-9 rounded-[8px] text-white shadow-sm transition-colors cursor-pointer text-xs sm:text-[13px] disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ fontWeight: 600, backgroundColor: theme.button }}
          >
            {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            {exportLabel}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
