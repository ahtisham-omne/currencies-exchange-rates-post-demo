import {
  Mail,
  Phone,
  MapPin,
  Link2,
  Globe,
  AlertTriangle,
  Info,
} from "lucide-react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "../ui/tooltip";
import { DetailCard } from "./DetailCard";
import type { UserDetail } from "../../data/user-detail-data";
import { formatFullPhone } from "../../lib/phone-format";

interface Props {
  user: UserDetail;
}

/* ── Reusable label + value: matches Role Detail FieldPair exactly ── */
function FieldPair({ label, value, isLink, href, tooltipText }: { label: string; value?: string | null; isLink?: boolean; href?: string; tooltipText?: string }) {
  const isEmpty = !value || value === "-" || value === "Not set";
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1 mb-1">
        <p
          className="truncate"
          style={{ fontSize: "12px", fontWeight: 450, color: "#94A3B8", lineHeight: "1.3" }}
        >
          {label}
        </p>
        {tooltipText && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex cursor-default">
                <Info className="w-3 h-3" style={{ color: "#94A3B8" }} />
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={4} className="max-w-[220px] text-[12px]">
              {tooltipText}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      {isEmpty ? (
        <p className="text-[13px] truncate" style={{ fontWeight: 400, color: "#94A3B8", fontStyle: "italic" }}>
          Not set
        </p>
      ) : isLink ? (
        <a
          href={href || `https://${value}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[13px] truncate block transition-colors"
          style={{ fontWeight: 500, color: "#2563eb", textDecoration: "none" }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "#1d4ed8"; e.currentTarget.style.textDecoration = "underline"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "#2563eb"; e.currentTarget.style.textDecoration = "none"; }}
        >
          {value}
        </a>
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>
            <p className="text-[13px] truncate" style={{ fontWeight: 500, color: "#1E293B" }}>
              {value}
            </p>
          </TooltipTrigger>
          {value && value.length > 25 && (
            <TooltipContent side="top" sideOffset={4} className="max-w-[300px] text-[12px]">
              {value}
            </TooltipContent>
          )}
        </Tooltip>
      )}
    </div>
  );
}

/* ── Passport expiry check ── */
function isExpiryWithin60Days(expiry: string): boolean {
  if (!expiry) return false;
  const d = new Date(expiry);
  if (isNaN(d.getTime())) return false;
  const diff = d.getTime() - Date.now();
  return diff > 0 && diff < 60 * 24 * 60 * 60 * 1000;
}

export function ContactTab({ user }: Props) {
  // Build dynamic email list
  const allEmails: { label: string; value: string; isPrimary?: boolean; tooltip?: string }[] = [];
  if (user.email) allEmails.push({ label: "Primary Email", value: user.email, isPrimary: true, tooltip: "This email address is used for notifications and sign-in." });
  if (user.additionalEmails?.length) {
    user.additionalEmails.forEach((e) => {
      if (typeof e === "string") {
        allEmails.push({ label: "Personal Email", value: e });
      } else {
        const entry = e as any;
        allEmails.push({ label: `${entry.type || "Other"} Email`, value: entry.email || entry.value || "" });
      }
    });
  }
  if (user.notificationEmail) {
    allEmails.push({ label: "Notification Override", value: user.notificationEmail, tooltip: "Alerts will be sent here instead of the primary email." });
  }

  return (
    <div className="flex gap-5 items-start">
      {/* LEFT COLUMN */}
      <div className="flex-1 min-w-0 space-y-5">
        {/* Email Addresses */}
        <DetailCard title="Email Addresses" icon={Mail}>
          <div className="py-4">
            {allEmails.length > 0 ? (
              <div className="grid grid-cols-3 gap-x-8 gap-y-5">
                {allEmails.map((em, i) => (
                  <div key={i} className="min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <p className="truncate" style={{ fontSize: "12px", fontWeight: 450, color: "#94A3B8", lineHeight: "1.3" }}>{em.label}</p>
                      {em.isPrimary && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full shrink-0" style={{ fontWeight: 600, backgroundColor: "#EDF4FF", color: "#007FFF" }}>Primary</span>
                      )}
                      {em.tooltip && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex cursor-default">
                              <Info className="w-3 h-3" style={{ color: "#94A3B8" }} />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" sideOffset={4} className="max-w-[220px] text-[12px]">
                            {em.tooltip}
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                    <p className="text-[13px] truncate" style={{ fontWeight: 500, color: "#1E293B" }}>{em.value}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[12px]" style={{ fontWeight: 400, color: "#94A3B8", fontStyle: "italic" }}>No Email Addresses Added</p>
            )}
          </div>
        </DetailCard>

        {/* Phone Numbers */}
        <DetailCard title="Phone Numbers" icon={Phone}>
          <div className="py-4">
            {user.phones?.length ? (
              <div className="grid grid-cols-3 gap-x-8 gap-y-5">
                {user.phones.map((phone, i) => (
                  <FieldPair key={i} label={phone.type} value={formatFullPhone(phone.countryCode, phone.number)} />
                ))}
              </div>
            ) : (
              <p className="text-[12px]" style={{ fontWeight: 400, color: "#94A3B8", fontStyle: "italic" }}>No Phone Numbers Added</p>
            )}
          </div>
        </DetailCard>

        {/* Addresses */}
        <DetailCard title="Addresses" icon={MapPin}>
          <div className="py-4">
            {user.addresses?.length ? (
              <div className="grid grid-cols-3 gap-x-8 gap-y-5">
                {user.addresses.map((addr, i) => (
                  <FieldPair key={i} label={`${addr.type} Address`} value={addr.address} />
                ))}
                {user.mailingAddress && (
                  <FieldPair label="Mailing Address" value={user.mailingAddress} />
                )}
              </div>
            ) : (
              <p className="text-[12px]" style={{ fontWeight: 400, color: "#94A3B8", fontStyle: "italic" }}>No Addresses Added</p>
            )}
          </div>
        </DetailCard>

        {/* Links & Handles */}
        <DetailCard title="Links & Handles" icon={Link2}>
          <div className="grid grid-cols-3 gap-x-8 gap-y-5 py-4">
            <FieldPair
              label="LinkedIn"
              value={user.linkedIn ? user.linkedIn.replace(/^https?:\/\/(www\.)?/, "") : undefined}
              isLink
              href={user.linkedIn || undefined}
            />
            <FieldPair
              label="Meeting Link"
              value={user.meetingLink || undefined}
              isLink
              href={user.meetingLink || undefined}
            />
            <FieldPair label="Slack / Teams Handle" value={user.slackHandle || undefined} />
          </div>
        </DetailCard>
      </div>

      {/* RIGHT SIDEBAR */}
      <div className="w-[340px] xl:w-[380px] shrink-0 space-y-5 hidden lg:block">
        {/* Citizenships & Languages */}
        <DetailCard title="Citizenships & Languages" icon={Globe}>
          <div className="py-3">
            {/* Citizenships */}
            <div>
              <p className="mb-2" style={{ fontSize: "12px", fontWeight: 450, color: "#94A3B8" }}>Citizenship</p>
              {user.citizenships?.length ? (
                <div className="space-y-1.5">
                  {user.citizenships.map((c, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-[13px]" style={{ fontWeight: 500, color: "#1E293B" }}>{c.country}</span>
                      {c.isPrimary && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ fontWeight: 600, backgroundColor: "#EDF4FF", color: "#007FFF" }}>Primary</span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[12px]" style={{ fontWeight: 400, color: "#94A3B8", fontStyle: "italic" }}>No Citizenships Added</p>
              )}
            </div>

            <div className="border-t my-4" style={{ borderColor: "#F1F5F9" }} />

            {/* Languages */}
            <div>
              <p className="mb-2" style={{ fontSize: "12px", fontWeight: 450, color: "#94A3B8" }}>Languages</p>
              {user.languages?.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {user.languages.map((l, i) => (
                    <span key={i} className="inline-flex items-center gap-1 text-[12px] px-2 py-1 rounded-full" style={{ fontWeight: 500, backgroundColor: "#F1F5F9", color: "#1E293B" }}>
                      {l.flag && <span>{l.flag}</span>}
                      {l.language}
                      <span style={{ color: "#94A3B8" }}>· {l.proficiency}</span>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-[12px]" style={{ fontWeight: 400, color: "#94A3B8", fontStyle: "italic" }}>No Languages Added</p>
              )}
            </div>

            <div className="border-t my-4" style={{ borderColor: "#F1F5F9" }} />

            {/* Identity Documents */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <p style={{ fontSize: "12px", fontWeight: 450, color: "#94A3B8" }}>Identity Documents</p>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ fontWeight: 600, color: "#dc2626", backgroundColor: "#fef2f2" }}>Restricted</span>
              </div>
              <div className="space-y-2.5">
                {user.nationalId && (
                  <div>
                    <p style={{ fontSize: "12px", fontWeight: 450, color: "#94A3B8" }}>National ID</p>
                    <p className="text-[13px] mt-0.5" style={{ fontWeight: 500, color: "#1E293B", fontFamily: "monospace" }}>{user.nationalId}</p>
                  </div>
                )}
                <div>
                  <p style={{ fontSize: "12px", fontWeight: 450, color: "#94A3B8" }}>Work Visa / Authorisation</p>
                  <p className="text-[13px] mt-0.5" style={{ fontWeight: user.workVisa ? 500 : 400, color: user.workVisa ? "#1E293B" : "#94A3B8", fontStyle: user.workVisa ? "normal" : "italic" }}>
                    {user.workVisa || "Not set"}
                  </p>
                </div>
                {user.passportExpiry && (
                  <div>
                    <p style={{ fontSize: "12px", fontWeight: 450, color: "#94A3B8" }}>Passport Expiry</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <p className="text-[13px]" style={{ fontWeight: 500, color: "#1E293B" }}>{user.passportExpiry}</p>
                      {isExpiryWithin60Days(user.passportExpiry) && (
                        <AlertTriangle className="w-3 h-3" style={{ color: "#f59e0b" }} />
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </DetailCard>

        {/* Emergency Contacts */}
        <div
          className="rounded-xl border overflow-hidden transition-shadow duration-150 hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
          style={{ backgroundColor: "#fffbeb", borderColor: "#fde68a", padding: "20px" }}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 style={{ fontSize: "13.5px", fontWeight: 600, color: "#92400e" }}>Emergency Contacts</h3>
          </div>
          {user.emergencyContacts?.length ? (
            <div className="space-y-3">
              {user.emergencyContacts.map((contact, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-[13px]" style={{ fontWeight: 500, color: "#1E293B" }}>
                      {contact.fullName} · {contact.relationship}
                    </p>
                    {contact.isPrimary && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ fontWeight: 600, backgroundColor: "#fef3c7", color: "#92400e" }}>Primary</span>
                    )}
                  </div>
                  <a href={`tel:${contact.countryCode}${contact.phone.replace(/\D+/g, "")}`} className="text-[13px] transition-colors" style={{ fontWeight: 500, color: "#2563eb" }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = "#1d4ed8"; e.currentTarget.style.textDecoration = "underline"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = "#2563eb"; e.currentTarget.style.textDecoration = "none"; }}
                  >
                    {formatFullPhone(contact.countryCode, contact.phone)}
                  </a>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[12px]" style={{ fontWeight: 400, color: "#94A3B8", fontStyle: "italic", textAlign: "center" }}>No Emergency Contacts Added</p>
          )}
        </div>
      </div>
    </div>
  );
}