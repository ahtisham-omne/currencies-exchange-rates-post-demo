import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search, Users as UsersIcon, X, ChevronDown, Globe, Info, ListChecks, Crown, TriangleAlert, CircleCheck } from "lucide-react";
import { toast } from "sonner";
import { ModalShell } from "../shared/ModalShell";
import { scopeEligibleRoles, sortRolesCustomFirst, type RoleRow } from "../../data/roles-data";
import { users } from "../../data/users-data";
import { Checkbox } from "../ui/checkbox";
import { USER_AVATAR_MAP } from "../../data/user-avatars";
import { getAvatarTint, getInitials } from "../../lib/avatar";
import { cn } from "../ui/utils";
import { highlightMatch } from "../../lib/highlight-text";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip";
import { RoleAccessCardGrid, type RoleAccessLevel } from "./RoleAccessCardGrid";
import {
  getManageRolesConfig,
  saveManageRolesConfig,
  type ManageRolesScopeMode,
} from "../../data/manage-roles-scope-data";

interface Props {
  open: boolean;
  onClose: () => void;
}

type FilterKey = "All" | "Full Access" | "Field User";

interface UserDraft {
  mode: ManageRolesScopeMode;
  /** roleId → "manage" | "owner" */
  access: Record<number, "manage" | "owner">;
  configured: boolean;
}

const EMPTY_DRAFT: UserDraft = { mode: "selected", access: {}, configured: false };

/* Users that already inherit Manage Roles via system role, not shown. */
const LOCKED_USER_IDS = new Set<number>([2, 3]);
/* Mock pending (toggle ON, amber dot). Must NOT be in already-added set. */
const PENDING_USER_IDS = new Set<number>([7, 13]);

/** Users already associated with Manage Roles, excluded from the modal entirely.
 *  Cross-references the per-user scope store + locked system roles. */
function getAlreadyAddedUserIds(): Set<number> {
  const ids = new Set<number>();
  users.forEach((u) => {
    const cfg = getManageRolesConfig(u.id);
    if (cfg.mode === "all" || cfg.manageRoleIds.length > 0) ids.add(u.id);
  });
  LOCKED_USER_IDS.forEach((id) => ids.add(id));
  return ids;
}

