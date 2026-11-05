/* Minimal shared-ui stub for Item v2 attachments port.
 * PI's shared-ui.tsx is 950+ lines; the attachments feature only needs EmptyState. */

import React, { type ReactNode } from "react";
import { PackageSearch } from "lucide-react";

const FONT = "var(--font-inter)";

export function EmptyState({
  label = "results",
  title,
  subtitle,
  icon,
  iconComponent: IconComponent,
  comingSoon = false,
}: {
  label?: string;
  title?: string;
  subtitle?: string;
  icon?: ReactNode;
  iconComponent?: React.ElementType;
  comingSoon?: boolean;
}) {
  const DisplayIcon = IconComponent ?? null;

  return (
    <div
      className="flex flex-col items-center justify-center w-full"
      style={{
        padding: "var(--spacing-8) var(--spacing-4)",
        minHeight: "280px",
      }}
    >
      <div style={{ position: "relative", marginBottom: "24px" }}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            width: "64px",
            height: "64px",
            borderRadius: "16px",
            background: "rgba(10, 119, 255, 0.05)",
            animation: "esEmptyPing 3s ease-in-out infinite",
          }}
        />
        <div
          style={{
            position: "relative",
            width: "64px",
            height: "64px",
            borderRadius: "16px",
            background: "linear-gradient(to bottom right, #F8FAFC, #EDF4FF)",
            border: "1px solid #E2E8F0",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 1px 2px 0 rgba(0,0,0,0.04)",
            animation: "esEmptyFloat 4s ease-in-out infinite",
          }}
        >
          {icon ?? (
            DisplayIcon ? (
              <DisplayIcon style={{ width: "28px", height: "28px", color: "#94A3B8" }} />
            ) : (
              <PackageSearch size={28} style={{ color: "#94A3B8" }} aria-hidden="true" />
            )
          )}
        </div>
      </div>

      {comingSoon && (
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "4px 12px",
            borderRadius: "9999px",
            background: "#F1F5F9",
            border: "1px solid #E2E8F0",
            marginBottom: "12px",
            animation: "esEmptyFade 0.5s ease-out both",
            animationDelay: "0.1s",
          }}
        >
          <span
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              background: "#0A77FF",
              animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
            }}
          />
          <span
            style={{
              fontSize: "11px",
              fontWeight: 600,
              color: "#475569",
              fontFamily: FONT,
            }}
          >
            Coming Soon
          </span>
        </div>
      )}

      <p
        style={{
          fontSize: "16px",
          fontWeight: 600,
          color: "#0F172A",
          fontFamily: FONT,
          margin: "0 0 6px 0",
          animation: "esEmptyFade 0.5s ease-out both",
          animationDelay: "0.2s",
        }}
      >
        {title ?? `No ${label} found`}
      </p>

      <p
        style={{
          fontSize: "13px",
          fontWeight: 400,
          color: "#94A3B8",
          fontFamily: FONT,
          margin: 0,
          maxWidth: "380px",
          lineHeight: 1.5,
          textAlign: "center",
          animation: "esEmptyFade 0.5s ease-out both",
          animationDelay: "0.3s",
        }}
      >
        {subtitle ?? "Try adjusting your search or filter criteria"}
      </p>

      <style>{`
        @keyframes esEmptyFloat { 0%, 100% { transform: translateY(0) scale(1); } 50% { transform: translateY(-4px) scale(1.04); } }
        @keyframes esEmptyPing { 0%, 100% { opacity: 0.35; transform: scale(1); } 50% { opacity: 0; transform: scale(1.5); } }
        @keyframes esEmptyFade { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
