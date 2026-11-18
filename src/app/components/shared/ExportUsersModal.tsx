import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  X,
  Search,
  Lock,
  GripVertical,
  Maximize2,
  Minimize2,
  ChevronsUp,
  ChevronsDown,
  Users,
  Loader2,
  CheckCircle2,
  FileType,
  Columns3,
  Info,
  ListChecks,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "../ui/checkbox";
import { Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip";
import { ModalShell } from "./ModalShell";
import { ColumnDragGhost, ColumnDropSlot, useColumnDragReorder } from "./columnDragReorder";
import type { UserRow } from "../../data/users-data";
import {
  exportFilename,
  exportUsersCsv,
  exportUsersExcel,
  exportUsersPdf,
  USERS_TEMPLATE_FIELD_HELP,
} from "../../lib/users-export";

export type ExportFormat = "pdf" | "excel" | "csv";

/** Context describing which Export button opened the modal. */
export type ExportUsersContext =
  | { kind: "all"; totalCount: number }
  | { kind: "filtered"; filteredCount: number; totalCount: number }
  | { kind: "selected"; selectedCount: number };

interface ExportUsersModalProps {
  open: boolean;
  onClose: () => void;
  /** Provided by the trigger that opened the modal. Null when modal is closed. */
  context: ExportUsersContext | null;
  /** Per-column visibility map from the Users listing table, used to pre-check the Original columns section. */
  tableColumnVisibility?: Record<string, boolean>;
  /** Rows to include in the export. Already resolved by the parent based on context (all/filtered/selected). */
  rows: UserRow[];
  /** Filtered scope: resets the listing's filters, quick filters and search so the export covers every record. */
  onClearFilters?: () => void;
  /** Selected scope: selects every record in the listing so the export covers them all. */
  onSelectAll?: () => void;
}

type ColumnType =
  | "text"
  | "email"
  | "enum"
  | "date"
  | "datetime"
  | "multi-value"
  | "number"
  | "phone";

interface PickerField {
  /** Stable id. For Original columns, this matches the DataTable column key. */
  id: string;
  label: string;
  type: ColumnType;
  locked?: boolean;
  /** Optional help text shown in an info tooltip next to the label. */
  helpText?: string;
}

type SectionKey = "original" | "personal" | "work" | "contact" | "account" | "activity";

interface PickerSection {
  key: SectionKey;
  title: string;
  chipLabel: string;
  fields: PickerField[];
}

const SECTIONS: PickerSection[] = [
  {
    key: "original",
    title: "Identity and Access",
    chipLabel: "Identity",
    fields: [
      {
        id: "full_name",
        label: "Full Name",
        type: "text",
        locked: true,
        helpText: "Always included. The user's full name as it appears in Omne.",
      },
      {
        id: "assigned_roles",
        label: "Assigned Roles",
        type: "multi-value",
        helpText: "Every role the user holds. A user can hold more than one.",
      },
      {
        id: "license",
        label: "License",
        type: "enum",
        helpText: "Full Access, Field User, or No License.",
      },
      {
        id: "email",
        label: "Email",
        type: "email",
        helpText:
          "The address the user signs in with and where Omne sends their notifications.",
      },
      {
        id: "last_logon",
        label: "Last Sign In",
        type: "datetime",
        helpText: "When the user most recently signed in.",
      },
      {
        id: "status",
        label: "Status",
        type: "enum",
        helpText:
          "The user's account state: Active, Deactivated, Invite Sent, Invite Expired, Draft, or Archived.",
      },
      {
        id: "invited_by",
        label: "Invited By",
        type: "text",
        helpText: "The admin who sent the invitation.",
      },
      {
        id: "invited_on",
        label: "Invited On",
        type: "date",
        helpText: "When the invitation was sent.",
      },
      {
        id: "invite_accepted_on",
        label: "Invite Accepted On",
        type: "datetime",
        helpText: "When the user accepted the invitation and finished setup.",
      },
    ],
  },
  {
    key: "personal",
    title: "Personal Information",
    chipLabel: "Personal",
    fields: [
      {
        id: "add.username",
        label: "Username",
        type: "text",
        helpText: "The user's short sign-in handle, if one is set.",
      },
      { id: "add.gender", label: "Gender", type: "text" },
      { id: "add.dob", label: "Date of Birth", type: "date" },
      {
        id: "add.preferred_name",
        label: "Preferred Name",
        type: "text",
        helpText: "The name the user goes by.",
      },
      { id: "add.pronouns", label: "Pronouns", type: "text" },
    ],
  },
  {
    key: "work",
    title: "Work and Organization",
    chipLabel: "Work",
    fields: [
      { id: "add.job_title", label: "Job Title", type: "text" },
    ],
  },
  {
    key: "contact",
    title: "Contact and Address",
    chipLabel: "Contact",
    fields: [
      {
        id: "add.personal_email",
        label: "Personal Email",
        type: "email",
        helpText: "A personal address on file. Not used for signing in.",
      },
      { id: "add.mobile", label: "Mobile", type: "phone" },
      { id: "add.work_phone", label: "Work Phone", type: "phone" },
      { id: "add.home_address", label: "Home Address", type: "text" },
      { id: "add.work_address", label: "Work Address", type: "text" },
    ],
  },
  {
    key: "account",
    title: "Account and Security",
    chipLabel: "Account",
    fields: [
      {
        id: "add.mfa",
        label: "Multi-Factor Authentication",
        type: "enum",
        helpText: "Whether the user has multi-factor authentication turned on.",
      },
      {
        id: "add.last_password_change",
        label: "Last Password Change",
        type: "date",
        helpText: "When the user last changed their password.",
      },
      {
        id: "add.account_created",
        label: "Account Created",
        type: "date",
        helpText: "When the account was first created in Omne.",
      },
      {
        id: "add.invite_link_expiry",
        label: "Invitation Link Expiry",
        type: "text",
        helpText: "When the user's current invitation link stops working.",
      },
    ],
  },
  {
    key: "activity",
    title: "Activity",
    chipLabel: "Activity",
    fields: [
      {
        id: "add.logins_30d",
        label: "Logins in Last 30 Days",
        type: "number",
        helpText: "Sign-ins over the past 30 days.",
      },
      {
        id: "add.days_since_login",
        label: "Days Since Last Sign In",
        type: "number",
        helpText: "Days since the user last signed in.",
      },
      {
        id: "add.sessions_per_week",
        label: "Sessions per Week",
        type: "number",
        helpText: "Average sign-in sessions per week.",
      },
      {
        id: "add.password_age",
        label: "Password Age",
        type: "number",
        helpText: "How long since the user last changed their password.",
      },
    ],
  },
];

const ORIGINAL_SECTION = SECTIONS[0];
const ALL_FIELDS: PickerField[] = SECTIONS.flatMap((s) => s.fields);
const LOCKED_FIELD_IDS = new Set(ALL_FIELDS.filter((f) => f.locked).map((f) => f.id));

interface FormatTheme {
  badgeBg: string;
  badgeText: string;
  border: string;
  cardBg: string;
  radio: string;
  button: string;
}

/** Shared blue accent for selected card border, radio, background tint, and CTA button,
 *  applies regardless of which format is picked. Only the badge (icon) tint changes per format. */
const SHARED_BLUE = {
  border: "#2563EB",
  cardBg: "#F5FAFF",
  radio: "#2563EB",
  button: "#2563EB",
};

const FORMAT_THEMES: Record<ExportFormat, FormatTheme> = {
  pdf: {
    badgeBg: "#EFF6FF",
    badgeText: "#2563EB",
    ...SHARED_BLUE,
  },
  excel: {
    badgeBg: "#ECFDF5",
    badgeText: "#047857",
    ...SHARED_BLUE,
  },
  csv: {
    badgeBg: "#FFFBEB",
    badgeText: "#B45309",
    ...SHARED_BLUE,
  },
};

const FORMAT_CARDS: { key: ExportFormat; badge: string; title: string; description: string }[] = [
  {
    key: "pdf",
    badge: "PDF",
    title: "PDF Document",
    description:
      "Best for reading and printing. Looks the same on any device, but cannot be edited.",
  },
  {
    key: "excel",
    badge: "XLS",
    title: "Excel Spreadsheet",
    description:
      "Best for working with the data. Opens in Excel or Google Sheets, ready to sort, filter, and total.",
  },
  {
    key: "csv",
    badge: "CSV",
    title: "CSV File",
    description:
      "Best for moving data between systems. A plain file that opens almost anywhere and keeps the raw values with no formatting.",
  },
];

function buildScopeBanner(
  context: ExportUsersContext | null
): { count: string; subtext: string } | null {
  if (!context) return null;
  const word = (n: number) => (n === 1 ? "user" : "users");
  if (context.kind === "filtered") {
    return {
      count: `${context.filteredCount} ${word(context.filteredCount)}`,
      subtext: "Only the users matching your current filters will be exported",
    };
  }
  if (context.kind === "selected") {
    return {
      count: `${context.selectedCount} ${word(context.selectedCount)}`,
      subtext: "Only the users you selected will be exported",
    };
  }
  return {
    count: `${context.totalCount} ${word(context.totalCount)}`,
    subtext: "Every user on your list will be exported, except archived users",
  };
}

function computeDefaultChecked(
  tableColumnVisibility: Record<string, boolean> | undefined
): Set<string> {
  const checked = new Set<string>();
  for (const field of ORIGINAL_SECTION.fields) {
    const visible = tableColumnVisibility ? tableColumnVisibility[field.id] !== false : true;
    if (field.locked || visible) checked.add(field.id);
  }
  return checked;
}

/** Highlight search-query matches in a text label with a yellow <mark>. */
function highlightMatch(text: string, query: string): React.ReactNode {
  const q = query.trim();
  if (!q) return text;
  const regex = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  const parts = text.split(regex);
  if (parts.length === 1) return text;
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <mark
            key={i}
            className="px-0.5 rounded-sm"
            style={{ backgroundColor: "#FEFCE8", color: "#854D0E", fontWeight: 500 }}
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
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
  onCardPointerDown,
  onToggle,
  searchQuery,
  showQuickReorder,
  onMoveToTop,
  onMoveToBottom,
  isRecentlyMoved,
}: {
  field: PickerField;
  checked: boolean;
  /** A drag is in progress somewhere in the list: every card fades to 0.55. */
  dragActive: boolean;
  /** Card-wide pointerdown, opens a drag-or-click session. The parent
   *  decides on pointer-up whether to toggle (click) or commit a reorder
   *  (drag) based on whether the pointer crossed the drag threshold. */
  onCardPointerDown: (e: React.PointerEvent, fieldId: string) => void;
  /** Checkbox toggle. The checkbox opts out of the drag session. */
  onToggle: () => void;
  searchQuery: string;
  showQuickReorder: boolean;
  onMoveToTop: () => void;
  onMoveToBottom: () => void;
  isRecentlyMoved: boolean;
}) {
  const isLocked = !!field.locked;
  const [isHovered, setIsHovered] = useState(false);

  // Hover treatment mirrors the Create-User RoleCard. Applies to checked and
  // unchecked cards alike, locked / drag / recently-moved cards opt out so
  // hover does not fight their own indicators.
  const showHover = isHovered && !isLocked && !dragActive && !isRecentlyMoved;

  const borderColor = isRecentlyMoved
    ? "#007FFF"
    : showHover
      ? "#CBD5E1"
      : checked
        ? "#BFDBFE"
        : "#E2E8F0";

  const backgroundColor = showHover ? "#FAFCFF" : "#FFFFFF";

  const boxShadow = showHover
    ? "0 2px 8px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)"
    : undefined;

  return (
    <div
      data-field-id={field.id}
      onPointerDown={(e) => onCardPointerDown(e, field.id)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`group flex items-center gap-3 px-3 py-2.5 rounded-[10px] transition-all duration-150 ${
        isLocked ? "cursor-default" : "cursor-grab"
      } ${isRecentlyMoved ? "ring-2 ring-[#007FFF]/60" : ""}`}
      style={{
        backgroundColor,
        border: `1px solid ${borderColor}`,
        boxShadow,
        opacity: dragActive ? 0.55 : 1,
      }}
    >
      {/* Grip, moved to the front. Visual affordance only; the whole card
       *  drives drag activation via onPointerDown above. */}
      <div
        className={`shrink-0 flex items-center justify-center w-5 h-5 transition-colors ${
          isLocked
            ? "text-[#E2E8F0]"
            : "text-[#94A3B8] group-hover:text-[#475569]"
        }`}
        aria-hidden="true"
      >
        <GripVertical className="w-4 h-4" />
      </div>

      <div
        className="flex"
        style={isLocked && checked ? { opacity: 0.55 } : undefined}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <Checkbox
          checked={checked}
          disabled={isLocked}
          onCheckedChange={() => {
            if (!isLocked) onToggle();
          }}
          aria-label={`Select ${field.label}`}
        />
      </div>

      <div className="flex items-center gap-2 flex-1 min-w-0">
        {isLocked && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                className="shrink-0 inline-flex items-center justify-center cursor-help"
                aria-label="Locked"
              >
                <Lock className="w-3.5 h-3.5" style={{ color: "#94A3B8" }} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={6} className="z-[200]">
              Full name is always included. It is how each user is identified in the file.
            </TooltipContent>
          </Tooltip>
        )}
        <span
          className="text-[13px] truncate"
          style={{ color: isLocked ? "#64748B" : "#0F172A", fontWeight: 500 }}
        >
          {highlightMatch(field.label, searchQuery)}
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
            <TooltipContent
              side="top"
              sideOffset={6}
              className="z-[200] max-w-[260px]"
            >
              {field.helpText}
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Quick-reorder buttons, visible on hover for cards beyond position 6.
       *  Each chevron is its own bordered button so the pair reads as two
       *  distinct controls instead of a segmented control. */}
      {!isLocked && showQuickReorder && (
        <div className="shrink-0 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
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
            <TooltipContent side="top" sideOffset={6} className="z-[200]">
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
            <TooltipContent side="top" sideOffset={6} className="z-[200]">
              Move to Bottom
            </TooltipContent>
          </Tooltip>
        </div>
      )}
    </div>
  );
}

