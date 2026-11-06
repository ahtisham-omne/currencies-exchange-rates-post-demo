import { ArrowRight, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';

interface QuoteCreatedSuccessProps {
  quoteId: string;
  customerName: string;
  totalAmount: string;
  onClose: () => void;
  onCreateAnother?: () => void;
  onViewQuote?: () => void;
}

export function QuoteCreatedSuccess({
  quoteId,
  customerName,
  totalAmount,
  onClose,
  onCreateAnother,
  onViewQuote,
}: QuoteCreatedSuccessProps) {
  const [phase, setPhase] = useState<'circle' | 'check' | 'content' | 'done'>('circle');
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    // Phase timeline — all within 1.2s
    const t1 = setTimeout(() => setPhase('check'), 300);    // circle expands 0→300ms
    const t2 = setTimeout(() => setPhase('content'), 650);  // check draws 300→650ms
    const t3 = setTimeout(() => setPhase('done'), 1000);    // content fades in 650→1000ms
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  // Countdown timer — starts after animation
  useEffect(() => {
    if (phase !== 'done') return;
    if (countdown <= 0) {
      if (onViewQuote) { onViewQuote(); } else { onClose(); }
      return;
    }
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown, phase, onClose, onViewQuote]);

  const handleViewDetails = () => {
    if (onViewQuote) { onViewQuote(); } else { onClose(); }
  };

  const handleCreateAnother = () => {
    if (onCreateAnother) { onCreateAnother(); } else { onClose(); }
  };

  const circleReady = phase !== 'circle';
  const checkReady = phase === 'content' || phase === 'done';
  const contentReady = phase === 'done';

  return (
    <div className="px-6 py-8">
      <style>{`
        @keyframes success-circle-pop {
          0%   { transform: scale(0); opacity: 0; }
          60%  { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes success-ring-expand {
          0%   { transform: scale(0.6); opacity: 0.8; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        @keyframes success-check-draw {
          0%   { stroke-dashoffset: 24; }
          100% { stroke-dashoffset: 0; }
        }
        @keyframes success-fade-up {
          0%   { opacity: 0; transform: translateY(8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes success-countdown-shrink {
          from { width: 100%; }
          to   { width: 0%; }
        }
      `}</style>

      <div className="w-full flex flex-col items-center text-center">
        {/* Animated Check Circle — main visual */}
        <div className="relative mb-5" style={{ width: '64px', height: '64px' }}>
          {/* Expanding ring burst */}
          {circleReady && (
            <div
              className="absolute inset-0 rounded-full"
              style={{
                backgroundColor: 'transparent',
                borderWidth: '3px',
                borderStyle: 'solid',
                borderColor: 'var(--success)',
                animation: 'success-ring-expand 500ms ease-out forwards',
              }}
            />
          )}

          {/* Main circle */}
          <div
            className="absolute inset-0 rounded-full flex items-center justify-center"
            style={{
              backgroundColor: 'var(--success)',
              animation: 'success-circle-pop 350ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
              transform: 'scale(0)',
            }}
          >
            {/* Animated SVG check stroke */}
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <path
                d="M6 12.5L10.5 17L18 8"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  strokeDasharray: 24,
                  strokeDashoffset: checkReady ? 0 : 24,
                  animation: checkReady ? 'success-check-draw 350ms ease-out forwards' : 'none',
                }}
              />
            </svg>
          </div>
        </div>

        {/* Minimal text — quote ID is the hero */}
        <div
          style={{
            opacity: contentReady ? 1 : 0,
            transform: contentReady ? 'translateY(0)' : 'translateY(8px)',
            transition: 'all 350ms ease-out',
          }}
        >
          <div className="text-[13px] text-muted-foreground mb-0.5" style={{ fontWeight: 500 }}>
            Created
          </div>
          <div className="text-[18px] text-primary mb-1" style={{ fontWeight: 700, letterSpacing: '-0.01em', fontFamily: 'monospace' }}>
            {quoteId}
          </div>
          <div className="text-[12px] text-muted-foreground" style={{ fontWeight: 400 }}>
            {customerName}
          </div>
        </div>

        {/* Action Buttons — appear after animation */}
        <div
          className="w-full mt-6"
          style={{
            opacity: contentReady ? 1 : 0,
            transform: contentReady ? 'translateY(0)' : 'translateY(6px)',
            transition: 'all 300ms ease-out 100ms',
          }}
        >
          {/* Primary: View Quote with countdown progress bar */}
          <button
            onClick={handleViewDetails}
            className="w-full flex items-center justify-center h-9 px-4 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors relative overflow-hidden"
            style={{ borderRadius: '6px', fontWeight: 500 }}
          >
            {/* Countdown progress bar — shrinks over the total countdown */}
            <div
              className="absolute bottom-0 left-0 h-[2px] bg-white/30"
              style={{
                animation: `success-countdown-shrink ${countdown + 1}s linear forwards`,
              }}
            />
            <span className="text-[13px] flex items-center gap-1.5">
              View Quote
              <ArrowRight className="w-3.5 h-3.5" />
            </span>
            {/* Compact countdown */}
            <span
              className="absolute right-3 text-[11px] text-white/60"
              style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}
            >
              {countdown}s
            </span>
          </button>

          {/* Secondary row */}
          <div className="grid grid-cols-2 gap-2 mt-2">
            <button
              onClick={handleCreateAnother}
              className="flex items-center justify-center gap-1.5 h-8 px-3 border border-border text-[12px] text-muted-foreground bg-white hover:bg-[#F0F7FF] hover:border-primary hover:text-primary transition-colors"
              style={{ borderRadius: '6px', fontWeight: 500 }}
            >
              <Plus className="w-3 h-3" />
              New Quote
            </button>
            <button
              onClick={onClose}
              className="flex items-center justify-center gap-1.5 h-8 px-3 border border-border text-[12px] text-muted-foreground bg-white hover:bg-[#F0F7FF] hover:border-primary hover:text-primary transition-colors"
              style={{ borderRadius: '6px', fontWeight: 500 }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}