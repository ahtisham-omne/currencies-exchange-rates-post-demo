/* ── Check print flow (BA spec check-printing-spec.md, 9/22) ──────────
 * Review → Preview → Blocking confirm, per spec §8:
 *  - Review: the payment list with assigned check numbers, warnings
 *    BEFORE paper moves, starting number + (Standard) checks on first
 *    page, and the §9 check-stock block with its Change affordance.
 *  - Preview: the REAL PDF at 100% in the browser's viewer — the import
 *    sheet-preview recipe verbatim — with a stock underlay toggle.
 *  - Confirm: blocking. "Did checks X to Y print correctly?" Nothing is
 *    recorded before this step; a some-failed answer voids from the
 *    first bad number and reprints from a fresh number.
 */

import { TableEmptyState } from '@/app/components/ui/table-empty-state';
import { useEffect, useMemo, useState } from 'react';
import { Search as SearchIcon } from 'lucide-react';
import {
  Printer,
  X,
  AlertTriangle,
  CheckCircle2,
  BookOpen,
  Settings2,
  FileText,
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/app/components/ui/dialog';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { toast } from 'sonner';
import {
  STOCK_PROFILES,
  buildCheckPrintRun,
  checkRegisterFor,
  checkSettingsFor,
  consumedNumbers,
  recordChecks,
  updateCheckSettings,
  voidCheck,
  type CheckAccountSettings,
  type CheckPaymentInput,
  type CheckPrintRun,
  type CheckRegisterEntry,
  type CheckStyle,
} from '@/app/lib/checkPrinting';
import { buildAlignmentGridPdf, buildCheckRunPdf } from '@/app/lib/checkPdf';
import { highlightText } from '@/app/components/InvoiceDataTable';
import { PAY_FROM_ACCOUNTS } from '@/app/data/mockPayments';
import { BASE_CURRENCY } from '@/app/currency/currencies';
import { moneyPrefix } from '@/app/currency/money';

const money = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (iso: string) => {
  const d = new Date(iso.includes('T') ? iso : `${iso}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
};

const PAYER = {
  name: 'OMNE Demo Company',
  address: '2200 Commerce Way, Austin, TX 78701',
};

export interface CheckIssueResult {
  paymentRef: string;
  checkNumbers: number[];
}

interface CheckPrintFlowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bankAccountId: string;
  bankAccountLabel: string;
  payments: CheckPaymentInput[];
  /** Fires once, after the blocking confirm marks everything Issued. */
  onIssued?: (issued: CheckIssueResult[]) => void;
  /** The payment already posted (10/5 single-check spec): the confirm's
   *  copy says so — a failed print can never lose the payment. */
  recordedAlready?: boolean;
  /** Starting number override (10/5 spec step 3): the number typed on
   *  the payment pre-fills here so there is one number everywhere. */
  initialNumber?: number;
}

type Step = 'review' | 'preview' | 'confirm';

export function CheckPrintFlow({
  open,
  onOpenChange,
  bankAccountId,
  bankAccountLabel,
  payments,
  onIssued,
  recordedAlready,
  initialNumber,
}: CheckPrintFlowProps) {
  const [step, setStep] = useState<Step>('review');
  // Settings live in the module store; the tick makes edits re-render.
  const [settingsTick, setSettingsTick] = useState(0);
  const settings = useMemo(() => checkSettingsFor(bankAccountId), [bankAccountId, settingsTick]);
  const [startingInput, setStartingInput] = useState('');
  // Review-list search (user 10/8): the standard icon-led filter over payees.
  const [reviewQuery, setReviewQuery] = useState('');
  const [firstPage, setFirstPage] = useState<1 | 2 | 3>(3);
  const [setupOpen, setSetupOpen] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  // Default OFF (user 10/5): the preview opens showing exactly what
  // prints — payee, amount, date, remittance — with the stock underlay
  // an opt-in reference.
  const [underlay, setUnderlay] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [failedInput, setFailedInput] = useState('');
  const [someFailed, setSomeFailed] = useState(false);
  // Misprint notice lives IN the box (Eli 10/5: the warning that "pops
  // up and disappears" should stay), persisting on the preview through
  // the reprint so the clerk never loses what was voided.
  const [reprintNotice, setReprintNotice] = useState<string | null>(null);
  // Reprint pass: the some-failed path narrows the batch and re-previews.
  const [activePayments, setActivePayments] = useState<CheckPaymentInput[]>(payments);
  const [issuedSoFar, setIssuedSoFar] = useState<CheckIssueResult[]>([]);
  // One payment (single vendor, user 10/15): the review is just the page
  // layout picker with the live preview under it, no number field, no
  // batch tooling. Payment runs keep the full review.
  const singlePayment = activePayments.length === 1;

  useEffect(() => {
    if (open) {
      setStep('review');
      // With no number field on a single check, never land on a number
      // the register already holds; step past it instead.
      let start = initialNumber ?? checkSettingsFor(bankAccountId).nextCheckNumber;
      if (payments.length === 1) {
        const used = new Set(checkRegisterFor(bankAccountId).map((e) => e.number));
        while (used.has(start)) start += 1;
      }
      setStartingInput(String(start));
      setReviewQuery('');
      setFirstPage(3);
      setUnderlay(false);
      setFailedInput('');
      setSomeFailed(false);
      setActivePayments(payments);
      setIssuedSoFar([]);
      setRenderError(null);
      setReprintNotice(null);
    }
  }, [open, bankAccountId, payments]);

  const startingNumber = Math.max(1, parseInt(startingInput.replace(/\D/g, ''), 10) || settings.nextCheckNumber);

  const run: CheckPrintRun = useMemo(
    () => buildCheckPrintRun(activePayments, settings, startingNumber, firstPage),
    [activePayments, settings, startingNumber, firstPage],
  );

  const allWarnings = run.assignments.flatMap((a) => a.warnings.map((w) => ({ payee: a.payee, text: w })));
  const totalAmount = run.assignments.reduce((s, a) => s + a.total, 0);
  const voidCount = run.assignments.reduce((s, a) => s + a.voidNumbers.length, 0);

  // The preview is the real PDF (spec §8.11) — regenerated on entry and
  // when the underlay toggles.
  useEffect(() => {
    const inlinePreview = step === 'review';
    if (step !== 'preview' && !inlinePreview) return;
    let cancelled = false;
    let url: string | null = null;
    setPdfUrl(null);
    setRenderError(null);
    (async () => {
      try {
        url = await buildCheckRunPdf(run, settings, {
          underlay,
          payerName: PAYER.name,
          payerAddress: PAYER.address,
          bankLabel: bankAccountLabel,
        });
        if (!cancelled) setPdfUrl(url);
      } catch (err) {
        // Clear-band violations FAIL the run rather than print through.
        if (!cancelled) setRenderError(err instanceof Error ? err.message : 'Render failed.');
      }
    })();
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, run, settings, underlay, bankAccountLabel, singlePayment]);

  const numbers = consumedNumbers(run);
  const rangeLabel = numbers.length > 1 ? `${numbers[0]} to ${numbers[numbers.length - 1]}` : String(numbers[0] ?? '');
  const checkNoun = numbers.length > 1 ? 'checks' : 'check';
  // Single-check mode (10/5 spec): the ruined path speaks one number and
  // asks for the NEW one instead of "first bad in the batch".
  const singleCheck = numbers.length === 1;

  // Duplicate-number warning (10/5 spec step 3): a number already on the
  // register can't go on a new sheet — the tray has moved past it.
  const duplicateWarning = (() => {
    const register = checkRegisterFor(bankAccountId);
    const hit = register.find((e) => numbers.includes(e.number));
    return hit
      ? `Check ${hit.number} was already used on ${fmtDate(hit.date)}. Enter the number on the top sheet.`
      : null;
  })();

  const openPrint = async () => {
    // The document that goes to paper carries NO underlay — the stock is
    // already printed. Scaling locked at 100 percent (spec §8.12).
    try {
      const url = await buildCheckRunPdf(run, settings, {
        underlay: false,
        payerName: PAYER.name,
        payerAddress: PAYER.address,
        bankLabel: bankAccountLabel,
      });
      window.open(url, '_blank', 'noopener');
      setStep('confirm');
      setSomeFailed(false);
      setFailedInput('');
    } catch (err) {
      setRenderError(err instanceof Error ? err.message : 'Render failed.');
    }
  };

  const finishAllGood = () => {
    const entries: CheckRegisterEntry[] = [];
    const issued: CheckIssueResult[] = [...issuedSoFar];
    // Who confirmed the print, stamped on every issued number (10/5).
    const printedBy = 'Ahtisham Ahmad';
    const printedAt = new Date().toISOString().slice(0, 10);
    for (const a of run.assignments) {
      const p = activePayments.find((x) => x.paymentRef === a.paymentRef);
      a.liveNumbers.forEach((n) =>
        entries.push({ number: n, bankAccountId, status: 'Issued', payee: a.payee, amount: a.total, date: p?.date ?? new Date().toISOString().slice(0, 10), paymentRef: a.paymentRef, printedBy, printedAt }),
      );
      a.voidNumbers.forEach((n) =>
        entries.push({ number: n, bankAccountId, status: 'Void', payee: a.payee, amount: a.total, date: p?.date ?? new Date().toISOString().slice(0, 10), reason: 'stub_overflow', paymentRef: a.paymentRef }),
      );
      issued.push({ paymentRef: a.paymentRef, checkNumbers: a.liveNumbers });
    }
    recordChecks(entries);
    updateCheckSettings(bankAccountId, { nextCheckNumber: run.endingNumber + 1 });
    toast.success(`${checkNoun === 'checks' ? 'Checks' : 'Check'} ${rangeLabel} issued`, {
      description: `Next check number is ${run.endingNumber + 1}. Remittance emails queued.`,
    });
    onIssued?.(issued);
    onOpenChange(false);
  };

  const [failedError, setFailedError] = useState(false);
  const applySomeFailed = () => {
    const firstBad = parseInt(failedInput.replace(/\D/g, ''), 10);
    if (!firstBad || firstBad < numbers[0] || firstBad > numbers[numbers.length - 1]) {
      setFailedError(true);
      toast.error('Check number needed', { description: `Enter a check number between ${numbers[0]} and ${numbers[numbers.length - 1]}.` });
      return;
    }

    const entries: CheckRegisterEntry[] = [];
    const stillIssued: CheckIssueResult[] = [];
    const failedPayments: CheckPaymentInput[] = [];
    const today = new Date().toISOString().slice(0, 10);

    for (const a of run.assignments) {
      const p = activePayments.find((x) => x.paymentRef === a.paymentRef);
      const failed = a.liveNumbers.some((n) => n >= firstBad) || a.voidNumbers.some((n) => n >= firstBad);
      if (!failed) {
        a.liveNumbers.forEach((n) =>
          entries.push({ number: n, bankAccountId, status: 'Issued', payee: a.payee, amount: a.total, date: p?.date ?? today, paymentRef: a.paymentRef }),
        );
        a.voidNumbers.forEach((n) =>
          entries.push({ number: n, bankAccountId, status: 'Void', payee: a.payee, amount: a.total, date: p?.date ?? today, reason: 'stub_overflow', paymentRef: a.paymentRef }),
        );
        stillIssued.push({ paymentRef: a.paymentRef, checkNumbers: a.liveNumbers });
      } else {
        // That check and everything after is voided; the number stays
        // consumed (spec §8.13). Reprint resumes from a new number.
        [...a.liveNumbers, ...a.voidNumbers]
          .sort((x, y) => x - y)
          .forEach((n) =>
            entries.push({
              number: n, bankAccountId, status: 'Void', payee: a.payee, amount: a.total,
              date: p?.date ?? today,
              reason: n >= firstBad ? 'print_failure' : 'stub_overflow',
              paymentRef: a.paymentRef,
            }),
          );
        if (p) failedPayments.push(p);
      }
    }
    recordChecks(entries);
    updateCheckSettings(bankAccountId, { nextCheckNumber: run.endingNumber + 1 });
    setSettingsTick((t) => t + 1);
    setIssuedSoFar((prev) => [...prev, ...stillIssued]);
    setActivePayments(failedPayments);
    setStartingInput(String(run.endingNumber + 1));
    setSomeFailed(false);
    setFailedInput('');
    setReprintNotice(
      `Checks ${firstBad} to ${run.endingNumber} were voided as damaged. Those numbers stay consumed on the register. Reprint resumes from ${run.endingNumber + 1}.`,
    );
    setStep('preview');
  };

  const isPreview = step === 'preview';

  return (
    <>
      {/* The register REPLACES the print dialog while open (user 9/25):
          two centered dialogs stacked with doubled overlays read as a
          glitch — the export flow's preview swap, same recipe. */}
      <Dialog open={open && !registerOpen} onOpenChange={step === 'confirm' ? () => {} : onOpenChange}>
        <DialogContent
          showCloseButton={false}
          className={`p-0 overflow-hidden gap-0 rounded-2xl border-0 flex flex-col ${
            isPreview
              ? 'max-w-[95vw] sm:max-w-[1220px] h-[92vh]'
              : step === 'confirm'
                ? 'max-w-[calc(100%-2rem)] sm:max-w-[440px]'
                : 'max-w-[calc(100%-2rem)] sm:max-w-[860px] h-[92vh]'
          }`}
          style={{ boxShadow: '0 24px 80px -12px rgba(0,0,0,0.25)' }}
          // The confirm step is BLOCKING (spec §8.13): only its own
          // answers move the flow forward.
          onInteractOutside={(e) => { if (step === 'confirm') e.preventDefault(); }}
          onEscapeKeyDown={(e) => { if (step === 'confirm') e.preventDefault(); }}
        >
          {step === 'review' && (
            <>
              <div className="px-4 sm:px-5 pt-3.5 pb-3.5 bg-white border-b border-slate-100 flex items-start justify-between gap-3 shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                    <Printer className="w-5 h-5 text-blue-600" strokeWidth={2} />
                  </div>
                  <div className="min-w-0">
                    <DialogTitle className="text-[15px] sm:text-[16px] text-foreground" style={{ fontWeight: 700, lineHeight: 1.3 }}>
                      {singlePayment ? 'Print Check' : 'Print Checks'}
                    </DialogTitle>
                    <DialogDescription className="text-[11px] sm:text-xs mt-0.5 text-slate-500" style={{ lineHeight: 1.5 }}>
                      {bankAccountLabel} · {activePayments.length} payment{activePayments.length === 1 ? '' : 's'} · {money(totalAmount)}
                    </DialogDescription>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-500 hover:bg-muted transition-all cursor-pointer shrink-0"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className={`px-4 sm:px-5 pt-4 pb-5 text-left flex-1 min-h-0 flex flex-col gap-3.5`}>
                {/* Check layout — the three ways a check sits on the sheet.
                    Pick one, then Preview shows exactly what prints. */}
                <div>
                  <p className="text-[11px] text-slate-500 mb-2" style={{ fontWeight: 600 }}>How should the check sit on the page?</p>
                  <div className="grid grid-cols-3 gap-2.5">
                    {([
                      { style: 'voucher' as const, label: 'Check on Top', diagram: ['check', 'stub', 'stub'] },
                      { style: 'middle' as const, label: 'Check in Middle', diagram: ['stub', 'check', 'stub'] },
                      { style: 'standard' as const, label: 'Plain Stacked', diagram: ['check', 'check', 'check'] },
                    ]).map((opt) => {
                      const active = settings.style === opt.style;
                      return (
                        <button
                          key={opt.style}
                          type="button"
                          aria-pressed={active}
                          onClick={() => { updateCheckSettings(bankAccountId, { style: opt.style }); setSettingsTick((t) => t + 1); }}
                          className={`rounded-xl border p-2.5 text-left cursor-pointer transition-colors ${
                            active ? 'border-primary bg-accent ring-1 ring-primary/20' : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          {/* Mini page: the live check band is filled, stubs are
                              outlined, so each option reads at a glance. */}
                          <div className="flex flex-col gap-1 w-full items-center mb-2">
                            {opt.diagram.map((role, i) => (
                              <div
                                key={i}
                                className={`w-full h-3 rounded-[3px] ${
                                  role === 'check'
                                    ? active ? 'bg-primary' : 'bg-slate-400'
                                    : 'border border-dashed border-slate-300'
                                }`}
                              />
                            ))}
                          </div>
                          <p className={`text-[11px] leading-tight ${active ? 'text-primary' : 'text-foreground'}`} style={{ fontWeight: 600 }}>
                            {opt.label}
                          </p>
                          <p className="text-[9.5px] text-slate-400 leading-tight mt-0.5">{STOCK_PROFILES[opt.style].description}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Live preview under the picker (user 10/15): the real PDF,
                    re-rendered on every layout change, no extra click. */}
                <div className="flex-1 min-h-[320px] relative rounded-xl overflow-hidden bg-slate-200 border border-slate-200">
                    {renderError ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-8 text-center">
                        <AlertTriangle className="w-6 h-6 text-red-500" />
                        <span className="text-[13px] text-red-600" style={{ fontWeight: 600 }}>The check failed validation.</span>
                        <span className="text-[12px] text-slate-500 max-w-[480px]">{renderError}</span>
                      </div>
                    ) : pdfUrl ? (
                      <iframe title="Check preview" src={pdfUrl} className="absolute inset-0 w-full h-full border-0" />
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                        <div className="w-8 h-8 rounded-full border-2 border-slate-300 border-t-primary animate-spin" />
                        <span className="text-[12px] text-slate-500">Rendering check…</span>
                      </div>
                    )}
                  </div>

                {/* Several checks on standard stock: use up a partial sheet. */}
                {settings.style === 'standard' && !singlePayment && (
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>Checks on First Page</span>
                    <div className="flex gap-1.5">
                      {([1, 2, 3] as const).map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setFirstPage(n)}
                          className={`w-9 h-8 rounded-md border text-[12px] cursor-pointer transition-colors ${
                            firstPage === n ? 'border-primary bg-accent text-primary' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                          }`}
                          style={{ fontWeight: 600 }}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                    <span className="text-[11px] text-slate-400">Use up a partial sheet already in the tray.</span>
                  </div>
                )}
                {/* Warnings collapse to one line (user 10/15): the payees and
                    numbers already sit on the screen behind this dialog. */}
                {allWarnings.length > 0 && (
                  <p className="flex items-center gap-2 text-[11px] text-amber-800 shrink-0">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    {allWarnings.length === 1
                      ? `${allWarnings[0].payee}. ${allWarnings[0].text}`
                      : `${new Set(allWarnings.map((w) => w.payee)).size} checks have warnings. ${allWarnings[0].payee}: ${allWarnings[0].text}`}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 px-4 sm:px-5 py-3 border-t border-slate-100 bg-white shrink-0">
                <span className="mr-auto" />
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="h-9 px-4 rounded-lg border border-border bg-white text-[13px] text-muted-foreground hover:bg-slate-50 transition-all cursor-pointer"
                  style={{ fontWeight: 500 }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (activePayments.length === 0) {
                      toast.error('Nothing to print', { description: 'Every check payment in this batch is voided.' });
                      return;
                    }
                    // Never print a used number (10/5): the CTA stays
                    // live, the click names the exact fix.
                    if (duplicateWarning) {
                      toast.error('Check number already used', { description: duplicateWarning });
                      return;
                    }
                    // The preview is already on screen (user 10/15): print
                    // straight away, no separate preview step.
                    if (renderError) {
                      toast.error('Check failed validation', { description: renderError });
                      return;
                    }
                    if (!pdfUrl) {
                      toast.info('Preview still rendering', { description: 'Print opens as soon as the check finishes rendering.' });
                      return;
                    }
                    openPrint();
                  }}
                  className="h-9 px-4 rounded-lg border-0 text-[13px] bg-primary text-white shadow-sm cursor-pointer transition-opacity hover:opacity-90 inline-flex items-center gap-1.5"
                  style={{ fontWeight: 500 }}
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print Now
                </button>
              </div>
            </>
          )}

          {isPreview && (
            <>
              <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-white shrink-0">
                <div className="min-w-0">
                  <DialogTitle className="text-[13px] text-foreground whitespace-nowrap" style={{ fontWeight: 600 }}>
                    {checkNoun === 'checks' ? 'Checks' : 'Check'} {rangeLabel} · Preview at 100%
                  </DialogTitle>
                  <DialogDescription className="text-[11px] text-slate-500 mt-0.5">
                    {run.sheets.length} sheet{run.sheets.length === 1 ? '' : 's'} · {STOCK_PROFILES[settings.style].displayName} · what you see is the document that prints
                  </DialogDescription>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-600 cursor-pointer select-none" style={{ fontWeight: 500 }}>
                    <input
                      type="checkbox"
                      checked={underlay}
                      onChange={(e) => setUnderlay(e.target.checked)}
                      className="accent-[#0A77FF]"
                    />
                    Show Preprinted Stock
                  </label>
                  <button
                    type="button"
                    onClick={() => onOpenChange(false)}
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-500 hover:bg-muted transition-colors cursor-pointer"
                    aria-label="Close preview"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              {/* Misprint notice stays IN the box (Eli 10/5): a persistent
                  amber banner, not a toast that vanishes, so the clerk
                  keeps seeing what was voided through the reprint. */}
              {reprintNotice && (
                <div className="flex items-start gap-2 px-4 py-2.5 bg-amber-50 border-b border-amber-200 shrink-0">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" />
                  <p className="text-[11.5px] text-amber-800 leading-snug" style={{ fontWeight: 500 }}>
                    {reprintNotice}
                  </p>
                  <button
                    type="button"
                    onClick={() => setReprintNotice(null)}
                    className="ml-auto shrink-0 text-amber-500 hover:text-amber-700 transition-colors cursor-pointer"
                    aria-label="Dismiss notice"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              <div className="flex-1 relative bg-slate-200 min-h-0">
                {renderError ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-8 text-center">
                    <AlertTriangle className="w-6 h-6 text-red-500" />
                    <span className="text-[13px] text-red-600" style={{ fontWeight: 600 }}>The run failed validation.</span>
                    <span className="text-[12px] text-slate-500 max-w-[480px]">{renderError}</span>
                  </div>
                ) : pdfUrl ? (
                  <iframe title="Check preview" src={pdfUrl} className="absolute inset-0 w-full h-full border-0" />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                    <div className="w-8 h-8 rounded-full border-2 border-slate-300 border-t-primary animate-spin" />
                    <span className="text-[12px] text-slate-500">Rendering checks…</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 px-4 py-3 border-t border-border bg-white shrink-0">
                <p className="mr-auto text-[10px] text-slate-400">
                  Print at 100 percent. Fit to page off. The stock underlay never prints.
                </p>
                <button
                  type="button"
                  onClick={() => setStep('review')}
                  className="h-9 px-4 rounded-lg border border-border bg-white text-[13px] text-muted-foreground hover:bg-slate-50 transition-all cursor-pointer"
                  style={{ fontWeight: 500 }}
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={!!renderError || !pdfUrl}
                  onClick={openPrint}
                  className="h-9 px-4 rounded-lg border-0 text-[13px] bg-primary text-white shadow-sm cursor-pointer transition-opacity hover:opacity-90 disabled:opacity-40 inline-flex items-center gap-1.5"
                  style={{ fontWeight: 500 }}
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print Now
                </button>
              </div>
            </>
          )}

          {step === 'confirm' && (
            <>
              {/* Blocking confirm (spec §8.13): a jam at check 3 of 18
                  mis-numbers fifteen checks and only the human can see
                  it. Nothing posts before this answer. */}
              {/* ONE identity (user 9/25: the blue hero + green primary +
                  amber fill read as three different modals): the confirm
                  commits the print, so it wears the emerald record identity
                  end to end — hero, pill and primary agree; the failure
                  path is a quiet amber-outline secondary. */}
              <div
                className="relative flex flex-col items-center pt-6 pb-4 shrink-0"
                style={{ background: 'linear-gradient(180deg, #ECFDF5 0%, rgba(236,253,245,0.3) 70%, transparent 100%)' }}
              >
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[200px] h-[90px] rounded-full opacity-25 pointer-events-none" style={{ backgroundColor: '#059669', filter: 'blur(50px)' }} />
                <div className="relative w-[56px] h-[56px] rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#D1FAE5' }}>
                  <Printer className="w-7 h-7" style={{ color: '#047857', strokeWidth: 2 }} />
                </div>
                <span className="mt-2.5 px-3 py-1 rounded-full text-[11px]" style={{ fontWeight: 600, backgroundColor: '#ECFDF5', color: '#047857' }}>
                  Confirm the Print
                </span>
              </div>
              <div className="flex flex-col items-center text-center px-6 shrink-0">
                <DialogTitle className="text-[20px] tracking-[-0.02em] text-foreground" style={{ fontWeight: 600, lineHeight: 1.3 }}>
                  Did {checkNoun} {rangeLabel} print correctly?
                </DialogTitle>
                <DialogDescription className="text-[13px] mt-1.5 mx-auto text-muted-foreground" style={{ lineHeight: 1.6, maxWidth: '360px' }}>
                  {recordedAlready
                    ? 'The payment is already recorded. Your answer only updates the check.'
                    : 'Nothing posts until you answer. Confirming marks the checks Issued, advances the next check number and queues the remittance emails.'}
                </DialogDescription>
              </div>
              {!someFailed ? (
                /* Two outcomes (user 10/21/26, supersedes the 10/5 three):
                   printed → done; a check is damaged → void from the first
                   bad number and reprint from a fresh one. The "not
                   damaged, try again" path is gone. */
                <div className="px-6 pt-4 pb-6 flex flex-col gap-2.5">
                  <button
                    type="button"
                    onClick={finishAllGood}
                    className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-opacity hover:opacity-90 text-white"
                    style={{ fontWeight: 600, backgroundColor: '#059669' }}
                  >
                    {singleCheck ? 'Yes, Printed Correctly' : 'Yes, All Printed Correctly'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSomeFailed(true);
                      // Single-check mode (10/5 5b): the field asks for
                      // the NEW number, prefilled with the next sheet.
                      if (singleCheck) setFailedInput(String(run.endingNumber + 1));
                    }}
                    className="w-full h-11 text-[14px] rounded-xl border cursor-pointer transition-colors bg-white hover:bg-amber-50"
                    style={{ fontWeight: 600, color: '#B45309', borderColor: '#FDE68A' }}
                  >
                    {singleCheck ? 'No, the Check Is Damaged' : 'No, a Check Is Damaged'}
                  </button>
                </div>
              ) : singleCheck ? (
                /* 5b, one check (10/5 spec): void it as a misprint and
                   print again on the next sheet. */
                <div className="px-6 pt-4 pb-6 space-y-3 text-left">
                  <p className="text-[13px] text-foreground text-center" style={{ fontWeight: 600 }}>
                    Void check {numbers[0]} and use a new one.
                  </p>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>New Check Number</Label>
                    <Input
                      value={failedInput}
                      onChange={(e) => { setFailedInput(e.target.value.replace(/\D/g, '')); setFailedError(false); }}
                      className={`h-9 text-[12px] bg-white ${failedError ? 'border-red-400 ring-2 ring-red-100' : ''}`}
                      placeholder={String(run.endingNumber + 1)}
                      autoFocus
                    />
                    <p className="text-[10px] text-slate-400">Read it off the next sheet in the tray.</p>
                    <p className="text-[10px] text-slate-400">
                      Check {numbers[0]} is voided in the check register. The payment keeps its amount and date.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const newNo = parseInt(failedInput, 10);
                      if (!newNo || newNo === numbers[0] || checkRegisterFor(bankAccountId).some((e) => e.number === newNo)) {
                        setFailedError(true);
                        toast.error('New check number needed', { description: 'Enter an unused number off the next sheet in the tray.' });
                        return;
                      }
                      // Void the ruined number (reason Misprint); the new
                      // number drives the reprint and the register moves
                      // past both.
                      const a = run.assignments[0];
                      const p = activePayments[0];
                      recordChecks(
                        [...a.liveNumbers, ...a.voidNumbers].map((num) => ({
                          number: num,
                          bankAccountId,
                          status: 'Void' as const,
                          payee: a.payee,
                          amount: a.total,
                          date: p?.date ?? new Date().toISOString().slice(0, 10),
                          reason: 'misprint',
                          paymentRef: a.paymentRef,
                        })),
                      );
                      updateCheckSettings(bankAccountId, { nextCheckNumber: Math.max(newNo, run.endingNumber + 1) });
                      setSettingsTick((t) => t + 1);
                      setStartingInput(String(newNo));
                      setSomeFailed(false);
                      setFailedInput('');
                      setReprintNotice(
                        `Check ${numbers[0]} was voided as a misprint. That number stays consumed on the register. Reprinting on check ${newNo}.`,
                      );
                      setStep('preview');
                    }}
                    className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-opacity hover:opacity-90 text-white"
                    style={{ fontWeight: 600, backgroundColor: '#B45309' }}
                  >
                    Void and Print Again
                  </button>
                  <button
                    type="button"
                    onClick={() => { setSomeFailed(false); setFailedInput(''); }}
                    className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
                    style={{ fontWeight: 500, backgroundColor: '#F8FAFC', color: '#334155' }}
                  >
                    Go Back
                  </button>
                </div>
              ) : (
                <div className="px-6 pt-4 pb-6 space-y-3 text-left">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>First Bad Check Number</Label>
                    <Input
                      value={failedInput}
                      onChange={(e) => { setFailedInput(e.target.value.replace(/\D/g, '')); setFailedError(false); }}
                      className={`h-9 text-[12px] bg-white ${failedError ? 'border-red-400 ring-2 ring-red-100' : ''}`}
                      placeholder={String(numbers[0] ?? '')}
                      autoFocus
                    />
                    <p className="text-[10px] text-slate-400">
                      That check and everything after is voided. Reprint resumes from {run.endingNumber + 1}.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={applySomeFailed}
                    className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-opacity hover:opacity-90 text-white"
                    style={{ fontWeight: 600, backgroundColor: '#B45309' }}
                  >
                    {(() => {
                      const n = parseInt(failedInput, 10);
                      return n && n >= numbers[0] && n <= numbers[numbers.length - 1]
                        ? `Void ${n} to ${run.endingNumber} and Reprint`
                        : 'Void and Reprint';
                    })()}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setSomeFailed(false); setFailedInput(''); }}
                    className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
                    style={{ fontWeight: 500, backgroundColor: '#F8FAFC', color: '#334155' }}
                  >
                    Go Back
                  </button>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      <CheckSetupModal
        open={setupOpen}
        onOpenChange={setSetupOpen}
        bankAccountId={bankAccountId}
        bankAccountLabel={bankAccountLabel}
        onSaved={() => {
          setSettingsTick((t) => t + 1);
          setStartingInput(String(checkSettingsFor(bankAccountId).nextCheckNumber));
        }}
      />
      <CheckRegisterModal
        open={registerOpen}
        onOpenChange={setRegisterOpen}
        bankAccountId={bankAccountId}
        bankAccountLabel={bankAccountLabel}
      />
    </>
  );
}

/* ── Check printing setup, once per bank account (spec §8.1-6, §9) ──── */

export function CheckSetupModal({
  open,
  onOpenChange,
  bankAccountId,
  bankAccountLabel,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bankAccountId: string;
  bankAccountLabel: string;
  onSaved?: () => void;
}) {
  const [draft, setDraft] = useState<CheckAccountSettings>(() => checkSettingsFor(bankAccountId));

  useEffect(() => {
    if (open) setDraft({ ...checkSettingsFor(bankAccountId) });
  }, [open, bankAccountId]);

  const patch = (p: Partial<CheckAccountSettings>) => setDraft((d) => ({ ...d, ...p }));
  const profile = STOCK_PROFILES[draft.style];
  // Currency & Exchange Rates: the threshold is in the bank account's currency.
  const thresholdPrefix = moneyPrefix(PAY_FROM_ACCOUNTS.find((a) => a.id === bankAccountId)?.currency ?? BASE_CURRENCY)
    .replace('\u200E', '')
    .trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="p-0 overflow-hidden gap-0 rounded-2xl border-0 max-w-[calc(100%-2rem)] sm:max-w-[560px] max-h-[92vh] flex flex-col"
        style={{ boxShadow: '0 24px 80px -12px rgba(0,0,0,0.25)', zIndex: 240 }}
      >
        <div className="px-4 sm:px-5 pt-3.5 pb-3.5 bg-white border-b border-slate-100 flex items-start justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
              <Settings2 className="w-5 h-5 text-blue-600" strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-[15px] sm:text-[16px] text-foreground" style={{ fontWeight: 700, lineHeight: 1.3 }}>
                Check Printing Setup
              </DialogTitle>
              <DialogDescription className="text-[11px] sm:text-xs mt-0.5 text-slate-500" style={{ lineHeight: 1.5 }}>
                {bankAccountLabel} · one record per bank account
              </DialogDescription>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-500 hover:bg-muted transition-all cursor-pointer shrink-0"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 sm:px-5 pt-4 pb-5 space-y-4 text-left flex-1 min-h-0 overflow-y-auto">
          {/* Style — §9 copy verbatim. Never label the voucher option
              "Standard 3 part form": in the check industry, Standard
              means three per page. */}
          <div className="space-y-1.5">
            <Label className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>Check Stock</Label>
            <div className="space-y-1.5">
              {(Object.keys(STOCK_PROFILES) as CheckStyle[]).map((key) => {
                const p = STOCK_PROFILES[key];
                const on = draft.style === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => patch({ style: key })}
                    className={`w-full text-left rounded-lg border p-3 transition-colors cursor-pointer ${on ? 'border-primary bg-primary/[0.04]' : 'border-slate-200 hover:border-slate-300'}`}
                  >
                    <div className="flex items-start gap-2.5">
                      <span className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${on ? 'border-primary' : 'border-slate-300'}`}>
                        {on && <span className="w-2 h-2 rounded-full bg-primary" />}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[12px] text-foreground" style={{ fontWeight: 600 }}>{p.displayName}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">{p.description}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Band heights — seeded 3.5 / 3.5 / 4.0 (spec §8.3). */}
          <div className="space-y-1.5">
            <Label className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>Band Heights</Label>
            <div className="flex items-center gap-2">
              {profile.bands.map((b) => (
                <span key={b.seq} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-50 border border-slate-200 text-[11px] text-slate-600 " style={{ fontWeight: 500 }}>
                  {b.role === 'check' ? 'Check' : b.copy} · {b.height}"
                </span>
              ))}
            </div>
            <p className="text-[10px] text-slate-400">Perforations at 3.5" and 7.0". Band 3 carries a 0.5" tear-off strip. Non standard suppliers arrive with stock profiles.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>Next Check Number</Label>
              <Input
                value={String(draft.nextCheckNumber)}
                onChange={(e) => patch({ nextCheckNumber: Math.max(1, parseInt(e.target.value.replace(/\D/g, ''), 10) || 1) })}
                className="h-9 text-[12px] bg-white"
              />
              <p className="text-[10px] text-slate-400">Read it off the top sheet in the tray.</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>Dual Signature Threshold</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-slate-400">{thresholdPrefix}</span>
                <Input
                  value={draft.dualSignatureThreshold.toLocaleString('en-US')}
                  onChange={(e) => patch({ dualSignatureThreshold: Math.max(0, parseInt(e.target.value.replace(/\D/g, ''), 10) || 0) })}
                  className={`h-9 text-[12px] bg-white ${thresholdPrefix.length <= 1 ? 'pl-7' : thresholdPrefix.length === 2 ? 'pl-9' : 'pl-11'}`}
                />
              </div>
              <p className="text-[10px] text-slate-400">Payments at or above it raise a warning.</p>
            </div>
          </div>

          {/* Overflow policy (spec §6): the two policies the industry
              actually ships. Do not invent a third. */}
          <div className="space-y-1.5">
            <Label className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>Stub Overflow, More Than {draft.maxInvoiceLines} Invoices</Label>
            <div className="space-y-1.5">
              {([
                { key: 'void_and_continue', title: 'Void and Continue', body: 'Earlier sheets print VOID across the check, the final sheet carries the live check and the total. Voided numbers record as stub overflow.' },
                { key: 'cap_and_split', title: 'Cap and Split', body: `Each check covers at most ${draft.maxInvoiceLines} invoices; the payment issues multiple checks.` },
              ] as const).map((o) => {
                const on = draft.overflowPolicy === o.key;
                return (
                  <button
                    key={o.key}
                    type="button"
                    onClick={() => patch({ overflowPolicy: o.key })}
                    className={`w-full text-left rounded-lg border p-3 transition-colors cursor-pointer ${on ? 'border-primary bg-primary/[0.04]' : 'border-slate-200 hover:border-slate-300'}`}
                  >
                    <div className="flex items-start gap-2.5">
                      <span className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${on ? 'border-primary' : 'border-slate-300'}`}>
                        {on && <span className="w-2 h-2 rounded-full bg-primary" />}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[12px] text-foreground" style={{ fontWeight: 600 }}>{o.title}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{o.body}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Alignment (spec §8.6): test grid on blank paper, hold over a
              real check, enter the offsets. */}
          <div className="space-y-1.5">
            <Label className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>Alignment</Label>
            <div className="flex items-end gap-3">
              <div className="space-y-1">
                <span className="block text-[10px] text-slate-400" style={{ fontWeight: 500 }}>Offset X, in</span>
                <Input
                  value={String(draft.offsetX)}
                  onChange={(e) => patch({ offsetX: parseFloat(e.target.value.replace(/[^\d.-]/g, '')) || 0 })}
                  className="h-9 w-24 text-[12px] bg-white"
                />
              </div>
              <div className="space-y-1">
                <span className="block text-[10px] text-slate-400" style={{ fontWeight: 500 }}>Offset Y, in</span>
                <Input
                  value={String(draft.offsetY)}
                  onChange={(e) => patch({ offsetY: parseFloat(e.target.value.replace(/[^\d.-]/g, '')) || 0 })}
                  className="h-9 w-24 text-[12px] bg-white"
                />
              </div>
              <button
                type="button"
                onClick={async () => {
                  const url = await buildAlignmentGridPdf();
                  window.open(url, '_blank', 'noopener');
                }}
                className="h-9 px-3.5 rounded-lg border border-border bg-white text-[12px] text-foreground hover:bg-slate-50 transition-colors cursor-pointer inline-flex items-center gap-1.5"
                style={{ fontWeight: 500 }}
              >
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                Print Test Grid
              </button>
            </div>
            <p className="text-[10px] text-slate-400">Print the grid on blank paper, hold it over a real check and read the offsets. Repeat until correct.</p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-4 sm:px-5 py-3 border-t border-slate-100 bg-white shrink-0">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-9 px-4 rounded-lg border border-border bg-white text-[13px] text-muted-foreground hover:bg-slate-50 transition-all cursor-pointer"
            style={{ fontWeight: 500 }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              updateCheckSettings(bankAccountId, draft);
              onSaved?.();
              onOpenChange(false);
              toast.success('Check printing settings saved', { description: `${bankAccountLabel} prints on ${STOCK_PROFILES[draft.style].displayName} stock from check ${draft.nextCheckNumber}.` });
            }}
            className="h-9 px-4 rounded-lg border-0 text-[13px] bg-primary text-white shadow-sm cursor-pointer transition-opacity hover:opacity-90"
            style={{ fontWeight: 500 }}
          >
            Save Settings
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── Check register (spec §8.16) ──────────────────────────────────────
 * Every number, status, payee per bank account. Gaps must be
 * explainable — voids carry their reason inline. */

const STATUS_STYLES: Record<string, { bg: string; fg: string; border: string }> = {
  Issued: { bg: '#EBF3FF', fg: '#0654BC', border: '#BFDBFE' },
  Cleared: { bg: '#ECFDF5', fg: '#047857', border: '#A7F3D0' },
  Void: { bg: '#F8FAFC', fg: '#64748B', border: '#E2E8F0' },
};

export function CheckRegisterModal({
  open,
  onOpenChange,
  bankAccountId,
  bankAccountLabel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bankAccountId: string;
  bankAccountLabel: string;
}) {
  const [tick, setTick] = useState(0);
  const entries = useMemo(() => checkRegisterFor(bankAccountId), [bankAccountId, tick, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="p-0 overflow-hidden gap-0 rounded-2xl border-0 max-w-[calc(100%-2rem)] sm:max-w-[640px] max-h-[85vh] flex flex-col"
        style={{ boxShadow: '0 24px 80px -12px rgba(0,0,0,0.25)', zIndex: 240 }}
      >
        <div className="px-4 sm:px-5 pt-3.5 pb-3.5 bg-white border-b border-slate-100 flex items-start justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5 text-blue-600" strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-[15px] sm:text-[16px] text-foreground" style={{ fontWeight: 700, lineHeight: 1.3 }}>
                Check Register
              </DialogTitle>
              <DialogDescription className="text-[11px] sm:text-xs mt-0.5 text-slate-500" style={{ lineHeight: 1.5 }}>
                {bankAccountLabel} · every number stays on the record, voids included
              </DialogDescription>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-500 hover:bg-muted transition-all cursor-pointer shrink-0"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">
          {entries.length === 0 ? (
            <TableEmptyState compact kind="no-data" entity={{ singular: 'check', plural: 'checks' }} description="No checks issued from this account yet." />
          ) : (
            <table className="w-full text-[11px]">
              <thead className="bg-slate-50/70 border-b border-slate-100 sticky top-0">
                <tr>
                  <th className="text-left px-4 py-2 text-[9px] text-slate-500" style={{ fontWeight: 600 }}>Check</th>
                  <th className="text-left px-3 py-2 text-[9px] text-slate-500" style={{ fontWeight: 600 }}>Status</th>
                  <th className="text-left px-3 py-2 text-[9px] text-slate-500" style={{ fontWeight: 600 }}>Payee</th>
                  <th className="text-right px-3 py-2 text-[9px] text-slate-500" style={{ fontWeight: 600 }}>Amount</th>
                  <th className="text-left px-3 py-2 text-[9px] text-slate-500" style={{ fontWeight: 600 }}>Date</th>
                  <th className="text-right px-4 py-2 text-[9px] text-slate-500" style={{ fontWeight: 600 }} />
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => {
                  const s = STATUS_STYLES[e.status];
                  return (
                    <tr key={e.number} className="border-b border-slate-100 last:border-b-0">
                      <td className="px-4 py-2 text-foreground" style={{ fontWeight: 600 }}>{e.number}</td>
                      <td className="px-3 py-2">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full border text-[10px]" style={{ fontWeight: 600, backgroundColor: s.bg, color: s.fg, borderColor: s.border }}>
                          {e.status}
                        </span>
                        {e.reason && (
                          <span className="text-[10px] text-slate-400 ml-1.5">{e.reason.replace(/_/g, ' ')}</span>
                        )}
                        {/* Print confirmation trail (user 10/5). */}
                        {e.printedBy && (
                          <span className="text-[10px] text-slate-400 ml-1.5">printed by {e.printedBy}{e.printedAt ? ` on ${fmtDate(e.printedAt)}` : ''}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-slate-700 truncate max-w-[160px]" style={{ fontWeight: 500 }}>{e.payee}</td>
                      <td className="px-3 py-2 text-right " style={{ fontWeight: 600 }}>{money(e.amount)}</td>
                      <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{fmtDate(e.date)}</td>
                      <td className="px-4 py-2 text-right">
                        {e.status === 'Issued' && (
                          <button
                            type="button"
                            onClick={() => {
                              voidCheck(bankAccountId, e.number, 'manual_void');
                              setTick((t) => t + 1);
                              toast.info(`Check ${e.number} voided`, { description: 'The number stays consumed on the register.' });
                            }}
                            className="text-[10px] text-slate-400 hover:text-red-500 cursor-pointer transition-colors"
                            style={{ fontWeight: 600 }}
                          >
                            Void
                          </button>
                        )}
                        {e.status === 'Cleared' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 inline" />}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
