import { Pencil, Info, AlertTriangle, User, Shield, FileText, KeyRound } from "lucide-react";
import type { CreateUserFormData, AdditionalDetails } from "./types";
import { AVAILABLE_ROLES } from "./types";
import { deriveUserLicense } from "../../lib/permission-tier";
import { PERMISSION_MODULES } from "../../data/permissions-data";
import { SystemRoleLock } from "../shared/SystemRoleBadge";
import { DetailCard } from "../user-detail/DetailCard";
import { FieldPair } from "../shared/FieldPair";
import { formatFullPhone } from "../../lib/phone-format";
import { FULL_ACCESS_DAILY, formatCurrency } from "../../lib/license-billing";

interface Step3Props {
  formData: CreateUserFormData;
  onEditStep: (step: number) => void;
}

function EditButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 text-[12.5px] hover:underline transition-colors cursor-pointer"
      style={{ fontWeight: 520, color: "#007FFF" }}
    >
      <Pencil className="w-3 h-3" />
      Edit
    </button>
  );
}

/** Build FieldPair-compatible entries from AdditionalDetails. */
function getAdditionalFieldPairs(d: AdditionalDetails): { label: string; value: string }[] {
  const pairs: { label: string; value: string }[] = [];

  

  if (d.nickname) pairs.push({ label: "Nickname", value: d.nickname });
  if (d.pronouns) pairs.push({ label: "Pronouns", value: d.pronouns });

  d.languages.forEach((l, i) => {
    pairs.push({
      label: d.languages.length === 1 ? "Language" : `Language ${i + 1}`,
      value: `${l.language} (${l.proficiency})`,
    });
  });

  d.additionalEmails.forEach((entry, i) => {
    pairs.push({
      label: `${entry.type} Email${d.additionalEmails.length > 1 ? ` ${i + 1}` : ""}`,
      value: entry.email,
    });
  });

  d.phones.forEach((p, i) => {
    pairs.push({
      label: d.phones.length === 1 ? "Phone" : `Phone ${i + 1} (${p.type})`,
      value: formatFullPhone(p.countryCode, p.number),
    });
  });

  d.addresses.forEach((a, i) => {
    pairs.push({
      label: d.addresses.length === 1 ? "Address" : `Address ${i + 1} (${a.type})`,
      value: a.address,
    });
  });

  d.emergencyContacts.forEach((c, i) => {
    pairs.push({
      label: d.emergencyContacts.length === 1 ? "Emergency Contact" : `Emergency Contact ${i + 1}`,
      value: `${c.fullName} · ${c.relationship} · ${c.countryCode} ${c.phone}`,
    });
  });

  d.citizenships.forEach((c, i) => {
    pairs.push({
      label: d.citizenships.length === 1 ? "Citizenship" : `Citizenship ${i + 1}`,
      value: `${c.country}${c.isPrimary ? " (Primary)" : ""}`,
    });
  });

  return pairs;
}

