import { useState, useCallback, useMemo, useEffect, useRef, type ReactNode } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { Shield, Plus, Zap, Download, Upload, ChevronDown, CheckCircle2, X as CloseIcon } from "lucide-react";
import { ExportUsersModal, type ExportUsersContext } from "./shared/ExportUsersModal";
import { ExportRolesModal, type ExportRolesContext } from "./shared/ExportRolesModal";
import type { RoleRow } from "../data/roles-data";
import { PageHeader } from "./shared/PageHeader";
import type { UserRow } from "../data/users-data";
import { HeaderTabs } from "./shared/HeaderTabs";
import { UsersTab } from "./tabs/UsersTab";
import { RolesTab } from "./tabs/RolesTab";
import { UserRequestsTab } from "./tabs/UserRequestsTab";
import { CreateUserModal } from "./create-user/CreateUserModal";
import { CreateRoleModal } from "./create-role/CreateRoleModal";
import { QuickInviteModal } from "./QuickInviteModal";
import { UsersImportWizard } from "./data-imports/import-wizard/UsersImportWizard";
import { RolesImportWizard } from "./data-imports/import-wizard/RolesImportWizard";
import {
  useImportedUsers,
  useImportNotice,
  dismissImportNotice,
} from "../data/users-row-store";
import {
  useRolesImportNotice,
  dismissRolesImportNotice,
} from "../data/roles-row-store";
import { PermissionsModuleGrid } from "./permissions/PermissionsModuleGrid";
import { PERMISSION_MODULES } from "../data/permissions-data";
import { getModuleRoleUsageCounts } from "../data/role-permissions-map";
import { MY_PERMISSION_MODULE_IDS } from "../data/current-user";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "./ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "./ui/dropdown-menu";
import { PerformanceInsights, InsightsToolbarButton, LISTING_DATE_OPTIONS } from "./shared/PerformanceInsights";
import {
  USERS_INSIGHTS,
  USERS_INSIGHT_CATEGORIES,
  USERS_DEFAULT_VISIBLE,
  ROLES_INSIGHTS,
  ROLES_INSIGHT_CATEGORIES,
  ROLES_DEFAULT_VISIBLE,
} from "../data/insights-data";
import { AccessGate, useAccessMode, useGate, useShownGate, type Gate } from "./access-mode";

const tabs = [
  { id: "users", label: "Users" },
  { id: "roles", label: "Roles" },
  { id: "permissions", label: "Permissions" },
  /* Locked: the tab and its panel stay in place, but the tab takes no click. */
  { id: "requests", label: "Requested Permissions", disabled: true, disabledTooltip: "Coming Soon" },
] as const;

type TabId = (typeof tabs)[number]["id"];

/* Outcome segments are tinted by severity (created in green 700, skipped
 * in red 700, warnings in amber 700) so the banner reads at a glance.
 * `entity` names the record type ("user" for the Users tab, "role" for the
 * Roles tab); skipped rows and warnings phrase identically on both. */
function formatImportSummary(
  counts: {
    created: number;
    updated: number;
    skipped: number;
    warnings: number;
  },
  entity: { singular: string; plural: string },
): React.ReactNode {
  const noun = (n: number, singular: string, plural: string) =>
    `${n} ${n === 1 ? singular : plural}`;
  const parts: React.ReactNode[] = [];
  if (counts.created > 0) {
    parts.push(
      <span key="created" style={{ color: "#15803D" }}>
        {noun(counts.created, entity.singular, entity.plural)} created
      </span>,
    );
  }
  if (counts.updated > 0) {
    parts.push(<span key="updated">{noun(counts.updated, entity.singular, entity.plural)} updated</span>);
  }
  if (counts.skipped > 0) {
    parts.push(
      <span key="skipped" style={{ color: "#B91C1C" }}>
        {noun(counts.skipped, "row", "rows")} skipped
      </span>,
    );
  }
  if (counts.warnings > 0) {
    parts.push(
      <span key="warnings" style={{ color: "#B45309" }}>
        {noun(counts.warnings, "warning", "warnings")}
      </span>,
    );
  }
  if (parts.length === 0) return "Last import finished.";
  const out: React.ReactNode[] = ["Last import finished. "];
  parts.forEach((p, i) => {
    if (i > 0) out.push(", ");
    out.push(p);
  });
  out.push(".");
  return out;
}

