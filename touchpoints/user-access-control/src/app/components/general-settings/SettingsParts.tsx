import { useState, type ComponentType, type CSSProperties, type ReactNode } from "react";
import { Info, Lock, Maximize2, Minimize2, Pencil, X } from "lucide-react";
import { ModalShell } from "../shared/ModalShell";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

/* ── The pieces General Settings is drawn from ─────────────────────────
 * Measured from the General Settings prototype (alert-settings-omne): the
 * read-only cards on the Company Profile tab, and the Edit dialogs' frame,
 * sections, locked fields and option cards. */

const ICON_TILE_BG = "#EDF4FF";
const BLUE = "#0A77FF";

export function InfoTip({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex cursor-default shrink-0" tabIndex={0} aria-label={text}>
          <Info className="w-3 h-3 text-slate-400" />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="z-[250] max-w-[260px] text-[12px] leading-[1.5]">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

/** A card on the Company Profile tab: icon tile, title, an optional Edit. */
export function SettingsCard({
  icon: Icon,
  title,
  onEdit,
  children,
}: {
  icon: ComponentType<{ className?: string; style?: CSSProperties }>;
  title: string;
  onEdit?: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="rounded-xl border overflow-hidden bg-white flex flex-col"
      style={{ borderColor: "#E2E8F0", boxShadow: "0 1px 3px 0 rgba(15,23,42,0.04), 0 1px 2px -1px rgba(15,23,42,0.04)" }}
    >
      <div className="flex items-center gap-2.5 px-5 py-3.5 shrink-0 bg-white hover:bg-[#FAFBFC] transition-colors" style={{ borderBottom: "1px solid #F1F5F9" }}>
        <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: ICON_TILE_BG }}>
          <Icon className="w-3.5 h-3.5" style={{ color: BLUE }} />
        </div>
        <h2 className="flex-1 min-w-0 text-[13px] truncate" style={{ fontWeight: 600, color: "#0F172A" }}>
          {title}
        </h2>
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg border bg-white text-[12px] shadow-sm transition-colors cursor-pointer hover:bg-[#F5F9FF]"
            style={{ borderColor: "rgba(10,119,255,0.2)", color: BLUE, fontWeight: 500 }}
          >
            <Pencil className="w-3.5 h-3.5" />
            Edit
          </button>
        )}
      </div>
      <div className="px-5 py-1 flex-1">{children}</div>
    </div>
  );
}

/** A read-only label and value. */
export function Field({ label, tip, children, wide }: { label: string; tip?: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className="min-w-0" style={wide ? { gridColumn: "1 / -1" } : undefined}>
      <div className="flex items-center gap-1 mb-1">
        <p className="truncate" style={{ fontSize: 12, fontWeight: 450, color: "#64748B", lineHeight: 1.3 }}>
          {label}
        </p>
        {tip && <InfoTip text={tip} />}
      </div>
      <div className="text-[13px] min-w-0 truncate" style={{ fontWeight: 500, color: "#1E293B" }}>
        {children}
      </div>
    </div>
  );
}

/** The Edit dialogs' frame: title and line, Full view and close, a scrolling
 *  grey body, Cancel and Save. */
