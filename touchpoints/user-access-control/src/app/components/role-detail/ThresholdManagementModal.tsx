import { useState, useEffect } from "react";
import {
  X,
  SlidersHorizontal,
  DollarSign,
  Percent,
  Hash,
  FileText,
  Check,
} from "lucide-react";
import type { ThresholdConfig } from "../../data/permissions-data";
import { ModalShell } from "../shared/ModalShell";

/* ─── Types ─── */
export interface RoleThresholdItem {
  permissionId: string;
  permissionName: string;
  moduleName: string;
  thresholdConfig: ThresholdConfig;
  currentValue: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  roleName: string;
  thresholds: RoleThresholdItem[];
  onSave?: (updated: { permissionId: string; value: string }[]) => void;
}

/* ─── Threshold type icon ─── */
function ThresholdIcon({ type }: { type: ThresholdConfig["type"] }) {
  const map = {
    monetary: { Icon: DollarSign, bg: "#ECFDF5", color: "#059669" },
    percentage: { Icon: Percent, bg: "#EDE9FE", color: "#7C3AED" },
    quantity: { Icon: Hash, bg: "#FFF7ED", color: "#D97706" },
    descriptive: { Icon: FileText, bg: "#F0F9FF", color: "#0284C7" },
  };
  const cfg = map[type] ?? map.descriptive;
  return (
    <div
      className="w-8 h-8 rounded-[8px] flex items-center justify-center shrink-0"
      style={{ backgroundColor: cfg.bg }}
    >
      <cfg.Icon className="w-4 h-4" style={{ color: cfg.color }} />
    </div>
  );
}

/* ─── Format display value ─── */
function formatDisplay(value: string, config: ThresholdConfig): string {
  if (!value) return "No limit";
  if (config.type === "descriptive") return config.label;
  const num = Number(value.replace(/,/g, ""));
  if (isNaN(num)) return value;
  const formatted = num.toLocaleString("en-US");
  if (config.unitPosition === "prefix") return `${config.unit}${formatted}`;
  return `${formatted}${config.unit}`;
}

