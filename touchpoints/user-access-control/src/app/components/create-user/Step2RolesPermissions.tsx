import { useState, useMemo, useCallback } from "react";
import { Search, X, ExternalLink, Star, KeyRound, Eye, Check } from "lucide-react";
import { highlightMatch } from "../../lib/highlight-text";
import type { CreateUserFormData, RoleOption } from "./types";
import { ASSIGN_STEP_ROLES, isLockedRoleOption } from "./types";
import { LicenseBadge } from "../table-cells";
import { SystemRoleLock } from "../shared/SystemRoleBadge";
import { Input } from "../ui/input";
import { DataTableFilterPills } from "../data-table/DataTableFilterPills";
import type { QuickFilterDef } from "../data-table/types";
import { PermissionsModuleGrid } from "../permissions/PermissionsModuleGrid";
import { getPermissionsForRoles, getPermissionSources, ROLE_PERMISSION_MAP } from "../../data/role-permissions-map";
import { PERMISSION_MODULES, buildEmptyTogglesForModule } from "../../data/permissions-data";
import { roles as MAIN_ROLES } from "../../data/roles-data";
import { SegmentedTabs, type SegmentedTabDef } from "../shared/SegmentedTabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { ACCOUNT_OWNER_COPY } from "../../data/account-owner";


type SubTab = "roles" | "permissions";

interface Step2Props {
  formData: CreateUserFormData;
  errors: Record<string, string>;
  onFieldChange: <K extends keyof CreateUserFormData>(key: K, value: CreateUserFormData[K]) => void;
  /** When true, render the Roles tab flush, without its own bordered/rounded
   *  card wrapper. Use when this component is already mounted inside another
   *  modal/card that provides the frame (e.g. Quick Invite). Defaults to false
   *  so the Create User wizard's slate background still shows a white panel. */
  flush?: boolean;
  /** Optional seed for the Permissions tab's direct (non-role) toggles. Used by
   *  the Unarchive / Reactivate flow to pre-select previously held direct
   *  permissions. Omitted by Create User / Quick Invite, where a brand-new
   *  account starts with everything off: catalog defaults are a role-authoring
   *  concept and must not pre-grant access to a person. */
  initialDirectToggles?: (moduleId: string) => Record<string, boolean>;
}

/* ─── Quick filter config for roles table ─── */
const ROLES_QUICK_FILTERS: QuickFilterDef[] = [
  { key: "all", label: "Show All", showCount: true },
  { key: "custom", label: "Custom", showCount: true, group: "type" },
  { key: "system", label: "Predefined", showCount: true, group: "type" },
  { key: "full", label: "Full Access", showCount: true, group: "license" },
  { key: "field", label: "Field User", showCount: true, group: "license" },
];

const SUB_TABS: SegmentedTabDef<SubTab>[] = [
  { key: "roles",       label: "Roles",       color: "#0A77FF" },
  { key: "permissions", label: "Permissions", color: "#059669" },
];

/* ═════════════════════════════════════════════════════════════════
   RoleCard: partner-style selection card for the Roles tab.
   Mirrors the Create Partner GroupCard pattern: hover-reveal eye +
   star, selection checkmark, Primary pill, hover-to-link permission
   count footer. First selection auto-promotes to primary via the
   parent's toggleRole logic.
   ═════════════════════════════════════════════════════════════════ */
