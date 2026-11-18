import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { AddressAutocomplete } from "../shared/AddressAutocomplete";
import { DiscardDialog } from "../user-detail/DiscardDialog";
import { useUnsavedChangesGuard } from "../../hooks/useUnsavedChangesGuard";
import { ModalShell } from "../shared/ModalShell";
import { TypeSelector } from "../shared/TypeSelector";
import { DestructiveConfirmModal } from "../shared/DestructiveConfirmModal";
import {
  X,
  User,
  Phone,
  MapPin,
  Heart,
  Scale,
  Plus,
  Trash2,
  Mail,
  Languages,
  ShieldCheck,
  Paperclip,
  Upload,
} from "lucide-react";
import type {
  AdditionalDetails,
  AdditionalEmailEntry,
  
  PhoneEntry,
  AddressEntry,
  EmergencyContact,
  CitizenshipEntry,
  LanguageEntry,
} from "./types";
import {
  PRONOUN_OPTIONS,
  LANGUAGE_OPTIONS,
  PROFICIENCY_OPTIONS,
  RELATIONSHIP_OPTIONS,
  COUNTRY_OPTIONS,
} from "./types";
import { PhoneInput } from "../shared/PhoneInput";

const COUNTRY_FLAG_MAP: Record<string, string> = {
  "United States": "🇺🇸",
  "United Kingdom": "🇬🇧",
  "India": "🇮🇳",
  "Germany": "🇩🇪",
  "France": "🇫🇷",
  "Japan": "🇯🇵",
  "China": "🇨🇳",
  "Australia": "🇦🇺",
  "United Arab Emirates": "🇦🇪",
  "Brazil": "🇧🇷",
  "Canada": "🇨🇦",
  "Mexico": "🇲🇽",
  "South Korea": "🇰🇷",
  "Italy": "🇮🇹",
  "Spain": "🇪🇸",
};




interface Props {
  open: boolean;
  details: AdditionalDetails;
  primaryEmail?: string;
  onPrimaryEmailChange?: (email: string) => void;
  onSave: (details: AdditionalDetails) => void;
  onClose: () => void;
}

type Section =
  | "preferences"
  | "contact"
  | "addresses"
  | "emergency"
  | "legal"
  | "notes";

const SECTIONS: { key: Section; label: string; description: string; icon: typeof User }[] = [
  { key: "contact", label: "Contact Information", description: "Emails, phone numbers", icon: Phone },
  { key: "addresses", label: "Addresses", description: "Home, work, mailing addresses", icon: MapPin },
  { key: "emergency", label: "Emergency Contacts", description: "Emergency contact persons", icon: Heart },
  { key: "legal", label: "Legal & Compliance", description: "Citizenships, compliance", icon: Scale },
  { key: "preferences", label: "Personal Preferences", description: "Nickname, pronouns, languages", icon: User },
  { key: "notes", label: "Notes & Attachments", description: "Notes, files, documents", icon: Paperclip },
];

/* ─── Shared ─── */
const inputClass =
  "w-full h-9 sm:h-10 px-3.5 border border-[#E2E8F0] rounded-[8px] text-sm text-[#0F172A] bg-white focus:outline-none focus:ring-1 focus:ring-[#007FFF]/20 focus:border-[#007FFF] transition-all placeholder:text-[#94A3B8]";
const selectClass = `${inputClass} appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2394a3b8%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_12px_center]`;
const selectFlexClass = selectClass.replace("w-full", "flex-1 min-w-0");

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-xs sm:text-[13px] text-[#0F172A] mb-1.5" style={{ fontWeight: 500 }}>
      {children}
    </span>
  );
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 text-[13px] mt-2 transition-colors cursor-pointer hover:underline"
      style={{ fontWeight: 520, color: "#007FFF" }}
    >
      <Plus size={14} strokeWidth={2.5} />
      {label}
    </button>
  );
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-10 h-10 shrink-0 rounded-[8px] flex items-center justify-center transition-colors cursor-pointer"
      style={{ backgroundColor: "#FEF2F2", color: "#DC2626" }}
      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#FEE2E2"; }}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#FEF2F2"; }}
      title="Remove"
    >
      <Trash2 size={15} />
    </button>
  );
}

