/* Pieces of the Review and Fix Your Data modal that the Import Record page
 * also reuses: result pills, issue tooltips, the edited-cell triangle, the
 * cell editors (text / number / yes-no / single-select / multi-select), the
 * Import Complete dialog, the correction banner, the importing overlay and
 * the empty states. Ported from User Access Control, generic over the spec. */

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleX,
  CornerDownRight,
  Link2,
  Loader2,
  Search,
  SearchX,
  Upload,
  X,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "../components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../components/ui/dropdown-menu";
import type { EntitySpec, ImportColumn } from "./spec";
import { splitList, joinList, canonicalOption } from "./spec";
import type { CellIssue, RowStatus } from "./validation";
import type { CorrectionDetection, RowFilter } from "./importHistory";
import { CELL_FONT, MENU_SHADOW, PANEL_SHADOW, TriCheckbox } from "./ui";
import { LongTextFieldEditor } from "./fieldEditors";

/* ───────────────────────── option lists ───────────────────────── */

/** Display names for reference columns (`optionsFrom`), supplied by the host page. */
export type ReferenceOptions = Partial<Record<"groups" | "partners" | "contacts", string[]>>;

export const YES_NO_OPTIONS = ["Yes", "No"];

export function optionsForColumn(col: ImportColumn, ref: ReferenceOptions): string[] {
  if (col.kind === "yesno") return YES_NO_OPTIONS;
  if (col.optionsFrom) return ref[col.optionsFrom] ?? [];
  return col.options ?? [];
}

function sectionLabelFor(col: ImportColumn): string {
  if (col.optionsFrom === "groups") return "Partner Groups";
  if (col.optionsFrom === "partners") return "Partners";
  if (col.optionsFrom === "contacts") return "Contacts";
  return col.label;
}

/* ───────────────────────── result pills ───────────────────────── */

export const ROW_STATUS_TOKENS: Record<RowStatus, { bg: string; text: string; border: string; label: string }> = {
  ready: { bg: "#ECFDF5", text: "#065F46", border: "#D1FAE5", label: "Ready" },
  warning: { bg: "#FFFBEB", text: "#92400E", border: "#FEF3C7", label: "Warning" },
  error: { bg: "#FEF2F2", text: "#991B1B", border: "#FEE2E2", label: "Error" },
};

export function StatusChip({ status }: { status: RowStatus }) {
  const t = ROW_STATUS_TOKENS[status];
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full border whitespace-nowrap" style={{ backgroundColor: t.bg, color: t.text, borderColor: t.border, fontSize: "11px", fontWeight: 600 }} aria-label={t.label}>
      {t.label}
    </span>
  );
}

export function RowOpBadge({ spec }: { spec: EntitySpec<unknown> }) {
  return (
    <span
      className="inline-flex items-center justify-center h-[18px] px-1.5 rounded-full whitespace-nowrap"
      style={{ fontSize: "10px", fontWeight: 600, backgroundColor: "rgba(10,119,255,0.1)", color: "#0A77FF" }}
      title={`${spec.columns.find((c) => c.key === spec.keyColumn)?.label ?? "Name"} matches an existing ${spec.nounLower}. This row will update that ${spec.nounLower}.`}
    >
      Update
    </span>
  );
}

/* ───────────────────────── tooltips ───────────────────────── */

const TOOLTIP_ARROW = <TooltipPrimitive.Arrow width={10} height={5} style={{ fill: "white", stroke: "#E2E8F0", strokeWidth: 1 }} />;

const cellTriggerStyle: React.CSSProperties = {
  height: "100%",
  width: "calc(100% + 24px)",
  marginLeft: -12,
  marginRight: -12,
  paddingLeft: 12,
  paddingRight: 12,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "pre",
};

