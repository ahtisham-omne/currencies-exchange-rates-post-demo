import { useCallback, useEffect, useState, type ComponentProps, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  X,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../ui/tooltip";
import { ReadingRoomProvider } from "../../ui/reading-room";
import { HowThisWorksButton, HowThisWorksDrawer } from "./HowThisWorks";
import { ImportSetupStep, USERS_TEMPLATE_CONFIG, useGuideHowSections, type CorrectionSetupContext, type ImportTemplateConfig } from "./ImportSetupStep";
import { EMPTY_WIZARD, type ImportWizardData } from "./types";
import type { UserReviewRow } from "../import-review/usersReviewMockData";
import { ImportReviewModal, type ImportOutcome } from "../import-review/ImportReviewModal";
import type { ValidationContext } from "../import-review/validation";

interface ImportWizardModalProps {
  open: boolean;
  onClose: () => void;
  recordTypeLabel: string;
  moduleSlug: string;
  /** Called after the user completes the import via the review modal,
   *  the parent should refresh its listing. */
  onImportCompleted?: () => void;
  /** Fires once when the import finishes, with the rows bucketed into
   *  created / updated / skipped. The host page is responsible for folding
   *  these into its own dataset. */
  onApplied?: (outcome: ImportOutcome) => void;
  /** Validation context for the review step, existing user emails and
   *  known role names. Read at review-open time. */
  validationContext?: ValidationContext;
  /** Layout override for the setup step. Defaults to "top" (legacy order).
   *  UAC opts into "bottom" so template + upload appear first, with the
   *  description below a divider. */
  descriptionPlacement?: "top" | "bottom";
  /** Header title override. Defaults to "Import Users". The re-import flow
   *  from the import detail page passes copy that signals "upload your fixed
   *  file here" instead of a fresh import. */
  title?: string;
  /** Header subtitle override. Defaults to the standard upload prompt. */
  description?: string;
  /** Layer 2 of correction detection: the import this upload was launched
   *  from. Used when the file carries no provenance stamp, e.g. the admin
   *  rebuilt it in a fresh template. Null for the generic Import button,
   *  where a stamped file is the only way home. */
  parentImportId?: string | null;
  /** Correction framing for the setup step: swaps the blank-template bar
   *  for the error file the admin is working from and drops the description
   *  field. Present whenever this wizard was opened to accept a fix. */
  correction?: CorrectionSetupContext | null;
  /** File dropped on the correction strip, accepted automatically so the
   *  round trip finishes in one gesture instead of two. */
  initialFile?: File | null;
  /** Template + guide file set for the setup step. Defaults to the Users files. */
  template?: ImportTemplateConfig;
  /** File parser for the setup step. Defaults to the Users parser. */
  parseFile?: (file: File) => Promise<{ rows: unknown[]; matchedFieldCount: number }>;
  /** Import Description placeholder. Defaults to the Users wording. */
  descriptionPlaceholder?: string;
  /** Replaces the Users review modal with a module's own, mounted in the
   *  same place: over the wizard, which stays open behind it, so Cancel in
   *  the review returns to the wizard exactly as it does for Users. */
  renderReview?: (ctx: ReviewStepContext) => ReactNode;
}

/** What the wizard hands a module's own review step. The same values the
 *  Users ImportReviewModal receives. */
export interface ReviewStepContext {
  open: boolean;
  importName: string;
  importDescription: string;
  fileName: string;
  /** Rows the setup step parsed out of the file (the module parser's shape). */
  parsedRows: unknown[];
  sessionParentId: string | null;
  /** Close the review, back to the wizard. */
  onClose: () => void;
  /** Import done and the completion dialog dismissed: close everything. */
  onCompleted: () => void;
}

export function ImportWizardModal({
  open,
  onClose,
  recordTypeLabel,
  moduleSlug,
  onImportCompleted,
  onApplied,
  validationContext,
  descriptionPlacement,
  title = "Import Users",
  description = "Upload a spreadsheet to add or update users in bulk.",
  parentImportId = null,
  correction = null,
  initialFile = null,
  template,
  parseFile,
  descriptionPlaceholder,
  renderReview,
}: ImportWizardModalProps) {
  const [data, setData] = useState<ImportWizardData>({ ...EMPTY_WIZARD });
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [submittedName, setSubmittedName] = useState("");
  /* The raw description the admin typed (may be empty). Kept separate from
   * submittedName, which falls back to the file stem, so the history table and
   * detail header can show a true empty state when no description was entered. */
  const [submittedDescription, setSubmittedDescription] = useState("");
  /* True while the user is hovering the disabled primary CTA, drives the
   * visual red flag on the missing file. */
  const [hoveringBlocker, setHoveringBlocker] = useState(false);
  const [howOpen, setHowOpen] = useState(false);
  const howSections = useGuideHowSections(template ?? USERS_TEMPLATE_CONFIG);

  /* Reset on open */
  useEffect(() => {
    if (open) {
      setData({ ...EMPTY_WIZARD });
      setShowDiscardConfirm(false);
      setReviewOpen(false);
      setSubmittedName("");
      setHoveringBlocker(false);
    setHowOpen(false);
    }
  }, [open]);

  const isDirty =
    data.importName.trim().length > 0 ||
    !!data.uploadedFile;

  const handleAttemptClose = useCallback(() => {
    if (reviewOpen) return;
    if (isDirty) {
      setShowDiscardConfirm(true);
      return;
    }
    onClose();
  }, [reviewOpen, isDirty, onClose]);

  /* Escape key, closes discard confirm if open, otherwise attempts to close wizard.
   * Skip while the review modal is open so its handlers take precedence. */
  useEffect(() => {
    if (!open || reviewOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (showDiscardConfirm) {
        setShowDiscardConfirm(false);
      } else {
        handleAttemptClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, reviewOpen, showDiscardConfirm, handleAttemptClose]);

  const update = useCallback(<K extends keyof ImportWizardData>(key: K, value: ImportWizardData[K]) => {
    setData((prev) => ({ ...prev, [key]: value }));
  }, []);

  const canProceed =
    !!data.uploadedFile &&
    !!data.parsedRows &&
    data.validationState === "valid";

  const handleProceed = useCallback(() => {
    if (!data.uploadedFile || !data.parsedRows || data.validationState !== "valid") return;
    /* The "Import description" field in the wizard is optional. When the user
     * leaves it blank we fall back to the uploaded file's name (extension
     * stripped) so the import always has a human-readable title in history. */
    const typed = data.importName.trim();
    const fileStem = data.uploadedFile.name.replace(/\.[^.]+$/, "");
    setSubmittedName(typed || fileStem);
    setSubmittedDescription(typed);
    setReviewOpen(true);
  }, [data.importName, data.uploadedFile, data.parsedRows, data.validationState]);

  const fileMissing = !data.uploadedFile;
  const blockerMessage = fileMissing ? "Upload a file to continue." : null;
  const highlightMissing = hoveringBlocker ? { file: fileMissing } : null;

  if (!open) return null;

  return createPortal(
    <TooltipProvider delayDuration={200}>
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100]"
              onClick={handleAttemptClose}
            />

            {/* Modal */}
            <div className="fixed inset-0 z-[101] flex items-center justify-center p-4 sm:p-6 pointer-events-none">
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 16 }}
                transition={{ type: "spring", duration: 0.35, bounce: 0.1 }}
                onClick={(e) => e.stopPropagation()}
                className="relative bg-white flex flex-col overflow-hidden pointer-events-auto w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] max-h-[100dvh] rounded-2xl sm:w-[min(58vw,880px)] sm:max-w-[min(58vw,880px)] sm:h-auto sm:max-h-[90vh]"
                style={{ boxShadow: "0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)" }}
              >
                <ReadingRoomProvider modalBorderRadius={16}>
                {/* Header */}
                <div className="px-4 lg:px-5 py-4 shrink-0 bg-white border-b border-[#EEF2F6]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="text-[#0F172A]" style={{ fontSize: "17px", fontWeight: 700 }}>
                        {title}
                      </h2>
                      <p className="text-[#64748B] mt-0.5" style={{ fontSize: "12px" }}>
                        {description}
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
                      recordTypeLabel={recordTypeLabel}
                      highlightMissingFile={!!highlightMissing?.file}
                      descriptionPlacement={descriptionPlacement}
                      correction={correction}
                      initialFile={initialFile}
                      template={template}
                      parseFile={parseFile as ComponentProps<typeof ImportSetupStep<UserReviewRow>>["parseFile"]}
                      descriptionPlaceholder={descriptionPlaceholder}
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
                  <ReviewDataButton
                    canProceed={canProceed}
                    blockerMessage={blockerMessage}
                    onProceed={handleProceed}
                    onHoverBlockerChange={setHoveringBlocker}
                  />
                </div>
                </ReadingRoomProvider>
                <HowThisWorksDrawer open={howOpen} onClose={() => setHowOpen(false)} title={(template ?? USERS_TEMPLATE_CONFIG).guideTitle} sections={howSections} hostRadius={16} />
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      <DiscardConfirmModal
        open={showDiscardConfirm}
        onCancel={() => setShowDiscardConfirm(false)}
        onConfirm={() => {
          setShowDiscardConfirm(false);
          onClose();
        }}
      />

      {renderReview ? renderReview({
        open: reviewOpen,
        importName: submittedName,
        importDescription: submittedDescription,
        fileName: data.uploadedFile?.name ?? "",
        parsedRows: data.parsedRows ?? [],
        sessionParentId: parentImportId,
        onClose: () => setReviewOpen(false),
        onCompleted: () => {
          setReviewOpen(false);
          onImportCompleted?.();
          onClose();
        },
      }) : (
      <ImportReviewModal
        open={reviewOpen}
        moduleSlug={moduleSlug}
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
      />
      )}
    </TooltipProvider>,
    document.body
  );
}

/* ──────── Primary "Review Data" button ──────── */
/* Disabled state still surfaces a tooltip + hover signal, the wrapping
 * span captures pointer events while the inner span suppresses them on the
 * native button so the disabled attribute stays semantically correct. */

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
      Review Data
      <ArrowRight className="w-3.5 h-3.5" />
    </button>
  );

  if (canProceed || !blockerMessage) return button;

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
      <TooltipContent
        side="top"
        sideOffset={8}
        className="z-[200] max-w-[260px] px-3 py-2"
      >
        <span style={{ fontSize: "12.5px", lineHeight: 1.4, fontWeight: 500 }}>{blockerMessage}</span>
      </TooltipContent>
    </Tooltip>
  );
}

