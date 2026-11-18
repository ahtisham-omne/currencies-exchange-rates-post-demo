import { useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import {
  UpgradeLicenseModal,
} from "./LicenseModals";
import { DowngradeUserModal } from "./ActionModals";
import { DestructiveConfirmModal } from "./DestructiveConfirmModal";
import { statusDisplayLabel } from "../table-cells";
import { DeactivateUserWizard } from "../user-detail/DeactivateUserWizard";
import {
  getActiveAssignmentsForUser,
} from "../../data/user-assignments-data";
import { getRolesOwnedByUser } from "../../data/role-owners-data";
import { useAccountOwnerLicenseGate } from "./AccountOwnerLicenseGate";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

/* ─── License option config ─── */
const LICENSE_OPTIONS = [
  {
    key: "Full Access",
    label: "Full Access",
    color: "#5B21B6",
    bg: "#EDE9FE",
    border: "#C4B5FD",
    description: "Complete access to all modules and features. Required for administrative and management roles.",
  },
  {
    key: "Field User",
    label: "Field User",
    color: "#475569",
    bg: "#F1F5F9",
    border: "#CBD5E1",
    description: "Limited access for operational and floor-level tasks. Ideal for field staff and technicians.",
  },
  {
    key: "No License",
    label: "No License",
    color: "#475569",
    bg: "#FFFFFF",
    border: "#CBD5E1",
    description: "No system access. This user does not have an assigned license and is not included in billing. Applies to deactivated, archived, and users not yet assigned a license.",
  },
];

/* ─── Visual config for the chip.
   `hoverBorder` is used by interactive chips to deepen the stroke on hover. */
const LICENSE_VISUAL: Record<string, { color: string; bg: string; border: string; hoverBorder: string; label: string }> = {
  "Full Access": { color: "#5B21B6", bg: "#EDE9FE", border: "#C4B5FD", hoverBorder: "#8B5CF6", label: "Full Access" }, // violet-500
  "Field User":  { color: "#475569", bg: "#F1F5F9", border: "#CBD5E1", hoverBorder: "#64748B", label: "Field User" },  // slate-500
  "No License":  { color: "#475569", bg: "#FFFFFF", border: "#CBD5E1", hoverBorder: "#64748B", label: "No License" },  // slate-500
};

interface LicenseDropdownProps {
  license: string;
  userName: string;
  userEmail: string;
  userId?: number;
  /** The user's current status. Removing a license never changes it, so the
   *  confirmation reads it to say where the user stays. */
  userStatus?: string;
  onLicenseChange: (newLicense: string) => void;
}

export function LicenseDropdown({ license, userName, userEmail, userId, userStatus, onLicenseChange }: LicenseDropdownProps) {
  /* Deactivated is reachable only by deactivating an Active user (ERP-5203,
   * ruled 18 Sep 2026). Removing a license from a Draft or invited user used to
   * flip them to Deactivated, which invented a transition nothing else in the
   * product can produce and contradicted the status they were sitting at.
   * License and status are separate axes: the license governs whether someone
   * can sign in, the status governs where they are in their lifecycle. Miguel
   * Torres in the build data is Active on No License, so the combination the
   * old behaviour refused to allow already exists. ERP-5184 AC4 carries the
   * same rule to an Active user: they stay Active and can no longer sign in. */
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [downgradeOpen, setDowngradeOpen] = useState(false);
  const [nonBillableOpen, setNonBillableOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [hovered, setHovered] = useState(false);

  const vis = LICENSE_VISUAL[license] || LICENSE_VISUAL["Field User"];

  /* Account Owner (ERP-5148 AC8, ERP-5184 AC8, ERP-5186 AC8): to other users
   * the chip offers upgrades only. The owner may lower their own license, even
   * as the only holder, after a step that says the role stays but pauses. */
  const { owner, guard, gateModal } = useAccountOwnerLicenseGate(userId);
  const isLowering = (key: string) =>
    key === "No License" || (key === "Field User" && license === "Full Access");

  /** Check whether the user has active assignments or role ownership */
  const hasReassignmentWork = (uid: number): boolean => {
    const tasks = getActiveAssignmentsForUser(uid).filter((a) => a.type !== "Role Ownership");
    const ownedRoles = getRolesOwnedByUser(uid);
    return tasks.length > 0 || ownedRoles.length > 0;
  };

  const handleSelect = (key: string) => {
    if (key === license) return;
    if (isLowering(key)) guard(() => openFlow(key));
    else openFlow(key);
  };

  const openFlow = (key: string) => {
    if (key === "Full Access" && license !== "Full Access") {
      setUpgradeOpen(true);
    } else if (key === "Field User" && license === "Full Access") {
      setDowngradeOpen(true);
    } else if (key === "No License") {
      // If we have a userId and there's reassignment work, show the wizard
      if (userId != null && hasReassignmentWork(userId)) {
        setWizardOpen(true);
      } else {
        setNonBillableOpen(true);
      }
    } else if (key === "Field User" && license === "No License") {
      setUpgradeOpen(true);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
          <button
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            className="inline-flex items-center gap-1 rounded border cursor-pointer px-2 py-0.5 text-xs"
            style={{
              fontWeight: 500,
              backgroundColor: vis.bg,
              color: vis.color,
              borderColor: hovered ? vis.hoverBorder : vis.border,
              // 0.5px outer ring on hover stacks with the 1px border to read as a 1.5px stroke,
              // without changing border-width (which would shift the chip's position).
              boxShadow: hovered ? `0 0 0 0.5px ${vis.hoverBorder}` : "none",
              transition: "border-color 180ms ease, box-shadow 180ms ease",
            }}
          >
            {vis.label}
            <ChevronDown className="w-3 h-3" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="w-[320px] p-1.5 space-y-0.5"
          onClick={(e) => e.stopPropagation()}
        >
          {LICENSE_OPTIONS.map((opt) => {
            const isSelected = license === opt.key;
            if (!isSelected && isLowering(opt.key) && !owner.lowerLicense.allowed) {
              return (
                <Tooltip key={opt.key}>
                  <TooltipTrigger asChild>
                    <div>
                      <DropdownMenuItem
                        disabled
                        className="flex flex-col items-start gap-1 px-3 py-2.5 rounded-md border border-transparent opacity-50 cursor-not-allowed"
                        onSelect={(e) => e.preventDefault()}
                      >
                        <span
                          className="inline-flex items-center rounded border px-2 py-px text-[13px]"
                          style={{ fontWeight: 600, backgroundColor: opt.bg, color: opt.color, borderColor: opt.border }}
                        >
                          {opt.label}
                        </span>
                        <p className="text-[13px] leading-[18px]" style={{ color: "#64748B", fontWeight: 400 }}>
                          {opt.description}
                        </p>
                      </DropdownMenuItem>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-[260px] text-xs">
                    {owner.lowerLicense.reason}
                  </TooltipContent>
                </Tooltip>
              );
            }
            return (
              <DropdownMenuItem
                key={opt.key}
                className="flex flex-col items-start gap-1 px-3 py-2.5 rounded-md border transition-all focus:bg-transparent data-[highlighted]:bg-transparent cursor-pointer"
                style={{
                  backgroundColor: isSelected ? "#F8FBFF" : "transparent",
                  borderColor: isSelected ? "#D0E3F7" : "transparent",
                }}
                onSelect={() => handleSelect(opt.key)}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    (e.currentTarget as HTMLElement).style.backgroundColor = "#F8FAFC";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    (e.currentTarget as HTMLElement).style.backgroundColor = isSelected ? "#F8FBFF" : "transparent";
                  }
                }}
              >
                <div className="flex items-center justify-between w-full">
                  <span
                    className="inline-flex items-center rounded border px-2 py-px text-[13px]"
                    style={{ fontWeight: 600, backgroundColor: opt.bg, color: opt.color, borderColor: opt.border }}
                  >
                    {opt.label}
                  </span>
                  {isSelected && (
                    <Check className="w-3.5 h-3.5 shrink-0" style={{ color: "#64748B" }} />
                  )}
                </div>
                <p className="text-[13px] leading-[18px]" style={{ color: "#64748B", fontWeight: 400 }}>
                  {opt.description}
                </p>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      <UpgradeLicenseModal
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        userName={userName}
        userEmail={userEmail}
        onConfirm={() => onLicenseChange("Full Access")}
      />
      <DowngradeUserModal
        open={downgradeOpen}
        onClose={() => setDowngradeOpen(false)}
        userName={userName}
        userEmail={userEmail}
        userId={userId}
        userLicense={license}
        targetLicense="Field User"
        onConfirm={() => onLicenseChange("Field User")}
      />
      <DestructiveConfirmModal
        open={nonBillableOpen}
        onClose={() => setNonBillableOpen(false)}
        badge="REMOVE"
        title={`Remove License from ${userName}?`}
        description={
          <>
            Removing the license will revoke sign-in access and exclude them from
            billing next cycle.
            {userStatus === "Active" ? " They stay Active." : ` They stay at ${statusDisplayLabel(userStatus ?? "")}, and an invitation still reaches them.`}
            <br />
            <br />
            All assigned roles, permissions, and MFA settings are preserved on the user record. Reassigning a license restores their previous access.
          </>
        }
        confirmLabel="Remove License"
        cancelLabel="Cancel"
        onConfirm={() => {
          onLicenseChange("No License");
          toast.success(`License removed from ${userName}`);
          setNonBillableOpen(false);
        }}
      />

      {userId != null && (
        <DeactivateUserWizard
          open={wizardOpen}
          onClose={() => setWizardOpen(false)}
          mode="remove-license"
          userName={userName}
          userId={userId}
          userLicense={license}
          onConfirm={() => {
            onLicenseChange("No License");
          }}
        />
      )}
      {gateModal}
    </>
  );
}
