/* "Import Items" wizard: the upload step (template card, dropzone, uploading
 * / attachment cards, description) and the shell that hands a parsed file to
 * the Review modal. Port of role-zen's import-wizard/ImportWizardModal.tsx +
 * ImportSetupStep.tsx (grid file-card variant, descriptionPlacement
 * "bottom"), parameterised by ITEMS_IMPORT_SPEC. */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Download, FileSpreadsheet, Type, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { ITEMS_IMPORT_SPEC, type EntitySpec, type ItemReviewRow } from "./spec";
import { parseImportFile, type ParseResult } from "./fileParser";
import type { ValidationContext } from "./validation";
import { buildGuideText } from "./templateCsv";
import { AttachmentCard, CARD_GRID_STYLE, UploadingCard } from "./uploadedFileCard";
import { ReadingRoomProvider, guideSectionBlocks } from "./ReadingRoom";
import { HowThisWorksButton, HowThisWorksDrawer } from "./HowThisWorks";
import { ConfirmDialog } from "./dialogs";
import { ImportReviewModal, type ImportOutcome } from "./ImportReviewModal";
import { templateDownloadName } from "./downloadName";

/* ─── Types ─── */

export interface UploadedFile {
  name: string;
  sizeKB: number;
  rows: number;
  fields: number;
}
export type ValidationState = "valid" | "failed";
export interface ImportWizardData {
  importName: string;
  uploadedFile: UploadedFile | null;
  validationState: ValidationState;
  parsedRows: ItemReviewRow[] | null;
}
export const EMPTY_WIZARD: ImportWizardData = { importName: "", uploadedFile: null, validationState: "valid", parsedRows: null };

/** Context for the re-import path launched from an import record. */
export interface CorrectionSetupContext {
  parentName: string;
  fileName: string | null;
  rowCount: number;
  onRedownload: (format: "xlsx" | "csv") => void;
}

export interface ImportWizardModalProps {
  open: boolean;
  onClose: () => void;
  onImportCompleted?: () => void;
  onApplied?: (outcome: ImportOutcome) => void;
  validationContext?: ValidationContext;
  title?: string;
  description?: string;
  parentImportId?: string | null;
  correction?: CorrectionSetupContext | null;
  initialFile?: File | null;
  spec?: EntitySpec;
}

const UPLOAD_DURATION_MS = 850;

function fileExt(name: string): string {
  const m = name.toLowerCase().match(/\.([^.]+)$/);
  return m ? m[1] : "";
}

function isAcceptedFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith(".xlsx") || name.endsWith(".csv");
}

function isImportParseError(err: unknown): err is Error & { code: string } {
  return err instanceof Error && typeof (err as { code?: unknown }).code === "string";
}

/* ─── Shell ─── */

