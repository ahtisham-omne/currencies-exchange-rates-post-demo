import { useCallback, useState } from "react";
import { ACCOUNT_OWNER_COPY } from "../../data/account-owner";
import { Eye, ShieldCheck, Ban, X } from "lucide-react";
import type { RoleDetail } from "../../data/role-detail-data";
import { applyRoleLicenseTier } from "../../data/role-detail-data";
import { getPredefinedRoleMeta } from "../../data/predefined-roles";
import { PERMISSION_MODULES } from "../../data/permissions-data";
import { PermissionsModuleGrid } from "../permissions/PermissionsModuleGrid";
import { RoleTierRaiseWarningModal } from "../shared/RoleTierRaiseWarningModal";
import {
  computeRoleTier,
  findUnderLicensedUsers,
  permissionRequiresFullAccess,
} from "../../lib/permission-tier";
import { users as ALL_USERS } from "../../data/users-data";
import { useAccessMode, useRoleInScope } from "../access-mode";

/** Stable empty Set so Direct/Inherited source chips render in role-scoped views.
 *  Roles don't inherit from other roles: every enabled permission is Direct. */
const EMPTY_INHERITED: Set<string> = new Set();

/**
 * Deterministic helper: given a roleId + permissionId, decide if that
 * permission is "on" for this role.
 */
