/* Import wizard (upload step), ported from User Access Control
 * ImportWizardModal + ImportSetupStep + uploadedFileCard, generic over the
 * spec. Steps: setup (this modal) -> review (ImportReviewModal, a second
 * portal above it) -> complete (inside the review modal). */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Download, FileQuestion, FileSpreadsheet, Network, Type, Upload, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { cn } from "../components/ui/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../components/ui/tooltip";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "../components/ui/hover-card";
import type { EntitySpec, ImportRow } from "./spec";
import { parseImportFile, type ParseResult } from "./fileParser";
import { GUIDE_DOWNLOAD_DELAY_MS } from "./templateCsv";
import type { ValidationContext } from "./validation";
import { ImportReviewModal, type ImportOutcome } from "./ImportReviewModal";
import type { ReferenceOptions } from "./reviewParts";
import { ConfirmDialog } from "./ui";
import { HowThisWorksButton, HowThisWorksDrawer } from "./HowThisWorks";

/* ───────────────────────── types ───────────────────────── */

export interface UploadedFile {
  name: string;
  sizeKB: number;
  rows: number;
  fields: number;
}

export interface CorrectionSetupContext {
  parentName: string;
  fileName: string | null;
  rowCount: number;
  onRedownload: (format: "xlsx" | "csv") => void;
}

interface WizardData {
  importName: string;
  uploadedFile: UploadedFile | null;
  validationState: "valid" | "failed";
  parsedRows: ImportRow[] | null;
}

const EMPTY_WIZARD: WizardData = { importName: "", uploadedFile: null, validationState: "valid", parsedRows: null };
const UPLOAD_DURATION_MS = 850;

export interface ImportWizardModalProps {
  spec: EntitySpec<unknown>;
  open: boolean;
  onClose: () => void;
  onImportCompleted?: () => void;
  onApplied?: (outcome: ImportOutcome) => void;
  validationContext?: ValidationContext;
  referenceOptions?: ReferenceOptions;
  title?: string;
  description?: string;
  parentImportId?: string | null;
  correction?: CorrectionSetupContext | null;
  initialFile?: File | null;
}

/* ───────────────────────── modal shell ───────────────────────── */

