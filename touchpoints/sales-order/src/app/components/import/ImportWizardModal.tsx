import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  X, Upload, Download, FileSpreadsheet, ArrowRight, Trash2, AlertTriangle, Loader2,
  HelpCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import {
  Tooltip, TooltipTrigger, TooltipContent, TooltipProvider,
} from "@/app/components/ui/tooltip";
import {
  HoverCard, HoverCardTrigger, HoverCardContent,
} from "@/app/components/ui/hover-card";
import { COLUMNS, RECORD_LABEL, RECORD_NOUN, RECORD_NOUN_PLURAL } from "./importSpec";
import { downloadTemplate, downloadTemplateCsv } from "./importTemplate";
import { parseImportFile, buildRecords } from "./importParse";
import type { ParsedFile } from "./importModel";
import { ImportReviewModal, type ImportOutcome } from "./ImportReviewModal";
import { BaseModal } from "@/app/components/shared/BaseModal";
import { MissingRecordsStep } from "./MissingRecordsStep";
import { validateRecords } from "./importValidate";
import { AttachmentCard, UploadingCard, CARD_GRID_STYLE } from "./uploadedFileCard";
import { ReadingRoomProvider, useReadingRoom } from "./reading-room";
import { GUIDE_SECTIONS, GUIDE_TITLE } from "./importGuide";
import type { ValidateOptions } from "./importValidate";

/**
 * Import wizard, step one.
 *
 * A direct port of the User Access Control import modal, not a lookalike:
 * same 58vw shell and spring entrance, same header scale, same #F8FAFC
 * body, same three stacked sections (template bar, upload, description),
 * same footer with a disabled "Review Data" that still explains itself on
 * hover, same discard confirmation when closing dirty, same Escape
 * handling. Only the content is ours, because the record is a quote or an
 * order rather than a user.
 */

interface UploadedFile { name: string; sizeKB: number }

/** UAC's upload animation window, so the ring reads the same here. */
const UPLOAD_DURATION_MS = 850;

/** Lowercased extension, the shape UAC's cards expect. */
const fileExt = (name: string) => (name.split(".").pop() ?? "").toLowerCase();

