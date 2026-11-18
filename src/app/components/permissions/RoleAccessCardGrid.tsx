import { useMemo, useState } from "react";
import { Search, X, Check, Eye, Crown, Link2, Users as UsersIcon } from "lucide-react";
import { highlightMatch } from "../../lib/highlight-text";
import { LicenseBadge } from "../table-cells";
import { SystemRoleLock } from "../shared/SystemRoleBadge";
import { Input } from "../ui/input";
import { DataTableFilterPills } from "../data-table/DataTableFilterPills";
import type { QuickFilterDef } from "../data-table/types";
import { Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip";
import type { RoleRow } from "../../data/roles-data";

export type RoleAccessLevel = "none" | "manage" | "owner";

/** Inherited (locked) role: cannot be dropped below minLevel. */
export interface RoleAccessLock {
  /** Lowest level the admin can set, inherited access is additive only. */
  minLevel: Exclude<RoleAccessLevel, "none">;
  /** Assigned role the access is inherited from, shown in the lock tooltip. */
  sourceRoleName: string;
}

/* ═════════════════════════════════════════════════════════════════
   RoleAccessCardGrid: card-based role listing with a per-role
   None / Manage / Owner control. Mirrors the create-user RoleCard
   grid (search + quick filters + Custom/Predefined groups) for the
   Manage Roles surfaces that assign an access level per role
   (Add Users to Manage Roles, Pick the Roles a user can manage).
   ═════════════════════════════════════════════════════════════════ */

const FILTERS: QuickFilterDef[] = [
  { key: "all", label: "Show All", showCount: true },
  { key: "custom", label: "Custom", showCount: true, group: "type" },
  { key: "system", label: "Predefined", showCount: true, group: "type" },
  { key: "full", label: "Full Access", showCount: true, group: "license" },
  { key: "field", label: "Field User", showCount: true, group: "license" },
];

function SegmentedAccessControl({
  level,
  onChange,
  manageDisabled = false,
}: {
  level: RoleAccessLevel;
  onChange: (l: RoleAccessLevel) => void;
  /** Owner is inherited, so it cannot be lowered back to Manage. */
  manageDisabled?: boolean;
}) {
  const segBase =
    "h-[26px] px-2 text-[11.5px] flex items-center justify-center gap-1 cursor-pointer transition-colors flex-1";
  return (
    <div
      role="group"
      aria-label="Access level"
      className="flex w-full rounded-[8px] border border-[#E2E8F0] overflow-hidden bg-white"
      onClick={(e) => e.stopPropagation()}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => { if (!manageDisabled) onChange("manage"); }}
            aria-disabled={manageDisabled}
            className={`${segBase} ${
              level === "manage"
                ? "text-white"
                : manageDisabled
                  ? "text-[#94A3B8] cursor-not-allowed"
                  : "text-[#64748B] hover:bg-[#F8FAFC]"
            }`}
            style={{ fontWeight: 600, backgroundColor: level === "manage" ? "#0E69E2" : undefined }}
          >
            <UsersIcon className="w-3 h-3" style={{ color: level === "manage" ? "#FFFFFF" : "#94A3B8" }} />
            Manage
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" style={{ zIndex: 100 }} className="max-w-[260px] text-[11.5px] leading-[1.5]">
          Can add and remove users from this role. Does not include approving or denying permission requests.
        </TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => onChange("owner")}
            className={`${segBase} border-l border-[#E2E8F0] ${
              level === "owner" ? "text-white" : "text-[#64748B] hover:bg-[#F8FAFC]"
            }`}
            style={{ fontWeight: 600, backgroundColor: level === "owner" ? "#F59E0B" : undefined }}
          >
            <Crown className="w-3 h-3" style={{ color: level === "owner" ? "#FFFFFF" : "#94A3B8" }} />
            Owner
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" style={{ zIndex: 100 }} className="max-w-[260px] text-[11.5px] leading-[1.5]">
          Everything Manage can do, plus approving or denying permission requests for this role. Does not require holding the role.
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

function AccessRoleCard({
  role,
  level,
  onLevelChange,
  noneDisabled,
  searchQuery,
  lock,
}: {
  role: RoleRow;
  level: RoleAccessLevel;
  onLevelChange: (l: RoleAccessLevel) => void;
  noneDisabled: boolean;
  searchQuery: string;
  lock?: RoleAccessLock | null;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const isSelected = level !== "none";

  const openDetailInNewTab = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(
      `/company-settings/user-access-control/role/${role.id}?tab=permissions`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  /* Card click selects (defaults to Manage); clicking again deselects,
     unless deselection is locked (scope = All roles). */
  const handleCardClick = () => {
    if (!isSelected) onLevelChange("manage");
    else if (!noneDisabled && !lock) onLevelChange("none");
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleCardClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleCardClick(); } }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="group relative flex flex-col items-start text-left h-full p-2.5 sm:p-3 rounded-lg border transition-all duration-150 cursor-pointer"
      style={{
        borderColor: isSelected ? "#93C5FD" : isHovered ? "#CBD5E1" : "#E2E8F0",
        backgroundColor: isHovered && !isSelected ? "#FAFCFF" : "#FFFFFF",
        boxShadow: isSelected
          ? "0 0 0 1px rgba(147,197,253,0.35), 0 1px 3px rgba(10,119,255,0.06)"
          : isHovered
            ? "0 2px 8px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)"
            : "none",
      }}
    >
      {/* Top-right actions: hover eye + selected tick */}
      <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
        {isHovered && (
          <div
            onClick={openDetailInNewTab}
            className="w-6 h-6 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-500 hover:bg-muted transition-colors cursor-pointer"
            title="Open role detail in new tab"
          >
            <Eye className="w-3.5 h-3.5" />
          </div>
        )}
        {isSelected ? (
          lock ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center cursor-help"
                  style={{ backgroundColor: "#DBEAFE" }}
                  onClick={(e) => e.stopPropagation()}
                  aria-label="Inherited access"
                >
                  <Link2 className="w-3 h-3" style={{ color: "#007FFF" }} />
                </div>

              </TooltipTrigger>
              <TooltipContent side="top" style={{ zIndex: 100 }} className="max-w-[260px] text-[11.5px] leading-[1.5]">
                Inherited from {lock.sourceRoleName}. Remove that role to change this.
              </TooltipContent>
            </Tooltip>
          ) : (
            <div className="w-5 h-5 rounded-full bg-[#0A77FF] flex items-center justify-center">
              <Check className="w-3 h-3 text-white" />
            </div>
          )
        ) : (
          isHovered && <div className="w-5 h-5 rounded-full border-2 border-slate-300 bg-white" />
        )}

      </div>

      {/* Name + system lock icon */}
      <div className="flex items-center gap-1.5 pr-16 min-w-0 w-full">
        {role.isSystem && <SystemRoleLock size={12} />}
        <p className="text-[13px] text-foreground break-words" style={{ fontWeight: isSelected ? 600 : 500 }}>
          {highlightMatch(role.roleName, searchQuery)}
        </p>
      </div>

      {/* License chip */}
      <div className="flex items-center gap-1 flex-wrap mt-1">
        <LicenseBadge license={role.licenseRequired} prefix="Requires " />
      </div>

      {/* Description */}
      <p className="text-[11px] text-slate-400 mt-1.5 line-clamp-2 pr-2 break-words w-full">
        {highlightMatch(role.description, searchQuery)}
      </p>

      {/* Access level control */}
      <div className="w-full mt-auto pt-2.5">
        <SegmentedAccessControl
          level={level}
          onChange={onLevelChange}
          manageDisabled={lock?.minLevel === "owner"}
        />
      </div>
    </div>
  );
}

