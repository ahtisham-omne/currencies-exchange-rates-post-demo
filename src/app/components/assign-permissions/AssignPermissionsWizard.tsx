import { useCallback, useEffect, useMemo, useState } from "react";
import {
  X,
  Check,
  KeyRound,
  Eye,
  ChevronDown,
  ArrowRight,
  ShieldCheck,
  LayoutTemplate,
  Maximize2,
  Minimize2,
} from "lucide-react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { toast } from "sonner";
import { Checkbox } from "../ui/checkbox";
import { cn } from "../ui/utils";
import { roles, roleNameToOptionId } from "../../data/roles-data";
import { getRolePermissions } from "../../data/role-permissions-map";
import { applyRolePermissions } from "../../data/roles-row-store";
import { buildEmptyToggles } from "../../data/permissions-data";
import { computeRoleTier } from "../../lib/permission-tier";
import { DEFAULT_ROLE_TEMPLATES, type RoleTemplate } from "../create-role/role-templates";
import { Step2RolePermissions } from "../create-role/Step2RolePermissions";
import { TemplateSummaryModal } from "../create-role/TemplateSummaryModal";
import { AllTemplatesModal } from "../create-role/AllTemplatesModal";
import { LicenseRequirementChip } from "../shared/LicenseRequirementChip";
import { ExpandableDescription } from "../shared/ExpandableDescription";
import {
  closeAssignPermissions,
  useAssignPermissionsTarget,
} from "./assignPermissionsStore";

/* Templates surfaced directly in the "Use a Template" accordion: the compact
 * set the Create Role step shows, trimmed to the five slots this grid has. The
 * rest of the 12 are reachable via "Show All Templates". */
const TOP_TEMPLATES = DEFAULT_ROLE_TEMPLATES.slice(0, 5);

/* ── helpers ── */

type Toggles = Record<string, boolean>;

function countOn(t: Toggles): number {
  let n = 0;
  for (const v of Object.values(t)) if (v) n++;
  return n;
}

/** A template's permission set as a toggle map: its own permissions on,
 *  everything else off. Applying a template replaces the working set rather
 *  than merging into it. */
function togglesFromTemplate(t: RoleTemplate): Toggles {
  return buildEmptyToggles(t.permissionIds);
}

/* ── component ── */

export function AssignPermissionsWizard() {
  const target = useAssignPermissionsTarget();
  return target ? <WizardBody key={target.roleIds.join(",")} /> : null;
}

