import { useCallback, useMemo } from "react";
import type { UserDetail } from "../../data/user-detail-data";
import { PERMISSION_MODULES } from "../../data/permissions-data";
import { PermissionsModuleGrid } from "../permissions/PermissionsModuleGrid";
import { getPermissionsForRoles, getPermissionSources, getRoleIdByName } from "../../data/role-permissions-map";
import { getDirectPermissionIds } from "../../data/user-direct-permissions-data";
import { useAccountOwnerRules } from "../../data/account-owner";
import { ShieldCheck } from "lucide-react";

interface Props {
  user: UserDetail;
}

export function AssignedPermissionsTab({ user }: Props) {
  /* An Account Owner's permissions are fixed for everyone, the owner
   * included (ERP-5164 AC8): the grid opens read-only with a note. */
  const owner = useAccountOwnerRules(Number(user.id));
  const roleIds = useMemo(() => {
    return user.roleAssignments
      .map((ra) => getRoleIdByName(ra.name))
      .filter(Boolean) as string[];
  }, [user.roleAssignments]);

  const inheritedPermissions = useMemo(() => getPermissionsForRoles(roleIds), [roleIds]);
  const inheritedSources = useMemo(() => getPermissionSources(roleIds), [roleIds]);

  // Directly-assigned permissions are the user's curated direct grants, the
  // "direct" layer the toggle represents. Role-inherited permissions come in
  // separately via `inheritedPermissions`.
  const directPermissions = useMemo(() => new Set(getDirectPermissionIds(user.id)), [user.id]);

  const getInitialToggles = useCallback(
    (moduleId: string): Record<string, boolean> => {
      const mod = PERMISSION_MODULES.find((m) => m.id === moduleId);
      if (!mod) return {};
      const toggles: Record<string, boolean> = {};
      mod.permissions.forEach((p) => {
        toggles[p.id] = directPermissions.has(p.id);
      });
      return toggles;
    },
    [directPermissions]
  );

  return (
    <>
    {owner.isOwner && (
      <div className="mb-3 flex items-start gap-2.5 px-3.5 py-2.5 rounded-lg border" style={{ backgroundColor: "#F5F3FF", borderColor: "#DDD6FE" }}>
        <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "#7C3AED" }} />
        <p className="text-[12.5px] leading-[18px]" style={{ color: "#5B21B6", fontWeight: 450 }}>
          {owner.permissions.reason}
        </p>
      </div>
    )}
    <PermissionsModuleGrid
      modalContext="user-detail"
      modalMode={owner.isOwner ? "readonly" : "editable"}
      // An owner's grid is read only for everyone (ERP-5529 AC22), so the
      // module rows offer no Enable All / Disable All either.
      showToggleAllActions={!owner.isOwner}
      userId={user.id}
      getInitialToggles={getInitialToggles}
      inheritedPermissions={inheritedPermissions}
      inheritedSources={inheritedSources}
    />
    </>
  );
}
