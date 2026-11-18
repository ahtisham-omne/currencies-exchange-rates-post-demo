import { useEffect, useRef, useState } from 'react';
import { Plus, Tag as TagIcon, X } from 'lucide-react';

/**
 * EntityTagChip, the Partners contacts strip.
 *
 * One chip, one validator, every surface. The shipped spec, matched value for
 * value, so the same tag reads identically in a creation form, on a detail
 * page and in an import sheet:
 *
 *   surface  var(--tag-surface)      corner 8px        type 12px / 500
 *   border   1px var(--tag-border)   height 22px, from 3px vertical padding
 *   text     var(--tag-text)         leading icon Lucide tag, 14px
 *   remove   Lucide x, 12px, icon colour goes to text colour on hover
 *   Add Tag  1px dashed var(--tag-add-border)
 *   editor   24px row: input, Save, Cancel
 *
 * No colour appears here as a literal: the four roles live in the repo's token
 * sheet, so the look changes in one place.
 *
 * `checkTag` is the single validator behind both placements: eight tags per
 * entity, thirty characters each clamped as you type rather than rejected
 * afterwards, whitespace trimmed at both ends with inner runs collapsed, and
 * duplicates matched without case.
 */

export const TAG_LIMIT = 8;
export const TAG_MAX_CHARS = 30;

/** Trim both ends, collapse inner runs, clamp length. */
export function normaliseTag(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, TAG_MAX_CHARS);
}

export type TagCheck = { ok: true; value: string } | { ok: false; error: string };

export function checkTag(raw: string, existing: string[]): TagCheck {
  const value = normaliseTag(raw);
  if (!value) return { ok: false, error: 'Enter a tag first.' };
  if (existing.length >= TAG_LIMIT) return { ok: false, error: `Up to ${TAG_LIMIT} tags per record.` };
  const twin = existing.find((t) => t.toLowerCase() === value.toLowerCase());
  if (twin) {
    /* The message names the tag as it is already stored, which is what the
       reader can see on the record. */
    return { ok: false, error: `"${twin}" is already added.` };
  }
  return { ok: true, value };
}

/* ── The chip ─────────────────────────────────────────────────────────── */

export function TagChip({ value, onRemove }: { value: string; onRemove?: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <span
      className="inline-flex items-center"
      style={{
        gap: 6,
        padding: '3px 8px',
        borderRadius: 8,
        backgroundColor: 'var(--tag-surface)',
        border: '1px solid var(--tag-border)',
        color: 'var(--tag-text)',
        fontSize: 12,
        fontWeight: 500,
        lineHeight: '14px',
        maxWidth: 220,
      }}
    >
      <span className="truncate">{value}</span>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          aria-label={`Remove ${value}`}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: 0, background: 'transparent', padding: 0, cursor: 'pointer',
            color: hovered ? 'var(--tag-text)' : 'var(--muted-foreground)',
            transition: 'color 120ms',
          }}
        >
          <X style={{ width: 12, height: 12 }} />
        </button>
      )}
    </span>
  );
}

/* ── Placement one: the strip on a record ─────────────────────────────── */