export function ImportWizardModal({ spec, open, onClose, onImportCompleted, onApplied, validationContext, referenceOptions, title, description, parentImportId = null, correction = null, initialFile = null }: ImportWizardModalProps) {
  const [data, setData] = useState<WizardData>({ ...EMPTY_WIZARD });
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [submittedName, setSubmittedName] = useState("");
  const [submittedDescription, setSubmittedDescription] = useState("");
  const [hoveringBlocker, setHoveringBlocker] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  /* The import guide, read by the How This Works panel. */
  const guideSections = useMemo(() => buildGuideSections(spec), [spec]);
  const navigate = useNavigate();
  /* Every partner belongs to at least one partner group, so a partner import
     is blocked until a group exists. The header toggle previews both states;
     it opens on whichever one the live data calls for. */
  const needsGroups = spec.storageNamespace === "partners";
  const noGroupsYet = needsGroups && (validationContext?.groups?.size ?? 1) === 0;
  const [blocked, setBlocked] = useState(noGroupsYet);

  useEffect(() => {
    if (!open) return;
    setBlocked(noGroupsYet);
    setData({ ...EMPTY_WIZARD });
    setShowDiscardConfirm(false);
    setReviewOpen(false);
    setSubmittedName("");
    setHoveringBlocker(false);
    setGuideOpen(false);
  }, [open]);

  const update = useCallback(<K extends keyof WizardData>(key: K, value: WizardData[K]) => setData((d) => ({ ...d, [key]: value })), []);

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
      if (reviewOpen) return;
      if (guideOpen) return;
      if (showDiscardConfirm) {
        setShowDiscardConfirm(false);
        return;
      }
      handleAttemptClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, reviewOpen, guideOpen, showDiscardConfirm, handleAttemptClose]);

  const canProceed = !blocked && !!data.uploadedFile && !!data.parsedRows && data.validationState === "valid";
  const handleProceed = useCallback(() => {
    if (!data.uploadedFile || !data.parsedRows || data.validationState !== "valid") return;
    const typed = data.importName.trim();
    const fileStem = data.uploadedFile.name.replace(/\.[^.]+$/, "");
    setSubmittedName(typed || fileStem);
    setSubmittedDescription(typed);
    setReviewOpen(true);
  }, [data]);
  const fileMissing = !data.uploadedFile;
  const blockerMessage = blocked
    ? "Add a partner group before importing partners."
    : fileMissing ? "Upload a file to continue." : null;

  const resolvedTitle = title ?? `Import ${spec.entity}`;
  const resolvedDescription = description ?? `Upload a spreadsheet to add or update ${spec.nounPluralLower} in bulk.`;

  return (
    <>
      {createPortal(
        <TooltipProvider delayDuration={200}>
          <AnimatePresence>
            {open && (
              <>
                <motion.div key="wizard-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100]" onClick={handleAttemptClose} />
                <div key="wizard-wrap" className="fixed inset-0 z-[101] flex items-center justify-center p-4 sm:p-6 pointer-events-none">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.96, y: 16 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96, y: 16 }}
                    transition={{ type: "spring", duration: 0.35, bounce: 0.1 }}
                    onClick={(e) => e.stopPropagation()}
                    className="relative bg-white flex flex-col overflow-hidden pointer-events-auto w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] max-h-[100dvh] rounded-2xl sm:w-[min(58vw,880px)] sm:max-w-[min(58vw,880px)] sm:h-auto sm:max-h-[90vh]"
                    style={{ boxShadow: "0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)" }}
                  >
                    <div className="px-4 lg:px-5 py-4 shrink-0 bg-white border-b border-[#EEF2F6]">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h2 className="text-foreground" style={{ fontSize: "17px", fontWeight: 700 }}>
                            {resolvedTitle}
                          </h2>
                          <p className="text-[#64748B] mt-0.5" style={{ fontSize: "12px" }}>
                            {resolvedDescription}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {needsGroups && <ImportStateToggle blocked={blocked} onChange={setBlocked} />}
                          <HowThisWorksButton onClick={() => setGuideOpen(true)} />
                          <button type="button" onClick={handleAttemptClose} className="w-8 h-8 rounded-[8px] flex items-center justify-center text-[#94A3B8] hover:text-[#64748B] hover:bg-muted transition-colors cursor-pointer shrink-0" aria-label="Close">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="flex-1 min-h-0 overflow-y-auto bg-[#F8FAFC]">
                      <div className="px-4 lg:px-5 py-4 lg:py-5">
                        <ImportSetupStep
                          spec={spec}
                          data={data}
                          onChange={update}
                          highlightMissingFile={hoveringBlocker && fileMissing}
                          correction={correction}
                          initialFile={initialFile}
                          blocked={blocked}
                          onGoToGroups={() => {
                            onClose();
                            navigate("/partners/groups");
                          }}
                        />
                      </div>
                    </div>
                    <div className="shrink-0 border-t border-[#EEF2F6] bg-white px-4 lg:px-5 py-2.5 sm:py-3 flex items-center justify-end gap-2 sm:gap-2.5">
                      <button
                        type="button"
                        onClick={handleAttemptClose}
                        className="inline-flex items-center justify-center px-3 sm:px-5 h-8 sm:h-9 rounded-[8px] border border-border bg-white text-[#64748B] hover:text-foreground hover:border-[#CBD5E1] transition-colors cursor-pointer"
                        style={{ fontSize: "13px", fontWeight: 500 }}
                      >
                        Cancel
                      </button>
                      <ReviewDataButton canProceed={canProceed} blockerMessage={blockerMessage} onProceed={handleProceed} onHoverBlockerChange={setHoveringBlocker} />
                    </div>
                    <HowThisWorksDrawer open={guideOpen} onClose={() => setGuideOpen(false)} title={`${spec.entity} Import Guide`} sections={guideSections} hostRadius={16} />
                  </motion.div>
                </div>
              </>
            )}
          </AnimatePresence>
          <ConfirmDialog
            open={open && showDiscardConfirm}
            title="Discard This Import?"
            message="The name and file you added will not be saved."
            pill="Discard"
            confirmLabel="Discard"
            onConfirm={() => {
              setShowDiscardConfirm(false);
              onClose();
            }}
            onCancel={() => setShowDiscardConfirm(false)}
          />
        </TooltipProvider>,
        document.body,
      )}
      <ImportReviewModal
        spec={spec}
        open={open && reviewOpen}
        importName={submittedName}
        importDescription={submittedDescription}
        fileName={data.uploadedFile?.name ?? ""}
        parsedRows={data.parsedRows ?? []}
        sessionParentId={parentImportId}
        validationContext={validationContext}
        referenceOptions={referenceOptions}
        onClose={() => setReviewOpen(false)}
        onApplied={onApplied}
        onCompleted={() => {
          setReviewOpen(false);
          onImportCompleted?.();
          onClose();
        }}
      />
    </>
  );
}

