import { useEffect, useState } from "react";
import { Globe, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { CurrencyDropdown } from "../currency/CurrencyDropdown";
import { FieldLabel, LockedField, ModalSection, OptionCards, SettingsModal, TimezoneValue } from "./SettingsParts";
import { DATE_FORMATS, savePreferences, useGeneralSettings, type FirstDayOfWeek, type GlobalPreferences, type TimeFormat } from "./generalSettingsStore";
import { BASE_CURRENCY_TIP } from "./copy";

/* ── Edit Global Settings ───────────────────────────────────────────────
 * The prototype's dialog, field for field, with one change: its locked
 * "Default Display Currency" is the company's Base Currency here, chosen with
 * the currency dropdown every module shares (every active currency, searchable
 * by code, name or country). */

const TIME_FORMATS: readonly TimeFormat[] = ["12-hour", "24-hour"];
const FIRST_DAYS: readonly FirstDayOfWeek[] = ["Saturday", "Sunday", "Monday"];

/** The time now in a zone, as the locked Timezone field shows it: "9:59 AM". */
const timeIn = (zone: string) => new Date().toLocaleTimeString("en-US", { timeZone: zone, hour: "numeric", minute: "2-digit" });

export function EditGlobalSettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { preferences } = useGeneralSettings();
  const [draft, setDraft] = useState<GlobalPreferences>(preferences);
  useEffect(() => {
    if (open) setDraft(preferences);
  }, [open, preferences]);
  const set = <K extends keyof GlobalPreferences>(key: K, value: GlobalPreferences[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const save = () => {
    savePreferences(draft);
    toast.success("Global settings updated");
    onClose();
  };

  return (
    <SettingsModal
      open={open}
      onClose={onClose}
      title="Edit Global Settings"
      subtitle="Update tenant-wide defaults for timezone, date and time formats, currency, language, and MFA."
      onSave={save}
    >
      <ModalSection icon={Globe} title="Display Preferences">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
          <div>
            <FieldLabel required>Timezone</FieldLabel>
            <LockedField
              why="The time zone can't be changed once documents such as invoices, purchase orders, or sales orders have been generated."
              trailing={
                <span className="text-[12px] text-slate-500 tabular-nums" aria-label="Current time in this time zone" style={{ fontWeight: 500 }}>
                  {timeIn(draft.timezone)}
                </span>
              }
            >
              <TimezoneValue zone={draft.timezone} />
            </LockedField>
          </div>
          <div>
            <FieldLabel required>Date Format</FieldLabel>
            <Select value={draft.dateFormat} onValueChange={(v) => set("dateFormat", v)}>
              <SelectTrigger className="mt-1 !h-10 w-full rounded-lg border-[#E2E8F0] bg-white text-sm text-[#0F172A]" aria-label="Date Format">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[250]">
                {DATE_FORMATS.map((f) => (
                  <SelectItem key={f} value={f}>
                    {f}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <FieldLabel required>Time Format</FieldLabel>
            <OptionCards options={TIME_FORMATS} value={draft.timeFormat} onChange={(v) => set("timeFormat", v)} />
          </div>
          <div>
            <FieldLabel tip={BASE_CURRENCY_TIP}>Base Currency</FieldLabel>
            <CurrencyDropdown
              value={draft.baseCurrency}
              onChange={(code) => set("baseCurrency", code)}
              ariaLabel="Base Currency"
            />
            {draft.baseCurrency !== preferences.baseCurrency && (
              <p className="mt-1.5 text-[11px] text-amber-700" style={{ lineHeight: 1.5 }}>
                Exchange rates will be quoted against {draft.baseCurrency} instead of {preferences.baseCurrency}.
              </p>
            )}
          </div>
          <div>
            <FieldLabel>Functional Language</FieldLabel>
            <LockedField why="Language switching is coming in a future release.">{draft.language}</LockedField>
          </div>
          <div>
            <FieldLabel>First Day of Week</FieldLabel>
            <OptionCards options={FIRST_DAYS} value={draft.firstDayOfWeek} onChange={(v) => set("firstDayOfWeek", v)} />
          </div>
        </div>
      </ModalSection>

      <ModalSection icon={ShieldCheck} title="Security Defaults">
        <button
          type="button"
          role="switch"
          aria-checked={draft.requireMfa}
          aria-describedby="require-mfa-help"
          onClick={() => set("requireMfa", !draft.requireMfa)}
          className="group flex w-full items-center gap-4 text-left rounded-[8px] border border-[#E2E8F0] bg-white px-4 py-3 outline-none cursor-pointer transition-[border-color,box-shadow,background-color] duration-200 shadow-[0_1px_2px_rgba(15,23,42,0.05)] hover:border-[#0E69E2] hover:ring-2 hover:ring-[#0E69E2]/10 hover:bg-slate-50/60 focus-visible:border-[#0E69E2] focus-visible:ring-2 focus-visible:ring-[#0E69E2]/15"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-slate-700" style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.4 }}>
              Require MFA
            </span>
            <span id="require-mfa-help" className="block text-[12px] text-slate-500 mt-1 max-w-[680px]" style={{ lineHeight: 1.5 }}>
              Users must confirm their identity with a second factor when they sign in. Who is covered and which methods they can use are set by
              the policies in Security Settings. While this is off, no policy applies.
            </span>
          </span>
          <span aria-hidden="true" className={`relative inline-flex h-[22px] w-10 shrink-0 items-center rounded-full transition-colors duration-200 ${draft.requireMfa ? "bg-green-500" : "bg-slate-300"}`}>
            <span className={`block h-[18px] w-[18px] rounded-full bg-white shadow-sm transition-transform duration-200 ${draft.requireMfa ? "translate-x-[20px]" : "translate-x-[2px]"}`} />
          </span>
        </button>
      </ModalSection>
    </SettingsModal>
  );
}
