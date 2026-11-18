import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { AlertTriangle, ArrowRight, CheckCircle2, X } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../ui/tooltip";
import { ReadingRoomProvider } from "../../ui/reading-room";
import { HowThisWorksButton, HowThisWorksDrawer } from "../import-wizard/HowThisWorks";
import { ImportSetupStep, useGuideHowSections } from "../import-wizard/ImportSetupStep";
import type { ImportWizardDataOf } from "../import-wizard/types";
import type { SheetImportSpec } from "./sheetSpec";
import type { SheetRow } from "./sheetRecords";
import { makeSheetParser } from "./sheetParser";
import { SheetImportReviewModal, type SheetImportOutcome } from "./SheetImportReviewModal";
import { MissingRecordsStep } from "./cells/MissingRecordsStep";
import type { EntityGap, EntityKind } from "./cells/importModel";
import { validateRows } from "./sheetValidation";

type WizardData = ImportWizardDataOf<SheetRow>;

const EMPTY: WizardData = {
  importName: "",
  uploadedFile: null,
  validationState: "valid",
  parsedRows: null,
};

interface Props {
  open: boolean;
  spec: SheetImportSpec;
  existingKeys?: readonly string[];
  onClose: () => void;
  /** Fires with the committed rows so the host can write history and detail. */
  onApplied: (
    outcome: SheetImportOutcome,
    meta: { name: string; description: string; fileName: string },
  ) => void;
  /** Header copy override, used by the fix-and-re-import flow. */
  title?: string;
  description?: string;
}

/* Mirrors the Users and Roles wizard shells one for one, typed to the sheet row
 * shape and wired to this module's template, parser and review modal. */
