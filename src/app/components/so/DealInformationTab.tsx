import { useState, useRef, useEffect, useCallback } from "react";
import { useSOStore } from "./store";
import {
  Pencil, Check, X, Plus, ChevronDown, User,
  ExternalLink, Tag, FileText, StickyNote, Link2, Upload,
  Paperclip, Trash2, Megaphone, Swords, CalendarCheck,
  Layers, Lock, RotateCcw, Scale,
} from "lucide-react";
import type { SalesOrder } from "./types";
import { toast } from "sonner";

/* ═══ Typography tokens — CSS variables only ═══ */
const T = {
  title: { fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties,
  desc: { fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-normal)", lineHeight: 1.5 } as React.CSSProperties,
  hint: { fontSize: "var(--text-small)", fontWeight: "var(--font-weight-normal)", lineHeight: 1.4 } as React.CSSProperties,
  micro: { fontSize: "var(--text-micro)", fontWeight: "var(--font-weight-semibold)", letterSpacing: "0.05em", textTransform: "uppercase" as const } as React.CSSProperties,
  caption: { fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties,
  captionNormal: { fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-normal)" } as React.CSSProperties,
};

/* ─── Shared card wrapper matching Quote OverviewTab FieldCard ─── */
function FieldCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="bg-card border border-border"
      style={{ borderRadius: "var(--radius-xl)", padding: "20px 24px", boxShadow: "var(--elevation-1)" }}
    >
      {children}
    </div>
  );
}

/* ─── Reusable icon box ─── */
function IconBox({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="bg-secondary flex items-center justify-center shrink-0"
      style={{ width: 28, height: 28, borderRadius: 7 }}
    >
      {children}
    </div>
  );
}

/* ─── Card header (icon + title) ─── */
function CardHeader({ icon, title, badge }: { icon: React.ReactNode; title: string; badge?: React.ReactNode }) {
  return (
    <div className="flex items-center" style={{ gap: 10 }}>
      <IconBox>{icon}</IconBox>
      <span className="text-foreground" style={T.title}>{title}</span>
      {badge}
    </div>
  );
}

/* ─── Card description ─── */
function CardDesc({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-normal)", lineHeight: 1.6, marginTop: 6, color: "#374151" }}>
      {children}
    </div>
  );
}

/* ─── Bottom hint row ─── */
function HintRow({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-start" style={{ gap: 5, marginTop: 8, fontSize: 11, fontWeight: 400, lineHeight: 1.4, color: "#9CA3AF" }}>
      <span className="shrink-0" style={{ marginTop: 1, opacity: 0.7 }}>{icon}</span>
      <span>{children}</span>
    </div>
  );
}

/* ═══ Competitive options ═══ */
const COMPETITIVE_OPTIONS = [
  { key: "none", label: "None" },
  { key: "competitive", label: "Competitive" },
  { key: "sole_source", label: "Sole Source" },
  { key: "incumbent", label: "Incumbent" },
] as const;

/* ═══ Lead source options ═══ */
const LEAD_SOURCES = [
  { key: "inbound_rfq", label: "Inbound RFQ" },
  { key: "trade_show", label: "Trade Show" },
  { key: "referral", label: "Referral" },
  { key: "existing_customer_reorder", label: "Existing Customer Reorder" },
  { key: "cold_outreach", label: "Cold Outreach" },
  { key: "other", label: "Other" },
] as const;

const LEAD_SOURCE_META: Record<string, { detailLabel: string; placeholder: string }> = {
  inbound_rfq: { detailLabel: "RFQ REFERENCE", placeholder: "e.g. RFQ-2026-0042 via procurement portal" },
  trade_show: { detailLabel: "TRADE SHOW NAME & LINK", placeholder: "e.g. FDIC 2026, Chicago" },
  referral: { detailLabel: "REFERRED BY", placeholder: "e.g. John Smith, ABC Corp" },
  existing_customer_reorder: { detailLabel: "ORIGINAL ORDER REFERENCE", placeholder: "e.g. SO-2025-0188" },
  cold_outreach: { detailLabel: "OUTREACH CAMPAIGN / NOTES", placeholder: "e.g. LinkedIn sequence, Q1 campaign" },
  other: { detailLabel: "DETAILS", placeholder: "Add any relevant context" },
};

