/* Shared UI pieces for the Import / Export feature, ported from User Access
 * Control (ModalShell, density, Pagination, filter chips, confirm dialogs,
 * importer hover card). Colours use this repo's tokens where one exists
 * (primary #0A77FF, border #E2E8F0, muted #F1F5F9, foreground #0F172A) and
 * the UAC hex literals elsewhere. */

import * as React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import {
  AlignJustify,
  AlertTriangle,
  Check,
  CheckIcon,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  List,
  Mail,
  Phone,
  Search,
  Trash2,
  User,
  X,
} from "lucide-react";
import { cn } from "../components/ui/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "../components/ui/hover-card";
import type { Importer } from "./importHistory";

/* ───────────────────────── tokens ───────────────────────── */

export const PRIMARY = "rgb(var(--primary))";
export const BORDER = "rgb(var(--border))";
export const MUTED = "rgb(var(--muted))";
export const FOREGROUND = "rgb(var(--foreground))";
export const CELL_FONT = "Aptos, Inter, ui-sans-serif, system-ui, -apple-system";
export const SEARCH_HIGHLIGHT_CLASS = "bg-[#FEF3C7] text-[#B45309] rounded-sm px-0.5";
export const PANEL_SHADOW = "0 24px 48px -12px rgba(0,0,0,0.22), 0 0 0 1px rgba(0,0,0,0.05)";
export const MENU_SHADOW = "0_10px_30px_-10px_rgba(15,23,42,0.18)";

/* ───────────────────────── ModalShell ───────────────────────── */

interface ModalShellProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** z-index for backdrop; content sits at z + 1. */
  z?: number;
  backdropClose?: boolean;
}

/** Portal + dimmed blurred backdrop + spring-in content (UAC ModalShell). */
export function ModalShell({ open, onClose, children, z = 60, backdropClose = true }: ModalShellProps) {
  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed inset-0"
            style={{ zIndex: z, backgroundColor: "rgba(0,0,0,0.35)", backdropFilter: "blur(6px)" }}
            onClick={backdropClose ? onClose : undefined}
          />
          <motion.div
            key="modal-content"
            initial={{ opacity: 0, scale: 0.97, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 6 }}
            transition={{ type: "spring", duration: 0.28, bounce: 0 }}
            className="fixed inset-0 flex items-center justify-center"
            style={{ zIndex: z + 1, pointerEvents: "none", willChange: "transform, opacity" }}
          >
            <div style={{ pointerEvents: "auto" }} onClick={(e) => e.stopPropagation()}>
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/* ───────────────────────── tri-state checkbox ───────────────────────── */

type TriCheckboxProps = Omit<React.ComponentProps<typeof CheckboxPrimitive.Root>, "checked"> & {
  checked: boolean | "indeterminate";
};

/** The repo checkbox recipe with a dash for the indeterminate state (UAC). */
export function TriCheckbox({ className, checked, ...props }: TriCheckboxProps) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      checked={checked}
      className={cn(
        "peer border bg-input-background data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=checked]:border-primary data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground data-[state=indeterminate]:border-primary focus-visible:border-ring focus-visible:ring-ring/50 size-4 shrink-0 rounded-[4px] border transition-shadow outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center text-current transition-none">
        {checked === "indeterminate" ? (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="1.5" y="4.25" width="7" height="1.5" rx="0.75" fill="currentColor" />
          </svg>
        ) : (
          <CheckIcon className="size-3.5" />
        )}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

/* ───────────────────────── search highlight ───────────────────────── */

export function HighlightMatch({ text, query, className = SEARCH_HIGHLIGHT_CLASS }: { text: string; query: string; className?: string }) {
  const q = query.trim();
  if (!q || !text) return <>{text}</>;
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "ig"));
  if (parts.length === 1) return <>{text}</>;
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <mark key={i} className={className}>
            {part}
          </mark>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        ),
      )}
    </>
  );
}

/* ───────────────────────── search input ───────────────────────── */

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative flex-1 max-w-xs">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: "#CBD5E1" }} />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-9 pr-8 h-9 text-sm bg-white border border-border shadow-sm rounded-md placeholder:text-[#94A3B8] focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded flex items-center justify-center text-[#94A3B8] hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

/* ───────────────────────── density ───────────────────────── */

export type Density = "comfort" | "condensed";
export const ROW_HEIGHT_COMFORT = 52;
export const ROW_HEIGHT_CONDENSED = 36;
export const DensityContext = React.createContext<Density>("comfort");

const DENSITY_CONFIG: { key: Density; label: string; description: string; icon: React.ElementType }[] = [
  { key: "condensed", label: "Condensed", description: "Compact view", icon: AlignJustify },
  { key: "comfort", label: "Comfort", description: "Spacious view", icon: List },
];