/* ──────── Discard-changes confirmation ──────── */

function DiscardConfirmModal({
  open,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black/50 z-[300]"
            onClick={onCancel}
          />
          <div className="fixed inset-0 z-[301] flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              role="alertdialog"
              aria-labelledby="discard-title"
              aria-describedby="discard-desc"
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 12 }}
              transition={{ type: "spring", duration: 0.3, bounce: 0.15 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl overflow-hidden pointer-events-auto w-[calc(100vw-2rem)] max-w-[420px] flex flex-col"
              style={{ boxShadow: "0 24px 48px -12px rgba(0,0,0,0.22), 0 0 0 1px rgba(0,0,0,0.05)" }}
            >
              {/* Top: soft red glow + icon + DISCARD pill */}
              <div
                className="relative px-6 pt-8 pb-4 flex flex-col items-center"
                style={{
                  background:
                    "radial-gradient(120% 100% at 50% 0%, #FEE2E2 0%, rgba(254,226,226,0.4) 40%, rgba(255,255,255,0) 75%)",
                }}
              >
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center"
                  style={{ backgroundColor: "rgba(254,202,202,0.45)" }}
                >
                  <AlertTriangle className="w-8 h-8" style={{ color: "#DC2626" }} strokeWidth={2} />
                </div>
                <span
                  className="mt-4 inline-flex items-center px-3.5 py-1 rounded-full"
                  style={{
                    backgroundColor: "#FEE2E2",
                    color: "#B91C1C",
                    fontSize: "11px",
                    fontWeight: 700,
                    letterSpacing: 1.2,
                  }}
                >
                  DISCARD
                </span>
              </div>

              {/* Body */}
              <div className="px-6 pb-2 text-center">
                <h2 id="discard-title" className="text-[#0F172A]" style={{ fontSize: "20px", fontWeight: 700 }}>
                  Discard This Import?
                </h2>
                <p
                  id="discard-desc"
                  className="text-[#64748B] mt-2"
                  style={{ fontSize: "13.5px", lineHeight: 1.55 }}
                >
                  The name and file you added will not be saved.
                </p>
              </div>

              {/* Footer: stacked actions */}
              <div className="px-6 pt-4 pb-6 flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={onConfirm}
                  autoFocus
                  className="w-full h-11 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] active:bg-[#991B1B] text-white shadow-sm transition-colors cursor-pointer"
                  style={{ fontSize: "14px", fontWeight: 600 }}
                >
                  Discard
                </button>
                <button
                  type="button"
                  onClick={onCancel}
                  className="w-full h-11 rounded-xl bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#0F172A] transition-colors cursor-pointer"
                  style={{ fontSize: "14px", fontWeight: 600 }}
                >
                  Keep Editing
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
