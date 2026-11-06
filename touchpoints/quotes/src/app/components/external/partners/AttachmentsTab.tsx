// Shim — minimal placeholder for Partner Management's AttachmentsTab.
// The full attachments surface lives in Partner Management; in Quote/SO we
// only need a non-crashing component + the AttachmentFile type. Safe to
// delete when the canonical AttachmentsTab is portable. Field types are
// kept permissive (string-or-number) to accept the seed shapes used by
// the verbatim source detail modals.
export interface AttachmentFile {
  id: string;
  name: string;
  size?: string | number;
  type?: string;
  date?: string;
  uploadedAt?: string;
  uploadedBy?: string;
  url?: string;
  [key: string]: unknown;
}

interface AttachmentsTabProps {
  files?: AttachmentFile[];
  embedded?: boolean;
}

export function AttachmentsTab({ files = [] }: AttachmentsTabProps) {
  return (
    <div
      className="flex flex-col"
      style={{ padding: 16, gap: 12 }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>Attachments</div>
      <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
        Attachments are configured in the Partner Management module.
      </div>
      {files.length > 0 && (
        <ul className="flex flex-col rounded-lg border border-border bg-white" style={{ overflow: "hidden" }}>
          {files.map((f) => (
            <li key={f.id} style={{ padding: "10px 14px", borderTop: "1px solid var(--border)", fontSize: 12 }}>
              {f.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
