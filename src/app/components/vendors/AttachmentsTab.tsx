import React, { useState, useMemo } from "react";
import { Input } from "../ui/input";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "../ui/dropdown-menu";
import {
  Search, X, Upload, LayoutGrid, List, AlignJustify, MoreVertical,
  ChevronDown, Check, FileText, FileSpreadsheet, Image as ImageIcon, Paperclip,
} from "lucide-react";
import { toast } from "sonner";

/* ─── Sample data ─── */
const ATTACHMENTS_DATA = [
  { id: 1, name: "NDA_Agreement_2026.pdf", size: "1.2 MB", date: "2026-03-10T09:00:00Z", type: "pdf", uploadedBy: "Sarah Johnson" },
  { id: 2, name: "Contact_Onboarding_Form.docx", size: "340 KB", date: "2026-01-15T14:20:00Z", type: "doc", uploadedBy: "Admin" },
  { id: 3, name: "ID_Verification.png", size: "2.8 MB", date: "2025-12-05T10:45:00Z", type: "img", uploadedBy: "Michael Lee" },
  { id: 4, name: "Meeting_Notes_Q1.pdf", size: "520 KB", date: "2026-03-28T16:00:00Z", type: "pdf", uploadedBy: "Sarah Johnson" },
  { id: 5, name: "Vendor_Agreement_v2.xlsx", size: "890 KB", date: "2026-02-20T11:30:00Z", type: "xlsx", uploadedBy: "Elena Volkov" },
  { id: 6, name: "Partnership_Contract.pdf", size: "3.4 MB", date: "2026-01-05T08:30:00Z", type: "pdf", uploadedBy: "Daniel Adams" },
  { id: 7, name: "Company_Logo.jpg", size: "1.8 MB", date: "2025-11-20T15:00:00Z", type: "img", uploadedBy: "Alex Morgan" },
  { id: 8, name: "Financial_Report_Q4.xlsx", size: "2.1 MB", date: "2026-02-10T09:45:00Z", type: "xlsx", uploadedBy: "Lisa Park" },
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
    case "pdf": return { color: "hsl(var(--destructive))", bg: "#FEF2F2", label: "PDF", Icon: FileText };
    case "doc": return { color: "#2563EB", bg: "#EFF6FF", label: "DOC", Icon: FileText };
    case "img": return { color: "hsl(var(--violet))", bg: "#F5F3FF", label: ext, Icon: ImageIcon };
    case "xlsx": return { color: "hsl(var(--success))", bg: "#ECFDF5", label: "XLSX", Icon: FileSpreadsheet };
    default: return { color: "#64748B", bg: "#F8FAFC", label: ext, Icon: FileText };
  }
}

const ATTACH_DENSITY_CONFIG = [
  { key: "condensed" as const, label: "Condensed", description: "Compact list view", icon: "align-justify" },
  { key: "comfort" as const, label: "Comfort", description: "Relaxed list view", icon: "list" },
  { key: "card" as const, label: "Card", description: "Thumbnail grid", icon: "layout-grid" },
];

