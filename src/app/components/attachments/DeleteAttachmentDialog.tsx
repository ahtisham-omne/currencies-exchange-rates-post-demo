/**
 * DeleteAttachmentDialog — Shared confirmation dialog used by the
 * AttachmentCard menu and the AttachmentPreviewModal footer.
 * Matches the "Caution" gradient header pattern used elsewhere.
 */
import { Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileName: string;
  onConfirm: () => void;
}

export function DeleteAttachmentDialog({ open, onOpenChange, fileName, onConfirm }: Props) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        onClick={(e) => e.stopPropagation()}
        className="sm:max-w-[400px] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)] !z-[10001]"
      >
        <div
          className="relative flex flex-col items-center pt-10 pb-6"
          style={{ background: "linear-gradient(180deg, hsl(0 93% 94%) 0%, hsla(0,93%,94%,0.3) 70%, transparent 100%)" }}
        >
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25"
            style={{ backgroundColor: "hsl(0 84% 60%)" }}
          />
          <div
            className="relative w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ backgroundColor: "hsl(0 93% 94%)" }}
          >
            <Trash2 className="w-8 h-8" style={{ color: "hsl(0 72% 51%)" }} />
          </div>
          <span
            className="mt-4 px-3 py-1 rounded-full text-[11px]"
            style={{
              fontWeight: 600,
              backgroundColor: "hsl(0 100% 97%)",
              color: "hsl(0 63% 31%)",
              textTransform: "uppercase" as const,
              letterSpacing: "0.05em",
            }}
          >
            Caution
          </span>
        </div>
        <div className="flex flex-col items-center text-center px-8 pb-8">
          <AlertDialogHeader className="p-0 gap-0 text-center">
            <AlertDialogTitle
              className="text-[18px] tracking-[-0.02em]"
              style={{ fontWeight: 600, color: "var(--piw-foreground)" }}
            >
              Delete this attachment?
            </AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogDescription
            className="text-[13px] mt-2 max-w-[300px] mx-auto"
            style={{ color: "var(--text-secondary)", lineHeight: "1.65" }}
          >
            <span style={{ fontWeight: 600, color: "var(--piw-foreground)" }}>
              {fileName}
            </span>{" "}
            will be permanently removed. This action cannot be undone.
          </AlertDialogDescription>
          <div className="w-full mt-7 flex flex-col gap-2.5">
            <AlertDialogAction
              onClick={() => { onOpenChange(false); onConfirm(); }}
              className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90"
              style={{ fontWeight: 600, backgroundColor: "hsl(0 72% 51%)", color: "hsl(0 0% 100%)" }}
            >
              Delete Attachment
            </AlertDialogAction>
            <AlertDialogCancel
              className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
              style={{ fontWeight: 500, backgroundColor: "var(--surface-secondary)", color: "var(--text-secondary)" }}
            >
              Cancel
            </AlertDialogCancel>
          </div>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
