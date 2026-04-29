import { useState, useMemo, useRef, useCallback } from "react";
import {
  Search,
  ChevronDown,
  Check,
  AlignJustify,
  List as ListIcon,
  LayoutGrid,
  Upload,
  FileText,
  FileSpreadsheet,
  FileImage,
  File as FileIcon,
  MoreVertical,
  Eye,
  Download,
  Trash2,
} from "lucide-react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { toast } from "sonner";
import { format } from "date-fns";

export type AttachmentFile = {
  id: string;
  name: string;
  sizeBytes: number;
  uploadedAt: Date;
  uploadedBy: string;
};

type Density = "condensed" | "comfort" | "card";
type CardSize = "large" | "medium" | "small";

const DENSITY_OPTIONS: {
  key: Density;
  label: string;
  description: string;
  icon: typeof AlignJustify;
}[] = [
  { key: "condensed", label: "Condensed", description: "Compact list view", icon: AlignJustify },
  { key: "comfort", label: "Comfort", description: "Relaxed list view", icon: ListIcon },
  { key: "card", label: "Card", description: "Thumbnail grid", icon: LayoutGrid },
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  const mb = bytes / (1024 * 1024);
  return `${mb >= 10 ? mb.toFixed(0) : mb.toFixed(1)} MB`;
}

function getExtension(name: string): string {
  const idx = name.lastIndexOf(".");
  if (idx === -1 || idx === name.length - 1) return "";
  return name.slice(idx + 1).toLowerCase();
}

type FileTypeStyle = {
  label: string;
  bg: string;
  text: string;
  iconBg: string;
  Icon: typeof FileIcon;
};

function getFileTypeStyle(name: string): FileTypeStyle {
  const ext = getExtension(name);
  switch (ext) {
    case "pdf":
      return { label: "PDF", bg: "#FEE2E2", text: "#DC2626", iconBg: "#FEF2F2", Icon: FileText };
    case "doc":
    case "docx":
      return { label: ext === "docx" ? "DOC" : "DOC", bg: "#DBEAFE", text: "#2563EB", iconBg: "#EFF6FF", Icon: FileText };
    case "xls":
    case "xlsx":
    case "csv":
      return { label: "XLSX", bg: "#D1FAE5", text: "#059669", iconBg: "#ECFDF5", Icon: FileSpreadsheet };
    case "png":
      return { label: "PNG", bg: "#EDE9FE", text: "#7C3AED", iconBg: "#F5F3FF", Icon: FileImage };
    case "jpg":
    case "jpeg":
      return { label: "JPG", bg: "#EDE9FE", text: "#7C3AED", iconBg: "#F5F3FF", Icon: FileImage };
    case "gif":
    case "webp":
    case "svg":
      return { label: ext.toUpperCase(), bg: "#EDE9FE", text: "#7C3AED", iconBg: "#F5F3FF", Icon: FileImage };
    default:
      return { label: ext ? ext.toUpperCase() : "FILE", bg: "#F1F5F9", text: "#475569", iconBg: "#F8FAFC", Icon: FileIcon };
  }
}

const SEED_ATTACHMENTS: AttachmentFile[] = [
  { id: "att-1", name: "NDA_Agreement_2026.pdf", sizeBytes: 1.2 * 1024 * 1024, uploadedAt: new Date("2026-03-10"), uploadedBy: "Sarah Johnson" },
  { id: "att-2", name: "Contact_Onboarding_Form.docx", sizeBytes: 340 * 1024, uploadedAt: new Date("2026-01-15"), uploadedBy: "Admin" },
  { id: "att-3", name: "ID_Verification.png", sizeBytes: 2.8 * 1024 * 1024, uploadedAt: new Date("2025-12-05"), uploadedBy: "Michael Lee" },
  { id: "att-4", name: "Meeting_Notes_Q1.pdf", sizeBytes: 520 * 1024, uploadedAt: new Date("2026-03-28"), uploadedBy: "Sarah Johnson" },
  { id: "att-5", name: "Vendor_Agreement_v2.xlsx", sizeBytes: 890 * 1024, uploadedAt: new Date("2026-02-20"), uploadedBy: "Elena Volkov" },
  { id: "att-6", name: "Partnership_Contract.pdf", sizeBytes: 3.4 * 1024 * 1024, uploadedAt: new Date("2026-01-05"), uploadedBy: "Daniel Adams" },
  { id: "att-7", name: "Company_Logo.jpg", sizeBytes: 1.8 * 1024 * 1024, uploadedAt: new Date("2025-11-20"), uploadedBy: "Alex Morgan" },
  { id: "att-8", name: "Financial_Report_Q4.xlsx", sizeBytes: 2.1 * 1024 * 1024, uploadedAt: new Date("2026-02-10"), uploadedBy: "Lisa Park" },
];

