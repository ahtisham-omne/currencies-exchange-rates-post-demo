import { useMemo, useRef, useState } from 'react';
import type { Invoice } from '@/app/data/mockInvoices';
import type { Payment } from '@/app/data/mockPayments';
import type { PaymentRun } from '@/app/data/paymentRuns';
import type { RMA } from '@/app/data/mockRMAs';
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
} from 'lucide-react';
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
import { AttachmentsTab as RMAAttachmentsTab } from '@/app/components/rma/AttachmentsTab';
import { rmaAttachments, rmaAttachmentLines } from '@/app/components/rma/rmaAttachments';

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

interface Attachment {
  id: string;
  name: string;
  uploadedBy: string;
  date: string; // ISO YYYY-MM-DD
  sizeBytes: number;
  kind: FileKind;
}

const MAX_SIZE_BYTES = 25 * 1024 * 1024;

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
  const files: Attachment[] = [
    { id: 'a-1', name: `Vendor_Invoice_${invoice.vendorInvoiceNumber}.pdf`, date: base, sizeBytes: size(900_000, 1), uploadedBy: invoice.createdBy, kind: 'pdf' },
  ];
  (invoice.linkedPOs ?? []).slice(0, 2).forEach((po, i) => {
    files.push({ id: `a-po-${i}`, name: `PO_${po}.pdf`, date: shift(base, -(7 + i * 3)), sizeBytes: size(420_000, 2 + i), uploadedBy: invoice.createdBy, kind: 'pdf' });
  });
  (invoice.linkedGRNs ?? []).slice(0, 1).forEach((grn, i) => {
    files.push(
      { id: `a-grn-${i}`, name: `Receiving_Note_${grn}.pdf`, date: shift(base, -2), sizeBytes: size(510_000, 4 + i), uploadedBy: invoice.createdBy, kind: 'pdf' },
      { id: `a-ps-${i}`, name: `Packing_Slip_${grn}.docx`, date: shift(base, -2), sizeBytes: size(280_000, 5 + i), uploadedBy: 'Warehouse Intake', kind: 'doc' },
    );
  });
  files.push(
    { id: 'a-pa', name: `Pricing_Agreement_${vendorSlug}.xlsx`, date: shift(base, -30), sizeBytes: size(760_000, 6), uploadedBy: 'Elena Volkov', kind: 'xlsx' },
    { id: 'a-mc', name: `Master_Contract_${vendorSlug}.pdf`, date: shift(base, -60), sizeBytes: size(2_400_000, 7), uploadedBy: 'Daniel Adams', kind: 'pdf' },
  );
  return files;
}

// Payment/prepayment-flavored seed, same recipe as the invoice one:
// the documents an AP clerk would actually pin to a payment record.
function seedAttachmentsForPayment(payment: Payment): Attachment[] {
  const seed = payment.paymentNumber.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
  const vendorSlug = payment.vendor.split(' ')[0].replace(/[^A-Za-z0-9]/g, '');
  const size = (base: number, i: number) => base + ((seed + i * 37) % 900) * 1000;
  const base = payment.paymentDate;
  const files: Attachment[] = [
    { id: 'p-1', name: `Remittance_Advice_${payment.paymentNumber}.pdf`, date: base, sizeBytes: size(640_000, 1), uploadedBy: payment.createdBy, kind: 'pdf' },
  ];
  if (payment.reference) {
    files.push({ id: 'p-ref', name: `Bank_Confirmation_${payment.reference}.pdf`, date: base, sizeBytes: size(380_000, 2), uploadedBy: payment.createdBy, kind: 'pdf' });
  }
  if (payment.linkedPO) {
    files.push({ id: 'p-po', name: `PO_${payment.linkedPO}.pdf`, date: shiftDate(base, -7), sizeBytes: size(420_000, 3), uploadedBy: payment.createdBy, kind: 'pdf' });
  }
  files.push(
    { id: 'p-appr', name: `Payment_Approval_${payment.paymentNumber}.docx`, date: shiftDate(base, -1), sizeBytes: size(240_000, 4), uploadedBy: 'Daniel Adams', kind: 'doc' },
    { id: 'p-mc', name: `Master_Contract_${vendorSlug}.pdf`, date: shiftDate(base, -60), sizeBytes: size(2_400_000, 5), uploadedBy: 'Daniel Adams', kind: 'pdf' },
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
      uploadedBy: `${run.createdBy} · ${g.vendor}`,
      date: base,
      sizeBytes: a.size ?? 120_000 + ((seed + gi * 53 + i * 37) % 900) * 1000,
      kind: detectKind(a.name),
    })),
  );
}

