/* ═══════════════════════════════════════════════════════════════════
 *  Print page count for the Print window.
 *
 *  The document's own pages come from getPdfPageCount (pdfDocument).
 *  "Include attachments" adds the files marked to go with the PDF
 *  (Quotes: Include in PDF, Sales Orders: In Order). Images print one
 *  per page. Documents print at their length, estimated from file size
 *  because the prototype stores no real page counts. Audio, video, CAD
 *  and links don't print, so they add nothing.
 *
 *  Each module's Attachments tab publishes its live list here, so a
 *  file added, removed or flagged there is counted. Until the tab has
 *  been opened, the Print window falls back to the record's own files.
 *
 *  Kept identical between the Quotes and Sales Order repos.
 * ═══════════════════════════════════════════════════════════════════ */

export interface PrintableAttachment {
  /** File extension or kind: "pdf", "docx", "jpg", "sheet", ... */
  kind: string;
  /** Human-readable size, e.g. "2.4 MB" or "340 KB". */
  size?: string;
}

const IMAGE_KINDS = new Set(["png", "jpg", "jpeg", "gif", "webp", "bmp", "heic"]);
/* Rough KB per printed page, by kind. */
const KB_PER_PAGE: Record<string, number> = {
  pdf: 250,
  doc: 60, docx: 60, txt: 20,
  xlsx: 120, xls: 120, sheet: 120, csv: 40,
};

function sizeInKb(size?: string): number {
  const m = (size ?? "").trim().match(/^([\d.]+)\s*(KB|MB|GB|B)?$/i);
  if (!m) return 0;
  const n = parseFloat(m[1]);
  const unit = (m[2] ?? "KB").toUpperCase();
  return unit === "GB" ? n * 1024 * 1024 : unit === "MB" ? n * 1024 : unit === "B" ? n / 1024 : n;
}

/** Pages one attachment adds to the print job (0 when it can't print). */
export function attachmentPrintPages(a: PrintableAttachment): number {
  const kind = a.kind.toLowerCase();
  if (IMAGE_KINDS.has(kind)) return 1;
  const per = KB_PER_PAGE[kind];
  if (!per) return 0;
  return Math.max(1, Math.ceil(sizeInKb(a.size) / per));
}

export function attachmentsPrintPages(list: PrintableAttachment[]): { pages: number; files: number } {
  let pages = 0;
  let files = 0;
  for (const a of list) {
    const p = attachmentPrintPages(a);
    if (p > 0) { pages += p; files += 1; }
  }
  return { pages, files };
}

/* ── Live list from the Attachments tab, per record ── */
const published = new Map<string, PrintableAttachment[]>();

/** Called by an Attachments tab whenever its PDF-bound files change. */
export function publishPrintAttachments(recordKey: string, list: PrintableAttachment[]) {
  published.set(recordKey, list);
}

/** The tab's live list for this record, if the tab has published one. */
export function getPublishedPrintAttachments(recordKey: string): PrintableAttachment[] | undefined {
  return published.get(recordKey);
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** "6 pages", and with attachments on, "14 pages · 8 from 3 attachments". */
export function PrintPageCount({
  documentPages,
  attachments,
  includeAttachments,
}: {
  documentPages: number;
  attachments: PrintableAttachment[];
  includeAttachments: boolean;
}) {
  const extra = attachmentsPrintPages(attachments);
  const total = documentPages + (includeAttachments ? extra.pages : 0);
  const detail = !includeAttachments
    ? null
    : extra.files === 0
      ? "no attachments to print"
      : `${extra.pages} from ${plural(extra.files, "attachment")}`;
  return (
    <span
      className="text-muted-foreground tabular-nums whitespace-nowrap"
      style={{ fontSize: 12, fontWeight: 500 }}
      aria-live="polite"
      data-print-page-count
    >
      <span className="text-foreground" style={{ fontWeight: 600 }}>{plural(total, "page")}</span>
      {detail && <> · {detail}</>}
    </span>
  );
}
