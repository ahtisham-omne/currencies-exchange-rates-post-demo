/* Shared empty state — 1:1 port of the partner details page recipe
 * (floating icon tile + fade-in, title, description, no CTA). Use it
 * wherever a tab or card has nothing to show yet. */
export function EmptyState({ icon: Icon, title, description }: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center" style={{ animation: 'csFade 0.4s ease-out both' }}>
      <div className="relative mb-3">
        <div
          className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-50 to-muted border border-border flex items-center justify-center shadow-sm"
          style={{ animation: 'csFloat 4s ease-in-out infinite' }}
        >
          <Icon className="w-5 h-5 text-slate-400" />
        </div>
      </div>
      <p className="text-[13px] text-slate-700 mb-0.5" style={{ fontWeight: 600 }}>{title}</p>
      <p className="text-[12px] text-slate-400 max-w-xs leading-relaxed">{description}</p>
    </div>
  );
}
