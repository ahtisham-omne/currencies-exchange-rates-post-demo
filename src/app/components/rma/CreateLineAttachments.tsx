/**
 * CreateLineAttachments — per-line attachment zone for the RMA create flow.
 *
 * Ported from the Purchase Order module's per-line attachment design: files
 * land as shimmer placeholder cards while the upload runs, then settle into
 * the shared `AttachmentCard` grid with preview, download and delete. Replaces
 * the flat chip list the create flow shipped with, so the evidence a user
 * attaches while building the return reads the same as it will on the RMA
 * Detail Attachments tab.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Upload, X, Paperclip } from "lucide-react";
import {
  AttachmentCard,
  type AttachmentCardData,
} from "@/app/components/shared/attachments/attachment-card";
import { AttachmentPreviewModal } from "@/app/components/shared/attachments/attachment-preview-modal";

const font = "var(--font-inter)";

/** Widened shape of the create flow's per-line attachment entries. `name` is
 *  the only field the submit payload reads; the rest drive the card. */
export interface LineAttachmentFile {
  name: string;
  size?: string;
  type?: string;
  previewUrl?: string;
  uploadedBy?: string;
  uploadedDate?: string;
  uploadedTime?: string;
  uploading?: boolean;
  progress?: number;
}

const CURRENT_USER = "Sarah Chen";

function formatSize(bytes: number): string {
  return bytes >= 1048576
    ? `${(bytes / 1048576).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function extOf(name: string): string {
  return (name.split(".").pop() || "file").toLowerCase();
}

function toCardData(f: LineAttachmentFile): AttachmentCardData {
  return {
    fileName: f.name,
    fileType: f.type ?? extOf(f.name),
    fileSize: f.size ?? "—",
    uploadedDate: f.uploadedDate ?? "",
    uploadedTime: f.uploadedTime ?? "",
    uploadedBy: f.uploadedBy ?? CURRENT_USER,
    ...(f.previewUrl ? { previewUrl: f.previewUrl } : {}),
  };
}

/* ── Uploading card (shimmer placeholder), same treatment as the RMA Detail
 *    Attachments tab so a file reads identically wherever it is dropped. ── */
function LineUploadingCard({
  fileName,
  fileSize,
  ext,
  progress,
  onCancel,
}: {
  fileName: string;
  fileSize: string;
  ext: string;
  progress: number;
  onCancel: () => void;
}) {
  const clamped = Math.min(100, Math.max(0, progress));
  return (
    <div
      className="relative flex flex-col overflow-hidden"
      style={{
        minWidth: 0,
        borderRadius: "var(--radius-lg)",
        background: "hsl(var(--card))",
        border: "1px solid hsl(var(--border))",
        boxShadow: "var(--elevation-xs)",
      }}
    >
      <div
        className="relative shrink-0 w-full flex items-center justify-center overflow-hidden"
        style={{
          height: 72,
          borderTopLeftRadius: "calc(var(--radius-lg) - 1px)",
          borderTopRightRadius: "calc(var(--radius-lg) - 1px)",
          background:
            "linear-gradient(110deg, var(--surface-secondary) 8%, hsl(210,16%,93%) 18%, var(--surface-secondary) 33%)",
          backgroundSize: "200% 100%",
          animation: "rmaAttUploadShimmer 1.2s linear infinite",
        }}
      >
        <div className="relative flex items-center justify-center" style={{ width: 44, height: 44 }}>
          <svg width="44" height="44" viewBox="0 0 56 56" style={{ position: "absolute", inset: 0 }}>
            <circle cx="28" cy="28" r="24" fill="none" stroke="hsl(var(--border))" strokeWidth="4" />
            <circle
              cx="28"
              cy="28"
              r="24"
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 24}
              strokeDashoffset={2 * Math.PI * 24 * (1 - clamped / 100)}
              style={{
                transformOrigin: "center",
                transform: "rotate(-90deg)",
                transition: "stroke-dashoffset 160ms linear",
              }}
            />
          </svg>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: "hsl(var(--primary))",
              fontVariantNumeric: "tabular-nums",
              lineHeight: 1,
            }}
          >
            {Math.round(clamped)}%
          </span>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onCancel();
          }}
          aria-label="Cancel upload"
          className="absolute flex items-center justify-center"
          style={{
            top: 5,
            right: 5,
            width: 20,
            height: 20,
            borderRadius: 999,
            background: "rgba(255,255,255,0.95)",
            border: "1px solid hsl(var(--border))",
            cursor: "pointer",
            color: "var(--text-secondary)",
            boxShadow: "0 1px 2px rgba(16,24,40,0.10)",
          }}
        >
          <X size={11} />
        </button>
      </div>
      <style>{`@keyframes rmaAttUploadShimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
      <div className="flex flex-col" style={{ padding: "6px 8px", gap: 2 }}>
        <span
          className="truncate"
          style={{ fontFamily: font, fontSize: 11, fontWeight: 600, color: "hsl(var(--foreground))" }}
          title={fileName}
        >
          {fileName}
        </span>
        <span style={{ fontFamily: font, fontSize: 10, color: "var(--text-tertiary)" }}>
          {ext.toUpperCase()} · {fileSize}
        </span>
      </div>
    </div>
  );
}

