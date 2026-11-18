import { useState } from "react";
import { X, Check, ChevronDown } from "lucide-react";
import { ModalShell } from "../shared/ModalShell";
import { LicenseRequirementChip } from "../shared/LicenseRequirementChip";
import type { RoleTemplate } from "./role-templates";
import {
  getTemplateDetail,
  getTemplateStats,
  type TemplateModule,
} from "../../data/role-template-details";

interface TemplateSummaryModalProps {
  open: boolean;
  onClose: () => void;
  template: RoleTemplate;
  onApply: () => void;
}

function ModuleAccordion({
  mod,
  isOpen,
  onToggle,
}: {
  mod: TemplateModule;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const open = isOpen;
  const ModIcon = mod.icon;

  return (
    <div
      className="rounded-lg overflow-hidden bg-white border border-[#E2E8F0]"
      style={{
        boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.03)",
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-label={`${open ? "Hide" : "Show"} ${mod.name} permissions`}
        className="w-full flex items-center gap-3 px-3.5 py-3 bg-white hover:bg-[#FAFBFC] transition-colors cursor-pointer"
      >
        <div
          className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
          style={{ backgroundColor: "#F1F5F9" }}
        >
          <ModIcon className="w-3.5 h-3.5 text-[#64748B]" />
        </div>
        <span
          className="text-[12.5px] text-[#0F172A] text-left"
          style={{ fontWeight: 550 }}
        >
          {mod.name}
        </span>
        <span
          className="inline-flex items-center px-1.5 py-px rounded-full text-[10.5px] text-[#64748B] bg-[#F1F5F9] border border-[#E2E8F0] tabular-nums"
          style={{ fontWeight: 500 }}
        >
          {mod.permissions.length}
        </span>
        <span className="flex-1" />
        {/* Chevron replaces the old "Show / Hide permissions" text link. The
         *  container gives it a target big enough to read as a control. */}
        <span
          className="w-6 h-6 rounded-[7px] bg-white border border-[#E2E8F0] flex items-center justify-center shrink-0"
          style={{ boxShadow: "0 1px 2px rgba(15,23,42,0.06)" }}
        >
          <ChevronDown
            className="w-3.5 h-3.5 text-[#64748B] transition-transform duration-200"
            style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
          />
        </span>
      </button>
      {/* 0fr → 1fr animates a variable-height body without measuring it, which
       *  the fixed per-row maxHeight could not do once rows became cards. */}
      <div
        className="grid transition-all duration-200 ease-in-out"
        style={{ gridTemplateRows: open ? "1fr" : "0fr", opacity: open ? 1 : 0 }}
      >
        <div className="overflow-hidden">
          <div
            className="border-t border-[#EEF2F6] px-2.5 py-2.5 space-y-2"
            style={{ backgroundColor: "#F1F5F9" }}
          >
            {mod.permissions.map((p) => (
              <div
                key={p.id}
                className="rounded-lg bg-white border border-[#E8ECF1] px-3 py-2.5"
                style={{ boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className="text-[12px] text-[#0F172A]"
                    style={{ fontWeight: 550 }}
                  >
                    {p.name}
                  </span>
                  <LicenseRequirementChip
                    tier={p.requiresFullAccess ? "Full Access" : "Field User"}
                    variant="bare"
                    size="xs"
                  />
                </div>
                <p
                  className="text-[11.5px] text-[#64748B] mt-1 leading-[1.5]"
                  style={{ fontWeight: 400 }}
                >
                  {p.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function TemplateSummaryModal({
  open,
  onClose,
  template,
  onApply,
}: TemplateSummaryModalProps) {
  const detail = getTemplateDetail(template.permissionIds);
  const stats = detail ? getTemplateStats(detail) : null;
  const [openModuleIdx, setOpenModuleIdx] = useState(0);

  if (!detail || !stats) return null;

  return (
    <ModalShell open={open} onClose={onClose} z={75}>
      <div
        className="bg-white flex flex-col overflow-hidden"
        style={{
          width: "100vw",
          maxWidth: 640,
          height: "100vh",
          maxHeight: "min(720px, calc(100vh - 48px))",
          borderRadius: 16,
          boxShadow:
            "0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)",
        }}
      >
        {/* Header: name, chip, description only */}
        <div className="px-5 pt-5 pb-4 shrink-0 border-b border-[#EEF2F6]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2
                  className="text-[16px] text-[#0F172A]"
                  style={{ fontWeight: 700 }}
                >
                  {template.name}
                </h2>
              </div>
              <p
                className="text-[12.5px] text-[#64748B] mt-1.5 leading-relaxed"
                style={{ fontWeight: 400 }}
              >
                {template.description}
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-[8px] flex items-center justify-center text-[#94A3B8] hover:text-[#64748B] hover:bg-[#F1F5F9] transition-colors cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Stats strip, in content area */}
          <div
            className="flex rounded-lg overflow-hidden"
            style={{ backgroundColor: "#F8FAFC", border: "1px solid #F1F5F9" }}
          >
            <div className="flex-1 px-3 py-2.5">
              <p
                className="text-[9px] uppercase tracking-wider mb-1"
                style={{ fontWeight: 650, color: "#94A3B8" }}
              >
                Permissions
              </p>
              <p
                className="text-[#0F172A]"
                style={{ fontSize: "17px", fontWeight: 650, lineHeight: 1 }}
              >
                {stats.totalPermissions}
              </p>
            </div>
            <div className="w-px" style={{ backgroundColor: "#E2E8F0" }} />
            <div className="flex-1 px-3 py-2.5">
              <p
                className="text-[9px] uppercase tracking-wider mb-1"
                style={{ fontWeight: 650, color: "#94A3B8" }}
              >
                Modules
              </p>
              <p
                className="text-[#0F172A]"
                style={{ fontSize: "17px", fontWeight: 650, lineHeight: 1 }}
              >
                {stats.moduleCount}
              </p>
            </div>
            <div className="w-px" style={{ backgroundColor: "#E2E8F0" }} />
            <div className="flex-1 px-3 py-2.5">
              <p
                className="text-[9px] uppercase tracking-wider mb-1"
                style={{ fontWeight: 650, color: "#94A3B8" }}
              >
                Requires
              </p>
              <div className="mt-0.5">
                <LicenseRequirementChip
                  tier={stats.requiredLicense}
                  variant="bare"
                  size="xs"
                />
              </div>
            </div>
          </div>

          {/* Module accordions */}
          <div className="space-y-2.5">
            <h3
              className="text-[12.5px] text-[#0F172A] mb-1"
              style={{ fontWeight: 600 }}
            >
              Modules & Permissions
            </h3>
            {detail.modules.map((m, i) => (
              <ModuleAccordion key={m.id} mod={m} isOpen={openModuleIdx === i} onToggle={() => setOpenModuleIdx(openModuleIdx === i ? -1 : i)} />
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 shrink-0 border-t border-[#EEF2F6] flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 rounded-[8px] border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] text-[13px] text-[#334155] transition-colors cursor-pointer"
            style={{ fontWeight: 500 }}
          >
            Close
          </button>
          <button
            type="button"
            onClick={onApply}
            className="h-9 px-5 rounded-[8px] bg-[#007FFF] hover:bg-[#0066D6] text-white text-[13px] transition-colors cursor-pointer inline-flex items-center gap-1.5"
            style={{ fontWeight: 600 }}
          >
            <Check className="w-3.5 h-3.5" />
            Select Template
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
