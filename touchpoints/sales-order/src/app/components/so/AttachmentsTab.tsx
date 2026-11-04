import { useState, useMemo } from "react";
import { FileText, FileSpreadsheet, File, ClipboardList, Truck, Receipt, Layers, ChevronDown, ChevronRight, ChevronUp, Eye, MoreHorizontal, Package, Upload, Link2 } from "lucide-react";
import { HighlightText, TabSearchBar, FilterPills } from "./SearchHighlight";
import { ThTooltip, Tooltip } from "./Tooltip";
import type { Attachment, SOLine } from "./types";

const FILE_ICON_COLORS: Record<string, string> = {
  pdf: "text-destructive",
  xlsx: "text-accent",
  doc: "text-primary",
  cfg: "text-foreground/50",
  png: "text-chart-4",
  jpg: "text-chart-4",
  csv: "text-accent",
  sheet: "text-accent",
};

function FileIcon({ kind }: { kind: string }) {
  const colour = FILE_ICON_COLORS[kind] ?? "text-foreground/50";
  if (kind === "xlsx" || kind === "csv" || kind === "sheet") return <FileSpreadsheet className={`w-4 h-4 ${colour} shrink-0`} aria-hidden="true" />;
  if (kind === "pdf" || kind === "doc") return <FileText className={`w-4 h-4 ${colour} shrink-0`} aria-hidden="true" />;
  return <File className={`w-4 h-4 ${colour} shrink-0`} aria-hidden="true" />;
}

interface SectionDef { key: string; label: string; category: string; icon: typeof FileText; }
const SECTIONS: SectionDef[] = [
  { key: "pre-sales", label: "Pre-Sales Documents", category: "pre-sales", icon: ClipboardList },
  { key: "so-docs", label: "Sales Order Documents", category: "so-docs", icon: FileText },
  { key: "fulfillment", label: "Fulfillment & Shipping Documents", category: "fulfillment", icon: Truck },
  { key: "invoices", label: "Invoices & Financial Documents", category: "invoices", icon: Receipt },
  { key: "item", label: "Item Attachments", category: "item", icon: Layers },
];

type FilterKey = "all" | "pre-sales" | "so-docs" | "fulfillment" | "invoices" | "item" | "pdf" | "png" | "xlsx";

interface AttachmentsTabProps { attachments: Attachment[]; lines: SOLine[]; }

/* ═══ Inline typography styles ═══ */
const captionStyle: React.CSSProperties = { fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-medium)" };
const captionNormal: React.CSSProperties = { fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-normal)" };

