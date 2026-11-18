import {
  Download,
  Upload,
  FileSpreadsheet,
  FileText,
  Trash2,
  Type,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "../../ui/utils";
import { Tooltip, TooltipTrigger, TooltipContent } from "../../ui/tooltip";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "../../ui/hover-card";
import { type ReadingRoomSection } from "../../ui/reading-room";
import type { HowThisWorksSection } from "./HowThisWorks";
import {
  GuideBlocks,
  type GuideBlock,
  USERS_GUIDE_SECTIONS,
  ROLES_GUIDE_SECTIONS,
} from "./importGuideContent";
import {
  type ImportWizardDataOf,
  type UploadedFile,
} from "./types";
import { parseImportFile } from "../import-review/fileParser";
import { asset } from "@/embedding";
import { AttachmentCard, UploadingCard, CARD_GRID_STYLE } from "./uploadedFileCard";

/** Lowercased extension of a file name, e.g. "xlsx". */
function fileExt(name: string): string {
  const m = name.toLowerCase().match(/\.([^.]+)$/);
  return m ? m[1] : "";
}

const GUIDE_DIVIDER = "-".repeat(66);

/** Parse the import guide TXT into ReadingRoom sections. Sections are
 *  delimited by full-width 66-dash dividers; the line between two dividers
 *  is the section title, and lines after the closing divider until the next
 *  opener form the body. The leading "===" banner and intro paragraph are
 *  pulled into a synthetic "Overview" section. */
function parseImportGuide(txt: string): ReadingRoomSection[] {
  const lines = txt.replace(/\r\n/g, "\n").split("\n");
  const sections: ReadingRoomSection[] = [];

  // Skip the top "===" banner block (banner is bounded by lines starting
  // with "==="). We keep going until the first dash-divider, gathering the
  // intro paragraph along the way.
  let i = 0;
  // Skip first === banner
  if (lines[i]?.startsWith("===")) {
    i++;
    while (i < lines.length && !lines[i].startsWith("===")) i++;
    i++; // skip the closing === line
  }

  const introLines: string[] = [];
  while (i < lines.length && !lines[i].startsWith(GUIDE_DIVIDER)) {
    introLines.push(lines[i]);
    i++;
  }
  const intro = introLines.join("\n").trim();
  if (intro) {
    sections.push({ title: "Overview", body: <GuideBody text={intro} />, blocks: parseGuideBody(intro) } as ReadingRoomSection);
  }

  while (i < lines.length) {
    if (!lines[i].startsWith(GUIDE_DIVIDER)) {
      i++;
      continue;
    }
    const title = (lines[i + 1] ?? "").trim();
    i += 3; // skip opener, title line, closer
    const bodyLines: string[] = [];
    while (i < lines.length && !lines[i].startsWith(GUIDE_DIVIDER)) {
      bodyLines.push(lines[i]);
      i++;
    }
    while (bodyLines.length && !bodyLines[0].trim()) bodyLines.shift();
    while (bodyLines.length && !bodyLines[bodyLines.length - 1].trim()) bodyLines.pop();
    // Stop before trailing "===" closing banner, discard it from the body
    const cleanedBody = bodyLines.filter((l) => !l.startsWith("===")).join("\n").trim();
    if (title) {
      sections.push({ title, body: <GuideBody text={cleanedBody} />, blocks: parseGuideBody(cleanedBody) } as ReadingRoomSection);
    }
  }
  return sections;
}

/** Parse a section body into prose blocks. The source TXT was written with
 *  fixed 66-char wrapping and ASCII column alignment; we flatten that into
 *  proper paragraphs so the drawer renders in Inter as readable prose.
 *
 *  Recognises:
 *  - Sub-headers: a line followed by a row of dashes (e.g. "Required columns")
 *  - Labeled items: "Label  Description" with 2+ spaces between (e.g. field
 *    reference rows). Continuation lines indented under the label are folded
 *    back into the description.
 *  - Everything else: a normal paragraph. */
function parseGuideBody(text: string): GuideBlock[] {
  const rawLines = text.split("\n");
  const isDash = (l: string) => /^-+\s*$/.test(l.trim()) && l.trim().length >= 2;
  const labelPattern = /^\s*(\S+(?:\s\S+){0,4}?)\s{2,}(.+)$/;

  type Tagged = { line: string; isSub: boolean };
  const lines: Tagged[] = [];
  for (let i = 0; i < rawLines.length; i++) {
    if (isDash(rawLines[i])) continue;
    const next = rawLines[i + 1] ?? "";
    lines.push({ line: rawLines[i], isSub: isDash(next) });
  }

  const blocks: GuideBlock[] = [];
  let i = 0;
  while (i < lines.length) {
    const { line, isSub } = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    if (isSub) {
      blocks.push({ kind: "subheader", text: line.trim().replace(/\s+/g, " ") });
      i++;
      continue;
    }
    const labelMatch = line.match(labelPattern);
    if (labelMatch) {
      const [, label, firstDesc] = labelMatch;
      const buf = [firstDesc];
      i++;
      while (i < lines.length) {
        const n = lines[i];
        if (!n.line.trim()) break;
        if (n.isSub) break;
        if (n.line.match(labelPattern)) break;
        buf.push(n.line.trim());
        i++;
      }
      blocks.push({
        kind: "labeled",
        label: label.trim(),
        body: buf.join(" ").replace(/\s+/g, " ").trim(),
      });
      continue;
    }
    // Plain paragraph: gather wrapped lines until blank / sub-header / labeled.
    const buf = [line.trim()];
    i++;
    while (i < lines.length) {
      const n = lines[i];
      if (!n.line.trim()) break;
      if (n.isSub) break;
      if (n.line.match(labelPattern)) break;
      buf.push(n.line.trim());
      i++;
    }
    blocks.push({ kind: "paragraph", text: buf.join(" ").replace(/\s+/g, " ").trim() });
  }
  return blocks;
}

function GuideBody({ text }: { text: string }) {
  const blocks = useMemo(() => parseGuideBody(text), [text]);
  return <GuideBlocks blocks={blocks} />;
}

/** Per-module template + guide configuration for the setup step. Every
 *  string that names the Users module lives here so the same component can
 *  serve the Roles wizard (and future modules) with its own files. */
export interface ImportTemplateConfig {
  /** Subfolder under public/templates holding this module's files, e.g.
   *  "quotes". Omit for the files that sit directly in that folder. */
  dir?: string;
  /** Plain-text companion guide shipped next to the CSV. It is downloaded
   *  alongside the CSV template (the CSV can carry no instructions of its
   *  own, unlike the Excel file's Instructions sheet). Modules that have not
   *  been given authored drawer copy yet also fall back to parsing this file
   *  into the "How This Works" drawer. */
  guideFilename: string;
  /** Authored "How This Works" drawer copy, written to be true of the Excel
   *  template and the CSV alike. Takes precedence over parsing
   *  `guideFilename`, which is a CSV-specific document. */
  guideSections?: ReadingRoomSection[];
  guideTitle: string;
  templateXlsxFilename: string;
  templateCsvFilename: string;
  previewFieldsText: string;
  remainingFields: string[];
}

export const USERS_TEMPLATE_CONFIG: ImportTemplateConfig = {
  guideFilename: "OMNE_Users_Import_Guide.txt",
  guideSections: USERS_GUIDE_SECTIONS,
  guideTitle: "Users Import Guide",
  templateXlsxFilename: "OMNE_Users_Import_Template.xlsx",
  templateCsvFilename: "OMNE_Users_Import_Template.csv",
  previewFieldsText: "name, email, license, roles, job title",
  remainingFields: [
    "Status",
    "Assigned Roles",
    "Username",
    "Gender",
    "Date of Birth",
    "Preferred Name",
    "Pronouns",
    "Job Title",
    "Personal Email",
    "Mobile",
    "Work Phone",
    "Home Address",
    "Work Address",
  ],
};

export const ROLES_TEMPLATE_CONFIG: ImportTemplateConfig = {
  guideFilename: "OMNE_Roles_Import_Guide.txt",
  guideSections: ROLES_GUIDE_SECTIONS,
  guideTitle: "Roles Import Guide",
  templateXlsxFilename: "OMNE_Roles_Import_Template.xlsx",
  templateCsvFilename: "OMNE_Roles_Import_Template.csv",
  previewFieldsText: "role name, description, role owner",
  remainingFields: [
    "Role Owner",
    "Assigned Users",
  ],
};

/** Minimal parse contract the setup step needs, both parseImportFile
 *  (Users) and parseRolesImportFile (Roles) satisfy it. */
interface ParseResultOf<Row> {
  rows: Row[];
  matchedFieldCount: number;
}

/** Framing for an upload that is a correction rather than a fresh import.
 *  When present the setup step drops the template bar and the description
 *  field (the name is derived from the parent) and puts the error file the
 *  admin is working from front and centre instead. */
export interface CorrectionSetupContext {
  /** Name of the import being corrected. */
  parentName: string;
  /** The error file that was handed to the admin, when we know it. */
  fileName: string | null;
  /** How many error rows went out in it. */
  rowCount: number;
  /** Hand the admin the error file again. */
  onRedownload: (format: "csv" | "xlsx") => void;
}

/** Our parser errors (Users + Roles) both carry a `code` discriminator; the
 *  setup step surfaces their message verbatim and falls back to a generic
 *  line for anything else that escapes the parser. */
function isImportParseError(err: unknown): err is Error & { code: string } {
  return err instanceof Error && typeof (err as { code?: unknown }).code === "string";
}

interface Props<Row> {
  data: ImportWizardDataOf<Row>;
  onChange: <K extends keyof ImportWizardDataOf<Row>>(key: K, value: ImportWizardDataOf<Row>[K]) => void;
  recordTypeLabel: string;
  /** When true (i.e. the parent is hovering the disabled primary CTA and no
   *  file has been uploaded), the dropzone renders in a red/error state. */
  highlightMissingFile?: boolean;
  /** Position of the Import description block.
   *  "top" (default), description, template, upload (legacy layout).
   *  "bottom", template, upload, divider, description (UAC layout). */
  descriptionPlacement?: "top" | "bottom";
  /** Template + guide file set. Defaults to the Users module's files so
   *  every existing caller keeps its behavior unchanged. */
  template?: ImportTemplateConfig;
  /** File parser producing this wizard's row shape. Defaults to the Users
   *  parser. */
  parseFile?: (file: File) => Promise<ParseResultOf<Row>>;
  /** Set when this upload is a correction of an existing import. */
  correction?: CorrectionSetupContext | null;
  /** File to accept automatically as soon as the step mounts, so a file
   *  dropped on the correction strip doesn't have to be picked a second
   *  time inside the wizard. */
  initialFile?: File | null;
  /** Import Description placeholder. Defaults to the Users wording. */
  descriptionPlaceholder?: string;
}

const UPLOAD_DURATION_MS = 850;

export function ImportSetupStep<Row>({
  data,
  onChange,
  highlightMissingFile,
  descriptionPlacement = "top",
  template = USERS_TEMPLATE_CONFIG,
  parseFile = parseImportFile as unknown as (file: File) => Promise<ParseResultOf<Row>>,
  correction = null,
  initialFile = null,
  descriptionPlaceholder = "e.g. New hires Q2 2026. A short note that helps you find this import later.",
}: Props<Row>) {
  const [uploading, setUploading] = useState(false);
  /* Name/size of the file currently being processed, drives the skeleton
   * uploading card (grid variant). Cleared when the upload finishes or is
   * cancelled. */
  const [pendingFile, setPendingFile] = useState<{ name: string; sizeKB: number } | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const uploadCancelledRef = useRef(false);
  const progressRafRef = useRef(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    return () => {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
      cancelAnimationFrame(progressRafRef.current);
    };
  }, []);

  /** Save one file out of public/templates under its plain name. The href may
   *  sit in a module subfolder; the download keeps the bare file name so the
   *  saved file is not called "quotes_OMNE...". */
  const saveTemplateFile = (filename: string) => {
    const href = asset(`/templates/${template.dir ? `${template.dir}/` : ""}${filename}`);
    const a = document.createElement("a");
    a.href = href;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDownload = (format: "excel" | "csv") => {
    const filename = format === "csv" ? template.templateCsvFilename : template.templateXlsxFilename;
    saveTemplateFile(filename);

    /* The Excel template carries its own Instructions, Field Reference and
     * Valid Values sheets. A CSV cannot, so the plain-text guide rides along
     * with it. Staggered so browsers treat it as a second download rather
     * than swallowing it. */
    const companionGuide = format === "csv" ? template.guideFilename : null;
    if (companionGuide) {
      const t = setTimeout(() => saveTemplateFile(companionGuide), 400);
      timersRef.current.push(t);
    }

    toast.success("Template downloaded", {
      description: companionGuide ? `${filename} and ${companionGuide}` : filename,
      duration: 3000,
    });
    /* The guide no longer opens on download; it lives behind How This Works. */
  };

  const isAcceptedFile = (file: File) => {
    const name = file.name.toLowerCase();
    return name.endsWith(".xlsx") || name.endsWith(".csv");
  };

  const acceptFile = (file: File, force = false) => {
    if (!isAcceptedFile(file)) {
      toast.error("Unsupported file type", {
        description: "Upload an Excel (.xlsx) or CSV (.csv) file.",
      });
      return;
    }
    /* `force` is for the handed-in file: the wizard's own reset lands a tick
     * after this step mounts, so `data.uploadedFile` can still hold the
     * previous session's file and would swallow the drop. */
    if (uploading || (!force && data.uploadedFile)) return;
    uploadCancelledRef.current = false;
    setUploading(true);
    setPendingFile({ name: file.name, sizeKB: Math.max(1, Math.round(file.size / 1024)) });
    setUploadProgress(0);

    /* Parse and show-the-progress-bar happen in parallel; we resolve the
     * upload step only once both have settled. Keeps the existing 850ms
     * animation feel even for small files that parse instantly. */
    const startedAt = performance.now();
    const parsePromise = parseFile(file).catch((err: unknown) => err);

    /* Drive the uploading card's circular progress ring over the same
     * 850ms window the dropzone's bar animates across. */
    const tick = (now: number) => {
      if (uploadCancelledRef.current) return;
      const ratio = Math.min(1, (now - startedAt) / UPLOAD_DURATION_MS);
      setUploadProgress(Math.round(ratio * 100));
      if (ratio < 1) progressRafRef.current = requestAnimationFrame(tick);
    };
    progressRafRef.current = requestAnimationFrame(tick);

    const finish = (parsed: ParseResultOf<Row> | unknown) => {
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
      const result = parsed as ParseResultOf<Row>;
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
      const t = setTimeout(() => finish(parsed), remaining);
      timersRef.current.push(t);
    });
  };

  /* A file handed in from outside (dropped on the correction strip) is
   * accepted once, on mount. The ref guards against the effect re-running
   * and re-uploading the same file after an unrelated re-render. */
  const initialFileRef = useRef<File | null>(null);
  useEffect(() => {
    if (!initialFile || initialFileRef.current === initialFile) return;
    initialFileRef.current = initialFile;
    acceptFile(initialFile, true);
    /* acceptFile closes over render-scoped state by design; re-running this
     * on every render would re-upload. Keyed on the file identity only. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFile]);

  /* Cancel an in-flight upload (X on the skeleton card), discards the
   * pending parse and returns the dropzone to its empty state. */
  const handleCancelUpload = () => {
    uploadCancelledRef.current = true;
    timersRef.current.forEach(clearTimeout);
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

  const descriptionBlock = (
    <>
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
        placeholder={descriptionPlaceholder}
        rows={3}
        className={cn(
          "w-full px-3 py-2.5 text-sm bg-white border rounded-md shadow-sm placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#0A77FF]/20 transition-colors resize-y block",
          "border-[#E2E8F0] focus:border-[#0A77FF]"
        )}
        style={{ minHeight: 76, marginTop: 0, marginBottom: 0 }}
      />
      <p
        className="text-[12px] text-[#64748B]"
        style={{ marginTop: 4, marginBottom: 0, lineHeight: 1.4 }}
      >
        Helps you find the import later in your history. It does not affect the file.
      </p>
    </>
  );

  /* A correction never wants the blank template, the admin already has the
   * file they need. Point them back at it instead. */
  const templateBlock = correction ? (
    <CorrectionBar correction={correction} />
  ) : (
    <TemplateBar
      onDownload={handleDownload}
      previewFieldsText={template.previewFieldsText}
      remainingFields={template.remainingFields}
    />
  );

  const uploadBlock = (
    <>
      <FieldLabel required>Upload Your File</FieldLabel>
      <UploadCard
        uploading={uploading}
        file={data.uploadedFile}
        onAcceptFile={acceptFile}
        onRemove={handleRemoveFile}
        highlightMissing={!!highlightMissingFile}
        /* UAC layout has content below the upload card, let it shift down
         * naturally on upload instead of holding a reserved 52px slot. */
        reserveFileSlot={descriptionPlacement !== "bottom"}
        /* Import Users modal (bottom layout) renders the attachment-card
         * grid below the dropzone; other modules keep the legacy row card. */
        fileCardVariant={descriptionPlacement === "bottom" ? "grid" : "row"}
        pendingFile={pendingFile}
        uploadProgress={uploadProgress}
        onCancelUpload={handleCancelUpload}
      />
    </>
  );

  if (descriptionPlacement === "bottom") {
    return (
      // Min-height keeps the modal body the same size when no file is
      // uploaded; once an uploaded-file card appears, the content naturally
      // grows beyond this floor.
      <div className="flex flex-col" style={{ minHeight: 540 }}>
        {/* SECTION 1, TEMPLATE */}
        <div>{templateBlock}</div>
        {/* SECTION 2, FILE UPLOAD */}
        <div style={{ marginTop: 20 }}>{uploadBlock}</div>
        {/* SECTION 3, IMPORT DESCRIPTION (sits directly under upload).
            Skipped on a correction, whose name is derived from its parent. */}
        {!correction && <div style={{ marginTop: 20 }}>{descriptionBlock}</div>}
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* SECTION 1, IMPORT DESCRIPTION (optional). Skipped on a correction,
          whose name is derived from its parent. */}
      {!correction && descriptionBlock}
      {/* SECTION 2, COMPACT TEMPLATE BAR */}
      <div style={{ marginTop: 20 }}>{templateBlock}</div>
      {/* SECTION 3, FILE UPLOAD */}
      <div style={{ marginTop: 20 }}>{uploadBlock}</div>
    </div>
  );
}

/* ──────── Sub-components ──────── */

function FieldLabel({
  required,
  children,
}: {
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1 mb-1.5">
      <label className="text-[#0F172A]" style={{ fontSize: "13px", fontWeight: 500 }}>
        {children}
      </label>
      {required && <span className="text-[#EF4444]" style={{ fontSize: "13px" }}>*</span>}
    </div>
  );
}

function TemplateBar({
  onDownload,
  previewFieldsText,
  remainingFields,
}: {
  onDownload: (format: "excel" | "csv") => void;
  previewFieldsText: string;
  remainingFields: string[];
}) {
  return (
    <div
      className="flex items-center gap-3 rounded-[8px] bg-[#EFF6FF] px-3 py-2.5"
      style={{
        minHeight: 58,
        border: "1.5px solid #BFDBFE",
        boxShadow: "0 1px 2px 0 rgba(0,0,0,0.05)",
      }}
    >
      <div
        className="shrink-0 flex items-center justify-center rounded-[6px] bg-[#DBEAFE]"
        style={{ width: 32, height: 32 }}
      >
        <FileSpreadsheet
          style={{ width: 18, height: 18, color: "#3B82F6" }}
          aria-hidden
        />
      </div>
      <div className="min-w-0 flex-1 leading-tight">
        <p className="text-[#0F172A]" style={{ fontSize: "13px", fontWeight: 500 }}>
          Download the Import Template
        </p>
        <p className="text-[#64748B] mt-0.5" style={{ fontSize: "12px" }}>
          Includes {previewFieldsText} and{" "}
          <FieldsPopover count={remainingFields.length} fields={remainingFields} />
        </p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <TemplateButton label="Excel" onClick={() => onDownload("excel")} />
        <TemplateButton label="CSV" onClick={() => onDownload("csv")} />
      </div>
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

/* Correction counterpart of TemplateBar. Same geometry so the modal body
 * doesn't jump between a fresh import and a correction, amber tone and copy
 * that names the import being fixed. The blank template is useless here, so
 * the two buttons re-issue the error file instead. */
function CorrectionBar({ correction }: { correction: CorrectionSetupContext }) {
  const rowLabel = `${correction.rowCount} error row${correction.rowCount === 1 ? "" : "s"}`;
  return (
    <div
      className="flex items-center gap-3 rounded-[8px] bg-[#FFFBEB] px-3 py-2.5"
      style={{
        minHeight: 58,
        border: "1.5px solid #FDE68A",
        boxShadow: "0 1px 2px 0 rgba(0,0,0,0.05)",
      }}
    >
      <div
        className="shrink-0 flex items-center justify-center rounded-[6px] bg-[#FEF3C7]"
        style={{ width: 32, height: 32 }}
      >
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
        <CorrectionDownloadButton label="Excel" onClick={() => correction.onRedownload("xlsx")} />
        <CorrectionDownloadButton label="CSV" onClick={() => correction.onRedownload("csv")} />
      </div>
    </div>
  );
}

function CorrectionDownloadButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center justify-center gap-1 h-8 px-2.5 rounded-[6px] border border-[#D97706] bg-white text-[#B45309] hover:bg-[#D97706] hover:text-white active:bg-[#B45309] active:border-[#B45309] transition-colors cursor-pointer"
      style={{ fontSize: "12px", fontWeight: 500, minWidth: 76 }}
      aria-label={`Download the error file again as ${label}`}
    >
      <Download className="w-3 h-3" />
      {label}
    </button>
  );
}

function UploadCard({
  uploading,
  file,
  onAcceptFile,
  onRemove,
  highlightMissing,
  reserveFileSlot = true,
  fileCardVariant = "row",
  pendingFile = null,
  uploadProgress = 0,
  onCancelUpload,
}: {
  uploading: boolean;
  file: UploadedFile | null;
  onAcceptFile: (file: File) => void;
  onRemove: () => void;
  highlightMissing: boolean;
  /** When true (default), reserves a 52px row below the dropzone so the
   *  modal doesn't shift when a file is added. When false, the uploaded
   *  file card only mounts after a file is present, the row above it grows
   *  on upload. Only applies to the "row" variant. */
  reserveFileSlot?: boolean;
  /** "grid" renders the attachment-card grid (Import Users modal) below the
   *  dropzone, a skeleton uploading card while processing that swaps to the
   *  final thumbnail card in place. "row" keeps the legacy compact card. */
  fileCardVariant?: "row" | "grid";
  /** Name/size of the in-flight file, feeds the skeleton uploading card. */
  pendingFile?: { name: string; sizeKB: number } | null;
  /** 0–100 progress for the uploading card's ring. */
  uploadProgress?: number;
  onCancelUpload?: () => void;
}) {
  const dropzoneDisabled = uploading || !!file;
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const openPicker = () => {
    if (dropzoneDisabled) return;
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    if (picked) onAcceptFile(picked);
    /* Reset so picking the same file again still fires onChange. */
    e.target.value = "";
  };

  const handleDragOver = (e: React.DragEvent<HTMLElement>) => {
    if (dropzoneDisabled) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    /* Only clear when leaving the dropzone itself, not when crossing into a child. */
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (dropzoneDisabled) return;
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) onAcceptFile(dropped);
  };

  return (
    <div className="flex flex-col">
      {/* Hidden native file input, drives the OS picker. */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
        className="hidden"
        onChange={handleFileInputChange}
        aria-hidden
        tabIndex={-1}
      />

      {/* Dropzone.
          "grid" (Import Users modal): compact single-row bar, Physical
          Inventory parity. Icon tile left, two stacked text lines right.
          Token literals: border #EAEBF0, primary #0A77FF, muted #F7F7F8,
          drag tint rgba(214,232,255,0.30), tile flip #D6E8FF, 10px radius.
          "row" (other modules): legacy tall centered block, unchanged. */}
      {fileCardVariant === "grid" ? (
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
                : cn(
                    "border-[#EAEBF0] bg-white",
                    !dropzoneDisabled && "hover:border-[#CBD5E1] hover:bg-[#FAFBFC]",
                  ),
          )}
          style={{ borderRadius: 10 }}
        >
          <div className="flex items-center gap-3 text-left">
            {/* Icon tile, 36x36. Muted grey idle, light blue on drag-over */}
            <div
              className={cn(
                "w-9 h-9 flex items-center justify-center shrink-0 transition-colors",
                isDragging ? "bg-[#D6E8FF] text-[#0A77FF]" : "bg-[#F7F7F8] text-[#94A3B8]",
              )}
              style={{ borderRadius: 10 }}
            >
              <Upload className={cn("w-4 h-4", uploading && "animate-pulse")} />
            </div>
            {/* Two stacked text lines */}
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
      ) : (
      <button
        type="button"
        onClick={openPicker}
        onDragEnter={handleDragOver}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        disabled={dropzoneDisabled}
        className={cn(
          "relative overflow-hidden rounded-lg px-4 py-6 w-full bg-white flex flex-col items-center justify-center text-center transition-colors",
          !dropzoneDisabled && "cursor-pointer hover:bg-[#F8FAFC]",
          isDragging && "bg-[#EFF6FF]",
          highlightMissing && "bg-[#FEF2F2]",
        )}
        style={{ boxShadow: "0 1px 2px 0 rgba(0,0,0,0.04)" }}
      >
        <svg
          className="absolute inset-0 pointer-events-none"
          width="100%"
          height="100%"
          aria-hidden
        >
          <rect
            x="0.75"
            y="0.75"
            rx="7.25"
            ry="7.25"
            fill="none"
            stroke={isDragging ? "#0A77FF" : highlightMissing ? "#EF4444" : "#CBD5E1"}
            strokeWidth="1.5"
            strokeDasharray="4 4"
            style={{ width: "calc(100% - 1.5px)", height: "calc(100% - 1.5px)" }}
          />
        </svg>
        <AnimatePresence>
          {uploading && (
            <motion.div
              key="up-track"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="absolute top-0 left-0 right-0 h-[3px] bg-[#E2E8F0]"
              aria-hidden
            >
              <motion.div
                key="up-fill"
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: UPLOAD_DURATION_MS / 1000, ease: "easeOut" }}
                className="h-full"
                style={{ backgroundColor: "#0A77FF" }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <div
          className="w-10 h-10 rounded-full flex items-center justify-center mb-2.5"
          style={{ backgroundColor: "#F1F5F9" }}
        >
          <Upload
            className={cn("w-5 h-5", uploading && "animate-pulse")}
            style={{ color: "#64748B" }}
          />
        </div>
        {uploading ? (
          <>
            <p className="text-[#0A77FF]" style={{ fontSize: "13.5px", fontWeight: 600 }}>
              Uploading Your File
            </p>
            {/* Invisible spacer keeps the dropzone the same height as the empty state */}
            <p className="mt-1" style={{ fontSize: "11.5px", visibility: "hidden" }} aria-hidden>
              Excel or CSV. Up to 10 MB.
            </p>
          </>
        ) : (
          <>
            <p className="text-[#0F172A]" style={{ fontSize: "13.5px", fontWeight: 500 }}>
              {file ? (
                <>
                  1 file added.{" "}
                  <span className="text-[#0A77FF]" style={{ fontWeight: 600 }}>Add Another</span>
                </>
              ) : (
                <>
                  <span className="text-[#0A77FF] hover:underline" style={{ fontWeight: 600 }}>Click to Upload</span>
                  {" "}or drag and drop
                </>
              )}
            </p>
            {highlightMissing ? (
              <p className="text-[#EF4444] mt-1" style={{ fontSize: "11.5px", fontWeight: 500 }}>
                Upload an Excel or CSV file to continue.
              </p>
            ) : (
              <p className="text-[#94A3B8] mt-1" style={{ fontSize: "11.5px" }}>
                Excel or CSV. Up to 10 MB.
              </p>
            )}
          </>
        )}
      </button>
      )}

      {/* Uploaded file display.
          "grid" (Import Users modal): attachment-card grid below the
          dropzone, skeleton card with progress ring while processing,
          swapping in place to the final thumbnail card. Same footprint
          between the two states, so no layout shift.
          "row" (other modules): legacy compact row card. Default mode
          reserves a single-card row so the modal doesn't shift on upload;
          compact mode only renders the row when a file is actually
          present. Scrolls past ~120px. */}
      {fileCardVariant === "grid" ? (
        ((uploading && pendingFile) || file) && (
          <div style={CARD_GRID_STYLE}>
            {uploading && pendingFile ? (
              <UploadingCard
                fileName={pendingFile.name}
                fileSize={`${pendingFile.sizeKB} KB`}
                ext={fileExt(pendingFile.name)}
                progress={uploadProgress}
                onCancel={() => onCancelUpload?.()}
              />
            ) : file ? (
              <AttachmentCard
                att={{
                  fileName: file.name,
                  fileType: fileExt(file.name),
                  fileSize: `${file.sizeKB} KB`,
                }}
                onDelete={onRemove}
              />
            ) : null}
          </div>
        )
      ) : reserveFileSlot ? (
        <div
          className="mt-3 flex flex-col gap-2 overflow-y-auto"
          style={{ minHeight: 52, maxHeight: 120 }}
        >
          {file && <UploadedFileCard file={file} onRemove={onRemove} />}
        </div>
      ) : (
        file && (
          <div
            className="mt-3 flex flex-col gap-2 overflow-y-auto"
            style={{ maxHeight: 120 }}
          >
            <UploadedFileCard file={file} onRemove={onRemove} />
          </div>
        )
      )}
    </div>
  );
}

function UploadedFileCard({
  file,
  onRemove,
}: {
  file: UploadedFile;
  onRemove: () => void;
}) {
  const isCsv = file.name.toLowerCase().endsWith(".csv");
  const Icon = isCsv ? FileText : FileSpreadsheet;
  const iconColor = isCsv ? "#64748B" : "#16A34A";
  const iconBg = isCsv ? "#F1F5F9" : "#DCFCE7";
  return (
    <div className="group flex items-center gap-2.5 px-3 py-2 rounded-md border border-[#E2E8F0] bg-white hover:bg-[#FAFBFC] transition-colors">
      <div
        className="shrink-0 w-8 h-8 rounded-md flex items-center justify-center"
        style={{ backgroundColor: iconBg }}
      >
        <Icon className="w-4 h-4" style={{ color: iconColor }} />
      </div>
      <div className="flex-1 min-w-0">
        <p
          className="text-[#1E293B] truncate"
          style={{ fontSize: "13.5px", fontWeight: 500 }}
          title={file.name}
        >
          {file.name}
        </p>
        <p className="text-[#94A3B8]" style={{ fontSize: "12px" }}>
          {file.sizeKB} KB
        </p>
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onRemove}
            className="w-7 h-7 rounded-md flex items-center justify-center text-[#94A3B8] hover:text-[#EF4444] hover:bg-[#FEF2F2] transition-colors sm:opacity-0 sm:group-hover:opacity-100"
            aria-label="Remove file"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={6} className="z-[200]">
          Remove File
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

function FieldsPopover({ count, fields }: { count: number; fields: string[] }) {
  return (
    <HoverCard openDelay={120} closeDelay={80}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          className="inline cursor-pointer text-[#0A77FF] hover:underline underline-offset-2"
          style={{ fontSize: "12px", fontWeight: 500 }}
        >
          +{count} more
        </button>
      </HoverCardTrigger>
      <HoverCardContent
        side="bottom"
        align="start"
        sideOffset={6}
        className="z-[200] w-[240px] p-0 rounded-lg border border-[#E2E8F0] bg-white shadow-[0_8px_24px_-8px_rgba(15,23,42,0.18),0_2px_6px_-2px_rgba(15,23,42,0.08)]"
      >
        <div
          className="flex items-center justify-between px-3.5 pt-3 pb-2"
          style={{ fontSize: "11px", fontWeight: 600, color: "#94A3B8", letterSpacing: "0.06em" }}
        >
          <span>FIELDS</span>
          <span>{count}</span>
        </div>
        <div
          className="overflow-y-auto px-1.5 pb-1"
          style={{ maxHeight: 224, scrollbarWidth: "thin", scrollbarColor: "#CBD5E1 transparent" }}
        >
          {fields.map((name) => (
            <div
              key={name}
              className="flex items-center gap-2.5 rounded-md px-2 py-1.5 cursor-default transition-colors hover:bg-[#F8FAFC]"
            >
              <div
                className="shrink-0 flex items-center justify-center rounded-md bg-[#EFF6FF]"
                style={{ width: 24, height: 24 }}
              >
                <Type style={{ width: 14, height: 14, color: "#0A77FF" }} aria-hidden />
              </div>
              <span className="text-[#1E293B] truncate" style={{ fontSize: "13px", fontWeight: 500 }} title={name}>
                {name}
              </span>
            </div>
          ))}
        </div>
        <div
          className="px-3.5 py-2 border-t border-[#F1F5F9] italic"
          style={{ fontSize: "11px", color: "#94A3B8" }}
        >
          Scroll for more
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

/** The template's guide for the How This Works panel: the authored sections
 *  when the module has them (Users, Roles), else the shipped TXT, parsed. */
export function useGuideHowSections(template: ImportTemplateConfig = USERS_TEMPLATE_CONFIG): HowThisWorksSection[] {
  const toHow = (secs: ReadingRoomSection[]): HowThisWorksSection[] =>
    secs.map((sec) => ({ title: String(sec.title), body: sec.body, blocks: (sec as { blocks?: HowThisWorksSection["blocks"] }).blocks }));
  const [sections, setSections] = useState<HowThisWorksSection[]>(() => (template.guideSections ? toHow(template.guideSections) : []));
  useEffect(() => {
    if (template.guideSections) {
      setSections(toHow(template.guideSections));
      return;
    }
    let alive = true;
    fetch(asset(`/templates/${template.dir ? `${template.dir}/` : ""}${template.guideFilename}`))
      .then((res) => (res.ok ? res.text() : Promise.reject(new Error(`Guide fetch failed: ${res.status}`))))
      .then((txt) => {
        if (alive) setSections(toHow(parseImportGuide(txt)));
      })
      .catch((err) => console.error("Failed to load import guide", err));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template.guideSections, template.dir, template.guideFilename]);
  return sections;
}
