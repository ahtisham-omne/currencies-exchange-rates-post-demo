import { Check, FileText, Send, CheckCircle2, Package, Archive, XCircle, Clock, Ban, ThumbsDown } from 'lucide-react';

export type QuoteLifecycleStatus = 'draft' | 'sent' | 'confirmed' | 'converted' | 'rejected' | 'cancelled' | 'archived' | 'expired';

interface ModernStatusStepperProps {
  currentStatus: QuoteLifecycleStatus;
}

const MAIN_STEPS = [
  { id: 'draft' as const, label: 'Draft', icon: FileText, fillColor: 'var(--foreground)', ringColor: 'var(--muted-foreground)', bgTint: null },
  { id: 'sent' as const, label: 'Sent to Customer', icon: Send, fillColor: 'var(--primary)', ringColor: 'rgba(10, 119, 255, 0.4)', bgTint: 'var(--accent)' },
  { id: 'confirmed' as const, label: 'Confirmed by Customer', icon: CheckCircle2, fillColor: 'var(--violet)', ringColor: '#C4B5FD', bgTint: '#EDE9FE' },
  { id: 'converted' as const, label: 'Sales Order Conversion', icon: Package, fillColor: 'var(--success)', ringColor: '#34D399', bgTint: 'rgba(5, 150, 105, 0.2)' },
];

const TERMINAL_STATES: Record<string, { label: string; icon: typeof XCircle; fillColor: string; ringColor: string; bgTint: string }> = {
  rejected: { label: 'Rejected', icon: ThumbsDown, fillColor: 'var(--destructive)', ringColor: '#FCA5A5', bgTint: 'rgba(220, 38, 38, 0.2)' },
  cancelled: { label: 'Cancelled', icon: XCircle, fillColor: 'var(--destructive)', ringColor: '#FCA5A5', bgTint: 'rgba(220, 38, 38, 0.2)' },
  archived: { label: 'Archived', icon: Archive, fillColor: 'var(--destructive)', ringColor: '#FCA5A5', bgTint: 'rgba(220, 38, 38, 0.2)' },
  expired: { label: 'Expired', icon: Clock, fillColor: 'var(--destructive)', ringColor: '#FCA5A5', bgTint: 'rgba(220, 38, 38, 0.2)' },
};

export function getStepperBackground(status: QuoteLifecycleStatus): string {
  const isTerminal = status === 'rejected' || status === 'cancelled' || status === 'archived' || status === 'expired';
  if (isTerminal) {
    const terminal = TERMINAL_STATES[status];
    if (!terminal) return 'var(--background)';
    return `linear-gradient(135deg, var(--background) 40%, ${terminal.bgTint}60 100%)`;
  }
  const stepIndex = MAIN_STEPS.findIndex(s => s.id === status);
  const step = stepIndex >= 0 ? MAIN_STEPS[stepIndex] : null;
  if (!step || !step.bgTint) return 'var(--background)';
  const centerX = Math.round((stepIndex / (MAIN_STEPS.length - 1)) * 100);
  if (status === 'converted') {
    return `linear-gradient(160deg, #34D399 0%, #2DD4A0 40%, var(--success) 100%)`;
  }
  return `radial-gradient(ellipse 70% 200% at ${centerX}% 100%, ${step.bgTint}70 0%, var(--background) 80%)`;
}