type Density = 'condensed' | 'comfort' | 'card';
type CardSize = 'small' | 'medium' | 'large';

export function AttachmentsTab({
  invoice,
  payment,
  run,
  rma,
  currentUser = 'Ahtisham Ahmad',
}: {
  /** Invoice context (invoice detail) — seeds bill + procurement docs. */
  invoice?: Invoice;
  /** Payment context (payment detail) — seeds remittance + banking docs. */
  payment?: Payment;
  /** Payment run context (run detail) — the run's real vendor attachments. */
  run?: PaymentRun;
  /** RMA context — when present, we render the rma.attachments list
   *  (item #13) instead of the invoice-flavoured seed data. */
  rma?: RMA;
  currentUser?: string;
}) {
  // RMA mode renders the ported Purchase Order attachments tab, which
  // carries its own folder rail, views, filters and per-line picker.
  if (rma) {
    return <RMAAttachmentsTab attachments={rmaAttachments(rma)} lines={rmaAttachmentLines(rma)} rmaStatus={rma.status} rmaId={rma.id} />;
  }

  const [attachments, setAttachments] = useState<Attachment[]>(() =>
    invoice ? seedAttachmentsFor(invoice) : payment ? seedAttachmentsForPayment(payment) : run ? seedAttachmentsForRun(run) : [],
  );
  const [search, setSearch] = useState('');
  const [pendingDelete, setPendingDelete] = useState<Attachment | null>(null);
  const [dragging, setDragging] = useState(false);
  const [density, setDensity] = useState<Density>('card');
  const [cardSize, setCardSize] = useState<CardSize>('medium');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const today = new Date().toISOString().split('T')[0];
    const added: Attachment[] = [];
    Array.from(files).forEach((f) => {
      if (f.size > MAX_SIZE_BYTES) {
        toast.error(`${f.name} exceeds the 25 MB limit.`);
        return;
      }
      added.push({
        id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: f.name,
        uploadedBy: currentUser,
        date: today,
        sizeBytes: f.size,
        kind: detectKind(f.name),
      });
    });
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

  const handlePreview = (a: Attachment) => toast.info(`Preview ${a.name}, coming next PR.`);
  const handleDownload = (a: Attachment) => toast.info(`Download ${a.name}, coming next PR.`);

  const isCondensed = density === 'condensed';
  const isComfort = density === 'comfort';
  const isCard = density === 'card';

  const sizeLabel = aggregateSize(attachments);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
      className={`bg-white border border-border rounded-xl overflow-hidden flex flex-col transition-colors ${dragging ? 'ring-2 ring-primary/40' : ''}`}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="application/pdf,image/png,image/jpeg,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
        onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
      />

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
        <span className="text-sm tabular-nums ml-auto" style={{ fontWeight: 500 }}>
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
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-2" style={{ fontWeight: 600 }}>Card Size</p>
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
              const iconSz = cardSize === 'large' ? 'w-12 h-12' : cardSize === 'small' ? 'w-8 h-8' : 'w-10 h-10';
              return (
                <div key={file.id} className="group rounded-xl border border-border bg-white overflow-hidden hover:shadow-md hover:border-slate-300 transition-all">
                  <button
                    type="button"
                    onClick={() => handlePreview(file)}
                    className={`relative ${previewH} w-full flex items-center justify-center cursor-pointer`}
                    style={{ backgroundColor: info.bg }}
                    aria-label={`Preview ${file.name}`}
                  >
                    <info.Icon className={iconSz} style={{ color: info.color, opacity: 0.35 }} />
                    <span
                      className="absolute top-2.5 right-2.5 px-1.5 py-0.5 rounded text-[10px] tracking-wide"
                      style={{ fontWeight: 700, color: info.color, backgroundColor: `${info.color}15`, border: `1px solid ${info.color}25` }}
                    >
                      {info.label}
                    </span>
                  </button>
                  <div className={cardSize === 'large' ? 'px-4 pt-3 pb-3.5' : cardSize === 'small' ? 'px-2.5 pt-2 pb-2.5' : 'px-3 pt-2.5 pb-3'}>
                    <div className="flex items-start justify-between gap-1 mb-1">
                      <span className={`${cardSize === 'small' ? 'text-[11px]' : 'text-[12px]'} text-foreground truncate leading-tight`} style={{ fontWeight: 500 }} title={file.name}>
                        {file.name}
                      </span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="shrink-0 p-0.5 rounded hover:bg-muted/60 text-muted-foreground/50 hover:text-foreground transition-colors cursor-pointer opacity-0 group-hover:opacity-100">
                            <MoreVertical className="w-3.5 h-3.5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[150px] z-[200]">
                          <DropdownMenuItem onClick={() => handlePreview(file)}>
                            <Eye className="w-3.5 h-3.5 mr-2" /> Preview
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDownload(file)}>
                            <Download className="w-3.5 h-3.5 mr-2" /> Download
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setPendingDelete(file)} className="text-destructive focus:text-destructive">
                            <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <p className={`${cardSize === 'small' ? 'text-[10px]' : 'text-[11px]'} text-slate-400 leading-tight`}>{formatHumanDate(file.date)}</p>
                    <p className={`${cardSize === 'small' ? 'text-[10px]' : 'text-[11px]'} text-slate-400 leading-tight truncate`} title={`${formatSize(file.sizeBytes)} · ${file.uploadedBy}`}>
                      {formatSize(file.sizeBytes)} · {file.uploadedBy}
                    </p>
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
                {filtered.map((file) => {
                  const info = getFileTypeInfo(file.kind, file.name);
                  return (
                    <tr key={file.id} className="border-b border-muted last:border-b-0 hover:bg-slate-50 transition-colors group">
                      <td className="px-4 py-1.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: info.bg }}>
                            <info.Icon className="w-3.5 h-3.5" style={{ color: info.color }} />
                          </div>
                          <span className="text-[12px] text-slate-700 truncate" style={{ fontWeight: 500 }}>{file.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-1.5"><span className="text-[11px] text-slate-500">{formatSize(file.sizeBytes)}</span></td>
                      <td className="px-4 py-1.5 hidden md:table-cell"><span className="text-[11px] text-slate-500">{formatHumanDate(file.date)}</span></td>
                      <td className="px-4 py-1.5 hidden md:table-cell"><span className="text-[11px] text-slate-500">{file.uploadedBy}</span></td>
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
                {filtered.map((file) => {
                  const info = getFileTypeInfo(file.kind, file.name);
                  return (
                    <tr key={file.id} className="border-b border-muted last:border-b-0 hover:bg-slate-50 transition-colors group">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: info.bg }}>
                            <info.Icon className="w-[18px] h-[18px]" style={{ color: info.color }} />
                          </div>
                          <div className="min-w-0">
                            <span className="text-[12px] text-slate-700 truncate block" style={{ fontWeight: 500 }}>{file.name}</span>
                            <span className="text-[11px] text-slate-400">{formatSize(file.sizeBytes)}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3"><span className="text-[12px] text-slate-500">{formatSize(file.sizeBytes)}</span></td>
                      <td className="px-4 py-3 hidden md:table-cell"><span className="text-[12px] text-slate-500">{formatHumanDate(file.date)}</span></td>
                      <td className="px-4 py-3 hidden md:table-cell"><span className="text-[12px] text-slate-500">{file.uploadedBy}</span></td>
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

        {filtered.length === 0 && (
          <div className="text-center py-12">
            <Paperclip className="w-8 h-8 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground/60" style={{ fontWeight: 500 }}>
              {attachments.length === 0 ? 'No attachments yet' : 'No attachments match your search'}
            </p>
            {attachments.length === 0 && (
              <button
                onClick={onPickFiles}
                className="inline-flex items-center justify-center h-8 gap-1.5 px-3 mt-3 rounded-lg border border-border bg-white text-foreground hover:bg-muted/40 transition-colors cursor-pointer text-xs"
                style={{ fontWeight: 500 }}
              >
                <Upload className="w-3.5 h-3.5" />
                Upload your first file
              </button>
            )}
          </div>
        )}
      </div>

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => { if (!open) setPendingDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[15px]" style={{ fontWeight: 600 }}>Delete attachment?</AlertDialogTitle>
            <AlertDialogDescription className="text-[12px] text-slate-500">
              <span className="text-foreground" style={{ fontWeight: 500 }}>{pendingDelete?.name}</span> will be removed from this {invoice ? 'invoice' : 'payment'}. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-[12px]" style={{ fontWeight: 500 }}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDelete) {
                  setAttachments((prev) => prev.filter((a) => a.id !== pendingDelete.id));
                  toast.success(`${pendingDelete.name} deleted.`);
                  setPendingDelete(null);
                }
              }}
              className="text-[12px] bg-red-600 text-white hover:bg-red-600/90"
              style={{ fontWeight: 600 }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
        <DropdownMenuItem onClick={() => onDelete(file)} className="text-destructive focus:text-destructive">
          <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
