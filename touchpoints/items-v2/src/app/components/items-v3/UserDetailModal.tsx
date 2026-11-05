import * as React from "react";
import { useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Mail,
  Phone,
  Briefcase,
  Building2,
  Globe,
  Linkedin,
  Twitter,
  MessageCircle,
  ExternalLink,
  ZoomIn,
} from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  getUserTint,
  getUserInitials,
  getPersonAvatar,
  getContactDetails,
} from "./UserHoverCard";

/* ─────────── Helpers (ported from Partners QuickViewPanel) ─────────── */

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
  return Math.abs(h);
}
function pick<T>(arr: T[], seed: string): T {
  return arr[hashStr(seed) % arr.length];
}
function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

/** Deterministic soft palette for department pills — verbatim from Partners. */
const DEPT_PALETTES: Record<string, { bg: string; fg: string; border: string }> = {
  "Supply Chain": { bg: "#EEF2FF", fg: "#3730A3", border: "#C7D2FE" },
  Procurement: { bg: "#F5F3FF", fg: "#5B21B6", border: "#DDD6FE" },
  Finance: { bg: "#ECFDF5", fg: "#065F46", border: "#A7F3D0" },
  Engineering: { bg: "#EFF6FF", fg: "#1E40AF", border: "#BFDBFE" },
  Sales: { bg: "#FEF3C7", fg: "#92400E", border: "#FDE68A" },
  Operations: { bg: "hsl(var(--muted))", fg: "#334155", border: "hsl(var(--border))" },
  Quality: { bg: "#FFF1F2", fg: "#9F1239", border: "#FECDD3" },
  "Quality Assurance": { bg: "#FFF1F2", fg: "#9F1239", border: "#FECDD3" },
  Logistics: { bg: "#ECFEFF", fg: "#155E75", border: "#A5F3FC" },
};
function deptPalette(dept: string) {
  return DEPT_PALETTES[dept] ?? { bg: "hsl(var(--muted))", fg: "#334155", border: "hsl(var(--border))" };
}

/** Mock per-user social/phone/email extras + activity stats — Items adaptation
 * of Partners' mockContactData. Stats are reframed for the Items context:
 *   Orders → Items Created,  Interactions → Items Owned,  AvgResponse → kept.
 */
function mockUserExtras(name: string, assignedCount: number) {
  const slug = name.toLowerCase().replace(/\s+/g, ".");
  const nameSlug = name.toLowerCase().replace(/\s+/g, "-");
  const fmtPhone = (s: string) =>
    `+1 (${(hashStr(name + s + "1") % 900) + 100}) ${(hashStr(name + s + "2") % 900) + 100}-${(hashStr(name + s + "3") % 9000) + 1000}`;

  const phones: { id: string; type: "Office" | "Mobile"; number: string }[] = [
    { id: "p1", type: "Office", number: fmtPhone("p") },
  ];
  if (hashStr(name + "pmp") % 10 < 7) {
    phones.push({ id: "p2", type: "Mobile", number: fmtPhone("m") });
  }

  const emails: { id: string; type: "Work" | "Personal"; address: string }[] = [
    { id: "e1", type: "Work", address: `${slug}@company.com` },
  ];
  if (hashStr(name + "epe") % 3 !== 0) {
    emails.push({ id: "e2", type: "Personal", address: `${slug.replace(/\./g, "")}@gmail.com` });
  }

  const socials: { id: string; type: "LinkedIn" | "Twitter / X" | "Website" | "Skype" | "WhatsApp"; url: string }[] = [
    { id: "s1", type: "LinkedIn", url: `https://www.linkedin.com/in/${nameSlug}` },
  ];
  if (hashStr(name + "stx") % 10 < 6) socials.push({ id: "s2", type: "Twitter / X", url: `https://x.com/${nameSlug}` });
  if (hashStr(name + "sw") % 10 < 4) socials.push({ id: "s3", type: "Website", url: `https://${nameSlug}.com` });

  const itemsCreated = assignedCount > 0 ? Math.max(1, Math.round(assignedCount * 0.6)) : (hashStr(name + "ic") % 80) + 5;
  const itemsOwned = assignedCount > 0 ? assignedCount : (hashStr(name + "io") % 240) + 20;
  const avgResponseHrs = ((hashStr(name + "ar") % 90) + 5) / 10;
  const isActive = hashStr(name + "ac") % 7 !== 0;

  return { phones, emails, socials, itemsCreated, itemsOwned, avgResponseHrs, isActive };
}

/* ─────────── Component ─────────── */

export interface UserDetailModalProps {
  /** Full user name. When `null`, modal is closed. */
  user: string | null;
  /** Optional context label shown under the name when no role is resolved. */
  subtitle?: string;
  /** Count of items this user owns/created — feeds the "Items Owned" KPI. */
  assignedCount?: number;
  onClose: () => void;
}