export function ModernStatusStepper({ currentStatus }: ModernStatusStepperProps) {
  const isTerminal = currentStatus === 'rejected' || currentStatus === 'cancelled' || currentStatus === 'archived' || currentStatus === 'expired';
  const terminalConfig = isTerminal ? TERMINAL_STATES[currentStatus] : null;

  const getTerminalBranchIndex = (): number => {
    if (currentStatus === 'archived') return 1;
    if (currentStatus === 'expired') return 1;
    if (currentStatus === 'cancelled') return 1;
    /* Rejected branches from Sent step — customer received the quote
       and declined. Stepper shows Draft → Sent completed, then the
       rejected terminal chip forks off. */
    if (currentStatus === 'rejected') return 1;
    return 0;
  };

  const terminalBranchIndex = isTerminal ? getTerminalBranchIndex() : -1;
  const currentIndex = isTerminal ? terminalBranchIndex : MAIN_STEPS.findIndex(s => s.id === currentStatus);

  const greenSolid = "var(--success)";
  const greenGlow = "color-mix(in srgb, var(--success) 18%, transparent)";

  return (
    <div style={{ display: 'flex', alignItems: 'center', width: '100%', padding: '4px 0' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          flex: isTerminal && terminalConfig ? '0 0 78%' : '1 1 auto',
          minWidth: 0,
        }}
      >
      {MAIN_STEPS.map((step, i) => {
        const Icon = step.icon;
        let state: 'completed' | 'current' | 'pending' | 'terminated' = 'pending';
        if (isTerminal) {
          if (i <= terminalBranchIndex) state = 'completed';
          else state = 'terminated';
        } else {
          if (i < currentIndex) state = 'completed';
          else if (i === currentIndex) state = 'current';
        }
        const isLast = i === MAIN_STEPS.length - 1;

        const circleStyle: React.CSSProperties = state === 'completed'
          ? { backgroundColor: greenSolid, boxShadow: `0 2px 6px ${greenGlow}` }
          : state === 'current'
            ? { backgroundColor: step.fillColor, boxShadow: `0 0 0 4px color-mix(in srgb, ${step.fillColor} 16%, transparent), 0 2px 8px color-mix(in srgb, var(--foreground) 8%, transparent)` }
            : state === 'terminated'
              ? { backgroundColor: 'transparent', border: '2px solid var(--border)' }
              : { backgroundColor: 'transparent', border: '2px solid var(--border)' };

        const terminatedTextColor = isTerminal ? 'rgba(0,0,0,0.25)' : 'var(--muted-foreground)';
        const terminatedIconColor = isTerminal ? 'rgba(0,0,0,0.2)' : 'var(--muted-foreground)';

        return (
          <div key={step.id} className="contents">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, padding: '2px 4px' }}>
              <div style={{
                width: state === 'current' ? 28 : state === 'completed' ? 24 : 22,
                height: state === 'current' ? 28 : state === 'completed' ? 24 : 22,
                borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                ...circleStyle,
              }}>
                {state === 'completed'
                  ? <Check style={{ width: 12, height: 12, color: 'var(--primary-foreground)' }} strokeWidth={3} />
                  : <Icon style={{
                      width: state === 'current' ? 14 : 12,
                      height: state === 'current' ? 14 : 12,
                      color: state === 'current' ? 'var(--primary-foreground)' : state === 'terminated' ? terminatedIconColor : 'var(--muted-foreground)',
                      opacity: state === 'pending' ? 0.35 : 1,
                      strokeWidth: state === 'current' ? 2.5 : 2,
                    }} />
                }
              </div>
              <span style={{
                fontSize: 12, whiteSpace: 'nowrap', lineHeight: 1, letterSpacing: '-0.01em',
                fontWeight: state === 'current' ? 600 : state === 'completed' ? 500 : 450,
                color: state === 'completed' ? greenSolid
                  : state === 'current' ? 'var(--foreground)'
                  : state === 'terminated' ? terminatedTextColor
                  : 'var(--muted-foreground)',
                opacity: state === 'pending' ? 0.5 : 1,
                transition: 'all 0.3s ease',
              }}>
                {step.label}
              </span>
            </div>
            {!isLast && (
              <div style={{ flex: '1 1 0%', margin: '0 10px', minWidth: 12, height: 4, position: 'relative' }}>
                {(state === 'completed' && (i + 1 <= currentIndex || (isTerminal && i + 1 <= terminalBranchIndex))) ? (
                  <div style={{ position: 'absolute', inset: 0, height: 2.5, top: '50%', transform: 'translateY(-50%)', borderRadius: 2, backgroundColor: greenSolid }} />
                ) : (
                  <div style={{
                    position: 'absolute', inset: 0, height: 2, top: '50%', transform: 'translateY(-50%)', borderRadius: 2,
                    backgroundColor: state === 'terminated' ? 'rgba(0,0,0,0.08)' : 'var(--border)',
                    WebkitMaskImage: 'repeating-linear-gradient(90deg, black 0px, black 5px, transparent 5px, transparent 10px)',
                    maskImage: 'repeating-linear-gradient(90deg, black 0px, black 5px, transparent 5px, transparent 10px)',
                    opacity: 0.65,
                  }} />
                )}
              </div>
            )}
          </div>
        );
      })}

      </div>

      {/* Terminal state badge — gapped from the last step so the
          cancelled/archived chip reads as separate from the
          stepper rather than crowding the final node. */}
      {isTerminal && terminalConfig && (
        <div style={{ flex: '1 1 auto', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, paddingLeft: 24, paddingRight: 4 }}>
          <div style={{
            width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: terminalConfig.fillColor, boxShadow: `0 2px 6px color-mix(in srgb, ${terminalConfig.fillColor} 18%, transparent)`,
          }}>
            <terminalConfig.icon style={{ width: 12, height: 12, color: 'var(--primary-foreground)' }} strokeWidth={2.5} />
          </div>
          <span style={{ fontSize: 12, fontWeight: 600, color: terminalConfig.fillColor, whiteSpace: 'nowrap', lineHeight: 1, letterSpacing: '-0.01em' }}>
            {terminalConfig.label}
          </span>
        </div>
      )}
    </div>
  );
}
