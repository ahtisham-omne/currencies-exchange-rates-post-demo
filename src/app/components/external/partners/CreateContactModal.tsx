/* CreateContactModal — thin adapter that mounts the verbatim
 * CreatePocModal (ported from Partner Management) outside of
 * CreatePartnerModal's scope so Quote/SO search overlays can route the
 * "Create a new point of contact …" CTA into the canonical contact
 * creation flow. Owns all the controlled props locally, surfaces a
 * StateTransitionOverlay + toast on success (mirrors
 * CreateCustomerModal). */
import { useState } from "react";
import { toast } from "sonner";
import { CreatePocModal } from "./PocModals";
import StateTransitionOverlay from "../../shared/StateTransitionOverlay";

export interface CreatedContactPayload {
  id: string;
  name: string;
  initials: string;
  department: string;
  role: string;
  phone: string;
  phoneExt: string;
  mobile: string;
  email: string;
  /** id of the company/customer chosen in the Company picker. Null when
   *  the caller did not supply companyOptions (free-text mode) or when
   *  no selection was made. */
  companyId: string | null;
  companyName: string;
}

interface CreateContactModalProps {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  onCreated: (payload: CreatedContactPayload) => void;
  /** Optional pre-populated name — wired through to CreatePocModal on every open. */
  seedName?: string;
  /** Optional company/customer label shown in the modal header. */
  contextName?: string;
  /** Existing contact names to flag duplicates (case-insensitive). */
  existingContactNames?: string[];
  /** Fired when the user picks "Use existing contact" on the duplicate prompt. */
  onUseExisting?: (existingName: string) => void;
  /** Quote/SO callers pass their MOCK_CUSTOMERS so the Company picker
   *  lists our customers instead of partner-management's vendor
   *  directory. When set, callers should also set companyRequired. */
  companyOptions?: { id: string; name: string; subtitle?: string }[];
  /** Render the Company field as required (red asterisk + Save gated). */
  companyRequired?: boolean;
  /** Override the "Company" label (e.g. "Customer"). */
  companyLabel?: string;
  /** Pre-select a company on open (id must exist in companyOptions). */
  initialCompanyId?: string;
  initialCompanyName?: string;
}

function deriveInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function CreateContactModal({
  open,
  onOpenChange,
  onCreated,
  seedName,
  contextName,
  existingContactNames,
  onUseExisting,
  companyOptions,
  companyRequired,
  companyLabel,
  initialCompanyId,
  initialCompanyName,
}: CreateContactModalProps) {
  const [name, setName] = useState(seedName || "");
  const [department, setDepartment] = useState("");
  const [role, setRole] = useState("");
  const [landline, setLandline] = useState("");
  const [landlineCode, setLandlineCode] = useState("+1");
  const [ext, setExt] = useState("");
  const [mobile, setMobile] = useState("");
  const [mobileCode, setMobileCode] = useState("+1");
  const [email, setEmail] = useState("");
  const [saveAndCreateAnother, setSaveAndCreateAnother] = useState(false);
  const [pendingPayload, setPendingPayload] = useState<CreatedContactPayload | null>(null);
  const [showDuplicateConfirm, setShowDuplicateConfirm] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(initialCompanyId ?? null);
  const [companyName, setCompanyName] = useState<string>(initialCompanyName ?? "");

  if (open && seedName && name === "" && seedName !== "") {
    queueMicrotask(() => setName(seedName));
  }

  const reset = () => {
    setName("");
    setDepartment("");
    setRole("");
    setLandline("");
    setLandlineCode("+1");
    setExt("");
    setMobile("");
    setMobileCode("+1");
    setEmail("");
    setSaveAndCreateAnother(false);
    setCompanyId(initialCompanyId ?? null);
    setCompanyName(initialCompanyName ?? "");
  };

  const duplicateMatch = (() => {
    if (!existingContactNames || existingContactNames.length === 0) return null;
    const typed = name.trim().toLowerCase();
    if (!typed) return null;
    return existingContactNames.find((n) => n.trim().toLowerCase() === typed) || null;
  })();

  const commit = () => {
    const payload: CreatedContactPayload = {
      id: `C-NEW-${Date.now()}`,
      name: name.trim(),
      initials: deriveInitials(name),
      department,
      role,
      phone: landline ? `${landlineCode} ${landline}` : "",
      phoneExt: ext,
      mobile: mobile ? `${mobileCode} ${mobile}` : "",
      email,
      companyId,
      companyName,
    };
    onOpenChange(false);
    reset();
    setPendingPayload(payload);
  };

  return (
    <>
      <CreatePocModal
        open={open}
        onOpenChange={(next) => {
          onOpenChange(next);
          if (!next) reset();
        }}
        contextName={initialCompanyName || contextName}
        companyOptions={companyOptions}
        companyRequired={companyRequired}
        companyLabel={companyLabel}
        onCompanyChange={(sel) => {
          setCompanyId(sel.id);
          setCompanyName(sel.name);
        }}
        newPocName={name}
        onNewPocNameChange={setName}
        newPocDepartment={department}
        onNewPocDepartmentChange={setDepartment}
        newPocRole={role}
        onNewPocRoleChange={setRole}
        newPocLandline={landline}
        onNewPocLandlineChange={setLandline}
        newPocLandlineCode={landlineCode}
        onNewPocLandlineCodeChange={setLandlineCode}
        newPocExt={ext}
        onNewPocExtChange={setExt}
        newPocMobile={mobile}
        onNewPocMobileChange={setMobile}
        newPocMobileCode={mobileCode}
        onNewPocMobileCodeChange={setMobileCode}
        newPocEmail={email}
        onNewPocEmailChange={setEmail}
        saveAndCreateAnother={saveAndCreateAnother}
        onSaveAndCreateAnotherChange={setSaveAndCreateAnother}
        duplicatePocMatchName={duplicateMatch}
        onSave={() => {
          if (!name.trim()) {
            toast.error("Name is required");
            return;
          }
          if (duplicateMatch) {
            setShowDuplicateConfirm(true);
            return;
          }
          commit();
        }}
      />
      {showDuplicateConfirm && duplicateMatch && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 16000,
            background: "rgba(15,23,42,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setShowDuplicateConfirm(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="sm:max-w-[400px] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)] bg-white"
            style={{ maxWidth: 400, width: "100%" }}
          >
            <div className="relative flex flex-col items-center pt-10 pb-6" style={{ background: "linear-gradient(180deg, #FFFBEB 0%, rgba(255,251,235,0.3) 70%, transparent 100%)" }}>
              <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "#FEF3C7" }}>
                <span style={{ color: "#B45309", fontWeight: 700, fontSize: 22 }}>!</span>
              </div>
              <span className="mt-4 px-3 py-1 rounded-full text-[11px]" style={{ fontWeight: 600, backgroundColor: "#FFFBEB", color: "#92400E", textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>
                Duplicate
              </span>
            </div>
            <div className="flex flex-col items-center text-center px-8 pb-8">
              <h3 className="text-[18px]" style={{ fontWeight: 600, color: "var(--foreground)", letterSpacing: "-0.02em" }}>Contact already exists</h3>
              <p className="text-[13px] mt-2 max-w-[320px] mx-auto" style={{ color: "var(--muted-foreground)", lineHeight: "1.65" }}>
                A contact named &ldquo;{duplicateMatch}&rdquo; is already in your directory. Use the existing one, or save a new contact anyway.
              </p>
              <div className="w-full mt-7 flex flex-col gap-2.5">
                <button
                  onClick={() => {
                    setShowDuplicateConfirm(false);
                    commit();
                  }}
                  className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90"
                  style={{ fontWeight: 600, backgroundColor: "#F59E0B", color: "#fff" }}
                >
                  Save new contact anyway
                </button>
                <button
                  onClick={() => {
                    setShowDuplicateConfirm(false);
                    onOpenChange(false);
                    reset();
                    onUseExisting?.(duplicateMatch);
                  }}
                  className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
                  style={{ fontWeight: 500, backgroundColor: "var(--muted)", color: "#334155" }}
                >
                  Use existing contact
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <StateTransitionOverlay
        isActive={pendingPayload !== null}
        heading="Adding contact"
        fromLabel="New record"
        toLabel={pendingPayload?.name || "Contact"}
        tone="success"
        meta="Saving contact details"
        duration={1600}
        onComplete={() => {
          if (pendingPayload) {
            onCreated(pendingPayload);
            toast.success(`${pendingPayload.name || "Contact"} added`);
          }
          setPendingPayload(null);
        }}
      />
    </>
  );
}
