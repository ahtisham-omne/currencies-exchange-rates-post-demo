import { useState } from 'react';
import { Download, FileSpreadsheet, FileText, Table, CheckCircle2, Loader2, HelpCircle, Eye, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { Checkbox } from '@/app/components/ui/checkbox';
import { toast } from 'sonner';
import { exportRowsToFile, type ListExportColumn, type ListExportRow } from '@/app/lib/listExport';
import { GuideAccordion } from '@/app/components/invoice-import/GuideAccordion';
import { ImportSheetPreviewModal, type SheetPreviewRequest } from '@/app/components/invoice-import/ImportSheetPreviewModal';

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recordCount: number;
  recordType: 'invoice' | 'prepayment' | 'payment';
  /** The rows to write, already scoped to the caller's selection and
   *  filters (9/22/26 review response, GPT F52): a real file downloads,
   *  and the success toast fires only after it exists. */
  rows?: ListExportRow[];
  columns?: ListExportColumn[];
  fileBaseName?: string;
}

/* Restyled to the design language (user 9/25): flat chrome for a form
 * modal — icon chip + title header, slate section labels, the
 * check-stock radio recipe for the single-select format (blue selection
 * identity, never checkboxes), row-click checkbox cards for the
 * include-data options, and the standard pinned footer. */

/* Each format wears its REAL file-type identity (user 9/25): Excel's
 * spreadsheet green, CSV's table blue, PDF's document red — the icon chip
 * always tinted, and the selected card adopts the same hue. */
const FORMAT_OPTIONS = [
  { value: 'excel', label: 'Excel Workbook', description: 'Full data with formatting (.xlsx)', icon: FileSpreadsheet, fg: '#1D6F42', bg: '#E9F6EF', border: '#A7DCC0', selBg: '#F2FAF6' },
  { value: 'csv', label: 'CSV File', description: 'Comma-separated values (.csv)', icon: Table, fg: '#1D4ED8', bg: '#EFF6FF', border: '#BFDBFE', selBg: '#F5F9FF' },
  { value: 'pdf', label: 'PDF Document', description: 'Formatted report (.pdf)', icon: FileText, fg: '#DC2626', bg: '#FEF2F2', border: '#FECACA', selBg: '#FFF7F7' },
] as const;

type ExportFormat = (typeof FORMAT_OPTIONS)[number]['value'];

// Display names, written at the source (no case transforms on screen).
const RECORD_LABEL: Record<ExportDialogProps['recordType'], string> = {
  invoice: 'Invoice',
  prepayment: 'Prepayment',
  payment: 'Payment',
};

/* Sentence-case section heading + helper, the import-setup recipe
   ("What kind of import is this?") — never all-caps (user 9/25). */
function SectionHeading({ title, helper }: { title: string; helper?: string }) {
  return (
    <div className="mb-2">
      <p className="text-[13px] text-foreground leading-tight" style={{ fontWeight: 600 }}>{title}</p>
      {helper && <p className="text-[11px] text-slate-400 mt-0.5" style={{ lineHeight: 1.5 }}>{helper}</p>}
    </div>
  );
}