export function UserAccessControl() {
  const navigate = useNavigate();
  const access = useAccessMode();
  const gate = useGate();
  const shownGate = useShownGate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabId>(() => {
    const tabParam = searchParams.get("tab");
    /* A locked tab is not reachable by deep link either — `?tab=requests`
     * falls back to Users rather than bypassing the disabled tab button. */
    if (tabParam && tabs.some((t) => t.id === tabParam && !("disabled" in t && t.disabled))) {
      return tabParam as TabId;
    }
    return "users";
  });

  // Sync active tab to URL search params
  useEffect(() => {
    const current = searchParams.get("tab");
    if (current !== activeTab) {
      setSearchParams({ tab: activeTab }, { replace: true });
    }
  }, [activeTab, searchParams, setSearchParams]);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [showCreateRole, setShowCreateRole] = useState(false);
  const [showQuickInvite, setShowQuickInvite] = useState(false);
  const [showImportWizard, setShowImportWizard] = useState(false);
  const [showRolesImportWizard, setShowRolesImportWizard] = useState(false);

  /* Import-success banners shown on the Users / Roles tabs after a
   * completed import. */
  const importNotice = useImportNotice();
  const rolesImportNotice = useRolesImportNotice();

  // Export modal: opened from the header Export button (filtered/all context)
  // or the bulk action bar's Export button (selected context).
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportContext, setExportContext] = useState<ExportUsersContext | null>(null);
  const [usersListStats, setUsersListStats] = useState<{ filteredCount: number; totalCount: number }>({
    filteredCount: 0,
    totalCount: 0,
  });
  const [usersFilteredRows, setUsersFilteredRows] = useState<UserRow[]>([]);
  const [usersColumnVisibility, setUsersColumnVisibility] = useState<Record<string, boolean>>({});
  /** Rows resolved at modal-open time based on context. Stable while the modal is open. */
  const [exportRows, setExportRows] = useState<UserRow[]>([]);

  const handleOpenHeaderExport = useCallback(() => {
    const { filteredCount, totalCount } = usersListStats;
    setExportContext(
      filteredCount === totalCount
        ? { kind: "all", totalCount }
        : { kind: "filtered", filteredCount, totalCount }
    );
    setExportRows(usersFilteredRows);
    setExportModalOpen(true);
  }, [usersListStats, usersFilteredRows]);

  const handleOpenBulkExport = useCallback((selectedRows: UserRow[]) => {
    setExportContext({ kind: "selected", selectedCount: selectedRows.length });
    setExportRows(selectedRows);
    setExportModalOpen(true);
  }, []);

  const handleCloseExport = useCallback(() => {
    setExportModalOpen(false);
  }, []);

  /* Export modal scope actions. The Users table owns its filters and
     selection, so the request goes down as a table command; once the table
     re-reports its rows, the open export follows (all rows after Clear
     filters, every listed row after Select all). */
  const [usersTableCommand, setUsersTableCommand] = useState<{ kind: "clearFilters" | "selectAll"; seq: number } | undefined>(undefined);
  const pendingUsersExport = useRef<"clearFilters" | "selectAll" | null>(null);
  const sendUsersCommand = useCallback((kind: "clearFilters" | "selectAll") => {
    pendingUsersExport.current = kind;
    setUsersTableCommand((prev) => ({ kind, seq: (prev?.seq ?? 0) + 1 }));
  }, []);
  useEffect(() => {
    const pending = pendingUsersExport.current;
    if (!pending || !exportModalOpen) return;
    const { filteredCount, totalCount } = usersListStats;
    if (pending === "clearFilters" && filteredCount !== totalCount) return;
    pendingUsersExport.current = null;
    setExportContext(filteredCount === totalCount ? { kind: "all", totalCount } : { kind: "filtered", filteredCount, totalCount });
    setExportRows(usersFilteredRows);
  }, [usersFilteredRows, usersListStats, exportModalOpen, usersTableCommand]);

  // Roles export: opens from the header Actions → Export (uses current filter
  // context) or from the bulk action bar (uses the currently selected rows).
  const [exportRolesModalOpen, setExportRolesModalOpen] = useState(false);
  const [exportRolesContext, setExportRolesContext] = useState<ExportRolesContext | null>(null);
  const [rolesListStats, setRolesListStats] = useState<{ filteredCount: number; totalCount: number }>({
    filteredCount: 0,
    totalCount: 0,
  });
  const [rolesFilteredRows, setRolesFilteredRows] = useState<RoleRow[]>([]);
  const [rolesColumnVisibility, setRolesColumnVisibility] = useState<Record<string, boolean>>({});
  /** Rows resolved at modal-open time. Stable while the modal is open. */
  const [exportRolesRows, setExportRolesRows] = useState<RoleRow[]>([]);

  const handleOpenHeaderRolesExport = useCallback(() => {
    const { filteredCount, totalCount } = rolesListStats;
    setExportRolesContext(
      filteredCount === totalCount
        ? { kind: "all", totalCount }
        : { kind: "filtered", filteredCount, totalCount }
    );
    setExportRolesRows(rolesFilteredRows);
    setExportRolesModalOpen(true);
  }, [rolesListStats, rolesFilteredRows]);

  const handleOpenBulkRolesExport = useCallback((selectedRows: RoleRow[]) => {
    setExportRolesContext({ kind: "selected", selectedCount: selectedRows.length });
    setExportRolesRows(selectedRows);
    setExportRolesModalOpen(true);
  }, []);

  const handleCloseRolesExport = useCallback(() => {
    setExportRolesModalOpen(false);
  }, []);

  /* Same scope actions for the Roles export (see the Users block above). */
  const [rolesTableCommand, setRolesTableCommand] = useState<{ kind: "clearFilters" | "selectAll"; seq: number } | undefined>(undefined);
  const pendingRolesExport = useRef<"clearFilters" | "selectAll" | null>(null);
  const sendRolesCommand = useCallback((kind: "clearFilters" | "selectAll") => {
    pendingRolesExport.current = kind;
    setRolesTableCommand((prev) => ({ kind, seq: (prev?.seq ?? 0) + 1 }));
  }, []);
  useEffect(() => {
    const pending = pendingRolesExport.current;
    if (!pending || !exportRolesModalOpen) return;
    const { filteredCount, totalCount } = rolesListStats;
    if (pending === "clearFilters" && filteredCount !== totalCount) return;
    pendingRolesExport.current = null;
    setExportRolesContext(filteredCount === totalCount ? { kind: "all", totalCount } : { kind: "filtered", filteredCount, totalCount });
    setExportRolesRows(rolesFilteredRows);
  }, [rolesFilteredRows, rolesListStats, exportRolesModalOpen, rolesTableCommand]);

  // Insights state - managed here, shared between insights section + toolbar button
  const [usersVisibleIds, setUsersVisibleIds] = useState<string[]>(USERS_DEFAULT_VISIBLE);
  const [rolesVisibleIds, setRolesVisibleIds] = useState<string[]>(ROLES_DEFAULT_VISIBLE);
  const [showInsights, setShowInsights] = useState(true);
  const [insightsPanelOpen, setInsightsPanelOpen] = useState(false);

  /* Imported-users overlay → reactive snapshot used to layer KPI deltas onto
   * the static USERS_INSIGHTS values. */
  const importedUsersList = useImportedUsers();
  const usersInsightsResolved = useMemo(() => {
    /* Cost metrics are billing data (ur-view-billing), so personas without it
     * never see the strip's monthly-spend tile. Applied before the import
     * deltas so the KPI list is filtered once. */
    const visible = access.canViewBilling
      ? USERS_INSIGHTS
      : USERS_INSIGHTS.filter((m) => m.category !== "license-cost");
    if (importedUsersList.length === 0) return visible;
    /* Draft users are counted by no card (ERP-5203 AC 3), so an imported row
     * that lands at Draft must not move a single number. Import currently
     * resolves every row to Active or Deactivated, so this filter is a no-op
     * today and a guard against the day that changes. */
    const counted = importedUsersList.filter((u) => u.status !== "Pending Setup");
    const importedCount = counted.length;
    const fullAccessDelta = counted.filter((u) => u.license === "Full Access").length;
    const fieldUserDelta = counted.filter((u) => u.license === "Field User").length;
    const activeDelta = counted.filter((u) => u.status === "Active").length;
    const addInt = (raw: string, delta: number) => {
      const n = parseInt(raw, 10);
      return Number.isFinite(n) ? String(n + delta) : raw;
    };
    return visible.map((m) => {
      switch (m.id) {
        case "total-users":        return { ...m, value: addInt(m.value, importedCount) };
        case "full-access-users":  return { ...m, value: addInt(m.value, fullAccessDelta) };
        case "field-users":        return { ...m, value: addInt(m.value, fieldUserDelta) };
        case "active-users":       return { ...m, value: addInt(m.value, activeDelta) };
        default:                   return m;
      }
    });
  }, [importedUsersList, access.canViewBilling]);

  const activeVisibleIds = activeTab === "users" ? usersVisibleIds : rolesVisibleIds;

  /* The two Actions-menu items. Each needs only its own permission: Import
   * needs Bulk Import Users and Export needs Bulk Export Users and Roles, with
   * no Create and Edit Users or Roles (ERP-5550 AC5). Without it the item is
   * shown disabled with the reason, never hidden (AC3), so the Actions menu
   * always renders on these two tabs. */
  const importGate = shownGate(true, access.canImportUsers);
  const exportGate = shownGate(true, access.canExportUsers);

  const handleOpenInsightsPanel = useCallback(() => {
    if (!showInsights) setShowInsights(true);
    setInsightsPanelOpen(true);
  }, [showInsights]);

  // Build toolbar insights button for users/roles tabs
  const insightsSlot = useMemo(() => {
    if (activeTab !== "users" && activeTab !== "roles") return undefined;
    return (
      <InsightsToolbarButton
        activeCount={activeVisibleIds.length}
        onClick={handleOpenInsightsPanel}
        isActive={insightsPanelOpen}
      />
    );
  }, [activeTab, activeVisibleIds.length, handleOpenInsightsPanel, insightsPanelOpen]);

  return (
    <div className="w-full font-['Inter',sans-serif] flex flex-col h-full min-h-0">
      <PageHeader
        icon={Shield}
        onBack={() => navigate("/company-settings")}
        backLabel="Back to Company Settings"
        title="User Access Control"
        subtitle="Manage users, assign roles, and configure permissions across your organization."
        actions={
          (activeTab === "users" || activeTab === "roles") && (
            <>
              {/* The Actions menu collapses entirely when neither item inside it
               *  would render, rather than opening onto an empty panel. Both
               *  items use shownGate, so today it always renders. */}
              {(importGate.render || exportGate.render) && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 h-9 px-3.5 text-[13px] rounded-lg border border-[#E2E8F0] bg-white text-slate-700 shadow-sm hover:bg-slate-50 transition-all duration-200 cursor-pointer"
                      style={{ fontWeight: 500 }}
                    >
                      Actions
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-[144px]">
                    <GatedMenuItem
                      gate={importGate}
                      icon={<Upload className="w-3.5 h-3.5 text-[#64748B]" />}
                      label="Import"
                      onSelect={() => {
                        if (activeTab === "users") setShowImportWizard(true);
                        else setShowRolesImportWizard(true);
                      }}
                    />
                    <GatedMenuItem
                      gate={exportGate}
                      icon={<Download className="w-3.5 h-3.5 text-[#64748B]" />}
                      label="Export"
                      onSelect={() => {
                        if (activeTab === "users") handleOpenHeaderExport();
                        else handleOpenHeaderRolesExport();
                      }}
                    />
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              <AccessGate statusAllows={activeTab !== "roles"} capability={access.canInvite}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 h-9 px-3.5 text-[13px] rounded-lg border border-[#007FFF] bg-white shadow-sm hover:bg-[#EDF4FF] transition-all duration-200 cursor-pointer"
                      style={{ color: "#007FFF", fontWeight: 500 }}
                      onClick={() => setShowQuickInvite(true)}
                    >
                      <Zap className="w-3.5 h-3.5" />
                      Quick Invite
                    </button>
                  </TooltipTrigger>
                  <TooltipContent
                    side="bottom"
                    align="end"
                    className="max-w-[290px] text-left"
                  >
                    Send an invitation link to someone new. They receive an email, click the link, and set up their own account. Use this when you want to get someone into the system quickly and let them fill in their own details.
                  </TooltipContent>
                </Tooltip>
              </AccessGate>
              <AccessGate
                capability={activeTab === "roles" ? access.canCreateEditRole : access.canCreateEditUser}
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 h-9 px-4 text-[13px] rounded-lg text-white shadow-sm transition-all duration-200 cursor-pointer hover:bg-[#0862D0]"
                      style={{ backgroundColor: "#007FFF", fontWeight: 600 }}
                      onClick={() =>
                        activeTab === "roles"
                          ? setShowCreateRole(true)
                          : setShowCreateUser(true)
                      }
                    >
                      <Plus className="w-3.5 h-3.5" />
                      {activeTab === "roles" ? "Create New Role" : "Create New User"}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent
                    side="bottom"
                    align="end"
                    className="max-w-[290px] text-left"
                  >
                    {activeTab === "roles"
                      ? "Create a new role from scratch. Define its permissions, assign users, and configure access levels before activating it."
                      : "Build the user's account yourself from scratch. Fill in their details, assign roles, and configure their access before they ever log in. Use this when you want full control over how the account is set up. You can send them an invitation at the end or do it later."}
                  </TooltipContent>
                </Tooltip>
              </AccessGate>
            </>
          )
        }
        bottomSlot={
          <HeaderTabs tabs={tabs} value={activeTab} onChange={(id) => setActiveTab(id as TabId)} accent="#007FFF" />
        }
      />

      {/* Content Area */}
      <div className="px-6 lg:px-8 pt-4 pb-6 flex-1 min-h-0 flex flex-col">
        {/* Performance Insights: above the table card, only for users & roles */}
        {(activeTab === "users" || activeTab === "roles") && (
          <div className="mb-4 shrink-0">
            {activeTab === "users" && (
              <PerformanceInsights
                metrics={usersInsightsResolved}
                categories={USERS_INSIGHT_CATEGORIES}
                defaultVisibleIds={USERS_DEFAULT_VISIBLE}
                visibleIds={usersVisibleIds}
                onVisibleIdsChange={setUsersVisibleIds}
                drawerOpen={insightsPanelOpen}
                onDrawerOpenChange={setInsightsPanelOpen}
                dateOptions={LISTING_DATE_OPTIONS}
                defaultDateRange="all_time"
              />
            )}
            {activeTab === "roles" && (
              <PerformanceInsights
                metrics={ROLES_INSIGHTS}
                categories={ROLES_INSIGHT_CATEGORIES}
                defaultVisibleIds={ROLES_DEFAULT_VISIBLE}
                visibleIds={rolesVisibleIds}
                onVisibleIdsChange={setRolesVisibleIds}
                drawerOpen={insightsPanelOpen}
                onDrawerOpenChange={setInsightsPanelOpen}
                dateOptions={LISTING_DATE_OPTIONS}
                defaultDateRange="all_time"
                panelSubtitle="Select the metrics to display above the role list."
              />
            )}
          </div>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12, ease: "easeOut" }}
            className="flex flex-1 min-h-0 flex-col"
          >
            {activeTab !== "permissions" ? (
              <>
                {activeTab === "users" && importNotice && (
                  <div
                    className="relative mb-3 rounded-xl border overflow-hidden shrink-0"
                    style={{ backgroundColor: "#EFF6FF", borderColor: "#BFDBFE" }}
                    role="status"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        window.open(
                          `/company-settings/data-imports/users/${importNotice.importId}`,
                          "_blank",
                          "noopener,noreferrer",
                        )
                      }
                      aria-label="View import details (opens in new tab)"
                      className="flex items-center gap-3 px-4 py-2.5 w-full text-left cursor-pointer transition-colors hover:bg-[#DBEAFE]/60"
                    >
                      <CheckCircle2 className="w-5 h-5 shrink-0" style={{ color: "#1D4ED8" }} />
                      <span className="flex-1 text-[13.5px]" style={{ color: "#1E3A8A", fontWeight: 500 }}>
                        {formatImportSummary(importNotice, { singular: "user", plural: "users" })}
                      </span>
                      {/* Spacer reserves room for the absolutely-positioned X */}
                      <span aria-hidden className="shrink-0" style={{ width: 28, height: 28 }} />
                    </button>
                    <button
                      type="button"
                      onClick={dismissImportNotice}
                      aria-label="Dismiss"
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-md flex items-center justify-center hover:bg-[#BFDBFE] transition-colors cursor-pointer"
                      style={{ color: "#1E3A8A" }}
                    >
                      <CloseIcon className="w-4 h-4" />
                    </button>
                  </div>
                )}
                {activeTab === "roles" && rolesImportNotice && (
                  <div
                    className="relative mb-3 rounded-xl border overflow-hidden shrink-0"
                    style={{ backgroundColor: "#EFF6FF", borderColor: "#BFDBFE" }}
                    role="status"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        window.open(
                          `/company-settings/data-imports/roles/${rolesImportNotice.importId}`,
                          "_blank",
                          "noopener,noreferrer",
                        )
                      }
                      aria-label="View import details (opens in new tab)"
                      className="flex items-center gap-3 px-4 py-2.5 w-full text-left cursor-pointer transition-colors hover:bg-[#DBEAFE]/60"
                    >
                      <CheckCircle2 className="w-5 h-5 shrink-0" style={{ color: "#1D4ED8" }} />
                      <span className="flex-1 text-[13.5px]" style={{ color: "#1E3A8A", fontWeight: 500 }}>
                        {formatImportSummary(rolesImportNotice, { singular: "role", plural: "roles" })}
                      </span>
                      {/* Spacer reserves room for the absolutely-positioned X */}
                      <span aria-hidden className="shrink-0" style={{ width: 28, height: 28 }} />
                    </button>
                    <button
                      type="button"
                      onClick={dismissRolesImportNotice}
                      aria-label="Dismiss"
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-md flex items-center justify-center hover:bg-[#BFDBFE] transition-colors cursor-pointer"
                      style={{ color: "#1E3A8A" }}
                    >
                      <CloseIcon className="w-4 h-4" />
                    </button>
                  </div>
                )}
              <div
                className="rounded-xl bg-card overflow-clip flex flex-1 min-h-0 flex-col"
                style={{
                  boxShadow:
                    "0 1px 3px 0 rgba(15, 23, 42, 0.04), 0 1px 2px -1px rgba(15, 23, 42, 0.04)",
                  border: "1px solid #E2E8F0",
                }}
              >
                {activeTab === "users" && (
                  <UsersTab
                    insightsSlot={insightsSlot}
                    onListStatsChange={setUsersListStats}
                    onFilteredRowsChange={setUsersFilteredRows}
                    tableCommand={usersTableCommand}
                    onColumnVisibilityChange={setUsersColumnVisibility}
                    onBulkExport={handleOpenBulkExport}
                  />
                )}
                {activeTab === "roles" && (
                  <RolesTab
                    insightsSlot={insightsSlot}
                    onListStatsChange={setRolesListStats}
                    onFilteredRowsChange={setRolesFilteredRows}
                    tableCommand={rolesTableCommand}
                    onColumnVisibilityChange={setRolesColumnVisibility}
                    onBulkExport={handleOpenBulkRolesExport}
                  />
                )}
                {activeTab === "requests" && <UserRequestsTab />}
              </div>
              </>
            ) : (
              <PermissionsModuleGrid
                modalContext="permissions-tab"
                modalMode="readonly"
                hideActiveChip
                roleUsageCounts={getModuleRoleUsageCounts(
                  Object.fromEntries(
                    PERMISSION_MODULES.map((m) => [m.id, m.permissions.map((p) => p.id)])
                  )
                )}
                showMeMode
                meModePredicate={(row) => MY_PERMISSION_MODULE_IDS.has(row.id)}
                meModeTooltip="Show only permissions assigned to you directly, inherited via your roles, or last edited by you."
                persistKey="uac:permissions-catalog"
                showToggleAllActions={false}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <CreateUserModal open={showCreateUser} onClose={() => setShowCreateUser(false)} />
      <CreateRoleModal open={showCreateRole} onClose={() => setShowCreateRole(false)} />
      <QuickInviteModal open={showQuickInvite} onClose={() => setShowQuickInvite(false)} />
      <UsersImportWizard
        open={showImportWizard}
        onClose={() => setShowImportWizard(false)}
      />
      <RolesImportWizard
        open={showRolesImportWizard}
        onClose={() => setShowRolesImportWizard(false)}
      />
      <ExportUsersModal
        open={exportModalOpen}
        onClose={handleCloseExport}
        context={exportContext}
        tableColumnVisibility={usersColumnVisibility}
        rows={exportRows}
        onClearFilters={() => sendUsersCommand("clearFilters")}
        onSelectAll={() => sendUsersCommand("selectAll")}
      />
      <ExportRolesModal
        open={exportRolesModalOpen}
        onClose={handleCloseRolesExport}
        context={exportRolesContext}
        tableColumnVisibility={rolesColumnVisibility}
        rows={exportRolesRows}
        onClearFilters={() => sendRolesCommand("clearFilters")}
        onSelectAll={() => sendRolesCommand("selectAll")}
      />
    </div>
  );
}

/** An Actions-menu item behind a Gate. A disabled item keeps Radix's own
 *  `disabled` (keyboard navigation skips it), and is wrapped in the same
 *  Tooltip AccessGate uses so the reason shows on hover: the menu primitive
 *  sets pointer-events-none on a disabled item, so a `title` never appeared. */
function GatedMenuItem({
  gate,
  icon,
  label,
  onSelect,
}: {
  gate: Gate;
  icon: ReactNode;
  label: string;
  onSelect: () => void;
}) {
  if (!gate.render) return null;
  const item = (
    <DropdownMenuItem
      className={gate.disabled ? "gap-2 cursor-not-allowed" : "cursor-pointer gap-2"}
      disabled={gate.disabled}
      onClick={() => {
        if (!gate.disabled) onSelect();
      }}
    >
      {icon}
      {label}
    </DropdownMenuItem>
  );
  if (!gate.disabled) return item;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="cursor-not-allowed" aria-label={`${label}: ${gate.reason}`}>
          {item}
        </div>
      </TooltipTrigger>
      <TooltipContent side="left" className="max-w-[260px]">
        {gate.reason}
      </TooltipContent>
    </Tooltip>
  );
}