function ReviewDataButton({ canProceed, blockerMessage, onProceed, onHoverBlockerChange }: { canProceed: boolean; blockerMessage: string | null; onProceed: () => void; onHoverBlockerChange: (v: boolean) => void }) {
  const button = (
    <button
      type="button"
      onClick={onProceed}
      disabled={!canProceed}
      className="inline-flex items-center gap-1.5 px-3 sm:px-5 h-8 sm:h-9 rounded-[8px] bg-primary hover:bg-[#0066D6] active:bg-[#005BBF] text-white shadow-sm transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      style={{ fontSize: "13px", fontWeight: 600 }}
    >
      Review Data
      <ArrowRight className="w-3.5 h-3.5" />
    </button>
  );
  if (!canProceed && blockerMessage) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0} className="inline-block cursor-not-allowed" onMouseEnter={() => onHoverBlockerChange(true)} onMouseLeave={() => onHoverBlockerChange(false)} onFocus={() => onHoverBlockerChange(true)} onBlur={() => onHoverBlockerChange(false)}>
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

/* ───────────────────────── setup step ───────────────────────── */

interface SetupProps {
  spec: EntitySpec<unknown>;
  data: WizardData;
  onChange: <K extends keyof WizardData>(key: K, value: WizardData[K]) => void;
  highlightMissingFile: boolean;
  correction: CorrectionSetupContext | null;
  initialFile: File | null;
  /** No partner group exists yet: the upload and description give way to the blocker. */
  blocked?: boolean;
  onGoToGroups?: () => void;
}

function isAcceptedFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith(".xlsx") || name.endsWith(".csv");
}
function isImportParseError(err: unknown): err is Error & { code: string } {
  return err instanceof Error && typeof (err as { code?: unknown }).code === "string";
}
function fileExt(name: string): string {
  return name.toLowerCase().match(/\.([^.]+)$/)?.[1] ?? "";
}
/** Written badge label per accepted extension (no display case transform). */
const EXT_LABEL: Record<string, string> = { xlsx: "XLSX", csv: "CSV" };

