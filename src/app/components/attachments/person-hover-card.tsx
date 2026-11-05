/**
 * PersonHoverCard — Reusable hover card for person names across the app.
 * Shows avatar, name, role, department, and license type on hover.
 * Applied consistently everywhere a person's name appears.
 */

import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { Mail, Phone, Building2 } from "lucide-react";
import { PERSON_AVATARS, PersonAvatar } from "./serial-unit-modal";

const font = "var(--font-inter)";

/* ── Person detail map (mock) ── */
export interface PersonInfo {
  role: string;
  department: string;
  licenseType: "Full" | "Field";
}

export const PERSON_DIRECTORY: Record<string, PersonInfo> = {
  "Daniel Adams": { role: "Warehouse Operator", department: "Operations", licenseType: "Field" },
  "Maya Thompson": { role: "Inventory Manager", department: "Inventory Control", licenseType: "Full" },
  "Sarah Chen": { role: "Quality Inspector", department: "Quality Assurance", licenseType: "Full" },
  "James Wilson": { role: "Logistics Coordinator", department: "Logistics", licenseType: "Full" },
  "Lisa Park": { role: "Receiving Clerk", department: "Receiving", licenseType: "Field" },
  "Robert Kim": { role: "Production Lead", department: "Manufacturing", licenseType: "Full" },
  "Emily Torres": { role: "Shipping Coordinator", department: "Shipping", licenseType: "Full" },
  "Maria Garcia": { role: "Warehouse Associate", department: "Operations", licenseType: "Field" },
  "Ahtisham Ahmad": { role: "Inventory Analyst", department: "Inventory Control", licenseType: "Full" },
  "Bruce Xavier": { role: "Warehouse Supervisor", department: "Operations", licenseType: "Full" },
  "Maya Jane Cooper": { role: "Operations Manager", department: "Operations", licenseType: "Full" },
  "Branby Grey": { role: "Forklift Operator", department: "Operations", licenseType: "Field" },
  "Marshall Mathews": { role: "Dock Supervisor", department: "Logistics", licenseType: "Full" },
  "Sydney Stone": { role: "Receiving Specialist", department: "Receiving", licenseType: "Field" },
  "Liam Chen": { role: "Warehouse Tech", department: "IT / Systems", licenseType: "Full" },
  "Sofia Patel": { role: "QC Analyst", department: "Quality Assurance", licenseType: "Full" },
};

/* Backward-compat: export a flat role map */
export const PERSON_ROLES: Record<string, string> = Object.fromEntries(
  Object.entries(PERSON_DIRECTORY).map(([name, info]) => [name, info.role]),
);

export function PersonHoverCard({
  name,
  role,
  size = "default",
  showAvatar = false,
  avatarSize = 14,
  style: overrideStyle,
  onClick,
  avatarOnly = false,
}: {
  name: string;
  /** Override the default role from PERSON_DIRECTORY */
  role?: string;
  /** Text size: "default" = body-sm, "caption" = caption */
  size?: "default" | "caption";
  /** Show inline avatar before name */
  showAvatar?: boolean;
  /** Avatar pixel size */
  avatarSize?: number;
  /** Override styles on the name text */
  style?: React.CSSProperties;
  /** When provided, the trigger becomes clickable (e.g. to open a detail modal). */
  onClick?: () => void;
  /** Render ONLY the avatar as the hover/click trigger (no name text, no hover highlight). */
  avatarOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const info = PERSON_DIRECTORY[name];
  const resolvedRole = role || info?.role || "Team Member";
  const department = info?.department || "General";
  const avatarUrl = PERSON_AVATARS[name];

  const clearTimer = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  };

  const show = useCallback(() => {
    clearTimer();
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPos({
        top: rect.bottom + 6,
        left: rect.left + rect.width / 2,
      });
    }
    setOpen(true);
  }, []);

  const hide = useCallback(() => {
    clearTimer();
    timeoutRef.current = setTimeout(() => setOpen(false), 150);
  }, []);

  useEffect(() => {
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, []);

  const fontSize = size === "caption" ? "var(--text-caption)" : "var(--text-body-sm)";

  /* Avatar-only mode: the avatar is the sole hover/click trigger — no name text, no highlight. */
  if (avatarOnly) {
    return (
      <span
        ref={triggerRef}
        className="inline-flex shrink-0"
        onMouseEnter={show}
        onMouseLeave={hide}
        onClick={onClick ? (e) => { e.stopPropagation(); onClick(); } : undefined}
        style={{ cursor: onClick ? "pointer" : "default", lineHeight: 0 }}
      >
        <PersonAvatar name={name} size={avatarSize} />
        {open && createPortal(
          <PersonHoverPopover
            name={name}
            role={resolvedRole}
            department={department}
            avatarUrl={avatarUrl}
            pos={pos}
            onMouseEnter={show}
            onMouseLeave={hide}
          />,
          document.body
        )}
      </span>
    );
  }

  return (
    <span
      ref={triggerRef}
      className="inline-flex items-center"
      onMouseEnter={show}
      onMouseLeave={hide}
      onClick={onClick ? (e) => { e.stopPropagation(); onClick(); } : undefined}
      style={{
        cursor: onClick ? "pointer" : "default",
        gap: showAvatar ? "var(--spacing-1-5)" : undefined,
        padding: "2px 6px",
        borderRadius: "var(--radius-sm)",
        transition: "background 0.15s ease",
        background: open ? "hsl(213, 97%, 95%)" : "transparent",
        marginLeft: "-6px",
      }}
      onMouseOver={(e) => {
        if (!open) (e.currentTarget as HTMLElement).style.background = "hsl(213, 97%, 95%)";
      }}
      onMouseOut={(e) => {
        if (!open) (e.currentTarget as HTMLElement).style.background = "transparent";
      }}
    >
      {showAvatar && <PersonAvatar name={name} size={avatarSize} />}
      <span
        style={{
          fontFamily: font,
          fontWeight: "var(--font-weight-medium)" as any,
          fontSize,
          color: "var(--text-secondary)",
          transition: "text-decoration-color 0.15s ease",
          ...(open
            ? {
                textDecorationLine: "underline" as const,
                textDecorationStyle: "solid" as const,
                textDecorationColor: "var(--piw-border)",
                textUnderlineOffset: "2px",
              }
            : {
                textDecorationLine: "none" as const,
              }),
          ...overrideStyle,
        }}
      >
        {name}
      </span>

      {open && createPortal(
        <PersonHoverPopover
          name={name}
          role={resolvedRole}
          department={department}
          avatarUrl={avatarUrl}
          pos={pos}
          onMouseEnter={show}
          onMouseLeave={hide}
        />,
        document.body
      )}
    </span>
  );
}