export function ImportWizardModal({
  open,
  onClose,
  onImportCompleted,
  onApplied,
  validationContext,
  title,
  description,
  parentImportId = null,
  correction = null,
  initialFile = null,
  spec = ITEMS_IMPORT_SPEC,
}: ImportWizardModalProps) {
  const [data, setData] = useState<ImportWizardData>({ ...EMPTY_WIZARD });
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [submittedName, setSubmittedName] = useState("");
  const [submittedDescription, setSubmittedDescription] = useState("");
  const [hoveringBlocker, setHoveringBlocker] = useState(false);
  const [howOpen, setHowOpen] = useState(false);
  /* The guide the template ships with, read by the How This Works panel. */
  const howSections = useMemo(() => guideSectionBlocks(buildGuideText(spec)), [spec]);

  const resolvedTitle = title ?? `Import ${spec.nouns.titlePlural}`;
  const resolvedDescription = description ?? `Upload a spreadsheet to add or update ${spec.nouns.plural} in bulk.`;

  useEffect(() => {
    if (!open) return;
    setData({ ...EMPTY_WIZARD });
    setShowDiscardConfirm(false);
    setReviewOpen(false);
    setSubmittedName("");
    setHoveringBlocker(false);
    setHowOpen(false);
  }, [open]);

  const update = useCallback(<K extends keyof ImportWizardData>(key: K, value: ImportWizardData[K]) => {
    setData((prev) => ({ ...prev, [key]: value }));
  }, []);

  const isDirty = data.importName.trim().length > 0 || !!data.uploadedFile;
  const handleAttemptClose = useCallback(() => {
    if (reviewOpen) return;
    if (isDirty) {
      setShowDiscardConfirm(true);
      return;
    }
    onClose();
  }, [reviewOpen, isDirty, onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (reviewOpen || howOpen) return;
      if (showDiscardConfirm) {
        setShowDiscardConfirm(false);
        return;
      }
      handleAttemptClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, reviewOpen, showDiscardConfirm, handleAttemptClose]);

  const canProceed = !!data.uploadedFile && !!data.parsedRows && data.validationState === "valid";
  const handleProceed = useCallback(() => {
    if (!data.uploadedFile || !data.parsedRows || data.validationState !== "valid") return;
    const typed = data.importName.trim();
    const fileStem = data.uploadedFile.name.replace(/\.[^.]+$/, "");
    setSubmittedName(typed || fileStem);
    setSubmittedDescription(typed);
    setReviewOpen(true);
  }, [data.importName, data.uploadedFile, data.parsedRows, data.validationState]);

  const fileMissing = !data.uploadedFile;
  const blockerMessage = fileMissing ? "Upload a file to continue." : null;
  const highlightMissing = hoveringBlocker ? fileMissing : false;

  if (typeof document === "undefined") return null;

  return createPortal(
    <TooltipProvider delayDuration={200}>
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="wizard-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100]"
              onClick={handleAttemptClose}
            />
            <div className="fixed inset-0 z-[101] flex items-center justify-center p-4 sm:p-6 pointer-events-none">
              <motion.div
                key="wizard-panel"
                initial={{ opacity: 0, scale: 0.96, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 16 }}
                transition={{ type: "spring", duration: 0.35, bounce: 0.1 }}
                onClick={(e) => e.stopPropagation()}
                className="relative bg-white flex flex-col overflow-hidden pointer-events-auto w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] max-h-[100dvh] rounded-2xl sm:w-[min(58vw,880px)] sm:max-w-[min(58vw,880px)] sm:h-auto sm:max-h-[90vh]"
                style={{ boxShadow: "0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)" }}
                role="dialog"
                aria-modal="true"
                aria-label={resolvedTitle}
              >
                <ReadingRoomProvider modalBorderRadius={16}>
                  {/* Header */}
                  <div className="px-4 lg:px-5 py-4 shrink-0 bg-white border-b border-[#EEF2F6]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="text-[#0F172A]" style={{ fontSize: "17px", fontWeight: 700 }}>
                          {resolvedTitle}
                        </h2>
                        <p className="text-[#64748B] mt-0.5" style={{ fontSize: "12px" }}>
                          {resolvedDescription}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <HowThisWorksButton onClick={() => setHowOpen(true)} />
                        <button
                          type="button"
                          onClick={handleAttemptClose}
                          className="w-8 h-8 rounded-[8px] flex items-center justify-center text-[#94A3B8] hover:text-[#64748B] hover:bg-[#F1F5F9] transition-colors cursor-pointer shrink-0"
                          aria-label="Close"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Body */}
                  <div className="flex-1 min-h-0 overflow-y-auto bg-[#F8FAFC]">
                    <div className="px-4 lg:px-5 py-4 lg:py-5">
                      <ImportSetupStep
                        data={data}
                        onChange={update}
                        highlightMissingFile={highlightMissing}
                        correction={correction}
                        initialFile={initialFile}
                        spec={spec}
                      />
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="shrink-0 border-t border-[#EEF2F6] bg-white px-4 lg:px-5 py-2.5 sm:py-3 flex items-center justify-end gap-2 sm:gap-2.5">
                    <button
                      type="button"
                      onClick={handleAttemptClose}
                      className="inline-flex items-center justify-center px-3 sm:px-5 h-8 sm:h-9 rounded-[8px] border border-[#E2E8F0] bg-white text-[#64748B] hover:text-[#0F172A] hover:border-[#CBD5E1] transition-colors cursor-pointer"
                      style={{ fontSize: "13px", fontWeight: 500 }}
                    >
                      Cancel
                    </button>
                    <ReviewDataButton canProceed={canProceed} blockerMessage={blockerMessage} onProceed={handleProceed} onHoverBlockerChange={setHoveringBlocker} />
                  </div>
                </ReadingRoomProvider>
                <HowThisWorksDrawer open={howOpen} onClose={() => setHowOpen(false)} title={`${spec.nouns.titlePlural} Import Guide`} sections={howSections} hostRadius={16} />
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={open && showDiscardConfirm}
        title="Discard This Import?"
        message="The name and file you added will not be saved."
        confirmLabel="Discard"
        cancelLabel="Keep Editing"
        pill="DISCARD"
        onConfirm={() => {
          setShowDiscardConfirm(false);
          onClose();
        }}
        onCancel={() => setShowDiscardConfirm(false)}
      />

      <ImportReviewModal
        open={open && reviewOpen}
        importName={submittedName}
        importDescription={submittedDescription}
        fileName={data.uploadedFile?.name ?? ""}
        parsedRows={data.parsedRows ?? []}
        sessionParentId={parentImportId}
        validationContext={validationContext}
        onClose={() => setReviewOpen(false)}
        onApplied={onApplied}
        onCompleted={() => {
          setReviewOpen(false);
          onImportCompleted?.();
          onClose();
        }}
        spec={spec}
      />
    </TooltipProvider>,
    document.body,
  );
}

