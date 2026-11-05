import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Mail, Phone, Briefcase } from "lucide-react";
import { getAvatarTint } from "./avatarTints";

/* Deterministic per-name mock so contact details stay stable across
   renders. Same hashing shape as CustomerHoverCard. */
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
  return Math.abs(h);
}
function pick<T>(arr: T[], seed: string): T {
  return arr[hashStr(seed) % arr.length];
}

const DEPARTMENTS = ["Warehouse Ops", "Fulfillment", "Logistics", "Shipping", "Inventory"];
const DOMAINS = ["omnesoft.com", "omnesoft-ops.com"];

function mockPersonData(name: string, dept?: string) {
  const department = dept || pick(DEPARTMENTS, name + "d");
  const domain = pick(DOMAINS, name + "m");
  const local = name.toLowerCase().replace(/[^a-z]/g, ".").replace(/^\.+|\.+$/g, "").slice(0, 20);
  const email = `${local}@${domain}`;
  const phone = `+1 (${(hashStr(name + "p1") % 900) + 100}) ${(hashStr(name + "p2") % 900) + 100}-${(hashStr(name + "p3") % 9000) + 1000}`;
  return { department, email, phone };
}

interface Props {
  name: string;
  initials?: string;
  role: string;
  /** Optional override — if omitted, the department is generated
   *  deterministically from the name. */
  department?: string;
  /** Optional email override. */
  email?: string;
  /** Optional phone override. */
  phone?: string;
  children: React.ReactNode;
}

/** Partner-consistent user hover card — dark slate header + white
 *  body with role / dept / email / phone rows. Same portal-based
 *  positioning + hover-timer approach as `CustomerHoverCard` so the
 *  two cards feel identical. */
export function PersonHoverCard({
  name,
  initials,
  role,
  department,
  email,
  phone,
  children,
}: Props) {
  const [open, setOpen] = useState(false);
  const [timer, setTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLDivElement | null>(null);
  const tint = getAvatarTint(name);
  const derived = mockPersonData(name, department);
  const fallbackInitials = initials || name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
  const finalEmail = email || derived.email;
  const finalPhone = phone || derived.phone;

  useEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setCoords({ top: rect.bottom + 6, left: rect.left });
  }, [open]);

  const handleEnter = () => {
    if (timer) clearTimeout(timer);
    const t = setTimeout(() => setOpen(true), 250);
    setTimer(t);
  };

  const handleLeave = () => {
    if (timer) clearTimeout(timer);
    const t = setTimeout(() => setOpen(false), 120);
    setTimer(t);
  };

  return (
    <div ref={triggerRef} className="inline-block" onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
      {children}
      {open && coords && typeof document !== "undefined" && createPortal(
        <div
          onMouseEnter={handleEnter}
          onMouseLeave={handleLeave}
          className="fixed"
          style={{
            top: coords.top,
            left: coords.left,
            width: 300,
            zIndex: 1000,
            borderRadius: 12,
            overflow: "hidden",
            boxShadow: "0 0 0 1px rgba(0,0,0,0.04), 0 8px 20px rgba(0,0,0,0.08), 0 24px 56px rgba(0,0,0,0.12)",
            animation: "fadeIn 150ms ease-out",
          }}
        >
          {/* Dark header — matches Partner's PersonHoverCard chrome
              (slate-800 → slate-700 gradient + soft white circle glow). */}
          <div className="px-4 pt-4 pb-3 relative overflow-hidden" style={{ background: "linear-gradient(135deg, #0C1222 0%, #162033 100%)" }}>
            <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full" style={{ background: "rgba(255,255,255,0.04)" }} />
            <div className="flex items-center gap-3 relative">
              <div
                className="rounded-full flex items-center justify-center shrink-0"
                style={{ width: 44, height: 44, backgroundColor: tint.bg, color: tint.fg, fontSize: 13, fontWeight: 700, border: "2px solid rgba(255,255,255,0.15)" }}
              >
                {fallbackInitials}
              </div>
              <div className="min-w-0">
                <div className="text-white truncate" style={{ fontSize: 14, fontWeight: 600 }}>{name}</div>
                <div className="text-white/50 truncate" style={{ fontSize: 11, fontWeight: 500, marginTop: 2 }}>{role}</div>
              </div>
            </div>
          </div>

          {/* White body — role/dept/email/phone rows with muted icon
              tiles, same shape as CustomerHoverCard's contact block. */}
          <div className="bg-white" style={{ padding: "10px 14px 12px" }}>
            <InfoLine icon={Briefcase} label={role} />
            <InfoLine icon={Mail} label={finalEmail} />
            <InfoLine icon={Phone} label={finalPhone} />
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

function InfoLine({ icon: Icon, label }: { icon: typeof Mail; label: string }) {
  return (
    <div className="flex items-center gap-2.5" style={{ padding: "5px 0" }}>
      <div className="rounded-md flex items-center justify-center shrink-0" style={{ width: 22, height: 22, background: "#F1F5F9" }}>
        <Icon style={{ width: 11, height: 11, color: "#94A3B8" }} />
      </div>
      <span className="text-[#0F172A] truncate" style={{ fontSize: 12, fontWeight: 500 }}>{label}</span>
    </div>
  );
}
