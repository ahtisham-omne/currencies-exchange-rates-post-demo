import React, { useState } from "react";
import { Search, X, Plus, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Users, AlignJustify, List as ListIcon, LayoutGrid, ChevronDown, Check, SlidersHorizontal, Phone, Mail, PhoneCall } from "lucide-react";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";
import type { ContactPerson } from "./partnerConstants";

// ── Highlight ──
function Hl({ text, q }: { text: string; q: string }) {
  if (!q.trim()) return <>{text}</>;
  const parts = text.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
  return <>{parts.map((p, i) => p.toLowerCase() === q.toLowerCase() ? <mark key={i} className="bg-transparent px-0.5 rounded-sm" style={{ backgroundColor: "#FEFCE8", color: "#854D0E", fontWeight: 500 }}>{p}</mark> : <React.Fragment key={i}>{p}</React.Fragment>)}</>;
}

// ── Avatar ──
const TINTS: Record<string, { bg: string; text: string }> = {
  "#0A77FF": { bg: "#EBF3FF", text: "#0A77FF" }, "#7C3AED": { bg: "#F0EBFF", text: "#7C3AED" },
  "#059669": { bg: "#E8FAF3", text: "#059669" }, "#D97706": { bg: "#FEF5E7", text: "#B45D04" },
};
function tint(c: string) { return TINTS[c] || { bg: "#F0F4FF", text: c || "#64748B" }; }
function ini(n: string) { return n.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2); }
const DEPT_COLORS: Record<string, { bg: string; text: string }> = {
  Sales: { bg: "#EFF6FF", text: "#1D4ED8" },
  "Supply Chain Management": { bg: "#F0FDF4", text: "#15803D" },
  Finance: { bg: "#FFFBEB", text: "#92400E" },
};

