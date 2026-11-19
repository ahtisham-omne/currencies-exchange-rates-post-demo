import { useMemo, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Globe, UserCheck } from "lucide-react";
import { PageHeader } from "../shared/PageHeader";
import { HeaderTabs, type HeaderTabDef } from "../shared/HeaderTabs";
import { useUserQuickView } from "../shared/UserQuickViewPanel";
import { CurrencyValue } from "../currency/CurrencyDropdown";
import { FlagImage } from "../currency/FlagImage";
import { Field, SettingsCard, TimezoneValue } from "./SettingsParts";
import { EditCompanyInfoModal } from "./EditCompanyInfoModal";
import { EditGlobalSettingsModal } from "./EditGlobalSettingsModal";
import { useGeneralSettings } from "./generalSettingsStore";
import { countryFlag, dialFlag } from "./countries";
import { ADDRESS_TIP, BASE_CURRENCY_TIP, BILLING_ANCHOR_TIP, EMAIL_TIP, LANGUAGE_TIP, MFA_TIP } from "./copy";
import { getUsersForRole } from "../../data/uac-derived";
import { ACCOUNT_OWNER_ROLE_ID } from "../../data/account-owner";
import { getAvatarTint, getInitials, resolveUserAvatar } from "../../lib/avatar";

/* ── General Settings · Company Profile ────────────────────────────────
 * The General Settings prototype's Company Profile tab (alert-settings-omne),
 * brought into UAC: Company Information on the left; Account Owners and Global
 * Preferences on the right. Global Preferences carries the company's Base
 * Currency, the currency touchpoint here: shown with its flag and symbol, and
 * changed in Edit Global Settings with the currency dropdown every module
 * shares. Storage and Activity Log stay with the prototype for now. */

type TabId = "profile" | "storage" | "activity";
const TABS: readonly HeaderTabDef<TabId>[] = [
  { id: "profile", label: "Company Profile" },
  { id: "storage", label: "Storage", disabled: true, disabledTooltip: "Coming soon" },
  { id: "activity", label: "Activity Log", disabled: true, disabledTooltip: "Coming soon" },
];

/** The header tile's company initial, in place of an icon. */
function companyInitial(name: string) {
  const letter = (name.trim()[0] ?? "O").toUpperCase();
  return function CompanyInitial({ className, style }: { className?: string; style?: CSSProperties }) {
    return (
      <span className={`${className ?? ""} inline-flex items-center justify-center`} style={{ ...style, fontSize: 14, fontWeight: 700, lineHeight: 1 }}>
        {letter}
      </span>
    );
  };
}

