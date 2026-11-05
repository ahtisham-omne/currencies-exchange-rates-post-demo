/* ═══════════════════════════════════════════════════════════════
   PartnerHoverCard — Partners-style hover card for VENDOR avatars.

   Mirrors the Contacts Directory HoverCard recipe
   (`ContactsDirectoryPage.tsx:1330-1348`): a dark-gradient header
   (slate-800 → slate-700) carrying the vendor's tinted squircle
   avatar + name + priority tagline, followed by a white body with
   icon-prefixed rows for the primary location, POC, phone, email.

   Analogous to `UserHoverCard` (which surfaces a PERSON hover),
   but shaped for a VENDOR entity: real POC data from the offer
   instead of hashed placeholders.
   ═══════════════════════════════════════════════════════════════ */

import React from "react";
import { Mail, Phone, MapPin, User } from "lucide-react";
import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent,
} from "./ui/hover-card";
import { getAvatarTint } from "./avatarTints";
import { FONT } from "./designTokens";

export interface PartnerHoverCardVendor {
  name: string;
  abbr: string;
  /** "Default", "2nd", "3rd", … — displayed as the header tagline. */
  priorityLabel?: string;
  /** Primary (default) location. */
  location?: { name: string; address: string };
  /** Vendor Account Manager / POC. */
  contact?: {
    name: string;
    role: string;
    email: string;
    phone: string;
    initials: string;
  };
}

interface PartnerHoverCardProps {
  vendor: PartnerHoverCardVendor;
  children: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
}

export default function PartnerHoverCard({
  vendor,
  children,
  side = "right",
  align = "start",
}: PartnerHoverCardProps) {
  const tint = getAvatarTint(vendor.name);
  return (
    <HoverCard openDelay={200} closeDelay={120}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent
        side={side}
        align={align}
        sideOffset={8}
        className="w-[300px] p-0 rounded-xl border-0 shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden z-[10000]"
        onClick={(e) => e.stopPropagation()}
        onPointerDownCapture={(e) => e.stopPropagation()}
      >
        {/* ── Dark gradient header ── */}
        <div
          className="bg-gradient-to-br from-slate-800 to-slate-700 px-4 py-3 relative overflow-hidden"
          style={{ fontFamily: FONT }}
        >
          <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/[0.04]" />
          <div className="flex items-center gap-3 relative">
            <div
              className="w-11 h-11 rounded-lg overflow-hidden border-2 border-white/20 shrink-0 flex items-center justify-center"
              style={{ backgroundColor: tint.bg }}
            >
              <span
                className="text-[13px]"
                style={{ fontWeight: 700, color: tint.fg, fontFamily: FONT }}
              >
                {vendor.abbr}
              </span>
            </div>
            <div className="min-w-0">
              <p
                className="text-[14px] text-white truncate"
                style={{ fontWeight: 600, fontFamily: FONT }}
              >
                {vendor.name}
              </p>
              {vendor.priorityLabel && (
                <p
                  className="text-[11px] text-slate-400 truncate"
                  style={{ fontFamily: FONT }}
                >
                  {vendor.priorityLabel}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ── White body — location + POC ── */}
        <div className="bg-white px-4 py-3" style={{ fontFamily: FONT }}>
          {vendor.location && (
            <div className="flex items-start gap-2.5 text-[12px] text-slate-700 mb-2 last:mb-0">
              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <span
                  className="block truncate"
                  style={{ fontWeight: 500, fontFamily: FONT }}
                >
                  {vendor.location.name}
                </span>
                <span
                  className="block text-[11px] text-slate-500 truncate"
                  style={{ fontFamily: FONT }}
                >
                  {vendor.location.address}
                </span>
              </div>
            </div>
          )}

          {vendor.contact && (
            <>
              {vendor.location && (
                <div className="h-px bg-slate-100 -mx-4 my-2" />
              )}
              <div className="flex items-center gap-2.5 text-[12px] text-slate-700 mb-1.5">
                <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <div className="min-w-0 flex-1">
                  <span
                    className="block truncate"
                    style={{ fontWeight: 600, fontFamily: FONT }}
                  >
                    {vendor.contact.name}
                  </span>
                  <span
                    className="block text-[11px] text-slate-500 truncate"
                    style={{ fontFamily: FONT }}
                  >
                    {vendor.contact.role}
                  </span>
                </div>
              </div>
              {vendor.contact.phone && (
                <div className="flex items-center gap-2.5 text-[12px] text-slate-700 mb-1">
                  <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <a
                    href={`tel:${vendor.contact.phone.replace(/[^\d+]/g, "")}`}
                    className="truncate hover:text-primary hover:underline transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {vendor.contact.phone}
                  </a>
                </div>
              )}
              {vendor.contact.email && (
                <div className="flex items-center gap-2.5 text-[12px] text-slate-700">
                  <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <a
                    href={`mailto:${vendor.contact.email}`}
                    className="truncate hover:text-primary hover:underline transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {vendor.contact.email}
                  </a>
                </div>
              )}
            </>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
