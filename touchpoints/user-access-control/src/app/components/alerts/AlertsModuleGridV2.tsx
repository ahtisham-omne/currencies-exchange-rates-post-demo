import { useCallback, useMemo, useState, type ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { ManageNotificationsModal } from "../ManageNotificationsModal";
import {
  ALERT_CATEGORIES,
  ALERT_MODULES,
  ALERT_MODULES_LOOKUP,
  getModuleAlerts,
} from "../../data/alerts-data";
import { getRoleAlertDefaults } from "../../data/predefined-roles";
import {
  ModuleGridShell,
  type ModuleGridGroup,
  type ModuleGridRow,
} from "../shared/ModuleGridShell";
import { toast } from "sonner";
import { useAccessMode } from "../access-mode";

/* Quick-filter groups. Derived from the alerts catalog's categories so the chips
   and their counts always match the alerts module. Categories with no modules
   yet (Production & Planning, Sales, Accounting & Finance) are dropped, matching
   the alerts module, which only chips categories that hold modules. */
const ALERT_GROUPS: ModuleGridGroup[] = ALERT_CATEGORIES.map((c) => ({
  key: c.key,
  label: c.label,
  moduleIds: ALERT_MODULES.filter((m) => m.categoryKey === c.key).map((m) => m.moduleId),
})).filter((g) => g.moduleIds.length > 0);

const MODULE_TO_GROUP: Record<string, { key: string; label: string }> = {};
ALERT_GROUPS.forEach((g) => {
  g.moduleIds.forEach((mid) => {
    MODULE_TO_GROUP[mid] = { key: g.key, label: g.label };
  });
});

/** Channel state for a module: the union of channels its enabled alerts use. */
function getChannelsForModule(moduleId: string, alertsEnabled: boolean[]) {
  const alerts = getModuleAlerts(moduleId).filter((_, i) => alertsEnabled[i]);
  return {
    email: alerts.some((a) => a.channels.includes("email")),
    inApp: alerts.some((a) => a.channels.includes("in-app")),
    push: alerts.some((a) => a.channels.includes("push")),
  };
}

interface AlertsModuleGridProps {
  /** Stable key (e.g. `user-123` or `role-15`). Identifies the subject whose
   *  alerts these are; counts themselves come from the alerts catalog. */
  scopeKey: string;
  /** Name of the user/role these alerts belong to. Drives the "admin viewing
   *  someone else's alerts" copy in the manage modal. */
  subjectName?: string;
  /** When set, this grid belongs to a predefined role: per-module counts and the
   *  modal reflect that role's default alert set (Pioneer v2.0). */
  roleName?: string;
  /** Flush info strip rendered between the toolbar and the grid content, in
   *  place of the plain divider. Same slot Create Role step 2 uses for its
   *  "on by default" notice. */
  headerBanner?: ReactNode;
}

export function AlertsModuleGrid({ subjectName, roleName, headerBanner }: AlertsModuleGridProps) {
  const access = useAccessMode();
  const [activeModuleName, setActiveModuleName] = useState<string | null>(null);
  const [activeModuleId, setActiveModuleId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  /* For a role (predefined or custom), map its default alerts
     (by name → off-by-default). */
  const roleAlertMap = useMemo(() => {
    const defaults = roleName ? getRoleAlertDefaults(roleName) : undefined;
    return defaults ? new Map(defaults.map((a) => [a.name, a.offByDefault])) : null;
  }, [roleName]);

  /* Build rows straight from the alerts catalog: one row per alerts module. */
  const rows = useMemo<ModuleGridRow[]>(() => {
    return ALERT_MODULES.map((mod) => {
      const grp = MODULE_TO_GROUP[mod.moduleId] ?? { key: "other", label: "Other" };
      /* Which of this module's alerts are on for this subject. Role scope reads
         the role's defaults (by alert name); user scope reads the account-level
         default carried on each alert. */
      const alertsEnabled = mod.alerts.map((a) =>
        roleAlertMap
          ? roleAlertMap.has(a.title) && !roleAlertMap.get(a.title)
          : a.enabled,
      );
      return {
        id: mod.moduleId,
        name: mod.name,
        description: mod.description,
        icon: mod.icon,
        total: mod.alerts.length,
        active: alertsEnabled.filter(Boolean).length,
        channels: getChannelsForModule(mod.moduleId, alertsEnabled),
        groupKey: grp.key,
        groupLabel: grp.label,
        /* No alerts defined yet: the card renders greyed out with a "Coming
           soon" footer, exactly as the alerts module presents it. */
        comingSoon: !mod.hasAlerts,
      };
    });
  }, [roleAlertMap]);

  const handleModuleClick = useCallback((moduleId: string) => {
    const mod = ALERT_MODULES_LOOKUP[moduleId];
    // Coming-soon modules have nothing to show, so they do not open the modal.
    if (!mod?.hasAlerts) return;
    setActiveModuleName(mod.name);
    setActiveModuleId(moduleId);
    setModalOpen(true);
  }, []);

  const handleEnableAll = useCallback((moduleId: string) => {
    const mod = ALERT_MODULES_LOOKUP[moduleId];
    if (!mod?.hasAlerts) return;
    toast.success(`All alerts enabled for ${mod.name}`);
  }, []);

  const handleDisableAll = useCallback((moduleId: string) => {
    const mod = ALERT_MODULES_LOOKUP[moduleId];
    if (!mod?.hasAlerts) return;
    toast.success(`All alerts disabled for ${mod.name}`);
  }, []);

  return (
    <>
      <ModuleGridShell
        variant="alerts"
        rows={rows}
        groups={ALERT_GROUPS}
        /* Bumped when the quick-filter groups moved to the alerts-module
           categories: the old keys ("sales", "mobile") no longer exist, and a
           restored one would filter to zero rows. */
        persistKey="uac:alerts-grid-v2"
        headerBanner={headerBanner}
        onModuleClick={handleModuleClick}
        onEnableAll={handleEnableAll}
        onDisableAll={handleDisableAll}
        /* Enable All / Disable All are the only mutating items in the row
           kebab; without them it collapses to View alerts only. */
        showToggleAllActions={access.canEditAlerts}
        renderCardView={(filteredRows, filteredGroups) => (
          <CardView
            filteredRows={filteredRows}
            filteredGroups={filteredGroups}
            onModuleClick={handleModuleClick}
          />
        )}
      />
      <ManageNotificationsModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        moduleName={activeModuleName ?? ""}
        moduleId={activeModuleId ?? ""}
        subjectName={subjectName}
        roleName={roleName}
      />
    </>
  );
}

/* ─── Card View ─── */
function CardView({
  filteredRows,
  filteredGroups,
  onModuleClick,
}: {
  filteredRows: ModuleGridRow[];
  filteredGroups: ModuleGridGroup[];
  onModuleClick: (id: string) => void;
}) {
  const buckets = filteredGroups
    .map((g) => ({
      heading: g.label,
      rows: filteredRows.filter((r) => r.groupKey === g.key),
    }))
    .filter((b) => b.rows.length > 0);

  if (buckets.length === 0) {
    return (
      <div className="px-2 py-12 text-center text-[13px] text-[#64748B]">
        No modules match your search or filters.
      </div>
    );
  }

  return (
    <div className="space-y-7">
      {buckets.map((b) => (
        <div key={b.heading}>
          <h3
            className="text-[#0F172A] mb-3.5"
            style={{ fontSize: "15px", fontWeight: 600, lineHeight: "1.3" }}
          >
            {b.heading}
          </h3>
          <div
            className="grid gap-3.5"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}
          >
            {b.rows.map((r) => (
              <AlertsCard key={r.id} row={r} onClick={() => onModuleClick(r.id)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function AlertsCard({ row, onClick }: { row: ModuleGridRow; onClick: () => void }) {
  const Icon = row.icon;
  return (
    <button
      onClick={onClick}
      className="group text-left bg-white rounded-xl border border-[#E2E8F0] p-4 hover:border-[#FCD34D] transition-all duration-200 cursor-pointer flex flex-col relative overflow-hidden"
      style={{
        boxShadow: "0 1px 2px 0 rgba(15,23,42,0.05)",
        borderLeftWidth: "3px",
        borderLeftColor: "#F59E0B",
      }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="w-9 h-9 rounded-[8px] flex items-center justify-center shrink-0" style={{ backgroundColor: "#FEF3C7" }}>
          <Icon className="w-[17px] h-[17px]" style={{ color: "#B45309" }} />
        </div>
        <span
          className="inline-flex items-center gap-1 opacity-0 translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200 mt-0.5"
          style={{ color: "#B45309", fontSize: "12.5px", fontWeight: 520 }}
        >
          View
          <ArrowRight className="w-3.5 h-3.5" />
        </span>
      </div>
      <h3 className="text-[#0F172A] mb-1" style={{ fontSize: "14px", fontWeight: 580, lineHeight: "1.3" }}>
        {row.name}
      </h3>
      <p className="text-[#64748B] mb-3 flex-1" style={{ fontSize: "12.5px", fontWeight: 400, lineHeight: "1.45" }}>
        {row.description}
      </p>
      <div className="flex items-center justify-between pt-2.5 border-t border-[#F1F5F9]">
        <span className="text-[12px]" style={{ color: "#94A3B8", fontWeight: 450 }}>
          {row.total} alert{row.total !== 1 ? "s" : ""}
        </span>
        <span
          className="text-[11px] px-1.5 py-0.5 rounded"
          style={{
            backgroundColor: row.active > 0 ? "#F0FDF4" : "#F8FAFC",
            color: row.active > 0 ? "#16A34A" : "#94A3B8",
            fontWeight: 500,
          }}
        >
          {row.active} enabled
        </span>
      </div>
    </button>
  );
}
