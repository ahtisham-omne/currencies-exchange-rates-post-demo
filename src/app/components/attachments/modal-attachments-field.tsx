/**
 * ModalAttachmentsField — Shared inline attachments uploader used inside action modals
 * (Quarantine, End Quarantine, Check Out, Check In, Split LOT, …).
 *
 * Visual parity with the Partner Creation "Attachments" step:
 *  • Header: paperclip in a soft primary-tinted square + "Attachments" label + count pill.
 *  • Dropzone: rounded-lg, dashed border, white bg. Hover → border darkens, bg #FAFBFC.
 *    Drag-over → primary border + accent bg, upload icon turns primary on a light-blue tile.
 *  • File rows: white card, hover bg #FAFBFC, trash icon fades in on row hover and turns red.
 */
import { useCallback, useRef, useState } from "react";
import { Paperclip, Upload } from "lucide-react";
import { AttachmentCard, THUMB_PREVIEW_H } from "./attachment-card";
import { supabase } from "@/integrations/supabase/client";
import { ATTACHMENTS_BUCKET, buildAttachmentPath } from "@/lib/attachments";
import { toast } from "sonner";

export interface ModalAttachment {
  id: string;
  file: File;
  url: string;
  /** True while the file is being uploaded to Storage. */
  uploading?: boolean;
  /** 0–100 upload progress; only set while `uploading`. */
  progress?: number;
  /** Storage object path once the upload succeeds. */
  filePath?: string;
  /** Database row id once metadata is persisted. */
  attachmentId?: string;
}

