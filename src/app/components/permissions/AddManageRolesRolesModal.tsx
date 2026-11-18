import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search, Shield, X, Globe, Info, ListChecks, TriangleAlert, CircleCheck } from "lucide-react";
import { toast } from "sonner";
import { ModalShell } from "../shared/ModalShell";
import { roles, scopeEligibleRoles, roleNameToOptionId, sortRolesCustomFirst, type RoleRow } from "../../data/roles-data";
import { SystemRoleLock } from "../shared/SystemRoleBadge";
import { RolesSelectionPanel } from "../create-user/Step2RolesPermissions";
import { Checkbox } from "../ui/checkbox";
import { Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip";
import { cn } from "../ui/utils";
import { highlightMatch } from "../../lib/highlight-text";
import {
  getRoleManageScope,
  saveRoleManageScope,
  type RoleManageScopeMode,
} from "../../data/role-manage-scope-data";

interface Props {
  open: boolean;
  onClose: () => void;
}

interface RoleScopeDraft {
  mode: RoleManageScopeMode;
  manageRoleIds: number[];
  configured: boolean;
  /** True if this draft was pre-toggled when the modal opened (not freshly enabled by user). */
  wasInitial?: boolean;
}

/* Roles that already inherit Manage Roles via system role, not shown. */
const LOCKED_ROLE_IDS = new Set<number>([1, 2]);
/* Mock: roles toggled-on but not yet configured (no amber dot, they're pre-existing). */
const PENDING_ROLE_IDS = new Set<number>([6, 13]);

/** Roles that already have Manage Roles configured at the role level,
 *  excluded from the Add modal entirely. Computed from the scope store. */
function getAlreadyAddedRoleIds(): Set<number> {
  const ids = new Set<number>();
  roles.forEach((r) => {
    const cfg = getRoleManageScope(r.id);
    if (cfg.mode === "all" || cfg.manageRoleIds.length > 0) ids.add(r.id);
  });
  LOCKED_ROLE_IDS.forEach((id) => ids.add(id));
  return ids;
}

export function AddManageRolesRolesModal({ open, onClose }: Props) {
  /* Available roles = custom roles minus those already added/locked.
   * Predefined roles are never offered: their permission set is system-managed,
   * so granting them this permission here is not something that can be saved. */
  const availableRoles = useMemo(() => {
    const excluded = getAlreadyAddedRoleIds();
    return [...roles]
      .filter((r) => !r.isSystem && !excluded.has(r.id))
      .sort(sortRolesCustomFirst);
  }, [open]);

  const [drafts, setDrafts] = useState<Record<number, RoleScopeDraft>>({});
  const [activeRoleId, setActiveRoleId] = useState<number | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [isListScrolled, setIsListScrolled] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  /* Initialize from mock pending only (already-added items are excluded). */
  useEffect(() => {
    if (!open) return;
    const initial: Record<number, RoleScopeDraft> = {};
    availableRoles.forEach((r) => {
      if (PENDING_ROLE_IDS.has(r.id)) {
        initial[r.id] = { mode: "selected", manageRoleIds: [], configured: false, wasInitial: true };
      }
    });
    setDrafts(initial);
    setActiveRoleId(availableRoles[0]?.id ?? null);
    setSearchQuery("");
  }, [open, availableRoles]);

  /* The list is custom-only by construction, so search is the only filter. */
  const filteredRoles = useMemo(() => {
    if (!searchQuery) return availableRoles;
    const q = searchQuery.toLowerCase();
    return availableRoles.filter((r) => r.roleName.toLowerCase().includes(q));
  }, [availableRoles, searchQuery]);

  const handleListScroll = useCallback(() => {
    if (listRef.current) setIsListScrolled(listRef.current.scrollTop > 0);
  }, []);

  const allFilteredSelected = filteredRoles.length > 0 && filteredRoles.every((r) => !!drafts[r.id]);
  const someFilteredSelected = filteredRoles.some((r) => !!drafts[r.id]);

  const toggleSelectAll = useCallback((on: boolean) => {
    setDrafts((prev) => {
      const next = { ...prev };
      filteredRoles.forEach((r) => {
        if (on) next[r.id] = next[r.id] ?? { mode: "selected", manageRoleIds: [], configured: false };
        else delete next[r.id];
      });
      return next;
    });
    if (on) setActiveRoleId((cur) => cur ?? filteredRoles[0]?.id ?? null);
    else setActiveRoleId((cur) => (cur != null && filteredRoles.some((r) => r.id === cur) ? null : cur));
  }, [filteredRoles]);

  const toggleRow = useCallback((roleId: number, on: boolean) => {
    setDrafts((prev) => {
      const next = { ...prev };
      if (on) {
        next[roleId] = next[roleId] ?? { mode: "selected", manageRoleIds: [], configured: false };
      } else {
        delete next[roleId];
      }
      return next;
    });
    if (on) setActiveRoleId(roleId);
    else setActiveRoleId((cur) => (cur === roleId ? null : cur));
  }, []);

  const activeDraft: RoleScopeDraft = activeRoleId != null
    ? drafts[activeRoleId] ?? { mode: "selected", manageRoleIds: [], configured: false }
    : { mode: "selected", manageRoleIds: [], configured: false };

  const updateDraft = useCallback((patch: Partial<RoleScopeDraft>) => {
    if (activeRoleId == null) return;
    setDrafts((prev) => ({
      ...prev,
      [activeRoleId]: { ...(prev[activeRoleId] ?? activeDraft), ...patch, configured: true, wasInitial: false },
    }));
  }, [activeRoleId, activeDraft]);

  const toggleRightRole = useCallback((roleId: number) => {
    if (activeRoleId == null) return;
    const ids = new Set(activeDraft.manageRoleIds);
    if (ids.has(roleId)) ids.delete(roleId);
    else ids.add(roleId);
    updateDraft({ manageRoleIds: Array.from(ids) });
  }, [activeDraft.manageRoleIds, activeRoleId, updateDraft]);

  const checkedCount = Object.keys(drafts).length;
  const configuredCount = useMemo(
    () => Object.values(drafts).filter(
      (d) => d.configured && (d.mode === "all" || d.manageRoleIds.length > 0),
    ).length,
    [drafts],
  );
  const canSubmit = checkedCount > 0;

  const handleSubmit = useCallback(() => {
    if (!canSubmit) return;
    Object.entries(drafts).forEach(([roleIdStr, d]) => {
      saveRoleManageScope(parseInt(roleIdStr, 10), {
        mode: d.mode,
        manageRoleIds: d.manageRoleIds,
      });
    });
    toast.success(`Manage Roles permission saved for ${checkedCount} role${checkedCount === 1 ? "" : "s"}.`);
    onClose();
  }, [canSubmit, drafts, checkedCount, onClose]);

  if (!open) return null;

  const activeRole = activeRoleId != null ? availableRoles.find((r) => r.id === activeRoleId) : null;

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
              Add Roles
            </h2>
            <p className="text-[12.5px] text-gray-500 mt-0.5">
              Select roles on the left, then use the panel on the right to choose which roles each one can manage.
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
                  placeholder="Search role"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-[8px] text-sm focus:outline-none focus:border-[#0E69E2] focus:ring-2 focus:ring-[#0E69E2]/20 transition-all"
                />
              </div>

              <div className="flex items-center gap-2.5 py-1 px-1">
                <Checkbox
                  checked={allFilteredSelected ? true : someFilteredSelected ? "indeterminate" : false}
                  onCheckedChange={(v) => toggleSelectAll(v === true)}
                  aria-label="Select all roles"
                />
                <span className="text-sm text-gray-600" style={{ fontWeight: 500 }}>
                  {checkedCount} role{checkedCount !== 1 ? "s" : ""} selected
                </span>
              </div>
            </div>

            <div
              ref={listRef}
              onScroll={handleListScroll}
              className="flex-1 overflow-y-auto px-4 pt-2 pb-4 flex flex-col gap-2.5"
            >
              {filteredRoles.map((r) => {
                const draft = drafts[r.id];
                const isOn = !!draft;
                const isActive = activeRoleId === r.id;
                const isConfigured = !!draft?.configured && (draft.mode === "all" || draft.manageRoleIds.length > 0);

                return (
                  <div key={r.id} className="relative">
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setActiveRoleId(r.id)}
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
                          onCheckedChange={(v) => toggleRow(r.id, v === true)}
                          aria-label={`Select ${r.roleName}`}
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {r.isSystem && <SystemRoleLock size={12} />}
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
                            {highlightMatch(r.roleName, searchQuery)}
                          </div>
                          {isOn && !draft?.wasInitial && (
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
                                  ? "Scope configured for this role."
                                  : "No scope configured yet. Use the panel on the right to set it up."}
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

              {filteredRoles.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Search className="w-8 h-8 text-gray-300 mb-3" />
                  <p className="text-sm text-gray-500" style={{ fontWeight: 500 }}>No Roles Found</p>
                </div>
              )}
            </div>
          </div>

          {/* Right Panel */}
          <div className="flex-1 min-w-0 flex flex-col bg-white border-l border-gray-200">
            {activeRole == null ? (
              <EmptyState />
            ) : (
              <ScopeConfigurePane
                title={activeRole.roleName}
                draft={activeDraft}
                onModeChange={(m) => updateDraft({ mode: m })}
                allRoles={[...scopeEligibleRoles].filter((r) => r.id !== activeRole.id).sort(sortRolesCustomFirst)}
                onToggleRole={toggleRightRole}
              />
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-gray-200 bg-white flex items-center gap-3 shrink-0">
          <p className="text-[13px] text-[#475569] mr-auto">
            <span style={{ color: "#0F172A", fontWeight: 600 }}>{checkedCount}</span> role{checkedCount === 1 ? "" : "s"} selected ·{" "}
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
        <Shield className="w-5 h-5 text-gray-400" />
      </div>
      <p className="text-[14px]" style={{ fontWeight: 600, color: "#0F172A" }}>
        Select a Role to Configure Its Scope
      </p>
      <p className="text-[12.5px] text-gray-500 mt-1 max-w-[300px]">
        Check a role on the left, then choose here which roles its users can manage.
      </p>
    </div>
  );
}

function ScopeConfigurePane({
  title,
  draft,
  onModeChange,
  allRoles,
  onToggleRole,
}: {
  title: string;
  draft: RoleScopeDraft;
  onModeChange: (m: RoleManageScopeMode) => void;
  allRoles: RoleRow[];
  onToggleRole: (id: number) => void;
}) {
  const isSelected = draft.mode === "selected";

  /* Card picker works with string option ids (slugs); the scope store uses
     numeric role ids. Map between the two. */
  const roleOptions = useMemo(() => allRoles.map((r) => ({
    id: roleNameToOptionId(r.roleName),
    name: r.roleName,
    license: r.licenseRequired,
    description: r.description,
    usersCount: r.usersCount,
    isSystem: r.isSystem,
  })), [allRoles]);
  const idBySlug = useMemo(
    () => new Map(allRoles.map((r) => [roleNameToOptionId(r.roleName), r.id])),
    [allRoles],
  );
  const slugById = useMemo(
    () => new Map(allRoles.map((r) => [r.id, roleNameToOptionId(r.roleName)])),
    [allRoles],
  );
  const selectedSlugs = useMemo(
    () => draft.manageRoleIds.map((id) => slugById.get(id)).filter((s): s is string => !!s),
    [draft.manageRoleIds, slugById],
  );

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
              Configure Scope for {title}
            </h3>
            <p className="text-[12.5px] mt-0.5" style={{ color: "#64748B" }}>
              Everything you set below applies only to this role. Choose which roles its users will be able to manage.
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

        <div
          className="rounded-[10px] border border-gray-200 bg-white overflow-hidden transition-opacity flex flex-col"
          style={{ opacity: isSelected ? 1 : 0.4, pointerEvents: isSelected ? "auto" : "none" }}
        >
          <RolesSelectionPanel
            roles={roleOptions}
            selectedRoleIds={selectedSlugs}
            primaryRoleId=""
            onToggleRole={(slug) => {
              const id = idBySlug.get(slug);
              if (id != null) onToggleRole(id);
            }}
            onSetPrimary={() => {}}
            hidePrimary
            flush
          />
        </div>
      </div>
    </div>
  );
}