/* ═══ Team members for Assigned To ═══ */
const TEAM_MEMBERS = [
  { id: "sc", name: "Sarah Chen", initials: "SC", roles: ["Sales Manager", "Team Lead"] },
  { id: "jd", name: "James Donovan", initials: "JD", roles: ["Account Executive"] },
  { id: "mp", name: "Maria Perez", initials: "MP", roles: ["Sales Engineer"] },
  { id: "rk", name: "Raj Kumar", initials: "RK", roles: ["Business Development Rep"] },
  { id: "lw", name: "Lisa Wang", initials: "LW", roles: ["Senior Account Executive"] },
  { id: "th", name: "Tom Harris", initials: "TH", roles: ["Solutions Consultant"] },
  { id: "ab", name: "Angela Brooks", initials: "AB", roles: ["Sales Operations"] },
];

/* ═══ Default T&C ═══ */
const DEFAULT_TERMS = `1. Payment Terms: Net 30 days from date of invoice unless otherwise agreed in writing.
2. Delivery: Delivery dates are estimates only. Seller is not liable for delays.
3. Title & Risk: Title and risk of loss pass to Buyer upon delivery to carrier.
4. Warranty: Seller warrants products free from defects for 12 months from delivery.
5. Returns: Returns require prior written authorization (RMA) within 30 days of delivery.
6. Limitation of Liability: Seller's total liability shall not exceed the purchase price of the goods.
7. Force Majeure: Neither party shall be liable for delays caused by events beyond reasonable control.
8. Governing Law: This agreement shall be governed by the laws of the State of [State].`;

/* ═══ Mock uploaded docs ═══ */
interface UploadedDoc { id: string; name: string; size: string; date: string }
const MOCK_DOCS: UploadedDoc[] = [
  { id: "d1", name: "RFQ-MC-2025-001.pdf", size: "2.4 MB", date: "2025/11/20" },
];

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  DEAL INFORMATION TAB                                                      */
/* ═══════════════════════════════════════════════════════════════════════════ */