function WizardBody() {
  const target = useAssignPermissionsTarget();
  const roleIds = useMemo(() => target?.roleIds ?? [], [target]);

  /* Resolve the roles once. If one vanished (edge), drop it. */
  const roleList = useMemo(
    () =>
      roleIds
        .map((id) => roles.find((r) => r.id === id))
        .filter((r): r is (typeof roles)[number] => !!r),
    [roleIds],
  );

  /* Working (unsaved) toggle map per role, seeded from whatever each role
   * already grants (usually nothing, for a freshly imported Draft). */
  const [working, setWorking] = useState<Record<number, Toggles>>(() => {
    const seed: Record<number, Toggles> = {};
    for (const r of roleList) {
      seed[r.id] = buildEmptyToggles(getRolePermissions(roleNameToOptionId(r.roleName)));
    }
    return seed;
  });

  /* Ids that have been persisted (are "ready"). Seed with any role that
   * already has permissions, so reopening the flow reflects prior work. */
  const [saved, setSaved] = useState<Set<number>>(() => {
    const s = new Set<number>();
    for (const r of roleList) {
      if (getRolePermissions(roleNameToOptionId(r.roleName)).length > 0) s.add(r.id);
    }
    return s;
  });

  const firstUnsaved = roleList.find((r) => !saved.has(r.id))?.id ?? roleList[0]?.id ?? null;
  const [selectedId, setSelectedId] = useState<number | null>(firstUnsaved);

  /* Batch selection in the left rail. When roles are checked, edits made in the
   * right-hand panel (template pick or permission toggles) apply to every
   * checked role at once, plus the active one. */
  const [batch, setBatch] = useState<Set<number>>(new Set());

  /* Select-all state for the left-rail header, mirroring the Permissions
   * modal's bulk-select row. */
  const allChecked = roleList.length > 0 && roleList.every((r) => batch.has(r.id));
  const someChecked = batch.size > 0 && !allChecked;
  const toggleAllBatch = useCallback(() => {
    setBatch((prev) => (prev.size >= roleList.length ? new Set() : new Set(roleList.map((r) => r.id))));
  }, [roleList]);

  /* Full-view toggle, mirroring the Create User modal. */
  const [isFullScreen, setIsFullScreen] = useState(false);

  /* "Use a Template" accordion, open by default. */
  const [templatesOpen, setTemplatesOpen] = useState(true);

  /* Template applied per role (drives the selected radio in the accordion). */
  const [templateByRole, setTemplateByRole] = useState<Record<number, string>>({});

  /* Template-detail summary (eye icon) + full library ("Show All Templates"). */
  const [summaryTemplate, setSummaryTemplate] = useState<RoleTemplate | null>(null);
  const [allTemplatesOpen, setAllTemplatesOpen] = useState(false);

  const selectedRole = roleList.find((r) => r.id === selectedId) ?? null;
  const selectedToggles = selectedId != null ? working[selectedId] ?? {} : {};
  const selectedCount = countOn(selectedToggles);
  const selectedTier = computeRoleTier(selectedToggles);

  const readyCount = saved.size;
  const total = roleList.length;

  /* Apply a toggle map to the active role and, when a batch is checked, to
   * every checked role too, so edits fan out across the whole selection. */
  const applyToggles = useCallback(
    (activeId: number, next: Toggles) => {
      const targets = batch.size > 0 ? new Set<number>([activeId, ...batch]) : new Set<number>([activeId]);
      setWorking((prev) => {
        const updated = { ...prev };
        for (const id of targets) updated[id] = next;
        return updated;
      });
    },
    [batch],
  );

  /* Persist one role: writes its permission set, flips Draft → Active, and
   * derives its license. Only persists when it actually has permissions. */
  const persist = useCallback((roleId: number) => {
    const t = working[roleId];
    if (!t) return false;
    const ids = Object.keys(t).filter((id) => t[id]);
    if (ids.length === 0) return false;
    applyRolePermissions(roleId, ids);
    setSaved((prev) => new Set(prev).add(roleId));
    return true;
  }, [working]);

  /* Save the active role plus every checked role. No auto-advance — the user
   * picks the next role themselves. A success toast confirms the result. */
  const handleSave = useCallback(() => {
    if (selectedId == null) return;
    const targets = batch.size > 0 ? Array.from(new Set([selectedId, ...batch])) : [selectedId];
    const savedNames: string[] = [];
    targets.forEach((id) => {
      if (persist(id)) {
        const role = roleList.find((r) => r.id === id);
        if (role) savedNames.push(role.roleName);
      }
    });
    if (savedNames.length > 0) {
      const n = savedNames.length;
      toast.success(
        n === 1
          ? `${savedNames[0]} has been assigned permissions and is ready to use.`
          : `${n} roles have been assigned permissions and are ready to use.`,
      );
    }
    if (batch.size > 0) setBatch(new Set());
  }, [selectedId, batch, persist, roleList]);

  /* Apply a template to the active role (and any checked roles); remember it so
   * the accordion's radio reflects the current choice. */
  const selectTemplate = useCallback(
    (roleId: number, t: RoleTemplate) => {
      applyToggles(roleId, togglesFromTemplate(t));
      const targets = batch.size > 0 ? new Set<number>([roleId, ...batch]) : new Set<number>([roleId]);
      setTemplateByRole((prev) => {
        const updated = { ...prev };
        for (const id of targets) updated[id] = t.name;
        return updated;
      });
    },
    [applyToggles, batch],
  );

  /* Close the flow. Per-role permission sets are persisted the moment you
   * "Save & next", so there is nothing to flush here: it is either set up now
   * or not at all. Roles left without permissions stay Draft. */
  const handleClose = useCallback(() => {
    closeAssignPermissions();
  }, []);

  /* Esc closes. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleClose]);

  if (roleList.length === 0) return null;

  const currentTemplate = selectedRole ? templateByRole[selectedRole.id] : undefined;

  return (
    // z-[55]: sits above the page and the sidebar hover overlay (z-50) yet below
    // this modal's own children — the per-module permission modal and the
    // template modals (ModalShell z=60) and the density dropdown (z-[120]) — so
    // they open in front of the wizard rather than behind it.
    <div className="fixed inset-0 z-[55] flex items-center justify-center p-4" style={{ background: "rgba(15,23,42,0.55)" }}>
      <div
        className={cn(
          "flex flex-col w-full bg-white overflow-hidden shadow-2xl transition-[max-width,height,border-radius] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
          isFullScreen ? "max-w-full rounded-xl" : "max-w-[1180px] rounded-2xl",
        )}
        style={{ height: isFullScreen ? "calc(100vh - 2rem)" : "min(88vh, 860px)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b" style={{ borderColor: "#EEF2F6" }}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "#EFF6FF" }}>
              <KeyRound className="w-[18px] h-[18px]" style={{ color: "#0A77FF" }} />
            </div>
            <div className="min-w-0">
              <h2 className="text-[15px] truncate" style={{ fontWeight: 600, color: "#0F172A" }}>
                Set Up Permissions
              </h2>
              <p className="text-[12.5px]" style={{ color: "#64748B" }}>
                Roles without permissions stay in Draft.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsFullScreen((v) => !v)}
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] border border-[#E2E8F0] bg-white text-xs text-[#475569] hover:bg-[#F8FAFC] hover:border-[#CBD5E1] transition-colors cursor-pointer"
              style={{ fontWeight: 500 }}
            >
              {isFullScreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              {isFullScreen ? "Exit full" : "Full view"}
            </button>
            <button
              type="button"
              onClick={handleClose}
              aria-label="Close"
              className="w-8 h-8 rounded-[8px] flex items-center justify-center text-[#94A3B8] hover:text-[#64748B] hover:bg-[#F1F5F9] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Left rail */}
          <aside className="w-[288px] shrink-0 border-r flex flex-col" style={{ borderColor: "#EEF2F6", backgroundColor: "#FBFCFE" }}>
            <div className="px-3.5 py-2.5 flex items-center gap-3">
              <Checkbox
                checked={allChecked ? true : someChecked ? "indeterminate" : false}
                onCheckedChange={toggleAllBatch}
                aria-label="Select all roles"
              />
              <span className="text-sm text-gray-600" style={{ fontWeight: 500 }}>
                {batch.size > 0
                  ? `Selected ${batch.size} Role${batch.size === 1 ? "" : "s"}`
                  : `Showing ${total} Role${total === 1 ? "" : "s"}`}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto px-3 pt-2.5 pb-3 flex flex-col gap-2.5">
              {roleList.map((r) => {
                const isReady = saved.has(r.id);
                const count = countOn(working[r.id] ?? {});
                const isActive = r.id === selectedId;
                const checked = batch.has(r.id);
                return (
                  <div key={r.id} className="relative">
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedId(r.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelectedId(r.id);
                        }
                      }}
                      className={cn(
                        "w-full relative flex items-center gap-3 px-3.5 py-3 rounded-lg text-left transition-all duration-200 cursor-pointer border",
                        isActive
                          ? "bg-[#F0F7FF] border-[#0E69E2]/40 shadow-sm"
                          : checked
                          ? "bg-[#F0F7FF] border-[#0E69E2]/30 shadow-sm"
                          : "bg-white border-gray-200 shadow-sm hover:bg-gray-50"
                      )}
                    >
                      <div onClick={(e) => e.stopPropagation()} className="shrink-0">
                        <CheckboxPrimitive.Root
                          checked={checked}
                          onCheckedChange={(v) => {
                            setBatch((prev) => {
                              const n = new Set(prev);
                              if (v) n.add(r.id); else n.delete(r.id);
                              return n;
                            });
                          }}
                          className={cn(
                            "w-[18px] h-[18px] border rounded flex items-center justify-center transition-colors",
                            checked ? "bg-[#0E69E2] border-[#0E69E2]" : "bg-white border-gray-300"
                          )}
                          aria-label={`Select ${r.roleName}`}
                        >
                          <CheckboxPrimitive.Indicator className="text-white">
                            <Check size={12} strokeWidth={3} />
                          </CheckboxPrimitive.Indicator>
                        </CheckboxPrimitive.Root>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] truncate" style={{ fontWeight: isActive ? 600 : 550, color: "#0F172A" }}>
                          {r.roleName}
                        </div>
                        <div className="text-[11.5px] mt-0.5" style={{ color: isReady ? "#059669" : "#94A3B8", fontWeight: isReady ? 500 : 400 }}>
                          {isReady
                            ? `${count} permission${count === 1 ? "" : "s"} assigned`
                            : count > 0
                            ? `${count} selected`
                            : "No permissions yet"}
                        </div>
                      </div>
                    </div>

                    {/* Arrow indicator pointing to the right panel (active card) */}
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
            </div>
          </aside>

          {/* Main panel */}
          <main className="flex-1 min-w-0 flex flex-col">
            {selectedRole && (
              <>
                <div className="px-5 pt-4 pb-3 border-b" style={{ borderColor: "#EEF2F6" }}>
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-[15px] truncate" style={{ fontWeight: 600, color: "#0F172A" }}>
                          {selectedRole.roleName}
                        </h3>
                        {saved.has(selectedRole.id) ? (
                          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full" style={{ fontWeight: 600, backgroundColor: "#ECFDF5", color: "#059669", border: "1px solid #A7F3D0" }}>
                            <ShieldCheck className="w-3 h-3" /> Ready
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-[11px] px-2 py-0.5 rounded-full" style={{ fontWeight: 600, backgroundColor: "#F8FAFC", color: "#64748B", border: "1px solid #E2E8F0" }}>
                            Draft
                          </span>
                        )}
                      </div>
                      {selectedRole.description && (
                        <ExpandableDescription
                          maxExpandedLines={8}
                          text={selectedRole.description}
                          className="text-[12.5px] mt-0.5 max-w-[520px]"
                          style={{ color: "#64748B" }}
                        />
                      )}
                    </div>
                    <div className="flex items-center gap-2.5">
                      <span className="text-[12.5px]" style={{ color: "#64748B" }}>
                        {selectedCount} selected
                      </span>
                      {selectedCount > 0 && <LicenseRequirementChip tier={selectedTier} size="sm" />}
                    </div>
                  </div>

                  {/* Use a Template: collapsible container styled like the
                      Exports modal's "File format" card (white fill, slate-50
                      header, divider, content). Collapsed by default. */}
                  <div
                    className="mt-3 rounded-[12px] border bg-white overflow-hidden"
                    style={{ borderColor: "#E2E8F0", boxShadow: "0 1px 2px 0 rgba(15,23,42,0.04), 0 2px 8px -2px rgba(15,23,42,0.08)" }}
                  >
                    <button
                      type="button"
                      onClick={() => setTemplatesOpen((o) => !o)}
                      aria-expanded={templatesOpen}
                      className="w-full px-4 py-3 flex items-center gap-2 cursor-pointer transition-colors hover:bg-[#F1F5F9]"
                      style={{ backgroundColor: "#F8FAFC" }}
                    >
                      <LayoutTemplate className="w-4 h-4 shrink-0" style={{ color: "#64748B" }} />
                      <h3 className="text-[14px] flex-1 text-left" style={{ color: "#0F172A", fontWeight: 600 }}>
                        Use a Template
                      </h3>
                      <ChevronDown
                        className="w-4 h-4 shrink-0 transition-transform duration-200"
                        style={{ color: "#94A3B8", transform: templatesOpen ? "rotate(180deg)" : "none" }}
                      />
                    </button>
                    {templatesOpen && (
                      <>
                        <div className="border-t" style={{ borderColor: "#E2E8F0" }} />
                        <div className="px-4 py-3.5">
                          <div className="grid grid-cols-3 gap-2">
                            {TOP_TEMPLATES.map((t) => {
                              const isSel = currentTemplate === t.name;
                              return (
                                <div
                                  key={t.name}
                                  role="button"
                                  tabIndex={0}
                                  onClick={() => selectTemplate(selectedRole.id, t)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                      e.preventDefault();
                                      selectTemplate(selectedRole.id, t);
                                    }
                                  }}
                                  className="flex items-center gap-2 pl-2.5 pr-1.5 py-2 rounded-[6px] border cursor-pointer transition-colors"
                                  style={{
                                    borderColor: isSel ? "#007FFF" : "#E2E8F0",
                                    backgroundColor: isSel ? "#F0F7FF" : "#fff",
                                  }}
                                >
                                  <span
                                    className="shrink-0 w-4 h-4 rounded-full border-[1.5px] flex items-center justify-center"
                                    style={{ borderColor: isSel ? "#007FFF" : "#CBD5E1" }}
                                  >
                                    {isSel && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: "#007FFF" }} />}
                                  </span>
                                  <span className="flex-1 min-w-0 truncate text-[12.5px]" style={{ fontWeight: 500, color: "#0F172A" }} title={t.name}>
                                    {t.name}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setSummaryTemplate(t); }}
                                    aria-label={`View ${t.name} details`}
                                    className="shrink-0 w-6 h-6 rounded-[6px] flex items-center justify-center text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#334155] transition-colors cursor-pointer"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              );
                            })}

                            {/* Show All Templates opens the full library modal.
                                Neutral slate by default, blue on hover. */}
                            <button
                              type="button"
                              onClick={() => setAllTemplatesOpen(true)}
                              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-[6px] border text-[12.5px] transition-colors cursor-pointer bg-[#F8FAFC] border-[#E2E8F0] text-[#475569] hover:bg-[#EFF6FF] hover:border-[#BFDBFE] hover:text-[#2563EB]"
                              style={{ fontWeight: 600 }}
                            >
                              Show All Templates
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <p className="text-[11.5px] mt-2.5" style={{ color: "#94A3B8" }}>
                            Pick a starting point, then fine-tune below. The required license is worked out from the permissions you enable.
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Permission grid */}
                <div className="flex-1 overflow-y-auto px-5 py-4">
                  <Step2RolePermissions
                    permissionToggles={selectedToggles}
                    onPermissionTogglesChange={(next) => applyToggles(selectedRole.id, next)}
                  />
                </div>
              </>
            )}
          </main>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t" style={{ borderColor: "#EEF2F6", backgroundColor: "#FBFCFE" }}>
          <p className="text-[12.5px]" style={{ color: "#64748B" }}>
            {readyCount} of {total} {total === 1 ? "role" : "roles"} ready
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="h-9 px-3.5 rounded-lg text-[13px] border transition-colors cursor-pointer hover:bg-[#F1F5F9]"
              style={{ fontWeight: 500, borderColor: "#E2E8F0", color: "#334155", backgroundColor: "#fff" }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={selectedCount === 0}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-[13px] text-white transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ fontWeight: 600, backgroundColor: "#0A77FF" }}
            >
              Save
            </button>
          </div>
        </div>
      </div>

      {/* Template detail (eye icon) — reuses the Create Role "View Summary" modal.
          Applying it seeds the current role from the template. */}
      {summaryTemplate && (
        <TemplateSummaryModal
          open
          template={summaryTemplate}
          onClose={() => setSummaryTemplate(null)}
          onApply={() => {
            if (selectedRole) selectTemplate(selectedRole.id, summaryTemplate);
            setSummaryTemplate(null);
          }}
        />
      )}

      {/* Full template library — reuses the Create Role "Browse Role Templates" modal. */}
      <AllTemplatesModal
        open={allTemplatesOpen}
        onClose={() => setAllTemplatesOpen(false)}
        selectedTemplateName={currentTemplate ?? null}
        onApply={(t) => {
          if (selectedRole) selectTemplate(selectedRole.id, t);
          setAllTemplatesOpen(false);
        }}
      />
    </div>
  );
}
