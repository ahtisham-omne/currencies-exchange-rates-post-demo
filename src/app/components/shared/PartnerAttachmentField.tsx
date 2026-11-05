import React, { useRef, useState } from "react";
import { Paperclip, Upload, Trash2 } from "lucide-react";

/* ════════════════════════════════════════════════════════════════
   PartnerAttachmentField — the full Partner Management attachments
   affordance (dashed drop zone + upload icon + primary/secondary
   text + hint line, plus a file-row list under it).

   Mirrors the block used inside Partner's PocModals /
   CreatePartnerModal so every reason/confirmation modal that
   supports attachments looks and behaves the same.
   ═══════════════════════════════════════════════════════════════ */

interface Props {
  files: File[];
  onChange: (files: File[]) => void;
  hint?: string;
  label?: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(type: string): string {
  if (type.startsWith("image/")) return "🖼️";
  if (type.includes("pdf")) return "📄";
  if (type.includes("spreadsheet") || type.includes("excel")) return "📊";
  if (type.includes("word")) return "📝";
  return "📎";
}

export function PartnerAttachmentField({
  files,
  onChange,
  hint = "PDF, DOC, XLS, PNG, JPG up to 10MB",
  label = "Attachments",
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const next = Array.from(list);
    if (next.length) onChange([...files, ...next]);
  };

  return (
    <div style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: 6,
            background: "rgba(10, 119, 255, 0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Paperclip style={{ width: 12, height: 12, color: "var(--primary)" }} />
        </div>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>{label}</span>
        {files.length > 0 && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 500,
              color: "var(--muted-foreground)",
              background: "var(--muted)",
              padding: "1px 6px",
              borderRadius: 999,
            }}
          >
            {files.length}
          </span>
        )}
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          addFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        style={{
          borderRadius: 10,
          border: `2px dashed ${dragActive ? "var(--primary)" : "var(--border)"}`,
          background: dragActive ? "rgba(10, 119, 255, 0.04)" : "var(--input-background, #fff)",
          padding: "16px 14px",
          textAlign: "center",
          cursor: "pointer",
          transition: "all 150ms",
        }}
        onMouseEnter={(e) => {
          if (dragActive) return;
          e.currentTarget.style.borderColor = "#CBD5E1";
          e.currentTarget.style.backgroundColor = "#FAFBFC";
        }}
        onMouseLeave={(e) => {
          if (dragActive) return;
          e.currentTarget.style.borderColor = "var(--border)";
          e.currentTarget.style.backgroundColor = "var(--input-background, #fff)";
        }}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          style={{ display: "none" }}
          onChange={(e) => {
            addFiles(e.target.files);
            if (e.target) e.target.value = "";
          }}
        />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: dragActive ? "#D6E8FF" : "var(--muted)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: dragActive ? "var(--primary)" : "#94A3B8",
            }}
          >
            <Upload style={{ width: 18, height: 18 }} />
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 500, color: "var(--foreground)", margin: 0 }}>
              <span style={{ color: "var(--primary)" }}>Click to upload</span>
              <span> or drag and drop</span>
            </p>
            <p style={{ fontSize: 11, color: "#94A3B8", margin: "2px 0 0 0" }}>{hint}</p>
          </div>
        </div>
      </div>

      {files.length > 0 && (
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
          {files.map((f, idx) => (
            <div
              key={`${f.name}-${idx}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--input-background, #fff)",
              }}
            >
              <span style={{ fontSize: 16 }}>{fileIcon(f.type)}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: "var(--foreground)",
                    margin: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {f.name}
                </p>
                <p style={{ fontSize: 11, color: "#94A3B8", margin: "1px 0 0 0" }}>{formatFileSize(f.size)}</p>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(files.filter((_, i) => i !== idx));
                }}
                aria-label={`Remove ${f.name}`}
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 6,
                  border: "none",
                  background: "transparent",
                  color: "#94A3B8",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "color 120ms, background-color 120ms",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "var(--destructive)";
                  e.currentTarget.style.backgroundColor = "rgba(220, 38, 38, 0.08)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "#94A3B8";
                  e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                <Trash2 style={{ width: 13, height: 13 }} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default PartnerAttachmentField;
