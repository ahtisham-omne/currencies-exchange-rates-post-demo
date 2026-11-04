/* ── Import vendor invoices: the stepper modal ────────────────────────
 * Five steps in the exact overlay shell the other flow modals use
 * (PaymentRunScreen / RecordPaymentFlow): per-step task headings, the
 * numbered-circle stepper, Full view, the amber discard ask, and a
 * footer whose Continue states its specific blocker when disabled.
 *
 * Set up → Upload → Map columns → Review and fix → Simulate and commit.
 * Nothing writes to app state until the commit click; rollback stays on
 * the result screen with its expiry stated.
 */

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Check, ChevronLeft, CircleHelp, FileSpreadsheet, Maximize2, Minimize2, X } from 'lucide-react';
import { toast } from 'sonner';
import type { Invoice } from '@/app/data/mockInvoices';
import type { Payment } from '@/app/data/mockPayments';
import { palette } from '@/styles/tokens';
import { defaultRunConfig, type ImportObjectKey, type ImportRunConfig } from './importModel';
import {
  applyMapping,
  assembleRows,
  buildCommitRecords,
  rowSeverity,
  severityCounts,
  simulateRun,
  validateRows,
  type ImportInvoiceRow,
  type ValidationContext,
} from './importEngine';
import { ImportSetupStep } from './ImportSetupStep';
import { ImportUploadStep, activeObjects, missingRequiredColumns, mappingGateNotes, type UploadsState, type UploadedObject } from './ImportUploadStep';
import { ImportMapStep } from './ImportMapStep';
import { ImportReviewStep, includedBlockerCount } from './ImportReviewStep';
import { ImportCommitStep, type CommitState } from './ImportCommitStep';
import { ImportGuidePanel } from './ImportGuidePanel';
import { fmtPeriod } from './importUi';

type StepId = 'setup' | 'upload' | 'map' | 'review' | 'commit';

const STEPS: { id: StepId; label: string; heading: string; helper: string }[] = [
  {
    id: 'setup',
    label: 'Set Up',
    heading: 'Set Up the Import',
    helper: 'Pick the mode, name the import, and settle the accounting before any file is asked for.',
  },
  {
    id: 'upload',
    label: 'Upload',
    heading: 'Upload Your Export',
    helper: 'One file with everything: one row per invoice, or one per line item, CSV or Excel. Payments and credit memos can ride along as extra sheets.',
  },
  {
    id: 'map',
    label: 'Map Columns',
    heading: 'Map Columns to Omne Fields',
    helper: 'Auto-matched where the headers agree. Unmapped required fields sit at the top in orange; blanks get sensible defaults.',
  },
  {
    id: 'review',
    label: 'Review & Fix',
    heading: 'Review and Fix',
    helper: 'Errors are per cell. Fix them inline, exclude a row, or download the failed rows and fix in Excel.',
  },
  {
    id: 'commit',
    label: 'Commit',
    heading: 'Simulate, Then Commit',
    helper: 'A dry run with the accounting preview and the AP tie-out. Nothing posts until you commit.',
  },
];

export interface ImportInvoicesModalProps {
  invoices: Invoice[];
  onClose: () => void;
  /** Insert the committed records into app state. */
  onCommit: (invoices: Invoice[], payments: Payment[]) => void;
  /** Remove a committed run again (rollback window). */
  onRollback: (invoiceIds: string[], paymentIds: string[]) => void;
}

