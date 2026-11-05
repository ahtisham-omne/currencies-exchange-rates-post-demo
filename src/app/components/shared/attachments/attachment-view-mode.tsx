/**
 * Attachment view modes — the Condensed / Comfort / Card selector, and the
 * list row the first two modes render.
 *
 * The same control had been written twice already: once in the record's own
 * Attachments tab, and again as `FilePaneModeDropdown` in the Purchase Order
 * module. Both drew the same three options with the same Card Size
 * sub-control, and the two had drifted apart. This module is where it lives
 * now, so the next surface takes it rather than writing a third.
 *
 * Used in:
 *   - Line-Item Configurator, Attachments tab
 *
 * NOT yet used by the record's own Attachments tab: that file still carries
 * its own `ViewToggle` / `FileListRow`, coupled to `LinkedDocument` and to
 * the folder tree's convert actions. The two can drift until it is moved
 * across, so a change here should be checked against it.
 *
 * The list row deliberately takes its actions as a plain
 * `AttachmentCardMenuItem[]`, the same array `AttachmentCard` takes, so a
 * surface can hand the same actions to either view without rebuilding them.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, MoreVertical } from "lucide-react";
import { getFileThumbnail, fileExtLabel, type FileType } from "./attachment-config";
/* Type-only: the row takes the same action array `AttachmentCard` does, but
   importing it as a type keeps this module free of the card at runtime. */
import type { AttachmentCardMenuItem } from "./attachment-card";

/* ── Modes ──────────────────────────────────────────────────────────────── */

export type AttachmentViewMode = "condensed" | "comfort" | "card";
export type AttachmentCardSize = "small" | "medium" | "large";

export const ATTACHMENT_VIEW_OPTIONS: {
  key: AttachmentViewMode;
  label: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    key: "condensed",
    label: "Condensed",
    description: "Compact list view",
    icon: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
        <rect x="1" y="3" width="14" height="1.5" rx="0.5" />
        <rect x="1" y="7.25" width="14" height="1.5" rx="0.5" />
        <rect x="1" y="11.5" width="14" height="1.5" rx="0.5" />
      </svg>
    ),
  },
  {
    key: "comfort",
    label: "Comfort",
    description: "Spacious list view",
    icon: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
        <rect x="1" y="2" width="14" height="2.5" rx="0.5" />
        <rect x="1" y="6.75" width="14" height="2.5" rx="0.5" />
        <rect x="1" y="11.5" width="14" height="2.5" rx="0.5" />
      </svg>
    ),
  },
  {
    key: "card",
    label: "Card",
    description: "Sized card grid",
    icon: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
        <rect x="1" y="1" width="6" height="6" rx="1" />
        <rect x="9" y="1" width="6" height="6" rx="1" />
        <rect x="1" y="9" width="6" height="6" rx="1" />
        <rect x="9" y="9" width="6" height="6" rx="1" />
      </svg>
    ),
  },
];

/* Column and thumbnail sizes are the Purchase Order module's, verbatim,
   so Large means the same thing in every attachments surface. Both maps
   are keyed the same way, so a size change is one edit in one place. */
export const ATTACHMENT_CARD_COLUMNS: Record<AttachmentCardSize, string> = {
  large: "repeat(auto-fill, minmax(360px, 1fr))",
  medium: "repeat(auto-fill, minmax(240px, 1fr))",
  small: "repeat(auto-fill, minmax(170px, 1fr))",
};

export const ATTACHMENT_CARD_THUMB: Record<AttachmentCardSize, string> = {
  large: "clamp(140px, 16vw, 220px)",
  medium: "clamp(100px, 12vw, 160px)",
  small: "clamp(80px, 9vw, 120px)",
};

/* ── Selector ───────────────────────────────────────────────────────────── */

/**
 * The mode selector. `size` matches the height of whatever toolbar it lands
 * in: "sm" (28px) beside the record tab's own compact controls, "md" (36px)
 * beside the configurator's h-9 search and Upload button. Choosing Card
 * keeps the menu open so the Card Size row underneath is reachable without
 * a second trip.
 */
