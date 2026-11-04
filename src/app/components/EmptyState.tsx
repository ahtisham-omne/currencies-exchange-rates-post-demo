/* Shared empty state — the Coming-Soon placeholder's visual language
 * exactly (user 10/1): same 64px gradient icon tile, ping halo, float
 * animation, heading and body scale. Only the icon and copy change per
 * surface. Use it wherever a tab or card has nothing to show yet. */
export function EmptyState({ icon: Icon, title, description }: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center" style={{ animation: 'esFade 0.4s ease-out both' }}>
      <div className="relative mb-6">
        <div className="absolute inset-0 w-16 h-16 rounded-2xl bg-primary/5 animate-ping" style={{ animationDuration: '3s' }} />
        <div
          className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-50 to-accent border border-border flex items-center justify-center shadow-sm"
          style={{ animation: 'esFloat 4s ease-in-out infinite' }}
        >
          <Icon className="w-7 h-7 text-slate-400" />
        </div>
      </div>
      <h3 className="text-foreground text-[16px] mb-1.5" style={{ fontWeight: 600 }}>{title}</h3>
      <p className="text-slate-400 text-[13px] max-w-sm leading-relaxed">{description}</p>
      <style>{`
        @keyframes esFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
        @keyframes esFade { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
