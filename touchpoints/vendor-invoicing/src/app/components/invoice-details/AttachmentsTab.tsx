import { TableEmptyState } from '@/app/components/ui/table-empty-state';
import { findSearchSuggestion } from '@/app/utils/searchSuggestion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { localTodayIso } from '@/app/lib/dueBucket';
import { AttachmentPreviewModal } from './AttachmentPreviewModal';
import type { Invoice } from '@/app/data/mockInvoices';
import type { Payment } from '@/app/data/mockPayments';
import type { PaymentRun } from '@/app/data/paymentRuns';
import type { CustomerInvoice } from '@/app/data/ar/mockCustomerInvoices';
import {
  Search,
  X,
  Upload,
  LayoutGrid,
  List,
  AlignJustify,
  MoreVertical,
  ChevronDown,
  Check,
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  Paperclip,
  Download,
  Eye,
  Trash2,
  Package,
  Building2,
  Lock,
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/app/components/ui/dialog';
import { SearchableUserPicker } from '@/app/components/vendors/SearchableUserPicker';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/app/components/ui/alert-dialog';
import { toast } from 'sonner';
import { highlightText } from '@/app/components/InvoiceDataTable';
import { EmptyState } from '@/app/components/EmptyState';
import { DestructiveConfirmDialog } from '@/app/components/DestructiveConfirmDialog';

// Attachments tab — the canonical partner-detail density + card pattern
// (partner-management-module › AttachmentsTab). Pulled here "same to
// same" so the invoice attachments view matches the partner reference:
// a three-tier density selector (Condensed / Comfort / Card) with a
// card-size sub-menu under the Card tier, tinted thumbnails with a faded
// type icon + subtle type badge, and an inline footer actions menu.
//
// Vendor-side extras kept on top of the shared design: drag-and-drop
// upload, a delete-confirmation dialog, a 25 MB per-file limit, and
// invoice-flavored seed data.

type FileKind = 'pdf' | 'doc' | 'img' | 'xlsx' | 'other';

/** Where the file came from — rendered as the colored pill on the card
 *  (cycle count card recipe, 10/1/26): 'record' files belong to this
 *  invoice/payment/run, 'linked' files rode in from a procurement
 *  document, 'vendor' files are the vendor's library documents. */
interface AttachmentSource {
  label: string;
  kind: 'record' | 'linked' | 'vendor';
}

interface Attachment {
  id: string;
  name: string;
  uploadedBy: string;
  date: string; // ISO YYYY-MM-DD
  /** Real upload moment (BA 10/10): the card shows this time, not a
   *  synthesized one. */
  at?: string;
  sizeBytes: number;
  kind: FileKind;
  /** Object URL when the real file came through the picker (9/22/26
   *  review response, GPT F13): previewable in-page. Seeds have none. */
  previewUrl?: string;
  previewMime?: string;
  source?: AttachmentSource;
  /** True while the shimmer upload card animates (cycle count port). */
  uploading?: boolean;
  /** Access restriction (GPT QC24, 9/30 — S11): absent/empty = the file
   *  inherits the record's access; ids = only those roles/users open it.
   *  Prototype-local enforcement only. */
  restrictedTo?: string[];
}

// ONE attachment contract everywhere (GPT U2, 9/30: this surface took a
// .txt and a 10MB+1 file while every upload drop-zone teaches "PDF, DOC,
// XLS, PNG, JPG up to 10MB") — the taught rule is the enforced rule.
const MAX_SIZE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'png', 'jpg', 'jpeg'];

// Uploads survive tab switches and navigation (9/22/26 review response,
// GPT F12): the record's attachment list lives in a session store keyed
// by record id, not in the tab's own mount-scoped state. The deliberate
// boot reset (8/13/26) still clears it with everything else.
const SESSION_ATTACHMENTS = new Map<string, Attachment[]>();

function detectKind(name: string): FileKind {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (ext === 'pdf') return 'pdf';
  if (['doc', 'docx', 'rtf', 'txt'].includes(ext)) return 'doc';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'heic'].includes(ext)) return 'img';
  if (['xls', 'xlsx', 'csv', 'ods'].includes(ext)) return 'xlsx';
  return 'other';
}

