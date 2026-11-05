import React from "react";
import { Mail, Phone, Building2 } from "lucide-react";
import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent,
} from "./ui/hover-card";

/* ═══════════════════════════════════════════════════════════════
   USER HOVER CARD — Partners pattern: dark gradient header
   (slate-800→slate-700) with avatar + name + role; white body
   with Mail/Phone/Department rows. 280px wide.
   ═══════════════════════════════════════════════════════════════ */

const DEPARTMENTS = ["Supply Chain", "Procurement", "Finance", "Engineering", "Sales", "Operations", "Quality", "Logistics"];
const ROLES = ["Account Manager", "Supply Chain Lead", "Procurement Analyst", "Sales Director", "Operations Manager", "Quality Engineer", "Logistics Coordinator", "Finance Controller"];

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
  return Math.abs(h);
}
function pick<T>(arr: T[], seed: string): T {
  return arr[hashStr(seed) % arr.length];
}
function fmtPhone(name: string): string {
  return `+1 (${(hashStr(name + "p1") % 900) + 100}) ${(hashStr(name + "p2") % 900) + 100}-${(hashStr(name + "p3") % 9000) + 1000}`;
}

const AVATAR_TINTS = [
  { bg: "hsl(var(--accent))", fg: "hsl(var(--primary))" },
  { bg: "#F0FDF4", fg: "#16A34A" },
  { bg: "#FFF7ED", fg: "#EA580C" },
  { bg: "#F5F3FF", fg: "#7C3AED" },
  { bg: "#ECFEFF", fg: "#0891B2" },
  { bg: "#FFF1F2", fg: "#E11D48" },
  { bg: "#FEF9C3", fg: "#A16207" },
  { bg: "#F0FDFA", fg: "#0D9488" },
  { bg: "#FDF2F8", fg: "#DB2777" },
  { bg: "#EFF6FF", fg: "#2563EB" },
  { bg: "#F5F5F4", fg: "#57534E" },
];

function getAvatarTint(name: string) {
  return AVATAR_TINTS[hashStr(name) % AVATAR_TINTS.length];
}

interface UserHoverCardProps {
  name: string;
  children: React.ReactNode;
}

export default function UserHoverCard({ name, children }: UserHoverCardProps) {
  if (!name) return <>{children}</>;
  const initials = name.split(" ").map((w) => w[0] || "").join("").slice(0, 2).toUpperCase();
  const role = pick(ROLES, name);
  const dept = pick(DEPARTMENTS, name + "d");
  const email = `${name.toLowerCase().replace(/\s+/g, ".")}@company.com`;
  const phone = fmtPhone(name);
  const t = getAvatarTint(name);

  return (
    <HoverCard openDelay={200} closeDelay={120}>
      <HoverCardTrigger asChild>
        {children}
      </HoverCardTrigger>
      <HoverCardContent
        side="bottom"
        align="start"
        sideOffset={6}
        className="w-[280px] p-0 rounded-xl border-0 shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden z-[200]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with gradient */}
        <div className="bg-gradient-to-br from-slate-800 to-slate-700 px-4 py-3 relative overflow-hidden">
          <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/[0.04]" />
          <div className="flex items-center gap-3 relative">
            <div
              className="w-11 h-11 rounded-full overflow-hidden border-2 border-white/20 shrink-0 flex items-center justify-center"
              style={{ backgroundColor: t.bg }}
            >
              <span className="text-[13px]" style={{ fontWeight: 700, color: t.fg }}>{initials}</span>
            </div>
            <div className="min-w-0">
              <p className="text-[14px] text-white truncate" style={{ fontWeight: 600 }}>{name}</p>
              <p className="text-[11px] text-slate-400 truncate">{role}</p>
            </div>
          </div>
        </div>
        {/* Body */}
        <div className="bg-white px-4 py-3 space-y-2">
          <div className="flex items-center gap-2.5 text-[12px] text-slate-700">
            <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <a
              href={`mailto:${email}`}
              className="truncate hover:text-primary hover:underline transition-colors"
              onClick={(e) => e.stopPropagation()}
            >{email}</a>
          </div>
          <div className="flex items-center gap-2.5 text-[12px] text-slate-700">
            <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <a
              href={`tel:${phone.replace(/[^\d+]/g, "")}`}
              className="hover:text-primary hover:underline transition-colors"
              onClick={(e) => e.stopPropagation()}
            >{phone}</a>
          </div>
          <div className="flex items-center gap-2.5 text-[12px] text-slate-700">
            <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>{dept}</span>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
