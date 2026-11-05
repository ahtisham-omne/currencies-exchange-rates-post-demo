/**
 * CreateItemAttachmentsField — PI's ModalAttachmentsField UX (paperclip header,
 * dashed drop-zone, progress-ring upload cards) but stores files locally in the
 * form state and fakes the upload progress. No supabase, no thumbnail-selection.
 *
 * Used inside CreateItemModal (Create + Edit modes).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Paperclip, Upload } from "lucide-react";
import { AttachmentCard, THUMB_PREVIEW_H } from "./attachment-card";

interface LocalAttachment {
  id: string;
  file: File;
  url: string;
  uploading: boolean;
  progress: number;
}

interface Props {
  files: File[];
  onFilesChange: (files: File[]) => void;
  label?: string;
  accept?: string;
  maxFiles?: number;
  maxSizeMB?: number;
  hideHeader?: boolean;
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

function fileKey(f: File): string {
  return `${f.name}|${f.size}|${(f as any).lastModified ?? 0}`;
}

export function CreateItemAttachmentsField({
  files,
  onFilesChange,
  label = "Attachments",
  accept = ".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg",
  maxFiles = 20,
  maxSizeMB = 10,
  hideHeader = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [dragActive, setDragActive] = useState(false);

  /* Local UI state — mirrors `files` prop but carries per-file progress/blob
   * URLs. When `files` changes externally (e.g. reset on modal close), we
   * rebuild the local state so the UI matches. */
  const [items, setItems] = useState<LocalAttachment[]>(() =>
    files.map((f) => ({
      id: fileKey(f),
      file: f,
      url: f.type.startsWith("image/") ? URL.createObjectURL(f) : "",
      uploading: false,
      progress: 100,
    })),
  );

  const itemKeys = useMemo(() => items.map((i) => fileKey(i.file)).join(","), [items]);
  const propKeys = useMemo(() => files.map(fileKey).join(","), [files]);
  useEffect(() => {
    if (itemKeys !== propKeys) {
      setItems(
        files.map((f) => {
          const existing = items.find((i) => fileKey(i.file) === fileKey(f));
          if (existing) return existing;
          return {
            id: fileKey(f),
            file: f,
            url: f.type.startsWith("image/") ? URL.createObjectURL(f) : "",
            uploading: false,
            progress: 100,
          };
        }),
      );
    }
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [propKeys]);

  const emitFiles = useCallback(
    (next: LocalAttachment[]) => {
      onFilesChange(next.map((n) => n.file));
    },
    [onFilesChange],
  );

  const patch = useCallback((id: string, next: Partial<LocalAttachment>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...next } : it)));
  }, []);

  const runFakeUpload = useCallback(
    (id: string) => {
      /* Ramp 0 → 100 over 700-1100ms with three ticks so the ring animates
       * visibly. Matches PI's per-file upload feel. */
      const totalMs = 700 + Math.random() * 400;
      const start = performance.now();
      const tick = (now: number) => {
        const elapsed = now - start;
        const pct = Math.min(100, Math.round((elapsed / totalMs) * 100));
        patch(id, { progress: pct });
        if (pct < 100) {
          requestAnimationFrame(tick);
        } else {
          patch(id, { uploading: false, progress: 100 });
        }
      };
      requestAnimationFrame(tick);
    },
    [patch],
  );

  const addFiles = useCallback(
    (list: FileList | File[] | null) => {
      if (!list) return;
      const arr = Array.from(list);
      if (!arr.length) return;
      const room = Math.max(0, maxFiles - items.length);
      const maxBytes = maxSizeMB * 1024 * 1024;
      const accepted = arr
        .filter((f) => f.size <= maxBytes)
        .slice(0, room)
        .map<LocalAttachment>((f) => ({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          file: f,
          url: f.type.startsWith("image/") ? URL.createObjectURL(f) : "",
          uploading: true,
          progress: 0,
        }));
      if (!accepted.length) return;
      const next = [...items, ...accepted];
      setItems(next);
      emitFiles(next);

      requestAnimationFrame(() => {
        const first = accepted[0];
        if (!first) return;
        const el = gridRef.current?.querySelector<HTMLElement>(`[data-att-id="${first.id}"]`);
        el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });

      accepted.forEach((a) => runFakeUpload(a.id));
    },
    [items, maxFiles, maxSizeMB, emitFiles, runFakeUpload],
  );

  const handleRemove = useCallback(
    (id: string) => {
      const found = items.find((a) => a.id === id);
      if (found?.url) URL.revokeObjectURL(found.url);
      const next = items.filter((a) => a.id !== id);
      setItems(next);
      emitFiles(next);
    },
    [items, emitFiles],
  );

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    addFiles(e.dataTransfer.files);
  };

  return (
    <div>
      {!hideHeader && (
        <div className="flex items-center gap-2 mb-2.5">
          <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
            <Paperclip className="w-3.5 h-3.5 text-primary" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>{label}</span>
            {items.length > 0 && (
              <span
                className="text-[10px] text-slate-500 bg-muted px-1.5 py-0.5 rounded-full"
                style={{ fontWeight: 500 }}
              >
                {items.length}
              </span>
            )}
          </div>
        </div>
      )}

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

      {items.length > 0 && (
        <div
          ref={gridRef}
          className="mt-2.5 grid"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "var(--spacing-3)" }}
        >
          {items.map((a) => {
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
                    progress={a.progress}
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
                    filePath: null,
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

/* Placeholder card shown while a file "uploads". Mirrors PI's UploadingCard
 * (progress-ring on shimmering skeleton) but with fake progress.
 * Exported so the Attachments tab can reuse it for Item Library uploads. */
export function UploadingCard({
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
          animation: "createItemAttUploadShimmer 1.2s linear infinite",
        }}
      >
        <div className="relative flex items-center justify-center" style={{ width: 56, height: 56 }}>
          <svg width="56" height="56" viewBox="0 0 56 56" style={{ position: "absolute", inset: 0 }} aria-hidden>
            <circle cx="28" cy="28" r="24" fill="none" stroke="rgba(15,23,41,0.08)" strokeWidth="4" />
            <circle
              cx="28"
              cy="28"
              r="24"
              fill="none"
              stroke="var(--piw-primary)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 24}
              strokeDashoffset={2 * Math.PI * 24 * (1 - Math.min(100, Math.max(0, progress)) / 100)}
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
            animation: "createItemAttUploadShimmer 1.2s linear infinite",
          }}
        />
        <div
          aria-hidden
          style={{
            height: "calc(var(--text-caption) * 1.3)",
            width: 56,
            borderRadius: 4,
            background:
              "linear-gradient(110deg, var(--surface-secondary) 8%, hsl(210,16%,93%) 18%, var(--surface-secondary) 33%)",
            backgroundSize: "200% 100%",
            animation: "createItemAttUploadShimmer 1.2s linear infinite",
          }}
        />
        <span className="sr-only" title={fileName}>{fileName}</span>
        <span className="sr-only">{fileSize}</span>
      </div>

      <style>{`@keyframes createItemAttUploadShimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
    </div>
  );
}
