import type { ElementType } from 'react'
import { FileText } from 'lucide-react'

/* The canonical Coming Soon empty state, ported from Partners
   (PartnerGroupDetailsPage's PlaceholderTab) so a tab waiting on a backend
   reads the same in every Omne module: animated icon chip, pulse-dot pill,
   label, description. Mahad, 2026-09-29: *"This is how partners has them. I
   want them exactly the same in COA module as well."* */
export function PlaceholderTab({ label, description, icon: Icon }: {
  label: string
  description: string
  icon?: ElementType
}) {
  const DisplayIcon = Icon || FileText
  return (
    <div className="border border-border rounded-xl bg-card overflow-hidden" style={{ minHeight: 400 }}>
      <div className="flex flex-col items-center justify-center w-full h-full py-24 px-6 text-center">
        <div className="relative mb-6">
          <div className="absolute inset-0 w-16 h-16 rounded-2xl bg-primary/5 animate-ping" style={{ animationDuration: '3s' }} />
          <div
            className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-50 to-accent border border-border flex items-center justify-center shadow-sm"
            style={{ animation: 'pgcsFloat 4s ease-in-out infinite' }}
          >
            <DisplayIcon className="w-7 h-7 text-slate-400" />
          </div>
        </div>
        <div
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted border border-border mb-3"
          style={{ animation: 'pgcsFade 0.5s ease-out both', animationDelay: '0.1s' }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          <span className="text-[11px] text-muted-foreground" style={{ fontWeight: 600 }}>Coming Soon</span>
        </div>
        <h3
          className="text-foreground text-[16px] mb-1.5"
          style={{ fontWeight: 600, animation: 'pgcsFade 0.5s ease-out both', animationDelay: '0.2s' }}
        >
          {label}
        </h3>
        <p
          className="text-slate-400 text-[13px] max-w-sm leading-relaxed"
          style={{ animation: 'pgcsFade 0.5s ease-out both', animationDelay: '0.3s' }}
        >
          {description}
        </p>
      </div>
      <style>{`
        @keyframes pgcsFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
        @keyframes pgcsFade { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  )
}
