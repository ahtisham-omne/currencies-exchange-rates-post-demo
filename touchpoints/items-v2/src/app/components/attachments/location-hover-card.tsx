/**
 * LocationHoverCard — Rich hover preview shown when pointing at a location tag.
 * Ported from Inventory Movement's LocationHoverCard with token substitution.
 *
 * `deriveLocationInfo` is inlined here so this file is self-contained and does
 * not depend on IM's locationData module.
 *
 * NOTE: An optional LocationDetailContext is exported so consumers (e.g. the
 * attachment location pill) can hook up a location-detail modal callback.
 * When no provider is present, the pill still renders — it just becomes
 * non-interactive.
 */

import React, {
  useRef,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { MapPin, Globe } from "lucide-react";

const FONT = "var(--font-inter)";

/* ─── Optional context: open a location detail modal from any location pill ── */
export const LocationDetailContext = React.createContext<
  ((code: string, name?: string) => void) | null
>(null);

/* ─── Location metadata (mock, deterministic) ─────────────────────────────── */

export interface LocationInfo {
  code: string;
  description: string;
  status: "Active" | "Inactive";
  country: string;
  countryCode: string;
  zone: string;
  warehouse: string;
  path: string[];
  subLocations: number;
  utilization: number;
  itemsStored: number;
  tags: string[];
  createdBy: string;
  createdOn: string;
}

const LOCATION_TAGS = ["Sales", "Operations", "NOC", "Receiving", "Dispatch", "Cold Chain", "Bulk"];
const PEOPLE = ["James Peterson", "Ahtisham Ahmad", "Sam Chen", "Alex Morgan", "Jordan Lee", "Taylor Kim"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function deriveLocationInfo(code: string, description?: string): LocationInfo {
  const h = hashStr(code || "x");
  const zoneLetter = (code.replace(/^WH-/, "").charAt(0) || "A").toUpperCase();
  const zone = `Zone ${zoneLetter}`;
  const desc = description || `${zone} Storage Area ${(h % 9) + 1}`;

  const tagCount = 1 + (h % 3);
  const tags: string[] = [];
  for (let i = 0; i < tagCount; i++) {
    const t = LOCATION_TAGS[(h + i * 5) % LOCATION_TAGS.length];
    if (!tags.includes(t)) tags.push(t);
  }

  const year = 2026;
  const month = MONTHS[h % 12];
  const day = (h % 27) + 1;

  return {
    code,
    description: desc,
    status: h % 9 === 0 ? "Inactive" : "Active",
    country: "United States",
    countryCode: "us",
    zone,
    warehouse: "Main Distribution Center",
    path: ["Main Warehouse", zone, code],
    subLocations: h % 4,
    utilization: 35 + (h % 60),
    itemsStored: 4 + (h % 40),
    tags,
    createdBy: PEOPLE[h % PEOPLE.length],
    createdOn: `${month} ${day}, ${year}`,
  };
}

/* ─── Hover-card open/close coordination ─────────────────────────────────── */

const OPEN_DELAY = 240;
const CLOSE_DELAY = 150;
const CARD_W = 380;

let _closeCallbacks: (() => void)[] = [];
function registerClose(cb: () => void) {
  _closeCallbacks.push(cb);
  return () => {
    _closeCallbacks = _closeCallbacks.filter((c) => c !== cb);
  };
}
function closeAllExcept(except: () => void) {
  _closeCallbacks.forEach((c) => {
    if (c !== except) c();
  });
}

function HoverCard({
  code,
  name,
  top,
  left,
  onEnter,
  onLeave,
}: {
  code: string;
  name?: string;
  top: number;
  left: number;
  onEnter: () => void;
  onLeave: () => void;
}) {
  const info = deriveLocationInfo(code, name);
  const isActive = info.status === "Active";

  return createPortal(
    <div
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      style={{
        position: "fixed",
        top,
        left,
        zIndex: 9999,
        width: CARD_W,
        background: "var(--piw-card)",
        borderRadius: 14,
        border: "1px solid var(--piw-border)",
        boxShadow: "0 12px 32px rgba(16,24,40,0.16), 0 4px 10px rgba(16,24,40,0.06)",
        overflow: "hidden",
        animation: "fadeIn 0.15s ease",
        fontFamily: FONT,
      }}
    >
      {/* Dark header */}
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          gap: 11,
          padding: 14,
          background: "linear-gradient(135deg, #243447 0%, #1a2433 100%)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -36,
            right: -26,
            width: 120,
            height: 120,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.04)",
            pointerEvents: "none",
          }}
        />
        <div
          className="flex items-center justify-center shrink-0"
          style={{ width: 42, height: 42, borderRadius: 10, background: "rgba(255,255,255,0.08)" }}
        >
          <MapPin size={18} style={{ color: "rgba(255,255,255,0.8)" }} />
        </div>
        <div style={{ minWidth: 0, position: "relative" }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: "#FFFFFF",
              lineHeight: 1.2,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {info.code}
          </div>
          <div
            style={{
              fontSize: 12,
              color: "rgba(148,163,184,1)",
              marginTop: 2,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {info.warehouse} · {info.zone}
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: "13px 15px 15px" }}>
        <div className="flex items-start" style={{ gap: 18 }}>
          <div>
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 600,
                letterSpacing: "0.04em",
                color: "rgba(148,163,184,1)",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
              }}
            >
              Sub-locations
            </div>
            <div style={{ marginTop: 2, fontSize: 17, fontWeight: 700, color: "#111827" }}>
              {info.subLocations || "—"}
            </div>
          </div>
          <div>
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 600,
                letterSpacing: "0.04em",
                color: "rgba(148,163,184,1)",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
              }}
            >
              Total Items (incl. sub-locations)
            </div>
            <div style={{ marginTop: 2, fontSize: 17, fontWeight: 700, color: "#111827" }}>
              {info.itemsStored}
            </div>
          </div>
        </div>

        <div className="flex items-center flex-wrap" style={{ gap: 6, marginTop: 12 }}>
          <span
            className="inline-flex items-center"
            style={{
              height: 21,
              padding: "0 8px",
              borderRadius: 6,
              fontFamily: FONT,
              fontSize: 12,
              fontWeight: 600,
              lineHeight: 1,
              whiteSpace: "nowrap",
              ...(isActive
                ? { background: "#ECFDF5", color: "#065F46", border: "1px solid #A7F3D0" }
                : { background: "#FFFBEB", color: "#92400E", border: "1px solid #FDE68A" }),
            }}
          >
            {info.status}
          </span>
          <span
            className="inline-flex items-center"
            style={{
              height: 21,
              padding: "0 8px",
              borderRadius: 6,
              fontFamily: FONT,
              fontSize: 12,
              fontWeight: 500,
              lineHeight: 1,
              whiteSpace: "nowrap",
              gap: 4,
              background: "rgba(247,247,248,1)",
              color: "rgba(104,114,125,1)",
              border: "1px solid rgba(234,235,240,1)",
            }}
          >
            <Globe size={11} style={{ flexShrink: 0 }} />
            {info.country}
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}