/* ─── Empty State ─── */
function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon: typeof Phone;
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div
      className="rounded-xl border border-dashed p-6 flex flex-col items-center text-center"
      style={{ borderColor: "#CBD5E1", backgroundColor: "#FAFBFC" }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
        style={{ backgroundColor: "#EDF4FF" }}
      >
        <Icon size={18} style={{ color: "#007FFF" }} />
      </div>
      <p
        className="text-[13px] mb-1"
        style={{ fontWeight: 560, color: "#1E293B" }}
      >
        {title}
      </p>
      <p
        className="text-[12px] max-w-[320px] mb-3.5"
        style={{ fontWeight: 400, color: "#64748B", lineHeight: "1.5" }}
      >
        {description}
      </p>
      <button
        type="button"
        onClick={onAction}
        className="inline-flex items-center gap-1.5 px-3.5 py-[7px] rounded-[8px] border text-[12.5px] transition-all cursor-pointer hover:shadow-sm"
        style={{
          fontWeight: 560,
          color: "#007FFF",
          borderColor: "#007FFF",
          backgroundColor: "#EFF6FF",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#DBEAFE"; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#EFF6FF"; }}
      >
        <Plus size={13} strokeWidth={2.5} />
        {actionLabel}
      </button>
    </div>
  );
}

/** Per-section incomplete detection: a section is incomplete when the user
 *  added an entry and started filling some required fields but left others
 *  blank. Untouched sections (no entries) are not flagged. */
interface IncompleteSummary {
  sectionKey: Section;
  sectionLabel: string;
  icon: typeof User;
  description: string;
}

/** Strip out any entry whose required fields are still blank. Used when the
 *  user opts into "Save and Discard Incomplete", partial rows are dropped
 *  rather than persisted. */
function pruneIncompleteEntries(draft: AdditionalDetails): AdditionalDetails {
  return {
    ...draft,
    phones: draft.phones.filter((p) => p.number.trim() !== ""),
    additionalEmails: draft.additionalEmails.filter((e) => e.email.trim() !== ""),
    addresses: draft.addresses.filter((a) => a.address.trim() !== ""),
    emergencyContacts: draft.emergencyContacts.filter(
      (c) => c.fullName.trim() !== "" && c.phone.trim() !== "" && c.relationship.trim() !== ""
    ),
    citizenships: draft.citizenships.filter((c) => c.country.trim() !== ""),
    languages: draft.languages.filter((l) => l.language.trim() !== ""),
  };
}

function computeIncompleteSummaries(draft: AdditionalDetails): IncompleteSummary[] {
  const summaries: IncompleteSummary[] = [];

  // Contact: missing phone number values + missing email values
  const phonesMissing = draft.phones.filter((p) => !p.number.trim()).length;
  const emailsMissing = draft.additionalEmails.filter((e) => !e.email.trim()).length;
  if (phonesMissing > 0 || emailsMissing > 0) {
    const parts: string[] = [];
    if (phonesMissing > 0) {
      parts.push(
        `${phonesMissing} phone number${phonesMissing > 1 ? "s" : ""} missing details`
      );
    }
    if (emailsMissing > 0) {
      parts.push(
        `${emailsMissing} email address${emailsMissing > 1 ? "es" : ""} missing details`
      );
    }
    summaries.push({
      sectionKey: "contact",
      sectionLabel: "Contact Information",
      icon: Phone,
      description: parts.join(", "),
    });
  }

  // Addresses: address text empty
  const addressMissing = draft.addresses.filter((a) => !a.address.trim()).length;
  if (addressMissing > 0) {
    summaries.push({
      sectionKey: "addresses",
      sectionLabel: "Addresses",
      icon: MapPin,
      description: `${addressMissing} address${addressMissing > 1 ? "es" : ""} missing details`,
    });
  }

  // Emergency contacts: fullName / phone / relationship required
  const emergencyIncomplete = draft.emergencyContacts.filter(
    (c) => !c.fullName.trim() || !c.phone.trim() || !c.relationship.trim()
  );
  if (emergencyIncomplete.length > 0) {
    const reasons: string[] = [];
    if (emergencyIncomplete.some((c) => !c.fullName.trim())) reasons.push("name");
    if (emergencyIncomplete.some((c) => !c.phone.trim())) reasons.push("phone number");
    if (emergencyIncomplete.some((c) => !c.relationship.trim())) reasons.push("relationship");
    const count = emergencyIncomplete.length;
    summaries.push({
      sectionKey: "emergency",
      sectionLabel: "Emergency Contacts",
      icon: Heart,
      description: `${count} contact${count > 1 ? "s" : ""} missing ${reasons.join(" / ")}`,
    });
  }

  // Legal: citizenship without country
  const citizenshipMissing = draft.citizenships.filter((c) => !c.country.trim()).length;
  if (citizenshipMissing > 0) {
    summaries.push({
      sectionKey: "legal",
      sectionLabel: "Legal & Compliance",
      icon: Scale,
      description: `${citizenshipMissing} citizenship${citizenshipMissing > 1 ? "s" : ""} missing country`,
    });
  }

  // Preferences: language without language selected
  const languageMissing = draft.languages.filter((l) => !l.language.trim()).length;
  if (languageMissing > 0) {
    summaries.push({
      sectionKey: "preferences",
      sectionLabel: "Personal Preferences",
      icon: User,
      description: `${languageMissing} language${languageMissing > 1 ? "s" : ""} not selected`,
    });
  }

  return summaries;
}

export function AdditionalDetailsModal({ open, details, primaryEmail, onSave, onClose }: Props) {
  const [activeSection, setActiveSection] = useState<Section>("contact");
  const [draft, setDraft] = useState<AdditionalDetails>({ ...details });
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [showIncompleteConfirm, setShowIncompleteConfirm] = useState(false);
  const [entryErrors, setEntryErrors] = useState<Record<string, string>>({});
  const [localPrimaryEmail, setLocalPrimaryEmail] = useState(primaryEmail ?? "");
  const [visitedSections, setVisitedSections] = useState<Set<Section>>(new Set());

  const handleSectionNav = useCallback((next: Section) => {
    setVisitedSections((prev) => new Set(prev).add(activeSection));
    setActiveSection(next);
  }, [activeSection]);

  useEffect(() => {
    if (open) {
      setDraft(JSON.parse(JSON.stringify(details)));
      setActiveSection("contact");
      setShowDiscardDialog(false);
      setShowIncompleteConfirm(false);
      setEntryErrors({});
      setLocalPrimaryEmail(primaryEmail ?? "");
      setVisitedSections(new Set());
    }
  }, [open, details, primaryEmail]);

  const isDirty = JSON.stringify(draft) !== JSON.stringify(details) || localPrimaryEmail !== (primaryEmail ?? "");

  // Incomplete summaries (used by both the sidebar dot and the confirm modal)
  const incompleteSummaries = useMemo(() => computeIncompleteSummaries(draft), [draft]);

  const sectionIncompleteMap = useMemo(() => {
    const map: Record<Section, boolean> = {
      contact: false,
      addresses: false,
      emergency: false,
      legal: false,
      preferences: false,
      notes: false,
    };
    incompleteSummaries.forEach((s) => {
      map[s.sectionKey] = true;
    });
    return map;
  }, [incompleteSummaries]);

  const handleAttemptClose = useCallback(() => {
    if (isDirty) {
      setShowDiscardDialog(true);
    } else {
      onClose();
    }
  }, [isDirty, onClose]);

  const handleForceClose = useCallback(() => {
    setShowDiscardDialog(false);
    onClose();
  }, [onClose]);

  useUnsavedChangesGuard(open && isDirty, () => setShowDiscardDialog(true));

  const hasEntryErrors = Object.keys(entryErrors).length > 0;

  const handleSave = useCallback(() => {
    if (hasEntryErrors) return;
    if (incompleteSummaries.length > 0) {
      setShowIncompleteConfirm(true);
      return;
    }
    onSave({ ...draft });
  }, [draft, onSave, hasEntryErrors, incompleteSummaries]);

  const savingAnywayRef = useRef(false);

  const handleConfirmSaveAnyway = useCallback(() => {
    savingAnywayRef.current = true;
    setShowIncompleteConfirm(false);
    onSave(pruneIncompleteEntries(draft));
  }, [draft, onSave]);

  const handleGoBackToIncomplete = useCallback(() => {
    if (savingAnywayRef.current) {
      // DestructiveConfirmModal invokes onClose() after onConfirm(), suppress
      // the navigation in that case.
      savingAnywayRef.current = false;
      setShowIncompleteConfirm(false);
      return;
    }
    const first = incompleteSummaries[0];
    if (first) {
      setVisitedSections((prev) => new Set(prev).add(activeSection));
      setActiveSection(first.sectionKey);
    }
    setShowIncompleteConfirm(false);
  }, [incompleteSummaries, activeSection]);

  /* Updaters */
  const updateDraft = useCallback((partial: Partial<AdditionalDetails>) => {
    setDraft((prev) => ({ ...prev, ...partial }));
  }, []);

  const addPhone = () => {
    if (draft.phones.length > 0) {
      const last = draft.phones[draft.phones.length - 1];
      if (!last.number.trim()) {
        setEntryErrors((prev) => ({ ...prev, [`phone-${draft.phones.length - 1}`]: "Please enter a phone number before adding another" }));
        return;
      }
    }
    setEntryErrors((prev) => { const next = { ...prev }; Object.keys(next).filter(k => k.startsWith("phone-")).forEach(k => delete next[k]); return next; });
    updateDraft({ phones: [...draft.phones, { type: "Mobile", countryCode: "+1", number: "" }] });
  };
  const removePhone = (i: number) =>
    updateDraft({ phones: draft.phones.filter((_, idx) => idx !== i) });
  const updatePhone = (i: number, partial: Partial<PhoneEntry>) =>
    updateDraft({
      phones: draft.phones.map((p, idx) => (idx === i ? { ...p, ...partial } : p)),
    });

  const addLanguage = () =>
    updateDraft({ languages: [...draft.languages, { language: "", proficiency: "Intermediate" }] });
  const removeLanguage = (i: number) =>
    updateDraft({ languages: draft.languages.filter((_, idx) => idx !== i) });
  const updateLanguage = (i: number, partial: Partial<LanguageEntry>) =>
    updateDraft({
      languages: draft.languages.map((l, idx) => (idx === i ? { ...l, ...partial } : l)),
    });

  const addEmail = () => {
    if (draft.additionalEmails.length > 0) {
      const last = draft.additionalEmails[draft.additionalEmails.length - 1];
      if (!last.email.trim()) {
        setEntryErrors((prev) => ({ ...prev, [`email-${draft.additionalEmails.length - 1}`]: "Please enter an email address before adding another" }));
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(last.email)) {
        setEntryErrors((prev) => ({ ...prev, [`email-${draft.additionalEmails.length - 1}`]: "Please enter a valid email address" }));
        return;
      }
    }
    setEntryErrors((prev) => { const next = { ...prev }; Object.keys(next).filter(k => k.startsWith("email-")).forEach(k => delete next[k]); return next; });
    updateDraft({ additionalEmails: [...draft.additionalEmails, { email: "", type: "Work" }] });
  };
  const removeEmail = (i: number) => {
    updateDraft({ additionalEmails: draft.additionalEmails.filter((_, idx) => idx !== i) });
  };
  const updateEmail = (i: number, partial: Partial<AdditionalEmailEntry>) => {
    const updated = draft.additionalEmails.map((e, idx) => (idx === i ? { ...e, ...partial } : e));
    updateDraft({ additionalEmails: updated });

    // Duplicate email validation
    if (partial.email !== undefined) {
      const newEmail = partial.email.trim().toLowerCase();
      if (newEmail) {
        // Check against primary email
        const primaryLower = (primaryEmail ?? "").trim().toLowerCase();
        if (primaryLower && newEmail === primaryLower) {
          setEntryErrors((prev) => ({ ...prev, [`email-${i}`]: "This email is already added above" }));
          return;
        }
        // Check against other additional emails
        const isDuplicate = updated.some(
          (e, idx) => idx !== i && e.email.trim().toLowerCase() === newEmail
        );
        if (isDuplicate) {
          setEntryErrors((prev) => ({ ...prev, [`email-${i}`]: "This email is already added above" }));
          return;
        }
      }
      // Clear error if no duplicate
      setEntryErrors((prev) => {
        const next = { ...prev };
        delete next[`email-${i}`];
        return next;
      });
    }
  };

  const addAddress = () =>
    updateDraft({ addresses: [...draft.addresses, { type: "Home", address: "" }] });
  const removeAddress = (i: number) =>
    updateDraft({ addresses: draft.addresses.filter((_, idx) => idx !== i) });
  const updateAddress = (i: number, partial: Partial<AddressEntry>) =>
    updateDraft({
      addresses: draft.addresses.map((a, idx) => (idx === i ? { ...a, ...partial } : a)),
    });

  const addEmergencyContact = () =>
    updateDraft({
      emergencyContacts: [
        ...draft.emergencyContacts,
        { fullName: "", relationship: "", countryCode: "+1", phone: "", isPrimary: draft.emergencyContacts.length === 0 },
      ],
    });
  const removeEmergencyContact = (i: number) => {
    const next = draft.emergencyContacts.filter((_, idx) => idx !== i);
    if (next.length > 0 && !next.some((c) => c.isPrimary)) {
      next[0].isPrimary = true;
    }
    updateDraft({ emergencyContacts: next });
  };
  const updateEmergencyContact = (i: number, partial: Partial<EmergencyContact>) =>
    updateDraft({
      emergencyContacts: draft.emergencyContacts.map((c, idx) => {
        if (idx === i) {
          const updated = { ...c, ...partial };
          return updated;
        }
        if (partial.isPrimary) return { ...c, isPrimary: false };
        return c;
      }),
    });

  const addCitizenship = () =>
    updateDraft({
      citizenships: [
        ...draft.citizenships,
        { country: "", isPrimary: draft.citizenships.length === 0 },
      ],
    });
  const removeCitizenship = (i: number) => {
    const next = draft.citizenships.filter((_, idx) => idx !== i);
    if (next.length > 0 && !next.some((c) => c.isPrimary)) {
      next[0].isPrimary = true;
    }
    updateDraft({ citizenships: next });
  };
  const updateCitizenship = (i: number, partial: Partial<CitizenshipEntry>) =>
    updateDraft({
      citizenships: draft.citizenships.map((c, idx) => {
        if (idx === i) {
          const updated = { ...c, ...partial };
          if (partial.isPrimary) {
            return updated;
          }
          return updated;
        }
        if (partial.isPrimary) return { ...c, isPrimary: false };
        return c;
      }),
    });

  if (!open) return null;

  return (
    <>
      <ModalShell open={open} onClose={handleAttemptClose} z={60}>
        <div
          className="bg-white rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.35)] flex flex-col overflow-hidden"
          style={{
            width: 1060,
            maxWidth: "calc(100vw - 80px)",
            height: 760,
            maxHeight: "calc(100vh - 80px)",
          }}
        >
          {/* Header */}
          <div className="shrink-0 bg-white border-b border-gray-200 px-5 py-3.5 flex items-center justify-between">
            <div>
              <h3 className="text-gray-900" style={{ fontSize: "15.5px", fontWeight: 620 }}>
                Additional Details
              </h3>
              <p className="text-gray-500 text-[13px] mt-0.5" style={{ fontWeight: 400 }}>
                Optional personal and compliance information.
              </p>
            </div>
            <button
              onClick={handleAttemptClose}
              className="flex items-center justify-center w-8 h-8 rounded-md border border-gray-200 bg-white text-gray-500 hover:text-gray-900 hover:bg-gray-50 hover:border-gray-300 transition-colors cursor-pointer"
            >
              <X size={16} strokeWidth={2} />
            </button>
          </div>

          {/* Body: sidebar + content */}
          <div className="flex flex-1 min-h-0">
            {/* Left sidebar nav */}
            <div className="w-[272px] min-w-[272px] bg-[#FAFBFC] border-r border-gray-200 py-3 px-2.5 shrink-0 overflow-y-auto">
              {SECTIONS.map((sec) => {
                const isActive = activeSection === sec.key;
                const Icon = sec.icon;
                const isSectionIncomplete = !isActive && visitedSections.has(sec.key) && (sectionIncompleteMap[sec.key] ?? false);
                return (
                  <button
                    key={sec.key}
                    onClick={() => handleSectionNav(sec.key)}
                    className={`w-full flex items-center gap-3 px-3 py-3 rounded-[8px] transition-all text-left mb-0.5 cursor-pointer ${
                      isActive ? "bg-white shadow-sm border border-gray-200" : "hover:bg-white/60"
                    }`}
                  >
                    <div
                      className="w-8 h-8 rounded-[8px] flex items-center justify-center shrink-0"
                      style={{
                        backgroundColor: isActive ? "#EDF4FF" : "#F1F5F9",
                      }}
                    >
                      <Icon
                        size={15}
                        style={{ color: isActive ? "#007FFF" : "#64748B" }}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div
                        className="text-[13px] truncate"
                        style={{
                          fontWeight: isActive ? 580 : 500,
                          color: isActive ? "#0F172A" : "#334155",
                        }}
                      >
                        {sec.label}
                      </div>
                      <div
                        className="text-[11px] mt-0.5 truncate"
                        style={{ fontWeight: 400, color: isActive ? "#64748B" : "#94A3B8" }}
                      >
                        {sec.description}
                      </div>
                    </div>
                    {isSectionIncomplete && (
                      <span
                        className="inline-flex items-center rounded px-1.5 py-px text-[10px] shrink-0"
                        style={{
                          fontWeight: 600,
                          color: "#DC2626",
                          backgroundColor: "#FEF2F2",
                          border: "1px solid #FECACA",
                        }}
                      >
                        Incomplete
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Right content */}
            <div className="flex-1 min-w-0 overflow-y-auto p-5">
              {activeSection === "preferences" && (
                <PreferencesSection
                  draft={draft}
                  updateDraft={updateDraft}
                  addLanguage={addLanguage}
                  removeLanguage={removeLanguage}
                  updateLanguage={updateLanguage}
                />
              )}
              {activeSection === "contact" && (
                <ContactSection
                  draft={draft}
                  primaryEmail={primaryEmail}
                  addEmail={addEmail}
                  removeEmail={removeEmail}
                  updateEmail={updateEmail}
                  addPhone={addPhone}
                  removePhone={removePhone}
                  updatePhone={updatePhone}
                  entryErrors={entryErrors}
                />
              )}
              {activeSection === "addresses" && (
                <AddressesSection
                  draft={draft}
                  addAddress={addAddress}
                  removeAddress={removeAddress}
                  updateAddress={updateAddress}
                />
              )}
              {activeSection === "emergency" && (
                <EmergencySection
                  draft={draft}
                  addEmergencyContact={addEmergencyContact}
                  removeEmergencyContact={removeEmergencyContact}
                  updateEmergencyContact={updateEmergencyContact}
                />
              )}
              {activeSection === "legal" && (
                <LegalSection
                  draft={draft}
                  addCitizenship={addCitizenship}
                  removeCitizenship={removeCitizenship}
                  updateCitizenship={updateCitizenship}
                />
              )}
              {activeSection === "notes" && (
                <NotesAttachmentsSection
                  draft={draft}
                  updateDraft={updateDraft}
                />
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="shrink-0 bg-white border-t border-gray-200 px-5 py-3.5 flex items-center justify-end gap-2.5">
            <button
              onClick={handleAttemptClose}
              className="px-5 py-2 rounded-[8px] border border-[#E2E8F0] bg-white text-[#334155] hover:bg-[#F8FAFC] hover:border-[#CBD5E1] transition-all cursor-pointer"
              style={{ fontSize: "13.5px", fontWeight: 500 }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={hasEntryErrors}
              className="px-5 py-2 rounded-[8px] bg-[#007FFF] hover:bg-[#0066D6] text-white transition-all cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ fontSize: "13.5px", fontWeight: 560 }}
            >
              Save Details
            </button>
          </div>
        </div>
      </ModalShell>

      {/* Discard unsaved changes dialog */}
      {showDiscardDialog && (
        <DiscardDialog
          title="Discard Changes?"
          description="All changes made in Additional Details will be lost. This action cannot be undone."
          onKeepEditing={() => setShowDiscardDialog(false)}
          onDiscard={handleForceClose}
        />
      )}

      {/* Incomplete-sections confirmation. onClose doubles as the Go Back
       *  handler, dismissing the dialog (via Go Back, Escape, or backdrop)
       *  jumps to the first incomplete section so the user can finish it. */}
      <DestructiveConfirmModal
        open={showIncompleteConfirm}
        onClose={handleGoBackToIncomplete}
        tone="warning"
        badge="INCOMPLETE"
        title="Some Details Are Incomplete"
        description="You started filling in the following sections but left some fields empty. Incomplete entries will not be saved. You can continue and lose the incomplete data, or go back to finish them."
        confirmLabel="Save and Discard Incomplete"
        cancelLabel="Go Back"
        onConfirm={handleConfirmSaveAnyway}
        maxWidth={460}
        extra={
          incompleteSummaries.length > 0 ? (
            <div className="rounded-xl border border-[#FDE68A] bg-[#FFFBEB] overflow-hidden">
              {incompleteSummaries.map((s, idx) => {
                const Icon = s.icon;
                return (
                  <div
                    key={s.sectionKey}
                    className={`flex items-start gap-3 px-3.5 py-3 ${
                      idx > 0 ? "border-t border-[#FDE68A]" : ""
                    }`}
                  >
                    <div
                      className="w-8 h-8 rounded-[8px] flex items-center justify-center shrink-0"
                      style={{ backgroundColor: "#FEF3C7" }}
                    >
                      <Icon className="w-4 h-4" style={{ color: "#D97706" }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div
                        className="text-[13px]"
                        style={{ fontWeight: 580, color: "#0F172A" }}
                      >
                        {s.sectionLabel}
                      </div>
                      <div
                        className="text-[12px] mt-0.5"
                        style={{ color: "#92400E", fontWeight: 400, lineHeight: "1.5" }}
                      >
                        {s.description}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : undefined
        }
      />
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════
   Section Components
   ═════════════════════════════════════════════════════════════════ */

function PreferencesSection({
  draft,
  updateDraft,
  addLanguage,
  removeLanguage,
  updateLanguage,
}: {
  draft: AdditionalDetails;
  updateDraft: (p: Partial<AdditionalDetails>) => void;
  addLanguage: () => void;
  removeLanguage: (i: number) => void;
  updateLanguage: (i: number, p: Partial<LanguageEntry>) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="mb-2">
        <h4 className="text-[13px] sm:text-sm text-[#0F172A]" style={{ fontWeight: 600 }}>Personal Preferences</h4>
        <p className="text-[11px] sm:text-xs text-[#94A3B8] mt-0.5">Nickname, pronouns, and spoken languages</p>
      </div>

      {/* Identity group */}
      <div className="rounded-xl p-5 space-y-4" style={{ backgroundColor: "#F8FAFC" }}>
        <div className="text-[12px] text-[#64748B] tracking-wider" style={{ fontWeight: 600 }}>
          Identity
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <SectionLabel>Preferred Name / Nickname</SectionLabel>
            <input
              type="text"
              value={draft.nickname}
              onChange={(e) => updateDraft({ nickname: e.target.value })}
              placeholder="e.g. Johnny"
              className={inputClass}
            />
            <p className="text-[11px] text-[#64748B] mt-1" style={{ fontWeight: 400 }}>
              How this person prefers to be addressed.
            </p>
          </div>
          <div>
            <SectionLabel>Pronouns</SectionLabel>
            <select
              value={draft.pronouns}
              onChange={(e) => updateDraft({ pronouns: e.target.value })}
              className={selectClass}
            >
              <option value="">Select pronouns...</option>
              {PRONOUN_OPTIONS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Languages group */}
      {draft.languages.length === 0 ? (
        <EmptyState
          icon={Languages}
          title="No Languages Added"
          description="Languages help teammates communicate effectively and connect across global offices and time zones."
          actionLabel="Add language"
          onAction={addLanguage}
        />
      ) : (
        <div className="rounded-xl p-5 space-y-3" style={{ backgroundColor: "#F8FAFC" }}>
          <div className="text-[12px] text-[#64748B] tracking-wider" style={{ fontWeight: 600 }}>
            Languages
          </div>
          {draft.languages.map((entry, i) => (
            <div key={i} className="flex items-center gap-2 min-w-0 rounded-xl p-3" style={{ backgroundColor: "white", boxShadow: "0 1px 2px 0 rgba(15, 23, 42, 0.04)" }}>
              <div className="flex-1 min-w-0">
                <select
                  value={entry.language}
                  onChange={(e) => updateLanguage(i, { language: e.target.value })}
                  className={selectClass}
                >
                  <option value="">Select language...</option>
                  {LANGUAGE_OPTIONS.map((lang) => (
                    <option key={lang.name} value={lang.name}>
                      {lang.flag} {lang.name} ({lang.native})
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-[160px] shrink-0">
                <select
                  value={entry.proficiency}
                  onChange={(e) => updateLanguage(i, { proficiency: e.target.value })}
                  className={selectClass}
                >
                  {PROFICIENCY_OPTIONS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <RemoveButton onClick={() => removeLanguage(i)} />
            </div>
          ))}
          <AddButton label="Add Language" onClick={addLanguage} />
        </div>
      )}
    </div>
  );
}

function ContactSection({
  draft,
  primaryEmail,
  addEmail,
  removeEmail,
  updateEmail,
  addPhone,
  removePhone,
  updatePhone,
  entryErrors,
}: {
  draft: AdditionalDetails;
  primaryEmail?: string;
  addEmail: () => void;
  removeEmail: (i: number) => void;
  updateEmail: (i: number, p: Partial<AdditionalEmailEntry>) => void;
  addPhone: () => void;
  removePhone: (i: number) => void;
  updatePhone: (i: number, p: Partial<PhoneEntry>) => void;
  entryErrors: Record<string, string>;
}) {
  return (
    <div className="space-y-6">
      <div className="mb-2">
        <h4 className="text-[13px] sm:text-sm text-[#0F172A]" style={{ fontWeight: 600 }}>Contact Information</h4>
        <p className="text-[11px] sm:text-xs text-[#94A3B8] mt-0.5">Email addresses and phone numbers for this user</p>
      </div>

      {/* Primary System Email Banner */}
      {primaryEmail && (
        <div
          className="flex items-center gap-3 rounded-xl border px-4 py-3.5"
          style={{
            background: "linear-gradient(135deg, #FFFFFF 0%, #F0F7FF 60%, #E8F2FF 100%)",
            borderColor: "#DBEAFE",
          }}
        >
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: "#EDF4FF" }}
          >
            <Mail size={16} style={{ color: "#007FFF" }} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-[#64748B]" style={{ fontWeight: 500 }}>Primary System Email</p>
            <p className="text-[13px] text-[#0F172A] truncate" style={{ fontWeight: 520 }}>{primaryEmail}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span
              className="inline-flex items-center px-2.5 py-1 rounded-md text-[10.5px] border shrink-0"
              style={{ backgroundColor: "#F8FAFC", color: "#475569", borderColor: "#E2E8F0", fontWeight: 500 }}
            >
              Login & Notifications
            </span>
            <div className="relative group">
              <div
                className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] cursor-default shrink-0"
                style={{ backgroundColor: "#F1F5F9", color: "#94A3B8", fontWeight: 600 }}
              >
                i
              </div>
              <div className="absolute right-0 bottom-full mb-2 w-[220px] p-2.5 rounded-lg border border-[#E2E8F0] bg-white shadow-lg text-[11px] text-[#475569] leading-relaxed opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-50" style={{ fontWeight: 400 }}>
                This is the primary email used for account login, system notifications, and password recovery.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Additional Emails section */}
      {draft.additionalEmails.length === 0 ? (
        <EmptyState
          icon={Mail}
          title="No Additional Email Addresses"
          description="Add extra email addresses for communication, work contacts, or personal correspondence."
          actionLabel="Add email address"
          onAction={addEmail}
        />
      ) : (
        <div className="rounded-xl p-5 space-y-3" style={{ backgroundColor: "#F8FAFC" }}>
          <div className="text-[12px] text-[#64748B] tracking-wider" style={{ fontWeight: 600 }}>
            Additional Email Addresses
          </div>
          {draft.additionalEmails.map((entry, i) => (
            <div key={i}>
              <div className="rounded-xl p-3 space-y-2" style={{ backgroundColor: "white", boxShadow: "0 1px 2px 0 rgba(15, 23, 42, 0.04)" }}>
                <div className="flex items-start gap-2">
                  <div className="shrink-0 pt-0">
                    <TypeSelector
                      value={entry.type}
                      onChange={(val) => updateEmail(i, { type: val })}
                      options={["Work", "Personal"]}
                      selectClassName={`${selectClass} !w-[120px] shrink-0`}
                      className="shrink-0"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                      <input
                        type="email"
                        value={entry.email}
                        onChange={(e) => updateEmail(i, { email: e.target.value })}
                        placeholder="e.g. john@company.com"
                        className={`${inputClass} pl-9 ${entryErrors[`email-${i}`] ? "!border-[#EF4444]" : ""}`}
                      />
                    </div>
                    {entryErrors[`email-${i}`] && (
                      <p className="text-[#EF4444] text-[12px] mt-1">{entryErrors[`email-${i}`]}</p>
                    )}
                  </div>
                  <RemoveButton onClick={() => removeEmail(i)} />
                </div>
              </div>
            </div>
          ))}
          <AddButton label="Add Email Address" onClick={addEmail} />
        </div>
      )}

      {/* Phone Numbers */}
      {draft.phones.length === 0 ? (
        <EmptyState
          icon={Phone}
          title="No Phone Numbers"
          description="Phone numbers enable SMS alerts, multi-factor authentication, and direct contact when it matters most."
          actionLabel="Add phone number"
          onAction={addPhone}
        />
      ) : (
        <div className="rounded-xl p-5 space-y-3" style={{ backgroundColor: "#F8FAFC" }}>
          <div className="text-[12px] text-[#64748B] tracking-wider" style={{ fontWeight: 600 }}>
            Phone Numbers
          </div>
          {draft.phones.map((phone, i) => (
            <div key={i}>
              <div className="rounded-xl p-3 space-y-2 min-w-0" style={{ backgroundColor: "white", boxShadow: "0 1px 2px 0 rgba(15, 23, 42, 0.04)" }}>
                <div className="flex items-center gap-2 min-w-0">
                  <TypeSelector
                    value={phone.type}
                    onChange={(val) => updatePhone(i, { type: val })}
                    options={["Mobile", "Home", "Work"]}
                    selectClassName={`${selectClass} !w-[110px] shrink-0`}
                    className="shrink-0"
                  />
                  <PhoneInput
                    countryCode={phone.countryCode}
                    number={phone.number}
                    onCountryCodeChange={(code) => updatePhone(i, { countryCode: code })}
                    onNumberChange={(num) => updatePhone(i, { number: num })}
                    className="flex-1 min-w-0"
                  />
                  <RemoveButton onClick={() => removePhone(i)} />
                </div>
                {entryErrors[`phone-${i}`] && (
                  <p className="text-[#EF4444] text-[12px] text-center">{entryErrors[`phone-${i}`]}</p>
                )}
              </div>
            </div>
          ))}
          <AddButton label="Add Phone Number" onClick={addPhone} />
        </div>
      )}
    </div>
  );
}

function AddressesSection({
  draft,
  addAddress,
  removeAddress,
  updateAddress,
}: {
  draft: AdditionalDetails;
  addAddress: () => void;
  removeAddress: (i: number) => void;
  updateAddress: (i: number, p: Partial<AddressEntry>) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="mb-2">
        <h4 className="text-[13px] sm:text-sm text-[#0F172A]" style={{ fontWeight: 600 }}>Addresses</h4>
        <p className="text-[11px] sm:text-xs text-[#94A3B8] mt-0.5">Home, work, and mailing addresses for this user</p>
      </div>

      {draft.addresses.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="No Addresses on File"
          description="Addresses are used for shipping, tax compliance, and office location assignments. Add one to get started."
          actionLabel="Add address"
          onAction={addAddress}
        />
      ) : (
        <div className="rounded-xl p-5 space-y-3" style={{ backgroundColor: "#F8FAFC" }}>
          <div className="text-[12px] text-[#64748B] tracking-wider" style={{ fontWeight: 600 }}>
            Addresses
          </div>
          {draft.addresses.map((addr, i) => (
            <div key={i} className="relative flex items-center gap-2 min-w-0 rounded-xl p-3" style={{ backgroundColor: "white", boxShadow: "0 1px 2px 0 rgba(15, 23, 42, 0.04)" }}>
              <div className="flex-1 min-w-0 flex items-center h-10 border border-[#E2E8F0] rounded-[8px] bg-white focus-within:ring-1 focus-within:ring-[#007FFF]/20 focus-within:border-[#007FFF] transition-all">
                <AddressTypeInline
                  value={addr.type}
                  onChange={(val) => updateAddress(i, { type: val })}
                />
                <div className="w-px h-5 bg-[#E2E8F0] shrink-0" />
                <AddressAutocomplete
                  value={addr.address}
                  onChange={(val) => updateAddress(i, { address: val })}
                  placeholder="Search or enter address..."
                  className="flex-1 min-w-0"
                />
              </div>
              <RemoveButton onClick={() => removeAddress(i)} />
            </div>
          ))}
          <AddButton label="Add Address" onClick={addAddress} />
        </div>
      )}
    </div>
  );
}

/* Inline address type with custom "Other" support */
function AddressTypeInline({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const presets = ["Home", "Work", "Mailing"];
  const isPreset = presets.includes(value);
  const [editing, setEditing] = useState(false);
  const [customText, setCustomText] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commit = () => {
    const trimmed = customText.trim();
    onChange(trimmed || "Other");
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={customText}
        onChange={(e) => setCustomText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") { setEditing(false); }
        }}
        className="h-full px-3 text-sm text-[#0F172A] bg-transparent border-none outline-none w-[90px]"
        style={{ fontWeight: 500 }}
        placeholder="Label..."
      />
    );
  }

  if (!isPreset && value) {
    return (
      <button
        type="button"
        onClick={() => { setCustomText(value); setEditing(true); }}
        className="h-full px-3 text-sm text-[#0F172A] bg-transparent border-none outline-none cursor-pointer shrink-0 hover:bg-[#F8FAFC] transition-colors"
        style={{ fontWeight: 500 }}
        title="Click to edit"
      >
        {value}
      </button>
    );
  }

  return (
    <select
      value={value}
      onChange={(e) => {
        if (e.target.value === "__other__") {
          setCustomText("Other");
          setEditing(true);
          onChange("Other");
        } else {
          onChange(e.target.value);
        }
      }}
      className="h-full px-3 text-sm text-[#0F172A] bg-transparent border-none outline-none appearance-none cursor-pointer shrink-0 bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2394a3b8%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_4px_center] pr-6"
      style={{ fontWeight: 500 }}
    >
      {presets.map((p) => (
        <option key={p} value={p}>{p}</option>
      ))}
      <option value="__other__">Other…</option>
    </select>
  );
}

function EmergencySection({
  draft,
  addEmergencyContact,
  removeEmergencyContact,
  updateEmergencyContact,
}: {
  draft: AdditionalDetails;
  addEmergencyContact: () => void;
  removeEmergencyContact: (i: number) => void;
  updateEmergencyContact: (i: number, p: Partial<EmergencyContact>) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="mb-2">
        <h4 className="text-[13px] sm:text-sm text-[#0F172A]" style={{ fontWeight: 600 }}>Emergency Contacts</h4>
        <p className="text-[11px] sm:text-xs text-[#94A3B8] mt-0.5">People to contact in an emergency</p>
      </div>

      {draft.emergencyContacts.length === 0 ? (
        <EmptyState
          icon={Heart}
          title="No Emergency Contacts"
          description="Emergency contacts ensure the right people are reached quickly when it matters. We recommend adding at least one."
          actionLabel="Add emergency contact"
          onAction={addEmergencyContact}
        />
      ) : (
        <div className="rounded-xl p-5 space-y-3" style={{ backgroundColor: "#F8FAFC" }}>
          {draft.emergencyContacts.map((contact, i) => (
            <div
              key={i}
              className="rounded-xl p-4 space-y-3"
              style={{ backgroundColor: "white", boxShadow: "0 1px 2px 0 rgba(15, 23, 42, 0.04)" }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[12px] text-[#64748B] tracking-wider" style={{ fontWeight: 600 }}>
                    Contact {i + 1}
                  </span>
                  {contact.isPrimary && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] bg-[#EDF4FF] text-[#007FFF]" style={{ fontWeight: 600 }}>
                      Primary
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => updateEmergencyContact(i, { isPrimary: !contact.isPrimary })}
                    className={`relative inline-flex items-center h-6 w-11 rounded-full shrink-0 cursor-pointer transition-colors duration-200 ${
                      contact.isPrimary ? "bg-[#007FFF]" : "bg-[#E2E8F0]"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transform transition-transform duration-200 ${
                        contact.isPrimary ? "translate-x-[22px]" : "translate-x-1"
                      }`}
                    />
                  </button>
                  <span className="text-[11.5px] shrink-0" style={{ fontWeight: 500, color: contact.isPrimary ? "#007FFF" : "#94A3B8" }}>
                    Primary
                  </span>
                  <RemoveButton onClick={() => removeEmergencyContact(i)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <SectionLabel>Full Name <span className="text-red-500">*</span></SectionLabel>
                  <input
                    type="text"
                    value={contact.fullName}
                    onChange={(e) => updateEmergencyContact(i, { fullName: e.target.value })}
                    placeholder="e.g. Jane Smith"
                    className={inputClass}
                  />
                </div>
                <div>
                  <SectionLabel>Relationship <span className="text-red-500">*</span></SectionLabel>
                  <select
                    value={contact.relationship}
                    onChange={(e) => updateEmergencyContact(i, { relationship: e.target.value })}
                    className={selectClass}
                  >
                    <option value="">Select relationship...</option>
                    {RELATIONSHIP_OPTIONS.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <SectionLabel>Phone Number <span className="text-red-500">*</span></SectionLabel>
                <PhoneInput
                  countryCode={contact.countryCode}
                  number={contact.phone}
                  onCountryCodeChange={(code) => updateEmergencyContact(i, { countryCode: code })}
                  onNumberChange={(num) => updateEmergencyContact(i, { phone: num })}
                />
              </div>
            </div>
          ))}
          <AddButton label="Add Emergency Contact" onClick={addEmergencyContact} />
        </div>
      )}
    </div>
  );
}

function LegalSection({
  draft,
  addCitizenship,
  removeCitizenship,
  updateCitizenship,
}: {
  draft: AdditionalDetails;
  addCitizenship: () => void;
  removeCitizenship: (i: number) => void;
  updateCitizenship: (i: number, p: Partial<CitizenshipEntry>) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="mb-2">
        <h4 className="text-[13px] sm:text-sm text-[#0F172A]" style={{ fontWeight: 600 }}>Legal & Compliance</h4>
        <p className="text-[11px] sm:text-xs text-[#94A3B8] mt-0.5">Citizenship records for tax and work authorization</p>
      </div>

      {draft.citizenships.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="No Citizenships Recorded"
          description="Citizenship records support tax compliance, benefits eligibility, and work authorization verification."
          actionLabel="Add citizenship"
          onAction={addCitizenship}
        />
      ) : (
        <div className="rounded-xl p-5 space-y-3" style={{ backgroundColor: "#F8FAFC" }}>
          <div className="text-[12px] text-[#64748B] tracking-wider" style={{ fontWeight: 600 }}>
            Citizenships
          </div>
          {draft.citizenships.map((cit, i) => (
            <div key={i} className="flex items-center gap-2 rounded-xl p-3" style={{ backgroundColor: "white", boxShadow: "0 1px 2px 0 rgba(15, 23, 42, 0.04)" }}>
              <select
                value={cit.country}
                onChange={(e) => updateCitizenship(i, { country: e.target.value })}
                className={`${selectFlexClass}`}
              >
                <option value="">Select country...</option>
                {COUNTRY_OPTIONS.map((c) => (
                  <option key={c} value={c}>{COUNTRY_FLAG_MAP[c] ? `${COUNTRY_FLAG_MAP[c]} ${c}` : c}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => updateCitizenship(i, { isPrimary: !cit.isPrimary })}
                className={`relative inline-flex items-center h-6 w-11 rounded-full shrink-0 cursor-pointer transition-colors duration-200 ${
                  cit.isPrimary ? "bg-[#007FFF]" : "bg-[#E2E8F0]"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transform transition-transform duration-200 ${
                    cit.isPrimary ? "translate-x-[22px]" : "translate-x-1"
                  }`}
                />
              </button>
              <span className="text-[11.5px] shrink-0" style={{ fontWeight: 500, color: cit.isPrimary ? "#007FFF" : "#94A3B8" }}>
                Primary
              </span>
              <RemoveButton onClick={() => removeCitizenship(i)} />
            </div>
          ))}
          <AddButton label="Add Citizenship" onClick={addCitizenship} />
        </div>
      )}
    </div>
  );
}

/* ─── Notes & Attachments Section ─── */
function NotesAttachmentsSection({
  draft,
  updateDraft,
}: {
  draft: AdditionalDetails;
  updateDraft: (partial: Partial<AdditionalDetails>) => void;
}) {
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    const newFiles = Array.from(fileList).map((f) => ({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: f.name,
      size: formatFileSize(f.size),
      type: f.type,
    }));
    updateDraft({ attachments: [...draft.attachments, ...newFiles] });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleRemove = (id: string) => {
    updateDraft({ attachments: draft.attachments.filter((f) => f.id !== id) });
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith("image/")) return "🖼️";
    if (type.includes("pdf")) return "📄";
    if (type.includes("spreadsheet") || type.includes("excel") || type.includes("csv")) return "📊";
    if (type.includes("word") || type.includes("document")) return "📝";
    return "📎";
  };

  const noteCharCount = draft.notes.length;
  const MAX_NOTES = 200;

  return (
    <div className="space-y-5">
      <div className="mb-1">
        <h4 className="text-[13px] sm:text-sm text-[#0F172A]" style={{ fontWeight: 600 }}>Notes & Attachments</h4>
        <p className="text-[11px] sm:text-xs text-[#94A3B8] mt-0.5">Internal notes and supporting documents</p>
      </div>

      {/* Notes */}
      <div>
        <SectionLabel>Notes</SectionLabel>
        <div className="relative">
          <textarea
            value={draft.notes}
            onChange={(e) => {
              if (e.target.value.length <= MAX_NOTES) updateDraft({ notes: e.target.value });
            }}
            placeholder="Add any notes about this user..."
            rows={4}
            className="w-full px-3.5 py-3 pb-7 border border-[#E2E8F0] rounded-[8px] text-sm text-[#0F172A] bg-white focus:outline-none focus:ring-1 focus:ring-[#007FFF]/20 focus:border-[#007FFF] transition-all placeholder:text-[#94A3B8] resize-none"
            style={{ minHeight: "120px" }}
          />
          <span
            className="absolute bottom-2.5 right-3 text-[11px] pointer-events-none"
            style={{ fontWeight: 420, color: noteCharCount >= MAX_NOTES ? "#DC2626" : "#94A3B8" }}
          >
            {noteCharCount}/{MAX_NOTES}
          </span>
        </div>
      </div>

      {/* Attachments */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <SectionLabel>Attachments</SectionLabel>
          {draft.attachments.length > 0 && (
            <span className="text-[10px] text-[#64748B] bg-[#F1F5F9] px-1.5 py-0.5 rounded-full" style={{ fontWeight: 500 }}>{draft.attachments.length}</span>
          )}
        </div>

        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`rounded-lg border-2 border-dashed p-3 sm:p-4 text-center cursor-pointer transition-all ${
            dragActive
              ? "border-[#0A77FF] bg-[#EDF4FF]/30"
              : "border-[#E2E8F0] bg-white hover:border-[#CBD5E1] hover:bg-[#FAFBFC]"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={(e) => handleFiles(e.target.files)}
            className="hidden"
          />
          <div className="flex flex-col items-center gap-2">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              dragActive ? "bg-[#D6E8FF] text-[#0A77FF]" : "bg-[#F1F5F9] text-[#94A3B8]"
            }`}>
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs sm:text-sm text-[#0F172A]" style={{ fontWeight: 500 }}>
                <span className="text-[#0A77FF]">Click to upload</span><span className="hidden sm:inline"> or drag and drop</span>
              </p>
              <p className="text-[10px] sm:text-xs text-[#94A3B8] mt-0.5">PDF, DOC, XLS, PNG, JPG up to 10MB</p>
            </div>
          </div>
        </div>

        {/* Uploaded files list */}
        {draft.attachments.length > 0 && (
          <div className="mt-2.5 space-y-1.5">
            {draft.attachments.map((file) => (
              <div
                key={file.id}
                className="flex items-center gap-2.5 px-3 py-2 rounded-md border border-[#E2E8F0] bg-white hover:bg-[#FAFBFC] transition-colors group"
              >
                <span className="text-base">{getFileIcon(file.type)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#0F172A] truncate" style={{ fontWeight: 500 }}>{file.name}</p>
                  <p className="text-[11px] text-[#94A3B8]">{file.size}</p>
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleRemove(file.id); }}
                  className="w-7 h-7 rounded-md flex items-center justify-center text-[#94A3B8] hover:text-[#EF4444] hover:bg-[#FEF2F2] transition-colors sm:opacity-0 sm:group-hover:opacity-100 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
