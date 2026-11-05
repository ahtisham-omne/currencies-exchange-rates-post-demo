import React from "react";
import { Layers, Warehouse } from "lucide-react";
import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent,
} from "./ui/hover-card";

/* ═══════════════════════════════════════════════════════════════
   ITEM HOVER CARD — Partners pattern: dark gradient header
   (slate-800→slate-700) with thumbnail + code + short description;
   white body with category, on-hand qty + price, status pill.
   280px wide.
   ═══════════════════════════════════════════════════════════════ */

const ITEM_DESCS_HC = [
  "Zinc-plated hex head screw, industrial grade",
  "Deep groove ball bearing, sealed type",
  "DC relay, SPDT, 10A contact rating",
  "Push-to-connect fitting, brass tube",
  "Stainless welding rod, 3/32\" diameter",
  "Cut-resistant safety gloves, ANSI A4",
  "Classical V-belt, B68, heavy duty",
  "Inductive proximity sensor, M12 barrel",
];
const ITEM_CATS = ["Raw Material", "Component", "Assembly", "Consumable", "Finished Good"];
const ITEM_STATUSES = ["In Stock", "Low Stock", "Out of Stock", "On Order"];

const STATUS_C: Record<string, { bg: string; fg: string }> = {
  "In Stock":     { bg: "#F0FDF4", fg: "#166534" },
  "Low Stock":    { bg: "#FFFBEB", fg: "#92400E" },
  "Out of Stock": { bg: "#FEF2F2", fg: "#991B1B" },
  "On Order":     { bg: "#EFF6FF", fg: "#1E40AF" },
};

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
  return Math.abs(h);
}

interface ItemHoverCardProps {
  code: string;
  imageUrl?: string;
  children: React.ReactNode;
}

export default function ItemHoverCard({ code, imageUrl, children }: ItemHoverCardProps) {
  if (!code) return <>{children}</>;
  const aih = hashStr(code);
  const desc = ITEM_DESCS_HC[aih % ITEM_DESCS_HC.length];
  const cat = ITEM_CATS[aih % ITEM_CATS.length];
  const status = ITEM_STATUSES[(aih * 3) % ITEM_STATUSES.length];
  const sc = STATUS_C[status] || STATUS_C["In Stock"];
  const price = `$${(((aih * 7) % 500) + 10).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const qty = ((aih * 13) % 15000) + 100;

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
        <div className="bg-gradient-to-br from-slate-800 to-slate-700 px-3.5 py-3 relative overflow-hidden">
          <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/[0.04]" />
          <div className="flex items-center gap-3 relative">
            <div className="w-9 h-9 rounded-lg bg-white/10 overflow-hidden shrink-0">
              {imageUrl && <img src={imageUrl} alt="" className="w-full h-full object-cover" />}
            </div>
            <div className="min-w-0">
              <p className="text-[14px] text-white truncate" style={{ fontWeight: 600 }}>{code}</p>
              <p className="text-[11px] text-slate-400 truncate">{desc}</p>
            </div>
          </div>
        </div>
        {/* Body */}
        <div className="bg-white px-3.5 py-3 space-y-2">
          <div className="flex items-center gap-2.5 text-[12px] text-slate-700">
            <Layers className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>{cat}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 text-[12px] text-slate-700">
              <Warehouse className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>On-Hand: <b>{qty.toLocaleString()}</b></span>
            </div>
            <span className="text-[12px] text-slate-700" style={{ fontWeight: 600 }}>
              {price}<span className="text-slate-400 ml-1" style={{ fontWeight: 400 }}>/ unit</span>
            </span>
          </div>
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] border"
            style={{ fontWeight: 600, backgroundColor: sc.bg, color: sc.fg, borderColor: sc.fg + "33" }}
          >
            {status}
          </span>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
