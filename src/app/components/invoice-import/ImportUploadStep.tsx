/* ── Step 2 · Upload (single-file contract, 9/17/26) ──────────────────
 * ONE file is the ask: a hero drop zone for the user's own invoice
 * export, CSV or Excel, one row per invoice or one per line item, the
 * engine groups them. An Excel workbook carrying Payments or Credit
 * memos sheets fills those slots in the same drop. Payments and credit
 * memos remain available as separate optional files below, in the slim
 * row recipe, for users whose old system exports them apart.
 */

import { useRef, useState, type DragEvent } from 'react';
import { Upload, FileSpreadsheet, Download, CheckCircle2, AlertTriangle, Sparkles, RefreshCw, Eye, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  objectSpec,
  downloadTemplate,
  SAMPLE_FILES,
  type ImportObjectKey,
  type ImportRunConfig,
} from './importModel';
import { parseCsv, parseXlsxSheets, autoMapColumns, classifySheet, invoiceFileStats, type ParsedFile } from './importEngine';
import { ImportSheetPreviewModal, templatePreviewRequest, type SheetPreviewRequest } from './ImportSheetPreviewModal';

export interface UploadedObject {
  parsed: ParsedFile;
  mapping: Record<string, number>;
}

export type UploadsState = Partial<Record<ImportObjectKey, UploadedObject>>;

export function activeObjects(config: ImportRunConfig): ImportObjectKey[] {
  const keys: ImportObjectKey[] = ['invoices'];
  if (config.mode === 'migration' && config.objects.payments) keys.push('payments');
  if (config.mode === 'migration' && config.objects.creditMemos) keys.push('creditMemos');
  return keys;
}

export function missingRequiredColumns(key: ImportObjectKey, upload: UploadedObject): string[] {
  return objectSpec(key)
    .fields.filter((f) => f.required && upload.mapping[f.key] === -1)
    .map((f) => f.label);
}

/* Conditional column gates the simple required flags cannot express:
 * an invoice file needs SOME amount column, a payment or credit file
 * needs SOME way to find its invoice. */
export function mappingGateNotes(key: ImportObjectKey, upload: UploadedObject): string[] {
  const m = upload.mapping;
  const notes: string[] = [];
  if (key === 'invoices') {
    if (m.subtotal === -1 && m.line_amount === -1 && !(m.quantity >= 0 && m.unit_price >= 0)) {
      notes.push('An amount column: Subtotal, Line amount, or Quantity with Unit price');
    }
  } else if (m.vendor_invoice_number === -1 && m.source_reference === -1) {
    notes.push('A join column: Vendor invoice number or Source reference');
  }
  return notes;
}

function toUpload(objectKey: ImportObjectKey, parsed: ParsedFile): UploadedObject | null {
  if (parsed.headers.length === 0 || parsed.rows.length === 0) {
    toast.error('That file is unreadable', { description: 'No rows found. Download the template to see the expected shape.' });
    return null;
  }
  return { parsed, mapping: autoMapColumns(objectKey, parsed.headers) };
}

const quietAction =
  'inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[12px] text-slate-500 hover:text-foreground hover:bg-slate-100 transition-colors cursor-pointer';

function TemplateActions({ objectKey, onPreview }: { objectKey: ImportObjectKey; onPreview: (req: SheetPreviewRequest) => void }) {
  return (
    <>
      <button type="button" onClick={() => onPreview(templatePreviewRequest(objectKey))} className={quietAction} style={{ fontWeight: 500 }}>
        <Eye className="w-3.5 h-3.5 text-slate-400" />
        Preview
      </button>
      <button
        type="button"
        onClick={() => { void downloadTemplate(objectKey, 'xlsx'); }}
        className={quietAction}
        style={{ fontWeight: 500 }}
        title={objectKey === 'invoices' ? 'One workbook: Invoices, Payments and Credit Memos sheets, field rules attached' : 'Download the Excel template, field rules attached'}
      >
        <Download className="w-3.5 h-3.5 text-slate-400" />
        Excel
      </button>
      <button type="button" onClick={() => { void downloadTemplate(objectKey, 'csv'); }} className={quietAction} style={{ fontWeight: 500 }} title="Download the CSV template">
        <Download className="w-3.5 h-3.5 text-slate-400" />
        CSV
      </button>
    </>
  );
}

