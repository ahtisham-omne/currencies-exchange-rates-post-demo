import { useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback, useRef, type ComponentType, type CSSProperties } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { toast } from "sonner";
import {
  SlidersHorizontal,
  Building2,
  Shield,
  Bell,
  Ruler,
  Users,
  FileInput,
  ExternalLink,
  RotateCcw,
  Save,
  FileUp,
  ShieldPlus,
  UserPlus,
} from "lucide-react";
import { DraggableModuleCard, type ModuleCard } from "./shared/OverviewModuleCard";
import { CreateUserModal } from "./create-user/CreateUserModal";
import { UsersImportWizard } from "./data-imports/import-wizard/UsersImportWizard";
import { RolesImportWizard } from "./data-imports/import-wizard/RolesImportWizard";
import { sampleOnly } from "../data/tenant";

const modules: ModuleCard[] = [
  {
    title: "General Settings",
    description: "Company profile, legal information, account owner, and tenant-wide defaults for timezone, date format, and currency.",
    icon: Building2,
    iconColor: "#007FFF",
    iconBg: "#EDF4FF",
    path: "/company-settings/general",
    enabled: true,
  },
  {
    title: "Security Settings",
    description: "Authentication policies, session controls, and access enforcement.",
    icon: Shield,
    iconColor: "#EF4444",
    iconBg: "#FEF2F2",
    path: "/company-settings/security",
    externalUrl: "https://fusion-zen.lovable.app/company-settings/security",
    enabled: true,
  },
  {
    title: "Alert Settings",
    description: "Notification channels, escalation rules, and alert thresholds.",
    icon: Bell,
    iconColor: "#F59E0B",
    iconBg: "#FFFBEB",
    path: "/company-settings/alerts",
    externalUrl: "https://alert-settings-omne.lovable.app/company-settings/alerts",
    enabled: true,
  },
  {
    title: "Data Imports",
    description: "Configure bulk import settings and templates for each module.",
    icon: FileInput,
    iconColor: "#7C3AED",
    iconBg: "#F5F3FF",
    path: "/company-settings/data-imports",
    enabled: true,
  },
  {
    title: "Module Defaults",
    description: "Configure company-wide default behaviors for each module.",
    icon: SlidersHorizontal,
    iconColor: "#007FFF",
    iconBg: "#EDF4FF",
    path: "/company-settings/module-defaults",
    externalUrl: "https://module-defaults.lovable.app/company-settings/modules",
    enabled: true,
  },
  {
    title: "User Access Control",
    description: "Manage users, roles, permissions, and access requests.",
    icon: Users,
    iconColor: "#0891B2",
    iconBg: "#ECFEFF",
    path: "/company-settings/user-access-control",
    enabled: true,
  },
  {
    title: "Units of Measure",
    description: "Define measurement units and conversion rules across the system.",
    icon: Ruler,
    iconColor: "#059669",
    iconBg: "#ECFDF5",
    path: "/company-settings/units-of-measure",
    enabled: true,
    /* Reads as a live card and behaves as one on hover, it just has nowhere to
     * go yet: the destination is being built in another workstream. Deliberately
     * NOT `enabled: false`, which would grey it out and badge it "Soon". */
    navigable: false,
  },
];

/* ═════════��═════════════════════════════
   RECOMMENDED ACTIONS
   ═══════════════════════════════════════ */

interface RecommendedAction {
  title: string;
  description: string;
  icon: ComponentType<{ className?: string; style?: CSSProperties }>;
  iconColor: string;
  iconBg: string;
  /** Navigation target, for actions that take the admin somewhere. */
  path?: string;
  /** Modal to open in place, for actions that are done right here. */
  opens?: "create-user" | "import-users" | "import-roles";
}

/* Each action opens the real flow in place rather than dropping the admin on a
 * listing to find it themselves. Icon and tint are unique per action so the
 * three read apart at a glance. */