function ImportSetupStep({ spec, data, onChange, highlightMissingFile, correction, initialFile, blocked = false, onGoToGroups }: SetupProps) {
  const [uploading, setUploading] = useState(false);
  const [pendingFile, setPendingFile] = useState<{ name: string; sizeKB: number } | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const uploadCancelledRef = useRef(false);
  const progressRafRef = useRef(0);
  const timersRef = useRef<number[]>([]);
  const initialFileRef = useRef<File | null>(null);

  useEffect(
    () => () => {
      timersRef.current.forEach((t) => window.clearTimeout(t));
      cancelAnimationFrame(progressRafRef.current);
    },
    [],
  );

  const saveTemplateFile = (href: string, filename: string) => {
    const a = document.createElement("a");
    a.href = href;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDownload = (format: "excel" | "csv") => {
    const t = spec.template;
    const filename = format === "csv" ? t.csvFileName : t.xlsxFileName;
    saveTemplateFile(format === "csv" ? t.csvUrl : t.xlsxUrl, filename);
    const companionGuide = format === "csv" ? t.guideFileName : null;
    if (companionGuide) {
      const id = window.setTimeout(() => saveTemplateFile(t.guideUrl, companionGuide), GUIDE_DOWNLOAD_DELAY_MS);
      timersRef.current.push(id);
    }
    toast.success("Template downloaded", { description: companionGuide ? `${filename} and ${companionGuide}` : filename, duration: 3000 });
    /* The guide no longer opens on download; it lives behind How This Works. */
  };

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
      const parsePromise = parseImportFile(spec, file).catch((err: unknown) => err);
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
          const description = isImportParseError(parsed) ? parsed.message : "We couldn't read this file. Make sure it's a valid Excel (.xlsx) or CSV (.csv) export.";
          toast.error("Couldn't read this file", { description });
          return;
        }
        const result = parsed as ParseResult;
        const uploaded: UploadedFile = { name: file.name, sizeKB: Math.max(1, Math.round(file.size / 1024)), rows: result.rows.length, fields: result.matchedFieldCount };
        onChange("uploadedFile", uploaded);
        onChange("parsedRows", result.rows);
        onChange("validationState", "valid");
        setUploading(false);
        toast.success("File uploaded.", { description: uploaded.name });
      };
      parsePromise.then((parsed) => {
        if (uploadCancelledRef.current) return;
        const remaining = Math.max(0, UPLOAD_DURATION_MS - (performance.now() - startedAt));
        const id = window.setTimeout(() => finish(parsed), remaining);
        timersRef.current.push(id);
      });
    },
    [uploading, data.uploadedFile, spec, onChange],
  );

  useEffect(() => {
    if (initialFile && initialFileRef.current !== initialFile) {
      initialFileRef.current = initialFile;
      acceptFile(initialFile, true);
    }
  }, [initialFile, acceptFile]);

  const handleCancelUpload = () => {
    uploadCancelledRef.current = true;
    timersRef.current.forEach((t) => window.clearTimeout(t));
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

  const previewFields = spec.columns.slice(0, 5).map((c) => c.label).join(", ");
  const remainingFields = spec.columns.slice(5).map((c) => c.label);

  return (
    <div className="flex flex-col" style={{ minHeight: 540 }}>
      <div>
        {correction ? (
          <CorrectionBar correction={correction} />
        ) : (
          <div className="flex items-center gap-3 rounded-[8px] bg-[#EFF6FF] px-3 py-2.5" style={{ minHeight: 58, border: "1.5px solid #BFDBFE", boxShadow: "0 1px 2px 0 rgba(0,0,0,0.05)" }}>
            <div className="shrink-0 flex items-center justify-center rounded-[6px] bg-[#DBEAFE]" style={{ width: 32, height: 32 }}>
              <FileSpreadsheet style={{ width: 18, height: 18, color: "#3B82F6" }} aria-hidden />
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="text-foreground" style={{ fontSize: "13px", fontWeight: 500 }}>
                Download the Import Template
              </p>
              <p className="text-[#64748B] mt-0.5" style={{ fontSize: "12px" }}>
                Includes {previewFields} and <FieldsPopover count={remainingFields.length} fields={remainingFields} />
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <TemplateButton label="Excel" onClick={() => handleDownload("excel")} />
              <TemplateButton label="CSV" onClick={() => handleDownload("csv")} />
            </div>
          </div>
        )}
      </div>
      {blocked ? (
        <NoPartnerGroupsBlocker onGoToGroups={onGoToGroups} />
      ) : (
        <>
      <div style={{ marginTop: 20 }}>
        <div className="flex items-center gap-1 mb-1.5">
          <label className="text-foreground" style={{ fontSize: "13px", fontWeight: 500 }}>
            Upload Your File
          </label>
          <span className="text-[#EF4444]" style={{ fontSize: "13px" }}>
            *
          </span>
        </div>
        <UploadCard uploading={uploading} file={data.uploadedFile} onAcceptFile={acceptFile} onRemove={handleRemoveFile} highlightMissing={highlightMissingFile} pendingFile={pendingFile} uploadProgress={uploadProgress} onCancelUpload={handleCancelUpload} entity={spec.entity} requiredCount={spec.columns.filter((c) => c.required).length} optionalCount={spec.columns.filter((c) => !c.required).length} />
      </div>
      {!correction && (
        <div style={{ marginTop: 20 }}>
          <div className="flex items-center gap-1.5 mb-1.5">
            <label className="text-foreground" style={{ fontSize: "13px", fontWeight: 500 }}>
              Import Description
            </label>
            <span className="text-[#94A3B8]" style={{ fontSize: "12px", fontWeight: 400 }}>
              (Optional)
            </span>
          </div>
          <textarea
            value={data.importName}
            onChange={(e) => onChange("importName", e.target.value)}
            placeholder={`e.g. ${spec.storageNamespace === "partner-groups" ? "Regional groups Q2 2026" : "New vendors Q2 2026"}. A short note that helps you find this import later.`}
            rows={3}
            className="w-full px-3 py-2.5 text-sm bg-white border rounded-md shadow-sm placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors resize-y block border-border focus:border-primary"
            style={{ minHeight: 76, marginTop: 0, marginBottom: 0 }}
          />
          <p className="text-[12px] text-[#64748B]" style={{ marginTop: 4, marginBottom: 0, lineHeight: 1.4 }}>
            Helps you find the import later in your history. It does not affect the file.
          </p>
        </div>
      )}
        </>
      )}
    </div>
  );
}