export function CellIssueTooltip({ issues, children }: { issues: CellIssue[]; children: React.ReactNode }) {
  return (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>
        <span className="flex items-center cursor-help" style={cellTriggerStyle}>
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={8} collisionPadding={12} className="z-[200] max-w-[320px] bg-white border border-border rounded-lg p-0 text-foreground" style={{ boxShadow: "0 4px 12px rgba(0,0,0,0.10)" }}>
        {issues.map((issue, i) => {
          const isError = issue.severity === "error";
          return (
            <div key={`${issue.code}-${i}`} className={`p-3 flex flex-col gap-2 ${i > 0 ? "border-t border-border" : ""}`}>
              <span
                className="inline-flex items-center self-start px-2 py-0.5 rounded-full border whitespace-nowrap"
                style={{ fontSize: "11px", fontWeight: 600, backgroundColor: isError ? "#FEF2F2" : "#FFFBEB", color: isError ? "#DC2626" : "#B45309", borderColor: isError ? "#FECACA" : "#FDE68A" }}
              >
                {isError ? "Error" : "Warning"}
              </span>
              <p className="text-[#1E293B]" style={{ fontSize: "13px", fontWeight: 400, lineHeight: 1.5 }}>
                {issue.explanation || issue.message}
              </p>
              {(issue.example || (issue.options && issue.options.length > 0)) && (
                <div className="rounded-md border border-border bg-[#F8FAFC] px-2 py-2 flex flex-col gap-1">
                  <span className="text-[#94A3B8]" style={{ fontSize: "11px", fontWeight: 500, letterSpacing: "0.04em" }}>
                    {issue.options && issue.options.length > 0 ? "Options" : "Example"}
                  </span>
                  {issue.options && issue.options.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {issue.options.map((o) => (
                        <span key={o} className="inline-flex items-center px-1.5 py-0.5 rounded border border-border bg-white text-[#475569]" style={{ fontSize: "11px", fontWeight: 500 }}>
                          {o}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-[#334155] break-words" style={{ fontSize: "13px", fontWeight: 500, fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace", lineHeight: 1.4 }}>
                      {issue.example}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {TOOLTIP_ARROW}
      </TooltipContent>
    </Tooltip>
  );
}

export function UpdateCellTooltip({ spec, children }: { spec: EntitySpec<unknown>; children: React.ReactNode }) {
  const keyLabel = spec.columns.find((c) => c.key === spec.keyColumn)?.label ?? "name";
  return (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>
        <span className="flex items-center cursor-help" style={cellTriggerStyle}>
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={8} collisionPadding={12} className="z-[200] max-w-[320px] bg-white border border-border rounded-lg p-0 text-foreground" style={{ boxShadow: "0 4px 12px rgba(0,0,0,0.10)" }}>
        <div className="p-3 flex flex-col gap-2">
          <span className="inline-flex items-center self-start px-2 py-0.5 rounded-full border whitespace-nowrap" style={{ fontSize: "11px", fontWeight: 600, backgroundColor: "#EFF6FF", color: "#0A77FF", borderColor: "#BFDBFE" }}>
            Update
          </span>
          <p className="text-[#1E293B]" style={{ fontSize: "13px", lineHeight: 1.5 }}>
            This row updates an existing {spec.nounLower}, matched by {keyLabel}. This value will replace the {spec.nounLower}'s current value on import.
          </p>
        </div>
        {TOOLTIP_ARROW}
      </TooltipContent>
    </Tooltip>
  );
}

export function EditedIndicator({ originalValue }: { originalValue: string }) {
  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <span className="absolute top-0 left-0 cursor-help" style={{ width: 0, height: 0, borderTop: "6px solid #0A77FF", borderRight: "6px solid transparent", zIndex: 2 }} aria-label="Edited cell" />
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6} className="z-[200] max-w-[260px] bg-white border border-[#BFDBFE] text-foreground px-3 py-2 rounded-lg shadow-lg">
        <span style={{ fontSize: "12.5px", fontWeight: 500, lineHeight: 1.4 }}>
          Edited, original value: {originalValue ? `"${originalValue}"` : <em className="text-[#94A3B8] not-italic">empty</em>}
        </span>
        <TooltipPrimitive.Arrow width={10} height={5} style={{ fill: "white", stroke: "#BFDBFE", strokeWidth: 1 }} />
      </TooltipContent>
    </Tooltip>
  );
}

/* ───────────────────────── cell editors ───────────────────────── */

export type CommitDir = "down" | "right" | "left";

interface CellInputProps {
  column: ImportColumn;
  value: string;
  onCommit: (next: string, dir?: CommitDir) => void;
  onCancel: () => void;
  referenceOptions: ReferenceOptions;
}

const PANEL_CLASS = "z-[320] bg-white border border-border rounded-xl shadow-[0_18px_44px_-12px_rgba(15,23,42,0.28)] outline-none";

function CellTrigger({ label, placeholder }: { label: string; placeholder: string }) {
  return (
    <PopoverPrimitive.Trigger asChild>
      <button type="button" className="flex items-center justify-between gap-1.5 w-full h-full cursor-pointer text-left outline-none" style={{ padding: "0 10px 0 12px", fontFamily: CELL_FONT, fontSize: "13px" }}>
        <span className="block overflow-hidden text--ellipsis whitespace-nowrap" style={{ color: label ? "#1E293B" : "#94A3B8", textOverflow: "ellipsis" }}>
          {label || placeholder}
        </span>
        <ChevronDown className="w-3.5 h-3.5 shrink-0" style={{ color: "#94A3B8" }} />
      </button>
    </PopoverPrimitive.Trigger>
  );
}

/** Single-select popover list (Status and other enums). Outside click cancels. */
function SimpleCellDropdown({ value, options, onCommit, onCancel }: { value: string; options: string[]; onCommit: (v: string, dir?: CommitDir) => void; onCancel: () => void }) {
  const [open, setOpen] = useState(true);
  const [query, setQuery] = useState("");
  const current = canonicalOption(value, options) ?? "";
  const searchable = options.length > 8;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.toLowerCase().includes(q)) : options;
  }, [options, query]);
  return (
    <PopoverPrimitive.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) onCancel();
      }}
    >
      <CellTrigger label={current} placeholder="- Select -" />
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          data-cell-dropdown
          side="bottom"
          align="start"
          sideOffset={5}
          collisionPadding={12}
          className={`${PANEL_CLASS} min-w-[180px] max-w-[320px] p-1.5`}
          onOpenAutoFocus={(e) => {
            if (!searchable) e.preventDefault();
          }}
          onEscapeKeyDown={onCancel}
        >
          {searchable && (
            <div className="p-0.5 pb-1.5">
              <div className="flex items-center gap-2 h-8 px-2.5 rounded-lg border border-border bg-[#F8FAFC] focus-within:border-primary focus-within:bg-white transition-colors">
                <Search className="w-3.5 h-3.5" style={{ color: "#94A3B8" }} />
                <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" className="flex-1 min-w-0 bg-transparent outline-none" style={{ fontSize: "13px", color: "#1E293B" }} />
              </div>
            </div>
          )}
          <div className="max-h-[248px] overflow-y-auto">
            {filtered.length === 0 && (
              <div className="px-3 py-6 text-center" style={{ fontSize: "12.5px", color: "#94A3B8" }}>
                No options match “{query}”
              </div>
            )}
            {filtered.map((opt) => {
              const selected = opt === current;
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => onCommit(opt, "down")}
                  className={`flex items-center justify-between gap-3 w-full text-left px-3 py-2 rounded-lg transition-colors cursor-pointer hover:bg-[#F8FAFC] ${selected ? "bg-muted" : ""}`}
                  style={{ fontSize: "13px", color: "#0F172A", fontFamily: CELL_FONT }}
                >
                  <span className="truncate">{opt}</span>
                  {selected && <Check className="w-4 h-4 shrink-0" style={{ color: "#0A77FF" }} />}
                </button>
              );
            })}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

/** Multi-select popover 288px: search, section heading, checkbox rows, "{n} selected" + Done. Outside click commits. */
function MultiCellDropdown({ column, value, options, onCommit, onCancel }: { column: ImportColumn; value: string; options: string[]; onCommit: (v: string, dir?: CommitDir) => void; onCancel: () => void }) {
  const [open, setOpen] = useState(true);
  const [query, setQuery] = useState("");
  const initial = useMemo(() => splitList(value).map((v) => canonicalOption(v, options) ?? v), [value, options]);
  const [selected, setSelected] = useState<string[]>(initial);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const committedRef = useRef(false);
  const commit = (dir?: CommitDir) => {
    if (committedRef.current) return;
    committedRef.current = true;
    onCommit(joinList(selectedRef.current), dir);
  };
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q ? options.filter((o) => o.toLowerCase().includes(q)) : options;
    return [...base].sort((a, b) => a.localeCompare(b));
  }, [options, query]);
  const unknown = selected.filter((s) => !options.some((o) => o === s));
  const toggle = (name: string) => setSelected((prev) => (prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name]));
  const sectionLabel = sectionLabelFor(column);
  return (
    <PopoverPrimitive.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) commit();
      }}
    >
      <CellTrigger label={selected.join(" · ")} placeholder={`- Select ${column.label} -`} />
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          data-cell-dropdown
          side="bottom"
          align="start"
          sideOffset={5}
          collisionPadding={12}
          className={`${PANEL_CLASS} w-[288px] flex flex-col`}
          onEscapeKeyDown={(e) => {
            e.preventDefault();
            committedRef.current = true;
            onCancel();
          }}
        >
          <div className="p-2 border-b border-[#F1F5F9]">
            <div className="flex items-center gap-2 h-8 px-2.5 rounded-lg border border-border bg-[#F8FAFC] focus-within:border-primary focus-within:bg-white transition-colors">
              <Search className="w-3.5 h-3.5" style={{ color: "#94A3B8" }} />
              <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${sectionLabel}`} className="flex-1 min-w-0 bg-transparent outline-none" style={{ fontSize: "13px", color: "#1E293B" }} />
              {query && (
                <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="cursor-pointer">
                  <X className="w-3.5 h-3.5" style={{ color: "#94A3B8" }} />
                </button>
              )}
            </div>
          </div>
          <div className="max-h-[248px] overflow-y-auto py-1.5">
            {filtered.length === 0 && unknown.length === 0 ? (
              <div className="px-3 py-6 text-center" style={{ fontSize: "12.5px", color: "#94A3B8" }}>
                No {sectionLabel} match “{query}”
              </div>
            ) : (
              <>
                {filtered.length > 0 && (
                  <div className="px-1.5 pb-1">
                    <div className="px-2 pt-2 pb-1 tracking-wide" style={{ fontSize: "10.5px", fontWeight: 700, color: "#94A3B8", letterSpacing: "0.04em" }}>
                      {sectionLabel}
                    </div>
                    {filtered.map((name) => (
                      <OptionRow key={name} name={name} checked={selected.includes(name)} onToggle={() => toggle(name)} />
                    ))}
                  </div>
                )}
                {unknown.length > 0 && !query && (
                  <div className="px-1.5 pb-1">
                    <div className="px-2 pt-2 pb-1 tracking-wide" style={{ fontSize: "10.5px", fontWeight: 700, color: "#94A3B8", letterSpacing: "0.04em" }}>
                      Not in Omne
                    </div>
                    {unknown.map((name) => (
                      <OptionRow key={name} name={name} checked onToggle={() => toggle(name)} />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-[#F1F5F9]">
            <span style={{ fontSize: "12px", color: "#64748B" }}>{selected.length} selected</span>
            <button type="button" onClick={() => commit("down")} className="h-7 px-3 rounded-lg bg-primary hover:bg-[#0866DD] text-white transition-colors cursor-pointer" style={{ fontSize: "12.5px", fontWeight: 600 }}>
              Done
            </button>
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

function OptionRow({ name, checked, onToggle }: { name: string; checked: boolean; onToggle: () => void }) {
  return (
    <div className="group flex items-center gap-1 w-full min-h-9 px-2 py-1.5 rounded-lg transition-colors hover:bg-[#F8FAFC]">
      <button type="button" onClick={onToggle} className="flex items-center gap-2.5 flex-1 min-w-0 text-left cursor-pointer">
        <TriCheckbox checked={checked} aria-label={name} tabIndex={-1} className="pointer-events-none" />
        <span className="truncate" style={{ fontFamily: CELL_FONT, fontSize: "13px", fontWeight: 450, color: "#0F172A" }}>
          {name}
        </span>
      </button>
    </div>
  );
}

/** Editor dispatch by column kind. Text editors: Enter down, Tab right, Shift+Tab left, Esc cancel, blur commit. */
export function CellInput({ column, value, onCommit, onCancel, referenceOptions }: CellInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const finalizedRef = useRef(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const finish = (fn: () => void) => {
    if (finalizedRef.current) return;
    finalizedRef.current = true;
    fn();
  };

  /* Description edits on the Data Imports long-text panel (fieldEditors.tsx). */
  if (column.key === "description") {
    return <LongTextFieldEditor initialValue={value} onCommit={onCommit} onCancel={onCancel} label={column.label} maxLength={column.maxLength} />;
  }
  if (column.kind === "multiselect") {
    return <MultiCellDropdown column={column} value={value} options={optionsForColumn(column, referenceOptions)} onCommit={onCommit} onCancel={onCancel} />;
  }
  if (column.kind === "select" || column.kind === "yesno") {
    return <SimpleCellDropdown value={value} options={optionsForColumn(column, referenceOptions)} onCommit={onCommit} onCancel={onCancel} />;
  }

  const placeholder = column.kind === "date" ? "YYYY-MM-DD" : column.kind === "number" ? "0" : undefined;
  return (
    <input
      ref={inputRef}
      type="text"
      inputMode={column.kind === "number" ? "decimal" : undefined}
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          finish(() => onCommit(draft, "down"));
        } else if (e.key === "Tab") {
          e.preventDefault();
          finish(() => onCommit(draft, e.shiftKey ? "left" : "right"));
        } else if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          finish(onCancel);
        }
      }}
      onBlur={() => finish(() => onCommit(draft))}
      style={{ width: "100%", height: "100%", border: "none", outline: "none", background: "transparent", fontFamily: CELL_FONT, fontSize: "13px", color: "#1E293B", padding: "0 12px" }}
    />
  );
}

/* ───────────────────────── bulk set dropdown ───────────────────────── */

export function BulkSetDropdown({ label, options, onPick }: { label: string; options: string[]; onPick: (v: string) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-[#BFDBFE] bg-white text-primary hover:bg-[#EFF6FF] transition-colors cursor-pointer" style={{ fontSize: "12.5px", fontWeight: 500 }}>
          {label}
          <ChevronDown className="w-3 h-3" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6} className={`min-w-[160px] z-[200] bg-white border border-border rounded-lg py-1 shadow-[${MENU_SHADOW}]`}>
        {options.map((o) => (
          <DropdownMenuItem key={o} onClick={() => onPick(o)} className="px-3 py-1.5 cursor-pointer text-foreground data-[highlighted]:bg-muted" style={{ fontSize: "13px" }}>
            {o}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ───────────────────────── start import button ───────────────────────── */

export function StartImportButton({ errorCount, running, onStart, label = "Start Import" }: { errorCount: number; running: boolean; onStart: () => void; label?: string }) {
  const disabled = errorCount > 0 || running;
  const button = (
    <button
      type="button"
      onClick={onStart}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-md shadow-sm transition-colors ${disabled ? "bg-primary/40 text-white cursor-not-allowed" : "bg-primary hover:bg-[#0066D6] active:bg-[#005BBF] text-white cursor-pointer"}`}
      style={{ fontSize: "13px", fontWeight: 600 }}
    >
      {running && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
      {running ? "Importing..." : label}
    </button>
  );
  if (errorCount > 0 && !running) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0} className="inline-block cursor-not-allowed">
            <span style={{ pointerEvents: "none" }} className="inline-block">
              {button}
            </span>
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={6} className="z-[200] max-w-[260px] bg-white border border-[#FCA5A5] text-[#991B1B] px-3 py-2 rounded-lg shadow-lg">
          <span className="flex items-start gap-1.5">
            <CircleX className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: "#EF4444" }} />
            <span style={{ fontSize: "12.5px", fontWeight: 500, lineHeight: 1.4 }}>
              Fix all errors before importing. {errorCount} {errorCount === 1 ? "error" : "errors"} remaining.
            </span>
          </span>
        </TooltipContent>
      </Tooltip>
    );
  }
  return button;
}