export function UserDetailModal({
  user,
  subtitle,
  assignedCount = 0,
  onClose,
}: UserDetailModalProps) {
  /* Close on Escape — mirrors QuickViewPanel. */
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );
  useEffect(() => {
    if (!user) return;
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [user, handleKeyDown]);

  if (!user) return null;

  const tint = getUserTint(user);
  const initials = getUserInitials(user);
  const photo = getPersonAvatar(user);
  const cd = getContactDetails(user);
  const role = cd.role;
  const dept = cd.dept;
  const dPalette = deptPalette(dept);
  const teamLabel = pick(["Internal", "Operations", "Catalog", "Procurement"], user + "tl");

  const d = mockUserExtras(user, assignedCount);
  const phones = [{ id: "p0", type: "Office" as const, number: cd.phone }, ...d.phones.slice(1)];
  const emails = [{ id: "e0", type: "Work" as const, address: cd.email }, ...d.emails.slice(1)];

  const heroBg = tint.bg;
  const heroFg = tint.fg;

  const statusBg = d.isActive ? "#DCFCE7" : "#FEE2E2";
  const statusFg = d.isActive ? "#166534" : "#991B1B";
  const statusBorder = d.isActive ? "#BBF7D0" : "#FECACA";

  /* Same social icon registry as Partners' contact details page header. */
  const socialMeta: Record<string, { icon: typeof Linkedin; color: string; label: string }> = {
    LinkedIn: { icon: Linkedin, color: "#0A66C2", label: "LinkedIn" },
    "Twitter / X": { icon: Twitter, color: "#000000", label: "X (Twitter)" },
    Website: { icon: Globe, color: "hsl(var(--primary))", label: "Website" },
    Skype: { icon: MessageCircle, color: "#00AFF0", label: "Skype" },
    WhatsApp: { icon: MessageCircle, color: "#25D366", label: "WhatsApp" },
  };

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[200] bg-black/50 animate-in fade-in-0"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="fixed z-[210] top-1/2 left-1/2 w-[calc(100vw-32px)] sm:w-[480px] md:w-[540px] lg:w-[600px] max-h-[calc(100vh-48px)] bg-card rounded-2xl border border-border/50 overflow-hidden flex flex-col"
        style={{
          transform: "translate(-50%, -50%)",
          boxShadow:
            "0 0 0 1px rgba(0,0,0,0.03), 0 8px 20px rgba(0,0,0,0.08), 0 24px 56px rgba(0,0,0,0.14)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button — pinned top-right */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 z-50 w-8 h-8 rounded-full flex items-center justify-center bg-white/90 hover:bg-white shadow-md transition-all cursor-pointer border border-border"
        >
          <X className="w-4 h-4 text-slate-700" />
        </button>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {/* ── Hero — photo when available, otherwise initials tile over a tint→slate gradient ── */}
          <div
            className="relative overflow-hidden shrink-0"
            style={{
              height: "clamp(200px, 45vh, 420px)",
              background: photo
                ? "#1E1B4B"
                : `linear-gradient(135deg, ${heroBg} 0%, ${heroBg} 55%, #1E293B 100%)`,
            }}
          >
            {photo ? (
              <img src={photo} alt={user} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div
                  className="w-28 h-28 rounded-full flex items-center justify-center text-[40px] shadow-[0_6px_24px_rgba(0,0,0,0.25)] border-2 border-white/30"
                  style={{ backgroundColor: heroBg, color: heroFg, fontWeight: 700, letterSpacing: 1 }}
                >
                  {initials}
                </div>
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/60 to-transparent" />

            {/* Active / Inactive badge — top-left */}
            <span
              className="absolute top-3 left-3 inline-flex items-center px-2.5 py-1 rounded-full text-[11px] border backdrop-blur-sm"
              style={{ fontWeight: 600, backgroundColor: statusBg + "E6", color: statusFg, borderColor: statusBorder }}
            >
              {d.isActive ? "Active" : "Inactive"}
            </span>

            {/* Zoom — only meaningful when we have a photo */}
            {photo && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(photo, "_blank", "noopener");
                }}
                className="absolute top-3 right-14 w-8 h-8 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center text-white/80 hover:bg-black/50 hover:text-white transition-colors cursor-pointer"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            )}

            {/* Name + role overlay */}
            <div className="absolute bottom-3 left-4 right-4">
              <p className="text-[16px] text-white truncate" style={{ fontWeight: 700 }}>{user}</p>
              <div className="text-[11.5px] text-white/80 mt-0.5 truncate" style={{ fontWeight: 500 }}>
                {subtitle ?? role}
              </div>
            </div>
          </div>

          {/* ── Data area ── */}
          <div className="px-5 pt-4 pb-4">
            {/* Context: team + department pill */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 text-[12px] text-slate-500" style={{ fontWeight: 500 }}>
                <Building2 className="w-3 h-3" />{teamLabel}
              </span>
              <span className="text-slate-300">•</span>
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] border"
                style={{ fontWeight: 600, backgroundColor: dPalette.bg, color: dPalette.fg, borderColor: dPalette.border }}
              >
                <Briefcase className="w-3 h-3" />
                {dept}
              </span>
            </div>

            {/* 4-col stat row — matches Partners */}
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 divide-x divide-border rounded-xl border border-border overflow-hidden [&>*:nth-child(n+3)]:border-t [&>*:nth-child(n+3)]:sm:border-t-0">
              <div className="px-2.5 py-2.5 text-center">
                <div className="text-[13px] text-foreground truncate" style={{ fontWeight: 700 }}>{dept}</div>
                <div className="text-[10px] text-slate-400 mt-0.5" style={{ fontWeight: 500 }}>Team Member</div>
              </div>
              <div className="px-2.5 py-2.5 text-center">
                <div className="text-[15px] text-foreground" style={{ fontWeight: 700 }}>{formatNumber(d.itemsCreated)}</div>
                <div className="text-[10px] text-slate-400 mt-0.5" style={{ fontWeight: 500 }}>Items Created</div>
              </div>
              <div className="px-2.5 py-2.5 text-center">
                <div className="text-[15px] text-foreground" style={{ fontWeight: 700 }}>{formatNumber(d.itemsOwned)}</div>
                <div className="text-[10px] text-slate-400 mt-0.5" style={{ fontWeight: 500 }}>Items Owned</div>
              </div>
              <div className="px-2.5 py-2.5 text-center">
                <div className="text-[15px] text-foreground" style={{ fontWeight: 700 }}>
                  {d.avgResponseHrs.toFixed(1)}<span className="text-[11px] text-slate-500 ml-0.5">hrs</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5" style={{ fontWeight: 500 }}>Avg Response</div>
              </div>
            </div>

            {/* Contact rows — phone + email with "+N more" tooltips */}
            <div className="mt-3 space-y-1">
              {/* Phone */}
              <div className="flex items-center gap-2.5 py-1">
                <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <a
                  href={`tel:${phones[0].number.replace(/[^\d+]/g, "")}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-[13px] text-foreground hover:text-primary hover:underline transition-colors min-w-0 truncate"
                  style={{ fontWeight: 500 }}
                >
                  {phones[0].number}
                </a>
                {phones.length > 1 && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span
                        className="text-[11px] shrink-0 cursor-default leading-none ml-0.5"
                        style={{ fontWeight: 600, color: "#085FCC" }}
                      >
                        +{phones.length - 1} more
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="z-[300] max-w-[300px]">
                      <div className="space-y-1.5">
                        {phones.slice(1).map((p) => (
                          <div key={p.id} className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-400 shrink-0" style={{ fontWeight: 500 }}>{p.type}</span>
                            <span className="text-[11px] text-slate-700">{p.number}</span>
                          </div>
                        ))}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>

              {/* Email */}
              <div className="flex items-center gap-2.5 py-1">
                <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <a
                  href={`mailto:${emails[0].address}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-[13px] text-foreground hover:text-primary hover:underline transition-colors min-w-0 truncate"
                  style={{ fontWeight: 500 }}
                >
                  {emails[0].address}
                </a>
                {emails.length > 1 && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span
                        className="text-[11px] shrink-0 cursor-default leading-none ml-0.5"
                        style={{ fontWeight: 600, color: "#085FCC" }}
                      >
                        +{emails.length - 1} more
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="z-[300] max-w-[300px]">
                      <div className="space-y-1.5">
                        {emails.slice(1).map((e) => (
                          <div key={e.id} className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-400 shrink-0" style={{ fontWeight: 500 }}>{e.type}</span>
                            <span className="text-[11px] text-slate-700">{e.address}</span>
                          </div>
                        ))}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>

              {/* Socials */}
              {d.socials.length > 0 && (
                <div className="flex items-center gap-2.5 pt-1.5">
                  <span className="text-[11px] text-muted-foreground/70 shrink-0" style={{ fontWeight: 600 }}>Connect</span>
                  <div className="flex items-center gap-1">
                    {d.socials.map((s) => {
                      const meta = socialMeta[s.type];
                      if (!meta) return null;
                      const SIcon = meta.icon;
                      return (
                        <Tooltip key={s.id}>
                          <TooltipTrigger asChild>
                            <a
                              href={s.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="group/social relative w-6 h-6 rounded flex items-center justify-center transition-all duration-150 hover:bg-muted"
                            >
                              <SIcon className="w-3.5 h-3.5 text-slate-400 group-hover/social:opacity-0 transition-opacity duration-150" />
                              <SIcon
                                className="w-3.5 h-3.5 absolute opacity-0 group-hover/social:opacity-100 transition-opacity duration-150"
                                style={{ color: meta.color }}
                              />
                            </a>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="z-[300]">
                            <span className="text-[11px]">{meta.label}</span>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border/40 flex items-center justify-between bg-muted/30">
          <button
            type="button"
            onClick={onClose}
            className="text-[13px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            style={{ fontWeight: 500 }}
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => {
              toast({
                title: "Coming soon",
                description: `Full profile for ${user} is not yet available.`,
              });
            }}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[13px] text-white transition-colors cursor-pointer"
            style={{ fontWeight: 600, backgroundColor: "hsl(var(--primary))" }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#0862D4")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "hsl(var(--primary))")}
          >
            View Profile
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}