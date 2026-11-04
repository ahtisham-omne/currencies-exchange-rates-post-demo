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
        borderRadius: '10px',
        border: '1px solid #E5E7EB',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '340px',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      }}
    >
      <div
        style={{
          width: '48px',
          height: '48px',
          borderRadius: '12px',
          backgroundColor: '#F3F4F6',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '16px',
        }}
      >
        <Clock style={{ width: '22px', height: '22px', color: '#9CA3AF' }} />
      </div>
      <h3
        style={{
          fontSize: '14px',
          fontWeight: 600,
          color: '#1F2937',
          margin: '0 0 6px 0',
          lineHeight: '1.2',
        }}
      >
        {title}
      </h3>
      <p
        style={{
          fontSize: '13px',
          fontWeight: 400,
          color: '#9CA3AF',
          margin: 0,
          lineHeight: '1.4',
          textAlign: 'center',
          maxWidth: '280px',
        }}
      >
        {description || 'This feature is under development and will be available soon.'}
      </p>
    </div>
  );
}