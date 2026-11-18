import { useEffect, useState } from "react";
import { Briefcase, Scale } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { AddressAutocomplete } from "../shared/AddressAutocomplete";
import { PhoneInput } from "../shared/PhoneInput";
import { DatePickerInput } from "../create-user/DatePickerInput";
import { FlagSearchDropdown } from "../currency/CurrencyDropdown";
import { FieldLabel, ModalSection, SettingsModal } from "./SettingsParts";
import { INDUSTRIES, saveProfile, useGeneralSettings, type CompanyProfile } from "./generalSettingsStore";
import { COUNTRY_OPTIONS } from "./countries";
import { ADDRESS_TIP, EMAIL_TIP } from "./copy";

/* ── Edit Company Information ───────────────────────────────────────────
 * The prototype's dialog: General Details and Legal Information, built from
 * UAC's own address search, phone field and date picker. The country picker
 * is the same flagged search dropdown as Base Currency. */

const INPUT =
  "mt-1 w-full h-10 px-3 rounded-lg border border-[#E2E8F0] bg-white text-sm text-[#0F172A] placeholder:text-slate-400 outline-none transition-colors hover:border-slate-300 focus:border-[#0A77FF] focus:ring-2 focus:ring-[#0A77FF]/10";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function EditCompanyInfoModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { profile } = useGeneralSettings();
  const [draft, setDraft] = useState<CompanyProfile>(profile);
  useEffect(() => {
    if (open) setDraft(profile);
  }, [open, profile]);
  const set = <K extends keyof CompanyProfile>(key: K, value: CompanyProfile[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const emailBad = draft.email.trim() !== "" && !EMAIL_RE.test(draft.email.trim());
  const missing = !draft.legalName.trim() || !draft.address.trim() || !draft.email.trim() || !draft.phone.trim();

  const save = () => {
    saveProfile({
      ...draft,
      legalName: draft.legalName.trim(),
      email: draft.email.trim(),
      website: draft.website.trim(),
      state: draft.state.trim(),
    });
    toast.success("Company information updated");
    onClose();
  };

  return (
    <SettingsModal
      open={open}
      onClose={onClose}
      title="Edit Company Information"
      subtitle="Update your company's business and legal information."
      onSave={save}
      saveDisabled={missing || emailBad}
    >
      <ModalSection icon={Briefcase} title="General Details">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
          <div>
            <FieldLabel required htmlFor="gs-legal-name">
              Legal Name
            </FieldLabel>
            <input
              id="gs-legal-name"
              value={draft.legalName}
              onChange={(e) => set("legalName", e.target.value)}
              placeholder="e.g. Omnesoft Industries Inc."
              className={INPUT}
            />
          </div>
          <div>
            <FieldLabel required tip={ADDRESS_TIP} htmlFor="gs-address">
              Primary Business Address
            </FieldLabel>
            <div className="mt-1">
              <AddressAutocomplete id="gs-address" value={draft.address} onChange={(v) => set("address", v)} placeholder="Search address..." />
            </div>
          </div>
          <div>
            <FieldLabel required tip={EMAIL_TIP} htmlFor="gs-email">
              General Email
            </FieldLabel>
            <input
              id="gs-email"
              type="email"
              value={draft.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="e.g. admin@omnesoft.com"
              aria-invalid={emailBad || undefined}
              className={`${INPUT} ${emailBad ? "!border-red-400 focus:!ring-red-100" : ""}`}
            />
            {emailBad && <p className="mt-1 text-[11px] text-red-500">Enter a valid email address.</p>}
          </div>
          <div>
            <FieldLabel required>Company's Phone Number</FieldLabel>
            <PhoneInput
              className="mt-1"
              countryCode={draft.phoneCode}
              number={draft.phone}
              onCountryCodeChange={(c) => set("phoneCode", c)}
              onNumberChange={(n) => set("phone", n)}
            />
          </div>
          <div>
            <FieldLabel htmlFor="gs-website">Website</FieldLabel>
            <input
              id="gs-website"
              value={draft.website}
              onChange={(e) => set("website", e.target.value)}
              placeholder="https://example.com"
              className={INPUT}
            />
          </div>
          <div>
            <FieldLabel>Industry</FieldLabel>
            <Select value={draft.industry} onValueChange={(v) => set("industry", v)}>
              <SelectTrigger className="mt-1 !h-10 w-full rounded-lg border-[#E2E8F0] bg-white text-sm text-[#0F172A]" aria-label="Industry">
                <SelectValue placeholder="Select an industry" />
              </SelectTrigger>
              <SelectContent className="z-[250]">
                {INDUSTRIES.map((i) => (
                  <SelectItem key={i} value={i}>
                    {i}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </ModalSection>

      <ModalSection icon={Scale} title="Legal Information">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
          <div>
            <FieldLabel>Country of Legal Registration</FieldLabel>
            <FlagSearchDropdown
              options={COUNTRY_OPTIONS}
              value={draft.country}
              onChange={(name) => set("country", name)}
              placeholder="Select a country"
              searchPlaceholder="Search countries…"
              ariaLabel="Country of Legal Registration"
            />
          </div>
          <div>
            <FieldLabel htmlFor="gs-state">State / Province / Region of Legal Registration</FieldLabel>
            <input id="gs-state" value={draft.state} onChange={(e) => set("state", e.target.value)} placeholder="e.g. Delaware" className={INPUT} />
          </div>
          <div>
            <FieldLabel>Date of Registration / Year Business Started</FieldLabel>
            <div className="mt-1">
              <DatePickerInput value={draft.dateOfRegistration} onChange={(v) => set("dateOfRegistration", v)} className={`${INPUT} !mt-0 pr-9`} />
            </div>
          </div>
        </div>
      </ModalSection>
    </SettingsModal>
  );
}