function hashSeed(a: number, b: string): number {
  let h = a * 2654435761;
  for (let i = 0; i < b.length; i++) {
    h = ((h << 5) - h + b.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

interface Props {
  role: RoleDetail;
}

export function RolePermissionsTab({ role }: Props) {
  const access = useAccessMode();
  const roleId = parseInt(role.id?.toString() ?? "0", 10);
  /* Managing a role's permissions is the scoped grant, so this tab is
   * scope-gated end to end: the toggles and the threshold editor alike. */
  const inScope = useRoleInScope(roleId);

  /* ── Tier-raise warning modal state ── */
  const [tierWarning, setTierWarning] = useState<{
    /** Total users assigned to the role: drives the modal's Variant A/B copy. */
    assignedUserCount: number;
    /** Assigned users whose Field User license won't cover the raised tier. */
    affectedUsers: { id: number; fullName: string }[];
    commit: () => void;
  } | null>(null);

  const isFieldUserRole = role.licenseRequired === "Field User";
  const meta = getPredefinedRoleMeta(role.roleName);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const getInitialToggles = useCallback(
    (moduleId: string): Record<string, boolean> => {
      const mod = PERMISSION_MODULES.find((m) => m.id === moduleId);
      if (!mod) return {};

      const matchingGroup = role.permissionGroups.find(
        (g) => g.module.toLowerCase().replace(/[^a-z0-9]/g, "-") === moduleId ||
               g.module === mod.name
      );

      const toggles: Record<string, boolean> = {};
      mod.permissions.forEach((p) => {
        if (matchingGroup) {
          const matchPerm = matchingGroup.permissions.find(
            (rp) => rp.key === p.id || rp.label === p.name
          );
          if (matchPerm) {
            toggles[p.id] = matchPerm.granted;
            return;
          }
        }
        // When the role carries explicit permission groups (all predefined and
        // custom roles now derive them from ROLE_PERMISSION_MAP), any permission
        // not present in a group is genuinely NOT granted, default to false.
        // This removes the legacy hash-based guess and keeps the displayed
        // bundle exactly equal to the role's permission map entry.
        if (role.permissionGroups.length > 0) {
          toggles[p.id] = false;
          return;
        }
        // Field-User roles MUST NOT default any Full-Access permission to on,
        // otherwise the role's actual tier silently exceeds its declared tier
        // and the tier-raise warning never fires when an admin grants a new
        // Full-Access permission.
        if (isFieldUserRole && permissionRequiresFullAccess(p)) {
          toggles[p.id] = false;
          return;
        }
        const h = hashSeed(roleId, p.id);
        toggles[p.id] = h % 100 < 60;
      });
      return toggles;
    },
    [roleId, role.permissionGroups, isFieldUserRole]
  );

  /* Build the role's CURRENT full toggle map across every module, used
   * to compute the existing tier baseline before each save. */
  const buildCurrentFullToggles = useCallback((): Record<string, boolean> => {
    const all: Record<string, boolean> = {};
    PERMISSION_MODULES.forEach((mod) => {
      const t = getInitialToggles(mod.id);
      Object.assign(all, t);
    });
    return all;
  }, [getInitialToggles]);

  /**
   * Intercept per-module saves: whenever a save raises the role's required
   * license tier from Field User → Full Access, surface the blocking
   * "This Role Now Requires Full Access" confirmation before committing.
   * Any assigned users whose Field User license won't cover the new tier are
   * listed in the modal. All other edits (including Full Access → Field User
   * demotions) commit immediately.
   */
  const handleModuleSaveIntercept = useCallback(
    (
      moduleId: string,
      nextModuleToggles: Record<string, boolean>,
      commit: () => void
    ): boolean => {
      // Current tier across the whole role
      const currentAll = buildCurrentFullToggles();
      const currentTier = computeRoleTier(currentAll);

      // Project the new tier with the saved module toggles overlaid
      const projected = { ...currentAll, ...nextModuleToggles };
      const newTier = computeRoleTier(projected);

      // Wrap commit so the role's licenseRequired is kept in sync with the
      // computed tier whenever the change is actually committed. This makes
      // the "Requires Full Access" / "Requires Field Access" chip on the
      // detail header, the License Required column on the Roles listing,
      // and any other consumer reflect the new tier consistently.
      const commitWithTierSync = () => {
        commit();
        if (newTier !== currentTier) {
          applyRoleLicenseTier(roleId, newTier);
        }
      };

      // Only a Field User → Full Access raise is blocking. Every other change
      // (no tier change, or a Full Access → Field User demotion) commits now,
      // still syncing the persisted tier.
      if (!(currentTier === "Field User" && newTier === "Full Access")) {
        commitWithTierSync();
        return true;
      }

      // Tier raise: always confirm before committing. Surface any assigned
      // users whose Field User license won't cover Full Access.
      const assignedRows = ALL_USERS.filter((u) =>
        role.assignedUserIds?.includes(u.id)
      );
      const underLicensed = findUnderLicensedUsers(assignedRows, "Full Access");

      setTierWarning({
        assignedUserCount: assignedRows.length,
        affectedUsers: underLicensed.map((u) => ({ id: u.id, fullName: u.fullName })),
        commit: commitWithTierSync,
      });
      return true;
    },
    [buildCurrentFullToggles, role.assignedUserIds, roleId]
  );

  /* All-access roles (Account Owner, Super Administrator, System Configuration
   * Manager) hold every permission, show a summary block ABOVE the full
   * (all-on, read-only) permissions listing so it renders like every other
   * role detail page. */
  const allAccessSummary = meta?.allAccess && !bannerDismissed ? (
    <div className="space-y-4 mb-4">
      <div
        className="flex items-center gap-3 rounded-[10px] px-4 py-3 border"
        style={{ backgroundColor: "#F5F3FF", borderColor: "#DDD6FE" }}
      >
        <ShieldCheck className="w-[18px] h-[18px] shrink-0" style={{ color: "#7C3AED" }} />
        {meta?.protected ? (
          /* Account Owner summary (ERP-5506 AC11): what it holds, then how
             it is protected. */
          <div className="flex-1 text-[12.5px]" style={{ fontWeight: 450, color: "#5B21B6", lineHeight: 1.45 }}>
            <p>
              This role can do everything: <span style={{ fontWeight: 600 }}>{ACCOUNT_OWNER_COPY.summaryAccess}</span>
            </p>
            <ul className="mt-1.5 space-y-0.5 list-disc pl-4">
              {ACCOUNT_OWNER_COPY.summaryProtection.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        ) : meta?.allAccessNote ? (
          /* Super Administrator (ERP-5506 AC12) and System Configuration
             Manager (AC13) state their own breadth: the generic "everything"
             line was wrong for both, since each differs from the owner. */
          <p className="text-[12.5px] flex-1" style={{ fontWeight: 450, color: "#5B21B6", lineHeight: 1.45 }}>
            {meta.allAccessNote}
          </p>
        ) : (
        <p className="text-[12.5px] flex-1" style={{ fontWeight: 450, color: "#5B21B6", lineHeight: 1.45 }}>
          This role can do everything, <span style={{ fontWeight: 600 }}>every permission in every module</span>.
        </p>
        )}
        <button
          type="button"
          onClick={() => setBannerDismissed(true)}
          aria-label="Dismiss"
          className="shrink-0 p-0.5 rounded-md transition-colors hover:bg-[#EDE9FE] cursor-pointer"
        >
          <X className="w-3.5 h-3.5" style={{ color: "#8B5CF6" }} />
        </button>
      </div>

      {meta!.excludedPermissions && meta!.excludedPermissions.length > 0 && (
        <div
          className="rounded-[10px] px-4 py-3.5 border"
          style={{ backgroundColor: "#FFFFFF", borderColor: "#E2E8F0" }}
        >
          <p className="text-[12px] mb-2" style={{ fontWeight: 600, color: "#334155" }}>
            Does Not Hold
          </p>
          <div className="space-y-1.5">
            {meta!.excludedPermissions.map((name) => (
              <div key={name} className="flex items-center gap-2">
                <Ban className="w-3.5 h-3.5 shrink-0" style={{ color: "#DC2626" }} />
                <span className="text-[12.5px]" style={{ color: "#475569", fontWeight: 450 }}>
                  {name}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  ) : null;

  return (
    <>
      {allAccessSummary}

      {/* Predefined roles are locked, surface a view-only banner so admins
       *  understand why no permission can be toggled here. Dismissible. */}
      {role.isSystem && !meta?.allAccess && !bannerDismissed && (
        <div
          className="flex items-start gap-3 rounded-[8px] px-3.5 py-2.5 border mb-4"
          style={{ backgroundColor: "#FFFFFF", borderColor: "#E2E8F0" }}
        >
          <Eye className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "#64748B" }} />
          <p className="text-[11.5px] flex-1" style={{ fontWeight: 450, color: "#64748B", lineHeight: "1.45" }}>
            This is a predefined role. Its permissions are view only and cannot be modified.
          </p>
          <button
            type="button"
            onClick={() => setBannerDismissed(true)}
            aria-label="Dismiss"
            className="shrink-0 -mr-1 -mt-0.5 p-0.5 rounded-md transition-colors hover:bg-[#F1F5F9] cursor-pointer"
          >
            <X className="w-3.5 h-3.5" style={{ color: "#94A3B8" }} />
          </button>
        </div>
      )}

      <PermissionsModuleGrid
        modalContext="role-detail"
        /* Readonly unless the role accepts edits, the persona may author
           permissions, AND the role is in the persona's Manage Roles scope.
           Any one of the three failing is enough to lock the toggles.
           Always disabled rather than hidden: a permission set the viewer can
           read but not change is exactly what a disabled toggle depicts, and
           hiding the catalog would lose the read the viewer is entitled to. */
        modalMode={
          !role.isSystem && access.canManagePermissions && inScope ? "editable" : "readonly"
        }
        /* Threshold VALUES stay visible on an out-of-scope role; only the edit
           affordance goes. (Every threshold surface currently sits behind
           SHOW_PERMISSION_THRESHOLDS, so this takes effect when that flips.) */
        thresholdsReadOnly={!inScope}
        userId={roleId}
        roleId={roleId}
        roleName={role.roleName}
        getInitialToggles={getInitialToggles}
        onModuleSaveIntercept={handleModuleSaveIntercept}
        inheritedPermissions={EMPTY_INHERITED}
        hideSourceChips
      />

      {/* Blocking confirmation: role tier raised Field User → Full Access.
          Rendered above the permission editor modal, so a high z is required. */}
      <RoleTierRaiseWarningModal
        open={!!tierWarning}
        onClose={() => setTierWarning(null)}
        z={120}
        roleName={role.roleName}
        assignedUserCount={tierWarning?.assignedUserCount ?? 0}
        affectedUsers={tierWarning?.affectedUsers ?? []}
        onConfirm={() => tierWarning?.commit()}
      />
    </>
  );
}
