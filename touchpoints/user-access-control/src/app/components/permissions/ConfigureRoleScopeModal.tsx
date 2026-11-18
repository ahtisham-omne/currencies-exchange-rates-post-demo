import { useCallback, useEffect, useMemo, useState } from "react";
import { Globe, ListChecks, Lock, X } from "lucide-react";
import { toast } from "sonner";
import { ModalShell } from "../shared/ModalShell";
import { scopeEligibleRoles, isProtectedRoleId, roleNameToOptionId, sortRolesCustomFirst } from "../../data/roles-data";
import { RolesSelectionPanel } from "../create-user/Step2RolesPermissions";
import {
  getRoleManageScope,
  saveRoleManageScope,
  type RoleManageScopeMode,
} from "../../data/role-manage-scope-data";

interface Props {
  open: boolean;
  onClose: () => void;
  /** ID of the role being configured (NOT a user ID). */
  roleId: number;
  roleName?: string;
}

export function ConfigureRoleScopeModal({ open, onClose, roleId, roleName }: Props) {
  const [mode, setMode] = useState<RoleManageScopeMode>("selected");
  const [selected, setSelected] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!open) return;
    const cfg = getRoleManageScope(roleId);
    setMode(cfg.mode);
    const initialIds =
      cfg.mode === "selected" && cfg.manageRoleIds.length === 0
        ? cfg.lastSelectedRoleIds
        : cfg.manageRoleIds;
    setSelected(new Set(initialIds.filter((rid) => !isProtectedRoleId(rid))));
  }, [open, roleId]);

  const sortedRoles = useMemo(() => [...scopeEligibleRoles].sort(sortRolesCustomFirst), []);
  const totalRoles = sortedRoles.length;
  const selectedCount = mode === "all" ? totalRoles : selected.size;
  const isAllScope = mode === "all";

  const toggleRow = useCallback((id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  /* Card picker works with string option ids (slugs); the scope store uses
     numeric role ids. Map between the two. */
  const roleOptions = useMemo(() => sortedRoles.map((r) => ({
    id: roleNameToOptionId(r.roleName),
    name: r.roleName,
    license: r.licenseRequired,
    description: r.description,
    usersCount: r.usersCount,
    isSystem: r.isSystem,
  })), [sortedRoles]);
  const idBySlug = useMemo(
    () => new Map(sortedRoles.map((r) => [roleNameToOptionId(r.roleName), r.id])),
    [sortedRoles],
  );
  const selectedSlugs = useMemo(
    () =>
      sortedRoles
        .filter((r) => selected.has(r.id))
        .map((r) => roleNameToOptionId(r.roleName)),
    [sortedRoles, selected],
  );

  const handleSave = useCallback(() => {
    saveRoleManageScope(roleId, {
      mode,
      manageRoleIds: Array.from(selected),
    });
    toast.success(
      mode === "all"
        ? `Role scope updated · all roles included.`
        : `Role scope updated · ${selected.size} role${selected.size === 1 ? "" : "s"} selected.`,
    );
    onClose();
  }, [roleId, mode, selected, onClose]);

  if (!open) return null;

  void roleName;

  return (
    <ModalShell open={open} onClose={onClose} z={70} backdropClose={false}>
      <div
        className="bg-white rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.3)] flex flex-col overflow-hidden"
        style={{ width: "min(1080px, calc(100vw - 64px))", maxHeight: "calc(100vh - 64px)" }}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E2E8F0] flex items-start justify-between shrink-0">
          <div className="min-w-0">
            <h2 className="text-[16px] text-[#0F172A]" style={{ fontWeight: 600 }}>
              Configure Role Scope
            </h2>
            <p className="text-[13px] text-[#64748B] mt-1 leading-[1.5]">
              Choose which roles users in this role can manage.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-[#F1F5F9] flex items-center justify-center cursor-pointer transition-colors shrink-0"
          >
            <X className="w-4 h-4 text-[#64748B]" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto bg-[#F8FAFC]">
          <div className="px-6 pt-5 pb-4 space-y-4">
            {/* Scope cards */}
            <section className="rounded-xl border border-[#E2E8F0] bg-white p-4">
              <p className="text-[12px] uppercase tracking-wide text-[#64748B] mb-3" style={{ fontWeight: 600 }}>
                Scope
              </p>
              <div className="grid grid-cols-2 gap-3">
                {(["selected", "all"] as const).map((m) => {
                  const isActive = mode === m;
                  const isSelected = m === "selected";
                  const accent = isSelected ? "#007FFF" : "#10B981";
                  const accentBg = isSelected ? "#EDF4FF" : "#ECFDF5";
                  const iconBg = isSelected ? "#DBEAFE" : "#D1FAE5";
                  const label = isSelected ? "Selected Roles" : "All Roles";
                  const desc = isSelected
                    ? "Limits management access to the roles you select below."
                    : "Grants management access to every role in the system, including roles created in the future. You can still assign role owners one role at a time.";
                  const Icon = isSelected ? ListChecks : Globe;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMode(m)}
                      className="text-left px-4 py-3.5 rounded-[10px] border-2 transition-colors cursor-pointer flex items-start gap-3"
                      style={{
                        backgroundColor: isActive ? accentBg : "#FFFFFF",
                        borderColor: isActive ? accent : "#E2E8F0",
                      }}
                    >
                      <span
                        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: iconBg }}
                      >
                        <Icon className="w-[18px] h-[18px]" style={{ color: accent }} />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13.5px] text-[#0F172A]" style={{ fontWeight: 600 }}>
                          {label}
                        </div>
                        <p className="text-[12px] text-[#64748B] mt-1 leading-[1.5]">{desc}</p>
                        {!isSelected && (
                          <p className="text-[12px] text-[#64748B] mt-1 leading-[1.5]">
                            Account Owner is a protected role and is never included.
                          </p>
                        )}
                      </div>
                      <span
                        className="w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5"
                        style={{ borderColor: isActive ? accent : "#CBD5E1" }}
                      >
                        {isActive && (
                          <span
                            className="w-[9px] h-[9px] rounded-full"
                            style={{ backgroundColor: accent }}
                          />
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* All-roles overlay banner */}
            {isAllScope && (
              <div
                className="flex items-center gap-2 px-3.5 py-2.5 rounded-[10px] border"
                style={{ backgroundColor: "#ECFDF5", borderColor: "#A7F3D0" }}
              >
                <Lock className="w-4 h-4 shrink-0" style={{ color: "#059669" }} />
                <p className="text-[12.5px] leading-[1.4]" style={{ color: "#065F46" }}>
                  All {totalRoles} roles are included. Switch to Selected roles to pick individually.
                </p>
              </div>
            )}
          </div>

          {/* Roles card grid */}
          <div className="px-6 pb-6">
            <div
              className="rounded-xl border border-[#E2E8F0] bg-white overflow-hidden flex flex-col transition-opacity"
              style={{ opacity: isAllScope ? 0.45 : 1, pointerEvents: isAllScope ? "none" : "auto" }}
            >
              <RolesSelectionPanel
                roles={roleOptions}
                selectedRoleIds={selectedSlugs}
                primaryRoleId=""
                onToggleRole={(slug) => {
                  const id = idBySlug.get(slug);
                  if (id != null) toggleRow(id);
                }}
                onSetPrimary={() => {}}
                hidePrimary
                flush
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-[#E2E8F0] bg-white flex items-center gap-3 shrink-0">
          <p className="text-[12.5px] text-[#475569] mr-auto">
            {isAllScope ? (
              <>
                All <span style={{ color: "#0F172A", fontWeight: 600 }}>{totalRoles}</span> roles included
              </>
            ) : (
              <>
                <span style={{ color: "#0F172A", fontWeight: 600 }}>{selectedCount}</span> role
                {selectedCount === 1 ? "" : "s"} selected
              </>
            )}
          </p>
          <button
            onClick={onClose}
            className="h-9 px-4 rounded-[8px] border border-[#E2E8F0] bg-white text-[13px] text-[#334155] hover:bg-[#F8FAFC] transition-colors cursor-pointer"
            style={{ fontWeight: 500 }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!isAllScope && selected.size === 0}
            className="h-9 px-4 rounded-[8px] bg-[#007FFF] text-white text-[13px] hover:bg-[#0066D6] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ fontWeight: 500 }}
          >
            Save
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
