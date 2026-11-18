import { useState, useMemo, useRef, useEffect } from "react";
import { toast } from "sonner";
import {
  Shield,
  Settings,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { getRoleDetail } from "../../data/role-detail-data";
import { SystemRoleLock } from "../shared/SystemRoleBadge";
import { LicenseBadge } from "../table-cells";
import type { RoleEditFormData } from "./edit-types";

/* ─── Shared classes ─── */
const inputCls =
  "w-full h-10 px-3.5 border border-[#E2E8F0] rounded-lg text-sm text-[#0F172A] bg-white focus:outline-none focus:ring-1 focus:ring-[#007FFF]/20 focus:border-[#007FFF] transition-all placeholder:text-[#94A3B8]";

/* ─── Sub-components ─── */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <label
      className="text-xs sm:text-[13px] text-[#0F172A] mb-1 block"
      style={{ fontWeight: 500 }}
    >
      {children}
    </label>
  );
}

/* ─── Section Card ─── */
function ModalSectionCard({
  title,
  icon: Icon,
  children,
  trailing,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-[#E2E8F0] bg-white overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <div className="px-3 sm:px-4 py-2 sm:py-2.5 border-b border-[#EEF2F6] flex items-center gap-2 bg-[#FAFBFC]">
        <div className="w-6 h-6 rounded-md bg-[#0A77FF]/8 flex items-center justify-center shrink-0">
          <Icon className="w-3.5 h-3.5 text-[#0A77FF]" />
        </div>
        <span
          className="text-xs sm:text-[13px] text-[#0F172A]"
          style={{ fontWeight: 600 }}
        >
          {title}
        </span>
        {trailing && <div className="ml-auto flex items-center gap-1.5">{trailing}</div>}
      </div>
      <div className="px-3 sm:px-4 py-3 sm:py-4">{children}</div>
    </div>
  );
}

/* ─── Helpers ─── */
function buildFormData(
  role: NonNullable<ReturnType<typeof getRoleDetail>>
): RoleEditFormData {
  return {
    roleName: role.roleName,
    description: role.description,
    status: role.status,
  };
}

function formDataEquals(a: RoleEditFormData, b: RoleEditFormData): boolean {
  return (
    a.roleName === b.roleName &&
    a.description === b.description &&
    a.status === b.status
  );
}

function countChanges(original: RoleEditFormData, current: RoleEditFormData): number {
  let count = 0;
  if (original.roleName !== current.roleName) count++;
  if (original.description !== current.description) count++;
  if (original.status !== current.status) count++;
  return count;
}

/* ─── Role Type Chip ─── */
function RoleTypeBadge({ isSystem }: { isSystem: boolean }) {
  const label = isSystem ? "Predefined Role" : "Custom Role";
  const bg = isSystem ? "#EDF4FF" : "#F0FDF4";
  const color = isSystem ? "#1D4ED8" : "#15803D";
  const border = isSystem ? "#BFDBFE" : "#BBF7D0";
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs border"
      style={{ backgroundColor: bg, color, borderColor: border, fontWeight: 500 }}
    >
      {label}
    </span>
  );
}

/* ═══════════════════════════════════════════ */
/* EditRoleModal                               */
/* ═══════════════════════════════════════════ */

interface EditRoleModalProps {
  open: boolean;
  onClose: () => void;
  roleId: number;
  /** Called when admin switches status to Inactive: modal closes first, then this fires to open deactivation confirmation */
  onDeactivate?: () => void;
}

