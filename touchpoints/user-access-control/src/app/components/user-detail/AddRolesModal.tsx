import { useState, useCallback, useMemo, useEffect } from "react";
import { X, Maximize2, Minimize2 } from "lucide-react";
import { toast } from "sonner";

import { ModalShell } from "../shared/ModalShell";
import { RolesSelectionPanel } from "../create-user/Step2RolesPermissions";
import { AVAILABLE_ROLES } from "../create-user/types";
import { isRoleInScope, useAccessMode } from "../access-mode";
import { roles as ALL_ROLES } from "../../data/roles-data";

interface AddRolesModalProps {
  open: boolean;
  onClose: () => void;
  userName: string;
  /** Role names already assigned to this user, these are excluded from the list */
  assignedRoleNames: Set<string>;
  /** True when the user already has a primary role among their existing
   *  assignments. When true, newly added roles are never auto-promoted to
   *  primary, the existing primary is respected unless the user explicitly
   *  marks one of the new roles as primary here. */
  hasExistingPrimary: boolean;
  /** Called with the role names the user chose to add, plus the name of a
   *  newly added role the user explicitly marked primary (undefined if none). */
  onAssign: (roleNames: string[], newPrimaryRoleName?: string) => void;
  /** When true, only custom (non-predefined) roles are offered. */
  customOnly?: boolean;
  /** Header title. Defaults to "Add Roles". */
  heading?: string;
  /** Header subtext. Defaults to the user-assignment copy. */
  subtitle?: string;
  /** When true, the modal does not fire its own success toast, the caller
   *  handles confirmation (e.g. a follow-up dependency modal). */
  suppressToast?: boolean;
  /** Backdrop/modal z-index. Defaults to 60; raise when stacked over another modal. */
  z?: number;
  /** Hide the primary-role star/badge on each card (no primary concept). */
  hidePrimary?: boolean;
  /** Hide the Custom/Predefined (type) filter pills. */
  hideTypeFilters?: boolean;
}