export function AttachmentsTab({ attachments, lines }: AttachmentsTabProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(new Set());
  const toggle = (key: string) => setCollapsed(p => ({ ...p, [key]: !p[key] }));
  const toggleDescription = (lineId: string) => {
    setExpandedDescriptions(prev => {
      const next = new Set(prev);
      if (next.has(lineId)) next.delete(lineId); else next.add(lineId);
      return next;
    });
  };

  const counts = useMemo(() => ({
    all: attachments.length, "pre-sales": attachments.filter(a => a.category === "pre-sales").length,
    "so-docs": attachments.filter(a => a.category === "so-docs").length, fulfillment: attachments.filter(a => a.category === "fulfillment").length,
    invoices: attachments.filter(a => a.category === "invoices").length, item: attachments.filter(a => a.category === "item").length,
    pdf: attachments.filter(a => a.fileKind === "pdf").length, png: attachments.filter(a => ["png", "jpg"].includes(a.fileKind)).length,
    xlsx: attachments.filter(a => ["xlsx", "csv", "sheet"].includes(a.fileKind)).length,
  }), [attachments]);

  const filtered = useMemo(() => {
    let list = attachments;
    if (filter === "pre-sales") list = list.filter(a => a.category === "pre-sales");
    else if (filter === "so-docs") list = list.filter(a => a.category === "so-docs");
    else if (filter === "fulfillment") list = list.filter(a => a.category === "fulfillment");
    else if (filter === "invoices") list = list.filter(a => a.category === "invoices");
    else if (filter === "item") list = list.filter(a => a.category === "item");
    else if (filter === "pdf") list = list.filter(a => a.fileKind === "pdf");
    else if (filter === "png") list = list.filter(a => ["png", "jpg"].includes(a.fileKind));
    else if (filter === "xlsx") list = list.filter(a => ["xlsx", "csv", "sheet"].includes(a.fileKind));
    if (search) { const q = search.toLowerCase(); list = list.filter(a => a.name.toLowerCase().includes(q) || a.uploadedBy.toLowerCase().includes(q)); }
    return list;
  }, [attachments, filter, search]);

  const itemLevel = filtered.filter(a => a.category === "item");
  const itemsByLine = useMemo(() => {
    const map = new Map<string, { line: SOLine; files: Attachment[] }>();
    itemLevel.forEach(a => {
      if (!a.lineItemId) return;
      if (!map.has(a.lineItemId)) { const line = lines.find(l => l.id === a.lineItemId); if (line) map.set(a.lineItemId, { line, files: [] }); }
      map.get(a.lineItemId)?.files.push(a);
    });
    return Array.from(map.values());
  }, [itemLevel, lines]);

  /* Pre-sales: split into order-level and item-level sub-groups */
  const preSalesFiles = filtered.filter(a => a.category === "pre-sales");
  const preSalesOrderLevel = preSalesFiles.filter(a => !a.lineItemId);
  const preSalesByLine = useMemo(() => {
    const map = new Map<string, { line: SOLine; files: Attachment[] }>();
    preSalesFiles.filter(a => a.lineItemId).forEach(a => {
      if (!a.lineItemId) return;
      if (!map.has(a.lineItemId)) { const line = lines.find(l => l.id === a.lineItemId); if (line) map.set(a.lineItemId, { line, files: [] }); }
      map.get(a.lineItemId)?.files.push(a);
    });
    return Array.from(map.values());
  }, [preSalesFiles, lines]);

  /* Fulfillment: group by shipmentId */
  const fulfillmentFiles = filtered.filter(a => a.category === "fulfillment");
  const fulfillmentByShipment = useMemo(() => {
    const map = new Map<string, Attachment[]>();
    fulfillmentFiles.forEach(a => {
      const key = a.shipmentId || "__unassigned__";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    });
    return Array.from(map.entries());
  }, [fulfillmentFiles]);

  const pills: { key: FilterKey; label: string; count?: number }[] = [
    { key: "all", label: "All", count: counts.all }, { key: "pre-sales", label: "Pre-Sales", count: counts["pre-sales"] },
    { key: "so-docs", label: "SO Docs", count: counts["so-docs"] }, { key: "item", label: "Item", count: counts.item },
    { key: "pdf", label: "PDF", count: counts.pdf }, { key: "png", label: "Images", count: counts.png }, { key: "xlsx", label: "Sheets", count: counts.xlsx },
  ];

  const filterPills = pills.map(p => ({ key: p.key, label: p.label, count: p.count ?? 0 }));

  const COL_TIPS: Record<string, string> = {
    NAME: "File name and type indicator",
    SIZE: "File size on disk",
    "UPLOADED BY": "User who uploaded this document",
    DATE: "Date the file was uploaded",
    "IN ORDER": "Whether this file is included with the sales order",
  };

  const ColHeaders = () => (
    <thead>
      <tr className="border-b border-border bg-secondary/30">
        {["NAME", "SIZE", "UPLOADED BY", "DATE", "IN ORDER"].map((h, i) => (
          <th key={h} scope="col" className={`py-2 px-4 text-[length:var(--text-micro)] text-foreground/40 whitespace-nowrap text-left font-semibold tracking-wider ${i === 1 || i === 3 ? "hidden md:table-cell" : ""} ${i === 2 ? "hidden lg:table-cell" : ""} ${i === 4 ? "text-center hidden sm:table-cell" : ""}`}>
            <ThTooltip label={h} tooltip={COL_TIPS[h]} />
          </th>
        ))}
        <th className="w-8"><span className="sr-only">Actions</span></th>
      </tr>
    </thead>
  );

  /* ═══ Reusable line-item group header: thumbnail → ID + 2-line desc w/ "more >>" ═══ */
  const LineItemGroupHeader = ({ line, sectionPrefix }: { line: SOLine; sectionPrefix: string }) => {
    const key = `${sectionPrefix}-${line.id}`;
    const isExpanded = expandedDescriptions.has(key);

    return (
      <tr key={`hdr-${line.id}`} className="border-b border-border/60 bg-muted/40">
        <td colSpan={6} className="py-2.5 px-4">
          <div className="flex items-start gap-3">
            {/* Thumbnail placeholder with visible background */}
            <div
              className="shrink-0 flex items-center justify-center rounded-md"
              style={{ width: 36, height: 36, backgroundColor: "#F1F5F9", border: "1px solid #E2E8F0" }}
            >
              <Package className="text-foreground/30" style={{ width: 16, height: 16 }} />
            </div>

            {/* ID + Description */}
            <div className="flex-1 min-w-0">
              <span
                className="text-foreground"
                style={{ ...captionStyle, fontWeight: "var(--font-weight-semibold)" }}
              >
                {line.itemCode}
              </span>

              <div style={captionNormal} className="text-foreground/50 mt-0.5">
                {!isExpanded ? (
                  <div className="line-clamp-2">
                    {line.itemName}
                    {line.itemName.length > 60 && (
                      <button
                        onClick={() => toggleDescription(key)}
                        className="text-primary hover:underline ml-1 inline"
                        style={{ ...captionStyle, color: "var(--primary)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                      >
                        more &gt;&gt;
                      </button>
                    )}
                  </div>
                ) : (
                  <div>
                    {line.itemName}
                    <button
                      onClick={() => toggleDescription(key)}
                      className="text-primary hover:underline ml-1 inline-flex items-center gap-0.5"
                      style={{ fontSize: "var(--text-small)", fontWeight: "var(--font-weight-medium)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                    >
                      <ChevronUp style={{ width: 12, height: 12 }} /> less
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </td>
      </tr>
    );
  };

  const FileRow = ({ att, indent = false }: { att: Attachment; indent?: boolean }) => (
    <tr className={`border-b border-border/60 hover:bg-secondary/50 transition-colors group ${indent ? "bg-white" : ""}`}>
      <td className={`py-2.5 px-4 ${indent ? "pl-10" : ""}`}>
        <div className="flex items-center gap-2">
          <FileIcon kind={att.fileKind} />
          <Tooltip text={att.description || att.name} position="top">
            <span className="text-[length:var(--text-caption)] text-foreground truncate max-w-[260px] lg:max-w-none"><HighlightText text={att.name} search={search} /></span>
          </Tooltip>
          {att.tag && <span className="text-[length:var(--text-micro)] text-foreground/50 border border-border rounded px-1.5 py-[1px] shrink-0 whitespace-nowrap font-medium">{att.tag}</span>}
        </div>
      </td>
      <td className="py-2.5 px-4 text-[length:var(--text-caption)] text-foreground/40 whitespace-nowrap hidden md:table-cell">
        <Tooltip text={`File size: ${att.size}`} position="top"><span>{att.size}</span></Tooltip>
      </td>
      <td className="py-2.5 px-4 text-[length:var(--text-caption)] text-foreground/50 whitespace-nowrap hidden lg:table-cell">
        <Tooltip text={`Uploaded by ${att.uploadedBy}`} position="top"><span><HighlightText text={att.uploadedBy} search={search} /></span></Tooltip>
      </td>
      <td className="py-2.5 px-4 text-[length:var(--text-caption)] text-foreground/40 whitespace-nowrap hidden md:table-cell">
        <Tooltip text={`Uploaded on ${att.date}`} position="top"><span>{att.date}</span></Tooltip>
      </td>
      <td className="py-2.5 px-4 text-center hidden sm:table-cell">
        <Tooltip text={att.inOrder ? "Included with this order" : "Not included in order"} position="top">
          <span>{att.inOrder ? <Eye className="w-3.5 h-3.5 text-primary mx-auto" aria-label="Included in order" /> : <span className="text-foreground/20">—</span>}</span>
        </Tooltip>
      </td>
      <td className="py-2.5 px-4">
        <Tooltip text={`More actions for ${att.name}`} position="top">
          <button className="w-6 h-6 rounded flex items-center justify-center hover:bg-secondary transition-colors opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" aria-label={`Actions for ${att.name}`}>
            <MoreHorizontal className="w-3.5 h-3.5 text-foreground/40" />
          </button>
        </Tooltip>
      </td>
    </tr>
  );

  if (attachments.length === 0) {
    return <div className="bg-card border border-border p-8 text-center text-foreground/50 text-[length:var(--text-caption)]" style={{ borderRadius: "var(--radius-xl)", boxShadow: "var(--elevation-sm)" }} role="status">No attachments yet. Upload files to associate documents with this Sales Order.</div>;
  }

  return (
    <div className="bg-card border border-border" style={{ borderRadius: "var(--radius-xl)", boxShadow: "var(--elevation-sm)" }} role="region" aria-label="Attachments">
      <TabSearchBar
        search={search}
        onSearchChange={setSearch}
        placeholder="Search documents..."
        resultCount={filtered.length}
        resultLabel={`document${filtered.length !== 1 ? "s" : ""}`}
      >
        <button className="flex items-center rounded-md border border-border bg-card text-foreground/60 hover:text-foreground hover:bg-secondary transition-colors" style={{ gap: 5, padding: "6px 10px", fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-medium)" }}>
          <Link2 className="w-3.5 h-3.5" /> Add External URL
        </button>
        <button className="flex items-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors" style={{ gap: 6, padding: "7px 12px", fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-medium)" }}>
          <Upload className="w-3.5 h-3.5" /> Upload
        </button>
      </TabSearchBar>
      <FilterPills pills={filterPills} active={filter} onSelect={setFilter} />

      <div style={{ padding: "0 var(--space-card-padding) var(--space-card-padding)" }} className="space-y-4">
        {SECTIONS.map(sec => {
          if (sec.key === "item") {
            if (itemsByLine.length === 0) return null;
            const open = collapsed[sec.key] !== true;
            const Icon = sec.icon;
            return (
              <div key={sec.key} className="border border-border rounded-lg overflow-hidden shadow-elevation-sm">
                <button onClick={() => toggle(sec.key)} className="flex items-center gap-2 w-full px-4 py-2.5 bg-secondary text-left hover:bg-muted transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" aria-expanded={open} aria-controls={`section-${sec.key}`}>
                  {open ? <ChevronDown className="w-4 h-4 text-foreground/50" aria-hidden="true" /> : <ChevronRight className="w-4 h-4 text-foreground/50" aria-hidden="true" />}
                  <Icon className="w-4 h-4 text-foreground/50" aria-hidden="true" />
                  <span className="text-[length:var(--text-caption)] text-foreground font-semibold">{sec.label}</span>
                  <span className="text-[length:var(--text-small)] text-foreground/50 bg-border rounded-full px-1.5 py-[1px] min-w-[18px] text-center font-medium">{itemLevel.length}</span>
                </button>
                {open && (
                  <div className="overflow-x-auto bg-card" id={`section-${sec.key}`}>
                    <table className="w-full text-[length:var(--text-caption)]" role="table" aria-label={sec.label}>
                      <ColHeaders />
                      <tbody>
                        {itemsByLine.flatMap(({ line, files }) => [
                          <LineItemGroupHeader key={`hdr-${line.id}`} line={line} sectionPrefix="item" />,
                          ...files.map(a => <FileRow key={a.id} att={a} indent />),
                        ])}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          }

          if (sec.key === "pre-sales") {
            if (preSalesFiles.length === 0) return null;
            const open = collapsed[sec.key] !== true;
            const Icon = sec.icon;
            return (
              <div key={sec.key} className="border border-border rounded-lg overflow-hidden shadow-elevation-sm">
                <button onClick={() => toggle(sec.key)} className="flex items-center gap-2 w-full px-4 py-2.5 bg-secondary text-left hover:bg-muted transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" aria-expanded={open} aria-controls={`section-${sec.key}`}>
                  {open ? <ChevronDown className="w-4 h-4 text-foreground/50" aria-hidden="true" /> : <ChevronRight className="w-4 h-4 text-foreground/50" aria-hidden="true" />}
                  <Icon className="w-4 h-4 text-foreground/50" aria-hidden="true" />
                  <span className="text-[length:var(--text-caption)] text-foreground font-semibold">{sec.label}</span>
                  <span className="text-[length:var(--text-small)] text-foreground/50 bg-border rounded-full px-1.5 py-[1px] min-w-[18px] text-center font-medium">{preSalesFiles.length}</span>
                </button>
                {open && (
                  <div className="overflow-x-auto bg-card" id={`section-${sec.key}`}>
                    <table className="w-full text-[length:var(--text-caption)]" role="table" aria-label={sec.label}>
                      <ColHeaders />
                      <tbody>
                        {preSalesOrderLevel.map(a => <FileRow key={a.id} att={a} />)}
                        {preSalesByLine.flatMap(({ line, files }) => [
                          <LineItemGroupHeader key={`hdr-${line.id}`} line={line} sectionPrefix="presales" />,
                          ...files.map(a => <FileRow key={a.id} att={a} indent />),
                        ])}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          }

          if (sec.key === "fulfillment") {
            if (fulfillmentFiles.length === 0) return null;
            const open = collapsed[sec.key] !== true;
            const Icon = sec.icon;
            return (
              <div key={sec.key} className="border border-border rounded-lg overflow-hidden shadow-elevation-sm">
                <button onClick={() => toggle(sec.key)} className="flex items-center gap-2 w-full px-4 py-2.5 bg-secondary text-left hover:bg-muted transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" aria-expanded={open} aria-controls={`section-${sec.key}`}>
                  {open ? <ChevronDown className="w-4 h-4 text-foreground/50" aria-hidden="true" /> : <ChevronRight className="w-4 h-4 text-foreground/50" aria-hidden="true" />}
                  <Icon className="w-4 h-4 text-foreground/50" aria-hidden="true" />
                  <span className="text-[length:var(--text-caption)] text-foreground font-semibold">{sec.label}</span>
                  <span className="text-[length:var(--text-small)] text-foreground/50 bg-border rounded-full px-1.5 py-[1px] min-w-[18px] text-center font-medium">{fulfillmentFiles.length}</span>
                </button>
                {open && (
                  <div className="overflow-x-auto bg-card" id={`section-${sec.key}`}>
                    <table className="w-full text-[length:var(--text-caption)]" role="table" aria-label={sec.label}>
                      <ColHeaders />
                      <tbody>
                        {fulfillmentByShipment.flatMap(([shipmentId, files]) => [
                          <tr key={`hdr-${shipmentId}`} className="border-b border-border">
                            <td colSpan={6} className="py-2 px-4">
                              <div className="flex items-center gap-2">
                                <span className="text-[length:var(--text-caption)] text-primary font-medium">{shipmentId}</span>
                              </div>
                            </td>
                          </tr>,
                          ...files.map(a => <FileRow key={a.id} att={a} indent />),
                        ])}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          }

          const sectionFiles = filtered.filter(a => a.category === sec.category);
          if (sectionFiles.length === 0) return null;
          const open = collapsed[sec.key] !== true;
          const Icon = sec.icon;
          return (
            <div key={sec.key} className="border border-border rounded-lg overflow-hidden shadow-elevation-sm">
              <button onClick={() => toggle(sec.key)} className="flex items-center gap-2 w-full px-4 py-2.5 bg-secondary text-left hover:bg-muted transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" aria-expanded={open} aria-controls={`section-${sec.key}`}>
                {open ? <ChevronDown className="w-4 h-4 text-foreground/50" aria-hidden="true" /> : <ChevronRight className="w-4 h-4 text-foreground/50" aria-hidden="true" />}
                <Icon className="w-4 h-4 text-foreground/50" aria-hidden="true" />
                <span className="text-[length:var(--text-caption)] text-foreground font-semibold">{sec.label}</span>
                <span className="text-[length:var(--text-small)] text-foreground/50 bg-border rounded-full px-1.5 py-[1px] min-w-[18px] text-center font-medium">{sectionFiles.length}</span>
              </button>
              {open && (
                <div className="overflow-x-auto bg-card" id={`section-${sec.key}`}>
                  <table className="w-full text-[length:var(--text-caption)]" role="table" aria-label={sec.label}>
                    <ColHeaders />
                    <tbody>{sectionFiles.map(a => <FileRow key={a.id} att={a} />)}</tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}