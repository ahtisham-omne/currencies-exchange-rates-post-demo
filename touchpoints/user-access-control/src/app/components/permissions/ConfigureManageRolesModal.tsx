import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { ChevronDown, ChevronRight, Crown, Globe, Info, ListChecks, Users as UsersIcon, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { toast } from "sonner";
import { ModalShell } from "../shared/ModalShell";
import { roles, scopeEligibleRoles, isProtectedRoleId, sortRolesCustomFirst } from "../../data/roles-data";
import { users } from "../../data/users-data";
import { RoleAccessCardGrid } from "./RoleAccessCardGrid";
import {
  getManageRolesConfig,
  getOwnedRoleIds,
  saveManageRolesConfig,
  type ManageRolesScopeMode,
} from "../../data/manage-roles-scope-data";
import { addUsersToRole } from "../../data/role-detail-data";
import { getRoleManageScope, subscribeRoleManageScope } from "../../data/role-manage-scope-data";
import type { RoleAccessLock } from "./RoleAccessCardGrid";
import {
  ConfirmRoleOwnerAssignmentModal,
  type OwnerDecision,
} from "../role-detail/ConfirmRoleOwnerAssignmentModal";
import { manageRolesSavedMessage } from "../../lib/role-owner-toasts";

interface Props {
  open: boolean;
  onClose: () => void;
  userId: number;
  /** Role IDs the user is assigned to, drives non-holder detection only. */
  assignedRoleIds: number[];
}

export function ConfigureManageRolesModal({
  open,
  onClose,
  userId,
  assignedRoleIds,
}: Props) {
  const userName = useMemo(
    () => users.find((u) => u.id === userId)?.fullName ?? "User",
    [userId],
  );

  /* ─── State, hydrated on open ─── */
  const [mode, setMode] = useState<ManageRolesScopeMode>("selected");
  const [manageIds, setManageIds] = useState<Set<number>>(new Set());
  const [ownerByRoleId, setOwnerByRoleId] = useState<Record<number, boolean>>({});
  
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [explainerOpen, setExplainerOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const cfg = getManageRolesConfig(userId);
    setMode(cfg.mode);
    setManageIds(new Set(cfg.manageRoleIds.filter((rid) => !isProtectedRoleId(rid))));
    const owned = getOwnedRoleIds(userId);
    const ownerMap: Record<number, boolean> = {};
    owned.forEach((rid) => {
      if (!isProtectedRoleId(rid)) ownerMap[rid] = true;
    });
    setOwnerByRoleId(ownerMap);
    setConfirmOpen(false);
  }, [open, userId]);

  const sortedRoles = useMemo(() => [...scopeEligibleRoles].sort(sortRolesCustomFirst), []);
  const isSelectedScope = mode === "selected";
  const holderRoleIds = useMemo(() => new Set(assignedRoleIds), [assignedRoleIds]);

  /* ─── Inherited manage scope: union of the role-level Manage Roles scope of
   *     every role this user holds. These cards are locked, an admin can raise
   *     them to Owner but never remove them here. ─── */
  const roleScopeVersion = useSyncExternalStore(
    subscribeRoleManageScope,
    () => assignedRoleIds.map((rid) => getRoleManageScope(rid).manageRoleIds.join(",")).join("|"),
    () => "",
  );
  const inheritedByRoleId = useMemo(() => {
    void roleScopeVersion;
    const map = new Map<number, string>();
    assignedRoleIds.forEach((sourceId) => {
      const source = roles.find((r) => r.id === sourceId);
      if (!source) return;
      const cfg = getRoleManageScope(sourceId);
      const targetIds = (cfg.mode === "all" ? scopeEligibleRoles.map((r) => r.id) : cfg.manageRoleIds).filter((rid) => !isProtectedRoleId(rid));
      targetIds.forEach((tid) => {
        if (!map.has(tid)) map.set(tid, source.roleName);
      });
    });
    return map;
  }, [assignedRoleIds, roleScopeVersion]);

  const inheritedOwnerIds = useMemo(() => {
    const owned = new Set(getOwnedRoleIds(userId));
    return new Set([...inheritedByRoleId.keys()].filter((rid) => owned.has(rid)));
  }, [inheritedByRoleId, userId]);

  const getLock = useCallback(
    (roleId: number): RoleAccessLock | null => {
      const sourceRoleName = inheritedByRoleId.get(roleId);
      if (!sourceRoleName) return null;
      return {
        minLevel: inheritedOwnerIds.has(roleId) ? "owner" : "manage",
        sourceRoleName,
      };
    },
    [inheritedByRoleId, inheritedOwnerIds],
  );

  const toggleManage = useCallback((roleId: number) => {
    setManageIds((prev) => {
      const next = new Set(prev);
      if (next.has(roleId)) next.delete(roleId);
      else next.add(roleId);
      return next;
    });
  }, []);

  const toggleOwner = useCallback((roleId: number) => {
    setOwnerByRoleId((prev) => {
      const nextOwner = !prev[roleId];
      // When turning Owner on, automatically grant Manage as well.
      if (nextOwner) {
        setManageIds((prevManage) => {
          if (prevManage.has(roleId)) return prevManage;
          const next = new Set(prevManage);
          next.add(roleId);
          return next;
        });
      }
      return { ...prev, [roleId]: nextOwner };
    });
  }, []);

  const markAllAs = useCallback((level: "manage" | "owner") => {
    if (level === "manage") {
      setMode("selected");
      setManageIds(new Set(scopeEligibleRoles.map((r) => r.id)));
      // Inherited Owner cards cannot be lowered, so they keep Owner.
      setOwnerByRoleId((prev) => {
        const kept: Record<number, boolean> = {};
        inheritedOwnerIds.forEach((rid) => {
          if (prev[rid]) kept[rid] = true;
        });
        return kept;
      });
    } else {
      const ownerMap: Record<number, boolean> = {};
      scopeEligibleRoles.forEach((r) => { ownerMap[r.id] = true; });
      setOwnerByRoleId(ownerMap);
      setManageIds(new Set(scopeEligibleRoles.map((r) => r.id)));
    }
  }, [inheritedOwnerIds]);

  /* ─── Derived counts ─── */
  const ownerOnIds = useMemo(
    () =>
      Object.entries(ownerByRoleId)
        .filter(([, v]) => v)
        .map(([k]) => parseInt(k, 10)),
    [ownerByRoleId],
  );
  const ownerCount = ownerOnIds.length;
  const effectiveManagedIds = useMemo(() => {
    if (mode === "all") return sortedRoles.map((r) => r.id);
    return Array.from(new Set([...manageIds, ...ownerOnIds, ...inheritedByRoleId.keys()]));
  }, [mode, manageIds, ownerOnIds, sortedRoles, inheritedByRoleId]);
  const managingCount = effectiveManagedIds.length;

  /* ─── Save flow with non-holder confirmation ─── */
  const nonHolderOwnerRows = useMemo(() => {
    return ownerOnIds
      .filter((rid) => !holderRoleIds.has(rid))
      .map((rid) => {
        const r = sortedRoles.find((x) => x.id === rid);
        return {
          userId,
          roleId: rid,
          roleName: r?.roleName ?? "Unknown role",
        };
      });
  }, [ownerOnIds, holderRoleIds, sortedRoles, userId]);

  const commitSave = useCallback(
    (alsoAddRoleIds: number[]) => {
      alsoAddRoleIds.forEach((rid) => {
        addUsersToRole(rid, [userId]);
      });

      saveManageRolesConfig(userId, {
        mode,
        manageRoleIds: Array.from(new Set([...manageIds, ...inheritedByRoleId.keys()])),
        ownerByRoleId,
      });

      const finalManagingCount =
        mode === "all"
          ? sortedRoles.length
          : Array.from(new Set([...manageIds, ...ownerOnIds, ...inheritedByRoleId.keys()])).length;

      toast.success(
        manageRolesSavedMessage(userName, finalManagingCount, ownerCount),
      );
      setConfirmOpen(false);
      onClose();
    },
    [
      userId,
      mode,
      manageIds,
      ownerByRoleId,
      ownerOnIds,
      sortedRoles,
      ownerCount,
      userName,
      onClose,
      inheritedByRoleId,
    ],
  );

  const handleSave = useCallback(() => {
    if (nonHolderOwnerRows.length > 0) {
      setConfirmOpen(true);
      return;
    }
    commitSave([]);
  }, [nonHolderOwnerRows, commitSave]);

  const handleConfirm = useCallback(
    (decisions: Record<string, OwnerDecision>) => {
      const alsoAdd = nonHolderOwnerRows
        .filter((r) => decisions[`${r.userId}:${r.roleId}`] === "owner-and-add")
        .map((r) => r.roleId);
      commitSave(alsoAdd);
    },
    [nonHolderOwnerRows, commitSave],
  );

  /* ─── Per-role access level (card grid) ─── */
  const getLevel = useCallback(
    (roleId: number): "none" | "manage" | "owner" => {
      if (ownerByRoleId[roleId]) return "owner";
      if (mode === "all" || manageIds.has(roleId) || inheritedByRoleId.has(roleId)) return "manage";
      return "none";
    },
    [ownerByRoleId, mode, manageIds, inheritedByRoleId],
  );

  const setLevel = useCallback(
    (roleId: number, level: "none" | "manage" | "owner") => {
      const isOwner = !!ownerByRoleId[roleId];
      const lock = getLock(roleId);
      if (lock && (level === "none" || (level === "manage" && lock.minLevel === "owner"))) return;
      if (level === "none") {
        if (mode === "all") return;
        if (isOwner) toggleOwner(roleId);
        if (manageIds.has(roleId)) toggleManage(roleId);
        return;
      }
      if (level === "manage") {
        if (isOwner) toggleOwner(roleId);
        if (mode === "selected" && !manageIds.has(roleId)) toggleManage(roleId);
        return;
      }
      if (!isOwner) toggleOwner(roleId);
    },
    [ownerByRoleId, mode, manageIds, toggleOwner, toggleManage, getLock],
  );

  if (!open) return null;

  return (
    <ModalShell open={open} onClose={onClose} z={70} backdropClose={false}>
      <div
        className="bg-white rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.3)] flex flex-col overflow-hidden"
        style={{ width: "min(1080px, calc(100vw - 64px))", maxHeight: "calc(100vh - 64px)" }}
      >
        {/* ── Header ── */}
        <div className="px-6 py-4 border-b border-[#E2E8F0] flex items-start justify-between shrink-0">
          <div className="min-w-0">
            <h2 className="text-[16px] text-[#0F172A]" style={{ fontWeight: 600 }}>
              Pick the Roles {userName} Can Manage
            </h2>
            <p className="text-[13px] text-[#64748B] mt-1 leading-[1.5]">
              Choose which roles this user can manage. You can also assign them
              as a role owner for any of these roles. Assigning Owner on a role
              automatically includes Manage access for that role.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-[#F1F5F9] flex items-center justify-center cursor-pointer transition-colors shrink-0"
          >
            <X className="w-4 h-4 text-[#64748B]" />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 min-h-0 overflow-y-auto bg-[#F8FAFC]">
          <div className="px-6 pt-5 pb-4 space-y-4 shrink-0">
            {/* Collapsible explainer: Manage vs Role Owner.
                Glassy blue shell mirroring the "What is a role owner?" card
                on Role Detail → Owners tab. Collapsed by default. */}
            <div
              className="rounded-2xl border overflow-hidden"
              style={{
                borderColor: "#CFDAEA",
                background: "linear-gradient(178deg, #FBFCFF 0%, #F1F5FB 38%, #E7EDF6 100%)",
                boxShadow: [
                  "inset 0 1px 0 rgba(255, 255, 255, 0.95)",
                  "inset 0 2px 6px -2px rgba(255, 255, 255, 0.85)",
                  "inset 1px 0 0 rgba(255, 255, 255, 0.6)",
                  "inset -1px 0 0 rgba(10, 119, 255, 0.04)",
                  "inset 0 -1px 0 rgba(10, 119, 255, 0.06)",
                  "0 1px 3px rgba(10, 119, 255, 0.10)",
                  "0 8px 24px -12px rgba(10, 119, 255, 0.10)",
                ].join(", "),
              }}
            >
              <button
                type="button"
                onClick={() => setExplainerOpen((v) => !v)}
                className="w-full flex items-center gap-2.5 px-4 py-3 cursor-pointer hover:bg-white/40 transition-colors text-left"
              >
                <span
                  className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                  style={{
                    backgroundColor: "#EDF4FF",
                    border: "1px solid rgba(10, 119, 255, 0.12)",
                  }}
                >
                  <Crown className="w-3.5 h-3.5" style={{ fill: "#0A77FF", color: "#0A77FF" }} />
                </span>
                <span className="text-[13px] flex-1" style={{ color: "#0F172A", fontWeight: 600 }}>
                  What Is the Difference Between Manage and Role Owner?
                </span>
                {explainerOpen ? (
                  <ChevronDown className="w-4 h-4 shrink-0" style={{ color: "#64748B" }} />
                ) : (
                  <ChevronRight className="w-4 h-4 shrink-0" style={{ color: "#64748B" }} />
                )}
              </button>
              {explainerOpen && (
                <div className="px-4 pb-4 pt-1">
                  <div
                    className="space-y-1.5"
                    style={{
                      background: "rgba(255, 255, 255, 0.45)",
                      border: "1px solid rgba(255, 255, 255, 0.45)",
                      borderRadius: 12,
                      padding: "14px 16px",
                      boxShadow:
                        "inset 0 1px 0 rgba(255, 255, 255, 0.75), 0 1px 2px rgba(15, 23, 42, 0.025), 0 2px 6px rgba(15, 23, 42, 0.025)",
                      fontSize: 13,
                      color: "rgb(51, 65, 85)",
                      lineHeight: 1.65,
                    }}
                  >
                    <p>
                      <span style={{ fontWeight: 600 }}>Manage:</span> Can add and remove users from the selected
                      roles. Does not include approving or denying permission requests.
                    </p>
                    <p>
                      <span style={{ fontWeight: 600 }}>Owner:</span> Includes everything Manage provides, plus
                      approving or denying permission requests for the role. Owners do not need to hold the role
                      themselves.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Section 2: Scope cards */}
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

            {/* Compact info banner, only when scope = All roles */}
            {!isSelectedScope && (
              <div
                className="flex items-center gap-2 px-3.5 py-2.5 rounded-[10px] border"
                style={{ backgroundColor: "#ECFDF5", borderColor: "#A7F3D0" }}
              >
                <Info className="w-4 h-4 shrink-0" style={{ color: "#059669" }} />
                <p className="text-[12.5px] leading-[1.4]" style={{ color: "#065F46" }}>
                  Manage is on for every role. Pick Role Owners below.
                </p>
              </div>
            )}
          </div>

          {/* Section 3: Roles card grid */}
          <div className="px-6 pb-6">
            <div className="rounded-xl border border-[#E2E8F0] bg-white overflow-hidden flex flex-col">
              <RoleAccessCardGrid
                roles={sortedRoles}
                getLevel={getLevel}
                onLevelChange={setLevel}
                noneDisabled={mode === "all"}
                getLock={getLock}
                rightLabel={`${sortedRoles.length} roles`}
                headerRight={
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex items-center justify-center h-9 gap-1.5 px-3 rounded-[8px] border border-border/80 bg-white shadow-sm hover:bg-muted/50 transition-colors cursor-pointer outline-none"
                        style={{ color: "#334155" }}
                      >
                        <span className="text-sm" style={{ fontWeight: 500 }}>Mark All As</span>
                        <ChevronDown className="w-3.5 h-3.5" style={{ color: "#CBD5E1" }} />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" style={{ zIndex: 100 }} className="w-[180px] p-1.5">
                      <DropdownMenuItem
                        className="flex items-center gap-2 py-2 px-2.5 cursor-pointer rounded-md"
                        onSelect={() => markAllAs("manage")}
                      >
                        <UsersIcon className="w-4 h-4" style={{ color: "#007FFF" }} />
                        <span className="text-sm" style={{ fontWeight: 500 }}>Manage</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="flex items-center gap-2 py-2 px-2.5 cursor-pointer rounded-md"
                        onSelect={() => markAllAs("owner")}
                      >
                        <Crown className="w-4 h-4" style={{ color: "#F59E0B" }} />
                        <span className="text-sm" style={{ fontWeight: 500 }}>Owner</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                }
              />
            </div>

            {/* Legend */}
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[11.5px] text-[#64748B]">
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#CBD5E1" }} />
                <span><span style={{ fontWeight: 600, color: "#334155" }}>None:</span> No access to this role</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#0E69E2" }} />
                <span><span style={{ fontWeight: 600, color: "#334155" }}>Manage:</span> Add and remove users from this role</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#F59E0B" }} />
                <span><span style={{ fontWeight: 600, color: "#334155" }}>Owner:</span> Manage plus approve access requests</span>
              </span>
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="px-6 py-3.5 border-t border-[#E2E8F0] bg-white flex items-center gap-3 shrink-0">
          <p className="text-[12.5px] text-[#475569] mr-auto">
            Managing{" "}
            <span style={{ color: "#0F172A", fontWeight: 600 }}>{managingCount}</span>{" "}
            role{managingCount === 1 ? "" : "s"} · Owner of{" "}
            <span style={{ color: "#0F172A", fontWeight: 600 }}>{ownerCount}</span>
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
            className="h-9 px-4 rounded-[8px] bg-[#007FFF] text-white text-[13px] hover:bg-[#0066D6] transition-colors cursor-pointer"
            style={{ fontWeight: 500 }}
          >
            Save
          </button>
        </div>
      </div>

      {/* Non-holder confirmation */}
      <ConfirmRoleOwnerAssignmentModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirm}
        context={{ kind: "multi-role", rows: nonHolderOwnerRows }}
      />
    </ModalShell>
  );
}