export function AttachmentViewToggle({
  value,
  onChange,
  cardSize,
  onCardSizeChange,
  size = "sm",
}: {
  value: AttachmentViewMode;
  onChange: (v: AttachmentViewMode) => void;
  cardSize: AttachmentCardSize;
  onCardSizeChange: (s: AttachmentCardSize) => void;
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const current = ATTACHMENT_VIEW_OPTIONS.find((o) => o.key === value)!;
  const md = size === "md";

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center transition-colors hover:bg-[var(--primary-50)]"
        style={{
          height: md ? 36 : 28,
          padding: md ? "0 10px" : "0 8px",
          borderRadius: md ? "var(--radius)" : "var(--radius-sm)",
          border: "1px solid var(--border)",
          background: open ? "var(--primary-50)" : "var(--card)",
          gap: 6,
          fontWeight: 500,
          fontSize: md ? 13 : "var(--text-caption)",
          color: "var(--text-secondary)",
          cursor: "pointer",
        }}
      >
        <span style={{ display: "flex", color: "var(--text-secondary)" }}>{current.icon}</span>
        {current.label}
        <ChevronDown
          size={11}
          style={{
            color: "var(--text-tertiary)",
            transition: "transform 0.15s",
            transform: open ? "rotate(180deg)" : "none",
          }}
        />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute z-50"
          style={{
            top: "calc(100% + 4px)",
            right: 0,
            width: 240,
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border)",
            background: "var(--card)",
            boxShadow: "0 8px 24px rgba(16,24,40,0.10), 0 2px 6px rgba(16,24,40,0.06)",
            padding: 6,
          }}
        >
          {ATTACHMENT_VIEW_OPTIONS.map((opt) => {
            const isActive = opt.key === value;
            return (
              <button
                key={opt.key}
                type="button"
                role="menuitemradio"
                aria-checked={isActive}
                onClick={() => {
                  onChange(opt.key);
                  /* Card keeps the menu open: its size row appears below and
                     would otherwise need a second open. */
                  if (opt.key !== "card") setOpen(false);
                }}
                className="flex items-center w-full transition-colors hover:bg-[var(--primary-50)]"
                style={{
                  padding: "8px 10px",
                  borderRadius: "var(--radius-sm)",
                  border: 0,
                  background: "transparent",
                  textAlign: "left",
                  gap: 10,
                  cursor: "pointer",
                }}
              >
                <span style={{ color: "var(--text-secondary)", display: "flex", flexShrink: 0 }}>
                  {opt.icon}
                </span>
                <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
                  <span style={{ fontWeight: 600, fontSize: 13, color: "var(--foreground)", lineHeight: 1.2 }}>
                    {opt.label}
                  </span>
                  <span style={{ fontWeight: 400, fontSize: 11, color: "var(--text-tertiary)", lineHeight: 1.2 }}>
                    {opt.description}
                  </span>
                </div>
                {isActive && <Check size={14} style={{ color: "var(--primary)", flexShrink: 0 }} />}
              </button>
            );
          })}
          {value === "card" && (
            <>
              <div style={{ borderTop: "1px solid var(--border)", margin: "6px 4px" }} />
              <div style={{ padding: "4px 8px" }}>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: "var(--text-tertiary)",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    marginBottom: 6,
                  }}
                >
                  Card Size
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  {(["large", "medium", "small"] as const).map((s) => {
                    const active = cardSize === s;
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => onCardSizeChange(s)}
                        style={{
                          flex: 1,
                          padding: "6px 0",
                          borderRadius: "var(--radius-sm)",
                          fontSize: 11,
                          fontWeight: active ? 600 : 500,
                          border: `1px solid ${active ? "var(--primary)" : "var(--border)"}`,
                          background: active ? "var(--primary-50)" : "var(--card)",
                          color: active ? "var(--primary)" : "var(--foreground)",
                          cursor: "pointer",
                          textTransform: "capitalize",
                        }}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Row parts ──────────────────────────────────────────────────────────── */

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Format a stored date into the "25 Feb 2026" form the listings use.
 * Accepts MM/DD, MM/DD/YYYY, YYYY-MM-DD, or anything already formatted, and
 * returns the input untouched when it cannot parse it, so an unexpected
 * shape shows the stored value rather than "Invalid Date".
 */
export function formatAttachmentDateShort(raw: string): string {
  if (!raw) return "";
  const s = raw.trim();
  const slash = s.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?:[, ]+(.+))?$/);
  if (slash) {
    const mm = parseInt(slash[1], 10);
    const dd = parseInt(slash[2], 10);
    const yyyy = slash[3]
      ? slash[3].length === 2
        ? 2000 + parseInt(slash[3], 10)
        : parseInt(slash[3], 10)
      : new Date().getFullYear();
    const time = slash[4] ? `, ${slash[4].toLowerCase()}` : "";
    if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
      return `${String(dd).padStart(2, "0")} ${MONTH_ABBR[mm - 1]} ${yyyy}${time}`;
    }
  }
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    const yyyy = parseInt(iso[1], 10);
    const mm = parseInt(iso[2], 10);
    const dd = parseInt(iso[3], 10);
    if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
      return `${String(dd).padStart(2, "0")} ${MONTH_ABBR[mm - 1]} ${yyyy}`;
    }
  }
  return s;
}