interface LocationHoverCardProps {
  code: string;
  name?: string;
  children: ReactNode;
  className?: string;
  block?: boolean;
}

/** Wraps a location tag; reveals a rich preview card on hover. */
export function LocationHoverCard({ code, name, children, className, block }: LocationHoverCardProps) {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const openTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const forceClose = useCallback(() => {
    clearTimeout(openTimer.current);
    clearTimeout(closeTimer.current);
    setPos(null);
  }, []);

  useEffect(() => {
    const unregister = registerClose(forceClose);
    return () => {
      clearTimeout(openTimer.current);
      clearTimeout(closeTimer.current);
      unregister();
    };
  }, [forceClose]);

  const handleEnter = () => {
    clearTimeout(closeTimer.current);
    clearTimeout(openTimer.current);
    openTimer.current = setTimeout(() => {
      const el = triggerRef.current;
      if (!el) return;
      closeAllExcept(forceClose);
      const rect = el.getBoundingClientRect();
      let left = rect.left;
      if (left + CARD_W > window.innerWidth - 12) left = window.innerWidth - CARD_W - 12;
      if (left < 12) left = 12;
      setPos({ top: rect.bottom + 8, left });
    }, OPEN_DELAY);
  };
  const handleLeave = () => {
    clearTimeout(openTimer.current);
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setPos(null), CLOSE_DELAY);
  };

  return (
    <span
      ref={triggerRef}
      className={className}
      style={block ? { display: "block" } : { display: "inline-flex", maxWidth: "100%" }}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      {children}
      {pos && (
        <HoverCard
          code={code}
          name={name}
          top={pos.top}
          left={pos.left}
          onEnter={() => {
            clearTimeout(closeTimer.current);
          }}
          onLeave={handleLeave}
        />
      )}
    </span>
  );
}

export default LocationHoverCard;