export function AttachmentsTab() {
  const [files, setFiles] = useState<AttachmentFile[]>(SEED_ATTACHMENTS);
  const [search, setSearch] = useState("");
  const [density, setDensity] = useState<Density>("card");
  const [cardSize, setCardSize] = useState<CardSize>("large");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredFiles = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return files;
    return files.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        f.uploadedBy.toLowerCase().includes(q),
    );
  }, [files, search]);

  const totalBytes = useMemo(
    () => filteredFiles.reduce((sum, f) => sum + f.sizeBytes, 0),
    [filteredFiles],
  );

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFilesSelected = useCallback((selected: FileList | null) => {
    if (!selected || selected.length === 0) return;
    const added: AttachmentFile[] = [];
    for (let i = 0; i < selected.length; i++) {
      const f = selected[i];
      added.push({
        id: `att-${Date.now()}-${i}`,
        name: f.name,
        sizeBytes: f.size,
        uploadedAt: new Date(),
        uploadedBy: "You",
      });
    }
    setFiles((prev) => [...added, ...prev]);
    toast.success(`${added.length} file${added.length > 1 ? "s" : ""} uploaded`);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const handlePreview = useCallback((file: AttachmentFile) => {
    toast.info(`Previewing ${file.name}`);
  }, []);

  const handleDownload = useCallback((file: AttachmentFile) => {
    toast.success(`Downloading ${file.name}`);
  }, []);

  const handleDelete = useCallback((file: AttachmentFile) => {
    setFiles((prev) => prev.filter((f) => f.id !== file.id));
    toast.success(`${file.name} deleted`);
  }, []);

  const menuActions = { onPreview: handlePreview, onDownload: handleDownload, onDelete: handleDelete };

  const currentDensity = DENSITY_OPTIONS.find((d) => d.key === density)!;
  const DensityIcon = currentDensity.icon;

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[#E2E8F0]">
        <div className="relative flex-1 max-w-[320px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
          <Input
            type="text"
            placeholder="Search attachments..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 bg-white border-[#E2E8F0] text-[13px]"
          />
        </div>

        <div className="flex-1" />

        <span className="text-[13px] text-[#64748B] tabular-nums whitespace-nowrap">
          <span className="text-[#0F172A]" style={{ fontWeight: 600 }}>{filteredFiles.length} files</span>
          <span className="mx-1.5">·</span>
          <span>{formatBytes(totalBytes)}</span>
        </span>

        {/* Density dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center justify-center h-9 gap-2 px-3 rounded-lg border border-[#E2E8F0] bg-white text-[#0F172A] shadow-sm hover:bg-[#F8FAFC] transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <DensityIcon className="w-[18px] h-[18px] text-[#64748B]" />
              <span className="text-[13px]" style={{ fontWeight: 500 }}>
                {currentDensity.label}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-[#94A3B8]" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[230px] p-1.5">
            {DENSITY_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              return (
                <DropdownMenuItem
                  key={opt.key}
                  className="flex items-center gap-3 py-2.5 px-3 cursor-pointer rounded-md"
                  onSelect={() => setDensity(opt.key)}
                >
                  <Icon className="w-5 h-5 text-[#64748B] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] text-[#0F172A]" style={{ fontWeight: 500 }}>
                      {opt.label}
                    </div>
                    <div className="text-[11px] text-[#64748B]">{opt.description}</div>
                  </div>
                  {density === opt.key && (
                    <Check className="w-4 h-4 shrink-0" style={{ color: "#0A77FF" }} />
                  )}
                </DropdownMenuItem>
              );
            })}
            {density === "card" && (
              <>
                <div className="mx-2 my-1.5 border-t border-[#F1F5F9]" />
                <div className="px-3 py-1.5">
                  <p
                    className="text-[10px] text-[#94A3B8] uppercase tracking-wide mb-2"
                    style={{ fontWeight: 600 }}
                  >
                    Card Size
                  </p>
                  <div className="flex items-center gap-1.5">
                    {(["large", "medium", "small"] as const).map((size) => (
                      <button
                        key={size}
                        onClick={() => setCardSize(size)}
                        className={`flex-1 py-1.5 rounded-md text-[11px] text-center transition-all cursor-pointer ${
                          cardSize === size
                            ? "bg-[#0A77FF] text-white shadow-sm"
                            : "bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0]"
                        }`}
                        style={{ fontWeight: cardSize === size ? 600 : 500 }}
                      >
                        {size === "large" ? "Large" : size === "medium" ? "Medium" : "Small"}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Upload button */}
        <Button
          onClick={handleUploadClick}
          className="h-9 bg-[#0A77FF] hover:bg-[#0866D9] text-white shadow-sm gap-1.5 px-3.5"
        >
          <Upload className="w-4 h-4" />
          <span className="text-[13px]" style={{ fontWeight: 600 }}>
            Upload
          </span>
        </Button>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleFilesSelected(e.target.files)}
        />
      </div>

      {/* Body */}
      {filteredFiles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-center mb-3">
            <FileIcon className="w-5 h-5 text-[#94A3B8]" />
          </div>
          <p className="text-[13px] text-[#334155] mb-0.5" style={{ fontWeight: 600 }}>
            {search ? "No matches found" : "No attachments yet"}
          </p>
          <p className="text-[12px] text-[#94A3B8] max-w-xs leading-relaxed">
            {search
              ? "Try a different search term."
              : "Drop files or click Upload to add documents."}
          </p>
        </div>
      ) : density === "condensed" ? (
        <CondensedView files={filteredFiles} {...menuActions} />
      ) : density === "comfort" ? (
        <ComfortView files={filteredFiles} {...menuActions} />
      ) : (
        <CardView files={filteredFiles} cardSize={cardSize} {...menuActions} />
      )}
    </div>
  );
}