/* ─── Review Data CTA ─── */

function ReviewDataButton({
  canProceed,
  blockerMessage,
  onProceed,
  onHoverBlockerChange,
}: {
  canProceed: boolean;
  blockerMessage: string | null;
  onProceed: () => void;
  onHoverBlockerChange: (hovering: boolean) => void;
}) {
  const button = (
    <button
      type="button"
      onClick={onProceed}
      disabled={!canProceed}
      className="inline-flex items-center gap-1.5 px-3 sm:px-5 h-8 sm:h-9 rounded-[8px] bg-[#0A77FF] hover:bg-[#0066D6] active:bg-[#005BBF] text-white shadow-sm transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      style={{ fontSize: "13px", fontWeight: 600 }}
    >
      Review Import Data
    </button>
  );
  if (!canProceed && blockerMessage) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            tabIndex={0}
            className="inline-block cursor-not-allowed"
            onMouseEnter={() => onHoverBlockerChange(true)}
            onMouseLeave={() => onHoverBlockerChange(false)}
            onFocus={() => onHoverBlockerChange(true)}
            onBlur={() => onHoverBlockerChange(false)}
          >
            <span style={{ pointerEvents: "none" }} className="inline-block">
              {button}
            </span>
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={8} className="z-[200] max-w-[260px] px-3 py-2">
          <span style={{ fontSize: "12.5px", lineHeight: 1.4, fontWeight: 500 }}>{blockerMessage}</span>
        </TooltipContent>
      </Tooltip>
    );
  }
  return button;
}

/* ─── Setup step ─── */

interface ImportSetupStepProps {
  data: ImportWizardData;
  onChange: <K extends keyof ImportWizardData>(key: K, value: ImportWizardData[K]) => void;
  highlightMissingFile?: boolean;
  correction?: CorrectionSetupContext | null;
  initialFile?: File | null;
  spec: EntitySpec;
}

