import { HighlightText } from '@/app/components/HighlightText';

interface CustomerCellProps {
  customer: {
    id: string;
    name: string;
    logoUrl?: string;
    location?: {
      name: string;
      isPrimary: boolean;
    };
  };
  onClick: () => void;
  searchTerm?: string;
}

const avatarColors = [
  { bg: '#DBEAFE', text: '#1E40AF' },
  { bg: 'hsl(var(--destructive) / 0.1)', text: 'hsl(var(--destructive))' },
  { bg: '#D1FAE5', text: '#065F46' },
  { bg: '#FEF3C7', text: '#92400E' },
  { bg: 'hsl(var(--accent))', text: 'hsl(var(--primary))' },
  { bg: '#FECACA', text: '#991B1B' },
  { bg: '#CCFBF1', text: '#115E59' },
  { bg: '#FED7AA', text: '#9A3412' },
  { bg: '#E9D5FF', text: 'hsl(var(--primary))' },
  { bg: '#BAE6FD', text: '#075985' },
];

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

function getInitials(name: string) {
  return name.split(' ').map(w => w.charAt(0)).join('').substring(0, 2).toUpperCase();
}

export function CustomerCell({ customer, onClick, searchTerm = '' }: CustomerCellProps) {
  const color = getAvatarColor(customer.name);
  const initials = getInitials(customer.name);

  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        width: '100%', textAlign: 'left', border: 'none',
        backgroundColor: 'transparent', cursor: 'pointer', padding: 0,
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      {/* Colored circle avatar */}
      {customer.logoUrl ? (
        <img
          src={customer.logoUrl}
          alt={customer.name}
          style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
        />
      ) : (
        <div style={{
          width: '28px', height: '28px', borderRadius: '50%',
          backgroundColor: color.bg, color: color.text,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, fontSize: '10px', fontWeight: 600,
        }}>
          {initials}
        </div>
      )}

      {/* Name */}
      <span style={{
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        flex: 1, minWidth: 0,
      }}>
        <HighlightText
          text={customer.name}
          searchTerm={searchTerm}
          className="text-[13px] text-[#1F2937]"
        />
      </span>
    </button>
  );
}