/* ───────────────────────── Context menu ───────────────────────── */

type MenuActions = {
  onPreview: (f: AttachmentFile) => void;
  onDownload: (f: AttachmentFile) => void;
  onDelete: (f: AttachmentFile) => void;
};

function AttachmentMenu({
  file,
  onPreview,
  onDownload,
  onDelete,
  triggerClassName = "",
}: MenuActions & { file: AttachmentFile; triggerClassName?: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="More actions"
          onClick={(e) => e.stopPropagation()}
          className={`inline-flex items-center justify-center w-7 h-7 rounded-md border border-[#E2E8F0] bg-white text-[#64748B] shadow-sm hover:bg-[#F1F5F9] hover:text-[#0F172A] transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring/50 data-[state=open]:bg-[#F1F5F9] data-[state=open]:text-[#0F172A] ${triggerClassName}`}
        >
          <MoreVertical className="w-4 h-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[160px] p-1">
        <DropdownMenuItem
          className="flex items-center gap-2.5 py-2 px-2.5 cursor-pointer rounded-md text-[13px] text-[#0F172A]"
          onSelect={() => onPreview(file)}
        >
          <Eye className="w-4 h-4 text-[#64748B] shrink-0" />
          <span style={{ fontWeight: 500 }}>Preview</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          className="flex items-center gap-2.5 py-2 px-2.5 cursor-pointer rounded-md text-[13px] text-[#0F172A]"
          onSelect={() => onDownload(file)}
        >
          <Download className="w-4 h-4 text-[#64748B] shrink-0" />
          <span style={{ fontWeight: 500 }}>Download</span>
        </DropdownMenuItem>
        <div className="my-1 border-t border-[#F1F5F9]" />
        <DropdownMenuItem
          className="flex items-center gap-2.5 py-2 px-2.5 cursor-pointer rounded-md text-[13px] text-[#DC2626] focus:text-[#DC2626] focus:bg-[#FEF2F2]"
          onSelect={() => onDelete(file)}
        >
          <Trash2 className="w-4 h-4 shrink-0" />
          <span style={{ fontWeight: 500 }}>Delete</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ───────────────────────── Condensed (compact list) ───────────────────────── */

function CondensedView({ files, ...actions }: { files: AttachmentFile[] } & MenuActions) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-[#F8FAFC] hover:bg-[#F8FAFC] border-b border-[#E2E8F0]">
            <TableHead className="text-[12px] text-[#64748B]" style={{ fontWeight: 600 }}>File Name</TableHead>
            <TableHead className="text-[12px] text-[#64748B] w-[110px]" style={{ fontWeight: 600 }}>Size</TableHead>
            <TableHead className="text-[12px] text-[#64748B] w-[140px]" style={{ fontWeight: 600 }}>Date</TableHead>
            <TableHead className="text-[12px] text-[#64748B] w-[180px]" style={{ fontWeight: 600 }}>Uploaded By</TableHead>
            <TableHead className="w-[48px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {files.map((f) => {
            const style = getFileTypeStyle(f.name);
            const Icon = style.Icon;
            return (
              <TableRow key={f.id} className="group hover:bg-[#F8FAFC] cursor-pointer">
                <TableCell className="py-2">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-6 h-6 rounded flex items-center justify-center shrink-0"
                      style={{ backgroundColor: style.iconBg }}
                    >
                      <Icon className="w-3.5 h-3.5" style={{ color: style.text }} />
                    </div>
                    <span className="text-[13px] text-[#0F172A] truncate" style={{ fontWeight: 500 }}>
                      {f.name}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-[13px] text-[#64748B] tabular-nums py-2">{formatBytes(f.sizeBytes)}</TableCell>
                <TableCell className="text-[13px] text-[#64748B] py-2">{format(f.uploadedAt, "MMM dd, yyyy")}</TableCell>
                <TableCell className="text-[13px] text-[#64748B] py-2">{f.uploadedBy}</TableCell>
                <TableCell className="py-2 pr-2 w-[48px]">
                  <AttachmentMenu
                    file={f}
                    {...actions}
                    triggerClassName="opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100"
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

/* ───────────────────────── Comfort (relaxed list) ───────────────────────── */

function ComfortView({ files, ...actions }: { files: AttachmentFile[] } & MenuActions) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-[#F8FAFC] hover:bg-[#F8FAFC] border-b border-[#E2E8F0]">
            <TableHead className="text-[12px] text-[#64748B]" style={{ fontWeight: 600 }}>File Name</TableHead>
            <TableHead className="text-[12px] text-[#64748B] w-[110px]" style={{ fontWeight: 600 }}>Size</TableHead>
            <TableHead className="text-[12px] text-[#64748B] w-[140px]" style={{ fontWeight: 600 }}>Date</TableHead>
            <TableHead className="text-[12px] text-[#64748B] w-[180px]" style={{ fontWeight: 600 }}>Uploaded By</TableHead>
            <TableHead className="w-[48px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {files.map((f) => {
            const style = getFileTypeStyle(f.name);
            const Icon = style.Icon;
            return (
              <TableRow key={f.id} className="group hover:bg-[#F8FAFC] cursor-pointer">
                <TableCell className="py-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: style.iconBg }}
                    >
                      <Icon className="w-[18px] h-[18px]" style={{ color: style.text }} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[13px] text-[#0F172A] truncate" style={{ fontWeight: 500 }}>
                        {f.name}
                      </div>
                      <div className="text-[11px] text-[#94A3B8] tabular-nums mt-0.5">
                        {formatBytes(f.sizeBytes)}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-[13px] text-[#64748B] tabular-nums py-3">{formatBytes(f.sizeBytes)}</TableCell>
                <TableCell className="text-[13px] text-[#64748B] py-3">{format(f.uploadedAt, "MMM dd, yyyy")}</TableCell>
                <TableCell className="text-[13px] text-[#64748B] py-3">{f.uploadedBy}</TableCell>
                <TableCell className="py-3 pr-2 w-[48px]">
                  <AttachmentMenu
                    file={f}
                    {...actions}
                    triggerClassName="opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100"
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

/* ───────────────────────── Card view ───────────────────────── */

function CardView({ files, cardSize, ...actions }: { files: AttachmentFile[]; cardSize: CardSize } & MenuActions) {
  const gridCols =
    cardSize === "large"
      ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
      : cardSize === "medium"
      ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6"
      : "grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8";

  const thumbHeight =
    cardSize === "large" ? "h-[120px]" : cardSize === "medium" ? "h-[90px]" : "h-[72px]";
  const iconSize =
    cardSize === "large" ? "w-9 h-9" : cardSize === "medium" ? "w-7 h-7" : "w-6 h-6";
  const namePadding =
    cardSize === "large" ? "px-3 pt-3 pb-3" : cardSize === "medium" ? "px-2.5 pt-2.5 pb-2.5" : "px-2 pt-2 pb-2";
  const nameSize =
    cardSize === "large" ? "text-[13px]" : cardSize === "medium" ? "text-[12px]" : "text-[11px]";
  const metaSize =
    cardSize === "large" ? "text-[11px]" : cardSize === "medium" ? "text-[10px]" : "text-[10px]";

  return (
    <div className="p-4">
      <div className={`grid gap-4 ${gridCols}`}>
        {files.map((f) => {
          const style = getFileTypeStyle(f.name);
          const Icon = style.Icon;
          return (
            <div
              key={f.id}
              className="group bg-white border border-[#E2E8F0] rounded-xl overflow-hidden cursor-pointer hover:shadow-md hover:border-[#CBD5E1] transition-all"
            >
              <div
                className={`relative flex items-center justify-center ${thumbHeight}`}
                style={{ backgroundColor: style.iconBg }}
              >
                <Icon className={iconSize} style={{ color: style.text, opacity: 0.85 }} />
                <span
                  className="absolute top-2 right-2 text-[9px] tracking-wide"
                  style={{ color: style.text, fontWeight: 700, letterSpacing: "0.05em" }}
                >
                  {style.label}
                </span>
              </div>
              <div className={namePadding}>
                <div className="flex items-start gap-2">
                  <div
                    className={`${nameSize} text-[#0F172A] truncate flex-1 min-w-0`}
                    style={{ fontWeight: 500 }}
                    title={f.name}
                  >
                    {f.name}
                  </div>
                  <AttachmentMenu
                    file={f}
                    {...actions}
                    triggerClassName="-mt-0.5 -mr-1 opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100 shrink-0"
                  />
                </div>
                {cardSize !== "small" && (
                  <div className={`${metaSize} text-[#94A3B8] mt-1.5`}>
                    {format(f.uploadedAt, "MMM dd, yyyy")}
                  </div>
                )}
                <div className={`${metaSize} text-[#94A3B8] tabular-nums ${cardSize === "small" ? "mt-1" : "mt-0.5"} truncate`}>
                  {formatBytes(f.sizeBytes)}
                  {cardSize !== "small" && (
                    <>
                      <span className="mx-1">·</span>
                      {f.uploadedBy}
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