// Type → color/bg/label/icon. Keyed off the shared theme CSS vars so the
// thumbnail tint, faded icon, and badge all derive from one hue — exactly
// the partner recipe.
function getFileTypeInfo(kind: FileKind, name: string) {
  const ext = name.split('.').pop()?.toUpperCase() || '';
  switch (kind) {
    case 'pdf':
      return { color: 'hsl(var(--destructive))', bg: '#FEF2F2', label: 'PDF', Icon: FileText };
    case 'doc':
      return { color: '#2563EB', bg: '#EFF6FF', label: 'DOC', Icon: FileText };
    case 'img':
      return { color: 'hsl(var(--violet))', bg: '#F5F3FF', label: ext, Icon: ImageIcon };
    case 'xlsx':
      return { color: 'hsl(var(--success))', bg: '#ECFDF5', label: 'XLSX', Icon: FileSpreadsheet };
    default:
      return { color: '#64748B', bg: '#F8FAFC', label: ext || 'FILE', Icon: FileText };
  }
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function formatHumanDate(iso: string) {
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${MONTH_SHORT[parseInt(m, 10) - 1] || m} ${parseInt(d, 10)}, ${y}`;
}

// Sum displayed sizes into one aggregate label.
function aggregateSize(items: Attachment[]): string {
  const totalBytes = items.reduce((s, a) => s + a.sizeBytes, 0);
  return formatSize(totalBytes);
}

// Deterministic business-hours time per file — the model only stores a
// date, but the cycle count card shows date AND time, so each file gets
// a stable synthesized clock reading.
function timeFor(a: Attachment): string {
  if (a.at) {
    const d = new Date(a.at);
    if (!Number.isNaN(d.getTime())) {
      const hr = d.getHours();
      return `${hr % 12 === 0 ? 12 : hr % 12}:${String(d.getMinutes()).padStart(2, '0')} ${hr >= 12 ? 'PM' : 'AM'}`;
    }
  }
  let h = 0;
  for (let i = 0; i < a.id.length; i++) h = (h * 31 + a.id.charCodeAt(i)) >>> 0;
  for (let i = 0; i < a.name.length; i++) h = (h * 31 + a.name.charCodeAt(i)) >>> 0;
  const hour24 = 8 + (h % 10); // 8 AM .. 5 PM
  // Unsigned shift (BA 10/10): the signed one went negative, "8:-11 AM".
  const minute = (h >>> 4) % 60;
  const ampm = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${String(minute).padStart(2, '0')} ${ampm}`;
}

// ─── Cycle-count card internals (render-companion port, 10/1/26) ─────────
//
// The thumbnail renders believable CONTENT, not a watermark icon: a mock
// document page for PDFs/DOCs, a mock sheet for XLSX/CSV, the real image
// when the file came through the picker. Styling values are this
// module's own (slate text ramp, border tokens, brand blue).

const MOCK_DOC_SECTIONS = [
  { heading: '1. Overview', body: 'This document describes the contents and intent of the attached file. It is provided for in-app preview only. Download the original for the canonical version with full formatting, embedded objects, and revision history.' },
  { heading: '2. Scope', body: 'The attached material covers vendor invoicing, receiving reconciliation, payment terms, and settlement workflows for this record. It supersedes all prior revisions.' },
];

function DocumentThumb({ kind, name, bg, color }: { kind: FileKind; name: string; bg: string; color: string }) {
  if (kind === 'xlsx') {
    const gridLine = '#E2E8F0';
    const COLS = 7;
    const CELLS: Record<number, Record<number, { text: string; bold?: boolean; size?: number; color?: string }>> = {
      1: { 1: { text: 'Invoice Report', bold: true, size: 8, color: '#1E293B' } },
      2: { 1: { text: 'Vendor billing · FY 2026', size: 5.5, color: '#94A3B8' } },
      6: { 1: { text: 'OVERVIEW', bold: true, size: 5.5, color: '#0A77FF' } },
      8: { 1: { text: 'INV', bold: true, size: 5.5 }, 2: { text: 'INV-000002', size: 5, color: '#475569' }, 3: { text: 'Acme Supplies', size: 5, color: '#475569' } },
      10: { 1: { text: 'INV', bold: true, size: 5.5 }, 2: { text: 'INV-000003', size: 5, color: '#475569' }, 3: { text: 'Atlantic Elec.', size: 5, color: '#475569' } },
      12: { 1: { text: 'INV', bold: true, size: 5.5 }, 2: { text: 'INV-000005', size: 5, color: '#475569' }, 3: { text: 'Coastal Log.', size: 5, color: '#475569' } },
    };
    return (
      <div className="w-full h-full bg-white relative overflow-hidden">
        <table className="w-full" style={{ borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: 14 }} />
            {Array.from({ length: COLS }).map((_, i) => <col key={i} />)}
          </colgroup>
          <thead>
            <tr>
              <th style={{ background: '#F1F5F9', border: `1px solid ${gridLine}`, height: 8 }} />
              {Array.from({ length: COLS }).map((_, i) => (
                <th key={i} style={{ background: '#F1F5F9', border: `1px solid ${gridLine}`, color: '#64748B', fontSize: 5, fontWeight: 600, height: 8, padding: 0, textAlign: 'center' }}>
                  {String.fromCharCode(65 + i)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 14 }).map((_, r) => {
              const rowNum = r + 1;
              const banded = rowNum === 6;
              return (
                <tr key={r}>
                  <td style={{ background: '#F1F5F9', border: `1px solid ${gridLine}`, color: '#64748B', fontSize: 5, fontWeight: 500, textAlign: 'center', padding: 0, height: 10 }}>{rowNum}</td>
                  {Array.from({ length: COLS }).map((_, c) => {
                    const cell = CELLS[rowNum]?.[c];
                    return (
                      <td key={c} style={{ border: `1px solid ${gridLine}`, background: banded ? '#F0F7FF' : 'white', padding: '0 3px', height: 10, fontSize: cell?.size ?? 5, fontWeight: cell?.bold ? 700 : 400, color: cell?.color ?? '#1E293B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {cell?.text ?? ''}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="absolute left-0 right-0 bottom-0 h-[40%] pointer-events-none" style={{ background: 'linear-gradient(to bottom, rgba(248,250,252,0) 0%, rgba(241,245,249,0.9) 80%)' }} />
      </div>
    );
  }
  if (kind === 'pdf' || kind === 'doc') {
    return (
      <div className="w-full h-full bg-white relative overflow-hidden text-foreground" style={{ padding: '10px 12px 0 12px' }}>
        <div className="whitespace-nowrap overflow-hidden text-ellipsis" style={{ fontSize: 7.5, fontWeight: 700, lineHeight: 1.35, marginBottom: 3 }}>
          {name.replace(/\.[^.]+$/, '') || 'Document'}
        </div>
        <div className="overflow-hidden text-slate-400" style={{ fontSize: 5.5, lineHeight: 1.5, marginBottom: 5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>
          Internal document for accounts payable operations. Preview rendering, download the original for the canonical version.
        </div>
        {MOCK_DOC_SECTIONS.map((s, i) => (
          <div key={i} style={{ marginBottom: 4 }}>
            <div style={{ fontSize: 6, fontWeight: 600, lineHeight: 1.35, marginBottom: 2 }}>{s.heading}</div>
            <div className="text-slate-600" style={{ fontSize: 5.5, lineHeight: 1.6, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as const }}>{s.body}</div>
          </div>
        ))}
        <div className="absolute left-0 right-0 bottom-0 h-[40%] pointer-events-none" style={{ background: 'linear-gradient(to bottom, rgba(248,250,252,0) 0%, rgba(241,245,249,0.9) 80%)' }} />
      </div>
    );
  }
  if (kind === 'img') {
    return (
      <div className="flex items-center justify-center w-full h-full" style={{ background: bg }}>
        <ImageIcon className="w-8 h-8" style={{ color, opacity: 0.5 }} />
      </div>
    );
  }
  return (
    <div className="flex items-center justify-center w-full h-full" style={{ background: bg }}>
      <FileText className="w-7 h-7" style={{ color, opacity: 0.5 }} />
    </div>
  );
}

// Source pill tints — blue for this record's own documents, neutral for
// linked procurement docs and vendor library files (cycle count keeps
// the classifying pill in a different family from entity tags).
function sourcePillClasses(kind: AttachmentSource['kind']) {
  if (kind === 'record') return 'bg-blue-50 border-blue-200 text-blue-700';
  return 'bg-slate-50 border-border text-slate-500';
}

function SourcePill({ source }: { source: AttachmentSource }) {
  const Icon = source.kind === 'record' ? Paperclip : source.kind === 'linked' ? Package : Building2;
  return (
    <span
      className={`inline-flex items-center gap-[3px] max-w-full px-1.5 rounded-full border truncate text-[10px] ${sourcePillClasses(source.kind)}`}
      style={{ paddingTop: 1, paddingBottom: 1, fontWeight: 500 }}
      title={source.label}
    >
      <Icon className="w-2.5 h-2.5 shrink-0" />
      {source.label}
    </span>
  );
}

// Shimmer placeholder shown while an upload "lands" (cycle count port):
// animated gradient thumb with a circular progress dial, then the real
// card takes its place.
function UploadingCard({ ext, previewH, onDone }: { ext: string; previewH: string; onDone: () => void }) {
  const [progress, setProgress] = useState(8);
  useEffect(() => {
    const t = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) return p;
        return Math.min(100, p + 9 + Math.random() * 14);
      });
    }, 110);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (progress >= 100) {
      const t = setTimeout(onDone, 180);
      return () => clearTimeout(t);
    }
  }, [progress, onDone]);
  const R = 24;
  const C = 2 * Math.PI * R;
  return (
    <div className="relative flex flex-col rounded-xl border border-border bg-white overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div
        className={`relative shrink-0 w-full ${previewH} flex items-center justify-center overflow-hidden`}
        style={{ background: 'linear-gradient(110deg, #F1F5F9 8%, #E2E8F0 18%, #F1F5F9 33%)', backgroundSize: '200% 100%', animation: 'attUploadShimmer 1.2s linear infinite' }}
      >
        <div className="relative flex items-center justify-center w-14 h-14">
          <svg width="56" height="56" viewBox="0 0 56 56" className="absolute inset-0" aria-hidden>
            <circle cx="28" cy="28" r={R} fill="none" stroke="rgba(15,23,42,0.08)" strokeWidth="4" />
            <circle
              cx="28" cy="28" r={R} fill="none" stroke="hsl(var(--primary))" strokeWidth="4" strokeLinecap="round"
              strokeDasharray={C} strokeDashoffset={C * (1 - Math.min(100, progress) / 100)}
              style={{ transformOrigin: 'center', transform: 'rotate(-90deg)', transition: 'stroke-dashoffset 160ms linear' }}
            />
          </svg>
          <span className="text-[11px] text-primary" style={{ fontWeight: 700 }}>{Math.min(100, Math.round(progress))}%</span>
        </div>
        <span className="absolute bottom-1.5 left-1.5 px-1 rounded bg-white border border-border text-[9px] tracking-wide text-slate-500" style={{ paddingTop: 1, paddingBottom: 1, fontWeight: 600 }}>
          {ext}
        </span>
      </div>
      <div className="flex flex-col w-full px-2 pt-1.5 pb-2 gap-1.5">
        <div className="h-[14px] w-[70%] rounded" style={{ background: 'linear-gradient(110deg, #F1F5F9 8%, #E2E8F0 18%, #F1F5F9 33%)', backgroundSize: '200% 100%', animation: 'attUploadShimmer 1.2s linear infinite' }} />
        <div className="h-[11px] w-14 rounded" style={{ background: 'linear-gradient(110deg, #F1F5F9 8%, #E2E8F0 18%, #F1F5F9 33%)', backgroundSize: '200% 100%', animation: 'attUploadShimmer 1.2s linear infinite' }} />
      </div>
      <style>{`@keyframes attUploadShimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
    </div>
  );
}

const ATTACH_DENSITY_CONFIG = [
  { key: 'condensed' as const, label: 'Condensed', description: 'Compact list view', icon: 'align-justify' },
  { key: 'comfort' as const, label: 'Comfort', description: 'Relaxed list view', icon: 'list' },
  { key: 'card' as const, label: 'Card', description: 'Thumbnail grid', icon: 'layout-grid' },
];

// Seed attachments derived from THIS invoice (design feedback 7/9 —
// the previous generic samples read as random files): the vendor's
// bill, its linked procurement documents, and the vendor agreements.
// Real uploads prepend to this list at runtime.
// Offset a yyyy-mm-dd date by whole days (deterministic per file).
function shiftDate(iso: string, days: number) {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function seedAttachmentsFor(invoice: Invoice): Attachment[] {
  const seed = invoice.invoiceNumber.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
  const vendorSlug = invoice.vendor.split(' ')[0].replace(/[^A-Za-z0-9]/g, '');
  const size = (base: number, i: number) => base + ((seed + i * 37) % 900) * 1000;
  const shift = shiftDate;
  const base = invoice.invoiceDate || invoice.date;
  // No invented vendor invoice PDF on ANY record (BA 10/10): an invoice
  // document appears only when someone uploaded one.
  const files: Attachment[] = [];
  (invoice.linkedPOs ?? []).slice(0, 2).forEach((po, i) => {
    files.push({ id: `a-po-${i}`, name: `PO_${po}.pdf`, date: shift(base, -(7 + i * 3)), sizeBytes: size(420_000, 2 + i), uploadedBy: invoice.createdBy, kind: 'pdf', source: { label: `PO ${po}`, kind: 'linked' } });
  });
  (invoice.linkedGRNs ?? []).slice(0, 1).forEach((grn, i) => {
    files.push(
      { id: `a-grn-${i}`, name: `Receiving_Note_${grn}.pdf`, date: shift(base, -2), sizeBytes: size(510_000, 4 + i), uploadedBy: invoice.createdBy, kind: 'pdf', source: { label: grn, kind: 'linked' } },
      { id: `a-ps-${i}`, name: `Packing_Slip_${grn}.docx`, date: shift(base, -2), sizeBytes: size(280_000, 5 + i), uploadedBy: 'Warehouse Intake', kind: 'doc', source: { label: grn, kind: 'linked' } },
    );
  });
  files.push(
    { id: 'a-pa', name: `Pricing_Agreement_${vendorSlug}.xlsx`, date: shift(base, -30), sizeBytes: size(760_000, 6), uploadedBy: 'Elena Volkov', kind: 'xlsx', source: { label: 'Vendor Library', kind: 'vendor' } },
    { id: 'a-mc', name: `Master_Contract_${vendorSlug}.pdf`, date: shift(base, -60), sizeBytes: size(2_400_000, 7), uploadedBy: 'Daniel Adams', kind: 'pdf', source: { label: 'Vendor Library', kind: 'vendor' } },
  );
  // Files the user attached on the record itself — e.g. inside Edit Invoice
  // (VI-13) — surface as invoice documents so the tab keeps them after Save.
  const userDocs: Attachment[] = (invoice.attachments ?? []).map((name, i) => ({
    id: `a-user-${i}`,
    name,
    date: invoice.updatedDate || base,
    sizeBytes: invoice.attachmentSizes?.[name] ?? size(300_000, 10 + i),
    uploadedBy: invoice.updatedBy || invoice.createdBy,
    kind: detectKind(name),
    source: { label: 'Invoice Document', kind: 'record' as const },
  }));
  // Invoices created in the app show ONLY what the user attached (user
  // 10/10): no invented invoice PDF, PO copies or vendor library files.
  // Documents added with an exception or hold at creation count too.
  if (invoice.isUserCreated) {
    const flagDocs: Attachment[] = (invoice.actionHistory ?? []).flatMap((e, k) =>
      (e.attachments ?? []).map((name, i) => ({
        id: `a-hist-${k}-${i}`,
        name,
        date: (e.at || base).slice(0, 10),
        sizeBytes: size(260_000, 20 + k + i),
        uploadedBy: e.by || invoice.createdBy,
        kind: detectKind(name),
        source: { label: e.action === 'paymentHold' ? 'Payment Hold' : e.action === 'flagException' ? 'Exception' : 'Invoice Document', kind: 'record' as const },
      })),
    );
    const seen = new Set(userDocs.map((d) => d.name));
    return [...userDocs, ...flagDocs.filter((d) => !seen.has(d.name))];
  }
  return [...userDocs, ...files];
}

// Payment/prepayment-flavored seed, same recipe as the invoice one:
// the documents an AP clerk would actually pin to a payment record.
function seedAttachmentsForPayment(payment: Payment): Attachment[] {
  // Recorded in this session (id pmt-<timestamp>-<n>): nothing was
  // attached, so nothing is invented (user 10/10).
  if (/^pmt-\d{13}-\d+$/.test(payment.id)) return [];
  const seed = payment.paymentNumber.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
  const vendorSlug = payment.vendor.split(' ')[0].replace(/[^A-Za-z0-9]/g, '');
  const size = (base: number, i: number) => base + ((seed + i * 37) % 900) * 1000;
  const base = payment.paymentDate;
  const files: Attachment[] = [
    { id: 'p-1', name: `Remittance_Advice_${payment.paymentNumber}.pdf`, date: base, sizeBytes: size(640_000, 1), uploadedBy: payment.createdBy, kind: 'pdf', source: { label: 'Payment Document', kind: 'record' } },
  ];
  if (payment.reference) {
    files.push({ id: 'p-ref', name: `Bank_Confirmation_${payment.reference}.pdf`, date: base, sizeBytes: size(380_000, 2), uploadedBy: payment.createdBy, kind: 'pdf', source: { label: 'Payment Document', kind: 'record' } });
  }
  if (payment.linkedPO) {
    files.push({ id: 'p-po', name: `PO_${payment.linkedPO}.pdf`, date: shiftDate(base, -7), sizeBytes: size(420_000, 3), uploadedBy: payment.createdBy, kind: 'pdf', source: { label: `PO ${payment.linkedPO}`, kind: 'linked' } });
  }
  files.push(
    { id: 'p-appr', name: `Payment_Approval_${payment.paymentNumber}.docx`, date: shiftDate(base, -1), sizeBytes: size(240_000, 4), uploadedBy: 'Daniel Adams', kind: 'doc', source: { label: 'Payment Document', kind: 'record' } },
    { id: 'p-mc', name: `Master_Contract_${vendorSlug}.pdf`, date: shiftDate(base, -60), sizeBytes: size(2_400_000, 5), uploadedBy: 'Daniel Adams', kind: 'pdf', source: { label: 'Vendor Library', kind: 'vendor' } },
  );
  return files;
}

// Payment-run flavor (8/4/26): the run's REAL per-vendor attachments from
// the Configure step, no invented seeds. Sizes come from the file picker
// when the user uploaded through it; older names fall back to a
// deterministic size so the rows still read complete.
function seedAttachmentsForRun(run: PaymentRun): Attachment[] {
  const seed = run.id.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
  const base = run.createdAt.split('T')[0];
  return run.groups.flatMap((g, gi) =>
    (g.attachments ?? []).map((a, i) => ({
      id: `r-${gi}-${i}`,
      name: a.name,
      uploadedBy: run.createdBy,
      date: base,
      sizeBytes: a.size ?? 120_000 + ((seed + gi * 53 + i * 37) % 900) * 1000,
      kind: detectKind(a.name),
      source: { label: g.vendor, kind: 'vendor' as const },
    })),
  );
}

// AR mirror of the invoice seed — the customer-side documents a billing
// clerk would pin to a receivable: the issued invoice, its sales order
// and shipment papers, and the customer agreement.
function seedAttachmentsForCustomer(ci: CustomerInvoice): Attachment[] {
  const seed = ci.invoiceNumber.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
  const customerSlug = ci.customer.split(' ')[0].replace(/[^A-Za-z0-9]/g, '');
  const size = (base: number, i: number) => base + ((seed + i * 37) % 900) * 1000;
  const base = ci.invoiceDate || ci.createdDate;
  const files: Attachment[] = [
    { id: 'c-1', name: `Customer_Invoice_${ci.invoiceNumber}.pdf`, date: base, sizeBytes: size(880_000, 1), uploadedBy: ci.createdBy, kind: 'pdf', source: { label: 'Invoice Document', kind: 'record' } },
  ];
  (ci.linkedSOs ?? []).slice(0, 2).forEach((so, i) => {
    files.push({ id: `c-so-${i}`, name: `Sales_Order_${so}.pdf`, date: shiftDate(base, -(10 + i * 3)), sizeBytes: size(430_000, 2 + i), uploadedBy: ci.createdBy, kind: 'pdf', source: { label: so, kind: 'linked' } });
  });
  (ci.linkedShipments ?? []).slice(0, 1).forEach((sh, i) => {
    files.push(
      { id: `c-sh-${i}`, name: `Shipment_Manifest_${sh}.pdf`, date: shiftDate(base, -2), sizeBytes: size(500_000, 4 + i), uploadedBy: 'Warehouse Dispatch', kind: 'pdf', source: { label: sh, kind: 'linked' } },
      { id: `c-bol-${i}`, name: `Bill_of_Lading_${sh}.docx`, date: shiftDate(base, -2), sizeBytes: size(270_000, 5 + i), uploadedBy: 'Warehouse Dispatch', kind: 'doc', source: { label: sh, kind: 'linked' } },
    );
  });
  files.push(
    { id: 'c-pa', name: `Pricing_Schedule_${customerSlug}.xlsx`, date: shiftDate(base, -30), sizeBytes: size(720_000, 6), uploadedBy: 'Elena Volkov', kind: 'xlsx', source: { label: 'Customer Library', kind: 'vendor' } },
    { id: 'c-msa', name: `Service_Agreement_${customerSlug}.pdf`, date: shiftDate(base, -60), sizeBytes: size(2_100_000, 7), uploadedBy: 'Daniel Adams', kind: 'pdf', source: { label: 'Customer Library', kind: 'vendor' } },
  );
  return files;
}

type Density = 'condensed' | 'comfort' | 'card';
type CardSize = 'small' | 'medium' | 'large';

export function AttachmentsTab({
  invoice,
  payment,
  run,
  customerInvoice,
  currentUser = 'Ahtisham Ahmad',
}: {
  /** Invoice context (invoice detail) — seeds bill + procurement docs. */
  invoice?: Invoice;
  /** Payment context (payment detail) — seeds remittance + banking docs. */
  payment?: Payment;
  /** Payment run context (run detail) — the run's real vendor attachments. */
  run?: PaymentRun;
  /** AR invoice context (customer invoice detail) — seeds the issued
   *  invoice + sales order/shipment docs (10/1/26 four-tab standard). */
  customerInvoice?: CustomerInvoice;
  currentUser?: string;
}) {
  const storeKey = invoice ? `inv-${invoice.id}` : payment ? `pmt-${payment.id}` : run ? `run-${run.id}` : customerInvoice ? `cinv-${customerInvoice.id}` : 'none';
  const [attachments, setAttachmentsState] = useState<Attachment[]>(() => {
    const cached = SESSION_ATTACHMENTS.get(storeKey);
    if (cached) {
      // Files saved on the record since the last visit (create / Edit,
      // BA 10/10) join the cached list instead of being lost.
      if (invoice && (invoice.attachments ?? []).length > 0) {
        const have = new Set(cached.map((a) => a.name));
        const fresh = seedAttachmentsFor(invoice).filter((a) => a.source?.kind === 'record' && !have.has(a.name));
        if (fresh.length > 0) {
          const merged = [...fresh, ...cached];
          SESSION_ATTACHMENTS.set(storeKey, merged);
          return merged;
        }
      }
      return cached;
    }
    const seeded = invoice
      ? seedAttachmentsFor(invoice)
      : payment
        ? seedAttachmentsForPayment(payment)
        : run
          ? seedAttachmentsForRun(run)
          : customerInvoice
            ? seedAttachmentsForCustomer(customerInvoice)
            : [];
    SESSION_ATTACHMENTS.set(storeKey, seeded);
    return seeded;
  });
  const setAttachments = (updater: (prev: Attachment[]) => Attachment[]) =>
    setAttachmentsState((prev) => {
      const next = updater(prev);
      SESSION_ATTACHMENTS.set(storeKey, next);
      return next;
    });
  const [search, setSearch] = useState('');
  const [pendingDelete, setPendingDelete] = useState<Attachment | null>(null);
  const [dragging, setDragging] = useState(false);
  // Upload problems stay visible under the Upload control (BA 10/10).
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [density, setDensity] = useState<Density>('card');
  const [cardSize, setCardSize] = useState<CardSize>('medium');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const today = localTodayIso();
    const added: Attachment[] = [];
    const errors: string[] = [];
    Array.from(files).forEach((f) => {
      const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
      if (!ACCEPTED_EXTENSIONS.includes(ext)) {
        errors.push(`${f.name} is not an accepted type. Use PDF, DOC, XLS, PNG or JPG.`);
        return;
      }
      if (f.size > MAX_SIZE_BYTES) {
        errors.push(`${f.name} is over the 10 MB limit.`);
        return;
      }
      const kind = detectKind(f.name);
      const previewable = kind === 'pdf' || kind === 'img' || /\.(png|jpe?g|gif|webp|pdf)$/i.test(f.name);
      added.push({
        id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: f.name,
        uploadedBy: currentUser,
        date: today,
        at: new Date().toISOString(),
        sizeBytes: f.size,
        kind,
        // Real files preview in-page (9/22/26, GPT F13).
        previewUrl: previewable ? URL.createObjectURL(f) : undefined,
        previewMime: f.type || undefined,
        source: { label: payment ? 'Payment Document' : run ? 'Run Document' : 'Invoice Document', kind: 'record' },
        uploading: true,
      });
    });
    setUploadError(errors.length > 0 ? errors.join(' ') : null);
    if (added.length > 0) {
      setAttachments((prev) => [...added, ...prev]);
      toast.success(`${added.length} file${added.length === 1 ? '' : 's'} uploaded.`);
    }
  };

  const onPickFiles = () => inputRef.current?.click();

  const filtered = useMemo(() => {
    if (!search.trim()) return attachments;
    const q = search.trim().toLowerCase();
    return attachments.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.uploadedBy.toLowerCase().includes(q) ||
        getFileTypeInfo(a.kind, a.name).label.toLowerCase().includes(q),
    );
  }, [attachments, search]);

  // Every file previews now (cycle count port, 10/1/26): real uploads
  // show their actual bytes, seeds render the mock document/spreadsheet
  // viewers instead of refusing with a toast.
  const [previewFile, setPreviewFile] = useState<Attachment | null>(null);
  const handlePreview = (a: Attachment) => setPreviewFile(a);
  // Restriction editor (GPT QC24): the file menu's "Restrict access"
  // opens the module's recipients picker; saving stamps the file, and
  // resetting returns it to inherited record access.
  const [restrictTarget, setRestrictTarget] = useState<Attachment | null>(null);
  const [restrictDraft, setRestrictDraft] = useState<Set<string>>(new Set());
  const openRestrict = (a: Attachment) => {
    setRestrictDraft(new Set(a.restrictedTo ?? []));
    setRestrictTarget(a);
  };
  const saveRestrict = () => {
    if (!restrictTarget) return;
    const ids = Array.from(restrictDraft);
    setAttachments((prev) => prev.map((a) => (a.id === restrictTarget.id ? { ...a, restrictedTo: ids.length ? ids : undefined } : a)));
    toast.success(
      ids.length ? 'Access restricted' : 'Access reset to inherited',
      { description: ids.length ? `${restrictTarget.name} opens only for the selected people.` : `${restrictTarget.name} follows the record's access again.` },
    );
    setRestrictTarget(null);
  };
  const markUploaded = (id: string) =>
    setAttachments((prev) => prev.map((a) => (a.id === id ? { ...a, uploading: false } : a)));
  const handleDownload = (a: Attachment) => {
    if (a.previewUrl) {
      const link = document.createElement('a');
      link.href = a.previewUrl;
      link.download = a.name;
      link.click();
    } else {
      // Seeds have no bytes behind them — download the preview text so
      // the action still completes (cycle count behavior).
      const blob = new Blob([`${a.name}\n\nPreview export. Upload the original file for the canonical version.`], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = a.name;
      link.click();
      URL.revokeObjectURL(url);
    }
    toast.success('Download started', { description: a.name });
  };

  const isCondensed = density === 'condensed';
  const isComfort = density === 'comfort';
  const isCard = density === 'card';

  const sizeLabel = aggregateSize(attachments);
  // No files yet: no toolbar, just the empty state + drop zone (user 10/10).
  const isEmpty = attachments.length === 0;

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false); }}
      onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
      // Empty: the Activity tab's dashed empty card, and the whole card is
      // a drop zone that turns blue while a file hovers (user 10/10).
      className={
        isEmpty
          ? `rounded-xl border border-dashed bg-white flex flex-col items-center justify-center py-4 transition-colors ${dragging ? 'border-primary bg-blue-50/40' : 'border-slate-200'}`
          : `bg-white border border-border rounded-xl overflow-hidden flex flex-col transition-colors ${dragging ? 'ring-2 ring-primary/40' : ''}`
      }
      // Fills the column to the bottom of the viewport (user 10/1),
      // matching the other detail tabs' 16px bottom gutter.
      style={{ minHeight: 'max(400px, calc(100vh - 269px))' }}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="application/pdf,image/png,image/jpeg,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
        onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
      />

      {isEmpty ? (
        <div className="flex flex-col items-center">
          <EmptyState
            icon={dragging ? Upload : Paperclip}
            title={dragging ? 'Drop to upload' : 'No attachments yet'}
            description={
              dragging
                ? 'Release the files to attach them.'
                : `Files added to this ${payment ? 'payment' : run ? 'run' : 'invoice'} will live here, ready to preview, download, or share.`
            }
          />
          {/* Secondary blue CTA, the module's outline-primary button. */}
          <button
            type="button"
            onClick={onPickFiles}
            className="inline-flex items-center justify-center h-8 gap-1.5 px-3 -mt-2 rounded-lg bg-white border border-primary text-primary hover:bg-primary/5 hover:shadow-sm transition-all duration-150 cursor-pointer text-xs"
            style={{ fontWeight: 500 }}
          >
            <Upload className="w-3.5 h-3.5" />
            Upload Files
          </button>
          <p className="text-[11px] text-slate-400 mt-2">or drag and drop files here · PDF, DOC, XLS, PNG, JPG up to 10MB</p>
          {uploadError && (
            <p className="text-[11px] text-red-600 mt-1.5 max-w-sm text-center" style={{ fontWeight: 500 }}>{uploadError}</p>
          )}
        </div>
      ) : (
      <>
      {/* Toolbar */}
      <div className="px-4 py-3 flex items-center gap-3 border-b border-muted shrink-0">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50 pointer-events-none" />
          <input
            type="text"
            placeholder="Search attachments..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-8 text-sm rounded-lg border border-border/80 bg-white shadow-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <span className="text-sm ml-auto" style={{ fontWeight: 500 }}>
          <span className="text-foreground">{filtered.length}</span>
          <span className="text-muted-foreground/70"> {filtered.length === 1 ? 'file' : 'files'} · {sizeLabel}</span>
        </span>

        {/* Density dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center justify-center h-9 gap-2 px-3 rounded-lg border border-border bg-white text-foreground shadow-sm hover:bg-muted/40 transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              {isCondensed && <AlignJustify className="w-[18px] h-[18px] text-muted-foreground/80" />}
              {isComfort && <List className="w-[18px] h-[18px] text-muted-foreground/80" />}
              {isCard && <LayoutGrid className="w-[18px] h-[18px] text-muted-foreground/80" />}
              <span className="text-sm hidden md:inline" style={{ fontWeight: 500 }}>
                {ATTACH_DENSITY_CONFIG.find((d) => d.key === density)?.label}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/60" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[230px] p-1.5 z-[200]">
            {ATTACH_DENSITY_CONFIG.map((opt) => (
              <DropdownMenuItem
                key={opt.key}
                className="flex items-center gap-3 py-2.5 px-3 cursor-pointer rounded-md"
                onSelect={(e) => { if (opt.key === 'card') e.preventDefault(); setDensity(opt.key); }}
              >
                {opt.icon === 'align-justify' && <AlignJustify className="w-5 h-5 text-muted-foreground shrink-0" />}
                {opt.icon === 'list' && <List className="w-5 h-5 text-muted-foreground shrink-0" />}
                {opt.icon === 'layout-grid' && <LayoutGrid className="w-5 h-5 text-muted-foreground shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="text-sm" style={{ fontWeight: 500 }}>{opt.label}</div>
                  <div className="text-xs text-muted-foreground">{opt.description}</div>
                </div>
                {density === opt.key && <Check className="w-4 h-4 shrink-0" style={{ color: 'hsl(var(--primary))' }} />}
              </DropdownMenuItem>
            ))}
            {isCard && (
              <>
                <div className="mx-2 my-1.5 border-t border-muted" />
                <div className="px-3 py-1.5">
                  <p className="text-[10px] text-slate-400 mb-2" style={{ fontWeight: 600 }}>Card Size</p>
                  <div className="flex items-center gap-1.5">
                    {(['large', 'medium', 'small'] as const).map((size) => (
                      <button
                        key={size}
                        onClick={() => setCardSize(size)}
                        className={`flex-1 py-1.5 rounded-md text-[11px] text-center transition-all cursor-pointer ${cardSize === size ? 'bg-primary text-white shadow-sm' : 'bg-muted text-slate-500 hover:bg-border'}`}
                        style={{ fontWeight: cardSize === size ? 600 : 500 }}
                      >
                        {size === 'large' ? 'Large' : size === 'medium' ? 'Medium' : 'Small'}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Upload CTA */}
        <button
          onClick={onPickFiles}
          className="inline-flex items-center justify-center h-9 gap-1.5 px-3.5 rounded-lg bg-primary text-white shadow-sm hover:bg-primary/90 transition-colors cursor-pointer text-sm"
          style={{ fontWeight: 500 }}
        >
          <Upload className="w-4 h-4" />
          Upload
        </button>
      </div>
      {uploadError && (
        <p className="px-4 py-2 text-[11px] text-red-600 border-b border-red-100 bg-red-50/50 text-right" style={{ fontWeight: 500 }}>{uploadError}</p>
      )}

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Card View */}
        {isCard && filtered.length > 0 && (
          <div
            className={`grid gap-4 ${
              cardSize === 'large'
                ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                : cardSize === 'small'
                  ? 'grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'
                  : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'
            }`}
          >
            {filtered.map((file) => {
              const info = getFileTypeInfo(file.kind, file.name);
              const previewH = cardSize === 'large' ? 'h-[160px]' : cardSize === 'small' ? 'h-[100px]' : 'h-[130px]';
              if (file.uploading) {
                return <UploadingCard key={file.id} ext={info.label} previewH={previewH} onDone={() => markUploaded(file.id)} />;
              }
              const hasImagePreview = !!file.previewUrl && (file.kind === 'img' || file.previewMime?.startsWith('image/'));
              return (
                <div
                  key={file.id}
                  onClick={() => handlePreview(file)}
                  className="group relative flex flex-col min-w-0 rounded-xl bg-white border border-border hover:border-blue-200 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1),0_2px_4px_-2px_rgba(0,0,0,0.1)] transition-[border-color,box-shadow] duration-150 cursor-pointer"
                >
                  {/* Thumbnail — real content, not a watermark icon (cycle
                      count port): mock page/sheet for docs, the actual
                      image for picker uploads. */}
                  <div className={`relative shrink-0 w-full ${previewH} overflow-hidden rounded-t-[11px]`} style={{ background: info.bg }}>
                    {hasImagePreview ? (
                      <img src={file.previewUrl} alt={file.name} className="w-full h-full object-cover block" />
                    ) : (
                      <DocumentThumb kind={file.kind} name={file.name} bg={info.bg} color={info.color} />
                    )}
                    <span
                      className="absolute bottom-1.5 left-1.5 z-[2] px-1 rounded bg-white border border-border text-[9px] tracking-wide"
                      style={{ paddingTop: 1, paddingBottom: 1, fontWeight: 600, color: info.color, boxShadow: hasImagePreview ? '0 1px 2px rgba(0,0,0,0.2)' : undefined }}
                    >
                      {info.label}
                    </span>
                    {/* Lock badge — the file is restricted (GPT QC24). */}
                    {(file.restrictedTo?.length ?? 0) > 0 && (
                      <span
                        className="absolute top-1.5 right-1.5 z-[2] inline-flex items-center justify-center w-5 h-5 rounded-md bg-white border border-amber-200"
                        title={`Restricted to ${file.restrictedTo!.length} selected ${file.restrictedTo!.length === 1 ? 'person or role' : 'people and roles'}`}
                      >
                        <Lock className="w-3 h-3 text-amber-600" />
                      </span>
                    )}
                    {hasImagePreview && (
                      <div className="absolute inset-0 hidden group-hover:flex items-center justify-center bg-black/25 pointer-events-none">
                        <Eye className="w-5 h-5 text-white/90" />
                      </div>
                    )}
                  </div>

                  {/* Body — source pill, filename, date + time, size · uploader. */}
                  <div className={`flex items-start w-full gap-1 ${cardSize === 'small' ? 'px-2 pt-1.5 pb-2' : 'px-2.5 pt-2 pb-2.5'}`}>
                    <div className="flex flex-col flex-1 min-w-0 gap-1">
                      {file.source && cardSize !== 'small' && (
                        <div className="flex flex-wrap items-center gap-1">
                          <SourcePill source={file.source} />
                        </div>
                      )}
                      <p className={`${cardSize === 'small' ? 'text-[11px]' : 'text-[12px]'} text-foreground truncate leading-snug m-0`} style={{ fontWeight: 500 }} title={file.name}>
                        {/* Name + uploader are searchable, so they highlight (10/9/26). */}
                        {highlightText(file.name, search)}
                      </p>
                      <div className="flex flex-col" style={{ gap: 1 }}>
                        <p className={`${cardSize === 'small' ? 'text-[10px]' : 'text-[11px]'} text-slate-400 truncate leading-snug m-0`}>
                          {formatHumanDate(file.date)} {timeFor(file)}
                        </p>
                        <p className={`${cardSize === 'small' ? 'text-[10px]' : 'text-[11px]'} text-slate-400 truncate leading-snug m-0`} title={`${formatSize(file.sizeBytes)} · ${file.uploadedBy}`}>
                          {formatSize(file.sizeBytes)} · {highlightText(file.uploadedBy, search)}
                        </p>
                      </div>
                    </div>
                    <div onClick={(e) => e.stopPropagation()} className="shrink-0 mt-px">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="flex items-center justify-center w-[22px] h-[22px] rounded hover:bg-sky-50 text-slate-500 transition-all cursor-pointer opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100">
                            <MoreVertical className="w-3.5 h-3.5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[170px] z-[200]">
                          <DropdownMenuItem onClick={() => handlePreview(file)}>
                            <Eye className="w-3.5 h-3.5 mr-2" /> Preview
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDownload(file)}>
                            <Download className="w-3.5 h-3.5 mr-2" /> Download
                          </DropdownMenuItem>
                          {/* Restriction choice (GPT QC24, 9/30 — S11). */}
                          <DropdownMenuItem onClick={() => openRestrict(file)}>
                            <Lock className="w-3.5 h-3.5 mr-2" /> Restrict access
                          </DropdownMenuItem>
                          {/* Delete reads red at rest AND on hover, icon included (user 10/10). */}
                          <DropdownMenuItem onClick={() => setPendingDelete(file)} className="text-red-600 focus:text-red-700 focus:bg-red-50 data-[highlighted]:bg-red-50 data-[highlighted]:text-red-700">
                            <Trash2 className="w-3.5 h-3.5 mr-2 text-red-600" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Condensed List View */}
        {isCondensed && filtered.length > 0 && (
          <div className="border border-border bg-white rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-muted">
                  <th className="text-left text-[11px] text-slate-400 px-4 py-2" style={{ fontWeight: 600 }}>File Name</th>
                  <th className="text-left text-[11px] text-slate-400 px-4 py-2 w-[80px]" style={{ fontWeight: 600 }}>Size</th>
                  <th className="text-left text-[11px] text-slate-400 px-4 py-2 hidden md:table-cell" style={{ fontWeight: 600 }}>Date</th>
                  <th className="text-left text-[11px] text-slate-400 px-4 py-2 hidden md:table-cell" style={{ fontWeight: 600 }}>Uploaded By</th>
                  <th className="w-[36px]" />
                </tr>
              </thead>
              <tbody>
                {filtered.filter((f) => !f.uploading).map((file) => {
                  const info = getFileTypeInfo(file.kind, file.name);
                  return (
                    <tr key={file.id} className="border-b border-muted last:border-b-0 hover:bg-slate-50 transition-colors group">
                      <td className="px-4 py-1.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: info.bg }}>
                            <info.Icon className="w-3.5 h-3.5" style={{ color: info.color }} />
                          </div>
                          <span className="text-[12px] text-slate-700 truncate" style={{ fontWeight: 500 }}>{highlightText(file.name, search)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-1.5"><span className="text-[11px] text-slate-500">{formatSize(file.sizeBytes)}</span></td>
                      <td className="px-4 py-1.5 hidden md:table-cell"><span className="text-[11px] text-slate-500 whitespace-nowrap">{formatHumanDate(file.date)} {timeFor(file)}</span></td>
                      <td className="px-4 py-1.5 hidden md:table-cell"><span className="text-[11px] text-slate-500">{highlightText(file.uploadedBy, search)}</span></td>
                      <td className="px-2 py-1.5">
                        <AttachmentActions file={file} onPreview={handlePreview} onDownload={handleDownload} onDelete={setPendingDelete} iconSize="w-3.5 h-3.5" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Comfort List View */}
        {isComfort && filtered.length > 0 && (
          <div className="border border-border bg-white rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-muted">
                  <th className="text-left text-[11px] text-slate-400 px-4 py-2.5" style={{ fontWeight: 600 }}>File Name</th>
                  <th className="text-left text-[11px] text-slate-400 px-4 py-2.5 w-[80px]" style={{ fontWeight: 600 }}>Size</th>
                  <th className="text-left text-[11px] text-slate-400 px-4 py-2.5 hidden md:table-cell" style={{ fontWeight: 600 }}>Date</th>
                  <th className="text-left text-[11px] text-slate-400 px-4 py-2.5 hidden md:table-cell" style={{ fontWeight: 600 }}>Uploaded By</th>
                  <th className="w-[40px]" />
                </tr>
              </thead>
              <tbody>
                {filtered.filter((f) => !f.uploading).map((file) => {
                  const info = getFileTypeInfo(file.kind, file.name);
                  return (
                    <tr key={file.id} className="border-b border-muted last:border-b-0 hover:bg-slate-50 transition-colors group">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: info.bg }}>
                            <info.Icon className="w-[18px] h-[18px]" style={{ color: info.color }} />
                          </div>
                          <div className="min-w-0">
                            <span className="text-[12px] text-slate-700 truncate block" style={{ fontWeight: 500 }}>{highlightText(file.name, search)}</span>
                            <span className="text-[11px] text-slate-400">{formatSize(file.sizeBytes)}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3"><span className="text-[12px] text-slate-500">{formatSize(file.sizeBytes)}</span></td>
                      <td className="px-4 py-3 hidden md:table-cell"><span className="text-[12px] text-slate-500 whitespace-nowrap">{formatHumanDate(file.date)} {timeFor(file)}</span></td>
                      <td className="px-4 py-3 hidden md:table-cell"><span className="text-[12px] text-slate-500">{highlightText(file.uploadedBy, search)}</span></td>
                      <td className="px-2 py-3">
                        <AttachmentActions file={file} onPreview={handlePreview} onDownload={handleDownload} onDelete={setPendingDelete} iconSize="w-4 h-4" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Search with no hits: the shared empty state (user 10/10). */}
        {filtered.length === 0 && (
          /* Table Empty & Error States Standard (11/3/26), compact in a tab. */
          <TableEmptyState
            compact
            kind="no-results"
            entity={{ singular: 'attachment', plural: 'attachments' }}
            searchQuery={search}
            suggestion={findSearchSuggestion(search, attachments.flatMap((a) => [a.name, a.uploadedBy, getFileTypeInfo(a.kind, a.name).label]))}
            onApplySuggestion={setSearch}
            onClearSearch={() => setSearch('')}
          />
        )}
      </div>
      </>
      )}

      {/* Delete confirm in the modal design language (user 10/10). */}
      <DestructiveConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(open) => { if (!open) setPendingDelete(null); }}
        icon={Trash2}
        pill="Delete Attachment"
        title="Delete this attachment?"
        description={
          <>
            <span className="text-foreground" style={{ fontWeight: 500 }}>{pendingDelete?.name}</span> is removed from this {payment ? 'payment' : run ? 'run' : 'invoice'}. This cannot be undone.
          </>
        }
        confirmLabel="Delete Attachment"
        cancelLabel="Keep Attachment"
        onConfirm={() => {
          if (pendingDelete) {
            setAttachments((prev) => prev.filter((a) => a.id !== pendingDelete.id));
            toast.success(`${pendingDelete.name} deleted.`);
            setPendingDelete(null);
          }
        }}
      />

      {/* Access restriction editor (GPT QC24, 9/30 — S11): files inherit
          the record's access by default; this dialog restricts a file to
          selected roles/users, with a one-click reset to inherited. */}
      <Dialog open={!!restrictTarget} onOpenChange={(o) => { if (!o) setRestrictTarget(null); }}>
        <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-[480px] rounded-2xl p-0 overflow-hidden gap-0">
          <div className="px-5 pt-4 pb-3 border-b border-slate-100">
            <DialogTitle className="text-[15px] text-foreground flex items-center gap-2" style={{ fontWeight: 600 }}>
              <span className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
                <Lock className="w-4 h-4 text-amber-600" />
              </span>
              Restrict access · {restrictTarget?.name}
            </DialogTitle>
            <DialogDescription className="text-[12px] text-slate-500 mt-1">
              This file inherits the record's access. Pick roles or people to limit who can open it; leaving the list empty keeps inherited access.
            </DialogDescription>
          </div>
          <div className="px-5 py-4">
            <SearchableUserPicker
              selectedIds={restrictDraft}
              onSelectionChange={setRestrictDraft}
              label="Who Can Open This File"
              accentColor="#B45309"
              accentBg="#FFFBEB"
              accentBorder="#FDE68A"
              accentText="#B45309"
            />
          </div>
          <div className="px-5 py-3.5 border-t border-slate-100 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setRestrictDraft(new Set())}
              className="text-[12px] text-slate-500 hover:text-foreground hover:underline cursor-pointer"
              style={{ fontWeight: 500 }}
            >
              Reset to Inherited Access
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setRestrictTarget(null)}
                className="h-9 px-3.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-[12px] cursor-pointer transition-colors"
                style={{ fontWeight: 500 }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveRestrict}
                className="h-9 px-3.5 rounded-lg bg-primary hover:bg-[#0862D0] text-white text-[12px] cursor-pointer transition-colors"
                style={{ fontWeight: 600 }}
              >
                Save Access
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cycle-count lightbox (10/1/26): header meta, zoomable image
          viewer, mock document/spreadsheet viewers for seeds, full-view
          toggle, footer delete/download. */}
      {previewFile && (() => {
        const info = getFileTypeInfo(previewFile.kind, previewFile.name);
        return (
          <AttachmentPreviewModal
            attachment={{
              id: previewFile.id,
              name: previewFile.name,
              size: formatSize(previewFile.sizeBytes),
              typeLabel: info.label,
              color: info.color,
              bg: info.bg,
              uploadedBy: previewFile.uploadedBy,
              dateLabel: `${formatHumanDate(previewFile.date)} ${timeFor(previewFile)}`,
              previewUrl: previewFile.previewUrl,
              previewMime: previewFile.previewMime,
            }}
            onClose={() => setPreviewFile(null)}
            onDelete={() => {
              setAttachments((prev) => prev.filter((a) => a.id !== previewFile.id));
              toast.success(`${previewFile.name} deleted.`);
              setPreviewFile(null);
            }}
          />
        );
      })()}
    </div>
  );
}

// Shared row actions menu for the list (Condensed / Comfort) views.
function AttachmentActions({
  file,
  onPreview,
  onDownload,
  onDelete,
  iconSize,
}: {
  file: Attachment;
  onPreview: (f: Attachment) => void;
  onDownload: (f: Attachment) => void;
  onDelete: (f: Attachment) => void;
  iconSize: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="p-1 rounded hover:bg-muted/60 text-muted-foreground/40 hover:text-foreground transition-colors cursor-pointer opacity-0 group-hover:opacity-100">
          <MoreVertical className={iconSize} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[150px] z-[200]">
        <DropdownMenuItem onClick={() => onPreview(file)}>
          <Eye className="w-3.5 h-3.5 mr-2" /> Preview
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onDownload(file)}>
          <Download className="w-3.5 h-3.5 mr-2" /> Download
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onDelete(file)} className="text-red-600 focus:text-red-700 focus:bg-red-50 data-[highlighted]:bg-red-50 data-[highlighted]:text-red-700">
          <Trash2 className="w-3.5 h-3.5 mr-2 text-red-600" /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