function UploadedRow({
  objectKey,
  upload,
  onReplace,
  onRemove,
  onPreview,
}: {
  objectKey: ImportObjectKey;
  upload: UploadedObject;
  onReplace: () => void;
  onRemove: () => void;
  onPreview: (req: SheetPreviewRequest) => void;
}) {
  const spec = objectSpec(objectKey);
  const missing = missingRequiredColumns(objectKey, upload).concat(mappingGateNotes(objectKey, upload));
  const stats = objectKey === 'invoices' ? invoiceFileStats(upload.parsed, upload.mapping) : null;

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="relative w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-emerald-50">
        <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
        <CheckCircle2 className="absolute -right-1 -bottom-1 text-emerald-500 bg-white rounded-full" style={{ width: 13, height: 13 }} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 min-w-0">
          <p className="text-[13px] text-foreground truncate" style={{ fontWeight: 600 }}>
            {upload.parsed.fileName}
          </p>
          <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-500 px-2 py-px text-[10.5px] shrink-0" style={{ fontWeight: 500 }}>
            {upload.parsed.rows.length} Rows
          </span>
          {stats && (
            <span className="inline-flex items-center rounded-full bg-blue-50 text-blue-700 px-2 py-px text-[10.5px] shrink-0" style={{ fontWeight: 500 }}>
              {stats.invoices} Invoice{stats.invoices === 1 ? '' : 's'}
            </span>
          )}
          {!stats && (
            <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-500 px-2 py-px text-[10.5px] shrink-0" style={{ fontWeight: 500 }}>
              {upload.parsed.headers.length} Columns
            </span>
          )}
        </div>
        <p className={`flex items-center gap-1 text-[11px] mt-0.5 ${missing.length > 0 ? 'text-orange-600' : 'text-slate-500'}`} style={{ fontWeight: missing.length > 0 ? 500 : 400 }}>
          {missing.length > 0
            ? <AlertTriangle className="w-3 h-3 shrink-0" />
            : <CheckCircle2 className="w-3 h-3 shrink-0 text-emerald-500" />}
          <span className="truncate">
            {spec.title}
            {missing.length > 0
              ? ` · no match yet for ${missing.join(', ')}, map it on the next step`
              : stats
                ? stats.lineShaped
                  ? ' · line item rows detected, grouped by vendor and invoice number'
                  : ' · one row per invoice'
                : ' · every required field matched'}
          </span>
        </p>
      </div>
      <div className="flex items-center gap-0.5 shrink-0">
        <button
          type="button"
          onClick={() =>
            onPreview({
              title: upload.parsed.fileName,
              subtitle: `${spec.title} · ${upload.parsed.rows.length} rows · ${upload.parsed.headers.length} columns`,
              columns: upload.parsed.headers,
              rows: upload.parsed.rows,
            })
          }
          className={quietAction}
          style={{ fontWeight: 500 }}
        >
          <Eye className="w-3.5 h-3.5 text-slate-400" />
          Preview
        </button>
        <button type="button" onClick={onReplace} className={quietAction} style={{ fontWeight: 500 }} title="Replace this file">
          <RefreshCw className="w-3 h-3" />
          Replace
        </button>
        <div className="w-px h-4 bg-border mx-1" />
        <button
          type="button"
          onClick={onRemove}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
          aria-label="Remove file"
          title="Remove this file"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export function ImportUploadStep({
  config,
  uploads,
  onParsed,
  onRemove,
}: {
  config: ImportRunConfig;
  uploads: UploadsState;
  onParsed: (key: ImportObjectKey, upload: UploadedObject) => void;
  onRemove: (key: ImportObjectKey) => void;
}) {
  const keys = activeObjects(config);
  const optionalKeys = keys.filter((k): k is 'payments' | 'creditMemos' => k !== 'invoices');
  const anyParsed = keys.some((k) => !!uploads[k]);
  const [preview, setPreview] = useState<SheetPreviewRequest | null>(null);
  const [dragOver, setDragOver] = useState<ImportObjectKey | null>(null);
  const inputRefs = {
    invoices: useRef<HTMLInputElement>(null),
    payments: useRef<HTMLInputElement>(null),
    creditMemos: useRef<HTMLInputElement>(null),
  };

  /* One drop can fill several slots: a workbook whose extra sheets read
   * as payments or credit memos lands them where they belong. */
  const ingestSheets = (slot: ImportObjectKey, sheets: ParsedFile[], fileName: string) => {
    if (sheets.length === 0) {
      toast.error('That file is unreadable', { description: 'No data sheets found. Download the template to see the expected shape.' });
      return;
    }
    const classified = sheets.map((s) => ({ parsed: s, kind: classifySheet(s) }));
    const primary =
      classified.find((c) => c.kind === slot)?.parsed
      ?? (slot === 'invoices' ? null : classified[0].parsed);
    if (slot === 'invoices' && !primary) {
      toast.error('No invoice sheet found', { description: `${fileName} only carries ${classified.map((c) => objectSpec(c.kind).title).join(' and ')}. Drop those on their own rows below.` });
      return;
    }
    if (primary) {
      const up = toUpload(slot, primary);
      if (up) onParsed(slot, up);
    }
    if (slot !== 'invoices') return;
    const extras: string[] = [];
    for (const c of classified) {
      if (c.parsed === primary || c.kind === 'invoices') continue;
      if (!keys.includes(c.kind)) continue;
      const up = toUpload(c.kind, c.parsed);
      if (up) {
        onParsed(c.kind, up);
        extras.push(objectSpec(c.kind).title);
      }
    }
    if (extras.length > 0) {
      toast.success('Workbook unpacked', { description: `The ${extras.join(' and ')} sheet${extras.length === 1 ? '' : 's'} came along and filled the optional slots below.` });
    }
  };

  const handleFile = (slot: ImportObjectKey, file: File | undefined) => {
    if (!file) return;
    if (/\.xlsx$/i.test(file.name)) {
      file.arrayBuffer().then(async (buffer) => {
        ingestSheets(slot, await parseXlsxSheets(buffer, file.name), file.name);
      });
      return;
    }
    if (!/\.(csv|txt)$/i.test(file.name)) {
      toast.error('CSV or Excel files only', { description: 'Upload a .csv or .xlsx export, or start from the template.' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const up = toUpload(slot, parseCsv(String(reader.result ?? ''), file.name));
      if (up) onParsed(slot, up);
    };
    reader.readAsText(file);
  };

  const loadAllSamples = () => {
    let loaded = 0;
    for (const k of keys) {
      if (uploads[k]) continue;
      const sample = SAMPLE_FILES[k];
      const up = toUpload(k, parseCsv(sample.csv, sample.name));
      if (up) { onParsed(k, up); loaded += 1; }
    }
    if (loaded > 0) toast.success('Sample data loaded', { description: 'A realistic legacy export, deliberately messy so every fix has something to show.' });
  };

  const dropProps = (slot: ImportObjectKey, occupied: boolean) => ({
    onDragOver: (e: DragEvent) => { if (!occupied) { e.preventDefault(); setDragOver(slot); } },
    onDragLeave: () => setDragOver((v) => (v === slot ? null : v)),
    onDrop: (e: DragEvent) => {
      if (occupied) return;
      e.preventDefault();
      setDragOver(null);
      handleFile(slot, e.dataTransfer.files?.[0]);
    },
  });

  const invoiceUpload = uploads.invoices;

  return (
    <div className="w-full flex flex-col gap-3">
      {(['invoices', 'payments', 'creditMemos'] as const).map((k) => (
        <input
          key={k}
          ref={inputRefs[k]}
          type="file"
          accept=".csv,.txt,.xlsx"
          className="hidden"
          onChange={(e) => {
            handleFile(k, e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      ))}

      {/* ── The one file that matters ── */}
      <div className="bg-white border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-3 border-b border-slate-100">
          <div>
            <p className="text-[13px]" style={{ fontWeight: 600 }}>
              Your Invoice Export<span className="text-red-500 ml-0.5">*</span>
            </p>
            <p className="text-[11px] text-slate-500 mt-px">
              One file is all it takes. One row per invoice, or one row per line item, grouped automatically.
            </p>
          </div>
          {!anyParsed && (
            <button
              type="button"
              onClick={loadAllSamples}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-primary/25 bg-accent/50 text-[12px] text-primary hover:bg-accent transition-all cursor-pointer shrink-0"
              style={{ fontWeight: 500 }}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Use Sample Data
            </button>
          )}
        </div>

        {!invoiceUpload ? (
          <div className="px-4 py-4">
            <button
              type="button"
              onClick={() => inputRefs.invoices.current?.click()}
              {...dropProps('invoices', false)}
              className={`w-full rounded-xl border border-dashed px-6 py-9 flex flex-col items-center justify-center text-center transition-all cursor-pointer ${
                dragOver === 'invoices'
                  ? 'border-primary bg-accent/60'
                  : 'border-slate-300 bg-slate-50/50 hover:border-primary/50 hover:bg-accent/40'
              }`}
            >
              <span className="w-11 h-11 rounded-xl bg-white border border-slate-200 flex items-center justify-center shadow-sm">
                <Upload className="w-5 h-5 text-primary" />
              </span>
              <p className="text-[13.5px] text-foreground mt-3" style={{ fontWeight: 600 }}>
                Drop the export from your old system, or click to browse
              </p>
              {/* Mode-aware (GPT QC08, 9/30): ongoing batches are
                  invoice-only, so the copy stops advertising payment and
                  credit-memo sheets that the mode doesn't accept. */}
              <p className="text-[11.5px] text-slate-500 mt-1 max-w-[520px]" style={{ lineHeight: 1.55 }}>
                {optionalKeys.length > 0
                  ? 'CSV or Excel. Column names auto match, blanks get sensible defaults, and an Excel workbook carrying Payments or Credit Memos sheets fills everything in one drop.'
                  : 'CSV or Excel. Column names auto match and blanks get sensible defaults. Ongoing batches import invoices only; payment and credit history belongs to a migration run.'}
              </p>
            </button>
            <div className="flex items-center justify-between gap-3 mt-2.5 flex-wrap">
              <p className="text-[11px] text-slate-400" style={{ fontWeight: 400 }}>
                Starting fresh? The template carries every column, one example of each shape, and the field rules.
              </p>
              <div className="flex items-center gap-0.5">
                <TemplateActions objectKey="invoices" onPreview={setPreview} />
              </div>
            </div>
          </div>
        ) : (
          <div {...dropProps('invoices', true)}>
            <UploadedRow
              objectKey="invoices"
              upload={invoiceUpload}
              onReplace={() => inputRefs.invoices.current?.click()}
              onRemove={() => onRemove('invoices')}
              onPreview={setPreview}
            />
          </div>
        )}
      </div>

      {/* ── Optional payment history ── */}
      {optionalKeys.length > 0 && (
        <div className="bg-white border border-border rounded-xl overflow-hidden">
          <div className="px-4 pt-3.5 pb-3 border-b border-slate-100">
            <p className="text-[13px]" style={{ fontWeight: 600 }}>
              Payment History <span className="text-slate-400" style={{ fontWeight: 400 }}>· only if your export keeps it separate</span>
            </p>
            <p className="text-[11px] text-slate-500 mt-px">
              Already inside your invoice workbook as extra sheets? These slots fill themselves. Allocations validate against each invoice's declared payment status.
            </p>
          </div>
          <div className="divide-y divide-slate-100">
            {optionalKeys.map((key) => {
              const upload = uploads[key];
              const spec = objectSpec(key);
              return (
                <div key={key} className={`transition-colors ${dragOver === key ? 'bg-accent/50' : ''}`} {...dropProps(key, !!upload)}>
                  {upload ? (
                    <UploadedRow
                      objectKey={key}
                      upload={upload}
                      onReplace={() => inputRefs[key].current?.click()}
                      onRemove={() => onRemove(key)}
                      onPreview={setPreview}
                    />
                  ) : (
                    <div className="flex items-center gap-3 px-4 py-3">
                      <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-slate-100">
                        <FileSpreadsheet className="w-4 h-4 text-slate-500" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>
                          {spec.title}
                          <span className="text-slate-400 ml-1.5 text-[11px]" style={{ fontWeight: 400 }}>Optional</span>
                        </p>
                        <p className="text-[11px] text-slate-500 mt-px truncate">
                          {key === 'payments'
                            ? 'Joined to invoices by invoice number or source reference.'
                            : 'Required only when an invoice declares Settled.'}
                        </p>
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <TemplateActions objectKey={key} onPreview={setPreview} />
                        <button
                          type="button"
                          onClick={() => inputRefs[key].current?.click()}
                          className="ml-1.5 inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-dashed border-slate-300 bg-white text-[12px] text-slate-600 hover:border-primary/50 hover:bg-accent/50 hover:text-primary transition-all cursor-pointer"
                          style={{ fontWeight: 500 }}
                        >
                          <Upload className="w-3.5 h-3.5" />
                          Upload File
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p className="text-[11px] text-slate-400 px-1 flex items-center gap-1.5" style={{ fontWeight: 400 }}>
        <AlertTriangle className="w-3 h-3 text-slate-300" />
        The vendor invoice list export re-imports without edits. Templates carry the v1 exclusions and the field rules.
      </p>

      {preview && <ImportSheetPreviewModal request={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}