function RoleCard({
  role,
  isSelected,
  isPrimary,
  searchQuery,
  onSelect,
  onSetPrimary,
  hidePrimary = false,
}: {
  role: RoleOption;
  isSelected: boolean;
  isPrimary: boolean;
  searchQuery: string;
  onSelect: () => void;
  onSetPrimary: () => void;
  /** Hide the "set as primary" star + Primary badge (no primary concept here). */
  hidePrimary?: boolean;
}) {
  const [isHovered, setIsHovered] = useState(false);

  /* The Account Owner card shows but can't be picked: only Omne makes a user
   * an Account Owner (ERP-5154 AC12). A user who already holds it keeps it
   * picked and can't take it off here (ERP-5172 AC13). */
  if (role.isProtected) {
    return <LockedRoleCard role={role} isSelected={isSelected} searchQuery={searchQuery} />;
  }

  const permissionCount = ROLE_PERMISSION_MAP[role.id]?.length ?? 0;
  const matched = MAIN_ROLES.find((r) => r.roleName === role.name);
  const detailHref = matched
    ? `/company-settings/user-access-control/role/${matched.id}?tab=permissions`
    : undefined;

  const openDetailInNewTab = () => {
    if (detailHref) window.open(detailHref, "_blank", "noopener,noreferrer");
  };

  const handlePrimaryClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isSelected) {
      // Select first, then promote on the next tick so the parent's
      // assignedRoles state has settled before primaryRole is set.
      onSelect();
      setTimeout(() => onSetPrimary(), 0);
    } else {
      onSetPrimary();
    }
  };

  const handleOpenDetail = (e: React.MouseEvent) => {
    e.stopPropagation();
    openDetailInNewTab();
  };

  return (
    <button
      type="button"
      onClick={onSelect}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="group relative flex flex-col items-start text-left h-full p-2.5 sm:p-3 rounded-lg border transition-all duration-150"
      style={{
        borderColor: isSelected ? "#0A77FF" : isHovered ? "#CBD5E1" : "#E2E8F0",
        backgroundColor: isSelected ? "#F5F9FF" : isHovered ? "#FAFCFF" : "#FFFFFF",
        boxShadow: isSelected
          ? "0 0 0 1px rgba(10,119,255,0.15), 0 1px 3px rgba(10,119,255,0.06)"
          : isHovered
            ? "0 2px 8px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)"
            : "none",
      }}
    >
      {/* Top-right actions row */}
      <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
        {/* Hover actions for selected cards: eye, star, checkmark */}
        {isSelected && isHovered && (
          <>
            <div
              onClick={handleOpenDetail}
              className="w-6 h-6 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-500 hover:bg-white/80 transition-colors cursor-pointer"
              title="Open role detail in new tab"
            >
              <Eye className="w-3.5 h-3.5" />
            </div>
            {!hidePrimary && (
              <div
                onClick={handlePrimaryClick}
                className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                  isPrimary ? "text-[#0A77FF] hover:bg-white/80" : "text-slate-400 hover:text-amber-500 hover:bg-white/80"
                }`}
                title={isPrimary ? "Primary role" : "Set as primary"}
              >
                <Star className={`w-3.5 h-3.5 ${isPrimary ? "fill-[#0A77FF]" : ""}`} />
              </div>
            )}
          </>
        )}

        {/* Hover actions for unselected cards: eye + empty circle */}
        {!isSelected && isHovered && (
          <div
            onClick={handleOpenDetail}
            className="w-6 h-6 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-500 hover:bg-muted transition-colors cursor-pointer"
            title="Open role detail in new tab"
          >
            <Eye className="w-3.5 h-3.5" />
          </div>
        )}

        {/* Primary badge (always visible when primary, no hover) */}
        {!hidePrimary && isPrimary && !isHovered && (
          <span
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px]"
            style={{ fontWeight: 600, backgroundColor: "#EDF4FF", color: "#0A77FF" }}
          >
            <Star className="w-2.5 h-2.5 fill-[#0A77FF]" /> Primary
          </span>
        )}

        {/* Checkmark (always visible when selected) */}
        {isSelected && (
          <div className="w-5 h-5 rounded-full bg-[#0A77FF] flex items-center justify-center">
            <Check className="w-3 h-3 text-white" />
          </div>
        )}

        {/* Empty circle on hover for unselected */}
        {!isSelected && isHovered && (
          <div className="w-5 h-5 rounded-full border-2 border-slate-300 bg-white" />
        )}
      </div>

      {/* Name + system lock icon */}
      <div className="flex items-center gap-1.5 pr-16 min-w-0 w-full">
        {role.isSystem && <SystemRoleLock size={12} />}
        <p className="text-[13px] text-foreground break-words" style={{ fontWeight: isSelected ? 600 : 500 }}>
          {highlightMatch(role.name, searchQuery)}
        </p>
      </div>

      {/* License chip */}
      <div className="flex items-center gap-1 flex-wrap mt-1">
        <LicenseBadge license={role.license} prefix="Requires " />
      </div>

      {/* Description */}
      <p className="text-[11px] text-slate-400 mt-1.5 line-clamp-2 pr-2 break-words w-full">
        {highlightMatch(role.description, searchQuery)}
      </p>

      {/* Footer: permissions count with hover-to-link, pinned to bottom */}
      <div
        onClick={(e) => { e.stopPropagation(); openDetailInNewTab(); }}
        className="group/perm inline-flex items-center gap-1 mt-auto pt-2 text-[11px] transition-colors cursor-pointer w-fit"
        style={{ color: "#94A3B8" }}
      >
        <KeyRound className="w-3 h-3 shrink-0 transition-colors group-hover/perm:text-[#0A77FF]" />
        <span className="tabular-nums group-hover/perm:text-[#0A77FF] group-hover/perm:underline transition-colors">
          {permissionCount} permission{permissionCount !== 1 ? "s" : ""}
        </span>
        <ExternalLink
          className="w-3 h-3 opacity-0 group-hover/perm:opacity-100 transition-opacity"
          style={{ color: "#0A77FF" }}
        />
      </div>
    </button>
  );
}


/* RoleCard's disabled twin for a protected role: same anatomy, no selection,
 * star or hover actions, and a hover that says why. */
function LockedRoleCard({
  role,
  isSelected,
  searchQuery,
}: {
  role: RoleOption;
  isSelected: boolean;
  searchQuery: string;
}) {
  const permissionCount = ROLE_PERMISSION_MAP[role.id]?.length ?? 0;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          role="button"
          aria-disabled="true"
          aria-pressed={isSelected}
          tabIndex={0}
          className="relative flex flex-col items-start text-left h-full p-2.5 sm:p-3 rounded-lg border cursor-not-allowed"
          style={{
            borderColor: isSelected ? "#0A77FF" : "#E2E8F0",
            backgroundColor: isSelected ? "#F5F9FF" : "#F8FAFC",
            opacity: isSelected ? 1 : 0.6,
          }}
        >
          {isSelected && (
            <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#0A77FF] flex items-center justify-center">
              <Check className="w-3 h-3 text-white" />
            </div>
          )}
          <div className="flex items-center gap-1.5 pr-16 min-w-0 w-full">
            {role.isSystem && <SystemRoleLock size={12} />}
            <p className="text-[13px] text-foreground break-words" style={{ fontWeight: isSelected ? 600 : 500 }}>
              {highlightMatch(role.name, searchQuery)}
            </p>
          </div>
          <div className="flex items-center gap-1 flex-wrap mt-1">
            <LicenseBadge license={role.license} prefix="Requires " />
          </div>
          <p className="text-[11px] text-slate-400 mt-1.5 line-clamp-2 pr-2 break-words w-full">
            {highlightMatch(role.description, searchQuery)}
          </p>
          <div className="inline-flex items-center gap-1 mt-auto pt-2 text-[11px] w-fit" style={{ color: "#94A3B8" }}>
            <KeyRound className="w-3 h-3 shrink-0" />
            <span className="tabular-nums">
              {permissionCount} permission{permissionCount !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[260px] text-xs">
        {ACCOUNT_OWNER_COPY.assignRoleCard}
      </TooltipContent>
    </Tooltip>
  );
}

export function Step2RolesPermissions({ formData, errors, onFieldChange, flush = false, initialDirectToggles }: Step2Props) {
  const [subTab, setSubTab] = useState<SubTab>("roles");
  const directPermissions = formData.directPermissions;

  /* Seed each module from the form's own direct-permission map, falling back to
   * the caller's seed (Unarchive) and finally to all-off. Reading through the
   * form rather than the grid's internal state is what makes a selection
   * survive a trip back to the Roles tab, which unmounts the grid. */
  const getDirectToggles = useCallback(
    (moduleId: string): Record<string, boolean> => {
      const seed = initialDirectToggles?.(moduleId) ?? buildEmptyTogglesForModule(moduleId);
      const mod = PERMISSION_MODULES.find((m) => m.id === moduleId);
      const out = { ...seed };
      mod?.permissions.forEach((p) => {
        if (p.id in directPermissions) out[p.id] = directPermissions[p.id];
      });
      return out;
    },
    [initialDirectToggles, directPermissions],
  );

  const handleDirectTogglesChange = useCallback(
    (_moduleId: string, toggles: Record<string, boolean>) => {
      onFieldChange("directPermissions", { ...directPermissions, ...toggles });
    },
    [onFieldChange, directPermissions],
  );

  const toggleRole = (roleId: string) => {
    if (isLockedRoleOption(roleId)) return;
    const current = formData.assignedRoles;
    const isRemoving = current.includes(roleId);
    const next = isRemoving
      ? current.filter((r) => r !== roleId)
      : [...current, roleId];
    onFieldChange("assignedRoles", next);

    // Primary role logic
    if (!isRemoving && next.length === 1) {
      // First selection → auto-primary
      onFieldChange("primaryRole", roleId);
    } else if (isRemoving && formData.primaryRole === roleId) {
      // Removed the primary → shift to first remaining
      onFieldChange("primaryRole", next[0] || "");
    }
  };

  const segmentedTabs = (
    <SegmentedTabs tabs={SUB_TABS} value={subTab} onChange={(k) => setSubTab(k as SubTab)} equalWidth />
  );

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Tab content */}
      {subTab === "roles" ? (
        <RolesSelectionPanel
          selectedRoleIds={formData.assignedRoles}
          primaryRoleId={formData.primaryRole}
          onToggleRole={toggleRole}
          onSetPrimary={(id) => onFieldChange("primaryRole", id)}
          segmentedTabs={segmentedTabs}
          errorText={errors.assignedRoles}
          flush={flush}
        />
      ) : (
        <PermissionsTabContent
          assignedRoles={formData.assignedRoles}
          segmentedTabs={segmentedTabs}
          flush={flush}
          getDirectToggles={getDirectToggles}
          onDirectTogglesChange={handleDirectTogglesChange}
        />
      )}
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════
   RolesSelectionPanel: self-contained role picker (search + quick
   filters + Custom/Predefined card grid). Owns its search/filter UI
   state; selection state is controlled by the parent so it can be
   reused both inside the Create User wizard (Step 2 Roles tab) and the
   standalone "Add roles" modal on the user detail page.
   ═════════════════════════════════════════════════════════════════ */
export function RolesSelectionPanel({
  roles = ASSIGN_STEP_ROLES,
  selectedRoleIds,
  primaryRoleId,
  onToggleRole,
  onSetPrimary,
  /** Optional segmented Roles/Permissions tabs rendered in the toolbar.
   *  Omitted by the Add Roles modal, which only shows roles. */
  segmentedTabs,
  /** Optional validation message rendered under the grid. */
  errorText,
  flush = false,
  /** Optional one-line helper text shown above the card grid. */
  infoText,
  /** Optional one-line note shown UNDER the card grid, for saying that the
   *  list itself is filtered. Distinct from `infoText` (guidance above the
   *  list) and `errorText` (a validation failure). */
  footerNote,
  /** When true, only one quick filter can be active at a time (selecting a
   *  new one replaces the current). Defaults to false (multi-select, OR
   *  within group) to preserve the Create User → Step 2 behavior. */
  singleSelectFilters = false,
  hidePrimary = false,
  hideTypeFilters = false,
}: {
  roles?: RoleOption[];
  selectedRoleIds: string[];
  primaryRoleId: string;
  onToggleRole: (id: string) => void;
  onSetPrimary: (id: string) => void;
  segmentedTabs?: React.ReactNode;
  errorText?: string;
  flush?: boolean;
  infoText?: React.ReactNode;
  footerNote?: React.ReactNode;
  singleSelectFilters?: boolean;
  /** Hide the primary-role star/badge on each card (no primary concept). */
  hidePrimary?: boolean;
  /** Hide the Custom/Predefined (type) filter pills. */
  hideTypeFilters?: boolean;
}) {
  const [roleSearch, setRoleSearch] = useState("");
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());

  const handleFilterToggle = (key: string) => {
    if (key === "all") {
      setActiveFilters(new Set());
      return;
    }
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else if (singleSelectFilters) {
        // Single-select: a new filter replaces any currently active one.
        next.clear();
        next.add(key);
      } else {
        // Within same group, allow multi-select (OR within group)
        next.add(key);
      }
      return next;
    });
  };

  const filteredRoles = useMemo(() => {
    let result = [...roles];
    if (roleSearch.trim()) {
      const q = roleSearch.toLowerCase();
      result = result.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.license.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q)
      );
    }

    // AND between groups, OR within groups
    const typeFilters = new Set<string>();
    const licenseFilters = new Set<string>();
    for (const f of activeFilters) {
      if (f === "custom" || f === "system") typeFilters.add(f);
      if (f === "full" || f === "field") licenseFilters.add(f);
    }

    if (typeFilters.size > 0) {
      result = result.filter((r) => {
        if (typeFilters.has("custom") && !r.isSystem) return true;
        if (typeFilters.has("system") && r.isSystem) return true;
        return false;
      });
    }
    if (licenseFilters.size > 0) {
      result = result.filter((r) => {
        if (licenseFilters.has("full") && r.license === "Full Access") return true;
        if (licenseFilters.has("field") && r.license === "Field User") return true;
        return false;
      });
    }

    result.sort((a, b) => {
      const aSystem = a.isSystem ? 1 : 0;
      const bSystem = b.isSystem ? 1 : 0;
      if (aSystem !== bSystem) return aSystem - bSystem;
      return a.name.localeCompare(b.name);
    });
    return result;
  }, [roles, roleSearch, activeFilters]);

  const filterCounts = useMemo(() => {
    const base = roleSearch.trim()
      ? roles.filter((r) => {
          const q = roleSearch.toLowerCase();
          return (
            r.name.toLowerCase().includes(q) ||
            r.license.toLowerCase().includes(q) ||
            r.description.toLowerCase().includes(q)
          );
        })
      : roles;
    return {
      all: base.length,
      full: base.filter((r) => r.license === "Full Access").length,
      field: base.filter((r) => r.license === "Field User").length,
      custom: base.filter((r) => !r.isSystem).length,
      system: base.filter((r) => r.isSystem === true).length,
    };
  }, [roles, roleSearch]);

  const rolesContent = (
    <RolesTabContent
      roles={roles}
      selectedRoleIds={selectedRoleIds}
      primaryRoleId={primaryRoleId}
      errorText={errorText}
      roleSearch={roleSearch}
      setRoleSearch={setRoleSearch}
      activeFilters={activeFilters}
      onFilterToggle={handleFilterToggle}
      filteredRoles={filteredRoles}
      filterCounts={filterCounts}
      toggleRole={onToggleRole}
      onSetPrimary={onSetPrimary}
      segmentedTabs={segmentedTabs}
      infoText={infoText}
      footerNote={footerNote}
      hidePrimary={hidePrimary}
      hideTypeFilters={hideTypeFilters}
    />
  );

  if (flush) return rolesContent;

  return (
    <div
      className="rounded-xl border border-[#E2E8F0] bg-white overflow-hidden flex flex-col flex-1 min-h-0"
      style={{ boxShadow: "0 1px 3px 0 rgba(15,23,42,0.04)" }}
    >
      {rolesContent}
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════
   Roles Tab Content
   ═════════════════════════════════════════════════════════════════ */

function RolesTabContent({
  roles,
  selectedRoleIds,
  primaryRoleId,
  errorText,
  roleSearch,
  setRoleSearch,
  activeFilters,
  onFilterToggle,
  filteredRoles,
  filterCounts,
  toggleRole,
  onSetPrimary,
  segmentedTabs,
  infoText,
  footerNote,
  hidePrimary = false,
  hideTypeFilters = false,
}: {
  roles: RoleOption[];
  selectedRoleIds: string[];
  primaryRoleId: string;
  errorText?: string;
  roleSearch: string;
  setRoleSearch: (s: string) => void;
  activeFilters: Set<string>;
  onFilterToggle: (key: string) => void;
  filteredRoles: RoleOption[];
  filterCounts: Record<string, number>;
  toggleRole: (id: string) => void;
  onSetPrimary: (id: string) => void;
  segmentedTabs?: React.ReactNode;
  infoText?: React.ReactNode;
  footerNote?: React.ReactNode;
  hidePrimary?: boolean;
  hideTypeFilters?: boolean;
}) {
  const totalRoles = roles.length;
  const filteredCount = filteredRoles.length;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Top row: search + segmented sub-tabs + count, matches DataTableToolbar */}
      <div className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-2 shrink-0">
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          {/* Search */}
          <div className="relative flex-1 max-w-xs">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
              style={{ color: "#CBD5E1" }}
            />
            <Input
              placeholder="Search roles..."
              value={roleSearch}
              onChange={(e) => setRoleSearch(e.target.value)}
              className="pl-9 pr-8 h-9 text-sm bg-white border-border/80 shadow-sm placeholder:text-muted-foreground/50 focus-visible:border-[#0A77FF] focus-visible:ring-[#0A77FF]/20"
            />
            {roleSearch && (
              <button
                onClick={() => setRoleSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Segmented sub-tabs (Roles / Permissions) */}
          {segmentedTabs && <div className="shrink-0">{segmentedTabs}</div>}
        </div>

        {/* Selection chip + count */}
        <div className="flex items-center gap-2 shrink-0 hidden sm:flex">
          {selectedRoleIds.length > 0 && (
            <>
              <span
                className="inline-flex items-center text-[11px] px-2 py-0.5 rounded-full"
                style={{ backgroundColor: "#EDF4FF", color: "#007FFF", fontWeight: 600 }}
              >
                {selectedRoleIds.length} selected
              </span>
              <span className="text-muted-foreground/40">·</span>
            </>
          )}
          <span className="text-sm tabular-nums" style={{ fontWeight: 500 }}>
            {filteredCount !== totalRoles ? (
              <>
                <span className="text-foreground">{filteredCount}</span>
                <span className="text-muted-foreground/60"> of </span>
                <span className="text-muted-foreground">{totalRoles}</span>
                <span className="text-muted-foreground/70"> roles</span>
              </>
            ) : (
              <>
                <span className="text-foreground">{totalRoles}</span>
                <span className="text-muted-foreground/70"> roles</span>
              </>
            )}
          </span>
        </div>
      </div>

      {/* Filter chips */}
      <DataTableFilterPills
        filters={hideTypeFilters ? ROLES_QUICK_FILTERS.filter((f) => f.group !== "type") : ROLES_QUICK_FILTERS}
        activeFilters={activeFilters}
        onFilterToggle={onFilterToggle}
        filterCounts={filterCounts}
        showMeMode={false}
      />

      {/* Divider */}
      <div className="border-t border-border shrink-0" />

      {/* Optional helper text */}
      {infoText && (
        <div className="px-4 pt-3 pb-0 shrink-0 bg-slate-50">
          <p className="text-[12px] text-slate-500" style={{ fontWeight: 450 }}>
            {infoText}
          </p>
        </div>
      )}

      {/* Card grid (Custom roles alpha → Predefined roles alpha) */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 bg-slate-50">
        {filteredRoles.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm text-gray-500" style={{ fontWeight: 450 }}>
              No roles match &ldquo;{roleSearch}&rdquo;
            </p>
            <button
              className="text-[13px] mt-1.5 cursor-pointer hover:underline"
              style={{ fontWeight: 500, color: "#007FFF" }}
              onClick={() => {
                setRoleSearch("");
                onFilterToggle("all");
              }}
            >
              Clear Filters
            </button>
          </div>
        ) : (() => {
          const sortByName = (a: RoleOption, b: RoleOption) =>
            a.name.localeCompare(b.name);
          const handleSelect = (id: string) => toggleRole(id);
          const handleSetPrimary = (id: string) => onSetPrimary(id);

          // Two simple groups: custom roles first, then predefined roles.
          const groups: Array<{ label: string; items: RoleOption[] }> = [
            { label: "Custom Roles", items: filteredRoles.filter((r) => !r.isSystem).sort(sortByName) },
            { label: "Predefined Roles", items: filteredRoles.filter((r) => r.isSystem).sort(sortByName) },
          ];

          return (
            <div className="space-y-5">
              {groups.map(({ label, items: group }) => {
                if (group.length === 0) return null;
                return (
                  <section key={label}>
                    <p
                      className="text-[11px] uppercase tracking-wider mb-2.5"
                      style={{ fontWeight: 600, color: "#94A3B8" }}
                    >
                      {label}
                    </p>
                    <div
                      className="grid gap-2 sm:gap-2.5"
                      style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}
                    >
                      {group.map((role) => (
                        <RoleCard
                          key={role.id}
                          role={role}
                          isSelected={selectedRoleIds.includes(role.id)}
                          isPrimary={primaryRoleId === role.id}
                          searchQuery={roleSearch}
                          onSelect={() => handleSelect(role.id)}
                          onSetPrimary={() => handleSetPrimary(role.id)}
                          hidePrimary={hidePrimary}
                        />
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          );
        })()}
      </div>
      {errorText && (
        <p className="text-[#EF4444] text-xs px-5 py-2">{errorText}</p>
      )}
      {/* Same muted slate as `infoText`, sitting under the grid so it reads as
          a statement about the list rather than guidance before it. */}
      {footerNote && (
        <p className="text-[12px] text-slate-500 px-5 py-2" style={{ fontWeight: 450 }}>
          {footerNote}
        </p>
      )}
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════
   Permissions Tab Content: Reuses PermissionsModuleGrid (Role Detail
   reference layout). Scoped to the in-progress user, so the "Y active"
   chip reflects inherited (from selected roles) + direct toggles.
   ═════════════════════════════════════════════════════════════════ */

function PermissionsTabContent({
  assignedRoles,
  segmentedTabs,
  flush = false,
  getDirectToggles,
  onDirectTogglesChange,
}: {
  assignedRoles: string[];
  segmentedTabs: React.ReactNode;
  flush?: boolean;
  getDirectToggles: (moduleId: string) => Record<string, boolean>;
  onDirectTogglesChange: (moduleId: string, toggles: Record<string, boolean>) => void;
}) {
  const rolePermissions = useMemo(() => getPermissionsForRoles(assignedRoles), [assignedRoles]);
  const inheritedSources = useMemo(() => getPermissionSources(assignedRoles), [assignedRoles]);

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <PermissionsModuleGrid
        modalContext="create-flow"
        modalMode="editable"
        getInitialToggles={getDirectToggles}
        onModuleTogglesChange={onDirectTogglesChange}
        inheritedPermissions={rolePermissions}
        inheritedSources={inheritedSources}
        flush={flush}
        hidePagination={flush}
        hideFilters
        hideDensity
        hideColumnSelector
        leadingToolbarSlot={segmentedTabs}
        cardContainerClassName="bg-slate-50"
      />
    </div>
  );
}