export function AttachmentsTab() {
  const [search, setSearch] = useState("");
  const [density, setDensity] = useState<"condensed" | "comfort" | "card">("card");
  const [cardSize, setCardSize] = useState<"small" | "medium" | "large">("medium");

  const filtered = useMemo(() => {
    if (!search) return ATTACHMENTS_DATA;
    return ATTACHMENTS_DATA.filter(f => f.name.toLowerCase().includes(search.toLowerCase()));
  }, [search]);

  const isCondensed = density === "condensed";
  const isComfort = density === "comfort";
  const isCard = density === "card";

  return (
    <div className="bg-white border border-border rounded-xl overflow-hidden flex flex-col flex-1 min-h-[calc(100vh-260px)]">
      {/* Toolbar */}
      <div className="px-4 py-3 flex items-center gap-3 border-b border-muted shrink-0">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50 pointer-events-none" />
          <Input
            placeholder="Search attachments..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-8 h-9 text-sm bg-white border-border/80 shadow-sm placeholder:text-muted-foreground/50"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <span className="text-sm tabular-nums ml-auto" style={{ fontWeight: 500 }}>
          <span className="text-foreground">{filtered.length}</span>
          <span className="text-muted-foreground/70"> files · 13.1 MB</span>
        </span>

        {/* Density dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="inline-flex items-center justify-center h-9 gap-2 px-3 rounded-lg border border-border bg-white text-foreground shadow-sm hover:bg-muted/40 transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
              {isCondensed && <AlignJustify className="w-[18px] h-[18px] text-muted-foreground/80" />}
              {isComfort && <List className="w-[18px] h-[18px] text-muted-foreground/80" />}
              {isCard && <LayoutGrid className="w-[18px] h-[18px] text-muted-foreground/80" />}
              <span className="text-sm hidden md:inline" style={{ fontWeight: 500 }}>
                {ATTACH_DENSITY_CONFIG.find(d => d.key === density)?.label}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/60" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[230px] p-1.5">
            {ATTACH_DENSITY_CONFIG.map((opt) => (
              <DropdownMenuItem key={opt.key} className="flex items-center gap-3 py-2.5 px-3 cursor-pointer rounded-md" onSelect={(e) => { if (opt.key === "card") e.preventDefault(); setDensity(opt.key); }}>
                {opt.icon === "align-justify" && <AlignJustify className="w-5 h-5 text-muted-foreground shrink-0" />}
                {opt.icon === "list" && <List className="w-5 h-5 text-muted-foreground shrink-0" />}
                {opt.icon === "layout-grid" && <LayoutGrid className="w-5 h-5 text-muted-foreground shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="text-sm" style={{ fontWeight: 500 }}>{opt.label}</div>
                  <div className="text-xs text-muted-foreground">{opt.description}</div>
                </div>
                {density === opt.key && <Check className="w-4 h-4 shrink-0" style={{ color: "hsl(var(--primary))" }} />}
              </DropdownMenuItem>
            ))}
            {isCard && (
              <>
                <div className="mx-2 my-1.5 border-t border-muted" />
                <div className="px-3 py-1.5">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-2" style={{ fontWeight: 600 }}>Card Size</p>
                  <div className="flex items-center gap-1.5">
                    {(["large", "medium", "small"] as const).map((size) => (
                      <button key={size} onClick={() => setCardSize(size)} className={`flex-1 py-1.5 rounded-md text-[11px] text-center transition-all cursor-pointer ${cardSize === size ? "bg-primary text-white shadow-sm" : "bg-muted text-slate-500 hover:bg-border"}`} style={{ fontWeight: cardSize === size ? 600 : 500 }}>
                        {size === "large" ? "Large" : size === "medium" ? "Medium" : "Small"}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Upload CTA */}
        <button
          onClick={() => toast.info("Upload coming soon")}
          className="inline-flex items-center justify-center h-9 gap-1.5 px-3.5 rounded-lg bg-primary text-white shadow-sm hover:bg-primary/90 transition-colors cursor-pointer text-sm"
          style={{ fontWeight: 500 }}
        >
          <Upload className="w-4 h-4" />
          Upload
        </button>
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
                <div key={file.id} className={`group rounded-xl border border-border overflow-hidden hover:shadow-md hover:border-slate-300 transition-all`}>
                  <div className={`relative ${previewH} flex items-center justify-center`} style={{ backgroundColor: info.bg }}>
                    <info.Icon className={iconSz} style={{ color: info.color, opacity: 0.35 }} />
                    <span className="absolute top-2.5 right-2.5 px-1.5 py-0.5 rounded text-[9px] tracking-wide" style={{ fontWeight: 700, color: info.color, backgroundColor: `${info.color}15`, border: `1px solid ${info.color}25` }}>
                      {info.label}
                    </span>
                  </div>
                  <div className={cardSize === "large" ? "px-4 pt-3 pb-3.5" : cardSize === "small" ? "px-2.5 pt-2 pb-2.5" : "px-3 pt-2.5 pb-3"}>
                    <div className="flex items-start justify-between gap-1 mb-1">
                      <span className={`${cardSize === "small" ? "text-[11px]" : "text-[12px]"} text-foreground truncate leading-tight`} style={{ fontWeight: 500 }}>{file.name}</span>
                      <button className="shrink-0 p-0.5 rounded hover:bg-muted/60 text-muted-foreground/50 hover:text-foreground transition-colors cursor-pointer opacity-0 group-hover:opacity-100">
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className={`${cardSize === "small" ? "text-[10px]" : "text-[11px]"} text-slate-400 leading-tight`}>{formatDate(file.date)}</p>
                    <p className={`${cardSize === "small" ? "text-[10px]" : "text-[11px]"} text-slate-400 leading-tight`}>{file.size} · {file.uploadedBy}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Condensed List View */}
        {isCondensed && (
          <div className="border border-border rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-muted">
                  <th className="text-left text-[11px] text-slate-400 px-4 py-2" style={{ fontWeight: 600 }}>File Name</th>
                  <th className="text-left text-[11px] text-slate-400 px-4 py-2 w-[80px]" style={{ fontWeight: 600 }}>Size</th>
                  <th className="text-left text-[11px] text-slate-400 px-4 py-2 hidden md:table-cell" style={{ fontWeight: 600 }}>Date</th>
                  <th className="text-left text-[11px] text-slate-400 px-4 py-2 hidden md:table-cell" style={{ fontWeight: 600 }}>Uploaded By</th>
                  <th className="w-[36px]" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((file) => {
                  const info = getFileTypeInfo(file.type, file.name);
                  return (
                    <tr key={file.id} className="border-b border-muted last:border-b-0 hover:bg-slate-50 transition-colors group">
                      <td className="px-4 py-1.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: info.bg }}>
                            <info.Icon className="w-3.5 h-3.5" style={{ color: info.color }} />
                          </div>
                          <span className="text-[12px] text-slate-700 truncate" style={{ fontWeight: 500 }}>{file.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-1.5"><span className="text-[11.5px] text-slate-500">{file.size}</span></td>
                      <td className="px-4 py-1.5 hidden md:table-cell"><span className="text-[11.5px] text-slate-500">{formatDate(file.date)}</span></td>
                      <td className="px-4 py-1.5 hidden md:table-cell"><span className="text-[11.5px] text-slate-500">{file.uploadedBy}</span></td>
                      <td className="px-2 py-1.5">
                        <button className="p-1 rounded hover:bg-muted/60 text-muted-foreground/40 hover:text-foreground transition-colors cursor-pointer opacity-0 group-hover:opacity-100">
                          <MoreVertical className="w-3.5 h-3.5" />
                        </button>
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
          <div className="border border-border rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-muted">
                  <th className="text-left text-[11px] text-slate-400 px-4 py-2.5" style={{ fontWeight: 600 }}>File Name</th>
                  <th className="text-left text-[11px] text-slate-400 px-4 py-2.5 w-[80px]" style={{ fontWeight: 600 }}>Size</th>
                  <th className="text-left text-[11px] text-slate-400 px-4 py-2.5 hidden md:table-cell" style={{ fontWeight: 600 }}>Date</th>
                  <th className="text-left text-[11px] text-slate-400 px-4 py-2.5 hidden md:table-cell" style={{ fontWeight: 600 }}>Uploaded By</th>
                  <th className="w-[40px]" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((file) => {
                  const info = getFileTypeInfo(file.type, file.name);
                  return (
                    <tr key={file.id} className="border-b border-muted last:border-b-0 hover:bg-slate-50 transition-colors group">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: info.bg }}>
                            <info.Icon className="w-4.5 h-4.5" style={{ color: info.color }} />
                          </div>
                          <div className="min-w-0">
                            <span className="text-[12.5px] text-slate-700 truncate block" style={{ fontWeight: 500 }}>{file.name}</span>
                            <span className="text-[11px] text-slate-400">{file.size}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3"><span className="text-[12px] text-slate-500">{file.size}</span></td>
                      <td className="px-4 py-3 hidden md:table-cell"><span className="text-[12px] text-slate-500">{formatDate(file.date)}</span></td>
                      <td className="px-4 py-3 hidden md:table-cell"><span className="text-[12px] text-slate-500">{file.uploadedBy}</span></td>
                      <td className="px-2 py-3">
                        <button className="p-1 rounded hover:bg-muted/60 text-muted-foreground/40 hover:text-foreground transition-colors cursor-pointer opacity-0 group-hover:opacity-100">
                          <MoreVertical className="w-4 h-4" />
                        </button>
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
            <Paperclip className="w-8 h-8 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground/60" style={{ fontWeight: 500 }}>No attachments found</p>
          </div>
        )}
      </div>
    </div>
  );
}
