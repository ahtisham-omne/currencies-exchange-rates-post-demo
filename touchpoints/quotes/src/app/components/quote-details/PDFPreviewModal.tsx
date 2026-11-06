/**
 * PDFPreviewModal — Quote-side wrapper around the shared PdfDocument
 * ─────────────────────────────────────────────────────────────────
 * Previous incarnation was a 686-line dummy PDF layout with hardcoded
 * line items and captions. This is now a thin adapter: caller passes
 * either a full `Quote` (preferred) or the legacy trimmed subset
 * (`{ quoteNumber, customerName, items, subtotal, tax, total, status,
 * version }`), and the modal maps that to the shared `PdfDocumentData`
 * shape that renders via `<PdfDocument>`.
 *
 * The old visibility panel + toggles are preserved conceptually via
 * `visibility` on `PdfDocument`, but the surface here defaults to
 * ALL_ON so the customer-facing preview shows everything unless the
 * caller opts out.
 *
 * When `mode === "print"` the primary CTA fires `window.print()`; when
 * `mode === "download"` it opens the same print dialog (browsers offer
 * "Save as PDF" from print — no external PDF lib needed for the
 * in-app preview + download story).
 */
import { useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom";
import { X, Download, Printer } from "lucide-react";
import { toast } from "sonner";
import { PdfDocument, fmtCurrency, getPdfPageCount } from "../shared/pdfDocument";
import { PrintPageCount } from "../shared/printPages";
import { getQuotePrintAttachments } from "./AttachmentsTab";
import { Switch } from "@/app/components/ui/switch";
import { adaptQuoteToPdfData, type LegacyQuoteInput } from "./quotePdfAdapter";
import type { Quote } from "../../types/quote";

interface PDFPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Preferred: full `Quote` record. Missing fields fall back to
   *  sensible defaults so the preview is never blank. */
  quote?: Quote | LegacyQuoteInput;
  /** Optional richer counterpart: when `QuoteDetails` has resolved
   *  PoC / addresses / dates through state, pass them here for a
   *  fully-populated document. Left blank in listing-level previews. */
  detail?: {
    contactName?: string;
    contactPhone?: string;
    contactEmail?: string;
    salesRepName?: string;
    salesRepContact?: string;
    billingAddress?: { line?: string; cityStateZip?: string; };
    shippingAddress?: { line?: string; cityStateZip?: string; };
    paymentMethod?: string;
    paymentTerms?: string;
    createdDateDisplay?: string;
    expiryDateDisplay?: string;
    requestedDateDisplay?: string;
    deliveryDateDisplay?: string;
  };
  mode?: "download" | "print";
  /** A quote created in the app starts with no attachments, so its
   *  print count adds none until files are attached. */
  isNewlyCreated?: boolean;
}