const recommendedActions: RecommendedAction[] = [
  {
    title: "Create New User",
    description: "Add a new user to the system.",
    icon: UserPlus,
    iconColor: "#007FFF",
    iconBg: "#EDF4FF",
    opens: "create-user",
  },
  {
    title: "Import Users",
    description: "Bring users in from a spreadsheet.",
    icon: FileUp,
    iconColor: "#059669",
    iconBg: "#ECFDF5",
    opens: "import-users",
  },
  {
    title: "Import Roles",
    description: "Bring roles in from a spreadsheet.",
    icon: ShieldPlus,
    iconColor: "#7C3AED",
    iconBg: "#F5F3FF",
    opens: "import-roles",
  },
];

/* ═══════════════════════════════════════
   RECENT ACTIVITY
   ═══════════════════════════════════════ */

interface ActivityItem {
  label: string;
  time: string;
  dotColor: string;
}

const recentActivity: ActivityItem[] = [
  { label: "Warehouse Defaults Updated by Admin", time: "2h ago", dotColor: "#007FFF" },
  { label: "MFA Enforcement Enabled", time: "4h ago", dotColor: "#059669" },
  { label: "Currency Format Changed to USD", time: "1d ago", dotColor: "#475569" },
  { label: "Session Timeout Set to 30 Min", time: "1d ago", dotColor: "#7C3AED" },
  { label: "New Role Created: Auditor", time: "2d ago", dotColor: "#EA580C" },
];

/* ═══════════════════════════════════════
   DRAG-AND-DROP PERSISTENCE
   ═══════════════════════════════════════ */

const STORAGE_KEY_MODULES = "company-setup-module-order";
const DND_MODULE = "COMPANY_MODULE_CARD";

const DEFAULT_MODULE_ORDER = modules.map((_, i) => i);

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch { /* ignore */ }
  return fallback;
}

/* ═══════════════════════════════════════
   COMPANY SETUP OVERVIEW PAGE
   ═══════════════════════════════════════ */

