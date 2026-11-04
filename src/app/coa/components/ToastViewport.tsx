// Ported from chart-of-accounts-v2.1/src/components/AppShell.tsx (ToastViewport); adapted: reads the kit toast store (lib/toast) instead of zustand, portalled to body.
import { createPortal } from 'react-dom'
import { X, CheckCircle2, Info, AlertCircle } from 'lucide-react'
import { cn } from '../lib/utils'
import { useToasts, dismissToast } from '../lib/toast'

// Global, auto-dismissing toast stack (top-right, tinted - matches the
// Partner module's sonner richColors toasts). Backed by the kit toast store so
// any flow can fire one via pushToast(...). Mount once, in the app layout.
export function ToastViewport() {
  const toasts = useToasts()
  const dismiss = dismissToast
  if (toasts.length === 0) return null
  const tone = {
    success: { box: 'bg-success-50 border-success-100 text-success-700', icon: 'fill-success-600 text-success-50', Icon: CheckCircle2 },
    info: { box: 'bg-info-50 border-info-100 text-info-700', icon: 'fill-info-600 text-info-50', Icon: Info },
    danger: { box: 'bg-danger-50 border-danger-100 text-danger-700', icon: 'fill-danger-600 text-danger-50', Icon: AlertCircle },
  }
  return createPortal(
    <div className="fixed top-16 right-4 z-[80] flex flex-col gap-2 w-80 max-w-[calc(100vw-2rem)]">
      {toasts.map(t => {
        const c = tone[t.tone]
        const Icon = c.Icon
        return (
          <div key={t.id} className={cn('flex items-start gap-2.5 rounded-xl border shadow-lg px-3.5 py-3 animate-[treeRowIn_240ms_ease-out]', c.box)}>
            <Icon size={18} className={cn('shrink-0 mt-px', c.icon)} />
            <div className="flex-1 min-w-0">
              <div className="text-sm" style={{ fontWeight: 500 }}>{t.message}</div>
              {t.description && <div className="text-xs opacity-80 mt-0.5">{t.description}</div>}
              {t.action && (
                <button
                  onClick={() => { t.action!.onClick(); dismiss(t.id) }}
                  className="mt-1.5 inline-flex items-center h-7 px-2.5 rounded-md border border-current/30 bg-white/60 text-xs font-semibold hover:bg-white transition-colors"
                >
                  {t.action.label}
                </button>
              )}
            </div>
            <button onClick={() => dismiss(t.id)} className="shrink-0 opacity-50 hover:opacity-100"><X size={15} /></button>
          </div>
        )
      })}
    </div>,
    document.body,
  )
}
