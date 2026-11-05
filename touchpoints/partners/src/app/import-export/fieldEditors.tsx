/* Tags and Description cell editors for the Review and Fix Your Data grid,
 * copied from User Access Control's Data Imports (role-zen
 * src/app/components/data-imports/shared-cells/CellEditorShell.tsx +
 * CommonFieldEditors.tsx) so the two columns edit the same way in this module
 * and in Data Imports. Byte-identical in radiant-core-fusion, nimble-palette
 * and partner-management-module; edit role-zen first, then regenerate.
 *
 *   Tags         panel: "Type a tag and press Enter" (comma also adds), Entity
 *                Tag Chips (22px, 8px corner, #F8FAFC / #E2E8F0 / #1E293B),
 *                up to 8 tags, 30 characters each, duplicates refused,
 *                "n tags" + Done. Stored pipe-separated.
 *   Description  textarea with a live n / max counter, "Ctrl + Enter to save"
 *                + Done.
 *
 * Both build a value up, so a click outside saves the draft; Esc discards it. */

import { useCallback, useRef, useState, type ReactNode } from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { ChevronDown, Tag, X } from "lucide-react";

export type CellNavDir = "down" | "right" | "left";

export const PANEL_CLASS =
  "z-[320] bg-white border border-[#E2E8F0] rounded-xl shadow-[0_18px_44px_-12px_rgba(15,23,42,0.28)] outline-none";

/* Home module (radiant-core-fusion ConfigureCategory) field chrome. */
export const FIELD_LABEL_STYLE: React.CSSProperties = { fontSize: 12, fontWeight: 500, color: "#475569" };
export const FIELD_HINT_STYLE: React.CSSProperties = { fontSize: 11, color: "#94A3B8", lineHeight: 1.4 };

/** Finalize-once guard shared by every editor. */
export function useFinalize(onCommit: (next: string, dir?: CellNavDir) => void, onCancel: () => void) {
  const done = useRef(false);
  const commit = useCallback(
    (next: string, dir: CellNavDir = "down") => {
      if (done.current) return;
      done.current = true;
      onCommit(next, dir);
    },
    [onCommit],
  );
  const cancel = useCallback(() => {
    if (done.current) return;
    done.current = true;
    onCancel();
  }, [onCancel]);
  return { commit, cancel };
}

export function CellEditorPopover({
  display,
  placeholder = "- Select -",
  width,
  onDismiss,
  onEscape,
  onKeyDown,
  focusContent = false,
  children,
}: {
  /** What the cell shows while the panel is open; null shows the placeholder. */
  display: ReactNode | null;
  placeholder?: string;
  width: number;
  /** Click outside the panel. */
  onDismiss: () => void;
  onEscape: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  /** Focus the panel itself (lists driven by arrow keys) rather than its first control. */
  focusContent?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <PopoverPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) onDismiss();
      }}
    >
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          className="flex items-center justify-between gap-1.5 w-full h-full cursor-pointer text-left outline-none"
          style={{ padding: "0 10px 0 12px", fontSize: "13px" }}
        >
          <span className="flex-1 min-w-0 block overflow-hidden text-ellipsis whitespace-nowrap" style={{ color: display == null ? "#94A3B8" : "#1E293B" }}>
            {display ?? placeholder}
          </span>
          <ChevronDown className="w-3.5 h-3.5 shrink-0" style={{ color: "#94A3B8" }} />
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          data-cell-dropdown
          side="bottom"
          align="start"
          sideOffset={5}
          collisionPadding={12}
          tabIndex={-1}
          className={PANEL_CLASS}
          style={{ width }}
          onEscapeKeyDown={(e) => {
            e.preventDefault();
            onEscape();
            setOpen(false);
          }}
          onOpenAutoFocus={(e) => {
            if (!focusContent) return;
            e.preventDefault();
            (e.currentTarget as HTMLElement).focus();
          }}
          onKeyDown={onKeyDown}
        >
          {children}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

/** Panel heading: the home field label plus its hint line. */
export function PanelHeader({ label, hint }: { label: string; hint?: string }) {
  return (
    <div className="px-3.5 pt-3 pb-2">
      <div style={FIELD_LABEL_STYLE}>{label}</div>
      {hint && <div style={{ ...FIELD_HINT_STYLE, marginTop: 2 }}>{hint}</div>}
    </div>
  );
}

/** Informational note inside a panel (e.g. a column that only applies conditionally). */
export function PanelNote({ children }: { children: ReactNode }) {
  return (
    <div className="mx-3.5 mb-2 px-2.5 py-1.5 rounded-md border border-[#FDE68A] bg-[#FFFBEB]" style={{ fontSize: 11.5, color: "#92400E", lineHeight: 1.4 }}>
      {children}
    </div>
  );
}