const AVATAR_PALETTE = [
  { bg: "#FEE2E2", fg: "#B91C1C" },
  { bg: "#DCFCE7", fg: "#15803D" },
  { bg: "#DBEAFE", fg: "#1D4ED8" },
  { bg: "#FEF3C7", fg: "#A16207" },
  { bg: "#EDE9FE", fg: "#6D28D9" },
  { bg: "#CFFAFE", fg: "#0E7490" },
  { bg: "#FCE7F3", fg: "#BE185D" },
];

/** Initial-circle avatar for the Uploaded By cell. */
export function AttachmentUploaderAvatar({ name, size = 20 }: { name: string; size?: number }) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  const pal = AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
  const parts = name.trim().split(/\s+/);
  const initials = ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
  return (
    <span
      className="inline-flex items-center justify-center shrink-0"
      style={{
        width: size,
        height: size,
        borderRadius: 9999,
        background: pal.bg,
        color: pal.fg,
        fontSize: Math.round(size * 0.42),
        fontWeight: 600,
        lineHeight: 1,
      }}
    >
      {initials}
    </span>
  );
}

/**
 * Inline 32px thumbnail. An image or video file shows its own preview; every
 * other type falls back to the shared type palette with a corner extension
 * badge, so the row still says what kind of file it is.
 */