// ── Filter Dropdown ──
function FilterDrop({ label, selected, options, onToggle, onClear, searchable }: {
  label: string; selected: Set<string>; options: string[]; onToggle: (v: string) => void; onClear: () => void; searchable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const count = selected.size;
  const filtered = searchable && q ? options.filter((o) => o.toLowerCase().includes(q.toLowerCase())) : options;
  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQ(""); }}>
      <PopoverTrigger asChild>
        <button type="button" className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border text-xs transition-colors cursor-pointer ${count > 0 ? "border-primary/30 bg-[#EDF4FF] text-[#0A77FF]" : "border-border bg-white text-foreground hover:bg-muted/50"}`} style={{ fontWeight: count > 0 ? 600 : 500 }}>
          <SlidersHorizontal className={`w-3 h-3 ${count > 0 ? "text-[#0A77FF]" : "text-muted-foreground"}`} />
          {label}{count > 0 && <span className="text-[10px] min-w-[18px] h-[18px] rounded-full bg-[#0A77FF] text-white flex items-center justify-center px-1" style={{ fontWeight: 600 }}>{count}</span>}
          <ChevronDown className="w-3 h-3 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="bottom" align="start" sideOffset={4} className="w-[220px] p-0 z-[350] rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-[#E2E8F0]/80" onOpenAutoFocus={(e) => e.preventDefault()}>
        {searchable && (
          <div className="p-2 border-b border-[#F1F5F9]">
            <div className="relative"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#94A3B8]" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search...`} className="w-full h-8 pl-8 pr-3 rounded-md border border-[#E2E8F0] bg-[#F8FAFC] text-[12px] focus:outline-none focus:border-[#0A77FF]" autoFocus />
            </div>
          </div>
        )}
        <div className="max-h-[240px] overflow-y-auto py-1">
          {filtered.map((opt) => {
            const isSel = selected.has(opt);
            return (<button key={opt} type="button" onClick={() => onToggle(opt)} className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-[12px] transition-colors ${isSel ? "bg-[#EDF4FF]/50" : "hover:bg-[#F8FAFC]"}`}>
              <div className="w-4 h-4 rounded border-[1.5px] flex items-center justify-center shrink-0" style={{ borderColor: isSel ? "#0A77FF" : "#CBD5E1", backgroundColor: isSel ? "#0A77FF" : "transparent" }}>{isSel && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}</div>
              <span className={isSel ? "text-[#0A77FF] font-semibold" : "text-[#334155]"}>{opt === "Supply Chain Management" ? "Supply Chain" : opt}</span>
            </button>);
          })}
        </div>
        {count > 0 && <div className="px-2 py-1.5 border-t border-[#F1F5F9]"><button type="button" onClick={() => { onClear(); setOpen(false); }} className="text-[11px] text-[#94A3B8] hover:text-[#EF4444] cursor-pointer" style={{ fontWeight: 500 }}>Clear</button></div>}
      </PopoverContent>
    </Popover>
  );
}

type Density = "condensed" | "comfort" | "card";

export interface PocDataTableProps {
  contacts: ContactPerson[];
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onSelectAll?: (ids: string[]) => void;
  searchQuery: string;
  onSearchChange: (val: string) => void;
  categoryFilter: string;
  onCategoryFilterChange: (val: string) => void;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalCount: number;
  perPage?: number;
  onPerPageChange?: (n: number) => void;
  onCreateNew?: () => void;
  selectable?: boolean;
}

export function PocDataTable({
  contacts, selectedIds, onToggleSelect, onSelectAll,
  searchQuery, onSearchChange, categoryFilter, onCategoryFilterChange,
  page, totalPages, onPageChange, totalCount, perPage = 20, onPerPageChange,
  onCreateNew, selectable = true,
}: PocDataTableProps) {
  const [density, setDensity] = useState<Density>("condensed");
  const [deptFilter, setDeptFilter] = useState<Set<string>>(new Set());
  const isComfort = density === "comfort";
  const isCard = density === "card";
  const toggleSet = (s: Set<string>, v: string) => { const n = new Set(s); n.has(v) ? n.delete(v) : n.add(v); return n; };

  const allIds = contacts.map((c) => c.id);
  const allSel = selectable && selectedIds ? allIds.length > 0 && allIds.every((id) => selectedIds.has(id)) : false;
  const someSel = selectable && selectedIds ? !allSel && allIds.some((id) => selectedIds.has(id)) : false;

  // Page numbers with ellipsis
  const getPageNumbers = (): (number | "...")[] => {
    const pages: (number | "...")[] = [];
    if (totalPages <= 7) { for (let i = 1; i <= totalPages; i++) pages.push(i); }
    else {
      pages.push(1);
      if (page > 3) pages.push("...");
      for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
      if (page < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-white">
      {/* ── Row 1: Search + Count + Density + Create ── */}
      <div className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-2 shrink-0">
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70 pointer-events-none" />
            <Input placeholder="Search by name, email, or phone..." value={searchQuery} onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9 pr-8 h-9 text-sm bg-white border-border/80 shadow-sm placeholder:text-muted-foreground/50 focus-visible:border-primary focus-visible:ring-primary/20" />
            {searchQuery && <button onClick={() => onSearchChange("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"><X className="w-3.5 h-3.5" /></button>}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-sm tabular-nums mr-1 hidden sm:inline" style={{ fontWeight: 500 }}>
            <span className="text-foreground">{totalCount}</span><span className="text-muted-foreground/70"> contacts</span>
          </span>
          <div className="w-px h-5 bg-border/60 mx-0.5 hidden sm:block" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" onClick={(e) => e.stopPropagation()} className="inline-flex items-center justify-center h-9 gap-2 px-3 rounded-lg border border-border bg-white shadow-sm hover:bg-muted/40 transition-colors cursor-pointer">
                {isCard ? <LayoutGrid className="w-[18px] h-[18px] text-muted-foreground/80" /> : isComfort ? <ListIcon className="w-[18px] h-[18px] text-muted-foreground/80" /> : <AlignJustify className="w-[18px] h-[18px] text-muted-foreground/80" />}
                <span className="text-sm hidden md:inline" style={{ fontWeight: 500 }}>{isCard ? "Card" : isComfort ? "Comfort" : "Condensed"}</span>
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/60" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[200px] p-1.5 z-[350]">
              {([{ key: "condensed" as Density, label: "Condensed", desc: "Compact view", Icon: AlignJustify }, { key: "comfort" as Density, label: "Comfort", desc: "Spacious view", Icon: ListIcon }, { key: "card" as Density, label: "Card View", desc: "Grid layout", Icon: LayoutGrid }]).map((opt) => (
                <DropdownMenuItem key={opt.key} onClick={() => setDensity(opt.key)} className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg ${density === opt.key ? "bg-muted/50" : ""}`}>
                  <opt.Icon className="w-4 h-4 text-muted-foreground shrink-0" /><div className="min-w-0"><p className="text-sm" style={{ fontWeight: 500 }}>{opt.label}</p><p className="text-[10px] text-muted-foreground/60">{opt.desc}</p></div>
                  {density === opt.key && <Check className="w-3.5 h-3.5 ml-auto text-primary shrink-0" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {onCreateNew && (<><div className="w-px h-5 bg-border/60 mx-0.5 hidden sm:block" /><button onClick={onCreateNew} className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-[#0A77FF] hover:bg-[#0862D0] text-white text-sm shadow-sm transition-colors cursor-pointer" style={{ fontWeight: 600 }}><Plus className="w-3.5 h-3.5" /><span className="hidden sm:inline">Create New</span></button></>)}
        </div>
      </div>

      {/* ── Row 2: Status pills + Department dropdown ── */}
      <div className="flex items-center gap-1.5 overflow-x-auto px-4 pb-2.5 shrink-0 scrollbar-hide">
        {([{ key: "all", label: "All", count: totalCount }, { key: "active", label: "Active" }, { key: "inactive", label: "Inactive" }]).map((f) => {
          const isActive = categoryFilter === f.key;
          return (<button key={f.key} onClick={() => onCategoryFilterChange(f.key)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer ${isActive ? "border-primary bg-[#EDF4FF] hover:bg-[#D6E8FF]" : "border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-muted-foreground/30"}`}
            style={{ fontWeight: isActive ? 500 : 400, color: isActive ? "#0A77FF" : undefined }}>
            {f.label}{"count" in f && f.count != null && <span className={`text-[10px] rounded-full px-1.5 py-px min-w-[18px] text-center ${isActive ? "bg-primary/10" : "bg-muted"}`} style={{ fontWeight: 600, color: isActive ? "#0A77FF" : "#475569" }}>{f.count}</span>}
          </button>);
        })}
        <span className="w-px h-5 bg-border/60 shrink-0" />
        <FilterDrop label="Department" selected={deptFilter} options={["Sales", "Supply Chain Management", "Finance"]} onToggle={(v) => setDeptFilter(toggleSet(deptFilter, v))} onClear={() => setDeptFilter(new Set())} searchable />
        {deptFilter.size > 0 && <button type="button" onClick={() => setDeptFilter(new Set())} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs text-[#94A3B8] hover:text-[#EF4444] hover:bg-[#FEF2F2] cursor-pointer transition-colors" style={{ fontWeight: 500 }}><X className="w-3 h-3" />Clear</button>}
      </div>

      {/* ── Table / Card ── */}
      {isCard ? (
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide px-4 py-3 border-t border-border">
          {contacts.length === 0 ? <div className="flex flex-col items-center justify-center py-16"><Users className="w-8 h-8 text-[#E2E8F0] mb-2" /><p className="text-sm text-muted-foreground" style={{ fontWeight: 500 }}>No contacts found</p></div> : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {contacts.map((c) => {
                const isSel = selectable && selectedIds?.has(c.id);
                const t = tint(c.avatarColor);
                const dc = DEPT_COLORS[c.department] || DEPT_COLORS.Sales;
                return (
                  <button key={c.id} type="button" onClick={() => selectable && onToggleSelect?.(c.id)}
                    className={`group/poc relative text-left rounded-xl border transition-all duration-200 ${selectable ? "cursor-pointer" : ""} ${
                      isSel ? "border-[#0A77FF] bg-[#FAFCFF] shadow-[0_0_0_1px_#0A77FF]" : "border-[#E8ECF1] bg-white hover:border-[#BFDBFE] hover:shadow-[0_4px_16px_-4px_rgba(10,119,255,0.12)]"
                    }`}>
                    <div className="p-3.5">
                      {/* Header: Initials + Name + Status + Checkbox */}
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-[10px] shrink-0" style={{ backgroundColor: t.bg, color: t.text, fontWeight: 700 }}>{ini(c.name)}</div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] text-[#0F172A] truncate" style={{ fontWeight: 600 }}><Hl text={c.name} q={searchQuery} /></p>
                          <p className="text-[11px] text-[#334155] truncate" style={{ fontWeight: 500 }}>{c.department === "Supply Chain Management" ? "Supply Chain" : c.department} <span className="text-[#CBD5E1]">·</span> <span className="text-[#94A3B8]" style={{ fontWeight: 400 }}>{c.company}</span></p>
                        </div>
                        <span className="inline-flex items-center text-[10px] px-2 py-[2px] rounded-full border shrink-0" style={{ fontWeight: 500, backgroundColor: "#ECFDF5", color: "#065F46", borderColor: "#A7F3D0" }}>Active</span>
                        {selectable && (
                          <div className={`w-[18px] h-[18px] rounded-[5px] border-[1.5px] flex items-center justify-center shrink-0 transition-all duration-150 ${isSel ? "bg-[#0A77FF] border-[#0A77FF]" : "border-[#CBD5E1] bg-white group-hover/poc:border-[#94A3B8]"}`}>
                            {isSel && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                          </div>
                        )}
                      </div>
                      {/* Contact info */}
                      <div className="mt-2.5 pt-2.5 border-t border-[#F1F5F9] space-y-1">
                        <div className="flex items-center gap-2 text-[11px] text-[#475569]"><Mail className="w-3 h-3 text-[#94A3B8] shrink-0" /><span className="truncate">{c.email}</span></div>
                        <div className="flex items-center gap-2 text-[11px] text-[#475569]"><Phone className="w-3 h-3 text-[#94A3B8] shrink-0" /><span>{c.phone}</span></div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-auto scrollbar-hide border-t border-border">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-white">
              <TableRow className={`bg-muted/30 hover:bg-muted/30 ${isComfort ? "[&>th]:h-10" : "[&>th]:h-8"}`}>
                {selectable && <TableHead className="w-[40px] min-w-[40px] !pl-4 !pr-0"><Checkbox checked={allSel ? true : someSel ? "indeterminate" : false} onCheckedChange={() => onSelectAll?.(allIds)} /></TableHead>}
                <TableHead className="min-w-[200px]">Name</TableHead>
                <TableHead className="w-[120px]">Department</TableHead>
                <TableHead className="w-[200px]">Email</TableHead>
                <TableHead className="w-[130px]">Phone</TableHead>
                <TableHead className="w-[130px]">Secondary</TableHead>
                <TableHead className="w-[80px]">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.length === 0 ? (
                <TableRow><TableCell colSpan={selectable ? 7 : 6} className="h-32 text-center"><div className="flex flex-col items-center py-8"><Users className="w-8 h-8 text-[#E2E8F0] mb-2" /><p className="text-sm text-muted-foreground" style={{ fontWeight: 500 }}>No contacts found</p></div></TableCell></TableRow>
              ) : contacts.map((c) => {
                const isSel = selectable && selectedIds?.has(c.id);
                const t = tint(c.avatarColor);
                return (
                  <TableRow key={c.id} onClick={() => selectable && onToggleSelect?.(c.id)} className={`${selectable ? "cursor-pointer" : ""} ${isSel ? "bg-primary/[0.03]" : ""} ${isComfort ? "[&>td]:py-3 [&>td]:pl-4 [&>td]:pr-2" : "[&>td]:py-1 [&>td]:pl-4 [&>td]:pr-2"}`}>
                    {selectable && <TableCell className="w-[40px] !pl-4 !pr-0"><Checkbox checked={!!isSel} onCheckedChange={() => onToggleSelect?.(c.id)} onClick={(e) => e.stopPropagation()} /></TableCell>}
                    <TableCell>
                      <div className={`flex items-center ${isComfort ? "gap-3" : "gap-2.5"}`}>
                        <div className={`${isComfort ? "w-9 h-9" : "w-8 h-8"} rounded-lg flex items-center justify-center shrink-0 border border-[#E8ECF1]`} style={{ backgroundColor: t.bg, color: t.text, fontSize: isComfort ? 12 : 11, fontWeight: 700 }}>{ini(c.name)}</div>
                        <div className="min-w-0"><span className={`${isComfort ? "text-[13.5px]" : "text-sm"} truncate block`} style={{ fontWeight: 500, color: '#1E293B' }}><Hl text={c.name} q={searchQuery} /></span>{isComfort && <span className="text-xs text-muted-foreground/60 truncate block">{c.company}</span>}</div>
                      </div>
                    </TableCell>
                    <TableCell><span className={`${isComfort ? "text-[13px]" : "text-sm"} text-[#475569]`}>{c.department === "Supply Chain Management" ? "SCM" : c.department}</span></TableCell>
                    <TableCell><span className={`${isComfort ? "text-[13px]" : "text-sm"} text-muted-foreground truncate block max-w-[180px]`}><Hl text={c.email} q={searchQuery} /></span></TableCell>
                    <TableCell><span className={`${isComfort ? "text-[13px]" : "text-sm"} text-muted-foreground`}>{c.phone}</span>{isComfort && c.phoneExt && <span className="text-xs text-muted-foreground/50 ml-1">ext. {c.phoneExt}</span>}</TableCell>
                    <TableCell><span className={`${isComfort ? "text-[13px]" : "text-sm"} text-muted-foreground`}>{c.secondaryPhone || "—"}</span></TableCell>
                    <TableCell><span className="inline-flex items-center text-[11px] px-2 py-0.5 rounded-full border" style={{ fontWeight: 500, backgroundColor: "#ECFDF5", color: "#065F46", borderColor: "#A7F3D0" }}>Active</span></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* ── Pagination — matches listing page exactly ── */}
      {totalCount > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-center px-4 py-3 border-t border-border gap-3 shrink-0">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Records per page</span>
            {onPerPageChange ? (
              <Select value={String(perPage)} onValueChange={(v) => onPerPageChange(Number(v))}>
                <SelectTrigger className="w-[70px] h-8"><SelectValue /></SelectTrigger>
                <SelectContent className="z-[350]">
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <span className="px-2 py-1 rounded border border-border text-xs text-foreground" style={{ fontWeight: 500 }}>{perPage}</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" disabled={page <= 1} onClick={() => onPageChange(1)}><ChevronsLeft className="w-4 h-4" /></Button>
            <Button variant="ghost" size="sm" className="h-8 gap-1 text-sm text-muted-foreground" disabled={page <= 1} onClick={() => onPageChange(page - 1)}><ChevronLeft className="w-3.5 h-3.5" />Prev</Button>
            {getPageNumbers().map((p, idx) => p === "..." ? (
              <span key={`dots-${idx}`} className="px-1 text-sm text-muted-foreground">...</span>
            ) : (
              <Button key={p} variant={page === p ? "default" : "ghost"} size="sm" className={`h-8 w-8 p-0 text-sm ${page === p ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`} onClick={() => onPageChange(p as number)}>{p}</Button>
            ))}
            <Button variant="ghost" size="sm" className="h-8 gap-1 text-sm text-muted-foreground" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>Next<ChevronRight className="w-3.5 h-3.5" /></Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" disabled={page >= totalPages} onClick={() => onPageChange(totalPages)}><ChevronsRight className="w-4 h-4" /></Button>
          </div>
        </div>
      )}
    </div>
  );
}
