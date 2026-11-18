import { useState, useMemo, useRef } from "react";
import { Input } from "../ui/input";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator,
} from "../ui/dropdown-menu";
import {
  Search, X, Upload, LayoutGrid, List, AlignJustify, MoreVertical,
  ChevronDown, Check, FileText, FileSpreadsheet, Image as ImageIcon, Paperclip,
  Eye, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { highlightMatch } from "../../lib/highlight-text";
import { useAccessMode } from "../access-mode";
import { sampleOnly } from "../../data/tenant";

/* ─── Sample data ─── */
type AttachmentItem = { id: number; name: string; size: string; date: string; type: string; uploadedBy: string };

const USER_ATTACHMENTS: AttachmentItem[] = [
  { id: 1, name: "Employment_Offer_Letter.pdf", size: "1.2 MB", date: "2026-01-10T09:00:00Z", type: "pdf", uploadedBy: "HR Admin" },
  { id: 2, name: "Signed_NDA_Agreement.pdf", size: "480 KB", date: "2026-01-12T11:30:00Z", type: "pdf", uploadedBy: "Sarah Johnson" },
  { id: 3, name: "Government_ID_Scan.png", size: "2.8 MB", date: "2025-12-05T10:45:00Z", type: "img", uploadedBy: "Ahtisham Ahmad" },
  { id: 4, name: "Onboarding_Checklist.docx", size: "210 KB", date: "2026-01-15T14:20:00Z", type: "doc", uploadedBy: "HR Admin" },
  { id: 5, name: "Direct_Deposit_Form.pdf", size: "340 KB", date: "2026-01-18T09:15:00Z", type: "pdf", uploadedBy: "Ahtisham Ahmad" },
  { id: 6, name: "Passport_Copy.jpg", size: "1.9 MB", date: "2025-11-20T15:00:00Z", type: "img", uploadedBy: "Ahtisham Ahmad" },
  { id: 7, name: "Benefits_Enrollment.xlsx", size: "890 KB", date: "2026-02-20T11:30:00Z", type: "xlsx", uploadedBy: "Lisa Park" },
  { id: 8, name: "Performance_Review_Q4.pdf", size: "520 KB", date: "2026-03-28T16:00:00Z", type: "pdf", uploadedBy: "Andrea Davis" },
];

const ROLE_ATTACHMENTS: AttachmentItem[] = [
  { id: 1, name: "Role_Policy_Document.pdf", size: "1.5 MB", date: "2026-02-01T09:00:00Z", type: "pdf", uploadedBy: "Taylor Dimas" },
  { id: 2, name: "Access_Matrix_Breakdown.xlsx", size: "640 KB", date: "2026-01-20T14:00:00Z", type: "xlsx", uploadedBy: "Andrea Davis" },
  { id: 3, name: "Compliance_Approval_Email.pdf", size: "280 KB", date: "2026-02-15T10:30:00Z", type: "pdf", uploadedBy: "Daniel Adams" },
  { id: 4, name: "Permission_Change_Log.docx", size: "190 KB", date: "2026-03-05T16:45:00Z", type: "doc", uploadedBy: "Taylor Dimas" },
  { id: 5, name: "Role_Audit_Report_Q1.pdf", size: "2.3 MB", date: "2026-03-30T11:00:00Z", type: "pdf", uploadedBy: "Elena Volkov" },
  { id: 6, name: "SoD_Conflict_Review.xlsx", size: "410 KB", date: "2026-01-28T13:20:00Z", type: "xlsx", uploadedBy: "Andrea Davis" },
  { id: 7, name: "Role_Org_Chart.png", size: "3.1 MB", date: "2025-12-10T09:30:00Z", type: "img", uploadedBy: "Alex Morgan" },
  { id: 8, name: "Training_Requirements.pdf", size: "720 KB", date: "2026-02-22T08:15:00Z", type: "pdf", uploadedBy: "Sarah Johnson" },
];

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
  } catch {
    return dateStr;
  }
}

function getFileTypeInfo(type: string, name: string) {
  const ext = name.split(".").pop()?.toUpperCase() || "";
  switch (type) {
    case "pdf": return { color: "#EF4444", bg: "#FEF2F2", label: "PDF", Icon: FileText };
    case "doc": return { color: "#2563EB", bg: "#EFF6FF", label: "DOC", Icon: FileText };
    case "img": return { color: "#8B5CF6", bg: "#F5F3FF", label: ext, Icon: ImageIcon };
    case "xlsx": return { color: "#10B981", bg: "#ECFDF5", label: "XLSX", Icon: FileSpreadsheet };
    default: return { color: "#64748B", bg: "#F8FAFC", label: ext, Icon: FileText };
  }
}