export function SettingsModal({
  open,
  onClose,
  title,
  subtitle,
  onSave,
  saveDisabled,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  onSave: () => void;
  saveDisabled?: boolean;
  children: ReactNode;
}) {
  const [full, setFull] = useState(false);
  return (
    <ModalShell open={open} onClose={onClose}>
      <div
        role="dialog"
        aria-label={title}
        className="flex flex-col bg-white rounded-2xl overflow-hidden transition-[width,height] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
        style={{
          width: full ? "calc(100vw - 2rem)" : "min(70vw, 1080px)",
          maxWidth: "calc(100vw - 2rem)",
          height: full ? "calc(100vh - 2rem)" : undefined,
          maxHeight: full ? undefined : "90vh",
          boxShadow: "0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)",
        }}
      >
        <div className="px-5 pt-4 pb-3.5 shrink-0 bg-white border-b border-[#EEF2F6]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-[17px] text-[#0F172A]" style={{ fontWeight: 700 }}>
                {title}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5" style={{ fontWeight: 400 }}>
                {subtitle}
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setFull((v) => !v)}
                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#E2E8F0] bg-white text-xs text-slate-500 hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer"
                style={{ fontWeight: 500 }}
              >
                {full ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                {full ? "Exit full" : "Full view"}
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-500 hover:bg-slate-100 transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto bg-[#FAFBFC]">
          <div className="px-5 py-4 space-y-4">{children}</div>
        </div>
        <div className="shrink-0 border-t border-[#EEF2F6] bg-white px-5 py-3 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center h-9 min-w-[96px] px-4 rounded-lg border border-[#E2E8F0] bg-white text-[13px] text-slate-600 shadow-sm hover:bg-slate-50 hover:border-slate-300 transition-colors cursor-pointer"
            style={{ fontWeight: 500 }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saveDisabled}
            className="inline-flex items-center justify-center h-9 min-w-[96px] px-4 rounded-lg text-white shadow-sm transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-95"
            style={{ backgroundColor: BLUE, fontSize: 13, fontWeight: 500 }}
          >
            Save
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

/** A titled group of fields inside an Edit dialog. */
export function ModalSection({
  icon: Icon,
  title,
  children,
}: {
  icon: ComponentType<{ className?: string; style?: CSSProperties }>;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-[#E2E8F0] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <div className="px-4 py-2.5 border-b border-[#EEF2F6] flex items-center gap-2 bg-slate-50 rounded-t-lg">
        <Icon className="w-4 h-4 shrink-0" style={{ color: "#64748B" }} />
        <h3 className="text-[13px] text-[#0F172A]" style={{ fontWeight: 600 }}>
          {title}
        </h3>
      </div>
      <div className="px-4 py-4">{children}</div>
    </div>
  );
}

/** A field label in an Edit dialog, with a red star when required. */
export function FieldLabel({ children, required, tip, htmlFor }: { children: ReactNode; required?: boolean; tip?: string; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="flex items-center gap-1 text-[12px] text-[#0F172A]" style={{ fontWeight: 500 }}>
      <span>
        {children}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </span>
      {tip && <InfoTip text={tip} />}
    </label>
  );
}

/** A field that can't be changed here: its value, a lock, and why on hover. */
export function LockedField({ why, children, trailing }: { why: string; children: ReactNode; trailing?: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className="mt-1 w-full h-10 px-3 rounded-lg border border-[#E2E8F0] bg-slate-50 flex items-center justify-between gap-2 cursor-not-allowed select-none"
          aria-disabled="true"
          tabIndex={0}
        >
          <span className="min-w-0 text-sm text-[#0F172A] truncate">{children}</span>
          <span className="flex items-center gap-2 shrink-0">
            {trailing}
            <Lock className="w-3.5 h-3.5 text-slate-400" />
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="z-[250] max-w-[260px] text-[12px] leading-[1.5]">
        {why}
      </TooltipContent>
    </Tooltip>
  );
}

/** One-of option cards: a radio dot and a label, the chosen one tinted blue. */
export function OptionCards<T extends string>({ options, value, onChange }: { options: readonly T[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="grid gap-2 mt-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }} role="radiogroup">
      {options.map((o) => {
        const on = o === value;
        return (
          <button
            key={o}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o)}
            className={`flex items-center gap-2 px-2.5 h-10 rounded-lg border text-left transition-all cursor-pointer ${
              on ? "border-[#3B82F6] bg-[#F0F7FF] shadow-[0_0_0_2px_rgba(59,130,246,0.10)]" : "border-[#E2E8F0] bg-white hover:border-slate-300"
            }`}
          >
            <span className={`w-[16px] h-[16px] rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${on ? "border-[#3B82F6]" : "border-slate-300"}`}>
              {on && <span className="w-[7px] h-[7px] rounded-full bg-[#3B82F6]" />}
            </span>
            <span className="text-[13px] text-[#0F172A] whitespace-nowrap" style={{ fontWeight: 500 }}>
              {o}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** "UTC · UTC [UTC+00:00]": a time zone as the page shows it. */
export function TimezoneValue({ zone }: { zone: string }) {
  return (
    <span className="flex items-center gap-2 min-w-0">
      <span className="w-5 h-5 rounded-full bg-slate-100 border border-[#E2E8F0] shrink-0" />
      <span className="flex items-center gap-1.5 min-w-0">
        <span className="shrink-0">{zone}</span>
        <span aria-hidden="true" className="shrink-0 text-[#64748B] text-[1.25em] leading-none" style={{ fontWeight: 700 }}>·</span>
        <span className="truncate">{zone}</span>
      </span>
      <span
        className="shrink-0 inline-flex items-center justify-center px-1.5 h-[20px] min-w-[28px] rounded-md border text-[11px] tabular-nums"
        style={{ backgroundColor: "#F1F5F9", borderColor: "#E2E8F0", color: "#334155", fontWeight: 600 }}
      >
        UTC+00:00
      </span>
    </span>
  );
}
