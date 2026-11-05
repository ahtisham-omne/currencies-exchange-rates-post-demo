import { useState, useRef, useEffect, useCallback } from "react";
import { useSOStore } from "./store";
import {
  Pencil, Check, X, Plus, ChevronDown, User,
  ExternalLink, Tag, FileText, StickyNote, Link2, Upload,
  Paperclip, Trash2, Megaphone, Swords, CalendarCheck,
  Layers, Lock, RotateCcw, Scale, ChevronLeft, ChevronRight,
} from "lucide-react";
import type { SalesOrder } from "./types";
import { toast } from "sonner";
import { TitledSection } from "@/app/components/shared/TitledSection";
import { AttachmentCard } from "@/app/components/shared/attachments/attachment-card";
import { EmptyPlaceholder } from "@/app/components/shared/EmptyPlaceholder";
/* Attach-link chip / picker imports are preserved for the future when
   the per-note link-attach affordance is reintroduced. See the
   commented-out blocks further down for the previous implementation.
   For now the Links section is a plain textarea (External Links) and
   no note surface renders a link picker. */
// import { AttachedLinkChip } from "@/app/components/shared/AttachedLinkChip";
// import { LinkPickerPopover } from "@/app/components/shared/LinkPickerPopover";
// import { AddExternalLinkModal } from "@/app/components/shared/AddExternalLinkModal";
import {
  // getLinksForId,
  // addLinkForId,
  // removeLinkForId,
  subscribeToLinksRepository,
  getExternalLinksText,
  setExternalLinksText,
  // type ExternalLink as RepositoryLink,
} from "@/app/data/linksRepository";
import {
  getPreSoDocs,
  addPreSoDoc,
  removePreSoDoc,
  subscribePreSoDocs,
  type PreSoDocument,
} from "./preSoDocsStore";