export function PanelFooter({ left, onDone, doneLabel = "Done" }: { left?: ReactNode; onDone: () => void; doneLabel?: string }) {
  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-[#F1F5F9]">
      <span style={{ fontSize: 12, color: "#64748B" }}>{left}</span>
      <button
        type="button"
        onClick={onDone}
        className="h-7 px-3 rounded-lg bg-[#0A77FF] hover:bg-[#0866DD] text-white transition-colors cursor-pointer"
        style={{ fontSize: 12.5, fontWeight: 600 }}
      >
        {doneLabel}
      </button>
    </div>
  );
}

/** Tab / Shift+Tab direction for the grids' cell navigation. */
export function tabDir(e: React.KeyboardEvent): CellNavDir {
  return e.shiftKey ? "left" : "right";
}

export const TAG_MAX_LENGTH = 30;
/** Entity Tag Chip contract: 8 tags per record, 30 characters each. */
export const TAG_MAX_COUNT = 8;
export const TAG_SEPARATOR = "|";

export interface CommonEditorProps {
  initialValue: string;
  onCommit: (next: string, dir?: CellNavDir) => void;
  onCancel: () => void;
}

const splitTags = (v: string) => String(v ?? "").split(TAG_SEPARATOR).map((s) => s.trim()).filter(Boolean);
const normalizeTag = (raw: string) => raw.replace(/\s+/g, " ").trim().slice(0, TAG_MAX_LENGTH);

/** The Entity Tag Chip (omne-tags-component): #F8FAFC surface, 1px #E2E8F0
 *  border, #1E293B 12px / 500 text on a 16px line, 2px 8px padding, so it
 *  stands 22px; 8px corner. The remove x is 12px, slate-400, text colour on
 *  hover. A tag the file carried over 30 characters keeps the chip shape in
 *  the error tint until it is removed or retyped. */
export function EntityTagChip({ label, onRemove, tooLong = false }: { label: string; onRemove?: () => void; tooLong?: boolean }) {
  return (
    <span
      className="inline-flex items-center"
      title={tooLong ? `Longer than ${TAG_MAX_LENGTH} characters, it will be cut to fit` : label}
      style={{
        gap: 4,
        padding: "2px 8px",
        borderRadius: 8,
        background: tooLong ? "#FEF2F2" : "#F8FAFC",
        border: `1px solid ${tooLong ? "#FCA5A5" : "#E2E8F0"}`,
        color: tooLong ? "#B91C1C" : "#1E293B",
        fontSize: 12,
        fontWeight: 500,
        lineHeight: "16px",
        whiteSpace: "nowrap",
        maxWidth: "100%",
      }}
    >
      <span className="truncate max-w-[220px]">{label}</span>
      {onRemove && (
        <button
          type="button"
          aria-label={`Remove tag ${label}`}
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="flex items-center justify-center cursor-pointer text-[#94A3B8] hover:text-[#1E293B] transition-colors"
          style={{ width: 14, height: 14, marginRight: -2, background: "transparent", border: "none", padding: 0 }}
        >
          <X style={{ width: 12, height: 12 }} />
        </button>
      )}
    </span>
  );
}

