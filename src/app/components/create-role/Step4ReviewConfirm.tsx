import {
  Pencil,
  Info,
  AlertTriangle,
  Shield,
  KeyRound,
  Users,
} from "lucide-react";
import type { CreateRoleFormData } from "./types";
import type { PermissionModule } from "../../data/permissions-data";
import { users } from "../../data/users-data";
import { SmallAvatarCell } from "../table-cells";
import { DetailCard } from "../user-detail/DetailCard";
import { FieldPair } from "../shared/FieldPair";
import { ExpandableDescription } from "../shared/ExpandableDescription";
import { FULL_ACCESS_DAILY, formatCurrency } from "../../lib/license-billing";

interface Step4Props {
  formData: CreateRoleFormData;
  permissionToggles: Record<string, boolean>;
  permissionModules: PermissionModule[];
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

export function Step4ReviewConfirm({
  formData,
  permissionToggles,
  permissionModules,
  onEditStep,
}: Step4Props) {
  const totalPerms = permissionModules.reduce((s, m) => s + m.permissions.length, 0);
  const activePerms = permissionModules.reduce(
    (s, m) => s + m.permissions.filter((p) => permissionToggles[p.id] === true).length,
    0
  );

  const moduleSummary = permissionModules
    .map((mod) => {
      const active = mod.permissions.filter((p) => permissionToggles[p.id] === true).length;
      return { name: mod.name, active, total: mod.permissions.length };
    })
    .filter((m) => m.active > 0);

  const assignedUsers = users.filter((u) => formData.assignedUsers.includes(u.id));
  const needsFullAccess = formData.licenseType === "Full Access";

  return (
    <div className="space-y-4">
      {/* Role Identity */}
      <DetailCard
        title="Basic Information"
        icon={Shield}
        action={<EditButton onClick={() => onEditStep(1)} />}
      >
        <div className="grid grid-cols-3 gap-x-8 gap-y-4 py-4">
          <FieldPair label="Role Name" value={formData.roleName} />
          <FieldPair label="License Type" value={formData.licenseType || undefined} />
          <FieldPair label="Status" value={formData.status === "Disabled" ? "Deactivated" : formData.status} />
          {/* Description has no length cap, so it takes the full row and
              collapses to two lines with "... more" rather than truncating
              into one third of the grid. */}
          <div className="col-span-3 min-w-0">
            <p
              className="mb-1"
              style={{ fontSize: "12px", fontWeight: 450, color: "#94A3B8", lineHeight: "1.3" }}
            >
              Description
            </p>
            {formData.description ? (
              <ExpandableDescription
                text={formData.description}
                lines={2}
                className="text-[13px]"
                style={{ fontWeight: 500, color: "#1E293B", lineHeight: "1.55" }}
              />
            ) : (
              <p
                className="text-[13px]"
                style={{ fontWeight: 400, color: "#94A3B8", fontStyle: "italic" }}
              >
                -
              </p>
            )}
          </div>
        </div>
      </DetailCard>

      {/* Permissions */}
      <DetailCard
        title="Permissions"
        icon={KeyRound}
        action={<EditButton onClick={() => onEditStep(2)} />}
      >
        <div className="py-3">
          {moduleSummary.length > 0 ? (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {moduleSummary.map((mod) => (
                  <span
                    key={mod.name}
                    className="inline-flex items-center text-[12px] px-2.5 py-1 rounded-full border"
                    style={{
                      fontWeight: 500,
                      backgroundColor: "#EDF4FF",
                      borderColor: "#007FFF20",
                      color: "#007FFF",
                    }}
                  >
                    {mod.name}
                    <span
                      className="ml-1.5 text-[10.5px] px-1.5 py-px rounded-full"
                      style={{ backgroundColor: "#007FFF15", fontWeight: 600 }}
                    >
                      {mod.active}/{mod.total}
                    </span>
                  </span>
                ))}
              </div>

              {needsFullAccess && (
                <div
                  className="flex items-center gap-2.5 rounded-[8px] px-3 py-2.5 border"
                  style={{ backgroundColor: "#FFFBEB", borderColor: "#FDE68A" }}
                >
                  <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: "#D97706" }} />
                  <p className="text-[12.5px]" style={{ fontWeight: 480, color: "#92400E" }}>
                    Requires <span style={{ fontWeight: 600 }}>Full Access</span> license ({formatCurrency(FULL_ACCESS_DAILY)}/user/day)
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2.5 py-1">
              <Info className="w-4 h-4 shrink-0" style={{ color: "#94A3B8" }} />
              <p className="text-[13px]" style={{ fontWeight: 420, color: "#94A3B8" }}>
                No permissions have been enabled for this role.
              </p>
            </div>
          )}
        </div>
      </DetailCard>

      {/* Assigned Users */}
      <DetailCard
        title="Assigned Users"
        icon={Users}
        action={<EditButton onClick={() => onEditStep(3)} />}
      >
        <div className="py-3">
          {assignedUsers.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {assignedUsers.map((user) => (
                <span
                  key={user.id}
                  className="inline-flex items-center px-2 py-1 rounded-full border bg-[#F8FAFC]"
                  style={{ borderColor: "#E2E8F0" }}
                >
                  <SmallAvatarCell name={user.fullName} />
                </span>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2.5 py-1">
              <Info className="w-4 h-4 shrink-0" style={{ color: "#94A3B8" }} />
              <p className="text-[13px]" style={{ fontWeight: 420, color: "#94A3B8" }}>
                No users assigned yet. Users can be assigned after creation.
              </p>
            </div>
          )}
        </div>
      </DetailCard>
    </div>
  );
}
