/**
 * RemoveVendorDialog — the single shared warning modal for removing a qualified
 * vendor from an item. Used both inside the Edit Vendors modal
 * (AddQualifiedVendorModal) and from the Qualified Vendors listing row menu
 * (QVTable → QualifiedVendorsPanel) so the warning + implications copy stays
 * identical wherever a vendor is removed.
 *
 * Presentational only: the caller owns the pending-vendor state and performs the
 * actual removal in `onConfirm`.
 */
import { Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface RemoveVendorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Vendor being removed; drives the title/body copy. */
  vendorName?: string;
  /** When true, adds the "auto-PO default moves" implication line. */
  isDefault?: boolean;
  /** Commit the removal. The dialog is the gate; this runs on confirm. */
  onConfirm: () => void;
}

export function RemoveVendorDialog({
  open,
  onOpenChange,
  vendorName,
  isDefault = false,
  onConfirm,
}: RemoveVendorDialogProps) {
  const name = vendorName ?? "this vendor";
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-[420px] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)]">
        <div className="relative flex flex-col items-center pt-10 pb-6" style={{ background: "linear-gradient(180deg, #FEF2F2 0%, rgba(254,242,242,0.3) 70%, transparent 100%)" }}>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25" style={{ backgroundColor: "#EF4444" }} />
          <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "#FEE2E2" }}>
            <Trash2 className="w-8 h-8" style={{ color: "hsl(var(--destructive))" }} />
          </div>
          <span className="mt-4 px-3 py-1 rounded-full text-[11px]" style={{ fontWeight: 600, backgroundColor: "#FEF2F2", color: "#991B1B", textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>
            Remove Vendor
          </span>
        </div>
        <div className="flex flex-col items-center text-center px-8 pb-8">
          <AlertDialogHeader className="p-0 gap-0 text-center sm:text-center">
            <AlertDialogTitle className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600, color: "hsl(var(--foreground))" }}>
              {vendorName ? `Remove ${vendorName}?` : "Remove this vendor?"}
            </AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogDescription asChild>
            <div className="text-[13px] mt-2 max-w-[360px] mx-auto" style={{ color: "hsl(var(--muted-foreground))", lineHeight: "1.65" }}>
              <p>Removing {name} changes how this item can be sourced. Here is what happens.</p>
              <ul className="mt-3 text-left rounded-lg border border-border bg-slate-50 px-3.5 py-2.5 space-y-1.5">
                <li className="flex items-start gap-2">
                  <span className="mt-[7px] w-1 h-1 rounded-full bg-slate-400 shrink-0" />
                  <span className="text-[12.5px] text-slate-600">Its pricing, freight, and pricing-rule setup for this item is discarded.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-[7px] w-1 h-1 rounded-full bg-slate-400 shrink-0" />
                  <span className="text-[12.5px] text-slate-600">Its priority rank is freed; the remaining vendors keep their order.</span>
                </li>
                {isDefault && (
                  <li className="flex items-start gap-2">
                    <span className="mt-[7px] w-1 h-1 rounded-full bg-slate-400 shrink-0" />
                    <span className="text-[12.5px] text-slate-600">It is the default vendor, so the auto-PO default moves to another Priority 1 vendor.</span>
                  </li>
                )}
                <li className="flex items-start gap-2">
                  <span className="mt-[7px] w-1 h-1 rounded-full bg-slate-400 shrink-0" />
                  <span className="text-[12.5px] text-slate-600">You can add it back later from Browse Vendors; past transactions and history stay intact.</span>
                </li>
              </ul>
            </div>
          </AlertDialogDescription>
          <div className="w-full mt-7 flex flex-col gap-2.5">
            <AlertDialogAction
              onClick={onConfirm}
              className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90"
              style={{ fontWeight: 600, backgroundColor: "hsl(var(--destructive))", color: "#fff" }}
            >
              Remove vendor
            </AlertDialogAction>
            <AlertDialogCancel
              className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
              style={{ fontWeight: 500, backgroundColor: "hsl(var(--muted))", color: "#334155" }}
            >
              Keep vendor
            </AlertDialogCancel>
          </div>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
