import { Clock } from 'lucide-react';

interface ComingSoonTabProps {
  title: string;
  description?: string;
}

export function ComingSoonTab({ title, description }: ComingSoonTabProps) {
  return (
    <div
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '12px',
        border: '1px solid var(--border)',
        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '340px',
        padding: '48px 24px',
        gap: '14px',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      }}
    >
      <div
        style={{
          width: '44px',
          height: '44px',
          borderRadius: '10px',
          backgroundColor: '#EFF6FF',
          border: '1px solid #BFDBFE',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Clock style={{ width: '20px', height: '20px', color: '#0F62D6' }} />
      </div>

      <h3
        style={{
          fontSize: '14px',
          fontWeight: 600,
          color: 'var(--foreground)',
          margin: 0,
          lineHeight: '1.2',
        }}
      >
        {title}
      </h3>

      {/* Coming Soon pill — same chrome as the Sales Order module's
          placeholder tabs so the unfinished surfaces read consistently
          across modules. */}
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '2px 10px',
          fontSize: 11,
          fontWeight: 600,
          color: '#0F62D6',
          backgroundColor: '#EFF6FF',
          border: '1px solid #BFDBFE',
          borderRadius: 999,
          lineHeight: 1,
        }}
      >
        Coming Soon
      </span>

      <p
        style={{
          fontSize: '12px',
          fontWeight: 400,
          color: 'var(--muted-foreground)',
          margin: 0,
          lineHeight: '1.5',
          textAlign: 'center',
          maxWidth: '380px',
        }}
      >
        {description || 'This feature is under development and will be available soon.'}
      </p>
    </div>
  );
}