export function ThresholdManagementModal({
  open,
  onClose,
  roleName,
  thresholds,
  onSave,
}: Props) {
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    const init: Record<string, string> = {};
    thresholds.forEach((t) => {
      init[t.permissionId] = t.currentValue;
    });
    setValues(init);
  }, [open, thresholds]);

  const handleSave = () => {
    const updated = Object.entries(values).map(([permissionId, value]) => ({
      permissionId,
      value,
    }));
    onSave?.(updated);
    onClose();
  };

  return (
    <ModalShell open={open} onClose={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-[540px] mx-4 overflow-hidden flex flex-col"
        style={{
          boxShadow:
            "0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)",
          maxHeight: "min(85vh, 680px)",
        }}
      >
          {/* Header */}
          <div className="px-5 pt-5 pb-4 shrink-0">
            <div className="flex items-start justify-between mb-1">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{
                    backgroundColor: "#F0F9FF",
                    border: "1px solid #BAE6FD",
                  }}
                >
                  <SlidersHorizontal
                    className="w-[18px] h-[18px]"
                    style={{ color: "#0284C7" }}
                  />
                </div>
                <div>
                  <h3
                    className="text-[15px] text-[#0F172A]"
                    style={{ fontWeight: 650 }}
                  >
                    Manage Thresholds
                  </h3>
                  <p
                    className="text-[12px] text-[#94A3B8] mt-0.5"
                    style={{ fontWeight: 420 }}
                  >
                    {roleName}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-[8px] flex items-center justify-center text-[#94A3B8] hover:text-[#64748B] hover:bg-black/5 transition-all cursor-pointer shrink-0 -mt-0.5 -mr-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Threshold list */}
          <div className="flex-1 overflow-y-auto px-5 pb-2">
            <div className="space-y-3">
              {thresholds.map((t) => {
                const isDescriptive = t.thresholdConfig.type === "descriptive";
                return (
                  <div
                    key={t.permissionId}
                    className="rounded-xl border px-4 py-3.5"
                    style={{
                      backgroundColor: "#FAFBFC",
                      borderColor: "#E2E8F0",
                    }}
                  >
                    {/* Top row: icon + permission info */}
                    <div className="flex items-start gap-3 mb-3">
                      <ThresholdIcon type={t.thresholdConfig.type} />
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-[13px] text-[#0F172A]"
                          style={{ fontWeight: 550 }}
                        >
                          {t.thresholdConfig.label}
                        </p>
                        <p
                          className="text-[11.5px] text-[#94A3B8] mt-0.5"
                          style={{ fontWeight: 420, lineHeight: 1.4 }}
                        >
                          {t.permissionName}{" "}
                          <span
                            className="text-[10.5px] px-1.5 py-px rounded-full ml-1"
                            style={{
                              backgroundColor: "#F1F5F9",
                              color: "#64748B",
                              fontWeight: 500,
                            }}
                          >
                            {t.moduleName}
                          </span>
                        </p>
                      </div>
                    </div>

                    {/* Input row */}
                    {isDescriptive ? (
                      <div
                        className="rounded-[8px] border px-3 py-2.5"
                        style={{
                          backgroundColor: "#F8FAFC",
                          borderColor: "#E2E8F0",
                        }}
                      >
                        <p
                          className="text-[12px]"
                          style={{
                            fontWeight: 450,
                            color: "#475569",
                            lineHeight: 1.5,
                          }}
                        >
                          {t.thresholdConfig.description}
                        </p>
                      </div>
                    ) : (
                      <div>
                        <div
                          className="flex items-center rounded-[8px] border bg-white overflow-hidden"
                          style={{ borderColor: "#E2E8F0" }}
                        >
                          {t.thresholdConfig.unitPosition === "prefix" && (
                            <span
                              className="px-3 py-2 text-[13px] border-r bg-[#F8FAFC] shrink-0"
                              style={{
                                fontWeight: 500,
                                color: "#64748B",
                                borderColor: "#E2E8F0",
                              }}
                            >
                              {t.thresholdConfig.unit}
                            </span>
                          )}
                          <input
                            type="text"
                            value={values[t.permissionId] ?? ""}
                            onChange={(e) => {
                              let val = e.target.value.replace(/[^0-9]/g, "");
                              setValues((prev) => ({
                                ...prev,
                                [t.permissionId]: val,
                              }));
                            }}
                            placeholder="No limit"
                            className="flex-1 px-3 py-2 text-[13px] text-[#0F172A] bg-white focus:outline-none placeholder:text-[#CBD5E1]"
                            style={{ fontWeight: 500 }}
                          />
                          {t.thresholdConfig.unitPosition === "suffix" && (
                            <span
                              className="px-3 py-2 text-[13px] border-l bg-[#F8FAFC] shrink-0"
                              style={{
                                fontWeight: 500,
                                color: "#64748B",
                                borderColor: "#E2E8F0",
                              }}
                            >
                              {t.thresholdConfig.unit}
                            </span>
                          )}
                        </div>
                        <p
                          className="text-[11px] mt-1.5 px-0.5"
                          style={{
                            fontWeight: 400,
                            color: "#94A3B8",
                            lineHeight: 1.45,
                          }}
                        >
                          {t.thresholdConfig.helperText}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}

              {thresholds.length === 0 && (
                <div className="py-8 text-center">
                  <SlidersHorizontal
                    className="w-8 h-8 mx-auto mb-3"
                    style={{ color: "#CBD5E1" }}
                  />
                  <p
                    className="text-[13px] text-[#94A3B8]"
                    style={{ fontWeight: 450 }}
                  >
                    No Thresholds Configured for This Role
                  </p>
                  <p
                    className="text-[12px] text-[#CBD5E1] mt-1"
                    style={{ fontWeight: 400 }}
                  >
                    Thresholds are set on specific permissions like purchase order limits and discount caps.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2.5 px-5 py-3.5 mt-1 border-t border-[#EEF2F6] bg-[#FAFBFC] shrink-0">
            <button
              onClick={onClose}
              className="h-9 px-4 rounded-[8px] border border-[#E2E8F0] bg-white text-[13px] text-[#64748B] hover:text-[#0F172A] hover:border-[#CBD5E1] transition-colors cursor-pointer"
              style={{ fontWeight: 500 }}
            >
              Cancel
            </button>
            {thresholds.length > 0 && (
              <button
                onClick={handleSave}
                className="h-9 px-4 rounded-[8px] bg-[#007FFF] hover:bg-[#0066D6] text-[13px] text-white transition-colors cursor-pointer shadow-sm"
                style={{ fontWeight: 600 }}
              >
                <span className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5" />
                  Save Thresholds
                </span>
              </button>
            )}
          </div>
        </div>
    </ModalShell>
  );
}
