/* Ported from the financial reporting module (components/fr/comms/MailboxPill.tsx).

   Deliberately NOT this module's `Pill` from ui.tsx. That one fills solid brand
   blue when active, which is a different control: this is a rounded-full
   bordered pill that tints, and the two do not read as the same family. Porting
   the tab meant porting the pill it is built from. */
export function MailboxPill({
  label,
  count,
  isActive,
  onClick,
  showCount = true,
}: {
  label: string
  count: number
  isActive: boolean
  onClick: () => void
  showCount?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isActive}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
        isActive
          ? 'border-primary bg-[var(--color-brand-75)] hover:bg-[var(--color-brand-150)] active:bg-[var(--color-brand-250)]'
          : 'border-border bg-white text-fg-muted hover:bg-bg-subtle hover:text-fg active:bg-bg-muted'
      }`}
      style={{
        fontWeight: isActive ? 500 : 400,
        color: isActive ? 'var(--color-brand-500)' : undefined,
      }}
    >
      {label}
      {showCount && (
        <span
          className={`text-[10px] rounded-full px-1.5 py-px min-w-[18px] text-center ${
            isActive ? 'bg-primary/10' : 'bg-bg-muted'
          }`}
          style={{
            fontWeight: 600,
            color: isActive ? 'var(--color-brand-500)' : 'var(--color-slate-600)',
          }}
        >
          {count}
        </span>
      )}
    </button>
  )
}
