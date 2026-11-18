import { ShieldCheck } from "lucide-react";

/* ─────────────────────────────────────────────────────────────
 * SecurityMfaPolicyPage
 * ─────────────────────────────────────────────────────────────
 * Stub destination for the "Applied MFA Policy" link inside the
 * Reset MFA modal. Real implementation lives in the Security
 * Settings module; this page exists so the link has a meaningful
 * landing target while that module is built out.
 * ──────────────────────────────────────────────────────────── */

export function SecurityMfaPolicyPage() {
  return (
    <div className="px-6 lg:px-8 py-8 max-w-2xl">
      <div
        className="flex items-center gap-2 mb-3 text-[11px] uppercase"
        style={{ color: "#94A3B8", fontWeight: 600, letterSpacing: "0.08em" }}
      >
        <span>Company Settings</span>
        <span>/</span>
        <span>Security</span>
        <span>/</span>
        <span style={{ color: "#0A77FF" }}>MFA Policy</span>
      </div>

      <div className="flex items-center gap-2.5 mb-2">
        <ShieldCheck className="w-6 h-6" style={{ color: "#0A77FF" }} />
        <h1
          className="tracking-[-0.01em]"
          style={{ color: "#0F172A", fontSize: "22px", fontWeight: 600 }}
        >
          Company MFA Policy
        </h1>
      </div>

      <p className="text-sm mb-6" style={{ color: "#64748B", lineHeight: 1.6 }}>
        This is the Security Settings page with the MFA policy opened up.
        Grace period, enforcement mode, and other policy settings would be
        editable here. Changes made on this page propagate to every user the
        policy applies to.
      </p>

      <div
        className="rounded-[10px] border p-4 text-[13px]"
        style={{
          backgroundColor: "#F8FAFC",
          borderColor: "#E2E8F0",
          color: "#475569",
          lineHeight: 1.6,
        }}
      >
        Placeholder content. Full policy editor is part of the Security
        Settings module and is out of scope for this prototype.
      </div>
    </div>
  );
}