export function DensityDropdown({ density, onChange }: { density: Density; onChange: (d: Density) => void }) {
  const current = DENSITY_CONFIG.find((d) => d.key === density) ?? DENSITY_CONFIG[1];
  const Icon = current.icon;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center justify-center h-9 gap-2 px-3 rounded-md border border-border bg-white text-foreground shadow-sm hover:bg-[#F8FAFC] transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary/30 shrink-0"
          aria-label="Row density"
        >
          <Icon className="w-[18px] h-[18px]" style={{ color: "#64748B" }} />
          <span className="hidden md:inline text-[13px]" style={{ fontWeight: 500 }}>
            {current.label}
          </span>
          <ChevronDown className="w-3.5 h-3.5" style={{ color: "#94A3B8" }} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6} className={`z-[200] w-[230px] p-1.5 bg-white border border-border rounded-lg shadow-[${MENU_SHADOW}]`}>
        {DENSITY_CONFIG.map((opt) => {
          const OptIcon = opt.icon;
          const selected = opt.key === density;
          return (
            <DropdownMenuItem
              key={opt.key}
              onClick={() => onChange(opt.key)}
              className="flex items-center gap-3 py-2.5 px-3 rounded-md cursor-pointer data-[highlighted]:bg-muted"
            >
              <OptIcon className="w-5 h-5" style={{ color: "#64748B" }} />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] text-foreground" style={{ fontWeight: 500 }}>
                  {opt.label}
                </div>
                <div className="text-[11.5px]" style={{ color: "#64748B" }}>
                  {opt.description}
                </div>
              </div>
              {selected && <Check className="w-4 h-4" style={{ color: "#0A77FF" }} />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ───────────────────────── filter chips ───────────────────────── */

export type ChipTone = "blue" | "red" | "amber" | "green";
export const CHIP_ACTIVE_TONES: Record<ChipTone, { border: string; bg: string; text: string; badgeBg: string; badgeText: string }> = {
  blue: { border: "#0A77FF", bg: "#EDF4FF", text: "#0A77FF", badgeBg: "rgba(10,119,255,0.1)", badgeText: "#0A77FF" },
  red: { border: "#FCA5A5", bg: "#FEF2F2", text: "#B91C1C", badgeBg: "rgba(220,38,38,0.10)", badgeText: "#B91C1C" },
  amber: { border: "#FCD34D", bg: "#FFFBEB", text: "#B45309", badgeBg: "rgba(180,83,9,0.12)", badgeText: "#B45309" },
  green: { border: "#86EFAC", bg: "#ECFDF5", text: "#047857", badgeBg: "rgba(4,120,87,0.12)", badgeText: "#047857" },
};

export function FilterChip({ label, count, tone, active, onClick }: { label: string; count?: number; tone: ChipTone; active: boolean; onClick: () => void }) {
  const t = CHIP_ACTIVE_TONES[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border whitespace-nowrap shrink-0 transition-colors cursor-pointer",
        !active && "border-border bg-white text-[#64748B] hover:bg-[#F8FAFC] hover:text-foreground hover:border-[#CBD5E1]",
      )}
      style={{ fontSize: "12px", fontWeight: active ? 500 : 400, ...(active ? { borderColor: t.border, backgroundColor: t.bg, color: t.text } : {}) }}
    >
      {label}
      {typeof count === "number" && (
        <span
          className={cn("inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full tabular-nums", !active && "bg-muted text-[#475569]")}
          style={{ fontSize: "10px", fontWeight: 600, ...(active ? { backgroundColor: t.badgeBg, color: t.badgeText } : {}) }}
        >
          {count}
        </span>
      )}
    </button>
  );
}

/* ───────────────────────── pagination ───────────────────────── */

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  recordsPerPage: number;
  onRecordsPerPageChange: (n: number) => void;
  pageSizeOptions?: number[];
  allowAll?: boolean;
}

function getPageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "...")[] = [1];
  if (current > 3) pages.push("...");
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) pages.push(p);
  if (current < total - 2) pages.push("...");
  pages.push(total);
  return pages;
}

const navBtn = "inline-flex items-center justify-center h-8 w-8 rounded-md text-[#475569] hover:bg-muted hover:text-foreground transition-colors disabled:opacity-40 disabled:pointer-events-none cursor-pointer";
const navTextBtn = "inline-flex items-center gap-1 h-8 px-2 rounded-md text-[#475569] hover:bg-muted hover:text-foreground transition-colors disabled:opacity-40 disabled:pointer-events-none cursor-pointer";