export function PDFPreviewModal({ isOpen, onClose, quote, detail, mode = "download", isNewlyCreated = false }: PDFPreviewModalProps) {
  const data = useMemo(() => adaptQuoteToPdfData(quote, detail), [quote, detail]);
  /* Include-attachments toggle — when true, the download would bundle
     the quote's attachments alongside the PDF (zip). UI only for now. */
  const [includeAttachments, setIncludeAttachments] = useState(false);
  useEffect(() => { if (isOpen) setIncludeAttachments(false); }, [isOpen]);

  if (!isOpen) return null;

  const isPrint = mode === "print";
  /* Print window page count: the document's pages, plus the quote's
     Include in PDF attachments while the switch is on. */
  const documentPages = getPdfPageCount(data);
  const printAttachments = isPrint ? getQuotePrintAttachments((quote as { quoteNumber?: string } | undefined)?.quoteNumber ?? data.docNumber, isNewlyCreated) : [];
  const primaryLabel = isPrint ? "Print" : "Download PDF";
  const PrimaryIcon = isPrint ? Printer : Download;

  const handlePrimary = () => {
    /* Both actions route through the browser's print dialog, which
       also offers "Save as PDF". Keeps the app self-contained (no
       server-side PDF renderer or headless-chrome roundtrip). Every
       `<PdfPage>` carries `pageBreakAfter: always` so the printed
       output tracks the preview page-for-page. */
    window.print();
    if (mode !== "print") {
      toast.success("PDF ready. Choose 'Save as PDF' in the print dialog.");
    }
  };

  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 9999, backgroundColor: "rgba(15,23,42,0.55)", backdropFilter: "blur(2px)" }}
      onClick={onClose}
    >
      <div
        className="flex flex-col"
        style={{ width: "min(1100px, calc(100vw - 32px))", height: "min(940px, calc(100vh - 32px))", background: "#FFFFFF", borderRadius: 12, overflow: "hidden", boxShadow: "0 24px 80px rgba(15,23,42,0.35)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── title + close, matching Partner modal chrome
            (title on the left, close-only affordance on the right). */}
        <div
          className="shrink-0 flex items-center justify-between"
          style={{ padding: "12px 20px", borderBottom: "1px solid #E2E8F0", background: "#FFFFFF" }}
          data-pdf-toolbar
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#0F172A", lineHeight: 1.2 }}>
              {data.kind === "quote" ? "Quote" : "Sales Order"} preview
            </span>
            <span style={{ fontSize: 11.5, color: "#64748B", marginTop: 2 }}>
              {data.docNumber} · {fmtCurrency(data.grandTotal, data.currency)}
            </span>
          </div>
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center transition-colors"
            style={{ width: 32, height: 32, borderRadius: 8, border: "none", background: "transparent", cursor: "pointer", color: "#94A3B8" }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--muted)"; e.currentTarget.style.color = "#475569"; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.color = "#94A3B8"; }}
            aria-label="Close preview"
          >
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>

        {/* ── Preview scroller ── */}
        <div
          className="flex-1 overflow-y-auto"
          data-pdf-scroll-root
          style={{ background: "#F1F5F9" }}
        >
          {/* Print CSS — hides the toolbar + scroll frame so print output
              is just the paged document. */}
          <style>{`
            @media print {
              body * { visibility: hidden; }
              [data-pdf-scroll-root], [data-pdf-scroll-root] * { visibility: visible; }
              [data-pdf-scroll-root] {
                position: absolute !important;
                top: 0; left: 0; right: 0;
                background: #FFFFFF !important;
                overflow: visible !important;
              }
              [data-pdf-toolbar], [data-pdf-footer] { display: none !important; }
            }
          `}</style>
          <PdfDocument data={data} />
        </div>

        {/* ── Footer ── Include-attachments toggle on the left,
            Cancel + primary CTA anchored bottom-right per Partner
            modal chrome. Print mode drops the toggle. */}
        <div
          className="shrink-0 flex items-center justify-between"
          style={{ padding: "12px 20px", borderTop: "1px solid #E2E8F0", background: "#FFFFFF", gap: 12 }}
          data-pdf-footer
        >
          <div style={{ display: "flex", alignItems: "center" }}>
            <label className="flex items-center gap-2 cursor-pointer select-none" title={isPrint ? "Print the attachments alongside the PDF." : "Include the quote's attachments in the download — they'll be zipped with the PDF."}>
              <Switch
                checked={includeAttachments}
                onCheckedChange={setIncludeAttachments}
                aria-label="Include attachments"
              />
              <span className="text-muted-foreground" style={{ fontSize: 12, fontWeight: 500 }}>
                Include attachments
              </span>
            </label>
          </div>
          {/* Only the primary CTA on the right (the header's X handles
              dismiss). In print mode the page count sits beside it. */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {isPrint && (
            <PrintPageCount documentPages={documentPages} attachments={printAttachments} includeAttachments={includeAttachments} />
          )}
          <button
            onClick={handlePrimary}
            className="inline-flex items-center transition-colors"
            style={{ height: 36, padding: "0 16px", borderRadius: 8, border: "none", background: "#1B6EF3", color: "#FFFFFF", fontSize: 13, fontWeight: 600, cursor: "pointer", gap: 8 }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#0862D0"; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#1B6EF3"; }}
          >
            <PrimaryIcon style={{ width: 14, height: 14 }} />
            {primaryLabel}
          </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