export function ImportSetupStep({ data, onChange, highlightMissingFile, correction, initialFile, spec }: ImportSetupStepProps) {
  const [uploading, setUploading] = useState(false);
  const [pendingFile, setPendingFile] = useState<{ name: string; sizeKB: number } | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const uploadCancelledRef = useRef(false);
  const progressRafRef = useRef(0);
  const timersRef = useRef<number[]>([]);
  const initialFileRef = useRef<File | null>(null);

  useEffect(() => {
    return () => {
      timersRef.current.forEach((t) => clearTimeout(t));
      cancelAnimationFrame(progressRafRef.current);
    };
  }, []);

  const previewFields = useMemo(() => spec.columns.slice(0, 5).map((c) => c.label), [spec]);
  const remainingFields = useMemo(() => spec.columns.slice(5).map((c) => c.label), [spec]);

  /* Template download + guide drawer */
  const saveTemplateFile = (filename: string) => {
    const a = document.createElement("a");
    a.href = `/templates/${filename}`;
    a.download = templateDownloadName(filename);
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDownload = (format: "excel" | "csv") => {
    const filename = format === "csv" ? spec.files.csv : spec.files.xlsx;
    saveTemplateFile(filename);
    const companionGuide = format === "csv" ? spec.files.guide : null;
    if (companionGuide) {
      const t = window.setTimeout(() => saveTemplateFile(companionGuide), 400);
      timersRef.current.push(t);
    }
    toast.success("Template downloaded", {
      description: companionGuide ? `${filename} and ${companionGuide}` : filename,
      duration: 3000,
    });
    /* The guide no longer opens on download; it lives behind How This Works. */
  };

  /* Accept / parse */
  const acceptFile = useCallback(
    (file: File, force = false) => {
      if (!isAcceptedFile(file)) {
        toast.error("Unsupported file type", { description: "Upload an Excel (.xlsx) or CSV (.csv) file." });
        return;
      }
      if (uploading || (!force && data.uploadedFile)) return;
      uploadCancelledRef.current = false;
      setUploading(true);
      setPendingFile({ name: file.name, sizeKB: Math.max(1, Math.round(file.size / 1024)) });
      setUploadProgress(0);
      const startedAt = performance.now();
      const parsePromise: Promise<ParseResult | unknown> = parseImportFile(file, spec).catch((err: unknown) => err);
      const tick = (now: number) => {
        if (uploadCancelledRef.current) return;
        const ratio = Math.min(1, (now - startedAt) / UPLOAD_DURATION_MS);
        setUploadProgress(Math.round(ratio * 100));
        if (ratio < 1) progressRafRef.current = requestAnimationFrame(tick);
      };
      progressRafRef.current = requestAnimationFrame(tick);
      const finish = (parsed: ParseResult | unknown) => {
        if (uploadCancelledRef.current) return;
        cancelAnimationFrame(progressRafRef.current);
        setPendingFile(null);
        if (parsed instanceof Error) {
          setUploading(false);
          const description = isImportParseError(parsed)
            ? parsed.message
            : "We couldn't read this file. Make sure it's a valid Excel (.xlsx) or CSV (.csv) export.";
          toast.error("Couldn't read this file", { description });
          return;
        }
        const result = parsed as ParseResult;
        const uploaded: UploadedFile = {
          name: file.name,
          sizeKB: Math.max(1, Math.round(file.size / 1024)),
          rows: result.rows.length,
          fields: result.matchedFieldCount,
        };
        onChange("uploadedFile", uploaded);
        onChange("parsedRows", result.rows);
        onChange("validationState", "valid");
        setUploading(false);
        toast.success("File uploaded.", { description: uploaded.name });
      };
      parsePromise.then((parsed) => {
        if (uploadCancelledRef.current) return;
        const elapsed = performance.now() - startedAt;
        const remaining = Math.max(0, UPLOAD_DURATION_MS - elapsed);
        const t = window.setTimeout(() => finish(parsed), remaining);
        timersRef.current.push(t);
      });
    },
    [uploading, data.uploadedFile, onChange, spec],
  );

  useEffect(() => {
    if (!initialFile || initialFileRef.current === initialFile) return;
    initialFileRef.current = initialFile;
    acceptFile(initialFile, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFile]);

  const handleCancelUpload = () => {
    uploadCancelledRef.current = true;
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current = [];
    cancelAnimationFrame(progressRafRef.current);
    setUploading(false);
    setPendingFile(null);
    setUploadProgress(0);
  };

  const handleRemoveFile = () => {
    onChange("uploadedFile", null);
    onChange("parsedRows", null);
    onChange("validationState", "valid");
  };

  const templateBlock = correction ? (
    <CorrectionBar correction={correction} />
  ) : (
    <div
      className="flex items-center gap-3 rounded-[8px] bg-[#EFF6FF] px-3 py-2.5"
      style={{ minHeight: 58, border: "1.5px solid #BFDBFE", boxShadow: "0 1px 2px 0 rgba(0,0,0,0.05)" }}
    >
      <div className="shrink-0 flex items-center justify-center rounded-[6px] bg-[#DBEAFE]" style={{ width: 32, height: 32 }}>
        <FileSpreadsheet style={{ width: 18, height: 18, color: "#3B82F6" }} aria-hidden />
      </div>
      <div className="min-w-0 flex-1 leading-tight">
        <p className="text-[#0F172A]" style={{ fontSize: "13px", fontWeight: 500 }}>
          Download the Import Template
        </p>
        <p className="text-[#64748B] mt-0.5" style={{ fontSize: "12px" }}>
          Includes {previewFields.join(", ")} and <FieldsPopover count={remainingFields.length} fields={remainingFields} />
        </p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <TemplateButton label="Excel" onClick={() => handleDownload("excel")} />
        <TemplateButton label="CSV" onClick={() => handleDownload("csv")} />
      </div>
    </div>
  );

  return (
    <div className="flex flex-col" style={{ minHeight: 540 }}>
      <div>{templateBlock}</div>
      <div style={{ marginTop: 20 }}>
        <FieldLabel required>Upload Your File</FieldLabel>
        <UploadCard
          uploading={uploading}
          file={data.uploadedFile}
          onAcceptFile={acceptFile}
          onRemove={handleRemoveFile}
          highlightMissing={!!highlightMissingFile}
          pendingFile={pendingFile}
          uploadProgress={uploadProgress}
          onCancelUpload={handleCancelUpload}
        />
      </div>
      {!correction && (
        <div style={{ marginTop: 20 }}>
          <div className="flex items-center gap-1.5 mb-1.5">
            <label className="text-[#0F172A]" style={{ fontSize: "13px", fontWeight: 500 }}>
              Import Description
            </label>
            <span className="text-[#94A3B8]" style={{ fontSize: "12px", fontWeight: 400 }}>
              (Optional)
            </span>
          </div>
          <textarea
            value={data.importName}
            onChange={(e) => onChange("importName", e.target.value)}
            placeholder="e.g. Q3 2026 catalog refresh. A short note that helps you find this import later."
            rows={3}
            className={cn(
              "w-full px-3 py-2.5 text-sm bg-white border rounded-md shadow-sm placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#0A77FF]/20 transition-colors resize-y block",
              "border-[#E2E8F0] focus:border-[#0A77FF]",
            )}
            style={{ minHeight: 76, marginTop: 0, marginBottom: 0 }}
          />
          <p className="text-[12px] text-[#64748B]" style={{ marginTop: 4, marginBottom: 0, lineHeight: 1.4 }}>
            Helps you find the import later in your history. It does not affect the file.
          </p>
        </div>
      )}
    </div>
  );
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <div className="flex items-center gap-1 mb-1.5">
      <label className="text-[#0F172A]" style={{ fontSize: "13px", fontWeight: 500 }}>
        {children}
      </label>
      {required && (
        <span className="text-[#EF4444]" style={{ fontSize: "13px" }}>
          *
        </span>
      )}
    </div>
  );
}

function TemplateButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center justify-center gap-1 h-8 px-2.5 rounded-[6px] border border-[#0A77FF] bg-white text-[#0A77FF] hover:bg-[#0A77FF] hover:text-white active:bg-[#0066D6] active:border-[#0066D6] transition-colors cursor-pointer"
      style={{ fontSize: "12px", fontWeight: 500, minWidth: 76 }}
    >
      <Download className="w-3 h-3" />
      {label}
    </button>
  );
}