interface Props {
  value: ModalAttachment[];
  onChange: (next: ModalAttachment[]) => void;
  label?: string;
  accept?: string;
  maxFiles?: number;
  maxSizeMB?: number;
  /** Hide the built-in "Attachments" label/count header (caller renders its own). */
  hideHeader?: boolean;
  /** Entity type this attachment belongs to (e.g. "lot", "unit", "transaction"). Used for storage path + DB linkage. */
  entityType?: string;
  /** Entity id (e.g. lot id, unit id). Defaults to "draft" while a form is unsaved. */
  entityId?: string;
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

function getFileEmoji(file: File): string {
  const t = file.type || "";
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  if (t.startsWith("image/")) return "🖼️";
  if (t === "application/pdf" || ext === "pdf") return "📄";
  if (["xlsx", "xls", "csv"].includes(ext)) return "📊";
  if (["doc", "docx"].includes(ext)) return "📝";
  return "📎";
}

export function ModalAttachmentsField({
  value,
  onChange,
  label = "Attachments",
  accept = ".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg",
  maxFiles = 20,
  maxSizeMB = 10,
  hideHeader = false,
  entityType = "misc",
  entityId = "draft",
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const valueRef = useRef(value);
  valueRef.current = value;

  const patchAttachment = useCallback(
    (id: string, patch: Partial<ModalAttachment>) => {
      const next = valueRef.current.map((a) => (a.id === id ? { ...a, ...patch } : a));
      valueRef.current = next;
      onChange(next);
    },
    [onChange],
  );

  const uploadOne = useCallback(
    async (att: ModalAttachment) => {
      try {
        const path = buildAttachmentPath(entityType, entityId, att.file.name);
        // Tick to ~20% so the UI shows movement before the upload completes.
        patchAttachment(att.id, { progress: 20 });

        const { error: upErr } = await supabase.storage
          .from(ATTACHMENTS_BUCKET)
          .upload(path, att.file, {
            cacheControl: "3600",
            upsert: false,
            contentType: att.file.type || undefined,
          });
        if (upErr) throw upErr;

        patchAttachment(att.id, { progress: 80, filePath: path });

        const ext = (att.file.name.split(".").pop() || "file").toLowerCase();
        const { data: row, error: insErr } = await supabase
          .from("attachments")
          .insert({
            entity_type: entityType,
            entity_id: entityId,
            file_name: att.file.name,
            file_type: ext,
            file_path: path,
            size_bytes: att.file.size,
          })
          .select("id")
          .single();
        if (insErr) throw insErr;

        patchAttachment(att.id, {
          uploading: false,
          progress: 100,
          filePath: path,
          attachmentId: row?.id,
        });
      } catch (err: any) {
        console.error("[attachments] upload failed", err);
        toast.error(err?.message || "Upload failed");
        patchAttachment(att.id, { uploading: false, progress: 0 });
      }
    },
    [entityType, entityId, patchAttachment],
  );

  const addFiles = useCallback(
    (files: FileList | File[] | null) => {
      if (!files) return;
      const arr = Array.from(files);
      if (!arr.length) return;
      const room = Math.max(0, maxFiles - value.length);
      const maxBytes = maxSizeMB * 1024 * 1024;
      const accepted = arr
        .filter((f) => f.size <= maxBytes)
        .slice(0, room)
        .map<ModalAttachment>((f) => ({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          file: f,
          url: f.type.startsWith("image/") ? URL.createObjectURL(f) : "",
          uploading: true,
          progress: 0,
        }));
      const next = [...value, ...accepted];
      valueRef.current = next;
      onChange(next);

      // Autoscroll the newly added card(s) into view so the user can see the uploading state.
      requestAnimationFrame(() => {
        const first = accepted[0];
        if (!first) return;
        const el = gridRef.current?.querySelector<HTMLElement>(`[data-att-id="${first.id}"]`);
        el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });

      // Kick off real Storage uploads in parallel.
      accepted.forEach((a) => { void uploadOne(a); });
    },
    [value, onChange, maxFiles, maxSizeMB, uploadOne],
  );


  const handleRemove = (id: string) => {
    const found = value.find((a) => a.id === id);
    if (found?.url) URL.revokeObjectURL(found.url);
    // Best-effort cleanup of the storage object + DB row. Errors are non-fatal.
    if (found?.filePath) {
      void supabase.storage.from(ATTACHMENTS_BUCKET).remove([found.filePath]);
    }
    if (found?.attachmentId) {
      void supabase.from("attachments").delete().eq("id", found.attachmentId);
    }
    onChange(value.filter((a) => a.id !== id));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    addFiles(e.dataTransfer.files);
  };

  return (
    <div>
      {/* Header: paperclip tile + label + count (hidden when caller owns its own header) */}
      {!hideHeader && (
        <div className="flex items-center gap-2 mb-2.5">
          <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
            <Paperclip className="w-3.5 h-3.5 text-primary" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>{label}</span>
            {value.length > 0 && (
              <span
                className="text-[10px] text-slate-500 bg-muted px-1.5 py-0.5 rounded-full"
                style={{ fontWeight: 500 }}
              >
                {value.length}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`rounded-lg border-2 border-dashed px-3 py-2.5 cursor-pointer transition-all ${
          dragActive
            ? "border-primary bg-accent/30"
            : "border-border bg-white hover:border-slate-300 hover:bg-[#FAFBFC]"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={accept}
          onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }}
          className="hidden"
        />
        <div className="flex items-center gap-3 text-left">
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
              dragActive ? "bg-[#D6E8FF] text-primary" : "bg-muted text-slate-400"
            }`}
          >
            <Upload className="w-4 h-4" />
          </div>
          <div className="flex flex-col min-w-0">
            <p className="text-sm text-foreground" style={{ fontWeight: 500 }}>
              <span className="text-primary">Click to upload</span>
              <span> or drag and drop</span>
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              PDF, DOC, XLS, PNG, JPG up to {maxSizeMB}MB
            </p>
          </div>
        </div>
      </div>


      {/* Uploaded files — card grid (shared with adjust modal's RowAttachmentsModal). */}
      {value.length > 0 && (
        <div
          ref={gridRef}
          className="mt-2.5 grid"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "var(--spacing-3)" }}
        >
          {value.map((a) => {
            const isImg = a.file.type.startsWith("image/");
            const ext = (a.file.name.split(".").pop() || "file").toLowerCase();
            const now = new Date();
            const mm = String(now.getMonth() + 1).padStart(2, "0");
            const dd = String(now.getDate()).padStart(2, "0");
            const yyyy = now.getFullYear();
            let hh = now.getHours();
            const mins = String(now.getMinutes()).padStart(2, "0");
            const ampm = hh >= 12 ? "pm" : "am";
            hh = hh % 12 || 12;
            if (a.uploading) {
              return (
                <div key={a.id} data-att-id={a.id}>
                  <UploadingCard
                    fileName={a.file.name}
                    fileSize={formatBytes(a.file.size)}
                    ext={ext}
                    progress={a.progress ?? 0}
                    onCancel={() => handleRemove(a.id)}
                  />
                </div>
              );
            }
            return (
              <div key={a.id} data-att-id={a.id}>
                <AttachmentCard
                  att={{
                    fileName: a.file.name,
                    fileType: ext,
                    fileSize: formatBytes(a.file.size),
                    uploadedDate: `${mm}/${dd}/${yyyy}`,
                    uploadedTime: `${hh}:${mins} ${ampm}`,
                    uploadedBy: "You",
                    previewUrl: isImg ? a.url : null,
                    filePath: a.filePath ?? null,
                  }}
                  onDelete={() => handleRemove(a.id)}
                  deleteVariant="inline"
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── UploadingCard ── placeholder card shown while a file is being uploaded.
 * Mirrors the AttachmentCard footprint (thumbnail area + name + size row),
 * but replaces the preview with a soft skeleton + animated progress bar. */
function UploadingCard({
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
  return (
    <div
      className="relative flex flex-col"
      style={{
        minWidth: 0,
        borderRadius: "var(--radius-lg)",
        background: "var(--piw-card)",
        border: "1px solid var(--piw-border)",
        boxShadow: "0px 1px 2px 0px rgba(16,24,40,0.04)",
      }}
    >
      <div
        className="relative shrink-0 w-full flex items-center justify-center overflow-hidden"
        style={{
          height: THUMB_PREVIEW_H,
          borderTopLeftRadius: "calc(var(--radius-lg) - 1px)",
          borderTopRightRadius: "calc(var(--radius-lg) - 1px)",
          background:
            "linear-gradient(110deg, var(--surface-secondary) 8%, hsl(210,16%,93%) 18%, var(--surface-secondary) 33%)",
          backgroundSize: "200% 100%",
          animation: "modalAttUploadShimmer 1.2s linear infinite",
        }}
      >
        {/* Centered progress indicator: animated ring + percent in the middle */}
        <div
          className="relative flex items-center justify-center"
          style={{ width: 56, height: 56 }}
        >
          <svg
            width="56"
            height="56"
            viewBox="0 0 56 56"
            style={{ position: "absolute", inset: 0 }}
            aria-hidden
          >
            <circle
              cx="28"
              cy="28"
              r="24"
              fill="none"
              stroke="rgba(15,23,41,0.08)"
              strokeWidth="4"
            />
            <circle
              cx="28"
              cy="28"
              r="24"
              fill="none"
              stroke="var(--piw-primary)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 24}
              strokeDashoffset={
                2 * Math.PI * 24 *
                (1 - Math.min(100, Math.max(0, progress)) / 100)
              }
              style={{
                transformOrigin: "center",
                transform: "rotate(-90deg)",
                transition: "stroke-dashoffset 160ms linear",
              }}
            />
          </svg>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "var(--piw-primary)",
              fontVariantNumeric: "tabular-nums",
              lineHeight: 1,
            }}
          >
            {Math.min(100, Math.max(0, progress))}%
          </span>
        </div>
        <span
          className="absolute"
          style={{
            bottom: "var(--spacing-1-5)",
            left: "var(--spacing-1-5)",
            padding: "1px var(--spacing-1)",
            borderRadius: "var(--radius-xs)",
            background: "#FFFFFF",
            border: "1px solid var(--piw-border)",
            fontWeight: 600,
            fontSize: 9,
            color: "var(--text-secondary)",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          {ext}
        </span>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onCancel(); }}
          aria-label="Cancel upload"
          className="absolute flex items-center justify-center transition-all"
          style={{
            top: "var(--spacing-1-5)",
            right: "var(--spacing-1-5)",
            width: 22,
            height: 22,
            borderRadius: 999,
            background: "rgba(255,255,255,0.95)",
            border: "1px solid var(--piw-border)",
            cursor: "pointer",
            color: "var(--text-secondary)",
            boxShadow: "0 1px 2px rgba(16,24,40,0.10)",
          }}
        >
          <span style={{ fontSize: 12, lineHeight: 1 }}>×</span>
        </button>
      </div>
      <div
        className="flex flex-col w-full"
        style={{ padding: "var(--spacing-1-5) var(--spacing-2) var(--spacing-2)", gap: "var(--spacing-1-5)" }}
      >
        {/* Skeleton row for filename — matches body-sm line height */}
        <div
          aria-hidden
          style={{
            height: "calc(var(--text-body-sm) * 1.3)",
            width: `${60 + ((fileName.length * 7) % 30)}%`,
            maxWidth: "100%",
            borderRadius: 4,
            background:
              "linear-gradient(110deg, var(--surface-secondary) 8%, hsl(210,16%,93%) 18%, var(--surface-secondary) 33%)",
            backgroundSize: "200% 100%",
            animation: "modalAttUploadShimmer 1.2s linear infinite",
          }}
        />
        {/* Skeleton row for size — matches caption line height */}
        <div
          aria-hidden
          style={{
            height: "calc(var(--text-caption) * 1.3)",
            width: 56,
            borderRadius: 4,
            background:
              "linear-gradient(110deg, var(--surface-secondary) 8%, hsl(210,16%,93%) 18%, var(--surface-secondary) 33%)",
            backgroundSize: "200% 100%",
            animation: "modalAttUploadShimmer 1.2s linear infinite",
          }}
        />
        <span className="sr-only" title={fileName}>{fileName}</span>
        <span className="sr-only">{fileSize}</span>
      </div>

      <style>{`@keyframes modalAttUploadShimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
    </div>
  );
}

