import React, { useState, useMemo, useRef, useCallback } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "../ui/dropdown-menu";
import { ColumnSelector, ColumnSelectorTrigger } from "./ColumnSelector";
import { Search, X, SlidersHorizontal, MoreHorizontal, Eye, ExternalLink, Link2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, AlignJustify, List, Check, ChevronDown, GripVertical } from "lucide-react";
import { getAvatarTint } from "../../utils/avatarTints";

type ColKey = "partner_name" | "type" | "linked_since" | "email" | "phone" | "location" | "status";
interface ColDef { key: ColKey; label: string; defaultWidth: number; minWidth: number; sticky?: "left"; locked?: boolean }

const COLUMN_DEFS: ColDef[] = [
  { key: "partner_name", label: "Partner Name", defaultWidth: 240, minWidth: 160, sticky: "left", locked: true },
  { key: "type", label: "Partner Type", defaultWidth: 130, minWidth: 90 },
  { key: "email", label: "Email", defaultWidth: 220, minWidth: 140 },
  { key: "phone", label: "Phone", defaultWidth: 150, minWidth: 110 },
  { key: "location", label: "Location", defaultWidth: 180, minWidth: 120 },
  { key: "linked_since", label: "Linked Since", defaultWidth: 130, minWidth: 90 },
  { key: "status", label: "Status", defaultWidth: 110, minWidth: 80 },
];
const cDef = (key: string) => COLUMN_DEFS.find(c => c.key === key)!;

interface PartnerRow { name: string; type: string; email: string; phone: string; location: string; linkedSince: string; status: string; partnerId?: string }

const CHECKBOX_W = 40; const ACTIONS_W = 60; const MIN_COL_W = 80;

