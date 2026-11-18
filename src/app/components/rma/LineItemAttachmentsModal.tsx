/**
 * LineItemAttachmentsModal — per-line attachment picker.
 *
 * Ported from the Purchase Order module's Item Detail attachment picker
 * (`OrderFlow` running the item Attachments tab in `selectionMode`): the
 * item's own document library on one side, and the subset the user has
 * pulled onto this return on the other. Selection is held in the shared
 * `rmaItemAttachmentsStore`, so the RMA Detail Attachments tab's Item
 * Attachments section reflects what is picked here, and the reverse.
 */

import React, { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Search, X, Paperclip, Upload } from "lucide-react";
import {
  AttachmentCard,
  THUMB_GRID_COLUMNS,
  type AttachmentCardData,
} from "@/app/components/shared/attachments/attachment-card";
import { AttachmentPreviewModal } from "@/app/components/shared/attachments/attachment-preview-modal";
import { EmptyPlaceholder } from "@/app/components/shared/EmptyPlaceholder";
import * as rmaItemAttachments from "@/app/components/rmaItemAttachmentsStore";
import { MOCK_ATTACHMENTS as ITEM_LIBRARY } from "./itemAttachmentLibrary";

const font = "var(--font-inter)";
const EMPTY_SET: Set<string> = new Set();

type LibraryEntry = (typeof ITEM_LIBRARY)[number];
type SelectionFilter = "included" | "excluded";