/** Vertically-stacked format card. Badge + radio on top row, title/description below.
 *  Hover + selected states mirror the Create-User RoleCard treatment. */
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
          className="shrink-0 w-4 h-4 rounded-full border-[1.5px] flex items-center justify-center mt-1"
          style={{ borderColor: isSelected ? t.radio : "#CBD5E1" }}
        >
          {isSelected && (
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: t.radio }} />
          )}
        </span>
      </div>
      <div className="text-[13px] leading-[18px]" style={{ fontWeight: 600, color: "#0F172A" }}>
        {card.title}
      </div>
      <div
        className="text-[11.5px] leading-[15px] mt-1"
        style={{ color: "#64748B", fontWeight: 400 }}
      >
        {card.description}
      </div>
    </button>
  );
}

export function ExportUsersModal({
  open,
  onClose,
  context,
  onClearFilters,
  onSelectAll,
  tableColumnVisibility,
  rows,
}: ExportUsersModalProps) {
  const [format, setFormat] = useState<ExportFormat>("pdf");
  /** Column selection, drives the export. */
  const [checked, setChecked] = useState<Set<string>>(new Set());
  /** True while a file is being generated. Disables the Export button and shows a spinner. */
  const [exporting, setExporting] = useState(false);
  const [search, setSearch] = useState("");
  /** Order of every field id in the picker. Drag-reorder commits to this on pointer-up. */
  const [fieldOrder, setFieldOrder] = useState<string[]>(() => ALL_FIELDS.map((f) => f.id));
  /** Whether the modal is expanded to full-viewport. */
  const [isFullScreen, setIsFullScreen] = useState(false);
  /** Ref to the scrollable column list so we can auto-scroll after quick reorder. */
  const columnListScrollRef = useRef<HTMLDivElement | null>(null);
  /** Field id that was just moved via the quick-reorder buttons, drives a 1.5s highlight. */
  const [recentlyMovedFieldId, setRecentlyMovedFieldId] = useState<string | null>(null);
  const recentMoveTimerRef = useRef<number | null>(null);

  /* Drag reorder, mirrored from Financial Reporting's Selected Columns. A
   * click below the 5px threshold still toggles the row. */
  const toggleField = useCallback((fieldId: string) => {
    if (LOCKED_FIELD_IDS.has(fieldId)) return;
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(fieldId)) next.delete(fieldId);
      else next.add(fieldId);
      return next;
    });
  }, []);
  const fieldLabel = useCallback(
    (id: string) => ALL_FIELDS.find((f) => f.id === id)?.label ?? id,
    []
  );
  const drag = useColumnDragReorder({
    order: fieldOrder,
    onCommit: setFieldOrder,
    lockedIds: LOCKED_FIELD_IDS,
    labelFor: fieldLabel,
    listRef: columnListScrollRef,
    onCardClick: toggleField,
  });

  // Reset all state whenever the modal is opened fresh.
  useEffect(() => {
    if (!open) return;
    setFormat("pdf");
    setChecked(computeDefaultChecked(tableColumnVisibility));
    setSearch("");
    setFieldOrder(ALL_FIELDS.map((f) => f.id));
    setIsFullScreen(false);
    setRecentlyMovedFieldId(null);
    setExporting(false);
    if (recentMoveTimerRef.current !== null) {
      window.clearTimeout(recentMoveTimerRef.current);
      recentMoveTimerRef.current = null;
    }
  }, [open, tableColumnVisibility]);

  const scopeBanner = buildScopeBanner(context);
  const theme = FORMAT_THEMES[format];

  /** Field ids selected, in the user's chosen drag-order. */
  const exportFieldIds = useMemo(() => {
    return fieldOrder.filter((id) => checked.has(id));
  }, [fieldOrder, checked]);

  /** Resolve labels for the selected fields in order. */
  const exportFieldLabels = useMemo(() => {
    const byId = new Map(ALL_FIELDS.map((f) => [f.id, f.label]));
    return exportFieldIds.map((id) => byId.get(id) ?? id);
  }, [exportFieldIds]);

  /** Info-icon text per selected field, for the Excel Glossary tab. */
  const exportFieldHelp = useMemo(() => {
    const byId = new Map(ALL_FIELDS.map((f) => [f.id, f.helpText]));
    return exportFieldIds.map((id) => byId.get(id) ?? USERS_TEMPLATE_FIELD_HELP[id]);
  }, [exportFieldIds]);

  const handleExport = async () => {
    if (exporting || exportFieldIds.length === 0 || rows.length === 0) return;
    setExporting(true);
    try {
      if (format === "csv") {
        exportUsersCsv(rows, exportFieldIds, exportFieldLabels);
      } else if (format === "excel") {
        await exportUsersExcel(rows, exportFieldIds, exportFieldLabels, exportFieldHelp);
      } else {
        await exportUsersPdf(rows, exportFieldIds, exportFieldLabels);
      }
      const ext = format === "excel" ? "xlsx" : format;
      toast.success(`Exported ${exportFilename(ext)}`, {
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

  const exportLabel = exporting
    ? "Exporting…"
    : format === "pdf"
      ? "Export as PDF"
      : format === "excel"
        ? "Export as Excel"
        : "Export as CSV";

  // ──────────────────────────────────────────────────────────────────────────
  // Column picker derived data
  // ──────────────────────────────────────────────────────────────────────────

  const normalizedQuery = search.trim().toLowerCase();
  const currentOrder = drag.liveOrder ?? fieldOrder;
  const orderedFields = useMemo(() => {
    const byId = new Map(ALL_FIELDS.map((f) => [f.id, f]));
    return currentOrder.map((id) => byId.get(id)).filter((f): f is PickerField => !!f);
  }, [currentOrder]);

  const filteredFields = useMemo(() => {
    if (!normalizedQuery) return orderedFields;
    return orderedFields.filter((f) => f.label.toLowerCase().includes(normalizedQuery));
  }, [orderedFields, normalizedQuery]);

  const noResults = filteredFields.length === 0;

  /** Master checkbox state for the currently visible (filtered) rows. */
  const visibleSelectable = filteredFields.filter((f) => !f.locked);
  const allVisibleSelected =
    visibleSelectable.length > 0 && visibleSelectable.every((f) => checked.has(f.id));
  const someVisibleSelected =
    visibleSelectable.some((f) => checked.has(f.id)) && !allVisibleSelected;
  const masterCheckboxState: boolean | "indeterminate" = allVisibleSelected
    ? true
    : someVisibleSelected
      ? "indeterminate"
      : false;

  /** Toggle every visible (filtered) row. Locked rows are never modified. */
  const handleSelectAllToggle = () => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const f of visibleSelectable) next.delete(f.id);
      } else {
        for (const f of visibleSelectable) next.add(f.id);
      }
      return next;
    });
  };

  // ──────────────────────────────────────────────────────────────────────────
  // Quick reorder (Move to Top / Move to Bottom). Drag lives in useColumnDragReorder.
  // ──────────────────────────────────────────────────────────────────────────

  /** Custom smooth-scroll with ease-out-cubic. */
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
    if (recentMoveTimerRef.current !== null) {
      window.clearTimeout(recentMoveTimerRef.current);
    }
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
      while (insertAt < next.length && LOCKED_FIELD_IDS.has(next[insertAt])) {
        insertAt++;
      }
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

  // ──────────────────────────────────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────────────────────────────────

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
        {/* ─── Header ─── */}
        <div
          className="px-4 lg:px-5 pt-4 pb-4 shrink-0 bg-white border-b border-[#EEF2F6]"
          style={{ borderTopLeftRadius: 16, borderTopRightRadius: 16 }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="shrink-0 w-9 h-9 rounded-[10px] flex items-center justify-center"
                style={{ backgroundColor: "#EFF6FF" }}
              >
                <Download className="w-[18px] h-[18px]" style={{ color: "#2563EB" }} />
              </div>
              <div className="min-w-0">
                <h2
                  className="text-[15px] sm:text-[17px] text-[#0F172A]"
                  style={{ fontWeight: 700 }}
                >
                  Export Users
                </h2>
                <p
                  className="text-[11px] sm:text-xs text-[#64748B] mt-0.5"
                  style={{ fontWeight: 400 }}
                >
                  Choose a format and the columns to include. Your export covers the users shown on the list now, with any filters or search you have applied.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => setIsFullScreen((v) => !v)}
                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] border border-[#E2E8F0] bg-white text-xs text-[#475569] hover:bg-[#F8FAFC] hover:border-[#CBD5E1] transition-colors cursor-pointer"
                style={{ fontWeight: 500 }}
              >
                {isFullScreen ? (
                  <Minimize2 className="w-3.5 h-3.5" />
                ) : (
                  <Maximize2 className="w-3.5 h-3.5" />
                )}
                {isFullScreen ? "Exit Full" : "Full View"}
              </button>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-[8px] flex items-center justify-center text-[#94A3B8] hover:text-[#64748B] hover:bg-[#F1F5F9] transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* ─── Body ─── */}
        <div className="flex-1 min-h-0 bg-[#FAFBFC] overflow-hidden px-4 lg:px-6 py-4 lg:py-5 flex flex-col gap-4">
          {/* Full-width scope banner, one line, slate background. */}
          {scopeBanner && (
            <div
              className="shrink-0 rounded-[10px] border px-4 py-2.5 flex items-center gap-2.5 transition-colors hover:bg-[#ECF0F4] hover:border-[#D6DCE5]"
              style={{ backgroundColor: "#F1F5F9", borderColor: "#E2E8F0" }}
            >
              <Users className="w-[18px] h-[18px] shrink-0" style={{ color: "#64748B" }} />
              <div className="flex-1 min-w-0 text-[13px] leading-[20px] truncate text-left" style={{ color: "#1E293B" }}>
                <span style={{ fontWeight: 600 }}>{scopeBanner.count}</span>{" "}
                <span style={{ color: "#64748B", fontWeight: 400 }}>
                  ({scopeBanner.subtext})
                </span>
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
            {/* ─── LEFT: format cards ─── */}
            <div
              className="rounded-[12px] border bg-white flex flex-col overflow-hidden"
              style={{ borderColor: "#E2E8F0" }}
            >
              {/* Section header, info icon + title (Partner Details style) */}
              <div
                className="px-5 pt-3 pb-3 shrink-0 flex items-center gap-2"
                style={{ backgroundColor: "#F8FAFC" }}
              >
                <FileType className="w-4 h-4 shrink-0" style={{ color: "#64748B" }} />
                <h3 className="text-[14px]" style={{ color: "#0F172A", fontWeight: 600 }}>
                  File Format
                </h3>
              </div>
              {/* Full-width edge-to-edge divider */}
              <div className="border-t shrink-0" style={{ borderColor: "#E2E8F0" }} />
              <div className="flex-1 overflow-y-auto px-5 pb-3 pt-4" style={{ minHeight: 0 }}>
                <div className="space-y-3">
                  {FORMAT_CARDS.map((card) => (
                    <FormatCardRow
                      key={card.key}
                      card={card}
                      isSelected={format === card.key}
                      onSelect={() => setFormat(card.key)}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* ─── RIGHT: column picker ─── */}
            <div
              className="rounded-[12px] border bg-white flex flex-col overflow-hidden"
              style={{ borderColor: "#E2E8F0" }}
            >
              {/* Section header, info icon + title (Partner Details style) */}
              <div
                className="px-5 pt-3 pb-3 shrink-0 flex items-center gap-2"
                style={{ backgroundColor: "#F8FAFC" }}
              >
                <Columns3 className="w-4 h-4 shrink-0" style={{ color: "#64748B" }} />
                <h3 className="text-[14px]" style={{ color: "#0F172A", fontWeight: 600 }}>
                  Columns to Include
                </h3>
              </div>
              {/* Full-width edge-to-edge divider */}
              <div className="border-t shrink-0" style={{ borderColor: "#E2E8F0" }} />
              {/* Search */}
              <div className="px-5 pt-4 pb-2 shrink-0">
                <div
                  className="flex items-center gap-2 px-3 h-9 rounded-[8px] border bg-white"
                  style={{ borderColor: "#E2E8F0" }}
                >
                  <Search className="w-4 h-4 text-[#94A3B8]" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search columns"
                    className="flex-1 outline-none text-[13px] bg-transparent placeholder:text-[#94A3B8]"
                  />
                  {search && (
                    <button
                      onClick={() => setSearch("")}
                      className="p-0.5 rounded-full hover:bg-[#F1F5F9] text-[#94A3B8] hover:text-[#475569] transition-colors cursor-pointer"
                      aria-label="Clear search"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Select-all bar */}
              <div className="px-5 py-2 flex items-center gap-2 shrink-0">
                <Checkbox
                  checked={masterCheckboxState}
                  onCheckedChange={handleSelectAllToggle}
                  aria-label="Select All Columns"
                />
                <span className="text-[12px]" style={{ color: "#475569", fontWeight: 500 }}>
                  {masterCheckboxState === true
                    ? `All ${ALL_FIELDS.length} columns selected`
                    : checked.size > 0
                      ? `${checked.size} of ${ALL_FIELDS.length} columns selected`
                      : "Select All Columns"}
                </span>
              </div>

              {/* Inline "no columns selected" message, only shown when picker is fully empty */}
              {checked.size === 0 && !noResults && (
                <div
                  className="px-5 py-2 border-b shrink-0"
                  style={{
                    backgroundColor: "#FEF3C7",
                    borderColor: "#FDE68A",
                    color: "#92400E",
                  }}
                >
                  <span className="text-[12px]" style={{ fontWeight: 500 }}>
                    Pick at least one column to export.
                  </span>
                </div>
              )}

              {/* Scrollable column list */}
              <div
                ref={columnListScrollRef}
                className="flex-1 overflow-y-auto px-4 py-2 space-y-1.5"
                style={{
                  minHeight: 0,
                  scrollbarWidth: "thin",
                  scrollbarColor: "#CBD5E1 transparent",
                  overflowAnchor: "none",
                  ...drag.listDragStyle,
                }}
              >
                {noResults ? (
                  <div className="px-4 py-12 text-center text-[12.5px]" style={{ color: "#94A3B8" }}>
                    No Columns Match Your Search.
                  </div>
                ) : (
                  filteredFields.map((field, idx) =>
                    drag.draggedId === field.id ? (
                      <ColumnDropSlot
                        key={field.id}
                        id={field.id}
                        height={drag.dragCard?.height}
                        position={drag.draggedPosition}
                        total={drag.total}
                      />
                    ) : (
                      <FieldCard
                        key={field.id}
                        field={field}
                        checked={checked.has(field.id)}
                        dragActive={drag.draggedId !== null}
                        onCardPointerDown={drag.handleCardPointerDown}
                        onToggle={() => toggleField(field.id)}
                        searchQuery={search}
                        showQuickReorder={idx >= 6}
                        onMoveToTop={() => handleMoveToTop(field.id)}
                        onMoveToBottom={() => handleMoveToBottom(field.id)}
                        isRecentlyMoved={recentlyMovedFieldId === field.id}
                      />
                    )
                  )
                )}
              </div>
              <ColumnDragGhost
                ghostRef={drag.ghostRef}
                dragCard={drag.dragCard}
                position={drag.draggedPosition}
                total={drag.total}
              />
            </div>
          </div>
        </div>

        {/* ─── Footer ─── */}
        <div
          className="shrink-0 border-t border-[#EEF2F6] bg-white px-4 lg:px-5 py-2.5 sm:py-3 flex items-center gap-2 sm:gap-2.5"
          style={{ borderBottomLeftRadius: 16, borderBottomRightRadius: 16 }}
        >
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center px-3 sm:px-5 h-8 sm:h-9 rounded-[8px] border border-[#E2E8F0] bg-white text-xs sm:text-[13px] text-[#64748B] hover:text-[#0F172A] hover:border-[#CBD5E1] transition-colors cursor-pointer"
            style={{ fontWeight: 500 }}
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={checked.size === 0 || exporting || rows.length === 0}
            className="inline-flex items-center gap-1.5 px-3 sm:px-5 h-8 sm:h-9 rounded-[8px] text-white shadow-sm transition-colors cursor-pointer text-xs sm:text-[13px] disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ fontWeight: 600, backgroundColor: theme.button }}
          >
            {exporting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            {exportLabel}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