export function CompanySetupOverview() {
  const navigate = useNavigate();

  /* ─── Layout state ─── */
  /* If a previously persisted order doesn't cover every current module
   * (e.g. after the module list was edited), drop it and rebuild from
   * defaults so newly added cards don't silently disappear. */
  const initialModuleOrder = (() => {
    const stored = loadFromStorage<number[]>(STORAGE_KEY_MODULES, DEFAULT_MODULE_ORDER);
    return stored.length === modules.length ? stored : DEFAULT_MODULE_ORDER;
  })();
  const [moduleOrder, setModuleOrder] = useState<number[]>(initialModuleOrder);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  /* ─── Recommended actions open their real flow here, so an admin can create a
   * user or run an import without first navigating into the module. ─── */
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [importUsersOpen, setImportUsersOpen] = useState(false);
  const [importRolesOpen, setImportRolesOpen] = useState(false);

  const savedModuleOrder = useRef(initialModuleOrder);

  useEffect(() => {
    const modulesChanged = JSON.stringify(moduleOrder) !== JSON.stringify(savedModuleOrder.current);
    setHasUnsavedChanges(modulesChanged);
  }, [moduleOrder]);

  const moveModuleCard = useCallback((from: number, to: number) => {
    setModuleOrder((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }, []);

  const saveLayout = useCallback(() => {
    localStorage.setItem(STORAGE_KEY_MODULES, JSON.stringify(moduleOrder));
    savedModuleOrder.current = moduleOrder;
    setHasUnsavedChanges(false);
    toast.success("Layout saved", { description: "Your custom layout has been saved." });
  }, [moduleOrder]);

  const resetLayout = useCallback(() => {
    setModuleOrder(DEFAULT_MODULE_ORDER);
    localStorage.removeItem(STORAGE_KEY_MODULES);
    savedModuleOrder.current = DEFAULT_MODULE_ORDER;
    setHasUnsavedChanges(false);
    toast.info("Layout reset", { description: "Restored to default layout." });
  }, []);

  const orderedModules = moduleOrder.map((i) => modules[i]).filter(Boolean);

  return (
    <div className="flex-1 overflow-y-auto">
      <DndProvider backend={HTML5Backend}>
        <div className="px-4 sm:px-5 lg:px-6 py-3 sm:py-4 w-full max-w-[1120px] mx-auto">
          {/* Page Header */}
          <div className="mb-3 sm:mb-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-0.5">
              <h1 className="text-xl sm:text-2xl font-bold">Company Setup</h1>
              {/* Layout Controls */}
              <div className="flex items-center gap-1.5">
                {hasUnsavedChanges && (
                  <button
                    onClick={saveLayout}
                    className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-[8px] border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors cursor-pointer"
                    style={{ color: "#007FFF", fontWeight: 500 }}
                  >
                    <Save className="w-3 h-3" />
                    Save Layout
                  </button>
                )}
                <button
                  onClick={resetLayout}
                  className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-[8px] border border-border hover:bg-muted/40 text-muted-foreground transition-colors cursor-pointer"
                  style={{ fontWeight: 500 }}
                >
                  <RotateCcw className="w-3 h-3" />
                  <span className="hidden sm:inline">Reset</span>
                </button>
              </div>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Manage your organization's configuration, security policies, and system-wide preferences.{" "}
              <button
                className="inline-flex items-center gap-1 text-xs sm:text-sm hover:underline"
                style={{ color: "#007FFF", fontWeight: 500 }}
              >
                Learn more
                <ExternalLink className="w-3 h-3" />
              </button>
            </p>
          </div>

          {/* Modules Section */}
          <div className="mb-4 sm:mb-5">
            <h4 className="text-sm text-muted-foreground mb-2 sm:mb-2.5" style={{ fontWeight: 500 }}>
              Modules
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-2.5">
              {orderedModules.map((mod, idx) => (
                <DraggableModuleCard
                  key={mod.title}
                  mod={mod}
                  index={idx}
                  moveCard={moveModuleCard}
                  onNavigate={navigate}
                  dndType={DND_MODULE}
                />
              ))}
            </div>
          </div>

          {/* Bottom Section: Recommended Actions + Recent Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-2.5">
            {/* Recommended Actions */}
            <div className="lg:col-span-2">
              <h4
                className="text-sm text-muted-foreground mb-2 sm:mb-2.5"
                style={{ fontWeight: 500 }}
              >
                Recommended Actions
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {recommendedActions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.title}
                      onClick={() => {
                        if (action.opens === "create-user") setCreateUserOpen(true);
                        else if (action.opens === "import-users") setImportUsersOpen(true);
                        else if (action.opens === "import-roles") setImportRolesOpen(true);
                        else if (action.path) navigate(action.path);
                      }}
                      className={`flex items-center gap-3 bg-card border border-border rounded-xl px-3.5 py-3 text-left transition-all ${
                        action.path || action.opens
                          ? "hover:shadow-sm hover:border-primary/20 cursor-pointer"
                          : "opacity-60 cursor-default"
                      }`}
                    >
                      <div
                        className="w-8 h-8 rounded-[8px] flex items-center justify-center shrink-0"
                        style={{ backgroundColor: action.iconBg }}
                      >
                        <Icon className="w-4 h-4" style={{ color: action.iconColor }} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px]" style={{ fontWeight: 500 }}>
                          {action.title}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {action.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Recent Activity */}
            <div className="lg:col-span-1">
              <div className="flex items-center justify-between mb-2 sm:mb-2.5">
                <h4
                  className="text-sm text-muted-foreground"
                  style={{ fontWeight: 500 }}
                >
                  Recent Activity
                </h4>
                <button
                  className="text-xs hover:underline"
                  style={{ color: "#007FFF", fontWeight: 500 }}
                >
                  View More
                </button>
              </div>
              <div className="bg-card border border-border rounded-xl divide-y divide-border">
                {/* The sample company's activity; a company from onboarding has none. */}
                {sampleOnly(recentActivity).map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2.5 px-3.5 py-2.5"
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: item.dotColor }}
                    />
                    <span className="text-[13px] flex-1 min-w-0 truncate">
                      {item.label}
                    </span>
                    <span
                      className="text-[11px] text-muted-foreground shrink-0"
                      style={{ fontWeight: 400 }}
                    >
                      {item.time}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </DndProvider>

      {/* Recommended-action flows: the same components the module itself uses. */}
      <CreateUserModal open={createUserOpen} onClose={() => setCreateUserOpen(false)} />
      <UsersImportWizard open={importUsersOpen} onClose={() => setImportUsersOpen(false)} />
      <RolesImportWizard open={importRolesOpen} onClose={() => setImportRolesOpen(false)} />
    </div>
  );
}