/* Header preview switch between the two states of the partner import. */
function ImportStateToggle({ blocked, onChange }: { blocked: boolean; onChange: (blocked: boolean) => void }) {
  return (
    <div role="radiogroup" aria-label="Import state" className="inline-flex items-center p-0.5 rounded-[8px] border border-border bg-[#F8FAFC]">
      {([
        { value: false, label: "Enabled" },
        { value: true, label: "Blocked" },
      ] as const).map((opt) => {
        const active = blocked === opt.value;
        return (
          <button
            key={opt.label}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "h-7 px-2.5 rounded-[6px] transition-colors cursor-pointer",
              active ? "bg-white text-foreground shadow-sm" : "text-[#64748B] hover:text-foreground",
            )}
            style={{ fontSize: "12px", fontWeight: active ? 600 : 500 }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/* Shown in place of the upload and description when no partner group exists. */
function NoPartnerGroupsBlocker({ onGoToGroups }: { onGoToGroups?: () => void }) {
  return (
    /* No box: the message sits centred in the space the upload and description
       would take, so the modal keeps its height and reads as one state. */
    <div className="flex flex-col items-center justify-center text-center px-5" style={{ minHeight: 360 }}>
      <div className="w-11 h-11 rounded-xl bg-white border border-border shadow-sm flex items-center justify-center">
        <Network className="w-5 h-5 text-[#64748B]" aria-hidden />
      </div>
      <p className="text-foreground mt-3" style={{ fontSize: "14px", fontWeight: 600 }}>
        Add a partner group first
      </p>
      <p className="text-[#64748B] mt-1 max-w-[440px]" style={{ fontSize: "12.5px", lineHeight: 1.5 }}>
        Every partner belongs to at least one partner group, and there are no partner groups yet. Go to Partner Groups to add a group, then come back to import your partners.
      </p>
      <button
        type="button"
        onClick={onGoToGroups}
        className="mt-4 inline-flex items-center gap-1.5 px-4 h-9 rounded-[8px] bg-primary hover:bg-[#0066D6] active:bg-[#005BBF] text-white shadow-sm transition-colors cursor-pointer"
        style={{ fontSize: "13px", fontWeight: 600 }}
      >
        Go to Partner Groups
        <ArrowRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function TemplateButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center justify-center gap-1 h-8 px-2.5 rounded-[6px] border border-primary bg-white text-primary hover:bg-primary hover:text-white active:bg-[#0066D6] active:border-[#0066D6] transition-colors cursor-pointer"
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
        <button type="button" className="inline cursor-pointer text-primary hover:underline underline-offset-2" style={{ fontSize: "12px", fontWeight: 500 }}>
          +{count} more
        </button>
      </HoverCardTrigger>
      <HoverCardContent side="bottom" align="start" sideOffset={6} className="z-[200] w-[240px] p-0 rounded-lg border border-border bg-white shadow-[0_8px_24px_-8px_rgba(15,23,42,0.18),0_2px_6px_-2px_rgba(15,23,42,0.08)]">
        <div className="flex items-center justify-between px-3.5 pt-3 pb-2" style={{ fontSize: "11px", fontWeight: 600, color: "#94A3B8", letterSpacing: "0.06em" }}>
          <span>Fields</span>
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
    <div className="flex items-center gap-3 rounded-[8px] bg-[#FFFBEB] px-3 py-2.5" style={{ minHeight: 58, border: "1.5px solid #FDE68A", boxShadow: "0 1px 2px 0 rgba(0,0,0,0.05)" }}>
      <div className="shrink-0 flex items-center justify-center rounded-[6px] bg-[#FEF3C7]" style={{ width: 32, height: 32 }}>
        <FileSpreadsheet style={{ width: 18, height: 18, color: "#B45309" }} aria-hidden />
      </div>
      <div className="min-w-0 flex-1 leading-tight">
        <p className="text-foreground truncate" style={{ fontSize: "13px", fontWeight: 500 }} title={correction.parentName}>
          Correcting {correction.parentName}
        </p>
        <p className="text-[#92400E] mt-0.5" style={{ fontSize: "12px" }}>
          {correction.fileName ? `${rowLabel} went out in ${correction.fileName}. Upload it back once the flagged rows are fixed.` : `${rowLabel} to fix. Upload the corrected file once the flagged rows are sorted.`}
        </p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {(["xlsx", "csv"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => correction.onRedownload(f)}
            className="inline-flex items-center justify-center gap-1 h-8 px-2.5 rounded-[6px] border border-[#D97706] bg-white text-[#B45309] hover:bg-[#D97706] hover:text-white active:bg-[#B45309] active:border-[#B45309] transition-colors cursor-pointer"
            style={{ fontSize: "12px", fontWeight: 500, minWidth: 76 }}
            aria-label={`Download the error file again as ${f === "xlsx" ? "Excel" : "CSV"}`}
          >
            <Download className="w-3 h-3" />
            {f === "xlsx" ? "Excel" : "CSV"}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ───────────────────────── dropzone + cards ───────────────────────── */

interface UploadCardProps {
  uploading: boolean;
  file: UploadedFile | null;
  onAcceptFile: (file: File) => void;
  onRemove: () => void;
  highlightMissing: boolean;
  pendingFile: { name: string; sizeKB: number } | null;
  uploadProgress: number;
  onCancelUpload: () => void;
  entity: string;
  requiredCount: number;
  optionalCount: number;
}

const CARD_GRID_STYLE: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12, marginTop: "10px" };

function UploadCard({ uploading, file, onAcceptFile, onRemove, highlightMissing, pendingFile, uploadProgress, onCancelUpload, entity, requiredCount, optionalCount }: UploadCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dropzoneDisabled = uploading || !!file;
  const openPicker = () => {
    if (dropzoneDisabled) return;
    fileInputRef.current?.click();
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
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onAcceptFile(f);
          e.target.value = "";
        }}
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
          isDragging ? "border-primary bg-[rgba(214,232,255,0.30)]" : highlightMissing ? "border-[#EF4444] bg-[#FEF2F2]" : cn("border-[#EAEBF0] bg-white", !dropzoneDisabled && "hover:border-[#CBD5E1] hover:bg-[#FAFBFC]"),
        )}
        style={{ borderRadius: 10 }}
      >
        <div className="flex items-center gap-3 text-left">
          <div className={cn("w-9 h-9 flex items-center justify-center shrink-0 transition-colors", isDragging ? "bg-[#D6E8FF] text-primary" : "bg-[#F7F7F8] text-[#94A3B8]")} style={{ borderRadius: 10 }}>
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
            <AttachmentCard att={{ fileName: file.name, fileType: fileExt(file.name), fileSize: `${file.sizeKB} KB` }} onDelete={onRemove} entity={entity} requiredCount={requiredCount} optionalCount={optionalCount} />
          ) : null}
        </div>
      )}
    </div>
  );
}

const FONT = "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif";
const CARD_BORDER = "#EAEBF0";
const PRIMARY_HEX = "#0A77FF";
const PRIMARY_200 = "#90C2FF";
const SURFACE_SECONDARY = "#F7F7F8";
const TEXT_SECONDARY = "#68727D";
const TEXT_TERTIARY = "#A1A3A7";
const THUMB_PREVIEW_H = "clamp(94px, calc(10vw - 6px), 174px)";
const SHIMMER_BG = `linear-gradient(110deg, ${SURFACE_SECONDARY} 8%, hsl(210,16%,93%) 18%, ${SURFACE_SECONDARY} 33%)`;

function getFileThumbnail(type: string): { bg: string; color: string } {
  if (type === "xlsx" || type === "csv") return { bg: "#e9f8f1", color: "#176f45" };
  if (type === "pdf") return { bg: "#ffefee", color: "#db3a33" };
  return { bg: SURFACE_SECONDARY, color: TEXT_SECONDARY };
}

function DocumentPreview({ type, entity, requiredCount, optionalCount }: { type: string; entity: string; requiredCount?: number; optionalCount?: number }) {
  if (type !== "xlsx" && type !== "csv") {
    const tb = getFileThumbnail(type);
    return (
      <div className="flex items-center justify-center w-full h-full" style={{ background: tb.bg }}>
        <FileQuestion size={28} style={{ color: tb.color, opacity: 0.5 }} />
      </div>
    );
  }
  const gridLine = "#E1E3E6";
  const headerBg = "#F8F9FA";
  const headerText = "#5F6368";
  const COLS = ["A", "B", "C", "D", "E", "F", "G"];
  const ROW_CONTENT: Record<number, Record<number, { text: string; bold?: boolean; size?: number; color?: string }>> = {
    1: { 1: { text: `${entity} Import Template`, bold: true, size: 8, color: "#1f2937" } },
    2: { 1: { text: "Omne ERP   ·   Partners Management Module", size: 5.5, color: "#6b7280" } },
    4: { 1: { text: requiredCount == null ? "Generated: May 2026" : `Generated: May 2026   ·   ${requiredCount} required / ${optionalCount ?? 0} optional`, size: 5, color: "#9ca3af" } },
    6: { 1: { text: "Quick Start", bold: true, size: 5.5, color: "#1f6feb" } },
    8: { 1: { text: "Step 1", bold: true, size: 5.5 }, 2: { text: "Go to the Data Entry sheet. Fill in the required fields per row.", size: 5, color: "#374151" } },
    10: { 1: { text: "Step 2", bold: true, size: 5.5 }, 2: { text: "Review the example rows (rows 3-4, highlighted in grey).", size: 5, color: "#374151" } },
    12: { 1: { text: "Step 3", bold: true, size: 5.5 }, 2: { text: "Validate entries before importing into the platform.", size: 5, color: "#374151" } },
  };
  return (
    <div className="w-full h-full" style={{ background: "white", position: "relative", overflow: "hidden" }}>
      <table style={{ borderCollapse: "collapse", fontFamily: FONT, width: "100%", tableLayout: "fixed" }}>
        <colgroup>
          <col style={{ width: 14 }} />
          {COLS.map((c) => (
            <col key={c} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th style={{ background: headerBg, border: `1px solid ${gridLine}`, height: 8 }} />
            {COLS.map((c) => (
              <th key={c} style={{ background: headerBg, border: `1px solid ${gridLine}`, color: headerText, fontSize: 5, fontWeight: 600, height: 8, padding: 0, textAlign: "center" }}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 14 }, (_, i) => i + 1).map((rowNum) => (
            <tr key={rowNum}>
              <td style={{ background: headerBg, border: `1px solid ${gridLine}`, color: headerText, fontSize: 5, fontWeight: 500, textAlign: "center", padding: 0, height: 10 }}>{rowNum}</td>
              {COLS.map((_, ci) => {
                const cell = ROW_CONTENT[rowNum]?.[ci];
                return (
                  <td key={ci} style={{ border: `1px solid ${gridLine}`, background: rowNum === 6 ? "#E8F0FE" : "white", padding: "0 3px", height: 10, fontSize: cell?.size ?? 5, fontWeight: cell?.bold ? 700 : 400, color: cell?.color ?? "#1f2937", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {cell?.text ?? ""}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "40%", background: "linear-gradient(to bottom, rgba(238,240,243,0) 0%, #EEF0F3 80%)", pointerEvents: "none" }} />
    </div>
  );
}

export interface AttachmentCardData {
  fileName: string;
  fileType: string;
  fileSize: string;
}

export function AttachmentCard({ att, onDelete, entity = "Partners", requiredCount, optionalCount }: { att: AttachmentCardData; onDelete?: () => void; entity?: string; requiredCount?: number; optionalCount?: number }) {
  const [hovered, setHovered] = useState(false);
  const tb = getFileThumbnail(att.fileType);
  return (
    <div
      className="relative flex flex-col"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        minWidth: 0,
        borderRadius: 10,
        background: "#FFFFFF",
        borderWidth: "1px",
        borderStyle: "solid",
        borderColor: hovered ? PRIMARY_200 : CARD_BORDER,
        boxShadow: hovered ? "0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)" : "0px 1px 2px 0px rgba(16,24,40,0.04)",
        transition: "border-color 0.15s ease, box-shadow 0.15s ease",
      }}
    >
      <div className="relative shrink-0 w-full" style={{ height: THUMB_PREVIEW_H, borderTopLeftRadius: 9, borderTopRightRadius: 9, overflow: "hidden", background: tb.bg }}>
        <DocumentPreview type={att.fileType} entity={entity} requiredCount={requiredCount} optionalCount={optionalCount} />
        <span
          className="absolute"
          style={{ bottom: 6, left: 6, padding: "1px 4px", borderRadius: 4, background: "#FFFFFF", borderWidth: "1px", borderStyle: "solid", borderColor: CARD_BORDER, fontFamily: FONT, fontWeight: 600, fontSize: "9px", color: tb.color, letterSpacing: "0.04em", zIndex: 2 }}
        >
          {EXT_LABEL[att.fileType] ?? att.fileType}
        </span>
      </div>
      {onDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          aria-label={`Remove ${att.fileName}`}
          className="absolute flex items-center justify-center transition-all"
          style={{ top: 6, right: 6, width: 22, height: 22, borderRadius: 999, background: "rgba(255,255,255,0.95)", border: `1px solid ${CARD_BORDER}`, cursor: "pointer", color: TEXT_SECONDARY, boxShadow: "0 1px 2px rgba(16,24,40,0.10)", zIndex: 2 }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "hsl(0 93% 96%)";
            e.currentTarget.style.color = "hsl(0 72% 51%)";
            e.currentTarget.style.borderColor = "hsl(0 72% 51% / 0.4)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(255,255,255,0.95)";
            e.currentTarget.style.color = TEXT_SECONDARY;
            e.currentTarget.style.borderColor = CARD_BORDER;
          }}
        >
          <X size={12} />
        </button>
      )}
      <div className="flex items-start w-full" style={{ padding: "6px 8px 8px", gap: 4 }}>
        <div className="flex flex-col flex-1 min-w-0" style={{ gap: 6 }}>
          <p className="overflow-hidden" title={att.fileName} style={{ fontFamily: FONT, fontWeight: 500, fontSize: "13px", color: "#0F172A", whiteSpace: "nowrap", textOverflow: "ellipsis", margin: 0, lineHeight: 1.3 }}>
            {att.fileName}
          </p>
          <p className="overflow-hidden" style={{ fontFamily: FONT, fontWeight: 400, fontSize: "12px", color: TEXT_TERTIARY, whiteSpace: "nowrap", textOverflow: "ellipsis", margin: 0, lineHeight: 1.3 }}>
            {att.fileSize}
          </p>
        </div>
      </div>
    </div>
  );
}

function UploadingCard({ fileName, fileSize, ext, progress, onCancel }: { fileName: string; fileSize: string; ext: string; progress: number; onCancel: () => void }) {
  const p = Math.min(100, Math.max(0, progress));
  const shimmer: React.CSSProperties = { background: SHIMMER_BG, backgroundSize: "200% 100%", animation: "attUploadShimmer 1.2s linear infinite" };
  return (
    <div className="relative flex flex-col" style={{ minWidth: 0, borderRadius: 10, background: "#FFFFFF", border: `1px solid ${CARD_BORDER}`, boxShadow: "0px 1px 2px 0px rgba(16,24,40,0.04)" }}>
      <div className="relative shrink-0 w-full flex items-center justify-center overflow-hidden" style={{ height: THUMB_PREVIEW_H, borderTopLeftRadius: 9, borderTopRightRadius: 9, ...shimmer }}>
        <div className="relative flex items-center justify-center" style={{ width: 56, height: 56 }}>
          <svg width="56" height="56" viewBox="0 0 56 56" style={{ position: "absolute", inset: 0 }} aria-hidden>
            <circle cx="28" cy="28" r="24" fill="none" stroke="rgba(15,23,41,0.08)" strokeWidth="4" />
            <circle cx="28" cy="28" r="24" fill="none" stroke={PRIMARY_HEX} strokeWidth="4" strokeLinecap="round" strokeDasharray={2 * Math.PI * 24} strokeDashoffset={2 * Math.PI * 24 * (1 - p / 100)} style={{ transformOrigin: "center", transform: "rotate(-90deg)", transition: "stroke-dashoffset 160ms linear" }} />
          </svg>
          <span style={{ fontSize: 12, fontWeight: 700, color: PRIMARY_HEX, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{p}%</span>
        </div>
        <span className="absolute" style={{ bottom: 6, left: 6, padding: "1px 4px", borderRadius: 4, background: "#FFFFFF", border: `1px solid ${CARD_BORDER}`, fontWeight: 600, fontSize: 9, color: TEXT_SECONDARY, letterSpacing: "0.04em" }}>
          {EXT_LABEL[ext] ?? ext}
        </span>
      </div>
      <button
        type="button"
        onClick={onCancel}
        aria-label="Cancel upload"
        className="absolute flex items-center justify-center transition-all"
        style={{ top: 6, right: 6, width: 22, height: 22, borderRadius: 999, background: "rgba(255,255,255,0.95)", border: `1px solid ${CARD_BORDER}`, cursor: "pointer", color: TEXT_SECONDARY, boxShadow: "0 1px 2px rgba(16,24,40,0.10)", zIndex: 2 }}
      >
        <span style={{ fontSize: 12, lineHeight: 1 }}>×</span>
      </button>
      <div className="flex flex-col w-full" style={{ padding: "6px 8px 8px", gap: 6 }}>
        <div aria-hidden style={{ height: "calc(13px * 1.3)", width: `${60 + ((fileName.length * 7) % 30)}%`, maxWidth: "100%", borderRadius: 4, ...shimmer }} />
        <div aria-hidden style={{ height: "calc(12px * 1.3)", width: 56, borderRadius: 4, ...shimmer }} />
        <span className="sr-only" title={fileName}>
          {fileName}
        </span>
        <span className="sr-only">{fileSize}</span>
      </div>
      <style>{`@keyframes attUploadShimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
    </div>
  );
}

/* ───────────────────────── Reading Room (guide drawer) ───────────────────────── */

type GuideBlock = { kind: "subheader"; text: string } | { kind: "labeled"; label: string; body: string } | { kind: "paragraph"; text: string };
interface GuideSection {
  title: string;
  blocks: GuideBlock[];
}

export function buildGuideSections(spec: EntitySpec<unknown>): GuideSection[] {
  const g = spec.data.guide;
  const ins = spec.data.instructions;
  const sections: GuideSection[] = [];
  sections.push({ title: "Overview", blocks: g.intro.map((text) => ({ kind: "paragraph", text })) });
  sections.push({ title: "Quick Start", blocks: (g.quickStart ?? ins.quickStart).map((body, i) => ({ kind: "labeled", label: `Step ${i + 1}`, body })) });
  sections.push({
    title: `How ${spec.entity} Are Matched`,
    blocks: g.matchedSections.flatMap((s) => [{ kind: "subheader" as const, text: s.title }, { kind: "paragraph" as const, text: s.lead }, ...s.items.map(([label, body]) => ({ kind: "labeled" as const, label, body }))]),
  });
  for (const s of ins.sections) {
    if (/matched/i.test(s.heading)) continue;
    const blocks: GuideBlock[] = [];
    if (s.intro) blocks.push({ kind: "paragraph", text: s.intro });
    for (const [label, body] of s.items ?? []) blocks.push({ kind: "labeled", label, body });
    if (blocks.length) sections.push({ title: s.heading, blocks });
  }
  const byKey = new Map(spec.columns.map((c) => [c.key, c]));
  sections.push({
    title: "Every Column",
    blocks: g.fieldGroups.flatMap((grp) => [{ kind: "subheader" as const, text: grp.title }, ...grp.keys.map((k) => byKey.get(k)).filter((c): c is NonNullable<typeof c> => !!c).map((c) => ({ kind: "labeled" as const, label: c.label, body: c.description }))]),
  });
  sections.push({ title: "File Limits", blocks: [{ kind: "paragraph", text: "Upload an Excel (.xlsx) or CSV (.csv) file up to 10 MB. Omne reads a single sheet, so keep only the Data Entry sheet in an Excel file before uploading." }] });
  return sections;
}