export function SheetImportWizardModal({
  open,
  spec,
  existingKeys,
  onClose,
  onApplied,
  title,
  description,
}: Props) {
  const [data, setData] = useState<WizardData>({ ...EMPTY });
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [submittedName, setSubmittedName] = useState("");
  const [submittedDescription, setSubmittedDescription] = useState("");
  const [hoveringBlocker, setHoveringBlocker] = useState(false);
  const [howOpen, setHowOpen] = useState(false);
  const [completed, setCompleted] = useState<SheetImportOutcome | null>(null);
  /* The step between upload and review: what this file names that Omne does not
     hold yet, so the admin can go and create it before working the sheet. Same
     component the Quote and Sales Order modules use. */
  const [gapsOpen, setGapsOpen] = useState(false);

  const parseFile = useMemo(() => makeSheetParser(spec), [spec]);
  const templateConfig = useMemo(
    () => ({
      dir: spec.templateDir,
      guideFilename: spec.guideFile,
      guideTitle: spec.guideTitle,
      templateXlsxFilename: spec.templateXlsx,
      templateCsvFilename: spec.templateCsv,
      previewFieldsText: spec.previewFieldsText,
      remainingFields: spec.remainingFields,
    }),
    [spec],
  );
  const howSections = useGuideHowSections(templateConfig);

  useEffect(() => {
    if (!open) return;
    setData({ ...EMPTY });
    setShowDiscardConfirm(false);
    setReviewOpen(false);
    setSubmittedName("");
    setSubmittedDescription("");
    setHoveringBlocker(false);
    setHowOpen(false);
    setCompleted(null);
  }, [open]);

  const isDirty = data.importName.trim().length > 0 || !!data.uploadedFile;

  const handleAttemptClose = useCallback(() => {
    if (reviewOpen) return;
    if (completed) { onClose(); return; }
    if (isDirty) { setShowDiscardConfirm(true); return; }
    onClose();
  }, [reviewOpen, completed, isDirty, onClose]);

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

  const update = useCallback(<K extends keyof WizardData>(key: K, value: WizardData[K]) => {
    setData((prev) => ({ ...prev, [key]: value }));
  }, []);

  const canProceed = !!data.uploadedFile && !!data.parsedRows && data.validationState === "valid";

  /* Only what is actually missing from THIS file, grouped by value, with the
     number of cells and records naming it. */
  const gaps = useMemo<EntityGap[]>(() => {
    const rows = data.parsedRows ?? [];
    if (rows.length === 0) return [];
    const validated = validateRows(rows, spec, { existingKeys });
    const byKey = new Map<string, EntityGap>();
    for (const row of validated) {
      for (const issue of row.issues) {
        if (issue.level !== "error") continue;
        const col = spec.columns.find((c) => c.key === issue.field);
        if (!col?.catalog) continue;
        if (!/does not exist in Omne yet/.test(issue.message)) continue;
        const raw = issue.message.replace(/ does not exist in Omne yet\.$/, "");
        const key = `${col.catalog}::${raw.toLowerCase()}`;
        const existing = byKey.get(key);
        if (existing) {
          existing.occurrences += 1;
          if (!existing.recordIds.includes(row._key)) existing.recordIds.push(row._key);
        } else {
          byKey.set(key, {
            entity: col.catalog as EntityKind,
            rawValue: raw,
            occurrences: 1,
            recordIds: [row._key],
          });
        }
      }
    }
    return [...byKey.values()];
  }, [data.parsedRows, spec, existingKeys]);

  const handleProceed = useCallback(() => {
    if (!canProceed || !data.uploadedFile) return;
    const typed = data.importName.trim();
    const stem = data.uploadedFile.name.replace(/\.[^.]+$/, "");
    setSubmittedName(typed || stem);
    setSubmittedDescription(typed);
    /* Nothing missing means nothing to educate about: go straight to review. */
    if (gaps.length > 0) setGapsOpen(true);
    else setReviewOpen(true);
  }, [canProceed, data.importName, data.uploadedFile, gaps]);

  if (!open) return null;

  const fileMissing = !data.uploadedFile;

  return createPortal(
    <TooltipProvider delayDuration={200}>
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100]"
          onClick={handleAttemptClose}
        />
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
              <div className="px-4 lg:px-5 py-4 shrink-0 bg-white border-b border-[#EEF2F6]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-[#0F172A]" style={{ fontSize: "17px", fontWeight: 700 }}>
                      {title ?? `Import ${spec.recordLabelPlural.toLowerCase()}`}
                    </h2>
                    <p className="text-[#64748B] mt-0.5" style={{ fontSize: "12px" }}>
                      {description ??
                        `Upload a spreadsheet to bring ${spec.recordLabelPlural.toLowerCase()} and their line items into Omne.`}
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

              <div className="flex-1 min-h-0 overflow-y-auto bg-[#F8FAFC]">
                <div className="px-4 lg:px-5 py-4 lg:py-5">
                  {completed ? (
                    <CompletedPanel spec={spec} outcome={completed} />
                  ) : (
                    <ImportSetupStep<SheetRow>
                      data={data}
                      onChange={update}
                      recordTypeLabel={spec.recordLabelPlural}
                      highlightMissingFile={hoveringBlocker && fileMissing}
                      descriptionPlacement="bottom"
                      template={templateConfig}
                      parseFile={parseFile}
                    />
                  )}
                </div>
              </div>

              <div className="shrink-0 border-t border-[#EEF2F6] bg-white px-4 lg:px-5 py-2.5 sm:py-3 flex items-center justify-end gap-2 sm:gap-2.5">
                {completed ? (
                  <button
                    type="button"
                    onClick={onClose}
                    className="inline-flex items-center justify-center px-5 h-9 rounded-[8px] bg-[#0A77FF] hover:bg-[#0066D6] text-white shadow-sm transition-colors cursor-pointer"
                    style={{ fontSize: 13, fontWeight: 600 }}
                  >
                    Done
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleAttemptClose}
                      className="inline-flex items-center justify-center px-3 sm:px-5 h-8 sm:h-9 rounded-[8px] border border-[#E2E8F0] bg-white text-[#64748B] hover:text-[#0F172A] hover:border-[#CBD5E1] transition-colors cursor-pointer"
                      style={{ fontSize: "13px", fontWeight: 500 }}
                    >
                      Cancel
                    </button>
                    <ReviewButton
                      canProceed={canProceed}
                      blockerMessage={fileMissing ? "Upload a file to continue." : null}
                      onProceed={handleProceed}
                      onHoverBlockerChange={setHoveringBlocker}
                    />
                  </>
                )}
              </div>
            </ReadingRoomProvider>
            <HowThisWorksDrawer open={howOpen} onClose={() => setHowOpen(false)} title={(templateConfig).guideTitle} sections={howSections} hostRadius={16} />
          </motion.div>
        </div>
      </AnimatePresence>

      <DiscardConfirm
        open={showDiscardConfirm}
        onCancel={() => setShowDiscardConfirm(false)}
        onConfirm={() => { setShowDiscardConfirm(false); onClose(); }}
      />

      <MissingRecordsStep
        open={gapsOpen}
        gaps={gaps}
        recordNoun={spec.recordLabel.toLowerCase()}
        recordNounPlural={spec.recordLabelPlural.toLowerCase()}
        onClose={() => setGapsOpen(false)}
        onContinue={() => { setGapsOpen(false); setReviewOpen(true); }}
      />

      <SheetImportReviewModal
        open={reviewOpen}
        spec={spec}
        existingKeys={existingKeys}
        importName={submittedName}
        importDescription={submittedDescription}
        fileName={data.uploadedFile?.name ?? ""}
        parsedRows={data.parsedRows ?? []}
        onClose={() => setReviewOpen(false)}
        onApplied={(outcome) => {
          setReviewOpen(false);
          setCompleted(outcome);
          onApplied(outcome, {
            name: submittedName,
            description: submittedDescription,
            fileName: data.uploadedFile?.name ?? "",
          });
        }}
      />
    </TooltipProvider>,
    document.body,
  );
}