export function ImportInvoicesModal({ invoices, onClose, onCommit, onRollback }: ImportInvoicesModalProps) {
  const [step, setStep] = useState<StepId>('setup');
  const [config, setConfig] = useState<ImportRunConfig>(() => defaultRunConfig(new Date()));
  const [uploads, setUploads] = useState<UploadsState>({});
  const [rows, setRows] = useState<ImportInvoiceRow[]>([]);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [commit, setCommit] = useState<CommitState>({ phase: 'idle', processed: 0, total: 0, importedInvoiceCount: 0, importedPaymentCount: 0, exceptionCount: 0 });
  const committedIds = useRef<{ invoices: string[]; payments: string[] }>({ invoices: [], payments: [] });
  // Rows rebuild only when the upstream data actually changed, so review
  // edits survive a hop back to mapping and forward again.
  const uploadsVersion = useRef(0);
  const rowsBuiltFrom = useRef(-1);

  const ctx: ValidationContext = useMemo(
    () => ({
      mode: config.mode,
      toleranceCents: /^\d+$/.test(config.toleranceText.trim()) ? Number(config.toleranceText.trim()) : 2,
      createMissingVendors: config.createMissingVendors,
      existingInvoices: invoices,
      knownVendors: new Set(invoices.map((i) => i.vendor)),
      postingPeriod: config.postingPeriod,
    }),
    [config, invoices],
  );

  /* Background scroll lock, same non-passive wheel guard as the run modal:
   * a wheel over non-scrolling chrome must not scroll the listing below. */
  const overlayRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const onWheel = (e: WheelEvent) => {
      let node = e.target as HTMLElement | null;
      while (node && node !== overlay) {
        if (node.scrollHeight > node.clientHeight + 1) {
          const canUp = e.deltaY < 0 && node.scrollTop > 0;
          const canDown = e.deltaY > 0 && node.scrollTop + node.clientHeight < node.scrollHeight - 1;
          if (canUp || canDown) return;
        }
        // Horizontal scrolling (trackpad pan, shift+wheel) must pass too:
        // the review table is wider than the modal.
        if (node.scrollWidth > node.clientWidth + 1) {
          const canLeft = e.deltaX < 0 && node.scrollLeft > 0;
          const canRight = e.deltaX > 0 && node.scrollLeft + node.clientWidth < node.scrollWidth - 1;
          if (canLeft || canRight) return;
        }
        node = node.parentElement;
      }
      e.preventDefault();
    };
    overlay.addEventListener('wheel', onWheel, { passive: false });
    return () => overlay.removeEventListener('wheel', onWheel);
  }, []);

  const stepIdx = STEPS.findIndex((s) => s.id === step);
  const meta = STEPS[stepIdx];
  const committed = commit.phase === 'done';
  const running = commit.phase === 'running';

  /* ── Gating per step ── */
  const toleranceValid = /^\d+$/.test(config.toleranceText.trim());
  const setupReady =
    config.runName.trim().length > 0 &&
    toleranceValid &&
    (config.mode === 'ongoing' || (!!config.clearingAccount && !!config.postingPeriod));
  const uploadReady = !!uploads.invoices;
  const uploadedKeys = activeObjects(config).filter((k) => !!uploads[k]);
  const mapMissing = uploadedKeys.reduce(
    (s, k) => s + missingRequiredColumns(k, uploads[k]!).length + mappingGateNotes(k, uploads[k]!).length,
    0,
  );
  const mapReady = uploadReady && mapMissing === 0;
  const includedRows = rows.filter((r) => !r.excluded);
  const blockers = includedBlockerCount(rows);
  const reviewReady = includedRows.length > 0 && blockers === 0;

  const continueBlockedReason: string | null = (() => {
    if (step === 'setup' && !setupReady) {
      if (!config.runName.trim()) return 'Name the import first';
      if (!toleranceValid) return 'Rounding tolerance needs a whole number of cents';
      return 'Pick a clearing account and posting period';
    }
    if (step === 'upload' && !uploadReady) return 'Upload your invoice file first';
    if (step === 'map' && !mapReady) return `${mapMissing} required field${mapMissing === 1 ? '' : 's'} still need a source column`;
    if (step === 'review' && !reviewReady) {
      if (includedRows.length === 0) return 'Every row is excluded, there is nothing to import';
      return `${blockers} blocker${blockers === 1 ? '' : 's'} must be fixed or excluded`;
    }
    return null;
  })();

  /* ── Rows lifecycle ── */
  const [unmatchedNote, setUnmatchedNote] = useState<string | null>(null);
  const buildRows = () => {
    const mapped: Partial<Record<ImportObjectKey, Record<string, string>[]>> = {};
    for (const key of uploadedKeys) {
      const u = uploads[key]!;
      mapped[key] = applyMapping(u.parsed, u.mapping);
    }
    const { rows: next, unmatchedPayments, unmatchedCreditMemos } = assembleRows(mapped, { mode: config.mode });
    validateRows(next, ctx);
    setRows(next);
    const orphanParts = [
      unmatchedPayments > 0 ? `${unmatchedPayments} payment row${unmatchedPayments === 1 ? '' : 's'}` : '',
      unmatchedCreditMemos > 0 ? `${unmatchedCreditMemos} credit memo${unmatchedCreditMemos === 1 ? '' : 's'}` : '',
    ].filter(Boolean);
    setUnmatchedNote(orphanParts.length > 0 ? `${orphanParts.join(' and ')} matched no invoice in this file and will not import.` : null);
    if (orphanParts.length > 0) {
      toast.warning(`${orphanParts.join(' and ')} matched no invoice`, {
        description: 'Check the invoice number or source reference on those rows.',
      });
    }
    rowsBuiltFrom.current = uploadsVersion.current;
  };

  // Functional updates so late-firing actions (the "Fix all N" toast)
  // apply on TOP of any edits made since, never on a stale snapshot.
  const mutateRows = (fn: (prev: ImportInvoiceRow[]) => ImportInvoiceRow[]) => {
    setRows((prev) => {
      const next = fn(prev);
      validateRows(next, ctx);
      return [...next];
    });
  };

  const goTo = (target: StepId) => {
    if (committed || running) return;
    const targetIdx = STEPS.findIndex((s) => s.id === target);
    if (targetIdx > stepIdx) {
      // Forward only through the gates.
      if (stepIdx === 0 && !setupReady) return;
      if (targetIdx > 1 && !uploadReady) return;
      if (targetIdx > 2 && !mapReady) return;
      if (targetIdx > 3 && !reviewReady) return;
    }
    if (target === 'review' && rowsBuiltFrom.current !== uploadsVersion.current) buildRows();
    setStep(target);
  };

  const advance = () => {
    if (continueBlockedReason) return;
    const next = STEPS[stepIdx + 1]?.id;
    if (next) goTo(next);
  };

  /* ── Commit ── */
  const counts = severityCounts(rows);
  const summary = useMemo(() => simulateRun(rows, ctx), [rows, ctx]);

  const runCommit = () => {
    setConfirmOpen(false);
    const stamp = Date.now();
    const { invoices: newInvoices, payments: newPayments } = buildCommitRecords(rows, config, stamp);
    const total = newInvoices.length + newPayments.length;
    setCommit({ phase: 'running', processed: 0, total, importedInvoiceCount: 0, importedPaymentCount: 0, exceptionCount: 0 });
    let processed = 0;
    const stepSize = Math.max(1, Math.ceil(total / 28));
    const timer = setInterval(() => {
      processed = Math.min(total, processed + stepSize);
      setCommit((prev) => ({ ...prev, processed }));
      if (processed >= total) {
        clearInterval(timer);
        onCommit(newInvoices, newPayments);
        committedIds.current = { invoices: newInvoices.map((i) => i.id), payments: newPayments.map((p) => p.id) };
        setCommit({
          phase: 'done',
          processed: total,
          total,
          importedInvoiceCount: newInvoices.length,
          importedPaymentCount: newPayments.length,
          exceptionCount: newInvoices.filter((i) => i.status === 'Exception').length,
        });
        toast.success(`Imported ${newInvoices.length} invoices`, {
          description: newPayments.length > 0 ? `${newPayments.length} payments came along from the payment file.` : undefined,
        });
      }
    }, 55);
  };

  const rollback = () => {
    onRollback(committedIds.current.invoices, committedIds.current.payments);
    toast.success('Import rolled back', { description: 'Every invoice and payment from this import was removed. The files are untouched.' });
    onClose();
  };

  /* ── Close semantics ── */
  const dirty = Object.keys(uploads).length > 0 && !committed;
  const requestClose = () => {
    if (running) return;
    if (dirty) setDiscardOpen(true);
    else onClose();
  };

  return (
    <div ref={overlayRef} className="fixed inset-0 z-[120] flex items-center justify-center p-0 sm:p-6">
      <div className="absolute inset-0 bg-black/40" onClick={requestClose} />

      <div
        className={`relative bg-white flex flex-col overflow-hidden transition-[max-width,max-height,border-radius] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
          isFullScreen
            ? 'w-full h-full max-w-full max-h-full sm:max-w-[calc(100vw-1.5rem)] lg:max-w-[calc(100vw-2rem)] sm:max-h-[calc(100vh-1.5rem)] lg:max-h-[calc(100vh-2rem)] rounded-none sm:rounded-2xl'
            : 'w-full sm:w-[calc(100%-2rem)] sm:max-w-[1240px] h-[100dvh] sm:h-[92vh] rounded-none sm:rounded-2xl'
        }`}
        style={{ boxShadow: '0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)' }}
      >
        {/* ── Header ── */}
        <div className="px-3 sm:px-4 lg:px-5 pt-3 sm:pt-4 pb-0 shrink-0 bg-white rounded-t-none sm:rounded-t-2xl border-b border-slate-100">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                type="button"
                onClick={() => (stepIdx > 0 && !committed && !running ? goTo(STEPS[stepIdx - 1].id) : requestClose())}
                className="w-10 h-10 rounded-lg border border-border bg-white hover:bg-slate-50 hover:border-slate-300 flex items-center justify-center shrink-0 cursor-pointer transition-all"
                aria-label={stepIdx > 0 ? 'Back' : 'Close'}
                title={stepIdx > 0 && !committed ? `Back to ${STEPS[stepIdx - 1].label}` : 'Close'}
              >
                <ChevronLeft className="w-4 h-4 text-slate-500" />
              </button>
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: palette.blue[50], color: palette.blue[700] }}
              >
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-[16px] sm:text-[18px] text-foreground truncate" style={{ fontWeight: 700 }}>
                  {committed ? 'Import Committed' : meta.heading}
                </h2>
                <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 truncate" style={{ fontWeight: 400 }}>
                  {committed
                    ? `${config.runName} · ${config.mode === 'migration' ? `Migration into ${fmtPeriod(config.postingPeriod)}` : 'Ongoing batch'}`
                    : meta.helper}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
              {/* Long-form explanation lives in the guide, not on the screens. */}
              <button
                onClick={() => setGuideOpen(true)}
                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-white text-xs text-muted-foreground hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer"
                style={{ fontWeight: 500 }}
              >
                <CircleHelp className="w-3.5 h-3.5" />
                How It Works
              </button>
              <button
                onClick={() => setIsFullScreen(!isFullScreen)}
                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-white text-xs text-muted-foreground hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer"
                style={{ fontWeight: 500 }}
              >
                {isFullScreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                {isFullScreen ? 'Exit Full' : 'Full View'}
              </button>
              <button
                onClick={requestClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-500 hover:bg-muted transition-all cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Stepper — the numbered-circle + underline recipe from the flow modals. */}
          <div className="flex items-center gap-4 sm:gap-6 overflow-x-auto mt-3 sm:mt-3.5 -mb-px">
            {STEPS.map((s, i) => {
              const completed = i < stepIdx || committed;
              const current = i === stepIdx && !committed;
              const clickable = !committed && !running && i !== stepIdx && (i < stepIdx || (
                (i <= 1 || uploadReady) && (i <= 2 || mapReady) && (i <= 3 || reviewReady) && setupReady
              ));
              return (
                <Fragment key={s.id}>
                  <div
                    className={`relative flex items-center gap-2 pb-2.5 sm:pb-3 ${clickable ? 'cursor-pointer' : 'cursor-default'}`}
                    onClick={() => clickable && goTo(s.id)}
                  >
                    <div
                      className="w-[22px] h-[22px] sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[11px] sm:text-[12px] shrink-0 transition-all duration-200"
                      style={
                        completed
                          ? { backgroundColor: 'hsl(var(--success))', color: '#fff', fontWeight: 600 }
                          : current
                            ? { backgroundColor: 'hsl(var(--primary))', color: '#fff', fontWeight: 600 }
                            : { border: '1.5px solid var(--color-slate-300)', color: 'var(--color-slate-500)', backgroundColor: '#fff', fontWeight: 600 }
                      }
                    >
                      {completed ? <Check className="w-3 h-3" /> : i + 1}
                    </div>
                    <span
                      className="text-[12px] sm:text-[13px] whitespace-nowrap transition-colors"
                      style={{
                        color: completed ? 'hsl(var(--success))' : current ? 'hsl(var(--primary))' : 'var(--color-slate-700)',
                        fontWeight: current || completed ? 600 : 500,
                      }}
                    >
                      {s.label}
                    </span>
                    {(current || completed) && (
                      <div
                        className="absolute bottom-0 left-0 right-0 h-[2px] rounded-t-full"
                        style={{ backgroundColor: completed ? 'hsl(var(--success))' : 'hsl(var(--primary))' }}
                      />
                    )}
                  </div>
                </Fragment>
              );
            })}
          </div>
        </div>

        {/* ── Step body ── */}
        <div className="flex-1 min-h-0 overflow-y-auto bg-slate-50 px-3 sm:px-5 pt-3.5 pb-3.5 flex flex-col">
          {step === 'setup' && <ImportSetupStep config={config} onChange={setConfig} invoices={invoices} />}
          {step === 'upload' && (
            <ImportUploadStep
              config={config}
              uploads={uploads}
              onParsed={(key: ImportObjectKey, upload: UploadedObject) => {
                uploadsVersion.current += 1;
                setUploads((prev) => ({ ...prev, [key]: upload }));
              }}
              onRemove={(key) => {
                uploadsVersion.current += 1;
                setUploads((prev) => {
                  const next = { ...prev };
                  delete next[key];
                  return next;
                });
              }}
            />
          )}
          {step === 'map' && (
            <ImportMapStep
              config={config}
              uploads={uploads}
              onMappingChange={(key, mapping) => {
                uploadsVersion.current += 1;
                setUploads((prev) => (prev[key] ? { ...prev, [key]: { ...prev[key]!, mapping } } : prev));
              }}
            />
          )}
          {step === 'review' && (
            <ImportReviewStep
              rows={rows}
              config={config}
              unmatchedNote={unmatchedNote}
              onFix={(ref, field, value) => {
                // A hand-fixed cell settles any grouping disagreement on it.
                mutateRows((prev) => prev.map((r) => (r.ref === ref
                  ? { ...r, header: { ...r.header, [field]: value }, structuralIssues: r.structuralIssues?.filter((i) => i.field !== field) }
                  : r)));
              }}
              onFixEverywhere={(field, oldValue, value) => {
                mutateRows((prev) =>
                  prev.map((r) =>
                    !r.excluded && (r.header[field] ?? '') === oldValue
                      ? { ...r, header: { ...r.header, [field]: value }, structuralIssues: r.structuralIssues?.filter((i) => i.field !== field) }
                      : r,
                  ),
                );
              }}
              onToggleExclude={(ref, excluded) => {
                mutateRows((prev) => prev.map((r) => (r.ref === ref ? { ...r, excluded } : r)));
              }}
              onAcceptNearDuplicate={(ref) => {
                mutateRows((prev) => prev.map((r) => (r.ref === ref ? { ...r, acceptedNearDuplicate: true } : r)));
                toast.success('Importing anyway', { description: `${ref} keeps its own record.` });
              }}
            />
          )}
          {step === 'commit' && (
            <ImportCommitStep
              rows={rows}
              summary={summary}
              config={config}
              commit={commit}
              onViewInvoices={onClose}
              onRollback={rollback}
            />
          )}
        </div>

        {/* ── How it works: slide-over guide inside the shell ── */}
        {guideOpen && <ImportGuidePanel onClose={() => setGuideOpen(false)} />}

        {/* ── Footer ── */}
        {!committed && !running && (
          <div className="px-3 sm:px-5 py-3 border-t border-slate-100 bg-white shrink-0 flex items-center justify-between gap-3">
            <p className="text-[11.5px] text-slate-400 min-w-0 truncate" style={{ fontWeight: 400 }}>
              {step === 'setup' && (config.mode === 'migration'
                ? `Migration into ${fmtPeriod(config.postingPeriod)} · offsets to ${config.clearingAccount || 'the clearing account'}`
                : 'Ongoing batch · every invoice lands at Pending Approval')}
              {step === 'upload' && (uploads.invoices ? `${uploadedKeys.length} file${uploadedKeys.length === 1 ? '' : 's'} parsed` : 'One file is enough. Payments and credit memos are optional')}
              {step === 'map' && (mapMissing === 0 ? 'Every required field has a source column' : `${mapMissing} required field${mapMissing === 1 ? '' : 's'} unmapped`)}
              {step === 'review' && `${counts.ready} ready · ${counts.blocker} blockers · ${counts.exception} exceptions · ${counts.warning} warnings${counts.excluded ? ` · ${counts.excluded} excluded` : ''}`}
              {step === 'commit' && `${summary.invoiceCount} invoices will be created${counts.exception > 0 ? `, ${counts.exception} into the Exception queue` : ''}`}
            </p>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={requestClose}
                className="h-9 px-3.5 rounded-lg border border-border bg-white hover:bg-slate-50 text-slate-700 text-[13px] transition-all cursor-pointer"
                style={{ fontWeight: 500 }}
              >
                Cancel
              </button>
              {step !== 'commit' ? (
                <button
                  type="button"
                  onClick={() => {
                    if (continueBlockedReason) {
                      toast.error('Not ready to continue', { description: continueBlockedReason });
                      return;
                    }
                    advance();
                  }}
                  title={continueBlockedReason ?? undefined}
                  className="h-9 px-4 rounded-lg text-[13px] text-white bg-primary hover:bg-primary/90 transition-colors cursor-pointer border-0"
                  style={{ fontWeight: 600 }}
                >
                  {step === 'review' ? 'Continue to Simulate' : 'Continue'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (summary.invoiceCount === 0) {
                      toast.error('Nothing to commit', { description: 'No invoices made it through the checks.' });
                      return;
                    }
                    setConfirmOpen(true);
                  }}
                  title={summary.invoiceCount === 0 ? 'Nothing to commit' : undefined}
                  className="h-9 px-4 rounded-lg text-[13px] text-white bg-primary hover:bg-primary/90 transition-colors cursor-pointer border-0"
                  style={{ fontWeight: 600 }}
                >
                  Commit {summary.invoiceCount} Invoice{summary.invoiceCount === 1 ? '' : 's'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Commit confirmation: exactly what is about to happen. ── */}
      {confirmOpen && (
        <div
          className="fixed inset-0 z-[180] flex items-center justify-center bg-black/70 p-4 animate-in fade-in duration-150"
          onClick={() => setConfirmOpen(false)}
        >
          <div
            className="relative bg-white w-full sm:max-w-[420px] rounded-2xl overflow-hidden animate-in zoom-in-95 duration-150"
            style={{ boxShadow: '0 24px 80px -12px rgba(0,0,0,0.25)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="relative flex flex-col items-center pt-10 pb-6"
              style={{ background: 'linear-gradient(180deg, #EFF6FF 0%, rgba(239,246,255,0.3) 70%, transparent 100%)' }}
            >
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full opacity-25 pointer-events-none" style={{ backgroundColor: '#3B82F6', filter: 'blur(50px)' }} />
              <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#DBEAFE' }}>
                <FileSpreadsheet className="w-8 h-8" style={{ color: 'hsl(var(--primary))' }} />
              </div>
              <span className="mt-4 px-3 py-1 rounded-full text-[11px]" style={{ fontWeight: 600, backgroundColor: '#EFF6FF', color: '#1D4ED8',  }}>
                Commit Import
              </span>
            </div>
            <div className="flex flex-col items-center text-center px-8 pb-8">
              <h3 className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                Commit {summary.invoiceCount} invoice{summary.invoiceCount === 1 ? '' : 's'}?
              </h3>
              <p className="text-[13px] mt-2 mx-auto" style={{ color: 'hsl(var(--muted-foreground))', lineHeight: 1.65, maxWidth: '320px' }}>
                {summary.paymentCount > 0 ? `${summary.paymentCount} payments post with them. ` : ''}
                {counts.exception > 0
                  ? `${counts.exception} exception row${counts.exception === 1 ? '' : 's'} import into the Exception queue and stay out of payment runs until cleared. `
                  : ''}
                The commit is atomic and can be rolled back for 72 hours.
              </p>
              <div className="w-full mt-7 flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={runCommit}
                  className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90"
                  style={{ fontWeight: 600, backgroundColor: 'hsl(var(--primary))', color: '#fff' }}
                >
                  Commit the Import
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmOpen(false)}
                  className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
                  style={{ fontWeight: 500, backgroundColor: '#F8FAFC', color: '#334155' }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F1F5F9'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#F8FAFC'; }}
                >
                  Keep Reviewing
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Discard ask, the amber recipe verbatim. ── */}
      {discardOpen && (
        <div
          className="fixed inset-0 z-[180] flex items-center justify-center bg-black/70 p-4 animate-in fade-in duration-150"
          onClick={() => setDiscardOpen(false)}
        >
          <div
            className="relative bg-white w-full sm:max-w-[420px] rounded-2xl overflow-hidden animate-in zoom-in-95 duration-150"
            style={{ boxShadow: '0 24px 80px -12px rgba(0,0,0,0.25)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="relative flex flex-col items-center pt-10 pb-6"
              style={{ background: 'linear-gradient(180deg, #FEF2F2 0%, rgba(254,242,242,0.3) 70%, transparent 100%)' }}
            >
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full opacity-25 pointer-events-none" style={{ backgroundColor: '#EF4444', filter: 'blur(50px)' }} />
              <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#FEE2E2' }}>
                <AlertTriangle className="w-8 h-8" style={{ color: 'hsl(var(--destructive))' }} />
              </div>
              <span className="mt-4 px-3 py-1 rounded-full text-[11px]" style={{ fontWeight: 600, backgroundColor: '#FEF2F2', color: '#991B1B',  }}>
                Discard
              </span>
            </div>
            <div className="flex flex-col items-center text-center px-8 pb-8">
              <h3 className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                Discard this import?
              </h3>
              <p className="text-[13px] mt-2 mx-auto" style={{ color: 'hsl(var(--muted-foreground))', lineHeight: 1.65, maxWidth: '300px' }}>
                Nothing has committed. The parsed files, mappings and fixes in this import will be lost.
              </p>
              <div className="w-full mt-7 flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() => { setDiscardOpen(false); onClose(); }}
                  className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90"
                  style={{ fontWeight: 600, backgroundColor: 'hsl(var(--destructive))', color: '#fff' }}
                >
                  Discard the Import
                </button>
                <button
                  type="button"
                  onClick={() => setDiscardOpen(false)}
                  className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
                  style={{ fontWeight: 500, backgroundColor: '#F8FAFC', color: '#334155' }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F1F5F9'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#F8FAFC'; }}
                >
                  Keep Working
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
