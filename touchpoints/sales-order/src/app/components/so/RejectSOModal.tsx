import { useState } from "react";
import { ThumbsDown } from "lucide-react";
import { ConfirmationModal } from "./ConfirmationModal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PartnerAttachmentField } from "@/app/components/shared/PartnerAttachmentField";
import { SO_REJECTION_REASONS, type SORejectionReason } from "./types";

/**
 * RejectSOModal — approver-only Mark Rejection flow.
 *
 * Wraps Partner-style `ConfirmationModal` (red variant) with a
 * required reason dropdown, comments textarea, and Partner's
 * dashed drop-zone attachment field slotted into the body.
 */

interface Props {
  soNumber: string;
  onConfirm: (reason: SORejectionReason, reasonText: string, attachments: File[]) => void;
  onClose: () => void;
}

export function RejectSOModal({ soNumber, onConfirm, onClose }: Props) {
  const [reason, setReason] = useState<SORejectionReason | "">("");
  const [comments, setComments] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);

  /* Both fields are optional in the reject flow — the approver can
     mark a rejection without picking a specific reason or adding a
     note. The CTA is always enabled. */
  const isOtherReason = reason === "Other";
  const disabled = false;

  return (
    <ConfirmationModal
      isOpen
      title="Mark Rejection"
      message={`Rejects ${soNumber} and sends it back to the sales rep for correction. Any held allocations return to available stock immediately.`}
      confirmText="Mark rejection"
      cancelText="Keep for review"
      variant="red"
      icon={<ThumbsDown />}
      onCancel={onClose}
      onConfirm={() => {
        if (disabled) return;
        onConfirm(reason as SORejectionReason, comments.trim(), attachments);
      }}
      confirmDisabled={disabled}
      slotPosition="before-actions"
      size="wide"
    >
      <label style={{ display: "block", fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", marginBottom: 6 }}>
        Reason
      </label>
      <Select value={reason} onValueChange={(v) => setReason(v as SORejectionReason)}>
        <SelectTrigger className="w-full !bg-white">
          <SelectValue placeholder="Select a reason…" />
        </SelectTrigger>
        <SelectContent className="!bg-white z-[12300]">
          {SO_REJECTION_REASONS.map((r) => (
            <SelectItem key={r} value={r}>{r}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <label style={{ display: "block", fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", marginTop: 12, marginBottom: 6 }}>
        Comments
      </label>
      <textarea
        value={comments}
        onChange={(e) => setComments(e.target.value)}
        placeholder={isOtherReason ? "Type the specific reason (optional)" : "Tell the sales rep what to fix"}
        rows={3}
        style={{
          width: "100%", padding: "10px 12px", fontSize: 13, color: "var(--foreground)",
          border: "1px solid var(--border)", borderRadius: 8, outline: "none",
          backgroundColor: "var(--input-background, #fff)", resize: "vertical", minHeight: 72,
          boxSizing: "border-box", fontFamily: "Inter, system-ui, sans-serif", lineHeight: 1.5,
        }}
      />

      <div style={{ marginTop: 14 }}>
        <PartnerAttachmentField files={attachments} onChange={setAttachments} />
      </div>

      <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 10 }}>
        Reason and comments are logged in activity and stay visible on the reactivated draft.
      </div>
    </ConfirmationModal>
  );
}