/* What the import did, in the module's own numbers: records created, rows that
 * carried a mapped value, rows dropped. */
function CompletedPanel({ spec, outcome }: { spec: SheetImportSpec; outcome: SheetImportOutcome }) {
  const changed = outcome.rows.filter(
    (r) => r._outcome === "Created" && r.issues.length > 0,
  ).length;
  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-[#ECFDF5] flex items-center justify-center shrink-0">
          <CheckCircle2 className="w-5 h-5 text-[#059669]" />
        </div>
        <div className="min-w-0">
          <p className="text-[#0F172A]" style={{ fontSize: 14, fontWeight: 600 }}>
            {outcome.records} {outcome.records === 1 ? spec.recordLabel.toLowerCase() : spec.recordLabelPlural.toLowerCase()} imported
          </p>
          <p className="text-[#64748B] mt-0.5" style={{ fontSize: 12 }}>
            {outcome.imported} {outcome.imported === 1 ? "row" : "rows"} landed on those records. You can open this import from the history below to review it later.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Rows imported" value={outcome.imported} />
        <Stat label="Rows with a mapped value" value={changed} />
        <Stat label="Rows dropped" value={outcome.skipped} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-[#EEF2F6] bg-[#F8FAFC] px-3 py-2.5">
      <p className="text-[#0F172A]" style={{ fontSize: 18, fontWeight: 700 }}>{value}</p>
      <p className="text-[#64748B]" style={{ fontSize: 11.5 }}>{label}</p>
    </div>
  );
}

function ReviewButton({
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
          onMouseEnter={() => onHoverBlockerChange(true)}
          onMouseLeave={() => onHoverBlockerChange(false)}
          className="inline-flex"
        >
          <span className="pointer-events-none">{button}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="z-[300]">{blockerMessage}</TooltipContent>
    </Tooltip>
  );
}

function DiscardConfirm({
  open,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;
  return createPortal(
    <>
      <div className="fixed inset-0 bg-black/40 z-[120]" onClick={onCancel} />
      <div className="fixed inset-0 z-[121] flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-white rounded-2xl p-5 w-[380px] pointer-events-auto"
          style={{ boxShadow: "0 24px 48px -12px rgba(0,0,0,0.18)" }}
        >
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#FEF2F2] flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-[#DC2626]" />
            </div>
            <div>
              <p className="text-[#0F172A]" style={{ fontSize: 14, fontWeight: 600 }}>Discard this import?</p>
              <p className="text-[#64748B] mt-0.5" style={{ fontSize: 12 }}>
                The file you uploaded and anything you typed will be lost.
              </p>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2.5 mt-4">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 h-9 rounded-[8px] border border-[#E2E8F0] bg-white text-[#64748B] hover:text-[#0F172A] cursor-pointer"
              style={{ fontSize: 13, fontWeight: 500 }}
            >
              Keep editing
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="px-4 h-9 rounded-[8px] bg-[#DC2626] hover:bg-[#B91C1C] text-white cursor-pointer"
              style={{ fontSize: 13, fontWeight: 600 }}
            >
              Discard
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
