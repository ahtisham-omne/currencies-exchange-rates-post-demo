import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { AlertTriangle, Shield, Search, ArrowRight } from "lucide-react";
import type { CreateRoleFormData } from "./types";
import { roleNameCollisionMessage } from "../../data/roles-row-store";
import {
  DEFAULT_ROLE_TEMPLATES,
  templateMatchesQuery,
  type RoleTemplate,
} from "./role-templates";
import { TemplateCard } from "./TemplateCard";
import { AllTemplatesModal } from "./AllTemplatesModal";
import { ModalShell } from "../shared/ModalShell";

interface Step1Props {
  formData: CreateRoleFormData;
  errors: Record<string, string>;
  onFieldChange: <K extends keyof CreateRoleFormData>(
    key: K,
    value: CreateRoleFormData[K]
  ) => void;
  hideTemplates?: boolean;
  /** Notifies the parent when the selected template changes so it can
   *  preselect (or clear) the Step 2 permission toggles. Null = no template. */
  onTemplateChange?: (template: RoleTemplate | null) => void;
  /** True when the admin has already toggled permissions by hand. Picking a
   *  template then warns first, because applying one replaces that work. */
  permissionsHandEdited?: boolean;
  /** True when the flow arrived with everything pre-filled EXCEPT the name,
   *  which the creator must supply (the Duplicate-role flow). Seeds the same
   *  "Enter Role Name" highlight that picking a template raises. */
  requireOwnName?: boolean;
}

/* ─── Shared input styles ─── */
const inputClass =
  "w-full h-9 sm:h-10 px-3.5 border rounded-[8px] text-sm text-[#0F172A] bg-white shadow-xs focus:outline-none focus:ring-1 focus:ring-[#007FFF]/20 focus:border-[#007FFF] transition-all placeholder:text-[#94A3B8]";
const labelClass = "block text-xs sm:text-[13px] text-[#0F172A]";
const errorClass = "text-[#EF4444] text-xs mt-1";

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <span className={labelClass} style={{ fontWeight: 500 }}>
      {label}
      {required && <span className="text-[#EF4444] ml-0.5">*</span>}
    </span>
  );
}

/* ─── Uniqueness ───
 *
 * Same treatment the Create User flow gives a duplicate Primary System Email:
 * an amber inline alert while typing, and a hard block on submit (enforced in
 * CreateRoleModal.validateStep1). The rule itself lives in
 * `roleNameCollisionMessage`, which the unarchive stepper and the roles import
 * cross-check share, so the listing, the import, and every form agree on what
 * counts as taken, archived rows included. */
