import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, Users, MapPin, CreditCard, UserCheck } from 'lucide-react';

/* Brief full-screen overlay shown after the user confirms a customer
   change. Lists what's getting hydrated so the user understands the
   reset isn't a destructive wipe — it's pulling the new customer's
   defaults from the partner record. Auto-dismisses after ~900ms so
   the actual hydration (already synchronous) lands before the
   overlay clears, giving the sidebar a moment to settle. */
interface Props {
  fromCustomer: string;
  toCustomer: string;
  onDone: () => void;
}

const STEPS = [
  { icon: Users, label: 'Loading default point of contact' },
  { icon: UserCheck, label: 'Assigning sales rep' },
  { icon: MapPin, label: 'Pulling billing and shipping addresses' },
  { icon: CreditCard, label: 'Applying payment terms and method' },
];

export function CustomerSwitchOverlay({ fromCustomer, toCustomer, onDone }: Props) {
  const [completed, setCompleted] = useState<number>(0);
  useEffect(() => {
    /* Walk through each "loading" step on a short interval so the
       overlay feels like real work without holding the UI more than
       the user would tolerate. After the last step we wait one more
       beat, then signal completion. */
    let cancelled = false;
    const total = STEPS.length;
    let step = 0;
    const tick = () => {
      if (cancelled) return;
      step += 1;
      setCompleted(step);
      if (step < total) {
        setTimeout(tick, 180);
      } else {
        setTimeout(() => { if (!cancelled) onDone(); }, 280);
      }
    };
    setTimeout(tick, 120);
    return () => { cancelled = true; };
  }, [onDone]);

  return createPortal(
    <div
      className="fixed inset-0 z-[12700] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(2px)' }}
    >
      <div
        className="bg-white rounded-2xl px-7 py-6"
        style={{ width: 'min(420px, calc(100% - 2rem))', boxShadow: '0 24px 80px -12px rgba(0,0,0,0.35)' }}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#EFF6FF' }}>
            <Loader2 className="w-4 h-4 text-primary animate-spin" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px]" style={{ fontWeight: 600, color: 'var(--foreground)' }}>Changing customer</div>
            <div className="text-[11px] truncate" style={{ color: 'var(--muted-foreground)' }}>
              {fromCustomer} → {toCustomer}
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          {STEPS.map((step, idx) => {
            const isDone = idx < completed;
            const isActive = idx === completed;
            return (
              <div key={idx} className="flex items-center gap-2.5">
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                  style={{
                    background: isDone ? '#10B981' : isActive ? '#EFF6FF' : '#F1F5F9',
                    border: `1px solid ${isDone ? '#10B981' : isActive ? 'var(--primary)' : 'var(--border)'}`,
                    transition: 'background 180ms ease, border-color 180ms ease',
                  }}
                >
                  {isDone ? (
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6.5L4.5 9L10 3" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : isActive ? (
                    <Loader2 className="w-2.5 h-2.5 text-primary animate-spin" />
                  ) : (
                    <step.icon className="w-2.5 h-2.5 text-muted-foreground" />
                  )}
                </div>
                <span
                  className="text-[12px]"
                  style={{
                    color: isDone || isActive ? 'var(--foreground)' : 'var(--muted-foreground)',
                    fontWeight: isActive ? 500 : 400,
                  }}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
}