export function AddManageRolesUsersModal({ open, onClose }: Props) {
  const sortedRoles = useMemo(() => [...scopeEligibleRoles].sort(sortRolesCustomFirst), []);

  /* Available users = all minus already added/locked. */
  const availableUsers = useMemo(() => {
    const excluded = getAlreadyAddedUserIds();
    return users.filter((u) => !excluded.has(u.id));
  }, [open]);

  const [drafts, setDrafts] = useState<Record<number, UserDraft>>({});
  const [activeUserId, setActiveUserId] = useState<number | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterKey>("All");
  const [isStatusFilterOpen, setIsStatusFilterOpen] = useState(false);
  const [isListScrolled, setIsListScrolled] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const initial: Record<number, UserDraft> = {};
    availableUsers.forEach((u) => {
      if (PENDING_USER_IDS.has(u.id)) {
        initial[u.id] = { mode: "selected", access: {}, configured: false };
      }
    });
    setDrafts(initial);
    setActiveUserId(availableUsers[0]?.id ?? null);
    setSearchQuery("");
    setStatusFilter("All");
  }, [open, availableUsers]);

  const filteredUsers = useMemo(() => {
    return availableUsers.filter((u) => {
      if (statusFilter === "Full Access" && u.license !== "Full Access") return false;
      if (statusFilter === "Field User" && u.license !== "Field User") return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!u.fullName.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [availableUsers, searchQuery, statusFilter]);

  const handleListScroll = useCallback(() => {
    if (listRef.current) setIsListScrolled(listRef.current.scrollTop > 0);
  }, []);

  const allFilteredSelected = filteredUsers.length > 0 && filteredUsers.every((u) => !!drafts[u.id]);
  const someFilteredSelected = filteredUsers.some((u) => !!drafts[u.id]);

  const toggleSelectAll = useCallback((on: boolean) => {
    setDrafts((prev) => {
      const next = { ...prev };
      filteredUsers.forEach((u) => {
        if (on) next[u.id] = next[u.id] ?? { ...EMPTY_DRAFT };
        else delete next[u.id];
      });
      return next;
    });
    if (on) setActiveUserId((cur) => cur ?? filteredUsers[0]?.id ?? null);
    else setActiveUserId((cur) => (cur != null && filteredUsers.some((u) => u.id === cur) ? null : cur));
  }, [filteredUsers]);

  const toggleRow = useCallback((userId: number, on: boolean) => {
    setDrafts((prev) => {
      const next = { ...prev };
      if (on) next[userId] = next[userId] ?? { ...EMPTY_DRAFT };
      else delete next[userId];
      return next;
    });
    if (on) setActiveUserId(userId);
    else setActiveUserId((cur) => (cur === userId ? null : cur));
  }, []);

  const activeDraft: UserDraft = activeUserId != null
    ? drafts[activeUserId] ?? EMPTY_DRAFT
    : EMPTY_DRAFT;

  const updateDraft = useCallback((patch: Partial<UserDraft>) => {
    if (activeUserId == null) return;
    setDrafts((prev) => ({
      ...prev,
      [activeUserId]: { ...(prev[activeUserId] ?? activeDraft), ...patch, configured: true },
    }));
  }, [activeUserId, activeDraft]);

  const setRoleAccess = useCallback((roleId: number, level: "none" | "manage" | "owner") => {
    const next = { ...activeDraft.access };
    if (level === "none") delete next[roleId];
    else next[roleId] = level;
    updateDraft({ access: next });
  }, [activeDraft.access, updateDraft]);

  const markAllAs = useCallback((level: "manage" | "owner") => {
    const next: Record<number, "manage" | "owner"> = {};
    sortedRoles.forEach((r) => { next[r.id] = level; });
    updateDraft({ mode: "selected", access: next });
  }, [sortedRoles, updateDraft]);

  const checkedCount = Object.keys(drafts).length;
  const configuredCount = useMemo(
    () => Object.values(drafts).filter(
      (d) => d.configured && (d.mode === "all" || Object.keys(d.access).length > 0),
    ).length,
    [drafts],
  );
  const canSubmit = checkedCount > 0;

  const handleSubmit = useCallback(() => {
    if (!canSubmit) return;
    Object.entries(drafts).forEach(([userIdStr, d]) => {
      const uid = parseInt(userIdStr, 10);
      const manageRoleIds = Object.keys(d.access).map((k) => parseInt(k, 10));
      const ownerByRoleId: Record<number, boolean> = {};
      Object.entries(d.access).forEach(([k, v]) => {
        if (v === "owner") ownerByRoleId[parseInt(k, 10)] = true;
      });
      saveManageRolesConfig(uid, { mode: d.mode, manageRoleIds, ownerByRoleId });
    });
    toast.success(`Manage Roles permission saved for ${checkedCount} user${checkedCount === 1 ? "" : "s"}.`);
    onClose();
  }, [canSubmit, drafts, checkedCount, onClose]);

  if (!open) return null;

  const activeUser = activeUserId != null ? users.find((u) => u.id === activeUserId) : null;

  return (
    <ModalShell open={open} onClose={onClose} z={70} backdropClose={false}>
      <div
        className="bg-white rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.3)] flex flex-col overflow-hidden"
        style={{
          width: "calc(100vw - 48px)",
          height: "calc(100vh - 48px)",
          maxWidth: 1320,
          maxHeight: 900,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 border-b border-gray-200 bg-white flex items-center justify-between px-6 py-3.5">
          <div className="min-w-0">
            <h2 className="text-gray-900 tracking-tight" style={{ fontSize: "18px", fontWeight: 700 }}>
              Add Users
            </h2>
            <p className="text-[12.5px] text-gray-500 mt-0.5">
              Select users on the left, then use the panel on the right to choose which roles each user can manage.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-[8px] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 min-h-0 overflow-hidden bg-[#F5F6F8]">
          {/* Left Panel */}
          <div className="w-[352px] shrink-0 bg-[#F5F6F8] flex flex-col relative z-20">
            <div
              className={cn(
                "p-4 pb-2 space-y-3 sticky top-0 bg-[#F5F6F8] transition-shadow duration-300 z-10",
                isListScrolled && "shadow-sm border-b border-gray-100",
              )}
            >
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="text"
                  placeholder="Search user"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-[8px] text-sm focus:outline-none focus:border-[#0E69E2] focus:ring-2 focus:ring-[#0E69E2]/20 transition-all"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500" style={{ fontWeight: 500 }}>Filter By</span>
                <div className="relative">
                  <button
                    onClick={() => setIsStatusFilterOpen(!isStatusFilterOpen)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 border rounded-[8px] text-xs transition-colors cursor-pointer",
                      statusFilter !== "All"
                        ? "bg-[#0E69E2]/10 border-[#0E69E2]/30 text-[#0E69E2]"
                        : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50",
                    )}
                    style={{ fontWeight: 500 }}
                  >
                    {statusFilter === "All" ? "License" : statusFilter} <ChevronDown size={12} />
                  </button>
                  {isStatusFilterOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setIsStatusFilterOpen(false)} />
                      <div className="absolute top-full mt-1 left-0 w-40 bg-white rounded-[8px] shadow-lg border border-gray-100 py-1 z-20 flex flex-col">
                        {(["All", "Full Access", "Field User"] as const).map((s) => (
                          <button
                            key={s}
                            onClick={() => { setStatusFilter(s); setIsStatusFilterOpen(false); }}
                            className={cn(
                              "text-left px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer",
                              statusFilter === s ? "text-[#0E69E2] bg-[#0E69E2]/10" : "text-gray-700",
                            )}
                            style={{ fontWeight: statusFilter === s ? 500 : 400 }}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2.5 py-1 px-1">
                <Checkbox
                  checked={allFilteredSelected ? true : someFilteredSelected ? "indeterminate" : false}
                  onCheckedChange={(v) => toggleSelectAll(v === true)}
                  aria-label="Select all users"
                />
                <span className="text-sm text-gray-600" style={{ fontWeight: 500 }}>
                  {checkedCount} user{checkedCount !== 1 ? "s" : ""} selected
                </span>
              </div>
            </div>

            <div
              ref={listRef}
              onScroll={handleListScroll}
              className="flex-1 overflow-y-auto px-4 pt-2 pb-4 flex flex-col gap-2.5"
            >
              {filteredUsers.map((u) => {
                const draft = drafts[u.id];
                const isOn = !!draft;
                const isActive = activeUserId === u.id;
                const isConfigured = !!draft?.configured && (draft.mode === "all" || Object.keys(draft.access).length > 0);
                const initials = getInitials(u.fullName);
                const tint = getAvatarTint(u.fullName);
                const avatarUrl = USER_AVATAR_MAP[u.id];

                return (
                  <div key={u.id} className="relative">
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setActiveUserId(u.id)}
                      className={cn(
                        "w-full relative flex items-center gap-3 px-3.5 py-4 rounded-[8px] text-left transition-all duration-200 border cursor-pointer",
                        isActive
                          ? "bg-[#F0F7FF] border-[#0E69E2]/40 shadow-sm"
                          : isOn
                          ? "bg-white border-gray-200 shadow-sm hover:bg-gray-50"
                          : "bg-[#FCFDFD] border-gray-300 border-dashed shadow-sm",
                      )}
                    >
                      <div onClick={(e) => e.stopPropagation()} className="shrink-0 flex items-center">
                        <Checkbox
                          checked={isOn}
                          onCheckedChange={(v) => toggleRow(u.id, v === true)}
                          aria-label={`Select ${u.fullName}`}
                        />
                      </div>
                      {avatarUrl ? (
                        <img src={avatarUrl} alt={u.fullName} className="w-8 h-8 rounded-full object-cover shrink-0" />
                      ) : (
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] shrink-0"
                          style={{ backgroundColor: tint.bg, color: tint.fg, fontWeight: 600 }}
                        >
                          {initials}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <div
                            className={cn(
                              "truncate",
                              isActive || isOn ? "text-gray-900" : "text-gray-500",
                            )}
                            style={{
                              fontSize: "14px",
                              fontWeight: isActive ? 600 : 500,
                              lineHeight: "1.3",
                            }}
                          >
                            {highlightMatch(u.fullName, searchQuery)}
                          </div>
                          {isOn && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="ml-1 shrink-0 inline-flex items-center">
                                  {isConfigured ? (
                                    <CircleCheck className="w-3.5 h-3.5" style={{ color: "#10B981" }} />
                                  ) : (
                                    <TriangleAlert className="w-3.5 h-3.5" style={{ color: "#F59E0B" }} />
                                  )}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="top" style={{ zIndex: 100 }} className="max-w-[240px] text-[11.5px] leading-[1.5]">
                                {isConfigured
                                  ? "Access configured for this user."
                                  : "No access configured yet. Use the panel on the right to set it up."}
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </div>
                    </div>

                    {isActive && (
                      <div className="absolute -right-[7px] top-1/2 -translate-y-1/2 z-10">
                        <div
                          className="w-3.5 h-3.5 border-t border-r border-[#0E69E2]/40 rotate-45"
                          style={{ backgroundColor: "#f0f7ff" }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}

              {filteredUsers.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Search className="w-8 h-8 text-gray-300 mb-3" />
                  <p className="text-sm text-gray-500" style={{ fontWeight: 500 }}>No Users Found</p>
                </div>
              )}
            </div>
          </div>

          {/* Right Panel */}
          <div className="flex-1 min-w-0 flex flex-col bg-white border-l border-gray-200">
            {activeUser == null ? (
              <EmptyState />
            ) : (
              <UserAccessPane
                userName={activeUser.fullName}
                draft={activeDraft}
                roles={sortedRoles}
                onModeChange={(m) => updateDraft({ mode: m })}
                onRoleAccess={setRoleAccess}
                onMarkAllAs={markAllAs}
              />
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-gray-200 bg-white flex items-center gap-3 shrink-0">
          <p className="text-[13px] text-[#475569] mr-auto">
            <span style={{ color: "#0F172A", fontWeight: 600 }}>{checkedCount}</span> user{checkedCount === 1 ? "" : "s"} selected ·{" "}
            <span style={{ color: "#0F172A", fontWeight: 600 }}>{configuredCount}</span> configured
          </p>
          <button
            onClick={onClose}
            className="h-9 px-4 rounded-[8px] border border-gray-200 bg-white text-[13px] text-[#334155] hover:bg-gray-50 transition-colors cursor-pointer"
            style={{ fontWeight: 500 }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="h-9 px-4 rounded-[8px] text-white text-[13px] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ fontWeight: 500, backgroundColor: canSubmit ? "#0E69E2" : "#94A3B8" }}
          >
            Save and Add
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

/* ─── Subcomponents ─── */

function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
      <div className="w-12 h-12 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center mb-3">
        <UsersIcon className="w-5 h-5 text-gray-400" />
      </div>
      <p className="text-[14px]" style={{ fontWeight: 600, color: "#0F172A" }}>
        Select a User to Configure Their Access
      </p>
      <p className="text-[12.5px] text-gray-500 mt-1 max-w-[300px]">
        Check a user on the left, then choose here which roles they can manage.
      </p>
    </div>
  );
}

function UserAccessPane({
  userName,
  draft,
  roles: rolesList,
  onModeChange,
  onRoleAccess,
  onMarkAllAs,
}: {
  userName: string;
  draft: UserDraft;
  roles: RoleRow[];
  onModeChange: (m: ManageRolesScopeMode) => void;
  onRoleAccess: (roleId: number, level: "none" | "manage" | "owner") => void;
  onMarkAllAs: (level: "manage" | "owner") => void;
}) {
  const isSelected = draft.mode === "selected";
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="px-6 pt-4 shrink-0 bg-white">
        <div
          className="flex items-stretch gap-3 rounded-[10px] border p-2.5"
          style={{ backgroundColor: "#F8FAFC", borderColor: "#E2E8F0" }}
        >
          <div
            className="w-11 rounded-[8px] flex items-center justify-center shrink-0 self-stretch"
            style={{ backgroundColor: "#E2E8F0" }}
          >
            <Info className="w-[18px] h-[18px]" style={{ color: "#475569" }} />
          </div>
          <div className="min-w-0 py-0.5">
            <h3 className="text-[13.5px] truncate" style={{ color: "#0F172A", fontWeight: 600 }}>
              Configure Access for {userName}
            </h3>
            <p className="text-[12.5px] mt-0.5" style={{ color: "#64748B" }}>
              Everything you set below applies only to this user. Choose which roles they can manage, and at what level.
            </p>
          </div>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto px-6 pt-4 pb-5 space-y-5">
        <div className="grid grid-cols-2 gap-3">
          {(["selected", "all"] as const).map((m) => {
            const active = draft.mode === m;
            const sel = m === "selected";
            const accent = sel ? "#0E69E2" : "#10B981";
            const accentBg = sel ? "#EDF4FF" : "#ECFDF5";
            const iconBg = sel ? "#DBEAFE" : "#D1FAE5";
            const Icon = sel ? ListChecks : Globe;
            return (
              <button
                key={m}
                type="button"
                onClick={() => onModeChange(m)}
                className="text-left px-4 py-3 rounded-[10px] border-2 transition-colors cursor-pointer flex items-start gap-3"
                style={{
                  backgroundColor: active ? accentBg : "#FFFFFF",
                  borderColor: active ? accent : "#E2E8F0",
                }}
              >
                <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: iconBg }}>
                  <Icon className="w-[18px] h-[18px]" style={{ color: accent }} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] text-[#0F172A]" style={{ fontWeight: 600 }}>
                    {sel ? "Selected Roles" : "All Roles"}
                  </div>
                  <p className="text-[11.5px] text-gray-500 mt-1 leading-[1.4]">
                    {sel
                      ? "Limits management access to the roles you select below."
                      : "Grants management access to every role in the system, including roles created in the future. You can still assign role owners one role at a time."}
                  </p>
                  {!sel && (
                    <p className="text-[11.5px] text-gray-500 mt-1 leading-[1.4]">
                      Account Owner is a protected role and is never included.
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <RolePickerSection
          rolesList={rolesList}
          draft={draft}
          onRoleAccess={onRoleAccess}
          onMarkAllAs={onMarkAllAs}
          isSelected={isSelected}
        />
      </div>
    </div>
  );
}

function RolePickerSection({
  rolesList,
  draft,
  onRoleAccess,
  onMarkAllAs,
  isSelected,
}: {
  rolesList: RoleRow[];
  draft: UserDraft;
  onRoleAccess: (roleId: number, level: "none" | "manage" | "owner") => void;
  onMarkAllAs: (level: "manage" | "owner") => void;
  isSelected: boolean;
}) {
  const configuredCount = Object.keys(draft.access).length;

  return (
    <div
      className="rounded-[10px] border border-gray-200 bg-white overflow-hidden transition-opacity flex flex-col"
      style={{ opacity: isSelected ? 1 : 0.4, pointerEvents: isSelected ? "auto" : "none" }}
    >
      <RoleAccessCardGrid
        roles={rolesList}
        getLevel={(id) => (draft.access[id] ?? "none") as RoleAccessLevel}
        onLevelChange={(id, l) => onRoleAccess(id, l)}
        rightLabel={`${configuredCount} of ${rolesList.length} configured`}
        headerRight={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center justify-center h-9 gap-1.5 px-2.5 rounded-[8px] border border-gray-200 bg-white text-[12px] text-[#334155] hover:bg-gray-50 transition-colors cursor-pointer"
                style={{ fontWeight: 500 }}
              >
                Mark All As
                <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" style={{ zIndex: 100 }} className="w-[160px] p-1.5">
              <DropdownMenuItem className="flex items-center gap-2 py-2 px-2.5 cursor-pointer rounded-md" onSelect={() => onMarkAllAs("manage")}>
                <UsersIcon className="w-4 h-4" style={{ color: "#0E69E2" }} />
                <span className="text-sm" style={{ fontWeight: 500 }}>Manage</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="flex items-center gap-2 py-2 px-2.5 cursor-pointer rounded-md" onSelect={() => onMarkAllAs("owner")}>
                <Crown className="w-4 h-4" style={{ color: "#F59E0B" }} />
                <span className="text-sm" style={{ fontWeight: 500 }}>Owner</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />
    </div>
  );
}