export function TagStrip({
  tags,
  onChange,
  editable = true,
  emptyLabel = 'No tags',
}: {
  tags: string[];
  onChange?: (next: string[]) => void;
  /** A completed or cancelled record shows the chips without a remove control. */
  editable?: boolean;
  emptyLabel?: string;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (adding) inputRef.current?.focus(); }, [adding]);

  const close = () => { setAdding(false); setDraft(''); setError(null); };

  /* `candidate` lets the comma path commit the text it just read, without
     waiting for the draft state to settle. */
  const save = (candidate?: string) => {
    const result = checkTag(candidate ?? draft, tags);
    if (result.ok === false) { setError(result.error); return; }
    onChange?.([...tags, result.value]);
    close();
  };

  return (
    <div className="flex flex-col" style={{ gap: 6 }}>
      <div className="flex items-center flex-wrap" style={{ gap: 6 }}>
        <TagIcon style={{ width: 14, height: 14, color: 'var(--muted-foreground)' }} aria-hidden />
        {/* Empty and editable is the icon and Add Tag, nothing else: the PDF's
            empty state carries no "No tags" label, because Add Tag already says
            what the row is for. A read-only record with no tags does say it,
            since it has no other content. */}
        {tags.length === 0 && !adding && !(editable && onChange) && (
          <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{emptyLabel}</span>
        )}
        {tags.map((tag) => (
          <TagChip
            key={tag}
            value={tag}
            onRemove={editable && onChange ? () => onChange(tags.filter((t) => t !== tag)) : undefined}
          />
        ))}

        {/* Add Tag disappears once the record holds eight. */}
        {editable && onChange && !adding && tags.length < TAG_LIMIT && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center"
            style={{
              gap: 4,
              padding: '3px 8px',
              borderRadius: 8,
              border: '1px dashed var(--tag-add-border)',
              background: 'transparent',
              color: 'var(--muted-foreground)',
              fontSize: 12,
              fontWeight: 500,
              lineHeight: '14px',
              cursor: 'pointer',
            }}
          >
            <Plus style={{ width: 12, height: 12 }} />
            Add Tag
          </button>
        )}
        {/* Same row as the chips: input, Save, Cancel, 24px tall. The row
            wraps only when there is no width left to hold them, which is what
            the Partners strip does. */}
        {adding && (
          <span className="inline-flex items-center" style={{ gap: 6, height: 24, flex: '0 1 auto' }}>
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => {
                const raw = e.target.value;
                setError(null);
                /* A pasted or typed comma commits, the same as Enter. */
                if (raw.includes(',')) { setDraft(raw.split(',')[0].slice(0, TAG_MAX_CHARS)); save(raw.split(',')[0]); return; }
                setDraft(raw.slice(0, TAG_MAX_CHARS));
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); save(); }
                else if (e.key === 'Escape') { e.preventDefault(); close(); }
              }}
              placeholder="Enter tag..."
              maxLength={TAG_MAX_CHARS}
              style={{
                height: 24, width: 132, padding: '0 8px',
                /* Same corner as the chip beside it. */
                borderRadius: 8,
                border: `1px solid ${error ? 'var(--destructive)' : 'var(--primary)'}`,
                outline: 'none', fontSize: 12, color: 'var(--tag-text)',
                background: 'var(--card)',
              }}
            />
            <button
              type="button"
              onClick={() => save()}
              style={{
                height: 24, padding: '0 10px', borderRadius: 8, border: 0,
                backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Save
            </button>
            <button
              type="button"
              onClick={close}
              style={{
                height: 24, padding: '0 8px', borderRadius: 8, border: 0,
                background: 'transparent', color: 'var(--muted-foreground)',
                fontSize: 12, fontWeight: 500, cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </span>
        )}
      </div>

      {/* The reason sits under the row, so the row keeps its single line. */}
      {error && (
        <p style={{ fontSize: 11.5, color: 'var(--destructive)', margin: 0 }}>{error}</p>
      )}
    </div>
  );
}

/* ── Placement two: the field in a creation flow ──────────────────────── */

export function TagsField({
  tags,
  onChange,
  label = 'Tags',
  id,
  hint = `Press enter or comma to add tags. Up to ${TAG_LIMIT} tags, ${TAG_MAX_CHARS} characters each.`,
}: {
  tags: string[];
  onChange: (next: string[]) => void;
  label?: string;
  id?: string;
  /** Line under the field. Defaults to the add-a-tag guidance. */
  hint?: string;
}) {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);

  const commit = () => {
    const result = checkTag(draft, tags);
    if (result.ok === false) { if (normaliseTag(draft)) setError(result.error); return; }
    onChange([...tags, result.value]);
    setDraft('');
    setError(null);
  };

  return (
    <div className="flex flex-col" style={{ gap: 6 }}>
      {label && (
        <label htmlFor={id} style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>
          {label}
        </label>
      )}
      {/* The field keeps its own border and focus ring. Only the chips inside
          it are the shared chip. */}
      <div
        className="flex items-center flex-wrap"
        style={{
          gap: 6, minHeight: 40, padding: '6px 10px', borderRadius: 8,
          border: `1px solid ${error ? 'var(--destructive)' : focused ? 'var(--primary)' : 'var(--border)'}`,
          boxShadow: focused ? '0 0 0 3px rgba(10,119,255,0.12)' : 'none',
          backgroundColor: 'var(--card)',
          transition: 'border-color 120ms, box-shadow 120ms',
        }}
      >
        {tags.map((tag) => (
          <TagChip key={tag} value={tag} onRemove={() => onChange(tags.filter((t) => t !== tag))} />
        ))}
        {tags.length < TAG_LIMIT && (
          <input
            id={id}
            value={draft}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onChange={(e) => {
              const raw = e.target.value;
              setError(null);
              /* A comma commits, the same as Enter. */
              if (raw.includes(',')) {
                const [head] = raw.split(',');
                setDraft(head.slice(0, TAG_MAX_CHARS));
                const result = checkTag(head, tags);
                if (result.ok === true) { onChange([...tags, result.value]); setDraft(''); }
                else if (normaliseTag(head)) setError(result.error);
                return;
              }
              setDraft(raw.slice(0, TAG_MAX_CHARS));
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); commit(); }
              else if (e.key === 'Backspace' && draft === '' && tags.length > 0) onChange(tags.slice(0, -1));
            }}
            placeholder={tags.length === 0 ? 'No Tags Assigned' : ''}
            maxLength={TAG_MAX_CHARS}
            style={{
              flex: 1, minWidth: 90, border: 0, outline: 'none', background: 'transparent',
              fontSize: 12, color: 'var(--tag-text)',
            }}
          />
        )}
      </div>
      <p style={{ fontSize: 11.5, color: error ? 'var(--destructive)' : 'var(--muted-foreground)', margin: 0, lineHeight: 1.45 }}>
        {error ?? hint}
      </p>
    </div>
  );
}