/* ── Popover content (Partner Management style: dark header + email/phone/dept) ── */
function PersonHoverPopover({
  name,
  role,
  department,
  avatarUrl,
  pos,
  onMouseEnter,
  onMouseLeave,
}: {
  name: string;
  role: string;
  department: string;
  avatarUrl?: string;
  pos: { top: number; left: number };
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  const W = 280;
  const slug = name.toLowerCase().replace(/[^a-z]/g, ".");
  const email = `${slug}@company.com`;
  const phone = useMemo(() => {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
    return `(${300 + (h % 600)}) ${100 + (h % 900)}-${1000 + (h % 9000)}`;
  }, [name]);

  let left = pos.left - W / 2;
  if (left < 12) left = 12;
  if (left + W > window.innerWidth - 12) left = window.innerWidth - 12 - W;

  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        position: "fixed",
        top: pos.top,
        left,
        width: W,
        zIndex: 9999,
        borderRadius: 12,
        overflow: "hidden",
        boxShadow: "0 8px 30px rgba(0,0,0,0.18)",
        background: "var(--piw-card)",
        fontFamily: font,
      }}
    >
      {/* Dark header */}
      <div style={{ background: "linear-gradient(135deg,#1f2a3a 0%,#0f1729 100%)", padding: "14px 14px 12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={name}
              style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover", border: "2px solid rgba(255,255,255,0.2)" }}
            />
          ) : (
            <div
              style={{
                width: 44, height: 44, borderRadius: "50%",
                background: "rgba(255,255,255,0.12)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff", fontWeight: 600, fontSize: 14,
              }}
            >
              {name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
            </div>
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{ color: "#fff", fontWeight: 600, fontSize: 14, lineHeight: 1.2 }}>{name}</div>
            <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, marginTop: 2 }}>{role}</div>
          </div>
        </div>
      </div>

      {/* Body rows */}
      <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8, background: "var(--piw-card)" }}>
        <PopoverRow icon={Mail}>{email}</PopoverRow>
        <PopoverRow icon={Phone}>{phone}</PopoverRow>
        <PopoverRow icon={Building2}>{department}</PopoverRow>
      </div>
    </div>
  );
}

function PopoverRow({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: "var(--piw-foreground)" }}>
      <Icon size={14} style={{ color: "var(--text-tertiary)", flexShrink: 0 }} />
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{children}</span>
    </div>
  );
}

/* ── PersonField ──
 * Canonical way to render a person: avatar + name. Hover preview + click-to-open detail are
 * provided by <PersonAvatar /> (PersonInteractionProvider) on the AVATAR only; the name is
 * plain text with no hover interaction. Pass role/time for the stacked layout. */
export function PersonField({
  name,
  avatarSize = 28,
  nameStyle,
  role,
  time,
}: {
  name: string;
  avatarSize?: number;
  nameStyle?: React.CSSProperties;
  /** Optional role sub-label (renders the stacked layout). */
  role?: string;
  /** Optional time sub-label (renders the stacked layout). */
  time?: string | null;
}) {
  if (!name || name === "—") {
    return (
      <span style={{ fontFamily: font, fontWeight: "var(--font-weight-semibold)", fontSize: "var(--text-body-sm)", color: "var(--piw-foreground)", ...nameStyle }}>
        {name || "—"}
      </span>
    );
  }
  const plainName = (
    <span className="truncate" style={{ fontFamily: font, fontWeight: "var(--font-weight-medium)", fontSize: "var(--text-body-sm)", color: "var(--piw-foreground)", ...nameStyle }}>
      {name}
    </span>
  );
  const stacked = role !== undefined || time !== undefined;
  return (
    <span className="inline-flex items-center" style={{ gap: "var(--spacing-1-5)" }}>
      <PersonAvatar name={name} size={avatarSize} />
      {stacked ? (
        <div className="min-w-0 flex-1" style={{ lineHeight: 1.3 }}>
          {plainName}
          {role && <p style={{ fontSize: "9px", color: "var(--text-tertiary)", fontWeight: 500, fontFamily: font, textTransform: "uppercase", letterSpacing: "0.03em", marginTop: "1px" }}>{role}</p>}
          {time && <p style={{ fontSize: "9px", color: "var(--text-tertiary)", fontWeight: 400, fontFamily: font, marginTop: "1px" }}>{time}</p>}
        </div>
      ) : plainName}
    </span>
  );
}