export function AttachmentInlineThumbnail({
  type,
  previewUrl,
}: {
  type?: string;
  previewUrl?: string | null;
}) {
  /* Callers hand this whatever their own record calls a file type, and
     some records carry none at all. `fileExtLabel` calls `toUpperCase`
     on it, so an absent type used to throw and take the whole panel
     down; an unknown one falls back to the generic file palette. */
  const safeType = (type || "").toLowerCase();
  const tb = getFileThumbnail(safeType);
  const ext = safeType ? fileExtLabel(safeType as FileType) : "FILE";
  return (
    <div
      className="shrink-0 relative overflow-hidden flex items-center justify-center"
      style={{
        width: 32,
        height: 32,
        borderRadius: 6,
        background: tb.bg,
        border: "1px solid var(--border)",
      }}
    >
      {previewUrl ? (
        <img src={previewUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <>
          {React.isValidElement(tb.icon)
            ? React.cloneElement(tb.icon as React.ReactElement<{ size?: number }>, { size: 15 })
            : tb.icon}
          <span
            className="absolute"
            style={{
              bottom: 1,
              right: 1,
              padding: "0 2px",
              borderRadius: 2,
              background: "rgba(255,255,255,0.85)",
              border: "1px solid var(--border)",
              fontWeight: 600,
              fontSize: 7,
              color: tb.color,
              letterSpacing: "0.03em",
              textTransform: "uppercase",
              lineHeight: "10px",
            }}
          >
            {ext}
          </span>
        </>
      )}
    </div>
  );
}

function RowMenuDivider() {
  return <div style={{ height: 1, margin: "4px 6px", background: "var(--border)" }} />;
}

function RowMenuItem({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center w-full transition-colors"
      style={{
        height: 30,
        padding: "0 10px",
        borderRadius: 6,
        cursor: "pointer",
        border: "none",
        background: "transparent",
        gap: 8,
        fontWeight: 500,
        fontSize: 12,
        color: danger ? "var(--destructive)" : "var(--foreground)",
        textAlign: "left",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = danger ? "rgba(220,38,38,0.08)" : "var(--primary-50)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      <span style={{ display: "flex", color: danger ? "var(--destructive)" : "var(--text-secondary)" }}>
        {icon}
      </span>
      {label}
    </button>
  );
}

/**
 * The three-dot menu a list row carries.
 *
 * Portalled to the body rather than absolutely positioned in the row.
 * Every list here lives in a container that clips — the configurator's
 * rounded `overflow:hidden` box, the record tab's `overflow-y-auto`
 * pane — so an in-row menu on one of the last rows lost its lower items
 * to the container edge. `AttachmentCard` already portals its own menu;
 * this puts the list views on the same footing and the same stacking
 * tier, so neither view can be cropped by whatever it sits inside.
 */
export function AttachmentRowMenu({
  items,
  label,
  visible = true,
  width = 36,
}: {
  items: AttachmentCardMenuItem[];
  /** Names the row in the trigger's accessible label. */
  label: string;
  /** Row hover state. The trigger also stays visible while open. */
  visible?: boolean;
  width?: number;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  const MENU_W = 200;
  const openMenu = useCallback(() => {
    const r = triggerRef.current?.getBoundingClientRect();
    if (!r) return;
    const dividers = items.filter((it, i) => it.dividerBefore && i > 0).length;
    const estH = items.length * 30 + dividers * 9 + 8;
    const roomBelow = window.innerHeight - r.bottom;
    setPos({
      /* Flip above when the space below cannot hold the menu, so the last
         row of a long list opens upward instead of off-screen. */
      top: roomBelow < estH + 8 ? Math.max(8, r.top - estH - 2) : r.bottom + 2,
      left: Math.min(Math.max(8, r.right - MENU_W), window.innerWidth - MENU_W - 8),
    });
    setOpen(true);
  }, [items]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      /* Two containers to check, not one: the trigger stayed in the row
         while the menu moved to the body. */
      if (popRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    /* A fixed menu does not travel with its row, so scrolling would leave
       it stranded beside the wrong file. Close it rather than re-pin it. */
    const onMove = () => setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [open]);

  if (!items.length) return <div className="shrink-0" style={{ width }} />;

  return (
    <div
      className="relative shrink-0"
      style={{ width, display: "flex", justifyContent: "center" }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        ref={triggerRef}
        onClick={() => (open ? setOpen(false) : openMenu())}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Actions for ${label}`}
        style={{
          width: 24,
          height: 24,
          borderRadius: 4,
          cursor: "pointer",
          border: "none",
          background: "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: visible || open ? 1 : 0,
          transition: "opacity 0.1s ease",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "var(--primary-50)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
      >
        <MoreVertical size={14} style={{ color: "var(--text-secondary)" }} />
      </button>
      {open && pos && createPortal(
        <div
          ref={popRef}
          role="menu"
          className="border border-border"
          style={{
            position: "fixed",
            top: pos.top,
            left: pos.left,
            width: MENU_W,
            /* Same tier as `AttachmentCard`'s portalled menu, which sits
               above the configurator's own overlay. */
            zIndex: 12000,
            borderRadius: 8,
            background: "var(--card)",
            boxShadow: "0 4px 16px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.06)",
            padding: 4,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {items.map((item, idx) => (
            <React.Fragment key={`${item.label}-${idx}`}>
              {item.dividerBefore && idx > 0 && <RowMenuDivider />}
              <RowMenuItem
                icon={item.icon}
                label={item.label}
                danger={item.danger}
                onClick={() => { setOpen(false); item.onClick(); }}
              />
            </React.Fragment>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}

/** Column header for the list views, so the size / date / uploader columns
 *  are labelled rather than left as three unexplained values. */
export function AttachmentListHeader({ selectable = false }: { selectable?: boolean }) {
  const cell: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 600,
    color: "var(--text-tertiary)",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  };
  return (
    <div
      className="flex items-center"
      style={{
        padding: "7px 12px",
        borderBottom: "1px solid var(--border)",
        background: "var(--surface-secondary)",
        columnGap: 2,
      }}
    >
      {selectable && <span className="shrink-0" style={{ width: 26 }} />}
      <span style={{ ...cell, flex: 1, minWidth: 0 }}>Name</span>
      <span className="shrink-0" style={{ ...cell, width: 58 }}>Size</span>
      <span className="shrink-0" style={{ ...cell, width: 92 }}>Added</span>
      <span className="shrink-0" style={{ ...cell, width: 104 }}>Added by</span>
      <span className="shrink-0" style={{ width: 32 }} />
    </div>
  );
}

/**
 * One file as a list row. `density` sets only the vertical padding, so
 * Condensed and Comfort are the same row at two rhythms rather than two
 * different rows.
 */
export function AttachmentListRow({
  name,
  type,
  size,
  date,
  uploadedBy,
  previewUrl,
  pills,
  density = "comfort",
  selection,
  menuItems,
  onClick,
  renderName,
}: {
  name: string;
  type?: string;
  size?: string;
  date?: string;
  uploadedBy?: string;
  previewUrl?: string | null;
  /** Provenance chips, shown after the file name. */
  pills?: React.ReactNode;
  density?: "condensed" | "comfort";
  selection?: { checked: boolean; onToggle: () => void; node?: React.ReactNode };
  menuItems?: AttachmentCardMenuItem[];
  onClick?: () => void;
  renderName?: (name: string) => React.ReactNode;
}) {
  const [hovered, setHovered] = useState(false);

  const selected = !!selection?.checked;

  return (
    <div
      className="flex items-center transition-colors"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      style={{
        padding: density === "condensed" ? "7px 12px" : "12px 12px",
        borderBottom: "1px solid color-mix(in srgb, var(--border) 50%, transparent)",
        /* A selected row keeps its tint whether or not the pointer is on it,
           so a long selection stays visible while the pointer moves. */
        background: selected ? "var(--accent)" : hovered ? "var(--primary-50)" : "transparent",
        cursor: onClick ? "pointer" : "default",
        columnGap: 2,
      }}
    >
      {selection && (
        <span
          className="shrink-0 flex items-center"
          style={{ width: 26 }}
          onClick={(e) => e.stopPropagation()}
        >
          {selection.node}
        </span>
      )}
      <div className="flex items-center min-w-0" style={{ flex: 1, gap: 10 }}>
        <AttachmentInlineThumbnail type={type} previewUrl={previewUrl} />
        <span className="truncate" style={{ fontSize: 13, fontWeight: 500, color: "var(--foreground)", lineHeight: 1.3 }} title={name}>
          {renderName ? renderName(name) : name}
        </span>
        {pills}
      </div>
      <span className="shrink-0" style={{ width: 58, fontSize: 12, color: "var(--text-secondary)" }}>
        {size || "—"}
      </span>
      <span className="shrink-0" style={{ width: 92, fontSize: 12, color: "var(--text-tertiary)" }}>
        {formatAttachmentDateShort(date || "") || "—"}
      </span>
      <div className="shrink-0 flex items-center min-w-0" style={{ width: 104, gap: 8 }}>
        {uploadedBy ? (
          <>
            <AttachmentUploaderAvatar name={uploadedBy} size={20} />
            <span className="truncate" style={{ fontSize: 12, color: "var(--foreground)" }} title={uploadedBy}>
              {uploadedBy}
            </span>
          </>
        ) : (
          <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>—</span>
        )}
      </div>
      <AttachmentRowMenu items={menuItems ?? []} label={name} visible={hovered} width={32} />
    </div>
  );
}