export function Pagination({ currentPage, totalPages, onPageChange, recordsPerPage, onRecordsPerPageChange, pageSizeOptions = [20, 50, 100], allowAll }: PaginationProps) {
  const isAll = !Number.isFinite(recordsPerPage);
  return (
    <div data-table-meta className="shrink-0 flex flex-col sm:flex-row items-center justify-center gap-3 px-4 py-2.5 border-t border-border bg-white">
      <div className="flex items-center gap-2" style={{ fontSize: "12.5px", color: "#64748B" }}>
        <span>Records per Page</span>
        <div className="relative">
          <select
            value={isAll ? "all" : String(recordsPerPage)}
            onChange={(e) => onRecordsPerPageChange(e.target.value === "all" ? Number.POSITIVE_INFINITY : Number(e.target.value))}
            className="h-8 pl-2.5 pr-7 rounded-md border border-border bg-white text-foreground cursor-pointer outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
            style={{ fontSize: "12.5px", fontWeight: 500, appearance: "none" }}
            aria-label="Records per page"
          >
            {pageSizeOptions.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
            {allowAll && <option value="all">All</option>}
          </select>
          <ChevronRight className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rotate-90 pointer-events-none" style={{ color: "#94A3B8" }} />
        </div>
      </div>
      <div className="flex items-center gap-0.5" style={{ fontSize: "12.5px" }}>
        <button type="button" className={navBtn} aria-label="First page" disabled={currentPage <= 1} onClick={() => onPageChange(1)}>
          <ChevronsLeft className="w-4 h-4" />
        </button>
        <button type="button" className={navTextBtn} disabled={currentPage <= 1} onClick={() => onPageChange(currentPage - 1)} style={{ fontSize: "12.5px", fontWeight: 500 }}>
          <ChevronLeft className="w-3.5 h-3.5" />
          Prev
        </button>
        {getPageNumbers(currentPage, totalPages).map((p, i) =>
          p === "..." ? (
            <span key={`e${i}`} className="px-1.5" style={{ color: "#94A3B8" }}>
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              className={cn(
                "inline-flex items-center justify-center h-8 min-w-8 px-2 rounded-md tabular-nums transition-colors cursor-pointer",
                p === currentPage ? "text-white" : "text-[#475569] hover:bg-muted hover:text-foreground",
              )}
              style={{ fontSize: "12.5px", fontWeight: 500, ...(p === currentPage ? { backgroundColor: "#0A77FF" } : {}) }}
              aria-current={p === currentPage ? "page" : undefined}
            >
              {p}
            </button>
          ),
        )}
        <button type="button" className={navTextBtn} disabled={currentPage >= totalPages} onClick={() => onPageChange(currentPage + 1)} style={{ fontSize: "12.5px", fontWeight: 500 }}>
          Next
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
        <button type="button" className={navBtn} aria-label="Last page" disabled={currentPage >= totalPages} onClick={() => onPageChange(totalPages)}>
          <ChevronsRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

/* ───────────────────────── confirm dialogs ───────────────────────── */

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  pill?: string;
  icon?: "warning" | "trash";
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  maxWidth?: number;
}

/** Red radial-header alert dialog shared by Discard / Delete confirms (z 300/301). */
export function ConfirmDialog({ open, title, message, pill, icon = "warning", confirmLabel, cancelLabel = "Keep Editing", onConfirm, onCancel, maxWidth = 420 }: ConfirmDialogProps) {
  const Icon = icon === "trash" ? Trash2 : AlertTriangle;
  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="confirm-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black/50 z-[300]"
            onClick={onCancel}
          />
          <div className="fixed inset-0 z-[301] flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              key="confirm-card"
              role="alertdialog"
              aria-modal="true"
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 12 }}
              transition={{ type: "spring", duration: 0.3, bounce: 0.15 }}
              className="bg-white rounded-2xl overflow-hidden pointer-events-auto w-[calc(100vw-2rem)] flex flex-col"
              style={{ maxWidth, boxShadow: PANEL_SHADOW }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="relative px-6 pt-8 pb-4 flex flex-col items-center"
                style={{ background: "radial-gradient(120% 100% at 50% 0%, #FEE2E2 0%, rgba(254,226,226,0.4) 40%, rgba(255,255,255,0) 75%)" }}
              >
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "rgba(254,202,202,0.45)" }}>
                  <Icon className="w-8 h-8" style={{ color: "#DC2626" }} strokeWidth={2} />
                </div>
                {pill && (
                  <span className="mt-4 inline-flex items-center px-3.5 py-1 rounded-full" style={{ backgroundColor: "#FEE2E2", color: "#B91C1C", fontSize: "11px", fontWeight: 700, letterSpacing: 1.2 }}>
                    {pill}
                  </span>
                )}
              </div>
              <div className="px-6 pb-2 text-center">
                <h2 className="text-foreground" style={{ fontSize: "20px", fontWeight: 700 }}>
                  {title}
                </h2>
                <p className="mt-2" style={{ fontSize: "13.5px", lineHeight: 1.55, color: "#64748B" }}>
                  {message}
                </p>
              </div>
              <div className="px-6 pt-4 pb-6 flex flex-col gap-2.5">
                <button
                  type="button"
                  autoFocus
                  onClick={onConfirm}
                  className="w-full h-11 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] active:bg-[#991B1B] text-white shadow-sm transition-colors cursor-pointer"
                  style={{ fontSize: "14px", fontWeight: 600 }}
                >
                  {confirmLabel}
                </button>
                <button
                  type="button"
                  onClick={onCancel}
                  className="w-full h-11 rounded-xl bg-muted hover:bg-border text-foreground transition-colors cursor-pointer"
                  style={{ fontSize: "14px", fontWeight: 600 }}
                >
                  {cancelLabel}
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/* ───────────────────────── importer cards ───────────────────────── */

