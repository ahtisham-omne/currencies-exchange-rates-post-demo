import { Search } from 'lucide-react';

export function TopBar() {
  return (
    <div style={{
      height: '52px', backgroundColor: '#FFFFFF',
      borderBottom: '1px solid #E9EDF2',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 24px', flexShrink: 0,
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      {/* Left — Breadcrumbs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ fontSize: '13px', color: '#94A3B8', fontWeight: 400 }}>Sales</span>
        <span style={{ fontSize: '13px', color: '#CBD5E1', fontWeight: 400 }}>/</span>
        <span style={{ fontSize: '13px', fontWeight: 500, color: '#1E293B' }}>Quotes</span>
      </div>

      {/* Right — Search + User */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        {/* Search trigger */}
        <div style={{ position: 'relative' }}>
          <Search style={{
            position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)',
            width: '14px', height: '14px', color: '#94A3B8',
          }} />
          <input
            type="text"
            placeholder="Search"
            style={{
              width: '180px', height: '34px', paddingLeft: '34px', paddingRight: '12px',
              backgroundColor: '#FFFFFF', border: '1px solid #E9EDF2', borderRadius: '8px',
              fontSize: '13px', color: '#334155', outline: 'none',
              fontFamily: 'Inter, system-ui, sans-serif',
              transition: 'border-color 150ms, box-shadow 150ms, width 200ms',
            }}
            onFocus={e => { e.currentTarget.style.borderColor = '#2563EB'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(37,99,235,0.08)'; e.currentTarget.style.width = '260px'; }}
            onBlur={e => { e.currentTarget.style.borderColor = '#E9EDF2'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.width = '180px'; }}
          />
        </div>

        {/* User */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '50%',
            background: 'linear-gradient(135deg, #818CF8, #6366F1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '11px', fontWeight: 700, color: '#FFFFFF', flexShrink: 0,
          }}>
            AA
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A', lineHeight: '1.25' }}>Ahtisham Ahmad</div>
            <div style={{ fontSize: '11px', color: '#94A3B8', lineHeight: '1.25' }}>Product Designer</div>
          </div>
        </div>
      </div>
    </div>
  );
}