export function RoleAccessCardGrid({
  roles,
  getLevel,
  onLevelChange,
  noneDisabled = false,
  rightLabel,
  headerRight,
  getLock,
}: {
  roles: RoleRow[];
  getLevel: (roleId: number) => RoleAccessLevel;
  onLevelChange: (roleId: number, level: RoleAccessLevel) => void;
  /** Lock deselection (e.g. when scope is "All roles" every card stays at least Manage). */
  noneDisabled?: boolean;
  /** Right-aligned toolbar text, e.g. "3 of 28 configured". */
  rightLabel?: string;
  /** Right-aligned toolbar node, e.g. a "Mark All As" dropdown. */
  headerRight?: React.ReactNode;
  /** Inherited access for a role, locks the card against removal. */
  getLock?: (roleId: number) => RoleAccessLock | null;
}) {
  const [search, setSearch] = useState("");
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());

  const handleFilterToggle = (key: string) => {
    if (key === "all") {
      setActiveFilters(new Set());
      return;
    }
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const searchedRoles = useMemo(() => {
    if (!search.trim()) return roles;
    const q = search.toLowerCase();
    return roles.filter(
      (r) =>
        r.roleName.toLowerCase().includes(q) ||
        r.licenseRequired.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q),
    );
  }, [roles, search]);

  const filteredRoles = useMemo(() => {
    let result = searchedRoles;
    const typeFilters = new Set([...activeFilters].filter((f) => f === "custom" || f === "system"));
    const licenseFilters = new Set([...activeFilters].filter((f) => f === "full" || f === "field"));
    if (typeFilters.size > 0) {
      result = result.filter(
        (r) => (typeFilters.has("custom") && !r.isSystem) || (typeFilters.has("system") && r.isSystem),
      );
    }
    if (licenseFilters.size > 0) {
      result = result.filter(
        (r) =>
          (licenseFilters.has("full") && r.licenseRequired === "Full Access") ||
          (licenseFilters.has("field") && r.licenseRequired === "Field User"),
      );
    }
    return result;
  }, [searchedRoles, activeFilters]);

  const filterCounts = useMemo(
    () => ({
      all: searchedRoles.length,
      custom: searchedRoles.filter((r) => !r.isSystem).length,
      system: searchedRoles.filter((r) => r.isSystem === true).length,
      full: searchedRoles.filter((r) => r.licenseRequired === "Full Access").length,
      field: searchedRoles.filter((r) => r.licenseRequired === "Field User").length,
    }),
    [searchedRoles],
  );

  const sortByName = (a: RoleRow, b: RoleRow) => a.roleName.localeCompare(b.roleName);
  const groups: Array<{ label: string; items: RoleRow[] }> = [
    { label: "Custom Roles", items: filteredRoles.filter((r) => !r.isSystem).sort(sortByName) },
    { label: "Predefined Roles", items: filteredRoles.filter((r) => r.isSystem).sort(sortByName) },
  ];

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Top row: search + right label / action */}
      <div className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-2 shrink-0">
        <div className="relative flex-1 max-w-xs">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
            style={{ color: "#CBD5E1" }}
          />
          <Input
            placeholder="Search roles..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-8 h-9 text-sm bg-white border-border/80 shadow-sm placeholder:text-muted-foreground/50 focus-visible:border-[#0A77FF] focus-visible:ring-[#0A77FF]/20"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          {rightLabel && (
            <span className="text-[12px] text-gray-500" style={{ fontWeight: 500 }}>
              {rightLabel}
            </span>
          )}
          {headerRight}
        </div>
      </div>

      {/* Filter chips */}
      <DataTableFilterPills
        filters={FILTERS}
        activeFilters={activeFilters}
        onFilterToggle={handleFilterToggle}
        filterCounts={filterCounts}
        showMeMode={false}
      />

      {/* Divider */}
      <div className="border-t border-border shrink-0" />

      {/* Card grid (Custom roles alpha, then Predefined roles alpha) */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 bg-slate-50">
        {filteredRoles.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm text-gray-500" style={{ fontWeight: 450 }}>
              No Roles Match Your Filters.
            </p>
            <button
              className="text-[13px] mt-1.5 cursor-pointer hover:underline"
              style={{ fontWeight: 500, color: "#007FFF" }}
              onClick={() => {
                setSearch("");
                setActiveFilters(new Set());
              }}
            >
              Clear Filters
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            {groups.map(({ label, items }) => {
              if (items.length === 0) return null;
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
                    style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}
                  >
                    {items.map((role) => (
                      <AccessRoleCard
                        key={role.id}
                        role={role}
                        level={getLevel(role.id)}
                        onLevelChange={(l) => onLevelChange(role.id, l)}
                        noneDisabled={noneDisabled}
                        searchQuery={search}
                        lock={getLock?.(role.id) ?? null}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