export function DealInformationTab({ so }: { so: SalesOrder }) {
  const store = useSOStore();
  

  /* ─── Source Quote ─── */
  // (display only — no editing)

  /* ─── RFQ/RFP ─── */
  const [rfqId, setRfqId] = useState(so.rfqRef || "");
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDoc[]>(MOCK_DOCS);
  const rfqFileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(f => {
      setUploadedDocs(prev => [...prev, {
        id: `d-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: f.name,
        size: f.size < 1024 * 1024 ? `${Math.round(f.size / 1024)} KB` : `${(f.size / (1024 * 1024)).toFixed(1)} MB`,
        date: new Date().toLocaleDateString("en-US", { year: "numeric", month: "2-digit", day: "2-digit" }),
      }]);
    });
    toast.success(`${files.length} file${files.length > 1 ? "s" : ""} uploaded`);
    if (e.target) e.target.value = "";
  }, []);

  const removeDoc = (docId: string) => {
    setUploadedDocs(prev => prev.filter(d => d.id !== docId));
    toast.info("Document removed");
  };

  /* ─── Tags ─── */
  const [tags, setTags] = useState<string[]>(so.tags.length > 0 ? so.tags : ["Engine Components", "Hydraulics"]);
  const [isEditingTags, setIsEditingTags] = useState(false);
  const [newTag, setNewTag] = useState("");

  /* ─── Notes ─── */
  const [externalNotes, setExternalNotes] = useState("Customer prefers email communication. Budget approved for Q1 2026. Follow up with procurement team by end of month regarding fleet discount eligibility.");
  const [internalNotes, setInternalNotes] = useState(so.internalNotes || "Spoke with CFO on Mar 3 — they have budget but need board sign-off. Competitor (FleetPro) quoted 8% lower but without conversion package. Push delivery timeline to lock commitment before Q2 review.");

  /* ─── Lead Source ─── */
  const [leadSources, setLeadSources] = useState<Array<{ key: string; detail: string }>>([
    { key: "inbound_rfq", detail: "RFQ-2026-0042 via procurement portal" },
  ]);
  const [showLeadDropdown, setShowLeadDropdown] = useState(false);
  const leadDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (leadDropdownRef.current && !leadDropdownRef.current.contains(e.target as Node)) setShowLeadDropdown(false);
    };
    if (showLeadDropdown) document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [showLeadDropdown]);

  /* ─── Competitive Situation ─── */
  const [competitiveSituation, setCompetitiveSituation] = useState("sole_source");

  /* ─── Follow-up ─── */
  const [followUpDate, setFollowUpDate] = useState("2026-03-01");
  const [assignedTo, setAssignedTo] = useState("Sarah Chen");
  const [nextAction, setNextAction] = useState("Call Sarah to discuss procurement timeline and confirm fleet specs");
  const [showAssignedDropdown, setShowAssignedDropdown] = useState(false);
  const assignedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (assignedRef.current && !assignedRef.current.contains(e.target as Node)) setShowAssignedDropdown(false);
    };
    if (showAssignedDropdown) document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [showAssignedDropdown]);

  /* ─── Terms & Conditions ─── */
  const [terms, setTerms] = useState(DEFAULT_TERMS);
  const [isEditingTerms, setIsEditingTerms] = useState(false);
  const isTermsModified = terms !== DEFAULT_TERMS;

  /* ─── Helpers ─── */
  const formatDate = (d: string) => {
    if (!d) return "—";
    try { const p = d.split("/"); return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }); }
    catch { return d; }
  };

  /* ─── Shared input styles (CSS variables) ─── */
  const inputCls = "bg-card border border-border rounded-md text-foreground outline-none transition-all focus:border-primary/40 focus:shadow-[0_0_0_2px_var(--primary)/0.12]";
  const inputStyle: React.CSSProperties = { ...T.captionNormal, padding: "0 12px", height: 32, width: "100%", boxSizing: "border-box" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

      {/* ═══ 1. Source Quote Reference ═══ */}
      <FieldCard>
        <CardHeader icon={<ExternalLink className="text-foreground/40" style={{ width: 14, height: 14 }} />} title="Source Quote Reference" />
        <CardDesc>
          This Sales Order was created from a Quote. The original reference and terms are carried over automatically.
        </CardDesc>
        <div className="flex items-end justify-between" style={{ marginTop: 12, gap: 16 }}>
          <HintRow icon={<Link2 className="shrink-0" style={{ width: 12, height: 12 }} />}>
            Linked to source quote — click to view original.
          </HintRow>
          <div className="shrink-0 flex items-center" style={{ gap: 24 }}>
            <div>
              <div className="text-foreground/30" style={T.micro}>QUOTE REF</div>
              {so.sourceQuoteRef ? (
                <button className="text-primary hover:underline bg-transparent border-none cursor-pointer p-0 text-left" style={{ ...T.title, marginTop: 4, whiteSpace: "nowrap" }}>
                  {so.sourceQuoteRef}
                </button>
              ) : (
                <span className="text-foreground/35 block" style={{ ...T.captionNormal, marginTop: 4 }}>No linked quote</span>
              )}
            </div>
            {so.rfqRef && (
              <div>
                <div className="text-foreground/30" style={T.micro}>RFQ/RFP REF</div>
                <span className="text-foreground block" style={{ ...T.caption, marginTop: 4, whiteSpace: "nowrap" }}>{so.rfqRef}</span>
              </div>
            )}
          </div>
        </div>
      </FieldCard>

      {/* ═══ 2. RFQ/RFP ID & Documents ═══ */}
      <FieldCard>
        <CardHeader icon={<FileText className="text-foreground/40" style={{ width: 14, height: 14 }} />} title="RFQ/RFP ID & Documents" />
        <CardDesc>
          Link this order to the customer's Request for Quotation or Proposal reference number and upload the original documents.
        </CardDesc>
        <div className="flex items-end justify-between" style={{ marginTop: 12, gap: 16 }}>
          <div className="flex-1 min-w-0">
            <HintRow icon={<Link2 className="shrink-0" style={{ width: 12, height: 12 }} />}>
              Linking an RFQ/RFP makes this order searchable by the customer's reference and auto-populates on exports.
            </HintRow>
          </div>
          <div className="shrink-0 flex items-center" style={{ gap: 8 }}>
            <div style={{ position: "relative" }}>
              <label className="text-foreground/50 absolute bg-card" style={{ top: -7, left: 9, fontSize: "var(--text-micro)", fontWeight: "var(--font-weight-medium)", padding: "0 3px", lineHeight: 1, zIndex: 1 }}>
                Enter RFQ/RFP ID
              </label>
              <input
                type="text"
                value={rfqId}
                onChange={e => setRfqId(e.target.value)}
                placeholder="e.g. RFQ-2026-0042"
                className={inputCls}
                style={{ ...inputStyle, width: 200 }}
              />
            </div>
            <input ref={rfqFileInputRef} type="file" multiple accept=".pdf,.doc,.docx,.xlsx,.xls,.csv,.png,.jpg,.jpeg" onChange={handleUpload} style={{ display: "none" }} />
            <button
              onClick={() => rfqFileInputRef.current?.click()}
              className="inline-flex items-center border border-border bg-card text-foreground/50 hover:bg-secondary hover:border-border transition-colors cursor-pointer"
              style={{ ...T.caption, gap: 5, height: 32, padding: "0 12px", borderRadius: 6, lineHeight: 1 }}
            >
              <Upload style={{ width: 13, height: 13 }} />
              Upload RFQ/RFP
            </button>
          </div>
        </div>

        {/* Uploaded docs */}
        {uploadedDocs.length > 0 && (
          <div className="flex flex-col" style={{ marginTop: 12, gap: 6 }}>
            <span className="text-foreground/50" style={T.micro}>
              Attached Documents ({uploadedDocs.length})
            </span>
            {uploadedDocs.map(doc => (
              <div
                key={doc.id}
                className="group/doc flex items-center justify-between bg-secondary/50 rounded-md border border-border hover:bg-secondary transition-colors"
                style={{ padding: "8px 12px" }}
              >
                <div className="flex items-center" style={{ gap: 10, minWidth: 0 }}>
                  <div className="flex items-center justify-center shrink-0 bg-destructive/10 rounded-md" style={{ width: 28, height: 28 }}>
                    <Paperclip className="text-destructive" style={{ width: 13, height: 13 }} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div className="text-foreground truncate" style={{ ...T.caption, maxWidth: 280 }}>{doc.name}</div>
                    <div className="text-foreground/40" style={{ fontSize: "var(--text-small)" }}>{doc.size} · {formatDate(doc.date)}</div>
                  </div>
                </div>
                <div className="flex items-center opacity-0 group-hover/doc:opacity-100 transition-opacity" style={{ gap: 4 }}>
                  <span className="text-primary border border-primary/30 bg-primary/5 rounded shrink-0" style={{ fontSize: "var(--text-micro)", fontWeight: "var(--font-weight-medium)", padding: "2px 6px", lineHeight: 1 }}>
                    Pre-Quote
                  </span>
                  <button className="rounded p-1 hover:bg-destructive/10 text-foreground/30 hover:text-destructive transition-colors" onClick={() => removeDoc(doc.id)}>
                    <Trash2 style={{ width: 13, height: 13 }} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </FieldCard>

      {/* ═══ 3. Tags ═══ */}
      <FieldCard>
        <CardHeader icon={<Tag className="text-foreground/40" style={{ width: 14, height: 14 }} />} title="Tags" />
        <CardDesc>
          Categorize this order with labels for filtering and reporting. Tags are shared across your organization and help group related orders by product line, department, or campaign.
        </CardDesc>
        <div className="flex items-end justify-between" style={{ marginTop: 12, gap: 16 }}>
          <div className="flex-1 min-w-0">
            <HintRow icon={<Layers className="shrink-0" style={{ width: 12, height: 12 }} />}>
              Used in list views, saved filters, and automated reports. Up to 5 tags per order.
            </HintRow>
          </div>
          <div className="shrink-0 flex items-center flex-wrap justify-end" style={{ gap: 6, maxWidth: 320, position: "relative" }}>
            {tags.length > 0 ? tags.map((tag, idx) => (
              <span
                key={idx}
                className="inline-flex items-center bg-secondary text-foreground/80"
                style={{ gap: 4, height: 26, padding: "0 10px", borderRadius: 5, ...T.caption, whiteSpace: "nowrap" }}
              >
                {tag}
                {isEditingTags && (
                  <button onClick={() => setTags(tags.filter((_, i) => i !== idx))} className="border-none bg-transparent cursor-pointer p-0 flex text-foreground/40 hover:text-destructive transition-colors">
                    <X style={{ width: 12, height: 12 }} />
                  </button>
                )}
              </span>
            )) : (
              <span className="text-foreground/40" style={T.captionNormal}>No tags</span>
            )}
            {!isEditingTags && (
              <button
                onClick={() => setIsEditingTags(true)}
                className="inline-flex items-center justify-center border border-dashed border-border text-foreground/40 hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-colors cursor-pointer bg-transparent"
                style={{ width: 26, height: 26, borderRadius: 5 }}
              >
                <Pencil style={{ width: 11, height: 11 }} />
              </button>
            )}

            {/* Tag editor popover */}
            {isEditingTags && (
              <>
                <div className="fixed inset-0" style={{ zIndex: 10 }} onClick={() => { setIsEditingTags(false); store.updateSO(so.id, { tags }); }} />
                <div
                  onClick={e => e.stopPropagation()}
                  className="absolute bg-card border border-border"
                  style={{ top: "calc(100% + 6px)", right: 0, width: 280, borderRadius: 8, boxShadow: "var(--elevation-sm)", zIndex: 20, padding: 10 }}
                >
                  <div className="flex items-center flex-wrap bg-secondary/50 rounded-md border border-border" style={{ padding: 6, gap: 4, minHeight: 34 }}>
                    {tags.map((tag, idx) => (
                      <div key={idx} className="flex items-center bg-secondary text-foreground/80 rounded" style={{ padding: "2px 8px", gap: 4, ...T.hint }}>
                        {tag}
                        <button onClick={() => setTags(tags.filter((_, i) => i !== idx))} className="border-none bg-transparent cursor-pointer p-0 flex text-foreground/40 hover:text-destructive">
                          <X style={{ width: 12, height: 12 }} />
                        </button>
                      </div>
                    ))}
                    <input
                      type="text"
                      placeholder={tags.length === 0 ? "Add tags..." : ""}
                      value={newTag}
                      onChange={e => setNewTag(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter" && newTag.trim() && tags.length < 5) { setTags([...tags, newTag.trim()]); setNewTag(""); }
                        else if (e.key === "Backspace" && newTag === "" && tags.length > 0) setTags(tags.slice(0, -1));
                      }}
                      autoFocus
                      className="flex-1 min-w-[80px] text-foreground border-none outline-none bg-transparent"
                      style={{ fontSize: "var(--text-caption)" }}
                    />
                  </div>
                  <div className="flex items-center justify-between" style={{ marginTop: 6, padding: "0 4px" }}>
                    <span className="text-foreground/40" style={T.hint}>Enter to add · {tags.length}/5</span>
                    <button
                      onClick={() => { setIsEditingTags(false); store.updateSO(so.id, { tags }); toast.success("Tags updated"); }}
                      className="text-primary hover:text-primary/80 border-none bg-transparent cursor-pointer"
                      style={{ ...T.hint, fontWeight: "var(--font-weight-medium)" }}
                    >
                      Done
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </FieldCard>

      {/* ═══ 4. Lead Source ═══ */}
      <FieldCard>
        <div className="flex items-end justify-between" style={{ gap: 16 }}>
          <div className="flex-1 min-w-0">
            <CardHeader icon={<Megaphone className="text-foreground/40" style={{ width: 14, height: 14 }} />} title="Lead Source" />
            <CardDesc>
              How this opportunity originated. Helps measure channel effectiveness and attribute pipeline revenue to the right acquisition channel.
            </CardDesc>
          </div>
          <div ref={leadDropdownRef} className="shrink-0" style={{ position: "relative", width: 240 }}>
            <button
              onClick={() => setShowLeadDropdown(!showLeadDropdown)}
              className="flex items-center justify-between w-full border border-border bg-card text-foreground/50 hover:border-border/80 cursor-pointer transition-colors"
              style={{ height: 32, padding: "0 12px", borderRadius: 6, ...T.captionNormal }}
            >
              <span className="flex items-center" style={{ gap: 6 }}>
                <Plus style={{ width: 13, height: 13 }} /> Add source...
              </span>
              <ChevronDown style={{ width: 13, height: 13, transition: "transform 150ms", transform: showLeadDropdown ? "rotate(180deg)" : "rotate(0deg)" }} />
            </button>
            {showLeadDropdown && (
              <div
                className="absolute bg-card border border-border overflow-hidden"
                style={{ top: "100%", left: 0, right: 0, marginTop: 4, borderRadius: 8, boxShadow: "var(--elevation-sm)", zIndex: 20 }}
              >
                {LEAD_SOURCES.filter(s => !leadSources.some(ls => ls.key === s.key)).length === 0 ? (
                  <div className="text-foreground/40 text-center" style={{ padding: "10px 12px", fontSize: "var(--text-caption)" }}>All sources added</div>
                ) : (
                  LEAD_SOURCES.filter(s => !leadSources.some(ls => ls.key === s.key)).map(src => (
                    <button
                      key={src.key}
                      onClick={() => { setLeadSources([...leadSources, { key: src.key, detail: "" }]); setShowLeadDropdown(false); }}
                      className="block w-full text-left text-foreground border-none bg-transparent cursor-pointer hover:bg-secondary transition-colors"
                      style={{ padding: "8px 12px", ...T.captionNormal }}
                    >
                      {src.label}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Lead source capsule cards */}
        <div className="flex flex-col" style={{ marginTop: 12, gap: 10 }}>
          {leadSources.length === 0 && (
            <div className="text-foreground/40 text-center border border-dashed border-border rounded-lg" style={{ padding: 12, ...T.captionNormal }}>
              No lead sources selected
            </div>
          )}
          {leadSources.map(ls => {
            const meta = LEAD_SOURCE_META[ls.key];
            const srcLabel = LEAD_SOURCES.find(s => s.key === ls.key)?.label || ls.key;
            return (
              <div key={ls.key} className="bg-secondary/50 border border-border rounded-lg" style={{ padding: "10px 12px" }}>
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center bg-primary/10 text-primary" style={{ height: 24, padding: "0 10px", borderRadius: 5, ...T.caption, whiteSpace: "nowrap" }}>
                    {srcLabel}
                  </span>
                  <button
                    onClick={() => setLeadSources(leadSources.filter(s => s.key !== ls.key))}
                    className="flex items-center justify-center text-foreground/40 hover:bg-destructive/10 hover:text-destructive transition-colors cursor-pointer border-none bg-transparent rounded"
                    style={{ width: 22, height: 22 }}
                  >
                    <X style={{ width: 12, height: 12 }} />
                  </button>
                </div>
                <div style={{ marginTop: 8 }}>
                  <label className="block text-foreground/50" style={{ ...T.micro, marginBottom: 4 }}>
                    {meta.detailLabel}
                  </label>
                  <input
                    type="text"
                    value={ls.detail}
                    onChange={e => setLeadSources(leadSources.map(s => s.key === ls.key ? { ...s, detail: e.target.value } : s))}
                    placeholder={meta.placeholder}
                    className={inputCls}
                    style={inputStyle}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </FieldCard>

      {/* ═══ 5. External Notes ═══ */}
      <FieldCard>
        <CardHeader
          icon={<StickyNote className="text-foreground/50" style={{ width: 14, height: 14 }} />}
          title="External Notes"
        />
        <CardDesc>
          Customer-facing notes that will appear on the generated quote PDF — special terms, clarifications, or any context the customer should see alongside the line items.
        </CardDesc>
        <div style={{ marginTop: 12 }}>
          <textarea
            value={externalNotes}
            onChange={e => setExternalNotes(e.target.value)}
            placeholder="Add notes to include in the quote..."
            rows={3}
            className={`w-full ${inputCls}`}
            style={{ ...T.captionNormal, padding: "10px 12px", lineHeight: 1.6, resize: "vertical", minHeight: 72, boxSizing: "border-box" }}
          />
        </div>
      </FieldCard>

      {/* ═══ 6. Internal Notes ═══ */}
      <FieldCard>
        <CardHeader
          icon={<Lock className="text-foreground/50" style={{ width: 14, height: 14 }} />}
          title="Internal Notes"
          badge={
            <span className="text-foreground/50 bg-secondary rounded" style={{ fontSize: "var(--text-micro)", fontWeight: "var(--font-weight-semibold)", padding: "2px 6px", letterSpacing: "0.5px", textTransform: "uppercase" }}>
              Team Only
            </span>
          }
        />
        <CardDesc>
          Private notes visible only to your team — strategy, negotiation context, competitor intel, or follow-up reminders. Never included in customer-facing documents.
        </CardDesc>
        <div style={{ marginTop: 12 }}>
          <textarea
            value={internalNotes}
            onChange={e => setInternalNotes(e.target.value)}
            placeholder="Add private team notes — strategy, context, reminders..."
            rows={3}
            className={`w-full ${inputCls}`}
            style={{ ...T.captionNormal, padding: "10px 12px", lineHeight: 1.6, resize: "vertical", minHeight: 72, boxSizing: "border-box" }}
          />
        </div>
      </FieldCard>

      {/* ═══ 7. Competitive Situation ═══ */}
      <FieldCard>
        <div className="flex items-end justify-between" style={{ gap: 16 }}>
          <div className="flex-1 min-w-0">
            <CardHeader icon={<Swords className="text-foreground/40" style={{ width: 14, height: 14 }} />} title="Competitive Situation" />
            <CardDesc>
              Classify the competitive landscape for this deal. Impacts sales strategy and helps forecast win rates by deal type.
            </CardDesc>
          </div>
          <div className="shrink-0" style={{ position: "relative", width: 220 }}>
            <select
              value={competitiveSituation}
              onChange={e => setCompetitiveSituation(e.target.value)}
              className={inputCls}
              style={{ ...inputStyle, width: 220, appearance: "none", WebkitAppearance: "none", cursor: "pointer", paddingRight: 36 }}
            >
              {COMPETITIVE_OPTIONS.map(opt => (
                <option key={opt.key} value={opt.key}>{opt.label}</option>
              ))}
            </select>
            <ChevronDown className="text-foreground/40 pointer-events-none absolute" style={{ right: 10, top: "50%", transform: "translateY(-50%)", width: 14, height: 14 }} />
          </div>
        </div>
      </FieldCard>

      {/* ═══ 8. Follow-up Date / Next Action ═══ */}
      <FieldCard>
        <CardHeader icon={<CalendarCheck className="text-foreground/40" style={{ width: 14, height: 14 }} />} title="Follow-up Date / Next Action" />
        <CardDesc>
          Schedule the next follow-up and describe what needs to happen. Shows on your dashboard reminders and team calendar.
        </CardDesc>
        <div className="bg-secondary/50 border border-border rounded-lg" style={{ marginTop: 12, padding: 12 }}>
          {/* Date + Assigned To row */}
          <div className="grid grid-cols-2" style={{ gap: 12 }}>
            <div>
              <label className="block text-foreground/50" style={{ ...T.micro, marginBottom: 4 }}>Follow-up Date</label>
              <input
                type="date"
                value={followUpDate}
                onChange={e => setFollowUpDate(e.target.value)}
                className={inputCls}
                style={{ ...inputStyle, cursor: "pointer" }}
              />
            </div>
            <div ref={assignedRef} style={{ position: "relative" }}>
              <label className="block text-foreground/50" style={{ ...T.micro, marginBottom: 4 }}>Assigned To</label>
              <button
                onClick={() => setShowAssignedDropdown(!showAssignedDropdown)}
                className={`flex items-center w-full border border-border bg-card text-left cursor-pointer transition-colors rounded-md`}
                style={{ height: 32, padding: "0 12px", gap: 8, ...T.captionNormal }}
              >
                <User className="text-foreground/40 shrink-0" style={{ width: 13, height: 13 }} />
                <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-foreground" style={{ fontWeight: assignedTo ? "var(--font-weight-medium)" : "var(--font-weight-normal)" }}>
                  {assignedTo || "Select team member..."}
                </span>
                <ChevronDown className="text-foreground/40 shrink-0" style={{ width: 13, height: 13, transition: "transform 150ms", transform: showAssignedDropdown ? "rotate(180deg)" : "rotate(0deg)" }} />
              </button>
              {showAssignedDropdown && (
                <div
                  className="absolute bg-card border border-border overflow-hidden overflow-y-auto"
                  style={{ bottom: "100%", left: 0, right: 0, marginBottom: 4, borderRadius: 8, boxShadow: "var(--elevation-sm)", zIndex: 20, maxHeight: 240 }}
                >
                  {TEAM_MEMBERS.map(member => {
                    const isSelected = assignedTo === member.name;
                    return (
                      <button
                        key={member.id}
                        onClick={() => { setAssignedTo(member.name); setShowAssignedDropdown(false); }}
                        className={`flex items-center w-full text-left border-none cursor-pointer transition-colors ${isSelected ? "bg-primary/5" : "bg-transparent hover:bg-secondary"}`}
                        style={{ padding: "8px 12px", gap: 10, ...T.captionNormal }}
                      >
                        <div
                          className={`flex items-center justify-center shrink-0 rounded-full ${isSelected ? "bg-primary text-primary-foreground" : "bg-border text-foreground/50"}`}
                          style={{ width: 26, height: 26, fontSize: "var(--text-micro)", fontWeight: "var(--font-weight-semibold)", letterSpacing: "0.3px" }}
                        >
                          {member.initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-foreground truncate" style={{ fontSize: "var(--text-caption)", fontWeight: isSelected ? "var(--font-weight-semibold)" : "var(--font-weight-normal)" }}>
                            {member.name}
                          </div>
                          <div className="text-foreground/40 truncate" style={{ fontSize: "var(--text-small)", marginTop: 1 }}>
                            {member.roles.join(" · ")}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          {/* Next Action */}
          <div style={{ marginTop: 10 }}>
            <label className="block text-foreground/50" style={{ ...T.micro, marginBottom: 4 }}>Next Action</label>
            <input
              type="text"
              value={nextAction}
              onChange={e => setNextAction(e.target.value)}
              placeholder="e.g. Call Sarah March 1 to discuss procurement timeline"
              className={inputCls}
              style={inputStyle}
            />
          </div>
        </div>
      </FieldCard>

    </div>
  );
}