import { useState, useMemo, useCallback } from "react";
import { ACCOUNT_OWNER_COPY } from "../../data/account-owner";
import { useNavigate } from "react-router-dom";
import {
  Shield,
  Users,
  Calendar,
  Settings,
  ChevronDown,
  ChevronRight,
  Eye,
  Activity,
  ArrowRight,
  CheckCircle2,
  Lock,
  UserPlus,
  UserMinus,
  SlidersHorizontal,
  Info,
  Copy,
  KeyRound,
  AlertTriangle,
} from "lucide-react";
import type { RoleDetail } from "../../data/role-detail-data";
import { getAssignedUsers } from "../../data/role-detail-data";
import { PERMISSION_MODULES, type PermissionModule } from "../../data/permissions-data";
import { PermissionDetailModal } from "../permissions/PermissionDetailModal";
import { DetailCard } from "../user-detail/DetailCard";
import { getAvatarTint, getInitials } from "../../lib/avatar";

import { getRoleThresholds } from "../../data/role-thresholds-data";
import { ThresholdManagementModal } from "./ThresholdManagementModal";
import { SHOW_PERMISSION_THRESHOLDS } from "../../lib/feature-flags";
import type { RoleThresholdItem } from "./ThresholdManagementModal";
import { toast } from "sonner";
import { PerformanceInsights } from "../shared/PerformanceInsights";
import { ExpandableDescription } from "../shared/ExpandableDescription";
import {
  ROLE_DETAIL_CATEGORIES,
  getRoleDetailInsights,
  ROLE_DETAIL_DEFAULT_VISIBLE,
} from "../../data/role-detail-insights-data";
import { useAccessMode, useRoleInScope } from "../access-mode";

interface Props {
  role: RoleDetail;
  onNavigateToTab?: (tab: string) => void;
}

/* ── Field Pair: label above value, no icon (matches user detail 2-col grid cell) ── */
function FieldPair({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p
        className="mb-1 truncate"
        style={{ fontSize: "12px", fontWeight: 450, color: "#94A3B8", lineHeight: "1.3" }}
      >
        {label}
      </p>
      <p
        className="text-[13px] truncate"
        style={{ fontWeight: 500, color: "#1E293B" }}
      >
        {value || "-"}
      </p>
    </div>
  );
}

/* ── Collapsible Accordion Card (matches user detail OverviewTab) ── */
function AccordionCard({
  title,
  icon: Icon,
  iconBg,
  iconColor,
  defaultOpen = true,
  children,
}: {
  title: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      className="rounded-xl border border-[#E2E8F0] bg-white overflow-hidden transition-all"
      style={{ boxShadow: "0 1px 3px 0 rgba(15,23,42,0.04)" }}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-[#FAFBFC] transition-colors cursor-pointer"
      >
        <div
          className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
          style={{ backgroundColor: iconBg }}
        >
          <Icon className="w-3.5 h-3.5" style={{ color: iconColor }} />
        </div>
        <span
          className="text-[13.5px] flex-1 text-left"
          style={{ fontWeight: 600, color: "#0F172A" }}
        >
          {title}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-[#94A3B8] transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-[#F1F5F9]">
          {children}
        </div>
      )}
    </div>
  );
}

/* ── Pair items into rows of 2 for compact display ── */
function pairItems<T>(items: T[]): T[][] {
  const pairs: T[][] = [];
  for (let i = 0; i < items.length; i += 2) {
    pairs.push(items.slice(i, i + 2));
  }
  return pairs;
}

/* ── Activity Summary Type Config ── */
const ACTIVITY_TYPE_CONFIG: Record<string, { icon: typeof Shield; bg: string; color: string; label: string }> = {
  role_created: { icon: CheckCircle2, bg: "#ECFDF5", color: "#059669", label: "Created" },
  role_duplicated: { icon: Copy, bg: "#EEF2FF", color: "#4F46E5", label: "Duplicated" },
  user_assigned: { icon: UserPlus, bg: "#EFF6FF", color: "#2563EB", label: "User Assigned" },
  user_removed: { icon: UserMinus, bg: "#FEF2F2", color: "#DC2626", label: "User Removed" },
  permission_change: { icon: Lock, bg: "#EDE9FE", color: "#7C3AED", label: "Permission" },
  config_change: { icon: Settings, bg: "#FFF7ED", color: "#D97706", label: "Config" },
  status_change: { icon: Activity, bg: "#F0F9FF", color: "#0284C7", label: "Status" },
};