export function CreateLineAttachments({
  lineId,
  files,
  onChange,
}: {
  lineId: string;
  files: LineAttachmentFile[];
  onChange: (next: LineAttachmentFile[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<LineAttachmentFile | null>(null);
  const filesRef = useRef(files);
  filesRef.current = files;

  /* Progress ticks for any card still uploading. Runs off a single interval
     so a batch drop does not spawn a timer per file. */
  useEffect(() => {
    if (!files.some((f) => f.uploading)) return;
    const t = setInterval(() => {
      const current = filesRef.current;
      if (!current.some((f) => f.uploading)) return;
      onChange(
        current.map((f) => {
          if (!f.uploading) return f;
          const next = Math.min(100, (f.progress ?? 0) + 18);
          if (next >= 100) {
            const { uploading: _u, progress: _p, ...rest } = f;
            return rest;
          }
          return { ...f, progress: next };
        }),
      );
    }, 260);
    return () => clearInterval(t);
  }, [files, onChange]);

  const addFiles = useCallback(
    (list: FileList | null) => {
      if (!list || !list.length) return;
      const now = new Date();
      const added: LineAttachmentFile[] = Array.from(list).map((f) => ({
        name: f.name,
        size: formatSize(f.size),
        type: extOf(f.name),
        uploadedBy: CURRENT_USER,
        uploadedDate: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`,
        uploadedTime: now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
        ...(f.type.startsWith("image/") ? { previewUrl: URL.createObjectURL(f) } : {}),
        uploading: true,
        progress: 0,
      }));
      onChange([...filesRef.current, ...added]);
    },
    [onChange],
  );

  const removeAt = useCallback(
    (idx: number) => {
      onChange(filesRef.current.filter((_, i) => i !== idx));
    },
    [onChange],
  );

  return (
    <div className="space-y-1.5">
      <input
        ref={inputRef}
        type="file"
        multiple
        id={`line-upload-${lineId}`}
        className="hidden"
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          addFiles(e.dataTransfer.files);
        }}
        className="w-full min-h-[104px] flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-6 text-[11px] transition-colors"
        style={{
          borderColor: dragging ? "hsl(var(--primary))" : "hsl(var(--border))",
          background: dragging ? "var(--primary-50)" : "hsl(var(--card))",
          color: "var(--text-secondary)",
          fontFamily: font,
          fontWeight: 500,
        }}
      >
        <Upload className="w-5 h-5" style={{ color: "var(--text-secondary)" }} />
        <span>
          <span className="text-primary" style={{ fontWeight: 600 }}>
            Click to upload
          </span>{" "}
          or drag and drop
        </span>
      </button>

      {files.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
            gap: 8,
            paddingTop: 4,
          }}
        >
          {files.map((f, idx) =>
            f.uploading ? (
              <LineUploadingCard
                key={`${f.name}-${idx}`}
                fileName={f.name}
                fileSize={f.size ?? "—"}
                ext={f.type ?? extOf(f.name)}
                progress={f.progress ?? 0}
                onCancel={() => removeAt(idx)}
              />
            ) : (
              <AttachmentCard
                key={`${f.name}-${idx}`}
                compact
                att={toCardData(f)}
                onPreview={() => setPreview(f)}
                onCardClick={() => setPreview(f)}
                onDelete={() => removeAt(idx)}
                deleteVariant="inline"
              />
            ),
          )}
        </div>
      )}

      {files.length === 0 && (
        <div
          className="flex items-center gap-1.5"
          style={{ fontFamily: font, fontSize: 10, color: "var(--text-tertiary)", paddingTop: 2 }}
        >
          <Paperclip className="w-2.5 h-2.5" />
          Damage photos, the vendor authorization email, or the inspection report.
        </div>
      )}

      {preview && (
        <AttachmentPreviewModal
          attachment={{ ...toCardData(preview), source: "Item Attachments" }}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}