export function ExportDialog({
  open,
  onOpenChange,
  recordCount,
  recordType,
  rows,
  columns,
  fileBaseName,
}: ExportDialogProps) {
  const [exportFormat, setExportFormat] = useState<ExportFormat>('excel');
  const [includeLineItems, setIncludeLineItems] = useState(true);
  const [includePayments, setIncludePayments] = useState(true);
  const [includeAttachments, setIncludeAttachments] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  // "How it works" opens the guide as a slide-over (user 9/25, the
  // import recipe) — never inline, so the modal keeps its height.
  const [guideOpen, setGuideOpen] = useState(false);
  // Preview before export (user 9/25): the import's sheet-preview modal,
  // verbatim. The dialog steps aside while the preview is up (the
  // fixed-overlay-inside-transformed-dialog trap); closing it returns
  // here with every pick intact.
  const [previewReq, setPreviewReq] = useState<SheetPreviewRequest | null>(null);
  const openPreview = () => {
    if (!rows || !columns || rows.length === 0) {
      toast.error('Nothing to preview', { description: 'The current view has no rows to show.' });
      return;
    }
    setPreviewReq({
      title: `${RECORD_LABEL[recordType]} Export`,
      subtitle: `${recordCount.toLocaleString()} ${noun} · ${columns.length} columns · how the ${formatLabel} lays out`,
      columns: columns.map((c) => c.label),
      rows: rows.map((r) => columns.map((c) => String(r[c.key] ?? ''))),
    });
  };

  const noun = `${recordType}${recordCount === 1 ? '' : 's'}`;
  const formatLabel = FORMAT_OPTIONS.find((o) => o.value === exportFormat)?.label ?? 'Excel Workbook';

  const handleExport = async () => {
    if (!rows || !columns || rows.length === 0) {
      toast.error('Nothing to export', { description: 'The current view has no rows to write.' });
      return;
    }
    setIsExporting(true);
    try {
      const fileName = await exportRowsToFile(
        exportFormat,
        rows,
        columns,
        fileBaseName ?? `${recordType}-export`,
      );
      onOpenChange(false);
      toast.success('Export complete', {
        description: `${rows.length} ${recordType}${rows.length === 1 ? '' : 's'} saved as ${fileName}.`,
      });
    } catch {
      toast.error('Export failed', { description: 'The file could not be generated. Try another format.' });
    } finally {
      setIsExporting(false);
    }
  };

  const includeOptions = [
    { key: 'lineItems', label: 'Line Items', description: 'Detailed line item breakdown per invoice.', checked: includeLineItems, set: setIncludeLineItems },
    { key: 'payments', label: 'Payment History', description: 'Every payment transaction on the records.', checked: includePayments, set: setIncludePayments },
    { key: 'attachments', label: 'Attachments', description: 'Invoice documents, PDF export only.', checked: includeAttachments, set: setIncludeAttachments },
  ];

  return (
    <>
    <Dialog open={open && !previewReq} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={`p-0 gap-0 overflow-hidden rounded-2xl border-0 bg-white shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)] transition-all duration-200 ${
          guideOpen ? 'max-w-[1040px] sm:max-w-[1040px]' : 'max-w-[640px] sm:max-w-[640px]'
        }`}
      >
        <div className="flex items-stretch max-h-[85vh]">
        <div className="w-full sm:w-[640px] shrink-0 flex flex-col min-h-0">
        {/* Header — the creation-modal recipe (user 9/25): icon chip +
            compact title/scope stack, controls on the right, own X
            aligned in the row (the floating Radix X read as misplaced). */}
        <div className="flex items-center gap-3 px-5 h-[64px] border-b border-slate-100 shrink-0">
          <div className="w-9 h-9 rounded-lg bg-primary/[0.08] flex items-center justify-center shrink-0">
            <Download className="w-[18px] h-[18px] text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <DialogTitle className="text-[15px] text-foreground tracking-[-0.01em]" style={{ fontWeight: 600 }}>
              Export {RECORD_LABEL[recordType]}s
            </DialogTitle>
            <DialogDescription className="text-[11.5px] text-slate-500 mt-0.5" style={{ lineHeight: 1.5 }}>
              {recordCount.toLocaleString()} {noun} from your current view.
            </DialogDescription>
          </div>
          <button
            type="button"
            onClick={() => setGuideOpen((o) => !o)}
            className={`h-8 px-3 rounded-lg border text-[12px] transition-colors cursor-pointer inline-flex items-center gap-1.5 shrink-0 ${
              guideOpen ? 'border-primary/40 bg-blue-50/50 text-primary' : 'border-border bg-white text-slate-600 hover:bg-slate-50'
            }`}
            style={{ fontWeight: 500 }}
          >
            <HelpCircle className={`w-3.5 h-3.5 ${guideOpen ? 'text-primary' : 'text-slate-400'}`} />
            How It Works
          </button>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Grey working surface (user 9/25): the cards sit white on the
            modal grey so they pop, same as the guide column. */}
        <div className="px-5 py-4 space-y-4 overflow-y-auto bg-slate-50/70 flex-1">
          {/* Format — single select, so radios (9/24 rule), blue selection
              identity like every picker card. */}
          <div>
            <SectionHeading title="Which format do you need?" helper="Pick how the list should come out." />
            {/* One line of mode cards, the import Migration / Ongoing
                batch recipe (user 9/25). */}
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Export format">
              {FORMAT_OPTIONS.map((option) => {
                const Icon = option.icon;
                const active = exportFormat === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setExportFormat(option.value)}
                    className="group flex flex-col gap-2 p-3 rounded-lg border text-left cursor-pointer transition-all duration-200 hover:-translate-y-0.5"
                    style={{
                      borderColor: active ? option.fg : '#E2E8F0',
                      backgroundColor: active ? option.selBg : '#FFFFFF',
                      // Selected card carries a soft shadow in its own hue
                      // (user 9/25) — light tint, never dark slate.
                      boxShadow: active ? `0 6px 18px -10px ${option.fg}59` : undefined,
                    }}
                    onMouseEnter={(e) => {
                      if (active) return;
                      // Hover tints the outline and shadow with the card's
                      // OWN file-type color (user 9/25).
                      e.currentTarget.style.borderColor = option.border;
                      e.currentTarget.style.boxShadow = `0 8px 20px -10px ${option.fg}4D`;
                    }}
                    onMouseLeave={(e) => {
                      if (active) return;
                      e.currentTarget.style.borderColor = '#E2E8F0';
                      e.currentTarget.style.boxShadow = '';
                    }}
                  >
                    <span className="flex items-center justify-between w-full">
                      <span
                        className="w-8 h-8 rounded-md flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-110"
                        style={{ backgroundColor: option.bg, color: option.fg, border: `1px solid ${option.border}` }}
                      >
                        <Icon className="w-4 h-4" />
                      </span>
                      <span
                        className="w-4 h-4 rounded-full border-2 bg-white flex items-center justify-center shrink-0 transition-colors duration-200"
                        style={{ borderColor: active ? option.fg : '#CBD5E1' }}
                      >
                        {active && <span className="w-2 h-2 rounded-full animate-in zoom-in duration-200" style={{ backgroundColor: option.fg }} />}
                      </span>
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[13px] text-foreground leading-tight" style={{ fontWeight: 600 }}>
                        {option.label}
                      </span>
                      <span className="block text-[11px] text-slate-500 leading-snug mt-0.5">
                        {option.description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Include options — invoice exports only; the whole row toggles. */}
          {recordType === 'invoice' && (
            <div>
              <SectionHeading title="What should ride along?" helper="Extra data joins as sheets on Excel and sections on PDF." />
              <div className="rounded-lg border border-slate-200 bg-white divide-y divide-slate-100">
                {includeOptions.map((opt) => (
                  <label
                    key={opt.key}
                    className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-blue-50/40 transition-colors duration-150 first:rounded-t-lg last:rounded-b-lg"
                  >
                    <Checkbox
                      checked={opt.checked}
                      onCheckedChange={(checked) => opt.set(checked === true)}
                      className="shrink-0"
                    />
                    <span className="min-w-0">
                      <span className="block text-[13px] text-foreground leading-tight" style={{ fontWeight: 500 }}>
                        {opt.label}
                      </span>
                      <span className="block text-[11px] text-slate-400 leading-tight mt-0.5">
                        {opt.description}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Summary strip — blue-tinted info band (the import modal's
              "This import will" tone), never grey-on-grey. */}
          <div className="flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            {/* Re-keyed per format so the line softly fades when the pick
                changes (user 9/25, premium micro-interactions). */}
            <p key={exportFormat} className="text-[12px] text-slate-600 animate-in fade-in slide-in-from-bottom-1 duration-200">
              Exporting <span className="text-foreground" style={{ fontWeight: 600 }}>{recordCount.toLocaleString()} {noun}</span> as{' '}
              <span className="text-foreground" style={{ fontWeight: 600 }}>{formatLabel}</span>.
            </p>
          </div>
        </div>

        {/* Footer — standard pinned recipe: preview left, quiet Cancel,
            primary CTA. */}
        <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-slate-100 bg-white">
          {/* Preview before export (user 9/25) — the import's sheet
              preview, same document chrome. */}
          <button
            type="button"
            onClick={openPreview}
            disabled={isExporting}
            className="mr-auto h-9 px-3.5 rounded-lg border border-border bg-white hover:bg-slate-50 text-slate-700 inline-flex items-center gap-1.5 transition-all duration-200 cursor-pointer shadow-sm text-[13px] disabled:opacity-60"
            style={{ fontWeight: 500 }}
          >
            <Eye className="w-4 h-4 text-slate-500" />
            Preview
          </button>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={isExporting}
            className="h-9 px-3.5 rounded-lg border border-border bg-white hover:bg-slate-50 text-slate-700 inline-flex items-center gap-1.5 transition-all duration-200 cursor-pointer shadow-sm text-[13px] disabled:opacity-60"
            style={{ fontWeight: 500 }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={isExporting}
            className="h-9 px-3.5 rounded-lg bg-primary hover:bg-primary/90 text-white inline-flex items-center gap-1.5 transition-all duration-200 cursor-pointer shadow-sm text-[13px] disabled:opacity-70"
            style={{ fontWeight: 500 }}
          >
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {isExporting ? 'Exporting…' : 'Export'}
          </button>
        </div>
        </div>

        {/* ── How it works: the export guide — docked right INSIDE the
            shell like the import guide (user 9/25); the dialog widens,
            never grows taller. ── */}
        {guideOpen && (
          <div className="hidden sm:flex w-[400px] shrink-0 border-l border-border bg-slate-50/70 flex-col min-h-0 animate-in slide-in-from-right duration-200">
            {/* White header band over the grey guide body, HEIGHT-MATCHED
                to the form header so the two bands read as one line
                (user 9/25). Title wears the form title's exact type: 15px
                w600. No X of its own — the How-it-works button toggles. */}
            <div className="flex items-center gap-3 px-5 h-[64px] border-b border-slate-100 bg-white shrink-0">
              <div className="min-w-0">
                <p className="text-[11px]" style={{ fontWeight: 600, color: 'hsl(var(--primary))' }}>
                  How This Works
                </p>
                <h3 className="text-[15px] text-foreground tracking-[-0.01em] mt-0.5 truncate" style={{ fontWeight: 600 }}>
                  {RECORD_LABEL[recordType]} Export Guide
                </h3>
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
              <GuideAccordion
                items={[
                  {
                    title: 'What Gets Exported',
                    body: (
                      <p>
                        The rows in your current view: your selected rows when any are ticked, otherwise everything the active filters show, with the columns you have visible. It exports the list for working on, not the {recordType} documents themselves.
                      </p>
                    ),
                  },
                  {
                    title: 'Choosing a Format',
                    body: (
                      <p>
                        <span className="text-foreground" style={{ fontWeight: 600 }}>Excel</span> keeps formatting and can carry the additional data as extra sheets. <span className="text-foreground" style={{ fontWeight: 600 }}>CSV</span> is plain values for feeding another system. <span className="text-foreground" style={{ fontWeight: 600 }}>PDF</span> is a formatted report for sharing or filing.
                      </p>
                    ),
                  },
                  {
                    title: 'Additional Data',
                    body: (
                      <p>
                        Line items and payment history ride along as extra sheets on Excel exports and extra sections on PDF. Attachments are bundled on PDF exports only. CSV always stays a single flat table.
                      </p>
                    ),
                  },
                ]}
              />
            </div>
          </div>
        )}
        </div>
      </DialogContent>
    </Dialog>
    {/* The preview lives OUTSIDE the dialog (fixed overlays break inside
        a transformed DialogContent); the dialog is hidden while it's up
        and returns with every pick intact on close. */}
    {previewReq && <ImportSheetPreviewModal request={previewReq} onClose={() => setPreviewReq(null)} />}
    </>
  );
}
