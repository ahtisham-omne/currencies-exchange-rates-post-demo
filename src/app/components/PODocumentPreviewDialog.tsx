import React, { useMemo, useRef } from "react";
import { Download, FileText, Printer, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "./ui/dialog";
import { FONT } from "./designTokens";
import type { PurchaseOrderData, POVersionEntry } from "./poStore";
import { generatePrintHTML } from "./PrintPurchaseOrder";

/* ── Print / Download PO preview ──
   Shows the PO document (generatePrintHTML) inside the app so the buyer
   can check it first. Both modes open the browser's print dialog on that
   document: "Print" for a printer, "Download PDF" for Save as PDF (the
   file name defaults to `PO-<number>`, the document title). Used by the
   PO detail Actions menu (Print / Download PO) and the listing row menu
   (Print PO / Download PDF). */
export function PODocumentPreviewDialog({
  open,
  onOpenChange,
  po,
  version,
  mode = "download",
}: {
  mode?: "print" | "download";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  po: PurchaseOrderData | null;
  version?: POVersionEntry;
}) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const html = useMemo(
    () => (open && po ? generatePrintHTML(po, version, { embedded: true }) : ""),
    [open, po, version],
  );
  const versionLabel = po ? `Version ${version?.version ?? po.currentVersion}` : "";

  const isPrint = mode === "print";
  const ActionIcon = isPrint ? Printer : Download;

  const runPrint = () => {
    const win = frameRef.current?.contentWindow;
    if (!win) return;
    win.focus();
    win.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex flex-col p-0 gap-0 overflow-hidden !max-w-[920px] !w-[calc(100vw-2rem)] h-[88vh] !rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)] [&>button.absolute]:hidden"
        style={{ fontFamily: FONT, backgroundColor: "#FFFFFF" }}
      >
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-border shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "#EFF6FF" }}>
              <FileText className="w-4 h-4" style={{ color: "hsl(var(--primary))" }} />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-foreground truncate" style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.35 }}>
                {isPrint ? "Print" : "Download"} PO {po?.poNumber}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground truncate" style={{ fontSize: 11, lineHeight: 1.4 }}>
                {po?.vendor.name} · {versionLabel}{isPrint ? "" : " · PDF"}
              </DialogDescription>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={runPrint}
              disabled={!po}
              className="rounded-lg inline-flex items-center gap-1.5 h-9 px-4 shadow-sm cursor-pointer hover:opacity-90"
              style={{ backgroundColor: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))", fontSize: 13, fontWeight: 600, border: "none" }}
            >
              <ActionIcon className="w-3.5 h-3.5" />
              {isPrint ? "Print" : "Download PDF"}
            </button>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-50 cursor-pointer"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex-1 min-h-0 bg-slate-100">
          {html && (
            <iframe
              ref={frameRef}
              title={`PO ${po?.poNumber} preview`}
              srcDoc={html}
              className="w-full h-full border-0 bg-white"
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
