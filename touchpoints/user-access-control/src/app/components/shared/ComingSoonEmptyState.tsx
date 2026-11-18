import type { ElementType } from "react";
import { Settings2 } from "lucide-react";

interface ComingSoonEmptyStateProps {
  title: string;
  description: string;
  /** Defaults to the same Settings2 glyph the GL Accounts tab uses. */
  icon?: ElementType;
}

/** Centred coming-soon empty state.
 *
 *  Ported from the Partner Detail page's `PlaceholderTab` (Partner Management,
 *  `VendorDetailsPage.tsx:2376`) — the treatment the GL Accounts tab renders.
 *  Colours are written as literal hex because that repo's `--border` / `--muted`
 *  / `--accent` / `--primary` tokens resolve to different values here; these are
 *  the resolved partner values so the two surfaces match.
 *
 *  Three animations, all plain CSS: a 4s float on the icon tile, a slow `ping`
 *  glow ring behind it, and a staggered `csFade` entry on the pill, title and
 *  paragraph. */
export function ComingSoonEmptyState({
  title,
  description,
  icon: Icon = Settings2,
}: ComingSoonEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center w-full h-full py-24 px-6 text-center">
      {/* Animated icon */}
      <div className="relative mb-6">
        <div
          className="absolute inset-0 w-16 h-16 rounded-2xl animate-ping"
          style={{ backgroundColor: "rgba(10,119,255,0.05)", animationDuration: "3s" }}
        />
        <div
          className="relative w-16 h-16 rounded-2xl border border-[#E2E8F0] flex items-center justify-center shadow-sm"
          style={{
            backgroundImage: "linear-gradient(to bottom right, #F8FAFC, #EBF4FF)",
            animation: "csFloat 4s ease-in-out infinite",
          }}
        >
          <Icon className="w-7 h-7 text-slate-400" />
        </div>
      </div>

      <div
        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F1F5F9] border border-[#E2E8F0] mb-3"
        style={{ animation: "csFade 0.5s ease-out both", animationDelay: "0.1s" }}
      >
        <span
          className="w-1.5 h-1.5 rounded-full animate-pulse"
          style={{ backgroundColor: "#0A77FF" }}
        />
        <span className="text-[11px] text-[#48566A]" style={{ fontWeight: 600 }}>
          Coming Soon
        </span>
      </div>

      <h3
        className="text-[#0F172A] text-[16px] mb-1.5"
        style={{
          fontWeight: 600,
          lineHeight: 1.5,
          letterSpacing: "-0.015em",
          animation: "csFade 0.5s ease-out both",
          animationDelay: "0.2s",
        }}
      >
        {title}
      </h3>
      <p
        className="text-slate-400 text-[13px] max-w-sm leading-relaxed"
        style={{ animation: "csFade 0.5s ease-out both", animationDelay: "0.3s" }}
      >
        {description}
      </p>
    </div>
  );
}