export function GeneralSettingsPage() {
  const navigate = useNavigate();
  const { profile, preferences } = useGeneralSettings();
  const [editing, setEditing] = useState<"company" | "global" | null>(null);
  const HeaderIcon = useMemo(() => companyInitial(profile.legalName), [profile.legalName]);

  return (
    <div className="w-full font-['Inter',sans-serif] flex flex-col h-full min-h-0">
      <PageHeader
        icon={HeaderIcon}
        iconBg="#0A77FF"
        iconColor="#FFFFFF"
        onBack={() => navigate("/company-settings")}
        backLabel="Back to Company Settings"
        title={profile.legalName}
        subtitle="Manage your company profile, global preferences, storage, and account settings."
        bottomSlot={<HeaderTabs tabs={TABS} value="profile" onChange={() => {}} />}
      />

      <div className="flex-1 min-h-0 overflow-y-auto px-6 lg:px-8 pt-4 pb-6">
        <div className="grid grid-cols-1 lg:grid-cols-[7fr_3fr] gap-5 items-start">
          <SettingsCard icon={Building2} title="Company Information" onEdit={() => setEditing("company")}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 py-4">
              <Field label="Primary Business Address" tip={ADDRESS_TIP}>
                {profile.address}
              </Field>
              <Field label="General Email" tip={EMAIL_TIP}>
                {profile.email}
              </Field>
              <Field label="Phone">
                <span className="inline-flex items-center gap-1.5">
                  <FlagImage code={dialFlag(profile.phoneCode)} className="shrink-0 text-[13px]" />
                  <span>
                    {profile.phoneCode} {profile.phone}
                  </span>
                </span>
              </Field>
              <Field label="Website">
                {profile.website ? (
                  <a href={profile.website} target="_blank" rel="noreferrer" className="hover:underline" style={{ color: "#2563EB" }}>
                    {profile.website}
                  </a>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </Field>
              <Field label="Industry">{profile.industry || <span className="text-slate-400">—</span>}</Field>
              <Field label="Country of Registration">
                <span className="inline-flex items-center gap-1.5">
                  <FlagImage code={countryFlag(profile.country)} className="shrink-0 text-[13px]" />
                  <span>{profile.country}</span>
                </span>
              </Field>
              <Field label="State / Region">{profile.state || <span className="text-slate-400">—</span>}</Field>
              <Field label="Date of Registration">{profile.dateOfRegistration || <span className="text-slate-400">—</span>}</Field>
              <Field label="Billing Anchor Date" tip={BILLING_ANCHOR_TIP}>
                {profile.billingAnchorDate}
              </Field>
            </div>
          </SettingsCard>

          <div className="space-y-5 min-w-0">
            <AccountOwnersCard />

            <SettingsCard icon={Globe} title="Global Preferences" onEdit={() => setEditing("global")}>
              <div
                className="grid py-4"
                style={{ gridTemplateColumns: "repeat(auto-fit, minmax(max(180px, 50% - 10px), 1fr))", columnGap: 20, rowGap: 16 }}
              >
                <Field label="Timezone" wide>
                  <TimezoneValue zone={preferences.timezone} />
                </Field>
                <Field label="Date Format">{preferences.dateFormat}</Field>
                <Field label="Time Format">{preferences.timeFormat}</Field>
                <Field label="Base Currency" tip={BASE_CURRENCY_TIP} wide>
                  {/* Not locked here; the info tooltip says when it locks (Mahreen, 2026-11-20). */}
                  <CurrencyValue code={preferences.baseCurrency} />
                </Field>
                <Field label="Functional Language" tip={LANGUAGE_TIP}>
                  {preferences.language}
                </Field>
                <Field label="First Day of Week">{preferences.firstDayOfWeek}</Field>
                <Field label="Require MFA" tip={MFA_TIP}>
                  <span
                    className="inline-flex items-center h-[22px] px-2 rounded-full border text-[11px]"
                    style={
                      preferences.requireMfa
                        ? { backgroundColor: "#ECFDF5", color: "#065F46", borderColor: "#A7F3D0", fontWeight: 600 }
                        : { backgroundColor: "#F1F5F9", color: "#475569", borderColor: "#E2E8F0", fontWeight: 600 }
                    }
                  >
                    {preferences.requireMfa ? "Enabled" : "Disabled"}
                  </span>
                </Field>
              </div>
            </SettingsCard>
          </div>
        </div>
      </div>

      <EditCompanyInfoModal open={editing === "company"} onClose={() => setEditing(null)} />
      <EditGlobalSettingsModal open={editing === "global"} onClose={() => setEditing(null)} />
    </div>
  );
}

/** The people holding the protected Account Owner role, read from UAC itself. */
function AccountOwnersCard() {
  const { openQuickView } = useUserQuickView();
  const owners = getUsersForRole(ACCOUNT_OWNER_ROLE_ID);
  return (
    <SettingsCard icon={UserCheck} title="Account Owners">
      <div className="py-4 space-y-3">
        <p className="text-[11px] text-[#64748B]" style={{ lineHeight: 1.5 }}>
          Users with the protected Account Owner role in User Access Control appear here automatically.
        </p>
        {owners.map((u) => {
          const photo = resolveUserAvatar({ userId: u.id, name: u.fullName });
          const tint = getAvatarTint(u.fullName);
          return (
            <div key={u.id} className="rounded-lg border border-[#E2E8F0] bg-[#FAFBFC] p-3 flex items-center gap-3 min-w-0">
              {photo ? (
                <img src={photo} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
              ) : (
                <span
                  className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 text-[12px]"
                  style={{ backgroundColor: tint.bg, color: tint.fg, fontWeight: 600 }}
                >
                  {getInitials(u.fullName)}
                </span>
              )}
              <div className="min-w-0">
                <button
                  type="button"
                  onClick={() => openQuickView(u.id)}
                  className="block max-w-full truncate text-left text-[13px] text-[#0F172A] hover:text-[#0A77FF] hover:underline cursor-pointer"
                  style={{ fontWeight: 600 }}
                >
                  {u.fullName}
                </button>
                <p className="text-[11px] text-[#64748B] truncate">{u.email}</p>
                {u.phone && <p className="text-[11px] text-[#64748B] truncate">{u.phone}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </SettingsCard>
  );
}
