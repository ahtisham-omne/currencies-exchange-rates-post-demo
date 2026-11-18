/* The editors for the generic fields every import shares: Tags, and long text
 * (Description, Notes). One look everywhere, taken from the Categories cell
 * editors (which mirror radiant-core-fusion's CreateCategoryModal):
 *
 *   Tags         "Type a tag and press Enter" (comma also adds), 30-character
 *                cap with a live counter, removable chips with the tag icon,
 *                "n tags" + Done. Stored pipe-separated, as every template does.
 *   Long text    textarea with a plain character count, "Ctrl + Enter to save"
 *                + Done. A column may still pass a cap (then n / max), but
 *                descriptions never do: Omne does not cap descriptions.
 *
 * Both build a value up, so a click outside saves the draft; Esc discards it.
 * Every import surface routes its tags / description / notes columns here:
 * module imports through cell-editors/, Quotes and Sales Orders through
 * sheet-import/cells/CellEditor.tsx, Roles through RolesCellInput. */

import { useRef, useState } from "react";
import { Tag, X } from "lucide-react";
import type { CellNavDir, SpecialCellEditor } from "../modules/cell-editors/registry";
import { CellEditorPopover, FIELD_HINT_STYLE, PanelFooter, PanelHeader, tabDir, useFinalize } from "./CellEditorShell";

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
      placeholder={`- Add ${label.toLowerCase()} -`}
      width={400}
      onDismiss={() => commit(text)}
      onEscape={cancel}
    >
      <PanelHeader label={label} />
      <div className="px-3.5 pb-3">
        <div className="relative">
          <textarea
            autoFocus
            placeholder={placeholder ?? `Add ${label.toLowerCase()}`}
            value={text}
            onChange={(e) => {
              const v = e.target.value;
              /* When a cap is passed, typing stops at it, but a file value
                 already over the cap can still be shortened. */
              if (maxLength === undefined || v.length <= maxLength || v.length < text.length) setText(v);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); commit(text); }
              else if (e.key === "Tab") { e.preventDefault(); commit(text, tabDir(e)); }
            }}
            className="w-full bg-white border text-[#0F172A] placeholder:text-[#94A3B8] outline-none p-3 resize-none rounded-lg focus:border-[#0A77FF] focus:ring-1 focus:ring-[#0A77FF]/20"
            style={{ height: 100, fontSize: 14, borderColor: over ? "#FCA5A5" : "#E2E8F0" }}
          />
          <span className="block mt-1 text-right text-xs" style={{ color: over ? "#EF4444" : "#94A3B8" }}>
            {maxLength !== undefined ? `${text.length}/${maxLength}` : text.length}
          </span>
        </div>
      </div>
      <PanelFooter left="Ctrl + Enter to save" onDone={() => commit(text)} />
    </CellEditorPopover>
  );
}

/* Registry adapters for the module imports. */
export function tagsEditorFor(entityPlural: string): SpecialCellEditor {
  return function TagsCell(p) {
    return <TagsFieldEditor initialValue={p.initialValue} onCommit={p.onCommit} onCancel={p.onCancel} entityPlural={entityPlural} />;
  };
}

export function longTextEditorFor(opts: { label?: string; maxLength?: number; placeholder?: string } = {}): SpecialCellEditor {
  return function LongTextCell(p) {
    return (
      <LongTextFieldEditor
        initialValue={p.initialValue}
        onCommit={p.onCommit}
        onCancel={p.onCancel}
        label={opts.label ?? p.col.label}
        maxLength={opts.maxLength}
        placeholder={opts.placeholder}
      />
    );
  };
}