export function ImporterOverviewCard({ importer }: { importer: Importer }) {
  return (
    <div className="overflow-hidden rounded-xl bg-white">
      <div className="relative px-4 py-4 flex items-center gap-3 overflow-hidden" style={{ backgroundColor: "#1B2637" }}>
        <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.04)" }} />
        {importer.photoUrl ? (
          <img src={importer.photoUrl} alt={importer.name} className="w-12 h-12 rounded-full object-cover shrink-0" />
        ) : (
          <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: importer.bg, color: importer.fg, fontSize: "15px", fontWeight: 600 }}>
            {importer.initials}
          </div>
        )}
        <div className="min-w-0">
          <div className="text-white truncate" style={{ fontSize: "15px", fontWeight: 600 }}>
            {importer.name}
          </div>
          <div className="mt-0.5" style={{ fontSize: "12.5px", color: "#94A3B8" }}>
            {importer.role}
          </div>
        </div>
      </div>
      <div className="px-4 py-3 flex flex-col gap-2.5">
        <div className="flex items-center gap-2" style={{ fontSize: "13px", color: "#334155" }}>
          <Mail className="w-4 h-4" style={{ color: "#94A3B8" }} />
          {importer.email}
        </div>
        <div className="flex items-center gap-2" style={{ fontSize: "13px", color: "#334155" }}>
          <Phone className="w-4 h-4" style={{ color: "#94A3B8" }} />
          {importer.phone}
        </div>
      </div>
    </div>
  );
}

export function ImporterHoverName({ importer, variant = "row" }: { importer: Importer; variant?: "row" | "chip" }) {
  return (
    <HoverCard openDelay={120} closeDelay={80}>
      <HoverCardTrigger asChild>
        {variant === "row" ? (
          <span className="inline-flex items-center gap-2 min-w-0 cursor-pointer">
            {importer.photoUrl ? (
              <img src={importer.photoUrl} alt={importer.name} className="w-7 h-7 rounded-full object-cover shrink-0" />
            ) : (
              <span className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: importer.bg, color: importer.fg, fontSize: "10.5px", fontWeight: 600 }} aria-label={importer.name}>
                {importer.initials}
              </span>
            )}
            <span className="text-[#334155] truncate hover:text-primary hover:underline underline-offset-2" style={{ fontSize: "14px", fontWeight: 500 }}>
              {importer.name}
            </span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border cursor-pointer transition-colors hover:bg-[#EEF2F6] shrink-0" style={{ borderColor: "#E2E8F0", backgroundColor: "#F8FAFC" }}>
            <User className="w-3 h-3" style={{ color: "#94A3B8" }} />
            <span style={{ fontSize: "11px", fontWeight: 500, color: "#475569" }}>{importer.name}</span>
          </span>
        )}
      </HoverCardTrigger>
      <HoverCardContent side="bottom" align="start" sideOffset={8} className="z-[200] w-[320px] p-0 rounded-xl border border-border shadow-[0_24px_48px_-12px_rgba(0,0,0,0.18)]">
        <ImporterOverviewCard importer={importer} />
      </HoverCardContent>
    </HoverCard>
  );
}

/* ───────────────────────── result chips ───────────────────────── */

export const RESULT_CHIP_TOKENS = {
  success: { bg: "#ECFDF5", text: "#065F46", border: "#D1FAE5" },
  failed: { bg: "#FEF2F2", text: "#991B1B", border: "#FEE2E2" },
};

export function ResultChip({ tone, children }: { tone: "success" | "failed"; children: React.ReactNode }) {
  const t = RESULT_CHIP_TOKENS[tone];
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full border whitespace-nowrap" style={{ backgroundColor: t.bg, color: t.text, borderColor: t.border, fontSize: "12px", fontWeight: 500 }}>
      {children}
    </span>
  );
}

export function pluralize(n: number, singular: string, plural = `${singular}s`): string {
  return n === 1 ? singular : plural;
}