/* ───────────────────────── importing overlay ───────────────────────── */

export function ImportingOverlay({ spec, processed, total, z = 30, bg = "bg-white/50" }: { spec: EntitySpec<unknown>; processed: number; total: number; z?: number; bg?: string }) {
  return (
    <motion.div
      key="import-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className={`absolute inset-0 flex items-center justify-center ${bg} backdrop-blur-[1px] pointer-events-auto`}
      style={{ zIndex: z }}
    >
      <div className="flex flex-col items-center gap-3 px-6 py-5 rounded-2xl bg-white border border-border" style={{ boxShadow: "0 24px 48px -12px rgba(15,23,42,0.18)" }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#0A77FF" }} />
        <p className="text-foreground" style={{ fontSize: "14px", fontWeight: 600 }}>
          Importing {total} {total === 1 ? spec.nounLower : spec.nounPluralLower}...
        </p>
        <p className="text-[#64748B] tabular-nums" style={{ fontSize: "12.5px" }}>
          Importing... {processed} of {total} {spec.nounPluralLower} processed
        </p>
      </div>
    </motion.div>
  );
}

/* ───────────────────────── import complete dialog ───────────────────────── */

interface ImportCompleteDialogProps {
  spec: EntitySpec<unknown>;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  warningCount: number;
  onViewDetail: (filter: RowFilter) => void;
  onGoToListing: () => void;
  onViewHistory: () => void;
  historyLabel?: string;
}

function SummaryCard({ label, count, onClick }: { label: string; count: number; onClick?: () => void }) {
  const clickable = count > 0 && !!onClick;
  const inner = (
    <>
      <div className="flex flex-col gap-1.5">
        <span className="text-[#64748B]" style={{ fontSize: "12.5px", fontWeight: 500 }}>
          {label}
        </span>
        <span className="text-foreground tabular-nums" style={{ fontSize: "22px", fontWeight: 600, lineHeight: 1 }}>
          {count}
        </span>
      </div>
      {clickable && <ChevronRight className="w-4 h-4 shrink-0 self-start mt-0.5" style={{ color: "#94A3B8" }} />}
    </>
  );
  const base = "rounded-xl border border-border bg-white px-4 py-3 flex items-start justify-between gap-2";
  if (clickable) {
    return (
      <button type="button" onClick={onClick} className={`${base} text-left transition-all cursor-pointer hover:shadow-md hover:border-primary/30`} aria-label={`${label}: ${count}. View on import detail page.`}>
        {inner}
      </button>
    );
  }
  return <div className={base}>{inner}</div>;
}

export function ImportCompleteDialog({ spec, createdCount, updatedCount, skippedCount, warningCount, onViewDetail, onGoToListing, onViewHistory, historyLabel = "View Import History" }: ImportCompleteDialogProps) {
  return createPortal(
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} className="fixed inset-0 bg-black/50 z-[300]" />
      <div className="fixed inset-0 z-[301] flex items-center justify-center p-4 pointer-events-none">
        <motion.div
          role="dialog"
          aria-labelledby="import-complete-title"
          initial={{ opacity: 0, scale: 0.94, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 16 }}
          transition={{ type: "spring", duration: 0.35, bounce: 0.15 }}
          className="bg-white rounded-2xl overflow-hidden pointer-events-auto w-[calc(100vw-2rem)] max-w-[460px] flex flex-col"
          style={{ boxShadow: PANEL_SHADOW }}
        >
          <div className="relative px-6 pt-8 pb-4 flex flex-col items-center" style={{ background: "radial-gradient(120% 100% at 50% 0%, #D1FAE5 0%, rgba(209,250,229,0.4) 40%, rgba(255,255,255,0) 75%)" }}>
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "rgba(167,243,208,0.45)" }}>
              <CheckCircle2 className="w-9 h-9" style={{ color: "#059669" }} strokeWidth={2} />
            </div>
            <h2 id="import-complete-title" className="text-foreground mt-4" style={{ fontSize: "20px", fontWeight: 700 }}>
              Import Complete
            </h2>
          </div>
          <div className="px-6 pb-5 grid grid-cols-2 gap-3">
            <SummaryCard label={`${spec.entity} Created`} count={createdCount} onClick={() => onViewDetail("imported")} />
            <SummaryCard label={`${spec.entity} Updated`} count={updatedCount} onClick={() => onViewDetail("imported")} />
            <SummaryCard label="Rows Skipped" count={skippedCount} onClick={() => onViewDetail("failed")} />
            <SummaryCard label="Warnings" count={warningCount} onClick={() => onViewDetail("imported")} />
          </div>
          <div className="px-6 pt-2 pb-6 flex flex-col gap-2.5">
            <button type="button" autoFocus onClick={onGoToListing} className="w-full h-11 rounded-xl bg-[#10B981] hover:bg-[#059669] active:bg-[#047857] text-white shadow-sm transition-colors cursor-pointer" style={{ fontSize: "14px", fontWeight: 600 }}>
              View {spec.entity} Listing
            </button>
            <button type="button" onClick={onViewHistory} className="w-full h-11 rounded-xl bg-muted hover:bg-border text-foreground transition-colors cursor-pointer" style={{ fontSize: "14px", fontWeight: 600 }}>
              {historyLabel}
            </button>
          </div>
        </motion.div>
      </div>
    </>,
    document.body,
  );
}