function toCardData(a: LibraryEntry): AttachmentCardData {
  const iso = a.uploadedAt || "";
  const datePart = iso.slice(0, 10);
  const timeRaw = iso.slice(11, 16);
  let time = "";
  if (timeRaw) {
    const hh = parseInt(timeRaw.slice(0, 2), 10);
    const mm = timeRaw.slice(3, 5);
    const suffix = hh >= 12 ? "PM" : "AM";
    const h12 = hh % 12 === 0 ? 12 : hh % 12;
    time = `${h12}:${mm} ${suffix}`;
  }
  return {
    fileName: a.name,
    fileType: (a.type || "FILE").toLowerCase(),
    fileSize: a.size,
    uploadedDate: datePart,
    uploadedTime: time,
    uploadedBy: a.uploadedBy,
    ...(a.previewUrl ? { previewUrl: a.previewUrl } : {}),
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
 * § 1  SELECTION HOOK — shared by the modal and the inline affordance
 * ═══════════════════════════════════════════════════════════════════════════ */

export function usePickedLineAttachments(rmaId: string | undefined, lineItemId: string | undefined) {
  const bound = !!(rmaId && lineItemId);
  const subscribe = useCallback(
    (cb: () => void) => (rmaId ? rmaItemAttachments.subscribe(rmaId, cb) : () => {}),
    [rmaId],
  );
  const picked = useSyncExternalStore(
    subscribe,
    () => (bound ? rmaItemAttachments.getPickedAttachmentIds(rmaId!, lineItemId!) : EMPTY_SET),
    () => EMPTY_SET,
  );
  const toggle = useCallback(
    (attId: string) => {
      if (!bound) return;
      rmaItemAttachments.togglePickedAttachment(rmaId!, lineItemId!, attId);
    },
    [bound, rmaId, lineItemId],
  );
  return { picked, toggle };
}

/* ═══════════════════════════════════════════════════════════════════════════
 * § 2  INLINE AFFORDANCE — paperclip + count, opens the picker
 * ═══════════════════════════════════════════════════════════════════════════ */

export function LineAttachmentsButton({
  rmaId,
  lineItemId,
  itemCode,
  itemName,
  extraCount = 0,
  disabled = false,
}: {
  rmaId: string;
  lineItemId: string;
  itemCode: string;
  itemName: string;
  /** Attachments already on the line in the data model, counted alongside picks. */
  extraCount?: number;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { picked } = usePickedLineAttachments(rmaId, lineItemId);
  const count = picked.size + extraCount;
  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        title={count ? `${count} attachment${count === 1 ? "" : "s"} on this line` : "Attach files to this line"}
        className="inline-flex items-center transition-colors"
        style={{
          padding: "1px 6px",
          borderRadius: "9999px",
          background: count ? "var(--primary-50)" : "transparent",
          border: `1px solid ${count ? "var(--primary-200)" : "hsl(var(--border))"}`,
          color: count ? "var(--primary-700)" : "var(--text-secondary)",
          fontFamily: font,
          fontWeight: 500,
          fontSize: "10px",
          gap: "3px",
          whiteSpace: "nowrap",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <Paperclip size={9} />
        {count > 0 ? count : "Attach"}
      </button>
      {open && (
        <LineItemAttachmentsModal
          rmaId={rmaId}
          lineItemId={lineItemId}
          itemCode={itemCode}
          itemName={itemName}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * § 3  PICKER MODAL
 * ═══════════════════════════════════════════════════════════════════════════ */

export function LineItemAttachmentsModal({
  rmaId,
  lineItemId,
  itemCode,
  itemName,
  onClose,
}: {
  rmaId: string;
  lineItemId: string;
  itemCode: string;
  itemName: string;
  onClose: () => void;
}) {
  const { picked, toggle } = usePickedLineAttachments(rmaId, lineItemId);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<SelectionFilter>("excluded");
  const [preview, setPreview] = useState<LibraryEntry | null>(null);

  const selectedCount = useMemo(
    () => ITEM_LIBRARY.filter((a) => picked.has(a.id)).length,
    [picked],
  );

  const visible = useMemo(() => {
    let items: LibraryEntry[] = ITEM_LIBRARY.filter((a) =>
      filter === "included" ? picked.has(a.id) : !picked.has(a.id),
    );
    const q = query.trim().toLowerCase();
    if (q) {
      items = items.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.uploadedBy.toLowerCase().includes(q) ||
          a.type.toLowerCase().includes(q),
      );
    }
    return items;
  }, [picked, filter, query]);

  const segments: { key: SelectionFilter; label: string; count: number }[] = [
    { key: "included", label: "On this return", count: selectedCount },
    { key: "excluded", label: "Item level attachments", count: ITEM_LIBRARY.length - selectedCount },
  ];

  const body = (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 9998, background: "rgba(0,0,0,0.55)" }}
      onClick={onClose}
    >
      <div
        className="flex flex-col"
        style={{
          width: "min(900px, calc(100vw - 32px))",
          maxHeight: "84vh",
          background: "hsl(var(--card))",
          borderRadius: "var(--radius-lg)",
          overflow: "hidden",
          boxShadow: "0 24px 80px -12px rgba(0,0,0,0.25)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between shrink-0"
          style={{ padding: "16px 20px", borderBottom: "1px solid hsl(var(--border))" }}
        >
          <div className="flex flex-col" style={{ gap: 2, minWidth: 0 }}>
            <h3
              style={{
                fontFamily: font,
                fontSize: 16,
                fontWeight: 600,
                margin: 0,
                color: "hsl(var(--foreground))",
              }}
            >
              Line attachments
            </h3>
            <span
              style={{
                fontFamily: font,
                fontSize: 12,
                color: "var(--text-secondary)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {itemCode} · {itemName}
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="hover:bg-[var(--surface-secondary)]"
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: 0,
              background: "transparent",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={18} style={{ color: "var(--text-secondary)" }} />
          </button>
        </div>

        {/* Toolbar */}
        <div
          className="flex items-center shrink-0"
          style={{ padding: "12px 20px 0", gap: "var(--spacing-2)" }}
        >
          <div className="relative flex-1" style={{ minWidth: 0 }}>
            <Search
              size={13}
              style={{
                position: "absolute",
                left: 9,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--text-tertiary)",
              }}
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search attachments"
              className="w-full border border-border focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              style={{
                height: 30,
                paddingLeft: 28,
                paddingRight: 10,
                borderRadius: "var(--radius-sm)",
                background: "hsl(var(--background))",
                fontFamily: font,
                fontSize: "var(--text-caption)",
                color: "hsl(var(--foreground))",
                boxShadow: "var(--elevation-xs)",
              }}
            />
          </div>
        </div>

        {/* Selection filter tab strip */}
        <div
          className="flex shrink-0"
          style={{
            gap: "var(--spacing-1)",
            padding: "0 20px",
            borderBottom: "1px solid hsl(var(--border))",
            marginTop: "var(--spacing-2)",
          }}
        >
          {segments.map((s) => {
            const active = filter === s.key;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => setFilter(s.key)}
                style={{
                  position: "relative",
                  height: 34,
                  padding: "0 var(--spacing-2-5)",
                  background: "transparent",
                  border: "none",
                  borderBottom: active ? "2px solid hsl(var(--primary))" : "2px solid transparent",
                  color: active ? "hsl(var(--primary))" : "var(--text-secondary)",
                  cursor: "pointer",
                  fontFamily: font,
                  fontWeight: active ? 600 : 500,
                  fontSize: "var(--text-caption)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: -1,
                  transition: "color 0.12s ease, border-color 0.12s ease",
                }}
              >
                {s.label}
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: "1px 5px",
                    borderRadius: 999,
                    background: active
                      ? "color-mix(in srgb, hsl(var(--primary)) 14%, transparent)"
                      : "color-mix(in srgb, var(--text-secondary) 12%, transparent)",
                    color: active ? "hsl(var(--primary))" : "var(--text-secondary)",
                  }}
                >
                  {s.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Card grid */}
        <div style={{ padding: 20, overflowY: "auto", flex: 1, minHeight: 0 }}>
          {visible.length === 0 ? (
            <EmptyPlaceholder
              block
              icon={Paperclip}
              title={filter === "included" ? "Nothing attached to this line yet" : "No files left to attach"}
              description={
                filter === "included"
                  ? "Pick files from the item level attachments tab to attach them to this return line."
                  : "Every file in this item's library is already attached to this return line."
              }
            />
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: THUMB_GRID_COLUMNS, gap: "var(--spacing-3)" }}>
              {visible.map((file) => {
                const on = picked.has(file.id);
                return (
                  <AttachmentCard
                    key={file.id}
                    att={toCardData(file)}
                    onPreview={() => setPreview(file)}
                    onCardClick={() => setPreview(file)}
                    inclusionToggle={{
                      included: on,
                      showLabel: "Attach to this line",
                      hideLabel: "Remove from this line",
                      onToggle: () => toggle(file.id),
                    }}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between shrink-0"
          style={{ padding: "12px 20px", borderTop: "1px solid hsl(var(--border))", gap: 8 }}
        >
          <span style={{ fontFamily: font, fontSize: 12, color: "var(--text-secondary)" }}>
            {selectedCount} of {ITEM_LIBRARY.length} attached to this line
          </span>
          <button
            onClick={onClose}
            style={{
              height: 34,
              padding: "0 16px",
              borderRadius: 8,
              border: 0,
              background: "hsl(var(--primary))",
              color: "#FFFFFF",
              fontFamily: font,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Done
          </button>
        </div>
      </div>

      {preview && (
        <AttachmentPreviewModal
          attachment={{ ...toCardData(preview), source: "Item Attachments" }}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(body, document.body);
}

/* Re-exported so create-flow surfaces can render the same upload affordance
   without importing lucide directly. */
export const LineAttachmentUploadIcon = Upload;