export function EditRoleModal({ open, onClose, roleId, onDeactivate }: EditRoleModalProps) {
  const role = useMemo(() => getRoleDetail(roleId), [roleId]);

  const [formData, setFormData] = useState<RoleEditFormData>(() =>
    role ? buildFormData(role) : ({} as RoleEditFormData)
  );
  const originalFormData = useRef<RoleEditFormData>(
    role ? buildFormData(role) : ({} as RoleEditFormData)
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open && role) {
      const data = buildFormData(role);
      setFormData(data);
      originalFormData.current = data;
      setIsSaving(false);
    }
  }, [open, roleId]);

  if (!role) return null;

  const isDirty = !formDataEquals(formData, originalFormData.current);
  const changeCount = countChanges(originalFormData.current, formData);

  const isDraft = role.status === "Draft";
  const iconBg = role.status === "Active" ? "#EDF4FF" : "#FEF2F2";
  const iconColor = role.status === "Active" ? "#007FFF" : "#DC2626";

  const handleFieldChange = <K extends keyof RoleEditFormData>(
    key: K,
    value: RoleEditFormData[K]
  ) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!formData.roleName.trim()) {
      toast.error("Role name is required");
      return;
    }

    // If admin switched status from Active → Inactive, route through the
    // deactivation confirmation flow instead of saving directly. This ensures
    // the user-impact warning is always shown before deactivation.
    const isDeactivating =
      originalFormData.current.status === "Active" &&
      formData.status === "Inactive";

    if (isDeactivating) {
      onClose();
      // Small delay so the edit modal closes before the confirm modal opens
      setTimeout(() => {
        onDeactivate?.();
      }, 200);
      return;
    }

    setIsSaving(true);
    await new Promise((r) => setTimeout(r, 800));
    setIsSaving(false);
    toast.success(`${role.roleName} was updated.`, {
      description: `${changeCount} field${changeCount !== 1 ? "s" : ""} updated.`,
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent
        className="flex flex-col p-0 gap-0 overflow-hidden sm:rounded-2xl border-0 sm:border [&>button]:hidden"
        style={{
          maxWidth: 720,
          width: "calc(100% - 2rem)",
          maxHeight: "88vh",
          borderRadius: 16,
          boxShadow:
            "0 24px 80px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)",
        }}
      >
        <DialogTitle className="sr-only">Edit Role: {role.roleName}</DialogTitle>
        <DialogDescription className="sr-only">
          Edit role details for {role.roleName}
        </DialogDescription>

        {/* ── Header ── */}
        <div className="px-5 pt-4 pb-3 shrink-0 bg-white border-b border-[#E2E8F0] rounded-t-2xl">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: iconBg }}
              >
                <Shield className="w-5 h-5" style={{ color: iconColor }} />
              </div>
              <div className="min-w-0">
                <h2
                  className="text-[15px] sm:text-[17px] text-[#0F172A]"
                  style={{ fontWeight: 700 }}
                >
                  Edit {role.roleName}
                  {role.isSystem && (
                    <span className="ml-1.5 inline-flex align-middle">
                      <SystemRoleLock size={12} />
                    </span>
                  )}
                </h2>
                <p className="text-[12px] text-[#64748B] mt-0.5">
                  Update role configuration and status
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-[#F1F5F9] transition-colors cursor-pointer shrink-0"
            >
              <X className="w-4 h-4 text-[#94A3B8]" />
            </button>
          </div>
        </div>

        {/* ── Scrollable Body ── */}
        <div className="flex-1 overflow-y-auto px-3 sm:px-4 pt-3 pb-4 bg-[#FAFBFC] scrollbar-hide space-y-3">
          {/* ── Role Details ── */}
          <ModalSectionCard title="Role Details" icon={Shield} trailing={<><LicenseBadge license={role.licenseRequired} /><RoleTypeBadge isSystem={role.isSystem} /></>}>
            <div className="space-y-3">
              {/* Role Name */}
              <div>
                <SectionLabel>
                  Role Name <span className="text-[#EF4444]">*</span>
                </SectionLabel>
                <input
                  type="text"
                  value={formData.roleName}
                  onChange={(e) => handleFieldChange("roleName", e.target.value)}
                  placeholder="Enter role name"
                  className={inputCls}
                />
              </div>

              {/* Description */}
              <div>
                <SectionLabel>Description</SectionLabel>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    handleFieldChange("description", e.target.value)
                  }
                  placeholder="Describe what this role is responsible for..."
                  rows={3}
                  className="w-full px-3.5 py-2.5 border border-[#E2E8F0] rounded-lg text-sm text-[#0F172A] bg-white focus:outline-none focus:ring-1 focus:ring-[#007FFF]/20 focus:border-[#007FFF] transition-all placeholder:text-[#94A3B8] resize-none"
                />
              </div>

            </div>
          </ModalSectionCard>

          {/* ── Configuration: Status Tabs ── */}
          <ModalSectionCard title="Configuration" icon={Settings}>
            <div>
              <SectionLabel>Role Status</SectionLabel>
              {/* Draft is system-managed (ERP-5520 AC3): it leaves Draft only
                  when a permission is added, so no toggle is offered. */}
              {isDraft ? (
                <>
                  <span
                    className="inline-flex items-center mt-1 rounded-full border px-2.5 py-0.5 text-[11px] select-none"
                    style={{ fontWeight: 600, backgroundColor: "#F8FAFC", color: "#64748B", borderColor: "#E2E8F0" }}
                  >
                    Draft
                  </span>
                  <p
                    className="text-[11px] mt-2"
                    style={{ fontWeight: 400, color: "#64748B" }}
                  >
                    This role has no permissions yet, so it can't be used. It becomes Active automatically once you set up its permissions.
                  </p>
                </>
              ) : (
              <>
              <div className="flex mt-1 rounded-lg border border-[#E2E8F0] overflow-hidden bg-[#F8FAFC]">
                {(["Active", "Inactive"] as const).map((status) => {
                  const isActive = formData.status === status;
                  const label = status === "Inactive" ? "Deactivated" : status;
                  return (
                    <button
                      key={status}
                      type="button"
                      onClick={() => handleFieldChange("status", status)}
                      className="flex-1 h-9 text-[13px] transition-all cursor-pointer relative"
                      style={{
                        fontWeight: isActive ? 600 : 450,
                        color: isActive
                          ? status === "Active" ? "#007FFF" : "#DC2626"
                          : "#64748B",
                        backgroundColor: isActive
                          ? status === "Active" ? "#EDF4FF" : "#FEF2F2"
                          : "transparent",
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <p
                className="text-[11px] mt-2"
                style={{ fontWeight: 400, color: "#64748B" }}
              >
                {formData.status === "Active"
                  ? "This role can be assigned to users."
                  : "This role cannot be assigned to any users. Deactivating it removes it from all users who hold it."}
              </p>
              </>
              )}
            </div>
          </ModalSectionCard>
        </div>

        {/* ── Footer ── */}
        <div className="px-5 py-3 shrink-0 bg-white border-t border-[#E2E8F0] rounded-b-2xl flex items-center justify-between gap-3">
          <div className="text-[12px]" style={{ color: "#94A3B8", fontWeight: 400 }}>
            {isDirty ? (
              <span style={{ color: "#007FFF", fontWeight: 500 }}>
                {changeCount} unsaved change{changeCount !== 1 ? "s" : ""}
              </span>
            ) : (
              "No changes"
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 rounded-lg border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] text-[13px] text-[#334155] transition-colors cursor-pointer"
              style={{ fontWeight: 500 }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!isDirty || isSaving}
              className="h-9 px-5 rounded-lg bg-[#007FFF] hover:bg-[#0066D6] text-white text-[13px] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
              style={{ fontWeight: 600 }}
            >
              {isSaving ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