function ImportWizardModalInner({
  open,
  onClose,
  onApplied,
  onGoToListing,
  validateOptions,
}: {
  open: boolean;
  onClose: () => void;
  onApplied?: (outcome: ImportOutcome) => void;
  onGoToListing?: () => void;
  validateOptions?: ValidateOptions;
}) {
  const [importName, setImportName] = useState("");
  const [file, setFile] = useState<UploadedFile | null>(null);
  const [parsed, setParsed] = useState<ParsedFile | null>(null);
  const readingRoom = useReadingRoom();
  /* Between choosing a file and reviewing it: what the file needs that Omne
     does not hold. Computed from the file, so it only appears when there is
     something to say, and only says that. */
  const [gapsSeen, setGapsSeen] = useState(false);
  const [uploading, setUploading] = useState(false);
  /* Cancel state for an in-flight upload, the X on the uploading card. */
  const uploadCancelledRef = useRef(false);
  const progressRafRef = useRef(0);
  const [progress, setProgress] = useState(0);
  const [parseError, setParseError] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [hoveringBlocker, setHoveringBlocker] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  /* Reset on open */
  useEffect(() => {
    if (!open) return;
    setImportName(""); setFile(null); setParsed(null); setUploading(false); setGapsSeen(false);
    setProgress(0); setParseError(null); setReviewOpen(false);
    setShowDiscardConfirm(false); setHoveringBlocker(false);
  }, [open]);

  const isDirty = importName.trim().length > 0 || !!file;

  const handleAttemptClose = useCallback(() => {
    if (isDirty) setShowDiscardConfirm(true);
    else onClose();
  }, [isDirty, onClose]);

  /* Escape closes the confirm first, then the modal. */
  useEffect(() => {
    if (!open || reviewOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (showDiscardConfirm) setShowDiscardConfirm(false);
      else handleAttemptClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, reviewOpen, showDiscardConfirm, handleAttemptClose]);

  /* Accepting a file runs the same shape of feedback the UAC modal gives:
     a progress ring while it reads, then the finished file card. */
  const acceptFile = useCallback(async (picked: File) => {
    const ext = picked.name.toLowerCase().match(/\.([^.]+)$/)?.[1] ?? "";
    if (!["xlsx", "csv"].includes(ext)) {
      setParseError("That file type is not supported. Upload an Excel or CSV file.");
      return;
    }
    if (picked.size > 10 * 1024 * 1024) {
      setParseError("That file is over 10 MB. Split it and import in batches.");
      return;
    }
    setParseError(null);
    uploadCancelledRef.current = false;
    setUploading(true);
    setProgress(0);
    setFile({ name: picked.name, sizeKB: Math.max(1, Math.round(picked.size / 1024)) });

    /* Parsing and the ring run in parallel, and the upload only finishes once
       both have settled. That is UAC's pacing (`UPLOAD_DURATION_MS`, driven on
       a rAF): it keeps the 850ms animation legible even for a small file that
       parses instantly, and a big file simply takes as long as it takes. */
    const startedAt = performance.now();
    const tick = (now: number) => {
      if (uploadCancelledRef.current) return;
      const ratio = Math.min(1, (now - startedAt) / UPLOAD_DURATION_MS);
      setProgress(Math.round(ratio * 100));
      if (ratio < 1) progressRafRef.current = requestAnimationFrame(tick);
    };
    progressRafRef.current = requestAnimationFrame(tick);

    const settle = async () => {
      const elapsed = performance.now() - startedAt;
      const remaining = Math.max(0, UPLOAD_DURATION_MS - elapsed);
      if (remaining > 0) await new Promise((r) => setTimeout(r, remaining));
    };

    try {
      const result = await parseImportFile(picked);
      await settle();
      if (uploadCancelledRef.current) return;
      if (result.records.length === 0) {
        setParseError(`No ${RECORD_NOUN_PLURAL} found. Check that the sheet still has the template's header row.`);
        setFile(null);
        setParsed(null);
      } else {
        setParsed(result);
        setProgress(100);
      }
    } catch {
      await settle();
      if (uploadCancelledRef.current) return;
      setParseError("That file could not be read. Save it as .xlsx or .csv and try again.");
      setFile(null);
      setParsed(null);
    } finally {
      cancelAnimationFrame(progressRafRef.current);
      setUploading(false);
    }
  }, []);

  /* Doubles as UAC's cancel-upload path: the X on the uploading card stops
     the ring and drops the pending parse, exactly as their card does. */
  const removeFile = () => {
    uploadCancelledRef.current = true;
    cancelAnimationFrame(progressRafRef.current);
    setUploading(false);
    setFile(null); setParsed(null); setProgress(0); setParseError(null);
  };


  /* The same validation the review sheet runs, so the two never disagree
     about what is missing. */
  const fileGaps = useMemo(
    () => (parsed ? validateRecords(parsed.records, validateOptions ?? {}).entityGaps : []),
    [parsed, validateOptions],
  );
  const gapsStepOpen = !!parsed && !gapsSeen && fileGaps.length > 0 && !reviewOpen;

  const canProceed = !!file && !!parsed && !uploading;
  const fileMissing = !file;
  const highlightMissing = hoveringBlocker && fileMissing;

  const previewFields = COLUMNS.slice(0, 3).map((c) => c.label);
  const remainingFields = COLUMNS.slice(3).map((c) => c.label);

  if (!open) return null;

  return (
    <TooltipProvider delayDuration={200}>

      {/* Chrome is the module's own `BaseModal`, the single source of truth for
          modal surface, header, footer and stacking; only the body is the
          import step's own. The guide sits in its `headerActions` slot, which
          is where Partner's modals put Full view and help affordances. */}
      <BaseModal
        isOpen={open && !reviewOpen && !gapsStepOpen}
        onClose={handleAttemptClose}
        title={`Import ${RECORD_LABEL}s`}
        subtitle={`Bring ${RECORD_NOUN_PLURAL} across from a previous system. Each one imports as version 1 and is tagged Legacy Import.`}
        icon={<Upload />}
        width="xl"
        zIndex={12300}
        bodyClassName="flex-1 min-h-0 overflow-y-auto bg-slate-50"
        headerActions={
          <button
            type="button"
            onClick={() => readingRoom?.open({ title: GUIDE_TITLE, sections: GUIDE_SECTIONS })}
            className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-white text-xs text-muted-foreground hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer"
            style={{ fontWeight: 500 }}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            How this works
          </button>
        }
        footer={
          <>

            <button
              type="button"
              onClick={handleAttemptClose}
              className="inline-flex items-center justify-center px-3 sm:px-5 h-8 sm:h-9 rounded-[8px] border border-border bg-white text-slate-500 hover:text-foreground hover:border-muted-foreground/30 transition-colors cursor-pointer"
              style={{ fontSize: "13px", fontWeight: 500 }}
            >
              Cancel
            </button>
            <ReviewDataButton
              canProceed={canProceed}
              blockerMessage={fileMissing ? "Upload a file to continue." : uploading ? "Still reading your file." : null}
              onProceed={() => {
                /* Nothing missing, nothing to show: straight to review. */
                if (fileGaps.length === 0) { setGapsSeen(true); setReviewOpen(true); return; }
                setGapsSeen(false);
              }}
              onHoverBlockerChange={setHoveringBlocker}
            />
          </>
        }
      >
          {/* Body: the import step's own three sections. */}
            {/* UAC's `descriptionPlacement: "bottom"` step: template, then
                upload, then description, over a 480px floor so the body
                keeps its height while no file is attached and grows
                naturally once the uploaded-file card appears. */}
            <div className="px-4 lg:px-5 py-4 lg:py-5 flex flex-col" style={{ minHeight: 480 }}>
              {/* SECTION 1, COMPACT TEMPLATE BAR */}
              <div>
                <div
                  className="flex items-center gap-3 rounded-[8px] bg-blue-50 px-3 py-2.5"
                  style={{ minHeight: 58, border: "1.5px solid #BFDBFE", boxShadow: "0 1px 2px 0 rgba(0,0,0,0.05)" }}
                >
                  <div className="shrink-0 flex items-center justify-center rounded-[6px] bg-blue-100" style={{ width: 32, height: 32 }}>
                    <FileSpreadsheet style={{ width: 18, height: 18, color: "#3B82F6" }} aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1 leading-tight">
                    <p className="text-foreground" style={{ fontSize: "13px", fontWeight: 500 }}>
                      Download the Import Template
                    </p>
                    <p className="text-slate-500 mt-0.5" style={{ fontSize: "12px" }}>
                      Includes {previewFields.join(", ")} and{" "}
                      <FieldsPopover count={remainingFields.length} fields={remainingFields} />
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <TemplateButton label="Excel" onClick={() => { downloadTemplate().catch(() => toast.error("Could not build the template.")); }} />
                    <TemplateButton label="CSV" onClick={() => { downloadTemplateCsv().catch(() => toast.error("Could not build the template.")); }} />
                  </div>
                </div>
              </div>

              {/* SECTION 2, FILE UPLOAD */}
              <div style={{ marginTop: 20 }}>
                <div className="flex items-center gap-1 mb-1.5">
                  <label className="text-foreground" style={{ fontSize: "13px", fontWeight: 500 }}>
                    Upload Your File
                  </label>
                  <span className="text-destructive" style={{ fontSize: "13px", lineHeight: 1 }}>*</span>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                  className="hidden"
                  onChange={(e) => { const p = e.target.files?.[0]; if (p) void acceptFile(p); e.target.value = ""; }}
                  aria-hidden
                  tabIndex={-1}
                />
                <div
                  onClick={() => { if (!uploading && !file) fileInputRef.current?.click(); }}
                  onDragEnter={(e) => { if (uploading || file) return; e.preventDefault(); setIsDragging(true); }}
                  onDragOver={(e) => { if (uploading || file) return; e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={(e) => { e.preventDefault(); if ((e.currentTarget as HTMLElement).contains(e.relatedTarget as Node | null)) return; setIsDragging(false); }}
                  onDrop={(e) => {
                    e.preventDefault(); setIsDragging(false);
                    if (uploading || file) return;
                    const d = e.dataTransfer.files?.[0]; if (d) void acceptFile(d);
                  }}
                  aria-disabled={uploading || !!file || undefined}
                  className={[
                    "border-2 border-dashed px-3 py-2.5 transition-all",
                    uploading || file ? "cursor-default" : "cursor-pointer",
                    isDragging
                      ? "border-primary bg-[rgba(214,232,255,0.30)]"
                      : highlightMissing
                        ? "border-destructive bg-red-50"
                        : "border-border bg-white hover:border-muted-foreground/30 hover:bg-slate-50",
                  ].join(" ")}
                  style={{ borderRadius: 10 }}
                >
                  <div className="flex items-center gap-3 text-left">
                    <div
                      className={`w-9 h-9 flex items-center justify-center shrink-0 transition-colors ${
                        isDragging ? "bg-accent text-primary" : "bg-slate-50 text-slate-400"
                      }`}
                      style={{ borderRadius: 10 }}
                    >
                      <Upload className={`w-4 h-4 ${uploading ? "animate-pulse" : ""}`} />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <p className="text-sm" style={{ fontWeight: 500, color: "var(--foreground)" }}>
                        {uploading ? (
                          <span style={{ color: "var(--primary)" }}>Uploading Your File</span>
                        ) : file ? (
                          <>1 file added. <span style={{ color: "var(--primary)" }}>Replace it</span></>
                        ) : (
                          <>
                            <span style={{ color: "var(--primary)" }}>Click to Upload</span>
                            <span> or drag and drop</span>
                          </>
                        )}
                      </p>
                      {highlightMissing ? (
                        <p className="text-xs mt-0.5" style={{ color: "#EF4444", fontWeight: 500 }}>
                          Upload an Excel or CSV file to continue.
                        </p>
                      ) : (
                        <p className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>
                          Excel or CSV. Up to 10 MB.
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* File cards are UAC's own: its grid, its shimmering
                    `UploadingCard` with the centred progress ring while
                    the sheet reads, then its `AttachmentCard` with the
                    spreadsheet preview. */}
                {file && (
                  <div style={CARD_GRID_STYLE}>
                    {uploading ? (
                      <UploadingCard
                        fileName={file.name}
                        fileSize={`${file.sizeKB} KB`}
                        ext={fileExt(file.name)}
                        progress={progress}
                        onCancel={removeFile}
                      />
                    ) : (
                      <AttachmentCard
                        att={{
                          fileName: file.name,
                          fileType: fileExt(file.name),
                          /* Their size slot carries what this import
                             actually found in the sheet. */
                          fileSize: parsed
                            ? `${file.sizeKB} KB · ${parsed.records.length} ${parsed.records.length === 1 ? RECORD_NOUN : RECORD_NOUN_PLURAL} · ${parsed.records.reduce((n, r) => n + r.lines.length, 0)} lines`
                            : `${file.sizeKB} KB`,
                        }}
                        onDelete={removeFile}
                      />
                    )}
                  </div>
                )}

                {/* Unknown columns: a notice under the grid, since UAC's
                    card has no slot for it. */}
                {!uploading && (parsed?.unknownColumns.length ?? 0) > 0 && (
                  <div className="flex items-start gap-2 px-3 py-2 mt-2 rounded-[8px] border border-amber-200 bg-amber-50">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-700 mt-0.5 shrink-0" />
                    <p className="text-[11.5px] text-amber-800 leading-relaxed">
                      {parsed!.unknownColumns.length} column{parsed!.unknownColumns.length === 1 ? "" : "s"} the template does not define{" "}
                      {parsed!.unknownColumns.length === 1 ? "was" : "were"} ignored: {parsed!.unknownColumns.slice(0, 4).join(", ")}
                      {parsed!.unknownColumns.length > 4 ? ` and ${parsed!.unknownColumns.length - 4} more` : ""}.
                    </p>
                  </div>
                )}

                {parseError && (
                  <div className="mt-3 flex items-start gap-2 px-3.5 py-2.5 rounded-[8px] border border-red-200 bg-red-50">
                    <AlertTriangle className="w-3.5 h-3.5 text-destructive mt-0.5 shrink-0" />
                    <p className="text-[12px] text-red-700 leading-relaxed">{parseError}</p>
                  </div>
                )}
              </div>
              {/* SECTION 3, IMPORT DESCRIPTION (sits directly under upload) */}
              <div style={{ marginTop: 20 }}>
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <label className="text-foreground" style={{ fontSize: "13px", fontWeight: 500 }}>
                    Import Description
                  </label>
                  <span className="text-slate-400" style={{ fontSize: "12px", fontWeight: 400 }}>(Optional)</span>
                </div>
                <textarea
                  value={importName}
                  onChange={(e) => setImportName(e.target.value)}
                  placeholder={`e.g. ${RECORD_LABEL}s from the 2019 system, batch 1. A short note that helps you find this import later.`}
                  rows={3}
                  className="w-full px-3 py-2.5 text-sm bg-white border border-border rounded-md shadow-sm placeholder:text-slate-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors resize-y block"
                  style={{ minHeight: 76, marginTop: 0, marginBottom: 0 }}
                />
                <p className="text-slate-500" style={{ fontSize: "12px", marginTop: 4, marginBottom: 0, lineHeight: 1.4 }}>
                  Names this run in your import history. It does not affect the file.
                </p>
              </div>
            </div>
          </div>
      </BaseModal>


      <MissingRecordsStep
        open={gapsStepOpen}
        gaps={fileGaps}
        onContinue={() => { setGapsSeen(true); setReviewOpen(true); }}
        onClose={() => setGapsSeen(true)}
      />

      <DiscardConfirmModal
        open={showDiscardConfirm}
        onCancel={() => setShowDiscardConfirm(false)}
        onConfirm={() => { setShowDiscardConfirm(false); onClose(); }}
      />

      {reviewOpen && parsed && (
        <ImportReviewModal
          open
          fileName={file?.name ?? ""}
          importName={importName.trim() || (file?.name ?? "").replace(/\.[^.]+$/, "")}
          records={parsed.records}
          validateOptions={validateOptions}
          onClose={() => { setReviewOpen(false); onClose(); }}
          onApplied={onApplied}
          onGoToListing={onGoToListing}
        />
      )}
    </TooltipProvider>
  );
}

/* ──────── Sub-components ──────── */

function TemplateButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center justify-center gap-1 h-8 px-2.5 rounded-[6px] border border-primary bg-white text-primary hover:bg-primary hover:text-white active:bg-primary/90 active:border-primary/90 transition-colors cursor-pointer"
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
        <button
          type="button"
          className="text-primary underline decoration-dotted underline-offset-2 cursor-pointer"
          style={{ fontSize: "12px", fontWeight: 500 }}
        >
          {count} more fields
        </button>
      </HoverCardTrigger>
      <HoverCardContent align="start" className="w-[320px] p-3">
        <p className="text-foreground mb-2" style={{ fontSize: "12px", fontWeight: 600 }}>
          All template columns
        </p>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 max-h-[240px] overflow-y-auto">
          {fields.map((f) => (
            <span key={f} className="text-slate-500 truncate" style={{ fontSize: "11.5px" }} title={f}>
              {f}
            </span>
          ))}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

function ReviewDataButton({
  canProceed, blockerMessage, onProceed, onHoverBlockerChange,
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
      className="inline-flex items-center gap-1.5 px-3 sm:px-5 h-8 sm:h-9 rounded-[8px] bg-primary hover:bg-primary/90 active:bg-primary/80 text-white shadow-sm transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      style={{ fontSize: "13px", fontWeight: 600 }}
    >
      Review Data
      <ArrowRight className="w-3.5 h-3.5" />
    </button>
  );

  if (canProceed || !blockerMessage) return button;

  /* Disabled but still explains itself: the outer span takes the pointer
     events the disabled button refuses, so the tooltip and the red flag on
     the dropzone both still fire. Straight from the UAC original. */
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
          <span style={{ pointerEvents: "none" }} className="inline-block">{button}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={8} className="max-w-[260px] px-3 py-2" style={{ zIndex: 12400 }}>
        <p style={{ fontSize: "12px" }}>{blockerMessage}</p>
      </TooltipContent>
    </Tooltip>
  );
}

function DiscardConfirmModal({
  open, onCancel, onConfirm,
}: { open: boolean; onCancel: () => void; onConfirm: () => void }) {
  if (!open) return null;
  return createPortal(
    <>
      <div className="fixed inset-0 bg-black/50" style={{ zIndex: 12450 }} onClick={onCancel} />
      <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 12451 }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring", duration: 0.3, bounce: 0.12 }}
          className="bg-white rounded-2xl overflow-hidden w-[calc(100vw-2rem)] max-w-[400px]"
          style={{ boxShadow: "0 24px 48px -12px rgba(0,0,0,0.22), 0 0 0 1px rgba(0,0,0,0.05)" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="px-6 pt-8 pb-4 flex flex-col items-center"
            style={{ background: "radial-gradient(120% 100% at 50% 0%, #FEE2E2 0%, rgba(254,226,226,0.4) 40%, rgba(255,255,255,0) 75%)" }}
          >
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "rgba(254,202,202,0.5)" }}>
              <Trash2 className="w-7 h-7" style={{ color: "var(--destructive)" }} />
            </div>
            <h3 className="text-foreground mt-4" style={{ fontSize: "17px", fontWeight: 700 }}>Discard this import?</h3>
            <p className="text-slate-500 mt-1.5 text-center" style={{ fontSize: "12.5px", lineHeight: 1.6 }}>
              The file you uploaded and anything you typed will be lost. Nothing has been imported yet.
            </p>
          </div>
          <div className="px-6 pb-6 pt-2 flex flex-col gap-2.5">
            <button
              type="button" onClick={onConfirm}
              className="w-full h-11 rounded-xl text-white cursor-pointer transition-colors"
              style={{ fontSize: "14px", fontWeight: 600, background: "var(--destructive)" }}
            >
              Discard import
            </button>
            <button
              type="button" onClick={onCancel}
              className="w-full h-11 rounded-xl bg-slate-100 hover:bg-border text-foreground-soft cursor-pointer transition-colors"
              style={{ fontSize: "14px", fontWeight: 500 }}
            >
              Keep editing
            </button>
          </div>
        </motion.div>
      </div>
    </>,
    document.body,
  );
}

/**
 * The wizard, inside UAC's Reading Room provider so the header's
 * "How this works" button has a drawer to open into.
 */
export function ImportWizardModal(props: Parameters<typeof ImportWizardModalInner>[0]) {
  return (
    <ReadingRoomProvider>
      <ImportWizardModalInner {...props} />
    </ReadingRoomProvider>
  );
}