export function AddRolesModal({
  open,
  onClose,
  userName,
  assignedRoleNames,
  hasExistingPrimary,
  onAssign,
  customOnly = false,
  heading = "Add Roles",
  subtitle,
  suppressToast = false,
  z = 60,
  hidePrimary = false,
  hideTypeFilters = false,
}: AddRolesModalProps) {
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [primaryRole, setPrimaryRole] = useState<string>("");
  const [isFullScreen, setIsFullScreen] = useState(false);

  const access = useAccessMode();

  /* `RoleOption.id` is a name slug, so scope (which keys on the numeric role
   * id) needs the listing to resolve one to the other. */
  const roleIdByName = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of ALL_ROLES) map.set(r.roleName, r.id);
    return map;
  }, []);

  /* Only roles that are NOT already assigned to this user, the user
     can't re-add a role they already hold, so assigned roles never appear
     and nothing is pre-selected.

     Scope filters the same list. Assigning a role is the scoped
     ur-manage-roles grant, so a level with a "selected" scope only offers the
     roles it manages. This is the one place that deliberately ignores the
     Denied actions setting and always HIDES: a picker full of greyed-out rows
     reads as a broken list rather than as a permission boundary, and there is
     nothing to explain per-row that the note under the list doesn't say once. */
  const availableRoles = useMemo(
    () =>
      AVAILABLE_ROLES.filter((r) => {
        if (assignedRoleNames.has(r.name)) return false;
        if (customOnly && r.isSystem) return false;
        const roleId = roleIdByName.get(r.name);
        /* A role the listing can't resolve is left in rather than silently
         * dropped: an unresolvable id is a data gap, not a denial. */
        if (roleId === undefined) return true;
        return isRoleInScope(roleId, access);
      }),
    [assignedRoleNames, customOnly, roleIdByName, access],
  );

  const scopeFiltered = access.scope === "selected";

  /* Reset transient state whenever the modal opens */
  useEffect(() => {
    if (open) {
      setSelectedRoleIds([]);
      setPrimaryRole("");
      setIsFullScreen(false);
    }
  }, [open]);

  const toggleRole = useCallback((roleId: string) => {
    setSelectedRoleIds((current) => {
      const isRemoving = current.includes(roleId);
      const next = isRemoving
        ? current.filter((r) => r !== roleId)
        : [...current, roleId];

      // Primary role logic. When the user already has a primary among their
      // existing roles, we never auto-promote a newly added role, they must
      // pick one explicitly via the star. Otherwise (no existing primary), the
      // first added role becomes primary, mirroring Create User → Step 2.
      setPrimaryRole((prevPrimary) => {
        if (!isRemoving && next.length === 1 && !hasExistingPrimary) return roleId;
        if (isRemoving && prevPrimary === roleId) {
          // Removing the role the user marked primary: fall back to the first
          // remaining new role only when there's no existing primary to defer to.
          return hasExistingPrimary ? "" : next[0] || "";
        }
        return prevPrimary;
      });

      return next;
    });
  }, [hasExistingPrimary]);

  const handleAssign = useCallback(() => {
    if (selectedRoleIds.length === 0) return;
    const selectedSet = new Set(selectedRoleIds);
    const selected = availableRoles.filter((r) => selectedSet.has(r.id));
    const roleNames = selected.map((r) => r.name);
    const newPrimaryName = primaryRole
      ? selected.find((r) => r.id === primaryRole)?.name
      : undefined;
    onAssign(roleNames, newPrimaryName);
    if (!suppressToast) {
      const count = roleNames.length;
      toast.success(
        `${count} role${count > 1 ? "s" : ""} added to ${userName}.`,
      );
    }
    onClose();
  }, [selectedRoleIds, primaryRole, availableRoles, onAssign, userName, onClose]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const selectedCount = selectedRoleIds.length;

  return (
    <ModalShell open={open} onClose={handleClose} z={z}>
      <div
        className={`bg-white flex flex-col overflow-hidden transition-[max-width,max-height,width,height,border-radius] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
          isFullScreen
            ? "w-[calc(100vw-1.5rem)] max-w-[calc(100vw-1.5rem)] h-[calc(100vh-1.5rem)] max-h-[calc(100vh-1.5rem)] rounded-2xl lg:w-[calc(100vw-2rem)] lg:max-w-[calc(100vw-2rem)] lg:h-[calc(100vh-2rem)] lg:max-h-[calc(100vh-2rem)]"
            : "w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] max-h-[100dvh] rounded-none sm:w-[min(70vw,1320px)] sm:max-w-[min(70vw,1320px)] sm:h-[90vh] sm:max-h-none sm:rounded-2xl"
        }`}
        style={{
          boxShadow: "0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)",
        }}
      >
        {/* Header */}
        <div
          className="px-4 lg:px-5 pt-4 pb-3.5 shrink-0 bg-white border-b border-[#EEF2F6]"
          style={{ borderTopLeftRadius: 16, borderTopRightRadius: 16 }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-[15px] sm:text-[17px] text-[#0F172A]" style={{ fontWeight: 700 }}>
                {heading}
              </h2>
              <p className="text-[11px] sm:text-xs text-[#64748B] mt-0.5" style={{ fontWeight: 400 }}>
                {subtitle ?? `Add new roles to ${userName}. This list only shows roles they don't already have.`}
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => setIsFullScreen((v) => !v)}
                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] border border-[#E2E8F0] bg-white text-xs text-[#475569] hover:bg-[#F8FAFC] hover:border-[#CBD5E1] transition-colors cursor-pointer"
                style={{ fontWeight: 500 }}
              >
                {isFullScreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                {isFullScreen ? "Exit full" : "Full view"}
              </button>
              <button
                onClick={handleClose}
                className="w-8 h-8 rounded-[8px] flex items-center justify-center text-[#94A3B8] hover:text-[#64748B] hover:bg-[#F1F5F9] transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-hidden bg-[#FAFBFC] px-4 lg:px-5 py-4 lg:py-5 flex flex-col">
          <RolesSelectionPanel
            roles={availableRoles}
            selectedRoleIds={selectedRoleIds}
            primaryRoleId={primaryRole}
            onToggleRole={toggleRole}
            onSetPrimary={setPrimaryRole}
            singleSelectFilters
            hidePrimary={hidePrimary}
            hideTypeFilters={hideTypeFilters}
            footerNote={
              scopeFiltered ? "Only roles in your Manage Roles scope are shown." : undefined
            }
          />
        </div>

        {/* Footer */}
        <div
          className="shrink-0 border-t border-[#EEF2F6] bg-white px-4 lg:px-5 py-2.5 sm:py-3 flex items-center justify-end gap-2 sm:gap-2.5"
          style={{ borderBottomLeftRadius: 16, borderBottomRightRadius: 16 }}
        >
          <button
            type="button"
            onClick={handleClose}
            className="inline-flex items-center justify-center w-[110px] h-8 sm:h-9 rounded-[8px] border border-[#E2E8F0] bg-white text-xs sm:text-[13px] text-[#64748B] hover:text-[#0F172A] hover:border-[#CBD5E1] transition-colors cursor-pointer"
            style={{ fontWeight: 500 }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleAssign}
            disabled={selectedCount === 0}
            className="inline-flex items-center justify-center w-[110px] h-8 sm:h-9 rounded-[8px] bg-[#007FFF] hover:bg-[#0066D6] active:bg-[#005BBF] text-white shadow-sm transition-colors cursor-pointer text-xs sm:text-[13px] disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ fontWeight: 600 }}
          >
            Add {selectedCount > 0 ? `(${selectedCount})` : ""}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