export function TagsFieldEditor({
  initialValue,
  onCommit,
  onCancel,
  entityPlural = "records",
}: CommonEditorProps & {
  /** Finishes the hint line: "Tags help you organize and filter <entityPlural>." */
  entityPlural?: string;
}) {
  const { commit, cancel } = useFinalize(onCommit, onCancel);
  /* Tags from the file keep their spelling, even an over-long one, so the
     validator's message stays true until the tag is removed or retyped. */
  const [tags, setTags] = useState<string[]>(() => splitTags(initialValue));
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  /* Refusal line under the field (Entity Tag Chip "rejected input" state). */
  const [error, setError] = useState<string | null>(null);

  const addTag = (raw: string) => {
    const t = normalizeTag(raw);
    if (!t) return false;
    if (tags.some((p) => p.toLowerCase() === t.toLowerCase())) {
      setError(`"${t}" is already added.`);
      return true;
    }
    if (tags.length >= TAG_MAX_COUNT) {
      setError(`You can add up to ${TAG_MAX_COUNT} tags.`);
      setInput("");
      return true;
    }
    setTags((prev) => [...prev, t]);
    setInput("");
    setError(null);
    return true;
  };
  const value = (extra = input) => {
    const t = normalizeTag(extra);
    const fresh = t && !tags.some((p) => p.toLowerCase() === t.toLowerCase()) && tags.length < TAG_MAX_COUNT;
    return (fresh ? [...tags, t] : tags).join(TAG_SEPARATOR);
  };

  return (
    <CellEditorPopover
      display={tags.length ? tags.join(" | ") : null}
      placeholder="- Add tags -"
      width={360}
      onDismiss={() => commit(value())}
      onEscape={cancel}
    >
      <PanelHeader label="Tags" hint={`Tags help you organize and filter ${entityPlural}.`} />
      <div className="px-3.5 pb-3">
        <input
          ref={inputRef}
          autoFocus
          type="text"
          placeholder="Type a tag and press Enter"
          value={input}
          maxLength={TAG_MAX_LENGTH}
          onChange={(e) => {
            const v = e.target.value;
            /* A comma adds the tag, the same as Enter. */
            if (v.includes(",")) {
              v.split(",").slice(0, -1).forEach(addTag);
              setInput(v.split(",").pop()!.slice(0, TAG_MAX_LENGTH));
              return;
            }
            setInput(v.slice(0, TAG_MAX_LENGTH));
            if (error) setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (!addTag(input)) commit(value(""));
            } else if (e.key === "Tab") {
              e.preventDefault();
              commit(value(), tabDir(e));
            } else if (e.key === "Backspace" && !input && tags.length) {
              setTags((prev) => prev.slice(0, -1));
            }
          }}
          className="w-full bg-white border border-[#E2E8F0] text-[#0F172A] placeholder:text-[#94A3B8] outline-none px-3 rounded-lg focus:border-[#0A77FF] focus:ring-1 focus:ring-[#0A77FF]/20"
          style={{ height: 40, fontSize: 14 }}
        />
        {error && (
          <div className="mt-1" style={{ fontSize: 12, lineHeight: "16px", color: "#DC2626" }}>{error}</div>
        )}
        <div className="flex items-center justify-between mt-1">
          <span style={{ ...FIELD_HINT_STYLE }}>Press enter or comma to add tags. Up to {TAG_MAX_COUNT} tags, {TAG_MAX_LENGTH} characters each.</span>
          {input.length > 0 && (
            <span className="text-[11px] shrink-0 ml-2" style={{ color: input.length >= TAG_MAX_LENGTH ? "#EF4444" : "#94A3B8" }}>
              {input.length}/{TAG_MAX_LENGTH}
            </span>
          )}
        </div>
        {tags.length > 0 && (
          /* Entity Tag Chip strip: one leading tag icon, then the chips. */
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            <Tag aria-hidden style={{ width: 14, height: 14, color: "#94A3B8", flexShrink: 0 }} />
            {tags.map((tag) => (
              <EntityTagChip
                key={tag}
                label={tag}
                tooLong={tag.length > TAG_MAX_LENGTH}
                onRemove={() => {
                  setTags((prev) => prev.filter((t) => t !== tag));
                  setError(null);
                  inputRef.current?.focus();
                }}
              />
            ))}
          </div>
        )}
      </div>
      <PanelFooter left={`${tags.length} ${tags.length === 1 ? "tag" : "tags"}`} onDone={() => commit(value())} />
    </CellEditorPopover>
  );
}

export function LongTextFieldEditor({
  initialValue,
  onCommit,
  onCancel,
  label,
  maxLength,
  placeholder,
}: CommonEditorProps & {
  label: string;
  /** The column's character cap; omitted when the module sets none. */
  maxLength?: number;
  placeholder?: string;
}) {
  const { commit, cancel } = useFinalize(onCommit, onCancel);
  const [text, setText] = useState(initialValue);
  const over = maxLength !== undefined && text.length > maxLength;
  return (
    <CellEditorPopover
      display={initialValue.trim() || null}
      placeholder={`- Add ${label} -`}
      width={400}
      onDismiss={() => commit(text)}
      onEscape={cancel}
    >
      <PanelHeader label={label} />
      <div className="px-3.5 pb-3">
        <div className="relative">
          <textarea
            autoFocus
            placeholder={placeholder ?? `Add ${label}`}
            value={text}
            onChange={(e) => {
              const v = e.target.value;
              /* Capped like the home form, but a file value already over the
                 cap can still be shortened. */
              if (maxLength === undefined || v.length <= maxLength || v.length < text.length) setText(v);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); commit(text); }
              else if (e.key === "Tab") { e.preventDefault(); commit(text, tabDir(e)); }
            }}
            className="w-full bg-white border text-[#0F172A] placeholder:text-[#94A3B8] outline-none p-3 resize-none rounded-lg focus:border-[#0A77FF] focus:ring-1 focus:ring-[#0A77FF]/20"
            style={{ height: 100, fontSize: 14, borderColor: over ? "#FCA5A5" : "#E2E8F0" }}
          />
          <span className="absolute bottom-2 right-3 text-xs" style={{ color: over ? "#EF4444" : "#94A3B8" }}>
            {maxLength !== undefined ? `${text.length}/${maxLength}` : text.length}
          </span>
        </div>
      </div>
      <PanelFooter left="Ctrl + Enter to save" onDone={() => commit(text)} />
    </CellEditorPopover>
  );
}