const ATTACH_DENSITY_CONFIG = [
  { key: "condensed" as const, label: "Condensed", description: "Compact list view", icon: "align-justify" },
  { key: "comfort" as const, label: "Comfort", description: "Relaxed list view", icon: "list" },
  { key: "card" as const, label: "Card", description: "Thumbnail grid", icon: "layout-grid" },
];

function FileActionMenu({ fileName, triggerClassName, archived = false }: { fileName: string; triggerClassName?: string; archived?: boolean }) {
  const access = useAccessMode();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className={triggerClassName ?? "p-1 rounded hover:bg-[#F1F5F9] text-[#CBD5E1] hover:text-[#0F172A] transition-colors cursor-pointer"}>
          <MoreVertical className="w-3.5 h-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[160px]">
        <DropdownMenuItem className="flex items-center gap-2 cursor-pointer" onSelect={() => toast.info(`Viewing details for ${fileName}`)}>
          <Eye className="w-4 h-4 text-[#64748B]" />
          <span className="text-sm">View Details</span>
        </DropdownMenuItem>
        {/* Delete is hidden for archived users, history stays viewable, read-only.
            The access persona is ANDed on: a read-only persona keeps View
            Details but never Delete. */}
        {!archived && access.canManageNotes && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="flex items-center gap-2 cursor-pointer text-[#EF4444] focus:text-[#EF4444]" onSelect={() => toast.info(`Delete ${fileName}`)}>
              <Trash2 className="w-4 h-4" />
              <span className="text-sm">Delete</span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AttachmentsTab({ context = "user", archived = false }: { context?: "user" | "role"; archived?: boolean }) {
  const access = useAccessMode();
  const [search, setSearch] = useState("");
  const [density, setDensity] = useState<"condensed" | "comfort" | "card">("card");
  const [cardSize, setCardSize] = useState<"small" | "medium" | "large">("medium");
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* Sample files; a company from onboarding has uploaded none yet, so the
     tab shows its own empty state there. */
  const sourceData = useMemo(
    () => sampleOnly(context === "role" ? ROLE_ATTACHMENTS : USER_ATTACHMENTS),
    [context],
  );
  const filtered = useMemo(() => {
    if (!search) return sourceData;
    return sourceData.filter(f => f.name.toLowerCase().includes(search.toLowerCase()));
  }, [search, sourceData]);

  const isCondensed = density === "condensed";
  const isComfort = density === "comfort";
  const isCard = density === "card";

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden flex flex-col flex-1 min-h-[calc(100vh-260px)]">
      {/* Toolbar */}
      <div className="px-4 py-3 flex items-center gap-3 border-b border-[#F1F5F9] shrink-0">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8] pointer-events-none" />
          <Input
            placeholder="Search attachments..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-8 h-9 text-sm bg-white border-[#E2E8F0] shadow-sm placeholder:text-[#94A3B8]"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-[#F1F5F9] text-[#94A3B8] hover:text-[#0F172A] transition-colors cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <span className="text-sm tabular-nums ml-auto" style={{ fontWeight: 500 }}>
          <span className="text-[#0F172A]">{filtered.length}</span>
          {/* The size is the sample files' total, so it goes with them. */}
          <span className="text-[#94A3B8]">{sourceData.length > 0 ? " files · 13.1 MB" : " files"}</span>
        </span>

        {/* Density dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="inline-flex items-center justify-center h-9 gap-2 px-3 rounded-lg border border-[#E2E8F0] bg-white text-[#0F172A] shadow-sm hover:bg-[#F8FAFC] transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#007FFF]/20">
              {isCondensed && <AlignJustify className="w-[18px] h-[18px] text-[#94A3B8]" />}
              {isComfort && <List className="w-[18px] h-[18px] text-[#94A3B8]" />}
              {isCard && <LayoutGrid className="w-[18px] h-[18px] text-[#94A3B8]" />}
              <span className="text-sm hidden md:inline" style={{ fontWeight: 500 }}>
                {ATTACH_DENSITY_CONFIG.find(d => d.key === density)?.label}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-[#94A3B8]" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[230px] p-1.5">
            {ATTACH_DENSITY_CONFIG.map((opt) => (
              <DropdownMenuItem key={opt.key} className="flex items-center gap-3 py-2.5 px-3 cursor-pointer rounded-md" onSelect={(e) => { if (opt.key === "card") e.preventDefault(); setDensity(opt.key); }}>
                {opt.icon === "align-justify" && <AlignJustify className="w-5 h-5 text-[#94A3B8] shrink-0" />}
                {opt.icon === "list" && <List className="w-5 h-5 text-[#94A3B8] shrink-0" />}
                {opt.icon === "layout-grid" && <LayoutGrid className="w-5 h-5 text-[#94A3B8] shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="text-sm" style={{ fontWeight: 500 }}>{opt.label}</div>
                  <div className="text-xs text-[#94A3B8]">{opt.description}</div>
                </div>
                {density === opt.key && <Check className="w-4 h-4 shrink-0" style={{ color: "#007FFF" }} />}
              </DropdownMenuItem>
            ))}
            {isCard && (
              <>
                <div className="mx-2 my-1.5 border-t border-[#F1F5F9]" />
                <div className="px-3 py-1.5">
                  <p className="text-[10px] text-[#94A3B8] uppercase tracking-wide mb-2" style={{ fontWeight: 600 }}>Card Size</p>
                  <div className="flex items-center gap-1.5">
                    {(["large", "medium", "small"] as const).map((size) => (
                      <button key={size} onClick={() => setCardSize(size)} className={`flex-1 py-1.5 rounded-md text-[11px] text-center transition-all cursor-pointer ${cardSize === size ? "bg-[#007FFF] text-white shadow-sm" : "bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0]"}`} style={{ fontWeight: cardSize === size ? 600 : 500 }}>
                        {size === "large" ? "Large" : size === "medium" ? "Medium" : "Small"}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Upload CTA, hidden for archived users (read-only history) and for
            personas that can't author notes or attachments. */}
        {!archived && access.canManageNotes && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = e.target.files;
                if (files && files.length > 0) {
                  toast.success(`${files.length} file${files.length > 1 ? "s" : ""} selected`);
                }
                e.target.value = "";
              }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center justify-center h-9 gap-1.5 px-3.5 rounded-lg bg-[#007FFF] text-white shadow-sm hover:bg-[#0066D6] transition-colors cursor-pointer text-sm"
              style={{ fontWeight: 500 }}
            >
              <Upload className="w-4 h-4" />
              Upload
            </button>
          </>
        )}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Card View */}
        {isCard && (
          <div className={`grid gap-4 ${
            cardSize === "large" ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" :
            cardSize === "small" ? "grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6" :
            "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
          }`}>
            {filtered.map((file) => {
              const info = getFileTypeInfo(file.type, file.name);
              const previewH = cardSize === "large" ? "h-[160px]" : cardSize === "small" ? "h-[100px]" : "h-[130px]";
              const iconSz = cardSize === "large" ? "w-12 h-12" : cardSize === "small" ? "w-8 h-8" : "w-10 h-10";
              return (
                <div key={file.id} className="group rounded-xl border border-[#E2E8F0] overflow-hidden hover:shadow-md hover:border-[#CBD5E1] transition-all">
                  <div className={`relative ${previewH} flex items-center justify-center`} style={{ backgroundColor: info.bg }}>
                    <info.Icon className={iconSz} style={{ color: info.color, opacity: 0.35 }} />
                    <span className="absolute top-2.5 right-2.5 px-1.5 py-0.5 rounded text-[9px] tracking-wide" style={{ fontWeight: 700, color: info.color, backgroundColor: `${info.color}15`, border: `1px solid ${info.color}25` }}>
                      {info.label}
                    </span>
                  </div>
                  <div className={cardSize === "large" ? "px-4 pt-3 pb-3.5" : cardSize === "small" ? "px-2.5 pt-2 pb-2.5" : "px-3 pt-2.5 pb-3"}>
                    <div className="flex items-start justify-between gap-1 mb-1">
                      <span className={`${cardSize === "small" ? "text-[11px]" : "text-[12px]"} text-[#0F172A] truncate leading-tight`} style={{ fontWeight: 500 }}>{highlightMatch(file.name, search)}</span>
                      <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <FileActionMenu fileName={file.name} archived={archived} triggerClassName="p-0.5 rounded hover:bg-[#F1F5F9] text-[#CBD5E1] hover:text-[#0F172A] transition-colors cursor-pointer" />
                      </div>
                    </div>
                    <p className={`${cardSize === "small" ? "text-[10px]" : "text-[11px]"} text-[#94A3B8] leading-tight`}>{formatDate(file.date)}</p>
                    <p className={`${cardSize === "small" ? "text-[10px]" : "text-[11px]"} text-[#94A3B8] leading-tight`}>{file.size} · {file.uploadedBy}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Condensed List View */}
        {isCondensed && (
          <div className="border border-[#E2E8F0] rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-[#F1F5F9]">
                  <th className="text-left text-[11px] text-[#94A3B8] px-4 py-2" style={{ fontWeight: 600 }}>File Name</th>
                  <th className="text-left text-[11px] text-[#94A3B8] px-4 py-2 w-[80px]" style={{ fontWeight: 600 }}>Size</th>
                  <th className="text-left text-[11px] text-[#94A3B8] px-4 py-2 hidden md:table-cell" style={{ fontWeight: 600 }}>Date</th>
                  <th className="text-left text-[11px] text-[#94A3B8] px-4 py-2 hidden md:table-cell" style={{ fontWeight: 600 }}>Uploaded By</th>
                  <th className="w-[36px]" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((file) => {
                  const info = getFileTypeInfo(file.type, file.name);
                  return (
                    <tr key={file.id} className="border-b border-[#F1F5F9] last:border-b-0 hover:bg-[#F8FAFC] transition-colors group">
                      <td className="px-4 py-1.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: info.bg }}>
                            <info.Icon className="w-3.5 h-3.5" style={{ color: info.color }} />
                          </div>
                          <span className="text-[12px] text-[#334155] truncate" style={{ fontWeight: 500 }}>{highlightMatch(file.name, search)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-1.5"><span className="text-[11.5px] text-[#64748B]">{file.size}</span></td>
                      <td className="px-4 py-1.5 hidden md:table-cell"><span className="text-[11.5px] text-[#64748B]">{formatDate(file.date)}</span></td>
                      <td className="px-4 py-1.5 hidden md:table-cell"><span className="text-[11.5px] text-[#64748B]">{file.uploadedBy}</span></td>
                      <td className="px-2 py-1.5">
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <FileActionMenu fileName={file.name} archived={archived} triggerClassName="p-1 rounded hover:bg-[#F1F5F9] text-[#CBD5E1] hover:text-[#0F172A] transition-colors cursor-pointer" />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Comfort List View */}
        {isComfort && (
          <div className="border border-[#E2E8F0] rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-[#F1F5F9]">
                  <th className="text-left text-[11px] text-[#94A3B8] px-4 py-2.5" style={{ fontWeight: 600 }}>File Name</th>
                  <th className="text-left text-[11px] text-[#94A3B8] px-4 py-2.5 w-[80px]" style={{ fontWeight: 600 }}>Size</th>
                  <th className="text-left text-[11px] text-[#94A3B8] px-4 py-2.5 hidden md:table-cell" style={{ fontWeight: 600 }}>Date</th>
                  <th className="text-left text-[11px] text-[#94A3B8] px-4 py-2.5 hidden md:table-cell" style={{ fontWeight: 600 }}>Uploaded By</th>
                  <th className="w-[40px]" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((file) => {
                  const info = getFileTypeInfo(file.type, file.name);
                  return (
                    <tr key={file.id} className="border-b border-[#F1F5F9] last:border-b-0 hover:bg-[#F8FAFC] transition-colors group">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: info.bg }}>
                            <info.Icon className="w-[18px] h-[18px]" style={{ color: info.color }} />
                          </div>
                          <div className="min-w-0">
                            <span className="text-[12.5px] text-[#334155] truncate block" style={{ fontWeight: 500 }}>{highlightMatch(file.name, search)}</span>
                            <span className="text-[11px] text-[#94A3B8]">{file.size}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3"><span className="text-[12px] text-[#64748B]">{file.size}</span></td>
                      <td className="px-4 py-3 hidden md:table-cell"><span className="text-[12px] text-[#64748B]">{formatDate(file.date)}</span></td>
                      <td className="px-4 py-3 hidden md:table-cell"><span className="text-[12px] text-[#64748B]">{file.uploadedBy}</span></td>
                      <td className="px-2 py-3">
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <FileActionMenu fileName={file.name} archived={archived} triggerClassName="p-1 rounded hover:bg-[#F1F5F9] text-[#CBD5E1] hover:text-[#0F172A] transition-colors cursor-pointer" />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {filtered.length === 0 && (
          <div className="text-center py-12">
            <Paperclip className="w-8 h-8 text-[#CBD5E1] mx-auto mb-3" />
            <p className="text-sm text-[#94A3B8]" style={{ fontWeight: 500 }}>No Attachments Found</p>
          </div>
        )}
      </div>
    </div>
  );
}