/* ═══ Typography tokens — CSS variables only ═══ */
const T = {
  title: { fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties,
  desc: { fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-normal)", lineHeight: 1.5 } as React.CSSProperties,
  hint: { fontSize: "var(--text-small)", fontWeight: "var(--font-weight-normal)", lineHeight: 1.4 } as React.CSSProperties,
  /* Section/value micro-label — partner-aligned: regular case, no letter-spacing,
   * semibold for emphasis. (Was previously all-caps with letter-spacing.) */
  micro: { fontSize: "var(--text-micro)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties,
  caption: { fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties,
  captionNormal: { fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-normal)" } as React.CSSProperties,
};

/* ─── Card description ─── Mirrors Quote OverviewTab's `descStyle`
 *   verbatim (13px / 400 / slate-600 / lineHeight 1.55 / marginTop 2px)
 *   so both modules read as the same body copy. */
function CardDesc({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 13, fontWeight: 400, color: "#475569", lineHeight: 1.55, marginTop: 2 }}>
      {children}
    </div>
  );
}

/* ─── RFQ/RFP attachment carousel — horizontal scroll of attachment cards ─── */
function RfqCarousel({ docs, formatDate, onRemove }: { docs: { id: string; name: string; size: string; date: string }[]; formatDate: (d: string) => string; onRemove: (id: string) => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollBy = (dir: 1 | -1) => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: dir * 240, behavior: "smooth" });
  };

  const inferType = (name: string) => {
    const ext = (name.split(".").pop() || "").toLowerCase();
    if (["pdf", "xlsx", "csv", "docx", "png", "jpg"].includes(ext)) return ext;
    return "pdf";
  };

  return (
    <div style={{ marginTop: 12 }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
        <span className="text-foreground/50" style={{ fontSize: "var(--text-micro)", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>
          Attached Documents ({docs.length})
        </span>
        {docs.length > 3 && (
          <div className="flex items-center" style={{ gap: 4 }}>
            <button
              onClick={() => scrollBy(-1)}
              className="rounded-md border border-border bg-card hover:bg-secondary"
              style={{ width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
              aria-label="Scroll left"
            >
              <ChevronLeft className="w-3.5 h-3.5" style={{ color: "var(--text-secondary)" }} />
            </button>
            <button
              onClick={() => scrollBy(1)}
              className="rounded-md border border-border bg-card hover:bg-secondary"
              style={{ width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
              aria-label="Scroll right"
            >
              <ChevronRight className="w-3.5 h-3.5" style={{ color: "var(--text-secondary)" }} />
            </button>
          </div>
        )}
      </div>
      <div
        ref={scrollRef}
        style={{
          display: "flex",
          gap: 12,
          overflowX: "auto",
          paddingBottom: 4,
          scrollSnapType: "x mandatory",
          scrollbarWidth: "thin",
        }}
      >
        {docs.map((doc) => (
          <div key={doc.id} style={{ flex: "0 0 220px", scrollSnapAlign: "start" }}>
            <AttachmentCard
              compact
              att={{
                fileName: doc.name,
                fileType: inferType(doc.name),
                fileSize: doc.size,
                uploadedDate: formatDate(doc.date),
                uploadedTime: "",
                uploadedBy: "You",
              }}
              pills={
                <span
                  className="inline-flex items-center"
                  style={{
                    padding: "1px 6px",
                    borderRadius: 9999,
                    background: "var(--reason-tag-bg)",
                    border: "1px solid var(--reason-tag-border)",
                    color: "var(--reason-tag-text)",
                    fontWeight: 500,
                    fontSize: 9,
                    gap: 3,
                    whiteSpace: "nowrap",
                    backdropFilter: "blur(4px)",
                  }}
                >
                  RFQ/RFP
                </span>
              }
              onPreview={() => toast.info(`Preview: ${doc.name}`)}
              onDownload={() => toast.info(`Downloading ${doc.name}...`)}
              onCardClick={() => toast.info(`Preview: ${doc.name}`)}
              onDelete={() => onRemove(doc.id)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Bottom hint row ─── */
/* HintRow — mirrors Quote OverviewTab's `hintStyle`:
 *   12px italic slate-400 anchored to the card bottom by a dashed
 *   hairline (`borderTop: 1px dashed #E2E8F0`). Italic + separator
 *   make the aside visually distinct from the plain-paragraph
 *   description above without adding container chrome that read as
 *   a "highlighted callout". */
function HintRow({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div
      className="flex items-start"
      style={{
        gap: 6,
        marginTop: 12,
        paddingTop: 10,
        borderTop: "1px dashed #E2E8F0",
        fontSize: 12,
        fontWeight: 400,
        fontStyle: "italic",
        color: "#94A3B8",
        lineHeight: 1.5,
      }}
    >
      <span className="shrink-0 inline-flex items-center justify-center" style={{ marginTop: 2 }}>
        {icon}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>{children}</span>
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

/* ═══ Uploaded docs surface, backed by `preSoDocsStore` so the AttachmentsTab
 *    sees the same files. The local UploadedDoc shape stays unchanged so the
 *    surrounding carousel/markup keeps working — it's a lightweight projection
 *    of the shared PreSoDocument record. */
interface UploadedDoc { id: string; name: string; size: string; date: string }

function preSoDocToUploaded(d: PreSoDocument): UploadedDoc {
  return { id: d.id, name: d.name, size: d.size, date: d.uploadedAt };
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  DEAL INFORMATION TAB                                                      */
/* ═══════════════════════════════════════════════════════════════════════════ */

export function DealInformationTab({ so, createdViaUI = false }: { so: SalesOrder; createdViaUI?: boolean }) {
  const store = useSOStore();

  /* ─── Source Quote ─── */
  // (display only — no editing)

  /* ─── RFQ/RFP ─── */
  const [rfqId, setRfqId] = useState(so.rfqRef || "");
  // Pre-SO docs are persisted in the shared `preSoDocsStore` so the
  // AttachmentsTab sees the same files. Keyed by the SO id so each SO
  // has its own list.
  const soKey = so.id;
  const [preSoDocs, setPreSoDocsState] = useState<PreSoDocument[]>(() => getPreSoDocs(soKey));
  const uploadedDocs: UploadedDoc[] = preSoDocs.map(preSoDocToUploaded);
  const rfqFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPreSoDocsState(getPreSoDocs(soKey));
    const unsub = subscribePreSoDocs(soKey, () => {
      setPreSoDocsState(getPreSoDocs(soKey));
    });
    return unsub;
  }, [soKey]);

  const handleUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const ext = (name: string) => name.split(".").pop()?.toLowerCase() || "pdf";
    Array.from(files).forEach(f => {
      const doc: PreSoDocument = {
        id: `pso-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: f.name,
        size: f.size < 1024 * 1024 ? `${Math.round(f.size / 1024)} KB` : `${(f.size / (1024 * 1024)).toFixed(1)} MB`,
        type: ext(f.name),
        uploadedBy: "You",
        uploadedAt: new Date().toLocaleDateString("en-US", { year: "numeric", month: "2-digit", day: "2-digit" }),
      };
      addPreSoDoc(soKey, doc);
    });
    toast.success(`${files.length} file${files.length > 1 ? "s" : ""} uploaded`, {
      description: "Also visible in Attachments, RFQ/RFP folder.",
    });
    if (e.target) e.target.value = "";
  }, [soKey]);

  const removeDoc = (docId: string) => {
    removePreSoDoc(soKey, docId);
    toast.info("Document removed");
  };

  /* ─── Tags ───
     Newly-created SOs start with no tag seed so the chips row renders
     in its own empty state and the user fills it directly. */
  const [tags, setTags] = useState<string[]>(
    createdViaUI
      ? (so.tags ?? [])
      : (so.tags.length > 0 ? so.tags : ["Engine Components", "Hydraulics"])
  );

  /* ─── Notes ───
     Both textareas start empty for newly-created SOs. */
  const [externalNotes, setExternalNotes] = useState(
    createdViaUI
      ? ""
      : "Customer prefers email communication. Budget approved for Q1 2026. Follow up with procurement team by end of month regarding fleet discount eligibility."
  );
  const [internalNotes, setInternalNotes] = useState(
    createdViaUI
      ? (so.internalNotes || "")
      : (so.internalNotes || "Spoke with CFO on Mar 3 — they have budget but need board sign-off. Competitor (FleetPro) quoted 8% lower but without conversion package. Push delivery timeline to lock commitment before Q2 review.")
  );

  /* Attach-link plumbing (per-note picker + chip repository) is
     currently disabled. State + helpers are kept in case we re-enable
     it later — see the commented render blocks further down. */
  // const [externalNoteLinkIds, setExternalNoteLinkIds] = useState<string[]>([]);
  // const [showExternalNoteLinkPicker, setShowExternalNoteLinkPicker] = useState(false);
  // const [externalLinkPickerAnchor, setExternalLinkPickerAnchor] = useState<HTMLButtonElement | null>(null);
  // const [internalNoteLinkIds, setInternalNoteLinkIds] = useState<string[]>([]);
  // const [showInternalNoteLinkPicker, setShowInternalNoteLinkPicker] = useState(false);
  // const [internalLinkPickerAnchor, setInternalLinkPickerAnchor] = useState<HTMLButtonElement | null>(null);
  // const [showAddLinkModal, setShowAddLinkModal] = useState(false);

  /* ─── External Links textarea ───
     Deal-Info's Links section is now a single multi-line textarea.
     One URL per line, no descriptions or metadata. Downstream PDF
     surfaces read the list plain (no `[N]` markers) so the sales rep
     inlines a URL in their description when they want to reference
     one specifically. */
  const [linksRepoVersion, setLinksRepoVersion] = useState(0);
  useEffect(() => subscribeToLinksRepository(() => setLinksRepoVersion((v) => v + 1)), []);
  void linksRepoVersion;
  const [externalLinksText, setExternalLinksTextLocal] = useState<string>(() => getExternalLinksText(soKey));
  useEffect(() => { setExternalLinksTextLocal(getExternalLinksText(soKey)); }, [soKey]);

  /* ─── Lead Source ───
     Newly-created SOs start with no lead source captured so the picker
     opens cleanly. */
  const [leadSources, setLeadSources] = useState<Array<{ key: string; detail: string }>>(
    createdViaUI ? [] : [{ key: "inbound_rfq", detail: "RFQ-2026-0042 via procurement portal" }]
  );
  const [showLeadDropdown, setShowLeadDropdown] = useState(false);
  const leadDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (leadDropdownRef.current && !leadDropdownRef.current.contains(e.target as Node)) setShowLeadDropdown(false);
    };
    if (showLeadDropdown) document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [showLeadDropdown]);

  /* ─── Competitive Situation ───
     Newly-created SOs default to "none" so the user makes an explicit
     pick rather than inheriting a seeded sole-source label. */
  const [competitiveSituation, setCompetitiveSituation] = useState(
    createdViaUI ? "none" : "sole_source"
  );

  /* ─── Follow-up ───
     Newly-created SOs start with no follow-up date / assignee / action. */
  const [followUpDate, setFollowUpDate] = useState(createdViaUI ? "" : "2026-03-01");
  const [assignedTo, setAssignedTo] = useState(createdViaUI ? "" : "Sarah Chen");
  const [nextAction, setNextAction] = useState(
    createdViaUI ? "" : "Call Sarah to discuss procurement timeline and confirm fleet specs"
  );
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

  /* For newly-created SOs every card renders in its own empty state so
     the user can fill them directly. The whole-tab placeholder was
     dropped in favour of per-card empty defaults (see initializers
     above which now branch on `createdViaUI`). */

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

      {/* ═══ 1. Source Quote Reference ═══
         RFQ/RFP Ref intentionally removed here — it has its own card
         immediately below ("RFQ/RFP ID & Documents") and showing the
         same id twice on the same screen was duplicative.
         Two render paths:
           • Linked  — Partners-tinted reference button with subtle blue
                       tile + quote ref + hover ExternalLink icon.
           • Empty   — Partners empty-state pattern (centered icon +
                       muted message, no fake "Link a quote" CTA since
                       the link is set at SO-creation time and isn't
                       editable from this card today). */}
      <TitledSection title="Source Quote Reference" icon={ExternalLink} bodyClassName="px-4 py-3">
        {so.sourceQuoteRef ? (
          <>
            <CardDesc>
              This Sales Order was created from a Quote. The original reference and terms are carried over automatically.
            </CardDesc>
            <div className="flex items-center justify-between" style={{ marginTop: 12, gap: 16, flexWrap: "wrap" }}>
              <HintRow icon={<Link2 className="shrink-0" style={{ width: 12, height: 12 }} />}>
                Linked to source quote — click to view original.
              </HintRow>
              <button
                type="button"
                title={`Open ${so.sourceQuoteRef}`}
                className="group inline-flex items-center gap-2 rounded-lg border transition-colors cursor-pointer"
                style={{
                  height: 36,
                  padding: "0 12px",
                  backgroundColor: "#EFF6FF",
                  borderColor: "#BFDBFE",
                  color: "#1E40AF",
                  fontFamily: "Inter, system-ui, sans-serif",
                  fontWeight: 600,
                  fontSize: 13,
                  lineHeight: 1,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#DBEAFE"; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#EFF6FF"; }}
              >
                <span
                  className="inline-flex items-center justify-center rounded-md"
                  style={{ width: 20, height: 20, backgroundColor: "#DBEAFE" }}
                >
                  <FileText style={{ width: 12, height: 12, color: "#1E40AF" }} />
                </span>
                <span className="tabular-nums">{so.sourceQuoteRef}</span>
                <ExternalLink style={{ width: 13, height: 13, opacity: 0.7 }} />
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center text-muted-foreground" style={{ gap: 8, padding: "28px 16px" }}>
            <div
              className="rounded-full flex items-center justify-center"
              style={{ width: 36, height: 36, backgroundColor: "var(--muted)" }}
            >
              <Link2 style={{ width: 16, height: 16, opacity: 0.8 }} />
            </div>
            <div className="text-foreground" style={{ ...T.caption, marginTop: 2 }}>
              No linked quote
            </div>
            <div className="text-center" style={{ ...T.captionNormal, color: "var(--muted-foreground)", maxWidth: 380, lineHeight: 1.5 }}>
              This Sales Order was created directly. Reference and terms were captured on this order rather than carried over from a quote.
            </div>
          </div>
        )}
      </TitledSection>

      {/* ═══ 2. RFQ/RFP ID & Documents ═══ */}
      <TitledSection title="RFQ/RFP ID & Documents" icon={FileText} bodyClassName="px-4 py-3">
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

        {/* Uploaded docs — horizontal carousel of attachment cards */}
        {uploadedDocs.length > 0 && (
          <RfqCarousel docs={uploadedDocs} formatDate={formatDate} onRemove={removeDoc} />
        )}
      </TitledSection>

      {/* Tags moved to the sidebar's order information card, with the other
          created facts. */}

      {/* ═══ 4. Lead Source ═══ */}
      <TitledSection
        title="Lead Source"
        icon={Megaphone}
        bodyClassName="px-4 py-3"
        trailing={
          <div ref={leadDropdownRef} className="shrink-0" style={{ position: "relative", width: 200 }}>
            <button
              onClick={() => setShowLeadDropdown(!showLeadDropdown)}
              className="flex items-center justify-between w-full border border-border bg-card text-foreground/50 hover:border-border/80 cursor-pointer transition-colors"
              style={{ height: 28, padding: "0 10px", borderRadius: 6, ...T.captionNormal }}
            >
              <span className="flex items-center" style={{ gap: 6 }}>
                <Plus style={{ width: 12, height: 12 }} /> Add source...
              </span>
              <ChevronDown style={{ width: 12, height: 12, transition: "transform 150ms", transform: showLeadDropdown ? "rotate(180deg)" : "rotate(0deg)" }} />
            </button>
            {showLeadDropdown && (
              <div
                className="absolute bg-card border border-border overflow-hidden"
                style={{ top: "100%", left: 0, right: 0, marginTop: 4, borderRadius: 8, boxShadow: "var(--elevation-sm)", zIndex: 20 }}
              >
                {LEAD_SOURCES.filter(s => !leadSources.some(ls => ls.key === s.key)).length === 0 ? (
                  <div className="text-muted-foreground text-center" style={{ padding: "10px 12px", fontSize: "var(--text-caption)" }}>All sources added</div>
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
        }
      >
        <CardDesc>
          How this opportunity originated. Helps measure channel effectiveness and attribute pipeline revenue to the right acquisition channel.
        </CardDesc>

        {/* Lead source capsule cards */}
        <div className="flex flex-col" style={{ marginTop: 12, gap: 10 }}>
          {leadSources.length === 0 && (
            <div className="text-muted-foreground text-center border border-dashed border-border rounded-lg" style={{ padding: 12, ...T.captionNormal }}>
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
                    className="flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors cursor-pointer border-none bg-transparent rounded"
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
      </TitledSection>

      {/* ═══ 5. External Notes ═══ */}
      <TitledSection title="External Notes" icon={StickyNote} bodyClassName="px-4 py-3">
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
          {/* Attach-link affordance disabled — keep the chip render +
              picker code here as a commented block so we can reintroduce
              the per-note attach flow later without re-deriving it.
              <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
                {externalNoteLinks.map((link) => (
                  <AttachedLinkChip
                    key={link.id}
                    link={link}
                    onRemove={() => setExternalNoteLinkIds((prev) => prev.filter((id) => id !== link.id))}
                  />
                ))}
                <button
                  ref={setExternalLinkPickerAnchor}
                  type="button"
                  onClick={() => setShowExternalNoteLinkPicker((v) => !v)}
                  className="inline-flex items-center gap-1 rounded-full hover:bg-slate-50 transition-colors"
                  style={{
                    padding: "2px 10px", border: "1px dashed var(--border)", background: "var(--card)",
                    color: "var(--muted-foreground)", fontSize: 11.5, fontWeight: 500, cursor: "pointer",
                  }}
                >
                  <Link2 style={{ width: 11, height: 11 }} />
                  Attach a link
                </button>
                {showExternalNoteLinkPicker && (
                  <LinkPickerPopover
                    anchor={externalLinkPickerAnchor}
                    docId={soKey}
                    attachedIds={externalNoteLinkIds}
                    currentUser={assignedTo || "Sarah Chen"}
                    onPick={(link) => {
                      setExternalNoteLinkIds((prev) => (prev.includes(link.id) ? prev : [...prev, link.id]));
                      setShowExternalNoteLinkPicker(false);
                    }}
                    onClose={() => setShowExternalNoteLinkPicker(false)}
                  />
                )}
              </div>
          */}
        </div>
      </TitledSection>

      {/* ═══ 6. External Links ═══ */}
      <TitledSection title="External Links" icon={Link2} bodyClassName="px-4 py-3">
        <CardDesc>
          Paste any URLs relevant to this sales order — one link per line.
          The list is repeated in the References section of the sales-order
          PDF so the customer can open them; reference a specific URL from a
          line-item description if you want to point at it directly.
        </CardDesc>
        <div style={{ marginTop: 12 }}>
          <textarea
            value={externalLinksText}
            onChange={(e) => { setExternalLinksTextLocal(e.target.value); setExternalLinksText(soKey, e.target.value); }}
            placeholder={"https://docs.example.com/agreements/mpa-2026\nhttps://sharepoint.example.com/safety/nfpa1917"}
            rows={4}
            className={`w-full ${inputCls}`}
            style={{ ...T.captionNormal, padding: "10px 12px", lineHeight: 1.6, resize: "vertical", minHeight: 96, boxSizing: "border-box", fontFamily: "inherit" }}
          />
        </div>
        {/* Previous chip-based Links section preserved as a commented
            block so we can reintroduce the "individually managed links"
            UX later without re-deriving it.
            <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
              {repoLinks.map((link) => (
                <AttachedLinkChip
                  key={link.id}
                  link={link}
                  onRemove={() => removeLinkForId(soKey, link.id)}
                />
              ))}
              <button
                type="button"
                onClick={() => setShowAddLinkModal(true)}
                className="inline-flex items-center gap-1 rounded-full hover:bg-slate-50 transition-colors"
                style={{ padding: "2px 10px", border: "1px dashed var(--border)", background: "var(--card)",
                  color: "var(--muted-foreground)", fontSize: 11.5, fontWeight: 500, cursor: "pointer" }}
              >
                <Plus style={{ width: 11, height: 11 }} />
                Add link
              </button>
            </div>
            <AddExternalLinkModal
              open={showAddLinkModal}
              onClose={() => setShowAddLinkModal(false)}
              onAdd={(label, url) => {
                addLinkForId(soKey, { label, url, addedBy: assignedTo || "Sarah Chen" });
                setShowAddLinkModal(false);
              }}
              title="Add link"
              confirmLabel="Add link"
            />
        */}
      </TitledSection>

      {/* ═══ 7. Internal Notes ═══ */}
      <TitledSection
        title="Internal Notes"
        icon={Lock}
        bodyClassName="px-4 py-3"
        trailing={
          <span className="text-foreground/50 bg-secondary rounded" style={{ fontSize: "var(--text-micro)", fontWeight: "var(--font-weight-semibold)", padding: "2px 6px", letterSpacing: "0.5px", textTransform: "uppercase" }}>
            Team Only
          </span>
        }
      >
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
          {/* Attach-link affordance disabled — keep the chip render +
              picker code here as a commented block for a future restore.
              <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
                {internalNoteLinks.map((link) => (
                  <AttachedLinkChip
                    key={link.id}
                    link={link}
                    onRemove={() => setInternalNoteLinkIds((prev) => prev.filter((id) => id !== link.id))}
                  />
                ))}
                <button
                  ref={setInternalLinkPickerAnchor}
                  type="button"
                  onClick={() => setShowInternalNoteLinkPicker((v) => !v)}
                  className="inline-flex items-center gap-1 rounded-full hover:bg-slate-50 transition-colors"
                  style={{
                    padding: "2px 10px", border: "1px dashed var(--border)", background: "var(--card)",
                    color: "var(--muted-foreground)", fontSize: 11.5, fontWeight: 500, cursor: "pointer",
                  }}
                >
                  <Link2 style={{ width: 11, height: 11 }} />
                  Attach a link
                </button>
                {showInternalNoteLinkPicker && (
                  <LinkPickerPopover
                    anchor={internalLinkPickerAnchor}
                    docId={soKey}
                    attachedIds={internalNoteLinkIds}
                    currentUser={assignedTo || "Sarah Chen"}
                    onPick={(link) => {
                      setInternalNoteLinkIds((prev) => (prev.includes(link.id) ? prev : [...prev, link.id]));
                      setShowInternalNoteLinkPicker(false);
                    }}
                    onClose={() => setShowInternalNoteLinkPicker(false)}
                  />
                )}
              </div>
          */}
        </div>
      </TitledSection>

      {/* ═══ 8. Competitive Situation ═══
         Refactored to Quote OverviewTab's `FieldCard` pattern: title
         + icon in the header, description in the body, dropdown
         anchored at the bottom-right of the body via `editableRow`
         (dashed hairline separator, right-justified). Previously the
         dropdown floated in `TitledSection`'s `trailing` slot next
         to the title, which read as "solo dropdown at an odd
         place". */}
      <TitledSection title="Competitive Situation" icon={Swords} bodyClassName="px-4 py-3">
        <CardDesc>
          Classify the competitive landscape for this deal. Impacts sales strategy and helps forecast win rates by deal type.
        </CardDesc>
        <div
          style={{
            display: "flex", justifyContent: "flex-end",
            marginTop: 12, paddingTop: 10, borderTop: "1px dashed #E2E8F0",
          }}
        >
          <div style={{ position: "relative", width: 220 }}>
            <select
              value={competitiveSituation}
              onChange={e => setCompetitiveSituation(e.target.value)}
              style={{
                width: "100%", height: 36, padding: "0 36px 0 12px",
                fontSize: 13, fontWeight: 500, color: "var(--foreground)",
                border: "1px solid var(--border)", borderRadius: 8,
                outline: "none", backgroundColor: "#FFFFFF",
                fontFamily: "Inter, system-ui, sans-serif",
                boxSizing: "border-box",
                appearance: "none", WebkitAppearance: "none",
                cursor: "pointer",
                transition: "border-color 150ms, box-shadow 150ms",
              }}
              onFocus={e => { e.currentTarget.style.borderColor = "#0A77FF"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(10, 119, 255, 0.12)"; }}
              onBlur={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = "none"; }}
            >
              {COMPETITIVE_OPTIONS.map(opt => (
                <option key={opt.key} value={opt.key}>{opt.label}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute" style={{ right: 10, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, color: "var(--muted-foreground)" }} />
          </div>
        </div>
      </TitledSection>

      {/* ═══ 9. Follow-up Date / Next Action ═══ */}
      <TitledSection title="Follow-up Date / Next Action" icon={CalendarCheck} bodyClassName="px-4 py-3">
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
                <User className="text-muted-foreground shrink-0" style={{ width: 13, height: 13 }} />
                <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-foreground" style={{ fontWeight: assignedTo ? "var(--font-weight-medium)" : "var(--font-weight-normal)" }}>
                  {assignedTo || "Select team member..."}
                </span>
                <ChevronDown className="text-muted-foreground shrink-0" style={{ width: 13, height: 13, transition: "transform 150ms", transform: showAssignedDropdown ? "rotate(180deg)" : "rotate(0deg)" }} />
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
                          <div className="text-muted-foreground truncate" style={{ fontSize: "var(--text-small)", marginTop: 1 }}>
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
      </TitledSection>

    </div>
  );
}