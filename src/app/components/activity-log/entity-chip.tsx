import * as React from "react";
import { ArrowUpRight, MapPin, Warehouse as WarehouseIcon } from "lucide-react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "../ui/hover-card";
import { WAREHOUSES, LOCATIONS_BY_WAREHOUSE } from "./data";

/**
 * Entity chip + hover cards for the Activity Log — ported from
 * warehouse-whispers-34's EntityChip.tsx/LocationHoverCard.tsx, trimmed to
 * the two kinds this app actually has. Same dark-gradient-header +
 * white-body shape as this app's own CreatedByHoverCard.tsx, so the two
 * read as siblings. The title block opens the real record in a new tab —
 * the activity log is a place you scan, not a place you navigate away
 * from to look at one record.
 */
export type ChipEntity = { kind: "warehouse" | "location"; code: string } | { kind: "plain" };

export function entityHref(entity: ChipEntity): string | null {
  if (entity.kind === "plain") return null;
  if (entity.kind === "warehouse") return `/warehouses/${entity.code}`;
  return `/locations/${entity.code}`;
}

function WarehouseHoverCard({ code, children }: { code: string; children: React.ReactNode }) {
  const wh = WAREHOUSES.find((w) => w.code === code);
  const locationCount = LOCATIONS_BY_WAREHOUSE[code as keyof typeof LOCATIONS_BY_WAREHOUSE]?.length ?? 0;
  const href = entityHref({ kind: "warehouse", code });

  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild onClick={(e: React.MouseEvent) => e.stopPropagation()}>
        {children as React.ReactElement}
      </HoverCardTrigger>
      <HoverCardContent
        side="bottom"
        align="start"
        className="w-[300px] p-0 rounded-xl border-0 shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden"
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-br from-slate-800 to-slate-700 px-4 py-3 relative overflow-hidden">
          <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/[0.04]" />
          <div className="flex items-center gap-3 relative">
            <div className="w-[42px] h-[42px] rounded-lg bg-white/10 flex items-center justify-center shrink-0">
              <WarehouseIcon className="w-[18px] h-[18px] text-white/80" />
            </div>
            <a href={href ?? undefined} target="_blank" rel="noopener noreferrer" className="group/open flex min-w-0 flex-1 items-start gap-2 text-white">
              <div className="min-w-0">
                <p className="text-[14px] text-white truncate" style={{ fontWeight: 600 }}>{code}</p>
                <p className="text-[12px] text-slate-400 truncate mt-0.5">{wh?.name ?? "Warehouse"}</p>
              </div>
              <ArrowUpRight className="ml-auto size-4 shrink-0 opacity-60 transition-opacity group-hover/open:opacity-100" />
            </a>
          </div>
        </div>
        <div className="bg-white px-4 py-3">
          <p className="text-[10px] uppercase tracking-wide text-slate-400 whitespace-nowrap" style={{ fontWeight: 600 }}>Locations</p>
          <p className="text-[17px] text-slate-900 mt-0.5 tabular-nums" style={{ fontWeight: 700 }}>{locationCount}</p>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

function LocationHoverCard({ code, children }: { code: string; children: React.ReactNode }) {
  const parentEntry = Object.entries(LOCATIONS_BY_WAREHOUSE).find(([, locs]) => locs.some((l) => l.code === code));
  const warehouseCode = parentEntry?.[0];
  const location = parentEntry?.[1].find((l) => l.code === code);
  const href = entityHref({ kind: "location", code });

  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild onClick={(e: React.MouseEvent) => e.stopPropagation()}>
        {children as React.ReactElement}
      </HoverCardTrigger>
      <HoverCardContent
        side="bottom"
        align="start"
        className="w-[300px] p-0 rounded-xl border-0 shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden"
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-br from-slate-800 to-slate-700 px-4 py-3 relative overflow-hidden">
          <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/[0.04]" />
          <div className="flex items-center gap-3 relative">
            <div className="w-[42px] h-[42px] rounded-lg bg-white/10 flex items-center justify-center shrink-0">
              <MapPin className="w-[18px] h-[18px] text-white/80" />
            </div>
            <a href={href ?? undefined} target="_blank" rel="noopener noreferrer" className="group/open flex min-w-0 flex-1 items-start gap-2 text-white">
              <div className="min-w-0">
                <p className="text-[14px] text-white truncate" style={{ fontWeight: 600 }}>{code}</p>
                <p className="text-[12px] text-slate-400 truncate mt-0.5">{location?.name ?? "Location"} · {warehouseCode}</p>
              </div>
              <ArrowUpRight className="ml-auto size-4 shrink-0 opacity-60 transition-opacity group-hover/open:opacity-100" />
            </a>
          </div>
        </div>
        <div className="bg-white px-4 py-3">
          <p className="text-[10px] uppercase tracking-wide text-slate-400 whitespace-nowrap" style={{ fontWeight: 600 }}>Parent warehouse</p>
          <p className="text-[13px] text-slate-900 mt-0.5" style={{ fontWeight: 600 }}>{warehouseCode}</p>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

export function EntityChip({ entity, children }: { entity: ChipEntity; children: React.ReactNode }) {
  const pill = (
    <span className="shrink-0 rounded-full border border-border bg-white px-2 py-0.5 text-[11px] font-medium text-foreground">
      {children}
    </span>
  );
  if (entity.kind === "plain") return pill;
  if (entity.kind === "warehouse") return <WarehouseHoverCard code={entity.code}>{pill}</WarehouseHoverCard>;
  return <LocationHoverCard code={entity.code}>{pill}</LocationHoverCard>;
}