/* ───────────────────────── correction banner ───────────────────────── */

const BANNER_TONES = {
  info: { bg: "#EFF6FF", border: "#BFDBFE", text: "#1E3A8A" },
  neutral: { bg: "#F8FAFC", border: "#E2E8F0", text: "#334155" },
};

function BannerButton({ tone, onClick, children }: { tone: "info" | "neutral"; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-md border bg-white shadow-sm transition-colors cursor-pointer ${tone === "info" ? "border-[#BFDBFE] text-primary hover:bg-[#EFF6FF]" : "border-[#CBD5E1] text-[#334155] hover:bg-muted"}`}
      style={{ fontSize: "12.5px", fontWeight: 500 }}
    >
      {children}
    </button>
  );
}

function BucketPill({ tone, children }: { tone: "info" | "muted"; children: React.ReactNode }) {
  const s = tone === "info" ? { backgroundColor: "#DBEAFE", color: "#1E40AF", borderColor: "#BFDBFE" } : { backgroundColor: "#F1F5F9", color: "#475569", borderColor: "#E2E8F0" };
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full border whitespace-nowrap" style={{ fontSize: "11.5px", fontWeight: 500, ...s }}>
      {children}
    </span>
  );
}

interface CorrectionBannerProps {
  detection: CorrectionDetection;
  linked: boolean;
  onToggleLink: (linked: boolean) => void;
  counts: { matched: number; resolved: number; new: number };
  onRemoveAlreadyImported: () => void;
}

export function CorrectionBanner({ detection, linked, onToggleLink, counts, onRemoveAlreadyImported }: CorrectionBannerProps) {
  if (detection.kind === "none") return null;
  const parent = detection.parent;
  const tone = linked ? BANNER_TONES.info : BANNER_TONES.neutral;
  return (
    <div className="shrink-0 flex items-start gap-2.5 px-4 lg:px-6 py-2.5 border-b" style={{ backgroundColor: tone.bg, borderBottomColor: tone.border }}>
      <span className="shrink-0 mt-0.5">
        <CornerDownRight className="w-4 h-4" style={{ color: linked ? "#0A77FF" : "#64748B" }} />
      </span>
      <div className="min-w-0 flex-1" style={{ fontSize: "12.5px", lineHeight: 1.5, color: tone.text }}>
        {linked ? (
          <>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-foreground" style={{ fontWeight: 600 }}>
                Correcting {parent.fileName}
              </span>
              <span style={{ color: "#64748B" }}>({detection.confidence === "session" ? "you opened this from that import" : "matched on the rows themselves"})</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              <BucketPill tone="info">{counts.matched} Matched</BucketPill>
              {counts.resolved > 0 && <BucketPill tone="muted">{counts.resolved} Already Imported</BucketPill>}
              {counts.new > 0 && <BucketPill tone="muted">{counts.new} New</BucketPill>}
              {counts.resolved > 0 && (
                <button type="button" onClick={onRemoveAlreadyImported} className="underline underline-offset-2 text-primary hover:text-[#0066D6] cursor-pointer ml-0.5" style={{ fontSize: "12px", fontWeight: 500 }}>
                  Remove the {counts.resolved === 1 ? "Row" : `${counts.resolved} Rows`} Already Imported
                </button>
              )}
            </div>
          </>
        ) : detection.confidence === "suggested" ? (
          <>
            <b>These rows look like corrections of {parent.fileName}.</b> Link them and the rows you fixed will close out on that import instead of importing as a separate one.
          </>
        ) : (
          <>
            <b>Importing on its own.</b> This file came from {parent.fileName}, but it will be recorded as a separate import.
          </>
        )}
      </div>
      <div className="shrink-0">
        {linked ? (
          <BannerButton tone="info" onClick={() => onToggleLink(false)}>
            Import Separately
          </BannerButton>
        ) : (
          <BannerButton tone="neutral" onClick={() => onToggleLink(true)}>
            <Link2 className="w-3.5 h-3.5" />
            Link to It
          </BannerButton>
        )}
      </div>
    </div>
  );
}

/* ───────────────────────── empty states ───────────────────────── */

type EmptyKind = "removed" | "search" | "errors" | "warnings" | "ready" | "fallback";

export function GridEmptyState({ kind, onCancelImport, onClearSearch }: { kind: EmptyKind; onCancelImport?: () => void; onClearSearch?: () => void }) {
  const btn = "h-9 px-4 rounded-md border border-border bg-white text-[#334155] hover:bg-[#F8FAFC] hover:border-[#CBD5E1] transition-colors cursor-pointer";
  const spec: Record<EmptyKind, { tile: string; icon: React.ReactNode; title: string; sub?: string }> = {
    removed: { tile: "#F1F5F9", icon: <Upload className="w-7 h-7" style={{ color: "#64748B" }} />, title: "All rows have been removed.", sub: "There is nothing left to import." },
    search: { tile: "#F1F5F9", icon: <SearchX className="w-7 h-7" style={{ color: "#64748B" }} />, title: "No rows match your search." },
    errors: { tile: "#D1FAE5", icon: <CheckCircle2 className="w-7 h-7" style={{ color: "#059669" }} />, title: "No errors.", sub: "Every row is ready to import." },
    warnings: { tile: "#D1FAE5", icon: <CheckCircle2 className="w-7 h-7" style={{ color: "#059669" }} />, title: "No warnings.", sub: "Every row looks good." },
    ready: { tile: "#FEF3C7", icon: <AlertTriangle className="w-7 h-7" style={{ color: "#B45309" }} />, title: "No rows are ready yet.", sub: "Fix the errors to get your rows ready." },
    fallback: { tile: "#F1F5F9", icon: <SearchX className="w-7 h-7" style={{ color: "#64748B" }} />, title: "No rows to display." },
  };
  const s = spec[kind];
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      <div className="w-14 h-14 rounded-2xl mb-3 flex items-center justify-center" style={{ backgroundColor: s.tile }}>
        {s.icon}
      </div>
      <div className="text-[#334155]" style={{ fontSize: "14px", fontWeight: 600 }}>
        {s.title}
      </div>
      {s.sub && (
        <div className="text-[#64748B] mt-1" style={{ fontSize: "13px" }}>
          {s.sub}
        </div>
      )}
      {kind === "removed" && onCancelImport && (
        <button type="button" onClick={onCancelImport} className={`${btn} mt-4`} style={{ fontSize: "13px", fontWeight: 500 }}>
          Cancel Import
        </button>
      )}
      {kind === "search" && onClearSearch && (
        <button type="button" onClick={onClearSearch} className={`${btn} mt-3`} style={{ fontSize: "13px", fontWeight: 500 }}>
          Clear Search
        </button>
      )}
    </div>
  );
}

/* ───────────────────────── cell visual tokens ───────────────────────── */

export const CELL_SEVERITY_STYLE = {
  error: { bg: "#FEF2F2", shadow: "inset 0 0 0 1px #FECACA" },
  warning: { bg: "#FFFBEB", shadow: "inset 0 0 0 1px #FDE68A" },
  update: { bg: "#EFF6FF", shadow: "inset 0 0 0 1px #BFDBFE" },
  editing: { bg: "#FFFFFF", shadow: "inset 0 0 0 2px #0A77FF, inset 0 0 0 3px rgba(10,119,255,0.15)" },
  active: { shadow: "inset 0 0 0 2px #0A77FF" },
};

export { AnimatePresence };