function FieldsPopover({ count, fields }: { count: number; fields: string[] }) {
  return (
    <HoverCard openDelay={120} closeDelay={80}>
      <HoverCardTrigger asChild>
        <button type="button" className="inline cursor-pointer text-[#0A77FF] hover:underline underline-offset-2" style={{ fontSize: "12px", fontWeight: 500 }}>
          +{count} more
        </button>
      </HoverCardTrigger>
      <HoverCardContent
        side="bottom"
        align="start"
        sideOffset={6}
        className="z-[200] w-[240px] p-0 rounded-lg border border-[#E2E8F0] bg-white shadow-[0_8px_24px_-8px_rgba(15,23,42,0.18),0_2px_6px_-2px_rgba(15,23,42,0.08)]"
      >
        <div className="flex items-center justify-between px-3.5 pt-3 pb-2" style={{ fontSize: "11px", fontWeight: 600, color: "#94A3B8", letterSpacing: "0.06em" }}>
          <span>FIELDS</span>
          <span>{count}</span>
        </div>
        <div className="overflow-y-auto px-1.5 pb-1" style={{ maxHeight: 224, scrollbarWidth: "thin", scrollbarColor: "#CBD5E1 transparent" }}>
          {fields.map((name) => (
            <div key={name} className="flex items-center gap-2.5 rounded-md px-2 py-1.5 cursor-default transition-colors hover:bg-[#F8FAFC]">
              <div className="shrink-0 flex items-center justify-center rounded-md bg-[#EFF6FF]" style={{ width: 24, height: 24 }}>
                <Type style={{ width: 14, height: 14, color: "#0A77FF" }} aria-hidden />
              </div>
              <span className="text-[#1E293B] truncate" style={{ fontSize: "13px", fontWeight: 500 }} title={name}>
                {name}
              </span>
            </div>
          ))}
        </div>
        <div className="px-3.5 py-2 border-t border-[#F1F5F9] italic" style={{ fontSize: "11px", color: "#94A3B8" }}>
          Scroll for more
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

function CorrectionBar({ correction }: { correction: CorrectionSetupContext }) {
  const rowLabel = `${correction.rowCount} error row${correction.rowCount === 1 ? "" : "s"}`;
  return (
    <div
      className="flex items-center gap-3 rounded-[8px] bg-[#FFFBEB] px-3 py-2.5"
      style={{ minHeight: 58, border: "1.5px solid #FDE68A", boxShadow: "0 1px 2px 0 rgba(0,0,0,0.05)" }}
    >
      <div className="shrink-0 flex items-center justify-center rounded-[6px] bg-[#FEF3C7]" style={{ width: 32, height: 32 }}>
        <FileSpreadsheet style={{ width: 18, height: 18, color: "#B45309" }} aria-hidden />
      </div>
      <div className="min-w-0 flex-1 leading-tight">
        <p className="text-[#0F172A] truncate" style={{ fontSize: "13px", fontWeight: 500 }} title={correction.parentName}>
          Correcting {correction.parentName}
        </p>
        <p className="text-[#92400E] mt-0.5" style={{ fontSize: "12px" }}>
          {correction.fileName
            ? `${rowLabel} went out in ${correction.fileName}. Upload it back once the flagged rows are fixed.`
            : `${rowLabel} to fix. Upload the corrected file once the flagged rows are sorted.`}
        </p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {(["xlsx", "csv"] as const).map((fmt) => (
          <button
            key={fmt}
            type="button"
            onClick={() => correction.onRedownload(fmt)}
            className="inline-flex items-center justify-center gap-1 h-8 px-2.5 rounded-[6px] border border-[#D97706] bg-white text-[#B45309] hover:bg-[#D97706] hover:text-white active:bg-[#B45309] active:border-[#B45309] transition-colors cursor-pointer"
            style={{ fontSize: "12px", fontWeight: 500, minWidth: 76 }}
            aria-label={`Download the error file again as ${fmt === "xlsx" ? "Excel" : "CSV"}`}
          >
            <Download className="w-3 h-3" />
            {fmt === "xlsx" ? "Excel" : "CSV"}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── Dropzone (grid variant) ─── */

function UploadCard({
  uploading,
  file,
  onAcceptFile,
  onRemove,
  highlightMissing,
  pendingFile,
  uploadProgress,
  onCancelUpload,
}: {
  uploading: boolean;
  file: UploadedFile | null;
  onAcceptFile: (file: File) => void;
  onRemove: () => void;
  highlightMissing: boolean;
  pendingFile: { name: string; sizeKB: number } | null;
  uploadProgress: number;
  onCancelUpload: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dropzoneDisabled = uploading || !!file;

  const openPicker = () => {
    if (dropzoneDisabled) return;
    fileInputRef.current?.click();
  };
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) onAcceptFile(f);
    e.target.value = "";
  };
  const handleDragOver = (e: React.DragEvent) => {
    if (dropzoneDisabled) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    if (!isDragging) setIsDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setIsDragging(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (dropzoneDisabled) return;
    const f = e.dataTransfer.files?.[0];
    if (f) onAcceptFile(f);
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
        className="hidden"
        onChange={handleFileInputChange}
        aria-hidden
        tabIndex={-1}
      />
      <div
        onClick={openPicker}
        onDragEnter={handleDragOver}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        aria-disabled={dropzoneDisabled || undefined}
        className={cn(
          "border-2 border-dashed px-3 py-2.5 transition-all",
          dropzoneDisabled ? "cursor-default" : "cursor-pointer",
          isDragging
            ? "border-[#0A77FF] bg-[rgba(214,232,255,0.30)]"
            : highlightMissing
              ? "border-[#EF4444] bg-[#FEF2F2]"
              : cn("border-[#EAEBF0] bg-white", !dropzoneDisabled && "hover:border-[#CBD5E1] hover:bg-[#FAFBFC]"),
        )}
        style={{ borderRadius: 10 }}
      >
        <div className="flex items-center gap-3 text-left">
          <div
            className={cn("w-9 h-9 flex items-center justify-center shrink-0 transition-colors", isDragging ? "bg-[#D6E8FF] text-[#0A77FF]" : "bg-[#F7F7F8] text-[#94A3B8]")}
            style={{ borderRadius: 10 }}
          >
            <Upload className={cn("w-4 h-4", uploading && "animate-pulse")} />
          </div>
          <div className="flex flex-col min-w-0">
            <p className="text-sm" style={{ fontWeight: 500, color: "#0F172A" }}>
              {uploading ? (
                <span style={{ color: "#0A77FF" }}>Uploading Your File</span>
              ) : file ? (
                <>
                  1 file added. <span style={{ color: "#0A77FF" }}>Add Another</span>
                </>
              ) : (
                <>
                  <span style={{ color: "#0A77FF" }}>Click to Upload</span>
                  <span> or drag and drop</span>
                </>
              )}
            </p>
            {highlightMissing ? (
              <p className="text-xs mt-0.5" style={{ color: "#EF4444", fontWeight: 500 }}>
                Upload an Excel or CSV file to continue.
              </p>
            ) : (
              <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>
                Excel or CSV. Up to 10 MB.
              </p>
            )}
          </div>
        </div>
      </div>

      {((uploading && pendingFile) || file) && (
        <div style={CARD_GRID_STYLE}>
          {uploading && pendingFile ? (
            <UploadingCard fileName={pendingFile.name} fileSize={`${pendingFile.sizeKB} KB`} ext={fileExt(pendingFile.name)} progress={uploadProgress} onCancel={onCancelUpload} />
          ) : file ? (
            <AttachmentCard att={{ fileName: file.name, fileType: fileExt(file.name), fileSize: `${file.sizeKB} KB` }} onDelete={onRemove} />
          ) : null}
        </div>
      )}
    </>
  );
}
