import { useState, useEffect, useRef } from 'react';
import { CheckCircle2, ArrowLeft, X } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface QuoteCreatedToastProps {
  toastId: string | number;
  quoteLabel: string;
  customerName: string;
  duration: number; // ms
}

export function QuoteCreatedToast({ toastId, quoteLabel, customerName, duration }: QuoteCreatedToastProps) {
  const navigate = useNavigate();
  const [remaining, setRemaining] = useState(duration);
  const startRef = useRef(Date.now());

  useEffect(() => {
    const tick = () => {
      const elapsed = Date.now() - startRef.current;
      const left = Math.max(0, duration - elapsed);
      setRemaining(left);
      if (left > 0) {
        rafId = requestAnimationFrame(tick);
      }
    };
    let rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [duration]);

  const seconds = Math.ceil(remaining / 1000);
  const progress = remaining / duration; // 1 → 0

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '360px',
        backgroundColor: '#FFFFFF',
        border: '1px solid #E5E7EB',
        borderRadius: '8px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.04)',
        fontFamily: 'Inter, system-ui, sans-serif',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Progress bar along the bottom */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          height: '3px',
          width: `${progress * 100}%`,
          backgroundColor: '#1B6EF3',
          borderRadius: '0 2px 0 0',
          transition: 'width 100ms linear',
        }}
      />

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '14px 14px 12px' }}>
        {/* Success icon */}
        <div
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            backgroundColor: '#ECFDF5',
            border: '1px solid #D1FAE5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <CheckCircle2 style={{ width: '16px', height: '16px', color: '#059669' }} />
        </div>

        {/* Text */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#1F2937', lineHeight: 1.3 }}>
            Quote {quoteLabel} created
          </div>
          <div style={{ fontSize: '12px', fontWeight: 400, color: '#6B7280', lineHeight: 1.4, marginTop: '2px' }}>
            {customerName}
          </div>
        </div>

        {/* Close button */}
        <button
          onClick={() => toast.dismiss(toastId)}
          style={{
            width: '24px',
            height: '24px',
            borderRadius: '6px',
            border: 'none',
            backgroundColor: 'transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            color: '#9CA3AF',
            transition: 'all 120ms',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.backgroundColor = '#F3F4F6';
            e.currentTarget.style.color = '#6B7280';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = '#9CA3AF';
          }}
        >
          <X style={{ width: '14px', height: '14px' }} />
        </button>
      </div>

      {/* CTA row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 14px 12px',
        }}
      >
        <button
          onClick={() => {
            toast.dismiss(toastId);
            navigate('/quotes');
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            height: '28px',
            padding: '0 12px',
            borderRadius: '6px',
            border: '1px solid #E5E7EB',
            backgroundColor: '#FFFFFF',
            fontSize: '12px',
            fontWeight: 500,
            color: '#374151',
            cursor: 'pointer',
            fontFamily: 'Inter, system-ui, sans-serif',
            transition: 'all 120ms',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.backgroundColor = '#F9FAFB';
            e.currentTarget.style.borderColor = '#D1D5DB';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.backgroundColor = '#FFFFFF';
            e.currentTarget.style.borderColor = '#E5E7EB';
          }}
        >
          <ArrowLeft style={{ width: '13px', height: '13px' }} />
          Back to Quotes
        </button>

        <span
          style={{
            fontSize: '11px',
            fontWeight: 500,
            color: '#9CA3AF',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {seconds}s
        </span>
      </div>
    </div>
  );
}