function RoleNameDuplicateAlert({ message }: { message: string }) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, height: 0, y: -4 }}
        animate={{ opacity: 1, height: "auto", y: 0 }}
        exit={{ opacity: 0, height: 0, y: -4 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="mt-1.5"
      >
        <div className="flex items-start gap-2 px-3 py-2 rounded-[8px] bg-[#FEF3C7] border border-[#F59E0B]/30">
          <AlertTriangle className="w-3.5 h-3.5 text-[#D97706] shrink-0 mt-0.5" />
          <span className="text-xs text-[#92400E] leading-snug" style={{ fontWeight: 500 }}>
            {message}
          </span>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export function checkRoleNameUnique(name: string): string | null {
  return roleNameCollisionMessage(name);
}

/* ─── Role Templates ───
 *
 * The library itself lives in ./role-templates: the locked set of 12, with
 * their permission names resolved against the catalog. This step shows the
 * compact subset; "Show All Templates" opens the full library. */
const ROLE_TEMPLATES = DEFAULT_ROLE_TEMPLATES;

/* ─── Overwrite confirmation ───
 *
 * Applying a template replaces the whole working permission set, so once the
 * admin has toggled permissions themselves they get asked first. Same shell,
 * button order, and copy weight as the wizard's other two-choice dialogs. */
function TemplateOverwriteDialog({
  open,
  templateName,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  templateName: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <ModalShell open={open} onClose={onCancel} z={80}>
      <div
        className="bg-white flex flex-col overflow-hidden"
        style={{
          width: "100%",
          maxWidth: 440,
          borderRadius: 16,
          boxShadow: "0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)",
        }}
      >
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-[10px] bg-[#FEF3C7] flex items-center justify-center shrink-0">
              <AlertTriangle className="w-[18px] h-[18px] text-[#D97706]" />
            </div>
            <div className="min-w-0">
              <h2 className="text-[15px] text-[#0F172A]" style={{ fontWeight: 650 }}>
                Replace your selected permissions?
              </h2>
              <p className="text-[12.5px] text-[#64748B] mt-1.5 leading-relaxed" style={{ fontWeight: 400 }}>
                Selecting a template replaces the permissions you have already selected.
                {templateName ? ` ${templateName} will be applied instead.` : ""}
              </p>
            </div>
          </div>
        </div>
        <div className="px-5 py-3.5 border-t border-[#EEF2F6] flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-9 px-4 rounded-[8px] border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] text-[13px] text-[#334155] transition-colors cursor-pointer"
            style={{ fontWeight: 500 }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="h-9 px-5 rounded-[8px] bg-[#007FFF] hover:bg-[#0066D6] text-white text-[13px] transition-colors cursor-pointer"
            style={{ fontWeight: 600 }}
          >
            Continue
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

/* ─── Component ─── */

export function Step1RoleBasicInfo({
  formData,
  errors,
  onFieldChange,
  hideTemplates,
  onTemplateChange,
  permissionsHandEdited = false,
  requireOwnName = false,
}: Step1Props) {
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [templateSearch, setTemplateSearch] = useState("");
  const [allTemplatesOpen, setAllTemplatesOpen] = useState(false);
  /* Selecting a template pre-fills permissions/description but NOT the role
   *  name, the creator must name it. Surface the same missing-field error the
   *  Create User flow uses for a missing primary email.
   *
   *  Seeded true for the Duplicate flow, which arrives with the description and
   *  permissions inherited and the name deliberately blank — so the field is
   *  flagged from the moment the modal opens, exactly as it is after picking a
   *  template. */
  const [templateNameError, setTemplateNameError] = useState(requireOwnName);
  const showNameError = !!errors.roleName || (templateNameError && !formData.roleName.trim());

  /* Live duplicate check while typing. Blank is not a duplicate — the missing
   *  name is the empty-field error above, a different message. */
  const nameDuplicate = checkRoleNameUnique(formData.roleName);

  /* Templates the admin is about to overwrite hand-picked permissions with.
   *  Held until they confirm, then applied. */
  const [pendingTemplate, setPendingTemplate] = useState<RoleTemplate | null>(null);

  const filteredTemplates = useMemo(
    () => ROLE_TEMPLATES.filter((t) => templateMatchesQuery(t, templateSearch)),
    [templateSearch]
  );

  /* Applies a template outright. Selecting a different template replaces the
   *  previous pre-fill rather than merging the two sets, which is what
   *  onTemplateChange does upstream: it rebuilds the toggle map from this
   *  template alone. */
  const commitTemplate = (t: RoleTemplate) => {
    setSelectedTemplate(t.name);
    // Do NOT auto-fill the role name, the creator names their own role.
    onFieldChange("description", t.description);
    setTemplateNameError(true);
    onTemplateChange?.(t);
  };

  /* Clearing the selection resets the description and unchecks everything the
   *  template had checked, which returns Step 2 to its default state. */
  const clearTemplate = () => {
    setSelectedTemplate(null);
    onFieldChange("description", "");
    setTemplateNameError(false);
    onTemplateChange?.(null);
  };

  const applyTemplate = (t: RoleTemplate) => {
    if (selectedTemplate === t.name) {
      clearTemplate();
      return;
    }
    if (permissionsHandEdited) {
      setPendingTemplate(t);
      return;
    }
    commitTemplate(t);
  };

  const handleNameChange = (val: string) => {
    onFieldChange("roleName", val);
    if (val.trim()) setTemplateNameError(false);
  };

  const handleDescChange = (val: string) => {
    onFieldChange("description", val);
    if (
      selectedTemplate &&
      val !==
        ROLE_TEMPLATES.find((t) => t.name === selectedTemplate)?.description
    ) {
      // Editing the description only un-highlights the template; the permissions
      // it preselected stay as the working set the admin can adjust in Step 2.
      setSelectedTemplate(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Role Details Card */}
      <div className="rounded-[8px] border border-[#E2E8F0] bg-white overflow-visible shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
        <div className="px-3 sm:px-4 py-2 sm:py-2.5 border-b border-[#EEF2F6] flex items-center gap-2 bg-[#FAFBFC]">
          <div className="w-6 h-6 rounded-md bg-[#007FFF]/8 flex items-center justify-center shrink-0">
            <Shield className="w-3.5 h-3.5 text-[#007FFF]" />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs sm:text-[13px] text-[#0F172A]" style={{ fontWeight: 600 }}>Role Details</span>
            <span className="text-[9px] sm:text-[10px] text-[#94A3B8] tracking-wider uppercase hidden min-[480px]:inline" style={{ fontWeight: 500 }}>Required</span>
          </div>
        </div>
        <div className="px-3 sm:px-4 py-3 sm:py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="mb-1.5">
                <FieldLabel label="Role Name" required />
              </div>
              <input
                type="text"
                value={formData.roleName}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g. Warehouse Manager"
                className={`${inputClass} ${
                  nameDuplicate
                    ? "border-[#F59E0B] focus:ring-[#F59E0B]/20 focus:border-[#F59E0B]"
                    : showNameError
                      ? "border-[#EF4444] focus:ring-red-200 focus:border-[#EF4444]"
                      : "border-[#E2E8F0]"
                }`}
              />
              {nameDuplicate && <RoleNameDuplicateAlert message={nameDuplicate} />}
              {showNameError && !nameDuplicate && (
                <p className={errorClass}>{errors.roleName || "Enter Role Name"}</p>
              )}
            </div>

            <div>
              <div className="mb-1.5">
                <FieldLabel label="Description" />
              </div>
              <textarea
                value={formData.description}
                onChange={(e) => handleDescChange(e.target.value)}
                placeholder="Describe what this role is responsible for and what access it grants..."
                rows={3}
                className="w-full px-3.5 py-2.5 border border-[#E2E8F0] rounded-[8px] text-sm text-[#0F172A] bg-white shadow-xs focus:outline-none focus:ring-1 focus:ring-[#007FFF]/20 focus:border-[#007FFF] transition-all placeholder:text-[#94A3B8] resize-none"
              />
            </div>
          </div>
        </div>
      </div>

      {!hideTemplates && (
        <div className="relative flex items-center py-1">
          <div className="flex-1 border-t border-[#E2E8F0]" />
          <span className="px-3 text-[12px] text-[#94A3B8]" style={{ fontWeight: 480 }}>
            Or quick-start from a template
          </span>
          <div className="flex-1 border-t border-[#E2E8F0]" />
        </div>
      )}

      {!hideTemplates && (
        <div className="rounded-xl border border-[#E2E8F0] overflow-hidden bg-[#FAFBFC]">
          {/* Header: search + Show All Templates link */}
          <div className="flex items-center justify-between gap-3 px-3 sm:px-4 py-2.5 border-b border-[#E2E8F0] bg-white">
            <div className="relative w-full sm:w-1/3 max-w-[33%]">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                style={{ color: "#CBD5E1" }}
              />
              <input
                type="text"
                value={templateSearch}
                onChange={(e) => setTemplateSearch(e.target.value)}
                placeholder="Search templates..."
                className="w-full h-9 pl-9 pr-3 border border-[#E2E8F0] rounded-[8px] text-sm text-[#0F172A] bg-white shadow-xs focus:outline-none focus:ring-1 focus:ring-[#007FFF]/20 focus:border-[#007FFF] transition-all placeholder:text-[#94A3B8]"
              />
            </div>
            <button
              type="button"
              onClick={() => setAllTemplatesOpen(true)}
              className="inline-flex items-center gap-1 text-[12.5px] text-[#007FFF] hover:text-[#0066D6] transition-colors cursor-pointer shrink-0"
              style={{ fontWeight: 500 }}
            >
              Show All Templates
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Content */}
          <div className="px-3 sm:px-4 py-3 sm:py-4 bg-white">
            <p className="text-[12.5px] text-[#64748B] leading-[1.6] mb-3" style={{ fontWeight: 420 }}>
              Selecting a template pre-fills the description and permissions. Give the role its own name to continue. The required license is determined by the permissions included, and everything can be changed before creation.
            </p>

            {filteredTemplates.length === 0 ? (
              <p className="text-center text-[12.5px] text-[#94A3B8] py-6">
                No templates match "{templateSearch}"
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredTemplates.map((t) => (
                  <TemplateCard
                    key={t.name}
                    template={t}
                    isSelected={selectedTemplate === t.name}
                    searchQuery={templateSearch}
                    onClick={() => applyTemplate(t)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <AllTemplatesModal
        open={allTemplatesOpen}
        onClose={() => setAllTemplatesOpen(false)}
        selectedTemplateName={selectedTemplate}
        onApply={(t) => {
          // Same overwrite guard as the compact cards. The name is never
          // auto-filled, so the "Enter Role Name" error surfaces either way.
          if (permissionsHandEdited) setPendingTemplate(t);
          else commitTemplate(t);
        }}
      />

      <TemplateOverwriteDialog
        open={!!pendingTemplate}
        templateName={pendingTemplate?.name ?? ""}
        onCancel={() => setPendingTemplate(null)}
        onConfirm={() => {
          if (pendingTemplate) commitTemplate(pendingTemplate);
          setPendingTemplate(null);
        }}
      />
    </div>
  );
}