export function LinkedPartnersTable({ partners, onNavigate }: { partners: PartnerRow[]; onNavigate?: (id: string) => void }) {
  const [search, setSearch] = useState(""); const [density, setDensity] = useState<"condensed" | "comfort">("condensed");
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(() => { const v: Record<string, boolean> = {}; COLUMN_DEFS.forEach(c => { v[c.key] = true; }); return v; }); const [columnOrder, setColumnOrder] = useState<ColKey[]>(COLUMN_DEFS.map(c => c.key)); const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set()); const [isResizing, setIsResizing] = useState(false); const [resizingColumnKey, setResizingColumnKey] = useState<string | null>(null); const [draggingColumnKey, setDraggingColumnKey] = useState<string | null>(null); const [columnDrawerOpen, setColumnDrawerOpen] = useState(false);
  const resizeRef = useRef<{ columnKey: string; startX: number; startWidth: number } | null>(null); const colDragRef = useRef<{ columnKey: string; startX: number; startY: number; isDragging: boolean; lastSwapTime: number } | null>(null); const suppressNextClickRef = useRef(false); const ghostElRef = useRef<HTMLDivElement>(null);

  const toggleColVis = (k: ColKey) => setColumnVisibility(prev => ({ ...prev, [k]: prev[k] === false ? true : (prev[k] === undefined ? false : !prev[k]) }));
  const visibleColumns = useMemo(() => columnOrder.filter(k => columnVisibility[k] !== false), [columnOrder, columnVisibility]);
  const getWidth = (key: string) => columnWidths[key] ?? cDef(key).defaultWidth;
  const isRelaxed = density === "comfort"; const sz = isRelaxed ? "text-[13.5px]" : "text-sm";

  const handleResizeStart = useCallback((e: React.MouseEvent, ck: string) => { e.preventDefault(); e.stopPropagation(); resizeRef.current = { columnKey: ck, startX: e.clientX, startWidth: getWidth(ck) }; setIsResizing(true); setResizingColumnKey(ck); const onMove = (me: MouseEvent) => { if (!resizeRef.current) return; setColumnWidths(p => ({ ...p, [resizeRef.current!.columnKey]: Math.max(MIN_COL_W, resizeRef.current!.startWidth + (me.clientX - resizeRef.current!.startX)) })); }; const onUp = () => { resizeRef.current = null; setIsResizing(false); setResizingColumnKey(null); document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); document.body.style.cursor = ""; document.body.style.userSelect = ""; }; document.addEventListener("mousemove", onMove); document.addEventListener("mouseup", onUp); document.body.style.cursor = "col-resize"; document.body.style.userSelect = "none"; }, [columnWidths]);

  const handleHeaderMouseDown = useCallback((e: React.MouseEvent, ck: string) => { if (cDef(ck).locked || isResizing || e.button !== 0) return; colDragRef.current = { columnKey: ck, startX: e.clientX, startY: e.clientY, isDragging: false, lastSwapTime: 0 }; const onMove = (me: MouseEvent) => { if (!colDragRef.current) return; if (!colDragRef.current.isDragging) { if (Math.sqrt((me.clientX - colDragRef.current.startX) ** 2 + (me.clientY - colDragRef.current.startY) ** 2) < 5) return; colDragRef.current.isDragging = true; document.body.style.userSelect = "none"; document.body.style.cursor = "grabbing"; setDraggingColumnKey(colDragRef.current.columnKey); } const ghost = ghostElRef.current; if (ghost) ghost.style.transform = `translate(${me.clientX}px, ${me.clientY}px)`; const now = performance.now(); if (now - colDragRef.current.lastSwapTime < 60) return; const dTh = document.querySelector<HTMLElement>(`th[data-col-drag-key="${colDragRef.current.columnKey}"]`); if (!dTh) return; const dr = dTh.getBoundingClientRect(); if (me.clientX >= dr.left && me.clientX <= dr.right) return; document.querySelectorAll<HTMLElement>("th[data-col-drag-key]").forEach(th => { const r = th.getBoundingClientRect(); if (me.clientX < r.left || me.clientX > r.right) return; const k = th.getAttribute("data-col-drag-key"); if (!k || k === colDragRef.current!.columnKey || cDef(k as ColKey)?.locked) return; setColumnOrder(p => { const si = p.indexOf(colDragRef.current!.columnKey as ColKey); const ti = p.indexOf(k as ColKey); if (si === -1 || ti === -1 || si === ti) return p; const n = [...p]; n.splice(si, 1); n.splice(ti, 0, colDragRef.current!.columnKey as ColKey); return n; }); colDragRef.current!.lastSwapTime = now; }); }; const onUp = () => { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); document.body.style.userSelect = ""; document.body.style.cursor = ""; if (colDragRef.current?.isDragging) { suppressNextClickRef.current = true; requestAnimationFrame(() => { suppressNextClickRef.current = false; }); } colDragRef.current = null; setDraggingColumnKey(null); }; document.addEventListener("mousemove", onMove); document.addEventListener("mouseup", onUp); }, [isResizing]);

  const { stickyOffsets, lastStickyKey } = useMemo(() => { const sc = visibleColumns.filter(k => cDef(k).sticky === "left"); const o: Record<string, number> = {}; let l = CHECKBOX_W; for (const k of sc) { o[k] = l; l += getWidth(k); } return { stickyOffsets: o, lastStickyKey: sc[sc.length - 1] || null }; }, [visibleColumns, columnWidths]);
  const filtered = useMemo(() => { if (!search) return partners; const q = search.toLowerCase(); return partners.filter(p => p.name.toLowerCase().includes(q) || p.type.toLowerCase().includes(q) || p.email.toLowerCase().includes(q)); }, [search, partners]);
  const totalW = CHECKBOX_W + visibleColumns.reduce((s, k) => s + getWidth(k), 0) + ACTIONS_W;
  const allSel = filtered.length > 0 && filtered.every(r => selectedRows.has(r.name)); const someSel = filtered.some(r => selectedRows.has(r.name));

  const renderCell = (p: PartnerRow, key: ColKey) => {
    const tint = getAvatarTint(p.name); const initials = p.name.split(" ").filter(Boolean).map(w => w[0]).slice(0, 2).join("").toUpperCase();
    switch (key) {
      case "partner_name": return (<div className={`flex items-center ${isRelaxed ? "gap-3" : "gap-2.5"}`}><div className={`${isRelaxed ? "w-8 h-8" : "w-7 h-7"} rounded-lg flex items-center justify-center shrink-0 text-[9px]`} style={{ backgroundColor: tint.bg, color: tint.fg, fontWeight: 700 }}>{initials}</div><span className={`${sz} truncate ${p.partnerId ? "hover:text-primary cursor-pointer" : ""}`} style={{ fontWeight: 500, color: "#1E293B" }}>{p.name}</span></div>);
      case "type": { const isVendor = p.type === "Vendor"; return <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs whitespace-nowrap" style={{ fontWeight: 500, ...(isVendor ? { backgroundColor: "#DBEAFE", color: "#2563EB", borderColor: "#BFDBFE" } : { backgroundColor: "#EDE9FE", color: "hsl(var(--violet))", borderColor: "#C4B5FD" }) }}>{p.type}</span>; }
      case "email": return <span className={`${sz} text-primary hover:underline cursor-pointer truncate block`}>{p.email}</span>;
      case "phone": return <span className={`${sz} text-slate-500`}>{p.phone}</span>;
      case "location": return <span className={`${sz} text-slate-500 truncate block`}>{p.location}</span>;
      case "linked_since": return <span className={`${sz} text-slate-500`}>{p.linkedSince}</span>;
      case "status": { const isActive = p.status === "Active"; return <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs whitespace-nowrap" style={{ fontWeight: 500, ...(isActive ? { backgroundColor: "#ECFDF5", color: "#065F46", borderColor: "#A7F3D0" } : { backgroundColor: "#FFFBEB", color: "#92400E", borderColor: "#FDE68A" }) }}>{p.status}</span>; }
      default: return <span>—</span>;
    }
  };

  return (
    <div className="border border-border rounded-xl bg-card overflow-clip flex flex-col flex-1 min-h-[calc(100vh-260px)]">
      <div className="px-4 py-3 flex items-center gap-3 border-b border-muted flex-wrap">
        <div className="relative flex-1 max-w-xs"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70 pointer-events-none" /><Input placeholder="Search partners..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 pr-8 h-9 text-sm bg-white border-border/80 shadow-sm placeholder:text-muted-foreground/50" />{search && <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"><X className="w-3.5 h-3.5" /></button>}</div>
        <button className="inline-flex items-center justify-center h-9 gap-1.5 px-3 rounded-lg border border-border/80 bg-white shadow-sm hover:bg-muted/50 transition-colors text-foreground cursor-pointer"><SlidersHorizontal className="w-3.5 h-3.5" /><span className="text-sm" style={{ fontWeight: 500 }}>Filters</span></button>
        <span className="text-sm tabular-nums ml-auto" style={{ fontWeight: 500 }}><span className="text-foreground">{filtered.length}</span><span className="text-muted-foreground/70"> partners</span></span>
        <DropdownMenu><DropdownMenuTrigger asChild><button className="inline-flex items-center justify-center h-9 gap-2 px-3 rounded-lg border border-border bg-white shadow-sm hover:bg-muted/40 transition-colors cursor-pointer">{density === "condensed" ? <AlignJustify className="w-[18px] h-[18px] text-muted-foreground/80" /> : <List className="w-[18px] h-[18px] text-muted-foreground/80" />}<span className="text-sm hidden md:inline" style={{ fontWeight: 500 }}>{density === "condensed" ? "Condensed" : "Comfort"}</span><ChevronDown className="w-3.5 h-3.5 text-muted-foreground/60" /></button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-[200px] p-1.5">{(["condensed", "comfort"] as const).map(d => (<DropdownMenuItem key={d} className="flex items-center gap-3 py-2.5 px-3 cursor-pointer rounded-md" onSelect={() => setDensity(d)}>{d === "condensed" ? <AlignJustify className="w-5 h-5 text-muted-foreground shrink-0" /> : <List className="w-5 h-5 text-muted-foreground shrink-0" />}<span className="text-sm flex-1" style={{ fontWeight: 500 }}>{d === "condensed" ? "Condensed" : "Comfort"}</span>{density === d && <Check className="w-4 h-4 shrink-0" style={{ color: "hsl(var(--primary))" }} />}</DropdownMenuItem>))}</DropdownMenuContent></DropdownMenu>
        <ColumnSelectorTrigger visibleCount={visibleColumns.length} active={columnDrawerOpen} onClick={() => setColumnDrawerOpen(!columnDrawerOpen)} />
      </div>
      <div className="flex flex-1 min-h-0">
      <div className={`overflow-auto flex-1 ${isResizing || draggingColumnKey ? "select-none" : ""}`}>
        <Table style={{ tableLayout: "fixed", width: `max(${totalW}px, 100%)` }}>
          <TableHeader className="sticky top-0 z-20 bg-card"><TableRow className={`bg-muted/30 hover:bg-muted/30 ${density === "condensed" ? "[&>th]:h-8" : "[&>th]:h-9"}`}>
            <TableHead className="sticky left-0 z-20 bg-slate-50" style={{ width: CHECKBOX_W, minWidth: CHECKBOX_W, maxWidth: CHECKBOX_W, paddingLeft: 8, paddingRight: 0 }}><Checkbox checked={allSel ? true : someSel ? "indeterminate" : false} onCheckedChange={() => { if (allSel) setSelectedRows(new Set()); else setSelectedRows(new Set(filtered.map(r => r.name))); }} /></TableHead>
            {visibleColumns.map(key => { const def = cDef(key); const w = getWidth(key); const isS = def.sticky === "left"; const isLS = key === lastStickyKey; const isD = draggingColumnKey === key; const isDbl = !def.locked; return (
              <TableHead key={key} data-col-drag-key={key} onMouseDown={isDbl ? (e) => handleHeaderMouseDown(e, key) : undefined} onClickCapture={isDbl ? (e) => { if (suppressNextClickRef.current) { e.stopPropagation(); e.preventDefault(); } } : undefined} className={`whitespace-nowrap relative group/colheader ${isS ? "sticky z-20 bg-slate-50" : ""} ${isDbl ? "cursor-grab" : ""}`} style={{ width: w, minWidth: w, maxWidth: w, overflow: "hidden", ...(isS ? { left: stickyOffsets[key], ...(!isD && isLS ? { boxShadow: "inset -1px 0 0 0 rgba(0,0,0,0.08), 3px 0 6px -2px rgba(0,0,0,0.06)" } : {}) } : {}), ...(isD ? { background: "linear-gradient(180deg, rgba(10,119,255,0.08) 0%, rgba(10,119,255,0.03) 100%)" } : {}) }}>
                {isD && <div className="absolute top-0 left-0 right-0 h-[2px] rounded-b-full" style={{ backgroundColor: "hsl(var(--primary))" }} />}
                {isDbl && <GripVertical className={`absolute left-1 top-1/2 -translate-y-1/2 w-3 h-3 transition-opacity z-[5] pointer-events-none ${isD ? "opacity-100 text-primary" : "opacity-0 group-hover/colheader:opacity-100 text-muted-foreground/40"}`} />}
                <span className="text-[13px]">{def.label}</span>
                <div onMouseDown={(e) => { e.stopPropagation(); handleResizeStart(e, key); }} onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => { e.stopPropagation(); setColumnWidths(p => ({ ...p, [key]: def.defaultWidth })); }} className="absolute right-0 top-0 bottom-0 w-[5px] cursor-col-resize z-10 group/resize" style={{ touchAction: "none" }}><div className={`absolute right-0 top-1 bottom-1 w-[2px] rounded-full transition-colors ${resizingColumnKey === key ? "bg-primary" : "bg-transparent group-hover/resize:bg-primary/40"}`} /></div>
              </TableHead>
            ); })}
            <TableHead className="whitespace-nowrap sticky right-0 z-20 bg-slate-50 !pl-2 !pr-2" style={{ width: ACTIONS_W, minWidth: ACTIONS_W, maxWidth: ACTIONS_W, boxShadow: "inset 1px 0 0 0 rgba(0,0,0,0.08)" }}><span className="text-[13px]">Actions</span></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {filtered.length === 0 ? (<TableRow><TableCell colSpan={visibleColumns.length + 2} className="text-center py-12 text-muted-foreground">No linked partners found.</TableCell></TableRow>) : filtered.map((p, idx) => (
              <TableRow key={p.name + idx} className={`cursor-pointer group hover:bg-[#F0F7FF] ${density === "condensed" ? "[&>td]:py-1 [&>td]:pl-4 [&>td]:pr-2" : "[&>td]:py-2 [&>td]:pl-4 [&>td]:pr-2"}`} onClick={() => p.partnerId && onNavigate?.(p.partnerId)}>
                <TableCell className="sticky left-0 z-10 bg-card group-hover:bg-[#F0F7FF]" style={{ width: CHECKBOX_W, minWidth: CHECKBOX_W, maxWidth: CHECKBOX_W, paddingLeft: 8, paddingRight: 0 }}><Checkbox checked={selectedRows.has(p.name)} onCheckedChange={() => setSelectedRows(prev => { const n = new Set(prev); if (n.has(p.name)) n.delete(p.name); else n.add(p.name); return n; })} onClick={(e) => e.stopPropagation()} /></TableCell>
                {visibleColumns.map(key => { const def = cDef(key); const w = getWidth(key); const isS = def.sticky === "left"; const isLS = key === lastStickyKey; const isD = draggingColumnKey === key; return (
                  <TableCell key={key} className={`${isS ? "sticky z-10 bg-card group-hover:bg-[#F0F7FF]" : ""}`} style={{ width: w, minWidth: w, maxWidth: w, overflow: "hidden", textOverflow: "ellipsis", ...(isS ? { left: stickyOffsets[key], ...(!isD && isLS ? { boxShadow: "inset -1px 0 0 0 rgba(0,0,0,0.08), 3px 0 6px -2px rgba(0,0,0,0.06)" } : {}) } : {}), ...(isD ? { backgroundColor: "rgba(10,119,255,0.035)" } : {}) }}>{renderCell(p, key)}</TableCell>
                ); })}
                <TableCell className="sticky right-0 bg-card group-hover:bg-[#F0F7FF] z-10 !pl-2 !pr-2" style={{ boxShadow: "inset 1px 0 0 0 rgba(0,0,0,0.08)" }}>
                  <DropdownMenu><DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}><button className="inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors cursor-pointer"><MoreHorizontal className="w-4 h-4" /></button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-[180px]" onClick={(e) => e.stopPropagation()}><DropdownMenuItem><Eye className="w-4 h-4 mr-2" /> View Partner</DropdownMenuItem><DropdownMenuItem><ExternalLink className="w-4 h-4 mr-2" /> Open in New Tab</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-red-50"><Link2 className="w-4 h-4 mr-2" /> Unlink</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ColumnSelector columns={COLUMN_DEFS} columnOrder={columnOrder} columnVisibility={columnVisibility} onColumnOrderChange={(o) => setColumnOrder(o as ColKey[])} onColumnVisibilityChange={setColumnVisibility} lockedColumns={["partner_name"]} open={columnDrawerOpen} onOpenChange={setColumnDrawerOpen} />
      </div>
      <div ref={ghostElRef} className="fixed top-0 left-0 z-[9999] pointer-events-none" style={{ opacity: draggingColumnKey ? 1 : 0 }}>{draggingColumnKey && <div className="bg-white/95 backdrop-blur-sm border border-primary/20 shadow-lg rounded-lg px-3 py-1.5 -translate-x-1/2 -translate-y-full" style={{ marginTop: -8 }}><span className="text-[12px] text-primary" style={{ fontWeight: 600 }}>{cDef(draggingColumnKey as ColKey)?.label}</span></div>}</div>
      <div className="flex items-center justify-center px-4 py-3 border-t border-border gap-3"><span className="text-sm text-muted-foreground">Records per page</span><span className="text-sm px-2 py-1 border border-border rounded-md" style={{ fontWeight: 500 }}>20</span><div className="flex items-center gap-1 ml-4"><Button variant="ghost" size="sm" className="h-8 w-8 p-0" disabled><ChevronsLeft className="w-4 h-4" /></Button><Button variant="ghost" size="sm" className="h-8 gap-1 text-sm text-muted-foreground" disabled><ChevronLeft className="w-3.5 h-3.5" /> Prev</Button><Button size="sm" className="h-8 w-8 p-0 text-sm bg-primary text-primary-foreground">1</Button><Button variant="ghost" size="sm" className="h-8 gap-1 text-sm text-muted-foreground" disabled>Next <ChevronRight className="w-3.5 h-3.5" /></Button><Button variant="ghost" size="sm" className="h-8 w-8 p-0" disabled><ChevronsRight className="w-4 h-4" /></Button></div></div>
    </div>
  );
}
