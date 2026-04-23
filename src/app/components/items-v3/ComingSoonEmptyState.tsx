// Shared "Coming Soon" empty-state atom — verbatim Partners `PlaceholderTab`
// (Vendor Detail page). Solid bordered card, gradient rounded-square icon
// tile, animated ping halo, "Coming Soon" pill, heading, muted description.
// Four CSS-only animations: ping halo, csFloat tile, pill dot pulse, and a
// staggered csFade cascade on pill / heading / description. Keyframes are
// inlined so no global stylesheet changes are required.
import * as React from "react";
import { FileText, type LucideIcon } from "lucide-react";

interface ComingSoonEmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
}

export function ComingSoonEmptyState({
  icon: Icon,
  title,
  description,
}: ComingSoonEmptyStateProps) {
  const DisplayIcon = Icon || FileText;
  return (
    <div className="border border-border rounded-xl bg-card overflow-hidden" style={{ minHeight: 400 }}>
      <div className="flex flex-col items-center justify-center w-full h-full py-24 px-6 text-center">
        {/* Animated icon */}
        <div className="relative mb-6">
          <div
            className="absolute inset-0 w-16 h-16 rounded-2xl bg-primary/5 animate-ping"
            style={{ animationDuration: "3s" }}
          />
          <div
            className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-50 to-accent border border-border flex items-center justify-center shadow-sm"
            style={{ animation: "csFloat 4s ease-in-out infinite" }}
          >
            <DisplayIcon className="w-7 h-7 text-slate-400" />
          </div>
        </div>
        <div
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted border border-border mb-3"
          style={{ animation: "csFade 0.5s ease-out both", animationDelay: "0.1s" }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          <span className="text-[11px] text-muted-foreground" style={{ fontWeight: 600 }}>Coming Soon</span>
        </div>
        <h3
          className="text-foreground text-[16px] mb-1.5"
          style={{ fontWeight: 600, animation: "csFade 0.5s ease-out both", animationDelay: "0.2s" }}
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
      <style>{`
        @keyframes csFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
        @keyframes csFade { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
