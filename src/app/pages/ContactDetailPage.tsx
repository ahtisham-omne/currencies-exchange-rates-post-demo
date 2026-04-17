import React, { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import {
  ArrowLeft,
  Phone,
  Mail,
  Building2,
  Pencil,
  Archive,
  CircleSlash,
  FileText,
  Paperclip,
  Activity,
  StickyNote,
  Users,
  Clock,
  Download,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { CONTACT_DICTIONARY, type ContactPerson } from "../components/vendors/partnerConstants";
import { getAvatarTint } from "../utils/avatarTints";
import { useVendors } from "../context/VendorContext";

/* ─── Person Avatar Photos ─── */
const PERSON_AVATARS: Record<string, string> = {
  "Sarah": "https://randomuser.me/api/portraits/women/44.jpg",
  "Michael": "https://randomuser.me/api/portraits/men/32.jpg",
  "Emily": "https://randomuser.me/api/portraits/women/65.jpg",
  "David": "https://randomuser.me/api/portraits/men/75.jpg",
  "Rachel": "https://randomuser.me/api/portraits/women/28.jpg",
  "James": "https://randomuser.me/api/portraits/men/46.jpg",
  "Lisa": "https://randomuser.me/api/portraits/women/17.jpg",
  "Robert": "https://randomuser.me/api/portraits/men/22.jpg",
  "Amanda": "https://randomuser.me/api/portraits/women/56.jpg",
  "Kevin": "https://randomuser.me/api/portraits/men/64.jpg",
  "Maria": "https://randomuser.me/api/portraits/women/33.jpg",
  "Chris": "https://randomuser.me/api/portraits/men/85.jpg",
  "Jessica": "https://randomuser.me/api/portraits/women/91.jpg",
  "Andrew": "https://randomuser.me/api/portraits/men/41.jpg",
  "Nicole": "https://randomuser.me/api/portraits/women/72.jpg",
  "Thomas": "https://randomuser.me/api/portraits/men/55.jpg",
  "Stephanie": "https://randomuser.me/api/portraits/women/15.jpg",
  "Daniel": "https://randomuser.me/api/portraits/men/18.jpg",
  "Karen": "https://randomuser.me/api/portraits/women/48.jpg",
  "Brian": "https://randomuser.me/api/portraits/men/67.jpg",
  "Ahtisham": "https://randomuser.me/api/portraits/men/36.jpg",
  "Abdullah": "https://randomuser.me/api/portraits/men/29.jpg",
  "Issac": "https://randomuser.me/api/portraits/men/52.jpg",
  "Elena": "https://randomuser.me/api/portraits/women/39.jpg",
  "Marcus": "https://randomuser.me/api/portraits/men/71.jpg",
  "Priya": "https://randomuser.me/api/portraits/women/63.jpg",
  "Omar": "https://randomuser.me/api/portraits/men/43.jpg",
  "Mei": "https://randomuser.me/api/portraits/women/25.jpg",
  "Carlos": "https://randomuser.me/api/portraits/men/59.jpg",
  "Fatima": "https://randomuser.me/api/portraits/women/81.jpg",
  "Raj": "https://randomuser.me/api/portraits/men/88.jpg",
  "Anna": "https://randomuser.me/api/portraits/women/12.jpg",
  "Viktor": "https://randomuser.me/api/portraits/men/37.jpg",
  "Yuki": "https://randomuser.me/api/portraits/women/50.jpg",
  "Ahmed": "https://randomuser.me/api/portraits/men/94.jpg",
};

function getPersonPhoto(name: string): string | undefined {
  const firstName = name.split(" ")[0];
  return PERSON_AVATARS[firstName];
}

/* ─── Partner name pool for linked partners ─── */
const PARTNER_NAMES = [
  "Acme Corp", "TechVault", "NexGen Solutions", "Apex Industries", "Summit Group",
  "Vertex Labs", "Pioneer Systems", "Atlas Logistics", "Beacon Analytics", "Cascade Networks",
  "Delta Manufacturing", "Echo Enterprises", "Falcon Dynamics", "Granite Holdings", "Horizon Partners",
  "Ionic Solutions", "Jade Innovations", "Keystone Global", "Lumen Corp", "Metro Supply",
];

/* ─── Department pill styles ─── */
const DEPT_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  Sales: { bg: "#EFF6FF", text: "#1E40AF", border: "#BFDBFE" },
  "Supply Chain Management": { bg: "#F0FDF4", text: "#166534", border: "#BBF7D0" },
  Finance: { bg: "#F5F3FF", text: "#5B21B6", border: "#DDD6FE" },
};

/* ─── Enrichment helper ─── */
interface EnrichedContact extends ContactPerson {
  status: "active" | "inactive";
  linkedPartners: string[];
}

function enrichContact(c: ContactPerson): EnrichedContact {
  let hash = 0;
  for (let j = 0; j < c.id.length; j++) hash = c.id.charCodeAt(j) + ((hash << 5) - hash);
  const absHash = Math.abs(hash);
  const status: "active" | "inactive" = absHash % 5 === 0 ? "inactive" : "active";
  const partnerCount = 1 + (absHash % 5);
  const linkedPartners: string[] = [];
  for (let p = 0; p < partnerCount; p++) {
    linkedPartners.push(PARTNER_NAMES[(absHash + p * 7) % PARTNER_NAMES.length]);
  }
  return { ...c, status, linkedPartners };
}

function enrichContactWithNames(c: ContactPerson, names: string[]): EnrichedContact {
  let hash = 0;
  for (let j = 0; j < c.id.length; j++) hash = c.id.charCodeAt(j) + ((hash << 5) - hash);
  const absHash = Math.abs(hash);
  const status: "active" | "inactive" = absHash % 5 === 0 ? "inactive" : "active";
  const partnerCount = 1 + (absHash % 5);
  const linkedPartners: string[] = [];
  for (let p = 0; p < partnerCount; p++) {
    linkedPartners.push(names[(absHash + p * 7) % names.length]);
  }
  return { ...c, status, linkedPartners };
}

/* ─── Dummy data ─── */
const ACTIVITY_LOG = [
  { id: 1, action: "Contact created", user: "System", date: "2025-11-02T09:15:00Z", icon: "create" },
  { id: 2, action: "Linked to Acme Corp", user: "Sarah Johnson", date: "2025-11-05T14:22:00Z", icon: "link" },
  { id: 3, action: "Phone number updated", user: "Admin", date: "2025-12-10T10:05:00Z", icon: "edit" },
  { id: 4, action: "Linked to TechVault", user: "Sarah Johnson", date: "2026-01-08T16:33:00Z", icon: "link" },
  { id: 5, action: "Email address updated", user: "Admin", date: "2026-02-14T11:45:00Z", icon: "edit" },
  { id: 6, action: "Department changed to current", user: "Michael Lee", date: "2026-03-01T08:20:00Z", icon: "edit" },
];

const NOTES_DATA = [
  { id: 1, author: "Sarah Johnson", date: "2026-03-15T09:00:00Z", text: "Confirmed preferred communication channel is email. Direct phone line available for urgent matters only." },
  { id: 2, author: "Michael Lee", date: "2026-02-20T14:30:00Z", text: "Attended annual vendor review meeting. Contact expressed interest in expanding partnership to include logistics services." },
  { id: 3, author: "Admin", date: "2026-01-10T11:15:00Z", text: "Verified contact details during quarterly data cleanup. All information current and accurate." },
];

const ATTACHMENTS_DATA = [
  { id: 1, name: "NDA_Agreement_2026.pdf", size: "1.2 MB", date: "2026-03-10T09:00:00Z", type: "pdf" },
  { id: 2, name: "Contact_Onboarding_Form.docx", size: "340 KB", date: "2026-01-15T14:20:00Z", type: "doc" },
  { id: 3, name: "ID_Verification.png", size: "2.8 MB", date: "2025-12-05T10:45:00Z", type: "img" },
  { id: 4, name: "Meeting_Notes_Q1.pdf", size: "520 KB", date: "2026-03-28T16:00:00Z", type: "pdf" },
];

/* ─── Tab definitions ─── */
const TABS = [
  { id: "activity", label: "Activity", icon: Activity },
  { id: "notes", label: "Notes", icon: StickyNote },
  { id: "attachments", label: "Attachments", icon: Paperclip },
] as const;

type TabId = (typeof TABS)[number]["id"];

/* ─── Format date helper ─── */
function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
  } catch {
    return dateStr;
  }
}

function formatDateTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }) + " at " + d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return dateStr;
  }
}

/* ═══════════════════════════════════════════════════════════════ */
/*  ContactDetailPage                                             */
/* ═══════════════════════════════════════════════════════════════ */
export function ContactDetailPage() {
  const { contactId } = useParams<{ contactId: string }>();
  const navigate = useNavigate();
  const { vendors } = useVendors();
  const [activeTab, setActiveTab] = useState<TabId>("activity");
  const [imgFailed, setImgFailed] = useState(false);

  // Use real vendor names for linked partners
  const vendorNames = useMemo(() => vendors.length > 0 ? vendors.map((v) => v.displayName) : PARTNER_NAMES, [vendors]);
  const partnerNameToId = useMemo(() => {
    const map: Record<string, string> = {};
    vendors.forEach((v) => { map[v.displayName] = v.id; map[v.companyName] = v.id; });
    return map;
  }, [vendors]);

  const contact = useMemo(() => {
    const raw = CONTACT_DICTIONARY.find((c) => c.id === contactId);
    if (!raw) return null;
    return enrichContactWithNames(raw, vendorNames);
  }, [contactId, vendorNames]);

  if (!contact) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
        <div className="w-16 h-16 rounded-2xl bg-[#F1F5F9] flex items-center justify-center">
          <User className="w-8 h-8 text-[#94A3B8]" />
        </div>
        <p className="text-[#64748B] text-sm">Contact not found.</p>
        <Button variant="outline" onClick={() => navigate("/partners/contacts")} className="gap-1.5">
          <ArrowLeft className="w-4 h-4" />
          Back to Contacts
        </Button>
      </div>
    );
  }

  const tint = getAvatarTint(contact.name);
  const photo = getPersonPhoto(contact.name);
  const showImg = photo && !imgFailed;
  const initials = contact.name.split(" ").filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  const statusStyles = contact.status === "active"
    ? { bg: "#ECFDF5", text: "#065F46", border: "#A7F3D0", label: "Active" }
    : { bg: "#FFFBEB", text: "#92400E", border: "#FDE68A", label: "Inactive" };

  const deptStyle = DEPT_STYLES[contact.department] || DEPT_STYLES.Sales;

  return (
    <div className="flex-1 flex flex-col overflow-auto bg-[#F8FAFC]">
      {/* ── Breadcrumb Bar ── */}
      <div className="px-6 pt-4 pb-2 flex items-center gap-2 text-[12px] text-[#94A3B8]" style={{ fontWeight: 500 }}>
        <span className="hover:text-[#64748B] cursor-pointer transition-colors" onClick={() => navigate("/partners")}>Partners Management</span>
        <span>/</span>
        <span className="hover:text-[#64748B] cursor-pointer transition-colors" onClick={() => navigate("/partners/contacts")}>Contacts Directory</span>
        <span>/</span>
        <span className="text-[#334155]">{contact.name}</span>
      </div>

      {/* ── Back button ── */}
      <div className="px-6 pb-3">
        <button
          onClick={() => navigate("/partners/contacts")}
          className="inline-flex items-center gap-1.5 text-[13px] text-[#64748B] hover:text-[#334155] transition-colors cursor-pointer"
          style={{ fontWeight: 500 }}
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Contacts
        </button>
      </div>

      {/* ── Header Section ── */}
      <div className="px-6 pb-5">
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              {/* Avatar */}
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 overflow-hidden border border-[#E8ECF1]"
                style={{ backgroundColor: showImg ? "transparent" : tint.bg }}
              >
                {showImg ? (
                  <img src={photo} alt="" className="w-full h-full object-cover" onError={() => setImgFailed(true)} />
                ) : (
                  <span className="text-xl" style={{ fontWeight: 700, color: tint.fg }}>{initials}</span>
                )}
              </div>

              {/* Name + pills */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-3">
                  <h1 className="text-xl text-[#0F172A]" style={{ fontWeight: 700 }}>{contact.name}</h1>
                  <span
                    className="px-2.5 py-0.5 rounded-full text-[11px] border"
                    style={{ fontWeight: 600, backgroundColor: deptStyle.bg, color: deptStyle.text, borderColor: deptStyle.border }}
                  >
                    {contact.department}
                  </span>
                  <span
                    className="px-2.5 py-0.5 rounded-full text-[11px] border"
                    style={{ fontWeight: 600, backgroundColor: statusStyles.bg, color: statusStyles.text, borderColor: statusStyles.border }}
                  >
                    {statusStyles.label}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[13px] text-[#64748B]">
                  <Building2 className="w-3.5 h-3.5" />
                  <span>{contact.company}</span>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => toast.info("Edit contact coming soon")}
                className="h-9 px-3.5 rounded-lg border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] text-[#334155] inline-flex items-center gap-1.5 text-[13px] transition-all duration-200 cursor-pointer shadow-sm"
                style={{ fontWeight: 500 }}
              >
                <Pencil className="w-3.5 h-3.5" />
                Edit
              </button>
              <button
                onClick={() => toast.info("Deactivate contact coming soon")}
                className="h-9 px-3.5 rounded-lg border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] text-[#334155] inline-flex items-center gap-1.5 text-[13px] transition-all duration-200 cursor-pointer shadow-sm"
                style={{ fontWeight: 500 }}
              >
                <CircleSlash className="w-3.5 h-3.5" />
                Deactivate
              </button>
              <button
                onClick={() => toast.info("Archive contact coming soon")}
                className="h-9 px-3.5 rounded-lg border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] text-[#334155] inline-flex items-center gap-1.5 text-[13px] transition-all duration-200 cursor-pointer shadow-sm"
                style={{ fontWeight: 500 }}
              >
                <Archive className="w-3.5 h-3.5" />
                Archive
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Info Cards (2 columns) ── */}
      <div className="px-6 pb-5 grid grid-cols-2 gap-5">
        {/* Contact Information Card */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5">
          <h3 className="text-[13px] text-[#0F172A] mb-4" style={{ fontWeight: 600 }}>Contact Information</h3>
          <div className="space-y-3.5">
            {/* Primary Phone */}
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#F1F5F9] flex items-center justify-center shrink-0">
                <Phone className="w-4 h-4 text-[#64748B]" />
              </div>
              <div>
                <p className="text-[11px] text-[#94A3B8] mb-0.5" style={{ fontWeight: 500 }}>Primary Phone</p>
                <p className="text-[13px] text-[#334155]" style={{ fontWeight: 500 }}>
                  {contact.phone}
                  {contact.phoneExt && <span className="text-[#94A3B8] ml-1.5">ext. {contact.phoneExt}</span>}
                </p>
              </div>
            </div>
            {/* Secondary Phone */}
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#F1F5F9] flex items-center justify-center shrink-0">
                <Phone className="w-4 h-4 text-[#64748B]" />
              </div>
              <div>
                <p className="text-[11px] text-[#94A3B8] mb-0.5" style={{ fontWeight: 500 }}>Secondary Phone</p>
                <p className="text-[13px] text-[#334155]" style={{ fontWeight: 500 }}>
                  {contact.secondaryPhone}
                  {contact.secondaryPhoneExt && <span className="text-[#94A3B8] ml-1.5">ext. {contact.secondaryPhoneExt}</span>}
                </p>
              </div>
            </div>
            {/* Email */}
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#F1F5F9] flex items-center justify-center shrink-0">
                <Mail className="w-4 h-4 text-[#64748B]" />
              </div>
              <div>
                <p className="text-[11px] text-[#94A3B8] mb-0.5" style={{ fontWeight: 500 }}>Email</p>
                <a href={`mailto:${contact.email}`} className="text-[13px] text-[#0A77FF] hover:underline" style={{ fontWeight: 500 }}>
                  {contact.email}
                </a>
              </div>
            </div>
            {/* Department */}
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#F1F5F9] flex items-center justify-center shrink-0">
                <Users className="w-4 h-4 text-[#64748B]" />
              </div>
              <div>
                <p className="text-[11px] text-[#94A3B8] mb-0.5" style={{ fontWeight: 500 }}>Department</p>
                <p className="text-[13px] text-[#334155]" style={{ fontWeight: 500 }}>{contact.department}</p>
              </div>
            </div>
            {/* Role / Title */}
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#F1F5F9] flex items-center justify-center shrink-0">
                <User className="w-4 h-4 text-[#64748B]" />
              </div>
              <div>
                <p className="text-[11px] text-[#94A3B8] mb-0.5" style={{ fontWeight: 500 }}>Role / Title</p>
                <p className="text-[13px] text-[#334155]" style={{ fontWeight: 500 }}>{contact.department} Representative</p>
              </div>
            </div>
            {/* Company */}
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#F1F5F9] flex items-center justify-center shrink-0">
                <Building2 className="w-4 h-4 text-[#64748B]" />
              </div>
              <div>
                <p className="text-[11px] text-[#94A3B8] mb-0.5" style={{ fontWeight: 500 }}>Company</p>
                <p className="text-[13px] text-[#334155]" style={{ fontWeight: 500 }}>{contact.company}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Partner Information Card */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[13px] text-[#0F172A]" style={{ fontWeight: 600 }}>Partner Information</h3>
            <span className="text-[11px] text-[#94A3B8] bg-[#F1F5F9] rounded-full px-2.5 py-0.5" style={{ fontWeight: 600 }}>
              {contact.linkedPartners.length} linked
            </span>
          </div>
          <div className="space-y-2.5">
            {contact.linkedPartners.map((partner, idx) => {
              const pTint = getAvatarTint(partner);
              const pInitials = partner.split(" ").filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
              const partnerId = partnerNameToId[partner];
              return (
                <div
                  key={idx}
                  className={`flex items-center gap-3 p-2.5 rounded-lg border border-[#F1F5F9] hover:border-[#BFDBFE] hover:bg-[#F0F7FF] transition-all ${partnerId ? "cursor-pointer" : ""}`}
                  onClick={() => { if (partnerId) window.open(`/vendors/${partnerId}`, "_blank"); }}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: pTint.bg }}
                  >
                    <span className="text-[10px]" style={{ fontWeight: 700, color: pTint.fg }}>{pInitials}</span>
                  </div>
                  <span className={`text-[13px] text-[#334155] ${partnerId ? "hover:text-[#0A77FF] hover:underline" : ""}`} style={{ fontWeight: 500 }}>{partner}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Tabs Section ── */}
      <div className="px-6 pb-6">
        <div className="border border-[#E2E8F0] rounded-xl bg-white overflow-hidden">
          {/* Tab bar */}
          <div className="flex border-b border-[#E2E8F0]">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-3 text-[13px] inline-flex items-center gap-1.5 border-b-2 transition-all cursor-pointer ${
                    isActive
                      ? "border-[#0A77FF] text-[#0A77FF]"
                      : "border-transparent text-[#64748B] hover:text-[#334155]"
                  }`}
                  style={{ fontWeight: isActive ? 600 : 500 }}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Tab content */}
          <div className="p-5">
            {activeTab === "activity" && <ActivityTab />}
            {activeTab === "notes" && <NotesTab />}
            {activeTab === "attachments" && <AttachmentsTab />}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Activity Tab ─── */
function ActivityTab() {
  return (
    <div className="space-y-0">
      {ACTIVITY_LOG.map((item, idx) => (
        <div key={item.id} className="flex items-start gap-3 py-3 border-b border-[#F1F5F9] last:border-b-0">
          <div className="w-8 h-8 rounded-lg bg-[#F1F5F9] flex items-center justify-center shrink-0 mt-0.5">
            <Activity className="w-4 h-4 text-[#64748B]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] text-[#334155]" style={{ fontWeight: 500 }}>{item.action}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[11px] text-[#94A3B8]" style={{ fontWeight: 500 }}>{item.user}</span>
              <span className="text-[11px] text-[#CBD5E1]">|</span>
              <span className="text-[11px] text-[#94A3B8]">{formatDateTime(item.date)}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Notes Tab ─── */
function NotesTab() {
  return (
    <div className="space-y-3">
      {NOTES_DATA.map((note) => (
        <div key={note.id} className="p-4 rounded-lg border border-[#F1F5F9] hover:border-[#E2E8F0] transition-all">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-full bg-[#F1F5F9] flex items-center justify-center">
              <User className="w-3 h-3 text-[#64748B]" />
            </div>
            <span className="text-[12px] text-[#334155]" style={{ fontWeight: 600 }}>{note.author}</span>
            <span className="text-[11px] text-[#94A3B8]">{formatDate(note.date)}</span>
          </div>
          <p className="text-[13px] text-[#64748B] leading-relaxed">{note.text}</p>
        </div>
      ))}
    </div>
  );
}

/* ─── Attachments Tab ─── */
function AttachmentsTab() {
  const fileIcons: Record<string, typeof FileText> = {
    pdf: FileText,
    doc: FileText,
    img: FileText,
  };
  return (
    <div className="space-y-0">
      {ATTACHMENTS_DATA.map((file) => {
        const Icon = fileIcons[file.type] || FileText;
        return (
          <div key={file.id} className="flex items-center gap-3 py-3 border-b border-[#F1F5F9] last:border-b-0">
            <div className="w-8 h-8 rounded-lg bg-[#F1F5F9] flex items-center justify-center shrink-0">
              <Icon className="w-4 h-4 text-[#64748B]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] text-[#334155] truncate" style={{ fontWeight: 500 }}>{file.name}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[11px] text-[#94A3B8]">{file.size}</span>
                <span className="text-[11px] text-[#CBD5E1]">|</span>
                <span className="text-[11px] text-[#94A3B8]">{formatDate(file.date)}</span>
              </div>
            </div>
            <button
              onClick={() => toast.info("Download coming soon")}
              className="w-8 h-8 rounded-lg border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] flex items-center justify-center cursor-pointer transition-all"
            >
              <Download className="w-3.5 h-3.5 text-[#64748B]" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