export function RoleOverviewTab({
  role,
  onNavigateToTab,
}: Props) {
  const navigate = useNavigate();
  const access = useAccessMode();

  const allAssignedUsers = useMemo(
    () => getAssignedUsers(role.assignedUserIds),
    [role.assignedUserIds]
  );
  const totalUsers = role.assignedUserIds.length;

  const recentActivity = role.activityLog.slice(0, 5);

  /* ── Role Insights ── */
  const roleId = parseInt(role.id?.toString() ?? "0", 10);
  const insights = useMemo(
    () => getRoleDetailInsights(roleId, role.assignedUserIds.length, role.permissionGroups),
    [roleId, role.assignedUserIds.length, role.permissionGroups]
  );

  /* ── Quick-edit permissions modal (opened from a Permissions Summary card).
   *  Predefined roles open it read-only; custom roles open it editable with
   *  on/off toggles. Per-module edits are kept as local overrides so the
   *  summary chips update live, mirroring the Role Permissions tab's grid. ── */
  const [openModule, setOpenModule] = useState<PermissionModule | null>(null);
  const [moduleToggleOverrides, setModuleToggleOverrides] = useState<
    Record<string, Record<string, boolean>>
  >({});

  /** Custom roles are editable; predefined (system) roles are locked. This is
   *  an ENTITY fact about the role, NOT a statement about the viewer — renamed
   *  from `canEditPermissions` so it can't be mistaken for the access
   *  capability it is now combined with. */
  const roleIsEditable = !role.isSystem;

  /** Is this role in the persona's Manage Roles scope? A third, independent
   *  half: not a capability and not an entity fact, but a fact about the
   *  (viewer, role) pair. */
  const inScope = useRoleInScope(roleId);

  /** The real gate: the persona may author permissions, this role accepts
   *  edits, AND it is in the persona's scope. No half alone is sufficient.
   *  Drives the Permissions Summary quick-edit modal and the Draft nudge, both
   *  of which write the permission set — the scoped grant. */
  const mayEditPermissions = access.canManagePermissions && roleIsEditable && inScope;

  /** Granted permission ids for a module: an edited override when present,
   *  otherwise the role's derived baseline. */
  const getModuleToggles = useCallback(
    (moduleName: string): Record<string, boolean> => {
      const override = moduleToggleOverrides[moduleName];
      if (override) return override;
      const group = role.permissionGroups.find((g) => g.module === moduleName);
      const toggles: Record<string, boolean> = {};
      group?.permissions.forEach((p) => { toggles[p.key] = p.granted; });
      return toggles;
    },
    [moduleToggleOverrides, role.permissionGroups],
  );

  /** Toggle map for the currently open module. */
  const openModuleToggles = useMemo<Record<string, boolean>>(
    () => (openModule ? getModuleToggles(openModule.name) : {}),
    [openModule, getModuleToggles],
  );

  const openModuleByName = (moduleName: string) => {
    const mod = PERMISSION_MODULES.find((m) => m.name === moduleName);
    if (mod) setOpenModule(mod);
  };

  /* Linked-permission cascades landing outside the open module
   * (data/linked-permissions.ts): merge each update into its home module's
   * override so the summary chips move with the linked group. Keyed by module
   * name, matching the overrides map above. */
  const applyLinkedToggles = useCallback(
    (updates: Record<string, boolean>) => {
      const byModuleName: Record<string, Record<string, boolean>> = {};
      Object.entries(updates).forEach(([permissionId, val]) => {
        const mod = PERMISSION_MODULES.find((m) =>
          m.permissions.some((p) => p.id === permissionId)
        );
        if (!mod) return;
        (byModuleName[mod.name] ??= {})[permissionId] = val;
      });
      if (Object.keys(byModuleName).length === 0) return;
      const merged: Record<string, Record<string, boolean>> = {};
      Object.entries(byModuleName).forEach(([moduleName, changes]) => {
        merged[moduleName] = { ...getModuleToggles(moduleName), ...changes };
      });
      setModuleToggleOverrides((prev) => ({ ...prev, ...merged }));
    },
    [getModuleToggles]
  );

  /* ── Threshold data: scan PERMISSION_MODULES for thresholds relevant to this role ── */
  const [thresholdModalOpen, setThresholdModalOpen] = useState(false);

  const roleThresholds = useMemo((): RoleThresholdItem[] => {
    const rid = parseInt(role.id?.toString() ?? "0", 10);
    return getRoleThresholds(rid).map((t) => ({
      permissionId: t.permissionId,
      permissionName: t.permissionName,
      moduleName: t.moduleName,
      thresholdConfig: t.thresholdConfig,
      currentValue: t.currentValue,
    }));
  }, [role]);

  return (
    <div className="space-y-5">
      {/* Draft nudge: full-width amber banner shown while the role has no
          permissions. Mirrors the user-detail "not invited yet" banner styling
          (whole banner clickable + filled CTA), in an amber state. The CTA and
          the banner both jump to the Permissions tab. */}
      {role.status === "Draft" && mayEditPermissions && (
        <div
          role="button"
          tabIndex={0}
          aria-label="Set Up Permissions"
          onClick={() => onNavigateToTab?.("permissions")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onNavigateToTab?.("permissions");
            }
          }}
          className="flex items-center gap-3 rounded-[10px] border border-[#FDE68A] bg-[#FFFBEB] hover:bg-[#FEF3C7] px-4 py-3.5 cursor-pointer transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#D97706]/30"
        >
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: "#FDE68A" }}
          >
            <AlertTriangle className="w-4 h-4" style={{ color: "#B45309" }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px]" style={{ fontWeight: 600, color: "#92400E" }}>
              This role is in Draft because it has no permissions
            </p>
            <p className="text-[12px] mt-0.5" style={{ fontWeight: 400, color: "#B45309" }}>
              Assign permissions to activate it and make it usable.
            </p>
          </div>
          <button
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            onClick={(e) => {
              e.stopPropagation();
              onNavigateToTab?.("permissions");
            }}
            className="inline-flex items-center gap-1.5 px-4 h-9 rounded-[8px] text-[13px] text-white shrink-0 transition-colors cursor-pointer"
            style={{ fontWeight: 600, backgroundColor: "#D97706" }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#B45309")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#D97706")}
          >
            <KeyRound className="w-3.5 h-3.5" />
            Set up permissions
          </button>
        </div>
      )}

      {/* ── KPI Insights Strip ── */}
      <PerformanceInsights
        metrics={insights}
        categories={ROLE_DETAIL_CATEGORIES}
        defaultVisibleIds={ROLE_DETAIL_DEFAULT_VISIBLE}
      />

      {/* ── Two Column Layout ── */}
      <div className="flex gap-5 items-start">
        {/* ── LEFT COLUMN: Detailed Cards ── */}
        <div className="flex-1 min-w-0 space-y-5">
          {/* ── Out-of-scope notice ──
              Sits in the left column so it is the same width as the cards it
              introduces, rather than spanning both columns and reading as a
              page-level alarm. Container and icon tile are the DetailCard
              header's own metrics (rounded-xl / #E2E8F0 / same shadow; 7x7
              rounded-md tile, 3.5 icon, 13.5px 600 title) so it lands as
              another card in the stack. The tile is slate rather than the
              cards' brand blue: this is a statement about what you can't do,
              not a section you can open.

              Archived wins outright: that state already announces itself
              through the header's red wash and Unarchive CTA, and it is the
              more restrictive of the two. */}
          {!inScope && role.status !== "Archived" && (
            <div
              className="rounded-xl border bg-white flex items-start gap-2.5 px-5 py-3.5"
              style={{
                borderColor: "#E2E8F0",
                boxShadow: "0 1px 3px 0 rgba(15,23,42,0.04), 0 1px 2px -1px rgba(15,23,42,0.04)",
              }}
              role="status"
            >
              <div
                className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                style={{ backgroundColor: "#F1F5F9" }}
              >
                <Eye className="w-3.5 h-3.5" style={{ color: "#64748B" }} aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="text-[13.5px]" style={{ fontWeight: 600, color: "#0F172A" }}>
                  You can view this role but not manage its access
                </p>
                <p className="text-[12px] mt-0.5" style={{ fontWeight: 400, color: "#64748B" }}>
                  This role isn&rsquo;t in your Manage Roles scope, so you can&rsquo;t assign
                  users, change permissions, or set owners on it. Contact an administrator if
                  you need access.
                </p>
              </div>
            </div>
          )}

          {/* Role Details */}
          <DetailCard title="Role Details" icon={Shield}>
            <div className="grid grid-cols-2 gap-x-8 gap-y-5 py-4">
              <FieldPair label="Role Name" value={role.roleName} />

              <FieldPair label="Required License" value={role.licenseRequired} />
              <FieldPair label="Role Type" value={role.isSystem ? "Predefined Role" : "Custom Role"} />
              <div className="col-span-2">
                <p
                  className="mb-1"
                  style={{ fontSize: "12px", fontWeight: 450, color: "#94A3B8", lineHeight: "1.3" }}
                >
                  Description
                </p>
                {role.description ? (
                  <ExpandableDescription
                    text={role.description}
                    lines={2}
                    className="text-[13px]"
                    style={{ fontWeight: 500, color: "#1E293B", lineHeight: "1.55" }}
                  />
                ) : (
                  <p
                    className="text-[13px]"
                    style={{ fontWeight: 500, color: "#1E293B", lineHeight: "1.55" }}
                  >
                    -
                  </p>
                )}
              </div>

              {/* System role info banner */}
              {role.isSystem && (
                <div
                  className="col-span-2 flex items-start gap-3 rounded-[8px] px-3.5 py-2.5 border"
                  style={{ backgroundColor: "#F8FAFC", borderColor: "#E2E8F0" }}
                >
                  <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "#64748B" }} />
                  <p className="text-[11.5px]" style={{ fontWeight: 450, color: "#64748B", lineHeight: "1.45" }}>
                    Predefined role. This role cannot be edited, deactivated, or archived. You can still assign or remove users, or copy it to create a custom role.
                  </p>
                </div>
              )}

              {/* Protected role banner (Account Owner only) */}
              {role.isProtected && (
                <div
                  className="col-span-2 flex items-start gap-3 rounded-[8px] px-3.5 py-2.5 border"
                  style={{ backgroundColor: "#FFFBEB", borderColor: "#FDE68A" }}
                >
                  <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "#B45309" }} />
                  <p className="text-[11.5px]" style={{ fontWeight: 450, color: "#92400E", lineHeight: "1.45" }}>
                    Protected role. {ACCOUNT_OWNER_COPY.summaryProtection.join(" ")}
                  </p>
                </div>
              )}
            </div>
          </DetailCard>


          {/* Permissions Summary: no progress bar, chip says "N out of N active" */}
          <DetailCard title="Permissions Summary" icon={Lock}>
            <div className="py-3">
              {role.permissionGroups.length > 0 ? (
                <>
                  {/* Module breakdown: paired like skills */}
                  {pairItems(role.permissionGroups).map((pair, rowIdx) => (
                  <div
                    key={rowIdx}
                    className="grid grid-cols-2 gap-2 mb-2 last:mb-0"
                  >
                      {pair.map((group) => {
                        const groupToggles = getModuleToggles(group.module);
                        const granted = group.permissions.filter((p) => groupToggles[p.key]).length;
                        const total = group.permissions.length;
                        return (
                          <button
                            key={group.module}
                            type="button"
                            onClick={() => openModuleByName(group.module)}
                            className="group flex items-center justify-between gap-2 px-3 py-2.5 rounded-[8px] bg-[#F8FAFC] border border-[#E2E8F0] shadow-sm text-left w-full cursor-pointer transition-all duration-150 hover:bg-white hover:border-[#007FFF] hover:shadow-none"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className="text-[13px] truncate"
                                style={{ fontWeight: 500, color: "#1E293B" }}
                              >
                                {group.module}
                              </span>
                              <span
                                className="text-[10px] px-1.5 py-0.5 rounded-full shrink-0 whitespace-nowrap border"
                                style={{
                                  backgroundColor: "#ECFDF5",
                                  color: "#059669",
                                  borderColor: "#A7F3D0",
                                  fontWeight: 600,
                                }}
                              >
                                {granted} out of {total} active
                              </span>
                            </div>
                            <span className="flex items-center gap-1 shrink-0">
                              <span
                                className="text-[11px] opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap"
                                style={{ fontWeight: 500, color: "#007FFF" }}
                              >
                                {mayEditPermissions ? "Edit Permissions" : "View Permissions"}
                              </span>
                              <ChevronRight className="w-4 h-4 text-[#94A3B8] group-hover:text-[#007FFF] transition-colors" />
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </>
              ) : mayEditPermissions ? (
                <div className="flex flex-col items-start gap-2.5 py-2">
                  {/* The amber draft banner above Performance Insights carries the
                      "Set up permissions" action, so the card just states the
                      status here. */}
                  <p className="text-[13px]" style={{ color: "#64748B" }}>
                    This role has no permissions yet, so it can't be used. Set them up to activate it.
                  </p>
                </div>
              ) : (
                <p className="text-xs py-2" style={{ color: "#94A3B8" }}>
                  No Permissions Configured Yet
                </p>
              )}
            </div>
          </DetailCard>

          {/* Metadata: predefined (system) roles are shipped and maintained by
              the system, so they don't carry a tenant-side "Created On" or a
              "Last Modified By" person; the modified date is shown as
              system-managed. Custom roles show the full set. */}
          <DetailCard title="Metadata" icon={Calendar}>
            <div className="grid grid-cols-2 gap-x-8 gap-y-5 py-4">
              {role.isSystem ? (
                <>
                  <FieldPair label="Created By" value={role.createdBy} />
                  <FieldPair label="Last Modified By System" value={role.lastModifiedOn} />
                </>
              ) : (
                <>
                  <FieldPair label="Created By" value={role.createdBy} />
                  <FieldPair label="Created On" value={role.createdOn} />
                  <FieldPair label="Last Modified By" value={role.lastModifiedBy} />
                  <FieldPair label="Last Modified On" value={role.lastModifiedOn} />
                </>
              )}
            </div>
          </DetailCard>
        </div>

        {/* ── RIGHT COLUMN: Accordion Cards ── */}
        <div className="w-[340px] xl:w-[380px] shrink-0 space-y-4 hidden lg:block">
          {/* Assigned Users Card: stacked circular avatars */}
          <AccordionCard
            title="Assigned Users"
            icon={Users}
            iconBg="#EDF4FF"
            iconColor="#007FFF"
          >
            <div className="pt-3">
              {totalUsers > 0 ? (
                <>
                  {/* Stacked circular avatars */}
                  <div className="flex items-center mb-3">
                    <div className="flex items-center -space-x-2.5">
                      {allAssignedUsers.slice(0, 8).map((user) => {
                        const tint = getAvatarTint(user.fullName);
                        const initials = getInitials(user.fullName);
                        return (
                          <a
                            key={user.id}
                            href={`/company-settings/user-access-control/user/${user.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="w-9 h-9 rounded-full flex items-center justify-center text-[10px] border-2 border-white shrink-0 cursor-pointer hover:z-10 hover:scale-110 transition-transform no-underline"
                            style={{
                              backgroundColor: tint.bg,
                              color: tint.fg,
                              fontWeight: 700,
                            }}
                            title={user.fullName}
                          >
                            {initials}
                          </a>
                        );
                      })}
                      {totalUsers > 8 && (
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center text-[10px] border-2 border-white shrink-0"
                          style={{
                            backgroundColor: "#F1F5F9",
                            color: "#64748B",
                            fontWeight: 700,
                          }}
                        >
                          +{totalUsers - 8}
                        </div>
                      )}
                    </div>
                  </div>
                  <p
                    className="text-[12px] mb-3"
                    style={{ color: "#64748B", fontWeight: 450 }}
                  >
                    {totalUsers} user{totalUsers !== 1 ? "s" : ""} assigned to this role
                  </p>
                </>
              ) : (
                /* Empty: same floating icon tile as the table empty states, so
                   a role with no members reads the same wherever you meet it. */
                <div className="flex flex-col items-center text-center py-3">
                  <div className="relative w-12 h-12 mb-2.5">
                    <div
                      className="absolute inset-0 rounded-2xl animate-ping"
                      style={{ backgroundColor: "rgba(10,119,255,0.05)", animationDuration: "3s" }}
                    />
                    <div
                      className="relative w-12 h-12 rounded-2xl border border-[#E2E8F0] flex items-center justify-center shadow-sm"
                      style={{
                        backgroundImage: "linear-gradient(to bottom right, #F8FAFC, #EBF4FF)",
                        animation: "csFloat 4s ease-in-out infinite",
                      }}
                    >
                      <Users className="w-5 h-5 text-slate-400" />
                    </div>
                  </div>
                  <p className="text-[12.5px]" style={{ color: "#0F172A", fontWeight: 600 }}>
                    No Users Assigned to This Role
                  </p>
                  <p className="text-[11.5px] mt-0.5" style={{ color: "#94A3B8", fontWeight: 400 }}>
                    Assign users to put this role to work.
                  </p>
                </div>
              )}

              {/* Membership CTA — role membership is an access grant. Both
                  variants land on the Users tab, which owns the assign flow;
                  the label just tells the truth about what is there. */}
              {access.canAssignRoles && (
              <button
                type="button"
                onClick={() => onNavigateToTab?.("users")}
                className="w-full flex items-center justify-center gap-1.5 py-2 mt-1 rounded-[8px] bg-white hover:bg-[#F0F7FF] transition-colors cursor-pointer"
                style={{
                  border: "1px solid #007FFF",
                  boxShadow: "0 1px 2px 0 rgba(10,119,255,0.08)",
                }}
              >
                <span className="text-[12px]" style={{ fontWeight: 520, color: "#007FFF" }}>
                  {totalUsers > 0 ? "Manage Users" : "Add Users"}
                </span>
                <ArrowRight className="w-3 h-3" style={{ color: "#007FFF" }} />
              </button>
              )}
            </div>
          </AccordionCard>

          {/* Threshold Overview Card: above Activity Summary.
              Hidden behind SHOW_PERMISSION_THRESHOLDS, see lib/feature-flags.ts. */}
          {SHOW_PERMISSION_THRESHOLDS && (
          <AccordionCard
            title="Threshold Overview"
            icon={SlidersHorizontal}
            iconBg="#F0F7FF"
            iconColor="#007FFF"
          >
            <div className="pt-3 space-y-2.5">
              {roleThresholds.length > 0 ? (
                <>
                  <p
                    className="text-[11.5px] text-[#94A3B8] pb-0.5"
                    style={{ fontWeight: 420, lineHeight: 1.4 }}
                  >
                    {roleThresholds.length} threshold{roleThresholds.length !== 1 ? "s" : ""} configured for this role
                  </p>
                  {roleThresholds.map((threshold) => {
                    const cfg = threshold.thresholdConfig;
                    const isDescriptive = cfg.type === "descriptive";
                    let displayValue = "No limit";
                    if (threshold.currentValue && !isDescriptive) {
                      const num = Number(threshold.currentValue.replace(/,/g, ""));
                      const formatted = isNaN(num) ? threshold.currentValue : num.toLocaleString("en-US");
                      displayValue = cfg.unitPosition === "prefix"
                        ? `${cfg.unit}${formatted}`
                        : `${formatted}${cfg.unit}`;
                    } else if (isDescriptive) {
                      displayValue = "Hierarchy-based";
                    }
                    return (
                      <div
                        key={threshold.permissionId}
                        className="px-3 py-2.5 rounded-[8px] bg-[#F8FAFC] border border-[#F1F5F9]"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span
                            className="text-[12.5px] truncate"
                            style={{ fontWeight: 520, color: "#1E293B" }}
                          >
                            {cfg.label}
                          </span>
                          <span
                            className="text-[12px] px-2 py-0.5 rounded-md shrink-0 ml-2"
                            style={{
                              backgroundColor: threshold.currentValue ? "#ECFDF5" : "#FFF7ED",
                              color: threshold.currentValue ? "#059669" : "#D97706",
                              fontWeight: 550,
                              border: `1px solid ${threshold.currentValue ? "#A7F3D0" : "#FDE68A"}`,
                            }}
                          >
                            {displayValue}
                          </span>
                        </div>
                        <span
                          className="text-[10.5px]"
                          style={{ fontWeight: 420, color: "#94A3B8" }}
                        >
                          {threshold.permissionName}
                        </span>
                      </div>
                    );
                  })}
                </>
              ) : (
                <div className="py-4 text-center">
                  <SlidersHorizontal className="w-6 h-6 mx-auto mb-2" style={{ color: "#CBD5E1" }} />
                  <p
                    className="text-[12px] text-[#94A3B8]"
                    style={{ fontWeight: 450 }}
                  >
                    No Thresholds Configured
                  </p>
                </div>
              )}

              {/* Manage Thresholds CTA: only when this role actually has
                  thresholds to manage; hidden on the empty state. */}
              {roleThresholds.length > 0 && access.canManagePermissions && inScope && (
                <button
                  type="button"
                  onClick={() => setThresholdModalOpen(true)}
                  className="w-full flex items-center justify-center gap-1.5 py-2 mt-1 rounded-[8px] bg-white hover:bg-[#F0F7FF] transition-colors cursor-pointer"
                  style={{
                    border: "1px solid #007FFF",
                    boxShadow: "0 1px 2px 0 rgba(10,119,255,0.08)",
                  }}
                >
                  <span className="text-[12px]" style={{ fontWeight: 520, color: "#007FFF" }}>
                    Manage Thresholds
                  </span>
                  <ArrowRight className="w-3 h-3" style={{ color: "#007FFF" }} />
                </button>
              )}
            </div>
          </AccordionCard>
          )}

          {/* Activity Summary Card */}
          <AccordionCard
            title="Activity Summary"
            icon={Activity}
            iconBg="#EFF6FF"
            iconColor="#2563EB"
          >
            <div className="pt-4 relative pl-6">
              {/* Timeline vertical line */}
              <div
                className="absolute left-[18px] top-6 bottom-6 w-[2px] rounded-full"
                style={{
                  background: "linear-gradient(to bottom, #C7D2FE, #BAE6FD, #A7F3D0, #FDE68A)",
                }}
              />
              {recentActivity.length > 0 ? (
                recentActivity.map((entry, idx) => {
                  const cfg = ACTIVITY_TYPE_CONFIG[entry.type] || ACTIVITY_TYPE_CONFIG.role_created;
                  const Icon = cfg.icon;
                  const isLast = idx === recentActivity.length - 1;
                  return (
                    <div
                      key={entry.id}
                      className={`relative flex items-start gap-4 ${isLast ? "" : "pb-6"}`}
                    >
                      {/* Icon on the timeline */}
                      <div
                        className="w-9 h-9 rounded-[8px] flex items-center justify-center shrink-0 -ml-6 relative z-10 border border-white"
                        style={{ backgroundColor: cfg.bg, boxShadow: "0 0 0 3px #FFFFFF" }}
                      >
                        <Icon className="w-4 h-4" style={{ color: cfg.color }} />
                      </div>
                      {/* Content */}
                      <div className="flex-1 min-w-0 pt-0.5">
                        <p
                          className="truncate"
                          style={{ fontSize: "13.5px", fontWeight: 530, color: "#1E293B", lineHeight: "1.3" }}
                        >
                          {entry.title}
                        </p>
                        <p
                          className="mt-0.5"
                          style={{ fontSize: "12px", fontWeight: 400, color: "#94A3B8", lineHeight: "1.4" }}
                        >
                          {entry.timestamp}
                        </p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-[12px] py-3" style={{ color: "#94A3B8" }}>
                  No Activity Recorded Yet
                </p>
              )}
            </div>
          </AccordionCard>
        </div>
      </div>

      {/* Quick-edit permissions modal for a single module. Predefined roles are
          read-only; custom roles are editable with on/off toggles. */}
      {openModule && (
        <PermissionDetailModal
          module={openModule}
          onClose={() => setOpenModule(null)}
          context="role-detail"
          mode={mayEditPermissions ? "editable" : "readonly"}
          userId={roleId}
          initialToggles={openModuleToggles}
          hideSourceChips
          onSave={
            mayEditPermissions
              ? (savedToggles) =>
                  setModuleToggleOverrides((prev) => ({
                    ...prev,
                    [openModule.name]: savedToggles,
                  }))
              : undefined
          }
          onApplyLinkedToggles={mayEditPermissions ? applyLinkedToggles : undefined}
        />
      )}

      {/* Threshold Management Modal. Unreachable while the flag is off, since
          nothing renders the CTA that opens it. */}
      {SHOW_PERMISSION_THRESHOLDS && (
      <ThresholdManagementModal
        open={thresholdModalOpen}
        onClose={() => setThresholdModalOpen(false)}
        roleName={role.roleName}
        thresholds={roleThresholds}
        onSave={(updated) => {
          toast.success("Thresholds updated", {
            description: `${updated.length} threshold${updated.length !== 1 ? "s" : ""} saved for ${role.roleName}`,
          });
        }}
      />
      )}
    </div>
  );
}