import type { ElementType } from 'react';
import { FileText } from 'lucide-react';

// Coming Soon tab — the partner details placeholder, ported exactly
// (10/1/26): floating gradient icon tile with a slow ping halo, staged
// fade-in pill/heading/body. One deliberate difference: the pill drops
// its pulsing dot (status pills are label-on-tone only, 8/7/26).
// Notes, Communication, and Recent Activity wear this on every detail
// page until their backends land; Attachments stays live.
export function ComingSoonTab({
  label,
  description,
  icon: Icon,
}: {
  label: string;
  description: string;
  icon?: ElementType;
}) {
  const DisplayIcon = Icon || FileText;
  return (
    // Fills the column to the bottom of the viewport (user 10/1) so the
    // placeholder never strands dead page space below it; the content
    // centers inside whatever height that gives.
    <div className="border border-border rounded-xl bg-white overflow-hidden flex flex-col" style={{ minHeight: 'max(400px, calc(100vh - 269px))' }}>
      <div className="flex-1 flex flex-col items-center justify-center w-full py-12 px-6 text-center">
        {/* Animated icon */}
        <div className="relative mb-6">
          <div className="absolute inset-0 w-16 h-16 rounded-2xl bg-primary/5 animate-ping" style={{ animationDuration: '3s' }} />
          <div
            className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-50 to-accent border border-border flex items-center justify-center shadow-sm"
            style={{ animation: 'csFloat 4s ease-in-out infinite' }}
          >
            <DisplayIcon className="w-7 h-7 text-slate-400" />
          </div>
        </div>
        <div
          className="inline-flex items-center px-3 py-1 rounded-full bg-muted border border-border mb-3"
          style={{ animation: 'csFade 0.5s ease-out both', animationDelay: '0.1s' }}
        >
          <span className="text-[11px] text-muted-foreground" style={{ fontWeight: 600 }}>Coming Soon</span>
        </div>
        <h3
          className="text-foreground text-[16px] mb-1.5"
          style={{ fontWeight: 600, animation: 'csFade 0.5s ease-out both', animationDelay: '0.2s' }}
        >
          {label}
        </h3>
        <p
          className="text-slate-400 text-[13px] max-w-sm leading-relaxed"
          style={{ animation: 'csFade 0.5s ease-out both', animationDelay: '0.3s' }}
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