export function Step3ReviewConfirm({ formData, onEditStep }: Step3Props) {
  const fullName = [formData.firstName, formData.middleName, formData.lastName]
    .filter(Boolean)
    .join(" ");

  const selectedRoles = AVAILABLE_ROLES.filter((r) =>
    formData.assignedRoles.includes(r.id)
  );

  /* The seat this user will be created with, from roles and direct grants
   * together. "No License" when neither was chosen, which is a legitimate
   * outcome here: the account exists, it just has no access yet. */
  const directPermissionNames = PERMISSION_MODULES.flatMap((m) =>
    m.permissions.filter((p) => formData.directPermissions[p.id]).map((p) => p.name)
  );
  const license = deriveUserLicense(
    selectedRoles.map((r) => r.license),
    formData.directPermissions
  );
  const hasAnyAccess = selectedRoles.length > 0 || directPermissionNames.length > 0;
  const additionalPairs = getAdditionalFieldPairs(formData.additionalDetails);

  return (
    <div className="space-y-4">
      {/* Basic Information */}
      <DetailCard
        title="Basic Information"
        icon={User}
        action={<EditButton onClick={() => onEditStep(1)} />}
      >
        <div className="grid grid-cols-3 gap-x-8 gap-y-4 py-4">
          <FieldPair label="Full Name" value={fullName} />
          <FieldPair label="Username" value={formData.username ? `@${formData.username}` : undefined} />
          <FieldPair label="Primary Email" value={formData.primaryEmail} />
          <FieldPair label="Gender" value={formData.gender} />
          <FieldPair label="Date of Birth" value={formData.dateOfBirth} />
          <FieldPair label="Job Title" value={formData.jobTitle} />
          <FieldPair label="Invite Link Expiry" value={formData.inviteLinkExpiry} />
        </div>
      </DetailCard>

      {/* Additional Details */}
      <DetailCard
        title="Additional Details"
        icon={FileText}
        action={<EditButton onClick={() => onEditStep(1)} />}
      >
        <div className="py-3">
          {additionalPairs.length > 0 ? (
            <div className="grid grid-cols-3 gap-x-8 gap-y-4">
              {additionalPairs.map((pair) => (
                <FieldPair key={pair.label} label={pair.label} value={pair.value} />
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2.5 py-1">
              <Info className="w-4 h-4 shrink-0" style={{ color: "#94A3B8" }} />
              <p className="text-[13px]" style={{ fontWeight: 420, color: "#94A3B8" }}>
                No Additional Details Added.
              </p>
            </div>
          )}
        </div>
      </DetailCard>

      {/* Roles & Permissions */}
      <DetailCard
        title="Roles & Permissions"
        icon={Shield}
        action={<EditButton onClick={() => onEditStep(2)} />}
      >
        <div className="py-3">
          {hasAnyAccess ? (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {selectedRoles.map((role) => {
                  const isPrimary = formData.primaryRole === role.id;
                  return (
                    <span
                      key={role.id}
                      className="inline-flex items-center gap-2 text-[12.5px] px-3 py-1.5 rounded-[8px] border"
                      style={{
                        fontWeight: 500,
                        backgroundColor: "#F8FAFC",
                        borderColor: "#E2E8F0",
                        color: "#1E293B",
                      }}
                    >
                      {role.isSystem && <SystemRoleLock size={11} />}
                      {role.name}
                      {isPrimary && (
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded-md"
                          style={{ fontWeight: 600, backgroundColor: "#007FFF", color: "#FFFFFF" }}
                        >
                          Primary
                        </span>
                      )}
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-full border"
                        style={
                          role.license === "Full Access"
                            ? { fontWeight: 550, backgroundColor: "#EDE9FE", color: "#5B21B6", borderColor: "#C4B5FD" }
                            : { fontWeight: 550, backgroundColor: "#F1F5F9", color: "#475569", borderColor: "#CBD5E1" }
                        }
                      >
                        {role.license}
                      </span>
                    </span>
                  );
                })}
              </div>

              {directPermissionNames.length > 0 && (
                <div className="flex items-start gap-2 pt-0.5">
                  <KeyRound className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "#94A3B8" }} />
                  <p className="text-[12.5px]" style={{ fontWeight: 450, color: "#475569" }}>
                    <span style={{ fontWeight: 600 }}>
                      {directPermissionNames.length} permission
                      {directPermissionNames.length !== 1 ? "s" : ""}
                    </span>{" "}
                    assigned directly: {directPermissionNames.join(", ")}
                  </p>
                </div>
              )}

              {license === "Full Access" ? (
                <div
                  className="flex items-center gap-2.5 rounded-[8px] px-3 py-2.5 border"
                  style={{ backgroundColor: "#FFFBEB", borderColor: "#FDE68A" }}
                >
                  <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: "#D97706" }} />
                  <p className="text-[12.5px]" style={{ fontWeight: 480, color: "#92400E" }}>
                    Requires <span style={{ fontWeight: 600 }}>Full Access</span> license ({formatCurrency(FULL_ACCESS_DAILY)}/user/day)
                  </p>
                </div>
              ) : (
                <div
                  className="flex items-center gap-2.5 rounded-[8px] px-3 py-2.5 border"
                  style={{ backgroundColor: "#F8FAFC", borderColor: "#E2E8F0" }}
                >
                  <Info className="w-4 h-4 shrink-0" style={{ color: "#64748B" }} />
                  <p className="text-[12.5px]" style={{ fontWeight: 480, color: "#334155" }}>
                    Will be created with a <span style={{ fontWeight: 600 }}>Field User</span> license
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-start gap-2.5 py-1">
              <Info className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#94A3B8" }} />
              <p className="text-[13px]" style={{ fontWeight: 420, color: "#94A3B8" }}>
                No roles or permissions assigned. This user will be created with{" "}
                <span style={{ fontWeight: 600, color: "#64748B" }}>No License</span> and
                will not consume a seat. You can assign access later.
              </p>
            </div>
          )}
        </div>
      </DetailCard>
    </div>
  );
}
