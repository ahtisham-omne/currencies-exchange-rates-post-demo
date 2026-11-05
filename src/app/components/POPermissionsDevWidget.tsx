/* ═══════════════════════════════════════════════════════════════
   PO PERMISSIONS DEV WIDGET  (dev / QA tool)

   Top-bar picker for the Purchase Orders module. The v2 revision
   dropped the persona shortcut list per buyer feedback 2026-08-03:
   "I need to see only advanced and the mechanics we have will work" —
   the seven granular toggles are what the design team wants to interact
   with; canned personas were noise.

   Persona helpers (`applyPOPersona`, `PO_PERSONAS`) stay in the store
   so future callers can still pre-seed a role, they're just not
   surfaced in the widget. State lives in poPermissions.ts
   (useSyncExternalStore + localStorage). Real users never see this —
   production defaults come from the spec.
   ═══════════════════════════════════════════════════════════════ */

import { useState } from "react";
import { ChevronDown, RotateCcw, ShieldCheck, X } from "lucide-react";

import {
  PO_PERMISSIONS,
  type POPermissionGroup,
  resetPOPermissions,
  setPOPermission,
  usePOPermissions,
} from "./poPermissions";

const VIOLET = "#0A77FF";

/* Group → chip palette. Same shape as PlannerDevWidget's TAG_STYLE. */
const GROUP_STYLE: Record<POPermissionGroup, { dot: string; chip: string }> = {
  "Module access":        { dot: VIOLET,    chip: "bg-[#EFF6FF] text-[#0A77FF]" },
  "PO management":        { dot: "#0EA5E9", chip: "bg-sky-50 text-sky-700" },
  "Elevated procurement": { dot: "#7C3AED", chip: "bg-violet-50 text-violet-700" },
  "Destructive action":   { dot: "#DC2626", chip: "bg-rose-50 text-rose-700" },
  "Bulk operation":       { dot: "#F59E0B", chip: "bg-amber-50 text-amber-700" },
  "Pricing":              { dot: "#059669", chip: "bg-emerald-50 text-emerald-700" },
};

export function POPermissionsDevWidget() {
  const state = usePOPermissions();
  const [open, setOpen] = useState(false);
  const onCount = PO_PERMISSIONS.filter((s) => state[s.id]).length;
  const total = PO_PERMISSIONS.length;

  return (
    <>
      {/* Launcher chip — ShieldCheck + N/7 count. Tint follows the "at
          spec default" test: 1/7 on = View Only (defaults after
          cascade), anything else nudges the tint. */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        title="Purchase Orders — dev permissions widget"
        className={`inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border pl-2 pr-2.5 text-[11px] font-semibold transition-colors 2xl:h-8 2xl:gap-2 2xl:pl-2.5 2xl:pr-3 2xl:text-xs ${
          open || onCount !== 1
            ? "border-[#0A77FF]/40 bg-[#EFF6FF] text-[#0A77FF]"
            : "border-border/60 bg-white text-slate-700 hover:bg-slate-50"
        }`}
      >
        <ShieldCheck className="h-3 w-3 2xl:h-3.5 2xl:w-3.5" style={{ color: VIOLET }} />
        <span
          className={`rounded-full px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide 2xl:text-[10px] ${
            onCount === total
              ? "bg-emerald-50 text-emerald-700"
              : onCount === 0
              ? "bg-slate-100 text-slate-500"
              : "bg-[#EFF6FF] text-[#0A77FF]"
          }`}
        >
          {onCount}/{total} on
        </span>
        <ChevronDown className="h-3 w-3 opacity-60" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[9998]"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      {open && (
        <div className="fixed right-4 top-16 z-[9999] flex max-h-[80vh] w-[380px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-start justify-between gap-2 border-b border-slate-100 px-3.5 py-3">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 shrink-0" style={{ color: VIOLET }} />
                <h2 className="text-sm font-semibold text-slate-900">
                  Purchase Orders · Permissions
                </h2>
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-700">
                  Dev only
                </span>
              </div>
              <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
                Pioneer v1.0 — toggle any permission and watch the gated PO
                surfaces update live.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="-mr-1 -mt-0.5 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              aria-label="Close permissions widget"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-3.5 py-3">
            {PO_PERMISSIONS.map((spec) => {
              const on = state[spec.id];
              const missingReq = spec.requires.find((r) => !state[r]);
              const gateDisabled = !!missingReq && !on;
              return (
                <div
                  key={spec.id}
                  className={`mb-2 rounded-lg border px-2.5 py-2 ${
                    on
                      ? "border-emerald-200 bg-emerald-50/50"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span
                      className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: GROUP_STYLE[spec.group].dot }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[12px] font-semibold leading-tight text-slate-900">
                          {spec.label}
                        </span>
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${GROUP_STYLE[spec.group].chip}`}
                        >
                          {spec.group}
                        </span>
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                            spec.defaultOn
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-500"
                          }`}
                          title="Spec default"
                        >
                          Default {spec.defaultOn ? "On" : "Off"}
                        </span>
                      </div>
                      <p className="mt-1 text-[10.5px] leading-snug text-slate-600">
                        {spec.grants}
                      </p>
                      {spec.requires.length > 0 && (
                        <p className="mt-1 text-[10px] leading-snug">
                          <span className="font-semibold text-slate-500">
                            Requires:
                          </span>{" "}
                          <span
                            className={
                              missingReq
                                ? "font-semibold text-rose-600"
                                : "text-slate-600"
                            }
                          >
                            {spec.requires
                              .map(
                                (r) =>
                                  PO_PERMISSIONS.find((s) => s.id === r)
                                    ?.label ?? r,
                              )
                              .join(" · ")}
                          </span>
                        </p>
                      )}
                    </div>
                    <ToggleSwitch
                      on={on}
                      disabled={gateDisabled}
                      title={
                        gateDisabled
                          ? `Enable "${PO_PERMISSIONS.find(
                              (s) => s.id === missingReq,
                            )?.label}" first.`
                          : undefined
                      }
                      onChange={(next) => setPOPermission(spec.id, next)}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-3.5 py-2">
            <p className="text-[10px] leading-snug text-slate-400">
              Real users get the spec defaults. Local preview only.
            </p>
            <button
              type="button"
              onClick={resetPOPermissions}
              className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-white px-1.5 py-1 text-[10.5px] font-semibold text-slate-600 hover:bg-slate-50"
              title="Restore to the spec defaults (View Only after cascade)."
            >
              <RotateCcw className="h-3 w-3" />
              Reset
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function ToggleSwitch({
  on,
  disabled,
  title,
  onChange,
}: {
  on: boolean;
  disabled?: boolean;
  title?: string;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      title={title}
      onClick={() => onChange(!on)}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
        disabled
          ? "cursor-not-allowed bg-slate-200 opacity-50"
          : on
          ? "bg-[#0A77FF]"
          : "bg-slate-300 hover:bg-slate-400"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          on ? "translate-x-4" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}
